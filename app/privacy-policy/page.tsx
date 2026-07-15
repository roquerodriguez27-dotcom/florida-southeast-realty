import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Florida Southeast Realty, Inc. collects, uses, and protects your information.",
  alternates: { canonical: "/privacy-policy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-6">Privacy Policy</h1>
        <p className="text-sm text-brass bg-brass/10 border border-brass/30 rounded-sm px-4 py-3 mb-8">
          This page is a template and has not been reviewed by legal counsel. Replace it with a
          policy reviewed by a Florida-licensed attorney before this site goes live.
        </p>

        <div className="prose-like space-y-6 text-ink/80 leading-relaxed text-sm">
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Information we collect</h2>
            <p>
              When you submit a form on this site — a home valuation request, a contact message,
              a property inquiry, or a buyer inquiry — we collect the information you provide,
              which may include your name, email address, phone number, and property address.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">How we use it</h2>
            <p>
              We use the information you submit to respond to your inquiry, provide the
              valuation, listing information, or representation you requested, and to follow up
              about related services. We do not sell your personal information to third parties.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Cookies and analytics</h2>
            <p>
              This site may use analytics tools to understand how visitors use it. No analytics
              provider is currently configured in this project; when one is added, it will be
              named here along with what it collects.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Your choices</h2>
            <p>
              You can request a copy of the information we hold about you, ask us to correct it,
              or ask us to delete it, by contacting us at{" "}
              <a href="mailto:hello@floridasoutheastrealty.com" className="text-tide underline">
                hello@floridasoutheastrealty.com
              </a>
              .
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Contact</h2>
            <p>Florida Southeast Realty, Inc. · 215 Las Olas Blvd, Suite 400, Fort Lauderdale, FL 33301</p>
          </section>
        </div>
      </div>
    </div>
  );
}
