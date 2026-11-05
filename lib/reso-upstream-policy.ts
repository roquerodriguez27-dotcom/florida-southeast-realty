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

type RequestKind = "property_collection" | "property_entity" | "media_collection" | "system" | "metadata" | "other";
const ERROR_CLASSES = ["Error", "TypeError", "AbortError", "TimeoutError", "AggregateError"] as const;
const CAUSE_CODES = [
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE",
  "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET", "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
] as const;
type NetworkErrorDetails = {
  failureType: "timeout" | "network_error";
  errorClass: typeof ERROR_CLASSES[number] | "unknown";
  causeCode: typeof CAUSE_CODES[number] | "unknown";
};

type DeadlineSource = "upstream_timeout" | "caller_signal" | "unknown" | "not_aborted";
type AbortTimingDetails = {
  deadlineSource: DeadlineSource;
  abortAfterMs: number | null;
  timerLatenessMs: number | null;
  abortToRejectionMs: number | null;
};
type DeadlineObservation = { source: DeadlineSource; abortedAt: number; dueAt?: number };
const deadlineObservations = new WeakMap<AbortSignal, DeadlineObservation>();
const MAX_DIAGNOSTIC_TIMING_MS = 300_000;

// Observe the first abort source without changing its signal, reason, or timer.
// All timestamps are monotonic and private; only capped relative times are logged.
export function observeResoDeadlineAbort(
  signal: AbortSignal,
  source: "upstream_timeout" | "caller_signal",
  abortedAt: number,
  dueAt?: number,
): void {
  if (signal.aborted || deadlineObservations.has(signal) || !Number.isFinite(abortedAt)) return;
  deadlineObservations.set(signal, {
    source: source === "upstream_timeout" ? "upstream_timeout" : source === "caller_signal" ? "caller_signal" : "unknown",
    abortedAt,
    ...(source === "upstream_timeout" && Number.isFinite(dueAt) ? { dueAt } : {}),
  });
}

function boundedTiming(value: number): number | null {
  return Number.isFinite(value) ? Math.min(MAX_DIAGNOSTIC_TIMING_MS, Math.max(0, Math.round(value))) : null;
}

function abortTimingDetails(
  signal: AbortSignal | null | undefined,
  startedAt: number,
  observedAbortAt: number | undefined,
  rejectedAt: number,
): AbortTimingDetails {
  const observation = signal ? deadlineObservations.get(signal) : undefined;
  const abortedAt = observation?.abortedAt ?? observedAbortAt;
  return {
    deadlineSource: !signal?.aborted ? "not_aborted" : observation?.source ?? (observedAbortAt === undefined ? "unknown" : "caller_signal"),
    abortAfterMs: abortedAt === undefined ? null : boundedTiming(abortedAt - startedAt),
    timerLatenessMs: observation?.dueAt === undefined ? null : boundedTiming(observation.abortedAt - observation.dueAt),
    abortToRejectionMs: abortedAt === undefined ? null : boundedTiming(rejectedAt - abortedAt),
  };
}

type FailureEvent = {
  kind: "actual_upstream_failure";
  status: number | "network_error";
  consecutiveFailures: number;
  retryAfterSeconds: number;
  requestKind: RequestKind;
  durationMs: number;
  failureType: "http_error" | NetworkErrorDetails["failureType"];
  errorClass?: NetworkErrorDetails["errorClass"];
  causeCode?: NetworkErrorDetails["causeCode"];
  deadlineSource?: AbortTimingDetails["deadlineSource"];
  abortAfterMs?: number | null;
  timerLatenessMs?: number | null;
  abortToRejectionMs?: number | null;
};

type PolicyOptions = {
  now?: () => number;
  timingNow?: () => number;
  onFailure?: (event: FailureEvent) => void;
};

// Fixed categories describe only the actual upstream resource shape. The
// outer cache may rewrite detail/media lookups into a Property collection.
function requestKind(url: URL): RequestKind {
  if (/\/Property$/i.test(url.pathname)) return "property_collection";
  if (/\/Property\([^/]*\)$/i.test(url.pathname)) return "property_entity";
  if (/\/Media$/i.test(url.pathname)) return "media_collection";
  if (/\/System$/i.test(url.pathname)) return "system";
  if (/\/\$metadata$/i.test(url.pathname)) return "metadata";
  return "other";
}

