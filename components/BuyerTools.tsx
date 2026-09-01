"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
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

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

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
          inputMode={type === "number" ? "decimal" : undefined}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="price-field-input w-full min-w-0 bg-transparent px-2.5 py-2 text-sm outline-none"
        />
      </span>
    </label>
  );
}

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
      <span className="price-field flex items-center bg-white border border-ink/15 rounded-sm focus-within:border-tide">
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
          className="price-field-input w-full min-w-0 bg-transparent px-2.5 py-2.5 outline-none tabular-nums"
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

export default function BuyerTools({ initialListing, initialTool = "cost" }: BuyerToolsProps) {
  const [tool, setTool] = useState<Tool>(initialTool);
  const [price, setPrice] = useState(initialListing?.price ?? 600000);
  const [downPercent, setDownPercent] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);
  const [taxRate, setTaxRate] = useState(1.8);
  const [insurance, setInsurance] = useState(650);
  const [flood, setFlood] = useState(0);
  const [hoa, setHoa] = useState(initialListing?.associationFeeMonthly ?? 0);
  const [cdd, setCdd] = useState(0);
  const [pmiRate, setPmiRate] = useState(0.7);
  const [income, setIncome] = useState(150000);
  const [monthlyDebt, setMonthlyDebt] = useState(900);
  const [cash, setCash] = useState(120000);
  const [dti, setDti] = useState(36);
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

  const enteredHomes = comparisonHomes.filter((home) => home.address.trim());
  const scenarioSummary = tool === "cost"
    ? `${money.format(price)} purchase; ${downPercent}% down; ${decimal.format(rate)}% rate; ${years}-year term; ${money.format(hoa)}/mo HOA; ${money.format(insurance)}/mo insurance; ${money.format(flood)}/mo flood estimate.`
    : tool === "affordability"
      ? `${money.format(income)} annual income; ${money.format(monthlyDebt)}/mo debts; ${money.format(cash)} available cash; estimated planning range ${money.format(affordablePrice)}.`
      : `Compared properties: ${enteredHomes.map((home) => `${home.address}${positiveNumber(home.price) ? ` (${money.format(positiveNumber(home.price))})` : ""}`).join(", ") || "none entered yet"}.`;

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
                      ["HOA / month", (home: ComparisonHome) => positiveNumber(home.hoa) ? money.format(positiveNumber(home.hoa)) : "$0 or not entered"],
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
          <p className="mt-5 bg-keystone p-4 rounded-sm text-sm text-ink/65"><span className="font-medium text-ink">Current scenario:</span> {scenarioSummary}</p>
        </div>
        <LeadForm formName="buyer-tools-review" submitLabel="Send This Scenario to Roque" successMessage="Florida Southeast Realty will review your saved buyer scenario and follow up." hiddenContext={{ tool, scenario: scenarioSummary }} fields={[
          { name: "name", label: "Name", type: "text" },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "phone", label: "Phone", type: "tel" },
        ]} />
      </section>
    </div>
  );
}
