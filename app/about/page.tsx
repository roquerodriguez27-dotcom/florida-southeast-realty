import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ValuePropsBar from "@/components/ValuePropsBar";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import TestimonialsSection from "@/components/TestimonialsSection";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About Roque Rodriguez & Florida Southeast Realty",
  description:
    "Meet Roque Rodriguez, a Boynton Beach-based broker helping buyers and sellers in Palm Beach and Broward counties, including New York and New Jersey relocations.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Direct broker access",
    body: "You are not routed into a national call center. Buyers and sellers can work directly with the brokerage and get answers tied to the transaction in front of them.",
  },
  {
    title: "Research before pressure",
    body: "Flood maps, public property records, permits, community rules, transportation, and other due-diligence questions should be part of the conversation before you commit.",
  },
  {
    title: "A clear seller fee",
    body: "Florida Southeast Realty advertises a 0.5% listing-side brokerage fee. Commission rates are negotiable, and any buyer-broker compensation is separate and negotiable.",
  },
];

const LOCAL_GUIDES = [
  { name: "Boynton Beach", href: "/communities/boynton-beach" },
  { name: "Delray Beach", href: "/communities/delray-beach" },
  { name: "Boca Raton", href: "/communities/boca-raton" },
  { name: "Lake Worth Beach", href: "/communities/lake-worth-beach" },
  { name: "West Palm Beach", href: "/communities/west-palm-beach" },
  { name: "Wellington", href: "/communities/wellington" },
  { name: "Palm Beach Gardens", href: "/communities/palm-beach-gardens" },
  { name: "Jupiter", href: "/communities/jupiter" },
  { name: "Fort Lauderdale", href: "/fort-lauderdale-homes-for-sale" },
];

export default function AboutPage() {
  return (
    <div className="pb-20">
      <section className="container-fsre pb-16 pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.75fr)] lg:gap-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">About Florida Southeast Realty</p>
            <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight mb-6">
              Local brokerage. Direct answers. Better research before the decision.
            </h1>
            <p className="text-ink/75 leading-relaxed text-lg max-w-3xl">
              {SITE.brokerName} has worked in real estate since {SITE.brokerSince}, beginning in New
              Jersey and now serving South Florida as Broker of {SITE.name} The brokerage is built
              for clients who want experienced representation without the layers of a national lead
              platform.
            </p>
            <p className="text-ink/70 leading-relaxed mt-4 max-w-3xl">
              Based in {SITE.address.city}, we help buyers and sellers across Palm Beach and Broward
              counties. Our goal is simple: make it easier to understand the property, the
              neighborhood, the transaction, and the numbers before you make a major decision.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/contact" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium px-5 py-3 rounded-sm transition-colors">
                Talk to Roque
              </Link>
              <Link href="/research" className="border border-tide/25 text-tide font-medium px-5 py-3 rounded-sm hover:bg-tide/5 transition-colors">
                Explore the Research Center
              </Link>
            </div>
          </div>

          <figure className="mx-auto w-full max-w-md overflow-hidden rounded-sm border border-ink/10 bg-white shadow-[0_18px_50px_rgba(14,43,48,0.12)]">
            <div className="relative aspect-square bg-keystone-dim/50">
              <Image
                src={SITE.brokerImage}
                alt={`${SITE.brokerName}, Broker of ${SITE.name}`}
                fill
                sizes="(max-width: 1024px) calc(100vw - 2rem), 420px"
                className="object-cover"
                fetchPriority="high"
              />
            </div>
            <figcaption className="border-t border-ink/10 px-5 py-4">
              <p className="font-display text-2xl text-ink">{SITE.brokerName}</p>
              <p className="mt-1 text-sm text-ink/60">
                Broker · Serving real estate clients since {SITE.brokerSince}
              </p>
            </figcaption>
          </figure>
        </div>
      </section>

      <ValuePropsBar />

      <section className="container-fsre py-16 md:py-20">
        <div className="grid lg:grid-cols-3 gap-6">
          {PRINCIPLES.map((item) => (
            <div key={item.title} className="bg-white border border-ink/10 rounded-sm p-6">
              <h2 className="font-display text-xl text-ink">{item.title}</h2>
              <p className="text-sm text-ink/65 mt-3 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-fsre pb-16 md:pb-20" aria-labelledby="local-coverage-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-3">Where we work</p>
            <h2 id="local-coverage-heading" className="font-display text-3xl text-ink">
              Start with the places that fit your plans
            </h2>
            <p className="mt-4 text-ink/70 leading-relaxed">
              Compare local guides for housing types, property research, and current listings.
              Whether you are buying, selling, or planning a move, we can help you narrow the
              search and identify the questions to ask about a particular address.
            </p>
            <nav aria-label="Local community guides" className="mt-5 flex flex-wrap gap-2">
              {LOCAL_GUIDES.map((guide) => (
                <Link key={guide.href} href={guide.href} prefetch={false} className="rounded-sm border border-tide/20 px-3 py-2 text-sm text-tide hover:bg-tide/5 transition-colors">
                  {guide.name}
                </Link>
              ))}
            </nav>
            <p className="mt-5 text-sm text-ink/65 leading-relaxed">
              Looking in the Lake Worth mailing area? Use our{" "}
              <Link href="/homes-for-sale/33467" prefetch={false} className="text-tide underline underline-offset-4">33467 property search</Link>
              {" "}alongside the Lake Worth Beach city guide, and verify the municipality for each address.
            </p>
          </div>
          <div className="rounded-sm border border-ink/10 bg-white p-6 md:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-3">Planning a relocation</p>
            <h2 className="font-display text-3xl text-ink">Moving from New York or New Jersey?</h2>
            <p className="mt-4 text-ink/70 leading-relaxed">
              Roque began his real estate career in New Jersey. If you are considering a move to
              Palm Beach County, start with a practical plan for your travel, home search, ownership
              costs, and timing. We welcome buyers relocating from anywhere and use your priorities
              to guide the conversation.
            </p>
            <Link href="/guides/moving-from-new-york-new-jersey-to-palm-beach-county" className="mt-5 inline-block text-tide font-medium underline underline-offset-4">
              Read the Palm Beach County relocation guide
            </Link>
            <div className="mt-7 border-t border-ink/10 pt-5">
              <p className="text-sm text-ink/65">Have a property or a move in mind?</p>
              <a href={SITE.phoneHref} className="mt-2 inline-block text-tide font-medium underline underline-offset-4">
                Call {SITE.brokerName}: {SITE.phoneDisplay}
              </a>
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection />
      <LeadCaptureBand />
    </div>
  );
}
