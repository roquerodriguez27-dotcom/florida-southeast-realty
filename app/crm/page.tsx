import { addCrmTeamMember, addNote, addTask, completeTask, setCrmTeamMemberActive, signOut, updateLead } from "./actions";
import { requireCrmUser } from "@/lib/crm/auth";
import { CRM_STATUSES, type CrmLead, type CrmUser } from "@/lib/crm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Broker CRM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Activity { id: number; lead_id: number; kind: string; body: string; created_at: string }
interface Task { id: number; lead_id: number | null; title: string; due_at: string | null; completed_at: string | null; automation_key?: string | null }
interface SavedSearch {
  id: string;
  criteria: Record<string, string | boolean | number | null>;
  frequency: string;
  status: string;
  sms_consent_at: string | null;
  created_at: string;
}

function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function shortDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—"; }
function isOverdue(value: string | null) { return Boolean(value && new Date(value).getTime() < Date.now()); }
function detailValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Any";
  return String(value);
}

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ status?: string; lead?: string; q?: string }> }) {
  const user = await requireCrmUser();
  const params = await searchParams;
  const selectedStatus = CRM_STATUSES.includes(params.status as (typeof CRM_STATUSES)[number]) ? params.status : "all";
  const query = (params.q ?? "").trim();
  const supabase = await createSupabaseServerClient();

  let leadsQuery = supabase.from("crm_leads").select("*").order("created_at", { ascending: false }).limit(200);
  if (selectedStatus !== "all") leadsQuery = leadsQuery.eq("status", selectedStatus);
  if (query) leadsQuery = leadsQuery.or(`full_name.ilike.%${query.replaceAll(",", "") }%,email.ilike.%${query.replaceAll(",", "") }%,phone.ilike.%${query.replaceAll(",", "") }%`);

  const [leadsResult, tasksResult, countsResult, teamResult] = await Promise.all([
    leadsQuery,
    supabase.from("crm_tasks").select("*").is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    supabase.from("crm_leads").select("status"),
    user.role === "broker"
      ? supabase.from("crm_users").select("email,display_name,role,active,created_at,updated_at").order("role").order("display_name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (leadsResult.error) throw leadsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (countsResult.error) throw countsResult.error;
  if (teamResult.error) throw teamResult.error;
  const leadsData = leadsResult.data;
  const taskData = tasksResult.data;
  const countsData = countsResult.data;
  const team = (teamResult.data ?? []) as CrmUser[];
  const activeTeam = team.filter((member) => member.active);
  const leads = (leadsData ?? []) as CrmLead[];
  const selectedLead = leads.find((lead) => String(lead.id) === params.lead) ?? leads[0] ?? null;
  const leadIds = selectedLead ? [selectedLead.id] : [];
  const [activitiesResult, savedSearchResult] = leadIds.length
    ? await Promise.all([
        supabase.from("crm_activities").select("*").eq("lead_id", selectedLead!.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("saved_searches").select("id,criteria,frequency,status,sms_consent_at,created_at").eq("lead_id", selectedLead!.id).order("created_at", { ascending: false }).limit(20),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (activitiesResult.error) throw activitiesResult.error;
  if (savedSearchResult.error) throw savedSearchResult.error;
  const activitiesData = activitiesResult.data;
  const savedSearchData = savedSearchResult.data;
  const activities = (activitiesData ?? []) as Activity[];
  const savedSearches = (savedSearchData ?? []) as SavedSearch[];
  const tasks = (taskData ?? []) as Task[];
  const counts = Object.fromEntries(CRM_STATUSES.map((status) => [status, (countsData ?? []).filter((row) => row.status === status).length]));
  const submittedDetails = selectedLead
    ? Object.entries(selectedLead.fields ?? {}).filter(([key, value]) =>
        !["name", "full_name", "first_name", "email", "phone", "telephone", "contact_consent"].includes(key)
        && String(value ?? "").trim(),
      )
    : [];

  return (
    <main className="min-h-screen bg-[#eef0e9] text-ink">
      <header className="bg-tide text-sand border-b border-white/10">
        <div className="container-fsre py-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">Florida Southeast Realty</p><h1 className="font-display text-2xl">{user.role === "broker" ? "Broker CRM" : "Agent CRM"}</h1></div>
          <div className="flex items-center gap-4 text-xs"><span className="hidden sm:inline text-white/60">{user.displayName} · {user.email}</span><form action={signOut}><button className="border border-white/25 rounded-sm px-3 py-2 hover:bg-white/10">Sign out</button></form></div>
        </div>
      </header>

      <div className="container-fsre py-6 space-y-5">
        <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          {CRM_STATUSES.map((status) => <a key={status} href={`/crm?status=${status}`} className={`rounded-sm border p-3 ${selectedStatus === status ? "bg-tide text-white border-tide" : "bg-white border-ink/10"}`}><p className="text-xs uppercase tracking-wide opacity-60">{label(status)}</p><p className="font-display text-2xl mt-1">{counts[status] ?? 0}</p></a>)}
        </section>

        {user.role === "broker" ? (
          <details className="rounded-sm border border-ink/10 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
              <div><h2 className="font-display text-xl text-tide">Team access & lead assignment</h2><p className="mt-1 text-xs text-ink/55">Add an agent by email, then assign leads from each lead record.</p></div>
              <span className="rounded-full bg-tide/10 px-3 py-1 text-xs font-medium text-tide">{activeTeam.length} active</span>
            </summary>
            <div className="border-t border-ink/10 p-4 md:p-5">
              <form action={addCrmTeamMember} className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
                <label className="text-xs uppercase tracking-wide text-ink/55">Agent name<input name="displayName" required className="mt-1 w-full rounded-sm border border-ink/15 px-3 py-2.5 text-sm normal-case tracking-normal" placeholder="Agent name" /></label>
                <label className="text-xs uppercase tracking-wide text-ink/55">Agent email<input name="email" type="email" required className="mt-1 w-full rounded-sm border border-ink/15 px-3 py-2.5 text-sm normal-case tracking-normal" placeholder="agent@brokerage.com" /></label>
                <button className="rounded-sm bg-tide px-4 py-2.5 text-sm font-medium text-white">Authorize agent</button>
              </form>
              <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {team.map((member) => (
                  <div key={member.email} className="flex items-center justify-between gap-3 rounded-sm border border-ink/10 p-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{member.display_name}</p><p className="truncate text-xs text-ink/50">{member.email}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-ink/40">{member.role} · {member.active ? "active" : "inactive"}</p></div>
                    {member.role === "agent" ? <form action={setCrmTeamMemberActive}><input type="hidden" name="email" value={member.email} /><input type="hidden" name="active" value={member.active ? "false" : "true"} /><button className="text-xs font-medium text-tide underline underline-offset-4">{member.active ? "Deactivate" : "Reactivate"}</button></form> : null}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-ink/55">Agents sign in at <span className="font-medium text-tide">/crm/login</span> with the exact email authorized here. The system emails a secure one-time link; there is no shared password.</p>
            </div>
          </details>
        ) : null}

        <section className="grid xl:grid-cols-[360px_minmax(0,1fr)_300px] gap-5 items-start">
          <aside className="bg-white border border-ink/10 rounded-sm overflow-hidden">
            <div className="p-4 border-b border-ink/10"><form className="flex gap-2"><input type="hidden" name="status" value={selectedStatus}/><input name="q" defaultValue={query} placeholder="Search leads" className="min-w-0 flex-1 border border-ink/15 rounded-sm px-3 py-2 text-sm"/><button className="bg-tide text-white rounded-sm px-3 text-sm">Search</button></form></div>
            <div className="max-h-[68vh] overflow-y-auto divide-y divide-ink/10">
              {leads.map((lead) => <a key={lead.id} href={`/crm?status=${selectedStatus}&lead=${lead.id}`} className={`block p-4 hover:bg-keystone ${selectedLead?.id === lead.id ? "bg-brass/10 border-l-4 border-brass" : ""}`}><div className="flex justify-between gap-2"><p className="font-semibold">{lead.full_name}</p><span className="text-[10px] uppercase text-ink/45">{shortDate(lead.created_at)}</span></div><p className="text-xs text-ink/60 mt-1 truncate">{lead.email || lead.phone || lead.form_name}</p><div className="flex gap-2 mt-2"><span className="text-[10px] uppercase bg-keystone px-2 py-1 rounded-sm">{label(lead.status)}</span>{lead.priority !== "normal" && <span className="text-[10px] uppercase bg-hibiscus/10 text-hibiscus px-2 py-1 rounded-sm">{lead.priority}</span>}</div></a>)}
              {!leads.length && <p className="p-6 text-sm text-ink/55">No leads match this view.</p>}
            </div>
          </aside>

          <section className="bg-white border border-ink/10 rounded-sm p-5 md:p-7 min-h-[560px]">
            {selectedLead ? <>
              <div className="flex flex-wrap justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-hibiscus">{selectedLead.form_name} · {selectedLead.source}</p><h2 className="font-display text-3xl text-tide mt-1">{selectedLead.full_name}</h2><div className="flex flex-wrap gap-3 text-sm mt-2">{selectedLead.phone && <a className="underline" href={`tel:${selectedLead.phone}`}>{selectedLead.phone}</a>}{selectedLead.email && <a className="underline" href={`mailto:${selectedLead.email}`}>{selectedLead.email}</a>}</div></div><p className="text-xs text-ink/45">Received {shortDate(selectedLead.created_at)}</p></div>
              <form action={updateLead} className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6 bg-keystone/70 p-4 rounded-sm"><input type="hidden" name="leadId" value={selectedLead.id}/><label className="text-xs uppercase tracking-wide">Stage<select name="status" defaultValue={selectedLead.status} className="mt-1 w-full bg-white border border-ink/15 rounded-sm p-2 text-sm">{CRM_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label><label className="text-xs uppercase tracking-wide">Priority<select name="priority" defaultValue={selectedLead.priority} className="mt-1 w-full bg-white border border-ink/15 rounded-sm p-2 text-sm">{["low","normal","high","urgent"].map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label><label className="text-xs uppercase tracking-wide">Next follow-up<input name="nextFollowUp" type="datetime-local" defaultValue={selectedLead.next_follow_up_at?.slice(0,16) ?? ""} className="mt-1 w-full bg-white border border-ink/15 rounded-sm p-2 text-sm"/></label>{user.role === "broker" ? <label className="text-xs uppercase tracking-wide">Assigned to<select name="assignedTo" defaultValue={selectedLead.assigned_to ?? user.email} className="mt-1 w-full bg-white border border-ink/15 rounded-sm p-2 text-sm">{activeTeam.map((member) => <option key={member.email} value={member.email}>{member.display_name} ({member.role})</option>)}</select></label> : <div className="text-xs uppercase tracking-wide">Assigned to<p className="mt-1 rounded-sm border border-ink/10 bg-white p-2 text-sm normal-case">{user.displayName}</p></div>}<button className="sm:col-span-2 xl:col-span-4 bg-tide text-white rounded-sm py-2 text-sm">Save lead</button></form>
              {selectedLead.message && <div className="mt-6"><h3 className="font-semibold text-sm">Request</h3><p className="mt-2 text-sm whitespace-pre-wrap text-ink/70">{selectedLead.message}</p></div>}
              {selectedLead.property_interest && <p className="mt-4 text-sm"><span className="font-semibold">Property interest:</span> {selectedLead.property_interest}</p>}
              {submittedDetails.length > 0 && <div className="mt-6"><h3 className="font-semibold text-sm">Submitted details</h3><dl className="mt-3 grid sm:grid-cols-2 gap-3">{submittedDetails.map(([key, value]) => <div key={key} className="bg-keystone/60 rounded-sm p-3"><dt className="text-[10px] uppercase tracking-wide text-ink/45">{label(key)}</dt><dd className="text-sm mt-1 whitespace-pre-wrap break-words">{detailValue(value)}</dd></div>)}</dl></div>}
              {savedSearches.length > 0 && <div className="mt-7"><h3 className="font-semibold">Saved searches</h3><div className="mt-3 space-y-3">{savedSearches.map((search) => <article key={search.id} className="border border-ink/10 rounded-sm p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{label(search.frequency)} alerts · {label(search.status)}</p><time className="text-xs text-ink/40">{shortDate(search.created_at)}</time></div><dl className="grid sm:grid-cols-2 gap-x-5 gap-y-2 mt-3">{Object.entries(search.criteria).map(([key, value]) => <div key={key} className="flex justify-between gap-3 text-xs"><dt className="text-ink/50">{label(key)}</dt><dd className="font-medium text-right">{detailValue(value)}</dd></div>)}</dl>{search.sms_consent_at && <p className="text-[10px] text-seagrass mt-3">Text alerts requested {shortDate(search.sms_consent_at)}</p>}</article>)}</div></div>}
              <div className="grid md:grid-cols-2 gap-4 mt-7"><form action={addNote} className="border border-ink/10 p-4 rounded-sm"><input type="hidden" name="leadId" value={selectedLead.id}/><h3 className="font-semibold">Add note</h3><textarea name="body" required rows={3} className="mt-3 w-full border border-ink/15 rounded-sm p-2 text-sm" placeholder="Call notes, needs, financing…"/><button className="mt-2 bg-hibiscus text-white rounded-sm px-4 py-2 text-sm">Save note</button></form><form action={addTask} className="border border-ink/10 p-4 rounded-sm"><input type="hidden" name="leadId" value={selectedLead.id}/><h3 className="font-semibold">Create follow-up</h3><input name="title" required className="mt-3 w-full border border-ink/15 rounded-sm p-2 text-sm" placeholder="Call about valuation"/><input name="dueAt" type="datetime-local" className="mt-2 w-full border border-ink/15 rounded-sm p-2 text-sm"/><button className="mt-2 bg-hibiscus text-white rounded-sm px-4 py-2 text-sm">Add task</button></form></div>
              <div className="mt-7"><h3 className="font-semibold">Activity</h3><div className="mt-3 space-y-3">{activities.map((activity) => <div key={activity.id} className="border-l-2 border-brass pl-3"><div className="flex justify-between gap-3"><span className="text-xs uppercase tracking-wide text-ink/45">{label(activity.kind)}</span><time className="text-xs text-ink/40">{shortDate(activity.created_at)}</time></div><p className="text-sm mt-1 whitespace-pre-wrap">{activity.body}</p></div>)}{!activities.length && <p className="text-sm text-ink/50">No activity yet.</p>}</div></div>
            </> : <div className="h-full flex items-center justify-center text-ink/50">New website leads will appear here automatically.</div>}
          </section>

          <aside className="bg-white border border-ink/10 rounded-sm p-5"><h2 className="font-display text-2xl text-tide">Follow-ups</h2><div className="mt-4 space-y-3">{tasks.map((task) => <div key={task.id} className={`border rounded-sm p-3 ${isOverdue(task.due_at) ? "border-hibiscus/40 bg-hibiscus/5" : "border-ink/10"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{task.title}</p>{task.automation_key && <span className="text-[9px] uppercase tracking-wide text-tide bg-tide/10 rounded-sm px-1.5 py-1">Auto</span>}</div><p className={`text-xs mt-1 ${isOverdue(task.due_at) ? "text-hibiscus font-medium" : "text-ink/45"}`}>{isOverdue(task.due_at) ? "Overdue · " : ""}{shortDate(task.due_at)}</p><div className="mt-2 flex items-center gap-3">{task.lead_id && <a href={`/crm?lead=${task.lead_id}`} className="text-xs text-tide underline">Open lead</a>}<form action={completeTask}><input type="hidden" name="taskId" value={task.id}/><button className="text-xs text-seagrass underline">Mark complete</button></form></div></div>)}{!tasks.length && <p className="text-sm text-ink/50">No open follow-ups.</p>}</div></aside>
        </section>
      </div>
    </main>
  );
}
