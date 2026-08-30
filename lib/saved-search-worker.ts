import "server-only";

import { createHash } from "node:crypto";
import { SITE } from "@/lib/site-config";
import type {
  Listing,
  ListingAmenity,
  ListingFilters,
  ListingSort,
  PropertyType,
} from "@/lib/types";
import {
  LISTING_AMENITIES,
  LISTING_ARCHITECTURE_FILTERS,
  LISTING_COOLING_FILTERS,
  LISTING_HEATING_FILTERS,
  LISTING_VIEW_FILTERS,
} from "@/lib/types";

export interface SavedSearchSnapshotItem {
  mlsId: string;
  slug: string;
  address: string;
  price: number;
  status: string;
}

export interface SavedSearchChangeSet {
  newMatches: Listing[];
  priceChanges: Array<{ listing: Listing; previousPrice: number }>;
  backOnMarket: Listing[];
}

const PROPERTY_TYPES: PropertyType[] = ["Single Family", "Condo", "Townhome", "Estate", "Multi-Family", "Land", "Commercial", "Other"];
const SORTS: ListingSort[] = ["newest", "price-asc", "price-desc", "sqft-desc", "sqft-asc", "lot-desc", "dom-asc", "dom-desc"];

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return typeof value === "string" && values.includes(value as T) ? value as T : undefined;
}

function parseMapArea(value: unknown): ListingFilters["bounds"] | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const match = raw.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const south = Number(match[1]);
  const west = Number(match[2]);
  const north = Number(match[3]);
  const east = Number(match[4]);
  if (![south, west, north, east].every(Number.isFinite) || north <= south || east <= west) return undefined;
  return { south, west, north, east };
}

export function savedCriteriaToFilters(criteria: unknown): ListingFilters {
  const data = criteria && typeof criteria === "object" && !Array.isArray(criteria)
    ? criteria as Record<string, unknown>
    : {};
  const locations = text(data.locations)?.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 8);
  const amenities = text(data.amenities)?.split(",").map((value) => value.trim())
    .filter((value): value is ListingAmenity => LISTING_AMENITIES.includes(value as ListingAmenity));
  const propertyType = oneOf(data.propertyType, PROPERTY_TYPES);
  const listingStatus = oneOf(data.listingStatus, ["active", "coming-soon", "under-contract"] as const);
  const seniorCommunityMode = oneOf(data.seniorCommunity, ["exclude", "only"] as const);
  const sort = oneOf(data.sort, SORTS) ?? "newest";

  return {
    q: text(data.q),
    locations: locations?.length ? locations : undefined,
    minPrice: numberValue(data.minPrice),
    maxPrice: numberValue(data.maxPrice),
    beds: numberValue(data.beds),
    baths: numberValue(data.baths),
    minSqft: numberValue(data.minSqft),
    maxSqft: numberValue(data.maxSqft),
    minLotSqft: numberValue(data.minLotSqft),
    maxLotSqft: numberValue(data.maxLotSqft),
    minYearBuilt: numberValue(data.minYearBuilt),
    maxYearBuilt: numberValue(data.maxYearBuilt),
    listingStatus,
    propertyType,
    waterfrontOnly: bool(data.waterfrontOnly),
    privatePoolOnly: bool(data.privatePoolOnly),
    minGarageSpaces: numberValue(data.minGarageSpaces),
    newConstructionOnly: bool(data.newConstructionOnly),
    seniorCommunityMode,
    noHoaOnly: bool(data.noHoaOnly),
    maxHoaMonthly: numberValue(data.maxHoaMonthly),
    priceReducedOnly: bool(data.priceReducedOnly),
    maxAnnualTaxes: numberValue(data.maxAnnualTaxes),
    architecturalStyle: oneOf(data.architecturalStyle, LISTING_ARCHITECTURE_FILTERS),
    viewType: oneOf(data.viewType, LISTING_VIEW_FILTERS),
    coolingType: oneOf(data.coolingType, LISTING_COOLING_FILTERS),
    heatingType: oneOf(data.heatingType, LISTING_HEATING_FILTERS),
    fireplaceOnly: bool(data.fireplaceOnly),
    amenities: amenities?.length ? amenities : undefined,
    maxDaysOnMarket: numberValue(data.maxDaysOnMarket),
    sort,
    bounds: parseMapArea(data.mapArea),
  };
}

