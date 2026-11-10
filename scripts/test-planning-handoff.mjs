import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeRequire = createRequire(import.meta.url);
let captures = [];
let notifications = 0;
let authenticated = 0;
const updates = [];
const activities = [];
let taskSnapshot = { id: 3, lead_id: 9, title: "Synthetic reminder", completed_at: null, automation_key: null, due_at: null };
let taskRescheduledDuringUpdate = false;
const crmClient = { from(table) {
  let mode = "select", value;
  const filters = [];
  const query = {
    select() { return query; }, eq(key, value) { filters.push(["eq",key,value]); return query; }, is(key, value) { filters.push(["is",key,value]); return query; },
    update(payload) { mode = "update"; value = payload; updates.push({ table, payload, filters }); return query; },
    insert(payload) { activities.push({ table, payload }); return Promise.resolve({ error: null }); },
    single() { return Promise.resolve({ data: table === "crm_tasks" ? taskSnapshot : { id: 9 }, error: null }); },
    then(resolve, reject) { return Promise.resolve({ data: mode === "update" && value && !(table === "crm_tasks" && taskRescheduledDuringUpdate) ? [{ id: 3 }] : [], error: null }).then(resolve,reject); },
  };
  return query;
} };
const mocks = {
  "server-only": {},
  "next/server": { NextResponse: { json: (value, options) => Response.json(value, options) } },
  "next/cache": { revalidatePath() {} },
  "next/navigation": { redirect() { throw new Error("Unexpected redirect"); } },
  "@/lib/crm/auth": { requireCrmUser: async () => { authenticated++; return { email: "fixture@example.test" }; }, requireCrmBroker: async () => { throw new Error("Unexpected broker action"); } },
  "@/lib/supabase/server": { createSupabaseServerClient: async () => crmClient },
  "@/lib/supabase/public": { createSupabasePublicClient: () => ({ rpc: async (name, args) => { captures.push({ name, args }); return { data: true, error: null }; } }) },
  "@/lib/broker-notification": { sendBrokerNotification: async () => { notifications++; return { configured: true, delivered: true }; } },
};
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const compiledModule = { exports: {} }; modules.set(filename,compiledModule);
  const compiled = ts.transpileModule(fs.readFileSync(filename,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ Response, Request, Headers, FormData, TextEncoder, URL, AbortSignal, console, process: { env: {} }, fetch: () => { throw new Error("No live network permitted in fixtures"); } });
  const require = (specifier) => {
    if (specifier in mocks) return mocks[specifier];
    if (specifier.startsWith("@/")) return load(path.join(root, specifier.slice(2) + ".ts"));
    return nativeRequire(specifier);
  };
  vm.runInContext(`(function(require,module,exports){${compiled}\n})`,context,{ filename })(require,compiledModule,compiledModule.exports);
  return compiledModule.exports;
}
const contact = load(path.join(root,"lib/lead-contact.ts"));
const summary = "A".repeat(3999) + "🏡" + "B".repeat(7000);
const parts = contact.planReportFields(summary);
assert.equal(Object.values(parts).join(""),summary,"Complete report survives chunking");
assert.ok(Object.values(parts).every((part) => part.length <= 4000));
assert.ok(Object.values(parts).every((part) => !/[\uD800-\uDBFF]$/.test(part)),"No split surrogate pairs");
for (const form of contact.PLANNING_FORM_NAMES) {
  assert.equal(contact.contactValidationError(form,{ phone: "+1 (555) 123-4567", plan_summary: "Plan" }),null);
  assert.ok(contact.contactValidationError(form,{ phone: "()--", plan_summary: "Plan" }));
  assert.ok(contact.contactValidationError(form,{ email: "visitor@example.test", preferred_contact: "call", plan_summary: "Plan" }));
  assert.ok(contact.contactValidationError(form,{ phone: "5551234567", preferred_contact: "email", plan_summary: "Plan" }));
}
const { POST } = load(path.join(root,"app/api/lead/route.ts"));
async function post(fields, origin = "https://example.test") {
  return POST(new Request("https://example.test/api/lead", { method:"POST", headers:{ "Content-Type":"application/json", Host:"example.test", Origin:origin }, body:JSON.stringify({ formName:"planning-seller-proceeds",fields }) }));
}
const valid = { phone:"5551234567", contact_consent:"yes", ...parts };
assert.equal((await post(valid)).status,200);
assert.equal(captures.length,1); assert.equal(notifications,1);
assert.equal(captures[0].args.p_email,null);
assert.equal(captures[0].args.p_form_name,"planning-seller-proceeds");
assert.equal(Object.entries(captures[0].args.p_fields).filter(([key]) => key.startsWith("plan_summary")).map(([,value]) => value).join(""),summary);
assert.equal((await post({ ...valid,contact_consent:"no" })).status,400);
assert.equal((await post({ ...valid,phone:"---" })).status,400);
assert.equal((await post({ ...valid,preferred_contact:"email" })).status,400);
assert.equal((await post(valid,"https://other.example.test")).status,403);
assert.equal(captures.length,1,"Rejected payloads never reach capture RPC");
assert.equal(notifications,1,"Rejected payloads never trigger notifications");

