const DEFAULT_OVERPASS_URL = "https://overpass.private.coffee/api/interpreter";
const PLACE_CACHE_SECONDS = 86_400;
const MAX_LATITUDE_SPAN = 0.45;
const MAX_LONGITUDE_SPAN = 0.55;
const MAX_PLACES_PER_CATEGORY = 45;

type PlaceCategory = "schools" | "shopping" | "parks" | "healthcare" | "worship";

interface OverpassElement {
  id?: number;
  type?: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function numericParam(params: URLSearchParams, key: string) {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : null;
}

function placeCategory(tags: Record<string, string>): PlaceCategory | null {
  if (["school", "kindergarten", "college", "university"].includes(tags.amenity)) return "schools";
  if (tags.shop || tags.shop === "mall") return "shopping";
  if (["park", "playground", "nature_reserve"].includes(tags.leisure)) return "parks";
  if (["hospital", "clinic", "doctors", "pharmacy", "dentist"].includes(tags.amenity)) return "healthcare";
  if (tags.amenity === "place_of_worship") return "worship";
  return null;
}

function placeDetail(category: PlaceCategory, tags: Record<string, string>) {
  if (category === "worship") return tags.denomination || tags.religion || undefined;
  if (category === "shopping") return tags.shop?.replaceAll("_", " ");
  if (category === "healthcare") return tags.amenity?.replaceAll("_", " ");
  if (category === "schools") return tags.amenity === "school" ? undefined : tags.amenity?.replaceAll("_", " ");
  return tags.leisure?.replaceAll("_", " ");
}

function overpassUrl() {
  return process.env.OVERPASS_API_URL?.trim() || DEFAULT_OVERPASS_URL;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const north = numericParam(params, "north");
  const south = numericParam(params, "south");
  const east = numericParam(params, "east");
  const west = numericParam(params, "west");

  if (
    north === null || south === null || east === null || west === null
    || north > 90 || south < -90 || east > 180 || west < -180
    || north <= south || east <= west
  ) {
    return Response.json({ message: "Invalid map bounds." }, { status: 400 });
  }
  if (north - south > MAX_LATITUDE_SPAN || east - west > MAX_LONGITUDE_SPAN) {
    return Response.json({ message: "Zoom in closer to view nearby places." }, { status: 400 });
  }

  const box = [south, west, north, east].map((value) => value.toFixed(4)).join(",");
  const query = `[out:json][timeout:10];
(
  nwr["amenity"~"^(school|kindergarten|college|university)$"](${box});
  nwr["shop"~"^(supermarket|mall|department_store|convenience|hardware|furniture|home_improvement)$"](${box});
  nwr["leisure"~"^(park|playground|nature_reserve)$"](${box});
  nwr["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"](${box});
  nwr["amenity"="place_of_worship"](${box});
);
out center 300;`;

  try {
    const response = await fetch(overpassUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "FloridaSoutheastRealty/1.0 (nearby property map places)",
      },
      body: new URLSearchParams({ data: query }),
      next: { revalidate: PLACE_CACHE_SECONDS },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Overpass returned HTTP ${response.status}.`);
    const payload = await response.json() as OverpassResponse;
    const categoryCounts = new Map<PlaceCategory, number>();
    const places = (payload.elements ?? []).flatMap((element) => {
      const tags = element.tags ?? {};
      const category = placeCategory(tags);
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      const name = tags.name?.trim();
      if (!category || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      const count = categoryCounts.get(category) ?? 0;
      if (count >= MAX_PLACES_PER_CATEGORY) return [];
      categoryCounts.set(category, count + 1);
      return [{
        id: `${element.type ?? "place"}-${element.id ?? `${lat}-${lng}`}`,
        name: name.slice(0, 120),
        category,
        lat: lat as number,
        lng: lng as number,
        detail: placeDetail(category, tags),
      }];
    });

    return Response.json(
      { places, source: "OpenStreetMap contributors" },
      {
        headers: {
          "Cache-Control": "public, max-age=900, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    console.warn("[Property map] Nearby places were unavailable.", {
      message: error instanceof Error ? error.message : "Unknown nearby-place error",
    });
    return Response.json(
      { message: "Nearby places are temporarily unavailable. Property results are unaffected." },
      {
        status: 503,
        headers: { "Cache-Control": "public, max-age=30, s-maxage=300, stale-while-revalidate=600" },
      },
    );
  }
}
