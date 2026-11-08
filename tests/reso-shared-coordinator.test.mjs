import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { createResoSharedCoordinator, createResoCoordinatorStore } from '../lib/reso-shared-coordinator.ts';

const PROVIDER = 'https://replication.sparkapi.com/Version/3/Reso/OData/Property';
const ok = body => new Response(body ?? '{"value":[]}', { headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const snapshot = body => ({ body: Buffer.from(body).toString('base64'), status: 200, headers: [['content-type', 'application/json']] });

// This small driver implements only the public owner/cache contract, not SQL's
// quota, expiry or recovery algorithms. Those are tested against PostgreSQL.
function sharedStore() {
  const entries = new Map();
  const completions = [];
  const acquisitions = [];
  const key = x => `${x.scopeHash}:${x.queryHash}`;
  return {
    acquisitions, completions, entries,
    async acquire(identity) {
      acquisitions.push(identity);
      const prior = entries.get(key(identity));
      if (prior?.snapshot) return { decision: 'cached', snapshot: prior.snapshot };
      if (prior) return { decision: 'waiting', reason: 'duplicate', retry_after_ms: prior.held ? 30_000 : 330_000 };
      entries.set(key(identity), { owner: identity.owner });
      return { decision: 'granted' };
    },
    async finish(completion) {
      completions.push(completion);
      const prior = entries.get(key(completion));
      if (prior?.owner !== completion.owner) return false;
      if (completion.outcome === 'cancelled' || completion.outcome === 'interrupted') {
        entries.set(key(completion), { held: true });
      } else if (completion.response) {
        entries.set(key(completion), { snapshot: completion.response });
      } else {
        entries.delete(key(completion));
      }
      return true;
    },
  };
}

function worker(upstream, store, overrides = {}) {
  const events = [];
  return { fetch: createResoSharedCoordinator(upstream, { store, onEvent: e => events.push(e), ...overrides }), events };
}

test('independent workers share one request, including ownership of its streamed body', async () => {
  const store = sharedStore();
  let calls = 0, body;
  const upstream = async () => {
    calls++;
    return new Response(new ReadableStream({ start(controller) { body = controller; controller.enqueue(new TextEncoder().encode('{"value":')); } }), {
      headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': '999', 'set-cookie': 'provider-session=private' },
    });
  };
  const first = worker(upstream, store);
  const second = worker(upstream, store, { wait: async () => { await tick(); } });
  const a = first.fetch(PROVIDER, { headers: { Authorization: 'Bearer token-A' } });
  await tick();
  const b = second.fetch(PROVIDER, { headers: { Authorization: 'Bearer token-A' } });
  await tick();
  assert.equal(calls, 1);
  assert.equal(store.completions.length, 0, 'headers alone must not release ownership');
  body.enqueue(new TextEncoder().encode('[]}')); body.close();
  const [responseA, responseB] = await Promise.all([a, b]);
  assert.deepEqual(await responseA.json(), { value: [] });
  assert.deepEqual(await responseB.json(), { value: [] });
  assert.equal(calls, 1);
  assert.equal(responseA.headers.get('content-length'), null);
  assert.equal(responseA.headers.get('content-encoding'), null);
  assert.equal(responseB.headers.get('set-cookie'), null);
  assert.equal(responseB.headers.get('x-fsr-reso-shared'), 'hit');
  assert.equal(store.completions.length, 1);
});

test('credentials, representation headers and scope isolate shared results', async () => {
  const store = sharedStore(); let calls = 0;
  const upstream = async () => ok(JSON.stringify({ call: ++calls }));
  const a = worker(upstream, store), b = worker(upstream, store), otherFeed = worker(upstream, store, { scope: 'another-feed' });
  assert.deepEqual(await (await a.fetch(PROVIDER, { headers: { Authorization: 'Bearer A', Accept: 'application/json' } })).json(), { call: 1 });
  assert.deepEqual(await (await b.fetch(PROVIDER, { headers: { authorization: 'Bearer A', accept: 'application/json' } })).json(), { call: 1 });
  assert.deepEqual(await (await b.fetch(PROVIDER, { headers: { Authorization: 'Bearer B', Accept: 'application/json' } })).json(), { call: 2 });
  assert.deepEqual(await (await b.fetch(PROVIDER, { headers: { Authorization: 'Bearer A', Accept: 'application/xml' } })).json(), { call: 3 });
  assert.deepEqual(await (await otherFeed.fetch(PROVIDER, { headers: { Authorization: 'Bearer A', Accept: 'application/json' } })).json(), { call: 4 });
  for (const entry of store.acquisitions) {
    assert.match(entry.scopeHash, /^[a-f0-9]{64}$/);
    assert.match(entry.queryHash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(entry).includes('Bearer'), false);
    assert.equal(JSON.stringify(entry).includes('sparkapi'), false);
  }
});

test('canonical hashes join equivalent parameter order without changing the outgoing request', async () => {
  const store = sharedStore(); const outgoing = [];
  const upstream = async (input, init) => { outgoing.push({ input, init }); return ok(); };
  const a = worker(upstream, store), b = worker(upstream, store);
  const firstUrl = `${PROVIDER}?%24top=25&%24filter=City%20eq%20%27Wellington%27`;
  const secondUrl = `${PROVIDER}?%24filter=City%20eq%20%27Wellington%27&%24top=25`;
  const init = { headers: { Authorization: 'Bearer unchanged' } };
  await a.fetch(firstUrl, init); await b.fetch(secondUrl, init);
  assert.equal(outgoing.length, 1);
  assert.equal(outgoing[0].input, firstUrl);
  assert.equal(outgoing[0].init, init);
});

test('shared capacity or cooldown denials never reach the provider, including Request inputs', async () => {
  let calls = 0, finishes = 0;
  const store = { acquire: async () => ({ decision: 'paused', reason: 'throttled', retry_after_ms: 300_000 }), finish: async () => { finishes++; return true; } };
  const a = worker(async () => { calls++; return ok(); }, store);
  const result = await a.fetch(new Request(PROVIDER));
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('retry-after'), '300');
  assert.equal(result.headers.get('x-fsr-reso-admission'), 'local');
  assert.equal(calls, 0); assert.equal(finishes, 0, 'local denials cannot extend provider penalties');
});

test('a waiting duplicate returns a temporary failure when its bounded wait ends', async () => {
  const store = { acquire: async () => ({ decision: 'waiting', reason: 'duplicate', retry_after_ms: 29_000 }), finish: async () => assert.fail('no owner was granted') };
  const a = worker(async () => assert.fail('duplicate reached provider'), store, { waitBudgetMs: 0 });
  const result = await a.fetch(PROVIDER);
  assert.equal(result.status, 503);
  assert.equal(result.headers.get('retry-after'), '29');
  assert.equal((await result.json()).error.code, 'RESO_DUPLICATE_PENDING');
  assert.deepEqual(a.events, [{ kind: 'duplicate_wait_expired' }]);
});

test('non-provider and non-GET traffic bypass coordination', async () => {
  let calls = 0;
  const store = { acquire: async () => assert.fail('unrelated traffic used coordinator'), finish: async () => assert.fail() };
  const a = worker(async () => { calls++; return ok(); }, store);
  await a.fetch('https://example.com/');
  await a.fetch('https://replication.sparkapi.com.evil.example/Version/3/Reso/OData/Property');
  await a.fetch(PROVIDER, { method: 'POST' });
  assert.equal(calls, 3);
});

test('already cancelled callers do not acquire and pre-dispatch timeouts remain local', async () => {
  let calls = 0;
  const store = { acquire: async () => assert.fail('already expired caller acquired'), finish: async () => assert.fail() };
  const a = worker(async () => { calls++; return ok(); }, store);
  const cancel = new AbortController(); cancel.abort();
  await assert.rejects(a.fetch(PROVIDER, { signal: cancel.signal }), { name: 'AbortError' });
  const timeout = new AbortController(); timeout.abort(new DOMException('deadline', 'TimeoutError'));
  const response = await a.fetch(PROVIDER, { signal: timeout.signal });
  assert.equal(response.headers.get('x-fsr-reso-admission'), 'local');
  assert.equal(calls, 0);
});

test('timeout during acquire releases an uncertain claim without a provider penalty', async () => {
  const started = deferred(), controller = new AbortController(); const completions = [];
  const store = {
    acquire: async (_identity, signal) => { started.resolve(); return new Promise((_r, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); },
    finish: async completion => { completions.push(completion); return true; },
  };
  const a = worker(async () => assert.fail('timeout before dispatch reached provider'), store);
  const promise = a.fetch(PROVIDER, { signal: controller.signal });
  await started.promise; controller.abort(new DOMException('deadline', 'TimeoutError'));
  const response = await promise;
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-fsr-reso-admission'), 'local');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].outcome, 'not_sent');
  assert.deepEqual(a.events, [{ kind: 'coordination_unavailable' }]);
});

test('caller cancellation while waiting does not cancel the owning worker request', async () => {
  const store = sharedStore(), ownerResponse = deferred(), caller = new AbortController(); let calls = 0;
  const upstream = async () => { calls++; return ownerResponse.promise; };
  const owner = worker(upstream, store), waiter = worker(upstream, store);
  const owning = owner.fetch(PROVIDER);
  await tick();
  const waiting = waiter.fetch(PROVIDER, { signal: caller.signal });
  await tick(); caller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(calls, 1);
  ownerResponse.resolve(ok());
  assert.equal((await owning).status, 200);
  assert.equal(store.completions.filter(x => x.outcome === 'success').length, 1);
});

test('cancelling after dispatch holds the identical query while other queries remain usable', async () => {
  const store = sharedStore(), controller = new AbortController(), started = deferred(); let calls = 0;
  const a = worker(async (_input, init) => {
    calls++; started.resolve();
    return new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  }, store);
  const b = worker(async () => { calls++; return ok(); }, store, { waitBudgetMs: 0 });
  const request = a.fetch(PROVIDER, { signal: controller.signal });
  await started.promise; controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(store.completions[0].outcome, 'cancelled');
  assert.equal((await b.fetch(PROVIDER)).status, 503);
  assert.equal((await b.fetch(`${PROVIDER}?different=1`)).status, 200);
  assert.equal(calls, 2);
});

test('actual network timeout is interrupted, not a local denial or caller cancellation', async () => {
  const store = sharedStore();
  const a = worker(async () => { throw new DOMException('server request timeout', 'TimeoutError'); }, store);
  await assert.rejects(a.fetch(PROVIDER), { name: 'TimeoutError' });
  assert.equal(store.completions[0].outcome, 'interrupted');
  assert.equal(store.completions[0].response, null);
});

test('a broken success body holds the query and never publishes partial data', async () => {
  const store = sharedStore();
  const broken = new Error('body stream failed');
  const a = worker(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"value":')); controller.error(broken); } })), store);
  await assert.rejects(a.fetch(PROVIDER), error => error === broken);
  assert.equal(store.completions[0].outcome, 'interrupted');
  assert.equal(store.completions[0].response, null);
});

test('known 429 survives a broken body and preserves a longer provider Retry-After', async () => {
  const store = sharedStore();
  const a = worker(async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('body reset')); } }), {
    status: 429, headers: { 'retry-after': '900' },
  }), store);
  await assert.rejects(a.fetch(PROVIDER));
  assert.equal(store.completions[0].outcome, 'throttled');
  assert.equal(store.completions[0].retryAfterMs, 900_000);
  assert.equal(store.completions[0].response, null);
});

