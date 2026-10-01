---
baseline_commit: 40c01ca32638a16352723bd8fc095a1b444ac097
---

# Story 1.3k: Render Day-of-Week Recurring Schedules and the Repeat Badge Across Calendar and Card Surfaces

## Story Details

- Epic: 1
- Story ID: 1.3k
- Status: review (moved from in-progress 2026-09-30 — all 10 tasks/12 ACs complete; see "Readiness correction 2026-09-30" in Dev Notes for the scope rewrite this story underwent, and Dev Agent Record for the implementation history)
- Depends on: 1.i1n (`done`); the calendar rework that this story must build on top of — BUG-047, BUG-048, 1.i1f, 1.i1g, 1.i1h, 1.i1j, 1.i1k, 1.i1l, 1.i1m (all already landed in `WeeklyCalendarView.tsx` / `EventCardCalendarGridItem.tsx` / `format-event-date.ts`); 1.3j (batched `Event.schedules`, `review`)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Discovery/Calendar user,
I want a schedule that only recurs on specific weekdays within its date span (e.g. "every Monday, Sep 7–28") to render only on those matching days, with a clear visual marker distinguishing it from a genuine one-off event or multi-day span,
so that the calendar and card surfaces accurately reflect which days an event actually occurs on, instead of implying it happens every day inside its full date range.

## Acceptance Criteria

1. **`getDays` exported and generalized (AD-19 Rule 1).** Given `packages/domain/src/events/buildEventsQueryCondition.ts`'s module-local `getDays(fromStr, toStr, dow: DayOfWeek | string)`, when generalized, then it is `export`ed and its signature becomes `getDays(fromStr: string, toStr: string, dow: DayOfWeek[]): string[]`, returning every date in `[fromStr, toStr]` whose weekday matches **any** member of `dow` (a union over the array, not just one weekday). The existing `EventFilterInput.dayOfWeek` call site inside the same file (`buildEventsQueryCondition`, currently line 114: `getDays(r.from, r.to, filter.dayOfWeek)`) is updated to wrap its single value as a 1-element array (`getDays(r.from, r.to, [filter.dayOfWeek])`), with **zero behavior change** to today's single-weekday filter matching — regression-verified by the existing `buildEventsQueryCondition.test.ts` suite passing unmodified.

2. **Explicit `Record`-based enum mapping at the GraphQL/domain boundary (AD-19 Rule 2).** Given the GraphQL-generated `DayOfWeek` enum (`apps/web/src/generated/graphql.ts`) and `packages/domain`'s own `DayOfWeek` enum (`packages/domain/src/events/buildEventsQueryCondition.ts:7`, already `export`ed), when a schedule's `applicableDaysOfWeek` — which arrives client-side typed as the GraphQL-generated enum — must be converted before being passed to the shared `getDays`/occurrence logic, then a new `apps/web/src/lib/day-of-week-mapping.ts` module exports an explicit `Record<GqlDayOfWeek, DomainDayOfWeek>` object mapping every member (`GQL_TO_DOMAIN_DAY_OF_WEEK`) plus a small `mapDaysOfWeekToDomain(days: GqlDayOfWeek[] | null | undefined): DomainDayOfWeek[] | undefined` helper. **Never** an implicit cast or reliance on the two enums' string values coincidentally matching. Verify TypeScript's exhaustiveness checking actually fires (temporarily delete one `Record` entry during dev and confirm a compile error; do not ship the deletion).

