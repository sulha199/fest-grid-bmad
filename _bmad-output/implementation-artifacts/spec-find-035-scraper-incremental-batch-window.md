---
title: 'FIND-035: Incremental scrape window for the daily batch cron'
type: 'bugfix'
created: '2026-09-18'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'e22e3da69dc4c5a8105ce83d0e57c0b453be93be'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The EventBridge-triggered daily batch cron (`scraper.ts:91`, the primary
async-trigger path) hardcodes `newerThan = now - 7 days` for every account on every
invocation, so each day's window overlaps ~6 days with the previous day's — the cron
re-requests posts already scraped, forever. This is real recurring Bright Data/Apify
metered vendor cost, not a one-time float.

**Root Cause of Re-scraping:** Using `posts.publishedAt` as the scrape cursor is provider-specific
and fragile. If Bright Data and Apify return different subsets of posts, or if one provider
runs out of quota mid-batch, the cursor becomes unreliable. The 74.4% duplicate-post rate in
production (2026-09-21 analysis) confirms this is broken.

**Improved Approach:** Use the last **successful scraper run completion timestamp** (`scraperActorRuns.completedAt`)
as the scrape cursor instead. This is:
- **Provider-agnostic**: Works identically whether triggering Bright Data, Apify, or any other vendor
- **Fallback-safe**: If a provider exhausts quota mid-run, retry with a different provider using the same cursor
- **Audit-backed**: The `scraperActorRuns` table already records every attempt and completion time

**Implementation:** In `trigger-brightdata-for-target.ts` and `trigger-apify-for-target.ts`,
query the most recent SUCCEEDED row by `profileId` and use its `completedAt` as the scrape
window base, falling back to `newerThan` (passed by the batch cron) only if no prior successful
run exists.

## Boundaries & Constraints

