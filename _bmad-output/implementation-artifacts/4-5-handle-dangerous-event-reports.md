---
baseline_commit: b1eac62fe5312e9ac61b1a9ca439ea312528acbc
---

# Story 4.5: Handle "Dangerous Event" reports

## Story Details

- **Epic:** 4
- **Story ID:** 4.5
- **Status:** review

## Story

**As a** user who has reported a dangerous event,
**I want** moderators to be notified immediately,
**So that** they can take swift action to protect the community.

## Acceptance Criteria

1. **Given** a user reports an event as "Dangerous" (`submitReport(eventId, reason: dangerous, details)`, Story 4.3a), **when** the report is submitted and successfully inserted, **then** an email notification is sent to every user with `role: 'moderator'`, exclusively through the outbound email adapter's `sendTemplatedEmail` (Story 0.15) using the already-defined `DANGEROUS_EVENT_MODERATOR_ALERT` template (`packages/domain/src/email/templates.ts` — pre-built ahead of this story, first consumed here) — never a raw SMTP/provider SDK call from feature code. The dispatch is `await`ed inside the `submitReport` resolver before it returns (not fire-and-forget), for the Lambda-execution-context-freeze reason recorded in Dev Notes; a failure to notify any individual moderator (or all of them) is logged but never causes `submitReport` itself to fail or roll back the already-inserted `reports` row.
2. **And** unlike Story 4.4's "cancelled" threshold (3 unique reporters within 7 days), a "dangerous" report has no threshold or de-duplication gate of its own for the moderator email — every successfully-inserted `dangerous`-reason report triggers its own immediate notification to all moderators. The only existing gate that can prevent a `dangerous` report (and therefore its email) from being submitted at all is Story 4.3a's already-implemented `REPORT_IGNORED` check (a caller who already has a `moderator_ignored: true` `dangerous` report on that event is rejected before any insert or email).
3. **And** when a moderator marks a dangerous-reported event as safe, they have the option to ignore subsequent "Dangerous" reports from the same user for that same event, persisted via Story 4.3a's already-implemented, already-tested `ignoreSubsequentReports(reportId)` mutation (`requireModerator`-gated, sets `moderatorIgnored: true`). This story does not build any new mutation or UI for this — see Dev Notes "Architecture & UX Gate Findings" and `## Out of Scope`.

**Depends on:** Story 0.15, Story 4.3a.

## Tasks / Subtasks

