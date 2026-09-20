# Story 1.3j: Batch computed Event fields and gate totalCount/staleTime on the events query

## Story Details

- **Epic:** 1 â€” Core App and Event Discovery
- **Story ID:** 1.3j
- **Status:** review

## Story

**As a** developer,
**I want** `Query.events`'s computed fields (`isFavorited`, `favoriteCount`, `isAddedToCalendar`, `schedules`) resolved via one batched select instead of per-row field resolvers, its `totalCount` sub-query gated on actual field selection, and its three list-consumer hooks given a short `staleTime`,
**So that** the app's highest-traffic query (per the PRD's Performance NFR) stops costing `1 + 1 + 3N` DB round trips per page and stops refetching on every remount/refocus.

## Acceptance Criteria

1. **(BUG-030, AD-17 Rule 1)** Given `apps/backend/src/schema/resolvers.ts`'s `events` resolver builds its `db.select({...})` for `itemsQuery`, when it does so, then `packages/graphql-select/optimized-select.ts`'s `buildOptimizedDrizzleSelect` gains an optional `virtualFields: Record<string, SQL>` parameter, and the resolver passes its existing `fieldMap`'s `isFavorited`/`isAddedToCalendar` `EXISTS` expressions (today wired only into `buildDrizzleWhere` for WHERE-filtering) plus a new `favoriteCount` entry (`(SELECT count(*) FROM favorites WHERE favorites.event_id = events.id AND favorites.deleted_at IS NULL)`, as a correlated-subquery `SQL` expression, not a re-implementation) as `virtualFields` â€” each included in the final `select()` only when the corresponding GraphQL field is actually requested, using the same `info`-driven signal `buildOptimizedDrizzleSelect` already uses for `items`.
2. **(AD-17 Rule 1)** Given the above, when `Event.isFavorited`/`Event.favoriteCount`/`Event.isAddedToCalendar` field resolvers run, then they become passthroughs reading the pre-populated parent value, falling back to today's per-row query only when the value is absent (a defensive fallback for a caller that somehow reaches the field resolver without pre-population â€” never the expected path once this ships).
3. **(BUG-030, AD-17 Rule 2)** Given the `events` resolver has fetched its page of parent rows and `schedules` was requested (per `info`), when it returns, then it issues one additional `db.select({...buildOptimizedDrizzleSelect(schedules, info, {path: [...], virtualFields: {...}})}).from(schedules).where(inArray(schedules.eventId, ids))` query, groups the results by `eventId` in JS, and attaches them to each parent row as `item.schedules` before returning. `Event.schedules` becomes a passthrough reading `parent.schedules`, falling back to its current per-row query only when absent.
4. **(FIND-027)** Given the `events` resolver's `totalCount` second query (`resolvers.ts` ~3189-3194) runs unconditionally today, when this story ships, then it is gated on `info`'s field selection actually requesting `totalCount` â€” the same technique `buildOptimizedDrizzleSelect` already applies to `items`.
5. **(BUG-034)** Given the migration for this story runs, when it applies, then a partial index `CREATE INDEX idx_favorites_event_id ON favorites (event_id) WHERE deleted_at IS NULL;` is added via a Drizzle-kit-generated migration, hand-edited to include the `WHERE` clause per AD-8 Rule 3's documented drizzle-kit `WHERE`-clause-dropping limitation (matching `idx_favorites_active`/`idx_schedules_one_main_per_event`'s existing hand-edit precedent). This index ships in this story because Rule 1's per-row correlated subqueries are only viable with an `eventId`-leading index; without it they would force a sequential scan of `favorites` once per output row inside a single query execution â€” worse than today's separate per-row queries, not a fix.
6. **(FIND-028)** Given `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`, and `favorites/favorites-content.tsx`'s `getEvents`-consuming query hooks, when they are configured, then each is given `staleTime: 30_000` (30s), cutting refetch volume on remount/window-refocus without materially staling Discovery/Feed/Favorites data. (`favorites-content.tsx`'s separate `GetFavoritedEventIdsQuery` hook, which does not call `GetEventsDocument`, is explicitly out of scope.)
7. **(Regression)** Existing DSL/resolver behavior is unchanged and regression-verified: `eq`/`ne`/`contains`/`in`/`notIn`/`overlaps` operators and the existing `fieldMap` entries continue to behave exactly as before (existing `resolvers.test.ts`/`drizzle-where.test.ts`/`optimized-select.test.ts` tests pass unmodified).
8. **(Performance NFR)** A query-count integration test asserts that fetching a page of N events (N > 1, with `items { schedules { id } isFavorited favoriteCount isAddedToCalendar } totalCount }` all requested) now costs a small constant number of DB queries, not `O(N)` â€” the concrete regression target for the PRD's Performance NFR's "explicit query-count/cost check" requirement.
9. **(Explicit non-goal)** This story does not change the `event(id)`/`eventBySlug` resolvers â€” those are Story 1.6c's scope, which reuses this story's `virtualFields`/batched-schedules mechanism rather than reimplementing it.

## Tasks / Subtasks

