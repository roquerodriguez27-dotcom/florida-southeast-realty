import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
global.AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage;
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external');
const { unstable_cache } = require('next/dist/server/web/spec-extension/unstable-cache');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup({ state = 'stale', read = Promise.resolve(), write = Promise.resolve(), value = Promise.resolve('fresh'), staticGeneration = false, noWait = false, draft = false } = {}) {
    const waits = [], calls = { read: 0, refresh: 0, write: 0 };
    const store = { route: '/fixture', isStaticGeneration: staticGeneration, isDraftMode: draft, incrementalCache: { generateCacheKey: async (k) => k, get: async () => { calls.read++; await read; return state === 'miss' ? null : { isStale: state === 'stale', value: { kind: 'FETCH', data: { body: JSON.stringify('stale') } } }; }, set: async () => { calls.write++; await write; } }, afterContext: { waitUntil: noWait ? undefined : () => { }, after: p => { assert.equal(noWait, false); waits.push(p); } } };
    const fn = unstable_cache(async () => { calls.refresh++; return value; }, ['fixture'], { revalidate: 1 });
    return { store, waits, calls, run: () => workAsyncStorage.run(store, () => fn()) };
}
const tick = () => new Promise(r => setImmediate(r));
async function pending(p) { let done = false; p.then(() => done = true, () => done = true); await tick(); assert.equal(done, false); }
test('slow stale lookup is retained immediately, then one refresh through delayed write', async () => { const r = deferred(), v = deferred(), w = deferred(); const x = setup({ read: r.promise, value: v.promise, write: w.promise }); const result = x.run(); assert.equal(x.waits.length, 1); r.resolve(); assert.equal(await result, 'stale'); assert.equal(x.calls.refresh, 1); assert.equal(x.waits.length, 2); v.resolve('fresh'); await tick(); assert.equal(x.calls.write, 1); await pending(Promise.all(x.waits)); w.resolve(); await Promise.all(x.waits); });
test('fresh hit retains read without refresh or write', async () => { const x = setup({ state: 'fresh' }); assert.equal(await x.run(), 'stale'); await Promise.all(x.waits); assert.deepEqual(x.calls, { read: 1, refresh: 0, write: 0 }); });
test('cold miss returns new data before write, but retains whole write', async () => { const w = deferred(); const x = setup({ state: 'miss', write: w.promise }); assert.equal(await x.run(), 'fresh'); assert.equal(x.waits.length, 2); await pending(Promise.all(x.waits)); w.resolve(); await Promise.all(x.waits); assert.deepEqual(x.calls, { read: 1, refresh: 1, write: 1 }); });
test('same key repeated calls preserve refresh deduplication', async () => { const v = deferred(); const x = setup({ value: v.promise }); assert.deepEqual(await Promise.all([x.run(), x.run()]), ['stale', 'stale']); assert.equal(x.calls.refresh, 1); assert.equal(Object.keys(x.store.pendingRevalidates).length, 1); v.resolve('fresh'); await Promise.all(x.waits); assert.equal(x.calls.write, 1); });
test('stale refresh failure preserves stale response and original error handling', async () => { const v = deferred(); const x = setup({ value: v.promise }); const original = console.error, logs = []; console.error = (...a) => logs.push(a); try {
    assert.equal(await x.run(), 'stale');
    v.reject(new Error('synthetic refresh failure'));
    await Promise.all(x.waits);
    assert.equal(logs.length, 1);
    assert.equal(x.calls.write, 0);
}
finally {
    console.error = original;
} });
test('stale write failure retains existing stale fallback', async () => { const w = deferred(); const x = setup({ write: w.promise }); const original = console.error, logs = []; console.error = (...a) => logs.push(a); try {
    assert.equal(await x.run(), 'stale');
    w.reject(new Error('synthetic write failure'));
    await Promise.all(x.waits);
    assert.equal(logs.length, 1);
}
finally {
    console.error = original;
} });
test('cold write rejection remains on original pending map and adds no log', async () => { const w = deferred(); const x = setup({ state: 'miss', write: w.promise }); assert.equal(await x.run(), 'fresh'); const error = new Error('synthetic write failure'); const original = Object.values(x.store.pendingRevalidates)[0]; w.reject(error); await assert.rejects(original, e => e === error); await Promise.all(x.waits); });
test('unavailable waitUntil retains old behavior without new error', async () => { const x = setup({ noWait: true }); assert.equal(await x.run(), 'stale'); await Promise.all(Object.values(x.store.pendingRevalidates)); assert.equal(x.waits.length, 0); assert.equal(x.calls.refresh, 1); });
test('static generation awaits refresh and write with no additional retention', async () => { const w = deferred(); const x = setup({ staticGeneration: true, write: w.promise }); const result = x.run(); await pending(result); w.resolve(); assert.equal(await result, 'fresh'); assert.equal(x.waits.length, 0); });
test('draft mode bypasses cache read/write as before', async () => { const x = setup({ draft: true }); assert.equal(await x.run(), 'fresh'); await Promise.all(x.waits); assert.deepEqual(x.calls, { read: 0, refresh: 1, write: 0 }); });
test('cold cancellation preserves exact rejection reason', async () => { const v = deferred(); const x = setup({ state: 'miss', value: v.promise }); const result = x.run(); const error = new DOMException('synthetic caller cancellation', 'AbortError'); v.reject(error); await assert.rejects(result, e => e === error); await Promise.all(x.waits); assert.equal(x.calls.write, 0); });
