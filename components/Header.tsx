"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { SITE } from "@/lib/site-config";

const NAV = [
  { href: "/properties", label: "Search Homes" },
  { href: "/sellers", label: "Sell for 0.5%" },
  { href: "/communities", label: "Communities" },
  { href: "/buyer-tools", label: "Buyer Tools" },
  { href: "/research", label: "Research" },
  { href: "/home-valuation", label: "Home Value" },
  { href: "/about", label: "About" },
  { href: "/join", label: "Join Us" },
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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const elevated = scrolled || open;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 bg-sand/95 backdrop-blur border-b border-tide/10 transition-shadow duration-300 ${
        elevated ? "shadow-sm" : ""
      }`}
    >
      <div className="container-fsre flex items-center justify-between min-h-16 py-2.5">
        <Link href="/" className="flex items-center shrink-0" aria-label="Florida Southeast Realty home">
          <Image
            src="/fsr-logo-2026.webp"
            alt="Florida Southeast Realty"
            width={720}
            height={161}
            priority
            className="h-10 md:h-11 w-auto max-w-[230px] md:max-w-[270px] object-contain"
          />
        </Link>

        <nav className="hidden xl:flex items-center gap-6" aria-label="Primary navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-sans text-sm text-tide/80 hover:text-tide transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden xl:flex items-center gap-4 shrink-0">
          <a href={SITE.phoneHref} className="font-mono text-xs text-tide/80 hover:text-tide whitespace-nowrap">
            {SITE.phoneDisplay}
          </a>
          <Link
            href="/contact"
            className="bg-brass hover:bg-[#98753b] text-white text-sm font-medium px-4 py-2.5 rounded-sm transition-colors whitespace-nowrap"
          >
            Talk to a Broker
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="xl:hidden text-tide p-2 -mr-2 shrink-0"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="xl:hidden bg-sand border-t border-tide/10 px-5 pb-7 pt-2 max-h-[calc(100svh-64px)] overflow-y-auto animate-rise">
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3.5 text-tide/90 border-b border-tide/10 font-sans text-base"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 mt-5">
            <a href={SITE.phoneHref} className="font-mono text-tide/80 text-sm">
              {SITE.phoneDisplay}
            </a>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="bg-brass text-white text-center font-medium px-4 py-3 rounded-sm"
            >
              Talk to a Broker
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
