// Opt-in, read-only release check; never part of the normal build.
// Run only inside a configured deployment. Prints aggregate measurements and
// field names, never credentials, listing records, request URLs, or headers.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = (process.env.RESO_ACCESS_TOKEN || process.env.SPARK_ACCESS_TOKEN || process.env.IDX_PROVIDER_API_KEY)
  ?.trim().replace(/^(?:Bearer|OAuth)\s+/i, '');
const captured = [];
const modules = new Map();

function loadSource(file) {
  const filename = path.resolve(root, file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const loaded = { exports: {} };
  modules.set(filename, loaded);
  let source = fs.readFileSync(filename, 'utf8');
  if (file === 'lib/idx.ts') source += '\nexport const verifyNormalizeListing = normalizeListing;\n';
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: loaded, exports: loaded.exports, process: { env: process.env },
    console: { info() {}, warn() {}, error() {} }, Buffer, URL, TextDecoder,
    AbortSignal, setTimeout,
    fetch: async input => {
      captured.push(new URL(input));
      return new Response(JSON.stringify({ value: [] }));
    },
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'next/cache') return { unstable_cache: fn => fn };
      if (!name.startsWith('.')) throw new Error('Unexpected source dependency.');
      return loadSource(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
    },
  });
  return loaded.exports;
}

async function readListings(url) {
  if (url.origin !== 'https://replication.sparkapi.com' || !url.pathname.endsWith('/Property')) {
    throw new Error('Unexpected provider destination.');
  }
  const started = performance.now();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}.`);
  const body = await response.text();
  const payload = JSON.parse(body);
  if (!Array.isArray(payload.value)) throw new Error('Unexpected provider payload.');
  return { rows: payload.value, bytes: Buffer.byteLength(body), durationMs: Math.round(performance.now() - started) };
}

try {
  if (!token) throw new Error('No configured credential.');
  const idx = loadSource('lib/idx.ts');
  for (const [label, filters] of [['all-sale-search', {}], ['zip-search', { locations: ['33467'] }]]) {
    captured.length = 0;
    await idx.fetchLiveListingPage(filters, 1);
    const projectedUrl = captured[0];
    if (!projectedUrl?.searchParams.get('$select')) throw new Error('Search projection was not configured.');
    if (projectedUrl.searchParams.get('$top') !== '25') throw new Error('Unexpected search page size.');
    const fullUrl = new URL(projectedUrl);
    fullUrl.searchParams.delete('$select');
    const full = await readListings(fullUrl);
    const projected = await readListings(projectedUrl);
    const baseline = new Map(full.rows.map(row => [row.ListingKey, row]));
    const differences = new Set();
    let compared = 0;
    let photos = 0;
    for (const row of projected.rows) {
      const original = baseline.get(row.ListingKey);
      if (!original || original.ModificationTimestamp !== row.ModificationTimestamp) continue;
      const before = idx.verifyNormalizeListing(original, 'Summary');
      const after = idx.verifyNormalizeListing(row, 'Summary');
      if (!before || !after) throw new Error('Listing normalization was incomplete.');
      for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) differences.add(field);
      }
      compared++;
      if (Array.isArray(row.Media) && row.Media.length) photos++;
    }
    console.log(`FSR_PROJECTION_CHECK ${JSON.stringify({
      label, selectedFields: projectedUrl.searchParams.get('$select').split(',').length,
      fullRows: full.rows.length, projectedRows: projected.rows.length,
      comparedStableRows: compared, rowsWithExpandedPhoto: photos,
      differingNormalizedFields: [...differences].sort(),
      fullPayloadBytes: full.bytes, projectedPayloadBytes: projected.bytes,
      reductionPercent: Math.round((1 - projected.bytes / full.bytes) * 1000) / 10,
      fullDurationMs: full.durationMs, projectedDurationMs: projected.durationMs,
    })}`);
    if (compared < 10 || differences.size) throw new Error('Projection equivalence check failed.');
  }
  captured.length = 0;
  await idx.fetchLiveListingSnapshot({ locations: ['33467'], privatePoolOnly: true });
  const snapshotUrl = captured[0];
  if (!snapshotUrl?.searchParams.get('$select') || snapshotUrl.searchParams.has('$expand')
      || snapshotUrl.searchParams.get('$top') !== '73') throw new Error('Unexpected saved-search query.');
  const snapshot = await readListings(snapshotUrl);
  console.log(`FSR_SNAPSHOT_CHECK ${JSON.stringify({ rows: snapshot.rows.length,
    payloadBytes: snapshot.bytes, durationMs: snapshot.durationMs,
    mediaExpanded: snapshot.rows.some(row => Array.isArray(row.Media) && row.Media.length > 0),
  })}`);
  console.log('RESO projection release check succeeded.');
} catch (error) {
  const message = error instanceof Error && /^(Provider HTTP \d{3}\.|Unexpected [\w -]+\.|No configured credential\.|Search projection was not configured\.|Listing normalization was incomplete\.|Projection equivalence check failed\.)$/.test(error.message)
    ? error.message : 'The release check did not complete.';
  console.error(`RESO projection release check failed: ${message}`);
  process.exit(1);
}
