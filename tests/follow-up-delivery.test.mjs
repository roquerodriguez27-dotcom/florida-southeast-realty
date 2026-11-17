import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const realRequire = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const emailCode = compile("../lib/crm/follow-up-email.ts");
const workerCode = compile("../app/api/crm/follow-up/process/route.ts");
const actionCode = compile("../app/crm/follow-up/actions.ts");
const ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT = "22222222-2222-4222-8222-222222222222";
const UNSUBSCRIBE = "33333333-3333-4333-8333-333333333333";
const TOKEN = "fixture-scheduler-token-not-a-secret";
const preparedSend = {
  ok: true, id: ID, send_attempt_token: ATTEMPT, idempotency_key: "fixture-send-immutable-version",
  recipient: "approved-recipient@example.test", subject: "Your property inquiry",
  body: "Thank you for your inquiry. What would you like us to review first?",
  unsubscribe_token: UNSUBSCRIBE, test_mode: false,
};
const SITE = {
  url: "https://brokerage.example.test", name: "Florida Southeast Realty",
  email: "broker@example.test", phoneDisplay: "(772) 555-0100",
};

function evaluate(code, imports, globals = {}) {
  const exported = { exports: {} };
  vm.runInNewContext(code, {
    module: exported, exports: exported.exports, URL, URLSearchParams, AbortSignal,
    ...globals,
    require(name) {
      if (name === "server-only") return {};
      if (name === "zod" || name === "next/server") return realRequire(name);
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error("Unexpected delivery-test import: " + name);
    },
  });
  return exported.exports;
}

function emailHarness({ status = 200, receipt = { id: "provider-message-id" }, fail = false, invalidJson = false, configured = true } = {}) {
  const calls = [], logs = [];
  const moduleExports = evaluate(emailCode, {
    "@/lib/site-config": { SITE, SITE_ADDRESS_LINE: "Fixture office address" },
  }, {
    process: { env: { RESEND_API_KEY: configured ? "fixture-key" : "", RESEND_TO_EMAIL: "must-not-override@example.test" } },
    console: { error: (...v) => logs.push(v), warn: (...v) => logs.push(v) },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (fail) throw new Error("Connection uncertain; fixture payload must not be logged.");
      return new Response(invalidJson ? "invalid JSON" : JSON.stringify(receipt), { status });
    },
  });
  return { ...moduleExports, calls, logs };
}

