/** Pure planning arithmetic. No current rates, eligibility decisions or network access.
 * Amounts are dollars; annual rates and down payments are percentage points.
 * Currency outputs round half away from zero to cents, then totals sum those cents.
 */
export const MAX_PLANNING_AMOUNT = 1_000_000_000;
export const MAX_LOAN_YEARS = 50;

function finiteBetween(value: number, label: string, low: number, high: number): void {
  if (!Number.isFinite(value) || value < low || value > high) {
    throw new RangeError(`${label} must be between ${low} and ${high}.`);
  }
}

/** Convert a finite decimal number's string representation to an exact ratio. */
function decimalRatio(value: number): [bigint, bigint] {
  if (!Number.isFinite(value)) throw new RangeError("Enter a finite number.");
  const match = String(Math.abs(value)).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new RangeError("Invalid decimal number.");
  const digits = match[1] + (match[2] ?? "");
  const places = (match[2]?.length ?? 0) - Number(match[3] ?? 0);
  const magnitude = BigInt(digits);
  const ten = BigInt(10);
  return places >= 0
    ? [value < 0 ? -magnitude : magnitude, ten ** BigInt(places)]
    : [(value < 0 ? -magnitude : magnitude) * ten ** BigInt(-places), BigInt(1)];
}

function roundedRatio(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < BigInt(0) ? -BigInt(1) : BigInt(1);
  const absolute = numerator * sign;
  return sign * ((absolute * BigInt(2) + denominator) / (denominator * BigInt(2)));
}

export function moneyCents(amount: number): number {
  finiteBetween(amount, "Amount", -MAX_PLANNING_AMOUNT * 100, MAX_PLANNING_AMOUNT * 100);
  const [numerator, denominator] = decimalRatio(amount);
  return Number(roundedRatio(numerator * BigInt(100), denominator));
}

export function roundPlanningMoney(amount: number): number {
  return moneyCents(amount) / 100 || 0;
}

export function percentOfMoney(amount: number, percent: number): number {
  finiteBetween(amount, "Amount", 0, MAX_PLANNING_AMOUNT);
  finiteBetween(percent, "Percentage", 0, 100);
  const [numerator, denominator] = decimalRatio(percent);
  return Number(roundedRatio(BigInt(moneyCents(amount)) * numerator, denominator * BigInt(100))) / 100;
}

export function planningNumber(raw: string, maximum = MAX_PLANNING_AMOUNT): number | null {
  const value = raw.trim();
  if (value.length > 64) return null;
  // Blanks, exponents, currency symbols and malformed separators remain unknown/invalid.
  // Commas are accepted only as correctly grouped thousands, never silently removed.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?$|^\.\d+$/.test(value)) return null;
  const number = Number(value.replaceAll(",", ""));
  return Number.isFinite(number) && number >= 0 && number <= maximum ? number : null;
}

export function fixedMortgagePayment(principal: number, annualRate: number, years: number): number {
  finiteBetween(principal, "Loan amount", 0, MAX_PLANNING_AMOUNT);
  finiteBetween(annualRate, "Annual interest rate", 0, 100);
  finiteBetween(years, "Loan term", 1, MAX_LOAN_YEARS);
  if (!Number.isInteger(years)) throw new RangeError("Loan term must be a whole number of years.");
  if (principal === 0) return 0;
  const months = years * 12;
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return principal / months;
  // Stable for very small rates and long terms; no subtracting nearly equal powers.
  return principal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
}

/** Round the annuity directly as an exact decimal ratio. Rounding a floating
 * quotient first can turn an exact half-cent into the wrong cent (including 0% loans).
 * Only the last rate/term factor is retained, so a budget search reuses its factor.
 */
let lastMortgageFactor: { rate: number; years: number; numerator: bigint; denominator: bigint } | undefined;
function mortgagePaymentCents(principalCents: number, annualRate: number, years: number): number {
  if (principalCents === 0) return 0;
  const months = BigInt(years * 12);
  if (annualRate === 0) return Number(roundedRatio(BigInt(principalCents), months));
  if (!lastMortgageFactor || lastMortgageFactor.rate !== annualRate || lastMortgageFactor.years !== years) {
    const [rateNumerator, annualDenominator] = decimalRatio(annualRate);
    const rateDenominator = annualDenominator * BigInt(1200);
    const growth = (rateDenominator + rateNumerator) ** months;
    const principalGrowth = rateDenominator ** months;
    lastMortgageFactor = { rate: annualRate, years,
      numerator: rateNumerator * growth,
      denominator: rateDenominator * (growth - principalGrowth) };
  }
  return Number(roundedRatio(BigInt(principalCents) * lastMortgageFactor.numerator, lastMortgageFactor.denominator));
}

export type BuyerCostInputs = {
  price: number; downPercent: number; rate: number; years: number;
  taxRate: number; insurance: number; flood: number; hoa: number; cdd: number; pmiRate: number;
};

export function validateBuyerCosts(input: BuyerCostInputs): void {
  finiteBetween(input.price, "Purchase price", 0.01, MAX_PLANNING_AMOUNT);
  for (const key of ["downPercent", "rate", "taxRate", "pmiRate"] as const) {
    finiteBetween(input[key], key, 0, 100);
  }
  finiteBetween(input.years, "Loan term", 1, MAX_LOAN_YEARS);
  if (!Number.isInteger(input.years)) throw new RangeError("Loan term must be a whole number of years.");
  for (const key of ["insurance", "flood", "hoa", "cdd"] as const) {
    finiteBetween(input[key], key, 0, MAX_PLANNING_AMOUNT);
  }
}

