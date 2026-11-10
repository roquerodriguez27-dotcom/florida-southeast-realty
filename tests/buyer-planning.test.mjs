import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/planning/buyer.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const buyer = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const loan = values => ({ ...buyer.emptyLoanEstimate(), ...values });

test("route selectors accept only a single public tool label", () => {
  for (const tool of ["checklist", "relocation", "tour", "loans"]) assert.equal(buyer.buyerPlanTool(tool), tool);
  for (const value of [undefined, "", ["loans", "tour"], "loanAmount=500000", "javascript:alert(1)"]) assert.equal(buyer.buyerPlanTool(value), "checklist");
});

test("missing loan figures stay unknown; explicit zero is a valid entered figure", () => {
  const empty = buyer.loanMetrics(loan({}));
  assert.equal(empty.lenderCosts, null);
  assert.equal(empty.monthlyTotal, null);
  assert.equal(empty.fiveYearCost, null);
  const zero = buyer.loanMetrics(loan({ originationA: "0", servicesB: "0", lenderCredits: "0", monthlyPI: "0", monthlyMI: "0", monthlyEscrow: "0" }));
  assert.equal(zero.lenderCosts, 0);
  assert.equal(zero.monthlyTotal, 0);
});

test("lender charges remain distinct from escrow and government estimates", () => {
  const first = buyer.loanMetrics(loan({ originationA: "2500", servicesB: "600", lenderCredits: "1000", monthlyPI: "2000", monthlyMI: "125", monthlyEscrow: "700", prepaids: "4000", initialEscrow: "3000", governmentFees: "1200" }));
  assert.equal(first.lenderCosts, 2100);
  assert.equal(first.monthlyTotal, 2825);
  const second = buyer.loanMetrics(loan({ originationA: "2500", servicesB: "600", lenderCredits: "1000", prepaids: "9000", initialEscrow: "10", governmentFees: "0" }));
  assert.equal(second.lenderCosts, first.lenderCosts);
  assert.equal(buyer.loanMetrics(loan({ originationA: "100", servicesB: "50", lenderCredits: "250" })).lenderCosts, -100);
});

test("five-year cost uses both page 3 amounts and rejects impossible ordering", () => {
  assert.equal(buyer.loanMetrics(loan({ fiveYearTotal: "150000", fiveYearPrincipal: "35000" })).fiveYearCost, 115000);
  assert.equal(buyer.loanMetrics(loan({ fiveYearTotal: "150000" })).fiveYearCost, null);
  const invalid = buyer.loanMetrics(loan({ fiveYearTotal: "100", fiveYearPrincipal: "200" }));
  assert.equal(invalid.fiveYearError, true);
  assert.equal(invalid.fiveYearCost, null);
});

test("nonfinite and negative lender costs cannot become plausible totals", () => {
  for (const input of ["Infinity", "NaN", "1e309", "-5", "fee", "10000000001"]) assert.equal(buyer.loanNumber(input), null);
  assert.equal(buyer.loanNumber("-500", true), -500);
  assert.equal(buyer.loanNumber(" 100.50 "), 100.5);
  const invalid = buyer.loanMetrics(loan({ originationA: "-1", servicesB: "5", lenderCredits: "0", rate: "101" }));
  assert.equal(invalid.lenderCosts, null);
  assert.ok(invalid.invalidFields.includes("Interest rate (%)"));
  const zeroTerm = buyer.loanMetrics(loan({ loanAmount: "0", termYears: "0", purchasePrice: "0" }));
  assert.equal(zeroTerm.invalidFields.length, 3);
});

test("different assumptions and estimate dates are disclosed rather than ranked", () => {
  const common = { purchasePrice: "500000", loanAmount: "400000", downPayment: "100000", termYears: "30", product: "Fixed conventional", estimateDate: "2026-11-09" };
  assert.match(buyer.loanComparisonNotes([loan(common), loan({ ...common, loanAmount: "450000", estimateDate: "2026-11-10" })]).join(" "), /Loan amounts differ/);
  assert.match(buyer.loanComparisonNotes([loan(common), loan({ ...common, loanAmount: "450000", estimateDate: "2026-11-10" })]).join(" "), /Estimate dates differ/);
  assert.match(buyer.loanComparisonNotes([loan(common), loan({ ...common, loanAmount: "400000.00" })]).join(" "), /match/);
});

