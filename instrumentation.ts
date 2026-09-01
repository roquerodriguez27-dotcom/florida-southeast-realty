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
  __fsrResoFailureTimes?: number[];
  __fsrResoCircuitOpenUntil?: number;
  __fsrResoCircuitLoggedAt?: number;
};

const RESO_HOST = "replication.sparkapi.com";
const FRESH_TTL_MS = 60_000;
const STALE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const MAX_BACKOFF_MS = 3_000;
const FAILURE_WINDOW_MS = 30_000;
const FAILURE_THRESHOLD = 8;
const CIRCUIT_OPEN_MS = 3_000;
const CIRCUIT_RECOVERY_GRACE_MS = 1_200;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function responseFromSnapshot(snapshot: ResoSnapshot): Response {
  return new Response(snapshot.body.slice(0), {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: snapshot.headers,
  });
}

function temporaryResoFailureResponse(
  reason: "circuit_open" | "network_error",
  retryAfterSeconds = 5,
): Response {
  const code = reason === "circuit_open" ? "RESO_CIRCUIT_OPEN" : "RESO_NETWORK_ERROR";
  const message = reason === "circuit_open"
    ? "BeachesMLS RESO is temporarily protected by a circuit breaker."
    : "BeachesMLS RESO is temporarily unreachable.";

  return new Response(JSON.stringify({ error: { code, message } }), {
    status: 503,
    statusText: "Service Unavailable",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": String(Math.max(1, Math.min(30, Math.ceil(retryAfterSeconds)))),
      "X-FSR-RESO-Fallback": reason,
    },
  });
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
  fsrGlobal.__fsrResoFailureTimes = failureTimes;
  fsrGlobal.__fsrResoCircuitOpenUntil ??= 0;
  fsrGlobal.__fsrResoCircuitLoggedAt ??= 0;

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

    const circuitOpenUntil = fsrGlobal.__fsrResoCircuitOpenUntil ?? 0;
    if (circuitOpenUntil > now) {
      if (cached && cached.staleUntil > now) return responseFromSnapshot(cached);

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
      return responseFromSnapshot(await existing);
    }

    const requestPromise = (async (): Promise<ResoSnapshot> => {
      const delayUntil = backoffUntil.get(key) ?? 0;
      if (delayUntil > Date.now()) {
        await wait(Math.min(MAX_BACKOFF_MS, delayUntil - Date.now()));
      }

      try {
        const upstreamResponse = await originalFetch(mediaProxyUrl ?? normalizedUrl, init);
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
          cache.set(key, snapshot);
          trimCache(cache);
          return snapshot;
        }

        if (response.status === 429 || response.status >= 500) {
          recordFailure(fsrGlobal, failureTimes);

          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(MAX_BACKOFF_MS, retryAfter * 1_000)
            : MAX_BACKOFF_MS;
          backoffUntil.set(key, Date.now() + delay);

          const stale = cache.get(key);
          if (stale && stale.staleUntil > Date.now()) return stale;
        }

        return snapshot;
      } catch {
        recordFailure(fsrGlobal, failureTimes);
        const stale = cache.get(key);
        if (stale && stale.staleUntil > Date.now()) return stale;

        const fallback = temporaryResoFailureResponse("network_error");
        const body = await fallback.arrayBuffer();
        return {
          body,
          status: fallback.status,
          statusText: fallback.statusText,
          headers: Array.from(fallback.headers.entries()),
          freshUntil: Date.now(),
          staleUntil: Date.now(),
        };
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