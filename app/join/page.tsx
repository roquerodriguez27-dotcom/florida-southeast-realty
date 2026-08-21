import type { Metadata } from "next";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Join Our Team",
  description:
    "Explore agent opportunities with Florida Southeast Realty: flexible commission options, direct broker support, modern technology, and a confidential conversation.",
  alternates: { canonical: "/join" },
};

const BENEFITS = [
  {
    number: "01",
    title: "Commission options built for producers",
    body: "100% commission plan options are available. Every brokerage, transaction, and administrative fee is reviewed with you in writing before you make a decision.",
  },
  {
    number: "02",
    title: "Direct access to your broker",
    body: "Get practical guidance directly from Roque Rodriguez, whose real estate experience dates to 1997—not a support ticket or an anonymous call center.",
  },
  {
    number: "03",
    title: "Company-generated opportunities",
    body: "Website and advertising inquiries can be routed to agents based on location, experience, responsiveness, and availability. Lead volume is never guaranteed.",
  },
  {
    number: "04",
    title: "A modern follow-up system",
    body: "Use organized CRM workflows, saved-search activity, and AI-assisted follow-up so good opportunities are less likely to slip away.",
  },
  {
    number: "05",
    title: "Training you can use",
    body: "Sharpen prospecting, follow-up, listing presentations, negotiation, and transaction management with practical coaching tied to real business.",
  },
  {
    number: "06",
    title: "Clear transaction support",
    body: "Know what is needed, when it is due, and who to call. Complete files move through a straightforward process designed for prompt commission processing.",
  },
  {
    number: "07",
    title: "A brand that helps you compete",
    body: "Work under a clean, modern South Florida identity while continuing to build your own name, relationships, and sphere of influence.",
  },
  {
    number: "08",
    title: "Room to grow with the company",
    body: "Join an independent brokerage where strong agents can help shape systems, market coverage, and future opportunities as the team expands.",
  },
] as const;

const STEPS = [
  {
    number: "1",
    title: "Send a confidential inquiry",
    body: "Tell us where you are in your career and what you want from your next brokerage.",
  },
  {
    number: "2",
    title: "Speak directly with Roque",
    body: "Have a private, no-pressure conversation about your goals, support needs, and business plan.",
  },
  {
    number: "3",
    title: "Review every term in writing",
    body: "Compare the commission plan, fees, technology, responsibilities, and onboarding requirements before deciding.",
  },
] as const;

const FAQS = [
  {
    question: "Do you offer a 100% commission plan?",
    answer:
      "Yes, 100% commission options are available. That does not mean every cost disappears: transaction, administrative, technology, E&O, association, MLS, or third-party expenses may apply depending on the plan and your business. The exact brokerage fees and conditions are disclosed in writing before you join.",
  },
  {
    question: "Are leads guaranteed?",
    answer:
      "No. Florida Southeast Realty invests in its website, advertising, and follow-up systems, and company-generated opportunities may be routed to participating agents. No specific number, quality, or closing rate is promised.",
  },
  {
    question: "Is my inquiry confidential?",
    answer:
      "Yes. We will not contact your current brokerage. Your information is used to evaluate fit and arrange a conversation, subject to ordinary legal and operational recordkeeping requirements.",
  },
  {
    question: "Do I need an active Florida real estate license?",
    answer:
      "You need an active Florida license and must satisfy all brokerage onboarding requirements before conducting brokerage activity. If you are currently completing your licensing, you can still start a conversation about the path ahead.",
  },
  {
    question: "Is there a production minimum?",
    answer:
      "Any expectations depend on the role and commission plan being considered. This page does not create or imply a production requirement; the details are discussed privately and confirmed in writing.",
  },
  {
    question: "What happens after I apply?",
    answer:
      "If there appears to be a mutual fit, Roque will contact you for a confidential conversation. There is no obligation, and submitting the form does not create an employment, contractor, or brokerage relationship.",
  },
] as const;

const TECHNOLOGY = [
  ["Lead capture", "Website and advertising inquiries organized for timely response."],
  ["CRM visibility", "Contacts, notes, saved searches, and follow-up tasks in one workflow."],
  ["AI assistance", "Draft outreach and reminders that support—not replace—your judgment."],
  ["Agent insights", "A growing dashboard for client activity and business priorities."],
] as const;

