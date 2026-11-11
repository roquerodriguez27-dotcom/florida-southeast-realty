import { affordabilityBudget, buyerMonthlyCosts, planningNumber, type AffordabilityInputs, type BuyerCostInputs } from "./calculator-core";

export const BUYER_INPUT_LABELS = {
  price: "Purchase price", downPercent: "Down payment (%)", rate: "Annual interest rate assumption (%)",
  years: "Loan term (whole years)", taxRate: "Annual tax assumption (% of purchase price, not millage)",
  insurance: "Home insurance per month", flood: "Flood insurance per month", hoa: "HOA / condo fees per month",
  cdd: "CDD / other assessments per month", pmiRate: "Annual PMI assumption (% of initial loan)",
  income: "Annual household income", monthlyDebt: "Other monthly debt payments", cash: "Cash available for this purchase",
  dti: "Total debt-to-income assumption (%)", housingPercent: "Housing-income assumption (%)",
  closingCosts: "Estimated closing costs before credits", closingCredits: "Confirmed closing credits (0 if none)",
} as const;
export type BuyerInputKey = keyof typeof BUYER_INPUT_LABELS;
export type BuyerPlannerInputs = Record<BuyerInputKey, string>;
export type BuyerComparisonHome = { address: string; price: string; beds: string; baths: string; sqft: string; hoa: string; yearBuilt: string; notes: string };

export function newBuyerPlannerInputs(listing?: { price: number; associationFeeMonthly?: number }): BuyerPlannerInputs {
  return {
    price: listing ? String(listing.price) : "", downPercent: "20", rate: "", years: "30", taxRate: "",
    insurance: "", flood: "", hoa: listing?.associationFeeMonthly === undefined ? "" : String(listing.associationFeeMonthly),
    cdd: "", pmiRate: "", income: "", monthlyDebt: "", cash: "", dti: "36", housingPercent: "28", closingCosts: "", closingCredits: "",
  };
}

const commonKeys: BuyerInputKey[] = ["downPercent", "rate", "years", "taxRate", "insurance", "flood", "hoa", "cdd", "pmiRate"];
export function buyerRequiredKeys(tool: "cost" | "affordability", form: BuyerPlannerInputs): BuyerInputKey[] {
  const down = planningNumber(form.downPercent, 100);
  const keys = commonKeys.filter(key => !(down === 100 && (key === "rate" || key === "years")) && !(down !== null && down >= 20 && key === "pmiRate"));
  return tool === "cost" ? ["price", ...keys] : [...keys, "income", "monthlyDebt", "cash", "dti", "housingPercent", "closingCosts", "closingCredits"];
}

export function analyzeBuyerPlanner(tool: "cost" | "affordability", form: BuyerPlannerInputs) {
  const missing: string[] = [], errors: string[] = [];
  const values: Partial<Record<BuyerInputKey, number>> = {};
  for (const key of buyerRequiredKeys(tool, form)) {
    const raw = form[key];
    if (!raw.trim()) { missing.push(BUYER_INPUT_LABELS[key]); continue; }
    const max = ["downPercent", "rate", "taxRate", "pmiRate", "dti", "housingPercent"].includes(key) ? 100 : key === "years" ? 50 : 1_000_000_000;
    const value = planningNumber(raw, max);
    if (value === null || (key === "price" && value <= 0) || (key === "years" && (value < 1 || !Number.isInteger(value)))) {
      errors.push(`${BUYER_INPUT_LABELS[key]}: enter ${key === "years" ? "a whole number from 1 to 50" : key === "price" ? "a positive amount up to 1,000,000,000" : `a number from 0 to ${max.toLocaleString("en-US")}`}.`);
    } else values[key] = value;
  }
  let monthly: ReturnType<typeof buyerMonthlyCosts> | null = null;
  let budget: ReturnType<typeof affordabilityBudget> | null = null;
  if (!missing.length && !errors.length) {
    // Non-applicable loan inputs are zero/no loan, not unknown expenses being silently discarded.
    const normalized = { ...values, rate: values.rate ?? 0, years: values.years ?? 30, pmiRate: values.pmiRate ?? 0 };
    try {
      if (tool === "cost") monthly = buyerMonthlyCosts(normalized as BuyerCostInputs);
      else budget = affordabilityBudget(normalized as AffordabilityInputs);
    } catch (error) { errors.push(error instanceof Error ? error.message : "Check the entered amounts."); }
  }
  return { missing, errors, monthly, budget };
}

