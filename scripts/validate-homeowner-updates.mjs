import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const content = JSON.parse(fs.readFileSync(new URL("../data/homeowner-updates.json", import.meta.url), "utf8"));
const compiled = ts.transpileModule(fs.readFileSync(new URL("../lib/homeowner-updates.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const compiledModule = { exports: {} };
const isolatedRequire = (specifier) => {
  if (specifier === "zod") return require("zod");
  if (specifier === "../data/homeowner-updates.json") return content;
  throw new Error(`Unexpected dependency: ${specifier}`);
};
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { URL, Intl, Date }, { filename: "homeowner-updates.ts" })(
  isolatedRequire, compiledModule, compiledModule.exports,
);
const { homeownerUpdatesSchema, formatHomeownerDate, sourcesReviewedAt, HOMEOWNER_UPDATES } = compiledModule.exports;

// Import-time parsing makes invalid maintenance edits fail before deployment.
assert.equal(HOMEOWNER_UPDATES.topics.length, 3);
console.log(`Homeowner updates validated: ${HOMEOWNER_UPDATES.topics.length} topics; article updated ${HOMEOWNER_UPDATES.editorialUpdatedAt}.`);

if (process.argv.includes("--test")) {
  const rejects = (label, mutate) => {
    const changed = structuredClone(content);
    mutate(changed);
    assert.equal(homeownerUpdatesSchema.safeParse(changed).success, false, label);
  };
  for (const url of [
    "https://flsenate.gov.example.com/Laws/Statutes/2026/0718.112",
    "http://www.citizensfla.com/flood",
    "javascript:alert(1)",
    "https://user:password@flsenate.gov/Laws/Statutes/2026/0718.112",
  ]) {
    rejects(`Unsafe source URL must fail: ${url}`, (value) => { value.topics[0].sources[0].url = url; });
  }
  rejects("A dangling citation must fail", (value) => { value.topics[0].facts[0].sourceIds = ["missing-source"]; });
  rejects("Duplicate topic IDs must fail", (value) => { value.topics[1].id = value.topics[0].id; });
  rejects("Duplicate source IDs must fail", (value) => { value.topics[0].sources.push({ ...value.topics[0].sources[0] }); });
  for (const date of ["2026-02-30T12:00:00Z", "2026-11-10", "2026-11-10T12:00:00", "2026-11-10T12:00:00-05:00", "today"]) {
    rejects(`Invalid date must fail: ${date}`, (value) => { value.topics[0].sources[0].lastSuccessfulCheckAt = date; });
  }
  rejects("Editorial date cannot precede publication", (value) => { value.editorialUpdatedAt = "2025-01-01T12:00:00Z"; });
  rejects("HTML must not enter plain text", (value) => { value.topics[0].summary = "<script>alert(1)</script>"; });
  for (const href of ["//example.com", "javascript:alert(1)", "/\\example.com", "/api/inquiries", "https://example.com"]) {
    rejects(`Unsafe action link must fail: ${href}`, (value) => { value.topics[0].actions[0].href = href; });
  }
  const amendmentIndex = content.topics.findIndex((topic) => topic.id === "amendment-3-2026");
  rejects("A badge alone cannot certify an election result", (value) => {
    value.topics[amendmentIndex].status.code = "certified";
    value.topics[amendmentIndex].facts = value.topics[amendmentIndex].facts.filter((fact) => fact.id !== "certification");
  });
  rejects("Indexed excerpts alone cannot certify an election result", (value) => {
    const topic = value.topics[amendmentIndex];
    topic.status.code = "certified";
    topic.sources.forEach((source) => { source.accessMethod = "official-index"; });
    topic.facts = topic.facts.filter((fact) => fact.id !== "certification");
    topic.facts.push({ id: "certification", text: "Certification evidence must be read directly.", sourceIds: [topic.sources[0].id] });
  });

  // Stored UTC timestamps are displayed in Eastern Time, including day boundaries.
  assert.equal(formatHomeownerDate("2026-11-10T17:00:00Z"), "November 10, 2026");
  assert.equal(formatHomeownerDate("2026-11-10T02:00:00Z"), "November 9, 2026");
  const variedChecks = structuredClone(HOMEOWNER_UPDATES.topics);
  variedChecks.forEach((topic) => topic.sources.forEach((source) => { source.lastSuccessfulCheckAt = "2026-11-10T15:00:00Z"; }));
  variedChecks[1].sources[0].lastSuccessfulCheckAt = "2026-11-08T15:00:00Z";
  assert.equal(sourcesReviewedAt(variedChecks), "2026-11-08T15:00:00Z", "A newer check must not conceal an older required source.");
  console.log("Homeowner update safety checks passed; no network requests were made.");
}
