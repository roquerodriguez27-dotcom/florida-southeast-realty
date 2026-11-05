import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
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
  const events = [];
  let wallTime = 1_000_000;
  let monotonicTime = 0;
  let timerId = 0;
  const context = vm.createContext({
    process: { env: { NEXT_RUNTIME: 'nodejs' } },
    console: { warn: (...values) => warnings.push(values) },
    fetch: upstream, URL: globalThis.URL, Request, Response, Headers, AbortController, DOMException,
    Date: class extends Date { static now() { return wallTime; } },
    performance: { now: () => monotonicTime },
    setTimeout: (fn, ms) => { const id = ++timerId; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    module: { exports: {} },
    require: name => {
      if (name === './lib/reso-upstream-policy') return {
        ...policyModule,
        createResoUpstreamPolicy: upstream => policyModule.createResoUpstreamPolicy(upstream, {
          now: () => wallTime, timingNow: () => monotonicTime, onFailure: event => events.push(event),
        }),
      };
      throw new Error(name);
    },
  });
  context.exports = context.module.exports;
  const source = fs.readFileSync(new globalThis.URL('../instrumentation.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(compiled, context);
  await context.module.exports.register();
  return { context, timeouts, warnings, events,
    advance: ms => { wallTime += ms; monotonicTime += ms; },
    moveWallClock: ms => { wallTime += ms; },
  };
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

async function pendingInstrumentedRequest(input = URL, init) {
  let announceStart;
  const ready = new Promise(resolve => { announceStart = resolve; });
  let reject;
  let signal;
  const harness = await instrument(async (input, init) => {
    signal = init?.signal ?? input.signal;
    announceStart();
    return new Promise((_resolve, rejectRequest) => { reject = rejectRequest; });
  });
  const request = harness.context.fetch(input, init);
  await ready;
  return { ...harness, request, signal, reject };
}

test('deadline diagnostics separate a late timer from delayed abort rejection', async () => {
  for (const [timerAt, rejectDelay] of [[6000, 2000], [8500, 0], [8000, 1500]]) {
    const h = await pendingInstrumentedRequest();
    const timer = [...h.timeouts.values()].find(timer => timer.ms === 6000);
    assert.ok(timer, 'The existing six-second deadline must stay unchanged');
    h.advance(timerAt); timer.fn();
    assert.equal(h.signal.aborted, true);
    h.advance(rejectDelay); h.reject(h.signal.reason);
    assert.equal((await h.request).status, 503);
    const event = h.events[0];
    assert.equal(event.deadlineSource, 'upstream_timeout');
    assert.equal(event.abortAfterMs, timerAt);
    assert.equal(event.timerLatenessMs, timerAt - 6000);
    assert.equal(event.abortToRejectionMs, rejectDelay);
    assert.equal(event.durationMs, timerAt + rejectDelay);
    assert.equal(event.retryAfterSeconds, 30);
    assert.equal(h.timeouts.size, 0);
    assert.equal(h.context.__fsrResoActiveUpstream, 0);
  }
});

test('first winning abort source survives a later competing callback', async () => {
  for (const callerFirst of [true, false]) {
    const controller = new AbortController();
    const h = await pendingInstrumentedRequest(URL, { signal: controller.signal });
    const timer = [...h.timeouts.values()].find(timer => timer.ms === 6000);
    const callerReason = new DOMException('PRIVATE-CANARY-caller-deadline', 'TimeoutError');
    h.advance(callerFirst ? 3000 : 6000);
    if (callerFirst) controller.abort(callerReason); else timer.fn();
    const winningReason = h.signal.reason;
    h.advance(callerFirst ? 3000 : 1000);
    if (callerFirst) timer.fn(); else controller.abort(callerReason);
    assert.equal(h.signal.reason, winningReason);
    h.advance(1000); h.reject(winningReason);
    assert.equal((await h.request).status, 503);
    const event = h.events[0];
    assert.equal(event.deadlineSource, callerFirst ? 'caller_signal' : 'upstream_timeout');
    assert.equal(event.abortAfterMs, callerFirst ? 3000 : 6000);
    assert.equal(event.timerLatenessMs, callerFirst ? null : 0);
    assert.equal(event.abortToRejectionMs, callerFirst ? 4000 : 2000);
    assert.doesNotMatch(JSON.stringify(h.events), /PRIVATE-CANARY/);
    assert.equal(h.timeouts.size, 0);
  }
});

test('direct Request aborts get relative timing but no invented timer or deadline', async () => {
  const controller = new AbortController();
  const h = await pendingInstrumentedRequest(new Request(URL, { signal: controller.signal }));
  assert.equal(h.timeouts.size, 0, 'Request objects must keep bypassing the outer timeout wrapper');
  h.advance(4500); controller.abort(new DOMException('PRIVATE-CANARY', 'TimeoutError'));
  h.advance(500); h.reject(h.signal.reason);
  await assert.rejects(h.request, { name: 'TimeoutError' });
  assert.equal(h.events[0].deadlineSource, 'caller_signal');
  assert.equal(h.events[0].abortAfterMs, 4500);
  assert.equal(h.events[0].timerLatenessMs, null);
  assert.equal(h.events[0].abortToRejectionMs, 500);
});

test('monotonic abort timings ignore wall-clock adjustments', async () => {
  const h = await pendingInstrumentedRequest();
  h.advance(6500);
  h.moveWallClock(-200_000);
  [...h.timeouts.values()].find(timer => timer.ms === 6000).fn();
  h.advance(500); h.reject(h.signal.reason);
  await h.request;
  assert.equal(h.events[0].abortAfterMs, 6500);
  assert.equal(h.events[0].timerLatenessMs, 500);
  assert.equal(h.events[0].abortToRejectionMs, 500);
});

test('observation listeners are removed on every settled upstream outcome', async t => {
  for (const outcome of ['success', 'http', 'network', 'cancel', 'timeout']) {
    const controller = new AbortController();
    const signal = controller.signal;
    const remove = t.mock.method(signal, 'removeEventListener');
    const events = [];
    const policy = createResoUpstreamPolicy(async () => {
      if (outcome === 'success') return ok();
      if (outcome === 'http') return new Response('', { status: 503 });
      if (outcome === 'cancel') controller.abort();
      if (outcome === 'timeout') controller.abort(new DOMException('deadline', 'TimeoutError'));
      throw signal.reason ?? new Error('network');
    }, { onFailure: event => events.push(event) });
    try { await policy(URL, { signal }); } catch { /* Expected rejected outcomes. */ }
    assert.equal(remove.mock.calls.filter(call => call.arguments[0] === 'abort').length, 1, outcome);
    assert.equal(getEventListeners(signal, 'abort').length, 0, outcome);
    assert.equal(events.length, ['success', 'cancel'].includes(outcome) ? 0 : 1);
  }
});

test('new timing fields are bounded, finite or null, and sources are allowlisted', async () => {
  for (const [abortAt, rejectAt, dueAt] of [[1_000_000, 2_000_000, 6000], [NaN, Infinity, NaN], [-100, -200, 6000]]) {
    let time = 0;
    const controller = new AbortController();
    const events = [];
    const policy = createResoUpstreamPolicy(async () => {
      time = abortAt;
      policyModule.observeResoDeadlineAbort(controller.signal, 'upstream_timeout', time, dueAt);
      controller.abort(new DOMException('PRIVATE-CANARY', 'TimeoutError'));
      time = rejectAt;
      throw controller.signal.reason;
    }, { timingNow: () => time, onFailure: event => events.push(event) });
    await assert.rejects(policy(URL, { signal: controller.signal }), { name: 'TimeoutError' });
    for (const key of ['abortAfterMs', 'timerLatenessMs', 'abortToRejectionMs']) {
      assert.ok(events[0][key] === null || (Number.isFinite(events[0][key]) && events[0][key] >= 0 && events[0][key] <= 300_000), key);
    }
    assert.ok(['upstream_timeout', 'caller_signal', 'unknown', 'not_aborted'].includes(events[0].deadlineSource));
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE-CANARY|"abortedAt"|"dueAt"|"signal"|"reason"/);
    if (abortAt === 1_000_000) {
      assert.equal(events[0].abortAfterMs, 300_000);
      assert.equal(events[0].timerLatenessMs, 300_000);
      assert.equal(events[0].abortToRejectionMs, 300_000);
    }
  }
});
