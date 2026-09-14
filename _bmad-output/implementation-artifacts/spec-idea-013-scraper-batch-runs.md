---
title: 'Per-cron-cycle scraper batch run audit record (scraper_batch_runs)'
type: 'feature'
created: '2026-09-14'
status: 'done'
route: 'one-shot'
---

# Per-cron-cycle scraper batch run audit record (scraper_batch_runs)

## Intent

**Problem:** There is no per-cron-cycle record of the EventBridge daily batch-scrape invocation, so the app/DB cannot tell "the cron fired and found 0 targets" from "the cron never fired" — the only trace today is scraper.ts's ephemeral console.log lines in CloudWatch.

**Approach:** Add an append-only `scraper_batch_runs` table and record one row per EventBridge invocation in `apps/backend/src/lambdas/scraper.ts`'s EventBridge branch (inserted at the start, completed at the end with `targetsFound`/`dispatchedSucceeded`/`dispatchedFailed` counts) — the same additive-observability shape as the existing `recordProviderHealthCheck` call — with its own Drizzle migration.

## Suggested Review Order

1. [packages/database/schema.ts:209](packages/database/schema.ts:209) — new `scraperBatchRuns` table definition (audit/log-like, deliberately not soft-deleted per AD-8).
2. [packages/database/migrations/0053_add_scraper_batch_runs.sql](packages/database/migrations/0053_add_scraper_batch_runs.sql) — drizzle-kit generated migration + meta/_journal.json + 0053_snapshot.json.
3. [apps/backend/src/lib/scraper/record-scraper-batch-run.ts](apps/backend/src/lib/scraper/record-scraper-batch-run.ts) — `recordScraperBatchRunStart` / `completeScraperBatchRun` (sibling of `scraper-provider-health-store.ts`).
4. [apps/backend/src/lambdas/scraper.ts:43](apps/backend/src/lambdas/scraper.ts:43) — EventBridge-branch wiring: start insert, success-path completion, and error-path completion.
5. [apps/backend/src/lib/scraper/record-scraper-batch-run.test.ts](apps/backend/src/lib/scraper/record-scraper-batch-run.test.ts) — integration test asserting start + completion persist the row.
