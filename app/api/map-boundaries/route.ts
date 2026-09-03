import { SOUTH_FLORIDA_LOCATION_OPTIONS } from "@/lib/south-florida-locations";

const DEFAULT_TIGERWEB_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";
const BOUNDARY_CACHE_SECONDS = 2_592_000;
const MAX_BOUNDARY_LOCATIONS = 20;

type BoundaryKind = "ZIP" | "County" | "City";

interface BoundaryRequest {
  label: string;
  censusName: string;
  kind: BoundaryKind;
}

interface CensusFeature {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}

interface CensusFeatureCollection {
  type?: string;
  features?: CensusFeature[];
  error?: {
    message?: string;
  };
}

const CITY_ALIASES: Record<string, string> = {
  islamorada: "Islamorada, Village of Islands",
  "lake worth": "Lake Worth Beach",
};

function canonicalBoundaryRequest(value: string): BoundaryRequest | null {
  const trimmed = value.trim().slice(0, 100);
  const zip = trimmed.match(/^((?:33|34)\d{3})(?:-\d{4})?$/);
  if (zip) {
    return {
      label: zip[1],
      censusName: zip[1],
      kind: "ZIP",
    };
  }

  const location = SOUTH_FLORIDA_LOCATION_OPTIONS.find(
    (candidate) => candidate.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (!location) return null;

  return {
    label: location.name,
    censusName: location.type === "County"
      ? location.name.replace(/ County$/, "")
      : CITY_ALIASES[location.name.toLowerCase()] ?? location.name,
    kind: location.type,
  };
}

function tigerwebBase(): string {
  return (process.env.CENSUS_TIGERWEB_BASE_URL?.trim() || DEFAULT_TIGERWEB_BASE).replace(/\/+$/, "");
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function queryBoundaryLayer(
  service: string,
  layer: number,
  where: string,
): Promise<CensusFeature | null> {
  const url = new URL(`${tigerwebBase()}/${service}/MapServer/${layer}/query`);
  url.searchParams.set("where", where);
  url.searchParams.set("outFields", "GEOID,BASENAME,NAME");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("geometryPrecision", "5");
  url.searchParams.set("maxAllowableOffset", "0.0002");
  url.searchParams.set("f", "geojson");

  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json, application/json",
      "User-Agent": "FloridaSoutheastRealty/1.0 (property map boundaries)",
    },
    next: { revalidate: BOUNDARY_CACHE_SECONDS },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`TIGERweb returned HTTP ${response.status}.`);
  }

  const payload = await response.json() as CensusFeatureCollection;
  if (payload.error?.message) throw new Error(payload.error.message);
  return payload.features?.find((feature) => (
    feature.type === "Feature"
    && (feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon")
    && Array.isArray(feature.geometry.coordinates)
  )) ?? null;
}

async function fetchBoundary(request: BoundaryRequest) {
  const name = sqlString(request.censusName);
  let feature: CensusFeature | null = null;

  if (request.kind === "ZIP") {
    feature = await queryBoundaryLayer(
      "PUMA_TAD_TAZ_UGA_ZCTA",
      1,
      `ZCTA5=${name}`,
    );
  } else if (request.kind === "County") {
    feature = await queryBoundaryLayer(
      "State_County",
      1,
      `STATE='12' AND BASENAME=${name}`,
    );
  } else {
    const where = `STATE='12' AND BASENAME=${name}`;
    const cityLayers = await Promise.allSettled([
      queryBoundaryLayer("Places_CouSub_ConCity_SubMCD", 4, where),
      queryBoundaryLayer("Places_CouSub_ConCity_SubMCD", 5, where),
    ]);
    for (const result of cityLayers) {
      if (result.status === "fulfilled" && result.value) {
        feature = result.value;
        break;
      }
    }
    if (!feature && cityLayers.some((result) => result.status === "rejected")) {
      throw new Error("TIGERweb city boundary lookup was unavailable.");
    }
  }

  if (!feature?.geometry) return null;
  return {
    location: request.label,
    kind: request.kind,
    feature: {
      type: "Feature" as const,
      properties: {
        label: request.label,
        kind: request.kind,
        source: "U.S. Census Bureau TIGERweb",
      },
      geometry: feature.geometry,
    },
  };
}

export async function GET(request: Request) {
  const requestedLocations = new URL(request.url).searchParams
    .getAll("location")
    .map((location) => location.trim())
    .filter(Boolean)
    .slice(0, MAX_BOUNDARY_LOCATIONS);
  const canonical = [...new Map(requestedLocations
    .map(canonicalBoundaryRequest)
    .filter((location): location is BoundaryRequest => Boolean(location))
    .map((location) => [location.label.toLowerCase(), location] as const)).values()];

  const settled = await Promise.allSettled(canonical.map(fetchBoundary));
  const boundaries = settled.flatMap((result) => (
    result.status === "fulfilled" && result.value ? [result.value] : []
  ));
  const unavailable = canonical
    .filter((_, index) => settled[index]?.status === "rejected" || (
      settled[index]?.status === "fulfilled" && !settled[index].value
    ))
    .map((location) => location.label);

  const hadProviderFailure = settled.some((result) => result.status === "rejected");
  if (hadProviderFailure) {
    console.warn("[Property map] One or more Census boundaries were unavailable.", {
      requestedCount: canonical.length,
      unavailableCount: unavailable.length,
    });
  }

  return Response.json(
    {
      boundaries,
      unavailable,
      source: "U.S. Census Bureau TIGERweb",
    },
    {
      headers: {
        "Cache-Control": hadProviderFailure
          ? "public, max-age=30, s-maxage=300, stale-while-revalidate=600"
          : "public, max-age=3600, s-maxage=2592000, stale-while-revalidate=604800",
      },
    },
  );
}
