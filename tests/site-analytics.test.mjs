import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => name in imports ? imports[name] : require(name), console: { error() {} }, Request, Response, URL, URLSearchParams, Blob, ...globals }, { filename: file });
  return exports;
}
const helpers = load("lib/analytics.ts");
const { parseVisitorReport } = load("lib/crm/analytics.ts");
const uuid = "82b59749-2c28-4cd2-9156-54e35dabff1a";
const input = { visitorId: uuid, sessionId: uuid, eventName: "page_view", path: "/properties?email=private@example.com", metadata: { signalVersion: "3", eventId: uuid, visitorType: "browser", email: "private@example.com", search: "123 Private Street" } };

function route({ environment = "production", cookieList = [], cookieFailure = false } = {}) {
  const captures = [];
  const instance = load("app/api/analytics/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "next/headers": { cookies: async () => {
      if (cookieFailure) throw new Error("cookie service unavailable");
      return { get: (name) => cookieList.find((cookie) => cookie.name === name), getAll: () => cookieList };
    } },
    "@/lib/api/request": { readSameOriginJson: async (request) => ({ ok: true, value: await request.json() }) },
    "@/lib/supabase/public": { createSupabasePublicClient: () => ({ rpc: async (...args) => { captures.push(args); return { data: true, error: null }; } }) },
    "@/lib/analytics": helpers,
  }, { process: { env: { VERCEL_ENV: environment } } });
  return { ...instance, captures };
}
function request(body = input, host = "floridasoutheastrealty.com") {
  return new Request(`https://${host}/api/analytics`, { method: "POST", headers: { "Content-Type": "application/json", Origin: `https://${host}` }, body: JSON.stringify(body) });
}

test("tracking gates exclude CRM/auth/API paths and nonproduction hosts", () => {
  for (const path of ["/crm", "/crm/analytics", "/api/search", "/auth/callback", "/CRM?x=1"]) assert.equal(helpers.isPublicAnalyticsPath(path), false);
  assert.equal(helpers.isPublicAnalyticsPath("/communities"), true);
  for (const [host, env] of [["localhost:3000", "production"], ["test.vercel.app", "production"], ["floridasoutheastrealty.com", "preview"], ["floridasoutheastrealty.com", undefined]]) assert.equal(helpers.isProductionAnalyticsRequest(host, env), false);
  assert.equal(helpers.isProductionAnalyticsRequest("www.floridasoutheastrealty.com", "production"), true);
});

test("path grouping and metadata discard query strings and caller-provided personal text", () => {
  assert.equal(helpers.analyticsPath("/properties/123?email=private@example.com"), "/properties/[listing]");
  assert.equal(helpers.analyticsPath("/blog/private-person#contact"), "/blog/[article]");
  assert.equal(helpers.analyticsPath("/sellers?name=Private"), "/sellers");
  assert.equal(helpers.analyticsPath("/unknown/private@example.com"), "/other");
  const clean = helpers.analyticsMetadata(input.metadata);
  assert.equal(clean.email, undefined);
  assert.equal(clean.search, undefined);
  assert.equal(clean.eventId, uuid);
});

test("API excludes staff, opted-out, preview and local requests before writing", async () => {
  for (const options of [{ cookieList: [{ name: "sb-example-auth-token.0", value: "present" }] }, { cookieList: [{ name: "fsr_analytics_opt_out", value: "1" }] }, { environment: "preview" }]) {
    const api = route(options);
    assert.equal((await (await api.GET(request())).json()).eligible, false);
    assert.equal((await (await api.POST(request())).json()).excluded, true);
    assert.equal(api.captures.length, 0);
  }
  const api = route();
  assert.equal((await (await api.POST(request(input, "localhost:3000"))).json()).excluded, true);
  assert.equal(api.captures.length, 0);
});

test("API eligibility fails closed and keeps production responses private", async () => {
  const api = route({ cookieFailure: true });
  const response = await api.GET(request());
  assert.equal((await response.json()).eligible, false);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await api.POST(request())).status, 503);
  assert.equal(api.captures.length, 0);
});

test("API captures only sanitized data with production measurement tagging", async () => {
  const api = route();
  assert.equal((await (await api.POST(request())).json()).stored, true);
  const captured = api.captures[0][1];
  assert.equal(captured.p_path, "/properties");
  assert.equal(captured.p_referrer_host, null);
  assert.equal(captured.p_metadata.trafficScope, "production");
  assert.equal(captured.p_metadata.email, undefined);
  assert.equal(captured.p_metadata.search, undefined);
  assert.equal((await api.POST(request({ ...input, path: "/crm" }))).status, 400);
});

