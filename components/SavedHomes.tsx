"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import BrokerIdentity from "@/components/BrokerIdentity";
import IdxAttribution from "@/components/IdxAttribution";
import LeadForm, { type LeadFormField } from "@/components/LeadForm";
import { trackSiteEvent } from "@/components/SiteAnalytics";
import { removeSavedListing, useSavedListings } from "@/components/useSavedListings";
import { formatFullPrice } from "@/lib/format";

const MAX_INQUIRY_HOMES = 10;
const inquiryFields: LeadFormField[] = [
  { name: "message", label: "What would you like to know?", type: "textarea", required: true, colSpan: 2, placeholder: "Which homes fit my needs? What should I know about the location, HOA, or ownership costs?" },
  { name: "email", label: "Email", type: "email", placeholder: "you@email.com" },
  { name: "phone", label: "Phone", type: "tel", placeholder: "(555) 555-5555" },
];

function listingImage(image: string | undefined) {
  if (image?.startsWith("/") && !image.startsWith("//")) return image;
  try {
    const url = new URL(image ?? "");
    if (url.protocol === "https:") return url.href;
  } catch { /* A saved image may be absent or outdated. */ }
  return "/property-placeholder.svg";
}

export default function SavedHomes() {
  const listings = useSavedListings();
  const [selectedSlugs, setSelectedSlugs] = useState<string[] | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [error, setError] = useState("");
  const inquiryRef = useRef<HTMLDivElement>(null);
  const selected = selectedSlugs === null
    ? listings.slice(0, MAX_INQUIRY_HOMES)
    : listings.filter((listing) => selectedSlugs.includes(listing.slug)).slice(0, MAX_INQUIRY_HOMES);
  const selectedSet = new Set(selected.map((listing) => listing.slug));
  // Keep every selected MLS identifier while bounding the optional address text.
  // Fewer than 2,600 characters here leaves room for the 5,000-character message
  // within the API's 32 KB request limit, including multibyte text.
  const propertyContext = selected.map((listing, index) => (
    `${index + 1}. ${listing.address.slice(0, 100)}, ${listing.city.slice(0, 40)} — MLS ${listing.mlsId}`
  )).join("\n");

  function selectHome(slug: string, checked: boolean) {
    const current = selected.map((listing) => listing.slug);
    if (checked && current.length >= MAX_INQUIRY_HOMES) return;
    setSelectedSlugs(checked ? [...current, slug] : current.filter((item) => item !== slug));
  }

  function removeHome(slug: string) {
    if (!removeSavedListing(slug)) {
      setError("We couldn’t update your saved homes. Please check this browser’s storage settings.");
      return;
    }
    setError("");
    setSelectedSlugs(selected.map((listing) => listing.slug).filter((item) => item !== slug));
    trackSiteEvent("compare_change", { action: "unsave_home", surface: "saved_homes" });
  }

  function openInquiry() {
    if (selected.length === 0) return;
    setInquiryOpen(true);
    requestAnimationFrame(() => {
      inquiryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      inquiryRef.current?.focus({ preventScroll: true });
    });
  }

  if (listings.length === 0) {
    return (
      <div className="mt-8 rounded-sm border border-tide/15 bg-white p-7 md:p-10 max-w-3xl">
        <h2 className="font-display text-2xl text-ink">Start with a home you like.</h2>
        <p className="mt-3 text-sm text-ink/65 leading-relaxed">Tap the heart on a home to save it here. Then revisit the details or ask Roque about the homes you’re considering.</p>
        <Link href="/properties" prefetch={false} className="mt-6 inline-block rounded-sm bg-hibiscus px-5 py-3 text-sm font-medium text-sand hover:bg-hibiscus-dark">Search homes</Link>
        <p className="mt-5 text-xs text-ink/50">Saved homes stay on this device and browser. Clearing browser data also clears this list.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-5 rounded-sm border border-tide/15 bg-keystone p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">{listings.length} saved {listings.length === 1 ? "home" : "homes"}</h2>
          <p id="shortlist-selection-help" className="mt-2 text-sm text-ink/65">Choose up to {MAX_INQUIRY_HOMES} homes to ask about. <span className="font-medium text-tide">{selected.length} selected.</span></p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/properties" prefetch={false} className="text-center text-sm font-medium text-tide underline underline-offset-4">Keep searching</Link>
          <button type="button" onClick={openInquiry} disabled={selected.length === 0} className="rounded-sm bg-hibiscus px-5 py-3 text-sm font-medium text-sand hover:bg-hibiscus-dark disabled:opacity-50 disabled:cursor-not-allowed">Ask Roque about these homes</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-hibiscus">{error}</p>}
      <p className="mt-5 text-xs text-ink/55">Details below are from when you saved each home. Open a listing for its current price and availability.</p>

      <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => {
          const href = `/properties/${encodeURIComponent(listing.slug.trim())}?returnTo=%2Fsaved-homes`;
          const checked = selectedSet.has(listing.slug);
          return (
            <article key={listing.slug} className="overflow-hidden rounded-sm border border-ink/10 bg-white">
              <Link href={href} prefetch={false} className="group block">
                {listing.idx && <div className="relative aspect-[4/3] overflow-hidden bg-keystone-dim">
                  <Image src={listingImage(listing.image)} alt={`${listing.address}, ${listing.city}`} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>}
                <div className="p-5">
                  <h3 className="font-display text-xl text-ink">{listing.address}</h3>
                  <p className="mt-1 text-sm text-ink/60">{listing.city}, FL {listing.zip}</p>
                  {listing.idx ? <>
                    <p className="mt-3 text-lg font-medium text-tide">{formatFullPrice(listing.price)}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink/60">
                      <span>{listing.beds} bd</span><span>{listing.baths} ba</span>{listing.sqft > 0 && <span>{listing.sqft.toLocaleString("en-US")} sqft</span>}
                    </div>
                    <IdxAttribution attribution={listing.idx} compact />
                  </> : <p className="mt-3 text-sm text-ink/60">Open this saved home to see its latest price, photos, and listing details.</p>}
                  <p className="mt-4 text-sm font-medium text-tide underline underline-offset-4">View current listing →</p>
                </div>
              </Link>
              {listing.idx?.disclaimer && <p className="px-5 pb-4 text-[10px] leading-relaxed text-ink/50">{listing.idx.disclaimer}</p>}
              <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-5 py-3">
                <label className="inline-flex items-center gap-2 text-sm text-tide cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={(event) => selectHome(listing.slug, event.target.checked)} disabled={!checked && selected.length >= MAX_INQUIRY_HOMES} aria-describedby="shortlist-selection-help" aria-label={`Ask about ${listing.address}`} className="h-4 w-4 accent-[var(--color-tide)] disabled:opacity-40" />
                  Ask about this home
                </label>
                <button type="button" onClick={() => removeHome(listing.slug)} aria-label={`Remove ${listing.address} from saved homes`} className="py-2 text-xs text-ink/60 underline underline-offset-4 hover:text-hibiscus">Remove</button>
              </div>
            </article>
          );
        })}
      </div>

      <div ref={inquiryRef} id="shortlist-inquiry" tabIndex={-1} hidden={!inquiryOpen || selected.length === 0} className="mt-10 scroll-mt-24 outline-none">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-display text-3xl text-ink">Ask Roque about your shortlist.</h2>
            <p className="mt-3 text-sm text-ink/65 leading-relaxed">Tell Roque what matters to you or ask a question before deciding which homes to tour.</p>
            <p className="mt-5 text-sm font-medium text-tide">Your question will include {selected.length} {selected.length === 1 ? "home" : "homes"}:</p>
            <ul className="mt-2 space-y-1 text-sm text-ink/65">{selected.map((listing) => <li key={listing.slug}>{listing.address}, {listing.city}</li>)}</ul>
            <div className="mt-5 max-w-md"><BrokerIdentity compact /></div>
          </div>
          <LeadForm
            formName="property-inquiry"
            fields={inquiryFields}
            submitLabel="Send my question to Roque"
            successMessage="Your question and selected homes have been saved for Roque to follow up."
            hiddenContext={{ requestType: "shortlist", property: propertyContext, shortlistCount: String(selected.length), source: "saved-homes" }}
          />
        </div>
      </div>
    </div>
  );
}
