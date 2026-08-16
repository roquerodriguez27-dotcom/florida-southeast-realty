import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllListings, getListingBySlug, searchListings } from "@/lib/listings";
import { formatFullPrice } from "@/lib/format";
import Tideline from "@/components/Tideline";
import PropertyGrid from "@/components/PropertyGrid";
import SampleDataNotice from "@/components/SampleDataNotice";
import LeadForm from "@/components/LeadForm";
import ResearchLinks from "@/components/ResearchLinks";
import { IDX_PROVIDER } from "@/lib/idx";
import { SITE } from "@/lib/site-config";

interface Props {
  params: Promise<{ slug: string }>;
}

const idxLive = IDX_PROVIDER !== "not_connected";

export async function generateStaticParams() {
  const listings = await getAllListings();
  return listings.map((listing) => ({ slug: listing.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return {};
  return {
    title: `${listing.address}, ${listing.city} FL | ${formatFullPrice(listing.price)}`,
    description: listing.description,
    alternates: { canonical: `/properties/${listing.slug}` },
    openGraph: { images: [{ url: listing.images[0], alt: listing.address }] },
    robots: { index: idxLive, follow: true },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const similar = (await searchListings({ community: listing.communitySlug }))
    .filter((item) => item.slug !== listing.slug)
    .slice(0, 3);

  const jsonLd = idxLive
    ? {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        name: listing.address,
        description: listing.description,
        url: `${SITE.url}/properties/${listing.slug}`,
        image: listing.images,
        address: {
          "@type": "PostalAddress",
          streetAddress: listing.address,
          addressLocality: listing.city,
          addressRegion: "FL",
          postalCode: listing.zip,
          addressCountry: "US",
        },
        offers: {
          "@type": "Offer",
          price: listing.price,
          priceCurrency: "USD",
          availability: listing.status === "Active" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
        },
      }
    : null;

  return (
    <div className="pt-16 pb-20">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-1 h-[46vh] md:h-[64vh] bg-keystone-dim">
        <div className="relative md:col-span-2 md:row-span-2">
          <Image src={listing.images[0]} alt={listing.address} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" priority />
        </div>
        {listing.images.slice(1, 3).map((src, index) => (
          <div key={src} className="relative hidden md:block">
            <Image src={src} alt={`${listing.address} image ${index + 2}`} fill sizes="25vw" className="object-cover" />
          </div>
        ))}
      </div>

      {!idxLive && <div className="container-fsre mt-6"><SampleDataNotice variant="listings" /></div>}

      <div className="container-fsre mt-6 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm bg-seagrass text-sand">{listing.status}</span>
            {listing.waterfront && <span className="text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm bg-tide text-sand">Waterfront</span>}
            {!idxLive && <span className="text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm bg-brass/20 text-ink">Preview Demo</span>}
          </div>

          <h1 className="font-display text-3xl md:text-4xl text-ink">{listing.address}</h1>
          <p className="text-ink/60 mt-1">{listing.community}, {listing.city}, FL {listing.zip}</p>
          <p className="font-display text-3xl text-tide mt-4">{formatFullPrice(listing.price)}</p>

          <div className="flex flex-wrap gap-3 mt-5">
            <Link href={`/buyer-tools?listing=${listing.slug}&tool=cost`} className="bg-tide text-sand px-4 py-2.5 rounded-sm text-sm font-medium hover:bg-tide-light transition-colors">Calculate true monthly cost</Link>
            <Link href={`/buyer-tools?listing=${listing.slug}&tool=compare`} className="border border-tide/25 text-tide px-4 py-2.5 rounded-sm text-sm font-medium hover:bg-tide/5 transition-colors">Compare this home</Link>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-6 py-5 border-y border-ink/10 font-mono text-sm text-ink/80">
            <span>{listing.beds} beds</span>
            <span>{listing.baths} baths{listing.halfBaths ? ` + ${listing.halfBaths} half` : ""}</span>
            <span>{listing.sqft.toLocaleString()} sqft</span>
            {listing.lotSqft && <span>{listing.lotSqft.toLocaleString()} sqft lot</span>}
            <span>Built {listing.yearBuilt}</span>
            <span>{idxLive ? `MLS# ${listing.mlsId}` : listing.mlsId}</span>
          </div>

          <p className="text-ink/80 leading-relaxed mt-6">{listing.description}</p>

          <h2 className="font-display text-xl text-ink mt-8 mb-3">Property details</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-ink/75">
            {listing.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-hibiscus shrink-0" />{feature}
              </li>
            ))}
          </ul>

          <div className="mt-10"><Tideline label={`${listing.lat.toFixed(4)}, ${listing.lng.toFixed(4)}`} /></div>
        </div>

        <aside className="lg:col-span-1">
          <div className="bg-white border border-ink/10 rounded-sm p-6 sticky top-28">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50 mb-1">Ask about this property</p>
            <p className="font-display text-xl text-ink">Florida Southeast Realty</p>
            <p className="text-sm text-ink/60 mt-1">Talk directly with a South Florida broker.</p>
            <div className="mt-5">
              <LeadForm
                formName="property-inquiry"
                submitLabel="Request Information"
                successMessage={`Florida Southeast Realty will follow up about ${listing.address}.`}
                hiddenContext={{ listingAddress: listing.address, listingId: listing.mlsId }}
                fields={[
                  { name: "name", label: "Your Name", type: "text", required: true },
                  { name: "email", label: "Your Email", type: "email", required: true },
                  { name: "phone", label: "Phone", type: "tel" },
                  { name: "message", label: "Message", type: "textarea", defaultValue: `I'd like more information about ${listing.address}.`, colSpan: 2 },
                ]}
              />
            </div>
          </div>
        </aside>
      </div>

      <section className="container-fsre mt-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus mb-2">Due Diligence</p>
            <h2 className="font-display text-2xl md:text-3xl text-ink">Research beyond the listing</h2>
          </div>
          <Link href="/research" className="text-sm text-tide underline underline-offset-4">Open full research center</Link>
        </div>
        <ResearchLinks limit={4} />
      </section>

      {similar.length > 0 && (
        <div className="container-fsre mt-20">
          <h2 className="font-display text-2xl text-ink mb-6">More in {listing.community}</h2>
          <PropertyGrid listings={similar} />
        </div>
      )}
    </div>
  );
}
