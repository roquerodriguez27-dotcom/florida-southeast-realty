import type { Metadata } from "next";
import Link from "next/link";
import PropertyFilters from "@/components/PropertyFilters";
import PropertyGrid from "@/components/PropertyGrid";
import PropertyResultsView from "@/components/PropertyResultsView";
import AiPropertySearch from "@/components/AiPropertySearch";
import SampleDataNotice from "@/components/SampleDataNotice";
import LeadForm from "@/components/LeadForm";
import { searchListingPage } from "@/lib/listings";
import { IDX_PROVIDER } from "@/lib/idx";
import SavedSearchAlert from "@/components/SavedSearchAlert";
import { IdxPageDisclaimer } from "@/components/IdxAttribution";
import {
  LISTING_AMENITIES,
  LISTING_ARCHITECTURE_FILTERS,
  LISTING_COOLING_FILTERS,
  LISTING_HEATING_FILTERS,
  LISTING_VIEW_FILTERS,
  type ListingAmenity,
  type ListingSort,
  type PropertyType,
} from "@/lib/types";
import { MAX_SEARCH_LOCATIONS } from "@/lib/south-florida-locations";

const idxLive = IDX_PROVIDER !== "not_connected";

interface Props {
  searchParams: Promise<{
    q?: string;
    location?: string | string[];
    minPrice?: string;
    maxPrice?: string;
    beds?: string;
    baths?: string;
    minSqft?: string;
    maxSqft?: string;
    minLotSqft?: string;
    maxLotSqft?: string;
    minYearBuilt?: string;
    maxYearBuilt?: string;
    listingStatus?: string;
    type?: string;
    waterfront?: string;
    pool?: string;
    garage?: string;
    garageSpaces?: string;
    newConstruction?: string;
    senior?: string;
    noHoa?: string;
    maxHoa?: string;
    priceReduced?: string;
    maxTaxes?: string;
    style?: string;
    viewType?: string;
    cooling?: string;
    heating?: string;
    fireplace?: string;
    amenity?: string | string[];
    maxDom?: string;
    newer?: string;
    spacious?: string;
    largeLot?: string;
    page?: string;
    north?: string;
    south?: string;
    east?: string;
    west?: string;
    view?: string;
    sort?: string;
    shape?: string;
  }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const filteredSearch = Object.entries(params).some(([key, value]) => (
    !key.startsWith("_")
    && (Array.isArray(value) ? value.some(Boolean) : Boolean(value))
  ));

  return {
    title: "South Florida Homes for Sale | Property Search",
    description:
      "Search South Florida homes, condos, waterfront properties, and single-family listings across Broward and Palm Beach counties.",
    alternates: { canonical: "/properties" },
    robots: { index: idxLive && !filteredSearch, follow: !filteredSearch },
  };
}

const PROPERTY_TYPES: PropertyType[] = ["Single Family", "Condo", "Townhome", "Estate", "Multi-Family", "Land", "Commercial", "Other"];
const LISTING_SORTS: ListingSort[] = [
  "newest",
  "price-asc",
  "price-desc",
  "sqft-desc",
  "sqft-asc",
  "lot-desc",
  "dom-asc",
  "dom-desc",
];

function propertyType(value?: string): PropertyType | undefined {
  return PROPERTY_TYPES.includes(value as PropertyType) ? value as PropertyType : undefined;
}

function listingSort(value?: string): ListingSort {
  return LISTING_SORTS.includes(value as ListingSort) ? value as ListingSort : "newest";
}

function seniorCommunityMode(value?: string): "exclude" | "only" | undefined {
  return value === "exclude" || value === "only" ? value : undefined;
}

function listingStatusMode(value?: string): "active" | "coming-soon" | "under-contract" | undefined {
  return value === "active" || value === "coming-soon" || value === "under-contract" ? value : undefined;
}

function supportedFilter<const Values extends readonly string[]>(
  values: Values,
  value?: string,
): Values[number] | undefined {
  return value && values.includes(value as Values[number]) ? value as Values[number] : undefined;
}

function listingAmenities(value?: string | string[]): ListingAmenity[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.filter((amenity): amenity is ListingAmenity => (
    LISTING_AMENITIES.includes(amenity as ListingAmenity)
  )))];
}

function optionalNonNegativeNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function optionalPositiveInteger(value?: string): number | undefined {
  const parsed = optionalNonNegativeNumber(value);
  return parsed !== undefined && parsed > 0 ? Math.floor(parsed) : undefined;
}

function mapBounds(params: Awaited<Props["searchParams"]>) {
  const north = Number(params.north);
  const south = Number(params.south);
  const east = Number(params.east);
  const west = Number(params.west);
  if (![north, south, east, west].every(Number.isFinite)) return undefined;
  if (north <= south || east <= west) return undefined;
  if (north > 90 || south < -90 || east > 180 || west < -180) return undefined;
  return { north, south, east, west };
}

function mapPolygon(value?: string): NonNullable<import("@/lib/types").ListingFilters["polygon"]> | undefined {
  if (!value?.trim() || value.length > 1200) return undefined;
  const points = value.split(";").slice(0, 20).map((pair) => {
    const [rawLat, rawLng] = pair.split(",");
    return { lat: Number(rawLat), lng: Number(rawLng) };
  });
  if (points.length < 3 || points.some(({ lat, lng }) => (
    !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180
  ))) return undefined;
  return points;
}

function polygonBounds(points: NonNullable<import("@/lib/types").ListingFilters["polygon"]>) {
  return {
    north: Math.max(...points.map((point) => point.lat)),
    south: Math.min(...points.map((point) => point.lat)),
    east: Math.max(...points.map((point) => point.lng)),
    west: Math.min(...points.map((point) => point.lng)),
  };
}

function looksLikeStreetAddress(value?: string): value is string {
  return Boolean(value?.trim() && /^\s*\d+[A-Za-z]?\s+\S+/.test(value));
}

function looksLikePropertyLookup(value?: string): value is string {
  if (!value) return false;
  return looksLikeStreetAddress(value)
    || /^\d{5}(?:-\d{4})?$/.test(value)
    || /^[A-Za-z]{1,5}\d{5,}$/.test(value);
}

function normalizeLocations(value?: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const locations: string[] = [];
  for (const item of values) {
    for (const part of item.split(/[,|]/)) {
      const location = part.trim().slice(0, 100);
      if (!location || locations.some((current) => current.toLowerCase() === location.toLowerCase())) continue;
      locations.push(location);
      if (locations.length === MAX_SEARCH_LOCATIONS) return locations;
    }
  }
  return locations;
}

function pageHref(params: Awaited<Props["searchParams"]>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || key === "page") continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item) query.append(key, item);
    }
  }
  query.set("page", String(page));
  return `/properties?${query.toString()}`;
}

function withoutMapBoundsHref(params: Awaited<Props["searchParams"]>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || ["north", "south", "east", "west", "shape", "page"].includes(key)) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item) query.append(key, item);
    }
  }
  return `/properties${query.size ? `?${query.toString()}` : ""}#property-results`;
}

