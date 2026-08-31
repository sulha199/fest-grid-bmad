---
title: 'ux-rework2-p1-calendar-mobile-collapsible-days'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'ready-for-dev'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md`'s P1 item: "calendar view on mobile: make days collapsible; default collapsed for past days, default expanded for today and future days." Today, `WeeklyCalendarView`'s mobile day-list always renders every day fully expanded with no collapse affordance at all.

**Approach:** Add per-day collapse state to the mobile block only (desktop's grid/popover layout is untouched), defaulting each day's initial state from a today-vs-date comparison, toggleable via a button in the day header.

## Boundaries & Constraints

**Always:** Scope changes to the mobile block (`data-testid="mobile-calendar-view"`) only — do not touch the desktop grid/popover block. Reuse the existing `toISODateString` helper (already used for `currentDayStr` on each `CalendarCard`) for date comparison rather than adding a new date library. Follow the existing `aria-expanded` idiom already used in this file (the "+N more" popover trigger) for the toggle button.

**Ask First:** None — the default-state rule (past=collapsed, today/future=expanded) and the reuse-existing-helpers constraint fully determine the design.

**Never:** Do not add a day-level event count badge or any other visual addition beyond the collapse toggle itself. Do not change desktop's cap/popover behavior (that's the separately-deferred, already-flagged-as-entangled item). Do not touch any other already-`done` ux-rework2 item.

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/WeeklyCalendarView.tsx:57-62` -- existing `toISODateString(d: Date)` helper, reuse for both "today" and each day's date.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx:356` -- `const [openPopoverDayIdx, ...] = useState(...)`, the nearest existing per-day UI state; add the new collapse state near here.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx:592` -- desktop's `aria-expanded={openPopoverDayIdx === dayIdx}` + `aria-haspopup="dialog"` popover trigger; the `aria-expanded` idiom to mirror (this change needs no `aria-haspopup`, it's an inline disclosure not a popup).
- `packages/ui/src/features/events/WeeklyCalendarView.tsx:648-681` -- the mobile day-list block: `dayBuckets` filtered to non-empty days (line 649-651), each rendered as a `data-testid="mobile-day-row"` div (654) with a plain-text header (656-658) and an unconditional `bucket.map(...)` of `CalendarCard`s (659-677).
- `packages/ui/src/features/events/WeeklyCalendarView.tsx:4` -- `lucide-react` import line; add a chevron icon (no rotate-icon precedent exists in this codebase to copy, so use `ChevronDown` with a `transition-transform` rotate class for the expanded state).
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts:15-29` -- `WeeklyCalendarViewLabels` interface; add `expandDayLabel?`/`collapseDayLabel?` following the existing optional-aria-label-string pattern (e.g. `favoritedBadgeLabel`).
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx`, `describe('Mobile Vertical List View (AC15)')` (from line 530, 7 tests) -- all use hardcoded fixture dates (`2026-08-05`–`08-11`) that are in the past relative to real system time; each currently asserts card content renders unconditionally. These need the test file's "now" mocked (e.g. `vi.setSystemTime`) to a date that keeps the existing fixture range as today/future, preserving each test's original (non-collapse-related) intent, rather than rewriting every test to click a toggle first.

## Tasks & Acceptance

**Execution:**
- [ ] `WeeklyCalendarView.tsx` -- add `const [dayOverrides, setDayOverrides] = useState<Record<string, boolean>>({})` near line 356; compute `todayISO = toISODateString(new Date())`; per mobile day row, derive `isCollapsed = dayOverrides[dateISO] ?? (dateISO < todayISO)` (explicit user toggles win, otherwise past defaults collapsed and today/future defaults expanded).
- [ ] `WeeklyCalendarView.tsx:656-658` -- wrap the day header in a `<button type="button" aria-expanded={!isCollapsed} aria-controls={`mobile-day-content-${dayIdx}`} onClick={() => toggle}>`, adding a rotating chevron icon; the `bucket.map(...)` content div (659) gets `id={`mobile-day-content-${dayIdx}`}` and is only rendered when `!isCollapsed`.
- [ ] `WeeklyCalendarView.types.ts` -- add `expandDayLabel?: string` / `collapseDayLabel?: string` to `WeeklyCalendarViewLabels`, with an inline English fallback (matching `favoritedBadgeLabel || 'Favorited'`'s pattern) if unset.
- [ ] `WeeklyCalendarView.test.tsx` -- mock system time so the existing 7-test "Mobile Vertical List View" block's fixture dates remain today/future (preserving those tests' unrelated intent); add new tests: a day dated before mocked-today defaults collapsed (no `CalendarCard` content rendered, toggle button present with `aria-expanded="false"`), a day dated today or after defaults expanded, and clicking the toggle flips a collapsed day open (and an expanded day closed).

**Acceptance Criteria:**
- Given the mobile calendar view, when a day's date is before today, then that day's events are collapsed by default (header + toggle visible, event list not rendered).
- Given a day's date is today or in the future, when the view renders, then that day's events are expanded by default.
- Given any day row, when the user clicks its header/toggle, then that day's expanded/collapsed state flips, overriding the date-based default.
- Given the desktop calendar view, when rendered, then its layout and "+N more" popover behavior are unaffected by this change.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- ui package type-checks (excluding the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter @festgrid/ui test WeeklyCalendarView` -- targeted tests pass, including the new collapse-behavior cases and the re-mocked existing 7.
- `pnpm test` -- full project test suite passes.

