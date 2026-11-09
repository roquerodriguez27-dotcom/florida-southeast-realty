import Link from "next/link";
import { requireCrmBroker } from "@/lib/crm/auth";
import { parseVisitorReport, type ConversionCounts, type ConversionReport, type VisitorReport } from "@/lib/crm/analytics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AnalyticsDeviceControl from "./AnalyticsDeviceControl";

export const metadata = { title: "Visitor report · Broker CRM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
const conversionRows: Array<[keyof ConversionCounts, string]> = [
  ["formStarts", "Form starts"], ["submissionAttempts", "Submission attempts"],
  ["validationErrors", "Validation errors"], ["submissionErrors", "Submission failures"],
  ["successfulSubmissions", "Successful form submissions"], ["calls", "Call clicks"],
  ["texts", "Text clicks"], ["emails", "Email clicks"], ["legacyPhoneClicks", "Earlier combined call / text clicks"],
];
const formLabels: Record<string, string> = {
  contact: "Contact", "home-valuation": "Home valuation", "sellers-page": "Seller review",
  "buyer-inquiry": "Buyer search", "property-inquiry": "Property inquiry", "buyer-tools-review": "Buyer tools",
  "agent-recruiting": "Agent recruiting", unknown: "Earlier / unlabelled form",
};
const requestLabels: Record<string, string> = { showing: "Showing", question: "Question", shortlist: "Saved shortlist" };
const campaignLabels: Record<string, string> = {
  "seller-review": "Seller review", "buyer-search": "Buyer search", "property-share": "Shared property", referral: "Referral",
};

function ConversionActivity({ report }: { report: ConversionReport | null }) {
  return <section className="rounded-sm border border-ink/10 bg-white p-5">
    <h2 className="font-display text-xl text-tide">Inquiries and contact activity</h2>
    {!report ? <p className="mt-3 text-sm text-ink/65">Additional conversion measurements are not available yet. No conversion counts are inferred from missing data.</p> : <>
      <p className="mt-2 max-w-4xl text-sm text-ink/65">These are recorded events, not distinct prospects or a sequential conversion rate. The first column covers browsers with observed interaction and no automation indicator; unclassified browsers and probable automation remain separate.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Conversion event counts by browser classification</caption>
        <thead><tr className="border-b border-ink/10 text-xs text-ink/55">{["Activity", "Observed interaction", "Unclassified", "Probable automation"].map((label) => <th key={label} scope="col" className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>{conversionRows.map(([key, label]) => <tr key={key} className="border-b border-ink/5"><th scope="row" className="px-2 py-3 font-normal">{label}</th>{[report.observed, report.unclassified, report.automation].map((counts, index) => <td key={index} className="px-2 py-3">{number(counts[key])}</td>)}</tr>)}</tbody>
      </table></div>
      <p className="mt-3 text-xs leading-relaxed text-ink/60">Form starts, attempts, failures, separate call/text events and form labels are collected prospectively from the conversion update. Older activity is not reconstructed. Repeated attempts can produce several events; a call, text or email click does not confirm a conversation. Browser-reported successes can be missed or blocked. <Link href="/crm" className="text-tide underline underline-offset-2">Review the CRM</Link> for stored requests, qualification and follow-up; tests and vendor pitches are not customer leads.</p>
      <h3 className="mt-6 font-medium text-tide">Forms · observed interaction</h3>
      {report.forms.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Form activity for browsers with observed interaction and no automation indicator</caption>
        <thead><tr className="border-b border-ink/10 text-xs text-ink/55">{["Form", "Request", "Starts", "Attempts", "Validation", "Failures", "Successes"].map((label) => <th key={label} scope="col" className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>{report.forms.map((form) => <tr key={`${form.formName}:${form.requestType}`} className="border-b border-ink/5"><th scope="row" className="px-2 py-3 font-normal">{formLabels[form.formName]}</th><td className="px-2 py-3">{requestLabels[form.requestType] ?? "—"}</td>{[form.formStarts, form.submissionAttempts, form.validationErrors, form.submissionErrors, form.successfulSubmissions].map((count, index) => <td key={index} className="px-2 py-3">{number(count)}</td>)}</tr>)}</tbody>
      </table></div> : <p className="mt-2 text-sm text-ink/60">No qualifying form activity recorded in this period yet.</p>}
      <h3 className="mt-6 font-medium text-tide">Labelled campaigns · observed interaction</h3>
      {report.campaigns.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Activity associated with explicitly labelled campaign links</caption>
        <thead><tr className="border-b border-ink/10 text-xs text-ink/55">{["Campaign label", "Pageviews", "Form successes", "Contact clicks"].map((label) => <th key={label} scope="col" className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>{report.campaigns.map((campaign) => <tr key={campaign.campaign} className="border-b border-ink/5"><th scope="row" className="px-2 py-3 font-normal">{campaignLabels[campaign.campaign]}</th>{[campaign.pageviews, campaign.submissions, campaign.contactClicks].map((count, index) => <td key={index} className="px-2 py-3">{number(count)}</td>)}</tr>)}</tbody>
      </table></div> : <p className="mt-2 text-sm text-ink/60">No activity from labelled campaign links recorded in this period yet.</p>}
      <p className="mt-3 text-xs text-ink/55">Only the fixed seller-review, buyer-search, property-share and referral labels are retained, for the current browser session. Unlabelled traffic is not assigned a source. These labels identify links, not verified identities or advertising attribution.</p>
    </>}
  </section>;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireCrmBroker();
  const params = await searchParams;
  const days = params.days === "30" ? 30 : 7;
  let report: VisitorReport | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.rpc("get_site_analytics_report", { p_days: days });
    if (!result.error) report = parseVisitorReport(result.data);
    if (!report) console.error("Visitor report unavailable", { code: result.error?.code ?? "invalid_report" });
  } catch { console.error("Visitor report unavailable"); }
  const cards = report ? [
    ["Approximate unique browsers", report.current.browsers, "Distinct stored browser IDs in current measurement; not a count of people."],
    ["Browsers with observed interaction", report.current.interactionBrowsers, "A trusted pointer or keyboard event was observed, with no automation indicator. This does not verify a human."],
    ["Probable automation", report.current.probableAutomationBrowsers, "Browser IDs with a bot user agent or WebDriver indicator. Some automation will go undetected."],
    ["Unclassified browsers", report.current.unclassifiedBrowsers, "No qualifying interaction or automation signal was recorded."],
    ["Pageviews", report.current.pageviews, "Recorded public-page navigations, including query changes and probable automation."],
    ["Property searches", report.current.searches, "Recorded visits to property results with search parameters; includes pagination and filter changes."],
    ["Lead form submissions", report.current.leads, "Successful submissions reported by the browser. Use CRM lead records for authoritative totals."],
    ["Saved-search submissions", report.current.savedSearches, "Successful saved-search submissions reported by the browser; separate from lead-form submissions."],
  ] as const : [];
  return (
    <main className="min-h-screen bg-[#eef0e9] text-ink">
      <header className="border-b border-white/10 bg-tide text-sand">
        <div className="container-fsre flex flex-wrap items-center justify-between gap-4 py-5">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">Broker CRM · Private</p><h1 className="mt-1 font-display text-3xl">Visitor report</h1></div>
          <Link href="/crm" className="rounded-sm border border-white/25 px-4 py-2 text-sm hover:bg-white/10">Back to CRM</Link>
        </div>
      </header>
      <div className="container-fsre space-y-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-ink/65">Browser estimates and activity from the public production website. Preview deployments, local testing, signed-in CRM sessions and opted-out browsers are excluded from new measurement.</p>
          <nav aria-label="Report period" className="flex gap-2">{[7, 30].map((period) => <Link key={period} href={`/crm/analytics?days=${period}`} aria-current={days === period ? "page" : undefined} className={`rounded-sm border px-4 py-2 text-sm ${days === period ? "border-tide bg-tide text-white" : "border-ink/15 bg-white"}`}>Last {period} days</Link>)}</nav>
        </div>
        {!report ? (
          <section role="status" className="rounded-sm border border-brass/40 bg-white p-6">
            <h2 className="font-display text-2xl text-tide">Report temporarily unavailable</h2>
            <p className="mt-2 text-sm text-ink/65">The reporting service could not return a complete result. No visitor counts are shown. Refresh this page to try again.</p>
          </section>
        ) : <>
          <section className="rounded-sm border border-ink/10 bg-white p-5">
            <h2 className="font-display text-xl text-tide">Current measurement</h2>
            <p className="mt-2 text-sm text-ink/65">Only events collected with the new production and exclusion checks appear below. Older records are shown separately. A zero means no qualifying event was recorded; blocking, cleared storage and missed events can affect every count.</p>
            <p className="mt-2 text-xs text-ink/55">Rolling period: {dateTime(report.from)} through {dateTime(report.generatedAt)} UTC · {number(report.current.sessions)} recorded browser sessions</p>
          </section>
          <section aria-label="Visitor measurements" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, count, description]) => <article key={label} className="rounded-sm border border-ink/10 bg-white p-5"><h3 className="text-sm font-medium text-tide">{label}</h3><p className="mt-3 font-display text-4xl text-tide">{number(count)}</p><p className="mt-3 text-xs leading-relaxed text-ink/60">{description}</p></article>)}
          </section>
          <p className="text-xs leading-relaxed text-ink/60">The three browser classifications are mutually exclusive for this period; an automation indicator takes precedence. One person can use several browsers, and several people can share one browser. Interaction is a signal, not proof of identity or humanity. No raw visitor IDs, contact information or search text appear in this report.</p>
          <ConversionActivity report={report.conversion} />
          <section className="rounded-sm border border-brass/40 bg-white p-5">
            <h2 className="font-display text-xl text-tide">Earlier measurement · quality unknown</h2>
            <p className="mt-2 text-sm text-ink/65"><strong>{number(report.legacy.browsers)} approximate browser IDs</strong> across <strong>{number(report.legacy.events)} recorded events</strong> in the selected period were collected without the new checks. These records may include staff, testing and automation, and cannot establish human visitors.</p>
            <p className="mt-2 text-xs text-ink/55">These IDs can overlap with current measurement. Do not add the two browser counts together.</p>
          </section>
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <section className="overflow-hidden rounded-sm border border-ink/10 bg-white p-5">
              <h2 className="font-display text-xl text-tide">Daily activity · UTC</h2>
              {report.daily.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-ink/10 text-xs text-ink/55">{["Date", "Browsers", "Pageviews", "Searches", "Leads"].map((label) => <th key={label} scope="col" className="px-2 py-2 font-medium">{label}</th>)}</tr></thead><tbody>{report.daily.map((day) => <tr key={day.date} className="border-b border-ink/5"><th scope="row" className="whitespace-nowrap px-2 py-3 font-normal">{day.date}</th>{[day.browsers, day.pageviews, day.searches, day.leads].map((count, index) => <td key={index} className="px-2 py-3">{number(count)}</td>)}</tr>)}</tbody></table><p className="mt-3 text-xs text-ink/55">Only days with recorded current-measurement activity are shown. Daily browser counts cannot be added to calculate unique browsers across the period.</p></div> : <p className="mt-3 text-sm text-ink/60">No current-measurement activity recorded in this period yet.</p>}
            </section>
            <section className="rounded-sm border border-ink/10 bg-white p-5"><h2 className="font-display text-xl text-tide">Most-viewed page groups</h2>{report.topPages.length ? <ul className="mt-3 divide-y divide-ink/10">{report.topPages.map((page) => <li key={page.path} className="flex justify-between gap-4 py-3 text-sm"><span className="break-all">{page.path}</span><span>{number(page.pageviews)}</span></li>)}</ul> : <p className="mt-3 text-sm text-ink/60">No current-measurement pageviews recorded yet.</p>}<p className="mt-3 text-xs text-ink/55">Individual listings and articles are grouped. Search strings are discarded.</p></section>
          </div>
        </>}
        <AnalyticsDeviceControl />
      </div>
    </main>
  );
}
