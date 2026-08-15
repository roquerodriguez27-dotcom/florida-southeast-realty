import type { Metadata } from "next";
import { SITE, SITE_ADDRESS_LINE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms governing use of the Florida Southeast Realty, Inc. website and its real estate information.",
  alternates: { canonical: "/terms-of-use" },
  robots: { index: false, follow: true },
};

export default function TermsOfUsePage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre max-w-3xl">
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-2">Terms of Use</h1>
        <p className="text-xs text-ink/45 mb-8">Last updated August 15, 2026</p>

        <div className="space-y-7 text-ink/80 leading-relaxed text-sm">
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Website information</h2>
            <p>
              This website is provided for general real estate information and to help users contact
              {" "}{SITE.name} Information can change without notice. Property, neighborhood, school,
              flood, tax, permit, insurance, association, and market information should be independently
              verified with the applicable source or qualified professional before you rely on it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">MLS and property information</h2>
            <p>
              When live MLS/IDX data is displayed, it is subject to the applicable MLS rules,
              disclosures, attribution requirements, and data-use limitations. Listing information
              may change, be withdrawn, go under contract, or become unavailable. Information is
              considered reliable only to the extent stated by the applicable source and is not guaranteed.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">No brokerage relationship by browsing</h2>
            <p>
              Browsing this site, using a research link, requesting information, or submitting a form
              does not by itself create a brokerage, agency, fiduciary, or representation relationship.
              Any representation relationship is established only through the appropriate written agreement.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Commission and fee disclosure</h2>
            <p>
              Real estate commissions and brokerage fees are negotiable and are not set by law.
              Florida Southeast Realty&apos;s advertised 0.5% fee is a listing-side brokerage fee only.
              Any buyer-broker compensation authorized by a seller is separate and negotiable. The
              services, fees, and terms that apply to a particular property are set out in the written agreement.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Third-party research links</h2>
            <p>
              The site links to government agencies and third-party services for research convenience.
              Those sites are operated independently, and Florida Southeast Realty does not control,
              warrant, or endorse every piece of information they display. Their terms and privacy policies apply.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Fair housing and neighborhood research</h2>
            <p>
              Florida Southeast Realty supports fair housing. Neighborhood and school research tools are
              provided so users can review objective information and make their own decisions. We do not
              characterize a neighborhood or school as “good,” “bad,” “safe,” or “unsafe” for a protected class.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Intellectual property</h2>
            <p>
              Unless otherwise identified, the original website design, branding, and written content are
              owned by or licensed to {SITE.name} MLS data, government data, photographs, logos, and other
              third-party materials remain subject to their respective ownership and license terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Contact</h2>
            <p>
              {SITE.name} · {SITE_ADDRESS_LINE} · <a href={SITE.phoneHref} className="text-tide underline">{SITE.phoneDisplay}</a> ·{" "}
              <a href={`mailto:${SITE.email}`} className="text-tide underline">{SITE.email}</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
