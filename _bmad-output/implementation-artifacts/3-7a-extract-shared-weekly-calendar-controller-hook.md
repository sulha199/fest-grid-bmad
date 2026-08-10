---
baseline_commit: 7111612b0fe0847ae9a372bc2bcbb441ee235ff4
---

# Story 3.7a: Extract shared weekly-calendar-controller hook

## Story Details

- **Epic:** 3
- **Story ID:** 3.7a
- **Status:** ready-for-dev

## Story

**As a** developer,
**I want** the week-navigation, loading/error status mapping, and schedule-flattening logic that Discovery's calendar view and My Calendar already duplicate to live in a single shared hook,
**So that** Story 3.7's Feed calendar view doesn't become a third copy of the same ~60-80 lines, and future calendar-view consumers have one implementation to depend on.

## Acceptance Criteria

1. **Given** `apps/web/src/features/events/CalendarView.tsx` (Discovery) and `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx` (My Calendar) each independently implement `getSunday`/`getSaturday` week-boundary math, `weekStart`/`weekEnd` derivation, `handlePrevWeek`/`handleNextWeek`/`handleToday` navigation (including their `calendar_week_navigated` PostHog events), a `status === 'pending' ? 'loading' : status` mapping, and schedule-flattening from GraphQL-query-shaped data into `WeeklyCalendarView`'s schedules prop,
2. **When** this story extracts that shared logic into a single hook (`useWeeklyCalendarController`) in `packages/ui/src/hooks/`,
3. **Then** the hook accepts whatever varies per caller (the query-condition builder/fetch function, translation label strings, custom event trackers) as parameters, and returns `{ weekStart, weekEnd, schedules, status, errorMessage/errorDetail, handlePrevWeek, handleNextWeek, handleToday }` for the consuming component to pass straight into `WeeklyCalendarView`.
4. **And** `CalendarView.tsx` and `my-calendar-content.tsx` are refactored to use the new hook, with no behavior change (same PostHog events fire, same week math, same rendered output) - verified by their existing tests continuing to pass.
5. **And** the hook itself has unit test coverage for week-boundary math, navigation, and schedule-flattening.

**Note (2026-08-10, added via `bmad-create-story` while drafting Story 3.7):** Story 3.7's own creation found that its planned calendar view (Feed) would be a third near-byte-for-byte duplicate of week-navigation/status-mapping/schedule-flattening logic already copied between Discovery's `CalendarView.tsx` and My Calendar's `my-calendar-content.tsx` (the latter currently in review status). Surfaced by Gate 2 (`story-split-gate.md`), run fresh via the Freya persona since Epic 3's swept `epic-3-readiness.md` only covers Gate 1/3. User confirmed via `AskUserQuestion` to split this out as its own prerequisite story rather than accept a third duplication or fold the two-file refactor into Story 3.7's own scope. Positioned as a lettered suffix directly off Story 3.7, per `story-split-gate.md`'s "single-story split" numbering rule, since the trigger is specifically Story 3.7's addition of a third consumer.

**Depends on:** Story 1.5 (Discovery calendar view), Story 2.6 (My Calendar).

## Tasks / Subtasks

- [ ] **Task 1 (AC2, AC3) — Types Definition (`packages/ui`):**
  - Create `packages/ui/src/hooks/useWeeklyCalendarController.types.ts` defining options and return types:
    ```typescript
    export interface WeeklyCalendarControllerOptions<TEvent = any> {
      week: string;
      setWeek: (week: string) => void | Promise<void>;
      todayStr: string;
      rawEvents: TEvent[] | null | undefined;
      queryStatus: 'pending' | 'success' | 'error' | string;
      queryError: any;
      onNavigate?: (direction: 'previous' | 'next' | 'today', newWeek: string) => void;
      errorStateLabel?: string;
    }

    export interface WeeklyCalendarControllerResult<TSchedule = any> {
      weekStart: string;
      weekEnd: string;
      schedules: TSchedule[];
      status: 'loading' | 'success' | 'error' | string;
      errorMessage: string;
      errorDetail: string | undefined;
      handlePrevWeek: () => void;
      handleNextWeek: () => void;
      handleToday: () => void;
    }
    ```
