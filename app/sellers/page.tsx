import type { Metadata } from "next";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import BrokerIdentity, { BrokerClientReview } from "@/components/BrokerIdentity";
import { SITE } from "@/lib/site-config";
import { serializeJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Full-Service Home Selling | 0.5% Listing-Side Fee",
  description:
    "Work directly with Roque Rodriguez for a personal pricing and selling-cost review, full-service representation, and a transparent 0.5% listing-side brokerage fee.",
  alternates: { canonical: "/sellers" },
};

const INCLUDED = [
  {
    title: "MLS exposure",
    body: "Your property is entered into the applicable MLS when the listing is eligible and authorized, with the required brokerage and MLS information.",
  },
  {
    title: "Property marketing",
    body: "We build the listing presentation and coordinate the marketing plan for the property, including photography and online promotion as agreed in the listing agreement.",
  },
  {
    title: "Showing coordination",
    body: "We coordinate buyer and agent access, communicate showing activity, and help manage the flow of the listing while it is on the market.",
  },
  {
    title: "Offer review and negotiation",
    body: "We review offers with you, compare price and terms, negotiate at your direction, and help you understand the tradeoffs between competing proposals.",
  },
  {
    title: "Contract-to-close support",
    body: "We help manage the transaction timeline from executed contract through inspections, appraisal, title and closing coordination.",
  },
];

const FAQS = [
  {
    q: "What does the 0.5% listing fee mean?",
    a: "It is Florida Southeast Realty's listing-side brokerage fee for representing the seller. It is not a statement of total transaction costs and does not include any compensation a seller may separately authorize for a buyer's broker.",
  },
  {
    q: "Are real estate commissions negotiable?",
    a: "Yes. Real estate commissions are negotiable and are not set by law. The exact services, fees, and terms for a property are confirmed in the written listing agreement.",
  },
  {
    q: "Does 0.5% include buyer-broker compensation?",
    a: "No. Any buyer-broker compensation authorized by a seller is separate from Florida Southeast Realty's 0.5% listing-side fee and is negotiable.",
  },
  {
    q: "Is this a full-service listing?",
    a: "The advertised service includes seller representation, MLS exposure when applicable, marketing, showing coordination, offer negotiation, and transaction support through closing, subject to the written listing agreement.",
  },
  {
    q: "How do I find out what my home may be worth?",
    a: "Request a personal pricing and selling-cost review. Roque will review your property, relevant comparable sales and current competition, then discuss a price range and estimated selling costs with you. There is no charge for the review and no obligation to list.",
  },
];

