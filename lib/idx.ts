import "server-only";

import { SITE } from "./site-config";
import type {
  IdxAttribution,
  IdxLogo,
  Listing,
  ListingFilters,
  ListingSearchPage,
  ListingStatus,
  PropertyType,
} from "./types";

const DEFAULT_SPARK_API_BASE = "https://sparkapi.com/v1";
const LISTING_PAGE_SIZE = 24;
const REQUEST_TIMEOUT_MS = 10_000;

type JsonObject = Record<string, unknown>;

interface SparkPagination {
  TotalRows?: number;
  PageSize?: number;
  TotalPages?: number;
  CurrentPage?: number;
}

interface SparkPayload {
  Success?: boolean;
  Results?: unknown[];
  Pagination?: SparkPagination;
}

interface SparkSystemInfo {
  mlsId?: string;
  mlsName?: string;
  disclaimer?: string;
  summaryFields: string[];
  detailFields: string[];
}

interface SparkFieldChoice {
  value: string;
  name: string;
}

interface SparkFieldDefinition {
  label: string;
  searchable: boolean;
  type: string;
  choices: SparkFieldChoice[];
}

type SparkFieldMetadata = Record<string, SparkFieldDefinition>;

export interface IdxConnectionState {
  configured: boolean;
  connected: boolean;
  idxRoleVerified: boolean | null;
  provider: "spark";
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
  const raw = process.env.SPARK_ACCESS_TOKEN ?? process.env.IDX_PROVIDER_API_KEY;
  const token = raw?.trim().replace(/^(?:Bearer|OAuth)\s+/i, "");
  return token || null;
}

function normalizeApiBase(value: string): string {
  const url = new URL(value);

  if (url.protocol !== "https:") throw new Error("Spark API base URL must use HTTPS.");
  if (
    process.env.NODE_ENV === "production" &&
    !["sparkapi.com", "replication.sparkapi.com"].includes(url.hostname)
  ) {
    throw new Error("Production Spark requests must use an official Spark API host.");
  }

  return url.toString().replace(/\/$/, "");
}

function getApiBases(): string[] {
  const configured = process.env.SPARK_API_BASE_URL ?? process.env.IDX_PROVIDER_BASE_URL;
  const primary = normalizeApiBase(configured?.trim() || DEFAULT_SPARK_API_BASE);
  const primaryUrl = new URL(primary);
  const alternateHost =
    primaryUrl.hostname === "sparkapi.com"
      ? "replication.sparkapi.com"
      : primaryUrl.hostname === "replication.sparkapi.com"
        ? "sparkapi.com"
        : null;

  if (!alternateHost) return [primary];

  const alternateUrl = new URL(primary);
  alternateUrl.hostname = alternateHost;
  return [primary, alternateUrl.toString().replace(/\/$/, "")];
}

export const IDX_PROVIDER = getAccessToken() ? ("spark" as const) : ("not_connected" as const);

async function sparkRequest(
  path: string,
  query: Record<string, string | number> = {},
  revalidate = 300,
): Promise<SparkPayload> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error("Spark access token is not configured.");

  const bases = getApiBases();
  const failures: Array<Record<string, string | number>> = [];

  for (const [index, base] of bases.entries()) {
    const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "FloridaSoutheastRealty/1.0",
        },
        next: { revalidate, tags: ["spark-idx"] },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      failures.push({ host: url.hostname, status: "network_error" });
      if (index < bases.length - 1) continue;
      console.error("[Spark IDX] API request failed.", { path, failures });
      throw new Error("Spark API request failed.");
    }

    if (!response.ok) {
      let code = "";
      let message = "";
      try {
        const envelope = asObject(await response.json());
        const failure = asObject(envelope.D);
        code = firstString(failure, ["Code", "code"]);
        message = firstString(failure, ["Message", "message", "error_description"]);
      } catch {
        // The HTTP status remains sufficient for safe diagnostics.
      }

      failures.push({
        host: url.hostname,
        status: response.status,
        ...(code ? { code } : {}),
        ...(message ? { message } : {}),
      });

      if (index < bases.length - 1 && [400, 401, 403, 404].includes(response.status)) continue;

      console.error("[Spark IDX] API request failed.", { path, failures });
      throw new Error(`Spark API request failed with status ${response.status}.`);
    }

    const envelope = asObject(await response.json());
    const payload = asObject(envelope.D) as SparkPayload;
    if (payload.Success === false) {
      failures.push({ host: url.hostname, status: "rejected" });
      if (index < bases.length - 1) continue;
      console.error("[Spark IDX] API request rejected.", { path, failures });
      throw new Error("Spark API rejected the request.");
    }

    if (index > 0) {
      console.info("[Spark IDX] Connected using alternate official endpoint.", {
        host: url.hostname,
      });
    }
    return payload;
  }

  console.error("[Spark IDX] API request failed.", { path, failures });
  throw new Error("Spark API request failed.");
}

