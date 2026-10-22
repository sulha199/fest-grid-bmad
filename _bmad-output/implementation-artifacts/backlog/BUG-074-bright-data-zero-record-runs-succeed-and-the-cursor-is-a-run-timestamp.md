---
backlog_id: BUG-074
title: "Bright Data returned 0 records for the whole fleet since 2026-10-21, every run is stored SUCCEEDED, and the next start date comes from the run's finish time, so the outage silently skips posts"
captured: 2026-10-22
---

# BUG-074: Bright Data zero-record runs succeed, and the cursor is a run timestamp (found 2026-10-22)

Found by the local session while gathering the audience POC posts (`prod-readonly/local-session-brief-2026-10-21-poc-posts.md`): a new scrape of 8 accounts came back empty. Read-only production queries and free Bright Data status calls then showed it is not the POC: production is affected. Companions: BUG-075 (the same cursor on Apify), IDEA-095 (switch to Apify when Bright Data fails), BUG-073 (the alert path this needs). Nothing was fixed or changed in production.

## 1. What happened (measured 2026-10-22, `readonly_2` and Bright Data `progress`/`log` calls)

`scraper_actor_runs`, vendor BRIGHTDATA, status SUCCEEDED, by completion day:

| Day | Runs | Zero-item runs | Items |
|---|---|---|---|
| 10-17 | 30 | 14 | 120 |
| 10-18 | 37 | 21 | 74 |
| 10-19 | 37 | 16 | 116 |
| 10-20 | 37 | 20 | 93 |
| **10-21** | **38** | **38** | **0** |
| **10-22** | **38** | **38** | **0** |

Before 10-21 about half the runs were legitimately empty (the account had no new post). On 10-21 and 10-22 every run is empty. Apify's last run is 10-19.

Three probes after that day all returned 0 records, with the same message:

1. A POC trigger of 8 new Malaysian accounts through the async `/trigger` form (the production form).
2. A second request in the form of the owner's curl: the synchronous `/scrape` endpoint, 4 inputs (`slemancityhall`, a production account scraped normally on 10-20, and `events_kl`, each with and without `start_date`). It returned `202` and a snapshot id, then 0 records, `success_rate 0`.
3. The production runs themselves.

