"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ListingsMap, { type MapListing } from "@/components/ListingsMap";
import type { ListingFilters, ListingSort } from "@/lib/types";

type MapBounds = NonNullable<ListingFilters["bounds"]>;

export default function PropertyResultsView({
  children,
  listings,
  initialView,
  initialBounds,
  initialSort,
}: {
  children: ReactNode;
  listings: MapListing[];
  initialView?: "list" | "map";
  initialBounds?: MapBounds;
  initialSort?: ListingSort;
}) {
  const [view, setView] = useState<"list" | "map">(initialView ?? "list");
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
    || requestedSort === "newest"
    ? requestedSort
    : initialSort ?? "newest";

  function selectView(nextView: "list" | "map") {
    setView(nextView);
    const query = new URLSearchParams(searchParams.toString());
    if (nextView === "map") query.set("view", "map");
    else query.delete("view");
    const target = `${pathname}${query.size ? `?${query.toString()}` : ""}#property-results`;
    router.replace(target, { scroll: false });
  }

  function clearMapArea() {
    const query = new URLSearchParams(searchParams.toString());
    for (const key of ["north", "south", "east", "west", "page"]) query.delete(key);
    if (view === "map") query.set("view", "map");
    else query.delete("view");
    router.push(`${pathname}${query.size ? `?${query.toString()}` : ""}#property-results`);
  }

  function selectSort(nextSort: ListingSort) {
    const query = new URLSearchParams(searchParams.toString());
    query.delete("page");
    if (nextSort === "newest") query.delete("sort");
    else query.set("sort", nextSort);
    router.push(`${pathname}${query.size ? `?${query.toString()}` : ""}#property-results`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-ink">Choose how to browse</p>
          <p className="text-xs text-ink/55">
            {view === "list"
              ? "Each card is a preview—open it to swipe through every available MLS photo."
              : `${mappableListings.length} homes on this results page include a map location.`}
          </p>
          {initialBounds ? (
            <button type="button" onClick={clearMapArea} className="mt-1 text-xs font-medium text-hibiscus underline underline-offset-4">
              Map-area filter active · Clear area
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-3 self-start">
          <label className="text-xs font-medium text-ink/60" htmlFor="property-sort">
            Sort homes
            <select
              id="property-sort"
              value={selectedSort}
              onChange={(event) => selectSort(event.target.value as ListingSort)}
              className="mt-1 block min-w-52 rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-tide"
            >
              <option value="newest">Newest / recently updated</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="sqft-desc">Square footage: largest first</option>
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
          <ListingsMap listings={mappableListings} initialBounds={initialBounds} />
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
