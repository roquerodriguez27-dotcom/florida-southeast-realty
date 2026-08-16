import type { Metadata } from "next";
import EqualHousingMark from "@/components/EqualHousingMark";
import { SITE, SITE_ADDRESS_LINE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Fair Housing & Equal Opportunity",
  description: `Equal housing opportunity statement and assistance information for ${SITE.name}.`,
  alternates: { canonical: "/fair-housing" },
};

export default function FairHousingPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre max-w-3xl">
        <EqualHousingMark className="mb-8" />
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-4">Fair Housing &amp; Equal Opportunity</h1>

        <div className="space-y-7 text-ink/80 leading-relaxed text-sm">
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Our commitment</h2>
            <p>
              {SITE.name} is committed to providing equal professional service and equal housing
              opportunity. We do not discriminate in housing-related services or advertising based
              on race, color, national origin, religion, sex, familial status, disability, or any
              other status protected by applicable federal, state, or local law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Research and property searches</h2>
            <p>
              Property, community, school, transportation, flood, and public-record tools are offered
              to help visitors review objective information and make their own housing decisions. We
              do not steer clients or characterize areas according to the presence or absence of a
              protected class.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Accessibility and accommodations</h2>
            <p>
              If you need a reasonable accommodation, an accessible communication method, or help
              using this website, contact us at <a href={SITE.phoneHref} className="text-tide underline">{SITE.phoneDisplay}</a>
              {" "}or <a href={`mailto:${SITE.email}`} className="text-tide underline">{SITE.email}</a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Fair housing assistance</h2>
            <p>
              Information and complaint assistance are available from the{" "}
              <a href="https://www.hud.gov/helping-americans/fair-housing-complaints" target="_blank" rel="noreferrer" className="text-tide underline">
                U.S. Department of Housing and Urban Development
              </a>
              {" "}and the{" "}
              <a href="https://fchr.myflorida.com/housing-complaint" target="_blank" rel="noreferrer" className="text-tide underline">
                Florida Commission on Human Relations
              </a>.
            </p>
          </section>

          <section className="border-t border-ink/10 pt-6">
            <p>{SITE.name} · {SITE_ADDRESS_LINE}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
