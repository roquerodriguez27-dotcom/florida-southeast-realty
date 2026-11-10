import Link from "next/link";
import { requireCrmUser } from "@/lib/crm/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeOutcomes, type OutcomeActivity, type OutcomeLead } from "@/lib/crm/outcomes";

export const metadata = { title: "Inquiry & Contact Outcomes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OutcomesPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requireCrmUser();
  const { days: requestedDays } = await searchParams;
  const days = [30, 90, 365].includes(Number(requestedDays)) ? Number(requestedDays) : 90;
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const supabase = await createSupabaseServerClient();
  const leads: OutcomeLead[] = [];
  let leadCount = 0;
  for (let offset = 0; offset < 5000; offset += 500) {
    const { data, count, error } = await supabase.from("crm_leads")
      .select("id,form_name,status,created_at", { count: "exact" })
      .gte("created_at", since).lte("created_at", now.toISOString())
      .order("id", { ascending: false }).range(offset, offset + 499);
    if (error) throw error;
    leadCount = count ?? 0;
    leads.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  const activities: OutcomeActivity[] = [];
  let activityCount = 0;
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, count, error } = await supabase.from("crm_activities")
      .select("lead_id,kind,body,created_at", { count: "exact" })
      .in("kind", ["call", "email", "text", "meeting"])
      .like("body", "FSR outcome v1: %").gte("created_at", since).lte("created_at", now.toISOString())
      .order("id", { ascending: false }).range(offset, offset + 499);
    if (error) throw error;
    activityCount = count ?? 0;
    activities.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  const partial = leadCount > leads.length || activityCount > activities.length;
  const { totals, byForm } = summarizeOutcomes(leads, activities);
  const cards = [
    ["Inquiry records", totals.inquiries], ["Conversations recorded", totals.conversations],
    ["Appointments booked", totals.booked], ["Appointments held", totals.held], ["Currently marked closed", totals.closed],
  ];
  return (
    <main className="min-h-screen pt-28 pb-20 bg-keystone/50">
      <div className="container-fsre">
        <Link href="/crm" className="text-sm text-tide underline underline-offset-4">← Back to CRM</Link>
        <p className="mt-7 font-mono text-xs uppercase tracking-widest text-hibiscus">Private brokerage report</p>
        <h1 className="mt-3 font-display text-4xl text-tide">From inquiry to conversation.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink/65">Outcomes for inquiry records received in the last {days} days, within {user.role === "broker" ? "your brokerage's" : "your assigned-lead"} access. Conversations and appointments count only when recorded in the lead&apos;s contact-outcome form. Each inquiry record is counted once per outcome.</p>
        <div className="mt-5 flex flex-wrap gap-2">{[30,90,365].map((period) => <Link key={period} href={`/crm/outcomes?days=${period}`} className={`rounded-sm border px-4 py-2 text-sm ${days === period ? "bg-tide border-tide text-white" : "border-tide/20 bg-white text-tide"}`}>{period} days</Link>)}</div>
        <p className="mt-3 text-xs text-ink/50">As of {now.toISOString().slice(0,16).replace("T", " ")} UTC · Since {since.slice(0,16).replace("T", " ")} UTC</p>
        {partial && <p role="status" className="mt-5 border border-brass bg-brass/10 p-4 text-sm">Partial report: displaying {leads.length} of {leadCount} inquiry records and {activities.length} of {activityCount} outcome entries. Choose a shorter period. Counts below cover the loaded records only.</p>}
        <section className="mt-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4" aria-label="Recorded outcomes">{cards.map(([label, value]) => <div key={label} className="bg-white border border-ink/10 rounded-sm p-5"><p className="text-xs leading-relaxed text-ink/60">{label}</p><p className="mt-3 font-display text-4xl text-tide">{value}</p></div>)}</section>
        <section className="mt-9 bg-white border border-ink/10 rounded-sm p-5 md:p-7">
          <h2 className="font-display text-2xl text-tide">Which requests lead to recorded outcomes?</h2>
          <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-ink/15">{["Request type","Inquiries","Conversations","Booked","Held","Closed now"].map((heading) => <th key={heading} className="p-3 font-medium whitespace-nowrap">{heading}</th>)}</tr></thead><tbody>{byForm.map((row) => <tr key={row.form} className="border-b border-ink/10"><th scope="row" className="p-3 font-medium">{row.form.replaceAll("-", " ")}</th>{[row.inquiries,row.conversations,row.booked,row.held,row.closed].map((value,index) => <td key={index} className="p-3">{value}</td>)}</tr>)}</tbody></table></div>
          {!byForm.length && <p className="py-6 text-sm text-ink/55">No inquiry records in this period.</p>}
        </section>
        <div className="mt-7 max-w-4xl space-y-3 text-sm leading-relaxed text-ink/60">
          <p>{totals.attempted} inquiry records have a logged contact attempt. An unanswered call or sent message does not count as a two-way conversation. A held appointment also counts as a conversation; booking and attendance are recorded separately.</p>
          <p>These are inquiry records, not unique people. Multiple requests from one client can appear separately. Closed means the lead&apos;s current stage is marked closed; it does not verify a settlement, commission or revenue. Existing notes and completed tasks are not backfilled as conversations.</p>
          <p>Use <strong>Record a contact outcome</strong> on a lead after a real interaction. Keep using the stage and follow-up fields to manage the next step.</p>
        </div>
      </div>
    </main>
  );
}
