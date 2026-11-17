import Link from "next/link";
import { requireCrmBroker } from "@/lib/crm/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type CrmFollowUp, FOLLOW_UP_LABELS, followUpCanEdit, followUpNeedsAttention } from "@/lib/crm/follow-up";
import FollowUpEditor from "@/components/crm/FollowUpEditor";
import { createFollowUpTest, sendListingAlertTest, stopFollowUp } from "./actions";

export const metadata = { title: "Reply drafts | Broker CRM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  saved: "Draft saved. Review the saved version before sending.",
  changed: "This inquiry or draft changed. Refresh and review its current status before taking another action.",
  unavailable: "That change could not be confirmed. Refresh the page to check its status.",
  invalid: "Check the draft and try saving again. A subject and reply are required.",
  approval_required: "Review the saved reply and check the approval box before sending.",
  email_unavailable: "Email sending is not configured. Your draft is still saved.",
  accepted: "The email service accepted this reply. Acceptance does not confirm that it reached the recipient’s inbox.",
  rejected: "The email service rejected this attempt. Check the email configuration and recipient before editing and approving a retry.",
  send_check_required: "The send result is uncertain. Check the email service or inbox before taking any further action; do not send a duplicate.",
  suppressed: "Inquiry follow-up emails are stopped for this email address, including future inquiries.",
  stopped: "The contact status was saved and pending work was paused or stopped. An email that was already requested may still arrive.",
  test_queued: "A clearly labeled test inquiry was queued for your brokerage email. The scheduled worker will prepare its draft.",
  alert_test_accepted: "The email service accepted a TEST ONLY listing-alert sample for your brokerage inbox. Check your inbox to confirm receipt. No subscription was created.",
  alert_test_already_requested: "A listing-alert sample has already been requested today. Check your brokerage inbox for the TEST ONLY sample; another copy has not been sent.",
  alert_test_unavailable: "The listing-alert sample could not be confirmed. Check live listing availability and email delivery before trying again.",
};

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) + " ET" : "—";
}

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<{ id?: string; notice?: string; view?: string }> }) {
  await requireCrmBroker();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  // Never serialize send keys, generation tokens or private audit metadata.
  const columns = "id,lead_id,recipient_email,state,test_mode,source_snapshot,draft_subject,draft_body,draft_mode,draft_version,approved_by,approved_at,send_attempt_at,accepted_at,stop_reason,last_error,created_at,updated_at";
  let queue = supabase.from("crm_followups").select(columns);
  if (params.view !== "all") queue = queue.in("state", ["queued", "drafting", "review", "draft_failed", "sending", "send_failed", "delivery_unknown"]);
  const [{ data, error }, readyCount] = await Promise.all([
    queue.order("created_at", { ascending: false }).limit(100),
    supabase.from("crm_followups").select("id", { count: "exact", head: true }).eq("state", "review"),
  ]);
  const entries = (data ?? []) as CrmFollowUp[];
  const visible = entries;
  let selected = entries.find(entry => entry.id === params.id) ?? null;
  if (!selected && params.id && /^[0-9a-f-]{36}$/i.test(params.id)) {
    const detail = await supabase.from("crm_followups").select(columns).eq("id", params.id).maybeSingle();
    selected = detail.data as CrmFollowUp | null;
  }
  selected ??= visible[0] ?? null;
  const ready = readyCount.error ? null : readyCount.count ?? 0;
  const notice = params.notice && Object.hasOwn(NOTICES, params.notice) ? NOTICES[params.notice] : null;

  return <main className="min-h-screen bg-[#eef0e9] pt-20 text-ink">
    <header className="bg-tide text-sand">
      <div className="container-fsre flex flex-wrap items-center justify-between gap-4 py-6">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">Private broker workspace</p><h1 className="mt-1 font-display text-3xl">Reply drafts</h1></div>
        <Link href="/crm" className="rounded-sm border border-white/30 px-4 py-3 text-sm">Back to CRM</Link>
      </div>
    </header>
    <div className="container-fsre space-y-5 py-6">
      <p className="max-w-3xl text-sm leading-6 text-ink/70">New inquiries with permission for email follow-up receive one draft. Review, edit and approve each reply here. Saved-search-only signups continue to receive listing alerts separately.</p>
      {notice && <p role="status" className="rounded-sm border border-tide/20 bg-white p-4 text-sm leading-6">{notice}</p>}
      {error ? <p role="alert" className="rounded-sm border border-hibiscus/30 bg-white p-5 text-sm">The reply queue is temporarily unavailable. Your existing CRM leads are still accessible.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl text-tide">{ready === null ? "Reply queue" : `${ready} ${ready === 1 ? "reply" : "replies"} ready to review`}</h2><nav aria-label="Reply queue views" className="flex gap-3 text-sm"><Link href="/crm/follow-up" className="underline underline-offset-4">Pending</Link><Link href="/crm/follow-up?view=all" className="underline underline-offset-4">All entries</Link><a href={selected ? `/crm/follow-up?id=${selected.id}${params.view === "all" ? "&view=all" : ""}` : "/crm/follow-up"} className="underline underline-offset-4">Refresh queue</a></nav></div>
        {entries.length === 100 && <p className="text-xs text-ink/60">Showing the 100 most recent {params.view === "all" ? "entries" : "pending inquiries"}. Older lead records remain in the CRM.</p>}
        <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside aria-label="Inquiry drafts" className="overflow-hidden rounded-sm border border-ink/10 bg-white">
            {visible.length ? <ul className="divide-y divide-ink/10">{visible.map(entry => <li key={entry.id}><Link href={`/crm/follow-up?id=${entry.id}${params.view === "all" ? "&view=all" : ""}`} className={`block border-l-4 p-4 ${selected?.id === entry.id ? "border-brass bg-brass/10" : "border-transparent hover:bg-keystone"}`}><p className="break-words text-sm font-semibold">{entry.source_snapshot.full_name || "Website inquiry"}</p><p className="mt-1 break-words text-xs text-ink/60">{entry.recipient_email}</p><p className={`mt-3 text-xs font-medium ${followUpNeedsAttention(entry.state) ? "text-hibiscus" : "text-tide"}`}>{FOLLOW_UP_LABELS[entry.state]}</p>{entry.test_mode && <p className="mt-2 text-xs font-semibold text-hibiscus">TEST ONLY</p>}<p className="mt-2 text-xs text-ink/50">{date(entry.created_at)}</p></Link></li>)}</ul> : <p className="p-5 text-sm leading-6 text-ink/65">No pending replies. New eligible inquiries will appear here; existing contacts are not added automatically.</p>}
          </aside>
          <section className="min-w-0 rounded-sm border border-ink/10 bg-white p-5 md:p-7">
            {selected ? <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-hibiscus">{selected.test_mode ? "Test inquiry" : "Initial response"}</p><h2 className="mt-2 font-display text-2xl text-tide">{selected.source_snapshot.full_name || "Website inquiry"}</h2><p className="mt-2 break-words text-sm">{selected.recipient_email}</p></div><Link href={`/crm?lead=${selected.lead_id}`} className="text-sm text-tide underline underline-offset-4">Open lead record</Link></div>
              <p className="mt-4 rounded-sm bg-keystone p-3 text-sm font-medium">{FOLLOW_UP_LABELS[selected.state]}</p>
              <details className="mt-5 rounded-sm border border-ink/15 p-4" open><summary className="cursor-pointer text-sm font-semibold">Original inquiry</summary>{selected.source_snapshot.property_interest && <p className="mt-3 break-words text-sm">{selected.source_snapshot.property_interest}</p>}<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink/70">{selected.source_snapshot.message || "No message was supplied. Open the lead record for submitted preferences."}</p></details>
              {selected.draft_mode && <p className="mt-5 text-xs leading-5 text-ink/65">{selected.draft_mode === "ai" ? "AI draft — check its wording and facts against the inquiry." : selected.draft_mode === "template" ? "Template draft — AI drafting was unavailable or the inquiry needed direct staff review. Personalize this reply before sending." : "Manually edited draft — review the saved wording before sending."}</p>}
              {followUpCanEdit(selected.state) ? <FollowUpEditor key={`${selected.id}:${selected.draft_version}`} id={selected.id} version={selected.draft_version} initialSubject={selected.draft_subject || ""} initialBody={selected.draft_body || ""} canSend={selected.state === "review"} recipient={selected.recipient_email} testMode={selected.test_mode} /> : selected.draft_body ? <div className="mt-4 rounded-sm border border-ink/10 p-4"><h3 className="text-sm font-semibold">{selected.draft_subject}</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{selected.draft_body}</p></div> : <p className="mt-4 text-sm leading-6 text-ink/65">The agent checks for pending drafts on its schedule. Refresh this page to see the latest result.</p>}
              {selected.accepted_at && <p className="mt-4 text-sm leading-6 text-ink/65">Approved by {selected.approved_by} at {date(selected.approved_at)}. The email service accepted the request at {date(selected.accepted_at)}. Inbox delivery and replies have not been automatically verified.</p>}
              {(["delivery_unknown", "sending"] as string[]).includes(selected.state) && <p role="alert" className="mt-4 text-sm leading-6 text-hibiscus">Check the email service or recipient’s inbox before sending anything else. This entry cannot be resent while its result is uncertain.</p>}
              {selected.stop_reason && <p className="mt-4 text-sm text-ink/65">Stop reason: {selected.stop_reason.replaceAll("_", " ")}</p>}
              <form action={stopFollowUp} className="mt-7 border-t border-ink/10 pt-5"><input type="hidden" name="id" value={selected.id}/><label className="block text-sm font-medium text-tide">Record a reply or stop contact<select name="reason" className="mt-2 block min-h-11 w-full rounded-sm border border-ink/20 bg-white p-3 text-sm"><option value="reply_received">An email reply was received</option><option value="do_not_contact">Do not email this address again</option><option value="not_relevant">Stop this inquiry’s reply</option></select></label><button className="mt-3 min-h-11 rounded-sm border border-tide/30 px-4 py-3 text-sm font-medium text-tide">Save contact status</button><p className="mt-2 text-xs leading-5 text-ink/60">Replies must be recorded here or in the CRM. Automatic inbox monitoring is not connected.</p></form>
            </> : <div className="py-8"><h2 className="font-display text-2xl text-tide">Ready for the next inquiry</h2><p className="mt-3 max-w-lg text-sm leading-6 text-ink/65">Choose a pending reply to review. No customer email is sent by the scheduled drafting worker.</p></div>}
          </section>
        </div>
      </>}
      <details className="rounded-sm border border-ink/10 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-tide">Owner-only checks</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Create a labeled sample inquiry for your own brokerage email, or send yourself a daily sample listing alert using a current live listing. These checks do not contact customers or create an alert subscription.</p><div className="mt-4 flex flex-wrap gap-3"><form action={createFollowUpTest}><button className="min-h-11 rounded-sm border border-tide/30 px-4 py-3 text-sm">Create a test reply draft</button></form><form action={sendListingAlertTest}><button className="min-h-11 rounded-sm border border-tide/30 px-4 py-3 text-sm">Email me a test listing alert</button></form></div></details>
    </div>
  </main>;
}
