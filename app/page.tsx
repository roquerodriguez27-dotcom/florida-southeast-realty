import type { Metadata } from "next";
import Hero from "@/components/Hero";
import ValuePropsBar from "@/components/ValuePropsBar";
import AreasWeServe from "@/components/AreasWeServe";
import SectionHeading from "@/components/SectionHeading";
import PropertyGrid from "@/components/PropertyGrid";
import CommunityCard from "@/components/CommunityCard";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import SampleDataNotice from "@/components/SampleDataNotice";
import TestimonialsSection from "@/components/TestimonialsSection";
import ResearchLinks from "@/components/ResearchLinks";
import Tideline from "@/components/Tideline";
import Link from "next/link";
import { getAllListings } from "@/lib/listings";
import { getAllCommunities } from "@/lib/communities";
import { getGuides } from "@/lib/content";
import { IDX_PROVIDER } from "@/lib/idx";
import Image from "next/image";

export const metadata: Metadata = {
  title: "South Florida Real Estate | Search, Research & Sell for 0.5%",
  description:
    "Search South Florida homes, compare Broward and Palm Beach County communities, research flood maps, schools and property records, or sell with a 0.5% listing-side fee.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [listings, communities, guides] = await Promise.all([
    getAllListings(),
    getAllCommunities(),
    getGuides(),
  ]);

  const featured = listings.filter((l) => l.status === "Active").slice(0, 6);
  const usingSampleListings = IDX_PROVIDER === "not_connected";

  return (
    <>
      <Hero />
      <ValuePropsBar />
      <AreasWeServe />

      <section className="container-fsre py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-3">For Sellers</p>
            <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight mb-4">
              Full-service representation. A 0.5% listing-side fee.
            </h2>
            <p className="text-ink/70 mb-6 max-w-lg leading-relaxed">
              Florida Southeast Realty&apos;s 0.5% fee covers the listing side of the transaction,
              including MLS exposure, marketing, showing coordination, offer negotiation, and
              support through closing. Commission rates are negotiable and are not set by law;
              any buyer-broker compensation is separate and negotiable.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/home-valuation" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-6 py-3 rounded-sm transition-colors">
                Get Your Free Home Value
              </Link>
              <Link href="/sellers" className="border border-tide/30 text-tide font-medium text-center px-6 py-3 rounded-sm hover:bg-tide/5 transition-colors">
                See What 0.5% Includes
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-sm overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80"
              alt="South Florida home exterior"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <div className="container-fsre"><Tideline /></div>

      {featured.length > 0 && (
        <section className="container-fsre py-16 md:py-24">
          <SectionHeading eyebrow="Property Search" title="Browse the search experience" action={{ href: "/properties", label: "Search all homes" }} />
          {usingSampleListings && <div className="mb-6"><SampleDataNotice variant="listings" /></div>}
          <PropertyGrid listings={featured} />
        </section>
      )}

      <section className="container-fsre py-16 md:py-24">
        <SectionHeading
          eyebrow="Communities"
          title="Research where you want to live"
          action={{ href: "/communities", label: "Explore all communities" }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.slice(0, 6).map((c) => <CommunityCard key={c.slug} community={c} />)}
        </div>
      </section>

      <section className="bg-keystone-dim/60 border-y border-ink/10">
        <div className="container-fsre py-16 md:py-24">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-7">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">FSR Research Center</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink">A listing should answer more than price and bedrooms</h2>
              <p className="text-ink/65 max-w-2xl mt-3">
                Start with official and established sources for flood information, schools, property records, permits, and other due diligence.
              </p>
            </div>
            <Link href="/research" className="text-sm text-tide underline underline-offset-4">Open the full research center</Link>
          </div>
          <ResearchLinks limit={4} />
        </div>
      </section>

      <section className="container-fsre py-16 md:py-24">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Buyer Decision Tools</p>
            <h2 className="font-display text-3xl md:text-4xl text-ink">See the cost behind the listing price</h2>
            <p className="text-ink/65 mt-4 leading-relaxed">Compare homes side-by-side, estimate affordability, and include Florida property taxes, insurance, flood coverage, HOA fees, PMI, and assessments in one monthly-cost scenario.</p>
            <Link href="/buyer-tools" className="inline-block mt-6 bg-tide text-sand font-medium px-5 py-3 rounded-sm hover:bg-tide-light transition-colors">Open Buyer Tools</Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[{ title: "True monthly cost", body: "Mortgage, taxes, insurance, flood, HOA, PMI, and assessments." }, { title: "Affordability", body: "Test income, debts, cash, rate, and down-payment scenarios." }, { title: "Compare homes", body: "Evaluate price, size, age, property type, waterfront, and market time." }].map((item) => <div key={item.title} className="bg-white border border-ink/10 rounded-sm p-5"><h3 className="font-display text-xl">{item.title}</h3><p className="text-sm text-ink/60 mt-2 leading-relaxed">{item.body}</p></div>)}
          </div>
        </div>
      </section>

      <TestimonialsSection />
      <LeadCaptureBand />

      <section className="container-fsre py-16 md:py-24">
        <SectionHeading eyebrow="Guides" title="South Florida real estate, explained clearly" action={{ href: "/guides", label: "Read all guides" }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm mb-4">
                <Image src={g.image} alt={g.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">{g.category} · {g.readMinutes} min read</p>
              <h3 className="font-display text-xl text-ink leading-snug group-hover:text-tide transition-colors">{g.title}</h3>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