test("approved send uses immutable prepared recipient, text only, and one idempotent attempt", async () => {
  const h = emailHarness();
  const result = await h.sendApprovedFollowUp({
    ...preparedSend, to: "spoofed@example.test", html: "<script>ignored</script>",
    body: "<b>A literal customer-edited note</b>\nWhat would you like to review?",
  });
  assert.equal(result.outcome, "accepted");
  assert.equal(result.providerMessageId, "provider-message-id");
  assert.equal(h.calls.length, 1);
  const { url, options } = h.calls[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(options.method, "POST");
  assert.equal(options.headers["Idempotency-Key"], preparedSend.idempotency_key);
  assert.ok(options.signal instanceof AbortSignal);
  const payload = JSON.parse(options.body);
  assert.deepEqual(payload.to, [preparedSend.recipient]);
  assert.equal(payload.reply_to, SITE.email);
  assert.equal(payload.html, undefined);
  assert.match(payload.text, /<b>A literal customer-edited note<\/b>/);
  assert.match(payload.text, /Fixture office address/);
  assert.ok(payload.text.includes("/follow-up/unsubscribe?token=" + UNSUBSCRIBE));
  assert.equal(payload.subject, preparedSend.subject);
  assert.doesNotMatch(options.body, /spoofed@example|must-not-override@example|<script>/);
});

test("test sends are unmistakably labeled in subject and body", async () => {
  const h = emailHarness();
  await h.sendApprovedFollowUp({ ...preparedSend, test_mode: true });
  const payload = JSON.parse(h.calls[0].options.body);
  assert.equal(payload.subject, "TEST ONLY — " + preparedSend.subject);
  assert.match(payload.text, /^TEST ONLY/);
  assert.match(payload.text, /not a customer inquiry or appointment/);
});

for (const [label, patch] of [
  ["bad draft ID", { id: "not-a-uuid" }],
  ["bad attempt token", { send_attempt_token: "invalid" }],
  ["header injection", { subject: "Subject\r\nBcc: another@example.test" }],
  ["recipient list", { recipient: "one@example.test,two@example.test" }],
  ["bad idempotency key", { idempotency_key: "key\r\ninjected" }],
  ["empty body", { body: " " }],
  ["body control character", { body: "Bad\u0000body" }],
  ["invalid test flag", { test_mode: "true" }],
]) {
  test("invalid prepared approval payload cannot send: " + label, async () => {
    const h = emailHarness();
    const result = await h.sendApprovedFollowUp({ ...preparedSend, ...patch });
    assert.equal(result.outcome, "rejected");
    assert.equal(result.errorCode, "invalid_send_payload");
    assert.equal(h.calls.length, 0);
  });
}

test("missing email configuration never invokes the provider", async () => {
  const h = emailHarness({ configured: false });
  assert.equal(h.followUpEmailConfigured(), false);
  const result = await h.sendApprovedFollowUp(preparedSend);
  assert.equal(result.outcome, "rejected");
  assert.equal(result.errorCode, "email_not_configured");
  assert.equal(h.calls.length, 0);
});

test("known provider rejections are distinguished from uncertain outcomes without retries", async () => {
  for (const status of [400, 401, 403, 404, 413, 422]) {
    const h = emailHarness({ status });
    const result = await h.sendApprovedFollowUp(preparedSend);
    assert.equal(result.outcome, "rejected", String(status));
    assert.equal(result.errorCode, "provider_" + status);
    assert.equal(h.calls.length, 1);
  }
  for (const status of [408, 409, 429, 500, 503]) {
    const h = emailHarness({ status });
    const result = await h.sendApprovedFollowUp(preparedSend);
    assert.equal(result.outcome, "unknown", String(status));
    assert.equal(result.providerMessageId, null);
    assert.equal(h.calls.length, 1);
  }
});

test("HTTP success without a valid provider receipt remains uncertain", async () => {
  for (const opts of [{ receipt: {} }, { receipt: { id: "" } }, { invalidJson: true }]) {
    const h = emailHarness(opts);
    const result = await h.sendApprovedFollowUp(preparedSend);
    assert.equal(result.outcome, "unknown");
    assert.equal(h.calls.length, 1);
    assert.equal(h.logs.length, 0);
  }
});

test("network failure is uncertain and neither retries nor logs message content", async () => {
  const h = emailHarness({ fail: true });
  assert.equal((await h.sendApprovedFollowUp(preparedSend)).outcome, "unknown");
  assert.equal(h.calls.length, 1);
  assert.equal(h.logs.length, 0);
});

const claim = {
  claimed: true, id: ID, generation_token: ATTEMPT,
  source_snapshot: {
    full_name: "Fixture Client", form_name: "property-inquiry", property_interest: "123 Fixture Street",
    message: "Please help me ask about this property.", fields: { requestType: "question" },
    recipient_email: "must-not-be-forwarded@example.test",
  },
};
const generated = { subject: "Fixture draft", body: "A draft that remains private until a broker approves it.", staffSummary: "Fixture summary", generationMode: "template" };

function workerHarness({
  claimData = claim, claimError = null, completeData = { ok: true }, completeError = null,
  generationError = false, claimThrows = false, failThrows = false,
} = {}) {
  const rpcCalls = [], generations = [];
  let clients = 0;
  const exported = evaluate(workerCode, {
    "@/lib/supabase/public": { createSupabasePublicClient: () => {
      clients++;
      return { rpc: async (name, args) => {
        rpcCalls.push({ name, args });
        if (name === "claim_followup_draft") {
          if (claimThrows) throw new Error("Mock transport failure");
          return { data: claimData, error: claimError };
        }
        if (name === "complete_followup_draft") return { data: completeData, error: completeError };
        if (name === "fail_followup_draft") {
          if (failThrows) throw new Error("Mock failure-recording transport failure");
          return { data: { ok: true }, error: null };
        }
        throw new Error("Unexpected worker RPC: " + name);
      } };
    } },
    "@/lib/crm/follow-up-draft": { createFollowUpDraft: async input => {
      generations.push(input);
      if (generationError) throw new Error("Mock generator failure");
      return generated;
    } },
  }, { process: { env: {} } });
  return {
    rpcCalls, generations, get clients() { return clients; },
    async request(authorization = "Bearer " + TOKEN) {
      const response = await exported.POST(new Request("https://brokerage.example.test/api/crm/follow-up/process", {
        method: "POST", headers: authorization === null ? {} : { authorization },
      }));
      return { status: response.status, body: await response.json(), cacheControl: response.headers.get("cache-control") };
    },
  };
}

test("malformed worker tokens do not access the queue or generate anything", async () => {
  for (const header of [null, "Bearer short", "Basic " + TOKEN, "Bearer " + "x".repeat(257), "Bearer has spaces and is not a token"]) {
    const h = workerHarness();
    const result = await h.request(header);
    assert.equal(result.status, 401);
    assert.equal(result.cacheControl, "no-store");
    assert.equal(h.clients, 0);
    assert.equal(h.rpcCalls.length, 0);
    assert.equal(h.generations.length, 0);
  }
});

test("a syntactically valid but database-rejected token cannot generate a draft", async () => {
  const h = workerHarness({ claimError: { code: "28000" } });
  const result = await h.request();
  assert.equal(result.status, 401);
  assert.equal(result.body.reason, "unauthorized");
  assert.equal(h.rpcCalls.length, 1);
  assert.equal(h.generations.length, 0);
});

test("an empty queue and the daily cap both stop before generation", async () => {
  for (const reason of ["empty", "daily_limit"]) {
    const h = workerHarness({ claimData: { claimed: false, reason } });
    const result = await h.request();
    assert.equal(result.status, 200);
    assert.equal(result.body.drafted, 0);
    assert.equal(h.rpcCalls.length, 1);
    assert.equal(h.generations.length, 0);
  }
});

test("one valid claim generates exactly one private draft and completes using the generation token", async () => {
  const h = workerHarness();
  const result = await h.request();
  assert.deepEqual(result.body, { ok: true, drafted: 1, mode: "template" });
  assert.equal(h.generations.length, 1);
  assert.equal(h.generations[0].name, "Fixture Client");
  assert.equal(h.generations[0].recipient_email, undefined);
  assert.deepEqual(h.rpcCalls.map(call => call.name), ["claim_followup_draft", "complete_followup_draft"]);
  const complete = h.rpcCalls[1].args;
  assert.equal(complete.p_token, TOKEN);
  assert.equal(complete.p_id, ID);
  assert.equal(complete.p_generation_token, ATTEMPT);
  assert.equal(complete.p_subject, generated.subject);
  assert.equal(complete.p_body, generated.body);
  assert.equal(complete.p_mode, "template");
  assert.equal(complete.p_model, null);
});

test("stale completion does not advertise a saved draft or generate again", async () => {
  const h = workerHarness({ completeData: { ok: false } });
  const result = await h.request();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, drafted: 0, reason: "inquiry_changed" });
  assert.equal(h.generations.length, 1);
  assert.equal(h.rpcCalls.length, 2);
});

