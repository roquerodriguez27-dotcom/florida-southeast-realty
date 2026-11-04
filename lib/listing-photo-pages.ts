type MediaRecord = Record<string, unknown>;
export const PHOTO_PAGE_SIZE = 100;
export const MAX_PHOTO_PAGES = 10;

export function listingKeyFromSlug(slug: string): string | null {
  if (slug.length > 300 || !slug.includes("--")) return null;
  const encoded = slug.split("--").at(-1) ?? "";
  if (!/^[A-Za-z0-9_-]{4,300}$/.test(encoded)) return null;
  try {
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.toString("base64url") !== encoded) return null;
    const key = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return key.length <= 200 && /^[\x20-\x7e]+$/.test(key) ? key : null;
  } catch {
    return null;
  }
}

function object(value: unknown): MediaRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as MediaRecord : {};
}

function text(record: MediaRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function photoUrl(record: MediaRecord): string | null {
  const category = text(record, ["MediaCategory", "Category", "MediaType"]).toLowerCase();
  const mime = text(record, ["MimeType", "MediaType"]).toLowerCase();
  if (category && !category.includes("photo") && !category.includes("image") && !mime.startsWith("image/")) return null;
  const raw = text(record, ["MediaURL", "MediaUrl", "Uri1600", "Uri1280", "Uri1024", "UriLarge", "Uri800", "Uri640", "Uri300", "UriThumb", "URL", "Uri"]);
  try {
    const url = new URL(raw.replace(/^http:\/\//i, "https://"));
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Reject incomplete/repeated pages so a partial gallery never replaces a good cache entry. */
export async function collectListingPhotos(
  listingKey: string,
  expectedCount: number,
  loadPage: (offset: number, size: number) => Promise<unknown[]>,
): Promise<string[]> {
  const urls: string[] = [];
  const seenUrls = new Set<string>();
  const seenRows = new Set<string>();
  const expected = Math.max(0, Math.floor(expectedCount) || 0);
  let offset = 0;
  for (let page = 0; page < MAX_PHOTO_PAGES; page += 1) {
    const rows = await loadPage(offset, PHOTO_PAGE_SIZE);
    if (!Array.isArray(rows)) throw new Error("Invalid MLS media response.");
    if (rows.length === 0) {
      if (urls.length < expected) throw new Error("Incomplete MLS gallery.");
      return urls;
    }
    offset += rows.length;
    let newRows = 0;
    for (const value of rows) {
      const record = object(value);
      const owner = text(record, ["ResourceRecordKey", "ListingKey"]);
      if (owner && owner !== listingKey) throw new Error("Mismatched MLS media owner.");
      const identity = text(record, ["MediaKey", "MediaObjectID", "MediaURL", "MediaUrl"]) || JSON.stringify(record);
      if (seenRows.has(identity)) continue;
      seenRows.add(identity);
      newRows += 1;
      const url = photoUrl(record);
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        urls.push(url);
      }
    }
    if (expected > 0 && urls.length >= expected) return urls;
    if (newRows === 0) throw new Error("MLS media pagination did not advance.");
    // Some feeds cap $top below the requested size. Keep paging by actual rows.
  }
  throw new Error("MLS gallery exceeded the bounded page limit.");
}
