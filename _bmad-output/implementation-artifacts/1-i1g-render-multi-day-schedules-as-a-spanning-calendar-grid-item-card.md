# Story 1.i1g: Render Multi-Day Schedules as a Spanning Calendar Grid Item Card

## Story Details

- Epic: 1.i1
- Story ID: 1.i1g
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a multi-day schedule to render as ONE `EventCardCalendarGridItem` (with-image composition) spanning across the day-columns it covers in `grid_weekly`, instead of N independent per-day-cell segments,
so that the desktop calendar grid shows multi-day events with the same richer card the mobile/masonry surfaces already have, matching DESIGN.md/EXPERIENCE.md's finalized "Calendar View Cards: Attachment and Composition" spec.

## Acceptance Criteria

**Spanning mechanism**

1. **Given** today's `WeeklyCalendarView.tsx` has no true cross-column spanning mechanism — a multi-day schedule (`eventEndDate !== eventStartDate`) currently renders as N independent `CalendarCard` instances, one nested inside each of the N day cells it overlaps, cosmetically "joined" only via `multiDayRoundingClass`'s corner-rounding suppression at touching edges — **when** this story ships, **then** a multi-day schedule renders as exactly ONE `EventCardCalendarGridItem` (with-image composition, built by prerequisite Story 1.i1f) positioned as a direct child of `grid_weekly`'s CSS grid (not nested inside any single day cell's own `<div>`), spanning its clipped day-column range via `grid-column: <start-line> / span <N>` — width `N * day_cell_width`, computed automatically by the grid's own equal-column track sizing (no manual pixel-width math needed).
2. **And** this spanning bar renders in a new, dedicated auto-height row positioned above the existing day-cell row, inside a sibling `grid grid-cols-7` container that reuses the exact same column classes as the day-header and day-cell grids (`GRID_WEEKLY_CLASS`) so its column boundaries align pixel-for-pixel with both.
3. **And** the clipped start/end day-column indices are computed the same way `dayBuckets` already clips segments to the visible week (existing `toISODateString`/`diffInDays` helpers) — a schedule that starts before the visible week's first day, or ends after its last day, spans from/to that boundary column, not off-grid.

**Overlap stacking (uncapped, per user decision 2026-09-19)**

4. **Given** two or more multi-day schedules can overlap the same visible week, **when** this story ships, **then** each multi-day schedule renders in its own full-width row within the new banner area — one visual row per schedule, stacked vertically top-to-bottom in ascending `(eventStartDate, eventStartTime ?? '99:99', id)` order (matching `dayBuckets`' own existing per-day sort convention) — **not** packed side-by-side into shared rows by column-overlap detection, and **not** capped: the banner area's height simply grows to fit however many multi-day schedules are in the visible week. No "+N more"/overflow affordance is built for the banner itself in this story (see Out of Scope).

**Single-day surface stays untouched**

5. **Given** `event_rendering.discovery_view.max_events_per_day` (5) governs how many schedules show directly in a day cell before "+N more" takes over, **when** this story ships, **then** the desktop grid's day-cell row (`DAY_CELL_CLASS`, still `h-32`) and its "+N more" popover continue rendering **only single-day schedules**, completely unchanged in composition (still today's plain-text `CalendarCard`) and cap behavior — multi-day schedules are excluded from both the day cell's visible-capped list and the popover's full per-day list once they have their own spanning bar (no duplicate rendering of the same multi-day schedule in two places).
6. **And** this exclusion applies **only** to the desktop grid variant's own rendering/consumption of the shared `dayBuckets` memo — the memo itself is not filtered at its source (mobile's `variant='list'` vertical day-list still needs multi-day segments in its bucket). The `variant === 'list'` (mobile) render path, its own multi-day per-day-segment treatment, its "Day X of N" badge (`multiDaySegmentLabel`), and its `multiDayRoundingClass = "rounded-md"` rule are all completely unaffected by this story — filter at the desktop grid's render/popover call sites, not in the shared `dayBuckets` computation.

**Superseded per-segment chrome removed (grid variant only)**

7. **Given** the multi-day case no longer renders repeated per-column segments, **when** this story ships, **then** the desktop grid variant's `multiDayRoundingClass` edge-suppression branch (the `isFirstSegment`/`isLastSegment`-conditional corner-rounding logic in `CalendarCard`'s `variant !== 'list'` path) and any "Day X of N" grid-variant badge concept are removed as dead code for the grid variant — a single spanning element needs no segment-joining trick; ordinary uniform rounding on the new `EventCardCalendarGridItem` card is sufficient. (Mobile's own separate `Day X of N` badge and `rounded-md` rule, both under the `variant === 'list'` branch, are untouched — see AC6.)

**Primitive wiring and composition fidelity**

8. **And** the spanning bar passes `EventCardCalendarGridItem` (Story 1.i1f) the with-image composition's required data: `isMultiDay={true}`, `imageUrl`, `title`/`eventName`, `locationName` (venue — see AC10), favorite state + count + toggle handler, and `distanceKm` when present (per Story 1.i1f's own data plumbing) — confirm the primitive's exact prop names against its shipped `EventCardCalendarGridItem.types.ts` at implementation time, since Story 1.i1f is not yet implemented as of this story's creation.
9. **And** `EventCardCalendarGridItem.base`'s `items-center` alignment (image, title/venue content, and the favorite/nearby-badge side stack all sized to their own natural height and centered against the row's tallest sibling — **not** `items-stretch`) renders correctly at real spanning widths (a 1-day-wide span through a full 7-day-wide span), per DESIGN.md's `event_card_calendar_grid_item.base` token (flagged by this story's own Gate 2 review, 2026-09-19, as missing from the epics.md draft AC set).

