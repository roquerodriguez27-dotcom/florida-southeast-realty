"use client";

import { useState } from "react";
import Link from "next/link";
import PlanHandoff from "@/components/planning/PlanHandoff";
import ReportActions from "@/components/planning/ReportActions";
import {
  CHECKLIST_ITEMS, CHECKLIST_STATES, TOUR_CRITERIA, LOAN_FIELDS,
  checklistReport, relocationReport, tourReport, loansReport, emptyLoanEstimate,
  loanMetrics, loanComparisonNotes, loanNumber, dollars, tourRatingSummary,
  type BuyerPlanTool, type ChecklistEntry, type ChecklistState, type RelocationPlan, type LoanEstimate,
} from "@/lib/planning/buyer";

const fieldClass = "w-full min-w-0 rounded-sm border border-ink/20 bg-white px-3 py-2.5 text-ink outline-none focus:border-tide focus:ring-2 focus:ring-tide/20";
const buttonClass = "rounded-sm border border-tide/30 px-4 py-2.5 text-sm font-medium text-tide hover:bg-tide/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tide";
const tabs: { id: BuyerPlanTool; label: string; formName: string }[] = [
  { id: "checklist", label: "Property checklist", formName: "planning-buyer-checklist" },
  { id: "relocation", label: "Relocation visit", formName: "planning-buyer-relocation" },
  { id: "tour", label: "After a tour", formName: "planning-buyer-tour" },
  { id: "loans", label: "Loan Estimates", formName: "planning-buyer-loans" },
];

function Field({ label, value, onChange, multiline = false, type = "text", hint, maxLength = 300 }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string; hint?: string; maxLength?: number }) {
  return <label className="block min-w-0">
    <span className="block text-sm font-medium mb-1.5">{label}</span>
    {multiline ? <textarea className={fieldClass} rows={3} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} />
      : <input className={fieldClass} type={type} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} />}
    {hint && <span className="block text-xs text-ink/60 mt-1.5">{hint}</span>}
  </label>;
}

function LoanCard({ loan, index, onChange, onRemove }: { loan: LoanEstimate; index: number; onChange: (key: keyof LoanEstimate, value: string) => void; onRemove?: () => void }) {
  const metrics = loanMetrics(loan);
  return <fieldset className="rounded-sm border border-ink/15 bg-white p-5">
    <legend className="font-medium px-2">Lender {index + 1}</legend>
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Lender name or your label" value={loan.lender} onChange={value => onChange("lender", value)} maxLength={100} />
      <Field label="Loan Estimate date" type="date" value={loan.estimateDate} onChange={value => onChange("estimateDate", value)} />
      <Field label="Product and fixed / adjustable" value={loan.product} onChange={value => onChange("product", value)} hint="For example, the product description printed on your estimate." maxLength={100} />
      <label className="block"><span className="block text-sm font-medium mb-1.5">Rate lock</span><select className={fieldClass} value={loan.locked} onChange={event => onChange("locked", event.target.value)}><option value="">Not entered</option><option>Locked</option><option>Not locked</option><option>Ask lender</option></select></label>
    </div>
    <div className="grid sm:grid-cols-2 gap-4 mt-4">
      {LOAN_FIELDS.slice(0, 9).map(([key, label]) => <label key={key} className="block"><span className="block text-sm font-medium mb-1.5">{label}</span><input className={fieldClass} type="number" step="any" min="0" value={loan[key]} onChange={event => onChange(key, event.target.value)} placeholder="Not entered" /></label>)}
    </div>
    <details className="mt-5 rounded-sm bg-keystone p-4" open>
      <summary className="cursor-pointer font-medium text-tide">Closing costs and page 3 comparison</summary>
      <p className="text-xs text-ink/65 mt-2">Copy amounts from the same Loan Estimate. Leave unknown figures blank; enter 0 only when the estimate shows none. Credits are positive amounts.</p>
      <div className="grid sm:grid-cols-2 gap-4 mt-4">{LOAN_FIELDS.slice(9).map(([key, label]) => <label key={key} className="block"><span className="block text-sm font-medium mb-1.5">{label}</span><input className={fieldClass} type="number" step="any" min={key === "cashToClose" ? undefined : "0"} value={loan[key]} onChange={event => onChange(key, event.target.value)} placeholder="Not entered" /></label>)}</div>
    </details>
    <div className="mt-4"><Field label="Questions for this lender" value={loan.notes} onChange={value => onChange("notes", value)} multiline maxLength={500} /></div>
    {metrics.invalidFields.length > 0 && <p role="status" className="mt-3 text-sm text-hibiscus">Check these entries: {metrics.invalidFields.join(", ")}. Price, loan amount and term must be positive; rates cannot exceed 100%, and terms cannot exceed 100 years.</p>}
    {metrics.fiveYearError && <p role="status" className="mt-3 text-sm text-hibiscus">The page 3 principal paid cannot exceed the total paid. Check both entries.</p>}
    <dl className="mt-5 border-t border-ink/10 pt-4 text-sm space-y-3">
      <div><dt className="text-ink/65">A + B less lender credits</dt><dd className="font-medium">{dollars(metrics.lenderCosts)} <span className="font-normal text-xs">(not total closing costs)</span></dd></div>
      <div><dt className="text-ink/65">Monthly P&amp;I + mortgage insurance + escrow</dt><dd className="font-medium">{dollars(metrics.monthlyTotal)} <span className="font-normal text-xs">(other ownership costs may apply)</span></dd></div>
      <div><dt className="text-ink/65">Five-year interest and fees</dt><dd className="font-medium">{metrics.fiveYearError ? "Check page 3 entries" : dollars(metrics.fiveYearCost)}</dd></div>
    </dl>
    {onRemove && <button type="button" className={`${buttonClass} mt-5`} onClick={onRemove}>Remove lender {index + 1}</button>}
  </fieldset>;
}

