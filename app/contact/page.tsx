import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Contact Us | Florida Southeast Realty",
  description: "Reach Florida Southeast Realty's Fort Lauderdale office by phone, email, or inquiry form.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Contact</p>
          <h1 className="font-display text-3xl md:text-4xl text-ink mb-6">Let&apos;s talk about your next move</h1>
          <p className="text-ink/70 max-w-md mb-8">
            Buying, selling, or just scoping out a neighborhood — reach a real agent, not a call
            center. We typically respond within a few hours during business days.
          </p>

          <dl className="space-y-5 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Brokerage</dt>
              <dd className="text-ink/80 mt-1">Florida Southeast Realty, Inc.</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Office</dt>
              <dd className="text-ink/80 mt-1">215 Las Olas Blvd, Suite 400, Fort Lauderdale, FL 33301</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Phone</dt>
              <dd className="mt-1"><a href="tel:+19545550100" className="text-tide">(954) 555-0100</a></dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Email</dt>
              <dd className="mt-1"><a href="mailto:hello@floridasoutheastrealty.com" className="text-tide">hello@floridasoutheastrealty.com</a></dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/45">Hours</dt>
              <dd className="text-ink/80 mt-1">Monday–Saturday, 9am–6pm ET. Showings by appointment, evenings and Sundays included.</dd>
            </div>
          </dl>
        </div>

        <LeadForm
          formName="contact"
          submitLabel="Send Message"
          successMessage="Thanks for reaching out — an agent will follow up shortly."
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
                { value: "relocating", label: "Relocating to the area" },
              ],
            },
            { name: "message", label: "Message", type: "textarea", colSpan: 2 },
          ]}
        />
      </div>
    </div>
  );
}
