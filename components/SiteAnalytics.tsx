"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ANALYTICS_OPTOUT_KEY, ANALYTICS_PREFERENCE_EVENT, ANALYTICS_SIGNAL_VERSION, BOT_USER_AGENT, analyticsMetadata, analyticsPath, isProductionAnalyticsHost, isPublicAnalyticsPath, type AnalyticsEventName } from "@/lib/analytics";

const LAST_SEARCH_STORAGE_KEY = "fsr-last-property-search-v1";
const LAST_SEARCH_UPDATED_EVENT = "fsr-last-property-search-updated";
const INTERACTION_KEY = "fsr-interaction-v3";
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

async function mayTrack() {
  if (!isProductionAnalyticsHost(window.location.host) || optedOut()) return false;
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

async function send(eventName: AnalyticsEventName, metadata: Record<string, string | number | boolean | null> = {}) {
  try {
    const pathname = window.location.pathname;
    if (!isPublicAnalyticsPath(pathname) || !await mayTrack()) return false;
    const body = JSON.stringify({
      visitorId: getOrCreateId("localStorage", "fsr_visitor_id"),
      sessionId: getOrCreateId("sessionStorage", "fsr_session_id"),
      eventName, path: analyticsPath(pathname),
      metadata: analyticsMetadata({ ...metadata, ...visitorSignals(), eventId: crypto.randomUUID() }),
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
    if (!isPublicAnalyticsPath(pathname)) return;
    void send("page_view");
    if (pathname === "/properties" && searchParams.toString()) {
      void send("property_search");
      rememberPropertySearch(new URLSearchParams(searchParams.toString()));
    }
    if (pathname.startsWith("/properties/")) void send("property_view");
    if (pathname === "/home-valuation") void send("home_valuation_view");
    if (pathname === "/buyer-tools") void send("buyer_tool_use");
  }, [pathname, searchParams]);
  useEffect(() => {
    const preferenceChanged = () => { eligibility = undefined; };
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
      if (href.startsWith("tel:") || href.startsWith("sms:")) void send("phone_click");
      else if (href.startsWith("mailto:")) void send("email_click");
    };
    window.addEventListener(ANALYTICS_PREFERENCE_EVENT, preferenceChanged);
    window.addEventListener("storage", preferenceChanged);
    document.addEventListener("pointerdown", recordInteraction, true);
    document.addEventListener("keydown", recordInteraction, true);
    document.addEventListener("click", handler, true);
    return () => {
      window.removeEventListener(ANALYTICS_PREFERENCE_EVENT, preferenceChanged);
      window.removeEventListener("storage", preferenceChanged);
      document.removeEventListener("pointerdown", recordInteraction, true);
      document.removeEventListener("keydown", recordInteraction, true);
      document.removeEventListener("click", handler, true);
    };
  }, []);
  return null;
}
