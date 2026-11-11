import { moneyCents, percentOfMoney, planningNumber, roundPlanningMoney } from "./calculator-core";

export const SELLER_TOOLS = [
  { id: "proceeds", label: "Sale proceeds" },
  { id: "timing", label: "Sell & buy timing" },
  { id: "prepare", label: "Prepare to sell" },
  { id: "offers", label: "Compare offers" },
  { id: "report", label: "Weekly report" },
] as const;
export type SellerTool = (typeof SELLER_TOOLS)[number]["id"];
export type FeeMode = "percent" | "flat";
export type ListingBrokerage = "undecided" | "fsr" | "other";
export type BuyerFeeFunding = "undecided" | "seller-extra" | "listing-fee" | "seller-credit" | "other-payer" | "none";
export const LISTING_BROKERAGES: { value: ListingBrokerage; label: string }[] = [
  { value: "undecided", label: "Not decided / not entered" },
  { value: "fsr", label: "Florida Southeast Realty is listing for the seller" },
  { value: "other", label: "Another listing brokerage" },
];
export const BUYER_FEE_FUNDING: { value: BuyerFeeFunding; label: string }[] = [
  { value: "undecided", label: "Not decided / confirm the agreement" },
  { value: "seller-extra", label: "Additional amount paid by this seller" },
  { value: "listing-fee", label: "Already included in the listing brokerage fee" },
  { value: "seller-credit", label: "Already included in the entered seller credit" },
  { value: "other-payer", label: "Paid by buyer or another party, not this seller" },
  { value: "none", label: "No buyer-broker compensation applies" },
];

export const SELLER_COST_FIELDS = [
  { key: "mortgagePayoff", label: "First mortgage payoff", group: "charge" },
  { key: "otherLiens", label: "Other loans or liens to pay off", group: "charge" },
  { key: "sellerConcessions", label: "Credit or concessions to buyer", group: "charge" },
  { key: "repairs", label: "Repair costs due at closing", group: "charge" },
  { key: "titleSettlement", label: "Title, settlement and recording costs", group: "charge" },
  { key: "transferTaxes", label: "Transfer taxes — seller’s share", group: "charge" },
  { key: "propertyTaxDebit", label: "Property-tax proration owed by seller", group: "charge" },
  { key: "hoaCosts", label: "HOA / condo charges or assessments", group: "charge" },
  { key: "otherCosts", label: "Other seller costs", group: "charge" },
  { key: "propertyTaxCredit", label: "Property-tax credit to seller", group: "credit" },
  { key: "otherCredits", label: "Other credits to seller", group: "credit" },
  { key: "taxReserve", label: "Optional income-tax reserve after closing", group: "reserve" },
] as const;

export type SellerCostKey = (typeof SELLER_COST_FIELDS)[number]["key"];
export type SellerCostForm = Record<SellerCostKey, string> & {
  listingBrokerage: ListingBrokerage; buyerFeeFunding: BuyerFeeFunding;
  listingFeeMode: FeeMode; listingFee: string; buyerFeeMode: FeeMode; buyerFee: string;
};
export type SellerCosts = Record<SellerCostKey, number> & {
  listingFee: { mode: FeeMode; value: number };
  buyerFee: { mode: FeeMode; value: number };
};

export function newSellerCosts(): SellerCostForm {
  const amounts = Object.fromEntries(SELLER_COST_FIELDS.map((field) => [field.key, ""])) as Record<SellerCostKey, string>;
  return { ...amounts, listingBrokerage: "undecided", buyerFeeFunding: "undecided", listingFeeMode: "percent", listingFee: "", buyerFeeMode: "percent", buyerFee: "" };
}

/** A brokerage change clears old assumptions. Only an explicit FSR selection supplies its advertised fee. */
export function chooseListingBrokerage(form: SellerCostForm, listingBrokerage: ListingBrokerage): SellerCostForm {
  if (!LISTING_BROKERAGES.some(option => option.value === listingBrokerage)) throw new RangeError("Choose a listed brokerage option.");
  return { ...form, listingBrokerage, listingFeeMode: "percent", listingFee: listingBrokerage === "fsr" ? "0.5" : "" };
}

export function sellerNumber(raw: string, maximum = 1_000_000_000): number | null {
  return planningNumber(raw, maximum);
}

export function sellerMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function sellerAmountText(raw: string): string {
  const value = sellerNumber(raw);
  return value === null ? raw.trim() ? "Invalid amount — please correct" : "Not entered" : sellerMoney(value);
}

