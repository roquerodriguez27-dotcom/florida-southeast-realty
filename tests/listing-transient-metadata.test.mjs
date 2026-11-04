import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ListingUnavailableError } from '../lib/listing-result.ts';

test('transient detail failures remain retryable errors, not noindex success pages', () => {
 const source=readFileSync(new URL('../app/properties/[slug]/page.tsx',import.meta.url),'utf8');
 const failures=source.match(/if \(result.kind === "unavailable"\) throw new ListingUnavailableError\(\);/g);
 assert.equal(failures?.length,2,'page and metadata must both preserve failure semantics');
 assert.doesNotMatch(source,/result.kind !== "found"/);
 assert.doesNotMatch(source,/return <ListingUnavailable/);
 const error=new ListingUnavailableError();
 assert.equal(error.name,'ListingUnavailableError');
 assert.match(error.message,/temporarily unavailable/);
});
