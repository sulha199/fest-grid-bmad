---
title: 'persistScrapedPost videoUrl/originalPostUrl passthrough'
type: 'bugfix'
created: '2026-08-28'
status: 'done'
route: 'one-shot'
---

# persistScrapedPost videoUrl/originalPostUrl passthrough

## Intent

**Problem:** `persistScrapedPost()` already accepted and inserted `videoUrl` and `originalPostUrl`, but several callers (`process-scrape-job.ts`, `process-apify-async-result.ts`, `replay-actor-run.ts`, `process-brightdata-result.ts`) built a `ScrapedPost`-shaped object that already had these fields populated and then dropped one or both when calling the function — silently losing video URLs and original-post URLs for those code paths, including all Bright Data-sourced posts (which had no mapping for either field at all).

**Approach:** Wire `videoUrl`/`originalPostUrl` through consistently at every call site, and add a Bright Data raw-record mapping (`videos[0]` → `videoUrl`, `url` → `originalPostUrl`, mirroring how the Apify adapter already treats `originalPostUrl`). Implemented via two `cline-cli` dispatches to isolated worktrees (one for the fix, one for adversarial-review patches), each independently verified — including root-causing and fixing two defects the second dispatch itself introduced, and uncovering two significant pre-existing bugs unrelated to this change (logged in `deferred-work.md`: a `pnpm test` glob that silently skips `src/lib/**` test files, and a double-JSON-encoded `context` jsonb column with likely production impact).

## Suggested Review Order

**Field passthrough (the core fix)**

- Bright Data raw record → `ScrapedPost` mapping: new `videos[0]` extraction and `originalPostUrl = postUrl`.
  [`process-brightdata-result.ts:29-30`](../../apps/backend/src/lib/scraper/process-brightdata-result.ts#L29-L30)

- Same mapping duplicated in the replay path — pre-existing duplication, extended in parallel (see deferred-work.md).
  [`replay-actor-run.ts:141-142`](../../apps/backend/src/lib/scraper/replay-actor-run.ts#L141-L142)

- Missing `videoUrl` added to the Apify sync-scrape persistence loop.
  [`process-scrape-job.ts:28`](../../apps/backend/src/lib/scraper/process-scrape-job.ts#L28)

- Missing `originalPostUrl` added to the Apify async-result persistence call.
  [`process-apify-async-result.ts:29`](../../apps/backend/src/lib/scraper/process-apify-async-result.ts#L29)

**FK-violation retry hardening (surfaced by review)**

- Insert payload deduplicated into one `insertValues` object, reused (with `scraperActorRunId: null` override) by the retry — the retry previously duplicated all 12 fields by hand.
  [`persist-scraped-post.ts:57`](../../apps/backend/src/lib/posts/persist-scraped-post.ts#L57)

- FK-violation warning reworded so it no longer asserts the retry's outcome before attempting it.
  [`persist-scraped-post.ts:84`](../../apps/backend/src/lib/posts/persist-scraped-post.ts#L84)

**Test-cleanup correctness (surfaced during independent verification, not by the review)**

- Cleanup delete matches both a plain and a double-JSON-encoded `context` shape — the single-level match was silently deleting zero rows against real data.
  [`scraper-actor-run-linking.test.ts:32-33`](../../apps/backend/src/lib/scraper/scraper-actor-run-linking.test.ts#L32-L33)

- Per-test unique `runId` instead of one literal reused across three separate test blocks, which reproducibly collided on a DB unique constraint.
  [`scraper-actor-run-linking.test.ts:47`](../../apps/backend/src/lib/scraper/scraper-actor-run-linking.test.ts#L47)

**Regression tests**

- Malformed Bright Data video array element persists the post with `videoUrl: null` instead of dropping the whole record.
  [`process-brightdata-result.test.ts:237`](../../apps/backend/src/lib/scraper/process-brightdata-result.test.ts#L237)

- FK retry correctly rethrows when the retry's own insert fails for an unrelated reason.
  [`persist-scraped-post.test.ts:230`](../../apps/backend/src/lib/posts/persist-scraped-post.test.ts#L230)
