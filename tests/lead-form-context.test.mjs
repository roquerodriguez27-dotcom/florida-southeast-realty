import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const realRequire = createRequire(import.meta.url);
const compile = (path, jsx = false) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
  },
}).outputText;
const componentCode = compile("../components/LeadForm.tsx", true);
const contactModule = { exports: {} };
vm.runInNewContext(compile("../lib/lead-contact.ts"), { module: contactModule, exports: contactModule.exports });

const fields = [
  { name: "name", label: "Name", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "preferred_contact", label: "Preferred reply", type: "select", options: [
    { value: "any", label: "Either" }, { value: "email", label: "Email" }, { value: "call", label: "Call" },
  ] },
  { name: "message", label: "Question", type: "textarea" },
];
const originalContext = { plan_summary: "Original worksheet: sale price $500,000.", requestType: "original" };
const revisedContext = { plan_summary: "Revised worksheet: sale price $550,000.", requestType: "revised" };
const originalReceipt = "The original worksheet was saved for review.";
const revisedReceipt = "The revised worksheet was saved for review.";

// A narrow component harness: hook state, DOM-style uncontrolled values and a
// deferred fetch. It never connects to a browser, network, CRM or email service.
function harness() {
  const slots = [], requests = [], events = [];
  let cursor = 0, tree, controls = new Map();
  let props = {
    formName: "planning-seller-proceeds", fields, submitLabel: "Send request",
    successMessage: originalReceipt, hiddenContext: originalContext,
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useId() {
      const index = cursor++;
      if (!(index in slots)) slots[index] = `test-lead-form-${index}`;
      return slots[index];
    },
  };
  class MockFormData {
    constructor(form) {
      assert.equal(form, tree, "Submission must use the currently mounted form.");
      this.values = new Map();
      for (const control of controls.values()) {
        if (!control.props.name || control.props.disabled) continue;
        if (control.props.type === "checkbox" && !control.checked) continue;
        this.values.set(control.props.name, control.value);
      }
    }
    get(name) { return this.values.get(name) ?? null; }
  }
  function mockFetch(url, options) {
    assert.equal(url, "/api/lead");
    assert.equal(options.method, "POST");
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    requests.push({
      body: JSON.parse(options.body),
      succeed() { resolve({ json: async () => ({ delivered: true, stored: true, notificationConfigured: true, notificationDelivered: true }) }); },
    });
    return promise;
  }
  const exported = { exports: {} };
  vm.runInNewContext(componentCode, {
    module: exported, exports: exported.exports, FormData: MockFormData,
    fetch: mockFetch, TextEncoder,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return realRequire(name);
      if (name === "next/link") return { __esModule: true, default: "a" };
      if (name === "@/lib/site-config") return { SITE: { shortName: "FSR", phoneHref: "tel:+17727754765", phoneDisplay: "(772) 775-4765", email: "test@example.test" } };
      if (name === "@/components/SiteAnalytics") return { trackSiteEvent: (...event) => events.push(event) };
      if (name === "@/lib/lead-contact") return contactModule.exports;
      throw new Error(`Unexpected import in LeadForm test: ${name}`);
    },
  });

  function walk(node, visit, path = "root") {
    if (!node || typeof node !== "object") return;
    const identity = `${path}/${String(node.type)}:${node.key ?? ""}`;
    visit(node, identity);
    const children = [node.props?.children].flat(Infinity);
    children.forEach((child, index) => walk(child, visit, `${identity}/${index}`));
  }
  function render(changes = {}) {
    props = { ...props, ...changes };
    cursor = 0;
    tree = exported.exports.default(props);
    const next = new Map();
    walk(tree, (node, identity) => {
      if (!["input", "select", "textarea"].includes(node.type)) return;
      const previous = controls.get(identity);
      const control = previous ?? {
        value: String(node.props.defaultValue ?? (node.props.type === "checkbox" ? node.props.value ?? "on" : "")),
        checked: Boolean(node.props.defaultChecked),
      };
      if (node.props.value !== undefined && node.props.type !== "checkbox") control.value = String(node.props.value);
      if (node.props.checked !== undefined) control.checked = node.props.checked;
      control.props = node.props;
      next.set(identity, control);
    });
    controls = next;
    return tree;
  }
  function find(predicate) {
    let match;
    walk(tree, node => { if (!match && predicate(node)) match = node; });
    return match;
  }
  function text(node = tree) {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node !== "object") return String(node);
    return [node.props?.children].flat(Infinity).map(child => child == null ? "" : text(child)).join(" ");
  }
  function control(name) {
    const value = [...controls.values()].find(item => item.props.name === name);
    assert.ok(value, `Expected mounted control ${name}.`);
    return value;
  }
  function fill(name, value) {
    const input = control(name);
    if (input.props.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
    const event = { target: { name, value: input.value, checked: input.checked } };
    input.props.onChange?.(event);
    tree.props.onChange?.(event);
  }
  function submit() {
    assert.equal(tree.type, "form", "An explicit submit requires a mounted form.");
    return tree.props.onSubmit({ preventDefault() {}, currentTarget: tree });
  }
  function updateButton() { return find(node => node.type === "button" && text(node).trim() === "Send updated request"); }
  render();
  return { render, find, text, control, fill, submit, updateButton, requests, events };
}

