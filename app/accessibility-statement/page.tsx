import type { Metadata } from "next";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description: "Florida Southeast Realty, Inc.'s commitment to an accessible website.",
  alternates: { canonical: "/accessibility-statement" },
};

export default function AccessibilityStatementPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-6">Accessibility Statement</h1>

        <div className="space-y-6 text-ink/80 leading-relaxed text-sm">
          <p>
            {SITE.name} is committed to making this website usable by as many people as possible,
            including people who use screen readers, keyboard navigation, zoom, voice input, and
            other assistive technology. We work toward WCAG 2.1 Level AA practices as the site evolves.
          </p>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Accessibility features</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Visible keyboard focus indicators on interactive controls</li>
              <li>Semantic headings, landmarks, and a skip-to-content link</li>
              <li>Form labels, validation messages, and mobile-friendly control sizing</li>
              <li>Alternative text on meaningful images</li>
              <li>Support for reduced-motion preferences</li>
              <li>Responsive layouts designed for small phones through large screens</li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Ongoing work</h2>
            <p>
              Accessibility is an ongoing process. Third-party tools, MLS content, maps, and linked
              external services may have accessibility features or limitations outside our direct control.
              If you encounter a barrier on this site, tell us what happened and what page you were using.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Contact us about accessibility</h2>
            <p>
              Email <a href={`mailto:${SITE.email}`} className="text-tide underline">{SITE.email}</a> or call{" "}
              <a href={SITE.phoneHref} className="text-tide underline">{SITE.phoneDisplay}</a>. We will work with you to provide the information or service in an accessible way.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