const roundMoney = roundPlanningMoney;

export function readSellerCosts(form: SellerCostForm, omitConcessions = false) {
  const missing: string[] = [];
  const errors: string[] = [];
  const read = (raw: string, label: string, maximum = 1_000_000_000) => {
    const value = sellerNumber(raw, maximum);
    if (!raw.trim()) missing.push(label);
    else if (value === null) errors.push(`${label}: enter a nonnegative number${maximum === 100 ? " from 0 to 100" : ""}.`);
    return value ?? 0;
  };
  const amounts = Object.fromEntries(SELLER_COST_FIELDS.map((field) => [
    field.key, field.key === "sellerConcessions" && omitConcessions ? 0
      : field.key === "taxReserve" && !form[field.key].trim() ? 0 : read(form[field.key], field.label),
  ])) as Record<SellerCostKey, number>;
  if (!LISTING_BROKERAGES.some(option => option.value === form.listingBrokerage)) errors.push("Choose who is listing the property.");
  if (!BUYER_FEE_FUNDING.some(option => option.value === form.buyerFeeFunding)) errors.push("Choose how buyer-broker compensation is funded.");
  const listingKnown = form.listingBrokerage === "fsr" || form.listingBrokerage === "other";
  if (!listingKnown) missing.push("Listing brokerage and agreed listing fee");
  if (form.buyerFeeFunding === "undecided") missing.push("Buyer-broker compensation funding");
  const costs: SellerCosts = {
    ...amounts,
    listingFee: { mode: form.listingFeeMode, value: listingKnown ? read(form.listingFee, "Listing-side brokerage fee", form.listingFeeMode === "percent" ? 100 : undefined) : 0 },
    buyerFee: { mode: form.buyerFeeMode, value: form.buyerFeeFunding === "seller-extra" ? read(form.buyerFee, "Additional seller-paid buyer-broker compensation", form.buyerFeeMode === "percent" ? 100 : undefined) : 0 },
  };
  if (!["percent", "flat"].includes(form.listingFeeMode) || !["percent", "flat"].includes(form.buyerFeeMode)) errors.push("Choose a percentage or fixed fee.");
  return { costs, missing, errors };
}

export function calculateSellerProceeds(salePrice: number, costs: SellerCosts) {
  if (!Number.isFinite(salePrice) || salePrice < 0.01 || salePrice > 1_000_000_000) throw new RangeError("Enter a valid positive sale price.");
  const price = roundMoney(salePrice);
  for (const field of SELLER_COST_FIELDS) {
    if (!Number.isFinite(costs[field.key]) || costs[field.key] < 0 || costs[field.key] > 1_000_000_000) throw new RangeError(`Invalid ${field.label}.`);
  }
  const feeAmount = (fee: SellerCosts["listingFee"]) => {
    if (!["percent", "flat"].includes(fee.mode) || !Number.isFinite(fee.value) || fee.value < 0 || fee.value > (fee.mode === "percent" ? 100 : 1_000_000_000)) throw new RangeError("Invalid brokerage fee.");
    return fee.mode === "percent" ? percentOfMoney(price, fee.value) : roundMoney(fee.value);
  };
  const listingFee = feeAmount(costs.listingFee);
  const buyerFee = feeAmount(costs.buyerFee);
  const chargeCents = moneyCents(listingFee) + moneyCents(buyerFee) + SELLER_COST_FIELDS.filter((field) => field.group === "charge").reduce((sum, field) => sum + moneyCents(costs[field.key]), 0);
  const creditCents = moneyCents(costs.propertyTaxCredit) + moneyCents(costs.otherCredits);
  const charges = chargeCents / 100, credits = creditCents / 100;
  const netAtClosing = (moneyCents(price) - chargeCents + creditCents) / 100;
  const afterTaxReserve = (moneyCents(netAtClosing) - moneyCents(costs.taxReserve)) / 100;
  return { listingFee, buyerFee, charges, credits, netAtClosing, afterTaxReserve };
}