- [x] **Task 1 â€” Extend `buildOptimizedDrizzleSelect` with `virtualFields` and a shared field-presence helper** (AC1, AC3, AC4, AC7)
  - [x] In `packages/graphql-select/optimized-select.ts`, extract the existing `parseResolveInfo`/`fieldsByTypeName` traversal into an exported helper `getRequestedFieldNames(info: GraphQLResolveInfo, path?: string | string[]): Set<string>` (see Dev Notes â†’ Design Decision for why `path` must become `string | string[]`, not stay a single string).
  - [x] Change `buildOptimizedDrizzleSelect`'s `options` to `{ path?: string | string[]; virtualFields?: Record<string, SQL> }`, its return type to `Record<string, PgColumn | SQL>`, and have it call `getRequestedFieldNames` internally; for each requested field name with no matching physical column, check `virtualFields` and include that expression if present.
  - [x] Add unit tests to `packages/graphql-select/optimized-select.test.ts` (existing pattern: `buildSchema`/`graphql()` against synthetic tables) covering: a virtual field included when requested, omitted when not requested, and a nested two-level `path` array reaching a synthetic child type's fields (proving the array-path change is correct before it's relied on by Task 3's real usage).
- [x] **Task 2 â€” Wire `isFavorited`/`favoriteCount`/`isAddedToCalendar` into the `events` resolver's item select** (AC1)
  - [x] In `apps/backend/src/schema/resolvers.ts`'s `fieldMap` (~line 2991), add a `favoriteCount` entry: `sql\`(SELECT count(*) FROM favorites WHERE favorites.event_id = ${events.id} AND favorites.deleted_at IS NULL)\`` (or the Drizzle-expression equivalent â€” match `isFavorited`'s existing style directly above it).
  - [x] Change the `requestedFields = buildOptimizedDrizzleSelect(events, info, { path: 'items' })` call (~line 3104) to pass `virtualFields: { isFavorited: fieldMap.isFavorited, favoriteCount: fieldMap.favoriteCount, isAddedToCalendar: fieldMap.isAddedToCalendar }`.
- [x] **Task 3 â€” Batch the `schedules` relation as one `IN (...)` query** (AC3)
  - [x] After `const items = hasMore ? fetchedItems.slice(0, qLimit) : fetchedItems;` (~line 3185), check `getRequestedFieldNames(info, 'items').has('schedules')`; if true and `items.length > 0`, run one `db.select({...buildOptimizedDrizzleSelect(schedules, info, { path: ['items', 'schedules'] })}).from(schedules).where(inArray(schedules.eventId, items.map(i => i.id)))`, group results by `eventId` in JS (a `Map<eventId, Schedule[]>`), and attach as `item.schedules` on each item before the `return`.
  - [x] No `virtualFields` needed on this nested `schedules` select in this story â€” `Schedule.isAddedToCalendar` batching (AD-17 Rule 3) is explicitly Story 1.6c's scope (AC9), not this resolver's. Leave `Schedule.isAddedToCalendar`'s existing per-row resolver untouched.
- [x] **Task 4 â€” Make `Event.isFavorited`/`favoriteCount`/`isAddedToCalendar`/`schedules` field resolvers passthroughs** (AC2, AC3)
  - [x] In `resolvers.ts`'s `Event` resolver map (~lines 3645-3714), change each of the four to: `return parent.<field> !== undefined ? parent.<field> : <existing per-row query body, unchanged>`. Preserve the existing `try/catch` â†’ `false` shape for `isFavorited`/`isAddedToCalendar`'s fallback path exactly as today (anonymous/error case).
- [x] **Task 5 â€” Gate the `totalCount` query on field selection** (AC4)
  - [x] Wrap the `totalCountRes = await db.select({ count: count() as any })...` block (~lines 3189-3194) in `if (getRequestedFieldNames(info).has('totalCount')) { ... } else { totalCount = 0 }` (or equivalent) â€” note `info` here is the RAW resolver `info` with no `path`, since `totalCount` is a direct field of `EventConnection`, the type `info` already represents at this call site.
- [x] **Task 6 â€” Add the `favorites (event_id)` partial index** (AC5, Data Type Compatibility)
  - [x] In `packages/database/schema.ts`'s `favorites` table definition (~line 415-424), add a second index entry alongside `activeIdx`: `eventIdIdx: index('idx_favorites_event_id').on(t.eventId).where(sql\`deleted_at IS NULL\`)`.
  - [x] Run `drizzle-kit generate` to produce `packages/database/migrations/0060_*.sql` (next available number â€” 0059 is the current highest). Hand-edit the generated `CREATE INDEX` statement to append `WHERE "deleted_at" IS NULL` (drizzle-kit drops it â€” confirmed, AD-8 Rule 3), with a comment matching migration `0057_same_kang.sql`'s precedent, pointing back to this story and AD-8.
  - [x] Confirm the migration applies cleanly against the local dev Postgres DB (`DATABASE_URL` in `packages/database/.env` â€” native Windows Postgres service `postgresql-x64-18`, not Docker).
