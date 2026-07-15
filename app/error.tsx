"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-32 pb-24 min-h-[60vh] flex items-center">
      <div className="container-fsre text-center max-w-md mx-auto">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-4">Something went wrong</p>
        <h1 className="font-display text-3xl text-ink mb-4">We hit a snag loading this page.</h1>
        <p className="text-ink/65 mb-8">
          Try again, or call us directly at{" "}
          <a href="tel:+19545550100" className="text-tide underline">(954) 555-0100</a>.
        </p>
        <button
          onClick={() => reset()}
          className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium px-6 py-3 rounded-sm transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
