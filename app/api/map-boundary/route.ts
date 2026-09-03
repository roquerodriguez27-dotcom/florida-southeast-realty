const CENSUS_BASE_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";
const FLORIDA_STATE_FIPS = "12";
const BOUNDARY_CACHE_SECONDS = 60 * 60 * 24 * 30;

type BoundaryKind = "ZIP" | "City/Town" | "County";

type GeoJsonGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

type CensusFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: GeoJsonGeometry | null;
};

type CensusResponse = {
  type?: string;
  features?: CensusFeature[];
  error?: { message?: string };
};

type BoundaryResult = {
  kind: BoundaryKind;
  label: string;
  geometry: GeoJsonGeometry;
};

function normalizeLocation(value: string | null) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
}

function isSafeLocation(value: string) {
  return value.length > 0 && /^[\p{L}\p{N} .,'’-]+$/u.test(value);
}

function censusLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function isBoundaryGeometry(value: unknown): value is GeoJsonGeometry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeoJsonGeometry>;
  return (candidate.type === "Polygon" || candidate.type === "MultiPolygon")
    && Array.isArray(candidate.coordinates);
}

async function queryLayer(layerPath: string, where: string): Promise<CensusFeature | null> {
  const query = new URLSearchParams({
    where,
    outFields: "NAME,BASENAME,GEOID",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "5",
    maxAllowableOffset: "0.0001",
    resultRecordCount: "1",
    f: "geojson",
  });
  const response = await fetch(`${CENSUS_BASE_URL}/${layerPath}/query?${query.toString()}`, {
    next: { revalidate: BOUNDARY_CACHE_SECONDS },
  });
  if (!response.ok) throw new Error(`Census boundary request failed (${response.status})`);
  const data = await response.json() as CensusResponse;
  if (data.error) throw new Error(data.error.message || "Census boundary request failed");
  const feature = data.features?.[0];
  return feature && isBoundaryGeometry(feature.geometry) ? feature : null;
}

async function findBoundary(location: string): Promise<BoundaryResult | null> {
  const zipMatch = location.match(/^(\d{5})(?:-\d{4})?$/);
  if (zipMatch) {
    const zip = zipMatch[1];
    const feature = await queryLayer(
      "PUMA_TAD_TAZ_UGA_ZCTA/MapServer/11",
      `ZCTA5='${zip}'`,
    );
    return feature?.geometry ? { kind: "ZIP", label: `ZIP ${zip}`, geometry: feature.geometry } : null;
  }

  const countyMatch = location.match(/^(.+?)\s+County$/i);
  if (countyMatch) {
    const county = countyMatch[1].trim();
    const countyLookup = censusLiteral(county.toUpperCase());
    const feature = await queryLayer(
      "State_County/MapServer/1",
      `STATE='${FLORIDA_STATE_FIPS}' AND UPPER(BASENAME)='${countyLookup}'`,
    );
    return feature?.geometry ? { kind: "County", label: `${county} County`, geometry: feature.geometry } : null;
  }

  const placeName = location.toLowerCase() === "lake worth" ? "Lake Worth Beach" : location;
  const place = censusLiteral(placeName.toUpperCase());
  for (const layer of [4, 5]) {
    const feature = await queryLayer(
      `Places_CouSub_ConCity_SubMCD/MapServer/${layer}`,
      `STATE='${FLORIDA_STATE_FIPS}' AND UPPER(BASENAME)='${place}'`,
    );
    if (feature?.geometry) {
      return { kind: "City/Town", label: location, geometry: feature.geometry };
    }
  }
  return null;
}

export async function GET(request: Request) {
  const location = normalizeLocation(new URL(request.url).searchParams.get("location"));
  if (!isSafeLocation(location)) {
    return Response.json({ error: "Enter a valid ZIP code, city/town, or Florida county." }, { status: 400 });
  }

  try {
    const boundary = await findBoundary(location);
    if (!boundary) {
      return Response.json(
        { error: "No official boundary was found for this location." },
        {
          status: 404,
          headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
        },
      );
    }
    return Response.json(boundary, {
      headers: {
        "Cache-Control": `public, s-maxage=${BOUNDARY_CACHE_SECONDS}, stale-while-revalidate=604800`,
      },
    });
  } catch (error) {
    console.error("Map boundary lookup failed", error);
    return Response.json({ error: "The map boundary is temporarily unavailable." }, { status: 502 });
  }
}
