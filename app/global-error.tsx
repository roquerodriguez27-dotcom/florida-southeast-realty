"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-sand text-ink antialiased">
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-4">Something went wrong</p>
            <h1 className="font-display text-3xl mb-4">We hit a snag loading this page.</h1>
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
      </body>
    </html>
  );
}