export function sellerCalculation(salePrice: number, form: SellerCostForm, offerConcessions?: string) {
  const effectiveForm = offerConcessions === undefined ? form : { ...form, sellerConcessions: offerConcessions };
  const read = readSellerCosts(effectiveForm);
  const priceValid = Number.isFinite(salePrice) && salePrice >= 0.01 && salePrice <= 1_000_000_000;
  const result = priceValid && !read.errors.length ? calculateSellerProceeds(salePrice, read.costs) : null;
  const brokerage = LISTING_BROKERAGES.find(option => option.value === form.listingBrokerage)?.label ?? "Not entered";
  const funding = BUYER_FEE_FUNDING.find(option => option.value === form.buyerFeeFunding)?.label ?? "Not entered";
  const rateLabel = form.listingFee.trim() ? form.listingFeeMode === "percent" ? `${form.listingFee}%` : "fixed amount" : "not entered";
  const rows: { label: string; kind: "charge" | "credit"; amount: number | null }[] = [
    { label: `Listing brokerage fee (${rateLabel})`, kind: "charge", amount: form.listingBrokerage !== "undecided" && form.listingFee.trim() && result ? result.listingFee : null },
    { label: "Additional seller-paid buyer-broker compensation", kind: "charge", amount: form.buyerFeeFunding === "undecided" || (form.buyerFeeFunding === "seller-extra" && !form.buyerFee.trim()) ? null : result?.buyerFee ?? null },
    ...SELLER_COST_FIELDS.filter(field => field.group !== "reserve").map(field => ({
      label: field.label, kind: field.group as "charge" | "credit",
      amount: effectiveForm[field.key].trim() && sellerNumber(effectiveForm[field.key]) !== null ? roundMoney(read.costs[field.key]) : null,
    })),
  ];
  return {
    result, rows, missing: read.missing, errors: read.errors, brokerage, funding,
    resultLabel: read.missing.length ? "Subtotal before missing costs" : "Estimated seller proceeds",
    reserve: form.taxReserve.trim() && sellerNumber(form.taxReserve) !== null ? roundMoney(read.costs.taxReserve) : null,
  };
}

export function sellerCalculationLines(salePrice: number, form: SellerCostForm, offerConcessions?: string): string[] {
  const c = sellerCalculation(salePrice, form, offerConcessions);
  const concessionText = offerConcessions === undefined ? form.sellerConcessions : offerConcessions;
  const concession = sellerNumber(concessionText);
  const otherCharges = c.result ? (moneyCents(c.result.charges) - moneyCents(c.result.listingFee)
    - moneyCents(c.result.buyerFee) - moneyCents(concession ?? 0)) / 100 : null;
  return [
    `Sale price: ${sellerMoney(salePrice)}`,
    ...c.rows.slice(0, 2).map(row => `${row.label}: ${row.amount === null ? "Not confirmed" : `Deduct ${sellerMoney(row.amount)}`}`),
    `Seller credit / concessions: ${concession === null ? "Not entered" : `Deduct ${sellerMoney(roundMoney(concession))}`}`,
    `Other charges (itemized below): ${otherCharges === null ? "Not calculated" : sellerMoney(otherCharges)}; seller credits: ${c.result ? sellerMoney(c.result.credits) : "Not calculated"}`,
    `${c.resultLabel}: ${c.result ? sellerMoney(c.result.netAtClosing) : "Not calculated"}`,
    ...(c.missing.length ? [`${c.missing.length} inputs are not confirmed; see shared assumptions. Missing amounts are not zero.`] : []),
    ...(c.errors.length ? [`Correct: ${c.errors.join("; ")}`] : []),
    c.reserve === null ? "Optional after-closing tax reserve: Not entered; income tax is not calculated."
      : `After entered tax reserve: ${c.result ? sellerMoney(c.result.afterTaxReserve) : "Not calculated"}`,
  ];
}

export function sellerCostReport(form: SellerCostForm, omitConcessions = false): string[] {
  const fee = (raw: string, mode: FeeMode) => raw.trim() ? mode === "percent" ? `${raw}% of sale price` : sellerAmountText(raw) : "Not entered";
  return [
    "FSR’s advertised 0.5% excludes buyer-broker compensation; use the actual agreed fees.",
    `Listing arrangement: ${LISTING_BROKERAGES.find(option => option.value === form.listingBrokerage)?.label ?? "Not entered"}`,
    `Listing-side fee: ${form.listingBrokerage === "undecided" ? "Not confirmed" : fee(form.listingFee, form.listingFeeMode)}`,
    `Buyer-broker funding: ${BUYER_FEE_FUNDING.find(option => option.value === form.buyerFeeFunding)?.label ?? "Not entered"}`,
    `Additional seller-paid buyer-broker compensation: ${form.buyerFeeFunding === "seller-extra" ? fee(form.buyerFee, form.buyerFeeMode) : form.buyerFeeFunding === "undecided" ? "Not confirmed" : "No separate deduction under selected funding arrangement"}`,
    ...SELLER_COST_FIELDS.filter((field) => !omitConcessions || field.key !== "sellerConcessions").map((field) => `${field.label}: ${sellerAmountText(form[field.key])}`),
  ];
}

