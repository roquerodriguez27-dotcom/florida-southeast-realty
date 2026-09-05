"use client";

import { trackSiteEvent } from "@/components/SiteAnalytics";
import { SITE } from "@/lib/site-config";

export default function PropertyConversionBar({ mlsId }: { mlsId: string }) {
  const textHref = SITE.phoneHref.replace(/^tel:/, "sms:");

  function track(action: string) {
    trackSiteEvent("buyer_tool_use", { tool: "property_conversion", action, listingId: mlsId });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-3 py-3 shadow-[0_-6px_24px_rgba(16,34,44,0.08)] backdrop-blur md:hidden" aria-label="Property contact options">
      <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
        <a
          href={textHref}
          onClick={() => track("text_roque_mobile")}
          className="rounded-sm border border-tide/25 px-3 py-3 text-center text-sm font-medium text-tide"
        >
          Text Roque
        </a>
        <a
          href="#property-inquiry"
          onClick={() => track("schedule_tour_mobile")}
          className="rounded-sm bg-hibiscus px-3 py-3 text-center text-sm font-medium text-sand"
        >
          Tour
        </a>
        <a
          href={SITE.phoneHref}
          onClick={() => track("call_roque_mobile")}
          className="rounded-sm border border-tide/25 px-3 py-3 text-center text-sm font-medium text-tide"
        >
          Call
        </a>
      </div>
    </div>
  );
}
