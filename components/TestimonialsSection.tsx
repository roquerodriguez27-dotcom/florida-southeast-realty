import Link from "next/link";
import { CLIENT_REVIEWS } from "@/lib/testimonials";

export default function TestimonialsSection({ limit = 3 }: { limit?: number }) {
  const reviews = CLIENT_REVIEWS.slice(0, limit);

  return (
    <section className="container-fsre py-16 md:py-24">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Client Stories</p>
          <h2 className="font-display text-3xl md:text-4xl text-ink">What clients say about working with Roque</h2>
        </div>
        {limit < CLIENT_REVIEWS.length && (
          <Link href="/testimonials" className="text-sm text-tide underline underline-offset-4">
            Read all client reviews
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {reviews.map((review) => (
          <figure key={review.name} className="bg-white border border-ink/10 rounded-sm p-6 md:p-7">
            <blockquote className="text-ink/75 leading-relaxed">“{review.quote}”</blockquote>
            <figcaption className="mt-5 font-mono text-xs uppercase tracking-wide text-tide">
              {review.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
