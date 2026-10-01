---
title: 'Backend resiliency batch: BUG-015, FIND-020, FIND-017, IDEA-015'
type: 'bugfix'
created: '2026-09-18T02:58:55Z'
status: 'draft'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four unrelated but neighboring backend/infra resiliency gaps, each already triaged: (1) BUG-015 — `selectPostsForExtraction`'s enqueue loop has no partial-failure tracking, now a live risk since the IAM fix makes sends actually succeed; (2) FIND-020 — the scraper audit-trail alert can fire unbounded duplicate emails during a sustained outage, and duplicates an existing moderator-notify pattern; (3) FIND-017 — 2 of its 3 sub-gaps are addressable now (pending-job FKs block profile deletion via `ON DELETE no action`; the IAM-grant regression test only covers one past incident, not the general class, and `apiLambda` carries an unused/ungranted `DATA_INGESTION_QUEUE_URL` env var); (4) IDEA-015 — no empirical answer exists for whether batching multiple accounts into one scrape request is cheaper/faster than one request per account.

**Approach:** Fix each independently, minimal-diff, reusing existing patterns in-repo rather than inventing new ones (Promise.allSettled for partial-failure tracking, the existing DB-backed cooldown pattern from `scraper-provider-health-store.ts`, Drizzle's standard `onDelete` migration flow, a generalized CDK stack assertion, and the `apify-smoke-test.sh` standalone-script convention).

## Boundaries & Constraints

**Always:**
- Preserve existing test behavior: `extraction.test.ts`'s single-post-success and pre-loop-FORBIDDEN tests must keep passing unmodified.
- FIND-020's cooldown state must be DB-persisted (Lambda has no durable in-memory state across invocations/concurrency).
- FIND-017 Gap 1: match the existing cascade convention already used elsewhere in `schema.ts` (e.g. `events`, `users`) — `{ onDelete: 'cascade' }` via `drizzle-kit generate`, never hand-edit a migration file.
- IDEA-015's script must make ZERO writes to the app DB and must not import `attemptApifyAsyncTrigger`/`attemptBrightDataTrigger` directly (those have DB side effects) — call vendor REST APIs directly, mirroring `scripts/apify-smoke-test.sh`.

**Ask First:**
- If Bright Data's `datasets/v3/trigger` endpoint rejects a multi-element `input` array outright (confirms batching isn't supported there) — surface it as a research finding, don't silently pivot scope.

