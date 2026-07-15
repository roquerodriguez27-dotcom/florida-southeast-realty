import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getGuides } from "@/lib/content";
import SampleDataNotice from "@/components/SampleDataNotice";

export const metadata: Metadata = {
  title: "Buyer & Seller Guides | South Florida Real Estate",
  description:
    "Practical guides to buying, selling, and relocating in South Florida — waterfront due diligence, timing the market, and choosing a neighborhood.",
  alternates: { canonical: "/guides" },
};

export default async function GuidesPage() {
  const guides = await getGuides();

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Guides</p>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">
          What we tell clients before they ask
        </h1>
        <p className="text-ink/60 max-w-2xl mb-6">
          Practical, specific, and written for this market — not recycled national advice.
        </p>

        <div className="mb-10">
          <SampleDataNotice variant="editorial" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm mb-4">
                <Image src={g.image} alt={g.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">
                {g.category} · {g.readMinutes} min read
              </p>
              <h2 className="font-display text-xl text-ink leading-snug group-hover:text-tide transition-colors">
                {g.title}
              </h2>
              <p className="text-sm text-ink/60 mt-2">{g.dek}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
