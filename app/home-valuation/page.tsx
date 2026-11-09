import type { Metadata } from "next";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import BrokerIdentity, { BrokerClientReview } from "@/components/BrokerIdentity";

const REASONS = [
  {
    title: "A price range grounded in local sales",
    body: "Roque reviews relevant comparable sales and current competition, then discusses a potential price range for your home.",
  },
  {
    title: "The details that affect your home",
    body: "Condition, improvements, property type, location and your timing all inform the conversation. You can share those details when Roque follows up.",
  },
  {
    title: "An explanation of estimated selling costs",
    body: "Review the listing-side fee and the other costs to consider before making a decision, including any buyer-broker compensation you choose to authorize.",
  },
];

interface Props {
  searchParams: Promise<{ address?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const hasPrefilledAddress = Boolean(params.address?.trim());

  return {
    title: "Free Home Pricing & Selling-Cost Review | South Florida",
    description:
      "Get a personal home-price and selling-cost review from Roque Rodriguez. Serving Lake Worth, 33467, and Palm Beach and Broward counties. No obligation to list.",
    alternates: { canonical: "/home-valuation" },
    robots: { index: !hasPrefilledAddress, follow: true },
  };
}

export default async function HomeValuationPage({ searchParams }: Props) {
  const params = await searchParams;
  const address = params.address?.trim().slice(0, 200) ?? "";

  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre">
        <header className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Your Home Sale, Reviewed Personally</p>
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-4 leading-tight">
            What could your home sell for? What could you keep?
          </h1>
          <p className="text-ink/70 leading-relaxed">
            Get a personal pricing and selling-cost review from Roque Rodriguez. Start with your
            address, then discuss a potential price range, relevant sales and the costs to plan for.
            The review is free, with no obligation to list.
          </p>
          <p className="mt-3 text-sm text-ink/55">For homes in Lake Worth and 33467, and throughout Palm Beach and Broward counties.</p>
        </header>

        <div className="mt-9 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <section className="lg:order-last lg:sticky lg:top-28" aria-labelledby="home-review-form-heading">
            <h2 id="home-review-form-heading" className="font-display text-2xl text-ink mb-4">Request your home review</h2>
            <div className="mb-5"><BrokerIdentity /></div>
            <LeadForm
              formName="home-valuation"
              submitLabel="Request My Home Review"
              successMessage="Roque will review your property information and follow up to discuss a potential price range and estimated selling costs. There is no obligation to list."
              fields={[
                { name: "address", label: "Property Address", type: "text", required: true, placeholder: "Street address, city, FL ZIP", defaultValue: address, colSpan: 2 },
                { name: "name", label: "Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "phone", label: "Phone (optional)", type: "tel" },
                {
                  name: "timeline",
                  label: "Selling Timeline (optional)",
                  type: "select",
                  options: [
                    { value: "curious", label: "Just researching" },
                    { value: "0-3", label: "0–3 months" },
                    { value: "3-6", label: "3–6 months" },
                    { value: "6-12", label: "6–12 months" },
                    { value: "12-plus", label: "More than 12 months" },
                  ],
                },
              ]}
            />
          </section>

          <div>
            <h2 className="font-display text-2xl text-ink mb-6">What your review covers</h2>
            <div className="space-y-6">
              {REASONS.map((reason) => (
                <div key={reason.title} className="flex gap-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-hibiscus mt-2.5 shrink-0" />
                  <div>
                    <p className="font-medium text-ink">{reason.title}</p>
                    <p className="text-sm text-ink/60 mt-1 leading-relaxed">{reason.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-sm border border-tide/15 bg-white p-5 md:p-6">
              <h3 className="font-display text-xl text-ink">Full-service representation, with a clear listing-side fee</h3>
              <p className="mt-3 text-lg font-medium text-tide">0.5% listing-side brokerage fee.</p>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">If you decide to list, Florida Southeast Realty offers MLS exposure, marketing, showing coordination, negotiation and closing support. Commission rates are negotiable. Buyer-broker compensation, if authorized, is separate and negotiable; other closing costs also apply. Services and terms are confirmed in a written listing agreement.</p>
              <Link href="/sellers" className="inline-block mt-4 text-sm font-medium text-tide underline underline-offset-4">See the selling plan and fee example</Link>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-ink/60">A review starts a conversation. It does not create a brokerage relationship or commit you to selling your home.</p>
            <div className="mt-8"><BrokerClientReview /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
