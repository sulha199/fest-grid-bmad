---
baseline_commit: 94d87d4be32711f0ce433a82207955e97fd1a5c3
---
# Story 2.3b: Extend the Geolocation adapter and saved-locations API with address autocomplete support

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.3b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the Geolocation adapter and the saved-locations GraphQL API extended with an address-autocomplete/predictions capability and a place-ID-based location input mode,
so that Story 2.3's "My Locations" add/edit form can offer a live typeahead search-and-select experience instead of a single blind geocode call on a raw address string.

## Acceptance Criteria

1. **Given** Story 0.16's Geolocation adapter exists but exposes no predictions/autocomplete capability, **when** a client needs address suggestions for partial input, **then** a new adapter method `getAddressPredictions(input: string): Promise<AddressPrediction[]>` (`apps/backend/src/lib/geolocation/adapter.ts`) wraps Geoapify's Geocoding Autocomplete endpoint (`GET https://api.geoapify.com/v1/geocode/autocomplete`), returning candidate `{ placeId, description }` pairs, exclusively through this adapter — never a direct Geoapify call from `apps/web`.
2. **And** per an explicit user decision during this story's creation, `getAddressPredictions` enforces a backend-owned minimum-input-length guard: if `input.trim().length` is below `MIN_AUTOCOMPLETE_INPUT_LENGTH` (`3`), the adapter returns `[]` immediately without calling Geoapify at all — a quota-cost guardrail that holds regardless of whatever debounce behavior Story 2.3's frontend implements, mirroring this project's existing "don't trust the frontend alone for cost-sensitive limits" posture (c.f. GraphQL depth/complexity limits, Story 0.8). This is a graceful empty result, not a `GraphQLError` — a short in-progress typed string is a normal, expected typeahead state, not a client error.
3. **And** per an explicit user decision during this story's creation, `getAddressPredictions` results are **never cached** — unlike `resolveLocation`'s cache-first behavior (Story 0.16, `geolocation_cache` table), every call at/above the minimum length is a live pass-through to Geoapify. Autocomplete queries are structurally different from the single-location lookups `geolocation_cache` was built for: each keystroke produces a distinct partial-text query with near-zero cross-user repeat-hit likelihood, so caching them would only pollute the cache table with junk entries. The existing `geolocation_cache` table/`cache-store.ts` are untouched by this story; the eventual `getPlaceDetails` call for whichever suggestion the user selects (AC6) still benefits fully from Story 0.16's existing cache.
4. **And** a new `addressAutocomplete(input: String!): [AddressSuggestion!]!` GraphQL query (`apps/backend/src/schema/user-locations.graphql`) exposes this capability to the frontend, `requireAuth`-scoped (Story 0.17) — this fronts a billed, quota-limited external API, unlike the public `events` query, so it throws `UNAUTHENTICATED` for an unauthenticated caller rather than gracefully degrading (mirrors `myLocations`' identical precedent, Story 2.3a AC6 — not the `events` resolver's tolerant pattern).
5. **And** `CreateUserLocationInput`/`UpdateUserLocationInput` (Story 2.3a) gain an optional `placeId: String` field as a third, mutually-exclusive input mode alongside the existing `address`/`latitude`+`longitude` modes. `packages/domain/src/user-locations/validateLocationInput.ts`'s `resolveLocationInputMode` (Story 2.3a) is extended to recognize `placeId` as a third branch: throws `InvalidUserLocationInputError` if more than one of `address` / `latitude`+`longitude` / `placeId` is present; on `create`, exactly one of the three is required (all-absent is still a `BAD_REQUEST`, per Story 2.3a AC3); on `update`, all three may still be omitted to leave the location's place unchanged.
6. **And** when `placeId` is supplied, it resolves to full `LocationDetails` via the Geolocation adapter's already-built-but-previously-unused `PLACE_ID` `GeolocationQuery` variant (`resolveLocation({ kind: 'PLACE_ID', placeId })` → `getPlaceDetails`) — **not** a redundant re-geocode of the selected suggestion's `description` text. This path is cache-backed via Story 0.16's existing `geolocation_cache` infrastructure (distinct from AC3's autocomplete-predictions-are-never-cached rule, which applies only to `getAddressPredictions`, not `getPlaceDetails`).
7. **And** `LocationDetails.provider` tagging (Story 0.16 AC8) applies transparently to the `placeId` input mode with no special-casing: a `user_locations` row created/updated via `placeId` carries `provider: 'GEOAPIFY'` in its persisted `locationDetails`, identically to the existing `address`/`coordinates` modes, since all three modes converge on the same `resolveLocation` call.
8. **And** the `addressAutocomplete` query is subject to the same GraphQL depth/complexity limits (Story 0.8, `graphql-armor`, already configured server-wide) as the rest of the schema, given it fronts a paid, quota-limited external API — no new server configuration is needed; this AC confirms the existing global limits continue to cover the new query, not a story-specific addition.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`) — Story 2.3's own creation surfaced a genuine, user-directed decision to build live address-autocomplete/typeahead (rather than a plain single-geocode text field), which needs backend capability neither Story 0.16's adapter nor Story 2.3a's mutations expose (no predictions/autocomplete method, no `placeId` input mode wired to GraphQL). Classified as a single-story architecture split (needed only by Story 2.3 today), positioned immediately after Story 2.3a and before Story 2.3, mirroring the Story 1.3/1.3a/1.3b split. The caching and minimum-input-length behavior (AC2, AC3) were not specified in `epics.md`'s literal ACs and were resolved via explicit user decisions during this story's creation — see Dev Notes → Architecture & UX Gate Findings.

**Depends on:** Story 0.16 (Geolocation adapter — `review`/built), Story 2.3a (saved-locations backend GraphQL API layer — `ready-for-dev`, **not yet implemented in code**, see Pre-Coding Approval Gate).

## Tasks / Subtasks

- [x] Task 1: Add `AddressPrediction` type to `packages/domain` (AC1)
  - [x] In `packages/domain/src/geolocation/types.ts` (alongside the existing `GeolocationQuery` union), add `export type AddressPrediction = { placeId: string; description: string };` — co-located with `GeolocationQuery` rather than `@festgrid/shared-types`, since like `GeolocationQuery` this is a backend-adapter-internal request/response shape, not a widely-shared entity type consumed across DB/GraphQL/frontend the way `Coordinates`/`LocationDetails` are.
- [x] Task 2: Build the pure minimum-input-length guard in `packages/domain` (AC2)
  - [x] Create `packages/domain/src/geolocation/validate-autocomplete-input.ts` exporting `export const MIN_AUTOCOMPLETE_INPUT_LENGTH = 3;` and `export function meetsAutocompleteInputThreshold(input: string): boolean` — returns `input.trim().length >= MIN_AUTOCOMPLETE_INPUT_LENGTH`. Pure, dependency-free (no DB/SDK imports), per `project-context.md`'s Code Organization rule.
  - [x] Create `packages/domain/src/geolocation/validate-autocomplete-input.test.ts` (`node:test`/`tsx --test`, mirroring `build-cache-key.test.ts`'s established pattern for this package). Achieve **100% coverage** per `project-context.md`'s Unit Test Requirement: below threshold (`""`, `"a"`, `"ab"`), at threshold (`"abc"`), above threshold, and whitespace-padded input that is only long enough after trimming (`"  ab  "` → too short) vs. before trimming (`"  abc  "` → valid).
  - [x] Update `packages/domain/src/geolocation/index.ts` to also `export * from './validate-autocomplete-input.js';` (mirrors the file's existing `export * from './types.js'` / `./build-cache-key.js` pattern).
- [x] Task 3: Add `getAddressPredictions` to the Geoapify REST client wrapper (AC1)
  - [x] In `apps/backend/src/lib/geolocation/geoapify-client.ts`, add `export async function getAddressPredictions(input: string): Promise<AddressPrediction[]>` — calls `GET https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(input)}&format=json&limit=5&apiKey={apiKey}` (same `format=json`/`apiKey` conventions as `geocodeAddress`/`reverseGeocode`; `limit=5` caps suggestion-list size, matching typeahead UX conventions), maps each `results[]` entry's `{ place_id, formatted }` into `{ placeId: place_id, description: formatted }`. Unlike `geocodeAddress`/`reverseGeocode`/`getPlaceDetails`, an empty `results` array is a normal, expected "no suggestions yet" outcome for a typeahead — return `[]`, do **not** throw `GeolocationNotFoundError` (that error type is reserved for a definitive single-location lookup miss, not an in-progress partial-text search).
  - [x] Extend `apps/backend/src/lib/geolocation/geoapify-client.test.ts` (`node:test`/`tsx --test`, mocked global `fetch`, no real network calls) with: a successful multi-result response maps correctly to `AddressPrediction[]`; an empty `results` array returns `[]` (not a thrown error); a non-2xx HTTP response still throws `GeolocationApiError` (consistent with the other three functions).
- [x] Task 4: Add `getAddressPredictions` to the Adapter's public interface (AC1, AC2, AC3)
  - [x] In `apps/backend/src/lib/geolocation/adapter.ts`, add `export async function getAddressPredictions(input: string): Promise<AddressPrediction[]>` (import `meetsAutocompleteInputThreshold` from `@festgrid/domain/geolocation`) — if the threshold guard fails, return `[]` immediately (no `geoapify-client` call, AC2); otherwise call `geoapify-client`'s `getAddressPredictions(input)` directly and return its result **without** any `cache-store.ts` read/write (AC3 — this is the one Adapter function that intentionally bypasses the cache-first pattern `resolveLocation` uses).
  - [x] Extend `apps/backend/src/lib/geolocation/adapter.test.ts` (`node:test`/`tsx --test`, `geoapify-client`/`cache-store` swapped for module-mocked fakes) with: input below the threshold never calls the mocked `geoapify-client.getAddressPredictions` and returns `[]`; input at/above the threshold calls it and returns its mapped result; `cache-store`'s `getCached`/`setCached` mocks are asserted **not called** for this function (proving AC3's no-caching rule, distinct from `resolveLocation`'s existing cache-hit/cache-miss test coverage).
- [x] Task 5: Extend `resolveLocationInputMode` to a third `placeId` mode (AC5) — **depends on Story 2.3a's `packages/domain/src/user-locations/validateLocationInput.ts` existing; see Pre-Coding Approval Gate**
  - [x] Extend `resolveLocationInputMode(input: { address?: string | null; latitude?: number | null; longitude?: number | null; placeId?: string | null }): { kind: 'ADDRESS'; address: string } | { kind: 'COORDINATES'; latitude: number; longitude: number } | { kind: 'PLACE_ID'; placeId: string } | null` — throws `InvalidUserLocationInputError` if more than one of the three modes is present (address, coordinates-pair, placeId); returns `null` if none are present (valid for an `update` call that only changes `name`/`radius`).
  - [x] Extend `validateLocationInput.test.ts` with the new `placeId`-only case, and each pairwise both-provided combination now involving `placeId` (`address`+`placeId`, `coordinates`+`placeId`, all three) throwing `InvalidUserLocationInputError` — maintaining the file's existing 100% coverage requirement.
- [x] Task 6: Add `AddressSuggestion` GraphQL type and `addressAutocomplete` query; extend the two mutation input types (AC1, AC4, AC5)
  - [x] In `apps/backend/src/schema/user-locations.graphql` (Story 2.3a — see Pre-Coding Approval Gate if not yet created), declare `type AddressSuggestion { placeId: String! description: String! }`.
  - [x] `extend type Query { addressAutocomplete(input: String!): [AddressSuggestion!]! }`.
  - [x] Add `placeId: String` to both `CreateUserLocationInput` and `UpdateUserLocationInput`.
- [x] Task 7: Implement the `addressAutocomplete` resolver and extend the three mutation resolvers (AC4, AC5, AC6, AC7)
  - [x] `Query.addressAutocomplete`: `requireAuth` first (no try/catch degrade-to-empty, mirrors `myLocations`' AC6 precedent — AC4); call the adapter's `getAddressPredictions(input)`; return the result directly (already the `AddressSuggestion` shape).
  - [x] `Mutation.createUserLocation`/`updateUserLocation` (Story 2.3a): update the call site to pass `placeId` into `resolveLocationInputMode`; when the resolved mode is `{ kind: 'PLACE_ID', placeId }`, call `resolveLocation({ kind: 'PLACE_ID', placeId })` (AC6) — same downstream handling as the existing `ADDRESS`/`COORDINATES` branches (populate flat `latitude`/`longitude` plus the full `locationDetails` object, AC7).
- [x] Task 8: Run `pnpm run codegen` at the repo root so `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` pick up the new SDL (AC4, AC6).
- [x] Task 9: Write/extend integration tests in `apps/backend/src/schema/user-locations.test.ts` (Story 2.3a — see Pre-Coding Approval Gate if not yet created) (AC4, AC5, AC6, AC7)
  - [x] Mock/stub the Geolocation adapter's `getAddressPredictions` and `resolveLocation` (module-level mock or dependency injection — no real Geoapify call in tests).
  - [x] `addressAutocomplete`: returns the mocked adapter's mapped suggestions; unauthenticated call throws `UNAUTHENTICATED`.
  - [x] `createUserLocation`/`updateUserLocation` with `placeId` only (mocked `resolveLocation` called with `{ kind: 'PLACE_ID', placeId }`, resolved coordinates/locationDetails persisted); with `placeId` **and** `address` → `BAD_REQUEST`; with `placeId` **and** `latitude`/`longitude` → `BAD_REQUEST`; with all three → `BAD_REQUEST`.
- [x] Task 10: Manual verification — run the backend, exercise `addressAutocomplete` and the `placeId`-mode mutations via GraphiQL/`curl` against seeded data; confirm `pnpm build`/`pnpm lint`/`pnpm run codegen` stay clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.3b` explicitly listed in `stories_covered`). The report's "Addendum (post-sweep, added during Story 2.3's creation)" confirms this story *is itself* the Gate 1 gap-fill the sweep could not have anticipated (autocomplete/typeahead was a user-directed decision made during Story 2.3's own creation, after the epic-wide sweep ran) — no further prerequisite split needed; this story is the terminal fill for that gap.
- **Lightweight escape-hatch guard (no subagent, per Epic-Level Sweep Mode):** Re-checked this story's specific scope against the swept report for anything not anticipated at implementation granularity. No new external service, data entity, or infra dependency beyond what's already covered (Geoapify is an existing established provider, Story 0.16; auth context is Story 0.17, already established) — no fresh Gate 1/3 gap surfaced.
- **Gate 2 (UI Complexity & Reusability):** This story has **zero UI surface** — pure backend adapter/GraphQL extension code, same category as Stories 2.1a, 2.3a, and 0.16. Performed as a direct check rather than a full Freya-persona subagent dispatch, mirroring Story 0.16's identical precedent for an unambiguous zero-UI story. A grep of `design-artifacts/` for "autocomplete"/"typeahead"/"suggest"/"predict" found no hits describing a "My Locations" autocomplete UI (the only autocomplete-related UX artifact found, `03.3-adding-a-subscription.md`, describes an unrelated social-account-ID autocomplete in Epic 3) — expected, since this UI decision was made during Story 2.3's own creation, after the WDS scenario docs for "My Locations" (`02.1-manage-locations.md`) were authored. The actual typeahead input UI, debounce behavior, and suggestion-list rendering belong entirely to Story 2.3 (`ready-for-dev`), which consumes this story's `addressAutocomplete` query and `placeId` mutation field — **not** this story's concern. **Verdict: No gap found.**
- **Autocomplete caching decision (explicit user decision during this story's creation):** Presented as a real architectural tradeoff (reuse `geolocation_cache` vs. no caching) since NFR14/Story 0.16's cache was designed around single stable location lookups, not high-cardinality partial-text keystroke queries. User selected **no caching** (AC3) — the recommended option, avoiding cache-table pollution from queries with near-zero repeat-hit likelihood.
- **Minimum-input-length guard decision (explicit user decision during this story's creation):** Presented as a real tradeoff (backend-enforced minimum vs. relying solely on Story 2.3's frontend debounce) given `addressAutocomplete` fronts a billed, quota-limited API callable on every keystroke. User selected **enforcing a backend minimum** (AC2, 3 characters) — the recommended option, holding regardless of whatever frontend debounce Story 2.3 implements.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story adds no new database table or column. `AddressPrediction`/`AddressSuggestion` are transient, non-persisted request/response shapes (never written to `user_locations` or any other table) — only the eventual `placeId`-resolved `LocationDetails` object is persisted, and it reuses Story 2.3a's already-planned `location_details` jsonb column verbatim (the same column every input mode writes to), so no schema evolution is needed beyond what Story 2.3a itself already specifies.
- **Impacted contracts:** `packages/domain/src/geolocation/types.ts` (new `AddressPrediction` type), new `packages/domain/src/geolocation/validate-autocomplete-input.ts`, `apps/backend/src/lib/geolocation/{geoapify-client,adapter}.ts` (new exported function each), new GraphQL SDL (`AddressSuggestion` type, `addressAutocomplete` query, `placeId` field on both mutation input types), `packages/domain/src/user-locations/validateLocationInput.ts` (Story 2.3a — extended `resolveLocationInputMode` return-type union).
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** Additive only — `AddressPrediction` (new), `resolveLocationInputMode`'s return union gains a `{ kind: 'PLACE_ID'; placeId: string }` member (Story 2.3a's existing two-member union is extended, not replaced — a backward-compatible additive change to a function this story's own dependency introduces).
- **Backward compatibility and rollout notes:** Purely additive. No existing row, table, or previously-shipped GraphQL field is modified or removed. `LocationDetails.provider` (Story 0.16 AC8) already flows through `resolveLocation` regardless of `GeolocationQuery.kind`, so the `PLACE_ID` path needs no special-case handling to stay compliant with that existing rule (AC7).
- **Verification checks:** `packages/domain`'s 100%-covered unit tests for `meetsAutocompleteInputThreshold` and the extended `resolveLocationInputMode`; `apps/backend` integration/unit tests proving `getAddressPredictions`' threshold-guard and no-cache behavior, and the three-way mutual-exclusivity validation on the mutations; a type-check (`pnpm build`) proving the extended GraphQL SDL, codegen'd types, and `packages/domain`'s union type all agree.

### Architecture / technical constraints

- **AD-7 (Authenticated Context):** `addressAutocomplete` calls `requireAuth(context)` first, same as every other saved-locations operation — never a client-supplied user ID, and no unauthenticated-tolerant degrade (AC4).
- **Adapter Pattern (project-context.md):** `getAddressPredictions` is exposed exclusively through the Geolocation adapter (`apps/backend/src/lib/geolocation/adapter.ts`) — `apps/web` never calls Geoapify's autocomplete endpoint directly (AC1), consistent with Story 0.16's existing `resolveLocation` precedent.
- **GraphQL abuse prevention (Story 0.8):** `addressAutocomplete` is a flat, non-nested query returning a bounded list (`limit=5` at the Geoapify-client level) — no new depth/complexity beyond existing schema precedent; the server-wide `graphql-armor` configuration already covers it (AC8).
- **AD-1/AD-2 (Unified Query DSL / Unified Event Querying) do not bind this story** — `addressAutocomplete` is not an event collection query; same non-binding reasoning Story 2.3a already established for `myLocations`.
- **AD-8 (Soft-Delete Convention) does not bind this story** — no table read/write of any kind occurs in the new autocomplete path; the `placeId` mutation path writes to `user_locations`, which (per Story 2.3a's Dev Notes) is already confirmed outside AD-8's table list.
- **Package boundaries:** All new code lives in `apps/backend` (adapter/client/resolvers/SDL) and `packages/domain` (pure `AddressPrediction` type, pure `meetsAutocompleteInputThreshold` guard, extended pure `resolveLocationInputMode`). `apps/web` gains no new database/domain imports in this story (no frontend UI work — see Out of Scope), consistent with Story 2.3a's identical package-boundary precedent.
- **AD-5 (Analytics) does not bind this story** — no user-facing interaction to instrument directly; fired later by Story 2.3 when it wires the actual typeahead UI.
- **AD-6 (i18n) does not bind this story** — no user-facing text ships; `GraphQLError` messages (`UNAUTHENTICATED`, `InvalidUserLocationInputError`-derived `BAD_REQUEST`) are developer-facing, translated by the frontend when displayed, mirroring Story 2.3a's identical precedent.
- **State Management / Loader categorization: not applicable** — backend-only, no UI renders any async state for this story.

### Previous/Sibling Story Intelligence (Stories 0.16, 2.3a)

- **Story 0.16 (Geolocation adapter) is `review` and fully implemented in code** — confirmed via direct file reads of `packages/domain/src/geolocation/{types,build-cache-key}.ts` and `apps/backend/src/lib/geolocation/{adapter,geoapify-client,cache-store}.ts`. `geoapify-client.ts` already has the exact endpoint/response-mapping conventions (`format=json`, `apiKey` query param, `results[]`/`features[]` parsing) this story's `getAddressPredictions` follows. `adapter.ts` currently exports only `resolveLocation` — this story is the first to extend the Adapter's public surface beyond that single function, which Story 0.16's own Dev Notes described as "the only interface any feature code may call" at the time (that framing anticipated exactly this kind of clean, additive extension, not a restriction against ever adding a second function).
- **Story 2.3a (saved-locations backend GraphQL API layer) is `ready-for-dev`, NOT `done` — and has NO implementation in the codebase yet.** Confirmed via `git ls-files`/grep: no `apps/backend/src/schema/user-locations.graphql`, no `user-locations.test.ts`, no `packages/domain/src/user-locations/` directory, and no `createUserLocation`/`myLocations`/etc. references anywhere in `apps/backend/src`. This is a materially harder dependency situation than Story 2.3a itself faced with Story 0.16 (which, while also not-yet-built at 2.3a's creation time, at least had a committed, real target interface to mock against) — this story's Tasks 5-7 describe *modifications* to files that do not exist yet. See Pre-Coding Approval Gate.
- **`packages/database/schema.ts`'s `userLocations` table currently has no `locationDetails` column** — confirmed by reading the file; Story 2.3a's own Task 1 is what adds it. This story does not touch `packages/database/schema.ts` directly at all (no new column/table of its own — see Data Type Compatibility).
- **`packages/shared-types/src/index.ts` already has `Coordinates`, `LocationDetails` (with `provider?: GeolocationProvider`, Story 0.16 AC8), and `GeolocationProvider = 'GEOAPIFY'`** — confirmed by reading the file; this story reuses all three as-is, adding no new `shared-types` exports (`AddressPrediction` is `packages/domain`-local, not `shared-types` — see Task 1's rationale).

### Git Intelligence Summary

Recent commits (`94d87d4`, `d31165e`, `87223f7`, `39f40ad`, `e7e1781`) show the Geoapify provider swap landing (`d31165e`: `feat(geolocation): add Geoapify API configuration and instructions` — Story 0.16's real implementation, confirmed clean/committed via `git status` on `apps/backend/src/lib/geolocation/` and `packages/domain/src/geolocation/`), followed by epics.md additions for Stories 2.1b/2.4a (`87223f7`) and a docs-only story-2.1b artifact commit (`94d87d4`) — no commits since the Geoapify swap have touched `apps/backend/src/schema/resolvers.ts`, `packages/database/schema.ts`, or created any `user-locations`-named file, confirming Story 2.3a genuinely has not started implementation.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Security; Code Quality & Style Rules → Code Organization; Testing Rules; General Architecture → Adapter Pattern)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.3b, Story 0.16, Story 2.3a, Story 2.3)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/5-geolocation.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- Modified: `packages/domain/src/geolocation/types.ts` (new `AddressPrediction` type).
- New: `packages/domain/src/geolocation/validate-autocomplete-input.ts` + `validate-autocomplete-input.test.ts` (100% coverage).
- Modified: `packages/domain/src/geolocation/index.ts` (re-export the new module).
- Modified: `apps/backend/src/lib/geolocation/geoapify-client.ts` (new `getAddressPredictions` function) + `geoapify-client.test.ts`.
- Modified: `apps/backend/src/lib/geolocation/adapter.ts` (new `getAddressPredictions` function — threshold-guarded, uncached) + `adapter.test.ts`.
- Modified (once Story 2.3a lands — see Pre-Coding Approval Gate): `packages/domain/src/user-locations/validateLocationInput.ts` + its test file (`placeId` as a third input mode), `apps/backend/src/schema/user-locations.graphql` (`AddressSuggestion` type, `addressAutocomplete` query, `placeId` on both mutation inputs), `apps/backend/src/schema/resolvers.ts` (`Query.addressAutocomplete`, `placeId` branch in `createUserLocation`/`updateUserLocation`), `apps/backend/src/schema/user-locations.test.ts`.
- Regenerated (not hand-edited): `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (via `pnpm run codegen`).
- **Not modified:** any `apps/web` UI code (no frontend work); `packages/database/schema.ts` (no new table/column); `apps/backend/src/lib/geolocation/cache-store.ts` (no changes — `getAddressPredictions` deliberately bypasses it).

### Rule Mapping

- *Adapter Pattern* → `getAddressPredictions` exposed exclusively through the Geolocation adapter; `apps/web` never calls Geoapify directly (AC1).
- *AD-7* → `requireAuth` first in `addressAutocomplete`; no client-supplied identity trusted (AC4).
- *Code Organization (Domain vs UI)* → `AddressPrediction` type, `meetsAutocompleteInputThreshold`, and the extended `resolveLocationInputMode` are pure, dependency-free logic in `packages/domain`; all I/O-coupled code (HTTP call, resolver wiring) stays in `apps/backend` (Tasks 1-2, 5).
- *Testing Rules* → 100% unit coverage for all new/extended `packages/domain` logic (Tasks 2, 5); integration tests for the new query and extended mutations (Task 9).
- *Story-split-gate Gate 1/2/3* → cited from swept `epic-2-readiness.md` and this story's own direct Gate 2 zero-UI check; no new prerequisite story needed (Dev Notes → Architecture & UX Gate Findings).

### Verification Plan

- `packages/domain`: 100% unit coverage for `validate-autocomplete-input.ts` and the extended `validateLocationInput.test.ts` (Story 2.3a's file, once it exists).
- `apps/backend`: unit tests for `geoapify-client.ts`'s new function (mocked `fetch`) and `adapter.ts`'s new function (mocked `geoapify-client`/`cache-store`, asserting the cache is never touched); integration tests for `addressAutocomplete` and the `placeId` mutation paths (mocked adapter, once `user-locations.test.ts` exists).
- Manual: GraphiQL/`curl` smoke test of `addressAutocomplete` and a `placeId`-mode `createUserLocation`; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: backend-only (`packages/domain`, `apps/backend`) — no frontend changes (Story 2.3 consumes this later).
- [ ] **Hard dependency confirmed — Story 2.3a has no implementation in the codebase yet** (confirmed via `git ls-files`/grep: no `user-locations.graphql`, no `packages/domain/src/user-locations/`, no matching resolver code). This story's Tasks 1-4 (adapter/client/domain autocomplete additions) have **no dependency on Story 2.3a** and can be implemented and merged independently right now. Tasks 5-7 (`placeId` input mode, mutation resolver wiring, `user-locations.graphql`/`.test.ts` extensions) **require Story 2.3a's files to exist first**. Two options: (a) implement Tasks 1-4 now, defer Tasks 5-7 until Story 2.3a is `done`; or (b) implement Story 2.3a and this story's Tasks 5-7 together in one combined pass. Confirm which approach before starting Tasks 5-7 — do not attempt to "extend" files that don't exist by inventing Story 2.3a's own schema/resolver shape as a side effect of this story (that would silently absorb Story 2.3a's own scope, the exact failure mode `story-split-gate.md` exists to prevent).
- [ ] **Autocomplete caching decision accepted:** `getAddressPredictions` is never cached (no `geolocation_cache`/`cache-store.ts` involvement) — per Dev Notes → Architecture & UX Gate Findings, explicit user decision.
- [ ] **Minimum-input-length guard accepted:** `MIN_AUTOCOMPLETE_INPUT_LENGTH = 3`, enforced backend-side in the Adapter (not just relying on frontend debounce) — per Dev Notes → Architecture & UX Gate Findings, explicit user decision.
- [ ] Architecture and data/API boundaries confirmed: all new code in `packages/domain` (pure) and `apps/backend` (adapter/resolvers); no `packages/database` schema change; no `apps/web` changes.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (this story is itself the identified gap-fill, no further split); Gate 2 performed as a direct zero-UI check (no gap).
- [ ] Testing plan confirmed: `tsx --test` unit tests for `packages/domain` (100% coverage) and `apps/backend` (mocked `fetch`/adapter dependencies); integration tests for the GraphQL layer once Story 2.3a's test file exists.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/domain`: 100% unit test coverage for `validate-autocomplete-input.ts` (mandatory, non-negotiable per `project-context.md`) and the extended `resolveLocationInputMode` cases in Story 2.3a's `validateLocationInput.test.ts`.
- `apps/backend`: unit tests (`tsx --test`, mocked `fetch`) for `geoapify-client.ts`'s `getAddressPredictions`; unit tests (mocked `geoapify-client`/`cache-store`) for `adapter.ts`'s `getAddressPredictions`, explicitly asserting no cache read/write occurs.
- `apps/backend`: integration tests (`tsx --test`, mocked Geolocation adapter) for `addressAutocomplete` (success, unauthenticated rejection) and the `placeId` mutation input mode (success, and all pairwise-both-provided rejection combinations) — once Story 2.3a's `user-locations.test.ts` exists.
- Manual: GraphiQL/`curl` smoke test; no E2E test in this story — no UI ships (Story 2.3 owns the E2E happy path).

## Deliverables Checklist

- [ ] `AddressPrediction` type added to `packages/domain/src/geolocation/types.ts`.
- [ ] `meetsAutocompleteInputThreshold` implemented, 100% unit tested.
- [ ] `getAddressPredictions` implemented in `geoapify-client.ts` (raw Geoapify call) and `adapter.ts` (threshold-guarded, uncached public interface), both unit tested.
- [ ] `resolveLocationInputMode` (Story 2.3a) extended to a third `placeId` mode, 100% unit tested.
- [ ] `AddressSuggestion` GraphQL type, `addressAutocomplete` query, and `placeId` field on both mutation input types added.
- [ ] `Query.addressAutocomplete` and the `placeId` branch of `createUserLocation`/`updateUserLocation` resolvers implemented.
- [ ] Integration tests written and passing; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope

- Any frontend UI development — the actual typeahead input, suggestion-list rendering, debounce behavior, and selection-to-form-field wiring on the "My Locations" add/edit screen (Story 2.3) — this story only provides the backend query/mutation-input surface it will consume.
- Building Story 2.3a's own scope (the base `myLocations`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation` operations, the `location_details` column/migration, the `address`/`coordinates` input modes) — this story only extends that surface with `placeId`/autocomplete; if Story 2.3a is not yet `done` when this story is implemented, its own scope must be built first or in the same pass (see Pre-Coding Approval Gate), not reinvented here.
- Any caching mechanism for autocomplete predictions — explicitly rejected per this story's own AC3/Dev Notes decision, not deferred, not a gap.
- Rate-limiting/throttling beyond the minimum-input-length guard (e.g. per-user request-frequency limits) — not raised as a gap by any gate; the length guard plus existing global GraphQL depth/complexity limits (Story 0.8) are the accepted MVP-scope cost controls.

## Definition of Done

- [ ] AC1-AC8 satisfied.
- [ ] Required tests passing (`packages/domain` 100%-covered unit tests for the new/extended modules; `apps/backend` unit tests for the adapter/client additions; `apps/backend` integration tests for the GraphQL layer).
- [ ] Lint and type checks passing for `apps/backend`, `packages/domain`.
- [ ] Story 2.3a is `done` and this story's `placeId`/`addressAutocomplete` GraphQL-layer work (Tasks 5-7, 9) has been implemented and verified against its real (not hypothetical) schema/resolver files.

## Completion Status

- [x] Completed (Status: review)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. Gate 1/3 cited from swept `epic-2-readiness.md` (`swept: true`, `2.3b` in `stories_covered`; Addendum confirms this story is itself the identified gap-fill). Gate 2 performed as a direct zero-UI check (mirrors Story 0.16's precedent) rather than a full Freya-persona subagent dispatch, given this story's unambiguous backend-only scope confirmed by both `epics.md`'s literal story text and a grep of `design-artifacts/` finding no "My Locations" autocomplete UI spec.
- Two real design tradeoffs (autocomplete caching, minimum-input-length enforcement) were not resolved by `epics.md`'s literal ACs and were presented to the user via `AskUserQuestion` before drafting, per this workflow's design-tradeoff-surfacing rule — user selected both recommended options (no caching; enforce a 3-character backend minimum).
- Confirmed via `git ls-files`/grep that Story 2.3a (this story's direct dependency) has no implementation in the codebase yet, despite being `ready-for-dev` — flagged prominently in Pre-Coding Approval Gate, since this is a tighter dependency situation than Story 2.3a's own precedent with Story 0.16 (that story at least had a real, committed target interface to mock against; this story's Tasks 5-7 modify files that do not yet exist at all).

### Completion Notes List
- Implemented `AddressPrediction` domain type and `meetsAutocompleteInputThreshold` length-3 guard in `@festgrid/domain/geolocation`.
- Implemented `getAddressPredictions` in Geoapify REST client wrapper and Geolocation adapter in uncached, cost-sensitive, threshold-guarded pattern (AC1, AC2, AC3).
- Extended `resolveLocationInputMode` in `@festgrid/domain/user-locations` to safely handle a third `placeId` mode alongside coordinates and addresses with precise pairwise mutual-exclusivity error validation (AC5).
- Declared `AddressSuggestion` GraphQL type, extended type `Query` with `addressAutocomplete`, and added `placeId` fields to `CreateUserLocationInput` and `UpdateUserLocationInput` in `user-locations.graphql` (AC1, AC4, AC5).
- Implemented `addressAutocomplete` resolver with authenticated context checks (`requireAuth`), and wired mutation resolvers to resolve and geocode incoming `placeId`s via cache-backed adapter details resolution (AC4, AC5, AC6, AC7).
- Regenerated GraphQL codegen types for both backend and web.
- Achieved 100% unit test coverage in `@festgrid/domain` and authored extensive integration/unit tests for geolocation adapter and GraphQL query/mutations in `apps/backend`.

### File List
- `packages/domain/src/geolocation/types.ts` (Modified)
- `packages/domain/src/geolocation/validate-autocomplete-input.ts` (New)
- `packages/domain/src/geolocation/validate-autocomplete-input.test.ts` (New)
- `packages/domain/src/geolocation/index.ts` (Modified)
- `packages/domain/src/user-locations/validateLocationInput.ts` (Modified)
- `packages/domain/src/user-locations/validateLocationInput.test.ts` (Modified)
- `apps/backend/src/lib/geolocation/geoapify-client.ts` (Modified)
- `apps/backend/src/lib/geolocation/geoapify-client.test.ts` (Modified)
- `apps/backend/src/lib/geolocation/adapter.ts` (Modified)
- `apps/backend/src/lib/geolocation/adapter.test.ts` (Modified)
- `apps/backend/src/schema/user-locations.graphql` (Modified)
- `apps/backend/src/schema/resolvers.ts` (Modified)
- `apps/backend/src/schema/user-locations.test.ts` (Modified)
- `apps/backend/src/generated/resolvers-types.ts` (Regenerated)
- `apps/web/src/generated/graphql.ts` (Regenerated)
