"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ANALYTICS_OPTOUT_KEY, ANALYTICS_PREFERENCE_EVENT, ANALYTICS_SIGNAL_VERSION, BOT_USER_AGENT, analyticsCampaign, analyticsMetadata, analyticsPath, isProductionAnalyticsHost, isPublicAnalyticsPath, type AnalyticsEventName } from "@/lib/analytics";
import { excludeGoogleAnalytics, isGoogleAnalyticsEvent, pauseGoogleAnalytics, sendGoogleAnalyticsEvent } from "@/lib/google-analytics";

const LAST_SEARCH_STORAGE_KEY = "fsr-last-property-search-v1";
const LAST_SEARCH_UPDATED_EVENT = "fsr-last-property-search-updated";
const INTERACTION_KEY = "fsr-interaction-v3";
const CAMPAIGN_KEY = "fsr-analytics-campaign-v1";
const memoryIds = new Map<string, string>();
let interactionObserved = false;
let interactionQueued = false;
let eligibility: Promise<boolean> | undefined;

function getOrCreateId(kind: "localStorage" | "sessionStorage", key: string) {
  try {
    const storage = window[kind];
    const existing = storage.getItem(key);
    if (existing) return existing;
    const value = memoryIds.get(key) ?? crypto.randomUUID();
    memoryIds.set(key, value);
    storage.setItem(key, value);
    return value;
  } catch {
    const value = memoryIds.get(key) ?? crypto.randomUUID();
    memoryIds.set(key, value);
    return value;
  }
}

function optedOut() {
  try { return window.localStorage.getItem(ANALYTICS_OPTOUT_KEY) === "1"; }
  catch { return false; }
}

async function mayTrack(refreshEligibility = false) {
  if (!isProductionAnalyticsHost(window.location.host) || optedOut()) return false;
  if (refreshEligibility) eligibility = undefined;
  eligibility ??= fetch("/api/analytics", { cache: "no-store", credentials: "same-origin" })
    .then(async (response) => response.ok && (await response.json()).eligible === true)
    .catch(() => false);
  return await eligibility && !optedOut();
}

function visitorSignals(): Record<string, string | boolean> {
  const webdriver = navigator.webdriver === true;
  const botUserAgent = BOT_USER_AGENT.test(navigator.userAgent || "");
  return {
    signalVersion: ANALYTICS_SIGNAL_VERSION,
    interactionObserved,
    visitorType: webdriver || botUserAgent ? "probable_bot" : "browser",
    automatedSignal: webdriver ? "webdriver" : botUserAgent ? "user_agent" : "none",
  };
}

function campaignSignal(persist = true) {
  const current = analyticsCampaign(new URLSearchParams(window.location.search).get("fsr_campaign"));
  try {
    if (current && persist) window.sessionStorage.setItem(CAMPAIGN_KEY, current);
    return current ?? analyticsCampaign(window.sessionStorage.getItem(CAMPAIGN_KEY));
  } catch { return current; }
}

async function send(eventName: AnalyticsEventName, metadata: Record<string, string | number | boolean | null> = {}) {
  try {
    const pathname = window.location.pathname;
    const navigation = `${pathname}${window.location.search}`;
    if (!isPublicAnalyticsPath(pathname)) { excludeGoogleAnalytics(); return false; }
    const campaign = campaignSignal(false);
    // A CRM sign-in in another tab may change cookies without a storage event.
    // Recheck before loading Google or forwarding any event to it.
    const googleEvent = isGoogleAnalyticsEvent(eventName);
    const contactOutcome = googleEvent && eventName !== "page_view";
    if (googleEvent) pauseGoogleAnalytics();
    if (!await mayTrack(googleEvent) || !isPublicAnalyticsPath(window.location.pathname)) {
      excludeGoogleAnalytics();
      return false;
    }
    // A completed inquiry/contact outcome belongs to its original public
    // page even if the buyer navigates while the eligibility check completes.
    const navigationChanged = navigation !== `${window.location.pathname}${window.location.search}`;
    if (!contactOutcome && navigationChanged) return false;
    if (campaign && !navigationChanged) { try { window.sessionStorage.setItem(CAMPAIGN_KEY, campaign); } catch {} }
    sendGoogleAnalyticsEvent(eventName, { ...metadata, campaign: campaign ?? null }, pathname);
    const body = JSON.stringify({
      visitorId: getOrCreateId("localStorage", "fsr_visitor_id"),
      sessionId: getOrCreateId("sessionStorage", "fsr_session_id"),
      eventName, path: analyticsPath(pathname),
      metadata: analyticsMetadata({ ...metadata, ...visitorSignals(), campaign, eventId: crypto.randomUUID() }),
    });
    let queued = false;
    try { queued = navigator.sendBeacon?.("/api/analytics", new Blob([body], { type: "application/json" })) ?? false; } catch {}
    if (!queued) void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    return true;
  } catch { return false; }
}

