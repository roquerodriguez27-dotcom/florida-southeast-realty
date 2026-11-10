import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const measurementId = "G-TEST123";
const optOutKey = "fsr-analytics-opt-out";
const preferenceEvent = "fsr-analytics-preference";
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture(url = "https://www.floridasoutheastrealty.com/about", options = {}) {
  const state = { eligible: true, eligibilityRequests: 0, beacons: [], scripts: new Map(), ...options };
  const storage = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  };
  const window = Object.assign(new EventTarget(), { location: new URL(url), localStorage: storage(), sessionStorage: storage() });
  const document = Object.assign(new EventTarget(), {
    cookie: "", visibilityState: "visible", title: "Private title: qa-person@example.test",
    hasFocus: () => state.focused !== false,
    referrer: "https://example.test/private?email=qa-person@example.test",
    getElementById: (id) => state.scripts.get(id),
    createElement: () => ({ remove() { state.scripts.delete(this.id); } }),
    head: { appendChild: (script) => state.scripts.set(script.id, script) },
  });
  const hooks = [];
  let hookIndex = 0;
  let effects = [];
  const context = vm.createContext({
    window, document, URL, URLSearchParams, Blob, Event, EventTarget, Element: class {}, HTMLElement: class {},
    crypto: { randomUUID }, process: { env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: measurementId } },
    navigator: { webdriver: false, userAgent: "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36", sendBeacon: (_url, body) => { state.beacons.push(body); return true; } },
    fetch: async (request, init) => {
      assert.equal(request, "/api/analytics", "No live provider or inquiry requests are permitted in these checks.");
      assert.notEqual(init?.method, "POST", "The fixture should use the mocked analytics beacon.");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.credentials, "same-origin");
      state.eligibilityRequests++;
      if (state.pendingEligibility) await state.pendingEligibility;
      if (state.failEligibility) throw new Error("Synthetic eligibility failure");
      const eligible = state.eligible;
      return { ok: true, json: async () => ({ eligible }) };
    },
  });
  const modules = new Map();
  const react = {
    useRef(value) { const index = hookIndex++; return hooks[index] ??= { current: value }; },
    useEffect(callback, dependencies) {
      const index = hookIndex++;
      const previous = hooks[index];
      if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
      effects.push(() => { previous?.cleanup?.(); hooks[index] = { dependencies, cleanup: callback() }; });
    },
  };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const compiledModule = { exports: {} };
    modules.set(filename, compiledModule);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const require = (specifier) => {
      if (specifier === "react") return react;
      if (specifier === "next/navigation") return { usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search) };
      const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(resolved, `Unexpected dependency: ${specifier}`);
      return load(resolved);
    };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename })(require, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  const analytics = load(path.join(root, "components/SiteAnalytics.tsx"));
  return {
    state, window, document, analytics,
    async render() { hookIndex = 0; effects = []; analytics.default(); effects.forEach((effect) => effect()); await flush(); },
    commands: () => (window.dataLayer ?? []).map((command) => JSON.parse(JSON.stringify(Array.from(command)))),
    events() { return this.commands().filter((command) => command[0] === "event"); },
  };
}

assert.doesNotMatch(fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"), /googletagmanager|gtag\(/,
  "The root layout must not load or configure Google outside the eligibility gate.");

