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
