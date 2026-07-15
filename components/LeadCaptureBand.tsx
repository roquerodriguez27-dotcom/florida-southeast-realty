import Link from "next/link";

export default function LeadCaptureBand() {
  return (
    <section className="bg-tide-light">
      <div className="container-fsre py-16 md:py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">Thinking of selling?</p>
          <h2 className="font-display text-3xl md:text-4xl text-sand leading-tight">
            Get a real valuation, from an agent who knows your seawall from your street.
          </h2>
        </div>
        <Link
          href="/home-valuation"
          className="shrink-0 bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium px-6 py-3.5 rounded-sm transition-colors"
        >
          Get My Home Value
        </Link>
      </div>
    </section>
  );
}
