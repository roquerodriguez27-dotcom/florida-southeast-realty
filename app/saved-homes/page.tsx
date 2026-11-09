import type { Metadata } from "next";
import SavedHomes from "@/components/SavedHomes";

export const metadata: Metadata = {
  title: "Your Saved Homes",
  description: "Return to the South Florida homes you saved and ask Roque about your shortlist.",
  alternates: { canonical: "/saved-homes" },
  robots: { index: false, follow: true },
};

export default function SavedHomesPage() {
  return (
    <div className="pt-28 md:pt-32 pb-40">
      <section className="container-fsre">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">Your shortlist</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink">Saved homes</h1>
        <p className="mt-4 max-w-2xl text-ink/65 leading-relaxed">Keep the homes you want to revisit in one place. Your list is saved in this browser; no account is needed.</p>
        <SavedHomes />
      </section>
    </div>
  );
}
