# Incident: Daily Scrape Found 0 Targets After a Recovery Rerun

**Date:** 2026-10-24
**Status:** Fixed in code; takes effect on the next backend deploy.

## Summary

The moderator tools "Actor runs" tab (`scraper_actor_runs`) showed no runs for 2026-10-24. The scheduled daily scrape had fired on time and logged `Found 0 distinct targets to scrape`.

## Timeline (UTC)

- **10-23 03:13** — `ScraperScheduleRule` (`rate(1 day)`) fired. The batch triggered Apify for ~35 targets at once and Apify refused 31 with 402 `actor-memory-limit-exceeded` (since fixed by bounded trigger concurrency).
- **10-23 15:59** — someone re-invoked the scraper Lambda by hand with an empty event `{}` to recover. It scraped all 38 subscribed profiles; `lastScrapedAt` was stamped between 16:00 and 16:25.
- **10-24 03:13** — the scheduled cycle fired. Every profile was ~11h old, inside `SCRAPE_SKIP_RECENT_HOURS` (12), so `getBatchScrapeTargets()` returned nothing. No runs were created, and nothing but the one log line said why.
- It would have self-healed on 10-25, but any late recovery rerun repeats this.

## Root Cause

`getBatchScrapeTargets()` judged "due" against a rolling window (`now - 12h`) for every invocation. That window is right for a hand-run invoke, but wrong for the cron: the cron fires once a day, so a rerun any time in the previous ~12h hides the whole cycle's work.

## Fix

- A scheduled invocation (`source: 'aws.events'`, `detail-type: 'Scheduled Event'`) now passes its event `time` to `getBatchScrapeTargets({ scheduledTime })`. A profile is due when it was never scraped or its `lastScrapedAt` is before `time - 1h` (`resolveScrapeDueCutoff` in `packages/domain/src/scraper/`). A duplicate delivery or Lambda async retry of the same cycle carries the same `time`, and the first delivery's stamps land after it, so those are still skipped.
- An empty/manual invoke, or a scheduled-looking event without a valid `time`, keeps the rolling `SCRAPE_SKIP_RECENT_HOURS` window.
- A cycle that finds 0 targets now logs why (profiles skipped as recently scraped and the newest `lastScrapedAt`, profiles held by an in-flight Bright Data job, profiles dropped for an unregistered platform) and stores the same text in the new `scraper_batch_runs.no_targets_reason` column, so a quiet day can be told from "nobody subscribed" with SQL.

## Operator note

A recovery rerun is still safe to run by hand: the next cron now scrapes everything that was not stamped within the hour before it fired. A rerun inside that last hour makes the cron skip those profiles on purpose.
