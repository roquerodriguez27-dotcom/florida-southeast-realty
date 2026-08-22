"use client";

import { useMemo, useState } from "react";
import {
  MAX_SEARCH_LOCATIONS,
  SOUTH_FLORIDA_COUNTIES,
  SOUTH_FLORIDA_LOCATION_OPTIONS,
  southFloridaLocationKind,
} from "@/lib/south-florida-locations";

interface LocationSuggestion {
  name: string;
  county?: string;
  type: "ZIP" | "County" | "City";
}

function splitLocations(value: string): string[] {
  return value
    .split(/[,;|\n]/)
    .map((location) => {
      const trimmed = location.trim();
      return /^(?:33|34)\d{3}-\d{4}$/.test(trimmed) ? trimmed.slice(0, 5) : trimmed;
    })
    .filter(Boolean);
}

export default function MultiLocationField({ initialLocations }: { initialLocations: string[] }) {
  const [locations, setLocations] = useState(() => initialLocations.slice(0, MAX_SEARCH_LOCATIONS));
  const [draft, setDraft] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [activeCounty, setActiveCounty] = useState(() => {
    const initial = new Set(initialLocations.map((location) => location.toLowerCase()));
    return SOUTH_FLORIDA_COUNTIES.find((county) => (
      initial.has(county.name.toLowerCase())
      || county.cities.some((city) => initial.has(city.toLowerCase()))
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

  function addDraft(preferredLocation?: string) {
    const additions = preferredLocation ? [preferredLocation] : splitLocations(draft);
    if (additions.length === 0) return;

    addLocations(additions);
    setDraft("");
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function removeLocation(value: string) {
    setLocations((current) => current.filter((location) => location !== value));
  }

  function toggleCity(value: string, countyName: string) {
    setLocations((current) => {
      if (current.some((location) => location.toLowerCase() === value.toLowerCase())) {
        return current.filter((location) => location.toLowerCase() !== value.toLowerCase());
      }
      const next = current.filter((location) => location.toLowerCase() !== countyName.toLowerCase());
      return next.length < MAX_SEARCH_LOCATIONS ? [...next, value] : current;
    });
  }

  function toggleCounty(countyName: string, cities: readonly string[]) {
    setLocations((current) => {
      if (current.some((location) => location.toLowerCase() === countyName.toLowerCase())) {
        return current.filter((location) => location.toLowerCase() !== countyName.toLowerCase());
      }
      const countyCities = new Set(cities.map((city) => city.toLowerCase()));
      const next = current.filter((location) => !countyCities.has(location.toLowerCase()));
      return next.length < MAX_SEARCH_LOCATIONS ? [...next, countyName] : current;
    });
  }

  const atLimit = locations.length >= MAX_SEARCH_LOCATIONS;
  const county = SOUTH_FLORIDA_COUNTIES.find((item) => item.name === activeCounty) ?? SOUTH_FLORIDA_COUNTIES[0];
  const visibleCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    return query ? county.cities.filter((city) => city.toLowerCase().includes(query)) : county.cities;
  }, [cityQuery, county.cities]);
  const suggestions = useMemo<LocationSuggestion[]>(() => {
    const query = draft.trim();
    if (!query) return [];

    if (/^(?:33|34)\d{3}(?:-\d{4})?$/.test(query)) {
      return [{ name: query.slice(0, 5), type: "ZIP" }];
    }
    if (/^\d/.test(query)) return [];

    const normalized = query.toLowerCase();
    return SOUTH_FLORIDA_LOCATION_OPTIONS
      .filter((location) => location.name.toLowerCase().includes(normalized))
      .sort((left, right) => {
        const leftStarts = left.name.toLowerCase().startsWith(normalized) ? 0 : 1;
        const rightStarts = right.name.toLowerCase().startsWith(normalized) ? 0 : 1;
        return leftStarts - rightStarts || left.name.localeCompare(right.name);
      })
      .slice(0, 8);
  }, [draft]);
  const countySelected = locations.some((location) => location.toLowerCase() === county.name.toLowerCase());

  return (
    <div>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-sm border border-ink/15 bg-white px-2 py-1.5 focus-within:border-tide">
          {locations.map((location) => (
            <span key={location.toLowerCase()} className="inline-flex items-center gap-1.5 rounded-full bg-tide/8 px-2.5 py-1 text-xs font-medium text-tide">
              <span className="font-mono text-[9px] uppercase tracking-wide text-tide/55">{southFloridaLocationKind(location)}</span>
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
            onChange={(event) => {
              setDraft(event.target.value);
              setSuggestionsOpen(Boolean(event.target.value.trim()));
              setActiveSuggestion(-1);
            }}
            onFocus={() => setSuggestionsOpen(Boolean(draft.trim()))}
            onBlur={() => setSuggestionsOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && suggestions.length > 0) {
                event.preventDefault();
                setSuggestionsOpen(true);
                setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
              } else if (event.key === "ArrowUp" && suggestions.length > 0) {
                event.preventDefault();
                setActiveSuggestion((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter" && draft.trim()) {
                event.preventDefault();
                addDraft(suggestions[activeSuggestion]?.name);
              } else if (event.key === ",") {
                event.preventDefault();
                addDraft();
              } else if (event.key === "Escape") {
                setSuggestionsOpen(false);
                setActiveSuggestion(-1);
              } else if (event.key === "Backspace" && draft === "" && locations.length > 0) {
                setLocations((current) => current.slice(0, -1));
              }
            }}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="fsre-location-suggestions"
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            aria-activedescendant={activeSuggestion >= 0 ? `fsre-location-${activeSuggestion}` : undefined}
            placeholder={atLimit ? "Area limit reached" : locations.length > 0 ? "Add another city, county, or ZIP" : "City, county, community, or ZIP"}
            disabled={atLimit}
            autoComplete="off"
            aria-describedby="f-location-help"
            className="min-w-[170px] flex-1 bg-transparent px-1 py-1 text-base outline-none disabled:cursor-not-allowed sm:text-sm"
          />
        </div>
        {suggestionsOpen && suggestions.length > 0 ? (
          <div id="fsre-location-suggestions" role="listbox" className="absolute inset-x-0 z-50 mt-1 overflow-hidden rounded-sm border border-ink/10 bg-white py-1 shadow-xl">
            {suggestions.map((suggestion, index) => (
              <button
                id={`fsre-location-${index}`}
                key={`${suggestion.type}-${suggestion.name}`}
                type="button"
                role="option"
                aria-selected={index === activeSuggestion}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addDraft(suggestion.name)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${index === activeSuggestion ? "bg-tide/8" : "hover:bg-tide/5"}`}
              >
                <span className="font-medium text-ink">{suggestion.name}</span>
                <span className="shrink-0 text-xs text-ink/50">{suggestion.type === "City" ? `${suggestion.county?.replace(" County", "")} · City` : suggestion.type}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p id="f-location-help" className="text-[11px] leading-relaxed text-ink/50">
          Add several exact ZIP codes, cities, communities, or whole counties. Press Enter after each area.
        </p>
        <div className="flex items-center gap-2">
          {locations.length > 0 ? (
            <button type="button" onClick={() => setLocations([])} className="px-1 py-1.5 text-xs font-medium text-ink/55 underline underline-offset-4 hover:text-hibiscus">
              Clear locations
            </button>
          ) : null}
          <button
            type="button"
            aria-expanded={browseOpen}
            onClick={() => setBrowseOpen((open) => !open)}
            className="rounded-full border border-tide/20 bg-tide/5 px-3 py-1.5 text-xs font-medium text-tide hover:bg-tide/10"
          >
            {browseOpen ? "Close area browser" : "Browse cities & counties"}
          </button>
        </div>
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
                  <p className="text-[11px] text-ink/50">Search the whole county or choose one or several cities.</p>
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
                aria-pressed={countySelected}
                onClick={() => toggleCounty(county.name, county.cities)}
                className={`mt-3 flex w-full items-center justify-between rounded-sm border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${countySelected ? "border-tide bg-tide text-sand" : "border-brass/40 bg-brass/10 text-ink hover:border-tide/40"}`}
              >
                <span>{countySelected ? `✓ Entire ${county.name} selected` : `Search all of ${county.name}`}</span>
                <span className={countySelected ? "text-sand/70" : "text-ink/45"}>County</span>
              </button>
              <div className="mt-3 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3" role="group" aria-label={`Cities in ${county.name}`}>
                {visibleCities.map((city) => {
                  const selected = locations.some((location) => location.toLowerCase() === city.toLowerCase());
                  return (
                    <button
                      key={city}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCity(city, county.name)}
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
