import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getCommunityBySlug } from "@/lib/communities";
import { searchListings } from "@/lib/listings";
import PropertyGrid from "@/components/PropertyGrid";
import Tideline from "@/components/Tideline";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import ResearchLinks from "@/components/ResearchLinks";
import SampleDataNotice from "@/components/SampleDataNotice";
import { IDX_PROVIDER } from "@/lib/idx";
import { SITE } from "@/lib/site-config";
import CommunityIntelligence from "@/components/CommunityIntelligence";
import { serializeJsonLd } from "@/lib/seo/json-ld";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) return {};
  return {
    title: `${community.name} FL Real Estate & Neighborhood Guide`,
    description: `Explore ${community.name}, Florida real estate, homes, local lifestyle, and buyer research resources for schools, flood maps, property records, permits, and more.`,
    alternates: { canonical: `/communities/${community.slug}` },
    openGraph: {
      title: `${community.name} Real Estate & Neighborhood Guide`,
      description: community.overview,
      images: [{ url: community.heroImage, alt: community.heroImageAlt }],
    },
  };
}

export default async function CommunityPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();

  const listings = await searchListings({ community: community.slug });
  const usingSampleListings = IDX_PROVIDER === "not_connected";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        name: `${community.name}, Florida`,
        description: community.overview,
        url: `${SITE.url}/communities/${community.slug}`,
        containedInPlace: { "@type": "AdministrativeArea", name: community.county },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Communities", item: `${SITE.url}/communities` },
          { "@type": "ListItem", position: 3, name: community.name, item: `${SITE.url}/communities/${community.slug}` },
        ],
      },
    ],
  };

  return (
    <div className="pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <div className="relative h-[48svh] min-h-[360px] overflow-hidden bg-tide">
        <Image
          src={community.heroImage}
          alt={community.heroImageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/95 via-tide/30 to-tide/35" />
        <div className="relative h-full container-fsre flex flex-col justify-end pb-10 pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-brass mb-2">{community.county} · South Florida</p>
          <h1 className="font-display text-4xl md:text-6xl text-sand">{community.name}</h1>
          <p className="text-sand/85 mt-2 max-w-2xl">{community.tagline}</p>
        </div>
      </div>

      <p className="container-fsre mt-2 text-right text-[10px] leading-relaxed text-ink/45">
        Photo: <a href={community.heroImageCredit.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{community.heroImageCredit.author}</a>
        {" · "}
        {community.heroImageCredit.licenseUrl ? (
          <a href={community.heroImageCredit.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{community.heroImageCredit.license}</a>
        ) : community.heroImageCredit.license}
        {" · resized for web"}
      </p>

      <section className={`container-fsre mt-10 ${community.images.length > 0 ? "grid grid-cols-1 lg:grid-cols-3 gap-12" : ""}`}>
        <div className={community.images.length > 0 ? "lg:col-span-2" : "max-w-4xl"}>
          <h2 className="font-display text-2xl text-ink mb-4">Living in {community.name}</h2>
          <p className="text-ink/80 leading-relaxed text-lg">{community.overview}</p>

          <h2 className="font-display text-xl text-ink mt-9 mb-3">What you&apos;ll find here</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {community.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-ink/75 bg-white border border-ink/10 rounded-sm px-3 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-hibiscus shrink-0" /> {h}
              </li>
            ))}
          </ul>

          <div className="mt-9 bg-keystone-dim/60 border border-ink/10 rounded-sm p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tide">Research reminder</p>
            <p className="text-sm text-ink/70 mt-2 leading-relaxed">
              School assignments, flood zones, association rules, taxes, permits, insurance costs,
              and other property-specific facts can change. Verify the details that matter to you
              using current official records and qualified professionals.
            </p>
          </div>
        </div>

        {community.images.length > 0 && (
          <aside className="grid grid-cols-2 gap-2 content-start">
            {community.images.map((src, i) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-sm bg-keystone-dim">
                <Image src={src} alt={`${community.name} area lifestyle image ${i + 1}`} fill sizes="(max-width: 1024px) 50vw, 20vw" className="object-cover" />
              </div>
            ))}
          </aside>
        )}
      </section>

      <CommunityIntelligence slug={community.slug} name={community.name} />

      <div className="container-fsre my-12"><Tideline /></div>

      <section className="container-fsre">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus mb-2">Property Research</p>
            <h2 className="font-display text-2xl md:text-3xl text-ink">Research {community.name} before you buy</h2>
          </div>
          <Link href="/research" className="text-sm text-tide underline underline-offset-4">Open full research center</Link>
        </div>
        <ResearchLinks limit={4} />
      </section>

      <div className="container-fsre my-12"><Tideline /></div>

      <section className="container-fsre">
        <h2 className="font-display text-2xl text-ink mb-2">Homes in {community.name}</h2>
        <p className="text-sm text-ink/60 mb-6">Browse matching inventory and contact us for properties that fit your exact criteria.</p>
        {usingSampleListings && listings.length > 0 && <div className="mb-6"><SampleDataNotice variant="listings" /></div>}
        {listings.length > 0 ? (
          <PropertyGrid listings={listings} />
        ) : (
          <div className="bg-white border border-ink/10 rounded-sm p-6 md:p-8">
            <p className="font-display text-xl text-ink">Live MLS inventory is being connected.</p>
            <p className="text-sm text-ink/65 mt-2 max-w-2xl">
              Tell us what you want in {community.name} and we can help you search while the new site&apos;s live MLS feed is being finalized.
            </p>
            <Link href="/contact" className="inline-block mt-4 bg-hibiscus text-sand font-medium px-4 py-2.5 rounded-sm">Ask about {community.name}</Link>
          </div>
        )}
      </section>

      <div className="mt-20"><LeadCaptureBand /></div>
    </div>
  );
}