test("unrated tour criteria do not reduce the personal score", () => {
  assert.deepEqual(buyer.tourRatingSummary({}), { rated: 0, average: null });
  assert.deepEqual(buyer.tourRatingSummary({ [buyer.TOUR_CRITERIA[0]]: "5", [buyer.TOUR_CRITERIA[1]]: "3", [buyer.TOUR_CRITERIA[2]]: "0" }), { rated: 2, average: 4 });
});

const cost = { property: "123 Test Avenue", price: 120000, downPercent: 0, rate: 0, years: 10, taxRate: 1.2, insurance: 100, flood: 25, hoa: 50, cdd: 10, pmiRate: 1.2 };
const affordability = { income: 90000, monthlyDebt: 300, cash: 45000, dti: 36, affordablePrice: 250000 };

test("zero-interest ownership estimate includes tax, insurance, flood, HOA, CDD and PMI", () => {
  const totals = buyer.monthlyPlanningCost(cost);
  assert.equal(totals.principalInterest, 1000);
  assert.equal(totals.taxes, 120);
  assert.equal(totals.pmi, 120);
  assert.equal(totals.total, 1425);
  assert.equal(buyer.monthlyPlanningCost({ ...cost, downPercent: 20 }).pmi, 0);
});

test("full cost and affordability reports retain the assumptions behind the output", () => {
  const report = buyer.buyerScenarioReport("cost", cost, affordability, []);
  for (const fragment of ["123 Test Avenue", "1.2%", "CDD / other assessments / month: $10.00", "Annual PMI assumption: 1.2%", "$1,425.00"]) assert.ok(report.includes(fragment), fragment);
  const range = buyer.buyerScenarioReport("affordability", cost, affordability, []);
  for (const fragment of ["$90,000.00", "$300.00", "$45,000.00", "36%", "$18,000", "28%", "$250,000.00"]) assert.ok(range.includes(fragment), fragment);
});

test("every compared property and zero HOA survive export; empty slots do not become properties", () => {
  const empty = { id: "slot", address: "", price: "", beds: "", baths: "", sqft: "", hoa: "", yearBuilt: "", notes: "" };
  const homes = [1, 2, 3].map(n => ({ ...empty, address: `Home ${n}`, price: `${n}00000`, beds: "3", baths: "2", sqft: "1500", hoa: "0", yearBuilt: "2001", notes: `Question ${n}` }));
  const report = buyer.buyerScenarioReport("compare", cost, affordability, homes);
  for (const n of [1, 2, 3]) assert.ok(report.includes(`Question ${n}`));
  assert.ok(report.includes("HOA / month: 0"));
  assert.ok(report.includes("Living area (sq ft): 1500"));
  assert.match(buyer.buyerScenarioReport("compare", cost, affordability, [empty]), /No comparison properties entered/);
});

test("checklist and relocation exports preserve notes without inventing completed work", () => {
  const report = buyer.checklistReport("Example condo", "Condominium", { reserves: { status: "Requested", note: "Waiting for the latest SIRS" } });
  assert.match(report, /Condo reserves and inspections: Requested/);
  assert.match(report, /Waiting for the latest SIRS/);
  assert.match(report, /Condition and inspections: Not reviewed/);
  const visit = buyer.relocationReport({ timing: "Spring", visit: "Virtual first", areaOne: "Boynton Beach", areaTwo: "Delray Beach", budget: "Discuss", priorities: "Home office", routes: "Work route", questions: "Insurance questions" });
  assert.match(visit, /FIRST RESEARCH BLOCK: Boynton Beach/);
  assert.match(visit, /SECOND RESEARCH BLOCK: Delray Beach/);
  assert.match(visit, /No showing, travel booking or appointment is confirmed/);
});

test("loan report retains all three lenders, explicit unknowns and no approval conclusion", () => {
  const report = buyer.loansReport("Test property", [loan({ lender: "One" }), loan({ lender: "Two", cashToClose: "10000" }), loan({ lender: "Three", notes: "Ask about rate lock" })]);
  for (const label of ["LENDER 1: One", "LENDER 2: Two", "LENDER 3: Three", "Ask about rate lock", "Not entered", "not a loan offer, approval or lender recommendation"]) assert.ok(report.includes(label), label);
});