export const MONTHLY_COST_LABELS = [
  ["principalInterest", "Principal and interest"], ["taxes", "Estimated property taxes"],
  ["insurance", "Home insurance"], ["flood", "Flood insurance"], ["hoa", "HOA / condo fees"],
  ["cdd", "CDD / other assessments"], ["pmi", "Estimated PMI"],
] as const;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const entered = (value: string) => value.trim() || "Not entered / unknown";
export const BUYER_MODEL_LIMITS = "Fixed-rate conventional-loan planning model, not a loan approval or quote. Taxes use an entered effective percentage of purchase price, not county millage. PMI is an initial-loan assumption below 20% down, not a promise of coverage or cancellation. Maintenance, repairs, utilities and unlisted expenses are not included.";

export function buyerPlannerReport(tool: "cost" | "affordability" | "compare", form: BuyerPlannerInputs, property: string, homes: BuyerComparisonHome[] = []): string {
  if (tool === "compare") {
    const rows = homes.filter(home => [home.address, home.price, home.beds, home.baths, home.sqft, home.hoa, home.yearBuilt, home.notes].some(value => value.trim())).flatMap((home, index) => [
      `HOME ${index + 1}: ${entered(home.address)}`,
      ...[["Price", home.price], ["Bedrooms", home.beds], ["Bathrooms", home.baths], ["Living area (sq ft)", home.sqft], ["HOA / month", home.hoa], ["Year built", home.yearBuilt], ["Notes", home.notes]].map(([label, value]) => `${label}: ${entered(value)}`), "",
    ]);
    return ["BUYER HOME COMPARISON", "Listing and manual entries must be independently verified. Unknown fees are not zero.", "", ...(rows.length ? rows : ["No comparison properties entered."])].join("\n");
  }
  const review = analyzeBuyerPlanner(tool, form);
  const lines = ["BUYER PLANNING WORKSHEET", `Selected tool: ${tool}`, `Property / scenario: ${entered(property)}`,
    "Entered planning assumptions, not verified loan, insurance or county quotes. Blank means unknown; zero is an explicit entry.", "",
    ...buyerRequiredKeys(tool, form).map(key => `${BUYER_INPUT_LABELS[key]}: ${entered(form[key])}`), "",
    ...(review.missing.length ? [`Missing: ${review.missing.join("; ")}. No complete total is calculated.`] : []),
    ...review.errors,
  ];
  const costs = review.monthly ?? review.budget?.projected;
  if (review.budget) {
    lines.push(`Monthly housing budget under entered assumptions: ${money(review.budget.maxHousing)}`,
      `Closing costs after confirmed credits: ${money(review.budget.netClosingCosts)}`,
      `Cash left for down payment: ${money(review.budget.cashForDownPayment)}`);
    if (review.budget.cashShortfall > 0) lines.push(`Cash shortfall: ${money(review.budget.cashShortfall)}. No purchase budget is shown until the entered funding gap is addressed.`);
    else lines.push(`Calculated planning price: ${money(review.budget.affordablePrice ?? 0)}`);
    if (review.budget.status === "model-limit") lines.push("Result reaches this calculator's $1 billion limit, not a verified maximum budget.");
    lines.push("Housing and debt ratios are editable planning assumptions, not universal lender rules. Credits are assumed confirmed for allowable closing costs only; no credit is used for the down payment. Loan-program eligibility and credit limits are not assessed.");
  }
  if (costs) lines.push(`Down payment: ${money(costs.downPayment)}`, `Loan amount: ${money(costs.loan)}`,
    ...MONTHLY_COST_LABELS.map(([key, label]) => `${label} / month: ${money(costs[key])}`), `Estimated monthly total of included costs: ${money(costs.total)}`);
  return [...lines, "", BUYER_MODEL_LIMITS, "Review the actual property, costs and loan terms with the relevant professionals before relying on the estimate."].join("\n");
}
