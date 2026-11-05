import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as listingTypes from '../lib/types.ts';

function compile(file, jsx = false) {
  return ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
  }).outputText;
}

const idxCode = compile('../lib/idx.ts');
const pageCode = compile('../app/properties/page.tsx', true);
const records = count => Array.from({ length: count }, (_, i) => ({
  ListingKey: `SYNTHETIC-${String(i + 1).padStart(4, '0')}`,
  ListingId: String(i + 1),
  PropertyType: 'Residential',
  PropertySubType: 'Single Family Residence',
  StandardStatus: 'Active',
  PoolPrivateYN: true,
  ListPrice: (i + 1) * 1000,
  ModificationTimestamp: '2026-11-05T00:00:00Z',
  Latitude: 26.5,
  Longitude: -80.1,
}));

function loadIdx(dataset, respond) {
  const requests = [];
  const cacheKeys = [];
  const loaded = { exports: {} };
  vm.runInNewContext(idxCode, {
    module: loaded, exports: loaded.exports,
    process: { env: { NODE_ENV: 'production', RESO_ACCESS_TOKEN: 'synthetic-test-only' } },
    console: { info() {}, warn() {}, error() {} },
    Buffer, URL, TextDecoder, AbortSignal, setTimeout,
    fetch: async input => {
      const url = new URL(input);
      requests.push(url);
      const skip = Number(url.searchParams.get('$skip'));
      const top = Number(url.searchParams.get('$top'));
      const ordered = url.searchParams.get('$orderby')?.startsWith('ListPrice desc')
        ? [...dataset].reverse() : dataset;
      return new Response(JSON.stringify(respond ? respond({ skip, top }) : {
        value: ordered.slice(skip, skip + top),
      }));
    },
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'next/cache') return {
        unstable_cache: (fn, keys) => { cacheKeys.push(keys); return fn; },
      };
      if (name === './site-config') return { SITE: { shortName: 'Synthetic', phoneDisplay: '', email: '' } };
      if (name === './south-florida-locations') return { southFloridaCountyValue: () => null };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { search: loaded.exports.fetchLiveListingPage, snapshot: loaded.exports.fetchLiveListingSnapshot, requests, cacheKeys };
}

async function traverse(search, filters) {
  const pages = [];
  for (let page = 1; page <= 50; page++) {
    const result = await search(filters, page);
    pages.push(result);
    if (result.pagination.totalPages === page) return pages;
  }
  assert.fail('Pagination did not terminate');
}

const ids = pages => pages.flatMap(page => Array.from(page.listings, listing => listing.mlsId));

test('all 150 local-filter matches remain reachable exactly once across seven pages', async () => {
  const dataset = records(150);
  const { search, requests } = loadIdx(dataset);
  const pages = await traverse(search, { privatePoolOnly: true, sort: 'price-asc' });
  assert.equal(pages.length, 7);
  assert.deepEqual(ids(pages), dataset.map(record => record.ListingId));
  assert.deepEqual(pages.map(page => page.listings.length), [24, 24, 24, 24, 24, 24, 6]);
  assert.deepEqual(requests.map(url => Number(url.searchParams.get('$skip'))), [0, 24, 48, 72, 96, 120, 144]);
  assert.ok(requests.every(url => url.searchParams.get('$top') === '25'));
  assert.ok(requests.every(url => url.searchParams.get('$expand') === 'Media($top=1;$orderby=Order)'));
  assert.ok(requests.every(url => !url.searchParams.has('$count')));
  assert.equal(pages[0].listings.at(-1).mlsId, '24');
  assert.equal(pages[1].listings[0].mlsId, '25');
});

test('empty candidate pages do not end traversal before later matches', async () => {
  const dataset = records(150).map((record, i) => ({ ...record, PoolPrivateYN: i >= 72 }));
  const { search } = loadIdx(dataset);
  const pages = await traverse(search, { privatePoolOnly: true });
  assert.deepEqual(pages.slice(0, 3).map(page => page.listings.length), [0, 0, 0]);
  assert.deepEqual(ids(pages), dataset.slice(72).map(record => record.ListingId));
});

test('sparse matches across empty middle and terminal pages are not lost or duplicated', async () => {
  const dataset = records(100).map((record, i) => ({ ...record, PoolPrivateYN: i < 24 || (i >= 48 && i < 70) }));
  const { search } = loadIdx(dataset);
  const pages = await traverse(search, { privatePoolOnly: true });
  assert.deepEqual(pages.map(page => page.listings.length), [24, 0, 22, 0, 0]);
  assert.deepEqual(ids(pages), dataset.filter(record => record.PoolPrivateYN).map(record => record.ListingId));
});

test('polygon filtering preserves exact shape and provider ordering across boundaries', async () => {
  const polygon = [{ lat: 26, lng: -81 }, { lat: 27, lng: -81 }, { lat: 26, lng: -80 }];
  const dataset = records(60).map((record, i) => ({ ...record, Longitude: i % 3 ? -80.8 : -80.1 }));
  const { search, requests } = loadIdx(dataset);
  const pages = await traverse(search, { polygon, sort: 'price-desc' });
  assert.deepEqual(ids(pages), dataset.filter((_, i) => i % 3).reverse().map(record => record.ListingId));
  assert.ok(requests.every(url => url.searchParams.get('$orderby') === 'ListPrice desc,ModificationTimestamp desc'));
});

test('existing provider filters and default statuses are not narrowed by pagination', async () => {
  const { search, requests } = loadIdx(records(1));
  await search({ locations: ['33467'], maxPrice: 500000, privatePoolOnly: true });
  const filter = requests[0].searchParams.get('$filter');
  assert.match(filter, /PostalCode eq '33467'/);
  assert.match(filter, /ListPrice le 500000/);
  for (const status of ['Active', 'Coming Soon', 'Active Under Contract']) assert.ok(filter.includes(`StandardStatus eq '${status}'`));
  assert.doesNotMatch(filter, /PropertyType eq 'Residential'/);
  assert.doesNotMatch(filter, /PoolPrivateYN/);
});

test('an exact final page needs no empty lookahead page', async () => {
  const { search } = loadIdx(records(48));
  assert.equal((await traverse(search, { privatePoolOnly: true })).length, 2);
});

test('short provider pages with continuation fail closed instead of skipping unseen rows', async () => {
  const { search, requests } = loadIdx([], () => ({ value: records(20), '@odata.nextLink': 'Property?$skip=20' }));
  await assert.rejects(search({ privatePoolOnly: true }), /incomplete candidate page/);
  assert.equal(requests.length, 1);
});

test('a full 24-row page with provider continuation is safe to advance', async () => {
  const { search } = loadIdx([], () => ({ value: records(24), '@odata.nextLink': 'Property?$skip=24' }));
  const result = await search({ privatePoolOnly: true });
  assert.equal(result.listings.length, 24);
  assert.equal(result.pagination.totalPages, 2);
});

test('changed offsets use a new persistent page-cache namespace', () => {
  const { cacheKeys } = loadIdx([]);
  assert.ok(cacheKeys.some(keys => keys.includes('beaches-mls-listing-page-v3')));
  assert.ok(cacheKeys.every(keys => !keys.includes('beaches-mls-listing-page-v2')));
});

test('saved alerts retain their original single-request candidate coverage independently of public pages', async () => {
  const dataset = records(100).map((record, i) => ({ ...record, PoolPrivateYN: i >= 24 }));
  const { search, snapshot, requests, cacheKeys } = loadIdx(dataset);
  assert.equal((await search({ privatePoolOnly: true })).listings.length, 0);
  const alert = await snapshot({ privatePoolOnly: true });
  assert.deepEqual(Array.from(alert.listings, listing => listing.mlsId), dataset.slice(24, 48).map(record => record.ListingId));
  assert.deepEqual(requests.map(url => url.searchParams.get('$top')), ['25', '73']);
  assert.equal(requests[1].searchParams.get('$skip'), '0');
  assert.ok(cacheKeys.some(keys => keys.includes('beaches-mls-listing-snapshot-v1')));

  const sparse = records(100).map((record, i) => ({ ...record, PoolPrivateYN: [24, 48, 71, 72].includes(i) }));
  const sparseAlert = await loadIdx(sparse).snapshot({ privatePoolOnly: true });
  assert.deepEqual(Array.from(sparseAlert.listings, listing => listing.mlsId), ['25', '49', '72']);
});

test('only the original local-verification filters widen an alert sample', async () => {
  const wideFilters = [
    { privatePoolOnly: true }, { fireplaceOnly: true }, { newConstructionOnly: true },
    { seniorCommunityMode: 'only' }, { maxHoaMonthly: 500 }, { priceReducedOnly: true },
    { maxAnnualTaxes: 10000 }, { architecturalStyle: 'modern' }, { viewType: 'water' },
    { coolingType: 'central' }, { heatingType: 'electric' }, { amenities: ['spa'] },
    { polygon: [{ lat: 26, lng: -81 }, { lat: 27, lng: -81 }, { lat: 26, lng: -80 }] },
  ];
  const narrowFilters = [{}, { listingStatus: 'active' }, { seniorCommunityMode: 'exclude' }, { noHoaOnly: true }, { waterfrontOnly: true }];
  for (const [filters, expected] of [...wideFilters.map(filters => [filters, '73']), ...narrowFilters.map(filters => [filters, '25'])]) {
    const { snapshot, requests } = loadIdx([]);
    await snapshot(filters);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get('$top'), expected, JSON.stringify(filters));
  }
});

