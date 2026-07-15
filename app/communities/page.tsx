import type { Metadata } from "next";
import CommunityCard from "@/components/CommunityCard";
import { getAllCommunities } from "@/lib/communities";

export const metadata: Metadata = {
  title: "Communities | Southeast Florida Neighborhood Guides",
  description:
    "Explore Southeast Florida's coastal communities from Hillsboro Beach to Boca Raton, ordered along the Intracoastal corridor.",
};

export default async function CommunitiesPage() {
  const communities = await getAllCommunities();

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Communities</p>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">
          The corridor, mile marker by mile marker
        </h1>
        <p className="text-ink/60 max-w-2xl mb-10">
          We&apos;ve ordered these the way the coast actually reads — south to north along the
          Intracoastal, the same reference locals use to give directions.
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