const outcomes = load(path.join(root,"lib/crm/outcomes.ts"));
const leadRows = [ { id:1,form_name:"planning-seller-proceeds",status:"new",created_at:"2026-11-10" }, { id:2,form_name:"planning-buyer-tour",status:"closed",created_at:"2026-11-10" } ];
const activity = (id,kind,outcome) => ({ lead_id:id,kind,body:outcomes.outcomeBody(outcome,kind,""),created_at:"2026-11-10" });
const stats = outcomes.summarizeOutcomes(leadRows,[
  activity(1,"call","attempted"), activity(1,"call","conversation"), activity(1,"email","conversation"),
  activity(2,"meeting","appointment_held"), activity(2,"call","appointment_booked"),
  activity(999,"call","conversation"),
  { lead_id:1,kind:"system",body:"Completed follow-up",created_at:"2026-11-10" },
  { lead_id:1,kind:"note",body:outcomes.outcomeBody("appointment_held","meeting",""),created_at:"2026-11-10" },
]);
assert.equal(stats.totals.inquiries,2);assert.equal(stats.totals.conversations,2);
assert.equal(stats.totals.booked,1);assert.equal(stats.totals.held,1);assert.equal(stats.totals.closed,1);
assert.equal(outcomes.readOutcome({ kind:"call",body:"FSR outcome v1: not-json" }),null);
assert.equal(outcomes.readOutcome({ kind:"text",body:outcomes.outcomeBody("conversation","call","") }),null);
const actions = load(path.join(root,"app/crm/actions.ts"));
const taskForm = new FormData();taskForm.set("taskId","3");
await actions.completeTask(taskForm);
assert.equal(authenticated,1,"Task action authenticates independently");
assert.equal(updates.length,1,"Completing a task only updates the task");
assert.equal(updates[0].table,"crm_tasks");
assert.ok(!("last_contacted_at" in updates[0].payload));
const outcomeForm = new FormData();for (const [key,value] of Object.entries({leadId:"9",outcome:"attempted",channel:"call",confirmed:"yes"})) outcomeForm.set(key,value);
await actions.recordContactOutcome(outcomeForm);
assert.equal(updates.length,1,"An unanswered attempt does not advance contact date");
outcomeForm.set("outcome","conversation");await actions.recordContactOutcome(outcomeForm);
assert.equal(updates.at(-1).table,"crm_leads");assert.ok(updates.at(-1).payload.last_contacted_at);
assert.equal(authenticated,3,"Each contact action authenticates independently");

// A completed automatic reminder clears only its matching date, never a conversation timestamp.
taskSnapshot = { ...taskSnapshot, automation_key:"lead_follow_up", due_at:"2026-11-10T12:00:00+00:00" };
taskForm.set("expectedDueAt",taskSnapshot.due_at);
await actions.completeTask(taskForm);
assert.equal(updates.at(-1).table,"crm_leads");
assert.equal(updates.at(-1).payload.next_follow_up_at,null);
assert.ok(!("last_contacted_at" in updates.at(-1).payload));
assert.ok(updates.at(-1).filters.some(([op,key,value]) => op === "eq" && key === "next_follow_up_at" && value === taskSnapshot.due_at));
assert.ok(updates.at(-2).filters.some(([op,key,value]) => op === "eq" && key === "due_at" && value === taskSnapshot.due_at));
let updateCount = updates.length, activityCount = activities.length;
taskForm.set("expectedDueAt","2026-11-09T12:00:00+00:00");
await actions.completeTask(taskForm);
assert.equal(updates.length,updateCount,"A stale screen cannot complete a rescheduled reminder");
assert.equal(activities.length,activityCount);
taskForm.set("expectedDueAt",taskSnapshot.due_at);
taskRescheduledDuringUpdate = true;
await actions.completeTask(taskForm);
assert.equal(updates.length,updateCount + 1,"A concurrent schedule change prevents the task update from matching");
assert.equal(activities.length,activityCount,"No completion activity is added for a no-op update");
assert.equal(updates.at(-1).table,"crm_tasks");
assert.ok(updates.at(-1).filters.some(([op,key,value]) => op === "eq" && key === "due_at" && value === taskSnapshot.due_at));
console.log("Planning handoff, privacy, complete-report and contact-outcome checks passed.");
