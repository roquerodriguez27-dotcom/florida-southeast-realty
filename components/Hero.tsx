import Image from "next/image";
import Link from "next/link";
import lakeWorthBeachHero from "@/public/lake-worth-beach-pier.webp";
import SearchPanel from "./SearchPanel";
import { SITE } from "@/lib/site-config";

export default function Hero() {
  return (
    <section className="relative">
      <div className="relative h-[88svh] min-h-[620px] w-full overflow-hidden bg-tide">
        <Image
          src={lakeWorthBeachHero}
          alt="Aerial view of Lake Worth Beach Pier and the Palm Beach County coastline"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[62%_center] md:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tide/95 via-tide/35 to-tide/55" />

        <a
          href="https://unsplash.com/photos/an-aerial-view-of-a-beach-and-a-pier-zoiydkKd0dc"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-12 right-4 z-10 rounded-full border border-sand/20 bg-tide/60 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-sand/80 backdrop-blur-sm transition-colors hover:bg-tide/75 sm:bottom-14 sm:right-6 sm:text-[10px]"
          aria-label="Lake Worth Beach, Palm Beach County. Photo by Gene Gallin on Unsplash"
        >
          Lake Worth Beach · Palm Beach County
        </a>

        <div className="relative h-full container-fsre flex flex-col justify-center pt-16">
          <p className="font-mono text-[11px] sm:text-xs md:text-sm uppercase tracking-[0.18em] md:tracking-[0.25em] text-brass mb-4 animate-rise max-w-3xl">
            Broward County · Palm Beach County · South Florida
          </p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-sand max-w-4xl leading-[1.04] animate-rise [animation-delay:100ms]">
            Local expertise for your next move.
          </h1>
          <p className="text-sand/85 text-base md:text-lg max-w-2xl mt-5 animate-rise [animation-delay:200ms] leading-relaxed">
            Work directly with {SITE.brokerName}, Broker and real estate professional since {SITE.brokerSince}.
            Search South Florida homes or plan your sale with full-service representation.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-sand/80">
            Seller representation with a 0.5% listing-side fee. Buyer-broker compensation and
            other closing costs are separate; commission rates are negotiable.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-8 animate-rise [animation-delay:300ms] max-w-xl">
            <Link href="/home-valuation" className="bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-center px-6 py-3.5 rounded-sm transition-colors">
              Plan My Home Sale
            </Link>
            <Link href="/properties" className="bg-sand/10 hover:bg-sand/20 border border-sand/40 text-sand font-medium text-center px-6 py-3.5 rounded-sm transition-colors">
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
