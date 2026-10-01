---
backlog_id: IDEA-013
title: "No per-cron-cycle record of the scraper batch invocation — can't tell 'zero accounts scraped' from 'cron never fired'"
captured: 2026-09-11
implemented: 2026-09-14
---

# IDEA-013 — Scraper batch-run audit trail

## Capture

Reported by user via `bmad-help`. Verified: `scraper_actor_runs` (`schema.ts:283`) only gets a
row when a per-target trigger actually succeeds against a vendor (`record-actor-run.ts`) —
nothing records the EventBridge invocation itself. `scraper_provider_health` (`schema.ts:191`)
is the closest existing thing but is a single overwritten row per provider (Bright Data only),
tracking `consecutiveFailureDays`, not a per-cycle history. Today the only trace of "the cron
fired and found 0 targets" vs "the cron never fired" is `scraper.ts`'s `console.log` lines in
CloudWatch (ephemeral, not queryable from the app/DB).

Proposed fix: new `scraper_batch_runs` table, one row per EventBridge daily invocation
(`startedAt`/`completedAt`, `targetsFound`, `dispatchedSucceeded`/`dispatchedFailed` counts),
inserted at the start/end of `scraper.ts`'s EventBridge branch
(`apps/backend/src/lambdas/scraper.ts:35-114`) — same additive-observability shape as the
existing `recordProviderHealthCheck` call already in that branch. Not built at capture time:
needed its own migration + wiring, held back pending prioritization.

## Implemented, 2026-09-14 (bmad-quick-dev, commit d5ceb38)

New append-only `scraper_batch_runs` table in `packages/database/schema.ts` with its own
drizzle-kit migration `0053_add_scraper_batch_runs.sql` (+ `0053_snapshot.json` + journal
entry); new `apps/backend/src/lib/scraper/record-scraper-batch-run.ts` exposing
`recordScraperBatchRunStart` (opens the row) and `completeScraperBatchRun` (fills
`completedAt`/`targetsFound`/`dispatchedSucceeded`/`dispatchedFailed`) as siblings of
`scraper-provider-health-store`; wired into the EventBridge branch of
`apps/backend/src/lambdas/scraper.ts` — start inserted before target extraction, completion on
the success path (`targetsFound = targets.length`; a target counts as `dispatchedSucceeded` if
EITHER Bright Data or Apify succeeded), and also on the catch/error path (completed with zero
tallies) so a mid-batch crash still leaves a completed row proving the cron fired;
`recordScraperBatchRunStart` is wrapped in its own try/catch so observability failures never
abort the actual scrape batch. Table deliberately NOT soft-deleted (AD-8 exempts append-only
log/audit tables).

Verified: database build + backend typecheck clean; new integration test
`record-scraper-batch-run.test.ts` passes against local Postgres; eslint clean on changed
backend files (only warning, the unused `context` param in `scraper.ts`, is pre-existing).
