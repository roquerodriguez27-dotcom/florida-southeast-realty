"use client";

import Image from "next/image";
import Link from "next/link";
import type { SavedComparisonListing } from "@/lib/comparison";
import { formatPrice } from "@/lib/format";
import { useSavedListings } from "@/components/useSavedListings";

function scoreListing(listing: SavedComparisonListing, saved: SavedComparisonListing[]) {
  if (saved.some((item) => item.slug === listing.slug)) return -1;
  const averagePrice = saved.reduce((sum, item) => sum + item.price, 0) / saved.length;
  let score = 0;
  if (saved.some((item) => item.city.toLowerCase() === listing.city.toLowerCase())) score += 6;
  if (saved.some((item) => item.propertyType === listing.propertyType)) score += 4;
  if (saved.some((item) => item.waterfront === listing.waterfront)) score += 2;
  if (averagePrice > 0 && Math.abs(listing.price - averagePrice) / averagePrice <= 0.2) score += 4;
  if (saved.some((item) => Math.abs(item.beds - listing.beds) <= 1)) score += 2;
  return score;
}

function recommendationReason(listing: SavedComparisonListing, saved: SavedComparisonListing[]) {
  if (saved.some((item) => item.city.toLowerCase() === listing.city.toLowerCase())) return `More in ${listing.city}`;
  if (saved.some((item) => item.propertyType === listing.propertyType)) return `Similar ${listing.propertyType.toLowerCase()} option`;
  const averagePrice = saved.reduce((sum, item) => sum + item.price, 0) / saved.length;
  if (averagePrice > 0 && listing.price < averagePrice) return "Similar search, lower price";
  return "Based on homes you saved";
}

export default function ForYouRail({ listings }: { listings: SavedComparisonListing[] }) {
  const saved = useSavedListings();
  if (saved.length === 0) return null;

  const recommendations = listings
    .map((listing) => ({ listing, score: scoreListing(listing, saved) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.listing.price - right.listing.price)
    .slice(0, 3);

  if (recommendations.length === 0) return null;

  return (
    <section className="container-fsre py-10 md:py-14" aria-labelledby="for-you-heading">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">For you</p>
          <h2 id="for-you-heading" className="mt-1 font-display text-2xl md:text-3xl text-ink">Homes picked from what you saved</h2>
          <p className="mt-1 text-sm text-ink/55">Your saved homes stay private in this browser and help us surface more relevant options.</p>
        </div>
        <Link href="/properties" className="text-sm text-tide underline underline-offset-4">See all homes</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {recommendations.map(({ listing }) => (
          <Link key={listing.slug} href={`/properties/${listing.slug}`} className="group overflow-hidden rounded-sm border border-ink/10 bg-white hover:border-tide/25">
            <div className="relative aspect-[4/3] bg-keystone-dim">
              <Image
                src={listing.image || "/property-placeholder.svg"}
                alt={listing.address}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-tide shadow">
                {recommendationReason(listing, saved)}
              </span>
            </div>
            <div className="p-4">
              <p className="font-display text-xl text-ink">{formatPrice(listing.price)}</p>
              <p className="mt-1 text-sm text-ink/75">{listing.address}</p>
              <p className="mt-2 text-xs text-ink/55">{listing.beds} bd · {listing.baths} ba{listing.sqft > 0 ? ` · ${listing.sqft.toLocaleString()} sqft` : ""}</p>
              <p className="mt-3 text-sm font-medium text-tide underline decoration-tide/25 underline-offset-4">See why it may fit →</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
