# Shared MLS request coordination

FBS support confirmed on November 6, 2026 that concurrent identical requests are unsupported, a query taking at least ten seconds can cause a five-minute block on repeats, and a disconnected client does not necessarily stop server-side work. Support recommends a 15–30 second wait before retrying an interrupted identical query and says early retries may prolong throttling. The precise error discriminator, enforcement scope and server deadline remain unconfirmed.

## Request path

The existing response cache and local duplicate suppression run first. Cache identity includes request headers, including access credentials and representation, hashed with the normalized URL. Cache hits require no coordination or provider request.

When `RESO_COORDINATOR_SECRET` is configured, a shared coordinator wraps the worker's existing admission policy. It uses atomic Supabase RPCs to reserve actual provider work and share a short-lived successful result with other workers. Normal URL strings and Request objects both pass through shared admission. Requests to other hosts and non-GET methods keep their existing behavior.

The coordinator holds its reservation through the full response body and completion write. An interrupted body is not a completed successful fetch. A local admission response is identified by `X-FSR-RESO-Admission: local`, releases an unused reservation, and never starts or extends a provider cooldown.

The current six-second guard covers coordination and provider work, inside the caller's existing ten-second deadline. Time spent coordinating therefore reduces the remaining network time. A timeout before provider dispatch is a local coordination failure, not evidence of a provider failure. Completion writes have independent, bounded deadlines so cancellation by a visitor cannot cancel the state update protecting later requests.

## Application settings

| Control | Setting | Meaning |
| --- | --- | --- |
| Shared concurrency | 4 reservations | Includes interrupted requests during their hold. This is our conservative setting, not a provider-confirmed maximum. |
| Rolling request budget | 1,200 reservations per five minutes | Leaves room below the published 1,500 IDX allowance. Definite local/pre-dispatch rejections refund their reservation. |
| Throttling | At least 300 seconds | Applies to unclassified upstream 429s; a longer applicable Retry-After is retained. |
| Interrupted query | 30 seconds after completion handling | Retains the query reservation and a capacity slot because FBS may still be working. |
| Uncertain/crashed owner | 330-second reservation | Covers five minutes plus a margin when completion cannot be persisted; ordinary successful completion releases immediately. |
| Shared successful result | 30 seconds | At most 1 MiB raw response body and 2 MiB encoded snapshot. |
| Shared result storage | 32 snapshots / 32 MiB per scope | Responses have a narrow header allowlist; transport and cookie headers are excluded. Expired rows are pruned during subsequent activity. |

All workers, including previews and background refreshes using the same feed, must use the same coordinator identity and scope. Standalone scripts, other integrations, and deployments without shared configuration are outside this application's budget. Neither the 30-second hold nor the orphan lease proves when a provider query has finished.

An actual 429 can extend the shared pause. Local blocked requests cannot extend it. Recovery permits one probe, and generation fencing prevents an older response from clearing a newer failure. Until FBS provides reliable response details, ambiguous 429s use a conservative shared pause rather than a guessed query-specific classification. This may temporarily defer otherwise healthy uncached searches.

## Authorization and configuration

The migration creates a dedicated, unexposed `fsr_mls_private` schema. The two public RPCs use `SECURITY INVOKER`; all tables use row-level security. The Supabase publishable key alone grants no coordinator access. RPCs also require a dedicated high-entropy server secret in the `x-fsr-mls-coordinator` header. The database stores only its SHA256 fingerprint. The anonymous role can select only the authorized coordinator ID from the credential table and cannot read the hash, add credentials, or modify authorization.

Provision the credential separately from the migration, using an independently generated random secret of at least 32 characters. Store its fingerprint in `fsr_mls_private.credentials`; put the raw secret only in the protected Vercel `RESO_COORDINATOR_SECRET` variable. Do not reuse or store a Spark access token for this purpose. No shared tables contain raw request URLs, query parameters or authorization headers.

Without the new environment variable the application retains its legacy local policy, now with a five-minute default 429 pause. This supports a controlled rollout, but is not shared protection. Once enabled, coordinator outages fail closed: the app uses an existing cached response where available, or returns the established temporary-unavailability state. It never bypasses shared admission to contact Spark directly.

## Verification and release

Run the existing test suite plus coordinator, instrumentation-integration and database verification. The database verification script uses a transaction and rolls back synthetic credentials, scopes and results. Exercise concurrent independent clients against the real RPCs with a synthetic upstream; do not induce a real Spark throttling event.

Before publication, verify the target project, migrated schema, protected secret configuration, exact commit build, and the public search/filter/detail flow. Inspect shared reservation counters and runtime failures after release. No listing filters, provider sort clauses, pagination, photos, saved-search behavior or MLS request payload fields are intentionally changed by this repair.

Rollback uses the previous known-good immutable production deployment. The added schema can remain unused during rollback; do not drop shared state while any deployment still uses it. A newly created deployment only enables shared coordination when its server secret is present.
