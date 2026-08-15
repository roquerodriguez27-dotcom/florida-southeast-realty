import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getGuides } from "@/lib/content";

export const metadata: Metadata = {
  title: "South Florida Buyer, Seller & Relocation Guides",
  description:
    "Practical South Florida real estate guides for waterfront buyers, sellers preparing to list, and households comparing communities before relocating.",
  alternates: { canonical: "/guides" },
};

export default async function GuidesPage() {
  const guides = await getGuides();

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">South Florida Guides</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink mb-3">Research before the decision gets expensive</h1>
        <p className="text-ink/60 max-w-2xl mb-10">
          Practical guides written for South Florida buyers, sellers, and relocating households — with an emphasis on due diligence, property structure, and questions worth asking early.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {guides.map((guide) => (
            <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm mb-4">
                <Image src={guide.image} alt={guide.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">{guide.category} · {guide.readMinutes} min read</p>
              <h2 className="font-display text-xl text-ink leading-snug group-hover:text-tide transition-colors">{guide.title}</h2>
              <p className="text-sm text-ink/60 mt-2">{guide.dek}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