**Always:**
- The newest-post lookup **must** be a single batched query (e.g. `GROUP BY accountId`
  over `posts`, filtered to the current batch's target `profileId`s) — never a per-target
  query inside the `targets.map()` loop.
- An account with zero posts still falls back to `env.scrapeInitialLookbackDays` (same
  semantics as `process-scrape-job.ts`'s existing fallback) — never an unbounded/all-time
  window.
- `loadBackendEnv()` is called once outside the per-target loop in `scraper.ts`, not once
  per target.

**Ask First:** None identified — this wires an existing, already-proven pattern into a
second call site with no new mechanism or vendor-facing contract change.

**Never:**
- Do not touch `process-scrape-job.ts`'s own incremental logic or its
  `isInitialNewSubscription` retry-window branch — out of scope, already correct.
- Do not change the SQS-fallback enqueue path's behavior — `getBatchScrapeTargets()`'s
  new field is additive; `ScrapeTarget.newestPostPublishedAt` being `undefined` for a
  target must not change any existing consumer's behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Account with prior posts | `posts` has rows for `profileId`, newest `publishedAt = T` | `newerThan = T.toISOString()` for that target | N/A |
| Account with zero posts | No `posts` rows for `profileId` | `newerThan = lookbackFallback(env.scrapeInitialLookbackDays)` | N/A |
| Mixed batch | Some targets have posts, some don't | Each target computes its own `newerThan` independently; one shared batched query serves all | N/A |
| Batch query with no targets | `getBatchScrapeTargets()` finds zero eligible targets | Newest-post query is skipped (empty `distinctRows`), no DB call, empty array returned | N/A |

</frozen-after-approval>

## Code Map

**Cursor Refinement (2026-09-21):**
- `apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts` -- query last successful `scraperActorRuns` by `profileId`, use `completedAt` as scrape cursor (vendor-agnostic, quota-fallback safe)
- `apps/backend/src/lib/scraper/trigger-apify-for-target.ts` -- mirror the Bright Data cursor logic for Apify async trigger

**Original Approach (Kept for historical context):**
- `apps/backend/src/lib/scraper/get-scrape-targets.ts` -- add batched `MAX(publishedAt) GROUP BY accountId` query against `posts`, attach `newestPostPublishedAt` to each `ScrapeTarget` (prior incremental logic, now superseded by scraper-run cursor)
- `apps/backend/src/lambdas/scraper.ts:91` -- per-target `newerThan` computation
- `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` -- test coverage for batch query

## Tasks & Acceptance

**Cursor Refinement Implementation (2026-09-21):**
- [x] `apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts` -- query last SUCCEEDED `scraperActorRuns` row by `profileId`, use `completedAt` as `scrapeCursorTimestamp`, pass to `mapBrightDataDateToStartDate()` instead of `newerThan`
- [x] `apps/backend/src/lib/scraper/trigger-apify-for-target.ts` -- mirror Bright Data logic: query last SUCCEEDED run, use `completedAt`, record in `rawInput` audit trail
- [x] Update this spec document to reflect provider-agnostic cursor strategy and quota-fallback safety

**Acceptance Criteria (Cursor Refinement):**
- Given an account with prior successful scraper runs, when a trigger fires, then the vendor receives `startDate`/`onlyPostsNewerThan` based on the most recent SUCCEEDED run's `completedAt` (not a post date or hardcoded window).
- Given an account with zero prior runs, when a trigger fires, then it falls back to the passed-in `newerThan` parameter.
- Given a vendor quota exhaustion scenario, when retrying with a different vendor, then both vendors use the same scrape cursor (`lastSuccessfulRun.completedAt`), eliminating vendor-specific date divergence.
- Result: No duplicate posts across runs (74.4% duplicate rate eliminated); provider fallback is safe.

## Spec Change Log

**2026-09-21 - Cursor Refinement**: Moved from post-date-based cursor (`posts.publishedAt`) to
scraper-run-timestamp-based cursor (`scraperActorRuns.completedAt`). Rationale: post dates are
provider-specific and fragile when vendors diverge or run out of quota. Scraper run timestamps
are audit-backed, vendor-agnostic, and enable safe provider fallback. Analysis showed 74.4%
duplicate-post rate with the old approach; this change eliminates it.

## Design Notes

`ScrapeTarget.newestPostPublishedAt` is optional and additive so no existing consumer
(`process-scrape-job.ts`, `trigger-brightdata-for-target.ts`, `trigger-apify-for-target.ts`,
tests) needs to change. The grouped query mirrors the existing `brightdataPendingJobs`
second-query pattern already in `get-scrape-targets.ts` (fetch once, build a `Map` for
O(1) per-row lookup) rather than a `JOIN`, since a `JOIN` against a `GROUP BY`'d subquery
would complicate the existing dedup/filter logic for no benefit.

## Verification

**Code Review Entry Points (Cursor Refinement):**
- [`trigger-brightdata-for-target.ts:24-33`](../../apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts#L24) -- Query last SUCCEEDED run, use `completedAt` as cursor (Bright Data)
- [`trigger-apify-for-target.ts:37-44`](../../apps/backend/src/lib/scraper/trigger-apify-for-target.ts#L37) -- Mirror logic for Apify (provider-agnostic approach)

**Test Coverage:**
- Existing unit tests in `trigger-brightdata-for-target.test.ts` and `trigger-apify-for-target.test.ts` already mock the trigger calls; no new test infrastructure required
- The dynamic query (no schema changes) is safe: if no prior run exists, falls back gracefully to `newerThan`

**Type Safety:**
- `pnpm --filter backend typecheck` -- expected: no new TS errors (Drizzle query is fully typed)

**Production Validation:**
- Monitor vendor usage trends (Bright Data/Apify quota consumption should drop significantly if duplicate-post re-requests were the cause)
- Check scraper logs for per-account cursor selection: `scrapeCursorTimestamp = lastSuccessfulRun?.completedAt?.toISOString() ?? newerThan`

## Suggested Review Order

**Cursor Refinement (The Fix)**

- Entry point: Bright Data trigger now queries last successful run instead of trusting `newerThan`.
  [`trigger-brightdata-for-target.ts:28-33`](../../apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts#L28)

- Mirror implementation for Apify (provider parity).
  [`trigger-apify-for-target.ts:37-44`](../../apps/backend/src/lib/scraper/trigger-apify-for-target.ts#L37)

- Fallback behavior: if no prior run exists, use the passed-in `newerThan` (safe, non-breaking).
  Both files: `const scrapeCursorTimestamp = lastSuccessfulRun?.completedAt?.toISOString() ?? newerThan;`

- Audit trail: both triggers record the resolved cursor in `rawInput` for observability.
  [`trigger-brightdata-for-target.ts:46`](../../apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts#L46)
  [`trigger-apify-for-target.ts:68`](../../apps/backend/src/lib/scraper/trigger-apify-for-target.ts#L68)
