"use client";

import { MAX_COMPARE_LISTINGS, type SavedComparisonListing } from "@/lib/comparison";
import {
  toggleComparisonListing,
  useComparisonListings,
} from "@/components/useComparisonListings";

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
    ? "border border-tide/25 text-tide px-4 py-2.5 rounded-sm text-sm font-medium hover:bg-tide/5 disabled:cursor-not-allowed disabled:opacity-55"
    : "w-full border-t border-ink/10 px-4 py-3 text-sm font-medium text-tide hover:bg-tide/5 disabled:cursor-not-allowed disabled:text-ink/40";

  return (
    <button
      type="button"
      disabled={atLimit}
      aria-pressed={selected}
      title={atLimit ? "Remove a selected home before adding another." : undefined}
      onClick={() => toggleComparisonListing(listing)}
      className={baseClass}
    >
      {selected ? "✓ Added to compare" : atLimit ? "3 homes already selected" : "+ Add to compare"}
    </button>
  );
}
