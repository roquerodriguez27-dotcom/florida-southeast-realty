# Florida Southeast Realty

Production-oriented Next.js 16 website for Florida Southeast Realty, Inc. The site is mobile-first, IDX-ready, and connected to a private Supabase CRM.

## What is already built

- Public brokerage site with verified company contact details, client reviews, seller disclosures, fair-housing content, privacy terms, accessibility information, and legacy URL redirects.
- Palm Beach and Broward community guides with official Census and National Weather Service context.
- Buyer calculators for affordability, monthly ownership cost, and property comparison.
- Lead capture for contact, valuation, seller, buyer, and calculator-review requests.
- Private `/crm` workspace with Supabase passwordless authentication, lead stages, notes, tasks, follow-up dates, submitted form details, and saved-search criteria.
- SEO foundations: canonical metadata, structured data, Open Graph image, manifest, robots rules, sitemap, and optional GA4/Search Console configuration.
- Production-safe listing behavior: demonstration inventory is disabled unless explicitly enabled outside production, and listing URLs stay out of the production sitemap until IDX is live.

## Local development

```bash
npm ci
npm run dev
```

Visit `http://localhost:3000`. Copy `.env.example` to `.env.local` and add only the integrations needed for the feature being tested.

## Verification

```bash
npm run lint
npm run build
```

## Required configuration

See `.env.example` for the supported variable names.

- Supabase public URL/key plus a server-only secret key power CRM storage and broker authentication.
- `CRM_ADMIN_EMAILS` controls which authenticated email addresses may open `/crm`.
- Resend or a webhook can provide immediate lead notifications in addition to CRM storage.
- GA4 and Google Search Console values are optional.
- IDX variables remain intentionally blank until BeachesMLS approves broker API access.

## Current launch dependencies

1. BeachesMLS/IDX approval and credentials for live inventory.
2. Production environment-variable review, including the Supabase server secret and CRM admin allowlist.
3. A verified Resend sender or CRM webhook if immediate lead notifications are desired.
4. Final legal review of privacy, terms, fair-housing, and advertised-fee language.
5. Final domain/DNS and production deployment verification.

Do not add invented listings, market statistics, transaction results, awards, or reviews. Any future public claims should be traceable to brokerage records or an authoritative source.
