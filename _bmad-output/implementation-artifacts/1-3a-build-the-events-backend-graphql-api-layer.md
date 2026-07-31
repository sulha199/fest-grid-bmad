# Story 1.3a: Build the events backend GraphQL API layer

## Story Details
- **Epic:** 1
- **Story ID:** 1.3a
- **Story Key:** 1-3a-build-the-events-backend-graphql-api-layer
- **Status:** ready-for-dev

## Story
**As a** developer,
**I want** a backend GraphQL API layer that resolves event queries using the Unified Query DSL (AD-1/AD-2) against the database,
**So that** every event discovery feature (list, search, filter, details, and later favorites/calendar/feed views) retrieves data through one consistent, secure API instead of the frontend accessing the database directly.

## Acceptance Criteria
- **AC1:** **Given** the GraphQL server scaffold, Code Generator pipeline, and `buildOptimizedDrizzleSelect` utility exist (Story 0.8), and the initial database tables and mock data exist (Stories 1.1, 1.2), **When** a client sends a Unified Query DSL request (AD-1) to the backend GraphQL API's `events` query, **Then** the backend resolves it against the database via Drizzle, using `buildOptimizedDrizzleSelect` to fetch only the requested top-level `Event` fields, and returns matching events with pagination support (offset/limit, matching the "infinite scroll, no traditional pagination controls" UI invariant in `project-context.md`).
  - Default sort order (no explicit sort in the DSL request) is by the event's main schedule's `eventStartDate`/`eventStartTime` ascending (soonest upcoming first) — confirmed against `design-artifacts/UX-festgrid-run-1` (`01.1-event-discovery.md`: default view is "upcoming events", nearest first).
  - `buildOptimizedDrizzleSelect` only maps flat/scalar fields on the table it is called against (it silently skips fields with no matching column) — it does **not** traverse the `schedules` relation. `Event.schedules` must be resolved by a dedicated field resolver querying `schedules` (filtered by `eventId`), calling `buildOptimizedDrizzleSelect(schedules, info)` against that field's own `GraphQLResolveInfo`.
- **AC2:** The API supports filtering by name/performer/location (`contains`), type/category (`in`), and combining conditions with `and`/`or`, per AD-1.
  - `contains` is case-insensitive substring matching (Drizzle `ilike`), applied to `events.eventName`, `schedules.performers` (array), and `events.location`/`schedules.location`.
  - Story 1.4 ("Search for events") is expected to express a single free-text search term as an `or` group of `contains` conditions across `eventName`/`performers`/`location` — this story's DSL-to-Drizzle mapper must support that shape (multiple terminal conditions combined with `or` at any nesting depth), not just top-level `and`.
  - `locationPreferenceId` (mentioned as an example ID field in AD-1) has no corresponding column on `events`/`schedules` and is **out of scope** for this story (see Out of Scope) — do not attempt to implement it here.
- **AC3:** The API supports fetching a single event by ID for the detail view, returning the event's full field set plus **all** of its schedules (not just the main one) — the detail view (Story 1.6) needs performers, ticket price, type/category tags, and `locationDetails` (for a map link) per `design-artifacts/UX-festgrid-run-1`.
- **AC4:** No package outside `apps/backend` imports the database/domain layer directly — `apps/web` only talks to events data through this API (e.g. via generated `graphql-request` types from Story 0.8).
- **AC5:** The API supports filtering events by `sourceSocialMediaAccountId` (`in`), scoped to the current authenticated user's subscriptions (Story 0.17), so Epic 3's Feed (Story 3.7) can retrieve only events extracted from the user's subscribed accounts by reusing this resolver rather than a separate one.
  - **Sequencing note:** Story 0.17 (GraphQL authenticated-context layer) is still `backlog` as of this story. See Dev Notes "Architecture & UX Gate Findings" and the Pre-Coding Approval Gate for how AC5 is scoped given that dependency is not yet built.
