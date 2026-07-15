import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-32 pb-24 min-h-[60vh] flex items-center">
      <div className="container-fsre text-center max-w-lg mx-auto">
        <p className="mile-marker text-brass text-sm mb-4">MM 404</p>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-4">
          This address isn&apos;t on our map.
        </h1>
        <p className="text-ink/65 mb-8">
          The page you&apos;re looking for may have moved or the listing may no longer be active.
          Try searching current homes, or head back to the homepage.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/properties"
            className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-6 py-3 rounded-sm transition-colors"
          >
            Search Homes
          </Link>
          <Link
            href="/"
            className="border border-tide/30 text-tide font-medium text-center px-6 py-3 rounded-sm hover:bg-tide/5 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
