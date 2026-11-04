export type ListingResult<T> =
  | { kind: "found"; listing: T }
  | { kind: "not-found" }
  | { kind: "unavailable" };

/** Preserve a temporary server failure instead of publishing a noindex/soft-404 page. */
export class ListingUnavailableError extends Error {
  constructor() {
    super("MLS listing temporarily unavailable. Please retry.");
    this.name = "ListingUnavailableError";
  }
}

/** A failed feed request is not evidence that a property was removed. */
export async function resolveListingResult<T>(
  load: () => Promise<T | null | undefined>,
): Promise<ListingResult<T>> {
  try {
    const listing = await load();
    return listing ? { kind: "found", listing } : { kind: "not-found" };
  } catch {
    return { kind: "unavailable" };
  }
}
