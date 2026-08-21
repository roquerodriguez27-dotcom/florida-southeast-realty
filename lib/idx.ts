import "server-only";

import { SITE } from "./site-config";
import type {
  IdxAttribution,
  Listing,
  ListingFilters,
  ListingSearchPage,
  ListingSort,
  ListingStatus,
  PropertyType,
} from "./types";

const DEFAULT_RESO_API_BASE = "https://replication.sparkapi.com/Version/3/Reso/OData";
const DEFAULT_MLS_NAME = "BeachesMLS";
const DEFAULT_ORIGINATING_SYSTEM_ID = "M00000170";
const DEFAULT_MLS_DISCLAIMER =
  "© 2026 Beaches MLS. All Rights Reserved. This information is for your personal, non-commercial use and may not be used for any purpose other than to identify prospective properties you may be interested in purchasing. Display of MLS data is usually deemed reliable but is NOT guaranteed accurate by the MLS. Buyers are responsible for verifying the accuracy of all information and should investigate the data themselves or retain appropriate professionals. Information from sources other than the Listing Agent may have been included in the MLS data. Unless otherwise specified in writing, Broker/Agent has not and will not verify any information obtained from other sources. The Broker/Agent providing the information contained herein may or may not have been the Listing and/or Selling Agent.";
const LISTING_PAGE_SIZE = 24;
const REQUEST_TIMEOUT_MS = 10_000;
const RESO_MAX_ATTEMPTS = 3;
const RETRYABLE_RESO_STATUSES = new Set([429, 502, 503, 504]);

const RESO_SORTS: Record<ListingSort, string> = {
  newest: "ModificationTimestamp desc,ListPrice asc",
  "price-asc": "ListPrice asc,ModificationTimestamp desc",
  "price-desc": "ListPrice desc,ModificationTimestamp desc",
  "sqft-desc": "LivingArea desc,ListPrice asc",
};

type JsonObject = Record<string, unknown>;

interface ResoPayload {
  value: unknown[];
  count?: number;
  nextLink?: string;
}

interface ResoSystemInfo {
  mlsId?: string;
  mlsName: string;
  disclaimer: string;
}

