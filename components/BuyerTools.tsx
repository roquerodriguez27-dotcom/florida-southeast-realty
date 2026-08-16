"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import type { Listing } from "@/lib/types";

type Tool = "cost" | "affordability" | "compare";

interface BuyerToolsProps {
  listings: Listing[];
  initialListingSlug?: string;
  initialTool?: Tool;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function payment(principal: number, annualRate: number, years: number) {
  if (principal <= 0 || years <= 0) return 0;
  const months = years * 12;
  const rate = annualRate / 100 / 12;
  if (rate === 0) return principal / months;
  return principal * (rate * (1 + rate) ** months) / ((1 + rate) ** months - 1);
}

function Input({ label, value, onChange, prefix, suffix, step = 1, min = 0 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
}) {
  const [draft, setDraft] = useState(() => String(value));

  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-wide text-ink/55 mb-1">{label}</span>
      <span className="flex items-center bg-white border border-ink/15 rounded-sm focus-within:border-tide">
        {prefix && <span className="pl-3 text-ink/45">{prefix}</span>}
        <input
          type="number"
          value={draft}
          min={min}
          step={step}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (next !== "") onChange(Number(next));
          }}
          onBlur={() => {
            if (draft === "") {
              setDraft("0");
              onChange(0);
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full min-w-0 bg-transparent px-2.5 py-2.5 outline-none tabular-nums"
        />
        {suffix && <span className="pr-3 text-ink/45 text-sm">{suffix}</span>}
      </span>
    </label>
  );
}

function CostBreakdown({ price, downPayment, rate, years, taxRate, insurance, flood, hoa, cdd, pmiRate }: {
  price: number;
  downPayment: number;
  rate: number;
  years: number;
  taxRate: number;
  insurance: number;
  flood: number;
  hoa: number;
  cdd: number;
  pmiRate: number;
}) {
  const loan = Math.max(0, price - downPayment);
  const principalInterest = payment(loan, rate, years);
  const taxes = price * (taxRate / 100) / 12;
  const pmi = price > 0 && downPayment / price < 0.2 ? loan * (pmiRate / 100) / 12 : 0;
  const total = principalInterest + taxes + insurance + flood + hoa + cdd + pmi;
  const rows = [
    ["Principal & interest", principalInterest],
    ["Estimated property taxes", taxes],
    ["Homeowners insurance", insurance],
    ["Flood insurance", flood],
    ["HOA / condo fees", hoa],
    ["CDD / other assessments", cdd],
    ["Estimated PMI", pmi],
  ] as const;

  return (
    <div className="bg-tide text-sand rounded-sm p-6 md:p-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Estimated true monthly cost</p>
      <p className="font-display text-4xl mt-2">{money.format(total)}</p>
      <p className="text-xs text-sand/55 mt-1">Estimated loan amount: {money.format(loan)}</p>
      <div className="mt-5 divide-y divide-white/10">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
            <span className="text-sand/65">{label}</span><span className="font-mono">{money.format(value)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-sand/45 leading-relaxed mt-4">
        Planning estimate only. Taxes, insurance, flood coverage, assessments, PMI, rates, and lender terms must be independently verified.
      </p>
    </div>
  );
}

export default function BuyerTools({ listings, initialListingSlug, initialTool = "cost" }: BuyerToolsProps) {
  const initialListing = listings.find((listing) => listing.slug === initialListingSlug);
  const [tool, setTool] = useState<Tool>(initialTool);
  const [price, setPrice] = useState(initialListing?.price ?? 600000);
  const [downPercent, setDownPercent] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);
  const [taxRate, setTaxRate] = useState(1.8);
  const [insurance, setInsurance] = useState(650);
  const [flood, setFlood] = useState(0);
  const [hoa, setHoa] = useState(0);
  const [cdd, setCdd] = useState(0);
  const [pmiRate, setPmiRate] = useState(0.7);
  const [income, setIncome] = useState(150000);
  const [monthlyDebt, setMonthlyDebt] = useState(900);
  const [cash, setCash] = useState(120000);
  const [dti, setDti] = useState(36);
  const [selected, setSelected] = useState<string[]>(initialListingSlug ? [initialListingSlug] : listings.slice(0, 3).map((listing) => listing.slug));

  const downPayment = price * downPercent / 100;
  const monthlyIncome = income / 12;
  const maxHousing = Math.max(0, Math.min(monthlyIncome * 0.28, monthlyIncome * dti / 100 - monthlyDebt));
  const fixedHousingCosts = insurance + flood + hoa + cdd;
  const availableForLoanAndTax = Math.max(0, maxHousing - fixedHousingCosts);
  const monthlyRate = rate / 100 / 12;
  const months = years * 12;
  const paymentPerBorrowedDollar = monthlyRate === 0 ? 1 / months : monthlyRate * (1 + monthlyRate) ** months / ((1 + monthlyRate) ** months - 1);
  const downFraction = Math.min(1, Math.max(0, downPercent / 100));
  const pmiPerPriceDollar = downFraction < 0.2 ? (1 - downFraction) * pmiRate / 100 / 12 : 0;
  const monthlyCostPerPriceDollar = (1 - downFraction) * paymentPerBorrowedDollar + taxRate / 100 / 12 + pmiPerPriceDollar;
  const paymentLimitedPrice = monthlyCostPerPriceDollar > 0 ? availableForLoanAndTax / monthlyCostPerPriceDollar : 0;
  const cashLimitedDown = Math.max(0, cash - 18000);
  const cashLimitedPrice = downFraction > 0 ? cashLimitedDown / downFraction : paymentLimitedPrice;
  const affordablePrice = Math.max(0, Math.min(paymentLimitedPrice, cashLimitedPrice));

  const chosen = useMemo(() => selected.map((slug) => listings.find((listing) => listing.slug === slug)).filter(Boolean) as Listing[], [listings, selected]);
  const scenarioSummary = tool === "cost"
    ? `${money.format(price)} purchase; ${downPercent}% down; ${decimal.format(rate)}% rate; ${years}-year term; ${money.format(hoa)}/mo HOA; ${money.format(insurance)}/mo insurance; ${money.format(flood)}/mo flood estimate.`
    : tool === "affordability"
      ? `${money.format(income)} annual income; ${money.format(monthlyDebt)}/mo debts; ${money.format(cash)} available cash; estimated planning range ${money.format(affordablePrice)}.`
      : `Compared properties: ${chosen.map((listing) => `${listing.address} (${listing.mlsId})`).join(", ") || "none selected"}.`;

  function toggleListing(slug: string) {
    setSelected((current) => current.includes(slug) ? current.filter((item) => item !== slug) : current.length < 3 ? [...current, slug] : current);
  }

  const tabs: { id: Tool; label: string }[] = [
    { id: "cost", label: "True Monthly Cost" },
    { id: "affordability", label: "Affordability" },
    { id: "compare", label: "Compare Homes" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 border border-ink/10 rounded-sm overflow-hidden bg-white" role="tablist" aria-label="Buyer tools">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={tool === tab.id} onClick={() => setTool(tab.id)} className={`px-4 py-3.5 text-sm font-medium border-b sm:border-b-0 sm:border-r last:border-0 border-ink/10 ${tool === tab.id ? "bg-tide text-sand" : "hover:bg-keystone"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {tool === "cost" && (
        <section className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start" aria-label="True monthly ownership cost calculator">
          <div className="bg-white border border-ink/10 rounded-sm p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div><h2 className="font-display text-2xl">Build a Florida ownership estimate</h2><p className="text-sm text-ink/55 mt-1">Include the costs generic mortgage calculators often miss.</p></div>
              {initialListing && <p className="text-xs bg-brass/10 px-3 py-2 rounded-sm">Using {initialListing.address}</p>}
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <Input label="Purchase price" value={price} onChange={setPrice} prefix="$" step={5000} />
              <Input label="Down payment" value={downPercent} onChange={setDownPercent} suffix="%" step={1} />
              <Input label="Interest rate" value={rate} onChange={setRate} suffix="%" step={0.125} />
              <Input label="Loan term" value={years} onChange={setYears} suffix="years" step={5} />
              <Input label="Property-tax rate" value={taxRate} onChange={setTaxRate} suffix="% / yr" step={0.05} />
              <Input label="Home insurance" value={insurance} onChange={setInsurance} prefix="$" suffix="/ mo" step={25} />
              <Input label="Flood insurance" value={flood} onChange={setFlood} prefix="$" suffix="/ mo" step={25} />
              <Input label="HOA / condo" value={hoa} onChange={setHoa} prefix="$" suffix="/ mo" step={25} />
              <Input label="CDD / assessments" value={cdd} onChange={setCdd} prefix="$" suffix="/ mo" step={25} />
              <Input label="PMI rate" value={pmiRate} onChange={setPmiRate} suffix="% / yr" step={0.1} />
            </div>
            <p className="text-xs text-ink/45 mt-5">Down payment: {money.format(downPayment)}. Enter quotes or known property costs whenever available.</p>
          </div>
          <CostBreakdown price={price} downPayment={downPayment} rate={rate} years={years} taxRate={taxRate} insurance={insurance} flood={flood} hoa={hoa} cdd={cdd} pmiRate={pmiRate} />
        </section>
      )}

      {tool === "affordability" && (
        <section className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start" aria-label="Home affordability scenario planner">
          <div className="bg-white border border-ink/10 rounded-sm p-6 md:p-8">
            <h2 className="font-display text-2xl">Test an affordability scenario</h2>
            <p className="text-sm text-ink/55 mt-1 mb-6">Use household numbers to create a planning range—not a lending decision.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Annual household income" value={income} onChange={setIncome} prefix="$" step={5000} />
              <Input label="Monthly debt payments" value={monthlyDebt} onChange={setMonthlyDebt} prefix="$" suffix="/ mo" step={50} />
              <Input label="Cash available" value={cash} onChange={setCash} prefix="$" step={5000} />
              <Input label="Down-payment target" value={downPercent} onChange={setDownPercent} suffix="%" />
              <Input label="Interest rate" value={rate} onChange={setRate} suffix="%" step={0.125} />
              <Input label="Debt-to-income ceiling" value={dti} onChange={setDti} suffix="%" />
              <Input label="Property-tax rate" value={taxRate} onChange={setTaxRate} suffix="% / yr" step={0.05} />
              <Input label="Insurance estimate" value={insurance} onChange={setInsurance} prefix="$" suffix="/ mo" step={25} />
              <Input label="Flood estimate" value={flood} onChange={setFlood} prefix="$" suffix="/ mo" step={25} />
              <Input label="HOA / condo target" value={hoa} onChange={setHoa} prefix="$" suffix="/ mo" step={25} />
            </div>
          </div>
          <div className="bg-tide text-sand rounded-sm p-6 md:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Estimated planning range</p>
            <p className="font-display text-4xl mt-2">{money.format(affordablePrice)}</p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-sand/65">Target housing budget</span><span>{money.format(maxHousing)}/mo</span></div>
              <div className="flex justify-between"><span className="text-sand/65">Assumed cash reserve</span><span>{money.format(18000)}</span></div>
              <div className="flex justify-between"><span className="text-sand/65">Loan term</span><span>{years} years</span></div>
            </div>
            <p className="text-[11px] text-sand/45 leading-relaxed mt-5">This simplified scenario does not include every lender guideline, closing cost, escrow adjustment, credit factor, or property-specific expense. It is not a preapproval.</p>
          </div>
        </section>
      )}

      {tool === "compare" && (
        <section className="mt-6" aria-label="Property comparison">
          <div className="bg-white border border-ink/10 rounded-sm p-5 md:p-7">
            <div className="flex flex-wrap justify-between gap-3 items-end">
              <div><h2 className="font-display text-2xl">Compare up to three homes</h2><p className="text-sm text-ink/55 mt-1">Live MLS fields will replace preview data after IDX activation.</p></div>
              <span className="font-mono text-xs text-ink/45">{selected.length}/3 selected</span>
            </div>
            <div className="flex gap-2 overflow-x-auto py-4 mt-2">
              {listings.map((listing) => {
                const active = selected.includes(listing.slug);
                return <button key={listing.slug} type="button" onClick={() => toggleListing(listing.slug)} disabled={!active && selected.length >= 3} className={`shrink-0 text-left border rounded-sm p-3 w-56 disabled:opacity-40 ${active ? "border-tide bg-tide/5" : "border-ink/10"}`}><span className="block font-medium text-sm truncate">{listing.address}</span><span className="block text-xs text-ink/50 mt-1">{money.format(listing.price)} · {listing.city}</span></button>;
              })}
            </div>
          </div>

          {chosen.length > 0 ? (
            <div className="mt-5 overflow-x-auto border border-ink/10 rounded-sm bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="bg-tide text-sand"><th className="text-left p-4 font-medium">Comparison</th>{chosen.map((listing) => <th key={listing.slug} className="text-left p-4 font-medium"><Link href={`/properties/${listing.slug}`} className="hover:underline">{listing.address}</Link><span className="block text-xs font-normal text-sand/55 mt-1">{listing.city}</span></th>)}</tr></thead>
                <tbody className="divide-y divide-ink/10">
                  {[
                    ["Price", (listing: Listing) => money.format(listing.price)],
                    ["Price per sq. ft.", (listing: Listing) => money.format(listing.price / listing.sqft)],
                    ["Bedrooms / bathrooms", (listing: Listing) => `${listing.beds} / ${listing.baths}${listing.halfBaths ? ` + ${listing.halfBaths} half` : ""}`],
                    ["Living area", (listing: Listing) => `${listing.sqft.toLocaleString()} sq. ft.`],
                    ["Lot", (listing: Listing) => listing.lotSqft ? `${listing.lotSqft.toLocaleString()} sq. ft.` : "Not provided"],
                    ["Year built", (listing: Listing) => String(listing.yearBuilt)],
                    ["Property type", (listing: Listing) => listing.propertyType],
                    ["Waterfront", (listing: Listing) => listing.waterfront ? "Yes" : "No"],
                    ["Days on market", (listing: Listing) => String(listing.daysOnMarket)],
                  ].map(([label, getValue]) => <tr key={label as string}><th className="text-left p-4 font-medium text-ink/60 bg-keystone/50">{label as string}</th>{chosen.map((listing) => <td key={listing.slug} className="p-4">{(getValue as (item: Listing) => string)(listing)}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-5 p-8 border border-dashed border-ink/20 text-center text-ink/55">Select at least one property to begin comparing.</p>}
        </section>
      )}

      <section className="mt-12 grid lg:grid-cols-2 gap-8 items-start border-t border-ink/10 pt-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">Save your work</p>
          <h2 className="font-display text-3xl mt-2">Ask Rocky to review this scenario</h2>
          <p className="text-ink/65 mt-3 max-w-lg">Send the current assumptions to Florida Southeast Realty. We can help identify missing property costs, compare homes, and connect you with a licensed lender when appropriate.</p>
          <p className="mt-5 bg-keystone p-4 rounded-sm text-sm text-ink/65"><span className="font-medium text-ink">Current scenario:</span> {scenarioSummary}</p>
        </div>
        <LeadForm formName="buyer-tools-review" submitLabel="Save & Request a Review" successMessage="Florida Southeast Realty will review your saved buyer scenario and follow up." hiddenContext={{ tool, scenario: scenarioSummary }} fields={[
          { name: "name", label: "Name", type: "text", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "phone", label: "Phone", type: "tel" },
          { name: "notes", label: "What should we know?", type: "textarea", placeholder: "Timing, preferred areas, questions, or deal breakers", colSpan: 2 },
        ]} />
      </section>
    </div>
  );
}