**Data plumbing gap this story must close (found during drafting, not in epics.md's original AC set — required for the with-image composition to render correctly, not optional)**

10. **Given** `WeeklyCalendarViewScheduleShape` has no venue/location field today, and `useWeeklyCalendarController.ts`'s `schedules` flatMap does not map one — even though both `getEventsForCalendar` and `getEventsForMyCalendar` already select `location` at the `Event` level (`apps/web/src/features/events/queries.graphql`, confirmed by direct read) — **when** this story ships, **then** `WeeklyCalendarViewScheduleShape` gains `locationName?: string`, and the controller's flatMap populates it as `locationName: event.location ?? undefined`, matching `EventListView.tsx`'s exact existing precedent for the identical field (masonry's own `locationName` prop). No GraphQL query change and no codegen regeneration are needed — `location` is already selected by both queries; this is purely a dropped-mapping fix.

**Accessibility (system must keep working correctly, not just satisfy the stated ACs)**

11. **Given** neither the with-image nor no-image `EventCardCalendarGridItem` composition renders a date box, and a sighted user infers a multi-day schedule's date range purely from which day-columns the spanning bar visually covers, **when** this story ships, **then** the spanning bar exposes the same date-range information to assistive technology and to sighted mouse/keyboard users who haven't yet interacted with it, by reusing this file's existing hover/focus tooltip mechanism (`formatTooltipTimeRange`, `aria-describedby`, the same interaction/dismiss pattern `CalendarCard`'s grid variant already implements) rather than inventing a new mechanism — a screen-reader user cannot perceive column position, so an equivalent text alternative is required for the feature to actually work, not merely for the AC to read complete.

**Keyboard/focus model (per user decision 2026-09-19)**

12. **And** the spanning bar is a simple, linear Tab stop — **not** folded into the existing 2D roving-tabindex arrow-key grid (`activeCardCoords`/`gridCards`/`handleGridKeyDown`) that governs day-cell `CalendarCard` navigation, since a spanning bar does not correspond to one `dayIdx` column. It follows the same non-roving pattern today's "+N more" popover items already use (`cardIdx={-1}`, plain `tabIndex={0}`, Enter/Space via native `<button>` semantics activates `onScheduleClick`).

**Test coverage of the superseded behavior**

13. **And** `WeeklyCalendarView.test.tsx`'s existing tests asserting the old per-segment behavior (`renders a multi-day schedule as connected per-day segments` — currently asserts 3 separate `Tech Workshop` text nodes; `clips multi-day schedules at week boundaries correctly` — currently asserts 3 separate `Boundary Festival` text nodes) are rewritten to assert the new single-spanning-element behavior (exactly one rendered instance, positioned/spanning correctly, clipped at week boundaries) instead of N duplicated per-day nodes.

## Tasks / Subtasks

- [ ] **Task 1 — Close the `locationName` data-plumbing gap (AC10)**
  - [ ] 1.1 Add `locationName?: string` to `WeeklyCalendarViewScheduleShape` (`WeeklyCalendarView.types.ts`).
  - [ ] 1.2 In `useWeeklyCalendarController.ts`'s `schedules` flatMap, add `locationName: event.location ?? undefined`, matching `EventListView.tsx`'s existing mapping verbatim.
  - [ ] 1.3 Add/extend `useWeeklyCalendarController.test.tsx` coverage confirming `locationName` is populated from `event.location` and gracefully `undefined` when absent.

- [ ] **Task 2 — Compute the multi-day spanning set (AC1, AC3, AC4, AC6)**
  - [ ] 2.1 Add a new memo (e.g. `spanningSchedules`) derived from `schedules` (not from the shared `dayBuckets` memo — do not filter `dayBuckets` itself, per AC6) that: filters to schedules overlapping the visible week with `eventEndDate !== eventStartDate`; computes each one's clipped `startColIdx`/`endColIdx`/`spanCount` against `visibleDays` using the existing `toISODateString`/`diffInDays` helpers; sorts ascending by `(eventStartDate, eventStartTime ?? '99:99', id)`.
  - [ ] 2.2 Confirm this new memo has zero effect on the existing `dayBuckets` memo, `gridCards` memo, or the mobile `variant='list'` render path — all three continue receiving single-day **and** multi-day entries exactly as today (AC6).