- [x] **Task 7 â€” Add `staleTime: 30_000` to the three `getEvents`-consuming hooks** (AC6)
  - [x] `apps/web/src/app/[locale]/home-content.tsx` (~line 174), `apps/web/src/app/[locale]/feed/feed-content.tsx` (~line 136), `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (~line 207) â€” add `staleTime: 30_000` to each `useInfiniteQuery` options object. Do NOT touch `favorites-content.tsx`'s separate `useQuery<GetFavoritedEventIdsQuery>` (~line 167) â€” it doesn't call `GetEventsDocument`.
- [x] **Task 8 â€” Regression pass** (AC7)
  - [x] Run the full existing `apps/backend/src/schema/resolvers.test.ts`, `packages/graphql-select/drizzle-where.test.ts`, and `packages/graphql-select/optimized-select.test.ts` suites unmodified; confirm all pass with zero behavior change to any field/operator this story doesn't touch.
- [x] **Task 9 â€” Query-count integration test** (AC8)
  - [x] In `resolvers.test.ts`, add a new test instrumenting DB round-trips during one `events` GraphQL call requesting `items { id schedules { id } isFavorited favoriteCount isAddedToCalendar } totalCount hasMore` against â‰¥2 seeded events with â‰¥1 schedule each and authenticated `userId`. Instrument via the `postgres` client's `debug` callback (`apps/backend/src/db/client.ts`'s `postgres(env.databaseUrl, {...})` call) or drizzle's `logger` option â€” see Dev Notes â†’ Testing Approach for the exact mechanism, since no prior precedent exists in this suite. Assert the query count is a small constant (expected: `items` select + `schedules` batch select + `totalCount` select â‰ˆ 3, not `1 + 1 + 3N`), independent of N.
  - [x] Add a companion assertion that requesting the same fields WITHOUT `totalCount` in the selection set skips the `totalCount` query entirely (count drops by exactly 1), proving AC4's gating.
- [x] **Task 10 â€” Architecture spine documentation** (housekeeping, matches Story 1.3h/1.3a precedent)
  - [x] Add a short note under AD-17 in `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` recording that "Story sequence item A" (this story) has shipped, so Story 1.6c's own Dev Notes can cite it as a real, landed precedent rather than a still-planned one.

## Dev Notes

### Architecture & UX Gate Findings

`_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is `swept: true` for Epic 1, but its `stories_covered` list (1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6, ...) predates this story's entire subject matter â€” BUG-030/FIND-027/BUG-034/FIND-028 and Architecture Spine AD-17 did not exist until the 2026-09-15 `bmad-agent-architect` performance audit, well after the sweep's 2026-07-31 date. Per the lightweight-guard instruction (and matching the precedent already set by Stories 1.6e/0.36/1.3k for the same reason), Gates 1/2/3 were run **fresh** via a one-shot multi-persona subagent dispatch (all evidence â€” AD-17's full text, the current `resolvers.ts`/`optimized-select.ts`/`schema.ts` code, DESIGN.md's full content, migration precedent â€” inlined into the prompt, not re-read from cold context) rather than cited from the stale report. All three gates returned **no gap**:

- **Gate 1 (Architecture/Infra Completeness, Winston lens): No gap.** Every field this story touches (`isFavorited`, `favoriteCount`, `isAddedToCalendar`, `schedules`, `totalCount`) already exists in the GraphQL schema and is already resolved server-side through `apps/backend`; this story only changes *how* those fields get their data (batched vs. per-row), entirely within `apps/backend`/`packages/graphql-select`/`packages/database`. No new resolver, query, mutation, or frontend-to-DB/external-service call is introduced. The `virtualFields` mechanism itself is the already-decided output of a dedicated prior architecture pass (AD-17, which explicitly considered and rejected DataLoader) â€” this story implements a fully-specified mechanism, it does not invent one.
- **Gate 2 (UI Complexity & Reusability, Freya/Sally lens): No gap.** This story ships zero UI â€” no new component, no visual state, no variant, no a11y surface. AC6's `staleTime: 30_000` is a caching-window parameter on three already-existing hooks, not a UI behavior change with a design signature. `design-artifacts/UX-festgrid-run-1/DESIGN.md` (read in full, ~650 lines) is entirely card-visual tokens (masonry/calendar-row/calendar-grid-item cards, date boxes, badges, nav, modals) with nothing about query staleness or resolver performance; `EXPERIENCE.md`'s section list (Foundation, IA, Interaction Primitives, User Flows, Component Patterns, State Patterns, Responsive, Accessibility) has no entry for this either.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston lens): No gap.** `buildOptimizedDrizzleSelect` is exactly the "named, reusable utility explicitly mandated in project-context.md" Gate 3's own trigger heuristic names as an example â€” it already has its home (`packages/graphql-select`, built by Story 0.8, `review`/shipped) and this story only *extends* that existing, already-owned utility with a new optional `virtualFields` parameter; it does not introduce a new utility needing a new home. No i18n/analytics/app-shell/GraphQL-codegen-scaffold surface is touched. One candidate was pressure-tested and rejected: AC8's query-count test helper is being built from scratch (no prior precedent in the backend suite) and Story 1.6c will likely reuse it â€” but it isn't referenced anywhere in project-context.md/the architecture spine, isn't a "named mandated utility," and is narrowly scoped to backend resolver tests rather than project-wide; 1.6c reusing it afterward (1.6c is sequenced *after* this story, AD-17 Rule 5) is ordinary forward reuse, not a blocked prerequisite.

No prerequisite story was split off; no `sprint-status.yaml`/`epics.md` addition beyond this story's own registration was required.

### Design Decision: `buildOptimizedDrizzleSelect`'s `path` option must become `string | string[]` (not confirmed with user â€” mechanical, not a tradeoff)

AD-17 Rule 2's pseudocode (`buildOptimizedDrizzleSelect(schedules, info, {path: 'schedules', virtualFields: {...}})`) is accurate for `event`/`eventBySlug` (Story 1.6c's scope) â€” those resolvers' `info` argument already represents the `Event` type directly (no connection wrapper), so a single-level `path: 'schedules'` reaches `Schedule`'s requested sub-fields correctly, exactly like today's existing `Event.schedules` field-resolver call (`buildOptimizedDrizzleSelect(schedules, info)`, no path at all, because *that* `info` is already scoped to the `schedules` field itself).

