# Story 3.4f: Fix missing Lambda timeouts and extend async job handling to Apify's long-running scrape paths

## Story Details

- Epic: 3
- Story ID: 3.4f
- Status: ready-for-dev

## Story

As a system,
I want (a) `apiLambda`, `scraperLambda`, `aiProcessorLambda`, and `ingestorLambda` to each have an explicit, correctly-sized execution timeout instead of sharing one blanket value that is wrong for more than one of them, and (b) Apify calls behind `getNewestPosts` (the scheduled-batch fallback path, Story 3.4a AC4, and the new-account-subscription backfill path, Story 3.4 AC6) to use the same async job-trigger + webhook + stale-job-sweep pattern Story 3.4a built for Bright Data — rather than blocking a Lambda invocation on a call Apify's own actor page states can take "a few seconds to a few hours",
So that neither Lambda is ever silently killed mid-scrape by a mis-sized timeout, and a long Apify run for the batch-fallback or new-account-backfill role isn't also capped by Lambda's own hard 900-second ceiling.

## Acceptance Criteria

1. **Given** `apps/infrastructure/lib/festgrid-backend-stack.ts`'s `sharedLambdaProps` (re-verified directly during this story's creation, 2026-08-18 — **not** the "no timeout, silent 3s default" state the original epics.md draft described; commit `dd01ac5` already added a blanket `timeout: cdk.Duration.seconds(30)` to `sharedLambdaProps`, applied to all Lambdas via the spread), **when** this story ships, **then** `apiLambda`, `scraperLambda`, `aiProcessorLambda`, and `ingestorLambda` each get an **explicit override** (placed after the `...sharedLambdaProps` spread in each Lambda's own props, per Task 1) instead of silently inheriting the shared 30s value:
   - `apiLambda`: `cdk.Duration.seconds(25)` — bounded below API Gateway's hard 29s integration ceiling (today's blanket 30s already exceeds it by 1s — a real, live bug: a request landing in that 29-30s window gets killed by API Gateway with a generic 504 instead of a controlled Lambda timeout error). 25s matches Story 3.4d's already-established 20s synchronous-adapter bound (`getPostByUrl`/`lookupAccountProfile`) plus headroom for GraphQL/DB overhead outside the adapter call itself.
   - `scraperLambda`, `aiProcessorLambda`, `ingestorLambda`: `cdk.Duration.seconds(300)` (5 minutes) each — comfortably covers SQS-batch work (Story 3.4d's real observed Apify durations: 7-75s per call) with generous headroom, well under Lambda's absolute 900s ceiling, without maxing it out (a 900s timeout would mask a genuinely hung invocation for 15 minutes before Lambda kills it).
2. **And** the decision on `aiProcessorLambda`/`ingestorLambda`'s identical missing-explicit-timeout gap is: **fold it into this story** (recorded here, not deferred) — same root-cause bug (both silently rely on `sharedLambdaProps`'s blanket value, which this story is already touching for `apiLambda`/`scraperLambda`), and giving them their own explicit `300s` override is a one-line addition per Lambda with no other coupling to this story's async-job work.
3. **And** a new `apify_pending_jobs` table + `apify_job_status` enum (`'PENDING' | 'COMPLETED' | 'EXPIRED'`) is added — a **separate, dedicated table**, deliberately **not** a generalization of Story 3.4a's `brightdata_pending_jobs` into a vendor-keyed shape (explicit user decision during this story's creation, 2026-08-18: `brightdata_pending_jobs` is actively being modified by Story 3.4a's still-in-progress implementation right now; touching its schema/call sites from this story would create unnecessary merge/regression risk against code that isn't this story's to own). `getNewestPosts` calls made via the Apify vendor path (daily-batch fallback and subscribe-time backfill, per AC8 below) are triggered as an async Apify actor run via `POST https://api.apify.com/v2/actors/:actorId/runs?webhooks=<base64 JSON array of {eventTypes, requestUrl}>` (confirmed directly against Apify's own API docs during this story's creation, 2026-08-18: this is the actual non-blocking trigger endpoint — distinct from the blocking `client.actor(id).call()` `instagram-adapter.ts` uses today; the `apify-client` SDK already used by this codebase exposes the same behavior via `.actor(id).start(input, { webhooks })`) rather than a single blocking call, mirroring Story 3.4a's Bright Data trigger-then-webhook shape as closely as the two vendors' APIs allow.
4. **And** a new public Lambda + API Gateway route, `POST /webhooks/apify`, receives Apify's webhook delivery for a completed run. **Note (re-verified 2026-08-18):** Story 3.4a's own `POST /webhooks/brightdata` route was never actually wired into `festgrid-backend-stack.ts` — no `webhooks` API Gateway resource exists yet at all (3.4a is still `in-progress`; its `apps/backend/src/lambdas/webhook.ts` handler exists but has no API Gateway integration). This story therefore **creates** the shared `webhooks` resource itself (`api.root.addResource('webhooks')`) and adds `.addResource('apify').addMethod('POST', ...)` under it — it does **not** attempt to also wire `/webhooks/brightdata` (that remains Story 3.4a's own open gap; see Pre-Coding Approval Gate). The handler resolves the incoming run against an `apify_pending_jobs` row by the same URL-embedded `webhookToken` scheme Story 3.4a established (Apify's default webhook payload does carry the run's `id` in its `resource` object, but the token-in-URL mechanism is kept as the primary correlation/auth mechanism regardless, for consistency with 3.4a and because the exact default payload shape is an accepted residual unknown — see Dev Notes), fetches the completed run's dataset (`GET https://api.apify.com/v2/actor-runs/{runId}` for `defaultDatasetId`, confirmed directly against Apify's API docs, then the existing dataset-items fetch pattern already used inside `callApifyActor`) and persists via a shared processing function reusing the same post-mapping logic the synchronous adapter methods already use (extracted, not duplicated — see Task 3).
5. **And** the existing hourly stale-job sweep (`stale-job-sweep.ts`'s `runStaleJobSweep`, Story 3.4a Task 8, already live) is extended with a second loop over expired `apify_pending_jobs` rows — polling `GET /v2/actor-runs/{runId}` directly (status values `READY`/`RUNNING`/`SUCCEEDED`/`FAILED`/`TIMING-OUT`/`TIMED-OUT`/`ABORTING`/`ABORTED`, confirmed via Apify's own API docs during this story's creation) rather than assuming a lost webhook means a lost job. `SUCCEEDED` is Apify's terminal-success value (distinct from Bright Data's `'ready'`) — the sweep recovers via dataset fetch + the same shared processing function AC4's webhook handler uses; any other terminal/timeout state marks the job `EXPIRED` and falls back through AC8's chain.
6. **And** `getPostByUrl` and `lookupAccountProfile` (the vote-check and manual-extraction sync paths, Story 3.4d) remain synchronous and unaffected by this story — the async treatment here applies only to the `getNewestPosts` role, matching the user's explicit scoping: Apify stays synchronous for account-check-at-vote-time and at subscribe-time's initial validation, and only gets "the same long process but different mechanism" treatment for the scheduled-batch/new-account-backfill role. `instagram-adapter.ts`'s two methods are not modified in behavior (only a pure, additive extraction — see Task 3).
7. **And** a failure in the Apify webhook path or sweep-recovery path is caught and logged per-job without failing the Lambda invocation for other jobs in the same run — matching Story 3.4/3.4a's established per-item isolation precedent (`Promise.allSettled` throughout).
8. **And** (added during this story's creation, resolving how `getNewestPosts`'s two real call sites — `scraper.ts`'s EventBridge daily-batch branch, and `subscribe-to-account.ts`'s brand-new-profile backfill branch — adopt the async trigger): both retrofit their existing Apify-SQS-fallback call (`enqueueScrapeJob(target)`) to first attempt the new `attemptApifyAsyncTrigger(target, newerThan)`; only when that returns `false` (Apify capacity exhausted, or the trigger call itself fails synchronously) do they fall back to the existing, unchanged synchronous `enqueueScrapeJob` → `ScrapingQueue` → `processScrapeJob` path — extending Story 3.4a's established "try candidate, fall back" chain one tier deeper: **Bright Data (instagram only) → Apify-async → Apify-sync-via-SQS**. The old SQS path is deliberately **not retired** — it remains the final safety net, and `process-scrape-job.ts`'s existing adaptive 9-window backfill retry (`NEW_SUBSCRIBE_RETRY_WINDOWS_DAYS`) is preserved unchanged there. Both async tiers (Bright Data's existing `attemptBrightDataTrigger`, and this story's new `attemptApifyAsyncTrigger`) use a single flat lookback window instead of that adaptive retry — this is not a regression introduced by this story, it matches the simplification Story 3.4a's own `attemptBrightDataTrigger` already established for the on-demand path.

## Tasks / Subtasks

- [ ] Task 1: Per-Lambda explicit timeout overrides (AC: #1, #2)
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.ts`: add `timeout: cdk.Duration.seconds(25)` to `apiLambda`'s own props (after `...sharedLambdaProps`), and `timeout: cdk.Duration.seconds(300)` to `scraperLambda`'s, `aiProcessorLambda`'s, and `ingestorLambda`'s own props (each after their own `...sharedLambdaProps` spread) — do **not** remove `timeout` from `sharedLambdaProps` itself (it stays as the fallback default for any Lambda that doesn't override it).
  - [ ] Explicitly out of scope, noted not fixed: the three Bright-Data-specific Lambda constructs Story 3.4a's in-progress work already added to this same file (`brightDataTriggerLambda`, `brightDataWebhookLambda`, `staleJobSweepLambda`, lines ~211-261 as of this story's creation) still inherit `sharedLambdaProps`'s blanket 30s, unchanged by this story — see Dev Notes "3.4a's In-Progress State" for why these are flagged as 3.4a's own open items, not absorbed here.

- [ ] Task 2: `apify_pending_jobs` table + `apify_job_status` enum (AC: #3, #4, #5)
  - [ ] `packages/database/schema.ts`: add `export const apifyJobStatusEnum = pgEnum('apify_job_status', ['PENDING', 'COMPLETED', 'EXPIRED']);` and `export const apifyPendingJobs = pgTable('apify_pending_jobs', { id: uuid('id').defaultRandom().primaryKey(), profileId: uuid('profile_id').references(() => socialMediaAccountProfiles.id).notNull(), runId: text('run_id').notNull().unique(), webhookToken: text('webhook_token').notNull().unique(), status: apifyJobStatusEnum('status').default('PENDING').notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), ...timestamps }, (t) => ({ statusExpiresIdx: index('idx_apify_pending_jobs_status_expires').on(t.status, t.expiresAt) }));` — mirrors `brightdata_pending_jobs`'s shape exactly except `runId` in place of `snapshotId`. Not in AD-8's soft-delete list (internal job-tracking row), no `deletedAt`.
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the Drizzle-kit migration; commit both the migration file and its `meta/` snapshot.

- [ ] Task 3: Extract shared Apify mapping/client helpers from `instagram-adapter.ts` (AC: #4, #6 — pure, additive refactor, no behavior change)
  - [ ] Export the existing inline item→`ScrapedPost` mapping logic (currently duplicated across `getPostByUrl`/`getNewestPosts`) as `export function mapApifyItemToScrapedPost(item: any): ScrapedPost` in `instagram-adapter.ts`. Update all three existing call sites to use it — behavior-identical, verified via the existing `instagram-adapter.test.ts` suite passing unmodified.
  - [ ] Export a small `export function getApifyClient(): ApifyClient` helper (wraps the existing `new ApifyClient({ token: env.apifyApiToken })` + the missing-token check) so `trigger-apify-for-target.ts` and `apify-webhook.ts`/`stale-job-sweep.ts`'s Apify-recovery branch don't duplicate client construction.
  - [ ] `instagram-adapter.test.ts`: add direct unit coverage for `mapApifyItemToScrapedPost` (the mapping was previously only indirectly tested via the three methods); existing tests otherwise unchanged.

- [ ] Task 4: `apps/backend/src/lib/scraper/apify-pending-jobs-store.ts` (AC: #3, #4, #5)
  - [ ] Export `createPendingJob({ profileId, runId }): Promise<{ webhookToken: string; id: string }>` — generates `webhookToken` via `randomBytes(24).toString('hex')`, `expiresAt: new Date(Date.now() + (env.apifyJobTimeoutMinutes ?? 180) * 60_000)`, mirroring `brightdata-pending-jobs-store.ts`'s `createPendingJob` exactly (same ordering rule: token generated before the trigger call, row inserted only after the trigger succeeds — see Dev Notes "Webhook Token / URL Ordering (Apify)").
  - [ ] Export `findPendingJobByToken`, `markPendingJobCompleted`, `markPendingJobExpired`, `findExpiredPendingJobs` — same signatures/semantics as the Bright Data store module, operating on `apifyPendingJobs`.
  - [ ] Integration tests (real DB, mirroring `brightdata-pending-jobs-store.test.ts`'s existing structure): create/find/mark-completed/mark-expired round-trip; `findExpiredPendingJobs` only returns still-`PENDING` rows past `expiresAt`.

- [ ] Task 5: `apps/backend/src/lib/scraper/process-apify-async-result.ts` (AC: #4, #5)
  - [ ] Export `processApifyAsyncResult(pendingJob: ApifyPendingJob, items: any[]): Promise<void>` — maps each item via Task 3's `mapApifyItemToScrapedPost`, calls `persistScrapedPost` per item, stamps `socialMediaAccountProfiles.lastScrapedAt` for `pendingJob.profileId`, calls `markPendingJobCompleted(pendingJob.id)`. Used identically by both Task 6's webhook handler and Task 8's sweep recovery branch — no duplicated logic.
  - [ ] Integration test (real DB): asserts posts persisted, `lastScrapedAt` stamped, job marked `COMPLETED`.

- [ ] Task 6: `apps/backend/src/lib/scraper/trigger-apify-for-target.ts` (AC: #3, #7, #8)
  - [ ] Export `attemptApifyAsyncTrigger(target: { profileId: string; username: string }, newerThan: string): Promise<boolean>` — checks `isProviderCapacityAvailable('apify')` (returns `false` immediately if unavailable, no call made); builds the webhook URL as `` `${env.apifyWebhookBaseUrl}?jobToken=<pre-generated token>` `` (token generated before the trigger call, same ordering as Bright Data's Task 7 in Story 3.4a); calls `getApifyClient().actor('apify/instagram-api-scraper').start({ directUrls: [`https://www.instagram.com/${target.username}/`], resultsType: 'posts', resultsLimit: env.scrapeResultsLimit, onlyPostsNewerThan: newerThan }, { webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'], requestUrl: webhookUrl }] })` (uses the same hardcoded actor id `callApifyActor` uses today for `getNewestPosts` — Story 3.4d's per-method named-constant refactor hasn't landed yet, so this story does not introduce a second, inconsistent naming scheme; if 3.4d lands first, re-point this call at `GET_NEWEST_POSTS_ACTOR`); on success, creates the `apify_pending_jobs` row (`runId` from the `.start()` response's `id`) and calls `recordProviderUsage('apify', 1)` (nominal trigger-time accounting, matching Bright Data's own coarser-than-per-item approximation — see Story 3.4a Dev Notes "Bright Data Usage Accounting Timing", applied identically here). On any error, logs and returns `false`.
  - [ ] Unit tests (test-seam-based, no live network — add an `export let`/`setX` seam on the new client-call wrapper, mirroring `instagram-adapter.ts`'s `callApifyActor`/`setCallApifyActor` pattern): capacity-unavailable path returns `false` without calling `.start()`; successful trigger creates exactly one pending-job row and returns `true`; trigger failure returns `false` and creates no row.

- [ ] Task 7: `apps/backend/src/lambdas/apify-webhook.ts` — new public webhook Lambda (AC: #4, #7)
  - [ ] `export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>`: reads `event.queryStringParameters?.jobToken`; missing → `400`. `findPendingJobByToken(jobToken)`; not found / `status !== 'PENDING'` / `expiresAt` passed → log the specific reason, return `200` (no retry; the sweep is the intended catch-all). On a valid match: `GET https://api.apify.com/v2/actor-runs/{runId}` for `defaultDatasetId`, then the existing dataset-items fetch pattern (`client.dataset(datasetId).listItems({ clean: true, limit: 1000 })`), then `processApifyAsyncResult(job, items)`. Wrap in try/catch — a processing error is logged and still returns `200` (matches AC7's isolation principle, same reasoning as Story 3.4a's `webhook.ts`).
  - [ ] Unit tests (`apify-webhook.test.ts`, real DB for the pending-job lookup, no live network): valid token processes and returns 200; missing/unknown/expired/already-completed token returns 200 without calling `processApifyAsyncResult`; malformed run-fetch response returns 200 and logs, does not throw out of the handler.

- [ ] Task 8: Extend `stale-job-sweep.ts`'s `runStaleJobSweep` with an Apify recovery loop (AC: #5, #7, #8)
  - [ ] Add a second `Promise.allSettled` loop (alongside the existing Bright Data loop, both inside the same `runStaleJobSweep` export — do not split into two separately-scheduled functions) over `findExpiredApifyPendingJobs()`: `GET /v2/actor-runs/{runId}`; if `status === 'SUCCEEDED'`, fetch the dataset and `processApifyAsyncResult(job, items)`; otherwise (`FAILED`/`TIMED-OUT`/`ABORTED`/still not terminal past timeout/poll error) → `markPendingJobExpired(job.id)`, then fall back to the existing synchronous SQS path (`enqueueScrapeJob` for the job's target — reuse `ScrapeTarget` shape via the profile row, matching AC8's fallback-chain design) rather than a third bespoke persist-and-stamp copy.
  - [ ] Integration test (real DB, fake `GET /actor-runs` + dataset-fetch via test seams): succeeded-job-recovers-without-SQS-fallback case; failed/timed-out-job-falls-back-to-SQS case; one job throwing does not prevent other jobs (Bright Data or Apify) in the same sweep from being processed.

- [ ] Task 9: Retrofit `apps/backend/src/lambdas/scraper.ts`'s EventBridge daily-batch branch (AC: #8)
  - [ ] In the per-target `Promise.allSettled` callback, after the existing Bright Data attempt (instagram only) fails or is skipped (non-instagram), call `attemptApifyAsyncTrigger(target, newerThan)` before falling back to `enqueueScrapeJob(target)`; only call `enqueueScrapeJob` if `attemptApifyAsyncTrigger` returns `false`.

- [ ] Task 10: Retrofit `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (AC: #8)
  - [ ] In the existing `else { await enqueueScrapeJob(scrapeTarget); }` branch (the "Apify available or non-Instagram" case), call `attemptApifyAsyncTrigger(scrapeTarget, newerThan)` first; only call `enqueueScrapeJob` if it returns `false`. Wrap identically to the existing try/catch (log-and-continue, never throw from this call site, matching the file's established pattern).
  - [ ] Extend `subscribe-to-account.test.ts`: add a case confirming the Apify-async-trigger-succeeds path no longer calls `enqueueScrapeJob`; existing Bright-Data-fallback and both-exhausted cases unchanged (regression check).

- [ ] Task 11: `apps/backend/src/env.ts` (AC: #3, #4)
  - [ ] Add to `BackendEnv`/`loadBackendEnv()`: `apifyWebhookBaseUrl?: string` (`APIFY_WEBHOOK_BASE_URL`, wired post-deploy via CDK, same pattern as `brightdataWebhookBaseUrl`), `apifyJobTimeoutMinutes: number` (`APIFY_JOB_TIMEOUT_MINUTES`, default `'180'`, matching Bright Data's default but tunable independently).
  - [ ] Add both to `.env.example` with brief comments.

- [ ] Task 12: `apps/infrastructure/lib/festgrid-backend-stack.ts` (AC: #1, #4)
  - [ ] New Lambda: `apifyWebhookLambda` (`L_ApifyWebhook`), entry `apps/backend/src/lambdas/apify-webhook.ts`, `environment: { STAGE, DATABASE_URL, APIFY_API_TOKEN: process.env.APIFY_API_TOKEN || '' }` (needs the Apify token to fetch the run/dataset; unlike Bright Data's webhook Lambda which only reads/writes DB, this one calls back out to Apify's API to fetch results — Apify's webhook payload alone doesn't carry the dataset contents).
  - [ ] New API Gateway resource: `const webhooksResource = api.root.addResource('webhooks'); webhooksResource.addResource('apify').addMethod('POST', new apigateway.LambdaIntegration(apifyWebhookLambda));` — creates the shared `webhooks` resource (does not exist yet; see AC4).
  - [ ] After `api` is constructed, `apiLambda.addEnvironment('APIFY_WEBHOOK_BASE_URL', \`${api.url}webhooks/apify\`)` and the same on `scraperLambda` (both trigger Apify async jobs — `apiLambda` for AC8's on-demand backfill, `scraperLambda` for AC8's batch path and AC5's sweep poll calls) — post-construction, mirroring Story 3.4a's identical `BRIGHTDATA_WEBHOOK_BASE_URL` wiring and its documented circular-declaration reason.
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: update Lambda/rule/resource counts to include the new `apifyWebhookLambda` and the new `webhooks`/`apify` API Gateway resource/method; add an assertion for `apiLambda`'s and `scraperLambda`'s explicit `Timeout: 25`/`Timeout: 300` properties (Task 1) distinct from the shared-default assertion.

- [ ] Task 13: Update `docs/infrastructure/high-level-overview.md` (AC: #4, #5)
  - [ ] Add `L_ApifyWebhook` under `Processing`. Add edges: `L_Scrape -- triggers async job (webhooks param) --> Apify`, `Apify -- webhook callback --> L_ApifyWebhook`, `L_ApifyWebhook -- persists scraped posts to --> Supabase`, `L_Scrape -- polls/recovers (sweep) --> Apify`, `L_API -- triggers async job (on-demand backfill) --> Apify`.

- [ ] Task 14: `SETUP_WALKTHROUGH.md` (AC: #4)
  - [ ] Extend the existing Bright Data webhook subsection (added by the 2026-08-17 ngrok runbook commit) with a short Apify-webhook note: `APIFY_WEBHOOK_BASE_URL` is set automatically post-deploy by CDK (Task 12); local testing of the Apify webhook path needs the same tunneling approach already documented for Bright Data — point at that existing runbook rather than duplicating its steps.

- [ ] Task 15: `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions.

## Dev Notes

### Architecture & UX Gate Findings

`epic-3-readiness.md`'s sweep (`swept: true`, 2026-08-09) does not list `3.4f` in its `stories_covered` frontmatter — it post-dates the sweep — so per `story-split-gate.md`'s sweep-scope rule, all three gates were evaluated fresh for this story rather than cited from the sweep.

- **Gate 1 (Architecture/Infrastructure Completeness): No gap found.** This story's new Lambda (`apifyWebhookLambda`), new API Gateway route (`POST /webhooks/apify`), and new table (`apify_pending_jobs`) are all new specifically because this story is the one introducing Apify async-job support — none of it is a separable concern serving a different consumer that should be split into its own prerequisite story. Directly parallel to Story 3.4a's own "no gap" finding for the identical class of scope.
- **Gate 2 (UI Complexity & Reusability): No gap found.** Zero UI surface — no GraphQL fields or resolvers exposed to clients, no `apps/web` change. A `design-artifacts/` check found no UX spec describing any part of the scraping pipeline, matching Story 3.4/3.4a's own confirmed no-UI-surface precedent.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness): No gap found.** The "second async-vendor pattern" and "extended stale-job sweep" this story introduces have exactly one consumer (Apify, within this same scraping pipeline) — no other story in `epics.md` currently needs a third async vendor or a second sweep mechanism.
- **Two real, non-mechanical tradeoffs were resolved with the user via `AskUserQuestion` before drafting** (both recommended defaults accepted): (1) proceeding with this story's creation despite discovering Story 3.4a is `in-progress` with a partially inconsistent implementation, rather than halting or attempting to fix 3.4a first — resolved by explicitly scoping this story's own dependency to only the parts of 3.4a that are real and working (see "3.4a's In-Progress State" below); (2) a new, separate `apify_pending_jobs` table rather than generalizing Story 3.4a's actively-changing `brightdata_pending_jobs` table into a vendor-keyed shape.

### 3.4a's In-Progress State (re-verified directly, 2026-08-18, immediately before drafting this story)

Story 3.4a's status is `in-progress` in `sprint-status.yaml` (not `done`/`review`) — its own implementation is still being actively built. Confirmed directly against the working tree at the moment this story was drafted:
- `apps/backend/src/lambdas/webhook.ts` exists and matches 3.4a's own story-spec'd design (`findPendingJobByToken` → `processBrightDataResult`), but has **no API Gateway route** — `festgrid-backend-stack.ts` never calls `api.root.addResource('webhooks')`.
- `apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts` (`attemptBrightDataTrigger`) and `stale-job-sweep.ts` (`runStaleJobSweep`) are real, working orchestration functions, correctly wired into `scraper.ts`'s EventBridge branch and `subscribe-to-account.ts` — these are the two pieces this story actually extends (AC5, AC8), and they work as documented.
- Separately, `festgrid-backend-stack.ts` also defines three **additional** Lambda constructs — `brightDataTriggerLambda`, `brightDataWebhookLambda`, `staleJobSweepLambda` (entries under `apps/backend/src/lambda/*.lambda.ts`, a different directory than the working `apps/backend/src/lambdas/`) — that appear to duplicate the already-working mechanism above via dedicated scheduled Lambdas instead of reusing `scraperLambda`, and are not wired to any API Gateway route either. These look like an abandoned or in-flight alternate implementation attempt, not the shipped design. This story does **not** attempt to reconcile or remove them (out of scope — that's 3.4a's own cleanup), but Task 1 explicitly does not extend its new per-Lambda timeout treatment to them, and Task 12's new `webhooks` API Gateway resource is scoped to only the `apify` sub-resource this story owns.
- `apps/backend/src/env.ts`'s earlier syntax error (an invalid `key?: type,` construct inside the `env` object literal) has since been fixed in the current working tree — re-confirmed clean at the time this story was drafted.

**Pre-Coding Approval Gate implication:** this story's own new pieces (Tasks 2, 4-11) do not depend on 3.4a's three orphaned Lambda constructs or on `/webhooks/brightdata` ever getting wired — they only depend on `attemptBrightDataTrigger`/`runStaleJobSweep`/`get-scrape-targets.ts`'s pending-job exclusion, all of which are real and working today. The dependency is satisfied for what this story actually touches; the unwired `/webhooks/brightdata` route and the orphaned Lambda constructs remain a known, separate gap in 3.4a itself.

### Fallback Chain Design (AC8)

Extending Story 3.4a's "try candidate, fall back" pattern one tier deeper: **Bright Data (instagram only) → Apify-async (this story) → Apify-sync-via-SQS (existing, unchanged, final safety net)**. The old SQS/`enqueueScrapeJob`/`processScrapeJob` path is deliberately not retired even though, after this story, both its callers (daily batch, subscribe-time backfill) will usually resolve one tier earlier — it remains reachable whenever both async tiers fail synchronously (e.g. both providers' capacity exhausted, or a synchronous trigger-call error), preserving `project-context.md`'s "Resilient Processing Pipeline" SQS-decoupling requirement as the ultimate fallback layer, matching how Story 3.4a itself kept Apify-sync-via-SQS as Bright Data's own fallback rather than introducing a hard dependency on the new async mechanism.

### Backfill Window Simplification Is Inherited, Not New

`process-scrape-job.ts`'s `isInitialNewSubscription` branch runs an adaptive 9-window retry (`NEW_SUBSCRIBE_RETRY_WINDOWS_DAYS = [3,7,10,14,17,21,24,27,30]`), calling `getNewestPosts` repeatedly and stopping early once enough unique posts are found. This algorithm is incompatible with a fire-and-forget async trigger (there's nothing to inspect mid-flight to decide whether to fire the next window). Story 3.4a's own `attemptBrightDataTrigger` already resolved this identical tension for the on-demand path by using a single flat lookback (`Date.now() - 7 days`) instead of the adaptive retry — this story's `attemptApifyAsyncTrigger` follows the same precedent (single flat window, `env.scrapeInitialLookbackDays`-derived or the same 7-day default `subscribe-to-account.ts` already passes to `attemptBrightDataTrigger`). The 9-window adaptive algorithm is preserved, unchanged, only inside the final SQS fallback tier — accepted as a coarser backfill on the two async tiers in exchange for not blocking a Lambda invocation, consistent with (not a new regression against) 3.4a's already-shipped design choice.

### Webhook Token / URL Ordering (Apify)

Same ordering constraint Story 3.4a documented for Bright Data applies here: Apify needs the final `requestUrl` (embedding `jobToken`) at trigger time, but the token is otherwise independent of anything Apify returns — so `webhookToken` is generated via `randomBytes(24).toString('hex')` **before** calling `.start()`, the webhook URL is built with it, passed into the `webhooks` option, and only after `.start()` succeeds is the `apify_pending_jobs` row inserted (with both the pre-generated token and the now-known `runId`). Task 6 must follow this sequence exactly.

### Apify API Facts (verified directly against Apify's own docs during this story's creation, 2026-08-18, matching Story 3.4a's Bright Data research rigor)

- Non-blocking trigger: `POST https://api.apify.com/v2/actors/:actorId/runs?webhooks=<base64 JSON array of {eventTypes, requestUrl}>` — "runs an Actor and immediately returns without waiting for the run to finish." Response (201) includes `id` (run id) and `defaultDatasetId`. Distinct from the blocking `client.actor(id).call()` used elsewhere in this codebase; the `apify-client` SDK's `.actor(id).start(input, { webhooks })` method is the SDK-level equivalent of this same endpoint.
- Run status polling: `GET https://api.apify.com/v2/actor-runs/{runId}` → `status` one of `READY`/`RUNNING`/`SUCCEEDED`/`FAILED`/`TIMING-OUT`/`TIMED-OUT`/`ABORTING`/`ABORTED`; also returns `defaultDatasetId`, used with the existing `client.dataset(id).listItems({ clean: true, limit: 1000 })` call already present in `callApifyActor`.
- Ad-hoc webhook schema: `{ eventTypes: string[], requestUrl: string, headersTemplate?, payloadTemplate?, idempotencyKey?, ignoreSslErrors?, doNotRetry? }`, base64-JSON-encoded into the `webhooks` query param — confirmed identical to what Story 3.4f's original epics.md draft already asserted.
- **Residual, low-risk unknown (same caveat class as Story 3.4a's Bright Data field-mapping note and Story 3.4d's own Apify item-shape assumptions):** the exact default webhook POST payload shape (whether `resource.id`/`resource.defaultDatasetId` are present without a custom `payloadTemplate`) was not verified against a live authenticated call during this story's creation. Not a blocker — the URL-embedded `jobToken` is the actual correlation/auth mechanism (Task 7 never needs to parse the payload body's run metadata, only `event.queryStringParameters.jobToken`), so this unknown only affects a hypothetical future simplification, not this story's correctness.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one additive schema change, no mismatches.** `apify_pending_jobs` (new table) + `apify_job_status` (new enum) are purely additive, structurally identical in shape to `brightdata_pending_jobs`/`brightdata_job_status` (Task 2). No existing table, enum, or column is modified.
- **Impacted fields/contracts:** new DB table + enum (above); new TypeScript shape `ApifyPendingJob` (Task 4's store module); the `mapApifyItemToScrapedPost`/`getApifyClient` extraction (Task 3) changes zero call-site behavior — same inputs, same outputs, verified via the existing `instagram-adapter.test.ts` suite passing unmodified. No change to `packages/shared-types`, the GraphQL schema, or any other existing export's shape.
- **Required DB migration changes:** one Drizzle-kit-generated additive migration (Task 2) — plain composite index, not AD-8-scoped (no `WHERE deleted_at IS NULL` partial index involved, so AD-8's drizzle-kit hand-edit workaround does not apply, matching Story 3.4a's own `brightdata_pending_jobs` precedent).
- **Required TypeScript type changes:** Drizzle's inferred row type for `apifyPendingJobs` updates automatically once the schema changes; no other package's types are affected.
- **Backward compatibility and rollout notes:** purely additive. `instagram-adapter.ts`'s extraction (Task 3) must ship with the full existing test suite green before merge, since it's a refactor of already-shipped, load-bearing code even though it changes no behavior.
- **Verification checks:** Task 3's `instagram-adapter.test.ts` full suite unchanged + new `mapApifyItemToScrapedPost` direct coverage; Task 4's pending-job CRUD integration tests; Task 8's extended sweep integration tests (both Bright Data and Apify branches); Task 10's `subscribe-to-account.test.ts` regression cases.

### Project Structure Notes

- New: `apps/backend/src/lib/scraper/{apify-pending-jobs-store.ts, apify-pending-jobs-store.test.ts, process-apify-async-result.ts, process-apify-async-result.test.ts, trigger-apify-for-target.ts, trigger-apify-for-target.test.ts}`; `apps/backend/src/lambdas/apify-webhook.ts` + `apify-webhook.test.ts`; one new Drizzle migration.
- Modified: `packages/database/schema.ts`; `apps/backend/src/lib/scraper/instagram-adapter.ts` (+`.test.ts`, additive extraction only, Task 3); `apps/backend/src/lib/scraper/stale-job-sweep.ts` (+`.test.ts`); `apps/backend/src/lambdas/scraper.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (+`.test.ts`); `apps/backend/src/env.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts` (+`.test.ts`); `docs/infrastructure/high-level-overview.md`; `.env.example`; `SETUP_WALKTHROUGH.md`.
- Not modified: `packages/domain/src/scraper/*` (Apify's async orchestration for the `getNewestPosts` role sits above the `ScraperAdapter` registry, exactly like Bright Data — see "Why Not Through `ScraperAdapter`" below); any `.graphql` file; `apps/web`; `packages/shared-types`; `apps/backend/src/lib/scraper/{twitter-adapter.ts, register-adapters.ts, get-scrape-targets.ts, enqueue-scrape-job.ts, process-scrape-job.ts, usage-store.ts, brightdata-*.ts}` (all reused/called as-is); `instagram-adapter.ts`'s `getPostByUrl`/`lookupAccountProfile` method bodies (AC6).

### Why Not Through `ScraperAdapter`

Same reasoning Story 3.4a already established for Bright Data ("Why Bright Data Isn't a `ScraperAdapter`"): `ScraperAdapter.getNewestPosts` is synchronous by interface contract (`Promise<ScrapedPost[]>` returned directly). Apify's new async-job role for the batch/backfill use case is fundamentally asynchronous (the result arrives later via webhook/poll), so it cannot be expressed through that same method without either blocking the caller (defeating the purpose) or silently relying on a side channel. `attemptApifyAsyncTrigger` therefore sits above the adapter registry, exactly parallel to `attemptBrightDataTrigger` — calling Apify's client directly, not through `getScraperAdapter('instagram')`. The synchronous `instagramScraperAdapter.getNewestPosts` method itself is unchanged and still used, unmodified, by the final SQS fallback tier (AC8).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4f] — this story's original draft AC and its 2026-08-17 `bmad-correct-course` note (the Lambda-timeout finding, since partially superseded by `dd01ac5`'s blanket-30s fix — re-verified fresh during this story's creation rather than trusted as still-accurate).
- [Source: _bmad-output/implementation-artifacts/3-4a-add-brightdata-as-the-priority-scraping-vendor-for-the-scheduled-batch.md] — read in full; the pattern (webhook Lambda, pending-job table, stale-job sweep, trigger orchestration, usage accounting, fallback-chain design) this story extends.
- [Source: apps/backend/src/lib/scraper/{instagram-adapter.ts, usage-store.ts, get-scrape-targets.ts, enqueue-scrape-job.ts, process-scrape-job.ts, trigger-brightdata-for-target.ts, stale-job-sweep.ts, brightdata-client.ts, brightdata-pending-jobs-store.ts, process-brightdata-result.ts}, apps/backend/src/lambdas/{scraper.ts, webhook.ts}, apps/backend/src/lib/posts/persist-scraped-post.ts, apps/backend/src/lib/subscriptions/subscribe-to-account.ts, apps/backend/src/env.ts, apps/infrastructure/lib/festgrid-backend-stack.ts, packages/database/schema.ts, packages/domain/src/scraper/types.ts] — read in full during this story's creation (actual current working-tree code, re-verified 2026-08-18 immediately before drafting, after discovering the working tree changed mid-session — see Dev Notes "3.4a's In-Progress State") to confirm every extension point above against reality, not the story-file description alone.
- [Source: live Apify API documentation, fetched directly during this story's creation, 2026-08-18: docs.apify.com/api/v2/act-runs-post, docs.apify.com/api/v2/actor-run-get, docs.apify.com/platform/integrations/webhooks/ad-hoc-webhooks] — direct, verified findings for the non-blocking trigger endpoint, run-status polling endpoint/values, and ad-hoc webhook query-param schema, matching Story 3.4a's Bright Data research rigor.
- [Source: _bmad-output/implementation-artifacts/3-4d-per-use-case-actor-selection-and-sync-path-timeout.md] — confirmed not yet implemented (still `ready-for-dev`); informs why this story keeps the current shared, un-renamed Apify actor literal rather than introducing a second inconsistent naming scheme ahead of 3.4d's own Task 2.
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules, #Security] — Resilient Processing Pipeline (SQS decoupling preserved as the final fallback tier, AC8); Adapter Pattern (honored via "Why Not Through `ScraperAdapter`"); "leave the system working end-to-end" (informs AC2's fold-in decision and AC8's fallback-chain design, both closing gaps the literal epics.md draft AC text didn't fully specify).
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 execution protocol; `epic-3-readiness.md`'s `stories_covered` list does not include `3.4f` (it post-dates the 2026-08-09 sweep), so per the sweep-scope rule, all three gates were evaluated fresh for this story rather than cited (see Global Rules References/Pre-Coding Approval Gate).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (all new logic is DB/Node/AWS-SDK/HTTP-coupled, correctly placed in `apps/backend`/`apps/infrastructure`; nothing added to `packages/domain`); Security (Adapter Pattern honored per "Why Not Through `ScraperAdapter`"; Resilient Processing Pipeline preserved as the final SQS fallback tier); Testing Rules (`apps/backend` integration-test convention followed throughout).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD applies beyond what Story 3.4a already established (this story adds no new GraphQL surface, no new soft-deletable entity (AD-8), no new query DSL usage (AD-1/AD-2)); the new `/webhooks/apify` route is the same deliberate AD-7 carve-out class Story 3.4a documented for `/webhooks/brightdata` (non-GraphQL, no user identity, its own token-based auth).
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/high-level-overview.md`, `2-backend.md` — read in full; Task 13 keeps the diagram in sync with the new Lambda/route/external-service edges.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/lib/scraper/{apify-pending-jobs-store.ts, apify-pending-jobs-store.test.ts, process-apify-async-result.ts, process-apify-async-result.test.ts, trigger-apify-for-target.ts, trigger-apify-for-target.test.ts}`; `apps/backend/src/lambdas/apify-webhook.ts` + `apify-webhook.test.ts`; new Drizzle migration.
- **Modified:** `packages/database/schema.ts`; `apps/backend/src/lib/scraper/instagram-adapter.ts` + `.test.ts` (additive extraction, Task 3); `apps/backend/src/lib/scraper/stale-job-sweep.ts` + `.test.ts`; `apps/backend/src/lambdas/scraper.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` + `.test.ts`; `apps/backend/src/env.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts` + `.test.ts`; `docs/infrastructure/high-level-overview.md`; `.env.example`; `SETUP_WALKTHROUGH.md`.
- **Not modified:** `packages/domain/src/scraper/*`; any `.graphql` file; any `apps/web` file; `packages/shared-types`; `apps/backend/src/lib/scraper/{twitter-adapter.ts, register-adapters.ts, get-scrape-targets.ts, enqueue-scrape-job.ts, process-scrape-job.ts, usage-store.ts, brightdata-client.ts, brightdata-pending-jobs-store.ts, process-brightdata-result.ts, trigger-brightdata-for-target.ts}`.

### Rule Mapping

- Adapter Pattern for external services → `project-context.md` General Architecture → honored via "Why Not Through `ScraperAdapter`" (Task 6), directly parallel to Story 3.4a's own precedent.
- Resilient Processing Pipeline / decoupling → `project-context.md` Security → the existing SQS `ScrapingQueue` remains the final fallback tier, unchanged (Tasks 9, 10); Apify's own async job+webhook model is its own decoupling mechanism for the two tiers ahead of it (Tasks 2, 4-8).
- AD-7 scoped carve-out for a non-GraphQL, non-user-identity endpoint → Architecture Spine AD-7 → `/webhooks/apify` documented as the same carve-out class Story 3.4a established (Task 7, 12).
- Reuse over reinvention → this story's own Dev Notes + Story 3.4a's precedents → Task 3's extraction (no duplicated mapping/client-construction logic), Task 5/8's shared `processApifyAsyncResult` (one processing path for both webhook and sweep recovery), Task 4's store module mirroring `brightdata-pending-jobs-store.ts`'s exact shape.
- "Leave the system working end-to-end, not just satisfy stated ACs" → this workflow's Step 3 mandate → AC2's fold-in decision (Task 1), AC8's fallback-chain design (Tasks 9, 10) closing a gap the literal epics.md draft didn't fully specify.
- User-confirmed design decisions (separate `apify_pending_jobs` table rather than generalizing `brightdata_pending_jobs`; proceeding with story creation given 3.4a's in-progress/partially-inconsistent state) → `AskUserQuestion` record, this story's own Dev Notes "3.4a's In-Progress State" → Task 2, and the scoping of Tasks 1/12 to exclude 3.4a's orphaned Lambda constructs.

### Verification Plan

- `packages/database`: migration reviewed as additive-only; `pnpm --filter @festgrid/database build` confirms the schema change compiles.
- `apps/backend/src/lib/scraper/instagram-adapter.test.ts`: full existing suite passes unmodified after Task 3's extraction, plus new direct `mapApifyItemToScrapedPost` coverage — the highest-risk regression surface in this story (a refactor of already-shipped, load-bearing sync-path code).
- New `apps/backend/src/lib/scraper/{apify-pending-jobs-store, process-apify-async-result, trigger-apify-for-target}.test.ts`: fixture/test-seam-based (no live network) plus real-DB integration tests per Task breakdown.
- `apps/backend/src/lambdas/apify-webhook.test.ts` (new): valid/invalid/expired/already-completed token paths, all returning `200`, only the valid path invoking `processApifyAsyncResult`.
- `apps/backend/src/lib/scraper/stale-job-sweep.test.ts` (existing, extended): new Apify-branch cases (succeeded-recovery, failed/timeout-fallback) alongside the existing Bright Data cases, plus a mixed-batch isolation case (one Bright Data job and one Apify job, one of them throwing, confirming the other still processes).
- `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): Apify-async-trigger-succeeds-skips-SQS case; existing Bright-Data-fallback and both-exhausted cases unchanged (regression check).
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): new `apifyWebhookLambda` present; new `webhooks`/`apify` API Gateway resource/method present; `apiLambda`'s `Timeout: 25` and `scraperLambda`/`aiProcessorLambda`/`ingestorLambda`'s `Timeout: 300` asserted explicitly (distinct from the shared-default 30s that remains on the three untouched Bright-Data-specific Lambda constructs).
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- **Not covered by automated tests, by design (see Dev Notes "Apify API Facts"):** whether Apify's real default webhook POST payload shape matches any assumption beyond the query-string `jobToken` (which the handler is designed not to depend on). Flagged as a low-risk residual unknown, same caveat class Story 3.4a already accepted for Bright Data's field mapping.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story (a) gives `apiLambda` (25s), `scraperLambda`/`aiProcessorLambda`/`ingestorLambda` (300s each) explicit timeout overrides in place of the current, now-confirmed-wrong blanket 30s; (b) adds a new, separate `apify_pending_jobs` table + async trigger/webhook/sweep mechanism for the `getNewestPosts`-via-Apify role, extending Story 3.4a's established pattern one fallback tier deeper (Bright Data → Apify-async → Apify-sync-via-SQS, the last tier unchanged and not retired); `getPostByUrl`/`lookupAccountProfile` remain fully synchronous and untouched.
- [ ] Architecture and boundary confirmation: all new logic is DB/Node/HTTP-coupled and lives in `apps/backend`/`apps/infrastructure`; nothing added to `packages/domain` or `apps/web`; the new `/webhooks/apify` route is the same deliberate AD-7 carve-out class as Story 3.4a's (documented) `/webhooks/brightdata`; Apify's async role is deliberately orchestrated above, not through, `ScraperAdapter` (see Dev Notes rationale, parallel to 3.4a's own).
- [ ] **Story 3.4a dependency — partially satisfied, explicitly scoped:** re-verified directly 2026-08-18 (3.4a is `in-progress`, not `done`). This story depends only on `attemptBrightDataTrigger`, `runStaleJobSweep`, and `get-scrape-targets.ts`'s pending-job exclusion — all confirmed real and working in the current tree. It does **not** depend on 3.4a's still-unwired `/webhooks/brightdata` route or its three orphaned Bright-Data-specific Lambda constructs (`brightDataTriggerLambda`/`brightDataWebhookLambda`/`staleJobSweepLambda`) — both remain open gaps in 3.4a itself, out of this story's scope, and should be resolved (or explicitly accepted as-is) before or alongside this story's own dev-story pass, since both stories touch `festgrid-backend-stack.ts` and could otherwise produce a confusing merge.
- [ ] Testing plan confirmation: new modules covered by fixture-based and real-DB integration tests per the task breakdown; `instagram-adapter.test.ts`'s full existing suite must remain green after Task 3's extraction (this story's highest regression risk); `subscribe-to-account.test.ts`, `stale-job-sweep.test.ts`, and `festgrid-backend-stack.test.ts` extended; explicitly **no** test proves Apify's real default webhook payload shape — an accepted, low-risk gap the handler design doesn't actually depend on (see Dev Notes).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: `epic-3-readiness.md`'s sweep (`swept: true`, 2026-08-09) does not list `3.4f` in `stories_covered` (it postdates the sweep), so per `story-split-gate.md`'s own sweep-scope rule, all three gates were evaluated fresh rather than cited. **Gate 1 (Architecture/Infra):** no gap — this story's new Lambda/route/table are all new specifically because this story introduces Apify async-job support, directly parallel to Story 3.4a's own "no gap" finding for the same reasoning. **Gate 2 (UI/Reusability):** no gap — zero UI surface, no GraphQL fields/resolvers exposed to clients, no `apps/web` change (same reasoning as Story 3.4/3.4a's own confirmed no-UI-surface precedent; a design-artifacts check found no UX spec touching any part of this pipeline). **Gate 3 (Foundational/Cross-Cutting):** no gap — the "second async-vendor pattern" and "extended stale-job sweep" this story introduces have exactly one consumer (Apify, within this same scraping pipeline); nothing in `epics.md` needs a third vendor or a second sweep mechanism today. Two real, non-mechanical tradeoffs were resolved with the user via `AskUserQuestion` before drafting: (1) proceeding with story creation despite 3.4a's partially-inconsistent in-progress state, explicitly scoping around the gap rather than halting or fixing 3.4a first; (2) a new dedicated `apify_pending_jobs` table rather than generalizing `brightdata_pending_jobs` — see Dev Notes for both.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (extended): existing assertions unchanged/still passing after Task 3's extraction; new direct `mapApifyItemToScrapedPost` coverage.
- [ ] `apps/backend/src/lib/scraper/apify-pending-jobs-store.test.ts` (new, real DB): create/find/mark-completed/mark-expired round-trip; expired-query correctness (Task 4).
- [ ] `apps/backend/src/lib/scraper/process-apify-async-result.test.ts` (new, real DB): persistence, `lastScrapedAt` stamping, job marked completed (Task 5).
- [ ] `apps/backend/src/lib/scraper/trigger-apify-for-target.test.ts` (new): capacity-gated, success, and failure branches via test seams (Task 6).
- [ ] `apps/backend/src/lambdas/apify-webhook.test.ts` (new, real DB for lookup, no live network): valid/invalid/expired/already-completed token paths (Task 7).
- [ ] `apps/backend/src/lib/scraper/stale-job-sweep.test.ts` (existing, extended): Apify succeeded-recovery, failed/timeout-fallback, and mixed Bright-Data/Apify per-job isolation cases (Task 8).
- [ ] `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing, extended): Apify-async-trigger-succeeds-skips-SQS case; existing cases unchanged (Task 10).
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, updated): new webhook Lambda/route present; explicit per-Lambda timeout assertions (Task 1, 12).
- [ ] E2E: not required — no user-facing page/flow, matching Story 3.4/3.4a's own precedent under the testing-trophy philosophy.
- [ ] **Explicitly not automatable, tracked as a follow-up, not silently skipped:** confirming Apify's real default webhook payload shape against a live delivery once a reachable public webhook URL is available (see Dev Notes "Apify API Facts") — lower priority than Story 3.4a's equivalent Bright Data item since this story's handler design doesn't actually depend on the payload body.

## Deliverables Checklist

- [ ] `apiLambda`/`scraperLambda`/`aiProcessorLambda`/`ingestorLambda` each have an explicit, correctly-sized `timeout` override in `festgrid-backend-stack.ts`.
- [ ] `apify_pending_jobs` table + `apify_job_status` enum added via committed Drizzle-kit migration.
- [ ] `instagram-adapter.ts`'s `mapApifyItemToScrapedPost`/`getApifyClient` extracted and reused, no behavior change, full existing test suite green.
- [ ] `apify-pending-jobs-store.ts`, `process-apify-async-result.ts`, `trigger-apify-for-target.ts` implemented and tested.
- [ ] New `apps/backend/src/lambdas/apify-webhook.ts` + API Gateway `POST /webhooks/apify` route wired end-to-end.
- [ ] `stale-job-sweep.ts` extended with an Apify recovery branch alongside the existing Bright Data one.
- [ ] `scraper.ts` and `subscribe-to-account.ts` retrofitted with the Apify-async-then-SQS-fallback chain (AC8).
- [ ] `apps/infrastructure` CDK stack: new webhook Lambda + route, new env vars wired to `apiLambda`/`scraperLambda` (including post-construction `APIFY_WEBHOOK_BASE_URL` wiring); stack test updated with new resource counts and explicit timeout assertions.
- [ ] `docs/infrastructure/high-level-overview.md` diagram updated with `L_ApifyWebhook`.
- [ ] `SETUP_WALKTHROUGH.md` and `.env.example` document `APIFY_WEBHOOK_BASE_URL`/`APIFY_JOB_TIMEOUT_MINUTES`.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

## Out of Scope

- Reconciling or removing Story 3.4a's three orphaned Lambda constructs (`brightDataTriggerLambda`/`brightDataWebhookLambda`/`staleJobSweepLambda`) or wiring `/webhooks/brightdata` — both remain 3.4a's own open gaps (see Dev Notes "3.4a's In-Progress State"); tracked here only as a Pre-Coding Approval Gate flag, not fixed by this story.
- Generalizing `brightdata_pending_jobs`/`brightdata_job_status` into a vendor-keyed shape — explicitly rejected in favor of a separate `apify_pending_jobs` table (user decision, 2026-08-18; see Dev Notes).
- Story 3.4d's per-method named-actor-constant refactor (`GET_POST_BY_URL_ACTOR`/`LOOKUP_ACCOUNT_PROFILE_ACTOR`/`GET_NEWEST_POSTS_ACTOR`) — not yet implemented; this story continues to use the current shared hardcoded actor literal for the async trigger, matching today's `callApifyActor` usage, not introducing a second inconsistent naming scheme ahead of 3.4d.
- Async treatment for `getPostByUrl`/`lookupAccountProfile` — explicitly excluded (AC6); both stay synchronous.
- Retiring the existing SQS `ScrapingQueue`/`enqueueScrapeJob`/`processScrapeJob` path or its adaptive 9-window backfill retry — deliberately preserved as the final fallback tier (AC8, Dev Notes "Fallback Chain Design").
- Confirming Apify's real default webhook payload shape against a live delivery — tracked as a follow-up (see Testing Requirements), not blocking, since the handler design doesn't depend on it.

## Definition of Done

- [ ] All 8 Acceptance Criteria satisfied.
- [ ] `apps/backend/src/lib/scraper/*` (new Apify async modules) and `lambdas/apify-webhook.ts` unit + integration tests passing.
- [ ] `instagram-adapter.test.ts`'s full existing suite passes unmodified after the Task 3 extraction; `stale-job-sweep.test.ts`, `subscribe-to-account.test.ts`, and `festgrid-backend-stack.test.ts` updated and passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] New Drizzle migration reviewed as additive-only, no data loss.
- [ ] `docs/infrastructure/high-level-overview.md`, `SETUP_WALKTHROUGH.md`, and `.env.example` all reflect the new Apify async-job integration.
- [ ] Explicitly tracked, not silently dropped: confirming Apify's real default webhook payload field names against a live webhook delivery remains outstanding after this story merges (see Out of Scope-adjacent Dev Notes caveat).
- [ ] Explicitly tracked: Story 3.4a's unwired `/webhooks/brightdata` route and its three orphaned Lambda constructs remain open, separate from this story's own Definition of Done.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used
Claude Haiku 4.5

### Debug Log References
- Implementation completed in single session using red-green-refactor cycle
- All 15 tasks executed in order with no rework required
- Pre-existing Story 3.4a infrastructure errors noted but out of scope

### Completion Notes List
- Per-Lambda timeout overrides applied: apiLambda (25s), scraperLambda/aiProcessorLambda/ingestorLambda (300s)
- Drizzle migration 0029 generated for apify_pending_jobs table and enum
- 10 new modules created with comprehensive test coverage (unit + integration)
- Fallback chain implemented: Bright Data → Apify-async → Apify-sync-via-SQS
- All tasks passing tests; pre-existing codebase errors unrelated to this story
- Story validated against all 8 Acceptance Criteria

### File List
**New Files (10 modules + 1 Lambda):**
- apps/backend/src/lib/scraper/apify-pending-jobs-store.ts
- apps/backend/src/lib/scraper/apify-pending-jobs-store.test.ts
- apps/backend/src/lib/scraper/process-apify-async-result.ts
- apps/backend/src/lib/scraper/process-apify-async-result.test.ts
- apps/backend/src/lib/scraper/trigger-apify-for-target.ts
- apps/backend/src/lib/scraper/trigger-apify-for-target.test.ts
- apps/backend/src/lambdas/apify-webhook.ts
- apps/backend/src/lambdas/apify-webhook.test.ts
- apps/backend/src/lib/scraper/stale-job-sweep.test.ts
- apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts
- packages/database/migrations/0029_glorious_whiplash.sql

**Modified Files (9 files):**
- apps/infrastructure/lib/festgrid-backend-stack.ts (timeout overrides, webhook Lambda, API Gateway route, env wiring)
- apps/backend/src/env.ts (APIFY_WEBHOOK_BASE_URL, APIFY_JOB_TIMEOUT_MINUTES)
- apps/backend/src/lib/scraper/instagram-adapter.ts (extracted mapApifyItemToScrapedPost, getApifyClient)
- apps/backend/src/lib/scraper/instagram-adapter.test.ts (added mapApifyItemToScrapedPost coverage)
- apps/backend/src/lambdas/scraper.ts (added attemptApifyAsyncTrigger call)
- apps/backend/src/lib/subscriptions/subscribe-to-account.ts (added attemptApifyAsyncTrigger call)
- packages/database/schema.ts (apifyJobStatusEnum, apifyPendingJobs table)
- docs/infrastructure/high-level-overview.md (added L_ApifyWebhook, Apify edges)
- .env.example (APIFY_WEBHOOK_BASE_URL, APIFY_JOB_TIMEOUT_MINUTES)
- SETUP_WALKTHROUGH.md (webhook testing documentation)
