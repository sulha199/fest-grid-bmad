---
baseline_commit: HEAD
---
# Story 2.6: View and manage events on a calendar

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.6
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see my "favorited" and "added to calendar" events on a dedicated calendar page, with each category visually distinguished and independently toggleable,
so that I can visualize my upcoming event schedule at a glance, per `EXPERIENCE.md`'s `/my-calendar` route and PRD §3.5/§3.6.

## Acceptance Criteria

1. **Given** I am not logged in, **when** I navigate to `/my-calendar`, **then** I am redirected to `/login` (same client-side auth-gate pattern as `/favorites`, Story 2.2 AC1) — no data is fetched.
2. **Given** I am logged in and navigate to `/my-calendar`, **when** the page loads, **then** I see a weekly calendar view (reusing `WeeklyCalendarView`, Story 1.3g) populated with every schedule, for the visible week, belonging to an event I have favorited and/or a schedule I have added to my calendar — `maxEventsPerDay: -1`, matching `DESIGN.md`'s `personal_view` token (no capping, unlike Discovery's Calendar View).
3. **And** I can navigate between weeks via Previous/Next/Today controls exactly as Discovery's Calendar View does; the visible week is reflected in the URL (`week`, `nuqs`) so it is shareable/deep-linkable and survives a page reload.
4. **And** "favorited" and "added to calendar" schedules have a distinct visual treatment: each compact card shows a small `Heart` icon badge when its parent event is favorited, and/or a `CalendarPlus` icon badge when that specific schedule is added to my calendar — a schedule can show both badges at once if both are true, reusing the same iconography already established for these two states in `EventCard`/`EventDetailView`.
5. **And** two independent visibility toggles — "Show favorited" and "Show added to calendar," both on by default — let me hide/show each category on the grid without a full page refetch; toggling filters the already-fetched week's schedules client-side, and both toggle states are reflected in the URL (`showFavorited`/`showAdded`, `nuqs`) for shareability. A schedule matching both categories remains visible as long as at least one toggle is on.
6. **And** activating a schedule's compact card opens the same event-detail modal used elsewhere (`/events/[slug]?fromList=true&...`, the `@modal/(.)events/[slug]` intercepting route), with the current URL's full query string (including `week`, `showFavorited`, `showAdded`) carried through, so returning from the modal restores the same calendar state.
7. **And** loading/error states follow `WeeklyCalendarView`'s existing Non-Blocking skeleton / caller-supplied-error-message pattern (`status` prop) — no full-screen blocking overlay, since this is not a critical mutation.
8. **And** all user-facing labels (toggle labels, badge `aria-label`s, nav/error copy, page title) are localized via next-intl (`en`/`id`) — no hardcoded user-facing strings.

**Note (AC correction vs. `epics.md`):** `epics.md`'s original Story 2.6 AC only says "I see a calendar view... distinct visual treatment... toggle visibility," with no mechanism detail. ACs 1, 3, 5, 6, 7 above were derived from direct code investigation (Story 1.3f/1.3g's already-shipped Discovery Calendar View, Story 2.2's `/favorites` auth-gate precedent) and are authoritative for this story going forward.

## Tasks / Subtasks

