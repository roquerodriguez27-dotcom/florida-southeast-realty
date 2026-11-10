import type { Metadata } from "next";
import BuyerPlanning from "@/components/planning/BuyerPlanning";
import { buyerPlanTool } from "@/lib/planning/buyer";

export const metadata: Metadata = {
  title: "Buyer Planning | Property Research, Visits & Loan Estimates",
  description: "Build a property checklist, relocation research plan, tour scorecard or manual Loan Estimate comparison. Print your plan or ask Roque to review it.",
  alternates: { canonical: "/planning/buy" },
};

export default async function BuyerPlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <main className="pt-28 md:pt-32 pb-20">
    <div className="container-fsre">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus">Your next home</p>
      <h1 className="font-display text-4xl md:text-5xl text-ink mt-3">A clearer plan before you decide.</h1>
      <p className="mt-5 text-lg text-ink/65 max-w-3xl">Organize the questions, compare the details and keep a useful record. Your entries stay on this page until you choose to download, print or send them to Roque. Reloading clears this draft.</p>
      <div className="mt-9"><BuyerPlanning key={buyerPlanTool(params.tool)} initialTool={buyerPlanTool(params.tool)} /></div>
    </div>
  </main>;
}
