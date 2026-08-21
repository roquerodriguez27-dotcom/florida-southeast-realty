export type ListingStatus = "Active" | "Pending" | "Sold" | "Coming Soon";

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
  propertyType: PropertyType;
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
  propertyType?: PropertyType;
  waterfrontOnly?: boolean;
  privatePoolOnly?: boolean;
  community?: string;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
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
