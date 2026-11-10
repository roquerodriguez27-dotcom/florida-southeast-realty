"use client";

import LeadForm from "@/components/LeadForm";
import { planReportFields } from "@/lib/lead-contact";

interface Props {
  formName: string;
  title?: string;
  summary: string;
  successMessage?: string;
}

export default function PlanHandoff({ formName, title = "Review this plan with Roque", summary, successMessage = "Your plan and preferred reply details are saved for Roque to review. A meeting is confirmed only when you and Roque agree on a time." }: Props) {
  const tooLong = summary.length > 20000 || new TextEncoder().encode(JSON.stringify(planReportFields(summary))).byteLength > 24000;
  return (
    <section className="mt-8 border-t border-tide/15 pt-8" aria-label={title}>
      <h2 className="font-display text-2xl md:text-3xl text-tide">{title}</h2>
      <p className="mt-2 mb-5 max-w-2xl text-sm leading-relaxed text-ink/65">Send the details shown in your report with a question or a good time to reach you. Use either email or phone.</p>
      <details className="mb-5 rounded-sm border border-ink/10 bg-keystone/50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-tide">Review the plan included with your request</summary>
        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-ink/70">{summary || "Add your question or planning details above."}</pre>
      </details>
      {tooLong || !summary.trim() ? (
        <p role="status" className="rounded-sm border border-brass/40 bg-brass/10 p-4 text-sm text-ink/75">{tooLong ? "Your report is too long to send in one request. Save the full report, then shorten the notes before sending. No details will be silently removed." : "Add your question or planning details above to open the request form."}</p>
      ) : (
        <LeadForm
          formName={formName}
          fields={[
            { name: "name", label: "Name (optional)", type: "text" },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "preferred_contact", label: "Preferred reply", type: "select", options: [
              { value: "any", label: "Either contact method I provide" },
              { value: "email", label: "Email" }, { value: "call", label: "Phone call" }, { value: "text", label: "Text message" },
            ] },
            { name: "preferred_time", label: "Good time to reach you (optional)", type: "text", placeholder: "For example, weekdays after 4 p.m. Eastern", colSpan: 2 },
            { name: "message", label: "Question or next step (optional)", type: "textarea", placeholder: "What would you like help deciding?", colSpan: 2 },
          ]}
          hiddenContext={planReportFields(summary)}
          submitLabel="Send My Request to Roque"
          successMessage={successMessage}
        />
      )}
    </section>
  );
}
