export type BuyerPlanTool = "checklist" | "relocation" | "tour" | "loans";

export function buyerPlanTool(value: string | string[] | undefined): BuyerPlanTool {
  return typeof value === "string" && ["checklist", "relocation", "tour", "loans"].includes(value)
    ? value as BuyerPlanTool : "checklist";
}

export const CHECKLIST_ITEMS = [
  { id: "condition", label: "Condition and inspections", question: "What should a qualified inspector investigate, and which repairs need estimates?" },
  { id: "permits", label: "Permits and property records", question: "Do the records match the improvements and intended use? Ask the relevant local authority." },
  { id: "taxes", label: "Property taxes", question: "What could taxes be after the purchase? Confirm assumptions with the property appraiser." },
  { id: "insurance", label: "Home and flood insurance", question: "Obtain property-specific quotes, deductibles and coverage details before relying on an estimate." },
  { id: "title", label: "Title, survey and restrictions", question: "Which title, boundary, use or easement questions need the closing professional's review?" },
  { id: "financing", label: "Financing and cash to close", question: "Confirm loan terms, available funds and the lender's closing requirements." },
  { id: "association", label: "Association documents and fees", question: "Review applicable rules, financials, fees, approval requirements and restrictions." },
  { id: "reserves", label: "Condo reserves and inspections", question: "If applicable, request SIRS, milestone reports, the reserve plan and current financials." },
  { id: "assessments", label: "Assessments and borrowing", question: "Ask about approved or proposed assessments, association loans and payment dates." },
  { id: "timing", label: "Contract dates and next steps", question: "Confirm applicable contract deadlines with your broker and appropriate advisers." },
] as const;

export const CHECKLIST_STATES = ["Not reviewed", "Requested", "Received", "Questions remain", "Not applicable"] as const;
export type ChecklistState = typeof CHECKLIST_STATES[number];
export type ChecklistEntry = { status: ChecklistState; note: string };

const text = (value: string | undefined, fallback = "Not entered") => value?.trim() || fallback;
export const dollars = (value: number | null) => value === null ? "Not entered" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export function checklistReport(property: string, kind: string, entries: Record<string, ChecklistEntry>): string {
  return ["PROPERTY RESEARCH CHECKLIST", `Property: ${text(property)}`, `Property type: ${text(kind)}`,
    "A question list for your research, not an inspection, title opinion or compliance finding.", "",
    ...CHECKLIST_ITEMS.flatMap(item => [
      `${item.label}: ${entries[item.id]?.status ?? "Not reviewed"}`,
      item.question,
      `Notes / next action: ${text(entries[item.id]?.note)}`, "",
    ]), "Next step: ask Roque to help organize the outstanding questions and the appropriate professional follow-up.",
  ].join("\n");
}

export type RelocationPlan = { timing: string; visit: string; areaOne: string; areaTwo: string; budget: string; priorities: string; routes: string; questions: string };
export function relocationReport(plan: RelocationPlan): string {
  return ["RELOCATION RESEARCH PLAN", `Moving timeframe: ${text(plan.timing)}`, `Visit dates or virtual preference: ${text(plan.visit)}`,
    `Area 1 to research: ${text(plan.areaOne)}`, `Area 2 to research: ${text(plan.areaTwo)}`, `Planning budget: ${text(plan.budget)}`,
    `Property priorities: ${text(plan.priorities)}`, `Places / routes to test: ${text(plan.routes)}`, "",
    "BEFORE YOUR VISIT", "Confirm your budget assumptions and financing questions. Shortlist homes in the areas you selected. Ask Roque to confirm availability before making travel or showing arrangements.", "",
    `FIRST RESEARCH BLOCK: ${text(plan.areaOne, "Choose your first area")}`, "Compare property types, ownership costs and the routes you actually use. Record questions for the properties you visit.", "",
    `SECOND RESEARCH BLOCK: ${text(plan.areaTwo, "Choose your second area")}`, "Use the same priorities and cost assumptions. Leave time between visits and confirm appointments individually.", "",
    "AFTER YOUR VISIT", "Complete a tour scorecard for each home. Identify the records, quotes and professional advice needed before proceeding.",
    `Questions for Roque: ${text(plan.questions)}`, "This is a research outline. No showing, travel booking or appointment is confirmed.",
  ].join("\n");
}

