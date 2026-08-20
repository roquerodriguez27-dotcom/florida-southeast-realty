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

function pageHref(params: Awaited<Props["searchParams"]>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") query.set(key, value);
  }
  query.set("page", String(page));
  return `/properties?${query.toString()}`;
}

export default async function PropertiesPage({ searchParams }: Props) {
  const params = await searchParams;

  const result = await searchListingPage({
    q: params.q,
    minPrice: optionalNonNegativeNumber(params.minPrice),
    maxPrice: optionalNonNegativeNumber(params.maxPrice),
    beds: optionalPositiveInteger(params.beds),
    propertyType: propertyType(params.type),
    waterfrontOnly: params.waterfront === "1",
  }, optionalPositiveInteger(params.page) ?? 1);
  const { listings } = result;

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Property Search</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink mb-4">
          {result.live && !result.unavailable ? `${result.pagination.totalRows.toLocaleString()} ${result.pagination.totalRows === 1 ? "home" : "homes"} found` : "South Florida home search"}
        </h1>
        <p className="text-ink/60 max-w-2xl mb-7">
          Search by city, community, address, price, property type, bedrooms, and waterfront status.
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

        <div className="mb-10"><PropertyFilters current={params} /></div>

        <div className="mb-8"><SavedSearchAlert criteria={{
          q: params.q,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          beds: params.beds,
          propertyType: params.type,
          waterfrontOnly: params.waterfront === "1",
        }} /></div>

        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/buyer-tools?tool=compare" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5 transition-colors">Compare homes</Link>
          <Link href="/buyer-tools?tool=affordability" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5 transition-colors">Check affordability</Link>
          <Link href="/buyer-tools?tool=cost" className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5 transition-colors">Estimate true monthly cost</Link>
        </div>

        {!result.live && listings.length > 0 && <div className="mb-6"><SampleDataNotice variant="listings" /></div>}

        {listings.length > 0 ? (
          <>
            <PropertyGrid listings={listings} />
            <IdxPageDisclaimer attribution={listings[0]?.idx} />
            {result.pagination.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Listing results pages">
                {result.pagination.page > 1 ? <Link href={pageHref(params, result.pagination.page - 1)} className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5">Previous</Link> : <span />}
                <span className="text-sm text-ink/55">Page {result.pagination.page} of {result.pagination.totalPages}</span>
                {result.pagination.page < result.pagination.totalPages ? <Link href={pageHref(params, result.pagination.page + 1)} className="border border-tide/25 text-tide font-medium px-4 py-2.5 rounded-sm hover:bg-tide/5">Next</Link> : <span />}
              </nav>
            )}
          </>
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
