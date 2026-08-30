"use client";

import { useState } from "react";
import { trackSiteEvent } from "@/components/SiteAnalytics";

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
          frequency: form.get("frequency"), smsConsent: false,
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
      trackSiteEvent("saved_search_submit", { frequency: String(form.get("frequency") ?? "daily") });
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
          ? "Your criteria are in the brokerage CRM. Florida Southeast Realty will follow up while the secure MLS connection is unavailable."
          : "Your email alert is active against the live BeachesMLS feed. We’ll watch for new matches, price changes, and homes returning to market at your selected frequency."}
      </p>
      {notificationDelivered ? (
        <p className="mt-2 text-xs font-medium text-tide">Florida Southeast Realty was also notified about your saved search.</p>
      ) : notificationConfigured ? (
        <p className="mt-2 text-xs text-ink/55">Your alert is saved even though the separate brokerage notification could not be confirmed.</p>
      ) : (
        <p className="mt-2 text-xs text-ink/55">The brokerage can also see this saved search in the CRM.</p>
      )}
    </div>
  );

  return (
    <div className="border border-brass/30 bg-brass/10 rounded-sm p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="font-display text-lg text-ink">Save this search</p><p className="text-xs text-ink/60">Get new matches, price changes, and back-on-market updates.</p></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="bg-tide text-sand px-4 py-2 rounded-sm text-sm font-medium">{open ? "Close" : "Set up alerts"}</button>
      </div>
      {open && <form onSubmit={submit} className="mt-5 grid sm:grid-cols-2 gap-4">
        <div className="hidden" aria-hidden="true"><label>Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="text-sm">Name<input name="fullName" required autoComplete="name" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm" /></label>
        <label className="text-sm">Email<input name="email" type="email" required autoComplete="email" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm" /></label>
        <label className="text-sm">Phone (optional)<input name="phone" type="tel" autoComplete="tel" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm" /></label>
        <label className="text-sm">Alert frequency<select name="frequency" defaultValue="daily" className="mt-1 w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm"><option value="instant">About every 15 minutes</option><option value="daily">Daily summary</option><option value="weekly">Weekly summary</option></select></label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4"><button disabled={state === "saving"} className="bg-hibiscus text-sand px-5 py-3 rounded-sm font-medium disabled:opacity-60">{state === "saving" ? "Saving…" : "Save my search"}</button><p className="text-xs text-ink/50">Alerts are sent by email and include a one-click unsubscribe link.</p></div>
        {state === "error" && <p className="sm:col-span-2 text-sm text-hibiscus" role="alert">{message}</p>}
      </form>}
    </div>
  );
}
