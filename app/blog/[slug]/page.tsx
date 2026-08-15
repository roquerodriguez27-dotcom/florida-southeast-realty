import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPostBySlug } from "@/lib/content";
import { formatDate } from "@/lib/format";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import { SITE } from "@/lib/site-config";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.dek,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.dek,
      publishedTime: post.publishedAt,
      images: [{ url: post.image, alt: post.title }],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.dek,
    datePublished: post.publishedAt,
    author: post.author === "Roque Rodriguez"
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/blog/${post.slug}`,
    image: post.image,
  };

  return (
    <article className="pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="relative h-[42svh] min-h-[320px] bg-tide">
        <Image src={post.image} alt={post.title} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/95 via-tide/35 to-tide/35" />
        <div className="relative h-full container-fsre flex flex-col justify-end pb-10 pt-24 max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">{post.category}</p>
          <h1 className="font-display text-3xl md:text-5xl text-sand leading-tight">{post.title}</h1>
          <p className="text-sand/65 text-sm mt-3">By {post.author} · {formatDate(post.publishedAt)}</p>
        </div>
      </div>

      <div className="container-fsre max-w-3xl mt-12">
        <p className="text-lg text-ink/80 leading-relaxed mb-8">{post.dek}</p>
        <div className="space-y-6">
          {post.body.map((paragraph, index) => (
            <p key={index} className="text-ink/80 leading-relaxed">{paragraph}</p>
          ))}
        </div>
        <div className="mt-10 border-t border-ink/10 pt-6 flex flex-wrap gap-4 text-sm">
          <Link href="/research" className="text-tide underline underline-offset-4">Open the Research Center</Link>
          <Link href="/contact" className="text-tide underline underline-offset-4">Ask Florida Southeast Realty</Link>
        </div>
      </div>

      <div className="mt-20"><LeadCaptureBand /></div>
    </article>
  );
}
