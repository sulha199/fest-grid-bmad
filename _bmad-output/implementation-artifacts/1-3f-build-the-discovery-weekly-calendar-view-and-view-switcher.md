---
baseline_commit: a5668cd6d6aee32205c0b572c45d5bd40a87dce2
---
# Story 1.3f: Build the Discovery weekly-calendar view and view-switcher

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.3f
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to toggle the Discovery feed between a card grid and a weekly calendar, both reflecting my active search/filter,
so that I can browse events in whichever format suits me, per `design-artifacts/D-Design-System/01-event-list-view.md`'s "View Toggles" standard interaction.

## Acceptance Criteria

1. **Given** the Discovery page, **when** it renders, **then** a view-switcher control offers "Card View" (default) and "Calendar View" — rendered by `EventDiscoveryPanel` itself, not a separately state-managed sibling component. `EventDiscoveryPanel`'s `views[]` contract (Story 1.3e) is extended with an optional `label: string` / `icon?: ReactNode` per entry; `EventDiscoveryPanel` renders the switcher control whenever `views.length > 1`, using the active-view state (`useQueryState('view', ...)`) it already owns internally.
2. **And** selecting "Calendar View" renders `WeeklyCalendarView` (Story 1.3g) inside a new `apps/web`-level `CalendarView` wrapper, populated from a dedicated week-scoped `events` query (a new `getEventsForCalendar` operation using Story 1.3h's `scheduleDateRange`/`overlaps` DSL condition, combined via `and` with the page's existing `q`/`types`/`categories` condition). `maxEventsPerDay` is `5`, matching `DESIGN.md`'s `discovery_view` token.
3. **And** switching between Card View and Calendar View preserves the active `q`/`types`/`categories` URL state — no lost filter context. The active view (`view=card`/`view=calendar`, owned by `EventDiscoveryPanel`) and the visible week (`week=<ISO date of the week's first day>`, owned by the new `CalendarView` wrapper) are both reflected in the URL via `nuqs` (AD-4), so both are shareable/deep-linkable and survive a page reload.
4. **And** activating a schedule's compact card in Calendar View opens the same event-detail modal as clicking a card in Card View — reusing the existing `/events/[slug]?fromList=true&...` navigation and `@modal/(.)events/[slug]` intercepting route unchanged — with the current URL's full query string (including `view=calendar` and `week=...`) carried through via `searchParams.toString()`, so returning from the modal (`router.back()`) restores Calendar View at the same week. Matches `EXPERIENCE.md`'s Event Discovery interaction. `useListNavigationForEvent`'s Next/Previous context (`apps/web/src/features/events/navigation-hook.ts`) resolves by `eventId` against the flat `events` list already loaded for `fromList` context — this is layout-agnostic (works identically whether the click originated from a card or a calendar schedule) and requires no changes.
5. **And** switching views announces the change to assistive technology — an `aria-live="polite"` region (in `home-content.tsx`, matching `EventDetailWrapper`'s existing `liveMessage` pattern) reports the newly active view's label, since the visual grid/layout changes entirely on switch.
6. **And** Calendar View's loading/error states follow the project's Non-Blocking Skeleton (initial load) and caller-supplied error message+detail pattern, matching `EventListView`'s `status` prop convention — no full-screen blocking overlay, since this is not a critical mutation.
7. **And** all new user-facing strings (view-switcher labels, calendar nav/aria labels, calendar error state, view-switch announcement) exist in both `en.json` and `id.json` under the `DiscoveryPage` namespace, keeping `apps/web/locales/locales.test.ts`'s existing key-parity check passing.

## Tasks / Subtasks

- [ ] Task 1: Extend `EventDiscoveryPanel`'s contract to render the view-switcher (AC1)
  - [ ] In `packages/ui/src/features/events/EventDiscoveryPanel.types.ts`, add `label: string` and `icon?: ReactNode` to `EventDiscoveryPanelView`.
  - [ ] In `packages/ui/src/features/events/EventDiscoveryPanel.tsx`, render a switcher control (button group / tabs) above or alongside the active view's `content` whenever `views.length > 1`, using the component's existing `useQueryState('view', ...)` state — selecting a switcher option updates that same state (no new prop needed for this).
  - [ ] Extend `EventDiscoveryPanel.test.tsx`: switcher renders and is omitted correctly for single-view usage (Story 1.3/2.2's existing single-entry `views` arrays must keep rendering with **zero visible behavior change** — no switcher control at all when `views.length === 1`), switcher selection updates the active view and the URL `view` param, keyboard operability of the switcher control.
  - [ ] **Prerequisite note:** Story 1.3e (`EventDiscoveryPanel`) is itself still `ready-for-dev` (unbuilt) as of this story's creation. If 1.3e has not been implemented yet when this story starts, its full AC1-AC10 scope must be implemented first (or concurrently) — this task's switcher extension builds on top of that base contract, not a green-field component.
- [ ] Task 2: Add schedule-level date-range query support to the backend (Story 1.3h — verify done, do not re-implement here)
  - [ ] Confirm Story 1.3h (`1-3h-extend-the-events-graphql-api-with-schedule-level-date-range-query-support`) is `done` before starting Task 4. If not yet done, this story cannot be completed end-to-end — see Pre-Coding Approval Gate.
  - [x] Task 3: Build the reusable `WeeklyCalendarView` primitive (Story 1.3g — verify done, do not re-implement here)
  - [x] Confirm Story 1.3g (`1-3g-build-the-reusable-weeklycalendarview-component`) is `done` before starting Task 4. If not yet done, this story cannot be completed end-to-end — see Pre-Coding Approval Gate.
- [ ] Task 4: Add the week-scoped GraphQL query (AC2)
  - [ ] Add a new `getEventsForCalendar($limit: Int, $offset: Int, $query: EventQueryConditionInput)` operation to `apps/web/src/features/events/queries.graphql` (a new operation, not an extension of the existing `getEvents` — avoids over-fetching `eventEndDate`/`eventStartTime`/`eventEndTime` on Card View's request, per project-context.md's Optimized DB Queries rule), selecting: `id, eventName, slug, imageUrl, location, types, categories`, and `schedules { id, isMainSchedule, eventStartDate, eventEndDate, eventStartTime, eventEndTime, ticketPrice }`.
  - [ ] Run `pnpm codegen` (GraphQL Code Generator) to regenerate `apps/web/src/generated/graphql.ts` with `GetEventsForCalendarQuery`/`useGetEventsForCalendarQuery` (or the `graphqlClient.request` equivalent, matching the existing `document Mode: string` codegen config).
  - [ ] Add `packages/domain/src/events/buildWeeklyCalendarQueryCondition.ts`: `buildWeeklyCalendarQueryCondition({ search, types, categories, weekStart, weekEnd })`, reusing `buildEventsQueryCondition`'s `search`/`types`/`categories` condition-building logic and appending a `{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: weekStart, to: weekEnd } }` terminal condition via `and`. 100% unit tested (project-context.md's `packages/domain` testing rule), covering: no filters + date range only, filters + date range combined, empty date range inputs.
- [ ] Task 5: Build the `CalendarView` wrapper (AC2, AC3, AC4, AC6)
  - [ ] Create `apps/web/src/features/events/CalendarView.tsx`: owns `week` URL state via `useQueryState('week', parseAsString.withDefault(<ISO date of the current week's start>))`; computes `weekStart`/`weekEnd` from it; calls `useGetEventsForCalendarQuery` with `buildWeeklyCalendarQueryCondition({ search: q, types, categories, weekStart, weekEnd })` (receiving `q`/`types`/`categories` as props from `home-content.tsx`, not re-reading the URL itself, to avoid duplicate URL-state ownership).
  - [ ] Flatten the query's events into a flat `schedules` array (each schedule annotated with its parent event's `id`/`slug`/`eventName`) for `WeeklyCalendarView`'s `schedules` prop.
  - [ ] Wire `onScheduleClick` to `router.push('/events/${schedule.eventSlug}?fromList=true&${searchParams.toString()}')` — identical mechanism to Card View's `getCardProps().onClick` in `home-content.tsx` (AC4).
  - [ ] Wire `onToday`/prev-week/next-week navigation to update the `week` URL param; `maxEventsPerDay={5}`.
  - [ ] Map the query's `status`/`error` to `WeeklyCalendarView`'s `status`/`errorMessage`/`errorDetail` props (AC6) — **not** separate `loading`/`error` props (corrected 2026-08-05 during Story 1.3g's creation: 1.3g's actual contract matches this story's own AC6, "`EventListView`'s `status` prop convention," not a `loading`/`error` boolean+object shape). Pass pre-translated `labels`, including `moreLabel: (count) => t('calendarMoreLabel', { count })` — a resolver **function**, not a static string, since the hidden-schedule count is only known inside `WeeklyCalendarView` per day cell (see Story 1.3g's Dev Notes → Consumer Story Sync Check) — and `closePopoverLabel: t('calendarClosePopoverLabel')` for Story 1.3g's "+N more" popover dismiss control.
  - [ ] `CalendarView.test.tsx`: loading/error/success rendering (via `status`), week navigation updates the URL and refetches, schedule click navigates with the full query string preserved (AC3, AC4, AC6).
- [ ] Task 6: Wire the second view into `home-content.tsx` (AC1, AC5)
  - [ ] Add a `'calendar'` entry to the `views` array passed to `EventDiscoveryPanel`: `{ id: 'calendar', label: t('viewSwitcherCalendarLabel'), icon: <CalendarDays />, content: <CalendarView q={q} types={types} categories={categories} /> }`, alongside the existing `'card'` entry (`{ id: 'card', label: t('viewSwitcherCardLabel'), icon: <LayoutGrid />, content: <EventListView ... /> }`, updated with its own new `label`/`icon`).
  - [ ] Add an `aria-live="polite"` `sr-only` region announcing the active view's label on change (AC5), matching `EventDetailWrapper`'s existing `liveMessage` pattern.
- [ ] Task 7: i18n (AD-6, AC7)
  - [ ] Add to `apps/web/locales/en.json` and `apps/web/locales/id.json`, `DiscoveryPage` namespace: `viewSwitcherCardLabel`, `viewSwitcherCalendarLabel`, `viewSwitcherAnnouncement` (interpolated with the active view's label), `calendarPrevWeekLabel`, `calendarNextWeekLabel`, `calendarTodayLabel`, `calendarMoreLabel` (ICU plural/interpolated with count), `calendarErrorState`, `calendarClosePopoverLabel` (added 2026-08-05 during Story 1.3g's creation — dismiss control for its "+N more" popover, which post-dates this story's original drafting).
  - [ ] Verify `apps/web/locales/locales.test.ts` (existing key-parity test) still passes with the new keys present in both files.
- [ ] Task 8: Accessibility verification (AC5; Story 1.3g's a11y ACs are 1.3g's own responsibility, this task verifies the *composition*)
  - [ ] Integration test: switching Card ↔ Calendar moves focus sensibly (not lost) and fires the `aria-live` announcement exactly once per switch.
  - [ ] Integration test: tab order flows Search → Filter → view-switcher → active view content, with no `tabIndex` override introduced by this story's wiring (mirroring Story 1.3e's AC6 composition-level check).
- [ ] Task 9: Regression verification
  - [ ] Run `apps/web/src/app/[locale]/page.test.tsx` against the refactored `home-content.tsx` — the existing single-view (`'card'`) assertions must still pass; only new calendar-specific assertions are additive.
  - [ ] If a genuine behavior drift surfaces (not a test-plumbing issue), fix the implementation — never relax the test's expected behavior to match a drifted implementation (matching Story 1.3e's Task 4 precedent).
