import type { Metadata } from "next";
import CommunityCard from "@/components/CommunityCard";
import { getAllCommunities } from "@/lib/communities";

export const metadata: Metadata = {
  title: "South Florida Communities & Neighborhood Guides",
  description:
    "Explore South Florida community guides across Broward and Palm Beach counties, including Fort Lauderdale, Boca Raton, Delray Beach, Boynton Beach, Wellington, Jupiter, and more.",
  alternates: { canonical: "/communities" },
};

export default async function CommunitiesPage() {
  const communities = await getAllCommunities();

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">South Florida Communities</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink mb-3">
          Find the part of South Florida that fits your life
        </h1>
        <p className="text-ink/60 max-w-3xl mb-10 leading-relaxed">
          Compare communities across Broward and Palm Beach counties, then go beyond the listing
          with links to flood maps, schools, property records, permits, transportation, and other
          research that can matter before you buy.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.map((c) => (
            <CommunityCard key={c.slug} community={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
