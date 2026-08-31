---
title: 'ux-rework2-p1-calendar-mobile-collapsible-days'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '35f6de48250760ac921c43ded2a729383daf1c3b'
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
- [x] `WeeklyCalendarView.tsx` -- add `const [dayOverrides, setDayOverrides] = useState<Record<string, boolean>>({})` near line 356; per mobile day row, derive `isCollapsed = dayOverrides[dateISO] ?? (dateISO < todayISO)` (explicit user toggles win, otherwise past defaults collapsed and today/future defaults expanded). (Extended during review: `todayISO` computes via a new `getTodayISOInTimezone(activeTimezone)` helper rather than raw `toISODateString(new Date())` -- the component is otherwise timezone-aware throughout, and comparing against local system time instead of the calendar's own `activeTimezone` could put a day on the wrong side of the today boundary for a viewer whose browser timezone differs from the calendar's.)
- [x] `WeeklyCalendarView.tsx:656-658` -- wrap the day header in a `<button type="button" aria-expanded={!isCollapsed} aria-controls={...} onClick={() => toggle}>`, adding a rotating chevron icon; the content div is only rendered when `!isCollapsed`. (Extended during review: `aria-controls`/content `id` now include a `useId()`-derived instance prefix, not a bare `dayIdx`, to avoid collisions if two `WeeklyCalendarView` instances ever render on the same page; the button also carries `data-testid="mobile-day-toggle"` for robust test targeting; its `aria-label` now prefixes the day's own header text rather than replacing it outright -- the original draft overwrote the button's accessible name entirely, so a screen reader would announce "Expand day" with no indication of *which* day.)
- [x] `WeeklyCalendarView.types.ts` -- add `expandDayLabel?: string` / `collapseDayLabel?: string` to `WeeklyCalendarViewLabels`, with an inline English fallback (matching `favoritedBadgeLabel || 'Favorited'`'s pattern) if unset.
- [x] `WeeklyCalendarView.test.tsx` -- mock system time so the existing 7-test "Mobile Vertical List View" block's fixture dates remain today/future (preserving those tests' unrelated intent); add a new test covering: a day dated before mocked-today defaults collapsed (no `CalendarCard` content rendered, `aria-expanded="false"`), today/future default expanded, and clicking the toggle flips both a collapsed and an expanded day.

**Acceptance Criteria:**
- Given the mobile calendar view, when a day's date is before today, then that day's events are collapsed by default (header + toggle visible, event list not rendered).
- Given a day's date is today or in the future, when the view renders, then that day's events are expanded by default.
- Given any day row, when the user clicks its header/toggle, then that day's expanded/collapsed state flips, overriding the date-based default.
- Given the desktop calendar view, when rendered, then its layout and "+N more" popover behavior are unaffected by this change.

## Spec Change Log

- 2026-08-31: Dispatched implementation to `cline-cli` (`--worktree`), spec pre-committed to `master` first. Independent verification found this batch's implementation clean end-to-end -- no defects, unlike every prior batch this session.
- 2026-08-31: Ran Blind Hunter + Edge Case Hunter adversarial review (`cline-cli`, `gemini-3.1-pro-preview`), independently verified every finding. Both reviewers surfaced real, non-hallucinated issues this time (a first for this session's reviews). Fixed: (1) the toggle's `aria-label` overwrote the day header text entirely, losing which day a screen reader user was interacting with -- now prefixes the day text instead of replacing it; (2) `mobile-day-content-{dayIdx}` used a bare integer id, collidable across multiple component instances on one page -- added a `useId()`-derived prefix; (3) `todayISO` computed from local system time rather than the calendar's own `activeTimezone`, inconsistent with how the rest of this timezone-aware component behaves -- added `getTodayISOInTimezone()`; (4) the new "Mobile Day Collapse State" test's mocked system time (`2026-08-06T12:00:00Z`) can resolve to `2026-08-07` local on far-eastern timezone machines (UTC+13/+14), flipping "today" past the test's own assumption -- pinned `timezone="UTC"` on that render call once the component gained timezone-aware "today" computation. Initially over-applied that same `timezone="UTC"` pin to the unrelated "Mobile Vertical List View" test block too, which broke an unrelated time-display assertion (that block's own mocked time is safe across all real-world offsets by construction and never needed the pin) -- reverted those 7. Also hardened the tab-stop test's card-vs-toggle-button filter to key off a new `data-testid` instead of `aria-expanded` presence (the original would have silently mis-filtered if a `CalendarCard` ever gained its own `aria-expanded` usage). Three low-severity findings (focus handling when a section unmounts, unbounded-but-negligible `dayOverrides` growth, a pre-existing loose test assertion) logged to `deferred-work.md`.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- PASS (only the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter @festgrid/ui test WeeklyCalendarView` -- PASS, 23/23.
- `pnpm --filter @festgrid/ui test` (full) -- PASS, 44 files / 342 tests.
- `web` package untouched by this batch; already verified fully green (293/293) as of the prior batch.

## Suggested Review Order

**Per-day collapse default and toggle**

- Entry point -- state and the timezone-aware "today" computation.
  [`WeeklyCalendarView.tsx:373`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L373)
  [`WeeklyCalendarView.tsx:70`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L70)

- The toggle button: `aria-expanded`, a collision-safe `aria-controls`, an accessible label that keeps the day's own text, and the conditionally-rendered content it controls.
  [`WeeklyCalendarView.tsx:680`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L680)

**Review-driven fixes**

- `useId()`-derived content-id prefix -- avoids `aria-controls` collisions across multiple instances.
  [`WeeklyCalendarView.tsx:375`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L375)

- Timezone-aware "today" instead of local system time, matching how the rest of this component already handles `activeTimezone`.
  [`WeeklyCalendarView.tsx:70`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L70)

**Peripherals**

- New collapse-behavior test, plus the `timezone="UTC"` pin needed to make its own mocked-time boundary deterministic across real-world CI timezones.
  [`WeeklyCalendarView.test.tsx`](../../packages/ui/src/features/events/WeeklyCalendarView.test.tsx)

