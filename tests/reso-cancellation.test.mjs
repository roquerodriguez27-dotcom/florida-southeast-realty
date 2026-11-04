import test from 'node:test';
import assert from 'node:assert/strict';
import { createResoUpstreamPolicy } from '../lib/reso-upstream-policy.ts';
const URL = 'https://replication.sparkapi.com/Version/3/Reso/OData/Property';
const ok = () => new Response('{"value":[]}', { status: 200 });

test('cancelling an in-flight caller does not pause unrelated MLS requests', async () => {
  let calls = 0;
  const events = [];
  const policy = createResoUpstreamPolicy(async (_input, init) => {
    if (++calls > 1) return ok();
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  }, { onFailure: event => events.push(event) });
  const controller = new AbortController();
  const request = policy(URL, { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal((await policy(`${URL}?next=1`)).status, 200);
  assert.equal(calls, 2);
  assert.equal(events.length, 0);
});

test('Request-object cancellation also leaves provider admission healthy', async () => {
  let calls = 0;
  const events = [];
  const policy = createResoUpstreamPolicy(async input => {
    if (++calls > 1) return ok();
    return new Promise((_resolve, reject) => input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true }));
  }, { onFailure: event => events.push(event) });
  const controller = new AbortController();
  const request = policy(new Request(URL, { signal: controller.signal }));
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal((await policy(new Request(`${URL}?next=1`))).status, 200);
  assert.equal(events.length, 0);
});

test('a real timeout continues to pause provider requests', async () => {
  let calls = 0;
  const events = [];
  const policy = createResoUpstreamPolicy(async (_input, init) => {
    calls++;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  }, { onFailure: event => events.push(event) });
  const controller = new AbortController();
  const request = policy(URL, { signal: controller.signal });
  controller.abort(new DOMException('deadline', 'TimeoutError'));
  await assert.rejects(request, { name: 'TimeoutError' });
  assert.equal((await policy(`${URL}?next=1`)).status, 503);
  assert.equal(calls, 1);
  assert.equal(events.length, 1);
});

import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policyModule from '../lib/reso-upstream-policy.ts';

async function instrument(upstream) {
  const timeouts = new Map();
  const warnings = [];
  let timerId = 0;
  const context = vm.createContext({
    process: { env: { NEXT_RUNTIME: 'nodejs' } },
    console: { warn: (...values) => warnings.push(values) },
    fetch: upstream, URL: globalThis.URL, Request, Response, Headers, AbortController, DOMException,
    setTimeout: (fn, ms) => { const id = ++timerId; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    module: { exports: {} },
    require: name => { if (name === './lib/reso-upstream-policy') return policyModule; throw new Error(name); },
  });
  context.exports = context.module.exports;
  const source = fs.readFileSync(new globalThis.URL('../instrumentation.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(compiled, context);
  await context.module.exports.register();
  return { context, timeouts, warnings };
}

test('outer cache does not turn caller cancellation into a provider outage', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let calls = 0;
  const { context, timeouts } = await instrument(async (_input, init) => {
    if (++calls > 1) return ok();
    started();
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  });
  const controller = new AbortController();
  const request = context.fetch(URL, { signal: controller.signal });
  await ready;
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal((await context.fetch(`${URL}?next=1`)).status, 200);
  assert.equal(calls, 2);
  assert.equal(context.__fsrResoProviderUnavailableUntil, 0);
  assert.equal(context.__fsrResoFailureTimes.length, 0);
  assert.equal(context.__fsrResoActiveUpstream, 0);
  assert.equal(context.__fsrResoInflight.size, 0);
  assert.equal(timeouts.size, 0);
});

test('outer timeout keeps TimeoutError identity and outage protection', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let observedReason;
  let calls = 0;
  const { context, timeouts } = await instrument(async (_input, init) => {
    calls++;
    started();
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => { observedReason = init.signal.reason; reject(observedReason); }, { once: true }));
  });
  const request = context.fetch(URL);
  await ready;
  const timer = [...timeouts.values()].find(value => value.ms === 6000);
  assert.ok(timer);
  timer.fn();
  assert.equal((await request).status, 503);
  assert.equal(observedReason.name, 'TimeoutError');
  assert.equal((await context.fetch(`${URL}?next=1`)).status, 503);
  assert.equal(calls, 1);
  assert.equal(context.__fsrResoFailureTimes.length, 1);
  assert.equal(context.__fsrResoActiveUpstream, 0);
  assert.equal(timeouts.size, 0);
});

test('pre-cancelled calls do not consume a cache slot or trip outer protection', async () => {
  let calls = 0;
  const { context } = await instrument(async () => { calls++; return ok(); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(context.fetch(URL, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
  assert.equal(context.__fsrResoFailureTimes.length, 0);
  assert.equal((await context.fetch(URL)).status, 200);
});
