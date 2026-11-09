import { ANALYTICS_CAMPAIGNS, ANALYTICS_FORM_NAMES, ANALYTICS_REQUEST_TYPES } from "@/lib/analytics";

export const CONVERSION_COUNT_KEYS = ["formStarts", "submissionAttempts", "validationErrors", "submissionErrors", "successfulSubmissions", "calls", "texts", "emails", "legacyPhoneClicks"] as const;
export type ConversionCounts = Record<(typeof CONVERSION_COUNT_KEYS)[number], number>;
export type FormConversionCounts = Pick<ConversionCounts, "formStarts" | "submissionAttempts" | "validationErrors" | "submissionErrors" | "successfulSubmissions">;
export type ConversionReport = {
  observed: ConversionCounts;
  unclassified: ConversionCounts;
  automation: ConversionCounts;
  forms: Array<FormConversionCounts & { formName: string; requestType: string }>;
  campaigns: Array<{ campaign: string; pageviews: number; submissions: number; contactClicks: number }>;
};

export type VisitorReportCounts = {
  browsers: number;
  sessions: number;
  interactionBrowsers: number;
  probableAutomationBrowsers: number;
  unclassifiedBrowsers: number;
  pageviews: number;
  searches: number;
  leads: number;
  savedSearches: number;
};
export type VisitorReport = {
  days: number;
  generatedAt: string;
  from: string;
  current: VisitorReportCounts;
  legacy: { events: number; browsers: number };
  daily: Array<{ date: string; browsers: number; pageviews: number; searches: number; leads: number }>;
  topPages: Array<{ path: string; pageviews: number }>;
  conversion: ConversionReport | null;
};

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
export function parseVisitorReport(value: unknown): VisitorReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as VisitorReport;
  const counts = report.current;
  if (![7, 30].includes(report.days) || typeof report.generatedAt !== "string" || typeof report.from !== "string" || !Number.isFinite(Date.parse(report.generatedAt)) || !Number.isFinite(Date.parse(report.from))) return null;
  if (!counts || !["browsers", "sessions", "interactionBrowsers", "probableAutomationBrowsers", "unclassifiedBrowsers", "pageviews", "searches", "leads", "savedSearches"].every((key) => isCount(counts[key as keyof VisitorReportCounts]))) return null;
  if (!report.legacy || !isCount(report.legacy.events) || !isCount(report.legacy.browsers)) return null;
  if (!Array.isArray(report.daily) || !report.daily.every((day) => day && typeof day.date === "string" && [day.browsers, day.pageviews, day.searches, day.leads].every(isCount))) return null;
  if (!Array.isArray(report.topPages) || !report.topPages.every((page) => page && typeof page.path === "string" && isCount(page.pageviews))) return null;
  // Keep the existing report available during the additive database rollout.
  // Missing conversion data is unavailable, never an inferred zero.
  if (report.conversion == null) return { ...report, conversion: null };
  const conversion = report.conversion;
  if (![conversion.observed, conversion.unclassified, conversion.automation].every((counts) => counts && CONVERSION_COUNT_KEYS.every((key) => isCount(counts[key])))) return null;
  if (!Array.isArray(conversion.forms) || !conversion.forms.every((form) => form
    && ([...ANALYTICS_FORM_NAMES, "unknown"] as readonly string[]).includes(form.formName)
    && ([...ANALYTICS_REQUEST_TYPES, "unspecified"] as readonly string[]).includes(form.requestType)
    && [form.formStarts, form.submissionAttempts, form.validationErrors, form.submissionErrors, form.successfulSubmissions].every(isCount))) return null;
  if (!Array.isArray(conversion.campaigns) || !conversion.campaigns.every((campaign) => campaign
    && (ANALYTICS_CAMPAIGNS as readonly string[]).includes(campaign.campaign)
    && [campaign.pageviews, campaign.submissions, campaign.contactClicks].every(isCount))) return null;
  return report;
}