export default async function PropertiesPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawQuery = params.q?.trim().slice(0, 200) || undefined;
  const requestedLocations = normalizeLocations(params.location);
  const propertyQuery = requestedLocations.length > 0 || looksLikePropertyLookup(rawQuery)
    ? rawQuery
    : undefined;
  const locations = requestedLocations.length > 0
    ? requestedLocations
    : propertyQuery
      ? []
      : normalizeLocations(rawQuery);
  const polygon = mapPolygon(params.shape);
  const bounds = polygon ? polygonBounds(polygon) : mapBounds(params);
  const sort = listingSort(params.sort);
  const minSqft = Math.max(optionalPositiveInteger(params.minSqft) ?? 0, params.spacious === "1" ? 2_000 : 0) || undefined;
  const minLotSqft = Math.max(optionalPositiveInteger(params.minLotSqft) ?? 0, params.largeLot === "1" ? 10_000 : 0) || undefined;
  const minYearBuilt = Math.max(optionalPositiveInteger(params.minYearBuilt) ?? 0, params.newer === "1" ? 2_020 : 0) || undefined;
  const minGarageSpaces = Math.max(optionalPositiveInteger(params.garageSpaces) ?? 0, params.garage === "1" ? 1 : 0) || undefined;
  const maxDaysOnMarket = optionalPositiveInteger(params.maxDom);
  const selectedSeniorCommunityMode = seniorCommunityMode(params.senior);
  const noHoaOnly = params.noHoa === "1";
  const maxHoaMonthly = optionalPositiveInteger(params.maxHoa);
  const priceReducedOnly = params.priceReduced === "1";
  const maxAnnualTaxes = optionalPositiveInteger(params.maxTaxes);
  const architecturalStyle = supportedFilter(LISTING_ARCHITECTURE_FILTERS, params.style);
  const viewType = supportedFilter(LISTING_VIEW_FILTERS, params.viewType);
  const coolingType = supportedFilter(LISTING_COOLING_FILTERS, params.cooling);
  const heatingType = supportedFilter(LISTING_HEATING_FILTERS, params.heating);
  const selectedListingStatus = listingStatusMode(params.listingStatus);
  const selectedAmenities = listingAmenities(params.amenity);

  const result = await searchListingPage({
    q: propertyQuery,
    locations,
    minPrice: optionalNonNegativeNumber(params.minPrice),
    maxPrice: optionalNonNegativeNumber(params.maxPrice),
    beds: optionalPositiveInteger(params.beds),
    baths: optionalPositiveInteger(params.baths),
    minSqft,
    maxSqft: optionalPositiveInteger(params.maxSqft),
    minLotSqft,
    maxLotSqft: optionalPositiveInteger(params.maxLotSqft),
    minYearBuilt,
    maxYearBuilt: optionalPositiveInteger(params.maxYearBuilt),
    listingStatus: selectedListingStatus,
    propertyType: propertyType(params.type),
    waterfrontOnly: params.waterfront === "1",
    privatePoolOnly: params.pool === "1",
    garageOnly: params.garage === "1",
    minGarageSpaces,
    newConstructionOnly: params.newConstruction === "1",
    seniorCommunityMode: selectedSeniorCommunityMode,
    noHoaOnly,
    maxHoaMonthly,
    priceReducedOnly,
    maxAnnualTaxes,
    architecturalStyle,
    viewType,
    coolingType,
    heatingType,
    fireplaceOnly: params.fireplace === "1",
    amenities: selectedAmenities,
    maxDaysOnMarket,
    bounds,
    polygon,
    sort,
  }, optionalPositiveInteger(params.page) ?? 1);
  const { listings } = result;
  const addressQuery = looksLikeStreetAddress(propertyQuery) ? propertyQuery : undefined;
  const hasSecondaryFilters = Boolean(
    locations.length > 0 || params.minPrice || params.maxPrice || params.beds || params.baths
      || params.minSqft || params.maxSqft || params.minLotSqft || params.maxLotSqft
      || params.minYearBuilt || params.maxYearBuilt || selectedListingStatus || params.type
      || params.waterfront === "1" || params.pool === "1" || params.garage === "1"
      || params.garageSpaces || params.newConstruction === "1" || selectedSeniorCommunityMode
      || noHoaOnly || maxHoaMonthly || priceReducedOnly || maxAnnualTaxes
      || architecturalStyle || viewType || coolingType || heatingType
      || params.fireplace === "1" || selectedAmenities.length > 0 || params.maxDom
      || params.newer === "1" || params.spacious === "1" || params.largeLot === "1" || bounds,
  );
  const noCurrentAddressListing = Boolean(
    addressQuery && !hasSecondaryFilters && result.live && !result.unavailable && listings.length === 0,
  );
  const valuationHref = addressQuery
    ? `/home-valuation?address=${encodeURIComponent(addressQuery)}`
    : "/home-valuation";

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Property Search</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink mb-4">
          {noCurrentAddressListing
            ? "This address is not currently listed"
            : result.live && !result.unavailable
              ? result.pagination.totalRowsExact === false
                ? `${result.pagination.totalRows.toLocaleString()} exact ${result.pagination.totalRows === 1 ? "match" : "matches"} on this page`
                : `${result.pagination.totalRows.toLocaleString()} ${result.pagination.totalRows === 1 ? "home" : "homes"} found`
              : "South Florida home search"}
        </h1>
        <p className="text-ink/60 max-w-2xl mb-7">
          Search current for-sale inventory across one or several areas, then narrow by price, size, property type, amenities, and map area.
          {result.live ? " Results are supplied by the live BeachesMLS feed through the RESO Web API." : " The secure RESO connection is being finalized following MLS approval."}
        </p>

        {!result.live && (
          <div className="mb-6 bg-brass/10 border border-brass/30 rounded-sm p-5">
            <p className="font-medium text-ink">Secure MLS activation in progress</p>
            <p className="text-sm text-ink/65 mt-1">
              Preview deployments may show clearly labeled demonstration properties so we can test the search experience. Production will never publish demonstration inventory as real listings.
            </p>
          </div>
        )}

        {result.unavailable && (
          <div className="mb-6 bg-hibiscus/5 border border-hibiscus/20 rounded-sm p-5" role="status">
            <p className="font-medium text-ink">Live listings are temporarily unavailable</p>
            <p className="text-sm text-ink/65 mt-1">Please try again shortly or contact Florida Southeast Realty for a current search.</p>
          </div>
        )}

        <div className="mb-4"><AiPropertySearch /></div>

        <div className="mb-5"><PropertyFilters current={{
          locations,
          q: propertyQuery,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          beds: params.beds,
          baths: params.baths,
          minSqft: params.minSqft,
          maxSqft: params.maxSqft,
          minLotSqft: params.minLotSqft,
          maxLotSqft: params.maxLotSqft,
          minYearBuilt: params.minYearBuilt,
          maxYearBuilt: params.maxYearBuilt,
          listingStatus: params.listingStatus,
          type: params.type,
          waterfront: params.waterfront,
          pool: params.pool,
          garage: params.garage,
          garageSpaces: params.garageSpaces,
          newConstruction: params.newConstruction,
          senior: selectedSeniorCommunityMode,
          noHoa: noHoaOnly ? "1" : undefined,
          maxHoa: maxHoaMonthly ? String(maxHoaMonthly) : undefined,
          priceReduced: priceReducedOnly ? "1" : undefined,
          maxTaxes: maxAnnualTaxes ? String(maxAnnualTaxes) : undefined,
          style: architecturalStyle,
          viewType,
          cooling: coolingType,
          heating: heatingType,
          fireplace: params.fireplace,
          amenities: selectedAmenities,
          maxDom: params.maxDom,
          bounds,
          shape: params.shape,
          view: params.view === "map" ? "map" : undefined,
          sort,
        }} /></div>

        <div className="mb-5"><SavedSearchAlert criteria={{
          locations: locations.length > 0 ? locations.join(", ") : undefined,
          q: propertyQuery,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          beds: params.beds,
          baths: params.baths,
          minSqft: minSqft ? String(minSqft) : undefined,
          maxSqft: params.maxSqft,
          minLotSqft: minLotSqft ? String(minLotSqft) : undefined,
          maxLotSqft: params.maxLotSqft,
          minYearBuilt: minYearBuilt ? String(minYearBuilt) : undefined,
          maxYearBuilt: params.maxYearBuilt,
          listingStatus: selectedListingStatus,
          propertyType: params.type,
          waterfrontOnly: params.waterfront === "1",
          privatePoolOnly: params.pool === "1",
          minGarageSpaces: minGarageSpaces ? String(minGarageSpaces) : undefined,
          newConstructionOnly: params.newConstruction === "1",
          seniorCommunity: selectedSeniorCommunityMode,
          noHoaOnly,
          maxHoaMonthly: maxHoaMonthly ? String(maxHoaMonthly) : undefined,
          priceReducedOnly,
          maxAnnualTaxes: maxAnnualTaxes ? String(maxAnnualTaxes) : undefined,
          architecturalStyle,
          viewType,
          coolingType,
          heatingType,
          fireplaceOnly: params.fireplace === "1",
          amenities: selectedAmenities.length > 0 ? selectedAmenities.join(", ") : undefined,
          maxDaysOnMarket: maxDaysOnMarket ? String(maxDaysOnMarket) : undefined,
          sort,
          mapArea: bounds
            ? `${bounds.south.toFixed(5)},${bounds.west.toFixed(5)} to ${bounds.north.toFixed(5)},${bounds.east.toFixed(5)}`
            : undefined,
        }} /></div>

        <div className="mb-6">
          <div className="flex flex-wrap gap-3">
            <a href="#property-results" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5 transition-colors">Select homes to compare</a>
            <Link href="/buyer-tools?tool=affordability" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5 transition-colors">Check affordability</Link>
            <Link href="/buyer-tools?tool=cost" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5 transition-colors">Estimate true monthly cost</Link>
          </div>
          {listings.length > 0 ? (
            <p className="mt-3 text-sm text-ink/55">Check “Compare this home” on up to three listings below. A Compare selected button will stay on screen while you choose.</p>
          ) : null}
        </div>

        {!result.live && listings.length > 0 && <div className="mb-6"><SampleDataNotice variant="listings" /></div>}

        {listings.length > 0 ? (
          <section id="property-results" className="scroll-mt-32" aria-label="Property search results">
            <PropertyResultsView
              listings={listings.map(({ slug, address, city, price, lat, lng, status, images }) => ({
                slug,
                address,
                city,
                price,
                lat,
                lng,
                status,
                image: images[0] || "/property-placeholder.svg",
              }))}
              locations={locations}
              initialView={params.view === "map" ? "map" : "list"}
              initialBounds={bounds}
              initialShape={polygon}
              initialSort={sort}
            >
              <PropertyGrid listings={listings} compact={params.view === "map"} />
            </PropertyResultsView>
            <IdxPageDisclaimer attribution={listings[0]?.idx} />
            {result.pagination.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Listing results pages">
                {result.pagination.page > 1 ? <Link href={pageHref(params, result.pagination.page - 1)} prefetch={false} rel="nofollow" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5">Previous</Link> : <span />}
                <span className="text-sm text-ink/55">
                  Page {result.pagination.page}
                  {result.pagination.totalRowsExact === false ? "" : ` of ${result.pagination.totalPages}`}
                </span>
                {result.pagination.page < result.pagination.totalPages ? <Link href={pageHref(params, result.pagination.page + 1)} prefetch={false} rel="nofollow" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5">Next</Link> : <span />}
              </nav>
            )}
          </section>
        ) : noCurrentAddressListing ? (
          <div className="bg-white border border-ink/10 rounded-sm p-7 md:p-10" role="status">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-hibiscus">Possibly off market</p>
            <h2 className="font-display text-2xl text-ink mt-2">No current listing was found for {addressQuery}</h2>
            <p className="text-sm text-ink/65 mt-3 max-w-2xl leading-relaxed">
              The live BeachesMLS feed returned no Active, Coming Soon, or Active Under Contract listing for this address. It may be off market rather than unavailable as a property. MLS coverage and address formatting can vary, so this result is not a legal determination of the home&apos;s status.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={valuationHref} className="inline-block bg-hibiscus text-sand font-medium px-5 py-3 rounded-sm">Research this off-market home</Link>
              <Link href="/properties" className="inline-block border border-tide/25 text-tide font-medium px-5 py-3 rounded-sm">Search another address</Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-ink/10 rounded-sm p-7 md:p-10">
            <h2 className="font-display text-2xl text-ink">Tell us what you want to find</h2>
            <p className="text-sm text-ink/65 mt-2 max-w-2xl">
              No matching homes are available in this search right now. Florida Southeast Realty can refine the criteria or watch for new inventory.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {bounds ? <Link href={withoutMapBoundsHref(params)} className="inline-block border border-tide/25 text-tide font-medium px-5 py-3 rounded-sm">Clear map area</Link> : null}
              <Link href="/contact" className="inline-block bg-hibiscus text-sand font-medium px-5 py-3 rounded-sm">Start a property search</Link>
            </div>
          </div>
        )}

        <div className="mt-20 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="font-display text-2xl text-ink mb-3">Want a more specific search?</h2>
            <p className="text-ink/65 max-w-md">
              Tell us your price range, preferred communities, must-haves, deal breakers, and timing. We&apos;ll use that criteria to narrow the search.
            </p>
          </div>
          <LeadForm
            formName="buyer-inquiry"
            submitLabel="Send My Criteria"
            successMessage="Florida Southeast Realty will follow up about your property criteria."
            fields={[
              { name: "name", label: "Name", type: "text", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel" },
              { name: "criteria", label: "What are you looking for?", type: "textarea", required: true, placeholder: "Example: 4 bedrooms, pool, under $1.2M in Boca Raton or Delray Beach", colSpan: 2 },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
