import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { formatPrice, formatMileMarker } from "@/lib/format";
import { savedComparisonListing } from "@/lib/comparison";
import IdxAttribution from "./IdxAttribution";
import CompareToggle from "./CompareToggle";

const STATUS_STYLE: Record<Listing["status"], string> = {
  Active: "bg-seagrass text-sand",
  Pending: "bg-brass text-tide",
  "Coming Soon": "bg-tide text-sand",
  Sold: "bg-ink/70 text-sand",
};

export default function PropertyCard({ listing }: { listing: Listing }) {
  return (
    <article className="overflow-hidden rounded-sm border border-ink/10 bg-white transition-colors hover:border-ink/25">
      <Link href={`/properties/${listing.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={listing.images[0]}
            alt={`${listing.address}, ${listing.city}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <span
            className={`absolute top-3 left-3 text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm ${STATUS_STYLE[listing.status]}`}
          >
            {listing.status}
          </span>
          {listing.waterfront && (
            <span className="absolute top-3 right-3 text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm bg-white/90 text-tide">
              Waterfront
            </span>
          )}
          <span className="absolute bottom-3 right-3 rounded-full bg-tide/90 px-2.5 py-1 text-[11px] font-medium text-sand shadow">
            {listing.images.length} {listing.images.length === 1 ? "photo" : "photos"}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-xl text-ink">{formatPrice(listing.price)}</p>
            {listing.mileMarker > 0 && <span className="mile-marker text-[11px] text-ink/45">{formatMileMarker(listing.mileMarker)}</span>}
          </div>
          <p className="text-sm text-ink/80 mt-1">{listing.address}</p>
          <p className="text-sm text-ink/50">{listing.community}, {listing.city}</p>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink/10 font-mono text-xs text-ink/70">
            <span>{listing.beds} bd</span>
            <span>{listing.baths} ba</span>
            {listing.sqft > 0 && <span>{listing.sqft.toLocaleString()} sqft</span>}
          </div>
          <p className="mt-3 text-sm font-medium text-tide underline decoration-tide/30 underline-offset-4 group-hover:decoration-tide">
            View photos &amp; property details →
          </p>
          <IdxAttribution attribution={listing.idx} compact />
        </div>
      </Link>
      <CompareToggle listing={savedComparisonListing(listing)} />
    </article>
  );
}
