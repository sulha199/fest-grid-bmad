---
baseline_commit: 92b60879099b98b0f383fa9662106d5ba424ffcf
---

# Story 3.6y: Respect weekday-narrowed schedules in day-of-week filtering

## Story Details

- Epic: 3
- Story ID: 3.6y
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber filtering by day of week,
I want a schedule that applies only on certain weekdays to match only those weekdays,
so that a Monday-only promo does not show up for every Friday inside its span (BUG-026).

## Acceptance Criteria

1. **Given** a schedule with `applicableDaysOfWeek` set and non-empty (e.g. `['MON']`) spanning a multi-week date range, **when** `Query.events` is filtered by `EventFilterInput.dayOfWeek` for a weekday NOT in that list (e.g. `FRI`), **then** the event is excluded from the result, even though the schedule's raw `[eventStartDate, eventEndDate]` span overlaps that Friday; filtering by a weekday that IS in the list (`MON`) still matches. A schedule with `applicableDaysOfWeek` unset/null/empty behaves exactly as today (matches every weekday in its span) — zero regression for the existing single- and multi-weekday filter paths.
2. **Given** the same schedule, **when** `Query.events` is filtered by a plain `EventFilterInput.dateRange` (no `dayOfWeek`) whose window overlaps the schedule's span but contains no day matching `applicableDaysOfWeek` (e.g. a 3-day window that happens to fall entirely on non-Monday days), **then** the event is excluded; a window that does contain at least one matching day still matches.
3. **Given** the same schedule, **when** `Query.events`'s `temporalFilter: TODAY` is evaluated on a day that is NOT in `applicableDaysOfWeek`, **then** the event is excluded from the `TODAY` bucket even though its span covers today; evaluated on a day that IS in the list, it is included (subject to the existing, unchanged `!ended` boundary check).
4. **Given** the same schedule, **when** `Query.events`'s `temporalFilter: UPCOMING` is evaluated and the schedule's remaining span (`tomorrow` → `eventEndDate`) contains at least one day matching `applicableDaysOfWeek`, **then** the event is included; if the remaining span contains zero matching days (e.g. the schedule ends tomorrow and tomorrow is not an applicable weekday), it is excluded.
5. **And** this is implemented as one mechanism inside `packages/graphql-select/drizzle-where.ts`'s existing `overlaps` operator (the single SQL code path already shared by the `dayOfWeek` filter's per-day conditions, the plain `dateRange` filter, and the `TODAY`/`UPCOMING` temporal filter — see Architecture Spine AD-19's "single domain mechanism" rule and the 2026-09-30 backlog finding that explicitly calls out the temporal-filter path), not a second, parallel implementation for each caller.
6. **And** EXPLAIN plans for `Query.events` (all four scenarios in `cc-024-explain-after-3.6r-2026-10-02.md`) show the same statement/join count and no new Seq Scan after this change (Architecture Spine AD-17) — this story's SQL addition is an extra `WHERE`-clause predicate evaluated inside the already-existing correlated `EXISTS` subquery, not a new join or a new query.

**Depends on:** Story 1.3k (the `applicable_days_of_week` column and calendar occurrence logic already ship there), Story 1.3j.

## Tasks / Subtasks

- [ ] **Task 1 — Extend the `scheduleDateRange` fieldMap descriptor with the new column (AC: 1-5)**
  - [ ] 1.1 In `apps/backend/src/schema/resolvers.ts`'s `events` resolver `fieldMap` (the `scheduleDateRange:` entry, ~line 3088), add `applicableDaysOfWeekCol: schedules.applicableDaysOfWeek` alongside the existing `table`/`eventIdCol`/`correlateCol`/`startCol`/`endCol` keys. Do **not** touch the sibling `scheduleEndedBoundary` descriptor (~line 3098) — that one backs the `notEnded` operator (the TODAY bucket's separate "!ended" check), which is orthogonal to weekday matching and out of this story's scope (see Dev Notes).

