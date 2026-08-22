"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ListingsMap, { type MapListing } from "@/components/ListingsMap";
import type { ListingFilters, ListingSort } from "@/lib/types";

type MapBounds = NonNullable<ListingFilters["bounds"]>;

export default function PropertyResultsView({
  children,
  listings,
  initialView,
  initialBounds,
  initialShape,
  initialSort,
}: {
  children: ReactNode;
  listings: MapListing[];
  initialView?: "list" | "map";
  initialBounds?: MapBounds;
  initialShape?: NonNullable<ListingFilters["polygon"]>;
  initialSort?: ListingSort;
}) {
  const [view, setView] = useState<"list" | "map">(initialView ?? "list");
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mappableListings = listings.filter((listing) => (
    Number.isFinite(listing.lat)
    && Number.isFinite(listing.lng)
    && (listing.lat !== 0 || listing.lng !== 0)
  ));
  const requestedSort = searchParams.get("sort");
  const selectedSort: ListingSort = requestedSort === "price-asc"
    || requestedSort === "price-desc"
    || requestedSort === "sqft-desc"
    || requestedSort === "sqft-asc"
    || requestedSort === "lot-desc"
    || requestedSort === "dom-asc"
    || requestedSort === "dom-desc"
    || requestedSort === "newest"
    ? requestedSort
    : initialSort ?? "newest";

  function selectView(nextView: "list" | "map") {
    setView(nextView);
    const query = new URLSearchParams(searchParams.toString());
    if (nextView === "map") query.set("view", "map");
    else query.delete("view");
    const target = `${pathname}${query.size ? `?${query.toString()}` : ""}#property-results`;
    startTransition(() => router.replace(target, { scroll: false }));
  }

  function clearMapArea() {
    const query = new URLSearchParams(searchParams.toString());
    for (const key of ["north", "south", "east", "west", "shape", "page"]) query.delete(key);
    if (view === "map") query.set("view", "map");
    else query.delete("view");
    startTransition(() => router.push(`${pathname}${query.size ? `?${query.toString()}` : ""}#property-results`));
  }

  function selectSort(nextSort: ListingSort) {
    const query = new URLSearchParams(searchParams.toString());
    query.delete("page");
    if (nextSort === "newest") query.delete("sort");
    else query.set("sort", nextSort);
    startTransition(() => router.push(`${pathname}${query.size ? `?${query.toString()}` : ""}#property-results`, { scroll: false }));
  }

  return (
    <div aria-busy={isPending}>
      <div className="mb-5 flex flex-col justify-between gap-4 rounded-sm border border-tide/15 bg-white p-4 shadow-[0_16px_45px_-38px_rgba(14,43,48,0.8)] sm:flex-row sm:items-center md:p-5">
        <div>
          <p className="font-display text-xl text-ink">Sort &amp; view results</p>
          <p className="mt-1 text-xs text-ink/55">
            {view === "list"
              ? `${listings.length} ${listings.length === 1 ? "home" : "homes"} shown on this page. Your location and filters stay selected when you reorder them.`
              : `${mappableListings.length} homes on this results page include a map location.`}
          </p>
          {initialBounds ? (
            <button type="button" onClick={clearMapArea} className="mt-1 text-xs font-medium text-hibiscus underline underline-offset-4">
              {initialShape ? "Drawn-area filter active" : "Map-area filter active"} · Clear area
            </button>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap items-end gap-3 self-start sm:w-auto">
          <label className="min-w-[15rem] flex-1 text-[11px] font-mono uppercase tracking-wide text-ink/55 sm:flex-none" htmlFor="property-sort">
            Sort by
            <select
              id="property-sort"
              value={selectedSort}
              onChange={(event) => selectSort(event.target.value as ListingSort)}
              disabled={isPending}
              className="mt-1 block w-full rounded-sm border border-tide/20 bg-sand/35 px-3 py-2.5 font-sans text-sm normal-case tracking-normal text-ink outline-none focus:border-tide disabled:cursor-wait disabled:opacity-60"
            >
              <option value="newest">Newest / recently updated</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="sqft-desc">Square footage: largest first</option>
              <option value="sqft-asc">Square footage: smallest first</option>
              <option value="lot-desc">Lot size: largest first</option>
              <option value="dom-asc">Days on market: newest first</option>
              <option value="dom-desc">Days on market: longest first</option>
            </select>
          </label>
          <div className="inline-grid grid-cols-2 rounded-sm border border-tide/20 bg-white p-1" role="group" aria-label="Property results view">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => selectView("list")}
            className={`min-w-24 rounded-sm px-4 py-2 text-sm font-medium ${view === "list" ? "bg-tide text-sand" : "text-tide hover:bg-tide/5"}`}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === "map"}
            onClick={() => selectView("map")}
            className={`min-w-24 rounded-sm px-4 py-2 text-sm font-medium ${view === "map" ? "bg-tide text-sand" : "text-tide hover:bg-tide/5"}`}
          >
            Map
          </button>
          </div>
        </div>
      </div>

      {view === "list" ? children : null}
      {view === "map" ? (
        mappableListings.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)] xl:items-start">
            <div className="xl:sticky xl:top-28">
              <ListingsMap listings={mappableListings} initialBounds={initialBounds} initialShape={initialShape} />
            </div>
            <div className="xl:max-h-[76vh] xl:overflow-y-auto xl:pr-1" aria-label="Homes in the current map area">
              {children}
            </div>
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-ink/20 bg-white p-10 text-center">
            <p className="font-display text-xl text-ink">These results do not include map coordinates.</p>
            <p className="mt-2 text-sm text-ink/55">Use the list view to open the available homes.</p>
          </div>
        )
      ) : null}
    </div>
  );
}
