import type { Metadata } from "next";
import Link from "next/link";
import PropertyFilters from "@/components/PropertyFilters";
import PropertyGrid from "@/components/PropertyGrid";
import SampleDataNotice from "@/components/SampleDataNotice";
import LeadForm from "@/components/LeadForm";
import { searchListingPage } from "@/lib/listings";
import { IDX_PROVIDER } from "@/lib/idx";
import SavedSearchAlert from "@/components/SavedSearchAlert";
import { IdxPageDisclaimer } from "@/components/IdxAttribution";
import type { PropertyType } from "@/lib/types";

const idxLive = IDX_PROVIDER !== "not_connected";

export const metadata: Metadata = {
  title: "South Florida Homes for Sale | Property Search",
  description:
    "Search South Florida homes, condos, waterfront properties, and single-family listings across Broward and Palm Beach counties.",
  alternates: { canonical: "/properties" },
  robots: { index: idxLive, follow: true },
};

interface Props {
  searchParams: Promise<{
    q?: string;
    location?: string | string[];
    minPrice?: string;
    maxPrice?: string;
    beds?: string;
    type?: string;
    waterfront?: string;
    page?: string;
  }>;
}

const PROPERTY_TYPES: PropertyType[] = ["Single Family", "Condo", "Townhome", "Estate", "Multi-Family", "Land", "Commercial", "Other"];

function propertyType(value?: string): PropertyType | undefined {
  return PROPERTY_TYPES.includes(value as PropertyType) ? value as PropertyType : undefined;
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
      if (locations.length === 5) return locations;
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

  const result = await searchListingPage({
    q: propertyQuery,
    locations,
    minPrice: optionalNonNegativeNumber(params.minPrice),
    maxPrice: optionalNonNegativeNumber(params.maxPrice),
    beds: optionalPositiveInteger(params.beds),
    propertyType: propertyType(params.type),
    waterfrontOnly: params.waterfront === "1",
  }, optionalPositiveInteger(params.page) ?? 1);
  const { listings } = result;
  const addressQuery = looksLikeStreetAddress(propertyQuery) ? propertyQuery : undefined;
  const hasSecondaryFilters = Boolean(
    locations.length > 0 || params.minPrice || params.maxPrice || params.beds || params.type || params.waterfront === "1",
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
              ? `${result.pagination.totalRows.toLocaleString()} ${result.pagination.totalRows === 1 ? "home" : "homes"} found`
              : "South Florida home search"}
        </h1>
        <p className="text-ink/60 max-w-2xl mb-7">
          Search current for-sale inventory across one or several cities or communities, then narrow by address, price, property type, bedrooms, and waterfront status.
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

        <div className="mb-10"><PropertyFilters current={{
          locations,
          q: propertyQuery,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          beds: params.beds,
          type: params.type,
          waterfront: params.waterfront,
        }} /></div>

        <div className="mb-8"><SavedSearchAlert criteria={{
          locations: locations.length > 0 ? locations.join(", ") : undefined,
          q: propertyQuery,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          beds: params.beds,
          propertyType: params.type,
          waterfrontOnly: params.waterfront === "1",
        }} /></div>

        <div className="mb-8">
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
            <PropertyGrid listings={listings} />
            <IdxPageDisclaimer attribution={listings[0]?.idx} />
            {result.pagination.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Listing results pages">
                {result.pagination.page > 1 ? <Link href={pageHref(params, result.pagination.page - 1)} className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5">Previous</Link> : <span />}
                <span className="text-sm text-ink/55">Page {result.pagination.page} of {result.pagination.totalPages}</span>
                {result.pagination.page < result.pagination.totalPages ? <Link href={pageHref(params, result.pagination.page + 1)} className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5">Next</Link> : <span />}
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
            <Link href="/contact" className="inline-block mt-5 bg-hibiscus text-sand font-medium px-5 py-3 rounded-sm">Start a property search</Link>
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
