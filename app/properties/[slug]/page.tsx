import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAllListings, getListingBySlug } from "@/lib/listings";
import { formatFullPrice, formatMileMarker } from "@/lib/format";
import Tideline from "@/components/Tideline";
import PropertyGrid from "@/components/PropertyGrid";
import SampleDataNotice from "@/components/SampleDataNotice";
import LeadForm from "@/components/LeadForm";
import { searchListings } from "@/lib/listings";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const listings = await getAllListings();
  return listings.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return {};
  return {
    title: `${listing.address}, ${listing.city} | ${formatFullPrice(listing.price)}`,
    description: listing.description,
    alternates: { canonical: `/properties/${listing.slug}` },
    openGraph: { images: [listing.images[0]] },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const similar = (await searchListings({ community: listing.communitySlug }))
    .filter((l) => l.slug !== listing.slug)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.address,
    description: listing.description,
    url: `https://www.floridasoutheastrealty.com/properties/${listing.slug}`,
    image: listing.images,
    address: {
      "@type": "PostalAddress",
      streetAddress: listing.address,
      addressLocality: listing.city,
      addressRegion: "FL",
      postalCode: listing.zip,
    },
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "USD",
      availability: listing.status === "Active" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
    },
  };

  return (
    <div className="pt-16 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-1 h-[46vh] md:h-[64vh]">
        <div className="relative md:col-span-2 md:row-span-2">
          <Image src={listing.images[0]} alt={listing.address} fill sizes="50vw" className="object-cover" priority />
        </div>
        {listing.images.slice(1, 3).map((src, i) => (
          <div key={i} className="relative hidden md:block">
            <Image src={src} alt={`${listing.address} photo ${i + 2}`} fill sizes="25vw" className="object-cover" />
          </div>
        ))}
      </div>

      <div className="container-fsre mt-6">
        <SampleDataNotice variant="listings" />
      </div>

      <div className="container-fsre mt-6 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm bg-seagrass text-sand">
              {listing.status}
            </span>
            {listing.waterfront && (
              <span className="text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm bg-tide text-sand">
                Waterfront
              </span>
            )}
            <span className="mile-marker text-xs text-ink/40">{formatMileMarker(listing.mileMarker)}</span>
          </div>

          <h1 className="font-display text-3xl md:text-4xl text-ink">{listing.address}</h1>
          <p className="text-ink/60 mt-1">{listing.community}, {listing.city}, FL {listing.zip}</p>
          <p className="font-display text-3xl text-tide mt-4">{formatFullPrice(listing.price)}</p>

          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-6 py-5 border-y border-ink/10 font-mono text-sm text-ink/80">
            <span>{listing.beds} beds</span>
            <span>{listing.baths} baths{listing.halfBaths ? ` + ${listing.halfBaths} half` : ""}</span>
            <span>{listing.sqft.toLocaleString()} sqft</span>
            {listing.lotSqft && <span>{listing.lotSqft.toLocaleString()} sqft lot</span>}
            <span>Built {listing.yearBuilt}</span>
            <span>MLS# {listing.mlsId}</span>
          </div>

          <p className="text-ink/80 leading-relaxed mt-6">{listing.description}</p>

          <h2 className="font-display text-xl text-ink mt-8 mb-3">Features</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-ink/75">
            {listing.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-hibiscus shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Tideline label={`${listing.lat.toFixed(4)}, ${listing.lng.toFixed(4)}`} />
          </div>
        </div>

        {/* Agent / inquiry card */}
        <aside className="lg:col-span-1">
          <div className="bg-white border border-ink/10 rounded-sm p-6 sticky top-28">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50 mb-1">Listing Agent</p>
            <p className="font-display text-xl text-ink">{listing.agent.name}</p>
            <a href={`tel:${listing.agent.phone.replace(/[^\d+]/g, "")}`} className="block text-sm text-tide mt-1">
              {listing.agent.phone}
            </a>

            <div className="mt-5">
              <LeadForm
                formName="property-inquiry"
                submitLabel="Request a Showing"
                successMessage={`A Florida Southeast Realty agent will follow up about ${listing.address} shortly.`}
                hiddenContext={{ listingAddress: listing.address, mlsId: listing.mlsId }}
                fields={[
                  { name: "name", label: "Your Name", type: "text", required: true },
                  { name: "email", label: "Your Email", type: "email", required: true },
                  { name: "phone", label: "Phone", type: "tel" },
                  {
                    name: "message",
                    label: "Message",
                    type: "textarea",
                    defaultValue: `I'd like more information about ${listing.address}.`,
                  },
                ]}
              />
            </div>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <div className="container-fsre mt-20">
          <h2 className="font-display text-2xl text-ink mb-6">More in {listing.community}</h2>
          <PropertyGrid listings={similar} />
        </div>
      )}
    </div>
  );
}
