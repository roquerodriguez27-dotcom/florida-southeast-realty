"use client";

import { useState } from "react";

type SearchCriteria = Record<string, string | boolean | undefined>;

export default function SavedSearchAlert({ criteria }: { criteria: SearchCriteria }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/saved-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"), email: form.get("email"), phone: form.get("phone"),
        frequency: form.get("frequency"), smsConsent: form.get("smsConsent") === "on", criteria,
      }),
    });
    const result = await response.json();
    if (!response.ok) { setState("error"); setMessage(result.error ?? "Unable to save this alert."); return; }
    setState("saved");
  }

  if (state === "saved") return (
    <div className="border border-tide/20 bg-tide/5 rounded-sm p-5" role="status">
      <p className="font-medium text-tide">Your search is saved.</p>
      <p className="text-sm text-ink/60 mt-1">We recorded your criteria. Matching-listing alerts will activate when the live BeachesMLS connection is approved.</p>
    </div>
  );

  return (
    <div className="border border-brass/30 bg-brass/10 rounded-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="font-display text-xl text-ink">Get alerts for this search</p><p className="text-sm text-ink/60 mt-1">New matches, price changes, and homes returning to market.</p></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="bg-tide text-sand px-5 py-3 rounded-sm font-medium">{open ? "Close" : "Save search"}</button>
      </div>
      {open && <form onSubmit={submit} className="mt-5 grid sm:grid-cols-2 gap-4">
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
