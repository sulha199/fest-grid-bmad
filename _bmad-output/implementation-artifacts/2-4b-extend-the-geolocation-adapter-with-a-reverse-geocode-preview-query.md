---
baseline_commit: df14928ce7f3c92bc4ef97a4eafeb42ed434ff47
---
# Story 2.4b: Extend the Geolocation adapter with a reverse-geocode preview query

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.4b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a new `previewLocation(latitude: Float!, longitude: Float!): LocationDetails!` GraphQL query that wraps Story 0.16's existing `resolveLocation` in its `{ kind: 'COORDINATES', coordinates }` mode without persisting anything,
so that Story 2.4's "Use my current location" and "Pick on map" flows can show the user the actual resolved, human-readable address before they commit to saving it, instead of only raw coordinates.

## Acceptance Criteria

1. **Given** Story 0.16's Geolocation adapter's `resolveLocation` already supports reverse-geocoding via a `{ kind: 'COORDINATES', coordinates }` query, **when** a client sends `previewLocation(latitude, longitude)`, **then** the resolver calls `resolveLocation` with that mode and returns the resulting `LocationDetails` (`formattedAddress`, `placeName`, `coordinates`, `provider`) — a pure read; no row is written to any feature table (Story 0.16's `geolocation_cache` table is still read/written as part of `resolveLocation`'s own cache-first behavior, which is not a feature-table write).
2. **And** the query is `requireAuth`-scoped (Story 0.17) — it throws `UNAUTHENTICATED` for an unauthenticated caller rather than gracefully degrading, matching the design precedent Story 2.3b already established for `addressAutocomplete` (a billed, quota-limited external-API-backed read, not a public query like `events`).
3. **And** the query is subject to the same GraphQL depth/complexity limits (Story 0.8, `graphql-armor`) as the rest of the schema — a flat, non-nested query with no new server configuration required; this AC confirms the existing global limits continue to cover it.
4. **And** repeated calls with the same coordinates reuse Story 0.16's existing Postgres-backed geolocation cache (`buildLocationCacheKey`'s `COORDINATES` branch rounds to 5 decimal places) — no duplicate Geoapify calls for the same coordinate pair within the cache's lifetime.
5. **And** the GraphQL `LocationDetails` type (declared in `events.graphql`, already consumed by `Schedule.locationDetails`) gains a `provider: GeolocationProvider` field (`enum GeolocationProvider { GEOAPIFY }`, mirroring `@festgrid/shared-types`'s existing `GeolocationProvider` union) — closing a pre-existing gap where the GraphQL type never exposed `provider` despite the TS `LocationDetails` shape having carried it since Story 0.16 AC8. Without this, AC1's requirement to return `provider` in the response is not satisfiable.
6. **And** the GraphQL `Coordinates` type (`{ lat: Float!, lng: Float! }`) resolves correctly when its parent object is the adapter's canonical `{ latitude, longitude }` shape (`@festgrid/shared-types`'s `Coordinates`) via an explicit field resolver — closing a pre-existing, previously-dormant type-shape mismatch (no resolver currently maps `latitude`/`longitude` to `lat`/`lng`; GraphQL's default resolver would return `null` for both non-nullable `Float!` fields and the query would fail). This resolver is generic to the `Coordinates` type, so it also fixes the identical latent mismatch on `Schedule.locationDetails.coordinates` (currently untested with real data — no ingestion code path populates that column yet).
7. **And** Story 2.4's own already-drafted `previewLocation` GraphQL operation document (`_bmad-output/implementation-artifacts/2-4-set-location-by-current-location-or-map.md`, Task 1) is corrected from `coordinates { latitude longitude }` to `coordinates { lat lng }` to match this story's finalized schema field names — mirroring the precedent set when Story 2.3b's finalized contract required aligning Story 2.3's own draft (see `git log`: "align Story 2.3 artifact with finalized 2.3b contract").

**[NEW 2026-08-06 — Sprint Change Proposal, `sprint-change-proposal-2026-08-06-map-picker-continuity.md`]**

8. **AC8 — `placeId` as a second, mutually-exclusive input mode:** `previewLocation`'s signature is extended to `previewLocation(latitude: Float, longitude: Float, placeId: String): LocationDetails!` — `latitude`/`longitude` are loosened from `Float!` to `Float` (optional), and a new optional `placeId: String` argument is added. Exactly one of `{latitude AND longitude}` or `{placeId}` must be supplied: neither present, or both forms present, throws `GraphQLError('BAD_REQUEST')` before any adapter call is made. This is purely additive for existing callers — Story 2.4's original `{ latitude, longitude }`-only usage (AC9/AC10 of that story) continues to work unchanged; only new `placeId`-only calls are new usage. This exists so Story 2.4's map-picker sheet can resolve an address-autocomplete suggestion's (`placeId`) coordinates client-side — to pan/center the map to it — the same way it already resolves a raw coordinate pair, without duplicating a second nearly-identical query.
9. **AC9 — `placeId` resolves via the adapter's existing `PLACE_ID` mode:** When `placeId` is supplied, the resolver calls `resolveLocation({ kind: 'PLACE_ID', placeId })` — the exact same adapter call Story 2.3b's `createUserLocation`/`updateUserLocation` `placeId` input-mode branch already makes (Story 2.3b AC6) — returning the same cache-backed `LocationDetails` shape (`formattedAddress`, `placeName`, `coordinates`, `provider`) as the `{latitude, longitude}` path. No new adapter capability is needed; this AC only wires an existing adapter mode to an existing query's schema.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced during Story 2.4's creation (2026-08-04). Story 2.4a's own Out-of-Scope note assigns "reverse-geocoding a clicked point into a human-readable address" to Story 2.4, but no existing GraphQL query exposes reverse-geocoding as a standalone read — only as a side effect of the `createUserLocation`/`updateUserLocation` mutations (Story 2.3a), which persist a row. Story 2.4 needs to preview the resolved address before the user commits to Save, presented to and confirmed by the user as the preferred option over a coordinates-only preview (2026-08-04). Classified as a single-story architecture split (needed only by Story 2.4 today), positioned immediately after Story 2.4a and before Story 2.5a. AC5-AC7 above were not in `epics.md`'s literal AC text — they were surfaced during this story's own creation as blocking data-type-compatibility gaps discovered by reading the real current schema (`events.graphql`) and Story 2.4's real draft file, not epics.md's abstract description; see Dev Notes → Data Type Compatibility & Migration Requirements.

**Depends on:** Story 0.16 (Geolocation adapter — `review`, fully implemented), Story 0.17 (GraphQL authenticated context layer — `review`, fully implemented). Unlike Story 2.3b, this story has **no dependency on Story 2.3a/2.3b** — `previewLocation` is a standalone read with no relationship to the saved-locations mutations or `user_locations` table.

## Tasks / Subtasks

- [x] Task 1: Add `previewLocation` query, `GeolocationProvider` enum, and `LocationDetails.provider` field to the GraphQL schema (AC1, AC5)
  - [x] Create `apps/backend/src/schema/geolocation.graphql`:
    ```graphql
    enum GeolocationProvider {
      GEOAPIFY
    }

    extend type LocationDetails {
      provider: GeolocationProvider
    }

    extend type Query {
      previewLocation(latitude: Float!, longitude: Float!): LocationDetails!
    }
    ```
  - [x] `extend type LocationDetails`/`extend type Query` against the base types already declared in `events.graphql` — mirrors that file's own `extend type Query` pattern; the base `type LocationDetails { coordinates placeName placeId formattedAddress timezone }` in `events.graphql` is not otherwise modified.
- [x] Task 2: Implement the `Query.previewLocation` resolver (AC1, AC2)
  - [x] In `apps/backend/src/schema/resolvers.ts`, add `previewLocation: async (_: any, { latitude, longitude }: any, context: any) => { ... }` to the `Query` object: call `requireAuth(context)` first (AC2, no try/catch degrade — mirrors `me`'s pattern, not `events`' tolerant pattern), then `return await resolveLocation({ kind: 'COORDINATES', coordinates: { latitude, longitude } });` (import `resolveLocation` from `../lib/geolocation/adapter.js`).
- [x] Task 3: Add the `Coordinates` field resolver (AC6)
  - [x] In `apps/backend/src/schema/resolvers.ts`, add a top-level `Coordinates` resolver object: `{ lat: (parent: any) => parent.lat ?? parent.latitude, lng: (parent: any) => parent.lng ?? parent.longitude }` — the `??` fallback keeps any future direct `{ lat, lng }`-shaped parent working unchanged while fixing the `{ latitude, longitude }`-shaped parent this story's `previewLocation` (and the pre-existing `Schedule.locationDetails.coordinates`) actually produce.
- [x] Task 4: Run codegen (AC1, AC5, AC6)
  - [x] Run `pnpm run codegen` at the repo root so `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` pick up the new SDL (`previewLocation`, `GeolocationProvider` enum, `LocationDetails.provider`).
- [x] Task 5: Integration tests (AC1, AC2, AC3, AC4, AC5, AC6)
  - [x] Create `apps/backend/src/schema/geolocation.test.ts`, mirroring `resolvers.test.ts`'s pattern (`createSchema`/`createYoga` against the real merged SDL — `events.graphql` + `geolocation.graphql` — with a mocked `mockUser` context var and a mocked global `fetch`, hitting the real local test Postgres DB for the `geolocation_cache` table, same as `adapter.test.ts`).
  - [x] Test: unauthenticated call to `previewLocation` throws `UNAUTHENTICATED` (AC2).
  - [x] Test: authenticated call with a mocked Geoapify reverse-geocode response returns `formattedAddress`, `placeName`, `coordinates { lat lng }` (mapped correctly from the mocked `lat`/`lon` response — proves AC6's resolver), and `provider: GEOAPIFY` (AC1, AC5, AC6).
  - [x] Test: two calls with the same coordinates only invoke the mocked `fetch` once — the second call is served from `geolocation_cache` (AC4), clearing the cache table between test cases (mirrors `adapter.test.ts`'s `t.afterEach`).
  - [x] Test: depth/complexity limits already cover this query with no story-specific test needed — confirmed by inspection of `server.ts`'s existing `EnvelopArmor` config (AC3), not a new test.
- [x] Task 6: Align Story 2.4's draft operation document with this story's finalized schema (AC7)
  - [x] In `_bmad-output/implementation-artifacts/2-4-set-location-by-current-location-or-map.md`, correct the `previewLocation` GraphQL operation document (currently `coordinates { latitude longitude }`) to `coordinates { lat lng }`, matching this story's real `Coordinates` field names — mirrors the precedent commit `chore(bmad): align Story 2.3 artifact with finalized 2.3b contract`.
- [x] Task 7: Manual verification — run the backend, exercise `previewLocation` via GraphiQL/`curl` against real coordinates with a real (or test) Geoapify key; confirm a second identical call is served from cache (check `geolocation_cache` row `updated_at` does not change); confirm `pnpm build`/`pnpm lint`/`pnpm run codegen` stay clean at the repo root.

**[NEW 2026-08-06 — Sprint Change Proposal, `sprint-change-proposal-2026-08-06-map-picker-continuity.md`]**

- [x] Task 8: Loosen `previewLocation`'s SDL to accept `placeId` as an alternative to `latitude`/`longitude` (AC8)
  - [x] In `apps/backend/src/schema/geolocation.graphql`, change `previewLocation(latitude: Float!, longitude: Float!): LocationDetails!` to `previewLocation(latitude: Float, longitude: Float, placeId: String): LocationDetails!`.
- [x] Task 9: Add mutual-exclusion validation and the `placeId` branch to the resolver (AC8, AC9)
  - [x] In `resolvers.ts`'s `previewLocation` resolver, after `requireAuth(context)`: if `placeId` is present together with `latitude`/`longitude`, or if none of `placeId`/`latitude`+`longitude` are present, throw `new GraphQLError('Exactly one of coordinates or placeId is required', { extensions: { code: 'BAD_REQUEST' } })` (mirrors `resolveLocationInputMode`'s error-shape precedent, kept as a small inline check local to this resolver rather than a `packages/domain` extraction — this two-branch check is resolver-specific wiring, not a portable business rule, the same reasoning already applied to Task 3's `Coordinates` field resolver and 2.4a's `LngLat`→`Coordinates` conversion).
  - [x] If `placeId` is present, call `resolveLocation({ kind: 'PLACE_ID', placeId })` instead of the existing `COORDINATES` branch.
- [x] Task 10: Run `pnpm run codegen` again so both `latitude`/`longitude` become optional and `placeId` appears in the generated `PreviewLocationQueryVariables` type on both `apps/backend` and `apps/web`.
- [x] Task 11: Extend integration tests (AC8, AC9)
  - [x] `placeId`-only call returns the mocked adapter's `LocationDetails` (asserting `resolveLocation` was called with `{ kind: 'PLACE_ID', placeId }`).
  - [x] `placeId` + `latitude`/`longitude` together → `BAD_REQUEST`.
  - [x] Neither `placeId` nor `latitude`/`longitude` → `BAD_REQUEST`.
  - [x] Existing `latitude`/`longitude`-only tests (Task 5) continue to pass unmodified — proving the loosened SDL is backward-compatible.

## Dev Notes

### Correct-Course Amendment — 2026-08-06 (Map Picker Continuity)

- **Origin:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06-map-picker-continuity.md`. Story 2.4's shipped "Pick on map" sheet needed to let users search for an address *inside* the map sheet (not just the separate outside Address field) and see the map pan to the selected suggestion. `addressAutocomplete` (Story 2.3b) only ever returns `{ placeId, description }` — no coordinates — so nothing on the frontend could resolve a selected suggestion to a point to pan the map to.
- **Why extend `previewLocation` rather than add a new query:** `previewLocation` already exists for exactly this purpose — "give me `LocationDetails` (including `coordinates`) for a location-identifying input" — for the coordinate-pair case. The adapter already supports resolving a `placeId` the same way (`resolveLocation({ kind: 'PLACE_ID', placeId })`, Story 2.3b AC6) — it's used server-side inside the saved-location mutations, just never exposed as a standalone read the way `previewLocation` exposes the coordinate case. Loosening `latitude`/`longitude` to optional and adding `placeId` is additive and backward-compatible (existing callers keep passing both, unaffected); a second, near-duplicate query would only fork test/maintenance surface for no benefit. This mirrors the same "don't duplicate, extend the existing single-purpose query" reasoning already used elsewhere in this project (e.g. Story 2.5a's AC1a broadening `withinRadius` in place rather than adding a sibling query).
- **Why amended in place, not split into a new story:** This story is `review`, not `done`, and the addition is narrowly scoped to a query this story already owns end-to-end (schema, resolver, tests) — it isn't a new capability with no existing home (contrast with this story's own origin, which *was* split from Story 2.4 because no query at all covered reverse-geocoding at the time).
- **What this story does *not* do:** decide when/whether the frontend calls `previewLocation` with `placeId` vs. `latitude`/`longitude` — that's Story 2.4's concern (its own amendment wires the map-sheet's embedded search to this new mode, while keeping its Confirm action always emitting a coordinate-mode selection, never a `placeId`, to preserve Story 2.3a's mutually-exclusive mutation-input contract at the point where the user actually saves).

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`; `2-4b` is not in `stories_covered` because, like `2.3b` and `2.4a`'s own addenda, it was split off *after* the epic-wide sweep ran, during Story 2.4's own creation). This story **is itself** the named resolution to that Gate 1 escape-hatch finding — Story 2.4's Dev Notes document the tradeoff (`previewLocation` query vs. coordinates-only preview) as already presented to and decided by the user (option (a), the recommended, spec-faithful choice) before this story existed. No further prerequisite split is needed; this story is the terminal fill for that gap.
- **Lightweight escape-hatch guard (no subagent, per Epic-Level Sweep Mode):** Reading the *real, current* schema (`apps/backend/src/schema/events.graphql`) and Story 2.4's *real* draft file (not just `epics.md`'s abstract AC text) surfaced two fresh, blocking gaps neither the epic-wide sweep nor Story 2.4's own creation anticipated: (1) the GraphQL `LocationDetails` type has no `provider` field despite the TS shape having one since Story 0.16 (AC5), and (2) the GraphQL `Coordinates` type's `lat`/`lng` field names don't match the adapter's internal `latitude`/`longitude` shape, and Story 2.4's own draft operation document used the *wrong* field names as a result (AC6, AC7). Both are fixed within this story's own scope (it is the story that owns and finalizes this exact contract) — not split into a further prerequisite, since no other story needs anything beyond what's fixed here.
- **Gate 2 (UI Complexity & Reusability):** This story has **zero UI surface** — pure backend adapter/GraphQL extension code, same category as Stories 2.1a, 2.3a, 2.3b, and 0.16. Performed as a direct check rather than a full Freya-persona subagent dispatch, mirroring Story 2.3b's and 0.16's identical precedent for an unambiguous zero-UI story. A grep of `design-artifacts/` for "preview"/"reverse geocod" found no hits — expected, since the actual address-preview UI (loading indicator, fallback-to-raw-coordinates behavior) belongs entirely to Story 2.4 (`ready-for-dev`), which consumes this story's `previewLocation` query. **Verdict: No gap found.**

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: two pre-existing, blocking gaps found and fixed by this story (not "no changes required" — see AC5-AC7).**
  1. **Missing `provider` field on the GraphQL `LocationDetails` type.** `packages/shared-types`'s TS `LocationDetails` interface has carried an optional `provider?: GeolocationProvider` field since Story 0.16 AC8, and the adapter's `resolveLocation` already populates it on every return path. But the GraphQL SDL type declared in `apps/backend/src/schema/events.graphql` (`type LocationDetails { coordinates placeName placeId formattedAddress timezone }`) never exposed it. `epics.md`'s AC1 for this story explicitly requires `previewLocation` to return `provider` — unsatisfiable without this fix. **Fix:** `apps/backend/src/schema/geolocation.graphql` adds `enum GeolocationProvider { GEOAPIFY }` (mirroring the TS union, and this project's existing enum-for-fixed-value-sets convention — `EventType`/`EventCategory`) and `extend type LocationDetails { provider: GeolocationProvider }` (Task 1).
  2. **`Coordinates` GraphQL type field names (`lat`/`lng`) don't match the adapter's internal shape (`latitude`/`longitude`).** Confirmed via three points: `packages/shared-types`'s `Coordinates` interface is `{ latitude, longitude }`; `events.graphql`'s GraphQL `Coordinates` type is `{ lat: Float!, lng: Float! }`; and the already-shipped frontend (`apps/web/src/features/events/mapper.ts`, `apps/web/src/features/events/queries.graphql`) already queries/destructures `{ lat, lng }` — confirming the GraphQL field names are the established, correct contract and must not be renamed (that would break shipped code). No resolver currently bridges the two shapes — `resolvers.ts` has no `Coordinates` entry — so GraphQL's default resolver would look for `parent.lat`/`parent.lng` on the adapter's `{ latitude, longitude }` object, find `undefined`, and fail on the non-nullable `Float!` constraint. This has been **dormant and untested with real data** until now: no code path writes `schedules.locationDetails` yet (confirmed via grep — the column has no producer), so `Schedule.locationDetails.coordinates` has never actually been queried against live data. This story is the first to make the mismatch live, because `previewLocation` returns a freshly-resolved `LocationDetails` object on every call. **Fix:** a generic `Coordinates` field resolver (`lat`/`lng`, falling back to `latitude`/`longitude`) added to `resolvers.ts` (Task 3) — fixes this story's own correctness requirement and, as a side effect, the pre-existing dormant `Schedule.locationDetails.coordinates` gap for whenever a future story starts populating that column.
  3. **Story 2.4's own draft operation document used the wrong field names.** Story 2.4 (`ready-for-dev`, not yet implemented) drafted its `previewLocation` GraphQL operation document *before* this story existed to finalize the real schema, guessing `coordinates { latitude longitude }` — which does not match the real `Coordinates` type (`lat`/`lng`, gap #2 above) and would fail `pnpm run codegen`/type-checking once both stories are implemented. **Fix:** Task 6 corrects that file's operation document directly, mirroring the established precedent of the `chore(bmad): align Story 2.3 artifact with finalized 2.3b contract` commit — a later, contract-finalizing story correcting an earlier-drafted consumer's assumptions.
