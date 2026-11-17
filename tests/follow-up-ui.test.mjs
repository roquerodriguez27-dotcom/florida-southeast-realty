import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const realRequire = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const pageCode = compile("../app/crm/follow-up/page.tsx");
const editorCode = compile("../components/crm/FollowUpEditor.tsx");
const stateCode = compile("../lib/crm/follow-up.ts");
const unsubscribeCode = compile("../app/follow-up/unsubscribe/page.tsx");
const loginPageCode = compile("../app/crm/login/page.tsx");
const ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "22222222-2222-4222-8222-222222222222";
const SITE = { email: "broker@example.test" };
const Link = ({ children, ...props }) => React.createElement("a", props, children);

function evaluate(code, imports = {}) {
  const loaded = { exports: {} };
  vm.runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require(name) {
      if (["react", "react/jsx-runtime", "react-dom", "zod"].includes(name)) return realRequire(name);
      if (name === "next/link") return { default: Link };
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error("Unexpected follow-up UI test dependency: " + name);
    },
  });
  return loaded.exports;
}

test("CRM login cooldown asks the user to wait and check an earlier link without a fixed retry interval", async () => {
  const Page = evaluate(loginPageCode, {
    "./actions": { sendLoginLink: async () => { assert.fail("Rendering must not request a login email."); } },
  }).default;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ error: "email_rate_limit" }) }));
  assert.match(html, /Please wait before requesting another sign-in link/);
  assert.match(html, /If you just requested one, check your inbox and spam folder/);
  assert.doesNotMatch(html, /not authorized|could not be sent|Check your email for the secure login link|\d+ seconds|\d+ minutes|sending limit/);
});

function entry(patch = {}) {
  return {
    id: ID, lead_id: 101, recipient_email: "visitor@example.test", state: "review", test_mode: false,
    source_snapshot: { full_name: "Fixture Visitor", form_name: "property-inquiry", property_interest: "Fixture property", message: "Can you help me arrange a viewing?" },
    draft_subject: "Your property inquiry", draft_body: "Thank you for your inquiry. When would you like to discuss the property?",
    draft_mode: "template", draft_version: 1, approved_by: null, approved_at: null, send_attempt_at: null,
    accepted_at: null, stop_reason: null, last_error: null,
    created_at: "2026-11-17T03:00:00.000Z", updated_at: "2026-11-17T03:00:00.000Z",
    ...patch,
  };
}

/** A query boundary that applies filters/order/limit to fixtures in call order. */
function crmHarness({ rows = [], anonymous = false } = {}) {
  const queries = [], actions = [];
  let authenticated = 0, clients = 0;
  const unauthorized = new Error("Fixture: broker sign-in required");
  const action = name => async () => { actions.push(name); throw new Error("Rendering must not run an action"); };
  const mockedActions = Object.fromEntries([
    "saveFollowUp", "approveAndSendFollowUp", "createFollowUpTest", "sendListingAlertTest", "stopFollowUp",
  ].map(name => [name, action(name)]));
  const editor = evaluate(editorCode, { "@/app/crm/follow-up/actions": mockedActions }).default;
  function from(table) {
    const query = { table, calls: [] };
    queries.push(query);
    let result = [...rows], head = false, single = false;
    const builder = {
      select(columns, options) {
        query.calls.push({ method: "select", columns, options }); head = options?.head === true; return builder;
      },
      in(column, values) {
        query.calls.push({ method: "in", column, values: [...values] }); result = result.filter(row => values.includes(row[column])); return builder;
      },
      eq(column, value) {
        query.calls.push({ method: "eq", column, value }); result = result.filter(row => row[column] === value); return builder;
      },
      order(column, options) {
        query.calls.push({ method: "order", column, options });
        result.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (options.ascending ? 1 : -1)); return builder;
      },
      limit(value) {
        query.calls.push({ method: "limit", value }); result = result.slice(0, value); return builder;
      },
      maybeSingle() { query.calls.push({ method: "maybeSingle" }); single = true; return builder; },
      then(resolve, reject) {
        return Promise.resolve({ data: head ? null : single ? result[0] ?? null : result, error: null, count: head ? result.length : null }).then(resolve, reject);
      },
    };
    return builder;
  }
  const Page = evaluate(pageCode, {
    "@/lib/crm/auth": { requireCrmBroker: async () => { authenticated += 1; if (anonymous) throw unauthorized; return { email: SITE.email }; } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => { clients += 1; return { from }; } },
    "@/lib/crm/follow-up": evaluate(stateCode),
    "@/components/crm/FollowUpEditor": { default: editor },
    "./actions": mockedActions,
  }).default;
  return {
    queries, actions, unauthorized,
    get authenticated() { return authenticated; },
    get clients() { return clients; },
    async render(params = {}) { return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })); },
  };
}

