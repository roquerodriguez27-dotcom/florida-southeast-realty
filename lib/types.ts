export type ListingStatus = "Active" | "Pending" | "Sold" | "Coming Soon";

export type ListingSort =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "sqft-desc"
  | "sqft-asc"
  | "lot-desc"
  | "dom-asc"
  | "dom-desc";

export const LISTING_AMENITIES = [
  "spa",
  "boat-dock",
  "impact-windows",
  "horse-property",
  "community-pool",
  "gated-community",
  "golf-community",
  "clubhouse",
  "fitness-center",
  "pickleball",
  "tennis",
] as const;

export type ListingAmenity = (typeof LISTING_AMENITIES)[number];

export type PropertyType =
  | "Single Family"
  | "Condo"
  | "Townhome"
  | "Estate"
  | "Multi-Family"
  | "Land"
  | "Commercial"
  | "Other";

export interface IdxLogo {
  type: "Uri" | "Text";
  value: string;
}

export interface IdxAttribution {
  provider: "RESO";
  mlsId?: string;
  mlsName?: string;
  view: "Summary" | "Detail";
  disclaimer?: string;
  logo?: IdxLogo;
  requiredFields: Array<{ label: string; value: string }>;
}

export interface Listing {
  /** MLS number — passthrough field from the IDX/RESO feed, never generated client-side */
  mlsId: string;
  /** RESO ListingKey, used to retrieve the detail view. */
  listingKey?: string;
  slug: string;
  status: ListingStatus;
  price: number;
  address: string;
  community: string;
  communitySlug: string;
  city: string;
  zip: string;
  beds: number;
  baths: number;
  halfBaths?: number;
  sqft: number;
  lotSqft?: number;
  yearBuilt: number;
  waterfront: boolean;
  privatePool: boolean;
  garageSpaces?: number;
  newConstruction?: boolean;
  seniorCommunity?: boolean;
  /** Whether the MLS explicitly identifies a homeowner association. */
  association?: boolean;
  /** Recurring association fees normalized to a monthly amount. */
  associationFeeMonthly?: number;
  fireplace?: boolean;
  /** Normalized amenity tags derived from MLS property and association fields. */
  amenities?: ListingAmenity[];
  propertyType: PropertyType;
  /** True when the MLS broad property type identifies a lease or rental listing. */
  forLease?: boolean;
  images: string[];
  description: string;
  features: string[];
  lat: number;
  lng: number;
  /** Distance marker along the coast, in the same convention as A1A mile markers */
  mileMarker: number;
  daysOnMarket: number;
  listingUpdatedAt?: string;
  idx?: IdxAttribution;
  agent: { name: string; phone: string; email: string };
}

export interface ListingFilters {
  q?: string;
  locations?: string[];
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  minSqft?: number;
  maxSqft?: number;
  minLotSqft?: number;
  maxLotSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  listingStatus?: "active" | "coming-soon" | "under-contract";
  propertyType?: PropertyType;
  waterfrontOnly?: boolean;
  privatePoolOnly?: boolean;
  garageOnly?: boolean;
  minGarageSpaces?: number;
  newConstructionOnly?: boolean;
  seniorCommunityMode?: "exclude" | "only";
  noHoaOnly?: boolean;
  maxHoaMonthly?: number;
  fireplaceOnly?: boolean;
  amenities?: ListingAmenity[];
  maxDaysOnMarket?: number;
  sort?: ListingSort;
  community?: string;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  polygon?: Array<{
    lat: number;
    lng: number;
  }>;
}

export interface ListingSearchPage {
  listings: Listing[];
  live: boolean;
  unavailable: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRows: number;
    totalRowsExact?: boolean;
  };
}

export interface Community {
  slug: string;
  name: string;
  county: string;
  mileMarker: number;
  heroImage: string;
  heroImageAlt: string;
  heroImageCredit: {
    author: string;
    sourceUrl: string;
    license: string;
    licenseUrl?: string;
  };
  tagline: string;
  overview: string;
  medianPrice: number;
  walkScore?: number;
  highlights: string[];
  images: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  quote: string;
  rating: number;
  transactionType: "Buyer" | "Seller" | "Buyer & Seller";
}

export interface GuideArticle {
  slug: string;
  title: string;
  dek: string;
  category: string;
  readMinutes: number;
  image: string;
  publishedAt: string;
  body: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  dek: string;
  category: string;
  image: string;
  publishedAt: string;
  author: string;
  body: string[];
}
