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
metered vendor cost, not a one-time float. The correct incremental logic (use the
account's newest known `posts.publishedAt`, falling back to
`env.scrapeInitialLookbackDays` only when the account has zero posts) already exists
in `process-scrape-job.ts:132-139`, but only the SQS-fallback path uses it.

**Approach:** Extend `getBatchScrapeTargets()` to batch-fetch each target's newest
`posts.publishedAt` in one grouped query (not N+1), attach it to `ScrapeTarget` as
`newestPostPublishedAt`, then have `scraper.ts`'s batch loop use
`target.newestPostPublishedAt?.toISOString() ?? lookbackFallback(env.scrapeInitialLookbackDays)`
per-target instead of one hardcoded window for all targets.

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

- `apps/backend/src/lib/scraper/get-scrape-targets.ts` -- add batched `MAX(publishedAt) GROUP BY accountId` query against `posts`, attach `newestPostPublishedAt` to each `ScrapeTarget`
- `apps/backend/src/lambdas/scraper.ts:91` -- replace hardcoded 7-day `newerThan` with per-target `target.newestPostPublishedAt?.toISOString() ?? lookbackFallback(...)`; add local `lookbackFallback` helper; hoist `loadBackendEnv()` call out of the per-target loop
- `apps/backend/src/lib/scraper/process-scrape-job.ts:132-139` -- reference only (proven pattern being mirrored), not modified
- `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` -- existing test conventions (real local Postgres, `node:test`, seeded users) to follow for new coverage

## Tasks & Acceptance

**Execution:**
- [x] `apps/backend/src/lib/scraper/get-scrape-targets.ts` -- add `newestPostPublishedAt?: Date` to `ScrapeTarget`; batch-fetch newest `publishedAt` per `profileId` from `posts` via one grouped query keyed to the current batch's target ids; attach to each returned target -- eliminates the hardcoded-window root cause at its data source
- [x] `apps/backend/src/lambdas/scraper.ts` -- add a small `lookbackFallback(days: number): string` helper; hoist one `loadBackendEnv()` call above `targets.map(...)`; replace the hardcoded `newerThan` line with the per-target incremental expression -- wires the batched data into the actual cron path
- [x] `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` -- add cases: account with prior posts gets its newest `publishedAt`; account with zero posts gets `newestPostPublishedAt: undefined` -- covers the I/O matrix (the "zero targets → no posts query" case is enforced structurally by the `profileIds.length > 0` guard rather than a query-count spy)
- [x] `apps/backend/src/lambdas/scraper.test.ts` -- verify `attemptBrightDataTrigger`/`attemptApifyAsyncTrigger` receive a per-target `newerThan` derived from `newestPostPublishedAt` when present, and the lookback fallback otherwise -- proves the wiring, not just the query

**Acceptance Criteria:**
- Given an account with existing posts, when the daily batch cron runs, then the vendor trigger call's `newerThan` equals that account's newest `posts.publishedAt` (not a fixed 7-day window).
- Given an account with zero posts, when the daily batch cron runs, then `newerThan` falls back to `env.scrapeInitialLookbackDays` days ago.
- Given a batch of N targets, when `getBatchScrapeTargets()` runs, then exactly one additional query (not N) is issued against `posts` to resolve newest-post dates.

## Spec Change Log

## Design Notes

`ScrapeTarget.newestPostPublishedAt` is optional and additive so no existing consumer
(`process-scrape-job.ts`, `trigger-brightdata-for-target.ts`, `trigger-apify-for-target.ts`,
tests) needs to change. The grouped query mirrors the existing `brightdataPendingJobs`
second-query pattern already in `get-scrape-targets.ts` (fetch once, build a `Map` for
O(1) per-row lookup) rather than a `JOIN`, since a `JOIN` against a `GROUP BY`'d subquery
would complicate the existing dedup/filter logic for no benefit.

## Verification

**Commands:**
- `cd apps/backend && pnpm test get-scrape-targets` -- expected: existing + new cases pass against local Postgres
- `cd apps/backend && pnpm test scraper` -- expected: new wiring test passes (create file if none exists)
- `pnpm --filter backend typecheck` (or repo's equivalent) -- expected: no new TS errors

## Suggested Review Order

**Incremental window computation (the fix)**

- Entry point: the hardcoded 7-day window is replaced with the per-target incremental expression, sourced from the batched query below.
  [`scraper.ts:108`](../../apps/backend/src/lambdas/scraper.ts#L108)

- Fallback for an account with no posts yet -- mirrors `process-scrape-job.ts`'s already-proven SQS-fallback logic.
  [`scraper.ts:24`](../../apps/backend/src/lambdas/scraper.ts#L24)

- `env` is hoisted out of the per-target loop so `loadBackendEnv()` runs once per batch, not once per target.
  [`scraper.ts:100`](../../apps/backend/src/lambdas/scraper.ts#L100)

- The new field this whole fix hinges on -- additive/optional so no existing consumer needs to change.
  [`get-scrape-targets.ts:17`](../../apps/backend/src/lib/scraper/get-scrape-targets.ts#L17)

- One grouped `MAX(publishedAt) GROUP BY accountId` query for the whole batch (not N+1), built the same fetch-once-then-`Map`-lookup shape as the existing `brightdataPendingJobs` check just above it.
  [`get-scrape-targets.ts:63`](../../apps/backend/src/lib/scraper/get-scrape-targets.ts#L63)

**Observability**

- Logs the actual per-account window used, so a regression back to a wide/hardcoded window is visible in CloudWatch without waiting on vendor billing.
  [`scraper.ts:113`](../../apps/backend/src/lambdas/scraper.ts#L113)

**Tests**

- Proves the query returns the newest (not oldest) `publishedAt` when posts exist, and `undefined` when none do.
  [`get-scrape-targets.test.ts:375`](../../apps/backend/src/lib/scraper/get-scrape-targets.test.ts#L375)

- Proves `scraper.ts` actually consumes the new field end-to-end (not just that the query returns it), via the existing vendor-trigger test seams.
  [`scraper.test.ts:105`](../../apps/backend/src/lambdas/scraper.test.ts#L105)
