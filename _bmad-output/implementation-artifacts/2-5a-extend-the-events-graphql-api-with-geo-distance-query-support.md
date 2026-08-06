---
baseline_commit: 495f8cb21e4a1a0416c918fda5a0386c73ecbd9d
---
# Story 2.5a: Extend the events GraphQL API with geo-distance query support

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.5a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a new `withinRadius` condition type in the Unified Query DSL and matching resolver logic in the events API,
so that Story 2.5 ("Find nearby events") can filter events by proximity to a saved location without inventing a parallel, non-conforming query mechanism.

## Acceptance Criteria

1. **Given** Story 2.3a's saved locations (`user_locations`, exposed as `UserLocation` via `myLocations`) and Story 1.3a's `events` resolver exist, **when** a client sends a Unified Query DSL (AD-1) terminal condition `{ field: "scheduleCoordinates", operator: "withinRadius", value: { locationPreferenceId: "<uuid>", radiusKm: <number> } }`, **then** the backend resolves `locationPreferenceId` to that saved location's `latitude`/`longitude`, computes distance against each returned event's main-schedule coordinates using a Haversine formula, and returns only events within `radiusKm` — reusing the existing `schedules` left-join (`mainSchedulesOnly`) already used by `scheduleLocation`/`performers` filtering, not a new join.
1a. **And** the same `withinRadius` operator also accepts an ad-hoc-coordinate value shape — `{ field: "scheduleCoordinates", operator: "withinRadius", value: { latitude: <number>, longitude: <number>, radiusKm: <number> } }` — that filters directly against the supplied `latitude`/`longitude` with no `locationPreferenceId` lookup and no ownership check (it isn't tied to any stored row), reusing the identical Haversine/bounding-box SQL as AC1. The two shapes are mutually exclusive within a single condition: a value must supply either `locationPreferenceId` XOR (`latitude` AND `longitude`), never both, never neither — an invalid combination throws `BAD_REQUEST`.
2. **And** the formal field/operator list in AD-1 (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`) is updated to document `scheduleCoordinates`/`withinRadius` and both its value shapes (`{ locationPreferenceId, radiusKm }` and `{ latitude, longitude, radiusKm }`) — this is the only artifact in the repo serving the "formal API documentation" role AD-1's prose refers to; no separate `docs/api/*` file exists today (confirmed by search), so none is invented by this story.
3. **And** a spatial-lookup-capable index is added to keep radius filtering performant: a composite btree index on `schedules(latitude, longitude)` supporting a bounding-box pre-filter, extending `project-context.md`'s Database Indexing rule (currently silent on geo lookups).
4. **And** any `withinRadius` condition (either value shape) is only usable by an authenticated caller — an unauthenticated request containing a `withinRadius` condition throws `UNAUTHENTICATED` (via the existing `requireAuth`, AD-7) regardless of which shape is used, and a `locationPreferenceId` that doesn't exist or isn't owned by the caller throws `NOT_FOUND` (`'Location not found'`, mirroring `updateUserLocation`'s existing precedent) — the query is not silently degraded to "no filter" or "empty results" in either case. (The ad-hoc `{ latitude, longitude }` shape has no ownership concept to check, but still requires the caller to be authenticated, same as the saved-location shape — see AC1a.)
5. **And** the DSL's full recursive AND/OR nesting (AD-1) is honored for `withinRadius`: a query may reference **multiple different** `locationPreferenceId`s across nested conditions (e.g. "near home OR near work") and each is resolved independently and correctly — not just a single top-level occurrence — since AD-1/AD-2 bind this as one general, composable mechanism reusable by future features (e.g. Epic 3 push-notification proximity filtering), not a single-purpose one-shot filter.
6. **And** an event whose main schedule has no resolvable coordinates (`schedules.latitude`/`longitude` still `NULL` — not yet backfilled/parsed) is excluded from `withinRadius`-filtered results, not treated as an error.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`) — AD-1's DSL as specified has no geo-distance operator, and Story 2.5 cannot be built against it as-is. Classified as a single-story architecture split (needed only by Story 2.5), positioned immediately before it. AC2, AC4-AC6 above were not in `epics.md`'s literal AC text — they were surfaced during this story's own creation by reading the real current DSL implementation (`packages/domain/src/query/queryDsl.ts`, `packages/graphql-select/drizzle-where.ts`, `apps/backend/src/schema/resolvers.ts`) rather than trusting the epic's abstract description alone; see Dev Notes → Architecture & UX Gate Findings and Data Type Compatibility & Migration Requirements. The storage/distance-computation approach (AC1/AC3) and the multi-location recursive-support requirement (AC5) were presented to and confirmed by the user as design decisions before this story was drafted (2026-08-05) — see Dev Notes → Design Decisions Confirmed With User.

**Amendment (2026-08-06, via `bmad-create-story` while drafting Story 2.5):** AC1a added. Story 2.5's own creation confirmed with the user that when a user has no saved locations, the Discovery page should fall back to filtering by the browser's live geolocation coordinates rather than a saved location — a shape this story's original `withinRadius` design (saved-location-only) couldn't express. Since this story had not yet started implementation (`Completion Status: Not started`), the AC/value shape was broadened in place here rather than splitting a new prerequisite story, per the user's explicit choice among three options presented via `AskUserQuestion`. This is purely additive to AC1/AC4-AC6 — the existing `{ locationPreferenceId, radiusKm }` path, its ownership check, and its error semantics are unchanged.

**Depends on:** Story 1.3a (`events` resolver, DSL wiring — `done`), Story 2.3a (`user_locations` table, `myLocations`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation` — `review`, fully implemented in code per direct read of `apps/backend/src/schema/resolvers.ts` and `packages/database/schema.ts`). No blocking dependency.

## Tasks / Subtasks

- [ ] Task 1: Add `withinRadius` to the DSL type and radius validation (AC1, AC1a, AC4, AC5) — `packages/domain`
  - [ ] In `packages/domain/src/query/queryDsl.ts`, extend `TerminalOperator` to `"eq" | "ne" | "contains" | "in" | "notIn" | "withinRadius"`.
  - [ ] In `packages/domain/src/user-locations/validateLocationInput.ts`, add:
    ```ts
    export function validateRadiusKm(radiusKm: number): void {
      if (typeof radiusKm !== 'number' || isNaN(radiusKm) || radiusKm < 1 || radiusKm > 50) {
        throw new InvalidUserLocationInputError('radiusKm must be between 1 and 50 kilometers inclusive');
      }
    }
    ```
    (Bound mirrors `validateRadiusMeters`'s existing 1000-50000m = 1-50km range, expressed in the right unit for this call site so the error message isn't confusingly stated in meters for a km input.)
  - [ ] Create `packages/domain/src/query/resolveWithinRadiusConditions.ts` — a pure tree-transform, generalized over the whole recursive condition tree (AC5), not a single-node lookup. Handles both value shapes from AC1/AC1a: `{ locationPreferenceId, radiusKm }` (resolved via lookup) and `{ latitude, longitude, radiusKm }` (ad-hoc, passed through unchanged after validation, no lookup):
    ```ts
    import { QueryCondition, TerminalCondition, isGroupCondition } from "./queryDsl.js";
    import { validateRadiusKm } from "../user-locations/validateLocationInput.js";
    import { InvalidUserLocationInputError } from "../user-locations/validateLocationInput.js";

    export class UnknownLocationPreferenceError extends Error {
      constructor(public readonly locationPreferenceId: string) {
        super(`Unknown or inaccessible locationPreferenceId: ${locationPreferenceId}`);
        this.name = "UnknownLocationPreferenceError";
      }
    }

    export interface LocationPoint {
      latitude: number;
      longitude: number;
    }

    // Resolves every `withinRadius` terminal condition anywhere in the (possibly nested AND/OR) tree,
    // replacing `value: { locationPreferenceId, radiusKm }` with `value: { latitude, longitude, radiusKm }`
    // so buildDrizzleWhere never needs to perform a DB lookup itself. Ad-hoc `{ latitude, longitude, radiusKm }`
    // conditions (AC1a) are validated and passed through as-is — they are already in the shape buildDrizzleWhere expects.
    export function resolveWithinRadiusConditions(
      condition: QueryCondition | null | undefined,
      locationsById: Map<string, LocationPoint>
    ): QueryCondition | null | undefined {
      if (!condition) return condition;

      if (isGroupCondition(condition)) {
        return {
          operator: condition.operator,
          conditions: condition.conditions.map(c => resolveWithinRadiusConditions(c, locationsById) as QueryCondition),
        };
      }

      if (condition.operator !== "withinRadius") {
        return condition;
      }

      const { locationPreferenceId, latitude, longitude, radiusKm } = (condition.value ?? {}) as {
        locationPreferenceId?: string;
        latitude?: number;
        longitude?: number;
        radiusKm?: number;
      };

      const hasLocationPreferenceId = typeof locationPreferenceId === "string" && !!locationPreferenceId;
      const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";

      if (hasLocationPreferenceId === hasCoordinates) {
        // Either both present or neither present — AC1a requires exactly one of the two shapes.
        throw new InvalidUserLocationInputError(
          "withinRadius value must supply exactly one of locationPreferenceId or { latitude, longitude }"
        );
      }

      validateRadiusKm(radiusKm as number);

      if (hasCoordinates) {
        // Ad-hoc shape (AC1a): no lookup, no ownership check — already in the resolved shape.
        return condition;
      }

      const point = locationsById.get(locationPreferenceId as string);
      if (!point) {
        throw new UnknownLocationPreferenceError(locationPreferenceId as string);
      }

      return {
        ...condition,
        value: { latitude: point.latitude, longitude: point.longitude, radiusKm },
      } satisfies TerminalCondition;
    }
    ```
  - [ ] Export both from their folder barrels: add `export * from "./resolveWithinRadiusConditions.js";` to `packages/domain/src/query/index.ts` (already `export * from "./queryDsl.js";`); `validateRadiusKm` is picked up automatically by the existing `export * from './validateLocationInput.js';` in `packages/domain/src/user-locations/index.ts`.
  - [ ] Unit tests (`packages/domain` requires 100% coverage on all exported logic — Testing Rules): `packages/domain/src/query/resolveWithinRadiusConditions.test.ts` covering — resolves a single top-level `withinRadius` condition; resolves **multiple different** `locationPreferenceId`s nested inside an `or`/`and` tree (AC5); passes through an ad-hoc `{ latitude, longitude, radiusKm }` condition unchanged after validation (AC1a); throws `InvalidUserLocationInputError` when a value supplies both `locationPreferenceId` and coordinates, and when it supplies neither (AC1a); passes through non-`withinRadius` terminal conditions and other group conditions unchanged; throws `UnknownLocationPreferenceError` for an id not present in `locationsById`; throws (via `validateRadiusKm`) for `radiusKm` outside 1-50 on both shapes; add corresponding new cases to the existing `packages/domain/src/user-locations/validateLocationInput.test.ts` for `validateRadiusKm`'s boundary values (0, 1, 50, 51, NaN, non-number).

- [ ] Task 2: Add scalar coordinates to `schedules` + migration (AC1, AC3, AC6) — `packages/database`
  - [ ] In `packages/database/schema.ts`, extend the `schedules` table definition:
    ```ts
    export const schedules = pgTable('schedules', {
      // ...existing columns unchanged...
      locationDetails: jsonb('location_details').$type<LocationDetails>(), // add .$type<LocationDetails>() — see Data Type Compatibility below
      latitude: doublePrecision('latitude'),
      longitude: doublePrecision('longitude'),
      ...timestamps,
    }, (t) => ({
      performersIdx: index('schedule_performers_idx').on(t.performers),
      locationIdx: index('schedule_location_idx').on(t.location),
      coordinatesIdx: index('schedule_coordinates_idx').on(t.latitude, t.longitude),
    }));
    ```
    Nullable — not every schedule has parsed coordinates yet (matches `locationDetails` itself being nullable, and AC6's exclusion-not-error behavior for rows without them).
  - [ ] Run `pnpm --filter @festgrid/database exec drizzle-kit generate` to produce the next sequential migration file (`packages/database/migrations/0008_<generated-name>.sql`) from the schema diff above.
  - [ ] Hand-append a data backfill statement to that same generated `.sql` file (drizzle-kit only diffs schema, not data — no existing precedent in this repo for a separate backfill migration file, so follow the single-file convention):
    ```sql
    --> statement-breakpoint
    UPDATE "schedules"
    SET "latitude" = (location_details->'coordinates'->>'latitude')::double precision,
        "longitude" = (location_details->'coordinates'->>'longitude')::double precision
    WHERE location_details IS NOT NULL
      AND location_details->'coordinates'->>'latitude' IS NOT NULL
      AND location_details->'coordinates'->>'longitude' IS NOT NULL;
    ```
    (JSONB key names confirmed as `latitude`/`longitude`, not `lat`/`lng` — `packages/shared-types/src/index.ts`'s `Coordinates` interface, and `formatLocationDetails` in `resolvers.ts` reading `details.coordinates.latitude`.)
  - [ ] Apply the migration locally (`pnpm --filter @festgrid/database run migrate` or the project's established local-migration command — confirm exact script name in `packages/database/package.json`) and confirm it runs cleanly against the local dev Postgres.

- [ ] Task 3: Add `withinRadius` handling to `buildDrizzleWhere` (AC1, AC6) — `packages/graphql-select`
  - [ ] In `packages/graphql-select/drizzle-where.ts`, add a case to the existing `switch (operator)` block:
    ```ts
    case "withinRadius": {
      const { latitude, longitude, radiusKm } = value as { latitude: number; longitude: number; radiusKm: number };
      const { latColumn, lngColumn } = column as { latColumn: PgColumn; lngColumn: PgColumn };
      // Bounding-box pre-filter (uses the schedule_coordinates_idx btree index) + exact Haversine trim.
      // 1 degree of latitude ≈ 111.32 km; longitude degree length shrinks with cos(latitude).
      const latDelta = radiusKm / 111.32;
      const lngDelta = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180));
      return and(
        sql`${latColumn} BETWEEN ${latitude - latDelta} AND ${latitude + latDelta}`,
        sql`${lngColumn} BETWEEN ${longitude - lngDelta} AND ${longitude + lngDelta}`,
        sql`(
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(${latitude})) * cos(radians(${latColumn})) *
              cos(radians(${lngColumn}) - radians(${longitude})) +
              sin(radians(${latitude})) * sin(radians(${latColumn}))
            ))
          )
        ) <= ${radiusKm}`
      );
    }
    ```
    NULL `latColumn`/`lngColumn` values naturally fail the `BETWEEN`/arithmetic comparisons (SQL NULL semantics), satisfying AC6 without an explicit `IS NOT NULL` guard. `column` here is `fieldMap.scheduleCoordinates`, a `{ latColumn, lngColumn }` object rather than a single `PgColumn` — the existing `FieldColumnMap = Record<string, PgColumn | any>` type already permits this.
  - [ ] Unit tests in `packages/graphql-select/drizzle-where.test.ts`: extend the synthetic `testTable`/`fieldMap` with `latitude`/`longitude` `doublePrecision` columns and a `scheduleCoordinates: { latColumn: testTable.latitude, lngColumn: testTable.longitude }` entry; add a case asserting `buildDrizzleWhere` returns a defined `SQL` for `{ field: "scheduleCoordinates", operator: "withinRadius", value: { latitude: 40.7, longitude: -74.0, radiusKm: 10 } }`, following this file's existing `assert.ok(res !== undefined)` pattern (no real DB in this package's tests).

- [ ] Task 4: Wire it into the `events` resolver (AC1, AC4, AC5) — `apps/backend`
  - [ ] In `apps/backend/src/schema/resolvers.ts`, `Query.events`, add a tree-walker mirroring the existing `hasFavoritedEqTrue` pattern (same file, same function):
    ```ts
    const hasWithinRadiusCondition = (condition: QueryCondition | undefined): boolean => {
      if (!condition) return false;
      if ('conditions' in condition) return condition.conditions.some(hasWithinRadiusCondition);
      return condition.operator === 'withinRadius';
    };
    ```
  - [ ] After the existing silent `try { requireAuth... } catch {}` block that sets `userId`, add: if `hasWithinRadiusCondition(query as QueryCondition | undefined)` and `userId === null`, call `requireAuth(context)` directly (lets it throw the standard `UNAUTHENTICATED` `GraphQLError`, AC4) instead of the tolerant degrade the rest of `events` uses for personalization fields.
  - [ ] When a `withinRadius` condition is present and `userId` is set: `const locationRows = await db.select({ id: userLocations.id, latitude: userLocations.latitude, longitude: userLocations.longitude }).from(userLocations).where(eq(userLocations.userId, userId));` (no `deletedAt` filter — `user_locations` is not in AD-8's soft-delete table list), build `const locationsById = new Map(locationRows.map(r => [r.id, { latitude: r.latitude, longitude: r.longitude }]));`, then `let resolvedQuery: QueryCondition | undefined; try { resolvedQuery = resolveWithinRadiusConditions(query as QueryCondition, locationsById) as QueryCondition | undefined; } catch (err) { if (err instanceof UnknownLocationPreferenceError) throw new GraphQLError('Location not found', { extensions: { code: 'NOT_FOUND' } }); if (err instanceof InvalidUserLocationInputError) throw new GraphQLError(err.message, { extensions: { code: 'BAD_REQUEST' } }); throw err; }` — mirrors `createUserLocation`/`updateUserLocation`'s existing catch-and-remap pattern for the same error classes.
  - [ ] Use `resolvedQuery` (falling back to the original `query` when no `withinRadius` condition was present, i.e. `resolvedQuery ?? query`) as the input to the existing `buildDrizzleWhere(... , fieldMap)` call — no other change to how `whereClause` feeds the `itemsQuery`/`totalCountRes` queries (both already share one `whereClause` variable).
  - [ ] Add `scheduleCoordinates: { latColumn: schedules.latitude, lngColumn: schedules.longitude }` to the existing `fieldMap` object (alongside `scheduleLocation: schedules.location`) — reuses the same `mainSchedulesOnly` left-join already in the query, no new join.
  - [ ] Add the new imports: `resolveWithinRadiusConditions, UnknownLocationPreferenceError` from `@festgrid/domain/query`; `InvalidUserLocationInputError` is already imported from `@festgrid/domain/user-locations`.
  - [ ] Integration tests in `apps/backend/src/schema/resolvers.test.ts` (extends the existing `events resolver integration via Yoga` block, real local test DB — no msw, matches this file's established pattern): seed a `userLocations` row and 2-3 `events`+`schedules` rows at known coordinates (some inside, some outside the test radius, one with `NULL` lat/lng); assert `withinRadius` filters correctly (AC1, AC6); assert an unauthenticated `withinRadius` query throws `UNAUTHENTICATED` (AC4); assert an unowned/unknown `locationPreferenceId` throws `NOT_FOUND` (AC4); assert an `or` of two different owned `locationPreferenceId`s returns the union of both radii's events (AC5).

- [ ] Task 5: Update AD-1's field/operator documentation (AC2)
  - [ ] In `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, AD-1's "Fields and Operators" list, add a new bullet: `**Geo (scheduleCoordinates):** withinRadius (value: { locationPreferenceId: ID, radiusKm: number [1-50] } | { latitude: Float, longitude: Float, radiusKm: number [1-50] })`.

- [ ] Task 6: Manual verification
  - [ ] Run the backend locally, exercise `events(query: { field: "scheduleCoordinates", operator: "withinRadius", value: { locationPreferenceId: "<real id>", radiusKm: 10 } })` via GraphiQL/`curl` against real seeded/backfilled data; confirm results are limited to the radius, confirm an `or` across two locations returns the union, confirm the `NOT_FOUND`/`UNAUTHENTICATED` error paths; confirm `pnpm build`/`pnpm lint` stay clean at the repo root (no codegen re-run needed — `EventQueryConditionInput` is unchanged, see Dev Notes → Data Type Compatibility).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`; Story 2.5a is listed in `stories_covered` and is itself the previously-identified resolution to the Gate 1 gap called out in that sweep's predecessor run — "AD-1's DSL as specified has no geo-distance operator"). No new Gate 1/3 gap surfaced for this story beyond that already-recorded one. Lightweight escape-hatch guard: this story's scope (extending an existing DSL operator + resolver + one new nullable column pair on an existing table) doesn't introduce a new external service, new data entity, or new infra dependency the epic-wide sweep couldn't have anticipated — no fresh Gate 1/3 subagent dispatch needed.
- **Gate 2 (UI Complexity & Reusability):** Ran via a one-shot Freya-persona subagent dispatch (this story has zero UI surface — pure GraphQL schema/resolver/DB change — matching Stories 2.1a/2.3a/2.3b/2.4b/0.16's identical zero-UI precedent). **Verdict: no in-scope UI gap in this story** (nothing here needs splitting out of 2.5a). The check did surface a **forward-looking note for whoever drafts Story 2.5 next** (recorded here, not as a 2.5a Out-of-Scope prerequisite, since Story 2.5 already exists as a `backlog` sprint-status entry — no new story needs to be created): Story 2.3's saved-location edit form (`location-form-dialog.tsx`) already has a radius `Slider` (1-50km, persisted as `UserLocation.radius`), and Story 2.5's own AC ("I can specify a radius... to define nearby") implies a *second*, ad hoc, query-time radius control on the Discovery page — this story's `radiusKm` DSL parameter (independent of `UserLocation.radius`) is built to support exactly that, matching both stories' literal `epics.md` AC text as already written/approved. Whoever drafts Story 2.5 should explicitly decide (not silently default) whether the Discovery radius control reuses the existing `Slider` component/pattern from `location-form-dialog.tsx` and whether selecting a saved location pre-fills its configured default radius — this story's backend contract supports either choice unchanged (`radiusKm` is always caller-supplied per query).

  **Resolved (2026-08-06, during Story 2.5's own creation):** the user confirmed via `AskUserQuestion` that selecting a saved location pre-fills the radius control from that location's own `radius` (not an independent default), and that Story 2.5 additionally needs an ad-hoc-coordinate fallback (current browser location) when the user has no saved locations at all — which is what AC1a above adds to this story's contract. See Story 2.5's own file for the full frontend design.

### Design Decisions Confirmed With User (2026-08-05)

Two real, non-mechanical tradeoffs were surfaced via `AskUserQuestion` before this story was drafted, since neither `epics.md` nor the architecture spine specifies an implementation approach:

1. **Storage + distance computation:** Chosen — nullable scalar `latitude`/`longitude` `doublePrecision` columns on `schedules` (mirroring `userLocations`' existing plain-float pattern) + a Haversine formula in raw SQL with a bounding-box pre-filter (composite btree index), over PostGIS `geography`/`ST_DWithin` or the `earthdistance`/`cube` contrib extension. Reasoning: no new Postgres extension needed (project-context.md requires local Postgres and Supabase to "work seamlessly across both" — PostGIS specifically requires a separate local install, not just `CREATE EXTENSION`), and it's consistent with the plain-float precedent `userLocations` already established. See Task 2/3.
2. **DSL generality for multi-location queries:** Chosen — full recursive support. Before building the WHERE clause, the resolver fetches **all** of the authenticated user's saved locations (a small, bounded per-user list) into an `id → {lat,lng}` map, then a pure tree-transform (`resolveWithinRadiusConditions`, `packages/domain`) resolves every `withinRadius` condition anywhere in the (possibly nested AND/OR) tree — not just a single top-level occurrence — over the simpler "single top-level location only" alternative. Reasoning: AD-1/AD-2 bind this as one composable, reusable DSL (not a single-purpose mechanism), and future features (Epic 3 push-notification proximity filtering, noted in `epic-2-readiness.md`'s Gate 3 "previous sweep findings") plausibly need the same operator with multiple locations in one query (e.g. "near any of my saved locations"). See Task 1/4, AC5.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: two additive schema gaps found and fixed by this story, plus one incidental pre-existing type-safety gap fixed while touching the same table.**
  1. **No scalar coordinate columns on `schedules` today** — only an untyped `locationDetails: jsonb('location_details')` blob (confirmed via direct read of `packages/database/schema.ts`), with coordinates nested at `location_details->'coordinates'->{latitude,longitude}`. No index of any kind on location data beyond the existing non-geo `schedule_location_idx` (on the free-text `location` column). AC1/AC3 require a real, indexable geo lookup — **Fix:** Task 2 adds nullable `latitude`/`longitude` `doublePrecision` columns + `schedule_coordinates_idx` composite index + a migration backfilling existing rows from the JSONB.
  2. **`schedules.locationDetails` has no `.$type<LocationDetails>()` cast**, unlike `userLocations.locationDetails` (`jsonb('location_details').$type<LocationDetails>().notNull()`, confirmed via the same schema read) — a pre-existing, previously-dormant type-safety gap (no code path currently writes this column with compile-time shape checking). This story's migration-backfill script reads directly from this column's `coordinates.latitude`/`coordinates.longitude` shape, so annotating it now (Task 2) is directly relevant to this story's own correctness, not an unrelated drive-by change — it's judged mechanical (adding a type annotation changes zero runtime behavior, only strengthens future compile-time checks) and not escalated via `AskUserQuestion`.
  3. **`EventQueryConditionInput`'s GraphQL shape already supports `withinRadius` with zero schema changes** — confirmed via direct read of `apps/backend/src/schema/events.graphql`: `field`/`operator` are untyped `String`, `value: JSON` (the `scalar JSON` already declared at the top of that file), so the recursive input type is already fully generic. No `.graphql` file edit, and therefore **no `pnpm run codegen` re-run**, is needed for this story (unlike Story 2.4b, which added real new SDL types) — confirm this explicitly in Task 6's manual verification rather than assuming it.
- **Impacted contracts:** `packages/database/schema.ts` (`schedules` table — new columns + index + `.$type<LocationDetails>()` annotation); new migration `packages/database/migrations/0008_<generated-name>.sql`; `packages/domain/src/query/queryDsl.ts` (`TerminalOperator` union); new `packages/domain/src/query/resolveWithinRadiusConditions.ts`; `packages/domain/src/user-locations/validateLocationInput.ts` (`validateRadiusKm`); `packages/graphql-select/drizzle-where.ts` (`withinRadius` case); `apps/backend/src/schema/resolvers.ts` (`Query.events`); `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1 documentation).
- **Required DB migration changes:** Yes — see Task 2 (schema diff via `drizzle-kit generate` + hand-appended backfill `UPDATE`, committed to the repo per AD-3).
- **Required TypeScript type changes:** Additive only — `TerminalOperator` gains `"withinRadius"`; no `packages/shared-types` change (the DSL's `value: any`/`JSON` already accommodates the new `{ locationPreferenceId, radiusKm }` and resolved `{ latitude, longitude, radiusKm }` shapes without a named interface, consistent with how `TerminalCondition.value: any` already works for every other operator).
- **Backward compatibility and rollout notes:** Purely additive — a new enum member, a new nullable column pair (existing rows read as `NULL` until the migration's backfill runs, and `NULL` coordinates correctly exclude those rows from `withinRadius` results per AC6, they don't error), a new `switch` case, a new resolver code path gated entirely behind the presence of a `withinRadius` condition in the query (queries that don't use it are byte-for-byte unaffected). No existing field, query, or resolver behavior changes for any caller not using the new operator.
- **Verification checks:** Task 1's domain unit tests (100% coverage on `resolveWithinRadiusConditions`/`validateRadiusKm`); Task 3's `buildDrizzleWhere` unit test; Task 4's resolver integration tests (radius filtering correctness, multi-location `or` support, auth/ownership error paths, `NULL`-coordinate exclusion); a manual check that the migration's backfill `UPDATE` correctly populates `latitude`/`longitude` for existing seeded rows with `location_details` present.

### Architecture / technical constraints

- **AD-1 (Unified Query DSL) / AD-2 (Unified Event Querying):** `withinRadius` is a new terminal operator within the existing DSL, not a new endpoint or parallel filtering mechanism — this is the entire point of this story (Gate 1 finding). AC5's full-recursion requirement is a direct consequence of AD-1's binding "recursive structure... complex, nested queries" contract.
- **AD-7 (Authenticated Context):** `withinRadius` requires `requireAuth` (AC4) — the first operator in this DSL that has a conditional (not blanket) auth requirement depending on which conditions are present in a given query, since `events` itself remains a public, unauthenticated-tolerant query for every other field/operator (AD-7's ownership-decision rule: the verified context, never a client-supplied id, is what makes `locationPreferenceId` ownership trustworthy).
- **AD-3 (Database Schema Management):** Schema change ships as a `drizzle-kit generate`-produced SQL migration, committed to the repo (Task 2).
- **AD-8 (Soft-Delete Convention) does not bind `user_locations`** — confirmed it is not in AD-8's explicit table list (`EventInfo`, `Favorite`, `CalendarEntry`, `Subscription`, `ApiKey`) and `deleteUserLocation`'s resolver performs a real hard `db.delete(...)`, not a `deletedAt` soft-delete — so the locations lookup in Task 4 needs no `deletedAt IS NULL` filter. AD-8 *does* bind `events`/`schedules` reads generally, but that's already enforced upstream of this story's change (unchanged by this story).
- **Adapter Pattern / General Architecture:** No external service call is introduced — distance computation is pure SQL against already-stored coordinates, not a geolocation-provider call (unlike Stories 0.16/2.3b/2.4b). `resolveWithinRadiusConditions` and `validateRadiusKm` are pure, dependency-free logic living in `packages/domain` per the Code Organization rule (no DB/ORM/Node-only imports — they take a plain `Map` and plain values, not a Drizzle client), placed in the generic `packages/domain/src/query/` subfolder rather than nested under `events/`, since the mechanism is DSL-tree-generic and reusable by any future consumer of `withinRadius`, not events-specific (matches the persistent-facts rule on generic-mechanism placement).
- **Package boundaries:** `buildDrizzleWhere`'s SQL-building change stays in `packages/graphql-select` (already Drizzle/ORM-coupled by design — this is exactly the kind of DB-coupled logic that rule says does *not* belong in `packages/domain`). The DB lookup (`db.select(...).from(userLocations)`) and the try/catch error-remapping stay in `apps/backend`'s resolver, matching where `createUserLocation`/`updateUserLocation` already do the identical ownership-check-and-remap pattern.
- **Testing Rules:** `packages/domain` additions get 100% unit-test coverage (Task 1). `packages/graphql-select` and `apps/backend` follow this repo's existing "testing trophy" pattern for those packages — unit tests without a real DB for the pure SQL-builder (Task 3, matching that file's existing style), integration tests with a real local test DB for the resolver (Task 4, matching `resolvers.test.ts`'s existing style). No E2E test in this story — no UI ships (Story 2.5 owns the E2E happy path for the actual nearby-events feature).
- **State Management / Loader categorization: not applicable** — backend-only, no UI renders any async state for this story.
- **AD-5 (Analytics) / AD-6 (i18n): not applicable** — no user-facing interaction or text ships from this story (`GraphQLError` messages are developer-facing; Story 2.5 owns any user-facing translation/display of them, matching Story 2.3b/2.4b's identical precedent).

### Previous/Sibling Story Intelligence (Stories 1.3a, 2.3a, 2.4b, 2.5)

- **Story 1.3a (`done`, fully implemented)** — confirmed via direct read of `apps/backend/src/schema/resolvers.ts` (`Query.events`, lines ~232-357) and `apps/backend/src/schema/events.graphql`. The `fieldMap`/`buildDrizzleWhere`/`mainSchedulesOnly` left-join pattern this story extends is exactly as read (not epics.md's abstract description) — `scheduleLocation: schedules.location` at line 264 is the direct precedent for this story's new `scheduleCoordinates` entry, using the identical join.
- **Story 2.3a (`review`, fully implemented in code)** — confirmed `userLocations` table (`latitude`/`longitude` `doublePrecision`, `radius` in meters) and `createUserLocation`/`updateUserLocation`/`deleteUserLocation`/`myLocations` resolvers via direct reads of `packages/database/schema.ts` and `resolvers.ts`. `updateUserLocation`'s `GraphQLError('Location not found', { extensions: { code: 'NOT_FOUND' } })` (line ~72) is the exact precedent this story's Task 4 error-remapping mirrors. `user_locations` has no `deletedAt` column — hard-deletes only.
- **Story 2.4b (`ready-for-dev`, not yet implemented)** — closest recent architectural analog for "extend an existing GraphQL surface with a new capability, confirm auth precedent, confirm no dormant type-shape mismatch." Unlike 2.4b, this story needs **no new `.graphql` type or codegen re-run** (the DSL's `value: JSON` already accommodates the new shape) and **no external adapter call** (pure SQL, not a Geoapify round-trip).
- **Story 2.5 (`backlog`, not yet drafted)** — this story's only consumer. Its own `epics.md` AC ("I can specify a radius... to define nearby") is the source of the `radiusKm`-as-independent-query-parameter design (not derived from `UserLocation.radius`) — confirmed consistent with this story's DSL contract. See Gate 2 forward note above for the open UI-design question left for that story's own creation.

### Git Intelligence Summary

Recent commits (`25ba9c7`, `0a1b245`, `ec92a4a`, `484943d`, `8b63e7d`) show `25ba9c7` ("feat: add user location management with create, update, and delete mutations") is Story 2.3a's real, committed implementation this story builds on — confirming `userLocations`/`myLocations`/the ownership-check-and-remap pattern all exist in code today, not just in a story draft. No commit since then has touched `apps/backend/src/schema/resolvers.ts`'s `Query.events`, `packages/graphql-select/drizzle-where.ts`, or `packages/domain/src/query/` — confirming this story's scope genuinely has not started implementation.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Database & Performance; Code Quality & Style Rules → Code Organization; Testing Rules; General Architecture → Adapter Pattern)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-3, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.5a, Story 1.3a, Story 2.3a, Story 2.5)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/2-backend.md`, `docs/infrastructure/3-database.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- Modified: `packages/domain/src/query/queryDsl.ts` (`TerminalOperator` gains `"withinRadius"`).
- New: `packages/domain/src/query/resolveWithinRadiusConditions.ts` (+ `resolveWithinRadiusConditions.test.ts`).
- Modified: `packages/domain/src/query/index.ts` (barrel export).
- Modified: `packages/domain/src/user-locations/validateLocationInput.ts` (+ `validateRadiusKm`); `validateLocationInput.test.ts` (new cases).
- Modified: `packages/database/schema.ts` (`schedules`: `latitude`, `longitude`, `schedule_coordinates_idx`, `.$type<LocationDetails>()` on `locationDetails`).
- New: `packages/database/migrations/0008_<generated-name>.sql` (drizzle-kit generated + hand-appended backfill `UPDATE`), matching `meta/0008_snapshot.json`/`_journal.json` entries drizzle-kit produces automatically.
- Modified: `packages/graphql-select/drizzle-where.ts` (`withinRadius` case); `drizzle-where.test.ts` (new cases).
- Modified: `apps/backend/src/schema/resolvers.ts` (`Query.events`: tree-walker, conditional auth, locations lookup, `resolveWithinRadiusConditions` call, `scheduleCoordinates` fieldMap entry); `resolvers.test.ts` (new integration tests).
- Modified: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1 field/operator documentation).
- **Not modified:** `apps/backend/src/schema/events.graphql` (no schema change needed — `EventQueryConditionInput` already generic); generated codegen output (`resolvers-types.ts`/`apps/web/src/generated/graphql.ts` — no re-run needed, see Data Type Compatibility); any `apps/web` source (Story 2.5's scope); `packages/ui` (no UI in this story).

### Rule Mapping

- *AD-1/AD-2* → `withinRadius` extends the existing DSL/resolver; AC5's multi-location recursive support keeps it one general mechanism, not a single-purpose filter (Task 1/4).
- *AD-7* → conditional `requireAuth` when `withinRadius` is present; ownership check via `userLocations.userId` before trusting `locationPreferenceId` (AC4, Task 4).
- *AD-3* → schema change ships as a committed `drizzle-kit generate`d migration (Task 2).
- *Database Indexing rule (project-context.md)* → `schedule_coordinates_idx` composite index backs the bounding-box pre-filter (AC3, Task 2/3).
- *Code Organization (packages/domain)* → pure tree-transform and radius validation live in `packages/domain/src/query/` (generic subfolder, DB/Node-dependency-free) — the DB lookup and Drizzle SQL building correctly live in `apps/backend`/`packages/graphql-select` instead (Task 1/3/4).
- *Testing Rules* → 100% unit coverage for new `packages/domain` logic (Task 1); unit tests for the SQL-builder (Task 3); integration tests for the resolver (Task 4).
- *Story-split-gate Gate 1/2/3* → Gate 1/3 cited from swept `epic-2-readiness.md` (this story is itself the identified gap-fill, confirmed no fresh gap); Gate 2 run via one-shot subagent, zero in-scope UI gap, one forward note left for Story 2.5's own future creation.

### Verification Plan

- `packages/domain`: `tsx --test` unit tests for `resolveWithinRadiusConditions` (single + multi-location recursion, error paths) and `validateRadiusKm` boundary values — 100% coverage.
- `packages/graphql-select`: `tsx --test` unit test confirming `buildDrizzleWhere` returns a defined `SQL` for a `withinRadius` condition against a synthetic `{ latColumn, lngColumn }` fieldMap entry.
- `apps/backend`: integration tests (Yoga + real local test DB, `resolvers.test.ts`) — radius filtering correctness against seeded coordinates; `NULL`-coordinate row exclusion (AC6); `UNAUTHENTICATED` for unauthenticated `withinRadius` (AC4); `NOT_FOUND` for an unowned/unknown `locationPreferenceId` (AC4); an `or` of two different owned locations returns the union of both radii (AC5).
- Manual: GraphiQL/`curl` smoke test against real backfilled data; confirm migration applies cleanly locally; confirm `pnpm build`/`pnpm lint` clean at the repo root with no codegen re-run required.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: backend-only (`packages/domain`, `packages/database`, `packages/graphql-select`, `apps/backend`) plus an architecture-spine documentation update — no `apps/web`/`packages/ui` changes (Story 2.5 consumes this later).
- [ ] **No blocking dependency:** confirmed via direct reads that Story 1.3a (`done`) and Story 2.3a (`review`, fully implemented in code) are both real and complete.
- [ ] **Design decisions accepted:** Haversine + scalar-column storage (not PostGIS/earthdistance), and full recursive multi-location support (not single-top-level-only) — both confirmed with the user via `AskUserQuestion` before drafting (see Dev Notes → Design Decisions Confirmed With User).
- [ ] **Amendment accepted:** AC1a's ad-hoc `{ latitude, longitude, radiusKm }` value shape, added 2026-08-06 while drafting Story 2.5, so its "no saved location -> use current browser location" fallback has a backend contract to consume — confirmed with the user via `AskUserQuestion` as the chosen resolution over splitting a new prerequisite story or an implicit-save workaround.
- [ ] **Data-type-compatibility fixes accepted:** new `schedules.latitude`/`longitude` columns + index + migration backfill, and incidentally annotating `schedules.locationDetails` with `.$type<LocationDetails>()` while touching the same table — per Dev Notes → Data Type Compatibility & Migration Requirements.
- [ ] Architecture and data/API boundaries confirmed: pure logic in `packages/domain`; DB-coupled SQL building in `packages/graphql-select`; DB lookup + error remapping in `apps/backend`'s resolver; no new join (reuses `mainSchedulesOnly`); no `.graphql` schema change, no codegen re-run.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (this story is itself the identified gap-fill); Gate 2 run via one-shot subagent — no in-scope UI gap; one forward-looking note recorded for Story 2.5's own future creation (not a blocking prerequisite for 2.5a).
- [ ] Testing plan confirmed: 100%-covered `packages/domain` unit tests; `packages/graphql-select` unit test; `apps/backend` integration tests (real local test DB, no mocks for the DB layer).
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/domain`: `tsx --test` unit tests, 100% coverage, for `resolveWithinRadiusConditions` (both value shapes, AC1/AC1a) and `validateRadiusKm` (Testing Rules — the only place unit tests are required in this repo).
- `packages/graphql-select`: `tsx --test` unit test for the new `withinRadius` case in `buildDrizzleWhere`, matching this file's existing no-real-DB, `assert.ok(res !== undefined)` style.
- `apps/backend`: integration tests (`tsx --test`, Yoga + real local test Postgres DB, matching `resolvers.test.ts`'s established pattern — no msw, this is backend-side) for radius-filtering correctness, `NULL`-coordinate exclusion, auth/ownership error paths, and multi-location `or` support.
- No new E2E test in this story — no UI ships (Story 2.5 owns the E2E happy path for the user-facing nearby-events feature).

## Deliverables Checklist

- [ ] `TerminalOperator` extended with `"withinRadius"`; `resolveWithinRadiusConditions` (both the saved-location and ad-hoc-coordinate value shapes) and `validateRadiusKm` implemented and 100%-covered.
- [ ] `schedules.latitude`/`longitude` columns + `schedule_coordinates_idx` + `.$type<LocationDetails>()` annotation added; migration generated, backfill appended, applied locally.
- [ ] `buildDrizzleWhere` handles `withinRadius` (bounding-box + Haversine SQL) with a passing unit test.
- [ ] `Query.events` resolver wires `withinRadius` end-to-end: conditional auth, saved-location lookup, ad-hoc-coordinate pass-through, tree resolution, `scheduleCoordinates` fieldMap entry, error remapping — with passing integration tests covering AC1, AC1a, AC4, AC5, AC6.
- [ ] AD-1's field/operator documentation updated with `scheduleCoordinates`/`withinRadius`.
- [ ] `pnpm build`/`pnpm lint` clean at the repo root; no codegen re-run needed (confirmed, not assumed).

## Out of Scope

- Any frontend UI or query-building for the Discovery page's "nearby events" feature (saved-location picker, radius control, results display) — entirely Story 2.5's scope; this story only provides the backend operator it will consume.
- Deciding whether Story 2.5's Discovery radius control reuses the existing `Slider` component/pattern from `location-form-dialog.tsx`, or whether selecting a saved location pre-fills its configured default `UserLocation.radius` — flagged as a forward note (Dev Notes → Architecture & UX Gate Findings, Gate 2) for Story 2.5's own creation to explicitly decide; not a prerequisite blocking this story, and no new sprint-status/epics.md entry is needed since Story 2.5 already exists as a `backlog` story.
- PostGIS/`earthdistance` adoption — explicitly decided against for this story (Dev Notes → Design Decisions Confirmed With User); revisit only if a future story's needs (e.g. polygon/region queries) outgrow Haversine + bounding-box.
- Any Epic 3 push-notification proximity-filtering consumer of `withinRadius` — this story only ensures the DSL/resolver mechanism is general enough to support it later (AC5); no Epic 3 code is touched.
- Splitting `apps/backend/src/schema/resolvers.ts` into per-domain resolver files — remains monolithic as today; this story adds to it in place.

## Definition of Done

- [ ] AC1-AC6 (incl. AC1a) satisfied.
- [ ] Required tests passing: `packages/domain` (100% coverage), `packages/graphql-select` unit test, `apps/backend` integration tests.
- [ ] Lint and type checks passing for `packages/domain`, `packages/database`, `packages/graphql-select`, `apps/backend`.
- [ ] Migration applied cleanly against local dev Postgres; AD-1 documentation updated.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. Gate 1/3 cited from swept `epic-2-readiness.md` (`swept: true`; Story 2.5a listed in `stories_covered` as the already-identified resolution to that report's predecessor-run Gate 1 finding). Gate 2 run via a one-shot Freya-persona subagent dispatch (evidence inlined into the prompt rather than re-read from cold context, per token-efficiency guidance) — found zero in-scope UI gap (this story is backend-only) but surfaced a forward-looking interaction-design note for Story 2.5's own future creation (duplicate-radius-control question), recorded in Dev Notes rather than escalated as a blocking prerequisite, since no new story is needed (Story 2.5 already exists in the backlog).
- Two real design tradeoffs — (1) geo storage/distance-computation approach, (2) DSL support for multiple `locationPreferenceId`s in one query — were surfaced to and confirmed by the user via `AskUserQuestion` before drafting, per this project's guidance to not silently pick a side on non-mechanical tradeoffs. Both were resolved toward the recommended, more spec-faithful/portable option (see Dev Notes → Design Decisions Confirmed With User).
- A `.$type<LocationDetails>()` annotation gap on `schedules.locationDetails` (pre-existing, dormant, no prior story touched it) was found while reading the table this story's migration backfill reads from; judged mechanical (zero runtime behavior change) and fixed in-scope rather than escalated.

### Completion Notes List

### File List