- [ ] Task 10: Final checks
  - [ ] `pnpm build` / `pnpm lint` clean at the repo root.
  - [ ] `pnpm codegen` output committed (no stale generated types).

## Dev Notes

### Architecture & UX Gate Findings

This story went through three separate gate findings while being drafted — none absorbed into this story's own scope:

1. **Gate 3 (surfaced during Story 1.3e's creation, not this story's own drafting):** Story 1.3d's Out-of-Scope note incorrectly assumed "Calendar View is Epic 2 Story 2.6." That's wrong — Story 2.6 builds a separate, dedicated `/my-calendar` page for the user's own favorited/added-to-calendar events, not a card/calendar toggle for the Discovery feed's full filtered list. This gap became this story (originally scoped to include the calendar grid itself).
2. **Gate 2 (surfaced while drafting this story):** `DESIGN.md`'s `calendar` component tokens already define `event_rendering.discovery_view`/`event_rendering.personal_view` as two named variants of one shared component, and Story 2.6 (Epic 2, `backlog`) is a confirmed second, independently-scoped consumer of a weekly-calendar grid — meeting Gate 2's reuse-across-≥2-places bar directly from an authoritative UX artifact. **Split into new Story 1.3g** (`1-3g-build-the-reusable-weeklycalendarview-component`), which this story now depends on and consumes as a pure presentational primitive, rather than building the grid mechanics inline.
3. **Gate 1 (surfaced while drafting this story, after the user asked for the real query cost to be investigated rather than assumed):** The `events` resolver's existing `mainSchedulesOnly` join (`apps/backend/src/schema/resolvers.ts`) only ever joins each event's *main* schedule. A naive date-range filter on that joined column would silently miss any event whose *sub*-schedule (not main) falls in the requested week — a correctness gap, not a style choice. Fixing it correctly requires new backend surface area (an `EXISTS`-subquery DSL field mirroring the existing `isFavorited`/`isAddedToCalendar` pattern, a new DSL operator, and a `daterange`+GiST index migration) — genuinely new architecture, not an in-story task. **Split into new Story 1.3h** (`1-3h-extend-the-events-graphql-api-with-schedule-level-date-range-query-support`), which this story depends on for its week-scoped query.

