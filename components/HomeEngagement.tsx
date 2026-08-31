"use client";

import type { SavedComparisonListing } from "@/lib/comparison";
import ContinueSearchCard from "@/components/ContinueSearchCard";
import ForYouRail from "@/components/ForYouRail";

export default function HomeEngagement({ listings }: { listings: SavedComparisonListing[] }) {
  return (
    <>
      <ContinueSearchCard />
      <ForYouRail listings={listings} />
    </>
  );
}
