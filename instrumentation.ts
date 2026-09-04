type ResoSnapshot = {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: [string, string][];
  freshUntil: number;
  staleUntil: number;
};

type FsrGlobal = typeof globalThis & {
  __fsrOriginalFetch?: typeof fetch;
  __fsrResoInflight?: Map<string, Promise<ResoSnapshot>>;
  __fsrResoCache?: Map<string, ResoSnapshot>;
  __fsrResoBackoffUntil?: Map<string, number>;
  __fsrResoProviderBackoffUntil?: number;
  __fsrResoProviderUnavailableUntil?: number;
  __fsrResoFailureTimes?: number[];
  __fsrResoCircuitOpenUntil?: number;
  __fsrResoCircuitLoggedAt?: number;
  __fsrResoActiveUpstream?: number;
};

const RESO_HOST = "replication.sparkapi.com";
const FRESH_TTL_MS = 5 * 60_000;
// Keep the last known good MLS response available across a provider outage.
// Listing timestamps remain visible in the UI so stale data is transparent.
const STALE_TTL_MS = 24 * 60 * 60_000;
const MAX_CACHE_ENTRIES = 250;
const MAX_BACKOFF_MS = 750;
const DEFAULT_THROTTLE_BACKOFF_MS = 60_000;
const MAX_THROTTLE_BACKOFF_MS = 5 * 60_000;
const PROVIDER_UNAVAILABLE_BACKOFF_MS = 15_000;
const NETWORK_UNAVAILABLE_BACKOFF_MS = 5_000;
const FAILURE_WINDOW_MS = 30_000;
const FAILURE_THRESHOLD = 4;
const CIRCUIT_OPEN_MS = 60_000;
const CIRCUIT_RECOVERY_GRACE_MS = 750;
const UPSTREAM_TIMEOUT_MS = 4_000;
const MAX_UPSTREAM_CONCURRENCY = 6;
const UPSTREAM_SLOT_WAIT_MS = 300;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(MAX_THROTTLE_BACKOFF_MS, seconds * 1_000);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const delay = timestamp - Date.now();
  return delay > 0 ? Math.min(MAX_THROTTLE_BACKOFF_MS, delay) : null;
}

function responseFromSnapshot(snapshot: ResoSnapshot, stale = false): Response {
  const headers = new Headers(snapshot.headers);
  if (stale) headers.set("X-FSR-RESO-Stale", "1");
  return new Response(snapshot.body.slice(0), {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers,
  });
}

type TemporaryFailureReason =
  | "circuit_open"
  | "network_error"
  | "throttled"
  | "upstream_error"
  | "capacity_protected";

function temporaryResoFailureResponse(
  reason: TemporaryFailureReason,
  retryAfterSeconds = 5,
): Response {
  const code = reason === "circuit_open"
    ? "RESO_CIRCUIT_OPEN"
    : reason === "throttled"
      ? "RESO_THROTTLED"
      : reason === "upstream_error"
        ? "RESO_UPSTREAM_UNAVAILABLE"
        : reason === "capacity_protected"
          ? "RESO_CAPACITY_PROTECTED"
          : "RESO_NETWORK_ERROR";
  const message = reason === "circuit_open"
    ? "BeachesMLS RESO is temporarily protected by a circuit breaker."
    : reason === "throttled"
      ? "BeachesMLS RESO asked this search to pause before trying again."
      : reason === "upstream_error"
        ? "BeachesMLS RESO is temporarily unavailable."
        : reason === "capacity_protected"
          ? "Florida Southeast Realty is protecting MLS capacity during heavy traffic."
          : "BeachesMLS RESO is temporarily unreachable.";
  const status = reason === "throttled" ? 429 : 503;

  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    statusText: status === 429 ? "Too Many Requests" : "Service Unavailable",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": String(Math.max(1, Math.min(300, Math.ceil(retryAfterSeconds)))),
      "X-FSR-RESO-Fallback": reason,
    },
  });
}

async function snapshotFromResponse(response: Response): Promise<ResoSnapshot> {
  const body = await response.arrayBuffer();
  return {
    body,
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()),
    freshUntil: Date.now(),
    staleUntil: Date.now(),
  };
}

function trimCache(cache: Map<string, ResoSnapshot>): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