An alternative to Gate 1's finding — fetching up to the existing 1000-event cap in one request and filtering the date range client-side, avoiding all backend changes — was explicitly presented to and rejected by the user in favor of exact per-week query correctness (`AskUserQuestion`, 2026-08-05). The overlap-condition logic itself (`scheduleStart <= weekEnd AND scheduleEnd >= weekStart`) was independently verified with the user to already be the complete interval-overlap test (no additional `OR` branch needed for the "spans the whole week" case — it's subsumed by the two inequalities, not a disjoint case).

All three splits, plus the EventDiscoveryPanel-contract-extension approach (Task 1) and the data-source approach (Task 4/5), were confirmed with the user via `AskUserQuestion` across multiple rounds on 2026-08-05 — see `### Design Decisions Confirmed With User` below.

**No further gap found** beyond the three above: this story introduces no other new API surface, no new resolver/mutation, and no other new project-wide tooling/foundation. `epic-1-readiness.md` (`swept: true`) covers the ordinary Epic 1 architecture/infra check for everything except the two fresh findings above, which the sweep predates.

### Design Decisions Confirmed With User (2026-08-05)

1. **Calendar grid reuse split (Gate 2):** confirmed — split into Story 1.3g rather than building the grid inline in this story.
2. **Switcher wiring:** confirmed — extend `EventDiscoveryPanel`'s contract (add `label`/`icon` to `views[]`, panel renders its own switcher) rather than building a fully separate `ViewSwitcher` component synced via a second, independent `useQueryState('view', ...)` call. Rationale: 1.3e is still unbuilt as of this decision, so amending its contract is cost-free, and it keeps `view`-state ownership in one place rather than two components racing to own the same URL key.
3. **Calendar data-fetching strategy (Gate 1):** confirmed, after two rounds of follow-up — a dedicated week-scoped backend query (new Story 1.3h), not a simpler large-`limit`/client-side-week-filter alternative. The user asked for, and received, a concrete explanation of why the naive backend approach (a plain date-range `WHERE` on the existing main-schedule join) is actually incorrect (misses sub-schedules), what the correct fix looks like (`EXISTS` subquery + `daterange`/GiST, mirroring the existing `isFavorited` pattern), and a review of the overlap-condition's correctness and performance characteristics, before choosing this path over the simpler alternative.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** The existing `getEvents` query (`apps/web/src/features/events/queries.graphql`) selects only `id, isMainSchedule, eventStartDate, ticketPrice` per schedule — it does not select `eventEndDate`, `eventStartTime`, or `eventEndTime`, which Calendar View needs (multi-day spanning, tooltip time display). The `Schedule` GraphQL type and the underlying `schedules` DB table (`packages/database/schema.ts`) already have these columns/fields — this is a query-selection gap, not a schema gap.
- **Impacted fields/contracts:** A **new** GraphQL operation, `getEventsForCalendar` (Task 4) — not a modification of the shared `getEvents` operation, to avoid Card View over-fetching fields it never uses (project-context.md's Optimized DB Queries rule). No changes to `EventQueryConditionInput` (its `operator: String` field already accepts Story 1.3h's new `overlaps` operator value with no breaking change).
- **Required DB migration changes:** None owned by this story — Story 1.3h owns the `daterange`+GiST index migration. This story adds no new columns/tables.
- **Required TypeScript type changes:** New generated types from `pnpm codegen` (`GetEventsForCalendarQuery` etc.) after Task 4's new `.graphql` operation is added. `EventDiscoveryPanelView` (packages/ui) gains `label`/`icon` fields (Task 1). `WeeklyCalendarView`'s schedule-shape type (defined by Story 1.3g) is consumed, not redefined, by this story's `CalendarView` wrapper mapping layer.
- **Backward compatibility and rollout notes:** Purely additive — the existing `getEvents` operation, `EventListView`, and Card View are untouched. `EventDiscoveryPanel`'s `views[]` contract gains new optional-at-the-type-level-but-required-in-practice fields (`label`/`icon`); Story 1.3/2.2's existing single-entry `views` usages must be updated to supply them (small, mechanical change — no behavior change since a single-entry `views` array renders no switcher).
- **Verification checks:** `buildWeeklyCalendarQueryCondition.test.ts` (packages/domain, 100% coverage); `CalendarView.test.tsx` integration test asserting the mapped schedule shape (including `eventEndDate`) reaches `WeeklyCalendarView` correctly; existing `page.test.tsx` regression pass confirms no drift in `EventListView`'s (Card View's) data shape.

