import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import BuyerTools from "@/components/BuyerTools";
import { getListingBySlug } from "@/lib/listings";
import type { Listing } from "@/lib/types";

interface Props {
  searchParams: Promise<{ listing?: string; tool?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const parameterized = Boolean(params.listing || params.tool);

  return {
    title: "Mortgage, Affordability & Property Comparison Tools",
    description: "Compare South Florida homes and estimate mortgage payments, affordability, taxes, insurance, HOA fees, flood insurance, and true monthly ownership costs.",
    alternates: { canonical: "/buyer-tools" },
    robots: { index: !parameterized, follow: true },
  };
}

const CRAWLER_USER_AGENT = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|googleother|google-inspectiontool|semrush|ahrefs|mj12bot|dotbot)/i;

export default async function BuyerToolsPage({ searchParams }: Props) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const crawlerRequest = CRAWLER_USER_AGENT.test(userAgent);

  // Buyer-tool URLs with a listing parameter canonicalize to /buyer-tools. Search
  // crawlers do not need the live property payload, and skipping that lookup keeps
  // automated crawl bursts from consuming BeachesMLS request capacity.
  let initialListing: Listing | undefined;
  let listingUnavailable = false;
  if (params.listing && !crawlerRequest) {
    try {
      // Calculators need property facts, not every page of the photo gallery.
      initialListing = await getListingBySlug(params.listing, false);
      listingUnavailable = !initialListing;
    } catch {
      listingUnavailable = true;
    }
  }
  const tool = params.tool === "compare" || params.tool === "affordability" ? params.tool : "cost";

  const similarHomesHref = initialListing
    ? `/properties?location=${encodeURIComponent(initialListing.city)}&maxPrice=${Math.ceil(initialListing.price * 1.1)}&sort=newest#property-results`
    : "/properties#property-results";

  return (
    <main className="pt-28 md:pt-32 pb-24">
      <section className="container-fsre max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Buyer Decision Tools</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight">Compare homes and the cost of owning them.</h1>
        <p className="text-lg text-ink/65 leading-relaxed mt-5 max-w-3xl">Test monthly-cost and affordability scenarios with the Florida expenses that matter, then compare homes side-by-side before deciding what deserves a showing.</p>
      </section>
      <section className="container-fsre mt-10">
        {listingUnavailable && (
          <div role="status" className="mb-6 rounded-sm border border-brass/40 bg-brass/10 p-5 text-sm text-ink/80">
            <p className="font-semibold">We could not load the selected home’s details.</p>
            <p className="mt-2">The calculator below uses editable estimates, not figures for the selected home. Confirm the price, taxes and HOA before relying on the result.</p>
            <a href={`/buyer-tools?listing=${encodeURIComponent(params.listing ?? "")}&tool=${tool}`} className="mt-3 inline-block text-tide underline underline-offset-4">Retry loading this home</a>
          </div>
        )}
        <BuyerTools initialListing={initialListing} initialTool={tool} />
      </section>

      <section className="container-fsre mt-10" aria-labelledby="official-property-tax-estimators">
        <div className="rounded-sm border border-tide/15 bg-white p-6 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">Official county resources</p>
          <h2 id="official-property-tax-estimators" className="mt-2 font-display text-2xl md:text-3xl text-ink">
            Estimate property taxes after a purchase
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-ink/70">
            The seller’s current tax bill may not reflect what you pay after purchasing a home.
            For a more informed monthly-cost plan, use the property appraiser’s official tool
            for the county where the home is located. These open on county websites.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                county: "Palm Beach County",
                href: "https://pbcpao.gov/Property/TaxCalculator",
                note: "Search by property address or parcel number, then estimate with your planned purchase price and homestead status.",
              },
              {
                county: "Broward County",
                href: "https://web.bcpa.net/BcpaClient/TaxEst.aspx",
                note: "Enter a prospective purchase price and applicable exemptions. A specific property record may give a more tailored estimate.",
              },
              {
                county: "Miami-Dade County",
                href: "https://apps.miamidadepa.gov/PAOnlineTools/Taxes/TaxEstimator.aspx",
                note: "Estimate using county tax rates and review the effects of a sale, homestead eligibility and assessments.",
              },
            ].map((county) => (
              <a
                key={county.county}
                href={county.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-sm border border-ink/10 p-5 transition-colors hover:border-tide/40 hover:bg-keystone/40"
              >
                <h3 className="font-display text-lg text-tide">{county.county}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{county.note}</p>
                <span className="mt-4 inline-block text-sm font-medium text-tide underline underline-offset-4">
                  Open official tax estimator
                </span>
              </a>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-ink/60">
            County estimates are for planning, not a guaranteed future tax bill. Assessed value
            can reset following a sale; tax rates, exemptions, eligibility, portability and
            non-ad valorem assessments may change the total. Confirm the specific property
            and intended tax year with the county property appraiser. Future-year or
            Amendment 3 scenarios must not be treated as certified tax bills.
          </p>
        </div>
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
            <Link prefetch={false} href={similarHomesHref} rel="nofollow" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-5 py-3 rounded-sm transition-colors">
              See Matching Homes
            </Link>
            <Link prefetch={false} href="/contact" className="border border-tide/25 text-tide font-medium text-center px-5 py-3 rounded-sm hover:bg-white transition-colors">
              Ask Roque to Help
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