- [ ] **Task 2 — Add the weekday-containment guard to the `overlaps` operator (AC: 1-6)**
  - [ ] 2.1 In `packages/graphql-select/drizzle-where.ts`'s `case "overlaps":` block, destructure an optional `applicableDaysOfWeekCol?: PgColumn` from `column` (alongside the existing `table`/`eventIdCol`/`correlateCol`/`startCol`/`endCol`).
  - [ ] 2.2 When `applicableDaysOfWeekCol` is present, append an `AND (...)` guard to the existing `EXISTS (...)` subquery's `WHERE` clause, inserted after the existing `daterange(...) && daterange(...)` check:
    ```sql
    AND (
      ${applicableDaysOfWeekCol} IS NULL
      OR cardinality(${applicableDaysOfWeekCol}) = 0
      OR EXISTS (
        SELECT 1 FROM unnest(${applicableDaysOfWeekCol}) AS aw(code)
        WHERE MOD(
          (CASE aw.code
            WHEN 'SUN' THEN 0 WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3
            WHEN 'THU' THEN 4 WHEN 'FRI' THEN 5 WHEN 'SAT' THEN 6 END)
          - EXTRACT(DOW FROM GREATEST(${startCol}, ${from}::date))::int + 7, 7
        ) <= (
          LEAST(COALESCE(${endCol}, ${startCol}), COALESCE(${toSql}, COALESCE(${endCol}, ${startCol})))
          - GREATEST(${startCol}, ${from}::date)
        )
      )
    )
    ```
    This is a **closed-form, O(1)-per-row** check — `unnest` over the schedule's own tiny `applicableDaysOfWeek` array (never more than 7 elements), no `generate_series`/per-day loop over the (potentially open-ended) query range. It derives, for each target weekday code in the schedule's array, the day-offset from the intersection's start date to the first occurrence of that weekday (`MOD(target_dow - start_dow + 7, 7)`), and checks that offset falls within the intersection's own length (`intersectionEnd - intersectionStart`, both already-bounded dates — `intersectionEnd` is never `NULL`/open-ended because it's always `LEAST`-bounded by `COALESCE(endCol, startCol)`, the schedule's own finite end). When `applicableDaysOfWeekCol` is absent from `column` (every other current/future caller of `scheduleDateRange` that doesn't pass it — there are none today, but the type must stay backward-compatible), the guard clause is omitted entirely and the generated SQL is byte-identical to today's.
  - [ ] 2.3 Do **not** add any equivalent guard to the `notEnded` case (`scheduleEndedBoundary`) — confirmed out of scope, see Dev Notes "Why `scheduleEndedBoundary` is untouched."

- [ ] **Task 3 — Unit tests for the new SQL guard (AC: 1, 5, 6)**
  - [ ] 3.1 In `packages/graphql-select/drizzle-where.test.ts`: add an `applicableDaysOfWeek: text('applicable_days_of_week').array()` column to the file's local `scheduleTestTable` fixture, and extend the shared test `fieldMap`'s `scheduleDateRange` entry with `applicableDaysOfWeekCol: scheduleTestTable.applicableDaysOfWeek` (mirroring the real fieldMap's own shape, Task 1).
  - [ ] 3.2 New test cases (SQL-text/params assertions, matching this file's existing `notEnded`-case style — `PgDialect().sqlToQuery(res)` then `assert.match`/`assert.ok` on the rendered SQL and bound params, not a DB-backed execution):
    - `overlaps` with `{from: '2026-08-01', to: '2026-08-01'}` (single day) and the descriptor carrying `applicableDaysOfWeekCol` → generated SQL contains `unnest`, `EXTRACT(DOW`, and references the `applicable_days_of_week` column; no error constructing the query.
    - `overlaps` with `{from: '2026-08-01', to: null}` (UPCOMING-shaped, open-ended) and `applicableDaysOfWeekCol` present → generated SQL still constructs cleanly (confirms the `COALESCE(${toSql}, ...)` branch handles the `NULL` literal without throwing), contains the same `unnest`/`EXTRACT(DOW` shape.
    - **Regression:** `overlaps` using the file's pre-existing `fieldMap` entries that do **not** carry `applicableDaysOfWeekCol` (i.e. a second, legacy-shaped descriptor with the same `table`/`eventIdCol`/`correlateCol`/`startCol`/`endCol` keys but no new key) → generated SQL contains **no** `unnest`/`EXTRACT(DOW`/weekday-guard text at all, proving a caller that never adds the new column sees byte-for-byte the same SQL as before this story.

- [ ] **Task 4 — Integration tests proving end-to-end filter correctness (AC: 1-4)**
  - [ ] 4.1 In `apps/backend/src/schema/resolvers.test.ts`, add a new `t.test('events - applicableDaysOfWeek narrows dayOfWeek/dateRange/TODAY/UPCOMING filtering (Story 3.6y)', ...)` block, placed near the existing `'events - scheduleDateRange overlaps filtering (Story 1.3h)'` and `'events - temporalFilter TODAY/UPCOMING (Story 0.i5d, ...)'` blocks (same file, same DB-backed `node:test`-against-real-Postgres convention, no mocking — mirror `createEventWithSchedule`'s existing helper shape from the 1.3h block, extended to accept an optional `applicableDaysOfWeek` param, matching 1.3k's own `resolvers.test.ts` fixture at line ~3559).
  - [ ] 4.2 Seed one event with a schedule `applicableDaysOfWeek: ['MON']`, `eventStartDate: '2030-09-07'`, `eventEndDate: '2030-09-28'` (four Mondays: 7th, 14th, 21st, 28th — same fixture dates 1.3k already uses, for easy cross-reference) and, as a control, a second event with an otherwise-identical schedule but `applicableDaysOfWeek: null`.
  - [ ] 4.3 **AC1 (`dayOfWeek` filter):** query `filter: { dateRange: { anchor: 'THIS_MONTH', offsetAmount: 0, offsetUnit: 'MONTH' }, dayOfWeek: 'FRI' }` against a `currentDate` inside September 2030 (use the `context.now` test override already established by the 0.i5d test block) → the `['MON']` event is **absent**, the control event (`null`) is **present**. Repeat with `dayOfWeek: 'MON'` → the `['MON']` event is **present**.
  - [ ] 4.4 **AC2 (plain `dateRange`, no `dayOfWeek`):** raw `query` DSL `{field: 'scheduleDateRange', operator: 'overlaps', value: {from: '2030-09-10', to: '2030-09-12'}}` (Tue–Thu, no Monday in range, but still daterange-overlaps the schedule's Sep 7–28 span) → the `['MON']` event is **absent**, the control event is **present**. Repeat with `{from: '2030-09-07', to: '2030-09-13'}` (a full week containing Sep 9's Monday) → **both** events present.
  - [ ] 4.5 **AC3 (`TODAY`):** using the existing `context.now` override pattern, pin `now` to `2030-09-09T12:00:00Z` (a Tuesday inside the schedule's span) and query `temporalFilter: TODAY` → the `['MON']` event is **absent**. Pin `now` to `2030-09-09T12:00:00Z`'s preceding Monday, `2030-09-02`... **use an in-span Monday instead, e.g. `2030-09-07T12:00:00Z`** → the `['MON']` event is **present** (assuming the existing `!ended` boundary also passes, matching the 0.i5d block's own setup for an in-progress/not-yet-ended schedule).
  - [ ] 4.6 **AC4 (`UPCOMING`):** seed a second `['MON']`-only schedule whose remaining span contains zero Mondays (e.g. `eventStartDate`/`eventEndDate` both `2030-09-10'..'2030-09-11'`, a Tue–Wed span with `now` pinned to `2030-09-09`, so `UPCOMING`'s `{from: tomorrow, to: null}` only ever intersects Tue–Wed) → **absent** from `UPCOMING`. A schedule whose remaining span does contain a Monday → **present**.
  - [ ] 4.7 **Regression:** confirm the existing `'events - scheduleDateRange overlaps filtering (Story 1.3h)'` and `'events - temporalFilter TODAY/UPCOMING (Story 0.i5d, ...)'` test blocks (neither of which sets `applicableDaysOfWeek` on any fixture) pass unmodified — proving zero behavior change for every schedule without the field set.

- [ ] **Task 5 — Re-run the AD-17 EXPLAIN gate and record the comparison (AC: 6)**
  - [ ] 5.1 `pnpm --filter @festgrid/database seed:volume:clean` then `pnpm --filter @festgrid/database seed:volume` (fresh 30,000-event volume dataset), matching the exact setup `cc-024-explain-after-3.6r-2026-10-02.md` used.
  - [ ] 5.2 Run the promoted capture script, `pnpm --filter @festgrid/backend exec tsx src/explain-events-queries.ts` (built by Story 3.6r — do not rewrite or fork it; this story is its second consumer). Capture the four scenarios' statement counts, main-select/`totalCount` timings, and Seq-Scan relation lists.
  - [ ] 5.3 Compare row-for-row against `cc-024-explain-after-3.6r-2026-10-02.md`'s table: same statement count per scenario, same set of relations hit by a Seq Scan per scenario (the pre-existing, CC-024-unrelated "next upcoming schedule" sort-key cost on the plain/`UPCOMING` scenarios is expected to reappear unchanged — it is not this story's concern to fix). The `UPCOMING` scenario is the one most directly exercising this story's new SQL (its `scheduleDateRange`/`overlaps` condition is exactly the code path Task 2 changes) — inspect its plan specifically to confirm the new `unnest`/`EXTRACT(DOW` predicate appears only as an in-memory filter inside the existing correlated `EXISTS`, not as a new join/subplan/Seq Scan.
  - [ ] 5.4 `pnpm --filter @festgrid/database seed:volume:clean` immediately after capture (volume rows break DB-backed tests, per the established convention).
  - [ ] 5.5 Commit a new comparison doc, `_bmad-output/planning-artifacts/cc-024-explain-after-3.6y-<date>.md`, mirroring `cc-024-explain-after-3.6r-2026-10-02.md`'s exact table format, with an explicit AC6 verdict (PASS/FAIL with evidence).

- [ ] **Task 6 — Full regression pass (AC: 1-6)**
  - [ ] 6.1 `pnpm --filter @festgrid/graphql-select test`, `pnpm --filter @festgrid/backend test` (`TZ=UTC`, volume seed cleaned — per the wave plan's "Test-gate facts" notes; tolerate the 4 known, unrelated `system-key-adapter`/`SYSTEM_GEMINI_API_KEY` failures, see Dev Notes), `pnpm --filter @festgrid/domain test` (unaffected — confirm it stays green since `buildEventsQueryCondition.ts` itself is not modified by this story, see Dev Notes "Why `buildEventsQueryCondition.ts` needs no code change").
  - [ ] 6.2 Lint and `tsc --noEmit` clean for `packages/graphql-select` and `apps/backend` (the only two touched packages).

## Dev Notes

- **Scope is deliberately narrow and backend-only.** Story 1.3k already shipped `Schedule.applicableDaysOfWeek` end-to-end for calendar/card *rendering* (DB column, GraphQL field, `WeeklyCalendarView.tsx` occurrence narrowing, the `EventCardRepeatBadge`, i18n labels — all `review`/shipped, verified by direct source inspection during this story's drafting). The remaining gap, confirmed during Wave 0 of the CC-024 wave plan and independently re-confirmed here by reading the actual current source of both files, is that `packages/domain/src/events/buildEventsQueryCondition.ts` and `packages/graphql-select/drizzle-where.ts` — the backend `Query.events` filter pipeline — never read `applicableDaysOfWeek` at all when building or executing the `scheduleDateRange`/`overlaps` SQL condition. This story closes exactly that gap. It does **not** touch any `apps/web`/`packages/ui` file (Gate 2, run fresh this session, confirmed: "No new component, hook, or non-trivial React util is implicated; every UI surface that renders this field already exists and needs zero changes" — see "Architecture & UX Gate Findings" below).

- **Why `buildEventsQueryCondition.ts` needs no code change, despite AC2's epics.md phrasing naming it.** `epics.md`'s Story 3.6y AC2 says "`buildEventsQueryCondition` and the date-range overlap in `drizzle-where` honor the field" — read as describing the *pipeline* (TS condition-construction feeding into SQL evaluation) collectively honoring the field, not a mandate that both files' source code change. **Design decision, confirmed with the user before drafting this story (not mechanical — this was escalated via `AskUserQuestion` given the real architectural fork involved):** the fix is implemented as a single, general mechanism entirely inside `drizzle-where.ts`'s `overlaps` operator (Task 2) plus a one-line `fieldMap` descriptor extension in `resolvers.ts` (Task 1) — covering **all four** current callers of the `scheduleDateRange`/`overlaps` condition uniformly: the explicit `EventFilterInput.dayOfWeek` filter's per-day conditions, the plain `dateRange`-only filter, and the `TODAY`/`UPCOMING` temporal filter (`buildTemporalCondition`). Because the fix lives entirely in how the SQL is built from the *existing* `{from, to}` condition shape, `buildEventsQueryCondition.ts` does not need to change its output at all — its existing `getDays`-based per-day expansion (for the `dayOfWeek` filter) and its existing `{from, to}` range construction (for plain `dateRange` and for `buildTemporalCondition`'s TODAY/UPCOMING branches) already carry everything the new SQL guard needs. `buildEventsQueryCondition.test.ts`'s existing assertions (which check the exact *shape* of the emitted condition tree, not SQL) therefore require **zero changes** and must keep passing unmodified — this is the regression proof for AC1's "zero behavior change to today's filter-condition-building logic."
  - **The alternative considered and rejected:** fixing only the two call sites where the queried day is already a single known date (the `dayOfWeek` filter's per-day conditions and `TODAY`), via a simple TS-known-weekday-to-array-contains check, leaving the plain multi-day `dateRange` filter and the open-ended `UPCOMING` filter unfixed (today's behavior preserved there, with the gap documented as a smaller residual slice of BUG-026). This would have been simpler and marginally safer for the AD-17 EXPLAIN gate, but was rejected by the user in favor of the general fix (all four call sites) — it directly closes the 2026-09-30 backlog finding that explicitly calls out the `0.i5d` temporal-filter path as part of BUG-026's still-open scope, and matches Architecture Spine AD-19's "single domain mechanism, never reimplement per caller" rule.
  - **Why the general SQL guard (Task 2.2) uses closed-form modular arithmetic, not `generate_series`.** A per-day loop (`generate_series(start, end, interval '1 day')` + per-row `EXTRACT(DOW ...)` check) would work but iterates once per day in the intersection — for `UPCOMING`'s open-ended range, that intersection is bounded by the schedule's own `COALESCE(endCol, startCol)` (never truly infinite, since every schedule has a finite stored end), but could still span many days for a long-running recurring schedule. The closed-form check (Task 2.2's `MOD(...)` arithmetic over `unnest`-ed `applicableDaysOfWeek`, never more than 7 elements) is O(1) per schedule row regardless of the span's length — the safer choice for a predicate added inside the `Query.events`/AD-17 hot path's existing correlated `EXISTS` subquery.
  - **Why `scheduleEndedBoundary`/`notEnded` is untouched.** It backs a *different* question — "has this schedule's end instant already passed as of `now`" (AD-20's `!ended` boundary for the `TODAY` bucket) — fully orthogonal to "does this schedule's pattern apply on this particular weekday." `buildTemporalCondition`'s `TODAY` branch already ANDs the `scheduleDateRange`/`overlaps` condition (which gains this story's weekday guard) together with the separate `scheduleEndedBoundary`/`notEnded` condition; fixing the former is sufficient for AC3, and inventing a second weekday check inside the latter would be exactly the "second, parallel reimplementation" AD-19 forbids.
  - **A pre-existing, unrelated quirk, confirmed not to interact with this story:** the `TODAY` bucket's two AND'd conditions (`scheduleDateRange` overlap, `scheduleEndedBoundary` not-ended) are each independently-correlated `EXISTS` subqueries against the `schedules` table — they do not require the *same* schedule row to satisfy both. This predates this story (it is how `buildTemporalCondition`/Story 0.i5d already worked) and is not something this story's scope changes or needs to fix.

- **Read in full before implementing:** `packages/graphql-select/drizzle-where.ts` (current `overlaps`/`notEnded` cases — both already read in full during this story's drafting, reproduced in Task 2's exact replacement text above); `apps/backend/src/schema/resolvers.ts`'s `events` resolver `fieldMap` (~lines 3074-3140, current state, already read); `packages/domain/src/events/buildEventsQueryCondition.ts` in full (confirms it needs no change — already read, see above); `packages/database/schema.ts`'s `schedules` table definition (confirms `applicableDaysOfWeek: text('applicable_days_of_week').array()`, nullable, already shipped by 1.3k — already read); `apps/backend/src/schema/resolvers.test.ts`'s existing `'events - scheduleDateRange overlaps filtering (Story 1.3h)'` block (~line 347) and `'events - temporalFilter TODAY/UPCOMING (Story 0.i5d, ...)'` block (~line 515), plus the 1.3k `applicableDaysOfWeek` round-trip test (~line 3540) — all three already read in full, Task 4's new test block should match their fixture/helper conventions precisely (DB-backed `node:test`, no mocking, `yoga.fetch` GraphQL execution, `context.now` override for deterministic `TODAY`/`UPCOMING` timing).

- **`cc-024-explain-after-3.6r-2026-10-02.md` is the correct "before" baseline for this story's Task 5 comparison** — confirmed Stories 3.6s (extraction) and 3.6t (ingestion), the two stories between 3.6r and this one, are both scoped to the ingestion/extraction pipeline and do not touch the `Query.events`/`Query.eventBySlug` resolvers or the `scheduleDateRange` fieldMap (their own Dev Notes/Out-of-Scope sections confirm no resolver-file changes). No EXPLAIN re-run happened between 3.6r and this story, so `cc-024-explain-after-3.6r-2026-10-02.md` remains the latest valid "before" state.

### Architecture & UX Gate Findings

- **Gates 1 and 3 — cited from the batch readiness sweep, not re-run.** `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` includes `3.6y`) already evaluated this story. `epics.md`'s own readiness table row: "3.6y (respect weekday-narrowed schedules in day-of-week filtering) | READY | 1.3k (`review`) already ships the column/calendar rendering; this story is the backend filter gap only, confirmed narrow." No correction was applied to 3.6y by the sweep (only 3.6t and 3.6v received corrections).
  - **Lightweight guard — does this story's actual scope contain anything the sweep plausibly didn't anticipate?** No. The scope resolved during drafting (a `fieldMap` descriptor extension plus a SQL `WHERE`-guard inside one existing operator case) is exactly the "backend filter gap" the sweep's own verdict already named — no new external service, no new data entity (the column has existed since 1.3k), and no new infra dependency. The one genuinely new element — the specific *shape* of the SQL fix (general, all-four-call-sites, closed-form modular arithmetic) — is an implementation-design decision within the already-anticipated scope, not a new architectural surface; it was still escalated to the user via `AskUserQuestion` given its real tradeoffs (see Dev Notes above), but that escalation is this story's own design-decision process, not a Gate 1/3 finding requiring a fresh sweep.
- **Gate 2 — run fresh (per-story, as required even when Gates 1/3 are cited).** Dispatched to a one-shot UX-persona analytical pass against this story's exact resolved scope (the fieldMap/SQL-only change described above, zero `apps/web`/`packages/ui` files touched). **Verdict: No gap found.** Quoting the pass directly: "The fix is a single new keyword (`applicableDaysOfWeekCol`) on an existing fieldMap descriptor object, consumed by one existing `switch` case (`overlaps`) in `drizzle-where.ts` — no new component, hook, or non-trivial React util is implicated; every UI surface that renders this field already exists and needs zero changes." Independently confirmed via grep during the pass: every current frontend consumer of `applicableDaysOfWeek` (`WeeklyCalendarView.tsx`, `EventCard.tsx`, `EventCardCalendarGridItem.tsx`, `day-of-week-mapping.ts`, and all five page-level `mapEventsDayOfWeek` wrappers from Story 1.3k) is already shipped and needs no change.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found, no migration required. `schedules.applicable_days_of_week` (nullable `text[]`) already exists in the DB schema, the GraphQL schema, and the generated client types — all shipped by Story 1.3k. This story adds zero new columns, zero new GraphQL fields, and zero new TypeScript types; it only reads an already-existing, already-typed column (`PgColumn`, via Drizzle's own `schedules.applicableDaysOfWeek` export) from one additional SQL code path.
- **Impacted fields/contracts:** None new. `apps/backend/src/schema/resolvers.ts`'s `fieldMap.scheduleDateRange` object gains one new key (`applicableDaysOfWeekCol`) of type `PgColumn` — an object-literal addition, not a schema/contract change. `packages/graphql-select/drizzle-where.ts`'s internal (non-exported) `overlaps`-case column-shape type gains one new optional key, `applicableDaysOfWeekCol?: PgColumn`.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the internal, non-exported column-shape type widening inside `drizzle-where.ts`'s `overlaps` case (Task 2.1) — not a change to any publicly exported type, interface, or GraphQL contract.
- **Backward compatibility and rollout notes:** Fully additive and backward-compatible by construction — `applicableDaysOfWeekCol` is an *optional* key on the column-shape type; any caller of `buildDrizzleWhere` with a `scheduleDateRange`-equivalent descriptor that does NOT set this key (there are none today besides the one production fieldMap entry, but the type must stay open for future callers) generates identical SQL to today, with the guard clause omitted entirely (Task 2.2's conditional). No synchronized rollout requirement; this is a single-deploy backend-only change.
- **Verification checks:** Task 3's SQL-text unit tests (including the explicit no-`applicableDaysOfWeekCol` regression case proving byte-identical SQL for callers that don't opt in); Task 4's DB-backed integration tests proving the actual filter semantics for all four ACs; Task 5's EXPLAIN re-run proving no hot-path regression; Task 6's full lint/type-check/test pass.

### Project Structure Notes

- No new files. Two files modified: `packages/graphql-select/drizzle-where.ts` (the `overlaps` case), `apps/backend/src/schema/resolvers.ts` (one `fieldMap` entry, one new key). Two test files extended: `packages/graphql-select/drizzle-where.test.ts`, `apps/backend/src/schema/resolvers.test.ts`. One new planning-artifact doc: `_bmad-output/planning-artifacts/cc-024-explain-after-3.6y-<date>.md` (Task 5.5). No conflicts with the unified project structure — both modified files are the exact, already-established home for this kind of change (same files Story 1.3h/0.i5d/1.3k's own `dayOfWeek`/temporal-filter work already lives in).
- Explicitly **not** touched: `packages/domain/src/events/buildEventsQueryCondition.ts` (see Dev Notes — needs no code change), `packages/database/schema.ts` (column already exists), any GraphQL schema file, any `apps/web`/`packages/ui` file, `apps/backend/src/explain-events-queries.ts` itself (reused as-is, not modified — this story is its second consumer after 3.6r).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6y: Respect weekday-narrowed schedules in day-of-week filtering] — verbatim AC basis
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-19: Day-of-Week Weekday-Match — Single Domain Mechanism] — binding "one mechanism, never reimplement" rule this story's Task 2 design follows
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-17: Computed Event/Schedule Field Batching] — the hot-path invariant AC6/Task 5 verify, not change
- [Source: _bmad-output/implementation-artifacts/backlog.yaml — BUG-026 and its 2026-09-30 child finding (`parent: BUG-026`, "Found 2026-09-30 by the Wave A batch readiness sweep... reaching the new temporalFilter path added by 0-i5d... fold into BUG-026's matching fix... rather than a separate mechanism")] — the explicit prior-art call-out that this story's Task 2 design (general fix, all four call sites) directly resolves
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 sweep, per-story verdict for 3.6y ("READY")
- [Source: _bmad-output/planning-artifacts/cc-024-explain-after-3.6r-2026-10-02.md] — the "before" EXPLAIN evidence and exact reproduction methodology Task 5 re-runs and compares against
- [Source: _bmad-output/implementation-artifacts/1-3k-render-day-of-week-recurring-schedules-and-repeat-badge.md] — confirms `applicableDaysOfWeek`'s existing DB/GraphQL/frontend shipped state and that "`buildEventsQueryCondition.ts`/`drizzle-where.ts` filter-matching correctness" was explicitly left as BUG-026's own still-open item for this story
- [Source: packages/graphql-select/drizzle-where.ts, drizzle-where.test.ts, packages/domain/src/events/buildEventsQueryCondition.ts, buildEventsQueryCondition.test.ts, apps/backend/src/schema/resolvers.ts (fieldMap, `events` resolver), resolvers.test.ts (1.3h/0.i5d/1.3k test blocks), packages/database/schema.ts (`schedules` table), apps/web/src/lib/day-of-week-mapping.ts] — all read in full for this story

## Global Rules References

- [_bmad-output/project-context.md] — Database/Performance (`Query.events` per-row-cost discipline, AD-17, this story's Task 5 EXPLAIN gate exists specifically to protect); Code Organization (no `packages/domain` change needed — `packages/graphql-select` and `apps/backend` are the correct, already-established homes for SQL-generation and resolver-fieldMap code respectively); Testing Rules (DB-backed `node:test`-against-real-Postgres integration tests, no mocking, matching the established convention)
- [_bmad-output/planning-artifacts/story-content-structure.md] — this file's canonical section order/status vocabulary
- [_bmad-output/planning-artifacts/festgrid-architecture-spine.md] — AD-19 (binding, this story's primary architecture driver — "single domain mechanism"), AD-17 (hot-path invariant this story's Task 5 verifies, not changes)
- [docs/infrastructure/index.md] — reviewed; this story is a pure SQL-condition-building change inside the existing backend service, no new infrastructure resource (no new queue, Lambda, compute, or external service) — the deeper `2-backend.md`/`3-database.md` shards were not independently re-read in full, matching recent CC-024 stories' same reasoning for a change with no new access pattern
- [_bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/3 cited from the batch sweep; Gate 2 run fresh (No gap found)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `apps/backend/src/schema/resolvers.ts` — add `applicableDaysOfWeekCol: schedules.applicableDaysOfWeek` to the `scheduleDateRange` fieldMap entry (one line).
  2. `packages/graphql-select/drizzle-where.ts` — extend the `overlaps` case's column-shape type and SQL (Task 2's exact text above).
  3. `packages/graphql-select/drizzle-where.test.ts` — extend `scheduleTestTable`/the shared `fieldMap`, add 3 new test cases (Task 3).
  4. `apps/backend/src/schema/resolvers.test.ts` — one new `t.test(...)` block, ~6 assertions across AC1-AC4 plus a regression confirmation (Task 4).
  5. `_bmad-output/planning-artifacts/cc-024-explain-after-3.6y-<date>.md` (new) — Task 5's comparison doc.
  6. No other file is touched — no `buildEventsQueryCondition.ts` change (see Dev Notes), no migration, no GraphQL schema file, no `apps/web`/`packages/ui` file.
- **Rule Mapping:**
  - AC1 (`dayOfWeek` filter honors the field) → Tasks 1-2, verified by Task 4.3.
  - AC2 (plain `dateRange` filter honors the field) → Tasks 1-2, verified by Task 4.4.
  - AC3 (`TODAY` honors the field) → Tasks 1-2, verified by Task 4.5.
  - AC4 (`UPCOMING` honors the field) → Tasks 1-2, verified by Task 4.6.
  - AC5 (one mechanism, not a per-caller reimplementation — AD-19) → Task 2's single `overlaps`-case implementation serving all four callers.
  - AC6 (AD-17 EXPLAIN gate unchanged) → Task 5.
  - "A story implementation must leave the system working end-to-end" (standing rule) → Task 4.7's regression confirmation, Task 6's full test/lint/typecheck pass.
- **Verification Plan:** Task 3's SQL-text unit tests (including the explicit backward-compatibility/no-opt-in regression case); Task 4's DB-backed integration tests covering all 4 ACs plus existing-suite regression; Task 5's full EXPLAIN re-run and documented comparison against `cc-024-explain-after-3.6r-2026-10-02.md`; `pnpm --filter @festgrid/graphql-select test`, `pnpm --filter @festgrid/backend test`, `pnpm --filter @festgrid/domain test` (confirm unaffected), lint + `tsc --noEmit` clean for the two touched packages.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — a `fieldMap` descriptor extension (`resolvers.ts`) plus a SQL `WHERE`-guard extension inside one existing operator case (`drizzle-where.ts`'s `overlaps`), covering all four current callers of `scheduleDateRange`/`overlaps` (`dayOfWeek` filter, plain `dateRange` filter, `TODAY`, `UPCOMING`); explicitly no change to `buildEventsQueryCondition.ts`, no migration, no GraphQL schema change, no frontend file.
- [ ] Architecture and boundary confirmation — AD-19's "single domain mechanism" rule followed (one `overlaps`-case implementation, not four reimplementations); AD-17's hot-path EXPLAIN invariant re-verified, not assumed; the closed-form-arithmetic-vs-`generate_series` SQL design choice (Dev Notes) confirmed appropriate for a hot-path correlated subquery.
- [ ] Testing plan confirmation — SQL-text unit tests (`drizzle-where.test.ts`, including a byte-identical-SQL regression case for non-opted-in callers) plus DB-backed integration tests covering all four ACs and the existing 1.3h/0.i5d suites' continued pass (`resolvers.test.ts`) plus the Task 5 EXPLAIN re-run.
- [ ] Explicit human approval state (Default: pending approval).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md` (READY, no correction needed for 3.6y); Gate 2 run fresh this session (No gap found, confirmed zero frontend scope).
- [ ] Design decision confirmed — the fix-scope decision (general, all four call sites, via `AskUserQuestion`) and the closed-form-SQL design choice are both recorded in Dev Notes, not re-asked during implementation.

## Testing Requirements

- [ ] Unit tests — `packages/graphql-select/drizzle-where.test.ts`'s 3 new SQL-text/params cases (Task 3), including the explicit no-`applicableDaysOfWeekCol` backward-compatibility case. `packages/domain/src/events/buildEventsQueryCondition.test.ts` requires **no new test** (no code change in that file) — its existing suite is the regression proof that condition-construction is unaffected.
- [ ] Integration tests — `apps/backend/src/schema/resolvers.test.ts`'s new DB-backed `node:test` block (Task 4), covering AC1-AC4 plus confirming the existing 1.3h/0.i5d blocks pass unmodified, matching this codebase's established no-DB-mocking convention.
- [ ] E2E tests — not applicable; this is a backend-only query-condition/SQL correctness fix with no new user-facing flow (the frontend already renders filtered results correctly once the backend stops over-including events — no new screen/interaction to exercise end-to-end).
- [ ] Hot-path gate — Task 5's EXPLAIN re-run against `seed:volume`, compared against `cc-024-explain-after-3.6r-2026-10-02.md`, committed as a new dated results doc.

## Deliverables Checklist

- [ ] `apps/backend/src/schema/resolvers.ts`'s `scheduleDateRange` fieldMap entry carries `applicableDaysOfWeekCol`.
- [ ] `packages/graphql-select/drizzle-where.ts`'s `overlaps` case applies the weekday-containment guard when the column is present, and is behavior-identical when it is absent.
- [ ] All 3 new `drizzle-where.test.ts` cases pass, including the no-opt-in regression case.
- [ ] All new `resolvers.test.ts` assertions pass for AC1-AC4, and the pre-existing 1.3h/0.i5d blocks pass unmodified.
- [ ] EXPLAIN re-run complete; `cc-024-explain-after-3.6y-<date>.md` committed with an explicit AC6 PASS/FAIL verdict and evidence.
- [ ] `pnpm --filter @festgrid/graphql-select test`, `pnpm --filter @festgrid/backend test`, `pnpm --filter @festgrid/domain test`, lint, and `tsc --noEmit` all clean for the touched packages.

## Out of Scope

- Any change to `packages/domain/src/events/buildEventsQueryCondition.ts` — confirmed unnecessary by this story's chosen design (see Dev Notes).
- The AI-extraction prompt/schema actually *populating* real `applicableDaysOfWeek` values during ingestion — BUG-026's own still-separate, still-open item (not this story's scope; this story only fixes querying/filtering against values however they got set, including seed/test data set directly).
- Any frontend change — `WeeklyCalendarView.tsx`/`EventCard.tsx`/i18n/etc. are all already correct per Story 1.3k and need nothing from this story.
- Fixing the pre-existing, CC-024-unrelated "next upcoming schedule" sort-key cost on the plain/`UPCOMING` `getEvents` scenarios (documented as pre-existing in `cc-024-explain-baseline-2026-10-01.md` and reconfirmed in `cc-024-explain-after-3.6r-2026-10-02.md`) — unrelated to this story, not to be chased during Task 5.
- A dedicated weekday-containment guard on `scheduleEndedBoundary`/`notEnded` — confirmed orthogonal and unnecessary (see Dev Notes).

## Definition of Done

- [ ] AC1-AC6 satisfied exactly as specified above.
- [ ] All new and existing tests passing (`packages/graphql-select`, `apps/backend`, `packages/domain` unaffected-and-confirmed-green).
- [ ] Lint and `tsc --noEmit` clean for `packages/graphql-select` and `apps/backend`.
- [ ] EXPLAIN comparison doc committed with a PASS verdict (or, if FAIL, the regression root-caused and fixed before this story is marked done).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-10-02: Story created via `bmad-create-story` (CC-024 Wave 4A). Fix-scope design decision (general, all four `scheduleDateRange`/`overlaps` call sites, closed-form SQL) confirmed with the user via `AskUserQuestion` before drafting. Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md` (swept, READY); Gate 2 run fresh (No gap found).
