import { z } from "zod";
import type { PropertyType } from "@/lib/types";

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
  locations: z.array(z.string().min(1).max(100)).max(5)
    .describe("South Florida city or community names explicitly requested by the shopper."),
  minPrice: z.number().nonnegative().nullable()
    .describe("Minimum whole-dollar listing price, or null when none was requested."),
  maxPrice: z.number().nonnegative().nullable()
    .describe("Maximum whole-dollar listing price, or null when none was requested."),
  beds: z.number().int().min(1).max(20).nullable()
    .describe("Minimum number of bedrooms, or null when none was requested."),
  propertyType: z.enum(SEARCH_PROPERTY_TYPES).nullable()
    .describe("The requested property type, or null when the shopper did not specify one."),
  waterfrontOnly: z.boolean()
    .describe("True only when the shopper explicitly asks for waterfront, oceanfront, Intracoastal, or canal-front homes."),
  privatePoolOnly: z.boolean()
    .describe("True only when the shopper asks for a private pool at the home."),
});

export type PropertySearchIntent = z.infer<typeof propertySearchIntentSchema>;

const SOUTH_FLORIDA_LOCATIONS = [
  "Lauderdale-by-the-Sea",
  "West Palm Beach",
  "Hallandale Beach",
  "Fort Lauderdale",
  "Palm Beach Gardens",
  "Boynton Beach",
  "Delray Beach",
  "Deerfield Beach",
  "Hillsboro Beach",
  "Highland Beach",
  "Pompano Beach",
  "Lighthouse Point",
  "Coconut Creek",
  "Coral Springs",
  "Miami Beach",
  "Boca Raton",
  "Palm Beach",
  "Pembroke Pines",
  "Cooper City",
  "Dania Beach",
  "Sunny Isles Beach",
  "Bal Harbour",
  "Bay Harbor Islands",
  "North Miami Beach",
  "North Miami",
  "South Miami",
  "Miami Shores",
  "Coral Gables",
  "Key Biscayne",
  "Manalapan",
  "Hypoluxo",
  "Lake Worth",
  "Wellington",
  "Parkland",
  "Plantation",
  "Hollywood",
  "Aventura",
  "Weston",
  "Sunrise",
  "Tamarac",
  "Margate",
  "Miami",
] as const;

const PRICE_PATTERN = String.raw`\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:million|thousand|m|k)?`;

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

function uniqueLocations(values: string[]): string[] {
  const output: string[] = [];
  for (const value of values) {
    const cleaned = value
      .replace(/\b(?:Florida|FL)\b\.?/gi, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
      .slice(0, 100);
    if (!cleaned || /^(?:south|southeast|coastal|downtown)$/i.test(cleaned)) continue;
    if (!output.some((current) => current.toLowerCase() === cleaned.toLowerCase())) output.push(cleaned);
    if (output.length === 5) break;
  }
  return output;
}

function extractLocations(prompt: string): string[] {
  const matches: Array<{ index: number; end: number; value: string }> = [];
  const orderedLocations = [...SOUTH_FLORIDA_LOCATIONS].sort((left, right) => right.length - left.length);

  for (const location of orderedLocations) {
    const expression = new RegExp(`\\b${escapeRegExp(location).replace(/-/g, "[-\\s]")}\\b`, "gi");
    for (const match of prompt.matchAll(expression)) {
      const index = match.index ?? 0;
      const end = index + match[0].length;
      if (matches.some((current) => index < current.end && end > current.index)) continue;
      matches.push({ index, end, value: location });
    }
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
  if (range) {
    minPrice = priceFromText(range[1]);
    maxPrice = priceFromText(range[2]);
  }

  const maximums = [...prompt.matchAll(new RegExp(`\\b(?:under|below|up to|less than|no more than|max(?:imum)?(?: of)?)\\s+(${PRICE_PATTERN})`, "gi"))]
    .map((match) => priceFromText(match[1]))
    .filter((value): value is number => value !== null);
  if (maximums.length > 0) maxPrice = Math.min(...maximums);

  const minimums = [...prompt.matchAll(new RegExp(`\\b(?:over|above|at least|more than|min(?:imum)?(?: of)?)\\s+(${PRICE_PATTERN})`, "gi"))]
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

export function parsePropertySearchIntent(prompt: string): PropertySearchIntent {
  const safePrompt = prompt.trim().replace(/\s+/g, " ").slice(0, 300);
  const prices = extractPrices(safePrompt);
  const bedroomMatch = safePrompt.match(/\b(\d{1,2})\s*(?:\+|plus)?[-\s]*(?:beds?|bedrooms?)\b/i);
  const rejectsPool = /\b(?:without|no)\s+(?:a\s+)?(?:private\s+)?pool\b/i.test(safePrompt);
  const rejectsWaterfront = /\b(?:not|non[- ]|without)\s*waterfront\b/i.test(safePrompt);

  return normalizePropertySearchIntent({
    locations: extractLocations(safePrompt),
    ...prices,
    beds: bedroomMatch ? Number(bedroomMatch[1]) : null,
    propertyType: extractPropertyType(safePrompt),
    waterfrontOnly: !rejectsWaterfront && /\b(?:waterfront|oceanfront|intracoastal|canal[- ]front|beachfront)\b/i.test(safePrompt),
    privatePoolOnly: !rejectsPool && /\b(?:(?:private|own|swimming)\s+pools?|pool\s+(?:at|on)\s+the\s+(?:home|property)|with\s+(?:a\s+)?pools?|houses?\s+with\s+pools?)\b/i.test(safePrompt),
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
    propertyType,
    waterfrontOnly: intent.waterfrontOnly === true,
    privatePoolOnly: intent.privatePoolOnly === true,
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
    propertyType: aiIntent.propertyType ?? fallbackIntent.propertyType,
    waterfrontOnly: aiIntent.waterfrontOnly || fallbackIntent.waterfrontOnly,
    privatePoolOnly: aiIntent.privatePoolOnly || fallbackIntent.privatePoolOnly,
  });
}

export function propertySearchUrl(intent: PropertySearchIntent): string {
  const query = new URLSearchParams();
  for (const location of intent.locations) query.append("location", location);
  if (intent.minPrice) query.set("minPrice", String(intent.minPrice));
  if (intent.maxPrice) query.set("maxPrice", String(intent.maxPrice));
  if (intent.beds) query.set("beds", String(intent.beds));
  if (intent.propertyType) query.set("type", intent.propertyType);
  if (intent.waterfrontOnly) query.set("waterfront", "1");
  if (intent.privatePoolOnly) query.set("pool", "1");
  return `/properties${query.size ? `?${query.toString()}` : ""}#property-results`;
}
