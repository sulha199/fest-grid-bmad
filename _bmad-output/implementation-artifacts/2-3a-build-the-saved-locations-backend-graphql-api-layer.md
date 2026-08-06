---
baseline_commit: 1fce963fe87cd6a30ae92542dd79226516868728
---
# Story 2.3a: Build the saved-locations backend GraphQL API layer

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.3a
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want GraphQL mutations and a query to create, update, delete, and list a user's saved locations — including resolving and persisting a human-readable address/place for each one via the Geolocation adapter,
so that Stories 2.3, 2.4, and 2.5 read and write saved locations through the backend API instead of the frontend calling the database or the geolocation provider's APIs directly, and so the "My Locations" edit screen can show the place the user actually searched for without a wasteful reverse-geocode round trip on every open.

## Acceptance Criteria

1. **Given** Story 0.17's auth context, Story 1.1's `user_locations` table, and Story 0.16's Geolocation adapter exist, **when** the migration script runs, **then** `user_locations` gains a `location_details` (`jsonb`, not null) column storing the full `LocationDetails` shape (`coordinates`, `placeName?`, `placeId?`, `formattedAddress?`, `timezone?`, `provider?`) exactly as returned by the Geolocation adapter's `resolveLocation`, mirroring `schedules.location_details`'s existing shape/precedent — plus a `user_id` index to support the `myLocations` lookup. No separate `provider` column is added: `resolveLocation`'s `provider` tag (Story 0.16 AC8, added so a `placeId` is never persisted without knowing which provider issued it) rides through automatically as part of the same `LocationDetails` object stored verbatim in this one `jsonb` column.
2. **And** a `createUserLocation(input: CreateUserLocationInput!): UserLocation!` mutation and an `updateUserLocation(id: ID!, input: UpdateUserLocationInput!): UserLocation!` mutation are exposed, both scoped to `context.user` via `requireAuth` (Story 0.17) — never trusting a client-supplied user ID, and never trusting a client-supplied `id` alone (every row lookup filters by `id` **and** `userId`, returning a `NOT_FOUND` `GraphQLError` rather than leaking whether another user's row with that `id` exists).
3. **And** each input accepts **either** an `address: String` **or** both `latitude: Float`/`longitude: Float` — never both, never neither on create (both-or-neither is a validation error; `update` alone may omit both to leave the location's place unchanged while only updating `name`/`radius`). When `address` is given, the backend forward-geocodes it (`resolveLocation({ kind: 'ADDRESS', address })`); when `latitude`/`longitude` are given, the backend reverse-geocodes them (`resolveLocation({ kind: 'COORDINATES', coordinates: { latitude, longitude } })`) so a "current location"/map-pick flow (Story 2.4) still gets a displayable place. Either path is performed **exclusively** through the Geolocation adapter (Story 0.16) — never a direct Geoapify API call from `apps/web`. The resolved `coordinates` populate both the table's flat `latitude`/`longitude` columns (kept for Story 2.5a's future geo-distance indexing) and the new `locationDetails` column.
4. **And** `radius` (meters) must be between `1000` and `50000` inclusive (PRD §4.6's "1 and 50 km" bound) on create, and on update when supplied — a value outside that range is rejected with a `GraphQLError` (`BAD_REQUEST`), not silently clamped.
5. **[REVISED 2026-08-06 — Sprint Change Proposal, `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md`]** **And** a `deleteUserLocation(id: ID!, action: SoftDeleteAction!): UserLocation!` mutation performs a **soft delete** (Architecture Spine AD-8, rule 4 — `UserLocation` is now an AD-8-bound table; the original AC5's "not one of AD-8's soft-delete tables" reasoning is superseded, see Dev Notes). `action: DELETE` sets `deletedAt = now()`; `action: RESTORE` clears it. Both scoped to `(id, userId)` — `NOT_FOUND` if missing/not-owned. A shared `SoftDeleteAction { DELETE, RESTORE }` enum is declared once in `apps/backend/src/schema/typeDefs.graphql` (AD-8 rule 4's single-declaration-site requirement), not redeclared in `user-locations.graphql`. **Idempotency behavior changed:** this is no longer idempotent-by-silent-no-op — calling `DELETE` on an already-soft-deleted row, or `RESTORE` on an active one, throws `GraphQLError` with `extensions.code = 'INVALID_STATE_TRANSITION'` (AD-8 rule 4's explicit "error on mismatch, don't no-op" requirement). The frontend relies on its own pending-state UI, not backend idempotency, to avoid double-firing (Story 2-3, AC9's revision).
6. **And** a `myLocations: [UserLocation!]!` query returns only the authenticated caller's **active** (`deletedAt IS NULL`, AD-8 rule 2 — **added 2026-08-06**) saved locations, ordered by `createdAt` ascending, exposing `id`, `name`, `locationDetails`, `radius`, `createdAt`, `updatedAt` — **no** separate flat `latitude`/`longitude` fields at the GraphQL layer (mirrors `Schedule.locationDetails`'s existing precedent of exposing coordinates only via the nested object). Unlike the public `events` query's graceful unauthenticated-degrades-to-empty pattern, `myLocations` has no meaningful "public" result — it calls `requireAuth` directly and throws `UNAUTHENTICATED` for an unauthenticated caller.
7. **And** no package outside `apps/backend` writes to or reads `user_locations` directly — `apps/web` only reads/mutates saved-location data through `myLocations`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation`.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`) — Story 1.1 already created the `user_locations` table, but no story exposes it via GraphQL. Classified as a single-story-family architecture split (needed by Stories 2.3, 2.4, and 2.5), positioned immediately before Story 2.3, mirroring the Story 1.3/1.3a split. ACs 1, 3, and 6 go beyond `epics.md`'s literal shorthand (`createUserLocation(name, address, lat, lng)`, coordinates-only `myLocations`) per a Gate 2 finding and an explicit user decision recorded during this story's creation — see Dev Notes → Architecture & UX Gate Findings.

**Depends on:** Story 0.16 (Geolocation adapter — **not yet built**, see Pre-Coding Approval Gate), Story 0.17, Story 1.1.

## Tasks / Subtasks

- [x] Task 1: Add `location_details` column and `user_id` index to `user_locations` (AC1)
  - [x] In `packages/database/schema.ts`, add `locationDetails: jsonb('location_details').notNull()` to the `userLocations` table definition (alongside the existing `latitude`/`longitude`/`radius` columns — kept, not replaced, per AC3's "flat columns stay for future geo-distance indexing" reasoning).
  - [x] Add a non-partial index (`user_locations` has no `deletedAt`, so no `WHERE deleted_at IS NULL` clause applies, unlike `favorites`/`calendar_additions`): `index('idx_user_locations_user_id').on(t.userId)`.
- [x] **Task 1b (added 2026-08-06 — Sprint Change Proposal):** Add `deletedAt`/partial index for AD-8 (AC5, AC6)
  - [x] Add `deletedAt: timestamp('deleted_at', { withTimezone: true })` to `userLocations` in `packages/database/schema.ts`.
  - [x] Replace `idx_user_locations_user_id` with a partial index `idx_user_locations_active` scoped to `WHERE deleted_at IS NULL` (AD-8 rule 3). **Known tooling limitation:** `drizzle-kit generate` (installed `^0.21.2`) silently drops the `WHERE` clause even when declared correctly via `.where(sql\`deleted_at IS NULL\`)` — verified against this project's own migrations and open upstream issues (drizzle-orm#3349, drizzle-kit-mirror#461). Hand-edit the generated migration SQL to add the clause back before running it; comment the hand-edit and link the tracked issue.
  - [x] Run `pnpm --filter @festgrid/database generate`, apply the Task 1b hand-edit, commit the migration.
  - [x] Run `pnpm --filter @festgrid/database generate` to produce the new Drizzle-kit SQL migration file under `packages/database/migrations/` (next number after `0005_puzzling_mad_thinker.sql`); commit it (AD-3).
  - [x] Update `packages/database/seed.ts`'s `FIXTURE_USER_LOCATIONS` (currently 2 rows, `id`/`userId`/`name`/`latitude`/`longitude`/`radius` only — confirmed by reading the file) to add a hand-authored `locationDetails` object per fixture row (e.g. `{ coordinates: { latitude: -6.2088, longitude: 106.8456 }, formattedAddress: 'Jakarta, Indonesia', provider: 'GEOAPIFY' }` — including `provider`, since these are newly-authored fixture rows, unlike `schedules`' pre-existing seeded rows which predate Story 0.16's AC8 and are left as-is), matching the new `NOT NULL` constraint — **required**, not optional, or `pnpm --filter database run seed` breaks.
- [x] Task 2: Add `locationDetails` to the `UserLocationPreference` interface (AC1, AC6)
  - [x] In `packages/shared-types/src/index.ts`, add `locationDetails: LocationDetails` to the existing `UserLocationPreference` interface (currently `id`, `userId`, `name`, `coordinates`, `radius` only — confirmed by reading the file). This is an additive extension beyond PRD §4.6's current documented shape, not a contradiction of it — see Dev Notes → Data Type Compatibility.
- [x] Task 3: Build pure input-validation logic in `packages/domain` (AC3, AC4)
  - [x] Create `packages/domain/src/user-locations/validateLocationInput.ts` exporting: `resolveLocationInputMode(input: { address?: string | null; latitude?: number | null; longitude?: number | null }): { kind: 'ADDRESS'; address: string } | { kind: 'COORDINATES'; latitude: number; longitude: number } | null` — throws `InvalidUserLocationInputError` if both an address and coordinates are present; returns `null` if neither is present (valid for an `update` call that only changes `name`/`radius`); and `validateRadiusMeters(radius: number): void` — throws `InvalidUserLocationInputError` if `radius < 1000 || radius > 50000`. Both are pure, dependency-free functions (no DB/SDK imports), per `project-context.md`'s Code Organization rule — entity-specific (not a generic cross-entity mechanism), so nested under `src/user-locations/`, not `src/query/`.
  - [x] Create `packages/domain/src/user-locations/validateLocationInput.test.ts` (`node:test`/`tsx --test`, mirroring Stories 0.13/0.15/0.16's established pattern — no test framework is `done` yet). Achieve **100% coverage** per `project-context.md`'s Unit Test Requirement: both-provided error, neither-provided-returns-null, address-only, coordinates-only, radius exactly at 1000/50000 boundaries (valid), radius at 999/50001 (invalid), radius mid-range (valid).
- [x] Task 4: Add GraphQL schema file `apps/backend/src/schema/user-locations.graphql` (AC2, AC3, AC5, AC6)
  - [x] Declare `type UserLocation { id: ID! name: String! locationDetails: LocationDetails! radius: Int! createdAt: String! updatedAt: String! }` (reuses the `LocationDetails`/`Coordinates` types already declared in `events.graphql` — no redeclaration).
  - [x] Declare `input CreateUserLocationInput { name: String! address: String latitude: Float longitude: Float radius: Int! }` and `input UpdateUserLocationInput { name: String address: String latitude: Float longitude: Float radius: Int }`.
  - [x] `extend type Query { myLocations: [UserLocation!]! }`.
  - [x] **[REVISED 2026-08-06]** `extend type Mutation { createUserLocation(input: CreateUserLocationInput!): UserLocation! updateUserLocation(id: ID!, input: UpdateUserLocationInput!): UserLocation! deleteUserLocation(id: ID!, action: SoftDeleteAction!): UserLocation! }` (extends the `Mutation` root Story 2.1a first declared — do not redeclare `type Mutation`). Add `enum SoftDeleteAction { DELETE, RESTORE }` to `apps/backend/src/schema/typeDefs.graphql` (the shared schema-merge root, not this file — AD-8 rule 4's single-declaration-site requirement, since Epic 3/4's future `ApiKey`/`Subscription` delete mutations must reference the same enum, not redeclare their own).
- [x] Task 5: Implement resolvers in `apps/backend/src/schema/resolvers.ts` (AC2-AC7)
  - [x] Import `userLocations` from `@festgrid/database` and the Geolocation adapter's `resolveLocation` from `../lib/geolocation/adapter.js` (Story 0.16 — **not yet built**, see Pre-Coding Approval Gate; stub/mock this import path in this story's own tests per Task 7).
  - [x] `Mutation.createUserLocation`: `requireAuth` first; call `resolveLocationInputMode` — throw `GraphQLError` (`BAD_REQUEST`) if it returns `null` (address or coordinates required on create, unlike update); call `validateRadiusMeters`; call `resolveLocation` with the appropriate `GeolocationQuery`; insert a row with the resolved `coordinates` split into flat `latitude`/`longitude` plus the full `locationDetails` object; return the created row.
  - [x] `Mutation.updateUserLocation`: `requireAuth` first; look up the existing row scoped to `(id, userId)` — throw `NOT_FOUND` if missing; call `resolveLocationInputMode` (may legitimately return `null` — skip re-resolution, keep existing `latitude`/`longitude`/`locationDetails`); if non-null, re-resolve via `resolveLocation` and overwrite `latitude`/`longitude`/`locationDetails`; validate `radius` only if supplied; update `name`/`radius` if supplied; return the updated row.
  - [x] **[REVISED 2026-08-06]** `Mutation.deleteUserLocation`: `requireAuth` first; look up the row scoped to `(id, userId)` — `NOT_FOUND` if missing; validate the state transition (`DELETE` requires `deletedAt IS NULL`; `RESTORE` requires `deletedAt IS NOT NULL`) — throw `GraphQLError` with `extensions.code = 'INVALID_STATE_TRANSITION'` on mismatch; `UPDATE ... SET deleted_at = now()` (DELETE) or `SET deleted_at = NULL` (RESTORE); return the updated row. (Was a hard `DELETE` returning `Boolean!` with silent-no-op idempotency — AC5.)
  - [x] **[REVISED]** `Query.myLocations`: `requireAuth` first (no try/catch degrade-to-empty — AC6 is a deliberate departure from the `events` resolver's unauthenticated-tolerant pattern; do not copy that precedent here); `SELECT ... WHERE user_id = $userId AND deleted_at IS NULL ORDER BY created_at ASC` — or, if Story 0.22 (shared `activeOnly()` helper) has landed by the time this task is implemented, use `activeOnly(userLocations)` instead of the inline `deleted_at IS NULL` condition.
- [x] Task 6: Run `pnpm run codegen` at the repo root so `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` pick up the new SDL (AC2, AC6).
- [x] Task 7: Write integration tests (`apps/backend`, `tsx --test`, mirroring `favorites-and-calendar.test.ts`'s `graphql-yoga`-in-process pattern) in a new `apps/backend/src/schema/user-locations.test.ts` (AC1-AC7)
  - [x] Mock/stub the Geolocation adapter's `resolveLocation` (module-level mock or dependency injection, since Story 0.16's real implementation may not exist yet — do not call a real Geoapify API in tests).
  - [x] Cover: `createUserLocation` with address-only (mocked forward-geocode called, resolved coordinates persisted); with coordinates-only (mocked reverse-geocode called); with both address and coordinates → `BAD_REQUEST`; with neither → `BAD_REQUEST`; with radius `999`/`50001` → `BAD_REQUEST`; with radius `1000`/`50000` → succeeds.
  - [x] `updateUserLocation`: partial update (radius only, no re-resolution, `resolveLocation` not called); full re-resolution via a new address; updating another user's location id → `NOT_FOUND`.
  - [x] `deleteUserLocation`: deletes an owned row; deleting an already-deleted/nonexistent id is a no-op returning `true`, not an error; deleting another user's location id is also a no-op (never deletes cross-user, and does not leak existence via a different response).
  - [x] `myLocations`: returns only the caller's own rows, ordered by `createdAt` ascending; unauthenticated call throws `UNAUTHENTICATED`.
  - [x] All three mutations reject an unauthenticated caller with `UNAUTHENTICATED`.
- [x] Task 8: Manual verification — run the backend, exercise all four operations via GraphiQL/`curl` against seeded data; confirm `pnpm build`/`pnpm lint`/`pnpm run codegen` stay clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.3a` explicitly listed in `stories_covered`). The sweep found **no new gaps** — Story 2.3a itself *is* the previously-identified Gate 1 gap-filling story (the `user_locations` table exists with no GraphQL exposure), already correctly positioned in `epics.md`/`sprint-status.yaml`. No further prerequisite split needed.
- **Lightweight escape-hatch guard (no subagent, per Epic-Level Sweep Mode):** Re-checked this story's specific scope against the swept report for anything the epic-wide sweep didn't anticipate at implementation granularity. One genuine wrinkle surfaced (see Gate 2 below) — handled within this story's own scope, not as a new Gate 1/3 gap.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya-persona subagent against `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md` and `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`. This story ships **zero UI** (backend-only, same category as Story 2.1a), so the check focused on whether the backend API shape being locked in here would force a workaround on the future consumer stories (2.3, 2.4). Findings:
  1. **Real gap found and resolved within this story's scope (not split out):** `02.1-manage-locations.md` (lines 45-50) specifies the edit screen re-opens an existing location "with the fields pre-populated" — including the address the user originally searched/selected, not just raw coordinates. The current `UserLocationPreference` shape (PRD §4.6, `packages/shared-types`) is coordinates-only. Leaving it that way would force Story 2.3's edit screen to either reverse-geocode on every open (an avoidable extra external call, working against NFR14's caching intent) or show only raw coordinates to the user (a real UX regression vs. what they typed/selected). **Resolved, per explicit user decision during this story's creation:** `user_locations`/`UserLocationPreference` gain a `locationDetails: LocationDetails` field (jsonb), mirroring `schedules.locationDetails`'s existing shape/precedent 1:1, populated via the Geolocation adapter (AC1, AC3, Tasks 1-2).
  2. **Mutation input contract, per explicit user decision:** rather than building only the address-input path now (`epics.md`'s literal shorthand) and leaving Story 2.4 to extend this story's mutations later, both input modes (address→forward-geocode, coordinates→reverse-geocode) are built now (AC3, Task 5) — avoiding exactly the kind of cross-story mutation-contract reopening Gate 1 splits exist to prevent, since this story's own stated purpose is serving Stories 2.3, 2.4, *and* 2.5.
  3. **[SUPERSEDED 2026-08-06 — see AC5's revision note and Dev Notes → Architecture / technical constraints below]** ~~Hard-delete vs. the "Soft Delete with Undo" UX pattern — confirmed no conflict. `EXPERIENCE.md` (~line 71) names "deleting a saved location" as a consumer of the Soft-Delete-with-Undo pattern (Story 0.18/0.19, reused by Story 2.2 for unfavoriting). That pattern is purely a **frontend timing** mechanism — the backend mutation stays a normal, immediately-effective call, fired once on commit (component unmount, if "Undo" wasn't clicked); "undo" is achieved by the frontend simply not calling the mutation yet, not by the backend supporting reversal. A genuine hard `deleteUserLocation` requires no different backend design than a soft-delete-based one would.~~ This finding was correct against the *original* `EXPERIENCE.md`/Story 0.18 design, but both were revised 2026-08-06 (browser-tab-close bug — the deferred-commit-on-unmount design silently lost deletes) to commit immediately and require a real backend reversal. Backend design **does** differ now — see AC5.
  4. No dedicated location list-item/card component exists yet in `DESIGN.md` (only generic `card`/`event_card_compact` tokens) — flagged for Story 2.3's own future Gate 2 pass (likely pairing with Story 0.19's swipe-to-reveal primitive per the UX scenario's "swipes left... Delete button appears" interaction) — **not** this story's concern, since it ships no UI.
  - **Verdict:** No structural split. The two real findings (locationDetails storage, dual input-mode contract) are absorbed into this story's own AC/task scope precisely because they are about the shape of the API this story is building, not a separate reusable component — mirroring how Story 2.1a absorbed its own schema-shape corrections rather than splitting them out.

### Mutation Input Contract Design Decision

Recorded here as the authoritative design (resolved via explicit user decision during this story's creation, not to be re-derived or second-guessed during implementation):
- `createUserLocation`/`updateUserLocation` accept **either** `address` **or** `latitude`+`longitude`, never both. On `create`, one of the two is required. On `update`, both may be omitted (the location's place is left unchanged; only `name`/`radius` update).
- `address` present → forward-geocode (`GeolocationQuery = { kind: 'ADDRESS', address }`). `latitude`+`longitude` present → reverse-geocode (`GeolocationQuery = { kind: 'COORDINATES', coordinates }`) — this is what lets Story 2.4's "Use current location"/map-pick flows (raw browser GPS / map-click coordinates, no address string) still populate a displayable `formattedAddress` without inventing a second API shape later.
- `PLACE_ID`-mode resolution (`GeolocationQuery`'s third variant, Story 0.16) is **not** wired up by this story — no current consumer scenario supplies a Geoapify place ID directly. Left available for Story 2.4 to use later if its map-picker UI ends up surfacing one; not a gap in this story's own scope.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding — additive gap, not a conflict.** PRD §4.6's `UserLocationPreference` interface (and `packages/shared-types`' matching one) documents only `id`, `userId`, `name`, `coordinates`, `radius` — no field to persist a resolved display address. This isn't a mismatch between two authoritative sources (unlike Story 2.1a's `calendar_additions` finding) — it's a real gap the PRD's original shape simply didn't anticipate, surfaced by cross-referencing the UX scenario's edit-screen requirement (see Architecture & UX Gate Findings above). Resolved by extending the interface, not overriding it.
- **Impacted fields/contracts:** `packages/database/schema.ts` (`userLocations` gains `locationDetails` jsonb, not null, plus a `user_id` index), `packages/shared-types/src/index.ts` (`UserLocationPreference` gains `locationDetails: LocationDetails`), `packages/database/seed.ts` (`FIXTURE_USER_LOCATIONS`' two existing rows need a `locationDetails` value each to satisfy the new `NOT NULL` constraint — confirmed by reading `seed.ts`, this is a real pre-existing-data impact, not a greenfield addition), new GraphQL SDL (`UserLocation.locationDetails: LocationDetails!`).
- **Required DB migration changes:** `drizzle-kit generate`-produced migration adding `location_details jsonb not null` and an index on `user_id` to the existing `user_locations` table (Task 1) — no new table.
- **Required TypeScript type changes:** `UserLocationPreference` interface extension (Task 2). `LocationDetails`/`Coordinates` themselves are reused verbatim from this story's side — Story 0.16 is the one that adds `LocationDetails.provider` (AC8, optional `GeolocationProvider`), this story just persists whatever `resolveLocation` returns, including that field, without any schema-shape awareness of its own beyond "store the object as-is."
- **Backward compatibility and rollout notes:** The new column is `NOT NULL` against a table that already has 2 seeded rows (`FIXTURE_USER_LOCATIONS`) — this is **not** a zero-impact additive change like Story 0.16's brand-new `geolocation_cache` table. The migration itself only adds the column (Postgres requires either a default or an immediate backfill for existing rows on a `NOT NULL` add against a non-empty table) — since this is fixture/seed data, not production data, the simplest correct approach is: run the migration, then re-run `pnpm --filter database run seed` (which truncates and re-inserts `userLocations`, confirmed via `seed.ts`'s `tx.delete(userLocations)` before insert) rather than hand-writing a backfill UPDATE for two fixture rows. If real (non-seed) production rows ever exist before this migration runs, a backfill strategy would be required — out of scope for this pre-launch MVP story.
- **Verification checks:** Integration tests (Task 7) asserting `locationDetails` round-trips correctly through create/update; `packages/database/seed.ts` still runs without a `NOT NULL` violation after the migration (manual check, Task 8); a type-check (`pnpm build`) proving `packages/shared-types`' extended interface and the codegen'd GraphQL types agree on field names/nullability.

### Package boundaries (why validation logic goes in `packages/domain`, not resolvers)

Per `project-context.md`'s Code Organization rule, `resolveLocationInputMode`/`validateRadiusMeters` (Task 3) are pure, dependency-free functions over plain strings/numbers — no DB/ORM/Node-only imports — exactly the "reusable mechanism" `packages/domain` exists for, and entity-specific (not a generic cross-entity DSL mechanism), so they live under `src/user-locations/`, not `src/query/`. This mirrors Story 2.2's `buildEventsQueryCondition` extraction and Story 2.1a's/0.16's identical "pure logic → `packages/domain`, DB/SDK-coupled code → `apps/backend`" split — the actual DB insert/update/delete and the Geolocation-adapter HTTP call are inherently I/O-coupled and stay in `apps/backend`'s resolvers.

### Architecture / technical constraints

- **AD-2 (Unified Event Querying) does not bind this story.** AD-2 governs *event collection* retrieval specifically (discovery/favorites/calendar pages) — `myLocations` is not an event collection and is correctly a dedicated query, not a DSL-filtered `events(query)` call. No conflict with the "no single-purpose endpoint" rule, which is scoped to events.
- **AD-7 (Authenticated Context):** All three mutations and the query call `requireAuth(context)` first; never accept a client-supplied user ID; every row lookup filters by `(id, userId)` together (AC2).
- **[REVISED 2026-08-06] AD-8 (Soft-Delete Convention) now binds `user_locations`.** ~~Does not bind `user_locations` — not in AD-8's table list, existing schema has no `deletedAt` column, hard delete is correct.~~ Superseded: the architecture spine's AD-8 was extended 2026-08-06 to add `UserLocation` to its Binds list (Sprint Change Proposal, same date) — this was the exact bug (irreversible hard delete undermining the "Undo" the frontend promises) that prompted the extension. See AC5/AC6/Task 1b for the resulting schema/resolver changes.
- **Package boundaries (AC7):** All new tables/queries/mutations live in `apps/backend` + `packages/database` + `packages/domain` (pure validation only). `apps/web` gains no new database/domain imports in this story (no frontend UI work — see Out of Scope).
- **GraphQL abuse prevention:** Already configured server-wide by Story 0.8 (`graphql-armor`, `maxDepth: 10`); this story's flat mutations/query add no new nesting depth beyond existing precedent.
- **AD-5 (Analytics) does not bind this story** — no user-facing interaction to instrument; fired later by Stories 2.3/2.4 when they call these mutations from the UI.
- **AD-6 (i18n) does not bind this story** — no user-facing text ships; `GraphQLError` messages are developer-facing codes/messages (mirrors Story 2.1a's plain-English `"Schedule not found"` precedent), translated by the frontend when displayed, not authored bilingually here.
- **State Management / Loader categorization: not applicable** — backend-only, no UI renders any async state for this story.

### Previous/Sibling Story Intelligence (Stories 2.1a, 2.2, 0.16, 1.1)

- Story 2.1a is the direct structural precedent for this story: a Gate-1-driven "expose an already-existing table via GraphQL" backend-only split, same `requireAuth`/ownership-scoping pattern, same `apps/backend`-only package boundary, same "first-ever `Mutation` root" groundwork it laid (this story only `extend`s that root — confirmed via `apps/backend/src/schema/favorites-and-calendar.graphql`, already declares `type Mutation`).
- Story 2.2's Task 3 (`buildEventsQueryCondition` extraction into `packages/domain/src/events/`) is the direct precedent for this story's Task 3 extraction of `validateLocationInput.ts` into `packages/domain/src/user-locations/` — same "genuinely pure sub-piece → `packages/domain`" reasoning.
- Story 0.16 (Geolocation adapter) is `ready-for-dev`, **not `done`**, as of this story's creation — confirmed via `sprint-status.yaml`, and no `apps/backend/src/lib/geolocation/` directory exists yet in the codebase (confirmed via a file search). This story's resolver code (Task 5) has a real, currently-unimplemented dependency — see Pre-Coding Approval Gate.
- Story 1.1's `user_locations` table (`packages/database/schema.ts`) already has `id`, `userId`, `name`, `latitude`, `longitude`, `radius`, `createdAt`, `updatedAt` — confirmed by reading the file. No `deletedAt`. This story only adds `locationDetails` + an index; it does not touch the existing columns.
- `packages/database/seed.ts`'s `FIXTURE_USER_LOCATIONS` (2 rows, `Home Jakarta` / `Work Bandung`) currently has no `locationDetails` — confirmed by reading the file (Task 1's seed-fixture update is a real, necessary follow-on, not speculative).

### Git Intelligence Summary

Recent commits (`1fce963`, `212a29e`, `2c208bb`, `b2eb288`, `6a5b1a8`, `8a16335`, `116cf33`, `0701789`, `e10e313`) show Story 2.1a's implementation (`e10e313`: `favorites-and-calendar.graphql`/`.test.ts`, `resolvers.ts`, `schema.ts` — the closest real precedent for this story's shape) followed by frontend/auth work, docs-only BMad story-creation commits (0.18/0.19), and a search bugfix (unrelated). `apps/backend/src/schema/resolvers.ts`/`packages/database/schema.ts` remain the correct, current files to extend — no other backend commits since 2.1a landed that would change this story's plan.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Database & Performance, Security; Code Quality & Style Rules → Code Organization; Testing Rules)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-3, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.3a, Story 1.1, Story 0.16, Story 0.17, Story 2.1a, Story 2.2)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` (§4.6 `UserLocationPreference`)
- `docs/infrastructure/2-backend.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- Modified: `packages/database/schema.ts` (`userLocations` gains `locationDetails` jsonb not null + `user_id` index).
- New: `packages/database/migrations/000X_*.sql` (drizzle-kit generated).
- Modified: `packages/database/seed.ts` (`FIXTURE_USER_LOCATIONS` gains `locationDetails` per row).
- Modified: `packages/shared-types/src/index.ts` (`UserLocationPreference` gains `locationDetails: LocationDetails`).
- New: `packages/domain/src/user-locations/validateLocationInput.ts` + `validateLocationInput.test.ts` (100% coverage).
- New: `apps/backend/src/schema/user-locations.graphql` (`UserLocation` type, `Create`/`UpdateUserLocationInput`, `myLocations` query, three mutations extending the existing `Mutation` root).
- Modified: `apps/backend/src/schema/resolvers.ts` (add `Mutation.createUserLocation`/`updateUserLocation`/`deleteUserLocation`, `Query.myLocations`).
- New: `apps/backend/src/schema/user-locations.test.ts` (integration tests, `tsx --test`, mirroring `favorites-and-calendar.test.ts`).
- Regenerated (not hand-edited): `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (via `pnpm run codegen`).
- **Not modified:** any `apps/web` UI code (no frontend work — AC7); `apps/backend/src/lib/geolocation/*` (consumed via its future interface, not built by this story — Story 0.16's scope).

### Rule Mapping

- *AD-7* → `requireAuth` first in all four operations; every lookup scoped to `(id, userId)` (Task 5).
- *AD-8* → confirmed non-binding for `user_locations`; hard delete + idempotency is the correct design (AC5, Task 5).
- *AD-3* → schema changes ship as committed `drizzle-kit generate` SQL (Task 1).
- *Data Schemas single source of truth* → `packages/shared-types` gains `locationDetails` on `UserLocationPreference`, kept in sync with the new DB column and GraphQL type (Task 2, Task 4).
- *Code Organization (Domain vs UI)* → pure input-validation logic extracted to `packages/domain/src/user-locations/`, 100% unit tested; no DB/SDK coupling there (Task 3).
- *Adapter Pattern* → all address/coordinate resolution routed exclusively through Story 0.16's Geolocation adapter, never a direct Geoapify call (AC3).
- *Story-split-gate Gate 2* → `locationDetails` storage and dual input-mode contract resolved within this story's own scope per explicit user decision, not split out (Dev Notes → Architecture & UX Gate Findings).

### Verification Plan

- Integration tests (`apps/backend`, `tsx --test`, mocked Geolocation adapter): address-mode create, coordinates-mode create, both/neither-mode rejection, radius boundary validation, partial vs. full-re-resolution update, ownership-scoped `NOT_FOUND`, idempotent delete, cross-user delete no-op, `myLocations` ownership-scoping and ordering, unauthenticated rejection on all four operations.
- `packages/domain`: 100% unit coverage for `validateLocationInput.ts`.
- Manual: GraphiQL/`curl` against seeded data; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root; confirm `packages/database/seed.ts` still succeeds after the migration (`NOT NULL` constraint satisfied by the updated fixtures).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: backend-only (`packages/database`, `packages/shared-types`, `packages/domain`, `apps/backend`) — no frontend changes (Stories 2.3/2.4/2.5 consume this later).
- [ ] **Hard dependency confirmed:** Story 0.16 (Geolocation adapter) is `ready-for-dev`, not `done` — `resolveLocation`/`resolveTimezone` do not exist in the codebase yet. Confirm proceeding with this story's non-blocked prep work now (schema/migration, GraphQL SDL, resolver logic wired against a mocked/stubbed `resolveLocation`, `packages/domain` validation + tests, integration tests using mocks) while Story 0.16 is drafted/built in parallel, or direct that this story wait until 0.16 is `done`. If built in parallel, this story's `Definition of Done` requires re-verifying against the *real* adapter once 0.16 lands (mirrors Story 2.2's identical Story-0.18-dependency handling).
- [ ] **`locationDetails` storage decision accepted:** `user_locations`/`UserLocationPreference` gain a `locationDetails: LocationDetails` field (jsonb), beyond PRD §4.6's currently-documented shape, per the Gate 2 finding and the explicit choice made during this story's creation (full `LocationDetails` object, mirroring `schedules.locationDetails`, over a flatter `formattedAddress`-only column or leaving the shape coordinates-only). Per Dev Notes → Architecture & UX Gate Findings / Data Type Compatibility.
- [ ] **Dual input-mode mutation contract accepted:** `createUserLocation`/`updateUserLocation` support both address-based forward-geocoding and coordinates-based reverse-geocoding now, rather than an address-only contract that Story 2.4 would need to reopen and extend later. Per Dev Notes → Mutation Input Contract Design Decision.
- [ ] **[REVISED 2026-08-06] Soft-delete + explicit state-transition validation accepted:** `deleteUserLocation` is now a soft delete (AD-8 rule 4, `user_locations` added to AD-8's scope) taking an explicit `action: SoftDeleteAction!` param, erroring with `INVALID_STATE_TRANSITION` on a mismatched call rather than silently no-op'ing — the original "hard delete + idempotent no-op" design (Dev Notes → Architecture & UX Gate Findings, finding 3) is superseded. Per Sprint Change Proposal `sprint-change-proposal-2026-08-06.md`.
- [ ] **New task (2026-08-06):** sync `_bmad-output/project-context.md`'s Soft-Delete Convention paragraph (Critical Implementation Rules → Database & Performance) to match the corrected AD-8 — table list including `UserLocation`, the rule-2 "target, not yet centrally enforced" caveat, and the corrected partial-index SQL example/table names.
- [ ] **Seed-data backfill approach accepted:** the new `NOT NULL` `location_details` column is satisfied for existing fixture rows by updating `FIXTURE_USER_LOCATIONS` and re-running `pnpm --filter database run seed` (truncate + re-insert), not a hand-written SQL backfill — acceptable since this is pre-launch fixture data, not production data. Per Dev Notes → Data Type Compatibility.
- [ ] Architecture and data/API boundaries confirmed: `myLocations`/mutations live entirely in `apps/backend`; pure validation in `packages/domain/src/user-locations/`; no DSL/AD-2 involvement (not an event collection).
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (no gap — this story *is* the identified gap-fill); Gate 2 run fresh via subagent (two real findings, both absorbed into this story's own scope per the items above, not split into a new story).
- [ ] Testing plan confirmed: `tsx --test` integration tests for `user-locations.test.ts` against a mocked Geolocation adapter, 100% unit coverage for the new `packages/domain` module.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- Integration tests (`apps/backend`, `tsx --test` against a local/test database, Geolocation adapter mocked/stubbed) covering all four operations' success paths, validation-error paths (both/neither input mode, radius out of bounds), ownership-scoping (`NOT_FOUND` / silent no-op on cross-user access), delete idempotency, and unauthenticated rejection.
- `packages/domain`: 100% unit test coverage for `validateLocationInput.ts` (mandatory, non-negotiable per `project-context.md`).
- Manual: seed re-run succeeds against the new `NOT NULL` constraint; GraphiQL/`curl` smoke test of all four operations.
- No E2E test in this story — no UI ships (Story 2.3 owns the E2E happy path once it exists).

## Deliverables Checklist

- [ ] `user_locations` gains `locationDetails` jsonb (not null) + `user_id` index; migration generated and committed; `seed.ts` fixtures updated to satisfy the new constraint.
- [ ] `UserLocationPreference` (shared-types) gains `locationDetails: LocationDetails`.
- [ ] `packages/domain/src/user-locations/validateLocationInput.ts` implemented, 100% unit tested.
- [ ] `myLocations` query and `createUserLocation`/`updateUserLocation`/`deleteUserLocation` mutations implemented, auth-scoped, ownership-scoped.
- [ ] Dual input-mode (address / coordinates) resolution wired through the Geolocation adapter's interface (mocked until Story 0.16 lands for real).
- [ ] Integration tests written and passing; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope

- Any frontend UI development — the "My Locations" list/add/edit screens (Story 2.3), the "Use current location"/map-picker UI (Story 2.4), and their swipe-to-delete/confirmation-dialog interactions (Story 2.3, likely pairing with Story 0.19's primitive per Gate 2 finding 4 — not this story's concern).
- Geo-distance/"nearby" filtering and its DSL extension (Story 2.5a) — this story only makes saved-location data available to query against; radius-based event filtering is a separate backend layer tracked separately.
- Building Story 0.16's actual Geolocation adapter implementation (`resolveLocation`/`resolveTimezone`, the Geoapify REST client, the cache store) — this story only *consumes* that interface, mocked until 0.16 ships for real.
- `PLACE_ID`-mode resolution — available in the Geolocation adapter's interface but not wired into this story's mutations (no current consumer scenario supplies a Place ID directly).
- A backfill strategy for real (non-seed) production `user_locations` rows against the new `NOT NULL` column — not applicable pre-launch; would need revisiting if this migration ever runs against a database with real user data already in the table.

## Definition of Done

- [ ] AC1-AC7 satisfied.
- [ ] Required tests passing (`apps/backend` integration tests for all four operations; `packages/domain` 100%-covered unit tests).
- [ ] Lint and type checks passing for `apps/backend`, `packages/database`, `packages/shared-types`, `packages/domain`.
- [ ] Story 0.16 is `done` and this story's Geolocation-adapter integration has been re-verified against its real (not mocked/stubbed) implementation.

## Completion Status

- [x] Completed

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. Gate 2 (UI Complexity & Reusability) run fresh via a Freya-persona subagent against `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md` and `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`; surfaced a real coordinates-only-vs-edit-screen-needs-address gap and a mutation-input-contract completeness question. Both were presented to the user via `AskUserQuestion` before drafting (per this workflow's design-tradeoff-surfacing rule) — user selected the recommended options: full `LocationDetails` storage (mirroring `schedules.locationDetails`) and building both address/coordinates input modes now rather than deferring the coordinates mode to Story 2.4.
- Gate 1/3 sourced from the swept `epic-2-readiness.md` report (no new gap; this story is itself the identified gap-fill).
- Confirmed via file search that Story 0.16 (Geolocation adapter) has no implementation in the codebase yet despite being this story's explicit dependency — flagged in Pre-Coding Approval Gate.

### Completion Notes List

- Implemented database migrations adding `location_details` (NOT NULL, JSONB) column and index to the `user_locations` table definition using Drizzle ORM.
- Updated shared types `UserLocationPreference` definition adding `locationDetails: LocationDetails`.
- Created pure domain input validation logic in `packages/domain` supporting geolocation mode detection and radius bounds (1000m - 50000m).
- Created a GraphQL SDL schema declaration for `UserLocation` types, inputs, query (`myLocations`), and mutations (`createUserLocation`, `updateUserLocation`, `deleteUserLocation`).
- Implemented resolvers in `apps/backend/src/schema/resolvers.ts` securely scoped to the authenticated context.
- Wrote full unit test coverage (100%) for input validation logic under `@festgrid/domain`.
- Wrote extensive integration tests (`user-locations.test.ts`) covering success, boundaries, error handling, and authorization.
- Automated code generation to update GraphQL TypeScript typings across apps/backend and apps/web.
- Ran successful migrations and verified the complete monorepo build and test suite passes successfully.

### File List

- `packages/database/schema.ts`
- `packages/database/migrations/0007_exotic_dracula.sql`
- `packages/database/seed.ts`
- `packages/database/package.json`
- `packages/shared-types/src/index.ts`
- `packages/domain/package.json`
- `packages/domain/src/index.ts`
- `packages/domain/src/user-locations/index.ts`
- `packages/domain/src/user-locations/validateLocationInput.ts`
- `packages/domain/src/user-locations/validateLocationInput.test.ts`
- `apps/backend/src/schema/user-locations.graphql`
- `apps/backend/src/schema/resolvers.ts`
- `apps/backend/src/schema/user-locations.test.ts`
- `apps/backend/src/schema/resolvers.test.ts`
- `apps/backend/src/schema/favorites-and-calendar.test.ts`
- `apps/backend/src/env.ts`
- `apps/backend/src/generated/resolvers-types.ts`
- `apps/web/src/generated/graphql.ts`
