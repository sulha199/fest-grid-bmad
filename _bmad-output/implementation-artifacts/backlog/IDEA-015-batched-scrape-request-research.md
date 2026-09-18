---
backlog_id: IDEA-015
title: "Research: is batching multiple accounts into one scrape request cheaper/faster than one request per account?"
captured: 2026-09-11
---

# IDEA-015 — Batched vs per-account scrape request research

## Capture

Reported by user via `bmad-help`. Today both vendor triggers fire one actor run per subscribed
account per cron cycle (`attemptBrightDataTrigger`/`attemptApifyAsyncTrigger`, called per-target
in the `scraper.ts` batch loop) — Apify's `instagram-post-scraper` actor already accepts a
username/`directUrls` array in one call (see `instagram-adapter.ts`), so multi-account batching
may already be mechanically possible there; Bright Data's `trigger-brightdata-for-target.ts`
takes a single url per call, unclear if its dataset API supports batched profile requests
without checking their docs.

## Deliverable

Per the user's explicit request: the research itself should produce a runnable bash/pwsh
script that empirically drives both request shapes (N single-account calls vs 1 batched
N-account call) against a sample account set and compares actual cost
(`SCRAPER_PRICE_PER_1000_ITEMS_USD`-style per-item billing) and latency/duration, not just a
written comparison of vendor docs.

## Priority

Explicitly low priority per the user (current subscribed-account count is small, so
per-request overhead is negligible) — revisit and re-prioritize as the active-account count
grows, since a fixed per-request overhead cost scales linearly with account count under the
current one-request-per-account model.

Triaged 2026-09-18 alongside FIND-034 (same scraper/request-cost neighborhood).
