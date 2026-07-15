import type { Listing } from "@/lib/types";
import PropertyCard from "./PropertyCard";

export default function PropertyGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-ink/20 rounded-sm">
        <p className="font-display text-xl text-ink/70">No homes match those filters yet.</p>
        <p className="text-sm text-ink/50 mt-2">
          Widen your price range or clear a filter — or tell an agent what you&apos;re after and
          we&apos;ll watch the feed for you.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((listing) => (
        <PropertyCard key={listing.mlsId} listing={listing} />
      ))}
    </div>
  );
}
