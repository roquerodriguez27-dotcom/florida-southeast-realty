import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms governing use of the Florida Southeast Realty, Inc. website.",
  alternates: { canonical: "/terms-of-use" },
  robots: { index: false, follow: true },
};

export default function TermsOfUsePage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-6">Terms of Use</h1>
        <p className="text-sm text-brass bg-brass/10 border border-brass/30 rounded-sm px-4 py-3 mb-8">
          This page is a template and has not been reviewed by legal counsel. Replace it with
          terms reviewed by a Florida-licensed attorney before this site goes live.
        </p>

        <div className="space-y-6 text-ink/80 leading-relaxed text-sm">
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Listing information</h2>
            <p>
              Sample property listings shown on this site are for demonstration purposes only and
              do not represent real, currently available inventory unless and until this site is
              connected to a live MLS/IDX feed. Once connected, information will be deemed
              reliable but not guaranteed, and should be independently verified.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">No representation agreement</h2>
            <p>
              Browsing this site, submitting a form, or requesting a home valuation does not, by
              itself, create a brokerage or representation relationship with Florida Southeast
              Realty, Inc. Representation begins only with a signed written agreement.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Commission disclosure</h2>
            <p>
              Any listing fee, commission rate, or compensation referenced on this site — including
              the 0.5% listing-side fee described on our seller page — is not set by law, is
              always negotiable, and is confirmed in a written listing agreement before it applies
              to any transaction.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Intellectual property</h2>
            <p>
              The content, design, and branding of this site belong to Florida Southeast Realty,
              Inc. and may not be reproduced without permission.
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