- **AC6 (added 2026-08-01, surfaced while creating Story 1.3b):** The returned `Event` GraphQL type exposes a runtime-computed `imageUrl: String` field, resolved by joining `posts` through the `events.postId` FK (Story 1.2a) — not a stored field on `EventInfo`/`events` itself, mirroring how `isFavorited`/`isAddedToCalendar` are already runtime-computed rather than stored. Consumed directly by Story 1.3b's `EventCard` once Story 1.3 wires real data in.

**Note (from epics.md):** Story 4.4a (Epic 4) will later extend this resolver to exclude `status='soft_deleted'` events by default (with a moderator-scoped override, backing Story 4.7's moderation view). Not an AC here — Story 1.1 does not create a `status` column and Story 4.4a owns that filter entirely.

**Depends on:** Story 0.8 (hard dependency — scaffold/codegen/`buildOptimizedDrizzleSelect`). Story 0.17 (soft dependency for AC5's ownership-scoping only — see Pre-Coding Approval Gate). Story 1.2a (hard dependency for AC6's `postId`/`imageUrl` join).

## Tasks / Subtasks
- [ ] 1. Scaffold `packages/domain` as a real workspace package (AC1, AC2, AC4). It does not exist on disk yet (confirmed: only `node_modules/.bin` present, no `package.json`) — Story 0.10's Dev Notes explicitly anticipated this ("packages/domain does not yet exist... established generically so it adopts it with zero extra setup once scaffolded by its owning story").
  - [ ] Create `packages/domain/package.json` (name `@festgrid/domain`), `tsconfig.json` (extends `@festgrid/typescript-config/base.json`, `NodeNext`), `eslint.config.mjs` — mirror `packages/database`'s shape (Node-run package, not React).
  - [ ] Organize source under `packages/domain/src/events/` per `project-context.md`'s "organized into sub-folders by domain area" rule. **No React/frontend imports allowed in this package.**
- [ ] 2. Implement the Unified Query DSL → Drizzle `where`-clause mapper in `packages/domain/src/events/queryDsl.ts` (AC1, AC2, AC5). Pure function(s), no I/O: takes the parsed DSL object + a field→Drizzle-column map, recursively builds a Drizzle `SQL` condition using `and()`/`or()`/`ilike()`/`inArray()`/`notInArray()`/`eq()`/`ne()` per AD-1's operator set. Must correctly recurse through nested `{operator, conditions}` groups at arbitrary depth (AC2).
- [ ] 3. Add `apps/backend`'s workspace dependencies on `@festgrid/database` and `@festgrid/graphql-select` (AC1). Story 0.8 deliberately did **not** add these — its own Dev Notes flagged this story as the first real consumer ("Do not add `@festgrid/database` or `@festgrid/graphql-select` yet... Story 1.3a adds both workspace dependencies when its resolver actually calls `buildOptimizedDrizzleSelect`").
- [ ] 4. Create a Drizzle client for `apps/backend` (AC1). `@festgrid/database`'s `index.ts` only re-exports `schema.js` (no ready-made client/connection export) — create `apps/backend/src/db/client.ts` that loads `DATABASE_URL` from the root `.env` (mirroring `apps/backend/src/env.ts`'s existing root-env-loading pattern, do not import `packages/database`'s internal `env.ts`/`loadDatabaseEnv` since it is not part of that package's public `exports` map) and instantiates `drizzle(postgres(connectionString), { schema })` using the imported `@festgrid/database` schema objects.
- [ ] 5. Extend the GraphQL SDL (AC1, AC2, AC3, AC5). Add a new `apps/backend/src/schema/events.graphql` (the existing `apps/backend/codegen.ts`/`apps/web/codegen.ts` glob is already `src/schema/**/*.graphql`, so a new file is picked up automatically with no codegen config changes):
  - [ ] `EventType`/`EventCategory` GraphQL enums matching `packages/shared-types`' `EventType`/`EventCategory` enum values exactly (already 1:1 with `packages/database/schema.ts`'s `eventTypeEnum`/`eventCategoryEnum`).
  - [ ] `Event`, `Schedule`, `LocationDetails` object types matching `packages/shared-types`' `EventInfo`/`Schedule`/`LocationDetails` interfaces for the fields sourced from the DB (do **not** include `isFavorited`/`isAddedToCalendar`/`isEvent` — these are not DB columns and are out of scope here, see Out of Scope).
  - [ ] A recursive Unified Query DSL input type (e.g. `EventQueryConditionInput`) per AD-1's `{operator, conditions}` / terminal `{field, operator, value}` shape. GraphQL has no native "any of string/string[]/boolean" scalar — use a `JSON` custom scalar (e.g. `graphql-scalars`'s `GraphQLJSON`, see Latest Tech Information) for the terminal `value` field rather than inventing multiple typed value fields.
  - [ ] `Query.events(query: EventQueryConditionInput, limit: Int, offset: Int): EventConnection!` (or equivalent offset-paginated shape exposing `items`/`hasMore` or `totalCount`) and `Query.event(id: ID!): Event`.
