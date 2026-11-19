import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as listingTypes from "../lib/types.ts";

const realRequire = createRequire(import.meta.url);
const SITE = { url: "https://brokerage.example.test", email: "broker@example.test", shortName: "Test Brokerage" };
const TOKEN = "00000000-0000-4000-8000-000000000001";
const WORKER_TOKEN = "synthetic-worker-token-only";
const plain = value => JSON.parse(JSON.stringify(value));

function compile(path, jsx = false) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) },
  }).outputText;
}

function mailHarness({ apiKey = "test-key-not-a-secret", providerStatus = 200, providerCode = "synthetic_provider_result", providerThrows = false } = {}) {
  const emails = [], errors = [];
  const loaded = { exports: {} };
  vm.runInNewContext(compile("../lib/saved-search-worker.ts"), {
    module: loaded, exports: loaded.exports, URL, AbortSignal,
    process: { env: { RESEND_API_KEY: apiKey } },
    console: { error: (...args) => errors.push(args) },
    fetch: async (url, init) => {
      assert.equal(url, "https://api.resend.com/emails");
      emails.push({ payload: JSON.parse(init.body), idempotency: init.headers["Idempotency-Key"] });
      if (providerThrows) throw new Error("Synthetic provider outage");
      return new Response(JSON.stringify({ name: providerCode }), { status: providerStatus });
    },
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return { createHash };
      if (name === "@/lib/site-config") return { SITE };
      if (name === "@/lib/types") return listingTypes;
      throw new Error("Unexpected mail dependency: " + name);
    },
  });
  return { ...loaded.exports, emails, errors };
}

const listing = (id, overrides = {}) => ({
  mlsId: id, slug: "synthetic-" + id, address: "Synthetic test property " + id,
  price: 400000, status: "Active", ...overrides,
});

function processHarness({
  firstRun = false,
  previous = [listing("existing")],
  listings = [listing("existing")],
  flags = {},
  snapshotUnavailable = false,
  snapshotThrows = false,
  rpcResult,
  ...mailOptions
} = {}) {
  const mail = mailHarness(mailOptions);
  const rpcCalls = [], snapshots = [], logs = [];
  const search = {
    search_id: "synthetic-search", full_name: "Test owner", email: "owner@example.test", frequency: "instant",
    criteria: { locations: "Boynton Beach", maxPrice: "525000" },
    alert_new_matches: true, alert_price_changes: true, alert_back_on_market: true,
    last_snapshot: previous, unsubscribe_token: TOKEN, first_run: firstRun, ...flags,
  };
  const loaded = { exports: {} };
  vm.runInNewContext(compile("../app/api/saved-search/process/route.ts"), {
    module: loaded, exports: loaded.exports,
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    setTimeout: callback => { callback(); return 0; },
    require(name) {
      if (name === "next/server") return realRequire(name);
      if (name === "@/lib/supabase/public") return { createSupabasePublicClient: () => ({
        rpc: async (name, args) => {
          rpcCalls.push({ name, args: plain(args) });
          if (rpcResult) {
            const response = rpcResult(name, args, rpcCalls);
            if (response !== undefined) return response;
          }
          return { data: name === "claim_due_saved_searches" ? [search] : true, error: null };
        },
      }) };
      if (name === "@/lib/idx") return { fetchLiveListingSnapshot: async filters => {
        snapshots.push(plain(filters));
        if (snapshotThrows) throw new Error("Synthetic MLS outage");
        return { live: true, unavailable: snapshotUnavailable, listings };
      } };
      if (name === "@/lib/saved-search-worker") return mail;
      throw new Error("Unexpected process dependency: " + name);
    },
  });
  return {
    mail, rpcCalls, snapshots, logs,
    async run(authorization = "Bearer " + WORKER_TOKEN) {
      const response = await loaded.exports.POST(new Request(SITE.url + "/api/saved-search/process", {
        method: "POST", headers: authorization ? { authorization } : {},
      }));
      return { response, body: await response.json() };
    },
  };
}

test("worker requires authorization before touching subscriptions, MLS, or email", async () => {
  const h = processHarness();
  const { response } = await h.run(null);
  assert.equal(response.status, 401);
  assert.equal(h.rpcCalls.length + h.snapshots.length + h.mail.emails.length, 0);
});