export default function BuyerPlanning({ initialTool = "checklist" }: { initialTool?: BuyerPlanTool }) {
  const [tool, setTool] = useState<BuyerPlanTool>(initialTool);
  const [property, setProperty] = useState("");
  const [kind, setKind] = useState("");
  const [entries, setEntries] = useState<Record<string, ChecklistEntry>>({});
  const [relocation, setRelocation] = useState<RelocationPlan>({ timing: "", visit: "", areaOne: "", areaTwo: "", budget: "", priorities: "", routes: "", questions: "" });
  const [tourDate, setTourDate] = useState("");
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [positives, setPositives] = useState("");
  const [questions, setQuestions] = useState("");
  const [next, setNext] = useState("");
  const [loans, setLoans] = useState<LoanEstimate[]>(() => [emptyLoanEstimate()]);
  const current = tabs.find(tab => tab.id === tool)!;
  const report = tool === "checklist" ? checklistReport(property, kind, entries)
    : tool === "relocation" ? relocationReport(relocation)
      : tool === "tour" ? tourReport(property, tourDate, ratings, positives, questions, next) : loansReport(property, loans);
  const rating = tourRatingSummary(ratings);

  function updateEntry(id: string, update: Partial<ChecklistEntry>) {
    setEntries(previous => ({ ...previous, [id]: { status: previous[id]?.status ?? "Not reviewed", note: previous[id]?.note ?? "", ...update } }));
  }

  return <div>
    <nav aria-label="Buyer planning tools" className="flex flex-wrap gap-2 mb-8">{tabs.map(tab => <button key={tab.id} type="button" onClick={() => setTool(tab.id)} aria-pressed={tool === tab.id} className={`${buttonClass} ${tool === tab.id ? "!bg-tide !text-sand" : "bg-white"}`}>{tab.label}</button>)}</nav>
    <section aria-labelledby="buyer-plan-heading" className="rounded-sm border border-ink/15 bg-keystone p-5 md:p-8">
      <h2 id="buyer-plan-heading" className="font-display text-3xl">{current.label}</h2>
      {tool !== "relocation" && <div className="mt-5 max-w-xl"><Field label="Property address or your reference" value={property} onChange={setProperty} maxLength={180} hint="Enter the property you are researching. This is not added to the page URL." /></div>}

      {tool === "checklist" && <div className="mt-6">
        <p className="text-sm text-ink/65 max-w-3xl">Use the same questions for each home. Mark records received separately from questions resolved. This checklist does not determine safety, eligibility or legal compliance.</p>
        <label className="block max-w-sm mt-5"><span className="block text-sm font-medium mb-1.5">Property type</span><select className={fieldClass} value={kind} onChange={event => setKind(event.target.value)}><option value="">Not entered</option><option>Single-family home</option><option>Condominium</option><option>Townhouse</option><option>Other / confirm</option></select></label>
        <div className="grid lg:grid-cols-2 gap-4 mt-6">{CHECKLIST_ITEMS.map(item => <fieldset key={item.id} className="bg-white rounded-sm border border-ink/10 p-4 min-w-0"><legend className="font-medium px-1">{item.label}</legend><p className="text-sm text-ink/65 mb-3">{item.question}</p><label className="block"><span className="text-xs font-medium">Status</span><select className={`${fieldClass} mt-1`} value={entries[item.id]?.status ?? "Not reviewed"} onChange={event => updateEntry(item.id, { status: event.target.value as ChecklistState })}>{CHECKLIST_STATES.map(status => <option key={status}>{status}</option>)}</select></label><div className="mt-3"><Field label="Notes or next action" value={entries[item.id]?.note ?? ""} onChange={note => updateEntry(item.id, { note })} maxLength={400} multiline /></div></fieldset>)}</div>
        <p className="mt-5 text-sm"><Link href="/research/homeowner-updates" className="text-tide underline">Read the current homeowner updates</Link> for sourced condo, tax and insurance context.</p>
      </div>}

      {tool === "relocation" && <div className="mt-5">
        <p className="text-sm text-ink/65 max-w-3xl">Choose the areas and everyday needs you want to compare. The report organizes a research visit or virtual planning conversation; it does not book showings.</p>
        <div className="grid md:grid-cols-2 gap-5 mt-6">
          {([["timing", "Moving timeframe"], ["visit", "Visit dates or virtual preference"], ["areaOne", "First area to research"], ["areaTwo", "Second area to research"], ["budget", "Planning budget or price range"], ["routes", "Places and routes to test"]] as const).map(([key, label]) => <Field key={key} label={label} value={relocation[key]} onChange={value => setRelocation(previous => ({ ...previous, [key]: value }))} />)}
          <Field label="Property priorities" value={relocation.priorities} onChange={value => setRelocation(previous => ({ ...previous, priorities: value }))} multiline maxLength={600} />
          <Field label="Questions for Roque" value={relocation.questions} onChange={value => setRelocation(previous => ({ ...previous, questions: value }))} multiline maxLength={600} />
        </div>
        <p className="mt-5 text-sm"><Link href="/guides/moving-from-new-york-new-jersey-to-palm-beach-county" className="text-tide underline">Read the relocation guide</Link> or <Link href="/communities" className="text-tide underline">explore the community guides</Link>.</p>
      </div>}

      {tool === "tour" && <div className="mt-5">
        <p className="text-sm text-ink/65">Capture your impressions while they are fresh. Leave an item unrated when you do not know. A high score does not replace inspections or records.</p>
        <div className="max-w-sm mt-5"><Field label="Tour date" type="date" value={tourDate} onChange={setTourDate} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">{TOUR_CRITERIA.map(label => <label key={label} className="block"><span className="block text-sm font-medium mb-1.5">{label}</span><select className={fieldClass} value={ratings[label] ?? ""} onChange={event => setRatings(previous => ({ ...previous, [label]: event.target.value }))}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5{value === 1 ? " - Poor fit" : value === 5 ? " - Strong fit" : ""}</option>)}</select></label>)}</div>
        <p className="mt-4 text-sm text-ink/65">{rating.rated} of {TOUR_CRITERIA.length} criteria rated{rating.average === null ? "." : `; your average is ${rating.average.toFixed(1)} / 5.`}</p>
        <div className="grid md:grid-cols-2 gap-5 mt-5"><Field label="What worked for you?" value={positives} onChange={setPositives} multiline maxLength={600} /><Field label="Questions or concerns to investigate" value={questions} onChange={setQuestions} multiline maxLength={600} /></div>
        <div className="mt-5"><Field label="What would you like to do next?" value={next} onChange={setNext} hint="For example, request documents, ask a question or arrange another visit." /></div>
      </div>}

      {tool === "loans" && <div className="mt-5">
        <p className="text-sm text-ink/65 max-w-3xl">Copy figures from up to three Loan Estimates. Compare the same purchase price, loan amount, down payment and loan type. No rates are supplied and no lender is ranked.</p>
        <p className="mt-3 text-sm text-ink/65 max-w-3xl">Keep lender charges separate from taxes, prepaids and escrow. Lower escrow does not make a loan cheaper. Page 3 total paid minus principal paid gives the five-year interest and fees illustration; adjustable rates can change that outcome.</p>
        <p className="mt-3 text-sm"><a href="https://www.consumerfinance.gov/owning-a-home/compare/compare-loan-estimates/" target="_blank" rel="noreferrer" className="text-tide underline">CFPB guidance on comparing Loan Estimates</a></p>
        <div className="space-y-6 mt-6">{loans.map((loan, index) => <LoanCard key={index} loan={loan} index={index} onChange={(key, value) => setLoans(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))} onRemove={loans.length > 1 ? () => setLoans(previous => previous.filter((_, itemIndex) => itemIndex !== index)) : undefined} />)}</div>
        {loans.length < 3 && <button type="button" className={`${buttonClass} bg-white mt-5`} onClick={() => setLoans(previous => [...previous, emptyLoanEstimate()])}>Add lender {loans.length + 1}</button>}
        {loans.length > 1 && <div className="mt-6 overflow-x-auto rounded-sm border border-ink/15 bg-white" tabIndex={0} aria-label="Loan Estimate comparison table"><table className="w-full min-w-[36rem] text-sm"><caption className="p-4 text-left font-medium text-tide">Compare your entered figures side by side</caption><thead><tr className="bg-tide text-sand"><th scope="col" className="p-3 text-left">Figure</th>{loans.map((loan, index) => <th key={index} scope="col" className="p-3 text-left">{loan.lender.trim() || `Lender ${index + 1}`}</th>)}</tr></thead><tbody className="divide-y divide-ink/10">{LOAN_FIELDS.map(([key, label, kind]) => <tr key={key}><th scope="row" className="p-3 text-left font-medium">{label}</th>{loans.map((loan, index) => { const value = loanNumber(loan[key], key === "cashToClose"); return <td key={index} className="p-3 align-top">{value === null ? loan[key] ? "Check entry" : "Not entered" : kind === "dollars" ? dollars(value) : `${value}${kind === "percent" ? "%" : ""}`}</td>; })}</tr>)}</tbody></table></div>}
        <div className="mt-6 rounded-sm border border-tide/20 bg-white p-5"><h3 className="font-medium">Check that the estimates are comparable</h3><ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-ink/70">{loanComparisonNotes(loans).map(note => <li key={note}>{note}</li>)}</ul><p className="mt-3 text-xs text-ink/60">This comparison is not a credit decision or a recommendation. Ask each lender to explain its terms and closing requirements.</p></div>
      </div>}
    </section>

    <section className="mt-8 rounded-sm border border-ink/15 bg-white p-5 md:p-8" aria-labelledby="buyer-report-heading">
      <h2 id="buyer-report-heading" className="font-display text-2xl">Your {current.label.toLowerCase()} report</h2>
      <p className="mt-2 text-sm text-ink/65">Review the report before exporting or sending. It includes the entries shown above.</p>
      <div className="mt-4"><ReportActions title={`FSR ${current.label}`} report={report} /></div>
      <pre className="mt-5 whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto rounded-sm bg-keystone p-4 text-sm font-sans leading-relaxed" tabIndex={0} aria-label="Your editable-plan report preview">{report}</pre>
    </section>
    <div className="mt-8"><PlanHandoff key={tool} formName={current.formName} title="Ask Roque to review your plan" summary={report} successMessage="Your plan has been saved for Roque to review. He will follow up using the contact details you provide." /></div>
  </div>;
}
