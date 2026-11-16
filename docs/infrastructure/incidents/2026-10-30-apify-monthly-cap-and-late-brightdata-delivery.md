# Incident: Apify monthly cap reached, repeated posts, and Bright Data results dropped for arriving late

**Date:** 2026-10-29 / 2026-10-30
**Status:** Code fixed and merged (PR #118); 2026-10-29 posts recovered on prod; the Apify account is still capped until 2026-11-23.

## Summary

From 2026-10-29 07:23 UTC every Apify start was refused with 403 `platform-feature-disabled` ("Monthly usage hard limit exceeded"). On 10-30 the daily batch had Bright Data degraded, so ~35 of 38 targets went to Apify and got nothing. Looking into it found two older, quieter losses: a scrape window that never advanced (about 30% of billed Apify items were repeats) and 21 Bright Data snapshots whose results were dropped for arriving after the job's expiry.

## Findings

- **The cap.** Prod's Apify account (`lilikandriyani_dev`) is on the FREE plan: `maxMonthlyUsageUsd` 5, usage cycle 2026-10-23 to 2026-11-22, usage $5.11. Reset: 2026-11-23 00:00 UTC. The local `.env` token is a different account and says nothing about prod.
- **Why it filled.** Bright Data returned nothing or failed 10-23 to 10-28, so the whole daily load fell back to Apify (~1,640 items, about $4.4 at the app's $2.70 per 1,000, plus run overhead). The normal Apify load is about 230 items/day (~$19/month), more than the Free plan allows even without an outage.
- **Repeated Apify items.** 489 of 1,642 item rows (30%) in 230 successful runs were posts an earlier run had already returned for the same profile. 133 were the boundary post (Apify's `onlyPostsNewerThan` includes a post published exactly at the filter). 303 came from a cursor that never moved: it was `max(posts.publishedAt)` over posts the profile OWNS, but a co-authored post is stored once under one owner. 164 of the 166 posts stored under another profile had an association row for the scraped profile.
- **Bright Data repeats are small.** 48 of 714 rows (6.7%), mostly same-day, because `start_date` is day-granular. The one-day margin is by design and the persist step de-duplicates.
- **Late Bright Data results.** On 10-29, 38 jobs were triggered; 17 webhooks arrived on time. The other 21 snapshots finished 5-6 hours late (webhooks at 08:40 to 09:22 UTC). The stale-job sweep had already marked their jobs `EXPIRED` and runs `TIMED_OUT` (and queued an Apify fallback), and the webhook returned early for a non-pending job, dropping about 190 records. The snapshots were still `ready` at Bright Data.
- **Noise from the cap.** Each refused start was audited as a FAILED run (29 on 10-29, 105 on 10-30), counted against Apify's provider health, and the queue worker rethrew for SQS redelivery.

## Fix (PR #118)

- `getScrapeCursor` and `processScrapeJob` use posts owned or associated in any role (`postsAssociatedWithAccount`); Apify's cursor is the newest post + 1 s (`APIFY_CURSOR_ADVANCE_MS`).
- The Bright Data webhook processes a delivery for an expired job when it carries records.
- The cap is `ApifyMonthlyUsageLimitError`: `CAPACITY_EXHAUSTED` on the async trigger, no audit row, not rethrown by the queue worker.

## Recovery

`apps/backend/scripts/replay-late-brightdata-snapshots.ts` (dry run by default) replayed the 21 snapshots on 2026-10-30: 217 items across 20 jobs with data, 88 new posts saved and queued for extraction. The rest already existed under a different URL form, which the posts unique index rejected (logged, no loss).

## Still open

- Choose the Apify plan or budget (the Free plan cannot carry the daily load), or keep Bright Data primary and Apify as a small fallback.
- Remember an exhausted Apify cap for the rest of the cycle instead of trying every target.
- Bright Data snapshots can take hours; the 180-minute expiry sends those profiles to a paid Apify fallback while the late result still arrives.