- [ ] Task 1: Extend `WeeklyCalendarView`'s contract with per-schedule visual badges (AC4) — `packages/ui`
  - [ ] Add optional `isFavorited?: boolean` and `isAddedToCalendar?: boolean` to `WeeklyCalendarViewScheduleShape` (`WeeklyCalendarView.types.ts`) — additive; Story 1.3f's Discovery `CalendarView` (this component's existing consumer) never sets these fields, so its rendering is byte-for-byte unchanged.
  - [ ] Add optional `favoritedBadgeLabel?: string` / `addedToCalendarBadgeLabel?: string` to `WeeklyCalendarViewLabels`, defaulting to plain English fallbacks (matching the component's existing `defaultLabels` pattern) if omitted.
  - [ ] In `WeeklyCalendarView.tsx`'s `CalendarCard` sub-component, import `Heart`/`CalendarPlus` from `lucide-react` (already used identically in `EventCard.tsx`/`EventDetailView.tsx` for the same two states) and render a small badge (icon only, `aria-label` from the new labels) inline before/beside the schedule title whenever `schedule.isFavorited`/`schedule.isAddedToCalendar` is true — both badges can render simultaneously.
  - [ ] Extend `WeeklyCalendarView.test.tsx`: a schedule with `isFavorited: true` renders the `Heart` badge, one with `isAddedToCalendar: true` renders the `CalendarPlus` badge, one with both renders both, and one with neither renders no badge (regression: Discovery's existing usage, which passes neither field, must keep rendering exactly as before).
  - [ ] Add a `favorited_badge`/`added_badge` note to `DESIGN.md`'s `calendar.event_rendering` tokens (repo hygiene, matching Story 1.3h's precedent of documenting new AD-1 tokens after implementation) — plain icon-only badges, no new color tokens (per the user's confirmed decision, see Dev Notes → Design Decisions Confirmed With User).

- [ ] Task 2: Add the reusable visibility-toggle primitive (AC5) — `packages/ui`
  - [ ] Add `packages/ui/src/core/checkbox.tsx` (+ `.types.ts`, `.test.tsx`): a minimal, accessible, hand-rolled toggle checkbox (label, `checked`, `onChange`, `aria-checked`/native `<input type="checkbox">` semantics) — following this codebase's established "hand-roll core primitives, no Radix/shadcn CLI dependency yet installed" precedent (`multi-select.tsx`, `blocking-loader.tsx`, `swipe-to-reveal.tsx` are all hand-rolled, not sourced from an actual Shadcn install — see Dev Notes → Architecture & UX Gate Findings). Export from `packages/ui/src/core/index.ts` (or the package's existing core barrel).
  - [ ] `Checkbox.test.tsx`: renders with label, `onChange` fires with the new checked state, keyboard-operable (Space toggles), correct ARIA attributes.

- [ ] Task 3: Add the week-scoped, favorites/calendar-additions-filtered GraphQL query (AC2, AC4) — `apps/web` + `packages/domain`
  - [ ] Add `packages/domain/src/events/buildMyCalendarQueryCondition.ts`: `buildMyCalendarQueryCondition({ weekStart, weekEnd }): QueryCondition` — composes `{ operator: 'or', conditions: [{ field: 'isFavorited', operator: 'eq', value: true }, { field: 'isAddedToCalendar', operator: 'eq', value: true }] }` AND'd (via the existing `and`/`isGroupCondition` pattern from `buildWeeklyCalendarQueryCondition.ts`) with `{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: weekStart, to: weekEnd } }`. 100% unit tested (project-context.md's `packages/domain` rule).
  - [ ] Add a new `getEventsForMyCalendar($limit: Int, $offset: Int, $query: EventQueryConditionInput)` operation to `apps/web/src/features/events/queries.graphql` (a new operation, not a reuse of `getEventsForCalendar` — avoids Discovery's Calendar View over-fetching `isFavorited`/schedule-level `isAddedToCalendar` it never uses, per project-context.md's Optimized DB Queries rule), selecting: `id, eventName, slug, imageUrl, location, types, categories, isFavorited`, and `schedules { id isMainSchedule eventStartDate eventEndDate eventStartTime eventEndTime ticketPrice isAddedToCalendar }`. Run `pnpm run codegen`.

- [ ] Task 4: Build the `/my-calendar` page and its data-fetching wrapper (AC1, AC2, AC3, AC5, AC6, AC7) — `apps/web`
  - [ ] New `apps/web/src/app/[locale]/my-calendar/page.tsx` (Server Component, `generateMetadata` via the `Metadata` i18n namespace + `apps/web/src/lib/metadata.ts` helper, mirroring `apps/web/src/app/[locale]/favorites/page.tsx` exactly) rendering a new colocated `my-calendar-content.tsx` (Client Component).
  - [ ] In `my-calendar-content.tsx`: auth gate via `useAuthSession()` (`router.push('/login')` if no session — AC1); `week` URL state via `useQueryState('week', parseAsString.withDefault(<today's ISO date>))` (mirroring `CalendarView.tsx`'s `getSunday`/`getSaturday` week-boundary helpers exactly); `showFavorited`/`showAdded` URL state via `useQueryState(..., parseAsBoolean.withDefault(true))` (AC5); call `useGetEventsForMyCalendarQuery` with `buildMyCalendarQueryCondition({ weekStart, weekEnd })`.
  - [ ] Flatten the query's events into a flat `schedules` array (each schedule annotated with its parent event's `id`/`slug`/`eventName`/`isFavorited`, plus its own `isAddedToCalendar`) for `WeeklyCalendarView`'s `schedules` prop; client-side filter the array by the two toggle states before passing it in (`schedule.isFavorited && showFavorited` OR `schedule.isAddedToCalendar && showAdded` — AC5's "at least one toggle keeps it visible" rule).
  - [ ] Render the two `Checkbox` toggles (Task 2) above the calendar grid, wired to `showFavorited`/`showAdded`.
  - [ ] Wire `onScheduleClick` to `router.push('/events/${schedule.eventSlug}?fromList=true&${searchParams.toString()}')` — identical mechanism to Discovery Calendar View's `CalendarView.tsx` (AC6).
  - [ ] Wire `onToday`/prev-week/next-week navigation to update the `week` URL param; `maxEventsPerDay={-1}`.
  - [ ] Map the query's `status`/`error` to `WeeklyCalendarView`'s `status`/`errorMessage`/`errorDetail` props (AC7), matching `CalendarView.tsx`'s established mapping exactly.
  - [ ] `my-calendar-content.test.tsx`: auth redirect, week navigation + refetch, toggle filtering (client-side, no refetch), schedule click navigates with the full query string preserved, loading/error/success rendering.

