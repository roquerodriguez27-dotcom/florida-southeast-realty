import type { Metadata } from "next";
import { SITE, SITE_ADDRESS_LINE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Florida Southeast Realty, Inc. collects, uses, and protects information submitted through this website.",
  alternates: { canonical: "/privacy-policy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-28 md:pt-32 pb-24">
      <div className="container-fsre max-w-3xl">
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-2">Privacy Policy</h1>
        <p className="text-xs text-ink/45 mb-8">Last updated August 16, 2026</p>

        <div className="space-y-7 text-ink/80 leading-relaxed text-sm">
          <section>
            <h2 className="font-display text-xl text-ink mb-2">Information we collect</h2>
            <p>
              When you submit a contact form, home valuation request, buyer inquiry, property inquiry,
              or similar request, we collect the information you provide. That may include your name,
              email address, phone number, property address, search criteria, and message. Our hosting
              provider may also process technical information such as IP address, browser type, device
              information, and request logs for security and site operation.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Saved searches, favorites, and site activity</h2>
            <p>
              When account or personalization features are enabled, we may store your saved searches,
              favorite properties, comparison selections, listing views, and related website activity.
              Authorized brokerage personnel may review this activity to operate those features, answer
              your questions, understand the kind of property information you requested, and provide
              relevant service. You may ask us to delete this information subject to the retention needs below.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">How we use information</h2>
            <p>
              We use information to respond to your request, provide real estate information or
              brokerage services you ask for, follow up about that request, operate and secure the
              website, improve the site, and comply with legal or regulatory obligations. If you
              provide contact consent, we may contact you by phone, email, or text about your real
              estate request. Consent is not a condition of purchasing property or services.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Service providers and MLS data</h2>
            <p>
              We may use service providers for website hosting, email or lead delivery, analytics,
              customer relationship management, mapping, and MLS/IDX functions. They may process
              information only as needed to provide those services. MLS and third-party research
              tools may have their own privacy policies and terms when you use or follow their links.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Cookies and analytics</h2>
            <p>
              The site may use cookies or similar technologies required for security and functionality.
              If analytics is enabled, it may collect aggregated usage information such as pages viewed,
              device type, and referral source. We do not use this website to sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Data retention and security</h2>
            <p>
              We keep inquiry information for as long as reasonably needed to respond, provide requested
              services, maintain business records, and meet legal obligations. No method of online storage
              or transmission is completely secure, but we use reasonable administrative and technical
              measures appropriate to the information we process.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Your choices</h2>
            <p>
              You may ask us to update or delete information you submitted, subject to records we must
              retain for legal, regulatory, transaction, fraud-prevention, or other legitimate business
              purposes. You may also ask us not to contact you by text or marketing email.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-2">Contact</h2>
            <p>
              Questions about this policy can be sent to <a href={`mailto:${SITE.email}`} className="text-tide underline">{SITE.email}</a>
              {" "}or by mail to {SITE.name}, {SITE_ADDRESS_LINE}. You can also call <a href={SITE.phoneHref} className="text-tide underline">{SITE.phoneDisplay}</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
