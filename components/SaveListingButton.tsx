"use client";

import type { MouseEvent } from "react";
import type { SavedComparisonListing } from "@/lib/comparison";
import { trackSiteEvent } from "@/components/SiteAnalytics";
import { toggleSavedListing, useSavedListings } from "@/components/useSavedListings";

export default function SaveListingButton({
  listing,
  variant = "card",
}: {
  listing: SavedComparisonListing;
  variant?: "card" | "detail";
}) {
  const savedListings = useSavedListings();
  const saved = savedListings.some((item) => item.slug === listing.slug);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const action = toggleSavedListing(listing);
    trackSiteEvent("compare_change", {
      action: action === "added" ? "save_home" : "unsave_home",
      surface: variant,
      listingId: listing.mlsId,
    });
  }

  if (variant === "detail") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-medium transition-colors ${
          saved
            ? "border-hibiscus/30 bg-hibiscus/10 text-hibiscus"
            : "border-tide/25 text-tide hover:bg-tide/5"
        }`}
      >
        <span aria-hidden="true" className="text-lg leading-none">{saved ? "♥" : "♡"}</span>
        {saved ? "Saved" : "Save home"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? `Remove ${listing.address} from saved homes` : `Save ${listing.address}`}
      aria-pressed={saved}
      title={saved ? "Saved home" : "Save home"}
      className={`absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border text-xl shadow-md backdrop-blur transition-transform hover:scale-105 ${
        saved
          ? "border-hibiscus/25 bg-white text-hibiscus"
          : "border-white/70 bg-white/95 text-tide"
      }`}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
    </button>
  );
}
