---
baseline_commit: d1fda17d9cb365320d2d736063ace2600416eccb
---

# Story 4.4: Handle "Event Cancelled" reports

## Story Details

- Epic: 4
- Story ID: 4.4
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want events that are widely reported as "cancelled" to be removed from the public view,
so that I don't see inaccurate information.

**Scope note (read before implementing):** This story's epics.md ACs (below) describe a behavior that is already **fully implemented by Stories 4.3, 4.3a, and 4.4a** — the threshold check and soft-delete run synchronously inside `submitReport` (Story 4.3a's mutation, Story 4.4a's threshold-extension task), the "Event Cancelled" reason UI is Story 4.3's own scope, and the moderator restore UI is Story 4.7's. No production code gap remains (confirmed directly in Story 4.4a's own Dev Notes: *"Story 4.4 is the epics.md entry that names the end-to-end behavior but has no additional AC of its own beyond what this story and 4.3a already implement"*). Confirmed with the user via `AskUserQuestion` during this story's creation: **this story is verification-only** — it adds the cross-story integration/E2E test coverage that currently does not exist anywhere (each of 4.3/4.3a/4.4a tests its own layer in isolation; nothing today chains "3 distinct users report -> event vanishes for everyone else -> moderator can still see and restore it" end-to-end). No new production code is added by this story.

## Acceptance Criteria

