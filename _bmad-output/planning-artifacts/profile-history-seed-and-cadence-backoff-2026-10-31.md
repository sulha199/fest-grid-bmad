# Profile history seeding and cadence-driven scrape backoff

Date: 2026-10-31. Author: Winston (architect pass), for shulha. Status: proposal, nothing built. Decisions E1-E6 need an answer before implementation. Builds on `brightdata-yield-and-dead-page-policy-2026-10-31.md`; where the two differ, this document replaces its D4 (flat "keep daily") with a cadence-driven backoff.

## 1. What the code and prod data show

### 1.1 A new subscription does not scrape "the last 30 posts"
- `subscribeToAccount` passes `newerThan = now - 7 days` to `triggerScrapeForAccount`. Prod confirms it: the first run of every subscribed profile carries `onlyPostsNewerThan` seven days back and `resultsLimit: 30`.
- So the first scrape is "posts of the last 7 days, at most 30". That is why `biliardindonesia` (3,073 posts on Instagram), `informasiturnamenfutsal.id` and `info_turnamen_fc` each returned **1 post** on subscription and hold almost no history. This also explains the "0 posts ever" profiles in the dead_page analysis.
- The SQS fallback path is a third rule: a ladder of windows (3, 7, 10, 14, ..., 30 days) that stops at 15 returned or 10 unique posts.

### 1.2 Co-authored posts give an unsubscribed profile a cursor but no history
- 1,059 profiles on prod. 36 are subscribed and all have been scraped. **1,020 are unsubscribed and never scraped**, yet 733 of them already hold posts (650 only through co-author links, 83 both), 1,903 post links in total. 287 more hold a few owned posts (449) and no co-author links.
- `getScrapeCursor` takes the newest post **owned or associated** with the profile (the repeat-item fix of this week, `postsAssociatedWithAccount`). For a profile that was only ever seen as a co-author, that cursor is one day before its newest co-authored post. If someone subscribes later, the vendor call starts there and the profile's real history is never fetched. Example: `erafone.run` holds 31 posts that all arrived through other accounts' scrapes and was never scraped itself.
- Co-authored posts are a thin, biased sample of a profile's timeline, so they cannot be used to measure its posting rhythm either.

### 1.3 The history we do have supports a cadence measure, with one trap
Across the 36 subscribed profiles (4,044 posts): 26 have 30 or more posts, 2 have fewer than 10. Typical gaps are short (median 0.0 to 2.0 days), but posting is **bursty**: `aftereo.ofc` has a mean gap of 0.66 days in its last active month, yet posted 10 times on 10-19 and then went silent for days. A mean of post-to-post gaps would call that profile "daily" and read every quiet day as an anomaly. The measure has to use gaps between **distinct posting days** and take the median.

### 1.4 Backtest of an adaptive interval (36 subscribed profiles, 10-15 to 10-31, 2,119 posts, 612 daily scrapes)
After a scrape that finds nothing new, the next scrape waits `ceil(typical gap x multiplier)` days, capped. "Delayed" counts posts first seen one or more days after they were published.

| Rule | Scrapes | Saved | Posts delayed 1 day / 2 days / 3+ days |
|---|---|---|---|
| Daily (today) | 612 | 0% | 0 / 0 / 0 |
| median gap x1, cap 3 | 587 | 4% | 21 / 7 / 0 |
| median gap x2, cap 3 | 522 | 15% | 96 / 13 / 2 |
| p75 gap x2, cap 7 | 496 | 19% | 98 / 14 / 39 |
| mean gap x1, cap 7 | 524 | 14% | 78 / 19 / 5 |

The trade is poor in money terms: the whole Bright Data bill was about $1.91 in 17 days, so a 15% saving is cents. The case for a trend-driven backoff is correctness, scale and Apify-cap protection, not Bright Data spend. The backtest ignores the fact that a slower interval also delays the discovery of **events**, which is the product's value.

## 2. Decisions

