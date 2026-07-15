import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { formatPrice, formatMileMarker } from "@/lib/format";

const STATUS_STYLE: Record<Listing["status"], string> = {
  Active: "bg-seagrass text-sand",
  Pending: "bg-brass text-tide",
  "Coming Soon": "bg-tide text-sand",
  Sold: "bg-ink/70 text-sand",
};

export default function PropertyCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/properties/${listing.slug}`}
      className="group block bg-white rounded-sm overflow-hidden border border-ink/10 hover:border-ink/25 transition-colors"
    >
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
      </div>

      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-xl text-ink">{formatPrice(listing.price)}</p>
          <span className="mile-marker text-[11px] text-ink/45">{formatMileMarker(listing.mileMarker)}</span>
        </div>
        <p className="text-sm text-ink/80 mt-1">{listing.address}</p>
        <p className="text-sm text-ink/50">{listing.community}, {listing.city}</p>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink/10 font-mono text-xs text-ink/70">
          <span>{listing.beds} bd</span>
          <span>{listing.baths} ba</span>
          <span>{listing.sqft.toLocaleString()} sqft</span>
        </div>
      </div>
    </Link>
  );
}
