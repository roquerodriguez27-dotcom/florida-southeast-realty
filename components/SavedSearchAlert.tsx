"use client";

import { useState } from "react";
import { trackSiteEvent } from "@/components/SiteAnalytics";

type SearchCriteria = Record<string, string | boolean | undefined>;

export default function SavedSearchAlert({ criteria }: { criteria: SearchCriteria }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pendingIdx, setPendingIdx] = useState(false);
  const [customerEmailConfigured, setCustomerEmailConfigured] = useState(false);
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
          fullName: "",
          email: form.get("email"),
          phone: "",
          frequency: "instant",
          smsConsent: false,
          honeypot: form.get("companyWebsite"),
          criteria,
        }),
      });
      const result = await response.json() as {
        error?: string;
        pendingIdx?: boolean;
        customerEmailConfigured?: boolean;
        notificationConfigured?: boolean;
        notificationDelivered?: boolean;
      };
      if (!response.ok) {
        setState("error");
        setMessage(result.error ?? "Unable to save this alert.");
        return;
      }
      setPendingIdx(Boolean(result.pendingIdx));
      setCustomerEmailConfigured(Boolean(result.customerEmailConfigured));
      setNotificationConfigured(Boolean(result.notificationConfigured));
      setNotificationDelivered(Boolean(result.notificationDelivered));
      trackSiteEvent("saved_search_submit", { frequency: "instant" });
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
          : customerEmailConfigured
            ? "We’ll watch the live BeachesMLS feed for new matches, price changes, and homes returning to market."
            : "Your criteria are saved in the brokerage CRM and the live BeachesMLS watcher is ready. Direct email delivery is temporarily unavailable, so Florida Southeast Realty can follow up while alerts are being activated."}
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
    <div className="border border-tide/15 bg-white rounded-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg text-ink">Save this search & get alerts</p>
          <p className="text-xs text-ink/55 mt-0.5">New listings, price changes, and back-on-market updates.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="border border-tide/25 text-tide px-4 py-2 rounded-sm text-sm font-medium hover:bg-tide/5"
        >
          {open ? "Close" : "Get listing alerts"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="hidden" aria-hidden="true"><label>Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off" /></label></div>
          <label className="flex-1 text-sm">
            <span className="sr-only">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email address"
              className="w-full border border-ink/15 bg-white px-3 py-2.5 rounded-sm text-base md:text-sm focus:border-tide outline-none"
            />
          </label>
          <button disabled={state === "saving"} className="bg-hibiscus text-sand px-5 py-2.5 rounded-sm text-sm font-medium disabled:opacity-60">
            {state === "saving" ? "Saving…" : "Save & alert me"}
          </button>
          {state === "error" && <p className="sm:basis-full text-sm text-hibiscus" role="alert">{message}</p>}
          <p className="sm:basis-full text-[11px] text-ink/45">Email alerts only. Unsubscribe anytime.</p>
        </form>
      )}
    </div>
  );
}
