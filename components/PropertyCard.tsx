import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { formatPrice, formatMileMarker } from "@/lib/format";
import { savedComparisonListing } from "@/lib/comparison";
import IdxAttribution from "./IdxAttribution";
import CompareToggle from "./CompareToggle";
import SaveListingButton from "./SaveListingButton";

const STATUS_STYLE: Record<Listing["status"], string> = {
  Active: "bg-seagrass text-sand",
  Pending: "bg-brass text-tide",
  "Coming Soon": "bg-tide text-sand",
  Sold: "bg-ink/70 text-sand",
};

const INVALID_PROPERTY_SLUGS = new Set(["null", "undefined", "false", "nan"]);

function engagementBadges(listing: Listing) {
  const badges: { label: string; className: string }[] = [];
  if (listing.daysOnMarket >= 0 && listing.daysOnMarket <= 3) {
    badges.push({ label: "New", className: "bg-hibiscus text-sand" });
  }
  if (listing.originalListPrice && listing.originalListPrice > listing.price) {
    const drop = listing.originalListPrice - listing.price;
    badges.push({ label: `Price drop ${formatPrice(drop)}`, className: "bg-brass text-tide" });
  }
  if (listing.privatePool) badges.push({ label: "Pool", className: "bg-white/95 text-tide" });
  if (listing.waterfront) badges.push({ label: "Waterfront", className: "bg-white/95 text-tide" });
  if (listing.association === false) badges.push({ label: "No HOA", className: "bg-white/95 text-tide" });
  return badges.slice(0, 3);
}

function validPropertySlug(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length >= 4 && normalized.length <= 300 && !INVALID_PROPERTY_SLUGS.has(normalized);
}

export default function PropertyCard({ listing, returnTo }: { listing: Listing; returnTo?: string }) {
  const savedListing = savedComparisonListing(listing);
  const badges = engagementBadges(listing);
  const propertyHref = validPropertySlug(listing.slug)
    ? `/properties/${encodeURIComponent(listing.slug.trim())}${
        returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
      }`
    : returnTo || "/properties";
  const photoCount = listing.photoCount
    ?? (listing.images[0] === "/property-placeholder.svg" ? 0 : listing.images.length);

  return (
    <article className="relative overflow-hidden rounded-sm border border-ink/10 bg-white transition-all hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_18px_45px_-34px_rgba(14,43,48,0.7)]">
      <SaveListingButton listing={savedListing} />
      <Link href={propertyHref} prefetch={false} className="group block">
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
          {badges.length > 0 ? (
            <div className="absolute bottom-3 left-3 flex max-w-[72%] flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span key={badge.label} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow ${badge.className}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
          {photoCount > 0 ? (
            <span className="absolute bottom-3 right-3 rounded-full bg-tide/90 px-2.5 py-1 text-[11px] font-medium text-sand shadow">
              {photoCount} {photoCount === 1 ? "photo" : "photos"}
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <div className="flex items-baseline justify-between gap-3">
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
      <CompareToggle listing={savedListing} />
    </article>
  );
}
