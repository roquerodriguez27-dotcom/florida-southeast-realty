import assert from 'node:assert/strict';
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const directory = path.dirname(fileURLToPath(import.meta.url));
const context = new AsyncLocalStorage();
globalThis[Symbol.for('@next/request-context')] = { get: () => context.getStore() };
globalThis.__fsrLifecycleEmit = event => context.getStore()?.entry.events.push({ event, time: performance.now() });
const { default: next } = await import('next');
const app = next({ dev: false, dir: directory });

async function main() {
  await app.prepare();
  const handle = app.getRequestHandler();
  let latest;
  const server = http.createServer((request, response) => {
    const entry = { waits: [], events: [] };
    latest = entry;
    context.run({
      entry,
      waitUntil(promise) {
        entry.events.push({ event: 'wait_registered', time: performance.now() });
        entry.waits.push(promise);
        Promise.resolve(promise).then(() => entry.events.push({ event: 'wait_settled', time: performance.now() }));
      },
    }, () => {
      response.on('close', () => entry.events.push({ event: 'response_closed', time: performance.now() }));
      handle(request, response);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const cases = [
      { name: 'html-fast-stale', readDelay: 0 },
      { name: 'html-slow-stale', readDelay: 150, streaming: true },
      { name: 'rsc-fast-stale', readDelay: 0, rsc: true },
      { name: 'rsc-slow-stale', readDelay: 150, rsc: true },
      { name: 'rsc-cold-write', readDelay: 150, rsc: true, state: 'miss' },
      { name: 'rsc-fresh-hit', readDelay: 150, rsc: true, state: 'fresh' },
      { name: 'rsc-deduplicated', readDelay: 150, rsc: true, mode: 'duplicate' },
      { name: 'prefetch-control', readDelay: 150, rsc: true, prefetch: true },
      { name: 'disconnect-during-lookup', readDelay: 150, disconnect: true },
    ];
    for (const item of cases) {
      globalThis.__fsrLifecycleConfig = { refreshDelay: 350, writeDelay: 100, ...item };
      const url = `http://127.0.0.1:${server.address().port}/${item.mode ?? 'baseline'}`;
      const headers = { 'user-agent': 'Mozilla/5.0', ...(item.rsc ? { RSC: '1' } : {}), ...(item.prefetch ? { 'Next-Router-Prefetch': '1' } : {}) };
      const started = performance.now();
      let firstChunk;
      let body = '';
      if (item.disconnect) {
        await new Promise((resolve, reject) => {
          const request = http.get(url, { headers }, response => response.once('data', () => {
            firstChunk = performance.now();
            response.destroy();
            resolve();
          }));
          request.on('error', reject);
        });
      } else {
        const response = await fetch(url, { headers });
        assert.equal(response.status, 200);
        if (item.rsc) assert.match(response.headers.get('content-type'), /text\/x-component/);
        for await (const chunk of response.body) {
          firstChunk ??= performance.now();
          body += Buffer.from(chunk).toString();
        }
      }
      const responseEnd = performance.now();
      const entry = latest;
      const waitsAtResponseEnd = entry.waits.length;
      if (!item.prefetch) assert.ok(waitsAtResponseEnd > 0, `${item.name}: lifetime must already be registered`);
      // Drain current work and any refresh/write registered while lookup drains.
      for (let offset = 0; offset < entry.waits.length;) {
        const batch = entry.waits.slice(offset);
        offset += batch.length;
        await Promise.allSettled(batch);
      }
      const find = name => entry.events.find(event => event.event === name)?.time;
      const count = name => entry.events.filter(event => event.event === name).length;
      if (item.prefetch) {
        // Next can evaluate shared metadata while prefetching. Preserve that
        // work at most once, without forcing a refresh when it is skipped.
        assert.ok(count('refresh_start') <= 1);
        if (count('refresh_start')) {
          assert.ok(waitsAtResponseEnd > 0);
          assert.equal(count('cache_write_end'), 1);
          assert.ok(entry.events.filter(event => event.event === 'wait_settled').at(-1).time >= find('cache_write_end'));
        }
      } else if (item.state === 'fresh') {
        assert.match(body, /stale-value/);
        assert.equal(count('refresh_start'), 0);
        assert.equal(count('cache_write_end'), 0);
      } else {
        assert.equal(count('refresh_start'), 1, `${item.name}: no duplicate provider work`);
        assert.equal(count('cache_write_end'), 1, `${item.name}: cache write must finish`);
        assert.ok(entry.events.filter(event => event.event === 'wait_settled').at(-1).time >= find('cache_write_end'));
        if (!item.disconnect) assert.match(body, item.state === 'miss' ? /fresh-value/ : /stale-value/);
        if (item.state !== 'miss') assert.ok(responseEnd < find('refresh_end'), `${item.name}: stale response must not block on refresh`);
        if (item.streaming || item.disconnect) assert.ok(firstChunk < find('cache_read_done'), `${item.name}: preserve streaming shell`);
      }
      console.log(JSON.stringify({ name: item.name, waitsAtResponseEnd, responseMs: Math.round(responseEnd - started), events: entry.events.map(event => ({ event: event.event, ms: Math.round(event.time - started) })) }));
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await app.close();
  }
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
