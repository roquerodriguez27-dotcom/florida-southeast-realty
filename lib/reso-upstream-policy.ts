/**
 * Admission policy for ACTUAL Spark/RESO network calls, underneath the existing
 * response cache. State is per Node worker, NOT an account-wide quota. Keep the
 * managed edge firewall / a shared provider budget as separate protections.
 */
const RESO_HOST = "replication.sparkapi.com";
const MAX_CONCURRENT_REQUESTS = 4;
const INITIAL_FAILURE_PAUSE_MS = 30_000;
const INITIAL_THROTTLE_PAUSE_MS = 60_000;
const MAX_AUTOMATIC_PAUSE_MS = 300_000;

type PauseReason = "upstream_error" | "network_error" | "throttled";
type AdmissionReason = PauseReason | "capacity_protected";

type FailureEvent = {
  kind: "actual_upstream_failure";
  status: number | "network_error";
  consecutiveFailures: number;
  retryAfterSeconds: number;
};

type PolicyOptions = {
  now?: () => number;
  onFailure?: (event: FailureEvent) => void;
};

function retryAfterMs(value: string | null, now: number): number {
  if (!value?.trim()) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

function admissionResponse(reason: AdmissionReason, remainingMs: number): Response {
  const codes: Record<AdmissionReason, string> = {
    upstream_error: "RESO_UPSTREAM_UNAVAILABLE",
    network_error: "RESO_NETWORK_ERROR",
    throttled: "RESO_THROTTLED",
    capacity_protected: "RESO_CAPACITY_PROTECTED",
  };
  return new Response(JSON.stringify({
    error: {
      code: codes[reason],
      message: "MLS requests are temporarily paused to protect provider capacity.",
    },
  }), {
    status: reason === "throttled" ? 429 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": String(Math.max(1, Math.ceil(remainingMs / 1_000))),
      "X-FSR-RESO-Fallback": reason,
      // The outer cache must not count a LOCAL pause as a new provider failure.
      "X-FSR-RESO-Admission": "local",
    },
  });
}

export function createResoUpstreamPolicy(
  upstream: typeof fetch,
  options: PolicyOptions = {},
): typeof fetch {
  const now = options.now ?? Date.now;
  const reportFailure = options.onFailure ?? ((event: FailureEvent) => {
    // Never log the URL, bearer token, request headers, or response body.
    console.warn("[BeachesMLS RESO] Actual upstream request failed.", event);
  });
  let active = 0;
  let probeInFlight = false;
  let generation = 0;
  let consecutiveFailures = 0;
  let pauseUntil = 0;
  let pauseReason: PauseReason = "upstream_error";

  function recordFailure(
    startedInGeneration: number,
    status: number | "network_error",
    retryAfter: string | null,
  ): void {
    const time = now();
    // Parallel failures in the same wave count as ONE recovery failure. A
    // later probe that fails advances the backoff: 30s, 60s, 120s, 240s, 300s.
    if (startedInGeneration === generation) {
      consecutiveFailures += 1;
      generation += 1;
    }
    const base = status === 429 ? INITIAL_THROTTLE_PAUSE_MS : INITIAL_FAILURE_PAUSE_MS;
    const automaticPause = Math.min(
      MAX_AUTOMATIC_PAUSE_MS,
      base * 2 ** Math.min(10, Math.max(0, consecutiveFailures - 1)),
    );
    // The cap applies only to OUR backoff, never to the provider's Retry-After.
    const delay = Math.max(automaticPause, retryAfterMs(retryAfter, time));
    const keepThrottleReason = pauseUntil > time && pauseReason === "throttled";
    pauseReason = status === 429 || keepThrottleReason
      ? "throttled"
      : status === "network_error" ? "network_error" : "upstream_error";
    pauseUntil = Math.max(pauseUntil, time + delay);
    reportFailure({
      kind: "actual_upstream_failure",
      status,
      consecutiveFailures,
      retryAfterSeconds: Math.ceil((pauseUntil - time) / 1_000),
    });
  }

  return async (input, init) => {
    let url: URL;
    try {
      url = new URL(input instanceof Request ? input.url : String(input));
    } catch {
      return upstream(input, init);
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.hostname !== RESO_HOST || method !== "GET") return upstream(input, init);

    const time = now();
    if (pauseUntil > time) return admissionResponse(pauseReason, pauseUntil - time);
    if (probeInFlight || active >= MAX_CONCURRENT_REQUESTS) {
      return admissionResponse("capacity_protected", 1_000);
    }

    const isRecoveryProbe = consecutiveFailures > 0;
    if (isRecoveryProbe) probeInFlight = true;
    const startedInGeneration = generation;
    active += 1;
    try {
      const response = await upstream(input, init);
      if (response.status === 429 || response.status >= 500) {
        recordFailure(startedInGeneration, response.status, response.headers.get("retry-after"));
      } else if (startedInGeneration === generation) {
        // A response that started BEFORE a concurrent failure must never
        // cancel the newer pause. Ordinary 4xx responses prove reachability
        // and remain unchanged for the caller's existing lookup fallbacks.
        consecutiveFailures = 0;
        pauseUntil = 0;
      }
      return response;
    } catch (error) {
      recordFailure(startedInGeneration, "network_error", null);
      throw error;
    } finally {
      active = Math.max(0, active - 1);
      if (isRecoveryProbe) probeInFlight = false;
    }
  };
}
