---
baseline_commit: 6148b785468af3dfe53a075aff08ab6f89bba7c0
---
# Story 2.1a: Build the favorites and calendar-additions backend GraphQL API layer

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.1a
- Status: ready-for-dev (AC5 amendment; AC1-AC4 already delivered — see Amendment note in Dev Notes)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `favorites` and `calendar_additions` tables plus mutation/query resolvers that let a client toggle and read per-user favorite/calendar state on events,
so that Stories 2.1, 2.2, 2.6, and 2.7 have a real backend write/read path instead of each quietly inventing its own storage or bypassing the API.

## Acceptance Criteria

1. **Given** Story 0.17's auth context, Story 1.1's `events`/`schedules` tables, and Story 1.3a's events resolver exist, **when** the migration script runs, **then** a `favorites` table (`user_id` FK → `users.id`, `event_id` FK → `events.id`, `created_at`, `updated_at`, `deleted_at` nullable, unique on `(user_id, event_id)`) and a `calendar_additions` table (`user_id` FK → `users.id`, `event_id` FK → `events.id` — denormalized, `schedule_id` FK → `schedules.id` **not** nullable, `created_at`, `updated_at`, `deleted_at` nullable, unique on `(user_id, schedule_id)`) are created. See Dev Notes → Data Type Compatibility for why the unique key is `schedule_id`, not `event_id` as epics.md's shorthand description originally implied.
2. **And** a `toggleFavorite(eventId: ID!): ToggleFavoriteResult!` mutation and a `toggleCalendarAddition(eventId: ID!, scheduleId: ID!): ToggleCalendarAdditionResult!` mutation are exposed, both scoped to `context.user` via `requireAuth` (Story 0.17) — never trusting a client-supplied user ID. Toggling **upserts** the existing `(user_id, event_id)` / `(user_id, schedule_id)` row (clearing/setting `deleted_at`) rather than deleting and re-inserting, per PRD §4.10/§4.11's "re-favoriting clears it rather than inserting a new row" invariant and the tables' hard unique constraints.
3. **And** the events resolver (Story 1.3a) is extended so that:
   - `Query.events`'s DSL fieldMap accepts `isFavorited` / `isAddedToCalendar` conditions with the already-established `"eq"` operator (AD-1's "equals" concept — no new operator string is introduced; see Dev Notes), evaluated as a correlated `EXISTS` check against the caller's `favorites` / `calendar_additions` rows (`deleted_at IS NULL`). Unauthenticated callers get `sql\`false\`` for these conditions (an empty result, not an auth error — see Dev Notes rationale).
   - `Event.isFavorited: Boolean!` and `Event.isAddedToCalendar: Boolean!` are added as computed field resolvers (mirroring the existing `Event.imageUrl` field-resolver pattern) returning `false` for unauthenticated callers and the correlated existence check otherwise. `Event.isAddedToCalendar` is an aggregate ("has **any** schedule of this event been added"), using the denormalized `calendar_additions.event_id`.
   - `Schedule.isAddedToCalendar: Boolean!` is added as its own computed field resolver (per-schedule granularity — see Dev Notes / Gate 2 finding), since a user adds specific schedules, not whole events, to their calendar.
4. **And** no package outside `apps/backend` writes to these tables directly — `apps/web` only mutates favorite/calendar state through these two mutations.
5. **(Added 2026-08-25, `bmad-correct-course`/`bmad-create-story` amendment)** **And** `Event.favoriteCount: Int!` is added as a computed field resolver, following the **exact pattern already used for `Event.isFavorited`** (AC3's `resolvers.ts` field-resolver, line ~2965) — a query against `favorites` scoped with `activeOnly(favorites)` (`packages/graphql-select`), `COUNT` instead of `EXISTS`/row-length-check. Unlike `isFavorited`, `favoriteCount` is a **public aggregate, not scoped to the calling user** — it counts every active favorite from every user, so it does **not** call `requireAuth` and returns the real count for unauthenticated callers too (there is nothing user-specific to hide). It is a display-only field, not a DSL filter condition — no `Query.events` fieldMap entry is added (unlike `isFavorited`/`isAddedToCalendar`, `favoriteCount` is never filtered/sorted on by this story's consumers).

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 2 readiness sweep (`bmad-epic-readiness-check`) — Story 1.3a is query-only with no mutations, and no story anywhere creates the favorites/calendar-additions data AD-2 assumes already exists. Classified as a shared data-ownership gap (consumed by Stories 2.1, 2.2, 2.6, and 2.7, all within Epic 2), positioned immediately before Story 2.1, the first consumer — mirroring the Story 1.3/1.3a split.