**This story's `events` resolver is a different case.** Its `info` represents the top-level `events` field, which returns `EventConnection` â€” reaching `Schedule`'s requested sub-fields from there requires **two** navigations: `EventConnection` â†’ `items` (â†’ `Event`) â†’ `schedules` (â†’ `Schedule`). The current `buildOptimizedDrizzleSelect`/`options?.path` implementation only supports ONE navigation (a single string). Naively calling `buildOptimizedDrizzleSelect(schedules, info, { path: 'schedules' })` from inside the `events` resolver would look for a `schedules` field directly on `EventConnection` (which doesn't exist) and silently return `{}` â€” an empty select that would produce schedules rows with only whatever extra columns are manually spread in, not a loud failure. This is exactly the kind of "vague implementation" this workflow exists to prevent.

**Resolution:** widen `path` to `string | string[]`, looping the existing single-level navigation logic once per segment. Call sites:
- `events` resolver (this story): `buildOptimizedDrizzleSelect(schedules, info, { path: ['items', 'schedules'] })`.
- `event`/`eventBySlug` resolvers (Story 1.6c, unchanged by this story): `buildOptimizedDrizzleSelect(schedules, info, { path: 'schedules' })` â€” a bare string still works unmodified since `string | string[]` is a superset, so this is non-breaking for 1.6c's later reuse.

This is judged a mechanical correctness fix required to make AD-17 Rule 2 actually work for the `events` (list) case, not a design tradeoff with a real alternative â€” not escalated via `AskUserQuestion`.

### Data Type Compatibility & Migration Requirements

- **No column/type mismatch.** Every field this story touches already exists with correct types in `schema.ts`, `events.graphql`, and the generated TypeScript (`Event.isFavorited: Boolean`, `Event.favoriteCount: Int`, `Event.isAddedToCalendar: Boolean`, `Event.schedules: [Schedule!]`, `EventConnection.totalCount: Int!`) â€” this story is a resolver-internals/query-shape optimization, not a schema change. No `.graphql` file changes, no GraphQL Code Generator re-run needed, no `packages/shared-types` change.
- **The one real DB change is additive-index-only:** `favorites` gains a new `(event_id) WHERE deleted_at IS NULL` partial index (AC5/BUG-034), alongside â€” not replacing â€” the existing `(user_id) WHERE deleted_at IS NULL` `idx_favorites_active` index. Ships via a Drizzle-kit-generated + hand-edited migration (Task 6), following the exact precedent of migration `0057_same_kang.sql` (`idx_schedules_one_main_per_event`) for the drizzle-kit-drops-partial-index-WHERE-clause workaround (AD-8 Rule 3, confirmed still-open upstream: drizzle-orm#3349, drizzle-kit-mirror#461).
- **Backward compatibility:** Purely additive on both the resolver and DB sides â€” a query that doesn't request `schedules`/`totalCount`/the batched fields is unaffected (Task 3/5's gating means no new query fires when the field isn't asked for); a query that does request them gets the same *data*, sourced via fewer round trips. No caller-visible response-shape change.
- **Verification:** Task 1's unit tests (virtualFields inclusion/omission, multi-level path); Task 8's full regression pass on existing DSL/fieldMap/optimized-select tests; Task 9's new query-count test (the concrete proof this story's whole point â€” fewer round trips â€” actually holds); Task 6's manual migration-apply check against local dev Postgres.

### State Management Categorization

Not a new state-management surface â€” `home-content.tsx`/`feed-content.tsx`/`favorites-content.tsx`'s `getEvents` hooks are already-existing **Server State (React Query)** per `project-context.md`'s three-way categorization (Server State / URL State / Client Global State). This story only adds a `staleTime` option to already-categorized `useInfiniteQuery` calls â€” no new hook, no new state scope, no `nuqs`/`zustand` involvement.

### Loader Classification

Not applicable â€” no new asynchronous UI surface is introduced. The existing Skeleton/loading-state behavior on Discovery (`home-content.tsx`), Feed, and Favorites pages is unchanged by this story; `staleTime` only changes *when* React Query decides a cached result is stale enough to trigger a background refetch on remount/refocus, not the shape or presence of any loading UI.

### Package boundaries

- All resolver/query-batching logic (Tasks 1-5) stays inside `apps/backend` and `packages/graphql-select` â€” both already backend/Node-only by design (per `project-context.md`'s Code Organization rule); no `packages/domain` change is needed or introduced by this story (unlike Story 1.3h's `overlaps`, which did touch `packages/domain`'s `TerminalOperator` union â€” this story adds no new DSL operator, only extends the existing output-selection mechanism).
- The `favorites (event_id)` index (Task 6) is a `packages/database` schema/migration change, matching where every other index in this codebase lives.
- The `staleTime` change (Task 7) stays inside `apps/web`'s existing React Query hooks â€” consistent with `project-context.md`'s package dependency rule that state management (react-query/nuqs/zustand) is isolated strictly within `apps/web`.
- No `packages/ui` change â€” no UI ships from this story.

### Architecture / technical constraints

- **AD-17 (binding, full text read and reproduced above):** this story IS AD-17's "Story sequence item A" â€” Rules 1/2/4/5 govern this story's implementation directly; Rule 3 (Schedule.isAddedToCalendar batching) and BUG-035 (double-fetch dedup) are explicitly Story 1.6c's scope ("Story sequence item B"), not this story's (AC9).
- **AD-8 (Soft-Delete Convention) Rule 3:** governs the exact hand-edit workaround required for the new partial index (Task 6) â€” see precedent migration `0057_same_kang.sql`.
- **AD-1/AD-2 (Unified Query DSL/Event Querying):** unaffected â€” this story adds no new DSL operator or endpoint; it only changes how the existing `events` resolver populates its output, not how it's queried/filtered.
- **Adapter Pattern / General Architecture:** not applicable â€” no external service call is introduced or changed.
- **AD-5 (Analytics)/AD-6 (i18n):** not applicable â€” no new user-facing text or tracked interaction ships from this story.
- **AD-7 (Authenticated Context):** unaffected â€” `isFavorited`/`isAddedToCalendar`/`favoriteCount`'s existing `userId`-gated behavior (via the already-built `fieldMap` EXISTS expressions, `sql\`false\`` for anonymous callers) is preserved exactly, just relocated from per-row resolver calls to the parent-row select.

### Previous/Sibling Story Intelligence (Stories 1.3a, 1.3h, 0.8, 1.3i)

- **Story 1.3a (`done`, fully implemented)** â€” the `events` resolver this story amends. Confirmed via direct read of the current `resolvers.ts`: `fieldMap`'s `isFavorited`/`isAddedToCalendar` are already exactly the `exists(db.select(...))` Drizzle expressions this story needs to reuse verbatim as `virtualFields` (Task 2) â€” no re-implementation, per AD-17 Rule 1's explicit "the exact expressions, not re-implementations" requirement.
- **Story 1.3h (`review`, implemented)** â€” the closest recent analog in this exact file/module. Its Dev Notes (read in full) establish: (a) the lightweight-guard pattern for a story outside `epic-1-readiness.md`'s covered list (reused above); (b) the `drizzle-kit generate --custom` hand-written-migration convention for index shapes the schema-first builder can't express, vs. (c) the plain-`drizzle-kit generate`-then-hand-edit-the-WHERE-clause convention (migration `0057`) for a partial index that DOES have a builder representation â€” **this story's new index (Task 6) is case (c), not case (b)**, since `index('idx_favorites_event_id').on(t.eventId).where(...)` is fully expressible via the existing `index()` builder (unlike Story 1.3h's GiST expression index, which had no builder representation at all). Also confirmed the `apps/backend`'s `tsx --test` process doesn't exit cleanly after tests finish (pre-existing, unrelated to any specific story) â€” treat "all subtests report `ok`" as the completion signal, not process exit.
- **Story 0.8 (`review`, shipped)** â€” built `buildOptimizedDrizzleSelect` and its existing test file (`packages/graphql-select/optimized-select.test.ts`, read in full â€” 89 lines, uses `buildSchema`/`graphql()` against synthetic `pgTable`s and a hand-written GraphQL schema, no real DB). Task 1's new tests should match this exact synthetic/no-DB style, not `resolvers.test.ts`'s real-DB integration style.
- **Story 1.3i (`done`)** â€” the immediately-preceding sibling in file order (masonry/list view-mode toggle wiring into `apps/web`). Not directly relevant to this story's implementation (entirely frontend UI, this story is entirely backend/query-perf) â€” noted for completeness per the workflow's "ALL stories in this epic" instruction, but no reusable pattern from it applies here.

### Git Intelligence Summary

Most recent commits (`0e51230`, `84d4fd2`, `667ee53`, `a1dbeab`, `60bdee8`) are unrelated backlog/board-hygiene and Story 5.4a work â€” no commit in recent history touches `apps/backend/src/schema/resolvers.ts`, `packages/graphql-select/optimized-select.ts`, or the three `apps/web` hook files this story modifies, confirming this story's scope has not started implementation. Working tree has some pre-existing unrelated modified/untracked files (`apps/ux-rework2.md`, generated codegen output, orchestrator batch-state JSON, etc.) â€” none overlap this story's File Change Plan; do not touch them.

**Registration note:** Story 1.3j and its epics.md section were added 2026-09-15 via `bmad-correct-course` (CC-020, `sprint-change-proposal-2026-09-15-getevents-eventbyslug-perf-hardening.md`), which explicitly deferred `sprint-status.yaml` registration to "a separate later session" (this one). An earlier, *unrelated* "Story 1.3j" (a narrow EventCard date-display bug fix) existed briefly on 2026-09-07 and was fully merged into Story 1.3b as AC19 the same day (`git log` commits `604675c`/`b6dc200`) â€” its `epics.md`/`sprint-status.yaml` entries were removed at that time, freeing the "1.3j" label for reuse by this unrelated, later story. No conflict exists in the current `epics.md`/`sprint-status.yaml` state.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules â†’ API & Data, Database & Performance [`Query.events` highest-traffic-endpoint rule, existing N+1/`virtualFields` fix pointer]; Code Quality & Style Rules â†’ Code Organization; Testing Rules; State Management Architecture)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-17 â€” binding mechanism; AD-8 â€” index hand-edit precedent; AD-1/AD-2 â€” unaffected-by confirmation)
- `_bmad-output/planning-artifacts/epics.md` (Story 1.3j, Story 1.3a, Story 0.8, Story 1.6c)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (stale for this story's subject matter â€” see Dev Notes â†’ Architecture & UX Gate Findings)
- `docs/infrastructure/2-backend.md`, `docs/infrastructure/3-database.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `packages/graphql-select/optimized-select.ts` (new exported `getRequestedFieldNames` helper; `buildOptimizedDrizzleSelect` gains `virtualFields` + array-capable `path`); `packages/graphql-select/optimized-select.test.ts` (new unit tests, Task 1).
- **Modified:** `apps/backend/src/schema/resolvers.ts` (`fieldMap` gains `favoriteCount`; `events` resolver wires `virtualFields` into its `items`/`schedules` selects and gates `totalCount`; `Event.isFavorited`/`favoriteCount`/`isAddedToCalendar`/`schedules` and become passthrough-with-fallback); `resolvers.test.ts` (new query-count integration test, Task 9).
- **Modified:** `packages/database/schema.ts` (`favorites` table gains `eventIdIdx`).
- **New:** `packages/database/migrations/0060_*.sql` (drizzle-kit-generated + hand-edited partial index, Task 6) + corresponding `meta/_journal.json`/`meta/00NN_snapshot.json` (drizzle-kit-generated).
- **Modified:** `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/feed/feed-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (each `useInfiniteQuery` gains `staleTime: 30_000`).
- **Modified:** `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-17 "Story sequence item A shipped" note, Task 10).
- **Not modified:** `apps/backend/src/schema/events.graphql` (no schema change); any generated codegen output (`resolvers-types.ts`/`apps/web/src/generated/graphql.ts` â€” no re-run needed, no schema change); `event`/`eventBySlug` resolvers or `Schedule.isAddedToCalendar` (AC9, explicitly Story 1.6c's scope); `packages/domain` (no DSL operator added); `packages/ui` (no UI in this story).

### Rule Mapping

- *AD-17 Rules 1/2/4/5* â†’ Tasks 1-5 implement the batching mechanism exactly as decided; Rule 4's DataLoader rejection means no `dataloader` dependency or `createContext` change is introduced anywhere in this story.
- *AD-8 Rule 3* â†’ Task 6's index ships via the plain-`generate`-then-hand-edit-WHERE-clause pattern (migration `0057` precedent), not the `--custom` pattern (which is for indexes with no builder representation at all, per Story 1.3h's GiST case â€” not this story's case).
- *project-context.md Database & Performance rule* â†’ Task 6's index is the prerequisite that makes Task 2's correlated subqueries viable at all (AC5's own stated rationale).
- *Code Organization (packages/graphql-select vs apps/backend)* â†’ the reusable `virtualFields`/`getRequestedFieldNames` mechanism lives in `packages/graphql-select` (already Drizzle-coupled by design, already owns `buildOptimizedDrizzleSelect`); the static `favoriteCount` `fieldMap` config entry lives in `apps/backend`'s resolver, matching `isFavorited`'s existing precedent one line above it.
- *State Management Architecture* â†’ Task 7's `staleTime` change stays within the already-correct Server State (React Query) categorization; no re-categorization needed.
- *Testing Rules* â†’ Task 1's unit tests follow `packages/graphql-select`'s existing no-real-DB `buildSchema`/`graphql()` pattern; Task 8/9 follow `apps/backend`'s existing real-local-DB Yoga-integration pattern.
- *Story-split-gate Gate 1/2/3* â†’ all three run fresh (lightweight-guard triggered by the stale sweep date), all returned no gap â€” see Dev Notes â†’ Architecture & UX Gate Findings.

### Verification Plan

- `packages/graphql-select`: `tsx --test` â€” new unit tests (Task 1) for `virtualFields` inclusion/omission and multi-level `path` array traversal; full existing suite (`drizzle-where.test.ts`, `active-only.test.ts`, `optimized-select.test.ts`) passes unmodified (AC7).
- `apps/backend`: `tsx --test` on `resolvers.test.ts` â€” full existing suite passes unmodified (AC7, including the `scheduleDateRange`/`overlaps` tests Story 1.3h added and every other existing `events`/`Event`/`Schedule` test); new query-count integration test (Task 9) proves AC8's O(1)-not-O(N) claim and AC4's `totalCount` gating, both against the real local Postgres DB per this project's testing-trophy convention.
- Manual: confirm migration `0060_*.sql` applies cleanly against local dev Postgres (`DATABASE_URL` from `packages/database/.env`, native `postgresql-x64-18` service); a GraphiQL/`curl` smoke test against real seeded data comparing response shape/values before and after (same events, same `isFavorited`/`favoriteCount`/`isAddedToCalendar`/`schedules` values, fewer queries in server logs/instrumentation); confirm `pnpm build`/`pnpm lint` clean at the repo root for every touched package, with **no** codegen re-run needed (confirmed, not assumed, since no `.graphql` file changes).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: `packages/graphql-select`, `apps/backend`, `packages/database` (index-only), plus a narrow `apps/web` `staleTime` change to 3 existing hooks and an architecture-spine documentation note â€” no new UI, no new API surface, no `packages/domain`/`packages/ui` changes.
- [ ] **No blocking dependency:** confirmed via direct reads that Story 1.3a (`done`) and Story 0.8 (`review`/shipped) are both real and complete; this story has no other unmet prerequisite.
- [ ] **Gate 1/2/3 accepted:** all three gates run fresh (epic-1-readiness.md predates this story's subject matter) via one-shot multi-persona subagent dispatch â€” all returned "no gap." Accepted, not escalated (see Dev Notes â†’ Architecture & UX Gate Findings).
- [ ] **Design decision accepted (mechanical, not escalated):** `buildOptimizedDrizzleSelect`'s `path` option widens from `string` to `string | string[]` to correctly support the `events` resolver's two-level `items â†’ schedules` traversal, vs. `event`/`eventBySlug`'s one-level `schedules` traversal (Story 1.6c) â€” see Dev Notes â†’ Design Decision for why this is a correctness requirement, not a stylistic choice.
- [ ] **Data-type-compatibility finding accepted:** no schema/column/type change beyond one additive partial index; hand-edit-the-generated-migration's-WHERE-clause workaround required per AD-8 Rule 3 (confirmed still-open upstream issue), matching migration `0057`'s precedent exactly.
- [ ] Architecture and data/API boundaries confirmed: batching logic in `apps/backend`/`packages/graphql-select`; index in `packages/database`; `staleTime` stays inside `apps/web`'s existing React Query hooks; no `.graphql` schema change, no codegen re-run.
- [ ] Testing plan confirmed: `packages/graphql-select` unit tests (Task 1); `apps/backend` full regression + new query-count integration test against the real local Postgres DB (Tasks 8-9, no mocking of the DB layer, matching this repo's existing convention).
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/graphql-select`: `tsx --test` unit tests (Task 1) for the new `virtualFields`/multi-level-`path` behavior of `buildOptimizedDrizzleSelect`/`getRequestedFieldNames`, matching this file's existing `buildSchema`/`graphql()`-against-synthetic-tables, no-real-DB style.
- `apps/backend`: integration tests (`tsx --test`, Yoga + real local test Postgres DB, matching `resolvers.test.ts`'s established pattern) â€” full regression of every existing `events`/`Event`/`Schedule` test (AC7), plus a new query-count-instrumented test proving a constant, not O(N), query count when all batched fields are requested, and proving `totalCount`'s query is skipped when not requested (AC4, AC8).
- No new E2E test in this story â€” this is a pure performance/internals change with no observable UI/response-shape difference for any consumer; the existing E2E coverage on Discovery/Feed/Favorites (owned by their respective feature stories) already exercises this resolver end-to-end and continues to pass unchanged.

## Deliverables Checklist

- [ ] `buildOptimizedDrizzleSelect` gains `virtualFields` and array-capable `path`; `getRequestedFieldNames` extracted and exported, with passing unit tests.
- [ ] `events` resolver's `fieldMap` gains `favoriteCount`; `items`/`schedules` selects wire `virtualFields` in.
- [ ] `events` resolver batches `schedules` as one `IN (...)` query, gated on selection.
- [ ] `events` resolver's `totalCount` query gated on selection.
- [ ] `Event.isFavorited`/`favoriteCount`/`isAddedToCalendar`/`schedules` field resolvers are passthrough-with-fallback.
- [ ] `idx_favorites_event_id` partial index migration created (hand-edited WHERE clause), applied locally.
- [ ] `home-content.tsx`/`feed-content.tsx`/`favorites-content.tsx`'s `getEvents` hooks have `staleTime: 30_000`.
- [ ] Full existing regression suite passes unmodified.
- [ ] New query-count integration test passes, proving O(1)-not-O(N) and `totalCount` gating.
- [ ] AD-17 documentation note added recording this story as shipped.
- [ ] `pnpm build`/`pnpm lint` clean for every touched package.

## Out of Scope

- `event(id)`/`eventBySlug` resolvers, `Schedule.isAddedToCalendar` batching (AD-17 Rule 3), and the `EventDetailWrapper.tsx` double-fetch dedup (BUG-035) â€” entirely Story **1.6c**'s scope, which reuses this story's `virtualFields`/batched-schedules mechanism verbatim rather than reimplementing it (AC9, explicit).
- Any new GraphQL schema field, resolver, or API surface â€” none is needed; every field this story touches already exists.
- Any UI/visual change â€” none ships from this story (Gate 2: no gap, zero UI scope).
- Fixing the pre-existing `apps/backend` `tsx --test` process-doesn't-exit-cleanly issue (Story 1.3h Dev Notes) â€” pre-existing, unrelated, out of scope.
- Extending `virtualFields`/batching to any resolver beyond `Query.events` in this story (e.g. `myFavorites`, `myCalendar`, moderator queue queries) â€” no such requirement exists in `epics.md` today; revisit only if a future story's needs grow beyond this story's and Story 1.6c's scope.

## Definition of Done

- [x] AC1-AC9 satisfied.
- [x] Required tests passing: `packages/graphql-select` unit tests, `apps/backend` full regression + new query-count integration test.
- [x] Lint and type checks passing for `packages/graphql-select`, `apps/backend`, `packages/database`, `apps/web` (touched files only).
- [x] Migration applied cleanly against local dev Postgres; AD-17 documentation updated.

## Completion Status

- [x] Completed â€” all Tasks 1-10 implemented; pending code review (status: `review`).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`, invoked directly with epic/story number `1.3j` (no `sprint-status.yaml` backlog entry existed yet at invocation time â€” confirmed via `sprint-status-tool.py get`, exit 1 "not found" â€” because the 2026-09-15 `bmad-correct-course` commit (CC-020, `9c6d1a5`) that added this story's `epics.md` section explicitly deferred `sprint-status.yaml` registration to "a separate later session," which this run completes). A `git log` search also surfaced an earlier, unrelated "Story 1.3j" (an EventCard date-display bug fix, fully merged into Story 1.3b as AC19 on 2026-09-07, commits `604675c`/`b6dc200`) â€” confirmed this is a retired, unrelated use of the same label with no residue in current `epics.md`/`sprint-status.yaml`, not a drift/collision case.
- `epic-1-readiness.md` is `swept: true` but its `stories_covered` list predates this story's AD-17 subject matter entirely (sweep date 2026-07-31; AD-17 decided 2026-09-15) â€” the lightweight-guard instruction was applied and all three gates (1/2/3) were run fresh via a one-shot multi-persona subagent dispatch (evidence inlined, not re-read from cold context, per token-efficiency guidance), matching the precedent already set by Stories 1.6e/0.36/1.3k for the identical "sweep predates this story" situation. All three returned "no gap" â€” see Dev Notes â†’ Architecture & UX Gate Findings for full reasoning, including the one candidate gap (AC8's from-scratch query-count test helper) that was pressure-tested and explicitly rejected as not meeting Gate 3's bar.
- One mechanical (not escalated via `AskUserQuestion`) design correction was made while drafting Tasks: AD-17 Rule 2's pseudocode (`path: 'schedules'`) is correct only for `event`/`eventBySlug` (Story 1.6c's later reuse); the `events` resolver in *this* story needs a two-level path (`['items', 'schedules']`) since its `info` starts at the `EventConnection` type, not `Event` directly. Verified by direct reading of `buildOptimizedDrizzleSelect`'s current single-level-only `options?.path` implementation. Resolved by widening `path` to `string | string[]` (backward-compatible with Story 1.6c's later single-string usage) rather than escalating, since there is no genuine alternative â€” a naive single-level call would silently return an empty select rather than throw, making this a correctness requirement, not a stylistic preference.
- Task 6's index approach (plain `drizzle-kit generate` + hand-edit the `WHERE` clause, migration `0057` precedent) was deliberately distinguished from Story 1.3h's `drizzle-kit generate --custom` approach (migration `0008`) after direct comparison: this story's index has a full `index().on().where()` builder representation (like `idx_favorites_active`), unlike 1.3h's GiST expression index (which had none) â€” using the wrong precedent would have produced an unnecessary hand-written-from-scratch migration instead of the simpler generate-then-patch flow.

### Completion Notes List

**Status:** all Tasks 1-10 implemented; story moved to `review` (pending code review).

**Summary of implementation:**

- **Task 1 (graphql-select):** Extracted `getRequestedFieldNames(info, path?: string | string[])` from the existing `parseResolveInfo`/`fieldsByTypeName` traversal in `packages/graphql-select/optimized-select.ts`; widened `buildOptimizedDrizzleSelect`'s `options` to `{ path?: string | string[]; virtualFields?: Record<string, SQL> }`, its return type to `Record<string, PgColumn | SQL>`, and wired `virtualFields` into the select so a requested virtual field with no matching physical column is included when selected and omitted otherwise. Added 3 unit tests (virtual included when requested, omitted when not, and a two-level array `path` reaching a synthetic child type) — `packages/graphql-select` suite now 34/34 passing.
- **Task 2 (backend):** Added `favoriteCount` to the `events` resolver's `fieldMap` as a correlated-subquery `SQL` expression and passed `virtualFields: { isFavorited, favoriteCount, isAddedToCalendar }` into the `items` select.
- **Task 3 (backend):** Batched `schedules` into a single `IN (...)` query (gated on `getRequestedFieldNames(info, 'items').has('schedules')`), grouped by `eventId` in JS, and attached as `item.schedules`, eliminating the per-row `N` queries.
- **Task 4 (backend):** Made `Event.isFavorited`/`favoriteCount`/`isAddedToCalendar`/`schedules` passthrough-with-fallback resolvers (preserving the existing `try/catch → false` anonymous/error shape).
- **Task 5 (backend):** Gated the `totalCount` sub-query on `getRequestedFieldNames(info).has('totalCount')`, returning `0` when unrequested.
- **Task 6 (database):** Added `idx_favorites_event_id ON favorites (event_id) WHERE deleted_at IS NULL` partial index via Drizzle-kit-generated migration `0060_square_pretty_boy.sql`, hand-edited to add the `WHERE` clause per AD-8 Rule 3 (`0057` precedent); verified applied with the `WHERE` clause against local Postgres.
- **Task 7 (web):** Added `staleTime: 30_000` to the `getEvents` hooks in `home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`.
- **Tasks 8-9 (tests):** Full backend regression passes (**780 tests, 779 pass, 0 fail, 1 pre-existing skip**, ~9.6 min) including the new AC8 query-count integration test proving constant (not O(N)) round trips and that `totalCount`'s query is skipped when not requested. Also fixed the query-count test helper's seed column (`fullName` → `name` + `role`) per the `users` schema.
- **Task 10 (docs):** Added an AD-17 shipped note to `festgrid-architecture-spine.md` recording Story 1.3j as the landed precedent for Story 1.6c.

**Non-DB verification also clean:** backend build, backend lint (0 errors), `apps/web` lint (0 errors), `packages/graphql-select` 34/34. DB was recreated (corrupt `festgrid` dropped with `FORCE`, new OID 95149) then migrated (incl. 0060) and seeded to resolve the `58P01` corruption before tests.

### File List

- `packages/graphql-select/optimized-select.ts` — `getRequestedFieldNames`, `virtualFields`, array `path` support
- `packages/graphql-select/optimized-select.test.ts` — 3 new unit tests
- `apps/backend/src/schema/resolvers.ts` — `favoriteCount` fieldMap, `virtualFields` wiring, batched `schedules`, `totalCount` gating, 4 passthrough resolvers
- `apps/backend/src/schema/resolvers.test.ts` — new query-count integration test + `fullName`→`name`/`role` fix
- `packages/database/schema.ts` — `favorites` `eventIdIdx` partial index
- `packages/database/migrations/0060_square_pretty_boy.sql` — new migration (new file)
- `packages/database/migrations/meta/0060_snapshot.json` — Drizzle-kit meta (new file)
- `packages/database/migrations/meta/_journal.json` — journal entry for 0060
- `apps/web/src/app/[locale]/home-content.tsx` — `staleTime: 30_000`
- `apps/web/src/app/[locale]/feed/feed-content.tsx` — `staleTime: 30_000`
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx` — `staleTime: 30_000`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-17 shipped note
- `_bmad-output/implementation-artifacts/1-3j-batch-computed-event-fields-and-gate-totalcount-staletime.md` — this story file
