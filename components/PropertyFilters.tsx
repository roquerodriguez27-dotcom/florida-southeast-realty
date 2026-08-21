"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import MultiLocationField from "@/components/MultiLocationField";
import type { ListingFilters, ListingSort } from "@/lib/types";

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
  minYearBuilt?: string;
  type?: string;
  waterfront?: string;
  pool?: string;
  garage?: string;
  newer?: string;
  spacious?: string;
  largeLot?: string;
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

function FilterMenu({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <details className="group relative">
      <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden ${value ? "border-tide bg-tide/5 text-tide" : "border-ink/15 bg-white text-ink/75 hover:border-tide/30"}`}>
        <span>{value || label}</span>
        <span aria-hidden className="text-xs opacity-50 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="absolute left-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-ink/10 bg-white p-4 shadow-xl sm:left-auto sm:right-0">
        {children}
      </div>
    </details>
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

function Amenity({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-ink/10 bg-white px-3 py-2 text-sm text-ink/75 hover:border-tide/25">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="h-4 w-4 accent-hibiscus" />
      {label}
    </label>
  );
}

export default function PropertyFilters({ current }: { current: CurrentFilters }) {
  const advancedCount = [
    current.q,
    current.minSqft,
    current.maxSqft,
    current.minLotSqft,
    current.minYearBuilt,
    current.waterfront,
    current.pool,
    current.garage,
    current.newer,
    current.spacious,
    current.largeLot,
  ].filter(Boolean).length;
  const [showMore, setShowMore] = useState(advancedCount > 0);
  const priceLabel = [compactPrice(current.minPrice), compactPrice(current.maxPrice)].filter(Boolean).join(" – ");
  const bedBathLabel = [current.beds ? `${current.beds}+ bd` : "", current.baths ? `${current.baths}+ ba` : ""].filter(Boolean).join(" · ");

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
          <FilterMenu label="Price" value={priceLabel}>
            <p className="mb-3 text-sm font-semibold text-ink">Price range</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="f-min" name="minPrice" label="Minimum" value={current.minPrice} placeholder="Any" />
              <NumberField id="f-max" name="maxPrice" label="Maximum" value={current.maxPrice} placeholder="Any" />
            </div>
          </FilterMenu>

          <FilterMenu label="Beds & baths" value={bedBathLabel}>
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

          <FilterMenu label="Home type" value={current.type}>
            <label className="text-xs font-medium text-ink/60" htmlFor="f-type">Property type
              <select id="f-type" name="type" defaultValue={current.type ?? ""} className="mt-1 w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-tide">
                <option value="">Any home type</option>
                <option value="Single Family">Single Family</option><option value="Condo">Condo</option><option value="Townhome">Townhome</option><option value="Estate">Estate</option><option value="Multi-Family">Multi-Family</option><option value="Land">Land</option><option value="Commercial">Commercial</option>
              </select>
            </label>
          </FilterMenu>

          <button type="button" aria-expanded={showMore} onClick={() => setShowMore((open) => !open)} className={`min-h-11 rounded-sm border px-3 py-2 text-sm font-medium ${showMore || advancedCount ? "border-tide bg-tide/5 text-tide" : "border-ink/15 bg-white text-ink/75 hover:border-tide/30"}`}>
            More filters{advancedCount ? ` (${advancedCount})` : ""}
          </button>
          <button type="submit" className="min-h-11 rounded-sm bg-hibiscus px-5 py-2 text-sm font-semibold text-sand transition-colors hover:bg-hibiscus-dark">Search homes</button>
        </div>
      </div>

      {showMore ? (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
            <section>
              <h2 className="text-sm font-semibold text-ink">Property details</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-3">
                  <label htmlFor="f-q" className="text-xs font-medium text-ink/60">Address, ZIP, subdivision, or MLS number</label>
                  <input id="f-q" name="q" defaultValue={current.q} type="text" placeholder="Example: 2815 SW 9th Street or B26065561" className="mt-1 w-full rounded-sm border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-tide" />
                </div>
                <NumberField id="f-min-sqft" name="minSqft" label="Min. living area" value={current.minSqft} placeholder="Sq. ft." />
                <NumberField id="f-max-sqft" name="maxSqft" label="Max. living area" value={current.maxSqft} placeholder="Sq. ft." />
                <NumberField id="f-lot-sqft" name="minLotSqft" label="Min. lot size" value={current.minLotSqft} placeholder="Sq. ft." />
                <NumberField id="f-year-built" name="minYearBuilt" label="Year built after" value={current.minYearBuilt} placeholder="Any year" />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink">Popular features &amp; size</h2>
              <p className="mt-1 text-xs text-ink/50">Quick filters use live, reliably searchable BeachesMLS fields.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                <Amenity name="pool" label="Private pool" checked={current.pool === "1"} />
                <Amenity name="waterfront" label="Waterfront" checked={current.waterfront === "1"} />
                <Amenity name="garage" label="Garage" checked={current.garage === "1"} />
                <Amenity name="newer" label="Built 2020+" checked={current.newer === "1"} />
                <Amenity name="spacious" label="2,000+ sq. ft." checked={current.spacious === "1"} />
                <Amenity name="largeLot" label="10,000+ sq. ft. lot" checked={current.largeLot === "1"} />
              </div>
            </section>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
            <Link href="/properties" className="text-sm font-medium text-tide underline underline-offset-4">Clear all filters</Link>
            <button type="submit" className="rounded-sm bg-tide px-5 py-2.5 text-sm font-semibold text-sand hover:bg-tide-light">Apply filters</button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
