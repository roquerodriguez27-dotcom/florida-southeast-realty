import type { Metadata } from "next";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "What's My South Florida Home Worth? | Free Home Valuation",
  description:
    "Request a no-obligation South Florida home valuation from Florida Southeast Realty, then learn how the brokerage's 0.5% listing-side fee works if you decide to sell.",
  alternates: { canonical: "/home-valuation" },
};

const REASONS = [
  {
    title: "Reviewed by the brokerage",
    body: "We look beyond a generic automated estimate and consider relevant comparable sales, current competition, location, property type, condition, and the details that may affect how buyers compare your home.",
  },
  {
    title: "No listing agreement required",
    body: "A valuation request starts a conversation. It does not by itself create a brokerage relationship or obligate you to list your property.",
  },
  {
    title: "A clear seller-fee option",
    body: "If you decide to sell, Florida Southeast Realty advertises a 0.5% listing-side brokerage fee. Commission rates are negotiable and buyer-broker compensation is separate and negotiable.",
  },
];

interface Props {
  searchParams: Promise<{ address?: string }>;
}

export default async function HomeValuationPage({ searchParams }: Props) {
  const params = await searchParams;
  const address = params.address?.trim().slice(0, 200) ?? "";

  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Home Valuation</p>
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-4 leading-tight">
            What could your South Florida home sell for today?
          </h1>
          <p className="text-ink/70 mb-8 max-w-lg leading-relaxed">
            Send the property address and a few contact details. Florida Southeast Realty will
            review the home and current market context, then follow up about the valuation and any
            questions you have about selling.
          </p>

          <div className="space-y-5">
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

          <Link href="/sellers" className="inline-block mt-8 text-sm text-tide underline underline-offset-4">
            See what the 0.5% listing-side service includes
          </Link>
        </div>

        <div className="lg:sticky lg:top-28">
          <LeadForm
            formName="home-valuation"
            submitLabel="Get My Home Value"
            successMessage="Florida Southeast Realty will review your property information and follow up about your valuation request."
            fields={[
              { name: "address", label: "Property Address", type: "text", required: true, placeholder: "Street address, city, FL ZIP", defaultValue: address, colSpan: 2 },
              { name: "name", label: "Name", type: "text", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel" },
              {
                name: "timeline",
                label: "Selling Timeline",
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
        </div>
      </div>
    </div>
  );
}