So the date format, the endpoint form and the accounts are ruled out. The cause is at Bright Data (or Instagram's side of it); a support ticket is the owner's to raise (snapshot ids `sd_mvjdod1yoo46b2ark`, `sd_mvj0qrmv1usz57gpd5`, production examples `sd_mvhjfjpv2pcnm0moox`, `sd_mvhjfj5w1jxewvpnou`). Apify, run through the POC script on the same day, returned 8 posts for each of 12 accounts, so the accounts and Instagram are reachable.

## 2. What is wrong in our code

1. **A zero-record result is recorded as a success.** `apps/backend/src/lambdas/webhook.ts:46-58` parses the body, then calls `recordActorRunResult` with `status: 'SUCCEEDED'` and `itemCount: records.length` with no check for zero and no read of Bright Data's own status.
2. **The next start date comes from the run's finish time.** `lib/scraper/trigger-brightdata-for-target.ts:28-36` takes the newest run of the profile by `completedAt` (the comment says "successful", the query has **no status filter**) and turns it into `MM-DD-YYYY` (`mapBrightDataDateToStartDate`, UTC). A run that fetched nothing moves the cursor forward as far as one that fetched everything.
3. **What is lost.** Posts published after a profile's last real run and before the date of the first good run after recovery are never requested. Every false-zero run extends the gap. For the 38 profiles it starts at 2026-10-20 and grows by a day per day of outage. After recovery an active account's gap can also exceed `num_of_posts` (`scrapeResultsLimit`, 10).
4. **Nothing alerts.** `scraper-provider-health-store.ts` counts "full failure days" where no trigger succeeded; a day of 38 empty successes counts as healthy.

## 3. Facts measured about Bright Data's behaviour

* **`start_date` is inclusive.** 80 production runs (10-16 to 10-20): 461 items, 0 dated before the start day, 419 on the start day, 42 after.
* **Re-fetching the cursor day costs about 8 %.** Of 617 items fetched 10-12 to 10-20, 47 (7.6 %) had already been returned by an earlier run of the same profile. Stored posts carry `post_id` (a field, not `id`); 0 items lacked it.
* **A date-only cursor cannot skip a post** (inclusive start). It can only repeat posts of the cursor day.
* **Not stated in the documentation** (instagram-posts-discover-by-url): the time zone that defines a day, how `num_of_posts` combines with the dates, the order of results (the example is newest first), the id format `posts_to_not_include` takes (the example is numeric), and the empty-result response.
* **`include_errors=true` is not a parameter of the snapshot download** (400: `"include_errors" is not allowed`); it belongs to the `/scrape` call.

## 4. How to check a scrape's success rate (free calls, token in the `Authorization: Bearer` header)

| Call | Returns |
|---|---|
| `GET https://api.brightdata.com/datasets/v3/progress/{snapshot_id}` | `status` (`ready`, `failed`, ...), `records`, `errors`, `error_codes` (e.g. `{"dead_page":1}`), `error_message`, `collection_duration` |
| `GET https://api.brightdata.com/datasets/v3/log/{snapshot_id}` | `status`, `inputs_count`, `dataset_size`, `duration`, `success_rate` (not defined in the documentation) |
| `GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json` | the records |

Measured signatures (a handful of snapshots, not documented by Bright Data):

| Case | `records` | `errors` | `error_codes` / `error_message` | `success_rate` |
|---|---|---|---|---|
| Healthy | > 0 | 0 | none | 1 |
| Legitimately empty (before 10-21) | 0 | 1 | `{"dead_page":1}` | 0 |
| **Vendor failure (since 10-21)** | 0 | **0** | **none / "No records found. The data may not be available or has changed..."** | 0 |

`success_rate` alone cannot tell the last two apart; `error_codes.dead_page` and the message can. Treat the rule as provisional until Bright Data confirms it.

## 5. Plan (for a story, not done)

1. **Cursor from the newest stored post, not the run.** `start_date` = the UTC date of the newest `posts.date_posted` stored for the profile, minus one day (time-zone margin); fall back to `newerThan` when the profile has no post. A run that returns nothing then cannot move it. Apply the same rule to every vendor (BUG-075).
2. **Skip what is stored: `posts_to_not_include`.** Send the `post_id` of every stored post dated on or after the cursor day. This removes the repeat fetches and covers the margin day. First test on a working day: send one stored id for an account and confirm that post is absent from the result; if the id format is wrong, fall back to de-duplicating by `post_id` after download.
3. **Classify every Bright Data result before recording it.** In the webhook (or in the pending-job sweep that already reads `progress`), call `progress/{snapshot_id}`: `records > 0` is `ok`; `records = 0` with `dead_page` is `empty`; `records = 0` without it, or `status: failed`, is `vendor_failure`. Store the class on `scraper_actor_runs` (a new column or a new status) and **record `vendor_failure` as `FAILED`, not `SUCCEEDED`**.
4. **Fleet alert.** If a day has at least 10 runs and 80 % or more are `vendor_failure`, alert the owner (needs the BUG-073 alert path) and feed `scraper_provider_health` as a failure day. Thresholds to confirm.
5. **Recover the gap.** After Bright Data (or Apify, IDEA-095) works again, re-scrape the 38 profiles with `start_date` = 2026-10-20 and a `num_of_posts` that covers the gap (not 10); de-duplication by post URL already protects the posts table.
6. **Tests.** Zero records with and without `dead_page`; a failed run does not move the cursor; a cursor from the newest post; the id list is built from the cursor day on; an all-zero day raises the alert.

## 6. Open questions

Which time zone Bright Data uses for a day; whether `posts_to_not_include` takes `post_id` as stored; whether `num_of_posts` is applied before or after the date filter; Bright Data's explanation of the 10-21 change and whether its billing charged for the zero-record snapshots (the owner should check the invoice).

## Evidence

The queries and calls are reproducible with `PROD_RO2_DATABASE_URL` and the Bright Data token: runs by day (`scraper_actor_runs` grouped by `completed_at::date`), `raw_output`/`raw_input` of the last 10 days for the inclusivity and repeat figures (both are double-encoded JSON strings, BUG-068), and the three calls in section 4.

## Fixed, 2026-10-22 (hotfix cut from `master`; commits `8f8e0455`, `dba05bcc`, `@FIXCOMMIT@`)

Done as a **code-only hotfix on `master`** (a worktree branch, `claude/master-hotfix-e8eh9h`), so none of this
branch's planning material reaches `master`. Reviewed by the three `bmad-code-review` layers and by an
architect-level review the same day; both are summarised in `deferred-work.md` and in AD-43. Verification:
`packages/domain` 100 % line/branch/function on the three new modules; the full backend suite with the row-count
ratchet; the infrastructure stack tests.

### Plan section 5, item by item

| Item | Result |
|---|---|
| 1. Cursor from the newest stored post | **Done.** `getScrapeCursor` (backend) over `resolveScrapeCursor` (domain): Bright Data = newest `posts.published_at` minus one day, Apify = exact, a future-dated post clamped to now, no stored post = the caller's window. Both triggers use it; no run-based cursor lookup remains. |
| 2. `posts_to_not_include` | **Not built, on purpose.** The id format is unverified and a wrong value could fail every request. De-duplication by post URL already protects `posts`. Carried by **IDEA-099**. |
| 3. Classify every Bright Data result | **Done, with one deviation.** `classifyBrightDataResult` (domain) reads `progress`: records > 0 is `ok`; `dead_page` is `empty`; otherwise `vendor_failure`, stored **FAILED**, pending job expired, profile re-queued through the AD-34 gate. Inconclusive input (lookup failed or timed out, a status that is not `ready`/`failed`, records the vendor reports that never arrived) is `empty`, never an outage. The webhook and the stale-job sweep share it. **Deviation:** the class is *derived* (`FAILED`, or `SUCCEEDED` with 0 items), not stored on `scraper_actor_runs`; that needs a migration and is carried by **IDEA-098**. |
| 4. Fleet alert | **Partly done.** A provider whose newest finished runs mostly failed (>= 80 %) or all returned no posts is degraded; the daily batch records it as a failure day in `scraper_provider_health`, so the existing provider-down e-mail fires after `SCRAPER_PROVIDER_ALERT_THRESHOLD_DAYS` (default 2) days. The measure is a sliding sample, not "a day". The switch and the recovery are logged. **No notification reaches a human in production** until SES works (BUG-073): carried by **IDEA-096**. |
| 5. Recover the gap | **Automatic, with a limit.** The cursor never moved past 2026-10-20, so the first healthy run per profile requests from there. A profile whose gap exceeds the per-run limit (`SCRAPE_RESULTS_LIMIT`, default 30) is truncated: re-run a manual scrape for it. |
| 6. Tests | **Done** except the `posts_to_not_include` id list (item 2). The "all-zero day raises the alert" case is covered up to the failure-day row and the alert text; no test sends mail (SES). |

### What the review added (all fixed in the same hotfix)

* **The Bright Data webhook Lambda had no `BRIGHTDATA_API_TOKEN`, no `SCRAPING_QUEUE_URL` and no grants**, so in production
  the progress lookup would have thrown, been read as inconclusive, and an outage stored as a success exactly as before.
  Wired in the CDK stack; `festgrid-backend-stack.test.ts` now fails without it. *The unit tests could not see this: they
  set the token and queue URL themselves.*
* The re-queue now goes through the AD-34 scrape gate and needs an active subscription (it was a scrape start with no gate);
  the sweep's Apify branch had the same hole and uses the same helper now.
* A still-running snapshot that expires is recorded **TIMED_OUT** (it was `PENDING`, which health ignores), so a provider whose
  snapshots never finish degrades like one that fails.
* A degraded provider gets a few probes per interval (3 per 6 h per process), a failed probe gives its slot back, a quiet
  account clears a failure-based degradation, runs older than 72 h are ignored. A closed DPA switch or a trigger error is no
  longer relabelled as a vendor outage.
* The progress lookup is capped at 8 s on the webhook path; the sweep reuses the report it already fetched.

### Before deploying (read, do not act)

1. **The first batch after deploy will already see Bright Data as degraded**: the 10-21 and 10-22 rows are `SUCCEEDED` with
   0 items, which is `ALL_EMPTY`. Bright Data gets only its probes and the fleet goes to Apify. Confirm the Apify plan and its
   $5 FREE cap first (with the post cursor, spend is roughly new posts x $0.0023, not the full-window estimate).
2. Read-only checks (the owner's role): posts whose `published_at` is within about 2 minutes of `created_at` with a non-null
   `scraper_actor_run_id` are synthesized dates (BUG-076); if any exist, treat BUG-076 as a blocker.
3. The production deploy runs the infrastructure change too (the webhook Lambda's environment and grants).

### Known limits, carried as rows

BUG-076 (the cursor can run ahead of what a profile's own scrape captured), BUG-077 (caption-less posts pin the cursor),
BUG-078 (failed-run handling differs per vendor and is not atomic), BUG-079 (the budget gate counts triggers, not items),
IDEA-096 (alerting without SES), IDEA-097 (persisted health, DB-lease probe, one route resolver, owner override),
IDEA-098 (store the classification evidence, an `inconclusive` class, webhook acknowledges only), IDEA-099
(`posts_to_not_include`), FIND-095 (smaller review deferrals).
