import Link from "next/link";
import Tideline from "./Tideline";
import { SITE, SITE_ADDRESS_LINE } from "@/lib/site-config";
import { IDX_PROVIDER } from "@/lib/idx";
import EqualHousingMark from "./EqualHousingMark";

export default function Footer() {
  const usingSampleListings = IDX_PROVIDER === "not_connected";

  return (
    <footer className="bg-tide text-sand/80">
      <div className="container-fsre pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">
          <div className="col-span-2">
            <p className="font-display text-xl text-sand mb-1">{SITE.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass mb-4">Licensed Florida real estate brokerage</p>
            <p className="text-sm max-w-md leading-relaxed">
              Independent South Florida brokerage helping buyers research their move and helping
              sellers market their homes with a 0.5% listing-side fee.
            </p>
            <address className="not-italic text-sm mt-6 space-y-1 text-sand/65">
              <p>{SITE_ADDRESS_LINE}</p>
              <p><a href={SITE.phoneHref} className="hover:text-sand">{SITE.phoneDisplay}</a></p>
              <p><a href={`mailto:${SITE.email}`} className="hover:text-sand">{SITE.email}</a></p>
            </address>
            <EqualHousingMark light className="mt-6" />
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-brass mb-4">Search</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/properties" className="hover:text-sand">Search Homes</Link></li>
              <li><Link href="/properties?waterfront=1" className="hover:text-sand">Waterfront Homes</Link></li>
              <li><Link href="/properties?type=Condo" className="hover:text-sand">Condos</Link></li>
              <li><Link href="/home-valuation" className="hover:text-sand">Home Valuation</Link></li>
              <li><Link href="/sellers" className="hover:text-sand">0.5% Listing Fee</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-brass mb-4">Research</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/communities" className="hover:text-sand">Community Guides</Link></li>
              <li><Link href="/research" className="hover:text-sand">Research Center</Link></li>
              <li><Link href="/guides" className="hover:text-sand">Buyer &amp; Seller Guides</Link></li>
              <li><Link href="/blog" className="hover:text-sand">Market &amp; Local Articles</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-brass mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-sand">About</Link></li>
              <li><Link href="/testimonials" className="hover:text-sand">Client Reviews</Link></li>
              <li><Link href="/contact" className="hover:text-sand">Contact</Link></li>
              <li><Link href="/fair-housing" className="hover:text-sand">Fair Housing</Link></li>
              <li><a href={SITE.phoneHref} className="hover:text-sand">Call {SITE.phoneDisplay}</a></li>
            </ul>
          </div>
        </div>

        <div className="my-10">
          <Tideline />
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-6 text-xs text-sand/50">
          <p>© {new Date().getFullYear()} {SITE.name} All rights reserved. Equal Housing Opportunity.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legal">
            <Link href="/privacy-policy" className="hover:text-sand">Privacy Policy</Link>
            <Link href="/terms-of-use" className="hover:text-sand">Terms of Use</Link>
            <Link href="/accessibility-statement" className="hover:text-sand">Accessibility</Link>
            <Link href="/fair-housing" className="hover:text-sand">Fair Housing</Link>
          </nav>
        </div>

        <div className="max-w-4xl text-xs text-sand/40 mt-4 space-y-2 leading-relaxed">
          <p>
            Commission rates are not set by law and are fully negotiable. Florida Southeast
            Realty&apos;s advertised 0.5% fee is the listing-side brokerage fee only. Any buyer-broker
            compensation, if authorized by a seller, is separate and negotiable.
          </p>
          {usingSampleListings && (
            <p>
              Preview notice: listing data on preview deployments is demonstration data while the
              live BeachesMLS/IDX connection is being completed. Demonstration listing pages are
              excluded from production indexing and are not represented as active MLS inventory.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
