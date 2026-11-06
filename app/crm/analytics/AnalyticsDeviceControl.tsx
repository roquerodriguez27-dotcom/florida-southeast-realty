"use client";

import { useState, useSyncExternalStore } from "react";
import { ANALYTICS_OPTOUT_COOKIE, ANALYTICS_OPTOUT_KEY, ANALYTICS_PREFERENCE_EVENT } from "@/lib/analytics";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(ANALYTICS_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ANALYTICS_PREFERENCE_EVENT, onChange);
  };
}
function snapshot() {
  if (document.cookie.split(";").some((part) => part.trim() === `${ANALYTICS_OPTOUT_COOKIE}=1`)) return true;
  try { return window.localStorage.getItem(ANALYTICS_OPTOUT_KEY) === "1"; } catch { return false; }
}

export default function AnalyticsDeviceControl() {
  const excluded = useSyncExternalStore(subscribe, snapshot, () => false);
  const [message, setMessage] = useState("");
  function toggle() {
    const next = !excluded;
    try {
      if (next) window.localStorage.setItem(ANALYTICS_OPTOUT_KEY, "1");
      else window.localStorage.removeItem(ANALYTICS_OPTOUT_KEY);
    } catch { /* The cookie also enforces the preference on the server. */ }
    document.cookie = `${ANALYTICS_OPTOUT_COOKIE}=${next ? "1" : ""}; Path=/; Max-Age=${next ? 31536000 : 0}; SameSite=Lax; Secure`;
    window.dispatchEvent(new Event(ANALYTICS_PREFERENCE_EVENT));
    setMessage(snapshot() === next ? "Preference saved for this browser." : "Your browser could not save this preference. Check its storage settings.");
  }
  return (
    <section className="rounded-sm border border-ink/10 bg-white p-5">
      <h2 className="font-display text-xl text-tide">Exclude this browser</h2>
      <p className="mt-2 text-sm text-ink/65">Signed-in CRM sessions are automatically excluded. Use this setting for Rocky’s device or testing that continues after signing out. It applies to this visitor report in this browser, and clearing site data removes it.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={toggle} aria-pressed={excluded} className="rounded-sm bg-tide px-4 py-2 text-sm text-white">{excluded ? "Allow this browser after sign-out" : "Exclude this browser after sign-out"}</button>
        <span className="text-sm text-ink/65">{excluded ? "Device exclusion is on" : "Device exclusion is off"}</span>
      </div>
      <p aria-live="polite" className="mt-2 text-xs text-ink/60">{message}</p>
    </section>
  );
}
