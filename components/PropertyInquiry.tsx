"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import LeadForm, { type LeadFormField } from "@/components/LeadForm";
import { SITE } from "@/lib/site-config";

function subscribeToRequestType(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
}

function requestTypeFromHash(): "question" | "showing" {
  return ["#property-showing", "#property-inquiry"].includes(window.location.hash) ? "showing" : "question";
}

export default function PropertyInquiry({ listingAddress, listingId, children }: {
  listingAddress: string;
  listingId: string;
  children?: ReactNode;
}) {
  const requestType = useSyncExternalStore(subscribeToRequestType, requestTypeFromHash, () => "question");
  const isShowing = requestType === "showing";
  const fields: LeadFormField[] = [
    { name: "email", label: "Email", type: "email", placeholder: "you@example.com" },
    { name: "phone", label: "Phone", type: "tel", placeholder: "Best number" },
    {
      name: "message", label: isShowing ? "Anything we should know? (optional)" : "Your question",
      type: "textarea", required: !isShowing, colSpan: 2,
      placeholder: isShowing ? "Let Roque know what works for you." : "Ask about availability, HOA fees, or a detail about this home.",
    },
    {
      name: "preferred_time", label: "Preferred showing day", type: "select", colSpan: 2, hidden: !isShowing,
      options: [
        { value: "today", label: "Today" },
        { value: "tomorrow", label: "Tomorrow" },
        { value: "this-weekend", label: "This weekend" },
        { value: "flexible", label: "I’m flexible" },
      ],
    },
  ];

  return (
    <div className="rounded-sm border border-ink/10 bg-white p-5 sm:p-6 lg:sticky lg:top-28">
      <span id="property-question" className="block h-0 scroll-mt-28" />
      <span id="property-showing" className="block h-0 scroll-mt-28" />
      {children}
      <h2 className="mt-4 font-display text-2xl text-ink">Ask about this home</h2>
      <p className="mt-2 text-sm text-ink/65">Get a personal answer from Roque, or ask to see the property.</p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Inquiry type">
        <a href="#property-question" aria-current={!isShowing ? "true" : undefined} className={`rounded-sm border px-3 py-2.5 text-center text-sm font-medium ${!isShowing ? "border-tide bg-tide text-sand" : "border-tide/25 text-tide hover:bg-tide/5"}`}>Ask a question</a>
        <a href="#property-showing" aria-current={isShowing ? "true" : undefined} className={`rounded-sm border px-3 py-2.5 text-center text-sm font-medium ${isShowing ? "border-tide bg-tide text-sand" : "border-tide/25 text-tide hover:bg-tide/5"}`}>Request a showing</a>
      </div>
      <p className="mt-4 text-sm text-ink/65">{isShowing ? "Roque will follow up to confirm availability and arrange the details." : "Your question will include this property’s address so Roque knows which home you mean."}</p>
      <div className="mt-4">
        <LeadForm
          formName="property-inquiry"
          submitLabel={isShowing ? "Request My Showing" : "Send My Question"}
          successMessage={isShowing ? `Roque will contact you about a showing at ${listingAddress}. Your showing time is not confirmed yet.` : `Roque will follow up on your question about ${listingAddress}.`}
          hiddenContext={{ listingAddress, listingId, requestType }}
          fields={fields}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-medium text-tide">
        <a href={SITE.phoneHref.replace(/^tel:/, "sms:")} className="underline underline-offset-4">Text Roque</a>
        <a href={SITE.phoneHref} className="underline underline-offset-4">Call {SITE.phoneDisplay}</a>
      </div>
    </div>
  );
}
