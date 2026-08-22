import { z } from "zod";
import type { PropertyType } from "@/lib/types";
import { MAX_SEARCH_LOCATIONS, SOUTH_FLORIDA_LOCATION_NAMES } from "@/lib/south-florida-locations";

const SEARCH_PROPERTY_TYPES = [
  "Single Family",
  "Condo",
  "Townhome",
  "Estate",
  "Multi-Family",
  "Land",
  "Commercial",
  "Other",
] as const satisfies readonly PropertyType[];

export const propertySearchIntentSchema = z.object({
  locations: z.array(z.string().min(1).max(100)).max(MAX_SEARCH_LOCATIONS)
    .describe("South Florida county names, city names, community names, or five-digit ZIP codes explicitly requested by the shopper."),
  minPrice: z.number().nonnegative().nullable()
    .describe("Minimum whole-dollar listing price, or null when none was requested."),
  maxPrice: z.number().nonnegative().nullable()
    .describe("Maximum whole-dollar listing price, or null when none was requested."),
  beds: z.number().int().min(1).max(20).nullable()
    .describe("Minimum number of bedrooms, or null when none was requested."),
  baths: z.number().int().min(1).max(20).nullable()
    .describe("Minimum number of bathrooms, or null when none was requested."),
  minSqft: z.number().int().positive().nullable()
    .describe("Minimum living area in square feet, or null when none was requested."),
  maxSqft: z.number().int().positive().nullable()
    .describe("Maximum living area in square feet, or null when none was requested."),
  minYearBuilt: z.number().int().min(1800).max(2100).nullable()
    .describe("Earliest acceptable year built, or null when none was requested."),
  propertyType: z.enum(SEARCH_PROPERTY_TYPES).nullable()
    .describe("The requested property type, or null when the shopper did not specify one."),
  waterfrontOnly: z.boolean()
    .describe("True only when the shopper explicitly asks for waterfront, oceanfront, Intracoastal, or canal-front homes."),
  privatePoolOnly: z.boolean()
    .describe("True only when the shopper asks for a private pool at the home."),
  minGarageSpaces: z.number().int().min(1).max(20).nullable()
    .describe("Minimum garage spaces, or null when none was requested."),
  newConstructionOnly: z.boolean()
    .describe("True only when the shopper explicitly asks for new construction."),
  seniorCommunityMode: z.enum(["exclude", "only"]).nullable()
    .describe("Whether to exclude age-restricted communities or show only 55+ communities; null means include all."),
  noHoaOnly: z.boolean()
    .describe("True only when the shopper explicitly asks for no HOA or no homeowner association."),
  maxHoaMonthly: z.number().int().min(1).max(100_000).nullable()
    .describe("Maximum recurring HOA or association fee normalized to dollars per month, or null when none was requested."),
  fireplaceOnly: z.boolean()
    .describe("True only when the shopper explicitly asks for a fireplace."),
  maxDaysOnMarket: z.number().int().min(1).max(3650).nullable()
    .describe("Maximum listing age in days, or null when none was requested."),
});

export type PropertySearchIntent = z.infer<typeof propertySearchIntentSchema>;

const PRICE_PATTERN = String.raw`\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:million|thousand|m|k)?`;
const HOA_AMOUNT_PATTERN = String.raw`\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:thousand|k)?`;
const SOUTH_FLORIDA_POSTAL_CODE = /^(?:33|34)\d{3}(?:-\d{4})?$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function priceFromText(value?: string): number | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  const hasPriceSignal = lower.includes("$")
    || lower.includes(",")
    || /(?:million|thousand|m|k)\s*$/.test(lower);
  const number = Number(lower.replace(/[$,\s]/g, "").replace(/(?:million|thousand|m|k)$/i, ""));
  if (!Number.isFinite(number) || number <= 0) return null;
  if (!hasPriceSignal && number < 10_000) return null;
  const multiplier = /(?:million|m)\s*$/.test(lower)
    ? 1_000_000
    : /(?:thousand|k)\s*$/.test(lower)
      ? 1_000
      : 1;
  return Math.round(number * multiplier);
}

