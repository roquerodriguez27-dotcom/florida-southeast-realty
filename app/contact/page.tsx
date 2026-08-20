import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";
import { SITE, SITE_ADDRESS_LINE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact a South Florida Real Estate Broker",
  description:
    "Contact Roque Rodriguez, Broker at Florida Southeast Realty, about buying, selling, relocating, or researching South Florida real estate.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Contact</p>
          <h1 className="font-display text-3xl md:text-5xl text-ink mb-6">Talk directly with a South Florida broker</h1>
          <p className="text-ink/70 max-w-lg mb-8 leading-relaxed">
            Buying, selling, relocating, or researching a neighborhood? Reach Florida Southeast
            Realty directly. Tell us what you are trying to accomplish and we&apos;ll help you map the
            next step.
          </p>

          <dl className="space-y-5 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Brokerage</dt>
              <dd className="text-ink/80 mt-1">{SITE.name}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Broker</dt>
              <dd className="text-ink/80 mt-1">{SITE.brokerName}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Office</dt>
              <dd className="text-ink/80 mt-1">{SITE_ADDRESS_LINE}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Phone</dt>
              <dd className="mt-1"><a href={SITE.phoneHref} className="text-tide underline underline-offset-4">{SITE.phoneDisplay}</a></dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Email</dt>
              <dd className="mt-1"><a href={`mailto:${SITE.email}`} className="text-tide underline underline-offset-4">{SITE.email}</a></dd>
            </div>
          </dl>
        </div>

        <LeadForm
          formName="contact"
          submitLabel="Send Message"
          successMessage="Thanks for reaching out. Florida Southeast Realty will follow up about your request."
          fields={[
            { name: "name", label: "Name", type: "text", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "email", label: "Email", type: "email", required: true, colSpan: 2 },
            {
              name: "interest",
              label: "I'm interested in",
              type: "select",
              colSpan: 2,
              options: [
                { value: "buying", label: "Buying a home" },
                { value: "selling", label: "Selling a home" },
                { value: "valuation", label: "A home valuation" },
                { value: "relocating", label: "Relocating to South Florida" },
                { value: "research", label: "Neighborhood or property research" },
              ],
            },
            { name: "message", label: "Message", type: "textarea", colSpan: 2, required: true },
          ]}
        />
      </div>
    </div>
  );
}
