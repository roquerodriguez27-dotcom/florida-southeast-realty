import type { Metadata } from "next";
import Link from "next/link";
import PropertyFilters from "@/components/PropertyFilters";
import PropertyGrid from "@/components/PropertyGrid";
import SampleDataNotice from "@/components/SampleDataNotice";
import LeadForm from "@/components/LeadForm";
import { searchListings } from "@/lib/listings";
import { IDX_PROVIDER } from "@/lib/idx";
import SavedSearchAlert from "@/components/SavedSearchAlert";

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
  }>;
}

export default async function PropertiesPage({ searchParams }: Props) {
  const params = await searchParams;

  const listings = await searchListings({
    q: params.q,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    beds: params.beds ? Number(params.beds) : undefined,
    propertyType: params.type as never,
    waterfrontOnly: params.waterfront === "1",
  });

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Property Search</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink mb-4">
          {idxLive ? `${listings.length} ${listings.length === 1 ? "home" : "homes"} found` : "South Florida home search"}
        </h1>
        <p className="text-ink/60 max-w-2xl mb-7">
          Search by city, community, address, price, property type, bedrooms, and waterfront status.
          The live BeachesMLS feed will power this experience once the broker API connection is approved and activated.
        </p>

        {!idxLive && (
          <div className="mb-6 bg-brass/10 border border-brass/30 rounded-sm p-5">
            <p className="font-medium text-ink">Live MLS connection in progress</p>
            <p className="text-sm text-ink/65 mt-1">
              Preview deployments may show clearly labeled demonstration properties so we can test the search experience. Production will never publish demonstration inventory as real listings.
            </p>
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

        {!idxLive && listings.length > 0 && <div className="mb-6"><SampleDataNotice variant="listings" /></div>}

        {listings.length > 0 ? (
          <PropertyGrid listings={listings} />
        ) : (
          <div className="bg-white border border-ink/10 rounded-sm p-7 md:p-10">
            <h2 className="font-display text-2xl text-ink">Tell us what you want to find</h2>
            <p className="text-sm text-ink/65 mt-2 max-w-2xl">
              While the new site&apos;s live IDX connection is being finalized, Florida Southeast Realty can search current inventory directly for you.
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
