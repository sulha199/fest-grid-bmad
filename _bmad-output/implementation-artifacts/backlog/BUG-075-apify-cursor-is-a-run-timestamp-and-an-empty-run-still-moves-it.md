---
backlog_id: BUG-075
title: "The Apify scrape's cursor is the last run's finish time: an empty or failed run moves it, and it is not tied to the newest stored post"
captured: 2026-10-22
---

# BUG-075: the Apify cursor is a run timestamp (found 2026-10-22)

Same mechanism as BUG-074 on the other vendor. Found while reading how both scrapers pick their start date. Not fixed. Companions: BUG-074 (Bright Data, the measured outage), IDEA-095 (failover).

## What is wrong

* `apps/backend/src/lib/scraper/trigger-apify-for-target.ts:39-46` takes the newest `scraper_actor_runs` row of the profile by `completedAt` **with no status filter** (the comment says "successful"), and passes its full ISO timestamp as `onlyPostsNewerThan` to `apify/instagram-api-scraper` together with `resultsLimit: env.scrapeResultsLimit`.
* So the cursor is when the last run finished, not when the newest stored post was published. Anything that makes a run finish without capturing posts moves it forward: a run that returns an empty dataset, a failed or timed-out run (the filter does not exclude them), a run whose result was not processed.
* `lambdas/apify-webhook.ts:81-105` records `SUCCEEDED` for any finished run, including an empty dataset (`itemCount: items.length`); it only writes `FAILED` for runs Apify reports as failed. Apify's last production run was 2026-10-19, so this has not been exercised during the Bright Data outage, but the risk is the same.
* The timestamp (not a day) is an advantage over Bright Data's `MM-DD-YYYY`: no same-day repeat fetch. It is lost with the false cursor.

## Facts measured 2026-10-22

* The actor works: the POC script's new `--vendor apify` path (apify/instagram-api-scraper, `directUrls`, `resultsType: 'posts'`, `resultsLimit`, `onlyPostsNewerThan`) returned 8 posts each for 12 accounts, 1 for another, 105 results in all, about $0.24.
* Price on the owner's FREE plan: $0.0023 per result (PAY_PER_EVENT), monthly usage cap $5, shared with production's Apify fallback.
* `trigger-scrape-for-account.ts` tries **Apify first** and Bright Data second, but `isProviderCapacityAvailable('apify')` (a monthly budget ratio) decides, which is why production shows 483 Bright Data runs against 37 Apify runs.

## Proposed fix (for a story, not done)

* One cursor helper shared with BUG-074: the newest stored `posts.date_posted` for the profile, as an exact timestamp for Apify, with no run time involved; fall back to `newerThan`.
* Filter any remaining run-based lookup to `status = SUCCEEDED` and `item_count > 0`.
* Classify an empty Apify result (`items.length = 0` on a `SUCCEEDED` run) as `empty`, not as a success that advances anything; the post-based cursor makes this harmless, and a day of empties raises the fleet alert (BUG-074 section 5).
* Verify against the actor's input schema whether `onlyPostsNewerThan` is inclusive (a same-timestamp post), and add a small overlap if it is not.
* Tests: a failed or empty run leaves the next `onlyPostsNewerThan` unchanged.

## Fixed, 2026-10-22 (hotfix cut from `master`; commits `8f8e0455`, `dba05bcc`, `5f72e7da`, `5d3a8634`)

Fixed together with BUG-074 by the one shared cursor; see that file's "Fixed" section for the verification and the
review. Item by item against "Proposed fix":

| Item | Result |
|---|---|
| One cursor helper shared with BUG-074: newest stored `posts.published_at`, as an exact timestamp for Apify, falling back to `newerThan` | **Done.** `getScrapeCursor('APIFY', ...)`; the run-timestamp lookup is gone from `trigger-apify-for-target.ts`. A post dated in the future is clamped to now. |
| Filter any remaining run-based lookup to `SUCCEEDED` and `item_count > 0` | **Done by removal**: no run-based cursor lookup remains anywhere. |
| Classify an empty Apify result as `empty` | **Implicit.** An Apify run stays `SUCCEEDED` with 0 items (there is no vendor signal to tell an empty account from a failure); health reads it as `empty`, and a whole sample of them degrades the provider (`ALL_EMPTY`). The webhook is unchanged. The class is not stored (IDEA-098). |
| Verify whether `onlyPostsNewerThan` is inclusive; add a small overlap if not | **Not verified** (it needs a paid Apify call and the owner's confirmation). The cursor is the exact newest-post timestamp; a post published in the same second as the stored newest one could be missed. Verify on the next working Apify run before adding an overlap. |
| Test: a failed or empty run leaves the next `onlyPostsNewerThan` unchanged | **Done**: `get-scrape-cursor.test.ts` and `trigger-apify-for-target.test.ts` (both fail against the old code). |

Known limit, carried as a row: **BUG-076**. The Apify cursor is exact, so a mapper that stamps the scrape time on an undated item
would move it to "now" (the Bright Data side has the same door).
