import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBlogPosts } from "@/lib/content";
import { formatDate } from "@/lib/format";
import SampleDataNotice from "@/components/SampleDataNotice";

export const metadata: Metadata = {
  title: "Blog | South Florida Market News & Homeownership Tips",
  description: "Market commentary, homeownership tips, and neighborhood insight from Florida Southeast Realty.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getBlogPosts();
  const [lead, ...rest] = posts;

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Blog</p>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-6">
          Market news, straight from the field
        </h1>

        <div className="mb-10">
          <SampleDataNotice variant="editorial" />
        </div>

        {lead && (
          <Link href={`/blog/${lead.slug}`} className="group grid md:grid-cols-2 gap-6 mb-14 items-center">
            <div className="relative aspect-[16/10] overflow-hidden rounded-sm">
              <Image src={lead.image} alt={lead.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">
                {lead.category} · {formatDate(lead.publishedAt)}
              </p>
              <h2 className="font-display text-2xl md:text-3xl text-ink leading-snug group-hover:text-tide transition-colors">
                {lead.title}
              </h2>
              <p className="text-ink/60 mt-3">{lead.dek}</p>
              <p className="text-sm text-ink/45 mt-4">By {lead.author}</p>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {rest.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm mb-4">
                <Image src={p.image} alt={p.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">
                {p.category} · {formatDate(p.publishedAt)}
              </p>
              <h3 className="font-display text-xl text-ink leading-snug group-hover:text-tide transition-colors">
                {p.title}
              </h3>
              <p className="text-sm text-ink/60 mt-2">{p.dek}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
