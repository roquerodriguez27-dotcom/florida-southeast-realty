import type { Metadata } from "next";
import Link from "next/link";
import CommunityCard from "@/components/CommunityCard";
import { getAllCommunities } from "@/lib/communities";

export const metadata: Metadata = {
  title: "South Florida Homes for Sale by City & Neighborhood Guides",
  description:
    "Explore South Florida homes for sale and real estate guides across Broward and Palm Beach counties, with live BeachesMLS search links for Boca Raton, Delray Beach, Boynton Beach, Wellington, Jupiter, and more.",
  alternates: { canonical: "/communities" },
};

const POPULAR_SEARCHES = [
  "Boca Raton",
  "Delray Beach",
  "Boynton Beach",
  "Lake Worth Beach",
  "West Palm Beach",
  "Wellington",
  "Palm Beach Gardens",
  "Jupiter",
];

export default async function CommunitiesPage() {
  const communities = await getAllCommunities();

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">South Florida Communities</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink mb-3">
          South Florida homes for sale by city and community
        </h1>
        <p className="text-ink/60 max-w-3xl leading-relaxed">
          Compare communities across Broward and Palm Beach counties, browse current BeachesMLS inventory,
          then go beyond the listing with flood maps, schools, property records, permits, ownership-cost tools,
          and other research that can matter before you buy.
        </p>

        <section className="mt-8 rounded-sm border border-tide/15 bg-white p-5 md:p-6" aria-labelledby="popular-home-searches">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">Live MLS shortcuts</p>
              <h2 id="popular-home-searches" className="font-display text-2xl text-ink mt-1">Popular South Florida home searches</h2>
              <p className="text-sm text-ink/55 mt-1">Jump directly into current BeachesMLS inventory, then refine by price, home type, pool, waterfront, HOA, 55+, and more.</p>
            </div>
            <Link href="/properties" className="text-sm text-tide underline underline-offset-4 shrink-0">Search all South Florida homes</Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map((name) => (
              <Link
                key={name}
                href={`/properties?location=${encodeURIComponent(name)}`}
                className="rounded-full border border-tide/20 bg-tide/5 px-3.5 py-2 text-sm font-medium text-tide hover:bg-tide/10"
              >
                {name} homes for sale
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {communities.map((c) => (
            <CommunityCard key={c.slug} community={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
