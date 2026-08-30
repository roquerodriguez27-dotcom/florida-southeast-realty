import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import BuyerTools from "@/components/BuyerTools";
import { getListingBySlug } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Mortgage, Affordability & Property Comparison Tools",
  description: "Compare South Florida homes and estimate mortgage payments, affordability, taxes, insurance, HOA fees, flood insurance, and true monthly ownership costs.",
  alternates: { canonical: "/buyer-tools" },
};

const CRAWLER_USER_AGENT = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|googleother|google-inspectiontool|semrush|ahrefs|mj12bot|dotbot)/i;

export default async function BuyerToolsPage({ searchParams }: { searchParams: Promise<{ listing?: string; tool?: string }> }) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const crawlerRequest = CRAWLER_USER_AGENT.test(userAgent);

  // Buyer-tool URLs with a listing parameter canonicalize to /buyer-tools. Search
  // crawlers do not need the live property payload, and skipping that lookup keeps
  // automated crawl bursts from consuming BeachesMLS request capacity.
  const initialListing = params.listing && !crawlerRequest
    ? await getListingBySlug(params.listing)
    : undefined;
  const tool = params.tool === "compare" || params.tool === "affordability" ? params.tool : "cost";

  const similarHomesHref = initialListing
    ? `/properties?location=${encodeURIComponent(initialListing.city)}&maxPrice=${Math.ceil(initialListing.price * 1.1)}&sort=newest#property-results`
    : "/properties#property-results";

  return (
    <main className="pt-28 md:pt-32 pb-24">
      <section className="container-fsre max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Buyer Decision Tools</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight">Compare the home—and the real cost of owning it.</h1>
        <p className="text-lg text-ink/65 leading-relaxed mt-5 max-w-3xl">Test monthly-cost and affordability scenarios with the Florida expenses that matter, then compare homes side-by-side before deciding what deserves a showing.</p>
      </section>
      <section className="container-fsre mt-10">
        <BuyerTools initialListing={initialListing} initialTool={tool} />
      </section>

      <section className="container-fsre mt-10" aria-label="Next step">
        <div className="rounded-sm border border-tide/15 bg-keystone p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">Turn the numbers into a home search</p>
            <h2 className="font-display text-2xl md:text-3xl text-ink mt-2">
              {initialListing ? `See more homes around ${initialListing.city} that fit this price range.` : "See homes that fit the budget you just worked through."}
            </h2>
            <p className="text-sm text-ink/60 mt-2">Open current BeachesMLS inventory, refine the search, then save it for new listings and price changes.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href={similarHomesHref} className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-5 py-3 rounded-sm transition-colors">
              See Matching Homes
            </Link>
            <Link href="/contact" className="border border-tide/25 text-tide font-medium text-center px-5 py-3 rounded-sm hover:bg-white transition-colors">
              Ask Roque to Help
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
