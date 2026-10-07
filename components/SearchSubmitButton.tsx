"use client";

import { useFormStatus } from "react-dom";

export default function SearchSubmitButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-label={pending ? "Searching homes…" : label} aria-busy={pending} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
    <span role="status" aria-live="polite">{pending ? "Searching homes…" : label}</span>
  </button>;
}