test('Retry-After HTTP dates and ordinary 4xx fallback semantics are preserved', async () => {
  const store = sharedStore();
  const a = worker(async () => new Response('temporarily offline', { status: 503, headers: { 'retry-after': new Date(1_900_000).toUTCString() } }), store, { now: () => 1_000_000 });
  assert.equal((await a.fetch(PROVIDER)).status, 503);
  assert.equal(store.completions[0].retryAfterMs, 900_000);
  assert.equal(store.completions[0].outcome, 'http_error');
  const b = worker(async () => new Response('not found', { status: 404 }), store);
  assert.equal(await (await b.fetch(PROVIDER)).text(), 'not found');
  assert.equal(store.completions.at(-1).outcome, 'success');
  assert.equal(store.completions.at(-1).response, null);
});

test('worker-local admission responses are released as not_sent and never renew shared cooldowns', async () => {
  const store = sharedStore();
  const a = worker(async () => new Response('local throttle', { status: 429, headers: { 'x-fsr-reso-admission': 'local', 'retry-after': '300' } }), store);
  assert.equal((await a.fetch(PROVIDER)).status, 429);
  assert.equal(store.completions.length, 1);
  assert.equal(store.completions[0].outcome, 'not_sent');
  assert.equal(store.completions[0].retryAfterMs, 0);
});