test("first evaluation records the real baseline without sending a customer email", async () => {
  const h = processHarness({ firstRun: true, previous: [], listings: [listing("fresh")] });
  const { body } = await h.run();
  assert.deepEqual(body, { ok: true, claimed: 1, evaluated: 1, sent: 0, deferred: 0, failed: 0 });
  assert.equal(h.mail.emails.length, 0);
  assert.deepEqual(h.snapshots, [{ locations: ["Boynton Beach"], maxPrice: 525000, sort: "newest" }]);
  const completion = h.rpcCalls.find(call => call.name === "complete_saved_search_evaluation");
  assert.equal(completion.args.p_sent, false);
  assert.deepEqual(completion.args.p_snapshot, [{ mlsId: "fresh", slug: "synthetic-fresh", address: "Synthetic test property fresh", price: 400000, status: "Active" }]);
});

test("unchanged listings advance evaluation without inventing new matches", async () => {
  const h = processHarness();
  const { body } = await h.run();
  assert.equal(body.evaluated, 1);
  assert.equal(body.sent, 0);
  assert.equal(h.mail.emails.length, 0);
  assert.equal(h.rpcCalls.at(-1).args.p_sent, false);
});

test("real delta categories produce one subscriber email with correct links and prices", async () => {
  const h = processHarness({
    previous: [listing("price", { price: 425000 }), listing("returned", { status: "Pending" })],
    listings: [listing("fresh"), listing("price"), listing("returned")],
  });
  const { body } = await h.run();
  assert.equal(body.sent, 1);
  assert.equal(h.mail.emails.length, 1);
  const { payload } = h.mail.emails[0];
  assert.deepEqual(payload.to, ["owner@example.test"]);
  assert.match(payload.text, /NEW MATCHES\nSynthetic test property fresh/);
  assert.match(payload.text, /PRICE CHANGES\nSynthetic test property price — \$425,000 → \$400,000/);
  assert.match(payload.text, /BACK ON MARKET\nSynthetic test property returned/);
  assert.ok(payload.text.includes(SITE.url + "/properties/synthetic-fresh"));
  assert.ok(payload.text.includes(SITE.url + "/api/saved-search/unsubscribe?token=" + TOKEN));
  assert.equal(h.rpcCalls.at(-1).args.p_sent, true);
});

test("disabled change preferences suppress email even when the snapshot differs", async () => {
  const h = processHarness({ previous: [], listings: [listing("fresh")],
    flags: { alert_new_matches: false, alert_price_changes: false, alert_back_on_market: false } });
  const { body } = await h.run();
  assert.equal(body.sent, 0);
  assert.equal(h.mail.emails.length, 0);
  assert.equal(h.rpcCalls.at(-1).args.p_sent, false);
});

for (const [label, options] of [
  ["unavailable MLS data", { snapshotUnavailable: true }],
  ["MLS transport failure", { snapshotThrows: true }],
  ["missing email configuration", { apiKey: "", previous: [] }],
  ["provider rejection", { providerStatus: 503, previous: [] }],
  ["email transport failure", { providerThrows: true, previous: [] }],
]) {
  test(label + " preserves the prior snapshot for a later retry", async () => {
    const h = processHarness(options);
    const { body } = await h.run();
    assert.equal(body.sent, 0);
    assert.equal(body.evaluated, 0);
    assert.equal(h.rpcCalls.some(call => call.name === "complete_saved_search_evaluation"), false);
    assert.equal(h.rpcCalls.at(-1).name, "release_saved_search_claim");
  });
}

test("retrying an unchanged outgoing alert keeps the same provider idempotency key", async () => {
  const h = processHarness({ previous: [] });
  await h.run();
  await h.run();
  assert.equal(h.mail.emails.length, 2);
  assert.equal(h.mail.emails[0].idempotency, h.mail.emails[1].idempotency);
  assert.deepEqual(h.mail.emails[0].payload, h.mail.emails[1].payload);
});

test("invalid worker token stops after one attempt and reports that actual attempt count", async () => {
  const h = processHarness({ rpcResult: () => ({ data: null, error: { code: "28000" } }) });
  const { response, body } = await h.run();
  assert.equal(response.status, 401);
  assert.equal(body.temporary, false);
  assert.equal(h.rpcCalls.length, 1);
  assert.equal(h.logs[0][1].attempts, 1);
  assert.equal(h.mail.emails.length, 0);
});

test("temporary claim failure retries within its cap and exposes a retryable response", async () => {
  const h = processHarness({ rpcResult: () => ({ data: null, error: { code: "PGRST000" } }) });
  const { response, body } = await h.run();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "30");
  assert.equal(body.temporary, true);
  assert.equal(h.rpcCalls.length, 3);
  assert.equal(h.mail.emails.length, 0);
});

