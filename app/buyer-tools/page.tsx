import type { Metadata } from "next";
import BuyerTools from "@/components/BuyerTools";
import { getAllListings } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Mortgage, Affordability & Property Comparison Tools",
  description: "Compare South Florida homes and estimate mortgage payments, affordability, taxes, insurance, HOA fees, flood insurance, and true monthly ownership costs.",
  alternates: { canonical: "/buyer-tools" },
};

export default async function BuyerToolsPage({ searchParams }: { searchParams: Promise<{ listing?: string; tool?: string }> }) {
  const params = await searchParams;
  const listings = await getAllListings();
  const tool = params.tool === "compare" || params.tool === "affordability" ? params.tool : "cost";

  return (
    <main className="pt-28 md:pt-32 pb-24">
      <section className="container-fsre max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Buyer Decision Tools</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight">Compare the home—and the real cost of owning it.</h1>
        <p className="text-lg text-ink/65 leading-relaxed mt-5 max-w-3xl">Test monthly-cost and affordability scenarios with the Florida expenses that matter, then compare homes side-by-side before deciding what deserves a showing.</p>
      </section>
      <section className="container-fsre mt-10">
        <BuyerTools listings={listings} initialListingSlug={params.listing} initialTool={tool} />
      </section>
    </main>
  );
}
