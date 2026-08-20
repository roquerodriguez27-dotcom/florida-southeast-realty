import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, getGuideBySlug } from "@/lib/content";
import { formatDate } from "@/lib/format";
import LeadCaptureBand from "@/components/LeadCaptureBand";
import { SITE } from "@/lib/site-config";
import { serializeJsonLd } from "@/lib/seo/json-ld";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.dek,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.dek,
      publishedTime: guide.publishedAt,
      images: [{ url: guide.image, alt: guide.title }],
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.dek,
    datePublished: guide.publishedAt,
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/guides/${guide.slug}`,
    image: guide.image,
  };

  return (
    <article className="pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="relative h-[42svh] min-h-[320px] bg-tide">
        <Image src={guide.image} alt={guide.title} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/95 via-tide/35 to-tide/35" />
        <div className="relative h-full container-fsre flex flex-col justify-end pb-10 pt-24 max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">
            {guide.category} · {guide.readMinutes} min read
          </p>
          <h1 className="font-display text-3xl md:text-5xl text-sand leading-tight">{guide.title}</h1>
          <p className="text-sand/65 text-sm mt-3">Updated {formatDate(guide.publishedAt)}</p>
        </div>
      </div>

      <div className="container-fsre max-w-3xl mt-12">
        <p className="text-lg text-ink/80 leading-relaxed mb-8">{guide.dek}</p>
        <div className="space-y-6">
          {guide.body.map((paragraph, index) => (
            <p key={index} className="text-ink/80 leading-relaxed">{paragraph}</p>
          ))}
        </div>
        <div className="mt-10 border-t border-ink/10 pt-6 flex flex-wrap gap-4 text-sm">
          <Link href="/research" className="text-tide underline underline-offset-4">Open the Research Center</Link>
          <Link href="/contact" className="text-tide underline underline-offset-4">Ask a South Florida broker</Link>
        </div>
      </div>

      <div className="mt-20"><LeadCaptureBand /></div>
    </article>
  );
}
