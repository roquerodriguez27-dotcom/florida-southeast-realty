import test from 'node:test';
import assert from 'node:assert/strict';
import { createResoUpstreamPolicy } from '../lib/reso-upstream-policy.ts';

const URL = 'https://replication.sparkapi.com/Version/3/Reso/OData/Property';
const ok = () => new Response('{"value":[]}', { status: 200 });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(implementation) {
  let time = 1_000_000;
  let calls = 0;
  const events = [];
  const fetch = createResoUpstreamPolicy((...args) => { calls++; return implementation(...args); }, {
    now: () => time, onFailure: event => events.push(event),
  });
  return { fetch, events, advance: ms => { time += ms; }, calls: () => calls };
}

test('ordinary successful requests pass through', async () => {
  const s = setup(async () => ok());
  assert.equal((await s.fetch(URL)).status, 200);
  assert.equal((await s.fetch(URL)).status, 200);
  assert.equal(s.calls(), 2);
  assert.equal(s.events.length, 0);
});

test('503 pauses all different MLS URLs without another upstream call', async () => {
  const s = setup(async () => new Response('', { status: 503 }));
  await s.fetch(URL);
  const response = await s.fetch(`${URL}?other=1`);
  assert.equal(s.calls(), 1);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-fsr-reso-admission'), 'local');
  assert.equal(response.headers.get('retry-after'), '30');
  assert.equal(s.events.length, 1);
});

test('late concurrent success cannot erase a newer failure pause', async () => {
  const a = deferred(), b = deferred();
  let index = 0;
  const s = setup(() => index++ === 0 ? a.promise : b.promise);
  const first = s.fetch(URL), second = s.fetch(`${URL}?second`);
  a.resolve(new Response('', { status: 503 })); await first;
  b.resolve(ok()); await second;
  assert.equal((await s.fetch(`${URL}?third`)).headers.get('x-fsr-reso-admission'), 'local');
  assert.equal(s.calls(), 2);
});

test('only one recovery probe is allowed and success reopens admission', async () => {
  const probe = deferred(); let index = 0;
  const s = setup(() => ++index === 1 ? Promise.resolve(new Response('', { status: 503 })) : index === 2 ? probe.promise : Promise.resolve(ok()));
  await s.fetch(URL); s.advance(30_001);
  const pending = s.fetch(URL);
  const blocked = await s.fetch(`${URL}?other`);
  assert.equal(blocked.headers.get('x-fsr-reso-fallback'), 'capacity_protected');
  assert.equal(s.calls(), 2);
  probe.resolve(ok()); assert.equal((await pending).status, 200);
  assert.equal((await s.fetch(URL)).status, 200);
  assert.equal(s.calls(), 3);
});

test('repeated failed probes use bounded exponential backoff', async () => {
  const s = setup(async () => new Response('', { status: 503 }));
  for (const expected of [30, 60, 120, 240, 300, 300]) {
    await s.fetch(URL);
    const blocked = await s.fetch(URL);
    assert.equal(Number(blocked.headers.get('retry-after')), expected);
    s.advance(expected * 1000 + 1);
  }
  assert.equal(s.calls(), 6);
});

test('parallel failures do not multiply the first pause', async () => {
  const a = deferred(), b = deferred(); let index = 0;
  const s = setup(() => index++ === 0 ? a.promise : b.promise);
  const first = s.fetch(URL), second = s.fetch(URL);
  a.resolve(new Response('', { status: 503 })); await first;
  b.resolve(new Response('', { status: 503 })); await second;
  assert.equal((await s.fetch(URL)).headers.get('retry-after'), '30');
  assert.deepEqual(s.events.map(e => e.consecutiveFailures), [1, 1]);
});

test('provider Retry-After longer than five minutes is honored', async () => {
  const s = setup(async () => new Response('', { status: 429, headers: { 'Retry-After': '900' } }));
  await s.fetch(URL); s.advance(300_000);
  const blocked = await s.fetch(URL);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '600');
  assert.equal(s.calls(), 1);
});

test('HTTP-date Retry-After is honored', async () => {
  const date = new Date(1_000_000 + 900_000).toUTCString();
  const s = setup(async () => new Response('', { status: 503, headers: { 'Retry-After': date } }));
  await s.fetch(URL);
  assert.equal((await s.fetch(URL)).headers.get('retry-after'), '900');
});

test('network exceptions pause subsequent calls but preserve the original error', async () => {
  const error = new Error('simulated connection reset');
  const s = setup(async () => { throw error; });
  await assert.rejects(s.fetch(URL), e => e === error);
  assert.equal((await s.fetch(URL)).headers.get('x-fsr-reso-fallback'), 'network_error');
  assert.equal(s.calls(), 1);
});

