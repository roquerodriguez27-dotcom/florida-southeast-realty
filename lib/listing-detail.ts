import "server-only";
import { fetchLiveListingBySlug, IDX_PROVIDER } from "./idx";
import { getListingBySlug } from "./listings";
import { resolveListingResult } from "./listing-result";
import type { ListingResult } from "./listing-result";
import type { Listing } from "./types";

/** Load the property and initial photos only. Full galleries are requested on demand. */
export function getListingDetail(slug: string): Promise<ListingResult<Listing>> {
  return resolveListingResult(() => IDX_PROVIDER === "not_connected"
    ? getListingBySlug(slug, false)
    : fetchLiveListingBySlug(slug, false));
}
