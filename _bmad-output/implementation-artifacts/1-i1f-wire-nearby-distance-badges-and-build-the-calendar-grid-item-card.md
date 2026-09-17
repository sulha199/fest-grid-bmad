# Story 1.i1f: Shared Distance Badges and the Calendar Grid Item Card Primitive

## Story Details

- Epic: 1.i1
- Story ID: 1.i1f
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want one shared `computeDistanceKm` utility wired into both `EventCard`'s currently-dead masonry nearby badge and a new `EventCardCalendarGridItem` primitive for the desktop calendar grid,
so that "nearby" distance is computed identically everywhere it's shown (client display can never silently disagree with the server's own radius-filter definition of "N km away"), and the desktop calendar grid gains the same thumbnail/badge treatment its sibling card families already have.

## Acceptance Criteria

**Shared distance utility**

1. **Given** the existing SQL haversine expression already used server-side by `withinRadius` (`packages/graphql-select/drizzle-where.ts`, spherical law of cosines: `6371 * acos(clamp(cos(rad(lat1))*cos(rad(lat2))*cos(rad(lng2-lng1)) + sin(rad(lat1))*sin(rad(lat2)), -1, 1))`, clamped via `LEAST(1, GREATEST(-1, ...))`), **when** `computeDistanceKm(viewerCoord, targetCoord)` is implemented in `packages/domain/src/query/computeDistanceKm.ts`, **then** it is a pure function mirroring that exact formula and the 6371km constant (clamp implemented as `Math.min(1, Math.max(-1, ...))`), returning a `number` (kilometers).
2. **And** it has 100% unit test coverage (`packages/domain/src/query/computeDistanceKm.test.ts`, Node's native `node:test`/`assert` runner, matching this folder's own `resolveWithinRadiusConditions.test.ts` convention) — covering identical points (0km), antipodal/near-antipodal points (acos domain-clamp exercised), and at least one real-world pair cross-checked against a known distance.
3. **And** it is exported from `packages/domain/src/query/index.ts` alongside the existing `queryDsl`/`resolveWithinRadiusConditions` exports (the established generic, cross-entity mechanism folder — not nested under `events/`).
4. **And** a short comment cross-reference is added at `packages/graphql-select/drizzle-where.ts`'s `withinRadius` case pointing at `computeDistanceKm.ts` as its required client-side mirror (and vice versa), so a future edit to one formula prompts checking the other.

**Masonry `EventCard` nearby badge (the pre-existing dead prop)**

