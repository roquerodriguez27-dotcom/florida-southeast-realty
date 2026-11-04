"use client";

import Link from "next/link";
import { SITE } from "@/lib/site-config";

export default function PropertyError({ unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="container-fsre max-w-2xl pt-32 pb-24">
      <p className="font-mono text-xs uppercase tracking-wide text-hibiscus">Temporary loading problem</p>
      <h1 className="mt-4 font-display text-3xl text-ink">We could not load this home’s details.</h1>
      <p className="mt-4 text-ink/70">A loading problem does not mean the home was removed or sold. Please try again, or contact Roque to confirm its current status.</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <button type="button" onClick={() => unstable_retry()} className="rounded-sm bg-tide px-5 py-3 text-sm font-medium text-sand">Retry listing</button>
        <Link href="/properties" prefetch={false} className="rounded-sm border border-tide/25 px-5 py-3 text-sm font-medium text-tide">Back to property search</Link>
        <a href={SITE.phoneHref} className="px-2 py-3 text-sm text-tide underline">Call {SITE.phoneDisplay}</a>
      </div>
    </main>
  );
}