function followedByLivingAreaUnit(prompt: string, match: RegExpMatchArray): boolean {
  const suffix = prompt.slice((match.index ?? 0) + match[0].length);
  return /^\s*(?:sq(?:uare)?\.?\s*(?:ft|feet)|square\s+feet)\b/i.test(suffix);
}

function isHoaAmountMatch(prompt: string, match: RegExpMatchArray): boolean {
  const index = match.index ?? 0;
  const before = prompt.slice(Math.max(0, index - 40), index);
  const after = prompt.slice(index + match[0].length, index + match[0].length + 50);
  return /(?:hoa|homeowners?(?:['’]\s*)?association|association|condo)\s*(?:fees?|dues?)?\s*$/i.test(before)
    || /^\s*(?:(?:per|a)\s+month|monthly|\/\s*mo(?:nth)?|(?:per|a)\s+year|yearly|annually)?\s*(?:in\s+)?(?:hoa|homeowners?(?:['’]\s*)?association|association|condo)\b/i.test(after);
}

function hoaAmountFromText(value?: string): number | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  const number = Number(lower.replace(/[$,\s]/g, "").replace(/(?:thousand|k)$/i, ""));
  if (!Number.isFinite(number) || number <= 0) return null;
  const amount = Math.round(number * (/(?:thousand|k)\s*$/.test(lower) ? 1_000 : 1));
  return amount <= 100_000 ? amount : null;
}

function monthlyHoaAmount(amount: number, context: string): number {
  if (/\b(?:annual|annually|yearly|per\s+year|a\s+year)\b/i.test(context)) return Math.round(amount / 12);
  if (/\b(?:quarterly|per\s+quarter|a\s+quarter)\b/i.test(context)) return Math.round(amount / 3);
  if (/\b(?:weekly|per\s+week|a\s+week)\b/i.test(context)) return Math.round(amount * 52 / 12);
  return amount;
}

function extractMaxHoaMonthly(prompt: string): number | null {
  const comparison = String.raw`(?:under|below|up to|less than|no more than|max(?:imum)?(?: of)?)`;
  const association = String.raw`(?:hoa|homeowners?(?:['’]\s*)?association|association|condo)`;
  const patterns = [
    new RegExp(`\\b${association}(?:\\s+(?:fees?|dues?))?\\s*(?:of|is|at|costs?)?\\s*${comparison}\\s+(${HOA_AMOUNT_PATTERN})(?:\\s*(?:per|a)\\s+(?:month|year|quarter|week)|\\s*(?:monthly|yearly|annually|quarterly|weekly)|\\s*\\/\\s*mo(?:nth)?)?`, "i"),
    new RegExp(`\\b${comparison}\\s+(${HOA_AMOUNT_PATTERN})(?:\\s*(?:per|a)\\s+(?:month|year|quarter|week)|\\s*(?:monthly|yearly|annually|quarterly|weekly)|\\s*\\/\\s*mo(?:nth)?)?\\s+(?:in\\s+)?${association}(?:\\s+(?:fees?|dues?))?`, "i"),
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    const amount = hoaAmountFromText(match?.[1]);
    if (match && amount !== null) return monthlyHoaAmount(amount, match[0]);
  }
  return null;
}

function uniqueLocations(values: string[]): string[] {
  const output: string[] = [];
  for (const value of values) {
    let cleaned = value
      .replace(/\b(?:Florida|FL)\b\.?/gi, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
      .slice(0, 100);
    if (SOUTH_FLORIDA_POSTAL_CODE.test(cleaned)) cleaned = cleaned.slice(0, 5);
    if (!cleaned || /^(?:south|southeast|coastal|downtown)$/i.test(cleaned)) continue;
    if (!output.some((current) => current.toLowerCase() === cleaned.toLowerCase())) output.push(cleaned);
    if (output.length === MAX_SEARCH_LOCATIONS) break;
  }
  return output;
}

function extractLocations(prompt: string): string[] {
  const matches: Array<{ index: number; end: number; value: string }> = [];
  const orderedLocations = [...SOUTH_FLORIDA_LOCATION_NAMES].sort((left, right) => right.length - left.length);

  for (const location of orderedLocations) {
    const expression = new RegExp(`\\b${escapeRegExp(location).replace(/-/g, "[-\\s]")}\\b`, "gi");
    for (const match of prompt.matchAll(expression)) {
      const index = match.index ?? 0;
      const end = index + match[0].length;
      if (matches.some((current) => index < current.end && end > current.index)) continue;
      matches.push({ index, end, value: location });
    }
  }

  for (const match of prompt.matchAll(/\b(?:33|34)\d{3}(?:-\d{4})?\b/g)) {
    const index = match.index ?? 0;
    const end = index + match[0].length;
    if (matches.some((current) => index < current.end && end > current.index)) continue;
    matches.push({ index, end, value: match[0].slice(0, 5) });
  }

  if (matches.length > 0) {
    return uniqueLocations(matches.sort((left, right) => left.index - right.index).map((match) => match.value));
  }

  const locationMatch = prompt.match(
    /\b(?:in|near|around)\s+([a-z][a-z .'-]{1,90}?)(?=\s+(?:with|under|below|over|above|between|at least|up to|for|that (?:has|have)|and (?:has|have)|waterfront|oceanfront|canal|private pool|pool|\d+\s*(?:bed|bedroom))\b|[,;.!?]|$)/i,
  );
  if (!locationMatch?.[1]) return [];
  return uniqueLocations(locationMatch[1].split(/\s+(?:or|and)\s+/i));
}

function extractPrices(prompt: string): { minPrice: number | null; maxPrice: number | null } {
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  const range = prompt.match(new RegExp(`\\b(?:between|from)\\s+(${PRICE_PATTERN})\\s+(?:and|to|-)\\s+(${PRICE_PATTERN})`, "i"));
  if (range && !followedByLivingAreaUnit(prompt, range) && !isHoaAmountMatch(prompt, range)) {
    minPrice = priceFromText(range[1]);
    maxPrice = priceFromText(range[2]);
  }

  const maximums = [...prompt.matchAll(new RegExp(`\\b(?:under|below|up to|less than|no more than|max(?:imum)?(?: of)?)\\s+(${PRICE_PATTERN})`, "gi"))]
    .filter((match) => !followedByLivingAreaUnit(prompt, match) && !isHoaAmountMatch(prompt, match))
    .map((match) => priceFromText(match[1]))
    .filter((value): value is number => value !== null);
  if (maximums.length > 0) maxPrice = Math.min(...maximums);

  const minimums = [...prompt.matchAll(new RegExp(`\\b(?:over|above|at least|more than|min(?:imum)?(?: of)?)\\s+(${PRICE_PATTERN})`, "gi"))]
    .filter((match) => !followedByLivingAreaUnit(prompt, match) && !isHoaAmountMatch(prompt, match))
    .map((match) => priceFromText(match[1]))
    .filter((value): value is number => value !== null);
  if (minimums.length > 0) minPrice = Math.max(...minimums);

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  return { minPrice, maxPrice };
}

function extractPropertyType(prompt: string): PropertyType | null {
  if (/\b(?:condos?|condominiums?)\b/i.test(prompt)) return "Condo";
  if (/\b(?:townhomes?|townhouses?)\b/i.test(prompt)) return "Townhome";
  if (/\b(?:multi[- ]family|duplex(?:es)?|triplex(?:es)?|quadruplex(?:es)?)\b/i.test(prompt)) return "Multi-Family";
  if (/\b(?:commercial|retail|office building)\b/i.test(prompt)) return "Commercial";
  if (/\b(?:vacant land|lots?|land)\b/i.test(prompt)) return "Land";
  if (/\b(?:luxury estates?|estate homes?)\b/i.test(prompt)) return "Estate";
  if (/\b(?:single[- ]family|detached|houses?)\b/i.test(prompt)) return "Single Family";
  return null;
}

function positiveInteger(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function extractLivingArea(prompt: string): { minSqft: number | null; maxSqft: number | null } {
  let minSqft: number | null = null;
  let maxSqft: number | null = null;
  const unit = String.raw`(?:sq(?:uare)?\.?\s*(?:ft|feet)|square\s+feet)`;
  const range = prompt.match(new RegExp(`\\b(?:between|from)\\s+([\\d,]+)\\s+(?:and|to|-)\\s+([\\d,]+)\\s*${unit}`, "i"));
  if (range) {
    minSqft = positiveInteger(range[1]);
    maxSqft = positiveInteger(range[2]);
  }

  const minimum = prompt.match(new RegExp(`\\b(?:at least|over|above|more than|min(?:imum)?(?: of)?)\\s+([\\d,]+)\\s*${unit}`, "i"))
    ?? prompt.match(new RegExp(`\\b([\\d,]+)\\s*\\+\\s*${unit}`, "i"));
  if (minimum) minSqft = positiveInteger(minimum[1]);

  const maximum = prompt.match(new RegExp(`\\b(?:under|below|up to|less than|max(?:imum)?(?: of)?)\\s+([\\d,]+)\\s*${unit}`, "i"));
  if (maximum) maxSqft = positiveInteger(maximum[1]);
  if (minSqft !== null && maxSqft !== null && minSqft > maxSqft) [minSqft, maxSqft] = [maxSqft, minSqft];
  return { minSqft, maxSqft };
}

export function parsePropertySearchIntent(prompt: string): PropertySearchIntent {
  const safePrompt = prompt.trim().replace(/\s+/g, " ").slice(0, 300);
  const prices = extractPrices(safePrompt);
  const livingArea = extractLivingArea(safePrompt);
  const bedroomMatch = safePrompt.match(/\b(\d{1,2})\s*(?:\+|plus)?[-\s]*(?:beds?|bedrooms?)\b/i);
  const bathroomMatch = safePrompt.match(/\b(\d{1,2})\s*(?:\+|plus)?[-\s]*(?:baths?|bathrooms?)\b/i);
  const yearBuiltMatch = safePrompt.match(/\b(?:built|constructed)\s+(in|after|since)\s+((?:18|19|20|21)\d{2})\b/i);
  const garageMatch = safePrompt.match(/\b(\d{1,2})[-\s]*(?:car|vehicle)[-\s]+garage\b/i);
  const daysOnMarketMatch = safePrompt.match(/\b(?:listed|on the market)(?:\s+(?:in|within|for|under|less than))?\s+(\d{1,4})\s+days?\b/i);
  const rejectsPool = /\b(?:without|no)\s+(?:a\s+)?(?:private\s+)?pool\b/i.test(safePrompt);
  const rejectsWaterfront = /\b(?:not|non[- ]|without)\s*waterfront\b/i.test(safePrompt);
  const excludesSeniorCommunity = /\b(?:exclude|excluding|without|no)\s+(?:55\+|senior|age[- ]restricted|active[- ]adult)/i.test(safePrompt);
  const requestsSeniorCommunity = /\b(?:55\+|senior communit(?:y|ies)|age[- ]restricted|active[- ]adult)/i.test(safePrompt);
  const rejectsFireplace = /\b(?:without|no)\s+(?:a\s+)?fireplace\b/i.test(safePrompt);

  return normalizePropertySearchIntent({
    locations: extractLocations(safePrompt),
    ...prices,
    ...livingArea,
    beds: bedroomMatch ? Number(bedroomMatch[1]) : null,
    baths: bathroomMatch ? Number(bathroomMatch[1]) : null,
    minYearBuilt: yearBuiltMatch ? Number(yearBuiltMatch[2]) + (yearBuiltMatch[1]?.toLowerCase() === "after" ? 1 : 0) : null,
    propertyType: extractPropertyType(safePrompt),
    waterfrontOnly: !rejectsWaterfront && /\b(?:waterfront|oceanfront|intracoastal|canal[- ]front|beachfront)\b/i.test(safePrompt),
    privatePoolOnly: !rejectsPool && /\b(?:(?:private|own|swimming)\s+pools?|pool\s+(?:at|on)\s+the\s+(?:home|property)|with\s+(?:a\s+)?pools?|houses?\s+with\s+pools?)\b/i.test(safePrompt),
    minGarageSpaces: garageMatch ? Number(garageMatch[1]) : /\b(?:with\s+(?:a\s+)?garage|garage\s+(?:home|house|condo))\b/i.test(safePrompt) ? 1 : null,
    newConstructionOnly: /\b(?:new construction|new build|newly built)\b/i.test(safePrompt),
    seniorCommunityMode: excludesSeniorCommunity ? "exclude" : requestsSeniorCommunity ? "only" : null,
    noHoaOnly: /\b(?:no|without)\s+(?:an?\s+)?(?:hoa|homeowners? association|homeowners['’]? association)\b/i.test(safePrompt),
    maxHoaMonthly: extractMaxHoaMonthly(safePrompt),
    fireplaceOnly: !rejectsFireplace && /\bfireplaces?\b/i.test(safePrompt),
    maxDaysOnMarket: daysOnMarketMatch ? Number(daysOnMarketMatch[1]) : null,
  });
}

export function normalizePropertySearchIntent(intent: PropertySearchIntent): PropertySearchIntent {
  let minPrice = Number.isFinite(intent.minPrice) && Number(intent.minPrice) > 0
    ? Math.round(Number(intent.minPrice))
    : null;
  let maxPrice = Number.isFinite(intent.maxPrice) && Number(intent.maxPrice) > 0
    ? Math.round(Number(intent.maxPrice))
    : null;
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  let minSqft = Number.isFinite(intent.minSqft) && Number(intent.minSqft) > 0
    ? Math.floor(Number(intent.minSqft))
    : null;
  let maxSqft = Number.isFinite(intent.maxSqft) && Number(intent.maxSqft) > 0
    ? Math.floor(Number(intent.maxSqft))
    : null;
  if (minSqft !== null && maxSqft !== null && minSqft > maxSqft) {
    [minSqft, maxSqft] = [maxSqft, minSqft];
  }

  const propertyType = SEARCH_PROPERTY_TYPES.includes(intent.propertyType as typeof SEARCH_PROPERTY_TYPES[number])
    ? intent.propertyType
    : null;

  return {
    locations: uniqueLocations(intent.locations ?? []),
    minPrice,
    maxPrice,
    beds: Number.isFinite(intent.beds) && Number(intent.beds) > 0
      ? Math.min(20, Math.floor(Number(intent.beds)))
      : null,
    baths: Number.isFinite(intent.baths) && Number(intent.baths) > 0
      ? Math.min(20, Math.floor(Number(intent.baths)))
      : null,
    minSqft,
    maxSqft,
    minYearBuilt: Number.isFinite(intent.minYearBuilt) && Number(intent.minYearBuilt) >= 1800
      ? Math.min(2100, Math.floor(Number(intent.minYearBuilt)))
      : null,
    propertyType,
    waterfrontOnly: intent.waterfrontOnly === true,
    privatePoolOnly: intent.privatePoolOnly === true,
    minGarageSpaces: Number.isFinite(intent.minGarageSpaces) && Number(intent.minGarageSpaces) > 0
      ? Math.min(20, Math.floor(Number(intent.minGarageSpaces)))
      : null,
    newConstructionOnly: intent.newConstructionOnly === true,
    seniorCommunityMode: intent.seniorCommunityMode === "exclude" || intent.seniorCommunityMode === "only"
      ? intent.seniorCommunityMode
      : null,
    noHoaOnly: intent.noHoaOnly === true,
    maxHoaMonthly: Number.isFinite(intent.maxHoaMonthly) && Number(intent.maxHoaMonthly) > 0
      ? Math.min(100_000, Math.round(Number(intent.maxHoaMonthly)))
      : null,
    fireplaceOnly: intent.fireplaceOnly === true,
    maxDaysOnMarket: Number.isFinite(intent.maxDaysOnMarket) && Number(intent.maxDaysOnMarket) > 0
      ? Math.min(3650, Math.floor(Number(intent.maxDaysOnMarket)))
      : null,
  };
}

export function mergePropertySearchIntents(
  aiIntent: PropertySearchIntent,
  fallbackIntent: PropertySearchIntent,
): PropertySearchIntent {
  return normalizePropertySearchIntent({
    locations: aiIntent.locations.length > 0 ? aiIntent.locations : fallbackIntent.locations,
    minPrice: aiIntent.minPrice ?? fallbackIntent.minPrice,
    maxPrice: aiIntent.maxPrice ?? fallbackIntent.maxPrice,
    beds: aiIntent.beds ?? fallbackIntent.beds,
    baths: aiIntent.baths ?? fallbackIntent.baths,
    minSqft: aiIntent.minSqft ?? fallbackIntent.minSqft,
    maxSqft: aiIntent.maxSqft ?? fallbackIntent.maxSqft,
    minYearBuilt: aiIntent.minYearBuilt ?? fallbackIntent.minYearBuilt,
    propertyType: aiIntent.propertyType ?? fallbackIntent.propertyType,
    waterfrontOnly: aiIntent.waterfrontOnly || fallbackIntent.waterfrontOnly,
    privatePoolOnly: aiIntent.privatePoolOnly || fallbackIntent.privatePoolOnly,
    minGarageSpaces: aiIntent.minGarageSpaces ?? fallbackIntent.minGarageSpaces,
    newConstructionOnly: aiIntent.newConstructionOnly || fallbackIntent.newConstructionOnly,
    seniorCommunityMode: aiIntent.seniorCommunityMode ?? fallbackIntent.seniorCommunityMode,
    noHoaOnly: aiIntent.noHoaOnly || fallbackIntent.noHoaOnly,
    maxHoaMonthly: aiIntent.maxHoaMonthly ?? fallbackIntent.maxHoaMonthly,
    fireplaceOnly: aiIntent.fireplaceOnly || fallbackIntent.fireplaceOnly,
    maxDaysOnMarket: aiIntent.maxDaysOnMarket ?? fallbackIntent.maxDaysOnMarket,
  });
}

export function propertySearchUrl(intent: PropertySearchIntent): string {
  const query = new URLSearchParams();
  for (const location of intent.locations) query.append("location", location);
  if (intent.minPrice) query.set("minPrice", String(intent.minPrice));
  if (intent.maxPrice) query.set("maxPrice", String(intent.maxPrice));
  if (intent.beds) query.set("beds", String(intent.beds));
  if (intent.baths) query.set("baths", String(intent.baths));
  if (intent.minSqft) query.set("minSqft", String(intent.minSqft));
  if (intent.maxSqft) query.set("maxSqft", String(intent.maxSqft));
  if (intent.minYearBuilt) query.set("minYearBuilt", String(intent.minYearBuilt));
  if (intent.propertyType) query.set("type", intent.propertyType);
  if (intent.waterfrontOnly) query.set("waterfront", "1");
  if (intent.privatePoolOnly) query.set("pool", "1");
  if (intent.minGarageSpaces) query.set("garageSpaces", String(intent.minGarageSpaces));
  if (intent.newConstructionOnly) query.set("newConstruction", "1");
  if (intent.seniorCommunityMode) query.set("senior", intent.seniorCommunityMode);
  if (intent.noHoaOnly) query.set("noHoa", "1");
  if (intent.maxHoaMonthly) query.set("maxHoa", String(intent.maxHoaMonthly));
  if (intent.fireplaceOnly) query.set("fireplace", "1");
  if (intent.maxDaysOnMarket) query.set("maxDom", String(intent.maxDaysOnMarket));
  return `/properties${query.size ? `?${query.toString()}` : ""}#property-results`;
}