// A delayed Google script receives only sanitized queued commands; no URL,
// title, referrer or contact metadata can escape through its default config.
{
  const f = fixture("https://floridasoutheastrealty.com/properties/private-listing?q=qa-person%40example.test&utm_term=PRIVATE&fsr_campaign=relocation#SECRET");
  await f.render();
  const config = f.commands().find((command) => command[0] === "config")[2];
  const consent = f.commands().find((command) => command[0] === "consent");
  assert.deepEqual(consent, ["consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]);
  assert.ok(f.commands().findIndex((command) => command[0] === "consent") < f.commands().findIndex((command) => command[0] === "config"));
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(f.state.scripts.size, 1);
  assert.equal([...f.state.scripts.values()][0].referrerPolicy, "no-referrer");
  assert.equal(f.events().length, 1);
  assert.equal(f.events()[0][1], "page_view");
  assert.equal(f.events()[0][2].page_location, "https://www.floridasoutheastrealty.com/properties/[listing]");
  assert.equal(f.events()[0][2].page_title, "/properties/[listing]");
  assert.equal(f.events()[0][2].page_referrer, "");
  assert.equal(f.events()[0][2].fsr_campaign, "relocation");
  f.analytics.trackSiteEvent("lead_submit", { formName: "property-inquiry", requestType: "showing", email: "qa-person@example.test", listingId: "PRIVATE" });
  await flush();
  assert.equal(f.events().at(-1)[1], "generate_lead");
  assert.equal(f.events().at(-1)[2].form_name, "property-inquiry");
  assert.equal(f.events().at(-1)[2].request_type, "showing");
  assert.doesNotMatch(JSON.stringify(f.commands()), /qa-person|PRIVATE|SECRET|private-listing|utm_term|example\.test/);
  f.analytics.trackSiteEvent("form_submit_attempt", { formName: "property-inquiry" });
  await flush();
  assert.equal(f.events().length, 2, "A form attempt must not become a Google lead.");
  const firstParty = await Promise.all(f.state.beacons.map(async (body) => JSON.parse(await body.text())));
  assert.ok(firstParty.some((event) => event.eventName === "lead_submit"));
}

// Preview/private/staff/opted-out and failed eligibility requests cannot even
// load the third-party script, let alone enqueue a pageview or lead.
for (const scenario of [
  { url: "https://preview.vercel.app/about" },
  { url: "https://www.floridasoutheastrealty.com/crm/leads/private" },
  { eligible: false },
  { failEligibility: true },
  { optOut: true },
  { cookie: "sb-example-auth-token.0=synthetic" },
  { cookie: "fsr_analytics_opt_out=1" },
]) {
  const f = fixture(scenario.url, scenario);
  if (scenario.optOut) f.window.localStorage.setItem(optOutKey, "1");
  if (scenario.cookie) f.document.cookie = scenario.cookie;
  await f.render();
  f.analytics.trackSiteEvent("call_click");
  await flush();
  assert.equal(f.state.scripts.size, 0);
  assert.equal(f.events().length, 0);
}

// An already-open anonymous tab must recheck staff status for contact events
// and after returning from another tab, even without a storage event.
{
  const f = fixture();
  await f.render();
  f.state.eligible = false;
  f.analytics.trackSiteEvent("call_click");
  await flush();
  assert.equal(f.events().length, 1);
  assert.equal(f.window[`ga-disable-${measurementId}`], true);
  f.window.dispatchEvent(new Event("focus"));
  await flush();
  assert.equal(f.events().length, 1);
  assert.equal(f.window[`ga-disable-${measurementId}`], true);
}

// Preference/visibility changes pause an existing tag immediately. Resuming
// the same public page does not manufacture an additional pageview.
{
  const f = fixture();
  await f.render();
  f.window.localStorage.setItem(optOutKey, "1");
  f.window.dispatchEvent(new Event(preferenceEvent));
  assert.equal(f.window[`ga-disable-${measurementId}`], true);
  await flush();
  f.window.localStorage.removeItem(optOutKey);
  f.window.dispatchEvent(new Event("storage"));
  await flush();
  assert.equal(f.events().length, 1);
  assert.equal(f.window[`ga-disable-${measurementId}`], false);
  f.window.location = new URL("https://www.floridasoutheastrealty.com/contact?private=qa-person%40example.test");
  await f.render();
  assert.equal(f.events().length, 2);
  assert.equal(f.events().at(-1)[2].page_location, "https://www.floridasoutheastrealty.com/contact");
  assert.equal(f.commands().filter((command) => command[0] === "set").at(-1)[1].page_title, "/contact");
  assert.doesNotMatch(JSON.stringify(f.commands()), /qa-person|private=/);
  f.document.visibilityState = "hidden";
  f.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.window[`ga-disable-${measurementId}`], true);
  f.window.location = new URL("https://www.floridasoutheastrealty.com/crm/private");
  await f.render();
  assert.equal(f.events().length, 2);
  assert.equal(f.window[`ga-disable-${measurementId}`], true);
}

// Navigating to the CRM while approval is in flight must not initialize GA.
{
  let resolveEligibility;
  const f = fixture(undefined, { pendingEligibility: new Promise((resolve) => { resolveEligibility = resolve; }) });
  await f.render();
  f.analytics.trackSiteEvent("lead_submit", { formName: "contact" });
  f.window.location = new URL("https://www.floridasoutheastrealty.com/crm/private");
  resolveEligibility();
  await flush();
  assert.equal(f.state.scripts.size, 0);
  assert.equal(f.events().length, 0);
}

// A successfully stored inquiry survives a quick public navigation during
// eligibility, retaining its original page/campaign in both reports.
{
  const f = fixture("https://www.floridasoutheastrealty.com/contact?fsr_campaign=referral");
  await f.render();
  let resolveEligibility;
  f.state.pendingEligibility = new Promise((resolve) => { resolveEligibility = resolve; });
  f.analytics.trackSiteEvent("lead_submit", { formName: "contact" });
  f.window.location = new URL("https://www.floridasoutheastrealty.com/about?fsr_campaign=seller-review");
  await f.render();
  resolveEligibility();
  await flush();
  const leads = f.events().filter((event) => event[1] === "generate_lead");
  assert.equal(leads.length, 1);
  assert.equal(leads[0][2].page_location, "https://www.floridasoutheastrealty.com/contact");
  assert.equal(leads[0][2].fsr_campaign, "referral");
  const firstParty = await Promise.all(f.state.beacons.map(async (body) => JSON.parse(await body.text())));
  const storedLeads = firstParty.filter((event) => event.eventName === "lead_submit");
  assert.equal(storedLeads.length, 1);
  assert.equal(storedLeads[0].path, "/contact");
  assert.equal(storedLeads[0].metadata.campaign, "referral");
}

// A request started before window blur cannot resume Google in an unfocused
// window while someone signs into the CRM elsewhere.
{
  let resolveEligibility;
  const f = fixture(undefined, { pendingEligibility: new Promise((resolve) => { resolveEligibility = resolve; }) });
  await f.render();
  f.state.focused = false;
  f.window.dispatchEvent(new Event("blur"));
  resolveEligibility();
  await flush();
  assert.equal(f.state.scripts.size, 0);
  assert.equal(f.window[`ga-disable-${measurementId}`], true);
}

// External-app contact clicks and accepted async leads survive focus loss.
// They keep their original sanitized context and do not delay our own beacon.
{
  const f = fixture("https://www.floridasoutheastrealty.com/properties/private-listing?fsr_campaign=relocation");
  await f.render();
  f.state.focused = false;
  f.window.dispatchEvent(new Event("blur"));
  f.analytics.trackSiteEvent("call_click");
  f.analytics.trackSiteEvent("lead_submit", { formName: "property-inquiry", requestType: "showing" });
  await flush();
  assert.equal(f.events().length, 1, "Background outcomes must not re-enable Google's tag.");
  assert.equal(f.window[`ga-disable-${measurementId}`], true);
  const firstParty = await Promise.all(f.state.beacons.map(async (body) => JSON.parse(await body.text())));
  assert.ok(firstParty.some((event) => event.eventName === "call_click"));
  assert.ok(firstParty.some((event) => event.eventName === "lead_submit"));
  f.window.location = new URL("https://www.floridasoutheastrealty.com/contact");
  await f.render();
  f.state.focused = true;
  f.window.dispatchEvent(new Event("focus"));
  await flush();
  const calls = f.events().filter((event) => event[1] === "contact_phone_click");
  const leads = f.events().filter((event) => event[1] === "generate_lead");
  assert.equal(calls.length, 1);
  assert.equal(leads.length, 1);
  assert.equal(leads[0][2].page_location, "https://www.floridasoutheastrealty.com/properties/[listing]");
  assert.equal(leads[0][2].fsr_campaign, "relocation");
  assert.equal(leads[0][2].form_name, "property-inquiry");
  f.window.dispatchEvent(new Event("focus"));
  await flush();
  assert.equal(f.events().filter((event) => event[1] === "generate_lead").length, 1);
}

// A deferred outcome must be discarded when the return check discovers staff
// status, rather than leaking later if the same browser signs out again.
{
  const f = fixture();
  await f.render();
  f.state.focused = false;
  f.analytics.trackSiteEvent("lead_submit", { formName: "contact" });
  await flush();
  f.state.focused = true;
  f.state.eligible = false;
  f.window.dispatchEvent(new Event("focus"));
  await flush();
  f.state.eligible = true;
  f.window.dispatchEvent(new Event("focus"));
  await flush();
  assert.equal(f.events().filter((event) => event[1] === "generate_lead").length, 0);
}

// A blocked/broken optional Google tag cannot prevent first-party reporting.
{
  const f = fixture();
  f.window.gtag = () => { throw new Error("Synthetic tag failure"); };
  await f.render();
  f.analytics.trackSiteEvent("email_click");
  await flush();
  const firstParty = await Promise.all(f.state.beacons.map(async (body) => JSON.parse(await body.text())));
  assert.ok(firstParty.some((event) => event.eventName === "email_click"));
}

console.log("Analytics privacy regression checks passed (synthetic browser and eligibility responses; no live requests).");