test("snapshot persistence failure after mail acceptance remains a reported failure", async () => {
  const h = processHarness({ previous: [], rpcResult: name => name === "complete_saved_search_evaluation"
    ? { data: null, error: { code: "PGRST000" } } : undefined });
  const { body } = await h.run();
  assert.equal(body.sent, 1, "The provider accepted the request; this is not an inbox receipt assertion.");
  assert.equal(body.evaluated, 0);
  assert.equal(body.failed, 1);
  assert.equal(h.mail.emails.length, 1);
  assert.equal(h.rpcCalls.filter(call => call.name === "complete_saved_search_evaluation").length, 3);
  assert.equal(h.rpcCalls.at(-1).name, "release_saved_search_claim");
});

function unsubscribeHarness({ data = true, error = null, throws = false } = {}) {
  const calls = [], logs = [];
  const loaded = { exports: {} };
  vm.runInNewContext(compile("../app/api/saved-search/unsubscribe/route.ts"), {
    module: loaded, exports: loaded.exports, URL,
    console: { error: (...args) => logs.push(args) },
    require(name) {
      if (name === "next/server") return realRequire(name);
      if (name === "@/lib/site-config") return { SITE };
      if (name === "@/lib/supabase/public") return { createSupabasePublicClient: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args: plain(args) });
          if (throws) throw new Error("Synthetic transport failure");
          return { data, error };
        },
      }) };
      throw new Error("Unexpected unsubscribe dependency: " + name);
    },
  });
  return { calls, logs, run: token => loaded.exports.GET(new Request(
    "https://preview.example.test/api/saved-search/unsubscribe" + (token === undefined ? "" : "?token=" + encodeURIComponent(token)),
  )) };
}

test("confirmed unsubscribe redirects to the same preview with a token-free, uncached result", async () => {
  const h = unsubscribeHarness();
  const response = await h.run(TOKEN);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://preview.example.test/properties?alert=unsubscribed");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(h.calls, [{ name: "unsubscribe_saved_search", args: { p_token: TOKEN } }]);
});

test("missing or malformed unsubscribe tokens never reach the database", async () => {
  const h = unsubscribeHarness();
  for (const token of [undefined, "", "not-a-token"]) {
    const response = await h.run(token);
    assert.equal(new URL(response.headers.get("location")).searchParams.get("alert"), "invalid");
  }
  assert.equal(h.calls.length, 0);
});

test("a no-change result is distinguished from a confirmed unsubscribe", async () => {
  const response = await unsubscribeHarness({ data: false }).run(TOKEN);
  assert.equal(new URL(response.headers.get("location")).searchParams.get("alert"), "already-unsubscribed");
});

for (const [label, options] of [
  ["RPC error", { error: { code: "PGRST000" } }],
  ["transport exception", { throws: true }],
  ["unexpected result", { data: null }],
]) {
  test(label + " never claims that an unsubscribe succeeded", async () => {
    const h = unsubscribeHarness(options);
    const response = await h.run(TOKEN);
    assert.equal(new URL(response.headers.get("location")).searchParams.get("alert"), "unsubscribe-error");
    assert.doesNotMatch(JSON.stringify(h.logs), new RegExp(TOKEN));
  });
}

function loadFeedback() {
  const loaded = { exports: {} };
  vm.runInNewContext(compile("../components/SavedSearchFeedback.tsx", true), {
    module: loaded, exports: loaded.exports,
    require(name) {
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "@/lib/site-config") return { SITE };
      throw new Error("Unexpected feedback dependency: " + name);
    },
  });
  return loaded.exports.default;
}

test("unsubscribe outcomes render distinct accessible messages with a contact fallback", () => {
  const Feedback = loadFeedback();
  const success = renderToStaticMarkup(React.createElement(Feedback, { status: "unsubscribed" }));
  assert.match(success, /role="status"/);
  assert.match(success, /alerts are turned off/);
  const inactive = renderToStaticMarkup(React.createElement(Feedback, { status: "already-unsubscribed" }));
  assert.match(inactive, /link is no longer active/);
  assert.doesNotMatch(inactive, /alerts are turned off/);
  for (const status of ["invalid", "unsubscribe-error"]) {
    const markup = renderToStaticMarkup(React.createElement(Feedback, { status }));
    assert.match(markup, /role="alert"/);
    assert.ok(markup.includes("mailto:" + SITE.email));
    assert.doesNotMatch(markup, /alerts are turned off/);
  }
  for (const status of [undefined, "unknown", "__proto__", ["unsubscribed", "unsubscribe-error"], "<script>bad</script>"]) {
    assert.equal(renderToStaticMarkup(React.createElement(Feedback, { status })), "");
  }
});

