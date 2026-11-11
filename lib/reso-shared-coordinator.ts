import { createHash, randomUUID } from "node:crypto";

/** Server-only coordination beneath the existing response cache. The database,
 * rather than this process, owns admission, leases and recovery decisions. */
const RESO_HOST = "replication.sparkapi.com";
const DEFAULT_SCOPE = "fsr:beachesmls:idx:c1olzbsbg9nvhtjrrk0yvpa9e";
const RPC_TIMEOUT_MS = 1_200;
const DUPLICATE_WAIT_MS = 1_500;
const POLL_INTERVAL_MS = 150;
const MAX_SHARED_BODY_BYTES = 1_048_576;
const MAX_SNAPSHOT_BYTES = 2_097_152;
const SNAPSHOT_HEADERS = new Set([
  "content-type", "cache-control", "etag", "last-modified", "expires", "date", "vary",
]);

export type ResoSharedSnapshot = {
  body: string;
  status: number;
  headers: [string, string][];
};

export type ResoSharedIdentity = { scopeHash: string; queryHash: string; owner: string };
export type ResoSharedReason = "duplicate" | "capacity" | "budget" | "throttled" | "unavailable";
export type ResoSharedDecision =
  | { decision: "granted" }
  | { decision: "cached"; snapshot: ResoSharedSnapshot }
  | { decision: "waiting" | "paused"; reason: ResoSharedReason; retry_after_ms: number };
export type ResoSharedOutcome = "success" | "http_error" | "throttled" | "interrupted" | "cancelled" | "not_sent";
export type ResoSharedCompletion = ResoSharedIdentity & {
  outcome: ResoSharedOutcome;
  retryAfterMs: number;
  response: ResoSharedSnapshot | null;
};
export interface ResoSharedStore {
  acquire(identity: ResoSharedIdentity, signal?: AbortSignal | null): Promise<ResoSharedDecision>;
  finish(completion: ResoSharedCompletion): Promise<boolean>;
}

type CoordinationEvent = {
  kind: "coordination_unavailable" | "coordination_finish_unavailable" | "duplicate_wait_expired";
};
type CoordinatorOptions = {
  store: ResoSharedStore;
  scope?: string;
  now?: () => number;
  owner?: () => string;
  wait?: (milliseconds: number, signal?: AbortSignal | null) => Promise<void>;
  waitBudgetMs?: number;
  onEvent?: (event: CoordinationEvent) => void;
};

function isCallerCancellation(signal?: AbortSignal | null): boolean {
  if (!signal?.aborted) return false;
  try { return signal.reason?.name === "AbortError"; } catch { return false; }
}

function pause(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(signal?.reason); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function temporaryResponse(reason: ResoSharedReason | "coordination", remainingMs: number): Response {
  const throttled = reason === "throttled" || reason === "budget";
  const fallback = throttled ? "throttled"
    : reason === "capacity" || reason === "duplicate" ? "capacity_protected" : "upstream_error";
  const code = reason === "coordination" ? "RESO_COORDINATION_UNAVAILABLE"
    : reason === "duplicate" ? "RESO_DUPLICATE_PENDING"
    : reason === "unavailable" ? "RESO_UPSTREAM_UNAVAILABLE"
    : throttled ? "RESO_THROTTLED" : "RESO_CAPACITY_PROTECTED";
  return new Response(JSON.stringify({ error: { code, message: "MLS requests are temporarily paused. Please try again shortly." } }), {
    status: throttled ? 429 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": String(Math.max(1, Math.ceil(remainingMs / 1_000))),
      "X-FSR-RESO-Admission": "local",
      "X-FSR-RESO-Fallback": fallback,
      "X-FSR-RESO-Coordination": reason,
    },
  });
}

function retryAfterMs(value: string | null, now: number): number {
  if (!value?.trim()) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(seconds * 1_000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

function snapshotValid(value: unknown): value is ResoSharedSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as ResoSharedSnapshot;
  if (Object.keys(snapshot).some(key => !["body", "status", "headers"].includes(key))) return false;
  if (!Number.isInteger(snapshot.status) || snapshot.status < 200 || snapshot.status > 299) return false;
  if (typeof snapshot.body !== "string" || snapshot.body.length > MAX_SNAPSHOT_BYTES || snapshot.body.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(snapshot.body)) return false;
  if (!Array.isArray(snapshot.headers) || snapshot.headers.length > 8) return false;
  if (snapshot.headers.some(pair => !Array.isArray(pair) || pair.length !== 2
    || typeof pair[0] !== "string" || !SNAPSHOT_HEADERS.has(pair[0])
    || typeof pair[1] !== "string" || pair[1].length > 2_048 || /[\r\n]/.test(pair[1]))) return false;
  if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_SNAPSHOT_BYTES) return false;
  const body = Buffer.from(snapshot.body, "base64");
  if (body.length > MAX_SHARED_BODY_BYTES || body.toString("base64") !== snapshot.body) return false;
  return ![204, 205].includes(snapshot.status) || body.length === 0;
}

