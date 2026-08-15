import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBlogPosts } from "@/lib/content";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "South Florida Real Estate Blog | Buyer, Seller & Condo Research",
  description: "Original South Florida real estate articles on buyer due diligence, condos, seller preparation, property research, and local homeownership.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getBlogPosts();
  const [lead, ...rest] = posts;

  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">South Florida Real Estate Blog</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink mb-3">Practical research for buyers, sellers, and homeowners</h1>
        <p className="text-ink/60 max-w-2xl mb-10">
          Original guidance focused on the questions that come up in South Florida transactions — property records, condos, waterfront due diligence, seller preparation, and more.
        </p>

        {lead && (
          <Link href={`/blog/${lead.slug}`} className="group grid md:grid-cols-2 gap-6 mb-14 items-center">
            <div className="relative aspect-[16/10] overflow-hidden rounded-sm">
              <Image src={lead.image} alt={lead.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">{lead.category} · {formatDate(lead.publishedAt)}</p>
              <h2 className="font-display text-2xl md:text-3xl text-ink leading-snug group-hover:text-tide transition-colors">{lead.title}</h2>
              <p className="text-ink/60 mt-3">{lead.dek}</p>
              <p className="text-sm text-ink/45 mt-4">By {lead.author}</p>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {rest.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm mb-4">
                <Image src={post.image} alt={post.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-hibiscus mb-2">{post.category} · {formatDate(post.publishedAt)}</p>
              <h3 className="font-display text-xl text-ink leading-snug group-hover:text-tide transition-colors">{post.title}</h3>
              <p className="text-sm text-ink/60 mt-2">{post.dek}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
