import Image from "next/image";
import Link from "next/link";
import type { Community } from "@/lib/types";
import { formatMileMarker, formatPrice } from "@/lib/format";

export default function CommunityCard({ community }: { community: Community }) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="group relative block aspect-[3/4] overflow-hidden rounded-sm"
    >
      <Image
        src={community.heroImage}
        alt={community.name}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-tide/90 via-tide/10 to-transparent" />
      <div className="absolute top-4 left-4 mile-marker text-[11px] text-brass bg-tide/60 px-2 py-1 rounded-sm">
        {formatMileMarker(community.mileMarker)}
      </div>
      <div className="absolute bottom-0 p-5">
        <h3 className="font-display text-2xl text-sand">{community.name}</h3>
        <p className="text-sand/75 text-sm mt-1">{community.tagline}</p>
        <p className="font-mono text-xs text-brass mt-3">
          Median {formatPrice(community.medianPrice)}
        </p>
      </div>
    </Link>
  );
}
