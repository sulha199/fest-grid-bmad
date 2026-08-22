---
baseline_commit: 4736ce86fbfe17444226e732b8b6c3ca15fc3e94
---
# Story 0.27: Provision the notifier Lambda's infrastructure and SES send permission

## Story Details

- Epic: 0
- Story ID: 0.27
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a new `L_Notifier` Lambda function wired to a daily EventBridge schedule rule, with the same `DATABASE_URL`/config environment access every other backend Lambda already gets and `ses:SendEmail`/`ses:SendRawEmail` IAM permission scoped to the single SES `EmailIdentity` construct `FestgridBackendStack` already provisions,
so that the notifier Lambda's already-implemented quota-exhaustion warning logic (Story 3.10, `apps/backend/src/lambdas/notifier.ts`, status `review`) actually deploys, runs on a schedule, and can successfully query the database and send real email — instead of sitting as an orphaned handler file with no CDK resource, no trigger, and no permissions.

## Acceptance Criteria

1. **Given** `FestgridBackendStack`'s existing `L_API`/`L_Scrape`/`L_AI`/`L_Ingest`/`Webhook`/`ApifyWebhook` Lambdas, the `ScraperScheduleRule`/`ScraperStaleJobSweepRule` EventBridge patterns, and the reconciled SES `emailIdentity` + `dbUrlSecret` Secrets Manager construct (Story 0.25, already landed on `master`),
2. **When** the stack is synthesized,
3. **Then** a new `L_Notifier` Lambda (`NotifierLambda-${stageName}`) is provisioned in `festgrid-backend-stack.ts`, with `entry` pointing at the **existing, already-implemented** `apps/backend/src/lambdas/notifier.ts` (Story 3.10's handler — this story does not create a placeholder and must not modify that file's logic), mirroring the existing `sharedLambdaProps`/`NodejsFunction` pattern used by `L_Scrape`/`L_AI`/`L_Ingest` (300-second timeout, not the 25-30s API-Lambda timeout, since it loops over potentially many users in a single invocation like the other batch/cron Lambdas).
4. **And** a new EventBridge `events.Rule` (`NotifierScheduleRule-${stageName}`) triggers `L_Notifier` on a daily `events.Schedule.rate(cdk.Duration.days(1))` cadence, mirroring `ScraperScheduleRule`'s exact construct shape.
5. **And** `L_Notifier`'s environment includes every variable its actual runtime dependency chain requires to run without crashing or silently no-op'ing — re-derived from `apps/backend/src/lambdas/notifier.ts` → `send-quota-warning-emails.ts` → `env.ts`/`db/client.ts`/`email/adapter.ts` at implementation time, not just the single `DATABASE_URL` var epics.md's original text named. As of this story's creation that set is: `STAGE`, `STAGE_NAME`, `BACKEND_PORT` (`loadBackendEnv()` throws immediately if unset — see Dev Notes), `DATABASE_URL` (Secrets-Manager-sourced via the existing `dbUrlSecret`, `db/client.ts` throws immediately if unset), `SES_FROM_EMAIL_ADDRESS` (without it `sendTemplatedEmail` silently stubs the send instead of actually emailing), `WEB_APP_BASE_URL` (used to build the quota-warning email's API-key-management link; falls back to `localhost:3000` if unset, which would be wrong in a real send), and `QUEUE_NOTIFICATION_THRESHOLD_DAYS`/`QUEUE_NOTIFICATION_THRESHOLD_COUNT`/`QUEUE_NOTIFICATION_COOLDOWN_DAYS` (each has a safe default in `env.ts`, wired explicitly anyway for parity with `L_API`'s existing environment map and so the values are visibly configurable per stage).
6. **And** `L_Notifier`'s execution role is granted `ses:SendEmail`/`ses:SendRawEmail` via `emailIdentity.grantSendEmail(notifierLambda)` — the exact same, already-existing `emailIdentity` construct `L_API` uses (`festgrid-backend-stack.ts` line ~263) — never a second, independently-created SES identity — and `dbUrlSecret.grantRead(notifierLambda)` for its Secrets-Manager-sourced `DATABASE_URL`.
7. **And** a CDK assertion test (`aws-cdk-lib/assertions`) proves: exactly one `L_Notifier` function exists, its EventBridge rule target is correctly wired to it, its execution role's IAM policy includes the scoped SES send actions, and its environment contains the full var set from AC5 (not just `DATABASE_URL`).
8. **And** this story does not touch `notifier.ts`'s or `send-quota-warning-emails.ts`'s business logic — Story 3.10 already implemented and unit-tested it; this story's scope is exclusively the CDK/IaC wiring that lets the existing handler actually run.