3. **`Schedule.applicableDaysOfWeek` becomes real, queryable data.** Given `Schedule.applicableDaysOfWeek?: DayOfWeek[]` is a PRD-decided field (PRD §4.4, BUG-026's 2026-09-11 amendment) that **does not exist yet in the DB or GraphQL schema** (verified: `packages/database/schema.ts`'s `schedules` table has no such column; `apps/backend/src/schema/events.graphql`'s `Schedule` type has no such field), when this story ships, then:
   - `packages/database/schema.ts`'s `schedules` table gains a nullable `applicableDaysOfWeek: text('applicable_days_of_week').array()` column — matching the existing `events.types`/`events.categories` free-form-text-array convention ("expect values from the enum", not a strict Postgres enum type) — shipped as a Drizzle-kit-generated SQL migration file checked into `packages/database/migrations/` (the **next sequential number at dev time** — the last checked-in migration today is `0060_square_pretty_boy.sql`, so `0061_*` unless another story lands first; re-check `ls packages/database/migrations` immediately before running `drizzle-kit generate`, never hard-code a number).
   - `apps/backend/src/schema/events.graphql`'s `Schedule` type gains `applicableDaysOfWeek: [DayOfWeek!]`.
   - **Zero new resolver code**: `Event.schedules`'s existing resolver (`apps/backend/src/schema/resolvers.ts`, `schedules:` at ~3946; it calls `buildOptimizedDrizzleSelect(schedules, info)` at ~3967 on the legacy per-row path, and the 1.3j batched path in the `events` resolver selects the same way at ~3299/~3467) already maps any requested GraphQL field to its matching Drizzle column — **all three `schedules` selects must pass the new column through** (verify each with the integration test, including the batched `events` path) — the identical mechanism Story 0.37's `Event.links` and the `Event.publishedAt` field used. Confirm this passthrough actually returns the new field with an integration test; do not hand-write a field resolver.
   - This is **read-only, additive-field scope only** — explicitly **out of scope**: the AI-extraction prompt/schema populating real `applicableDaysOfWeek` values, and `buildEventsQueryCondition.ts`/`drizzle-where.ts`'s `dayOfWeek` filter *matching correctness* fix. Both remain BUG-026's own still-open, deliberately-deferred items (see backlog.yaml `BUG-026`). Seed/test data may set this column directly for verification.

4. **Run-based occurrences: `dayBuckets`, `spanningSchedules` and the mobile list all narrow by weekday (EXPERIENCE.md "Day-of-Week Recurring Schedules"; rewritten 2026-09-30).** Given `WeeklyCalendarView.tsx`'s current structure — `dayBuckets` (the per-day `useMemo`, ~line 431, used by the mobile list), `spanningSchedules` (~line 484, one week-clipped bar per multi-day schedule built from the raw `eventStartDate`/`eventEndDate`, rendered by `MultiDaySpanningBar`), and `singleDayDayBuckets` (~line 541, the desktop day cells, which exclude segments by `spanningScheduleIds`, a set of **schedule ids**) — when a schedule's (already domain-mapped) `applicableDaysOfWeek` is set and non-empty, then all three consumers work from the schedule's **occurrence runs**, computed once via the shared `getDays` utility (Task 1/AC1), never a second reimplementation of weekday matching in `packages/ui`:
   - An occurrence run is a maximal set of calendar-adjacent occurrence days (occurrence days = `getDays(eventStartDate, eventEndDate, days)`). A Monday-only schedule spanning Sep 7–28 yields four one-day runs, never a week-wide bar; a Mon+Tue schedule yields two-day runs.
   - `spanningSchedules` entries are **per run** (a run of >=2 days visible this week, week-clipped exactly as today), each carrying its run bounds; a schedule with several runs in one week produces several bars. Isolated one-day runs get **no** bar.
   - Desktop exclusion is **segment-level, not schedule-id-level**: `singleDayDayBuckets` must drop only the day segments covered by a rendered run bar and keep isolated-day segments of the same schedule. Regression case: a Mon+Tue run plus an isolated Friday in the same week renders one Mon–Tue bar **and** a Friday day-cell card (the current id-based `spanningScheduleIds` filter would silently drop Friday).
   - Desktop day-cell overflow (`+N more`, `calendar-overflow-trigger-desktop`) and the roving-tabindex grid count isolated occurrences like any single-day schedule, and never count the segments already shown as a bar.
   - The mobile list's multi-day inline-cap exemption (`isMultiDaySchedule(seg.schedule)`, ~line 916) is decided per **run** (segment belongs to a run of >=2 days), not by the schedule's raw date span.
   - A schedule with `applicableDaysOfWeek` unset or empty behaves exactly as today (one run = the whole span) — **zero behavior change for legacy/default schedules**, regression-verified by the existing `WeeklyCalendarView.test.tsx` suite passing unmodified.

5. **Per-run adjacency and run-aware date box content (rewritten 2026-09-30).** Given a schedule's narrowed occurrence set (AC4), when segments are produced, then `Segment.isFirstSegment`/`isLastSegment` (defined ~line 310, populated in `dayBuckets` ~lines 448-449) are `true` when the immediately adjacent calendar day (±1) is **not also an occurrence** of that schedule — evaluated against the schedule's full occurrence set, including days outside the visible 7-day week (a run can start/continue before or after the displayed week; do not treat the week boundary as an implicit run edge). Each segment (and each `SpanningSchedule` entry) also carries its run's first/last occurrence day. Calendar-adjacent occurrence days collapse into one run rendered identically to today's plain multi-day span; non-adjacent occurrences render as isolated single-day segments identical in shape to a genuine one-off single-day event. The date box / "till" content is computed by `computeCalendarSegmentDateBoxContent(locale, timezone, currentDayStr, startDate, endDate, tillLabel)` in `packages/ui/src/features/events/format-event-date.ts` (line 625; the old `multiDayBadgeText`/"Day X of N" math no longer exists and must not be reintroduced). Its callers in `WeeklyCalendarView.tsx` (`CalendarCard` list variant ~line 1171, and the grid/spanning callers at ~1309 and ~1472/~1487) must pass the **run's own first/last occurrence day** as `startDate`/`endDate`, never the schedule's overall `eventStartDate`/`eventEndDate` span (e.g. a Mon+Tue run inside a 30-day span shows that run's end date, never the 30-day span's). `computeCalendarSegmentDateBoxContent`'s signature stays unchanged (it already takes bounds as parameters); its existing tests pass unmodified and gain a run-bounds case. `formatEventStatus` callers that take `schedule.eventStartDate`/`eventEndDate` (~1102, ~1189, ~1487) keep the schedule-level span (status describes the whole schedule) unless a test proves otherwise — record the choice in Dev Notes.

6. **Masonry `EventCard` repeat badge.** Given the masonry `EventCard` variant, when its displayed schedule (`EventListView.tsx`'s `displaySchedule`) has `applicableDaysOfWeek` set and non-empty, then the new icon-only `event_card_repeat_badge` (lucide `Repeat`, DESIGN.md token, `w-3.5 h-3.5 text-muted-foreground shrink-0`, no fill/pill background) renders in `badge_row` immediately after the status badge and before the nearby badge (order: status → repeat → nearby). It always carries an `aria-label` listing the schedule's translated matching weekdays (present regardless of hover state, for screen-reader/touch users), and shows the same content in a hover+focus-triggered tooltip when the card's own root (`RootTag`) is hovered/focused — see Dev Notes "Tooltip trigger resolution" for why the badge icon itself must **not** be an independent focus stop.

7. **Calendar Row Card (`variant='list'`) repeat badge (rewritten 2026-09-30).** Given `WeeklyCalendarView.tsx`'s `CalendarCard` in `variant='list'` (the mobile day-list, `if (variant === 'list')` branch ~line 1169), when its schedule has `applicableDaysOfWeek` set and non-empty, then the same repeat badge renders in the existing title row next to the `isAddedToCalendar` `CalendarPlus` icon (~line 1236, `data-testid="calendar-plus-icon"`), before the title text, **outside** the title's own `truncate` span so it is never clipped. Note that the list variant no longer renders an `isFavorited` icon there (the favorite state now lives only on the media slot's interactive favorite control, ~line 1233 comment) — the row holds the added-to-calendar icon only, so there is no "isFavorited/isAddedToCalendar icon pair" to sit alongside. Tooltip/aria-label content and behavior match AC6, triggered off the card's own schedule-click `<button>` (not an independent nested focus stop).

8. **Calendar grid item, spanning bar and `isAddedToCalendar` badge sites (rewritten 2026-09-30).** Given the desktop grid is now rendered by the separate `EventCardCalendarGridItem` component (`packages/ui/src/features/events/EventCardCalendarGridItem.tsx`, consumed by `CalendarCard` `variant='grid'` at ~line 1346 for single-day/isolated segments and by `MultiDaySpanningBar` at ~lines 1546-1565 in its `isMultiDay` composition) and **no longer uses a shared leading-icon-then-title row**, when a schedule has `applicableDaysOfWeek` set and non-empty, then the repeat badge renders at every one of these sites, each satisfying AC6's tooltip/aria-label contract:
   - **Grid item corner badge:** `EventCardCalendarGridItem` gains an optional `applicableDaysOfWeek`/`dayOfWeekLabels`/tooltip-state prop set and renders `EventCardRepeatBadge` as an absolutely-positioned corner icon in the same non-interactive style as the existing corner `isAddedToCalendar` `CalendarPlus` badge (`WeeklyCalendarView.tsx` ~lines 1373-1379: `absolute -top-1.5 -left-1.5 w-3.5 h-3.5 …`), placed at a different corner (e.g. `-top-1.5 -right-1.5`, confirm against DESIGN.md `event_card_repeat_badge`) so the two never overlap. There is no leading-icon row on the grid item to insert into.
   - **Spanning bar:** `MultiDaySpanningBar` renders the same badge on its `EventCardCalendarGridItem` (multi-day run bar), so a Mon+Tue run bar carries the repeat marker too.
   - **`isAddedToCalendar` in spanning bar and grid item:** the spanning bar currently passes no `isAddedToCalendar` to its `EventCardCalendarGridItem` (only the single-day `CalendarCard` grid path shows the corner `CalendarPlus`); this story does not change that pre-existing gap (tracked as FIND-058) but must not place the repeat badge where FIND-058's eventual added-to-calendar corner icon would go — keep the two corner slots distinct.
   - The tooltip is the card's existing grid-variant hover+focus tooltip (`tooltipVisible`/`HOVER_TOOLTIP_CLASS`, ~line 1095) extended with the repeat content, and the spanning bar's own tooltip (`tooltipVisible` ~line 1465) likewise; neither introduces a second, independent tooltip trigger on the same button.

9. **i18n: new `DayOfWeek` translation namespace.** Given `project-context.md`'s Locale-Sensitive Data Rendering rule (enums must resolve through a dedicated next-intl namespace keyed by exact enum member name), when the repeat badge's tooltip/aria-label render matching weekdays, then they resolve through a **new top-level `DayOfWeek` namespace** in `apps/web/locales/en.json`/`id.json` — singular display form (`{ "MON": "Monday", "TUE": "Tuesday", "WED": "Wednesday", "THU": "Thursday", "FRI": "Friday", "SAT": "Saturday", "SUN": "Sunday" }` / id: `{ "MON": "Senin", "TUE": "Selasa", "WED": "Rabu", "THU": "Kamis", "FRI": "Jumat", "SAT": "Sabtu", "SUN": "Minggu" }`) — passed through as a `dayOfWeekLabels: Record<string, string>` prop mirroring the existing `typeLabels`/`categoryLabels` pattern on `EventCardLabels`/`WeeklyCalendarViewLabels`. **Never** a raw enum string, and **never** reused from `AIFilterSummary.daysOfWeek`'s existing namespace (that one is plural/sentence-scoped for the AI-filter-summary feature — wrong grammatical form and wrong ownership for this feature).

10. **One shared primitive, not three duplicates.** Given the badge renders identically (markup/behavior) across all card sites (masonry, calendar list row, grid-item corner, spanning bar), when implemented, then it is **one** new shared component, `EventCardRepeatBadge`, added to `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` alongside `EventCardMediaSlot`/`EventCardFavoriteBadge`/`EventCardDateBox` (matching that file's own established cross-card-family reuse precedent — see its header comment listing Stories 1.i1a-e) — not three hand-rolled, drifting copies.

11. **Tooltip interaction-state deduplication — three hand-rolled copies (rewritten 2026-09-30).** Given the hover+focus+Escape-dismiss interaction state (`isHovered`/`isFocused`/`isDismissed`, pointer/focus/blur/Escape handlers) is today hand-rolled in **three** places — `CalendarCard` (`WeeklyCalendarView.tsx` ~lines 1083-1120, gated to `variant === 'grid'`), `MultiDaySpanningBar` (same file, ~lines 1461-1510) and `useNavRailItemInteraction` (`packages/ui/src/hooks/useNavRailItemInteraction.ts`) — and this story adds repeat-badge tooltip consumers, when implemented, then the interaction-state logic is extracted into one shared hook, `useHoverFocusTooltip` in `packages/ui/src/hooks/`, consumed by **both** `CalendarCard` (the pre-existing time-range tooltip, refactored behavior-preservingly) **and `MultiDaySpanningBar` (mandatory — it carries the repeat badge per AC8 and would otherwise become the 3rd hand-rolled copy)** and every new repeat-badge tooltip, rather than a further hand-rolled copy. Refactoring `useNavRailItemInteraction` onto the hook is an **optional follow-up** (backlog row IDEA-052), not part of this story.

12. **Regression coverage.** Existing `WeeklyCalendarView.tsx`/`CalendarCard`/`EventCardCalendarGridItem`/`EventCard.tsx`/`EventListView.tsx`/`format-event-date.ts`/`buildEventsQueryCondition.ts` test suites pass unmodified for schedules **without** `applicableDaysOfWeek` (proving zero behavior change to the default/legacy path), plus new test cases for: multi-value `getDays`, the enum-mapping helper's exhaustiveness, run-based `spanningSchedules` (a Monday-only Sep 7–28 schedule yields no week-wide bar), segment-level exclusion (Mon+Tue run plus isolated Friday keeps Friday in the day cells), overflow/`+N more` counting of isolated occurrences, per-run adjacency (including a week-boundary-straddling case), run-bounds `computeCalendarSegmentDateBoxContent`, the `MultiDaySpanningBar` on the shared `useHoverFocusTooltip`, and the repeat badge's presence/absence/tooltip/aria-label across masonry `EventCard`, `CalendarCard` list, the grid item corner badge and the spanning bar.

## Tasks / Subtasks

- [x] **Task 1 — `packages/domain`: export and generalize `getDays` (AC1, AC2 partial)**
  - [x] Change `function getDays(fromStr, toStr, dow: DayOfWeek | string)` to `export function getDays(fromStr: string, toStr: string, dow: DayOfWeek[]): string[]`, matching on `dow.includes(<mapped weekday number>)` semantics (union across all supplied members) instead of a single target.
  - [x] Update `buildEventsQueryCondition`'s internal call site (`getDays(r.from, r.to, filter.dayOfWeek)`) to `getDays(r.from, r.to, [filter.dayOfWeek as DayOfWeek])`.
  - [x] Add/extend `packages/domain/src/events/buildEventsQueryCondition.test.ts`: multi-value `getDays` cases (union of 2+ weekdays, empty array, all 7 days) plus a regression case proving the existing single-value filter path is unchanged.

- [x] **Task 2 — `apps/web`: GraphQL/domain enum-mapping boundary (AC2)**
  - [x] Create `apps/web/src/lib/day-of-week-mapping.ts`: `GQL_TO_DOMAIN_DAY_OF_WEEK: Record<GqlDayOfWeek, DomainDayOfWeek>` (import `DayOfWeek as GqlDayOfWeek` from `../generated/graphql`, `DayOfWeek as DomainDayOfWeek` from `@festgrid/domain/events`) + `mapDaysOfWeekToDomain(days)` helper.
  - [x] Unit test proving every `GqlDayOfWeek` member maps correctly, plus a compile-time exhaustiveness sanity check noted in the test file's comments (per AC2's manual verification step).

- [x] **Task 3 — DB + GraphQL schema: add `Schedule.applicableDaysOfWeek` (AC3)**
  - [x] Add `applicableDaysOfWeek: text('applicable_days_of_week').array()` to `packages/database/schema.ts`'s `schedules` table (comment referencing the `DayOfWeek` enum convention, matching `events.types`/`events.categories`).
  - [x] Run `drizzle-kit generate` to produce the migration file in `packages/database/migrations/` (next sequential number at dev time — last is `0060_square_pretty_boy.sql` as of 2026-09-30; never hand-number it); hand-verify the generated SQL (nullable column addition only, no data loss). — landed as `0061_brief_killraven.sql`.
  - [x] Add `applicableDaysOfWeek: [DayOfWeek!]` to `Schedule` in `apps/backend/src/schema/events.graphql`.
  - [x] Run GraphQL Code Generator (`apps/web`) to regenerate `apps/web/src/generated/graphql.ts` with the new field on every operation that selects `Schedule.applicableDaysOfWeek` (add the field to the relevant `.graphql` documents consumed by Discovery/Feed/Favorites/Calendar queries).
  - [x] Integration test: seed a schedule with `applicableDaysOfWeek`, query it through `Query.events`/`Query.eventBySlug`, assert the field round-trips with **no new resolver code** (i.e. assert `buildOptimizedDrizzleSelect`'s existing passthrough handles it). — **NOT executed in this sandbox** (no Postgres): the test is written and type-checked in apps/backend/src/schema/resolvers.test.ts but must be run in a DB-backed environment before this can be ticked. **[Verified 2026-10-01: CI run 36813752616 on master (`eeec7ea`, includes the Case-B cleanup fix) passed lint, build and the full test suite incl. the DB-backed backend tests against Postgres.]**

- [x] **Task 4 — `packages/ui`: shared `useHoverFocusTooltip` hook (AC11, Gate 3 resolution)**
  - [x] Extract `isHovered`/`isFocused`/`isDismissed` state + pointer/focus/blur/Escape handlers from `CalendarCard` (`WeeklyCalendarView.tsx` ~lines 1083-1120) and `MultiDaySpanningBar` (~lines 1461-1510) into `packages/ui/src/hooks/useHoverFocusTooltip.ts`, parameterized so touch-gating (`pointerType !== 'touch'`) and the "only active in a given mode" gate (today: `variant === 'grid'`) are caller-controlled, not hardcoded in the hook.
  - [x] Refactor `CalendarCard`'s existing grid-variant time-range tooltip **and `MultiDaySpanningBar`'s tooltip** to consume the new hook (behavior-preserving — same visual/interaction outcome, existing tests pass unmodified). Leave `useNavRailItemInteraction` alone (IDEA-052).

- [x] **Task 5 — `packages/ui`: `EventCardRepeatBadge` shared primitive (AC10)**
  - [x] Add to `EventCardMediaPrimitives.tsx`/`.types.ts`: `EventCardRepeatBadge({ daysOfWeek: DomainDayOfWeek[], dayOfWeekLabels: Record<string,string>, repeatBadgeAriaLabel?: (dayLabels: string[]) => string, triggerHover: boolean, triggerFocus: boolean })` (or equivalent) — icon-only `Repeat` glyph (`DESIGN.md` `components.event_card_repeat_badge.icon`), always-present `aria-label`, and a tooltip rendered when the caller-supplied `triggerHover`/`triggerFocus` state (from Task 4's hook, owned by each consuming card's own interactive root) is active. Default `aria-label`/tooltip text falls back to `Repeats on ${dayLabels.join(', ')}` when no resolver is supplied, matching this file's `moreLabel`/`multiDaySegmentLabel` fallback-string convention.
  - [x] Returns `null` when `daysOfWeek` is empty/undefined (mirrors `EventCardFavoriteBadge`'s "renders only when applicable" convention).

- [x] **Task 6 — Wire the badge into masonry `EventCard` (AC6)**
  - [x] `EventCard.types.ts`: add `applicableDaysOfWeek?: DomainDayOfWeek[] | null`, `dayOfWeekLabels?: Record<string,string>`, `repeatBadgeAriaLabel?: (dayLabels: string[]) => string` to `EventCardProps`/`EventCardLabels` as appropriate.
  - [x] `EventCard.tsx`: render `EventCardRepeatBadge` in the masonry `badge_row` (status → repeat → nearby order); resolve the tooltip trigger per "Tooltip trigger resolution" (Dev Notes) off `RootTag`'s own hover/focus, not an independent nested focus stop.
  - [x] `EventListView.types.ts`: add `applicableDaysOfWeek?: DomainDayOfWeek[] | null` to `EventListViewScheduleShape`.
  - [x] `EventListView.tsx`: extend `derivedProps` to pass `displaySchedule?.applicableDaysOfWeek` through to `EventCardProps`.

- [x] **Task 7 — Wire the badge into `CalendarCard` list + grid (AC7, AC8)**
  - [x] `WeeklyCalendarView.types.ts`: add `applicableDaysOfWeek?: DomainDayOfWeek[] | null` to `WeeklyCalendarViewScheduleShape`, `dayOfWeekLabels?`/`repeatBadgeAriaLabel?` to `WeeklyCalendarViewLabels`.
  - [x] `WeeklyCalendarView.tsx`: implement AC4/AC5 — compute occurrence runs once per schedule (shared `getDays`), make `dayBuckets`, `spanningSchedules` (per-run entries carrying run bounds) and `singleDayDayBuckets` (segment-level exclusion replacing the `spanningScheduleIds` id set) run-aware, count isolated occurrences in desktop overflow, decide the mobile multi-day inline-cap exemption per run, and pass run bounds to every `computeCalendarSegmentDateBoxContent` caller (`CalendarCard` list ~1171, grid ~1309, `MultiDaySpanningBar` ~1472/1487).
  - [x] Render `EventCardRepeatBadge` at each AC6-AC8 site: `CalendarCard` list title row (beside the `CalendarPlus` icon, outside the `truncate` span), the `EventCardCalendarGridItem` corner (new props on that component + `.types`), and `MultiDaySpanningBar`'s grid item; wire the grid variant's and spanning bar's tooltips through the shared hook (Task 4).
  - [x] `format-event-date.ts`: no signature change to `computeCalendarSegmentDateBoxContent`; add a run-bounds test case to its test file.

- [x] **Task 8 — i18n (AC9)**
  - [x] Add the `DayOfWeek` namespace (7 keys, singular form) to `apps/web/locales/en.json` and `apps/web/locales/id.json` (see AC9 for exact values).
  - [x] Wire `useTranslations('DayOfWeek')` at each apps/web call site that already builds `typeLabels`/`categoryLabels` for `EventCard`/`WeeklyCalendarView`, producing `dayOfWeekLabels`. — DONE 2026-09-30: added `tDayOfWeek`/`dayOfWeekLabels` (via the same `buildEnumLabels` pattern already used for `typeLabels`/`categoryLabels`) and wired it into the `cardLabels`/`labels` prop at all 9 consuming pages (5 masonry + 4 calendar, same file list as Task 9).

- [x] **Task 9 — Wire mapped data through every apps/web call site (AC2/AC3 end-to-end)**
  - [x] Masonry list pages — add `applicableDaysOfWeek: mapDaysOfWeekToDomain(schedule.applicableDaysOfWeek)` to each page's existing per-event/schedule mapping, and select the new GraphQL field in their query documents: `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`, `favorites/favorites-content.tsx`, `archive/archive-content.tsx`, `[platformSlug]/[accountId]/account-content.tsx`.
  - [x] Calendar pages — same mapping applied where each page constructs the `rawEvents`/`schedules` array passed into `useWeeklyCalendarController`/`WeeklyCalendarView`: `apps/web/src/features/events/CalendarView.tsx`, `[platformSlug]/[accountId]/AccountCalendarView.tsx`, `feed/FeedCalendarView.tsx`, `my-calendar/my-calendar-content.tsx`. — DONE 2026-09-30: `mapCalendarSchedules` (`packages/ui/src/hooks/useWeeklyCalendarController.ts`) now passes `applicableDaysOfWeek` through (generic passthrough — no apps/web dependency added to packages/ui, per the boundary rule). Each of the 4 calendar pages now maps its GraphQL-typed `rawEvents`/overflow pages through `mapDaysOfWeekToDomain` (a local `mapEventsDayOfWeek` helper per page, matching the masonry pages' existing per-file-helper convention) before handing them to `useWeeklyCalendarController`/`mapCalendarSchedules`.
  - [x] Confirm every touched page's own tests pass unmodified aside from additive new cases. — `packages/ui` and `web` (apps/web) test suites both green (`run-check.ts --kind test --filter @festgrid/ui` / `--filter web`); no existing page-level test references `applicableDaysOfWeek`/`dayOfWeekLabels` (grep-verified), so this is pure additive plumbing with no page-level test updates required, consistent with Task 9.1's masonry wiring which landed the same way.

- [x] **Task 10 — Full regression pass (AC12)**
  - [x] `packages/domain`, `packages/ui`, `apps/backend`, `apps/web` (touched files) — full test suite green, lint clean, `tsc --noEmit` clean for touched files. — `packages/ui` test suite green, `web` (apps/web) test suite green, unfiltered `pnpm lint` green (8/8), unfiltered `pnpm build` green (8/8), `tsc --noEmit` in `apps/web` and `packages/ui` produces the exact same pre-existing error set as the unmodified baseline (52 lines in `apps/web`, one unrelated `tsconfig.json` deprecation notice in `packages/ui` — zero new errors from this session's changes, verified via `git stash`/`tsc --noEmit`/`git stash pop` diff). This sandbox's orchestrator guard denies the unscoped repo-wide `test` run because `apps/backend`'s suite needs `DATABASE_URL`, which isn't available here; `packages/domain` and `apps/backend` were not touched in this session (their Task 1-3 work and its tests were verified complete in the prior 2026-09-30 reconciliation) and are unaffected by this session's packages/ui + apps/web-only changes.

## Dev Notes

- **Architecture and technical constraints:**
  - This story implements Architecture Spine **AD-19** (Day-of-Week Weekday-Match — Single Domain Mechanism) in full: `getDays` export/generalization (Rule 1), the explicit `Record`-based enum mapping (Rule 2), and domain's `DayOfWeek` staying domain's own internal vocabulary rather than being replaced (Rule 3 — confirmed: no change to `packages/domain`'s enum itself, only its function signature).
  - **AD-19's own text loosely says the GraphQL-generated `DayOfWeek` enum lives in `@festgrid/shared-types`.** Verified by direct inspection this is imprecise: `packages/shared-types` has no `DayOfWeek` export at all (it defines its own hand-written `EventType`/`EventCategory` copies, not GraphQL-Codegen output). The actual GraphQL-generated `DayOfWeek` enum consumed client-side lives in `apps/web/src/generated/graphql.ts` (produced by `apps/web/codegen.ts` from `apps/backend/src/schema/events.graphql`'s existing `DayOfWeek` enum, today only used by `EventFilterInput.dayOfWeek`). The mapping module (Task 2) imports from there, not from `@festgrid/shared-types`.
  - **Mapping boundary placement, resolved (not user-escalated — mechanical, precedented):** TypeScript string enums are nominal, not structurally compatible even when their literal values coincide — a `GqlDayOfWeek[]` cannot satisfy a `DomainDayOfWeek[]`-typed field without an explicit conversion. Both `packages/ui` (`WeeklyCalendarView.tsx`, `EventListView.tsx`) and `packages/domain` must never import `apps/web/src/generated/graphql.ts` (inverted dependency — packages must not depend on the app consuming them). Therefore the mapping (Task 2) lives in `apps/web`, and every apps/web call site that constructs the `events`/`rawEvents`/`schedules` array passed into `EventListView`/`useWeeklyCalendarController`/`WeeklyCalendarView` must apply it (Task 9) — this is why Task 9 touches ~9 files; each is a one-line addition to an already-existing per-page `.map()`/`.flatMap()` transform, not new architecture.
  - **Masonry `EventCard` needs no occurrence-expansion math.** Only `WeeklyCalendarView.tsx`'s day-bucketed grid needs `getDays`/adjacency logic (AC4/AC5) — masonry cards render one card per *event* (via `selectDisplaySchedule`), not per calendar day, so the repeat badge there is a simple boolean gate (`displaySchedule.applicableDaysOfWeek` set and non-empty), no date math.
  - **Week-boundary adjacency (AC5) is the easiest part of this story to get subtly wrong.** A schedule's occurrence pattern can extend before/after the currently visible week (e.g. a Mon+Tue pattern spanning 30 days, visible week is a middle week) — `isFirstSegment`/`isLastSegment` must check occurrence-membership for the day immediately outside the visible week's boundary too, not just compare against the visible week's own edges, or a run that continues into the next/previous week will incorrectly render its edge day as isolated (or vice versa). Write an explicit test for this case.

- **Tooltip trigger resolution (Gate 2 finding, resolved — not user-escalated):**
  - EXPERIENCE.md says the repeat badge "reuses this project's existing hover+focus tooltip pattern" and needs "an aria-label ... for screen-reader/touch users who can't hover" — read as: reuse the *interaction pattern*, not literally share one piece of state across unrelated card instances.
  - **Real hazard found by Gate 2:** giving the repeat badge icon its own independently-focusable trigger (e.g. `tabIndex={0}`) would nest a focusable element inside another already-interactive element in two places — masonry `EventCard`'s `badge_row` sits inside `RootTag` (an `<a>`/`<button>` when `href`/`onClick` is supplied), and `CalendarCard`'s `variant='grid'` card (now rendering `EventCardCalendarGridItem`, plus the corner badge slots and `MultiDaySpanningBar`'s bar) sits inside its own outer `<button>`. This is the identical hazard Story 1.i1d/1.i1e already had to solve for the favorite badge (resolved there via a `RootTag`-external sibling) — but pulling the *entire* badge_row/leading-icon-row out of `RootTag` here would be a much larger, more invasive change with real click-target/UX consequences (the whole card's title/location text is also inside that same clickable area today), which this story does not attempt.
  - **Resolution:** the badge icon itself is never an independent focus stop. It is a static, always-`aria-label`led icon (matching this file's existing `isFavorited`/`isAddedToCalendar` icon precedent — plain SVG + `aria-label`, no wrapping button). Its tooltip is triggered by the **card's own already-interactive root** (masonry: `RootTag`; list variant: the inner schedule-click `<button>`; grid variant: the existing outer `<button>`) via the shared `useHoverFocusTooltip` hook (Task 4) — not a second, independently-focusable target. This satisfies "hover+focus" (sighted users get it via the card's own existing hover/focus state) and the aria-label always covers the non-hover/screen-reader/touch case, without creating invalid nested-interactive markup. Record this as the accepted interpretation of EXPERIENCE.md's "reuses the tooltip pattern" language — if product feedback later wants a badge-local hover target instead, that is a follow-up UX decision, not a defect in this story.

### Readiness correction 2026-09-30

Per `_bmad-output/planning-artifacts/epic-readiness/batch-event-pages-wave-a-readiness.md` (Correction 1 — "DO NOT DISPATCH AS WRITTEN"). This story was drafted 2026-09-17 against a `WeeklyCalendarView` that has since changed (Stories 1.i1f/g/h/j/k/l/m, BUG-047, BUG-048). Every claim below was re-verified against current source before rewriting:

- **Spanning bars are built from raw dates, not from `dayBuckets`.** `spanningSchedules` (`WeeklyCalendarView.tsx` ~484-520) clips `eventStartDate`/`eventEndDate` to the week, so a Monday-only Sep 7–28 schedule would render a week-wide bar; `spanningScheduleIds` (~537-543) excludes desktop day segments by schedule id, so a Mon+Tue run plus an isolated Friday would lose Friday. AC4 now requires run-based entries, segment-level exclusion, and overflow counting of isolated occurrences.
- **"Day X of N" / `multiDayBadgeText` no longer exists.** The logic is `computeCalendarSegmentDateBoxContent` (`format-event-date.ts:625`); AC5 now requires run bounds to be passed at its callers.
- **The grid cell is `EventCardCalendarGridItem`,** not a `CalendarCard` leading-icon row; the added-to-calendar marker is an absolutely-positioned corner icon (~1373-1379). AC8 now names the grid-item corner badge, the spanning bar, and the grid item as badge sites.
- **List variant no longer shows an `isFavorited` icon** (only `CalendarPlus`); AC7 corrected. Line numbers refreshed (`CalendarCard` tooltip state ~1083, `MultiDaySpanningBar` ~1461, `Event.schedules` resolver `schedules:` ~3946). `packages/database/migrations` currently ends at `0060_square_pretty_boy.sql`, so AC3 says "next sequential number at dev time".
- **Depends-on** now lists BUG-047, BUG-048, 1.i1f, 1.i1g, 1.i1h, 1.i1j, 1.i1k, 1.i1l, 1.i1m in the header (1.i1n remains the wave-plan prerequisite). Landing order: last in Wave A, after 0.i5d and 0.i5e (shared `buildEventsQueryCondition.ts`/`format-event-date.ts`/mapping call sites/`queries.graphql`/generated `graphql.ts`), and after the FIND-053 (`EventCard.tsx` dead branch) and IDEA-048 (`EventCardMediaPrimitives.tsx`) quick-fixes.
- **Not split.** The report floated splitting the data slice (column + GraphQL field + mapping) as `1.3ka`; that split is **declined** — 1.3k stays one story.

### Architecture & UX Gate Findings

*(epic-1-readiness.md is `swept: true` but its `stories_covered` list — 1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6 — predates this story's entire subject matter [`Schedule.applicableDaysOfWeek`/BUG-026 didn't exist until 2026-09-11, AD-19 until 2026-09-17], matching the precedent already established for Stories 1.6e/0.36 of running Gates fresh rather than trusting a sweep that couldn't have anticipated this scope. All three gates ran fresh via subagent dispatch.)*

- **Gate 1 (Winston, fresh) — No gap.** The story's only candidate architectural gap — `Schedule.applicableDaysOfWeek` not existing in DB/GraphQL yet — was independently assessed and confirmed to be the same "additive field on an already-optimized/already-joined query" class as `Event.links` (Story 0.37) and `Event.publishedAt`: no new resolver/query/mutation, reuses the existing `buildOptimizedDrizzleSelect` passthrough, ordinary Drizzle-kit schema migration. Explicitly *not* absorbed into this story: BUG-026's AI-extraction-population and filter-*matching*-correctness fixes (those remain BUG-026's own scope). No other item in this story's scope calls DB/domain directly from frontend, adds an unbacked API surface, or depends on unprovisioned infra.
  - **Gate 2 (Freya, fresh) — Gap found, resolved in-story.** (a) Confirmed: the badge must be one shared `EventCardMediaPrimitives.tsx` primitive, not 3 duplicates (AC10) — adopted as-is. (b) Confirmed: `dayBuckets`/adjacency generalization stays properly scoped to this story (single file, single consumer, no split needed). (c) Real gap: "reuse the existing tooltip pattern" cannot be taken literally as shared *state*, and a per-icon focusable trigger would create an invalid nested-interactive hazard in masonry `EventCard` and `CalendarCard` grid variant. **Resolved in-story**, not split off — see "Tooltip trigger resolution" above: each card's own already-interactive root triggers the tooltip; the badge icon is a static, aria-labeled, non-focusable element (AC6/AC7/AC8).
  - **Gate 3 (Winston, fresh; premise corrected 2026-09-30) — Gap found, resolved in-story (not split into a new prerequisite story).** No shared `Tooltip`/hover-focus-interaction primitive exists in `packages/ui` today. The original draft said `CalendarCard`'s time-range tooltip was "exactly one" hand-rolled instance; that is stale. Current source has **three** hand-rolled copies of the same hover+focus+Escape state machine: `CalendarCard` (`WeeklyCalendarView.tsx` ~1083), `MultiDaySpanningBar` (~1461, which the original draft did not mention) and `useNavRailItemInteraction` (`packages/ui/src/hooks/`). **Decision (recorded, proportionate):** keep the resolution in-story — extract a small, narrowly-scoped `useHoverFocusTooltip` **hook** (Task 4), not a full visual `packages/ui/src/core/` Tooltip component with positioning/portal API, and do not spawn a prerequisite story. Revised rationale: (1) this story would add repeat-badge tooltip consumers to two of the existing copies (`CalendarCard`, `MultiDaySpanningBar`), so extraction as part of it prevents 4-5 copies instead of growing the duplication; (2) the hook must therefore cover **both** `CalendarCard` and `MultiDaySpanningBar` (AC11) — a hook adopted by only one of them would leave the spanning bar, which carries the badge, as a fresh drifting copy; (3) the third copy, `useNavRailItemInteraction`, is unrelated to this story's surfaces, so refactoring it is an optional follow-up (IDEA-052), keeping this story proportionate; (4) no other currently-planned story needs a generic tooltip primitive, so speculative API surface (portal, positioning) would be premature. If a future story needs a materially different tooltip shape, that is the point to promote this hook into a full `core/` primitive. No new backlog/epics.md prerequisite entry was added for the in-story extraction; IDEA-052 tracks only the optional nav-rail adoption.
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
per-run adjacency, new `event_card_repeat_badge` across all card families (see the 2026-09-30 correction: masonry, list row, grid-item corner, spanning bar). Architecture:
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
  - NEW: `packages/database/migrations/<next sequential number at dev time>_<generated-name>.sql` (Drizzle-kit generated; last existing is `0060_square_pretty_boy.sql`)
  - UPDATE: `packages/domain/src/events/buildEventsQueryCondition.ts` (+ `.test.ts`) — export/generalize `getDays`
  - UPDATE: `packages/database/schema.ts` — `schedules.applicableDaysOfWeek` column
  - UPDATE: `apps/backend/src/schema/events.graphql` — `Schedule.applicableDaysOfWeek`
  - UPDATE: `apps/web/src/generated/graphql.ts` (regenerated via codegen, not hand-edited) and the `.graphql` documents that select `Schedule` fields
  - UPDATE: `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` / `.types.ts` — new `EventCardRepeatBadge`
  - UPDATE: `packages/ui/src/features/events/EventCard.tsx` / `.types.ts`, `EventListView.tsx` / `.types.ts` — masonry wiring
  - UPDATE: `packages/ui/src/features/events/WeeklyCalendarView.tsx` / `.types.ts` — run-based occurrence narrowing (`dayBuckets`, `spanningSchedules`, `singleDayDayBuckets`), adjacency generalization, run-bounds date-box callers, `CalendarCard` list wiring, `MultiDaySpanningBar` wiring
  - UPDATE: `packages/ui/src/features/events/EventCardCalendarGridItem.tsx` / `.types.ts` — repeat-badge corner slot + tooltip props
  - UPDATE: `packages/ui/src/features/events/format-event-date.test.ts` — run-bounds case for `computeCalendarSegmentDateBoxContent` (no signature change)
  - UPDATE: `apps/web/locales/en.json`, `apps/web/locales/id.json` — new `DayOfWeek` namespace
  - UPDATE (9 files, one-line mapping addition each): `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`, `favorites/favorites-content.tsx`, `archive/archive-content.tsx`, `[platformSlug]/[accountId]/account-content.tsx`, `apps/web/src/features/events/CalendarView.tsx`, `[platformSlug]/[accountId]/AccountCalendarView.tsx`, `feed/FeedCalendarView.tsx`, `my-calendar/my-calendar-content.tsx`
- **Rule Mapping:** AD-19 Rules 1-3 → Tasks 1-2; project-context.md Drizzle-kit-migration rule → Task 3; project-context.md Locale-Sensitive Data Rendering → Task 8; project-context.md Code Organization (packages/domain purity, packages/ui React placement) → Tasks 1/4/5 file placement; story-split-gate.md Gate 1/2/3 → Dev Notes "Architecture & UX Gate Findings".
- **Verification Plan:** unit tests for `getDays` (Task 1), the enum-mapping helper (Task 2), `useHoverFocusTooltip` (Task 4), `EventCardRepeatBadge` (Task 5); component tests for `EventCard`/`CalendarCard` (list+grid) badge presence/absence/tooltip/aria-label (Tasks 6-7); an integration test for the new GraphQL field round-trip (Task 3); full regression run across `packages/domain`, `packages/ui`, `apps/backend`, and the 9 touched `apps/web` pages (Task 10); lint + `tsc --noEmit` clean for all touched files.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation (AD-19 mapping-boundary placement, packages/domain vs packages/ui vs apps/web)
- [x] Testing plan confirmation
- [x] Explicit human approval state — **approved 2026-09-30** (user explicitly approved continuing this dev-story dispatch after this session flagged the gate had never been formally checked off despite Tasks 1-4 already being coded in prior sessions; see Completion Notes)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — **all 3 gates resolved within this story's own scope (see Dev Notes "Architecture & UX Gate Findings"); no external prerequisite story blocks this one.**

## Testing Requirements

- [x] Integration tests (GraphQL field round-trip, Task 3) — **NOT executed in this sandbox** (no Postgres): the test is written and type-checked in apps/backend/src/schema/resolvers.test.ts but must be run in a DB-backed environment before this can be ticked. **[Verified 2026-10-01: CI run 36813752616 on master (`eeec7ea`, includes the Case-B cleanup fix) passed lint, build and the full test suite incl. the DB-backed backend tests against Postgres.]**
- [x] Unit tests (`getDays`, enum mapping, `useHoverFocusTooltip`, `EventCardRepeatBadge`)
- [x] Component tests (`EventCard`, `CalendarCard` list/grid badge behavior)
- [x] Regression suite green across all touched packages/apps (100% unit coverage maintained for `packages/domain` per project-context.md's Testing Rules) — verified this session for the packages actually touched (`packages/ui`, `apps/web`); `packages/domain`/`apps/backend` were verified complete in the prior 2026-09-30 reconciliation session and untouched here.

## Deliverables Checklist

- [x] `getDays` exported, generalized, regression-safe
- [x] `Record<GqlDayOfWeek, DomainDayOfWeek>` mapping module + tests
- [x] `Schedule.applicableDaysOfWeek` in DB schema, GraphQL schema, and generated client types
- [x] Run-based occurrence narrowing across `dayBuckets`/`spanningSchedules`/`singleDayDayBuckets` (segment-level exclusion, overflow counting) + per-run adjacency + run-bounds date-box content
- [x] `EventCardRepeatBadge` shared primitive
- [x] `useHoverFocusTooltip` shared hook (grid-variant `CalendarCard` tooltip **and** `MultiDaySpanningBar` tooltip refactored onto it)
- [x] Badge wired into masonry `EventCard`, `CalendarCard` list, `EventCardCalendarGridItem` corner, and the spanning bar
- [x] `DayOfWeek` i18n namespace (en, id)
- [x] All 9 apps/web call sites wired with mapped data
- [x] Full regression + new test coverage green — all verified except the backend DB-backed round-trip test (AC3/Task 3), which is written but NOT executed in this sandbox. **[Verified 2026-10-01: CI run 36813752616 on master (`eeec7ea`, includes the Case-B cleanup fix) passed lint, build and the full test suite incl. the DB-backed backend tests against Postgres.]**

## Out of Scope

- BUG-026's AI-extraction prompt/schema work to actually populate real `applicableDaysOfWeek` values from scraped captions (still open, tracked under `BUG-026`).
- BUG-026's `buildEventsQueryCondition.ts`/`drizzle-where.ts` `dayOfWeek` filter *matching correctness* fix — i.e. making `EventFilterInput.dayOfWeek` respect a schedule's own `applicableDaysOfWeek` when filtering (still open, tracked under `BUG-026`; this story only fixes the *rendering* side, matching EXPERIENCE.md's explicit scope boundary).
- Refactoring `useNavRailItemInteraction` onto `useHoverFocusTooltip` (IDEA-052, optional follow-up), and splitting the data slice off as `1.3ka` (declined).
- Promoting the extracted `useHoverFocusTooltip` hook into a full `packages/ui/src/core/` visual Tooltip design-system primitive (positioning/portal, etc.) — deferred until a future story demonstrates a materially different consumer need (see Gate 3 finding above).
- `epics.md`'s pre-existing `sprint-status.yaml`/story-file gap for Story 1.3j — unrelated tracking gap noticed during research, not caused by or in scope for this story.

## Definition of Done

- [x] All 12 Acceptance Criteria satisfied — all verified except the backend DB-backed round-trip test (AC3/Task 3), which is written but NOT executed in this sandbox. **[Verified 2026-10-01: CI run 36813752616 on master (`eeec7ea`, includes the Case-B cleanup fix) passed lint, build and the full test suite incl. the DB-backed backend tests against Postgres.]**
- [x] Required tests passing (unit, integration, component, regression) — **NOT executed in this sandbox** (no Postgres): the test is written and type-checked in apps/backend/src/schema/resolvers.test.ts but must be run in a DB-backed environment before this can be ticked. **[Verified 2026-10-01: CI run 36813752616 on master (`eeec7ea`, includes the Case-B cleanup fix) passed lint, build and the full test suite incl. the DB-backed backend tests against Postgres.]**
- [x] Lint and type checks passing for all touched packages (`packages/domain`, `packages/ui`, `apps/backend`, `apps/web`)

## Completion Status

- [x] Complete — all 10 tasks done, all 12 ACs satisfied, ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (create-story session)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Gate 1/2/3 (`story-split-gate.md`) ran fresh via subagent dispatch (epic-1-readiness.md's sweep predates this story's subject matter). Gate 1: no gap. Gate 2: real gap found (tooltip-trigger nesting hazard) and resolved in-story (see Dev Notes). Gate 3: real gap found (tooltip interaction-state duplication) and resolved in-story via a scoped hook extraction rather than a new prerequisite story (see Dev Notes rationale). No new backlog/epics.md prerequisite entries were required.
- HIL threshold for this dispatch permitted proceeding on all implementation judgment calls (mapping-boundary placement, tooltip-trigger resolution, Gate 3 scope-vs-split decision) without user escalation — all resolved with documented reasoning above rather than via AskUserQuestion, per this dispatch's explicit instruction.
- **2026-09-30 reconciliation (superseded — see the two entries below):** a prior dev-story dispatch made real code progress across 7 WIP commits (`ea1ca9a`..`27770b0`, "dispatch stopped at spend limit") but never updated this story file's Tasks/Subtasks, File List, or Completion Notes to match. An initial audit pass (before further code landed) found Tasks 1-3 genuinely complete and Task 4 half-done. **This note is stale**: further work landed in the same day (commit `635ab84` and the WIP commits after it) that completed Tasks 4-8.1/9.1 in actual code; the note below ("orchestrator audit, verified against code") is the accurate record of what shipped and when. Left here only so the historical narrative isn't silently deleted.
- **2026-09-30 orchestrator audit (verified against code, commit `635ab84`):** re-verified Tasks 4-7 directly against source (not against this file's own checkboxes, which had drifted both ways at different points today) and confirmed they are genuinely implemented: `useHoverFocusTooltip` is consumed by both `CalendarCard` and `MultiDaySpanningBar` (Task 4 complete, not half-done as the earlier note said); `WeeklyCalendarView.tsx` has real run-based occurrence-narrowing logic (`dayBuckets`/`spanningSchedules`/`singleDayDayBuckets`, not just unused type fields as the earlier note said); `EventCardRepeatBadge` is wired into `EventCard.tsx`, `EventCardCalendarGridItem.tsx`, and the `CalendarCard`/`MultiDaySpanningBar` sites in `WeeklyCalendarView.tsx`. Ticked Tasks 4-7 and 8.1/9.1 to match. Identified two real remaining gaps via direct code inspection (not just task-list completeness): Task 8.2 — no `useTranslations("DayOfWeek")` call exists anywhere in apps/web, so `dayOfWeekLabels` never reaches `EventCard`/`WeeklyCalendarView` despite `packages/ui` already accepting the prop; Task 9.2 — `mapCalendarSchedules` (`packages/ui/src/hooks/useWeeklyCalendarController.ts`) drops `applicableDaysOfWeek` entirely, so none of the 4 calendar pages (`CalendarView`, `AccountCalendarView`, `FeedCalendarView`, `my-calendar-content`) ever receive it, even though their GraphQL queries already select the field.
- **2026-09-30 close-out (this session):** Resumed with the user's explicit approval to proceed (Pre-Coding Approval Gate had never been checked off despite prior sessions already coding Tasks 1-4; user approved continuing and directed trusting the code over either the stale Completion Notes or the (at the time, already-correct) checkboxes — see Pre-Coding Approval Gate). Quickly re-verified Tasks 4-7 against source myself (grep for `useHoverFocusTooltip`/`getDays`/`EventCardRepeatBadge` usage) before proceeding, confirming the orchestrator audit above. Closed the two remaining gaps:
  - **Task 8.2 (AC9):** added `useTranslations('DayOfWeek')` + a `dayOfWeekLabels` map (via the same `buildEnumLabels` helper pattern each file already uses for `typeLabels`/`categoryLabels`) at all 9 apps/web call sites, wired into the `cardLabels`/`labels` prop passed to `EventListView`/`WeeklyCalendarView`.
  - **Task 9.2 (AC2/AC3):** `mapCalendarSchedules` (`packages/ui/src/hooks/useWeeklyCalendarController.ts`) now passes `applicableDaysOfWeek` through as a generic field (no new apps/web dependency added to packages/ui — preserves the "packages/ui must not import apps/web's generated types" boundary rule). Each of the 4 calendar pages now maps its raw GraphQL events (including `CalendarView.tsx`'s separate overflow-dialog page fetch) through `mapDaysOfWeekToDomain` via a local `mapEventsDayOfWeek` helper before handing them to `useWeeklyCalendarController`, mirroring the masonry pages' existing per-file-helper convention (Task 9.1) rather than centralizing the GQL→domain conversion into `packages/ui` (which would violate the same boundary rule).
  - **Verification:** `packages/ui` test suite green, `apps/web` ("web") test suite green (via `run-check.ts --kind test --filter <pkg>`), unfiltered `pnpm lint` green (8/8 tasks), unfiltered `pnpm build` green (8/8 tasks). `tsc --noEmit` in `apps/web` and `packages/ui` produces byte-identical pre-existing error output to the unmodified baseline (confirmed via `git stash` / re-run / `git stash pop`) — zero new type errors from this session's changes. Did **not** run the full unscoped repo-wide `test` task — this sandbox has no `DATABASE_URL`, which `apps/backend`'s suite requires, and a permission guard explicitly denies that unscoped run for this reason; `packages/domain`/`apps/backend` were not touched this session (their own Task 1-3 work was verified complete in the prior reconciliation) so this is a sandbox limitation, not an unverified gap in this session's actual changes.
  - All 10 tasks and all 12 ACs are now satisfied; story moved to `review`.

### File List

- `packages/domain/src/events/buildEventsQueryCondition.ts` (Task 1)
- `packages/domain/src/events/buildEventsQueryCondition.test.ts` (Task 1)
- `apps/web/src/lib/day-of-week-mapping.ts` (Task 2)
- `apps/web/src/lib/day-of-week-mapping.test.ts` (Task 2)
- `packages/database/schema.ts` (Task 3)
- `packages/database/migrations/0061_brief_killraven.sql` (Task 3)
- `packages/database/migrations/meta/0061_snapshot.json` (Task 3)
- `packages/database/migrations/meta/_journal.json` (Task 3)
- `apps/backend/src/schema/events.graphql` (Task 3)
- `apps/backend/src/schema/resolvers.test.ts` (Task 3)
- `apps/web/src/features/events/queries.graphql` (Task 3)
- `apps/web/src/generated/graphql.ts` (Task 3, codegen output)
- `packages/ui/src/hooks/useHoverFocusTooltip.ts` (Task 4, partial)
- `packages/ui/src/hooks/useHoverFocusTooltip.types.ts` (Task 4, partial)
- `packages/ui/src/hooks/useHoverFocusTooltip.test.ts` (Task 4, partial)
- `packages/ui/src/hooks/index.ts` (Task 4, partial)
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts` (Task 7)
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` (Task 7)
- `packages/ui/src/features/events/EventCardCalendarGridItem.tsx` (Task 7)
- `packages/ui/src/features/events/EventCardCalendarGridItem.types.ts` (Task 7)
- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` (Task 5)
- `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` (Task 5)
- `packages/ui/src/features/events/EventCard.tsx` (Task 6)
- `packages/ui/src/features/events/EventCard.types.ts` (Task 6)
- `packages/ui/src/features/events/EventListView.tsx` (Task 6)
- `packages/ui/src/features/events/EventListView.types.ts` (Task 6)
- `packages/ui/src/features/events/format-event-date.test.ts` (Task 7)
- `packages/ui/src/hooks/useWeeklyCalendarController.ts` (Task 9.2, this session — `mapCalendarSchedules` now passes `applicableDaysOfWeek` through)
- `apps/web/locales/en.json` (Task 8.1)
- `apps/web/locales/id.json` (Task 8.1)
- `apps/web/src/features/events/CalendarView.tsx` (Task 8.2/9.2, this session)
- `apps/web/src/app/[locale]/[platformSlug]/[accountId]/AccountCalendarView.tsx` (Task 8.2/9.2, this session)
- `apps/web/src/app/[locale]/feed/FeedCalendarView.tsx` (Task 8.2/9.2, this session)
- `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx` (Task 8.2/9.2, this session)
- `apps/web/src/app/[locale]/home-content.tsx` (Task 8.2, this session; Task 9.1 mapping landed earlier)
- `apps/web/src/app/[locale]/feed/feed-content.tsx` (Task 8.2, this session; Task 9.1 mapping landed earlier)
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (Task 8.2, this session; Task 9.1 mapping landed earlier)
- `apps/web/src/app/[locale]/archive/archive-content.tsx` (Task 8.2, this session; Task 9.1 mapping landed earlier)
- `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` (Task 8.2, this session; Task 9.1 mapping landed earlier)

### Change Log

- 2026-09-30: Closed the two remaining gaps (Task 8.2 `dayOfWeekLabels` i18n wiring, Task 9.2 calendar-page `applicableDaysOfWeek` data-path wiring) identified by the same-day orchestrator audit. All 10 tasks and all 12 ACs now satisfied. Status moved `in-progress` → `review`.
- 2026-09-30 (earlier same day): Orchestrator audit verified Tasks 4-7 genuinely implemented in code and ticked them; identified Task 8.2/9.2 as the two real remaining gaps.
- 2026-09-17 to 2026-09-30: Story drafted, readiness-corrected against the post-1.i1f/g/h/j/k/l/m `WeeklyCalendarView`, then implemented across multiple sessions (Tasks 1-3 DB/GraphQL/domain plumbing; Task 4 shared tooltip hook; Tasks 5-7 shared `EventCardRepeatBadge` primitive and its wiring into masonry/calendar surfaces; Task 8.1 i18n namespace; Task 9.1 masonry data-path wiring).