test("untrusted notice keys do not access object prototypes or crash the broker page", async () => {
  for (const notice of ["__proto__", "constructor", "toString", "<img src=x onerror=alert(1)>"]) {
    const h = crmHarness();
    const html = await h.render({ notice });
    assert.match(html, /Reply drafts/);
    assert.doesNotMatch(html, /\[object Object\]|function Object|<img src=x/);
    assert.equal(h.actions.length, 0);
  }
});

test("owner-test notices distinguish draft readiness, pending work, and failure without claiming an email or scheduled preview worker", async () => {
  for (const [notice, expected] of [
    ["test_ready", /Check whether it used AI or the template fallback/],
    ["test_pending", /pending work or is not ready to retry/],
    ["test_daily_limit", /no new draft was generated/],
    ["test_draft_unavailable", /No email was sent by this check/],
  ]) {
    const h = crmHarness({ rows: [entry({ state: "queued", test_mode: true, draft_body: null, draft_subject: null })] });
    const html = await h.render({ id: ID, notice });
    assert.match(html, expected);
    assert.match(html, /The owner test prepares its draft when you create it/);
    assert.doesNotMatch(html, /The scheduled worker will prepare|The agent checks for pending drafts on its schedule/);
    assert.equal(h.actions.length, 0);
  }
});

test("the pending queue is filtered in the database before the 100-row limit", async () => {
  const rows = Array.from({ length: 105 }, (_, index) => entry({
    id: `accepted-${index}`, state: "accepted", created_at: "2026-11-17T04:00:00.000Z",
  }));
  rows.push(entry({ source_snapshot: { full_name: "Older pending inquiry", message: "An older eligible request" } }));
  const h = crmHarness({ rows });
  const html = await h.render();
  const queue = h.queries.find(query => query.calls.some(call => call.method === "limit"));
  assert.ok(queue);
  const filterIndex = queue.calls.findIndex(call => call.method === "in" && call.column === "state");
  const limitIndex = queue.calls.findIndex(call => call.method === "limit");
  assert.ok(filterIndex >= 0 && filterIndex < limitIndex);
  const states = queue.calls[filterIndex].values;
  assert.ok(states.includes("review") && states.includes("delivery_unknown"));
  for (const state of ["accepted", "paused", "stopped"]) assert.equal(states.includes(state), false);
  assert.match(html, /Older pending inquiry/);
  assert.match(html, /1 reply ready to review/);
  assert.doesNotMatch(html, /id=accepted-/);
});

for (const state of ["stopped", "paused"]) {
  test(`provider acceptance evidence remains visible when a reply is ${state}`, async () => {
    const h = crmHarness({ rows: [entry({
      state, approved_by: SITE.email, approved_at: "2026-11-17T03:05:00.000Z",
      accepted_at: "2026-11-17T03:05:02.000Z", stop_reason: "do_not_contact",
    })] });
    const html = await h.render({ id: ID, notice: "stopped" });
    assert.match(html, /The email service accepted the request at/);
    assert.match(html, /Approved by broker@example\.test/);
    assert.match(html, /Inbox delivery and replies have not been automatically verified/);
    assert.match(html, /An email that was already requested may still arrive/);
    assert.doesNotMatch(html, />Approve and send/);
  });
}

test("original visitor text and read-only drafts are escaped by the real React renderer", async () => {
  const h = crmHarness({ rows: [entry({
    state: "delivery_unknown",
    source_snapshot: {
      full_name: '<script>alert("NAME-XSS")</script>',
      property_interest: '<img src=x onerror="alert(\'PROPERTY-XSS\')">',
      message: '<svg onload="alert(\'MESSAGE-XSS\')">& private message</svg>',
    },
    draft_subject: '<img src=x onerror="alert(\'SUBJECT-XSS\')">',
    draft_body: '<script>alert("DRAFT-XSS")</script>',
  })] });
  const html = await h.render({ id: ID });
  assert.match(html, /&lt;script&gt;alert\(&quot;NAME-XSS&quot;\)/);
  assert.match(html, /&lt;img src=x onerror=/);
  assert.match(html, /&lt;svg onload=/);
  assert.match(html, /&amp; private message/);
  assert.match(html, /&lt;script&gt;alert\(&quot;DRAFT-XSS&quot;\)/);
  assert.doesNotMatch(html, /<script>alert|<img src=x|<svg onload=/);
  assert.equal(h.actions.length, 0);
});

