# Bright Data result yield and `dead_page` scheduling policy

Date: 2026-10-31. Author: Winston (architect pass), for shulha. Status: proposal, nothing built. Decisions D1-D5 below need an answer before implementation.

## 1. What we measured (prod, read-only, 2026-10-15 to 2026-10-31)

All figures come from `scraper_actor_runs` (vendor BRIGHTDATA, 371 runs) joined to Bright Data's free `progress` endpoint, plus one paid probe of 3 records.

| Fact | Number |
|---|---|
| Records Bright Data reported delivering | 1,272 (equal to our stored `item_count` total) |
| Distinct posts those runs created or associated | 848, so 424 records (33%) were re-deliveries of posts we already had |
| Error records in progress reports | 44, every one `dead_page` |
| Snapshots with a `dead_page` | 44, on 17 of 38 subscribed profiles |
| Of those 44: partial (records and 1 error) / errors only | 5 / 39 |
| Profiles with a `dead_page` that delivered records on other days | 14 of 17 |
| Next run after an errors-only `dead_page` (same profile) | 19 `dead_page` again, 3 records, 13 zero-record outage runs |
| Worst-case cost of all 44 error records at $1.50 per 1,000 | about $0.07 (possibly $0: the docs conflict on billing failed records) |
| Cost of all 1,272 delivered records at $1.50 per 1,000 | about $1.91 in 17 days |
| Worst case if every one of the 38 profiles returned `dead_page` every day | 1,140 records a month, about $1.71 |

Three findings change the question.

1. **`dead_page` does not mean a dead profile.** A one-shot profile lookup of `biliardindonesia`, `informasiturnamenfutsal.id` and `jogjacoffeeweek.id` returned 3 of 3 public profiles with 9.8K, 5.8K and 15.4K followers. The first two have never delivered a post to us (0 items in 9 runs each). A `dead_page` on the posts dataset means "nothing collected for this input", most often an empty date window.
2. **It is not reliably "nothing new" either.** `aftereo.ofc` was asked for posts from 2026-10-25 on, already had one published 2026-10-26, and still got `dead_page` on 10-29 and 10-31. Treat the code as a weak signal, not a verdict.
3. **The credit it consumes is negligible.** Even the worst case is under $2 a month, against 5,000 free credits. The re-delivery of known posts costs about nine times more than `dead_page` does, and it is also small. The binding cost constraint in this system was the Apify $5 cap, not Bright Data.

## 2. Decisions