function tracker({ eligible = true, optedOut = false, storedInteraction = false, hostname = "floridasoutheastrealty.com" } = {}) {
  const effects = [];
  const listeners = new Map();
  const bodies = [];
  const local = new Map(optedOut ? [[helpers.ANALYTICS_OPTOUT_KEY, "1"]] : []);
  const session = new Map(storedInteraction ? [["fsr-interaction-v3", "1"]] : []);
  const storage = (map) => ({ getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) });
  let sequence = 0;
  const instance = load("components/SiteAnalytics.tsx", {
    react: { useEffect: (effect) => effects.push(effect), useRef: (value) => ({ current: value }) },
    "next/navigation": { usePathname: () => "/properties", useSearchParams: () => new URLSearchParams("location=Private") },
    "@/lib/analytics": helpers,
  }, {
    window: { location: { pathname: "/properties", host: hostname }, localStorage: storage(local), sessionStorage: storage(session), addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    document: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener() {} },
    navigator: { userAgent: "Mozilla/5.0", webdriver: false, sendBeacon: (_url, blob) => { bodies.push(blob.text().then(JSON.parse)); return true; } },
    fetch: async () => ({ ok: true, json: async () => ({ eligible }) }),
    crypto: { randomUUID: () => `82b59749-2c28-4cd2-9156-${String(++sequence).padStart(12, "0")}` },
    Event,
  });
  instance.default();
  effects.forEach((effect) => effect());
  return { instance, listeners, events: async () => { await new Promise((resolve) => setImmediate(resolve)); return Promise.all(bodies); } };
}

test("tracker sends exactly one dedicated trusted-interaction signal per session", async () => {
  const client = tracker();
  client.listeners.get("pointerdown")({ isTrusted: false, type: "pointerdown" });
  assert.equal((await client.events()).filter((event) => event.eventName === "visitor_interaction").length, 0);
  client.listeners.get("pointerdown")({ isTrusted: true, type: "pointerdown" });
  client.listeners.get("keydown")({ isTrusted: true, type: "keydown" });
  const events = await client.events();
  const interactions = events.filter((event) => event.eventName === "visitor_interaction");
  assert.equal(interactions.length, 1);
  assert.equal(interactions[0].metadata.interactionObserved, true);
  assert.equal(interactions[0].metadata.interactionKind, "pointer");
  assert.equal(events.filter((event) => event.eventName === "property_search").length, 1);
  client.instance.trackSiteEvent("property_search", { action: "continue_search" });
  assert.equal((await client.events()).filter((event) => event.eventName === "property_search").length, 1);
  assert.ok(events.every((event) => !event.path.includes("?")));
});

test("tracker excludes ineligible devices and honors an already-recorded interaction", async () => {
  for (const options of [{ eligible: false }, { optedOut: true }, { hostname: "test.vercel.app" }]) {
    const client = tracker(options);
    client.listeners.get("pointerdown")({ isTrusted: true, type: "pointerdown" });
    assert.equal((await client.events()).length, 0);
  }
  const client = tracker({ storedInteraction: true });
  client.listeners.get("pointerdown")({ isTrusted: true, type: "pointerdown" });
  assert.equal((await client.events()).filter((event) => event.eventName === "visitor_interaction").length, 0);
});

test("report parser rejects unavailable, malformed and negative data instead of inventing zeros", () => {
  const report = { days: 7, generatedAt: "2026-11-06T00:00:00Z", from: "2026-10-30T00:00:00Z", current: Object.fromEntries(["browsers", "sessions", "interactionBrowsers", "probableAutomationBrowsers", "unclassifiedBrowsers", "pageviews", "searches", "leads", "savedSearches"].map((key) => [key, 0])), legacy: { events: 10, browsers: 5 }, daily: [], topPages: [] };
  assert.equal(parseVisitorReport(report), report);
  for (const value of [null, {}, { ...report, current: {} }, { ...report, current: { ...report.current, browsers: -1 } }, { ...report, daily: [null] }, { ...report, topPages: [null] }]) assert.equal(parseVisitorReport(value), null);
});
