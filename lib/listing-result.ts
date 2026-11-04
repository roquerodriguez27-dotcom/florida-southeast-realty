export type ListingResult<T> =
  | { kind: "found"; listing: T }
  | { kind: "not-found" }
  | { kind: "unavailable" };

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