function stringList(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function getSparkSystemInfo(): Promise<SparkSystemInfo | null> {
  if (!getAccessToken()) return null;

  const payload = await sparkRequest("/system", {}, 60 * 60);
  const result = asObject(payload.Results?.[0]);
  const complianceByMls = asObject(result.DisplayCompliance);
  const mlsId = firstString(result, ["MlsId"]) || Object.keys(complianceByMls)[0];
  const compliance = asObject(mlsId ? complianceByMls[mlsId] : undefined);
  const views = asObject(compliance.View);
  const summary = asObject(views.Summary);
  const detail = asObject(views.Detail);
  const configuration = asObject(asArray(result.Configuration)[0]);

  return {
    mlsId: mlsId || undefined,
    mlsName: firstString(result, ["Mls"]) || undefined,
    disclaimer:
      firstString(compliance, ["DisclaimerTextOnly", "DisclaimerText"]) ||
      firstString(configuration, ["IdxDisclaimerTextOnly", "IdxDisclaimer"]) ||
      process.env.IDX_MLS_DISCLAIMER_TEXT?.trim() ||
      undefined,
    summaryFields: stringList(summary.DisplayCompliance),
    detailFields: stringList(detail.DisplayCompliance),
  };
}

async function getSparkFieldMetadata(): Promise<SparkFieldMetadata> {
  try {
    const payload = await sparkRequest("/standardfields", {}, 6 * 60 * 60);
    const fields = asObject(payload.Results?.[0]);
    const metadata: SparkFieldMetadata = {};

    for (const [field, value] of Object.entries(fields)) {
      const definition = asObject(value);
      metadata[field] = {
        label: firstString(definition, ["Label"]) || humanizeFieldName(field),
        searchable: definition.Searchable !== false,
        type: firstString(definition, ["Type"]),
        choices: asArray(definition.FieldList)
          .map(asObject)
          .map((choice) => ({
            value: firstString(choice, ["Value"]),
            name: firstString(choice, ["Name"]),
          }))
          .filter((choice) => choice.value && choice.name),
      };
    }

    return metadata;
  } catch {
    return {};
  }
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

function normalizeUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.replace(/^http:\/\//i, "https://"));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function photoUrls(record: JsonObject, standardFields: JsonObject): string[] {
  const source = asArray(standardFields.Photos).length
    ? asArray(standardFields.Photos)
    : asArray(record.Photos);

  return source
    .map(asObject)
    .sort((left, right) => Number(truthy(right.Primary)) - Number(truthy(left.Primary)))
    .map((photo) =>
      normalizeUrl(
        firstString(photo, [
          "Uri1600",
          "Uri1280",
          "Uri1024",
          "UriLarge",
          "Uri800",
          "Uri640",
          "Uri300",
          "UriThumb",
        ]),
      ),
    )
    .filter((url): url is string => Boolean(url))
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .slice(0, 24);
}

function choiceName(metadata: SparkFieldMetadata, field: string, value: string): string {
  return metadata[field]?.choices.find((choice) => choice.value === value)?.name || value;
}

function normalizeStatus(value: string, metadata: SparkFieldMetadata): ListingStatus {
  const status = choiceName(metadata, "MlsStatus", value).toLowerCase();
  if (status.includes("coming")) return "Coming Soon";
  if (status.includes("pending") || status.includes("contingent")) return "Pending";
  if (status.includes("sold") || status.includes("closed")) return "Sold";
  return "Active";
}

function normalizePropertyType(subType: string, broadType: string, metadata: SparkFieldMetadata): PropertyType {
  const resolvedSubType = choiceName(metadata, "PropertySubType", subType);
  const resolvedBroadType = choiceName(metadata, "PropertyType", broadType);
  const type = `${resolvedSubType} ${resolvedBroadType}`.toLowerCase();
  if (type.includes("condo")) return "Condo";
  if (type.includes("town")) return "Townhome";
  if (type.includes("multi") || type.includes("duplex") || type.includes("triplex")) return "Multi-Family";
  if (type.includes("land") || type.includes("lot")) return "Land";
  if (type.includes("commercial") || type.includes("business")) return "Commercial";
  if (type.includes("estate")) return "Estate";
  if (type.includes("single") || type.includes("residence") || type.includes("house")) return "Single Family";
  return "Other";
}

function isWaterfront(standardFields: JsonObject, metadata: SparkFieldMetadata): boolean {
  if (truthy(standardFields.WaterfrontYN)) return true;

  return Object.keys(metadata)
    .filter((field) => field.toLowerCase().includes("waterfront"))
    .some((field) => {
      const value = standardFields[field];
      if (value === null || value === undefined || value === false) return false;
      if (typeof value === "string") {
        const label = choiceName(metadata, field, value).toLowerCase();
        return !["", "no", "none", "n", "false", "0"].includes(label);
      }
      return truthy(value) || flattenStrings(value).length > 0;
    });
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

function listingFeatures(standardFields: JsonObject, propertyType: PropertyType, waterfront: boolean): string[] {
  const values = [
    propertyType,
    ...(waterfront ? ["Waterfront"] : []),
    ...flattenStrings(standardFields.InteriorFeatures),
    ...flattenStrings(standardFields.ExteriorFeatures),
    ...flattenStrings(standardFields.CommunityFeatures),
    ...flattenStrings(standardFields.PoolFeatures),
    ...flattenStrings(standardFields.Appliances),
  ];

  return values.filter((value, index) => value && values.indexOf(value) === index).slice(0, 12);
}

function formatComplianceValue(value: unknown): string {
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

function humanizeFieldName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\bMls\b/g, "MLS")
    .replace(/\bIdx\b/g, "IDX");
}

function listingLogo(displayCompliance: JsonObject, view: "Summary" | "Detail"): IdxLogo | undefined {
  const logoObject = asObject(
    view === "Detail"
      ? displayCompliance.IDXLogo ?? displayCompliance.IDXLogoSmall
      : displayCompliance.IDXLogoSmall ?? displayCompliance.IDXLogo,
  );
  const value = firstString(logoObject, ["LogoUri"]);
  const rawType = firstString(logoObject, ["Type"]);
  if (!value || !rawType) return undefined;

  if (rawType.toLowerCase() === "uri") {
    const uri = normalizeUrl(value);
    return uri ? { type: "Uri", value: uri } : undefined;
  }
  return { type: "Text", value };
}

function hasIdxDisplayCompliance(value: unknown): boolean {
  const display = asObject(asObject(value).DisplayCompliance);
  return Boolean(firstString(display, ["View"]) && (display.IDXLogo || display.IDXLogoSmall));
}

function createAttribution(
  standardFields: JsonObject,
  displayCompliance: JsonObject,
  system: SparkSystemInfo | null,
  metadata: SparkFieldMetadata,
  expectedView: "Summary" | "Detail",
): IdxAttribution {
  const rawView = firstString(displayCompliance, ["View"]);
  const view = rawView.toLowerCase() === "detail" ? "Detail" : rawView.toLowerCase() === "summary" ? "Summary" : expectedView;
  const required = view === "Detail" ? system?.detailFields ?? [] : system?.summaryFields ?? [];

  return {
    provider: "Spark",
    mlsId: system?.mlsId,
    mlsName: system?.mlsName,
    view,
    disclaimer: system?.disclaimer,
    logo: listingLogo(displayCompliance, view),
    requiredFields: required.map((field) => ({
      label: metadata[field]?.label || humanizeFieldName(field),
      value: formatComplianceValue(
        typeof standardFields[field] === "string"
          ? choiceName(metadata, field, standardFields[field])
          : standardFields[field],
      ),
    })),
  };
}

function normalizeListing(
  value: unknown,
  system: SparkSystemInfo | null,
  metadata: SparkFieldMetadata,
  expectedView: "Summary" | "Detail",
): Listing | null {
  const record = asObject(value);
  const standardFields = asObject(record.StandardFields);
  const listingKey = firstString(record, ["Id"]) || firstString(standardFields, ["ListingKey"]);
  if (!listingKey) return null;

  const city = firstString(standardFields, ["City"]) || "South Florida";
  const zip = firstString(standardFields, ["PostalCode", "ZipCode"]);
  const address = firstString(standardFields, ["UnparsedAddress", "StreetAddress"]) || [
    firstString(standardFields, ["StreetNumber"]),
    firstString(standardFields, ["StreetDirPrefix"]),
    firstString(standardFields, ["StreetName"]),
    firstString(standardFields, ["StreetSuffix"]),
    firstString(standardFields, ["StreetDirSuffix"]),
    firstString(standardFields, ["StreetAdditionalInfo"]),
    firstString(standardFields, ["UnitNumber"]),
  ].filter(Boolean).join(" ") || `MLS listing ${firstString(standardFields, ["ListingId"]) || listingKey}`;
  const community = firstString(standardFields, ["SubdivisionName", "Neighborhood"]) || city;
  const rawPropertySubType = firstString(standardFields, ["PropertySubType"]);
  const rawPropertyType = firstString(standardFields, ["PropertyType"]);
  const propertyType = normalizePropertyType(rawPropertySubType, rawPropertyType, metadata);
  const waterfront = isWaterfront(standardFields, metadata) || flattenStrings(standardFields.WaterfrontFeatures).length > 0;
  const photos = photoUrls(record, standardFields);
  const listingUpdatedAt = firstString(standardFields, [
    "ListingUpdateTimestamp",
    "ModificationTimestamp",
    "MajorChangeTimestamp",
  ]);
  const fullBaths = firstNumber(standardFields, ["BathroomsFull", "BathsFull"]);
  const halfBaths = firstNumber(standardFields, ["BathroomsHalf", "BathsHalf"]);
  const totalBaths = firstNumber(standardFields, ["BathroomsTotalInteger", "BathroomsTotal", "BathsTotal"]);

  return {
    mlsId: firstString(standardFields, ["ListingId"]) || listingKey,
    listingKey,
    slug: `${slugify(address)}--${listingKey}`,
    status: normalizeStatus(firstString(standardFields, ["MlsStatus", "StandardStatus"]), metadata),
    price: firstNumber(standardFields, ["ListPrice", "CurrentPrice", "OriginalListPrice"]),
    address,
    community,
    communitySlug: slugify(community),
    city,
    zip,
    beds: firstNumber(standardFields, ["BedroomsTotal", "BedsTotal"]),
    baths: totalBaths || fullBaths,
    halfBaths: halfBaths || undefined,
    sqft: firstNumber(standardFields, ["LivingArea", "BuildingAreaTotal", "SquareFeet"]),
    lotSqft: firstNumber(standardFields, ["LotSizeSquareFeet", "LotSqFt"]) || undefined,
    yearBuilt: firstNumber(standardFields, ["YearBuilt"]),
    waterfront,
    propertyType,
    images: photos.length ? photos : ["/property-placeholder.svg"],
    description: firstString(standardFields, ["PublicRemarks", "Remarks"]) || "Contact Florida Southeast Realty for current property details.",
    features: listingFeatures(standardFields, propertyType, waterfront),
    lat: firstNumber(standardFields, ["Latitude", "Lat"]),
    lng: firstNumber(standardFields, ["Longitude", "Lng", "Lon"]),
    mileMarker: 0,
    daysOnMarket: firstNumber(standardFields, ["DaysOnMarket", "CumulativeDaysOnMarket"]),
    listingUpdatedAt: listingUpdatedAt || undefined,
    idx: createAttribution(standardFields, asObject(record.DisplayCompliance), system, metadata, expectedView),
    agent: {
      name: firstString(standardFields, ["ListAgentFullName", "ListAgentName"]) || [
        firstString(standardFields, ["ListAgentFirstName"]),
        firstString(standardFields, ["ListAgentMiddleName"]),
        firstString(standardFields, ["ListAgentLastName"]),
      ].filter(Boolean).join(" ") || SITE.shortName,
      phone: firstString(standardFields, ["ListAgentPreferredPhone", "ListAgentDirectPhone", "ListAgentCellPhone", "ListAgentOfficePhone", "ListAgentPhone"]) || SITE.phoneDisplay,
      email: firstString(standardFields, ["ListAgentEmail"]) || SITE.email,
    },
  };
}

function escapeSparkString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/([*?])/g, "\\$1");
}

