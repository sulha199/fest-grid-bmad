# Story 1.i1d: Adopt the primitive into WeeklyCalendarView's compact row

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1d
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the calendar row card to render a thumbnail through the shared `event_card_*` primitive, with the enlarged standalone favorite icon when the image is missing,
so that the calendar surface stops being the one list view with no image at all (IDEA-016).

**Resolved render path (epic-1-i1-readiness.md, 2026-09-13):** `WeeklyCalendarView.tsx` has exactly one per-schedule card component, `CalendarCard`, parameterized by `variant: 'grid' | 'list'`. `variant='list'` is used in exactly one place — the Mobile Vertical Day List (`data-testid="mobile-calendar-view"`), the grouped per-day compact row. `variant='grid'` (desktop grid cells + the "+N more" popover) is a denser grid cell, not a row/card surface, and is **not** touched by this story. This story attaches the primitive to `CalendarCard`'s `variant='list'` render path only.

**This is "the amendment story"** DESIGN.md's `event_card_compact` token block explicitly defers to: it decides the date box's exact till/end text rule (only the *gating* condition — "never empty" — was pre-decided) and confirms which surface the new thumbnail composition attaches to.

## Acceptance Criteria

1. **Given** a schedule with a known `imageUrl`, **when** `CalendarCard`'s `variant='list'` row renders, **then** a `layout="fixed-square"` `EventCardMediaSlot` (64×64, `w-16 h-16 shrink-0`) renders the image via `object-cover`, sized independently of the image's natural dimensions (AD-15 Rule 1) — with the small corner favorite-pill overlay when `onFavoriteToggle` is wired (AC3).
2. **Given** a schedule with no `imageUrl`, or whose image `onError` fires, **when** the row renders, **then** the reserved 64×64 slot renders blank (no icon, no text, no fill distinct from the row's own background) except the large, centered favorite badge when `onFavoriteToggle` is wired (AD-15 Rule 2) — no reflow when the image transitions from loaded to errored.
3. **Given** `WeeklyCalendarView` is given a new, optional `onFavoriteToggle?: (schedule: TSchedule) => void` prop (mirroring the existing `onScheduleClick: (schedule: TSchedule) => void` shape), **when** a viewer activates the thumbnail's favorite badge (either scale), **then** that callback fires with the exact schedule object for that card — the badge is always a live control (AD-15 Rule 4), never decorative — and each of this component's 4 page-level consumers reuses its own page's **already-existing** favorite-toggle mechanism rather than a new one:
   - `CalendarView.tsx` (rendered by `home-content.tsx`'s "calendar" tab): threads a callback down from `HomeContent`, which already owns a `useToggleFavoriteMutation` instance, `session`, and the login-modal (`isLoginModalOpen`) used today by its card/masonry view.
   - `FeedCalendarView.tsx` (rendered by `feed-content.tsx`): threads a callback down reusing `feed-content.tsx`'s existing `toggleFavorite` instance. That page already requires login before rendering (`isLoading || !session` early return), so no login-modal gate is needed.
   - `AccountCalendarView.tsx` (rendered by `account-content.tsx`): threads a callback down reusing `account-content.tsx`'s existing `toggleFavorite`/`session`/login-modal instance.
   - `MyCalendarContent.tsx`: this page has no sibling card view and therefore no existing mutation instance to reuse — it instantiates its **own** `useToggleFavoriteMutation`, following the exact same call/optimistic-update shape already established by the other 3 pages (not a new mechanism). The page already requires login (redirects to `/login` if no session), so no modal-gate is needed here either.
4. **Given** a day-segment card in the list-variant row, **when** it renders, **then** a new `EventCardDateBox` always renders non-empty till/end content for that specific calendar day's segment — never a repeat of the event's own start date, which the day row's own header already anchors:
   - If this segment is **not** the last day of a multi-day schedule (it continues past this calendar day), the box shows a bare "till" (reusing `EventCardLabels`'s `tillLabel` convention, default `"till"`).
   - If this segment **is** the last (or only) day and a distinct end time is known for it, the box shows `"{tillLabel} {formatted end time}"` (via `formatEventTime`).
   - In every other case (an explicit end date with no known time, or no end information at all), the box falls back to a bare "till".
   - This computation is keyed off the segment's **own calendar day** (`currentDayStr`, already computed per-segment for the existing multi-day badge), never off "now" — unlike `EventCard`'s own TILL badge, this box is never gated on whether the event has started (AC14's "no badge until started" rule does **not** carry over here).
5. **Given** the list-variant row now shows till/end info via the new date box, **when** it renders, **then** the pre-existing, always-visible `time-range-inline` text (the full start–end date+time via `formatTooltipTimeRange`) is removed — it is redundant with the new date box's timing content (user-confirmed 2026-09-13).
6. **Given** the list-variant row's other existing elements, **when** this story ships, **then** the inline favorited `heart-icon` + `favorite-count-line` (next to the title), the `calendar-plus-icon` (`isAddedToCalendar`), and the `multi-day-badge` ("Day X of N") all continue to render exactly as they do today, unchanged and independent of the new thumbnail/date-box zones. This is an intentional, user-confirmed acceptance of the inline heart/count duplicating the new thumbnail badge's own heart/count for now — **not** a defect to be "fixed" as a byproduct of this story.
7. **Given** the row now contains two interactive elements (the schedule-click target and the thumbnail's favorite-toggle button), **when** the DOM is inspected, **then** they are siblings — never one nested inside the other (nested `<button>` elements are invalid HTML/a11y) — mirroring `EventCard.tsx`'s own already-shipped `article > (favorite-button sibling) + RootTag` pattern. The row's existing keyboard/list behavior for the schedule-click target (plain linear `tabIndex={0}` tab stop, `onScheduleClick` firing correctly, existing `onKeyDown`/focus wiring) continues to work exactly as before.
8. **Given** `variant="grid"` (the desktop day cells and the "+N more" popover, including its focus trap and roving-tabindex arrow-key navigation), **when** this story ships, **then** its DOM/behavior is completely unchanged, proven by its existing test suite passing unmodified (this story touches the `variant === 'list'` render branch only).
9. **Given** the new user-facing till/end text and the new favorite-toggle control's accessible name, **when** a caller does not override them, **then** they fall back to English defaults (`tillLabel` default `"till"` reusing `EventCardLabels`'s existing convention; `favoriteToggleLabel` default `"Toggle favorite"` reusing `EventCardFavoriteBadgeLabels.favoriteToggle`'s default) via new optional entries on `WeeklyCalendarViewLabels` — matching this component's pre-existing, not-yet-locale-wired pattern for `favoritedBadgeLabel`/`addedToCalendarBadgeLabel` (only `MyCalendarContent.tsx` currently overrides those two; the other 3 pages already rely on hardcoded English defaults today — a pre-existing gap this story does not newly introduce or expand).

## Tasks / Subtasks

- [ ] Task 1 — Thread new data fields through the shared schedule shape (AC1, AC2, AC3)
  - [ ] 1.1 In `packages/ui/src/features/events/WeeklyCalendarView.types.ts`, add `eventId?: string` and `imageUrl?: string` to `WeeklyCalendarViewScheduleShape` (both optional — additive, does not break the ~30 existing test mocks in `WeeklyCalendarView.test.tsx` that omit them).
  - [ ] 1.2 Add `onFavoriteToggle?: (schedule: TSchedule) => void` to `WeeklyCalendarViewProps` (mirroring `onScheduleClick`'s exact shape).
  - [ ] 1.3 Add `tillLabel?: string` and `favoriteToggleLabel?: string` to `WeeklyCalendarViewLabels` (AC9), with in-code defaults `"till"` / `"Toggle favorite"` in `WeeklyCalendarView.tsx`'s `defaultLabels` merge, matching the existing `favoritedBadgeLabel`/`addedToCalendarBadgeLabel` pattern already there.
  - [ ] 1.4 In `packages/ui/src/hooks/useWeeklyCalendarController.ts`'s schedule-mapping `flatMap`, add `eventId: event.id` and `imageUrl: event.imageUrl` to the mapped object — both fields are **already fetched** by `getEventsForCalendar`/`getEventsForMyCalendar` (`apps/web/src/features/events/queries.graphql`), so this is a pure additive mapping change with no GraphQL schema/resolver/query change.
- [ ] Task 2 — Add the pure till/end text function (AC4)
  - [ ] 2.1 In `packages/ui/src/features/events/format-event-date.ts`, add `computeCalendarSegmentTillText(locale, timezone, currentDayStr, startDate, endDate, endTime, tillLabel)`: if `currentDayStr < (endDate ?? startDate)` return the bare `tillLabel` (segment continues past this day); else (this is the segment's last/only day) if `endTime` is known, `combineDateTime(endDate ?? startDate, endTime)` + `formatEventTime(locale, timezone, ...)` and return `` `${tillLabel} ${formattedTime}` ``; else return the bare `tillLabel`. Colocate with `formatEventStatus`/`combineDateTime` (same file, same reuse rationale already documented there).
  - [ ] 2.2 Add unit tests for the new function in `format-event-date.test.ts` (same file/convention as `formatEventStatus`'s existing tests): continuing-segment case, last-day-with-known-endTime case, last-day-with-endDate-but-no-time case, and no-end-info-at-all case — asserting the bare-`tillLabel` fallback in the last two.
- [ ] Task 3 — Restructure `CalendarCard`'s `variant='list'` DOM (AC1, AC2, AC4, AC5, AC7)
  - [ ] 3.1 **Do not** touch the `variant === 'grid'` return path at all (AC8) — branch the list-variant JSX into its own return block if not already cleanly separable.
  - [ ] 3.2 Restructure the list-variant row from today's single `<button className={...}>` into: an outer non-interactive `<div>` carrying the row's chrome (`event_card_compact.base`: `flex items-stretch gap-2 rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200` — reuse the existing `baseButtonClass`/`multiDayRoundingClass` computation, just moved from the button onto this div), containing two flex children:
    a. An inner `<button type="button" className="flex-1 min-w-0 flex items-stretch gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:z-10 rounded-md">` — carries everything the old single button carried (`id`, `tabIndex={0}`, `onClick={() => onScheduleClick(schedule)}`, existing `onKeyDown`/`onFocus`/`onBlur` handlers), and inside it: the new `EventCardDateBox` (AC4) as its first child, then the existing content column (title row with `heart-icon`/`calendar-plus-icon`/event name, `favorite-count-line`, `multi-day-badge` — AC6, unchanged) as its second child.
    b. `EventCardMediaSlot` (`layout="fixed-square"`, `imageUrl={schedule.imageUrl}`, `imageAlt={schedule.eventName}`, `isFavorited={schedule.isFavorited}`, `favoriteCount={schedule.favoriteCount}`, `onFavoriteToggle={onFavoriteToggle ? (e) => onFavoriteToggle(schedule) : undefined}`, `labels={{ favoriteToggle: favoriteToggleLabel }}`) as a **sibling** of the inner button, not nested inside it (AC7).
  - [ ] 3.3 Remove the `time-range-inline` `<span>` from the list-variant branch (AC5). Leave `favorite-count-line`/`multi-day-badge`/the inline `heart-icon`/`calendar-plus-icon` exactly as they render today (AC6).
  - [ ] 3.4 Compute the date box's content via `computeCalendarSegmentTillText(activeLocale, activeTimezone, currentDayStr, schedule.eventStartDate, schedule.eventEndDate, schedule.eventEndTime, defaultLabels.tillLabel)` and render it inside `<EventCardDateBox>{tillText}</EventCardDateBox>` (AC4). `currentDayStr` is already available in `CalendarCard`'s props for the multi-day badge computation — reuse it, do not recompute.
- [ ] Task 4 — Wire real favorite-toggle capability into the 4 consumer pages (AC3)
  - [ ] 4.1 `apps/web/src/features/events/CalendarView.tsx`: accept a new `onFavoriteToggle?: (eventId: string) => void` prop; pass `onFavoriteToggle={onFavoriteToggle ? (schedule) => schedule.eventId && onFavoriteToggle(schedule.eventId) : undefined}` to `WeeklyCalendarView`.
  - [ ] 4.2 `apps/web/src/app/[locale]/home-content.tsx`: pass `onFavoriteToggle={(eventId) => { if (!session) { setIsLoginModalOpen(true); return; } toggleFavorite({ eventId }); }}` into `<CalendarView>` — reusing the exact `toggleFavorite`/`session`/`setIsLoginModalOpen` instance already declared in this component for its card view (no new mutation instantiation).
  - [ ] 4.3 `apps/web/src/app/[locale]/feed/FeedCalendarView.tsx`: same prop-threading pattern as 4.1.
  - [ ] 4.4 `apps/web/src/app/[locale]/feed/feed-content.tsx`: pass `onFavoriteToggle={(eventId) => toggleFavorite({ eventId })}` into `<FeedCalendarView>` — reusing its existing `toggleFavorite` instance (no login-modal gate needed — page already requires login).
  - [ ] 4.5 `apps/web/src/app/[locale]/[platformSlug]/[accountId]/AccountCalendarView.tsx`: same prop-threading pattern as 4.1.
  - [ ] 4.6 `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx`: pass `onFavoriteToggle` reusing its existing `toggleFavorite`/`session`/login-modal instance (same shape as 4.2), into `<AccountCalendarView>`.
  - [ ] 4.7 `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx`: this page has no existing mutation instance — add a **new** `useToggleFavoriteMutation(graphqlClient, {...})` instance, mirroring the exact optimistic-update shape used in `home-content.tsx`/`account-content.tsx` (cancel the page's own query key, `setQueriesData` flipping `isFavorited`/`favoriteCount` on the matching schedule's parent event, `onError` rollback, `onSuccess` posthog capture matching the `event_favorited`/`event_unfavorited` convention). Pass `onFavoriteToggle={(eventId) => toggleFavorite({ eventId })}` into `<WeeklyCalendarView>` directly (this page doesn't go through a separate `XCalendarView` wrapper) — no login-modal gate needed (page already redirects unauthenticated users).
- [ ] Task 5 — Testing (all ACs)
  - [ ] 5.1 In `WeeklyCalendarView.test.tsx`: rewrite the existing `'renders always-visible time range inline text and favorite count inside list-variant'` test to assert `time-range-inline` is **absent** (AC5) and that the new date box renders the expected till text (AC4) instead; keep its `favorite-count-line` assertion (AC6).
  - [ ] 5.2 Update the existing `'uses plain linear Tab stops with tabIndex=0 and no roving attributes in list-variant'` test to also filter out the new favorite-toggle button (by its accessible name/`aria-label`, alongside the existing `mobile-day-toggle` filter) before asserting every remaining button has `tabIndex="0"` — the new favorite-toggle button is a real interactive element but is not part of the roving/plain-tab-stop set this test is about (AC7).
  - [ ] 5.3 Add new tests (list-variant, `onFavoriteToggle` supplied): thumbnail renders with `imageUrl` present (AC1); reserved-blank fallback + large favorite badge with `imageUrl` absent and on `onError` (AC2); clicking the favorite badge calls `onFavoriteToggle` with the correct schedule and does **not** also trigger `onScheduleClick` (AC3, AC7 — proves the sibling-not-nested structure actually works); no favorite badge renders at all when `onFavoriteToggle` is omitted (matches `EventCardFavoriteBadge`'s existing contract).
  - [ ] 5.4 Add till/end date-box test cases (AC4): multi-day segment not on its last day → bare "till"; last day with known `eventEndTime` → `"till {time}"`; last day with `eventEndDate` set but no `eventEndTime` → bare "till"; no end info at all → bare "till". Also assert the date box never repeats the event's own start date text.
  - [ ] 5.5 Assert `variant="grid"`'s full existing test suite (desktop cells, popover, focus trap, roving tabindex) still passes unmodified — no new assertions needed, just confirm zero regressions (AC8).
  - [ ] 5.6 Update `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` to assert the mapped schedule objects include `eventId`/`imageUrl` sourced from the raw event.
  - [ ] 5.7 Update `apps/web/src/features/events/CalendarView.test.tsx` for the new `onFavoriteToggle` prop threading.
  - [ ] 5.8 Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`/`tsc --noEmit`, and the `apps/web` equivalents (`pnpm --filter web test`, `tsc --noEmit`) for the modified consumer pages; record results in Dev Agent Record.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13): no DB/ORM/domain call from `apps/web`/a UI package, no external-service call from the frontend, no new API surface, no auth/secrets/business rules added to frontend code. **Lightweight guard, applied fresh for this story specifically:** the favorite-toggle wiring (Task 4) and the `eventId`/`imageUrl` field additions (Task 1.4) touch more surface area than the sweep's own Gate 1 rationale anticipated ("no data fetching" — the sweep assumed the primitive's adopters "only render props already passed into them"). On inspection, this does **not** constitute a Gate 1 gap: `useToggleFavoriteMutation` is an already-existing GraphQL mutation (used today by `home-content.tsx`/`favorites-content.tsx`/`account-content.tsx`), and `imageUrl`/`id` are already-fetched fields on `getEventsForCalendar`/`getEventsForMyCalendar` (`apps/web/src/features/events/queries.graphql`) — no new resolver, mutation, query field, or schema change is introduced. This is wiring an existing capability into one more call site, not building new infrastructure.
- **Gate 2 (UI Complexity & Reusability) — run fresh per story-split-gate.md's per-story requirement. Verdict: NO SPLIT.** Dispatched to a Freya-persona subagent against this story's full draft scope (thumbnail/fallback adoption, the 4-consumer favorite-toggle wiring, and the button-nesting DOM fix). Reasoning: Gate 2's trigger is a reusable/complex UI piece being built *without its own dedicated pass* — that already happened for the primitive itself (Story 1.i1a, refined by 1.i1b/1.i1c). This story is pure **adoption** of an already-vetted primitive plus an already-vetted mutation pattern into one more call site — exactly the "mechanism story, then adoption stories" shape the split-gate wants, not the Story 1.3 failure mode (a novel reusable piece bundled unexamined into a feature story). The favorite-toggle wiring is cross-cutting in file count (4 consumer pages) but introduces zero novel mechanism — 3 of 4 pages reuse an already-existing mutation instance verbatim; the 4th replicates an established pattern. The subagent's gaps (explicit per-consumer ACs so none of the 4 pages is silently dropped; assertion-based, not "should still work," coverage for the DOM-restructure's keyboard/a11y behavior; an explicit non-goal note on the accepted heart/count duplication) are folded into AC3/AC6/AC7/AC8 and Tasks 4-5 above rather than left implicit.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Sourced from the same swept `epic-1-i1-readiness.md`: no i18n/analytics/global-shell/codegen dependency is implicated by the primitive itself. **Fresh check for this story's own added scope:** the favorite-toggle capability is not a new foundational dependency other future epics would need built centrally — it is the same per-page `useToggleFavoriteMutation` + `getCardProps`-style closure pattern already used independently by 4 other pages (`home-content.tsx`, `favorites-content.tsx`, `feed-content.tsx`, `account-content.tsx`) prior to this story; extending it to a 5th/6th/7th/8th page (the 4 calendar consumers) is the established convention repeating, not a new shared mechanism to centralize. No `packages/domain`/shared-hook extraction is warranted by this story alone (see Project Structure Notes).

### User-Resolved Design Decisions (AskUserQuestion, 2026-09-13)

1. **Favorite-badge interactivity gap.** `WeeklyCalendarView` had no favorite-toggle capability at all before this story (read-only `isFavorited`/`favoriteCount` display only), yet the primitive's `EventCardFavoriteBadge` only renders when given `onFavoriteToggle` (AD-15 Rule 4: always a live control). **User's explicit resolution:** do not invent a new/separate toggle mechanism for the calendar surface — extract/reuse the exact mechanism `EventCard`'s consumer pages already use (a page-level `useToggleFavoriteMutation` instance + a per-item closure passed down as a prop), rather than building something calendar-specific. Investigation (this story) confirmed 3 of the 4 calendar consumer pages already have a sibling card view with exactly that mechanism instantiated in the same parent component — so those 3 simply thread a callback down; only `MyCalendarContent.tsx` needs a new instantiation, and it follows the identical established shape. See AC3/Task 4.
2. **Till/end text rule for the date box.** DESIGN.md explicitly deferred the exact text rule to this ("the amendment") story, deciding only that the box must never render empty (unlike `EventCard`'s own TILL badge, which may be absent pre-start). **User confirmed the reuse-based rule:** "till {end time}" when the segment's own day has a known end time on its last/only day; otherwise always a bare "till" (covers a continuing multi-day segment, an explicit end date with no time, or no end info at all) — extending `EventCard`'s existing `tillBadgeText` convention (`formatEventTime`/`combineDateTime`) but keyed off the segment's own calendar day instead of "now," and never gated on has-it-started. See AC4/Task 2.
3. **Existing `time-range-inline` text vs. the new date box.** Both would otherwise convey overlapping timing information on every card. **User confirmed:** remove `time-range-inline` now that the date box conveys till/end timing; explicitly keep `multi-day-badge` and `favorite-count-line` unchanged (neither duplicates the date box's content) — see AC5/AC6/Task 3.3. This does **not** extend to removing/replacing the inline `heart-icon`/`favorite-count-line` just because the new thumbnail badge also shows favorite state — the user's approved option text explicitly preserved those, so the resulting duplication between the inline heart/count and the new thumbnail badge is accepted as-is (AC6), not silently "cleaned up" as an unrequested scope extension.

### Nested-Button DOM Fix (implementation guardrail — read before implementing Task 3)

Today, `CalendarCard`'s entire `variant='list'` row is **one** `<button>` (whole-row click navigates to the event). `EventCardFavoriteBadge` renders its own `<button>` internally. Nesting a button inside a button is invalid HTML and breaks focus/click semantics (the outer button's click handler fires even when the inner button is clicked, and screen readers cannot correctly parse nested interactive roles). `EventCard.tsx` already solves this exact problem: its root is a non-interactive `<article>`, the favorite-toggle button is a direct child (sibling) of the article, and the "whole card is clickable" behavior lives on a *different* inner element (`RootTag`, an `<a>`/`<button>`/`<div>` depending on `href`/`onClick`) — never wrapping the favorite button. Task 3 above mirrors this exact pattern for `CalendarCard`'s list variant: outer `<div>` (chrome only, non-interactive) → inner `<button>` (schedule-click target, wraps date box + content column only) + `EventCardMediaSlot` (sibling, carries its own internal favorite-toggle button). Do **not** place `EventCardMediaSlot` inside the schedule-click `<button>`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No DB/GraphQL mismatch. Two narrowing-additive changes to existing frontend-only TypeScript interfaces: `WeeklyCalendarViewScheduleShape` gains optional `eventId?: string`/`imageUrl?: string`; `WeeklyCalendarViewProps` gains optional `onFavoriteToggle?: (schedule: TSchedule) => void`; `WeeklyCalendarViewLabels` gains optional `tillLabel?`/`favoriteToggleLabel?`.
- Impacted fields/contracts: `packages/ui/src/features/events/WeeklyCalendarView.types.ts` (presentational only); `packages/ui/src/hooks/useWeeklyCalendarController.ts`'s schedule-mapping function (adds two field mappings, both sourced from already-queried GraphQL fields — `event.id`, `event.imageUrl` — no new query/resolver/schema field). No DB columns, no GraphQL schema/resolver changes.
- Required DB migration changes: No changes required — no persistence layer touched.
- Required TypeScript type changes: As listed above — all additive/optional, so every one of the ~30 existing schedule mocks in `WeeklyCalendarView.test.tsx` that omit `eventId`/`imageUrl` continues to compile and behave as before (thumbnail renders its reserved-blank fallback state; no favorite badge renders at all when `onFavoriteToggle` is omitted, matching `EventCardFavoriteBadge`'s existing "no callback, no render" contract from Story 1.i1a).
- Backward compatibility and rollout notes: All 4 consumer-page prop additions are optional (`onFavoriteToggle?`) — a consumer that doesn't pass it (there are none after Task 4, but the type itself doesn't require it) degrades to today's read-only display, no favorite badge rendered in the thumbnail. No breaking change to any existing caller.
- Verification checks: `tsc --noEmit` across `packages/ui` and `apps/web` confirms no remaining type errors; Task 5's test suite confirms the mapped fields flow end-to-end from the controller hook through to the rendered primitive.

### Project Structure Notes

- Alignment with unified project structure: All `packages/ui` changes stay within `packages/ui/src/features/events/` and `packages/ui/src/hooks/` (existing files, no new files in this package). `apps/web` changes are confined to the 4 existing calendar-consumer page/component files plus their 2 shared parent page components (`home-content.tsx`, `feed-content.tsx`, `account-content.tsx`) and one calendar-only page (`my-calendar-content.tsx`) — all pre-existing files, no new routes/pages.
- No `packages/domain` involvement: the favorite-toggle wiring is presentational prop-threading + an existing GraphQL mutation call, not business logic; the new `computeCalendarSegmentTillText` function is pure date/string formatting, consistent with `format-event-date.ts`'s existing non-`packages/domain` placement (that file already holds comparable pure logic for `EventCard`, e.g. `formatEventStatus`).
- No shared-hook extraction across the 4 consumer pages' `useToggleFavoriteMutation` instances: each page's optimistic-cache-update shape already differs today (different query keys, different cache-shape assumptions — e.g. `home-content.tsx`'s infinite-query pages vs. `CalendarView.tsx`'s flat `events` query result) — forcing a shared hook now would be premature generalization Gate 2 explicitly did not ask for; the *pattern* is reused (per the user's resolution), not literally the same hook instance across unrelated queries.
- Detected conflicts or variances: None.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1d] (and sibling Stories 1.i1a-1.i1c, 1.i1e, 1.i1z for shared epic context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1 + Gate 3 sweep, swept: true; render-path resolution)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#event_card_compact, #event_card_compact_thumbnail_fallback, #event_card_favorite_count_badge_large] (row composition, till/end content rule's deferred decision, thumbnail/fallback tokens)
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Calendar Row Card: Thumbnail and Fallback] ("reserved space, not reflow"; till/end content rationale)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-15] (Rules 1/2/4 this story satisfies on the calendar surface; Rule 3 icon-scale token, already primitive-internal, unaffected)
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.tsx, .types.ts] (`EventCardMediaSlot`/`EventCardFavoriteBadge`/`EventCardDateBox` — the primitive this story adopts, shipped dark by Story 1.i1a)
- [Source: packages/ui/src/features/events/WeeklyCalendarView.tsx] (current `CalendarCard`, lines ~719-904 — the exact component this story restructures for `variant='list'` only; `variant='grid'` paths at lines ~560-663 untouched)
- [Source: packages/ui/src/features/events/EventCard.tsx] (lines ~176-199 — the sibling-not-nested favorite-button pattern this story mirrors; lines ~122-145 — the existing `tillBadgeText` convention `computeCalendarSegmentTillText` extends)
- [Source: packages/ui/src/features/events/format-event-date.ts] (`combineDateTime`/`formatEventTime`/`formatEventStatus` — reused/extended, not reimplemented)
- [Source: packages/ui/src/hooks/useWeeklyCalendarController.ts] (schedule-mapping `flatMap`, lines ~53-70 — where `eventId`/`imageUrl` are added)
- [Source: apps/web/src/features/events/queries.graphql] (`getEventsForCalendar`/`getEventsForMyCalendar` — confirms `imageUrl`/`id` are already fetched at the event level; no schema change needed)
- [Source: apps/web/src/app/[locale]/home-content.tsx] (lines ~62-101, ~254-260 — existing `toggleFavorite`/session/login-modal instance reused by `CalendarView.tsx`)
- [Source: apps/web/src/app/[locale]/feed/feed-content.tsx] (lines ~158-193, ~295 — existing `toggleFavorite` instance reused by `FeedCalendarView.tsx`)
- [Source: apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx] (lines ~153-195, ~279-282 — existing `toggleFavorite`/session/login-modal instance reused by `AccountCalendarView.tsx`)
- [Source: apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx] (no existing mutation instance — this story adds one, Task 4.7)

## Global Rules References

- [ ] `_bmad-output/project-context.md` — UI Components & Scalability rule (Domain Features → `packages/ui/src/features/<domain>/`, unchanged placement); State Management rule (Server State via React Query — `useToggleFavoriteMutation` wiring, Task 4, is Server State, not new Client Global State); Locale-Sensitive Data Rendering rule (till/end times formatted via `Intl`/`formatEventTime`, never raw-interpolated).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 (this story satisfies Rules 1/2/4 on a new surface; no new AD needed, per AD-15's own "Binds" clause already naming 1.i1d as a consumer).
- [ ] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning (the favorite-toggle mutation and calendar queries already exist).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modify: `packages/ui/src/features/events/WeeklyCalendarView.tsx` (Task 3 — `variant='list'` DOM restructure, date-box wiring, favorite-toggle prop plumbing; `variant='grid'` untouched)
  - Modify: `packages/ui/src/features/events/WeeklyCalendarView.types.ts` (Task 1.1-1.3 — new optional fields/prop/labels)
  - Modify: `packages/ui/src/features/events/format-event-date.ts` (Task 2.1 — new `computeCalendarSegmentTillText`)
  - Modify: `packages/ui/src/features/events/format-event-date.test.ts` (Task 2.2)
  - Modify: `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` (Task 5.1-5.5)
  - Modify: `packages/ui/src/hooks/useWeeklyCalendarController.ts` (Task 1.4)
  - Modify: `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` (Task 5.6)
  - Modify: `apps/web/src/features/events/CalendarView.tsx` (Task 4.1)
  - Modify: `apps/web/src/features/events/CalendarView.test.tsx` (Task 5.7)
  - Modify: `apps/web/src/app/[locale]/home-content.tsx` (Task 4.2)
  - Modify: `apps/web/src/app/[locale]/feed/FeedCalendarView.tsx` (Task 4.3)
  - Modify: `apps/web/src/app/[locale]/feed/feed-content.tsx` (Task 4.4)
  - Modify: `apps/web/src/app/[locale]/[platformSlug]/[accountId]/AccountCalendarView.tsx` (Task 4.5)
  - Modify: `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` (Task 4.6)
  - Modify: `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx` (Task 4.7)
  - **Not touched:** `EventCardMediaPrimitives.tsx`/`.types.ts`, `event-card-media-tokens.ts`, `EventCard.tsx`, the architecture spine (AD-15 already names this story as a consumer), any GraphQL schema/resolver/query file (only reads already-fetched fields), `WeeklyCalendarView.tsx`'s `variant='grid'` branch.
- **Rule Mapping:**
  - AD-15 Rules 1/2/4 (chrome-driven sizing, reserved-blank fallback, always-live badge) → AC1/AC2/AC3, Task 3.
  - State Management Architecture (Server State via React Query) → `useToggleFavoriteMutation` reuse/instantiation, AC3, Task 4.
  - Locale-Sensitive Data Rendering (`Intl`-based time formatting, never raw) → AC4, Task 2 (`formatEventTime` reuse).
  - i18n-readiness `labels`/default convention → AC9, Task 1.3.
  - Testing Philosophy (project-context.md — testing-trophy, integration/component tests) → Task 5.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — new/rewritten `WeeklyCalendarView.test.tsx` and `format-event-date.test.ts` cases pass; existing `EventCardMediaPrimitives.test.tsx`/`EventCard.test.tsx`/`useWeeklyCalendarController.test.tsx` suites and `variant='grid'`'s existing tests remain green (AC8).
  - `pnpm --filter @festgrid/ui lint` / `tsc --noEmit` — 0 errors.
  - `pnpm --filter web test` (or the equivalent for `apps/web`) — updated `CalendarView.test.tsx` passes.
  - `tsc --noEmit` across `apps/web` — confirms the 4 consumer-page prop-threading changes type-check end-to-end.
  - Manual/visual spot-check (no automated visual regression exists in this repo): render the Mobile Vertical Day List with a mix of single-day/multi-day, favorited/unfavorited, image-present/image-missing schedules; confirm the thumbnail, date box, and existing inline elements all render as specified, and that clicking the favorite badge does not also navigate to the event detail page.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — adopts the primitive into `CalendarCard`'s `variant='list'` path only; wires real favorite-toggle capability into the 4 calendar consumer pages by reusing each page's existing mechanism (per user resolution 2026-09-13); `variant='grid'` untouched.
- [ ] Architecture and boundary confirmation — stays within `packages/ui/src/features/events/`, `packages/ui/src/hooks/`, and the existing `apps/web` calendar-consumer files; no `packages/domain` involvement; no GraphQL schema/resolver changes; nested-button DOM fix mirrors `EventCard.tsx`'s already-shipped pattern.
- [ ] Testing plan confirmation — Task 5's rewritten/new tests across `WeeklyCalendarView.test.tsx`, `format-event-date.test.ts`, `useWeeklyCalendarController.test.tsx`, `CalendarView.test.tsx`, plus lint/build per Task 5.8.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 & Gate 3: no gap, including the fresh per-story guard applied above (epic-1-i1-readiness.md, swept, plus this story's own reasoning for its added favorite-toggle scope). Gate 2: no split (Freya-persona subagent verdict, 2026-09-13) — gaps folded into AC3/AC6/AC7/AC8. All three genuine design tradeoffs (favorite-badge mechanism, till/end text rule, time-range-inline duplication) user-resolved via AskUserQuestion (2026-09-13) — see Dev Notes.

## Testing Requirements

- [ ] Integration/component tests (Vitest + Testing Library) — `WeeklyCalendarView.test.tsx` (Task 5.1-5.5), `format-event-date.test.ts` (Task 2.2), `useWeeklyCalendarController.test.tsx` (Task 5.6), `CalendarView.test.tsx` (Task 5.7).
- [ ] E2E tests — Not introduced by this story. The calendar route already has whatever E2E coverage predates this story (if any); this story's changes are additive within an already-exercised page. Full cross-page favorite-toggle E2E coverage across all 4 consumer pages is disproportionate to this story's scope — component-level tests on `WeeklyCalendarView` (the shared behavior) plus `CalendarView.test.tsx` (one representative consumer) are the testing-trophy-appropriate level; `FeedCalendarView`/`AccountCalendarView`/`MyCalendarContent` had no pre-existing dedicated test files and this story does not newly establish that infrastructure, matching the project's testing-trophy philosophy (prioritize integration tests, reserve E2E for critical flows already covered elsewhere).

## Deliverables Checklist

- [ ] `WeeklyCalendarView.types.ts` — `eventId?`/`imageUrl?` on the schedule shape; `onFavoriteToggle?` prop; `tillLabel?`/`favoriteToggleLabel?` labels
- [ ] `WeeklyCalendarView.tsx` — `variant='list'` restructured (date box, thumbnail, sibling-not-nested favorite button); `time-range-inline` removed; `variant='grid'` unchanged
- [ ] `format-event-date.ts` — `computeCalendarSegmentTillText` + unit tests
- [ ] `useWeeklyCalendarController.ts` — `eventId`/`imageUrl` mapped from already-fetched fields
- [ ] `CalendarView.tsx`, `FeedCalendarView.tsx`, `AccountCalendarView.tsx` — `onFavoriteToggle` prop threaded through
- [ ] `home-content.tsx`, `feed-content.tsx`, `account-content.tsx` — reuse existing mutation instance, pass down to calendar sub-component
- [ ] `my-calendar-content.tsx` — new `useToggleFavoriteMutation` instance (following the established pattern), wired directly
- [ ] Updated tests: `WeeklyCalendarView.test.tsx`, `format-event-date.test.ts`, `useWeeklyCalendarController.test.tsx`, `CalendarView.test.tsx`

## Out of Scope

- `variant='grid'` (desktop day cells, "+N more" popover) — no changes; a wholly separate, denser grid-cell surface not addressed by this story (per epic-1-i1-readiness.md's resolution).
- Adding `event_card_status_badge`/`event_card_nearby_badge` to the calendar row — DESIGN.md's `event_card_compact.content` composition mentions reusing these, but epics.md's own AC set for 1.i1d does not require them and `WeeklyCalendarViewScheduleShape` has no status/distance data plumbed in today; introducing them would require new fields/computations beyond this story's thumbnail+date-box scope. Tracked as a possible future story, not a Gate finding (no epics.md dependency references it as required elsewhere).
- Removing or reconciling the inline `heart-icon`/`favorite-count-line`'s duplication with the new thumbnail favorite badge — user-confirmed to keep both as-is (AC6).
- Story 1.i1e (masonry default state / `prominentPoster=false`) and Story 1.i1z (the repo-wide CI ratchet) — separate stories, unaffected by this one.
- A shared cross-page `useToggleFavoriteMutation` hook/abstraction — each of the 4 consumer pages' optimistic-cache shapes already differ (different query keys/result shapes); Gate 2 did not call for this generalization, and forcing it now would be premature (see Project Structure Notes).
- New locale-file translation keys for `tillLabel`/`favoriteToggleLabel`/`favoritedBadgeLabel`/`addedToCalendarBadgeLabel` on the 3 pages that don't already override them — a pre-existing gap across this component predating this story (only `MyCalendarContent.tsx` currently wires translated overrides); not newly introduced or expanded by this story (AC9).

## Definition of Done

- [ ] AC1-AC9 satisfied.
- [ ] `WeeklyCalendarView.test.tsx`, `format-event-date.test.ts`, `useWeeklyCalendarController.test.tsx`, `CalendarView.test.tsx` passing (rewritten + new cases); `EventCardMediaPrimitives.test.tsx`/`EventCard.test.tsx` and `variant='grid'`'s existing test cases still passing unmodified.
- [ ] Lint and type checks passing for `packages/ui` and the touched `apps/web` files.
- [ ] No nested `<button>` elements in the restructured list-variant DOM.
- [ ] All 4 calendar consumer pages reuse an existing (or, for `MyCalendarContent`, newly-but-consistently-instantiated) favorite-toggle mechanism — none invents a divergent pattern.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
