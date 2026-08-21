"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  "Show me houses with private pools",
  "3-bedroom condos in Boca Raton under $1 million",
  "Waterfront homes in Delray Beach between $800k and $1.5M",
] as const;

interface SearchResponse {
  searchUrl?: string;
  error?: string;
}

export default function AiPropertySearch() {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<"idle" | "searching" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt.length < 3) {
      setState("error");
      setMessage("Describe the home you want in a short sentence.");
      return;
    }

    setState("searching");
    setMessage("");
    try {
      const response = await fetch("/api/property-search/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: normalizedPrompt }),
      });
      const result = await response.json() as SearchResponse;
      if (!response.ok || !result.searchUrl) {
        setState("error");
        setMessage(result.error ?? "We could not understand that search. Please try a shorter description.");
        return;
      }
      setState("idle");
      router.push(result.searchUrl);
    } catch {
      setState("error");
      setMessage("The search assistant is temporarily unavailable. Please use the filters below.");
    }
  }

  return (
    <section id="ai-property-search" className="rounded-sm border border-tide/15 bg-tide p-5 text-sand shadow-[0_20px_60px_-35px_rgba(14,43,48,0.8)] md:p-7" aria-labelledby="ai-search-heading">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">AI home search</p>
          <h2 id="ai-search-heading" className="mt-2 font-display text-2xl md:text-3xl">Describe the home you want</h2>
          <p id="ai-search-help" className="mt-2 text-sm leading-relaxed text-sand/70">
            Use everyday language. We&apos;ll translate it into live MLS filters—no personal details needed.
          </p>
        </div>

        <form onSubmit={submit} className="w-full lg:max-w-2xl">
          <label htmlFor="ai-search-prompt" className="sr-only">Describe the home you want</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              id="ai-search-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={300}
              rows={2}
              required
              aria-describedby="ai-search-help"
              placeholder="Example: Show me houses with private pools under $1M in Boca Raton"
              className="min-h-14 flex-1 resize-none rounded-sm border border-white/15 bg-white px-3.5 py-3 text-base text-ink outline-none placeholder:text-ink/45 focus:border-brass focus:ring-2 focus:ring-brass/30"
            />
            <button
              type="submit"
              disabled={state === "searching"}
              className="min-h-14 rounded-sm bg-hibiscus px-5 py-3 text-sm font-medium text-sand transition-colors hover:bg-hibiscus-dark disabled:cursor-wait disabled:opacity-65"
            >
              {state === "searching" ? "Understanding…" : "Find matching homes"}
            </button>
          </div>
          {state === "error" ? <p className="mt-2 text-sm text-[#ffd8d1]" role="alert">{message}</p> : null}
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Example searches">
        <span className="text-xs text-sand/50">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setPrompt(example);
              setState("idle");
              setMessage("");
            }}
            className="rounded-full border border-white/20 px-3 py-1.5 text-left text-xs text-sand/80 hover:border-brass/70 hover:text-sand"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
