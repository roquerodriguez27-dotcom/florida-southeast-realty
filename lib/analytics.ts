/** Privacy-conscious first-party visitor-report fields. These are estimates, not people counts. */
export const ANALYTICS_EVENTS = [
  "page_view", "property_search", "property_view", "home_valuation_view", "lead_submit",
  "phone_click", "email_click", "saved_search_submit", "compare_change", "buyer_tool_use",
  "visitor_interaction", "call_click", "text_click", "form_start", "form_submit_attempt",
  "form_validation_error", "form_submit_error",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export const ANALYTICS_FORM_NAMES = ["contact", "home-valuation", "sellers-page", "buyer-inquiry", "property-inquiry", "buyer-tools-review", "agent-recruiting"] as const;
export type AnalyticsFormName = (typeof ANALYTICS_FORM_NAMES)[number];
export const ANALYTICS_REQUEST_TYPES = ["showing", "question", "shortlist"] as const;
export const ANALYTICS_ERROR_KINDS = ["validation", "network", "server", "storage"] as const;
// Explicit campaign labels only. Never retain arbitrary UTMs, query text or referrers.
export const ANALYTICS_CAMPAIGNS = ["seller-review", "buyer-search", "property-share", "referral", "relocation"] as const;
export type AnalyticsCampaign = (typeof ANALYTICS_CAMPAIGNS)[number];
export const ANALYTICS_OPTOUT_KEY = "fsr-analytics-opt-out";
export const ANALYTICS_OPTOUT_COOKIE = "fsr_analytics_opt_out";
export const ANALYTICS_PREFERENCE_EVENT = "fsr-analytics-preference";
export const ANALYTICS_SIGNAL_VERSION = "3";
export const BOT_USER_AGENT = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|googleother|google-inspectiontool|semrush|ahrefs|mj12bot|dotbot|headless|phantomjs|python-requests|curl|wget)/i;

export function analyticsCampaign(value: unknown): AnalyticsCampaign | undefined {
  return typeof value === "string" && (ANALYTICS_CAMPAIGNS as readonly string[]).includes(value) ? value as AnalyticsCampaign : undefined;
}

export function isPublicAnalyticsPath(path: string): boolean {
  return path.startsWith("/") && !/^\/(crm|api|auth)(?:\/|$|\?)/i.test(path);
}

export function isProductionAnalyticsHost(host: string): boolean {
  return ["floridasoutheastrealty.com", "www.floridasoutheastrealty.com"].includes(host.toLowerCase());
}

export function isProductionAnalyticsRequest(host: string, vercelEnvironment: string | undefined): boolean {
  return vercelEnvironment === "production" && isProductionAnalyticsHost(host);
}

/** Never store search strings, fragments, email addresses, or arbitrary URL paths. */
export function analyticsPath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0].slice(0, 600);
  if (/^\/properties\/[^/]+\/?$/.test(pathname)) return "/properties/[listing]";
  for (const [section, label] of [["communities", "community"], ["homes-for-sale", "market"], ["guides", "guide"], ["blog", "article"]]) {
    if (new RegExp(`^/${section}/[^/]+/?$`).test(pathname)) return `/${section}/[${label}]`;
  }
  const allowed = new Set(["/", "/properties", "/home-valuation", "/buyer-tools", "/contact", "/about", "/sellers", "/communities", "/research", "/join", "/guides", "/testimonials", "/terms-of-use", "/privacy-policy", "/fair-housing", "/accessibility-statement", "/blog", "/fort-lauderdale-homes-for-sale", "/compare", "/saved-homes"]);
  if (allowed.has(pathname)) return pathname;
  return "/other";
}

/** Only fixed measurement signals survive; caller-provided text is intentionally discarded. */
export function analyticsMetadata(input: Record<string, unknown>): Record<string, string | boolean> {
  const output: Record<string, string | boolean> = {};
  if (input.signalVersion === ANALYTICS_SIGNAL_VERSION) output.signalVersion = ANALYTICS_SIGNAL_VERSION;
  if (input.trafficScope === "production") output.trafficScope = "production";
  if (typeof input.interactionObserved === "boolean") output.interactionObserved = input.interactionObserved;
  if (input.visitorType === "browser" || input.visitorType === "probable_bot") output.visitorType = input.visitorType;
  if (["webdriver", "user_agent", "none"].includes(String(input.automatedSignal))) output.automatedSignal = String(input.automatedSignal);
  if (["pointer", "keyboard"].includes(String(input.interactionKind))) output.interactionKind = String(input.interactionKind);
  if (typeof input.formName === "string" && (ANALYTICS_FORM_NAMES as readonly string[]).includes(input.formName)) output.formName = input.formName;
  if (typeof input.requestType === "string" && (ANALYTICS_REQUEST_TYPES as readonly string[]).includes(input.requestType)) output.requestType = input.requestType;
  if (typeof input.errorKind === "string" && (ANALYTICS_ERROR_KINDS as readonly string[]).includes(input.errorKind)) output.errorKind = input.errorKind;
  const campaign = analyticsCampaign(input.campaign);
  if (campaign) output.campaign = campaign;
  if (typeof input.eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.eventId)) output.eventId = input.eventId;
  return output;
}
