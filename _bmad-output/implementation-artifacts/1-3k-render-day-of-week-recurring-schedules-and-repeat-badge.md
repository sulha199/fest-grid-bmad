# Story 1.3k: Render Day-of-Week Recurring Schedules and the Repeat Badge Across Calendar and Card Surfaces

## Story Details

- Epic: 1
- Story ID: 1.3k
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Discovery/Calendar user,
I want a schedule that only recurs on specific weekdays within its date span (e.g. "every Monday, Sep 7–28") to render only on those matching days, with a clear visual marker distinguishing it from a genuine one-off event or multi-day span,
so that the calendar and card surfaces accurately reflect which days an event actually occurs on, instead of implying it happens every day inside its full date range.

## Acceptance Criteria

1. **`getDays` exported and generalized (AD-19 Rule 1).** Given `packages/domain/src/events/buildEventsQueryCondition.ts`'s module-local `getDays(fromStr, toStr, dow: DayOfWeek | string)`, when generalized, then it is `export`ed and its signature becomes `getDays(fromStr: string, toStr: string, dow: DayOfWeek[]): string[]`, returning every date in `[fromStr, toStr]` whose weekday matches **any** member of `dow` (a union over the array, not just one weekday). The existing `EventFilterInput.dayOfWeek` call site inside the same file (`buildEventsQueryCondition`, ~line 114) is updated to wrap its single value as a 1-element array (`getDays(r.from, r.to, [filter.dayOfWeek])`), with **zero behavior change** to today's single-weekday filter matching — regression-verified by the existing `buildEventsQueryCondition.test.ts` suite passing unmodified.

2. **Explicit `Record`-based enum mapping at the GraphQL/domain boundary (AD-19 Rule 2).** Given the GraphQL-generated `DayOfWeek` enum (`apps/web/src/generated/graphql.ts`) and `packages/domain`'s own `DayOfWeek` enum (`packages/domain/src/events/buildEventsQueryCondition.ts:7`, already `export`ed), when a schedule's `applicableDaysOfWeek` — which arrives client-side typed as the GraphQL-generated enum — must be converted before being passed to the shared `getDays`/occurrence logic, then a new `apps/web/src/lib/day-of-week-mapping.ts` module exports an explicit `Record<GqlDayOfWeek, DomainDayOfWeek>` object mapping every member (`GQL_TO_DOMAIN_DAY_OF_WEEK`) plus a small `mapDaysOfWeekToDomain(days: GqlDayOfWeek[] | null | undefined): DomainDayOfWeek[] | undefined` helper. **Never** an implicit cast or reliance on the two enums' string values coincidentally matching. Verify TypeScript's exhaustiveness checking actually fires (temporarily delete one `Record` entry during dev and confirm a compile error; do not ship the deletion).