export function snapshotListings(listings: Listing[]): SavedSearchSnapshotItem[] {
  return listings.slice(0, 24).map((listing) => ({
    mlsId: listing.mlsId,
    slug: listing.slug,
    address: listing.address,
    price: listing.price,
    status: listing.status,
  }));
}

export function compareSavedSearchSnapshots(
  listings: Listing[],
  previous: unknown,
  flags: { newMatches: boolean; priceChanges: boolean; backOnMarket: boolean },
): SavedSearchChangeSet {
  const prior = Array.isArray(previous) ? previous : [];
  const previousById = new Map<string, SavedSearchSnapshotItem>();
  for (const item of prior) {
    if (!item || typeof item !== "object") continue;
    const value = item as Partial<SavedSearchSnapshotItem>;
    if (typeof value.mlsId !== "string") continue;
    previousById.set(value.mlsId, {
      mlsId: value.mlsId,
      slug: typeof value.slug === "string" ? value.slug : "",
      address: typeof value.address === "string" ? value.address : "",
      price: typeof value.price === "number" ? value.price : 0,
      status: typeof value.status === "string" ? value.status : "",
    });
  }

  const newMatches: Listing[] = [];
  const priceChanges: Array<{ listing: Listing; previousPrice: number }> = [];
  const backOnMarket: Listing[] = [];
  for (const listing of listings) {
    const old = previousById.get(listing.mlsId);
    if (!old) {
      if (flags.newMatches) newMatches.push(listing);
      continue;
    }
    if (flags.priceChanges && old.price > 0 && old.price !== listing.price) {
      priceChanges.push({ listing, previousPrice: old.price });
    }
    if (flags.backOnMarket && old.status && old.status !== "Active" && listing.status === "Active") {
      backOnMarket.push(listing);
    }
  }
  return { newMatches, priceChanges, backOnMarket };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function listingLine(listing: Listing): string {
  return `${listing.address} — ${money(listing.price)} — ${SITE.url}/properties/${listing.slug}`;
}

export async function sendSavedSearchEmail(args: {
  email: string;
  frequency: string;
  changes: SavedSearchChangeSet;
  unsubscribeToken: string;
  searchId: string;
}): Promise<{ configured: boolean; delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { configured: false, delivered: false };
  const from = process.env.RESEND_FROM_EMAIL?.trim()
    || `Florida Southeast Realty <website@${new URL(SITE.url).hostname.replace(/^www\./, "")}>`;
  const sections: string[] = [];
  if (args.changes.newMatches.length) {
    sections.push(`NEW MATCHES\n${args.changes.newMatches.slice(0, 8).map(listingLine).join("\n")}`);
  }
  if (args.changes.priceChanges.length) {
    sections.push(`PRICE CHANGES\n${args.changes.priceChanges.slice(0, 8).map(({ listing, previousPrice }) => `${listing.address} — ${money(previousPrice)} → ${money(listing.price)} — ${SITE.url}/properties/${listing.slug}`).join("\n")}`);
  }
  if (args.changes.backOnMarket.length) {
    sections.push(`BACK ON MARKET\n${args.changes.backOnMarket.slice(0, 8).map(listingLine).join("\n")}`);
  }
  if (!sections.length) return { configured: true, delivered: false };

  const unsubscribeUrl = `${SITE.url}/api/saved-search/unsubscribe?token=${encodeURIComponent(args.unsubscribeToken)}`;
  const body = [
    `Florida Southeast Realty ${args.frequency} saved-search update`,
    "",
    ...sections,
    "",
    "Listings can change quickly. Verify availability, property details, taxes, association fees, insurance, and other costs before making a decision.",
    "",
    `Search current South Florida homes: ${SITE.url}/properties`,
    `Stop these alerts: ${unsubscribeUrl}`,
  ].join("\n");
  const idempotencyKey = createHash("sha256")
    .update(`${args.searchId}:${body}`)
    .digest("hex");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `fsr-saved-search-${idempotencyKey}`,
      },
      body: JSON.stringify({
        from,
        to: [args.email],
        subject: args.changes.newMatches.length
          ? "New South Florida homes match your saved search"
          : "Your South Florida saved-search update",
        text: body,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return { configured: true, delivered: response.ok };
  } catch {
    return { configured: true, delivered: false };
  }
}
