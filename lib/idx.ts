/**
 * IDX / MLS integration seam
 * ---------------------------------------------------------------
 * Every page in this app reads listings through the functions in
 * `lib/listings.ts` (getAllListings, getListingBySlug, searchListings).
 * Right now those functions return the mock array in this file's
 * sibling module. To go live with a real feed:
 *
 * 1. Pick a provider: RESO Web API (most MLSs), IDX Broker, or Spark
 *    Platform (FlexMLS). All three expose REST endpoints that return
 *    JSON shaped close to the `Listing` type in `lib/types.ts`.
 *
 * 2. Implement `fetchLiveListings()` below to call that provider,
 *    normalize its field names into `Listing[]`, and cache the
 *    result (ISR via `revalidate`, or a scheduled sync into your
 *    own DB — most brokerages sync nightly + webhook updates).
 *
 * 3. Swap the mock import in `lib/listings.ts` for `fetchLiveListings()`.
 *    No page or component needs to change — they only depend on the
 *    `Listing` type, never on where the data came from.
 *
 * 4. Respect your MLS's Display/IDX rules: required disclaimers,
 *    "last updated" timestamps, and broker attribution. Add those
 *    to `PropertyCard` and the listing detail template once you
 *    know your MLS's exact required copy.
 */

export const IDX_PROVIDER = "not_connected" as const;

export async function fetchLiveListings(): Promise<null> {
  // Placeholder — wire up your RESO Web API / IDX Broker / Spark
  // credentials here when ready. Returning null tells lib/listings.ts
  // to keep serving the local mock dataset.
  return null;
}
