import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import ResearchLinks from "@/components/ResearchLinks";
import Tideline from "@/components/Tideline";
import { getSearchMarket, SEARCH_MARKETS } from "@/lib/seo/search-markets";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import { SITE } from "@/lib/site-config";

interface Props {
  params: Promise<{ market: string }>;
}

const SEARCH_SHORTCUTS = [
  { label: "Single-family homes", filter: { key: "type", value: "Single Family" } },
  { label: "Condos", filter: { key: "type", value: "Condo" } },
  { label: "Homes with pools", filter: { key: "pool", value: "1" } },
  { label: "Waterfront homes", filter: { key: "waterfront", value: "1" } },
  { label: "55+ communities", filter: { key: "senior", value: "only" } },
  { label: "No-HOA homes", filter: { key: "noHoa", value: "1" } },
] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return SEARCH_MARKETS.map((market) => ({ market: market.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market: slug } = await params;
  const market = getSearchMarket(slug);
  if (!market) return {};

  const canonical = `/homes-for-sale/${market.slug}`;
  return {
    title: market.title,
    description: market.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: market.title,
      description: market.description,
      url: canonical,
    },
  };
}

function searchHref(searchValue: string, filter?: { key: string; value: string }) {
  const params = new URLSearchParams({ location: searchValue });
  if (filter) params.set(filter.key, filter.value);
  return `/properties?${params.toString()}`;
}

export default async function SearchMarketPage({ params }: Props) {
  const { market: slug } = await params;
  const market = getSearchMarket(slug);
  if (!market) notFound();

  const canonicalUrl = `${SITE.url}/homes-for-sale/${market.slug}`;
  const liveSearchHref = searchHref(market.searchValue);
  const faqItems = [
    {
      question: `Where can I find current homes for sale in ${market.name}?`,
      answer: `Use Florida Southeast Realty's live BeachesMLS search for ${market.searchValue}. You can refine current inventory by price, beds, baths, property type, pool, waterfront, HOA, age restrictions, square footage, and other available MLS criteria.`,
    },
    {
      question: `What should I verify before buying in ${market.name}?`,
      answer: "Verify the facts for the individual address, including flood information, insurance, taxes, permits, school assignments, association or condo documents, reserves, assessments, restrictions, and any club or membership obligations.",
    },
    {
      question: `Can I compare the monthly cost of homes in ${market.name}?`,
      answer: "Yes. The Buyer Tools can compare up to three properties and estimate mortgage, property taxes, insurance, flood coverage, HOA or condo fees, PMI, and other assessments in one monthly-cost view.",
    },
  ];
  const aboutPlace = market.kind === "zip"
    ? {
        "@type": "Place",
        name: `${market.name}, Florida`,
        address: {
          "@type": "PostalAddress",
          postalCode: market.postalCode,
          addressRegion: "FL",
          addressCountry: "US",
        },
        containedInPlace: { "@type": "AdministrativeArea", name: "Palm Beach County, Florida" },
      }
    : { "@type": "AdministrativeArea", name: `${market.name}, Florida` };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: market.title,
        description: market.description,
        url: canonicalUrl,
        about: aboutPlace,
        isPartOf: { "@id": `${SITE.url}/#website` },
        provider: { "@id": `${SITE.url}/#real-estate-agent` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Communities", item: `${SITE.url}/communities` },
          { "@type": "ListItem", position: 3, name: market.title, item: canonicalUrl },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <section className="container-fsre">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-ink/50">
          <Link href="/" className="hover:text-tide">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/communities" className="hover:text-tide">Communities</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{market.name}</span>
        </nav>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">{market.eyebrow}</p>
        <h1 className="font-display text-4xl md:text-6xl text-ink leading-tight">{market.heading}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink/65">{market.description}</p>
        <p className="mt-2 text-sm text-ink/50">{market.region}</p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <Link
            href={liveSearchHref}
            prefetch={false}
            className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-semibold text-center px-5 py-3 rounded-sm transition-colors"
          >
            Search Current {market.name} Listings
          </Link>
          <Link
            href="/buyer-tools"
            className="border border-tide/25 text-tide font-medium text-center px-5 py-3 rounded-sm hover:bg-tide/5 transition-colors"
          >
            Compare Ownership Costs
          </Link>
        </div>
      </section>

      <section className="container-fsre mt-12 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-sm border border-ink/10 bg-white p-6 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">Local Market Overview</p>
          <h2 className="mt-2 font-display text-2xl md:text-3xl text-ink">Real estate in {market.name}</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-ink/70">
            {market.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
        <aside className="rounded-sm border border-tide/15 bg-tide text-sand p-6 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">What buyers can compare</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-sand/85">
            {market.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden="true" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="container-fsre mt-12" aria-labelledby="market-search-shortcuts">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">Live BeachesMLS Search</p>
            <h2 id="market-search-shortcuts" className="mt-1 font-display text-2xl md:text-3xl text-ink">Search {market.name} by home type and features</h2>
          </div>
          <Link href={liveSearchHref} prefetch={false} className="text-sm text-tide underline underline-offset-4">Open all {market.name} listings</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEARCH_SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.label}
              href={searchHref(market.searchValue, shortcut.filter)}
              prefetch={false}
              className="rounded-sm border border-ink/10 bg-white p-5 transition-colors hover:border-tide/35 hover:bg-tide/[0.03]"
            >
              <h3 className="font-display text-xl text-ink">{shortcut.label} in {market.name}</h3>
              <span className="mt-2 inline-block text-xs font-medium text-tide">View current listings →</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="container-fsre my-12"><Tideline /></div>

      <section className="container-fsre">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus mb-2">Buyer Due Diligence</p>
            <h2 className="font-display text-2xl md:text-3xl text-ink">Research before buying in {market.name}</h2>
          </div>
          <Link href="/research" className="text-sm text-tide underline underline-offset-4">Open full research center</Link>
        </div>
        <ResearchLinks limit={4} />
      </section>

      <section className="container-fsre mt-14" aria-labelledby="nearby-market-heading">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus mb-2">Related Local Searches</p>
        <h2 id="nearby-market-heading" className="font-display text-2xl md:text-3xl text-ink">Compare nearby South Florida markets</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {market.related.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-sm border border-ink/10 bg-white p-4 text-sm font-medium text-tide hover:border-tide/35">
              {item.label} →
            </Link>
          ))}
        </div>
      </section>

      <section className="container-fsre mt-14" aria-labelledby="market-faq-heading">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus mb-2">Buyer Questions</p>
        <h2 id="market-faq-heading" className="font-display text-2xl md:text-3xl text-ink">Buying a home in {market.name}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-sm border border-ink/10 bg-white p-5">
              <h3 className="font-display text-lg text-ink">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-20"><LeadCaptureBand /></div>
    </div>
  );
}
