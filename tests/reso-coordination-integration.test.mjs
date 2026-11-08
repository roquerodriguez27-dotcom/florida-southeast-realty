import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as nodeCrypto from 'node:crypto';
import { getEventListeners } from 'node:events';
import { setImmediate as tick } from 'node:timers/promises';
import ts from 'typescript';
import * as policy from '../lib/reso-upstream-policy.ts';
import * as shared from '../lib/reso-shared-coordinator.ts';

const PROVIDER = 'https://replication.sparkapi.com/Version/3/Reso/OData/Property';
const SECRET = 'integration-fixture-only-secret-never-a-live-credential';
const ok = () => new Response('{"value":[{"ListingKey":"fixture-listing"}]}', { headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const source = fs.readFileSync(new URL('../instrumentation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixtureStore() {
  const owners = new Map(), snapshots = new Map(), acquisitions = [], finishes = [];
  const key = value => `${value.scopeHash}:${value.queryHash}`;
  return {
    acquisitions, finishes,
    async acquire(identity) {
      acquisitions.push(identity);
      if (snapshots.has(key(identity))) return { decision: 'cached', snapshot: snapshots.get(key(identity)) };
      if (owners.has(key(identity))) return { decision: 'waiting', reason: 'duplicate', retry_after_ms: 330_000 };
      owners.set(key(identity), identity.owner);
      return { decision: 'granted' };
    },
    async finish(completion) {
      finishes.push(completion);
      if (owners.get(key(completion)) !== completion.owner) return false;
      owners.delete(key(completion));
      if (completion.response) snapshots.set(key(completion), completion.response);
      return true;
    },
  };
}

async function instrument(upstream, store) {
  let time = 1_000_000, timerId = 0;
  const timers = new Map(), warnings = [], providerEvents = [], configurations = [];
  const context = vm.createContext({
    process: { env: { NEXT_RUNTIME: 'nodejs', RESO_COORDINATOR_SECRET: SECRET } },
    console: { warn: (...values) => warnings.push(values) },
    fetch: upstream, URL, Request, Response, Headers, AbortController, DOMException,
    Date: class extends Date { static now() { return time; } },
    performance: { now: () => time },
    setTimeout: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    module: { exports: {} },
    require: name => {
      if (name === 'node:crypto') return nodeCrypto;
      if (name === './lib/reso-upstream-policy') return {
        ...policy,
        createResoUpstreamPolicy: original => policy.createResoUpstreamPolicy(original, {
          now: () => time, timingNow: () => time, onFailure: event => providerEvents.push(event),
        }),
      };
      if (name === './lib/reso-shared-coordinator') return {
        ...shared,
        createResoCoordinatorStore: configuration => { configurations.push(configuration); return store; },
        createResoSharedCoordinator: (original, options) => shared.createResoSharedCoordinator(original, {
          ...options, now: () => time,
          wait: async () => { time += 1; await tick(); },
        }),
      };
      if (name === './lib/supabase/config') return { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key' };
      throw new Error(`Unexpected fixture import: ${name}`);
    },
  });
  context.exports = context.module.exports;
  vm.runInContext(compiled, context);
  await context.module.exports.register();
  return { context, timers, warnings, providerEvents, configurations };
}

test('configured instrumentation admits cold requests through shared coordination and bypasses it for safe hot-cache hits', async () => {
  const store = fixtureStore(); let calls = 0;
  const state = await instrument(async () => { calls++; return ok(); }, store);
  assert.equal(state.configurations.length, 1);
  assert.equal(state.configurations[0].secret, SECRET);
  assert.equal(state.configurations[0].url, 'https://fixture.supabase.co');
  assert.equal(state.configurations[0].publishableKey, 'fixture-public-key');
  const headersA = { Authorization: 'Bearer credential-A' };
  const first = await state.context.fetch(PROVIDER, { headers: headersA });
  assert.equal(first.status, 200);
  assert.equal(calls, 1); assert.equal(store.acquisitions.length, 1);
  const next = await state.context.fetch(PROVIDER, { headers: headersA });
  assert.equal(next.status, 200);
  assert.equal(calls, 1); assert.equal(store.acquisitions.length, 1);
  await state.context.fetch(PROVIDER, { headers: { Authorization: 'Bearer credential-B' } });
  assert.equal(calls, 2, 'outer cache must also respect the credential boundary');
  assert.equal(store.acquisitions.length, 2);
  assert.equal(store.finishes.length, 2);
  assert.equal(state.context.__fsrResoInflight.size, 0);
  assert.equal(state.context.__fsrResoActiveUpstream, 0);
  assert.equal(state.timers.size, 0);
  assert.equal(state.providerEvents.length, 0);
});

test('independent registered server workers use one provider request and receive the same result', async () => {
  const store = fixtureStore(), result = deferred(), started = deferred(); let calls = 0;
  const upstream = async () => { calls++; started.resolve(); return result.promise; };
  const a = await instrument(upstream, store), b = await instrument(upstream, store);
  const first = a.context.fetch(PROVIDER);
  await started.promise;
  const second = b.context.fetch(PROVIDER);
  await tick();
  assert.equal(calls, 1);
  assert.ok(store.acquisitions.length >= 2);
  result.resolve(ok());
  const [responseA, responseB] = await Promise.all([first, second]);
  assert.deepEqual(await responseA.json(), await responseB.json());
  assert.equal(responseB.headers.get('x-fsr-reso-shared'), 'hit');
  assert.equal(calls, 1); assert.equal(store.finishes.length, 1);
  assert.equal(a.timers.size, 0); assert.equal(b.timers.size, 0);
  assert.equal(a.context.__fsrResoInflight.size, 0); assert.equal(b.context.__fsrResoInflight.size, 0);
});

test('shared denials and coordination transport failures do not become outer provider failures', async () => {
  for (const transportFailure of [false, true]) {
    let calls = 0, finishes = 0;
    const store = {
      acquire: async () => {
        if (transportFailure) throw new Error('fixture database unavailable');
        return { decision: 'paused', reason: 'throttled', retry_after_ms: 300_000 };
      },
      finish: async () => { finishes++; return false; },
    };
    const state = await instrument(async () => { calls++; return ok(); }, store);
    for (let i = 0; i < 4; i++) {
      const response = await state.context.fetch(`${PROVIDER}?case=${i}`);
      assert.equal(response.status, transportFailure ? 503 : 429);
      assert.equal(response.headers.get('x-fsr-reso-admission'), 'local');
    }
    assert.equal(calls, 0);
    assert.equal(finishes, transportFailure ? 4 : 0, 'a local blocked attempt cannot renew a penalty');
    assert.equal(state.providerEvents.length, 0);
    assert.equal(state.context.__fsrResoFailureTimes.length, 0);
    assert.equal(state.context.__fsrResoCircuitOpenUntil, 0);
    assert.equal(state.context.__fsrResoProviderBackoffUntil, 0);
    assert.equal(state.context.__fsrResoProviderUnavailableUntil, 0);
    assert.equal(state.timers.size, 0);
  }
});

test('configured Request inputs retain the six-second guard and clean cancellation through every layer', async () => {
  for (const cancellation of [false, true]) {
    const store = fixtureStore(), started = deferred(), caller = new AbortController(); let calls = 0;
    const state = await instrument(async (_input, init) => {
      if (++calls > 1) return ok();
      started.resolve();
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
    }, store);
    const input = new Request(PROVIDER, { signal: caller.signal });
    const originalCallerListeners = getEventListeners(caller.signal, 'abort').length;
    const request = state.context.fetch(input);
    await started.promise;
    const guard = [...state.timers.values()].find(timer => timer.ms === 6_000);
    assert.ok(guard, 'Request inputs require the same bounded lifetime as URL inputs');
    if (cancellation) caller.abort(); else guard.callback();
    await assert.rejects(request, { name: cancellation ? 'AbortError' : 'TimeoutError' });
    assert.equal(store.finishes[0].outcome, cancellation ? 'cancelled' : 'interrupted');
    assert.equal(state.providerEvents.length, cancellation ? 0 : 1);
    assert.equal(state.timers.size, 0);
    assert.equal(getEventListeners(input.signal, 'abort').length, 0);
    assert.ok(getEventListeners(caller.signal, 'abort').length <= originalCallerListeners);
    if (cancellation) {
      assert.equal((await state.context.fetch(new Request(`${PROVIDER}?different=1`))).status, 200);
      assert.equal(calls, 2);
      assert.equal(state.timers.size, 0);
    }
  }
});
