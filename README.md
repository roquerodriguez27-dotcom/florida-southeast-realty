# Florida Southeast Realty

Production-oriented Next.js 16 website for Florida Southeast Realty, Inc. The site is mobile-first, IDX-ready, and connected to a private Supabase CRM.

## What is already built

- Public brokerage site with verified company contact details, client reviews, seller disclosures, fair-housing content, privacy terms, accessibility information, and legacy URL redirects.
- Palm Beach and Broward community guides with official Census and National Weather Service context.
- Buyer calculators for affordability, monthly ownership cost, and property comparison.
- Lead capture for contact, valuation, seller, buyer, and calculator-review requests.
- Private `/crm` workspace with Supabase passwordless authentication, lead stages, notes, tasks, follow-up dates, submitted form details, and saved-search criteria.
- SEO foundations: canonical metadata, structured data, Open Graph image, manifest, robots rules, sitemap, and optional GA4/Search Console configuration.
- BeachesMLS integration through the FBS RESO Web API, including live server-side OData search, pagination, listing detail retrieval, expanded media, IDX attribution, and a secret-free `/api/idx/health` check.
- Production-safe listing behavior: demonstration inventory is disabled unless explicitly enabled outside production, and listing URLs stay out of the production sitemap until a RESO token is configured.

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
- `RESO_ACCESS_TOKEN` is the preferred server-only BeachesMLS credential. The existing `SPARK_ACCESS_TOKEN` and `IDX_PROVIDER_API_KEY` names remain supported so credentials can be migrated without downtime. `RESO_API_BASE_URL` should remain `https://replication.sparkapi.com/Version/3/Reso/OData`, and `IDX_ORIGINATING_SYSTEM_ID=M00000170` keeps public results scoped to the approved BeachesMLS system.

## Current launch dependencies

1. Add the approved access token to the Vercel Preview and Production environments, then confirm `/api/idx/health` reports `provider: "reso"`, `connected: true`, and `idxRoleVerified: true`.
2. Production environment-variable review, including the Supabase server secret and CRM admin allowlist.
3. A verified Resend sender or CRM webhook if immediate lead and saved-search notifications are desired.
4. Final legal review of privacy, terms, fair-housing, MLS/IDX, and advertised-fee language.
5. Final domain/DNS and production deployment verification.

Do not add invented listings, market statistics, transaction results, awards, or reviews. Any future public claims should be traceable to brokerage records or an authoritative source.