export default function SellersPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />

      <section className="pt-32 pb-16 bg-tide">
        <div className="container-fsre max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">For Palm Beach &amp; Broward County Sellers</p>
          <h1 className="font-display text-4xl md:text-6xl text-sand leading-tight mb-6">
            Full-service home selling. Direct broker guidance.
          </h1>
          <p className="text-sand/85 text-lg leading-relaxed max-w-3xl">
            Work with {SITE.brokerName}, a real estate professional since {SITE.brokerSince},
            on pricing, marketing, negotiation and your path to closing. Start with a personal
            review of your home&apos;s price range and estimated selling costs.
          </p>
          <p className="mt-5 text-lg font-medium text-brass">0.5% listing-side brokerage fee.</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-sand/75">
            Commission rates are negotiable. Buyer-broker compensation, if authorized, is
            separate and negotiable; other closing costs also apply.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link href="#seller-valuation" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium px-5 py-3 rounded-sm transition-colors">Get My Pricing &amp; Cost Review</Link>
            <a href={SITE.phoneHref} className="border border-sand/30 text-sand font-medium px-5 py-3 rounded-sm hover:bg-white/10 transition-colors">Call Roque: {SITE.phoneDisplay}</a>
          </div>
          <p className="mt-5 text-sm text-sand/70">Lake Worth and 33467, with service throughout Palm Beach and Broward counties.</p>
        </div>
      </section>

      <section className="container-fsre py-16">
        <div className="grid lg:grid-cols-3 gap-10">
          <aside id="seller-valuation" aria-labelledby="seller-valuation-heading" className="scroll-mt-28 lg:order-last lg:sticky lg:top-28 h-fit">
            <h2 id="seller-valuation-heading" className="font-display text-2xl text-ink mb-3">Your pricing &amp; selling-cost review</h2>
            <p className="text-sm text-ink/65 mb-5">Share your address. Roque will review relevant sales, discuss a price range and walk through estimated selling costs with you. Free, with no obligation to list.</p>
            <div className="mb-5"><BrokerIdentity /></div>
            <LeadForm
              formName="sellers-page"
              submitLabel="Request My Home Review"
              successMessage="Roque will follow up about your home, its potential price range and estimated selling costs. There is no obligation to list."
              fields={[
                { name: "address", label: "Property Address", type: "text", required: true, colSpan: 2 },
                { name: "name", label: "Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "phone", label: "Phone (optional)", type: "tel" },
              ]}
            />
            <div className="mt-6"><BrokerClientReview /></div>
          </aside>
          <div className="lg:col-span-2">
            <h2 className="font-display text-2xl md:text-3xl text-ink mb-3">Representation from pricing through closing</h2>
            <p className="mb-6 text-sm leading-relaxed text-ink/65">A clear plan for your property, with an experienced broker involved in the decisions that matter.</p>
            <div className="grid sm:grid-cols-2 gap-5">
              {INCLUDED.map((item) => (
                <div key={item.title} className="bg-white border border-ink/10 rounded-sm p-5">
                  <p className="font-display text-lg text-ink">{item.title}</p>
                  <p className="text-sm text-ink/65 mt-2 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>

            <section className="mt-8 rounded-sm border border-tide/15 bg-white p-6 md:p-8" aria-labelledby="seller-fee-example-heading">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-hibiscus">An illustrative fee example</p>
              <h2 id="seller-fee-example-heading" className="mt-2 font-display text-2xl text-ink">See the listing-side fee in dollars</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div><dt className="text-xs text-ink/55">Example sale price</dt><dd className="mt-1 font-display text-2xl text-tide">$600,000</dd></div>
                <div><dt className="text-xs text-ink/55">Listing-side rate</dt><dd className="mt-1 font-display text-2xl text-tide">0.5%</dd></div>
                <div><dt className="text-xs text-ink/55">Listing-side fee</dt><dd className="mt-1 font-display text-2xl text-tide">$3,000</dd></div>
              </dl>
              <p className="mt-5 text-sm leading-relaxed text-ink/65">$600,000 × 0.005 = $3,000. This example shows the listing-side brokerage fee only. Any authorized buyer-broker compensation and other closing costs are additional. Your property&apos;s fees and services are confirmed in the written listing agreement; commission rates are negotiable.</p>
            </section>

            <div className="mt-10 bg-keystone-dim/60 border border-ink/10 rounded-sm p-6 md:p-8">
              <h2 className="font-display text-xl text-ink mb-4">Important fee disclosures</h2>
              <ul className="space-y-4 text-sm text-ink/75 leading-relaxed">
                <li><strong className="text-ink">Commission rates are negotiable and are not set by law.</strong> The exact brokerage fee and services are confirmed in a written listing agreement.</li>
                <li><strong className="text-ink">Buyer-broker compensation is separate.</strong> If a seller authorizes compensation to a buyer&apos;s broker, that amount is separately negotiable and is not included in the 0.5% listing-side fee.</li>
                <li>Other transaction costs can apply depending on the property and transaction. Nothing on this page is a listing agreement or a guarantee of a particular sale price, timeline, or result.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="container-fsre py-8 md:py-14 max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Seller FAQ</p>
        <h2 className="font-display text-3xl text-ink mb-7">Questions about the 0.5% listing fee</h2>
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {FAQS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="cursor-pointer list-none font-medium text-ink flex items-center justify-between gap-4">
                {item.q}<span className="text-hibiscus text-xl group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-ink/65 leading-relaxed mt-3 max-w-3xl">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
