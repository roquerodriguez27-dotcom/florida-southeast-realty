import type { Metadata } from "next";
import Link from "next/link";
import SellerPlanning from "@/components/planning/SellerPlanning";
import { SELLER_TOOLS, type SellerTool } from "@/lib/planning/seller";

export const metadata: Metadata = {
  title: "Seller Planning Tools | Proceeds, Timing & Offer Comparison",
  description: "Compare three seller proceeds scenarios, plan a sale and purchase timeline, prepare a home for sale, compare offers, and create a printable seller progress report.",
  alternates: { canonical: "/planning/sell" },
};

export default async function SellerPlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initialTool: SellerTool = SELLER_TOOLS.some((tool) => tool.id === params.tool) ? params.tool as SellerTool : "proceeds";
  return <div className="pb-20 pt-28 md:pt-32">
    <header className="container-fsre max-w-6xl">
      <Link href="/planning" className="text-sm text-tide underline underline-offset-4"><span aria-hidden="true">← </span>Planning Center</Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">Florida Southeast Realty</p>
      <h1 className="mt-3 max-w-4xl font-display text-4xl leading-tight text-tide md:text-5xl">A clearer plan for your next sale.</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink/70">Work through the numbers, timing and decisions. Keep a copy of your worksheet or send the entered details to Roque for a personal review.</p>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm"><Link href="/sellers" className="text-tide underline underline-offset-4">Selling services &amp; fee details</Link><Link href="/home-valuation" className="text-tide underline underline-offset-4">Request a personal pricing review</Link></div>
    </header>
    <div className="container-fsre mt-10 max-w-6xl"><SellerPlanning initialTool={initialTool} /></div>
  </div>;
}