test("the actual properties page displays an unsubscribe result from its search parameters", async () => {
  const Feedback = loadFeedback();
  const loaded = { exports: {} };
  const emptyComponent = () => null;
  vm.runInNewContext(compile("../app/properties/page.tsx", true), {
    module: loaded, exports: loaded.exports, URLSearchParams,
    require(name) {
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "next/link") return { default: ({ children, href }) => React.createElement("a", { href }, children) };
      if (name === "@/lib/listings") return { searchListingPage: async () => ({
        live: true, unavailable: false, listings: [],
        pagination: { page: 1, pageSize: 24, totalPages: 1, totalRows: 0, totalRowsExact: true },
      }) };
      if (name === "@/lib/idx") return { IDX_PROVIDER: "reso" };
      if (name === "@/lib/types") return listingTypes;
      if (name === "@/lib/south-florida-locations") return { MAX_SEARCH_LOCATIONS: 20 };
      if (name === "@/components/SavedSearchFeedback") return { default: Feedback };
      if (name === "@/components/IdxAttribution") return { IdxPageDisclaimer: emptyComponent };
      if (name.startsWith("@/components/")) return { default: emptyComponent };
      throw new Error("Unexpected property-page dependency: " + name);
    },
  });
  const html = renderToStaticMarkup(await loaded.exports.default({ searchParams: Promise.resolve({ alert: "unsubscribed" }) }));
  assert.match(html, /Your saved-search alerts are turned off/);
  assert.match(html, /role="status"/);
});

function brokerTestHarness({
  now = "2026-11-17T03:45:00Z",
  snapshot = { live: true, unavailable: false, listings: [listing("owner-sample")] },
  snapshotThrows = false,
  ...mailOptions
} = {}) {
  const mail = mailHarness(mailOptions);
  const snapshots = [];
  const loaded = { exports: {} };
  class TestDate extends Date { constructor(value) { super(value === undefined ? now : value); } }
  vm.runInNewContext(compile("../lib/crm/test-listing-alert.ts"), {
    module: loaded, exports: loaded.exports, Date: TestDate,
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return { createHash };
      if (name === "zod") return realRequire(name);
      if (name === "@/lib/idx") return { fetchLiveListingSnapshot: async filters => {
        snapshots.push(plain(filters));
        if (snapshotThrows) throw new Error("Private synthetic failure detail");
        return snapshot;
      } };
      if (name === "@/lib/saved-search-worker") return mail;
      throw new Error("Unexpected broker-test dependency: " + name);
    },
  });
  return { mail, snapshots, run: input => loaded.exports.sendBrokerListingAlertTest(input) };
}

test("broker test renders one current MLS home to only the authenticated email, without a subscription or change claim", async () => {
  const h = brokerTestHarness();
  const result = await h.run({ brokerEmail: "  BROKER@Example.test  ", to: "untrusted@example.test" });
  assert.equal(result.accepted, true);
  assert.match(result.message, /provider accepted/);
  assert.match(result.message, /Check your inbox/);
  assert.match(result.message, /one sample per UTC day/);
  assert.match(result.testId, /^FSR-ALERT-TEST-20261117-[a-f0-9]{16}$/);
  assert.deepEqual(h.snapshots, [{ locations: ["Boynton Beach"], listingStatus: "active", sort: "newest" }]);
  assert.equal(h.mail.emails.length, 1);
  const { payload } = h.mail.emails[0];
  assert.deepEqual(payload.to, ["broker@example.test"]);
  assert.equal(payload.cc, undefined);
  assert.equal(payload.bcc, undefined);
  assert.match(payload.subject, /^TEST ONLY — Saved-search email/);
  assert.ok(payload.subject.includes(result.testId));
  assert.match(payload.text, /CURRENT MATCHING HOME \(DELIVERY TEST\)\nSynthetic test property owner-sample — \$400,000/);
  assert.doesNotMatch(payload.text, /NEW MATCHES|PRICE CHANGES|BACK ON MARKET|unsubscribe\?token=/);
  assert.match(payload.text, /No saved-search subscription was created/);
  assert.equal(result.listingAddress, "Synthetic test property owner-sample");
});

