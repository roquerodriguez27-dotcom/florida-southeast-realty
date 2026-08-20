"use client";

import Link from "next/link";
import { MAX_COMPARE_LISTINGS } from "@/lib/comparison";
import {
  clearComparisonListings,
  useComparisonListings,
} from "@/components/useComparisonListings";

export default function CompareTray() {
  const listings = useComparisonListings();
  if (listings.length === 0) return null;

  return (
    <aside
      aria-label="Selected homes for comparison"
      className="fixed z-50 left-3 right-3 md:left-1/2 md:right-auto md:w-[min(760px,calc(100%-2rem))] md:-translate-x-1/2 rounded-sm border border-brass/40 bg-tide text-sand shadow-2xl"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium">{listings.length} of {MAX_COMPARE_LISTINGS} homes selected</p>
          <p className="hidden sm:block truncate text-xs text-sand/60">
            {listings.map((listing) => listing.address).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {listings.length < MAX_COMPARE_LISTINGS && (
            <Link href="/properties" className="px-3 py-2 text-sand/80 underline underline-offset-4">
              Choose more
            </Link>
          )}
          <button type="button" onClick={clearComparisonListings} className="px-2 py-2 text-sand/60 underline underline-offset-4">
            Clear
          </button>
          <Link href="/buyer-tools?tool=compare" className="rounded-sm bg-brass px-4 py-2 font-medium text-tide">
            Compare now
          </Link>
        </div>
      </div>
    </aside>
  );
}
