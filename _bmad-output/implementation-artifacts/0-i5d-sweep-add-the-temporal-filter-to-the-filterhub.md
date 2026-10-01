---
baseline_commit: 5597e19
---

# Story 0.i5d: Sweep — add the temporal filter to the FilterHub

## Story Details

- Epic: 0.i5 (Shared list-pagination and filter-state controller)
- Story ID: 0.i5d
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a Today / Upcoming / All temporal filter in the event-list filter row (card view only),
so that I can narrow the list to what is on today or coming up next (IDEA-019), with its state held by the epic's shared `useListPaginationController` like every other filter.

## Acceptance Criteria

1. **Given** the GraphQL schema, **when** this story ships, **then** `apps/backend/src/schema/events.graphql` gains a new `enum TemporalFilter { TODAY UPCOMING }` and a new optional field `temporalFilter: TemporalFilter` on the existing `input EventFilterInput` — absent/null means "All," matching every other optional `EventFilterInput` facet's convention (Architecture Spine AD-20 Rule 1). `type EventFilter` (the AI-filter echo/output type) is **not** extended — see Out of Scope.

2. **Given** `packages/domain/src/events/buildEventsQueryCondition.ts` (the shared, already-dual-consumed DSL-building function — invoked server-side by `resolvers.ts`'s `events` resolver for its `filter: EventFilterInput` argument, and client-side by `home-content.tsx` to build the `query: EventQueryConditionInput` tree), **when** `temporalFilter` is `UPCOMING`, **then** it translates to the **existing, unmodified** `{field: 'scheduleDateRange', operator: 'overlaps', value: {from: tomorrowISO, to: null}}` condition — zero new SQL, zero new `drizzle-where.ts` code (AD-20 Rule 3). `tomorrowISO`/`todayISO` are computed via this file's own existing UTC-based `fmt()` helper (the same helper `resolveDateRangeFilter`/`getDays` already use), for consistency with every other date literal already produced by this file.

3. **Given** the same function, **when** `temporalFilter` is `TODAY`, **then** it translates to an `and` of (a) the existing, unmodified `{field: 'scheduleDateRange', operator: 'overlaps', value: {from: todayISO, to: todayISO}}` and (b) exactly one new condition, `{field: 'scheduleEndedBoundary', operator: 'notEnded', value: {now: <literal ISO instant>, today: todayISO}}` (AD-20 Rule 2). The literal instant is `now.toISOString()` from this function's own existing `now` variable (`currentDate ?? new Date()`) — **never** a live SQL `NOW()`.

4. **Given** `packages/graphql-select/drizzle-where.ts`'s existing operator `switch`, **when** this story ships, **then** it gains exactly one new `case "notEnded"` (extending the same fieldMap-descriptor-to-`EXISTS`-subquery pattern the existing `overlaps` case already uses) whose generated SQL, for a given schedule row, evaluates to **not ended** if and only if `formatEventStatus`'s (`packages/ui/src/features/events/format-event-date.ts`) own `ended` boolean would be `false` for the same `(startDate, startTime, endDate, endTime, now)` inputs interpreted with no timezone conversion on either side (see Dev Notes — "Timezone scope of the `!ended` mirror" — for why no-timezone-conversion is the correct, deliberate interpretation of "exactly mirror," not an oversight). `apps/backend/src/schema/resolvers.ts`'s `events` resolver fieldMap gains the matching `scheduleEndedBoundary` descriptor entry.

5. **Given** the shared boundary-case fixture required by AD-20 Rule 4, **when** this story ships, **then** `packages/domain/src/events/__fixtures__/ended-cases.ts` exists, is re-exported from `packages/domain/src/events/index.ts`, and is imported by **both** `packages/ui/src/features/events/format-event-date.test.ts` (new cases asserting `formatEventStatus`/its extracted `isEventEnded` helper — see Dev Notes) **and** `apps/backend/src/schema/resolvers.test.ts` (new integration test cases seeding real `schedules` rows per fixture case against the live test DB and asserting `TODAY` inclusion/exclusion matches `!expectedEnded`). The fixture covers, at minimum: no `endTime` with `endDate` present (today / yesterday / tomorrow); no `endTime` with `endDate` absent (falls back to `startDate`); `endTime` present with `endDate` today, `now` before / exactly at / after the combined end instant; and a schedule whose effective end date is more than one day in the past or future.

6. **Given** `EventDiscoveryPanel.tsx`'s existing `currentViewId` state, **when** `currentViewId === 'card'`, **then** a new segmented `role="radiogroup"` control (`TemporalFilterToggle`, new component) renders as a new child of the existing `<div className="flex flex-col gap-6">`, between `SearchBar` and `FilterHub` (matching `EXPERIENCE.md`'s "Temporal Filter: Today / Upcoming / All (Card View Only)" section and `DESIGN.md`'s `components.temporal_filter` tokens verbatim). **When** `currentViewId === 'calendar'`, **then** it does not render at all, and no temporal condition is applied to the calendar view's own query (`CalendarView.tsx`'s `useWeeklyCalendarController`/`buildWeeklyCalendarQueryCondition` path is untouched — see Out of Scope).

7. **Given** `home-content.tsx`'s existing `useListPaginationController` call, **when** the temporal filter's committed value changes, **then** it is included in the controller's `filterKey` (alongside `q`/`types`/`categories`/`nearby`/`aiFilter`) and in `useInfiniteQuery`'s `queryKey`, so a temporal-filter change resets pagination to page 1 via the exact same `resetToken` mechanism Story 0.i5b already wired for Discovery's other filters — no new pagination-reset code path. The committed value itself is owned by a new `nuqs` query-state (`temporal`, `parseAsStringEnum(['TODAY', 'UPCOMING'])`, no default — absent/`null` means "All").

8. **Given** the "All" bucket (the default, and the calendar view's only behavior), **when** no `temporalFilter` is applied, **then** the existing Story 2.7 default-hide-past-events grace-window condition (`buildDefaultEventVisibilityConditions`) continues to apply completely unchanged — "All" is not "no temporal narrowing at all," it is "no *additional* narrowing beyond what already ships today" (`EXPERIENCE.md`'s explicit "All" bucket definition).

9. **Given** the per-card status badge (`EventCard.tsx`'s `formatEventStatus` call, `{components.event_card_status_badge}`), **when** this story ships, **then** it is **byte-for-byte unchanged** in its own render call site and its own 8-state visible behavior — the only change touching `format-event-date.ts` is the internal extraction described in Dev Notes, which must not alter `formatEventStatus`'s existing public signature or any of its existing test assertions.

10. **Given** the new UI strings ("Today," "Upcoming," "All," and the radiogroup's accessible group label), **when** this story ships, **then** they are added to `apps/web/locales/en.json` and `apps/web/locales/id.json` under a namespace consumed via `useTranslations()` (not hardcoded), per AD-6.

11. **Given** the temporal filter's committed value changes, **when** this story ships, **then** `home-content.tsx` fires a new PostHog event `temporal_filter_changed` with payload `{ value: 'TODAY' | 'UPCOMING' | 'ALL' }` (`'ALL'` used for the reset-to-default case, since the wire value itself is `null`), matching the existing `filter_applied`/`view_switched` event-per-filter-action convention already used in this file (AD-5).

## Tasks / Subtasks

- [ ] **Task 1 — GraphQL schema + domain DSL translation (AC: 1, 2, 3)**
  - [ ] Add `enum TemporalFilter { TODAY UPCOMING }` and `temporalFilter: TemporalFilter` (on `input EventFilterInput`) to `apps/backend/src/schema/events.graphql`. Do **not** add the field to `type EventFilter` (see Out of Scope).
  - [ ] In `packages/domain/src/events/buildEventsQueryCondition.ts`: add `export enum TemporalFilter { TODAY = 'TODAY', UPCOMING = 'UPCOMING' }` next to the existing `DateAnchor`/`DayOfWeek` enums; add `temporalFilter?: TemporalFilter | 'TODAY' | 'UPCOMING' | null` to the local `EventFilterInput` interface; add `temporalFilter?: TemporalFilter | 'TODAY' | 'UPCOMING' | null` as a new **top-level** field on `BuildEventsQueryConditionInput` (sibling of `search`/`types`/`categories`/`nearby`/`filter`) — this is what lets Discovery's non-AI-filter (`else` branch) path apply the temporal filter too, mirroring how `types`/`categories` already exist both nested in `EventFilterInput` and as top-level params.
  - [ ] Add one local helper, e.g. `function buildTemporalCondition(temporalFilter: TemporalFilter | string | null | undefined, now: Date): QueryCondition | undefined`, implementing AC2/AC3's translation using the file's existing `fmt()` helper for `todayISO`/`tomorrowISO`. Call it from **both** the `if (filter)` branch (`filter.temporalFilter`) and the `else` branch (new top-level `temporalFilter` param), pushing its result into `conditions` when defined — do not duplicate the translation logic inline in both branches.
  - [ ] After schema changes, run `pnpm --filter web codegen` to regenerate `apps/web/src/generated/graphql.ts` (`EventFilterInput`, new `TemporalFilter` type) — required before `home-content.tsx`/`use-ai-filter.ts` can reference the new field with type safety.

- [ ] **Task 2 — New `drizzle-where.ts` operator + resolver fieldMap (AC: 3, 4)**
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `events` resolver, add a new fieldMap entry (near the existing `scheduleDateRange` entry): `scheduleEndedBoundary: { table: schedules, eventIdCol: schedules.eventId, correlateCol: events.id, startCol: schedules.eventStartDate, endCol: schedules.eventEndDate, endTimeCol: schedules.eventEndTime }`.
  - [ ] In `packages/graphql-select/drizzle-where.ts`, add `case "notEnded":` to the existing `switch (operator)`. Destructure `{ now, today }` from `value` and `{ table, eventIdCol, correlateCol, startCol, endCol, endTimeCol }` from the descriptor. Build:
    ```ts
    // Strip any trailing 'Z'/offset before interpolating into a `::timestamp`
    // (timezone-naive) cast — see Dev Notes "Timezone scope of the !ended mirror."
    // Casting a tz-qualified string to a naive `timestamp` type makes Postgres
    // silently reinterpret it via the session's `TimeZone` GUC, which this app's
    // connection (apps/backend/src/db/client.ts) does not pin to UTC.
    const naiveNow = now.replace(/Z$|[+-]\d{2}:?\d{2}$/, '');
    return sql`EXISTS (
      SELECT 1 FROM ${table}
      WHERE ${eventIdCol} = ${correlateCol}
        AND NOT (
          COALESCE(${endCol}, ${startCol}) < ${today}::date
          OR (
            COALESCE(${endCol}, ${startCol}) = ${today}::date
            AND ${endTimeCol} IS NOT NULL
            AND (COALESCE(${endCol}, ${startCol})::timestamp + ${endTimeCol}) <= ${naiveNow}::timestamp
          )
        )
    )`;
    ```
    (Exact SQL shape may be adjusted during implementation if `EXPLAIN ANALYZE` — Task 4 — surfaces a better-performing equivalent, but the boolean semantics must stay identical to the fixture's expected outcomes.)
  - [ ] Add unit tests to `packages/graphql-select/drizzle-where.test.ts` for the new `notEnded` case (asserting the generated SQL/params shape), mirroring the existing `overlaps` test's style — add a `scheduleEndedBoundary`-shaped descriptor to that test file's local `fieldMap` fixture.

- [ ] **Task 3 — Shared `ended-cases` fixture + cross-boundary parity tests (AC: 5, 9)**
  - [ ] Refactor `packages/ui/src/features/events/format-event-date.ts`: extract the existing inline `ended` computation inside `formatEventStatus` (lines ~154–160) into a new exported pure function `isEventEnded(now: Date, timezone: string | undefined, startDate: Date | string, startTime: string | null | undefined, endDate: Date | string | null | undefined, endTime: string | null | undefined): boolean`, and have `formatEventStatus` call it internally. This is a pure extract-function refactor — `formatEventStatus`'s existing public signature, return values, and all existing test assertions must not change (AC9). This gives the shared fixture (next bullet) one canonical, directly-callable boolean to assert against instead of inferring `ended` from `formatEventStatus`'s returned label string.
  - [ ] New file `packages/domain/src/events/__fixtures__/ended-cases.ts`: export an `EndedCaseFixture` type (`{ description: string; startDate: string; startTime: string | null; endDate: string | null; endTime: string | null; now: string; expectedEnded: boolean }`) and an array `ENDED_CASE_FIXTURES` covering at minimum the cases listed in AC5. Re-export both from `packages/domain/src/events/index.ts`.
  - [ ] Add new test cases to `packages/ui/src/features/events/format-event-date.test.ts`: `describe('isEventEnded (shared ended-cases fixture)', ...)` iterating `ENDED_CASE_FIXTURES` (imported from `@festgrid/domain/events`) and asserting `isEventEnded(new Date(now), undefined, startDate, startTime, endDate, endTime) === expectedEnded` for each — `timezone: undefined` deliberately, matching the no-timezone-conversion scope (Dev Notes).
  - [ ] Add new integration test cases to `apps/backend/src/schema/resolvers.test.ts`: for each `ENDED_CASE_FIXTURES` entry, insert one real `events`/`schedules` row with that case's `startDate`/`startTime`/`endDate`/`endTime`, query `events(filter: { temporalFilter: TODAY })` with the fixture's `now` (via whatever test seam this resolver already exposes for injecting `now` — check `resolvers.ts`'s existing `now`/threshold computation for an override hook, e.g. an injectable clock already used by Story 0.36's tests; if none exists, add the smallest possible one, e.g. an optional `context.now` override honored only in test builds), and assert the row is included iff `todayISO` overlaps the schedule's range **and** `!expectedEnded`. Clean up inserted rows after each case (`afterEach`, matching this file's existing insert/cleanup pattern).

- [x] **Task 4 — DB index research (AC: none — non-functional/performance; AD-20's own deferred clause) — COMPLETE, no migration required**
  - [x] `EXPLAIN ANALYZE` research run during story creation (2026-09-17) against 30,000 synthetic `events`/48,030 synthetic `schedules` rows in a throwaway scratch database, combined with the app's other common filters (`types`/`categories`/`location`) and the real `Query.events` `ORDER BY`/`LIMIT`/`OFFSET` shape. **Result: the existing `schedule_event_date_idx` is sufficient — no new index migration is needed.** A candidate hand-tuned expression index (`schedule_event_end_ts_idx` on `schedules (event_id, (COALESCE(event_end_date, event_start_date)::timestamp + COALESCE(event_end_time, TIME '23:59:59.999999')))`) *did* successfully push the new condition into an `Index Cond`, but measured **~10% slower** (40.3-43.5ms vs. 36.2-38.0ms baseline, over 2×5 repeated runs both directions) — the anti-join still requires a heap visit per candidate row regardless of which predicate lands in `Index Cond` vs. `Filter`, and the residual `Filter`-based `schedule_event_date_idx` plan already keeps this an `Index Scan`, not a sequential scan. This is a decisive, evidence-based **negative** result (do not add the candidate index), not an inconclusive one. Full before/after `EXPLAIN ANALYZE` plans in Dev Notes below. **Do not revisit this without new evidence** — if a future story wants to improve `Query.events`' performance under this filter combination, the correctly-scoped target is the unrelated pre-existing `Seq Scan on events` (this query's actual dominant cost — `types`/`categories` use plain btree indexes, incompatible with the DSL's `&&` overlap operator), not this story's `!ended` condition.
  - [x] Scratch database (`festgrid_explain_scratch`) dropped, all scratch files removed, local Postgres 16 cluster stopped, `git status` clean — confirmed no persistent trace of this research spike.

- [ ] **Task 5 — `TemporalFilterToggle` component (AC: 6; Gate 2 flagged item)**
  - [ ] Add `@radix-ui/react-radio-group` to `packages/ui/package.json` dependencies (match the existing `@radix-ui/react-tabs`/`@radix-ui/react-popover` version-pinning convention — `^1.x`, latest stable at implementation time).
  - [ ] New `packages/ui/src/core/ui/radio-group.tsx`: a thin Shadcn-style wrapper around `@radix-ui/react-radio-group`'s `Root`/`Item`, mirroring `packages/ui/src/core/ui/tabs.tsx`'s existing wrapper style/conventions in this repo (unstyled structural primitive only — visual styling stays in `TemporalFilterToggle`, not baked into this primitive, matching how `tabs.tsx` itself carries no `EventDiscoveryPanel`-specific styling).
  - [ ] New `packages/ui/src/features/events/TemporalFilterToggle.tsx` + `.types.ts` + `.test.tsx`: a controlled component (`value: 'TODAY' | 'UPCOMING' | null`, `onChange: (value: 'TODAY' | 'UPCOMING' | null) => void`, `labels: { today: string; upcoming: string; all: string; groupLabel: string }`) rendering `DESIGN.md`'s `components.temporal_filter` tokens verbatim (`base`/`option`/`option_active`/`option_inactive` class strings) on top of the new `radio-group.tsx` primitive — this gets roving-tabindex/`role="radiogroup"`/`role="radio"` semantics for free from Radix rather than a hand-rolled keydown handler (the Gate 2 flagged item). Map the "All" option's Radix `value` to a sentinel string (e.g. `'ALL'`) since Radix's `RadioGroup.Item` requires a non-empty string value, translating to/from the component's own `null`-means-All contract at the boundary.
  - [ ] Export `TemporalFilterToggle`/`TemporalFilterToggleProps` from `packages/ui/src/features/events/index.ts`.

- [ ] **Task 6 — Wire into `EventDiscoveryPanel.tsx` (AC: 6)**
  - [ ] Add `temporalFilter: 'TODAY' | 'UPCOMING' | null`, `onTemporalFilterChange: (value: 'TODAY' | 'UPCOMING' | null) => void`, and `temporalFilterLabels: { today: string; upcoming: string; all: string; groupLabel: string }` to `EventDiscoveryPanelProps` (`EventDiscoveryPanel.types.ts`).
  - [ ] In `EventDiscoveryPanel.tsx`'s render, insert `{currentViewId === 'card' && (<TemporalFilterToggle value={temporalFilter} onChange={onTemporalFilterChange} labels={temporalFilterLabels} />)}` as a new child of the existing `<div className="flex flex-col gap-6">`, between `<SearchBar .../>` and `<FilterHub .../>`.
  - [ ] Extend `EventDiscoveryPanel.test.tsx`: assert the toggle renders when `currentViewId === 'card'` and is absent when `currentViewId === 'calendar'`.

- [ ] **Task 7 — Wire into `home-content.tsx` (AC: 7, 8, 10, 11)**
  - [ ] Add `const [temporalFilter, setTemporalFilter] = useQueryState('temporal', parseAsStringEnum<'TODAY' | 'UPCOMING'>(['TODAY', 'UPCOMING']))` (no `.withDefault(...)` — absent/`null` means "All," matching AC7).
  - [ ] Add `temporalFilter` into `useListPaginationController`'s `filterKey` object and into `useInfiniteQuery`'s `queryKey` array (both already list `{ q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter }` — add `temporalFilter` as a sibling field in both places, not a replacement).
  - [ ] Update the `queryFn`'s condition-building call: when `aiFilter.activeFilter` is set, call `buildEventsQueryCondition({ filter: { ...aiFilter.activeFilter, temporalFilter } })`; otherwise `buildEventsQueryCondition({ search: q, types, categories, nearby: resolvedNearby, temporalFilter })`.
  - [ ] Add a `handleTemporalFilterChange` handler: calls `setTemporalFilter(value)` and `posthog.capture('temporal_filter_changed', { value: value ?? 'ALL' })` (AC11).
  - [ ] Pass `temporalFilter`, `onTemporalFilterChange={handleTemporalFilterChange}`, and `temporalFilterLabels={{ today: t('temporalFilterTodayLabel'), upcoming: t('temporalFilterUpcomingLabel'), all: t('temporalFilterAllLabel'), groupLabel: t('temporalFilterGroupLabel') }}` into the existing `<EventDiscoveryPanel>` call.
  - [ ] Confirm `CalendarView`'s own props/query (`q`/`types`/`categories`/`nearby`) are **not** given a `temporalFilter` prop — the calendar view must keep expressing time structurally, unaffected (AC6, AC8).
  - [ ] Extend `home-content.test.tsx` (Story 0.i5b's file): new cases asserting (a) a temporal-filter change resets `offset` to `0` on the next request (mirroring the existing filter-change-resets-offset test), (b) `temporalFilter` is present in the request when set and absent from the resulting SQL narrowing when `null`, (c) `temporal_filter_changed` fires with the correct payload.

- [ ] **Task 8 — i18n strings (AC: 10)**
  - [ ] Add `temporalFilterTodayLabel`, `temporalFilterUpcomingLabel`, `temporalFilterAllLabel`, `temporalFilterGroupLabel` to `apps/web/locales/en.json`'s `DiscoveryPage` namespace (values: "Today," "Upcoming," "All," "Filter events by time") and the matching Indonesian strings to `apps/web/locales/id.json`'s `DiscoveryPage` namespace.

- [ ] **Task 9 — Verification (AC: all)**
  - [ ] `pnpm --filter web codegen` — regenerates `EventFilterInput`/`TemporalFilter` client types.
  - [ ] `pnpm --filter @festgrid/domain test` — new `buildEventsQueryCondition`/fixture coverage green.
  - [ ] `pnpm --filter @festgrid/graphql-select test` (or the correct package name/script for `packages/graphql-select`) — new `notEnded` operator tests green.
  - [ ] `pnpm --filter @festgrid/ui test -- TemporalFilterToggle EventDiscoveryPanel format-event-date` — all green, no regressions.
  - [ ] `pnpm --filter web test -- home-content` — new cases green.
  - [ ] `pnpm --filter backend test -- resolvers` (requires a live local/CI Postgres, matching this file's existing pattern) — new `TODAY`/`UPCOMING`/ended-cases integration coverage green.
  - [ ] `pnpm lint` / `pnpm build` (repo root) — clean.
  - [ ] Manual `git diff`/file list confirms no unrelated files touched.

## Dev Notes

- **Scope boundary, matching Story 0.i5b's own narrow-single-surface precedent:** this story wires the temporal filter into **Discovery's card view (`home-content.tsx`) only**. `EXPERIENCE.md`'s prose mentions Feed/Favorites as pages that "own the committed value via `useListPaginationController`," but neither page has adopted that controller yet (Feed/Favorites adoption is unscoped future work per Story 0.i5b's own "Out of Scope"), and `epics.md`'s actual Story 0.i5d AC text is scoped to "the event list filter row" (singular), not all three pages. Feed/Favorites are explicitly Out of Scope here — see below.

- **Read-files-being-modified summary** (all read in full before drafting):
  - `EventDiscoveryPanel.tsx` — a `<div className="flex flex-col gap-6">` currently holds exactly `SearchBar` then `FilterHub` as its only two children, both always rendered (view-switching happens lower down, outside this div, via `activeContent`). No structural blocker to inserting a third, conditionally-rendered child between them.
  - `home-content.tsx` — already fully wired for `useListPaginationController` (Story 0.i5b) and the `aiFilter.activeFilter ? buildEventsQueryCondition({filter}) : buildEventsQueryCondition({search, types, categories, nearby})` branch (line ~177-179). This story adds one more field to both branches' inputs; it does not change the branching structure itself.
  - `buildEventsQueryCondition.ts` — already has a two-branch (`if (filter) {...} else {...}`) structure with near-duplicate handling of `types`/`categories`/`keyword`/`search` across both branches (an existing pattern, not introduced by this story) — the new `temporalFilter` handling follows the same duplication-across-branches shape but is deliberately **not** duplicated itself: a single `buildTemporalCondition()` helper is called from both branches (Task 1), a small improvement over the existing branch style rather than adding a third copy-pasted block.
  - `drizzle-where.ts` — already has 7 operator cases; the new `notEnded` case is additive, no existing case is touched.
  - `resolvers.ts`'s `events` resolver — already has ~13 fieldMap entries including the closest two precedents: `scheduleDateRange` (descriptor-object-to-`EXISTS`-subquery, the pattern `notEnded` follows) and `isPastEvent` (a raw-`sql`-template boolean fieldMap entry, evaluated via `eq`/`ne` rather than a dedicated operator — considered as an alternative shape for `!ended` but **not** used, because AD-20 Rule 2 explicitly specifies "extending the same fieldMap-descriptor-to-`EXISTS`-subquery pattern `scheduleDateRange.overlaps` already uses," i.e. a real new operator case, not an `isPastEvent`-style raw fieldMap value).
  - `format-event-date.ts` — `formatEventStatus`'s `ended` boolean (lines ~154-160) is computed inline today; Task 3 extracts it to `isEventEnded()` without changing `formatEventStatus`'s own behavior or signature (AC9's non-negotiable constraint).
  - `EventCard.tsx` — confirmed the only call site of `formatEventStatus`, passing `activeTimezone` (`timezone` prop, falling back to ambient `useScopedTimezone()`, which resolves to `undefined` today since no `timezone` prop is ever passed at any `<EventCard>` render site and no app-wide timezone provider value is wired yet — see Dev Notes below). Confirmed unaffected by this story (AC9).

- **Timezone scope of the `!ended` mirror (read before implementing Task 2/3 — the single trickiest correctness point in this story):** `formatEventStatus`'s `ended` calculation is, in principle, timezone-aware (`getLocalDateInTimezone(now, timezone)`/`getCalendarDayDifference`). In practice, **no call site in this codebase currently passes a real per-event timezone** — `EventCard.tsx` always falls back to `useScopedTimezone()`'s ambient context value, and `project-context.md` explicitly documents "No app-wide timezone is sourced yet." So today, in production, `formatEventStatus`'s `ended` boundary is computed with `timezone: undefined`, which makes `Intl.DateTimeFormat` fall back to the **browser's own local system timezone** — a value the backend cannot know or reproduce. AD-20's own Rule 2 (the literal SQL translation spec) never mentions a timezone parameter at all — it only combines the raw date/time columns with a **literal instant**. This story's new SQL condition therefore does the comparison with **no timezone conversion on either side** (naive date/timestamp arithmetic, `today`/`now` computed once client-side via this DSL's own existing UTC-based `fmt()`/`toISOString()` conventions — the same convention every other date literal in `buildEventsQueryCondition.ts` already uses, e.g. `resolveDateRangeFilter`). The shared `ended-cases.ts` fixture (Task 3) is asserted against `isEventEnded(..., timezone: undefined, ...)` specifically so both sides of the "exactly mirror" requirement are exercised under the same (lack of) timezone conversion — this is a deliberate scope decision, not an oversight, and matches how every other existing date filter in this DSL (`resolveDateRangeFilter`, `getDays`, `computePastEventThreshold`) is already UTC/naive-based rather than per-event-timezone-aware. If a future story ever wires a real per-event timezone into `formatEventStatus`, this SQL condition's fidelity to it would need revisiting then — out of scope now, and not a regression introduced by this story (the two sides are exactly as timezone-naive as each other today).
  - **Concrete correctness risk called out for Task 2:** casting a `'Z'`/offset-suffixed ISO string directly to Postgres's `timestamp` (timezone-naive) type does **not** simply strip the suffix — Postgres reinterprets the value through the session's `TimeZone` GUC. `apps/backend/src/db/client.ts`'s `postgres()` client does not pin `TimeZone` to `UTC` today. Task 2's SQL must therefore strip the trailing `Z`/offset from the `now` literal before the `::timestamp` cast (shown in Task 2's code sketch) so the comparison is deterministic regardless of the session's configured timezone — otherwise this story would introduce a genuine, easy-to-miss production bug (a wrong `TODAY` boundary that silently shifts if the DB session's default timezone ever isn't UTC).

- **Why the DSL needs a top-level `temporalFilter` param, not just an `EventFilterInput.temporalFilter` field (a design decision, not asked to the user — mechanical, matches existing `types`/`categories` precedent exactly):** `home-content.tsx`'s ordinary (non-AI) path never constructs an `EventFilterInput` object at all — it calls `buildEventsQueryCondition({ search, types, categories, nearby })`, the function's `else` branch. `types`/`categories` already exist as **both** an `EventFilterInput` field (used by the AI-filter `if (filter)` branch and the resolver's server-side `filter:` argument) **and** a top-level `BuildEventsQueryConditionInput` param (used by the `else` branch) — this is pre-existing, not new. `temporalFilter` follows the identical dual shape so Discovery's ordinary card-view path (which never touches `EventFilterInput` directly) can still apply it.

- **DB Index Research (`EXPLAIN ANALYZE`) — run during story creation (2026-09-17), per the backlog note's own verbatim research prompt, mirroring `schedule_event_date_idx`'s prior methodology (`_bmad-output/implementation-artifacts/2-7-automatically-hide-past-events.md`):**
  - **Volume seeded:** 30,000 synthetic `events` / 48,030 synthetic `schedules` rows (~1.6 schedules/event) in a throwaway scratch database (`festgrid_explain_scratch`), tagged for isolation, fully dropped after the spike. Companion-filter selectivity (`types && ARRAY['MUSIC'] AND categories && ARRAY['ARTS_AND_CULTURE'] AND location ILIKE '%Chicago%'`) matched ~15% of events (4,480/30,000). Temporal selectivity (schedules overlapping "today") was ~25% (12,044/48,030), weighted across past/today-only/future/spanning-today buckets, with the today-only bucket split ~50/50 already-ended-vs-not-yet-ended to exercise both sides of the new boundary, and realistic independent nulls on `event_end_date`/`event_start_time`/`event_end_time`.
  - **Exact SQL tested** (combined at the top `WHERE` level, per AD-20 Rule 2's `and` framing): the existing, unmodified `scheduleDateRange.overlaps{today,today}` `EXISTS` subquery, ANDed with a new `NOT EXISTS` anti-join asserting no schedule is both overlapping today AND already past `(COALESCE(event_end_date, event_start_date)::timestamp + COALESCE(event_end_time, TIME '23:59:59.999999')) < now::timestamp` — combined with `types`/`categories`/`location` filters and the real `Query.events` `ORDER BY`(next-upcoming-schedule subquery)/`LIMIT 10 OFFSET 0` shape, matching `resolvers.ts`'s actual query structure, not the temporal condition in isolation.
  - **Before** (existing `schedule_event_date_idx` only): 36.2-38.0ms execution time across 5 runs. The new condition's `COALESCE(...) + event_end_time` comparison landed as a post-scan `Filter`, not an `Index Cond`, inside an `Index Scan using schedule_event_date_idx` keyed on `event_id` (Buffers: shared hit=6377, ~48% of total query buffer hits). The plan's actual dominant costs were elsewhere and are pre-existing/unrelated to this story: a `Seq Scan on events` (~17ms, `types`/`categories` use plain btree indexes incompatible with the DSL's `&&` overlap operator) and the pre-existing next-upcoming-schedule `ORDER BY` correlated subquery.
  - **After** (candidate index `schedule_event_end_ts_idx` on `schedules (event_id, (COALESCE(event_end_date, event_start_date)::timestamp + COALESCE(event_end_time, TIME '23:59:59.999999')))`, hand-written mirroring migration `0055`'s style since drizzle-kit 0.21.4 cannot express expression indexes): the condition **did** move into `Index Cond` (Buffers: shared hit=5549, ~13% fewer for this subplan) — but **total execution time did not improve**: 40.3-43.5ms across 5 runs, i.e. flat-to-~10%-*slower* than baseline, confirmed in both index-drop→before and index-add→after ordering to rule out cache-warming bias. Root cause: the `daterange` overlap predicate isn't covered by this index either, so a heap visit per candidate row is still required regardless of which predicate is in `Index Cond` vs. `Filter`; the anti-join only ever touches ~1,200-1,600 rows at this volume, leaving little absolute cost to shave.
  - **Recommendation (decisive, evidence-based): do not add a new index.** The existing `schedule_event_date_idx` is sufficient — it already keeps this an `Index Scan`, not a sequential scan, and the residual `Filter` cost does not respond to a purpose-built expression index at this realistic volume. **Task 2's SQL shape (Dev Notes above) is confirmed correct as sketched — implement it as-is, do not add `schedule_event_end_ts_idx` or any variant.** If a future story wants to improve this query's performance, the correctly-scoped target is the unrelated, pre-existing `Seq Scan on events` (a `types`/`categories`-index-type gap, not a `!ended`-condition gap) — out of scope here.
  - **Cleanup confirmed:** scratch database dropped, all scratch files removed (none were git-tracked), local Postgres 16 cluster stopped (returned to its pre-spike `down` state), `git status` clean throughout — no persistent trace of this research spike.

### Architecture & UX Gate Findings

No `epic-0-i5-readiness.md` sweep exists yet (only `epic-0-readiness.md`, `epic-0-i7-readiness.md`, `epic-1-i1-readiness.md`, `epic-1-readiness.md` through `epic-7-readiness.md` exist under `epic-readiness/`), so Gates 1, 2, and 3 were run fresh for this story (not cited from a swept report), matching Story 0.i5a/0.i5b's own precedent for this same un-swept epic.

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Verified via subagent analysis: nothing in this scope calls a DB/domain package directly from the frontend (the frontend only builds and ships a `QueryCondition` DSL tree; the new `drizzle-where.ts` case and its resolver fieldMap entry live entirely server-side), no external service is called from the frontend, no new API surface is introduced (the existing `Query.events` field is reused verbatim, only an enum + optional input field are added to the existing `EventFilterInput` type), no auth/secrets/business-rule logic is added to frontend code (the one client-resolved value, `now.toISOString()`, mirrors the existing `buildDefaultEventVisibilityConditions` resolve-once-then-embed-as-literal precedent), and no new undeployed infra is introduced.
- **Gate 2 (UI Complexity & Reusability) — No gap found; one non-blocking flag addressed directly in this story's scope (not deferred).** The new control is single-use (`EventDiscoveryPanel.tsx`, card view only) with only two simple visual states (`option_active`/`option_inactive`, no media/loading/empty/error states) — does not meet Gate 2's reuse+complexity bar for splitting into a separately-shipped generic `packages/ui/src/core/` primitive. **Flagged item:** the UX spec's "single-select with roving tabindex" requirement is real keyboard-interaction logic, not just static markup, and the initial draft scope under-specified it. Resolved directly (not deferred to a follow-up) by building `TemporalFilterToggle` on top of a new `@radix-ui/react-radio-group`-backed primitive (Task 5) rather than a hand-rolled keydown handler — Radix's `RadioGroup` already implements correct `role="radiogroup"`/`role="radio"`/roving-tabindex semantics, matching this repo's existing Shadcn/Radix convention (`tabs.tsx`, `popover.tsx`) rather than reinventing accessibility primitives.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Every mechanism this story touches already has its own owning story in `epics.md` and is already in active use: the GraphQL schema/codegen pipeline (Story 0.8), the Unified Query DSL (AD-1/Story 1.3, already used by `types`/`categories`/`dayOfWeek`/date-range filters), `useListPaginationController` (Story 0.i5a, built specifically so sibling stories like this one would consume it), i18n (Story 0.6/`next-intl`), and PostHog (Story 1.8). The UX spec (`EXPERIENCE.md`/`DESIGN.md`) is already fully authored by a completed `bmad-ux` pass. No dependency here is missing a corresponding story in `epics.md`.

### `packages/ui` / `packages/domain` reusability check

- `TemporalFilterToggle` (new, `packages/ui/src/features/events/`) and the new `radio-group.tsx` structural primitive (new, `packages/ui/src/core/ui/`) both belong in `packages/ui` per project-context.md's Domain Features vs. Core Primitives split — `radio-group.tsx` is a generic, domain-agnostic Radix wrapper (Core Primitive); `TemporalFilterToggle` is event-domain-specific (Domain Feature), matching `FilterHub.tsx`'s own placement.
- The new `TemporalFilter` enum and `buildTemporalCondition()` helper belong in `packages/domain/src/events/buildEventsQueryCondition.ts` (event-specific, not a generic cross-entity mechanism — the generic DSL engine itself already lives in `packages/domain/src/query/`, unmodified by this story).
- `isEventEnded()` (extracted from `format-event-date.ts`) stays in `packages/ui/src/features/events/` — it is pure, framework-agnostic JS, but it's the existing home of `formatEventStatus` and its sibling date-formatting functions (an established precedent in this repo, not something this story should relocate to `packages/domain` given the badge's other logic lives there too and `packages/domain` per project-context.md's Code Organization rule is meant for framework-agnostic *business* logic shared across frontend/backend — `format-event-date.ts`'s functions are UI-display-formatting logic, not queried/persisted business rules, and moving only `isEventEnded` while leaving `formatEventStatus` behind would split one cohesive unit of logic across two packages for no benefit). The `ended-cases.ts` **fixture data itself** goes in `packages/domain` specifically because it must be importable by both `packages/ui` (formatEventStatus/isEventEnded's tests) and `apps/backend` (the new SQL condition's integration tests) — `packages/ui` is not a dependency `apps/backend` could take, but `packages/domain` already is a dependency of both.

### State management categorization

Per `project-context.md`'s three-tier model (AD-4), the temporal filter's committed value is **URL State** (`nuqs`, the `temporal` query param) — identical categorization to `q`/`types`/`categories` in this same file. `TemporalFilterToggle`'s own roving-tabindex focus index (owned internally by Radix's `RadioGroup`) is hook/component-internal implementation detail state, beneath AD-4's three tiers — same categorization Story 0.i5a already established for `useListPaginationController`'s own internal state.

### Loader categorization

Not applicable — no new asynchronous operation is introduced. The temporal filter reuses the exact same `useInfiniteQuery`/`useInfiniteScroll` fetch this page already performs for every other filter change; the existing Non-Blocking (Infinite Scroll)/Skeleton loader rules apply unchanged.

### Analytics (AD-5) check

New event required and specified in AC11: `temporal_filter_changed`, payload `{ value: 'TODAY' | 'UPCOMING' | 'ALL' }`, fired from `home-content.tsx`'s new `handleTemporalFilterChange`, matching the existing `filter_applied`/`view_switched`/`search_submitted` per-user-action event convention already established in this exact file.

### i18n (AD-6) check

Four new locale keys required (AC10, Task 8): `temporalFilterTodayLabel`, `temporalFilterUpcomingLabel`, `temporalFilterAllLabel`, `temporalFilterGroupLabel`, added to both `apps/web/locales/en.json` and `apps/web/locales/id.json`'s existing `DiscoveryPage` namespace.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch — this is a purely additive schema/type change plus one new SQL boolean condition; no existing field's type, nullability, or shape changes.
- **Impacted fields/contracts:** New: GraphQL `enum TemporalFilter`, `EventFilterInput.temporalFilter: TemporalFilter` (optional), domain's local `TemporalFilter` TS enum + `EventFilterInput.temporalFilter`/`BuildEventsQueryConditionInput.temporalFilter` fields, and the exported `isEventEnded` function + `ENDED_CASE_FIXTURES` fixture/type. No DB columns are added or changed — the new SQL condition reads existing `schedules.eventStartDate`/`eventEndDate`/`eventEndTime` columns only.
- **Required DB migration changes:** None. Task 4's `EXPLAIN ANALYZE` research (Dev Notes above) reached a decisive conclusion that the existing `schedule_event_date_idx` is sufficient — a candidate new expression index measured ~10% *slower*, not faster, at realistic volume. No migration is added by this story.
- **Required TypeScript type changes:** `apps/web/src/generated/graphql.ts` regenerates via `pnpm --filter web codegen` after the schema change (Task 1) — this is a generated-file change, not a hand-edit. `packages/domain`'s local `EventFilterInput`/`BuildEventsQueryConditionInput` interfaces gain one new optional field each (Task 1).
- **Backward compatibility and rollout notes:** Fully additive and opt-in — `temporalFilter` absent/null preserves exactly today's behavior on every existing consumer (Feed, Favorites, any saved AI filter, any existing bookmark/shared URL with no `temporal` param). No existing query, resolver, or client call site breaks.
- **Verification checks:** `packages/domain`/`packages/graphql-select`/`packages/ui` unit tests (Tasks 1-3, 5), `apps/backend` integration tests against a live DB (Task 3), `tsc`/ESLint clean across all touched packages (Task 9).

### Project Structure Notes

- New files: `packages/domain/src/events/__fixtures__/ended-cases.ts` (first `__fixtures__` folder in this repo — no existing precedent to match beyond this repo's general "one small file per concern" convention already used throughout `packages/domain/src/events/`); `packages/ui/src/core/ui/radio-group.tsx`; `packages/ui/src/features/events/TemporalFilterToggle.{tsx,types.ts,test.tsx}`.
- Modified files: `apps/backend/src/schema/events.graphql`, `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/schema/resolvers.test.ts`, `packages/domain/src/events/buildEventsQueryCondition.ts`, `packages/domain/src/events/index.ts`, `packages/graphql-select/drizzle-where.ts`, `packages/graphql-select/drizzle-where.test.ts`, `packages/ui/src/features/events/format-event-date.ts`, `packages/ui/src/features/events/format-event-date.test.ts`, `packages/ui/src/features/events/EventDiscoveryPanel.tsx`, `packages/ui/src/features/events/EventDiscoveryPanel.types.ts`, `packages/ui/src/features/events/EventDiscoveryPanel.test.tsx`, `packages/ui/src/features/events/index.ts`, `packages/ui/package.json`, `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/home-content.test.tsx`, `apps/web/locales/en.json`, `apps/web/locales/id.json`, `apps/web/src/generated/graphql.ts` (codegen-regenerated).
- No conflicts detected with the unified project structure — every new file follows an existing sibling-file naming/co-location convention (matching `.types.ts`/`.test.ts` triplets, `__fixtures__` as a subfolder, `core/ui/*.tsx` for Radix wrappers).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i5d] (this story's authoritative As-a/I-want/So-that and AC scope, and its "Depends on: Story 0.i5a" note)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-20] (full rule text, including the 2026-09-17 same-day amendment that shrank the mechanism to `!ended`-only, and the explicit deferred-DB-index clause this story's Task 4 resolves)
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Temporal Filter: Today / Upcoming / All (Card View Only)] (format, position, data-flow, and exact Today/Upcoming/All semantics)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#components.temporal_filter] (exact Tailwind token classes for `TemporalFilterToggle`)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-019] (full decision trail: original proposal, the "implementation wrinkle" that turned out not to apply, the Happening-Now→Today/Upcoming amendment, and the verbatim OPEN RESEARCH ITEM this story's Task 4 addresses)
- [Source: _bmad-output/implementation-artifacts/0-i5a-build-the-shared-pagination-filter-controller.md, 0-i5b-adopt-the-controller-in-discovery-event-list-surfaces.md] (the `useListPaginationController` contract this story adopts, and the exact `filterKey`/`queryKey` integration pattern this story extends)
- [Source: packages/domain/src/events/buildEventsQueryCondition.ts] (read in full — existing DSL-building function this story extends; `fmt()`/`resolveDateRangeFilter`/`getDays` UTC-based date-literal precedent)
- [Source: packages/graphql-select/drizzle-where.ts, drizzle-where.test.ts] (read in full — existing operator `switch`/test style this story extends)
- [Source: apps/backend/src/schema/resolvers.ts lines 2873-3034] (read in full — the `events` resolver's `filter`/`query` merge logic and existing fieldMap, including the `scheduleDateRange`/`isPastEvent` precedents this story's new fieldMap entry is modeled on)
- [Source: apps/backend/src/db/client.ts] (read in full — confirms no session `TimeZone` pin exists today, the basis for Task 2's naive-timestamp correctness note)
- [Source: packages/ui/src/features/events/format-event-date.ts, EventCard.tsx] (read in full — `formatEventStatus`'s existing `ended` computation and its only call site's `activeTimezone` resolution, confirming the no-real-per-event-timezone-wired-yet basis for this story's timezone-scope decision)
- [Source: packages/database/schema.ts lines 369-406, migrations/0055_fix_schedule_event_date_idx.sql] (schedules table columns/existing `schedule_event_date_idx`; the drizzle-kit-can't-express-expression-indexes precedent Task 4 follows if a new index is warranted)
- [Source: _bmad-output/implementation-artifacts/2-7-automatically-hide-past-events.md] (the exact prior `EXPLAIN ANALYZE`-against-30k-synthetic-rows methodology this story's Task 4 research mirrors)
- [Source: packages/ui/src/features/events/EventDiscoveryPanel.tsx, EventDiscoveryPanel.types.ts, FilterHub.tsx] (read in full — exact insertion point and prop-shape precedent for `TemporalFilterToggle`)
- [Source: apps/web/src/app/[locale]/home-content.tsx] (read in full — exact wiring points for `filterKey`/`queryKey`/the `filter`-vs-top-level-param branch)
- [Source: packages/ui/package.json, packages/ui/src/core/ui/tabs.tsx] (existing `@radix-ui/*` dependency/wrapper-style precedent for the new `radio-group.tsx`)
- [Source: apps/web/locales/en.json, id.json#DiscoveryPage] (existing locale-key namespace this story adds to)

### Backlog row history (IDEA-019, verbatim, moved from backlog.yaml 2026-09-18)

Requested by user via `bmad-help`, who also flagged the existing filter row (`FilterHub.tsx`:
Type, Category, Location-when-authenticated, AI-filter sparkle, all in one `flex flex-wrap`
row) as already tight on mobile — echoes IDEA-011's related apply-timing note on the same row.
No status/temporal filter existed on the events query at capture time; CC-019's status badges
are display-only, not a filter. Suggested resolution: (1) format — a 3-way mutually-exclusive
segmented toggle (Happening now / Upcoming / All), not a dropdown-select or a 4th
facet-popover button; (2) position — its own row inside `EventDiscoveryPanel.tsx` between
SearchBar and the FilterHub facet row, full-width on mobile, collapsing inline as the leading
control in that row on desktop. Default to "All" to preserve current behavior. RULE
(user-added 2026-09-11): applies to card view only — WeeklyCalendarView already expresses time
structurally via its own date grid/day grouping.

**RESOLVED (bmad-ux, 2026-09-17 + bmad-architecture AD-20, 2026-09-17):** the toggle renders
inside EventDiscoveryPanel's own JSX (sibling of SearchBar/FilterHub), gating on
`currentViewId==='card'` is a plain local conditional. UX: EXPERIENCE.md "Temporal Filter:
Today / Upcoming / All (Card View Only)" — `role=radiogroup` segmented control
(`components.temporal_filter`). Architecture: AD-20 — new `EventFilterInput.temporalFilter`
enum (`TODAY | UPCOMING`), client-resolved literal instant (not SQL `NOW()`).

**AMENDED same day (user-directed):** first bucket renamed "Happening now" → "Today" and
redefined from `started&&!ended` to just `!ended`; second bucket "Upcoming" redefined from
`!started` to `eventStartDate > todayISO`, keeping the two buckets a clean non-overlapping
partition. This shrank AD-20's own mechanism: UPCOMING needs ZERO new backend code (fully
expressible via the existing `scheduleDateRange.overlaps{from: tomorrowISO, to: null}`) — only
TODAY's new `!ended` `drizzle-where.ts` check remains genuinely new.

**OPEN RESEARCH ITEM, resolved 2026-09-17 via bmad-create-story:** `EXPLAIN ANALYZE` run
against 30,000 synthetic events/48,030 synthetic schedules (throwaway scratch DB). Decisive
result: the existing `schedule_event_date_idx` is sufficient (36.2-38.0ms baseline, Index Scan)
— a candidate hand-tuned expression index measured ~10% SLOWER (40.3-43.5ms), so no new index
migration was added. Full before/after plans in this story's own Task 4.

**PROMOTED 2026-09-17 via bmad-create-story (row named directly by the user):** this story
(0.i5d) implements the full `!ended` `drizzle-where.ts` mechanism, the
`EventFilterInput.temporalFilter` schema field, the shared ended-cases fixture
(`packages/domain`), and the `EventDiscoveryPanel`/`home-content.tsx` wiring — scoped to
Discovery's card view only. Gate 2 flagged the UX spec's "roving tabindex" requirement,
resolved directly in-story via a new Radix-backed radio-group primitive rather than deferred.
Carved the one genuinely uncovered part — EXPERIENCE.md's mention of Feed/Favorites also
owning a committed temporal-filter value via `useListPaginationController`, which neither page
has adopted yet (BUG-025, still open) — into child row IDEA-038 rather than silently dropping
it.

## Global Rules References

- [x] `_bmad-output/project-context.md` — API & Data (GraphQL/DSL conventions), Database Indexing (Task 4's research obligation), UI Patterns & UX Invariants (AD-18 `useListPaginationController` adoption), State Management Architecture (AD-4, URL State categorization), Code Organization (`packages/ui`/`packages/domain` placement, see reusability check), Locale-Sensitive Data Rendering (AD-6)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1 (Unified Query DSL), AD-18 (Filter Apply-Timing Convention / `useListPaginationController`), AD-20 (this story's primary authority, including its same-day amendment)
- [x] `docs/infrastructure/index.md` — reviewed; not applicable at the infra-shard level (no new SQS/Lambda/EventBridge/API Gateway/DB-provisioning change — this is a GraphQL schema field + a new SQL WHERE-condition on an existing table, covered by `project-context.md`'s Database & Performance rules directly rather than the infra shards)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:** see "Project Structure Notes" above for the complete new/modified file list.
- **Rule Mapping:**
  - AD-1 (Unified Query DSL) → Tasks 1-2's DSL/operator additions, reusing the existing `scheduleDateRange`/`overlaps` mechanism rather than a new endpoint.
  - AD-18 (`useListPaginationController` adoption) → Task 7's `filterKey`/`queryKey` wiring, identical pattern to Story 0.i5b.
  - AD-20 (this story's owning architecture decision) → Tasks 1-4 implement its Rules 1-4 verbatim; Task 4 resolves its explicitly deferred DB-index clause.
  - `story-split-gate.md` Gate 1/2/3 → all run fresh, no gap; Gate 2's flagged roving-tabindex item resolved directly via Task 5's Radix-backed primitive, not deferred.
  - AD-5 (Analytics) → Task 7's `temporal_filter_changed` event.
  - AD-6 (i18n) → Task 8's locale keys.
  - Database Indexing rule (`project-context.md`) → Task 4's `EXPLAIN ANALYZE` research and conditional migration.
  - Data Type Compatibility rule (this workflow) → dedicated Dev Notes section above; no mismatch found, purely additive.
- **Verification Plan:** see Task 9 — full per-package unit/integration test run, `tsc`/ESLint, and a manual `git diff` scope confirmation.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — this story covers Discovery's card view (`home-content.tsx`) only; Feed/Favorites adoption, the calendar view, and AI-filter-prompt wiring for `temporalFilter` are all explicitly Out of Scope (see below).
- [ ] Architecture and boundary confirmation — AD-20's mechanism is implemented as specified (no new SQL for `UPCOMING`, exactly one new `drizzle-where.ts` case for `TODAY`); no unauthorized package-boundary crossing (see reusability check).
- [ ] Testing plan confirmation — Task 9's verification plan covers AC1-11 across `packages/domain`, `packages/graphql-select`, `packages/ui`, `apps/web`, and `apps/backend` (real-DB integration tests for the fixture parity requirement).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates run fresh for this story (no swept `epic-0-i5-readiness.md` exists yet), all three found no gap; Gate 2's roving-tabindex flag is resolved directly within this story's own Task 5, not deferred to a prerequisite.
- [x] DB index recommendation (Task 4) reviewed and accepted before coding begins — see Dev Notes "DB Index Research": decisive, evidence-based "no new index" result; nothing further to decide before coding.

## Testing Requirements

- [ ] Unit tests — `packages/domain` (`buildEventsQueryCondition`'s new `temporalFilter` branches + `ended-cases` fixture shape), `packages/graphql-select` (`drizzle-where.test.ts`'s new `notEnded` case), `packages/ui` (`TemporalFilterToggle.test.tsx`, `format-event-date.test.ts`'s new `isEventEnded`/fixture-driven cases, `EventDiscoveryPanel.test.tsx`'s card/calendar gating cases).
- [ ] Integration tests — `apps/web/src/app/[locale]/home-content.test.tsx` (temporal-filter-triggers-reset, request-shape, analytics-event cases); `apps/backend/src/schema/resolvers.test.ts` (real-DB `TODAY`/`UPCOMING` filtering, including every `ended-cases` fixture entry, per AC5).
- [ ] E2E tests — not required; no new critical user flow beyond what Discovery's existing Playwright coverage (if any) already exercises. A future `bmad-testarch` pass may add one if the team wants explicit end-to-end coverage of the toggle, but it is not a blocking requirement of this story.

## Deliverables Checklist

- [ ] `EventFilterInput.temporalFilter: TemporalFilter` added to the GraphQL schema; client types regenerated.
- [ ] `buildEventsQueryCondition.ts` translates `TODAY`/`UPCOMING` per AD-20 Rules 2-3, via both the `filter` and top-level-param paths.
- [ ] `drizzle-where.ts` gains exactly one new `notEnded` operator case; `resolvers.ts` gains the matching `scheduleEndedBoundary` fieldMap entry.
- [ ] `packages/domain/src/events/__fixtures__/ended-cases.ts` exists and is imported by both `format-event-date.test.ts` and `resolvers.test.ts`.
- [ ] `formatEventStatus`'s `ended` logic is extracted to `isEventEnded()` with zero behavior change to `formatEventStatus` itself.
- [ ] `TemporalFilterToggle` renders `DESIGN.md`'s tokens, built on a new Radix-backed `radio-group.tsx` primitive.
- [ ] `EventDiscoveryPanel.tsx` renders the toggle only when `currentViewId === 'card'`.
- [ ] `home-content.tsx` threads the committed value through `useListPaginationController`/`queryKey`, fires `temporal_filter_changed`, and passes the new i18n labels.
- [x] Task 4's DB index research is complete — decisive "no new index" recommendation, documented with full before/after `EXPLAIN ANALYZE` evidence in Dev Notes.
- [ ] All Task 9 verification commands pass.

## Out of Scope

- **Feed (`feed-content.tsx`) and Favorites (`favorites-content.tsx`) adopting the temporal filter** — neither page has adopted `useListPaginationController` yet (unscoped future work per Story 0.i5b's own "Out of Scope"); adding the toggle there without that foundation would reintroduce BUG-019's failure mode on a new surface. A future story should adopt both together once/if those pages adopt the controller.
- **The calendar view (`WeeklyCalendarView.tsx`/`CalendarView.tsx`)** — explicitly and permanently out of scope per `EXPERIENCE.md`'s own rule: the calendar already expresses time structurally; the toggle must not render or apply there (AC6).
- **Wiring `temporalFilter` into the AI-filter prompt/JSON schema** (`resolvers.ts`'s Gemini system instruction, `transformGeminiResponseToEventFilter`) — the AI filter can still be combined with an independently-selected temporal toggle value (Task 7 merges them), but the AI itself is not taught to recognize/emit `temporalFilter` from a free-text prompt. A future story could add this if there's a concrete need.
- **`type EventFilter` (the AI-filter echo/output type) gaining a `temporalFilter` field** — not needed since no path returns a temporal-filter-bearing `EventFilter` value today (saved AI filters don't carry it, per the bullet above).
- **A dedicated, generically-reusable segmented-control primitive shipped as its own `packages/ui/src/core/` component with its own story** — Gate 2 confirmed this control is single-use; `radio-group.tsx` (the low-level Radix wrapper) is the reusable seam, not `TemporalFilterToggle` itself.
- **Retroactively re-deriving `formatEventStatus`'s `ended` boundary to be genuinely per-event-timezone-aware** — both this story's new SQL condition and the existing badge already share the same (lack of) timezone handling; making either one "more correct" without the other would break, not preserve, AD-20's "exactly mirror" requirement. Tracked as a natural follow-up if a future story ever wires a real per-event timezone into the badge.

## Definition of Done

- [ ] AC 1-11 satisfied.
- [ ] Required tests passing (Task 9).
- [ ] Lint and type checks passing for every touched package.
- [x] Task 4's DB index research documented and its recommendation (no migration needed, evidence-based) acted on.
- [ ] Pre-Coding Approval Gate's explicit human approval obtained before implementation starts.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

- 2026-09-17: Story drafted via `bmad-create-story` (IDEA-019 dispatch). Gates 1/2/3 run fresh via subagent (no `epic-0-i5-readiness.md` sweep exists) — all "No gap found"; Gate 2's roving-tabindex flag resolved directly into Task 5's scope (Radix `RadioGroup`-backed primitive) rather than deferred. DB index `EXPLAIN ANALYZE` research (AD-20's own deferred clause) run in parallel during drafting — see Dev Notes/Task 4 for the result.
