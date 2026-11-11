"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import PlanHandoff from "@/components/planning/PlanHandoff";
import ReportActions from "@/components/planning/ReportActions";
import {
  SELLER_TOOLS, SELLER_COST_FIELDS, newSellerCosts, readSellerCosts,
  calculateSellerProceeds, sellerNumber, sellerMoney, sellerAmountText,
  sellerDate, sellerDaysBetween, sellerTimingPlan, newSellerOffer,
  buildSellerProceedsReport, buildSellerTimingReport, buildSellerOfferReport,
  type SellerTool, type SellerCostForm, type SellerTimingDraft, type SellerOfferDraft,
} from "@/lib/planning/seller";

const inputClass = "mt-1.5 w-full rounded-sm border border-tide/20 bg-white px-3 py-2.5 text-base text-ink outline-none focus:border-tide md:text-sm";

function Field({ label, value, onChange, type = "text", suffix, maxLength = 160, max, step = "0.01", help }: {
  label: string; value: string; onChange: (value: string) => void;
  type?: "text" | "number" | "date"; suffix?: string; maxLength?: number; max?: number; step?: string; help?: string;
}) {
  return <label className="block min-w-0"><span className="text-sm font-medium text-ink">{label}{suffix ? <span className="ml-1 font-normal text-ink/55">({suffix})</span> : null}</span>
    <input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} min={type === "number" ? 0 : undefined} max={max} step={type === "number" ? step : undefined} inputMode={type === "number" ? "decimal" : undefined} placeholder={type === "number" ? "Not entered" : undefined} />
    {help ? <span className="mt-1.5 block text-xs leading-relaxed text-ink/60">{help}</span> : null}
  </label>;
}

function Notes({ label, value, onChange, maxLength = 300, placeholder }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; placeholder?: string }) {
  return <label className="block"><span className="text-sm font-medium text-ink">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} rows={3} placeholder={placeholder} className={`${inputClass} resize-y`} /><span className="mt-1 block text-right text-[11px] text-ink/50">{value.length}/{maxLength}</span></label>;
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return <label className="block"><span className="text-sm font-medium text-ink">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ToolIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="mb-7 max-w-3xl"><p className="font-mono text-xs uppercase tracking-[0.16em] text-hibiscus">{eyebrow}</p><h2 className="mt-2 font-display text-3xl leading-tight text-tide md:text-4xl">{title}</h2><p className="mt-4 text-base leading-relaxed text-ink/70">{children}</p></div>;
}

