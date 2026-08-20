import type { Listing, ListingFilters, ListingSearchPage } from "./types";
import { fetchLiveListingBySlug, fetchLiveListingPage } from "./idx";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

/**
 * Demonstration inventory used only on local development and Vercel preview deployments.
 * Production never falls back to these records. If the live IDX feed is not configured,
 * production returns an empty listing set instead of showing invented homes or agents.
 */
export const LISTINGS: Listing[] = [
  {
    mlsId: "DEMO-001",
    slug: "demo-waterfront-home-lauderdale-by-the-sea",
    status: "Active",
    price: 4250000,
    address: "Demonstration Waterfront Home",
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
    images: [img("photo-1613977257363-707ba9348227"), img("photo-1600596542815-ffad4c1539a9"), img("photo-1600607687939-ce8a6c25118c")],
    description: "Demonstration listing used to test the design before the live MLS feed is connected.",
    features: ["Demonstration data", "Waterfront example", "Preview only"],
    lat: 26.1897,
    lng: -80.0989,
    mileMarker: 12.4,
    daysOnMarket: 14,
    agent: { name: "Florida Southeast Realty", phone: "(973) 985-6011", email: "roque@floridasoutheastrealty.com" },
  },
  {
    mlsId: "DEMO-002",
    slug: "demo-las-olas-condo",
    status: "Active",
    price: 2890000,
    address: "Demonstration Las Olas Condo",
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
    images: [img("photo-1512917774080-9991f1c4c750"), img("photo-1512918728675-ed5a9ecdebfd"), img("photo-1502672260266-1c1ef2d93688")],
    description: "Demonstration listing used to test search, cards, and property-page layouts before live IDX activation.",
    features: ["Demonstration data", "Condo example", "Preview only"],
    lat: 26.1195,
    lng: -80.1373,
    mileMarker: 8.1,
    daysOnMarket: 6,
    agent: { name: "Florida Southeast Realty", phone: "(973) 985-6011", email: "roque@floridasoutheastrealty.com" },
  },
  {
    mlsId: "DEMO-003",
    slug: "demo-coral-ridge-home",
    status: "Active",
    price: 1975000,
    address: "Demonstration Coral Ridge Home",
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
    images: [img("photo-1568605114967-8130f3a36994"), img("photo-1600585154340-be6161a56a0c"), img("photo-1600566753086-00f18fb6b3ea")],
    description: "Demonstration listing used to test the preview experience before live IDX activation.",
    features: ["Demonstration data", "Single-family example", "Preview only"],
    lat: 26.1478,
    lng: -80.1275,
    mileMarker: 9.6,
    daysOnMarket: 21,
    agent: { name: "Florida Southeast Realty", phone: "(973) 985-6011", email: "roque@floridasoutheastrealty.com" },
  },
  {
    mlsId: "DEMO-004",
    slug: "demo-boca-raton-home",
    status: "Active",
    price: 3150000,
    address: "Demonstration Boca Raton Home",
    community: "Boca Raton",
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
    images: [img("photo-1600047509807-ba8f99d2cdde"), img("photo-1600210492486-724fe5c67fb0"), img("photo-1600585152915-d208bec867a1")],
    description: "Demonstration listing used to test the Boca Raton search experience before live MLS data is connected.",
    features: ["Demonstration data", "Single-family example", "Preview only"],
    lat: 26.3543,
    lng: -80.0831,
    mileMarker: 26.2,
    daysOnMarket: 33,
    agent: { name: "Florida Southeast Realty", phone: "(973) 985-6011", email: "roque@floridasoutheastrealty.com" },
  },
];

function canUseSampleListings() {
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview" || process.env.NEXT_PUBLIC_ENABLE_SAMPLE_DATA === "true";
}

export async function getAllListings(): Promise<Listing[]> {
  return (await searchListingPage()).listings;
}

export async function getListingBySlug(slug: string): Promise<Listing | undefined> {
  try {
    const live = await fetchLiveListingBySlug(slug);
    if (live) return live;
  } catch {
    return undefined;
  }

  return canUseSampleListings() ? LISTINGS.find((listing) => listing.slug === slug) : undefined;
}

function filterSampleListings(filters: ListingFilters): Listing[] {
  return LISTINGS.filter((l) => {
    if (filters.locations?.length) {
      const matchesLocation = filters.locations.some((location) => {
        const value = location.toLowerCase();
        return l.city.toLowerCase().includes(value)
          || l.community.toLowerCase().includes(value)
          || l.zip.includes(value);
      });
      if (!matchesLocation) return false;
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (
        !l.address.toLowerCase().includes(q) &&
        !l.city.toLowerCase().includes(q) &&
        !l.community.toLowerCase().includes(q) &&
        !l.zip.includes(q)
      ) return false;
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

export async function searchListingPage(filters: ListingFilters = {}, page = 1): Promise<ListingSearchPage> {
  try {
    const live = await fetchLiveListingPage(filters, page);
    if (live) return live;
  } catch {
    return {
      listings: [],
      live: true,
      unavailable: true,
      pagination: { page: 1, pageSize: 24, totalPages: 1, totalRows: 0 },
    };
  }

  const filtered = canUseSampleListings() ? filterSampleListings(filters) : [];
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);

  return {
    listings: filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    live: false,
    unavailable: false,
    pagination: {
      page: currentPage,
      pageSize,
      totalPages,
      totalRows: filtered.length,
    },
  };
}

export async function searchListings(filters: ListingFilters): Promise<Listing[]> {
  return (await searchListingPage(filters)).listings;
}