function wildcard(value: string): string {
  return `'*${escapeSparkString(value.trim().slice(0, 100))}*'`;
}

function sparkValue(value: string): string {
  return `'${escapeSparkString(value)}'`;
}

function communityName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function searchableFields(metadata: SparkFieldMetadata, candidates: string[]): string[] {
  if (Object.keys(metadata).length === 0) return candidates;
  return candidates.filter((field) => metadata[field]?.searchable);
}

function matchingChoices(metadata: SparkFieldMetadata, field: string, terms: string[]): SparkFieldChoice[] {
  return (metadata[field]?.choices ?? []).filter((choice) => {
    const name = choice.name.toLowerCase();
    return terms.some((term) => name.includes(term));
  });
}

function buildSparkFilter(filters: ListingFilters, metadata: SparkFieldMetadata): string {
  const activeStatuses = (metadata.MlsStatus?.choices ?? []).filter((choice) => {
    const name = choice.name.toLowerCase();
    return name === "active" || name.startsWith("active ") || name.includes("coming soon");
  });
  const activeFilter = activeStatuses.length
    ? `(${activeStatuses.map((status) => `MlsStatus Eq ${sparkValue(status.value)}`).join(" Or ")})`
    : "MlsStatus Eq 'Active'";
  const conditions = [activeFilter];

  if (filters.q?.trim()) {
    const value = wildcard(filters.q);
    const fields = searchableFields(metadata, ["City", "PostalCode", "SubdivisionName", "UnparsedAddress", "StreetName", "ListingId"]);
    if (fields.length) conditions.push(`(${fields.map((field) => `${field} Eq ${value}`).join(" Or ")})`);
  }
  if (Number.isFinite(filters.minPrice) && Number(filters.minPrice) > 0) conditions.push(`ListPrice Ge ${Number(filters.minPrice)}`);
  if (Number.isFinite(filters.maxPrice) && Number(filters.maxPrice) > 0) conditions.push(`ListPrice Le ${Number(filters.maxPrice)}`);
  if (Number.isFinite(filters.beds) && Number(filters.beds) > 0) conditions.push(`BedsTotal Ge ${Number(filters.beds)}`);

  if (filters.waterfrontOnly) {
    const waterfrontField = Object.keys(metadata).length
      ? searchableFields(metadata, ["WaterfrontYN", "Waterfront"])[0]
      : undefined;
    if (waterfrontField) conditions.push(`${waterfrontField} Eq true`);
  }

  if (filters.propertyType) {
    const terms: Partial<Record<PropertyType, string[]>> = {
      "Single Family": ["single family", "single-family", "residence"],
      Condo: ["condo"],
      Townhome: ["townhome", "townhouse"],
      Estate: ["estate"],
      "Multi-Family": ["multi", "duplex", "triplex"],
      Land: ["land", "lot"],
      Commercial: ["commercial", "business"],
    };
    const selectedTerms = terms[filters.propertyType] ?? [];
    const subtypeChoices = matchingChoices(metadata, "PropertySubType", selectedTerms);
    const broadChoices = matchingChoices(metadata, "PropertyType", selectedTerms);
    const choices = [
      ...subtypeChoices.map((choice) => `PropertySubType Eq ${sparkValue(choice.value)}`),
      ...broadChoices.map((choice) => `PropertyType Eq ${sparkValue(choice.value)}`),
    ];
    if (choices.length) conditions.push(`(${choices.join(" Or ")})`);
  }

  if (filters.community) {
    const value = wildcard(communityName(filters.community));
    const fields = searchableFields(metadata, ["City", "SubdivisionName"]);
    if (fields.length) conditions.push(`(${fields.map((field) => `${field} Eq ${value}`).join(" Or ")})`);
  }

  return conditions.join(" And ");
}