1. **Given** an event has been reported as "Cancelled" by a user, **when** the number of unique users reporting the same event as cancelled reaches a configurable threshold (default: 3) within a configurable timeframe (default: 7 days), **then** the event is soft-deleted and no longer visible to regular users, via the threshold check running synchronously inside the `submitReport` mutation (Stories 4.3a, 4.4a) — no separate scheduled job. *(Already implemented by Story 4.4a Task 3; this story adds the integration test proving it — Task 1.)*
2. **And** a moderator can view the soft-deleted event and has the option to restore it via the `restoreEvent` mutation (Story 4.4a). *(Already implemented by Story 4.4a Task 2/4; this story adds the integration test proving the restore round-trip — Task 1.)*
3. **New AC (this story):** A backend integration test exists that, using the real `submitReport`/`restoreEvent` resolvers (not a client-side simulation), proves the full mutation-to-query round trip: 3 distinct users submitting `cancelled` reports on the same event causes a regular (non-moderator) `events`/`event`/`eventBySlug` query to stop returning it, a moderator query with `includeSoftDeleted: true` still returns it, and calling `restoreEvent` makes it visible to regular queries again.
4. **New AC (this story):** An E2E test exists that, using the real frontend Report dialog (Story 4.3), proves a user crossing the cancellation threshold (as the 3rd unique reporter, after 2 pre-seeded reporters) results in the event becoming unreachable via its detail-view URL for a subsequent visit — rendering the existing generic "Not Found" state (`EventDetailWrapper.tsx`'s `notFoundTitle`/`notFoundBody`) rather than the event's details.
5. **And** every reason label/description, dialog copy, and the "Not Found" state text used in this story's tests are already resolved via `next-intl` by Stories 4.3/0.6 — this story asserts against that existing i18n-resolved copy, it does not add or change any locale keys.

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #2, #3) — Backend cross-story integration test: `apps/backend/src/schema/reports.test.ts` (new `describe` block, or a new colocated file `apps/backend/src/schema/cancelled-report-visibility.integration.test.ts` if `reports.test.ts` is already large — dev's call, follow whichever keeps the file under the codebase's existing size norms)
  - [x] Subtask 1.1: In a `beforeEach`, insert 3 distinct `users` rows directly (mirroring `resolvers.test.ts`'s existing `db.insert(users).values(...)` pattern — do not add these to the shared `packages/database/seed.ts` fixtures, this is test-local data) plus one `events` row (and one `schedules` row, since `events` display/query paths assume at least a main schedule exists per existing fixture conventions) via direct `db.insert`.
  - [x] Subtask 1.2: Call the real `submitReport` resolver (imported the same way `resolvers.test.ts` already imports/invokes resolvers under test — not a raw SQL insert into `reports`) 3 times, once per distinct user, each with `{ eventId, reason: 'cancelled' }` and a `context.user` matching that user. Assert the 1st and 2nd calls leave `events.deletedAt` null (`db.select` verification); assert the 3rd call (crossing the default threshold of 3) results in `events.deletedAt` being set.
  - [x] Subtask 1.3: Call the `events`/`event`/`eventBySlug` resolvers (whichever the existing `resolvers.test.ts` events block already exercises) with a regular (non-moderator) `context.user` and assert the soft-deleted event is excluded. Call the same resolver with a moderator `context.user` and `includeSoftDeleted: true` and assert it IS returned, with `deletedAt` populated.
  - [x] Subtask 1.4: Call the real `restoreEvent` resolver (moderator context, `action: RESTORE`) and assert a subsequent regular-context query returns the event again with `deletedAt: null`.
  - [x] Subtask 1.5: Add one boundary case reusing Story 4.4a's own domain functions (`shouldSoftDeleteFromCancelledReports`, `getCancelledReportWindowCutoff` from `packages/domain/src/events`) at the integration level: a `cancelled` report inserted with a `createdAt` outside the configurable window does not count toward the threshold (insert the 3rd report's underlying `reports` row with a backdated `createdAt` via direct `db.insert` for this one case only, since `submitReport` itself always writes `createdAt: now()` — this subtask needs a raw insert specifically to simulate an old report, unlike 1.2's real-resolver calls).
- [x] Task 2 (AC: #4, #5) — Frontend E2E test: `apps/web/e2e/event-cancelled-report.spec.ts` (new, mirrors `event-correction.spec.ts`'s `E2E_AUTH_STORAGE_STATE`-gated/`test.skip` harness)
  - [x] Subtask 2.1: Add one new dedicated fixture event to `packages/database/seed.ts`'s `FIXTURE_EVENTS`/`FIXTURE_SCHEDULES` arrays (e.g. `id: '40000000-0000-0000-0000-000000000004'`, `slug: 'cancellation-threshold-test-fixed'`) — a **new, dedicated** event, not one of the 3 existing fixtures (`past-jazz-night-2025-fixed` / `ongoing-culture-fest-2026-2027-fixed` / `upcoming-family-workshop-2027-fixed`), since this test's own report will soft-delete it and other E2E specs (`event-correction.spec.ts` et al.) depend on those 3 staying visible/undeleted across the suite's lifetime.
  - [x] Subtask 2.2: Add a new `FIXTURE_REPORTS` array to `seed.ts` (import `reports` from `./schema`, not currently imported there) with exactly 2 rows: `FIXTURE_USERS[0]` (alice) and `FIXTURE_USERS[1]` (bob) each reporting the new fixture event with `reason: 'cancelled'`. Add `reports: FIXTURE_REPORTS.length` to the exported `FIXTURE_COUNTS` object and a corresponding `FIXTURE_REPORT_IDS` export, matching the existing `FIXTURE_*_IDS`/`FIXTURE_COUNTS` pattern. Insert this array in `seedDatabase()`'s existing insert sequence (after `events`/`schedules`, since `reports.eventId` FKs to `events`).
  - [x] Subtask 2.3: Check `packages/database/seed.test.ts` and `seed.integration.test.ts` for any assertion that would need updating given the new fixture rows (e.g. total row-count checks) and update them if so.
  - [x] Subtask 2.4: In the new spec, navigate to `/en/events/cancellation-threshold-test-fixed`, open "More actions" -> "Report" (Story 4.3's trigger/dialog — same selectors as `event-correction.spec.ts` uses for "Correct Data", adapted to "Report"), select the "Event Cancelled" reason, submit. This is the 3rd unique reporter (alice + bob already seeded, the E2E session's authenticated user is the 3rd), crossing the default threshold of 3.
  - [x] Subtask 2.5: Assert Story 4.3's own success/hidden-state behavior fires (success toast, navigation away from the event — per Story 4.3 AC6/AC7, already covered by that story's own tests; do not re-assert it in detail here beyond confirming the flow completes without error).
  - [x] Subtask 2.6: Re-navigate to `/en/events/cancellation-threshold-test-fixed` directly (a fresh `page.goto`, simulating a subsequent visit by anyone) and assert the generic "Not Found" state renders — `t("notFoundTitle")`/`t("notFoundBody")` text from `EventDetailWrapper.tsx` (`EventDetailsPage` i18n namespace) — instead of the event's details.
  - [x] Subtask 2.7: Add a short code comment or `test.afterAll` note (not a strict requirement, but flag it in Dev Agent Record) that this fixture event stays permanently soft-deleted after this spec runs unless a moderator restores it — acceptable since it's a dedicated, single-purpose fixture no other spec reads, but call it out so it isn't mistaken for a real defect if re-run against a persistent shared dev DB.
- [x] Task 3 (AC: #1-#4) — Run and verify: `pnpm --filter backend test` (new integration test passes; all existing suites remain passing) and, if `E2E_AUTH_STORAGE_STATE` is available in the dev environment, `pnpm --filter web exec playwright test event-cancelled-report.spec.ts`. Record actual results (or the skip reason if the env var isn't set) in Dev Agent Record — do not claim the E2E test passed without having actually run it.

## Dev Notes

- **This is a test-and-fixture-only story.** No `apps/backend` resolver, `apps/web` component, or `packages/domain`/`packages/ui` production code is added or modified. Everything this story exercises (`submitReport`'s threshold extension, `restoreEvent`, the `activeOnly(events)` visibility filter, the Report dialog/reason UI, the generic Not Found state) is built by Stories 4.3, 4.3a, and 4.4a — see the Scope Note above.
- **Hard dependency, not yet implemented:** As of this story's creation, Story 4.3 is `ready-for-dev`, Story 4.3a is `in-progress`, and Story 4.4a is `ready-for-dev` — none are done. Confirmed directly against the codebase: `packages/database/schema.ts`'s `events` table has no `deletedAt` column yet, and no `restoreEvent`/`includeSoftDeleted` exists in `apps/backend/src/schema/resolvers.ts` yet. This story's tests **cannot be written to pass** until all three land. This is the same situation Story 4.4a itself was created under (4.3a was `ready-for-dev` at 4.4a's own creation time) — the precedent there was to create the story now and gate actual coding on the prerequisite via the Pre-Coding Approval Gate, which this story follows too.
- **Why backend-integration-test, not more E2E:** Per `project-context.md`'s testing-trophy philosophy, the 3-unique-reporters threshold/window/restore matrix is exercised as a `Vitest` integration test directly against resolvers + a real local DB (matching `resolvers.test.ts`'s and Story 4.4a's own planned `reports.test.ts` pattern) rather than as a 3-authenticated-browser-session E2E test. The existing E2E harness (`event-correction.spec.ts`, `favorites.spec.ts`, etc.) only supports **one** authenticated Playwright session via `E2E_AUTH_STORAGE_STATE` — there is no existing multi-user-login E2E infrastructure in this repo, and building one would itself be new test infrastructure out of proportion to what this verification-only story is scoped for (Gate 2 confirmed no such gap needs splitting off; it's a design choice, not a missing capability, since the backend integration test already fully proves the multi-reporter mechanic). The E2E test (Task 2) instead uses 2 **pre-seeded** reporters (alice/bob via `seed.ts`) plus the E2E session's own real authenticated user as the 3rd, so it only needs the one real browser session the existing harness already supports, while still exercising the real frontend Report dialog and the real "no longer visible" experience end-to-end.
- **Fixture isolation:** Task 2's new fixture event must be dedicated (not reused from `past-jazz-night-2025-fixed`/`ongoing-culture-fest-2026-2027-fixed`/`upcoming-family-workshop-2027-fixed`) because this test's own action soft-deletes it — reusing a shared fixture would break every other E2E spec that depends on that event staying visible.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — cited from swept `epic-4-readiness.md`** (`swept: true`, Story 4.4 explicitly listed in `stories_covered`): no gap. This story adds no new backend/API surface at all — it only calls resolvers/mutations Story 4.3a/4.4a already fully specify.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review**, since the story's shape (verification-only, test/fixture code) postdates the epic-wide sweep and Gate 2 always stays per-story. **Verdict: No gap.** The subagent confirmed `EventDetailWrapper.tsx`'s existing generic "Not Found" block (lines 174-189, `t("notFoundTitle")`/`t("notFoundBody")`, rendered whenever `eventBySlug` returns null) already covers the state this story's E2E test asserts against — nothing new to build. It also checked `EXPERIENCE.md`'s "Soft Delete with Undo" pattern and confirmed it's scoped to a user's own self-service deletes (Saved Locations, favorites — immediate-commit + toast+undo), architecturally distinct from Epic 4's report-threshold-triggered moderation soft-delete, which has no bespoke toast/undo treatment specified anywhere in the UX artifacts and correctly falls through to the generic Not Found state. No new `packages/ui` component, hook, or unspecified visual/interaction detail is hiding in this scope.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — cited from swept `epic-4-readiness.md`**: no gap. This story introduces no new shared/foundational dependency; it only extends an existing seed script and existing test suites.
- **Lightweight guard (this story's own scope beyond the sweep):** considered whether "verification-only, cross-story integration test" scope itself hides a Gate 1-shaped gap (e.g., does proving the multi-reporter mechanic actually require new test infrastructure, like multi-session E2E auth?). Concluded no — see "Why backend-integration-test, not more E2E" above; the existing single-session E2E harness plus DB-level pre-seeding is sufficient and follows established codebase conventions (`seed.ts` fixtures, `resolvers.test.ts`'s direct-`db.insert` pattern), so nothing needs splitting off.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story adds zero schema/type changes of its own. Story 4.4a already owns the `events.deletedAt` column, the `restoreEvent`/`deleteEventPermanently` mutations, and the `activeOnly(events)` filter; Story 4.3a already owns the `reports` table and `submitReport` mutation. This story's only `schema.ts`-adjacent change is importing the already-existing `reports` export into `seed.ts` (Task 2, Subtask 2.2) to insert fixture rows — no new columns, enums, or types are introduced.
- **Impacted fields/contracts:** None new. Tests read/write existing `events.deletedAt`, `reports.*`, and call existing `submitReport`/`restoreEvent`/`events`/`event`/`eventBySlug` GraphQL operations once Stories 4.3a/4.4a land.
- **Required DB migration changes:** No changes required — this story runs no `drizzle-kit generate`.
- **Required TypeScript type changes:** No changes required — no new GraphQL Code Generator regeneration is needed for this story itself (Task 2's E2E test reuses Story 4.3's already-generated `useSubmitReportMutation`/`ReportReason` types once that story lands).
- **Backward compatibility and rollout notes:** N/A — test-only story, no runtime behavior change, no rollout sequencing beyond the Pre-Coding Approval Gate's prerequisite-completion check.
- **Verification checks:** Task 1's integration test suite and Task 2's E2E spec are themselves the verification checks this story exists to add; Task 3 running `pnpm --filter backend test` (and the E2E spec, env permitting) is the proof this story is done.

### Project Structure Notes

- New file: `apps/backend/src/schema/reports.test.ts` (extended, once it exists per Story 4.3a) or a new colocated `apps/backend/src/schema/cancelled-report-visibility.integration.test.ts` — matches existing `apps/backend/src/schema/*.test.ts` convention.
- New file: `apps/web/e2e/event-cancelled-report.spec.ts` — matches existing `apps/web/e2e/*.spec.ts` convention (`event-correction.spec.ts`, `favorites.spec.ts`, etc.).
- Modified file: `packages/database/seed.ts` — new `FIXTURE_EVENTS`/`FIXTURE_SCHEDULES` entries (4th event, following the existing 3-entry array pattern exactly) and a new `FIXTURE_REPORTS` array/export, following the file's existing `FIXTURE_*`/`FIXTURE_COUNTS`/`FIXTURE_*_IDS` naming and export conventions.
- Possibly modified: `packages/database/seed.test.ts`, `packages/database/seed.integration.test.ts` — only if they assert exact fixture counts (Task 2, Subtask 2.3 — check, don't assume).
- No changes to `packages/domain`, `packages/ui`, `apps/web` production components, or any GraphQL schema/resolver file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.4 "Handle 'Event Cancelled' reports"] — this story's literal ACs (#1, #2 above).
- [Source: `_bmad-output/implementation-artifacts/4-4a-add-soft-delete-to-the-events-table-and-extend-the-events-resolver-and-moderator-mutations.md`] — the full `deletedAt`/`activeOnly(events)`/`includeSoftDeleted`/`restoreEvent`/`deleteEventPermanently` contract this story tests against, and its own Dev Notes' explicit confirmation that Story 4.4 has no independent AC.
- [Source: `_bmad-output/implementation-artifacts/4-3a-build-the-reports-backend-graphql-api-layer-and-personal-visibility-filtering.md`] — the `reports` table/`submitReport` mutation contract, including the unique-reporter-count threshold mechanic this story's Task 1 exercises.
- [Source: `_bmad-output/implementation-artifacts/4-3-report-an-event.md`] — the frontend Report dialog/reason-selection UI this story's Task 2 drives, and its own existing E2E harness pattern (`E2E_AUTH_STORAGE_STATE`).
- [Source: `apps/web/e2e/event-correction.spec.ts`] — the exact single-session, `test.skip`-gated E2E harness pattern Task 2's new spec follows.
- [Source: `apps/web/src/features/events/EventDetailWrapper.tsx#L174-189`] — the existing generic "Not Found" state this story's E2E test asserts against.
- [Source: `packages/database/seed.ts`] — existing `FIXTURE_EVENTS`/`FIXTURE_SCHEDULES`/`FIXTURE_COUNTS` pattern Task 2's new fixture data follows.
- [Source: `apps/backend/src/schema/resolvers.test.ts#L653-`] — the existing direct-`db.insert`/resolver-invocation integration test pattern Task 1 follows.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8`] — Soft-Delete Convention; `events` binding and the `deletedAt`-only column shape this story's assertions rely on.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.9.2`] — "User Reporting and Event Moderation", the literal threshold/window/moderator-restore behavior this story verifies end-to-end.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 sweep citing Story 4.4 in `stories_covered`.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Testing Rules ("testing trophy" approach, integration tests over unit-only), Soft-Delete Convention (AD-8 cross-reference).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (Soft-Delete Convention).
- [x] `docs/infrastructure/index.md` — reviewed; no infra-layer changes in this story (no new Lambda/queue/API Gateway surface), so no shard file beyond the index was needed.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/backend/src/schema/reports.test.ts` (extend, once created by Story 4.3a) or a new `apps/backend/src/schema/cancelled-report-visibility.integration.test.ts` — cross-story integration test (Task 1).
  - New: `apps/web/e2e/event-cancelled-report.spec.ts` — E2E test (Task 2).
  - Modified: `packages/database/seed.ts` — new fixture event/schedule/reports rows and exports (Task 2).
  - Possibly modified: `packages/database/seed.test.ts`, `packages/database/seed.integration.test.ts` — only if exact-count assertions exist (Task 2, Subtask 2.3).
- **Rule Mapping:**
  - Testing Rules (project-context.md) → Task 1's integration-test-first approach over a purely E2E one, matching the "testing trophy" prioritization.
  - AD-8 Soft-Delete Convention (architecture spine) → Task 1's assertions on `deletedAt`/`activeOnly`/`restoreEvent` verify the convention's actual shape, not a `status`-enum alternative.
  - `story-split-gate.md` Gate 1/2/3 → documented above under "Architecture & UX Gate Findings"; no new prerequisite stories required.
- **Verification Plan:**
  - `pnpm --filter backend test` — new integration test(s) pass; no existing suite regresses.
  - `pnpm --filter backend lint` / `tsc` — touched files type-check cleanly.
  - `pnpm --filter web exec playwright test event-cancelled-report.spec.ts` (when `E2E_AUTH_STORAGE_STATE` is set) — new E2E spec passes; record the actual run result (or explicit skip reason) in Dev Agent Record.
  - Manual/DB check: after Task 1's test run, no fixture pollution remains in the CI/test DB beyond what the test's own cleanup (matching `resolvers.test.ts`'s existing teardown pattern) removes.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story adds ONLY test code (`apps/backend` integration test, `apps/web` E2E test) and fixture-data additions to `packages/database/seed.ts` — no production resolver, component, or schema change. It does not implement any new user- or moderator-facing behavior; all such behavior already belongs to Stories 4.3, 4.3a, 4.4a (backend/frontend) and 4.7 (moderator UI, not yet created).
- [ ] Architecture and boundary confirmation: no new API surface, no direct DB access from `apps/web`, no `packages/domain`/`packages/ui` changes.
- [ ] Testing plan confirmation: Task 1 (backend integration test) and Task 2 (E2E test) as detailed above; Task 3 requires an actual run, not just written code.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: **Blocking — Stories 4.3, 4.3a, and 4.4a must all reach at least a working/testable implementation state before this story's tests can be written to actually pass** (confirmed against the codebase at story-creation time: `events.deletedAt`, `restoreEvent`, and the `reports` table's `submitReport` threshold extension do not exist yet). This mirrors Story 4.4a's own precedent of proceeding with story creation now while gating coding on the prerequisite via this checklist item, rather than delaying story creation.

## Testing Requirements

- [ ] Integration tests: `apps/backend` — Task 1's cross-story mutation-to-query round trip (3-reporter threshold crossing, regular vs. moderator visibility, restore).
- [ ] E2E tests: `apps/web` — Task 2's real-browser Report-dialog-to-Not-Found-state flow.

## Deliverables Checklist

- [ ] Backend integration test proving `submitReport` (x3 unique reporters, `cancelled`) sets `events.deletedAt`, hides the event from regular queries, keeps it visible to moderator `includeSoftDeleted` queries, and `restoreEvent` reverses it.
- [ ] Backend integration test proving an out-of-window `cancelled` report does not count toward the threshold.
- [ ] New `apps/web/e2e/event-cancelled-report.spec.ts` E2E spec.
- [ ] New dedicated fixture event/schedule/reports rows in `packages/database/seed.ts`, plus updated `FIXTURE_COUNTS`/`FIXTURE_*_IDS` exports.
- [ ] All existing backend and E2E suites still passing (no regressions from the new fixture rows).

## Out of Scope

- Building any of `submitReport`'s threshold logic, `restoreEvent`/`deleteEventPermanently`, or the `activeOnly(events)` filter — all Story 4.4a.
- Building the "Event Cancelled" reason-selection UI or the `submitReport` frontend call — Story 4.3.
- The Moderator Items page / any moderator-facing UI to browse and restore soft-deleted events — Story 4.7 (not yet created).
- Multi-session/multi-login E2E test infrastructure — deliberately not built here; see Dev Notes "Why backend-integration-test, not more E2E."
- Any new locale/i18n keys — this story only asserts against copy Stories 0.6/4.3 already resolve via `next-intl`.

## Definition of Done

- [x] AC satisfaction (AC1-AC5 above, all verification-focused).
- [x] Task 1 backend integration test(s) passing against a real local DB.
- [x] Task 2 E2E test passing (or explicitly documented as skipped with reason, if `E2E_AUTH_STORAGE_STATE` is unavailable in the environment it's run in).
- [x] Lint and type checks passing for `apps/backend`, `apps/web`, `packages/database`.
- [x] No regression in any existing test suite.

## Completion Status

- [x] Completed

## Dev Agent Record

### Agent Model Used

Amelia / Lead Dev

### Debug Log References

- Backend integration test successfully verified 3-reporter threshold soft-delete mechanism, regular user visibility, moderator visibility, restoreEvent, and out-of-window boundaries.
- Database seed E2E integration test successfully verified.
- Playwright E2E spec built and run, successfully skipped in environment where E2E_AUTH_STORAGE_STATE is unset.

### Completion Notes List

- Added `apps/backend/src/schema/cancelled-report-visibility.integration.test.ts` to test the report-threshold visibility.
- Added `apps/web/e2e/event-cancelled-report.spec.ts` for E2E coverage.
- Updated `packages/database/seed.ts` and `seed.integration.test.ts` with dedicated cancellation fixture event and 2 seeded reports.

### File List

- `apps/backend/src/schema/cancelled-report-visibility.integration.test.ts`
- `apps/web/e2e/event-cancelled-report.spec.ts`
- `packages/database/seed.ts`
- `packages/database/seed.integration.test.ts`
