"use client";

import { useState } from "react";

const MAX_LOCATIONS = 5;
const LOCATION_SUGGESTIONS = [
  "Boca Raton",
  "Boynton Beach",
  "Delray Beach",
  "Fort Lauderdale",
  "Jupiter",
  "Lake Worth Beach",
  "Palm Beach Gardens",
  "Wellington",
  "West Palm Beach",
];

function splitLocations(value: string): string[] {
  return value
    .split(/[,|]/)
    .map((location) => location.trim())
    .filter(Boolean);
}

export default function MultiLocationField({ initialLocations }: { initialLocations: string[] }) {
  const [locations, setLocations] = useState(() => initialLocations.slice(0, MAX_LOCATIONS));
  const [draft, setDraft] = useState("");

  function addDraft() {
    const additions = splitLocations(draft);
    if (additions.length === 0) return;

    setLocations((current) => {
      const next = [...current];
      for (const addition of additions) {
        if (next.length >= MAX_LOCATIONS) break;
        if (!next.some((location) => location.toLowerCase() === addition.toLowerCase())) {
          next.push(addition);
        }
      }
      return next;
    });
    setDraft("");
  }

  function removeLocation(value: string) {
    setLocations((current) => current.filter((location) => location !== value));
  }

  const atLimit = locations.length >= MAX_LOCATIONS;

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
          placeholder={atLimit ? "5 areas selected" : locations.length > 0 ? "Add another area" : "Boynton Beach"}
          disabled={atLimit}
          autoComplete="off"
          aria-describedby="f-location-help"
          className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed"
        />
        <datalist id="fsre-location-suggestions">
          {LOCATION_SUGGESTIONS.map((location) => <option key={location} value={location} />)}
        </datalist>
      </div>
      <p id="f-location-help" className="mt-1.5 text-[11px] leading-relaxed text-ink/50">
        Add up to five cities or communities. Press Enter after each one—for example, Boynton Beach and Boca Raton.
      </p>
    </div>
  );
}
