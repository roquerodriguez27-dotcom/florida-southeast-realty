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
    "Meet Roque Rodriguez, Broker of Florida Southeast Realty, an independent brokerage serving buyers and sellers across South Florida.",
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
              Our goal is simple: make it easier to understand the property, the neighborhood, the
              transaction, and the numbers before you make a major decision.
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

      <TestimonialsSection />
      <LeadCaptureBand />
    </div>
  );
}
