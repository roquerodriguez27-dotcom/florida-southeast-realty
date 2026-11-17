"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { approveAndSendFollowUp, saveFollowUp } from "@/app/crm/follow-up/actions";

function SubmitButton({ children, disabled = false, secondary = false }: {
  children: React.ReactNode; disabled?: boolean; secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button disabled={disabled || pending} className={`min-h-11 rounded-sm px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${secondary ? "border border-tide/30 text-tide" : "bg-hibiscus text-white hover:bg-hibiscus-dark"}`}>
    {pending ? "Working…" : children}
  </button>;
}

export default function FollowUpEditor({ id, version, initialSubject, initialBody, canSend, recipient, testMode }: {
  id: string; version: number; initialSubject: string; initialBody: string;
  canSend: boolean; recipient: string; testMode: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const changed = subject !== initialSubject || body !== initialBody;
  return <div className="mt-5 space-y-5">
    <form action={saveFollowUp} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <label className="block text-sm font-medium text-tide">Subject
        <input name="subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} required className="mt-2 w-full rounded-sm border border-ink/20 bg-white px-3 py-3 text-ink" />
      </label>
      <label className="block text-sm font-medium text-tide">Reply draft
        <textarea name="body" value={body} onChange={event => setBody(event.target.value)} maxLength={6000} rows={12} required className="mt-2 w-full rounded-sm border border-ink/20 bg-white p-3 text-sm leading-6 text-ink" />
      </label>
      <SubmitButton secondary disabled={!changed && canSend}>Save draft</SubmitButton>
      {changed && <p role="status" className="text-sm text-hibiscus">Save your changes, then review the saved reply before sending.</p>}
    </form>
    <form action={approveAndSendFollowUp} className="rounded-sm border border-brass/40 bg-brass/10 p-4 space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <p className="break-words text-sm">Send to <strong>{recipient}</strong>{testMode ? " as a clearly labeled test." : "."} Your brokerage contact details and a link to stop follow-up emails will be included.</p>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="approved" value="yes" required disabled={changed || !canSend} className="mt-1.5 h-4 w-4 shrink-0" />I reviewed the saved reply and checked its property information. Send this one email.</label>
      <SubmitButton disabled={changed || !canSend}>{testMode ? "Approve and send test" : "Approve and send reply"}</SubmitButton>
      <p className="text-xs leading-5 text-ink/65">Sending requires this approval. The agent prepares drafts only.</p>
    </form>
  </div>;
}
