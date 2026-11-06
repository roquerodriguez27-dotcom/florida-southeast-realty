// Read-only maintenance check. Run inside the configured deployment environment.
// Only schema field names are printed; credentials and listing data stay private.
const token = (process.env.RESO_ACCESS_TOKEN || process.env.SPARK_ACCESS_TOKEN || process.env.IDX_PROVIDER_API_KEY)
  ?.trim().replace(/^(?:Bearer|OAuth)\s+/i, '');

if (!token) {
  console.error('RESO schema check: no configured credential.');
  process.exit(1);
}

try {
  const response = await fetch('https://replication.sparkapi.com/Version/3/Reso/OData/$metadata', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/xml',
      'User-Agent': 'FloridaSoutheastRealty/SchemaValidation',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Provider status ${response.status}`);

  const xml = await response.text();
  const entities = [...xml.matchAll(/<(?:\w+:)?EntityType\b[^>]*Name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:\w+:)?EntityType>/g)];
  const property = entities.find((entity) => entity[1] === 'Property');
  if (!property) throw new Error('Property schema was not found.');
  const fields = [...property[2].matchAll(/<(?:\w+:)?Property\b[^>]*Name=["']([^"']+)["']/g)]
    .map((field) => field[1]).sort();
  if (!fields.includes('ListingKey')) throw new Error('Property schema was incomplete.');
  for (let index = 0; index < fields.length; index += 8) {
    console.log(`FSR_METADATA_FIELDS_${index} ${JSON.stringify(fields.slice(index, index + 8))}`);
  }
  console.log(`RESO schema check succeeded: ${fields.length} property fields.`);
} catch (error) {
  // Do not print raw response bodies, request headers, or fetch error details.
  const safeMessage = error instanceof Error && /^(Provider status \d{3}|Property schema (was not found|was incomplete)\.)$/.test(error.message)
    ? error.message : 'The metadata request did not complete.';
  console.error(`RESO schema check failed: ${safeMessage}`);
  process.exit(1);
}
