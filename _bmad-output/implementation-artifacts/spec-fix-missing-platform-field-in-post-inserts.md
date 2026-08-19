---
title: 'Fix Missing Platform Field in Post Inserts'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '4d2bb2baf3133c386b464c93688e8552471ac060'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every scraped Instagram post insert silently fails due to a missing `platform` field. The database `posts` table has a NOT NULL constraint on `platform` with no default. When `persistScrapedPost()` attempts to insert, Postgres throws error 23502 (`null value in column "platform" of relation "posts" violates not-null constraint`). This error is caught and swallowed by `process-scrape-job.ts`'s outer try-catch, causing scrape runs to report success with output items while zero posts actually land in the database.

**Approach:** Add `platform: string` to `PersistScrapedPostParams`, include it in the insert query, and pass the correct platform value from all three call sites (`process-scrape-job.ts`, `process-apify-async-result.ts`, `process-brightdata-result.ts`). Update integration tests to pass the required field.

## Boundaries & Constraints

**Always:**
- The platform must be passed from the caller and never defaulted/guessed in `persistScrapedPost()`
- For sync call sites (process-scrape-job), use `job.platform` (the real value already in scope)
- For async-only call sites (Apify, Bright Data), pass `platform: 'instagram'` with a one-line comment explaining these adapters only handle Instagram today
- Do not add DB lookups, schema changes to `apifyPendingJobs`/`brightdataPendingJobs`, or audit tables
- Strict TypeScript — no `any` types; ensure type safety end-to-end

**Ask First:**
- None — scope is locked and focused

**Never:**
- Add moderator-facing recovery UI (tracked as separate Stories 3-4j/3-4k)
- Touch `apifyPendingJobs`/`brightdataPendingJobs` schema
- Add logging/audit tables
- Split this into multiple PRs (keep it as one atomic fix)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Insert new post via sync scraper | `job.platform='instagram'`, new post URL | Post inserted with platform='instagram' | Postgres error propagates (caught upstream in process-scrape-job) |
| Insert duplicate post URL via sync scraper | `job.platform='instagram'`, URL already exists | Return existing post unchanged, no re-insert | Race-safe via onConflictDoNothing |
| Insert new post via Apify webhook | `pendingJob.profileId` only, async adapter data | Post inserted with platform='instagram' (hardcoded, Instagram-only path) | Error logged, continue to next item |
| Insert new post via Bright Data webhook | `pendingJob.profileId` only, async adapter data | Post inserted with platform='instagram' (hardcoded, Instagram-only path) | Error logged, continue to next item |
| Existing test calls missing platform | Test calls without platform param | TypeScript compile-time error (required field) | Fix: add platform:'instagram' to all 4 test cases |

</frozen-after-approval>

## Code Map

- `packages/database/schema.ts:168` -- posts table schema: defines `platform: text('platform').notNull()` with no default
- `apps/backend/src/lib/posts/persist-scraped-post.ts:5-12` -- PersistScrapedPostParams interface: currently missing platform field
- `apps/backend/src/lib/posts/persist-scraped-post.ts:42-54` -- insert query: never sets platform column
- `apps/backend/src/lib/posts/persist-scraped-post.test.ts` -- integration tests: 4 tests (a/b/c/d) call persistScrapedPost without platform
- `apps/backend/src/lib/scraper/process-scrape-job.ts:13-27` -- persistScrapedPosts helper: has job.platform in scope but doesn't pass it
- `apps/backend/src/lib/scraper/process-scrape-job.ts:91-93` -- outer try-catch: swallows Postgres 23502 errors
- `apps/backend/src/lib/scraper/process-apify-async-result.ts:22-28` -- persistScrapedPost call site: missing platform, Instagram-only path
- `apps/backend/src/lib/scraper/process-brightdata-result.ts:69-75` -- persistScrapedPost call site: missing platform, Instagram-only path

## Tasks & Acceptance

**Execution:**

1. [x] `packages/database/schema.ts` -- Verify (read-only) that posts table has `platform: text('platform').notNull()` at line 168 -- confirms the NOT NULL constraint that blocks all inserts

2. [x] `apps/backend/src/lib/posts/persist-scraped-post.ts:5-12` -- Add `platform: string` field to `PersistScrapedPostParams` interface -- makes platform mandatory for all callers

3. [x] `apps/backend/src/lib/posts/persist-scraped-post.ts:42-54` -- Update the `.insert(posts).values({...})` call to include `platform` in the values object -- ensures the constraint is satisfied on insert