function fillContact(h) {
  h.fill("name", "Test Planner");
  h.fill("email", "planner@example.test");
  h.fill("phone", "7725550123");
  h.fill("preferred_contact", "email");
  h.fill("message", "Please review the assumptions with me.");
  h.fill("contact_consent", true);
}

async function completeRequest(h, index = 0) {
  const pending = h.submit();
  h.render();
  assert.equal(h.requests.length, index + 1);
  h.requests[index].succeed();
  await pending;
  h.render();
}

test("editing a worksheet before the first send preserves typed contact and sends the latest plan", async () => {
  const h = harness();
  fillContact(h);
  h.render({ hiddenContext: revisedContext, successMessage: revisedReceipt });
  assert.equal(h.control("name").value, "Test Planner");
  assert.equal(h.control("email").value, "planner@example.test");
  assert.equal(h.control("phone").value, "7725550123");
  assert.equal(h.control("message").value, "Please review the assumptions with me.");
  assert.equal(h.control("contact_consent").checked, true);
  assert.equal(h.requests.length, 0, "Worksheet edits must never submit a request.");
  await completeRequest(h);
  assert.equal(h.requests[0].body.fields.plan_summary, revisedContext.plan_summary);
  assert.match(h.text(), /The revised worksheet was saved for review/);
  assert.equal(h.updateButton(), undefined, "No updated-request action is needed for the just-submitted plan.");
});

test("a changed saved plan needs an explicit reset, retains submitted contact, and requires fresh consent", async () => {
  const h = harness();
  fillContact(h);
  await completeRequest(h);
  assert.equal(h.updateButton(), undefined);
  h.render({ hiddenContext: revisedContext, successMessage: revisedReceipt });
  assert.match(h.text(), /The original worksheet was saved for review/);
  assert.match(h.text(), /(?:earlier|previous|original).*saved|saved.*(?:earlier|previous|original)/i);
  assert.ok(h.updateButton(), "A changed worksheet must provide an explicit way to send the update.");
  assert.equal(h.requests.length, 1);
  h.updateButton().props.onClick();
  h.render();
  for (const [name, expected] of Object.entries({
    name: "Test Planner", email: "planner@example.test", phone: "7725550123",
    preferred_contact: "email", message: "Please review the assumptions with me.",
  })) assert.equal(h.control(name).value, expected, `Restore the submitted ${name} for review.`);
  assert.equal(h.control("contact_consent").checked, false, "Consent must not carry into a new request.");
  assert.equal(h.requests.length, 1, "Opening an updated request must not send it.");
  await h.submit(); h.render();
  assert.equal(h.requests.length, 1, "A new request without renewed consent must not reach fetch.");
  assert.match(h.text(), /Please confirm that we may contact you/);
  h.fill("contact_consent", true);
  await completeRequest(h, 1);
  assert.equal(h.requests[1].body.fields.plan_summary, revisedContext.plan_summary);
  assert.equal(h.requests[1].body.fields.email, "planner@example.test");
  assert.equal(h.requests[1].body.fields.contact_consent, "yes");
  assert.equal(h.updateButton(), undefined);
});

test("edits while fetch is pending cannot relabel the original receipt or silently submit a revision", async () => {
  const h = harness();
  fillContact(h);
  const pending = h.submit();
  h.render({ hiddenContext: revisedContext, successMessage: revisedReceipt });
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.fields.plan_summary, originalContext.plan_summary);
  assert.equal(h.find(node => node.type === "form").props["aria-busy"], true);
  h.requests[0].succeed();
  await pending;
  h.render();
  assert.match(h.text(), /The original worksheet was saved for review/);
  assert.doesNotMatch(h.text(), /The revised worksheet was saved for review/);
  assert.ok(h.updateButton(), "The in-flight submission must retain its original context snapshot.");
  assert.equal(h.requests.length, 1);
  h.render();
  assert.equal(h.requests.length, 1, "Rerendering a revised plan must not send another request.");
  assert.equal(h.events.filter(([name]) => name === "lead_submit").length, 1);
});

test("equivalent context does not offer a duplicate send, and returning to the saved plan clears the update prompt", async () => {
  const h = harness();
  h.fill("phone", "7725550123");
  h.fill("preferred_contact", "call");
  h.fill("contact_consent", true);
  await completeRequest(h);
  h.render({ hiddenContext: { ...originalContext } });
  assert.equal(h.updateButton(), undefined);
  h.render({ hiddenContext: revisedContext });
  assert.ok(h.updateButton());
  h.render({ hiddenContext: { ...originalContext } });
  assert.equal(h.updateButton(), undefined);
  assert.equal(h.requests.length, 1);
});