- **Impacted contracts:** `apps/backend/src/schema/events.graphql` (base `LocationDetails`/`Coordinates` types — not modified in-place, extended via the new `geolocation.graphql` file); new `apps/backend/src/schema/geolocation.graphql`; `apps/backend/src/schema/resolvers.ts` (new `Query.previewLocation`, new `Coordinates` resolver); regenerated `apps/backend/src/generated/resolvers-types.ts`/`apps/web/src/generated/graphql.ts`; `_bmad-output/implementation-artifacts/2-4-set-location-by-current-location-or-map.md` (operation-document field-name correction, Task 6).
- **Required DB migration changes:** None. This story adds no new database table or column — `previewLocation` is a pure read that reuses Story 0.16's existing `geolocation_cache` table verbatim, exactly as `resolveLocation`'s `COORDINATES` mode already does for any other caller.
- **Required TypeScript type changes:** Additive only, entirely on the GraphQL SDL/generated-types side (`GeolocationProvider` enum, `LocationDetails.provider`, `Query.previewLocation`) — no change to `packages/shared-types` or `packages/domain` (both already have everything this story needs: `Coordinates`, `LocationDetails`, `GeolocationProvider`, `GeolocationQuery`'s `COORDINATES` variant).
- **Backward compatibility and rollout notes:** Purely additive to the GraphQL schema (`extend type` on two existing base types, one new query) — no existing field, query, or resolver behavior is removed or changed in an incompatible way. The `Coordinates` resolver's `??` fallback (`parent.lat ?? parent.latitude`) is deliberately backward-compatible with any future code that might construct a parent object using the GraphQL-native `{ lat, lng }` shape directly, not just the adapter's `{ latitude, longitude }` shape.
- **Verification checks:** Integration tests (Task 5) proving the `Coordinates` resolver maps correctly, `provider` is present and correctly typed against the `GeolocationProvider` enum, and the cache-reuse behavior (AC4) holds; a type-check (`pnpm build`) proving the extended SDL, codegen'd types, and Story 2.4's corrected operation document all agree once codegen is re-run.

### Architecture / technical constraints

- **AD-7 (Authenticated Context):** `previewLocation` calls `requireAuth(context)` first, same as every other authenticated-only operation (`me`, and the planned `myLocations`/`addressAutocomplete`) — never a client-supplied identity, no unauthenticated-tolerant degrade (AC2).
- **Adapter Pattern (`project-context.md`):** `previewLocation`'s resolver calls only `resolveLocation` from the existing Geolocation adapter (`apps/backend/src/lib/geolocation/adapter.ts`) — no direct Geoapify call, no new adapter function needed (unlike Story 2.3b's `getAddressPredictions`, this story needs no new adapter capability — `resolveLocation`'s `COORDINATES` mode already does exactly what's needed).
- **GraphQL abuse prevention (Story 0.8):** `previewLocation` is a flat, non-nested query returning a single object — no new depth/complexity beyond existing schema precedent; the server-wide `graphql-armor` configuration (`apps/backend/src/server.ts`) already covers it (AC3).
- **AD-1/AD-2 (Unified Query DSL / Unified Event Querying) do not bind this story** — `previewLocation` is not an event-collection query, matching Story 2.3a's `myLocations`/Story 2.3b's `addressAutocomplete` identical non-binding precedent.
- **AD-8 (Soft-Delete Convention) does not bind this story** — no table read/write of a soft-deletable entity occurs; the only table touched is `geolocation_cache` (Story 0.16), which is a pure cache table outside AD-8's list (`EventInfo`, `Favorite`, `CalendarEntry`, `Subscription`, `ApiKey`).
- **Package boundaries:** All new code lives in `apps/backend` (new `geolocation.graphql` SDL file, resolver additions in `resolvers.ts`). No `packages/domain` or `packages/database` changes — the only new "logic" (the `Coordinates` field resolver's `lat`/`lng` ↔ `latitude`/`longitude` mapping) is a single-line, dependency-free field accessor evaluated against `project-context.md`'s "reusable, framework-agnostic mechanism" bar and judged not to meet it (same reasoning Story 2.4a applied to its own trivial `LngLat`→`Coordinates` conversion) — it is GraphQL-resolver-specific wiring, not a portable business rule. No `apps/web` changes in this story itself (Story 2.4 consumes the query later; Task 6 only corrects that story's *draft artifact file*, not live frontend code).
- **AD-5 (Analytics) does not bind this story** — no user-facing interaction to instrument; fired later by Story 2.4 when it wires the actual preview UI.
- **AD-6 (i18n) does not bind this story** — no user-facing text ships from this story; `GraphQLError` messages (`UNAUTHENTICATED`) are developer-facing, translated by the frontend when displayed (Story 2.4's concern), mirroring Story 2.3b's identical precedent.
- **State Management / Loader categorization: not applicable** — backend-only, no UI renders any async state for this story.

### Previous/Sibling Story Intelligence (Stories 0.16, 0.17, 2.4a, 2.3b, 2.4)

- **Story 0.16 (Geolocation adapter) is `review` and fully implemented in code** — confirmed via direct file reads of `packages/domain/src/geolocation/{types,build-cache-key}.ts` and `apps/backend/src/lib/geolocation/{adapter,geoapify-client,cache-store}.ts`. `adapter.ts`'s `resolveLocation` already handles the `COORDINATES` case via `reverseGeocode`, and `buildLocationCacheKey`'s `COORDINATES` branch already rounds to 5 decimal places for stable cache keys — this story needs zero adapter-layer changes, only a thin resolver wrapping the existing public interface.
- **Story 0.17 (GraphQL authenticated context layer) is `review` and fully implemented** — `requireAuth`/`GraphQLContext` (`apps/backend/src/lib/auth/context.ts`) confirmed exactly as this story's Task 2 uses them; no changes needed there.
- **Story 2.4a (`ready-for-dev`, not yet implemented) confirms its own Out-of-Scope note assigning reverse-geocoding to Story 2.4** — this story (2.4b) is the backend capability Story 2.4 needs to fulfil that assignment; 2.4a itself is untouched by this story (no `packages/ui` changes here).
- **Story 2.3b (`ready-for-dev`, not yet implemented) is the closest technical analog** — both stories extend the Geolocation adapter's GraphQL surface with a `requireAuth`-scoped, billed-external-API-backed read query, subject to the same `graphql-armor` limits. Unlike 2.3b, this story needs **no new adapter function** (reuses `resolveLocation` as-is) and **no dependency on Story 2.3a** (no `user_locations` involvement at all) — a materially simpler, unblocked story.
- **Story 2.4 (`ready-for-dev`, not yet implemented, its own implementation artifact already exists) is this story's direct and only consumer** — its Task 1 already drafts the exact `previewLocation` operation document this story's schema must satisfy; confirmed (via direct read of that file) that its drafted `coordinates { latitude longitude }` sub-selection does not match this story's real `Coordinates` type field names, hence AC7/Task 6's correction.
- **`apps/backend/src/schema/resolvers.ts` is currently a single monolithic file** (not yet split by domain, despite `apps/backend/src/schema/*.graphql` already being split per-domain: `auth.graphql`, `events.graphql`, `favorites-and-calendar.graphql`) — confirmed via direct read. This story adds its resolver directly into the existing `resolvers.ts` object (new `Query.previewLocation` entry, new top-level `Coordinates` entry), following the file's current structure rather than introducing a new resolver-splitting convention unprompted by this story's own scope.

### Git Intelligence Summary

Recent commits (`df14928`, `6162884`, `94d87d4`, `d31165e`, `87223f7`) show: `6162884` (`chore(bmad): align Story 2.3 artifact with finalized 2.3b contract`) is the direct precedent this story's Task 6/AC7 follows — confirming this project's established practice of correcting an earlier-drafted consumer story once a later story finalizes the real contract it depends on. `d31165e` (`feat(geolocation): add Geoapify API configuration and instructions`) is Story 0.16's real, committed implementation this story builds on. No commit since the Geoapify swap has touched `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/schema/events.graphql`, or created any `geolocation.graphql`/`user-locations`-named schema file — confirming both this story's own scope and Story 2.3a/2.3b genuinely have not started implementation.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Security; Code Quality & Style Rules → Code Organization; Testing Rules; General Architecture → Adapter Pattern)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.4b, Story 0.16, Story 0.17, Story 2.4, Story 2.4a, Story 2.3b)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/5-geolocation.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `apps/backend/src/schema/geolocation.graphql` (`GeolocationProvider` enum, `extend type LocationDetails`, `extend type Query { previewLocation }`).
- Modified: `apps/backend/src/schema/resolvers.ts` (new `Query.previewLocation`, new `Coordinates` field resolver).
- New: `apps/backend/src/schema/geolocation.test.ts` (integration tests, Yoga + real test DB + mocked `fetch`).
- Modified: `_bmad-output/implementation-artifacts/2-4-set-location-by-current-location-or-map.md` (correct the drafted `previewLocation` operation document's `Coordinates` sub-selection field names).
- Regenerated (not hand-edited): `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (via `pnpm run codegen`).
- **Not modified:** `apps/backend/src/lib/geolocation/{adapter,geoapify-client,cache-store}.ts` (no adapter-layer changes needed — `resolveLocation`'s existing `COORDINATES` mode is reused as-is); `packages/domain`, `packages/database` (no new table/column, no new pure logic meeting the reusable-mechanism bar); any live `apps/web` code (Story 2.4's scope).

### Rule Mapping

- *Adapter Pattern* → `previewLocation` resolver calls only `resolveLocation`; no direct Geoapify call from the resolver (AC1).
- *AD-7* → `requireAuth` first in `previewLocation`; no client-supplied identity trusted (AC2).
- *GraphQL abuse prevention (Story 0.8)* → flat, non-nested query already covered by existing `graphql-armor` config (AC3).
- *Testing Rules* → integration tests for the new query's auth, mapping, and cache-reuse behavior (Task 5); no new `packages/domain` logic, so no 100%-coverage unit-test obligation is introduced by this story.
- *Story-split-gate Gate 1/2/3* → cited from swept `epic-2-readiness.md` (this story is itself the identified gap-fill); Gate 2 performed as a direct zero-UI check; a lightweight escape-hatch guard surfaced the `provider`/`Coordinates` field-name gaps fixed by AC5-AC7 (Dev Notes → Architecture & UX Gate Findings / Data Type Compatibility).
- *Cross-story contract alignment precedent* → Story 2.4's draft operation document corrected to match this story's finalized schema (Task 6/AC7), mirroring the `2.3`/`2.3b` alignment commit.

### Verification Plan

- `apps/backend`: integration tests (Task 5) — unauthenticated rejection; successful preview returning correctly-mapped `coordinates { lat lng }` and `provider`; cache-reuse (second identical call makes zero additional `fetch` calls).
- Manual: GraphiQL/`curl` smoke test of `previewLocation`; confirm a cached second call via `geolocation_cache` row inspection; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root, including Story 2.4's corrected operation document once that story exists in code.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: backend-only (`apps/backend/src/schema/`) plus a documentation-only correction to Story 2.4's own draft artifact file — no live frontend or `packages/domain`/`packages/ui` changes (Story 2.4 consumes this later).
- [ ] **No blocking dependency:** confirmed via `git ls-files`/direct reads that Story 0.16 and Story 0.17 (this story's only real dependencies) are fully implemented in code — unlike Story 2.3b, this story has no dependency on Story 2.3a/2.3b.
- [ ] **Data-type-compatibility fixes accepted:** adding `provider: GeolocationProvider` to the GraphQL `LocationDetails` type, adding a `Coordinates` field resolver (`lat`/`lng` ← `latitude`/`longitude`), and correcting Story 2.4's draft operation document field names — per Dev Notes → Data Type Compatibility & Migration Requirements, all three are required for this story's own AC1 to function correctly, not incidental scope additions.
- [ ] Architecture and data/API boundaries confirmed: all new code in `apps/backend`; no `packages/database` schema change; no `apps/web` source changes (only a sibling story's draft artifact file is corrected).
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (this story is itself the identified gap-fill, plus a lightweight escape-hatch guard surfacing the type-compatibility gaps); Gate 2 performed as a direct zero-UI check (no gap).
- [ ] Testing plan confirmed: `tsx --test` integration tests (Yoga + real test DB + mocked `fetch`) for the new query's auth/mapping/cache-reuse behavior.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `apps/backend`: integration tests (`tsx --test`, real local test Postgres DB for `geolocation_cache`, mocked global `fetch` — mirroring `resolvers.test.ts`/`adapter.test.ts`'s established pattern) for `previewLocation`: unauthenticated rejection (`UNAUTHENTICATED`); successful preview with correctly-mapped `coordinates`/`provider`; cache-reuse across two identical calls.
- No new `packages/domain` unit tests required — this story introduces no pure, portable logic meeting that package's reusable-mechanism bar.
- Manual: GraphiQL/`curl` smoke test; no E2E test in this story — no UI ships (Story 2.4 owns the E2E happy path for the preview flow).

## Deliverables Checklist

- [x] `GeolocationProvider` enum and `LocationDetails.provider` field added to the GraphQL schema (`geolocation.graphql`).
- [x] `previewLocation(latitude, longitude): LocationDetails!` query added to the GraphQL schema, `requireAuth`-scoped.
- [x] `Query.previewLocation` resolver implemented in `resolvers.ts`, wrapping `resolveLocation({ kind: 'COORDINATES', coordinates })`.
- [x] `Coordinates` field resolver (`lat`/`lng` ← `latitude`/`longitude`) added to `resolvers.ts`.
- [x] Integration tests written and passing; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.
- [x] Story 2.4's draft operation document corrected to use `coordinates { lat lng }`.

## Out of Scope

- Any frontend UI development — the address-preview loading indicator, resolved-address display, and coordinates-only fallback behavior on error (Story 2.4) — this story only provides the backend query it will consume.
- Any new Geolocation adapter function — `resolveLocation`'s existing `COORDINATES` mode already provides exactly what this story needs; no new `apps/backend/src/lib/geolocation/{adapter,geoapify-client}.ts` capability is added.
- Story 2.3a/2.3b's own scope (`myLocations`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation`, `addressAutocomplete`, the `location_details` column/migration) — this story has no relationship to `user_locations` at all.
- Splitting `apps/backend/src/schema/resolvers.ts` into per-domain resolver files — the file remains monolithic as it is today; this story adds to it in place rather than introducing an unprompted refactor.
- Any live `apps/web` code changes — Task 6 corrects only Story 2.4's *draft implementation-artifact file*, not shipped frontend source (none exists yet for Story 2.4).

## Definition of Done

- [x] AC1-AC7 satisfied.
- [x] Required tests passing (`apps/backend` integration tests for the new query and `Coordinates` resolver).
- [x] Lint and type checks passing for `apps/backend`.
- [x] Story 2.4's draft operation document corrected to match this story's finalized schema.

## Completion Status

- [x] Complete (ready for review)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. Gate 1/3 cited from swept `epic-2-readiness.md` (`swept: true`; `2-4b` not in `stories_covered` since it was split off after the sweep, during Story 2.4's own creation — this story is itself that split's resolution). Gate 2 performed as a direct zero-UI check (mirrors Story 0.16/2.3b's precedent) rather than a full Freya-persona subagent dispatch, given this story's unambiguous backend-only scope confirmed by both `epics.md`'s literal story text and a grep of `design-artifacts/` finding no preview/reverse-geocode UI spec.
- A lightweight escape-hatch guard (reading the real current `events.graphql` schema and Story 2.4's real draft file, rather than trusting `epics.md`'s abstract AC text alone) surfaced two blocking, previously-undocumented data-type-compatibility gaps — no GraphQL `provider` field on `LocationDetails`, and a `Coordinates` `lat`/`lng` vs. adapter `latitude`/`longitude` field-name mismatch with no bridging resolver — plus a resulting field-name error in Story 2.4's own draft operation document. All three were judged mechanical (single correct fix, no competing tradeoff — reusing already-shipped frontend field names, matching the project's existing enum convention, and following the established `2.3`/`2.3b` cross-story-alignment precedent) and were not escalated to the user via `AskUserQuestion`; they are documented in full in Dev Notes → Data Type Compatibility & Migration Requirements and folded directly into AC5-AC7.
- Confirmed via direct file reads that Story 0.16 and Story 0.17 (this story's only real dependencies) are fully implemented (`review` status, code present) — unlike Story 2.3b, this story has no blocking dependency on unimplemented sibling stories.

### Completion Notes List

- Implemented the `previewLocation` GraphQL query with authenticating logic requiring authentication.
- Added `Coordinates` field resolver supporting mapping of adapter coordinate fields `latitude`/`longitude` to `lat`/`lng` fields, fixing latent mismatch on `Schedule.locationDetails.coordinates`.
- Extended `LocationDetails` type definition to include `provider: GeolocationProvider` field.
- Ran successful schema-to-typescript codegen for both backend and web applications.
- Created robust integration tests under `apps/backend/src/schema/geolocation.test.ts` to test unauthenticated rejection, successful reverse-geocoding resolution, mapping behavior, and caching reuse.
- Verified that Story 2.4's draft operation document was already corrected and aligned.

### File List

- `apps/backend/src/schema/geolocation.graphql` (created)
- `apps/backend/src/schema/resolvers.ts` (modified)
- `apps/backend/src/schema/geolocation.test.ts` (created)
- `apps/backend/src/generated/resolvers-types.ts` (regenerated)
- `apps/web/src/generated/graphql.ts` (regenerated)