function responseFromSnapshot(snapshot: ResoSharedSnapshot): Response {
  const headers = new Headers(snapshot.headers);
  headers.set("X-FSR-RESO-Shared", "hit");
  return new Response([204, 205].includes(snapshot.status) ? null : Buffer.from(snapshot.body, "base64"), {
    status: snapshot.status, headers,
  });
}

function makeSnapshot(response: Response, body: ArrayBuffer): ResoSharedSnapshot | null {
  if (!response.ok || body.byteLength > MAX_SHARED_BODY_BYTES
    || /(?:^|,)\s*no-store\b/i.test(response.headers.get("cache-control") ?? "")
    || response.headers.get("vary")?.trim() === "*") return null;
  const headers: [string, string][] = [];
  for (const name of SNAPSHOT_HEADERS) {
    const value = response.headers.get(name);
    if (value !== null && value.length <= 2_048 && !/[\r\n]/.test(value)) headers.push([name, value]);
  }
  const snapshot = { body: Buffer.from(body).toString("base64"), status: response.status, headers };
  return snapshotValid(snapshot) ? snapshot : null;
}

/** Canonicalization affects the private hash only. The provider receives the
 * caller's original URL, query, method and headers without semantic changes. */
function identityFor(input: RequestInfo | URL, init: RequestInit | undefined, scope: string, owner: string): ResoSharedIdentity {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(request?.url ?? String(input));
  url.hash = "";
  url.searchParams.sort();
  const headers = new Headers(init?.headers ?? request?.headers);
  const scopeHash = createHash("sha256").update(scope).digest("hex");
  const queryHash = createHash("sha256").update(JSON.stringify([
    scopeHash, (init?.method ?? request?.method ?? "GET").toUpperCase(), url.toString(), [...headers.entries()],
  ])).digest("hex");
  return { scopeHash, queryHash, owner };
}

/** Wrap the worker-local admission policy, below the existing response cache.
 * Provider bodies are consumed before ownership is released: a response with
 * headers but a broken body is still an interrupted request. */
export function createResoSharedCoordinator(upstream: typeof fetch, options: CoordinatorOptions): typeof fetch {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? pause;
  const owner = options.owner ?? randomUUID;
  const scope = options.scope?.trim() || DEFAULT_SCOPE;
  const waitBudget = Math.max(0, Math.min(DUPLICATE_WAIT_MS, options.waitBudgetMs ?? DUPLICATE_WAIT_MS));
  const report = options.onEvent ?? (event => console.warn("[BeachesMLS RESO] Shared coordination deferred.", event));

  async function complete(identity: ResoSharedIdentity, outcome: ResoSharedOutcome, delay = 0, response: ResoSharedSnapshot | null = null): Promise<void> {
    // Completion has its own transport deadline. A disconnected visitor must
    // not cancel the database write that protects later visitors.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { await options.store.finish({ ...identity, outcome, retryAfterMs: delay, response }); return; } catch { /* Retry only the idempotent completion. */ }
    }
    report({ kind: "coordination_finish_unavailable" });
  }

  return async (input, init) => {
    let url: URL;
    try { url = new URL(input instanceof Request ? input.url : String(input)); } catch { return upstream(input, init); }
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.hostname !== RESO_HOST || method !== "GET") return upstream(input, init);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) {
      if (isCallerCancellation(signal)) throw signal.reason;
      return temporaryResponse("coordination", 1_000);
    }
    const identity = identityFor(input, init, scope, owner());
    const deadline = now() + waitBudget;
    let acquired = false;
    try {
      for (;;) {
        const result = await options.store.acquire(identity, signal);
        if (result.decision === "granted") { acquired = true; break; }
        if (result.decision === "cached") {
          if (!snapshotValid(result.snapshot)) throw new Error("Invalid shared MLS snapshot.");
          return responseFromSnapshot(result.snapshot);
        }
        if (result.decision !== "waiting" || result.reason !== "duplicate" || now() >= deadline) {
          if (result.reason === "duplicate") report({ kind: "duplicate_wait_expired" });
          return temporaryResponse(result.reason, result.retry_after_ms);
        }
        await wait(Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - now())), signal);
      }
    } catch {
      // An acquire can commit even if its response is lost. Releasing only our
      // owner is safe because no provider request has been dispatched here.
      await complete(identity, "not_sent");
      if (isCallerCancellation(signal)) throw signal?.reason;
      report({ kind: "coordination_unavailable" });
      return temporaryResponse("coordination", 1_000);
    }

    if (signal?.aborted) {
      if (acquired) await complete(identity, "not_sent");
      if (isCallerCancellation(signal)) throw signal.reason;
      return temporaryResponse("coordination", 1_000);
    }

    let response: Response | undefined;
    try {
      response = await upstream(input, init);
      if (response.headers.get("X-FSR-RESO-Admission") === "local") {
        await complete(identity, "not_sent");
        return response;
      }
      const delay = retryAfterMs(response.headers.get("retry-after"), now());
      const body = await response.arrayBuffer();
      const outcome = response.status === 429 ? "throttled" : response.status >= 500 ? "http_error" : "success";
      await complete(identity, outcome, delay, makeSnapshot(response, body));
      const headers = new Headers(response.headers);
      // Fetch has already decoded the body. These transport headers no longer
      // describe the reconstructed bytes and cannot be copied to shared hits.
      headers.delete("content-encoding");
      headers.delete("content-length");
      return new Response([204, 205, 304].includes(response.status) ? null : body, {
        status: response.status, statusText: response.statusText, headers,
      });
    } catch (error) {
      const delay = response ? retryAfterMs(response.headers.get("retry-after"), now()) : 0;
      // A known throttling response keeps its full penalty even if its body
      // was interrupted. An aborted body must never downgrade a known 429.
      const outcome = response?.status === 429 ? "throttled" : response && response.status >= 500 ? "http_error"
        : isCallerCancellation(signal) ? "cancelled" : "interrupted";
      await complete(identity, outcome, delay);
      throw error;
    }
  };
}