test("persistence failure records one failed claim and does not retry generation", async () => {
  const h = workerHarness({ completeError: { code: "fixture_storage_error" } });
  const result = await h.request();
  assert.equal(result.status, 503);
  assert.equal(result.body.reason, "draft_unavailable");
  assert.equal(h.generations.length, 1);
  assert.deepEqual(h.rpcCalls.map(call => call.name), ["claim_followup_draft", "complete_followup_draft", "fail_followup_draft"]);
  assert.equal(h.rpcCalls[2].args.p_generation_token, ATTEMPT);
});

test("invalid queue payload never reaches generation", async () => {
  const h = workerHarness({ claimData: { claimed: true, id: "bad" } });
  assert.equal((await h.request()).status, 503);
  assert.equal(h.generations.length, 0);
});

test("queue transport failure produces a bounded unavailable response", async () => {
  const h = workerHarness({ claimThrows: true });
  const result = await h.request();
  assert.equal(result.status, 503);
  assert.equal(result.cacheControl, "no-store");
  assert.equal(h.generations.length, 0);
});

test("failure-recording transport error preserves the controlled unavailable response", async () => {
  const h = workerHarness({ generationError: true, failThrows: true });
  const result = await h.request();
  assert.equal(result.status, 503);
  assert.equal(result.cacheControl, "no-store");
  assert.equal(h.generations.length, 1);
});

