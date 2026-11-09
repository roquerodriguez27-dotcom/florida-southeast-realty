"use client";

import { useSyncExternalStore } from "react";
import type { SavedComparisonListing } from "@/lib/comparison";
import type { IdxAttribution } from "@/lib/types";

const STORAGE_KEY = "fsr-saved-listings-v1";
const UPDATED_EVENT = "fsr-saved-listings-updated";
const MAX_SAVED_LISTINGS = 40;
const EMPTY_LISTINGS: SavedComparisonListing[] = [];

let cachedRaw: string | null = null;
let cachedListings = EMPTY_LISTINGS;

function isSavedListing(value: unknown): value is SavedComparisonListing {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedComparisonListing>;
  return typeof item.slug === "string" && item.slug.trim().length >= 4 && item.slug.length <= 300
    && (item.image === undefined || typeof item.image === "string")
    && typeof item.mlsId === "string" && item.mlsId.length <= 100
    && typeof item.address === "string"
    && typeof item.city === "string"
    && typeof item.zip === "string"
    && typeof item.price === "number" && Number.isFinite(item.price)
    && typeof item.beds === "number" && Number.isFinite(item.beds)
    && typeof item.baths === "number" && Number.isFinite(item.baths)
    && typeof item.halfBaths === "number" && Number.isFinite(item.halfBaths)
    && typeof item.sqft === "number" && Number.isFinite(item.sqft)
    && typeof item.yearBuilt === "number" && Number.isFinite(item.yearBuilt)
    && typeof item.waterfront === "boolean"
    && typeof item.propertyType === "string";
}

function validAttribution(value: unknown): value is IdxAttribution {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<IdxAttribution>;
  return item.provider === "RESO"
    && (item.view === "Summary" || item.view === "Detail")
    && (item.mlsId === undefined || typeof item.mlsId === "string")
    && (item.mlsName === undefined || typeof item.mlsName === "string")
    && (item.disclaimer === undefined || typeof item.disclaimer === "string")
    && (item.logo === undefined || (item.logo !== null
      && (item.logo.type === "Uri" || item.logo.type === "Text") && typeof item.logo.value === "string"))
    && Array.isArray(item.requiredFields)
    && item.requiredFields.every((field) => field && typeof field.label === "string" && typeof field.value === "string");
}

function parseListings(raw: string | null): SavedComparisonListing[] {
  if (!raw) return EMPTY_LISTINGS;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return EMPTY_LISTINGS;
    const seen = new Set<string>();
    return value.filter(isSavedListing).filter((item) => {
      if (seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    }).slice(0, MAX_SAVED_LISTINGS).map((item) => ({
      ...item,
      idx: validAttribution(item.idx) ? item.idx : undefined,
    }));
  } catch {
    return EMPTY_LISTINGS;
  }
}

function getSnapshot(): SavedComparisonListing[] {
  if (typeof window === "undefined") return EMPTY_LISTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedListings = parseListings(raw);
    }
  } catch {
    // Storage can be disabled by browser privacy settings. Keep navigation usable.
  }
  return cachedListings;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(UPDATED_EVENT, callback);
  };
}

function writeListings(listings: SavedComparisonListing[]) {
  if (typeof window === "undefined") return false;
  const next = listings.slice(0, MAX_SAVED_LISTINGS);
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    return false;
  }
  cachedRaw = raw;
  cachedListings = next;
  window.dispatchEvent(new Event(UPDATED_EVENT));
  return true;
}

export function useSavedListings() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_LISTINGS);
}

export function toggleSavedListing(listing: SavedComparisonListing): "added" | "removed" | "storage-unavailable" {
  const current = getSnapshot();
  if (current.some((item) => item.slug === listing.slug)) {
    return writeListings(current.filter((item) => item.slug !== listing.slug)) ? "removed" : "storage-unavailable";
  }
  return writeListings([listing, ...current]) ? "added" : "storage-unavailable";
}

export function removeSavedListing(slug: string) {
  return writeListings(getSnapshot().filter((item) => item.slug !== slug));
}

export function clearSavedListings() {
  return writeListings([]);
}
