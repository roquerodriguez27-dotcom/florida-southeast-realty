"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import MultiLocationField from "@/components/MultiLocationField";
import type { ListingAmenity, ListingFilters, ListingSort } from "@/lib/types";

type QuickFilterId = "price" | "beds-baths" | "home-type";

interface CurrentFilters {
  locations: string[];
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  beds?: string;
  baths?: string;
  minSqft?: string;
  maxSqft?: string;
  minLotSqft?: string;
  maxLotSqft?: string;
  minYearBuilt?: string;
  maxYearBuilt?: string;
  listingStatus?: string;
  type?: string;
  waterfront?: string;
  pool?: string;
  garage?: string;
  garageSpaces?: string;
  newConstruction?: string;
  senior?: string;
  noHoa?: string;
  maxHoa?: string;
  priceReduced?: string;
  maxTaxes?: string;
  style?: string;
  viewType?: string;
  cooling?: string;
  heating?: string;
  fireplace?: string;
  amenities: ListingAmenity[];
  maxDom?: string;
  bounds?: NonNullable<ListingFilters["bounds"]>;
  shape?: string;
  view?: "map";
  sort?: ListingSort;
}

function compactPrice(value?: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${amount.toLocaleString()}`;
}

function FilterMenu({
  id,
  label,
  value,
  open,
  onToggle,
  onClose,
  children,
}: {
  id: QuickFilterId;
  label: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = `property-filter-${id}`;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onClose();
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex min-h-11 items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium transition-colors ${value ? "border-tide bg-tide/5 text-tide" : "border-ink/15 bg-white text-ink/75 hover:border-tide/30"}`}
      >
        <span>{value || label}</span>
        <span aria-hidden className={`text-xs opacity-50 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={`${label} filters`}
          className="absolute left-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-ink/10 bg-white p-4 shadow-xl sm:left-auto sm:right-0"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function NumberField({ id, name, label, value, placeholder }: { id: string; name: string; label: string; value?: string; placeholder: string }) {
  return (
    <label htmlFor={id} className="text-xs font-medium text-ink/60">
      {label}
      <input
        id={id}
        name={name}
        defaultValue={value ?? ""}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1 w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-tide"
      />
    </label>
  );
}

function SelectField({
  id,
  name,
  label,
  value,
  children,
}: {
  id: string;
  name: string;
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <label className="text-xs font-medium text-ink/60" htmlFor={id}>
      {label}
      <select
        id={id}
        name={name}
        defaultValue={value ?? ""}
        className="mt-1 w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-tide"
      >
        {children}
      </select>
    </label>
  );
}

function Amenity({ name, label, checked, value = "1" }: { name: string; label: string; checked: boolean; value?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-ink/10 bg-white px-3 py-2 text-sm text-ink/75 hover:border-tide/25">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-4 w-4 accent-hibiscus" />
      {label}
    </label>
  );
}

function SeniorCommunityOption({
  value,
  label,
  checked,
}: {
  value: "" | "only" | "exclude";
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-ink/10 bg-white px-3 py-2 text-sm text-ink/75 hover:border-tide/25">
      <input
        type="radio"
        name="senior"
        value={value}
        defaultChecked={checked}
        className="h-4 w-4 accent-hibiscus"
      />
      {label}
    </label>
  );
}

function basicFiltersHref(current: CurrentFilters): string {
  const query = new URLSearchParams();
  for (const location of current.locations) query.append("location", location);
  for (const [key, value] of [
    ["minPrice", current.minPrice],
    ["maxPrice", current.maxPrice],
    ["beds", current.beds],
    ["baths", current.baths],
    ["type", current.type],
    ["shape", current.shape],
    ["view", current.view],
    ["sort", current.sort === "newest" ? undefined : current.sort],
  ] as const) {
    if (value) query.set(key, value);
  }
  if (current.bounds) {
    query.set("north", String(current.bounds.north));
    query.set("south", String(current.bounds.south));
    query.set("east", String(current.bounds.east));
    query.set("west", String(current.bounds.west));
  }
  return `/properties${query.size ? `?${query.toString()}` : ""}`;
}

export default function PropertyFilters({ current }: { current: CurrentFilters }) {
  const advancedCount = [
    current.q,
    current.minSqft,
    current.maxSqft,
    current.minLotSqft,
    current.maxLotSqft,
    current.minYearBuilt,
    current.maxYearBuilt,
    current.listingStatus,
    current.waterfront,
    current.pool,
    current.garageSpaces || current.garage,
    current.newConstruction,
    current.senior,
    current.noHoa,
    current.maxHoa,
    current.priceReduced,
    current.maxTaxes,
    current.style,
    current.viewType,
    current.cooling,
    current.heating,
    current.fireplace,
    ...current.amenities,
    current.maxDom,
  ].filter(Boolean).length;
  const [showMore, setShowMore] = useState(advancedCount > 0);
  const [openQuickFilter, setOpenQuickFilter] = useState<QuickFilterId | null>(null);
  const priceLabel = [compactPrice(current.minPrice), compactPrice(current.maxPrice)].filter(Boolean).join(" – ");
  const bedBathLabel = [current.beds ? `${current.beds}+ bd` : "", current.baths ? `${current.baths}+ ba` : ""].filter(Boolean).join(" · ");
  const garageSpaces = current.garageSpaces || (current.garage === "1" ? "1" : "");
  const closeQuickFilter = useCallback(() => setOpenQuickFilter(null), []);
  const toggleQuickFilter = useCallback((filter: QuickFilterId) => {
    setShowMore(false);
    setOpenQuickFilter((open) => open === filter ? null : filter);
  }, []);

  function toggleMoreFilters() {
    closeQuickFilter();
    setShowMore((open) => !open);
  }

  return (
    <form
      key={JSON.stringify(current)}
      action="/properties"
      method="get"
      className="rounded-sm border border-ink/10 bg-white p-3 shadow-[0_18px_50px_-42px_rgba(14,43,48,0.75)] md:p-4"
    >
      {current.bounds ? (
        <>
          <input type="hidden" name="north" value={current.bounds.north} />
          <input type="hidden" name="south" value={current.bounds.south} />
          <input type="hidden" name="east" value={current.bounds.east} />
          <input type="hidden" name="west" value={current.bounds.west} />
        </>
      ) : null}
      {current.shape ? <input type="hidden" name="shape" value={current.shape} /> : null}
      {current.view ? <input type="hidden" name="view" value={current.view} /> : null}
      {current.sort && current.sort !== "newest" ? <input type="hidden" name="sort" value={current.sort} /> : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="f-location" className="mb-1 block text-[11px] font-mono uppercase tracking-wide text-ink/50">Location</label>
          <MultiLocationField key={current.locations.join("|")} initialLocations={current.locations} />
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:pb-[1px]">
          <FilterMenu
            id="price"
            label="Price"
            value={priceLabel}
            open={openQuickFilter === "price"}
            onToggle={() => toggleQuickFilter("price")}
            onClose={closeQuickFilter}
          >
            <p className="mb-3 text-sm font-semibold text-ink">Price range</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="f-min" name="minPrice" label="Minimum" value={current.minPrice} placeholder="Any" />
              <NumberField id="f-max" name="maxPrice" label="Maximum" value={current.maxPrice} placeholder="Any" />
            </div>
          </FilterMenu>

          <FilterMenu
            id="beds-baths"
            label="Beds & baths"
            value={bedBathLabel}
            open={openQuickFilter === "beds-baths"}
            onToggle={() => toggleQuickFilter("beds-baths")}
            onClose={closeQuickFilter}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-ink/60" htmlFor="f-beds">Bedrooms
                <select id="f-beds" name="beds" defaultValue={current.beds ?? ""} className="mt-1 w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-tide">
                  <option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option><option value="5">5+</option>
                </select>
              </label>
              <label className="text-xs font-medium text-ink/60" htmlFor="f-baths">Bathrooms
                <select id="f-baths" name="baths" defaultValue={current.baths ?? ""} className="mt-1 w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-tide">
                  <option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option><option value="5">5+</option>
                </select>
              </label>
            </div>
          </FilterMenu>

          <FilterMenu
            id="home-type"
            label="Home type"
            value={current.type}
            open={openQuickFilter === "home-type"}
            onToggle={() => toggleQuickFilter("home-type")}
            onClose={closeQuickFilter}
          >
            <label className="text-xs font-medium text-ink/60" htmlFor="f-type">Property type
              <select id="f-type" name="type" defaultValue={current.type ?? ""} onChange={closeQuickFilter} className="mt-1 w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-tide">
                <option value="">Any home type</option>
                <option value="Single Family">Single Family</option><option value="Condo">Condo</option><option value="Townhome">Townhome</option><option value="Estate">Estate</option><option value="Multi-Family">Multi-Family</option><option value="Land">Land</option><option value="Commercial">Commercial</option>
              </select>
            </label>
          </FilterMenu>

          <button type="button" aria-expanded={showMore} onClick={toggleMoreFilters} className={`min-h-11 rounded-sm border px-3 py-2 text-sm font-medium ${showMore || advancedCount ? "border-tide bg-tide/5 text-tide" : "border-ink/15 bg-white text-ink/75 hover:border-tide/30"}`}>
            More filters{advancedCount ? ` (${advancedCount})` : ""}
          </button>
          <button type="submit" className="min-h-11 rounded-sm bg-hibiscus px-5 py-2 text-sm font-semibold text-sand transition-colors hover:bg-hibiscus-dark">Search homes</button>
        </div>
      </div>

      {showMore ? (
        <div className="mt-4 overflow-hidden rounded-sm border border-ink/10 bg-sand/35">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 bg-white px-4 py-4 md:px-5">
            <div>
              <h2 className="font-display text-xl text-ink">More filters</h2>
              <p className="mt-0.5 text-xs text-ink/55">Choose exact MLS criteria. Blank fields mean no limit.</p>
            </div>
            <button type="button" onClick={() => setShowMore(false)} className="rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink/70 hover:border-tide/30" aria-label="Close more filters">Done</button>
          </div>

          <div className="grid gap-3 p-3 md:grid-cols-2 md:p-4 xl:grid-cols-4">
            <section className="rounded-sm border border-ink/10 bg-white p-4">
              <h3 className="text-sm font-semibold text-ink">Listing &amp; activity</h3>
              <p className="mt-1 text-xs text-ink/50">Status, listing age, and price opportunities.</p>
              <div className="mt-3 grid gap-3">
                <label htmlFor="f-q" className="text-xs font-medium text-ink/60">Address, subdivision, or MLS number
                  <input id="f-q" name="q" defaultValue={current.q} type="text" placeholder="Address, community, or MLS #" className="mt-1 w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-tide" />
                </label>
                <SelectField id="f-listing-status" name="listingStatus" label="Listing status" value={current.listingStatus}>
                  <option value="">Active, coming soon &amp; under contract</option>
                  <option value="active">Active only</option>
                  <option value="coming-soon">Coming soon only</option>
                  <option value="under-contract">Under contract only</option>
                </SelectField>
                <SelectField id="f-max-dom" name="maxDom" label="Time on market" value={current.maxDom}>
                  <option value="">Any</option><option value="1">Listed today</option><option value="7">7 days or less</option><option value="14">14 days or less</option><option value="30">30 days or less</option><option value="60">60 days or less</option><option value="90">90 days or less</option>
                </SelectField>
                <Amenity name="priceReduced" label="Price reduced" checked={current.priceReduced === "1"} />
              </div>
            </section>

            <section className="rounded-sm border border-ink/10 bg-white p-4">
              <h3 className="text-sm font-semibold text-ink">Size, lot &amp; age</h3>
              <p className="mt-1 text-xs text-ink/50">Choose ranges directly from MLS measurements.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumberField id="f-min-sqft" name="minSqft" label="Min. living area" value={current.minSqft} placeholder="Sq. ft." />
                <NumberField id="f-max-sqft" name="maxSqft" label="Max. living area" value={current.maxSqft} placeholder="Sq. ft." />
                <NumberField id="f-min-lot-sqft" name="minLotSqft" label="Min. lot size" value={current.minLotSqft} placeholder="Sq. ft." />
                <NumberField id="f-max-lot-sqft" name="maxLotSqft" label="Max. lot size" value={current.maxLotSqft} placeholder="Sq. ft." />
                <NumberField id="f-min-year-built" name="minYearBuilt" label="Built from" value={current.minYearBuilt} placeholder="Any year" />
                <NumberField id="f-max-year-built" name="maxYearBuilt" label="Built through" value={current.maxYearBuilt} placeholder="Any year" />
                <div className="col-span-2">
                  <SelectField id="f-garage-spaces" name="garageSpaces" label="Garage spaces" value={garageSpaces}>
                    <option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option>
                  </SelectField>
                </div>
              </div>
            </section>

            <section className="rounded-sm border border-ink/10 bg-white p-4">
              <h3 className="text-sm font-semibold text-ink">Community &amp; costs</h3>
              <p className="mt-1 text-xs text-ink/50">Age restrictions, association fees, and taxes.</p>
              <fieldset className="mt-3">
                <legend className="text-xs font-medium text-ink/60">55+ communities</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1 2xl:grid-cols-3">
                  <SeniorCommunityOption value="" label="Any age" checked={!current.senior} />
                  <SeniorCommunityOption value="only" label="55+ only" checked={current.senior === "only"} />
                  <SeniorCommunityOption value="exclude" label="Exclude 55+" checked={current.senior === "exclude"} />
                </div>
              </fieldset>
              <div className="mt-2">
                <Amenity name="noHoa" label="No HOA / association" checked={current.noHoa === "1"} />
              </div>
              <div className="mt-3 text-xs font-medium text-ink/60">
                <label htmlFor="f-max-hoa">Maximum HOA / association fee</label>
                <div className="relative mt-1">
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink/45">$</span>
                  <input id="f-max-hoa" name="maxHoa" defaultValue={current.maxHoa ?? ""} type="number" min="1" step="1" inputMode="numeric" placeholder="Any" autoComplete="off" className="w-full rounded-sm border border-ink/15 bg-white py-2.5 pl-7 pr-20 text-sm outline-none focus:border-tide" />
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink/45">/ month</span>
                </div>
              </div>
              <div className="mt-3 text-xs font-medium text-ink/60">
                <label htmlFor="f-max-taxes">Maximum annual property taxes</label>
                <div className="relative mt-1">
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink/45">$</span>
                  <input id="f-max-taxes" name="maxTaxes" defaultValue={current.maxTaxes ?? ""} type="number" min="1" step="1" inputMode="numeric" placeholder="Any" autoComplete="off" className="w-full rounded-sm border border-ink/15 bg-white py-2.5 pl-7 pr-16 text-sm outline-none focus:border-tide" />
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink/45">/ year</span>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink/45">Fee frequency is normalized monthly. Tax amounts use the most recent year supplied by BeachesMLS.</p>
            </section>

            <section className="rounded-sm border border-ink/10 bg-white p-4">
              <h3 className="text-sm font-semibold text-ink">Style, view &amp; systems</h3>
              <p className="mt-1 text-xs text-ink/50">Structured RESO characteristics—not marketing tags.</p>
              <div className="mt-3 grid gap-3">
                <SelectField id="f-style" name="style" label="Architectural style" value={current.style}>
                  <option value="">Any style</option><option value="ranch">Ranch</option><option value="contemporary">Contemporary</option><option value="mediterranean">Mediterranean</option><option value="modern">Modern</option><option value="traditional">Traditional</option>
                </SelectField>
                <SelectField id="f-view-type" name="viewType" label="View" value={current.viewType}>
                  <option value="">Any view</option><option value="water">Water</option><option value="golf">Golf course</option><option value="garden">Garden</option><option value="pool">Pool</option><option value="city">City / skyline</option>
                </SelectField>
                <SelectField id="f-cooling" name="cooling" label="Cooling" value={current.cooling}>
                  <option value="">Any cooling</option><option value="central-air">Central air</option><option value="ceiling-fans">Ceiling fans</option><option value="wall-window">Wall / window units</option>
                </SelectField>
                <SelectField id="f-heating" name="heating" label="Heating" value={current.heating}>
                  <option value="">Any heating</option><option value="central">Central</option><option value="electric">Electric</option><option value="heat-pump">Heat pump</option><option value="gas">Gas / propane</option>
                </SelectField>
              </div>
            </section>
          </div>

          <section className="border-t border-ink/10 bg-white p-4 md:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">Features &amp; community amenities</h3>
                <p className="mt-1 text-xs text-ink/50">Every selection is matched against fields supplied by BeachesMLS.</p>
              </div>
              <p className="rounded-full bg-tide/5 px-3 py-1 text-[10px] font-mono uppercase tracking-wide text-tide">MLS-powered</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <Amenity name="pool" label="Private pool" checked={current.pool === "1"} />
              <Amenity name="waterfront" label="Waterfront" checked={current.waterfront === "1"} />
              <Amenity name="amenity" value="boat-dock" label="Boat dock / marina" checked={current.amenities.includes("boat-dock")} />
              <Amenity name="amenity" value="spa" label="Spa / hot tub" checked={current.amenities.includes("spa")} />
              <Amenity name="amenity" value="impact-windows" label="Impact windows" checked={current.amenities.includes("impact-windows")} />
              <Amenity name="newConstruction" label="New construction" checked={current.newConstruction === "1"} />
              <Amenity name="fireplace" label="Fireplace" checked={current.fireplace === "1"} />
              <Amenity name="amenity" value="horse-property" label="Horse / equestrian" checked={current.amenities.includes("horse-property")} />
              <Amenity name="amenity" value="community-pool" label="Community pool" checked={current.amenities.includes("community-pool")} />
              <Amenity name="amenity" value="gated-community" label="Gated community" checked={current.amenities.includes("gated-community")} />
              <Amenity name="amenity" value="golf-community" label="Golf community" checked={current.amenities.includes("golf-community")} />
              <Amenity name="amenity" value="clubhouse" label="Clubhouse" checked={current.amenities.includes("clubhouse")} />
              <Amenity name="amenity" value="fitness-center" label="Fitness center" checked={current.amenities.includes("fitness-center")} />
              <Amenity name="amenity" value="pickleball" label="Pickleball" checked={current.amenities.includes("pickleball")} />
              <Amenity name="amenity" value="tennis" label="Tennis courts" checked={current.amenities.includes("tennis")} />
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 bg-white px-4 py-4 md:px-5">
            <Link href={basicFiltersHref(current)} className="text-sm font-medium text-tide underline underline-offset-4">Reset more filters</Link>
            <button type="submit" className="rounded-sm bg-tide px-6 py-2.5 text-sm font-semibold text-sand hover:bg-tide-light">Show matching homes</button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
