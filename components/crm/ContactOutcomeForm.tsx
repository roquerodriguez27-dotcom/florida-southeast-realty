"use client";

import { useFormStatus } from "react-dom";
import { recordContactOutcome } from "@/app/crm/actions";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, OUTCOME_LABELS } from "@/lib/crm/outcomes";

function SubmitOutcome() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="mt-4 rounded-sm bg-tide px-4 py-2.5 text-sm text-white disabled:opacity-50">{pending ? "Recording…" : "Record Outcome"}</button>;
}

export default function ContactOutcomeForm({ leadId }: { leadId: number }) {
  return (
    <form action={recordContactOutcome} className="mt-7 rounded-sm border border-tide/20 bg-tide/5 p-4 md:p-5">
      <input type="hidden" name="leadId" value={leadId} />
      <h3 className="font-display text-xl text-tide">Record a contact outcome</h3>
      <p className="mt-2 text-xs leading-relaxed text-ink/60">Log what happened in this interaction. Completing a reminder or sending an unanswered message does not count as a conversation. This record uses the current time.</p>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-medium text-ink/65">Outcome<select name="outcome" required defaultValue="" className="mt-1 w-full rounded-sm border border-ink/15 bg-white p-2.5 text-sm"><option value="" disabled>Choose what happened</option>{CONTACT_OUTCOMES.map((value) => <option key={value} value={value}>{OUTCOME_LABELS[value]}</option>)}</select></label>
        <label className="text-xs font-medium text-ink/65">Channel<select name="channel" required defaultValue="" className="mt-1 w-full rounded-sm border border-ink/15 bg-white p-2.5 text-sm"><option value="" disabled>Choose a channel</option>{CONTACT_CHANNELS.map((value) => <option key={value} value={value}>{value === "meeting" ? "Meeting / video meeting" : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label>
      </div>
      <label className="mt-3 block text-xs font-medium text-ink/65">Details or next step (optional)<textarea name="note" rows={3} maxLength={1500} className="mt-1 w-full rounded-sm border border-ink/15 bg-white p-2.5 text-sm" placeholder="What did the client need? If booked, note the appointment date and time." /></label>
      <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink/65"><input required type="checkbox" name="confirmed" value="yes" className="mt-0.5 accent-[var(--color-tide)]" /><span>I confirm this outcome occurred. I am recording it for this lead.</span></label>
      <SubmitOutcome />
    </form>
  );
}
