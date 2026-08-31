"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackSiteEvent } from "@/components/SiteAnalytics";

const STORAGE_KEY = "fsr-last-property-search-v1";
const UPDATED_EVENT = "fsr-last-property-search-updated";

type LastSearch = {
  href: string;
  label: string;
  updatedAt: number;
};

function readLastSearch(): LastSearch | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LastSearch>;
    if (
      typeof value.href !== "string"
      || !value.href.startsWith("/properties?")
      || typeof value.label !== "string"
      || !value.label.trim()
      || typeof value.updatedAt !== "number"
    ) return null;
    return value as LastSearch;
  } catch {
    return null;
  }
}

function ageLabel(updatedAt: number) {
  const minutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export default function ContinueSearchCard() {
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);

  useEffect(() => {
    const refresh = () => setLastSearch(readLastSearch());
    refresh();
    window.addEventListener(UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!lastSearch) return null;

  return (
    <section className="container-fsre pt-6 md:pt-8" aria-label="Continue your property search">
      <div className="flex flex-col gap-4 rounded-sm border border-brass/35 bg-brass/10 p-5 shadow-[0_18px_50px_-42px_rgba(14,43,48,0.8)] sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">Welcome back</p>
          <h2 className="mt-1 font-display text-2xl text-ink">Continue your {lastSearch.label} search</h2>
          <p className="mt-1 text-sm text-ink/55">Pick up where you left off · last viewed {ageLabel(lastSearch.updatedAt)}.</p>
        </div>
        <Link
          href={lastSearch.href}
          onClick={() => trackSiteEvent("property_search", { action: "continue_search" })}
          className="shrink-0 rounded-sm bg-tide px-5 py-3 text-center text-sm font-medium text-sand hover:bg-tide-light"
        >
          Continue search →
        </Link>
      </div>
    </section>
  );
}