5. **Given** `EventCard.tsx`'s nearby badge is currently gated on `distanceKm != null && distanceKm <= 5` (line ~215) and no production caller has ever passed a real `distanceKm` (confirmed: only test files do), **when** this story ships, **then** the gate is corrected to DESIGN.md's revised `< 8` threshold, and the Discovery page (`home-content.tsx`) passes a real, computed `distanceKm` into `EventCard` via `EventListView`'s `getCardProps(event)` injection point for the first time.
6. **And** the distance is computed from the SAME schedule `EventListView.tsx` already selects as the card's display schedule (`selectDisplaySchedule(event.schedules)`, `packages/domain/src/events/selectDisplaySchedule.ts`) — specifically that schedule's `locationDetails.coordinates` — never a different schedule, so the shown distance always corresponds to the dates/venue already displayed on the same card.
7. **And** the "viewer coordinate" side of the calculation follows this priority, exactly as decided by Architecture Spine AD-22: **the active nearby-filter's resolved coordinate, if a filter is currently selected on the Discovery page.** This story fixes `use-nearby-filter.ts` so this branch works for **both** filter modes it currently only half-supports (see AC9-10 below) — not only the ad-hoc "current location" mode.
8. **And** when no nearby filter is active (`selectedValue === 'off'`) and no other viewer coordinate is resolvable, `distanceKm` is `undefined` and the badge is simply omitted — never an error, never a placeholder. (The "else, the viewer's ambient current-location coordinate" branch of AD-22's priority rule is explicitly out of scope for this story — see Out of Scope / Story 0.39.)
9. **And** `feed-content.tsx` and `favorites-content.tsx` are explicitly **not** wired in this story — both pages hardcode `isAuthenticated={false}`/`savedLocations={[]}` and never render a Location filter button at all (pre-existing `BUG-025`, separately tracked). `distanceKm` stays unset on those two pages; this is a documented, deliberate non-expansion of this story's scope, not a new gap it introduces.

**`useNearbyFilter` coordinate-completeness fix**

10. **Given** `use-nearby-filter.ts`'s `savedLocations` mapping (from `getMyLocations`, which already selects `locationDetails { coordinates { lat lng } }`) currently keeps only `{ id, name, radiusKm }`, dropping the coordinates entirely, **when** this story ships, **then** `savedLocations`' mapped objects retain the coordinate (e.g. `latitude`/`longitude`, sourced from `loc.locationDetails.coordinates.{lat,lng}`).
11. **And** the hook exposes a new derived value (e.g. `activeFilterCoord: { latitude: number; longitude: number } | undefined`) computed as: `adHocCoords` when `selectedValue === 'current'`; else the matching saved location's now-retained coordinate when `selectedValue` is a saved-location id; else `undefined` when `selectedValue === 'off'`. This is additive — the existing `resolvedFilter` value (which shapes the server-side DSL query condition) is unchanged; `activeFilterCoord` is a new, separate value for client-side distance display only.

**GraphQL exposure (mandatory first step, per Architecture Spine AD-22 Rule 3)**

12. **Given** `getEvents` (`apps/web/src/features/events/queries.graphql`) already selects `schedules { ... locationDetails { coordinates { lat lng } } }` but `getEventsForCalendar` and `getEventsForMyCalendar` do not select `locationDetails` at all, **when** this story ships, **then** both calendar queries gain the identical `locationDetails { coordinates { lat lng } }` block inside their `schedules { ... }` selection, and `apps/web/src/generated/graphql.ts` is regenerated (`apps/web/codegen.ts`) so `GetEventsForCalendarQuery`/`GetEventsForMyCalendarQuery`'s generated types include it.

**Desktop calendar data plumbing**

13. **Given** `WeeklyCalendarViewScheduleShape` (`packages/ui/src/features/events/WeeklyCalendarView.types.ts`) has no distance field today, **when** this story ships, **then** it gains `distanceKm?: number`, computed inside `useWeeklyCalendarController.ts`'s `schedules` flatMap via `computeDistanceKm`, using each schedule's own `locationDetails.coordinates` (not a per-event display-schedule selection — the calendar fans out every schedule into its own card, unlike masonry) and a `viewerCoord` value threaded in from the caller.
14. **And** `CalendarView.tsx` (the only calendar consumer with existing nearby-filter wiring, via `home-content.tsx`) passes its own resolved `activeFilterCoord` (AC11) through to the controller as this `viewerCoord`. `FeedCalendarView.tsx`, `AccountCalendarView.tsx`, and `my-calendar-content.tsx` are **not** wired to pass a coordinate in this story (they have no nearby-filter plumbing today) — `distanceKm` stays `undefined` there, mirroring AC9's non-expansion rule.

**New `EventCardCalendarGridItem` primitive**

15. **Given** `WeeklyCalendarView.tsx`'s `variant='grid'` `CalendarCard` render path is today a small, dense, text-only pill (favorited icon + event name + favorite count, no image, no badges) — confirmed structurally distinct from `variant='list'`'s already-shipped row card — **when** this story ships, **then** a new standalone component `EventCardCalendarGridItem` (`packages/ui/src/features/events/EventCardCalendarGridItem.tsx` + `.types.ts` + `.test.tsx`) implements DESIGN.md's `event_card_calendar_grid_item` token block:
    - **With-image composition** (renders only when the schedule `isMultiDay` **and** its image has not errored — never a reserved slot when the condition is false): a 3-column row (`items-center`, not `items-stretch`) — a `w-14 aspect-square` thumbnail, then a title/venue content column (title has no truncation and wraps freely across multiple lines; venue is `line-clamp-2`), then a right-side `side_stack` (`items-end`) holding, in order, the **large** favorite control (`event_card_favorite_count_badge_large` — the same "large, unpilled, icon-over-text" shape both sibling cards' *fallback* states use, but here it is this card's one and only favorite treatment in both compositions) and the nearby badge (`event_card_nearby_badge`, `<8km` gated, omitted entirely otherwise). **No status badge** in this composition (dropped by the 2026-09-14 UX pass — the with-image/multi-day composition never shows `event_card_status_badge`).
    - **No-image composition** (single-day events; or a multi-day event whose image errored) — a structurally different two-row stacked layout (`no_image_base`), NOT the with-image layout minus its image column: row 1 (`title_row`, `items-start`) pairs the title with the large favorite control, top-aligned so a wrapping multi-line title never pushes the favorite control down; row 2 (`location_row`, `items-center`) pairs the venue with the nearby badge (same `<8km` gate).
    - Neither composition renders a date box of any kind (the desktop day-column header directly above already anchors the date — a per-card date reference would be pure duplication, unlike the mobile row card's own till-content rule).
16. **And** the primitive is built and covered by component tests for both compositions (image-present/multi-day, image-absent, image-errored-on-a-multi-day-schedule, nearby-badge gating at the `<8km` boundary, favorite-toggle interaction, title/venue wrap behavior) — it is **not** wired into `WeeklyCalendarView.tsx`'s actual `variant='grid'` render branch in this story. That branch keeps rendering today's existing plain-text `CalendarCard` unchanged; adoption into the live calendar grid (the true multi-day spanning-bar mechanism, and the single-day/overflow-dialog integration) is deferred to Stories 1.i1g and 1.i1h respectively — see Out of Scope, and Dev Notes' Architecture & UX Gate Findings for why.

## Tasks / Subtasks

- [ ] **Task 1 — Build `computeDistanceKm` (AC 1-4)**
  - [ ] 1.1 Read `packages/graphql-select/drizzle-where.ts`'s `withinRadius` case in full; transcribe its exact formula/constants into `packages/domain/src/query/computeDistanceKm.ts` as a pure `computeDistanceKm(viewer: {latitude: number; longitude: number}, target: {latitude: number; longitude: number}): number` function.
  - [ ] 1.2 Add `computeDistanceKm.test.ts` (colocated, `node:test`/`assert`, matching `resolveWithinRadiusConditions.test.ts`'s style) with the coverage in AC2.
  - [ ] 1.3 Export from `packages/domain/src/query/index.ts`.
  - [ ] 1.4 Add the cross-reference comment in `drizzle-where.ts` (AC4).

- [ ] **Task 2 — Fix `EventCard.tsx`'s nearby badge threshold (AC5)**
  - [ ] 2.1 Change `distanceKm <= 5` to `distanceKm < 8` at the `showNearbyBadge` gate (`EventCard.tsx` ~line 215).
  - [ ] 2.2 Update/extend `EventCard.test.tsx` for the new threshold (boundary cases at exactly 8, just under 8, just over).

- [ ] **Task 3 — Fix `use-nearby-filter.ts` coordinate completeness (AC10-11)**
  - [ ] 3.1 Extend `savedLocations`' mapped shape with `latitude`/`longitude` sourced from each location's `locationDetails.coordinates.{lat,lng}` (already fetched by `getMyLocations`, currently dropped in the `.map(...)` at lines ~46-55).
  - [ ] 3.2 Add the new `activeFilterCoord` derived value per AC11's priority logic.
  - [ ] 3.3 Add/extend unit tests for `useNearbyFilter` covering: current-location mode returns `adHocCoords`; saved-location mode returns that location's coordinate; `off` mode returns `undefined`; a saved location with no coordinate (e.g. never geocoded) returns `undefined` gracefully, not a thrown error.

- [ ] **Task 4 — GraphQL exposure (AC12)**
  - [ ] 4.1 Add `locationDetails { coordinates { lat lng } }` inside `schedules { ... }` in `getEventsForCalendar` (`apps/web/src/features/events/queries.graphql` ~line 149-157) and `getEventsForMyCalendar` (~line 164-189), matching `getEvents`' existing block exactly.
  - [ ] 4.2 Regenerate GraphQL codegen (`apps/web/codegen.ts`) so `apps/web/src/generated/graphql.ts` reflects the new selection/types. Do not hand-edit the generated file.
  - [ ] 4.3 Confirm no other consumer of these two queries breaks from the additive field (grep all usages; it's a pure addition, no removed/renamed fields).

- [ ] **Task 5 — Wire masonry `distanceKm` end-to-end (AC5-9)**
  - [ ] 5.1 In `home-content.tsx`'s `getCardProps(event)` closure, call `selectDisplaySchedule(event.schedules)` to get the same schedule `EventListView.tsx` independently selects; if it has `locationDetails.coordinates` **and** `nearbyFilter.activeFilterCoord` is resolved, compute `distanceKm = computeDistanceKm(activeFilterCoord, { latitude: coords.lat, longitude: coords.lng })` and add it to the returned props object; otherwise omit the key (leave `undefined`).
  - [ ] 5.2 Do **not** modify `EventListView.tsx`/`EventListView.types.ts` — `getCardProps`'s return already overrides `derivedProps` via the existing `{...derivedProps, ...getCardProps(event)}` merge, so no change is needed there.
  - [ ] 5.3 Explicitly verify (and note in a code comment) that `feed-content.tsx`/`favorites-content.tsx` are left untouched (AC9).
  - [ ] 5.4 Add/extend integration tests on `home-content.tsx` (or its existing test file) verifying: a nearby filter active + an event with coordinates within 8km → badge renders; the same event when the filter is off → badge does not render; an event whose display schedule has no coordinates → badge does not render (no crash).

- [ ] **Task 6 — Wire calendar `distanceKm` data plumbing (AC13-14)**
  - [ ] 6.1 Add `distanceKm?: number` to `WeeklyCalendarViewScheduleShape` (`WeeklyCalendarView.types.ts`).
  - [ ] 6.2 Add a `viewerCoord?: { latitude: number; longitude: number }` option to `useWeeklyCalendarController`'s options type; in its `schedules` flatMap, compute `distanceKm` via `computeDistanceKm(viewerCoord, schedule.locationDetails.coordinates)` when both are present, else leave `undefined`.
  - [ ] 6.3 In `CalendarView.tsx`, pass `viewerCoord={activeFilterCoord}` (the same value used for masonry, sourced from the same `useNearbyFilter()` instance in `home-content.tsx`, threaded down as a new `CalendarView` prop) into the controller.
  - [ ] 6.4 Leave `FeedCalendarView.tsx`/`AccountCalendarView.tsx`/`my-calendar-content.tsx` unchanged (AC14) — document this explicitly in a code comment at the controller's option definition.
  - [ ] 6.5 Add/extend `useWeeklyCalendarController.test.tsx` and `CalendarView.test.tsx` coverage for the new field being computed/passed correctly and safely omitted when absent.

- [ ] **Task 7 — Build `EventCardCalendarGridItem` (AC15-16)**
  - [ ] 7.1 Create `EventCardCalendarGridItem.types.ts` with props matching DESIGN.md's token block (schedule fields needed: `title`/`eventName`, `location`/venue, `imageUrl`, `isMultiDay`, favorite state/count + toggle handler, `distanceKm?`).
  - [ ] 7.2 Implement the with-image composition (3-column row, `items-center`, thumbnail + content + side_stack) per AC15.
  - [ ] 7.3 Implement the no-image composition (`no_image_base`/`title_row`/`location_row`) per AC15, including the image-errored-on-multi-day fallback path (reuse the same `onImagePresenceChange`/`imgError` detection pattern already established in `EventCardMediaPrimitives.tsx`/`EventCardMediaSlot`).
  - [ ] 7.4 Reuse existing primitives where possible (`EventCardFavoriteBadge` from `EventCardMediaPrimitives.tsx` for the favorite control) rather than re-implementing favorite-toggle logic.
  - [ ] 7.5 Write `EventCardCalendarGridItem.test.tsx` covering both compositions, the nearby-badge `<8km` gate boundary, favorite toggle, and title/venue wrap classes.
  - [ ] 7.6 Do **not** wire this component into `WeeklyCalendarView.tsx`'s render branches in this story (AC16) — leave a `// TODO(1.i1g/1.i1h)`-style comment near the untouched `variant='grid'` branch pointing at the two follow-on stories, so the deferral is discoverable in the code, not only in this story file.

- [ ] **Task 8 — Full verification (all ACs)**
  - [ ] 8.1 Run `packages/domain`'s test script (`tsx --test`) and confirm `computeDistanceKm.test.ts` passes with 100% coverage of the new file.
  - [ ] 8.2 Run `packages/ui`'s test suite (Vitest) and confirm all touched/added files pass, with no regression in existing `EventCard`/`WeeklyCalendarView`/`useWeeklyCalendarController` suites.
  - [ ] 8.3 Run `apps/web`'s relevant test files (`home-content`, `CalendarView`, `use-nearby-filter`) and confirm green.
  - [ ] 8.4 `eslint` and `tsc --noEmit` clean (or no new errors beyond documented pre-existing ones, per this epic's established precedent) for every touched/added file.
  - [ ] 8.5 Confirm GraphQL codegen ran and the generated file's diff is additive-only (no unrelated regeneration noise beyond the two edited documents).

## Dev Notes

- This story is the first in a Gate-2-driven three-story sequence covering backlog.yaml's IDEA-026 (desktop calendar grid card) — see Architecture & UX Gate Findings below for the full split rationale. Stories 1.i1g (multi-day spanning bar) and 1.i1h (shared overflow dialog + BUG-036's fetch fix) both **depend on this story** and are not yet drafted.
- This story follows Epic 1.i1's own established "build the primitive, adopt it later" sequencing precedent: Story 1.i1a built the shared image/badge primitive without touching any consumer's render path; Stories 1.i1c/1.i1d/1.i1e each later adopted it into one consumer. This story does the same for `EventCardCalendarGridItem` — built and tested standalone, adopted by 1.i1g/1.i1h.
- **Files read in full before drafting this story** (current-state summary, so `bmad-dev-story` does not need to re-derive these from scratch):
  - `packages/ui/src/features/events/WeeklyCalendarView.tsx` — `CalendarCard`'s `variant='grid'` branch (lines ~937-983) is a single `<button>` with roving tabindex and a hover/focus tooltip, no media slot, no badges. `variant='list'` (lines ~874-935) is Story 1.i1d's shipped row card — unaffected by this story. Multi-day "spanning" today is cosmetic only: `isMultiDay` schedules render as N independent per-day `CalendarCard` instances, joined by `multiDayRoundingClass`'s corner-rounding suppression at touching edges (lines ~838-856) — there is no CSS-grid-column-spanning element anywhere in this file today. `DAY_CELL_CLASS`/`MORE_LINK_CLASS`/the `w-56 max-h-56 overflow-y-auto` popover (lines ~629-672) are all untouched by this story (1.i1h's job).
  - `packages/ui/src/features/events/WeeklyCalendarView.types.ts` — `WeeklyCalendarViewScheduleShape` (lines 1-17) already carries `eventStartDate`/`eventEndDate`/`eventStartTime`/`eventEndTime` (everything `formatEventStatus` needs, per AD-22 Rule 1 — not needed by this story since neither grid-item composition shows a status badge) plus `isFavorited`/`isAddedToCalendar`/`favoriteCount`/`eventId`/`imageUrl`. This story adds only `distanceKm?: number`.
  - `packages/ui/src/hooks/useWeeklyCalendarController.ts` — the `schedules` memo (lines 55-74) flat-maps each event's schedules into one row per schedule; it never calls a GraphQL hook itself (the caller does). This is the mapping site this story extends with `distanceKm`.
  - `packages/ui/src/features/events/EventCard.tsx` — nearby badge JSX at lines ~361-366, gate at line ~215 (`distanceKm != null && distanceKm <= 5`, masonry-variant only). Prop type `distanceKm?: number | null` already exists (`EventCard.types.ts:109`).
  - `packages/ui/src/features/events/EventListView.tsx` — masonry's event→`EventCard` prop mapping (lines ~58-96): `displaySchedule = selectDisplaySchedule(event.schedules ?? [])` drives `startDate`/`startTime`/`endDate`/`endTime`; `mergedProps = {...derivedProps, ...getCardProps(event)}` is the existing per-page override point this story uses — **no change needed to this file**.
  - `packages/domain/src/events/selectDisplaySchedule.ts` — picks the earliest still-upcoming/ongoing schedule, else `isMainSchedule`, else earliest overall. This story's masonry distance calculation must use the coordinates of THIS SAME schedule (AC6), not any other.
  - `apps/web/src/app/[locale]/use-nearby-filter.ts` — full hook read; `savedLocations` mapping (lines ~46-55) and `resolvedFilter` (lines ~103-123) are exactly as described in AC10-11. The frontend `NearbyFilterInput` interface (line 9-13) already declares optional `latitude`/`longitude` fields — this story populates them for `savedLocations`, but does **not** need to change `resolvedFilter`'s shape or the domain-level `NearbyFilterInput` DSL union type (`packages/domain/src/events/buildEventsQueryCondition.ts:2-4`), since the server-side query condition and the client-side distance-display coordinate are orthogonal concerns — `activeFilterCoord` (AC11) is a new value, not a change to what's sent to the backend.
  - `apps/web/src/app/[locale]/home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx` — confirmed via direct read that none computes `distanceKm` today; only `home-content.tsx` wires `useNearbyFilter` at all. `feed-content.tsx`/`favorites-content.tsx` hardcode `isAuthenticated={false}`/`savedLocations={[]}` and never render the Location filter button (`BUG-025`).
  - `apps/web/src/features/events/queries.graphql` — `getEvents` (lines 2-34) already selects `locationDetails.coordinates.{lat,lng}`; `getEventsForCalendar` (lines 137-162) and `getEventsForMyCalendar` (lines 164-189) do not. This is the AD-22 Rule 3 "mandatory first step" gap this story closes.
  - `apps/backend/src/schema/resolvers.ts` — confirmed `Query.events`' resolver is untouched by this story (that's Story 1.i1h's scope, per BUG-036/AD-23).
  - `packages/graphql-select/drizzle-where.ts` — `withinRadius` case (lines ~97-117), the exact formula this story's `computeDistanceKm` must mirror (transcribed verbatim in AC1).

### Architecture & UX Gate Findings

`epic-1-i1-readiness.md` (swept 2026-09-13) covers Stories 1.i1a-e/1.i1z and concluded "no resolver, query, or mutation is touched anywhere in this epic." This story's own scope (GraphQL selection-set changes) does not itself contradict that Gate-1 conclusion by introducing a new resolver — but because a **sibling** story in this same split (1.i1h) does touch `Query.events`' resolver internals, all three gates were re-run fresh for this story rather than silently citing the old sweep, per the workflow's escape-hatch guard.

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona) — NO GAP.** Verified independently: `computeDistanceKm` is pure math with no DB/ORM/Node-only dependency; the GraphQL query changes (Task 4) only widen the selection set of two already-existing queries against an already-existing, already-resolvable field (`Schedule.locationDetails`) — no new resolver, schema field, query, or mutation. `use-nearby-filter.ts`'s fix reads data its own existing query already fetches. No DB/domain package is called directly from `apps/web`. No external service is called directly from the frontend (geolocation capture is unchanged, browser-native, already established). Fully compliant with AD-1/AD-2.
- **Gate 2 (UI Complexity & Reusability, Freya persona) — GAP FOUND, split applied.** The new `EventCardCalendarGridItem` primitive has two independent, both non-trivial consumers per EXPERIENCE.md: the new multi-day CSS-grid-spanning render mechanism (genuinely new — no spanning element exists in this codebase today, only N cosmetically-joined per-day segments), and the shared overflow dialog + fair per-day backend fetch (itself carrying its own non-trivial infinite-scroll/pagination-correctness surface, and bound by AD-23's own sequencing mandate to ship with BUG-036's fetch fix). Building the primitive and both live-calendar adoptions in one pass risks each adoption iterating on card layout under its own pressure and drifting from a single finished contract — exactly the failure mode Gate 2 exists to catch (see `story-split-gate.md`'s own retrospective rationale). Split: this story builds and tests the primitive standalone (plus the mandatory distanceKm/badge wiring, which IS kept together per AD-22 Rule 4 — the util and the masonry badge fix are one cohesive unit, not re-split); **Story 1.i1g** (multi-day spanning bar, depends on this story) and **Story 1.i1h** (shared overflow dialog + BUG-036 fetch fix + resolver tie-break sort, depends on this story) are the two adoption stories, both drafted as full `epics.md` sections and `sprint-status.yaml` backlog entries (not yet run through their own `bmad-create-story` pass). This mirrors, and does not violate, this epic's own established build-then-adopt precedent (1.i1a → 1.i1c/d/e) and both of AD-22 Rule 4/AD-23's explicit "ship together" mandates (each mandated pairing stays intact within its own story).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona) — GAP FOUND on one item, split applied; NO GAP on the rest.**
  - **Gap:** Architecture Spine AD-22's distance-priority rule ("active filter location if one is selected, else the viewer's current location coordinate") never designed how the "else" branch sources a coordinate passively. Verified: no global/app-shell viewer-location context/provider/persisted state exists anywhere in this codebase; the only geolocation capture mechanism (`useCurrentLocationCapture`, `packages/ui/src/hooks/useCurrentLocationCapture.ts`) is a bare imperative `navigator.geolocation.getCurrentPosition` wrapper, used exclusively behind explicit user-initiated actions (the nearby-filter's own "current location" click; two location-picker forms) — never ambient/passive. Gate 3's independent judgment: this is a real product/consent decision (permission-prompt timing, caching/persistence policy — silently prompting for geolocation with no explicit user intent would be a new, privacy-sensitive pattern for this app) and the capability is legitimately reusable by future "distance from me" features, not a narrow wiring gap belonging inside this feature story. **Split into Story 0.39** (Epic 0, tooling/infrastructure numbering rule), backlog.yaml `IDEA-040`. Until 0.39 ships, this story's badge implements only the "active filter location" branch (AC7-8) — an accepted, documented, temporary limitation, not a deferred bug.
  - **No gap:** the `use-nearby-filter.ts` saved-location-coordinate completion (AC10-11) is a narrow, mechanical fix to a hook this story already depends on for the same feature (retaining data its own existing query already fetches) — not a new mechanism, not reusable infrastructure in its own right. Inline.
  - **No gap:** `computeDistanceKm`'s placement in `packages/domain/src/query/` matches an already-established convention (`resolveWithinRadiusConditions.ts` is the direct precedent for a generic, cross-entity geo mechanism living there) — not a new pattern needing its own foundational story.
  - **No gap:** no other project-context.md-mandated utility or architecture-spine item is referenced but orphaned by this story's scope (no SQL-window-function precedent gap, no per-day-cursor gap — those are Story 1.i1h's concern, already tracked via BUG-036/FIND-026).

Per the escape hatch in `story-split-gate.md`: none of these three findings required user override — Gate 2's split preserves both of AD-22 Rule 4/AD-23's explicit user-confirmed "ship together" sequencing mandates intact (see above), and Gate 3's split is a straightforward application of the tooling/infrastructure numbering rule to a genuinely new, reusable capability. No `AskUserQuestion` was needed for either gate outcome.

**Coordinate priority resolution, worked through explicitly (so `bmad-dev-story` does not have to re-derive it):**

| Situation | `home-content.tsx` (masonry) | `CalendarView.tsx` (calendar) |
|---|---|---|
| A nearby filter is active, mode = "current" | `activeFilterCoord` = the one-shot captured `adHocCoords` | same value, threaded as `viewerCoord` |
| A nearby filter is active, mode = a saved location | `activeFilterCoord` = that saved location's now-retained coordinate (AC10) | same |
| No nearby filter active (`off`) | `activeFilterCoord` = `undefined` → badge omitted | same → `distanceKm` omitted |
| `feed-content.tsx` / `favorites-content.tsx` | not wired at all (`BUG-025`) — badge never renders | n/a (no calendar view change needed there beyond AC14's non-expansion) |

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No database schema change of any kind — this story adds zero new columns/tables/migrations. It does add new fields to TypeScript types and widens two GraphQL selection sets (both purely additive, sourced from already-existing, already-resolvable data).
- **Impacted fields/contracts:**
  - `packages/domain/src/query/index.ts` — new export, `computeDistanceKm`.
  - `apps/web/src/features/events/queries.graphql` → `apps/web/src/generated/graphql.ts` — `GetEventsForCalendarQuery`/`GetEventsForMyCalendarQuery` gain `schedules[].locationDetails.coordinates.{lat,lng}` (nullable, matching `LocationDetails.coordinates`'s existing nullability — `getEvents`' identical field is already nullable-safe in `EventListView.tsx`'s consumption).
  - `packages/ui/src/features/events/WeeklyCalendarView.types.ts` — `WeeklyCalendarViewScheduleShape.distanceKm?: number` (new optional field, backward compatible — every existing consumer that doesn't set it is unaffected).
  - `apps/web/src/app/[locale]/use-nearby-filter.ts` — `savedLocations`' mapped item shape gains optional `latitude`/`longitude`; new `activeFilterCoord` return value. Both additive; no existing consumer of `useNearbyFilter()`'s return shape breaks.
  - `EventCard.tsx`'s `distanceKm` prop type is unchanged (`number | null | undefined` already existed) — only the internal threshold comparison changes.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** As listed above — all additive optional fields/exports, no breaking changes to any existing interface.
- **Backward compatibility and rollout notes:** Every new field is optional; every existing caller that does not supply a coordinate continues to render exactly as today (badge omitted, same as the current always-omitted state). The `EventCard.tsx` threshold change from `<=5` to `<8` has zero observable effect until this story's own masonry wiring ships in the same deploy (currently no caller passes a real value, so the threshold change alone is a no-op) — shipping both together avoids a window where the corrected threshold exists but nothing exercises it.
- **Verification checks:** `computeDistanceKm.test.ts` (100% coverage, boundary/antipodal cases); `EventCard.test.tsx` threshold boundary tests; `home-content.tsx`/`use-nearby-filter` integration tests (AC5.4, Task 3.3); GraphQL codegen diff review confirming additive-only generated-type changes; `useWeeklyCalendarController.test.tsx`/`CalendarView.test.tsx` coverage for the new optional field.

### Project Structure Notes

- `computeDistanceKm.ts`/`.test.ts` land in `packages/domain/src/query/` (generic cross-entity mechanism folder, existing precedent: `resolveWithinRadiusConditions.ts`) — **not** `packages/domain/src/events/`, since distance computation is not events-specific (project-context.md's Code Organization rule on generic mechanisms).
- `EventCardCalendarGridItem.tsx`/`.types.ts`/`.test.tsx` land in `packages/ui/src/features/events/`, alongside `EventCard.tsx`/`EventCardMediaPrimitives.tsx`/`WeeklyCalendarView.tsx` — matching this epic's own established `features/events` convention (not `packages/ui/src/core/`, since this card's content is event-domain-specific, mirroring `epic-1-i1-readiness.md`'s own reasoning for why the shared primitive lives in `features/events` and not `core/`).
- No new workspace package boundaries are crossed: `computeDistanceKm` (packages/domain, pure/dependency-free) is consumed by both `packages/ui` (via `apps/web`'s own import, since `packages/ui` itself must stay React-only/framework-light — confirm at implementation time whether `packages/domain` is already a dependency of `packages/ui` or whether the computation should instead happen at the `apps/web` call site and be passed down as a plain prop, consistent with "neither component computes it internally" per AD-22 Rule 3). **This story computes `distanceKm` at the `apps/web` page level (`home-content.tsx`, `CalendarView.tsx`) and passes it down as a plain prop to both `EventCard` and `WeeklyCalendarViewScheduleShape`/`EventCardCalendarGridItem`** — neither UI component imports `computeDistanceKm` or `packages/domain` directly. This avoids any question of whether `packages/ui` may depend on `packages/domain`.
- No detected conflicts with in-flight work: Stories 1.i1a-e/1.i1z are all `review` status (implemented, not yet code-reviewed to `done`) — this story only adds new files/fields alongside them, touching `EventCard.tsx` (already modified by 1.i1e) and `WeeklyCalendarView.types.ts`/`useWeeklyCalendarController.ts` (already modified by 1.i1d) at different, non-overlapping locations (threshold constant; new optional field/export respectively) — low collision risk, but confirm no merge conflicts against 1.i1e's `EventCard.tsx` diff at implementation time.

### References

- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` §AD-22 (Shared Distance Computation for Nearby Badges), §AD-1/AD-2 (Unified Query DSL / Unified Event Querying)]
- [Source: `design-artifacts/UX-festgrid-run-1/DESIGN.md` `components.event_card_calendar_grid_item`, `event_card_calendar_grid_item_thumbnail_fallback`, `event_card_nearby_badge`, `event_card_favorite_count_badge_large`]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` "Calendar Grid Item Card: Desktop Composition and Fallback", "Calendar View Cards: Attachment and Composition"]
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml` IDEA-026 (parent IDEA-016), IDEA-025 (sibling, mobile — deliberately not in this story's scope)]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` — cited for context, not relied on for Gate 1/3 verdicts per the escape-hatch guard above]
- [Source: `_bmad-output/implementation-artifacts/1-i1d-adopt-the-primitive-into-weeklycalendarview-compact-row.md`, `1-i1e-adopt-the-primitive-into-the-masonry-default-state.md` — prior-story conventions this story follows]

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (packages/domain purity, generic-mechanism subfolder placement), Locale-Sensitive Data Rendering (N/A — no new locale-formatted numeric display beyond the existing badge's distance text, unchanged format), Database & Performance (`Query.events` per-row-cost caution — not touched by this story), State Management Architecture (distanceKm is plain-prop-derived server data, not client global state).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1, AD-2, AD-22 (this story's primary mandate).
- [x] `docs/infrastructure/index.md` — no infra/backend-compute/queue/EventBridge/DB-provisioning surface touched by this story (frontend + a pure domain function + additive GraphQL selection only); no infra shard read required per the persistent-facts rule.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/domain/src/query/computeDistanceKm.ts`, `packages/domain/src/query/computeDistanceKm.test.ts`, `packages/ui/src/features/events/EventCardCalendarGridItem.tsx`, `EventCardCalendarGridItem.types.ts`, `EventCardCalendarGridItem.test.tsx`.
  - Modified: `packages/domain/src/query/index.ts`; `packages/graphql-select/drizzle-where.ts` (comment only); `packages/ui/src/features/events/EventCard.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/use-nearby-filter.ts` + its test file; `apps/web/src/features/events/queries.graphql`; `apps/web/src/generated/graphql.ts` (regenerated); `packages/ui/src/features/events/WeeklyCalendarView.types.ts`; `packages/ui/src/hooks/useWeeklyCalendarController.ts` + `.types.ts` + test; `apps/web/src/features/events/CalendarView.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/home-content.tsx` (+ its test file, if one exists).
- **Rule Mapping:**
  - AD-1/AD-2 → no new API surface; only existing-query selection widening and existing-resolver internals (deferred to 1.i1h) — see Gate 1 finding.
  - AD-22 Rules 1-4 → Rule 1 needs no action (confirmed, not used by this card composition); Rule 2 → Task 1; Rule 3 → Tasks 4/6; Rule 4 → Tasks 2/5 kept in the same story as the utility, per mandate.
  - project-context.md Code Organization → Task 1's `packages/domain/src/query/` placement; packages/domain purity preserved (no React, no DB/ORM import in `computeDistanceKm.ts`).
  - project-context.md Testing Rules → 100% `packages/domain` unit coverage (Task 1.2); testing-trophy integration coverage for `apps/web`/`packages/ui` changes (Tasks 3.3, 5.4, 6.5, 7.5).
- **Verification Plan:** Task 8's full test/lint/typecheck pass across `packages/domain`, `packages/ui`, and `apps/web`'s touched files; manual confirmation that the GraphQL codegen diff is additive-only; confirmation that `feed-content.tsx`/`favorites-content.tsx` are untouched (`git diff` should show zero changes to those two files).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — this story builds `computeDistanceKm` + wires it into `EventCard`'s masonry badge + the calendar data plumbing, and builds (but does not yet wire into the live calendar grid) the new `EventCardCalendarGridItem` primitive. It does **not** build the multi-day spanning bar, the overflow dialog, or the BUG-036 backend fetch fix (Stories 1.i1g/1.i1h), and does **not** build an ambient viewer-location capability (Story 0.39) — the nearby badge only supports the "active filter location" branch until 0.39 ships.
- [ ] Architecture and boundary confirmation — `computeDistanceKm` stays in `packages/domain` with zero React/DB/Node-only dependencies; `distanceKm` is computed at the `apps/web` page level and passed down as a plain prop to both `EventCard` and the calendar shape, per Project Structure Notes.
- [ ] Testing plan confirmation — Task 8's coverage across `packages/domain` (100%), `packages/ui`, and `apps/web`.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap. Gate 2: gap accepted via split into Stories 1.i1g/1.i1h (both drafted as full `epics.md` sections + `sprint-status.yaml` backlog entries, not yet individually `bmad-create-story`'d). Gate 3: gap accepted via split into Story 0.39 (`epics.md` section + `sprint-status.yaml` backlog entry added); this story's badge deliberately omits the "ambient current location" branch until 0.39 ships — confirm this documented limitation is acceptable before implementation begins.

## Testing Requirements

- [ ] Integration tests — `home-content.tsx` masonry badge wiring (filter on/off, boundary distance); `CalendarView.tsx`/`useWeeklyCalendarController` distance-field plumbing; `use-nearby-filter.ts` coordinate-completeness across all three `selectedValue` modes.
- [ ] Unit tests — `computeDistanceKm` (100% coverage, `packages/domain`'s mandatory rule); `EventCardCalendarGridItem` component tests for both compositions.
- [ ] E2E tests — not required for this story (no new user-facing flow reachable outside existing component tests; the primitive is not yet live-rendered in the calendar grid, and the masonry badge fix is covered by integration tests). Revisit once Stories 1.i1g/1.i1h make the primitive actually visible in the calendar.

## Deliverables Checklist

- [ ] `computeDistanceKm` utility + 100%-covered unit tests, exported from `packages/domain/src/query/`.
- [ ] `EventCard.tsx` nearby-badge threshold corrected to `<8km` and actually fed a real value from `home-content.tsx`.
- [ ] `use-nearby-filter.ts` fixed to retain saved-location coordinates and expose `activeFilterCoord`.
- [ ] `getEventsForCalendar`/`getEventsForMyCalendar` GraphQL documents + regenerated types include `locationDetails.coordinates`.
- [ ] `WeeklyCalendarViewScheduleShape.distanceKm?` plumbed through `useWeeklyCalendarController`/`CalendarView.tsx`.
- [ ] New `EventCardCalendarGridItem` primitive (both compositions), tested standalone, not yet wired into the live calendar grid.
- [ ] `epics.md` sections for Stories 1.i1g, 1.i1h, and 0.39 (already added during this story's creation — verify present).
- [ ] `sprint-status.yaml` backlog entries for 1-i1g, 1-i1h, 0-39 (already added during this story's creation — verify present).
- [ ] `backlog.yaml` IDEA-026 promoted with this story's key; child rows IDEA-039/IDEA-040 added; BUG-036/FIND-026 updated with Story 1.i1h's key (already applied during this story's creation — verify present).

## Out of Scope

- **Story 1.i1g** — rendering a multi-day schedule as one true spanning `EventCardCalendarGridItem` across its day-columns in `grid_weekly` (today's per-day-segment mechanism stays exactly as-is until then).
- **Story 1.i1h** — the shared `calendar_overflow_dialog` component (mobile sheet / desktop dialog, infinite scroll), the BUG-036 per-day-windowed backend fetch fix, the resolver's outer `ORDER BY` tie-break sort, and single-day adoption of `EventCardCalendarGridItem` into the always-visible `day_cell`/overflow surface.
- **Story 0.39** — an ambient/passive viewer-current-location capability. Until it ships, the nearby badge on both masonry and (once 1.i1g/1.i1h land) the calendar grid only supports the "active filter location" branch of AD-22's priority rule; with no filter active, the badge is simply omitted.
- **IDEA-025** (mobile compact-row status/nearby badges) — a deliberate, separate, already-tracked follow-on. It will reuse this story's `computeDistanceKm` utility rather than rebuilding it, but its own badge-content wiring into `event_card_compact` is not part of this story.
- **ADDENDUM (2026-09-17, added while drafting Story 1.i1j via `bmad-create-story`, IDEA-025's own promotion):** drafting IDEA-025 surfaced a Gate 2 finding that also touches this story — **Story 1.i1i** (new, `backlog.yaml` IDEA-041) extracts a shared `packages/ui/src/features/events/` status/nearby badge component and migrates `EventCard.tsx`'s masonry branch onto it, including this story's own AC5/Task 2 threshold fix (`distanceKm <= 5` → `< 8`). **Whichever of Story 1.i1f or Story 1.i1i implements first should check the other's status before touching `EventCard.tsx`'s nearby-badge gate** — if 1.i1i ships first, this story's Task 2 is already satisfied (verify rather than re-edit the now-migrated code); if this story ships first, Story 1.i1i's own migration should extract from the corrected `<8` version, not re-introduce `<=5`. Not a scope change to this story's own ACs, a sequencing note only.
- **`BUG-025`** (Feed/Favorites pages hardcode `isAuthenticated={false}`/`savedLocations={[]}` and never render the Location filter button at all) — pre-existing, separately tracked. Until it's fixed, `distanceKm` cannot be computed on those two pages regardless of this story's own wiring; not addressed here.
- Any i18n string changes — the nearby badge's label text ("Nearby") is unchanged by the threshold correction; no new locale keys are introduced by this story.
- Any change to the domain-level `NearbyFilterInput` DSL union type or the server-side query-condition shape — this story only adds a new, separate client-side `activeFilterCoord` display value.

## Definition of Done

- [ ] All Acceptance Criteria satisfied.
- [ ] All Task 8 tests passing (`packages/domain` 100% coverage on new file; `packages/ui`; `apps/web`).
- [ ] Lint (`eslint`) and `tsc --noEmit` clean for every touched/added file (or no new errors beyond documented pre-existing baseline, per this epic's precedent).
- [ ] GraphQL codegen regenerated and committed.
- [ ] `epics.md`/`sprint-status.yaml`/`backlog.yaml` prerequisite entries for 1.i1g/1.i1h/0.39 present and correct (already applied during story creation).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent._

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created (`bmad-create-story`, 2026-09-17). Three parallel research subagents were used to extract exact current-code facts (frontend calendar/masonry components, backend resolver/DSL/SQL, prior-story conventions and `packages/domain` structure) plus a fourth for the nearby-filter/geolocation/prop-mapping gap analysis, before Gate 1/2/3 were each dispatched fresh (not cited from `epic-1-i1-readiness.md`, since this story's scope falsifies that sweep's own "no resolver touched" Gate 1 conclusion for the wider IDEA-026 item). Gate 2 and Gate 3 each found a real, independently-justified split; both are reflected in this story's reduced scope, in new `epics.md` sections for Stories 1.i1g/1.i1h/0.39, and in `sprint-status.yaml`/`backlog.yaml` updates made as part of this story's creation.

### File List

_To be filled by the dev agent during implementation._

## Change Log

- 2026-09-17: Story created via `bmad-create-story` from backlog.yaml IDEA-026 (Architecture Spine AD-22/AD-23). Gate 2/Gate 3 findings narrowed this story's scope and produced three new prerequisite/follow-on entries (Stories 1.i1g, 1.i1h, 0.39) — see Dev Notes for the full record.
