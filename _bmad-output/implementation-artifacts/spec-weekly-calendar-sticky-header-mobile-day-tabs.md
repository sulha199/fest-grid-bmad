---
title: 'WeeklyCalendarView: sticky header, responsive mobile nav, day-tab strip'
type: 'feature'
created: '2026-10-08'
status: 'in-review'
baseline_commit: '47bd77e3f81ae96929c6808241af11c01cf92d23'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The weekly calendar fetches a whole week, which suits desktop, but on mobile it renders a long per-date collapsible list. The day-column headers also scroll away, and the header controls are not laid out for narrow screens.

**Approach:** Keep the whole-week fetch and no endpoint change. On mobile, hold the already-fetched week and show one day at a time via a 7-button day-tab strip (same 7-equal-column position as the desktop header columns). Make the day headers/tab strip sticky, and make the week-navigation header responsive.

## Boundaries & Constraints

**Always:**
- Mobile day switching only filters the already-fetched `schedules` (the existing `dayBuckets`); no per-day fetch.
- Week changes on mobile only via prev/next buttons, Today, or `WeekPicker`. Tabs never change the week.
- Selected day defaults to today if it falls in the visible week, else the first day. Re-derive on every `weekStart` change.
- Keep the `MOBILE_INLINE_CAP` + "+N more" overflow dialog behavior for the selected day.
- Z-index: follow AD-33 tiers; Local tiers (`z-10`..) only inside an `isolate` ancestor. No raw `z-40/50` or `z-[…]`.
- UI strings stay label-driven (`labels` prop), matching the existing pattern.

**Ask First:** If a sticky `top` offset is needed under the app-shell chrome, HALT and ask before hardcoding a value.

**Never:** Change GraphQL queries, the controller's fetch contract, or desktop card/spanning-bar rendering. Do not remove the desktop overflow dialog.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initial mobile load, current week | today within week | today's tab selected; only today's schedules listed | N/A |
| Other week (next/picker) | today not in week | first day tab selected | N/A |
| Tab tap | click Thursday | Thursday's schedules shown; week unchanged, no refetch | N/A |
| Empty day | selected day has 0 schedules | tab still selectable; shows empty-day message | N/A |
| Prev week at current week | `isPrevWeekDisabled` | prev button disabled | N/A |
| Multi-day run covering selected day | run spans Tue–Thu, Wed selected | appears in Wed list (existing mobile exemption) | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- header (L838-879), desktop day headers (L884-893), mobile list (L996-1087), `dayOverrides` collapse state (L735).
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts` -- `labels` (`expandDayLabel`/`collapseDayLabel` become unused; add tab/empty-day labels).
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` -- "Mobile Vertical List View" (L978) and "Mobile Day Collapse State" (L1914) suites rely on the per-date toggle/rows.
- `packages/ui/src/hooks/useWeeklyCalendarController.ts` -- unchanged (week navigation already exposed).

## Tasks & Acceptance

**Execution:**
- [x] `WeeklyCalendarView.tsx` -- replace `dayOverrides`/`mobile-day-toggle` list with `selectedDayIdx` state (default today/first day, reset on `weekStart` change) and render only that day's segments (keep `mobile-day-row` testid on the single day panel) -- tab-style UX.
- [x] `WeeklyCalendarView.tsx` -- add `role="tablist"` 7-column strip (`grid grid-cols-7`, weekday + date number, `role="tab"`, `aria-selected`, `aria-controls`, arrow-key nav, today marker) with `role="tabpanel"` -- accessibility + desktop-header parity.
- [x] `WeeklyCalendarView.tsx` -- make desktop day-header row and mobile tab strip `sticky top-0` inside an `isolate` wrapper (dialog stays outside it) -- stays visible while scrolling.
- [x] `WeeklyCalendarView.tsx` -- responsive header: on mobile stack the date range above one row of `[prev][picker][Today][next]` with a 44px min tap target; keep desktop layout unchanged.
- [x] `WeeklyCalendarView.types.ts` -- add `dayTabsLabel`, `noSchedulesLabel`; mark `expandDayLabel`/`collapseDayLabel` removed and update `apps/web` consumers/messages if any.
- [x] `WeeklyCalendarView.test.tsx` -- rewrite the mobile suites for tabs (default today/first day, switch, week-change reset, empty day, overflow cap on selected day, keyboard nav); add sticky-class assertions.

**Acceptance Criteria:**
- Given the current week on mobile, when the calendar renders, then 7 day tabs show with today selected and only today's schedules listed.
- Given a day tab is clicked, when it activates, then that day's schedules show and no navigation/refetch callback fires.
- Given next-week/Today/picker is used, when `weekStart` changes, then selection resets per the default rule.
- Given the page scrolls, when the header is past the viewport top, then the desktop day headers and mobile tab strip remain visible.
- Given a 375px viewport, when the header renders, then controls do not overflow horizontally.

## Design Notes

Local state only, no controller change: `const [selectedDayIdx, setSelectedDayIdx] = useState(defaultIdx)` plus an effect keyed on `weekStart` (and `todayISO`) that recomputes `defaultIdx = visibleDays.findIndex(d => toISODateString(d) === todayISO)` (fallback 0). Because `dayBuckets` is already week-wide, tab switches are pure renders.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test -- WeeklyCalendarView` -- expected: pass
- `pnpm --filter @festgrid/ui lint` and `pnpm -w typecheck` -- expected: clean

**Manual checks (if no CLI):**
- 375px and ≥768px viewports: tabs, sticky behavior, header wrapping, picker/next-week reset.
