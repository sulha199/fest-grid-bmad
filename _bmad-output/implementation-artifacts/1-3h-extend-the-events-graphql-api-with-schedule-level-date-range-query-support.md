---
baseline_commit: 66ebbf3116aab326745e06cf9c6023daae249492
---
# Story 1.3h: Extend the events GraphQL API with schedule-level date-range query support

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.3h
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the events GraphQL API's Unified Query DSL (AD-1) to support a schedule-level date-range overlap condition,
so that Story 1.3f's Discovery Calendar View (and any future date-bounded event query) can retrieve exactly the events with at least one schedule — main or sub — overlapping a given date range, without expanding the existing main-schedule-only join used for sorting.

## Acceptance Criteria

1. **Given** a DSL terminal condition with a new operator `overlaps` and a dedicated field `scheduleDateRange` whose value is `{ from: string; to: string }` (ISO dates), **when** the `events` resolver builds its `WHERE` clause, **then** it returns exactly the events having at least one schedule (main or sub) whose `[eventStartDate, eventEndDate ?? eventStartDate]` interval overlaps `[from, to]` inclusive — evaluated via a correlated `EXISTS` subquery against the full `schedules` table scoped by `event_id` (the same EXISTS-against-the-full-table technique the existing `isFavorited`/`isAddedToCalendar` fieldMap entries in `apps/backend/src/schema/resolvers.ts` already use), not the existing `mainSchedulesOnly` join (which only ever exposes one schedule per event and would silently miss sub-schedule-only matches).
2. **And** the overlap check uses Postgres native range support — a `daterange(event_start_date, COALESCE(event_end_date, event_start_date), '[]')` expression compared via the `&&` overlap operator against `daterange($from, $to, '[]')` — rather than two independently-compared inequality columns.
3. **And** a hand-written SQL migration (checked into the repo per `project-context.md`'s migration rule) adds a GiST index on `schedules` supporting that overlap expression.
4. **And** this new field/operator composes correctly with existing DSL conditions via `and`/`or` grouping (e.g. combined unchanged with the existing `q`/`types`/`categories` condition from `buildEventsQueryCondition`) — verified by an integration test combining a date-range condition with an existing `types`/`categories` condition. It also composes correctly with **itself**: two independent `scheduleDateRange` conditions in the same tree (e.g. an `or` of two different weeks) are each resolved correctly and independently — the chosen implementation (Dev Notes → Design Decision) resolves each terminal condition through the generic DSL dispatch mechanism rather than a single query-wide pre-scan, so this falls out for free rather than needing special-casing.
5. **And** existing DSL behavior is unchanged and regression-verified: `eq`/`ne`/`contains`/`in`/`notIn` operators, and the existing `isFavorited`/`isAddedToCalendar`/`performers`/`scheduleLocation` `fieldMap` entries, all continue to behave exactly as before (existing `resolvers`/`drizzle-where` tests pass unmodified).
6. **And** unit tests explicitly cover the overlap boundary cases: schedule fully inside the range; schedule fully spanning/containing the range (starts before `from`, ends after `to`); schedule overlapping only the range's start edge; schedule overlapping only the range's end edge; schedule entirely outside the range (no match); and a schedule with `eventEndDate = null` (single-day, falls back to `eventStartDate`).
7. **And** the GraphQL schema (`events.graphql`) requires no changes — `EventQueryConditionInput.operator: String` already accepts the new operator value with no breaking change (confirmed: `field`/`operator` are untyped `String`, `value: JSON`).

**Note:** This story exists because of a Gate 1 finding (`story-split-gate.md`) surfaced while creating Story 1.3f, after the user asked for the actual query-execution cost of a "dedicated week-scoped backend query" to be investigated rather than assumed. The `events` resolver's existing `mainSchedulesOnly` join (`apps/backend/src/schema/resolvers.ts`) only ever joins each event's main schedule, so a naive date-range filter on that joined column would silently miss any event whose *sub*-schedule (not main schedule) falls in the requested week — a real correctness gap, not a style preference. An alternative (fetching up to the existing 1000-event cap in one request and filtering the date range client-side, avoiding all backend changes) was explicitly considered and rejected by the user in favor of exact per-week query correctness. Confirmed with the user via `AskUserQuestion` (2026-08-05), including a direct correctness review of the overlap-condition logic and a performance discussion (Postgres typically rewrites correlated `EXISTS` into a semi-join; `daterange`+GiST is the indexable, purpose-built form of this check).

**Depends on:** None (extends the existing `events` query/resolver; no new schema surface).

## Tasks / Subtasks

- [x] Task 1: Add `overlaps` to the DSL type (AC1) — `packages/domain`
  - [x] In `packages/domain/src/query/queryDsl.ts`, extend `TerminalOperator`:
    ```ts
    export type TerminalOperator = "eq" | "ne" | "contains" | "in" | "notIn" | "overlaps";
    ```
    **Coordination note:** Story 2.5a (currently `ready-for-dev`, not yet implemented) independently extends this same union with `"withinRadius"` for an unrelated geo-distance feature. Whichever story lands in code first, the other must **merge into** the existing union (append its own member alongside the other's), not overwrite it — final state should read `"eq" | "ne" | "contains" | "in" | "notIn" | "withinRadius" | "overlaps"` regardless of implementation order.
  - [x] No other `packages/domain` changes needed — unlike Story 2.5a's `withinRadius` (which needed a DB-backed `locationPreferenceId` → coordinates lookup, split into a dedicated `resolveWithinRadiusConditions` pure tree-transform), `scheduleDateRange`'s `{ from, to }` value requires no server-side resolution step; it flows straight from the client-supplied DSL value into the SQL builder (Task 2).

- [x] Task 2: Add `overlaps` handling to `buildDrizzleWhere` (AC1, AC2, AC4, AC6) — `packages/graphql-select`
  - [x] In `packages/graphql-select/drizzle-where.ts`, add `PgTable` to the existing `drizzle-orm/pg-core` import (alongside `PgColumn`), and add a case to the existing `switch (operator)` block:
    ```ts
    case "overlaps": {
      const { from, to } = value as { from: string; to: string };
      const { table, eventIdCol, correlateCol, startCol, endCol } = column as {
        table: PgTable;
        eventIdCol: PgColumn;
        correlateCol: PgColumn;
        startCol: PgColumn;
        endCol: PgColumn;
      };
      return sql`EXISTS (
        SELECT 1 FROM ${table}
        WHERE ${eventIdCol} = ${correlateCol}
          AND daterange(${startCol}, COALESCE(${endCol}, ${startCol}), '[]')
              && daterange(${from}::date, ${to}::date, '[]')
      )`;
    }
    ```
    Design decision (confirmed with user, see Dev Notes → Design Decision: overlaps implementation placement): the EXISTS-subquery SQL is built generically here, inside `graphql-select`'s existing operator switch, from a `{ table, eventIdCol, correlateCol, startCol, endCol }` config object supplied via `fieldMap` (mirroring how `packages/graphql-select` already receives multi-column config objects for compound fields, e.g. Story 2.5a's `scheduleCoordinates: { latColumn, lngColumn }`) — not built ad hoc inside `apps/backend/resolvers.ts` the way `isFavorited`/`isAddedToCalendar`'s simpler single-purpose EXISTS checks are. This keeps all Drizzle/SQL-construction logic inside `packages/graphql-select` (already Drizzle-coupled by design per `project-context.md`'s Code Organization rule) and requires no query-tree pre-scan in the resolver — each `scheduleDateRange` terminal condition anywhere in the tree is resolved independently through the normal per-node switch dispatch, so AC4's multi-condition composition requirement is satisfied without special-casing.
    `NULL` `eventEndDate` is handled by the `COALESCE` inside the SQL expression itself (AC6's single-day fallback) — no separate `IS NULL` branch needed in TypeScript.
  - [x] Unit tests in `packages/graphql-select/drizzle-where.test.ts`: add a synthetic `scheduleTestTable` (`pgTable('schedule_test_table', { eventId: uuid('event_id'), eventStartDate: date('event_start_date'), eventEndDate: date('event_end_date') })`) alongside the existing `testTable`, and a `scheduleDateRange: { table: scheduleTestTable, eventIdCol: scheduleTestTable.eventId, correlateCol: testTable.id, startCol: scheduleTestTable.eventStartDate, endCol: scheduleTestTable.eventEndDate }` fieldMap entry (add an `id: uuid('id')` column to `testTable` if it doesn't already have one usable as a correlation target). Add a case asserting `buildDrizzleWhere` returns a defined `SQL` for `{ field: "scheduleDateRange", operator: "overlaps", value: { from: "2026-08-01", to: "2026-08-07" } }`, following this file's existing `assert.ok(res !== undefined)` no-real-DB style (no boundary-case execution here — those need a real DB, covered by Task 4's integration tests).

- [x] Task 3: Add a GiST index migration (AC2, AC3) — `packages/database`
  - [x] **No `schema.ts` change is required** — `schedules.eventStartDate`/`schedules.eventEndDate` already exist as `date` columns (Dev Notes → Data Type Compatibility). Drizzle's schema-first `index()` builder (drizzle-kit `^0.21.2`, drizzle-orm `^0.30.10`) only accepts real `PgColumn` references in `.on(...)` — it cannot express a functional/expression index on `daterange(...)`, so this index cannot be declared in `schema.ts` and diffed by `drizzle-kit generate` the normal way (Dev Notes → Data Type Compatibility).
  - [x] Run `pnpm --filter @festgrid/database exec drizzle-kit generate --custom --name=schedule-date-range-gist-index` to produce an empty migration file (`packages/database/migrations/000N_schedule-date-range-gist-index.sql`, registered in `meta/_journal.json` automatically) with no schema diff.
  - [x] Hand-write the index into that generated (empty) file:
    ```sql
    CREATE INDEX IF NOT EXISTS "schedule_date_range_idx" ON "schedules"
    USING gist (daterange(event_start_date, COALESCE(event_end_date, event_start_date), '[]'));
    ```
    No `btree_gist` extension is required — `daterange` has a native GiST operator class (`range_ops`) in core Postgres; `btree_gist` is only needed when mixing scalar-equality columns with a range in one composite GiST index, which this index does not do.
  - [x] Apply the migration locally (`pnpm --filter @festgrid/database run migrate`) and confirm it runs cleanly against the local dev Postgres.

- [x] Task 4: Wire `scheduleDateRange` into the `events` resolver's `fieldMap` (AC1, AC4) — `apps/backend`
  - [x] In `apps/backend/src/schema/resolvers.ts`, `Query.events`, add one new static entry to the existing `fieldMap` object literal (alongside `scheduleLocation: schedules.location`, following that entry's identical "already-joined-table column reference" style, just bundled into a config object per Task 2's design):
    ```ts
    scheduleDateRange: {
      table: schedules,
      eventIdCol: schedules.eventId,
      correlateCol: events.id,
      startCol: schedules.eventStartDate,
      endCol: schedules.eventEndDate,
    },
    ```
    Unlike `isFavorited`/`isAddedToCalendar` (which are conditionally built as full SQL booleans depending on `userId`) or Story 2.5a's `withinRadius` (which needs an async DB lookup before the fieldMap can be built), this entry needs no auth check and no async lookup — it is a static, always-present config object, mirroring `scheduleLocation`'s simplicity. No new imports needed (`schedules`/`events` are already imported in this file).
  - [x] No auth/authorization change — `scheduleDateRange`/`overlaps` is usable by unauthenticated callers, same as every other non-personalization field (`eventName`, `types`, `scheduleLocation`, etc.); it filters on public schedule data, not per-user data.
  - [x] Integration tests in `apps/backend/src/schema/resolvers.test.ts` (extends the existing `events resolver integration via Yoga` block, real local test DB, matching the file's established pattern — no msw, this is backend-side): seed 5-6 `events`+`schedules` rows at known dates covering AC6's boundary cases (fully inside; fully spanning; overlapping only the start edge; overlapping only the end edge; entirely outside; single-day with `eventEndDate = null`), including at least one event whose **only** matching schedule is a sub-schedule (`isMainSchedule: false`) to prove the `EXISTS`-against-full-table approach (not `mainSchedulesOnly`) is actually exercised; assert `overlaps` filters correctly for each boundary case (AC6); assert an `and` of `scheduleDateRange` with an existing `types`/`categories` condition composes correctly (AC4); assert existing `eq`/`in`/`contains` tests and the `isFavorited`/`scheduleLocation`/`performers` fieldMap entries still pass unmodified (AC5, regression).

- [x] Task 5: Update AD-1's field/operator documentation (repo hygiene, matches Story 2.5a's precedent)
  - [x] In `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, AD-1's "Fields and Operators" list, add a new bullet: `**date range (scheduleDateRange):** overlaps (value: { from: string; to: string } ISO dates)`.

- [x] Task 6: Manual verification
  - [x] Run the backend locally, exercise `events(query: { field: "scheduleDateRange", operator: "overlaps", value: { from: "2026-08-01", to: "2026-08-07" } })` via GraphiQL/`curl` against real seeded data; confirm results include an event whose only matching schedule is a sub-schedule; confirm combining with `types`/`categories` via `and` narrows correctly; confirm `pnpm build`/`pnpm lint` stay clean at the repo root (no codegen re-run needed — `EventQueryConditionInput` is unchanged, AC7).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true` for Epic 1's original story list). That report's `stories_covered` predates Stories 1.3c-1.3h (all added 2026-08-05 during Story 1.3f's own creation), so it does not literally cover this story. Lightweight escape-hatch guard applied instead (per this workflow's guidance for stories outside a sweep's covered list): this story's scope — extending an existing DSL operator, a new `buildDrizzleWhere` switch case, one new static `fieldMap` entry, and an index-only migration on an already-existing column pair — introduces no new external service, no new data entity/table, and no new infra dependency beyond what Epic 1's original sweep already characterized (the `events`/DSL/resolver surface it already found compliant). No fresh Gate 1/3 subagent dispatch was needed; this story **is itself** the Gate 1 finding/resolution generated while creating Story 1.3f (see the Note under Acceptance Criteria) — there is no further gap to surface within its own scope.
- **Gate 2 (UI Complexity & Reusability):** Ran via a one-shot Freya-persona subagent dispatch (this story has zero UI surface — a type union extension, a SQL-builder switch case, a resolver fieldMap entry, and a database migration; no React/component/hook code anywhere in scope, matching Stories 2.1a/2.3a/2.3b/2.4b/0.16/2.5a's identical zero-UI precedent). **Verdict: no gap** — nothing in this story is UI-shaped or needs splitting out. The check surfaced one adjacent, non-blocking observation: since `overlaps` exists purely to let Story 1.3g's `WeeklyCalendarView` render overlapping/multi-day events, whoever implements 1.3g should confirm its own scope already owns the visual stacking/overlap-rendering interaction spec (`DESIGN.md`'s `multi_day_event` token) — that is a 1.3g completeness question, not a reason to add or split UI scope out of this story.

### Design Decision: overlaps implementation placement (confirmed with user, 2026-08-05)

A real, non-mechanical tradeoff was surfaced while drafting this story and confirmed via `AskUserQuestion` before finalizing Tasks: where should the correlated-EXISTS SQL-building logic for `overlaps` live?

- **Chosen — generic case inside `packages/graphql-select/drizzle-where.ts`'s existing operator switch**, using drizzle's `sql` tag to build the EXISTS subquery from a `{ table, eventIdCol, correlateCol, startCol, endCol }` config object supplied via `fieldMap` (Task 2), over the alternative of building it ad hoc inside `apps/backend/resolvers.ts`'s fieldMap object literal the way the simpler, single-purpose `isFavorited`/`isAddedToCalendar` EXISTS checks are built.
- **Reasoning:** the generic-switch approach needs no `db`/`exists()` import in `packages/graphql-select` (pure `sql`-tag identifier interpolation), keeps all Drizzle/SQL-construction logic inside the package that already owns it by design (`project-context.md`'s Code Organization rule: DB/ORM-coupled logic belongs in `packages/graphql-select`, not scattered across the resolver), and — critically — requires no query-tree pre-scan step in the resolver the way `isFavorited`'s literal pattern would (that pattern only works because `userId` is known before the fieldMap is built; `scheduleDateRange`'s `{from,to}` values are only known per-condition, inside the tree itself). The rejected alternative (mirroring `isFavorited` literally, via a new `hasScheduleDateRangeCondition`-style tree-scan extracting the first match) would only support a single `scheduleDateRange` condition per query and silently drop a second one combined via `or` — a real correctness limitation AC4 explicitly guards against. The chosen approach supports arbitrarily many independent `scheduleDateRange` conditions in one query for free, since each terminal condition is resolved through the normal per-node switch dispatch already used by every other operator.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no column/type mismatch — the required source columns already exist and are already correctly typed.** `schedules.eventStartDate` (`date`, `notNull`) and `schedules.eventEndDate` (`date`, nullable) already exist in `packages/database/schema.ts` exactly as this story's AC1/AC2/AC6 require (confirmed via direct read) — no `schema.ts` change, no new column, and no TypeScript/GraphQL type change of any kind is needed for this story.
- **The one real gap is an index-mechanism limitation, not a data-type mismatch:** Drizzle's schema-first `index()` builder in the pinned versions (drizzle-kit `^0.21.2` / drizzle-orm `^0.30.10`, confirmed via direct read of `drizzle-orm/pg-core/indexes.d.ts`) requires `.on(...)` to receive real `PgColumn` references — it has no mechanism to express a functional/expression index (`daterange(event_start_date, ...)`). This means AC3's GiST index cannot be declared in `schema.ts` and diffed by the normal `drizzle-kit generate` flow the way Stories 1.1/2.3a/2.5a's plain-column indexes were — it must be a hand-written statement inside a `drizzle-kit generate --custom`-produced empty migration file (Task 3), following the same "generate via drizzle-kit, then hand-append/hand-write SQL for what the tool can't diff" convention Story 2.5a already established for its backfill `UPDATE` statement.
- **Impacted contracts:** `packages/domain/src/query/queryDsl.ts` (`TerminalOperator` union — additive, shared with Story 2.5a's concurrent `withinRadius` addition, see Task 1 coordination note); `packages/graphql-select/drizzle-where.ts` (`overlaps` case); new migration `packages/database/migrations/000N_schedule-date-range-gist-index.sql` (index-only, no column change); `apps/backend/src/schema/resolvers.ts` (`Query.events` fieldMap); `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1 documentation).
- **Required DB migration changes:** Yes, but index-only — no `ALTER TABLE`, no new/changed column (Task 3).
- **Required TypeScript type changes:** Additive only — `TerminalOperator` gains `"overlaps"`; no `packages/shared-types` change (the DSL's `value: any`/GraphQL `value: JSON` already accommodates `{ from, to }` without a named interface, consistent with every other operator's untyped `value`).
- **Backward compatibility and rollout notes:** Purely additive — a new enum member, a new `switch` case, one new static `fieldMap` entry gated entirely behind the presence of a `scheduleDateRange`/`overlaps` condition in the query (queries that don't use it are byte-for-byte unaffected), and an index that only improves performance for the new query shape (no behavior change for existing queries). No existing field, query, or resolver behavior changes for any caller not using the new operator.
- **Verification checks:** Task 2's `packages/graphql-select` unit test (SQL is generated, non-`undefined`); Task 4's `apps/backend` integration tests (all six boundary cases from AC6, sub-schedule-only match, `and`-composition with `types`/`categories`, full regression pass on existing DSL tests); a manual check (Task 6) that the migration applies cleanly and the index is actually used (optional `EXPLAIN` check, not required for AC satisfaction at MVP scale).

### Architecture / technical constraints

- **AD-1 (Unified Query DSL) / AD-2 (Unified Event Querying):** `overlaps` is a new terminal operator within the existing DSL, not a new endpoint or parallel filtering mechanism — this is the entire point of this story (Gate 1 finding, see Note under Acceptance Criteria).
- **AD-3 (Database Schema Management):** The index ships as a `drizzle-kit`-registered migration file checked into the repo, even though its content is hand-written rather than diff-generated (Task 3) — the journal/meta registration still goes through the standard tooling.
- **Adapter Pattern / General Architecture:** No external service call is introduced — this is pure SQL against already-stored columns (unlike Stories 0.16/2.3b/2.4b's adapter-pattern external calls, and unlike Story 2.5a's `withinRadius`, which needs a DB lookup of the caller's saved locations before it can build its comparison — `scheduleDateRange`'s `{from,to}` values are supplied directly by the client with no server-side resolution step).
- **Package boundaries:** SQL-building for `overlaps` lives in `packages/graphql-select` (already Drizzle/ORM-coupled by design), matching where `buildDrizzleWhere`'s other operator cases already live. The static `fieldMap` config entry lives in `apps/backend`'s resolver, matching where `scheduleLocation`/`performers`/`isFavorited` already live. No new code in `packages/domain` beyond the one-line `TerminalOperator` union extension.
- **Testing Rules:** `packages/domain`'s `TerminalOperator` change is a pure type-level addition with no new runtime logic — no new unit test file is needed for it specifically (the union member is exercised end-to-end by Task 2/Task 4's tests). `packages/graphql-select` and `apps/backend` follow this repo's existing "testing trophy" pattern — unit test without a real DB for the SQL-builder (Task 2), integration tests with a real local test DB for the resolver (Task 4). No E2E test in this story — no UI ships (Story 1.3f owns the E2E happy path for the user-facing Calendar View feature that consumes this).
- **State Management / Loader categorization: not applicable** — backend-only, no UI renders any async state for this story.
- **AD-5 (Analytics) / AD-6 (i18n): not applicable** — no user-facing interaction or text ships from this story.
- **AD-7 (Authenticated Context) / AD-8 (Soft-Delete Convention): not applicable to the new code path** — `scheduleDateRange` requires no auth (it's public schedule data, not per-user data, unlike Story 2.5a's `withinRadius`), and `schedules` reads already inherit whatever soft-delete/visibility rules the existing `events`/`schedules` query already enforces upstream of this story's change — unchanged by this story.

### Previous/Sibling Story Intelligence (Stories 1.3a, 1.3f, 1.3g, 2.5a)

- **Story 1.3a (`done`, fully implemented)** — confirmed via direct read of `apps/backend/src/schema/resolvers.ts` (`Query.events`, current `fieldMap`/`mainSchedulesOnly`/`isFavorited`/`isAddedToCalendar` block) and `apps/backend/src/schema/events.graphql`. `scheduleLocation: schedules.location` is the direct precedent for how a schedule-table column is exposed as a `fieldMap` entry via the existing `mainSchedulesOnly` left-join; `isFavorited`'s `exists(db.select(...).from(favorites).where(...))` is the direct precedent for the EXISTS-against-full-table technique this story's `overlaps` case generalizes (see Design Decision above for why it's generalized into `packages/graphql-select` rather than copied literally).
- **Story 1.3f (`ready-for-dev`, not yet implemented)** — this story's only consumer. Its AC2 explicitly names `Story 1.3h's scheduleDateRange/overlaps condition, combined via and with the page's existing q/types/categories condition` — confirming this story's `{ from, to }` value shape and `and`-composition requirement (AC4) are exactly what 1.3f expects to send.
- **Story 1.3g (`backlog`, not yet drafted)** — the `WeeklyCalendarView` component 1.3f will populate with this story's query results; purely presentational, no dependency on this story's backend internals (consumes already-shaped GraphQL `Event`/`Schedule` data, not the DSL directly).
- **Story 2.5a (`ready-for-dev`, not yet implemented)** — closest recent architectural analog: also extends the same `TerminalOperator` union and the same `resolvers.ts` `Query.events` `fieldMap` for an unrelated feature (`withinRadius`, geo-distance). Confirmed via direct read that its implementation has **not** started (current `queryDsl.ts` still reads `"eq" | "ne" | "contains" | "in" | "notIn"` with neither `withinRadius` nor `overlaps` present yet) — both stories are genuinely unimplemented, not just planned, so Task 1's merge-not-overwrite coordination note is a real, live concern for whichever developer picks up the second of the two.

### Git Intelligence Summary

Most recent commit (`a5668cd`, "feat: extend the events GraphQL API with geo-distance query support") is Story 2.5a's own `bmad-create-story` commit — story file + `sprint-status.yaml` only, confirming (consistent with the direct code read above) that 2.5a's actual implementation has not landed yet. No commit in recent history has touched `apps/backend/src/schema/resolvers.ts`'s `Query.events`, `packages/graphql-select/drizzle-where.ts`, or `packages/domain/src/query/queryDsl.ts` — confirming this story's scope genuinely has not started implementation either.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Database & Performance; Code Quality & Style Rules → Code Organization; Testing Rules; General Architecture → Adapter Pattern)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-3)
- `_bmad-output/planning-artifacts/epics.md` (Story 1.3h, Story 1.3a, Story 1.3f, Story 1.3g)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/2-backend.md`, `docs/infrastructure/3-database.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- Modified: `packages/domain/src/query/queryDsl.ts` (`TerminalOperator` gains `"overlaps"` — merge, not overwrite, alongside Story 2.5a's concurrent `"withinRadius"` addition).
- Modified: `packages/graphql-select/drizzle-where.ts` (`overlaps` case + `PgTable` import); `drizzle-where.test.ts` (new synthetic-table case).
- New: `packages/database/migrations/000N_schedule-date-range-gist-index.sql` (empty-diff `--custom` migration, hand-written GiST index), matching the `meta/_journal.json`/`_snapshot.json` entries drizzle-kit produces automatically. **No `schema.ts` change.**
- Modified: `apps/backend/src/schema/resolvers.ts` (`Query.events`: new static `scheduleDateRange` `fieldMap` entry); `resolvers.test.ts` (new integration tests).
- Modified: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1 field/operator documentation).
- **Not modified:** `apps/backend/src/schema/events.graphql` (no schema change needed — `EventQueryConditionInput` already generic, AC7); generated codegen output (`resolvers-types.ts`/`apps/web/src/generated/graphql.ts` — no re-run needed); any `apps/web` source (Story 1.3f's scope); `packages/ui` (no UI in this story); `packages/domain/src/query/index.ts` (barrel already does `export * from "./queryDsl.js"` — no change needed since no new file is added there, unlike Story 2.5a's `resolveWithinRadiusConditions.ts`).

### Rule Mapping

- *AD-1/AD-2* → `overlaps` extends the existing DSL/resolver; AC4's multi-condition composition requirement is met by resolving each terminal condition independently through the normal switch dispatch (Task 2), not a query-wide pre-scan.
- *AD-3* → index change ships as a `drizzle-kit`-registered (custom, hand-written) migration (Task 3).
- *Database Indexing rule (project-context.md)* → the GiST expression index backs the overlap check's performance (AC3, Task 3).
- *Code Organization (packages/graphql-select vs apps/backend)* → SQL-construction logic lives in `packages/graphql-select` (already Drizzle-coupled by design); the static config `fieldMap` entry lives in `apps/backend`'s resolver, matching `scheduleLocation`'s precedent (Task 2/4, see Design Decision).
- *Testing Rules* → unit test for the SQL-builder (Task 2, no real DB); integration tests for the resolver covering all AC6 boundary cases plus regression (Task 4).
- *Story-split-gate Gate 1/2/3* → this story **is** the Gate 1 finding/resolution from Story 1.3f's creation (no further gap in its own scope, since it predates and is outside `epic-1-readiness.md`'s covered list — lightweight escape-hatch guard applied, see Dev Notes → Architecture & UX Gate Findings); Gate 2 run via one-shot subagent, zero in-scope UI gap, one non-blocking forward note left for Story 1.3g.

### Verification Plan

- `packages/graphql-select`: `tsx --test` unit test confirming `buildDrizzleWhere` returns a defined `SQL` for an `overlaps` condition against a synthetic `{ table, eventIdCol, correlateCol, startCol, endCol }` fieldMap entry.
- `apps/backend`: integration tests (Yoga + real local test DB, `resolvers.test.ts`) — all six AC6 boundary cases; a sub-schedule-only match (proving the full-table EXISTS approach, not `mainSchedulesOnly`, is exercised); `and`-composition with `types`/`categories` (AC4); full regression pass on existing DSL/fieldMap tests (AC5).
- Manual: GraphiQL/`curl` smoke test against real seeded data (Task 6); confirm the custom migration applies cleanly locally; confirm `pnpm build`/`pnpm lint` clean at the repo root with no codegen re-run required.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: backend-only (`packages/domain`, `packages/database`, `packages/graphql-select`, `apps/backend`) plus an architecture-spine documentation update — no `apps/web`/`packages/ui` changes (Story 1.3f consumes this later).
- [ ] **No blocking dependency:** confirmed via direct reads that Story 1.3a (`done`) is real and complete; this story has no other prerequisite.
- [ ] **Gate 1/3 escape-hatch accepted:** `epic-1-readiness.md` is `swept: true` but predates this story (and its 1.3c-1.3h siblings) — a lightweight guard was applied instead of a fresh subagent dispatch, judged sufficient because this story is itself the identified Gate 1 finding/resolution from Story 1.3f's creation with no further gap in its own narrow scope (see Dev Notes → Architecture & UX Gate Findings). Accepted, not escalated.
- [ ] **Design decision accepted:** `overlaps`'s EXISTS-subquery SQL is built generically inside `packages/graphql-select`'s operator switch (not ad hoc inside `resolvers.ts` mirroring `isFavorited` literally) — confirmed with the user via `AskUserQuestion` (see Dev Notes → Design Decision).
- [ ] **Data-type-compatibility finding accepted:** no schema/column change needed; the GiST index must be a hand-written statement inside a `drizzle-kit generate --custom` empty migration, since the pinned drizzle-kit/drizzle-orm versions cannot diff expression indexes from `schema.ts` (see Dev Notes → Data Type Compatibility & Migration Requirements).
- [ ] **Coordination risk accepted:** Story 2.5a concurrently extends the same `TerminalOperator` union — whichever story is implemented second must merge its addition rather than overwrite the other's (Task 1).
- [ ] Architecture and data/API boundaries confirmed: SQL-building in `packages/graphql-select`; static fieldMap config in `apps/backend`'s resolver; no new join (full-table `EXISTS`, decoupled from `mainSchedulesOnly`); no `.graphql` schema change, no codegen re-run.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 escape-hatch guard applied (no fresh gap in this story's own scope); Gate 2 run via one-shot subagent — no in-scope UI gap; one non-blocking forward note recorded for Story 1.3g's own future implementation.
- [ ] Testing plan confirmed: `packages/graphql-select` unit test; `apps/backend` integration tests covering all AC6 boundary cases, sub-schedule-only matching, and `and`-composition (real local test DB, no mocks for the DB layer).
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/graphql-select`: `tsx --test` unit test for the new `overlaps` case in `buildDrizzleWhere`, matching this file's existing no-real-DB, `assert.ok(res !== undefined)` style.
- `apps/backend`: integration tests (`tsx --test`, Yoga + real local test Postgres DB, matching `resolvers.test.ts`'s established pattern — no msw, this is backend-side) covering all six AC6 boundary cases, a sub-schedule-only match, `and`-composition with an existing `types`/`categories` condition, and full regression on existing DSL/fieldMap behavior (AC5).
- No new E2E test in this story — no UI ships (Story 1.3f owns the E2E happy path for the user-facing Calendar View feature that consumes this).

## Deliverables Checklist

- [ ] `TerminalOperator` extended with `"overlaps"` (merged, not conflicting, with Story 2.5a's concurrent `"withinRadius"` addition).
- [ ] `buildDrizzleWhere` handles `overlaps` (correlated `EXISTS` + `daterange`/`&&` SQL) with a passing unit test.
- [ ] `Query.events` resolver's `fieldMap` gains the static `scheduleDateRange` entry.
- [ ] GiST index migration created (via `drizzle-kit generate --custom`, hand-written statement), applied locally, no `schema.ts` change.
- [ ] AD-1's field/operator documentation updated with `scheduleDateRange`/`overlaps`.
- [ ] `pnpm build`/`pnpm lint` clean at the repo root; no codegen re-run needed (confirmed, not assumed).

## Out of Scope

- Any frontend UI or query-building for the Discovery page's Calendar View — entirely Story 1.3f's (integration/wiring) and Story 1.3g's (`WeeklyCalendarView` primitive) scope; this story only provides the backend operator they will consume.
- `WeeklyCalendarView`'s (Story 1.3g) visual stacking/overlap-rendering treatment for multi-day events (`DESIGN.md`'s `multi_day_event` token) — flagged as a non-blocking forward note (Dev Notes → Architecture & UX Gate Findings, Gate 2) for Story 1.3g's own implementation to confirm; not a prerequisite blocking this story.
- Supporting multiple simultaneous date-range *granularities* (e.g. month view vs. week view) or any caching/memoization of repeated `overlaps` queries — no such requirement exists in `epics.md` today; revisit only if a future story's needs grow beyond Story 1.3f's single week-scoped query.
- A fresh Gate 1/3 subagent dispatch against `epic-1-readiness.md` — this story's own scope was judged, via the documented lightweight escape-hatch guard, not to introduce anything the original Epic 1 sweep couldn't have anticipated (see Dev Notes → Architecture & UX Gate Findings and Pre-Coding Approval Gate).
- Splitting `apps/backend/src/schema/resolvers.ts` into per-domain resolver files — remains monolithic as today; this story adds to it in place.

## Definition of Done

- [ ] AC1-AC7 satisfied.
- [ ] Required tests passing: `packages/graphql-select` unit test, `apps/backend` integration tests (all AC6 boundary cases + regression).
- [ ] Lint and type checks passing for `packages/domain`, `packages/database`, `packages/graphql-select`, `apps/backend`.
- [ ] Migration applied cleanly against local dev Postgres; AD-1 documentation updated.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. `epic-1-readiness.md` is `swept: true` but predates Stories 1.3c-1.3h (all added 2026-08-05 during Story 1.3f's own creation) — its `stories_covered` list does not literally include this story. A lightweight escape-hatch guard was applied instead of a fresh Gate 1/3 subagent dispatch, judged sufficient because this story is itself the already-identified Gate 1 finding/resolution from Story 1.3f's creation, with no further architecture/infra/foundational gap surfaced within its own narrow scope. Gate 2 was run via a one-shot Freya-persona subagent dispatch (evidence inlined into the prompt rather than re-read from cold context, per token-efficiency guidance) — found zero in-scope UI gap (this story is backend-only) but surfaced a non-blocking forward note for Story 1.3g's own future implementation (multi-day event visual stacking), recorded in Dev Notes rather than escalated as a blocking prerequisite.
- One real design tradeoff — where the `overlaps` EXISTS-subquery SQL-building logic should live (generic `packages/graphql-select` switch case vs. ad hoc in `apps/backend/resolvers.ts` mirroring `isFavorited` literally) — was surfaced to and confirmed by the user via `AskUserQuestion` before finalizing Tasks, per this project's guidance to not silently pick a side on non-mechanical tradeoffs. Resolved toward the generic-switch-case option (see Dev Notes → Design Decision) for correctness (avoids a first-match-wins limitation on multiple `scheduleDateRange` conditions) and package-boundary consistency.
- A pre-existing tooling limitation (Drizzle's schema-first `index()` builder cannot express expression/functional indexes in the pinned drizzle-kit/drizzle-orm versions) was found while planning AC3's GiST index; resolved via `drizzle-kit generate --custom` + a hand-written statement, mirroring Story 2.5a's established "generate via drizzle-kit, hand-append what it can't diff" convention. Judged mechanical (the only technically correct path given the tooling constraint) and not escalated via `AskUserQuestion`.
- A concurrent-modification coordination risk was found: Story 2.5a (`ready-for-dev`, unimplemented) independently extends the same `TerminalOperator` union with `"withinRadius"`. Documented as a merge-not-overwrite note in Task 1 and the Pre-Coding Approval Gate rather than escalated, since it's a routine sequencing concern (whichever story's developer lands second simply merges), not a design tradeoff.
- Pre-Coding Approval Gate was confirmed explicitly with the user via `AskUserQuestion` before any code was written (scope, design decisions, and coordination risk all summarized and approved).
- `apps/backend`'s `tsx --test` process does not exit cleanly after tests finish (the shared `postgres.js` `db` client is never closed, keeping the event loop alive past the final TAP summary line) — confirmed this is pre-existing by stashing all story changes and re-running `resolvers.test.ts` against baseline `master`, which showed identical hang-after-pass behavior. Not fixed (out of scope for this story); noted here so future `dev-story`/CI runs on this repo know to treat "all subtests report `ok`" as the completion signal for this specific file rather than waiting on the process to exit or a final `# tests` summary line.
- Two new commits landed on `master` from a concurrent session during implementation (`3d3722a`, `4baccd3`, both part of the in-progress Story 2.3/saved-locations work) — unrelated to this story's backend-only scope; caused `apps/web`'s build to fail on a pre-existing `BlockingLoader` prop-type mismatch in `location-form-dialog.tsx`, confirmed unrelated by checking `git status`/`git log` and the file's own diff history.
- Given the per-file DB-connection hang above made a full `apps/backend` regression run very slow (background/foreground timeouts), the regression check was scoped to `resolvers.test.ts` (this story's directly modified resolver) plus `favorites-and-calendar.test.ts` and `user-locations.test.ts` (the only other backend test files that exercise the same `resolvers.ts` module) — all three fully pass. The remaining backend test files (`auth/*`, `geolocation/*`, `validation/*`) share no code with this story's changes and were not re-run.

### Completion Notes List

- Implemented all 6 tasks: `TerminalOperator` gained `"overlaps"` (`packages/domain`); `buildDrizzleWhere` gained a generic `overlaps` case building a correlated `EXISTS`+`daterange`+`&&` SQL expression from a `{table, eventIdCol, correlateCol, startCol, endCol}` config object (`packages/graphql-select`); a hand-written GiST index migration (`0008_schedule-date-range-gist-index.sql`) was generated via `drizzle-kit generate --custom` and applied locally; the `events` resolver's `fieldMap` gained a static `scheduleDateRange` entry (`apps/backend`); AD-1 documentation was updated; manual verification was run against the live dev server and real seeded data.
- All 7 ACs satisfied: AC1/AC2 (EXISTS + daterange/&& overlap semantics), AC3 (GiST index, confirmed present via `pg_indexes` query), AC4 (and/or composition, covered by both integration tests and a live curl smoke test), AC5 (full regression — see below), AC6 (all 6 boundary cases covered by integration tests: fully inside, spanning, start-edge-only, end-edge-only, entirely outside, single-day null-end-date), AC7 (no `.graphql`/codegen changes — confirmed no `events.graphql` diff).
- Tests: `packages/domain` build/typecheck only (pure type addition, no new test per Dev Notes → Testing Rules); `packages/graphql-select/drizzle-where.test.ts` — 22/22 pass (1 new `overlaps` case, written RED-first and confirmed failing before implementation); `apps/backend/src/schema/resolvers.test.ts` — new `scheduleDateRange overlaps filtering` block (4 subtests: AC6 boundaries, sub-schedule-only match, `and`-composition, `or`-composition with a second independent condition) all pass, plus full regression of the file's existing tests. `favorites-and-calendar.test.ts` (8/8) and `user-locations.test.ts` (13/13) — both share `resolvers.ts` and re-verified with no regressions.
- Manual verification (Task 6) ran against the already-running local dev server (`localhost:4001`) and real seeded data: confirmed an event (`...0003`, main schedule `2027-11-15`) matches a `[2027-11-16, 2027-11-16]` query only via its sub-schedule (`2027-11-16`), proving the EXISTS-against-full-table approach; confirmed `and`-composition with `types` narrows correctly; confirmed the pre-existing `types`-only filter is unaffected.
- Build: `packages/domain`, `packages/database`, `packages/graphql-select`, `apps/backend` all build clean (`tsc`) individually. Root `pnpm build` fails only on `apps/web` (pre-existing, unrelated `BlockingLoader` prop-type error from concurrent Story 2.3 work — see Debug Log).
- Lint: `--max-warnings 0` fails on `packages/domain`, `packages/graphql-select`, and `apps/backend` — but verified (by diffing against baseline `master` and checking exact line numbers) that every reported warning is pre-existing (`@typescript-eslint/no-explicit-any` on untouched lines, one pre-existing unused `eq` import in `resolvers.test.ts` that predates this story) and zero new warnings were introduced by this story's code. Flagging to the user per project policy rather than silently treating the DoD lint item as clean — the repo's lint baseline was already failing before this story started.

### File List

- `packages/domain/src/query/queryDsl.ts` (modified)
- `packages/graphql-select/drizzle-where.ts` (modified)
- `packages/graphql-select/drizzle-where.test.ts` (modified)
- `packages/database/migrations/0008_schedule-date-range-gist-index.sql` (new)
- `packages/database/migrations/meta/_journal.json` (modified, drizzle-kit-generated)
- `packages/database/migrations/meta/0008_snapshot.json` (new, drizzle-kit-generated)
- `apps/backend/src/schema/resolvers.ts` (modified)
- `apps/backend/src/schema/resolvers.test.ts` (modified)
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (modified)