### Component Contract Notes

`EventDiscoveryPanel.types.ts` extension (builds on Story 1.3e's contract — see that story's `Component Contract Summary` for the unchanged parts):

```ts
export interface EventDiscoveryPanelView {
  id: string;
  label: string;       // new — switcher button text, pre-translated
  icon?: ReactNode;     // new — optional switcher button icon
  content: ReactNode;
}
```

`CalendarView` (new, `apps/web/src/features/events/CalendarView.tsx`) mirrors `EventDetailWrapper`'s existing role: an `apps/web`-level wrapper owning data-fetching/URL-state/navigation around a pure `packages/ui` presentational component (`WeeklyCalendarView`, Story 1.3g), exactly as `home-content.tsx` itself does around `EventListView`. It is **not** a `packages/ui` component — it imports `next-intl`, GraphQL-generated types, and `next/navigation`, none of which are permitted in `packages/ui`.

### i18n Keys Required (AD-6)

New keys, `DiscoveryPage` namespace, both `en.json` and `id.json` (Task 7):
- `viewSwitcherCardLabel`, `viewSwitcherCalendarLabel` — switcher button text.
- `viewSwitcherAnnouncement` — `aria-live` text on view switch (interpolated with the newly active view's label).
- `calendarPrevWeekLabel`, `calendarNextWeekLabel`, `calendarTodayLabel` — passed into `WeeklyCalendarView`'s `labels` prop.
- `calendarMoreLabel` — "+N more" affordance text (interpolated with count).
- `calendarErrorState` — error message passed to `WeeklyCalendarView`'s `error` prop.

### Analytics Events Required (AD-5)

- `view_switched` — fired when the user changes between Card/Calendar View. Payload: `{ view: 'card' | 'calendar' }`.
- `calendar_week_navigated` — fired on prev/next/Today interaction. Payload: `{ direction: 'previous' | 'next' | 'today', weekStart: string }`.
- No change to existing `search_submitted`/`filter_applied`/`event_favorited`/`event_unfavorited`/`event_details_viewed` events — Calendar View's schedule click reuses the exact same `/events/[slug]` navigation/modal path as Card View, so `event_details_viewed` continues firing from `EventDetailWrapper` unchanged regardless of which view the click originated from.

### State Management Categorization

- **Server State (`@tanstack/react-query`):** `CalendarView` owns its own `useQuery`-style call (via the generated `useGetEventsForCalendarQuery` hook) for the week-scoped events — a single bounded fetch per week-change, not an infinite/paginated query (Calendar View's dataset is bounded by the visible week, unlike Card View's scroll-loaded list).
- **URL State (`nuqs`):** `week` (new, owned by `CalendarView`) and `view` (existing, owned by `EventDiscoveryPanel` per Story 1.3e) are both distinct URL keys with distinct owners — no overlap/race. `q`/`types`/`categories` remain owned by `home-content.tsx`, unchanged.
- **Client Global State (`zustand`):** none required.

### Loader Classification

Calendar View's initial week fetch and subsequent week-navigation fetches are **Non-Blocking** — a skeleton grid on initial load (matching `WeeklyCalendarView`'s `loading` state, Story 1.3g), not a full-screen blocking overlay, since neither is a critical mutation (project-context.md's Loaders rule). No infinite-scroll spinner is applicable here — Calendar View has no scroll-based pagination.

### Package boundaries

- `packages/ui/src/features/events/`: `EventDiscoveryPanel.tsx`/`EventDiscoveryPanel.types.ts` modified (switcher rendering, `label`/`icon` fields) — Task 1. `WeeklyCalendarView` itself is Story 1.3g's deliverable, consumed here, not built here.
- `packages/domain/src/events/`: new `buildWeeklyCalendarQueryCondition.ts` (Task 4) — pure, dependency-free, 100% unit tested, no DB/ORM imports (consistent with `buildEventsQueryCondition.ts`'s existing pattern).
- `apps/backend`: no changes owned by this story (Story 1.3h owns the resolver/DSL/migration changes this story depends on).
- `apps/web`: new `apps/web/src/features/events/CalendarView.tsx` + `CalendarView.test.tsx` (Task 5); new `getEventsForCalendar` operation in `apps/web/src/features/events/queries.graphql` (Task 4); modified `apps/web/src/app/[locale]/home-content.tsx` (Task 6); modified `apps/web/locales/en.json`/`id.json` (Task 7).

### Architecture / technical constraints

- **Unified Query DSL (AD-1):** `buildWeeklyCalendarQueryCondition` expresses its date-range condition through the DSL (via Story 1.3h's new `overlaps` operator on the same single `events` endpoint) — never a new single-purpose endpoint, per project-context.md's explicit rule.
- **Optimized DB Queries:** the new `getEventsForCalendar` operation is a distinct GraphQL document specifically so `buildOptimizedDrizzleSelect` only selects the extra schedule fields (`eventEndDate`/`eventStartTime`/`eventEndTime`) for Calendar View's request, not Card View's.
- **Framework-agnostic `packages/ui`:** `EventDiscoveryPanel`'s switcher extension and `WeeklyCalendarView` (Story 1.3g) both accept pre-translated strings/pre-built `ReactNode`s — no `next-intl`, no GraphQL-generated types, no React Query inside `packages/ui`, matching every sibling component in this family.
- **Accessibility (WCAG 2.1 AA):** view-switch `aria-live` announcement (AC5, Task 8); composition-level tab-order check (Task 8) mirroring Story 1.3e's AC6 precedent. `WeeklyCalendarView`'s own internal a11y (keyboard grid navigation, tooltip-on-focus) is Story 1.3g's responsibility, not re-verified at the unit level here — only the composed integration is this story's concern.

### Previous/Sibling Story Intelligence (Stories 1.3d, 1.3e, 1.3g, 1.3h, 1.6b)

- Story 1.3e (`EventDiscoveryPanel`) established the `views[]` registry seam this story's switcher extension builds directly on top of — see that story's Component Contract Summary and Package Boundaries for the unchanged base contract.
- Story 1.3d (`EventListView`) and Story 1.3e both established the "pure layout/presentational `packages/ui` component, `apps/web` wrapper owns data-fetching/callbacks" pattern this story's `CalendarView`/`WeeklyCalendarView` split follows identically.
- Story 1.6b (`useContextAwareListNavigation`, consumed via `apps/web/src/features/events/navigation-hook.ts`'s `useListNavigationForEvent`) already operates purely on flat `eventId` matching against a loaded `events` list — confirmed (via direct code reading, not assumption) to require zero changes for Calendar View's modal-click flow, since it has no awareness of card-vs-calendar layout.
- Story 1.3h (backend date-range query) and Story 1.3g (`WeeklyCalendarView` primitive) are both hard prerequisites this story consumes but does not itself implement — see Tasks 2/3.

### Project Structure Notes

- New: `apps/web/src/features/events/CalendarView.tsx`, `CalendarView.test.tsx`; `packages/domain/src/events/buildWeeklyCalendarQueryCondition.ts`, `buildWeeklyCalendarQueryCondition.test.ts`.
- Modified: `packages/ui/src/features/events/EventDiscoveryPanel.tsx`, `EventDiscoveryPanel.types.ts`, `EventDiscoveryPanel.test.tsx`; `apps/web/src/features/events/queries.graphql`; `apps/web/src/generated/graphql.ts` (codegen output); `apps/web/src/app/[locale]/home-content.tsx`; `apps/web/locales/en.json`, `apps/web/locales/id.json`.
- Not modified: `apps/backend/**` (owned by Story 1.3h), `packages/database/**` (owned by Story 1.3h), `WeeklyCalendarView.tsx` itself (owned by Story 1.3g, consumed as-is), `apps/web/src/features/events/navigation-hook.ts`/`EventDetailWrapper.tsx` (verified to need no changes, see Previous/Sibling Story Intelligence).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3f`, `#Story 1.3g`, `#Story 1.3h`, `#Story 1.3e`, `#Story 1.3d`, `#Story 2.6`]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`]
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`]
- [Source: `design-artifacts/D-Design-System/01-event-list-view.md`]
- [Source: `design-artifacts/UX-festgrid-run-1/DESIGN.md` (calendar component tokens, lines ~35-54)]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (Discovery/Calendar View description, lines ~83-93)]
- [Source: `apps/web/src/app/[locale]/home-content.tsx`]
- [Source: `apps/web/src/features/events/queries.graphql`, `navigation-hook.ts`, `EventDetailWrapper.tsx`]
- [Source: `apps/backend/src/schema/resolvers.ts` (`mainSchedulesOnly` join, `events` resolver `fieldMap`), `apps/backend/src/schema/events.graphql`]
- [Source: `packages/graphql-select/drizzle-where.ts`]
- [Source: `packages/domain/src/query/queryDsl.ts`, `packages/domain/src/events/buildEventsQueryCondition.ts`]
- [Source: `packages/database/schema.ts` (`schedules` table, `eventStartDate`/`eventEndDate`)]
- [Source: `apps/web/src/generated/graphql.ts` (`GetEventsQuery` schedule shape)]
- [Source: `apps/web/locales/en.json`, `id.json`, `locales.test.ts`]
- [Source: `_bmad-output/implementation-artifacts/1-3e-build-the-reusable-eventdiscoverypanel-component.md`, `1-3d-build-the-reusable-eventlistview-component.md`]

## Global Rules References

- `_bmad-output/project-context.md` (Unified Query DSL/AD-1, Optimized DB Queries, UI Patterns & UX Invariants, Code Organization, i18n rules, State Management Architecture)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
- `_bmad-output/planning-artifacts/epics.md` (Story 1.3f, Story 1.3g, Story 1.3h, Story 1.3e, Story 1.3d, Story 2.6)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/index.md`, `docs/infrastructure/2-backend.md` (no infra-shard changes owned by this story — the resolver/DSL work is Story 1.3h's; this story is a frontend integration consuming it)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `apps/web/src/features/events/CalendarView.tsx`, `CalendarView.test.tsx`.
- New: `packages/domain/src/events/buildWeeklyCalendarQueryCondition.ts`, `buildWeeklyCalendarQueryCondition.test.ts`.
- Modified: `packages/ui/src/features/events/EventDiscoveryPanel.tsx`, `EventDiscoveryPanel.types.ts`, `EventDiscoveryPanel.test.tsx` (switcher rendering).
- Modified: `apps/web/src/features/events/queries.graphql` (new `getEventsForCalendar` operation); `apps/web/src/generated/graphql.ts` (codegen, not hand-edited).
- Modified: `apps/web/src/app/[locale]/home-content.tsx` (second `views` entry, `aria-live` region).
- Modified: `apps/web/locales/en.json`, `apps/web/locales/id.json` (new `DiscoveryPage` keys).
- **Not modified by this story:** anything under `apps/backend/**`, `packages/database/**` (Story 1.3h); `packages/ui/src/features/events/WeeklyCalendarView*` (Story 1.3g); `apps/web/src/features/events/navigation-hook.ts`, `EventDetailWrapper.tsx` (verified unaffected).

### Rule Mapping

- *Unified Query DSL (AD-1)* → `buildWeeklyCalendarQueryCondition` composes through the DSL and Story 1.3h's new `overlaps` operator on the single `events` endpoint; no new single-purpose endpoint (Task 4).
- *Optimized DB Queries* → new `getEventsForCalendar` operation kept separate from `getEvents` so Card View never over-fetches calendar-only fields (Data Type Compatibility section, Task 4).
- *Code Organization (Domain vs UI)* → `buildWeeklyCalendarQueryCondition` in `packages/domain`, pure/dependency-free, 100% unit tested; `CalendarView` (data-fetching, `next-intl`, routing) in `apps/web`, not `packages/ui`.
- *State Management Architecture* → Server State (`CalendarView`'s query hook) / URL State (`week` via `nuqs`) categorized explicitly (State Management Categorization above).
- *i18n (AD-6)* → all new labels added to both `en.json`/`id.json` under `DiscoveryPage` (Task 7).
- *Analytics (AD-5)* → `view_switched`/`calendar_week_navigated` events specified (Analytics Events Required above).
- *Story-split-gate Gate 1* → backend date-range capability split into Story 1.3h rather than built inline; this story only consumes it (Task 2 verification gate).
- *Story-split-gate Gate 2* → calendar grid primitive split into Story 1.3g rather than built inline; this story only consumes it (Task 3 verification gate).
- *UI Patterns & UX Invariants (Loaders)* → Calendar View's fetch classified Non-Blocking/Skeleton, not a blocking overlay (Loader Classification above).

### Verification Plan

- `packages/domain`: `buildWeeklyCalendarQueryCondition.test.ts` — 100% coverage per project-context.md's domain testing rule.
- `packages/ui`: extended `EventDiscoveryPanel.test.tsx` — switcher rendering/omission, selection updates `view` URL param, keyboard operability.
- `apps/web`: new `CalendarView.test.tsx` — loading/error/success, week navigation + refetch, schedule-click navigation with preserved query string; existing `page.test.tsx` re-run for regression (Task 9); `locales.test.ts` continues passing with new keys.
- Manual: `pnpm build`/`pnpm lint`/`pnpm codegen` clean at the repo root; visually verify Card ↔ Calendar switching, week navigation, and schedule-click-to-modal on `/` locally.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: this story is integration-only — view-switcher wiring into `EventDiscoveryPanel`, the `CalendarView` data-fetching wrapper, and `home-content.tsx` wiring. It does **not** build the calendar grid itself (Story 1.3g) or the backend date-range query (Story 1.3h).
- [ ] **Prerequisite sequencing confirmed:** Story 1.3e (`EventDiscoveryPanel`), Story 1.3g (`WeeklyCalendarView`), and Story 1.3h (backend date-range query) must all be `done` before this story can be completed end-to-end. As of this story's creation, all three are `backlog`/`ready-for-dev` (unbuilt) — this is expected sequencing, not an accepted gap; confirm current status before starting `dev-story` on this story.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 3 (Story 2.6 misattribution) resolved by this story's existence. Gate 2 (calendar-grid reuse) resolved by splitting into Story 1.3g — confirmed by user. Gate 1 (backend date-range correctness) resolved by splitting into Story 1.3h, after the user requested and received a full technical walkthrough (main-schedule-join limitation, `EXISTS`+`daterange`/GiST fix, overlap-condition correctness, performance) before choosing this path over a simpler client-side-filter alternative — confirmed by user, 2026-08-05.
- [ ] **EventDiscoveryPanel contract-extension approach accepted:** switcher rendered by `EventDiscoveryPanel` itself (via `label`/`icon` on `views[]`) rather than a separate synced component — per explicit user decision.
- [ ] Architecture and data/API boundaries confirmed: this story adds a new GraphQL *operation* (not a new resolver/schema field) and a new `packages/domain` condition-builder function; no direct DB/ORM access from `apps/web`; no business logic in frontend code.
- [ ] Testing plan confirmed: new `CalendarView.test.tsx` (apps/web) and `buildWeeklyCalendarQueryCondition.test.ts` (packages/domain, 100% coverage); extended `EventDiscoveryPanel.test.tsx`; existing `page.test.tsx`/`locales.test.ts` must pass unmodified in their existing assertions.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/domain`: `buildWeeklyCalendarQueryCondition.test.ts` — 100% unit test coverage (mandatory for all `packages/domain` logic).
- `packages/ui`: `EventDiscoveryPanel.test.tsx` extended — switcher render/omit logic, selection behavior, keyboard operability.
- `apps/web`: `CalendarView.test.tsx` (new) — loading/error/success, week navigation, schedule-click navigation preserving `view`/`week`/`q`/`types`/`categories`. Composition-level integration tests (Task 8) for `aria-live` announcement and tab order. Existing `page.test.tsx` must continue passing unmodified in its existing assertions (Task 9) — the primary regression guard, since Card View must show zero visible behavior change.
- E2E (Playwright): one happy-path test covering the full flow — switch to Calendar View, navigate a week, click a schedule, confirm the modal opens with the correct event and the URL is deep-linkable (per project-context.md's "testing trophy" / Definition of Done for Testing rule requiring at least one E2E happy path for critical flows).
- Manual: `pnpm build`/`pnpm lint`/`pnpm codegen` clean at the repo root.

## Deliverables Checklist

- [ ] `EventDiscoveryPanel` renders a view-switcher when `views.length > 1`, with zero visible behavior change for existing single-view callers (Story 1.3/2.2).
- [ ] `CalendarView` wrapper built in `apps/web`, consuming Story 1.3g's `WeeklyCalendarView` and Story 1.3h's date-range query capability.
- [ ] New `getEventsForCalendar` GraphQL operation + `buildWeeklyCalendarQueryCondition` domain function, both tested.
- [ ] `home-content.tsx` wired with both `views[]` entries and an `aria-live` view-switch announcement.
- [ ] All new strings present in `en.json`/`id.json`, `locales.test.ts` passing.
- [ ] `pnpm build`/`pnpm lint`/`pnpm codegen` clean at the repo root.

## Out of Scope

- **Building `WeeklyCalendarView` itself** (grid mechanics, compact schedule cards, multi-day spanning, keyboard navigation, overflow capping) — Story 1.3g, a hard prerequisite this story consumes, not builds.
- **Building the backend schedule-level date-range query capability** (DSL `overlaps` operator, `EXISTS` subquery, `daterange`+GiST migration) — Story 1.3h, a hard prerequisite this story consumes, not builds.
- **Story 2.6 ("View and manage events on a calendar")** — the separate `/my-calendar` personal page. This story's `CalendarView` wrapper is Discovery-specific (`maxEventsPerDay: 5`, filtered by active search/type/category); Story 2.6, when drafted, will build its own `apps/web`-level wrapper around the same `WeeklyCalendarView` primitive with `maxEventsPerDay: -1` and favorited/added-to-calendar-scoped data — not built here.
- **Filter by Location (saved locations) and the "Nearby" default state** — unchanged from Stories 1.3d/1.3e's precedent, still no backing story.
- **`aria-live` result-count announcement on filter change** — Story 1.3e's own deferred WCAG gap, unrelated to this story's view-switch announcement (AC5), not addressed here.
- Any change to `EventListView`, `SearchBar`, `FilterHub`, or Card View's existing favorite-toggle/login-modal/optimistic-mutation logic — consumed unchanged.
- Any change to `useContextAwareListNavigation`/`useListNavigationForEvent`/`EventDetailWrapper` — verified (via direct code reading) to need no changes for Calendar View's modal-click flow; not modified here.

## Definition of Done

- Acceptance criteria satisfied.
- Required tests pass: `buildWeeklyCalendarQueryCondition.test.ts` (100% coverage), extended `EventDiscoveryPanel.test.tsx`, new `CalendarView.test.tsx`, existing `page.test.tsx`/`locales.test.ts` with no assertion changes, one E2E happy-path test.
- Lint and type checks pass for `packages/domain`, `packages/ui`, and `apps/web`.
- `pnpm codegen` output committed and consistent with the new `.graphql` operation.
- Manual visual/behavioral confirmation: Card ↔ Calendar switch, week navigation, and schedule-click-to-modal all work correctly on `/` locally, with no regression to Card View.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Story created via `bmad-create-story` at the user's explicit request (`/bmad-create-story 1-3f`).
- Three `AskUserQuestion` rounds were run before drafting, per this project's `bmad-create-story` customization requiring real design/architecture tradeoffs to be confirmed rather than silently picked: (1) whether the weekly-calendar grid should split into its own reusable primitive (Story 1.3g) given `DESIGN.md`'s `discovery_view`/`personal_view` token evidence — confirmed yes; (2) how the view-switcher should wire into `EventDiscoveryPanel`'s not-yet-built contract — confirmed: extend the contract directly; (3) how Calendar View should source week-scoped data, revised across two follow-up rounds after investigating the actual resolver code (`apps/backend/src/schema/resolvers.ts`) revealed the existing main-schedule-only join would silently miss sub-schedules under a naive date-range filter — confirmed: a dedicated backend query (new Story 1.3h), after a full technical walkthrough (correctness of the overlap condition, `EXISTS`+`daterange`/GiST approach, performance characteristics) rather than the simpler large-limit/client-filter alternative.
- Gate 2 (weekly-calendar-grid reuse) was run via a fresh subagent analysis (Freya's analytical lens) against `DESIGN.md`'s calendar tokens, `EXPERIENCE.md`, `01-event-list-view.md`, and Story 2.6's actual epics.md text — confirmed the split and additionally flagged keyboard-navigation and view-switch-a11y gaps, both folded into Story 1.3g's/this story's ACs respectively. Gate 1 (backend date-range correctness) and Gate 3 (Story 2.6 misattribution, inherited from Story 1.3e's own creation) were reasoned fresh via direct code investigation (not a subagent call) rather than the standard epic-1-readiness-sourced path, since both findings postdate that sweep.
- This story's own creation produced two new prerequisite stories (1.3g, 1.3h), both given full `epics.md` sections and `sprint-status.yaml` backlog entries, positioned immediately before this story in both files despite sorting alphabetically after it (`g`, `h` > `f`) — split-discovery order, not alphabetical order, determines file position per `story-split-gate.md`.
- **Amendment (2026-08-05, during Story 1.3g's own `bmad-create-story` creation):** Task 5 and Task 7 corrected — see inline notes at those tasks. Summary: (1) `WeeklyCalendarView`'s loading/error contract is `status`/`errorMessage`/`errorDetail` (matching this story's own AC6 and `epics.md`'s AC11 for 1.3g), not the `loading`/`error` prop names the original Task 5 draft used; (2) `labels.moreLabel` must be passed as a `(count) => string` closure wrapping `next-intl`'s ICU-plural `calendarMoreLabel`, not a pre-resolved string; (3) a new `calendarClosePopoverLabel` i18n key is required for Story 1.3g's "+N more" popover (a detail that postdates this story's original drafting). No AC or Task scope changed — Story 1.3g remains a hard prerequisite, unchanged in size.

### Completion Notes List

_To be filled by the dev agent._

### File List

_To be filled by the dev agent._