function errorField(value: unknown, key: string): unknown {
  try {
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)[key] : undefined;
  } catch {
    return undefined;
  }
}

function networkErrorDetails(error: unknown, signal?: AbortSignal | null): NetworkErrorDetails {
  const name = errorField(error, "name");
  const code = errorField(errorField(error, "cause"), "code");
  // Return literals from the allowlists, never values copied from an error.
  const errorClass = ERROR_CLASSES.find((value) => value === name) ?? "unknown";
  const causeCode = CAUSE_CODES.find((value) => value === code) ?? "unknown";
  const timeout = errorClass === "TimeoutError"
    || (signal?.aborted && errorField(signal.reason, "name") === "TimeoutError")
    || causeCode === "ETIMEDOUT" || causeCode.endsWith("_TIMEOUT");
  return { failureType: timeout ? "timeout" : "network_error", errorClass, causeCode };
}

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

/** A caller cancellation is not proof that the MLS provider is unavailable.
 * TimeoutError is intentionally NOT excluded: real deadlines retain backoff.
 * Unknown/custom abort reasons are conservatively treated as failures.
 */
export function isResoRequestCancellation(signal?: AbortSignal | null): boolean {
  if (!signal?.aborted) return false;
  const reason: unknown = signal.reason;
  return typeof reason === "object" && reason !== null
    && "name" in reason && reason.name === "AbortError";
}

export function createResoUpstreamPolicy(
  upstream: typeof fetch,
  options: PolicyOptions = {},
): typeof fetch {
  const now = options.now ?? Date.now;
  const timingNow = options.timingNow ?? (() => performance.now());
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
    startedAt: number,
    kind: RequestKind,
    errorDetails?: NetworkErrorDetails & AbortTimingDetails,
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
      requestKind: kind,
      durationMs: Number.isFinite(time - startedAt) ? Math.max(0, Math.round(time - startedAt)) : 0,
      failureType: "http_error",
      ...errorDetails,
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

    // An already-expired caller did not contact the provider. Do not turn its
    // cancellation into a new feed-wide outage or extend the recovery pause.
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    signal?.throwIfAborted();

    const time = now();
    if (pauseUntil > time) return admissionResponse(pauseReason, pauseUntil - time);
    if (probeInFlight || active >= MAX_CONCURRENT_REQUESTS) {
      return admissionResponse("capacity_protected", 1_000);
    }

    const isRecoveryProbe = consecutiveFailures > 0;
    if (isRecoveryProbe) probeInFlight = true;
    const startedInGeneration = generation;
    active += 1;
    const startedAt = now();
    const kind = requestKind(url);
    const upstreamStartedAt = timingNow();
    let observedAbortAt: number | undefined;
    const observeAbort = () => { observedAbortAt ??= timingNow(); };
    signal?.addEventListener("abort", observeAbort, { once: true });
    try {
      const response = await upstream(input, init);
      if (response.status === 429 || response.status >= 500) {
        recordFailure(startedInGeneration, response.status, response.headers.get("retry-after"), startedAt, kind);
      } else if (startedInGeneration === generation) {
        // A response that started BEFORE a concurrent failure must never
        // cancel the newer pause. Ordinary 4xx responses prove reachability
        // and remain unchanged for the caller's existing lookup fallbacks.
        consecutiveFailures = 0;
        pauseUntil = 0;
      }
      return response;
    } catch (error) {
      const rejectedAt = timingNow();
      if (isResoRequestCancellation(signal)) throw error;
      recordFailure(startedInGeneration, "network_error", null, startedAt, kind, {
        ...networkErrorDetails(error, signal),
        ...abortTimingDetails(signal, upstreamStartedAt, observedAbortAt, rejectedAt),
      });
      throw error;
    } finally {
      signal?.removeEventListener("abort", observeAbort);
      active = Math.max(0, active - 1);
      if (isRecoveryProbe) probeInFlight = false;
    }
  };
}