**Depends on:** Story 0.8 (`buildOptimizedDrizzleSelect`, scaffold), Story 0.17 (`requireAuth`/`GraphQLContext`), Story 1.1 (`events`/`schedules`/`users` tables), Story 1.3a (events resolver/fieldMap to extend).

## Tasks / Subtasks

- [ ] 1. Add `favorites` and `calendar_additions` tables to `packages/database/schema.ts` (AC1).
  - [ ] `favorites`: `id` (uuid pk), `userId` (uuid, FK `users.id`, `onDelete: 'cascade'`), `eventId` (uuid, FK `events.id`, `onDelete: 'cascade'`), `...timestamps` (createdAt/updatedAt), `deletedAt` (nullable timestamp, mirror `apiKeys.deletedAt`'s pattern — standalone field, not part of `timestamps`).
  - [ ] `calendar_additions`: `id` (uuid pk), `userId` (uuid, FK `users.id`, `onDelete: 'cascade'`), `eventId` (uuid, FK `events.id`, `onDelete: 'cascade'`, denormalized per PRD §4.11), `scheduleId` (uuid, FK `schedules.id`, `onDelete: 'cascade'`, **not nullable**), `...timestamps`, `deletedAt` (nullable).
  - [ ] Composite unique constraints via `drizzle-orm/pg-core`'s `unique()`: `favorites` unique on `(userId, eventId)`; `calendar_additions` unique on `(userId, scheduleId)`.
  - [ ] Partial active-row indexes per AD-8's literal example: `idx_favorites_active` on `favorites(user_id)` WHERE `deleted_at IS NULL`; `idx_calendar_additions_active` on `calendar_additions(user_id, schedule_id)` WHERE `deleted_at IS NULL`. Use Drizzle's `.where(sql\`...\`)` chain on the `index()` builder (already available in the installed `drizzle-orm@^0.30.10` — confirm syntax against installed version's docs before writing).
  - [ ] Add `favoritesRelations`/`calendarAdditionsRelations`, and extend `usersRelations`/`eventsRelations`/`schedulesRelations` with the new `many()`/`one()` back-references.
- [ ] 2. Run `pnpm --filter @festgrid/database generate` to produce the new Drizzle-kit SQL migration file under `packages/database/migrations/`; commit it (AD-3 — code-first schema, committed SQL migrations, no manual DDL).
- [ ] 3. Add `Favorite` and `CalendarEntry` TypeScript interfaces to `packages/shared-types/src/index.ts`, mirroring PRD §4.10/§4.11 exactly (`id`, `userId`, `eventId`, `createdAt`, `deletedAt?` for `Favorite`; add `scheduleId` for `CalendarEntry`) — see Dev Notes → Data Type Compatibility (AC1, AC2).
- [ ] 4. Add a new GraphQL schema file `apps/backend/src/schema/favorites-and-calendar.graphql` declaring the **first-ever** `type Mutation` root for this backend (no base `Mutation` type exists anywhere yet — future mutation-adding stories must `extend type Mutation` against this one) with `toggleFavorite(eventId: ID!): ToggleFavoriteResult!` and `toggleCalendarAddition(eventId: ID!, scheduleId: ID!): ToggleCalendarAdditionResult!`, plus `type ToggleFavoriteResult { eventId: ID! isFavorited: Boolean! }` and `type ToggleCalendarAdditionResult { eventId: ID! scheduleId: ID! isAddedToCalendar: Boolean! }` (AC2).
- [ ] 5. Extend `apps/backend/src/schema/events.graphql`: add `isFavorited: Boolean!` and `isAddedToCalendar: Boolean!` to `type Event`; add `isAddedToCalendar: Boolean!` to `type Schedule` (AC3).
- [ ] 6. Implement the two mutation resolvers in `apps/backend/src/schema/resolvers.ts` (AC2):
  - [ ] `requireAuth(context)` first in both.
  - [ ] `toggleFavorite`: inside a `db.transaction()`, look up the existing `(userId, eventId)` row (including soft-deleted); if active → set `deletedAt = now()`, return `isFavorited: false`; else → insert or clear `deletedAt` on the existing soft-deleted row, return `isFavorited: true`.
  - [ ] `toggleCalendarAddition`: same upsert-toggle pattern keyed on `(userId, scheduleId)`. Derive `eventId` **server-side** from the `schedules` row looked up by `scheduleId` (do not trust the client-supplied `eventId` argument for the stored/denormalized value — see Dev Notes) and throw a `GraphQLError` (`NOT_FOUND`) if the schedule doesn't exist, or if the client-supplied `eventId` doesn't match the schedule's actual parent event (defensive integrity check).
- [ ] 7. Extend `Query.events`'s `fieldMap` (in `resolvers.ts`) with `isFavorited`/`isAddedToCalendar` entries mapping to correlated `EXISTS` SQL fragments scoped to `context.user?.userId` (or `sql\`false\`` when unauthenticated) (AC3).
- [ ] 8. Add `Event.isFavorited`, `Event.isAddedToCalendar`, and `Schedule.isAddedToCalendar` field resolvers in `resolvers.ts`, mirroring the existing `Event.imageUrl`/`Event.sourcePostUrl` field-resolver pattern (query-per-row, consistent with established precedent; return `false` immediately for unauthenticated callers without querying) (AC3).
- [ ] 9. Run `pnpm run codegen` at the repo root so `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` pick up the new SDL (Mutation root, new Event/Schedule fields).
- [ ] 10. Write unit tests for the upsert-toggle logic and the derive-eventId-from-schedule integrity check — if any pure/derivable logic can be isolated without a DB/ORM import, put it in `packages/domain`; otherwise these stay as `apps/backend` integration tests (AC2) — see Dev Notes on why this story adds no new `packages/domain` files.
- [ ] 11. Write integration tests (`apps/backend`, `tsx --test` against a local/test DB, mirroring Story 1.3a's `resolvers.test.ts` pattern) covering: toggle-on/toggle-off/re-toggle idempotency for both mutations, unauthenticated mutation calls rejected (`UNAUTHENTICATED`), `events` query filtering by `isFavorited`/`isAddedToCalendar` (including the unauthenticated-returns-empty case), `Event.isFavorited`/`Event.isAddedToCalendar`/`Schedule.isAddedToCalendar` field resolver correctness, and the calendar-addition schedule/event mismatch integrity check (AC1, AC2, AC3, AC4).
- [ ] 12. Manual verification: run the backend, exercise `toggleFavorite`/`toggleCalendarAddition`/filtered `events` queries via GraphiQL/`curl`; confirm `pnpm build`/`pnpm lint`/`pnpm run codegen` stay clean at the repo root.
- [ ] 13. **(Added 2026-08-25 — AC5 amendment.)** Add `favoriteCount: Int!` to `type Event` in `apps/backend/src/schema/events.graphql`, and add the `Event.favoriteCount` field resolver in `resolvers.ts` — a `db.select({ count: count() }).from(favorites).where(and(eq(favorites.eventId, parent.id), activeOnly(favorites)))` (or equivalent Drizzle `count()`/`sql\`count(*)\`` aggregate), returning the numeric result directly (no auth check, no try/catch-to-false — see AC5). Run `pnpm run codegen` again so both generated GraphQL type files pick up the new field. Add an integration test asserting the count reflects the true number of active (non-soft-deleted) favorites across multiple users, and that toggling a favorite off decrements it correctly (exercising the same upsert/soft-delete path Task 11's existing tests already cover for `isFavorited`).

## Dev Notes

### Amendment (2026-08-25, `bmad-correct-course` / `bmad-create-story`)

- **AC5 (`favoriteCount`) is new** — added per `sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.5, to support the favorite-count badge on `EventCard` (Story 1.3b) and `WeeklyCalendarView` (Story 1.3g). Task 13 above is its only implementation task; AC1-AC4/Tasks 1-12 are unchanged from the original story.
- **Status correction, not new information:** this story file's own header previously read `Status: ready-for-dev` and `## Completion Status` read `- [ ] Not started`, despite `sprint-status.yaml` tracking it as `review`. Direct code verification during this amendment (2026-08-25) confirmed AC1-AC4 are genuinely implemented and correct: `favorites`/`calendar_additions` tables exist in `packages/database/schema.ts` (`export const favorites = pgTable('favorites', ...)` etc.), `toggleFavorite`/`toggleCalendarAddition` mutations exist in `resolvers.ts`, and `Event.isFavorited`/`Event.isAddedToCalendar`/`Schedule.isAddedToCalendar` field resolvers and the `Query.events` fieldMap entries all exist exactly as this story's original ACs specified. This story file's own tracking was simply never updated after implementation — `sprint-status.yaml`'s `review` status was the accurate one. The header above has been corrected to reflect this rather than silently left wrong.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.1a` explicitly listed in `stories_covered`). The sweep found **no new gaps** for Epic 2 — Story 2.1a itself *is* the previously-identified Gate 1 gap-filling story (query-only 1.3a had no mutations), already correctly positioned in `epics.md`/`sprint-status.yaml`. No further prerequisite split needed.
- **Lightweight escape-hatch guard (no subagent, per Epic-Level Sweep Mode):** Re-checked this specific story's scope against the swept report for anything epic-wide sweep didn't anticipate — nothing new. The schema/naming corrections below (schedule-level uniqueness, `packages/shared-types` gap) are data-type-compatibility findings, not architecture/infra-layer gaps, and are handled in this story rather than split out.
- **AC5 amendment Gate note (2026-08-25, lightweight guard only, no subagent — mirrors Story 0.24's AC12 amendment precedent for a small, pattern-matching addition):** `favoriteCount` is a single computed field resolver copying `Event.isFavorited`'s exact existing structure (COUNT instead of EXISTS/existence-check), consumed by two already-existing UI stories (1.3b, 1.3g) rather than introducing any new consumer or architectural surface. No gap found for Gates 1/3 (no backend/infra touch beyond the established field-resolver pattern). No further UI split — this is a pure backend field, no UI scope of its own.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya against `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` and `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md`. **No gap found** — this story ships zero React components/hooks/pages. Two concrete findings folded into the ACs/tasks above instead of a new story:
  1. EXPERIENCE.md's "Soft Delete with Undo" pattern (unfavoriting from a list) is a purely frontend-side deferred-mutation-call timing concern — the backend call fires exactly once, only when the user navigates away and doesn't hit "Undo". A plain idempotent `toggleFavorite` mutation already satisfies this; no "pending"/grace-period state is needed backend-side.
  2. `01.2-event-detail.md` establishes that "Add to Calendar" is a **per-schedule** action (a multi-schedule event shows each schedule independently addable) — this is why `isAddedToCalendar` must be exposed on `Schedule` (per-instance), not only aggregated on `Event`, and both mutations return the resulting boolean directly (not a bare success flag) so a future optimistic-update hook has authoritative state without a refetch.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding — table/column naming and uniqueness key mismatch between `epics.md` and the PRD/Architecture Spine.** `epics.md`'s AC1 shorthand describes `calendar_additions` as unique on `(user_id, event_id)` with a nullable `schedule_id`. This conflicts with two more-authoritative sources: (a) PRD §4.11's `CalendarEntry` interface, which is explicitly "one row per schedule, not per event... unique per `(userId, scheduleId)`", with `eventId` documented as "denormalized from `scheduleId` to support querying all added schedules for this event directly"; and (b) `festgrid-architecture-spine.md`'s AD-8 itself, whose own illustrative SQL is `CREATE INDEX idx_calendar_entry_active ON calendar_entry (user_id, schedule_id) WHERE deleted_at IS NULL;` — i.e., the architecture's own author already modeled the lookup key as `schedule_id`. Per `project-context.md`'s "the PRD's TypeScript interfaces are the single source of truth for data structures" rule, this story implements the schema per the PRD/AD-8 model (unique on `(userId, scheduleId)`, `scheduleId` NOT NULL, `eventId` denormalized) rather than `epics.md`'s shorthand. Table names stay plural/snake_case (`favorites`, `calendar_additions`) matching this codebase's established `schema.ts` convention (`users`, `user_locations`, `api_keys`, `posts`) — AD-8's singular `favorite`/`calendar_entry` naming in its illustrative SQL is not a naming mandate, just an example.
- **Impacted fields/contracts:** `packages/database/schema.ts` (new tables), the generated migration SQL, `packages/shared-types` (missing interfaces — see below), and the `toggleCalendarAddition` mutation's argument contract (`eventId` becomes a defensive/validation-only argument, not the source of truth for the stored `event_id` — the resolver derives it server-side from the `schedules` row).
- **Required DB migration changes:** New `favorites`/`calendar_additions` tables per Task 1, generated via `drizzle-kit generate` (Task 2) — no changes to existing tables required.
- **Required TypeScript type changes:** Add `Favorite` and `CalendarEntry` interfaces to `packages/shared-types/src/index.ts` (Task 3) — the PRD documents these entities (§4.10, §4.11) but they were never added to `shared-types`, unlike every other PRD entity (`EventInfo`, `Schedule`, `SocialMediaAccountProfile`, `UserLocationPreference`, `Post`). This is a pre-existing gap this story closes, not a regression it introduces.
- **AD-1 operator naming clarification (not a mismatch, but a common LLM trap):** AD-1's prose describes the string operator as `"equals"`/`"notEquals"`, but Story 1.3a's actual implemented `TerminalOperator` union (`packages/domain/src/query/queryDsl.ts`) is `"eq" | "ne" | "contains" | "in" | "notIn"`. This story must reuse the already-established `"eq"` string — do **not** add a new `"equals"` operator alias; that would fork the DSL's operator vocabulary.
- **Backward compatibility and rollout notes:** Purely additive — two new tables, two new mutations, three new nullable-free `Boolean!` fields on existing GraphQL types (defaulted via resolvers, no client break). No existing resolver behavior changes for callers that don't request the new fields.
- **Verification checks:** Integration tests asserting the unique-constraint/upsert-toggle behavior survives multiple toggle cycles without constraint violations (Task 11); a type-check (`pnpm build`) proving `packages/shared-types`' new interfaces and the codegen'd GraphQL types agree on field names/nullability.

### Package boundaries (why no `packages/domain` changes)

Per `project-context.md`'s Code Organization rule, `packages/domain` must stay dependency-free of DB/ORM/Node-only modules. The upsert-toggle logic (transactional read-then-write against Drizzle) and the schedule→event derivation are inherently DB-coupled, so they live in `apps/backend` (mirroring where Story 1.3a put `buildDrizzleWhere` after its own post-review correction, in `packages/graphql-select`, not `packages/domain`). If a genuinely pure sub-piece emerges during implementation (e.g. a standalone "decide toggle outcome from current state" pure function), it may go in `packages/domain/src/query/` or a new `packages/domain/src/favorites/` — but do not force DB-touching code there just to satisfy this note.

### Architecture / technical constraints

- **AD-2 (Unified Event Querying):** `isFavorited`/`isAddedToCalendar` must be expressed as DSL conditions on the existing `events` query, never a new `/api/favorites`-style endpoint. Story 2.2 (Favorites page) and Story 2.6 (My Calendar) are expected to call `events` with `{ field: "isFavorited", operator: "eq", value: true }` / `{ field: "isAddedToCalendar", operator: "eq", value: true }`.
- **AD-7 (Authenticated Context):** Both mutations call `requireAuth(context)` first; never accept a client-supplied user ID. The DSL filter conditions and the `Event`/`Schedule` computed fields degrade gracefully to `false`/empty for unauthenticated callers rather than throwing — these are read-path collection filters on an otherwise-public `events` query, not protected mutations, so AD-7's "never trust a client-supplied user ID" is satisfied by *not using* any client-supplied ID (there is none in these paths) rather than by gating the whole query behind auth.
- **AD-8 (Soft-Delete Convention):** Both new tables use `deletedAt`, toggled via upsert (never a hard delete/re-insert), with the partial active-row indexes specified in Task 1.
- **Optimized DB Queries:** The new computed boolean fields are implemented as GraphQL field resolvers (one query per parent row), consistent with the existing `Event.imageUrl`/`Event.sourcePostUrl` precedent in `resolvers.ts` — not routed through `buildOptimizedDrizzleSelect` (which only maps flat scalar columns on a target table and would silently skip these non-column computed fields, per Story 1.3a's own Dev Notes). This is a known N+1-per-row characteristic already present in the codebase for `imageUrl`; this story follows the established pattern rather than introducing a new optimization strategy unprompted.
- **Package boundaries (AC4):** All new tables/queries/mutations live in `apps/backend` + `packages/database`. `apps/web` gains no new database/domain imports in this story (no frontend UI work at all — see Out of Scope).
- **GraphQL abuse prevention:** Already configured server-wide by Story 0.8 (`graphql-armor`, `maxDepth: 10`); this story adds no new nesting depth beyond existing precedent.

### Previous Story Intelligence (Story 1.3a)

- `Query.events`'s `fieldMap` (in `resolvers.ts`) is built fresh per-request already (not module-level), so adding request-scoped (`context.user`-dependent) entries for `isFavorited`/`isAddedToCalendar` is a natural, low-risk extension of the existing pattern — no refactor of the resolver's control flow needed.
- `buildDrizzleWhere`'s `FieldColumnMap` type is already `Record<string, PgColumn | any>` (deliberately loose) and its `contains`/`in` cases already fall back to raw `sql\`...\`` fragments for array columns — the correlated `EXISTS` subquery fragments this story needs follow that exact precedent, not a new capability.
- Story 1.3a's own post-review correction (moving DB-coupled logic out of `packages/domain` into `packages/graphql-select`) is the direct precedent for this story's "no `packages/domain` changes" decision above — don't repeat that mistake by defaulting DB-touching code into `packages/domain` just because it's "business logic."
- Story 1.3a's `Completion Status` is `review` (not yet `done`) per `sprint-status.yaml` — its resolver/schema files exist and are stable enough to extend, but if its own review surfaces resolver-shape changes before this story starts, re-check `resolvers.ts`/`events.graphql` against this story's plan.

### Sibling story note — Story 2.1 was drafted out of order

`_bmad-output/implementation-artifacts/2-1-favorite-an-event.md` already exists and is marked `ready-for-dev` in `sprint-status.yaml`, even though it depends on this story's backend layer and was generated before this story existed (its Dev Agent Record shows a different tool/model, and it has none of this workflow's Gate/Data-Type-Compatibility sections). It does not reference `2-1a` at all. Recommend re-running `bmad-create-story 2-1` (or at minimum reviewing it) once this story is `done`, so it picks up the real mutation contract (`toggleFavorite(eventId): ToggleFavoriteResult!`) instead of an unspecified "GraphQL mutation contract." Not this story's job to fix — flagged here for the user's awareness.

### Git Intelligence Summary

Recent commits (`6148b78`, `f612609`, `59f5c15`, `2a45f2c`, `bcdbb86`) are all frontend/auth/docs work (Google OAuth config, BlockingLoader artifact, parallel route modal layout, event metadata localization) — no new backend/resolver commits since Story 1.3a's work. `apps/backend/src/schema/resolvers.ts`/`events.graphql` remain the correct, current reference implementation to extend.

### Latest Tech Information

- `drizzle-orm@^0.30.10` (installed) supports partial indexes via `.where(sql\`...\`)` chained on the `index()`/`uniqueIndex()` builder — verify the exact chain syntax against the installed version when writing Task 1, since Drizzle's partial-index API has shifted across minor versions.
- No new npm dependencies are anticipated — `drizzle-orm`, `graphql-scalars`/`graphql-yoga`, and `@festgrid/graphql-select`/`@festgrid/database` are already wired into `apps/backend` by Story 1.3a.

## Global Rules References

- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-3, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.1a, Story 1.3a, Story 0.17)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` (§4.10 Favorite, §4.11 CalendarEntry)
- `docs/infrastructure/2-backend.md`

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `packages/database/schema.ts` (new `favorites`/`calendar_additions` tables, relations, indexes).
  - New: `packages/database/migrations/000X_*.sql` (drizzle-kit generated).
  - Modified: `packages/shared-types/src/index.ts` (add `Favorite`, `CalendarEntry` interfaces).
  - New: `apps/backend/src/schema/favorites-and-calendar.graphql` (base `Mutation` root, `toggleFavorite`/`toggleCalendarAddition`, result types).
  - Modified: `apps/backend/src/schema/events.graphql` (add `isFavorited`/`isAddedToCalendar` to `Event`, `isAddedToCalendar` to `Schedule`).
  - Modified: `apps/backend/src/schema/resolvers.ts` (add `Mutation` resolvers, extend `events` fieldMap, add `Event`/`Schedule` computed-field resolvers).
  - New: `apps/backend/src/schema/favorites-and-calendar.test.ts` (integration tests, `tsx --test`, mirroring `resolvers.test.ts`).
  - Regenerated (not hand-edited): `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (via `pnpm run codegen`).
  - **Not modified:** any `apps/web` UI code (no frontend work — AC4), `packages/domain` (see Package Boundaries note).
- **Rule Mapping:**
  - *AD-2/AD-1* → `isFavorited`/`isAddedToCalendar` added as DSL conditions on the existing `events` query, not a new endpoint (Task 7).
  - *AD-7* → both mutations call `requireAuth` first; no client-supplied user ID trusted anywhere (Task 6).
  - *AD-8* → `deletedAt` + partial active-row indexes on both new tables, upsert-toggle (never hard delete/re-insert) (Task 1, 6).
  - *AD-3* → schema changes ship as committed `drizzle-kit generate` SQL (Task 2).
  - *Data Schemas single source of truth* → `packages/shared-types` gains `Favorite`/`CalendarEntry` mirroring PRD §4.10/§4.11 (Task 3).
  - *Code Organization (Domain vs UI)* → no DB-coupled logic added to `packages/domain` (Package Boundaries note).
- **Verification Plan:**
  - Integration tests (`apps/backend`, `tsx --test` against a local test DB): toggle idempotency/upsert-not-duplicate behavior for both mutations, unauthenticated rejection, `events` DSL filtering by `isFavorited`/`isAddedToCalendar` (authenticated and unauthenticated), computed-field correctness on `Event`/`Schedule`, schedule/event-mismatch integrity check on `toggleCalendarAddition`.
  - Manual: GraphiQL/`curl` against the running local server; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root; confirm `apps/web/src/generated/graphql.ts` contains the new `Mutation`/`Event`/`Schedule` types after codegen.

## Pre-Coding Approval Gate

- [x] Scope confirmed: backend-only (`packages/database`, `packages/shared-types`, `apps/backend`) — no frontend changes (Story 2.1/2.2/2.6 consume this later).
- [x] Architecture confirmed: follows AD-1, AD-2, AD-3, AD-7, AD-8 as scoped above.
- [x] **Schema correction accepted:** `calendar_additions` is implemented unique on `(user_id, schedule_id)` with non-nullable `schedule_id` (per PRD §4.11 and AD-8's own SQL example), overriding `epics.md`'s shorthand `(user_id, event_id)` description. Confirm this correction is acceptable, or direct that `epics.md` be updated to match instead.
- [x] **`packages/shared-types` gap accepted:** This story adds the previously-missing `Favorite`/`CalendarEntry` interfaces (PRD §4.10/§4.11) as part of its own scope rather than splitting a separate story, since it's a small, directly-related addition. Confirm acceptable.
- [x] Testing plan confirmed: integration tests via `tsx --test` (continuing Story 1.3a's interim convention — Story 0.10's Vitest/`@festgrid/testing-config` foundation is `review`, not `done`, per `sprint-status.yaml`). Confirm this is acceptable, or direct migration to Vitest now instead.
- [x] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (no new gap — this story *is* the identified gap-fill); Gate 2 run fresh (no gap; per-schedule `isAddedToCalendar` granularity and mutation return-shape findings folded into ACs/tasks above).
- [x] **Sibling-story awareness accepted:** Story 2.1 (`2-1-favorite-an-event.md`) already exists as `ready-for-dev` but was drafted without knowledge of this story's actual mutation contract. Confirm proceeding with 2.1a now, planning to re-run/review Story 2.1 afterward — or direct that Story 2.1 be reconciled first.
- [x] Explicit human approval state (Default: approved)

## Testing Requirements

- Integration tests (`apps/backend`, `tsx --test` against a local/test database) covering both mutations' toggle/upsert behavior (including repeated toggle cycles hitting the unique constraint path), auth rejection, and the `events` resolver's new filter conditions plus the three new computed fields.
- No new `packages/domain` unit-test surface is expected (see Package Boundaries note) — if a pure helper is extracted there during implementation, it must reach 100% coverage per `project-context.md`.
- Manual verification that GraphQL abuse protection (`graphql-armor`) is unaffected by the new `Mutation` root.

## Deliverables Checklist

- [ ] `favorites`/`calendar_additions` tables added to `packages/database/schema.ts` with relations, unique constraints, and AD-8 partial indexes; migration generated and committed.
- [ ] `Favorite`/`CalendarEntry` interfaces added to `packages/shared-types`.
- [ ] `type Mutation` root declared for the first time, with `toggleFavorite`/`toggleCalendarAddition` implemented, transactional, and auth-scoped.
- [ ] `Event.isFavorited`, `Event.isAddedToCalendar`, `Schedule.isAddedToCalendar` computed field resolvers implemented.
- [ ] `Query.events`'s DSL fieldMap accepts `isFavorited`/`isAddedToCalendar` conditions.
- [ ] `Event.favoriteCount: Int!` computed field resolver implemented (AC5, Task 13 — new 2026-08-25).
- [ ] Integration tests written and passing; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope

- Any frontend UI development, including the actual Favorite/Unfavorite button and Add-to-Calendar controls (Stories 2.1, 2.2, 2.6).
- The Favorites listing page and My Calendar page themselves (Stories 2.2, 2.6).
- Auto-hiding past events (Story 2.7) — this story only makes the calendar-additions data available to query against.
- Geo-distance/"nearby" filtering (Story `2-5a`) and saved-locations API (Story `2-3a`) — unrelated backend layers tracked separately.
- Reconciling Story 2.1's existing (out-of-order) story file with this story's real mutation contract — flagged in Dev Notes for the user, not fixed here.

## Definition of Done

- [x] AC1-AC4 satisfied (verified 2026-08-25 via direct code inspection — already implemented).
- [ ] AC5 satisfied (`favoriteCount`, new 2026-08-25).
- [ ] Required tests passing (`apps/backend` integration tests for both mutations, the extended `events` resolver, and the new `favoriteCount` test).
- [ ] Lint and type checks passing for `apps/backend`, `packages/database`, `packages/shared-types`, and any touched packages.

## Completion Status

review (AC1-AC4) / ready-for-dev (AC5 amendment)

**2026-08-25:** AC1-AC4 confirmed already implemented via direct code inspection (see Amendment note in Dev Notes) — this file's own tracking was simply stale. AC5 (`favoriteCount`) is new, unimplemented, ready for dev.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
