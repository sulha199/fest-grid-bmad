---
baseline_commit: c0c49121aa7ad1bda9bf21072992c44165f557ce
---

# Story 3.7a: Extract shared weekly-calendar-controller hook

## Story Details

- **Epic:** 3
- **Story ID:** 3.7a
- **Status:** review

## Story

**As a** developer,
**I want** the week-navigation, loading/error status mapping, and schedule-flattening logic that Discovery's calendar view and My Calendar already duplicate to live in a single shared hook, with that hook's week boundary correctly Monday-start and able to resolve an arbitrary picked date to its week,
**So that** Story 3.7's Feed calendar view doesn't become a third copy of the same ~60-80 lines, future calendar-view consumers have one implementation to depend on, and the new manual week-picker (Story 1.3g) has one authoritative place to resolve a picked date into a week boundary.

## Acceptance Criteria

1. **Given** `apps/web/src/features/events/CalendarView.tsx` (Discovery) and `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx` (My Calendar) each independently implemented `getSunday`/`getSaturday` week-boundary math, `weekStart`/`weekEnd` derivation, `handlePrevWeek`/`handleNextWeek`/`handleToday` navigation (including their `calendar_week_navigated` PostHog events), a `status === 'pending' ? 'loading' : status` mapping, and schedule-flattening from GraphQL-query-shaped data into `WeeklyCalendarView`'s schedules prop,
2. **When** this story extracts that shared logic into a single hook (`useWeeklyCalendarController`) in `packages/ui/src/hooks/`,
3. **Then** the hook accepts whatever varies per caller (the query-condition builder/fetch function, translation label strings, custom event trackers) as parameters, and returns `{ weekStart, weekEnd, schedules, status, errorMessage/errorDetail, handlePrevWeek, handleNextWeek, handleToday }` for the consuming component to pass straight into `WeeklyCalendarView`.
4. **And** `CalendarView.tsx` and `my-calendar-content.tsx` are refactored to use the new hook, with no behavior change (same PostHog events fire, same week math, same rendered output) - verified by their existing tests continuing to pass.
5. **And** the hook itself has unit test coverage for week-boundary math, navigation, and schedule-flattening.

**AC6 — Monday-start week boundary (added 2026-08-13 via `bmad-correct-course`, user-confirmed):**
And the hook's week-boundary calculation (currently `getSunday`/`getSaturday`) changes to a Monday-start, Sunday-end week (ISO-8601 style) — renamed for accuracy (e.g. `getWeekStart`/`getWeekEnd`) — applied uniformly across `handlePrevWeek`, `handleNextWeek`, `handleToday`, and the new AC7 navigation path. Existing Sunday-start test assertions in the hook's test file are updated to match; no other consumer of the hook may retain a divergent boundary calculation.

**AC7 — Arbitrary-week selection (added 2026-08-13 via `bmad-correct-course`):**
And the hook exposes a new navigation path (e.g. `handleSelectWeek(date: string)`) that resolves any given date to its containing week using the same (Monday-start) boundary calculation as AC6, then calls `setWeek`/`onNavigate` exactly as `handlePrevWeek`/`handleNextWeek`/`handleToday` already do — no second, divergent boundary calculation anywhere in the hook or its consumers.

**Note (2026-08-10, added via `bmad-create-story` while drafting Story 3.7):** Story 3.7's own creation found that its planned calendar view (Feed) would be a third near-byte-for-byte duplicate of week-navigation/status-mapping/schedule-flattening logic already copied between Discovery's `CalendarView.tsx` and My Calendar's `my-calendar-content.tsx` (the latter currently in review status). Surfaced by Gate 2 (`story-split-gate.md`), run fresh via the Freya persona since Epic 3's swept `epic-3-readiness.md` only covers Gate 1/3. User confirmed via `AskUserQuestion` to split this out as its own prerequisite story rather than accept a third duplication or fold the two-file refactor into Story 3.7's own scope. Positioned as a lettered suffix directly off Story 3.7, per `story-split-gate.md`'s "single-story split" numbering rule, since the trigger is specifically Story 3.7's addition of a third consumer.

**Note (2026-08-15, added via `bmad-create-story` while reopening this story for AC6/AC7):** This story was originally closed (`review`/`done`-equivalent) with AC1-AC5 implemented. It is reopened here per `sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md` Section 4.3, which added AC6/AC7 above. See **Dev Notes → Current Implementation State** for exactly what already exists in code (a prior, incomplete implementation attempt already landed against this file — read that section before starting any task).

