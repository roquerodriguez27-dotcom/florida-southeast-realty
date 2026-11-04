"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SITE } from "@/lib/site-config";

export default function ListingUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <main className="container-fsre min-h-[60vh] py-24">
      <p className="font-mono text-xs uppercase tracking-wide text-hibiscus">Temporary MLS connection issue</p>
      <h1 className="mt-3 font-display text-3xl text-ink">This property is taking longer to load.</h1>
      <p className="mt-4 max-w-xl text-ink/70">We could not refresh the listing just now. This does not mean the home has sold or been removed.</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="rounded-sm bg-tide px-5 py-3 text-sand disabled:opacity-60">{pending ? "Trying again…" : "Try again"}</button>
        <Link href="/properties" className="text-tide underline underline-offset-4">Back to property search</Link>
        <a href={SITE.phoneHref} className="text-tide underline underline-offset-4">Call {SITE.phoneDisplay}</a>
      </div>
      <p role="status" className="mt-4 text-sm text-ink/60">{pending ? "Requesting the listing again." : ""}</p>
    </main>
  );
}
