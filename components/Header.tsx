"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/properties", label: "Search" },
  { href: "/sellers", label: "Sell for 0.5%" },
  { href: "/communities", label: "Communities" },
  { href: "/home-valuation", label: "Home Valuation" },
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        solid ? "bg-tide/95 backdrop-blur border-b border-white/10" : "bg-transparent"
      }`}
    >
      <div className="container-fsre flex items-center justify-between h-18 py-3">
        <Link href="/" className="flex items-baseline gap-2 group">
          <span className="font-display text-xl md:text-2xl text-sand tracking-tight">
            Florida Southeast
          </span>
          <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-brass">
            Realty
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-sans text-sm text-sand/85 hover:text-sand transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <a href="tel:+19545550100" className="font-mono text-sm text-sand/85 hover:text-sand">
            (954) 555-0100
          </a>
          <Link
            href="/contact"
            className="bg-hibiscus hover:bg-hibiscus-dark text-sand text-sm font-medium px-4 py-2 rounded-sm transition-colors"
          >
            Talk to an Agent
          </Link>
        </div>

        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden text-sand p-2 -mr-2"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-tide border-t border-white/10 px-5 pb-6 pt-2 animate-rise">
          <nav className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sand/90 border-b border-white/10 font-sans text-base"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 mt-4">
            <a href="tel:+19545550100" className="font-mono text-sand/85 text-sm">
              (954) 555-0100
            </a>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="bg-hibiscus text-sand text-center font-medium px-4 py-3 rounded-sm"
            >
              Talk to an Agent
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