export interface IdxConnectionState {
  configured: boolean;
  connected: boolean;
  idxRoleVerified: boolean | null;
  provider: "reso";
  mlsId?: string;
  mlsName?: string;
  error?: "not_configured" | "connection_failed";
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(object: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstNumber(object: JsonObject, keys: string[]): number {
  for (const key of keys) {
    const value = object[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "yes", "y", "1"].includes(value.toLowerCase());
  return Array.isArray(value) && value.length > 0;
}

function getAccessToken(): string | null {
  const raw =
    process.env.RESO_ACCESS_TOKEN ??
    process.env.SPARK_ACCESS_TOKEN ??
    process.env.IDX_PROVIDER_API_KEY;
  const token = raw?.trim().replace(/^(?:Bearer|OAuth)\s+/i, "");
  return token || null;
}

function normalizeApiBase(value: string): string {
  const url = new URL(value);

  if (url.protocol !== "https:") throw new Error("RESO Web API base URL must use HTTPS.");
  if (process.env.NODE_ENV === "production" && url.hostname !== "replication.sparkapi.com") {
    throw new Error("Production RESO requests must use the official FBS replication host.");
  }
  if (!/\/Reso\/OData\/?$/i.test(url.pathname)) {
    throw new Error("RESO Web API base URL must end in /Reso/OData.");
  }

  return url.toString().replace(/\/$/, "");
}

function getApiBase(): string {
  // Ignore the previous Spark REST base (https://sparkapi.com/v1). Existing Vercel
  // environments may still contain it while the approved feed uses only RESO/OData.
  const configured = [
    process.env.RESO_API_BASE_URL,
    process.env.IDX_PROVIDER_BASE_URL,
    process.env.SPARK_API_BASE_URL,
  ].find((value) => value && /\/Reso\/OData\/?$/i.test(value.trim()));

  return normalizeApiBase(configured?.trim() || DEFAULT_RESO_API_BASE);
}

function getOriginatingSystemId(): string {
  return process.env.IDX_ORIGINATING_SYSTEM_ID?.trim() || DEFAULT_ORIGINATING_SYSTEM_ID;
}

export const IDX_PROVIDER = getAccessToken() ? ("reso" as const) : ("not_connected" as const);

function retryDelayMilliseconds(attempt: number, retryAfter: string | null): number {
  const fallback = 300 * (2 ** attempt);
  if (!retryAfter) return fallback;

  const seconds = Number(retryAfter);
  const headerDelay = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(retryAfter) - Date.now();
  if (!Number.isFinite(headerDelay) || headerDelay <= 0) return fallback;
  return Math.min(1_500, Math.max(fallback, headerDelay));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function resoRequest(
  path: string,
  query: Record<string, string | number | boolean> = {},
  revalidate = 300,
  reportFailures = true,
): Promise<ResoPayload> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error("RESO access token is not configured.");

  const url = new URL(`${getApiBase()}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));

  let lastFailure: { status: number | "network_error" | "invalid_payload"; code?: string; message?: string } = {
    status: "network_error",
  };

  for (let attempt = 0; attempt < RESO_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "FloridaSoutheastRealty/1.0",
        },
        next: { revalidate, tags: ["beaches-mls-reso"] },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      lastFailure = { status: "network_error" };
      if (attempt < RESO_MAX_ATTEMPTS - 1) {
        await wait(retryDelayMilliseconds(attempt, null));
        continue;
      }
      break;
    }

    if (response.ok) {
      try {
        const envelope = asObject(await response.json());
        const rawCount = envelope["@odata.count"];
        const parsedCount =
          typeof rawCount === "number"
            ? rawCount
            : typeof rawCount === "string" && Number.isFinite(Number(rawCount))
              ? Number(rawCount)
              : undefined;

        // OData collection requests use `value`; an individual Property request
        // returns the entity directly, so normalize both response shapes here.
        const value = Array.isArray(envelope.value)
          ? envelope.value
          : firstString(envelope, ["ListingKey", "ListingId"])
            ? [envelope]
            : [];

        return {
          value,
          count: parsedCount,
          nextLink: firstString(envelope, ["@odata.nextLink"]) || undefined,
        };
      } catch {
        lastFailure = { status: "invalid_payload" };
        if (attempt < RESO_MAX_ATTEMPTS - 1) {
          await wait(retryDelayMilliseconds(attempt, null));
          continue;
        }
        break;
      }
    }

    let code = "";
    let message = "";
    try {
      const envelope = asObject(await response.json());
      const failure = asObject(envelope.error);
      code = firstString(failure, ["code", "Code"]);
      message = firstString(failure, ["message", "Message"]);
      if (!message) message = firstString(asObject(failure.message), ["value"]);
    } catch {
      // The HTTP status remains sufficient for safe diagnostics.
    }
    lastFailure = {
      status: response.status,
      ...(code ? { code } : {}),
      ...(message ? { message: message.slice(0, 240) } : {}),
    };

    if (RETRYABLE_RESO_STATUSES.has(response.status) && attempt < RESO_MAX_ATTEMPTS - 1) {
      await wait(retryDelayMilliseconds(attempt, response.headers.get("retry-after")));
      continue;
    }
    break;
  }

  if (reportFailures) {
    console.error("[BeachesMLS RESO] API request failed after bounded retries.", {
      resource: path.split("?")[0],
      ...lastFailure,
    });
  }
  throw new Error(
    typeof lastFailure.status === "number"
      ? `RESO Web API request failed with status ${lastFailure.status}.`
      : "RESO Web API request failed.",
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "south-florida-home";
}

function encodeListingKey(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeListingKey(slug: string): string | null {
  const encoded = slug.includes("--") ? slug.split("--").at(-1) : null;
  if (!encoded || !/^[A-Za-z0-9_-]{4,300}$/.test(encoded)) return null;

  try {
    const value = Buffer.from(encoded, "base64url").toString("utf8");
    if (!value || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function normalizeUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.replace(/^http:\/\//i, "https://"));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function photoUrls(record: JsonObject): string[] {
  const media = asArray(record.Media).length ? asArray(record.Media) : asArray(record.Photos);

  return media
    .map(asObject)
    .filter((item) => {
      const category = firstString(item, ["MediaCategory", "Category", "MediaType"]).toLowerCase();
      const mimeType = firstString(item, ["MimeType", "MediaType"]).toLowerCase();
      return !category || category.includes("photo") || category.includes("image") || mimeType.startsWith("image/");
    })
    .sort((left, right) => {
      const preferred = Number(truthy(right.PreferredPhotoYN ?? right.Primary)) - Number(truthy(left.PreferredPhotoYN ?? left.Primary));
      if (preferred !== 0) return preferred;
      return firstNumber(left, ["Order", "MediaOrder"]) - firstNumber(right, ["Order", "MediaOrder"]);
    })
    .map((item) =>
      normalizeUrl(
        firstString(item, [
          "MediaURL",
          "MediaUrl",
          "Uri1600",
          "Uri1280",
          "Uri1024",
          "UriLarge",
          "Uri800",
          "Uri640",
          "Uri300",
          "UriThumb",
          "URL",
          "Uri",
        ]),
      ),
    )
    .filter((url): url is string => Boolean(url))
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .slice(0, 24);
}

function normalizeStatus(value: string): ListingStatus {
  const status = value.toLowerCase();
  if (status.includes("coming")) return "Coming Soon";
  if (status.includes("pending") || status.includes("contingent") || status.includes("under contract")) return "Pending";
  if (status.includes("sold") || status.includes("closed")) return "Sold";
  return "Active";
}

function normalizePropertyType(subType: string, broadType: string): PropertyType {
  const type = `${subType} ${broadType}`.toLowerCase();
  if (type.includes("condo")) return "Condo";
  if (type.includes("town")) return "Townhome";
  if (type.includes("multi") || type.includes("duplex") || type.includes("triplex")) return "Multi-Family";
  if (type.includes("land") || type.includes("lot")) return "Land";
  if (type.includes("commercial") || type.includes("business")) return "Commercial";
  if (type.includes("estate")) return "Estate";
  if (type.includes("single") || type.includes("residence") || type.includes("house")) return "Single Family";
  return "Other";
}

function flattenStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string" && value.trim()) output.push(value.trim());
  else if (Array.isArray(value)) value.forEach((item) => flattenStrings(item, output));
  else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as JsonObject)) {
      if (nested === true) output.push(key);
      else flattenStrings(nested, output);
    }
  }
  return output;
}

function isWaterfront(record: JsonObject): boolean {
  if (truthy(record.WaterfrontYN)) return true;
  const features = flattenStrings(record.WaterfrontFeatures).join(" ").toLowerCase();
  return Boolean(features && !["no", "none", "false"].includes(features));
}

function hasPrivatePool(record: JsonObject): boolean {
  return truthy(record.PoolPrivateYN);
}

function listingFeatures(
  record: JsonObject,
  propertyType: PropertyType,
  waterfront: boolean,
  privatePool: boolean,
  garageSpaces: number,
  newConstruction: boolean,
  seniorCommunity: boolean,
  fireplace: boolean,
): string[] {
  const values = [
    propertyType,
    ...(waterfront ? ["Waterfront"] : []),
    ...(privatePool ? ["Private pool"] : []),
    ...(garageSpaces > 0 ? [`${garageSpaces}-car garage`] : []),
    ...(newConstruction ? ["New construction"] : []),
    ...(seniorCommunity ? ["55+ community"] : []),
    ...(fireplace ? ["Fireplace"] : []),
    ...flattenStrings(record.InteriorFeatures),
    ...flattenStrings(record.ExteriorFeatures),
    ...flattenStrings(record.CommunityFeatures),
    ...flattenStrings(record.PoolFeatures),
    ...flattenStrings(record.Appliances),
  ];

  return values.filter((value, index) => value && values.indexOf(value) === index).slice(0, 12);
}

function formatAttributionValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
    }
    return value;
  }
  const flattened = flattenStrings(value);
  return flattened.length ? flattened.join(", ") : "Not provided";
}

function getSystemInfo(record: JsonObject = {}): ResoSystemInfo {
  return {
    mlsId: firstString(record, ["OriginatingSystemID", "OriginatingSystemKey"]) || undefined,
    mlsName:
      firstString(record, ["OriginatingSystemName"]) ||
      process.env.IDX_MLS_NAME?.trim() ||
      DEFAULT_MLS_NAME,
    disclaimer: process.env.IDX_MLS_DISCLAIMER_TEXT?.trim() || DEFAULT_MLS_DISCLAIMER,
  };
}

function createAttribution(record: JsonObject, view: "Summary" | "Detail"): IdxAttribution {
  const system = getSystemInfo(record);
  const courtesy = firstString(record, ["ListOfficeName", "ListAgentFullName"]);
  const fields = [
    { label: "MLS ID", value: firstString(record, ["ListingId", "ListingKey"]) },
    { label: "Listing courtesy of", value: courtesy },
    { label: "Data source", value: system.mlsName },
    {
      label: "Last updated",
      value: formatAttributionValue(
        firstString(record, ["ModificationTimestamp", "ListingUpdateTimestamp", "MajorChangeTimestamp"]),
      ),
    },
  ].filter((field) => field.value && field.value !== "Not provided");

  return {
    provider: "RESO",
    mlsId: system.mlsId,
    mlsName: system.mlsName,
    view,
    disclaimer: system.disclaimer,
    logo: { type: "Text", value: system.mlsName },
    requiredFields: fields,
  };
}

function normalizeListing(value: unknown, expectedView: "Summary" | "Detail"): Listing | null {
  const record = asObject(value);
  const listingKey = firstString(record, ["ListingKey", "ListingId"]);
  if (!listingKey) return null;

  const city = firstString(record, ["City"]) || "South Florida";
  const zip = firstString(record, ["PostalCode", "ZipCode"]);
  const address = firstString(record, ["UnparsedAddress", "StreetAddress"]) || [
    firstString(record, ["StreetNumber"]),
    firstString(record, ["StreetDirPrefix"]),
    firstString(record, ["StreetName"]),
    firstString(record, ["StreetSuffix"]),
    firstString(record, ["StreetDirSuffix"]),
    firstString(record, ["StreetAdditionalInfo"]),
    firstString(record, ["UnitNumber"]),
  ].filter(Boolean).join(" ") || `MLS listing ${firstString(record, ["ListingId"]) || listingKey}`;
  const community = firstString(record, ["SubdivisionName", "Neighborhood"]) || city;
  const propertySubType = firstString(record, ["PropertySubType"]);
  const broadPropertyType = firstString(record, ["PropertyType"]);
  const propertyType = normalizePropertyType(propertySubType, broadPropertyType);
  const forLease = /\b(?:lease|rental)\b/i.test(`${broadPropertyType} ${propertySubType}`);
  const waterfront = isWaterfront(record);
  const privatePool = hasPrivatePool(record);
  const garageSpaces = firstNumber(record, ["GarageSpaces"]);
  const newConstruction = truthy(record.NewConstructionYN);
  const seniorCommunity = truthy(record.SeniorCommunityYN);
  const fireplace = truthy(record.FireplaceYN);
  const photos = photoUrls(record);
  const fullBaths = firstNumber(record, ["BathroomsFull", "BathsFull"]);
  const halfBaths = firstNumber(record, ["BathroomsHalf", "BathsHalf"]);
  const totalBaths = firstNumber(record, ["BathroomsTotalInteger", "BathroomsTotal", "BathsTotal"]);
  const listingUpdatedAt = firstString(record, [
    "ModificationTimestamp",
    "ListingUpdateTimestamp",
    "MajorChangeTimestamp",
  ]);

  return {
    mlsId: firstString(record, ["ListingId"]) || listingKey,
    listingKey,
    slug: `${slugify(address)}--${encodeListingKey(listingKey)}`,
    status: normalizeStatus(firstString(record, ["StandardStatus", "MlsStatus"])),
    price: firstNumber(record, ["ListPrice", "CurrentPrice", "OriginalListPrice"]),
    address,
    community,
    communitySlug: slugify(community),
    city,
    zip,
    beds: firstNumber(record, ["BedroomsTotal", "BedsTotal"]),
    baths: totalBaths || fullBaths,
    halfBaths: halfBaths || undefined,
    sqft: firstNumber(record, ["LivingArea", "BuildingAreaTotal", "SquareFeet"]),
    lotSqft: firstNumber(record, ["LotSizeSquareFeet", "LotSqFt"]) || undefined,
    yearBuilt: firstNumber(record, ["YearBuilt"]),
    waterfront,
    privatePool,
    garageSpaces: garageSpaces || undefined,
    newConstruction,
    seniorCommunity,
    fireplace,
    propertyType,
    forLease,
    images: photos.length ? photos : ["/property-placeholder.svg"],
    description:
      firstString(record, ["PublicRemarks", "Remarks"]) ||
      "Contact Florida Southeast Realty for current property details.",
    features: listingFeatures(
      record,
      propertyType,
      waterfront,
      privatePool,
      garageSpaces,
      newConstruction,
      seniorCommunity,
      fireplace,
    ),
    lat: firstNumber(record, ["Latitude", "Lat"]),
    lng: firstNumber(record, ["Longitude", "Lng", "Lon"]),
    mileMarker: 0,
    daysOnMarket: firstNumber(record, ["DaysOnMarket", "CumulativeDaysOnMarket"]),
    listingUpdatedAt: listingUpdatedAt || undefined,
    idx: createAttribution(record, expectedView),
    agent: {
      name: firstString(record, ["ListAgentFullName", "ListAgentName"]) || [
        firstString(record, ["ListAgentFirstName"]),
        firstString(record, ["ListAgentMiddleName"]),
        firstString(record, ["ListAgentLastName"]),
      ].filter(Boolean).join(" ") || SITE.shortName,
      phone:
        firstString(record, [
          "ListAgentPreferredPhone",
          "ListAgentDirectPhone",
          "ListAgentCellPhone",
          "ListAgentOfficePhone",
          "ListAgentPhone",
        ]) || SITE.phoneDisplay,
      email: firstString(record, ["ListAgentEmail"]) || SITE.email,
    },
  };
}

function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function communityName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function contains(field: string, value: string): string {
  return `contains(${field},${odataString(value)})`;
}

const STREET_SUFFIXES = new Set([
  "avenue", "ave", "boulevard", "blvd", "circle", "cir", "court", "ct",
  "drive", "dr", "highway", "hwy", "lane", "ln", "loop", "parkway", "pkwy",
  "path", "place", "pl", "road", "rd", "street", "st", "terrace", "ter",
  "trail", "trl", "way",
]);
const STREET_DIRECTIONS = new Set([
  "n", "north", "s", "south", "e", "east", "w", "west",
  "ne", "northeast", "nw", "northwest", "se", "southeast", "sw", "southwest",
]);

function streetAddressTokens(value: string): string[] | null {
  const streetPortion = value.split(",", 1)[0]?.trim() ?? "";
  const rawTokens = streetPortion.match(/[A-Za-z0-9]+/g) ?? [];
  const firstToken = rawTokens[0];
  if (rawTokens.length < 2 || !firstToken || !/^\d+[A-Za-z]?$/.test(firstToken)) return null;

  const suffixIndex = rawTokens.findIndex((token, index) =>
    index >= 2 && STREET_SUFFIXES.has(token.toLowerCase()),
  );
  const addressTokens = (suffixIndex >= 2 ? rawTokens.slice(0, suffixIndex) : rawTokens.slice(0, 5))
    .filter((token, index) => index === 0 || !STREET_DIRECTIONS.has(token.toLowerCase()))
    .slice(0, 4);

  return addressTokens.length >= 2 ? addressTokens : null;
}

function locationSearchCondition(value: string): string {
  const addressTokens = streetAddressTokens(value);
  if (addressTokens) {
    return `(${addressTokens.map((token) => contains("UnparsedAddress", token)).join(" and ")})`;
  }

  const fields = ["City", "PostalCode", "SubdivisionName", "UnparsedAddress", "StreetName", "ListingId"];
  return `(${fields.map((field) => contains(field, value)).join(" or ")})`;
}

function areaSearchCondition(value: string): string {
  const fields = ["City", "PostalCode", "SubdivisionName"];
  // Keep the individual area terms ungrouped so the combined multi-area
  // expression stays within FBS RESO's two-level nesting limit.
  return fields.map((field) => contains(field, value)).join(" or ");
}

function pointInPolygon(
  lat: number,
  lng: number,
  polygon: NonNullable<ListingFilters["polygon"]>,
): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) continue;
    const intersects = (currentPoint.lat > lat) !== (previousPoint.lat > lat)
      && lng < (previousPoint.lng - currentPoint.lng) * (lat - currentPoint.lat)
        / (previousPoint.lat - currentPoint.lat) + currentPoint.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function buildResoFilter(filters: ListingFilters): string {
  const conditions = [
    `OriginatingSystemID eq ${odataString(getOriginatingSystemId())}`,
    "(StandardStatus eq 'Active' or StandardStatus eq 'Coming Soon' or StandardStatus eq 'Active Under Contract')",
    "PropertyType ne 'Residential Lease'",
    "PropertyType ne 'Commercial Lease'",
  ];

  if (filters.q?.trim()) {
    const value = filters.q.trim().slice(0, 100);
    conditions.push(locationSearchCondition(value));
  }
  const locations = filters.locations
    ?.map((location) => location.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 20) ?? [];
  if (locations.length > 0) {
    conditions.push(`(${locations.map(areaSearchCondition).join(" or ")})`);
  }
  if (Number.isFinite(filters.minPrice) && Number(filters.minPrice) > 0) {
    conditions.push(`ListPrice ge ${Number(filters.minPrice)}`);
  }
  if (Number.isFinite(filters.maxPrice) && Number(filters.maxPrice) > 0) {
    conditions.push(`ListPrice le ${Number(filters.maxPrice)}`);
  }
  if (Number.isFinite(filters.beds) && Number(filters.beds) > 0) {
    conditions.push(`BedroomsTotal ge ${Number(filters.beds)}`);
  }
  if (Number.isFinite(filters.baths) && Number(filters.baths) > 0) {
    conditions.push(`BathroomsFull ge ${Number(filters.baths)}`);
  }
  if (Number.isFinite(filters.minSqft) && Number(filters.minSqft) > 0) {
    conditions.push(`LivingArea ge ${Number(filters.minSqft)}`);
  }
  if (Number.isFinite(filters.maxSqft) && Number(filters.maxSqft) > 0) {
    conditions.push(`LivingArea le ${Number(filters.maxSqft)}`);
  }
  if (Number.isFinite(filters.minLotSqft) && Number(filters.minLotSqft) > 0) {
    conditions.push(`LotSizeSquareFeet ge ${Number(filters.minLotSqft)}`);
  }
  if (Number.isFinite(filters.minYearBuilt) && Number(filters.minYearBuilt) > 0) {
    conditions.push(`YearBuilt ge ${Number(filters.minYearBuilt)}`);
  }
  if (Number.isFinite(filters.maxDaysOnMarket) && Number(filters.maxDaysOnMarket) > 0) {
    conditions.push(`DaysOnMarket le ${Number(filters.maxDaysOnMarket)}`);
  }
  if (filters.waterfrontOnly) conditions.push("WaterfrontYN eq true");
  if (filters.privatePoolOnly) conditions.push("PoolPrivateYN eq true");
  const minGarageSpaces = Math.max(
    filters.garageOnly ? 1 : 0,
    Number.isFinite(filters.minGarageSpaces) ? Number(filters.minGarageSpaces) : 0,
  );
  if (minGarageSpaces > 0) conditions.push(`GarageSpaces ge ${minGarageSpaces}`);
  if (filters.newConstructionOnly) conditions.push("NewConstructionYN eq true");
  if (filters.fireplaceOnly) conditions.push("FireplaceYN eq true");
  if (filters.seniorCommunityMode === "only") conditions.push("SeniorCommunityYN eq true");
  if (filters.seniorCommunityMode === "exclude") conditions.push("SeniorCommunityYN ne true");

  if (filters.propertyType) {
    const values: Partial<Record<PropertyType, string[]>> = {
      "Single Family": ["Single Family Residence", "Single Family"],
      Condo: ["Condominium", "Condo"],
      Townhome: ["Townhouse", "Townhome"],
      Estate: ["Estate"],
      "Multi-Family": ["Duplex", "Triplex", "Quadruplex", "Multi Family"],
      Land: ["Land", "Unimproved Land"],
      Commercial: ["Commercial", "Business"],
    };
    const selected = values[filters.propertyType] ?? [];
    if (selected.length) {
      conditions.push(`(${selected.map((value) => `PropertySubType eq ${odataString(value)}`).join(" or ")})`);
    }
  }

  if (filters.community) {
    const value = communityName(filters.community).slice(0, 100);
    conditions.push(`(${contains("City", value)} or ${contains("SubdivisionName", value)})`);
  }

  // The provider rejects deeply nested polygon unions. Query the polygon's
  // flat bounding box through RESO, then enforce the exact shape locally.
  const polygonBounds = filters.polygon?.length
    ? {
        north: Math.max(...filters.polygon.map((point) => point.lat)),
        south: Math.min(...filters.polygon.map((point) => point.lat)),
        east: Math.max(...filters.polygon.map((point) => point.lng)),
        west: Math.min(...filters.polygon.map((point) => point.lng)),
      }
    : undefined;
  const requestedBounds = polygonBounds ?? filters.bounds;
  if (requestedBounds) {
    const { north, south, east, west } = requestedBounds;
    if ([north, south, east, west].every(Number.isFinite)) {
      conditions.push(`Latitude ge ${south}`);
      conditions.push(`Latitude le ${north}`);
      conditions.push(`Longitude ge ${west}`);
      conditions.push(`Longitude le ${east}`);
    }
  }

  return conditions.join(" and ");
}

export async function fetchLiveListingPage(
  filters: ListingFilters = {},
  page = 1,
): Promise<ListingSearchPage | null> {
  if (!getAccessToken()) return null;

  const currentPage = Math.max(1, Math.floor(page) || 1);
  // BeachesMLS returns PoolPrivateYN in listing records but its replication
  // endpoint currently ignores that field when it appears in `$filter`.
  // Polygon searches also need local point-in-shape verification. Pull a wider,
  // paginated candidate window for either case, then enforce exact matches here.
  const exactPoolFallback = filters.privatePoolOnly === true;
  const providerFilters = exactPoolFallback ? { ...filters, privatePoolOnly: false } : filters;
  const exactPolygonFallback = Boolean(filters.polygon?.length);
  const widerCandidateWindow = exactPoolFallback || exactPolygonFallback;
  const providerPageSize = widerCandidateWindow ? LISTING_PAGE_SIZE * 3 : LISTING_PAGE_SIZE;
  const payload = await resoRequest("Property", {
    "$filter": buildResoFilter(providerFilters),
    "$expand": "Media($top=24;$orderby=Order)",
    "$top": providerPageSize,
    "$skip": (currentPage - 1) * providerPageSize,
    "$count": true,
    "$orderby": RESO_SORTS[filters.sort ?? "newest"],
  });
  const minGarageSpaces = Math.max(
    filters.garageOnly ? 1 : 0,
    Number.isFinite(filters.minGarageSpaces) ? Number(filters.minGarageSpaces) : 0,
  );
  const listings = payload.value
    .map((record) => normalizeListing(record, "Summary"))
    .filter((listing): listing is Listing => Boolean(listing))
    .filter((listing) => !listing.forLease)
    .filter((listing) => !filters.privatePoolOnly || listing.privatePool)
    .filter((listing) => !filters.baths || listing.baths >= filters.baths)
    .filter((listing) => minGarageSpaces <= 0 || (listing.garageSpaces ?? 0) >= minGarageSpaces)
    .filter((listing) => !filters.newConstructionOnly || listing.newConstruction === true)
    .filter((listing) => !filters.fireplaceOnly || listing.fireplace === true)
    .filter((listing) => filters.seniorCommunityMode !== "only" || listing.seniorCommunity === true)
    .filter((listing) => filters.seniorCommunityMode !== "exclude" || listing.seniorCommunity !== true)
    .filter((listing) => !filters.maxDaysOnMarket || listing.daysOnMarket <= filters.maxDaysOnMarket)
    .filter((listing) => !filters.polygon?.length || pointInPolygon(listing.lat, listing.lng, filters.polygon))
    .slice(0, LISTING_PAGE_SIZE);
  const providerTotalRows = payload.count ?? ((currentPage - 1) * providerPageSize + payload.value.length);
  const locallyVerifiedBoolean = Boolean(
    filters.privatePoolOnly
      || filters.newConstructionOnly
      || filters.fireplaceOnly
      || filters.seniorCommunityMode,
  );
  const totalRowsExact = !exactPolygonFallback && !locallyVerifiedBoolean;
  const totalRows = totalRowsExact ? providerTotalRows : listings.length;
  const hasMoreProviderRows = Boolean(
    payload.nextLink
      || (payload.count !== undefined && currentPage * providerPageSize < providerTotalRows),
  );
  const totalPages = totalRowsExact
    ? payload.count !== undefined
      ? Math.max(1, Math.ceil(providerTotalRows / providerPageSize))
      : hasMoreProviderRows
        ? currentPage + 1
        : currentPage
    : hasMoreProviderRows
      ? currentPage + 1
      : currentPage;

  return {
    listings,
    live: true,
    unavailable: false,
    pagination: {
      page: currentPage,
      pageSize: LISTING_PAGE_SIZE,
      totalPages,
      totalRows,
      totalRowsExact,
    },
  };
}

export async function fetchLiveListings(): Promise<Listing[] | null> {
  return (await fetchLiveListingPage())?.listings ?? null;
}

export async function fetchLiveListingBySlug(slug: string): Promise<Listing | null> {
  if (!getAccessToken()) return null;
  const listingKey = decodeListingKey(slug);
  if (!listingKey) return null;

  const escapedKey = listingKey.replace(/'/g, "''");
  let payload: ResoPayload;
  try {
    payload = await resoRequest(`Property('${escapedKey}')`, {
      "$expand": "Media($top=24;$orderby=Order)",
    }, 300, false);
  } catch {
    // A listing can move between provider partitions while the cached search
    // result is still visible. Retrying through the collection endpoint keeps
    // a valid card from becoming a transient 404.
    payload = await resoRequest("Property", {
      "$filter": `OriginatingSystemID eq ${odataString(getOriginatingSystemId())} and (ListingKey eq ${odataString(listingKey)} or ListingId eq ${odataString(listingKey)})`,
      "$expand": "Media($top=24;$orderby=Order)",
      "$top": 1,
    });
  }
  return normalizeListing(payload.value[0], "Detail");
}

export async function getIdxDisclosure(): Promise<ResoSystemInfo | null> {
  if (!getAccessToken()) return null;
  return getSystemInfo();
}

export async function checkIdxConnection(): Promise<IdxConnectionState> {
  if (!getAccessToken()) {
    return {
      configured: false,
      connected: false,
      idxRoleVerified: null,
      provider: "reso",
      error: "not_configured",
    };
  }

  try {
    const payload = await resoRequest(
      "Property",
      {
        "$top": 1,
        "$filter": `OriginatingSystemID eq ${odataString(getOriginatingSystemId())}`,
        "$select": "ListingKey,ListingId,OriginatingSystemID,OriginatingSystemName,ModificationTimestamp",
      },
      60,
    );
    const record = asObject(payload.value[0]);
    const system = getSystemInfo(record);

    return {
      configured: true,
      connected: true,
      idxRoleVerified: payload.value.length > 0 ? true : null,
      provider: "reso",
      mlsId: system.mlsId,
      mlsName: system.mlsName,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      idxRoleVerified: null,
      provider: "reso",
      error: "connection_failed",
    };
  }
}
