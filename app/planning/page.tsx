import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site-config";
import { HOMEOWNER_UPDATES_PATH } from "@/lib/homeowner-updates";

export const metadata: Metadata = {
  title: "Plan Your South Florida Move | Buyer, Seller & Homeowner Tools",
  description: "Work through selling proceeds, moving timelines, home costs, property research, offers and homeowner reminders with Florida Southeast Realty's free planning worksheets.",
  alternates: { canonical: "/planning" },
};

const paths = [
  { number: "01", title: "Buying a home", intro: "Bring the costs, questions and tour notes together before your next decision.", href: "/planning/buy", cta: "Open buyer planners", items: [
    ["Monthly costs & home comparison", "/buyer-tools"],
    ["Property research checklist", "/planning/buy?tool=checklist"],
    ["Relocation & visit planner", "/planning/buy?tool=relocation"],
    ["After-tour scorecard", "/planning/buy?tool=tour"],
    ["Loan Estimate comparison", "/planning/buy?tool=loans"],
  ] },
  { number: "02", title: "Selling a home", intro: "Compare scenarios, organize preparation and see the details behind each offer.", href: "/planning/sell", cta: "Open seller planners", items: [
    ["Three-price proceeds planner", "/planning/sell?tool=proceeds"],
    ["Sell first or buy first?", "/planning/sell?tool=timing"],
    ["Prepare-to-sell review", "/planning/sell?tool=prepare"],
    ["Seller offer comparison", "/planning/sell?tool=offers"],
    ["Weekly seller report", "/planning/sell?tool=report"],
  ] },
  { number: "03", title: "Owning a home", intro: "Keep useful dates and official property resources within reach after the move.", href: "/planning/own", cta: "Open homeowner resources", items: [
    ["Homeowner calendar", "/planning/own#calendar"],
    ["Florida homeowner updates", HOMEOWNER_UPDATES_PATH],
    ["Property-record alerts", "/planning/own#property-alerts"],
    ["Ask Roque a question", "/ask-roque"],
  ] },
];

export default function PlanningPage() {
  return (
    <main className="pt-24 md:pt-28 pb-20">
      <section className="bg-tide text-sand">
        <div className="container-fsre py-12 md:py-16 grid lg:grid-cols-[1.35fr_0.65fr] gap-10 items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-brass">Your next move, thought through</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl md:text-6xl leading-[1.08]">A clearer plan for buying, selling and owning.</h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-sand/75">Explore the numbers. Keep the questions that matter. Take a useful report into your next conversation with Roque.</p>
          </div>
          <div className="border-l border-brass/50 pl-6 text-sm text-sand/75 leading-relaxed">
            <p className="text-sand font-medium">Start wherever you are.</p>
            <p className="mt-2">Use the worksheets freely, save a report, or ask for a personal review. You choose when to send your details.</p>
            <Link href="/ask-roque" className="mt-5 inline-flex items-center gap-3 font-medium text-brass underline underline-offset-4">Ask Roque <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="container-fsre grid lg:grid-cols-3 gap-6 mt-10 md:mt-14" aria-label="Choose your planning tools">
        {paths.map((path) => (
          <article key={path.number} className="rounded-sm border border-tide/15 bg-white p-6 md:p-8 flex flex-col">
            <span className="font-mono text-sm text-brass">{path.number}</span>
            <h2 className="mt-4 font-display text-3xl text-tide">{path.title}</h2>
            <p className="mt-3 text-sm text-ink/65 leading-relaxed min-h-[4.5rem]">{path.intro}</p>
            <ul className="mt-5 mb-8 divide-y divide-ink/10">
              {path.items.map(([label, href]) => <li key={href}><Link href={href} className="flex items-center justify-between gap-3 py-3.5 text-sm text-tide hover:text-hibiscus"><span>{label}</span><span aria-hidden="true">↗</span></Link></li>)}
            </ul>
            <Link href={path.href} className="mt-auto rounded-sm bg-tide px-5 py-3 text-center text-sm font-medium text-white hover:bg-tide/90">{path.cta}</Link>
          </article>
        ))}
      </section>

      <section className="container-fsre mt-12 md:mt-16">
        <div className="grid md:grid-cols-3 gap-7 rounded-sm border border-brass/25 bg-keystone p-7 md:p-9">
          {[
            ["Put in your own details", "Use your numbers, documents and priorities. Unknown costs and unanswered questions stay visible."],
            ["Keep a useful record", "Print or save a report for your household, lender, insurance agent or next broker conversation."],
            ["Get a personal review", "Send the plan with your question and preferred contact method when you want Roque's help."],
          ].map(([title, body]) => <div key={title}><h2 className="font-display text-xl text-tide">{title}</h2><p className="mt-3 text-sm leading-relaxed text-ink/65">{body}</p></div>)}
        </div>
      </section>
      <section className="container-fsre mt-12 flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
        <div><h2 className="font-display text-2xl text-tide">Prefer to talk it through?</h2><p className="mt-2 text-sm text-ink/65">Roque Rodriguez · Florida Southeast Realty · Boynton Beach</p></div>
        <a href={SITE.phoneHref} className="rounded-sm bg-hibiscus px-6 py-3 font-medium text-white">Call {SITE.phoneDisplay}</a>
      </section>
    </main>
  );
}
