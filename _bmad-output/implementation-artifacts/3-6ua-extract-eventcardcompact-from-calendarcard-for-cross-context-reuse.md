---
baseline_commit: b52ce6dbda4bf7891dd1781037f931ef5204f3e4
---

# Story 3.6ua: Extract EventCardCompact from CalendarCard for cross-context reuse

## Story Details

- Epic: 3
- Story ID: 3.6ua
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `WeeklyCalendarView.tsx`'s mobile calendar row card (`{components.event_card_compact}`, today a non-exported branch of the internal `CalendarCard` subcomponent) extracted into its own standalone, exported `EventCardCompact` component in `packages/ui`,
so that Story 3.6u's event-detail Related Events section can render the same mobile compact card the weekly calendar already uses, without exporting a calendar-internal component with dummy calendar props or duplicating its markup/tokens a second time.

## Acceptance Criteria

1. **AC1 — Extraction with zero behavior change.** `WeeklyCalendarView.tsx`'s `CalendarCard` subcomponent's `variant === 'list'` rendering branch (the full `{components.event_card_compact}` composition: `EVENT_CARD_COMPACT_CLASS`/`MULTI_DAY_EVENT_CLASS` chrome, `EventCardDateBox size="compact"`, the title/location/status-badge/nearby-badge column, `EventCardMediaSlot size="compact" layout="fixed-square"`, and the two mutually-exclusive `EventCardFavoriteBadge` placements) is extracted verbatim into a new, standalone `EventCardCompact` component in `packages/ui/src/features/events/EventCardCompact.tsx`, exported from `packages/ui/src/features/events/index.ts`. `CalendarCard`'s own `variant === 'list'` branch is rewritten to delegate to `EventCardCompact` internally, passing through the same data it already computes today. Zero visual or behavioral change to `WeeklyCalendarView.tsx`'s mobile day-list rendering — regression-guarded by its existing `WeeklyCalendarView.test.tsx` suite, run **unmodified** and green (AC5). The `variant === 'grid'` branch (desktop) is untouched.
2. **AC2 — Flattened, non-generic props contract (no `<TSchedule>`, `Segment`, day-bucket, or popover plumbing).** `EventCardCompact` takes a plain, non-generic `EventCardCompactProps` interface — event fields plus the exact computed badge/date-box/media-slot inputs the card actually renders, never `CalendarCard`'s own calendar-specific plumbing (`Segment<TSchedule>`, `dayIdx`/`cardIdx`/`isRovingActive` roving-tabindex state, the grid-only time-range tooltip, `onKeyDown`/`onFocus` grid forwarding — all confirmed dead code paths for the list-only extraction, see Dev Notes). Specifically (user-confirmed design decision, see Dev Notes § Design Decisions):
   - The date-box content (`dateBoxMonth`, `dateBoxDay`, `dateBoxTillLabel`) is **pre-computed by the caller** and passed in as plain strings — `EventCardCompact` has no "which day of the calendar week-grid is this" concept at all. `CalendarCard` computes these via the existing, unchanged `computeCalendarSegmentDateBoxContent` helper before delegating (AC1). Any non-calendar caller (e.g. Story 3.6u's Related Events section) that has no day-bucket context of its own passes `currentDayStr = today's date` into that same helper when pre-computing these strings, rather than inventing a different reference point (user-confirmed; documented here for 3.6u's own future implementation, not built by this story — see Out of Scope).
   - The status badge (`EventCardStatusBadge`'s text/variant) is computed **internally** by `EventCardCompact` via the existing, unchanged `formatEventStatus` helper from raw `eventStartDate`/`eventStartTime`/`eventEndDate`/`eventEndTime` (+ `statusLabels`) props — this helper is not calendar-bucket-specific (masonry `EventCard.tsx` already calls it the same way), so no caller-side pre-computation is needed or wanted here.
   - Multi-day chrome selection (`MULTI_DAY_EVENT_CLASS` vs. `EVENT_CARD_COMPACT_CLASS`, and the `rounded-md` corner treatment) is driven by a flattened `isMultiDayRun?: boolean` prop (default `false`), not a `Segment`/run-date-comparison the caller must understand.
3. **AC3 — Own loading/skeleton state.** `EventCardCompact` accepts an optional `loading?: boolean` prop; when `true`, it renders a skeleton placeholder matching `{components.event_card_compact}`'s real layout (date-box block, title/location/badge-row block, thumbnail block), with `aria-busy="true"`, and does not attempt to render partial/undefined content underneath — per `project-context.md`'s "Keep Skeletons in Sync With Their Real Component" rule. This is net-new UI: today's `CalendarCard` has no per-card skeleton (the whole `WeeklyCalendarView` skeletons at the top level instead) and never passes `loading`, so this prop's existence has zero effect on `CalendarCard`'s own call site (AC1's zero-behavior-change guarantee holds). It exists for Story 3.6u's Related Events section to reuse while its lazy fetch is in flight (see Out of Scope).
4. **AC4 — Documented & exported for reuse, with an independent test suite.** `EventCardCompact` (and `EventCardCompactProps`) is exported from `packages/ui`'s public entry point with TSDoc prop-level documentation, and has its own dedicated `EventCardCompact.test.tsx` component-test suite (render with full data, loading-skeleton shape/`aria-busy`, missing-image fallback per `event_card_compact_thumbnail_fallback`'s "no reserved space" rule, multi-day chrome, status/nearby/repeat badge presence, favorite-toggle interaction) — independent of `WeeklyCalendarView.test.tsx`, so it is discoverable and reusable across features without depending on the calendar's own test fixtures.
5. **AC5 — Regression proof: existing suite stays green, unmodified.** `WeeklyCalendarView.test.tsx` is **not edited** by this story (user-confirmed test strategy, see Dev Notes § Design Decisions) and continues to pass 100% after the extraction — its existing assertions already pin the list-variant card's exact classNames, `data-testid`s, and DOM structure (title clamp, location-line classes, `data-event-card-date-box` content, plain `tabIndex=0` linear tab stops, favorite-badge placement, multi-day rounding, repeat-badge tooltip, etc.), so any accidental drift introduced by the extraction/delegation would already fail this suite without any new tooling.

## Tasks / Subtasks

- [ ] 1. Create `packages/ui/src/features/events/EventCardCompact.types.ts` defining `EventCardCompactProps` per AC2's flattened shape (see Dev Notes § Props Contract for the exact field list) (AC2).
- [ ] 2. Create `packages/ui/src/features/events/EventCardCompact.tsx`:
  - [ ] 2a. Move the `EVENT_CARD_COMPACT_CLASS`/`MULTI_DAY_EVENT_CLASS` constants out of `WeeklyCalendarView.tsx` into this new file (their only other usage in `WeeklyCalendarView.tsx` is this same list-variant branch — confirmed via grep, no other consumer) (AC1).
  - [ ] 2b. Port the `variant === 'list'` JSX verbatim, rewired to the new flattened props: `useHoverFocusTooltip({ enabled: true })` for the repeat-badge hover/focus tooltip (kept — needed even though the grid-only time-range tooltip itself is dropped), local `imagePresent` state seeded from `!!imageUrl`, the `isMultiDayRun`-driven chrome/rounding selection, the title/location/status-badge/nearby-badge column, `EventCardMediaSlot` + the two mutually-exclusive `EventCardFavoriteBadge` placements (AC1, AC2).
  - [ ] 2c. Compute the status badge internally via `formatEventStatus(locale, timezone, new Date(), eventStartDate, eventStartTime, eventEndDate, eventEndTime, statusLabels)` (AC2).
  - [ ] 2d. Add the `/** @jsxImportSource react */` header pragma + comment, matching every other file in this folder mounted by `packages/visual-audit`'s `react-component` RenderSpec (`EventCard.tsx`/`EventCardCalendarGridItem.tsx`/`EventCardMediaPrimitives.tsx` all carry it) (housekeeping, not a new AC).
  - [ ] 2e. Implement the `loading` skeleton branch, laid out to match the real card's date-box/content/thumbnail zones (AC3).
  - [ ] 2f. Add TSDoc to the component and `EventCardCompactProps` (AC4).
- [ ] 3. Rewrite `WeeklyCalendarView.tsx`'s `CalendarCard`'s `variant === 'list'` branch to delegate to `EventCardCompact`: compute `dateBoxMonth`/`dateBoxDay`/`dateBoxTillLabel` via the existing, unchanged `computeCalendarSegmentDateBoxContent(locale, timezone, currentDayStr || '', segment.runStartDate, segment.runEndDate, tillLabel || 'till')` call (moved to the call site, not removed), compute `isMultiDayRun` via the existing `isMultiDayRunSegment(segment)`, and pass every other prop straight from `schedule`/already-threaded callback props. Remove the now-dead `baseButtonClass`/`multiDayRoundingClass`/`dateBoxContent`/status-badge-for-list local variables that move into `EventCardCompact`. The `variant === 'grid'` branch and everything above the `if (variant === 'list')` check that it still shares (e.g. `weightClass`, `repeatBadge`, `isMultiDay` used by the grid math below) stays untouched if still referenced there — verify before deleting anything shared (AC1).
- [ ] 4. Export `EventCardCompact`/`EventCardCompactProps` from `packages/ui/src/features/events/index.ts` (barrel already re-exports `./WeeklyCalendarView`/`./EventCardMediaPrimitives` the same way — add alongside) (AC4).
- [ ] 5. Write `packages/ui/src/features/events/EventCardCompact.test.tsx` (Vitest + `@testing-library/react`, `@festgrid/testing-config/vitest-react`) covering: full-data render (title, location, status badge, nearby badge at `distanceKm<=threshold`, repeat badge when `applicableDaysOfWeek` present), minimal-data render (only guaranteed fields), loading skeleton (`aria-busy="true"`, no partial content rendered), image-present favorite-badge placement (`scale="default"`, corner pill) vs. image-absent/collapsed favorite-badge placement (`scale="large"`, growing icon style) per `event_card_compact_thumbnail_fallback`'s no-reserved-space rule, multi-day chrome (`isMultiDayRun=true` → `MULTI_DAY_EVENT_CLASS`/rounded corners), favorite-toggle click firing `onFavoriteToggle`, schedule-click firing `onClick` (AC2, AC3, AC4).
- [ ] 6. Run `pnpm --filter @festgrid/ui test` and confirm `WeeklyCalendarView.test.tsx` (unmodified) is 100% green alongside the new `EventCardCompact.test.tsx` suite (AC5).
- [ ] 7. Run `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode build/typecheck for `packages/ui` (Definition of Done).

## Dev Notes

### Design Decisions (resolved with the user via `AskUserQuestion`, 2026-10-03)

This story's Gate 2 (UI Complexity & Reusability) pass — run fresh via the Freya/UX persona against the actual `CalendarCard` `variant === 'list'` source and the authoritative `DESIGN.md`/`EXPERIENCE.md` tokens (see Architecture & UX Gate Findings below) — confirmed the extraction's scope is well-bounded (every piece it touches is already an independently-tested primitive: `useHoverFocusTooltip`, `computeCalendarSegmentDateBoxContent`, `formatEventStatus`, and the `EventCard*` badge/media primitives), but flagged one real props-contract ambiguity plus the user's own explicit test-strategy question:

1. **Date-box prop shape: pre-computed by the caller, not computed internally by `EventCardCompact`.** User-confirmed. `EventCardCompact` never sees `runStartDate`/`runEndDate`/`currentDayStr` — only the already-resolved `dateBoxMonth`/`dateBoxDay`/`dateBoxTillLabel` strings. This matches this project's established `EventCard`/`EventDetailView` precedent (packages/ui components accept already-resolved display values — `imageUrl`, `mapUrl` — rather than computing bucket-specific context themselves, Stories 1.3b/1.6a). `CalendarCard` keeps calling `computeCalendarSegmentDateBoxContent` itself, just at the call site instead of inside the old inline branch. **Forward guidance for Story 3.6u (not built here):** since the Related Events section has no day-bucket/"which day of the week grid" concept at all, when it pre-computes these strings for its own `EventCardCompact` instances it should call the same `computeCalendarSegmentDateBoxContent` helper with `currentDayStr` set to **today's date** (not the event's own start/end date, and not left undefined) — this is the semantically correct stand-in for "the viewer's present moment" that the calendar surface's day-bucket context otherwise supplies implicitly. This guidance is recorded here for whoever implements 3.6u's Task 3/5; it is **out of scope** for this story to build or verify (3.6ua has no non-calendar call site of its own).
2. **Status badge stays computed internally by `EventCardCompact`** (asymmetric with #1, deliberately) — `formatEventStatus` isn't calendar-bucket-specific (masonry `EventCard.tsx` already calls it the same way from inside the component), so there is no decoupling benefit to pushing it to the caller, and doing so would just duplicate the same internal call at every future call site.
3. **Test strategy for AC1/AC5's "zero behavior change": the existing `WeeklyCalendarView.test.tsx` Vitest suite, left unmodified, is sufficient proof** — user-confirmed, no new `packages/visual-audit` pixel-diff spec required for this story. That suite already pins the list-variant card's exact classNames/`data-testid`s/DOM structure (see AC5), so any accidental drift during extraction already fails it. This matches `project-context.md`'s "testing trophy" philosophy — `packages/visual-audit` is reserved selectively (e.g. BUG-050's `weekly-calendar-gridlines.spec.ts`, which proves a *pixel-geometry* invariant no DOM-structure assertion could ever catch), not required by default for a presentational extract-and-delegate refactor whose output DOM is already fully pinned by existing assertions.

### Props Contract (`EventCardCompactProps`, per AC2 and Design Decision #1/#2 above)

```ts
export interface EventCardCompactProps {
  // Core content
  eventName: string;
  isMainSchedule: boolean;          // drives bold vs. normal title weight (unchanged from today's `weightClass`)
  locationName?: string;

  // Date box — pre-computed by the caller (Design Decision #1). No runStartDate/runEndDate/
  // currentDayStr here; CalendarCard resolves these via the existing, unchanged
  // computeCalendarSegmentDateBoxContent before delegating.
  dateBoxMonth: string;
  dateBoxDay: string;
  dateBoxTillLabel: string;

  // Multi-day chrome — flattened boolean, no Segment<TSchedule>.
  isMultiDayRun?: boolean;          // default false

  // Status badge — computed internally via formatEventStatus (Design Decision #2).
  eventStartDate: string;
  eventStartTime?: string | null;
  eventEndDate?: string | null;
  eventEndTime?: string | null;
  statusLabels?: EventStatusLabels; // re-exported from format-event-date.ts, unchanged

  // Media
  imageUrl?: string;
  imageFallbackUrl?: string | null;

  // Favorite
  isFavorited?: boolean;
  favoriteCount?: number;
  onFavoriteToggle?: () => void;    // zero-arg — caller closes over its own event identity
  favoriteToggleLabel?: string;

  // Added-to-calendar
  isAddedToCalendar?: boolean;
  addedToCalendarBadgeLabel?: string;

  // Nearby badge
  distanceKm?: number;
  nearbyBadgeLabel?: (distanceKm: number) => string;
  nearbyBadgeThreshold?: number;

  // Repeat badge
  applicableDaysOfWeek?: DomainDayOfWeek[] | null;
  dayOfWeekLabels?: Record<string, string>;
  repeatBadgeAriaLabel?: (dayLabels: string[]) => string;

  // Locale/timezone — needed for the internal formatEventStatus call (Design Decision #2).
  locale: string;
  timezone: string | undefined;

  // Interaction
  onClick: () => void;              // zero-arg, mirrors onFavoriteToggle's shape

  // Loading state (AC3)
  loading?: boolean;

  className?: string;
}
```

Confirmed dropped (dead for the list-only extraction, verified against the actual source and the real-and-only call site, which always passes `cardIdx={-1}` for list): `dayIdx`, `cardIdx`, `isRovingActive`, `onKeyDown`, `onFocus` (grid-only roving-tabindex plumbing — the forwarding is itself gated `if (variant === 'grid')`), `favoritedBadgeLabel` (only reached by the grid branch's decorative `Heart` icon, a different code path entirely), and the `elementId` computation (always `undefined` for list since `cardIdx` is always `-1` there).

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `epic-readiness/epic-3-readiness.md` is marked `swept: true` (re-swept 2026-09-11, Epic-Level Sweep Mode). Although its `stories_covered` list predates the CC-024 wave (3.6r onward, including this story) chronologically, the applicable rule is the epic-level `swept: true` flag per `story-split-gate.md`'s Epic-Level Sweep Mode section, plus the lightweight guard below for anything the sweep couldn't have anticipated. The more specific `epic-readiness/batch-cc-024-multi-event-readiness.md` (swept 2026-10-01, Gates 1+3, `stories_covered` includes `3.6u`) is also cited as corroborating context, since this story is 3.6u's direct split-off.
- **Lightweight guard (no fresh subagent call needed):** this story's scope — a pure extraction/refactor of already-shipped, already-tested `packages/ui` presentational code, with **no new backend/schema dependency, no new external service, no new data entity, and no cross-cutting tooling gap** (confirmed by epics.md's own "Depends on: None" for this story) — is exactly the kind of scope Gate 1 (architecture/infra bypass) and Gate 3 (foundational/cross-cutting dependency) do not apply to. No gap found; nothing the CC-024 batch sweep's Gate 1/3 pass didn't anticipate, since this story introduces no new layer at all.
- **Gate 2 (run fresh, per-story as required) — subagent adopting the Freya (`wds-agent-freya-ux`) persona, against the actual `CalendarCard` `variant === 'list'` source (pasted directly into the prompt) and the authoritative `DESIGN.md`/`EVENT-CARD-DESIGN.md` `components.event_card_compact`/`event_card_compact_thumbnail_fallback` tokens plus `EXPERIENCE.md`'s "Calendar Row Card: Thumbnail and Fallback" and "Calendar View Cards: Attachment and Composition" sections (both already loaded this session and pasted into the subagent's prompt, not re-read cold).** Findings:
  - **No further split warranted.** Every piece of "complexity" the list branch touches — `useHoverFocusTooltip` (already extracted in Story 1.3k specifically because it had multiple dependents), `computeCalendarSegmentDateBoxContent`/`formatEventStatus` (already standalone pure functions, reused by masonry `EventCard.tsx` too), and every `EventCard*` badge/media primitive — is already an independently-tested, pre-extracted unit. `EventCardCompact` is pure composition/glue over existing primitives, nothing novel to carve out into yet another story.
  - **Props contract:** confirmed the flattened, non-generic shape is correct and confirmed which props are genuinely dead for the list-only extraction (see Props Contract above); flagged the date-box pre-computation asymmetry as the one genuine human call, resolved via `AskUserQuestion` (Design Decisions #1/#2 above).
  - **No outstanding visual-design ambiguity.** `DESIGN.md`/`EXPERIENCE.md`'s `event_card_compact` tokens are already fully resolved and already shipped in the live code (this card's attachment point, its till-vs-start-date date-box content rule, its no-reserved-space image fallback, and its growing-favorite-icon treatment were all settled by prior `bmad-ux` passes, per `EXPERIENCE.md`'s own "already resolved by shipped code, not actually still open" note) — this story extracts shipped behavior, it does not design new behavior.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No changes required. This story touches zero database schema, zero GraphQL contract, and zero `@festgrid/shared-types` interface — it is a pure `packages/ui` presentational extraction consuming the exact same `WeeklyCalendarViewScheduleShape` fields `CalendarCard` already reads today, just passed through `EventCardCompact`'s own flattened prop names instead of nested inside `segment.schedule`.
- **Impacted fields/contracts:** None.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None to `@festgrid/shared-types` or any GraphQL-generated type. The only new type is `EventCardCompactProps` itself, a `packages/ui`-local, decoupled prop interface (same pattern as `EventCardProps`/`EventDetailViewProps` — neither re-exports a backend-facing shape).
- **Backward compatibility and rollout notes:** `CalendarCard`'s existing call site is the only consumer this story wires up; its behavior is explicitly required to be byte-identical (AC1/AC5). `EventCardCompact` has no other live consumer yet — Story 3.6u is the first new caller, and is responsible for its own prop mapping (including the `currentDayStr = today` guidance above) when it lands; this story does not block on 3.6u, and 3.6u is itself blocked on this story (epics.md's existing "Depends on" note on 3.6u).
- **Verification checks:** This story's own `EventCardCompact.test.tsx` (AC4) plus the unmodified, still-green `WeeklyCalendarView.test.tsx` (AC5) are the complete verification surface — no further end-to-end check is possible or needed until 3.6u wires a second real caller.

### Previous Story Intelligence

The immediately preceding story in sequence is **3.6u** (`3-6u-show-all-source-posts-and-related-events-on-the-event-detail-page.md`, status `ready-for-dev`, same `bmad-create-story` session) — 3.6ua is itself 3.6u's own Gate 2 split-off, so 3.6u's story file *is* this story's direct origin context, already fully absorbed into this file's Design Decisions and Architecture & UX Gate Findings above (no separate re-read needed). 3.6u's own Task 3 explicitly instructs its future implementer to "Import Story 3.6ua's exported `EventCardCompact`... — do not reach into `WeeklyCalendarView.tsx`'s internal `CalendarCard` directly, and do not duplicate its markup," and its Pre-Coding Approval Gate requires 3.6ua to reach `review`/`done` before 3.6u's Task 3/5 begin.

### Project Structure Notes

- New files live under `packages/ui/src/features/events/`, alongside every other `EventCard*` primitive, per `project-context.md`'s "Domain Features" convention — mirroring `EventCard.tsx`/`EventCardCalendarGridItem.tsx`'s exact file layout (`.tsx` + `.types.ts` + `.test.tsx`, barrel re-export).
- Only existing files touched: `WeeklyCalendarView.tsx` (the `CalendarCard` `variant === 'list'` branch rewritten to delegate, plus the two moved constants) and `packages/ui/src/features/events/index.ts` (barrel re-export addition). No other file in the repo references `CalendarCard` directly (it was never exported), so no other call site needs updating.
- No new workspace dependency. `EventCardCompact.tsx` imports only from already-available siblings in this folder (`EventCardMediaPrimitives`, `event-card-media-tokens`, `format-event-date`) and `../../hooks` (`useHoverFocusTooltip`), exactly like `CalendarCard` does today.
- No new analytics/PostHog events (AD-5) — this is a zero-behavior-change extraction; whatever favorite-toggle/click analytics already fire from the caller's own `onFavoriteToggle`/`onClick` wiring are unaffected, since those remain caller-owned callbacks, not something `EventCardCompact` fires itself.
- No new i18n/next-intl locale keys (AD-6) — every internally-rendered microcopy default (the new `loading` skeleton's `aria-busy`/accessible-label text) follows the existing `labels`-override-prop pattern (`packages/ui` stays framework-agnostic, no direct `next-intl` dependency), with a plain English default. No live `apps/web` call site sets `loading={true}` yet (that is Story 3.6u's job), so no new `locales/en.json`/`locales/id.json` entries are required by *this* story.
- No new/changed state-management categorization — `EventCardCompact` is a pure presentational component with local `imagePresent` `useState` only (unchanged from today's `CalendarCard`), no Server/URL/Global state of its own.
- No new async/loader categorization beyond AC3's skeleton — matches `project-context.md`'s "Non-Blocking (Initial Load)" rule, consistent with every other `EventCard*` primitive's own skeleton convention.

### References

- [Source: _bmad-output/project-context.md] — Code Organization (Domain Features), UI Patterns & UX Invariants (Keep Skeletons in Sync), i18n rules.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions, Epic-Level Sweep Mode, numbering rule (this story is the `1.3a`/`1.3b`/`1.6a` single-story-UI-split precedent applied to the calendar compact card).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6ua] and neighboring Story 3.6u (direct origin/consumer).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept Gate 1/3 report (Epic-Level Sweep Mode).
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — swept Gate 1/3 report for the CC-024 batch including Story 3.6u.
- [Source: _bmad-output/implementation-artifacts/3-6u-show-all-source-posts-and-related-events-on-the-event-detail-page.md] — origin story, Gate 2 finding, Task 3/5 consumer contract.
- [Source: _bmad-output/implementation-artifacts/1-3b-build-the-reusable-eventcard-component.md], [Source: _bmad-output/implementation-artifacts/1-6a-build-the-reusable-event-detail-view-component.md] — the `1.3a`/`1.3b`/`1.6a` single-story-UI-split precedent this story follows; caller-pre-computes-display-value decoupling precedent (`imageUrl`/`mapUrl`).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md], [Source: design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md] — `components.event_card_compact`/`event_card_compact_thumbnail_fallback` tokens.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — "Calendar Row Card: Thumbnail and Fallback" and "Calendar View Cards: Attachment and Composition" sections.
- [Source: packages/ui/src/features/events/WeeklyCalendarView.tsx] — `CalendarCard`'s current `variant === 'list'` implementation (extraction source), confirmed via direct code inspection this session (lines ~1178-1443 as of this story's creation).
- [Source: packages/ui/src/features/events/WeeklyCalendarView.test.tsx] — the regression suite this story must leave unmodified and green (AC5).
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.tsx], [Source: packages/ui/src/features/events/EventCardMediaPrimitives.types.ts], [Source: packages/ui/src/features/events/event-card-media-tokens.ts], [Source: packages/ui/src/features/events/format-event-date.ts] — reused primitives/helpers, confirmed already exported from `packages/ui`'s barrel.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Domain Features placement), UI Patterns & UX Invariants (Keep Skeletons in Sync With Their Real Component), Testing Rules (testing trophy), i18n rules (labels-prop pattern, no new locale keys this story).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions, Epic-Level Sweep Mode, numbering rule.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — reviewed; no specific AD rule directly invoked (pure `packages/ui` presentational extraction, no data/API/infra boundary crossed).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/features/events/EventCardCompact.tsx` — component implementation (moved `EVENT_CARD_COMPACT_CLASS`/`MULTI_DAY_EVENT_CLASS` constants + the ported `variant === 'list'` JSX + the new `loading` skeleton branch).
  - NEW `packages/ui/src/features/events/EventCardCompact.types.ts` — `EventCardCompactProps`.
  - NEW `packages/ui/src/features/events/EventCardCompact.test.tsx` — dedicated component tests (AC4).
  - UPDATE `packages/ui/src/features/events/WeeklyCalendarView.tsx` — remove the two moved constants; rewrite `CalendarCard`'s `variant === 'list'` branch to compute `dateBoxMonth`/`dateBoxDay`/`dateBoxTillLabel` (via the existing `computeCalendarSegmentDateBoxContent`) and `isMultiDayRun` (via the existing `isMultiDayRunSegment`) at the call site, then delegate to `<EventCardCompact {...} />`; `variant === 'grid'` branch and any still-shared locals (`weightClass`, `repeatBadge`, `isMultiDay`) above the branch split stay as-is unless confirmed dead there too.
  - UPDATE `packages/ui/src/features/events/index.ts` — add `export * from './EventCardCompact'; export * from './EventCardCompact.types';` alongside the existing `WeeklyCalendarView`/`EventCardMediaPrimitives` re-exports.
  - NO CHANGE `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` (AC5 — regression proof via non-modification).
  - NO CHANGE `packages/ui/src/features/events/WeeklyCalendarView.types.ts`, any `@festgrid/shared-types`, any backend/GraphQL file.
