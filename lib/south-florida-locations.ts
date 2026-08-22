export const MAX_SEARCH_LOCATIONS = 20;

export const SOUTH_FLORIDA_COUNTIES = [
  {
    name: "Palm Beach County",
    cities: [
      "Boca Raton",
      "Boynton Beach",
      "Delray Beach",
      "Greenacres",
      "Gulf Stream",
      "Highland Beach",
      "Hypoluxo",
      "Juno Beach",
      "Jupiter",
      "Jupiter Inlet Colony",
      "Lake Clarke Shores",
      "Lake Park",
      "Lake Worth",
      "Lake Worth Beach",
      "Lantana",
      "Loxahatchee",
      "Manalapan",
      "North Palm Beach",
      "Ocean Ridge",
      "Palm Beach",
      "Palm Beach Gardens",
      "Palm Beach Shores",
      "Palm Springs",
      "Riviera Beach",
      "Royal Palm Beach",
      "Tequesta",
      "Wellington",
      "West Palm Beach",
    ],
  },
  {
    name: "Broward County",
    cities: [
      "Coconut Creek",
      "Cooper City",
      "Coral Springs",
      "Dania Beach",
      "Davie",
      "Deerfield Beach",
      "Fort Lauderdale",
      "Hallandale Beach",
      "Hillsboro Beach",
      "Hollywood",
      "Lauderdale-by-the-Sea",
      "Lauderdale Lakes",
      "Lauderhill",
      "Lighthouse Point",
      "Margate",
      "Miramar",
      "North Lauderdale",
      "Oakland Park",
      "Parkland",
      "Pembroke Pines",
      "Plantation",
      "Pompano Beach",
      "Southwest Ranches",
      "Sunrise",
      "Tamarac",
      "Weston",
      "Wilton Manors",
    ],
  },
  {
    name: "Miami-Dade County",
    cities: [
      "Aventura",
      "Bal Harbour",
      "Bay Harbor Islands",
      "Biscayne Park",
      "Coral Gables",
      "Doral",
      "El Portal",
      "Florida City",
      "Golden Beach",
      "Hialeah",
      "Homestead",
      "Key Biscayne",
      "Miami",
      "Miami Beach",
      "Miami Gardens",
      "Miami Lakes",
      "Miami Shores",
      "North Bay Village",
      "North Miami",
      "North Miami Beach",
      "Palmetto Bay",
      "Pinecrest",
      "South Miami",
      "Sunny Isles Beach",
      "Surfside",
    ],
  },
  {
    name: "Martin County",
    cities: [
      "Hobe Sound",
      "Indiantown",
      "Jensen Beach",
      "Jupiter Island",
      "Palm City",
      "Port Salerno",
      "Sewall's Point",
      "Stuart",
    ],
  },
  {
    name: "St. Lucie County",
    cities: [
      "Fort Pierce",
      "Hutchinson Island",
      "Port St. Lucie",
      "St. Lucie Village",
    ],
  },
  {
    name: "Monroe County",
    cities: [
      "Big Pine Key",
      "Islamorada",
      "Key Colony Beach",
      "Key Largo",
      "Key West",
      "Layton",
      "Marathon",
      "Tavernier",
    ],
  },
] as const;

export const SOUTH_FLORIDA_COUNTY_NAMES = SOUTH_FLORIDA_COUNTIES.map((county) => county.name);

export const SOUTH_FLORIDA_CITY_NAMES = Array.from(new Set(
  SOUTH_FLORIDA_COUNTIES.flatMap((county) => county.cities),
));

export const SOUTH_FLORIDA_LOCATION_OPTIONS = [
  ...SOUTH_FLORIDA_COUNTIES.map((county) => ({
    name: county.name,
    county: county.name,
    type: "County" as const,
  })),
  ...SOUTH_FLORIDA_COUNTIES.flatMap((county) => county.cities.map((city) => ({
    name: city,
    county: county.name,
    type: "City" as const,
  }))),
];

export const SOUTH_FLORIDA_LOCATION_NAMES = Array.from(new Set(
  SOUTH_FLORIDA_LOCATION_OPTIONS.map((location) => location.name),
));

export function southFloridaCounty(value: string) {
  const normalized = value.trim().toLowerCase();
  return SOUTH_FLORIDA_COUNTIES.find((county) => county.name.toLowerCase() === normalized);
}

export function southFloridaCountyValue(value: string): string | null {
  return southFloridaCounty(value)?.name.replace(/ County$/, "") ?? null;
}

export function southFloridaLocationKind(value: string): "ZIP" | "County" | "City" | "Area" {
  const normalized = value.trim().toLowerCase();
  if (/^(?:33|34)\d{3}(?:-\d{4})?$/.test(normalized)) return "ZIP";
  if (SOUTH_FLORIDA_COUNTY_NAMES.some((county) => county.toLowerCase() === normalized)) return "County";
  if (SOUTH_FLORIDA_CITY_NAMES.some((city) => city.toLowerCase() === normalized)) return "City";
  return "Area";
}

export function southFloridaCityCounty(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return SOUTH_FLORIDA_COUNTIES.find((county) => (
    county.cities.some((city) => city.toLowerCase() === normalized)
  ))?.name ?? null;
}
