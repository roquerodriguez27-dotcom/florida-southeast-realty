"use client";

import { useMemo, useState } from "react";
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
  const [browseOpen, setBrowseOpen] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
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
  const suggestions = useMemo(() => {
    const query = draft.trim();
    if (!query || atLimit) return [];
    if (/^\d{5}$/.test(query)) return [{ value: query, context: "Exact ZIP code" }];
    if (query.length < 2 || /^\d+$/.test(query)) return [];

    const normalized = query.toLowerCase();
    return SOUTH_FLORIDA_LOCATION_NAMES
      .filter((location) => location.toLowerCase().includes(normalized))
      .filter((location) => !locations.some((selected) => selected.toLowerCase() === location.toLowerCase()))
      .slice(0, 8)
      .map((location) => {
        const matchingCounty = SOUTH_FLORIDA_COUNTIES.find((item) => item.name === location);
        const cityCounty = matchingCounty
          ? undefined
          : SOUTH_FLORIDA_COUNTIES.find((item) => item.cities.some((city) => city === location));
        return {
          value: location,
          context: matchingCounty ? "County" : cityCounty?.name ?? "City or town",
        };
      });
  }, [atLimit, draft, locations]);
  const suggestionsOpen = fieldFocused && suggestions.length > 0;
  const visibleCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    return query ? county.cities.filter((city) => city.toLowerCase().includes(query)) : county.cities;
  }, [cityQuery, county.cities]);

  return (
    <div>
      <div className="relative">
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
            name={draft.trim() ? "location" : undefined}
            value={draft}
            onFocus={() => setFieldFocused(true)}
            onBlur={() => setFieldFocused(false)}
            onChange={(event) => {
              setDraft(event.target.value);
              if (event.target.value.trim()) setBrowseOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addDraft();
              } else if (event.key === "Backspace" && draft === "" && locations.length > 0) {
                setLocations((current) => current.slice(0, -1));
              }
            }}
            type="text"
            placeholder={atLimit ? "Area limit reached" : locations.length > 0 ? "Add another ZIP, city, or county" : "Enter a ZIP, city, town, or county"}
            disabled={atLimit}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="fsre-location-suggestions"
            aria-expanded={suggestionsOpen}
            aria-describedby="f-location-help"
            className="min-w-[170px] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed"
          />
          {draft.trim() && !atLimit ? (
            <button
              type="button"
              onClick={addDraft}
              className="rounded-sm bg-tide px-3 py-1.5 text-xs font-semibold text-sand hover:bg-tide/90"
            >
              Add
            </button>
          ) : null}
        </div>

        {suggestionsOpen ? (
          <div
            id="fsre-location-suggestions"
            role="listbox"
            aria-label="Matching locations"
            className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-sm border border-ink/10 bg-white shadow-xl"
          >
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.context}-${suggestion.value}`}
                type="button"
                role="option"
                aria-selected="false"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  addLocations([suggestion.value]);
                  setDraft("");
                  setFieldFocused(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-ink/5 px-3 py-2.5 text-left text-sm text-ink last:border-b-0 hover:bg-tide/5"
              >
                <span className="font-medium">{suggestion.value}</span>
                <span className="text-[11px] text-ink/45">{suggestion.context}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p id="f-location-help" className="text-[11px] leading-relaxed text-ink/50">
          Add one or several areas. Press Enter or tap Add after each ZIP, city, town, or county.
        </p>
        <button
          type="button"
          aria-expanded={browseOpen}
          onClick={() => {
            setFieldFocused(false);
            setBrowseOpen((open) => !open);
          }}
          className="rounded-full border border-tide/20 bg-tide/5 px-3 py-1.5 text-xs font-medium text-tide hover:bg-tide/10"
        >
          {browseOpen ? "Close area browser" : "Browse counties & cities"}
        </button>
      </div>
      {browseOpen ? (
        <div className="mt-3 overflow-hidden rounded-sm border border-ink/10 bg-sand/50 shadow-[0_16px_40px_-32px_rgba(14,43,48,0.7)]">
          <div className="grid md:grid-cols-[190px_minmax(0,1fr)]">
            <div className="border-b border-ink/10 bg-white p-2 md:border-b-0 md:border-r" role="tablist" aria-label="South Florida counties">
              <div className="flex gap-1 overflow-x-auto md:flex-col">
                {SOUTH_FLORIDA_COUNTIES.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    role="tab"
                    aria-selected={item.name === activeCounty}
                    onClick={() => {
                      setActiveCounty(item.name);
                      setCityQuery("");
                    }}
                    className={`shrink-0 rounded-sm px-3 py-2 text-left text-xs font-medium transition-colors ${item.name === activeCounty ? "bg-tide text-sand" : "text-tide hover:bg-tide/5"}`}
                  >
                    {item.name.replace(" County", "")}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink">{county.name}</p>
                  <p className="text-[11px] text-ink/50">Search the entire county or choose cities and towns.</p>
                </div>
                <label className="sr-only" htmlFor="f-city-filter">Filter cities</label>
                <input
                  id="f-city-filter"
                  type="search"
                  value={cityQuery}
                  onChange={(event) => setCityQuery(event.target.value)}
                  placeholder="Find a city"
                  className="rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-tide"
                />
              </div>
              <button
                type="button"
                aria-pressed={locations.some((location) => location.toLowerCase() === county.name.toLowerCase())}
                onClick={() => toggleLocation(county.name)}
                className={`mt-3 w-full rounded-sm border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${locations.some((location) => location.toLowerCase() === county.name.toLowerCase()) ? "border-tide bg-tide text-sand" : "border-tide/20 bg-tide/5 text-tide hover:bg-tide/10"}`}
              >
                {locations.some((location) => location.toLowerCase() === county.name.toLowerCase()) ? "✓ " : ""}
                Search all of {county.name}
              </button>
              <div className="mt-3 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3" role="group" aria-label={`Cities in ${county.name}`}>
                {visibleCities.map((city) => {
                  const selected = locations.some((location) => location.toLowerCase() === city.toLowerCase());
                  return (
                    <button
                      key={city}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleLocation(city)}
                      className={`rounded-sm border px-2.5 py-2 text-left text-xs transition-colors ${selected ? "border-tide bg-tide text-sand" : "border-ink/10 bg-white text-ink/75 hover:border-tide/30 hover:bg-tide/5"}`}
                    >
                      {selected ? "✓ " : ""}{city}
                    </button>
                  );
                })}
              </div>
              {visibleCities.length === 0 ? <p className="py-5 text-center text-xs text-ink/50">No matching city in this county.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
      {atLimit ? (
        <p className="mt-2 text-xs text-hibiscus" role="status">
          Twenty areas are selected. Remove one before adding another so the MLS search stays fast and reliable.
        </p>
      ) : null}
    </div>
  );
}
