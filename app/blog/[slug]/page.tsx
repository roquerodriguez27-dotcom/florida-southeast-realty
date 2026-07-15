import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPostBySlug } from "@/lib/content";
import { formatDate } from "@/lib/format";
import LeadCaptureBand from "@/components/LeadCaptureBand";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.dek,
    openGraph: { images: [post.image] },
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
    datePublished: post.publishedAt,
    author: { "@type": "Person", name: post.author },
    image: post.image,
  };

  return (
    <article className="pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="relative h-[42svh] min-h-[320px]">
        <Image src={post.image} alt={post.title} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/90 via-tide/25 to-tide/30" />
        <div className="relative h-full container-fsre flex flex-col justify-end pb-10 pt-24 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">{post.category}</p>
          <h1 className="font-display text-3xl md:text-4xl text-sand leading-tight">{post.title}</h1>
          <p className="text-sand/60 text-sm mt-3">By {post.author} · {formatDate(post.publishedAt)}</p>
        </div>
      </div>

      <div className="container-fsre max-w-2xl mt-12">
        <p className="text-lg text-ink/80 leading-relaxed mb-8">{post.dek}</p>
        <div className="space-y-6">
          {post.body.map((p, i) => (
            <p key={i} className="text-ink/80 leading-relaxed">{p}</p>
          ))}
        </div>
      </div>

      <div className="mt-20">
        <LeadCaptureBand />
      </div>
    </article>
  );
}
