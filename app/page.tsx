import Hero from "@/components/Hero";
import ValuePropsBar from "@/components/ValuePropsBar";
import AreasWeServe from "@/components/AreasWeServe";
import SectionHeading from "@/components/SectionHeading";
import PropertyGrid from "@/components/PropertyGrid";
import CommunityCard from "@/components/CommunityCard";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import SampleDataNotice from "@/components/SampleDataNotice";
import Tideline from "@/components/Tideline";
import Link from "next/link";
import { getAllListings } from "@/lib/listings";
import { getAllCommunities } from "@/lib/communities";
import { getGuides } from "@/lib/content";
import Image from "next/image";

export default async function HomePage() {
  const [listings, communities, guides] = await Promise.all([
    getAllListings(),
    getAllCommunities(),
    getGuides(),
  ]);

  const featured = listings.filter((l) => l.status === "Active").slice(0, 6);

  return (
    <>
      <Hero />
      <ValuePropsBar />
      <AreasWeServe />

      {/* Seller-focused explainer, secondary to the hero CTA */}
      <section className="container-fsre py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-3">For Sellers</p>
            <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight mb-4">
              Full-service representation. A fraction of the typical fee.
            </h2>
            <p className="text-ink/70 mb-6 max-w-lg">
              Florida Southeast Realty lists homes for a 0.5% listing-side fee — full MLS
              exposure, professional marketing, showing coordination, offer negotiation, and
              support through closing, all included. Commission rates are always negotiable and
              are not set by law; buyer-broker compensation, if authorized, is separate from our
              listing-side fee.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/home-valuation"
                className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-6 py-3 rounded-sm transition-colors"
              >
                Get Your Free Home Value
              </Link>
              <Link
                href="/sellers"
                className="border border-tide/30 text-tide font-medium text-center px-6 py-3 rounded-sm hover:bg-tide/5 transition-colors"
              >
                How the 0.5% Fee Works
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-sm overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80"
              alt="A South Florida home prepared for listing"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <div className="container-fsre">
        <Tideline />
      </div>

      <section className="container-fsre py-16 md:py-24">
        <SectionHeading
          eyebrow="Featured Listings"
          title="Browse homes on the market"
          action={{ href: "/properties", label: "View all listings" }}
        />
        <div className="mb-6">
          <SampleDataNotice variant="listings" />
        </div>
        <PropertyGrid listings={featured} />
      </section>

      <section className="container-fsre py-16 md:py-24">
        <SectionHeading
          eyebrow="Communities"
          title="One coast, a dozen ways to live on it"
          action={{ href: "/communities", label: "Explore all communities" }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.slice(0, 3).map((c) => (
            <CommunityCard key={c.slug} community={c} />
          ))}
        </div>
      </section>

      <LeadCaptureBand />

      <section className="container-fsre py-16 md:py-24">
        <SectionHeading
          eyebrow="Guides"
          title="Local knowledge, written down"
          action={{ href: "/guides", label: "Read all guides" }}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm mb-4">
                <Image
                  src={g.image}
                  alt={g.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">
                {g.category} · {g.readMinutes} min read
              </p>
              <h3 className="font-display text-xl text-ink leading-snug group-hover:text-tide transition-colors">
                {g.title}
              </h3>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