export function buildSellerProceedsReport(prices: readonly string[], form: SellerCostForm, property: string, notes: string): string {
  const read = readSellerCosts(form);
  return [
    "SELLER PROCEEDS WORKSHEET",
    `Property: ${property.trim() || "Not entered"}`,
    "Planning arithmetic from entered assumptions; not a valuation or closing statement.",
    ...prices.slice(0, 3).flatMap((raw, index) => {
      const price = sellerNumber(raw);
      if (!price || read.errors.length) return [`Scenario ${index + 1}: ${raw.trim() ? "Enter valid price and costs" : "Price not entered"}`];
      return [`Scenario ${index + 1}`, ...sellerCalculationLines(price, form)];
    }),
    "", "SHARED ASSUMPTIONS", ...sellerCostReport(form),
    read.missing.length ? "Unentered amounts above are excluded; enter 0 only where none applies." : "All required closing-cost inputs have an entered amount.",
    "Income/capital-gains tax is not calculated. Any tax reserve is entered by the user.",
    `Notes: ${notes.trim() || "None entered"}`,
  ].join("\n");
}

function dateTimestamp(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date ? stamp : null;
}

export function sellerDate(date: string): string {
  const stamp = dateTimestamp(date);
  return stamp === null ? date ? "Invalid date" : "Not entered" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(stamp);
}

export function sellerDaysBetween(from: string, to: string): number | null {
  const first = dateTimestamp(from);
  const second = dateTimestamp(to);
  return first === null || second === null ? null : Math.round((second - first) / 86_400_000);
}

export function shiftSellerDate(date: string, days: number): string | null {
  const stamp = dateTimestamp(date);
  if (stamp === null || !Number.isInteger(days) || Math.abs(days) > 3650) return null;
  const shifted = new Date(stamp + days * 86_400_000).toISOString().slice(0, 10);
  return dateTimestamp(shifted) === null ? null : shifted;
}

export interface SellerTimingDraft {
  mode: "sell-first" | "buy-first";
  saleDate: string; purchaseDate: string;
  preparationDays: string; marketingDays: string; contractDays: string; dailyCost: string;
}

export function sellerTimingPlan(draft: SellerTimingDraft) {
  const errors: string[] = [];
  if (!["sell-first", "buy-first"].includes(draft.mode)) errors.push("Choose a sell-first or buy-first sequence.");
  const duration = (raw: string, label: string) => {
    const value = sellerNumber(raw, 3650);
    if (raw && (value === null || !Number.isInteger(value))) errors.push(`${label}: enter a whole number of days from 0 to 3,650.`);
    return value !== null && Number.isInteger(value) ? value : null;
  };
  for (const [label, value] of [["Sale closing", draft.saleDate], ["Purchase closing", draft.purchaseDate]]) {
    if (value && dateTimestamp(value) === null) errors.push(`${label}: enter a valid date.`);
  }
  const preparationDays = duration(draft.preparationDays, "Preparation");
  const marketingDays = duration(draft.marketingDays, "Marketing period");
  const contractDays = duration(draft.contractDays, "Contract-to-close period");
  const dailyCost = sellerNumber(draft.dailyCost);
  if (draft.dailyCost && dailyCost === null) errors.push("Daily cost: enter a nonnegative amount.");
  const gapDays = draft.mode === "sell-first" ? sellerDaysBetween(draft.saleDate, draft.purchaseDate) : sellerDaysBetween(draft.purchaseDate, draft.saleDate);
  if (gapDays !== null && gapDays < 0) errors.push("The closing dates run in the opposite order to your selected plan. Adjust the dates or choose the other sequence.");
  const contractDate = contractDays === null ? null : shiftSellerDate(draft.saleDate, -contractDays);
  const listDate = contractDate && marketingDays !== null ? shiftSellerDate(contractDate, -marketingDays) : null;
  const prepareDate = listDate && preparationDays !== null ? shiftSellerDate(listDate, -preparationDays) : null;
  if (gapDays !== null && gapDays > 3650) errors.push("This timing planner supports at most 3,650 days between closings.");
  if ((contractDays !== null && dateTimestamp(draft.saleDate) !== null && !contractDate)
    || (contractDate && marketingDays !== null && !listDate)
    || (listDate && preparationDays !== null && !prepareDate)) errors.push("A calculated planning date is outside the supported calendar range.");
  const estimatedGapCost = !errors.length && gapDays !== null && gapDays >= 0 && dailyCost !== null
    ? moneyCents(dailyCost) * gapDays / 100 : null;
  return { errors, gapDays, estimatedGapCost, contractDate, listDate, prepareDate };
}

