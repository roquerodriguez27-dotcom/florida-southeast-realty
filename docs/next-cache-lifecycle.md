# Next 16.2.10 cache lifecycle correction

## Why this patch exists

A local, production-build reproduction shows that `unstable_cache` can begin a stale refresh after Next has already captured its pending-revalidation list. This happens after a streamed HTML shell with a slow cache read and during ordinary RSC navigation. The existing stale response still succeeds, but the refresh and its later cache write may not be registered with the serverless request lifetime.

Registering only the provider promise with `after()` is incomplete: Next writes the cache after that promise settles. Removing loading boundaries is also incomplete because RSC navigation still exhibits the gap. The reproduction establishes a framework defect, not that it caused a particular production timeout.

## Scope

The install script patches only the exact reviewed CJS and ESM `unstable-cache` files in Next 16.2.10. It retains:

1. The existing lookup promise immediately, including if the client disconnects during lookup.
2. The existing stale refresh promise, including its awaited serialization/cache write.
3. The existing cold-miss cache-write promise.

No new provider call is started. Original keys, pending promises, deduplication, stale fallback, cancellation reasons, static-generation waits, and error handling remain intact. The lifecycle-only derivative catches rejection without logging another raw error; the original promise remains unchanged. The six-second upstream timeout, admission, concurrency and backoff are not modified.

This is a private, version-specific framework correction, not a supported public application API. It checks the reviewed `afterContext.waitUntil` field before using the existing promise-registration path. If request lifetime support is absent, old behavior is preserved; this patch does not claim to fix an unsupported deployment platform.

## Installation and builds

- `postinstall` applies the patch. Both original source hashes and the exact Next version are checked before either file is written.
- Re-running is idempotent. Known original/patched states can safely recover from an interrupted installation. Modified or unknown source fails closed.
- `prebuild` verifies installation and removes only `.next/cache/webpack`. It preserves `fetch-cache` and other warm application data. This is necessary because webpack may otherwise reuse an unpatched dependency despite the changed source.
- Turbopack production filesystem caching is disabled in the reviewed Next/configuration pair. Reassess this patch before enabling it.
- `postbuild` checks for the compiled lifecycle guard. This is a smoke check, not structural or runtime proof by itself.
- Direct `next build` bypasses npm lifecycle hooks. Use `npm run build`, as the verified Vercel project build does.

Run the normal unit tests, lint, TypeScript and complete app build. Also run `npm run test:cache-lifecycle`. That command builds an isolated synthetic application with both webpack and Turbopack and tests actual Next lifecycle registration for HTML, RSC, slow/fresh/cold cache paths, same-key deduplication, shared metadata, prefetch, client disconnect, delayed cache writes, and static generation. It uses loopback requests and synthetic data only.

Do not change the Next version or either pinned source hash merely to make installation pass. Reproduce the issue against the proposed framework version and review any new correction. Remove this patch once an upstream correction is verified.

## Rollback

For an urgent production regression, route traffic back to the previously verified immutable production deployment. This avoids rebuilding with uncertain dependency/compiler caches. The pre-change release is commit `d2f031cf49a65d378787710f22fde2e5135a966d`, Vercel deployment `dpl_3qXeix1EaA52oap5ULvHFSPoBxK8`. Recheck its availability before use.

For a source/workspace rollback:

1. While this script is still present, run `node scripts/next-cache-lifecycle.mjs --restore`. It validates both files, restores their exact original bytes, and invalidates only the webpack compiler cache.
2. Remove/revert this change's package hooks and files. Otherwise the next install/build deliberately reapplies the correction.
3. Reinstall original locked dependencies with `npm ci`, then run the complete build/checks. Preserve warm fetch data. Use a fresh dependency installation and compiler output for a rebuilt deployment.
4. Confirm the original source hashes and inspect the rebuilt output before using it. A Git revert alone does not prove cached node_modules or compiled chunks are unpatched.

The installer tests verify exact-byte restoration and fail closed if an unexpected modification would make restoration uncertain.
