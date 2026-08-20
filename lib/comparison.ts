import type { Listing, PropertyType } from "@/lib/types";

export const MAX_COMPARE_LISTINGS = 3;

export interface SavedComparisonListing {
  slug: string;
  mlsId: string;
  address: string;
  city: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  halfBaths: number;
  sqft: number;
  yearBuilt: number;
  waterfront: boolean;
  propertyType: PropertyType;
}

export function savedComparisonListing(listing: Listing): SavedComparisonListing {
  return {
    slug: listing.slug,
    mlsId: listing.mlsId,
    address: listing.address,
    city: listing.city,
    zip: listing.zip,
    price: listing.price,
    beds: listing.beds,
    baths: listing.baths,
    halfBaths: listing.halfBaths ?? 0,
    sqft: listing.sqft,
    yearBuilt: listing.yearBuilt,
    waterfront: listing.waterfront,
    propertyType: listing.propertyType,
  };
}
