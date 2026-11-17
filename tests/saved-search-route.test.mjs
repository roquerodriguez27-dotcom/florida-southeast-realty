import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const realRequire = createRequire(import.meta.url);
const routeCode = ts.transpileModule(
  readFileSync(new URL("../app/api/saved-search/route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

const validPayload = {
  email: "BUYER@example.test",
  frequency: "instant",
  criteria: { locations: "Boynton Beach", maxPrice: "525000", privatePoolOnly: true },
};

// Exercise the real route, Zod validation, and NextResponse serialization.
// Replace external services only; no database records or emails are created.
function harness({
  rpcResult = { data: false, error: null },
  idx = { connected: true, idxRoleVerified: true },
  notification = { configured: true, delivered: true },
  apiKey = "test-key-not-a-secret",
} = {}) {
  const rpcCalls = [], notifications = [], order = [], errors = [];
  const exported = { exports: {} };
  vm.runInNewContext(routeCode, {
    module: exported,
    exports: exported.exports,
    process: { env: { RESEND_API_KEY: apiKey } },
    console: { error: (...args) => errors.push(args) },
    fetch() { assert.fail("Saved-search registration must not send subscriber email or call another service directly."); },
    require(name) {
      if (name === "next/server" || name === "zod") return realRequire(name);
      if (name === "@/lib/api/request") {
        return { readSameOriginJson: async request => ({ ok: true, value: await request.json() }) };
      }
      if (name === "@/lib/supabase/public") {
        return { createSupabasePublicClient: () => ({
          rpc: async (functionName, args) => {
            assert.equal(functionName, "capture_saved_search");
            rpcCalls.push({ functionName, args });
            order.push("store");
            return rpcResult;
          },
        }) };
      }
      if (name === "@/lib/idx") return { checkIdxConnection: async () => idx };
      if (name === "@/lib/broker-notification") {
        return { sendBrokerNotification: async payload => {
          notifications.push(payload);
          order.push("notify-broker");
          return notification;
        } };
      }
      throw new Error("Unexpected saved-search route dependency: " + name);
    },
  });
  return {
    rpcCalls, notifications, order, errors,
    async submit(overrides = {}) {
      const request = new Request("https://brokerage.example.test/api/saved-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, ...overrides }),
      });
      const response = await exported.exports.POST(request);
      return { status: response.status, body: await response.json() };
    },
  };
}

for (const [label, overrides] of [
  ["omitted", {}],
  ["empty", { fullName: "" }],
  ["spaces only", { fullName: "   " }],
  ["tabs and newlines", { fullName: "\t\r\n " }],
]) {
  test(label + " name input remains absent at the CRM boundary", async () => {
    const h = harness();
    const result = await h.submit(overrides);
    assert.equal(result.status, 200);
    assert.equal(h.rpcCalls.length, 1);
    assert.equal(h.rpcCalls[0].args.p_full_name, null, "Do not turn an absent name into an update to an existing CRM contact.");
    assert.equal(h.notifications.length, 1);
    assert.equal(h.notifications[0].fields.fullName, "Website visitor", "A display-only fallback remains appropriate for the broker notification.");
  });
}

test("a genuinely supplied name is trimmed and preserved for the CRM and broker", async () => {
  const h = harness();
  const result = await h.submit({ fullName: "  María O’Neill  " });
  assert.equal(result.status, 200);
  assert.equal(h.rpcCalls[0].args.p_full_name, "María O’Neill");
  assert.equal(h.notifications[0].fields.fullName, "María O’Neill");
});

test("a 120-character name is accepted after trimming", async () => {
  const h = harness();
  const name = "N".repeat(120);
  assert.equal((await h.submit({ fullName: "  " + name + "  " })).status, 200);
  assert.equal(h.rpcCalls.length, 1);
  assert.equal(h.rpcCalls[0].args.p_full_name, name);
});

test("a 121-character name is rejected before storage or notification", async () => {
  const h = harness();
  const result = await h.submit({ fullName: "N".repeat(121) });
  assert.equal(result.status, 400);
  assert.equal(h.rpcCalls.length, 0);
  assert.equal(h.notifications.length, 0);
});

test("registration stores preferences and sends only the separate broker notification", async () => {
  const h = harness();
  const result = await h.submit({ fullName: "Known Client", phone: " 7725550123 ", smsConsent: true });
  const args = h.rpcCalls[0].args;
  assert.equal(args.p_email, "buyer@example.test");
  assert.equal(args.p_phone, "7725550123");
  assert.equal(args.p_frequency, "instant");
  assert.equal(args.p_sms_consent, true);
  assert.equal(args.p_idx_active, true);
  assert.equal(args.p_criteria.locations, "Boynton Beach");
  assert.equal(args.p_criteria.maxPrice, "525000");
  assert.equal(args.p_criteria.privatePoolOnly, true);
  assert.deepEqual(h.order, ["store", "notify-broker"]);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0].kind, "saved-search");
  assert.equal(h.notifications[0].replyTo, "buyer@example.test");
  assert.deepEqual(result.body, {
    saved: true, stored: true, pendingIdx: false, customerEmailConfigured: true,
    notificationConfigured: true, notificationDelivered: true,
  });
});

test("an unavailable IDX connection and missing email key remain distinct response states", async () => {
  const h = harness({
    rpcResult: { data: true, error: null },
    idx: { connected: false, idxRoleVerified: false },
    notification: { configured: false, delivered: false },
    apiKey: "   ",
  });
  const result = await h.submit();
  assert.equal(result.status, 200);
  assert.equal(h.rpcCalls[0].args.p_idx_active, false);
  assert.equal(h.rpcCalls[0].args.p_phone, null);
  assert.deepEqual(result.body, {
    saved: true, stored: true, pendingIdx: true, customerEmailConfigured: false,
    notificationConfigured: false, notificationDelivered: false,
  });
});

test("a failed broker notification does not misreport successful storage as failed", async () => {
  const h = harness({ notification: { configured: true, delivered: false } });
  const result = await h.submit({ fullName: "Known Client" });
  assert.equal(result.status, 200);
  assert.equal(result.body.saved, true);
  assert.equal(result.body.stored, true);
  assert.equal(result.body.notificationConfigured, true);
  assert.equal(result.body.notificationDelivered, false);
});

test("a CRM storage failure returns an error and never sends a broker notification", async () => {
  const h = harness({ rpcResult: { data: null, error: { code: "fixture_storage_failure" } } });
  const result = await h.submit({ fullName: "Known Client" });
  assert.equal(result.status, 503);
  assert.equal(h.rpcCalls.length, 1);
  assert.equal(h.notifications.length, 0);
  assert.equal(h.errors.length, 1);
  assert.equal(result.body.saved, undefined);
});

test("an invalid email still fails real Zod validation before external side effects", async () => {
  const h = harness();
  assert.equal((await h.submit({ email: "not-an-email" })).status, 400);
  assert.equal(h.rpcCalls.length, 0);
  assert.equal(h.notifications.length, 0);
});