## Tasks / Subtasks

- [ ] Task 1: Confirm current state before starting (AC: 1, 8)
  - [ ] Confirm Story 0.25 has landed: `apps/infrastructure/lib/festgrid-backend-stack.ts` must contain `ses.EmailIdentity`/`secretsmanager.Secret` constructs and no standalone `email-identity-stack.ts` file should exist (`git ls-files apps/infrastructure/lib/email-identity-stack.ts` returns nothing). As of this story's creation this is confirmed true (commit `4736ce8`).
  - [ ] Confirm `apps/backend/src/lambdas/notifier.ts` and `apps/backend/src/lib/notifications/send-quota-warning-emails.ts` already exist and are unmodified by this story (Story 3.10, status `review`, `git log` commit `348670d`).
  - [ ] Re-derive the authoritative runtime-dependency env-var list for the notifier handler by tracing its actual import chain (`notifier.ts` → `send-quota-warning-emails.ts` → `env.ts`, `db/client.ts`, `email/adapter.ts`, `ses-client.ts`) rather than trusting AC5's snapshot — confirm whether any new var has been added to that chain since this story's creation.
- [ ] Task 2: Provision the `L_Notifier` Lambda resource (AC: 2, 3, 5)
  - [ ] Add `const notifierLambda = new nodejs.NodejsFunction(this, \`NotifierLambda-${stageName}\`, { entry: path.resolve(projectRoot, 'apps/backend/src/lambdas/notifier.ts'), handler: 'handler', ...sharedLambdaProps, timeout: cdk.Duration.seconds(300), environment: { ... } })` in `festgrid-backend-stack.ts`, positioned alongside the other Lambda declarations (after `ingestorLambda`, before the "4. Trigger Wiring" section).
  - [ ] Populate `environment` with the re-derived var set from Task 1/AC5: `STAGE`/`STAGE_NAME`/`BACKEND_PORT` (mirror the literal `'4000'`/`stageName` pattern already used by `scraperLambda`/`aiProcessorLambda`/`ingestorLambda`/`webhookLambda`), `DATABASE_URL: dbUrlSecret.secretValue.unsafeUnwrap()`, `SES_FROM_EMAIL_ADDRESS: process.env.SES_FROM_EMAIL_ADDRESS || ''`, `WEB_APP_BASE_URL: process.env.WEB_APP_BASE_URL || 'http://localhost:3000'`, `QUEUE_NOTIFICATION_THRESHOLD_DAYS`/`QUEUE_NOTIFICATION_THRESHOLD_COUNT`/`QUEUE_NOTIFICATION_COOLDOWN_DAYS` (mirror `L_API`'s existing defaults).
- [ ] Task 3: Wire the daily EventBridge trigger (AC: 4)
  - [ ] Add `const notifierScheduleRule = new events.Rule(this, \`NotifierScheduleRule-${stageName}\`, { schedule: events.Schedule.rate(cdk.Duration.days(1)) }); notifierScheduleRule.addTarget(new targets.LambdaFunction(notifierLambda));` in the "4. Trigger Wiring" section, alongside `scraperScheduleRule`.
- [ ] Task 4: Grant IAM/Secrets Manager permissions (AC: 6)
  - [ ] Add `emailIdentity.grantSendEmail(notifierLambda);` alongside the existing `emailIdentity.grantSendEmail(apiLambda);` line in the "5. IAM Permissions" section.
  - [ ] Add `dbUrlSecret.grantRead(notifierLambda);` alongside the existing `dbUrlSecret.grantRead(...)` calls for the other Lambdas.
- [ ] Task 5: Add CDK infrastructure assertion tests (AC: 7)
  - [ ] Extend `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: bump the Lambda-function resource count assertion from 6 to 7; add an `AWS::Events::Rule` assertion for a third rule (`rate(1 day)` — now shared by `ScraperScheduleRule` and `NotifierScheduleRule`, so assert `resourceCountIs('AWS::Events::Rule', 3)` and that at least one `rate(1 day)` rule's target references the `NotifierLambda`'s function via `Match.objectLike` on the rule's `Targets`); assert `L_Notifier`'s `Environment.Variables` contains the full AC5 var set (`Match.objectLike`); assert the SES-send IAM policy statement's `Resource` includes `L_Notifier`'s execution role (or, more simply, that a policy statement with `ses:SendEmail`/`ses:SendRawEmail` actions exists attached to a role used by `NotifierLambda`).
- [ ] Task 6: Update `SETUP_WALKTHROUGH.md` (persistent fact: cloud/external service setup) (AC: 5, 6)
  - [ ] Under the existing `## 2. Backend (AWS Serverless)` section's Secrets/Setup content (Story 0.25's subsections), add a short note that `L_Notifier` reuses the same `dbUrlSecret` and `emailIdentity` constructs — no new Secrets Manager entries or SES identities are introduced by this story.
- [ ] Task 7: Verification (AC: 1-8)
  - [ ] `pnpm --filter infrastructure exec cdk synth` succeeds for all three stage instances with `L_Notifier` included.
  - [ ] `pnpm --filter infrastructure exec tsx --test lib/**/*.test.ts` passes, including the new/updated assertions from Task 5.
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root for `apps/infrastructure`.
  - [ ] Confirm `apps/backend/src/lambdas/notifier.ts` and `apps/backend/src/lib/notifications/send-quota-warning-emails.ts` are byte-for-byte unchanged by this story's diff (`git diff` against these two paths should be empty).
  - [ ] Record in Completion Notes that an actual `cdk deploy` plus a real EventBridge-triggered invocation against a live AWS account is **not** performed as part of this story's automated verification (no AWS credentials available in this environment), mirroring Stories 0.14/0.25's own precedent.

## Dev Notes

### Why this story's scope changed from epics.md's original text

Epics.md's AC/Note for Story 0.27 describe `notifier.ts` as "a reserved slot, no business logic yet" that "Story 3.10 is its first and only consumer" (implying 3.10 would be implemented *after* this story ships the placeholder). By the time this story was actually drafted, the real order had inverted: **Story 3.10 (status `review`, commit `348670d feat(backend): implement scheduled email notifications for queued posts`) already filled in `notifier.ts` with real business logic** (calls `sendQuotaWarningEmails()`), and 3.10's own Pre-Coding Approval Gate explicitly recorded "Story 0.27 (new prerequisite, currently `backlog`) must reach at least `review` before this story's Task 5 can be verified end-to-end" — i.e., 3.10 knowingly shipped its handler logic ahead of this story's IaC, deferring only the deploy-time wiring. This story's ACs/Tasks above have been rewritten to match that reality: **no placeholder handler is created here**; this story is pure IaC wrapped around the already-existing, already-unit-tested handler file. Confirmed via user AskUserQuestion during this story's creation.

### Critical runtime-dependency finding (drives AC5)

Epics.md's original AC3 named only `DATABASE_URL` as the env var this story needed to wire. Tracing `notifier.ts`'s actual import chain surfaced that this is insufficient and would ship a Lambda that either crashes on every invocation or silently no-ops instead of sending real email:

- `apps/backend/src/db/client.ts` calls `loadBackendEnv()` at **module load time** and its very first check is `if (!portStr) throw new Error('BACKEND_PORT is not defined in environment variables.')` (`env.ts` line ~81) — **without `BACKEND_PORT` set, `L_Notifier` throws on cold start before any of its own logic runs**, regardless of whether `DATABASE_URL` is correctly wired.
- `send-quota-warning-emails.ts` calls `env.webAppBaseUrl` (used to build the quota-warning email's "manage your API keys" link) and, via `sendTemplatedEmail`, `env.sesFromEmailAddress` — `email/adapter.ts`'s `sendTemplatedEmail` explicitly checks `if (!fromEmail || process.env.NODE_ENV === 'test')` and **silently stubs the send** (logs to console, returns a fake message ID) instead of actually emailing, if `SES_FROM_EMAIL_ADDRESS` is unset. A deployed `L_Notifier` missing this var would "succeed" on every invocation while never sending a real email — a silent failure mode, not a crash, and easy to miss in review.
- `env.ts` provides safe defaults for `queueNotificationThresholdDays`/`Count`/`cooldownDays` (3/3/7) if their env vars are unset, so those three are lower-risk, but are wired explicitly anyway (Task 2) for parity with `L_API`'s existing environment map and to keep them stage-configurable.
- This is the same class of "leave the system working end-to-end, not just the stated ACs" gap this workflow's Step 3 explicitly calls out — re-derivation from the real code, not the epics.md snapshot, is what surfaced it. Confirmed via user AskUserQuestion (Question 2) during this story's creation: rewrite the ACs to the re-derived set rather than shipping literally only `DATABASE_URL`.

### SES / Secrets Manager dependency status (drives AC1, AC6)

Story 0.25 ("Wire backend environment variables into the deployed API Lambda's IaC configuration") was **only partially complete at the start of this story's drafting** — its Task 3 (folding the standalone `FestgridEmailStack`'s SES `EmailIdentity` into `FestgridBackendStack`) was unchecked in its own story file, and the actual `festgrid-backend-stack.ts` on `master` at that point had no `ses`/`secretsmanager` imports at all, while `apps/infrastructure/lib/email-identity-stack.ts` still existed as a separate, unwired stack. **This was flagged to the user via AskUserQuestion before finalizing this story** (mirroring Story 0.25's own precedent for its hard-blocking dependency on Story 0.14). Story 0.25's Task 3 landed on `master` mid-session (commit `4736ce8`, `git log -1` confirms it is `HEAD`) — `festgrid-backend-stack.ts` now contains `emailIdentity` (a `ses.EmailIdentity` local `const` in the stack constructor, already used by `emailIdentity.grantSendEmail(apiLambda)`) and `dbUrlSecret`/`geoapifyApiKeySecret`/etc. (`secretsmanager.Secret` constructs), and `email-identity-stack.ts` is no longer tracked (`git ls-files` confirms). **This story's AC1/AC6 are written against that now-landed state — the dependency is satisfied, not blocking.** If a future implementer finds `master` has since diverged from this (e.g., a revert), re-verify AC1's precondition before proceeding with Tasks 2-6.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh.** `epic-0-readiness.md`'s `swept: true` report's `stories_covered` list stops at `0.19` and predates this story (mirrors Stories 0.23/0.24/0.25's identical escape-hatch situation). **Verdict:** the dependency on Story 0.25's SES/Secrets-Manager reconciliation was a real blocking precondition at drafting time, but — same reasoning as Story 0.25's own finding about its dependency on Story 0.14 — it is an already-tracked dependency (epics.md's own `Depends on: Story 0.14, Story 0.25` line), not a missing architectural layer requiring a new prerequisite story split. It has since landed (see "SES / Secrets Manager dependency status" above), so it is no longer even a live blocker for implementation. No new prerequisite story needed.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh, same reason.** Considered whether the EventBridge `Rule` + `LambdaFunction` target pattern (now used a third time: `ScraperScheduleRule`, `ScraperStaleJobSweepRule`, and this story's `NotifierScheduleRule`) warrants extraction into a small reusable helper (e.g. `addScheduledLambdaTrigger(scope, id, lambda, schedule)`). **Verdict: no gap.** Each occurrence is 2-3 lines of plain CDK construct calls with no shared complex logic — the "rule of three" applies to genuinely complex/duplicated logic, not to trivially-short, self-documenting infrastructure declarations; extracting a helper here would be premature abstraction with no other current consumer requesting it. No new prerequisite story or backlog entry added.
- **Gate 2 (UI Complexity & Reusability) — no subagent dispatched.** This story has **zero UI surface** — pure AWS IaC (CDK stack changes), no React component, page, hook, or util. A grep of both authoritative UX artifact sets (`design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md`) for "Lambda"/"EventBridge"/"SES"/"notifier"/"Notifier" returned zero matches, confirming no UX artifact describes any user-facing surface for this story's scope — same justification Stories 0.14/0.25 already recorded for themselves. **Verdict: No gap found.**

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story provisions/wires AWS infrastructure (CDK) only — no Drizzle schema change, no `packages/database` migration, no `@festgrid/shared-types` change, and no GraphQL contract change. Story 3.10 already added and migrated `users.lastQuotaWarningEmailSentAt` (confirmed present in `packages/database/schema.ts`); this story does not touch it.
- Impacted fields/contracts: None.
- Required DB migration changes: None.
- Required TypeScript type changes: None. `apps/backend/src/env.ts`'s `BackendEnv` interface is unchanged — this story only affects how the same `process.env.*`/Secrets-Manager values arrive at a newly-deployed Lambda, not how backend code reads them.
- Backward compatibility and rollout notes: Purely additive — a new Lambda + EventBridge rule + IAM grants. No existing resource is modified in a breaking way (the only edits to already-provisioned constructs are additive `grantRead`/`grantSendEmail` calls and one more `NodejsFunction`/`events.Rule` declaration).
- Verification checks: Task 5/7's CDK assertion tests and `cdk synth` prove the wiring is structurally correct; real end-to-end verification (a deployed `L_Notifier` successfully querying Postgres and sending a real SES email on its daily schedule) is deferred to CI's first real deploy, consistent with Stories 0.14/0.25's own precedent.

### Project Structure Notes

- **Modified:** `apps/infrastructure/lib/festgrid-backend-stack.ts` (adds `notifierLambda`, `notifierScheduleRule`, `emailIdentity.grantSendEmail(notifierLambda)`, `dbUrlSecret.grantRead(notifierLambda)`), `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (new/updated assertions), `SETUP_WALKTHROUGH.md` (brief note under the existing `## 2. Backend` Secrets subsection).
- **Not modified:** `apps/backend/src/lambdas/notifier.ts`, `apps/backend/src/lib/notifications/send-quota-warning-emails.ts` (Story 3.10's already-implemented, already-unit-tested logic — explicitly out of scope, see AC8/Task 7's byte-for-byte-unchanged check), `apps/backend/src/env.ts`, `packages/database`, `packages/domain`, `packages/graphql-select`, `packages/ui`, `turbo.json`, root `.env.example` (all vars this story wires already have entries there from prior stories).
- Detected conflicts or variances: None remaining — Story 0.25's SES/Secrets-Manager reconciliation, which this story's AC1/AC6 depend on, landed on `master` (commit `4736ce8`) during this story's drafting session; see "SES / Secrets Manager dependency status" above.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.27`] — this story's original authoritative AC text and `Note`; superseded in part by the "Why this story's scope changed" Dev Note above (confirmed via user AskUserQuestion).
- [Source: `_bmad-output/implementation-artifacts/3-10-email-notifications-for-queued-posts.md`] — read in full; confirms `notifier.ts` was already implemented ahead of this story, its explicit deferral of all IaC to this story, and its own Pre-Coding Gate sequencing item naming this story.
- [Source: `_bmad-output/implementation-artifacts/0-25-wire-backend-environment-variables-into-the-deployed-api-lambda-s-iac-configuration.md`] — read in full; confirmed the SES/Secrets-Manager reconciliation this story depends on, and mirrored its Gate 1/3 "run fresh, cite escape hatch" reasoning and its `unsafeUnwrap()`/`grantRead` pattern.
- [Source: `_bmad-output/implementation-artifacts/0-14-set-up-aws-iac-for-lambda-sqs-eventbridge-and-kms.md`] — the `ScraperScheduleRule`/`sharedLambdaProps` patterns this story's `NotifierLambda`/`NotifierScheduleRule` mirror exactly.
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.ts`] — read in full (current `master`, commit `4736ce8`); confirmed the exact `emailIdentity`/`dbUrlSecret` construct names and existing `grantSendEmail`/`grantRead` call sites this story's Task 4 extends.
- [Source: `apps/backend/src/lambdas/notifier.ts`, `apps/backend/src/lib/notifications/send-quota-warning-emails.ts`, `get-users-with-stale-queued-posts.ts`] — read in full; confirmed the handler's real dependency chain (DB query, `sendTemplatedEmail`) driving AC5's re-derived env-var list.
- [Source: `apps/backend/src/env.ts`] — read in full; confirmed `BACKEND_PORT`'s hard-throw and the safe defaults for the queue-notification threshold/cooldown vars.
- [Source: `apps/backend/src/lib/email/adapter.ts`, `ses-client.ts`] — read in full; confirmed the `SES_FROM_EMAIL_ADDRESS`-unset silent-stub behavior and that the SES client sources its AWS region from the Lambda-provided `AWS_REGION` (no explicit wiring needed).
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.test.ts`] — read in full; current assertion shape (6 Lambdas, 2 EventBridge rules) this story's Task 5 extends.
- [Source: `SETUP_WALKTHROUGH.md`] — existing `## 2. Backend (AWS Serverless)` section (as rewritten by Stories 0.14/0.25) this story appends a brief note to.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md`] — confirmed `swept: true` but `stories_covered` stops at `0.19`; basis for running Gate 1/3 fresh.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, execution protocol, escape-hatch guard.
- [Source: `_bmad-output/project-context.md#Security`] — Credential Management / Resilient Processing Pipeline rules; no new rule violated by this story's purely-additive IaC.

## Global Rules References

- `_bmad-output/project-context.md` — Security (Credential Management: `DATABASE_URL` remains Secrets-Manager-sourced, never a literal), Technology Stack (AWS serverless).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated `AD-*` rule exists for IaC/scheduled-Lambda tooling (confirmed via grep, same finding Stories 0.14/0.25 recorded); this story's approach is governed by the existing `ScraperScheduleRule`/`emailIdentity`/`dbUrlSecret` precedent already in `festgrid-backend-stack.ts`.
- `docs/infrastructure/index.md`, `docs/infrastructure/2-backend.md` — no new architecture-diagram node/edge (this story wires config/triggers into an already-diagrammed Lambda/EventBridge pattern, it does not add a new AWS service type).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/infrastructure/lib/festgrid-backend-stack.ts`, `apps/infrastructure/lib/festgrid-backend-stack.test.ts`, `SETUP_WALKTHROUGH.md`.
- **Not modified:** `apps/backend/src/lambdas/notifier.ts`, `apps/backend/src/lib/notifications/send-quota-warning-emails.ts`, `apps/backend/src/env.ts`, `packages/database`, `packages/domain`, `packages/graphql-select`, `packages/ui`, `turbo.json`, `.env.example`.

### Rule Mapping

- Credential Management rule (no hardcoded/fallback secrets for actual credentials) → `project-context.md` → `L_Notifier`'s `DATABASE_URL` sourced via the existing `dbUrlSecret.secretValue.unsafeUnwrap()` + `dbUrlSecret.grantRead(notifierLambda)`, never a literal (Task 2/4).
- "Single reconciled SES identity" (epics.md AC) → Task 4's `emailIdentity.grantSendEmail(notifierLambda)` against the exact same construct `L_API` uses — no second `EmailIdentity`.
- "Leave the system working end-to-end" (workflow Step 3 critical rule) → the AC5 re-derivation finding (`BACKEND_PORT` hard-throw, `SES_FROM_EMAIL_ADDRESS` silent-stub) → full env var set wired in Task 2, not just `DATABASE_URL`.
- Cloud/external-service setup → persistent fact → brief `SETUP_WALKTHROUGH.md` note (Task 6) that no new secret/identity is introduced.
- Gate 1/2/3 — evaluated and resolved directly above (Architecture & UX Gate Findings); no new prerequisite story required.

### Verification Plan

- `pnpm --filter infrastructure exec cdk synth` succeeds for all three (`dev`/`staging`/`prod`) stack instances with `L_Notifier` included (Task 7).
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: extended `aws-cdk-lib/assertions` checks — 7 Lambda functions, 3 EventBridge rules (with a `rate(1 day)` rule targeting `NotifierLambda`), `L_Notifier`'s full AC5 environment var set present, SES-send policy statement present (Task 5/7).
- `pnpm build`/`pnpm lint` clean at the repo root for `apps/infrastructure`.
- `git diff` against `notifier.ts`/`send-quota-warning-emails.ts` is empty, proving this story did not touch Story 3.10's logic (Task 7).
- Explicitly recorded as deferred (not a failure): a real `cdk deploy` plus an actual EventBridge-triggered invocation against a live AWS account — no AWS credentials available in this development environment (Task 7), mirroring Stories 0.14/0.25's own precedent.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: provision `L_Notifier`'s CDK Lambda resource (entry pointing at the existing, unmodified `notifier.ts`), its daily `NotifierScheduleRule`, its full re-derived environment var set (AC5), and its SES-send + Secrets-Manager-read IAM grants against the already-existing `emailIdentity`/`dbUrlSecret` constructs — zero changes to `notifier.ts`/`send-quota-warning-emails.ts`'s business logic.
- [ ] Architecture and boundary confirmation: `L_Notifier` reuses `FestgridBackendStack`'s existing `emailIdentity`/`dbUrlSecret` constructs rather than creating new ones; the EventBridge `Rule`+`LambdaFunction` target pattern is duplicated a third time rather than extracted into a helper (Gate 3: no gap, premature abstraction avoided).
- [ ] Testing plan confirmation: extended `festgrid-backend-stack.test.ts` assertions (7 Lambdas, 3 EventBridge rules, full env-var set, SES policy) plus `cdk synth`; a real `cdk deploy` and live EventBridge-triggered invocation against real AWS is explicitly deferred (no AWS credentials in this environment).
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 — Story 0.25's SES/Secrets-Manager reconciliation was a real blocker at drafting time and has since landed on `master` (commit `4736ce8`); re-verify this is still true before implementing if significant time has passed. Gate 2 — no gap (zero UI, grep-verified against both UX artifact sets). Gate 3 — no gap (EventBridge Rule+Target duplication is trivial boilerplate, not worth a helper extraction).
- [ ] **Re-derived environment var set accepted:** confirm the AC5/Dev Notes var list (`STAGE`/`STAGE_NAME`/`BACKEND_PORT`/`DATABASE_URL`/`SES_FROM_EMAIL_ADDRESS`/`WEB_APP_BASE_URL`/`QUEUE_NOTIFICATION_THRESHOLD_DAYS`/`QUEUE_NOTIFICATION_THRESHOLD_COUNT`/`QUEUE_NOTIFICATION_COOLDOWN_DAYS`) — re-derived from `notifier.ts`'s actual runtime dependency chain rather than epics.md's original single-`DATABASE_URL` text — or provide a different intended set instead.
- [ ] **Notifier handler ownership accepted:** confirm this story must not modify `apps/backend/src/lambdas/notifier.ts` or `send-quota-warning-emails.ts` (Story 3.10's already-implemented, already-unit-tested scope) — only wraps IaC around the existing file.

## Testing Requirements

- [ ] Infrastructure assertion tests (required): extended `apps/infrastructure/lib/festgrid-backend-stack.test.ts` via `node:test`/`tsx --test` and `aws-cdk-lib/assertions`, proving `L_Notifier`'s resource presence, EventBridge wiring, environment vars, and IAM grants (Task 5).
- [ ] Synth verification (required): `cdk synth` succeeds for all three stage instances with `L_Notifier` included (Task 7).
- [ ] Integration tests: Not applicable — no application logic changes in `apps/backend` (this story does not touch `notifier.ts`/`send-quota-warning-emails.ts`, both already covered by Story 3.10's own unit tests).
- [ ] E2E tests: Not applicable — no UI in this story.
- [ ] Manual verification (deferred, tracked): a real `cdk deploy` plus a live EventBridge-triggered invocation, verified the first time CI's deploy job runs against a real AWS account (no AWS credentials available in this development environment).

## Deliverables Checklist

- [ ] `FestgridBackendStack` provisions `L_Notifier` with `entry` pointing at the existing `notifier.ts`, a 300-second timeout, and the full re-derived environment var set.
- [ ] `NotifierScheduleRule` (daily `rate(1 day)`) targets `L_Notifier`, mirroring `ScraperScheduleRule`'s shape.
- [ ] `emailIdentity.grantSendEmail(notifierLambda)` and `dbUrlSecret.grantRead(notifierLambda)` added.
- [ ] Extended `festgrid-backend-stack.test.ts` assertions passing.
- [ ] `SETUP_WALKTHROUGH.md` updated with the brief no-new-secrets/no-new-identity note.
- [ ] `pnpm build`/`pnpm lint` pass at the repo root for `apps/infrastructure`.
- [ ] `notifier.ts`/`send-quota-warning-emails.ts` confirmed byte-for-byte unchanged.

## Out of Scope

- Any change to `apps/backend/src/lambdas/notifier.ts` or `apps/backend/src/lib/notifications/send-quota-warning-emails.ts`'s business logic — Story 3.10's already-implemented, already-unit-tested scope (see AC8).
- Any change to `apps/backend/src/env.ts`'s reading logic — this story only ensures the already-defined vars are actually delivered to `L_Notifier` at deploy time.
- Provisioning a new SES identity or new Secrets Manager secret — this story exclusively reuses the constructs Story 0.25 already established.
- Extracting a reusable "scheduled Lambda trigger" CDK helper — considered under Gate 3 and declined as premature abstraction for a 2-3 line pattern with no other pending consumer.
- A real `cdk deploy` against a live AWS account, and an actual EventBridge-triggered invocation, as part of this story's own automated verification — no AWS credentials available in this development environment; deferred to CI's first real deploy.
- Any change to Story 3.10's own database migration, GraphQL surface, or email template content.

## Definition of Done

- [ ] AC 1-8 satisfied.
- [ ] `cdk synth` succeeds for all three stage instances with `L_Notifier` included (Task 7).
- [ ] `apps/infrastructure` assertion tests passing, including the new `L_Notifier`/EventBridge/env-var/SES assertions (Task 5/7).
- [ ] `pnpm lint` and `pnpm build` passing for `apps/infrastructure`.
- [ ] `SETUP_WALKTHROUGH.md` updated (Task 6).
- [ ] `notifier.ts`/`send-quota-warning-emails.ts` confirmed unmodified.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the re-derived environment var set and the notifier-handler-ownership item.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
