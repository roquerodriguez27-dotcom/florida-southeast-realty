import type { Metadata } from "next";
import Image from "next/image";
import ValuePropsBar from "@/components/ValuePropsBar";
import LeadCaptureBand from "@/components/LeadCaptureBand";

export const metadata: Metadata = {
  title: "About Us | Florida Southeast Realty",
  description:
    "An independent South Florida brokerage built around one coastal corridor and the agents who know it well.",
  alternates: { canonical: "/about" },
};

const AGENTS = [
  {
    name: "Marisol Vega",
    title: "Founding Broker",
    bio: "Lists waterfront property from Hillsboro Beach to Coral Ridge, with close attention to seawall and dock condition before it becomes a buyer's negotiating point.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Colin Hartwell",
    title: "Partner, Downtown & Las Olas",
    bio: "Focuses on condo buildings with dockage, including post-Surfside structural reserve compliance.",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Devon Ashford",
    title: "Partner, Boca Raton & Golf Communities",
    bio: "Works Boca Raton's golf-course communities and school-boundary-driven neighborhoods.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
  },
];

export default function AboutPage() {
  return (
    <div className="pb-20">
      <div className="pt-32 pb-16 container-fsre max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">About Us</p>
        <h1 className="font-display text-3xl md:text-4xl text-ink leading-tight mb-6">
          We only work one stretch of coast — so we work it better than anyone else.
        </h1>
        <p className="text-ink/75 leading-relaxed text-lg">
          Florida Southeast Realty was founded on a simple bet: that a brokerage covering a
          defined stretch of coastline, rather than an entire metro area, could know that
          coastline better than any national platform ever would. We represent buyers and
          sellers across Southeast Florida&apos;s coastal corridor — which means when we tell you
          a seawall needs attention, a school boundary is stable, or a fixed bridge caps a
          dock&apos;s future resale value, we&apos;re speaking from direct, local experience.
        </p>
      </div>

      <ValuePropsBar />

      <div className="container-fsre py-16 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl text-ink mb-3">The team</h2>
        <p className="text-xs text-brass bg-brass/10 border border-brass/30 rounded-sm px-4 py-2.5 mb-8 inline-block">
          Sample team profiles for demonstration — replace with real staff photos, titles, and bios.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {AGENTS.map((a) => (
            <div key={a.name}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm mb-4">
                <Image src={a.image} alt={a.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <h3 className="font-display text-xl text-ink">{a.name}</h3>
              <p className="font-mono text-xs uppercase tracking-wide text-hibiscus mt-1">{a.title}</p>
              <p className="text-sm text-ink/65 mt-2 leading-relaxed">{a.bio}</p>
            </div>
          ))}
        </div>
      </div>

      <LeadCaptureBand />
    </div>
  );
}