test("broker test keeps one daily request key despite repeat clicks and changed live inventory", async () => {
  const a = brokerTestHarness();
  const b = brokerTestHarness({ now: "2026-11-17T21:00:00Z", snapshot: { live: true, listings: [listing("changed", { price: 410000 })] } });
  const nextDay = brokerTestHarness({ now: "2026-11-18T00:01:00Z" });
  const first = await a.run({ brokerEmail: "broker@example.test" });
  const second = await b.run({ brokerEmail: "BROKER@example.test" });
  const tomorrow = await nextDay.run({ brokerEmail: "broker@example.test" });
  assert.equal(first.testId, second.testId);
  assert.equal(a.mail.emails[0].idempotency, b.mail.emails[0].idempotency);
  assert.notEqual(first.testId, tomorrow.testId);
  assert.notEqual(a.mail.emails[0].idempotency, nextDay.mail.emails[0].idempotency);
});

for (const providerCode of ["invalid_idempotent_request", "concurrent_idempotent_requests"]) {
  test("broker test reports " + providerCode + " without claiming inbox delivery", async () => {
    const h = brokerTestHarness({ providerStatus: 409, providerCode });
    const result = await h.run({ brokerEmail: "broker@example.test" });
    assert.equal(result.accepted, false);
    assert.equal(result.alreadyRequested, true);
    assert.match(result.message, /already requested/);
    assert.match(result.message, /does not confirm inbox delivery/);
    assert.equal(result.listingAddress, undefined);
    assert.equal(h.mail.emails.length, 1);
  });
}

for (const [label, options] of [
  ["missing MLS connection", { snapshot: null }],
  ["demonstration data", { snapshot: { live: false, listings: [listing("demo")] } }],
  ["unavailable inventory", { snapshot: { live: true, unavailable: true, listings: [listing("stale")] } }],
  ["empty inventory", { snapshot: { live: true, listings: [] } }],
  ["invalid listing details", { snapshot: { live: true, listings: [listing("bad", { price: 0 })] } }],
  ["inactive listing", { snapshot: { live: true, listings: [listing("pending", { status: "Pending" })] } }],
  ["MLS exception", { snapshotThrows: true }],
  ["missing email configuration", { apiKey: "" }],
]) {
  test("broker test refuses " + label + " without sending mail", async () => {
    const h = brokerTestHarness(options);
    const result = await h.run({ brokerEmail: "broker@example.test" });
    assert.equal(result.accepted, false);
    assert.equal(h.mail.emails.length, 0);
    assert.doesNotMatch(result.message, /Private synthetic failure detail/);
  });
}

test("invalid authenticated email is refused before any MLS or provider call", async () => {
  const h = brokerTestHarness();
  const result = await h.run({ brokerEmail: "invalid@example.test\nBcc: outsider@example.test" });
  assert.equal(result.accepted, false);
  assert.equal(h.snapshots.length + h.mail.emails.length, 0);
});

test("a non-idempotency provider failure stays unconfirmed rather than looking like a previous test", async () => {
  const h = brokerTestHarness({ providerStatus: 403, providerCode: "validation_error" });
  const result = await h.run({ brokerEmail: "broker@example.test" });
  assert.equal(result.accepted, false);
  assert.equal(result.alreadyRequested, undefined);
  assert.match(result.message, /did not confirm acceptance/);
  assert.doesNotMatch(result.message, /already requested/);
});

test("ordinary subscriber template remains unchanged when test mode is absent", async () => {
  const h = mailHarness();
  const result = await h.sendSavedSearchEmail({
    email: "owner@example.test", frequency: "daily", searchId: "original-search", unsubscribeToken: TOKEN,
    changes: { newMatches: [listing("original")], priceChanges: [], backOnMarket: [] },
  });
  assert.equal(result.delivered, true);
  assert.deepEqual(h.emails[0].payload, {
    from: "Florida Southeast Realty <website@brokerage.example.test>",
    to: ["owner@example.test"], subject: "New South Florida homes match your saved search",
    text: [
      "Florida Southeast Realty daily saved-search update", "",
      "NEW MATCHES\nSynthetic test property original — $400,000 — https://brokerage.example.test/properties/synthetic-original", "",
      "Listings can change quickly. Verify availability, property details, taxes, association fees, insurance, and other costs before making a decision.", "",
      "Search current South Florida homes: https://brokerage.example.test/properties",
      "Stop these alerts: https://brokerage.example.test/api/saved-search/unsubscribe?token=" + TOKEN,
    ].join("\n"),
  });
});
