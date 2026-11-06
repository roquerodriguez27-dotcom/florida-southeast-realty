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
  return report;
}
