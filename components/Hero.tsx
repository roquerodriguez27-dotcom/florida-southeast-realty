import Image from "next/image";
import Link from "next/link";
import SearchPanel from "./SearchPanel";

export default function Hero() {
  return (
    <section className="relative">
      <div className="relative h-[88svh] min-h-[620px] w-full overflow-hidden bg-tide">
        <Image
          src="https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=2000&q=85"
          alt="South Florida waterfront homes at golden hour"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/95 via-tide/35 to-tide/55" />

        <div className="relative h-full container-fsre flex flex-col justify-center pt-16">
          <p className="font-mono text-[11px] sm:text-xs md:text-sm uppercase tracking-[0.18em] md:tracking-[0.25em] text-brass mb-4 animate-rise max-w-3xl">
            Broward County · Palm Beach County · South Florida
          </p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-sand max-w-4xl leading-[1.04] animate-rise [animation-delay:100ms]">
            Search smarter. Research deeper. Sell for 0.5%.
          </h1>
          <p className="text-sand/85 text-base md:text-lg max-w-2xl mt-5 animate-rise [animation-delay:200ms] leading-relaxed">
            Florida Southeast Realty combines local brokerage representation, South Florida home
            search, and property-and-neighborhood research in one place. Sellers can list with our
            0.5% listing-side brokerage fee; commission rates are negotiable and buyer-broker
            compensation is separate and negotiable.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-8 animate-rise [animation-delay:300ms] max-w-xl">
            <Link href="/home-valuation" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-6 py-3.5 rounded-sm transition-colors">
              Get Your Free Home Value
            </Link>
            <Link href="/properties" className="bg-sand/10 hover:bg-sand/20 border border-sand/40 text-sand font-medium text-center px-6 py-3.5 rounded-sm transition-colors">
              Search Homes
            </Link>
            <Link href="/research" className="bg-sand/10 hover:bg-sand/20 border border-sand/40 text-sand font-medium text-center px-6 py-3.5 rounded-sm transition-colors">
              Research an Area
            </Link>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="container-fsre">
          <div className="-mt-8 md:-mt-10 relative z-10">
            <SearchPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
