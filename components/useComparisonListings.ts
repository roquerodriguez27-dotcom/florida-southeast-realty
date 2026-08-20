"use client";

import { useSyncExternalStore } from "react";
import {
  MAX_COMPARE_LISTINGS,
  type SavedComparisonListing,
} from "@/lib/comparison";

const STORAGE_KEY = "fsr-comparison-listings-v1";
const UPDATED_EVENT = "fsr-comparison-listings-updated";
const EMPTY_LISTINGS: SavedComparisonListing[] = [];

let cachedRaw: string | null = null;
let cachedListings = EMPTY_LISTINGS;

function isSavedListing(value: unknown): value is SavedComparisonListing {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedComparisonListing>;
  return typeof item.slug === "string"
    && typeof item.mlsId === "string"
    && typeof item.address === "string"
    && typeof item.city === "string"
    && typeof item.zip === "string"
    && typeof item.price === "number"
    && typeof item.beds === "number"
    && typeof item.baths === "number"
    && typeof item.halfBaths === "number"
    && typeof item.sqft === "number"
    && typeof item.yearBuilt === "number"
    && typeof item.waterfront === "boolean"
    && typeof item.propertyType === "string";
}

function parseListings(raw: string | null): SavedComparisonListing[] {
  if (!raw) return EMPTY_LISTINGS;
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter(isSavedListing).slice(0, MAX_COMPARE_LISTINGS)
      : EMPTY_LISTINGS;
  } catch {
    return EMPTY_LISTINGS;
  }
}

function getSnapshot(): SavedComparisonListing[] {
  if (typeof window === "undefined") return EMPTY_LISTINGS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedListings = parseListings(raw);
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
  const next = listings.slice(0, MAX_COMPARE_LISTINGS);
  const raw = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedListings = next;
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function useComparisonListings() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_LISTINGS);
}

export function toggleComparisonListing(listing: SavedComparisonListing): "added" | "removed" | "limit" {
  const current = getSnapshot();
  if (current.some((item) => item.slug === listing.slug)) {
    writeListings(current.filter((item) => item.slug !== listing.slug));
    return "removed";
  }
  if (current.length >= MAX_COMPARE_LISTINGS) return "limit";
  writeListings([...current, listing]);
  return "added";
}

export function removeComparisonListing(slug: string) {
  writeListings(getSnapshot().filter((item) => item.slug !== slug));
}

export function clearComparisonListings() {
  writeListings([]);
}
