import "server-only";

interface CommunityGeo {
  lat: number;
  lon: number;
  censusPlace: string;
  censusLabel: string;
}

const GEOGRAPHY: Record<string, CommunityGeo> = {
  "las-olas": { lat: 26.1197, lon: -80.1328, censusPlace: "24000", censusLabel: "Fort Lauderdale" },
  "coral-ridge": { lat: 26.1642, lon: -80.1127, censusPlace: "24000", censusLabel: "Fort Lauderdale" },
  "wilton-manors": { lat: 26.1604, lon: -80.1389, censusPlace: "78000", censusLabel: "Wilton Manors" },
  "lauderdale-by-the-sea": { lat: 26.1920, lon: -80.0964, censusPlace: "39475", censusLabel: "Lauderdale-by-the-Sea" },
  "hillsboro-beach": { lat: 26.2931, lon: -80.0789, censusPlace: "30525", censusLabel: "Hillsboro Beach" },
  "boca-raton": { lat: 26.3683, lon: -80.1289, censusPlace: "07300", censusLabel: "Boca Raton" },
  "delray-beach": { lat: 26.4615, lon: -80.0728, censusPlace: "17100", censusLabel: "Delray Beach" },
  "boynton-beach": { lat: 26.5253, lon: -80.0664, censusPlace: "07875", censusLabel: "Boynton Beach" },
  "lake-worth-beach": { lat: 26.6159, lon: -80.0569, censusPlace: "39075", censusLabel: "Lake Worth Beach" },
  "west-palm-beach": { lat: 26.7153, lon: -80.0534, censusPlace: "76600", censusLabel: "West Palm Beach" },
  wellington: { lat: 26.6618, lon: -80.2684, censusPlace: "75812", censusLabel: "Wellington" },
  "palm-beach-gardens": { lat: 26.8234, lon: -80.1387, censusPlace: "54075", censusLabel: "Palm Beach Gardens" },
  jupiter: { lat: 26.9342, lon: -80.0942, censusPlace: "35875", censusLabel: "Jupiter" },
};

export interface CensusSnapshot {
  geography: string;
  population: number;
  medianHouseholdIncome: number;
  medianHomeValue: number;
  medianGrossRent: number;
  medianAge: number;
  ownerOccupiedPercent: number;
  vintage: string;
}

export interface WeatherPeriod { name: string; temperature: number; temperatureUnit: string; shortForecast: string; windSpeed: string }
export interface WeatherSnapshot { periods: WeatherPeriod[]; alert: { headline: string; severity: string } | null }

function numeric(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function getCensusSnapshot(slug: string): Promise<CensusSnapshot | null> {
  const geo = GEOGRAPHY[slug];
  if (!geo) return null;
  const variables = "NAME,B01003_001E,B19013_001E,B25077_001E,B25064_001E,B01002_001E,B25003_001E,B25003_002E";
  try {
    const response = await fetch(`https://api.census.gov/data/2024/acs/acs5?get=${variables}&for=place:${geo.censusPlace}&in=state:12`, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!response.ok) return null;
    const rows = (await response.json()) as string[][];
    if (rows.length < 2) return null;
    const [headers, values] = rows;
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const occupied = numeric(row.B25003_001E);
    return {
      geography: geo.censusLabel,
      population: numeric(row.B01003_001E),
      medianHouseholdIncome: numeric(row.B19013_001E),
      medianHomeValue: numeric(row.B25077_001E),
      medianGrossRent: numeric(row.B25064_001E),
      medianAge: numeric(row.B01002_001E),
      ownerOccupiedPercent: occupied ? (numeric(row.B25003_002E) / occupied) * 100 : 0,
      vintage: "2020–2024 ACS 5-year estimates",
    };
  } catch { return null; }
}

export async function getWeatherSnapshot(slug: string): Promise<WeatherSnapshot | null> {
  const geo = GEOGRAPHY[slug];
  if (!geo) return null;
  const headers = { "User-Agent": "FloridaSoutheastRealty.com community guide (roque@floridasoutheastrealty.com)", Accept: "application/geo+json" };
  try {
    const pointResponse = await fetch(`https://api.weather.gov/points/${geo.lat},${geo.lon}`, { headers, next: { revalidate: 60 * 60 * 12 } });
    if (!pointResponse.ok) return null;
    const point = await pointResponse.json() as { properties?: { forecast?: string } };
    if (!point.properties?.forecast) return null;
    const [forecastResponse, alertsResponse] = await Promise.all([
      fetch(point.properties.forecast, { headers, next: { revalidate: 60 * 30 } }),
      fetch(`https://api.weather.gov/alerts/active?point=${geo.lat},${geo.lon}`, { headers, next: { revalidate: 60 * 10 } }),
    ]);
    if (!forecastResponse.ok) return null;
    const forecast = await forecastResponse.json() as { properties?: { periods?: WeatherPeriod[] } };
    const alerts = alertsResponse.ok ? await alertsResponse.json() as { features?: { properties?: { headline?: string; severity?: string } }[] } : null;
    const firstAlert = alerts?.features?.[0]?.properties;
    return { periods: (forecast.properties?.periods ?? []).slice(0, 4), alert: firstAlert?.headline ? { headline: firstAlert.headline, severity: firstAlert.severity ?? "Unknown" } : null };
  } catch { return null; }
}

export function getCommunityMapLinks(slug: string, name: string) {
  const geo = GEOGRAPHY[slug];
  const query = encodeURIComponent(`${name}, Florida`);
  return {
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${query}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    census: geo ? `https://data.census.gov/profile?g=160XX00US12${geo.censusPlace}` : "https://data.census.gov/",
    weather: geo ? `https://forecast.weather.gov/MapClick.php?lat=${geo.lat}&lon=${geo.lon}` : "https://www.weather.gov/",
  };
}