- [ ] Task 5: i18n (AD-6, AC8)
  - [ ] Add a new `MyCalendarPage` namespace to `apps/web/locales/en.json`/`id.json`: `title`, `calendarPrevWeekLabel`, `calendarNextWeekLabel`, `calendarTodayLabel`, `calendarMoreLabel` (ICU plural), `calendarErrorState`, `calendarClosePopoverLabel`, `showFavoritedLabel`, `showAddedToCalendarLabel`, `favoritedBadgeLabel`, `addedToCalendarBadgeLabel`.
  - [ ] Add `myCalendarTitle`/`myCalendarDescription` to the `Metadata` namespace (both files).
  - [ ] Verify `apps/web/locales/locales.test.ts` (existing key-parity test) still passes.

- [ ] Task 6: Analytics (AD-5)
  - [ ] Fire `my_calendar_page_viewed` (`{ visibleScheduleCount: number }`) once per successful week-data load, mirroring Story 2.2's `favorites_page_viewed` shape.
  - [ ] Reuse the existing `calendar_week_navigated` event (`{ direction, weekStart }`, already defined by Story 1.3f) for this page's own prev/next/Today controls — same event name, same payload shape, no new event needed.
  - [ ] Fire `calendar_visibility_toggled` (`{ filter: 'favorited' | 'addedToCalendar', visible: boolean }`) once per toggle interaction.

- [ ] Task 7: Testing (all ACs)
  - [ ] Integration tests per Task 4/Task 1/Task 2's enumerated coverage above.
  - [ ] One Playwright E2E happy-path test: log in → navigate to `/my-calendar` → see a favorited/added-to-calendar schedule with its badge → toggle "Show favorited" off → the favorited-only schedule disappears → click a still-visible schedule → modal opens with the correct event.
  - [ ] Manual: `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root.

- [ ] Task 8: Final checks
  - [ ] `pnpm build` / `pnpm lint` clean at the repo root.
  - [ ] `pnpm codegen` output committed.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.6` explicitly listed in `stories_covered`). No new backend/infra gap from the epic-wide sweep — all backend surface this story needs (`isFavorited`/`isAddedToCalendar` DSL fields and computed resolvers, `scheduleDateRange`/`overlaps`) already exists (Stories 2.1a, 1.3h), consumed unchanged.
  - **Lightweight escape-hatch guard (reasoned fresh, no subagent, per Epic-Level Sweep Mode):** the sweep's own "Anticipated Gate 2 note" flagged that no story wires the "Add to Calendar" trigger UI. Investigated directly (not assumed): confirmed true — `EventDetailView.onAddToCalendar` is presentation-only and unwired, and Story 2.1's/Story 2.1b's own Out-of-Scope notes both explicitly defer that wiring to this story. **Split into new Story 2.6b** (`2-6b-wire-the-add-to-calendar-trigger-dialog-and-ics-export`), positioned immediately before this story — see Note under Acceptance Criteria of that story for the full rationale. This story (2.6) consumes the resulting `isFavorited`/`isAddedToCalendar` data; it does not build the trigger itself.
