import test from 'node:test';
import assert from 'node:assert/strict';
import { createResoSharedCoordinator } from '../lib/reso-shared-coordinator.ts';

const PROVIDER = 'https://replication.sparkapi.com/Version/3/Reso/OData/Property';
const CASES = [
  { reason: 'capacity', status: 503, code: 'RESO_CAPACITY_PROTECTED', fallback: 'capacity_protected', delay: 1_001 },
  { reason: 'duplicate', status: 503, code: 'RESO_DUPLICATE_PENDING', fallback: 'capacity_protected', delay: 29_000 },
  { reason: 'unavailable', status: 503, code: 'RESO_UPSTREAM_UNAVAILABLE', fallback: 'upstream_error', delay: 15_000 },
  { reason: 'throttled', status: 429, code: 'RESO_THROTTLED', fallback: 'throttled', delay: 900_000 },
  { reason: 'budget', status: 429, code: 'RESO_THROTTLED', fallback: 'throttled', delay: 300_000 },
];

// Synthetic store and upstream only: no network, credentials or database writes.
// An unavailable-provider hold is still locally enforced. It must not be
// mistaken for exhausted concurrency merely because both return HTTP 503.
for (const inputType of ['url', 'request']) {
  for (const expected of CASES) {
    test(`${inputType}: ${expected.reason} retains its cause without dispatching or extending a hold`, async () => {
      let acquisitions = 0;
      const events = [];
      const fetch = createResoSharedCoordinator(
        async () => assert.fail('a local hold must never reach the provider'),
        {
          store: {
            acquire: async () => {
              acquisitions++;
              return {
                decision: expected.reason === 'duplicate' ? 'waiting' : 'paused',
                reason: expected.reason,
                retry_after_ms: expected.delay,
              };
            },
            finish: async () => assert.fail('a rejected request does not own a lease'),
          },
          waitBudgetMs: 0,
          onEvent: event => events.push(event),
        },
      );
      const response = await fetch(inputType === 'request' ? new Request(PROVIDER) : PROVIDER);
      assert.equal(response.status, expected.status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('retry-after'), String(Math.ceil(expected.delay / 1_000)));
      assert.equal(response.headers.get('x-fsr-reso-admission'), 'local');
      assert.equal(response.headers.get('x-fsr-reso-fallback'), expected.fallback);
      assert.equal(response.headers.get('x-fsr-reso-coordination'), expected.reason);
      assert.equal((await response.json()).error.code, expected.code);
      assert.equal(acquisitions, 1);
      assert.deepEqual(events, expected.reason === 'duplicate' ? [{ kind: 'duplicate_wait_expired' }] : []);
    });
  }
}

test('a coordinator transport failure remains distinct and refunds only its own uncertain reservation', async () => {
  const completions = [];
  const events = [];
  const fetch = createResoSharedCoordinator(
    async () => assert.fail('failed coordination must not bypass admission'),
    {
      store: {
        acquire: async () => { throw new Error('synthetic coordination failure'); },
        finish: async completion => { completions.push(completion); return true; },
      },
      onEvent: event => events.push(event),
    },
  );
  const response = await fetch(PROVIDER);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'RESO_COORDINATION_UNAVAILABLE');
  assert.equal(response.headers.get('x-fsr-reso-admission'), 'local');
  assert.equal(response.headers.get('x-fsr-reso-coordination'), 'coordination');
  assert.equal(response.headers.get('retry-after'), '1');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].outcome, 'not_sent');
  assert.equal(completions[0].retryAfterMs, 0);
  assert.deepEqual(events, [{ kind: 'coordination_unavailable' }]);
});
