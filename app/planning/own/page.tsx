import type { Metadata } from "next";
import Link from "next/link";
import HomeownerCalendar from "@/components/planning/HomeownerCalendar";
import { PBC_IMPORTANT_DATES_URL } from "@/lib/planning/calendar";

export const metadata: Metadata = {
  title: "Homeowner Calendar & Palm Beach County Resources",
  description: "Keep the 2027 homestead filing date and your own insurance and maintenance dates in a downloadable calendar. Find official Palm Beach County owner resources.",
  alternates: { canonical: "/planning/own" },
};

export default function OwnerPlanningPage() {
  return (
    <div className="pb-20">
      <section className="container-fsre pb-10 pt-32 sm:pb-14">
        <Link href="/planning" className="text-sm text-tide underline underline-offset-4">Your planning workspace</Link>
        <p className="mt-7 font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">Own with a plan</p>
        <h1 className="mt-3 max-w-4xl font-display text-4xl leading-tight text-tide sm:text-5xl">Stay organized after you buy your home.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink/70">Set reminders for insurance, maintenance and tax-related deadlines. Find official resources for property records and homeownership questions, without having to search for them yourself.</p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <a href="#calendar" className="rounded-sm bg-tide px-5 py-3 font-medium text-white">Build my calendar</a>
          <Link href="/research/homeowner-updates" className="px-1 py-3 text-tide underline underline-offset-4">Read Florida Homeowner Updates</Link>
        </div>
      </section>

      <div className="container-fsre">
        <HomeownerCalendar />

        <section className="mt-12 grid gap-6 lg:grid-cols-2" aria-label="Official Palm Beach County owner resources">
          <article id="property-alerts" className="scroll-mt-28 rounded-sm border border-tide/15 bg-keystone/55 p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-hibiscus">Official county service</p>
            <h2 className="mt-3 font-display text-2xl text-tide">Free property-fraud alerts</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/75">The Palm Beach County Clerk’s service sends email notices when recorded documents match the name, address or parcel number you register. The owner signs up directly with the Clerk and completes the email confirmation.</p>
            <p className="mt-3 text-sm leading-relaxed text-ink/75">These notices help you spot recording activity. They do not prevent a document from being recorded or guarantee protection against fraud. Review each alert and follow the Clerk’s instructions if something is unfamiliar.</p>
            <a href="https://www.mypalmbeachclerk.com/services/property-fraud-alert" target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-tide underline underline-offset-4">Read the Clerk’s instructions and register<span className="sr-only"> (opens in a new tab)</span></a>
          </article>
          <article className="rounded-sm border border-tide/15 bg-white p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-hibiscus">Property-tax planning</p>
            <h2 className="mt-3 font-display text-2xl text-tide">Use the county’s estimate, then confirm the details</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/75">The Palm Beach County Property Appraiser’s Amendment 3 calculator is intended for properties currently receiving a homestead exemption. Its results are estimates, not an official tax calculation or a guarantee of savings.</p>
            <p className="mt-3 text-sm leading-relaxed text-ink/75">The estimator is a planning resource. Follow our dated homeowner update for the election’s certification status, and confirm your property’s eligibility with the Property Appraiser.</p>
            <a href="https://pbcpao.gov/Property/Amendment3Calculator" target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-tide underline underline-offset-4">Open the official Amendment 3 estimator<span className="sr-only"> (opens in a new tab)</span></a>
          </article>
        </section>

        <section className="mt-12 border-t border-ink/15 pt-8" aria-labelledby="owner-records-title">
          <h2 id="owner-records-title" className="font-display text-3xl text-tide">Keep important home documents together</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div><h3 className="font-semibold text-tide">Property taxes</h3><p className="mt-2 text-sm leading-relaxed text-ink/70">Keep your TRIM notice, exemption correspondence and tax bill together. Check the actual notice for the applicable appeal or payment deadline.</p></div>
            <div><h3 className="font-semibold text-tide">Insurance</h3><p className="mt-2 text-sm leading-relaxed text-ink/70">Keep declarations, renewal terms, inspection requests and agent contact information. Confirm when you need to act before the policy renews.</p></div>
            <div><h3 className="font-semibold text-tide">Association and maintenance</h3><p className="mt-2 text-sm leading-relaxed text-ink/70">Keep budgets, reserve information, assessment notices, warranties and service records. Put dates from your own documents into your calendar.</p></div>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-ink/65">This planner does not assign exact TRIM, appeal or tax-bill deadlines. <a href={PBC_IMPORTANT_DATES_URL} target="_blank" rel="noopener noreferrer" className="text-tide underline underline-offset-4">Use the Property Appraiser’s official calendar<span className="sr-only"> (opens in a new tab)</span></a> and the instructions on your notice.</p>
        </section>
        <aside className="mt-10 rounded-sm bg-tide p-6 text-sand sm:p-8">
          <h2 className="font-display text-2xl">Have a question about the next step?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sand/75">Roque can help organize the property questions and identify the records or specialist you may need.</p>
          <Link href="/ask-roque" className="mt-5 inline-block rounded-sm bg-sand px-5 py-3 text-sm font-semibold text-tide">Ask Roque</Link>
        </aside>
      </div>
    </div>
  );
}