- **Gate 2 (UI Complexity & Reusability):** Run fresh, informed directly by `DESIGN.md`'s `calendar` tokens (which define `personal_view: max_events_per_day: -1` but no favorited/added-to-calendar visual variant), `EXPERIENCE.md`'s `/my-calendar` route description, and `WeeklyCalendarView.tsx`'s actual current code (confirmed via direct read: it hardcodes one card style with no per-schedule variant hook). Two real gaps found and resolved via `AskUserQuestion` before drafting (see Design Decisions below):
  1. **Visual distinction (AC4):** `WeeklyCalendarView` (Story 1.3g, `review`, already consumed by Story 1.3f) has no mechanism to render a per-schedule visual variant. Judged a small, additive, backward-compatible extension to the existing component (Task 1) — not a new component — since Story 1.3f's existing usage never sets the new optional fields and its rendering is provably unaffected.
  2. **Visibility-toggle control (AC5):** no toggle/checkbox primitive exists anywhere in `packages/ui` today. Per `project-context.md`'s explicit, unconditional "Core Primitives... e.g. Shadcn `Button`, `Card`, generic `MultiSelect`... must be placed in `packages/ui/src/core/`" rule — which, unlike the "Domain Features" reuse-count bar, applies to base UI primitives regardless of current consumer count — this is built as a new `packages/ui/src/core/checkbox.tsx` primitive (Task 2), hand-rolled following this codebase's established precedent (`multi-select.tsx`/`blocking-loader.tsx`/`swipe-to-reveal.tsx` are all hand-rolled `packages/ui/src/core/` primitives, not sourced from an actual Shadcn CLI install — no Radix dependency exists in `packages/ui/package.json` despite `project-context.md`'s aspirational "built on Radix UI" description), not a page-local one-off component.
  3. **No further gap:** the "Add to Calendar" dialog (Story 2.6b) is a separate feature surfaced by a separate gate finding, not this story's own Gate 2 pass — see the escape-hatch guard above.

### Design Decisions Confirmed With User (2026-08-06)

Three real, non-mechanical tradeoffs were surfaced while drafting this story and confirmed via `AskUserQuestion` before finalizing scope/tasks:

1. **Add-to-Calendar trigger wiring:** split into a new prerequisite story (2.6b) rather than built inside this story — see Architecture & UX Gate Findings above and Story 2.6b's own Note.
2. **Add-to-Calendar mechanism** (governs what Story 2.6b builds, referenced here since it determines what data this story's query can assume exists): the full per-schedule dialog from `01.2-event-detail.md`, firing both `toggleCalendarAddition` and Story 2.1b's ICS export — not a simpler single-icon-instant-toggle.
3. **Visual distinction mechanism (AC4):** a small icon badge (`Heart`/`CalendarPlus`, reusing existing iconography from `EventCard`/`EventDetailView`) rendered inside the compact card, rather than inventing new background/border color tokens not specified anywhere in `DESIGN.md`.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No existing GraphQL operation selects both `Event.isFavorited` and per-schedule `Schedule.isAddedToCalendar` together with the schedule-level fields (`eventEndDate`/`eventStartTime`/`eventEndTime`) `WeeklyCalendarView` needs — `getEventsForCalendar` (Story 1.3f) selects the schedule fields but not `isFavorited`/`isAddedToCalendar`; `getEvents` selects `isFavorited` but not the calendar-specific schedule fields or per-schedule `isAddedToCalendar`. This is a query-selection gap, not a schema gap — both underlying GraphQL fields already exist (Story 2.1a) and require no resolver/schema change.
- **Impacted fields/contracts:** A **new** GraphQL operation, `getEventsForMyCalendar` (Task 3) — not a modification of `getEventsForCalendar` or `getEvents`, to avoid either existing consumer over-fetching fields it doesn't use (project-context.md's Optimized DB Queries rule). No changes to `EventQueryConditionInput` (its `operator: String`/`field: String` shape already accepts the `or`-grouped `isFavorited`/`isAddedToCalendar` condition with no breaking change). `WeeklyCalendarViewScheduleShape` (packages/ui) gains two new **optional** fields (Task 1) — additive, non-breaking to its existing consumer (Story 1.3f's `CalendarView`).
- **Required DB migration changes:** None — this story adds no tables/columns; it queries data Story 2.1a's/2.6b's mutations will populate.
- **Required TypeScript type changes:** New generated types (`GetEventsForMyCalendarQuery`/`useGetEventsForMyCalendarQuery`) after `pnpm run codegen` (Task 3); `packages/ui`'s `WeeklyCalendarViewScheduleShape`/`WeeklyCalendarViewLabels` type additions (Task 1); new `packages/ui/src/core/checkbox.tsx` component types (Task 2).
- **Backward compatibility and rollout notes:** Purely additive across every touched file — `WeeklyCalendarView`'s new optional schedule-shape fields default to `undefined`/falsy and render no badge when absent (Story 1.3f's existing usage is provably unaffected, verified by the added regression test in Task 1); the new GraphQL operation and `packages/domain` function are net-new, touching no existing operation's shape.
- **Verification checks:** `buildMyCalendarQueryCondition.test.ts` (packages/domain, 100% coverage); `WeeklyCalendarView.test.tsx`'s new badge-rendering cases including the "neither flag set → no badge, matches existing Discovery rendering" regression case; `my-calendar-content.test.tsx`'s mapped-schedule-shape assertion (including `isFavorited`/`isAddedToCalendar` reaching `WeeklyCalendarView` correctly); existing `CalendarView.test.tsx` (Story 1.3f) re-run for regression, confirming Discovery's Calendar View is visually unaffected by Task 1's changes.

### i18n Keys Required (AD-6)

New `MyCalendarPage` namespace (both `en`/`id`, Task 5): `title`, `calendarPrevWeekLabel`, `calendarNextWeekLabel`, `calendarTodayLabel`, `calendarMoreLabel`, `calendarErrorState`, `calendarClosePopoverLabel`, `showFavoritedLabel`, `showAddedToCalendarLabel`, `favoritedBadgeLabel`, `addedToCalendarBadgeLabel`. New `Metadata` namespace keys: `myCalendarTitle`, `myCalendarDescription`.

### Analytics Events Required (AD-5)

- `my_calendar_page_viewed` — `{ visibleScheduleCount: number }`, fired once per successful week-data load.
- `calendar_visibility_toggled` — `{ filter: 'favorited' | 'addedToCalendar', visible: boolean }`, fired per toggle interaction.
- Reuses the existing `calendar_week_navigated` event (Story 1.3f) unchanged for this page's own week navigation — no new event definition needed.

### State Management Categorization

- **Server State (`@tanstack/react-query` + `graphql-request`):** `my-calendar-content.tsx` owns a single bounded `useGetEventsForMyCalendarQuery` call per week-change (identical shape to `CalendarView.tsx`'s Server State categorization).
- **URL State (`nuqs`):** `week` (mirrors `CalendarView.tsx`'s pattern exactly), plus new `showFavorited`/`showAdded` boolean params (AC5) — three distinct, independently-owned URL keys, no overlap with any other page's state.
- **Client Global State (`zustand`):** none required — the two toggle states are simple, shareable, URL-appropriate booleans, not ephemeral cross-component UI state.

### Loader Classification

Matches `CalendarView.tsx`'s existing classification exactly: the initial week fetch and subsequent week-navigation fetches are **Non-Blocking** (a skeleton grid, via `WeeklyCalendarView`'s own `status === 'loading'` state) — never a full-screen `BlockingLoader`, since neither is a critical mutation. Toggling visibility is a client-side, synchronous re-filter with no loading state at all (no refetch is triggered).

### Package boundaries

- `packages/ui/src/features/events/`: `WeeklyCalendarView.tsx`/`WeeklyCalendarView.types.ts`/`WeeklyCalendarView.test.tsx` modified (Task 1) — additive only.
- `packages/ui/src/core/`: new `checkbox.tsx`/`checkbox.types.ts`/`checkbox.test.tsx` (Task 2), exported from the package's core barrel.
- `packages/domain/src/events/`: new `buildMyCalendarQueryCondition.ts`/`.test.ts` (Task 3) — pure, dependency-free, 100% unit tested, no DB/ORM imports, matching `buildWeeklyCalendarQueryCondition.ts`'s established pattern exactly.
- `apps/backend`: no changes owned by this story — all backend surface (`isFavorited`/`isAddedToCalendar`/`scheduleDateRange`) already exists (Stories 2.1a, 1.3h).
- `apps/web`: new `my-calendar/page.tsx`, `my-calendar-content.tsx`, `my-calendar-content.test.tsx` (Task 4); new `getEventsForMyCalendar` operation in `queries.graphql` (Task 3); modified `apps/web/locales/en.json`/`id.json` (Task 5).

### Architecture / technical constraints

- **Unified Query DSL (AD-1) / Unified Event Querying (AD-2):** `buildMyCalendarQueryCondition` expresses its `isFavorited`/`isAddedToCalendar`/`scheduleDateRange` conditions entirely through the existing DSL and the single `events` endpoint — no new single-purpose endpoint, per project-context.md's explicit rule and matching `getEventsForCalendar`'s (Story 1.3f) identical precedent.
- **Optimized DB Queries:** the new `getEventsForMyCalendar` operation is kept distinct from both `getEvents` and `getEventsForCalendar` specifically so neither existing consumer over-fetches this page's calendar-specific/personalization fields.
- **Framework-agnostic `packages/ui`:** `WeeklyCalendarView`'s badge extension (Task 1) and the new `Checkbox` primitive (Task 2) accept pre-translated strings and plain booleans/callbacks — no `next-intl`, no GraphQL-generated types, no React Query inside `packages/ui`, matching every sibling component in this family.
- **AD-7 (Authenticated Context):** `isFavorited`/`isAddedToCalendar` already degrade to `false`/empty for unauthenticated callers (Story 2.1a); this story's own client-side `/login` redirect (AC1) is a UX layer on top, not a substitute for server-side enforcement.
- **Accessibility (WCAG 2.1 AA):** badges carry `aria-label`s (Task 1); the new `Checkbox` primitive is keyboard-operable with correct ARIA semantics (Task 2) — both verified by their respective test suites.

### Previous/Sibling Story Intelligence (Stories 1.3f, 1.3g, 2.1a, 2.2, 2.6b)

- Story 1.3f's `CalendarView.tsx` (Discovery's week-scoped wrapper) is the direct implementation template for this story's `my-calendar-content.tsx` — same `week` URL-state pattern, same `status`/`errorMessage`/`errorDetail` mapping, same `onScheduleClick` navigation mechanism. The only structural differences: no search/type/category filtering (this page has none, per `epics.md`'s AC text), `maxEventsPerDay: -1` instead of `5`, and the new `showFavorited`/`showAdded` toggle state.
- Story 2.2's `/favorites` route (auth-gate-then-redirect pattern, `Server Component page.tsx` + `Client Component content.tsx` split, `generateMetadata` via the `Metadata` namespace) is the direct implementation template for this story's `/my-calendar` route structure.
- Story 1.3g's `WeeklyCalendarView` is consumed here as its confirmed **second** consumer, exactly as anticipated in that story's own Out-of-Scope note ("Story 2.6's 'My Calendar' page — a future second consumer of this same component... Story 2.6 should re-confirm/adjust against this story's actual shipped contract when it is drafted" — done here, Task 1).
- Story 2.1a's `Event.isFavorited`/`Event.isAddedToCalendar`/`Schedule.isAddedToCalendar` computed fields, and its own Dev Notes' explicit forward-reference ("Story 2.2 (Favorites page) and Story 2.6 (My Calendar) are expected to call `events` with `{ field: "isFavorited"... }` / `{ field: "isAddedToCalendar"... }`"), are consumed here exactly as anticipated.
- Story 2.6b (this story's direct prerequisite, `ready-for-dev`) must be `done` before this story's data can be non-empty for the "added to calendar" half — see Pre-Coding Approval Gate.

### Project Structure Notes

- New: `apps/web/src/app/[locale]/my-calendar/page.tsx`, `my-calendar-content.tsx`, `my-calendar-content.test.tsx`.
- New: `packages/domain/src/events/buildMyCalendarQueryCondition.ts` (+ test).
- New: `packages/ui/src/core/checkbox.tsx`, `checkbox.types.ts`, `checkbox.test.tsx`.
- Modified: `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts`, `WeeklyCalendarView.test.tsx` (additive badge support); `packages/ui/src/core/index.ts` (new `Checkbox` export).
- Modified: `apps/web/src/features/events/queries.graphql` (new `getEventsForMyCalendar` operation); `apps/web/src/generated/graphql.ts` (codegen output); `apps/web/locales/en.json`, `id.json`; `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`/`DESIGN.md` (badge token documentation, Task 1).
- Not modified: `apps/backend/**`, `packages/database/**` — all backend surface already exists.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.6`, `#Story 2.6b`, `#Story 1.3f`, `#Story 1.3g`, `#Story 2.1a`, `#Story 2.2`]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`]
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`]
- [Source: `design-artifacts/UX-festgrid-run-1/DESIGN.md` (`calendar.event_rendering.personal_view` token)]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (`/my-calendar` route, Global Navigation table)]
- [Source: `apps/web/src/features/events/CalendarView.tsx`, `CalendarView.test.tsx` (Story 1.3f — direct implementation template)]
- [Source: `apps/web/src/app/[locale]/favorites/page.tsx`, `favorites-content.tsx` (Story 2.2 — route-structure/auth-gate template)]
- [Source: `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts` (Story 1.3g)]
- [Source: `packages/domain/src/events/buildWeeklyCalendarQueryCondition.ts` (Story 1.3f — composition pattern template)]
- [Source: `apps/backend/src/schema/resolvers.ts` (`isFavorited`/`isAddedToCalendar` fieldMap and computed-field resolvers, Story 2.1a)]
- [Source: `_bmad-output/implementation-artifacts/2-6b-wire-the-add-to-calendar-trigger-dialog-and-ics-export.md` (direct prerequisite)]

## Global Rules References

- `_bmad-output/project-context.md` (Unified Query DSL/AD-1, Optimized DB Queries, UI Components & Scalability/Core Primitives, Code Organization, i18n rules, State Management Architecture, UI Patterns & UX Invariants/Loaders)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-5, AD-6, AD-7)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.6, Story 2.6b, Story 1.3f, Story 1.3g, Story 2.1a, Story 2.2)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/index.md` (frontend-only story, no infra-shard changes — all backend surface already exists)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `apps/web/src/app/[locale]/my-calendar/page.tsx`, `my-calendar-content.tsx`, `my-calendar-content.test.tsx`.
- New: `packages/domain/src/events/buildMyCalendarQueryCondition.ts`, `buildMyCalendarQueryCondition.test.ts`.
- New: `packages/ui/src/core/checkbox.tsx`, `checkbox.types.ts`, `checkbox.test.tsx`.
- Modified: `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts`, `WeeklyCalendarView.test.tsx`; `packages/ui/src/core/index.ts`.
- Modified: `apps/web/src/features/events/queries.graphql`; `apps/web/src/generated/graphql.ts` (codegen); `apps/web/locales/en.json`, `id.json`; `DESIGN.md` (badge documentation).
- **Not modified by this story:** `apps/backend/**`, `packages/database/**` (all needed backend surface already exists); Story 2.6b's own files (consumed as a hard prerequisite, not built here).

### Rule Mapping

- *Unified Query DSL (AD-1) / Unified Event Querying (AD-2)* → `buildMyCalendarQueryCondition` composes through the existing DSL and single `events` endpoint; no new endpoint (Task 3).
- *Optimized DB Queries* → distinct `getEventsForMyCalendar` operation avoids over-fetching on both `getEvents` and `getEventsForCalendar` (Data Type Compatibility section, Task 3).
- *UI Components & Scalability (Core Primitives)* → new `Checkbox` primitive placed in `packages/ui/src/core/`, matching project-context.md's unconditional Shadcn-primitive placement rule (Task 2).
- *Code Organization (Domain vs UI)* → `buildMyCalendarQueryCondition` in `packages/domain`, pure/dependency-free, 100% unit tested; `my-calendar-content.tsx` (data-fetching, `next-intl`, routing) stays in `apps/web`.
- *State Management Architecture* → Server State (query hook) / URL State (`week`, `showFavorited`, `showAdded` via `nuqs`) explicitly categorized (State Management Categorization above).
- *i18n (AD-6)* → all new labels added to both `en.json`/`id.json` under a new `MyCalendarPage` namespace (Task 5).
- *Analytics (AD-5)* → `my_calendar_page_viewed`/`calendar_visibility_toggled` specified; `calendar_week_navigated` reused unchanged (Analytics Events Required above).
- *Story-split-gate Gate 2* → visual-badge extension kept additive/backward-compatible on the existing `WeeklyCalendarView` (Task 1); new `Checkbox` primitive correctly placed per the Core Primitives rule, not a page-local one-off (Task 2); the separate Add-to-Calendar-trigger gap split into Story 2.6b rather than absorbed here (Architecture & UX Gate Findings above).
- *UI Patterns & UX Invariants (Loaders)* → week-fetch classified Non-Blocking/Skeleton; toggle filtering has no loading state at all (Loader Classification above).

### Verification Plan

- `packages/domain`: `buildMyCalendarQueryCondition.test.ts` — 100% coverage per project-context.md's domain testing rule.
- `packages/ui`: extended `WeeklyCalendarView.test.tsx` (badge rendering + regression), new `checkbox.test.tsx`.
- `apps/web`: new `my-calendar-content.test.tsx` — auth redirect, week navigation, client-side toggle filtering, schedule-click navigation with preserved query string, loading/error/success rendering; existing `CalendarView.test.tsx` (Story 1.3f) re-run for regression, confirming Discovery's Calendar View is visually unaffected.
- E2E (Playwright): one happy-path test per Task 7.
- Manual: `pnpm build`/`pnpm lint`/`pnpm codegen` clean at the repo root; visually verify badge rendering, toggle filtering, and week navigation on `/my-calendar` locally.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: this story builds the `/my-calendar` viewing page (weekly grid, visual badges, visibility toggles, week navigation) — it does **not** build the "Add to Calendar" trigger/dialog (Story 2.6b) or any backend/resolver work (already complete via Story 2.1a/1.3h).
- [ ] **Prerequisite sequencing confirmed:** Story 2.6b (`ready-for-dev`) is a hard prerequisite for this story's "added to calendar" data to ever be non-empty in practice — confirm its status before starting `dev-story` on this story, or explicitly accept testing this story against seeded/GraphiQL-inserted `calendar_additions` rows in the interim.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md`, no gap applicable beyond the already-split Story 2.6b. Gate 2 run fresh — visual-badge extension (additive to Story 1.3g) and new `Checkbox` core primitive, both confirmed via `AskUserQuestion`; see Architecture & UX Gate Findings and Design Decisions Confirmed With User above.
- [ ] **Visual distinction mechanism accepted:** icon badges (`Heart`/`CalendarPlus`), not new color/border tokens — per explicit user decision, 2026-08-06.
- [ ] Architecture and data/API boundaries confirmed: this story adds one new GraphQL *operation* (not a new resolver/schema field) and one new `packages/domain` condition-builder function; no direct DB/ORM access from `apps/web`; no business logic in frontend code.
- [ ] Testing plan confirmed: new `my-calendar-content.test.tsx`, `buildMyCalendarQueryCondition.test.ts` (100% coverage), extended `WeeklyCalendarView.test.tsx`, new `checkbox.test.tsx`; existing `CalendarView.test.tsx` must pass unmodified in its existing assertions.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/domain`: `buildMyCalendarQueryCondition.test.ts` — 100% unit test coverage (mandatory for all `packages/domain` logic).
- `packages/ui`: extended `WeeklyCalendarView.test.tsx` (badge rendering, regression against Discovery's unaffected usage); new `checkbox.test.tsx`.
- `apps/web`: `my-calendar-content.test.tsx` (new) — auth redirect, week navigation, client-side toggle filtering, schedule-click navigation preserving `week`/`showFavorited`/`showAdded`. Existing `CalendarView.test.tsx` must continue passing unmodified in its existing assertions — the primary regression guard for Story 1.3f's Discovery Calendar View.
- E2E (Playwright): one happy-path test covering the full flow — log in, view `/my-calendar`, see a badge, toggle visibility off/on, click a schedule, confirm the modal opens with the correct event and the URL is deep-linkable.
- Manual: `pnpm build`/`pnpm lint`/`pnpm codegen` clean at the repo root.

## Deliverables Checklist

- [ ] `/my-calendar` page: auth-gated, renders `WeeklyCalendarView` with `maxEventsPerDay: -1`, populated from favorited/added-to-calendar schedules for the visible week.
- [ ] Week navigation (Previous/Next/Today) reflected in the `week` URL param.
- [ ] Distinct visual treatment: `Heart`/`CalendarPlus` icon badges rendered per-schedule, both simultaneously when applicable.
- [ ] Two independent visibility toggles (`showFavorited`/`showAdded`), URL-reflected, client-side-filtered with no refetch.
- [ ] Schedule click opens the existing event-detail modal with full query-string preservation.
- [ ] New `getEventsForMyCalendar` GraphQL operation + `buildMyCalendarQueryCondition` domain function, both tested.
- [ ] New `packages/ui/src/core/checkbox.tsx` primitive, tested.
- [ ] All new strings present in `en.json`/`id.json` (`MyCalendarPage`/`Metadata` namespaces); `locales.test.ts` passing.
- [ ] `pnpm build`/`pnpm lint`/`pnpm codegen` clean at the repo root.

## Out of Scope

- **The "Add to Calendar" trigger, schedule-selection dialog, and native ICS export** — Story 2.6b, a hard prerequisite this story consumes, not builds.
- **Any backend/resolver/schema work** — `isFavorited`/`isAddedToCalendar`/`scheduleDateRange` already fully exist (Stories 2.1a, 1.3h); this story is frontend-only (plus one `packages/domain` function and one `packages/ui` primitive).
- **Search/filter on the My Calendar page** — `epics.md`'s AC text for this story specifies no search/filter capability (unlike Story 2.2's Favorites page); not added here to avoid unrequested scope.
- **Past-event auto-hiding** — Story 2.7 (not yet built) will apply a global default-visibility rule across all event views including this one, once it lands; no action needed from this story today.
- **New background/border color tokens for favorited/added-to-calendar states** — evaluated and explicitly rejected in favor of icon badges (see Design Decisions Confirmed With User).
- **A generic, reusable `packages/ui` Dialog/Popover primitive beyond the existing `WeeklyCalendarView`-internal one** — unrelated to this story's scope.

## Definition of Done

- All 8 Acceptance Criteria satisfied.
- Required tests passing: `buildMyCalendarQueryCondition.test.ts` (100% coverage), extended `WeeklyCalendarView.test.tsx`, new `checkbox.test.tsx`, new `my-calendar-content.test.tsx`, existing `CalendarView.test.tsx` with no assertion changes, one E2E happy-path test.
- Lint and type checks pass for `packages/domain`, `packages/ui`, and `apps/web`.
- `pnpm codegen` output committed and consistent with the new `.graphql` operation.
- Manual visual/behavioral confirmation: badge rendering, toggle filtering, and week navigation all work correctly on `/my-calendar` locally, with no regression to Discovery's Calendar View.
- No decrease in overall project test coverage.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Story created via `bmad-create-story` at the user's explicit request (`/bmad-create-story 2-6`).
- Three `AskUserQuestion` rounds were run before drafting, per this project's `bmad-create-story` customization requiring real architecture/UX tradeoffs to be confirmed rather than silently picked: (1) whether the "Add to Calendar" trigger wiring belongs in this story or a new prerequisite story — confirmed split, new Story 2.6b; (2) what the Add-to-Calendar mechanism should actually do, given a conflict between `EventDetailView`'s already-built single-icon-toggle UI and `01.2-event-detail.md`'s dialog+checkbox+native-export description — confirmed the full per-schedule dialog with both effects (governs Story 2.6b, referenced here since it determines this story's data assumptions); (3) how to visually distinguish favorited/added-to-calendar schedules on the calendar grid, given `WeeklyCalendarView` has no existing hook for it and `DESIGN.md` defines no token for it — confirmed icon badges over new color tokens.
- Gate 2 (visual-badge extension, new `Checkbox` core primitive) was reasoned directly from `DESIGN.md`/`WeeklyCalendarView.tsx`'s actual code and `project-context.md`'s explicit Core Primitives placement rule, rather than a subagent dispatch, since both findings were mechanically verifiable from direct file reads. Gate 1/3 cited from the swept `epic-2-readiness.md` report; its own "Anticipated Gate 2 note" (the Add-to-Calendar trigger gap) was investigated directly and resolved via the Story 2.6b split.
- While investigating the Add-to-Calendar mechanism, discovered that `sonner` (a toast library) was added to this codebase by Story 0.18, after Story 2.1's/Story 2.2's "no toast library exists" findings — this superseded fact was corrected directly in Story 2.6b's draft (which now uses `toast.success(...)` rather than repeating the now-outdated `aria-live`-only workaround).

### Completion Notes List

_To be filled by the dev agent._

### File List

_To be filled by the dev agent._