- [ ] 6. Implement the resolvers in `apps/backend/src/schema/resolvers.ts` (AC1, AC2, AC3, AC5):
  - [ ] `Query.events`: parse the `query` DSL input, call `packages/domain`'s mapper to build the Drizzle `where` clause, apply `buildOptimizedDrizzleSelect(events, info)` for requested `Event` scalar fields, join `schedules` (filtered `isMainSchedule = true`) for the default sort key, apply `limit`/`offset`.
  - [ ] `Query.event`: fetch by `id`, include a nested `Event.schedules` field resolver returning **all** schedules for that event (AC3).
  - [ ] `Event.schedules` field resolver: query `schedules` by `eventId`, apply `buildOptimizedDrizzleSelect(schedules, info)` against the field's own `info`.
  - [ ] AC5's `sourceSocialMediaAccountId` filter: implement the DSL field/operator support now; see Pre-Coding Approval Gate for how ownership-scoping is handled given Story 0.17 is not done.
- [ ] 7. Ensure package/dependency isolation (AC4): `apps/web` gains no new database/domain imports in this story; only `apps/backend` depends on `@festgrid/database`/`@festgrid/graphql-select`/`@festgrid/domain`.
- [ ] 8. Write unit tests for the DSL-to-Drizzle mapping logic in `packages/domain` (AC2, AC5) — **100% coverage required** (`project-context.md`, non-negotiable). See Dev Notes/Pre-Coding Approval Gate for the interim `node:test`/`tsx --test` strategy (Story 0.10's Vitest foundation is not done yet).
- [ ] 9. Write integration tests for the resolvers in `apps/backend` against a real/local test database (AC1, AC2, AC3), proving `events`/`event` return correctly-shaped, correctly-filtered, correctly-paginated results.
- [ ] 10. Manual verification: run the backend, execute representative `events`/`event` queries (including a nested `and`/`or` DSL query and a single-event query) via GraphiQL/`curl`, confirm `pnpm build`/`pnpm lint`/`pnpm run codegen` stay clean and `apps/web/src/generated/graphql.ts` picks up the new `Event`/`Schedule` types.

## Dev Notes

### Architecture & UX Gate Findings
- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true`, `1.3a` explicitly listed in `stories_covered`). The sweep's one finding — no GraphQL authenticated-context layer — was already split into Story 0.17 and is exactly what AC5 depends on; it is not a new gap. The sweep also confirms "1.1–1.6/1.3b/1.6a/1.8 all route data access through 1.3a's GraphQL API with no frontend→DB bypass" — i.e. this story is the thing other Epic 1 stories are already assumed to depend on.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya against `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`. **No gap found** — this story ships zero React components/hooks/pages. However, the review surfaced query-capability details the resolver must not silently omit (folded into AC1/AC2/AC3 above and the notes below):
  - Proximity/"nearby" filtering and sorting (`01.1-event-discovery.md`'s default-view fallback logic) is **not** covered by this story's DSL/AC set — it requires geo-distance query support, which is Epic 2's Story `2-5a-extend-the-events-graphql-api-with-geo-distance-query-support` (already tracked in `sprint-status.yaml`, `backlog`). Explicitly out of scope here (see Out of Scope) — do not attempt to bolt on distance filtering.
  - Free-text search must map to an `or`-across-fields DSL shape (AC2), default sort is soonest-upcoming-first (AC1), and the detail view needs full schedule + location/category/performer/ticket-price data (AC3).
- **Lightweight escape-hatch guard (no subagent):** Re-checked this story's specific scope against the swept report for anything the epic-wide sweep didn't anticipate. Nothing new: the `packages/domain` scaffold gap was already anticipated by Story 0.10's Dev Notes, and the AC5/Story 0.17 sequencing was already anticipated and tracked by the epic-1 sweep itself. No new prerequisite story is warranted.

### AC5 / Story 0.17 sequencing (why this isn't a new Gate 1 split)
Story 0.17 already exists as its own tracked prerequisite story (created by the epic-1 readiness sweep) — per `story-split-gate.md`'s protocol, a gap only gets a *new* prerequisite story when none already exists. Since 0.17 is `backlog` (not started) at the time this story is drafted, true request-scoped ownership enforcement ("only the caller's own subscriptions") cannot be implemented yet: AD-7 explicitly forbids trusting a client-supplied user ID for authorization decisions, and no resolver context/`context.user` exists until Story 0.17 wires it (confirmed directly in `apps/backend/src/server.ts` — `createYoga({ schema, plugins })` has no `context:` factory today). This is handled as an explicit Pre-Coding Approval Gate sign-off item (mirroring the precedent Stories 0.7/0.8 used for their own forward-dependencies), not a new split story.

### Data Type Compatibility & Migration Requirements
- **DB schema change required for AC6 only:** `events.postId` (nullable FK to `posts.id`) and the `posts` table itself are created by Story 1.2a, not this story. AC6's `imageUrl` field resolver joins `posts` through that FK — this story does not run its own migration for it, it only consumes the column/table Story 1.2a provides.
- Beyond AC6, **no further DB schema changes required** — Stories 1.1/1.2 already created and seeded `events`/`schedules` with every other column this story's `Event`/`Schedule` GraphQL types need.
- `EventType`/`EventCategory`: `packages/database/schema.ts`'s `eventTypeEnum`/`eventCategoryEnum` values are already 1:1 with `packages/shared-types`' `EventType`/`EventCategory` TS enums — safe to mirror directly as GraphQL enums.
- `events.types`/`events.categories` are stored as `text[]` (not a true Postgres enum array — see the schema comment: "Drizzle doesn't perfectly support enum arrays"). Nothing at the DB layer stops an invalid string from landing in that array; this story's resolvers only need to *read* already-seeded valid data, so no cast/validation logic is required here, but do not assume the DB enforces enum membership — that is a future ingestion-story concern (Story 0.11 Zod/AJV territory), not this one.
- `schedules.locationDetails` is a nullable `jsonb` column; map it to the `LocationDetails` GraphQL/shared-types shape (`coordinates`, `placeName?`, `placeId?`, `formattedAddress?`, `timezone?`) and mark the corresponding GraphQL fields nullable — do not assume every schedule has structured location data.
- `EventInfo`'s `isFavorited`/`isAddedToCalendar`/`isEvent` fields in `packages/shared-types` have **no** backing columns and must **not** be added to this story's GraphQL `Event` type (`isFavorited`/`isAddedToCalendar` are Epic 2's Story `2-1a`/`2-2` concern per AD-2; `isEvent` is an AI-extraction-pipeline concept from Epic 3, irrelevant to seeded mock data).
- No changes required to `@festgrid/shared-types` itself — this story only adds generated GraphQL/codegen types, not hand-authored interface edits.

### Testing foundation sequencing (mirrors Story 0.8's Story 0.9 precedent)
Story 0.10 ("Set up testing frameworks foundation — Vitest/MSW/Playwright, `@festgrid/testing-config`") is still `ready-for-dev`, not done. `project-context.md`'s "100% unit test coverage for `packages/domain`" rule is non-negotiable regardless. Following the precedent Story 0.8 set for `packages/graphql-select` (which needed tests before Story 0.10 existed), this story's `packages/domain` unit tests use Node's built-in `node:test` runner via `tsx --test` (the same interim pattern already proven in `packages/database/seed.integration.test.ts` and `packages/graphql-select/optimized-select.test.ts`), **not** Vitest — migrate to `@festgrid/testing-config`'s Vitest preset once Story 0.10 lands, this is not this story's job to do preemptively.

### Architecture / technical constraints
- **API Style:** Must use GraphQL (`project-context.md`).
- **Unified Query DSL (AD-1):** Recursive `{"operator": "and"|"or", "conditions": [...]}` where each condition is either a nested group or a terminal `{field, operator, value}`. The Drizzle query builder must correctly recurse at arbitrary depth.
- **AD-2 (Unified Event Querying):** This is *the* endpoint every future event-collection view (favorites, calendar, feed) will add conditions to, not a new endpoint per collection — AC5's `sourceSocialMediaAccountId` support exists specifically so Story 3.7 does not need its own resolver.
- **Optimized DB Queries:** Every top-level scalar field selection must go through `buildOptimizedDrizzleSelect` — do not hand-roll a `select({...})` that fetches every column regardless of the GraphQL selection set.
- **Package boundaries:** Pure DSL-to-Drizzle mapping logic lives in `packages/domain` (zero React/framework dependencies — this package may be imported by Lambda/Node backends later). Resolvers, schema, and the Drizzle client wiring live in `apps/backend`. No frontend code touches the DB/domain layer (AC4).
- **GraphQL abuse prevention:** Already configured server-wide by Story 0.8 (`graphql-armor`, `maxDepth: 10`); the `Event.schedules` field resolver adds one level of nesting, well within that limit — no changes needed to the armor config.

### Previous Story Intelligence (Story 1.2)
- Story 1.2's seed script and integration test used a deterministic transactional pattern and `tsx --test` via a `test:seed` script — same `node:test` precedent this story reuses for `packages/domain` and `apps/backend`'s integration tests.
- Story 1.2's code review hardened destructive-operation guards and added explicit AC-mapped assertions rather than vague "it works" tests — apply the same rigor to the DSL-to-Drizzle unit tests (explicit assertions per operator/nesting case, not just a smoke test).

### Git Intelligence Summary
- Recent commits are all `bmad-*` planning-process changes (epic readiness sweeps, story artifacts); no application-code commit pattern exists yet for `apps/backend`'s resolver layer to mirror. Follow `festgrid-architecture-spine.md` (AD-1, AD-2, AD-7) and the Dev Notes here instead. The working tree currently has Story 0.8's scaffold in progress (`apps/backend/`, `packages/graphql-select/`, `apps/web/codegen.ts`, `apps/web/src/generated/`) but not yet committed — confirm Story 0.8 is `done` (or its scaffold is otherwise stable) before starting this story's resolver work, since AC1 hard-depends on it.

### Latest Tech Information
- `graphql-scalars` (or a minimal custom `GraphQLScalarType`) is the standard way to add a `JSON` scalar to a `graphql-yoga`/`graphql-tools`-based schema for the DSL's untyped `value` field — avoid hand-rolling scalar serialize/parseValue/parseLiteral logic if `graphql-scalars` is available.
- `drizzle-orm`'s `and`/`or`/`ilike`/`inArray`/`notInArray`/`eq`/`ne` operators (already a dependency via `drizzle-orm: ^0.30.10` in `packages/database`) are sufficient to implement AD-1's full operator set — no additional query-builder library needed.

## Global Rules References
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-7)
- `_bmad-output/planning-artifacts/epics.md` (Story 1.3a, Story 0.8, Story 0.17)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/2-backend.md` (confirms real AWS/API Gateway/Lambda deployment is Story 0.14's scope, not this story's local-dev-runnable server)

## Implementation Plan (Rule-Compliant)
- **File Change Plan:**
  - New `packages/domain` package: `package.json` (`@festgrid/domain`), `tsconfig.json`, `eslint.config.mjs`, `src/events/queryDsl.ts`, `src/events/queryDsl.test.ts`, `index.ts` (barrel export).
  - New: `apps/backend/src/schema/events.graphql` (Event/Schedule/enum/DSL input types + `Query.events`/`Query.event`).
  - New: `apps/backend/src/db/client.ts` (Drizzle client wiring `@festgrid/database`'s schema against `DATABASE_URL`).
  - Modified: `apps/backend/src/schema/resolvers.ts` (add `events`/`event` resolvers + `Event.schedules` field resolver), `apps/backend/package.json` (add `@festgrid/database`, `@festgrid/graphql-select`, `@festgrid/domain`, a `JSON` scalar library, and a `test` script).
  - New: `apps/backend/src/schema/*.test.ts` or `apps/backend/test/*.test.ts` (integration tests, `tsx --test`).
  - **Not modified:** `apps/web` (no new frontend code — AC4), `packages/database` (schema untouched, per Story 1.1/1.2), `apps/backend/src/server.ts` (armor config already sufficient).
- **Rule Mapping:**
  - *API Style (GraphQL)* → new `events.graphql` SDL + resolvers.
  - *Optimized DB Queries* → `buildOptimizedDrizzleSelect` used in every resolver that selects scalar fields (Task 6).
  - *Code Organization (Domain vs UI)* → DSL-to-Drizzle mapping isolated in `packages/domain`, zero React imports (Task 1, 2).
  - *AD-1/AD-2* → recursive DSL input type + single `events`/`event` endpoint serving all future collection views (Task 5, 6).
  - *AD-7 (Authenticated Context)* → AC5's ownership-scoping explicitly deferred to Story 0.17 rather than faked with a client-supplied ID (Pre-Coding Approval Gate).
  - *Package dependency honesty (Story 0.8 precedent)* → `@festgrid/database`/`@festgrid/graphql-select` added to `apps/backend` only now, when actually imported (Task 3).
- **Verification Plan:**
  - Unit tests (`packages/domain`, `tsx --test`): DSL-to-Drizzle mapping, 100% coverage, covering every AD-1 operator and nested `and`/`or` combinations.
  - Integration tests (`apps/backend`, `tsx --test` against a local test DB): `events` filtering/pagination/default-sort correctness, `event` single-fetch with full schedules, `sourceSocialMediaAccountId` filter behavior.
  - Manual: GraphiQL/`curl` queries against the running local server; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root; confirm `apps/web/src/generated/graphql.ts` contains the new `Event`/`Schedule` types after codegen.

## Pre-Coding Approval Gate
- [ ] Prerequisite confirmation: Story `0-8-set-up-graphql-server-scaffold-code-generator-pipeline-and-the-optimized-select-query-utility` is confirmed DONE (currently `in-progress`), or the user explicitly accepts starting against its current in-progress scaffold.
- [ ] **AC5/Story 0.17 sequencing accepted:** Story `0-17-set-up-graphql-authenticated-context-layer` is `backlog` (not started). This story will implement AC5's DSL field/operator support for `sourceSocialMediaAccountId` now, but will **not** implement true "scoped to the current authenticated user" ownership enforcement, since no verified resolver identity exists yet and AD-7 forbids trusting a client-supplied user ID. Confirm this split is acceptable — real enforcement is wired once Story 0.17 lands and Story 3.7 (Feed) becomes the real consumer — OR direct that Story 0.17 be implemented first.
- [ ] **Interim testing strategy accepted:** `packages/domain`'s required 100%-coverage unit tests and `apps/backend`'s integration tests use `node:test`/`tsx --test` (mirroring `packages/database`/`packages/graphql-select`), not Vitest, because Story 0.10 (`@festgrid/testing-config`) is still `ready-for-dev`. Confirm this is acceptable, or direct that Story 0.10 be implemented first.
- [ ] Scope confirmed: Only the backend GraphQL API layer (`apps/backend`, `packages/domain`, workspace-dependency wiring). No frontend changes, no proximity/geo filtering (Story `2-5a`), no favorites/calendar fields (Story `2-1a`/`2-2`).
- [ ] Architecture confirmed: Follows AD-1, AD-2, and AD-7 (as scoped above) from the Architecture Spine.
- [ ] Testing plan confirmed: Unit tests for the DSL parser (100% coverage, `packages/domain`), integration tests for resolvers (`apps/backend`).
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-1-readiness.md` (no new gap — AC5's dependency already tracked as Story 0.17); Gate 2 run fresh (no gap).
- [ ] **AC6/Story 1.2a sequencing accepted:** Story `1-2a-create-posts-table-and-link-seeded-events-to-their-source-post` is `backlog` (not started). Confirm it is done before implementing AC6, or explicitly accept shipping this story without AC6's `imageUrl` field for now (Story 1.3b's `EventCard` is already decoupled via a generic prop and does not hard-block on this).
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements
- **100% unit test coverage** (non-negotiable, `project-context.md`) for the Unified Query DSL → Drizzle mapping logic in `packages/domain`, via `node:test`/`tsx --test` (interim strategy, see Pre-Coding Approval Gate).
- Integration tests (`apps/backend`, `tsx --test` against a local/test database) verifying `events`/`event` resolvers return correct, correctly-filtered, correctly-paginated, correctly-sorted results, and that `buildOptimizedDrizzleSelect` is actually restricting fetched columns (not over-fetching).
- Manual verification of GraphQL abuse protection is unaffected (already covered by Story 0.8; this story's added nesting stays within the configured `maxDepth`).

## Deliverables Checklist
- [ ] `packages/domain` scaffolded as a real workspace package with the DSL-to-Drizzle mapper and its unit tests.
- [ ] GraphQL schema for `Event`/`Schedule`/enums/DSL input types defined in `apps/backend/src/schema/events.graphql`.
- [ ] `events` query resolver implemented with pagination, default sort, `buildOptimizedDrizzleSelect`, and AD-1 filter/combinator support.
- [ ] `event(id)` query resolver implemented, including a working `Event.schedules` field resolver returning all schedules.
- [ ] `sourceSocialMediaAccountId` DSL filter implemented per the Pre-Coding Approval Gate's agreed scope.
- [ ] `apps/backend` gains `@festgrid/database`/`@festgrid/graphql-select`/`@festgrid/domain` workspace dependencies and a Drizzle client.
- [ ] Unit and integration tests written and passing; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope
- Any frontend UI development (handled by Stories 1.3, 1.3b, 1.4, 1.5, 1.6, 1.6a).
- Any write mutations for events (handled in Epic 4).
- Base GraphQL server boilerplate and `buildOptimizedDrizzleSelect` utility itself (handled by Story 0.8).
- Geo-distance/"nearby" filtering and sorting (handled by Story `2-5a-extend-the-events-graphql-api-layer-with-geo-distance-query-support`, `backlog`).
- `isFavorited`/`isAddedToCalendar` fields and any favorites/calendar-added filtering (handled by Story `2-1a-build-the-favorites-and-calendar-additions-backend-graphql-api-layer`, `backlog`).
- True request-scoped ownership enforcement for AC5's `sourceSocialMediaAccountId` filter (blocked on Story `0-17-set-up-graphql-authenticated-context-layer`, `backlog` — see Pre-Coding Approval Gate).
- Excluding `status='soft_deleted'` events (handled by Story 4.4a per its own epics.md `Note:`).
- Any AWS/Lambda/API Gateway deployment of this server (handled by Story 0.14; this story runs against Story 0.8's local-dev-runnable server only).

## Definition of Done
- [ ] AC1-AC5 satisfied (AC5 scoped per the Pre-Coding Approval Gate's agreed split).
- [ ] Required tests passing (`packages/domain` 100% coverage, `apps/backend` integration tests).
- [ ] Lint and type checks passing for `apps/backend`, `packages/domain`, and any touched packages.

## Completion Status
Incomplete

## Dev Agent Record
- None yet.
