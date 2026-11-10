/** Fixed form identifiers keep visitor text out of analytics and routing decisions. */
export const PLANNING_FORM_NAMES = [
  "planning-seller-proceeds", "planning-seller-timing", "planning-seller-preparation",
  "planning-seller-offers", "planning-seller-report", "planning-buyer-checklist",
  "planning-buyer-relocation", "planning-buyer-tour", "planning-buyer-loans",
  "planning-owner-calendar", "planning-voice-question",
] as const;

export function isPlanningForm(formName: string): boolean {
  return (PLANNING_FORM_NAMES as readonly string[]).includes(formName);
}

export function usesFlexibleContact(formName: string): boolean {
  return formName === "property-inquiry" || formName === "buyer-tools-review" || isPlanningForm(formName);
}

/** Split complete reports into existing per-field limits without dropping content. */
export function planReportFields(report: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let part = 0;
  for (let index = 0; index < report.length;) {
    let end = Math.min(index + 4000, report.length);
    // Keep UTF-16 surrogate pairs intact for Postgres JSON and email delivery.
    if (end < report.length && /[\uD800-\uDBFF]/.test(report[end - 1])) end--;
    part++;
    fields[part === 1 ? "plan_summary" : `plan_summary_part_${part}`] = report.slice(index, end);
    index = end;
  }
  return fields;
}

export function contactValidationError(formName: string, fields: Record<string, string>): string | null {
  const email = fields.email?.trim() ?? "";
  const phone = fields.phone?.trim() ?? "";
  if ((fields.name?.trim().length ?? 0) > 120) return "Enter a name with no more than 120 characters.";
  if (usesFlexibleContact(formName) && !email && !phone) return "Enter an email address or phone number so Roque can follow up.";
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return "Enter a valid email address.";
  if (phone.length > 40) return "Enter a phone number with no more than 40 characters.";
  if (usesFlexibleContact(formName) && !email && phone.replace(/\D/g, "").length < 7) return "Enter a phone number with at least 7 digits, or use your email address.";
  if (isPlanningForm(formName)) {
    const preference = fields.preferred_contact ?? "";
    if (!["", "any", "email", "call", "text"].includes(preference)) return "Choose a supported reply method.";
    if (preference === "email" && !email) return "Add an email address for your preferred reply method.";
    if ((preference === "call" || preference === "text") && phone.replace(/\D/g, "").length < 7) return "Add a phone number for your preferred reply method.";
    if (!fields.plan_summary?.trim()) return "Add your plan or question before sending it.";
  }
  return null;
}