> Status 2026-10-31: D1 and D2 are built (IDEA-104, PR #130, migration 0089), with one addition: a fourth column `new_posts`, recorded for Bright Data and Apify async deliveries, which the cadence backoff needs. D3 stays unbuilt on purpose. D4 is refined by the seeding and backoff document.

### D1. Classify yield as a second dimension, leave `ScrapeResultClass` alone
`classifyBrightDataResult` (BUG-074) answers "is the vendor up?" from zero-record snapshots, and provider health depends on it. Folding partial success into it would risk demoting a healthy provider. Add a separate pure function in `@festgrid/domain` (100% branch coverage applies):

`classifyBrightDataYield({ records, errors, errorCodes }) -> { rate, level, followUp }`

| Level | Condition | Follow-up |
|---|---|---|
| `complete` | errors = 0 and records > 0 | none |
| `partial-expected` | errors > 0 and every code is in the expected set (`dead_page`) | record only |
| `partial-retryable` | errors > 0 and a code is in the retryable set | one retry, see D3 |
| `partial-unknown` | errors > 0 and a code is in neither set | log with the code, count it, no retry |
| `empty` / `failed` | records = 0 | unchanged, BUG-074 path |

`rate = records / (records + errors)`. The expected and retryable code sets are named constants. The retryable set starts **empty**: no transient code has ever been observed in 371 snapshots, so listing codes now would be guessing (Rule of Three).

### D2. Store the yield on the run row
Add nullable `records_reported`, `errors_reported` (integers) and `error_codes` (jsonb) to `scraper_actor_runs`. No new table, so no new RLS statement; one migration (0088 or later, check journal order). This gives the missing daily success-rate view and the evidence needed to decide D3 and D4 with data instead of opinion.

Where to read it: the `progress` call is free but the webhook has a 29 s limit. Read it **after** the posts are persisted and the job is marked completed, best effort with the existing 8 s timeout (`PROGRESS_LOOKUP_TIMEOUT_MS`). If the read fails, the columns stay null and nothing else changes. Snapshots finished by the stale-job sweep reuse the report the sweep already holds.

### D3. Retry policy: do not build the retry mechanism yet
A failed post inside the cursor window is retried for free by the next daily run, because the Bright Data cursor keeps a 1-day margin. The only gap is a failed post that is older than a newer post that succeeded: the cursor moves past it. That is a real but small edge, and we have no observed transient error to justify a mechanism. Ship D1 and D2 now, with the retryable set empty. When a transient code shows up in `error_codes`, adding it to the set plus a single capped retry (re-trigger that profile once, after a delay, not counted against provider health) is a small follow-up.

> Update 2026-10-31: D4 is refined by `profile-history-seed-and-cadence-backoff-2026-10-31.md` (E4): the backoff keys on a per-profile posting cadence and an "empty run" (0 new posts), capped at 3 days, never off. The cost reasoning below still holds.

### D4. `dead_page` scheduling: keep daily, do not back off, do not disable
| Option | Verdict |
|---|---|
| Keep daily (today) | **Recommended.** Worst case under $2 a month; an idle profile that posts tomorrow is picked up tomorrow, which is the product's value. |
| Back off to weekly after N empties | Saves about $0.05 a month at today's scale, delays event discovery by up to 6 days, and needs a streak calculation in target selection. Not worth it now. |
| Disable a profile past a credit level | Wrong place for the guard. `dead_page` does not mean the profile is dead (finding 1), so disabling silently loses events from live accounts. |

Credit protection belongs at the vendor level, not per profile. A provider-level monthly ceiling already exists for the capacity guards (`scraper_provider_usage`); extend the same idea if Bright Data spend ever matters.

**Revisit triggers** (write the stored yield into a query and check monthly): worst-case `dead_page` spend above $10 a month, or above 10% of the Bright Data bill, or subscribed profiles above roughly 500. If a backoff is built then, it should be a pure function of consecutive empty yields (`dead_page`-only runs, never `vendor_failure`), geometric from daily to a weekly cap, reset by any delivered record, and **never off**.

### D5. Zero-post profiles are a data-quality signal, not a cost problem
`biliardindonesia` and `informasiturnamenfutsal.id` exist, are public, and have thousands of posts, yet we hold 0 posts for them. Likely cause: the first-scrape lookback window finds nothing and the cursor then creeps forward by the margin. Raise this as a separate investigation (a backlog finding), not as part of the yield work. The one-shot profile lookup above is the cheap diagnostic for a profile like this.

## 3. Out of scope, noted
- `posts_to_not_include` (the 33% re-delivery) is its own row: it saves about $0.64 per 17 days, needs numeric ids derived from stored shortcodes, and shortens the cursor margin question. Do it separately.
- A per-run Slack or log alert on `partial-unknown` is a nice to have; the structured log line is enough until the count is non-zero.

## 4. Implementation sketch (if D1-D5 are accepted)
1. Domain: `classifyBrightDataYield` plus tests (100% branches), exported from the scraper index.
2. Database: three nullable columns, migration via drizzle-kit, journal order test green.
3. Backend: a small `recordBrightDataYield(runId, progress)` called best-effort at the end of `processBrightDataResult` (and from the sweep path with the report it already has), a structured log line per partial, tests with the row-count ratchet in mind.
4. Docs: `_bmad-output/project-context.md` scraper section, backlog row, and a monthly query in the incident or runbook doc.

## 5. Risks
- Progress fields beyond the four documented ones are undocumented; a rename would null the columns. The classifier already depends on them, so the exposure is not new, and unknown shapes degrade to null.
- Billing for failed records is unresolved in the docs; the cost numbers above are bounds, not invoices. The Bright Data dashboard is the only authority.