**Never:**
- Do NOT touch the scraper-audit-trail alert's DB-dependency issue (moderator lookup depends on the same DB it may be reporting on) — already deferred as an explicit product decision (out-of-band CloudWatch+SNS channel previously rejected by the user for a sibling alert).
- Do NOT implement FIND-017 Gap 2 (real Apify `GET /v2/users/me/limits` capacity check) — needs a persistence shape, refresh policy, and error-handling design; explicitly out of scope for this pass, stays deferred.
- Do NOT change `selectPostsForExtraction`'s GraphQL return type (`[Post!]!`) — no schema change in this batch.
- IDEA-015's script must not spend beyond a small sample account set; must gate any real-money-triggering call behind an explicit confirmation flag (mirror `apify-smoke-test.sh`'s `--yes`/dry-run gate).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| BUG-015 partial failure | 3 postIds, 2nd `enqueuePostForProcessing` throws | Returns Posts for the 2 that succeeded; failure logged with postId+error | Zero successes → throws mapped GraphQLError as before |
| FIND-020 cooldown active | `sendScraperAuditAlert` called twice for same `source` within cooldown window | 2nd call sends no email, logs "throttled" | N/A |
| FIND-020 cooldown expired | Same `source`, 2nd call after cooldown window | 2nd call sends normally, updates `lastSentAt` | N/A |
| FIND-017 FK cascade | Delete a `social_media_account_profiles` row with existing pending-job/actor-run rows | Delete succeeds; child rows removed | N/A (previously blocked) |
| FIND-017 IAM generic test | A future Lambda env var references a queue/secret with no matching grant | Test fails, naming the offending Lambda+var | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/schema/resolvers.ts:1984-1996` -- `selectPostsForExtraction`'s sequential enqueue loop; rework to `Promise.allSettled`.
- `apps/backend/src/schema/extraction.test.ts` -- add partial-failure test; keep existing 2 tests green.
- `apps/backend/src/lib/notifications/send-scraper-audit-alert.ts` -- add cooldown check + `getModeratorEmails()` reuse.
- `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts` -- migrate to `getModeratorEmails()` (dedup).
- `apps/backend/src/lib/notifications/get-moderators.ts` -- existing extraction seam, reuse as-is.
- `apps/backend/src/lib/scraper/scraper-provider-health-store.ts` -- reference pattern for the new cooldown store.
- `packages/database/schema.ts` -- add `scraperAuditAlertState` table; add `{ onDelete: 'cascade' }` to `brightdataPendingJobs.profileId`, `apifyPendingJobs.profileId`, `scraperActorRuns.profileId`.
- `apps/backend/src/env.ts` -- add `SCRAPER_AUDIT_ALERT_COOLDOWN_MINUTES` (default 15).
- `apps/infrastructure/lib/festgrid-backend-stack.ts:279` -- remove unused `DATA_INGESTION_QUEUE_URL` from `apiLambda`'s environment (never read by apiLambda code; confirmed via grep).
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts` -- generalize test 13b into one generic env-var-to-grant walker.
- `scripts/apify-smoke-test.sh` / `.mjs` -- pattern reference for the new IDEA-015 script (do not modify).
- `scripts/scrape-batching-cost-research.sh` + `.mjs` (new) -- IDEA-015 deliverable.
- `apps/backend/src/lib/scraper/usage-store.ts` -- reference for the cost formula the research script reuses.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/backend/src/schema/resolvers.ts` -- replace the sequential for-loop with `Promise.allSettled` over `postIds.map(id => enqueuePostForProcessing(id))`; collect succeeded ids, `console.error` each rejection with `{postId, error}`; return Posts filtered to succeeded ids; if zero succeeded, re-throw using the existing `PostAlreadyExtractedError`/`PostNotFoundError` → GraphQLError mapping (first rejection) -- fixes BUG-015's live partial-failure risk without a schema change.
- [ ] `apps/backend/src/schema/extraction.test.ts` -- add a test: 3 postIds, one rejects mid-batch, assert the other 2 are returned and the failure is logged -- pins the new partial-success contract.
- [ ] `packages/database/schema.ts` -- add `scraperAuditAlertState` table (`source: text primary key`, `lastSentAt: timestamp`); run `pnpm --filter database generate` to produce the migration -- FIND-020 persistence.
- [ ] `apps/backend/src/lib/scraper/scraper-audit-alert-state-store.ts` (new) -- `getLastAlertSentAt(source)` / `markAlertSent(source)`, modeled 1:1 on `scraper-provider-health-store.ts` -- reusable cooldown store.
- [ ] `apps/backend/src/env.ts` -- add `scraperAuditAlertCooldownMinutes` (env `SCRAPER_AUDIT_ALERT_COOLDOWN_MINUTES`, default `15`) -- configurable cooldown, mirrors `SCRAPER_PROVIDER_ALERT_COOLDOWN_DAYS` convention.
- [ ] `apps/backend/src/lib/notifications/send-scraper-audit-alert.ts` -- before sending, check `getLastAlertSentAt(details.source)` against the cooldown window; skip + log "throttled" if within window; on successful send, call `markAlertSent(details.source)`; replace the inline `db.select().from(users)...` with `getModeratorEmails()` -- throttling + dedup, addresses 2 of FIND-020's 3 sub-issues.
- [ ] `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts` -- replace its inline moderator query with `getModeratorEmails()` -- completes the dedup `getModeratorEmails()` was built for.
- [ ] `apps/backend/src/lib/notifications/send-scraper-audit-alert.test.ts` -- add cooldown-active (no send) and cooldown-expired (sends) cases; update existing cases for the `getModeratorEmails()` swap.
- [ ] `packages/database/schema.ts` -- add `{ onDelete: 'cascade' }` to `brightdataPendingJobs.profileId`, `apifyPendingJobs.profileId`, `scraperActorRuns.profileId` FK refs; run `pnpm --filter database generate` -- FIND-017 Gap 1.
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.ts` -- remove the `DATA_INGESTION_QUEUE_URL` line from `apiLambda`'s `environment` block (confirmed unused by apiLambda code) -- FIND-017 Gap 3, closes the one live env-var/grant mismatch the investigation surfaced.
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` -- replace test 13b with a generic test: for every synthesized `AWS::Lambda::Function`, collect env vars referencing a queue's `QueueUrl` or a secret's ARN via `Fn::GetAtt`/`Ref`, and for each producer relationship assert a matching IAM policy statement exists in the synthesized template -- FIND-017 Gap 3, generalizes the one-incident regression test to the whole class DW-088 describes.
- [ ] `scripts/scrape-batching-cost-research.sh` + `scripts/scrape-batching-cost-research.mjs` (new) -- bash driver (arg parsing, `--dry-run`, confirmation gate, `APIFY_API_TOKEN`/`BRIGHTDATA_API_TOKEN`/`BRIGHTDATA_DATASET_ID` from env or repo `.env`) + Node helper that: (a) triggers Apify's `instagram-api-scraper` with N `directUrls` in one call vs N separate 1-element calls; (b) triggers Bright Data's `datasets/v3/trigger` with an N-element `input` array vs N separate single-element calls; (c) polls both to completion; (d) computes cost via `pricePerThousandItemsUsd / 1000 * itemCount` (mirroring `usage-store.ts`) plus, where available, the vendor's own billing fields; (e) writes a Markdown comparison report to `_bmad-output/implementation-artifacts/scrape-batching-research/` -- IDEA-015 deliverable.

**Acceptance Criteria:**
- Given 3 postIds where the 2nd enqueue throws, when `selectPostsForExtraction` runs, then it returns Posts for postIds 1 and 3 and logs the 2nd's failure, without discarding the already-enqueued sends.
- Given all postIds fail to enqueue, when `selectPostsForExtraction` runs, then it throws the same GraphQLError mapping as before (`PostAlreadyExtractedError`/`PostNotFoundError` → typed error; other errors rethrown).
- Given `sendScraperAuditAlert` was called for `source: 'persistUnprocessedPayload'` less than `SCRAPER_AUDIT_ALERT_COOLDOWN_MINUTES` ago, when it's called again for the same source, then no email is sent and `lastAlertSentAt` is unchanged.
- Given the cooldown window has elapsed, when `sendScraperAuditAlert` is called again for the same source, then it sends via `getModeratorEmails()` and updates `lastAlertSentAt`.
- Given a `social_media_account_profiles` row with existing `brightdata_pending_jobs`/`apify_pending_jobs`/`scraper_actor_runs` rows, when that profile row is deleted, then the delete succeeds and the child rows are removed (cascade), not blocked.
- Given the generalized stack test runs against the current `festgrid-backend-stack.ts`, when it walks every Lambda's queue/secret env vars, then it passes with `DATA_INGESTION_QUEUE_URL` removed from `apiLambda` and fails if any future Lambda gets a queue/secret env var with no matching grant.
- Given a sample account set, when `scrape-batching-cost-research.sh` runs against both vendors, then it produces a Markdown report comparing 1-request-per-account vs 1-batched-request cost and latency, without writing to the app DB.

## Design Notes

**FIND-020 scope split:** the backlog note bundles 3 sub-issues (throttling, duplication, DB-dependency). Only the first two are fixed here — the DB-dependency one was explicitly deferred as a product decision in `deferred-work.md` (the user previously rejected an out-of-band CloudWatch+SNS channel for a sibling alert), so it stays out of this batch rather than being silently re-litigated.

**FIND-017 scope split:** of the 3 sub-gaps, Gap 2 (real Apify capacity check via `GET /v2/users/me/limits`) is explicitly NOT attempted — investigation confirmed it needs a persistence shape, refresh policy, and error-handling design that's a separate architectural decision, not a drive-by fix. Gaps 1 and 3 are self-contained and low-risk.

**BUG-015 return-shape tradeoff:** since `[Post!]!` can't carry per-item error detail without a breaking schema change, the client's only signal of partial failure is a shorter-than-requested array plus server-side logs. This is accepted as the minimal fix; a richer per-item result type is a separate, larger change if needed later.

## Verification

**Commands:**
- `pnpm --filter backend test extraction.test.ts` -- expected: all pass including new partial-failure case
- `pnpm --filter backend test send-scraper-audit-alert.test.ts` -- expected: all pass including new cooldown cases
- `pnpm --filter database generate` -- expected: produces new migration file(s) for the cascade FKs and the new table, no manual SQL edits
- `pnpm --filter infrastructure test festgrid-backend-stack.test.ts` -- expected: generalized test passes
- `bash scripts/scrape-batching-cost-research.sh --dry-run` -- expected: runs without hitting vendor APIs, prints planned requests
</content>
