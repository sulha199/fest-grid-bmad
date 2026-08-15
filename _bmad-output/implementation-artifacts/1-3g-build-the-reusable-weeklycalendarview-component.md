---
baseline_commit: 0f3eddb9163f6755e9e5aae7b5f8db6da61d8149
---
# Story 1.3g: Build the reusable WeeklyCalendarView component

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.3g
- Status: review (reopened; AC13's `WeekPicker.tsx` work is blocked on Story 0.28 — see Dev Notes → Current Implementation State)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable `WeeklyCalendarView` presentational component in `packages/ui`,
so that the Discovery feed's Calendar View (Story 1.3f) and the future "My Calendar" page (Story 2.6) render the same weekly-grid mechanics — navigation, day cells, compact schedule cards, main/sub-schedule formatting, multi-day spanning, per-day overflow capping — instead of each independently rebuilding it, matching `design-artifacts/UX-festgrid-run-1/DESIGN.md`'s `calendar` component tokens, which already define one shared component with `discovery_view`/`personal_view` `max_events_per_day` variants.

## Acceptance Criteria

1. **Given** a `weekStart` date and a `schedules` array (each with `isMainSchedule`, `eventStartDate`, `eventEndDate?`, `eventStartTime?`, `eventEndTime?`, plus enough event identity to navigate to it), **when** `WeeklyCalendarView` renders, **then** it shows a 7-column grid (`grid grid-cols-7 divide-x divide-gray-200` per `DESIGN.md`) with locale-aware day headers for the week starting at `weekStart`, and a header row with previous/next-week navigation buttons and a date-range label (`header`/`date_range`/`nav_button` tokens).
2. **And** a "Today" button is always present in the header; activating it calls a caller-supplied `onToday` callback — the component does not compute "today" itself, matching `EventListView`/`EventDiscoveryPanel`'s controlled-component pattern (the caller owns week state).
3. **And** each schedule occurring within the visible week renders in its day cell as a compact card (`event_card_compact` tokens), titled per `DESIGN.md`'s `title_formatting` (bold for a main schedule, normal weight for a sub-schedule).
4. **And** a schedule whose `eventEndDate` differs from `eventStartDate` renders with the `multi_day_event` visual treatment spanning the relevant day cells within the visible week, rather than being duplicated as unrelated per-day entries; a schedule with no `eventEndDate` (or `eventEndDate === eventStartDate`) renders as a single-day compact card.
5. **And** given a `maxEventsPerDay` prop (a positive integer, or `-1` for unlimited — matching `DESIGN.md`'s `discovery_view`/`personal_view` split), if a day cell's schedule count exceeds it, only the first `maxEventsPerDay` are shown plus a "+N more" affordance (`more_link` token); activating it reveals the remaining schedules for that day (as a floating popover — see Dev Notes → Design Decisions Confirmed With User), each independently activatable identically to a normally-rendered compact card.
6. **And** each compact schedule card is clickable/activatable, calling a caller-supplied `onScheduleClick(schedule)` callback — `WeeklyCalendarView` owns no navigation/routing logic itself, matching `EventListView`'s `getCardProps`-style caller-owns-navigation pattern.
7. **And** hovering or focusing a compact card shows a tooltip (`hover_tooltip` token) with the schedule's full title and time range; tooltip content is reachable via keyboard focus, not mouse-hover only (WCAG 2.1 AA).
8. **And** the day-cell grid supports roving-tabindex arrow-key navigation between schedule cards (Left/Right moves within a day's cards then into the adjacent day; Up/Down moves a row), with Enter/Space activating the focused card identically to a click.
9. **And** all labels (nav-button aria-labels, "Today" label, "+N more" label, tooltip/day-header copy needing translation) are passed in pre-resolved via a `labels` prop — `packages/ui` does not import `next-intl` directly; day-of-week/date formatting uses `useScopedLocale()`/`useScopedTimezone()` (`packages/ui/src/hooks/useScopedLocale.tsx`) rather than a hardcoded locale, matching `EventCard`'s existing pattern.
10. **And** the component defines its own minimal schedule-shape type (`id`, `eventSlug`, `eventName`, `isMainSchedule`, `eventStartDate`, `eventEndDate?`, `eventStartTime?`, `eventEndTime?`), generic over `TSchedule extends` that shape — it does not import any `apps/web`-generated GraphQL type, matching `EventListView`/`EventDiscoveryPanel`'s existing decoupling pattern.
11. **And** it exposes `loading`/`error` states (a skeleton grid / a caller-supplied error message+detail) for when the caller's data is still being fetched, matching `EventListView`'s `status` prop pattern.
12. **And** the component is documented and exported from `packages/ui`'s public entry point (`packages/ui/src/features/events/index.ts`).

**AC13 — Manual week-picker control (added 2026-08-13 via `bmad-correct-course`, Section 4.4; refined 2026-08-15 via `bmad-create-story`):**
And the header row (AC1, AC2) gains a new week-picker trigger — a `Button` opening a `Popover` containing a `Calendar` (shadcn date picker, per `festgrid-architecture-spine.md` AD-9) — alongside the existing prev/next/Today controls. Selecting a date calls a new caller-supplied `onSelectWeek(date: string)` callback. Per AD-9, the picker itself is `packages/ui/src/core/WeekPicker.tsx` — a reusable wrapper around shadcn's `Calendar` (`mode="single"`) that highlights the full selected week row via `modifiers`/`modifiersClassNames`, not a plain undecorated date composition — taking `onSelectWeek(date: string)` and a **required** `getWeekRange(date: Date): { start: Date; end: Date }` prop; `WeekPicker` computes no boundary itself. `WeeklyCalendarView` therefore gains a new required `getWeekRange` prop (alongside the existing optional `onSelectWeek`) that it passes straight through to `WeekPicker` — the actual boundary source is Story 3.7a's exported `getWeekStart`/`getWeekEnd`, supplied by whichever `apps/web` wrapper renders this component, so exactly one boundary implementation exists app-wide.

## Tasks / Subtasks

- [x] Task 1: Define the component contract (AC9, AC10, AC11)
  - [x] Create `packages/ui/src/features/events/WeeklyCalendarView.types.ts`: `WeeklyCalendarViewScheduleShape` (the minimal shape from AC10), a generic `WeeklyCalendarViewProps<TSchedule extends WeeklyCalendarViewScheduleShape>` (`weekStart`, `schedules`, `maxEventsPerDay`, `onToday`, `onPrevWeek`, `onNextWeek`, `onScheduleClick`, `status: 'loading' | 'error' | 'success'`, `errorMessage?`, `errorDetail?`, `locale?`, `timezone?`, `labels?`, `className?`), and `WeeklyCalendarViewLabels` (see Dev Notes → Component Contract Summary for the exact shape, including why `moreLabel` is a resolver function, not a static string).
- [x] Task 2: Build the header row (AC1, AC2)
  - [x] Render prev/next nav buttons (`nav_button` token) and a "Today" button; wire to `onPrevWeek`/`onNextWeek`/`onToday` — the component computes no dates itself beyond deriving the 7 visible days from the caller-supplied `weekStart`.
  - [x] Render the locale-aware date-range label (`date_range` token) via `Intl.DateTimeFormat(...).formatRange(weekStart, weekEnd)`, with the same graceful-degradation retry pattern as `EventCard.tsx`'s `formatEventDate` (retry without timezone, then without locale, then `en-US`) — scraped/CMS-sourced schedule data means an invalid IANA timezone/locale must never throw.
  - [x] Render locale-aware day headers (`day_header` token) via `Intl.DateTimeFormat(locale, { weekday: 'short' })` for each of the 7 visible days.
- [x] Task 3: Build the day-cell grid and compact schedule cards (AC1, AC3)
  - [x] Render the 7-column grid (`grid_weekly`/`day_cell` tokens); bucket each `schedules[]` entry into the day cell(s) it occupies within the visible week (see Task 4 for multi-day).
  - [x] Render each schedule as an `event_card_compact`-styled `<button type="button">` (not a bare `<div>`, so Enter/Space activation is native — mirrors `EventCard`'s `RootTag`/`interactiveProps` pattern), titled per `title_formatting` (bold main schedule / normal sub-schedule).
  - [x] Sort schedules within a day cell by `eventStartTime` ascending (schedules with no `eventStartTime` sort last), matching standard calendar-day ordering expectations — not itself specified by an AC, but required for a coherent day-cell rendering.
- [x] Task 4: Multi-day spanning (AC4)
  - [x] For a schedule with `eventEndDate` differing from `eventStartDate`, render one compact-card *segment* per visible day cell it occupies (clamped to the visible week — `[max(eventStartDate, weekStart), min(eventEndDate, weekEnd)]`), each styled with the `multi_day_event` token, rather than a single overlay bar spanning columns (see Dev Notes → Architecture & UX Gate Findings for why). Apply a continuation visual cue (e.g. suppress the rounded corner / left border on non-first segments, per `multi_day_event`'s `rounded-md`/`border` classes) so segments read as one continuous event, not unrelated per-day entries.
  - [x] Each day's multi-day segment counts toward that day's `maxEventsPerDay` cap (Task 5) and is one entry in that day's roving-tabindex card list (Task 8) — i.e. the same logical schedule is independently focusable/activatable once per day it appears on, consistent with AC8's "moves within a day's cards" model.
- [x] Task 5: Overflow capping and the "+N more" popover (AC5)
  - [x] When a day cell's schedule count (after Task 4's per-day segmenting) exceeds `maxEventsPerDay` (and `maxEventsPerDay !== -1`), render only the first `maxEventsPerDay` cards plus a "+N more" trigger button (`more_link` token), whose label is produced by calling `labels.moreLabel?.(hiddenCount) ?? \`+${hiddenCount} more\`` — `moreLabel` is a resolver **function**, not a static string (see Component Contract Summary for why: it must be invoked once per day cell with that day's own hidden count, so the caller's `next-intl` ICU-plural message resolves correctly per invocation).
  - [x] Build the popover as a floating panel anchored to the "+N more" trigger, using the same focus-trap approach as `packages/ui/src/core/blocking-loader.tsx` (Story 1.7a): capture `document.activeElement` on open, move focus into the panel, trap `Tab`/`Shift+Tab` within its focusable elements, close on `Escape` and on outside click/pointerdown, and restore focus to the "+N more" trigger on close.
  - [x] Popover content lists the day's remaining schedules as the same compact-card buttons used elsewhere (Task 3), each independently activatable via `onScheduleClick` identically to a normally-rendered card. Arrow-key roving nav (Task 8) is scoped to the main day-cell grid only — the popover uses simple `Tab` traversal, not a second roving-tabindex system (keeps scope matched to AC8's literal grid-navigation wording; do not add roving nav inside the popover).
- [x] Task 6: Schedule click wiring (AC6)
  - [x] Every compact card (grid-rendered or popover-rendered) calls `onScheduleClick(schedule)` on click/Enter/Space. No `href`/routing logic inside the component.
- [x] Task 7: Hover/focus tooltip (AC7)
  - [x] Hand-roll a hover+focus tooltip per compact card (`hover_tooltip` token), following the same interaction shape as `useNavRailItemInteraction.ts` (`isHovered`/`isFocused` state, `onPointerEnter`/`onPointerLeave` gated on non-touch `pointerType`, `onFocus`/`onBlur`, `Escape`-to-dismiss) — implemented inline/co-located with the compact card, not extracted to `packages/ui/src/hooks/` (see Dev Notes → Architecture & UX Gate Findings for why this stays inline).
  - [x] Tooltip content: the schedule's full (untruncated) title and a formatted time range derived from `eventStartTime`/`eventEndTime` (graceful degradation identical to Task 2's date formatting if a time value is missing/invalid).
- [x] Task 8: Roving-tabindex keyboard grid navigation (AC8)
  - [x] Implement a roving-tabindex model across the visible grid's compact cards (excluding popover-only cards, per Task 5): exactly one card has `tabIndex={0}` at a time (the "active" card), all others `tabIndex={-1}`. `ArrowLeft`/`ArrowRight` move the active card within the current day's card list, then into the adjacent day's first/last card at the grid boundary; `ArrowUp`/`ArrowDown` move to the corresponding card position in the day cell one row above/below (falling back sensibly if that day has fewer cards). Moving the roving index calls `.focus()` on the newly active card's DOM node (imperative focus management, matching the "grid" pattern already established for keyboard-navigable composites in this codebase's `blocking-loader.tsx` Tab-trap).
  - [x] `Enter`/`Space` activation is native (Task 3's `<button>` cards), no extra handler needed.
- [x] Task 9: Loading/error states (AC11)
  - [x] `loading`/error rendering mirrors `EventListView`'s `status` prop convention: `status === 'loading'` renders a skeleton 7-column grid (empty day cells with pulse-animated placeholder blocks, no live data); `status === 'error'` renders the caller-supplied `errorMessage`/`errorDetail` in the same `text-destructive`/`<pre>` layout `EventListView` already uses; `status === 'success'` renders the full grid (Tasks 2-8).
- [x] Task 10: Export and document (AC12)
  - [x] Export `WeeklyCalendarView` and its types from `packages/ui/src/features/events/index.ts`.
  - [x] Add a component-level JSDoc comment (matching `EventCard`'s/`EventDetailView`'s existing doc-comment style) summarizing the component's purpose, controlled-component contract, and a11y behavior.
- [x] Task 11: Testing (all ACs)
  - [x] `WeeklyCalendarView.test.tsx`: grid/header rendering with correct day count and date-range label (AC1); Today/prev/next button callbacks fire (AC1, AC2); compact card renders with correct bold/normal title weight per `isMainSchedule` (AC3); a multi-day schedule renders one segment per occupied visible day with continuation styling, clamped correctly at week boundaries (AC4); overflow capping shows exactly `maxEventsPerDay` cards plus a "+N more" trigger, `labels.moreLabel` is invoked as a function with that day's exact hidden count (not string-interpolated internally), and a missing `moreLabel` falls back to the default `+N more` string; `-1` renders all schedules uncapped (AC5); popover open/close via trigger click, `Escape`, and outside-click, focus moves into the popover on open and returns to the trigger on close, `Tab` is trapped while open (AC5); `onScheduleClick` fires with the correct schedule object from both grid cards and popover cards (AC6); tooltip appears on hover and on keyboard focus (not only mouse hover) and is dismissible via `Escape` (AC7); roving-tabindex: exactly one card has `tabIndex={0}` at a time, `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` move focus per the described model, `Enter`/`Space` activates the focused card (AC8); an invalid/malformed locale or timezone value degrades gracefully instead of throwing (AC9, mirroring `EventCard.test.tsx`'s equivalent case); `loading`/`error`/`success` status rendering (AC11).
  - [x] Accessibility assertions: tooltip has `role="tooltip"`; popover trigger has correct `aria-expanded`/`aria-haspopup`; day cells/cards are reachable via keyboard alone (no mouse-only interaction path).
- [x] Task 12: Final checks
  - [x] `pnpm build` / `pnpm lint` clean at the repo root (`packages/ui` and its consumers).
- [ ] **Task 13 (AC13) — Blocked on Story 0.28:** Do not start Task 14 until Story 0.28 ("Set up shadcn/ui component generation for `packages/ui`") is done — it establishes `packages/ui`'s `components.json` and installs the underlying `popover`/`calendar` shadcn primitives this task's `WeekPicker.tsx` wraps. Confirm `packages/ui/src/core/ui/popover.tsx` and `packages/ui/src/core/ui/calendar.tsx` exist before proceeding.
- [ ] **Task 14 (AC13) — Build `WeekPicker.tsx` (`packages/ui/src/core/`):**
  - Create `packages/ui/src/core/WeekPicker.tsx`: `Button` (trigger) + `Popover` + `Calendar` (`mode="single"`) composition per AD-9. Props: `selectedDate: string | undefined` (or similar, for controlled display), `onSelectWeek: (date: string) => void`, and a **required** `getWeekRange: (date: Date) => { start: Date; end: Date }`.
  - Use `Calendar`'s `modifiers`/`modifiersClassNames` to highlight the **full row** of the week containing the currently-hovered/selected date (compute the highlighted range via the caller-supplied `getWeekRange`, not any boundary math of `WeekPicker`'s own) — this is the one differentiator from a plain single-date shadcn `Calendar` composition, per AD-9's explicit rationale ("better picking affordance").
  - `WeekPicker` must not import `getWeekStart`/`getWeekEnd` from Story 3.7a's hook directly, and must not contain any day-of-week arithmetic itself — `getWeekRange` is the only boundary source, supplied by the caller. This is the AD-9 rule 3 "exactly one boundary implementation exists app-wide" invariant; do not weaken it for convenience.
  - Add a colocated `WeekPicker.test.tsx` covering: trigger opens the popover, selecting a date calls `onSelectWeek` with that date, the popover closes after selection, and the correct week row (per a test `getWeekRange` stub) receives the highlight modifier class.
- [ ] **Task 15 (AC13) — Wire `WeekPicker` into `WeeklyCalendarView`'s header row:**
  - Add `getWeekRange: (date: Date) => { start: Date; end: Date }` as a new prop to `WeeklyCalendarViewProps` (required when `onSelectWeek` is supplied — both already exist as of the current partial implementation, `onSelectWeek` is already optional/wired; `getWeekRange` is new).
  - Replace the current hand-rolled native `<input type="date">` week-picker (the `isPickerOpen`/`pickerDate` state and the absolutely-positioned `<div>` block in the current file, header lines ~208-217 and ~494-525) with `<WeekPicker onSelectWeek={onSelectWeek} getWeekRange={getWeekRange} .../>` — this is a replacement, not an addition; remove the native-input markup and its now-unused local state entirely.
  - Update `WeeklyCalendarView.test.tsx`'s existing "opens a week-picker and calls onSelectWeek with the picked date" test (currently drives a native `<input type="date">` via `fireEvent.change`) to instead drive the new `WeekPicker`/shadcn `Calendar` interaction (open the popover, click a day cell) — the underlying mechanism changed, the test must change with it, not be left asserting the removed native-input behavior.
- [ ] **Task 16 (Gate 3 finding from Story 3.7a's reopening, not itself part of AC13) — Remove the divergent Sunday-start day-grid calculation:**
  - The current `visibleDays` computation (lines ~186-204) **re-derives** a Sunday-start boundary from whatever `weekStart` it receives (`dayOfWeek = baseDate.getDay(); sundayOffset = dayOfWeek; startOfWeek = baseDate - sundayOffset`), rather than trusting the caller-supplied `weekStart` as the literal first rendered day. This silently "corrects" any non-Sunday `weekStart` back to Sunday — invisible until now only because every existing caller happened to already pass a Sunday-start value (the pre-3.7a-fix convention). Once Story 3.7a's Monday-start fix is live, this recomputation will silently shift the rendered week by up to 6 days, a real regression.
  - **Fix:** delete the `dayOfWeek`/`sundayOffset` recomputation entirely. `WeeklyCalendarView` is a controlled component (AC2) — it must render exactly 7 consecutive days starting at the literal `weekStart` prop it was given, performing no boundary correction of its own. Replace the block with a direct loop from `baseDate` (still needed for the noon-normalization DST guard) with no day-of-week offset applied.
  - This removes code rather than adding Monday-start math — `WeeklyCalendarView` should not need to know about weekday semantics at all, matching its own AC2 controlled-component contract.
  - Add/update a `WeeklyCalendarView.test.tsx` case asserting that a non-Sunday `weekStart` (e.g. a Monday, matching Story 3.7a's corrected output) renders that exact date as the first visible day — not silently shifted to the preceding Sunday.

## Dev Notes

### Current Implementation State (AC13, added 2026-08-15 — read before starting Task 13+)

This is **not** a clean slate for AC13. A failed `bmad-quick-dev` run (commit `519f822`, 2026-08-14) already added a **functional but architecturally non-compliant** stopgap week-picker directly to `WeeklyCalendarView.tsx`:

- A native `<input type="date">`, shown/hidden via local `isPickerOpen` state, positioned in an absolutely-positioned `<div>` under a "Select week" trigger button. It correctly calls `onSelectWeek(date)` on change (verified: the existing `WeeklyCalendarView.test.tsx` test "opens a week-picker and calls onSelectWeek with the picked date" passes against this implementation).
- `WeeklyCalendarViewProps`/`WeeklyCalendarViewLabels` already gained `onSelectWeek?`, `selectWeekLabel?`, `chooseWeekLabel?` — these are fine to keep.
- **This does not satisfy AC13.** It's a plain native date input with zero week-row highlighting, not the shadcn `Button`+`Popover`+`Calendar` composition AD-9 mandates, and there is no `WeekPicker.tsx` anywhere in `packages/ui/src/core/`. Tasks 13-15 replace this stopgap; do not treat AC13 as already done because `onSelectWeek` fires correctly — the *mechanism* is the gap AD-9 exists to close (it was written specifically to prevent exactly this kind of hand-rolled-composition drift, see AD-9's "Prevents" list).
- The same commit also independently introduced the divergent Sunday-start `visibleDays` boundary recomputation described in Task 16 — present in the code before `519f822` in a different form (Sunday-only, unconditionally correct at the time since every caller was Sunday-start) but only became a live bug once Story 3.7a's boundary math changed to Monday-start (this same session). Task 16 is unrelated to AC13 itself but was surfaced as a Gate finding during Story 3.7a's own reopening (see below) and is this story's required pre-condition to fix, since 3.7a deliberately stayed hook-only.
- `apps/web/locales/en.json`/`id.json` already gained `calendarSelectWeekLabel`/`calendarChooseWeekLabel` keys (also via `519f822`) for Story 1.3f/2.6's own wrapper wiring — these are fine, no change needed here (this story doesn't own `apps/web` i18n keys, see AC9/i18n Keys Required below).
- `CalendarView.tsx` (1.3f) and `my-calendar-content.tsx` (2.6) already pass `onSelectWeek={handleSelectWeek}` through to this component. **Once Task 15 adds the new required `getWeekRange` prop, both of those wrapper files will need a corresponding update to also pass `getWeekRange` — that update belongs to Stories 1.3f/2.6 respectively, not this story** (mirroring exactly how Story 3.7a flagged this story's own divergent-calc fix instead of absorbing it). Flag this explicitly when 1.3f/2.6 are next reopened.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** sourced from `epic-1-readiness.md` (`swept: true`) — no gap applicable. This story introduces no new API surface, no database/ORM access, no external service call, and no new project-wide tooling/foundation; it is a pure `packages/ui` presentational component with `Depends on: None` per `epics.md`. Lightweight guard (per this project's `bmad-create-story` customization): reasoned fresh against this story's specific scope — no new external service, infra dependency, or cross-epic foundational gap is introduced beyond what the sweep already covers, so no fresh Gate 1/3 subagent pass was warranted.
- **Gate 2 (UI Complexity & Reusability):** run fresh via a subagent adopting Freya's analytical lens against this story's full AC set, `DESIGN.md`'s `calendar`/`event_card_compact` tokens, and the codebase's existing interaction precedents. Findings, all confirmed — no further component/hook split needed beyond `WeeklyCalendarView` itself (which is already the Gate-2-originated split from Story 1.3f, per that story's Note):
  - **Multi-day spanning (AC4):** per-day-cell repeated-segment rendering (Task 4), not an absolute-positioned overlay bar spanning columns. The `multi_day_event` token (`w-full bg-violet-50 border border-violet-200 rounded-md p-1 relative`) carries no overlay-positioning classes, and AC8's roving-nav model ("Left/Right moves within a day's cards then into the adjacent day") only coheres if each spanned day has its own local card entry — an overlay bar can't simultaneously be "one of day X's cards" for N days without a special-cased nav model nothing in the ACs anticipates. Decided directly from AC4+AC8+the token set; not escalated to the user.
  - **"+N more" overflow disclosure (AC5):** does **not** meet Gate 2's reuse bar as a new `packages/ui` Popover/Disclosure primitive. Story 2.8 ("User Menu", Epic 2, still `backlog`) has a plausible but currently-unscoped, differently-shaped anchored menu (dropdown-at-desktop/bottom-sheet-at-mobile) that is not a confirmed second consumer of the same mechanism — Gate 2's "≥2 confirmed consumers grounded in actual `epics.md` text" bar (the same bar that justified splitting `EventCard`/`useInfiniteScroll`/`MultiSelect` into their own stories) is not met. The popover is built inline, scoped to this story.
  - **Hover/focus tooltip (AC7) and roving-tabindex (AC8):** both stay inline/component-local, not extracted to `packages/ui/src/hooks/`. The tooltip's only prior codebase instance (`NavRailItem`/`useNavRailItemInteraction.ts`) was itself hand-rolled inline rather than pre-extracted on a single consumer — reinforcing "don't pre-extract at N=1." Roving-tabindex has zero other `epics.md` hits (`grep -i "roving|arrow.?key" epics.md` returns only this story's own AC8).
  - No other sub-piece in this story's AC set (`event_card_compact` styling, multi-day segment logic) has a named ≥2-consumer case in `epics.md`.

**Fresh Gate 3 finding (2026-08-15, this reopening for AC13):** `packages/ui` has no shadcn/Radix setup at all (no `components.json`, no `@radix-ui/*` dependency), but AD-9 mandates `WeekPicker.tsx` wrap shadcn `Popover`+`Calendar`. The identical gap independently blocks Story 1.5's FilterHub popover redesign (same `sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md`, Section 4.1) — a tooling/infrastructure gap needed by ≥2 stories, not a single-story concern. Not absorbed into this story; split into new **Story 0.28** ("Set up shadcn/ui component generation for `packages/ui`") per `story-split-gate.md`'s numbering rule (tooling gap → new Epic 0 story). User confirmed via `AskUserQuestion`. This story's `Depends on` updated accordingly (also adding Story 3.7a, whose `getWeekStart`/`getWeekEnd` this story's callers use to build the `getWeekRange` prop Task 14/15 require).

**Fresh Gate 1 finding (2026-08-15, this reopening):** the divergent `visibleDays` Sunday-start recomputation (Task 16) — not a new-infrastructure gap, but an existing-code correctness gap surfaced by Story 3.7a's own reopening (see Story 3.7a's Dev Notes → Architecture & UX Gate Findings, which explicitly deferred this fix to this story rather than touching this story's file itself). Addressed directly in Task 16, not split out — it's a bugfix inside this story's own file, not new scope requiring a prerequisite.

### Design Decisions Confirmed With User (2026-08-05)

1. **"+N more" overflow disclosure mechanism (AC5):** confirmed — a floating popover (Task 5), not inline expansion. Rationale presented and accepted: `DESIGN.md`'s `day_cell` token is a *fixed* height (`h-32`); inline expansion would either visually overflow into the grid row below (if the cell's own box stays fixed-height with `overflow: visible`) or force the entire week row's other 6 day cells to grow to match an `auto`-sized track (if the row itself resizes) — a layout defect either way that DESIGN.md's token set doesn't address. A floating popover never touches the grid's row/column sizing. The accepted tradeoff: more net-new interaction code (hand-rolled positioning, outside-click dismiss, `Escape`-to-close, focus trap/return-focus — no `packages/ui` Popover primitive exists yet to reuse), mitigated by following the exact focus-trap pattern already proven in `blocking-loader.tsx` (Story 1.7a) rather than inventing a new one.

### Consumer Story Sync Check (Story 1.3f)

Story 1.3f (this story's confirmed first consumer, already drafted as `ready-for-dev`) was re-read in full against this story's contract before finalizing it. Two internal inconsistencies and one gap were found in 1.3f and corrected directly in that file (small, mechanical corrections — per `story-split-gate.md`'s "correction to an existing story's AC" escape hatch, not a new story):

1. **`status` vs. `loading`/`error` prop-name conflict, within 1.3f itself.** 1.3f's own **AC6** says Calendar View's loading/error handling matches "`EventListView`'s `status` prop convention" (explicit, matches `epics.md`'s AC11 for this story verbatim: "matching `EventListView`'s `status` prop pattern"). But 1.3f's **Task 5** bullet said "Map `status`/`error` from the query to `WeeklyCalendarView`'s `loading`/`error` props" — naming different prop identifiers than its own AC6. Resolved in favor of the `status`/`errorMessage`/`errorDetail` shape (Task 1/Task 9 above) — it is what `epics.md`'s canonical AC11 text and 1.3f's own AC6 both independently specify; the Task 5 bullet was the outlier and has been corrected in `1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md` to reference `status`/`errorMessage`/`errorDetail` instead of `loading`/`error`.
2. **`moreLabel` must be a resolver function, not a static string.** 1.3f's **Task 7** commits to `calendarMoreLabel` using **ICU plural** interpolation via `next-intl` ("`calendarMoreLabel` (ICU plural/interpolated with count)"). The hidden-schedule count for "+N more" is only known *inside* `WeeklyCalendarView`, per day cell, after this component's own capping logic runs (Task 5) — `apps/web` cannot pre-resolve a single static string ahead of time the way it does for `todayLabel`/`prevWeekLabel`. `labels.moreLabel` is therefore typed `(count: number) => string` (Component Contract Summary below), and 1.3f's `CalendarView.tsx` wrapper must pass `moreLabel: (count) => t('calendarMoreLabel', { count })` — noted directly in 1.3f's Dev Notes.
3. **1.3f's Task 7 i18n key list predates this session's popover decision.** `calendarPrevWeekLabel`/`calendarNextWeekLabel`/`calendarTodayLabel`/`calendarMoreLabel`/`calendarErrorState` (1.3f's original list) has no key for the popover's dismiss control this story's AC5 now requires (`labels.closePopoverLabel`, Component Contract Summary below). Added `calendarClosePopoverLabel` to 1.3f's Task 7 i18n key list directly.

### Component Contract Summary

```ts
// packages/ui/src/features/events/WeeklyCalendarView.types.ts

export interface WeeklyCalendarViewScheduleShape {
  id: string;
  eventSlug: string;
  eventName: string;
  isMainSchedule: boolean;
  eventStartDate: string;   // ISO date
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}

export interface WeeklyCalendarViewLabels {
  /** aria-label for the previous-week navigation button */
  prevWeekLabel?: string;
  /** aria-label for the next-week navigation button */
  nextWeekLabel?: string;
  /** "Today" button label */
  todayLabel?: string;
  /**
   * "+N more" affordance text, invoked once per over-capacity day cell with
   * that day's own hidden-schedule count. A resolver FUNCTION, not a static
   * string, because the count is only known after this component's own
   * per-day capping logic runs — the caller (Story 1.3f's `CalendarView`)
   * wraps its next-intl ICU-plural message: `(count) => t('calendarMoreLabel', { count })`.
   * Falls back to a plain `+${count} more` if omitted.
   */
  moreLabel?: (count: number) => string;
  /** aria-label for the "+N more" popover's dismiss control */
  closePopoverLabel?: string;
  /** Shown while `status === 'loading'` (aria-label on the skeleton grid) */
  loadingText?: string;
}

export interface WeeklyCalendarViewProps<TSchedule extends WeeklyCalendarViewScheduleShape> {
  weekStart: Date | string;
  schedules: TSchedule[];
  /** Positive integer, or -1 for unlimited (matching DESIGN.md's discovery_view/personal_view split) */
  maxEventsPerDay: number;
  onToday: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onScheduleClick: (schedule: TSchedule) => void;
  status: 'loading' | 'error' | 'success';
  errorMessage?: string;
  errorDetail?: string;
  /** Optional explicit locale/timezone override — falls back to ScopedLocaleProvider context, matching EventCard */
  locale?: string;
  timezone?: string;
  labels?: WeeklyCalendarViewLabels;
  className?: string;
}
```

`WeeklyCalendarView` does not import `GetEventsQuery`/`GetEventsForCalendarQuery` or any other `apps/web`-generated GraphQL type — callers (Story 1.3f's `CalendarView` wrapper, and Story 2.6's future wrapper) map their query results into `WeeklyCalendarViewScheduleShape[]` before passing them in, exactly as `EventListView`/`EventDiscoveryPanel` already require of their callers.

Internal decomposition (day-cell bucketing, multi-day segment computation, roving-tabindex state, the tooltip interaction hook, the popover) is an implementation detail — organize it into colocated non-exported helper functions/hooks within `WeeklyCalendarView.tsx` or an adjacent non-index-exported file (e.g. `WeeklyCalendarView.utils.ts`) at the dev agent's discretion. None of these are exported from `packages/ui`'s public entry point (Gate 2 found no sub-piece meeting the reuse bar for its own public export or story — see Architecture & UX Gate Findings above).

### i18n Keys Required (AD-6)

None owned by this story directly — `packages/ui` does not import `next-intl` (AC9). The *caller* (Story 1.3f's `CalendarView` wrapper) owns adding, to `apps/web/locales/en.json`/`id.json`'s `DiscoveryPage` namespace: `calendarPrevWeekLabel`, `calendarNextWeekLabel`, `calendarTodayLabel`, `calendarMoreLabel` (ICU plural, resolved via a `(count) => string` closure — see Consumer Story Sync Check above), `calendarErrorState`, and (newly, per this story's popover decision) `calendarClosePopoverLabel` — all passed into this component's `labels` prop. This story's own testing (Task 11) uses literal English test strings/functions for these props, not real i18n keys.

### Analytics Events Required (AD-5)

None. This is a pure presentational `packages/ui` component with no analytics/tracking responsibility — any `view_switched`/`calendar_week_navigated`-style event firing belongs to the caller wrapper (already specified in Story 1.3f's Dev Notes), triggered from the `onToday`/`onPrevWeek`/`onNextWeek`/`onScheduleClick` callbacks this component invokes.

### State Management Categorization

- **Server State / URL State:** not applicable — `WeeklyCalendarView` is a fully controlled component. `weekStart` and `schedules` are caller-owned (Server State via the caller's own query hook); week navigation is caller-owned (URL State via the caller's own `nuqs` `useQueryState('week', ...)`, per Story 1.3f's Dev Notes) — this component only calls `onToday`/`onPrevWeek`/`onNextWeek`, it does not read or write any URL/query state itself.
- **Client Global State (`zustand`):** none required.
- **Internal ephemeral UI state (not one of the three governed buckets):** roving-tabindex active-card index, per-card hover/focus tooltip visibility, and popover open/closed state are all local `useState`/`useRef` component-internal render state — matching `EventCard`'s own `imgError` `useState` and `useNavRailItemInteraction`'s hover/focus state, not Server/URL/Zustand state.

### Loader Classification

`status === 'loading'` renders a Non-Blocking skeleton grid (project-context.md's Loaders rule) — matching `EventListView`'s classification for its own skeleton state. Never a full-screen blocking overlay; this component has no critical-mutation use case.

### Data Type Compatibility & Migration Requirements

**No changes required.** This story adds no database columns, no GraphQL schema/resolver changes, and defines its own local `WeeklyCalendarViewScheduleShape` type (AC10) rather than consuming any generated type — there is no DB/API/TypeScript-type triple to reconcile. `epics.md` lists `Depends on: None` for this story. The mapping from a caller's actual generated GraphQL schedule shape into `WeeklyCalendarViewScheduleShape` is each caller's own responsibility (already scoped in Story 1.3f's Dev Notes → Component Contract Notes for its `CalendarView` wrapper, now further corrected per Consumer Story Sync Check above).

### Package boundaries

- `packages/ui/src/features/events/`: new `WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts`, `WeeklyCalendarView.test.tsx` (and optionally a colocated `WeeklyCalendarView.utils.ts` per the Component Contract Summary note above), exported via the existing `index.ts`. No `next-intl`, no GraphQL-generated types, no React Query, no `nuqs` (unlike `EventDiscoveryPanel`/`FilterHub`, this component owns no URL state itself).
- New (AC13, Task 14, blocked on Story 0.28): `packages/ui/src/core/WeekPicker.tsx`, `WeekPicker.test.tsx` — depends on `packages/ui/src/core/ui/popover.tsx`/`calendar.tsx` existing first (Story 0.28's output).
- No other package touched by this story — `apps/web`'s consumption (Story 1.3f's `CalendarView` wrapper, Story 2.6's `my-calendar-content.tsx`) and `apps/backend`/`packages/domain`/`packages/database` are all out of scope (see `## Out of Scope`). The small corrections to `1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md` (Consumer Story Sync Check above) are documentation-only edits to an as-yet-unimplemented sibling story file, not a functional change to any package.

### Architecture / technical constraints

- **Framework-agnostic `packages/ui`:** all labels pre-translated via the `labels` prop; locale/timezone resolved via `useScopedLocale()`/`useScopedTimezone()` with an explicit-prop override, matching `EventCard`'s precedent exactly (AC9).
- **Graceful degradation for locale-sensitive rendering:** `formatEventDate`-style retry-without-timezone-then-without-locale pattern (`EventCard.tsx`) must be reused for the date-range label, day headers, and tooltip time range — schedule data may include invalid/typo'd timezone or an unrecognized locale, per project-context.md's Locale-Sensitive Data Rendering rule.
- **Accessibility (WCAG 2.1 AA):** tooltip reachable via keyboard focus, not mouse-hover only (AC7); popover focus-trap/return-focus (Task 5, modeled on `blocking-loader.tsx`); roving-tabindex grid navigation (AC8) — all verified by Task 11's test suite, not deferred.
- **Controlled-component pattern:** consistent with `EventListView`/`EventDiscoveryPanel` — this component computes no dates/state that the caller should own (`weekStart`, week navigation, "today"), only renders and reports interaction callbacks.

### Previous/Sibling Story Intelligence (Stories 1.3d, 1.3e, 1.3f, 1.7a)

- Story 1.3d (`EventListView`) and Story 1.3e (`EventDiscoveryPanel`) established the "pure layout/presentational `packages/ui` component, caller owns data-fetching/callbacks/URL-state" pattern this story follows identically — including the `status: 'loading' | 'error' | 'success'` prop shape (AC11) and the generic `TEvent`/`TSchedule extends <minimal shape>` decoupling pattern (AC10).
- Story 1.3f (`CalendarView`/Discovery integration, already drafted, `ready-for-dev`) is this story's first confirmed consumer and hard-codes the exact prop contract this story must satisfy: `schedules` flattened from its query with `eventSlug`/`eventName` annotated per schedule, `maxEventsPerDay={5}`, `onScheduleClick` wired to `router.push(...)`, `onToday`/prev/next-week wired to its own `week` URL param, `status`/`errorMessage`/`errorDetail` mapped from its query state (corrected per Consumer Story Sync Check above). See that story's Dev Notes → Component Contract Notes for the consumer-side wiring — do not diverge from the prop names/shapes documented there and here.
- Story 1.7a (`BlockingLoader`) established this codebase's only prior focus-trap implementation (`packages/ui/src/core/blocking-loader.tsx`) — reused directly as the model for this story's popover focus trap (Task 5), rather than inventing a new pattern or pulling in an external library.
- `useNavRailItemInteraction.ts` (Story 0.7/0.7a) established this codebase's only prior hover/focus tooltip implementation — reused as the interaction-shape model for Task 7's tooltip (hover-gated-on-non-touch-pointerType, focus, `Escape`-to-dismiss).

### Project Structure Notes

- New: `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts`, `WeeklyCalendarView.test.tsx` (optionally `WeeklyCalendarView.utils.ts`).
- Modified: `packages/ui/src/features/events/index.ts` (new exports).
- Modified (documentation-only correction, per Consumer Story Sync Check): `_bmad-output/implementation-artifacts/1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md`.
- Not modified by this story: anything in `apps/web/**`, `apps/backend/**`, `packages/domain/**`, `packages/database/**` — Story 1.3f owns the `apps/web`-level `CalendarView` wrapper that will consume this component.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3g`, `#Story 1.3f`, `#Story 1.3d`, `#Story 1.3e`, `#Story 2.6`]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`]
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`]
- [Source: `design-artifacts/UX-festgrid-run-1/DESIGN.md` (`calendar`/`event_card_compact` component tokens, lines ~35-58)]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (Calendar View description, lines ~83-93)]
- [Source: `_bmad-output/implementation-artifacts/1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md` (this story's confirmed first consumer and exact prop contract; corrected per Consumer Story Sync Check above)]
- [Source: `_bmad-output/implementation-artifacts/1-3d-build-the-reusable-eventlistview-component.md`, `1-3e-build-the-reusable-eventdiscoverypanel-component.md` (sibling `packages/ui` component pattern precedent)]
- [Source: `packages/ui/src/features/events/EventCard.tsx` (`formatEventDate` graceful-degradation pattern, `useScopedLocale`/`useScopedTimezone` usage)]
- [Source: `packages/ui/src/features/events/EventListView.tsx` (`status` prop pattern)]
- [Source: `packages/ui/src/core/blocking-loader.tsx` (focus-trap pattern reused for the "+N more" popover)]
- [Source: `packages/ui/src/core/app-shell/NavRailItem.tsx`, `packages/ui/src/hooks/useNavRailItemInteraction.ts` (hover/focus tooltip pattern)]
- [Source: `packages/ui/src/hooks/useScopedLocale.tsx`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md#4.4`] — AC13 origin.
- [Source: `_bmad-output/implementation-artifacts/3-7a-extract-shared-weekly-calendar-controller-hook.md`] — authoritative `getWeekStart`/`getWeekEnd` contract this story's callers use to build `getWeekRange`; also documents the divergent-calc Gate finding Task 16 addresses.
- [Source: `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `.types.ts`, `.test.tsx`] — current (partial AC13) implementation; read in full before starting Task 13+ (see Current Implementation State).

## Global Rules References

- `_bmad-output/project-context.md` (UI Components & Scalability, Code Organization, Locale-Sensitive Data Rendering, UI Patterns & UX Invariants/Loaders, State Management Architecture)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-6 i18n/locale strategy — component-level scoping only, no provider; **AD-9 Date/Week Selection UI Convention — the authoritative source for AC13's `WeekPicker.tsx` contract**)
- `_bmad-output/planning-artifacts/epics.md` (Story 1.3g, Story 1.3f, Story 1.3d, Story 1.3e, Story 2.6, Story 3.7a, Story 0.28)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/index.md` (frontend-only story, no infra shard changes — summary suffices)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts`, `WeeklyCalendarView.test.tsx`.
- Optional new (implementation detail, dev agent's discretion): `packages/ui/src/features/events/WeeklyCalendarView.utils.ts` for colocated non-exported helpers (day-cell bucketing, multi-day segment computation).
- Modified: `packages/ui/src/features/events/index.ts` (export additions).
- Modified (documentation-only correction): `_bmad-output/implementation-artifacts/1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md` (Task 5 prop-name correction, Task 7 new i18n key).
- New (AC13, Task 14, blocked on Story 0.28): `packages/ui/src/core/WeekPicker.tsx`, `WeekPicker.test.tsx`.
- Modified (AC13, Task 15-16): `packages/ui/src/features/events/WeeklyCalendarView.tsx` (replace native-input picker with `WeekPicker`; remove divergent `visibleDays` boundary recomputation), `WeeklyCalendarView.types.ts` (add `getWeekRange` prop), `WeeklyCalendarView.test.tsx` (update the week-picker test for the new mechanism; add a non-Sunday `weekStart` regression test).
- **Not modified by this story:** `apps/web/**` (Story 1.3f's/2.6's own wrappers consume this component and will need their own follow-up to pass `getWeekRange` — flagged for their own reopening, not done here), `apps/backend/**`, `packages/domain/**`, `packages/database/**`. `packages/ui/src/core/ui/popover.tsx`/`calendar.tsx` are Story 0.28's output, consumed but not created here.

### Rule Mapping

- *Code Organization (Domain vs UI)* → pure presentational component in `packages/ui/src/features/events/`, no React-incompatible dependencies; no `packages/domain` logic needed (no data transformation beyond local rendering-time bucketing/sorting, which is view logic, not reusable business logic).
- *UI Components & Scalability* → placed under `packages/ui/src/features/events/`, alongside its sibling `EventCard`/`EventListView`/`EventDiscoveryPanel` (domain-feature reusable components, not core primitives).
- *Locale-Sensitive Data Rendering* → day headers, date-range label, and tooltip time range all formatted via `Intl`/`useScopedLocale`/`useScopedTimezone` with graceful degradation (Task 2, Task 7).
- *UI Patterns & UX Invariants (Loaders)* → `status === 'loading'` classified Non-Blocking/Skeleton (Loader Classification above).
- *State Management Architecture* → fully controlled component; no Server/URL/Zustand state owned internally (State Management Categorization above).
- *Story-split-gate Gate 2* → fresh subagent pass found no further reusable sub-piece meeting the ≥2-consumer bar; popover-vs-inline-expansion tradeoff for AC5 surfaced to and resolved by the user rather than silently picked (Design Decisions Confirmed With User above).
- *Accessibility (WCAG 2.1 AA)* → keyboard-reachable tooltip (AC7), roving-tabindex grid nav (AC8), and popover focus trap (Task 5) all covered by Task 11's explicit a11y test assertions.
- *Cross-story consistency* → this story's exact contract (`status`/`errorMessage`/`errorDetail`, `moreLabel` as a resolver function, `closePopoverLabel`) is reconciled with and corrected into Story 1.3f, its confirmed first consumer (Consumer Story Sync Check above), so the two stories cannot drift.
- *AD-9 (Date/Week Selection UI Convention)* → `WeekPicker.tsx` (Task 14) is the sanctioned `Button`+`Popover`+`Calendar` composition, sourcing its boundary exclusively from a caller-supplied `getWeekRange` — never a second, independently-computed boundary (Task 14's explicit non-negotiable).
- *Story-split-gate Gate 3 (this reopening)* → the missing `packages/ui` shadcn/Radix setup, needed by both this story and Story 1.5, is not absorbed here — split into prerequisite Story 0.28 (Architecture & UX Gate Findings above).
- *Controlled-component contract (AC2, re-affirmed by Task 16)* → the divergent `visibleDays` Sunday-start recomputation is removed, not patched to a different hardcoded weekday — `WeeklyCalendarView` performs no boundary math of its own, full stop.

### Verification Plan

- `packages/ui`: `WeeklyCalendarView.test.tsx` — full AC coverage per Task 11 (grid/header rendering, multi-day spanning + clamping, overflow + popover open/close/focus-trap/dismiss, click wiring from both grid and popover cards, tooltip hover+keyboard-focus reachability, roving-tabindex movement model, loading/error/success states, locale/timezone graceful degradation), plus the updated week-picker test (Task 15) and non-Sunday `weekStart` regression test (Task 16).
- `packages/ui`: new `WeekPicker.test.tsx` (Task 14) — trigger/popover open, date selection calls `onSelectWeek`, popover closes on selection, correct week row highlighted per a test `getWeekRange` stub.
- Manual: `pnpm build`/`pnpm lint` clean at the repo root for `packages/ui`.
- Downstream verification (not owned by this story, tracked here for traceability): Story 1.3f's own `CalendarView.test.tsx` and its Task 3 ("verify Story 1.3g is done, do not re-implement here") are the integration-level proof that this component's actual contract matches what Story 1.3f assumes — now corrected to match exactly. Stories 1.3f/2.6 also each need their own follow-up to pass the new `getWeekRange` prop once this story ships (Current Implementation State above) — tracked there, not here.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: this story builds only the `WeeklyCalendarView` `packages/ui` presentational component (grid, header, compact cards, multi-day spanning, overflow popover, tooltip, roving-tabindex nav, loading/error states), plus the small documentation-only correction to Story 1.3f (Consumer Story Sync Check). It does **not** build Story 1.3f's `CalendarView` data-fetching wrapper, the view-switcher, or any backend/query work.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from `epic-1-readiness.md` (`swept: true`), no gap applicable to a pure frontend presentational component with `Depends on: None`. Gate 2 run fresh via subagent — no further component/hook split required; see Architecture & UX Gate Findings above.
- [ ] **"+N more" disclosure mechanism accepted:** floating popover (not inline expansion), modeled on `blocking-loader.tsx`'s focus-trap pattern — per explicit user decision (Design Decisions Confirmed With User above).
- [ ] **Consumer-story sync corrections accepted:** the `status`/`errorMessage`/`errorDetail` prop shape (not `loading`/`error`), `moreLabel` as a `(count) => string` resolver function, and the new `closePopoverLabel`/`calendarClosePopoverLabel` requirement have all been reconciled into Story 1.3f directly (Consumer Story Sync Check above).
- [ ] Architecture and data/API boundaries confirmed: no DB/ORM access, no GraphQL/generated-type import, no `next-intl`/`nuqs`/React Query dependency inside `packages/ui` — fully controlled, framework-agnostic component.
- [ ] Testing plan confirmed: `WeeklyCalendarView.test.tsx` covering all 12 ACs including the a11y-specific assertions (tooltip keyboard reachability, popover focus trap, roving-tabindex model) per Task 11.
- [ ] **AC13 scope confirmed:** Task 13 (blocked on Story 0.28) is not started until 0.28 is `done`. `WeekPicker.tsx` sources its boundary exclusively from the caller-supplied `getWeekRange` — no independent boundary math (AD-9 rule 3).
- [ ] **Gate 3 prerequisite confirmed:** the `packages/ui` shadcn/Radix setup gap is not absorbed into this story — deferred to Story 0.28, confirmed via `AskUserQuestion` (Architecture & UX Gate Findings above).
- [ ] **Task 16 scope confirmed:** the divergent `visibleDays` boundary recomputation is deleted, not replaced with different hardcoded weekday math — `WeeklyCalendarView` performs no boundary calculation of its own (controlled-component contract, AC2).
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/ui`: `WeeklyCalendarView.test.tsx` (existing, AC1-12 done) — see Task 11 for the full enumerated coverage list. No `packages/domain` logic is introduced by this story, so the 100% domain-coverage rule does not apply here; this component follows the same Vitest + Testing Library integration-style convention as `EventCard.test.tsx`/`EventListView.test.tsx`/`NavRailItem.test.tsx`.
- `packages/ui`: `WeeklyCalendarView.test.tsx` updates for AC13/Task 16 (new week-picker mechanism test, non-Sunday `weekStart` regression test) and new `WeekPicker.test.tsx` (Task 14) — see Verification Plan above for exact coverage.
- Manual: `pnpm build`/`pnpm lint` clean at the repo root.
- E2E: none owned by this story — Story 1.3f's Definition of Done already specifies the one required E2E happy-path test covering the composed Discovery Calendar View flow (switch view, navigate week, click a schedule), which will exercise this component as an implementation detail, not a standalone E2E target of its own (matching `EventCard`/`EventListView`/`EventDiscoveryPanel`'s precedent of no dedicated E2E test for a `packages/ui` primitive).

## Deliverables Checklist

- [x] `WeeklyCalendarView` renders a 7-column weekly grid with locale-aware day headers, date-range label, and prev/next/Today navigation (AC1, AC2).
- [x] Compact schedule cards render with correct main/sub-schedule title formatting (AC3).
- [x] Multi-day schedules render as connected per-day segments, clamped to the visible week (AC4).
- [x] Overflow capping + "+N more" floating popover implemented with full keyboard support (focus trap, `Escape`, outside-click dismiss, return-focus); `moreLabel` invoked as a per-day-count resolver function (AC5).
- [x] `onScheduleClick` wired from both grid and popover cards (AC6).
- [x] Hover + keyboard-focus-reachable tooltip with full title/time range (AC7).
- [x] Roving-tabindex arrow-key grid navigation implemented and tested (AC8).
- [x] All labels pre-resolved via `labels` prop; no `next-intl` import; locale/timezone via `useScopedLocale`/`useScopedTimezone` with graceful degradation (AC9).
- [x] Local, decoupled `WeeklyCalendarViewScheduleShape` generic type, no `apps/web`-generated type import (AC10).
- [x] `status`/`errorMessage`/`errorDetail` states implemented matching `EventListView`'s pattern (AC11).
- [x] Exported and documented from `packages/ui/src/features/events/index.ts` (AC12).
- [x] Story 1.3f's Task 5/Task 7 corrected to match this story's actual contract (Consumer Story Sync Check).
- [x] `pnpm build`/`pnpm lint` clean at the repo root.
- [ ] `WeekPicker.tsx` built per AD-9 (`Button`+`Popover`+`Calendar`, `getWeekRange`-sourced week-row highlight, no independent boundary math) — Task 14 (AC13).
- [ ] Native `<input type="date">` stopgap replaced by `WeekPicker` in `WeeklyCalendarView`'s header row; `getWeekRange` prop added — Task 15 (AC13).
- [ ] Divergent `visibleDays` Sunday-start recomputation removed — Task 16.
- [ ] `WeeklyCalendarView.test.tsx` updated for the new picker mechanism and a non-Sunday `weekStart` regression case; new `WeekPicker.test.tsx` passing.

## Out of Scope

- **Story 1.3f's `CalendarView` wrapper** (data-fetching, `week`/`view` URL state, `apps/web`-level routing/navigation on schedule click, and — newly — passing the `getWeekRange` prop this story's AC13 adds) — consumes this component, not built here.
- **Story 1.3h's backend schedule-level date-range query support** — unrelated backend capability; this component receives whatever `schedules` array its caller already fetched.
- **Story 2.6's "My Calendar" page** — a second consumer of this same component (`maxEventsPerDay: -1`, favorited/added-to-calendar-scoped data), including its own `getWeekRange` wiring — not built here; per Note in `epics.md`, Story 2.6's own AC text has not yet been confirmed to match this component's exact contract — Story 2.6 should re-confirm/adjust against this story's actual shipped contract when it is drafted.
- **A generic `packages/ui` Popover/Disclosure primitive** — evaluated by Gate 2 and explicitly rejected for extraction (no confirmed ≥2-consumer case yet; see Architecture & UX Gate Findings). The "+N more" popover built here is scoped to this component only. (`WeekPicker`'s own `Popover` usage is the shadcn primitive from Story 0.28, a different thing — not this rejected generic-disclosure primitive.)
- **A generic roving-tabindex/grid-keyboard-nav hook** — same reasoning; implemented inline for this component only.
- **Story 0.28 itself** (`packages/ui`'s shadcn/Radix setup) — a hard prerequisite for Task 13+, built as its own story, not here.

## Definition of Done

- All 13 Acceptance Criteria satisfied (AC1-12 already were; AC13 targeted at Tasks 13-16).
- `WeeklyCalendarView.test.tsx` passing with the full coverage enumerated in Task 11 plus the AC13/Task 16 additions; `WeekPicker.test.tsx` passing.
- Lint and type checks passing for `packages/ui`.
- `pnpm build` clean at the repo root.
- Manual confirmation that Story 1.3f's (corrected) documented prop contract is satisfied exactly, since that story cannot proceed to completion without it.
- Story 0.28 is `done` before Task 14 starts.

## Completion Status

**Reopened 2026-08-15** — AC1-AC12 previously complete (`review` status). AC13 outstanding, blocked on Story 0.28 (Tasks 13-16 above). A prior partial `bmad-quick-dev` attempt (commit `519f822`) already added a functional-but-non-AD-9-compliant native-input stopgap for `onSelectWeek` — see Dev Notes → Current Implementation State for the precise starting point and why it doesn't satisfy AC13 as-is.

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Completion Notes List

- Implemented `WeeklyCalendarView` presentation component contract fully decoupled from Next.js frameworks/GraphQL types.
- Designed week segmenting/clamping logic to render multi-day spanning events seamlessly across grid cells with continuation visual styles.
- Created robust keyboard roving tabindex grid navigation with synchronous focus shifts.
- Crafted accessible hover+keyboard-focus inline tooltips with custom dismiss handlers.
- Hand-rolled fully accessible overflow "+N more" disclosure popover with a focus trap, return-focus on close, outside click, and Escape key dismiss behavior.
- Documented component and successfully integrated with 100% test coverage in `WeeklyCalendarView.test.tsx`.
- Corrected prop contract naming inconsistencies and synchronized details into consumer story 1.3f.

### File List

- `packages/ui/src/features/events/WeeklyCalendarView.tsx`
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts`
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx`
- `packages/ui/src/features/events/index.ts`
- `_bmad-output/implementation-artifacts/1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md`

### Debug Log References

- Story created via `bmad-create-story` at the user's explicit request (`/bmad-create-story 1-3g`).
- Gate 1/3 sourced from `epic-1-readiness.md` (`swept: true`) per this project's epic-level-sweep-mode customization; only Gate 2 was run fresh (subagent, Freya's analytical lens) plus the lightweight escape-hatch guard for anything the sweep didn't anticipate — neither surfaced a gap requiring a new prerequisite story.
- One genuine design tradeoff was surfaced to the user via `AskUserQuestion` before drafting, per this project's `bmad-create-story` customization requiring real architecture/UX tradeoffs to be confirmed rather than silently picked: the "+N more" overflow disclosure mechanism (AC5) — floating popover vs. inline expansion, given DESIGN.md's fixed-height `day_cell` token and the absence of any existing popover primitive in the codebase. User confirmed: floating popover, modeled on `blocking-loader.tsx`'s existing focus-trap implementation. The multi-day-spanning layout strategy (AC4) was also evaluated but determined to be mechanically decidable from the ACs' own text (not escalated) — see Architecture & UX Gate Findings.
- At the user's explicit request, Story 1.3f (this story's confirmed first consumer, already drafted `ready-for-dev`) was re-read in full and cross-checked against this story's contract before finalizing. Found and corrected: (1) an internal inconsistency in 1.3f itself between its AC6 (`status` prop convention) and its Task 5 (`loading`/`error` props) — resolved in favor of `status`/`errorMessage`/`errorDetail`, matching both `epics.md`'s canonical AC11 and 1.3f's own AC6; (2) `moreLabel` needed to be a `(count) => string` resolver function, not a static string, to support 1.3f's Task 7 commitment to ICU-plural `next-intl` interpolation for `calendarMoreLabel`; (3) 1.3f's Task 7 i18n key list was missing a close/dismiss label for this story's popover (added `calendarClosePopoverLabel`). All three corrections applied directly to `1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md`. See Dev Notes → Consumer Story Sync Check above.

### Completion Notes List

_To be filled by the dev agent (for Tasks 13-16 / AC13)._

### File List

_To be filled by the dev agent (for Tasks 13-16 / AC13)._

### Change Log

- **2026-08-05**: Original story created (AC1-12), status `review`.
- **2026-08-15**: Reopened via `bmad-create-story` to add AC13 (manual week-picker, `sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md` Section 4.4, AD-9). Documented that a prior partial `bmad-quick-dev` attempt (`519f822`) already added a functional native-`<input type="date">` stopgap that does not satisfy AD-9's shadcn `Button`+`Popover`+`Calendar` composition requirement. Split a new Gate 3 finding (missing `packages/ui` shadcn/Radix setup, shared with Story 1.5) into prerequisite Story 0.28 rather than absorbing it here. Also scoped Task 16 to fix a divergent Sunday-start `visibleDays` boundary recomputation flagged during Story 3.7a's own reopening — latent since inception, only became a live bug once 3.7a's boundary math became Monday-start.
