import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const realRequire = createRequire(import.meta.url);
const source = readFileSync(new URL("../components/planning/VoiceQuestion.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;

function harness(mode = "standard") {
  const slots = [], instances = [], listeners = new Map();
  let cursor = 0, cleanup, initialized = false, tree;
  function PlanHandoff() { return null; }
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.started = true; }
    stop() { this.stopped = true; this.onend?.(); }
    abort() { this.aborted = true; this.onend?.(); }
    result(value) { this.onresult?.({ results: [{ isFinal: true, length: 1, 0: { transcript: value } }] }); }
  }
  const document = { visibilityState: "visible", addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect) { if (!initialized) { cleanup = effect(); initialized = true; } },
    useSyncExternalStore(_subscribe, snapshot) { return snapshot(); },
  };
  const exported = { exports: {} };
  const context = { module: exported, exports: exported.exports, document, window: mode === "unsupported" ? {} : mode === "webkit" ? { webkitSpeechRecognition: Recognition } : { SpeechRecognition: Recognition }, require: name => name === "react" ? react : name === "react/jsx-runtime" ? realRequire(name) : { __esModule: true, default: PlanHandoff } };
  vm.runInNewContext(code, context);
  function render() { cursor = 0; tree = exported.exports.default(); return tree; }
  function find(predicate, node = tree) {
    if (!node || typeof node !== "object") return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { if (!child || typeof child !== "object") continue; const match = find(predicate, child); if (match) return match; }
  }
  render();
  return { render, find, instances, document, listeners, cleanup: () => cleanup?.(), handoff: () => find(node => node.type === PlanHandoff), textarea: () => find(node => node.type === "textarea"), start: () => find(node => node.type === "button")?.props.onClick(), review: () => find(node => node.type === "input" && node.props.type === "checkbox") };
}

test("speech never starts on render, and typing works without speech support", () => {
  const supported = harness();
  assert.equal(supported.instances.length, 0);
  assert.equal(supported.handoff(), undefined);
  const unsupported = harness("unsupported");
  unsupported.textarea().props.onChange({ target: { value: "Can we discuss this property?" } });
  unsupported.render();
  assert.equal(unsupported.textarea().props.value, "Can we discuss this property?");
  assert.equal(unsupported.find(node => node.type === "button"), undefined);
});

test("dictation appends to typed text and requires a separate review before the handoff", () => {
  const h = harness("webkit");
  h.textarea().props.onChange({ target: { value: "My question:" } }); h.render();
  h.start(); h.render();
  assert.equal(h.instances[0].started, true);
  assert.equal(h.review().props.disabled, true);
  h.instances[0].result("What are the next steps?");
  h.instances[0].onend(); h.render();
  assert.equal(h.textarea().props.value, "My question: What are the next steps?");
  assert.equal(h.handoff(), undefined);
  h.review().props.onChange({ target: { checked: true } }); h.render();
  assert.equal(h.handoff().props.summary, "My question: What are the next steps?");
  h.textarea().props.onChange({ target: { value: "A changed question" } }); h.render();
  assert.equal(h.handoff(), undefined);
});

test("permission failure preserves text and leaves typed fallback editable", () => {
  const h = harness();
  h.textarea().props.onChange({ target: { value: "Keep this question" } }); h.render();
  h.start(); h.instances[0].onerror({ error: "not-allowed" }); h.render();
  assert.equal(h.textarea().props.value, "Keep this question");
  assert.equal(h.textarea().props.readOnly, false);
  assert.match(h.find(node => node.props?.role === "status").props.children, /not allowed/);
});

test("length limits are visible and hidden-page / unmount cleanup stops speech", () => {
  const h = harness(); h.start();
  h.instances[0].result("a".repeat(3005)); h.render();
  assert.equal(h.textarea().props.value.length, 3000);
  assert.equal(h.instances[0].stopped, true);
  assert.match(h.find(node => node.props?.role === "status").props.children, /limit was reached/);
  h.document.visibilityState = "hidden"; h.listeners.get("visibilitychange")(); h.render();
  assert.equal(h.instances[0].aborted, true);
  assert.equal(h.handoff(), undefined);
  h.cleanup();
  assert.equal(h.instances[0].onresult, null);
  assert.equal(h.listeners.size, 0);
});