3. **`Schedule.applicableDaysOfWeek` becomes real, queryable data.** Given `Schedule.applicableDaysOfWeek?: DayOfWeek[]` is a PRD-decided field (PRD §4.4, BUG-026's 2026-09-11 amendment) that **does not exist yet in the DB or GraphQL schema** (verified: `packages/database/schema.ts`'s `schedules` table has no such column; `apps/backend/src/schema/events.graphql`'s `Schedule` type has no such field), when this story ships, then:
   - `packages/database/schema.ts`'s `schedules` table gains a nullable `applicableDaysOfWeek: text('applicable_days_of_week').array()` column — matching the existing `events.types`/`events.categories` free-form-text-array convention ("expect values from the enum", not a strict Postgres enum type) — shipped as a Drizzle-kit-generated SQL migration file checked into `packages/database/migrations/` (next sequential number after `0058_nice_liz_osborn.sql`).
   - `apps/backend/src/schema/events.graphql`'s `Schedule` type gains `applicableDaysOfWeek: [DayOfWeek!]`.
   - **Zero new resolver code**: `Event.schedules`'s existing resolver (`apps/backend/src/schema/resolvers.ts` ~3624-3629) already calls `buildOptimizedDrizzleSelect(schedules, info)`, which generically maps any requested GraphQL field to its matching Drizzle column — the identical mechanism Story 0.37's `Event.links` and the `Event.publishedAt` field used. Confirm this passthrough actually returns the new field with an integration test; do not hand-write a field resolver.
   - This is **read-only, additive-field scope only** — explicitly **out of scope**: the AI-extraction prompt/schema populating real `applicableDaysOfWeek` values, and `buildEventsQueryCondition.ts`/`drizzle-where.ts`'s `dayOfWeek` filter *matching correctness* fix. Both remain BUG-026's own still-open, deliberately-deferred items (see backlog.yaml `BUG-026`). Seed/test data may set this column directly for verification.

4. **`dayBuckets` narrows occurrences by weekday when set (EXPERIENCE.md "Day-of-Week Recurring Schedules").** Given `WeeklyCalendarView.tsx`'s `dayBuckets` `useMemo` (currently: a schedule occupies every day in `[eventStartDate, eventEndDate]`), when a schedule's (already domain-mapped) `applicableDaysOfWeek` is set and non-empty, then only days whose weekday is a member of that list count as occurrences — computed via the shared `getDays` utility (Task 1/AC1), never a second reimplementation of weekday matching in `packages/ui`. A schedule with `applicableDaysOfWeek` unset or empty behaves exactly as today (every day in range is an occurrence) — **zero behavior change for legacy/default schedules**, regression-verified by the existing `WeeklyCalendarView.test.tsx` suite passing unmodified.

5. **`isFirstSegment`/`isLastSegment` generalize to per-run adjacency.** Given a schedule's narrowed occurrence set (AC4), when `isFirstSegment`/`isLastSegment` are computed for a bucketed day, then they are `true` when the immediately adjacent calendar day (±1) is **not also an occurrence** of that schedule — evaluated against the schedule's full occurrence set, including days outside the currently visible 7-day week (a pattern can start/continue before or after the displayed week; do not special-case the week boundary as an implicit run edge). Calendar-adjacent occurrence days collapse into one run rendered identically to today's plain multi-day span (same rounding classes, same badge mechanism); non-adjacent occurrences render as isolated single-day segments, identical in shape to a genuine one-off single-day event. The mobile list variant's "Day X of N" (`multiDayBadgeText`/`diffInDays` math, ~line 859-866) is computed from **the run's own first/last occurrence day**, never the schedule's overall `eventStartDate`/`eventEndDate` span (e.g. "Day 1 of 2"/"Day 2 of 2" for a Mon+Tue run inside a 30-day span, never "Day 1 of 30").

6. **Masonry `EventCard` repeat badge.** Given the masonry `EventCard` variant, when its displayed schedule (`EventListView.tsx`'s `displaySchedule`) has `applicableDaysOfWeek` set and non-empty, then the new icon-only `event_card_repeat_badge` (lucide `Repeat`, DESIGN.md token, `w-3.5 h-3.5 text-muted-foreground shrink-0`, no fill/pill background) renders in `badge_row` immediately after the status badge and before the nearby badge (order: status → repeat → nearby). It always carries an `aria-label` listing the schedule's translated matching weekdays (present regardless of hover state, for screen-reader/touch users), and shows the same content in a hover+focus-triggered tooltip when the card's own root (`RootTag`) is hovered/focused — see Dev Notes "Tooltip trigger resolution" for why the badge icon itself must **not** be an independent focus stop.

7. **Calendar Row Card (`variant='list'`) repeat badge.** Given `WeeklyCalendarView.tsx`'s `CalendarCard` in `variant='list'` (the mobile day-list), when its schedule has `applicableDaysOfWeek` set and non-empty, then the same repeat badge renders in the existing leading-icon-then-title row (alongside the `isFavorited`/`isAddedToCalendar` icons, ~line 900-908), before the title text, **outside** the title's own `truncate` span so it is never clipped. Tooltip/aria-label content and behavior match AC6, triggered off the card's own schedule-click `<button>` (not an independent nested focus stop).

8. **Calendar Grid Item Card (`variant='grid'`) repeat badge.** Given `CalendarCard` in `variant='grid'` (desktop always-visible day-cell + "+N more" popover), when its schedule has `applicableDaysOfWeek` set and non-empty, then the same repeat badge renders in the identical leading-icon-then-title row markup already shared with `variant='list'` (~line 953-960), before the title text. Its content is merged into the card's existing grid-variant hover+focus tooltip (today the time-range tooltip, `tooltipVisible`/`HOVER_TOOLTIP_CLASS`) rather than introducing a second, independent tooltip trigger on the same button.

9. **i18n: new `DayOfWeek` translation namespace.** Given `project-context.md`'s Locale-Sensitive Data Rendering rule (enums must resolve through a dedicated next-intl namespace keyed by exact enum member name), when the repeat badge's tooltip/aria-label render matching weekdays, then they resolve through a **new top-level `DayOfWeek` namespace** in `apps/web/locales/en.json`/`id.json` — singular display form (`{ "MON": "Monday", "TUE": "Tuesday", "WED": "Wednesday", "THU": "Thursday", "FRI": "Friday", "SAT": "Saturday", "SUN": "Sunday" }` / id: `{ "MON": "Senin", "TUE": "Selasa", "WED": "Rabu", "THU": "Kamis", "FRI": "Jumat", "SAT": "Sabtu", "SUN": "Minggu" }`) — passed through as a `dayOfWeekLabels: Record<string, string>` prop mirroring the existing `typeLabels`/`categoryLabels` pattern on `EventCardLabels`/`WeeklyCalendarViewLabels`. **Never** a raw enum string, and **never** reused from `AIFilterSummary.daysOfWeek`'s existing namespace (that one is plural/sentence-scoped for the AI-filter-summary feature — wrong grammatical form and wrong ownership for this feature).

10. **One shared primitive, not three duplicates.** Given the badge renders identically (markup/behavior) across all 3 card families, when implemented, then it is **one** new shared component, `EventCardRepeatBadge`, added to `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` alongside `EventCardMediaSlot`/`EventCardFavoriteBadge`/`EventCardDateBox` (matching that file's own established cross-card-family reuse precedent — see its header comment listing Stories 1.i1a-e) — not three hand-rolled, drifting copies.

11. **Tooltip interaction-state deduplication.** Given `CalendarCard`'s existing hover+focus+Escape-dismiss tooltip mechanism (today hand-rolled per-component, `variant='grid'`-only, local `isHovered`/`isFocused`/`isDismissed` state, ~line 780-829) and that this story adds 2-3 more consumers of the identical interaction pattern, when implemented, then the interaction-state logic is extracted into one shared hook — `useHoverFocusTooltip` in `packages/ui/src/hooks/` — consumed by **both** the pre-existing time-range tooltip (refactored to use it, behavior-preserving) **and** every new repeat-badge tooltip instance, rather than a 2nd/3rd/4th hand-rolled copy of the same state machine. (Gate 3 finding — see Dev Notes.)

12. **Regression coverage.** Existing `WeeklyCalendarView.tsx`/`CalendarCard`/`EventCard.tsx`/`EventListView.tsx`/`buildEventsQueryCondition.ts` test suites pass unmodified for schedules **without** `applicableDaysOfWeek` (proving zero behavior change to the default/legacy path), plus new test cases for: multi-value `getDays`, the enum-mapping helper's exhaustiveness, narrowed-occurrence bucketing, per-run adjacency (including a week-boundary-straddling case), and the repeat badge's presence/absence/tooltip/aria-label across all 3 card families.

## Tasks / Subtasks

- [ ] **Task 1 — `packages/domain`: export and generalize `getDays` (AC1, AC2 partial)**
  - [ ] Change `function getDays(fromStr, toStr, dow: DayOfWeek | string)` to `export function getDays(fromStr: string, toStr: string, dow: DayOfWeek[]): string[]`, matching on `dow.includes(<mapped weekday number>)` semantics (union across all supplied members) instead of a single target.
  - [ ] Update `buildEventsQueryCondition`'s internal call site (`getDays(r.from, r.to, filter.dayOfWeek)`) to `getDays(r.from, r.to, [filter.dayOfWeek as DayOfWeek])`.
  - [ ] Add/extend `packages/domain/src/events/buildEventsQueryCondition.test.ts`: multi-value `getDays` cases (union of 2+ weekdays, empty array, all 7 days) plus a regression case proving the existing single-value filter path is unchanged.

- [ ] **Task 2 — `apps/web`: GraphQL/domain enum-mapping boundary (AC2)**
  - [ ] Create `apps/web/src/lib/day-of-week-mapping.ts`: `GQL_TO_DOMAIN_DAY_OF_WEEK: Record<GqlDayOfWeek, DomainDayOfWeek>` (import `DayOfWeek as GqlDayOfWeek` from `../generated/graphql`, `DayOfWeek as DomainDayOfWeek` from `@festgrid/domain/events`) + `mapDaysOfWeekToDomain(days)` helper.
  - [ ] Unit test proving every `GqlDayOfWeek` member maps correctly, plus a compile-time exhaustiveness sanity check noted in the test file's comments (per AC2's manual verification step).

- [ ] **Task 3 — DB + GraphQL schema: add `Schedule.applicableDaysOfWeek` (AC3)**
  - [ ] Add `applicableDaysOfWeek: text('applicable_days_of_week').array()` to `packages/database/schema.ts`'s `schedules` table (comment referencing the `DayOfWeek` enum convention, matching `events.types`/`events.categories`).
  - [ ] Run `drizzle-kit generate` to produce the migration file in `packages/database/migrations/`; hand-verify the generated SQL (nullable column addition only, no data loss).
  - [ ] Add `applicableDaysOfWeek: [DayOfWeek!]` to `Schedule` in `apps/backend/src/schema/events.graphql`.
  - [ ] Run GraphQL Code Generator (`apps/web`) to regenerate `apps/web/src/generated/graphql.ts` with the new field on every operation that selects `Schedule.applicableDaysOfWeek` (add the field to the relevant `.graphql` documents consumed by Discovery/Feed/Favorites/Calendar queries).
  - [ ] Integration test: seed a schedule with `applicableDaysOfWeek`, query it through `Query.events`/`Query.eventBySlug`, assert the field round-trips with **no new resolver code** (i.e. assert `buildOptimizedDrizzleSelect`'s existing passthrough handles it).

- [ ] **Task 4 — `packages/ui`: shared `useHoverFocusTooltip` hook (AC11, Gate 3 resolution)**
  - [ ] Extract `isHovered`/`isFocused`/`isDismissed` state + pointer/focus/blur/Escape handlers from `CalendarCard` (WeeklyCalendarView.tsx ~line 780-829) into `packages/ui/src/hooks/useHoverFocusTooltip.ts`, parameterized so touch-gating (`pointerType !== 'touch'`) and the "only active in a given mode" gate (today: `variant === 'grid'`) are caller-controlled, not hardcoded in the hook.
  - [ ] Refactor `CalendarCard`'s existing grid-variant time-range tooltip to consume the new hook (behavior-preserving — same visual/interaction outcome, existing tests pass unmodified).

- [ ] **Task 5 — `packages/ui`: `EventCardRepeatBadge` shared primitive (AC10)**
  - [ ] Add to `EventCardMediaPrimitives.tsx`/`.types.ts`: `EventCardRepeatBadge({ daysOfWeek: DomainDayOfWeek[], dayOfWeekLabels: Record<string,string>, repeatBadgeAriaLabel?: (dayLabels: string[]) => string, triggerHover: boolean, triggerFocus: boolean })` (or equivalent) — icon-only `Repeat` glyph (`DESIGN.md` `components.event_card_repeat_badge.icon`), always-present `aria-label`, and a tooltip rendered when the caller-supplied `triggerHover`/`triggerFocus` state (from Task 4's hook, owned by each consuming card's own interactive root) is active. Default `aria-label`/tooltip text falls back to `Repeats on ${dayLabels.join(', ')}` when no resolver is supplied, matching this file's `moreLabel`/`multiDaySegmentLabel` fallback-string convention.
  - [ ] Returns `null` when `daysOfWeek` is empty/undefined (mirrors `EventCardFavoriteBadge`'s "renders only when applicable" convention).

- [ ] **Task 6 — Wire the badge into masonry `EventCard` (AC6)**
  - [ ] `EventCard.types.ts`: add `applicableDaysOfWeek?: DomainDayOfWeek[] | null`, `dayOfWeekLabels?: Record<string,string>`, `repeatBadgeAriaLabel?: (dayLabels: string[]) => string` to `EventCardProps`/`EventCardLabels` as appropriate.
  - [ ] `EventCard.tsx`: render `EventCardRepeatBadge` in the masonry `badge_row` (status → repeat → nearby order); resolve the tooltip trigger per "Tooltip trigger resolution" (Dev Notes) off `RootTag`'s own hover/focus, not an independent nested focus stop.
  - [ ] `EventListView.types.ts`: add `applicableDaysOfWeek?: DomainDayOfWeek[] | null` to `EventListViewScheduleShape`.
  - [ ] `EventListView.tsx`: extend `derivedProps` to pass `displaySchedule?.applicableDaysOfWeek` through to `EventCardProps`.

- [ ] **Task 7 — Wire the badge into `CalendarCard` list + grid (AC7, AC8)**
  - [ ] `WeeklyCalendarView.types.ts`: add `applicableDaysOfWeek?: DomainDayOfWeek[] | null` to `WeeklyCalendarViewScheduleShape`, `dayOfWeekLabels?`/`repeatBadgeAriaLabel?` to `WeeklyCalendarViewLabels`.
  - [ ] `WeeklyCalendarView.tsx`: implement AC4/AC5's occurrence narrowing + adjacency generalization in `dayBuckets`; render `EventCardRepeatBadge` in `CalendarCard`'s leading-icon row for both `variant='list'` and `variant='grid'`, wiring `variant='grid'`'s existing tooltip mechanism (Task 4) to include repeat content.

- [ ] **Task 8 — i18n (AC9)**
  - [ ] Add the `DayOfWeek` namespace (7 keys, singular form) to `apps/web/locales/en.json` and `apps/web/locales/id.json` (see AC9 for exact values).
  - [ ] Wire `useTranslations('DayOfWeek')` at each apps/web call site that already builds `typeLabels`/`categoryLabels` for `EventCard`/`WeeklyCalendarView`, producing `dayOfWeekLabels`.

- [ ] **Task 9 — Wire mapped data through every apps/web call site (AC2/AC3 end-to-end)**
  - [ ] Masonry list pages — add `applicableDaysOfWeek: mapDaysOfWeekToDomain(schedule.applicableDaysOfWeek)` to each page's existing per-event/schedule mapping, and select the new GraphQL field in their query documents: `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`, `favorites/favorites-content.tsx`, `archive/archive-content.tsx`, `[platformSlug]/[accountId]/account-content.tsx`.
  - [ ] Calendar pages — same mapping applied where each page constructs the `rawEvents`/`schedules` array passed into `useWeeklyCalendarController`/`WeeklyCalendarView`: `apps/web/src/features/events/CalendarView.tsx`, `[platformSlug]/[accountId]/AccountCalendarView.tsx`, `feed/FeedCalendarView.tsx`, `my-calendar/my-calendar-content.tsx`.
  - [ ] Confirm every touched page's own tests pass unmodified aside from additive new cases.

- [ ] **Task 10 — Full regression pass (AC12)**
  - [ ] `packages/domain`, `packages/ui`, `apps/backend`, `apps/web` (touched files) — full test suite green, lint clean, `tsc --noEmit` clean for touched files.

## Dev Notes

- **Architecture and technical constraints:**
  - This story implements Architecture Spine **AD-19** (Day-of-Week Weekday-Match — Single Domain Mechanism) in full: `getDays` export/generalization (Rule 1), the explicit `Record`-based enum mapping (Rule 2), and domain's `DayOfWeek` staying domain's own internal vocabulary rather than being replaced (Rule 3 — confirmed: no change to `packages/domain`'s enum itself, only its function signature).
  - **AD-19's own text loosely says the GraphQL-generated `DayOfWeek` enum lives in `@festgrid/shared-types`.** Verified by direct inspection this is imprecise: `packages/shared-types` has no `DayOfWeek` export at all (it defines its own hand-written `EventType`/`EventCategory` copies, not GraphQL-Codegen output). The actual GraphQL-generated `DayOfWeek` enum consumed client-side lives in `apps/web/src/generated/graphql.ts` (produced by `apps/web/codegen.ts` from `apps/backend/src/schema/events.graphql`'s existing `DayOfWeek` enum, today only used by `EventFilterInput.dayOfWeek`). The mapping module (Task 2) imports from there, not from `@festgrid/shared-types`.
  - **Mapping boundary placement, resolved (not user-escalated — mechanical, precedented):** TypeScript string enums are nominal, not structurally compatible even when their literal values coincide — a `GqlDayOfWeek[]` cannot satisfy a `DomainDayOfWeek[]`-typed field without an explicit conversion. Both `packages/ui` (`WeeklyCalendarView.tsx`, `EventListView.tsx`) and `packages/domain` must never import `apps/web/src/generated/graphql.ts` (inverted dependency — packages must not depend on the app consuming them). Therefore the mapping (Task 2) lives in `apps/web`, and every apps/web call site that constructs the `events`/`rawEvents`/`schedules` array passed into `EventListView`/`useWeeklyCalendarController`/`WeeklyCalendarView` must apply it (Task 9) — this is why Task 9 touches ~9 files; each is a one-line addition to an already-existing per-page `.map()`/`.flatMap()` transform, not new architecture.
  - **Masonry `EventCard` needs no occurrence-expansion math.** Only `WeeklyCalendarView.tsx`'s day-bucketed grid needs `getDays`/adjacency logic (AC4/AC5) — masonry cards render one card per *event* (via `selectDisplaySchedule`), not per calendar day, so the repeat badge there is a simple boolean gate (`displaySchedule.applicableDaysOfWeek` set and non-empty), no date math.
  - **Week-boundary adjacency (AC5) is the easiest part of this story to get subtly wrong.** A schedule's occurrence pattern can extend before/after the currently visible week (e.g. a Mon+Tue pattern spanning 30 days, visible week is a middle week) — `isFirstSegment`/`isLastSegment` must check occurrence-membership for the day immediately outside the visible week's boundary too, not just compare against the visible week's own edges, or a run that continues into the next/previous week will incorrectly render its edge day as isolated (or vice versa). Write an explicit test for this case.

- **Tooltip trigger resolution (Gate 2 finding, resolved — not user-escalated):**
  - EXPERIENCE.md says the repeat badge "reuses this project's existing hover+focus tooltip pattern" and needs "an aria-label ... for screen-reader/touch users who can't hover" — read as: reuse the *interaction pattern*, not literally share one piece of state across unrelated card instances.
  - **Real hazard found by Gate 2:** giving the repeat badge icon its own independently-focusable trigger (e.g. `tabIndex={0}`) would nest a focusable element inside another already-interactive element in two places — masonry `EventCard`'s `badge_row` sits inside `RootTag` (an `<a>`/`<button>` when `href`/`onClick` is supplied), and `CalendarCard`'s `variant='grid'` leading-icon row sits inside its own outer `<button>`. This is the identical hazard Story 1.i1d/1.i1e already had to solve for the favorite badge (resolved there via a `RootTag`-external sibling) — but pulling the *entire* badge_row/leading-icon-row out of `RootTag` here would be a much larger, more invasive change with real click-target/UX consequences (the whole card's title/location text is also inside that same clickable area today), which this story does not attempt.
  - **Resolution:** the badge icon itself is never an independent focus stop. It is a static, always-`aria-label`led icon (matching this file's existing `isFavorited`/`isAddedToCalendar` icon precedent — plain SVG + `aria-label`, no wrapping button). Its tooltip is triggered by the **card's own already-interactive root** (masonry: `RootTag`; list variant: the inner schedule-click `<button>`; grid variant: the existing outer `<button>`) via the shared `useHoverFocusTooltip` hook (Task 4) — not a second, independently-focusable target. This satisfies "hover+focus" (sighted users get it via the card's own existing hover/focus state) and the aria-label always covers the non-hover/screen-reader/touch case, without creating invalid nested-interactive markup. Record this as the accepted interpretation of EXPERIENCE.md's "reuses the tooltip pattern" language — if product feedback later wants a badge-local hover target instead, that is a follow-up UX decision, not a defect in this story.

### Architecture & UX Gate Findings

*(epic-1-readiness.md is `swept: true` but its `stories_covered` list — 1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6 — predates this story's entire subject matter [`Schedule.applicableDaysOfWeek`/BUG-026 didn't exist until 2026-09-11, AD-19 until 2026-09-17], matching the precedent already established for Stories 1.6e/0.36 of running Gates fresh rather than trusting a sweep that couldn't have anticipated this scope. All three gates ran fresh via subagent dispatch.)*

- **Gate 1 (Winston, fresh) — No gap.** The story's only candidate architectural gap — `Schedule.applicableDaysOfWeek` not existing in DB/GraphQL yet — was independently assessed and confirmed to be the same "additive field on an already-optimized/already-joined query" class as `Event.links` (Story 0.37) and `Event.publishedAt`: no new resolver/query/mutation, reuses the existing `buildOptimizedDrizzleSelect` passthrough, ordinary Drizzle-kit schema migration. Explicitly *not* absorbed into this story: BUG-026's AI-extraction-population and filter-*matching*-correctness fixes (those remain BUG-026's own scope). No other item in this story's scope calls DB/domain directly from frontend, adds an unbacked API surface, or depends on unprovisioned infra.
  - **Gate 2 (Freya, fresh) — Gap found, resolved in-story.** (a) Confirmed: the badge must be one shared `EventCardMediaPrimitives.tsx` primitive, not 3 duplicates (AC10) — adopted as-is. (b) Confirmed: `dayBuckets`/adjacency generalization stays properly scoped to this story (single file, single consumer, no split needed). (c) Real gap: "reuse the existing tooltip pattern" cannot be taken literally as shared *state*, and a per-icon focusable trigger would create an invalid nested-interactive hazard in masonry `EventCard` and `CalendarCard` grid variant. **Resolved in-story**, not split off — see "Tooltip trigger resolution" above: each card's own already-interactive root triggers the tooltip; the badge icon is a static, aria-labeled, non-focusable element (AC6/AC7/AC8).
  - **Gate 3 (Winston, fresh) — Gap found, resolved in-story (not split into a new prerequisite story).** No shared `Tooltip`/hover-focus-interaction primitive exists in `packages/ui` today; `CalendarCard`'s existing time-range tooltip is a hand-rolled, single-use instance, and this story would otherwise add 2-3 more hand-rolled copies of the identical state machine. **Decision (recorded, not user-escalated — proportionate, low-risk default):** rather than splitting a new Epic 0 "build a generic core Tooltip primitive" prerequisite story (the class of split this project used for `PageContainer`/`GridContainer`/`PageHeader`, Stories 0.30-0.32, each fixing an already-existing 7-18-file duplication), this is resolved *within* this story by extracting the interaction-state logic into a small, narrowly-scoped `useHoverFocusTooltip` **hook** (Task 4) — not a full visual `packages/ui/src/core/` Tooltip design-system component with its own positioning/portal API. Rationale: (1) unlike the PageContainer/GridContainer/PageHeader precedent, there was exactly **one** existing hand-rolled instance before this story, not an already-systemic duplication across many unrelated files; (2) this story is precisely what would introduce the 2nd-4th copies, so doing the extraction as part of it *prevents* the duplication Gate 3 flagged rather than creating more of it and deferring cleanup; (3) no other currently-planned story in `epics.md` needs a generic tooltip primitive today, so speculative extra API surface (portal, positioning strategy, etc.) would be premature relative to this story's actual, concrete need (a fixed-position box near a small badge, matching the existing tooltip's own simple absolute-positioning approach). If a future story needs a materially different tooltip shape (portal-rendered, auto-positioned, etc.), that is the point to promote this hook into a full `packages/ui/src/core/` primitive — not now. No new backlog/epics.md prerequisite entry was added for this reason.
  - No `sprint-status.yaml`/`epics.md` prerequisite entries were added by any gate — all three findings were resolved within this story's own scope, as reasoned above.

- **Package boundaries:**
  - `packages/domain` gains no new dependency; `getDays`'s generalization stays pure/dependency-free (project-context.md's `packages/domain` restrictions: no React, no DB/ORM/Node-only deps — unaffected, this is plain date-string math, unchanged from today).
  - `packages/ui` continues its existing, already-exercised dependency on `@festgrid/domain` (confirmed present in `packages/ui/package.json`; `EventListView.tsx` already imports `selectDisplaySchedule` from `@festgrid/domain/events`) — no new package-boundary crossing.
  - `packages/ui` does **not** gain a dependency on `apps/web` or any GraphQL-generated type — the enum-mapping module (Task 2) is `apps/web`-only, per "Mapping boundary placement" above.
  - The new `EventCardRepeatBadge`/`useHoverFocusTooltip` are React UI code → correctly placed in `packages/ui` (`features/events/` and `hooks/` respectively), not `packages/domain`.
  - State management: this story adds no Server/URL/Client-Global state — all new state (`useHoverFocusTooltip`'s hover/focus/dismiss flags) is local component UI state, matching the existing precedent it replaces (`CalendarCard`'s current inline `useState` calls). No React Query/nuqs/zustand involvement.
  - Async/loading state: none introduced — this story renders already-fetched schedule data; no new blocking/non-blocking loader classification applies.

- **Data Type Compatibility & Migration Requirements:**
  - **Mismatch found:** `Schedule.applicableDaysOfWeek?: DayOfWeek[]` is decided at the PRD level (§4.4) and referenced by the UX spec (EXPERIENCE.md) as if already flowing end-to-end, but as of this story's drafting it exists in **none** of: the DB schema (`packages/database/schema.ts`), the GraphQL schema (`apps/backend/src/schema/events.graphql`), or the generated client types (`apps/web/src/generated/graphql.ts`).
  - **Impacted fields/contracts:** `schedules.applicable_days_of_week` (new DB column), `Schedule.applicableDaysOfWeek` (new GraphQL field), every `.graphql` query document that selects `Schedule` fields for Discovery/Feed/Favorites/Calendar (must add the new field to be usable), and the `packages/ui` prop types (`EventCardProps`, `EventListViewScheduleShape`, `WeeklyCalendarViewScheduleShape`) which must type it as **domain's** `DayOfWeek` enum, not the GraphQL-generated one (nominal-enum mismatch — see "Mapping boundary placement" above).
  - **Required DB migration changes:** one Drizzle-kit-generated migration adding a nullable `text[]` column to `schedules` (Task 3) — no backfill needed (absent/null is the PRD-decided legacy-compatible default, per BUG-026's PRD decision record: "unset means every day in the span applies").
  - **Required TypeScript type changes:** `packages/database/schema.ts` (Drizzle table), `apps/backend/src/schema/events.graphql` (SDL), `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited), the new `apps/web/src/lib/day-of-week-mapping.ts` mapping module, and the `packages/ui` type files listed in Tasks 6-7.
  - **Backward compatibility and rollout notes:** fully additive and nullable at every layer; no existing query, resolver, or component behavior changes for schedules that don't set the field (AC4's explicit "zero behavior change" requirement). Safe to deploy schema-first with no synchronized frontend rollout requirement, though the badge simply won't render anywhere until Task 9's wiring ships in the same story.
  - **Verification checks:** Task 3's integration test (field round-trips via the existing optimized-select passthrough with no new resolver code), Task 1/AC1's regression suite (existing single-weekday filter unaffected), AC4/AC12's `WeeklyCalendarView` regression suite (unset/empty `applicableDaysOfWeek` behaves identically to today).

- **Previous story intelligence (1.3j, epics.md-only — no story file exists yet):** `epics.md` has a full "Story 1.3j: Batch computed Event fields and gate totalCount/staleTime on the events query" section (immediately before Story 1.3, per its own "last lettered suffix... discovery order" placement note) but **no corresponding `sprint-status.yaml` entry or story file exists** — a tracking gap of the same class already documented elsewhere in this project (e.g. FIND-003). Not this story's concern to fix (out of scope, unrelated content), noted here only so it isn't mistaken for something this story caused. This story is positioned as the **next** lettered suffix after 1.3j in `epics.md` (i.e. immediately before Story 1.3), following that same established convention.

- **Git intelligence:** most recent relevant commits are the epic-1-i1 primitive-adoption series (1.i1a-1.i1z) establishing `EventCardMediaPrimitives.tsx`'s shared-primitive pattern and the RootTag-external-sibling technique for avoiding nested-interactive hazards — both directly reused by this story's design (Tasks 4-5, "Tooltip trigger resolution").

- **Project Structure Notes:**
  - No conflicts found with the unified project structure. All new files land in already-established locations (`packages/domain/src/events/`, `packages/ui/src/features/events/`, `packages/ui/src/hooks/`, `apps/web/src/lib/`, `apps/backend/src/schema/`, `packages/database/migrations/`).

- **References:**
  - [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Day-of-Week Recurring Schedules]
  - [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md — `components.event_card_repeat_badge`, `components.event_card_masonry.badge_row` comment]
  - [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-19]
  - [Source: _bmad-output/implementation-artifacts/backlog.yaml — `IDEA-003`, `BUG-026`]
  - [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md §4.4, §3.7]
  - [Source: packages/domain/src/events/buildEventsQueryCondition.ts]
  - [Source: packages/ui/src/features/events/WeeklyCalendarView.tsx, EventCard.tsx, EventCardMediaPrimitives.tsx, EventListView.tsx]
  - [Source: packages/database/schema.ts (schedules table), apps/backend/src/schema/events.graphql, apps/backend/src/schema/resolvers.ts (Event.schedules resolver)]

### Backlog row history (IDEA-003, verbatim, moved from backlog.yaml 2026-09-18)

CC-014 item #11, explicitly deferred to a future scoped `bmad-ux` pass.

**TITLE STALE (found 2026-09-16):** the mobile-spanning design this row's title refers to
already shipped via a targeted bmad-ux pass on 2026-08-24 (EXPERIENCE.md "Mobile Multi-Day
Calendar Spanning") — this row was left stale after that landed, a recurring pattern on this
project.

**RESOLVED (bmad-ux, 2026-09-16 + bmad-architecture AD-19, 2026-09-17):** this row's actual
remaining scope turned out to be `Schedule.applicableDaysOfWeek` day-of-week recurrence
(BUG-026), which the 2026-08-24 pass never covered. UX: EXPERIENCE.md "Day-of-Week Recurring
Schedules" — client-side occurrence expansion, `isFirstSegment`/`isLastSegment` generalized to
per-run adjacency, new `event_card_repeat_badge` across all 3 card families. Architecture:
AD-19 — exported/generalized `packages/domain` `getDays(DayOfWeek[])`, explicit Record-based
enum mapping at the GraphQL/domain boundary (not an implicit string-value coincidence).

**PROMOTED 2026-09-17 via bmad-create-story (row id named directly in the dispatch):** this
story (1.3k) covers this row's entire remaining scope end-to-end — `getDays`
export/generalization, the GraphQL/domain enum mapping, the `Schedule.applicableDaysOfWeek`
DB/GraphQL field addition (Gate-1-cleared as an additive-field-on-an-already-optimized-query,
same class as `Event.links`/`Event.publishedAt`), occurrence-narrowing + per-run adjacency, and
the `event_card_repeat_badge` across all 3 card families. No leftover piece of this row remains
uncovered, so no child row was carved out. BUG-026's own still-open items (AI-extraction
population, `buildEventsQueryCondition.ts`/`drizzle-where.ts` filter-matching correctness) are
that row's separate, pre-existing scope — untouched by this promotion, not carved from this
one.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Technology Stack, Locale-Sensitive Data Rendering, Code Organization (packages/domain vs packages/ui), State Management Architecture, Testing Rules
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order followed
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-19 (this story's primary architecture driver)
- [x] `docs/infrastructure/index.md` — reviewed; no backend-compute/queue/infra changes in this story beyond an ordinary Drizzle-kit column migration, so no shard file beyond the index summary was needed

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW: `packages/ui/src/hooks/useHoverFocusTooltip.ts` (+ test)
  - NEW: `apps/web/src/lib/day-of-week-mapping.ts` (+ test)
  - NEW: `packages/database/migrations/00XX_<generated-name>.sql` (Drizzle-kit generated)
  - UPDATE: `packages/domain/src/events/buildEventsQueryCondition.ts` (+ `.test.ts`) — export/generalize `getDays`
  - UPDATE: `packages/database/schema.ts` — `schedules.applicableDaysOfWeek` column
  - UPDATE: `apps/backend/src/schema/events.graphql` — `Schedule.applicableDaysOfWeek`
  - UPDATE: `apps/web/src/generated/graphql.ts` (regenerated via codegen, not hand-edited) and the `.graphql` documents that select `Schedule` fields
  - UPDATE: `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` / `.types.ts` — new `EventCardRepeatBadge`
  - UPDATE: `packages/ui/src/features/events/EventCard.tsx` / `.types.ts`, `EventListView.tsx` / `.types.ts` — masonry wiring
  - UPDATE: `packages/ui/src/features/events/WeeklyCalendarView.tsx` / `.types.ts` — occurrence narrowing, adjacency generalization, `CalendarCard` list/grid wiring
  - UPDATE: `apps/web/locales/en.json`, `apps/web/locales/id.json` — new `DayOfWeek` namespace
  - UPDATE (9 files, one-line mapping addition each): `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`, `favorites/favorites-content.tsx`, `archive/archive-content.tsx`, `[platformSlug]/[accountId]/account-content.tsx`, `apps/web/src/features/events/CalendarView.tsx`, `[platformSlug]/[accountId]/AccountCalendarView.tsx`, `feed/FeedCalendarView.tsx`, `my-calendar/my-calendar-content.tsx`
- **Rule Mapping:** AD-19 Rules 1-3 → Tasks 1-2; project-context.md Drizzle-kit-migration rule → Task 3; project-context.md Locale-Sensitive Data Rendering → Task 8; project-context.md Code Organization (packages/domain purity, packages/ui React placement) → Tasks 1/4/5 file placement; story-split-gate.md Gate 1/2/3 → Dev Notes "Architecture & UX Gate Findings".
- **Verification Plan:** unit tests for `getDays` (Task 1), the enum-mapping helper (Task 2), `useHoverFocusTooltip` (Task 4), `EventCardRepeatBadge` (Task 5); component tests for `EventCard`/`CalendarCard` (list+grid) badge presence/absence/tooltip/aria-label (Tasks 6-7); an integration test for the new GraphQL field round-trip (Task 3); full regression run across `packages/domain`, `packages/ui`, `apps/backend`, and the 9 touched `apps/web` pages (Task 10); lint + `tsc --noEmit` clean for all touched files.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation (AD-19 mapping-boundary placement, packages/domain vs packages/ui vs apps/web)
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — **all 3 gates resolved within this story's own scope (see Dev Notes "Architecture & UX Gate Findings"); no external prerequisite story blocks this one.**

## Testing Requirements

- [ ] Integration tests (GraphQL field round-trip, Task 3)
- [ ] Unit tests (`getDays`, enum mapping, `useHoverFocusTooltip`, `EventCardRepeatBadge`)
- [ ] Component tests (`EventCard`, `CalendarCard` list/grid badge behavior)
- [ ] Regression suite green across all touched packages/apps (100% unit coverage maintained for `packages/domain` per project-context.md's Testing Rules)

## Deliverables Checklist

- [ ] `getDays` exported, generalized, regression-safe
- [ ] `Record<GqlDayOfWeek, DomainDayOfWeek>` mapping module + tests
- [ ] `Schedule.applicableDaysOfWeek` in DB schema, GraphQL schema, and generated client types
- [ ] `dayBuckets` occurrence-narrowing + per-run adjacency generalization
- [ ] `EventCardRepeatBadge` shared primitive
- [ ] `useHoverFocusTooltip` shared hook (and grid-variant tooltip refactored onto it)
- [ ] Badge wired into masonry `EventCard`, `CalendarCard` list, `CalendarCard` grid
- [ ] `DayOfWeek` i18n namespace (en, id)
- [ ] All 9 apps/web call sites wired with mapped data
- [ ] Full regression + new test coverage green

## Out of Scope

- BUG-026's AI-extraction prompt/schema work to actually populate real `applicableDaysOfWeek` values from scraped captions (still open, tracked under `BUG-026`).
- BUG-026's `buildEventsQueryCondition.ts`/`drizzle-where.ts` `dayOfWeek` filter *matching correctness* fix — i.e. making `EventFilterInput.dayOfWeek` respect a schedule's own `applicableDaysOfWeek` when filtering (still open, tracked under `BUG-026`; this story only fixes the *rendering* side, matching EXPERIENCE.md's explicit scope boundary).
- Promoting the extracted `useHoverFocusTooltip` hook into a full `packages/ui/src/core/` visual Tooltip design-system primitive (positioning/portal, etc.) — deferred until a future story demonstrates a materially different consumer need (see Gate 3 finding above).
- `epics.md`'s pre-existing `sprint-status.yaml`/story-file gap for Story 1.3j — unrelated tracking gap noticed during research, not caused by or in scope for this story.

## Definition of Done

- [ ] All 12 Acceptance Criteria satisfied
- [ ] Required tests passing (unit, integration, component, regression)
- [ ] Lint and type checks passing for all touched packages (`packages/domain`, `packages/ui`, `apps/backend`, `apps/web`)

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (create-story session)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Gate 1/2/3 (`story-split-gate.md`) ran fresh via subagent dispatch (epic-1-readiness.md's sweep predates this story's subject matter). Gate 1: no gap. Gate 2: real gap found (tooltip-trigger nesting hazard) and resolved in-story (see Dev Notes). Gate 3: real gap found (tooltip interaction-state duplication) and resolved in-story via a scoped hook extraction rather than a new prerequisite story (see Dev Notes rationale). No new backlog/epics.md prerequisite entries were required.
- HIL threshold for this dispatch permitted proceeding on all implementation judgment calls (mapping-boundary placement, tooltip-trigger resolution, Gate 3 scope-vs-split decision) without user escalation — all resolved with documented reasoning above rather than via AskUserQuestion, per this dispatch's explicit instruction.

### File List
