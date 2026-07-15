import type { Metadata } from "next";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Sell Your Home for a 0.5% Listing Fee",
  description:
    "Florida Southeast Realty lists homes for a 0.5% listing-side fee with full-service representation — MLS exposure, marketing, negotiation, and closing support included.",
  alternates: { canonical: "/sellers" },
};

const INCLUDED = [
  {
    title: "Full MLS exposure",
    body: "Your home is entered into the local MLS and syndicated to the major consumer search sites, exactly as it would be with a traditional full-fee listing.",
  },
  {
    title: "Professional marketing",
    body: "Photography, a property website, and targeted promotion to agents and buyers actively searching in your area.",
  },
  {
    title: "Showing coordination",
    body: "We schedule and coordinate showings, gather feedback, and keep you informed after every visit.",
  },
  {
    title: "Offer negotiation",
    body: "A licensed agent reviews every offer with you, negotiates terms and price on your behalf, and helps you compare competing offers side by side.",
  },
  {
    title: "Transaction support through closing",
    body: "From inspection period to appraisal to closing table, we manage the timeline and paperwork so nothing slips.",
  },
];

export default function SellersPage() {
  return (
    <div className="pb-24">
      <section className="pt-32 pb-16 bg-tide">
        <div className="container-fsre max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">For Sellers</p>
          <h1 className="font-display text-3xl md:text-5xl text-sand leading-tight mb-6">
            Sell your home for a 0.5% listing fee.
          </h1>
          <p className="text-sand/85 text-lg leading-relaxed max-w-2xl">
            0.5% is Florida Southeast Realty&apos;s <strong>listing-side fee only</strong> — the
            portion we charge for representing you as the seller. It is not a total transaction
            cost, and it does not include any compensation offered to a buyer&apos;s agent.
          </p>
        </div>
      </section>

      <section className="container-fsre py-16">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <h2 className="font-display text-2xl text-ink mb-6">What&apos;s included at 0.5%</h2>
            <div className="space-y-6">
              {INCLUDED.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-hibiscus mt-2.5 shrink-0" />
                  <div>
                    <p className="font-medium text-ink">{item.title}</p>
                    <p className="text-sm text-ink/65 mt-1">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 bg-white border border-ink/10 rounded-sm p-6 md:p-8">
              <h2 className="font-display text-xl text-ink mb-4">Important disclosures</h2>
              <ul className="space-y-4 text-sm text-ink/75 leading-relaxed">
                <li>
                  <strong className="text-ink">Commission rates are not set by law and are
                  always negotiable</strong> between a broker and their client. The 0.5% figure
                  above is Florida Southeast Realty&apos;s current listing-side offer and is
                  discussed and confirmed in your listing agreement before you sign anything.
                </li>
                <li>
                  <strong className="text-ink">Buyer-broker compensation is separate.</strong> If
                  you choose to offer compensation to a buyer&apos;s agent to help market your
                  home to represented buyers, that amount is negotiated independently and is not
                  part of our 0.5% listing-side fee.
                </li>
                <li>
                  Nothing on this page is a listing agreement or an offer of representation. Terms
                  are finalized in a written agreement with a licensed Florida Southeast Realty,
                  Inc. agent.
                </li>
              </ul>
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 h-fit">
            <LeadForm
              formName="sellers-page"
              submitLabel="Get My Home Value"
              successMessage="A local agent will follow up with a valuation and walk you through how the 0.5% fee applies to your home."
              fields={[
                { name: "address", label: "Property Address", type: "text", required: true, colSpan: 2 },
                { name: "name", label: "Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "phone", label: "Phone", type: "tel" },
              ]}
            />
            <p className="text-xs text-ink/50 mt-4">
              Prefer to talk first?{" "}
              <Link href="/contact" className="text-tide underline">Contact an agent directly</Link>.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