test('non-MLS traffic and non-GET traffic are not intercepted', async () => {
  const s = setup(async () => new Response('', { status: 503 }));
  await s.fetch(URL);
  await s.fetch('https://example.com/');
  await s.fetch(URL, { method: 'POST' });
  assert.equal(s.calls(), 3);
  assert.equal(s.events.length, 1);
});

test('Request inputs cannot bypass provider admission', async () => {
  const s = setup(async () => new Response('', { status: 503 }));
  await s.fetch(new Request(URL));
  const blocked = await s.fetch(new Request(URL));
  assert.equal(blocked.headers.get('x-fsr-reso-admission'), 'local');
  assert.equal(s.calls(), 1);
});

test('ordinary 404 responses retain the lookup fallback behavior', async () => {
  const s = setup(async () => new Response('', { status: 404 }));
  assert.equal((await s.fetch(URL)).status, 404);
  assert.equal((await s.fetch(URL)).status, 404);
  assert.equal(s.calls(), 2);
  assert.equal(s.events.length, 0);
});

test('initial upstream concurrency is bounded', async () => {
  const d = Array.from({ length: 4 }, deferred); let index = 0;
  const s = setup(() => d[index++].promise);
  const pending = d.map(() => s.fetch(URL));
  const blocked = await s.fetch(URL);
  assert.equal(blocked.headers.get('x-fsr-reso-fallback'), 'capacity_protected');
  assert.equal(s.calls(), 4);
  d.forEach(x => x.resolve(ok())); await Promise.all(pending);
});

test('successful recovery resets automatic backoff for a later independent failure', async () => {
  let index = 0;
  const s = setup(async () => ++index === 2 ? ok() : new Response('', { status: 503 }));
  await s.fetch(URL); s.advance(30_001); await s.fetch(URL); await s.fetch(URL);
  assert.equal((await s.fetch(URL)).headers.get('retry-after'), '30');
});

test('network diagnostics report only allowlisted error details and actual upstream duration', async () => {
  const error = new TypeError('sensitive request details', { cause: { code: 'ECONNRESET', message: 'secret server response' } });
  const s = setup(async () => { s.advance(137); throw error; });
  await assert.rejects(s.fetch(`${URL}?$filter=secret-query`), value => value === error);
  assert.deepEqual(s.events, [{
    kind: 'actual_upstream_failure', status: 'network_error', consecutiveFailures: 1,
    retryAfterSeconds: 30, requestKind: 'property_collection', durationMs: 137,
    failureType: 'network_error', errorClass: 'TypeError', causeCode: 'ECONNRESET',
  }]);
  await s.fetch(`${URL}?different=secret`);
  assert.equal(s.calls(), 1);
  assert.equal(s.events.length, 1, 'Local admission rejection must not create another upstream event');
});

test('known DNS, socket, TLS, and timeout cause codes use fixed categories', async () => {
  for (const [code, type] of [
    ['ENOTFOUND', 'network_error'], ['EAI_AGAIN', 'network_error'], ['UND_ERR_SOCKET', 'network_error'],
    ['CERT_HAS_EXPIRED', 'network_error'], ['ETIMEDOUT', 'timeout'],
    ['UND_ERR_CONNECT_TIMEOUT', 'timeout'], ['UND_ERR_HEADERS_TIMEOUT', 'timeout'], ['UND_ERR_BODY_TIMEOUT', 'timeout'],
  ]) {
    const s = setup(async () => { throw new TypeError('private', { cause: { code } }); });
    await assert.rejects(s.fetch(URL));
    assert.equal(s.events[0].causeCode, code);
    assert.equal(s.events[0].failureType, type);
    assert.equal((await s.fetch(URL)).headers.get('retry-after'), '30');
  }
});

test('unknown, nested, and non-error exceptions cannot place private values in diagnostics', async () => {
  const secret = 'PRIVATE-CANARY-user-token-query';
  const hostile = { name: secret, code: secret, message: secret, stack: secret,
    cause: { code: secret, message: secret, cause: { code: 'ECONNRESET', token: secret } },
    toJSON: () => secret, toString: () => secret };
  for (const error of [hostile, secret, null, undefined, 42]) {
    const s = setup(async () => { throw error; });
    await assert.rejects(s.fetch(`${URL}?$filter=${secret}`), value => value === error);
    assert.equal(s.events[0].errorClass, 'unknown');
    assert.equal(s.events[0].causeCode, 'unknown');
    assert.doesNotMatch(JSON.stringify(s.events), /PRIVATE-CANARY|user-token-query/);
    assert.equal((await s.fetch(URL)).headers.get('retry-after'), '30');
  }
});

