# Florida Southeast Realty

Production-oriented Next.js 16 website for Florida Southeast Realty, Inc. The site is mobile-first, IDX-ready, and connected to a private Supabase CRM.

## What is already built

- Public brokerage site with verified company contact details, client reviews, seller disclosures, fair-housing content, privacy terms, accessibility information, and legacy URL redirects.
- Palm Beach and Broward community guides with official Census and National Weather Service context.
- Buyer calculators for affordability, monthly ownership cost, and property comparison.
- Lead capture for contact, valuation, seller, buyer, and calculator-review requests.
- Private `/crm` workspace with Supabase passwordless authentication, broker/agent roles, lead assignment, lead stages, notes, tasks, follow-up dates, submitted form details, and saved-search criteria.
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
npm run test:analytics-privacy
npm run build
```

## Required configuration

See `.env.example` for the supported variable names.

- A Supabase public URL/key powers broker authentication and validated, write-only lead capture; authenticated RLS policies protect every CRM read and update.
- The broker manages authorized agent emails inside `/crm`; database Row Level Security limits each agent to leads assigned to that exact email.
- Resend or a webhook can provide immediate lead notifications in addition to CRM storage.
- GA4 and Google Search Console values are optional.
- `RESO_ACCESS_TOKEN` is the preferred server-only BeachesMLS credential. The existing `SPARK_ACCESS_TOKEN` and `IDX_PROVIDER_API_KEY` names remain supported so credentials can be migrated without downtime. `RESO_API_BASE_URL` should remain `https://replication.sparkapi.com/Version/3/Reso/OData`, and `IDX_ORIGINATING_SYSTEM_ID=M00000170` keeps public results scoped to the approved BeachesMLS system.

### Google measurement

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` only for production and rebuild. Before activation, turn **Enhanced measurement off** for the GA4 web stream; its automatic history, search, and form events bypass this application's filtering. The application loads the Google tag only after a fresh same-origin eligibility check, excludes private routes/staff/opted-out browsers, and manually sends sanitized `page_view` events with default pageviews disabled. Google signals and advertising personalization are disabled in the tag configuration. An early consent default denies `ad_storage`, `ad_user_data`, and `ad_personalization` without asserting an analytics-consent choice.

Accepted, stored inquiries send `generate_lead`. Contact links send separate `contact_phone_click`, `contact_text_click`, and `contact_email_click` events. Optional event-scoped dimensions are `form_name`, `request_type`, and `fsr_campaign`; all use fixed allowlists. Supported campaign values are `seller-review`, `buyer-search`, `property-share`, `referral`, and `relocation`. Attribution covers those labels and general page categories, not arbitrary UTM values or referring URLs. Query strings, fragments, contact-form responses, listing identifiers, and free-form document titles are omitted.

The Google tag is optional: blockers or delivery failures do not interrupt first-party reporting. Contact outcomes that complete after opening another app are held in a small, sanitized in-memory queue until a fresh eligibility check on return; closing the page before returning loses those deferred Google events. Staff/opt-out/private-route rejection discards the queue. `npm run test:analytics-privacy` checks eligibility, cross-tab changes, navigation races, sanitization, and failure isolation with synthetic browser state and no live requests. After activation, verify a public pageview in GA4 and confirm excluded/private browsing sends no Google collection requests; do not submit fake production leads.

`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` accepts only the content value from Search Console's HTML tag. It is rendered in server HTML for URL-prefix verification; keep it after verification. A Domain property requires DNS verification instead.

## Current launch dependencies

1. Add the approved access token to the Vercel Preview and Production environments, then confirm `/api/idx/health` reports `provider: "reso"`, `connected: true`, and `idxRoleVerified: true`.
2. Production environment-variable review, including the Supabase public key and CRM admin allowlist.
3. A verified Resend sender or CRM webhook if immediate lead and saved-search notifications are desired.
4. Final legal review of privacy, terms, fair-housing, MLS/IDX, and advertised-fee language.
5. Final domain/DNS and production deployment verification.

Do not add invented listings, market statistics, transaction results, awards, or reviews. Any future public claims should be traceable to brokerage records or an authoritative source.
