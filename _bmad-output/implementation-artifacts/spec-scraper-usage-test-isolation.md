---
title: 'Fix scraper-provider-usage test isolation'
type: 'bugfix'
created: '2026-08-29'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** `scraper_provider_usage` is a real, persistent Postgres row shared across backend test files. `instagram-adapter.test.ts` and `trigger-apify-for-target.test.ts` only cleaned it up via `t.afterEach`, so any interrupted run (crash, Ctrl-C, timeout) left a poisoned `apify` row with capacity exhausted behind — silently failing whichever *other* test file next exercised the real Apify capacity gate (e.g. `extraction.test.ts`'s "new post path" subtest), which doesn't own that row at all. This produced exactly the kind of flake reported: a different test fails on each run depending on what pollution happened to be sitting in the DB.

**Approach:** Added a shared `clearApifyProviderUsage()` helper (`usage-store-test-helpers.ts`) and called it up front (self-heal from prior pollution) and in teardown (don't leak) in all three files that touch the real `apify` capacity row, so correctness no longer depends on a previous run's cleanup having succeeded. Added a regression test proving the helper actually clears a poisoned row and restores capacity.

## Suggested Review Order

**Root cause fix**

- Shared cleanup helper — single source of truth instead of copy-pasted deletes in 3 files
  [`usage-store-test-helpers.ts:12`](../../apps/backend/src/lib/scraper/usage-store-test-helpers.ts#L12)

- Regression test proving the helper clears a poisoned/exhausted row and capacity recovers
  [`usage-store-test-helpers.test.ts:9`](../../apps/backend/src/lib/scraper/usage-store-test-helpers.test.ts#L9)

**Consuming test files**

- Upfront guard + afterEach now both use the shared helper
  [`instagram-adapter.test.ts:13`](../../apps/backend/src/lib/scraper/instagram-adapter.test.ts#L13)

- Same pattern; also fixes a `t.afterEach` that only ran from partway through the file
  [`trigger-apify-for-target.test.ts:13`](../../apps/backend/src/lib/scraper/trigger-apify-for-target.test.ts#L13)

- Guard moved to outer scope (was nested inside a subtest) and teardown now clears the row this file itself creates via the real capacity gate, not just a leftover from a prior run
  [`extraction.test.ts:39`](../../apps/backend/src/schema/extraction.test.ts#L39)

**Tracking**

- Deferred: real Apify `/users/me/limits` integration (split from this intent, needs its own planning pass); a pre-existing invalid-UUID bug in `trigger-apify-for-target.test.ts` found while verifying this fix (blocks full runtime verification of that one file, unrelated to the isolation fix itself)
  [`deferred-work.md:114`](../../_bmad-output/implementation-artifacts/deferred-work.md#L114)
