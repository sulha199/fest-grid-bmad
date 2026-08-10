---
baseline_commit: 63afd766260139e0dac905796b87e45967f6536b
---

# Story 3.10: Email notifications for queued posts

## Story Details

- **Epic:** 3
- **Story ID:** 3.10
- **Status:** ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** user,
**I want** to receive an email notification when my subscribed posts are not being processed due to API quota issues,
**So that** I can take action to resolve the problem.

## Acceptance Criteria

1. **Given** a user has one or more active subscriptions (`subscriptions` table, excluding soft-deleted rows via `activeOnly`, Story 0.22),
2. **And** the union of that user's subscribed accounts' posts that are still unprocessed (`posts.isExtracted = false`) and were persisted at least `QUEUE_NOTIFICATION_THRESHOLD_DAYS` days ago (`posts.createdAt`, default: 3 days — PRD FR22's `Y`) totals at least `QUEUE_NOTIFICATION_THRESHOLD_COUNT` posts (default: 3 — PRD FR22's `X`),
3. **And** the user has not already received this warning within the last `QUEUE_NOTIFICATION_COOLDOWN_DAYS` days (default: 7 — new `users.lastQuotaWarningEmailSentAt` column, to avoid re-sending the same warning every time the daily check runs while the condition persists),
4. **When** the daily scheduled check (a new `L_Notifier` Lambda, provisioned as a reserved slot by prerequisite Story 0.27, triggered by an EventBridge rule) runs,
5. **Then** an email is sent to that user via the existing outbound email adapter (Story 0.15, `sendTemplatedEmail`), using the already-shipped `QUOTA_EXHAUSTION_WARNING` template (`packages/domain/src/email/templates.ts`) with `{ userName, queuedPostCount, queuedDays: QUEUE_NOTIFICATION_THRESHOLD_DAYS, apiKeyManagementUrl }`.
6. **And** the email's subject/body follows the already-authored template copy (matching `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.7-email-notification-quota.md`) explaining that subscribed posts are not being processed due to API quota exhaustion and suggesting the user contribute an additional API key, linking to `{webAppBaseUrl}/settings/api-keys`.
7. **And** after a successful send, `users.lastQuotaWarningEmailSentAt` is updated to the current time for that user — an email delivery failure for one user does not update their timestamp (so they are retried on the next run) and does not block sending to any other qualifying user in the same run.
8. **And** thresholds (`QUEUE_NOTIFICATION_THRESHOLD_DAYS`, `QUEUE_NOTIFICATION_THRESHOLD_COUNT`, `QUEUE_NOTIFICATION_COOLDOWN_DAYS`) are configurable via environment variables, per PRD FR22's "thresholds... configurable via environment variables" note.
9. **And** this story ships with no per-user opt-out — every qualifying user receives the email unconditionally, matching the PRD/epics.md AC as written (confirmed via `AskUserQuestion` during this story's creation; `userSettings` has no email-notification-preference field today and none is added by this story).

## Tasks / Subtasks

- [ ] **Task 1 — Add the `lastQuotaWarningEmailSentAt` tracking column (AC: 3, 7):**
  - [ ] Add `lastQuotaWarningEmailSentAt: timestamp('last_quota_warning_email_sent_at', { withTimezone: true })` (nullable) to the `users` table in `packages/database/schema.ts`.
  - [ ] Generate the migration via `drizzle-kit generate` (do not hand-write SQL) — will land as the next sequential file after `packages/database/migrations/0020_boring_longshot.sql`.
  - [ ] Confirm the generated migration contains only the additive, nullable column (no data loss, no backfill needed — `NULL` correctly means "never warned").
- [ ] **Task 2 — Add configurable thresholds to `apps/backend/src/env.ts` (AC: 8):**
  - [ ] Add `queueNotificationThresholdDays: number`, `queueNotificationThresholdCount: number`, `queueNotificationCooldownDays: number` to the `BackendEnv` interface.
  - [ ] Populate them in `loadBackendEnv()`: `parseInt(process.env.QUEUE_NOTIFICATION_THRESHOLD_DAYS || '3', 10)`, `parseInt(process.env.QUEUE_NOTIFICATION_THRESHOLD_COUNT || '3', 10)`, `parseInt(process.env.QUEUE_NOTIFICATION_COOLDOWN_DAYS || '7', 10)` — mirroring the existing `scrapeInitialLookbackDays`-style pattern exactly (including the `eslint-disable-next-line turbo/no-undeclared-env-vars` comment convention).
  - [ ] Add all three vars to root `.env.example` with their defaults documented as comments.
- [ ] **Task 3 — Build the stale-queued-posts query helper (AC: 1, 2, 3):**
  - [ ] Create `apps/backend/src/lib/notifications/get-users-with-stale-queued-posts.ts` exporting `getUsersWithStaleQueuedPosts(thresholdDays: number, thresholdCount: number, cooldownDays: number): Promise<{ userId: string; email: string; name: string | null; queuedPostCount: number }[]>`.
  - [ ] Implement as a Drizzle query joining `users` → `subscriptions` (filtered via `activeOnly(subscriptions)`, Story 0.22) → `posts` (via `subscriptions.accountId = posts.accountId`), filtering `posts.isExtracted = false` and `posts.createdAt <= now() - thresholdDays days`, grouping by user, with a `HAVING COUNT(posts.id) >= thresholdCount`, and additionally filtering out users where `lastQuotaWarningEmailSentAt` is not null and is within `cooldownDays` of now.
  - [ ] This is a hand-written aggregate query (not the Unified Query DSL, AD-1/AD-2, which governs GraphQL-exposed `events` collection queries specifically) — mirrors Story 3.8's `getSubscribersForNotification` and Story 3.9a's direct `posts.isExtracted`-scoped query precedent for internal, non-GraphQL-exposed backend queries.
  - [ ] Write integration tests using a real local Postgres instance (mirroring `get-subscribers-for-notification.test.ts`'s pattern), covering: a user just at the count/day threshold (included), a user below the count threshold (excluded), a user whose posts are recent (below day threshold, excluded), a user within the cooldown window (excluded even though otherwise qualifying), a user past the cooldown window (included), and a user with no subscriptions (excluded).
- [ ] **Task 4 — Build the send-and-mark orchestration service (AC: 4, 5, 6, 7):**
  - [ ] Create `apps/backend/src/lib/notifications/send-quota-warning-emails.ts` exporting `sendQuotaWarningEmails(): Promise<void>`.
  - [ ] Load thresholds via `loadBackendEnv()`, call `getUsersWithStaleQueuedPosts(...)`. If empty, log and return.
  - [ ] For each qualifying user, build `apiKeyManagementUrl` as `` `${loadBackendEnv().webAppBaseUrl}/settings/api-keys` `` (mirroring Story 3.3b's `moderatorReviewUrl` construction pattern), and `userName` as `user.name ?? user.email` (no established userName-fallback precedent exists elsewhere in the codebase; this is a straightforward, low-risk default since `users.name` is nullable).
  - [ ] Call `sendTemplatedEmail('QUOTA_EXHAUSTION_WARNING', user.email, { userName, queuedPostCount: user.queuedPostCount, queuedDays: thresholdDays, apiKeyManagementUrl })` per user, each wrapped in its own `try/catch` so one user's failure never blocks another's (mirroring Story 3.8's per-item exception-safety requirement) — on success, update that user's `lastQuotaWarningEmailSentAt = now()`; on failure, leave it untouched and log the error (Story 0.23's system error reporting foundation, mirroring Story 3.8's precedent) without throwing.
  - [ ] Write integration tests with `sendTemplatedEmail` mocked, verifying: successful send updates `lastQuotaWarningEmailSentAt`, a failed send does not update the timestamp and does not throw out of `sendQuotaWarningEmails()`, and multiple qualifying users are each processed independently (one failure doesn't skip the rest).
- [ ] **Task 5 — Wire into the reserved `L_Notifier` Lambda (AC: 4):**
  - [ ] Fill in `apps/backend/src/lambdas/notifier.ts` (the reserved-slot handler created by prerequisite Story 0.27) to call `sendQuotaWarningEmails()` and return successfully once it resolves.
  - [ ] No IaC/CDK changes are needed in this story — the Lambda resource, its `DATABASE_URL` environment variable, its EventBridge daily schedule rule, and its SES `ses:SendEmail`/`ses:SendRawEmail` IAM grant are all provisioned by Story 0.27; this story is that reserved slot's first real consumer.
  - [ ] Add a lightweight handler test proving `notifier.ts`'s handler invokes `sendQuotaWarningEmails()` exactly once.
- [ ] **Task 6 — Verification & Linting:**
  - [ ] Run `pnpm --filter backend test` and verify all new query/service/handler tests pass.
  - [ ] Run `pnpm build && pnpm lint && pnpm test` at the workspace root to confirm no compilation or regression errors exist across the monorepo.
  - [ ] Run `pnpm --filter @festgrid/database db:generate` (or the project's equivalent script) and confirm the generated migration file matches Task 1's expectations exactly, with no unintended diffs to other tables.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture Completeness): Gap found, split off.** The swept `epic-3-readiness.md` (`swept: true`, dated 2026-08-09) predates this story's own creation and did not evaluate it. Full analysis during this story's own creation found that it needs a new scheduled Lambda with a real SES send permission — but no story provisions one: Story 0.14 (`FestgridBackendStack`) only provisioned the four Lambdas known at its own authoring time (API, Scraper, AI Processor, Ingestor); Story 0.25 (`ready-for-dev`, not yet implemented) reconciles Story 0.15's orphaned `email-identity-stack.ts` SES grant, but scopes it to `L_API`'s own execution role only — it does not and cannot anticipate a Lambda that doesn't exist yet. Confirmed via `AskUserQuestion`: split into new Story 0.27 ("Provision the notifier Lambda's infrastructure and SES send permission") rather than build the Lambda/EventBridge/IAM wiring ad hoc inside this story. This story's own scope is therefore backend application logic only (Tasks 1-6 above); zero CDK/IaC changes.
- **Gate 2 (UI Complexity & Reusability): No gap found.** Confirmed via a fresh Freya-persona subagent pass (the swept report only covers Gate 1/3). This story has zero frontend/UI surface — the "product" is the email itself, whose subject/body copy was already authored and shipped by Story 0.15 as the `QUOTA_EXHAUSTION_WARNING` template, and already validated against the sole authoritative UX spec for this scenario, `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.7-email-notification-quota.md` (email-only page, no web screen). The adjacent in-app "Queue Status" UI is Story 3.9a — a distinct, already-split story, not touched here.
- **Gate 3 (Foundational Completeness): No gap found.** Sourced from the swept `epic-3-readiness.md` (Story 3.10 listed in `stories_covered`, no cross-cutting gap raised) plus this story's own fresh check: the outbound email adapter (Story 0.15, `done`) and its `QUOTA_EXHAUSTION_WARNING` template are fully complete and reserved specifically for this story ("Story 3.10... is its first real caller" per Story 0.15's own Dev Notes). No other foundational dependency is missing.

### De-duplication / re-notification design (confirmed via `AskUserQuestion`)

No "already warned" tracking existed anywhere in the schema before this story (no `notifiedAt`-style column on `posts` or `users`). Since the check runs daily, sending unconditionally every run whenever a user's queued-post count stays over threshold would read as spam. Resolved: a new nullable `users.lastQuotaWarningEmailSentAt` timestamp, with a configurable cooldown (`QUEUE_NOTIFICATION_COOLDOWN_DAYS`, default 7) — a user who is still stuck gets an occasional reminder rather than a daily email, and the timestamp only advances on a *successful* send so a delivery failure doesn't silently suppress a legitimate future warning.

### Per-user opt-out (confirmed via `AskUserQuestion`)

`userSettings` has `pushNotificationsEnabled` but no email-notification equivalent, and the PRD/epics.md AC for this story never mentions an opt-out. Confirmed: ship unconditionally for every qualifying user in this story; an opt-out is explicitly deferred as a future story if requested, not built ad hoc here.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** One new column needed; no incompatibility found elsewhere.
- **Impacted fields/contracts:** `users` table gains `last_quota_warning_email_sent_at` (nullable `timestamp with time zone`).
- **Required DB migration changes:** A `drizzle-kit generate`-produced migration adding the nullable column (Task 1). Purely additive — no backfill required, since `NULL` correctly represents "never warned."
- **Required TypeScript type changes:** None. `lastQuotaWarningEmailSentAt` is a backend-internal scheduling field never exposed via GraphQL or read by the frontend — it does not belong in `packages/shared-types`'s `User` interface (which already omits other backend-internal `users` columns like `role`/`avatarUrl`), consistent with how `apiKeys.usageCycleResetAt`/`scraperProviderUsage` are also DB-only, never modeled in shared types.
- **Backward compatibility and rollout notes:** Additive-only migration; no existing query or resolver reads/writes this column today, so no rollout sequencing risk.
- **Verification checks:** Task 1's migration-generation step plus Task 3/4's integration tests exercising real reads/writes of the new column against a real local Postgres instance.

### Project Structure Notes

- New: `apps/backend/src/lib/notifications/get-users-with-stale-queued-posts.ts` (+ `.test.ts`), `apps/backend/src/lib/notifications/send-quota-warning-emails.ts` (+ `.test.ts`).
- Modified: `apps/backend/src/lambdas/notifier.ts` (filling in prerequisite Story 0.27's reserved-slot handler), `apps/backend/src/env.ts` (new threshold/cooldown vars), `packages/database/schema.ts` (+ generated migration), root `.env.example`.
- No new `packages/domain` logic: the query is inherently DB/ORM-coupled (Drizzle joins/aggregation), which the project's Code Organization rule excludes from `packages/domain`; the remaining decision logic (threshold/cooldown comparisons) is folded directly into the SQL `WHERE`/`HAVING` clauses rather than extracted as a separate pure function, since there is no non-trivial logic left over once the query itself expresses the condition — introducing a one-line pure wrapper here would be a premature abstraction with no second consumer.
- No `packages/ui` or `apps/web` changes — zero frontend surface (Gate 2 finding above).
- No changes to `apps/infrastructure` — all IaC is prerequisite Story 0.27's scope.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.10] — Acceptance criteria and Amendment note (Depends-on updated to add Story 0.27).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.27] — New prerequisite story this story depends on for its Lambda/EventBridge/SES IAM wiring.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md, lines 74-78] — FR22 prose and the `X=3`/`Y=3` configurable-threshold defaults.
- [Source: design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.7-email-notification-quota.md] — Sole authoritative UX spec for this email's copy/scenario; already fully reflected in Story 0.15's shipped `QUOTA_EXHAUSTION_WARNING` template.
- [Source: packages/domain/src/email/types.ts, packages/domain/src/email/templates.ts] — Existing `QUOTA_EXHAUSTION_WARNING` template key and its `{ userName, queuedPostCount, queuedDays, apiKeyManagementUrl }` variable shape, reused as-is by this story.
- [Source: apps/backend/src/lib/email/adapter.ts] — `sendTemplatedEmail` interface this story's orchestration service calls.
- [Source: apps/backend/src/schema/resolvers.ts, lines 358-386] — Story 3.3b's `try/catch`/best-effort email-dispatch precedent this story's per-user error handling mirrors.
- [Source: _bmad-output/implementation-artifacts/3-8-push-notifications-for-extracted-events.md] — Query-helper/orchestration-service/exception-safety task-shape precedent this story's Tasks 3-4 mirror.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.ts, lines 141-145] — `ScraperScheduleRule` EventBridge pattern prerequisite Story 0.27 mirrors for the new `NotifierScheduleRule`.
- [Source: packages/database/schema.ts] — `users`, `subscriptions`, `posts` table definitions this story's query joins against.
- [Source: docs/infrastructure/2-backend.md] — EventBridge "Scheduled Tasks (Cron Jobs)" architecture description.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Adapter Pattern (reuse Story 0.15's `sendTemplatedEmail`, never a raw SES call), Credential Management (`SES_FROM_EMAIL_ADDRESS` unchanged, no new secrets), Code Organization (DB-coupled query stays in `apps/backend`, not `packages/domain`), Testing Rules (testing-trophy integration tests for `apps/backend`).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order followed by this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD directly governs scheduled/cron Lambdas or email (confirmed via grep during research); general Adapter Pattern rule applies instead.
- [x] `docs/infrastructure/2-backend.md`, `docs/infrastructure/index.md` — EventBridge scheduled-Lambda pattern this story's Lambda (provisioned by Story 0.27) follows.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/backend/src/lib/notifications/get-users-with-stale-queued-posts.ts`, `apps/backend/src/lib/notifications/get-users-with-stale-queued-posts.test.ts`, `apps/backend/src/lib/notifications/send-quota-warning-emails.ts`, `apps/backend/src/lib/notifications/send-quota-warning-emails.test.ts`.
  - Modified: `apps/backend/src/lambdas/notifier.ts` (fills in Story 0.27's reserved handler), `apps/backend/src/env.ts` (new threshold/cooldown env vars), `packages/database/schema.ts` (+ generated migration under `packages/database/migrations/`), root `.env.example`.
- **Rule Mapping:**
  - Never a raw SMTP/SES call from feature code → `project-context.md` Adapter Pattern → this story exclusively calls `sendTemplatedEmail` (Task 4).
  - DB schema changes ship as Drizzle-kit generated SQL → `project-context.md` AD-3 rule → Task 1's `drizzle-kit generate` step.
  - Soft-delete-aware queries use `activeOnly`, never hand-written `isNull()` → AD-8 rule 2 (Story 0.22) → Task 3's `subscriptions` join.
  - Configurable thresholds via environment variables → PRD FR22 → Task 2's three new `BackendEnv` fields.
  - DB/ORM-coupled logic stays out of `packages/domain` → `project-context.md` Code Organization rule → Dev Notes' "no new `packages/domain` logic" decision.
- **Verification Plan:**
  - `apps/backend`'s integration tests against a real local Postgres instance proving the query helper's threshold/cooldown boundary conditions (Task 3).
  - `apps/backend`'s mocked-`sendTemplatedEmail` integration tests proving per-user exception safety and correct `lastQuotaWarningEmailSentAt` updates (Task 4).
  - A handler-level test proving `notifier.ts` invokes the orchestration service exactly once (Task 5).
  - `pnpm build && pnpm lint && pnpm test` at the workspace root (Task 6).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build the query helper, orchestration service, and reserved-Lambda handler logic only — zero IaC/CDK changes (all infrastructure is prerequisite Story 0.27's scope) and zero frontend/UI changes (Gate 2: no gap).
- [ ] Architecture and boundary confirmation: DB-coupled query stays in `apps/backend`, not `packages/domain`; email sending exclusively through Story 0.15's `sendTemplatedEmail`; no new SES/AWS SDK calls introduced directly by this story.
- [ ] Testing plan confirmation: integration tests against a real local Postgres instance for the query helper; mocked-`sendTemplatedEmail` integration tests for the orchestration service; a lightweight handler test for `notifier.ts`.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: **Story 0.27 (new prerequisite, currently `backlog`) must reach at least `review` before this story's Task 5 can be verified end-to-end** — confirm this sequencing is accepted, or that Story 0.27 is already further along, before implementation begins. (Gate 2/3: no gap, nothing further to confirm.)

## Testing Requirements

- [ ] Integration tests (required): query-helper boundary conditions against a real local Postgres instance (Task 3); mocked-`sendTemplatedEmail` orchestration tests (Task 4); handler-invocation test (Task 5).
- [ ] E2E tests: not applicable — this is a backend-only scheduled process with no user-facing flow to drive through Playwright (mirrors Story 3.8's precedent for backend-triggered notification logic).

## Deliverables Checklist

- [ ] `users.lastQuotaWarningEmailSentAt` column + generated migration.
- [ ] `QUEUE_NOTIFICATION_THRESHOLD_DAYS` / `QUEUE_NOTIFICATION_THRESHOLD_COUNT` / `QUEUE_NOTIFICATION_COOLDOWN_DAYS` wired into `apps/backend/src/env.ts` and documented in `.env.example`.
- [ ] `getUsersWithStaleQueuedPosts` query helper with passing integration tests.
- [ ] `sendQuotaWarningEmails` orchestration service with passing integration tests, including per-user exception safety.
- [ ] `notifier.ts` handler wired to call `sendQuotaWarningEmails()`.
- [ ] All new tests passing; `pnpm build && pnpm lint && pnpm test` clean at the workspace root.

## Out of Scope

- All IaC/CDK changes (new `L_Notifier` Lambda resource, its EventBridge daily schedule rule, its `DATABASE_URL` environment wiring, its SES `ses:SendEmail`/`ses:SendRawEmail` IAM grant) — owned entirely by new prerequisite **Story 0.27** (Gate 1 finding, see Architecture & UX Gate Findings above).
- Story 0.25's broader `L_API`-only SES IAM reconciliation — a separate, already-existing `ready-for-dev` story, not modified or duplicated by this story.
- Any per-user email-notification opt-out/preference setting — confirmed via `AskUserQuestion` to ship unconditionally; a future story may add this if requested.
- The in-app "Queue Status" display (Story 3.9a) — a distinct, already-split story; not built or extended here.
- Reporting the *actual* reason posts are stuck (e.g. correlating with a specific `api_keys.isValid = false` row) — this story reports on queued-post age/count only, matching the PRD AC as written; it does not attempt to prove quota exhaustion is the specific cause (mirrors Story 3.9's precedent of not re-deriving quota logic that already lives in Story 0.13).

## Definition of Done

- [ ] AC satisfaction: all 9 acceptance criteria above verifiably met.
- [ ] Required tests passing: all integration tests (Task 3/4) and the handler test (Task 5) pass locally and in CI.
- [ ] Lint and type checks passing for touched packages (`apps/backend`, `packages/database`).
- [ ] Migration generated via `drizzle-kit generate` and committed to the repository (never hand-written SQL).
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the Story 0.27 sequencing dependency.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
