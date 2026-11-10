export const SELLER_TOOLS = [
  { id: "proceeds", label: "Sale proceeds" },
  { id: "timing", label: "Sell & buy timing" },
  { id: "prepare", label: "Prepare to sell" },
  { id: "offers", label: "Compare offers" },
  { id: "report", label: "Weekly report" },
] as const;
export type SellerTool = (typeof SELLER_TOOLS)[number]["id"];
export type FeeMode = "percent" | "flat";

export const SELLER_COST_FIELDS = [
  { key: "mortgagePayoff", label: "First mortgage payoff", group: "charge" },
  { key: "otherLiens", label: "Other loans or liens to pay off", group: "charge" },
  { key: "sellerConcessions", label: "Credit or concessions to buyer", group: "charge" },
  { key: "repairs", label: "Repairs paid by seller", group: "charge" },
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
  listingFeeMode: FeeMode; listingFee: string; buyerFeeMode: FeeMode; buyerFee: string;
};
export type SellerCosts = Record<SellerCostKey, number> & {
  listingFee: { mode: FeeMode; value: number };
  buyerFee: { mode: FeeMode; value: number };
};

export function newSellerCosts(): SellerCostForm {
  const amounts = Object.fromEntries(SELLER_COST_FIELDS.map((field) => [field.key, ""])) as Record<SellerCostKey, string>;
  return { ...amounts, listingFeeMode: "percent", listingFee: "0.5", buyerFeeMode: "percent", buyerFee: "" };
}

export function sellerNumber(raw: string, maximum = 1_000_000_000): number | null {
  const text = raw.trim().replaceAll(",", "");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
}

export function sellerMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function sellerAmountText(raw: string): string {
  const value = sellerNumber(raw);
  return value === null ? raw.trim() ? "Invalid amount — please correct" : "Not entered" : sellerMoney(value);
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100 || 0;

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
    field.key, field.key === "sellerConcessions" && omitConcessions ? 0 : read(form[field.key], field.label),
  ])) as Record<SellerCostKey, number>;
  const costs: SellerCosts = {
    ...amounts,
    listingFee: { mode: form.listingFeeMode, value: read(form.listingFee, "Listing-side brokerage fee", form.listingFeeMode === "percent" ? 100 : undefined) },
    buyerFee: { mode: form.buyerFeeMode, value: read(form.buyerFee, "Separately authorized buyer-broker compensation", form.buyerFeeMode === "percent" ? 100 : undefined) },
  };
  return { costs, missing, errors };
}

export function calculateSellerProceeds(salePrice: number, costs: SellerCosts) {
  if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice > 1_000_000_000) throw new RangeError("Enter a valid positive sale price.");
  const price = roundMoney(salePrice);
  for (const field of SELLER_COST_FIELDS) {
    if (!Number.isFinite(costs[field.key]) || costs[field.key] < 0 || costs[field.key] > 1_000_000_000) throw new RangeError(`Invalid ${field.label}.`);
  }
  const feeAmount = (fee: SellerCosts["listingFee"]) => {
    if (!["percent", "flat"].includes(fee.mode) || !Number.isFinite(fee.value) || fee.value < 0 || fee.value > (fee.mode === "percent" ? 100 : 1_000_000_000)) throw new RangeError("Invalid brokerage fee.");
    return roundMoney(fee.mode === "percent" ? price * fee.value / 100 : fee.value);
  };
  const listingFee = feeAmount(costs.listingFee);
  const buyerFee = feeAmount(costs.buyerFee);
  const charges = roundMoney(listingFee + buyerFee + SELLER_COST_FIELDS.filter((field) => field.group === "charge").reduce((sum, field) => sum + roundMoney(costs[field.key]), 0));
  const credits = roundMoney(roundMoney(costs.propertyTaxCredit) + roundMoney(costs.otherCredits));
  const netAtClosing = roundMoney(price - charges + credits);
  const afterTaxReserve = roundMoney(netAtClosing - roundMoney(costs.taxReserve));
  return { listingFee, buyerFee, charges, credits, netAtClosing, afterTaxReserve };
}

export function sellerCostReport(form: SellerCostForm, omitConcessions = false): string[] {
  const fee = (raw: string, mode: FeeMode) => raw.trim() ? mode === "percent" ? `${raw}% of sale price` : sellerAmountText(raw) : "Not entered";
  return [
    `Listing-side fee: ${fee(form.listingFee, form.listingFeeMode)}`,
    `Separately authorized buyer-broker compensation: ${fee(form.buyerFee, form.buyerFeeMode)}`,
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
      const result = calculateSellerProceeds(price, read.costs);
      return [`Scenario ${index + 1}: sale ${sellerMoney(price)}; charges ${sellerMoney(result.charges)}; seller credits ${sellerMoney(result.credits)}; net at closing ${sellerMoney(result.netAtClosing)}; after entered tax reserve ${sellerMoney(result.afterTaxReserve)}.`];
    }),
    "", "SHARED ASSUMPTIONS", ...sellerCostReport(form),
    read.missing.length ? "Unentered amounts above are excluded; enter 0 only where none applies." : "Every listed cost input has an entered amount.",
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
  return new Date(stamp + days * 86_400_000).toISOString().slice(0, 10);
}

export interface SellerTimingDraft {
  mode: "sell-first" | "buy-first";
  saleDate: string; purchaseDate: string;
  preparationDays: string; marketingDays: string; contractDays: string; dailyCost: string;
}

export function sellerTimingPlan(draft: SellerTimingDraft) {
  const errors: string[] = [];
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
  const estimatedGapCost = gapDays !== null && gapDays >= 0 && dailyCost !== null ? roundMoney(gapDays * dailyCost) : null;
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
      const result = valid ? calculateSellerProceeds(price!, { ...read.costs, sellerConcessions: concessions ?? 0 }) : null;
      return [
        "", offer.label || "Unnamed offer",
        `Price: ${sellerAmountText(offer.price)}; seller concessions: ${sellerAmountText(offer.concessions)}; deposit: ${sellerAmountText(offer.deposit)}`,
        `Net at closing from entered amounts: ${result ? sellerMoney(result.netAtClosing) : "Not calculated"}; after entered tax reserve: ${result ? sellerMoney(result.afterTaxReserve) : "Not calculated"}`,
        `Financing: ${offer.financing}; target close: ${sellerDate(offer.closingDate)}`,
        `Inspection: ${offer.inspection.trim() || "Not entered"}; appraisal: ${offer.appraisal}`,
        `Financing terms: ${offer.financingTerms.trim() || "Not entered"}`,
        `Possession: ${offer.possession.trim() || "Not entered"}; other terms: ${offer.notes.trim() || "Not entered"}`,
      ];
    }),
    "", "COMMON COST ASSUMPTIONS", ...sellerCostReport(form, true),
    "Each offer’s concessions replace the proceeds worksheet’s concession input. Deposits are part of the price and are not deducted again. Unentered costs are excluded; estimates are not closing statements.",
    `Questions for review: ${notes.trim() || "None entered"}`,
  ].join("\n");
}
