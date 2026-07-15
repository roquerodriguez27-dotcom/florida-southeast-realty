import type { Metadata } from "next";
import PropertyFilters from "@/components/PropertyFilters";
import PropertyGrid from "@/components/PropertyGrid";
import SampleDataNotice from "@/components/SampleDataNotice";
import LeadForm from "@/components/LeadForm";
import { searchListings } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Homes for Sale | South Florida Waterfront & Luxury Listings",
  description:
    "Search waterfront, condo, and single-family listings across Fort Lauderdale, Boca Raton, Delray Beach, West Palm Beach, and the rest of South Florida's coastal corridor.",
  alternates: { canonical: "/properties" },
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
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Search</p>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-4">
          {listings.length} {listings.length === 1 ? "home" : "homes"} across South Florida
        </h1>

        <div className="mb-6">
          <SampleDataNotice variant="listings" />
        </div>

        <div className="mb-10">
          <PropertyFilters current={params} />
        </div>

        <PropertyGrid listings={listings} />

        <div className="mt-20 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="font-display text-2xl text-ink mb-3">Don&apos;t see the right fit yet?</h2>
            <p className="text-ink/65 max-w-md">
              Tell us what you&apos;re after — price range, community, must-haves — and an agent
              will reach out as soon as something matching comes on the market or off-market.
            </p>
          </div>
          <LeadForm
            formName="buyer-inquiry"
            submitLabel="Notify Me"
            successMessage="An agent will follow up as soon as a match comes available."
            fields={[
              { name: "name", label: "Name", type: "text", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel" },
              { name: "criteria", label: "What are you looking for?", type: "textarea", required: true, placeholder: "e.g. 4bd waterfront under $2.5M in Coral Ridge or Wilton Manors", colSpan: 2 },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