function Errors({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <div role="alert" className="my-5 rounded-sm border border-hibiscus/25 bg-hibiscus/5 p-4"><p className="text-sm font-medium text-hibiscus">Check these entries</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/75">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function WorksheetReport({ title, report, formName, ready, hint }: { title: string; report: string; formName: string; ready: boolean; hint: string }) {
  return <div className="mt-8 rounded-sm border border-tide/15 bg-white p-5 md:p-7">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-2xl text-tide">Your worksheet</h3><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Entered information only</span></div>
    <details className="mt-4 rounded-sm bg-keystone/45 p-4"><summary className="cursor-pointer text-sm font-medium text-tide">Read the complete report</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink/75">{report}</pre></details>
    {ready ? <><ReportActions title={title} report={report} /><PlanHandoff formName={formName} title="Review this worksheet with Roque" summary={report} /></> : <p role="status" className="mt-4 text-sm leading-relaxed text-ink/65">{hint}</p>}
  </div>;
}

function CostFields({ costs, onChange, offers = false }: { costs: SellerCostForm; onChange: (next: SellerCostForm) => void; offers?: boolean }) {
  return <div className="space-y-6">
    <div className="grid gap-5 sm:grid-cols-2">
      {(["listing", "buyer"] as const).map((side) => {
        const modeKey = side === "listing" ? "listingFeeMode" : "buyerFeeMode";
        const amountKey = side === "listing" ? "listingFee" : "buyerFee";
        const label = side === "listing" ? "Listing-side brokerage fee" : "Separately authorized buyer-broker compensation";
        return <fieldset key={side} className="rounded-sm border border-ink/10 p-4"><legend className="px-1 text-sm font-medium text-tide">{label}</legend>
          <label className="block text-xs text-ink/60">Fee basis<select value={costs[modeKey]} onChange={(event) => onChange({ ...costs, [modeKey]: event.target.value })} className={inputClass}><option value="percent">Percentage of sale price</option><option value="flat">Fixed dollar amount</option></select></label>
          <div className="mt-3"><Field label={side === "listing" ? "Listing fee" : "Buyer-broker compensation"} type="number" suffix={costs[modeKey] === "percent" ? "%" : "$"} max={costs[modeKey] === "percent" ? 100 : 1_000_000_000} value={costs[amountKey]} onChange={(value) => onChange({ ...costs, [amountKey]: value })} /></div>
        </fieldset>;
      })}
    </div>
    <p className="text-xs leading-relaxed text-ink/60">The editable 0.5% starting listing fee reflects our advertised listing-side service. Commission rates are negotiable and confirmed in the listing agreement. Separately authorized buyer-broker compensation and other costs are additional. <Link href="/sellers" className="text-tide underline underline-offset-4">See the selling plan.</Link></p>
    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {SELLER_COST_FIELDS.filter((field) => !offers || field.key !== "sellerConcessions").map((field) => <Field key={field.key} label={field.label} type="number" suffix="$" value={costs[field.key]} onChange={(value) => onChange({ ...costs, [field.key]: value })} help={field.key === "taxReserve" ? "Your own reserve amount; this tool does not calculate income or capital-gains tax." : field.key === "mortgagePayoff" ? "Use a current payoff estimate, including applicable lender charges." : undefined} />)}
    </div>
    <p className="rounded-sm border-l-2 border-brass bg-brass/10 px-4 py-3 text-sm leading-relaxed text-ink/75">Blank amounts are excluded from the calculation, not confirmed to be zero. Enter 0 where no amount applies. Use each cost once; for example, do not enter the same assessment under both HOA costs and other costs.</p>
  </div>;
}

function ProceedsTool({ costs, setCosts }: { costs: SellerCostForm; setCosts: (costs: SellerCostForm) => void }) {
  const [property, setProperty] = useState("");
  const [prices, setPrices] = useState(["", "", ""]);
  const [notes, setNotes] = useState("");
  const read = readSellerCosts(costs);
  const priceErrors = prices.flatMap((raw, index) => raw && (sellerNumber(raw) === null || sellerNumber(raw) === 0) ? [`Scenario ${index + 1}: enter a positive sale price.`] : []);
  const errors = [...read.errors, ...priceErrors];
  const report = buildSellerProceedsReport(prices, costs, property, notes);
  const ready = prices.some((raw) => (sellerNumber(raw) ?? 0) > 0) && errors.length === 0;
  return <>
    <ToolIntro eyebrow="Seller proceeds" title="See what three sale prices could mean.">Wondering what you might take home after selling? Enter up to three possible sale prices, your mortgage payoff and the costs you know. Blank costs are not counted, so this is only an estimate. You can reuse these costs when comparing offers.</ToolIntro>
    <div className="rounded-sm border border-ink/10 bg-white p-5 md:p-7">
      <Field label="Property address or private label (optional)" value={property} onChange={setProperty} />
      <div className="mt-5 grid gap-4 sm:grid-cols-3">{prices.map((price, index) => <Field key={index} label={`Scenario ${index + 1} sale price`} type="number" suffix="$" value={price} onChange={(value) => setPrices(prices.map((existing, position) => position === index ? value : existing))} />)}</div>
      <h3 className="mb-4 mt-8 font-display text-2xl text-tide">Fees, payoffs, taxes and credits</h3>
      <CostFields costs={costs} onChange={setCosts} />
      <div className="mt-6"><Notes label="Cost assumptions or questions" value={notes} onChange={setNotes} maxLength={300} placeholder="For example, which payoff or closing-cost figures still need confirmation?" /></div>
    </div>
    <Errors items={errors} />
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {prices.map((raw, index) => {
        const price = sellerNumber(raw);
        const result = price && read.errors.length === 0 ? calculateSellerProceeds(price, read.costs) : null;
        return <section key={index} className="rounded-sm bg-tide p-5 text-sand"><h3 className="font-mono text-xs uppercase tracking-[0.15em] text-brass">Scenario {index + 1}</h3>
          <p className="mt-2 font-display text-2xl">{price ? sellerMoney(price) : "Enter a sale price"}</p>
          {result ? <><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-sand/65">Entered deductions</dt><dd>{sellerMoney(result.charges)}</dd></div><div className="flex justify-between gap-3"><dt className="text-sand/65">Credits to seller</dt><dd>{sellerMoney(result.credits)}</dd></div><div className="border-t border-sand/20 pt-3"><dt className="text-sand/70">{read.missing.length ? "Proceeds before unentered items" : "Estimated net at closing"}</dt><dd className="mt-1 font-display text-3xl">{sellerMoney(result.netAtClosing)}</dd></div><div className="flex justify-between gap-3"><dt className="text-sand/65">After entered tax reserve</dt><dd>{sellerMoney(result.afterTaxReserve)}</dd></div></dl>{result.netAtClosing < 0 ? <p className="mt-4 text-xs text-sand/80">Entered deductions exceed the sale price and credits. Review the additional funds that may be needed.</p> : null}</> : <p className="mt-4 text-sm text-sand/65">Your calculation will appear after a positive price and valid cost amounts are entered.</p>}
        </section>;
      })}
    </div>
    {read.missing.length ? <details className="mt-5 rounded-sm border border-brass/30 bg-brass/5 p-4"><summary className="cursor-pointer text-sm font-medium text-tide">{read.missing.length} cost or credit inputs are still unentered</summary><ul className="mt-3 grid list-disc gap-x-8 gap-y-1 pl-5 text-xs text-ink/70 sm:grid-cols-2">{read.missing.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
    <WorksheetReport title="Seller proceeds worksheet" report={report} formName="planning-seller-proceeds" ready={ready} hint="Enter at least one sale-price scenario and correct any invalid amounts to save or send the worksheet. Unentered costs will stay clearly marked in the report." />
  </>;
}

function TimingTool() {
  const [property, setProperty] = useState("");
  const [draft, setDraft] = useState<SellerTimingDraft>({ mode: "sell-first", saleDate: "", purchaseDate: "", preparationDays: "", marketingDays: "", contractDays: "", dailyCost: "" });
  const [saleFunds, setSaleFunds] = useState("Not decided");
  const [notes, setNotes] = useState("");
  const update = (key: keyof SellerTimingDraft, value: string) => setDraft({ ...draft, [key]: value });
  const plan = sellerTimingPlan(draft);
  const report = `${buildSellerTimingReport(draft, property, notes)}\nSale proceeds needed for purchase: ${saleFunds}`;
  const stages = [
    { label: "Begin preparation", date: plan.prepareDate }, { label: "Put home on the market", date: plan.listDate },
    { label: "Target a sale contract", date: plan.contractDate }, { label: "Target sale closing", date: draft.saleDate }, { label: "Target purchase closing", date: draft.purchaseDate },
  ].sort((left, right) => {
    if (!left.date) return right.date ? 1 : 0;
    if (!right.date) return -1;
    return left.date.localeCompare(right.date);
  });
  return <>
    <ToolIntro eyebrow="Two transactions, one plan" title="Put your sale and next purchase on a timeline.">Selling your current home and buying another? Choose which closing might happen first and enter your target dates. See where you may need temporary housing or carry two homes at once. These are planning dates, not confirmed contract deadlines.</ToolIntro>
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5 rounded-sm border border-ink/10 bg-white p-5 md:p-7">
        <Field label="Current property or private label (optional)" value={property} onChange={setProperty} />
        <fieldset><legend className="mb-2 text-sm font-medium text-ink">Which sequence are you exploring?</legend><div className="grid grid-cols-2 gap-2">{(["sell-first", "buy-first"] as const).map((mode) => <button key={mode} type="button" aria-pressed={draft.mode === mode} onClick={() => setDraft({ ...draft, mode })} className={`rounded-sm border px-4 py-3 text-sm font-medium ${draft.mode === mode ? "border-tide bg-tide text-sand" : "border-tide/20 text-tide hover:bg-tide/5"}`}>{mode === "sell-first" ? "Sell first" : "Buy first"}</button>)}</div></fieldset>
        <Choice label="Will you need sale proceeds for the purchase?" value={saleFunds} onChange={setSaleFunds} options={["Not decided", "Yes", "No"]} />
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Target sale closing" type="date" value={draft.saleDate} onChange={(value) => update("saleDate", value)} /><Field label="Target purchase closing" type="date" value={draft.purchaseDate} onChange={(value) => update("purchaseDate", value)} /></div>
        <h3 className="font-display text-xl text-tide">Work backward from your sale target</h3>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Preparation" suffix="calendar days" type="number" step="1" max={3650} value={draft.preparationDays} onChange={(value) => update("preparationDays", value)} /><Field label="Marketing period" suffix="calendar days" type="number" step="1" max={3650} value={draft.marketingDays} onChange={(value) => update("marketingDays", value)} /><Field label="Contract to close" suffix="calendar days" type="number" step="1" max={3650} value={draft.contractDays} onChange={(value) => update("contractDays", value)} /></div>
        <Field label={draft.mode === "sell-first" ? "Temporary housing and storage estimate per day" : "Additional carrying-cost estimate per day"} suffix="$ / day" type="number" value={draft.dailyCost} onChange={(value) => update("dailyCost", value)} help="Enter your own total daily estimate. No housing, loan or moving rate is assumed." />
        <Notes label="Questions, dependencies or agreed dates to verify" value={notes} onChange={setNotes} maxLength={400} />
      </div>
      <div>
        <section className="rounded-sm bg-tide p-6 text-sand"><h3 className="font-display text-2xl">Your planning timeline</h3><ol className="mt-6 space-y-5">{stages.map((stage, index) => <li key={stage.label} className="flex gap-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass/60 font-mono text-xs text-brass">{index + 1}</span><div><p className="text-sm text-sand/70">{stage.label}</p><p className="mt-1 font-medium">{stage.date ? sellerDate(stage.date) : "Add the relevant dates / durations"}</p></div></li>)}</ol>
          <div className="mt-6 border-t border-sand/20 pt-5"><p className="text-sm text-sand/65">{draft.mode === "sell-first" ? "Between closing dates" : "Ownership overlap between closings"}</p><p className="mt-1 font-display text-3xl">{plan.gapDays !== null && plan.gapDays >= 0 ? `${plan.gapDays} calendar days` : "Dates needed"}</p><p className="mt-3 text-sm">Entered gap / overlap cost: <strong>{plan.estimatedGapCost === null ? "Not calculated" : sellerMoney(plan.estimatedGapCost)}</strong></p></div>
        </section>
        <div className="mt-5 rounded-sm border border-brass/35 bg-brass/10 p-5 text-sm leading-relaxed text-ink/75"><h3 className="font-medium text-tide">Before committing</h3><ul className="mt-3 list-disc space-y-2 pl-5"><li>Confirm when sale proceeds would be available for your next purchase.</li><li>Confirm possession and move-in arrangements separately from closing dates.</li><li>Review lending, contingencies and actual contract deadlines with your advisers.</li></ul>{draft.mode === "buy-first" && saleFunds === "Yes" ? <p className="mt-3 font-medium text-tide">Your plan uses sale proceeds after the proposed purchase. Ask your lender how that purchase would be funded before relying on this sequence.</p> : null}</div>
      </div>
    </div>
    <Errors items={plan.errors} />
    <WorksheetReport title="Sell and buy timing plan" report={report} formName="planning-seller-timing" ready={plan.gapDays !== null && plan.errors.length === 0} hint="Enter both target closing dates in the selected sequence and correct any invalid durations to save or send your plan. These remain planning targets, not confirmed dates." />
  </>;
}

const PREPARATION_AREAS = ["Decluttering and presentation", "Paint, flooring and surfaces", "Roof and major systems", "Exterior and landscaping", "Known repairs, permits or association questions"] as const;
const PREPARATION_STATUSES = ["Not reviewed", "Discuss before spending", "Obtain a written quote", "Work completed", "No work planned"] as const;
const PREPARATION_RECORDS = ["Recent repair receipts", "Roof / system information", "Permit records", "Survey or floor plan", "HOA / condo budget and assessments"] as const;

function PreparationTool() {
  const [property, setProperty] = useState("");
  const [listingDate, setListingDate] = useState("");
  const [budget, setBudget] = useState("");
  const [occupancy, setOccupancy] = useState("Not specified");
  const [items, setItems] = useState(PREPARATION_AREAS.map((title) => ({ title, status: "Not reviewed", note: "" })));
  const [records, setRecords] = useState<string[]>([]);
  const [questions, setQuestions] = useState("");
  const errors = budget && sellerNumber(budget) === null ? ["Preparation budget: enter a nonnegative amount."] : [];
  const report = ["PREPARE-TO-SELL REVIEW", `Property: ${property.trim() || "Not entered"}`, `Desired listing date: ${sellerDate(listingDate)}`, `Occupancy: ${occupancy}`, `Budget being considered: ${sellerAmountText(budget)}`, "", "OWNER-ENTERED WORKSHEET", ...items.map((item) => `${item.title}: ${item.status}. ${item.note.trim() || "No notes entered."}`), `Records already available: ${records.length ? records.join("; ") : "None selected"}`, `Questions for Roque: ${questions.trim() || "None entered"}`, "No repair recommendation, contractor quote or return on improvement is implied by this worksheet."].join("\n");
  const ready = errors.length === 0 && Boolean(property.trim() || questions.trim() || items.some((item) => item.status !== "Not reviewed" || item.note.trim()));
  return <>
    <ToolIntro eyebrow="Before you spend" title="Prepare a useful conversation about preparing your home.">Not sure what to fix before listing? Note the repairs or updates you are considering, what documents you already have and any quotes you need. Talk with Roque before spending money on projects that may not help your sale.</ToolIntro>
    <div className="rounded-sm border border-ink/10 bg-white p-5 md:p-7">
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Property address or private label" value={property} onChange={setProperty} /><Field label="Desired listing date (optional)" type="date" value={listingDate} onChange={setListingDate} /><Field label="Preparation budget being considered (optional)" type="number" suffix="$" value={budget} onChange={setBudget} /><Choice label="Current occupancy" value={occupancy} onChange={setOccupancy} options={["Not specified", "Owner occupied", "Vacant", "Tenant occupied"]} /></div>
      <h3 className="mt-8 font-display text-2xl text-tide">Work to discuss</h3><p className="mt-2 text-sm leading-relaxed text-ink/60">For each area, choose whether you are still considering work, need a quote, have finished it or do not plan to do it. Add notes to keep track. This does not replace an inspection or contractor advice.</p>
      <div className="mt-5 space-y-4">{items.map((item, index) => <fieldset key={item.title} className="rounded-sm border border-ink/10 p-4"><legend className="px-1 text-sm font-medium text-tide">{item.title}</legend><div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]"><Choice label={`Plan for ${item.title.toLowerCase()}`} value={item.status} options={PREPARATION_STATUSES} onChange={(status) => setItems(items.map((current, position) => position === index ? { ...current, status } : current))} /><Field label="Known condition or question" maxLength={120} value={item.note} onChange={(note) => setItems(items.map((current, position) => position === index ? { ...current, note } : current))} /></div></fieldset>)}</div>
      <fieldset className="mt-7"><legend className="text-sm font-medium text-ink">Records you already have</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{PREPARATION_RECORDS.map((record) => <label key={record} className="flex items-start gap-3 text-sm text-ink/75"><input type="checkbox" checked={records.includes(record)} onChange={(event) => setRecords(event.target.checked ? [...records, record] : records.filter((item) => item !== record))} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-tide)]" /><span>{record}</span></label>)}</div></fieldset>
      <div className="mt-6"><Notes label="What would you like Roque to help decide?" value={questions} onChange={setQuestions} maxLength={500} placeholder="For example, which projects deserve a quote before we decide how to prepare the home?" /></div>
    </div>
    <Errors items={errors} />
    <WorksheetReport title="Prepare-to-sell review" report={report} formName="planning-seller-preparation" ready={ready} hint="Add a property, project decision or question to save the worksheet and request a preparation review." />
  </>;
}

function OffersTool({ costs, setCosts }: { costs: SellerCostForm; setCosts: (costs: SellerCostForm) => void }) {
  const [property, setProperty] = useState("");
  const [offers, setOffers] = useState([newSellerOffer(1), newSellerOffer(2), newSellerOffer(3)]);
  const [count, setCount] = useState(2);
  const [notes, setNotes] = useState("");
  const active = offers.slice(0, count);
  const read = readSellerCosts(costs, true);
  const update = (index: number, key: keyof SellerOfferDraft, value: string) => setOffers(offers.map((offer, position) => position === index ? { ...offer, [key]: value } : offer));
  const offerErrors = active.flatMap((offer, index) => [
    ...(offer.price && !(sellerNumber(offer.price) ?? 0) ? [`Offer ${index + 1}: enter a valid positive price.`] : []),
    ...(offer.concessions && sellerNumber(offer.concessions) === null ? [`Offer ${index + 1}: enter valid seller concessions.`] : []),
    ...(offer.deposit && sellerNumber(offer.deposit) === null ? [`Offer ${index + 1}: enter a valid deposit.`] : []),
    ...(offer.closingDate && sellerDate(offer.closingDate) === "Invalid date" ? [`Offer ${index + 1}: enter a valid closing date.`] : []),
  ]);
  const errors = [...read.errors, ...offerErrors];
  const report = buildSellerOfferReport(active, costs, property, notes);
  return <>
    <ToolIntro eyebrow="Offer decisions" title="Compare the terms behind each price.">Put up to three offers beside each other. Review proceeds, financing, contingencies and timing together; the worksheet does not select a winner.</ToolIntro>
    <div className="mb-6 grid gap-5 rounded-sm border border-ink/10 bg-white p-5 sm:grid-cols-[1fr_180px]"><Field label="Property address or private label (optional)" value={property} onChange={setProperty} /><label className="block text-sm font-medium text-ink">Offers to compare<select value={count} onChange={(event) => setCount(Number(event.target.value))} className={inputClass}><option value={1}>1 offer</option><option value={2}>2 offers</option><option value={3}>3 offers</option></select></label></div>
    <div className={`grid gap-5 ${count === 3 ? "lg:grid-cols-3" : count === 2 ? "lg:grid-cols-2" : "max-w-2xl"}`}>
      {active.map((offer, index) => {
        const price = sellerNumber(offer.price);
        const concessions = sellerNumber(offer.concessions);
        const result = price && read.errors.length === 0 && (!offer.concessions || concessions !== null) ? calculateSellerProceeds(price, { ...read.costs, sellerConcessions: concessions ?? 0 }) : null;
        return <section key={index} className="space-y-4 rounded-sm border border-tide/15 bg-white p-5"><h3 className="font-display text-2xl text-tide">Offer {index + 1}</h3><Field label="Private offer label" maxLength={40} value={offer.label} onChange={(value) => update(index, "label", value)} /><Field label="Purchase price" suffix="$" type="number" value={offer.price} onChange={(value) => update(index, "price", value)} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Field label="Seller concessions" suffix="$" type="number" value={offer.concessions} onChange={(value) => update(index, "concessions", value)} /><Field label="Deposit" suffix="$" type="number" value={offer.deposit} onChange={(value) => update(index, "deposit", value)} /></div>
          <div className="rounded-sm bg-tide/5 p-4"><p className="text-xs text-ink/60">Net at closing from entered amounts</p><p className="mt-1 font-display text-2xl text-tide">{result ? sellerMoney(result.netAtClosing) : "Price / valid costs needed"}</p><p className="mt-2 text-xs leading-relaxed text-ink/60">{read.missing.length || !offer.concessions ? "Unentered common costs or offer concessions are excluded." : "Uses all entered common costs and this offer’s concessions."}</p></div>
          <Choice label="Financing type" value={offer.financing} onChange={(value) => update(index, "financing", value)} options={["Not specified", "Cash", "Financed", "Other arrangement"]} />
          <Field label="Requested closing date" type="date" value={offer.closingDate} onChange={(value) => update(index, "closingDate", value)} />
          <Field label="Inspection terms / dates" maxLength={120} value={offer.inspection} onChange={(value) => update(index, "inspection", value)} />
          <Choice label="Appraisal terms" value={offer.appraisal} onChange={(value) => update(index, "appraisal", value)} options={["Not specified", "Appraisal contingency included", "No appraisal contingency stated", "Other terms — discuss"]} />
          <Field label="Financing contingency / other loan terms" maxLength={120} value={offer.financingTerms} onChange={(value) => update(index, "financingTerms", value)} />
          <Field label="Possession / occupancy terms" maxLength={100} value={offer.possession} onChange={(value) => update(index, "possession", value)} />
          <Notes label="Other terms or questions" value={offer.notes} onChange={(value) => update(index, "notes", value)} maxLength={120} />
        </section>;
      })}
    </div>
    <p className="mt-5 text-sm leading-relaxed text-ink/65">A deposit is part of the purchase price and is shown for comparison; it is not deducted from proceeds a second time. Record the actual contract terms and have your broker or legal adviser resolve unclear provisions.</p>
    <details className="mt-6 rounded-sm border border-ink/10 bg-white p-5 md:p-7"><summary className="cursor-pointer font-display text-2xl text-tide">Review the common fee and payoff assumptions</summary><p className="mb-6 mt-3 text-sm leading-relaxed text-ink/65">These inputs are shared with Sale proceeds. Each offer’s concession amount replaces the concession entered in that worksheet. {read.missing.length} common inputs are currently unentered.</p><CostFields costs={costs} onChange={setCosts} offers /></details>
    <div className="mt-6"><Notes label="What tradeoffs or unanswered questions matter to you?" maxLength={300} value={notes} onChange={setNotes} /></div>
    <Errors items={errors} />
    <WorksheetReport title="Seller offer comparison" report={report} formName="planning-seller-offers" ready={active.some((offer) => (sellerNumber(offer.price) ?? 0) > 0) && errors.length === 0} hint="Enter at least one offer price and correct invalid amounts to save or send the comparison. Unentered terms and costs remain marked in the report." />
  </>;
}

const REPORT_METRICS = [
  { id: "onlineViews", label: "Reported online views" }, { id: "showingRequests", label: "Showing requests" },
  { id: "completedShowings", label: "Completed showings" }, { id: "feedbackResponses", label: "Feedback responses received" },
  { id: "writtenOffers", label: "Written offers received" }, { id: "openHouseVisits", label: "Recorded open-house visits" },
] as const;
const REPORT_NOTES = [
  { id: "marketing", label: "Marketing work completed", placeholder: "Enter the actual work completed during this reporting period." },
  { id: "feedback", label: "Feedback and themes", placeholder: "Summarize recorded comments without buyer names; distinguish comments from your interpretation." },
  { id: "decisions", label: "Decisions or documents still needed", placeholder: "What needs a response from the seller, broker or another professional?" },
  { id: "nextSteps", label: "Planned next steps", placeholder: "Describe the next actions and who will handle them." },
] as const;

function ProgressReportTool() {
  const [property, setProperty] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [price, setPrice] = useState("");
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sources, setSources] = useState("");
  const range = sellerDaysBetween(start, end);
  const errors = [
    ...(start && end && (range === null || range < 0) ? ["The reporting period must have valid dates with the end on or after the start."] : []),
    ...(price && sellerNumber(price) === null ? ["Asking price: enter a nonnegative amount."] : []),
    ...REPORT_METRICS.flatMap((metric) => { const raw = metrics[metric.id] ?? ""; const value = sellerNumber(raw, 1_000_000_000); return raw && (value === null || !Number.isInteger(value)) ? [`${metric.label}: enter a nonnegative whole number.`] : []; }),
  ];
  const report = [
    "WEEKLY SELLER PROGRESS REPORT — MANUAL DRAFT", `Property: ${property.trim() || "Not entered"}`,
    `Reporting period: ${sellerDate(start)} to ${sellerDate(end)}`, `Prepared by: ${preparedBy.trim() || "Not entered"}`,
    `Asking price entered for this report: ${sellerAmountText(price)}`, "", "ACTIVITY ENTERED FOR THIS PERIOD",
    ...REPORT_METRICS.map((metric) => `${metric.label}: ${metrics[metric.id]?.trim() || "Not recorded"}`),
    `Source of activity figures: ${sources.trim() || "Not recorded"}`,
    ...REPORT_NOTES.flatMap((note) => ["", note.label.toUpperCase(), notes[note.id]?.trim() || "Not entered"]),
    "", "No website traffic, showings, buyer feedback or offers have been added automatically. Online views are not completed showings or conversations. Verify the entries before distributing this report.",
  ].join("\n");
  const ready = errors.length === 0 && Boolean(property.trim() || preparedBy.trim() || Object.values(metrics).some((value) => value.trim()) || Object.values(notes).some((value) => value.trim()));
  return <>
    <ToolIntro eyebrow="Keep sellers informed" title="Create a clear weekly progress report.">Use this to make a simple weekly update about a home listed for sale. Enter only actual marketing work, showing requests, feedback and next steps. Nothing is filled in automatically; check the information before sharing it.</ToolIntro>
    <div className="rounded-sm border border-ink/10 bg-white p-5 md:p-7">
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Property address or private label" value={property} onChange={setProperty} /><Field label="Prepared by (optional)" maxLength={80} value={preparedBy} onChange={setPreparedBy} /><Field label="Reporting period begins" type="date" value={start} onChange={setStart} /><Field label="Reporting period ends" type="date" value={end} onChange={setEnd} /><Field label="Asking price for this report (optional)" suffix="$" type="number" value={price} onChange={setPrice} /></div>
      <h3 className="mt-8 font-display text-2xl text-tide">Recorded activity</h3><p className="mt-2 text-sm leading-relaxed text-ink/60">Enter 0 only if you have confirmed none occurred. Leave a field blank when its count is unknown. Keep online views separate from actual showing activity.</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{REPORT_METRICS.map((metric) => <Field key={metric.id} label={metric.label} type="number" step="1" value={metrics[metric.id] ?? ""} onChange={(value) => setMetrics({ ...metrics, [metric.id]: value })} />)}</div>
      <div className="mt-5"><Field label="Where did these figures come from?" maxLength={200} value={sources} onChange={setSources} help="For example, the reporting dates and name of the showing log, marketing report or broker’s records." /></div>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">{REPORT_NOTES.map((note) => <Notes key={note.id} label={note.label} placeholder={note.placeholder} maxLength={400} value={notes[note.id] ?? ""} onChange={(value) => setNotes({ ...notes, [note.id]: value })} />)}</div>
    </div>
    <Errors items={errors} />
    <WorksheetReport title="Weekly seller progress report" report={report} formName="planning-seller-report" ready={ready} hint="Add the property or actual activity and correct invalid entries to save, print or send the manual draft. No results will be filled in for you." />
  </>;
}

export default function SellerPlanning({ initialTool = "proceeds" }: { initialTool?: SellerTool }) {
  const [tool, setTool] = useState<SellerTool>(initialTool);
  const [costs, setCosts] = useState<SellerCostForm>(newSellerCosts);
  function chooseTool(next: SellerTool) {
    setTool(next);
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("tool", next);
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  return <div>
    <nav aria-label="Seller planning tools" className="mb-8 flex flex-wrap gap-2 border-b border-tide/15 pb-5">{SELLER_TOOLS.map((item) => <button key={item.id} id={`seller-tool-${item.id}`} type="button" aria-pressed={tool === item.id} aria-controls={`seller-panel-${item.id}`} onClick={() => chooseTool(item.id)} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${tool === item.id ? "border-tide bg-tide text-sand" : "border-tide/20 bg-white text-tide hover:bg-tide/5"}`}>{item.label}</button>)}</nav>
    <section id="seller-panel-proceeds" aria-labelledby="seller-tool-proceeds" hidden={tool !== "proceeds"}><ProceedsTool costs={costs} setCosts={setCosts} /></section>
    <section id="seller-panel-timing" aria-labelledby="seller-tool-timing" hidden={tool !== "timing"}><TimingTool /></section>
    <section id="seller-panel-prepare" aria-labelledby="seller-tool-prepare" hidden={tool !== "prepare"}><PreparationTool /></section>
    <section id="seller-panel-offers" aria-labelledby="seller-tool-offers" hidden={tool !== "offers"}><OffersTool costs={costs} setCosts={setCosts} /></section>
    <section id="seller-panel-report" aria-labelledby="seller-tool-report" hidden={tool !== "report"}><ProgressReportTool /></section>
  </div>;
}
