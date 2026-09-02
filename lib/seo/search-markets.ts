export interface SearchMarketLink {
  label: string;
  href: string;
}

export interface SearchMarket {
  slug: string;
  name: string;
  title: string;
  heading: string;
  description: string;
  searchValue: string;
  eyebrow: string;
  region: string;
  kind: "county" | "zip";
  postalCode?: string;
  overview: [string, string];
  highlights: string[];
  related: SearchMarketLink[];
}

export const SEARCH_MARKETS: SearchMarket[] = [
  {
    slug: "palm-beach-county",
    name: "Palm Beach County",
    title: "Palm Beach County FL Homes for Sale",
    heading: "Palm Beach County, FL homes for sale",
    description:
      "Search Palm Beach County homes for sale and compare coastal, downtown, suburban, gated, golf, equestrian, waterfront, condo, and 55+ options.",
    searchValue: "Palm Beach County",
    eyebrow: "Palm Beach County Real Estate",
    region: "South Florida",
    kind: "county",
    overview: [
      "Palm Beach County stretches from Atlantic beach towns and downtown condo markets to western suburban, equestrian, golf, and gated communities. Buyers can compare very different housing types and ownership costs without leaving the county.",
      "Use the live BeachesMLS search to narrow current inventory, then verify the property-specific details that affect a decision: flood information, insurance, taxes, association or club obligations, assessments, permits, school assignments, and commuting patterns.",
    ],
    highlights: [
      "Atlantic coast and Intracoastal markets",
      "Condos, townhomes, and single-family homes",
      "Golf, gated, and equestrian communities",
      "Active-adult and non-age-restricted options",
    ],
    related: [
      { label: "Boca Raton homes for sale", href: "/communities/boca-raton" },
      { label: "Delray Beach homes for sale", href: "/communities/delray-beach" },
      { label: "Boynton Beach homes for sale", href: "/communities/boynton-beach" },
      { label: "Lake Worth Beach homes for sale", href: "/communities/lake-worth-beach" },
      { label: "West Palm Beach homes for sale", href: "/communities/west-palm-beach" },
      { label: "Wellington homes for sale", href: "/communities/wellington" },
      { label: "Palm Beach Gardens homes for sale", href: "/communities/palm-beach-gardens" },
      { label: "Jupiter homes for sale", href: "/communities/jupiter" },
    ],
  },
  {
    slug: "broward-county",
    name: "Broward County",
    title: "Broward County FL Homes for Sale",
    heading: "Broward County, FL homes for sale",
    description:
      "Search Broward County homes for sale across Fort Lauderdale and nearby coastal, waterfront, suburban, condo, townhome, and single-family markets.",
    searchValue: "Broward County",
    eyebrow: "Broward County Real Estate",
    region: "South Florida",
    kind: "county",
    overview: [
      "Broward County includes dense downtown and beach corridors, waterfront neighborhoods, established suburbs, and western communities with a wide range of condos, townhomes, and single-family homes.",
      "Start with current BeachesMLS inventory, then compare transportation, flood and insurance considerations, association rules, building finances, dock or seawall details, permits, taxes, and other facts for the exact property and municipality.",
    ],
    highlights: [
      "Fort Lauderdale and surrounding cities",
      "Oceanfront and waterfront property",
      "Downtown condos and suburban homes",
      "Broad range of price points and property types",
    ],
    related: [
      { label: "Fort Lauderdale homes for sale", href: "/fort-lauderdale-homes-for-sale" },
      { label: "Las Olas real estate", href: "/communities/las-olas" },
      { label: "Coral Ridge homes and real estate", href: "/communities/coral-ridge" },
      { label: "Wilton Manors homes for sale", href: "/communities/wilton-manors" },
      { label: "Lauderdale-by-the-Sea homes", href: "/communities/lauderdale-by-the-sea" },
      { label: "Hillsboro Beach real estate", href: "/communities/hillsboro-beach" },
    ],
  },
  {
    slug: "33467",
    name: "33467",
    title: "33467 Homes for Sale | Lake Worth FL Real Estate",
    heading: "Homes for sale in 33467",
    description:
      "Search homes for sale in ZIP code 33467 near Lake Worth, Florida, including single-family, gated, townhome, villa, pool, HOA, and 55+ options.",
    searchValue: "33467",
    eyebrow: "Lake Worth ZIP Code Real Estate",
    region: "Lake Worth, Palm Beach County",
    kind: "zip",
    postalCode: "33467",
    overview: [
      "ZIP code 33467 uses Lake Worth mailing addresses and includes a broad mix of single-family neighborhoods, gated communities, townhomes, villas, and age-restricted options in western Palm Beach County.",
      "Community rules, association fees, club obligations, school assignments, taxes, insurance, and municipal services can differ from one address to the next. Compare the live inventory first, then verify each property through current official records and association documents.",
    ],
    highlights: [
      "Single-family homes and gated communities",
      "Townhomes, villas, and active-adult options",
      "Pool, waterfront, HOA, and no-HOA searches",
      "Direct access to current 33467 MLS inventory",
    ],
    related: [
      { label: "Lake Worth Beach homes for sale", href: "/communities/lake-worth-beach" },
      { label: "Wellington homes for sale", href: "/communities/wellington" },
      { label: "33437 homes for sale", href: "/homes-for-sale/33437" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33437",
    name: "33437",
    title: "33437 Homes for Sale | Boynton Beach FL Real Estate",
    heading: "Homes for sale in 33437",
    description:
      "Search homes for sale in Boynton Beach ZIP code 33437, including single-family homes, villas, condos, gated communities, pools, and 55+ options.",
    searchValue: "33437",
    eyebrow: "Boynton Beach ZIP Code Real Estate",
    region: "Boynton Beach, Palm Beach County",
    kind: "zip",
    postalCode: "33437",
    overview: [
      "ZIP code 33437 covers a large western Boynton Beach market with single-family homes, villas, condos, gated developments, and both age-restricted and non-age-restricted communities.",
      "Association structures vary widely in this ZIP code. Review monthly or quarterly fees, included services, club requirements, reserves, assessments, insurance responsibilities, and community restrictions before comparing the total cost of two homes.",
    ],
    highlights: [
      "Gated and non-gated neighborhoods",
      "Single-family, villa, and condo choices",
      "55+ and all-ages communities",
      "HOA and monthly-cost comparisons",
    ],
    related: [
      { label: "Boynton Beach homes for sale", href: "/communities/boynton-beach" },
      { label: "33436 homes for sale", href: "/homes-for-sale/33436" },
      { label: "33467 homes for sale", href: "/homes-for-sale/33467" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33436",
    name: "33436",
    title: "33436 Homes for Sale | Boynton Beach FL Real Estate",
    heading: "Homes for sale in 33436",
    description:
      "Search Boynton Beach 33436 homes for sale, including single-family homes, condos, townhomes, villas, pool homes, gated communities, and no-HOA options.",
    searchValue: "33436",
    eyebrow: "Boynton Beach ZIP Code Real Estate",
    region: "Boynton Beach, Palm Beach County",
    kind: "zip",
    postalCode: "33436",
    overview: [
      "ZIP code 33436 is a central Boynton Beach market with single-family neighborhoods, condos, townhomes, villas, and communities positioned near major roads, shopping, and employment corridors.",
      "Property age, renovation history, association coverage, roof and insurance details, permits, taxes, and flood information should be checked at the address level. Use the live search to compare current choices before estimating total monthly ownership cost.",
    ],
    highlights: [
      "Central Boynton Beach location",
      "Single-family, condo, and townhome inventory",
      "Pool, gated, and no-HOA searches",
      "Property-level permit and insurance research",
    ],
    related: [
      { label: "Boynton Beach homes for sale", href: "/communities/boynton-beach" },
      { label: "33437 homes for sale", href: "/homes-for-sale/33437" },
      { label: "Lake Worth Beach homes for sale", href: "/communities/lake-worth-beach" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33446",
    name: "33446",
    title: "33446 Homes for Sale | Delray Beach FL Real Estate",
    heading: "Homes for sale in 33446",
    description:
      "Search Delray Beach 33446 homes for sale, including gated communities, single-family homes, villas, condos, pools, golf, club, and 55+ options.",
    searchValue: "33446",
    eyebrow: "Delray Beach ZIP Code Real Estate",
    region: "Delray Beach, Palm Beach County",
    kind: "zip",
    postalCode: "33446",
    overview: [
      "ZIP code 33446 is a western Delray Beach market with gated developments, single-family homes, villas, condos, golf and club communities, and a significant mix of active-adult choices.",
      "Compare more than list price. Membership requirements, initiation costs, association fees, reserves, assessments, insurance, taxes, and age restrictions can materially change the ownership picture and should be verified for each community and property.",
    ],
    highlights: [
      "Gated, golf, and club communities",
      "Single-family homes, villas, and condos",
      "55+ and all-ages search options",
      "Association and membership due diligence",
    ],
    related: [
      { label: "Delray Beach homes for sale", href: "/communities/delray-beach" },
      { label: "33483 homes for sale", href: "/homes-for-sale/33483" },
      { label: "Boynton Beach homes for sale", href: "/communities/boynton-beach" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33483",
    name: "33483",
    title: "33483 Homes for Sale | Delray Beach FL Real Estate",
    heading: "Homes for sale in 33483",
    description:
      "Search homes for sale in Delray Beach ZIP code 33483, including downtown, beach-area, condo, single-family, waterfront, and Intracoastal options.",
    searchValue: "33483",
    eyebrow: "East Delray Beach Real Estate",
    region: "Delray Beach, Palm Beach County",
    kind: "zip",
    postalCode: "33483",
    overview: [
      "ZIP code 33483 covers an east Delray Beach market near downtown, the beach, and the Intracoastal corridor, with condos, townhomes, single-family neighborhoods, and waterfront property.",
      "Buyers should evaluate walkability and location alongside building rules, reserves, assessments, flood information, insurance, parking, rental restrictions, seawalls, docks, and permit history where those issues apply.",
    ],
    highlights: [
      "Downtown and beach-area real estate",
      "Condos, townhomes, and single-family homes",
      "Intracoastal and waterfront options",
      "Building, flood, and insurance research",
    ],
    related: [
      { label: "Delray Beach homes for sale", href: "/communities/delray-beach" },
      { label: "33446 homes for sale", href: "/homes-for-sale/33446" },
      { label: "Boca Raton homes for sale", href: "/communities/boca-raton" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33414",
    name: "33414",
    title: "33414 Homes for Sale | Wellington FL Real Estate",
    heading: "Homes for sale in 33414",
    description:
      "Search Wellington 33414 homes for sale, including single-family homes, gated communities, equestrian property, pools, townhomes, condos, and no-HOA options.",
    searchValue: "33414",
    eyebrow: "Wellington ZIP Code Real Estate",
    region: "Wellington, Palm Beach County",
    kind: "zip",
    postalCode: "33414",
    overview: [
      "ZIP code 33414 covers much of Wellington and includes single-family neighborhoods, gated communities, condos, townhomes, larger-lot homes, and equestrian property.",
      "Buyers should verify association rules, equestrian or agricultural restrictions, drainage, permits, insurance, school assignments, taxes, and proximity to seasonal venues or major roads for the exact address being considered.",
    ],
    highlights: [
      "Wellington single-family neighborhoods",
      "Equestrian and larger-lot property",
      "Gated, pool, and no-HOA options",
      "School, permit, and drainage research",
    ],
    related: [
      { label: "Wellington homes for sale", href: "/communities/wellington" },
      { label: "33467 homes for sale", href: "/homes-for-sale/33467" },
      { label: "West Palm Beach homes for sale", href: "/communities/west-palm-beach" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33418",
    name: "33418",
    title: "33418 Homes for Sale | Palm Beach Gardens Real Estate",
    heading: "Homes for sale in 33418",
    description:
      "Search Palm Beach Gardens 33418 homes for sale, including single-family homes, condos, townhomes, gated, golf, club, pool, and waterfront options.",
    searchValue: "33418",
    eyebrow: "Palm Beach Gardens ZIP Code Real Estate",
    region: "Palm Beach Gardens, Palm Beach County",
    kind: "zip",
    postalCode: "33418",
    overview: [
      "ZIP code 33418 is a Palm Beach Gardens market with single-family homes, condos, townhomes, gated developments, golf and club communities, and select waterfront choices.",
      "Association and club structures deserve close review. Compare dues, membership requirements, reserves, assessments, included services, insurance responsibilities, taxes, and renovation or permit history before deciding which property offers the better value.",
    ],
    highlights: [
      "Palm Beach Gardens homes and condos",
      "Gated, golf, and club communities",
      "Townhome, pool, and waterfront searches",
      "Membership and association due diligence",
    ],
    related: [
      { label: "Palm Beach Gardens homes for sale", href: "/communities/palm-beach-gardens" },
      { label: "Jupiter homes for sale", href: "/communities/jupiter" },
      { label: "33458 homes for sale", href: "/homes-for-sale/33458" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33458",
    name: "33458",
    title: "33458 Homes for Sale | Jupiter FL Real Estate",
    heading: "Homes for sale in 33458",
    description:
      "Search Jupiter 33458 homes for sale, including single-family homes, townhomes, condos, gated communities, pools, waterfront, and no-HOA options.",
    searchValue: "33458",
    eyebrow: "Jupiter ZIP Code Real Estate",
    region: "Jupiter, Palm Beach County",
    kind: "zip",
    postalCode: "33458",
    overview: [
      "ZIP code 33458 covers a large Jupiter residential market with single-family neighborhoods, townhomes, condos, gated communities, and waterfront or canal-adjacent options in selected areas.",
      "Review association rules, flood information, insurance, roof and renovation history, permits, taxes, school assignments, traffic patterns, and dock or seawall details when applicable to the specific property.",
    ],
    highlights: [
      "Jupiter single-family homes and townhomes",
      "Condo, gated, and no-HOA choices",
      "Pool and waterfront search options",
      "Flood, permit, and insurance research",
    ],
    related: [
      { label: "Jupiter homes for sale", href: "/communities/jupiter" },
      { label: "Palm Beach Gardens homes for sale", href: "/communities/palm-beach-gardens" },
      { label: "33418 homes for sale", href: "/homes-for-sale/33418" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33401",
    name: "33401",
    title: "33401 Homes for Sale | West Palm Beach Real Estate",
    heading: "Homes for sale in 33401",
    description:
      "Search West Palm Beach 33401 homes for sale, including downtown condos, historic-area homes, townhomes, new development, and waterfront options.",
    searchValue: "33401",
    eyebrow: "West Palm Beach ZIP Code Real Estate",
    region: "West Palm Beach, Palm Beach County",
    kind: "zip",
    postalCode: "33401",
    overview: [
      "ZIP code 33401 includes downtown West Palm Beach, condo towers, townhomes, historic residential areas, and properties near major business, entertainment, and transportation corridors.",
      "For condos and older properties, compare reserves, assessments, insurance responsibilities, building rules, parking, rental restrictions, renovation history, permits, flood information, and total monthly costs rather than relying on price alone.",
    ],
    highlights: [
      "Downtown West Palm Beach condos",
      "Historic-area homes and townhomes",
      "Waterfront and new-development options",
      "Building finance and assessment research",
    ],
    related: [
      { label: "West Palm Beach homes for sale", href: "/communities/west-palm-beach" },
      { label: "Palm Beach Gardens homes for sale", href: "/communities/palm-beach-gardens" },
      { label: "Lake Worth Beach homes for sale", href: "/communities/lake-worth-beach" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
  {
    slug: "33432",
    name: "33432",
    title: "33432 Homes for Sale | Boca Raton FL Real Estate",
    heading: "Homes for sale in 33432",
    description:
      "Search Boca Raton 33432 homes for sale, including downtown, beach-area, condo, single-family, waterfront, and Intracoastal real estate options.",
    searchValue: "33432",
    eyebrow: "East Boca Raton Real Estate",
    region: "Boca Raton, Palm Beach County",
    kind: "zip",
    postalCode: "33432",
    overview: [
      "ZIP code 33432 is an east Boca Raton market that includes downtown and beach-area condos, single-family neighborhoods, townhomes, and waterfront or Intracoastal property.",
      "Buyers should compare building reserves, assessments, rental and pet rules, parking, flood information, insurance, dock and seawall details, permits, and renovation history where relevant to the property type and location.",
    ],
    highlights: [
      "Downtown and beach-area Boca Raton",
      "Condos, townhomes, and single-family homes",
      "Waterfront and Intracoastal searches",
      "Building, flood, and insurance research",
    ],
    related: [
      { label: "Boca Raton homes for sale", href: "/communities/boca-raton" },
      { label: "Delray Beach homes for sale", href: "/communities/delray-beach" },
      { label: "33483 homes for sale", href: "/homes-for-sale/33483" },
      { label: "Palm Beach County homes for sale", href: "/homes-for-sale/palm-beach-county" },
    ],
  },
];

export const SEARCH_MARKET_MAP = new Map(SEARCH_MARKETS.map((market) => [market.slug, market]));

export const FEATURED_SEARCH_MARKETS = SEARCH_MARKETS.filter((market) =>
  ["palm-beach-county", "broward-county", "33467", "33437", "33446", "33414", "33418", "33458"].includes(market.slug),
);

export const COMMUNITY_ZIP_MARKETS: Record<string, string[]> = {
  "boca-raton": ["33432"],
  "delray-beach": ["33483", "33446"],
  "boynton-beach": ["33436", "33437"],
  "lake-worth-beach": ["33467"],
  "west-palm-beach": ["33401"],
  wellington: ["33414", "33467"],
  "palm-beach-gardens": ["33418"],
  jupiter: ["33458"],
};

export function getSearchMarket(slug: string) {
  return SEARCH_MARKET_MAP.get(slug);
}
