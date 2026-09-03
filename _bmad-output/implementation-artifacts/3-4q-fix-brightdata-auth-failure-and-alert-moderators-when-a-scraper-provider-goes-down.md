# Story 3.4q: Fix Bright Data auth failure and alert moderators when a scraper provider goes down

## Story Details

- Epic: 3
- Story ID: 3.4q
- Status: ready-for-dev

## Story

As a platform operator,
I want a scraper vendor's trigger failures to be surfaced to moderators once they persist for more than a day (not just swallowed to a Lambda console log nobody watches), and the underlying Bright Data credential fixed,
so that a broken vendor integration can't silently degrade 100% of scrape traffic onto a single remaining provider's budget for days without anyone noticing — the way it has been happening in prod.

## Acceptance Criteria

1. **Given** `attemptBrightDataTrigger` ([trigger-brightdata-for-target.ts:64-67](apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts#L64-L67)) catches any error and returns `false`, logging only via `console.error`, **when** every Instagram target in the daily batch fails its Bright Data trigger attempt for `N` consecutive daily runs (`N` configurable via `SCRAPER_PROVIDER_ALERT_THRESHOLD_DAYS`, default `2`), **then** every user with `role = 'moderator'` is emailed a new templated alert — reusing the existing `send-dangerous-report-moderator-alerts.ts` moderator-query-and-email pattern (query `users` where `role = 'moderator'`, send via `sendTemplatedEmail`, `Promise.allSettled` per-recipient), not a new alerting mechanism. A CloudWatch Alarm + SNS approach was considered and explicitly rejected by the user in favor of extending this existing pattern.
2. **And** once sent, the alert respects a cooldown (`SCRAPER_PROVIDER_ALERT_COOLDOWN_DAYS`, default `3`) so a still-down provider doesn't re-page moderators every single day — mirroring `users.lastQuotaWarningEmailSentAt`'s existing cooldown-column precedent (Story 3.10).
3. **And** the specific root cause already found in prod — `BRIGHTDATA_API_TOKEN` (Secrets Manager: `festgrid-brightdata-api-token-prod`) returning `401 Unauthorized` on 100% of trigger attempts on 2026-08-31, 2026-09-01, and 2026-09-02 — is rotated/fixed as part of this story's own Definition of Done. This is an external, manual step against Bright Data's own dashboard, not something committed code can perform or verify on its own; Definition of Done requires confirming a real successful Bright Data trigger in prod afterward (a `brightdata_pending_jobs` row created and completed).
4. **And** this story reviews (not necessarily changes) `SCRAPER_MONTHLY_BUDGET_USD`/`BRIGHTDATA_MONTHLY_BUDGET_USD` given that, while Bright Data was down, 100% of scrape volume was silently funneling through Apify's budget alone instead of being split across both providers as originally designed — the deliverable is a documented sanity check of current thresholds against current account volume, not a blind number change.
5. **And** this story does not remove or weaken the existing silent-fallback-to-Apify behavior in `scraper.ts`'s batch loop (a deliberate resiliency feature) — it only adds the missing observability on top of it, by tallying per-provider attempt/success counts across the batch and persisting them for the health check to read.

## Tasks / Subtasks

- [ ] Task 1: `scraper_provider_health` table + migration (AC: #1, #2)
  - [ ] `packages/database/schema.ts`: add `export const scraperProviderHealth = pgTable('scraper_provider_health', { id: uuid('id').defaultRandom().primaryKey(), provider: text('provider').notNull().unique(), consecutiveFailureDays: integer('consecutive_failure_days').default(0).notNull(), lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }), lastAlertSentAt: timestamp('last_alert_sent_at', { withTimezone: true }), ...timestamps });` — one row per provider (`'brightdata'`, `'apify'`), mirroring `scraper_provider_usage`'s existing shape/precedent. Not in AD-8's soft-delete list (internal health-tracking row, no `deletedAt`, matching `scraper_provider_usage`).
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the Drizzle-kit migration; commit both the migration file and its `meta/` snapshot.

- [ ] Task 2: Instrument `scraper.ts`'s daily batch loop to tally Bright Data attempts/successes (AC: #1, #5)
  - [ ] In [scraper.ts](apps/backend/src/lambdas/scraper.ts)'s EventBridge branch, the per-target `Promise.allSettled` callback currently returns as soon as `attemptBrightDataTrigger` succeeds, so the outer `results` array never exposes whether Bright Data specifically succeeded vs. fell through to Apify. Change each Instagram-target callback to return a small marker (e.g. `{ brightDataAttempted: true, brightDataSucceeded: boolean }` for Instagram targets, `{ brightDataAttempted: false }` for others) instead of `void`, so the loop can tally counts after `Promise.allSettled` resolves — a pure additive change to the return value, no change to the fallback control flow itself (Apify/SQS fallback behavior is untouched, per AC5).
  - [ ] After tallying, call a new `recordProviderHealthCheck('brightdata', { attempted, succeeded })` (Task 3) once per batch run, only when `attempted > 0` (skip the check entirely on a batch with zero Instagram targets, rather than recording a misleading all-succeeded/zero-attempted health check).

- [ ] Task 3: `apps/backend/src/lib/scraper/scraper-provider-health-store.ts` (new) (AC: #1, #2)
  - [ ] Export `recordProviderHealthCheck(provider: string, { attempted, succeeded }: { attempted: number; succeeded: number }): Promise<void>` — upserts the `scraper_provider_health` row: if `succeeded === 0 && attempted > 0` (a full-day failure), increment `consecutiveFailureDays`; otherwise reset it to `0`. Always stamps `lastCheckedAt: new Date()`.
  - [ ] Export `getProvidersNeedingAlert(thresholdDays: number, cooldownDays: number): Promise<{ provider: string; consecutiveFailureDays: number }[]>` — returns rows where `consecutiveFailureDays >= thresholdDays` AND (`lastAlertSentAt IS NULL` OR `lastAlertSentAt < now - cooldownDays`), mirroring `get-users-with-stale-queued-posts.ts`'s existing threshold/cooldown query shape (Story 3.10's precedent).
  - [ ] Export `markProviderAlertSent(provider: string): Promise<void>` — stamps `lastAlertSentAt: new Date()`.
  - [ ] Integration tests (real DB): a batch with 0 successes out of N attempts increments `consecutiveFailureDays`; any success resets it to 0; `getProvidersNeedingAlert` respects both the threshold and the cooldown (a provider past threshold but within cooldown is not returned).

- [ ] Task 4: New email template — `SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT` (AC: #1)
  - [ ] `packages/domain/src/email/types.ts`: add `'SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT'` to `EmailTemplateKey`; add its variables shape to `EmailTemplateVariables`: `{ provider: string; consecutiveFailureDays: number; moderatorReviewUrl: string }` (reusing the existing `moderatorReviewUrl` convention from `DANGEROUS_EVENT_MODERATOR_ALERT`/`DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT`, pointed at `/moderator/tools` — the closest existing operational surface; this story does not build a dedicated scraper-health UI page, see Out of Scope).
  - [ ] `packages/domain/src/email/templates.ts`: add the `SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT` entry (subject/html/text), matching the existing moderator-alert templates' tone and structure exactly.
  - [ ] `packages/domain/src/email/render-template.test.ts`: add a render test for the new template, matching the existing per-template test pattern.

- [ ] Task 5: `apps/backend/src/lib/notifications/send-scraper-provider-down-alerts.ts` (new) (AC: #1, #2)
  - [ ] Export `sendScraperProviderDownAlerts(deps = { sendTemplatedEmail: emailAdapter.sendTemplatedEmail }): Promise<void>` — mirrors `send-dangerous-report-moderator-alerts.ts` exactly: calls `getProvidersNeedingAlert(env.scraperProviderAlertThresholdDays, env.scraperProviderAlertCooldownDays)`; if none, log-and-return; otherwise query `users` where `role = 'moderator'` (reusing the exact same query as the dangerous-report alert — do not duplicate the moderator-lookup logic, extract a small shared `getModeratorEmails()` helper if the duplication would otherwise be exact, per the "reuse over reinvention" rule); for each `(provider, moderator)` pair, `sendTemplatedEmail('SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT', mod.email, { provider, consecutiveFailureDays, moderatorReviewUrl })`; on any successful send for a provider, call `markProviderAlertSent(provider)` once (not once per moderator); `Promise.allSettled` per-recipient with per-failure `console.error`, matching the existing pattern's isolation.
  - [ ] Unit test (`send-scraper-provider-down-alerts.test.ts`, seam-based, mirroring `send-dangerous-report-moderator-alerts.test.ts`): no qualifying provider → no email sent; qualifying provider with zero moderators → logs and returns; qualifying provider with moderators → each moderator emailed, `markProviderAlertSent` called once; a send failure for one moderator doesn't prevent others from being alerted.

- [ ] Task 6: Wire into the existing daily `NotifierLambda` sweep (AC: #1, #2)
  - [ ] `apps/backend/src/lambdas/notifier.ts`: alongside the existing `deps.sendQuotaWarningEmails()` call, add `deps.sendScraperProviderDownAlerts()` (new import, new `deps` entry) — reuses the existing daily `NotifierScheduleRule` (`rate(1 day)`), no new schedule/Lambda.
  - [ ] `notifier.test.ts`: extend to assert `sendScraperProviderDownAlerts` is called; a failure in one of the two calls doesn't prevent the other's Lambda-level error handling from behaving as today (both already run sequentially inside the same try/catch — confirm this doesn't mask a `sendQuotaWarningEmails` failure if `sendScraperProviderDownAlerts` throws first; order and error-isolation should match the existing single-responsibility-per-call pattern, wrapping each call in its own try/catch inside the handler if the current single outer try/catch would otherwise let one silently swallow the other).

- [ ] Task 7: `apps/backend/src/env.ts` + CDK wiring (AC: #1, #2)
  - [ ] Add `scraperProviderAlertThresholdDays: number` (`SCRAPER_PROVIDER_ALERT_THRESHOLD_DAYS`, default `'2'`) and `scraperProviderAlertCooldownDays: number` (`SCRAPER_PROVIDER_ALERT_COOLDOWN_DAYS`, default `'3'`) to `BackendEnv`/`loadBackendEnv()`, matching `queueNotificationThresholdDays`/`queueNotificationCooldownDays`'s existing shape.
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.ts`: no new env wiring strictly required (both have safe code defaults, matching how `QUEUE_NOTIFICATION_THRESHOLD_DAYS` is currently handled on `notifierLambda`) — but for consistency with that existing sibling pattern, add both as explicit passthrough entries (`process.env.SCRAPER_PROVIDER_ALERT_THRESHOLD_DAYS || '2'`, `process.env.SCRAPER_PROVIDER_ALERT_COOLDOWN_DAYS || '3'`) to `notifierLambda`'s `environment` block, alongside the existing `QUEUE_NOTIFICATION_*` entries.
  - [ ] `.env.example`: document both new variables.

- [ ] Task 8: Rotate the Bright Data API token (AC: #3) — **manual, non-code task**
  - [ ] Confirm the current token's status directly against Bright Data's own dashboard/API (outside this repo's scope to automate); generate a fresh token if the existing one is expired/revoked.
  - [ ] Update the `festgrid-brightdata-api-token-prod` secret in AWS Secrets Manager with the new value.
  - [ ] Confirm the Lambda picks up the new value (this stack's existing `SECRETS_SYNCED_AT` mechanism handles propagation — re-deploy or trigger the existing secrets-sync path as needed).
  - [ ] Verify directly in prod: the next daily batch run (or a manual on-demand trigger) produces at least one `brightdata_pending_jobs` row that reaches `COMPLETED` status, and CloudWatch shows no new `401 Unauthorized` "Failed to trigger Bright Data job" lines.

- [ ] Task 9: Budget sanity check (AC: #4) — **documentation task, not necessarily a code change**
  - [ ] Compute, using current subscribed-account volume (query `social_media_account_profiles`/`subscriptions` counts) and each provider's `pricePerThousandItemsUsd`/`monthlyBudgetUsd` defaults (`scraperMonthlyBudgetUsd` default `$5`, `brightdataMonthlyBudgetUsd` default `$7.50`, both currently unset as explicit env vars in prod — relying on code defaults), whether Apify's budget alone (the sole functioning provider during the outage) is likely to be exhausted before Bright Data is restored, given real observed item counts (`scraper_provider_usage.items_used_this_cycle = 12` as of 2026-09-03, cycle resets 2026-09-28).
  - [ ] Record the finding in this story's Dev Notes/Completion Notes (sane as-is, or bump `SCRAPER_MONTHLY_BUDGET_USD`/`BRIGHTDATA_MONTHLY_BUDGET_USD` explicitly in the CDK stack if the check finds current thresholds too tight for realistic dual-provider-down-to-one-provider load) — not a blind number change without the underlying math shown.

- [ ] Task 10: `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions.

## Dev Notes

### Architecture & UX Gate Findings

`epic-3-readiness.md`'s sweep (`swept: true`, 2026-08-09) lists `3.4`/`3.4a` in `stories_covered`, confirming the underlying scraper/vendor-fallback architecture is already fully provisioned. Per `story-split-gate.md`'s lightweight-guard allowance, no subagent Gate 1/2/3 calls were run for this story — reasoning recorded directly:

- **Gate 1 (Architecture/Infrastructure Completeness): No gap found.** The one new table (`scraper_provider_health`) and one new module (`scraper-provider-health-store.ts`) are new specifically because this story introduces provider-health tracking — directly parallel to how `scraper_provider_usage`/`usage-store.ts` were introduced for budget tracking. No separate infra layer (queue, Lambda, API route) is needed: this story deliberately reuses the existing daily `NotifierLambda` schedule (Task 6) rather than adding a new one, and reuses the existing SES/`sendTemplatedEmail` adapter rather than introducing CloudWatch Alarm/SNS (the alternative the user explicitly rejected via `AskUserQuestion`).
- **Gate 2 (UI Complexity & Reusability): No gap found.** Zero new UI surface — the alert email's `moderatorReviewUrl` link points at the existing `/moderator/tools` page (Story 3.12), not a new page this story builds. A `design-artifacts/` check found no UX spec touching any part of the scraping pipeline or moderator alerting.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness): No gap found.** The moderator-query-and-email pattern this story extends (`send-dangerous-report-moderator-alerts.ts`) already exists and already has two consumers (dangerous-report alerts, default-location-change alerts) before this story adds a third — this is exactly the kind of already-established, reusable foundation Gate 3 exists to confirm is *not* being built ad hoc for the first time.
- **One real, non-mechanical tradeoff was resolved with the user via `AskUserQuestion` before drafting:** whether the missing alerting should extend the existing NotifierLambda + SES email pattern, or introduce a new CloudWatch Alarm + SNS topic (more "ops-native"/near-real-time, but a first-of-its-kind pattern in this codebase). The user chose to extend the existing pattern, and specified alerts go to **all moderators** (`role = 'moderator'`), not a single fixed ops address — matching `send-dangerous-report-moderator-alerts.ts`'s existing shape exactly rather than `SYSTEM_ERROR_ALERT`'s single-fixed-address pattern (`resolvers.ts`'s `reportSystemError`/`send-event-notifications.ts`'s `reportErrorSilently`, both of which target one `SYSTEM_ERROR_ALERT_EMAIL` env var, not moderators — confirmed by reading both during this story's creation and deliberately not reused here, since the user's instruction was explicit).

### Root Cause (found during a live production incident investigation, 2026-09-03, via `/bmad-help`)

Confirmed directly against prod CloudWatch logs (`/aws/lambda/FestgridBackendStack-prod-ScraperLambdaprodF94C650-iMFmm3gJwPEO`): every single Bright Data trigger attempt on 2026-08-31, 2026-09-01, and 2026-09-02 (every account, every day) failed identically:

```
Failed to trigger Bright Data job for plazaambarrukmo: Error: Failed to trigger Bright Data job: 401 Unauthorized
```

Confirmed via the production database (read-only queries against `festgrid-database-url-prod`): `brightdata_pending_jobs` has **zero rows ever**, and `scraper_provider_usage` has no `brightdata` row at all (only `apify`) — Bright Data has likely never successfully triggered in prod. The `SECRETS_SYNCED_AT: 2026-08-31T23:17:58.754Z` marker on `scraperLambda`'s environment postdates the earliest observed 401 (`2026-08-31T03:13:37.994Z`), so the token was already invalid before that particular secrets-sync event — this story's Task 8 does not assume the sync event itself is the cause, only that the current token value is bad and needs verification/rotation against Bright Data's own dashboard.

### Why a New Table Rather Than Reusing `scraper_provider_usage`

`scraper_provider_usage` tracks **cost/item-volume** (`itemsUsedThisCycle`, monthly-cycle-scoped) — a different concept from **health** (consecutive full-failure days, alert cooldown). Overloading one table with both concerns would conflate a monthly billing-cycle reset with a consecutive-failure-day counter that needs its own, independent reset-on-success semantics. A small, dedicated `scraper_provider_health` table (mirroring `scraper_provider_usage`'s own one-row-per-provider shape) keeps the two concerns cleanly separated, consistent with the "Shared data-ownership" numbering guidance in `story-split-gate.md` (a small, purpose-specific table rather than repurposing an existing one for a second unrelated concern).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one additive schema change, plus one additive `EmailTemplateKey`/`EmailTemplateVariables` union member.** No existing table, enum, or column is modified.
- **Impacted fields/contracts:** new DB table `scraper_provider_health` (Task 1); new TypeScript shape for its Drizzle-inferred row type; `EmailTemplateKey`/`EmailTemplateVariables` gain `'SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT'` (Task 4) — additive, does not change any existing template's shape.
- **Required DB migration changes:** one Drizzle-kit-generated additive migration (Task 1) — plain unique index on `provider`, not AD-8-scoped (no soft-delete, matching `scraper_provider_usage`'s own precedent).
- **Required TypeScript type changes:** Drizzle's inferred row type for `scraperProviderHealth` updates automatically once the schema changes; `EmailTemplateKey`/`EmailTemplateVariables` updated per Task 4.
- **Backward compatibility and rollout notes:** purely additive; `scraper.ts`'s Task 2 change (marker return value instead of `void` per callback) is additive to the `Promise.allSettled` results array's shape — the existing `failedCount`/`Successfully dispatched` summary logging must continue to work unchanged (verify via existing tests).
- **Verification checks:** Task 3's store-module integration tests; Task 5's alert-dispatch unit tests; Task 4's template-render test.

### Project Structure Notes

- New: `apps/backend/src/lib/scraper/{scraper-provider-health-store.ts, scraper-provider-health-store.test.ts}`; `apps/backend/src/lib/notifications/{send-scraper-provider-down-alerts.ts, send-scraper-provider-down-alerts.test.ts}`; one new Drizzle migration.
- Modified: `packages/database/schema.ts`; `packages/domain/src/email/{types.ts, templates.ts, render-template.test.ts}`; `apps/backend/src/lambdas/{scraper.ts, notifier.ts}` (+`notifier.test.ts`); `apps/backend/src/env.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts` (env passthrough only, Task 7); `.env.example`.
- Not modified: `trigger-brightdata-for-target.ts`'s own fallback/error-swallowing behavior (AC5 — instrumentation is additive, not a control-flow change); `usage-store.ts`/`scraper_provider_usage` (a separate, unrelated concern — see "Why a New Table" above); any `.graphql` file; `apps/web`.

### References

- [Source: apps/backend/src/lib/scraper/trigger-brightdata-for-target.ts] — read in full; the exact `console.error`-only failure path this story adds observability on top of, without modifying.
- [Source: apps/backend/src/lambdas/scraper.ts] — read in full; the `Promise.allSettled` batch loop Task 2 instruments.
- [Source: apps/backend/src/lib/notifications/{send-dangerous-report-moderator-alerts.ts, send-quota-warning-emails.ts, get-users-with-stale-queued-posts.ts}] — read in full; the exact moderator-query/email pattern and the threshold/cooldown query shape this story mirrors.
- [Source: packages/domain/src/email/{types.ts, templates.ts}] — read in full; existing template shapes (`DANGEROUS_EVENT_MODERATOR_ALERT`, `SYSTEM_ERROR_ALERT`) and why `SYSTEM_ERROR_ALERT`'s single-fixed-address pattern was deliberately not reused (user's explicit "all moderators" instruction).
- [Source: packages/database/schema.ts#L169-L175, #L112-L123] — `scraper_provider_usage`'s existing one-row-per-provider shape (mirrored by the new table); `users.role`/`lastQuotaWarningEmailSentAt`'s existing enum/cooldown-column precedents.
- [Source: apps/backend/src/env.ts] — `scraperMonthlyBudgetUsd`/`brightdataMonthlyBudgetUsd`/`scraperUsageCycleDays` defaults informing Task 9's budget sanity check.
- [Source: live prod CloudWatch logs, `/aws/lambda/FestgridBackendStack-prod-ScraperLambdaprodF94C650-iMFmm3gJwPEO`, queried directly 2026-09-03] — the 401 Unauthorized errors across three consecutive days, every account.
- [Source: live prod database, `festgrid-database-url-prod`, queried directly 2026-09-03 (read-only)] — `brightdata_pending_jobs` (zero rows ever), `scraper_provider_usage` (no `brightdata` row), `scraper_provider_usage.items_used_this_cycle = 12` as of query time.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 lightweight-guard reasoning; shared-data-ownership numbering guidance informing "Why a New Table" above.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Security ("Resilient Processing Pipeline" and the existing fallback-to-Apify resiliency behavior, explicitly preserved per AC5); Credential Management (Task 8's token rotation goes through AWS Secrets Manager, matching the existing `festgrid-brightdata-api-token-prod` secret, never hardcoded).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD applies beyond what's already established; no new GraphQL surface, soft-deletable entity (AD-8 — the new table has no `deletedAt`, matching `scraper_provider_usage`'s own precedent), or query DSL usage.
- [x] `docs/infrastructure/index.md`, `2-backend.md` — read; this story adds no new Lambda/queue/route, only a table and reuses the existing `NotifierLambda`/SES pattern.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/lib/scraper/{scraper-provider-health-store.ts, scraper-provider-health-store.test.ts}`; `apps/backend/src/lib/notifications/{send-scraper-provider-down-alerts.ts, send-scraper-provider-down-alerts.test.ts}`; new Drizzle migration.
- **Modified:** `packages/database/schema.ts`; `packages/domain/src/email/{types.ts, templates.ts, render-template.test.ts}`; `apps/backend/src/lambdas/scraper.ts` (+ implicit `scraper.test.ts` if one exists — verify during implementation); `apps/backend/src/lambdas/notifier.ts` + `.test.ts`; `apps/backend/src/env.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts`; `.env.example`.
- **Not modified:** `trigger-brightdata-for-target.ts`'s control flow; `usage-store.ts`; any `.graphql` file; `apps/web`.
- **Non-code (manual):** Bright Data API token rotation in AWS Secrets Manager (Task 8).

### Rule Mapping

- Reuse over reinvention → user's `AskUserQuestion` decision + `story-split-gate.md` → Task 5/6 reuse the existing moderator-alert pattern and daily `NotifierLambda` schedule rather than new infra (Gate 1/3 "no gap" findings above).
- Credential Management (Secrets Manager, never hardcoded) → `project-context.md` Security → Task 8's rotation stays entirely within the existing `festgrid-brightdata-api-token-prod` secret.
- Preserve existing resiliency behavior → this story's own AC5 → Task 2's instrumentation is additive only, no change to the Bright Data → Apify → SQS fallback chain itself.
- User-confirmed design decisions (extend NotifierLambda+email over new CloudWatch Alarm/SNS; alert all moderators, not one fixed address) → `AskUserQuestion` record (this story's own creation, 2026-09-03) → Tasks 4-6's design.

### Verification Plan

- `apps/backend/src/lib/scraper/scraper-provider-health-store.test.ts` (new, real DB): failure/success tallying, threshold+cooldown query correctness (Task 3).
- `apps/backend/src/lib/notifications/send-scraper-provider-down-alerts.test.ts` (new, seam-based): no-qualifying-provider, zero-moderators, multi-moderator, and partial-send-failure cases (Task 5).
- `packages/domain/src/email/render-template.test.ts` (existing, extended): new template renders correctly (Task 4).
- `apps/backend/src/lambdas/notifier.test.ts` (existing, extended): both daily calls invoked; one failing doesn't silently swallow the other (Task 6).
- Manual, post-deploy (Task 8): confirm a real successful Bright Data trigger in prod after token rotation — a `brightdata_pending_jobs` row reaching `COMPLETED`, and no new 401 lines in CloudWatch.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story (a) adds a small `scraper_provider_health` table + store module tracking consecutive full-failure days per provider; (b) instruments `scraper.ts`'s existing batch loop to feed it, without changing the existing Bright Data → Apify → SQS fallback control flow; (c) emails all `role = 'moderator'` users (via the existing `send-dangerous-report-moderator-alerts.ts` pattern, reusing the existing daily `NotifierLambda` schedule) once a provider fails for 2+ consecutive days, with a 3-day cooldown; (d) rotates the actual bad `BRIGHTDATA_API_TOKEN` (manual, non-code); (e) documents a budget sanity check given the Apify-only-load incident.
- [ ] Architecture and boundary confirmation: one new table (no soft-delete, matching `scraper_provider_usage`'s precedent), no new Lambda/queue/API route (reuses `NotifierLambda`); all new logic in `apps/backend`/`packages/domain`, nothing in `packages/domain`'s pure-logic area touching DB/ORM types (the new email template is pure data, matching existing template entries).
- [ ] Testing plan confirmation: new store-module and alert-dispatch tests per Task 3/5; `notifier.test.ts` and `render-template.test.ts` extended; Task 8's rotation verified manually in prod (not unit-testable).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: all three gates evaluated via lightweight guard (no subagent calls) — no gap found on any (see Dev Notes "Architecture & UX Gate Findings"); the existing moderator-alert pattern and daily Notifier schedule this story extends are both already-shipped, real dependencies (Story 3.10, the dangerous-report alert feature), not assumed.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/scraper/scraper-provider-health-store.test.ts` (new, real DB): tally/reset semantics, threshold+cooldown query (Task 3).
- [ ] `apps/backend/src/lib/notifications/send-scraper-provider-down-alerts.test.ts` (new): no-qualifying-provider, zero-moderators, multi-moderator, partial-failure cases (Task 5).
- [ ] `packages/domain/src/email/render-template.test.ts` (existing, extended): new template (Task 4).
- [ ] `apps/backend/src/lambdas/notifier.test.ts` (existing, extended): both daily calls invoked, failure isolation (Task 6).
- [ ] Integration/E2E: not required for the alerting/instrumentation code — no user-facing page/flow (matching Story 3.4/3.4a's own precedent). Task 8's real-world verification is manual, tracked in Definition of Done, not an automated test.

## Deliverables Checklist

- [ ] `scraper_provider_health` table + migration committed.
- [ ] `scraper.ts`'s batch loop tallies Bright Data attempts/successes and calls `recordProviderHealthCheck` once per run, with no change to existing fallback behavior.
- [ ] `scraper-provider-health-store.ts` and `send-scraper-provider-down-alerts.ts` implemented and tested.
- [ ] New `SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT` email template added and rendering correctly.
- [ ] `notifier.ts` sends the new alert alongside the existing quota-warning sweep, on the existing daily schedule.
- [ ] `BRIGHTDATA_API_TOKEN` rotated in Secrets Manager; a real successful Bright Data trigger confirmed in prod.
- [ ] Budget sanity check documented (Task 9), with any resulting threshold changes applied and justified.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

## Out of Scope

- A dedicated in-app scraper-provider-health UI page — the alert email links to the existing `/moderator/tools` page (Story 3.12), not a new surface. If a future story wants a live health dashboard, that's a separate, explicitly new piece of UI scope (Gate 2 would apply then).
- CloudWatch Alarm + SNS-based alerting — explicitly rejected by the user in favor of extending the existing email pattern (see Dev Notes).
- Any change to `trigger-brightdata-for-target.ts`'s or `scraper.ts`'s existing fallback-to-Apify control flow — preserved exactly as-is (AC5).
- Generalizing `scraper_provider_usage` to also carry health data — explicitly rejected in favor of a separate table (see Dev Notes "Why a New Table").
- Automating Bright Data credential rotation itself, or building a token-health self-check beyond the trigger-failure counting this story already does — Task 8 is a one-time manual fix for the currently-known-bad token, not a recurring automated rotation mechanism.

## Definition of Done

- [ ] All 5 Acceptance Criteria satisfied.
- [ ] `scraper-provider-health-store.test.ts`, `send-scraper-provider-down-alerts.test.ts`, `render-template.test.ts`, and `notifier.test.ts` passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] New Drizzle migration reviewed as additive-only, no data loss.
- [ ] `BRIGHTDATA_API_TOKEN` rotated and verified working in prod (a real `brightdata_pending_jobs` row reaching `COMPLETED`, no new 401s in CloudWatch) — tracked explicitly, not silently assumed done because the code shipped.
- [ ] Budget sanity check (Task 9) recorded in Completion Notes, with any resulting env var changes applied.
- [ ] `.env.example` documents the two new `SCRAPER_PROVIDER_ALERT_*` variables.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
