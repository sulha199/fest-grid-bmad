# Story 3.4d: Per-use-case Apify actor selection and sync-path timeout handling

## Story Details

- Epic: 3
- Story ID: 3.4d
- Status: backlog

<!-- Note: this story captures an architecture-level finding and recommendation at a lighter level of detail than a dev-story-ready pass. Re-run bmad-create-story 3-4d for a fully detailed task breakdown before dev-story — this file's Dev Notes are the input to that pass, not a substitute for it. -->

## Story

As a system,
I want the on-demand (synchronous, user-facing) scraper paths to use the actor — official or third-party — that gives the best real-world outcome (cost, reliability, coverage) for the current app-funded key, with an explicit bounded timeout, distinct from the batch path's actor choice,
so that a slow Apify run can't silently hang a GraphQL mutation or burn budget on a call the user has already given up on, and so actor selection is driven by measured results rather than a single fixed choice.

## Background / How This Was Found

Surfaced 2026-08-14 while reviewing `docs/assets/Apify actor costing and facts.md` (four actors manually run against the same test account, cost-only, no run-duration data recorded) alongside Story 3.4/3.4a's existing adapter code. Two findings, not one:

1. **All four actors examined share the same trait: no vendor-published run-duration SLA.** Apify's own store page for the actor currently in use (`apify/instagram-api-scraper`) states runs can take *"a few seconds to a few hours"* and explicitly declines to commit to a number, recommending a test scrape instead. This is true of `apify/instagram-post-scraper`, `instagram-scraper/fast-instagram-post-scraper`, and `sones/instagram-posts-scraper-lowcost` as well — none publish a runtime SLA either.
2. **Two call sites are synchronous/user-facing today, and one has no timeout at all:**
   - [apps/backend/src/schema/resolvers.ts:993](apps/backend/src/schema/resolvers.ts#L993) (`getPostByUrl`, manual post-extraction mutation) is awaited directly inside a GraphQL mutation resolver, wrapped in a **hardcoded 20-second local timeout** ([apps/backend/src/lib/scraper/instagram-adapter.ts:97](apps/backend/src/lib/scraper/instagram-adapter.ts#L97)). On a slow run, this just gives up client-side and returns `SCRAPE_FAILED` — the underlying Apify run keeps going and is still billed.
   - [apps/backend/src/schema/resolvers.ts:1429](apps/backend/src/schema/resolvers.ts#L1429) (`lookupAccountProfile`, used by `castVote`-by-handle) is awaited synchronously with **no timeout at all**. If this sits behind a standard API Gateway synchronous Lambda proxy integration (~29s default timeout), a slow run doesn't fail gracefully — the client gets a 504 while the Lambda/Apify run continues in the background.
   - The batch path (`getNewestPosts`, Story 3.4/3.4a) is unaffected **by the timeout question** — it's fully async via SQS/EventBridge, so actor latency is a non-issue there. It is **not** unaffected by the actor-choice question, though — see finding #4 below.
3. **Confirmed by real data, added by user 2026-08-14:** the costing doc now records actual observed run durations for one sample run per actor. They aren't close — see "Actor Cost & Duration Comparison" in Dev Notes — and the two Apify-official actors are the **slowest** of the four, not the fastest. Critically, both observed Apify-official durations (31s, 1m15s) already **exceed today's hardcoded 20s timeout** on `getPostByUrl`. This isn't a hypothetical risk anymore: on this evidence, the current production sync path is likely already timing out on a meaningful fraction of real single-post lookups today, silently returning `SCRAPE_FAILED` to users while Apify keeps running (and billing) in the background. This materially raises this story's priority above "nice to have."
4. **Raised by user 2026-08-14: `getNewestPosts` shares this story's actor-swap surface, even though its timeout/latency profile doesn't.** All three `ScraperAdapter` methods — `getPostByUrl`, `lookupAccountProfile`, **and** `getNewestPosts` — call the same shared `callApifyActor` function in [instagram-adapter.ts](apps/backend/src/lib/scraper/instagram-adapter.ts) with the same hardcoded actor ID today. `getNewestPosts` backs the once-daily batch scrape (Story 3.4's original design, and Story 3.4a's fallback-from-Bright-Data path) — so an actor swap made only for AC1's sync-path reasoning would silently change the batch path's actor too, unless Task 2 explicitly gives `getNewestPosts` its own named constant, decided on its own merits. Investigating this surfaced a second question worth answering with real data, not assumption: does each actor's newest-posts-only cutoff filter (`onlyPostsNewerThan`/`newerThan`/`recent`) actually work the way the batch pipeline needs it to — see Dev Notes "Duplication Is Already DB-Safe; What Actually Matters Is Filter Cost-Efficiency" and the new Task 1c.

This story exists to close that gap: match actor choice to the latency/cost profile each call site actually has, and add bounded timeout handling where it's missing — rather than leaving the current single-actor, partially-timed-out setup as-is.

## Acceptance Criteria

1. **Given** the two synchronous call sites (`getPostByUrl`, `lookupAccountProfile`), **when** either is invoked, **then** the underlying Apify call uses whichever of `sones/instagram-posts-scraper-lowcost` or `instagram-scraper/fast-instagram-post-scraper` Task 1b's fuller sample confirms as the better pick (both already beat the two Apify-maintained actors on cost and observed latency per Task 1a's single-sample data — see Dev Notes) — rather than today's `apify/instagram-api-scraper` used uniformly across all three adapter methods, whose 31s observed duration already exceeds the sync path's own 20s timeout.
2. **And** `lookupAccountProfile` ([instagram-adapter.ts:141](apps/backend/src/lib/scraper/instagram-adapter.ts#L141)) gains the same bounded-timeout treatment `getPostByUrl` already has (reuse the existing `withTimeout` helper, same file) — a timeout returns a typed, user-facing error distinct from "account not found" (do not conflate a slow run with a nonexistent account), rather than leaving the caller to hang until the surrounding infrastructure's own timeout cuts it off uncontrolled.
3. **And** the batch path's async/timeout handling and its primary-vendor design (Bright Data-first, Story 3.4a) are explicitly left unchanged by this story — no timeout is added, and Story 3.4a's own trade-offs are not reopened. **However**, the Apify actor `getNewestPosts` calls (Story 3.4's original batch implementation and Story 3.4a AC4's fallback-from-Bright-Data path) is not silently carried over from whatever this story picks for the sync paths — Task 1c's filter-correctness/cost data (see Dev Notes) decides `getNewestPosts`'s actor independently, since the batch path's requirements (correct `newerThan`-style filtering, near-zero cost when nothing is new — Story 3.4 AC4) are different from the sync paths' (raw latency for a single item).
4. **And** the actor used by each adapter method is a named constant/config value (not a bare string literal repeated per call, as today) — **three** constants, one per method (`getPostByUrl`, `lookupAccountProfile`, `getNewestPosts`), not one shared constant — so a future actor swap for any one path is a one-line change that can't silently affect the others the way today's single shared `callApifyActor` call does.
5. **And**, per the app-funded-vs-BYOK distinction confirmed with the user 2026-08-14 (corrected 2026-08-14): this story's actor pool for the **current, app-funded** key is open to all four evaluated actors, including third-party/community ones (`sones/instagram-posts-scraper-lowcost`, `instagram-scraper/fast-instagram-post-scraper`) — the app-funded key is the project owner's own account, and the owner has confirmed they're comfortable bearing the Actor Terms §4.4 Creator-access exposure (see Dev Notes) on their own account in exchange for the best available cost/reliability outcome. This is the **inverse** of Story 3.4b's future BYOK path: once/if BYOK is legally cleared and implemented, contributed keys belong to individual community members, not the owner, and per the same 2026-08-14 correction, BYOK is restricted to **Apify-maintained actors only** — a stricter default is warranted there since the app is choosing that exposure on behalf of many different end-users' own accounts, not just its own.

## Tasks / Subtasks

- [X]  Task 1a (done 2026-08-14): Single-sample duration recorded for all four candidates in the costing doc — see Dev Notes comparison table. Result: both third-party actors (5s, 7s) are faster *and* cheaper than both Apify-maintained actors (31s, 75s); `apify/instagram-post-scraper` in particular is the slowest of the four despite being the original cost-only pick.
- [ ]  Task 1b: One sample per actor is a direction, not a distribution — Apify's own docs warn duration varies by content/location/etc. Run a matched-n=1 batch (5x each) against all four actors, same target account (`pakuwonmall.jogja`) throughout so actor choice is the only variable, and record duration + success/failure per run before locking in a pick (AC: #1, #5). Plan (added 2026-08-14):

  **Capability check first:** confirm on each third-party actor's Apify console Input tab whether it accepts a direct post URL/shortcode input, not just a username. The one example input captured for both `sones/instagram-posts-scraper-lowcost` and `instagram-scraper/fast-instagram-post-scraper` only shows username-based input — if neither has a post-URL field, they **cannot** replace `getPostByUrl` (which fetches one exact post by URL), only `lookupAccountProfile`/newest-posts-style calls. This would split the eventual AC1 pick per adapter method rather than one actor for both.

  **Runs (5x each, `resultsLimit`/`postsPerProfile` = 1 to match real sync-path usage, not the original batch-style 10):**

  1. `apify/instagram-api-scraper` — `getPostByUrl` mode: `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`; `lookupAccountProfile` mode: `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "details", "resultsLimit": 1}`
  2. `apify/instagram-post-scraper`: `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData", "skipPinnedPosts": true}`
  3. `sones/instagram-posts-scraper-lowcost`: `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`
  4. `instagram-scraper/fast-instagram-post-scraper`: `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "retries": 3}`

  ~20 runs total, expected well under $1 combined at n=1. Record each run's console `Duration` plus success/failure (a failed run counts against success rate, not into the latency average). Doesn't need to be back-to-back — spreading across a day also captures time-of-day variance Apify's docs hint at, but one sitting is an acceptable first pass.

  **Recording template (fill in as runs complete):**


  | Actor                                           | Mode                 | Input params                                                                                                                                                                                          | Run # | Date/Time | Run ID | Duration | Success (Y/N) | Failure reason | Cost ($) | Items returned | Notes |
  | ----------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------- | ------ | -------- | ------------- | -------------- | -------- | -------------- | ----- |
  | `apify/instagram-api-scraper`                   | getPostByUrl         | `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`                                                                                             | 1     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | getPostByUrl         | `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`                                                                                             | 2     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | getPostByUrl         | `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`                                                                                             | 3     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | getPostByUrl         | `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`                                                                                             | 4     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | getPostByUrl         | `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`                                                                                             | 5     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | lookupAccountProfile | `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "details", "resultsLimit": 1}`                                                                                       | 1     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | lookupAccountProfile | `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "details", "resultsLimit": 1}`                                                                                       | 2     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | lookupAccountProfile | `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "details", "resultsLimit": 1}`                                                                                       | 3     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | lookupAccountProfile | `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "details", "resultsLimit": 1}`                                                                                       | 4     |           |        |          |               |                |          |                |       |
  | `apify/instagram-api-scraper`                   | lookupAccountProfile | `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "details", "resultsLimit": 1}`                                                                                       | 5     |           |        |          |               |                |          |                |       |
  | `apify/instagram-post-scraper`                  | n/a (posts-only)     | `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData", "skipPinnedPosts": true}`                                                          | 1     |           |        |          |               |                |          |                |       |
  | `apify/instagram-post-scraper`                  | n/a (posts-only)     | `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData", "skipPinnedPosts": true}`                                                          | 2     |           |        |          |               |                |          |                |       |
  | `apify/instagram-post-scraper`                  | n/a (posts-only)     | `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData", "skipPinnedPosts": true}`                                                          | 3     |           |        |          |               |                |          |                |       |
  | `apify/instagram-post-scraper`                  | n/a (posts-only)     | `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData", "skipPinnedPosts": true}`                                                          | 4     |           |        |          |               |                |          |                |       |
  | `apify/instagram-post-scraper`                  | n/a (posts-only)     | `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData", "skipPinnedPosts": true}`                                                          | 5     |           |        |          |               |                |          |                |       |
  | `sones/instagram-posts-scraper-lowcost`         | n/a (posts-only)     | `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}` | 1     |           |        |          |               |                |          |                |       |
  | `sones/instagram-posts-scraper-lowcost`         | n/a (posts-only)     | `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}` | 2     |           |        |          |               |                |          |                |       |
  | `sones/instagram-posts-scraper-lowcost`         | n/a (posts-only)     | `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}` | 3     |           |        |          |               |                |          |                |       |
  | `sones/instagram-posts-scraper-lowcost`         | n/a (posts-only)     | `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}` | 4     |           |        |          |               |                |          |                |       |
  | `sones/instagram-posts-scraper-lowcost`         | n/a (posts-only)     | `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}` | 5     |           |        |          |               |                |          |                |       |
  | `instagram-scraper/fast-instagram-post-scraper` | n/a (posts-only)     | `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "retries": 3}`                                                                                                                   | 1     |           |        |          |               |                |          |                |       |
  | `instagram-scraper/fast-instagram-post-scraper` | n/a (posts-only)     | `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "retries": 3}`                                                                                                                   | 2     |           |        |          |               |                |          |                |       |
  | `instagram-scraper/fast-instagram-post-scraper` | n/a (posts-only)     | `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "retries": 3}`                                                                                                                   | 3     |           |        |          |               |                |          |                |       |
  | `instagram-scraper/fast-instagram-post-scraper` | n/a (posts-only)     | `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "retries": 3}`                                                                                                                   | 4     |           |        |          |               |                |          |                |       |
  | `instagram-scraper/fast-instagram-post-scraper` | n/a (posts-only)     | `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "retries": 3}`                                                                                                                   | 5     |           |        |          |               |                |          |                |       |

  Column notes: **Run ID** = the Apify console run ID (e.g. `wgmpjNjwPFsB3NOCc`), for traceability back to the actual run if a number looks off. **Duration** = console-reported wall-clock run time, same field used for the Task 1a samples (`31 s`, `1 m 15 s`, etc. — keep the same unit format for easy comparison). **Failure reason** = blank if successful; otherwise the actual error (timeout, empty result, rate-limited, private/unavailable account, etc.) — do not just mark "N", the reason matters for judging whether a failure is actor-side flakiness or a bad test input. **Items returned** = sanity check that the run actually returned the 1 requested item, not 0.

  **Rollup summary (compute once the table above is filled in):**


  | Actor                                           | Mode                 | Input params                                                                                                                                                                                          | Runs | Successes | Failures | Success rate | Min duration | Max duration | Median (p50) duration | Avg cost |
  | ----------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------- | -------- | ------------ | ------------ | ------------ | --------------------- | -------- |
  | `apify/instagram-api-scraper`                   | getPostByUrl         | `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`                                                                                             | 5    |           |          |              |              |              |                       |          |
  | `apify/instagram-api-scraper`                   | lookupAccountProfile | `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "details", "resultsLimit": 1}`                                                                                       | 5    |           |          |              |              |              |                       |          |
  | `apify/instagram-post-scraper`                  | —                   | `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData", "skipPinnedPosts": true}`                                                          | 5    |           |          |              |              |              |                       |          |
  | `sones/instagram-posts-scraper-lowcost`         | —                   | `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}` | 5    |           |          |              |              |              |                       |          |
  | `instagram-scraper/fast-instagram-post-scraper` | —                   | `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 1, "retries": 3}`                                                                                                                   | 5    |           |          |              |              |              |                       |          |

  AC1's actual pick should be made from this rollup, not the single-sample table in Dev Notes above (which stays as-is for historical reference / the reason Task 1b was opened in the first place).
- [ ]  Task 1c (added 2026-08-14, per user request to also cover the batch/newest-post use case): Verify each actor's newest-posts-only cutoff filter actually works the way `getNewestPosts` needs — this decides the separate `getNewestPosts` actor constant (AC3/AC4), independent of Task 1a/1b's sync-path pick. See Dev Notes "Duplication Is Already DB-Safe; What Actually Matters Is Filter Cost-Efficiency" for why this is a filtering/cost question, not a data-correctness one (duplicate rows are already prevented at the DB layer regardless of actor).

  **What to check, per run:** (1) does the actor return *only* items newer than the cutoff, or does it return everything and just annotate/flag them (like `fast-instagram-post-scraper`'s `is_newer_than_cutoff` field hinted at in the original sample)? (2) does the cost breakdown bill for items outside the cutoff (a "Processing Fee (Filtered Items)"-style line, as `fast-instagram-post-scraper`'s original sample showed) or are they free? (3) critically — does a cutoff matching **zero** real posts return 0 items and bill ~$0, matching Story 3.4 AC4's explicit requirement (*"a call for an account with nothing new returns, and bills, zero items"*)? An actor that fails #3 breaks the entire cost-control premise the daily batch depends on, regardless of how it performs on Task 1a/1b.

  **Runs (3 cutoff scenarios × 4 actors = 12 runs, same account `pakuwonmall.jogja`, `resultsLimit`/`postsPerProfile` = 15 so there's room to observe partial filtering). Cutoffs A and B are derived from `pakuwonmall.jogja`'s real, already-captured post timeline (`apify/instagram-post-scraper`'s output, confirmed identical against `fast-instagram-post-scraper`'s 7-post subset) rather than guessed — this makes the expected result an exact, checkable number, not a vague "should be fewer." The real timeline, newest→oldest:**

  ```
  1. 2026-08-13T05:23:19Z
  2. 2026-08-13T05:20:30Z
  3. 2026-08-13T02:59:24Z
     ─── clean gap spanning midnight UTC ───
  4. 2026-08-12T13:39:53Z
  5. 2026-08-12T13:38:22Z
  6. 2026-08-12T10:52:43Z
  7. 2026-08-12T03:25:51Z
  8. 2026-08-12T03:24:21Z
  9. 2026-08-12T03:23:01Z
  10. 2026-08-12T02:55:09Z
  ```

  *Scenario A — baseline cutoff (`2026-08-10`, before all 10 known posts): expect **≥10 items** back (all 10 known posts; possibly more, up to `resultsLimit: 15`, if the account posted anything earlier than 08-12T02:55 that this sample didn't capture).*

  1. `apify/instagram-api-scraper`: `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 15, "onlyPostsNewerThan": "2026-08-10"}`
  2. `apify/instagram-post-scraper`: `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "2026-08-10"}`
  3. `sones/instagram-posts-scraper-lowcost`: `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "2026-08-10T00:00:00Z", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`
  4. `instagram-scraper/fast-instagram-post-scraper`: `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "2026-08-10", "retries": 3}`

  *Scenario B — precise real-boundary cutoff (`2026-08-13T00:00:00Z`, exactly between post #3 and #4 above): expect **exactly 3 items** back — `2026-08-13T02:59:24Z`, `2026-08-13T05:20:30Z`, `2026-08-13T05:23:19Z`, no others. This is the strongest correctness check: a wrong count (not 3) or a right count with the wrong timestamps means the actor's filter genuinely doesn't work as advertised, not just "seems off."*
  5. `apify/instagram-api-scraper`: `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 15, "onlyPostsNewerThan": "2026-08-13T00:00:00.000Z"}`
  6. `apify/instagram-post-scraper`: `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "2026-08-13T00:00:00.000Z"}`
  7. `sones/instagram-posts-scraper-lowcost`: `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "2026-08-13T00:00:00Z", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`
  8. `instagram-scraper/fast-instagram-post-scraper`: `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "2026-08-13", "retries": 3}` — `recent`'s one captured example was date-only (no time-of-day), so this relies on the split falling on a whole-day boundary, which it does here; if `recent` turns out to support full datetimes too, that's a bonus, not a requirement for this test to work.

  *Scenario C — true zero-boundary cutoff, **derived live at test time, not hardcoded**: since real time has moved on from the doc's 2026-08-13 capture, the account has almost certainly posted more by the time you run this. Hardcoding "the day after 08-13" risks a false failure if new posts exist. Instead: first do one cheap 1-item pull (reuse Task 1b's baseline call, or any `resultsLimit: 1` call) to find the account's actual current newest post timestamp — call it `T` — then set the cutoff to `T` + 1 second for `apify`/`sones` (full-datetime fields), or to tomorrow's date for `fast-instagram-post-scraper` (date-only `recent` field, coarser granularity, so a same-second boundary isn't achievable there). Expect **0 items, ~$0 cost** (no per-item charges — at most a small fixed "Actor Start"-type fee, if any). This is the scenario that directly tests Story 3.4 AC4's requirement and matters most for the daily batch.*
  9. `apify/instagram-api-scraper`: `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 15, "onlyPostsNewerThan": "<T + 1s, ISO>"}`
  10. `apify/instagram-post-scraper`: `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "<T + 1s, ISO>"}`
  11. `sones/instagram-posts-scraper-lowcost`: `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "<T + 1s, ISO>", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`
  12. `instagram-scraper/fast-instagram-post-scraper`: `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "<tomorrow's date>", "retries": 3}`

  Run Scenario C two or three times per actor if the first result looks surprising (nonzero cost despite 0 items, or nonzero items despite the just-past cutoff) — a single run isn't enough to trust an edge case this consequential.

  **Recording template — one fill-in block per run (a table cell can't hold a pasted JSON output; this format can).** For each of the 12 runs below, fill in the plain fields (date/time, run ID, duration, cost, item count) and paste the full JSON output as-is. Leave "Timestamps match expected?" and "'Filtered items' charge present?" blank — those get filled in afterward from a review of the pasted output, not while you're collecting data.

  ---

  **Run 1 — `apify/instagram-api-scraper` — Scenario A (baseline, expect ≥10 items)**
  Input: `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 15, "onlyPostsNewerThan": "2026-08-10"}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 2 — `apify/instagram-api-scraper` — Scenario B (split, expect exactly 3 items)**
  Input: `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 15, "onlyPostsNewerThan": "2026-08-13T00:00:00.000Z"}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 3 — `apify/instagram-api-scraper` — Scenario C (zero, live T+1s)**
  Input: `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 15, "onlyPostsNewerThan": "<T+1s, fill in the real value you used>"}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 4 — `apify/instagram-post-scraper` — Scenario A (baseline, expect ≥10 items)**
  Input: `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "2026-08-10"}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 5 — `apify/instagram-post-scraper` — Scenario B (split, expect exactly 3 items)**
  Input: `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "2026-08-13T00:00:00.000Z"}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 6 — `apify/instagram-post-scraper` — Scenario C (zero, live T+1s)**
  Input: `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "<T+1s, fill in the real value you used>"}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 7 — `sones/instagram-posts-scraper-lowcost` — Scenario A (baseline, expect ≥10 items)**
  Input: `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "2026-08-10T00:00:00Z", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 8 — `sones/instagram-posts-scraper-lowcost` — Scenario B (split, expect exactly 3 items)**
  Input: `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "2026-08-13T00:00:00Z", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 9 — `sones/instagram-posts-scraper-lowcost` — Scenario C (zero, live T+1s)**
  Input: `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "<T+1s, fill in the real value you used>", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 10 — `instagram-scraper/fast-instagram-post-scraper` — Scenario A (baseline, expect ≥10 items)**
  Input: `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "2026-08-10", "retries": 3}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 11 — `instagram-scraper/fast-instagram-post-scraper` — Scenario B (split, expect exactly 3 items)**
  Input: `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "2026-08-13", "retries": 3}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  **Run 12 — `instagram-scraper/fast-instagram-post-scraper` — Scenario C (zero, live tomorrow)**
  Input: `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "<tomorrow's date, fill in the real value you used>", "retries": 3}`
  - Date/Time:
  - Run ID:
  - Duration:
  - Cost ($):
  - Items returned (count):
  - Output (paste full JSON):
  ```json

  ```

  ---

  **Derived analysis (fill in after all 12 runs' output is pasted above — computed from the raw output, not collected during runs):**

  | Actor | Scenario | Expected items | Actual items | Timestamps match expected? | "Filtered items" charge present? | Verdict |
  |---|---|---|---|---|---|---|
  | `apify/instagram-api-scraper` | A |  |  |  |  |  |
  | `apify/instagram-api-scraper` | B | exactly 3 |  |  |  |  |
  | `apify/instagram-api-scraper` | C | 0 |  |  |  |  |
  | `apify/instagram-post-scraper` | A |  |  |  |  |  |
  | `apify/instagram-post-scraper` | B | exactly 3 |  |  |  |  |
  | `apify/instagram-post-scraper` | C | 0 |  |  |  |  |
  | `sones/instagram-posts-scraper-lowcost` | A |  |  |  |  |  |
  | `sones/instagram-posts-scraper-lowcost` | B | exactly 3 |  |  |  |  |
  | `sones/instagram-posts-scraper-lowcost` | C | 0 |  |  |  |  |
  | `instagram-scraper/fast-instagram-post-scraper` | A |  |  |  |  |  |
  | `instagram-scraper/fast-instagram-post-scraper` | B | exactly 3 |  |  |  |  |
  | `instagram-scraper/fast-instagram-post-scraper` | C | 0 |  |  |  |  |

  Any actor that fails Scenario B (wrong count, or right count but wrong timestamps) or Scenario C (nonzero cost or nonzero items on a cutoff nothing can be newer than) should be considered disqualified for `getNewestPosts` regardless of its Task 1a/1b sync-path performance — the daily batch runs against every subscribed account every day, so a per-call cost leak here compounds in a way a one-off sync call never would.
- [ ]  Task 2: Extract actor IDs into named config/env constants, one per adapter method use-case (sync vs batch) (AC: #4).
- [ ]  Task 3: Swap the sync-path actor per Task 1's findings (AC: #1).
- [ ]  Task 4: Add `withTimeout` wrapping to `lookupAccountProfile`, with a distinct timed-out error type/message from "not found" (AC: #2).
- [ ]  Task 5: Update `instagram-adapter.test.ts` for the timeout case and the actor-selection change.

*Task breakdown intentionally left at this level — re-run `bmad-create-story 3-4d` for full implementation detail (exact env var names, error-type shape, test cases) before `dev-story`.*

## Dev Notes

### Actor Cost & Duration Comparison (from `docs/assets/Apify actor costing and facts.md` + live store-page verification, 2026-08-14; duration column added by user 2026-08-14)


| Actor                                                      | Input params (this sample)                                                                                                                                                                                                                      | Cost/1000 items                                   | Observed duration (1 sample run each)           | Maintainer                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apify/instagram-api-scraper` *(current, all 3 use cases)* | `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 3, "searchType": "hashtag", "addParentData": false}`                                                                                  | ~$2.30–2.90/1000 observed / $1.40/1000 published | **31 s** (for only 3 results)                   | Apify                           | Broadest feature set (posts/details/hashtag/search) but most expensive**and** slowest-per-item of the four; own docs: *"a few seconds to a few hours"* per run. Already exceeds the current 20s sync-path timeout.                                                                                                                                                                                                                                             |
| `apify/instagram-post-scraper`                             | `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "dataDetailLevel": "basicData", "onlyPostsNewerThan": "2026-08-06", "resultsLimit": 10, "skipPinnedPosts": true}`                                                               | ~$1.70/1000 observed                              | **1 m 15 s** (for 10 results)                   | Apify                           | Narrower (posts only),`dataDetailLevel` knob for basic-vs-full — cheaper on paper, but the **slowest actor observed by a wide margin**. Not a fit for a synchronous call site under this data; ruled out below.                                                                                                                                                                                                                                               |
| `instagram-scraper/fast-instagram-post-scraper`            | `{"instagramUsernames": ["pakuwonmall.jogja"], "recent": "2026-08-06", "postsPerProfile": 10, "retries": 3}`                                                                                                                                    | ~$0.90/1000 observed / $0.45/1000 published       | **7 s** (10 requested, 7 returned + 3 filtered) | Third-party                     | Marketed for speed via no-login extraction — the branding checks out against this sample. Strong candidate for the current app-funded key — see AC5.                                                                                                                                                                                                                                                                                                         |
| `sones/instagram-posts-scraper-lowcost`                    | `{"usernames": ["jogjaexpocenter"], "newerThan": "2026-08-06T13:07:24+07:00", "postsPerProfile": 10, "proxy": {"useApifyProxy": true}, "delayBetweenProfiles": 250, "delayBetweenRequests": 500, "maxRetries": 3, "maxConcurrentProfiles": 10}` | ~$0.80/1000 observed / $0.30/1000 published       | **5 s** (for 10 results)                        | Third-party (community, "Samy") | Cheapest**and** fastest observed. 90.2% success rate, 4.77★/5.3k users — the reliability trade-off to weigh against being the top performer here. Strong candidate for the current app-funded key — see AC5. **Caveat:** this sample targeted a *different* account (`jogjaexpocenter`) than the other three (`pakuwonmall.jogja`) — not a perfectly controlled comparison; Task 1b/1c standardize on `pakuwonmall.jogja` for all four actors to fix this. |

**This flips the original cost-only recommendation.** Cost alone pointed at `apify/instagram-post-scraper` as the sync-path pick; the duration data shows it's actually the slowest of the four (75s), while the two third-party actors are both faster *and* cheaper (5-7s vs. 31-75s for the Apify-maintained pair). Both Apify-maintained actors' observed durations already exceed the current 20s sync-path timeout — see Background finding #3. This is a single sample per actor, not a distribution (Apify's own docs warn duration varies by "content complexity, location, and other factors"), so Task 1 still calls for a slightly larger sample before locking in a pick — but the direction of the evidence is strong and consistent with the "fast"/"lowcost" actors' own positioning, not a coin flip.

### Duplication Is Already DB-Safe; What Actually Matters Is Filter Cost-Efficiency (added 2026-08-14, per user request)

Read Story 3.4's dedup/newest-post design directly (its own text plus the as-built code, not assumed) before treating "avoid duplication" as an open risk here:

- **Duplicate rows are already prevented at the persistence layer, independent of actor choice.** [`persist-scraped-post.ts`](apps/backend/src/lib/posts/persist-scraped-post.ts) looks up an existing row by `postUrl`/`originalPostUrl` before inserting, and the insert itself uses `.onConflictDoNothing({ target: [posts.postUrl] })` — a post the actor returns twice (across two different days' runs, or even within one run) cannot create a second DB row. This holds no matter which actor is behind `getNewestPosts`.
- **The real cost-control mechanism is `onlyPostsNewerThan`/equivalent, computed in [`process-scrape-job.ts`](apps/backend/src/lib/scraper/process-scrape-job.ts)** as `MAX(posts.publishedAt)` already stored for the account (or a lookback default for a brand-new subscription) — passed to the adapter so, per Story 3.4 AC4, *"a call for an account with nothing new returns, and bills, zero items."* This is a **cost-efficiency** requirement, not a data-correctness one: the DB-level dedup above is the actual data-correctness backstop, and it's already actor-agnostic.
- **So the batch-relevant question this story should actually answer is:** does each candidate actor's cutoff parameter (`onlyPostsNewerThan`/`newerThan`/`recent`) filter server-side for free, or does it return/annotate everything and bill for what's filtered out — like `instagram-scraper/fast-instagram-post-scraper`'s original Task 1a sample showed via its `is_newer_than_cutoff` output field and a "Processing Fee (Filtered Items)" cost line ($0.00237 for 3 filtered items, on top of the 7 actually-returned results)? An actor that bills for filtered-out items breaks AC4's "bills zero items" premise every single day the batch runs against every subscribed account — a much larger, compounding cost exposure than anything the sync paths (Task 1a/1b) are evaluating. Task 1c below tests this directly rather than inferring it from the one sample already on file.

### Third-Party Actor Data-Access Risk (accepted here for the app-funded key; why BYOK, once it exists, will be stricter)

Per [Apify's Actor Terms §4.1/§4.4](https://docs.apify.com/legal/actor-terms-and-conditions): *"we share your Account information and Customer Data with the Creator, to the extent the Actor is able to access them"* and *"We do not monitor or control how Creators use the access granted to them through Actor permissions."* Even "limited permissions" exposes account-level details beyond the run's own input/output — [Apify's permissions docs](https://docs.apify.com/platform/actors/running/permissions) state a limited-permission Actor can *"read basic user information from the environment (whether the user is paying, their proxy password, or public profile)"* — a real credential (the account's proxy password), not just metadata. "Full permissions" is broader still and left unitemized by Apify's own docs.

The app-funded Apify account is the project owner's own account — per the 2026-08-14 correction, the owner has weighed this exposure and prefers the best available cost/reliability outcome over restricting to Apify-maintained actors, and is accepting this risk on their own account knowingly. This is deliberately **not** the same call Story 3.4b's future BYOK path will make: once/if BYOK is legally cleared, contributed keys belong to individual community members the app doesn't own the risk tolerance of — that path is restricted to **Apify-maintained actors only** (Creator = Apify itself, §4.4 disclaimer moot), a stricter default precisely because the app would be choosing this exposure on behalf of many different end-users' accounts, not just its own. See [3-4b-byok-pooled-scraper-vendor-keys.md](3-4b-byok-pooled-scraper-vendor-keys.md#actor-creator-data-access-risk-third-party-actors--added-2026-08-14) for that story's own design constraint.

### Sync-Path Timeout Gap (why AC2 exists)

`getPostByUrl` already has a 20s local timeout ([instagram-adapter.ts:97](apps/backend/src/lib/scraper/instagram-adapter.ts#L97)) via the existing `withTimeout` helper in the same file — `lookupAccountProfile` ([instagram-adapter.ts:141](apps/backend/src/lib/scraper/instagram-adapter.ts#L141)) has none. Both are awaited synchronously from GraphQL mutation resolvers ([resolvers.ts:993](apps/backend/src/schema/resolvers.ts#L993), [resolvers.ts:1429](apps/backend/src/schema/resolvers.ts#L1429)). A timeout on the JS side does not cancel the underlying Apify run or its billing — it only stops the caller from waiting indefinitely; this story does not attempt to cancel in-flight Apify runs, only to bound how long the user-facing request waits.

### References

- [Source: docs/assets/Apify actor costing and facts.md] — the four actors' cost/input/output samples this story's comparison table is drawn from.
- [Source: apps/backend/src/lib/scraper/instagram-adapter.ts] — the adapter this story modifies (`callApifyActor`, `withTimeout`, all three exported methods).
- [Source: apps/backend/src/schema/resolvers.ts:993,1429] — the two synchronous call sites motivating this story.
- [Source: _bmad-output/implementation-artifacts/3-4-scrape-new-posts-from-subscribed-accounts.md] — Story 3.4, the original adapter/actor choice this story refines; AC4's "bills zero items" requirement Task 1c tests directly, and the `newerThan`/`onlyPostsNewerThan` cost-control design.
- [Source: _bmad-output/implementation-artifacts/3-4a-add-brightdata-as-the-priority-scraping-vendor-for-the-scheduled-batch.md] — confirms the batch path's primary-vendor design (Bright Data, out of scope here) and its AC4 fallback-to-Apify path, which is why `getNewestPosts`'s Apify actor constant is in scope even though the rest of the batch pipeline isn't.
- [Source: _bmad-output/implementation-artifacts/3-4b-byok-pooled-scraper-vendor-keys.md] — the BYOK story whose actor pool is deliberately narrower than this one's, per the app-funded-vs-BYOK risk-ownership distinction in AC5.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts] — the DB-level dedup safety net (`onConflictDoNothing` on `postUrl`) that makes duplication a non-issue for actor choice, read directly to answer the user's 2026-08-14 batch/dedup question rather than assumed.
- [Source: apps/backend/src/lib/scraper/process-scrape-job.ts] — `newerThan` computation (`MAX(posts.publishedAt)`), read directly to confirm exactly what cutoff value each actor is actually called with in production today.

## Global Rules References

- [X]  `_bmad-output/project-context.md` — Adapter Pattern (General Architecture rule): this story keeps the existing `ScraperAdapter` interface unchanged, only varying which actor ID backs each method — no new abstraction introduced.
- [X]  `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — no PRD-level behavior change; this is a cost/reliability refinement of Story 3.4's existing scraping capability, not a new feature.

## Out of Scope

- The batch path's async/timeout handling and Bright Data primary-vendor design (already async, already Story 3.4a's domain) — **not** the Apify actor constant `getNewestPosts` itself uses, which Task 1c decides.
- Any BYOK-specific actor selection — Story 3.4b's future BYOK path is restricted to Apify-maintained actors only, by design, and is out of scope here regardless of what this story finds for the app-funded key.
- Cancelling in-flight Apify runs on timeout (JS-side timeout only bounds the caller's wait, not the run itself or its billing).
- Any change to `persist-scraped-post.ts`'s DB-level dedup mechanism — confirmed already correct and actor-agnostic (see Dev Notes), not something this story needs to touch.

## Definition of Done

- [X]  Task 1a's single-sample cost/duration comparison recorded (2026-08-14) — see Dev Notes.
- [ ]  Task 1b's fuller-sample confirmation for the two leading third-party candidates (sync-path pick).
- [ ]  Task 1c's filter-correctness/cost verification across all four actors (batch-path pick for `getNewestPosts`).
- [ ]  Sync-path actor swapped per AC1, actor IDs extracted to three named constants per AC4 (`getPostByUrl`, `lookupAccountProfile`, `getNewestPosts`).
- [ ]  `lookupAccountProfile` timeout added per AC2, with a distinct error type from "not found."
- [ ]  `instagram-adapter.test.ts` updated and passing.

## Completion Status

- [ ]  Backlog — initial cost/duration comparison done (Task 1a), pending a fuller sync-path sample (Task 1b), a batch-path filter-correctness/cost verification (Task 1c), and `bmad-create-story 3-4d` for full task-level detail before `dev-story`. Elevated priority: current production `getPostByUrl` timeout (20s) is already shorter than both observed Apify-maintained actor durations (31s, 75s) — see Background finding #3. Scope also now explicitly covers `getNewestPosts`'s actor constant (Background finding #4), not just the two sync-path methods — confirmed duplication itself is already DB-safe regardless of actor (see Dev Notes), so Task 1c is about cost-efficiency of each actor's newest-posts filter, not data correctness.
