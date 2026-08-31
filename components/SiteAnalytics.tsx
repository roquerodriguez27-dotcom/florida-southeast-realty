"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type EventName =
  | "page_view"
  | "property_search"
  | "property_view"
  | "home_valuation_view"
  | "lead_submit"
  | "phone_click"
  | "email_click"
  | "saved_search_submit"
  | "compare_change"
  | "buyer_tool_use";

const LAST_SEARCH_STORAGE_KEY = "fsr-last-property-search-v1";
const LAST_SEARCH_UPDATED_EVENT = "fsr-last-property-search-updated";

function getOrCreateId(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  storage.setItem(key, value);
  return value;
}

function referrerHost() {
  if (!document.referrer) return null;
  try {
    const url = new URL(document.referrer);
    return url.host === window.location.host ? null : url.host.slice(0, 253);
  } catch {
    return null;
  }
}

function send(eventName: EventName, metadata: Record<string, string | number | boolean | null> = {}) {
  try {
    const visitorId = getOrCreateId(localStorage, "fsr_visitor_id");
    const sessionId = getOrCreateId(sessionStorage, "fsr_session_id");
    const body = JSON.stringify({
      visitorId,
      sessionId,
      eventName,
      path: `${window.location.pathname}${window.location.search}`.slice(0, 600),
      referrerHost: referrerHost(),
      metadata,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // Analytics must never interfere with the customer experience.
  }
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

export function trackSiteEvent(eventName: EventName, metadata: Record<string, string | number | boolean | null> = {}) {
  if (typeof window !== "undefined") send(eventName, metadata);
}

export default function SiteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    send("page_view");
    if (pathname === "/properties" && searchParams.toString()) {
      send("property_search");
      rememberPropertySearch(new URLSearchParams(searchParams.toString()));
    }
    if (pathname.startsWith("/properties/")) send("property_view");
    if (pathname === "/home-valuation") send("home_valuation_view");
    if (pathname === "/buyer-tools") send("buyer_tool_use", { tool: searchParams.get("tool") ?? "cost" });
  }, [pathname, searchParams]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      const href = anchor?.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) send("phone_click");
      else if (href.startsWith("mailto:")) send("email_click");
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
