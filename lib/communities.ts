import type { Community } from "./types";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

export const COMMUNITIES: Community[] = [
  {
    slug: "las-olas",
    name: "Las Olas",
    county: "Broward County",
    mileMarker: 8.1,
    heroImage: img("photo-1570737543243-cd82cbd1e8c9"),
    tagline: "Downtown Fort Lauderdale living near the New River and Las Olas Boulevard.",
    overview:
      "Las Olas is a central Fort Lauderdale district where downtown condos, restaurants, offices, marinas, and the New River sit close together. Buyers comparing the area often weigh walkability, building rules, parking, flood information, boat access, and proximity to the beach.",
    medianPrice: 0,
    highlights: ["Downtown Fort Lauderdale", "New River access", "Condos and townhomes", "Dining and retail"],
    images: [img("photo-1449824913935-59a10b8d2000"), img("photo-1523217582562-09d0def993a6")],
  },
  {
    slug: "coral-ridge",
    name: "Coral Ridge",
    county: "Broward County",
    mileMarker: 9.6,
    heroImage: img("photo-1600585154526-990dced4db0d"),
    tagline: "Established Fort Lauderdale neighborhoods between the Intracoastal and US-1 corridor.",
    overview:
      "Coral Ridge includes single-family homes, waterfront streets, condos, and convenient access to central Fort Lauderdale. Property-by-property research matters here because dockage, bridge clearance, flood zones, renovations, and lot characteristics can vary significantly.",
    medianPrice: 0,
    highlights: ["Single-family homes", "Waterfront streets", "Near the Intracoastal", "Central Broward location"],
    images: [img("photo-1600566753190-17f0baa2a6c3"), img("photo-1600566752734-2a0cd53d1e77")],
  },
  {
    slug: "wilton-manors",
    name: "Wilton Manors",
    county: "Broward County",
    mileMarker: 10,
    heroImage: img("photo-1570129477492-45c003edd2be"),
    tagline: "A compact Broward city with residential streets around Wilton Drive.",
    overview:
      "Wilton Manors is a small municipality surrounded by Fort Lauderdale and Oakland Park. Buyers can compare single-family homes, townhomes, condos, canal-front properties, and proximity to Wilton Drive while checking the specific flood, permit, and property records for each address.",
    medianPrice: 0,
    highlights: ["Wilton Drive", "Single-family and condo options", "Canal-front properties", "Central Broward location"],
    images: [img("photo-1600566752355-35792bedcfea"), img("photo-1600585154340-be6161a56a0c")],
  },
  {
    slug: "lauderdale-by-the-sea",
    name: "Lauderdale-by-the-Sea",
    county: "Broward County",
    mileMarker: 12.4,
    heroImage: img("photo-1499793983690-e29da59ef1c2"),
    tagline: "A beachside town north of Fort Lauderdale with condos and low-rise residential streets.",
    overview:
      "Lauderdale-by-the-Sea sits between the Atlantic Ocean and the Intracoastal corridor. Buyers often compare oceanfront condos, smaller buildings, single-family homes, beach access, building rules, flood information, and insurance considerations.",
    medianPrice: 0,
    highlights: ["Atlantic beach access", "Oceanfront condos", "Low-rise areas", "Near Fort Lauderdale"],
    images: [img("photo-1477518518651-ea9bf8f2e35a"), img("photo-1444927714506-8492d94b5ba0")],
  },
  {
    slug: "hillsboro-beach",
    name: "Hillsboro Beach",
    county: "Broward County",
    mileMarker: 18.9,
    heroImage: img("photo-1519046904884-53103b34b206"),
    tagline: "A narrow coastal town between the Atlantic and Intracoastal Waterway.",
    overview:
      "Hillsboro Beach is a barrier-island community with oceanfront and Intracoastal properties along Hillsboro Mile. Buyers should evaluate building or property-specific details such as flood information, insurance, seawalls, docks, association documents, reserves, and assessments where applicable.",
    medianPrice: 0,
    highlights: ["Barrier-island location", "Oceanfront property", "Intracoastal property", "Condo and estate options"],
    images: [img("photo-1520250497591-112f2f40a3f4"), img("photo-1505142468610-359e7d316be0")],
  },
  {
    slug: "boca-raton",
    name: "Boca Raton",
    county: "Palm Beach County",
    mileMarker: 26.2,
    heroImage: img("photo-1600607687920-4e2a09cf159d"),
    tagline: "A large Palm Beach County market spanning beach, downtown, golf, and gated communities.",
    overview:
      "Boca Raton offers a wide range of housing, from downtown and beach-area condos to single-family neighborhoods, waterfront property, golf communities, and gated developments. HOA or club requirements, school assignments, flood information, and property records can differ substantially by address.",
    medianPrice: 0,
    highlights: ["Downtown and beach areas", "Waterfront homes", "Golf communities", "Gated communities"],
    images: [img("photo-1600566752229-250ed79470f8"), img("photo-1600607687644-c7171b42498b")],
  },
  {
    slug: "delray-beach",
    name: "Delray Beach",
    county: "Palm Beach County",
    mileMarker: 31,
    heroImage: img("photo-1500530855697-b586d89ba3ee"),
    tagline: "Atlantic Avenue, beach access, condos, historic areas, and suburban communities.",
    overview:
      "Delray Beach stretches from the Atlantic coast west through a mix of downtown condos, established neighborhoods, gated communities, and newer development. Buyers can compare walkability near Atlantic Avenue with larger-home options farther west while verifying HOA, flood, permit, and school information by property.",
    medianPrice: 0,
    highlights: ["Atlantic Avenue", "Beach access", "Downtown condos", "Gated communities"],
    images: [img("photo-1507525428034-b723cf961d3e"), img("photo-1511818966892-d7d671e672a2")],
  },
  {
    slug: "boynton-beach",
    name: "Boynton Beach",
    county: "Palm Beach County",
    mileMarker: 36,
    heroImage: img("photo-1494526585095-c41746248156"),
    tagline: "Coastal, central, and western neighborhoods across southern Palm Beach County.",
    overview:
      "Boynton Beach includes coastal condos and neighborhoods east of I-95 as well as a large selection of single-family, gated, and age-restricted communities farther west. HOA rules, club structures, school assignments, and insurance considerations vary widely, making address-level research important.",
    medianPrice: 0,
    highlights: ["Coastal and inland options", "Single-family homes", "Gated communities", "55+ communities"],
    images: [img("photo-1564013799919-ab600027ffc6"), img("photo-1600585152915-d208bec867a1")],
  },
  {
    slug: "lake-worth-beach",
    name: "Lake Worth Beach",
    county: "Palm Beach County",
    mileMarker: 42,
    heroImage: img("photo-1523217582562-09d0def993a6"),
    tagline: "An eastern Palm Beach County city with a downtown core and beach access.",
    overview:
      "Lake Worth Beach combines an older downtown grid, cottages and single-family homes, condos, and access to the Intracoastal and Atlantic beach. Renovation history, permits, flood information, historic-district considerations, and lot details are useful items to verify for individual properties.",
    medianPrice: 0,
    highlights: ["Downtown grid", "Beach access", "Older housing stock", "Condos and single-family homes"],
    images: [img("photo-1501183638710-841dd1904471"), img("photo-1484154218962-a197022b5858")],
  },
  {
    slug: "west-palm-beach",
    name: "West Palm Beach",
    county: "Palm Beach County",
    mileMarker: 48,
    heroImage: img("photo-1449824913935-59a10b8d2000"),
    tagline: "Downtown towers, historic neighborhoods, and communities across central Palm Beach County.",
    overview:
      "West Palm Beach offers downtown condos and apartments, established residential neighborhoods, waterfront areas, and suburban communities farther west. Buyers often compare commute access, condo or HOA rules, flood information, taxes, and proximity to downtown amenities.",
    medianPrice: 0,
    highlights: ["Downtown condos", "Historic neighborhoods", "Waterfront areas", "Central county access"],
    images: [img("photo-1497366811353-6870744d04b2"), img("photo-1486406146926-c627a92ad1ab")],
  },
  {
    slug: "wellington",
    name: "Wellington",
    county: "Palm Beach County",
    mileMarker: 52,
    heroImage: img("photo-1558036117-15d82a90b9b1"),
    tagline: "Western Palm Beach County homes, equestrian property, gated communities, and larger lots.",
    overview:
      "Wellington is known for a broad range of single-family neighborhoods and its equestrian community. Buyers may compare gated and non-gated subdivisions, acreage and equestrian properties, HOA rules, school assignments, commute patterns, drainage, and permit history.",
    medianPrice: 0,
    highlights: ["Equestrian property", "Single-family neighborhoods", "Gated communities", "Larger-lot options"],
    images: [img("photo-1568605114967-8130f3a36994"), img("photo-1600566753086-00f18fb6b3ea")],
  },
  {
    slug: "palm-beach-gardens",
    name: "Palm Beach Gardens",
    county: "Palm Beach County",
    mileMarker: 58,
    heroImage: img("photo-1600047509807-ba8f99d2cdde"),
    tagline: "Northern Palm Beach County communities with golf, gated neighborhoods, and convenient retail access.",
    overview:
      "Palm Beach Gardens includes country-club and golf communities, gated subdivisions, condos, townhomes, and non-gated neighborhoods. Buyers should compare HOA or club obligations, property taxes, school assignments, insurance, and access to major roads and employment centers.",
    medianPrice: 0,
    highlights: ["Golf communities", "Gated neighborhoods", "Townhomes and condos", "Northern Palm Beach County"],
    images: [img("photo-1600210492486-724fe5c67fb0"), img("photo-1600607687939-ce8a6c25118c")],
  },
  {
    slug: "jupiter",
    name: "Jupiter",
    county: "Palm Beach County",
    mileMarker: 66,
    heroImage: img("photo-1505142468610-359e7d316be0"),
    tagline: "Northern Palm Beach County living near the Loxahatchee River, Intracoastal, and Atlantic coast.",
    overview:
      "Jupiter includes waterfront homes, beach-area condos, golf and gated communities, and suburban neighborhoods extending inland. Boaters and waterfront buyers should verify bridge clearance, dock and seawall condition, flood information, permits, and insurance details for the specific property.",
    medianPrice: 0,
    highlights: ["Waterfront homes", "Beach-area condos", "Golf communities", "Boating access"],
    images: [img("photo-1519046904884-53103b34b206"), img("photo-1507525428034-b723cf961d3e")],
  },
];

export async function getAllCommunities(): Promise<Community[]> {
  return [...COMMUNITIES].sort((a, b) => a.mileMarker - b.mileMarker);
}

export async function getCommunityBySlug(slug: string): Promise<Community | undefined> {
  return COMMUNITIES.find((c) => c.slug === slug);
}
