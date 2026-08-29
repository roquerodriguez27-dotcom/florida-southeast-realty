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
};

const RESO_HOST = "replication.sparkapi.com";
const FRESH_TTL_MS = 30_000;
const STALE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const MAX_BACKOFF_MS = 2_500;

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

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const fsrGlobal = globalThis as FsrGlobal;
  if (fsrGlobal.__fsrOriginalFetch) return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  const inflight = fsrGlobal.__fsrResoInflight ?? new Map<string, Promise<ResoSnapshot>>();
  const cache = fsrGlobal.__fsrResoCache ?? new Map<string, ResoSnapshot>();
  const backoffUntil = fsrGlobal.__fsrResoBackoffUntil ?? new Map<string, number>();

  fsrGlobal.__fsrOriginalFetch = originalFetch;
  fsrGlobal.__fsrResoInflight = inflight;
  fsrGlobal.__fsrResoCache = cache;
  fsrGlobal.__fsrResoBackoffUntil = backoffUntil;

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
    const key = normalizedUrl.toString();
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.freshUntil > now) {
      return responseFromSnapshot(cached);
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
        const response = await originalFetch(normalizedUrl, init);
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
          backoffUntil.delete(key);
          cache.set(key, snapshot);
          trimCache(cache);
          return snapshot;
        }

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(MAX_BACKOFF_MS, retryAfter * 1_000)
            : MAX_BACKOFF_MS;
          backoffUntil.set(key, Date.now() + delay);

          const stale = cache.get(key);
          if (stale && stale.staleUntil > Date.now()) return stale;
        }

        return snapshot;
      } catch (error) {
        const stale = cache.get(key);
        if (stale && stale.staleUntil > Date.now()) return stale;
        throw error;
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