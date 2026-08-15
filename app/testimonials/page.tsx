import type { Metadata } from "next";
import Link from "next/link";
import { CLIENT_REVIEWS } from "@/lib/testimonials";

export const metadata: Metadata = {
  title: "Client Reviews | Florida Southeast Realty",
  description:
    "Read verified client comments about working with Roque Rodriguez and Florida Southeast Realty on real estate transactions and searches.",
  alternates: { canonical: "/testimonials" },
};

export default function TestimonialsPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <section className="container-fsre max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Client Reviews</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink">What clients say about working with Roque</h1>
        <p className="text-ink/65 mt-4 max-w-2xl">
          These comments were provided by past clients. We keep the wording close to the original
          and do not invent ratings, transaction details, or results that were not supplied by the client.
        </p>
      </section>

      <section className="container-fsre py-12 grid md:grid-cols-2 gap-5">
        {CLIENT_REVIEWS.map((review) => (
          <figure key={review.name} className="bg-white border border-ink/10 rounded-sm p-6 md:p-8">
            <blockquote className="text-ink/75 leading-relaxed text-lg">“{review.quote}”</blockquote>
            <figcaption className="mt-5 font-mono text-xs uppercase tracking-wide text-tide">
              {review.name}
            </figcaption>
          </figure>
        ))}
      </section>

      <section className="container-fsre">
        <div className="bg-tide text-sand rounded-sm p-7 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <h2 className="font-display text-2xl">Ready to talk about your move?</h2>
            <p className="text-sand/70 mt-2">Speak directly with Florida Southeast Realty about buying or selling in South Florida.</p>
          </div>
          <Link href="/contact" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-5 py-3 rounded-sm transition-colors shrink-0">
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