class RedirectSignal extends Error {
  constructor(url) { super(url); this.url = url; }
}

function actionHarness({ authorized = true, prepared = preparedSend, recordError = null, recordThrows = false, configured = true } = {}) {
  const rpcCalls = [], sends = [];
  let authChecks = 0;
  const exported = evaluate(actionCode, {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url) { throw new RedirectSignal(url); } },
    "@/lib/crm/auth": { requireCrmBroker: async () => {
      authChecks++;
      if (!authorized) throw new Error("Forbidden fixture");
      return { email: SITE.email };
    } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      if (name === "prepare_followup_send") return { data: prepared, error: null };
      if (name === "record_followup_send_result") {
        if (recordThrows) throw new Error("Mock acknowledgement transport failure");
        return { data: { ok: true }, error: recordError };
      }
      throw new Error("Unexpected approval RPC: " + name);
    } }) },
    "@/lib/crm/follow-up-email": {
      followUpEmailConfigured: () => configured,
      sendApprovedFollowUp: async value => { sends.push(value); return { outcome: "accepted", providerMessageId: "provider-id", errorCode: null }; },
    },
    "@/lib/crm/test-listing-alert": { sendBrokerListingAlertTest() { assert.fail("Unrelated listing test must not run."); } },
    "@/lib/crm/follow-up-draft": { createFollowUpDraft() { assert.fail("Approving a saved reply must not generate another draft."); } },
  });
  return {
    rpcCalls, sends, get authChecks() { return authChecks; },
    async approve(values = {}) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ id: ID, version: "1", approved: "yes", ...values })) {
        if (value !== null) form.set(key, value);
      }
      try {
        await exported.approveAndSendFollowUp(form);
        assert.fail("The action must redirect to a confirmed status.");
      } catch (error) {
        if (!(error instanceof RedirectSignal)) throw error;
        return new URL(error.url, SITE.url).searchParams.get("notice");
      }
    },
  };
}

test("approval requires authenticated broker before any queue access", async () => {
  const h = actionHarness({ authorized: false });
  await assert.rejects(h.approve(), /Forbidden fixture/);
  assert.equal(h.authChecks, 1);
  assert.equal(h.rpcCalls.length, 0);
  assert.equal(h.sends.length, 0);
});

test("missing approval or invalid version cannot prepare or send", async () => {
  for (const patch of [{ approved: null }, { approved: "no" }, { id: "invalid" }, { version: "0" }, { version: "1.5" }]) {
    const h = actionHarness();
    assert.equal(await h.approve(patch), "approval_required");
    assert.equal(h.rpcCalls.length, 0);
    assert.equal(h.sends.length, 0);
  }
});

test("approval ignores posted recipient/message and sends only the database-prepared immutable payload", async () => {
  const h = actionHarness();
  const notice = await h.approve({ recipient: "attacker@example.test", subject: "Spoofed subject", body: "Spoofed body" });
  assert.equal(notice, "accepted");
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0], preparedSend);
  assert.deepEqual(Object.keys(h.rpcCalls[0].args).sort(), ["p_expected_version", "p_id"]);
  assert.equal(h.rpcCalls[0].args.p_expected_version, 1);
  assert.equal(h.rpcCalls[1].args.p_send_attempt_token, ATTEMPT);
});