4. [x] `apps/backend/src/lib/scraper/process-scrape-job.ts:16-23` -- Pass `platform: job.platform` to `persistScrapedPost()` call in `persistScrapedPosts()` helper -- the job already has the correct platform value from scrape targets

5. [x] `apps/backend/src/lib/scraper/process-apify-async-result.ts:22-28` -- Pass `platform: 'instagram'` (hardcoded) to `persistScrapedPost()` call with a one-line comment: `// Apify adapter only handles Instagram today` -- keeps the fix minimal while fixing the immediate bug

6. [x] `apps/backend/src/lib/scraper/process-brightdata-result.ts:69-75` -- Pass `platform: 'instagram'` (hardcoded) to `persistScrapedPost()` call with a one-line comment: `// Bright Data adapter only handles Instagram today` -- mirrors the Apify approach

7. [x] `apps/backend/src/lib/posts/persist-scraped-post.test.ts:22-28 (test a)` -- Add `platform: 'instagram'` to the first test's `persistScrapedPost()` call -- test data must match schema

8. [x] `apps/backend/src/lib/posts/persist-scraped-post.test.ts:47-62 (test b)` -- Add `platform: 'instagram'` to both test's `persistScrapedPost()` calls (lines ~47 and ~56) -- test data must match schema

9. [x] `apps/backend/src/lib/posts/persist-scraped-post.test.ts:80-93 (test c)` -- Add `platform: 'instagram'` to both test's `persistScrapedPost()` calls (lines ~80 and ~88) -- test data must match schema

10. [x] `apps/backend/src/lib/posts/persist-scraped-post.test.ts:114-129 (test d)` -- Add `platform: 'instagram'` to both test's `persistScrapedPost()` calls (lines ~114 and ~123) -- test data must match schema

11. [x] TypeScript strict mode -- All changes are syntactically correct and follow strict TypeScript patterns; pre-existing codebase errors remain unchanged

**Acceptance Criteria:**

- Given a scrape job for Instagram with new posts, when `processScrapeJob()` calls `persistScrapedPosts()`, then all posts are inserted with `platform='instagram'` and no Postgres 23502 errors occur
- Given Apify or Bright Data async results, when processing the webhook, then posts are inserted with `platform='instagram'` (hardcoded, adapter-specific)
- Given the test suite, when running `pnpm --filter backend test -- persist-scraped-post`, then all four integration tests pass (the duplicate-URL, context-aware detail views, and edge cases all work)
- Given TypeScript strict mode, when running `pnpm --filter backend typecheck`, then no errors occur

## Spec Change Log

<!-- No changes yet — spec created fresh, ready for approval -->

## Verification

**Commands:**
- `pnpm --filter backend typecheck` -- expected: all passes, no type errors on the updated `PersistScrapedPostParams` or call sites
- `pnpm --filter backend test -- persist-scraped-post` -- expected: all four test cases (a/b/c/d) pass with platform field provided
- `pnpm --filter backend test -- process-scrape-job` -- expected: scraper integration tests pass (callers now provide platform)
- `pnpm --filter backend test -- process-apify-async-result` -- expected: Apify async tests pass (hardcoded platform now set)
- `pnpm --filter backend test -- process-brightdata-result` -- expected: Bright Data async tests pass (hardcoded platform now set)

## Suggested Review Order

**Parameter Interface**

- Required field that all callers must now provide; enforces platform at the type system level.
  [`persist-scraped-post.ts:5-12`](../../../apps/backend/src/lib/posts/persist-scraped-post.ts#L5)

**Insert Query**

- Platform column now included in values; satisfies the NOT NULL constraint on the database side.
  [`persist-scraped-post.ts:42-54`](../../../apps/backend/src/lib/posts/persist-scraped-post.ts#L42)

**Sync Scraper Caller**

- Uses `job.platform` from context; the real, already-validated platform from scrape targets.
  [`process-scrape-job.ts:16-23`](../../../apps/backend/src/lib/scraper/process-scrape-job.ts#L16)

**Async Scrapers**

- Apify adapter (Instagram-only today) passes hardcoded 'instagram' with explanatory comment.
  [`process-apify-async-result.ts:22-28`](../../../apps/backend/src/lib/scraper/process-apify-async-result.ts#L22)

- Bright Data adapter (Instagram-only today) passes hardcoded 'instagram' with explanatory comment.
  [`process-brightdata-result.ts:69-75`](../../../apps/backend/src/lib/scraper/process-brightdata-result.ts#L69)

**Integration Tests**

- All four test cases (a/b/c/d) updated to provide required platform field; test data now matches schema.
  [`persist-scraped-post.test.ts`](../../../apps/backend/src/lib/posts/persist-scraped-post.test.ts#L20)
