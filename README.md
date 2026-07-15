# Florida Southeast Realty

A luxury-feel, IDX-ready, mobile-first real estate site built with Next.js 16 (App Router) and Tailwind CSS v4.

## Local preview

```bash
npm install
npm run dev
```

Visit http://localhost:3000. No environment variables are required to preview the site — it runs entirely on the sample dataset in `lib/` and honestly reports any unconfigured integrations (lead forms, IDX feed) rather than faking success.

## Production build

```bash
npm run build
npm start
```

## Deployment (Vercel, recommended for Next.js)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import the repo at https://vercel.com/new.
3. Set the environment variables you actually have (see `.env.example`) in the Vercel project's Settings → Environment Variables. None are required for the site to build and run — only for lead delivery and live IDX data.
4. Deploy. Point your domain's DNS at Vercel per their custom-domain instructions once the deploy is live.

Any Node-hosting platform works too (`npm run build && npm start` on a server with Node 20+, or a Docker image running the same commands).

## What's real vs. sample in this project

- **Listings, communities, guides, and blog posts** are sample content for demonstration. See `SampleDataNotice` banners throughout the site and `lib/idx.ts` for the IDX/MLS integration seam.
- **No testimonials, sales statistics, or awards are included** — none should be added until you have real, verifiable ones.
- **Lead forms** (`components/LeadForm.tsx`, `app/api/lead/route.ts`) work end-to-end but will not actually deliver anywhere until you set `LEAD_WEBHOOK_URL` or the `RESEND_*` variables in `.env.local`. Until then, the form honestly tells the visitor it isn't connected and gives them the phone/email fallback.
- **Legal pages** (`/privacy-policy`, `/terms-of-use`) are templates flagged for attorney review — do not publish as-is.
- **Brokerage license number** in the footer is a placeholder — replace with your verified Florida DBPR license number.

## Remaining real blockers before this can go live as an actual business site

1. **IDX/MLS credentials** — pick a provider (RESO Web API, IDX Broker, or Spark/FlexMLS), get API access from your MLS, and wire `fetchLiveListings()` in `lib/idx.ts`.
2. **Verified brokerage license number** — replace the footer placeholder with your real Florida DBPR license number.
3. **Lead delivery credentials** — a CRM webhook URL or a Resend API key + verified sending domain (see `.env.example`).
4. **Legal review** — have a Florida-licensed attorney review `/privacy-policy` and `/terms-of-use` before publishing.
5. **Real photography** — every image on this site is a stock placeholder; replace with licensed or original photography of actual listings, communities, and staff.
6. **Analytics ID** — none is configured; add one (GA4, Plausible, etc.) if you want traffic reporting.
7. **Domain DNS** — point your real domain at wherever you deploy.
8. **Real team bios and any future client testimonials** — collect with permission before publishing; do not use the placeholder bios or invented reviews in production.
