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

const WORKER_RPC_MAX_ATTEMPTS = 3;
const WORKER_RPC_RETRY_BASE_MS = 150;

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

type WorkerRpcError = {
  code?: unknown;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = header.match(/^Bearer\s+([^\s]{20,256})$/i);
  return match?.[1] ?? null;
}

function workerErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as WorkerRpcError).code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function workerRpc(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: unknown; attempts: number }> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= WORKER_RPC_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await supabase.rpc(functionName, args);
      if (!result.error) return { data: result.data, error: null, attempts: attempt };
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }

    // SQLSTATE 28000 is the deliberate invalid-worker-token error raised by
    // the database. Retrying that would only add load and hide a real auth issue.
    if (workerErrorCode(lastError) === "28000") break;
    if (attempt < WORKER_RPC_MAX_ATTEMPTS) {
      await wait(WORKER_RPC_RETRY_BASE_MS * (2 ** (attempt - 1)));
    }
  }

  return { data: null, error: lastError, attempts: WORKER_RPC_MAX_ATTEMPTS };
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = createSupabasePublicClient();
  const claim = await workerRpc(supabase, "claim_due_saved_searches", {
    p_token: token,
    p_limit: 6,
  });
  if (claim.error) {
    const code = workerErrorCode(claim.error);
    const invalidToken = code === "28000";
    const details = {
      code: code ?? "rpc_transport_error",
      attempts: claim.attempts,
      invalidToken,
    };

    if (invalidToken) console.error("[saved-search-worker:claim-failed]", details);
    else console.warn("[saved-search-worker:claim-deferred]", details);

    return NextResponse.json(
      { ok: false, temporary: !invalidToken },
      {
        status: invalidToken ? 401 : 503,
        headers: invalidToken ? undefined : { "Retry-After": "30" },
      },
    );
  }

  const claimed = Array.isArray(claim.data) ? claim.data as ClaimedSearch[] : [];
  let evaluated = 0;
  let sent = 0;
  let deferred = 0;
  let failed = 0;

  for (const search of claimed) {
    try {
      const result = await searchListingPage(savedCriteriaToFilters(search.criteria), 1);
      if (!result.live || result.unavailable) {
        await workerRpc(supabase, "release_saved_search_claim", {
          p_token: token,
          p_search_id: search.search_id,
        });
        deferred += 1;
        continue;
      }

      const snapshot = snapshotListings(result.listings);
      if (search.first_run) {
        const complete = await workerRpc(supabase, "complete_saved_search_evaluation", {
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
          await workerRpc(supabase, "release_saved_search_claim", {
            p_token: token,
            p_search_id: search.search_id,
          });
          failed += 1;
          continue;
        }
        delivered = true;
        sent += 1;
      }

      const complete = await workerRpc(supabase, "complete_saved_search_evaluation", {
        p_token: token,
        p_search_id: search.search_id,
        p_snapshot: snapshot,
        p_sent: delivered,
      });
      if (complete.error) throw complete.error;
      evaluated += 1;
    } catch (workerError) {
      await workerRpc(supabase, "release_saved_search_claim", {
        p_token: token,
        p_search_id: search.search_id,
      });
      console.error("[saved-search-worker:evaluation-failed]", {
        searchId: search.search_id,
        error: workerError instanceof Error ? workerError.name : "unknown",
      });
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, claimed: claimed.length, evaluated, sent, deferred, failed });
}
