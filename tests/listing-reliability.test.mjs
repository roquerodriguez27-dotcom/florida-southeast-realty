import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadListings(fetchListing, env = { NODE_ENV: 'production', VERCEL_ENV: 'production' }) {
  const source = fs.readFileSync(new URL('../lib/listings.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(compiled, {
    module: loaded, exports: loaded.exports, process: { env }, console,
    require(name) {
      if (name === './idx') return { fetchLiveListingBySlug: fetchListing, fetchLiveListingPage: async () => { throw new Error('simulated outage'); } };
      if (name === './south-florida-locations') return { southFloridaCityCounty: () => undefined };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return loaded.exports;
}

test('temporary MLS errors are not converted into a missing listing', async () => {
  const error = new Error('simulated temporary MLS failure');
  const { getListingBySlug } = loadListings(async () => { throw error; });
  await assert.rejects(getListingBySlug('valid-listing-key'), e => e === error);
});

test('an actual missing listing remains missing in production', async () => {
  const { getListingBySlug } = loadListings(async () => null);
  assert.equal(await getListingBySlug('missing-listing-key'), undefined);
});

test('production does not substitute demonstration homes for missing MLS results', async () => {
  const { getListingBySlug, LISTINGS } = loadListings(async () => null);
  assert.equal(await getListingBySlug(LISTINGS[0].slug), undefined);
});

test('explicit preview demo behavior is preserved', async () => {
  const { getListingBySlug, LISTINGS } = loadListings(async () => null, { NODE_ENV: 'production', VERCEL_ENV: 'preview' });
  assert.equal((await getListingBySlug(LISTINGS[0].slug)).mlsId, LISTINGS[0].mlsId);
});

test('a failed request can recover on the next attempt', async () => {
  let calls = 0;
  const listing = { mlsId: 'SYNTHETIC-ONLY' };
  const { getListingBySlug } = loadListings(async () => { if (++calls === 1) throw new Error('outage'); return listing; });
  await assert.rejects(getListingBySlug('test'));
  assert.equal(await getListingBySlug('test'), listing);
});

test('calculator lookups can omit complete galleries while detail defaults retain them', async () => {
  const calls = [];
  const { getListingBySlug } = loadListings(async (...args) => { calls.push(args); return { mlsId: 'SYNTHETIC-ONLY' }; });
  await getListingBySlug('test', false);
  await getListingBySlug('test');
  assert.deepEqual(calls, [['test', false], ['test', true]]);
});

test('search outages remain unavailable, not a successful empty search', async () => {
  const { searchListingPage } = loadListings(async () => null);
  const result = await searchListingPage({ locations: ['33467'] });
  assert.equal(result.unavailable, true);
  assert.equal(result.live, true);
});

test('buyer page explicitly skips complete media and explains unavailable property figures', () => {
  const source = fs.readFileSync(new URL('../app/buyer-tools/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /getListingBySlug\(params\.listing, false\)/);
  assert.match(source, /listingUnavailable/);
  assert.match(source, /not figures for the selected home/);
});

test('detail and suggestion links do not speculatively fetch MLS pages', () => {
  for (const file of ['../app/properties/[slug]/page.tsx', '../components/AskRoqueActions.tsx', '../app/buyer-tools/page.tsx']) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    const count = (source.match(/<Link\b/g) || []).length;
    assert.ok(count > 0);
    assert.equal((source.match(/<Link\s+prefetch=\{false\}/g) || []).length, count, file);
  }
});

test('property retry refreshes server data rather than replaying the failed render', () => {
  const source = fs.readFileSync(new URL('../app/properties/[slug]/error.tsx', import.meta.url), 'utf8');
  assert.match(source, /unstable_retry/);
  assert.match(source, /does not mean the home was removed/);
});
