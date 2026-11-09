import type { Listing } from "@/lib/types";
import PropertyCard from "./PropertyCard";

export default function PropertyGrid({ listings, compact = false, returnTo }: { listings: Listing[]; compact?: boolean; returnTo?: string }) {
  if (listings.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-ink/20 rounded-sm">
        <p className="font-display text-xl text-ink/70">No homes match those filters yet.</p>
        <p className="text-sm text-ink/50 mt-2">
          Try widening your price range or clearing a filter. You can also tell us what
          you&apos;re looking for.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-5 ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {listings.map((listing) => (
        <PropertyCard key={listing.mlsId} listing={listing} returnTo={returnTo} />
      ))}
    </div>
  );
}
