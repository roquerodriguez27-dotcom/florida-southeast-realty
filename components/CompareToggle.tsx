"use client";

import { MAX_COMPARE_LISTINGS, type SavedComparisonListing } from "@/lib/comparison";
import {
  toggleComparisonListing,
  useComparisonListings,
} from "@/components/useComparisonListings";
import { trackSiteEvent } from "@/components/SiteAnalytics";

export default function CompareToggle({
  listing,
  variant = "card",
}: {
  listing: SavedComparisonListing;
  variant?: "card" | "detail";
}) {
  const selectedListings = useComparisonListings();
  const selected = selectedListings.some((item) => item.slug === listing.slug);
  const atLimit = !selected && selectedListings.length >= MAX_COMPARE_LISTINGS;

  const baseClass = variant === "detail"
    ? "inline-flex cursor-pointer items-center gap-2.5 rounded-sm border border-tide/25 px-4 py-2.5 text-sm font-medium text-tide hover:bg-tide/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55"
    : "flex w-full cursor-pointer items-center gap-2.5 border-t border-ink/10 px-4 py-3 text-sm font-medium text-tide hover:bg-tide/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ink/40";

  return (
    <label
      title={atLimit ? "Remove a selected home before adding another." : undefined}
      className={baseClass}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={atLimit}
        onChange={() => {
          toggleComparisonListing(listing);
          trackSiteEvent("compare_change", { action: selected ? "remove" : "add", listing: listing.slug });
        }}
        className="h-5 w-5 shrink-0 accent-hibiscus"
        aria-label={`${selected ? "Remove" : "Add"} ${listing.address} ${selected ? "from" : "to"} comparison`}
      />
      <span>{selected ? "Selected for comparison" : atLimit ? "3 homes already selected" : "Compare this home"}</span>
    </label>
  );
}