> Status 2026-10-31: E1 and E2 built (BUG-098, PR #129). E3 and E4 built (IDEA-105, PR stacked on #130) as designed: cap 3 days, multiplier 1, `SCRAPE_BACKOFF_MAX_DAYS=1` turns it off, scheduled cycles only. The cadence is derived per batch, nothing is stored. The real-run check (prod runs 10-29 and 10-31) found 26% of runs with no new post, which bounds what the backoff can ever skip.

### E1. Initial scrape means "latest 30 posts, no older than 30 days", one rule for every path
**Decided 2026-10-31 (shulha):** the seeding request is bounded by both limits, whichever is smaller: at most 30 posts (`SCRAPE_RESULTS_LIMIT`, default 30) and nothing older than 30 days (`onlyPostsNewerThan` / `start_date` = now minus 30 days). Posts older than that are assumed to announce events that have already ended, so they are never ingested and never reach AI extraction (this also closes the extraction-cost question: a seeding run adds at most 30 posts of the last month). It replaces the 7-day window on the subscription trigger, the on-demand trigger, the daily batch and the SQS path (the SQS window ladder already stopped at 30 days). Cost: up to 30 records per new profile, about $0.045 on Bright Data.

### E2. A profile is "seeded" only after its own full-timeline scrape
Add `history_seeded_at timestamptz` (nullable) to `social_media_account_profiles`; no new table, so no new RLS statement. It is set when an initial scrape of a profile finishes successfully. The cursor rule becomes:

- not seeded: ignore co-authored posts for the cursor and use E1 (latest 30);
- seeded: unchanged (newest owned or associated post, with the vendor margin).

This fixes the 1,020 profiles in 1.2 for free: nothing is scraped until someone subscribes or votes (demand-gated), and when they do, the seeding scrape fetches real history. Persisting already deduplicates by post URL, so overlap with stored co-authored posts is harmless (the 33% re-delivery on Bright Data shows the dedupe works). Seeded means "a run delivered at least one post while the column was null"; a seeding run that delivers nothing (outage, or no post in the window) leaves it null and the next daily run tries again. Backfill, decided with E1: the migration sets `history_seeded_at = last_scraped_at` for every profile that has one, so the 36 profiles already being scraped do not reseed (which would pull up to 1,080 older posts into extraction for about $1.6). Their cadence stays `insufficient` until a month of history has accrued.

Alternative considered: reuse `last_scraped_at IS NULL`. Rejected: that stamp is the daily batch's "done for this cycle" marker, and a seeded profile with a thin history needs reseeding independently of it.

### E3. Cadence summary is derived, not stored
A pure function in `@festgrid/domain` (100% branch coverage):

`summarizePostingCadence(publishedAts, now) -> { postCount, lastPostAt, silenceDays, typicalGapDays, postsInActiveMonth, confidence }`

- `typicalGapDays`: median gap in days between **distinct posting days** within the 30 days ending at the last post (the "last active month").
- `confidence`: `insufficient` when the profile is not seeded or has fewer than 5 posting days in that month; otherwise `ok`.
- Computed in the batch with one grouped query per target set, the way `newestPostByProfileId` already works. No stored column until a query proves slow.

Also usable elsewhere at no extra cost: "last posted N days ago" in the subscriptions UI and in the admin view.

### E4. Backoff rule (input: the cadence, trigger: an empty run)
- A run is **empty** when it persisted 0 new posts. `dead_page` is one cause of that, not the signal itself (a live profile with a known post in the window still returned `dead_page`, and a run that re-delivers only known posts is empty without any error).
- After an empty run, the profile is next due `clamp(ceil(typicalGapDays), 1, 3)` days later. Any run that persists a new post resets it to daily.
- `confidence = insufficient` always means daily. A profile is never turned off.
- Starting parameters from the backtest: multiplier 1, cap 3 days (4% fewer scrapes, 1.3% of posts one day late, none later than two days). The multiplier and cap are env values so the trade can be tightened after measuring on real traffic.
- Implementation point: `getBatchScrapeTargets` already filters by `lastScrapedAt` cutoff; the backoff adds a per-profile due check on top, so manual invokes, provider-health probes and the SQS path are untouched.

To count empties we need the run outcome stored: the yield columns from the previous document gain one more, `new_posts` (integer, posts persisted that did not exist before). Without it the backoff cannot tell a quiet profile from a re-delivering one.

### E5. Unsubscribed profiles with co-authored posts are not scraped proactively
Scraping all 1,020 once would cost about $46 on Bright Data and serve no subscriber. Keep them demand-gated (E2). Their existing co-authored posts stay as they are.

### E6. Order of work
1. E1 + E2 (correctness; fixes the history gap and the 1-post subscriptions).
2. Yield columns + `new_posts` (previous document D1-D2).
3. E3 + E4 (cadence and backoff), with the backtest repeated on 30 days of real data first.

## 3. Risks
- E1 raises ingestion volume for every new subscription: confirm extraction cost (see E1) before building.
- The backtest uses posts we already hold, which were found by daily scrapes; it is a lower bound on how often a slower interval would have missed something fresh.
- A cap of 3 days adds up to 2 days of lag for a quiet profile that posts an event announcement. If that matters to the product, drop the cap to 2 or keep daily for profiles with upcoming-event posts.
- Backfilling `history_seeded_at` on prod needs the writer credential and a per-session go-ahead.
