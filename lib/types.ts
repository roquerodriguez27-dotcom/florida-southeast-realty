export type ListingStatus = "Active" | "Pending" | "Sold" | "Coming Soon";

export interface Listing {
  /** MLS number — passthrough field from the IDX/RESO feed, never generated client-side */
  mlsId: string;
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
  propertyType: "Single Family" | "Condo" | "Townhome" | "Estate";
  images: string[];
  description: string;
  features: string[];
  lat: number;
  lng: number;
  /** Distance marker along the coast, in the same convention as A1A mile markers */
  mileMarker: number;
  daysOnMarket: number;
  agent: { name: string; phone: string; email: string };
}

export interface Community {
  slug: string;
  name: string;
  county: string;
  mileMarker: number;
  heroImage: string;
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
