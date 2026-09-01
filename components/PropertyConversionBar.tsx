"use client";

import { trackSiteEvent } from "@/components/SiteAnalytics";

export default function PropertyConversionBar({ mlsId }: { mlsId: string }) {
  function track(action: string) {
    trackSiteEvent("buyer_tool_use", { tool: "property_conversion", action, listingId: mlsId });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-4 py-3 shadow-[0_-6px_24px_rgba(16,34,44,0.08)] backdrop-blur md:hidden" aria-label="Property contact options">
      <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
        <a
          href="#ask-roque-heading"
          onClick={() => track("ask_roque_mobile")}
          className="rounded-sm border border-tide/25 px-4 py-3 text-center text-sm font-medium text-tide"
        >
          Ask Roque
        </a>
        <a
          href="#property-inquiry"
          onClick={() => track("schedule_tour_mobile")}
          className="rounded-sm bg-hibiscus px-4 py-3 text-center text-sm font-medium text-sand"
        >
          Schedule Tour
        </a>
      </div>
    </div>
  );
}
