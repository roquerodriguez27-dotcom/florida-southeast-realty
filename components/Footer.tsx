import Link from "next/link";
import Tideline from "./Tideline";

export default function Footer() {
  return (
    <footer className="bg-tide text-sand/80">
      <div className="container-fsre pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">
          <div className="col-span-2">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display text-xl text-sand">Florida Southeast</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">Realty</span>
            </div>
            <p className="text-sm max-w-xs leading-relaxed">
              Independent brokerage serving South Florida&apos;s coastal corridor — Fort
              Lauderdale, Boca Raton, Delray Beach, West Palm Beach, and beyond. Sellers list for
              a 0.5% listing-side fee.
            </p>
            <p className="font-mono text-xs mt-6 text-sand/50">
              Florida Southeast Realty, Inc. · License # [add verified Florida DBPR license number]
            </p>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-brass mb-4">Search</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/properties" className="hover:text-sand">All Listings</Link></li>
              <li><Link href="/properties?waterfront=1" className="hover:text-sand">Waterfront Homes</Link></li>
              <li><Link href="/properties?type=Condo" className="hover:text-sand">Condos</Link></li>
              <li><Link href="/home-valuation" className="hover:text-sand">What&apos;s My Home Worth</Link></li>
              <li><Link href="/sellers" className="hover:text-sand">0.5% Listing Fee</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-brass mb-4">Communities</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/communities/las-olas" className="hover:text-sand">Las Olas</Link></li>
              <li><Link href="/communities/coral-ridge" className="hover:text-sand">Coral Ridge</Link></li>
              <li><Link href="/communities/boca-raton" className="hover:text-sand">Boca Raton</Link></li>
              <li><Link href="/communities" className="hover:text-sand">View All</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-brass mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-sand">About Us</Link></li>
              <li><Link href="/guides" className="hover:text-sand">Buyer &amp; Seller Guides</Link></li>
              <li><Link href="/blog" className="hover:text-sand">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-sand">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="my-10">
          <Tideline />
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-6 text-xs text-sand/50">
          <p>© {new Date().getFullYear()} Florida Southeast Realty, Inc. All rights reserved. Equal Housing Opportunity.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy-policy" className="hover:text-sand">Privacy Policy</Link>
            <Link href="/terms-of-use" className="hover:text-sand">Terms of Use</Link>
            <Link href="/accessibility-statement" className="hover:text-sand">Accessibility</Link>
          </nav>
        </div>
        <p className="max-w-3xl text-xs text-sand/40 mt-4">
          Sample listing data shown throughout this site is for demonstration purposes only and
          is not sourced from a live MLS/IDX feed. Commission rates are not set by law and are
          fully negotiable. Any buyer-broker compensation, if authorized by a seller, is
          separate from the listing-side fee described on this site.
        </p>
      </div>
    </footer>
  );
}
