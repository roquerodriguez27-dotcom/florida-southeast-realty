"use client";

import Link from "next/link";
import { useState } from "react";
import { SITE } from "@/lib/site-config";
import { trackSiteEvent } from "@/components/SiteAnalytics";

export interface LeadFormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2;
  defaultValue?: string;
}

interface LeadFormProps {
  formName: string;
  fields: LeadFormField[];
  submitLabel: string;
  successMessage: string;
  hiddenContext?: Record<string, string>;
}

type Status = "idle" | "submitting" | "success" | "not_configured" | "error";

interface DeliveryReceipt {
  stored: boolean;
  notificationConfigured: boolean;
  notificationDelivered: boolean;
}

export default function LeadForm({ formName, fields, submitLabel, successMessage, hiddenContext }: LeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [validationError, setValidationError] = useState("");
  const [receipt, setReceipt] = useState<DeliveryReceipt | null>(null);
  const compactContact = formName === "property-inquiry" || formName === "buyer-tools-review";
  const visibleFields = formName === "buyer-tools-review"
    ? fields.filter((field) => field.name !== "name")
    : fields;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const honeypot = String(form.get("company_website") || "");

    const values: Record<string, string> = { ...hiddenContext };
    for (const field of fields) {
      values[field.name] = String(form.get(field.name) || "").trim();
    }

    for (const field of visibleFields) {
      if (compactContact && (field.name === "email" || field.name === "phone")) continue;
      if (field.required && !values[field.name]) {
        setValidationError(`${field.label} is required.`);
        return;
      }
    }

    if (compactContact && !values.email && !values.phone) {
      setValidationError("Enter an email address or phone number so Roque can follow up.");
      return;
    }

    const email = values.email;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setValidationError("Enter a valid email address.");
      return;
    }

    if (form.get("contact_consent") !== "yes") {
      setValidationError("Please confirm that we may contact you about this request.");
      return;
    }

    values.contact_consent = "yes";
    setValidationError("");
    setStatus("submitting");

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formName, honeypot, fields: values }),
      });
      const data = await res.json();
      if (data.delivered && data.stored) {
        setReceipt({
          stored: true,
          notificationConfigured: data.notificationConfigured === true,
          notificationDelivered: data.notificationDelivered === true,
        });
        trackSiteEvent("lead_submit", { formName });
        setStatus("success");
      } else if (data.reason === "not_configured") {
        setStatus("not_configured");
      } else if (data.reason === "spam") {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-seagrass/10 border border-seagrass/30 rounded-sm p-8 text-center" role="status">
        <p className="font-display text-2xl text-tide">Request received.</p>
        <p className="text-sm text-ink/70 mt-2 max-w-md mx-auto">{successMessage}</p>
        {receipt?.stored ? (
          <p className="mt-3 text-sm font-medium text-tide">Saved securely to the Florida Southeast Realty CRM.</p>
        ) : null}
        {receipt?.notificationDelivered ? (
          <p className="mt-1 text-xs text-ink/60">A notification email was sent to the brokerage.</p>
        ) : receipt?.notificationConfigured ? (
          <p className="mt-2 text-xs text-hibiscus">The CRM saved your request, but the broker notification email could not be confirmed. For an urgent request, please call or text {SITE.phoneDisplay}.</p>
        ) : (
          <p className="mt-2 text-xs text-ink/55">The brokerage can see this request in the CRM. For an urgent request, please call or text {SITE.phoneDisplay}.</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`bg-white border border-ink/10 rounded-sm ${compactContact ? "p-5 md:p-6" : "p-6 md:p-8"} space-y-4`} noValidate>
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${formName}-company_website`}>Company Website</label>
        <input id={`${formName}-company_website`} name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {visibleFields.map((field) => {
          const id = `${formName}-${field.name}`;
          const wrapClass = field.colSpan === 2 ? "sm:col-span-2" : "";
          const displayRequired = field.required && !(compactContact && (field.name === "email" || field.name === "phone"));
          return (
            <div key={field.name} className={wrapClass}>
              <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wide text-ink/50 mb-1">
                {field.label}{displayRequired ? " *" : ""}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  name={field.name}
                  required={displayRequired}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  rows={4}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-base md:text-sm focus:border-tide outline-none"
                />
              ) : field.type === "select" ? (
                <select
                  id={id}
                  name={field.name}
                  required={displayRequired}
                  defaultValue={field.defaultValue ?? ""}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-base md:text-sm bg-white focus:border-tide outline-none"
                >
                  <option value="" disabled={displayRequired}>Select one</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={field.name}
                  type={field.type}
                  required={displayRequired}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  autoComplete={field.name === "name" ? "name" : field.name === "email" ? "email" : field.name === "phone" ? "tel" : undefined}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-base md:text-sm focus:border-tide outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {compactContact ? <p className="text-xs text-ink/50">Use either email or phone. You do not need to fill in both.</p> : null}

      <label className="flex items-start gap-3 text-xs text-ink/60 leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          name="contact_consent"
          value="yes"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-tide)]"
        />
        <span>
          By submitting, you agree that {SITE.shortName} may contact you by phone, email, or text about this request. Consent is not a condition of purchase. Message and data rates may apply. See our <Link href="/privacy-policy" className="text-tide underline">Privacy Policy</Link>.
        </span>
      </label>

      {validationError && <p className="text-sm text-hibiscus" role="alert">{validationError}</p>}
      {(status === "not_configured" || status === "error") && (
        <div className="rounded-sm border border-hibiscus/25 bg-hibiscus/5 p-3 text-sm text-ink/75" role="alert">
          <p className="font-medium text-hibiscus">We couldn&apos;t send this online.</p>
          <p className="mt-1">
            Your answers are still here, so you can try again—or call/text{" "}
            <a href={SITE.phoneHref} className="font-medium text-tide underline">{SITE.phoneDisplay}</a> or email{" "}
            <a href={`mailto:${SITE.email}`} className="font-medium text-tide underline">{SITE.email}</a>.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-hibiscus hover:bg-hibiscus-dark disabled:opacity-60 text-sand font-medium text-sm rounded-sm px-4 py-3 transition-colors"
      >
        {status === "submitting"
          ? "Sending…"
          : status === "not_configured" || status === "error"
            ? "Try Sending Again"
            : submitLabel}
      </button>
    </form>
  );
}