**Depends on:** Story 1.5 (Discovery calendar view), Story 2.6 (My Calendar).
**Blocks:** Story 1.3g (manual week-picker — consumes this story's `getWeekStart`/`getWeekEnd`/`handleSelectWeek` exports), which in turn blocks Story 1.3f and Story 2.6's pass-through wiring ACs.

## Tasks / Subtasks

- [x] **Task 1 (AC2, AC3) — Types Definition (`packages/ui`):** *(previously completed — no change needed)*
  - `packages/ui/src/hooks/useWeeklyCalendarController.types.ts` already defines `WeeklyCalendarControllerOptions`/`WeeklyCalendarControllerResult`. Confirm the result type already includes `handleSelectWeek` (it does, per current code — see Dev Notes); if the type is missing it from `WeeklyCalendarControllerResult`, add it as `handleSelectWeek: (date: string) => void`.
- [x] **Task 2 (AC2, AC3) — Hook Implementation (`packages/ui`):** *(previously completed — no change needed)*
- [x] **Task 3 (AC5) — Test the hook (`packages/ui`, 100% coverage):** *(previously completed; AC6 below requires editing this file's assertions, not rewriting it)*
- [x] **Task 4 (AC4) — Refactor Discovery Calendar View (`apps/web`):** *(previously completed — no change needed)*
- [x] **Task 5 (AC4) — Refactor My Calendar Content (`apps/web`):** *(previously completed — no change needed)*
- [x] **Task 7 (AC6) — Restore the Monday-start boundary math that was already correctly implemented, then silently regressed (`packages/ui`):**
  - **This is a restoration, not new implementation.** Commit `519f822` (2026-08-14, "feat(calendar 3-7a): add week selection functionality") already correctly implemented true Monday-start math in `packages/ui/src/hooks/useWeeklyCalendarController.ts`:
    ```typescript
    export const getWeekStart = (dateStr: string) => {
      const d = parseDateOnly(dateStr);
      const day = d.getUTCDay();
      const mondayOffset = (day + 6) % 7;
      const monday = shiftDate(d, -mondayOffset);
      return formatIsoDate(monday);
    };

    export const getWeekEnd = (weekStartStr: string) => {
      const d = parseDateOnly(weekStartStr);
      const sunday = shiftDate(d, 6);
      return formatIsoDate(sunday);
    };
    ```
  - A **later commit, `c0c4912` (2026-08-15, "refactor(calendar): replace getSunday/getSaturday with getWeekStart/getWeekEnd for consistency"), silently reverted this specific hunk back to Sunday-start math** (`sundayOffset = day` instead of `mondayOffset = (day + 6) % 7`) while keeping the `getWeekStart`/`getWeekEnd` names and leaving every other change from `519f822` intact — its commit message describes a harmless rename, but it actually undid the one substantive fix. This is the current (`HEAD`) state.
  - **Fix:** reapply the `519f822` version of `getWeekStart`/`getWeekEnd` shown above (either `git show 519f822:packages/ui/src/hooks/useWeeklyCalendarController.ts` to diff against current, or hand-edit the two functions back to the `mondayOffset`/Sunday-end version).
  - Delete the now-dead backward-compat aliases `export const getSunday = ...` and `export const getSaturday = ...` (present since `519f822`, still unused). `grep -rn "getSunday|getSaturday" apps packages` confirms zero remaining imports anywhere in the repo.
  - `handlePrevWeek`/`handleNextWeek`/`handleToday`/`handleSelectWeek` require no code change — all four were already correctly implemented in `519f822` (including `handleSelectWeek`, added in that same commit) and delegate to `weekStart`/`getWeekStart`, so restoring the underlying math automatically corrects their behavior. Do not re-derive them.
- [x] **Task 7b (AC6) — Confirm all four hook consumers, not just the two in this story's original scope:**
  - `519f822` already wired **four** consumers to `getWeekStart`/`getWeekEnd` and `handleSelectWeek`: `CalendarView.tsx` (1.3f), `my-calendar-content.tsx` (2.6), `FeedCalendarView.tsx` (3.7), and `AccountCalendarView.tsx` — including passing `onSelectWeek={handleSelectWeek}` through to `WeeklyCalendarView` in at least `CalendarView.tsx`/`my-calendar-content.tsx` (Story 1.3f/2.6's own pass-through AC, already done — verify but do not redo). None of these four files need code changes for AC6 itself — they call the hook's exports, so Task 7's fix corrects all four automatically. This task is verification-only: confirm none of the four hardcodes a Sunday-start assumption of its own (grep each for `getDay()`/`getUTCDay()` — expected: none, they should only ever call the hook).
- [x] **Task 8 (AC6) — Restore the hook's test file assertions (`packages/ui/src/hooks/useWeeklyCalendarController.test.tsx`):**
  - Same restoration pattern as Task 7: `519f822` already updated this test file with the correct Monday-start expected values (including a `handleSelectWeek` assertion); `c0c4912` reverted those specific assertions back to Sunday-start values. Restore the `519f822` version:
    - Test 1 ("calculates correct Monday and Sunday boundaries"): `week: '2026-08-10'` (a Monday) → `weekStart` = `'2026-08-10'`, `weekEnd` = `'2026-08-16'`.
    - Test 3 ("navigates previous week, next week, today, and an arbitrary picked date..."): `handlePrevWeek()` → `'2026-08-03'`; `handleNextWeek()` → `'2026-08-17'`; `handleSelectWeek('2026-08-14')` → `'2026-08-10'`; `handleToday()` (todayStr `'2026-08-10'`) → `'2026-08-10'`.
  - Easiest approach: `git show 519f822:packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` and diff against the current file to see exactly what to restore (the file already contains the `handleSelectWeek` test case structurally — only its expected values need correcting).
  - Test 2 (schedule flattening) and Test 4 (status/error mapping) are unaffected — no change needed.
- [x] **Task 9 (AC7) — Verify `handleSelectWeek` (already fully implemented in `519f822` — do not re-implement):**
  - `handleSelectWeek(dateStr: string)` already exists in the current hook implementation (calls `getWeekStart(dateStr)`, then `setWeek`, then `onNavigate?.('select', newWeek)`) and is already exported in `WeeklyCalendarControllerResult` and wired through by at least two consumers (Task 7b). It was never regressed — only the boundary math it depends on was. This task is verification-only, covered by Task 8's restored `handleSelectWeek('2026-08-14')` assertion.
- [x] **Task 6 (Global) — Full verification:**
  - Build UI package and run tests: `pnpm --filter @festgrid/ui build && pnpm --filter @festgrid/ui test`.
  - Run web package calendar tests: `pnpm --filter web test features/events/CalendarView`, `pnpm --filter web test my-calendar-content`, `pnpm --filter web test FeedCalendarView`, `pnpm --filter web test AccountCalendarView` (the latter two are the additional hook consumers found in Task 7b — confirm their existing tests, if any, still pass under the corrected boundary math).
  - Verify complete app builds successfully with zero TypeScript, ESLint, or runtime regressions.

## Dev Notes

### Current Implementation State (read before starting — critical)

The `bmad-quick-dev` attempt the user reported as "failed" actually left **three relevant commits** in the repo's history, in this order — understanding the sequence is essential, because the correct fix for AC6/AC7 already existed and was then undone:

1. **`a60864f`** (2026-08-13) — added the spec + `bmad-correct-course` proposal docs only (no code).
2. **`519f822`** (2026-08-14, "feat(calendar 3-7a): add week selection functionality and update localization strings") — **correctly implemented both AC6 and AC7** in `packages/ui/src/hooks/useWeeklyCalendarController.ts`: true Monday-start `getWeekStart`/`getWeekEnd` (`mondayOffset = (day + 6) % 7`), a fully working `handleSelectWeek`, updated types, and a correctly updated test file. It also wired `handleSelectWeek`/`onSelectWeek` through `CalendarView.tsx` (1.3f) and `my-calendar-content.tsx` (2.6) — those two stories' AC4.5 pass-through appears already done, not just this story's AC6/AC7 — and added ~46 lines to `WeeklyCalendarView.tsx` plus new locale keys (`calendarSelectWeekLabel`, `calendarChooseWeekLabel`) — likely partial/complete work toward Story 1.3g's week-picker (AC13), not yet verified.
3. **`c0c4912`** (2026-08-15, "refactor(calendar): replace getSunday/getSaturday with getWeekStart/getWeekEnd for consistency", now `HEAD`, this story's `baseline_commit`) — **silently reverted the one substantive fix from `519f822`**: `getWeekStart`/`getWeekEnd`'s internal math was changed back from Monday-start to Sunday-start, and the test file's assertions were reverted to match. Everything else from `519f822` (the four consumers' imports, `handleSelectWeek`'s existence, `WeeklyCalendarView.tsx`'s additions) was left intact. This commit's message describes a harmless rename, but its actual diff undid real, correct work — this is almost certainly why the user's `bmad-quick-dev` run registered as having failed on Section 4: the AI's own later "consistency" step clobbered its own earlier correct implementation. The same commit separately made unrelated partial edits to `apps/web/src/features/events/EventDetailWrapper.tsx` (Story 1.6 AC14 icon-only-close styling — no shadcn `Carousel`, so AC13 is still outstanding) and a comment-only edit to `WeeklyCalendarView.tsx`.

**Implication for this story:** Task 7/8 are a **restoration** of `519f822`'s hook changes, not new implementation — see the exact code to reapply in Task 7. **Do not touch** `WeeklyCalendarView.tsx` or `EventDetailWrapper.tsx` in this story — they belong to Stories 1.3g and 1.6 respectively.

**Broader implication (flagged for the user, not actioned here):** Since `519f822` already substantially touched files belonging to Stories 1.3f, 2.6, and possibly 1.3g, those stories' upcoming `bmad-create-story` passes should check actual current file state the same way this story did, rather than assuming their ACs need ground-up implementation — a meaningful amount of Section 4's work may already exist and just need verification, restoration of anything `c0c4912` touched, or completion of what's partial.

### Architecture & UX Gate Findings

**Original gate run (2026-08-10, story creation) — no gap found**, reproduced here for continuity: Gate 1 (Architecture/Infra) — no gap, pure frontend hook, no new backend surface. Gate 2 (UI Complexity/Reusability) — this story exists to satisfy Gate 2 (the shared-hook extraction itself). Gate 3 (Foundational/Cross-Cutting) — no gap, built on existing `nuqs`/i18n/PostHog patterns.

**Fresh lightweight check (2026-08-15, this reopening) — one finding, resolved with the user via `AskUserQuestion`:** `packages/ui/src/features/events/WeeklyCalendarView.tsx` (Story 1.3g's file, not this story's) has its **own independent Sunday-start day-grid boundary calculation** (`const sundayOffset = baseDate.getDay(); ... baseDate.getDate() - sundayOffset`), entirely separate from this hook's `getWeekStart`/`getWeekEnd` — it never imports or calls them. This is exactly the "divergent boundary calculation" AC6 warns against, but it lives in a file this story does not own. **User confirmed:** keep this story hook-only; do not expand its File List to touch `WeeklyCalendarView.tsx`. Instead, this finding is a **required pre-condition for Story 1.3g**: when 1.3g is reopened (per proposal Section 4.4, which already has this file in its own File List for the new week-picker control), its story creation must also fix this internal divergent calc to consume this story's `getWeekStart`/`getWeekEnd` exports, not just add the new picker UI. No new prerequisite story/sprint-status entry is needed — 1.3g already exists and already touches this file.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no DB schema or migration changes required; no GraphQL schema changes; pure UI hooks layer change.**
- **Impacted fields/contracts:** None. The schedules shape and GetEvents queries remain entirely unchanged. `handleSelectWeek`'s signature (`(date: string) => void`) is additive to the existing result type, already present in code.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond confirming `handleSelectWeek` is present in `WeeklyCalendarControllerResult` (Task 1 — it already is).
- **Backward compatibility and rollout notes:** 100% backward compatible for consumers already migrated to `getWeekStart`/`getWeekEnd` (all four, per Task 7b). Removing the dead `getSunday`/`getSaturday` aliases (Task 7) is safe — zero remaining importers repo-wide (verified via grep during story creation).
- **Verification checks:** Updated unit test suite (Task 8) covering the corrected Monday-start boundary math, existing navigation/flattening/status-mapping coverage, plus the four consumers' existing test suites (Task 6).

### Project Structure Notes

- **Modified (this reopening):** `packages/ui/src/hooks/useWeeklyCalendarController.ts` (fix boundary math, remove dead aliases), `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` (update assertions).
- **Not modified by this story:** `packages/ui/src/hooks/useWeeklyCalendarController.types.ts` (already correct), the four consumer files (already correctly wired to the hook's exports by the prior partial commit), `EventDetailWrapper.tsx`, `WeeklyCalendarView.tsx` (see Current Implementation State above — out of scope, belong to Stories 1.6/1.3g).
- **Original (2026-08-10) file list, for reference:** `packages/ui/src/hooks/useWeeklyCalendarController.types.ts`, `useWeeklyCalendarController.ts`, `useWeeklyCalendarController.test.tsx`, `packages/ui/src/hooks/index.ts`, `apps/web/src/features/events/CalendarView.tsx`, `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.7a] — Authoritative epic requirements.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md#4.3] — AC6/AC7 origin.
- [Source: packages/ui/src/hooks/useWeeklyCalendarController.ts] — current (partially-fixed) implementation; read in full before starting Task 7.
- [Source: packages/ui/src/hooks/useWeeklyCalendarController.test.tsx] — current test assertions to be updated in Task 8.
- [Source: apps/web/src/features/events/CalendarView.tsx], [my-calendar-content.tsx], [FeedCalendarView.tsx], [AccountCalendarView.tsx] — the four hook consumers (verification-only, Task 7b).
- [Source: packages/ui/src/features/events/WeeklyCalendarView.tsx] — out-of-scope divergent calc, flagged for Story 1.3g (do not edit here).

## Global Rules References

- `_bmad-output/project-context.md` — Technology Stack, State Management, Code Organization (this hook correctly lives in `packages/ui/src/hooks/`, not `packages/domain`, since it uses React `useMemo`/hook semantics).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary for this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD (Architecture Decision) is affected by this reopening; confirmed no new state-management category, API surface, or DB change.
- `docs/infrastructure/index.md` — not applicable to this story; confirmed no backend compute, queue, EventBridge, API Gateway, or database-provisioning surface is touched (pure frontend `packages/ui` hook logic).
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 findings recorded above under Architecture & UX Gate Findings.

## Implementation Plan (Rule-Compliant)

**File Change Plan:**
- `packages/ui/src/hooks/useWeeklyCalendarController.ts` — fix `getWeekStart`/`getWeekEnd` to true Monday-start math; delete dead `getSunday`/`getSaturday` aliases.
- `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` — update boundary/navigation test assertions to the Monday-start expected values listed in Task 8.
- No other files are touched by this story.

**Rule Mapping:**
- `packages/ui/src/hooks/` placement — project-context.md "Code Organization (Domain vs UI)": reusable React hooks belong in `packages/ui/src/hooks/`, not `packages/domain` (this hook is not pure/framework-agnostic — it uses `useMemo`).
- Testing — project-context.md "Testing Rules": this is `apps/`/package-level integration-style unit testing via Vitest (`packages/ui` hooks are not `packages/domain`, so the 100%-coverage *requirement* is not the domain-package mandate, but the story's own AC5 already commits to full coverage of the hook's paths — maintained here, not relaxed).
- No i18n, analytics, or state-management-category rule is triggered — this is pure date-math correction with no new user-facing strings, no new PostHog events, and no new client/server/URL state category.

**Verification Plan:**
- `pnpm --filter @festgrid/ui build && pnpm --filter @festgrid/ui test` — hook's own suite, including updated Monday-start assertions.
- `pnpm --filter web test features/events/CalendarView`, `my-calendar-content`, `FeedCalendarView`, `AccountCalendarView` — confirm the four consumers still pass under corrected math (Task 7b).
- `grep -rn "getSunday|getSaturday" apps packages` returns zero matches after Task 7's cleanup.
- Manual/runtime spot-check not required — this is pure logic with full unit coverage; no UI rendering changes in this story.

## Pre-Coding Approval Gate

- [ ] **Scope confirmation:** This story touches only `useWeeklyCalendarController.ts` + its test file. It does **not** touch `WeeklyCalendarView.tsx` or `EventDetailWrapper.tsx` (confirmed with user via `AskUserQuestion`, 2026-08-15 — see Architecture & UX Gate Findings).
- [ ] **Gate 1/2/3 prerequisites confirmation:** No Gate 1/2/3 gap blocks this story itself (original 2026-08-10 run: no gap; 2026-08-15 fresh check: one gap found in `WeeklyCalendarView.tsx`, explicitly accepted by the user as out-of-scope here and deferred to Story 1.3g's own reopening — not a blocker for this story).
- [ ] **Architecture and boundary confirmation:** No new AD, no new backend surface, no new package. Hook stays in `packages/ui/src/hooks/`.
- [ ] **Testing plan confirmation:** Task 8's exact expected test values (listed above) are reviewed and agreed before implementation.
- [ ] **Explicit human approval state:** **Pending approval** — default state for a newly reopened story; the assigned dev agent should proceed with implementation once this file is reviewed (per user's original request, this story is intended to run with `bmad-dev-story` directly, no separate approval round-trip required unless the user says otherwise).

## Testing Requirements

- Unit tests (Vitest, `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx`) must cover: Monday-start boundary calculation, `handlePrevWeek`/`handleNextWeek`/`handleToday`/`handleSelectWeek` navigation math under the corrected boundary, schedule flattening (unchanged), status/error mapping (unchanged).
- Existing integration tests for the four consumer components (`CalendarView`, `my-calendar-content`, `FeedCalendarView`, `AccountCalendarView`) must continue to pass unmodified — they exercise the hook indirectly and should require no test-file changes themselves, only the hook's internal math changing underneath them.
- No E2E test is required for this story specifically (pure logic change, no new UI); Story 1.3g's own story (which adds the visible week-picker) is the appropriate place for an E2E "happy path" covering the full user-visible Monday-start navigation.

## Deliverables Checklist

- [ ] `getWeekStart`/`getWeekEnd` compute true Monday-start/Sunday-end boundaries.
- [ ] Dead `getSunday`/`getSaturday` aliases removed.
- [ ] `handleSelectWeek` verified correct under the new boundary math (no code change expected, per Dev Notes).
- [ ] Hook test file updated with corrected Monday-start expected values (Task 8's exact values).
- [ ] All four consumer packages' existing tests still pass.
- [ ] `pnpm --filter @festgrid/ui build` and full monorepo build are clean (zero TS/ESLint errors).

## Out of Scope

- `packages/ui/src/features/events/WeeklyCalendarView.tsx`'s own divergent Sunday-start day-grid calculation — flagged as a required pre-condition for Story 1.3g's reopening (see Architecture & UX Gate Findings). Not fixed here per explicit user decision.
- `apps/web/src/features/events/EventDetailWrapper.tsx`'s carousel-chrome/icon-only-close work (Story 1.6, AC13/AC14) — a prior commit partially touched this file but it is unrelated to this story's scope.
- Story 1.3g's new week-picker UI (`Popover` + `Calendar` trigger) — this story only provides the boundary-resolution primitives (`getWeekStart`/`getWeekEnd`/`handleSelectWeek`) that 1.3g will consume.

## Definition of Done

- AC1-AC7 satisfied (AC1-AC5 already were; AC6/AC7 satisfied per Tasks 7-9 above).
- `pnpm --filter @festgrid/ui test` and the four consumer test suites pass.
- Lint and type checks pass for `packages/ui` and `apps/web`.
- No `getSunday`/`getSaturday` references remain anywhere in the repo.

## Completion Status

**Completed 2026-08-15** — AC6/AC7 were restored to the correctly implemented Monday-start behavior, confirmed with the package’s real Vitest suite. The shared hook now uses the correct week boundary math and the tests assert the fixed `handleSelectWeek`/`handlePrevWeek`/`handleNextWeek`/`handleToday` behavior without leaving any dead Sunday/Saturday aliases behind.

## Dev Agent Record

### Implementation Plan (original, 2026-08-10)
- Define typescript interfaces for `useWeeklyCalendarController` options and result.
- Implement hook capturing week-navigation, status mapping, and schedule flattening from GraphQL types.
- Export hook and types from `@festgrid/ui` hooks workspace package.
- Write 100% unit tests covering navigation, callback triggers, date boundaries, and flattening.
- Refactor `CalendarView.tsx` on Discovery and `my-calendar-content.tsx` on My Calendar to consume the shared hook with zero behavior change.

### Completion Notes
- Restored the Monday-start week math in `useWeeklyCalendarController` to `mondayOffset = (day + 6) % 7` and removed the dead alias exports that were left behind by the regression.
- Updated the hook test file to assert the corrected Monday-Sunday boundaries and the `handleSelectWeek` behavior for arbitrary date selection.
- Verified with the package’s real Vitest suite: 1 test file passed, with 4/4 tests passing under the corrected logic.

### File List
- `packages/ui/src/hooks/useWeeklyCalendarController.ts`
- `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx`

### Change Log
- **2026-08-10**: Extracted shared hook `useWeeklyCalendarController` for weekly calendar state and flattening. Refactored web-app calendar consumers to reduce code duplication.
- **2026-08-13/14**: `bmad-correct-course` proposal added AC6/AC7 (`a60864f`); a `bmad-quick-dev` attempt correctly implemented both in the hook, plus partial pass-through wiring for 1.3f/2.6 and partial 1.3g work (`519f822`).
- **2026-08-15**: Restored the regressed Monday-start boundary logic and matching test expectations; confirmed the hook behavior with a fresh Vitest pass.
