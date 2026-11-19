# Initial inquiry reply agent

## What it does

New, eligible website contact/property/seller inquiries enter a private broker queue at `/crm/follow-up`. The worker prepares one initial reply using submitted facts. A broker reviews and saves any edits, then explicitly approves that saved version before a single email can be requested.

Saved-search-only consent is not inquiry follow-up consent. Anonymous analytics are never used as contact identities. The migration does not backfill old CRM records. Staff addresses and explicit QA inquiries are excluded unless an authenticated broker deliberately creates an owner-only test.

Drafts use the existing AI SDK/Gateway integration. Generation is bounded to one request, 600 output tokens, an eight-second timeout, no model retries, and at most 25 claims per UTC day across the project. A safe template is visibly labeled when AI is unavailable or the input/output needs staff review. These checks cannot verify real estate facts; broker review remains required.

## Delivery and contact status

The broker approval RPC rechecks active broker access, current consent, current recipient, source snapshot, and exact draft version under database locks. It freezes the approved content and reserves an idempotency key before the provider call. The application derives recipient/content from that reservation, never from the approval form.

`accepted` means the provider accepted the request. It does not mean inbox delivery. Unknown network results or lost acknowledgements cannot be edited or retried as new sends. A failed request with a known provider rejection can be edited and explicitly approved again. There is no automatic resend loop. Resend idempotency has a finite 24-hour window and is not treated as permanent duplicate protection.

An already requested email cannot be retracted. Stopping a row preserves any later acceptance receipt. The immutable private audit records broker identity, content/version hashes, transitions and provider receipt. Contact replies must be recorded in the CRM; automatic inbox monitoring is not connected. Recorded conversations/appointments pause pending initial responses. A recipient opt-out or broker do-not-contact action suppresses future inquiry responses for the normalized email.

The public preferences link requires an explicit submission. It stops inquiry follow-up independently of saved-search alerts. Tokens are hashed in a private table and preference pages are excluded from analytics.

## Release and verification

1. Run the focused draft, delivery, UI, alert and database suites, lint, type checking, production build and existing browser CI.
2. Apply the additive migration before deploying the app. It creates the separate Vault credential but does not register a schedule.
3. Verify the protected preview with a synthetic owner inquiry. Keep real customer records out of QA. Test the actual model path separately from mocked model tests.
4. Apply the additive owner-test-actions migration, then sign into the private CRM as an existing broker. **Create a test reply draft** claims only that broker's exact test and drafts synchronously on the current app origin. It uses the same daily budget and per-job lease checks without exporting the scheduler credential or invoking the production dispatcher. Confirm whether the draft used AI or the labeled template fallback, review it, then **Approve and send test**. Check the matching message in that broker inbox independently of the provider response.
5. Use **Email me a test listing alert** once. It uses a current live listing and the existing subscriber template path, labels the sample, and creates no subscription. This proves template delivery; mocked change-detection tests separately exercise new-match, price-change and return-to-market logic.
6. Only after the worker release is verified, schedule `crm_private.dispatch_followup_worker()` through the existing database scheduler. The function claims one row and never sends an email. A five-minute pilot schedule keeps the 25-claim daily cap.

Use `cron.job` to check for an existing matching job before registering it. Pause the matching job to stop background drafting; this does not delete leads or drafts. Never retrieve the raw Vault credential for browser or client use.

`crm_private.dispatch_followup_worker()` deliberately targets the production domain. Do not invoke it to test a preview. Owner-test claim/complete/fail RPCs require the active broker, an owned `test_mode` row, the exact generation token and draft version; they cannot claim customer inquiries or send messages. The normal production worker and send paths are unchanged.

## Focused checks

```bash
node --test tests/follow-up-draft.test.mjs tests/follow-up-delivery.test.mjs tests/follow-up-ui.test.mjs tests/saved-search-delivery.test.mjs
FSR_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test tests/follow-up-db.test.mjs
npm run test:analytics-privacy
npm run lint
npm run build
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The database harness applies the real CRM security migrations in isolated PGlite, with fake authentication claims, Vault and HTTP boundaries. It does not contact the live database or prove multi-connection race behavior; locking order receives separate review. UI tests render real React with mocked external boundaries. Real deployment, broker sign-in, provider and inbox checks remain distinct evidence.

This release does not implement repeated email campaigns, SMS, automatic inbox reply detection, an autonomous marketing publisher, or advertising spend.
