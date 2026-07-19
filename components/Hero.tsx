import Image from "next/image";
import Link from "next/link";
import SearchPanel from "./SearchPanel";

export default function Hero() {
  return (
    <section className="relative">
      <div className="relative h-[92svh] min-h-[620px] w-full overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=2000&q=85"
          alt="Waterfront homes along the South Florida Intracoastal at golden hour"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/90 via-tide/25 to-tide/45" />

        <div className="relative h-full container-fsre flex flex-col justify-center pt-16">
          <p className="font-mono text-xs md:text-sm uppercase tracking-[0.25em] text-brass mb-4 animate-rise">
            West Palm Beach · Boynton Beach · Delray Beach · Boca Raton
          </p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-sand max-w-3xl leading-[1.05] animate-rise [animation-delay:100ms]">
            Sell Your Home for a 0.5% Listing Fee
          </h1>
          <p className="text-sand/85 text-base md:text-lg max-w-xl mt-5 animate-rise [animation-delay:200ms]">
            0.5% is Florida Southeast Realty&apos;s listing-side fee only — full-service
            representation, MLS exposure, and marketing included. Commission rates are always
            negotiable and are not set by law; any buyer-broker compensation, if authorized, is
            separate.{" "}
            <Link href="/sellers" className="underline underline-offset-2 hover:text-sand">
              See how it works
            </Link>
            .
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-8 animate-rise [animation-delay:300ms]">
            <Link
              href="/home-valuation"
              className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-6 py-3.5 rounded-sm transition-colors"
            >
              Get Your Free Home Value
            </Link>
            <Link
              href="/properties"
              className="bg-sand/10 hover:bg-sand/20 border border-sand/40 text-sand font-medium text-center px-6 py-3.5 rounded-sm transition-colors"
            >
              Search Homes
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
