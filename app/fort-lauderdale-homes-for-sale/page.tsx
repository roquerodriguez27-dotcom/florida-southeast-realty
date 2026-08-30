import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import PropertyGrid from "@/components/PropertyGrid";
import ResearchLinks from "@/components/ResearchLinks";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import Tideline from "@/components/Tideline";
import { searchListingPage } from "@/lib/listings";
import { SITE } from "@/lib/site-config";
import { serializeJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Fort Lauderdale FL Homes for Sale | Live BeachesMLS Search",
  description:
    "Browse Fort Lauderdale, Florida homes for sale from the live BeachesMLS feed. Search condos, single-family homes, waterfront property, pools, price ranges, and neighborhoods with Florida Southeast Realty.",
  alternates: { canonical: "/fort-lauderdale-homes-for-sale" },
};

const NEIGHBORHOODS = [
  { name: "Las Olas", href: "/communities/las-olas", detail: "Downtown, New River, condos, marinas and walkable dining." },
  { name: "Coral Ridge", href: "/communities/coral-ridge", detail: "Single-family homes, waterfront streets and Intracoastal access." },
  { name: "Wilton Manors", href: "/communities/wilton-manors", detail: "Central Broward homes, townhomes, condos and canal-front options." },
  { name: "Lauderdale-by-the-Sea", href: "/communities/lauderdale-by-the-sea", detail: "Beachside condos, low-rise areas and Atlantic access." },
];

export default async function FortLauderdaleHomesPage() {
  await connection();
  const result = await searchListingPage({ locations: ["Fort Lauderdale"], sort: "newest" });
  const total = result.pagination.totalRows;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Fort Lauderdale FL Homes for Sale",
        description: "Current Fort Lauderdale homes for sale and buyer research from Florida Southeast Realty.",
        url: `${SITE.url}/fort-lauderdale-homes-for-sale`,
        about: { "@type": "City", name: "Fort Lauderdale", containedInPlace: { "@type": "State", name: "Florida" } },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Fort Lauderdale Homes for Sale", item: `${SITE.url}/fort-lauderdale-homes-for-sale` },
        ],
      },
    ],
  };

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <section className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Fort Lauderdale Real Estate</p>
        <h1 className="font-display text-4xl md:text-6xl text-ink leading-tight">Fort Lauderdale, FL homes for sale</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink/65">
          Browse current Fort Lauderdale inventory from BeachesMLS, then refine your search by price, beds, baths,
          property type, waterfront, private pool, HOA, square footage, time on market, and other available MLS criteria.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link href="/properties?location=Fort%20Lauderdale" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-5 py-3 rounded-sm transition-colors">
            Search All Fort Lauderdale Homes
          </Link>
          <Link href="/buyer-tools" className="border border-tide/25 text-tide font-medium text-center px-5 py-3 rounded-sm hover:bg-tide/5 transition-colors">
            Compare Monthly Ownership Costs
          </Link>
        </div>
      </section>

      <section className="container-fsre mt-12 rounded-sm border border-tide/15 bg-white p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">Live BeachesMLS inventory</p>
            <h2 className="font-display text-2xl md:text-3xl text-ink mt-1">
              {total > 0 ? `${total.toLocaleString("en-US")} Fort Lauderdale listings found` : "Fort Lauderdale listing search"}
            </h2>
            <p className="text-sm text-ink/55 mt-1">Newest and recently updated listings are shown first.</p>
          </div>
          <Link href="/properties?location=Fort%20Lauderdale" className="text-sm text-tide underline underline-offset-4">Open full Fort Lauderdale search</Link>
        </div>

        <div className="mt-6">
          {result.listings.length > 0 ? (
            <PropertyGrid listings={result.listings} />
          ) : (
            <div className="rounded-sm border border-ink/10 bg-sand/35 p-6">
              <p className="font-display text-xl text-ink">No Fort Lauderdale listings are available in this view right now.</p>
              <p className="text-sm text-ink/60 mt-2">Inventory changes throughout the day. Open the full search to adjust criteria or save a search for automatic updates.</p>
            </div>
          )}
        </div>
      </section>

      <div className="container-fsre my-12"><Tideline /></div>

      <section className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus mb-2">Neighborhoods</p>
        <h2 className="font-display text-2xl md:text-3xl text-ink">Explore Fort Lauderdale and nearby markets</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">Use the neighborhood guides for context, then verify property-specific flood, permit, HOA, insurance, tax, and school information before making a decision.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NEIGHBORHOODS.map((area) => (
            <Link key={area.name} href={area.href} className="rounded-sm border border-ink/10 bg-white p-5 hover:border-tide/30 transition-colors">
              <h3 className="font-display text-xl text-ink">{area.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{area.detail}</p>
              <span className="mt-3 inline-block text-xs font-medium text-tide">Open guide →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-fsre mt-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus mb-2">Buyer Due Diligence</p>
            <h2 className="font-display text-2xl md:text-3xl text-ink">Research before you buy in Fort Lauderdale</h2>
          </div>
          <Link href="/research" className="text-sm text-tide underline underline-offset-4">Open full research center</Link>
        </div>
        <ResearchLinks limit={4} />
      </section>

      <div className="mt-16"><LeadCaptureBand /></div>
    </div>
  );
}
