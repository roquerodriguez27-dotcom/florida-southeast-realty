"use client";

import { useState } from "react";

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

export default function LeadForm({ formName, fields, submitLabel, successMessage, hiddenContext }: LeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [validationError, setValidationError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const honeypot = String(form.get("company_website") || "");

    const values: Record<string, string> = { ...hiddenContext };
    for (const field of fields) {
      values[field.name] = String(form.get(field.name) || "").trim();
    }

    for (const field of fields) {
      if (field.required && !values[field.name]) {
        setValidationError(`${field.label} is required.`);
        return;
      }
    }
    const email = values["email"];
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setValidationError("Enter a valid email address.");
      return;
    }

    setValidationError("");
    setStatus("submitting");

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formName, honeypot, fields: values }),
      });
      const data = await res.json();
      if (data.delivered) {
        setStatus("success");
      } else if (data.reason === "not_configured") {
        setStatus("not_configured");
      } else if (data.reason === "spam") {
        // Show success to the bot without actually sending anywhere.
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
      </div>
    );
  }

  if (status === "not_configured") {
    return (
      <div className="bg-brass/10 border border-brass/30 rounded-sm p-8 text-center" role="status">
        <p className="font-display text-2xl text-tide">Almost there.</p>
        <p className="text-sm text-ink/70 mt-2 max-w-md mx-auto">
          This form isn&apos;t connected to a live inbox yet in this environment, so nothing was
          sent. Please reach us directly instead —{" "}
          <a href="tel:+19545550100" className="text-tide underline">(954) 555-0100</a> or{" "}
          <a href="mailto:hello@floridasoutheastrealty.com" className="text-tide underline">
            hello@floridasoutheastrealty.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-ink/10 rounded-sm p-6 md:p-8 space-y-4" noValidate>
      {/* Honeypot — hidden from real visitors via CSS, left unlabeled for screen readers via aria-hidden */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${formName}-company_website`}>Company Website</label>
        <input id={`${formName}-company_website`} name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map((field) => {
          const id = `${formName}-${field.name}`;
          const wrapClass = field.colSpan === 2 ? "sm:col-span-2" : "";
          return (
            <div key={field.name} className={wrapClass}>
              <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wide text-ink/50 mb-1">
                {field.label}{field.required ? " *" : ""}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  name={field.name}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  rows={4}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:border-tide outline-none"
                />
              ) : field.type === "select" ? (
                <select
                  id={id}
                  name={field.name}
                  required={field.required}
                  defaultValue={field.defaultValue ?? ""}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-sm bg-white focus:border-tide outline-none"
                >
                  <option value="" disabled={field.required}>Select one</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={field.name}
                  type={field.type}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:border-tide outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {validationError && (
        <p className="text-sm text-hibiscus" role="alert">{validationError}</p>
      )}
      {status === "error" && (
        <p className="text-sm text-hibiscus" role="alert">
          Something went wrong sending this. Please call (954) 555-0100 instead.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-hibiscus hover:bg-hibiscus-dark disabled:opacity-60 text-sand font-medium text-sm rounded-sm px-4 py-3 transition-colors"
      >
        {status === "submitting" ? "Sending…" : submitLabel}
      </button>
      <p className="text-xs text-ink/40">
        No obligation. We never share your information with third parties.
      </p>
    </form>
  );
}
