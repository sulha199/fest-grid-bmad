# Story 3.4: Scrape new posts from subscribed accounts

## Story Details

- Epic: 3
- Story ID: 3.4
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to periodically scrape new posts from the social media accounts that users have subscribed to, plus scrape a brand-new account immediately when someone subscribes to it, while staying within a scraping-vendor's free-tier budget,
so that I can begin the event extraction process without making a first-time subscriber wait up to a full day for any posts to appear, and without silently incurring paid vendor overage.

## Acceptance Criteria

1. **Given** there are active (non-soft-deleted, AD-8) subscriptions to social media accounts, **when** the scraping process is triggered on a recurring **once-daily** EventBridge schedule (replacing Story 0.14's placeholder `rate(6 hours)`), **then** the system determines the batch of accounts to scrape as the **distinct** set of accounts with at least one active subscriber (never once per subscription row — an account with 5 subscribers is scraped once, not 5 times), **excluding** any account whose `SocialMediaAccountProfile.lastScrapedAt` is within a configurable window (default 20 hours, `SCRAPE_SKIP_RECENT_HOURS` env var) of now.
2. **And** each account in that batch is dispatched as a separate message onto the `ScrapingQueue` (SQS) rather than scraped synchronously in one Lambda invocation — matching the fan-out pattern already wired by Story 0.14 (EventBridge → `L_Scrape` "seed run" → enqueues per-account jobs onto `ScrapingQueue` → `ScrapingQueue` → `L_Scrape` "per-account processing").
3. **And** each per-account job retrieves that account's newest posts via a platform-specific `ScraperAdapter` (Story 3.3c's registry, `getScraperAdapter(platform).getNewestPosts(account, options)`) — never a hardcoded, single-platform implementation — passing `options.newerThan` as the `MAX(posts.publishedAt)` already stored for that account, or, for an account with no posts stored yet, `now - SCRAPE_INITIAL_LOOKBACK_DAYS` (default 7 days). Each returned post is persisted via Story 3.3a's `persistScrapedPost`, with `postUrl`/`originalPostUrl` set per the adapter's own resolution. After the attempt (success, a handled per-account failure, or a capacity-skip per AC5), `SocialMediaAccountProfile.lastScrapedAt` is stamped with the current time.
4. **And** the concrete Instagram adapter calls **Apify**'s `apify/instagram-scraper` actor via its synchronous `run-sync-get-dataset-items` REST endpoint (one blocking HTTP call returning real structured JSON — not HTML scraping, not a raw third-party mirror site), authenticated with a single **app-funded** `APIFY_API_TOKEN` (not a per-user BYOK credential), passing `resultsType: "posts"`, a `resultsLimit` safety cap (default 10, `SCRAPE_RESULTS_LIMIT` env var), and `onlyPostsNewerThan` (Apify's native date-cutoff filter, populated from AC3's `newerThan`) — so a call for an account with nothing new returns, and bills, zero items.
5. **And** every real Apify call increments a shared, provider-keyed usage counter (one row per vendor, not per-account/per-user, reset on a configurable monthly cycle — mirroring Story 0.13's `usageCount`/`usageCycleResetAt` pattern for API keys). Before making a real call — from **either** the batch path (AC1-3) or the on-demand path (AC6) — the calling adapter checks this counter against a configurable fraction (default 90%, `SCRAPER_CAPACITY_THRESHOLD_RATIO`) of Apify's known free-tier budget (`SCRAPER_MONTHLY_BUDGET_USD` / `SCRAPER_PRICE_PER_1000_ITEMS_USD`); if exhausted, the real call is skipped (returns an empty result, logged) rather than silently incurring paid overage.
6. **And**, distinct from the daily batch (AC1-3), when a user subscribes to an account and Story 3.1a's `subscribeToAccount` lookup-or-create logic is about to create a **brand-new** `SocialMediaAccountProfile` row (never when subscribing to an already-known, already-profiled account — that path triggers no new scrape cost and is never blocked by this check), it first checks AC5's same capacity counter: if capacity remains, the new profile is created and an on-demand scrape job for that one account is enqueued onto `ScrapingQueue` **asynchronously** (`subscribeToAccount` enqueues and returns immediately, never blocking on the scrape completing; a failure to *enqueue*, e.g. a transient SQS error, is logged and swallowed rather than failing the mutation); if capacity is exhausted, the subscription itself is rejected with a clear, typed error surfaced to the client as `extensions.code = 'SCRAPER_CAPACITY_EXCEEDED'` (reusing PRD §3.8's already-established "gracefully informed... cannot add more subscriptions at this time" UX pattern, previously specified only for Gemini/AI-processing capacity).
7. **And** a failure processing any single account's job (adapter throw, parse error, etc.) is caught and logged without failing the Lambda invocation for other accounts in the same SQS batch — one broken account/adapter must not block or trigger a redelivery of other accounts' jobs in the same batch.
8. **And** the second registered adapter, for Twitter/X, is an explicit **not-yet-implemented stub** — both `ScraperAdapter` interface methods throw a clear `Error('Twitter/X scraping is not yet implemented')` — registered now so the platform-slug/display-name registry (Story 3.3c) stays fully populated for Story 3.11's routing, without a second vendor/technique decision needed in this pass.
9. **And** no GraphQL schema change, resolver addition beyond the `subscribeToAccount` error-mapping in AC6, or `apps/web` change is introduced by this story — this is a backend Lambda/queue/DB pipeline story with no user-facing UI surface (confirmed via Gate 2, no gap).
10. **And** i18n, PostHog analytics events, loaders (blocking/non-blocking), and client state categorization (React Query / nuqs / zustand) do not apply to this story — it has no user-facing component. Explicitly stated rather than silently omitted, per this project's story-creation conventions.

## Tasks / Subtasks

- [ ] Task 1: Small, additive amendment to Story 3.3c's already-shipped `ScraperAdapter` interface (AC: #3, #5, #6)
  - [ ] `packages/domain/src/scraper/types.ts`: change `getNewestPosts(account: ScraperAccountRef): Promise<ScrapedPost[]>` to `getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]>` — additive, optional parameter; no existing caller breaks.
  - [ ] `packages/domain/src/scraper/types.ts`: add `export class ScraperCapacityExceededError extends Error {}` (a pure, dependency-free marker class, mirroring `InvalidUserLocationInputError`'s placement in `packages/domain/src/user-locations/validateLocationInput.ts` — thrown by DB-coupled `apps/backend` code, caught and mapped to a `GraphQLError` in `resolvers.ts`, never itself DB-coupled).
  - [ ] Update `packages/domain/src/scraper/adapter-registry.test.ts`/`types.ts`'s existing fake-adapter test fixtures only if the signature change requires it (additive change should not require existing test edits — confirm during implementation).
  - [ ] Re-run `pnpm --filter @festgrid/domain test` to confirm no regression from the additive signature change.

- [ ] Task 2: Add `lastScrapedAt` column to `SocialMediaAccountProfile` (AC: #1, #3)
  - [ ] `packages/database/schema.ts`: add `lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true })` (nullable) to `socialMediaAccountProfiles`, alongside the existing (currently unused by any story) `lastPostDate` column — do not conflate the two.
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the Drizzle-kit migration; commit both the migration file and its `meta/` snapshot.

- [ ] Task 3: Add a `scraper_provider_usage` table for capacity tracking (AC: #5)
  - [ ] `packages/database/schema.ts`: add `scraperProviderUsage = pgTable('scraper_provider_usage', { id: uuid().defaultRandom().primaryKey(), provider: text().notNull().unique(), itemsUsedThisCycle: integer().default(0).notNull(), usageCycleResetAt: timestamp({ withTimezone: true }).defaultNow().notNull(), ...timestamps })` — one row per vendor (today: `'apify'` only), not per-user/per-account, since this is an app-funded, not BYOK, budget.
  - [ ] Include this table in the same migration as Task 2, or a second Drizzle-kit-generated migration — either is acceptable, note the choice in the File List.

- [ ] Task 4: `apps/backend/src/lib/scraper/usage-store.ts` — shared capacity-tracking module (AC: #5)
  - [ ] Export `recordProviderUsage(provider: string, itemCount: number): Promise<void>` — upserts/increments `scraperProviderUsage.itemsUsedThisCycle` by `itemCount`, respecting cycle-reset via `isCycleElapsed`/`nextCycleReset` (`@festgrid/domain`, the exact functions already used by `apps/backend/src/lib/ai-gateway/usage-store.ts`'s `recordSuccessfulUsage` — reuse, do not reimplement). Creates the provider's row on first use if absent.
  - [ ] Export `isProviderCapacityAvailable(provider: string): Promise<boolean>` — reads the current (cycle-aware) `itemsUsedThisCycle`, converts to an estimated USD spend (`itemsUsedThisCycle * (env.scraperPricePerThousandItemsUsd / 1000)`), and returns `false` if that estimate is at or above `env.scraperMonthlyBudgetUsd * env.scraperCapacityThresholdRatio`. Returns `true` (capacity available) if no row exists yet for the provider.
  - [ ] Unit/integration tests (real DB, `node:test`, mirroring `apps/backend/src/lib/ai-gateway/usage-store.ts`'s own test conventions): cycle-reset behavior (usage resets to the new count, not additive, once the cycle has elapsed); threshold boundary (just under vs. at/over the configured ratio); missing-row-defaults-to-available.

- [ ] Task 5: `apps/backend/src/lib/scraper/instagram-adapter.ts` — real Apify-backed adapter (AC: #4, #5)
  - [ ] Export `callApifyActor(input: object): Promise<any[]>` — `POST https://api.apify.com/v2/actors/apify~instagram-scraper/run-sync-get-dataset-items?token=${env.apifyApiToken}&timeout=120&format=json`, body = `input`, as a mutable `export let` + `setCallApifyActor(fn)` test seam (mirroring `gemini-client.ts`'s `callGeminiGenerateContent`/`setCallGeminiGenerateContent` pattern — no live network call in any test).
  - [ ] Export `instagramScraperAdapter: ScraperAdapter` implementing:
    - `getNewestPosts(account, options)`: if `!(await isProviderCapacityAvailable('apify'))`, log a warning and return `[]` immediately (AC5's backstop — no real call made). Otherwise call `callApifyActor({ directUrls: [`https://www.instagram.com/${account.username}/`], resultsType: 'posts', resultsLimit: env.scrapeResultsLimit, onlyPostsNewerThan: options?.newerThan })`, map each returned item to `ScrapedPost` (best-effort field mapping — see Dev Notes "Apify Field Mapping"), call `recordProviderUsage('apify', items.length)`, return the mapped posts.
    - `lookupAccountProfile(handleOrUrl)`: same capacity check; if available, call `callApifyActor({ directUrls: [...], resultsType: 'details', resultsLimit: 1 })`, map the single returned item to `AccountProfileLookupResult` (or `null` if empty), record usage, return.
  - [ ] Unit tests (`instagram-adapter.test.ts`, `node:test`, test-seam-based, no live network call): correct request shape (URL construction from `username`, `resultsLimit`, `onlyPostsNewerThan` passthrough); field-mapping correctness against a small synthetic fixture response (documented as hand-constructed from Apify's publicly documented output fields, **not** captured from a live call — see Dev Notes "Apify Field Mapping" for the verification caveat); the capacity-exhausted path returns `[]`/`null` without calling `callApifyActor` at all (assert the seam is *not* invoked).

- [ ] Task 6: `apps/backend/src/lib/scraper/twitter-adapter.ts` — stub adapter (AC: #8)
  - [ ] Export `twitterScraperAdapter: ScraperAdapter` whose `getNewestPosts` and `lookupAccountProfile` both `throw new Error('Twitter/X scraping is not yet implemented')`.
  - [ ] Unit test asserting both methods reject with that exact error.

- [ ] Task 7: `apps/backend/src/lib/scraper/register-adapters.ts` (AC: #4, #8)
  - [ ] Import `registerScraperAdapter` from `@festgrid/domain/scraper` and call it once each for `'instagram'` → `instagramScraperAdapter` and `'twitter'` → `twitterScraperAdapter`, at module top-level.

- [ ] Task 8: `apps/backend/src/lib/scraper/get-scrape-targets.ts` (AC: #1, #3)
  - [ ] Export `getBatchScrapeTargets(): Promise<ScrapeTarget[]>` where `ScrapeTarget = { profileId: string; platform: SupportedPlatform; accountId: string; username: string }`.
  - [ ] Query: distinct `socialMediaAccountProfiles` rows joined to `subscriptions` on `subscriptions.accountId = socialMediaAccountProfiles.id`, filtered by `activeOnly(subscriptions)` (`@festgrid/graphql-select`) and `(lastScrapedAt IS NULL OR lastScrapedAt < NOW() - INTERVAL '<SCRAPE_SKIP_RECENT_HOURS> hours')`.
  - [ ] Defensively filter/skip (with a logged warning) any row whose `platform` value is not a member of `SUPPORTED_PLATFORMS` — the DB column is plain `text`, not DB-enum-constrained.
  - [ ] Integration test (real DB, `node:test`): dedup-across-subscribers, soft-deleted-subscription exclusion, `lastScrapedAt` skip-window inclusion/exclusion (both `NULL` and 25-hours-ago included, 1-hour-ago excluded).

- [ ] Task 9: `apps/backend/src/lib/scraper/enqueue-scrape-job.ts` (AC: #2, #6)
  - [ ] Add `@aws-sdk/client-sqs` as a dependency of `apps/backend/package.json`.
  - [ ] Export `enqueueScrapeJob(target: ScrapeTarget): Promise<void>` sending one `SendMessageCommand` to `env.scrapingQueueUrl` with `JSON.stringify(target)` as the body, via the same mutable-export test-seam pattern as Task 5.
  - [ ] Unit test asserting correct queue URL and message body shape via the test seam.

- [ ] Task 10: `apps/backend/src/lib/scraper/process-scrape-job.ts` (AC: #3, #7)
  - [ ] Export `processScrapeJob(job: ScrapeTarget): Promise<void>`: look up `MAX(posts.publishedAt)` already stored for `job.profileId`; compute `newerThan` (that max date, or `now - env.scrapeInitialLookbackDays` if no posts exist yet); resolve the adapter via `getScraperAdapter(job.platform)`; call `getNewestPosts({ accountId: job.accountId, username: job.username }, { newerThan })`; `persistScrapedPost({ accountId: job.profileId, ...post })` for each returned post; update `socialMediaAccountProfiles.lastScrapedAt = new Date()` for `job.profileId`.
  - [ ] Wrap the adapter call + persistence in an internal try/catch; on error, log with job context and **do not rethrow** (AC7's per-account isolation). Stamp `lastScrapedAt` in a `finally` regardless of outcome (including the AC5 capacity-skip case, which returns `[]` rather than throwing, and is handled by the normal zero-posts path).
  - [ ] Integration test (real DB, fake platform registered via `registerScraperAdapter` with an in-test stub adapter): asserts posts persisted, `lastScrapedAt` stamped, `newerThan` computed correctly from existing stored posts vs. the lookback default for a brand-new account, and that an adapter throw does not propagate out of `processScrapeJob`.

- [ ] Task 11: `apps/backend/src/lambdas/scraper.ts` — real handler (AC: #1, #2, #3, #7)
  - [ ] Import `./register-adapters` (or the equivalent path) at module top-level for its registration side effect.
  - [ ] Branch on event shape: `EventBridgeEvent` (no `Records`) → `getBatchScrapeTargets()` then `enqueueScrapeJob(target)` for each (`Promise.allSettled`). `SQSEvent` (has `Records`) → for each `record`, `JSON.parse(record.body)` and `await processScrapeJob(target)`.
  - [ ] Remove the `console.log('scraper lambda invoked (placeholder)', ...)` placeholder line.

- [ ] Task 12: Retrofit `subscribeToAccount` with the on-demand trigger + capacity gate (AC: #6)
  - [ ] `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`: inside the `if (!accountProfile) { ... }` branch, **before** the insert, call `isProviderCapacityAvailable('apify')`; if `false`, `throw new ScraperCapacityExceededError('Scraper capacity temporarily exceeded — new subscriptions are paused until next cycle.')` (imported from `@festgrid/domain/scraper`) without inserting anything. If capacity is available, proceed with the existing insert/re-select, then call `enqueueScrapeJob({ profileId: accountProfile.id, platform: accountProfile.platform as SupportedPlatform, accountId: accountProfile.accountId, username: accountProfile.username })` wrapped in its own try/catch (log-and-continue on enqueue failure, never throw from this call site — distinct from the capacity check above, which *does* throw).
  - [ ] `apps/backend/src/schema/resolvers.ts`: wrap the existing `subscribeToAccount` resolver's call to `subscribeToAccountFn` in a try/catch; `if (err instanceof ScraperCapacityExceededError) throw new GraphQLError(err.message, { extensions: { code: 'SCRAPER_CAPACITY_EXCEEDED' } }); throw err;` — mirroring the existing `InvalidUserLocationInputError`/`InvalidUserSettingsInputError` catch-and-map pattern already used elsewhere in this file.
  - [ ] Extend `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, currently passing, do not remove existing assertions): add cases for (a) enqueue fires exactly once for a new profile when capacity is available, (b) enqueue is never called for an existing-profile subscribe, (c) `ScraperCapacityExceededError` is thrown (and nothing is inserted) when capacity is exhausted.

- [ ] Task 13: `apps/backend/src/env.ts` (AC: #1, #3, #4, #5)
  - [ ] Add to `BackendEnv`/`loadBackendEnv()`: `scrapingQueueUrl?: string` (`SCRAPING_QUEUE_URL`), `apifyApiToken?: string` (`APIFY_API_TOKEN`), `scrapeResultsLimit: number` (`SCRAPE_RESULTS_LIMIT`, default `'10'`), `scrapeInitialLookbackDays: number` (`SCRAPE_INITIAL_LOOKBACK_DAYS`, default `'7'`), `scrapeSkipRecentHours: number` (`SCRAPE_SKIP_RECENT_HOURS`, default `'20'`), `scraperMonthlyBudgetUsd: number` (`SCRAPER_MONTHLY_BUDGET_USD`, default `'5.00'`), `scraperPricePerThousandItemsUsd: number` (`SCRAPER_PRICE_PER_1000_ITEMS_USD`, default `'2.70'`), `scraperCapacityThresholdRatio: number` (`SCRAPER_CAPACITY_THRESHOLD_RATIO`, default `'0.9'`), `scraperUsageCycleDays: number` (`SCRAPER_USAGE_CYCLE_DAYS`, default `'30'`) — matching the existing `parseInt(process.env.X || 'default', 10)` / `eslint-disable-next-line turbo/no-undeclared-env-vars` convention exactly.
  - [ ] Add all new vars to `.env.example` with brief comments (Apify token, cost/capacity tunables).

- [ ] Task 14: Fix and extend `apps/infrastructure/lib/festgrid-backend-stack.ts` (AC: #1, #2, #4, #6; also closes a pre-existing gap, see Dev Notes)
  - [ ] Change the schedule rule from `events.Schedule.rate(cdk.Duration.hours(6))` to `events.Schedule.rate(cdk.Duration.days(1))`.
  - [ ] Add `DATABASE_URL: process.env.DATABASE_URL || ''`, `SCRAPING_QUEUE_URL: scrapingQueue.queueUrl`, and `APIFY_API_TOKEN: process.env.APIFY_API_TOKEN || ''` to `scraperLambda`'s `environment` block (currently only has `STAGE` — the Lambda cannot run without `DATABASE_URL`, since `db/client.ts` throws at import time if it's missing, and cannot call Apify without the token).
  - [ ] Add `SCRAPING_QUEUE_URL: scrapingQueue.queueUrl` to `apiLambda`'s `environment` block (needed for Task 12's on-demand enqueue and capacity check, both of which run inside `L_API`; `apiLambda` does **not** need `APIFY_API_TOKEN` — it never calls Apify directly, only enqueues and reads the shared usage counter via the DB it's already connected to).
  - [ ] Add `scrapingQueue.grantSendMessages(apiLambda)` (new — `L_API` now sends to `ScrapingQueue` too).
  - [ ] Remove the stale `aiProcessingQueue.grantSendMessages(scraperLambda)` line — a least-privilege violation left over from before the Epic 3 readiness sweep corrected `docs/infrastructure/high-level-overview.md`'s diagram to remove the (never-actually-used) `L_Scrape → SQS_AI` edge. Keep `scrapingQueue.grantSendMessages(scraperLambda)` (still needed for the batch self-enqueue, AC2).
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: update the existing `ScheduleExpression: 'rate(6 hours)'` assertion to `'rate(1 day)'` (CDK's actual generated string for a 1-day rate — singular "day").

- [ ] Task 15: Update `docs/infrastructure/high-level-overview.md` diagram (AC: #6)
  - [ ] Add an edge `L_API -- enqueues (on-demand, new account) --> SQS_Scrape` to the mermaid diagram, reflecting Task 12/AC6's new producer onto `ScrapingQueue`.

- [ ] Task 16: `SETUP_WALKTHROUGH.md` — add a new "Scraper Adapter (Apify)" section (AC: #4)
  - [ ] Sign up at [Apify Console](https://console.apify.com/), generate a personal API token (Settings → Integrations), add it to the root `.env` as `APIFY_API_TOKEN`. Note the free-plan budget ($5.00/month prepaid credit, resets monthly, no card required) and that this is an app-funded credential, not a per-user key.
  - [ ] Note the cost/capacity tunables (`SCRAPE_RESULTS_LIMIT`, `SCRAPE_INITIAL_LOOKBACK_DAYS`, `SCRAPER_MONTHLY_BUDGET_USD`, `SCRAPER_PRICE_PER_1000_ITEMS_USD`, `SCRAPER_CAPACITY_THRESHOLD_RATIO`) and that they should be revisited if Apify's actual pricing changes.

- [ ] Task 17: `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07, lists `3.4` in `stories_covered`) — created Story 3.3c as this story's prerequisite (now `review`/implemented, see "Story 3.3c Status" below).
  - **Fresh Gate 1 finding, this story's own creation:** making Bright Data the scheduled-batch's *priority* vendor (as directed mid-session) would require a new async job-tracking table, a public webhook endpoint, and a stale-job fallback sweep — a genuinely new architectural layer, not an incremental adapter addition. Split into new **Story 3.4a** (backlog, epics.md section written, full story file deferred to its own `bmad-create-story` run) rather than absorbed here. This story ships **Apify only**, for both the batch and on-demand paths.
  - **Lightweight guard — two pre-existing infra gaps found while reading Story 0.14's CDK stack** (bugs in already-committed IaC, not new architecture decisions, fixed directly in Task 14): the Scraper Lambda's `environment` block was missing `DATABASE_URL`/a `ScrapingQueue` URL entirely, and it retained a stale `AIProcessingQueue.grantSendMessages` IAM grant.
  - **A large set of scraping-technique/vendor decisions were resolved directly with the user via `AskUserQuestion` and live research during this story's creation** — full rationale recorded in `epics.md`'s Story 3.4 Amendment: the scraping cadence (6h → daily), the vendor/technique for Instagram (DIY `cheerio`+`imginn.com` was drafted first, then explicitly superseded by Apify after `imginn.com`/`picuki.com`/`picnob.com` were all found to return `403`, a captured real request to `storiesig.info` was found to be `422 CAPTCHA_REQUIRED`-gated with an explicit anti-automation Terms of Use, and Bright Data's posts-discovery was confirmed async-only vs. Apify's confirmed-synchronous equivalent), a BYOK-pooled-scraper-key idea (researched and deliberately deferred — real ToS ambiguity found for both vendors, not an engineering decision), a multi-account-evasion idea (explicitly rejected), the `onlyPostsNewerThan` cost-control mechanism (chosen over a naive "probe post-by-post" approach after confirming Apify's actor supports no pagination/cursor), the 7-day first-scrape lookback default, and the two-layer capacity-gating design (AC5/AC6).
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona review. **Verdict: No gap.** Zero UI surface — a Lambda/queue/DB pipeline with no page, component, or hook. Confirmed via a `design-artifacts/` search that no UX spec describes the dispatcher Lambda, EventBridge schedule, SQS fan-out, or `ScraperAdapter`/Apify scraping behavior this story implements.

### Story 3.3c Status (read before starting `dev-story`)

Story 3.3c is `review` status and **already implemented** — `packages/domain/src/scraper/{types.ts, platform-registry.ts, adapter-registry.ts, index.ts}` exist in the codebase today. This story's Tasks 5-7 build against that already-shipped registry. The only outstanding dependency is Task 1 of **this** story: a small, additive, backward-compatible amendment to the already-shipped `ScraperAdapter.getNewestPosts` signature (adding an optional `options` parameter) and a new exported error class — both required before Tasks 5/10/12 can compile. This is this story's own task, not a reopening of Story 3.3c's `dev-story`/review cycle.

### Apify Field Mapping (residual, low-risk unknown)

The Apify `run-sync-get-dataset-items` request/response *mechanism* (endpoint, auth, synchronous behavior, billing-per-returned-item model, `onlyPostsNewerThan`/`resultsLimit` input parameters) was directly verified against Apify's own documentation and pricing pages during this story's creation — not inferred or guessed. The **exact JSON field names** in a scraped post's response object (caption/content field name, image/media URL field name(s), the post URL field name, the published-timestamp field name) were not independently confirmed against a live API response (this workflow has no Apify credential to make a real test call). Task 5's field-mapping code and its fixture-based tests should be treated as best-effort and explicitly re-verified against one real response during implementation — this is a much smaller, lower-risk unknown than a typical "unverified scraping selectors" caveat, since the *call itself* is a documented, reliable, versioned REST API rather than fragile HTML scraping; only the response's exact key names carry residual uncertainty.

### Story 3.4a (Bright Data) — what this story deliberately does not do

This story's on-demand path (AC6) has **no fallback vendor** if Apify is unavailable at subscribe-time — it either succeeds (enqueues) or is capacity-blocked. The intended future behavior (fall back to Bright Data's async job rather than block, per the mid-session design discussion) is Story 3.4a's scope, not this story's — implementing it here would require the webhook/job-tracking infrastructure Gate 1 split out. Do not add a Bright Data code path to this story.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: two additive schema changes, no mismatches.** `socialMediaAccountProfiles` gains a nullable `lastScrapedAt` column (Task 2); a new `scraper_provider_usage` table is added (Task 3). Both purely additive, `NULL`/empty-safe for all existing data, no backfill required.
- **Impacted fields/contracts:** New DB column + new DB table (above); new TypeScript shapes `ScrapeTarget` (this story's internal SQS-message contract) and the Task 1 interface/error-class amendments to `@festgrid/domain/scraper`; no changes to `packages/shared-types`, GraphQL schema, or any other existing export's shape.
- **Required DB migration changes:** One or two Drizzle-kit-generated additive migrations (Tasks 2-3) — no `WHERE`-clause partial index involved, so AD-8's drizzle-kit hand-edit workaround does not apply.
- **Required TypeScript type changes:** Drizzle's inferred row types for `socialMediaAccountProfiles`/`scraperProviderUsage` update automatically once the schema changes; `ScraperAdapter`'s inferred type updates automatically once Task 1 lands.
- **Backward compatibility and rollout notes:** Purely additive throughout. The `SQSEvent`/`EventBridgeEvent` message shape sent by `enqueueScrapeJob` is new (this story is the first thing to ever put a real message on `ScrapingQueue`).
- **Verification checks:** Task 1's re-run of `packages/domain`'s existing scraper tests (confirm the additive signature change breaks nothing); Task 4's cycle-reset/threshold-boundary tests; Task 8's skip-window tests; Task 10's `newerThan`-computation and error-isolation tests.

### Project Structure Notes

- New: `apps/backend/src/lib/scraper/{instagram-adapter.ts, instagram-adapter.test.ts, twitter-adapter.ts, twitter-adapter.test.ts, register-adapters.ts, get-scrape-targets.ts, get-scrape-targets.test.ts, enqueue-scrape-job.ts, enqueue-scrape-job.test.ts, process-scrape-job.ts, process-scrape-job.test.ts, usage-store.ts, usage-store.test.ts}`; one or two new Drizzle migrations.
- Modified: `packages/domain/src/scraper/types.ts` (Task 1 amendment — additive only); `packages/database/schema.ts`; `apps/backend/src/lambdas/scraper.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` + `.test.ts`; `apps/backend/src/schema/resolvers.ts` (one new catch clause); `apps/backend/src/env.ts`; `apps/backend/package.json` (new `@aws-sdk/client-sqs` dep — no `cheerio`, the earlier DIY plan is fully superseded); `apps/infrastructure/lib/festgrid-backend-stack.ts` + `.test.ts`; `docs/infrastructure/high-level-overview.md`; `.env.example`; `SETUP_WALKTHROUGH.md`; `_bmad-output/planning-artifacts/epics.md` (already updated during story creation, including the new Story 3.4a section).
- Not modified: any `.graphql` schema file; any other `apps/web` file; `packages/domain/src/scraper/{platform-registry.ts, adapter-registry.ts, index.ts}` (unchanged — only `types.ts` is touched).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4] — this story's authoritative AC and the 2026-08-08 Amendment recording every decision made during this story's creation (supersedes an earlier same-day draft that had chosen DIY `cheerio` scraping).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4a] — the Bright Data follow-on story split off this one via Gate 1; backlog, epics.md section only, full story file not yet created.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep covering `3.4`; source of the corrected `high-level-overview.md` diagram and of Story 3.3c's creation.
- [Source: _bmad-output/implementation-artifacts/3-3c-define-the-scraper-adapter-interface-and-platform-slug-registry.md] — the `ScraperAdapter`/registry contract this story implements against; already `review`/implemented, plus its own 2026-08-08 amendment note matching Task 1 here.
- [Source: packages/domain/src/scraper/types.ts, platform-registry.ts, adapter-registry.ts] — the actual shipped code Task 1 amends and Tasks 5-7 build against; read directly during this story's creation (not assumed from the story-file description) after discovering Story 3.3c had shipped mid-session.
- [Source: _bmad-output/implementation-artifacts/0-14-set-up-aws-iac-for-lambda-sqs-eventbridge-and-kms.md] — provisioned the `ScrapingQueue`, the dual EventBridge+SQS trigger wiring on `L_Scrape`, and the `apps/backend/src/lambdas/scraper.ts` placeholder this story fills in; source of the `rate(6 hours)` placeholder this story replaces and the CDK env-var/IAM gaps this story fixes.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.ts, festgrid-backend-stack.test.ts] — read in full during this story's creation to identify the missing env vars and the stale `AIProcessingQueue` grant.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts, persist-scraped-post.test.ts] — Story 3.3a's persistence function this story calls directly, and the integration-test style this story's new DB-touching tests follow.
- [Source: apps/backend/src/lib/subscriptions/subscribe-to-account.ts, subscribe-to-account.test.ts] — Story 3.1a's already-shipped lookup-or-create logic this story retrofits (Task 12).
- [Source: apps/backend/src/lib/ai-gateway/gemini-client.ts, adapter.ts, usage-store.ts, usage-cycle.ts (packages/domain)] — the mutable-export test-seam pattern this story's `callApifyActor`/`sendScrapeJobMessage` mirror, and the exact `isCycleElapsed`/`nextCycleReset`/`usageCount`/`usageCycleResetAt` pattern Task 4's `scraper_provider_usage` tracking reuses rather than reinvents.
- [Source: apps/backend/src/schema/resolvers.ts] — the established `try { ... } catch (err) { if (err instanceof XError) throw new GraphQLError(...); throw err; }` pattern (`InvalidUserLocationInputError`, `InvalidUserSettingsInputError`) Task 12's `ScraperCapacityExceededError` handling mirrors; also the exact `subscribeToAccount` resolver (line ~146) this task edits.
- [Source: packages/domain/src/user-locations/validateLocationInput.ts] — precedent for a pure, dependency-free custom Error class living in `packages/domain` while being thrown from DB-coupled `apps/backend` code; `ScraperCapacityExceededError` (Task 1) follows the identical placement.
- [Source: packages/database/schema.ts] — `socialMediaAccountProfiles`, `subscriptions`, `posts`, `apiKeys` (usage-cycle column precedent) table shapes this story reads/writes/extends.
- [Source: packages/graphql-select/active-only.ts] — Story 0.22's `activeOnly(table)` helper, used for the batch-selection query's active-subscription filter (AC1).
- [Source: docs/infrastructure/high-level-overview.md, 2-backend.md] — the architecture diagram this story implements against and extends (Task 15).
- [Source: _bmad-output/project-context.md#Code-Organization, #Testing-Rules] — DB/Node/AWS-SDK-coupled logic stays in `apps/backend`; `apps/backend`'s testing-trophy/integration-test philosophy.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.7, #3.8] — "a platform-specific scraper adapter... never a hardcoded, single-platform scraping implementation" (§3.7); the "gracefully informed... cannot add more subscriptions" capacity-limiting UX pattern (§3.8, previously specified only for Gemini capacity, reused here for scraper capacity, AC6).
- [Source: live-web/API research during this story's creation, 2026-08-08] — direct, verified findings (not training-data recall): `imginn.com`/`picuki.com`/`picnob.com` return `403`; `storiesig.info`'s API returns `422 CAPTCHA_REQUIRED` on a replayed real captured request, and its Terms of Use explicitly prohibit automated/commercial access; Apify's `run-sync-get-dataset-items` endpoint, auth, billing model, `resultsLimit`/`onlyPostsNewerThan`/no-pagination behavior, and free-tier pricing ($2.70/1,000 free-plan rate, $5/month credit) all confirmed directly against Apify's own docs/pricing pages; Bright Data's posts-discovery confirmed async-only, its "record" billing unit confirmed to mean per-returned-item, and its PAYG overage rate ($1.50/1,000) confirmed directly; Crawlora confirmed unable to scrape Instagram posts (per the user's own direct account testing).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (all new logic is DB/Node/AWS-SDK-coupled, correctly placed in `apps/backend`, except the small pure `ScraperAdapter`/`ScraperCapacityExceededError` amendment in `packages/domain`); Security (`Resilient Processing Pipeline` — SQS `ScrapingQueue` decoupling, implemented exactly as mandated); Testing Rules (`apps/backend` integration-test convention followed).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (Soft-Delete Convention): the batch-selection query (AC1) filters via `activeOnly(subscriptions)` (Story 0.22), not a hand-written `isNull(...)` clause. No other AD applies — this story has no GraphQL query surface beyond one error-mapping catch clause.
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/high-level-overview.md`, `2-backend.md` — read in full; this story is the primary implementation of the Scraper Lambda / `ScrapingQueue` / EventBridge legs of the documented pipeline, and Task 15 keeps the diagram in sync.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/lib/scraper/{instagram-adapter.ts, instagram-adapter.test.ts, twitter-adapter.ts, twitter-adapter.test.ts, register-adapters.ts, get-scrape-targets.ts, get-scrape-targets.test.ts, enqueue-scrape-job.ts, enqueue-scrape-job.test.ts, process-scrape-job.ts, process-scrape-job.test.ts, usage-store.ts, usage-store.test.ts}`; new Drizzle migration(s).
- **Modified:** `packages/domain/src/scraper/types.ts`; `packages/database/schema.ts`; `apps/backend/src/lambdas/scraper.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` + `.test.ts`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/env.ts`; `apps/backend/package.json`; `apps/infrastructure/lib/festgrid-backend-stack.ts` + `.test.ts`; `docs/infrastructure/high-level-overview.md`; `.env.example`; `SETUP_WALKTHROUGH.md`; `_bmad-output/planning-artifacts/epics.md` (already updated); `_bmad-output/implementation-artifacts/3-3c-...md` (already updated, amendment note only).
- **Not modified:** any `.graphql` file; any `apps/web` file; `packages/domain/src/scraper/{platform-registry.ts, adapter-registry.ts, index.ts}`; `packages/shared-types`.

### Rule Mapping

- SQS-decoupled processing pipeline (`ScrapingQueue`) → `project-context.md` Security/Resilient Processing Pipeline rule → Tasks 9, 11 (enqueue + dual-mode handler).
- Adapter Pattern for external services → `project-context.md` General Architecture → Tasks 5-7 (concrete `ScraperAdapter` implementations registered against Story 3.3c's registry).
- `activeOnly(table)` for AD-8-bound active-row filtering → Architecture Spine AD-8 / Story 0.22 → Task 8.
- Reuse over reinvention (`persistScrapedPost`, `ScraperAdapter` registry, existing test-seam pattern, `isCycleElapsed`/`nextCycleReset`, the `InvalidUserLocationInputError` catch-and-map pattern) → this story's own Dev Notes + Story 0.13/3.3a's precedents → Tasks 4, 5, 9, 10, 12.
- "Leave the system working end-to-end, not just satisfy stated ACs" → this workflow's Step 3 mandate → Task 14 (fixing the pre-existing missing-env-var/stale-grant infra gaps).
- User-confirmed design decisions (vendor choice, cadence, capacity gating, Bright Data split) → `AskUserQuestion`/research record in `epics.md`'s Amendment → Tasks 3-5, 12, and Story 3.4a's split.

### Verification Plan

- `packages/domain`: `pnpm --filter @festgrid/domain test` confirms Task 1's additive interface/error-class change compiles and breaks nothing existing.
- `packages/database`: migrations reviewed as additive-only; `pnpm --filter @festgrid/database build` confirms the schema changes compile.
- New `apps/backend/src/lib/scraper/*.test.ts`: fixture-based adapter tests (no live network), test-seam-based enqueue/SQS tests, real-DB integration tests for usage tracking, target selection, and job processing (including the AC7 error-isolation and AC5 capacity-skip cases).
- `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): on-demand trigger + capacity-block cases, via test seams — no real AWS/Apify call in any test.
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): confirms the corrected `ScheduleExpression: 'rate(1 day)'`.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- **Not covered by automated tests, by design (see Dev Notes "Apify Field Mapping"):** whether Apify's real response field names exactly match this story's mapping code. Flagged as a small, low-risk residual unknown to confirm during implementation against one real call, not blocking.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the real once-daily batch scraping pipeline plus an async on-demand path, both backed by a single app-funded Apify adapter with `onlyPostsNewerThan`-based cost control and two-layer capacity gating (a real-call backstop and a subscribe-time block), a stub Twitter/X adapter, and fixes two pre-existing CDK infra gaps. It does **not** build a Bright Data adapter, webhook infrastructure, or any BYOK-pooled scraper-key mechanism (all explicitly deferred — see Story 3.4a and the Amendment's BYOK note).
- [ ] Architecture and boundary confirmation: all new logic is DB/AWS-SDK/Node-coupled and lives in `apps/backend`, except Task 1's small pure addition to `packages/domain/src/scraper/types.ts`; the `ScrapingQueue` fan-out and Scraper Lambda dual-trigger match Story 0.14's already-provisioned IaC exactly, with only the schedule rate, env vars, and one IAM grant changed; the batch-selection query uses `activeOnly(subscriptions)` (Story 0.22).
- [ ] Testing plan confirmation: new `apps/backend/src/lib/scraper/*` covered by fixture-based and real-DB integration tests per the task breakdown above; `subscribe-to-account.test.ts` extended for the on-demand trigger and capacity block; `festgrid-backend-stack.test.ts` updated for the new schedule rate; explicitly **no** test proves Apify's real response field names match this story's mapping — a small, accepted, low-risk gap (see Definition of Done).
- [ ] **Story 3.3c dependency confirmed satisfied:** already `review`/implemented in the codebase as of this story's creation (`packages/domain/src/scraper/` exists) — no blocking wait needed, only Task 1's small additive amendment.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md`; a fresh Gate 1 finding during this story's own creation (Bright Data as priority batch vendor requires new webhook/job-tracking infrastructure) was split into Story 3.4a rather than absorbed here. Gate 2 run fresh, no gap. All vendor/technique/capacity-design decisions were resolved with the user via `AskUserQuestion` and live research before drafting — see `epics.md`'s Amendment for full rationale, including the BYOK-legality and multi-account-evasion questions that were explicitly researched and resolved (deferred / rejected, respectively) rather than silently built around.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/scraper/usage-store.test.ts` (new, real DB): cycle-reset behavior, threshold boundary, missing-row-defaults-to-available (Task 4).
- [ ] `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (new): request-shape and field-mapping coverage via test seam (no live network); capacity-exhausted path makes zero real calls.
- [ ] `apps/backend/src/lib/scraper/twitter-adapter.test.ts` (new): both interface methods reject with the documented "not yet implemented" error.
- [ ] `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` (new, real DB): dedup, soft-delete exclusion, `lastScrapedAt` skip-window cases.
- [ ] `apps/backend/src/lib/scraper/enqueue-scrape-job.test.ts` (new): correct queue URL + message shape via test seam.
- [ ] `apps/backend/src/lib/scraper/process-scrape-job.test.ts` (new, real DB, fake registered adapter): persistence, `lastScrapedAt` stamping, `newerThan` computation, error isolation (AC7).
- [ ] `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): on-demand trigger fires once for new profiles; capacity-exhausted case throws `ScraperCapacityExceededError` and inserts nothing.
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): `ScheduleExpression: 'rate(1 day)'`.
- [ ] E2E: not required — no user-facing page/flow; per `project-context.md`'s testing-trophy philosophy, the integration tests above are the appropriate depth.
- [ ] **Explicitly not automatable, tracked as a follow-up, not silently skipped:** confirming Apify's real response field names against a live call once a real `APIFY_API_TOKEN` is available (see Dev Notes "Apify Field Mapping").

## Deliverables Checklist

- [ ] `packages/domain/src/scraper/types.ts` amended (optional `options` param, `ScraperCapacityExceededError`), existing tests still passing.
- [ ] `lastScrapedAt` column and `scraper_provider_usage` table added via committed Drizzle-kit migration(s).
- [ ] Real Apify-backed Instagram `ScraperAdapter` implemented, fixture-tested, capacity-gated, and registered.
- [ ] Twitter/X stub `ScraperAdapter` implemented, tested, and registered.
- [ ] `getBatchScrapeTargets`, `enqueueScrapeJob`, `processScrapeJob`, `usage-store` implemented and integration-tested.
- [ ] `apps/backend/src/lambdas/scraper.ts` real dual-mode handler, placeholder removed.
- [ ] `subscribeToAccount` retrofitted with the async on-demand trigger and the capacity gate; `resolvers.ts` maps `ScraperCapacityExceededError` to a `GraphQLError`; existing test suite extended, not broken.
- [ ] `apps/infrastructure` CDK stack: daily schedule, corrected env vars on both Lambdas, stale IAM grant removed, new grant added; stack test updated.
- [ ] `docs/infrastructure/high-level-overview.md` diagram updated.
- [ ] `SETUP_WALKTHROUGH.md` and `.env.example` document the new Apify token and cost/capacity env vars.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

## Out of Scope

- Any Bright Data adapter, webhook infrastructure, job-tracking table, or stale-job fallback sweep — Story 3.4a.
- Any real Twitter/X scraping implementation — registered as an explicit stub (AC8); a future story once a vendor/technique is chosen.
- A BYOK-pooled scraper-vendor-key mechanism (users contributing their own Apify/Bright Data key, mirroring Gemini's BYOK pool) — researched, explicitly deferred pending the user's own direct legal confirmation with each vendor, not built.
- Retrofitting Story 3.1/3.2's subscribe forms with pre-submit, synchronous live account-validation ("does this account exist" feedback before the subscribe button is even clicked) — still deferred per Story 3.1's existing accepted gap; this story's on-demand trigger (AC6) fires *after* a successful subscribe.
- On-demand-path fallback to a second vendor if Apify is unavailable — currently only capacity-blocks (AC6); Story 3.4a adds the Bright Data fallback.
- Any GraphQL schema or resolver addition beyond the one `ScraperCapacityExceededError` → `GraphQLError` mapping in the existing `subscribeToAccount` resolver; no `apps/web` change.
- Epic 5's manual post-selection UI that will eventually display the posts this story persists — that UI does not exist yet (`5.1a`/`5.1` are `backlog`).

## Definition of Done

- [ ] All 10 Acceptance Criteria satisfied.
- [ ] `apps/backend/src/lib/scraper/*` unit + integration tests passing.
- [ ] `subscribe-to-account.test.ts`, `resolvers.ts`'s new catch clause, and `festgrid-backend-stack.test.ts` updated and passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] New Drizzle migration(s) reviewed as additive-only, no data loss.
- [ ] `docs/infrastructure/high-level-overview.md`, `SETUP_WALKTHROUGH.md`, and `.env.example` all reflect the new Apify integration.
- [ ] Explicitly tracked, not silently dropped: confirming Apify's real response field names against a live call is still outstanding after this story merges (see Out of Scope / Dev Notes "Apify Field Mapping") — recommend doing this as soon as a real `APIFY_API_TOKEN` is provisioned.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