function rememberPropertySearch(searchParams: URLSearchParams) {
  try {
    const query = new URLSearchParams(searchParams.toString());
    for (const key of ["page", "view", "north", "south", "east", "west", "shape"]) query.delete(key);
    if (!query.size) return;

    const location = query.get("location")?.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 2).join(" + ");
    const label = location || query.get("q")?.trim() || "South Florida homes";
    window.localStorage.setItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify({
      href: `/properties?${query.toString()}`,
      label: label.slice(0, 80),
      updatedAt: Date.now(),
    }));
    window.dispatchEvent(new Event(LAST_SEARCH_UPDATED_EVENT));
  } catch {
    // Personalization is optional and must never interrupt browsing.
  }
}

export function trackSiteEvent(eventName: AnalyticsEventName, metadata: Record<string, string | number | boolean | null> = {}) {
  // The destination navigation records this search; counting its link click as
  // another search would inflate the report.
  if (eventName === "property_search" && metadata.action === "continue_search") return;
  if (typeof window !== "undefined") void send(eventName, metadata);
}

export default function SiteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastNavigation = useRef<string | null>(null);
  useEffect(() => {
    const navigation = `${pathname}?${searchParams.toString()}`;
    if (lastNavigation.current === navigation) return;
    lastNavigation.current = navigation;
    pauseGoogleAnalytics();
    eligibility = undefined;
    if (!isPublicAnalyticsPath(pathname)) { excludeGoogleAnalytics(); return; }
    void send("page_view");
    if (pathname === "/properties" && searchParams.toString()) {
      void send("property_search");
      rememberPropertySearch(new URLSearchParams(searchParams.toString()));
    }
    if (pathname.startsWith("/properties/")) void send("property_view");
    if (pathname === "/home-valuation") void send("home_valuation_view");
  }, [pathname, searchParams]);
  useEffect(() => {
    const recheckGoogle = () => {
      eligibility = undefined;
      pauseGoogleAnalytics();
      if (!isPublicAnalyticsPath(window.location.pathname)) { excludeGoogleAnalytics(); return; }
      if (document.visibilityState === "hidden") return;
      const navigation = `${window.location.pathname}${window.location.search}`;
      void mayTrack(true).then((allowed) => {
        if (!allowed) { excludeGoogleAnalytics(); return; }
        if (allowed && navigation === `${window.location.pathname}${window.location.search}`) {
          sendGoogleAnalyticsEvent("page_view", { campaign: campaignSignal() });
        }
      });
    };
    const recordInteraction = (event: Event) => {
      if (!event.isTrusted || !isPublicAnalyticsPath(window.location.pathname)) return;
      interactionObserved = true;
      if (interactionQueued) return;
      try { if (window.sessionStorage.getItem(INTERACTION_KEY) === "1") return; } catch {}
      interactionQueued = true;
      void send("visitor_interaction", { interactionKind: event.type === "keydown" ? "keyboard" : "pointer" }).then((sent) => {
        if (sent) { try { window.sessionStorage.setItem(INTERACTION_KEY, "1"); } catch {} }
        else interactionQueued = false;
      });
    };
    const handler = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      const href = anchor?.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) void send("call_click");
      else if (href.startsWith("sms:")) void send("text_click");
      else if (href.startsWith("mailto:")) void send("email_click");
    };
    window.addEventListener(ANALYTICS_PREFERENCE_EVENT, recheckGoogle);
    window.addEventListener("storage", recheckGoogle);
    window.addEventListener("focus", recheckGoogle);
    window.addEventListener("blur", pauseGoogleAnalytics);
    document.addEventListener("visibilitychange", recheckGoogle);
    document.addEventListener("pointerdown", recordInteraction, true);
    document.addEventListener("keydown", recordInteraction, true);
    document.addEventListener("click", handler, true);
    return () => {
      pauseGoogleAnalytics();
      window.removeEventListener(ANALYTICS_PREFERENCE_EVENT, recheckGoogle);
      window.removeEventListener("storage", recheckGoogle);
      window.removeEventListener("focus", recheckGoogle);
      window.removeEventListener("blur", pauseGoogleAnalytics);
      document.removeEventListener("visibilitychange", recheckGoogle);
      document.removeEventListener("pointerdown", recordInteraction, true);
      document.removeEventListener("keydown", recordInteraction, true);
      document.removeEventListener("click", handler, true);
    };
  }, []);
  return null;
}