export default function JoinPage() {
  return (
    <div className="pb-24">
      <section className="relative overflow-hidden bg-tide pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-tide-light/70 to-transparent" />
        <div className="absolute -right-28 top-20 h-80 w-80 rounded-full border border-brass/20" />
        <div className="absolute -right-12 top-36 h-52 w-52 rounded-full border border-sand/10" />
        <div className="container-fsre relative">
          <div className="max-w-4xl">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-brass">
              Careers at Florida Southeast Realty
            </p>
            <h1 className="max-w-3xl font-display text-4xl leading-[1.05] text-sand md:text-6xl">
              Keep more. Close more. Build a business that is yours.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-sand/80 md:text-xl">
              A tech-forward, independent South Florida brokerage for agents who want clear
              economics, direct broker support, and fewer layers between a good opportunity and a
              closed transaction.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#apply" className="rounded-sm bg-hibiscus px-6 py-3.5 text-center text-sm font-medium text-sand transition-colors hover:bg-hibiscus-dark">
                Start a Confidential Conversation
              </a>
              <Link href="/contact" className="rounded-sm border border-sand/30 px-6 py-3.5 text-center text-sm font-medium text-sand transition-colors hover:border-sand/60 hover:bg-white/5">
                Contact the Broker
              </Link>
            </div>
            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-sand/50">
              No pressure and no obligation. Commission plans, fees, technology availability, and
              onboarding requirements are reviewed before you join.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-ink/10 bg-white">
        <div className="container-fsre grid gap-px bg-ink/10 sm:grid-cols-3">
          {[
            ["100%", "Commission options available"],
            ["Direct", "Broker access"],
            ["Modern", "Marketing and follow-up"],
          ].map(([value, label]) => (
            <div key={label} className="bg-white px-6 py-7 text-center">
              <p className="font-display text-2xl text-tide">{value}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-ink/55">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-fsre py-20 md:py-24">
        <div className="max-w-2xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-hibiscus">Why Florida Southeast Realty</p>
          <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">The support you need. The independence you want.</h2>
          <p className="mt-4 leading-relaxed text-ink/65">
            We build around agent productivity—not layers of management, vague fees, or technology
            that creates more work than it removes.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-ink/10 bg-ink/10 md:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <article key={benefit.number} className="bg-sand p-6 md:p-8">
              <p className="font-mono text-xs text-brass">{benefit.number}</p>
              <h3 className="mt-3 font-display text-xl text-tide">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{benefit.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-keystone py-20 md:py-24">
        <div className="container-fsre grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-hibiscus">Technology with a purpose</p>
            <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">Less busywork. More consistent follow-up.</h2>
            <p className="mt-5 leading-relaxed text-ink/70">
              The goal is a connected path from the first inquiry to the next conversation,
              property alert, appointment, and closing—not another disconnected stack of apps.
            </p>
            <div className="mt-6 border-l-2 border-brass pl-4 text-sm leading-relaxed text-ink/60">
              Availability can vary by workflow and plan. We will tell you what is live today, what
              is planned, and what requires a separate subscription.
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {TECHNOLOGY.map(([title, body]) => (
              <div key={title} className="rounded-sm border border-ink/10 bg-white p-6">
                <div className="mb-5 h-1 w-10 bg-hibiscus" />
                <h3 className="font-display text-lg text-tide">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-fsre py-20 md:py-24">
        <div className="text-center">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-hibiscus">A straightforward process</p>
          <h2 className="font-display text-3xl text-ink md:text-4xl">Three steps. No surprises.</h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="border-t border-brass pt-6">
              <span className="font-mono text-sm text-hibiscus">{step.number.padStart(2, "0")}</span>
              <h3 className="mt-3 font-display text-xl text-tide">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-tide py-20 md:py-24">
        <div className="container-fsre grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-brass">Common questions</p>
            <h2 className="font-display text-3xl text-sand md:text-4xl">Know before you move.</h2>
            <p className="mt-4 max-w-md leading-relaxed text-sand/65">
              A brokerage change is a business decision. You deserve direct answers about the
              money, support, technology, and expectations.
            </p>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-sand">
                  {faq.question}
                  <span aria-hidden="true" className="text-xl font-light text-brass transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-2xl pt-3 text-sm leading-relaxed text-sand/65">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="apply" className="scroll-mt-24 bg-white py-20 md:py-24">
        <div className="container-fsre grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-hibiscus">Confidential inquiry</p>
            <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">Let&apos;s talk about what you are building.</h2>
            <p className="mt-5 leading-relaxed text-ink/70">
              Share enough for us to understand your goals. If there is a potential fit, Roque
              will follow up for a private conversation.
            </p>
            <div className="mt-8 rounded-sm border border-brass/30 bg-brass/10 p-5">
              <p className="font-medium text-tide">Your current brokerage will not be contacted.</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">
                Submitting this form does not create an employment, independent-contractor, or
                brokerage relationship and does not guarantee affiliation, leads, production, or income.
              </p>
            </div>
          </div>

          <LeadForm
            formName="agent-recruiting"
            submitLabel="Request a Confidential Call"
            successMessage="Thank you for your interest. If there appears to be a mutual fit, Roque will contact you privately to schedule a conversation."
            hiddenContext={{ source: "join-page", inquiryType: "agent-recruiting" }}
            fields={[
              { name: "name", label: "Full Name", type: "text", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel", required: true },
              {
                name: "license_status",
                label: "Florida License Status",
                type: "select",
                required: true,
                options: [
                  { value: "active-florida", label: "Active Florida license" },
                  { value: "inactive-florida", label: "Inactive Florida license" },
                  { value: "licensing", label: "Currently getting licensed" },
                  { value: "out-of-state", label: "Licensed in another state" },
                ],
              },
              {
                name: "experience",
                label: "Real Estate Experience",
                type: "select",
                required: true,
                options: [
                  { value: "new", label: "New / pre-production" },
                  { value: "1-2", label: "1–2 years" },
                  { value: "3-5", label: "3–5 years" },
                  { value: "6-10", label: "6–10 years" },
                  { value: "10-plus", label: "10+ years" },
                ],
              },
              { name: "current_brokerage", label: "Current Brokerage", type: "text" },
              { name: "primary_market", label: "Primary Market / Area", type: "text" },
              {
                name: "recent_production",
                label: "Closed Sides — Last 12 Months",
                type: "select",
                options: [
                  { value: "0", label: "0" },
                  { value: "1-5", label: "1–5" },
                  { value: "6-12", label: "6–12" },
                  { value: "13-24", label: "13–24" },
                  { value: "25-plus", label: "25+" },
                ],
              },
              {
                name: "goals",
                label: "What Are You Looking for in Your Next Brokerage?",
                type: "textarea",
                required: true,
                colSpan: 2,
                placeholder: "Tell us what would help you grow and what is missing today.",
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
