import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compiledModule = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(new URL("../lib/planning/calendar.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(`(function(module,exports){${compiled}\n})`, { Date, Intl, TextEncoder, crypto: webcrypto }, { filename: "calendar.ts" })(compiledModule, compiledModule.exports);
const { buildHomeownerEvents, createHomeownerCalendar, escapeCalendarText, formatOwnerCalendarDate, homeownerCalendarReport } = compiledModule.exports;
const created = new Date("2026-11-10T04:42:59Z");
const defaults = { includeHomestead: true, insuranceDate: "", maintenanceDate: "", maintenanceTitle: "" };
const events = buildHomeownerEvents({ ...defaults, insuranceDate: "2027-01-20", maintenanceDate: "2027-04-15", maintenanceTitle: "Roof review" });
const calendar = createHomeownerCalendar(events, created, "test-export");
const unfolded = calendar.replace(/\r\n[ \t]/g, "");
assert.equal(events.length, 3);
assert.equal(events.find((event) => event.kind === "official").date, "2027-03-01");
assert.equal(new Date("2027-03-01T00:00:00Z").getUTCDay(), 1, "The stated 2027 filing date is a Monday.");
assert.match(unfolded, /DTSTART;VALUE=DATE:20270301\r\nDTEND;VALUE=DATE:20270302/);
assert.match(unfolded, /DTSTAMP:20261110T044259Z/);
assert.equal((unfolded.match(/^BEGIN:VEVENT$/gm) ?? []).length, 3);
assert.doesNotMatch(unfolded, /(?:^|\r\n)(?:ATTENDEE|ORGANIZER|METHOD|RRULE|TRIGGER|TZID)[;:]/, "Export must not create invitations, recurring dates or unsolicited notifications.");
assert.equal(/(?<!\r)\n/.test(calendar), false, "ICS content uses CRLF throughout.");
assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));

for (const date of ["2027-02-29", "2027-02-30", "2027-13-01", "2027-3-1", "20270301", "2027-03-01\r\nBEGIN:VEVENT"]) {
  assert.throws(() => buildHomeownerEvents({ ...defaults, insuranceDate: date }), /date/i, `Reject impossible or injected date ${JSON.stringify(date)}`);
}
assert.throws(() => buildHomeownerEvents({ ...defaults, maintenanceTitle: "Undated work" }), /maintenance date/);
assert.throws(() => createHomeownerCalendar([], created, "test"), /one and twenty/);
assert.throws(() => createHomeownerCalendar(events, created, "bad\r\nBEGIN:VEVENT"), /identifier/);

for (const [date, next] of [["2028-02-29", "20280301"], ["2027-12-31", "20280101"], ["2027-03-14", "20270315"]]) {
  const event = { id: "test-day", title: "Date check", date, description: "All-day date", kind: "personal" };
  assert.match(createHomeownerCalendar([event], created, "test"), new RegExp(`DTEND;VALUE=DATE:${next}`), "Leap days, year boundaries and DST dates retain the intended all-day span.");
}
assert.equal(formatOwnerCalendarDate("2027-03-01"), "March 1, 2027");

const injected = { id: "text-check", title: "Roof, gutters; café \\ review\r\nBEGIN:VEVENT", date: "2027-04-15", description: "One\rTwo\nThree\r\nFour", kind: "personal" };
const injectionFile = createHomeownerCalendar([injected], created, "test").replace(/\r\n[ \t]/g, "");
assert.equal((injectionFile.match(/^BEGIN:VEVENT$/gm) ?? []).length, 1, "A label cannot inject another calendar event.");
assert.ok(injectionFile.includes(`SUMMARY:${escapeCalendarText(injected.title)}\r\n`));
assert.ok(injectionFile.includes("DESCRIPTION:One\\nTwo\\nThree\\nFour\r\n"));
assert.equal(escapeCalendarText("a,b;c\\d"), "a\\,b\\;c\\\\d");
assert.throws(() => createHomeownerCalendar([{ ...injected, sourceUrl: "https://pbcpao.gov/\r\nATTENDEE:mailto:test@example.test" }], created, "test"), /source/);
assert.throws(() => createHomeownerCalendar([{ ...injected, id: "bad\nEND:VEVENT" }], created, "test"), /identifiers/);

const unicodeTitle = "é🌴".repeat(70);
const unicodeFile = createHomeownerCalendar([{ ...injected, title: unicodeTitle }], created, "test");
for (const line of unicodeFile.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, "Every folded physical line fits 75 UTF-8 octets.");
assert.ok(unicodeFile.replace(/\r\n[ \t]/g, "").includes(`SUMMARY:${unicodeTitle}\r\n`), "Folding preserves multibyte text without truncation.");
const report = homeownerCalendarReport(events);
assert.match(report, /Date entered by you/);
assert.match(report, /Official published date/);
assert.match(report, /one-time exports/);
assert.match(report, /TRIM, appeal and tax-bill deadlines are not assigned/);
console.log("Homeowner calendar checks passed: valid all-day dates, safe text/UTF-8 folding, no invitations or subscriptions. No network requests were made.");
