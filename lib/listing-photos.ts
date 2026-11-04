import "server-only";
import { unstable_cache } from "next/cache";
import { collectListingPhotos, listingKeyFromSlug } from "./listing-photo-pages";

const HOST = "replication.sparkapi.com";
const DEFAULT_BASE = `https://${HOST}/Version/3/Reso/OData`;
const inFlight = new Map<string, Promise<string[]>>();

function providerBase(): string {
  const configured = [process.env.RESO_API_BASE_URL, process.env.IDX_PROVIDER_BASE_URL, process.env.SPARK_API_BASE_URL]
    .find(value => value && /\/Reso\/OData\/?$/i.test(value.trim()));
  const url = new URL(configured?.trim() || DEFAULT_BASE);
  if (url.protocol !== "https:" || url.hostname !== HOST || url.username || url.password) {
    throw new Error("Invalid MLS media provider configuration.");
  }
  return url.toString().replace(/\/$/, "");
}

async function loadPhotos(key: string, expectedCount: number): Promise<string[]> {
  const raw = process.env.RESO_ACCESS_TOKEN ?? process.env.SPARK_ACCESS_TOKEN ?? process.env.IDX_PROVIDER_API_KEY;
  const token = raw?.trim().replace(/^(?:Bearer|OAuth)\s+/i, "");
  if (!token) throw new Error("MLS media is not configured.");
  const deadline = Date.now() + 18_000;
  const base = providerBase();
  const origin = (process.env.IDX_ORIGINATING_SYSTEM_ID?.trim() || "M00000170").replace(/'/g, "''");
  const escaped = key.replace(/'/g, "''");
  return collectListingPhotos(key, expectedCount, async (offset, size) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("MLS gallery deadline exceeded.");
    // Use the same Property + Media expansion already supported by this feed.
    const url = new URL(`${base}/Property`);
    url.searchParams.set("$filter", `OriginatingSystemID eq '${origin}' and ListingKey eq '${escaped}'`);
    url.searchParams.set("$top", "1");
    url.searchParams.set("$expand", `Media($top=${size};$skip=${offset};$orderby=Order)`);
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "User-Agent": "FloridaSoutheastRealty/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(8_000, remaining)),
    });
    if (!response.ok) throw new Error("MLS gallery temporarily unavailable.");
    const body = await response.json() as { value?: Array<{ ListingKey?: string; Media?: unknown[] }> };
    const property = body.value?.[0];
    if (!property || property.ListingKey !== key || !Array.isArray(property.Media)) {
      throw new Error("Invalid MLS gallery response.");
    }
    return property.Media;
  });
}

const cachedPhotos = unstable_cache(
  async (key: string, expectedCount: number, revision: string) => {
    const identity = JSON.stringify([key, expectedCount, revision]);
    const existing = inFlight.get(identity);
    if (existing) return existing;
    const pending = loadPhotos(key, expectedCount);
    inFlight.set(identity, pending);
    try {
      return await pending;
    } finally {
      inFlight.delete(identity);
    }
  },
  ["beaches-mls-on-demand-gallery-v1"],
  { revalidate: 600, tags: ["beaches-mls-listing-details"] },
);

export function getListingPhotos(slug: string, expectedCount: number, revision = ""): Promise<string[]> {
  const key = listingKeyFromSlug(slug);
  if (!key) throw new Error("Invalid listing identifier.");
  return cachedPhotos(key, expectedCount, revision);
}
