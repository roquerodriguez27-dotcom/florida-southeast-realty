import type { Metadata } from "next";
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
      <section className="pt-32 pb-16 container-fsre max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">About Florida Southeast Realty</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight mb-6">
          Local brokerage. Direct answers. Better research before the decision.
        </h1>
        <p className="text-ink/75 leading-relaxed text-lg max-w-3xl">
          {SITE.brokerName} has worked in real estate since 1997, beginning in New Jersey and now
          serving South Florida as Broker of {SITE.name} The brokerage is built for clients who
          want experienced representation without the layers of a national lead platform.
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
