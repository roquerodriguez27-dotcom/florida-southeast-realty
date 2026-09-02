"use client";

import Link from "next/link";
import { useState } from "react";
import { trackSiteEvent } from "@/components/SiteAnalytics";

export default function AskRoqueActions({
  slug,
  mlsId,
  city,
  price,
  associationFeeMonthly,
}: {
  slug: string;
  mlsId: string;
  city: string;
  price: number;
  associationFeeMonthly?: number;
}) {
  const [hoaAnswerVisible, setHoaAnswerVisible] = useState(false);
  const similarMax = Math.max(100_000, Math.round(price * 1.15 / 10_000) * 10_000);

  function track(action: string) {
    trackSiteEvent("buyer_tool_use", { tool: "ask_roque", action, listingId: mlsId });
  }

  return (
    <section className="mt-7 rounded-sm border border-brass/35 bg-brass/10 p-5" aria-labelledby="ask-roque-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-hibiscus">Ask Roque</p>
          <h2 id="ask-roque-heading" className="mt-1 font-display text-2xl text-ink">What do you want to know about this home?</h2>
          <p className="mt-1 text-sm text-ink/55">Jump straight to the questions buyers usually ask next.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          href={`/buyer-tools?listing=${encodeURIComponent(slug)}&tool=cost`}
          onClick={() => track("monthly_cost")}
          className="rounded-full border border-tide/20 bg-white px-4 py-2 text-sm font-medium text-tide hover:bg-tide/5"
        >
          What will this cost monthly?
        </Link>
        <button
          type="button"
          onClick={() => {
            setHoaAnswerVisible((visible) => !visible);
            track("hoa_question");
          }}
          className="rounded-full border border-tide/20 bg-white px-4 py-2 text-sm font-medium text-tide hover:bg-tide/5"
        >
          Is the HOA high?
        </button>
        <Link
          href={`/properties?location=${encodeURIComponent(city)}&maxPrice=${similarMax}`}
          rel="nofollow"
          onClick={() => track("similar_homes")}
          className="rounded-full border border-tide/20 bg-white px-4 py-2 text-sm font-medium text-tide hover:bg-tide/5"
        >
          Show me similar homes
        </Link>
        <Link
          href="/research"
          onClick={() => track("research")}
          className="rounded-full border border-tide/20 bg-white px-4 py-2 text-sm font-medium text-tide hover:bg-tide/5"
        >
          What should I research?
        </Link>
        <a
          href="#property-inquiry"
          onClick={() => track("showing")}
          className="rounded-full bg-hibiscus px-4 py-2 text-sm font-medium text-sand hover:bg-hibiscus-dark"
        >
          Schedule a showing
        </a>
      </div>
      {hoaAnswerVisible ? (
        <div className="mt-4 rounded-sm border border-ink/10 bg-white p-4 text-sm leading-relaxed text-ink/70" aria-live="polite">
          {associationFeeMonthly === undefined
            ? "The MLS does not provide a reliable monthly HOA amount for this listing. I would verify the current fee, what it includes, and any pending assessments before judging the cost."
            : associationFeeMonthly === 0
              ? "The MLS currently reports no recurring association fee for this property. I would still verify whether there are optional memberships, special assessments, or other community charges."
              : `The MLS currently reports about $${Math.round(associationFeeMonthly).toLocaleString()}/month in association fees. Whether that is high depends on what the fee covers and how it compares with similar homes, so include it in the full monthly-cost comparison before deciding.`}
        </div>
      ) : null}
    </section>
  );
}
