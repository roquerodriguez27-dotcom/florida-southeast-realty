import "server-only";

const RESO_HOST = "replication.sparkapi.com";
const CACHE_TTL_MS = 20_000;
const CACHE_MAX_ENTRIES = 100;
const CACHE_MAX_BODY_BYTES = 2_000_000;
const FAILURE_WINDOW_MS = 20_000;
const FAILURE_THRESHOLD = 4;
const CIRCUIT_OPEN_MS = 15_000;

interface CachedResponse {
  expiresAt: number;
  status: number;
  statusText: string;
  headers: [string, string][];
  body: ArrayBuffer;
}

interface ResilienceState {
  installed: boolean;
  originalFetch: typeof fetch;
  inflight: Map<string, Promise<Response>>;
  cache: Map<string, CachedResponse>;
  failureTimes: number[];
  circuitOpenUntil: number;
  lastCircuitLogAt: number;
}

type ResilienceGlobal = typeof globalThis & {
  __fsreResoFetchResilience?: ResilienceState;
};

function responseFromCache(entry: CachedResponse): Response {
  return new Response(entry.body.slice(0), {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1_000, 30_000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const delay = timestamp - Date.now();
  return delay > 0 ? Math.min(delay, 30_000) : null;
}

function pruneCache(state: ResilienceState, now: number) {
  for (const [key, entry] of state.cache) {
    if (entry.expiresAt <= now) state.cache.delete(key);
  }
  while (state.cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = state.cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    state.cache.delete(oldestKey);
  }
}

function recordSuccess(state: ResilienceState) {
  const cutoff = Date.now() - FAILURE_WINDOW_MS;
  state.failureTimes = state.failureTimes.filter((time) => time >= cutoff);
}

function recordFailure(state: ResilienceState, retryAfter: string | null = null) {
  const now = Date.now();
  const cutoff = now - FAILURE_WINDOW_MS;
  state.failureTimes = state.failureTimes.filter((time) => time >= cutoff);
  state.failureTimes.push(now);

  const retryDelay = retryAfterMilliseconds(retryAfter);
  const shouldOpen = retryDelay !== null || state.failureTimes.length >= FAILURE_THRESHOLD;
  if (!shouldOpen) return;

  state.circuitOpenUntil = Math.max(
    state.circuitOpenUntil,
    now + (retryDelay ?? CIRCUIT_OPEN_MS),
  );

  if (now - state.lastCircuitLogAt > 10_000) {
    state.lastCircuitLogAt = now;
    console.warn("[BeachesMLS RESO] Circuit breaker opened to protect upstream capacity.", {
      failuresInWindow: state.failureTimes.length,
      openForMs: state.circuitOpenUntil - now,
    });
  }
}

async function cacheSuccessfulResponse(
  state: ResilienceState,
  key: string,
  response: Response,
) {
  try {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > CACHE_MAX_BODY_BYTES) return;

    const body = await response.arrayBuffer();
    if (body.byteLength > CACHE_MAX_BODY_BYTES) return;

    state.cache.delete(key);
    state.cache.set(key, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      body,
    });
    pruneCache(state, Date.now());
  } catch {
    // Caching is best-effort. The live response still goes to the caller.
  }
}

function requestUrl(input: RequestInfo | URL): string | null {
  try {
    if (typeof input === "string") return new URL(input).toString();
    if (input instanceof URL) return input.toString();
    return new URL(input.url).toString();
  } catch {
    return null;
  }
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function getState(): ResilienceState {
  const root = globalThis as ResilienceGlobal;
  if (!root.__fsreResoFetchResilience) {
    root.__fsreResoFetchResilience = {
      installed: false,
      originalFetch: globalThis.fetch.bind(globalThis),
      inflight: new Map(),
      cache: new Map(),
      failureTimes: [],
      circuitOpenUntil: 0,
      lastCircuitLogAt: 0,
    };
  }
  return root.__fsreResoFetchResilience;
}

export function installResoFetchResilience() {
  const state = getState();
  if (state.installed) return;
  state.installed = true;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlString = requestUrl(input);
    if (!urlString) return state.originalFetch(input, init);

    const url = new URL(urlString);
    if (url.hostname !== RESO_HOST || requestMethod(input, init) !== "GET") {
      return state.originalFetch(input, init);
    }

    const now = Date.now();
    pruneCache(state, now);

    if (state.circuitOpenUntil > now) {
      const error = new Error("BeachesMLS RESO circuit temporarily open.") as Error & { code?: string };
      error.code = "RESO_CIRCUIT_OPEN";
      throw error;
    }

    const key = url.toString();
    const cached = state.cache.get(key);
    if (cached && cached.expiresAt > now) return responseFromCache(cached);

    const pending = state.inflight.get(key);
    if (pending) {
      const sharedResponse = await pending;
      return sharedResponse.clone();
    }

    const requestPromise = (async () => {
      try {
        const response = await state.originalFetch(input, init);

        if (response.ok) {
          recordSuccess(state);
          void cacheSuccessfulResponse(state, key, response.clone());
        } else if ([429, 502, 503, 504].includes(response.status)) {
          recordFailure(state, response.status === 429 ? response.headers.get("retry-after") : null);
        }

        return response;
      } catch (error) {
        recordFailure(state);
        throw error;
      } finally {
        state.inflight.delete(key);
      }
    })();

    state.inflight.set(key, requestPromise);
    const response = await requestPromise;
    return response.clone();
  }) as typeof fetch;
}