- [ ] **Task 2 (AC2, AC3) — Hook Implementation (`packages/ui`):**
  - Create `packages/ui/src/hooks/useWeeklyCalendarController.ts` implementing `useWeeklyCalendarController` that encapsulates:
    - Boundary math (`getSunday`, `getSaturday`) using existing date logic.
    - Navigation event triggers calling `setWeek` and the optional custom tracker `onNavigate`.
    - Flattening function for schedules:
      ```typescript
      const rawEvents = options.rawEvents ?? [];
      const schedules = useMemo(() => {
        return rawEvents.flatMap((event: any) => {
          return (event.schedules || []).map((schedule: any) => ({
            id: schedule.id,
            eventSlug: event.slug,
            eventName: event.eventName,
            isMainSchedule: schedule.isMainSchedule,
            eventStartDate: schedule.eventStartDate,
            eventEndDate: schedule.eventEndDate,
            eventStartTime: schedule.eventStartTime,
            eventEndTime: schedule.eventEndTime,
            isFavorited: !!event.isFavorited,
            isAddedToCalendar: !!schedule.isAddedToCalendar,
          }));
        });
      }, [rawEvents]);
      ```
    - Error detail extraction and status mapping (`status === 'pending' ? 'loading' : status`).
  - Export the hook from `packages/ui/src/hooks/index.ts` and ensure it is exposed.
- [ ] **Task 3 (AC5) — Test the hook (`packages/ui`, 100% coverage):**
  - Create `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` using `@testing-library/react` (specifically `renderHook` and `act` from `vitest`) to verify:
    - Boundary calculation for Sunday-to-Saturday.
    - Previous, Next, and Today navigation math and action dispatch.
    - Callback triggers for telemetry (`onNavigate`).
    - Multi-schedule flattening with nested items.
- [ ] **Task 4 (AC4) — Refactor Discovery Calendar View (`apps/web`):**
  - In `apps/web/src/features/events/CalendarView.tsx`, import `useWeeklyCalendarController` from `@festgrid/ui`.
  - Refactor components to replace localized date math, state derivations, flat-mapping, and event handlers with a clean, single-hook call.
  - Maintain the exact PostHog telemetry: `calendar_week_navigated`.
- [ ] **Task 5 (AC4) — Refactor My Calendar Content (`apps/web`):**
  - In `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx`, import `useWeeklyCalendarController` from `@festgrid/ui`.
  - Refactor to consume `useWeeklyCalendarController`.
  - Retain customized post-flattening client-side filters (favorited vs added toggles) on top of the shared schedules array.
  - Maintain identical telemetry events (`calendar_week_navigated`, `my_calendar_page_viewed`).
- [ ] **Task 6 (Global) — Full verification:**
  - Build UI package and run tests: `pnpm --filter @festgrid/ui build && pnpm --filter @festgrid/ui test`.
  - Run web package calendar tests: `pnpm --filter web test features/events/CalendarView` and `pnpm --filter web test my-calendar-content`.
  - Verify complete app builds successfully with zero TypeScript, ESLint, or runtime regressions.

## Dev Notes

### Architecture & UX Gate Findings

**This story is NOT covered by the swept `epic-3-readiness.md`** — its frontmatter `stories_covered` list includes `3.7`, but not `3.7a` (which was created on 2026-08-10 during Story 3.7's creation pass). Per the lightweight-guard instruction in `story-split-gate.md`, all three gates were run fresh:

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** This refactoring story maintains the strict GraphQL-only client-server interface, adding no backend queries, schemas, database changes, or infrastructure layers. It encapsulates existing frontend patterns.
- **Gate 2 (UI Complexity & Reusability) — Met with excellence.** In fact, this story exists solely to satisfy Gate 2! During Story 3.7's creation, the planned Feed calendar view was evaluated and met the "rule of three" duplicate trigger (copy-pasting ~60-80 lines of identical week-navigation, status mapping, and schedule-flattening code for the third time). Splitting this out ensures a single shared controller hook, eliminating code duplication.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Built on established navigation frameworks (`nuqs`), translation layers, and telemetry architectures (`@festgrid/analytics` / PostHog) with zero new cross-entity dependencies.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no DB schema or migration changes required; no GraphQL schema changes; pure UI hooks layer additive change.**
- **Impacted fields/contracts:** None. The schedules shape and GetEvents queries remain entirely unchanged.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** Purely additive types file `useWeeklyCalendarController.types.ts`.
- **Backward compatibility and rollout notes:** 100% backward compatible. Web app components will be refactored to consume the shared hook with zero behavioral adjustments.
- **Verification checks:** Exhaustive unit test suite covering 100% of the hook's paths, along with existing suite runs.

### Project Structure Notes

- **New:** `packages/ui/src/hooks/useWeeklyCalendarController.ts`, `useWeeklyCalendarController.types.ts`, `useWeeklyCalendarController.test.tsx`.
- **Modified:** `packages/ui/src/hooks/index.ts` (new re-exports); `apps/web/src/features/events/CalendarView.tsx` (consumed hook); `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx` (consumed hook).
- **Not modified:** All databases, schema files, backend resolvers, or infrastructure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.7a] — Authoritative epic requirements.
- [Source: apps/web/src/features/events/CalendarView.tsx] — Discovery page reference implementation.
- [Source: apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx] — My Calendar page reference implementation.
- [Source: packages/ui/src/hooks/index.ts] — Core exports.