- [x] **Task 1 (AC1, AC2) — Extract a testable moderator-alert dispatch function:** Create `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts`, following `send-quota-warning-emails.ts`'s exact shape (deps-injection default parameter, so the function is unit-testable without any ESM module-mocking):
  ```ts
  import { loadBackendEnv } from '../../env.js';
  import { db } from '../../db/client.js';
  import { users } from '@festgrid/database';
  import { eq } from 'drizzle-orm';
  import * as emailAdapter from '../email/adapter.js';

  export async function sendDangerousReportModeratorAlerts(
    eventName: string,
    deps = { sendTemplatedEmail: emailAdapter.sendTemplatedEmail }
  ): Promise<void> {
    try {
      const moderators = await db.select().from(users).where(eq(users.role, 'moderator'));
      if (moderators.length === 0) {
        console.info('[Dangerous Report Alert] No moderators found to notify.');
        return;
      }
      const moderatorReviewUrl = `${loadBackendEnv().webAppBaseUrl}/moderator/items`;
      const results = await Promise.allSettled(
        moderators.map((mod) =>
          deps.sendTemplatedEmail('DANGEROUS_EVENT_MODERATOR_ALERT', mod.email, {
            eventName,
            moderatorReviewUrl,
          })
        )
      );
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[Dangerous Report Alert] Failed to notify moderator ${moderators[i].email}:`, result.reason);
        }
      });
    } catch (err) {
      console.error('[Dangerous Report Alert] Failed loading moderators or dispatching alerts:', err);
    }
  }
  ```
  This function never throws — every failure path (moderator lookup, individual send) is caught and logged internally, matching AC1's "never causes `submitReport` to fail" requirement. `moderatorReviewUrl` construction (`${webAppBaseUrl}/moderator/items`) mirrors `editAccountDefaultLocation`'s existing identical construction (`resolvers.ts:397`) exactly — same target page, same env var.
- [x] **Task 2 (AC1) — Wire into `submitReport`:** In `apps/backend/src/schema/resolvers.ts`, import `sendDangerousReportModeratorAlerts` from `../lib/notifications/send-dangerous-report-moderator-alerts.js`. In the `submitReport` mutation (currently `resolvers.ts:1033-1068`), after the `db.insert(reports)...returning()` call succeeds and `newReport` is available, add:
  ```ts
  if (reason === 'dangerous') {
    await sendDangerousReportModeratorAlerts(existingEvent.eventName);
  }
  ```
  placed after the insert, before the `return { ...newReport, ... }` statement. `existingEvent` is already in scope from the resolver's existing AC/`NOT_FOUND` lookup (`resolvers.ts:1035`) — no new query needed to get the event name. Do **not** copy `editAccountDefaultLocation`'s fire-and-forget `Promise.allSettled(...).catch(...)`-without-`await` pattern (`resolvers.ts:391-419`) — see Dev Notes "Await vs. Fire-and-Forget Decision" for why this story deliberately diverges from that precedent.
- [x] **Task 3 (AC1, AC2) — Unit/integration tests for the extracted function:** Create `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.test.ts` (`node:test`, real local DB, mirroring `send-quota-warning-emails.test.ts`'s direct-`db.insert`-users-and-cleanup-in-`t.after` pattern):
  - Seed 2 `users` rows with `role: 'moderator'` and 1 with `role: 'user'`. Call `sendDangerousReportModeratorAlerts('Test Event', { sendTemplatedEmail: mockFn })` where `mockFn` is a local `async (templateKey, to, variables) => { calls.push({ templateKey, to, variables }); return 'mock-id'; }`. Assert `calls.length === 2`, each call has `templateKey === 'DANGEROUS_EVENT_MODERATOR_ALERT'`, `to` matching one of the 2 moderator emails (not the regular user's), and `variables` deep-equal `{ eventName: 'Test Event', moderatorReviewUrl: '<webAppBaseUrl>/moderator/items' }`.
  - Zero-moderators case: seed only `role: 'user'` rows, call the function, assert it resolves (does not throw) and the mock `sendTemplatedEmail` was never called.
  - Partial-failure case: seed 2 moderators, pass a mock `sendTemplatedEmail` that rejects for the first call and resolves for the second (e.g. keyed by call order or recipient email). Assert the function still resolves without throwing, and both calls were attempted (the second moderator is not skipped because the first failed) — proving `Promise.allSettled` semantics, not `Promise.all`.
  - All-failure case: mock `sendTemplatedEmail` always rejects. Assert the function still resolves without throwing (proves AC1's "never causes `submitReport` to fail" guarantee at the function's own boundary, independent of the resolver wiring tested in Task 4).
- [x] **Task 4 (AC1) — Resolver-level wiring test:** Extend `apps/backend/src/schema/reports.test.ts` with a new `t.test('submitReport - dangerous reason triggers moderator email alert', ...)` block, reusing the shared `moderatorUser`/`testEvent` seeded in that file's existing `setup` block (`reports.test.ts:36-78` — do not re-seed). Because `NODE_ENV=test` makes the real `sendTemplatedEmail` (Story 0.15a's stub) safe to call for real (it logs to `console.info` and never hits SES), this test does **not** mock/spy on `sendDangerousReportModeratorAlerts` or the email adapter itself — see Dev Notes "Why This Test Doesn't Mock the Email Module" for why that would not reliably work here. Instead:
  - Spy on `console.info` via `t.mock.method(console, 'info', () => {})` (a plain mutable global object — the same class of target `mock.method(globalThis, 'fetch', ...)` already uses elsewhere in this codebase, e.g. `geolocation/adapter.test.ts`) before calling `submitReport`.
  - Call the real `submitReport` GraphQL mutation via the existing `yoga.fetch` harness with `mockUser = { userId: regularUser2.id, role: regularUser2.role }` (a distinct regular user from the other `submitReport` tests in this file, to avoid the existing-`dangerous`-report `REPORT_IGNORED` interference) and `reason: 'dangerous'`.
  - Assert the mutation still succeeds (`result.data.submitReport.id` present, no `errors`).
  - Assert the `console.info` spy was called at least once with a message containing `'[Email Stub]'` and `'DANGEROUS_EVENT_MODERATOR_ALERT'` and the seeded `moderatorUser.email` — proving the resolver actually invoked the full dispatch path (resolver → `sendDangerousReportModeratorAlerts` → `sendTemplatedEmail` → console-stub log) end-to-end, not just that the mutation didn't throw.
  - Restore the `console.info` mock (`consoleInfoMock.mock.restore()`) at the end of the test.
- [x] **Task 5 — Verification:** `pnpm --filter backend test` (new `send-dangerous-report-moderator-alerts.test.ts` passes; extended `reports.test.ts` passes; all existing `apps/backend` suites remain unmodified and passing — no codegen/schema/migration changes in this story, so no `pnpm --filter backend codegen` or `pnpm --filter @festgrid/database generate` step is needed). `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, dated 2026-08-11, `stories_covered` explicitly includes `4.5`). Per `story-split-gate.md`'s epic-level-sweep-mode guidance, these gates were not re-run: no architecture/infrastructure gap and no foundational/cross-cutting dependency gap were raised against 4.5's shape. The sweep explicitly confirms "every adapter/context Epic 4 needs (AI Gateway/Story 0.13, **outbound email/Story 0.15**, auth-role/Story 0.17) was already built in Epic 0 in explicit anticipation of it."
  - **Lightweight guard (this story's own creation):** re-checked whether this story's actual implementation-level design (extracting a new deps-injectable `send-dangerous-report-moderator-alerts.ts` module, awaiting it inside `submitReport`) introduces anything the sweep couldn't have anticipated. It doesn't — this is a one-file addition plus a small edit to an already-existing resolver, entirely within `apps/backend`, reusing the already-provisioned email adapter (Story 0.15) and the already-existing `users.role` column (Story 0.17). No new Gate 1/3 gap found.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (not sourced from the sweep, since Gate 2 stays per-story). The subagent was given: (a) this story's literal ACs, (b) confirmation that Story 4.3a's `resolveReport`/`ignoreSubsequentReports` mutations are already fully built and integration-tested, (c) the sole moderator-action UX artifact (`design-artifacts/C-UX-Scenarios/06-data-quality/06.7-user-moderator-interfaces.md`), which depicts exactly one moderator action surface — the dedicated "Moderator Items" page (Story 4.7, still `backlog`) — with no other page/flow anywhere showing a moderator acting on a report. **Verdict: No gap.** Specifically checked and ruled out: (a) whether the "swift action" / "immediately notified" framing implies a quick-action link embedded in the moderator email itself, letting a moderator act without visiting the future Moderator Items page — no artifact anywhere (epics.md, Story 0.15, `06.7`) depicts email-embedded interactivity; the AC's "never a raw SMTP call" clause is about the send *mechanism*, not email content/interactivity; (b) any reusable component/hook/complex-state concern — none, since this story's scope is one backend resolver-side branch plus zero client code. Story 4.5 therefore has **zero UI surface**, matching the `4.1a`/`4.2a`/`4.3a` backend-only precedent. The "option to ignore subsequent reports" clause in AC2/epics.md AC2 is satisfied entirely by Story 4.3a's already-shipped, already-tested `ignoreSubsequentReports` mutation — the moderator-facing UI trigger for it (the "Mark as safe" / "Dismiss report" actions `06.7` depicts) is Story 4.7's scope, not this story's, matching Story 4.3a's own `## Out of Scope` note: *"Story 4.5's dangerous-report moderator email notification... this story only persists the reports row and exposes `ignoreSubsequentReports`; the notification send is Story 4.5's own scope."*

### Await vs. Fire-and-Forget Decision

The one existing precedent in this codebase for "email N moderators as a side effect of a mutation" — `editAccountDefaultLocation` (`resolvers.ts:391-419`, sends `DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT`) — dispatches via `Promise.allSettled(moderators.map(...)).catch(...)` **without** `await`ing it before the resolver returns. This backend runs as AWS Lambda (`project-context.md`'s Technology Stack: "Backend: Serverless on AWS (API Gateway, Lambda, SQS, EventBridge)"; Story 0.15's own AC assumes "backend Lambdas"). An un-awaited promise started inside a Lambda handler is not guaranteed to run to completion — once the handler returns (here, once the GraphQL response is sent), the Lambda execution environment can freeze or be reused for the next invocation before the dangling promise settles, silently dropping the email send with no error logged anywhere. For a feature explicitly framed around urgency ("moderators are notified immediately... so they can take swift action to protect the community" — PRD-level safety framing, unlike the location-change alert's lower-stakes moderation queue item), this is a real reliability gap, not a stylistic one.

Presented to the user via `AskUserQuestion` with both options laid out (match the existing fire-and-forget precedent for consistency, vs. `await` the dispatch with errors swallowed internally to avoid the Lambda-freeze drop risk). **User chose to `await` it.** Implemented as: `sendDangerousReportModeratorAlerts` (Task 1) never throws (every failure path is caught internally), so `await`ing it inside `submitReport` (Task 2) adds no failure mode to the mutation — it only guarantees the dispatch attempt actually runs to completion (or is fully attempted and logged-on-failure) before the Lambda handler returns, closing the drop-risk window. This also motivated extracting a standalone, deps-injectable function (Task 1) rather than inlining the dispatch directly in `resolvers.ts` as `editAccountDefaultLocation` does — the extracted shape mirrors `send-quota-warning-emails.ts`'s already-established testable pattern (a plain function with a `deps` default parameter), which sidesteps a real technical limitation: genuine ESM named exports are non-writable, so `mock.method`/`t.mock.method` (this codebase's only test-double mechanism, since no `apps/backend` test uses `vi.mock`/Vitest) cannot reliably intercept a call to a directly-imported plain function the way it can `Messaging.prototype.sendEachForMulticast` (a mutable class-prototype method) or `globalThis.fetch` (a mutable global object) — both of which this codebase already successfully mocks elsewhere. Deps-injection avoids needing to prove or fight that limitation at all.

**Out of scope, flagged for awareness only:** `editAccountDefaultLocation`'s existing fire-and-forget moderator-alert code (`resolvers.ts:391-419`) has this same latent Lambda-freeze drop risk. This story does not fix it — it is pre-existing code outside this story's stated scope (Story 4.5 touches `submitReport` only) — but is noted here so a future story/backlog item can address it if desired.

### Why This Test Doesn't Mock the Email Module

Task 4's resolver-level wiring test spies on `console.info` rather than the email adapter or `sendDangerousReportModeratorAlerts` itself, because both of the latter are genuine ESM named exports (`export async function sendTemplatedEmail(...)` / `export async function sendDangerousReportModeratorAlerts(...)`), and this codebase's sole test-double mechanism (`node:test`'s `mock.method`) can only patch a *writable* property — it already only ever targets mutable objects here (`globalThis.fetch`, `Messaging.prototype.sendEachForMulticast`), never a plain ESM module namespace, because ESM namespace object properties are non-configurable/non-writable by spec and `mock.method` would throw attempting to reassign one. `console.info` is a plain, mutable global object property, the same class of target this codebase's existing `mock.method(globalThis, 'fetch', ...)` calls already rely on — so spying on it to observe Story 0.15a's real (safe-under-`NODE_ENV=test`) stub-log output is both reliable and consistent with established convention, and it proves the full call chain end-to-end rather than a mocked stand-in.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story adds zero schema/type changes. `DANGEROUS_EVENT_MODERATOR_ALERT`'s `EmailTemplateKey`/`EmailTemplateVariables` entries (`{ eventName: string; moderatorReviewUrl: string }`) and its subject/HTML/text template already exist in `packages/domain/src/email/types.ts`/`templates.ts` (pre-built ahead of this story — confirmed by direct read, and already exercised by `apps/backend/src/lib/email/adapter.test.ts`'s existing `'stubs email send and logs to console if SES_FROM_EMAIL_ADDRESS is missing'` test, which already calls `sendTemplatedEmail('DANGEROUS_EVENT_MODERATOR_ALERT', ...)`). No `packages/database` schema change (this story reads the existing `users.role` column and the existing `reports` insert result; it writes nothing new). No `packages/shared-types` change. No `packages/domain` change (the new logic is DB/adapter-coupled orchestration — querying `users`, calling the backend-only email adapter — not pure business logic, so per `project-context.md`'s `packages/domain` restriction it correctly belongs in `apps/backend`, not `packages/domain`).
- **Impacted fields/contracts:** `apps/backend/src/schema/resolvers.ts`'s `submitReport` mutation gains one new internal side-effect branch (`reason === 'dangerous'` → `await sendDangerousReportModeratorAlerts(...)`) — its GraphQL signature, return shape, and all existing behavior (auth, `NOT_FOUND`, `REPORT_IGNORED`, insert) are unchanged. No `.graphql` schema file is touched; no codegen regeneration is needed.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None — `EmailTemplateKey`/`EmailTemplateVariables['DANGEROUS_EVENT_MODERATOR_ALERT']` already exist and are reused as-is.
- **Backward compatibility and rollout notes:** Purely additive to `submitReport`'s internal behavior; no existing caller of `submitReport` is affected by shape. The new email side effect is invisible to the GraphQL contract (no new field/argument), so no frontend change is needed or possible from this story.
- **Verification checks:** Task 3's function-level tests (happy path, zero-moderators, partial-failure, all-failure) and Task 4's resolver-level wiring test (proves `submitReport` actually invokes the dispatch path end-to-end via the `console.info` stub-log assertion); Task 5's full build/lint/test.

### Project Structure Notes

- **New:** `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts`; `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.test.ts`.
- **Modified:** `apps/backend/src/schema/resolvers.ts` (`submitReport` mutation gains the new import and the `if (reason === 'dangerous')` branch — `resolvers.ts:1033-1068`); `apps/backend/src/schema/reports.test.ts` (one new `t.test` block appended, reusing existing `setup` fixtures — no changes to existing tests).
- **Not modified:** `packages/database/schema.ts`; any `.graphql` schema file; `apps/backend/src/generated/resolvers-types.ts`; `packages/domain`; `packages/shared-types`; `apps/web`; `apps/infrastructure`; `packages/database/seed.ts`; `.env`/`env.ts` (no new env var — `webAppBaseUrl`/`sesFromEmailAddress` already exist and are reused as-is).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.5`] — this story's authoritative AC/Note text.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report explicitly covering `4.5` (`stories_covered` list, line 13).
- [Source: `_bmad-output/implementation-artifacts/4-3a-build-the-reports-backend-graphql-api-layer-and-personal-visibility-filtering.md`] — the `submitReport`/`ignoreSubsequentReports`/`resolveReport` contract this story builds on; its own `## Out of Scope` explicitly naming Story 4.5 as the owner of the moderator-email send.
- [Source: `apps/backend/src/schema/resolvers.ts:1033-1068`] — the exact current `submitReport` implementation this story extends (read in full).
- [Source: `apps/backend/src/schema/resolvers.ts:319-420` (`editAccountDefaultLocation`)] — the sole existing "email all moderators" precedent this story's own dispatch function's shape is evaluated against (moderator-role query, template variables, URL construction reused; fire-and-forget pattern deliberately **not** reused — see "Await vs. Fire-and-Forget Decision").
- [Source: `apps/backend/src/lib/notifications/send-quota-warning-emails.ts`] — the deps-injection testable-function pattern `send-dangerous-report-moderator-alerts.ts` (Task 1) follows exactly.
- [Source: `apps/backend/src/lib/notifications/send-event-notifications.test.ts:73`, `apps/backend/src/lib/geolocation/adapter.test.ts:23`] — the `t.mock.method`/`mock.method` precedent confirming this codebase's test-double mechanism only targets mutable objects (class prototypes, `globalThis`), motivating both the deps-injection choice (Task 1) and the `console.info`-spy choice (Task 4).
- [Source: `apps/backend/src/lib/email/adapter.ts`, `adapter.test.ts`] — `sendTemplatedEmail`'s existing `NODE_ENV=test`/no-`SES_FROM_EMAIL_ADDRESS` stub behavior (Story 0.15a), including its own existing test that already calls `sendTemplatedEmail('DANGEROUS_EVENT_MODERATOR_ALERT', ...)`.
- [Source: `packages/domain/src/email/templates.ts`, `types.ts`] — the pre-built `DANGEROUS_EVENT_MODERATOR_ALERT` template/variables this story is the first to actually consume from a resolver.
- [Source: `design-artifacts/C-UX-Scenarios/06-data-quality/06.7-user-moderator-interfaces.md`] — the sole moderator-action UX artifact, confirming zero UI surface belongs to this story (Gate 2 evidence).
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-7`] — `requireAuth`/`requireModerator` as the single enforcement surface (already used unchanged by `submitReport`; this story adds no new authorization check).
- [Source: `_bmad-output/project-context.md#Critical-Implementation-Rules`, `#Security`] — outbound-email-adapter-only rule; `packages/domain` React/DB-coupling restriction (confirms this story's logic correctly stays in `apps/backend`).
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, epic-level-sweep-mode guidance (source of citing `epic-4-readiness.md` for Gate 1/3).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Security ("Resilient Processing Pipeline" / outbound-email-adapter-only rule); `packages/domain` React/DB-coupling restriction (confirms no `packages/domain` scope in this story).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-7 (`requireAuth`/`requireModerator`, reused unchanged; `users.role` as the moderator role source).
- [ ] `docs/infrastructure/index.md` / `docs/infrastructure/6-outbound-email.md` — confirmed no infra shard change needed: this story adds no new AWS resource, reuses the already-provisioned SES adapter (Story 0.15) synchronously within an existing Lambda-backed GraphQL mutation.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts`; `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.test.ts`.
- **Modified:** `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/schema/reports.test.ts`.
- **Not modified:** `packages/database/schema.ts`; any `.graphql` file; `apps/backend/src/generated/resolvers-types.ts`; `packages/domain`; `packages/shared-types`; `apps/web`; `apps/infrastructure`; `packages/database/seed.ts`; `.env`/`env.ts`.

### Rule Mapping

- Security → outbound-email-adapter-only rule (`project-context.md`) → Task 1's `sendDangerousReportModeratorAlerts` calls `sendTemplatedEmail` exclusively, never a raw SES SDK call.
- AD-7 rule 3/4 (single enforcement surface; `users.role` as the application-level role model) → Task 1's `eq(users.role, 'moderator')` query — no new auth check introduced, `submitReport`'s existing `requireAuth` is unchanged.
- Reuse over reinvention (`editAccountDefaultLocation`'s moderator-query/URL-construction pattern; `send-quota-warning-emails.ts`'s deps-injection testable-function pattern; the already-built `DANGEROUS_EVENT_MODERATOR_ALERT` template) → Task 1, Task 2.
- "Leave the system working end-to-end, not just satisfy stated ACs" (identifying and fixing the Lambda-freeze fire-and-forget drop risk rather than copying the nearest precedent verbatim) → this workflow's Step 3/3.5 mandate → Dev Notes "Await vs. Fire-and-Forget Decision".
- Testing Rules (`project-context.md`, testing-trophy: integration tests over unit-only, "unhappy path" coverage required) → Task 3 (happy/zero-moderator/partial-failure/all-failure paths) and Task 4 (resolver-level wiring, unhappy-path-adjacent since it proves the failure-swallowing contract doesn't break the mutation).
- Story-split-gate discipline (Gate 1/3 cited from the swept report; Gate 2 run fresh via subagent, no gap) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".

### Verification Plan

- `apps/backend`: `pnpm --filter backend test` — new `send-dangerous-report-moderator-alerts.test.ts` passes (happy path, zero-moderators, partial-failure, all-failure); extended `reports.test.ts` passes (new dangerous-reason wiring test, all existing tests in the file unmodified and still passing).
- `pnpm --filter backend lint` / `tsc` — touched files type-check cleanly.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- Manual/DB check: after Task 3/4's test runs, no fixture pollution remains beyond what each test's own `t.after`/existing cleanup removes (Task 3 cleans up its own seeded users; Task 4 reuses `reports.test.ts`'s existing shared fixtures and existing cleanup).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements only (a) a new `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts` function and (b) a small edit wiring it into `submitReport`'s existing `dangerous`-reason branch, plus their tests. It does **not** implement any new mutation, any new UI, or any changes to `ignoreSubsequentReports`/`resolveReport` (already fully built and tested by Story 4.3a) or to the future Moderator Items page (Story 4.7).
- [ ] Architecture and boundary confirmation: no new API surface, no new DB column/table, no direct SES SDK call from feature code (adapter-only), no `packages/domain`/`packages/ui`/`apps/web` changes.
- [ ] Testing plan confirmation: Task 3's function-level tests (real local DB for moderator seeding, deps-injected mock `sendTemplatedEmail`, covering happy/zero-moderator/partial-failure/all-failure paths) and Task 4's resolver-level wiring test (`console.info` spy proving the full dispatch chain fires from a real `submitReport` call) as detailed above.
- [ ] **Await-vs-fire-and-forget decision accepted:** confirm the moderator alert dispatch is `await`ed inside `submitReport` (with all failures swallowed internally by the extracted function, so the mutation itself can never fail because of the email side effect) rather than matching `editAccountDefaultLocation`'s existing fire-and-forget pattern — per the user's `AskUserQuestion` decision, made to avoid AWS Lambda's execution-context-freeze drop risk on un-awaited promises (see Dev Notes "Await vs. Fire-and-Forget Decision"). `editAccountDefaultLocation`'s own existing fire-and-forget code is explicitly **not** being fixed by this story — flagged for awareness only.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-4-readiness.md` (`4.5` explicitly in `stories_covered`; no gap). Gate 2 run fresh via subagent — no gap (zero UI surface; the "ignore subsequent reports" moderator action UI is confirmed to be Story 4.7's scope, not this story's, per the sole UX artifact `06.7` and Story 4.3a's own `## Out of Scope` note).
- [ ] **Dependency statuses confirmed:** Story 0.15 (`done`), Story 4.3a (`in-progress` per `sprint-status.yaml` at this story's creation time, though its own file's `## Completion Status` is checked `[x] Complete` and its `## Story Details` status reads `review` — the `submitReport`/`ignoreSubsequentReports` code this story depends on is confirmed present and working by direct read of `apps/backend/src/schema/resolvers.ts:1033-1068` and `reports.test.ts` regardless of the sprint-tracking-file/story-file status discrepancy). No `backlog`-status dependency blocks this story.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.test.ts` (new, real local DB, `node:test`, mirrors `send-quota-warning-emails.test.ts`'s harness): happy path (N moderators each get one correctly-shaped call, regular users excluded), zero-moderators (no throw, no calls), partial-failure (`Promise.allSettled` semantics — one rejection doesn't block others), all-failure (function still resolves, never throws).
- [ ] `apps/backend/src/schema/reports.test.ts` (extended): one new `t.test` proving `submitReport` with `reason: 'dangerous'` actually invokes the full dispatch chain end-to-end (via a `console.info` spy on the real Story 0.15a stub-log output), reusing existing seeded fixtures.
- [ ] E2E: not required — no user-facing page/flow exists in this story's scope (matches Story 4.3a/4.4/4.2a's own "backend-only, no E2E" precedent); Story 4.7 (Moderator Items page, not yet created) will own any future moderator-UI E2E coverage.

## Deliverables Checklist

- [ ] `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts`: implemented, deps-injectable, never throws.
- [ ] `apps/backend/src/schema/resolvers.ts`: `submitReport` extended with the `await`ed `dangerous`-reason moderator-alert dispatch.
- [ ] `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.test.ts`: new, all 4 scenarios (happy/zero/partial-failure/all-failure) passing.
- [ ] `apps/backend/src/schema/reports.test.ts`: extended with the resolver-level wiring test, passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- Any new mutation, resolver argument, or schema change to `resolveReport`/`ignoreSubsequentReports` — both are already fully built and integration-tested by Story 4.3a; this story only relies on `ignoreSubsequentReports`'s existing, already-shipped behavior (AC3).
- The "Mark as safe" / "Dismiss report" / "ignore subsequent reports" moderator-facing UI action — confirmed via Gate 2 (fresh subagent review) to belong entirely to Story 4.7's "Moderator Items" page (`backlog`), the sole UX artifact (`06.7`) depicting any such action. No email-embedded quick-action link is specified anywhere and none is built here.
- Fixing `editAccountDefaultLocation`'s existing fire-and-forget moderator-alert code (`resolvers.ts:391-419`) to also `await` its dispatch — flagged in Dev Notes as sharing this story's identified Lambda-freeze drop risk, but out of this story's stated scope (this story touches `submitReport` only). Consider a small follow-up cleanup story if desired.
- Any threshold, rate-limiting, or de-duplication logic for dangerous-report emails across multiple reporters/events — epics.md's AC1 for this story has no threshold language (unlike Story 4.4's explicit 3-reporter/7-day cancelled-report threshold), so every successfully-inserted `dangerous` report triggers its own immediate email, gated only by Story 4.3a's existing `REPORT_IGNORED` submission-rejection check.
- Any new locale/i18n keys — this story adds no user-facing copy (the email template's HTML/text strings are not i18n-scoped per the existing `EMAIL_TEMPLATES` precedent, which is English-only for all currently-shipped templates).

## Definition of Done

- [ ] All 3 Acceptance Criteria satisfied.
- [ ] `send-dangerous-report-moderator-alerts.test.ts` (new) passing, covering happy/zero-moderator/partial-failure/all-failure paths.
- [ ] `reports.test.ts` (extended) passing, including the new dangerous-reason wiring test.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] No new DB migration, no codegen regeneration needed or performed (confirmed no schema/GraphQL SDL change).

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

- Happy path and edge-case validation logs verified from `send-dangerous-report-moderator-alerts.test.ts` and `reports.test.ts` passes.

### Completion Notes List

- Implemented `sendDangerousReportModeratorAlerts` function to query all users with the role of `moderator` and notify them using the outbound email adapter with the `DANGEROUS_EVENT_MODERATOR_ALERT` template.
- Intercepted `submitReport` mutation for the reason "dangerous", which triggers immediate dispatch of moderator notifications, awaiting the promise to ensure the AWS Lambda execution context doesn't freeze prior to the send attempt, while gracefully catching any internal failures to prevent mutation rollback.
- Wrote exhaustive unit/integration tests covering happy paths, zero moderators, partial email dispatch failures, and full email dispatch failures.
- Added resolver-level integration testing spying on `console.info` using Yoga server fetching and verifying that the correct email template with its variables are dispatched end-to-end.

### File List

- `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts` (New)
- `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.test.ts` (New)
- `apps/backend/src/schema/resolvers.ts` (Modified)
- `apps/backend/src/schema/reports.test.ts` (Modified)
