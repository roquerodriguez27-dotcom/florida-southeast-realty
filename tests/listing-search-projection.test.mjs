import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(fs.readFileSync(new URL('../lib/idx.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Synthetic feed-shaped records exercise fields used beyond the visible card:
// local amenity checks, monthly costs, address/agent fallbacks, and attribution.
const complete = {
  ListingKey: 'SYNTHETIC-PROJECTION-1', ListingId: 'SYNTHETIC-1',
  PropertyType: 'Residential', PropertySubType: 'Single Family Residence',
  StandardStatus: 'Active', MlsStatus: 'Active', ListPrice: 600000, OriginalListPrice: 650000,
  UnparsedAddress: '123 Example Street', StreetNumber: '123', StreetDirPrefix: 'N',
  StreetName: 'Example', StreetSuffix: 'Street', StreetDirSuffix: 'E', UnitNumber: '4',
  City: 'Lake Worth', PostalCode: '33467', SubdivisionName: 'Example Community',
  BedroomsTotal: 4, BathroomsTotalInteger: 3, BathroomsFull: 2, BathroomsHalf: 1,
  LivingArea: 2100, BuildingAreaTotal: 2500, LotSizeSquareFeet: 9000,
  YearBuilt: 2026, GarageSpaces: 2, DaysOnMarket: 12, Latitude: 26.6, Longitude: -80.2,
  WaterfrontYN: true, WaterfrontFeatures: ['Canal', 'Dock'], PoolPrivateYN: true,
  PoolFeatures: ['Private', 'Association'], FireplaceYN: true, NewConstructionYN: true,
  SeniorCommunityYN: false, AssociationYN: true, AssociationFee: 900,
  AssociationFeeFrequency: 'Quarterly', AssociationFee2: 1200, AssociationFee2Frequency: 'Annually',
  TaxAnnualAmount: 7500, ArchitecturalStyle: ['Ranch'], View: ['Canal', 'Garden'],
  Cooling: ['Central Air'], Heating: ['Electric', 'Central'],
  InteriorFeatures: ['Walk-in Closet'], ExteriorFeatures: ['Impact Windows', 'Dock'],
  AssociationAmenities: ['Pool', 'Gated', 'Golf', 'Clubhouse', 'Fitness Center', 'Pickleball', 'Tennis'],
  SpaYN: true, SpaFeatures: ['Hot Tub'], HorseYN: true, HorseAmenities: ['Horse Trails'],
  LotFeatures: ['Equestrian'], WindowFeatures: ['Impact Glass'], Appliances: ['Dishwasher'],
  PublicRemarks: 'Synthetic listing used only to verify data preservation.', PhotosCount: 32,
  ModificationTimestamp: '2026-11-05T16:00:00Z', MajorChangeTimestamp: '2026-11-04T16:00:00Z',
  OriginatingSystemID: 'SYNTHETIC-MLS', OriginatingSystemKey: 'SYNTHETIC-KEY', OriginatingSystemName: 'Synthetic MLS',
  ListOfficeName: 'Synthetic Office', ListAgentFullName: 'Synthetic Agent',
  ListAgentFirstName: 'Synthetic', ListAgentMiddleName: 'Test', ListAgentLastName: 'Agent',
  ListAgentPreferredPhone: '555-0100', ListAgentDirectPhone: '555-0101',
  ListAgentOfficePhone: '555-0102', ListAgentEmail: 'agent@example.test',
  Media: [{ MediaURL: 'https://example.test/property.jpg', MediaCategory: 'Photo', Order: 0 }],
  UnusedProviderField: 'not needed by the website',
};
const fallback = { ...complete, ListingKey: 'SYNTHETIC-PROJECTION-2', ListingId: 'SYNTHETIC-2',
  UnparsedAddress: undefined, LivingArea: undefined, ListPrice: undefined,
  BathroomsTotalInteger: undefined, ListAgentFullName: undefined, ListAgentPreferredPhone: undefined,
  ListOfficeName: undefined, ModificationTimestamp: undefined, OriginatingSystemID: undefined,
  StandardStatus: undefined, WaterfrontYN: false, NewConstructionYN: false,
};
const minimal = { ...fallback, ListingKey: 'SYNTHETIC-PROJECTION-3', ListingId: 'SYNTHETIC-3',
  ListAgentDirectPhone: undefined, AssociationYN: false, AssociationFee: undefined,
  AssociationFee2: undefined, SeniorCommunityYN: true, PoolPrivateYN: false, FireplaceYN: false,
};

function loadSearch(project) {
  const calls = [];
  const loaded = { exports: {} };
  vm.runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    process: { env: { NODE_ENV: 'production', RESO_ACCESS_TOKEN: 'synthetic-test-only' } },
    console: { info() {}, warn() {}, error() {} }, Buffer, URL, TextDecoder, AbortSignal, setTimeout,
    fetch: async input => {
      const url = new URL(input);
      calls.push(url);
      const select = url.searchParams.get('$select');
      const fields = select?.split(',');
      const rows = [complete, fallback, minimal].map(record => {
        const output = project && fields
          ? Object.fromEntries(Object.entries(record).filter(([key]) => fields.includes(key)))
          : { ...record };
        // Expanded navigation data is independent of scalar selection.
        if (url.searchParams.has('$expand')) output.Media = record.Media;
        else delete output.Media;
        return output;
      });
      return new Response(JSON.stringify({ value: rows }));
    },
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'next/cache') return { unstable_cache: fn => fn };
      if (name === './site-config') return { SITE: { shortName: 'Synthetic', phoneDisplay: '', email: '' } };
      if (name === './south-florida-locations') return { southFloridaCountyValue: () => null };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { ...loaded.exports, calls };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('projected search preserves complete normalized listings, media, and fallback values', async () => {
  const full = loadSearch(false);
  const projected = loadSearch(true);
  const before = await full.fetchLiveListingPage({ locations: ['33467'] });
  const after = await projected.fetchLiveListingPage({ locations: ['33467'] });
  assert.deepEqual(plain(after), plain(before));
  assert.equal(after.listings[0].associationFeeMonthly, 400);
  assert.equal(after.listings[0].photoCount, 32);
  assert.equal(after.listings[0].images[0], 'https://example.test/property.jpg');
  assert.equal(after.listings[1].sqft, 2500);
  assert.equal(after.listings[2].agent.phone, '555-0102');
  const url = projected.calls[0];
  assert.ok(url.searchParams.get('$select'));
  assert.equal(url.searchParams.get('$top'), '25');
  assert.equal(url.searchParams.get('$expand'), 'Media($top=1;$orderby=Order)');
  assert.equal(url.searchParams.has('$count'), false);
});

test('projection preserves local filter membership and saved-alert candidate coverage', async () => {
  for (const filters of [
    { privatePoolOnly: true, maxHoaMonthly: 450, maxAnnualTaxes: 8000, architecturalStyle: 'ranch', amenities: ['impact-windows', 'community-pool'] },
    { seniorCommunityMode: 'exclude', viewType: 'water', coolingType: 'central-air', heatingType: 'electric' },
    { noHoaOnly: true },
    { newConstructionOnly: true, priceReducedOnly: true, fireplaceOnly: true },
    { polygon: [{ lat: 26, lng: -81 }, { lat: 27, lng: -81 }, { lat: 27, lng: -80 }, { lat: 26, lng: -80 }] },
  ]) {
    const full = loadSearch(false);
    const projected = loadSearch(true);
    const before = await full.fetchLiveListingSnapshot(filters);
    const after = await projected.fetchLiveListingSnapshot(filters);
    assert.ok(before.listings.length > 0);
    assert.deepEqual(plain(after), plain(before));
    assert.ok(projected.calls[0].searchParams.get('$select'));
    assert.equal(projected.calls[0].searchParams.has('$expand'), false);
    assert.equal(projected.calls[0].searchParams.get('$top'), filters.noHoaOnly ? '25' : '73');
  }
});