export const TOUR_CRITERIA = ["Layout and usable space", "Observed condition", "Daily routes", "Outdoor space", "Confidence in ownership costs", "Fit with your priorities"] as const;
export function tourRatingSummary(ratings: Record<string, string>) {
  const values = TOUR_CRITERIA.map(key => Number(ratings[key])).filter(value => Number.isInteger(value) && value >= 1 && value <= 5);
  return { rated: values.length, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
}
export function tourReport(property: string, date: string, ratings: Record<string, string>, positives: string, questions: string, next: string): string {
  const rating = tourRatingSummary(ratings);
  return ["AFTER-TOUR SCORECARD", `Property: ${text(property)}`, `Tour date: ${text(date)}`,
    "Personal impressions only. A tour does not replace inspections, document review or professional advice.", "",
    ...TOUR_CRITERIA.map(key => `${key}: ${ratings[key] && /^[1-5]$/.test(ratings[key]) ? `${ratings[key]} / 5` : "Not rated"}`),
    `Rated criteria: ${rating.rated} of ${TOUR_CRITERIA.length}${rating.average === null ? "" : `; personal average ${rating.average.toFixed(1)} / 5`}`,
    `What worked: ${text(positives)}`, `Questions / concerns: ${text(questions)}`, `Your next step: ${text(next)}`,
    "An unrated item is unknown, not a zero. Scores do not establish a property's condition or recommend a purchase.",
  ].join("\n");
}

export const LOAN_FIELDS = [
  ["purchasePrice", "Purchase price", "dollars"], ["loanAmount", "Loan amount", "dollars"], ["downPayment", "Down payment", "dollars"],
  ["termYears", "Loan term in years", "number"], ["rate", "Interest rate (%)", "percent"], ["apr", "APR (%)", "percent"],
  ["monthlyPI", "Monthly principal and interest", "dollars"], ["monthlyMI", "Monthly mortgage insurance", "dollars"], ["monthlyEscrow", "Monthly estimated escrow", "dollars"],
  ["originationA", "Section A: origination charges", "dollars"], ["servicesB", "Section B: services you cannot shop for", "dollars"],
  ["otherLoanCostsC", "Section C: services you can shop for", "dollars"], ["lenderCredits", "Lender credits (enter a positive amount)", "dollars"],
  ["governmentFees", "Section E: taxes and government fees", "dollars"], ["prepaids", "Section F: prepaids", "dollars"], ["initialEscrow", "Section G: initial escrow at closing", "dollars"],
  ["cashToClose", "Estimated cash to close", "dollars"], ["fiveYearTotal", "Page 3: total paid in 5 years", "dollars"], ["fiveYearPrincipal", "Page 3: principal paid in 5 years", "dollars"],
] as const;
export type LoanNumberKey = typeof LOAN_FIELDS[number][0];
export type LoanEstimate = Record<LoanNumberKey, string> & { lender: string; estimateDate: string; product: string; locked: string; notes: string };
export function emptyLoanEstimate(): LoanEstimate {
  return Object.fromEntries([...LOAN_FIELDS.map(([key]) => [key, ""]), ...["lender", "estimateDate", "product", "locked", "notes"].map(key => [key, ""])]) as LoanEstimate;
}

// Blank values stay unknown. Do not turn missing lender figures into a $0 offer.
export function loanNumber(value: string, signed = false): number | null {
  if (!value.trim() || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && (signed || number >= 0) && Math.abs(number) <= 1e10 ? number : null;
}
export function loanMetrics(loan: LoanEstimate) {
  const read = (key: LoanNumberKey) => loanNumber(loan[key], key === "cashToClose");
  const a = read("originationA"), b = read("servicesB"), credits = read("lenderCredits");
  const total5 = read("fiveYearTotal"), principal5 = read("fiveYearPrincipal");
  const pi = read("monthlyPI"), mi = read("monthlyMI"), escrow = read("monthlyEscrow");
  const invalidFields = LOAN_FIELDS.filter(([key, , kind]) => loan[key].trim() && (read(key) === null || ((key === "purchasePrice" || key === "loanAmount" || key === "termYears") && read(key) === 0) || ((kind === "percent" || key === "termYears") && (read(key) ?? 0) > 100))).map(([, label]) => label);
  return {
    lenderCosts: a !== null && b !== null && credits !== null ? a + b - credits : null,
    fiveYearCost: total5 !== null && principal5 !== null && principal5 <= total5 ? total5 - principal5 : null,
    fiveYearError: total5 !== null && principal5 !== null && principal5 > total5,
    monthlyTotal: pi !== null && mi !== null && escrow !== null ? pi + mi + escrow : null,
    invalidFields,
  };
}
export function loanComparisonNotes(loans: LoanEstimate[]): string[] {
  if (loans.length < 2) return ["Enter another Loan Estimate to compare assumptions."];
  const notes: string[] = [];
  for (const [key, label] of [["purchasePrice", "Purchase prices"], ["loanAmount", "Loan amounts"], ["downPayment", "Down payments"], ["termYears", "Loan terms"]] as const) {
    const values = loans.map(loan => { const value = loanNumber(loan[key]); return key !== "downPayment" && value === 0 ? null : value; });
    if (values.some(value => value === null)) notes.push(`${label}: missing or invalid in at least one estimate.`);
    else if (new Set(values).size > 1) notes.push(`${label} differ. Ask lenders for comparable scenarios.`);
  }
  if (loans.some(loan => !loan.product.trim())) notes.push("Add each loan's product and fixed/adjustable structure.");
  else if (new Set(loans.map(loan => loan.product.trim().toLowerCase())).size > 1) notes.push("Loan products differ; payment and risk comparisons need extra care.");
  if (loans.some(loan => !loan.estimateDate)) notes.push("Add the date of each Loan Estimate.");
  else if (new Set(loans.map(loan => loan.estimateDate)).size > 1) notes.push("Estimate dates differ; rate-market changes can affect the comparison.");
  return notes.length ? notes : ["Entered price, loan amount, down payment, term, product and dates match. Confirm the remaining terms with each lender."];
}
export function loansReport(property: string, loans: LoanEstimate[]): string {
  return ["LOAN ESTIMATE COMPARISON", `Property: ${text(property)}`, "Manually entered figures, not a loan offer, approval or lender recommendation. Blank fields are unknown; enter 0 only when the estimate actually shows none.", "",
    ...loans.slice(0, 3).flatMap((loan, index) => {
      const metrics = loanMetrics(loan);
      return [`LENDER ${index + 1}: ${text(loan.lender)}`, `Estimate date: ${text(loan.estimateDate)}`, `Product / fixed or adjustable: ${text(loan.product)}`, `Rate lock: ${text(loan.locked)}`,
        ...LOAN_FIELDS.map(([key, label, kind]) => {
          const value = loanNumber(loan[key], key === "cashToClose");
          return `${label}: ${value === null ? text(loan[key], "Not entered") + (loan[key] ? " (check entry)" : "") : kind === "dollars" ? dollars(value) : `${value}${kind === "percent" ? "%" : ""}`}`;
        }),
        `A + B less lender credits: ${dollars(metrics.lenderCosts)} (not total closing costs)`,
        `Monthly P&I + mortgage insurance + escrow: ${dollars(metrics.monthlyTotal)} (not all ownership costs)`,
        `Five-year interest and fees: ${metrics.fiveYearError ? "Check the two page 3 figures" : dollars(metrics.fiveYearCost)}`,
        ...(metrics.invalidFields.length ? [`Check these entries: ${metrics.invalidFields.join(", ")}`] : []),
        `Questions: ${text(loan.notes)}`, ""];
    }), "COMPARABILITY CHECK", ...loanComparisonNotes(loans.slice(0, 3)), "",
    "Separate lender charges from taxes, prepaids and escrow estimates. Lower escrow does not establish a better loan. For adjustable-rate loans, the five-year illustration may change if the rate changes.",
    "Source: https://www.consumerfinance.gov/owning-a-home/compare/compare-loan-estimates/",
  ].join("\n");
}

export type CostScenario = { property: string; price: number; downPercent: number; rate: number; years: number; taxRate: number; insurance: number; flood: number; hoa: number; cdd: number; pmiRate: number };
export type ComparisonReportHome = { address: string; price: string; beds: string; baths: string; sqft: string; hoa: string; yearBuilt: string; notes: string };
export function monthlyPlanningCost(cost: CostScenario) {
  const loan = Math.max(0, cost.price * (1 - cost.downPercent / 100));
  const months = cost.years * 12, rate = cost.rate / 1200;
  const factor = Math.expm1(months * Math.log1p(rate));
  const principalInterest = loan <= 0 || months <= 0 ? 0 : rate === 0 ? loan / months : loan * rate * (1 + 1 / factor);
  const taxes = cost.price * cost.taxRate / 1200;
  const pmi = cost.downPercent < 20 ? loan * cost.pmiRate / 1200 : 0;
  return { loan, principalInterest, taxes, pmi, total: principalInterest + taxes + pmi + cost.insurance + cost.flood + cost.hoa + cost.cdd };
}
export function buyerScenarioReport(tool: "cost" | "affordability" | "compare", cost: CostScenario, affordability: { income: number; monthlyDebt: number; cash: number; dti: number; affordablePrice: number }, homes: ComparisonReportHome[]): string {
  const assumptions = [`Property: ${text(cost.property)}`, `Purchase price: ${dollars(cost.price)}`, `Down payment: ${cost.downPercent}% (${dollars(cost.price * cost.downPercent / 100)})`, `Interest rate assumption: ${cost.rate}%`, `Term: ${cost.years} years`, `Annual property-tax assumption: ${cost.taxRate}% of purchase price`, `Home insurance / month: ${dollars(cost.insurance)}`, `Flood insurance / month: ${dollars(cost.flood)}`, `HOA / condo / month: ${dollars(cost.hoa)}`, `CDD / other assessments / month: ${dollars(cost.cdd)}`, `Annual PMI assumption: ${cost.pmiRate}% of loan when down payment is below 20%`];
  const propertyDetails = homes.filter(home => [home.address, home.price, home.beds, home.baths, home.sqft, home.hoa, home.yearBuilt, home.notes].some(value => value.trim())).flatMap((home, index) => [`HOME ${index + 1}: ${text(home.address)}`, ...[["Price", home.price], ["Bedrooms", home.beds], ["Bathrooms", home.baths], ["Living area (sq ft)", home.sqft], ["HOA / month", home.hoa], ["Year built", home.yearBuilt], ["Notes", home.notes]].map(([label, value]) => `${label}: ${text(value)}`), ""]);
  const monthly = monthlyPlanningCost(cost);
  return ["BUYER PLANNING WORKSHEET", `Selected tool: ${tool}`, "Editable planning assumptions, not current loan or insurance quotes. Verify property facts and all costs. This is not a financing approval.", "",
    ...(tool === "compare" ? propertyDetails.length ? propertyDetails : ["No comparison properties entered."] : assumptions),
    ...(tool === "cost" ? ["", `Estimated loan amount: ${dollars(monthly.loan)}`, `Estimated monthly principal and interest: ${dollars(monthly.principalInterest)}`, `Estimated monthly property taxes: ${dollars(monthly.taxes)}`, `Estimated monthly PMI: ${dollars(monthly.pmi)}`, `Estimated total monthly ownership cost: ${dollars(monthly.total)}`] : []),
    ...(tool === "affordability" ? ["", `Annual income entered: ${dollars(affordability.income)}`, `Other monthly debt: ${dollars(affordability.monthlyDebt)}`, `Available cash: ${dollars(affordability.cash)}`, `Debt-to-income assumption: ${affordability.dti}%`, "Model also limits housing to 28% of gross income and reserves $18,000 of cash for illustrative closing expenses; actual requirements can differ.", `Calculated planning price: ${dollars(affordability.affordablePrice)}`] : []),
    "", "Next step: review the assumptions and open questions with Roque and the relevant lender, insurer or association.",
  ].join("\n");
}
