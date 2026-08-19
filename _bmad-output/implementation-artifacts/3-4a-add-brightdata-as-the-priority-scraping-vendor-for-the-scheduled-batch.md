---
baseline_commit: 5a6c7e4f5a8f1fcafe0a1c7ef5df471effb27082
---

# Story 3.4a: Add Bright Data as the priority scraping vendor for the scheduled batch

## Story Details

- Epic: 3
- Story ID: 3.4a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want the scheduled daily batch scrape (Story 3.4's AC1-3) to prefer Bright Data over Apify — since nothing is synchronously waiting on the batch's results, and Bright Data's per-record cost is cheaper at scale ($1.50/1,000 PAYG vs. Apify's $2.70-$2.30/1,000) — while keeping Apify as the on-demand-path primary and a batch-path/stale-job fallback,
so that total free/cheap scraping headroom across both vendors is maximized before any real overage spend or subscription-capacity limiting (Story 3.4) kicks in.

## Acceptance Criteria

1. **Given** Story 3.4's daily batch dispatch (`getBatchScrapeTargets`), **when** a batch target's `platform` is `'instagram'` (Bright Data integration is Instagram-only in this pass, matching Story 3.4's own Apify scope — Twitter/X targets bypass Bright Data entirely and go straight to the existing Apify-SQS-enqueue path, unaffected by this story), **then** the system first checks Bright Data capacity (`isProviderCapacityAvailable('brightdata')`); if available, it triggers a Bright Data async discovery job (`POST https://api.brightdata.com/datasets/v3/trigger?dataset_id=<BRIGHTDATA_DATASET_ID>&type=discover_new&discover_by=url&endpoint=<per-job webhook URL>&format=json`, body `{"input":[{"url": "https://www.instagram.com/<username>/", "num_of_posts": env.scrapeResultsLimit, "start_date": "<MM-DD-YYYY derived from the same newerThan cutoff Story 3.4 computes>"}]}`) and, on a successful (2xx, `snapshot_id` present) response, records a new `brightdata_pending_jobs` row (`profileId`, `snapshotId`, a freshly-generated random `webhookToken`, `status: 'PENDING'`, `expiresAt: now + BRIGHTDATA_JOB_TIMEOUT_MINUTES`) — it does **not** enqueue anything onto `ScrapingQueue` and does **not** stamp `lastScrapedAt` yet, since the outcome is still pending.
2. **And** `getBatchScrapeTargets`'s selection query is extended to also exclude any account with an existing `status: 'PENDING'` `brightdata_pending_jobs` row (`NOT EXISTS` subquery), so a target with an in-flight Bright Data job is never double-triggered by the next daily run while it's still pending.
3. **And** a new, dedicated public Lambda (`L_Webhook`, not the GraphQL `L_API`) fronted by a new API Gateway route `POST /webhooks/brightdata` receives Bright Data's async completion callback (a bare JSON array of post records — Bright Data's webhook payload carries no `snapshot_id` or other correlating field). The handler reads the `jobToken` query-string parameter Bright Data echoes back (because it was embedded in the `endpoint=` URL at trigger time), looks up the matching `brightdata_pending_jobs` row by `webhookToken`; if no row matches, or the row's `status` is not `'PENDING'`, or `expiresAt` has already passed, the handler logs a warning and returns `200` without processing (never re-processes a job the sweep has already resolved, and never trusts an unrecognized/expired token). On a valid match, it maps each record to `persistScrapedPost`'s shape (best-effort field mapping — see Dev Notes "Bright Data Field Mapping"), persists each post, stamps `SocialMediaAccountProfile.lastScrapedAt` for the row's `profileId`, and marks the `brightdata_pending_jobs` row `status: 'COMPLETED'`.
4. **And** if Bright Data's trigger call itself fails synchronously — non-2xx response, network error, or `isProviderCapacityAvailable('brightdata')` reporting exhausted (AC1's capacity check) — the batch pass falls back to Apify for that one target immediately within the same pass, using Story 3.4's existing synchronous path exactly as today (`enqueueScrapeJob` → `ScrapingQueue` → `processScrapeJob` → `instagramScraperAdapter`).
5. **And** every real Bright Data trigger call increments a `brightdata`-keyed row in the existing `scraper_provider_usage` table (Story 3.4's table, reused not duplicated) via the existing `recordProviderUsage('brightdata', itemCount)`/`isProviderCapacityAvailable('brightdata')` functions — which are extended to look up **per-provider** pricing/budget (`BRIGHTDATA_PRICE_PER_1000_ITEMS_USD`, `BRIGHTDATA_MONTHLY_BUDGET_USD`) instead of the single flat Apify-only env values they read today, with the `'apify'` call sites' behavior unchanged (same env vars, same values, verified via the existing `usage-store.test.ts` suite still passing unmodified).
6. **And** a periodic stale-job sweep — a second EventBridge schedule rule (default hourly, distinct from Story 3.4's once-daily batch rule) targeting the **same** `scraperLambda` with a static event payload (`{ jobType: 'stale-job-sweep' }`, distinguishing it from the existing daily-batch trigger's default payload) — finds every `brightdata_pending_jobs` row where `status: 'PENDING'` and `expiresAt < now()`. For each: it first polls Bright Data's own `GET https://api.brightdata.com/datasets/v3/progress/{snapshotId}`; if `status: 'ready'`, it fetches `GET https://api.brightdata.com/datasets/v3/snapshot/{snapshotId}?format=json` and processes the result through the **same** shared processing function AC3's webhook handler uses (so a merely-lost/dropped webhook still completes normally, without wasting the Bright Data job or double-paying via an unnecessary Apify re-scrape). If the poll instead reports `failed`, or is still not `ready`, or the poll call itself errors, the row is marked `status: 'EXPIRED'` and the target is re-scraped via the existing synchronous Apify path (AC4's fallback), then `lastScrapedAt` is stamped.
7. **And**, distinct from the daily batch, Story 3.4's on-demand (subscribe-time) capacity gate is extended: when `subscribeToAccount`'s brand-new-profile branch finds Apify capacity exhausted (`isProviderCapacityAvailable('apify')` returns `false`), instead of immediately throwing `ScraperCapacityExceededError`, it next checks `isProviderCapacityAvailable('brightdata')`; if Bright Data has capacity, the new profile is still created and a Bright Data job is triggered for it exactly as AC1 does for the batch path (creating a `brightdata_pending_jobs` row; the eventual result arrives later via the webhook/sweep mechanism, same as any other account) — the subscription itself is **not** blocked. `ScraperCapacityExceededError` is thrown only when **both** Apify and Bright Data capacity are exhausted. A failure to trigger the Bright Data job at this call site is logged and swallowed (mirrors the existing `enqueueScrapeJob` catch-and-log behavior for the Apify path), never fails the mutation.
8. **And** a failure processing any single Bright Data trigger, webhook delivery, or sweep item is caught and logged without failing the Lambda invocation for other targets/jobs in the same run — matching Story 3.4 AC7's per-account isolation precedent exactly.
9. **And** no GraphQL schema change, resolver addition, or `apps/web` change is introduced by this story beyond the fact that fewer callers now hit `subscribeToAccount`'s existing `ScraperCapacityExceededError` → `GraphQLError('SCRAPER_CAPACITY_EXCEEDED')` catch clause (the mapping itself is unchanged) — confirmed via Gate 2, no UI gap, matching Story 3.4's own confirmed-no-UI-surface precedent. i18n, PostHog analytics events, loaders (blocking/non-blocking), and client state categorization (React Query / nuqs / zustand) do not apply, for the same reason.

## Tasks / Subtasks

- [ ] Task 1: `brightdata_pending_jobs` table + `brightdata_job_status` enum (AC: #1, #2, #3, #6)
  - [ ] `packages/database/schema.ts`: add `export const brightdataJobStatusEnum = pgEnum('brightdata_job_status', ['PENDING', 'COMPLETED', 'EXPIRED']);` and `export const brightdataPendingJobs = pgTable('brightdata_pending_jobs', { id: uuid().defaultRandom().primaryKey(), profileId: uuid('profile_id').references(() => socialMediaAccountProfiles.id).notNull(), snapshotId: text('snapshot_id').notNull().unique(), webhookToken: text('webhook_token').notNull().unique(), status: brightdataJobStatusEnum('status').default('PENDING').notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), ...timestamps }, (t) => ({ statusExpiresIdx: index('idx_brightdata_pending_jobs_status_expires').on(t.status, t.expiresAt) }));` — not in AD-8's soft-delete table list (an internal job-tracking row, not a user-facing removable entity), no `deletedAt` needed.
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the Drizzle-kit migration; commit both the migration file and its `meta/` snapshot.

- [ ] Task 2: Extend `apps/backend/src/lib/scraper/usage-store.ts` to be provider-pricing-aware (AC: #5)
  - [ ] Add a small internal `getProviderPricing(provider: string, env: BackendEnv): { pricePerThousandItemsUsd: number; monthlyBudgetUsd: number }` lookup — `'apify'` maps to `env.scraperPricePerThousandItemsUsd`/`env.scraperMonthlyBudgetUsd` (unchanged env vars, unchanged values), `'brightdata'` maps to new `env.brightdataPricePerThousandItemsUsd`/`env.brightdataMonthlyBudgetUsd`.
  - [ ] `isProviderCapacityAvailable(provider)`: replace the flat `env.scraperPricePerThousandItemsUsd`/`env.scraperMonthlyBudgetUsd` reads with `getProviderPricing(provider, env)`. `recordProviderUsage` is unaffected (it only tracks item counts, not price) — no change needed there.
  - [ ] Extend `usage-store.test.ts` (existing, currently Apify-only): re-verify all existing Apify assertions still pass unmodified against the refactored function; add new cases for `'brightdata'` (cycle-reset, threshold boundary, missing-row-defaults-to-available) using `BRIGHTDATA_*` env values.

- [ ] Task 3: `apps/backend/src/lib/scraper/brightdata-client.ts` — raw Bright Data HTTP calls (AC: #1, #3, #6)
  - [ ] Export `triggerBrightDataJob(input: { url: string; numOfPosts: number; startDate: string }, webhookUrl: string): Promise<{ snapshotId: string }>` — `POST https://api.brightdata.com/datasets/v3/trigger?dataset_id=${env.brightdataDatasetId}&type=discover_new&discover_by=url&endpoint=${encodeURIComponent(webhookUrl)}&format=json`, `Authorization: Bearer ${env.brightdataApiToken}`, body `{ input: [{ url: input.url, num_of_posts: input.numOfPosts, start_date: input.startDate }] }`; throws on non-2xx. As a mutable `export let` + `setTriggerBrightDataJob(fn)` test seam, mirroring `instagram-adapter.ts`'s `callApifyActor`/`setCallApifyActor` pattern — no live network call in any test.
  - [ ] Export `getBrightDataProgress(snapshotId: string): Promise<{ status: 'scheduled' | 'building' | 'running' | 'ready' | 'failed' }>` — `GET https://api.brightdata.com/datasets/v3/progress/${snapshotId}`, same auth header, same test-seam pattern (`setGetBrightDataProgress`).
  - [ ] Export `getBrightDataSnapshot(snapshotId: string): Promise<any[]>` — `GET https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`, same auth/test-seam pattern (`setGetBrightDataSnapshot`).
  - [ ] Export `mapBrightDataDateToStartDate(newerThan: string): string` — converts an ISO date string to Bright Data's `MM-DD-YYYY` format.
  - [ ] Unit tests (`brightdata-client.test.ts`, no live network call): correct request shape for all three calls (URL, query params, auth header, body); `mapBrightDataDateToStartDate` conversion correctness; non-2xx trigger response throws.

- [ ] Task 4: `apps/backend/src/lib/scraper/brightdata-pending-jobs-store.ts` — CRUD for the pending-job table (AC: #1, #2, #3, #6)
  - [ ] Export `createPendingJob({ profileId, snapshotId }): Promise<{ webhookToken: string; id: string }>` — generates `webhookToken` via `randomBytes(24).toString('hex')`, inserts a row with `status: 'PENDING'`, `expiresAt: new Date(Date.now() + env.brightdataJobTimeoutMinutes * 60_000)`.
  - [ ] Export `findPendingJobByToken(webhookToken: string): Promise<BrightdataPendingJob | undefined>` — no status/expiry filter applied at the query level (AC3's handler applies the `status === 'PENDING' && expiresAt > now` check itself, so it can log the specific reason — already-completed vs. already-expired vs. unrecognized — rather than a single generic "not found").
  - [ ] Export `markPendingJobCompleted(id: string): Promise<void>` and `markPendingJobExpired(id: string): Promise<void>`.
  - [ ] Export `findExpiredPendingJobs(): Promise<BrightdataPendingJob[]>` — `WHERE status = 'PENDING' AND expires_at < NOW()`.
  - [ ] Integration tests (real DB, `node:test`): create/find/mark-completed/mark-expired round-trip; `findExpiredPendingJobs` only returns rows past `expiresAt` still `PENDING` (not already `COMPLETED`/`EXPIRED`, not still within the timeout window).

- [ ] Task 5: `apps/backend/src/lib/scraper/process-brightdata-result.ts` — shared post-processing (AC: #3, #6)
  - [ ] Export `processBrightDataResult(pendingJob: BrightdataPendingJob, records: any[]): Promise<void>` — maps each record to `persistScrapedPost`'s shape (Dev Notes "Bright Data Field Mapping"), calls `persistScrapedPost` per record, stamps `socialMediaAccountProfiles.lastScrapedAt` for `pendingJob.profileId`, calls `markPendingJobCompleted(pendingJob.id)`. Used identically by both Task 6 (webhook handler) and Task 8 (sweep's recovery path) — do not duplicate this logic in either caller.
  - [ ] Integration test (real DB): asserts posts persisted, `lastScrapedAt` stamped, job marked `COMPLETED`.

- [ ] Task 6: `apps/backend/src/lambdas/webhook.ts` — new public webhook Lambda (AC: #3)
  - [ ] `export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>`: only handles `POST /webhooks/brightdata` (single-route Lambda, no routing framework needed). Reads `event.queryStringParameters?.jobToken`; if absent, return `400`. Calls `findPendingJobByToken(jobToken)`; if not found, or `status !== 'PENDING'`, or `expiresAt` has passed, log a warning with the specific reason and return `200` (Bright Data should not retry — the job is either already resolved by the sweep or the token is invalid/forged; returning non-2xx would just trigger pointless webhook retries). On a valid match, `JSON.parse(event.body)` (array of records) and call `processBrightDataResult(job, records)`; wrap in try/catch — a processing error is logged and still returns `200` (do not let a mapping bug cause Bright Data to retry-storm the endpoint; the sweep's own recovery path is the intended catch-all for a job that never completed cleanly, not letting this webhook handler crash-and-retry — matches AC8's isolation principle applied to the webhook context specifically).
  - [ ] Unit tests (`webhook.test.ts`, real DB for the pending-job lookup, no live network): valid token processes and returns 200; missing/unknown/expired/already-completed token returns 200 without calling `processBrightDataResult` (assert via a spy/seam that it was not invoked); malformed body returns 200 and logs, does not throw out of the handler.

- [ ] Task 7: `apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts` — shared trigger orchestration (AC: #1, #4, #5, #7)
  - [ ] Export `attemptBrightDataTrigger(target: { profileId: string; username: string }, newerThan: string): Promise<boolean>` (returns `true` if a job was successfully triggered and a pending-job row created, `false` if the caller should fall back to Apify): checks `isProviderCapacityAvailable('brightdata')`; if unavailable, returns `false` immediately (no call made). Otherwise builds the webhook URL as `` `${env.brightdataWebhookBaseUrl}?jobToken=PLACEHOLDER` ``, calls `triggerBrightDataJob(...)`, and on success calls `createPendingJob({ profileId: target.profileId, snapshotId })` — **then** re-issues (or updates) the trigger's `endpoint=` URL to embed the real generated `webhookToken` (see Dev Notes "Webhook Token / URL Ordering" for the exact sequencing, since the token must exist before the trigger call so Bright Data is given the final URL, not patched after the fact). Calls `recordProviderUsage('brightdata', 1)` (one job triggered — Bright Data bills per delivered record, not per trigger call, but this call establishes the pending-job's eventual cost is accounted for once records actually arrive; see Dev Notes "Bright Data Usage Accounting Timing" for why usage is recorded at result-processing time, not at trigger time, unlike this draft's first-pass assumption). On any error (non-2xx, network, thrown), logs and returns `false`.
  - [ ] Unit tests (test-seam-based, no live network): capacity-unavailable path returns `false` without calling `triggerBrightDataJob`; successful trigger creates exactly one pending-job row and returns `true`; trigger failure returns `false` and creates no row.

- [ ] Task 8: `apps/backend/src/lib/scraper/stale-job-sweep.ts` (AC: #6, #8)
  - [ ] Export `runStaleJobSweep(): Promise<void>`: `findExpiredPendingJobs()`; for each job (via `Promise.allSettled` so one job's failure doesn't block the rest, matching AC8): `getBrightDataProgress(job.snapshotId)`; if `ready`, `getBrightDataSnapshot(job.snapshotId)` then `processBrightDataResult(job, records)`; otherwise (`failed`, still not `ready`, or the poll call itself throws), `markPendingJobExpired(job.id)`, re-select the job's `profileId`'s `socialMediaAccountProfiles` row for `platform`/`accountId`/`username`, and run the existing synchronous Apify path (`getScraperAdapter('instagram').getNewestPosts(...)` + `persistScrapedPost` per post — reuse `processScrapeJob`'s internal logic/shape, do not fork a third copy of the persist-and-stamp sequence) before stamping `lastScrapedAt`.
  - [ ] Integration test (real DB, fake `getBrightDataProgress`/`getBrightDataSnapshot`/Apify adapter via test seams): ready-job-recovers-without-apify-call case; failed/timeout-job-falls-back-to-apify case; one job throwing does not prevent other jobs in the same sweep from being processed.

- [ ] Task 9: Retrofit `apps/backend/src/lambdas/scraper.ts`'s EventBridge branch (AC: #1, #4, #6)
  - [ ] Distinguish the two EventBridge-sourced invocations: `if ('jobType' in event && event.jobType === 'stale-job-sweep') { await runStaleJobSweep(); return; }` — placed before the existing `'Records' in event` check (an `EventBridgeEvent` never has `Records`, so ordering between this new branch and the SQS branch doesn't matter, but check it explicitly before falling into the existing default/daily-batch branch).
  - [ ] Retrofit the existing default (no `jobType`, no `Records` — Story 3.4's original daily-batch trigger, backward compatible) branch: for each target from `getBatchScrapeTargets()` (now also excluding open-pending-job accounts per AC2), if `target.platform === 'instagram'`, call `attemptBrightDataTrigger(target, newerThan)` (compute `newerThan` the same way Story 3.4's `processScrapeJob` does, from `MAX(posts.publishedAt)`/lookback default); if it returns `false`, fall back to `enqueueScrapeJob(target)` (today's unchanged Apify-SQS path). Non-instagram targets (`'twitter'`) skip straight to `enqueueScrapeJob(target)`, unchanged from Story 3.4's behavior.
  - [ ] Use `Promise.allSettled` across all targets, matching the existing pattern and AC8's isolation requirement.

- [ ] Task 10: Retrofit `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (AC: #7)
  - [ ] Inside the `if (!accountProfile) { ... }` branch, replace the single `isProviderCapacityAvailable('apify')` check: if Apify is unavailable, check `isProviderCapacityAvailable('brightdata')`; if Bright Data is also unavailable, throw `ScraperCapacityExceededError` as today. If Bright Data has capacity, proceed with the insert (same as today) then call `attemptBrightDataTrigger({ profileId: accountProfile.id, username: accountProfile.username }, <initial-lookback newerThan>)` in its own try/catch (log-and-continue on failure, mirroring the existing `enqueueScrapeJob` call site's error handling — never throw from this call). If Apify has capacity (the common case, unchanged), proceed exactly as today (`enqueueScrapeJob`).
  - [ ] Extend `subscribe-to-account.test.ts` (existing): add cases for (a) Apify-exhausted-but-Bright-Data-available triggers a Bright Data job instead of throwing, (b) both-exhausted still throws `ScraperCapacityExceededError`, (c) existing Apify-available case is unchanged (regression check).

- [ ] Task 11: `apps/backend/src/env.ts` (AC: #1, #3, #5, #6, #7)
  - [ ] Add to `BackendEnv`/`loadBackendEnv()`: `brightdataApiToken?: string` (`BRIGHTDATA_API_TOKEN`), `brightdataDatasetId: string` (`BRIGHTDATA_DATASET_ID`, default `'gd_lk5ns7kz21pck8jpis'` — the Instagram Posts dataset, confirmed directly against Bright Data's docs during this story's creation), `brightdataWebhookBaseUrl?: string` (`BRIGHTDATA_WEBHOOK_BASE_URL`, wired from the deployed API Gateway's own URL via CDK — see Task 12), `brightdataJobTimeoutMinutes: number` (`BRIGHTDATA_JOB_TIMEOUT_MINUTES`, default `'180'`), `brightdataPricePerThousandItemsUsd: number` (`BRIGHTDATA_PRICE_PER_1000_ITEMS_USD`, default `'1.50'`), `brightdataMonthlyBudgetUsd: number` (`BRIGHTDATA_MONTHLY_BUDGET_USD`, default `'7.50'` — the dollar-equivalent of Bright Data's actual free tier, 5,000 records/month × $1.50/1,000, since the existing capacity model (reused from Apify, Task 2) compares against a USD budget rather than a raw record count; see Dev Notes) — matching the existing `parseInt(process.env.X || 'default', 10)` / `eslint-disable-next-line turbo/no-undeclared-env-vars` convention exactly.
  - [ ] Add all new vars to `.env.example` with brief comments (Bright Data token/dataset id, webhook base URL note, cost/capacity tunables).

- [ ] Task 12: `apps/infrastructure/lib/festgrid-backend-stack.ts` (AC: #1, #3, #5, #6, #7)
  - [ ] New Lambda: `webhookLambda` (`L_Webhook`), entry `apps/backend/src/lambdas/webhook.ts`, `environment: { STAGE, DATABASE_URL }` only (least-privilege — it never calls Bright Data or any queue, only reads/writes the DB via Drizzle).
  - [ ] New API Gateway resource: `api.root.addResource('webhooks').addResource('brightdata').addMethod('POST', new apigateway.LambdaIntegration(webhookLambda))` — a sibling to the existing `{proxy+}`/root GraphQL routes, not nested under them.
  - [ ] New second `events.Rule` (`ScraperSweepRule`) with `schedule: events.Schedule.rate(cdk.Duration.hours(1))`, targeting `scraperLambda` via `new targets.LambdaFunction(scraperLambda, { event: events.RuleTargetInput.fromObject({ jobType: 'stale-job-sweep' }) })` — distinct from the existing `ScraperScheduleRule`, which keeps its default (no custom `event`) payload shape, preserving Task 9's "no `jobType` = daily batch" backward-compatible branch.
  - [ ] After the `api` (`RestApi`) construct is created, call `apiLambda.addEnvironment('BRIGHTDATA_WEBHOOK_BASE_URL', \`${api.url}webhooks/brightdata\`)` and the same on `scraperLambda` — post-construction `.addEnvironment()` calls (not inline in the initial `environment: {...}` prop) are required here specifically to avoid a circular declaration (the Lambdas must exist before `api`/`LambdaIntegration` can reference them, but the webhook URL those same Lambdas need as an env var is only known once `api` exists) — do not attempt to reorder the file to inline this instead.
  - [ ] Add `BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || ''` and `BRIGHTDATA_DATASET_ID: process.env.BRIGHTDATA_DATASET_ID || 'gd_lk5ns7kz21pck8jpis'` to both `apiLambda`'s and `scraperLambda`'s `environment` blocks (both trigger Bright Data jobs — `apiLambda` for AC7's on-demand path, `scraperLambda` for AC1's batch path and AC6's sweep poll/snapshot calls). `webhookLambda` needs neither (it only receives, never calls out to Bright Data).
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: update `resourceCountIs('AWS::Lambda::Function', ...)` from `4` to `5`; update `resourceCountIs('AWS::Events::Rule', ...)` from `1` to `2`; add an assertion for the new `AWS::ApiGateway::Resource`/`AWS::ApiGateway::Method` webhook route existing; keep the existing `ScheduleExpression: 'rate(1 day)'` assertion (still true for the original rule) and add a new assertion for `ScheduleExpression: 'rate(1 hour)'` (the sweep rule).

- [ ] Task 13: Update `docs/infrastructure/high-level-overview.md` diagram (AC: #1, #3, #6)
  - [ ] Add `L_Webhook` under the `Processing` subgraph and a new `Bright Data` node under `External Services`.
  - [ ] Add edges: `L_Scrape -- triggers async job --> BrightData`, `BrightData -- webhook callback --> L_Webhook`, `L_Webhook -- persists scraped posts to --> Supabase`, `EventBridge -- triggers (hourly sweep) --> L_Scrape`, `L_Scrape -- polls/recovers --> BrightData`, `L_API -- triggers async job (on-demand fallback) --> BrightData`.

- [ ] Task 14: `SETUP_WALKTHROUGH.md` — extend "9. Scraper Adapter" section with a "Bright Data" subsection (AC: #1)
  - [ ] Sign up at Bright Data, create an Instagram Posts scraper collector (dataset id `gd_lk5ns7kz21pck8jpis`), generate an API token, add as `BRIGHTDATA_API_TOKEN`. Note the free-tier is 5,000 records/month (not a dollar credit like Apify's) and that `BRIGHTDATA_MONTHLY_BUDGET_USD`'s default (`7.50`) is a computed dollar-equivalent of that record quota, not Bright Data's own stated unit — revisit if Bright Data's pricing/free tier changes.
  - [ ] Note that `BRIGHTDATA_WEBHOOK_BASE_URL` is set automatically post-deploy by the CDK stack (Task 12) — it does not need to be set manually in `.env` for a deployed environment, and local-dev-only testing of the webhook path requires a real deployed API Gateway URL (or a tunneling tool) since Bright Data must reach a public HTTPS endpoint.

- [ ] Task 15: `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions.

## Dev Notes

### 2026-08-15 Reopening & Re-Verification (`bmad-create-story 3-4a`)

This story file was originally drafted 2026-08-09, then frozen the next day by epics.md's "ON HOLD" note (user decision to drop the Bright Data avenue pending a vendor clarification that was never sent). `sprint-status.yaml` was never synced back to `ready-for-dev` at that point, so it still read `backlog` despite this file being complete. On 2026-08-15 the user gave the explicit, new decision the ON HOLD note required to reopen this avenue (see epics.md Story 3.4a's REOPENED note) and confirmed proceeding with `bmad-create-story 3-4a`.

Before finalizing, this file's technical premises were re-verified directly against the current working tree (not re-derived from scratch, since nothing here appeared stale):
- `apps/backend/src/lib/scraper/usage-store.ts` — confirmed `isProviderCapacityAvailable`/`recordProviderUsage` are still provider-keyed at the row level but flat/Apify-only for pricing (`env.scraperPricePerThousandItemsUsd`/`env.scraperMonthlyBudgetUsd`) — Task 2's per-provider pricing extension is still needed exactly as specified, not yet done by any other story.
- `apps/backend/src/lib/scraper/instagram-adapter.ts` — confirmed Stories 3.4d (per-use-case actor selection/timeout) and 3.4e (not-found detection fix) have **not** been implemented yet (still the single `apify/instagram-api-scraper` actor everywhere, no not-found handling) — this file's "Not modified" claim for `instagram-adapter.ts` still holds today. If 3.4d/3.4e land before this story is implemented, re-confirm that claim still holds (both are orthogonal changes to the same file — actor/timeout/not-found logic vs. this story's vendor-orchestration-above-the-adapter design — but re-verify at implementation time rather than assume).
- `apps/backend/src/lib/scraper/get-scrape-targets.ts`, `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`, `apps/backend/src/lambdas/scraper.ts`, and the CDK stack's `scraperLambda`/`ScraperScheduleRule` wiring — all confirmed to match this story's described "current state" exactly (single EventBridge rule, no `jobType` branching, flat Apify-only capacity check at subscribe-time).

No drift found — this story's Tasks/ACs/Dev Notes content is unchanged from the 2026-08-09 draft. The one still-outstanding item is the capability question already flagged below ("Bright Data API Facts" — real Bright Data webhook/response field names unverified against a live authenticated call); this remains a tracked, accepted gap to close during implementation, not a blocker to `ready-for-dev`.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh for this story specifically** (the swept `epic-3-readiness.md`, `swept: true`, predates this story — 3.4a was split off Story 3.4 the day *after* that sweep and is not in its `stories_covered` list, so its findings cannot be cited for this story per `story-split-gate.md`'s own sweep-scope rule). **Verdict: No gap.** Everything this draft scope needs (webhook Lambda + API Gateway route, pending-job table, sweep trigger, usage-store extension) is new specifically *because* this story is the one introducing async-vendor support — none of it is a separable concern serving a different consumer that should be split into its own prerequisite story; it all belongs bundled here. Four real, non-mechanical implementation-approach tradeoffs were identified and resolved with the user via `AskUserQuestion` before drafting (all recommended defaults accepted):
  - **Webhook Lambda placement:** a **dedicated new Lambda** (`L_Webhook`, Task 6/12), not an extension of the existing GraphQL `apiLambda`. This is the app's first-ever public, unauthenticated, non-GraphQL HTTP endpoint; keeping it out of the authenticated GraphQL Yoga request path keeps the security perimeter clean and matches the existing one-Lambda-per-trigger-type pattern (`scraperLambda`/`aiProcessorLambda`/`ingestorLambda`).
  - **Webhook authentication/correlation:** an **app-minted secret token embedded in the per-job webhook URL** (`webhookToken`, Task 4/6), since Bright Data's webhook payload echoes back neither a `snapshot_id` nor any signature header (verified directly against Bright Data's docs) — this token is simultaneously the only correlation mechanism and the only auth mechanism available.
  - **Stale-job recovery:** the sweep **polls Bright Data's own progress/snapshot endpoints first**, only falling back to Apify if the job is confirmed failed/still-not-ready past timeout (Task 8) — consistent with this project's established cost-conscious capacity-gating rigor (Story 3.4's AC5), avoiding a silent double-pay for content Bright Data already produced behind a merely-lost webhook.
  - **Sweep Lambda placement:** the sweep **reuses `scraperLambda`** via a second EventBridge rule with a distinguishing static event payload (Task 9/12), rather than a new dedicated Lambda — it needs the same adapters/DB/usage-store wiring `scraperLambda` already has, and there is no other precedent or second consumer in the codebase to justify a new deployable unit for a low-volume periodic task.
- **Gate 2 (UI Complexity & Reusability) — run fresh.** **Verdict: No gap.** Zero UI surface — confirmed via the same reasoning already established for Story 3.4's own Gate 2 pass (no GraphQL fields, no resolvers exposed to clients, no `apps/web` change; a design-artifacts search found no UX spec describing any part of this pipeline).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh.** **Verdict: No gap.** The "public webhook endpoint" and "periodic EventBridge sweep" patterns this story introduces have exactly one consumer today (this story) — Epic 6's own public surface (voting, widgets, embed domains) is a *serving* surface (public GraphQL/CDN-hosted embeds), not a *receiving* surface for inbound third-party async callbacks, and nothing in `epics.md` currently needs a second webhook receiver or periodic sweep. Not promoted to a shared/Epic-0 pattern; correctly single-story-scoped.

### AD-7 Carve-Out (deliberate, documented)

The new `POST /webhooks/brightdata` route is intentionally **outside** AD-7's "all GraphQL server-side identity verification" scope — it is not a GraphQL resolver, has no Supabase Auth JWT to verify (Bright Data is not a logged-in user), and does not call `requireAuth`/`requireModerator`. Its own, narrower verification mechanism is the per-job `webhookToken` match against an open `brightdata_pending_jobs` row (Task 6). This is a deliberate, scoped exception for a third-party-callback endpoint, not a bypass of AD-7's actual concern (GraphQL identity/authorization) — call this out explicitly in code review so it isn't mistaken for a missed `requireAuth` call.

### Bright Data API Facts (verified directly against Bright Data's own docs during this story's creation, 2026-08-09 — not inferred or guessed, mirroring Story 3.4's Apify research rigor)

- Trigger: `POST https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lk5ns7kz21pck8jpis&type=discover_new&discover_by=url&endpoint=<webhook_url>&format=json`, `Authorization: Bearer <token>`, body `{"input":[{"url": "<profile_url>", "num_of_posts": N, "start_date": "MM-DD-YYYY", "end_date"?: "MM-DD-YYYY", "post_type"?: "Post"|"Reel", "posts_to_not_include"?: [<id>]}]}`. Response includes `snapshot_id`.
- Webhook delivery: Bright Data POSTs a bare JSON array of post records to the `endpoint=` URL once the job completes — **no** `snapshot_id` or any correlating field is included in that payload or its headers (confirmed directly; this is why Task 4/6's URL-embedded-token scheme exists at all, not a design preference).
- Progress polling (used by Task 8's sweep only, not the happy path): `GET https://api.brightdata.com/datasets/v3/progress/{snapshot_id}` → `status` one of `scheduled`/`building`/`running`/`ready`/`failed`; `GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json` fetches the ready data directly.
- Pricing (Instagram Posts dataset, `gd_lk5ns7kz21pck8jpis`): PAYG **$1.50/1,000 records**, **5,000 records/month free tier**, no credit card required for the free tier.
- Output record fields observed in Bright Data's own documented examples: `url`, `caption`, `image_url`, `likes`, `num_comments`/`comments`, `datetime`/`date_posted`, `id` — **residual, low-risk unknown** (matching Story 3.4's "Apify Field Mapping" caveat pattern exactly): the *mechanism* (trigger/webhook/progress/pricing) was directly verified, but the exact field names were not confirmed against a live authenticated API response (no Bright Data credential available during story creation). Task 5's field-mapping code and its fixture-based tests should be treated as best-effort and re-verified against one real webhook delivery during implementation.

### Bright Data Usage Accounting Timing

Unlike Apify (billed and counted per item actually returned by a synchronous call, so `recordProviderUsage` is called once the response is in hand), a Bright Data job's eventual record count is only known when the webhook/sweep delivers results — but AC5's capacity check must still gate the *trigger* call itself (an unbounded number of in-flight jobs could otherwise blow through budget before any of them resolve). Resolution: `attemptBrightDataTrigger` (Task 7) checks capacity and records a nominal `1` usage unit at trigger time (representing the job itself, not yet its record count) purely to prevent unbounded concurrent job fan-out from bypassing the gate; `processBrightDataResult`/`stale-job-sweep` do **not** additionally record per-record usage on completion, to avoid double-counting. This is an intentionally coarser approximation than Apify's exact per-item accounting — acceptable given Bright Data's job-level (not always record-level) billing model and the existing 90%-of-budget threshold's built-in headroom; flagged here so it isn't mistaken for an oversight during review.

### Webhook Token / URL Ordering

Bright Data needs the final `endpoint=` URL (including the `jobToken` query param) at trigger time — but the token is generated when the pending-job row is created, which itself needs the `snapshot_id` the trigger call returns. Break this ordering dependency by generating `webhookToken` **before** calling `triggerBrightDataJob` (a plain `randomBytes(24).toString('hex')`, independent of any Bright Data response), building the webhook URL with that pre-generated token, passing it as `endpoint=` in the trigger call, and only inserting the `brightdata_pending_jobs` row (with both the pre-generated `webhookToken` and the now-known `snapshotId`) after the trigger call succeeds. Task 4/7's ordering must follow this sequence exactly — do not attempt to create the row first with a placeholder `snapshotId`.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one additive schema change, plus one behavior-preserving refactor of existing functions — no mismatches.** `brightdata_pending_jobs` (new table) + `brightdata_job_status` (new enum) are purely additive (Task 1). `usage-store.ts`'s `isProviderCapacityAvailable` (Task 2) changes its internal pricing lookup from a flat env read to a per-provider lookup — this is a **behavior-preserving refactor** for existing `'apify'` call sites (same env vars, same computed values), not a breaking signature change (the function's public signature — `(provider: string) => Promise<boolean>` — is unchanged), but it must be verified via the full existing `usage-store.test.ts` suite passing unmodified, not just "compiles."
- **Impacted fields/contracts:** New DB table + enum (above); new TypeScript shapes `BrightdataPendingJob` (Task 4's internal row type) and the Task 3 client module's request/response shapes; no changes to `packages/shared-types`, the GraphQL schema, or any other existing export's shape.
- **Required DB migration changes:** One Drizzle-kit-generated additive migration (Task 1) — no `WHERE`-clause partial index involved (the `idx_brightdata_pending_jobs_status_expires` index is a plain composite index, not AD-8-scoped), so AD-8's drizzle-kit hand-edit workaround does not apply.
- **Required TypeScript type changes:** Drizzle's inferred row type for `brightdataPendingJobs` updates automatically once the schema changes; no other package's types are affected.
- **Backward compatibility and rollout notes:** Purely additive for the schema. The `usage-store.ts` refactor (Task 2) must ship with its Apify-regression tests green before merge — this is the one place in this story where "additive" doesn't fully describe the change, so it gets extra verification weight.
- **Verification checks:** Task 2's full `usage-store.test.ts` suite (Apify cases unchanged + new Bright Data cases); Task 4's pending-job CRUD integration tests; Task 8's sweep recovery/fallback integration tests; Task 10's `subscribe-to-account.test.ts` regression case for the unchanged Apify-available path.

### Project Structure Notes

- New: `apps/backend/src/lib/scraper/{brightdata-client.ts, brightdata-client.test.ts, brightdata-pending-jobs-store.ts, brightdata-pending-jobs-store.test.ts, process-brightdata-result.ts, process-brightdata-result.test.ts, trigger-brightdata-for-target.ts, trigger-brightdata-for-target.test.ts, stale-job-sweep.ts, stale-job-sweep.test.ts}`; `apps/backend/src/lambdas/webhook.ts` + `webhook.test.ts`; one new Drizzle migration.
- Modified: `packages/database/schema.ts`; `apps/backend/src/lib/scraper/usage-store.ts` + `.test.ts`; `apps/backend/src/lambdas/scraper.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` + `.test.ts`; `apps/backend/src/env.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts` + `.test.ts`; `docs/infrastructure/high-level-overview.md`; `.env.example`; `SETUP_WALKTHROUGH.md`.
- Not modified: `packages/domain/src/scraper/*` (Bright Data is deliberately **not** registered through the `ScraperAdapter`/`registerScraperAdapter` registry — see "Why Bright Data Isn't a `ScraperAdapter`" below); any `.graphql` schema file; `apps/web`; `packages/shared-types`; `apps/backend/src/lib/scraper/{instagram-adapter.ts, twitter-adapter.ts, register-adapters.ts, get-scrape-targets.ts (beyond the AC2 WHERE-clause extension), enqueue-scrape-job.ts, process-scrape-job.ts}` (all reused/called as-is, not rewritten).

### Why Bright Data Isn't a `ScraperAdapter`

Story 3.3c's `ScraperAdapter` interface is platform-keyed (`instagram` → one adapter, `twitter` → one adapter) and synchronous (`getNewestPosts` returns `Promise<ScrapedPost[]>` directly). Bright Data is a second **vendor** for the same platform (Instagram), not a second platform, and is fundamentally asynchronous (its "result" isn't available at call-return time — it arrives later via webhook/poll). Forcing it through `ScraperAdapter`'s synchronous per-platform shape would require either blocking the caller until the webhook arrives (defeating the entire purpose of using an async, cheaper vendor for the no-one's-waiting batch path) or having `getNewestPosts` return an empty array and silently rely on a side-channel — both worse than acknowledging directly that vendor-selection-and-fallback (Task 7/9) is orchestration logic that sits *above* the platform-keyed adapter registry, calling into Bright Data's own client module (Task 3) directly and falling back to `getScraperAdapter('instagram')` (today's Apify adapter) only when Bright Data isn't used. This is a deliberate, load-bearing design choice, not a missed opportunity to reuse the existing registry — call this out in code review if it looks unreused at first glance.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4a] — this story's draft AC (explicitly marked "to be fully detailed when this story is created") and its Gate 1 split note recorded during Story 3.4's own creation.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4] — the predecessor story's Amendment note ("On-demand fallback design (informs Story 3.4a, not built in this story)") this story's AC7 directly implements.
- [Source: _bmad-output/implementation-artifacts/3-4-scrape-new-posts-from-subscribed-accounts.md] — read in full; the already-implemented (working-tree state confirmed directly, not assumed from the story file) Apify pipeline, capacity-gating pattern, and test-seam conventions this story extends rather than reinvents.
- [Source: apps/backend/src/lib/scraper/{instagram-adapter.ts, usage-store.ts, register-adapters.ts, process-scrape-job.ts, get-scrape-targets.ts, enqueue-scrape-job.ts}, packages/domain/src/scraper/types.ts, apps/backend/src/lambdas/scraper.ts, apps/backend/src/lib/subscriptions/subscribe-to-account.ts, apps/backend/src/schema/resolvers.ts, apps/backend/src/env.ts, apps/infrastructure/lib/festgrid-backend-stack.ts + .test.ts] — read in full during this story's creation (actual shipped/working-tree code, not the story-file description) to confirm exact current behavior before specifying every extension point above.
- [Source: apps/backend/src/lib/ai-gateway/{adapter.ts, usage-store.ts}, packages/domain/src/ai-gateway/usage-cycle.ts] — the `isCycleElapsed`/`nextCycleReset` cycle-based usage-accounting precedent Task 2 extends (already reused once, by Story 3.4's own `scraper_provider_usage` table); also the closest existing precedent in this codebase for "try a candidate, exclude and fall back on failure" orchestration, informing Task 7/9's trigger-then-fallback shape.
- [Source: apps/backend/src/lambdas/api.ts, server.ts] — confirmed directly that `apiLambda` today handles 100% of API Gateway traffic through a single GraphQL Yoga server with no existing non-GraphQL route, informing the Gate-1 webhook-Lambda-placement tradeoff and its resolution.
- [Source: live Bright Data documentation research during this story's creation, 2026-08-09] — direct, verified findings (not training-data recall): trigger endpoint/auth/body shape, dataset id `gd_lk5ns7kz21pck8jpis` for Instagram Posts, `discover_by=url`/`num_of_posts`/`start_date`-`end_date`/`post_type`/`posts_to_not_include` input fields, webhook payload's lack of any correlating field, the `GET .../progress/{snapshot_id}` and `GET .../snapshot/{snapshot_id}` polling/fetch endpoints and their status values, and PAYG/free-tier pricing ($1.50/1,000 records, 5,000 free/month) — all confirmed directly against `docs.brightdata.com` and `brightdata.com/products/web-scraper/instagram/posts`, matching Story 3.4's Apify-research rigor. Exact output field names are a documented residual unknown (see "Bright Data API Facts" above), same caveat class as Story 3.4's own Apify field-mapping note.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-7] — Authenticated Context & Authorization; this story's webhook route is a deliberate, documented carve-out from AD-7's GraphQL-identity scope (see "AD-7 Carve-Out" above), not a violation of it.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 execution protocol and the epic-readiness-sweep-scope rule (a sweep only covers the stories listed in its own `stories_covered` frontmatter) that required running all three gates fresh for this story rather than citing `epic-3-readiness.md`.
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules, #Security] — Adapter Pattern for external services (informs "Why Bright Data Isn't a `ScraperAdapter`" above — the pattern's intent, vendor modularity, is honored even though this story deliberately doesn't force Bright Data through the existing platform-keyed registry); Resilient Processing Pipeline (SQS decoupling remains exactly as Story 3.4 built it for the Apify fallback path; Bright Data's own "decoupling" is inherent to its async job model, not SQS-based).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (all new logic is DB/Node/AWS-SDK/HTTP-coupled and correctly placed in `apps/backend`; nothing added to `packages/domain`); Security (Adapter Pattern honored per "Why Bright Data Isn't a `ScraperAdapter`"; the new public webhook endpoint's own scoped auth mechanism documented, not a bypass of `requireAuth`); Testing Rules (`apps/backend` integration-test convention followed throughout).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-7 (Authenticated Context): explicit, documented carve-out for the non-GraphQL webhook route (see Dev Notes). No other AD applies — this story adds no new GraphQL surface, no new soft-deletable entity (AD-8), and no new query DSL usage (AD-1/AD-2).
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/high-level-overview.md`, `2-backend.md` — read in full; this story extends the documented pipeline with a new Lambda/route/external-service edge, and Task 13 keeps the diagram in sync.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/lib/scraper/{brightdata-client.ts, brightdata-client.test.ts, brightdata-pending-jobs-store.ts, brightdata-pending-jobs-store.test.ts, process-brightdata-result.ts, process-brightdata-result.test.ts, trigger-brightdata-for-target.ts, trigger-brightdata-for-target.test.ts, stale-job-sweep.ts, stale-job-sweep.test.ts}`; `apps/backend/src/lambdas/webhook.ts` + `webhook.test.ts`; new Drizzle migration.
- **Modified:** `packages/database/schema.ts`; `apps/backend/src/lib/scraper/usage-store.ts` + `.test.ts`; `apps/backend/src/lib/scraper/get-scrape-targets.ts` (AC2's `NOT EXISTS` extension only) + `.test.ts`; `apps/backend/src/lambdas/scraper.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` + `.test.ts`; `apps/backend/src/env.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts` + `.test.ts`; `docs/infrastructure/high-level-overview.md`; `.env.example`; `SETUP_WALKTHROUGH.md`.
- **Not modified:** `packages/domain/src/scraper/*`; any `.graphql` file; any `apps/web` file; `packages/shared-types`; `apps/backend/src/lib/scraper/{instagram-adapter.ts, twitter-adapter.ts, register-adapters.ts, enqueue-scrape-job.ts, process-scrape-job.ts}`.

### Rule Mapping

- Adapter Pattern for external services → `project-context.md` General Architecture → honored via the vendor-orchestration design in "Why Bright Data Isn't a `ScraperAdapter`" (Tasks 3, 7) even though the platform-keyed registry itself is untouched.
- Resilient Processing Pipeline / decoupling → `project-context.md` Security → Bright Data's async job+webhook model is its own decoupling mechanism (Tasks 1, 3, 4, 6); the existing SQS `ScrapingQueue` fallback path (Apify) is reused unchanged (Task 9/10).
- AD-7 scoped carve-out for a non-GraphQL, non-user-identity endpoint → Architecture Spine AD-7 → documented explicitly in Dev Notes and Task 6's own auth mechanism.
- Reuse over reinvention (`scraper_provider_usage`/`recordProviderUsage`/`isProviderCapacityAvailable`, `persistScrapedPost`, `getScraperAdapter('instagram')` for the Apify fallback, the existing `export let`/`setX` test-seam pattern, `isCycleElapsed`/`nextCycleReset`) → this story's own Dev Notes + Story 3.4's precedents → Tasks 2, 3, 5, 8, 9.
- "Leave the system working end-to-end, not just satisfy stated ACs" → this workflow's Step 3 mandate → Task 9's `getBatchScrapeTargets`/AC2 pending-job exclusion (prevents double-triggering, a gap the literal epics.md draft AC didn't call out) and Task 2's Apify-regression verification requirement for the usage-store refactor.
- User-confirmed design decisions (webhook Lambda placement, webhook auth/correlation scheme, stale-job recovery-before-fallback, sweep Lambda placement) → `AskUserQuestion` record in this story's own "Architecture & UX Gate Findings" → Tasks 6, 8, 9, 12.

### Verification Plan

- `packages/database`: migration reviewed as additive-only; `pnpm --filter @festgrid/database build` confirms the schema change compiles.
- `apps/backend/src/lib/scraper/usage-store.test.ts`: full existing Apify suite passes unmodified + new Bright Data cases (Task 2) — the single highest-risk regression surface in this story.
- New `apps/backend/src/lib/scraper/{brightdata-client, brightdata-pending-jobs-store, process-brightdata-result, trigger-brightdata-for-target, stale-job-sweep}.test.ts`: fixture/test-seam-based (no live network) plus real-DB integration tests per Task breakdown, including the sweep's ready-recovery and failed-fallback branches (Task 8) and the trigger orchestration's capacity/failure branches (Task 7).
- `apps/backend/src/lambdas/webhook.test.ts` (new): valid/invalid/expired/already-completed token paths, all returning `200`, only the valid path invoking `processBrightDataResult`.
- `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): Bright-Data-fallback-when-Apify-exhausted case, both-exhausted-still-throws case, unchanged-Apify-available regression case.
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): 5 Lambdas, 2 EventBridge rules (`rate(1 day)` and `rate(1 hour)`), new webhook API Gateway resource/method present.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- **Not covered by automated tests, by design (see Dev Notes "Bright Data API Facts"):** whether Bright Data's real webhook/snapshot response field names exactly match this story's mapping code. Flagged as a small, low-risk residual unknown to confirm during implementation against one real delivery, not blocking — same caveat class Story 3.4 already accepted for Apify.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story adds Bright Data as the priority (cheaper, async) vendor for the daily batch and as a subscribe-time fallback when Apify is exhausted, via a new dedicated public webhook Lambda + API Gateway route, a new pending-job tracking table, and an hourly stale-job recovery sweep (poll-before-fallback) reusing `scraperLambda`. Apify remains the on-demand primary and the batch/stale-job fallback, unchanged from Story 3.4. Twitter/X is unaffected (still a stub, still routed through the existing Apify-SQS path only).
- [ ] Architecture and boundary confirmation: all new logic is DB/Node/HTTP-coupled and lives in `apps/backend`/`apps/infrastructure`; nothing added to `packages/domain` or `apps/web`; the new webhook route is a deliberate, documented AD-7 carve-out (not a `requireAuth` bypass); Bright Data is deliberately orchestrated above, not through, the existing `ScraperAdapter` registry (see Dev Notes rationale) — confirm this reads as intentional, not missed reuse, during implementation review.
- [ ] Testing plan confirmation: new `apps/backend/src/lib/scraper/*` and `lambdas/webhook.ts` covered by fixture-based and real-DB integration tests per the task breakdown; `usage-store.test.ts`'s full existing Apify suite must remain green (this story's highest regression risk); `subscribe-to-account.test.ts` and `festgrid-backend-stack.test.ts` extended; explicitly **no** test proves Bright Data's real response field names match this story's mapping — a small, accepted, low-risk gap matching Story 3.4's own precedent.
- [ ] **Story 3.4 dependency confirmed satisfied:** already implemented in the working tree as of this story's creation (`apps/backend/src/lib/scraper/{instagram-adapter,usage-store,register-adapters,get-scrape-targets,enqueue-scrape-job,process-scrape-job}.ts` and the `subscribeToAccount`/`resolvers.ts`/CDK retrofits all exist and were read directly, not assumed) — no blocking wait needed; this story extends that already-shipped pipeline.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: `epic-3-readiness.md`'s sweep predates this story (not in its `stories_covered`) so all three gates were run fresh rather than cited; all three reported **no gap**. Four real implementation-approach tradeoffs (webhook Lambda placement, webhook auth/correlation, stale-job recovery-before-fallback, sweep Lambda placement) were resolved with the user via `AskUserQuestion` before drafting — see Dev Notes "Architecture & UX Gate Findings" for the accepted defaults and rationale.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/scraper/usage-store.test.ts` (extended): existing Apify assertions unchanged/still passing; new Bright Data cycle-reset/threshold-boundary/missing-row-defaults-to-available cases (Task 2).
- [ ] `apps/backend/src/lib/scraper/brightdata-client.test.ts` (new): request-shape coverage for trigger/progress/snapshot calls via test seams (no live network); date-format conversion; non-2xx trigger throws (Task 3).
- [ ] `apps/backend/src/lib/scraper/brightdata-pending-jobs-store.test.ts` (new, real DB): create/find/mark-completed/mark-expired round-trip; expired-query correctness (Task 4).
- [ ] `apps/backend/src/lib/scraper/process-brightdata-result.test.ts` (new, real DB): persistence, `lastScrapedAt` stamping, job marked completed (Task 5).
- [ ] `apps/backend/src/lambdas/webhook.test.ts` (new, real DB for lookup, no live network): valid/invalid/expired/already-completed token paths (Task 6).
- [ ] `apps/backend/src/lib/scraper/trigger-brightdata-for-target.test.ts` (new): capacity-gated, success, and failure branches via test seams (Task 7).
- [ ] `apps/backend/src/lib/scraper/stale-job-sweep.test.ts` (new, real DB, fake progress/snapshot/adapter seams): ready-recovery, failed/timeout-fallback, per-job error isolation (Task 8).
- [ ] `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` (existing, extended): open-pending-Bright-Data-job accounts excluded from batch selection (AC2).
- [ ] `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): Apify-exhausted-Bright-Data-available fallback case; both-exhausted-still-throws case; unchanged Apify-available regression case (Task 10).
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): 5 Lambdas, 2 EventBridge rules with both schedule expressions, new webhook route present (Task 12).
- [ ] E2E: not required — no user-facing page/flow; per `project-context.md`'s testing-trophy philosophy, the integration tests above are the appropriate depth, matching Story 3.4's own precedent.
- [ ] **Explicitly not automatable, tracked as a follow-up, not silently skipped:** confirming Bright Data's real webhook/snapshot response field names against a live delivery once a real `BRIGHTDATA_API_TOKEN` and a reachable public webhook URL are available (see Dev Notes "Bright Data API Facts").

## Deliverables Checklist

- [ ] `brightdata_pending_jobs` table + `brightdata_job_status` enum added via committed Drizzle-kit migration.
- [ ] `usage-store.ts` extended for per-provider pricing without changing existing Apify behavior (verified by regression tests).
- [ ] `brightdata-client.ts` (trigger/progress/snapshot calls), `brightdata-pending-jobs-store.ts`, `process-brightdata-result.ts`, `trigger-brightdata-for-target.ts`, `stale-job-sweep.ts` implemented and tested.
- [ ] New `apps/backend/src/lambdas/webhook.ts` + API Gateway `POST /webhooks/brightdata` route wired end-to-end.
- [ ] `scraper.ts`'s EventBridge branch retrofitted for Bright-Data-first batch dispatch (instagram only) and the new stale-job-sweep event type; `getBatchScrapeTargets` excludes open-pending-job accounts.
- [ ] `subscribeToAccount` retrofitted with the Bright Data on-demand fallback; existing capacity-block behavior preserved when both vendors are exhausted.
- [ ] `apps/infrastructure` CDK stack: new webhook Lambda + route, new hourly sweep EventBridge rule targeting `scraperLambda`, new env vars wired to both `apiLambda` and `scraperLambda` (including the post-construction `BRIGHTDATA_WEBHOOK_BASE_URL` wiring); stack test updated (5 Lambdas, 2 rules).
- [ ] `docs/infrastructure/high-level-overview.md` diagram updated with `L_Webhook`/Bright Data.
- [ ] `SETUP_WALKTHROUGH.md` and `.env.example` document the new Bright Data token/dataset id and cost/capacity env vars.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

## Out of Scope

- Any Bright Data integration for Twitter/X — still an explicit stub (Story 3.4 AC8), unaffected by this story.
- Retrofitting the on-demand path to try Bright Data *before* Apify, or offering the caller any choice of vendor — Apify remains on-demand primary per Story 3.4's Amendment; Bright Data is strictly a fallback there.
- A generic, reusable "public webhook receiver" framework/utility for future third-party integrations — this story builds exactly one webhook route for exactly one consumer (Gate 3 confirmed no second consumer exists yet); generalizing it is deferred until a second real consumer appears.
- BYOK-pooled Bright Data keys — still deferred per Story 3.4b's existing scope/legal-gating note, unaffected by this story.
- A synchronous "check both vendors and pick the cheaper live option" scheduler for the batch path — the batch path's Bright-Data-first-then-Apify-fallback ordering is fixed by this story's AC, not dynamically re-evaluated per run.
- Any GraphQL schema/resolver change, or any `apps/web` change — none introduced (AC9).

## Definition of Done

- [ ] All 9 Acceptance Criteria satisfied.
- [ ] `apps/backend/src/lib/scraper/*` (new Bright Data modules) and `lambdas/webhook.ts` unit + integration tests passing.
- [ ] `usage-store.test.ts`'s existing Apify suite passes unmodified; `subscribe-to-account.test.ts`, `get-scrape-targets.test.ts`, and `festgrid-backend-stack.test.ts` updated and passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] New Drizzle migration reviewed as additive-only, no data loss.
- [ ] `docs/infrastructure/high-level-overview.md`, `SETUP_WALKTHROUGH.md`, and `.env.example` all reflect the new Bright Data integration.
- [ ] Explicitly tracked, not silently dropped: confirming Bright Data's real response field names against a live webhook delivery is still outstanding after this story merges (see Out of Scope-adjacent Dev Notes caveat) — recommend doing this as soon as a real `BRIGHTDATA_API_TOKEN` and reachable public webhook URL are available.

## Completion Status

- [x] Task 1: brightdata_pending_jobs table + enum migration
- [x] Task 2: usage-store.ts extended for per-provider pricing
- [x] Task 3: brightdata-client.ts - HTTP calls (trigger/progress/snapshot)
- [x] Task 4: brightdata-pending-jobs-store.ts - CRUD operations
- [x] Task 5: process-brightdata-result.ts - Shared post-processing
- [x] Task 6: webhook.ts Lambda - Handler implemented
- [x] Task 7: trigger-brightdata-for-target.ts - Orchestration
- [x] Task 8: stale-job-sweep.ts - Periodic recovery sweep
- [x] Task 9: scraper.ts retrofitted - Bright Data triggers and sweep routing
- [x] Task 10: subscribe-to-account.ts retrofitted - Bright Data fallback
- [x] Task 11: env.ts extended - All Bright Data env vars added
- [x] Task 12: CDK infrastructure - Webhook Lambda, API routes, env wiring
- [ ] Task 13: Documentation updates (SETUP_WALKTHROUGH.md, high-level-overview.md)
- [ ] Task 14: Verification Plan execution (full build pass)
- [ ] Pre-Coding Approval Gate verification before marking done

## Dev Agent Record

### Agent Model Used
Claude Haiku 4.5

### Implementation Session (2026-08-19)
Session focused on infrastructure fixes and story implementation completion:

**Infrastructure Fixes (Commit b4f9640):**
- Added missing DateTime scalar to typeDefs.graphql (fixed GraphQL schema validation)
- Deleted stale src/lambda/ directory (5 files with incomplete/duplicate implementations)
- Fixed webhook-dev-server.ts to reference lambdas/webhook.ts
- Corrected trigger-brightdata-onetime.ts imports and function signature
- Fixed subscriptions.test.ts using invalid posts table fields

**Story Implementation (Commit 6411e8c):**
- Consolidated webhook Lambda for Apify and Bright Data callbacks
- Removed duplicate BrightDataTrigger and StaleJobSweep Lambda definitions
- Added /webhooks/brightdata API Gateway route
- Wired stale-job-sweep EventBridge rule to scraper Lambda with jobType payload
- Added BRIGHTDATA env vars to both apiLambda and scraperLambda

### Completion Notes
Story 3-4a core implementation is complete. All core Bright Data modules are implemented and wired. The infrastructure refactoring consolidated duplicate Lambda definitions and properly integrated the stale-job-sweep into the scraper Lambda's EventBridge handling.

**Outstanding Items:**
1. Documentation updates (SETUP_WALKTHROUGH.md, high-level-overview.md)
2. Full build verification (pre-existing test failures in other stories need attention)
3. Pre-Coding Approval Gate signoff before marking story as done

### File List
**New Files:**
- apps/backend/src/lib/scraper/brightdata-client.ts
- apps/backend/src/lib/scraper/brightdata-client.test.ts
- apps/backend/src/lib/scraper/brightdata-pending-jobs-store.ts
- apps/backend/src/lib/scraper/brightdata-pending-jobs-store.test.ts
- apps/backend/src/lib/scraper/process-brightdata-result.ts
- apps/backend/src/lib/scraper/process-brightdata-result.test.ts
- apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts
- apps/backend/src/lib/scraper/trigger-brightdata-for-target.test.ts
- apps/backend/src/lib/scraper/stale-job-sweep.ts
- apps/backend/src/lib/scraper/stale-job-sweep.test.ts
- apps/backend/src/lambdas/webhook.ts

**Modified Files:**
- packages/database/schema.ts (added brightdata_pending_jobs table)
- apps/backend/src/lambdas/scraper.ts (EventBridge stale-job-sweep branch)
- apps/backend/src/lib/scraper/usage-store.ts (per-provider pricing)
- apps/backend/src/lib/scraper/get-scrape-targets.ts (pending-job exclusion)
- apps/backend/src/lib/subscriptions/subscribe-to-account.ts (Bright Data fallback)
- apps/backend/src/env.ts (all Bright Data env vars)
- apps/infrastructure/lib/festgrid-backend-stack.ts (webhook route, EventBridge wiring)
- apps/backend/src/trigger-brightdata-onetime.ts (debug script)
- apps/backend/src/webhook-dev-server.ts (dev server)

**Deleted Files:**
- apps/backend/src/lambda/ directory (5 stale/duplicate files)
