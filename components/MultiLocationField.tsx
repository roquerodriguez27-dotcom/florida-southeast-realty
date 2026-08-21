"use client";

import { useState } from "react";
import {
  MAX_SEARCH_LOCATIONS,
  SOUTH_FLORIDA_COUNTIES,
  SOUTH_FLORIDA_LOCATION_NAMES,
} from "@/lib/south-florida-locations";

function splitLocations(value: string): string[] {
  return value
    .split(/[,;|\n]/)
    .map((location) => location.trim())
    .filter(Boolean);
}

export default function MultiLocationField({ initialLocations }: { initialLocations: string[] }) {
  const [locations, setLocations] = useState(() => initialLocations.slice(0, MAX_SEARCH_LOCATIONS));
  const [draft, setDraft] = useState("");
  const [activeCounty, setActiveCounty] = useState(() => {
    const initial = new Set(initialLocations.map((location) => location.toLowerCase()));
    return SOUTH_FLORIDA_COUNTIES.find((county) => (
      county.cities.some((city) => initial.has(city.toLowerCase()))
    ))?.name ?? SOUTH_FLORIDA_COUNTIES[0].name;
  });

  function addLocations(additions: string[]) {
    if (additions.length === 0) return;
    setLocations((current) => {
      const next = [...current];
      for (const addition of additions) {
        if (next.length >= MAX_SEARCH_LOCATIONS) break;
        if (!next.some((location) => location.toLowerCase() === addition.toLowerCase())) {
          next.push(addition);
        }
      }
      return next;
    });
  }

  function addDraft() {
    const additions = splitLocations(draft);
    if (additions.length === 0) return;

    addLocations(additions);
    setDraft("");
  }

  function removeLocation(value: string) {
    setLocations((current) => current.filter((location) => location !== value));
  }

  function toggleLocation(value: string) {
    if (locations.some((location) => location.toLowerCase() === value.toLowerCase())) {
      removeLocation(value);
    } else {
      addLocations([value]);
    }
  }

  const atLimit = locations.length >= MAX_SEARCH_LOCATIONS;
  const county = SOUTH_FLORIDA_COUNTIES.find((item) => item.name === activeCounty) ?? SOUTH_FLORIDA_COUNTIES[0];

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-sm border border-ink/15 bg-white px-2 py-1.5 focus-within:border-tide">
        {locations.map((location) => (
          <span key={location.toLowerCase()} className="inline-flex items-center gap-1 rounded-full bg-tide/8 px-2.5 py-1 text-xs font-medium text-tide">
            {location}
            <button
              type="button"
              onClick={() => removeLocation(location)}
              className="grid h-4 w-4 place-items-center rounded-full text-sm leading-none text-tide/60 hover:bg-tide/10 hover:text-hibiscus"
              aria-label={`Remove ${location}`}
            >
              ×
            </button>
            <input type="hidden" name="location" value={location} />
          </span>
        ))}
        <input
          id="f-location"
          name="location"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addDraft();
            } else if (event.key === "Backspace" && draft === "" && locations.length > 0) {
              setLocations((current) => current.slice(0, -1));
            }
          }}
          type="text"
          list="fsre-location-suggestions"
          placeholder={atLimit ? "Area limit reached" : locations.length > 0 ? "Type another city or community" : "Type a city, community, or ZIP"}
          disabled={atLimit}
          autoComplete="off"
          aria-describedby="f-location-help"
          className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed"
        />
        <datalist id="fsre-location-suggestions">
          {SOUTH_FLORIDA_LOCATION_NAMES.map((location) => <option key={location} value={location} />)}
        </datalist>
      </div>
      <p id="f-location-help" className="mt-1.5 text-[11px] leading-relaxed text-ink/50">
        Add multiple cities, neighborhoods, ZIP codes, or communities. Separate pasted areas with commas, or press Enter after each one.
      </p>
      <div className="mt-3 rounded-sm border border-ink/10 bg-sand/60 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="f-location-county" className="text-[11px] font-mono uppercase tracking-wide text-ink/55">
            Browse cities by county
          </label>
          <select
            id="f-location-county"
            value={activeCounty}
            onChange={(event) => setActiveCounty(event.target.value as typeof activeCounty)}
            className="rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-tide outline-none"
          >
            {SOUTH_FLORIDA_COUNTIES.map((item) => (
              <option key={item.name} value={item.name}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1" role="group" aria-label={`Cities in ${county.name}`}>
          {county.cities.map((city) => {
            const selected = locations.some((location) => location.toLowerCase() === city.toLowerCase());
            return (
              <button
                key={city}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleLocation(city)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${selected ? "border-tide bg-tide text-sand" : "border-tide/15 bg-white text-tide hover:border-tide/35 hover:bg-tide/5"}`}
              >
                {selected ? "✓ " : ""}{city}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-ink/50">Select cities from any county, then switch counties to keep adding more.</p>
      </div>
      {atLimit ? (
        <p className="mt-2 text-xs text-hibiscus" role="status">
          Twenty areas are selected. Remove one before adding another so the MLS search stays fast and reliable.
        </p>
      ) : null}
    </div>
  );
}
