import Image from "next/image";
import Link from "next/link";
import type { Community } from "@/lib/types";

export default function CommunityCard({ community }: { community: Community }) {
  return (
    <article>
      <Link
        href={`/communities/${community.slug}`}
        className="group relative block aspect-[4/3] sm:aspect-[3/4] overflow-hidden rounded-sm bg-tide"
      >
        <Image
          src={community.heroImage}
          alt={community.heroImageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/95 via-tide/20 to-tide/20" />
        <div className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-[0.12em] text-brass bg-tide/75 px-2 py-1 rounded-sm">
          {community.county}
        </div>
        <div className="absolute bottom-0 p-5 md:p-6">
          <h3 className="font-display text-2xl text-sand">{community.name}</h3>
          <p className="text-sand/75 text-sm mt-1 leading-relaxed">{community.tagline}</p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-brass mt-4">Explore homes + local research →</p>
        </div>
      </Link>
      <p className="mt-2 text-[10px] leading-relaxed text-ink/45">
        Photo: <a href={community.heroImageCredit.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{community.heroImageCredit.author}</a>
        {" · "}
        {community.heroImageCredit.licenseUrl ? (
          <a href={community.heroImageCredit.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{community.heroImageCredit.license}</a>
        ) : community.heroImageCredit.license}
        {" · resized for web"}
      </p>
    </article>
  );
}