/** Fixed-rate conventional-loan illustration, not an FHA/VA/USDA quote.
 * PMI is a user-entered annual assumption applied to the initial loan below 20% down.
 * No automatic insurance cancellation, eligibility or future tax reassessment is modeled.
 */
export function buyerMonthlyCosts(input: BuyerCostInputs) {
  validateBuyerCosts(input);
  const price = moneyCents(input.price);
  const downPayment = percentOfMoney(input.price, input.downPercent);
  const loan = (price - moneyCents(downPayment)) / 100;
  const principalInterest = mortgagePaymentCents(price - moneyCents(downPayment), input.rate, input.years) / 100;
  const [taxNumerator, taxDenominator] = decimalRatio(input.taxRate);
  const taxes = Number(roundedRatio(BigInt(price) * taxNumerator, taxDenominator * BigInt(1200))) / 100;
  const [pmiNumerator, pmiDenominator] = decimalRatio(input.pmiRate);
  const pmi = input.downPercent < 20
    ? Number(roundedRatio(BigInt(moneyCents(loan)) * pmiNumerator, pmiDenominator * BigInt(1200))) / 100 : 0;
  const insurance = roundPlanningMoney(input.insurance), flood = roundPlanningMoney(input.flood);
  const hoa = roundPlanningMoney(input.hoa), cdd = roundPlanningMoney(input.cdd);
  const total = [principalInterest, taxes, pmi, insurance, flood, hoa, cdd]
    .reduce((sum, value) => sum + moneyCents(value), 0) / 100;
  return { downPayment, loan, principalInterest, taxes, pmi, insurance, flood, hoa, cdd, total };
}

export type AffordabilityInputs = Omit<BuyerCostInputs, "price"> & {
  income: number; monthlyDebt: number; cash: number; dti: number;
  housingPercent: number; closingCosts: number; closingCredits: number;
};

/** A bounded budget scenario, not loan underwriting.
 * Cash must cover the entered NET closing costs even when the down payment is zero.
 * Credits are assumed confirmed for allowable closing costs only, never the down payment.
 * A cash shortfall suppresses the purchase budget. This does not rule out other funding.
 */
export function affordabilityBudget(input: AffordabilityInputs) {
  validateBuyerCosts({ ...input, price: 1 });
  for (const key of ["income", "monthlyDebt", "cash", "closingCosts", "closingCredits"] as const) {
    finiteBetween(input[key], key, 0, MAX_PLANNING_AMOUNT);
  }
  finiteBetween(input.dti, "Debt-to-income assumption", 0, 100);
  finiteBetween(input.housingPercent, "Housing-income assumption", 0, 100);
  const grossClosingCents = moneyCents(input.closingCosts);
  const creditCents = moneyCents(input.closingCredits);
  if (creditCents > grossClosingCents) throw new RangeError("Closing credits cannot exceed the entered closing costs in this model.");
  const netClosingCents = grossClosingCents - creditCents;
  const cashCents = moneyCents(input.cash);
  const shortfall = Math.max(0, netClosingCents - cashCents) / 100;
  // Floor the exact decimal income-ratio budgets to cents; no floating epsilon.
  const budgetCents = (percent: number, debt: number): number => {
    const [incomeN, incomeD] = decimalRatio(input.income);
    const [percentN, percentD] = decimalRatio(percent);
    const [debtN, debtD] = decimalRatio(debt);
    const denominator = incomeD * percentD * BigInt(1200) * debtD;
    const numerator = incomeN * percentN * debtD - debtN * incomeD * percentD * BigInt(1200);
    return numerator <= BigInt(0) ? 0 : Number(numerator * BigInt(100) / denominator);
  };
  const housingBudgetCents = Math.min(budgetCents(input.housingPercent, 0), budgetCents(input.dti, input.monthlyDebt));
  const common = {
    maxHousing: housingBudgetCents / 100,
    netClosingCosts: netClosingCents / 100,
    cashForDownPayment: Math.max(0, cashCents - netClosingCents) / 100,
    cashShortfall: shortfall,
  };
  if (shortfall > 0) return { ...common, affordablePrice: null, projected: null, status: "cash-shortfall" as const };
  // Search in integer cents. The same rounded line items appear in the UI and report.
  // This also handles all-cash purchases and zero-interest loans without division by zero.
  let low = 0, high = MAX_PLANNING_AMOUNT * 100;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const costs = buyerMonthlyCosts({ ...input, price: mid / 100 });
    const affordable = moneyCents(costs.total) <= housingBudgetCents
      && moneyCents(costs.downPayment) + netClosingCents <= cashCents;
    if (affordable) low = mid; else high = mid - 1;
  }
  const affordablePrice = low / 100;
  return { ...common, affordablePrice,
    projected: low > 0 ? buyerMonthlyCosts({ ...input, price: affordablePrice }) : null,
    status: low === MAX_PLANNING_AMOUNT * 100 ? "model-limit" as const : "calculated" as const };
}

export function inputIssues(values: Record<string, string>, limits: Record<string, number> = {}) {
  const missing: string[] = [], invalid: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!raw.trim()) missing.push(key);
    else if (planningNumber(raw, limits[key] ?? MAX_PLANNING_AMOUNT) === null) invalid.push(key);
  }
  return { missing, invalid };
}