test('completion transport loss retries the owner-fenced write without repeating the provider call', async () => {
  const store = sharedStore(); const original = store.finish; let finishes = 0, calls = 0;
  store.finish = async completion => { const accepted = await original(completion); if (++finishes === 1) throw new Error('ack lost'); return accepted; };
  const a = worker(async () => { calls++; return ok(); }, store);
  assert.equal((await a.fetch(PROVIDER)).status, 200);
  assert.equal(finishes, 2);
  assert.equal(calls, 1);
  assert.equal((await a.fetch(PROVIDER)).status, 200);
  assert.equal(calls, 1, 'a lost completion acknowledgment must still permit its cached result');
});

test('failed completion keeps the durable lease and returns the completed original response', async () => {
  const store = sharedStore(); let finishCalls = 0, calls = 0;
  store.finish = async () => { finishCalls++; throw new Error('database unavailable'); };
  const a = worker(async () => { calls++; return ok(); }, store, { waitBudgetMs: 0 });
  assert.equal((await a.fetch(PROVIDER)).status, 200);
  assert.equal((await a.fetch(PROVIDER)).status, 503);
  assert.equal(calls, 1);
  assert.equal(finishCalls, 2);
  assert.deepEqual(a.events[0], { kind: 'coordination_finish_unavailable' });
});