export function buildSellerTimingReport(draft: SellerTimingDraft, property: string, notes: string): string {
  const plan = sellerTimingPlan(draft);
  return [
    "SELL & BUY TIMING WORKSHEET", `Property: ${property.trim() || "Not entered"}`,
    `Sequence: ${draft.mode === "sell-first" ? "Sell first, then buy" : "Buy first, then sell"}`,
    `Target sale closing: ${sellerDate(draft.saleDate)}`, `Target purchase closing: ${sellerDate(draft.purchaseDate)}`,
    `Preparation assumption: ${draft.preparationDays || "Not entered"} days`,
    `Marketing-period assumption: ${draft.marketingDays || "Not entered"} days`,
    `Contract-to-close assumption: ${draft.contractDays || "Not entered"} days`,
    `Planning start: ${sellerDate(plan.prepareDate ?? "")}`, `Planning listing date: ${sellerDate(plan.listDate ?? "")}`, `Planning contract date: ${sellerDate(plan.contractDate ?? "")}`,
    `Gap / overlap: ${plan.gapDays === null ? "Not calculated" : `${plan.gapDays} days`}`,
    `${draft.mode === "sell-first" ? "Temporary housing / storage" : "Additional ownership carrying cost"} per day: ${sellerAmountText(draft.dailyCost)}`,
    `Entered gap / overlap cost: ${plan.estimatedGapCost === null ? "Not calculated" : sellerMoney(plan.estimatedGapCost)}`,
    ...(plan.errors.length ? ["Needs correction:", ...plan.errors] : []),
    "Dates are planning targets, not contract deadlines, possession rights or confirmed appointments. Verify access to sale proceeds, lending and closing arrangements before committing.",
    `Questions: ${notes.trim() || "None entered"}`,
  ].join("\n");
}

export interface SellerOfferDraft {
  label: string; price: string; concessions: string; deposit: string;
  financing: string; closingDate: string; inspection: string;
  appraisal: string; financingTerms: string; possession: string; notes: string;
}

export function newSellerOffer(index: number): SellerOfferDraft {
  return { label: `Offer ${index}`, price: "", concessions: "", deposit: "", financing: "Not specified", closingDate: "", inspection: "", appraisal: "Not specified", financingTerms: "", possession: "", notes: "" };
}

export function buildSellerOfferReport(offers: readonly SellerOfferDraft[], form: SellerCostForm, property: string, notes: string): string {
  const read = readSellerCosts(form, true);
  return [
    "SELLER OFFER COMPARISON", `Property: ${property.trim() || "Not entered"}`,
    "Compare price and contract terms together. No automatic winner is selected.",
    ...offers.slice(0, 3).flatMap((offer) => {
      const price = sellerNumber(offer.price);
      const concessions = sellerNumber(offer.concessions);
      const valid = price !== null && price > 0 && read.errors.length === 0 && (!offer.concessions.trim() || concessions !== null);
      const lines = valid ? sellerCalculationLines(price!, form, offer.concessions) : ["Seller proceeds: Not calculated; check price and costs."];
      return [
        "", offer.label || "Unnamed offer",
        `Deposit (part of price): ${sellerAmountText(offer.deposit)}`,
        ...lines,
        `Financing: ${offer.financing}; target close: ${sellerDate(offer.closingDate)}`,
        `Inspection: ${offer.inspection.trim() || "Not entered"}; appraisal: ${offer.appraisal}`,
        `Financing terms: ${offer.financingTerms.trim() || "Not entered"}`,
        `Possession: ${offer.possession.trim() || "Not entered"}; other terms: ${offer.notes.trim() || "Not entered"}`,
      ];
    }),
    "", "COMMON COST ASSUMPTIONS", ...sellerCostReport(form, true),
    "Offer concessions replace shared concessions. Deposits are part of the price, not another deduction. Missing costs are excluded; estimates are not closing statements.",
    `Questions for review: ${notes.trim() || "None entered"}`,
  ].join("\n");
}
