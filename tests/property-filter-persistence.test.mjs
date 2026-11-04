import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../components/PropertyFilters.tsx',import.meta.url),'utf8');

test('collapsed advanced filters stay mounted and participate in FormData',()=>{
 assert.match(source,/<div hidden=\{!showMore\}/);
 assert.doesNotMatch(source,/\{showMore\s*\?/);
 for(const field of ['q','listingStatus','senior','noHoa','maxHoa','pool','amenity']) assert.ok(source.includes(`name="${field}"`),field);
});
test('resetting advanced criteria retains the original search text or ZIP',()=>{
 const helper=source.slice(source.indexOf('function basicFiltersHref'),source.indexOf('export default function'));
 assert.match(helper,/\["q", current\.q\]/);
 assert.match(helper,/current\.locations/);
});
