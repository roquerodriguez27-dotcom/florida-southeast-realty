import type { Metadata } from "next";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import { serializeJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Sell Your South Florida Home for a 0.5% Listing Fee",
  description:
    "Florida Southeast Realty offers full-service seller representation for a 0.5% listing-side brokerage fee, including MLS exposure, marketing, negotiation, and closing support.",
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
    a: "Start with the home valuation form. Florida Southeast Realty can review the property, recent market activity, condition, location, and your timing before discussing a pricing strategy.",
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
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">For South Florida Sellers</p>
          <h1 className="font-display text-4xl md:text-6xl text-sand leading-tight mb-6">
            Sell your home with a 0.5% listing-side fee.
          </h1>
          <p className="text-sand/85 text-lg leading-relaxed max-w-3xl">
            Florida Southeast Realty&apos;s 0.5% fee is the brokerage fee for representing you on
            the listing side. Commission rates are negotiable and are not set by law. Any
            buyer-broker compensation you choose to authorize is separate and negotiable.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link href="/home-valuation" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium px-5 py-3 rounded-sm transition-colors">Get My Home Value</Link>
            <Link href="/contact" className="border border-sand/30 text-sand font-medium px-5 py-3 rounded-sm hover:bg-white/10 transition-colors">Talk to the Broker</Link>
          </div>
        </div>
      </section>

      <section className="container-fsre py-16">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <h2 className="font-display text-2xl md:text-3xl text-ink mb-6">What&apos;s included</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {INCLUDED.map((item) => (
                <div key={item.title} className="bg-white border border-ink/10 rounded-sm p-5">
                  <p className="font-display text-lg text-ink">{item.title}</p>
                  <p className="text-sm text-ink/65 mt-2 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 bg-keystone-dim/60 border border-ink/10 rounded-sm p-6 md:p-8">
              <h2 className="font-display text-xl text-ink mb-4">Important fee disclosures</h2>
              <ul className="space-y-4 text-sm text-ink/75 leading-relaxed">
                <li><strong className="text-ink">Commission rates are negotiable and are not set by law.</strong> The exact brokerage fee and services are confirmed in a written listing agreement.</li>
                <li><strong className="text-ink">Buyer-broker compensation is separate.</strong> If a seller authorizes compensation to a buyer&apos;s broker, that amount is separately negotiable and is not included in the 0.5% listing-side fee.</li>
                <li>Other transaction costs can apply depending on the property and transaction. Nothing on this page is a listing agreement or a guarantee of a particular sale price, timeline, or result.</li>
              </ul>
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 h-fit">
            <LeadForm
              formName="sellers-page"
              submitLabel="Get My Home Value"
              successMessage="Florida Southeast Realty will follow up about your property and the 0.5% listing-side service."
              fields={[
                { name: "address", label: "Property Address", type: "text", required: true, colSpan: 2 },
                { name: "name", label: "Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "phone", label: "Phone", type: "tel" },
              ]}
            />
          </aside>
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
