---
title: 'Fix database seed FK violation on brightdata/apify pending jobs'
type: 'bugfix'
created: '2026-08-29'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** `pnpm --filter database seed` failed with a `23503` foreign-key violation (`brightdata_pending_jobs_profile_id_social_media_account_profile`) because `seedDatabase()`'s cleanup transaction deleted `social_media_account_profiles` and `scraper_actor_runs` rows without first clearing `brightdata_pending_jobs`/`apify_pending_jobs`, which reference both.

**Approach:** Add `brightdataPendingJobs`/`apifyPendingJobs` to the seed's explicit FK-safe deletion order (before `scraperActorRuns` and `socialMediaAccountProfiles`), and add an integration-test regression case that plants pending-job rows referencing a seeded profile between two seed runs to prove the rerun no longer throws.

## Suggested Review Order

**Seed cleanup order fix**

- Entry point — the two missing deletes, placed ahead of the tables they reference, in FK-dependency order.
  [`seed.ts:939`](../../packages/database/seed.ts#L939)

- Updated comment explaining why these two tables need explicit cleanup (no cascade from users/events/profiles).
  [`seed.ts:937`](../../packages/database/seed.ts#L937)

- New imports for the two tables, grouped next to their closest logical relative (`scraperActorRuns`).
  [`seed.ts:19`](../../packages/database/seed.ts#L19)

**Regression coverage**

- Plants a `brightdata_pending_jobs`/`apify_pending_jobs` row referencing a seeded profile between the two seed runs the existing test already performs, reproducing the exact bug scenario (a row created outside the seed script, e.g. by a real scraper webhook).
  [`seed.integration.test.ts:228`](../../packages/database/seed.integration.test.ts#L228)

- Asserts the rerun clears both tables rather than leaving the planted rows or failing.
  [`seed.integration.test.ts:376`](../../packages/database/seed.integration.test.ts#L376)

- New imports for the two tables and their assertion helpers.
  [`seed.integration.test.ts:15`](../../packages/database/seed.integration.test.ts#L15)