test('failed alert sample releases the claim without sending mail or replacing the snapshot', async () => {
  const loaded = { exports: {} };
  const rpcCalls = [];
  let emails = 0;
  vm.runInNewContext(compile('../app/api/saved-search/process/route.ts'), {
    module: loaded, exports: loaded.exports,
    console: { error() {}, warn() {} }, setTimeout,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: value => value } };
      if (name === '@/lib/supabase/public') return { createSupabasePublicClient: () => ({ rpc: async (name, args) => {
        rpcCalls.push({ name, args });
        return { data: name === 'claim_due_saved_searches' ? [{ search_id: 'synthetic-search', criteria: {}, first_run: false }] : null, error: null };
      } }) };
      if (name === '@/lib/idx') return { fetchLiveListingSnapshot: async () => { throw new Error('synthetic outage'); } };
      if (name === '@/lib/saved-search-worker') return {
        savedCriteriaToFilters: () => ({}),
        snapshotListings: () => assert.fail('A failed sample must not become a snapshot'),
        compareSavedSearchSnapshots: () => assert.fail('A failed sample must not be compared'),
        sendSavedSearchEmail: () => { emails++; },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const result = await loaded.exports.POST(new Request('https://synthetic.test/process', {
    method: 'POST', headers: { authorization: 'Bearer synthetic-worker-token-only' },
  }));
  assert.equal(result.failed, 1);
  assert.equal(emails, 0);
  assert.deepEqual(rpcCalls.map(call => call.name), ['claim_due_saved_searches', 'release_saved_search_claim']);
});

async function renderPage({ page = 1, next = false, unavailable = false, params = {}, listings = [] } = {}) {
  const loaded = { exports: {} };
  const emptyComponent = () => null;
  vm.runInNewContext(pageCode, {
    module: loaded, exports: loaded.exports, URLSearchParams,
    require(name) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'next/link') return { default: ({ children, href }) => React.createElement('a', { href }, children) };
      if (name === '@/lib/listings') return { searchListingPage: async () => ({
        live: true, unavailable, listings,
        pagination: { page, pageSize: 24, totalPages: next ? page + 1 : page, totalRows: listings.length, totalRowsExact: false },
      }) };
      if (name === '@/lib/idx') return { IDX_PROVIDER: 'reso' };
      if (name === '@/lib/types') return listingTypes;
      if (name === '@/lib/south-florida-locations') return { MAX_SEARCH_LOCATIONS: 20 };
      if (name === '@/components/IdxAttribution') return { IdxPageDisclaimer: emptyComponent };
      if (name.startsWith('@/components/')) return { default: emptyComponent };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return renderToStaticMarkup(await loaded.exports.default({ searchParams: Promise.resolve(params) }));
}

test('empty first page offers Next and preserves repeated locations, sort, and filters', async () => {
  const html = await renderPage({ next: true, params: { location: ['33467', 'Boca Raton'], pool: '1', sort: 'price-desc' } });
  assert.match(html, /No matching homes on this page/);
  assert.match(html, /Select Next to check more listings/);
  assert.match(html, /aria-label="Listing results pages"/);
  assert.match(html, /location=33467&amp;location=Boca\+Raton&amp;pool=1&amp;sort=price-desc&amp;page=2/);
  assert.doesNotMatch(html, />Previous<|No matching homes are available in this search/);
});

test('empty middle pages keep both navigation directions', async () => {
  const html = await renderPage({ page: 2, next: true, params: { page: '2' } });
  assert.match(html, /href="\/properties\?page=1">Previous/);
  assert.match(html, /href="\/properties\?page=3">Next/);
});

test('empty terminal pages keep Previous without claiming the entire search is empty', async () => {
  const html = await renderPage({ page: 3, params: { page: '3', q: '123 Main Street' } });
  assert.match(html, />Previous</);
  assert.match(html, /No matching homes on this page/);
  assert.doesNotMatch(html, />Next<|Possibly off market|not currently listed|No matching homes are available in this search/);
});

test('address lookups with later pages do not claim a home is off market', async () => {
  const html = await renderPage({ next: true, params: { q: '123 Main Street' } });
  assert.match(html, />Next</);
  assert.doesNotMatch(html, /Possibly off market|not currently listed/);
});

test('confirmed empty first address lookup still has off-market guidance', async () => {
  const html = await renderPage({ params: { q: '123 Main Street' } });
  assert.match(html, /Possibly off market/);
  assert.doesNotMatch(html, /aria-label="Listing results pages"/);
});

test('unavailable search neither claims no inventory nor offers fabricated continuation', async () => {
  const html = await renderPage({ page: 2, next: true, unavailable: true });
  assert.match(html, /Live listings are temporarily unavailable/);
  assert.match(html, /The live feed could not complete this search/);
  assert.doesNotMatch(html, /aria-label="Listing results pages"|No matching homes are available/);
});
