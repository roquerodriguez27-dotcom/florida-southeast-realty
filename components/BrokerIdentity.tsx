import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site-config";
import { CLIENT_REVIEWS } from "@/lib/testimonials";

export default function BrokerIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-sm border border-tide/15 bg-white p-4">
      <div className="flex items-center gap-4">
        <div className={`relative shrink-0 overflow-hidden rounded-sm bg-keystone-dim/50 ${compact ? "h-14 w-14" : "h-20 w-20"}`}>
          <Image src={SITE.brokerImage} alt={`Portrait of ${SITE.brokerName}`} fill sizes={compact ? "56px" : "80px"} className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className={`font-display text-ink ${compact ? "text-lg" : "text-xl"}`}>{SITE.brokerName}</p>
          <p className={`mt-1 text-ink/65 ${compact ? "text-xs" : "text-sm"}`}>Broker · Real estate since {SITE.brokerSince}</p>
          <Link href="/about" className="mt-2 inline-block text-xs font-medium text-tide underline underline-offset-4">Meet your broker</Link>
        </div>
      </div>
      {compact ? null : <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/10 pt-3 text-sm font-medium text-tide">
        <a href={SITE.phoneHref} className="underline underline-offset-4">Call {SITE.phoneDisplay}</a>
        <a href={SITE.phoneHref.replace(/^tel:/, "sms:")} className="underline underline-offset-4">Text Roque</a>
      </div>}
    </div>
  );
}

export function BrokerClientReview() {
  const review = CLIENT_REVIEWS.find((item) => item.name === "Giuseppe Oliveri");
  if (!review) return null;

  return (
    <figure className="border-l-2 border-brass/50 pl-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">A client&apos;s buying experience</p>
      <blockquote className="mt-2 text-sm leading-relaxed text-ink/70">“{review.quote}”</blockquote>
      <figcaption className="mt-2 text-xs font-medium text-tide">{review.name}</figcaption>
    </figure>
  );
}
