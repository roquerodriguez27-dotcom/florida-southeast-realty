import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import VoiceQuestion from "@/components/planning/VoiceQuestion";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Ask Roque | South Florida Buyer, Seller & Homeowner Questions",
  description: "Ask broker Roque Rodriguez about a South Florida purchase, sale, relocation or homeowner question. Start with practical FAQs and planning resources.",
  alternates: { canonical: "/ask-roque" },
};

const questions = [
  {
    question: "Where should I start if I am still deciding whether to buy?",
    answer: "Start with your timing, comfortable monthly cost and must-have property features. Include taxes, insurance, association costs and a maintenance allowance alongside the mortgage. Use written lender and insurance information to refine estimates before committing.",
    href: "/buyer-tools", link: "Compare the ownership costs",
  },
  {
    question: "What does the 0.5% listing-side fee mean?",
    answer: "Florida Southeast Realty advertises a 0.5% listing-side brokerage fee. Ask Roque for a written proposal describing the services and terms for your property. Commission rates are negotiable; any authorized buyer-broker compensation and other selling costs are separate. A net estimate should show those items individually.",
    href: "/sellers", link: "Review the seller service and fee",
  },
  {
    question: "How can I plan a move from New York or New Jersey?",
    answer: "Organize your housing budget, travel, sale or lease timing and the documents you need before a scouting trip. Compare communities using your own priorities, then evaluate individual properties and their ownership costs. Roque began his real estate career in New Jersey and now works from Boynton Beach.",
    href: "/guides/moving-from-new-york-new-jersey-to-palm-beach-county", link: "Read the relocation guide",
  },
  {
    question: "Which condo documents should I ask about?",
    answer: "Start with the current budget, reserve information, inspection and reserve-study reports, assessment notices and relevant association rules. The monthly fee is only one part of the picture. Ask the association and qualified advisers how the documents apply to the building and the unit you are considering.",
    href: "/research/homeowner-updates#condo-reserves-and-assessments", link: "Read the sourced condo checklist",
  },
  {
    question: "How do I keep track of homeowner deadlines?",
    answer: "Keep the official notice with each deadline, and add your insurance and maintenance dates to a calendar you already use. Our owner planner includes the 2027 Palm Beach County homestead filing date and exports a calendar file. Importing the file does not submit an application or enroll you in reminder emails.",
    href: "/planning/own", link: "Build a homeowner calendar",
  },
  {
    question: "Can I get a clear update while my home is listed?",
    answer: "Ask Roque to agree on a reporting day and the information you want: showing activity, documented feedback, relevant market changes, completed marketing work and the next decisions. Report figures should identify their source and date range. A website request begins that conversation; the reporting arrangement is confirmed with Roque.",
    href: "/planning/sell?tool=report", link: "Build a weekly seller report",
  },
];

export default function AskRoquePage() {
  return (
    <div className="pb-20">
      <section className="container-fsre pb-12 pt-32">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_280px] lg:gap-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">A direct conversation with your broker</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-tide sm:text-5xl">Ask Roque.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink/70">A property question, a possible move, or a decision you want to understand. Start where you are and tell {SITE.brokerName} what you are trying to work out.</p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink/65">Broker at {SITE.name} · Based in Boynton Beach · Serving Palm Beach and Broward counties.</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <a href="#ask-your-question" className="rounded-sm bg-tide px-5 py-3 font-medium text-white">Ask your question</a>
              <a href={SITE.phoneHref} className="px-1 py-3 text-tide underline underline-offset-4">Call {SITE.phoneDisplay}</a>
              <Link href="/about" className="px-1 py-3 text-tide underline underline-offset-4">Meet Roque</Link>
            </div>
          </div>
          <figure className="max-w-[280px] overflow-hidden rounded-sm border border-ink/10 bg-white">
            <Image src={SITE.brokerImage} alt={`${SITE.brokerName}, Broker of Florida Southeast Realty`} width={560} height={560} sizes="280px" className="aspect-square w-full object-cover" />
            <figcaption className="px-4 py-3 text-sm text-ink/70">{SITE.brokerName} · Broker</figcaption>
          </figure>
        </div>
      </section>

      <div className="container-fsre">
        <section id="ask-your-question" className="scroll-mt-28 rounded-sm border border-tide/15 bg-white p-5 sm:p-8" aria-labelledby="ask-question-title">
          <h2 id="ask-question-title" className="font-display text-3xl text-tide">What would you like to ask?</h2>
          <p className="mb-6 mt-3 max-w-3xl text-sm leading-relaxed text-ink/70">Include the decision, your timing, and any property or community you want to discuss. Keep account numbers, access codes and private documents out of the message.</p>
          <VoiceQuestion />
        </section>

        <section className="mt-12" aria-labelledby="broker-faq-title">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-hibiscus">Useful starting points</p>
          <h2 id="broker-faq-title" className="mt-2 font-display text-3xl text-tide">Questions that help organize the conversation</h2>
          <div className="mt-6 space-y-3">
            {questions.map((item) => (
              <details key={item.question} className="rounded-sm border border-tide/15 bg-white p-5 sm:p-6">
                <summary className="cursor-pointer font-display text-xl text-tide">{item.question}</summary>
                <p className="mt-4 max-w-4xl text-sm leading-relaxed text-ink/75">{item.answer}</p>
                <Link href={item.href} className="mt-4 inline-block text-sm font-semibold text-tide underline underline-offset-4">{item.link}</Link>
              </details>
            ))}
          </div>
        </section>
        <aside className="mt-10 rounded-sm bg-keystone p-6 sm:p-8">
          <h2 className="font-display text-2xl text-tide">Bring a plan you can review together</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/70">Use the planning workspace to organize the numbers, tradeoffs and dates. Save a copy, then choose what you want to send to Roque.</p>
          <Link href="/planning" className="mt-5 inline-block text-sm font-semibold text-tide underline underline-offset-4">Open the planning workspace</Link>
        </aside>
      </div>
    </div>
  );
}