test("a stale approval cannot send", async () => {
  const h = actionHarness({ prepared: { ok: false, reason: "changed" } });
  assert.equal(await h.approve(), "changed");
  assert.equal(h.sends.length, 0);
  assert.equal(h.rpcCalls.length, 1);
});

test("a lost database acknowledgement never turns into another send or a success notice", async () => {
  const h = actionHarness({ recordError: { code: "fixture_persist_error" } });
  assert.equal(await h.approve(), "send_check_required");
  assert.equal(h.sends.length, 1);
  assert.equal(h.rpcCalls.length, 2);
});

test("a thrown acknowledgement error preserves the explicit uncertain-send notice", async () => {
  const h = actionHarness({ recordThrows: true });
  assert.equal(await h.approve(), "send_check_required");
  assert.equal(h.sends.length, 1);
  assert.equal(h.rpcCalls.length, 2);
});

function ownerTestHarness({
  authorized = true, created = { ok: true, id: ID }, createError = null,
  claimData = { ...claim, test_mode: true, draft_version: 0 }, claimError = null,
  completeData = { ok: true, version: 1 }, completeError = null,
  generationError = false, failThrows = false, draft = generated,
} = {}) {
  const rpcCalls = [], generations = [];
  let clients = 0;
  const exported = evaluate(actionCode, {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url) { throw new RedirectSignal(url); } },
    "@/lib/crm/auth": { requireCrmBroker: async () => {
      if (!authorized) throw new Error("Forbidden fixture");
      return { email: SITE.email };
    } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => {
      clients++;
      return { rpc: async (name, args) => {
        rpcCalls.push({ name, args });
        if (name === "create_followup_test") return { data: created, error: createError };
        if (name === "claim_followup_test_draft") return { data: claimData, error: claimError };
        if (name === "complete_followup_test_draft") return { data: completeData, error: completeError };
        if (name === "fail_followup_test_draft") {
          if (failThrows) throw new Error("Failure recording unavailable");
          return { data: { ok: true }, error: null };
        }
        assert.fail("Owner checks must not use another RPC: " + name);
      } };
    } },
    "@/lib/crm/follow-up-draft": { createFollowUpDraft: async input => {
      generations.push(input);
      if (generationError) throw new Error("Fixture generation failure");
      return draft;
    } },
    "@/lib/crm/follow-up-email": {
      followUpEmailConfigured() { assert.fail("Creating an owner test must not prepare a send."); },
      sendApprovedFollowUp() { assert.fail("Creating an owner test must never send an email."); },
    },
    "@/lib/crm/test-listing-alert": { sendBrokerListingAlertTest() { assert.fail("Unrelated listing test must not run."); } },
  }, { process: { env: {} } });
  return {
    rpcCalls, generations, get clients() { return clients; },
    async create() {
      try {
        await exported.createFollowUpTest();
        assert.fail("The action must redirect to a confirmed status.");
      } catch (error) {
        if (!(error instanceof RedirectSignal)) throw error;
        const params = new URL(error.url, SITE.url).searchParams;
        return { notice: params.get("notice"), id: params.get("id") };
      }
    },
  };
}

test("owner test authenticates before creating a client or test row", async () => {
  const h = ownerTestHarness({ authorized: false });
  await assert.rejects(h.create(), /Forbidden fixture/);
  assert.equal(h.clients, 0);
  assert.equal(h.rpcCalls.length, 0);
  assert.equal(h.generations.length, 0);
});

test("owner test generates on the current app through targeted RPCs without a scheduler credential or send", async () => {
  const h = ownerTestHarness({ draft: { ...generated, generationMode: "ai" } });
  assert.deepEqual(await h.create(), { notice: "test_ready", id: ID });
  assert.deepEqual(h.rpcCalls.map(call => call.name), ["create_followup_test", "claim_followup_test_draft", "complete_followup_test_draft"]);
  assert.deepEqual(Object.keys(h.rpcCalls[1].args), ["p_id"]);
  assert.equal(h.rpcCalls[1].args.p_id, ID);
  assert.equal(h.generations.length, 1);
  assert.equal(h.generations[0].recipient_email, undefined);
  const complete = h.rpcCalls[2].args;
  assert.equal(complete.p_id, ID);
  assert.equal(complete.p_generation_token, ATTEMPT);
  assert.equal(complete.p_expected_version, 0);
  assert.equal(complete.p_mode, "ai");
  assert.equal(complete.p_model, "openai/gpt-5-mini");
  assert.equal(complete.p_token, undefined);
});

