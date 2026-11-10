import { ANALYTICS_OPTOUT_COOKIE, ANALYTICS_OPTOUT_KEY, analyticsMetadata, analyticsPath, isProductionAnalyticsHost, isPublicAnalyticsPath, type AnalyticsEventName } from "./analytics";
import { SITE } from "./site-config";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const validMeasurementId = measurementId && /^G-[A-Z0-9]+$/.test(measurementId) ? measurementId : undefined;
const scriptId = "fsr-google-analytics";
const googleEvents: Partial<Record<AnalyticsEventName, string>> = {
  page_view: "page_view",
  lead_submit: "generate_lead",
  call_click: "contact_phone_click",
  text_click: "contact_text_click",
  email_click: "contact_email_click",
};

type GoogleParameters = Record<string, string | number | boolean>;
type GoogleCommand = ["js", Date] | ["set", GoogleParameters] | ["consent", "default", GoogleParameters]
  | ["config" | "event", string, GoogleParameters];
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...command: GoogleCommand) => void;
};

let configured = false;
let lastPageViewNavigation: string | undefined;
const pendingContactEvents: Array<{
  eventName: AnalyticsEventName;
  metadata: Record<string, string | boolean>;
  page: GoogleParameters;
}> = [];

export function isGoogleAnalyticsEvent(eventName: AnalyticsEventName) {
  return Boolean(googleEvents[eventName]);
}

export function pauseGoogleAnalytics() {
  if (typeof window === "undefined" || !validMeasurementId) return;
  Reflect.set(window, `ga-disable-${validMeasurementId}`, true);
}

export function excludeGoogleAnalytics() {
  pendingContactEvents.length = 0;
  pauseGoogleAnalytics();
}

function locallyExcluded() {
  if (!isProductionAnalyticsHost(window.location.host)
    || !isPublicAnalyticsPath(window.location.pathname)) return true;
  // Check again immediately before the tag runs. Cookies can change in another
  // tab while the server eligibility request is in flight.
  const cookies = document.cookie.split(";").map((part) => part.trim());
  if (cookies.some((part) => part === `${ANALYTICS_OPTOUT_COOKIE}=1`
    || /^sb-.+-auth-token(?:\.\d+)?=/.test(part))) return true;
  try { return window.localStorage.getItem(ANALYTICS_OPTOUT_KEY) === "1"; }
  catch { return false; }
}

/** Call only after the same-origin server has freshly approved this browser. */
export function sendGoogleAnalyticsEvent(eventName: AnalyticsEventName, metadata: Record<string, unknown> = {}, eventPath?: string) {
  if (typeof window === "undefined" || !validMeasurementId || !googleEvents[eventName]) return false;
  try {
    if (locallyExcluded()) { excludeGoogleAnalytics(); return false; }
    const analyticsWindow = window as AnalyticsWindow;
    const pageContext = (pathname: string) => {
      const path = analyticsPath(pathname);
      return { page_location: `${SITE.url}${path}`, page_title: path === "/" ? "Home" : path, page_referrer: "" };
    };
    const page = pageContext(eventPath ?? window.location.pathname);
    const currentPage = pageContext(window.location.pathname);
    const safe = analyticsMetadata(metadata);
    if (document.visibilityState === "hidden" || !document.hasFocus()) {
      // A contact link can open another app before the eligibility response
      // arrives. Preserve that outcome without enabling a background tag.
      if (eventName !== "page_view") {
        pendingContactEvents.push({ eventName, metadata: safe, page });
        if (pendingContactEvents.length > 10) pendingContactEvents.shift();
      }
      pauseGoogleAnalytics();
      return eventName !== "page_view";
    }
    analyticsWindow.dataLayer ??= [];
    analyticsWindow.gtag ??= function () {
      // Match the Google tag's command queue, including before its script loads.
      // eslint-disable-next-line prefer-rest-params
      analyticsWindow.dataLayer!.push(arguments);
    };
    if (!configured) {
      // Advertising permission is always denied here. Do not assert an
      // analytics-consent choice on the visitor's behalf.
      analyticsWindow.gtag("consent", "default", {
        ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
      });
    }
    Reflect.set(analyticsWindow, `ga-disable-${validMeasurementId}`, false);
    // Automatic session/engagement events must inherit the same bounded page
    // context as our explicit events, never document.title or location.href.
    analyticsWindow.gtag("set", currentPage);
    if (!configured) {
      analyticsWindow.gtag("js", new Date());
      analyticsWindow.gtag("config", validMeasurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        // Only our fixed fsr_campaign labels are measured. Do not import
        // arbitrary UTM text from the visitor's URL.
        campaign_id: "", campaign_source: "", campaign_medium: "",
        campaign_name: "", campaign_term: "", campaign_content: "",
      });
      configured = true;
    }
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.referrerPolicy = "no-referrer";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${validMeasurementId}`;
      script.onerror = () => { script.remove(); };
      document.head.appendChild(script);
    }

    const forward = (name: AnalyticsEventName, labels: Record<string, string | boolean>, context: GoogleParameters) => {
      const parameters: GoogleParameters = { ...context, send_to: validMeasurementId };
      if (labels.formName) parameters.form_name = labels.formName;
      if (labels.requestType) parameters.request_type = labels.requestType;
      if (labels.campaign) parameters.fsr_campaign = labels.campaign;
      analyticsWindow.gtag!("event", googleEvents[name]!, parameters);
    };
    // A fresh foreground eligibility check approves this flush. Each pending
    // outcome keeps its original bounded page/labels, even after navigation.
    for (const pending of pendingContactEvents.splice(0)) {
      forward(pending.eventName, pending.metadata, pending.page);
    }
    // This key stays in memory only. Queries distinguish client navigations,
    // but neither queries nor fragments are sent to Google.
    const navigation = `${window.location.pathname}${window.location.search}`;
    if (eventName === "page_view" && lastPageViewNavigation === navigation) return true;
    forward(eventName, safe, page);
    if (eventName === "page_view") lastPageViewNavigation = navigation;
    return true;
  } catch {
    // A blocked or broken optional tag must not affect the website or its own report.
    pauseGoogleAnalytics();
    return false;
  }
}
