import type { Metadata } from "next";

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
            Florida Southeast Realty, Inc. is committed to making this website usable by as many
            people as possible, including people using screen readers, keyboard-only navigation,
            and other assistive technology. We aim to meet the Web Content Accessibility
            Guidelines (WCAG) 2.1 Level AA.
          </p>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">What we&apos;ve built in</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Visible keyboard focus indicators on every interactive element</li>
              <li>Semantic HTML headings and landmarks, and a skip-to-content link</li>
              <li>Form fields with associated labels and inline error messaging</li>
              <li>Descriptive alt text on property and community photography</li>
              <li>Support for reduced-motion preferences</li>
              <li>A responsive layout that works from small phones through large desktops</li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Known limitations</h2>
            <p>
              This site has not yet undergone a full third-party accessibility audit. If you
              encounter a barrier using this site, please let us know so we can fix it.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Contact us about accessibility</h2>
            <p>
              Email{" "}
              <a href="mailto:hello@floridasoutheastrealty.com" className="text-tide underline">
                hello@floridasoutheastrealty.com
              </a>{" "}
              or call{" "}
              <a href="tel:+19545550100" className="text-tide underline">(954) 555-0100</a>{" "}
              and we&apos;ll work with you directly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
