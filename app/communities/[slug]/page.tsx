import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAllCommunities, getCommunityBySlug } from "@/lib/communities";
import { searchListings } from "@/lib/listings";
import { formatPrice, formatMileMarker } from "@/lib/format";
import PropertyGrid from "@/components/PropertyGrid";
import Tideline from "@/components/Tideline";
import LeadCaptureBand from "@/components/LeadCaptureBand";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const communities = await getAllCommunities();
  return communities.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) return {};
  return {
    title: `${community.name} Homes for Sale | ${community.county}`,
    description: community.overview,
    openGraph: { images: [community.heroImage] },
  };
}

export default async function CommunityPage({ params }: Props) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();

  const listings = await searchListings({ community: community.slug });

  return (
    <div className="pb-20">
      <div className="relative h-[52svh] min-h-[380px]">
        <Image src={community.heroImage} alt={community.name} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/90 via-tide/20 to-tide/30" />
        <div className="relative h-full container-fsre flex flex-col justify-end pb-10 pt-24">
          <p className="mile-marker text-brass text-sm mb-2">{formatMileMarker(community.mileMarker)} · {community.county}</p>
          <h1 className="font-display text-4xl md:text-5xl text-sand">{community.name}</h1>
          <p className="text-sand/85 mt-2 max-w-xl">{community.tagline}</p>
        </div>
      </div>

      <div className="container-fsre mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <p className="text-ink/80 leading-relaxed text-lg">{community.overview}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-white border border-ink/10 rounded-sm p-4">
              <p className="font-mono text-[11px] uppercase text-ink/45">Median Price</p>
              <p className="font-display text-xl text-ink mt-1">{formatPrice(community.medianPrice)}</p>
            </div>
            {community.walkScore && (
              <div className="bg-white border border-ink/10 rounded-sm p-4">
                <p className="font-mono text-[11px] uppercase text-ink/45">Walk Score</p>
                <p className="font-display text-xl text-ink mt-1">{community.walkScore}</p>
              </div>
            )}
            <div className="bg-white border border-ink/10 rounded-sm p-4 col-span-2 sm:col-span-2">
              <p className="font-mono text-[11px] uppercase text-ink/45">Active Listings</p>
              <p className="font-display text-xl text-ink mt-1">{listings.length}</p>
            </div>
          </div>

          <h2 className="font-display text-xl text-ink mt-10 mb-3">Why buyers choose it here</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {community.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-ink/75 bg-white border border-ink/10 rounded-sm px-3 py-2.5">
                <span className="w-1 h-1 rounded-full bg-hibiscus shrink-0" /> {h}
              </li>
            ))}
          </ul>
        </div>

        <aside className="grid grid-cols-2 gap-2 content-start">
          {community.images.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-sm">
              <Image src={src} alt={`${community.name} street scene ${i + 1}`} fill sizes="20vw" className="object-cover" />
            </div>
          ))}
        </aside>
      </div>

      <div className="container-fsre my-12">
        <Tideline />
      </div>

      <div className="container-fsre">
        <h2 className="font-display text-2xl text-ink mb-6">Homes for sale in {community.name}</h2>
        <PropertyGrid listings={listings} />
      </div>

      <div className="mt-20">
        <LeadCaptureBand />
      </div>
    </div>
  );
}