- **Rule Mapping:**
  - *UI Components & Scalability (Domain Features)* → `EventCardCompact` placed in `packages/ui/src/features/events/`, same folder as every other `EventCard*` primitive.
  - *Keep Skeletons in Sync With Their Real Component* → AC3's skeleton branch matches the real card's layout zones.
  - *Testing Philosophy (testing trophy)* → integration-style Vitest + Testing Library component tests (new suite, AC4), not exhaustive unit fragmentation; existing suite left as the regression oracle (AC5).
  - *Story Split Gate numbering rule* → single-story architecture/UI split, lettered suffix off Story 3.6u, matching the `1.3a`/`1.3b`/`1.6a` precedent.
  - *Reuse-over-reinvention* → every formatting/badge/media primitive this story needs already exists and is reused as-is (`useHoverFocusTooltip`, `computeCalendarSegmentDateBoxContent`, `formatEventStatus`, the `EventCard*` badge/media family) — nothing reimplemented.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — must show `WeeklyCalendarView.test.tsx` 100% green, unmodified, alongside the new `EventCardCompact.test.tsx` suite passing (AC1, AC4, AC5).
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - `pnpm --filter @festgrid/ui build`.
  - Manual diff review: confirm `git diff` on `WeeklyCalendarView.tsx` touches only the `variant === 'list'` branch, the two moved constants, and the new import — no change to the `variant === 'grid'` branch, `MultiDaySpanningBar`, or any other exported symbol.
  - No E2E test required — no live page wiring changes in this story (3.6u's own future consumer is responsible for its own E2E coverage, if any, when it lands).

## Pre-Coding Approval Gate

- [x] Scope confirmed: extract `CalendarCard`'s `variant === 'list'` rendering into a standalone, exported `EventCardCompact` in `packages/ui`, with `CalendarCard` delegating internally; zero behavior change to the weekly calendar; no backend/schema work.
- [x] Architecture confirmed: pure `packages/ui` presentational extraction, no cross-boundary import changes, no new workspace dependency; flattened non-generic props per Dev Notes § Props Contract.
- [x] Design decisions confirmed (see Dev Notes § Design Decisions): (1) date-box content pre-computed by the caller, with the `currentDayStr = today` guidance recorded for Story 3.6u's own future implementation; (2) status badge computed internally by `EventCardCompact`; (3) no new `packages/visual-audit` spec required — the existing, unmodified `WeeklyCalendarView.test.tsx` suite is the regression proof.
- [x] Testing plan confirmed: new `EventCardCompact.test.tsx` (Vitest + `@testing-library/react`, `@festgrid/testing-config/vitest-react`) plus the existing `WeeklyCalendarView.test.tsx` left unmodified and green — no new E2E, no new visual-audit spec.
- [x] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-3-readiness.md` (Epic-Level Sweep Mode) plus the lightweight guard (no gap — pure extraction, no new backend/infra/cross-cutting dependency); Gate 2 run fresh (no further split warranted; props-contract ambiguity resolved via `AskUserQuestion`, see Design Decisions).
- [x] Explicit human approval state — **approved** (2026-10-03, via `AskUserQuestion` in this `bmad-dev-story` session)

## Testing Requirements

- [ ] New `EventCardCompact.test.tsx` component tests (Vitest + `@testing-library/react`, `@festgrid/testing-config/vitest-react`): full-data render, minimal-data render, loading skeleton (`aria-busy`), image-present vs. image-absent favorite-badge placement, multi-day chrome, favorite-toggle/click interaction callbacks (AC2–AC4).
- [ ] `WeeklyCalendarView.test.tsx` left unmodified and run to confirm 100% pass — this is the regression proof for AC1/AC5, not a new test file.
- [ ] No E2E test required for this story (no live page wiring changes; 3.6u's own future E2E coverage, if any, is out of scope here).
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per `project-context.md`; `packages/ui` follows the "testing trophy" integration-style approach.

## Deliverables Checklist

- [ ] `EventCardCompact` component implemented in `packages/ui/src/features/events/EventCardCompact.tsx`.
- [ ] Strictly-typed `EventCardCompactProps` (`EventCardCompact.types.ts`) per Dev Notes § Props Contract.
- [ ] `CalendarCard`'s `variant === 'list'` branch rewritten to delegate to `EventCardCompact`, zero behavior change.
- [ ] Loading/skeleton state with `aria-busy` (AC3).
- [ ] Exported from `packages/ui`'s public entry point with TSDoc.
- [ ] Dedicated `EventCardCompact.test.tsx` suite written and passing.
- [ ] `WeeklyCalendarView.test.tsx` unmodified, confirmed 100% green.

## Out of Scope

- Story 3.6u's actual consumption of `EventCardCompact` for its Related Events section (prop mapping, the `currentDayStr = today` pre-computation for its own non-calendar context) — built in Story 3.6u itself, which depends on this story reaching `review`/`done` first.
- Any new `packages/visual-audit` pixel-diff spec — user-confirmed not required for this story (Design Decision #3).
- The `variant === 'grid'` (desktop) rendering path — untouched by this story.
- Any change to `WeeklyCalendarViewScheduleShape`, `@festgrid/shared-types`, or any GraphQL contract — none needed (see Data Type Compatibility).
- Any new analytics/PostHog event or i18n locale key — none needed by this story's own scope (see Project Structure Notes).

## Definition of Done

- [ ] All Acceptance Criteria (AC1–AC5) are met.
- [ ] `WeeklyCalendarView.test.tsx` passes unmodified, 100% green.
- [ ] New `EventCardCompact.test.tsx` suite written and passing.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [ ] `EventCardCompact` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

ready-for-dev — Ultimate context engine analysis completed - comprehensive developer guide created. Not yet implemented.

## Dev Agent Record

### Agent Model Used

(to be filled in by `bmad-dev-story`)

### Debug Log References

N/A — not yet implemented.

### Completion Notes List

N/A — not yet implemented.

### File List

N/A — not yet implemented.