function normalizeEntityLookup(url: URL): URL {
  const match = url.pathname.match(/^(.*\/Property)\('([^']|'')+'\)$/i);
  if (!match) return url;

  const propertyPath = match[1];
  const rawEntity = url.pathname.slice(propertyPath.length + 2, -2);
  const listingKey = decodeURIComponent(rawEntity).replace(/''/g, "'");
  if (!listingKey || listingKey.length > 200) return url;

  const normalized = new URL(url.toString());
  normalized.pathname = propertyPath;
  const origin = process.env.IDX_ORIGINATING_SYSTEM_ID?.trim() || "M00000170";
  const escapedOrigin = origin.replace(/'/g, "''");
  const escapedKey = listingKey.replace(/'/g, "''");
  normalized.searchParams.set(
    "$filter",
    `OriginatingSystemID eq '${escapedOrigin}' and ListingKey eq '${escapedKey}'`,
  );
  normalized.searchParams.set("$top", "1");
  return normalized;
}

function mediaCollectionPropertyProxy(url: URL): URL | null {
  if (!/\/Media$/i.test(url.pathname)) return null;

  const filter = url.searchParams.get("$filter") ?? "";
  const match = filter.match(/ResourceRecordKey\s+eq\s+'((?:''|[^'])+)'/i);
  if (!match?.[1]) return null;

  const listingKey = match[1].replace(/''/g, "'");
  if (!listingKey || listingKey.length > 200) return null;

  const requestedTop = Number(url.searchParams.get("$top"));
  const requestedSkip = Number(url.searchParams.get("$skip"));
  const top = Number.isFinite(requestedTop) && requestedTop > 0
    ? Math.min(200, Math.floor(requestedTop))
    : 25;
  const skip = Number.isFinite(requestedSkip) && requestedSkip > 0
    ? Math.floor(requestedSkip)
    : 0;

  const origin = process.env.IDX_ORIGINATING_SYSTEM_ID?.trim() || "M00000170";
  const escapedOrigin = origin.replace(/'/g, "''");
  const escapedKey = listingKey.replace(/'/g, "''");
  const proxied = new URL(url.toString());
  proxied.pathname = proxied.pathname.replace(/\/Media$/i, "/Property");
  proxied.search = "";
  proxied.searchParams.set(
    "$filter",
    `OriginatingSystemID eq '${escapedOrigin}' and ListingKey eq '${escapedKey}'`,
  );
  proxied.searchParams.set(
    "$expand",
    `Media($top=${top};$skip=${skip};$orderby=Order)`,
  );
  proxied.searchParams.set("$top", "1");
  return proxied;
}

async function unwrapPropertyMediaResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "application/json; charset=utf-8");

  if (!response.ok) {
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  try {
    const payload = await response.json() as { value?: unknown[] };
    const firstRecord = payload.value?.[0];
    const media = firstRecord && typeof firstRecord === "object" && !Array.isArray(firstRecord)
      ? (firstRecord as { Media?: unknown }).Media
      : undefined;
    return new Response(JSON.stringify({ value: Array.isArray(media) ? media : [] }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return new Response(JSON.stringify({ value: [] }), {
      status: 200,
      statusText: "OK",
      headers,
    });
  }
}

function pruneFailures(failureTimes: number[], now: number): void {
  const cutoff = now - FAILURE_WINDOW_MS;
  while (failureTimes.length && failureTimes[0] < cutoff) failureTimes.shift();
}

function recordFailure(
  fsrGlobal: FsrGlobal,
  failureTimes: number[],
): void {
  const now = Date.now();
  pruneFailures(failureTimes, now);
  failureTimes.push(now);

  if (failureTimes.length < FAILURE_THRESHOLD) return;

  const openUntil = now + CIRCUIT_OPEN_MS;
  fsrGlobal.__fsrResoCircuitOpenUntil = Math.max(
    fsrGlobal.__fsrResoCircuitOpenUntil ?? 0,
    openUntil,
  );

  const lastLogAt = fsrGlobal.__fsrResoCircuitLoggedAt ?? 0;
  if (now - lastLogAt > 10_000) {
    fsrGlobal.__fsrResoCircuitLoggedAt = now;
    console.warn("[BeachesMLS RESO] Circuit breaker opened to protect upstream capacity.", {
      failuresInWindow: failureTimes.length,
      openForMs: (fsrGlobal.__fsrResoCircuitOpenUntil ?? now) - now,
    });
  }
}

function timeoutProtectedInit(init?: RequestInit): {
  init: RequestInit;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const existingSignal = init?.signal;
  const abortFromExisting = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  if (existingSignal) {
    if (existingSignal.aborted) controller.abort();
    else existingSignal.addEventListener("abort", abortFromExisting, { once: true });
  }

  return {
    init: { ...init, signal: controller.signal },
    cleanup: () => {
      clearTimeout(timer);
      existingSignal?.removeEventListener("abort", abortFromExisting);
    },
  };
}

async function acquireUpstreamSlot(fsrGlobal: FsrGlobal): Promise<boolean> {
  const deadline = Date.now() + UPSTREAM_SLOT_WAIT_MS;
  while ((fsrGlobal.__fsrResoActiveUpstream ?? 0) >= MAX_UPSTREAM_CONCURRENCY) {
    if (Date.now() >= deadline) return false;
    await wait(25);
  }
  fsrGlobal.__fsrResoActiveUpstream = (fsrGlobal.__fsrResoActiveUpstream ?? 0) + 1;
  return true;
}

function releaseUpstreamSlot(fsrGlobal: FsrGlobal): void {
  fsrGlobal.__fsrResoActiveUpstream = Math.max(
    0,
    (fsrGlobal.__fsrResoActiveUpstream ?? 1) - 1,
  );
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const fsrGlobal = globalThis as FsrGlobal;
  if (fsrGlobal.__fsrOriginalFetch) return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  const inflight = fsrGlobal.__fsrResoInflight ?? new Map<string, Promise<ResoSnapshot>>();
  const cache = fsrGlobal.__fsrResoCache ?? new Map<string, ResoSnapshot>();
  const backoffUntil = fsrGlobal.__fsrResoBackoffUntil ?? new Map<string, number>();
  const failureTimes = fsrGlobal.__fsrResoFailureTimes ?? [];

  fsrGlobal.__fsrOriginalFetch = originalFetch;
  fsrGlobal.__fsrResoInflight = inflight;
  fsrGlobal.__fsrResoCache = cache;
  fsrGlobal.__fsrResoBackoffUntil = backoffUntil;
  fsrGlobal.__fsrResoProviderBackoffUntil ??= 0;
  fsrGlobal.__fsrResoProviderUnavailableUntil ??= 0;
  fsrGlobal.__fsrResoFailureTimes = failureTimes;
  fsrGlobal.__fsrResoCircuitOpenUntil ??= 0;
  fsrGlobal.__fsrResoCircuitLoggedAt ??= 0;
  fsrGlobal.__fsrResoActiveUpstream ??= 0;

  const patchedFetch: typeof fetch = async (input, init) => {
    if (input instanceof Request) return originalFetch(input, init);

    let url: URL;
    try {
      url = input instanceof URL ? new URL(input.toString()) : new URL(String(input));
    } catch {
      return originalFetch(input, init);
    }

    const method = (init?.method || "GET").toUpperCase();
    if (url.hostname !== RESO_HOST || method !== "GET") {
      return originalFetch(input, init);
    }

    const normalizedUrl = normalizeEntityLookup(url);
    const mediaProxyUrl = mediaCollectionPropertyProxy(normalizedUrl);
    const key = normalizedUrl.toString();
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.freshUntil > now) {
      return responseFromSnapshot(cached);
    }

    // A BeachesMLS 429 applies to the feed/account, not only to the exact URL
    // that triggered it. Pause all new upstream queries during that cooldown.
    const providerBackoffUntil = fsrGlobal.__fsrResoProviderBackoffUntil ?? 0;
    if (providerBackoffUntil > now) {
      if (cached && cached.staleUntil > now) return responseFromSnapshot(cached, true);
      return temporaryResoFailureResponse(
        "throttled",
        Math.ceil((providerBackoffUntil - now) / 1_000),
      );
    }

    // A 5xx from this replication endpoint is usually provider-wide. Once one
    // request proves the feed is offline, stop every distinct crawler/search URL
    // from hammering the same unavailable service for the next few seconds.
    const providerUnavailableUntil = fsrGlobal.__fsrResoProviderUnavailableUntil ?? 0;
    if (providerUnavailableUntil > now) {
      if (cached && cached.staleUntil > now) return responseFromSnapshot(cached, true);
      return temporaryResoFailureResponse(
        "upstream_error",
        Math.ceil((providerUnavailableUntil - now) / 1_000),
      );
    }

    const circuitOpenUntil = fsrGlobal.__fsrResoCircuitOpenUntil ?? 0;
    if (circuitOpenUntil > now) {
      if (cached && cached.staleUntil > now) return responseFromSnapshot(cached, true);

      const remainingMs = circuitOpenUntil - now;
      if (remainingMs <= CIRCUIT_RECOVERY_GRACE_MS) {
        await wait(remainingMs);
      } else {
        return temporaryResoFailureResponse(
          "circuit_open",
          Math.ceil(remainingMs / 1_000),
        );
      }
    }

    const existing = inflight.get(key);
    if (existing) {
      // Do not make a visitor wait for a refresh when a usable prior response
      // already exists. The in-flight request will refresh the shared snapshot.
      if (cached && cached.staleUntil > now) return responseFromSnapshot(cached, true);
      return responseFromSnapshot(await existing);
    }

    const requestPromise = (async (): Promise<ResoSnapshot> => {
      const delayUntil = backoffUntil.get(key) ?? 0;
      if (delayUntil > Date.now()) {
        const stale = cache.get(key);
        if (stale && stale.staleUntil > Date.now()) return stale;

        const remainingMs = delayUntil - Date.now();
        if (remainingMs > MAX_BACKOFF_MS) {
          return snapshotFromResponse(temporaryResoFailureResponse(
            "upstream_error",
            Math.ceil(remainingMs / 1_000),
          ));
        }
        await wait(remainingMs);
      }

      const slotAcquired = await acquireUpstreamSlot(fsrGlobal);
      if (!slotAcquired) {
        const stale = cache.get(key);
        if (stale && stale.staleUntil > Date.now()) return stale;
        return snapshotFromResponse(temporaryResoFailureResponse("capacity_protected", 1));
      }

      const protectedRequest = timeoutProtectedInit(init);
      try {
        const upstreamResponse = await originalFetch(
          mediaProxyUrl ?? normalizedUrl,
          protectedRequest.init,
        );
        const response = mediaProxyUrl
          ? await unwrapPropertyMediaResponse(upstreamResponse)
          : upstreamResponse;
        const body = await response.arrayBuffer();
        const snapshot: ResoSnapshot = {
          body,
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.entries()),
          freshUntil: Date.now() + FRESH_TTL_MS,
          staleUntil: Date.now() + STALE_TTL_MS,
        };

        if (response.ok) {
          pruneFailures(failureTimes, Date.now());
          backoffUntil.delete(key);
          fsrGlobal.__fsrResoProviderUnavailableUntil = 0;
          cache.set(key, snapshot);
          trimCache(cache);
          return snapshot;
        }

        if (response.status === 429 || response.status >= 500) {
          recordFailure(fsrGlobal, failureTimes);

          const delay = response.status === 429
            ? retryAfterMilliseconds(response.headers.get("retry-after"))
              ?? DEFAULT_THROTTLE_BACKOFF_MS
            : MAX_BACKOFF_MS;
          backoffUntil.set(key, Date.now() + delay);

          if (response.status === 429) {
            fsrGlobal.__fsrResoProviderBackoffUntil = Math.max(
              fsrGlobal.__fsrResoProviderBackoffUntil ?? 0,
              Date.now() + delay,
            );
          } else {
            const providerDelay = retryAfterMilliseconds(response.headers.get("retry-after"))
              ?? PROVIDER_UNAVAILABLE_BACKOFF_MS;
            fsrGlobal.__fsrResoProviderUnavailableUntil = Math.max(
              fsrGlobal.__fsrResoProviderUnavailableUntil ?? 0,
              Date.now() + providerDelay,
            );
          }

          const stale = cache.get(key);
          if (stale && stale.staleUntil > Date.now()) return stale;

          // Do not return a raw upstream 5xx/429 into lib/idx.ts. That layer
          // retries raw 5xx responses, which can amplify an MLS outage and push
          // the page request into a Vercel 504. A protected response carries the
          // X-FSR-RESO-Fallback header, so the caller fails fast and renders the
          // existing unavailable state instead of retrying the provider.
          if (response.status === 429) {
            return snapshotFromResponse(temporaryResoFailureResponse(
              "throttled",
              Math.ceil(delay / 1_000),
            ));
          }
          return snapshotFromResponse(temporaryResoFailureResponse(
            "upstream_error",
            Math.ceil((fsrGlobal.__fsrResoProviderUnavailableUntil! - Date.now()) / 1_000),
          ));
        }

        // Preserve ordinary 4xx responses such as 400/404 because the listing
        // detail code intentionally uses them to decide whether to try its safe
        // collection lookup fallback.
        return snapshot;
      } catch {
        recordFailure(fsrGlobal, failureTimes);
        fsrGlobal.__fsrResoProviderUnavailableUntil = Math.max(
          fsrGlobal.__fsrResoProviderUnavailableUntil ?? 0,
          Date.now() + NETWORK_UNAVAILABLE_BACKOFF_MS,
        );
        const stale = cache.get(key);
        if (stale && stale.staleUntil > Date.now()) return stale;
        return snapshotFromResponse(temporaryResoFailureResponse("network_error"));
      } finally {
        protectedRequest.cleanup();
        releaseUpstreamSlot(fsrGlobal);
      }
    })();

    inflight.set(key, requestPromise);
    try {
      return responseFromSnapshot(await requestPromise);
    } finally {
      inflight.delete(key);
    }
  };

  globalThis.fetch = patchedFetch;
}