export async function fetchLiveListingPage(filters: ListingFilters = {}, page = 1): Promise<ListingSearchPage | null> {
  if (!getAccessToken()) return null;

  const currentPage = Math.max(1, Math.floor(page) || 1);
  const metadata = await getSparkFieldMetadata();
  const [system, payload] = await Promise.all([
    getSparkSystemInfo(),
    sparkRequest("/listings", {
      _expand: "Photos",
      _filter: buildSparkFilter(filters, metadata),
      _limit: LISTING_PAGE_SIZE,
      _orderby: "-ListPrice",
      _page: currentPage,
      _pagination: 1,
    }),
  ]);
  if (payload.Results?.length && !payload.Results.every(hasIdxDisplayCompliance)) {
    throw new Error("Spark credential is not authorized for IDX display.");
  }
  const listings = (payload.Results ?? [])
    .map((record) => normalizeListing(record, system, metadata, "Summary"))
    .filter((listing): listing is Listing => Boolean(listing))
    .filter((listing) => !filters.propertyType || listing.propertyType === filters.propertyType)
    .filter((listing) => !filters.waterfrontOnly || listing.waterfront);
  const pagination = payload.Pagination ?? {};

  return {
    listings,
    live: true,
    unavailable: false,
    pagination: {
      page: pagination.CurrentPage ?? currentPage,
      pageSize: pagination.PageSize ?? LISTING_PAGE_SIZE,
      totalPages: Math.max(1, pagination.TotalPages ?? 1),
      totalRows: pagination.TotalRows ?? listings.length,
    },
  };
}

