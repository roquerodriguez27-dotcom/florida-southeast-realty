import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveListingResult } from '../lib/listing-result.ts';
import { collectListingPhotos, listingKeyFromSlug } from '../lib/listing-photo-pages.ts';
import { createResoUpstreamPolicy } from '../lib/reso-upstream-policy.ts';

const key = '20261104120000000000000000';
const slug = `test-property--${Buffer.from(key).toString('base64url')}`;
const photo = i => ({ MediaKey: String(i), ResourceRecordKey: key, MediaCategory: 'Photo', MediaURL: `https://photos.example.com/${i}.jpg` });

test('a provider failure is unavailable, never a false missing property', async () => {
  assert.deepEqual(await resolveListingResult(async () => { throw new Error('503'); }), { kind: 'unavailable' });
});
test('only an empty successful lookup means missing', async () => {
  assert.deepEqual(await resolveListingResult(async () => null), { kind: 'not-found' });
  assert.deepEqual(await resolveListingResult(async () => ({ price: 500000 })), { kind: 'found', listing: { price: 500000 } });
});
test('canonical listing keys round trip; malformed encodings do not', () => {
  assert.equal(listingKeyFromSlug(slug), key);
  for (const bad of ['null', 'undefined', 'home--a', 'home--!!!!', 'home--' + Buffer.from([255, 255, 255]).toString('base64url'), 'x'.repeat(301)]) {
    assert.equal(listingKeyFromSlug(bad), null);
  }
});
test('gallery loads all photos beyond the former 25-photo page', async () => {
  const offsets = [];
  const images = await collectListingPhotos(key, 119, async (offset, size) => {
    offsets.push(offset);
    return Array.from({ length: Math.min(size, 119 - offset) }, (_, i) => photo(offset + i));
  });
  assert.equal(images.length, 119);
  assert.deepEqual(offsets, [0, 100]);
});
test('a provider-side 25-row cap does not truncate a larger gallery', async () => {
  const offsets = [];
  const images = await collectListingPhotos(key, 61, async offset => {
    offsets.push(offset);
    return Array.from({ length: Math.min(25, 61 - offset) }, (_, i) => photo(offset + i));
  });
  assert.equal(images.length, 61);
  assert.deepEqual(offsets, [0, 25, 50]);
});
test('incomplete galleries reject instead of poisoning the complete-gallery cache', async () => {
  await assert.rejects(collectListingPhotos(key, 51, async offset => offset === 0 ? [photo(1)] : []), /Incomplete/);
});
test('repeating pages stop rather than looping through the provider', async () => {
  let calls = 0;
  await assert.rejects(collectListingPhotos(key, 51, async () => { calls++; return [photo(1)]; }), /did not advance/);
  assert.equal(calls, 2);
});
test('a later provider outage does not return a partial collection as complete', async () => {
  await assert.rejects(collectListingPhotos(key, 51, async offset => {
    if (offset) throw new Error('temporary provider outage');
    return [photo(1)];
  }), /temporary provider outage/);
});
test('foreign-property media and unsafe URL schemes are not returned', async () => {
  await assert.rejects(collectListingPhotos(key, 1, async () => [{ ...photo(1), ResourceRecordKey: 'foreign' }]), /Mismatched/);
  const images = await collectListingPhotos(key, 0, async offset => offset ? [] : [
    { ...photo(1), MediaURL: 'javascript:alert(1)' },
    { ...photo(2), MediaURL: 'https://user:secret@example.com/x.jpg' },
    { ...photo(3), MediaCategory: 'Video' },
    photo(4), photo(4),
  ]);
  assert.deepEqual(images, ['https://photos.example.com/4.jpg']);
});
test('a missing provider photo count is handled by bounded pagination', async () => {
  assert.deepEqual(await collectListingPhotos(key, 0, async offset => offset ? [] : [photo(1)]), ['https://photos.example.com/1.jpg']);
});
test('a previously cancelled caller never trips a provider-wide cooldown', async () => {
  let calls = 0;
  const events = [];
  const controller = new AbortController();
  controller.abort();
  const guarded = createResoUpstreamPolicy(async (_url, init) => {
    calls++;
    init?.signal?.throwIfAborted();
    return new Response('{}');
  }, { onFailure: event => events.push(event) });
  await assert.rejects(guarded('https://replication.sparkapi.com/Version/3/Reso/OData/Property', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal((await guarded('https://replication.sparkapi.com/Version/3/Reso/OData/Property')).status, 200);
  assert.equal(calls, 1);
  assert.equal(events.length, 0);
});
test('listing HTML does not eagerly request complete media and handles outage separately', () => {
  const source = readFileSync(new URL('../app/properties/[slug]/page.tsx', import.meta.url), 'utf8');
  const loader = readFileSync(new URL('../lib/listing-detail.ts', import.meta.url), 'utf8');
  assert.match(loader, /fetchLiveListingBySlug\(slug, false\)/);
  assert.match(source, /result.kind === "unavailable"/);
  assert.match(source, /ListingUnavailable/);
  assert.doesNotMatch(source, /!crawlerRequest/);
});
