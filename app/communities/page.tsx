import type { Metadata } from "next";
import Link from "next/link";
import CommunityCard from "@/components/CommunityCard";
import { getAllCommunities } from "@/lib/communities";
import { FEATURED_SEARCH_MARKETS } from "@/lib/seo/search-markets";

export const metadata: Metadata = {
  title: "South Florida Homes for Sale by City & Neighborhood Guides",
  description:
    "Explore South Florida homes for sale and real estate guides across Broward and Palm Beach counties, with live BeachesMLS search links for Boca Raton, Delray Beach, Boynton Beach, Wellington, Jupiter, and more.",
  alternates: { canonical: "/communities" },
};

const POPULAR_SEARCHES = [
  { name: "Boca Raton", slug: "boca-raton" },
  { name: "Delray Beach", slug: "delray-beach" },
  { name: "Boynton Beach", slug: "boynton-beach" },
  { name: "Lake Worth Beach", slug: "lake-worth-beach" },
  { name: "West Palm Beach", slug: "west-palm-beach" },
  { name: "Wellington", slug: "wellington" },
  { name: "Palm Beach Gardens", slug: "palm-beach-gardens" },
  { name: "Jupiter", slug: "jupiter" },
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
            {POPULAR_SEARCHES.map((market) => (
              <Link
                key={market.slug}
                href={`/communities/${market.slug}`}
                className="rounded-full border border-tide/20 bg-tide/5 px-3.5 py-2 text-sm font-medium text-tide hover:bg-tide/10"
              >
                {market.name} homes for sale
              </Link>
            ))}
          </div>
          <div className="mt-6 border-t border-ink/10 pt-5">
            <h3 className="font-display text-xl text-ink">Browse homes by county and ZIP code</h3>
            <p className="mt-1 text-sm text-ink/55">Use these permanent local pages for targeted search options, buyer research, and direct access to current BeachesMLS inventory.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FEATURED_SEARCH_MARKETS.map((market) => (
                <Link
                  key={market.slug}
                  href={`/homes-for-sale/${market.slug}`}
                  className="rounded-full border border-ink/15 bg-sand/40 px-3.5 py-2 text-sm font-medium text-ink/75 hover:border-tide/30 hover:text-tide"
                >
                  {market.kind === "zip" ? `${market.name} homes for sale` : `${market.name} homes`}
                </Link>
              ))}
            </div>
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
