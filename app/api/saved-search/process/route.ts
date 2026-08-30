import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { searchListingPage } from "@/lib/listings";
import {
  compareSavedSearchSnapshots,
  savedCriteriaToFilters,
  sendSavedSearchEmail,
  snapshotListings,
} from "@/lib/saved-search-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ClaimedSearch = {
  search_id: string;
  full_name: string;
  email: string;
  frequency: string;
  criteria: Record<string, unknown>;
  alert_new_matches: boolean;
  alert_price_changes: boolean;
  alert_back_on_market: boolean;
  last_snapshot: unknown;
  unsubscribe_token: string;
  first_run: boolean;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = header.match(/^Bearer\s+([^\s]{20,256})$/i);
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.rpc("claim_due_saved_searches", {
    p_token: token,
    p_limit: 6,
  });
  if (error) {
    console.error("[saved-search-worker:claim-failed]", { code: error.code });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const claimed = Array.isArray(data) ? data as ClaimedSearch[] : [];
  let evaluated = 0;
  let sent = 0;
  let deferred = 0;
  let failed = 0;

  for (const search of claimed) {
    try {
      const result = await searchListingPage(savedCriteriaToFilters(search.criteria), 1);
      if (!result.live || result.unavailable) {
        await supabase.rpc("release_saved_search_claim", { p_token: token, p_search_id: search.search_id });
        deferred += 1;
        continue;
      }

      const snapshot = snapshotListings(result.listings);
      if (search.first_run) {
        const complete = await supabase.rpc("complete_saved_search_evaluation", {
          p_token: token,
          p_search_id: search.search_id,
          p_snapshot: snapshot,
          p_sent: false,
        });
        if (complete.error) throw complete.error;
        evaluated += 1;
        continue;
      }

      const changes = compareSavedSearchSnapshots(result.listings, search.last_snapshot, {
        newMatches: search.alert_new_matches,
        priceChanges: search.alert_price_changes,
        backOnMarket: search.alert_back_on_market,
      });
      const hasChanges = changes.newMatches.length > 0 || changes.priceChanges.length > 0 || changes.backOnMarket.length > 0;
      let delivered = false;
      if (hasChanges) {
        const delivery = await sendSavedSearchEmail({
          email: search.email,
          frequency: search.frequency,
          changes,
          unsubscribeToken: search.unsubscribe_token,
          searchId: search.search_id,
        });
        if (!delivery.configured || !delivery.delivered) {
          await supabase.rpc("release_saved_search_claim", { p_token: token, p_search_id: search.search_id });
          failed += 1;
          continue;
        }
        delivered = true;
        sent += 1;
      }

      const complete = await supabase.rpc("complete_saved_search_evaluation", {
        p_token: token,
        p_search_id: search.search_id,
        p_snapshot: snapshot,
        p_sent: delivered,
      });
      if (complete.error) throw complete.error;
      evaluated += 1;
    } catch (workerError) {
      await supabase.rpc("release_saved_search_claim", { p_token: token, p_search_id: search.search_id });
      console.error("[saved-search-worker:evaluation-failed]", {
        searchId: search.search_id,
        error: workerError instanceof Error ? workerError.name : "unknown",
      });
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, claimed: claimed.length, evaluated, sent, deferred, failed });
}