- [ ] **Task 3 — Filter multi-day out of the desktop grid's day-cell/popover rendering (AC5, AC6)**
  - [ ] 3.1 At the desktop grid's day-cell render call site (today's `dayBuckets.map((bucket, dayIdx) => ...)` block, lines ~582-676), filter each `bucket` to single-day entries only (`!isMultiDay`) before computing `displayLimit`/`visibleSegments`/`hiddenCount` and before rendering the popover's full bucket list — leaving the mobile `variant='list'` block (lines ~679-730) reading the unfiltered `bucket` exactly as today.
  - [ ] 3.2 Verify the "+N more" popover's count/contents reflect single-day schedules only post-filter (no multi-day duplication, no off-by-N-from-excluded-multi-day count).

- [ ] **Task 4 — Build the spanning-bar subcomponent and banner row (AC1, AC2, AC7, AC8, AC9, AC11, AC12)**
  - [ ] 4.1 Add a new colocated subcomponent in `WeeklyCalendarView.tsx` (matching `CalendarCard`'s existing colocation precedent — e.g. `MultiDaySpanningBar`) that: renders `EventCardCalendarGridItem`'s with-image composition (confirm exact prop names against Story 1.i1f's shipped `EventCardCalendarGridItem.types.ts`); positions itself via inline `style={{ gridColumn: `${startColIdx + 1} / span ${spanCount}` }}`; reuses `formatTooltipTimeRange` + the same local hover/focus/dismiss `useState` pattern and `aria-describedby` tooltip JSX `CalendarCard`'s grid variant already implements (AC11); is a plain linear Tab stop, `tabIndex={0}`, no roving-tabindex wiring (AC12); wraps the primitive following this epic's established "non-interactive chrome + sibling interactive elements" pattern (Story 1.i1d's `variant='list'` restructure) so the primitive's own internal favorite-toggle control is never nested inside the schedule-click element (AC7) — confirm the primitive's exact click-target/favorite-toggle contract against its as-shipped implementation, since Story 1.i1f is not yet built.
  - [ ] 4.2 Render the new banner: a `grid grid-cols-7 divide-x divide-gray-200` container (reusing `GRID_WEEKLY_CLASS` verbatim, AC2) placed directly above the existing day-cell grid, containing one `MultiDaySpanningBar` per entry in `spanningSchedules` (Task 2), each in its own row (AC4) — do not render the container at all when `spanningSchedules` is empty (no empty banner chrome).
  - [ ] 4.3 Wire `onScheduleClick`/`onFavoriteToggle`/`locale`/`timezone`/labels through identically to how `CalendarCard` already receives them.

- [ ] **Task 5 — Remove superseded grid-variant dead code (AC7)**
  - [ ] 5.1 In `CalendarCard`'s `multiDayRoundingClass` computation, remove the `variant !== 'list'` (`isFirstSegment`/`isLastSegment`-conditional) branch entirely — grid-variant `CalendarCard` no longer ever renders a multi-day segment (Task 3 filters them out), so this branch is unreachable dead code. Leave the `variant === 'list'` branch (`multiDayRoundingClass = "rounded-md"`) untouched.
  - [ ] 5.2 Grep the file for any other now-unreachable multi-day-segment logic scoped to the grid variant specifically (e.g. `isMultiDay`-conditional styling inside the grid-variant `CalendarCard` render branch) and remove it, without touching the equivalent mobile-list-variant logic.

- [ ] **Task 6 — Rewrite superseded tests, add new coverage (AC13, plus new-behavior coverage for AC1-AC12)**
  - [ ] 6.1 Rewrite `renders a multi-day schedule as connected per-day segments` to assert exactly one rendered `Tech Workshop` instance, spanning the correct 3 columns.
  - [ ] 6.2 Rewrite `clips multi-day schedules at week boundaries correctly` to assert exactly one rendered `Boundary Festival` instance, clipped to the correct boundary columns (not the schedule's true out-of-week start/end).
  - [ ] 6.3 Add new tests: two overlapping multi-day schedules render as two stacked banner rows in the correct sort order; a multi-day schedule no longer appears inside its days' "+N more" popover or capped visible list; single-day schedules and their existing cap/popover behavior are provably unaffected (regression guard); the spanning bar's tooltip/`aria-describedby` renders the correct date-range text on hover/focus; the spanning bar is reachable via linear Tab order and is excluded from arrow-key day-cell navigation; `locationName` renders on the spanning card when present and degrades gracefully when absent.
  - [ ] 6.4 Confirm `useWeeklyCalendarController.test.tsx`'s new `locationName` coverage (Task 1.3) passes.

- [ ] **Task 7 — Full verification (all ACs)**
  - [ ] 7.1 Run `packages/ui`'s Vitest suite and confirm all touched/added tests pass, with no regression in existing `WeeklyCalendarView`/`useWeeklyCalendarController` suites (including the ones shipped by 1.i1a-1.i1e/1.i1z, all currently `review` status).
  - [ ] 7.2 `eslint` and `tsc --noEmit` clean for every touched file (or no new errors beyond this epic's documented pre-existing baseline).
  - [ ] 7.3 Manually confirm (or via a Playwright/visual check if convenient) that banner-row columns align pixel-for-pixel with the day-header and day-cell grids at a real desktop width.

## Dev Notes

- **This story cannot be meaningfully implemented until Story 1.i1f ships.** `EventCardCalendarGridItem` (`packages/ui/src/features/events/EventCardCalendarGridItem.tsx`) does not exist in the codebase as of this story's creation — confirmed via direct file listing (`packages/ui/src/features/events/` has no `EventCardCalendarGridItem*` files). Story 1.i1f is `sprint-status.yaml` status `ready-for-dev` (not yet dev-story'd). This mirrors the exact same situation Story 1.i1j documented for its own dependencies (1.i1f/1.i1i) — see this story's own Pre-Coding Approval Gate blocking checklist item.
- **Three architecture decisions below were made via `AskUserQuestion` with the story's own user on 2026-09-19, before this story was drafted**, since DESIGN.md/EXPERIENCE.md specify the spanning card's visual composition and width but not the underlying CSS grid mechanics, overlap-stacking behavior, or keyboard model — none of which are mechanical/routine choices:
  1. **Layout mechanism:** a new dedicated banner row above the day-cell row (not an overlay/interleave into the day-cell row itself) — the only structurally sound option, since a CSS-grid spanning item must be a direct child of its grid container, and day cells are independently-scrolling flex-col boxes that cannot host a cross-cell-spanning child. User's own clarification: this banner is for multi-day schedules only — single-day rendering in the day cells is completely unaffected (AC5/AC6).
  2. **Overlap stacking:** each overlapping multi-day schedule gets its own full-width row, uncapped — no lane-packing algorithm, no overflow mechanism for the banner itself (AC4, Out of Scope).
  3. **Keyboard model:** simple linear Tab order, not folded into the existing 2D roving-tabindex day-cell grid (AC12).
- **Files read in full before drafting this story** (current-state summary, so `bmad-dev-story` does not need to re-derive these from scratch):
  - `packages/ui/src/features/events/WeeklyCalendarView.tsx` (full file, 985 lines) — `grid_weekly` is declared TWICE today as separate sibling `<div className={GRID_WEEKLY_CLASS}>` blocks: once for day headers (lines 569-578), once for day cells (lines 581-676) — this story adds a THIRD sibling instance (the banner) between them, reusing the identical `GRID_WEEKLY_CLASS` constant so columns align. `dayBuckets` (lines 256-291) is the single shared memo feeding both the desktop grid (582-730) and the mobile list (680-730) — bucketing is NOT variant-aware today, so any filtering for the desktop grid must happen at its own render call site, not in this memo (AC6, Task 3). `CalendarCard` (lines 758-984) branches internally on its own `variant` prop; the grid-variant path (937-983) is the one whose multi-day handling becomes unreachable after Task 3/5. `gridCards`/`activeCardCoords`/`handleGridKeyDown` (lines 293-375) already correctly scope themselves to whatever `dayBuckets`-derived entries the desktop grid renders — once Task 3 excludes multi-day, this logic needs no direct edits, only correct input.
  - `packages/ui/src/features/events/WeeklyCalendarView.types.ts` (full file) — `WeeklyCalendarViewScheduleShape` has no venue field today (confirmed the gap this story's AC10 closes) and no `distanceKm` yet either (that's Story 1.i1f's own addition, not yet shipped — this story's types work is independent of and does not conflict with 1.i1f's pending `distanceKm?` addition, since both are purely additive optional fields on the same interface).
  - `packages/ui/src/hooks/useWeeklyCalendarController.ts` (full file) — the `schedules` flatMap (lines ~54-73) maps `event`/`schedule` fields one-by-one; confirmed it drops `event.location` despite both calendar GraphQL queries already selecting it (see below).
  - `apps/web/src/features/events/queries.graphql` — `getEventsForCalendar` (lines ~138-157) and `getEventsForMyCalendar` (lines ~164-190) both already select `location` at the `Event` level (`items { ... location ... }`) — confirmed via direct read. This story requires **no GraphQL document change and no codegen regeneration**, unlike Story 1.i1f's `distanceKm` work.
  - `packages/ui/src/features/events/EventListView.tsx` (relevant excerpt, line 78) — confirmed the established `locationName: event.location ?? undefined` mapping convention this story's Task 1.2 must match verbatim, and `EventCard.types.ts` (line 62) confirmed the `locationName?: string` prop-naming precedent this story's `WeeklyCalendarViewScheduleShape` addition follows.
  - `apps/web/src/features/events/CalendarView.tsx` (full file) — the only calendar consumer with nearby-filter wiring; confirmed it passes `schedules` straight through from `useWeeklyCalendarController` with no per-page mapping of its own, so **no changes are needed in `CalendarView.tsx`, `FeedCalendarView.tsx`, `AccountCalendarView.tsx`, or `my-calendar-content.tsx`** for this story — the `locationName` fix and the spanning-bar rendering are both fully internal to `packages/ui`'s `WeeklyCalendarView.tsx`/`useWeeklyCalendarController.ts`.
  - `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` — confirmed the two existing tests this story's AC13 rewrites (`renders a multi-day schedule as connected per-day segments`, line 234; `clips multi-day schedules at week boundaries correctly`, line 244), both currently asserting N duplicated text nodes, the exact old behavior this story replaces.
  - `_bmad-output/implementation-artifacts/1-i1f-wire-nearby-distance-badges-and-build-the-calendar-grid-item-card.md` (full file) — the direct prerequisite; its Task 7 defines `EventCardCalendarGridItem`'s expected composition/props (schedule fields: title/eventName, location/venue, imageUrl, isMultiDay, favorite state/count + toggle handler, distanceKm?) that this story's Task 4.1 wires against. Its own Dev Notes confirm the primitive is built and component-tested standalone but **not** wired into any live render path — this story is that wiring, for the multi-day half only (single-day half is Story 1.i1h's).
  - DESIGN.md `components.event_card_calendar_grid_item` / `components.calendar.grid_weekly`/`day_cell`/`event_rendering` (full token blocks) and EXPERIENCE.md "Calendar Grid Item Card: Desktop Composition and Fallback" + "Calendar View Cards: Attachment and Composition" sections (full text) — the with-image composition's exact layout rules (image/content/side_stack, `items-center`, no date box, no status badge, title wraps freely, venue wraps 2 lines, nearby badge `<8km`-gated) and the multi-day "ONE spanning bar, not the popover" attachment decision this story implements.

### Architecture & UX Gate Findings

`epic-1-i1-readiness.md` (swept 2026-09-13) covers only Stories 1.i1a-e/1.i1z — it does not cover 1.i1g (added 2026-09-17, after the sweep). Following the same precedent Story 1.i1i/1.i1j established for stories added after the sweep, Gate 1/3 were reasoned fresh (not subagent-dispatched, per the lightweight escape-hatch guard) rather than blindly cited, and Gate 2 was dispatched fresh via `runSubagent` since it is inherently per-story.

- **Gate 1 (Architecture/Infrastructure Completeness) — NO GAP.** This story's entire scope is a `packages/ui` rendering restructure (CSS grid placement, a new colocated subcomponent, a dropped-field mapping fix inside an existing hook) plus a type addition. No new resolver/query/mutation is introduced — `location` is already selected by both calendar GraphQL queries; this story only maps already-fetched data through an existing hook. No DB/ORM/domain package is called directly from `apps/web`/`packages/ui`. No external service is called directly from the frontend. No auth/secrets/business rules are added. Fully consistent with the original sweep's characterization of this epic as "pure presentational `packages/ui` work end to end," and consistent with Story 1.i1i/1.i1j's own Gate 1 conclusions for stories added the same day.
- **Gate 2 (UI Complexity & Reusability, Freya persona, `runSubagent`, 2026-09-19) — NO SPLIT, one AC addition applied.** Dispatched fresh against this story's exact scope (the banner-row mechanism, the new subcomponent, the primitive-wiring). Findings: (1) no new shared/reusable component is being built here — the story only wires an already-separately-scoped primitive (1.i1f) into one grid position; (2) the new spanning/stacking logic is genuinely non-trivial but lives entirely inside the one shared `WeeklyCalendarView.tsx` all 4 consumer pages already reach through a single code path — it is not being reimplemented per-consumer, so it does not meet the "multiple components independently depend on this" trigger; no second calendar-grid-like surface exists in the codebase today that would need this mechanism extracted; (3) one real spec-fidelity gap found: DESIGN.md's `items-center` alignment detail was missing from the original epics.md AC draft — folded into this story as AC9, not warranting a split. Full reviewer output preserved in this story's Change Log entry.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — NO GAP.** No global shell, i18n foundation (the tooltip's date/time formatting reuses existing `Intl`-based locale formatting already established elsewhere in this file; the `locationName` fix introduces no new translatable string), analytics foundation, or GraphQL/codegen dependency is implicated. No project-context.md-mandated utility or architecture-spine item is referenced with no owning story. The `locationName` data-plumbing fix (AC10) is a narrow, mechanical completion of a hook this story already touches for its own multi-day work — not a new mechanism or reusable infrastructure in its own right (same classification Story 1.i1f's Gate 3 applied to its own `useNearbyFilter` coordinate-completeness fix).

No `AskUserQuestion` was needed for the gate outcomes themselves (all three resolved with no gap/no split) — the three `AskUserQuestion` rounds recorded above were for the pre-gate architecture-mechanism decisions (layout/stacking/keyboard), not gate escape-hatch overrides.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No database schema change of any kind. This story adds one new optional TypeScript field (`locationName?: string` on `WeeklyCalendarViewScheduleShape`) sourced from a GraphQL field (`Event.location`) both relevant queries already select — no GraphQL document change, no codegen regeneration required.
- **Impacted fields/contracts:**
  - `packages/ui/src/features/events/WeeklyCalendarView.types.ts` — `WeeklyCalendarViewScheduleShape.locationName?: string` (new, optional, additive — every existing consumer/caller that doesn't set it is unaffected).
  - `packages/ui/src/hooks/useWeeklyCalendarController.ts` — `schedules` flatMap gains one new mapped field (`locationName: event.location ?? undefined`), matching `EventListView.tsx`'s existing precedent exactly; no change to the hook's own options/return type shape otherwise.
  - No change to any GraphQL query document, resolver, or generated type.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** As listed above — one additive optional field, no breaking changes to any existing interface or consumer.
- **Backward compatibility and rollout notes:** `locationName` is optional; every existing test/consumer that constructs a `WeeklyCalendarViewScheduleShape` without it continues to compile and render unaffected (the primitive/spanning-bar component must itself degrade gracefully — e.g. an empty venue line or omitted venue text — when `locationName` is `undefined`, matching this project's general optional-field convention; confirm the exact empty-state treatment against `EventCardCalendarGridItem`'s as-shipped behavior at implementation time since 1.i1f is not yet built).
- **Verification checks:** `useWeeklyCalendarController.test.tsx`'s new `locationName` mapping coverage (Task 1.3); `WeeklyCalendarView.test.tsx`'s new spanning-bar composition tests confirming `locationName` renders when present and degrades gracefully when absent (Task 6.3).

### Project Structure Notes

- No new workspace package boundaries are crossed — this story's entire scope is inside `packages/ui/src/features/events/` (`WeeklyCalendarView.tsx`, `.types.ts`, `.test.tsx`) and `packages/ui/src/hooks/` (`useWeeklyCalendarController.ts`, `.test.tsx`).
- The new spanning-bar subcomponent (Task 4.1) should be colocated inside `WeeklyCalendarView.tsx`, matching `CalendarCard`'s own existing colocation precedent in the same file, rather than extracted to a new file — unless implementation experience shows the file has grown unwieldy, in which case extracting to a sibling file is an acceptable, non-scope-changing implementation choice.
- No detected conflicts with in-flight work: Stories 1.i1a-e/1.i1z are all `review` status (implemented, not yet code-reviewed to `done`); this story's edits to `WeeklyCalendarView.tsx`/`WeeklyCalendarView.types.ts`/`useWeeklyCalendarController.ts` touch different, non-overlapping regions than 1.i1d's (`variant='list'` restructure) and 1.i1e's (masonry `EventCard.tsx`) diffs — low collision risk, but confirm no merge conflicts at implementation time. Story 1.i1f (once it ships) will also touch `WeeklyCalendarView.types.ts` (`distanceKm?`) and `useWeeklyCalendarController.ts` (viewer-coordinate wiring) — both additive, non-overlapping with this story's own additions (`locationName?`, no viewer-coordinate involvement) — but confirm no textual merge conflict on the same lines at implementation time, since both stories touch the same two files' flatMap/interface bodies.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Story 1.i1g section (base ACs) and Story 1.i1f section (primitive contract, prior Gate findings)]
- [Source: `design-artifacts/UX-festgrid-run-1/DESIGN.md` `components.event_card_calendar_grid_item`, `components.calendar.grid_weekly`/`day_cell`/`event_rendering`]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` "Calendar Grid Item Card: Desktop Composition and Fallback", "Calendar View Cards: Attachment and Composition", "Mobile Multi-Day Calendar Spanning" (confirms mobile is intentionally out of scope, already resolved separately)]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` — cited for Gate 1/3 reasoning continuity, not directly covering this story per its own `stories_covered` frontmatter]
- [Source: `_bmad-output/implementation-artifacts/1-i1f-wire-nearby-distance-badges-and-build-the-calendar-grid-item-card.md` — direct prerequisite, full Dev Notes read]
- [Source: `_bmad-output/implementation-artifacts/1-i1d-adopt-the-primitive-into-weeklycalendarview-compact-row.md` — the "non-interactive chrome + sibling interactive elements" pattern this story's Task 4.1 follows]
- [AskUserQuestion, 2026-09-19: layout mechanism (banner row above day cells), overlap stacking (uncapped, one row per schedule), keyboard model (linear Tab order) — all three user-confirmed]

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (no packages/domain involvement this story; pure `packages/ui` presentational work), Locale-Sensitive Data Rendering (tooltip date/time formatting reuses existing `Intl`-based locale-aware formatting already established in this file — no new raw/unformatted date rendering introduced), State Management Architecture (no new state management category introduced — `locationName` is plain-prop-derived server data, spanning-bar layout is pure render-time computation, hover/focus tooltip state mirrors `CalendarCard`'s existing local `useState` pattern).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no new AD introduced or touched (this story extends existing `packages/ui` component behavior only); AD-22 (distance display) indirectly relevant only insofar as this story passes through `distanceKm` once Story 1.i1f ships it, no new distance logic of its own.
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 executed per the epic-level-sweep escape-hatch guard (Gate 1/3 reasoned fresh citing sweep-consistent conclusions; Gate 2 dispatched fresh via `runSubagent`), findings recorded above.
- [x] `docs/infrastructure/index.md` — no infra/backend-compute/queue/EventBridge/DB-provisioning surface touched by this story (pure frontend `packages/ui` rendering + one hook mapping fix); no infra shard read required per the persistent-facts rule.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `packages/ui/src/features/events/WeeklyCalendarView.tsx` (new `spanningSchedules` memo, new colocated spanning-bar subcomponent, new banner-row JSX, desktop day-cell/popover filtering, dead-code removal in `CalendarCard`'s grid-variant `multiDayRoundingClass` branch); `packages/ui/src/features/events/WeeklyCalendarView.types.ts` (`locationName?: string`); `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` (rewritten + new tests); `packages/ui/src/hooks/useWeeklyCalendarController.ts` (`locationName` mapping); `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` (new coverage).
  - New: none required (spanning-bar subcomponent colocated per Project Structure Notes, unless implementation experience favors extraction).
  - Not touched: any GraphQL document, `apps/web/src/generated/graphql.ts`, any resolver, `CalendarView.tsx`/`FeedCalendarView.tsx`/`AccountCalendarView.tsx`/`my-calendar-content.tsx` (all confirmed unaffected, Dev Notes above).
- **Rule Mapping:**
  - AD-1/AD-2 → not implicated; no new API surface (Gate 1 finding).
  - project-context.md Code Organization → not implicated; no `packages/domain` involvement.
  - project-context.md Testing Rules → testing-trophy integration/component coverage for the `packages/ui` changes (Task 6); no `packages/domain` 100%-coverage rule applies here (nothing added to `packages/domain`).
  - project-context.md Locale-Sensitive Data Rendering → tooltip date formatting reuses existing `Intl`/`formatTooltipTimeRange` locale-aware mechanism (AC11, Task 4.1).
- **Verification Plan:** Task 7's full test/lint/typecheck pass across `packages/ui`'s touched files; manual (or Playwright) confirmation that the banner row's columns align with the day-header/day-cell grids at a real desktop width; confirmation via `git diff` that no GraphQL document, generated-types file, or consumer page (`CalendarView.tsx` et al.) is touched.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — this story restructures `WeeklyCalendarView.tsx`'s desktop grid to render multi-day schedules as ONE spanning `EventCardCalendarGridItem` in a new banner row above the day-cell grid (uncapped, one row per schedule, linear Tab order), leaves single-day rendering and the mobile list completely unchanged, and closes a `locationName` data-plumbing gap needed for the spanning card's venue text to render at all.
- [ ] **Blocking dependency confirmed** — Story 1.i1f (`EventCardCalendarGridItem` primitive) is `ready-for-dev`/not yet implemented as of this story's creation. This story's Task 4 cannot be completed until 1.i1f ships (or its `EventCardCalendarGridItem.types.ts` prop contract is otherwise locked) — confirm 1.i1f's status before starting `bmad-dev-story` on this story, or explicitly accept building against 1.i1f's story-file-documented (not yet code-verified) prop contract with a follow-up reconciliation pass once 1.i1f lands.
- [ ] Architecture and boundary confirmation — all changes stay inside `packages/ui` (`WeeklyCalendarView.tsx`/`.types.ts`, `useWeeklyCalendarController.ts`); no new API surface, no `packages/domain` involvement, no GraphQL/codegen change.
- [ ] Testing plan confirmation — Task 6/7's coverage across `packages/ui` (rewritten superseded tests, new spanning/stacking/a11y/keyboard/`locationName` coverage, full regression pass).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed — Gate 1: no gap (reasoned fresh, sweep-consistent). Gate 2: no split, `items-center` AC added (`runSubagent`, 2026-09-19). Gate 3: no gap (reasoned fresh, sweep-consistent). No new prerequisite stories or `sprint-status.yaml`/`epics.md` entries required by this story's own gate findings.
- [ ] Architecture-mechanism decisions confirmed — layout (banner row above day cells), overlap stacking (uncapped, one row per schedule), keyboard model (linear Tab order), all three user-confirmed via `AskUserQuestion` on 2026-09-19 before this story was drafted (see Dev Notes).

## Testing Requirements

- [ ] Component/integration tests — `WeeklyCalendarView.test.tsx`: rewritten multi-day tests (AC13), new banner/stacking/filtering/a11y/keyboard/`locationName` tests (Task 6.3); `useWeeklyCalendarController.test.tsx`: new `locationName` mapping coverage (Task 1.3).
- [ ] Regression coverage — confirm all pre-existing `WeeklyCalendarView`/`useWeeklyCalendarController` tests (single-day cap/popover behavior, roving-tabindex arrow-key nav, mobile list rendering, favorite/added-to-calendar icons) remain green and unmodified in intent (Task 7.1).
- [ ] E2E tests — not required for this story; existing component/integration coverage is sufficient for a presentational rendering restructure with no new user-facing flow beyond richer visual presentation of an already-clickable/already-favoritable card, consistent with this epic's established precedent (Story 1.i1f's own Testing Requirements reached the same conclusion for its comparable scope).

## Deliverables Checklist

- [ ] `WeeklyCalendarViewScheduleShape.locationName?: string` added and populated by `useWeeklyCalendarController.ts` from `event.location`.
- [ ] Multi-day schedules render as ONE spanning `EventCardCalendarGridItem` in a new banner row above the day-cell grid, columns aligned with day headers/day cells.
- [ ] Multiple overlapping multi-day schedules stack as separate uncapped rows, correctly sorted.
- [ ] Single-day day-cell/popover rendering, cap behavior, and mobile list rendering are all provably unaffected.
- [ ] Superseded grid-variant `multiDayRoundingClass`/"Day X of N" dead code removed (mobile's own equivalents untouched).
- [ ] Spanning bar has working hover/focus tooltip (`aria-describedby`) conveying the date range, and is a linear Tab stop outside the 2D roving-tabindex grid.
- [ ] All rewritten/new tests passing; `eslint`/`tsc --noEmit` clean.

## Out of Scope

- **Story 1.i1h** — single-day adoption of `EventCardCalendarGridItem` into the always-visible `day_cell`/overflow surface, the shared `calendar_overflow_dialog` component, the BUG-036 per-day-windowed backend fetch fix, and the resolver's outer `ORDER BY` tie-break sort. This story's day-cell/popover behavior stays exactly as it is today (still the plain-text `CalendarCard`, still `max_events_per_day=5`) — only multi-day schedules are pulled out into the new banner.
- **A cap/overflow mechanism for the multi-day banner row itself** — accepted, deliberate limitation per the user's own 2026-09-19 decision (uncapped, one row per overlapping schedule). If a pathological week with many concurrent multi-day schedules later proves this inadequate in practice, that is a new, separately-scoped story (its own lane-packing/cap/overflow mechanism), not a retroactive expansion of this one.
- **Mobile (`variant='list'`) multi-day rendering** — completely untouched; EXPERIENCE.md's "Mobile Multi-Day Calendar Spanning" section already resolved mobile's own per-day-segment + "Day X of N" badge treatment separately, and this story does not reconcile or unify the two breakpoints' multi-day models.
- **Extending the 2D roving-tabindex grid to include spanning cards** — considered and explicitly declined via the user's 2026-09-19 decision in favor of simple linear Tab order; not a deferred future story, a settled design decision for this feature.
- **Recalibrating `event_rendering.discovery_view.max_events_per_day` (5)** for the now-richer popover contents — DESIGN.md/EXPERIENCE.md explicitly flag this as "an architecture/product question for the amendment story, not a UX-doc decision," unresolved by any story in this epic yet (single-day/popover work is Story 1.i1h's, not this one's).
- Any i18n string changes — no new translatable strings are introduced by this story (tooltip formatting reuses existing `Intl`/locale-aware output; `locationName` is raw already-locale-neutral venue text, matching `EventCard`'s existing precedent for the same field).
- Any change to `EventCardCalendarGridItem`'s own internal composition, fallback logic, or unit tests — that is entirely Story 1.i1f's scope; this story only consumes the primitive as shipped.

## Definition of Done

- [ ] All Acceptance Criteria satisfied.
- [ ] All Task 7 tests passing (`packages/ui`, including full regression of pre-existing `WeeklyCalendarView`/`useWeeklyCalendarController` suites).
- [ ] Lint (`eslint`) and `tsc --noEmit` clean for every touched file (or no new errors beyond this epic's documented pre-existing baseline).
- [ ] No GraphQL document, generated-types file, resolver, or consumer page touched (confirmed via `git diff`).
- [ ] Story 1.i1f's `EventCardCalendarGridItem` primitive is either shipped, or this story's implementation against its documented-not-yet-verified prop contract has been explicitly reconciled once 1.i1f lands.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent._

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed (`bmad-create-story`, 2026-09-19). Read `WeeklyCalendarView.tsx`/`.types.ts` in full, the direct prerequisite Story 1.i1f in full, the relevant DESIGN.md/EXPERIENCE.md token blocks and Component Patterns sections in full, and confirmed via direct code read that (a) `EventCardCalendarGridItem` does not yet exist (1.i1f unimplemented) and (b) `location` is already GraphQL-selected but silently dropped by `useWeeklyCalendarController.ts`'s mapping — a real, must-fix gap not present in epics.md's original AC set, added here as AC10/Task 1. Three genuine architecture-mechanism decisions (banner-row layout, overlap stacking, keyboard model) were surfaced via `AskUserQuestion` before drafting, per this project's standing rule that real non-mechanical design tradeoffs get user input rather than being silently decided. A Gate 2 `runSubagent` review (Freya persona) found the story correctly scoped as one story, with one AC addition (`items-center` alignment, AC9). Gate 1/3 were reasoned fresh (not subagent-dispatched) since `epic-1-i1-readiness.md`'s sweep predates this story and does not cover it, following the same precedent Stories 1.i1i/1.i1j established for stories added after the sweep — both found no gap, consistent with the sweep's own original characterization of this epic as pure `packages/ui` presentational work.

### File List

_To be filled by the dev agent during implementation._

## Change Log

- 2026-09-19: Story created via `bmad-create-story`, split from Story 1.i1f via Gate 2 (recorded in Story 1.i1f's own Dev Notes, 2026-09-17). Full Gate 1/2/3 re-evaluation, three `AskUserQuestion` architecture-mechanism decisions, and one newly-discovered data-plumbing gap (`locationName`) recorded above.