test('throwing error getters cannot hide the original failure or bypass protection', async () => {
  for (const property of ['name', 'cause', 'code']) {
    const error = property === 'code' ? { name: 'TypeError', cause: {} } : {};
    Object.defineProperty(property === 'code' ? error.cause : error, property, {
      get() { throw new Error('PRIVATE-CANARY-getter'); },
    });
    const s = setup(async () => { throw error; });
    await assert.rejects(s.fetch(URL), value => value === error);
    assert.equal(s.events.length, 1);
    assert.doesNotMatch(JSON.stringify(s.events), /PRIVATE-CANARY/);
    assert.equal((await s.fetch(URL)).headers.get('retry-after'), '30');
  }
  const error = new Proxy({}, { get() { throw new Error('PRIVATE-CANARY-proxy'); } });
  const s = setup(async () => { throw error; });
  let caught;
  try { await s.fetch(URL); } catch (value) { caught = value; }
  assert.equal(caught === error, true);
  assert.equal(s.events[0].errorClass, 'unknown');
  assert.equal(s.events[0].causeCode, 'unknown');
  assert.equal((await s.fetch(URL)).headers.get('retry-after'), '30');
});

test('request kinds contain no URL path, entity key, or query values', async () => {
  const base = 'https://replication.sparkapi.com/Version/3/Reso/OData';
  const secret = 'PRIVATE-CANARY-listing-key';
  for (const [resource, expected] of [
    ['Property', 'property_collection'], [`Property('${secret}')`, 'property_entity'],
    ['Media', 'media_collection'], ['System', 'system'], ['$metadata', 'metadata'],
    [secret, 'other'], [`${secret}/Unexpected`, 'other'],
  ]) {
    const s = setup(async () => { throw new Error('private'); });
    await assert.rejects(s.fetch(new Request(`${base}/${resource}?$filter=${secret}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })));
    assert.equal(s.events[0].requestKind, expected);
    assert.doesNotMatch(JSON.stringify(s.events), /PRIVATE-CANARY|https:|Bearer|OData/);
  }
});

test('deadline aborts are distinguished from caller cancellation without changing backoff', async () => {
  const controller = new AbortController();
  const error = new DOMException('private abort message', 'AbortError');
  const s = setup(async () => {
    s.advance(6000);
    controller.abort(new DOMException('private timeout message', 'TimeoutError'));
    throw error;
  });
  await assert.rejects(s.fetch(URL, { signal: controller.signal }), value => value === error);
  assert.equal(s.events[0].failureType, 'timeout');
  assert.equal(s.events[0].errorClass, 'AbortError');
  assert.equal(s.events[0].durationMs, 6000);
  assert.equal((await s.fetch(URL)).headers.get('retry-after'), '30');

  const unexpected = setup(async () => { throw error; });
  await assert.rejects(unexpected.fetch(URL));
  assert.equal(unexpected.events[0].failureType, 'network_error', 'AbortError alone does not prove caller cancellation');
});

test('caller cancellation remains silent and leaves admission open', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const controller = new AbortController();
  let calls = 0;
  const fetch = createResoUpstreamPolicy(async () => {
    if (++calls > 1) return ok();
    controller.abort();
    throw controller.signal.reason;
  });
  await assert.rejects(fetch(URL, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(warn.mock.calls.length, 0);
  assert.equal((await fetch(URL)).status, 200);
  assert.equal(calls, 2);
});

test('default logger never receives raw errors, URLs, headers, or response bodies', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const secret = 'PRIVATE-CANARY-do-not-log';
  const error = new TypeError(secret, { cause: { code: 'ECONNRESET', message: secret, url: secret } });
  const fetch = createResoUpstreamPolicy(async () => { throw error; });
  await assert.rejects(fetch(`${URL}('${secret}')?$filter=${secret}`, {
    headers: { Authorization: `Bearer ${secret}`, 'X-Private': secret },
  }));
  const http = createResoUpstreamPolicy(async () => new Response(secret, {
    status: 503, headers: { 'X-Private': secret },
  }));
  const response = await http(`${URL}?$filter=${secret}`);
  assert.equal(await response.text(), secret, 'Diagnostics must not consume or alter the response body');
  assert.equal(warn.mock.calls.length, 2);
  for (const call of warn.mock.calls) {
    assert.equal(call.arguments.length, 2);
    assert.equal(call.arguments[0], '[BeachesMLS RESO] Actual upstream request failed.');
    assert.doesNotMatch(JSON.stringify(call.arguments), /PRIVATE-CANARY|https:|Bearer|Authorization|X-Private|stack|message/);
    assert.ok(Object.values(call.arguments[1]).every(value => typeof value === 'string' || typeof value === 'number'));
  }
  assert.equal(warn.mock.calls[1].arguments[1].failureType, 'http_error');
  assert.equal(warn.mock.calls[1].arguments[1].errorClass, undefined);
  assert.equal(warn.mock.calls[1].arguments[1].causeCode, undefined);
});
