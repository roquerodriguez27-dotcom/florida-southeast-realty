export const CONTACT_OUTCOMES = ["attempted", "conversation", "appointment_booked", "appointment_held"] as const;
export const CONTACT_CHANNELS = ["call", "email", "text", "meeting"] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
const PREFIX = "FSR outcome v1: ";
export const OUTCOME_LABELS: Record<ContactOutcome, string> = {
  attempted: "Contact attempted — no conversation yet",
  conversation: "Two-way conversation or reply received",
  appointment_booked: "Appointment agreed and booked",
  appointment_held: "Appointment took place",
};
interface OutcomeRecord { outcome: ContactOutcome; channel: ContactChannel; note: string }
export interface OutcomeActivity { lead_id: number; kind: string; body: string; created_at: string }
export interface OutcomeLead { id: number; form_name: string; status: string; created_at: string }

export function outcomeBody(outcome: ContactOutcome, channel: ContactChannel, note: string): string {
  return PREFIX + JSON.stringify({ outcome, channel, note });
}

export function readOutcome(activity: Pick<OutcomeActivity, "kind" | "body">): OutcomeRecord | null {
  if (!(CONTACT_CHANNELS as readonly string[]).includes(activity.kind) || !activity.body.startsWith(PREFIX)) return null;
  try {
    const value = JSON.parse(activity.body.slice(PREFIX.length));
    if (!value || !(CONTACT_OUTCOMES as readonly unknown[]).includes(value.outcome)
      || value.channel !== activity.kind || typeof value.note !== "string" || value.note.length > 1500) return null;
    return { outcome: value.outcome, channel: value.channel, note: value.note };
  } catch { return null; }
}

export function activityDescription(activity: Pick<OutcomeActivity, "kind" | "body">): string {
  const record = readOutcome(activity);
  return record ? `${OUTCOME_LABELS[record.outcome]}${record.note ? `\n${record.note}` : ""}` : activity.body;
}

export function summarizeOutcomes(leads: OutcomeLead[], activities: OutcomeActivity[]) {
  const leadIds = new Set(leads.map((lead) => lead.id));
  const attempts = new Set<number>();
  const conversations = new Set<number>();
  const booked = new Set<number>();
  const held = new Set<number>();
  for (const activity of activities) {
    if (!leadIds.has(activity.lead_id)) continue;
    const record = readOutcome(activity);
    if (!record) continue;
    if (record.outcome === "attempted") attempts.add(activity.lead_id);
    if (record.outcome === "conversation" || record.outcome === "appointment_held") conversations.add(activity.lead_id);
    if (record.outcome === "appointment_booked") booked.add(activity.lead_id);
    if (record.outcome === "appointment_held") held.add(activity.lead_id);
  }
  const measure = (rows: OutcomeLead[]) => ({
    inquiries: rows.length,
    attempted: rows.filter((row) => attempts.has(row.id)).length,
    conversations: rows.filter((row) => conversations.has(row.id)).length,
    booked: rows.filter((row) => booked.has(row.id)).length,
    held: rows.filter((row) => held.has(row.id)).length,
    closed: rows.filter((row) => row.status === "closed").length,
  });
  const forms = [...new Set(leads.map((lead) => lead.form_name))].sort();
  return { totals: measure(leads), byForm: forms.map((form) => ({ form, ...measure(leads.filter((lead) => lead.form_name === form)) })) };
}