test('unavailable coordination fails closed without leaking errors or making an uncoordinated provider call', async () => {
  const secretError = new Error('canary-secret-and-private-search');
  const store = { acquire: async () => { throw secretError; }, finish: async () => true };
  const a = worker(async () => assert.fail('uncoordinated provider request'), store);
  const response = await a.fetch(`${PROVIDER}?private-search`, { headers: { Authorization: 'Bearer canary-token' } });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-fsr-reso-admission'), 'local');
  assert.equal((await response.text()).includes('canary'), false);
  assert.equal(JSON.stringify(a.events).includes('canary'), false);
});

test('overlarge and explicitly non-storable bodies remain usable without a shared snapshot', async () => {
  const store = sharedStore(); const large = 'x'.repeat(1_048_577);
  const a = worker(async () => ok(large), store);
  assert.equal((await (await a.fetch(PROVIDER)).text()).length, large.length);
  assert.equal(store.completions[0].response, null);
  const b = worker(async () => new Response('private response', { headers: { 'cache-control': 'no-store' } }), store);
  assert.equal(await (await b.fetch(PROVIDER)).text(), 'private response');
  assert.equal(store.completions.at(-1).response, null);
});

test('malformed or unsafe shared snapshots fail closed instead of reaching callers', async () => {
  for (const bad of [
    { ...snapshot('private'), headers: [['set-cookie', 'credential=secret']] },
    { ...snapshot('private'), headers: [['content-type', 'application/json\r\ninjected: bad']] },
    { ...snapshot('private'), status: 503 },
    { ...snapshot('private'), body: 'not-base64' },
  ]) {
    const store = { acquire: async () => ({ decision: 'cached', snapshot: bad }), finish: async () => true };
    const a = worker(async () => assert.fail('invalid cache triggered new upstream call'), store);
    const response = await a.fetch(PROVIDER);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.text()).includes('private'), false);
  }
});

test('REST store sends the dedicated secret only to the database and validates the RPC contract', async () => {
  const requests = [];
  const store = createResoCoordinatorStore({ url: 'https://example.supabase.co', publishableKey: 'public-key', secret: 's'.repeat(64), fetch: async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(String(input).endsWith('fsr_mls_acquire') ? { decision: 'granted' } : true), { headers: { 'content-type': 'application/json' } });
  } });
  const identity = { scopeHash: 'a'.repeat(64), queryHash: 'b'.repeat(64), owner: '11111111-1111-4111-8111-111111111111' };
  assert.deepEqual(await store.acquire(identity), { decision: 'granted' });
  assert.equal(await store.finish({ ...identity, outcome: 'success', retryAfterMs: 0, response: null }), true);
  assert.equal(requests[0].url, 'https://example.supabase.co/rest/v1/rpc/fsr_mls_acquire');
  assert.equal(requests[0].init.headers['x-fsr-mls-coordinator'], 's'.repeat(64));
  assert.equal(requests[0].init.headers.apikey, 'public-key');
  assert.equal(requests[0].init.cache, 'no-store');
  assert.equal(requests[0].init.redirect, 'error');
  assert.deepEqual(JSON.parse(requests[0].init.body), { p_scope_hash: identity.scopeHash, p_query_hash: identity.queryHash, p_owner: identity.owner });
  assert.equal(JSON.parse(requests[1].init.body).p_outcome, 'success');
  assert.equal(requests[1].init.signal.aborted, false);
});

test('REST completion is independent of an aborted acquire caller and RPC timeouts clean up', async () => {
  const caller = new AbortController(); let count = 0;
  const store = createResoCoordinatorStore({ url: 'https://example.supabase.co', publishableKey: 'public-key', secret: 's'.repeat(64), timeoutMs: 15, fetch: async (_input, init) => {
    count++;
    if (count > 1) { assert.equal(init.signal.aborted, false); return new Response('true'); }
    return new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  } });
  const identity = { scopeHash: 'a'.repeat(64), queryHash: 'b'.repeat(64), owner: '11111111-1111-4111-8111-111111111111' };
  const acquiring = store.acquire(identity, caller.signal);
  caller.abort(); await assert.rejects(acquiring);
  assert.equal(await store.finish({ ...identity, outcome: 'not_sent', retryAfterMs: 0, response: null }), true);
  const hanging = createResoCoordinatorStore({ url: 'https://example.supabase.co', publishableKey: 'public-key', secret: 's'.repeat(64), timeoutMs: 10, fetch: async (_input, init) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })) });
  await assert.rejects(hanging.acquire(identity));
});
