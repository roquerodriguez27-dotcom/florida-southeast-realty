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
    tagline: "Where the New River meets Fort Lauderdale's restaurant row.",
    overview:
      "Las Olas is Fort Lauderdale's downtown-meets-waterfront corridor: boutique high-rises, walkable dining, and yacht-lined docks a block from gallery storefronts. It suits buyers who want density and nightlife without leaving the water behind.",
    medianPrice: 1650000,
    walkScore: 91,
    highlights: ["Riverfront dining", "Boutique high-rises", "Gallery district", "Water taxi stop"],
    images: [img("photo-1449824913935-59a10b8d2000"), img("photo-1523217582562-09d0def993a6")],
  },
  {
    slug: "coral-ridge",
    name: "Coral Ridge",
    county: "Broward County",
    mileMarker: 9.6,
    heroImage: img("photo-1600585154526-990dced4db0d"),
    tagline: "Mid-century canal lots and the widest yards in Fort Lauderdale.",
    overview:
      "Coral Ridge's grid of wide canal lots and mid-century architecture has become the address for buyers restoring original terrazzo and vaulted ceilings. Deep setbacks and mature oak canopy set it apart from newer subdivisions.",
    medianPrice: 1980000,
    walkScore: 42,
    highlights: ["Mid-century architecture", "Wide canal lots", "A-rated schools", "Minutes to the beach"],
    images: [img("photo-1600566753190-17f0baa2a6c3"), img("photo-1600566752734-2a0cd53d1e77")],
  },
  {
    slug: "boca-raton",
    name: "Boca Raton",
    county: "Palm Beach County",
    mileMarker: 26.2,
    heroImage: img("photo-1600607687920-4e2a09cf159d"),
    tagline: "Golf-course estates and Mizner-era Mediterranean revival.",
    overview:
      "Boca Raton pairs championship golf communities with the Mediterranean Revival architecture Addison Mizner brought to the coast a century ago. Buyers come for the schools and country-club lifestyle, and stay for the beach club access.",
    medianPrice: 2450000,
    walkScore: 35,
    highlights: ["Golf-course living", "Mizner architecture", "Top-ranked schools", "Beach club access"],
    images: [img("photo-1600566752229-250ed79470f8"), img("photo-1600607687644-c7171b42498b")],
  },
  {
    slug: "hillsboro-beach",
    name: "Hillsboro Beach",
    county: "Broward County",
    mileMarker: 18.9,
    heroImage: img("photo-1519046904884-53103b34b206"),
    tagline: "A barrier island of direct-oceanfront towers, one mile wide.",
    overview:
      "Hillsboro Beach occupies a slender barrier island between the ocean and the Intracoastal, meaning nearly every address here has water on at least one side. It's quieter and lower-density than its neighbors to the south.",
    medianPrice: 1320000,
    walkScore: 28,
    highlights: ["Direct oceanfront", "Low-density zoning", "Private beach access", "Intracoastal on both sides"],
    images: [img("photo-1520250497591-112f2f40a3f4"), img("photo-1505142468610-359e7d316be0")],
  },
  {
    slug: "wilton-manors",
    name: "Wilton Manors",
    county: "Broward County",
    mileMarker: 10.0,
    heroImage: img("photo-1570129477492-45c003edd2be"),
    tagline: "Walkable, welcoming, and threaded with no-fixed-bridge canals.",
    overview:
      "Wilton Manors packs a celebrated dining and nightlife strip along Wilton Drive into a two-square-mile city, with canal-front bungalows a short walk or boat ride from it all.",
    medianPrice: 875000,
    walkScore: 78,
    highlights: ["Wilton Drive dining", "No-fixed-bridge canals", "Bike-friendly grid", "Strong community events"],
    images: [img("photo-1600566752355-35792bedcfea"), img("photo-1600585154340-be6161a56a0c")],
  },
  {
    slug: "lauderdale-by-the-sea",
    name: "Lauderdale-by-the-Sea",
    county: "Broward County",
    mileMarker: 12.4,
    heroImage: img("photo-1499793983690-e29da59ef1c2"),
    tagline: "A low-rise beach town built around its own fishing pier.",
    overview:
      "Height restrictions have kept Lauderdale-by-the-Sea a low-rise beach town while everything around it grew taller. The Anglin's Fishing Pier and Commercial Boulevard corridor anchor a walkable, golf-cart-friendly core.",
    medianPrice: 1150000,
    walkScore: 68,
    highlights: ["Height-restricted skyline", "Anglin's Fishing Pier", "Golf-cart friendly", "Snorkeling reef offshore"],
    images: [img("photo-1477518518651-ea9bf8f2e35a"), img("photo-1444927714506-8492d94b5ba0")],
  },
];

export async function getAllCommunities(): Promise<Community[]> {
  return [...COMMUNITIES].sort((a, b) => a.mileMarker - b.mileMarker);
}

export async function getCommunityBySlug(slug: string): Promise<Community | undefined> {
  return COMMUNITIES.find((c) => c.slug === slug);
}
