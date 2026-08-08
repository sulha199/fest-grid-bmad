# Story 3.4: Scrape new posts from subscribed accounts

## Story Details

- Epic: 3
- Story ID: 3.4
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to periodically scrape new posts from the social media accounts that users have subscribed to, plus scrape a brand-new account immediately when someone subscribes to it,
so that I can begin the event extraction process without making a first-time subscriber wait up to a full day for any posts to appear.

## Acceptance Criteria

1. **Given** there are active (non-soft-deleted, AD-8) subscriptions to social media accounts, **when** the scraping process is triggered on a recurring **once-daily** EventBridge schedule (replacing Story 0.14's placeholder `rate(6 hours)`), **then** the system determines the batch of accounts to scrape as the **distinct** set of accounts with at least one active subscriber (never once per subscription row — an account with 5 subscribers is scraped once, not 5 times), **excluding** any account whose `SocialMediaAccountProfile.lastScrapedAt` is within a configurable window (default 20 hours, `SCRAPE_SKIP_RECENT_HOURS` env var) of now.
2. **And** each account in that batch is dispatched as a separate message onto the `ScrapingQueue` (SQS) rather than scraped synchronously in one Lambda invocation — matching the fan-out pattern already wired by Story 0.14 (EventBridge → `L_Scrape` "seed run" → enqueues per-account jobs onto `ScrapingQueue` → `ScrapingQueue` → `L_Scrape` "per-account processing").
3. **And** each per-account job retrieves that account's newest posts via a platform-specific `ScraperAdapter` (Story 3.3c's registry, `getScraperAdapter(platform).getNewestPosts(...)`) — never a hardcoded, single-platform implementation — and persists each returned post via Story 3.3a's `persistScrapedPost`, with `postUrl` set to whatever URL the adapter actually scraped from and `originalPostUrl` populated whenever the adapter's derivation rule can determine the canonical original-platform URL (Story 1.2a's amendment). After the attempt (success or a handled per-account failure), `SocialMediaAccountProfile.lastScrapedAt` is stamped with the current time.
4. **And** the first concrete adapter is a **real** Instagram adapter scraping through the `imginn.com` proxy/mirror (PRD §3.7's own named example) via HTTP fetch + HTML parsing (`cheerio`) — explicitly **unverified against the live site** (see Dev Notes "Known Risk: Unverified Scraping Implementation").
5. **And** the second registered adapter, for Twitter/X, is an explicit **not-yet-implemented stub** — both `ScraperAdapter` interface methods throw a clear `Error('Twitter/X scraping is not yet implemented')` — registered now so the platform-slug/display-name registry (Story 3.3c) stays fully populated for Story 3.11's routing, without a second unverified live-scraping implementation in this pass.
6. **And**, distinct from the daily batch (AC1-3), when a user subscribes to an account and Story 3.1a's `subscribeToAccount` lookup-or-create logic creates a **brand-new** `SocialMediaAccountProfile` row (never when subscribing to an already-known, already-profiled account), an on-demand scrape job for that one account is enqueued onto `ScrapingQueue` **asynchronously** — `subscribeToAccount` enqueues and returns immediately without blocking on the scrape completing; a failure to enqueue (e.g. a transient SQS error) is caught, logged, and does not fail the subscribe mutation.
7. **And** a failure processing any single account's job (adapter throw, parse error, DB error, etc.) is caught and logged without failing the Lambda invocation for other accounts in the same SQS batch — one broken account/adapter must not block or trigger a redelivery of other accounts' jobs in the same batch.
8. **And** no GraphQL schema, resolver, or `apps/web` change is introduced by this story — this is a backend Lambda/queue/DB pipeline story with no user-facing UI surface (confirmed via Gate 2, no gap).
9. **And** i18n, PostHog analytics events, loaders (blocking/non-blocking), and client state categorization (React Query / nuqs / zustand) do not apply to this story — it has no user-facing component. Explicitly stated rather than silently omitted, per this project's story-creation conventions.

## Tasks / Subtasks

- [ ] Task 1: Add `lastScrapedAt` column to `SocialMediaAccountProfile` (AC: #1, #3)
  - [ ] `packages/database/schema.ts`: add `lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true })` (nullable) to `socialMediaAccountProfiles`, alongside the existing (currently unused by any story) `lastPostDate` column — do not conflate the two; `lastPostDate` is unrelated to this story's scrape-bookkeeping and is left untouched.
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the Drizzle-kit migration SQL file (next sequential number after `0017_wakeful_talisman.sql`); commit both the migration file and its `meta/` snapshot.
  - [ ] Verify the generated migration is a simple additive `ALTER TABLE ... ADD COLUMN` (no data loss, no backfill needed — column starts `NULL` for all existing rows, which AC1's `lastScrapedAt IS NULL OR ...` condition already treats as "never scraped, include in batch").

- [ ] Task 2: `apps/backend/src/lib/scraper/instagram-adapter.ts` — real Instagram/imginn.com adapter (AC: #4)
  - [ ] Add `cheerio` as a dependency of `apps/backend/package.json`.
  - [ ] Export `fetchImginnHtml(username: string): Promise<string>` (raw `fetch` call to `https://imginn.com/${username}/` with realistic browser-like headers: `User-Agent`, `Accept`, `Accept-Language`) as a mutable `export let`, plus `setFetchImginnHtml(fn)` — mirroring `gemini-client.ts`'s `callGeminiGenerateContent`/`setCallGeminiGenerateContent` test-seam pattern, so tests never make a live network call.
  - [ ] Export `parseImginnPostsHtml(html: string): ScrapedPost[]` — cheerio-based parser producing `{ content, imageUrl?, postUrl, originalPostUrl?, publishedAt }[]` from a profile page's post grid. Best-effort selector logic (no live DOM available to verify against during this story — see Dev Notes "Known Risk"); must not throw on unexpected/empty markup — return `[]` and log a warning instead.
  - [ ] Export `parseImginnProfileHtml(html: string): { displayName: string; username: string; profileImageUrl?: string } | null` for the `lookupAccountProfile` interface method — same best-effort/no-throw posture.
  - [ ] Export `instagramScraperAdapter: ScraperAdapter` (from `@festgrid/domain/scraper`, Story 3.3c) implementing `getNewestPosts(account)` (fetch + parse) and `lookupAccountProfile(handleOrUrl)` (parse the handle out of a raw URL if given, fetch + parse profile).
  - [ ] Unit tests (`instagram-adapter.test.ts`, `node:test`): `parseImginnPostsHtml`/`parseImginnProfileHtml` against small synthetic fixture HTML strings (not captured from the live site — explicitly documented as such in a code comment) covering: a normal populated page, an empty/no-posts page, and malformed/unexpected markup (asserting no throw, empty-array/null return). `getNewestPosts`/`lookupAccountProfile` tested via the `setFetchImginnHtml` seam, asserting the correct URL is fetched and the parse result is passed through.

- [ ] Task 3: `apps/backend/src/lib/scraper/twitter-adapter.ts` — stub adapter (AC: #5)
  - [ ] Export `twitterScraperAdapter: ScraperAdapter` whose `getNewestPosts` and `lookupAccountProfile` both `throw new Error('Twitter/X scraping is not yet implemented')`.
  - [ ] Unit test asserting both methods reject with that exact error.

- [ ] Task 4: `apps/backend/src/lib/scraper/register-adapters.ts` (AC: #4, #5)
  - [ ] Import `registerScraperAdapter` from `@festgrid/domain/scraper` and call it once each for `'instagram'` → `instagramScraperAdapter` and `'twitter'` → `twitterScraperAdapter`, at module top-level (so importing this module for its side effect registers both).

- [ ] Task 5: `apps/backend/src/lib/scraper/get-scrape-targets.ts` (AC: #1)
  - [ ] Export `getBatchScrapeTargets(): Promise<ScrapeTarget[]>` where `ScrapeTarget = { profileId: string; platform: SupportedPlatform; accountId: string; username: string }`.
  - [ ] Query: distinct `socialMediaAccountProfiles` rows joined to `subscriptions` on `subscriptions.accountId = socialMediaAccountProfiles.id`, filtered by `activeOnly(subscriptions)` (`@festgrid/graphql-select`) and `(lastScrapedAt IS NULL OR lastScrapedAt < NOW() - INTERVAL '<SCRAPE_SKIP_RECENT_HOURS> hours')`.
  - [ ] Defensively filter/skip (with a logged warning) any row whose `platform` value is not a member of `SUPPORTED_PLATFORMS` — the DB column is plain `text`, not DB-enum-constrained, so this is a real (if unlikely) runtime possibility, not a redundant check.
  - [ ] Integration test (`get-scrape-targets.test.ts`, real DB, `node:test`, mirroring `persist-scraped-post.test.ts`'s setup/teardown style): seed profiles/subscriptions covering — a profile with 2 active subscribers appears exactly once; a profile whose only subscription is soft-deleted is excluded; a profile with `lastScrapedAt` 1 hour ago is excluded; a profile with `lastScrapedAt` 25 hours ago is included; a profile with `lastScrapedAt = NULL` is included.

- [ ] Task 6: `apps/backend/src/lib/scraper/enqueue-scrape-job.ts` (AC: #2, #6)
  - [ ] Add `@aws-sdk/client-sqs` as a dependency of `apps/backend/package.json`.
  - [ ] Export `enqueueScrapeJob(target: ScrapeTarget): Promise<void>` sending one `SendMessageCommand` to `env.scrapingQueueUrl` with `JSON.stringify(target)` as the body, using the same mutable-export test-seam pattern as Task 2 (`export let sendScrapeJobMessage = ...; export function setSendScrapeJobMessage(fn) {...}`) so callers/tests never touch a real SQS client.
  - [ ] Unit test asserting the correct queue URL and message body shape via the test seam.

- [ ] Task 7: `apps/backend/src/lib/scraper/process-scrape-job.ts` (AC: #3, #7)
  - [ ] Export `processScrapeJob(job: ScrapeTarget): Promise<void>`: resolve the adapter via `getScraperAdapter(job.platform)` (Story 3.3c registry), call `getNewestPosts({ accountId: job.accountId, username: job.username })`, then `persistScrapedPost({ accountId: job.profileId, ...post })` for each returned post, then update `socialMediaAccountProfiles.lastScrapedAt = new Date()` for `job.profileId`.
  - [ ] Wrap the adapter call + persistence in a try/catch internal to this function; on error, log with job context (`profileId`, `platform`) and **do not rethrow** — this is what makes AC7's per-account error isolation work when called in a loop over an SQS batch. Still stamp `lastScrapedAt` in a `finally` so a persistently-broken account is naturally rate-limited to one attempt per `SCRAPE_SKIP_RECENT_HOURS` window rather than retried every batch.
  - [ ] Integration test (real DB, fake platform registered via `registerScraperAdapter` with an in-test stub adapter — mirroring `adapter-registry.test.ts`'s expected pattern from Story 3.3c): asserts posts are persisted, `lastScrapedAt` is stamped, and an adapter that throws does not propagate out of `processScrapeJob` (still stamps `lastScrapedAt`).

- [ ] Task 8: `apps/backend/src/lambdas/scraper.ts` — real handler (AC: #1, #2, #3, #7)
  - [ ] Import `./register-adapters` (or the equivalent `apps/backend/src/lib/scraper` path) at module top-level for its registration side effect.
  - [ ] Branch on event shape: if `EventBridgeEvent` (has no `Records` array), call `getBatchScrapeTargets()` then `enqueueScrapeJob(target)` for each target (`Promise.all`, or `Promise.allSettled` so one enqueue failure doesn't block the others).
  - [ ] If `SQSEvent` (has `Records`), for each `record`, `JSON.parse(record.body)` into a `ScrapeTarget` and `await processScrapeJob(target)` — since `processScrapeJob` already swallows its own errors (Task 7), no additional try/catch is needed here, but confirm this explicitly with a test so the isolation guarantee is asserted at the handler level too, not just unit-tested on `processScrapeJob` in isolation.
  - [ ] Remove the `console.log('scraper lambda invoked (placeholder)', ...)` placeholder line.

- [ ] Task 9: Retrofit `subscribeToAccount` with the on-demand trigger (AC: #6)
  - [ ] `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`: after the `if (!accountProfile) { ... }` branch's re-select completes (i.e. only on the "created a brand-new profile" path, never the "found existing profile" path), call `enqueueScrapeJob({ profileId: accountProfile.id, platform: accountProfile.platform as SupportedPlatform, accountId: accountProfile.accountId, username: accountProfile.username })` wrapped in try/catch — log and continue on failure, never throw from this call site.
  - [ ] Extend `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, currently passing, do not remove existing assertions): add a case asserting `enqueueScrapeJob`'s test seam is invoked exactly once when a new profile is created, and not invoked when subscribing to an already-existing profile.

- [ ] Task 10: `apps/backend/src/env.ts` (AC: #1, #2, #6)
  - [ ] Add `scrapingQueueUrl?: string` to `BackendEnv` and `process.env.SCRAPING_QUEUE_URL` to `loadBackendEnv()` (matching the existing pattern/eslint-disable-comment style for other env vars).
  - [ ] Add `scrapeSkipRecentHours: number` (`parseInt(process.env.SCRAPE_SKIP_RECENT_HOURS || '20', 10)`), matching the existing `apiKeyInvalidAttemptsThreshold`-style configurable-threshold pattern.
  - [ ] Add `SCRAPING_QUEUE_URL` and `SCRAPE_SKIP_RECENT_HOURS` to `.env.example`.

- [ ] Task 11: Fix and extend `apps/infrastructure/lib/festgrid-backend-stack.ts` (AC: #1, #2, #6; also closes a pre-existing gap, see Dev Notes)
  - [ ] Change the schedule rule from `events.Schedule.rate(cdk.Duration.hours(6))` to `events.Schedule.rate(cdk.Duration.days(1))`.
  - [ ] Add `DATABASE_URL: process.env.DATABASE_URL || ''` and `SCRAPING_QUEUE_URL: scrapingQueue.queueUrl` to `scraperLambda`'s `environment` block (currently only has `STAGE` — the Lambda cannot run without `DATABASE_URL`, since `db/client.ts` throws at import time if it's missing).
  - [ ] Add `SCRAPING_QUEUE_URL: scrapingQueue.queueUrl` to `apiLambda`'s `environment` block (needed for Task 9's on-demand enqueue, which runs inside `L_API`).
  - [ ] Add `scrapingQueue.grantSendMessages(apiLambda)` (new — `L_API` now sends to `ScrapingQueue` too).
  - [ ] Remove the stale `aiProcessingQueue.grantSendMessages(scraperLambda)` line — the Epic 3 readiness sweep already corrected `docs/infrastructure/high-level-overview.md`'s diagram to remove the `L_Scrape → SQS_AI` edge (the scraper never enqueues to `AIProcessingQueue`); this IAM grant was never updated to match and is a least-privilege violation left over from before that fix. Keep `scrapingQueue.grantSendMessages(scraperLambda)` (still needed for the batch self-enqueue, AC2).
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: update the existing `ScheduleExpression: 'rate(6 hours)'` assertion to `'rate(1 day)'` (CDK's actual generated string for a 1-day rate — singular "day", not "1 days").

- [ ] Task 12: Update `docs/infrastructure/high-level-overview.md` diagram (AC: #6)
  - [ ] Add an edge `L_API -- enqueues (on-demand, new account) --> SQS_Scrape` to the mermaid diagram, reflecting Task 9/AC6's new producer onto `ScrapingQueue` alongside the existing EventBridge/self-enqueue paths.

- [ ] Task 13: `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07, lists `3.4` in `stories_covered`). That sweep found and fixed a Gate 1 diagram/AC contradiction (`docs/infrastructure/high-level-overview.md`'s `L_Scrape → SQS_AI` edge, corrected — this story's posts are stored for later manual selection, never auto-queued for AI processing) and created Story 3.3c (Gate 3, the `ScraperAdapter` interface/registry this story now consumes) as this story's own prerequisite. No further Gate 1/3 prerequisite gap for this story's core scraping-pipeline scope.
  - **Lightweight guard (fresh, story-specific) — found two additional infra gaps the epic-wide sweep did not anticipate** (both are pre-existing bugs in already-committed IaC, not new architecture decisions, so no `AskUserQuestion` was needed — see Task 11): the Scraper Lambda's CDK `environment` block was missing `DATABASE_URL`/a `ScrapingQueue` URL entirely (it could not have run its real logic without this story fixing it), and it retained a stale `AIProcessingQueue.grantSendMessages` IAM grant that the Epic 3 sweep's diagram fix never propagated into the actual CDK code. Both are fixed directly in this story's task list per this workflow's "leave the system working end-to-end" mandate, rather than filed as a separate story — they are corrections to infrastructure this story is already the first real consumer of, not new scope.
  - **A second, larger set of items were resolved directly with the user via `AskUserQuestion` during this story's creation** (not sourced from the swept report, since they concern decisions the sweep — which only evaluated planned ACs, not implementation technique — had no way to anticipate): the scraping cadence (6h → daily), the concrete scraping technique for Instagram (real `cheerio`+`fetch` vs. headless-browser vs. paid scraping-API vendor — `cheerio`+`fetch` chosen, explicitly flagged unverified against the live site), scoping Twitter/X as a stub rather than a second unverified implementation, and the new on-demand-scrape-on-subscribe capability (AC6, including its sync-vs-async question, resolved to async) and its `lastScrapedAt`-based batch-skip optimization (AC1). Full rationale for each is recorded in `epics.md`'s Story 3.4 Amendment (2026-08-08).
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona review (this story postdates the swept sweep). **Verdict: No gap.** This story has zero UI surface — a Lambda/queue/DB pipeline with no page, component, or hook. Confirmed via a `design-artifacts/` search that no UX spec (including `C-UX-Scenarios/`) describes the dispatcher Lambda, EventBridge schedule, SQS fan-out, or `ScraperAdapter`/`imginn.com` scraping behavior this story implements — the only tangential hits concern already-owned-elsewhere surfaces (source-attribution link display on an event detail page, Epic 5's manual post selection screens, `/settings/subscriptions`), none of which this story touches.

### Known Risk: Unverified Scraping Implementation

This story was authored without the ability to browse a real, rendered `imginn.com` page. During story creation:
- A direct fetch to `https://imginn.com/instagram/` returned `403 Forbidden`.
- The same probe against `picuki.com` and `picnob.com` (the redirect target of `pixnoy.com`) also returned `403 Forbidden`.
- `mollygram.com` was reachable but is a single-item story/post downloader, not a profile-browsing mirror — wrong shape for "list an account's newest posts."
- A captured real request to a third Instagram-viewer site's JSON API (`storiesig.info`) returned `422 CAPTCHA_REQUIRED` even when replayed with all original headers and its signed payload — confirming that site is deliberately anti-bot-gated and not a viable integration target (pursuing a bypass was explicitly rejected as out of scope, both technically fragile and not an appropriate thing to build against a site's explicit anti-abuse measure).
- `storynavigation.com` renders no post content at all (a follower-count analytics tool, not a post viewer).

**Decision (user-confirmed):** proceed with `imginn.com` per the PRD's own named example, implemented with realistic browser-like request headers and `cheerio` HTML parsing, but treat the actual CSS-selector assumptions in `parseImginnPostsHtml`/`parseImginnProfileHtml` as **unverified**. `Task 2`'s unit tests validate the parsing logic against synthetic fixture HTML (documented as such, not captured from the live site) — they prove the code's own logic is internally correct, but **cannot** prove it matches `imginn.com`'s actual current markup. Manual, human validation against the live site (and likely header/anti-bot iteration) is expected as a near-term follow-up and is called out explicitly in `## Definition of Done` and `## Out of Scope` below, rather than silently assumed to work.

A rejected alternative worth recording: if `imginn.com`'s block turns out to be IP-reputation/datacenter-range blocking (plausible, given the block is a flat `403` rather than an interactive JS challenge) rather than a "not a real browser" check, a headless-browser adapter (Playwright + `@sparticuz/chromium`) running from the same Lambda's AWS IP range would not necessarily fare any better, despite being a materially heavier dependency (Chromium Lambda layer or container-image deployment, 512MB+ memory, multi-second cold starts, its own ongoing version-maintenance burden). A managed scraping-API vendor (Bright Data's Web Scraper API — verified free tier: 5,000 records/month, no card required; Apify — verified free tier: $5/month prepaid credit, no card required) was also researched and would likely be the most durable "keeps working for months" option, since it offloads anti-bot/proxy-rotation maintenance to a vendor who does it full-time — but was deliberately not adopted in this story to avoid committing to a new paid vendor credential before the free DIY approach has even been tried against the live site.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one additive schema change, no mismatches.** `socialMediaAccountProfiles` gains a new nullable `lastScrapedAt: timestamp (last_scraped_at)` column (Task 1) — purely additive, `NULL`-safe for all existing rows, no backfill required (a `NULL` value is correctly treated as "never scraped" by AC1's batch-selection query).
- **Impacted fields/contracts:** New DB column (`last_scraped_at`); new TypeScript shape `ScrapeTarget = { profileId: string; platform: SupportedPlatform; accountId: string; username: string }` (this story's own internal SQS-message contract between the enqueue side — `getBatchScrapeTargets`/`subscribeToAccount` — and the consume side — `processScrapeJob`); no changes to `packages/shared-types`, GraphQL schema, or any existing exported type's shape.
- **Required DB migration changes:** One Drizzle-kit-generated `ALTER TABLE social_media_account_profiles ADD COLUMN last_scraped_at timestamptz` migration (Task 1) — no `WHERE`-clause partial index involved, so AD-8's documented drizzle-kit hand-edit workaround does not apply here.
- **Required TypeScript type changes:** `socialMediaAccountProfiles`'s inferred Drizzle row type gains `lastScrapedAt: Date | null` automatically once the schema is updated; no manual type edit needed elsewhere since nothing outside this story's own new files reads that column yet.
- **Backward compatibility and rollout notes:** Purely additive. The `SQSEvent`/`EventBridgeEvent` message shape sent by `enqueueScrapeJob` is new (this story is the first thing to ever put a real message on `ScrapingQueue`, since `scraper.ts` was a placeholder before this story) — no prior consumer/producer contract to preserve.
- **Verification checks:** Task 1's migration reviewed for additive-only DDL; Task 5's integration test asserting the skip-window filter behaves correctly at the DB level; Task 7's integration test asserting `lastScrapedAt` is stamped after both success and handled-failure paths.

### Project Structure Notes

- New: `apps/backend/src/lib/scraper/{instagram-adapter.ts, instagram-adapter.test.ts, twitter-adapter.ts, twitter-adapter.test.ts, register-adapters.ts, get-scrape-targets.ts, get-scrape-targets.test.ts, enqueue-scrape-job.ts, enqueue-scrape-job.test.ts, process-scrape-job.ts, process-scrape-job.test.ts}`; one new Drizzle migration (`packages/database/migrations/00NN_*.sql` + `meta/00NN_snapshot.json`).
- Modified: `packages/database/schema.ts` (new column); `apps/backend/src/lambdas/scraper.ts` (real handler, replaces placeholder); `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` + its `.test.ts` (on-demand trigger retrofit); `apps/backend/src/env.ts`; `apps/backend/package.json` (new `cheerio`, `@aws-sdk/client-sqs` deps); `apps/infrastructure/lib/festgrid-backend-stack.ts` + its `.test.ts`; `docs/infrastructure/high-level-overview.md` (diagram edge); `.env.example`.
- Not modified: any `.graphql` schema/resolver file; any `apps/web` file; `packages/domain` (this story only *consumes* Story 3.3c's `@festgrid/domain/scraper` exports — its ScraperAdapter/registry code must already exist for this story to even compile, see "Blocking Dependency" below — it does not add to `packages/domain` itself, since all of this story's own new logic is DB/AWS-SDK/Node-coupled and belongs in `apps/backend` per `project-context.md`'s Code Organization rule).
- Matches this project's established test-seam pattern for external calls (`gemini-client.ts`'s `callGeminiGenerateContent`/`setCallGeminiGenerateContent`) — every new function in this story that makes a real network/AWS-SDK call (`fetchImginnHtml`, `sendScrapeJobMessage`) exposes the same mutable-export + setter shape, so tests never need `msw`/live network access (this project's `apps/backend` tests use `node:test` with real integration DB access and these manual test seams, not `msw`, which is `apps/web`'s convention per `project-context.md`'s Testing Rules).

### Blocking Dependency (read before starting `dev-story`)

Story 3.3c (`packages/domain/src/scraper/*` — the `ScraperAdapter` interface, `ScrapedPost`/`ScraperAccountRef` types, and `registerScraperAdapter`/`getScraperAdapter` registry) is `ready-for-dev` but **not yet implemented** — `packages/domain/src/scraper/` does not exist in the codebase as of this story's creation. This story's Tasks 2-4 import directly from `@festgrid/domain/scraper`, so **this story cannot compile, let alone pass `pnpm build`, until Story 3.3c is implemented and merged.** This is a hard compile-time dependency, not a soft ordering preference — see `## Pre-Coding Approval Gate` below.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4] — this story's authoritative AC, historical Note/Forward note, and the 2026-08-08 Amendment recording every decision made during this story's creation (cadence, scraping-technique choice, on-demand trigger, `lastScrapedAt`).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep covering `3.4`; source of the corrected `high-level-overview.md` diagram and of Story 3.3c's creation.
- [Source: _bmad-output/implementation-artifacts/3-3c-define-the-scraper-adapter-interface-and-platform-slug-registry.md] — the `ScraperAdapter`/registry contract this story implements against (still `ready-for-dev`, not yet built — see "Blocking Dependency").
- [Source: _bmad-output/implementation-artifacts/0-14-set-up-aws-iac-for-lambda-sqs-eventbridge-and-kms.md] — provisioned the `ScrapingQueue`, the dual EventBridge+SQS trigger wiring on `L_Scrape`, and the `apps/backend/src/lambdas/scraper.ts` placeholder this story fills in; also the source of the `rate(6 hours)` placeholder this story replaces and the CDK env-var/IAM gaps this story fixes.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.ts, festgrid-backend-stack.test.ts] — current (pre-this-story) CDK stack; read in full during this story's creation to identify the missing `DATABASE_URL`/queue-URL env vars and the stale `AIProcessingQueue` grant.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts, persist-scraped-post.test.ts] — Story 3.3a's persistence function this story calls directly with zero shape translation (by Story 3.3c's own design), and the integration-test style this story's new DB-touching tests follow.
- [Source: apps/backend/src/lib/subscriptions/subscribe-to-account.ts, subscribe-to-account.test.ts] — Story 3.1a's already-shipped (`review` status) lookup-or-create logic this story retrofits with the on-demand trigger (Task 9); read in full since this is a file being modified, not just referenced.
- [Source: apps/backend/src/lib/ai-gateway/gemini-client.ts, adapter.ts, adapter.test.ts] — the mutable-export test-seam pattern (`callGeminiGenerateContent`/`setCallGeminiGenerateContent`) this story's `fetchImginnHtml`/`sendScrapeJobMessage` mirror, and the `node:test` DI-style testing convention (no `msw`) this project's backend uses for external calls.
- [Source: apps/backend/src/db/client.ts] — throws at module-import time if `DATABASE_URL` is unset, confirming why the Scraper Lambda's missing env var (Task 11) is a real, not theoretical, blocker.
- [Source: packages/database/schema.ts] — `socialMediaAccountProfiles`, `subscriptions`, `posts` table shapes this story reads/writes/extends.
- [Source: packages/graphql-select/active-only.ts] — Story 0.22's `activeOnly(table)` helper, used for the batch-selection query's active-subscription filter (AC1) rather than a hand-written `isNull(...)` clause.
- [Source: docs/infrastructure/high-level-overview.md, 2-backend.md] — the architecture diagram this story implements against and extends (Task 12), and the SQS/EventBridge/Lambda service rationale.
- [Source: _bmad-output/project-context.md#Code-Organization, #Testing-Rules] — DB/Node-coupled logic stays in `apps/backend`, not `packages/domain`; `apps/backend`'s testing-trophy/integration-test philosophy.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.7] — "a platform-specific scraper adapter... never a hardcoded, single-platform scraping implementation," and the `imginn.com` proxy/mirror example this story's Instagram adapter implements against.
- [Source: live-web research during this story's creation, 2026-08-08] — direct probes of `imginn.com` (403), `picuki.com` (403), `picnob.com`/`pixnoy.com` (403), `mollygram.com` (wrong shape), `storiesig.info` (CAPTCHA-gated API, confirmed via a real captured-request replay), `storynavigation.com` (no post content); Bright Data (5,000 records/month free, no card) and Apify ($5/month free credit, no card) pricing pages, confirmed directly rather than from training-data recall. Full rationale recorded in `epics.md`'s Amendment.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (all new logic is DB/Node/AWS-SDK-coupled, correctly placed in `apps/backend`, not `packages/domain`); Security (`Resilient Processing Pipeline` — SQS `ScrapingQueue` decoupling, implemented exactly as mandated); Testing Rules (`apps/backend` integration-test convention followed, no unit-test-coverage requirement applies here since nothing in this story touches `packages/domain`).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (Soft-Delete Convention): the batch-selection query (AC1) filters via `activeOnly(subscriptions)` (Story 0.22), not a hand-written `isNull(...)` clause. No other AD (AD-1/AD-2 Unified Query DSL) applies — this story has no GraphQL query surface.
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/high-level-overview.md`, `2-backend.md` — read in full; this story is the primary implementation of the Scraper Lambda / `ScrapingQueue` / EventBridge legs of the documented pipeline, and Task 12 keeps the diagram in sync with the new on-demand-trigger edge.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/lib/scraper/{instagram-adapter.ts, instagram-adapter.test.ts, twitter-adapter.ts, twitter-adapter.test.ts, register-adapters.ts, get-scrape-targets.ts, get-scrape-targets.test.ts, enqueue-scrape-job.ts, enqueue-scrape-job.test.ts, process-scrape-job.ts, process-scrape-job.test.ts}`; `packages/database/migrations/00NN_*.sql` + `meta/00NN_snapshot.json`.
- **Modified:** `packages/database/schema.ts`; `apps/backend/src/lambdas/scraper.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` + `.test.ts`; `apps/backend/src/env.ts`; `apps/backend/package.json`; `apps/infrastructure/lib/festgrid-backend-stack.ts` + `.test.ts`; `docs/infrastructure/high-level-overview.md`; `.env.example`; `_bmad-output/planning-artifacts/epics.md` (already updated during story creation).
- **Not modified:** any `.graphql` file; any `apps/web` file; `packages/domain` (consumed, not extended, by this story); `packages/shared-types`.

### Rule Mapping

- SQS-decoupled processing pipeline (`ScrapingQueue`) → `project-context.md` Security/Resilient Processing Pipeline rule → Tasks 6, 8 (enqueue + dual-mode handler).
- Adapter Pattern for external services → `project-context.md` General Architecture → Tasks 2-4 (concrete `ScraperAdapter` implementations registered against Story 3.3c's registry, mirroring the Gemini adapter precedent).
- `activeOnly(table)` for AD-8-bound active-row filtering → Architecture Spine AD-8 / Story 0.22 → Task 5.
- Reuse over reinvention (`persistScrapedPost`, `ScraperAdapter` registry, existing test-seam pattern) → this story's own Dev Notes + Story 3.3c's design → Tasks 2, 6, 7.
- "Leave the system working end-to-end, not just satisfy stated ACs" → this workflow's Step 3 mandate → Task 11 (fixing the pre-existing missing-env-var/stale-grant infra gaps found while reading the CDK stack).
- User-confirmed design decisions (cadence, scraping technique, async on-demand trigger, `lastScrapedAt` optimization) → `AskUserQuestion` record in `epics.md`'s Amendment → Tasks 1, 2, 9, 10, 11.

### Verification Plan

- `packages/database`: migration reviewed as additive-only; `pnpm --filter @festgrid/database build` confirms the schema change compiles.
- New `apps/backend/src/lib/scraper/*.test.ts` (`node:test`, per Task 2/3/5/6/7's per-file breakdown above): fixture-based adapter parsing tests, test-seam-based fetch/SQS-send tests, real-DB integration tests for target-selection and job-processing (including the AC7 error-isolation case).
- `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): confirms the on-demand trigger fires exactly once per new-profile creation and never on an existing-profile subscribe, via the enqueue test seam — no real AWS call in any test.
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): confirms the corrected `ScheduleExpression: 'rate(1 day)'` and (implicitly, via existing resource-count assertions) that the env-var/grant fixes didn't add/remove any CDK resources.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions — `pnpm build` in particular is the concrete proof that Story 3.3c's `@festgrid/domain/scraper` subpath exists and this story's imports resolve against it (see "Blocking Dependency").
- **Not covered by automated tests, by design (see Dev Notes "Known Risk"):** whether `parseImginnPostsHtml`/`parseImginnProfileHtml`'s selectors actually match `imginn.com`'s real, current markup. This requires a manual, human verification pass against the live site after merge — tracked in `## Definition of Done` and `## Out of Scope`, not silently assumed.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the real once-daily batch scraping pipeline (EventBridge → `ScrapingQueue` fan-out → per-account scrape → `persistScrapedPost`), a real-but-unverified `cheerio`-based Instagram/`imginn.com` adapter, a stub Twitter/X adapter, a new async on-demand scrape trigger fired from Story 3.1a's `subscribeToAccount` on first-time account subscriptions, a `lastScrapedAt` batch-skip optimization, and fixes two pre-existing CDK infra gaps (missing env vars, a stale IAM grant) found while implementing this story. It does **not** build a working, live-verified Instagram scraper, a Twitter/X scraper, or any change to `apps/web`/GraphQL.
- [ ] Architecture and boundary confirmation: all new logic is DB/AWS-SDK/Node-coupled and lives in `apps/backend`, never `packages/domain`; the `ScrapingQueue` fan-out and Scraper Lambda dual-trigger (EventBridge + SQS) match Story 0.14's already-provisioned IaC exactly, with only the schedule rate, env vars, and one IAM grant changed (Task 11); the batch-selection query uses `activeOnly(subscriptions)` (Story 0.22), never a hand-written `isNull(...)`.
- [ ] Testing plan confirmation: new `apps/backend/src/lib/scraper/*` covered by fixture-based unit tests (adapters) and real-DB integration tests (target selection, job processing, including the AC7 error-isolation case); `subscribe-to-account.test.ts` extended for the on-demand trigger; `festgrid-backend-stack.test.ts` updated for the new schedule rate; explicitly **no** test proves `imginn.com`'s real markup matches this story's parsing assumptions — that gap is accepted, not hidden (see Definition of Done).
- [ ] **Blocking dependency confirmed done or gap accepted:** Story 3.3c (`packages/domain/src/scraper/*`) must be implemented and merged before `dev-story` can even compile this story's Tasks 2-4 — `packages/domain/src/scraper/` does not exist yet as of this story's creation. Do not begin implementation until this is confirmed either already done, or the user explicitly accepts starting anyway (e.g. to implement Tasks 1, 5, 6, 9-12 first, which do not depend on Story 3.3c, while Story 3.3c lands in parallel).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` (created Story 3.3c as this story's prerequisite — see above); two additional pre-existing infra gaps found via this story's own "read files being modified" pass are fixed directly in Task 11, not deferred. Gate 2 run fresh, no gap (zero UI surface). All scraping-technique/cadence/on-demand-trigger decisions were resolved with the user via `AskUserQuestion` before drafting — see `epics.md`'s Amendment for full rationale.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (new): fixture-HTML parsing coverage (populated/empty/malformed) + test-seam-based `getNewestPosts`/`lookupAccountProfile` coverage. No live network call.
- [ ] `apps/backend/src/lib/scraper/twitter-adapter.test.ts` (new): both interface methods reject with the documented "not yet implemented" error.
- [ ] `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` (new, real DB): dedup-across-subscribers, soft-deleted-subscription exclusion, `lastScrapedAt` skip-window inclusion/exclusion cases (per Task 5's breakdown).
- [ ] `apps/backend/src/lib/scraper/enqueue-scrape-job.test.ts` (new): correct queue URL + message shape via test seam. No live AWS call.
- [ ] `apps/backend/src/lib/scraper/process-scrape-job.test.ts` (new, real DB, fake registered adapter): persistence + `lastScrapedAt` stamping on both success and handled-failure paths (AC7).
- [ ] `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): on-demand trigger fires once for new profiles, never for existing ones.
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): `ScheduleExpression: 'rate(1 day)'`; existing resource-count assertions continue to pass unchanged (env-var/grant edits don't add/remove CDK resources).
- [ ] E2E: not required — this story has no user-facing page/flow; per `project-context.md`'s testing-trophy philosophy, the integration tests above (real DB, real registry, test-seamed external calls) are the appropriate depth for a backend pipeline story.
- [ ] **Explicitly not automatable, tracked as a follow-up, not silently skipped:** manual verification of `parseImginnPostsHtml`/`parseImginnProfileHtml` against `imginn.com`'s actual live markup (see Dev Notes "Known Risk" and `## Out of Scope`).

## Deliverables Checklist

- [ ] `lastScrapedAt` column added to `social_media_account_profiles` via a committed Drizzle-kit migration.
- [ ] Real Instagram `ScraperAdapter` (`imginn.com`, `cheerio`) implemented, fixture-tested, and registered.
- [ ] Twitter/X stub `ScraperAdapter` implemented, tested, and registered.
- [ ] `getBatchScrapeTargets`, `enqueueScrapeJob`, `processScrapeJob` implemented and integration-tested.
- [ ] `apps/backend/src/lambdas/scraper.ts` real dual-mode (EventBridge seed-run / SQS per-account) handler, placeholder removed.
- [ ] `subscribeToAccount` retrofitted with the async on-demand trigger on new-profile creation; existing test suite extended, not broken.
- [ ] `apps/infrastructure` CDK stack: daily schedule, corrected env vars on both `scraperLambda` and `apiLambda`, stale IAM grant removed, corrected new IAM grant added; stack test updated to match.
- [ ] `docs/infrastructure/high-level-overview.md` diagram updated with the new on-demand-enqueue edge.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (contingent on Story 3.3c being merged first — see Blocking Dependency).

## Out of Scope

- A live-verified, working Instagram scraper — this story ships a structurally-complete, fixture-tested implementation with **explicitly unverified** selectors against the real `imginn.com` site (see Dev Notes "Known Risk"). Manual post-merge validation against the live site (and likely header/anti-bot iteration) is a near-term follow-up, not covered by this story's Definition of Done for "actually works against production Instagram content."
- Any real Twitter/X scraping implementation — registered as an explicit stub (AC5); a future story once a proxy/mirror/technique is chosen.
- Retrofitting Story 3.1/3.2's subscribe forms with pre-submit, synchronous live account-validation ("does this account exist" feedback before the subscribe button is even clicked) — still deferred per Story 3.1's existing accepted gap; this story's on-demand trigger (AC6) fires *after* a successful subscribe, not before/during form submission.
- A headless-browser (Playwright) or paid managed-scraping-API adapter for Instagram — both were researched and explicitly rejected for this pass in favor of the lighter `cheerio`+`fetch` approach (see Dev Notes); either remains a viable follow-up if the `imginn.com` adapter proves unworkable after live verification.
- Any GraphQL schema, resolver, or `apps/web` change.
- Epic 5's manual post-selection UI that will eventually display the posts this story persists — that UI does not exist yet (`5.1a`/`5.1` are `backlog`); this story only ensures the data (and, via AC6, a fast first-post-availability path) is ready for it once built.

## Definition of Done

- [ ] All 9 Acceptance Criteria satisfied.
- [ ] `apps/backend/src/lib/scraper/*` unit + integration tests passing (fixture-based adapter tests, real-DB target-selection/job-processing tests).
- [ ] `subscribe-to-account.test.ts` and `festgrid-backend-stack.test.ts` updated and passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions, **after Story 3.3c has been merged** (hard compile-time dependency — see Blocking Dependency).
- [ ] New Drizzle migration for `last_scraped_at` reviewed as additive-only, no data loss.
- [ ] `docs/infrastructure/high-level-overview.md` diagram reflects the new on-demand-enqueue edge.
- [ ] Explicitly tracked, not silently dropped: a manual validation pass of the Instagram adapter's parsing logic against the real, live `imginn.com` site is still outstanding after this story merges (see Out of Scope) — recommend logging this as an immediate follow-up task/story once a human can browse the live site.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
