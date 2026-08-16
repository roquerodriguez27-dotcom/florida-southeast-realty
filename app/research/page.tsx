import type { Metadata } from "next";
import Link from "next/link";
import ResearchLinks from "@/components/ResearchLinks";

export const metadata: Metadata = {
  title: "South Florida Home & Neighborhood Research Center",
  description:
    "Research South Florida homes and neighborhoods using official flood maps, school data, property records, permits, crime data, walkability, and other buyer due-diligence resources.",
  alternates: { canonical: "/research" },
};

const CHECKLIST = [
  "Confirm flood-zone information and discuss insurance with a licensed insurance professional.",
  "Verify current school assignments directly with the applicable school district; boundaries can change.",
  "Review property-appraiser records, tax history, exemptions, and public parcel information.",
  "Check permit and code records for additions, renovations, open permits, and other items that may matter to you.",
  "Review HOA or condominium documents, budgets, reserves, assessments, rental rules, pet rules, and application requirements when applicable.",
  "Compare commute times, nearby services, parks, beaches, hospitals, shopping, and other lifestyle factors important to your household.",
];

const RESEARCH_ORDER = [
  { step: "01", title: "Start with the parcel", body: "Confirm the legal property record, ownership, assessed value, lot details, exemptions, and recorded sale history." },
  { step: "02", title: "Check the structure", body: "Review permits, additions, roof and major-system history, code issues, liens, and open inspections with the correct jurisdiction." },
  { step: "03", title: "Understand the location", body: "Research flood maps, evacuation context, schools, transportation, nearby services, weather, and municipal resources." },
  { step: "04", title: "Read the restrictions", body: "For HOA and condominium property, examine rules, budgets, reserves, assessments, insurance, leasing, pets, and application requirements." },
];

export default function ResearchPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "South Florida Home & Neighborhood Research Center",
    description:
      "Official and third-party resources for researching South Florida homes, neighborhoods, schools, flood information, property records, permits, and transportation.",
  };

  return (
    <div className="pt-28 md:pt-32 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="container-fsre max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">FSR Research Center</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight">
          Research the home. Research the neighborhood. Make a better decision.
        </h1>
        <p className="text-lg text-ink/70 leading-relaxed mt-5 max-w-3xl">
          A listing is only the beginning. Use these official and established resources to dig into
          flood information, schools, public property records, permits, transportation, and other
          location details before you buy or sell.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/properties" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium px-5 py-3 rounded-sm transition-colors">
            Search Homes
          </Link>
          <Link href="/contact" className="border border-tide/25 text-tide font-medium px-5 py-3 rounded-sm hover:bg-tide/5 transition-colors">
            Ask a Local Broker
          </Link>
          <Link href="/buyer-tools" className="border border-tide/25 text-tide font-medium px-5 py-3 rounded-sm hover:bg-tide/5 transition-colors">
            Compare Costs & Homes
          </Link>
        </div>
      </section>

      <section className="container-fsre py-14 md:py-16">
        <h2 className="font-display text-2xl md:text-3xl text-ink mb-3">Independent research resources</h2>
        <p className="text-sm text-ink/60 max-w-3xl mb-7">
          These links open third-party or government resources. Florida Southeast Realty does not
          control their data and does not make subjective judgments about whether a school or
          neighborhood is “good,” “bad,” “safe,” or “unsafe.” Use objective information and decide
          what matters to you.
        </p>
        <ResearchLinks />
      </section>

      <section className="container-fsre pb-14 md:pb-16">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">A better research order</p>
        <h2 className="font-display text-2xl md:text-3xl mt-2">From broad neighborhood context to the exact address</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {RESEARCH_ORDER.map((item) => (
            <article key={item.step} className="bg-white border border-ink/10 rounded-sm p-5">
              <span className="font-mono text-xs text-brass">{item.step}</span>
              <h3 className="font-display text-xl mt-3">{item.title}</h3>
              <p className="text-sm text-ink/65 leading-relaxed mt-2">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-tide text-sand">
        <div className="container-fsre py-14 md:py-16 grid lg:grid-cols-2 gap-10">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-2">Buyer Due Diligence</p>
            <h2 className="font-display text-3xl">Questions worth answering before you commit</h2>
            <p className="text-sand/70 mt-4 leading-relaxed">
              The right research depends on the property. Waterfront homes, condos, gated
              communities, older homes, and new construction can each require a different level of
              review. We help you identify the questions; specialists and official records provide
              the answers where appropriate.
            </p>
          </div>
          <ul className="space-y-4">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-sand/80 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brass shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
