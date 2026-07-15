import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "What's My Home Worth? | Free Southeast Florida Home Valuation",
  description:
    "Get a free, no-obligation home valuation from a local Florida Southeast Realty agent, then list for a 0.5% listing-side fee.",
  alternates: { canonical: "/home-valuation" },
};

const REASONS = [
  {
    title: "A local agent reviews every request",
    body: "We start from comparable closings and neighborhood specifics — a fixed bridge, a redone seawall, a flood zone letter — the details automated estimators miss.",
  },
  {
    title: "No obligation, ever",
    body: "This is a starting conversation, not a listing agreement. You're free to use this valuation however you'd like.",
  },
  {
    title: "Pair it with our 0.5% listing fee",
    body: "If you do decide to sell, Florida Southeast Realty lists for a 0.5% listing-side fee with full-service representation. See the details on our seller page.",
  },
];

export default function HomeValuationPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Home Valuation</p>
          <h1 className="font-display text-3xl md:text-4xl text-ink mb-4 leading-tight">
            What&apos;s your home actually worth on today&apos;s market?
          </h1>
          <p className="text-ink/70 mb-8 max-w-md">
            Tell us the address. A Florida Southeast Realty agent who knows the neighborhood will
            pull recent comparable closings and follow up with a real number.
          </p>

          <div className="space-y-5">
            {REASONS.map((r) => (
              <div key={r.title} className="flex gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-hibiscus mt-2.5 shrink-0" />
                <div>
                  <p className="font-medium text-ink">{r.title}</p>
                  <p className="text-sm text-ink/60 mt-0.5">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:sticky lg:top-28">
          <LeadForm
            formName="home-valuation"
            submitLabel="Get My Home Value"
            successMessage="A local agent is pulling comparable closings for your address and will follow up, usually within one business day."
            fields={[
              { name: "address", label: "Property Address", type: "text", required: true, placeholder: "212 Coral Ridge Drive, Fort Lauderdale, FL", colSpan: 2 },
              { name: "name", label: "Name", type: "text" },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel" },
              {
                name: "timeline",
                label: "Selling Timeline",
                type: "select",
                options: [
                  { value: "curious", label: "Just curious" },
                  { value: "0-3", label: "0–3 months" },
                  { value: "3-6", label: "3–6 months" },
                  { value: "6-12", label: "6–12 months" },
                ],
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
