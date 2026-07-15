import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { GUIDES, getGuideBySlug } from "@/lib/content";
import { formatDate } from "@/lib/format";
import LeadCaptureBand from "@/components/LeadCaptureBand";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.dek,
    openGraph: { images: [guide.image] },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <article className="pb-20">
      <div className="relative h-[42svh] min-h-[320px]">
        <Image src={guide.image} alt={guide.title} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/90 via-tide/25 to-tide/30" />
        <div className="relative h-full container-fsre flex flex-col justify-end pb-10 pt-24 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">
            {guide.category} · {guide.readMinutes} min read
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-sand leading-tight">{guide.title}</h1>
          <p className="text-sand/60 text-sm mt-3">{formatDate(guide.publishedAt)}</p>
        </div>
      </div>

      <div className="container-fsre max-w-2xl mt-12">
        <p className="text-lg text-ink/80 leading-relaxed mb-8">{guide.dek}</p>
        <div className="space-y-6">
          {guide.body.map((p, i) => (
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