export async function fetchLiveListings(): Promise<Listing[] | null> {
  return (await fetchLiveListingPage())?.listings ?? null;
}

export async function fetchLiveListingBySlug(slug: string): Promise<Listing | null> {
  if (!getAccessToken()) return null;
  const listingKey = slug.includes("--") ? slug.split("--").at(-1) : null;
  if (!listingKey || !/^[A-Za-z0-9_-]{6,160}$/.test(listingKey)) return null;

  const [system, metadata, payload] = await Promise.all([
    getSparkSystemInfo(),
    getSparkFieldMetadata(),
    sparkRequest(`/listings/${encodeURIComponent(listingKey)}`, { _expand: "Photos" }),
  ]);
  if (payload.Results?.length && !payload.Results.every(hasIdxDisplayCompliance)) {
    throw new Error("Spark credential is not authorized for IDX display.");
  }
  return normalizeListing(payload.Results?.[0], system, metadata, "Detail");
}

export async function getIdxDisclosure(): Promise<Pick<SparkSystemInfo, "mlsId" | "mlsName" | "disclaimer"> | null> {
  try {
    const system = await getSparkSystemInfo();
    if (!system) return null;
    return { mlsId: system.mlsId, mlsName: system.mlsName, disclaimer: system.disclaimer };
  } catch {
    return null;
  }
}

export async function checkIdxConnection(): Promise<IdxConnectionState> {
  if (!getAccessToken()) {
    return {
      configured: false,
      connected: false,
      idxRoleVerified: null,
      provider: "spark",
      error: "not_configured",
    };
  }

  try {
    const [system, payload] = await Promise.all([
      getSparkSystemInfo(),
      sparkRequest("/listings", { _limit: 1, _pagination: 0 }, 60),
    ]);
    const displayCompliance = asObject(asObject(payload.Results?.[0]).DisplayCompliance);
    const hasListing = Boolean(payload.Results?.length);
    const idxRoleVerified = hasListing
      ? Boolean(firstString(displayCompliance, ["View"]) && (displayCompliance.IDXLogo || displayCompliance.IDXLogoSmall))
      : null;

    return {
      configured: true,
      connected: true,
      idxRoleVerified,
      provider: "spark",
      mlsId: system?.mlsId,
      mlsName: system?.mlsName,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      idxRoleVerified: null,
      provider: "spark",
      error: "connection_failed",
    };
  }
}
