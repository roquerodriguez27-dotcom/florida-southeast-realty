import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Florida Real Estate Referral Status",
  description:
    "Florida real estate licensees interested in a referral-only relationship can contact Florida Southeast Realty to discuss current availability, requirements, fees, and referral terms.",
  alternates: { canonical: "/referral-status" },
};

const QUESTIONS = [
  "Whether a referral-only affiliation is currently available through the brokerage",
  "The current brokerage fee or annual cost, if any",
  "How referral compensation is documented and paid when a referred transaction closes",
  "What MLS, association, insurance, or other obligations may still apply to your individual situation",
  "What forms, license-transfer steps, and brokerage agreements are required before any referral activity begins",
];

export default function ReferralStatusPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <section className="container-fsre max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">For Florida Licensees</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight">Interested in referral-only status?</h1>
        <p className="text-lg text-ink/70 mt-5 max-w-3xl leading-relaxed">
          If you hold a Florida real estate license but do not want to actively list or show
          property, you can contact {SITE.name} to discuss whether a referral-only arrangement is
          currently available and what the current terms would be.
        </p>
      </section>

      <section className="container-fsre max-w-4xl py-12 grid lg:grid-cols-2 gap-8">
        <div className="bg-white border border-ink/10 rounded-sm p-6 md:p-8">
          <h2 className="font-display text-2xl text-ink">Questions to confirm first</h2>
          <ul className="space-y-3 mt-5">
            {QUESTIONS.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-ink/70 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-hibiscus shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-tide text-sand rounded-sm p-6 md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-brass">Current Terms</p>
          <h2 className="font-display text-2xl mt-2">Talk to the broker before making a change</h2>
          <p className="text-sand/75 text-sm leading-relaxed mt-4">
            Fees, referral splits, eligibility, brokerage requirements, and licensing procedures
            can change. This page does not promise a particular fee, referral percentage, or
            regulatory outcome. Confirm current terms directly with the brokerage and consult the
            appropriate Florida licensing resources for your situation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href="/contact" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-5 py-3 rounded-sm">Contact Roque</Link>
            <a href={SITE.phoneHref} className="border border-sand/30 text-sand font-medium text-center px-5 py-3 rounded-sm">Call {SITE.phoneDisplay}</a>
          </div>
        </div>
      </section>
    </div>
  );
}
