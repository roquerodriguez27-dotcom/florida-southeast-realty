"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PlanHandoff from "@/components/planning/PlanHandoff";
import ReportActions from "@/components/planning/ReportActions";
import { analyzeBuyerPlanner, buyerPlannerReport, newBuyerPlannerInputs, MONTHLY_COST_LABELS, BUYER_MODEL_LIMITS, type BuyerInputKey } from "@/lib/planning/buyer-calculations";
import { planningNumber } from "@/lib/planning/calculator-core";
import {
  clearComparisonListings,
  removeComparisonListing,
  useComparisonListings,
} from "@/components/useComparisonListings";
import {
  MAX_COMPARE_LISTINGS,
  savedComparisonListing,
  type SavedComparisonListing,
} from "@/lib/comparison";
import type { Listing } from "@/lib/types";

type Tool = "cost" | "affordability" | "compare";

interface BuyerToolsProps {
  initialListing?: Listing;
  initialTool?: Tool;
}

interface ComparisonHome {
  id: string;
  sourceSlug?: string;
  image?: string;
  address: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  hoa: string;
  yearBuilt: string;
  notes: string;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function emptyComparisonHome(index: number): ComparisonHome {
  return {
    id: `home-${index}`,
    address: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
    hoa: "",
    yearBuilt: "",
    notes: "",
  };
}

function comparisonAddress(listing: SavedComparisonListing): string {
  const address = listing.address.trim();
  const city = listing.city.trim();
  const zip = listing.zip.trim();
  const addressLower = address.toLowerCase();

  // RESO UnparsedAddress frequently already includes the city, state, and ZIP.
  // Add the location suffix only when the feed returned a street-only address.
  if ((city && addressLower.includes(city.toLowerCase())) || (zip && address.includes(zip))) {
    return address;
  }

  return [address, city, ["FL", zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function comparisonHomeFromSavedListing(listing: SavedComparisonListing, index: number): ComparisonHome {
  return {
    id: `home-${index}`,
    sourceSlug: listing.slug,
    image: listing.image,
    address: comparisonAddress(listing),
    price: String(listing.price),
    beds: String(listing.beds),
    baths: String(listing.baths + (listing.halfBaths ?? 0) * 0.5),
    sqft: String(listing.sqft),
    hoa: listing.associationFeeMonthly !== undefined ? String(listing.associationFeeMonthly) : "",
    yearBuilt: listing.yearBuilt ? String(listing.yearBuilt) : "",
    notes: `${listing.propertyType}${listing.waterfront ? " · Waterfront" : ""} · MLS ${listing.mlsId}`,
  };
}

function positiveNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function ComparisonField({
  label,
  value,
  onChange,
  type = "text",
  prefix,
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  prefix?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wide text-ink/50 mb-1">{label}</span>
      <span className="price-field flex items-center border border-ink/15 rounded-sm bg-white focus-within:border-tide">
        {prefix && <span className="pl-2.5 text-ink/45">{prefix}</span>}
        <input
          type={type}
          value={value}
          min={type === "number" ? "0" : undefined}
          step={step}
          maxLength={type === "text" ? 1000 : undefined}
          inputMode={type === "number" ? "decimal" : undefined}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="price-field-input w-full min-w-0 bg-transparent px-2.5 py-2 text-sm outline-none"
        />
      </span>
    </label>
  );
}

function Input({ label, value, onChange, prefix, suffix, step = 1, min = 0, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-mono uppercase tracking-wide text-ink/70 mb-1">{label}</span>
      <span className="price-field flex items-center bg-white border border-ink/15 rounded-sm focus-within:border-tide">
        {prefix && <span className="pl-3 text-ink/60">{prefix}</span>}
        <input type="number" value={value} min={min} step={step} disabled={disabled}
          placeholder={disabled ? "Not applicable" : "Unknown"}
          onChange={event => onChange(event.target.value)}
          onFocus={event => event.currentTarget.select()}
          className="price-field-input w-full min-w-0 bg-transparent px-2.5 py-2.5 outline-none tabular-nums disabled:opacity-50" />
        {suffix && <span className="pr-3 text-ink/60 text-sm">{suffix}</span>}
      </span>
      {disabled && <span className="mt-1 block text-xs text-ink/65">Not used for the selected down payment.</span>}
    </label>
  );
}

function BuyerInputWarnings({ review }: { review: ReturnType<typeof analyzeBuyerPlanner> }) {
  return <>
    {review.errors.length > 0 && <p role="alert" className="mt-4 text-sm leading-relaxed">Correct: {review.errors.join(" ")}</p>}
    {review.missing.length > 0 && <p role="status" className="mt-4 text-sm leading-relaxed">Still unknown: {review.missing.join("; ")}. Enter 0 only when you have confirmed no amount applies. No complete estimate is shown yet.</p>}
  </>;
}

function CostBreakdown({ review }: { review: ReturnType<typeof analyzeBuyerPlanner> }) {
  const costs = review.monthly;
  return <div className="bg-tide text-sand rounded-sm p-6 md:p-7" data-calculator="buyer-monthly-summary">
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Estimated monthly total of included costs</p>
    <p className="font-display text-4xl mt-2">{costs ? money.format(costs.total) : "Not calculated"}</p>
    <BuyerInputWarnings review={review} />
    {costs && <>
      <p className="text-sm text-sand/85 mt-3">Loan amount: {money.format(costs.loan)}. Down payment: {money.format(costs.downPayment)}.</p>
      <dl className="mt-5 divide-y divide-white/20">{MONTHLY_COST_LABELS.map(([key, label]) => <div key={key} className="flex justify-between gap-4 py-2.5 text-sm"><dt className="text-sand/85">{label}</dt><dd className="font-mono shrink-0">{money.format(costs[key])}</dd></div>)}</dl>
    </>}
    <p className="text-xs text-sand/85 leading-relaxed mt-5">{BUYER_MODEL_LIMITS}</p>
  </div>;
}

export default function BuyerTools({ initialListing, initialTool = "cost" }: BuyerToolsProps) {
  const [tool, setTool] = useState<Tool>(initialTool);
  const [propertyReference, setPropertyReference] = useState(() => initialListing ? comparisonAddress(savedComparisonListing(initialListing)) : "");
  const [form, setForm] = useState(() => newBuyerPlannerInputs(initialListing));
  const { price, downPercent, rate, years, taxRate, insurance, flood, hoa, cdd, pmiRate, income, monthlyDebt, cash, dti, housingPercent, closingCosts, closingCredits } = form;
  const updateInput = (key: BuyerInputKey, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const noLoan = planningNumber(downPercent, 100) === 100;
  const noPmi = (planningNumber(downPercent, 100) ?? -1) >= 20;
  const selectedListings = useComparisonListings();
  const [dismissedInitialListing, setDismissedInitialListing] = useState(false);
  const [manualComparisonHomes, setManualComparisonHomes] = useState<ComparisonHome[]>(() => [
    emptyComparisonHome(1),
    emptyComparisonHome(2),
    emptyComparisonHome(3),
  ]);
  const [manualEntrySlots, setManualEntrySlots] = useState(() => [false, false, false]);
  const [listingEdits, setListingEdits] = useState<Record<string, Partial<Omit<ComparisonHome, "id" | "sourceSlug">>>>({});

  const initialSavedListing = initialListing ? savedComparisonListing(initialListing) : undefined;
  const loadedListings = [
    ...(initialSavedListing && !dismissedInitialListing ? [initialSavedListing] : []),
    ...selectedListings.filter((listing) => listing.slug !== initialSavedListing?.slug),
  ].slice(0, MAX_COMPARE_LISTINGS);
  const comparisonHomes = Array.from({ length: MAX_COMPARE_LISTINGS }, (_, index) => {
    const listing = loadedListings[index];
    if (!listing) return manualComparisonHomes[index];
    return {
      ...comparisonHomeFromSavedListing(listing, index + 1),
      ...listingEdits[listing.slug],
    };
  });

  const monthlyReview = analyzeBuyerPlanner("cost", form);
  const affordabilityReview = analyzeBuyerPlanner("affordability", form);
  const budget = affordabilityReview.budget;
  const enteredHomes = comparisonHomes.filter(home => home.address.trim());
  const scenarioSummary = buyerPlannerReport(tool, form, propertyReference, comparisonHomes);

  function updateComparisonHome(index: number, field: keyof Omit<ComparisonHome, "id" | "sourceSlug">, value: string) {
    const home = comparisonHomes[index];
    const sourceSlug = home.sourceSlug;
    if (sourceSlug) {
      setListingEdits((current) => ({
        ...current,
        [sourceSlug]: { ...current[sourceSlug], [field]: value },
      }));
      return;
    }
    setManualComparisonHomes((current) => current.map((item, homeIndex) => homeIndex === index ? { ...item, [field]: value } : item));
  }

  function clearComparisonHome(index: number) {
    const home = comparisonHomes[index];
    const sourceSlug = home.sourceSlug;
    setManualEntrySlots((current) => current.map((value, homeIndex) => homeIndex === index ? false : value));
    if (sourceSlug) {
      removeComparisonListing(sourceSlug);
      if (sourceSlug === initialListing?.slug) setDismissedInitialListing(true);
      setListingEdits((current) => {
        const next = { ...current };
        delete next[sourceSlug];
        return next;
      });
      return;
    }
    setManualComparisonHomes((current) => current.map((item, homeIndex) => homeIndex === index ? emptyComparisonHome(index + 1) : item));
  }

  function clearAllComparisonHomes() {
    clearComparisonListings();
    setDismissedInitialListing(true);
    setListingEdits({});
    setManualEntrySlots([false, false, false]);
    setManualComparisonHomes([
      emptyComparisonHome(1),
      emptyComparisonHome(2),
      emptyComparisonHome(3),
    ]);
  }

  const tabs: { id: Tool; label: string }[] = [
    { id: "cost", label: "Monthly Cost Estimate" },
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

      {tool !== "compare" && <aside className="mt-5 rounded-sm border border-brass/35 bg-brass/10 p-4 text-sm leading-relaxed text-ink/80"><strong>Start with your own numbers.</strong> Only a selected listing’s price and any reported HOA fee are loaded from listing data; verify both. Other costs start unknown, not at zero. The 20% down payment, 30-year term and 28% / 36% budget ratios are editable planning assumptions, not quotes or lender rules. Rates, insurance and tax amounts are not fetched for the property.</aside>}

      {tool !== "compare" && <label className="block mt-5 max-w-xl"><span className="block text-sm font-medium mb-1.5">Property address or scenario name (optional)</span><input className="w-full rounded-sm border border-ink/20 bg-white p-3 focus:border-tide outline-none" value={propertyReference} maxLength={180} onChange={event => setPropertyReference(event.target.value)} placeholder="Label the property or assumptions for your report" /></label>}

      {tool === "cost" && (
        <section className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start" aria-label="Monthly cost estimate calculator">
          <div className="bg-white border border-ink/10 rounded-sm p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div><h2 className="font-display text-2xl">Build a Florida ownership estimate</h2><p className="text-sm text-ink/55 mt-1">Include the costs generic mortgage calculators often miss.</p></div>
              {initialListing && <p className="text-xs bg-brass/10 px-3 py-2 rounded-sm">Using {initialListing.address}</p>}
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <Input label="Purchase price" value={price} onChange={value => updateInput("price", value)} prefix="$" step={5000} />
              <Input label="Down payment" value={downPercent} onChange={value => updateInput("downPercent", value)} suffix="%" step={1} />
              <Input label="Interest rate assumption" disabled={noLoan} value={rate} onChange={value => updateInput("rate", value)} suffix="%" step={0.125} />
              <Input label="Loan term" disabled={noLoan} value={years} onChange={value => updateInput("years", value)} suffix="years" step={1} />
              <Input label="Assumed annual tax (% of price)" value={taxRate} onChange={value => updateInput("taxRate", value)} suffix="% / yr" step={0.05} />
              <Input label="Home insurance" value={insurance} onChange={value => updateInput("insurance", value)} prefix="$" suffix="/ mo" step={25} />
              <Input label="Flood insurance" value={flood} onChange={value => updateInput("flood", value)} prefix="$" suffix="/ mo" step={25} />
              <Input label="HOA / condo" value={hoa} onChange={value => updateInput("hoa", value)} prefix="$" suffix="/ mo" step={25} />
              <Input label="CDD / assessments" value={cdd} onChange={value => updateInput("cdd", value)} prefix="$" suffix="/ mo" step={25} />
              <Input label="PMI rate assumption" disabled={noPmi} value={pmiRate} onChange={value => updateInput("pmiRate", value)} suffix="% / yr" step={0.1} />
            </div>
            <p className="text-xs text-ink/45 mt-5">Tax input is an effective annual percentage of the assumed purchase price, not a county millage rate. Use official county estimates and written insurance quotes. Supported loan terms are 1–50 whole years. Do not count an assessment twice if it is already in another entered amount.</p>
          </div>
          <CostBreakdown review={monthlyReview} />
        </section>
      )}

      {tool === "affordability" && (
        <section className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start" aria-label="Home affordability scenario planner">
          <div className="bg-white border border-ink/10 rounded-sm p-6 md:p-8">
            <h2 className="font-display text-2xl">Test an affordability scenario</h2>
            <p className="text-sm text-ink/55 mt-1 mb-6">Use your household numbers to estimate a planning range. This is not a lending decision.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Annual household income" value={income} onChange={value => updateInput("income", value)} prefix="$" step={5000} />
              <Input label="Monthly debt payments" value={monthlyDebt} onChange={value => updateInput("monthlyDebt", value)} prefix="$" suffix="/ mo" step={50} />
              <Input label="Cash available" value={cash} onChange={value => updateInput("cash", value)} prefix="$" step={5000} />
              <Input label="Down-payment target" value={downPercent} onChange={value => updateInput("downPercent", value)} suffix="%" />
              <Input label="Interest rate assumption" disabled={noLoan} value={rate} onChange={value => updateInput("rate", value)} suffix="%" step={0.125} />
              <Input label="Debt-to-income planning assumption" value={dti} onChange={value => updateInput("dti", value)} suffix="%" />
              <Input label="Assumed annual tax (% of price)" value={taxRate} onChange={value => updateInput("taxRate", value)} suffix="% / yr" step={0.05} />
              <Input label="Insurance estimate" value={insurance} onChange={value => updateInput("insurance", value)} prefix="$" suffix="/ mo" step={25} />
              <Input label="Flood estimate" value={flood} onChange={value => updateInput("flood", value)} prefix="$" suffix="/ mo" step={25} />
              <Input label="HOA / condo target" value={hoa} onChange={value => updateInput("hoa", value)} prefix="$" suffix="/ mo" step={25} />
              <Input label="CDD / other assessments" value={cdd} onChange={value => updateInput("cdd", value)} prefix="$" suffix="/ mo" />
              <Input label="Loan term" value={years} onChange={value => updateInput("years", value)} disabled={noLoan} suffix="whole years" />
              <Input label="PMI rate assumption" value={pmiRate} onChange={value => updateInput("pmiRate", value)} disabled={noPmi} suffix="% / yr" step={0.1} />
              <Input label="Housing-income planning assumption" value={housingPercent} onChange={value => updateInput("housingPercent", value)} suffix="%" />
              <Input label="Closing costs before credits" value={closingCosts} onChange={value => updateInput("closingCosts", value)} prefix="$" />
              <Input label="Confirmed closing credits (0 if none)" value={closingCredits} onChange={value => updateInput("closingCredits", value)} prefix="$" />
            </div>
          </div>
          <div className="bg-tide text-sand rounded-sm p-6 md:p-7" data-calculator="buyer-budget-summary">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Purchase budget under your assumptions</p>
            <p className="font-display text-4xl mt-2">{budget?.cashShortfall ? "Cash shortfall" : budget?.affordablePrice !== null && budget?.affordablePrice !== undefined ? money.format(budget.affordablePrice) : "Not calculated"}</p>
            <BuyerInputWarnings review={affordabilityReview} />
            {budget && <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><span>Monthly housing budget</span><span>{money.format(budget.maxHousing)}</span></div>
              <div className="flex justify-between gap-3"><span>Closing costs after credits</span><span>{money.format(budget.netClosingCosts)}</span></div>
              <div className="flex justify-between gap-3"><span>Cash left for down payment</span><span>{money.format(budget.cashForDownPayment)}</span></div>
              {budget.cashShortfall > 0 && <p role="status" className="rounded-sm border border-brass/60 p-3">Your entered funds are short by {money.format(budget.cashShortfall)}. No purchase budget is shown until this funding gap is addressed, even with 0% down. Discuss any other funding with your lender.</p>}
              {budget.status === "model-limit" && <p>This result reaches the calculator’s $1 billion limit; it is not a verified maximum budget.</p>}
              {budget.projected && <><p className="pt-3 font-semibold">Monthly costs at this planning price</p><dl className="divide-y divide-white/20">{MONTHLY_COST_LABELS.map(([key, label]) => <div key={key} className="flex justify-between gap-3 py-2"><dt>{label}</dt><dd className="shrink-0">{money.format(budget.projected![key])}</dd></div>)}</dl><p className="font-medium">Included monthly total: {money.format(budget.projected.total)}</p></>}
            </div>}
            <p className="text-xs text-sand/85 leading-relaxed mt-5">Ratios are your planning assumptions, not lender qualification rules. Closing credits must be confirmed and apply only to entered allowable closing costs, not the down payment. No assistance program, credit limit or loan eligibility is checked.</p>
            <p className="text-xs text-sand/85 leading-relaxed mt-3">{BUYER_MODEL_LIMITS}</p>
          </div>
        </section>
      )}

      {tool === "compare" && (
        <section className="mt-6" aria-label="Property comparison">
          <div className="bg-white border border-ink/10 rounded-sm p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl">Compare up to three homes</h2>
                <p className="text-sm text-ink/60 mt-1 max-w-3xl">Check homes on the search-results page and they will load here automatically. You can still add an off-market home manually when needed.</p>
                <p className="mt-2 text-xs font-medium text-tide" aria-live="polite">
                  {loadedListings.length > 0
                    ? `${loadedListings.length} selected ${loadedListings.length === 1 ? "listing" : "listings"} loaded`
                    : "No MLS listings selected yet"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link href="/properties" className="rounded-sm border border-tide/25 px-4 py-2.5 font-medium text-tide hover:bg-tide/5">Choose homes from search</Link>
                {enteredHomes.length > 0 && (
                  <button type="button" onClick={clearAllComparisonHomes} className="px-2 py-2.5 text-ink/55 underline underline-offset-4 hover:text-hibiscus">Clear all</button>
                )}
              </div>
            </div>

            <p className="mt-5 text-xs font-medium text-tide lg:hidden">Swipe left or right to keep the homes lined up side by side.</p>
            <div className="-mx-5 mt-3 overflow-x-auto px-5 pb-3 md:-mx-7 md:px-7 lg:mx-0 lg:mt-6 lg:overflow-visible lg:px-0">
              <div className="grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(17rem,84vw)] gap-4 lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto">
                {comparisonHomes.map((home, index) => {
                  const showEntryForm = Boolean(home.sourceSlug || home.address.trim() || manualEntrySlots[index]);
                  if (!showEntryForm) {
                    return (
                      <section key={home.id} className="flex min-h-56 snap-start flex-col rounded-sm border border-dashed border-ink/20 bg-keystone/20 p-5">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-hibiscus">Home {index + 1}</p>
                        <h3 className="font-display text-xl text-ink mt-4">Choose another home</h3>
                        <p className="mt-2 text-sm leading-relaxed text-ink/55">Return to the listings and check “Compare this home.” It will fill this space automatically.</p>
                        <div className="mt-auto pt-5 space-y-2">
                          <Link href="/properties" className="block rounded-sm bg-tide px-4 py-2.5 text-center text-sm font-medium text-sand">Browse listings</Link>
                          <button
                            type="button"
                            onClick={() => setManualEntrySlots((current) => current.map((value, homeIndex) => homeIndex === index ? true : value))}
                            className="w-full px-3 py-2 text-sm text-tide underline underline-offset-4"
                          >
                            Enter an off-market home instead
                          </button>
                        </div>
                      </section>
                    );
                  }

                  return (
                    <fieldset key={home.id} className="snap-start border border-ink/10 rounded-sm bg-keystone/35 p-4">
                      <legend className="sr-only">Home {index + 1}</legend>
                      {home.image ? (
                        <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-sm bg-ink/10">
                          <Image src={home.image} alt={home.address} fill sizes="(max-width: 1024px) 84vw, 33vw" className="object-cover" />
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-hibiscus">Home {index + 1}</p>
                          {home.sourceSlug ? <Link href={`/properties/${home.sourceSlug}`} className="text-xs text-tide underline">View loaded MLS listing</Link> : <p className="text-xs text-ink/50">Manual / off-market entry</p>}
                        </div>
                        <button type="button" onClick={() => clearComparisonHome(index)} className="text-xs text-ink/55 underline hover:text-hibiscus">Clear</button>
                      </div>
                      <div className="space-y-3">
                        <ComparisonField label="Address or MLS number" value={home.address} onChange={(value) => updateComparisonHome(index, "address", value)} placeholder="123 Main St or MLS R12345678" />
                        <div className="grid grid-cols-2 gap-3">
                          <ComparisonField label="Price" value={home.price} onChange={(value) => updateComparisonHome(index, "price", value)} type="number" prefix="$" step="1" />
                          <ComparisonField label="Living area" value={home.sqft} onChange={(value) => updateComparisonHome(index, "sqft", value)} type="number" placeholder="Sq. ft." step="1" />
                          <ComparisonField label="Bedrooms" value={home.beds} onChange={(value) => updateComparisonHome(index, "beds", value)} type="number" step="1" />
                          <ComparisonField label="Bathrooms" value={home.baths} onChange={(value) => updateComparisonHome(index, "baths", value)} type="number" step="0.5" />
                          <ComparisonField label="Year built" value={home.yearBuilt} onChange={(value) => updateComparisonHome(index, "yearBuilt", value)} type="number" step="1" />
                          <ComparisonField label="HOA / month" value={home.hoa} onChange={(value) => updateComparisonHome(index, "hoa", value)} type="number" prefix="$" step="1" />
                        </div>
                        <ComparisonField label="Notes" value={home.notes} onChange={(value) => updateComparisonHome(index, "notes", value)} placeholder="Pool, waterfront, repairs, deal breakers…" />
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            </div>
          </div>

          {enteredHomes.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-tide lg:hidden">Swipe the table left or right to compare each home across the same row.</p>
              <div className="overflow-x-auto rounded-sm border border-ink/10 bg-white" tabIndex={0} aria-label="Side-by-side property comparison table">
                <table className="w-full min-w-max table-fixed text-sm">
                  <thead><tr className="bg-tide text-sand"><th className="sticky left-0 z-20 w-36 min-w-36 bg-tide p-4 text-left font-medium">Comparison</th>{enteredHomes.map((home) => <th key={home.id} className="w-64 min-w-64 p-4 text-left font-medium">{home.address}</th>)}</tr></thead>
                  <tbody className="divide-y divide-ink/10">
                    {[
                      ["Price", (home: ComparisonHome) => positiveNumber(home.price) ? money.format(positiveNumber(home.price)) : "Not entered"],
                      ["Price per sq. ft.", (home: ComparisonHome) => positiveNumber(home.price) && positiveNumber(home.sqft) ? money.format(positiveNumber(home.price) / positiveNumber(home.sqft)) : "Not entered"],
                      ["Bedrooms / bathrooms", (home: ComparisonHome) => home.beds || home.baths ? `${home.beds || "—"} / ${home.baths || "—"}` : "Not entered"],
                      ["Living area", (home: ComparisonHome) => positiveNumber(home.sqft) ? `${positiveNumber(home.sqft).toLocaleString()} sq. ft.` : "Not entered"],
                      ["HOA / month", (home: ComparisonHome) => !home.hoa.trim() ? "Not entered" : planningNumber(home.hoa) === null ? "Check entry" : money.format(planningNumber(home.hoa)!)],
                      ["Year built", (home: ComparisonHome) => home.yearBuilt || "Not entered"],
                      ["Notes", (home: ComparisonHome) => home.notes || "None entered"],
                    ].map(([label, getValue]) => <tr key={label as string}><th className="sticky left-0 z-10 w-36 min-w-36 bg-keystone p-4 text-left font-medium text-ink/60">{label as string}</th>{enteredHomes.map((home) => <td key={home.id} className="w-64 min-w-64 p-4 align-top">{(getValue as (item: ComparisonHome) => string)(home)}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-5 p-8 border border-dashed border-ink/20 text-center text-ink/55">
              <p>Choose homes from the listing search, or use an off-market entry option above.</p>
              <Link href="/properties" className="inline-block mt-3 text-tide underline underline-offset-4">Browse homes to compare</Link>
            </div>
          )}
        </section>
      )}

      <section className="mt-12 grid lg:grid-cols-2 gap-8 items-start border-t border-ink/10 pt-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">Keep the scenario</p>
          <h2 className="font-display text-3xl mt-2">Want Roque to review these numbers?</h2>
          <p className="text-ink/65 mt-3 max-w-lg">Send the current assumptions to Florida Southeast Realty. We can flag property costs worth verifying, compare homes, or help narrow the search.</p>
          <ReportActions title="Buyer planning worksheet" report={scenarioSummary} />
          <details className="mt-5 bg-keystone p-4 rounded-sm text-sm text-ink/65"><summary className="font-medium text-ink cursor-pointer">Review the full worksheet</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans">{scenarioSummary}</pre></details>
          <Link href="/planning/buy" className="mt-4 inline-block text-sm text-tide underline">Build a property checklist, visit plan or Loan Estimate comparison</Link>
        </div>
        <PlanHandoff formName="buyer-tools-review" title="Send this worksheet to Roque" summary={scenarioSummary} successMessage="Your complete buyer worksheet and reply preferences are saved for Roque to review." />
      </section>
    </div>
  );
}
