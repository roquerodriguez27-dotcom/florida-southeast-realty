import type { Listing } from "./types";
import { fetchLiveListings } from "./idx";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

export const LISTINGS: Listing[] = [
  {
    mlsId: "A11542091",
    slug: "18-lagoon-point-lauderdale-by-the-sea",
    status: "Active",
    price: 4250000,
    address: "18 Lagoon Point",
    community: "Lauderdale-by-the-Sea",
    communitySlug: "lauderdale-by-the-sea",
    city: "Lauderdale-by-the-Sea",
    zip: "33308",
    beds: 5,
    baths: 5,
    halfBaths: 1,
    sqft: 5420,
    lotSqft: 8100,
    yearBuilt: 2021,
    waterfront: true,
    propertyType: "Estate",
    images: [
      img("photo-1613977257363-707ba9348227"),
      img("photo-1600596542815-ffad4c1539a9"),
      img("photo-1600607687939-ce8a6c25118c"),
    ],
    description:
      "A deepwater estate on a protected lagoon two minutes from the inlet, built for a serious yacht and designed to disappear into the mangrove line at dusk.",
    features: ["90ft deepwater dock", "Impact glass throughout", "Rooftop terrace", "Chef's kitchen", "Smart home"],
    lat: 26.1897,
    lng: -80.0989,
    mileMarker: 12.4,
    daysOnMarket: 14,
    agent: { name: "Marisol Vega", phone: "(954) 555-0142", email: "marisol@floridasoutheastrealty.com" },
  },
  {
    mlsId: "A11538820",
    slug: "penthouse-4a-las-olas-residences",
    status: "Active",
    price: 2890000,
    address: "215 Las Olas Blvd, PH 4A",
    community: "Las Olas",
    communitySlug: "las-olas",
    city: "Fort Lauderdale",
    zip: "33301",
    beds: 3,
    baths: 3,
    sqft: 2640,
    yearBuilt: 2019,
    waterfront: true,
    propertyType: "Condo",
    images: [
      img("photo-1512917774080-9991f1c4c750"),
      img("photo-1512918728675-ed5a9ecdebfd"),
      img("photo-1502672260266-1c1ef2d93688"),
    ],
    description:
      "A corner penthouse above the New River with a wraparound terrace built for sunset, steps from the restaurant row on Las Olas.",
    features: ["Wraparound terrace", "Marina views", "Private elevator foyer", "2 assigned garage spaces"],
    lat: 26.1195,
    lng: -80.1373,
    mileMarker: 8.1,
    daysOnMarket: 6,
    agent: { name: "Colin Hartwell", phone: "(954) 555-0177", email: "colin@floridasoutheastrealty.com" },
  },
  {
    mlsId: "F10441726",
    slug: "212-coral-ridge-drive",
    status: "Active",
    price: 1975000,
    address: "212 Coral Ridge Drive",
    community: "Coral Ridge",
    communitySlug: "coral-ridge",
    city: "Fort Lauderdale",
    zip: "33305",
    beds: 4,
    baths: 3,
    sqft: 3180,
    lotSqft: 9500,
    yearBuilt: 1962,
    waterfront: false,
    propertyType: "Single Family",
    images: [
      img("photo-1568605114967-8130f3a36994"),
      img("photo-1600585154340-be6161a56a0c"),
      img("photo-1600566753086-00f18fb6b3ea"),
    ],
    description:
      "A fully reimagined mid-century on one of Coral Ridge's widest lots, original terrazzo restored beneath a new open plan.",
    features: ["Restored terrazzo", "Saltwater pool", "Impact windows", "Detached studio"],
    lat: 26.1478,
    lng: -80.1275,
    mileMarker: 9.6,
    daysOnMarket: 21,
    agent: { name: "Marisol Vega", phone: "(954) 555-0142", email: "marisol@floridasoutheastrealty.com" },
  },
  {
    mlsId: "A11529904",
    slug: "boca-raton-estates-golf-villa",
    status: "Pending",
    price: 3150000,
    address: "4488 Camino Real",
    community: "Boca Raton Estates",
    communitySlug: "boca-raton",
    city: "Boca Raton",
    zip: "33432",
    beds: 4,
    baths: 4,
    halfBaths: 1,
    sqft: 4210,
    lotSqft: 12000,
    yearBuilt: 2016,
    waterfront: false,
    propertyType: "Single Family",
    images: [
      img("photo-1600047509807-ba8f99d2cdde"),
      img("photo-1600210492486-724fe5c67fb0"),
      img("photo-1600585152915-d208bec867a1"),
    ],
    description:
      "A golf-course villa on the 14th fairway with a summer kitchen built for year-round outdoor living.",
    features: ["14th fairway views", "Summer kitchen", "Wine room", "3-car garage"],
    lat: 26.3543,
    lng: -80.0831,
    mileMarker: 26.2,
    daysOnMarket: 33,
    agent: { name: "Devon Ashford", phone: "(561) 555-0118", email: "devon@floridasoutheastrealty.com" },
  },
  {
    mlsId: "A11517220",
    slug: "hillsboro-mile-oceanfront-condo",
    status: "Active",
    price: 1450000,
    address: "1580 Hillsboro Mile, #12B",
    community: "Hillsboro Beach",
    communitySlug: "hillsboro-beach",
    city: "Hillsboro Beach",
    zip: "33062",
    beds: 2,
    baths: 2,
    sqft: 1820,
    yearBuilt: 2005,
    waterfront: true,
    propertyType: "Condo",
    images: [
      img("photo-1580587771525-78b9dba3b914"),
      img("photo-1522708323590-d24dbb6b0267"),
      img("photo-1493809842364-78817add7ffb"),
    ],
    description:
      "Direct oceanfront on the Mile, floor-to-ceiling glass facing due east for sunrise over open water every morning.",
    features: ["Direct oceanfront", "Floor-to-ceiling glass", "24hr concierge", "Private beach access"],
    lat: 26.2814,
    lng: -80.0810,
    mileMarker: 18.9,
    daysOnMarket: 9,
    agent: { name: "Colin Hartwell", phone: "(954) 555-0177", email: "colin@floridasoutheastrealty.com" },
  },
  {
    mlsId: "F10438651",
    slug: "wilton-manors-canal-bungalow",
    status: "Coming Soon",
    price: 895000,
    address: "2214 NE 8th Ave",
    community: "Wilton Manors",
    communitySlug: "wilton-manors",
    city: "Wilton Manors",
    zip: "33305",
    beds: 3,
    baths: 2,
    sqft: 1740,
    lotSqft: 6500,
    yearBuilt: 1968,
    waterfront: true,
    propertyType: "Single Family",
    images: [
      img("photo-1570129477492-45c003edd2be"),
      img("photo-1584622650111-993a426fbf0a"),
      img("photo-1600566752355-35792bedcfea"),
    ],
    description:
      "A canal-front bungalow with a private dock, minutes to the Drive's restaurant row by boat or bike.",
    features: ["Private dock", "No fixed bridges to the ICW", "Updated kitchen", "Fenced yard"],
    lat: 26.1553,
    lng: -80.1445,
    mileMarker: 10.0,
    daysOnMarket: 0,
    agent: { name: "Devon Ashford", phone: "(561) 555-0118", email: "devon@floridasoutheastrealty.com" },
  },
];

export async function getAllListings(): Promise<Listing[]> {
  const live = await fetchLiveListings();
  return live ?? LISTINGS;
}

export async function getListingBySlug(slug: string): Promise<Listing | undefined> {
  const all = await getAllListings();
  return all.find((l) => l.slug === slug);
}

export interface ListingFilters {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  propertyType?: Listing["propertyType"];
  waterfrontOnly?: boolean;
  community?: string;
}

export async function searchListings(filters: ListingFilters): Promise<Listing[]> {
  const all = await getAllListings();
  return all.filter((l) => {
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (
        !l.address.toLowerCase().includes(q) &&
        !l.city.toLowerCase().includes(q) &&
        !l.community.toLowerCase().includes(q) &&
        !l.zip.includes(q)
      )
        return false;
    }
    if (filters.minPrice && l.price < filters.minPrice) return false;
    if (filters.maxPrice && l.price > filters.maxPrice) return false;
    if (filters.beds && l.beds < filters.beds) return false;
    if (filters.propertyType && l.propertyType !== filters.propertyType) return false;
    if (filters.waterfrontOnly && !l.waterfront) return false;
    if (filters.community && l.communitySlug !== filters.community) return false;
    return true;
  });
}