test("owner test retains the truthful template fallback mode", async () => {
  const h = ownerTestHarness();
  assert.equal((await h.create()).notice, "test_ready");
  assert.equal(h.rpcCalls[2].args.p_mode, "template");
  assert.equal(h.rpcCalls[2].args.p_model, null);
});

test("existing drafts, pending work, and the daily cap do not generate again", async () => {
  for (const [claimData, notice] of [
    [{ claimed: false, reason: "already_ready" }, "test_ready"],
    [{ claimed: false, reason: "not_pending", state: "drafting" }, "test_pending"],
    [{ claimed: false, reason: "daily_limit" }, "test_daily_limit"],
    [{ claimed: false, reason: "not_pending", state: "draft_failed" }, "test_draft_unavailable"],
  ]) {
    const h = ownerTestHarness({ claimData });
    assert.equal((await h.create()).notice, notice);
    assert.equal(h.generations.length, 0);
    assert.equal(h.rpcCalls.length, 2);
  }
});

test("failed or malformed owner-test creation cannot claim or generate", async () => {
  for (const options of [{ createError: { code: "fixture" } }, { created: { ok: false } }, { created: { ok: true, id: "invalid" } }]) {
    const h = ownerTestHarness(options);
    assert.equal((await h.create()).notice, "unavailable");
    assert.equal(h.generations.length, 0);
    assert.equal(h.rpcCalls.length, 1);
  }
});

test("owner claim errors, wrong IDs, customer claims and invalid versions cannot reach the model", async () => {
  for (const options of [
    { claimError: { code: "fixture" } }, { claimData: { claimed: true, id: ID } },
    { claimData: { ...claim, test_mode: false, draft_version: 0 } },
    { claimData: { ...claim, id: UNSUBSCRIBE, test_mode: true, draft_version: 0 } },
    { claimData: { ...claim, test_mode: true, draft_version: -1 } },
  ]) {
    const h = ownerTestHarness(options);
    assert.equal((await h.create()).notice, "test_draft_unavailable");
    assert.equal(h.generations.length, 0);
    assert.equal(h.rpcCalls.length, 2);
  }
});

test("owner-test persistence uncertainty records only the same claim and never generates again", async () => {
  const h = ownerTestHarness({ completeError: { code: "fixture" }, failThrows: true });
  assert.equal((await h.create()).notice, "test_draft_unavailable");
  assert.equal(h.generations.length, 1);
  assert.deepEqual(h.rpcCalls.map(call => call.name), ["create_followup_test", "claim_followup_test_draft", "complete_followup_test_draft", "fail_followup_test_draft"]);
  const failure = h.rpcCalls[3].args;
  assert.equal(failure.p_id, ID);
  assert.equal(failure.p_generation_token, ATTEMPT);
  assert.equal(failure.p_expected_version, 0);
  assert.equal(failure.p_token, undefined);
});

test("stale owner-test completion does not advertise success or retry", async () => {
  const h = ownerTestHarness({ completeData: { ok: false, reason: "stale_claim" } });
  assert.equal((await h.create()).notice, "changed");
  assert.equal(h.generations.length, 1);
  assert.equal(h.rpcCalls.length, 3);
});

test("a thrown owner-test generation error records the targeted failure only", async () => {
  const h = ownerTestHarness({ generationError: true });
  assert.equal((await h.create()).notice, "test_draft_unavailable");
  assert.deepEqual(h.rpcCalls.map(call => call.name), ["create_followup_test", "claim_followup_test_draft", "fail_followup_test_draft"]);
  assert.equal(h.generations.length, 1);
});
