"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { SITE } from "@/lib/site-config";
import { trackSiteEvent } from "@/components/SiteAnalytics";
import { contactValidationError, usesFlexibleContact } from "@/lib/lead-contact";

export interface LeadFormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2;
  defaultValue?: string;
  /** Keep a conditional field mounted so its draft survives, but omit it from submissions. */
  hidden?: boolean;
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
  message: string;
}

export default function LeadForm({ formName, fields, submitLabel, successMessage, hiddenContext }: LeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [validationError, setValidationError] = useState<{ message: string; requestType?: string } | null>(null);
  const [receipt, setReceipt] = useState<DeliveryReceipt | null>(null);
  const [submittedContext, setSubmittedContext] = useState<string | null>(null);
  const [lastSubmittedFields, setLastSubmittedFields] = useState<Record<string, string>>({});
  const formId = useId();
  const started = useRef(false);
  const submitting = useRef(false);
  const compactContact = usesFlexibleContact(formName);
  const renderedFields = formName === "buyer-tools-review"
    ? fields.filter((field) => field.name !== "name")
    : fields;
  const visibleFields = renderedFields.filter((field) => !field.hidden);
  const errorMessage = validationError?.requestType === hiddenContext?.requestType ? validationError?.message : "";
  const currentContext = JSON.stringify({ formName, context: hiddenContext ?? {} });
  const contextChanged = submittedContext !== null && submittedContext !== currentContext;

  function measurement(requestType = hiddenContext?.requestType) {
    return { formName, ...(requestType ? { requestType } : {}) };
  }

  function handleStart(event: React.SyntheticEvent<HTMLFormElement>) {
    const target = event.target;
    if (started.current || !event.isTrusted || !(target instanceof HTMLElement)
      || target.getAttribute("name") === "company_website"
      || !target.matches("input, select, textarea")) return;
    started.current = true;
    trackSiteEvent("form_start", measurement());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    const form = new FormData(e.currentTarget);
    const contextAtSubmission = currentContext;
    const honeypot = String(form.get("company_website") || "");

    const values: Record<string, string> = { ...hiddenContext };
    for (const field of fields) {
      if (field.hidden) continue;
      values[field.name] = String(form.get(field.name) || "").trim();
    }

    const eventMetadata = measurement(values.requestType);
    trackSiteEvent("form_submit_attempt", eventMetadata);
    function invalid(message: string) {
      setValidationError({ message, requestType: values.requestType });
      trackSiteEvent("form_validation_error", { ...eventMetadata, errorKind: "validation" });
    }

    for (const field of visibleFields) {
      if (compactContact && (field.name === "email" || field.name === "phone")) continue;
      if (field.required && !values[field.name]) {
        invalid(`${field.label} is required.`);
        return;
      }
    }

    const contactError = contactValidationError(formName, values);
    if (contactError) { invalid(contactError); return; }

    if (form.get("contact_consent") !== "yes") {
      invalid("Please confirm that we may contact you about this request.");
      return;
    }

    values.contact_consent = "yes";
    if (new TextEncoder().encode(JSON.stringify({ formName, honeypot, fields: values })).byteLength > 31000) {
      invalid("Your request is too long to send. Save the full report, then shorten your notes and try again. No details have been sent or removed.");
      return;
    }
    setValidationError(null);
    submitting.current = true;
    setStatus("submitting");

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formName, honeypot, fields: values }),
      });
      const data = await res.json();
      if (data.delivered && data.stored) {
        setLastSubmittedFields({ ...values });
        setSubmittedContext(contextAtSubmission);
        setReceipt({
          stored: true,
          notificationConfigured: data.notificationConfigured === true,
          notificationDelivered: data.notificationDelivered === true,
          message: successMessage,
        });
        trackSiteEvent("lead_submit", eventMetadata);
        setStatus("success");
      } else if (data.reason === "not_configured") {
        trackSiteEvent("form_submit_error", { ...eventMetadata, errorKind: "server" });
        setStatus("not_configured");
      } else if (data.reason === "spam") {
        setStatus("success");
      } else {
        trackSiteEvent("form_submit_error", { ...eventMetadata, errorKind: data.reason === "crm_storage_error" ? "storage" : "server" });
        setStatus("error");
      }
    } catch {
      trackSiteEvent("form_submit_error", { ...eventMetadata, errorKind: "network" });
      setStatus("error");
    } finally {
      submitting.current = false;
    }
  }

  if (status === "success") {
    return (
      <div className="bg-seagrass/10 border border-seagrass/30 rounded-sm p-8 text-center" role="status">
        <p className="font-display text-2xl text-tide">Request received.</p>
        <p className="text-sm text-ink/70 mt-2 max-w-md mx-auto">{receipt?.message ?? successMessage}</p>
        {contextChanged && <div className="mt-5 border-t border-seagrass/25 pt-4">
          <p className="mx-auto max-w-xl text-sm text-ink/75">You changed the worksheet or request details after this submission. The earlier version is saved; the revised version has not been sent.</p>
          <button type="button" onClick={() => { setStatus("idle"); setReceipt(null); setSubmittedContext(null); }} className="mt-3 rounded-sm border border-tide/30 bg-white px-4 py-2.5 text-sm font-medium text-tide">Send updated request</button>
        </div>}
        {receipt?.stored && receipt.notificationConfigured && !receipt.notificationDelivered ? (
          <p className="mt-3 text-xs text-hibiscus">Your request is saved, but we couldn&apos;t confirm the email alert to Roque. Please call if your request is urgent.</p>
        ) : null}
        <a href={SITE.phoneHref} className="mt-4 inline-block text-sm font-medium text-tide underline underline-offset-4">Call Roque: {SITE.phoneDisplay}</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onFocusCapture={handleStart} onChangeCapture={handleStart} onChange={() => { if (validationError) setValidationError(null); }} aria-busy={status === "submitting"} className={`bg-white border border-ink/10 rounded-sm ${compactContact ? "p-5 md:p-6" : "p-6 md:p-8"} space-y-4`} noValidate>
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${formId}-company_website`}>Company Website</label>
        <input id={`${formId}-company_website`} name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {renderedFields.map((field) => {
          const id = `${formId}-${field.name}`;
          const wrapClass = field.colSpan === 2 ? "sm:col-span-2" : "";
          const displayRequired = !field.hidden && field.required && !(compactContact && (field.name === "email" || field.name === "phone"));
          return (
            <div key={field.name} className={wrapClass} hidden={field.hidden}>
              <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wide text-ink/50 mb-1">
                {field.label}{displayRequired ? " *" : ""}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  name={field.name}
                  required={displayRequired}
                  placeholder={field.placeholder}
                  defaultValue={lastSubmittedFields[field.name] ?? field.defaultValue}
                  rows={4}
                  maxLength={5000}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-base md:text-sm focus:border-tide outline-none"
                />
              ) : field.type === "select" ? (
                <select
                  id={id}
                  name={field.name}
                  required={displayRequired}
                  defaultValue={lastSubmittedFields[field.name] ?? field.defaultValue ?? ""}
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
                  defaultValue={lastSubmittedFields[field.name] ?? field.defaultValue}
                  maxLength={field.name === "email" ? 254 : field.name === "phone" ? 40 : field.name === "name" ? 120 : 5000}
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

      {errorMessage && <p className="text-sm text-hibiscus" role="alert">{errorMessage}</p>}
      {(status === "not_configured" || status === "error") && (
        <div className="rounded-sm border border-hibiscus/25 bg-hibiscus/5 p-3 text-sm text-ink/75" role="alert">
          <p className="font-medium text-hibiscus">We couldn&apos;t confirm your request.</p>
          <p className="mt-1">
            Your answers are still here. You can try again, call or text{" "}
            <a href={SITE.phoneHref} className="font-medium text-tide underline">{SITE.phoneDisplay}</a>, or email{" "}
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