type StoreOptions = {
  url: string;
  publishableKey: string;
  secret: string;
  fetch: typeof fetch;
  timeoutMs?: number;
};

/** Supabase's publishable key identifies the project. The dedicated, server-only
 * coordinator secret is independently checked by the RPC and table policies. */
export function createResoCoordinatorStore(options: StoreOptions): ResoSharedStore {
  const base = new URL(options.url);
  if (base.protocol !== "https:" || base.username || base.password || !options.publishableKey || options.secret.length < 32) {
    throw new Error("Invalid MLS coordinator configuration.");
  }
  const timeout = Math.max(1, Math.min(RPC_TIMEOUT_MS, options.timeoutMs ?? RPC_TIMEOUT_MS));
  async function rpc(name: "fsr_mls_acquire" | "fsr_mls_finish", args: Record<string, unknown>, caller?: AbortSignal | null): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort(caller?.reason);
    const timer = setTimeout(() => controller.abort(new DOMException("MLS coordination timed out.", "TimeoutError")), timeout);
    if (caller?.aborted) abort();
    else caller?.addEventListener("abort", abort, { once: true });
    try {
      const response = await options.fetch(new URL(`/rest/v1/rpc/${name}`, base.origin), {
        method: "POST", cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
        headers: {
          apikey: options.publishableKey,
          "x-fsr-mls-coordinator": options.secret,
          "Content-Type": "application/json", Accept: "application/json",
        },
        body: JSON.stringify(args),
      });
      if (!response.ok) throw new Error("MLS coordination request failed.");
      return await response.json();
    } catch {
      // Transport and JSON-parser exceptions can contain response fragments or
      // URLs. They are never part of this driver's diagnostic contract.
      throw new Error("MLS coordination request failed.");
    } finally {
      clearTimeout(timer);
      caller?.removeEventListener("abort", abort);
    }
  }
  function args(identity: ResoSharedIdentity) {
    return { p_scope_hash: identity.scopeHash, p_query_hash: identity.queryHash, p_owner: identity.owner };
  }
  return {
    async acquire(identity, signal) {
      const result = await rpc("fsr_mls_acquire", args(identity), signal);
      if (!result || typeof result !== "object") throw new Error("Invalid MLS coordination decision.");
      const decision = result as ResoSharedDecision;
      if (decision.decision === "granted") return decision;
      if (decision.decision === "cached" && snapshotValid(decision.snapshot)) return decision;
      if ((decision.decision === "waiting" || decision.decision === "paused")
        && ["duplicate", "capacity", "budget", "throttled", "unavailable"].includes(decision.reason)
        && Number.isSafeInteger(decision.retry_after_ms) && decision.retry_after_ms >= 0) return decision;
      throw new Error("Invalid MLS coordination decision.");
    },
    async finish(completion) {
      const result = await rpc("fsr_mls_finish", {
        ...args(completion), p_outcome: completion.outcome,
        p_retry_after_ms: completion.retryAfterMs, p_response: completion.response,
      });
      if (typeof result !== "boolean") throw new Error("Invalid MLS coordination completion.");
      return result;
    },
  };
}
