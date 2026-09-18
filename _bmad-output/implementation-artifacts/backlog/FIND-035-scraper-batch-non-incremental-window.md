---
backlog_id: FIND-035
title: "Daily scraper batch cron re-requests a fixed 7-day window for every account every day instead of scraping incrementally"
captured: 2026-09-18
---

# FestDaily backlog note: FIND-035

## Finding

User-reported (2026-09-18): observed the daily scraper issuing a long, overlapping
date range on every run instead of scraping incrementally from each account's
last-known post.

Root-caused via direct code reading, not assumed:

- [apps/backend/src/lambdas/scraper.ts:91](../../../apps/backend/src/lambdas/scraper.ts#L91)
  (the EventBridge-triggered daily-batch path — the actual cron, not the SQS
  fallback) computes `newerThan` as a **hardcoded, non-incremental** rolling
  window for every target on every invocation:
  ```ts
  const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  ```
  This value is passed unchanged to both `attemptBrightDataTrigger` and
  `attemptApifyAsyncTrigger` for every account in `getBatchScrapeTargets()`'s
  result, every single day. Each day's 7-day window overlaps ~6 days with the
  previous day's — the daily cron re-requests posts it already scraped
  yesterday, and the day before, etc., indefinitely.

- **The correct incremental logic already exists in this codebase**, just
  wired to the wrong path. [process-scrape-job.ts:132-139](../../../apps/backend/src/lib/scraper/process-scrape-job.ts#L132-L139)
  (the SQS-fallback path, only reached when both async vendor triggers fail)
  already does this correctly:
  ```ts
  let newerThan: string;
  if (newestPost) {
    newerThan = newestPost.publishedAt.toISOString();  // incremental
  } else {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - env.scrapeInitialLookbackDays);
    newerThan = lookbackDate.toISOString();  // first-ever scrape only
  }
  ```
  `newestPost` comes from `SELECT publishedAt FROM posts WHERE accountId = ... ORDER BY publishedAt DESC LIMIT 1`.
  `env.scrapeInitialLookbackDays` (`SCRAPE_INITIAL_LOOKBACK_DAYS`, default 7)
  is explicitly meant only for an account's first-ever scrape (no posts yet)
  — but since the primary daily-batch path never checks `newestPost` at all,
  every account is treated as a first-ever scrape, every day, forever.

## Why this matters more than a queue-cost issue

This drives real **metered vendor cost** (Bright Data/Apify per-item billing,
tracked by `scraperMonthlyBudgetUsd`/`scraperPricePerThousandItemsUsd` in
`env.ts`), not just AWS free-tier float. Redundant re-scraping of the same
~6-day overlap for every subscribed account, every day, is a recurring
real-dollar cost, not a one-time or capped-at-free issue.

`persistScrapedPost` presumably dedupes by post URL so this isn't creating
duplicate DB rows — the waste is entirely upstream, in vendor API usage and
the scrape-processing pipeline work (queue traffic, AI extraction attempts on
already-seen posts if any slip through, etc.) for content already known.

## Suggested fix

Extend `getBatchScrapeTargets()` ([get-scrape-targets.ts](../../../apps/backend/src/lib/scraper/get-scrape-targets.ts))
to fetch each account's most recent post date in the same query — one
`MAX(publishedAt) GROUP BY accountId` join/subquery against `posts`, joined
onto the existing target selection, avoiding an N+1 per-target query — and
attach it to `ScrapeTarget` (new optional field, e.g. `newestPostPublishedAt`).

In `scraper.ts`'s batch loop, replace the hardcoded window with:
```ts
const newerThan = target.newestPostPublishedAt?.toISOString()
  ?? lookbackFallback(env.scrapeInitialLookbackDays);
```

Reuses the exact incremental pattern already proven correct in
`process-scrape-job.ts`, just applied to the path that actually drives the
daily cron. No new mechanism — extending an existing query and wiring an
already-existing env var (`scrapeInitialLookbackDays`) into the path that
should have used it from the start.

## Status

Triaged — root-caused with exact file/line evidence, fix pattern already
proven elsewhere in the same codebase, no architectural/UX ambiguity.
Estimated `effort: s` (one story-sized change, single query extension +
single call-site fix + test coverage for both the incremental and
first-ever-scrape branches). Tracked as `FIND-035` on `backlog.yaml`.
