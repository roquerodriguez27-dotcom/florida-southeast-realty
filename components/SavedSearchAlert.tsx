"use client";

import { useState } from "react";

type SearchCriteria = Record<string, string | boolean | undefined>;

export default function SavedSearchAlert({ criteria }: { criteria: SearchCriteria }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pendingIdx, setPendingIdx] = useState(false);
  const [notificationConfigured, setNotificationConfigured] = useState(false);
  const [notificationDelivered, setNotificationDelivered] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/saved-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"), email: form.get("email"), phone: form.get("phone"),
          frequency: form.get("frequency"), smsConsent: form.get("smsConsent") === "on",
          honeypot: form.get("companyWebsite"), criteria,
        }),
      });
      const result = await response.json() as {
        error?: string;
        pendingIdx?: boolean;
        notificationConfigured?: boolean;
        notificationDelivered?: boolean;
      };
      if (!response.ok) {
        setState("error");
        setMessage(result.error ?? "Unable to save this alert.");
        return;
      }
      setPendingIdx(Boolean(result.pendingIdx));
      setNotificationConfigured(Boolean(result.notificationConfigured));
      setNotificationDelivered(Boolean(result.notificationDelivered));
      setState("saved");
    } catch {
      setState("error");
      setMessage("Unable to save this alert. Please try again.");
    }
  }

  if (state === "saved") return (
    <div className="border border-tide/20 bg-tide/5 rounded-sm p-5" role="status">
      <p className="font-medium text-tide">Your search is saved.</p>
      <p className="text-sm text-ink/60 mt-1">
        {pendingIdx
          ? "Your criteria are in the brokerage CRM. An agent will confirm delivery while the secure MLS connection is finalized."
          : "Your criteria are in the brokerage CRM against the live MLS feed. An agent will confirm your alert delivery preferences."}
      </p>
      {notificationDelivered ? (
        <p className="mt-2 text-xs font-medium text-tide">A notification email was sent to the brokerage.</p>
      ) : notificationConfigured ? (
        <p className="mt-2 text-xs text-hibiscus">The search was saved, but the broker notification email could not be confirmed.</p>
      ) : (
        <p className="mt-2 text-xs text-ink/55">The brokerage can see this saved search in the CRM.</p>
      )}
    </div>
  );

  return (
    <div className="border border-brass/30 bg-brass/10 rounded-sm p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="font-display text-lg text-ink">Save this search</p><p className="text-xs text-ink/60">Get new matches and price changes.</p></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="bg-tide text-sand px-4 py-2 rounded-sm text-sm font-medium">{open ? "Close" : "Set up alerts"}</button>
      </div>
      {open && <form onSubmit={submit} className="mt-5 grid sm:grid-cols-2 gap-4">
        <div className="hidden" aria-hidden="true"><label>Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="text-sm">Name<input name="fullName" required autoComplete="name" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm" /></label>
        <label className="text-sm">Email<input name="email" type="email" required autoComplete="email" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm" /></label>
        <label className="text-sm">Phone (optional)<input name="phone" type="tel" autoComplete="tel" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm" /></label>
        <label className="text-sm">Alert frequency<select name="frequency" defaultValue="daily" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm"><option value="instant">Instant</option><option value="daily">Daily summary</option><option value="weekly">Weekly summary</option></select></label>
        <label className="sm:col-span-2 flex gap-2 text-xs text-ink/65"><input name="smsConsent" type="checkbox" className="mt-0.5" /><span>Also send text alerts. Message and data rates may apply. Reply STOP to opt out. Consent is not required to buy property or services.</span></label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4"><button disabled={state === "saving"} className="bg-hibiscus text-sand px-5 py-3 rounded-sm font-medium disabled:opacity-60">{state === "saving" ? "Saving…" : "Save my search"}</button><p className="text-xs text-ink/50">Email alerts include an unsubscribe option.</p></div>
        {state === "error" && <p className="sm:col-span-2 text-sm text-hibiscus" role="alert">{message}</p>}
      </form>}
    </div>
  );
}