for (const state of ["sending", "delivery_unknown"]) {
  test(`a ${state} reply has an uncertainty warning and no approval or send control`, async () => {
    const h = crmHarness({ rows: [entry({ state })] });
    const html = await h.render({ id: ID });
    assert.match(html, /role="alert"/);
    assert.match(html, /This entry cannot be resent while its result is uncertain/);
    assert.doesNotMatch(html, />Approve and send|name="approved"|name="subject"|name="body"/);
    assert.equal(h.actions.length, 0);
  });
}

test("an eligible review draft renders the real editor and requires explicit approval", async () => {
  const h = crmHarness({ rows: [entry()] });
  const html = await h.render({ id: ID });
  assert.match(html, /name="subject"/);
  assert.match(html, /name="body"/);
  assert.match(html, /type="checkbox"[^>]*required=""[^>]*name="approved"|type="checkbox"[^>]*name="approved"[^>]*required=""/);
  assert.match(html, />Approve and send reply<\/button>/);
  assert.equal(h.actions.length, 0);
});

test("an anonymous request is stopped before constructing a database client or query", async () => {
  const h = crmHarness({ anonymous: true, rows: [entry()] });
  await assert.rejects(h.render({ id: ID }), error => error === h.unauthorized);
  assert.equal(h.authenticated, 1);
  assert.equal(h.clients, 0);
  assert.equal(h.queries.length, 0);
  assert.equal(h.actions.length, 0);
});

function unsubscribeHarness() {
  const actions = [];
  const Page = evaluate(unsubscribeCode, {
    "@/lib/site-config": { SITE },
    "./actions": { unsubscribeFromInquiryFollowUp: async () => { actions.push("unsubscribe"); throw new Error("Rendering must not unsubscribe"); } },
  }).default;
  return {
    actions,
    async render(params = {}) { return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })); },
  };
}

test("a valid public preferences link requires an explicit button submission and distinguishes saved searches", async () => {
  const h = unsubscribeHarness();
  const html = await h.render({ token: TOKEN });
  assert.match(html, /<form /);
  assert.ok(html.includes(`name="token" value="${TOKEN}"`));
  assert.match(html, />Stop inquiry follow-up emails<\/button>/);
  assert.match(html, /saved-search listing alerts have a separate unsubscribe link/);
  assert.equal(h.actions.length, 0);
});

test("missing and invalid preference tokens render a contact fallback with no mutation control", async () => {
  const h = unsubscribeHarness();
  for (const token of [undefined, "invalid", "__proto__", '<img src=x onerror="alert(1)">']) {
    const html = await h.render({ token });
    assert.match(html, /role="alert"/);
    assert.match(html, /complete preferences link from your email/);
    assert.match(html, /href="mailto:broker@example\.test"/);
    assert.doesNotMatch(html, /<form |name="token"|<img src=x/);
  }
  assert.equal(h.actions.length, 0);
});

test("processed preferences distinguish inquiry follow-up from unchanged saved-search alerts", async () => {
  const h = unsubscribeHarness();
  const html = await h.render({ status: "processed" });
  assert.match(html, /role="status"/);
  assert.match(html, /request to stop inquiry follow-up emails has been processed/);
  assert.match(html, /It does not change any saved-search listing alerts/);
  assert.doesNotMatch(html, /<form |name="token"/);
  assert.equal(h.actions.length, 0);
});

test("a failed public preference change does not claim success and offers recovery", async () => {
  const h = unsubscribeHarness();
  const html = await h.render({ status: "unavailable" });
  assert.match(html, /role="alert"/);
  assert.match(html, /couldn’t confirm the change/);
  assert.match(html, /try the link in your email again/);
  assert.match(html, /href="mailto:broker@example\.test"/);
  assert.doesNotMatch(html, /has been processed|role="status"/);
  assert.equal(h.actions.length, 0);
});

// Mobile screens stack a long reply list above its detail. Selecting a row must
// scroll to the actual review panel, rather than showing the list again.
test("a selected reply link takes the broker straight to the review panel on narrow screens", async () => {
  const h = crmHarness({ rows: [entry()] });
  const html = await h.render();
  assert.ok(html.includes(`href="/crm/follow-up?id=${ID}#reply-details"`));
  assert.ok(html.includes('id="reply-details"'));
  assert.ok(html.includes('tabIndex="-1"') || html.includes('tabindex="-1"'));
  assert.equal(h.actions.length, 0);
});
