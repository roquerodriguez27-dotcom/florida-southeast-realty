import assert from "node:assert/strict";
import { loadPlanningModule } from "./planning-test-loader.mjs";

const {
  SELLER_COST_FIELDS, newSellerCosts, chooseListingBrokerage, sellerNumber, readSellerCosts, calculateSellerProceeds,
  sellerDaysBetween, shiftSellerDate, sellerTimingPlan, newSellerOffer,
  buildSellerProceedsReport, buildSellerOfferReport, buildSellerTimingReport,
} = await loadPlanningModule("lib/planning/seller.ts");

const completeForm = () => ({ ...chooseListingBrokerage(newSellerCosts(), "fsr"), buyerFeeFunding: "seller-extra", ...Object.fromEntries(SELLER_COST_FIELDS.map(({ key }) => [key, "0"])), buyerFee: "0" });
const baseline = readSellerCosts(completeForm());
assert.equal(baseline.missing.length, 0);
assert.equal(calculateSellerProceeds(600000, baseline.costs).netAtClosing, 597000);

// Every fee, payoff, debit, credit and separately entered tax reserve has one role.
const complete = {
  ...completeForm(), buyerFee: "2", mortgagePayoff: "300000", otherLiens: "10000", sellerConcessions: "5000",
  repairs: "2000", titleSettlement: "3000", transferTaxes: "3500", propertyTaxDebit: "1000",
  hoaCosts: "500", otherCosts: "2000", propertyTaxCredit: "1000", otherCredits: "500", taxReserve: "20000",
};
const result = calculateSellerProceeds(600000, readSellerCosts(complete).costs);
assert.equal(result.listingFee, 3000);
assert.equal(result.buyerFee, 12000);
assert.equal(result.charges, 342000);
assert.equal(result.credits, 1500);
assert.equal(result.netAtClosing, 259500);
assert.equal(result.afterTaxReserve, 239500);
assert.equal(calculateSellerProceeds(100000, { ...baseline.costs, mortgagePayoff: 120000 }).netAtClosing, -20500, "A shortfall must not be clamped to zero.");
const flat = { ...baseline.costs, listingFee: { mode: "flat", value: 1000 } };
assert.equal(calculateSellerProceeds(100000, flat).netAtClosing, 99000);
assert.equal(calculateSellerProceeds(200000, flat).netAtClosing, 199000, "A fixed fee must not scale with sale price.");
const cents = calculateSellerProceeds(100, { ...baseline.costs, listingFee: { mode: "flat", value: 0 }, propertyTaxCredit: 0.333, otherCredits: 0.333 });
assert.equal(cents.credits, 0.66, "Individually stated currency lines round to cents before totaling.");

for (const price of [0, -1, NaN, Infinity, 1000000001]) assert.throws(() => calculateSellerProceeds(price, baseline.costs), /sale price/);
assert.throws(() => calculateSellerProceeds(500000, { ...baseline.costs, mortgagePayoff: -1 }), /Invalid/);
assert.throws(() => calculateSellerProceeds(500000, { ...baseline.costs, listingFee: { mode: "percent", value: 101 } }), /Invalid brokerage/);
for (const value of ["", "-1", "Infinity", "NaN", "1e9", "0x10", "1000000001"]) assert.equal(sellerNumber(value), null);
assert.equal(sellerNumber("500,000.25"), 500000.25);
assert.equal(sellerNumber("0"), 0);
const blank = readSellerCosts(newSellerCosts());
assert.equal(blank.missing.length, 13);
assert.equal(readSellerCosts({ ...completeForm(), buyerFee: "-2" }).errors.length, 1);
assert.match(buildSellerProceedsReport(["600000", "", ""], newSellerCosts(), "", ""), /Unentered amounts above are excluded/);

// Calendar dates must stay correct over daylight-saving and leap-year boundaries.
assert.equal(sellerDaysBetween("2026-11-01", "2026-11-02"), 1);
assert.equal(sellerDaysBetween("2028-02-28", "2028-03-01"), 2);
assert.equal(sellerDaysBetween("2026-02-30", "2026-03-01"), null);
assert.equal(shiftSellerDate("2026-03-01", -1), "2026-02-28");
const timing = { mode: "sell-first", saleDate: "2026-12-30", purchaseDate: "2027-01-15", preparationDays: "7", marketingDays: "14", contractDays: "30", dailyCost: "100" };
const plan = sellerTimingPlan(timing);
assert.equal(plan.errors.length, 0);
assert.equal(plan.gapDays, 16);
assert.equal(plan.estimatedGapCost, 1600);
assert.equal(plan.contractDate, "2026-11-30");
assert.equal(plan.listDate, "2026-11-16");
assert.equal(plan.prepareDate, "2026-11-09");
assert.equal(sellerTimingPlan({ ...timing, mode: "buy-first", saleDate: "2027-01-15", purchaseDate: "2026-12-30" }).gapDays, 16);
assert.equal(sellerTimingPlan({ ...timing, mode: "buy-first" }).errors.length, 1, "An opposite closing sequence requires correction.");
assert.equal(sellerTimingPlan({ ...timing, dailyCost: "" }).estimatedGapCost, null, "An unknown daily cost must not appear as a confirmed zero.");
assert.equal(sellerTimingPlan({ ...timing, contractDays: "" }).contractDate, null);
assert.equal(sellerTimingPlan({ ...timing, preparationDays: "3.5" }).errors.length, 1);

// Offers use their own concession amounts, and deposits are not deducted twice.
const offer = { ...newSellerOffer(1), price: "600000", concessions: "1000", deposit: "10000" };
const offerReport = buildSellerOfferReport([offer], { ...completeForm(), sellerConcessions: "99999" }, "Test property", "");
assert.match(offerReport, /Estimated seller proceeds: \$596,000\.00/);
assert.match(buildSellerOfferReport([{ ...offer, deposit: "90000" }], completeForm(), "Test property", ""), /Estimated seller proceeds: \$596,000\.00/);

// Largest permitted text entries must remain complete within the handoff target.
const longestOffers = [1, 2, 3].map((index) => ({
  ...newSellerOffer(index), label: "L".repeat(40), price: "1000000000", concessions: "1000000000", deposit: "1000000000",
  financing: "Other arrangement", closingDate: "2027-12-31", inspection: "I".repeat(120), appraisal: "No appraisal contingency stated",
  financingTerms: "F".repeat(120), possession: "P".repeat(100), notes: "N".repeat(120),
}));
const largeCosts = { ...completeForm(), ...Object.fromEntries(SELLER_COST_FIELDS.map(({ key }) => [key, "1000000000"])), listingFeeMode: "flat", listingFee: "1000000000", buyerFeeMode: "flat", buyerFee: "1000000000" };
const reportSizes = {
  proceeds: buildSellerProceedsReport(["1000000000", "1000000000", "1000000000"], largeCosts, "A".repeat(160), "N".repeat(300)).length,
  offers: buildSellerOfferReport(longestOffers, largeCosts, "A".repeat(160), "N".repeat(300)).length,
  timing: buildSellerTimingReport(timing, "A".repeat(160), "N".repeat(400)).length,
};
for (const [name, size] of Object.entries(reportSizes)) assert.ok(size < 5000, `${name} report must stay complete under 5,000 characters; got ${size}`);
console.log("Seller planning arithmetic, blank-cost handling, dates, offer deposits and report-size checks passed.");
console.log(`Worst-case report lengths: ${JSON.stringify(reportSizes)}. No network requests or leads were created.`);
