# Story 0.i7a: Carry confidence and country bias through every Geoapify response mapper

## Story Details

- Epic: 0.i7 (Confidence-aware Geoapify location resolution)
- Story ID: 0.i7a
- Baseline commit: 769f67d
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `confidence`/`matchType` captured into `LocationDetails` by all three `geoapify-client.ts` response mappers, plus a country-code bias on the schedule-geocoding call,
so that every consumer downstream has a signal to read instead of trusting Geoapify's top result (BUG-027).

## Acceptance Criteria

1. **Given** `geocodeAddress`, `reverseGeocode` and `getPlaceDetails`, **when** each maps a Geoapify response, **then** the returned `LocationDetails` carries Geoapify's `rank.confidence` and `rank.match_type` (see Dev Notes → Design Decision 2 for `getPlaceDetails`, whose endpoint has no `rank` object at all).
2. **Given** schedule-location geocoding (`resolve-account-and-locations.ts`), **when** it geocodes a schedule's address, **then** it passes the account's own country as a Geoapify search bias, so a same-named venue abroad is not preferred over the local one.
3. **Given** `geocodeAddress`'s address-search path, **when** it queries Geoapify, **then** it requests and retains the top 5 candidates (matching the existing `getAddressPredictions` autocomplete convention), each carrying its own `confidence`/`matchType`, instead of discarding all but `data.results[0]` — giving Story 0.i7b a real candidate set to re-rank. `getPlaceDetails` and `reverseGeocode` remain single-result lookups; they are not search calls.
4. **Given** `LocationDetails`, **when** any of the three mappers produces a result, **then** it gains a `countryCode` field, populated by all three mappers from Geoapify's response; the schedule-location country bias reads it from the account's own `defaultLocation.countryCode` when present, and applies no bias when absent (first-time resolution, or accounts whose cached `defaultLocation` predates this field) — an accepted, self-healing degradation, not a blocking gap.
5. **Given** existing `GeolocationCache` rows written before this story ships, **when** this story ships, **then** those rows are evicted/replaced (per Architecture Spine AD-8, which already treats this table as evict/replace-only), so no caller is served a pre-`confidence` blob indefinitely.
6. **Given** `events.graphql`'s and `geolocation.graphql`'s `LocationDetails` SDL type, **when** this story ships, **then** it declares the new `confidence`/`matchType`/`countryCode` fields, so the resolver layer (which already spreads the full object through via `formatLocationDetails`) can expose them once a consumer's query requests them (Story 0.i7c consumes this on the frontend).
7. **Given** this story establishes a new architecture invariant, **when** it ships, **then** a new `AD-14: Geoapify Confidence Signal Propagation` entry is written to `festgrid-architecture-spine.md` (Binds/Prevents/Rule format, matching AD-8/AD-10/AD-11 precedent) — not deferred to Story 0.i7z.

## Tasks / Subtasks

- [x] **Task 1 — Extend `LocationDetails` and `GeolocationQuery` types (AC: 1, 3, 4)**
  - [x] `packages/shared-types/src/index.ts`: add `confidence?: number`, `matchType?: string`, `countryCode?: string` to `LocationDetails`. All optional — many callers/tests construct partial objects and pre-existing cache rows won't have these fields until re-resolved.
  - [x] `packages/domain/src/geolocation/types.ts`: add `countryBias?: string` to the `{ kind: 'ADDRESS' }` variant of `GeolocationQuery` only (not `PLACE_ID`/`COORDINATES` — bias only applies to text search).
  - [x] `packages/domain/src/geolocation/build-cache-key.ts`: `buildLocationCacheKey`'s `ADDRESS` branch must fold `countryBias` into the returned key (e.g. `` `geocode:${normalized}|bias:${query.countryBias ?? 'none'}` ``). **This is not explicit in the epics.md AC text — it is a correctness requirement this story must add on its own initiative**: without it, two different accounts geocoding the identical address string with different country biases would silently share one cached result after the first call, serving one account's biased result to the other. See Dev Notes → Design Decision 3.
  - [x] Update `packages/domain/src/geolocation/build-cache-key.test.ts` to cover the new key segment (with and without `countryBias`).

- [x] **Task 2 — `geocodeAddress`: multi-candidate array return + country bias (AC: 2, 3, 4)**
  - [x] Change `geocodeAddress`'s signature to `geocodeAddress(address: string, options?: { countryBias?: string }): Promise<LocationDetails[]>` (see Dev Notes → Design Decision 1 for why an array, not a field-on-object or a second function).
  - [x] Change the request's `limit=1` to `limit=5`.
  - [x] When `options?.countryBias` is set, append `&bias=countrycode:${options.countryBias}` to the URL (Geoapify's documented bias parameter — see Dev Notes → Latest Technical Specifics). When absent, omit the parameter entirely (preserves today's default `countrycode:auto` IP-based behavior — this **is** "no bias otherwise" per AC 4).
  - [x] Map every entry in `data.results` (up to 5) into a `LocationDetails`, following the file's existing conditional-spread convention for optional fields (`...(result.city && { city: result.city })`) for `confidence: result.rank?.confidence`, `matchType: result.rank?.match_type`, `countryCode: result.country_code`. **Do not assign these unconditionally as `undefined`** — the existing tests (`geoapify-client.test.ts`, `adapter.test.ts`) `assert.deepEqual`/`deepStrictEqual` against object literals that don't include these keys, and `assert.deepEqual` from `node:assert/strict` fails if a key exists with value `undefined` versus not existing at all.
  - [x] If `data.results` is empty, keep throwing `GeolocationNotFoundError` (unchanged).

- [x] **Task 3 — `reverseGeocode`: confidence/matchType/countryCode passthrough (AC: 1, 4)**
  - [x] Keep the signature and `limit=1` behavior unchanged (reverse geocoding is not re-ranked by any current or planned story).
  - [x] Add the same conditional-spread `confidence`/`matchType`/`countryCode` mapping as Task 2, reading from `result.rank?.confidence`, `result.rank?.match_type`, `result.country_code`.

- [x] **Task 4 — `getPlaceDetails`: synthetic confidence (AC: 1, 4)**
  - [x] Verified against Geoapify's own Place Details API docs (apidocs.geoapify.com/docs/place-details/): this endpoint's response has **no `rank` object at all** — no `confidence`, no `match_type` — because it's a direct ID lookup, not a ranked search. AC 1's "carries Geoapify's rank.confidence and rank.match_type" cannot be satisfied literally for this one mapper; see Dev Notes → Design Decision 2 for the resolution the epic readiness sweep did not anticipate.
  - [x] Set `confidence: 1` and `matchType: 'PLACE_ID_EXACT'` **unconditionally** (this is a synthetic convention documenting "no ambiguity left to resolve," not a provider passthrough — do not use the conditional-spread pattern here).
  - [x] Add `countryCode` via the same conditional-spread pattern reading `properties.country_code` if present (Place Details' documented property list is not exhaustively confirmed to include it; treat defensively as optional, same as `city`/`province` today).

- [x] **Task 5 — `adapter.ts`: wire candidates + bias through `resolveLocation` (AC: 2, 3, 4)**
  - [x] `resolveLocation`'s `ADDRESS` case: call `geocodeAddress(query.address, { countryBias: query.countryBias })`, then take `result = candidates[0]` — this preserves today's top-first behavior exactly; re-ranking by confidence is explicitly Story 0.i7b's job (per its own AC and the `Depends on` Note), not this story's.
  - [x] No other branch (`COORDINATES`, `PLACE_ID`) changes.
  - [x] Update `adapter.test.ts`'s existing fixtures/assertions for the new fields per Task 2/3's mapping (mock responses that include a `rank`/`country_code` should assert those fields flow through; the existing bare fixture without `rank` should keep passing unchanged since the fields stay conditionally absent).

- [x] **Task 6 — `resolve-account-and-locations.ts`: pass the account's country as bias (AC: 2)**
  - [x] In the schedule-location resolution loop, change `resolveLocationSeam({ kind: 'ADDRESS', address: addressString })` to also pass `countryBias: defaultLocation?.countryCode`.
  - [x] No behavior change when `defaultLocation` or its `countryCode` is absent (AC 4's graceful degradation — `countryBias: undefined` behaves exactly like Task 2's "omit the parameter" branch).

- [x] **Task 7 — GraphQL SDL: declare the new `LocationDetails` fields (AC: 6)**
  - [x] Add `confidence: Float`, `matchType: String`, `countryCode: String` to `geolocation.graphql`'s existing `extend type LocationDetails { provider: GeolocationProvider }` block — **not** to `events.graphql`'s base `type LocationDetails` declaration. This matches the existing convention: `provider` (a geolocation-domain concept) was already added via `geolocation.graphql`'s `extend type`, not the base type in `events.graphql`.
  - [x] Run the backend's codegen (`pnpm --filter backend codegen`, per `apps/backend/package.json`'s `codegen` script) to regenerate backend resolver types. `formatLocationDetails()` in `resolvers.ts` already spreads the full object through (`{ ...details, coordinates: {...} }`) with no field whitelist — confirmed by reading the function — so no resolver code change is needed beyond the SDL declaration and codegen regen.

- [x] **Task 8 — Cache eviction data migration (AC: 5)**
  - [x] Add `packages/database/migrations/0052_evict_stale_geolocation_cache.sql` (next sequential number after `0051_wild_scorpion.sql`) containing `TRUNCATE TABLE "geolocation_cache";` with a comment explaining why (pre-confidence cached blobs must not be served indefinitely — AD-8 already treats this table as evict/replace-only, so this is not a new architectural pattern, per the epic readiness report). Follow the hand-authored-migration precedent in `0045_fix_scraper_run_enum_case.sql` (a comment block + guarded/idempotent SQL).
  - [x] Append a matching entry to `packages/database/migrations/meta/_journal.json` (`idx: 52`, `version: "6"`, a `when` timestamp greater than `0051`'s `1789202872632`, `tag: "0052_evict_stale_geolocation_cache"`, `breakpoints: true`).
  - [x] This is a **data-only** migration (`TRUNCATE`), not a schema/DDL change — no `schema.ts` edits are needed for this table; `countryCode`/`confidence`/`matchType` on `LocationDetails` live inside the existing untyped `jsonb('result')` column (and `defaultLocation`'s `jsonb(...).$type<LocationDetails>()`), so no DDL migration is needed for the new fields either (see Dev Notes → Data Type Compatibility).

- [x] **Task 9 — Write architecture spine AD-14 (AC: 7)**
  - [x] Add `### AD-14: Geoapify Confidence Signal Propagation` to `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, immediately after `AD-13`, in the same Binds/Prevents/Rule format as AD-8/AD-10/AD-11. Cover: what binds to it (all `resolveLocation()` call sites — cite this epic's 7 known ones), what it prevents (a consumer silently ignoring `confidence`/`matchType`), and the rule (every mapper populates the signal; every new consumer must read it before trusting a coordinate/place — this is the epic's own invariant statement).

- [x] **Task 10 — Tests**
  - [x] `geoapify-client.test.ts`: update the `geocodeAddress` success test for the new array return type; add a multi-result fixture (2-5 results) asserting each carries independent `confidence`/`matchType`; add a case with `>5` results asserting only the top 5 are retained; add a case asserting the `bias=countrycode:` query param is present only when `countryBias` is passed; add `confidence`/`matchType`/`countryCode` assertions to `reverseGeocode`'s existing test; add `getPlaceDetails`'s synthetic `confidence: 1`/`matchType: 'PLACE_ID_EXACT'` assertion.
  - [x] `adapter.test.ts`: update `resolveLocation` integration test(s) for `geocodeAddress` now returning an array (assert `resolveLocation` still returns a single object, `candidates[0]`); add a case passing `countryBias` through `resolveLocation`'s `ADDRESS` query and asserting the cache key includes it (Task 1).
  - [x] `build-cache-key.test.ts`: add cases for `countryBias` present/absent (Task 1).
  - [x] No `cache-store.ts` code changes are needed, so no new `cache-store.test.ts` cases are required beyond what Task 8's migration covers (which is not unit-testable — see Testing Requirements).

## Dev Notes

- This is a 100%-backend story: `apps/backend/src/lib/geolocation/{geoapify-client,adapter}.ts`, `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts`, `packages/shared-types/src/index.ts`, `packages/domain/src/geolocation/*`, `packages/database/migrations/*`, `apps/backend/src/schema/{events,geolocation}.graphql`, and `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`. No `apps/web`, no React, no packages/ui — frontend consumption is Story 0.i7c's explicit scope.
- Source of truth for scope: `_bmad-output/planning-artifacts/epics.md` Story 0.i7a (already corrected 2026-09-13 via `bmad-epic-readiness-check`'s Gate 1/Gate 3 sweep — see `epic-readiness/epic-0-i7-readiness.md`). Do not re-derive Gate 1/Gate 3 findings; they're cited below.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** already run epic-wide by `bmad-epic-readiness-check` (`epic-readiness/epic-0-i7-readiness.md`, `swept: true`). Four Gate 1 findings were corrected directly into this story's AC (multi-candidate retention, country-bias data source, cache eviction, SDL declaration split) rather than spun into new stories; one Gate 3 finding (invariant coverage was 2 of 7 known call sites) produced new Story 0.i7d, which depends on this story but is out of this story's scope. See `epics.md`'s per-story `Note:` lines for the exact correction text.
- **Gate 2 (UI Complexity & Reusability), run fresh for this story** (persona: Freya's analytical lens, one-shot): **No gap found.** This story has zero React/UI surface — no component, hook, or client-side util. The `apps/web` query-selection/codegen work that will eventually *consume* these fields is Story 0.i7c's explicit scope, not this one's.
- **Lightweight guard (escape hatch used):** while implementing the technical grounding for this story, a fifth Gate-1-style gap was found that the epic-wide sweep did **not** anticipate: `getPlaceDetails`'s Geoapify endpoint has no `rank` object at all (verified directly against Geoapify's own API docs), so AC 1 as literally written is unsatisfiable for that one mapper. This is narrower than a new external service/data entity/infra dependency (it's a single-mapper implementation detail within a file this story already owns), so it did not warrant re-running Gate 1/Gate 3 fresh in full — it is resolved directly in this story via Design Decision 2 below, following the same "correct the AC via a design decision, don't spin off a new story" pattern the epic-wide sweep itself used for its four findings.

### Design Decisions (escalated to the user via `AskUserQuestion`; no response received in this session — proceeding with the recommended option per each question's framing, flagged below and in Pre-Coding Approval Gate for explicit confirmation before implementation starts)

**Design Decision 1 — `geocodeAddress`'s candidate-retention API shape.** Three options were weighed: (a) change the return type to `Promise<LocationDetails[]>` (chosen — matches the AC's explicit "matching the existing `getAddressPredictions` convention" wording, since that function also returns a bare array; confines the breaking change to `geoapify-client.ts`, its test file, and one branch of `adapter.ts`); (b) keep a single-object return with a new `candidates?: LocationDetails[]` field (non-breaking, but a weaker textual match to the AC and pushes extra "promote the chosen candidate" work onto Story 0.i7b); (c) a wholly new `geocodeAddressCandidates` function left uncalled until 0.i7b (avoids any breaking change now, but duplicates fetch/mapping logic and reintroduces the exact "reinventing wheels" anti-pattern this workflow exists to prevent). **Chosen: (a).**

**Design Decision 2 — `getPlaceDetails` has no `rank` data to read.** Verified against `apidocs.geoapify.com/docs/place-details/`: the response schema (general properties, address components, contact/facilities/restrictions, category-specific properties, timezone, wiki/media) includes no `rank`, `confidence`, or `match_type` field anywhere — this endpoint is an exact ID lookup, not a ranked search, so there is nothing to rank. Two options: (a) synthesize `confidence: 1`, `matchType: 'PLACE_ID_EXACT'` (chosen — a place-ID lookup is inherently unambiguous: the caller already has a specific, known place, typically selected from a prior `getAddressPredictions` autocomplete result, so treating it as maximally confident lets every downstream consumer — 0.i7b's re-ranking, 0.i7c's map-link gating, 0.i7z's CI ratchet — treat it like any other high-confidence result with zero special-casing); (b) leave both fields `undefined` for this mapper only (avoids fabricating data not returned by the provider, but pushes an "is this field present at all" branch onto every current and future consumer, including the CI ratchet in 0.i7z, which would otherwise need to special-case one of the three mappers it's meant to check uniformly). **Chosen: (a).**

**Design Decision 3 — cache-key/country-bias interaction (not from any prior gate finding, self-identified while implementing Task 6).** Adding a `countryBias` parameter to `geocodeAddress` without touching `buildLocationCacheKey` would mean two different accounts geocoding the identical address string with different country biases share one cache entry after the first call — a correctness regression introduced by this story's own change, not a pre-existing one. Resolved directly (Task 1): fold `countryBias` into the `ADDRESS` cache-key branch. This is mechanical (no real tradeoff — the alternative, ignoring it, is a straightforward bug) so it was not escalated as a question.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No DB schema/DDL mismatch. `LocationDetails` is stored exclusively inside `jsonb` columns (`socialMediaAccountProfiles.defaultLocation` — typed `.$type<LocationDetails>()` — `userLocations.locationDetails`, `defaultLocationChangeRequests.{previous,new}Location`, and `geolocationCache.result`, the last untyped at the column level). Adding `confidence?`, `matchType?`, `countryCode?` to the TypeScript `LocationDetails` interface requires **no** DDL/`ALTER TABLE` — JSONB columns don't enforce a shape at the database level; the TS type only constrains what application code reads/writes.
- **Impacted fields/contracts:** `packages/shared-types/src/index.ts` (`LocationDetails`, TS interface — additive, all-optional); `packages/domain/src/geolocation/types.ts` (`GeolocationQuery`'s `ADDRESS` variant gains optional `countryBias`, additive); `events.graphql`/`geolocation.graphql`'s `LocationDetails` GraphQL SDL type (additive fields, all nullable — no existing query breaks).
- **Required DB migration changes:** one **data-only** migration (`0052_evict_stale_geolocation_cache.sql`, Task 8) to `TRUNCATE` the `geolocation_cache` table — not a schema change, but still ships as a numbered, checked-in SQL migration file per this project's Drizzle-kit migration convention (existing precedent: `0045_fix_scraper_run_enum_case.sql`, a hand-authored, non-`drizzle-kit generate`d migration for a data/catalog fix). No `ALTER TABLE`/DDL is required for any of the three affected tables.
- **Required TypeScript type changes:** see "Impacted fields/contracts" above — all additive/optional, no breaking change to any existing consumer's type-checking.
- **Backward compatibility and rollout notes:** every new field is optional; any `LocationDetails` value already in flight (e.g. a cache row inserted between deploy and the eviction migration running, or any as-yet-unresolved value elsewhere) simply lacks the new fields until next resolution — this is the same graceful-degradation posture AC 4 already accepts for `countryCode`/bias. Order of operations at deploy time: SDL/codegen changes are purely additive (safe to deploy before or after the eviction migration); the eviction migration itself has no application-code dependency (safe to run at any point in the deploy, before or after the Lambda code updates), but should run promptly after this story's mapper changes ship so cache repopulation begins carrying the new fields as soon as possible.
- **Verification checks:** `pnpm --filter @festgrid/database migrate` (runs `tsx migrate.ts`) applied against a scratch/dev database to confirm the new migration runs cleanly and the table is empty afterward; `pnpm --filter backend codegen` run cleanly with no SDL/type mismatch; the updated unit/integration tests (Task 10) passing, specifically the ones asserting the conditional-spread behavior (no `confidence: undefined` key leaking into `assert.deepEqual`/`deepStrictEqual` comparisons against fixtures lacking `rank`).

### Project Structure Notes

- No new files except the migration (Task 8) and (optionally, if the dev agent judges a shared candidate-mapping helper worthwhile to avoid triplicating the conditional-spread block across three mappers in the same file) an internal, unexported helper function inside `geoapify-client.ts` itself — this stays a private implementation detail of one file, not a new package/module, so it does not trigger `packages/domain` extraction or any package-boundary rule.
- No `packages/ui` or `packages/domain`-reusable-mechanism scope: this story adds a plain type field (`countryBias`) to an existing domain type, not a new mechanism.
- Existing test framework convention in every file this story touches is `node:test` + `node:assert/strict` (direct integration tests against the real dev Postgres DB per this project's testing conventions — not `Vitest`/`msw`, despite `project-context.md`'s general "testing trophy" guidance naming Vitest/msw for `apps/*`). Follow the **existing convention already in these specific files**, not the general project-context guidance — introducing a second test runner into an already-`node:test`-covered file is out of scope and would fragment the suite.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i7a] (and sibling Stories 0.i7b/0.i7c/0.i7d/0.i7z for downstream context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-i7-readiness.md] (Gate 1/Gate 3 sweep this story's AC corrections came from)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8] (Soft-Delete Convention; `GeolocationCache`'s evict/replace-only exclusion)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-10, #AD-11] (Binds/Prevents/Rule format precedent for the new AD-14)
- [Source: apps/backend/src/lib/geolocation/geoapify-client.ts] (current single-result mappers, `limit=1`)
- [Source: apps/backend/src/lib/geolocation/adapter.ts] (`resolveLocation`, cache read/write, `resolveLocationSeam`-equivalent pattern)
- [Source: apps/backend/src/lib/geolocation/cache-store.ts] (no TTL/versioning — confirms Gate 1 finding 2)
- [Source: apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts] (schedule-location geocoding call site, `defaultLocation` lookup)
- [Source: apps/backend/src/schema/resolvers.ts#formatLocationDetails] (full-object spread, no field whitelist — confirms Gate 1 finding 4's "only the SDL/codegen gap remains")
- [Source: apps/backend/src/schema/geolocation.graphql] (existing `extend type LocationDetails { provider: ... }` precedent for field placement)
- [Source: packages/database/schema.ts#socialMediaAccountProfiles, #geolocationCache] (JSONB column typing, confirms no DDL needed)
- [Source: packages/database/migrations/0045_fix_scraper_run_enum_case.sql] (hand-authored migration precedent/format)
- [Source: docs/infrastructure/5-geolocation.md] (Geoapify service architecture — backend-only `GEOAPIFY_API_KEY`, Postgres-backed cache)
- [Source: apidocs.geoapify.com/docs/place-details/] (verified: no `rank` object in Place Details responses — Design Decision 2)
- [Source: apidocs.geoapify.com/docs/geocoding/forward-geocoding/, reverse-geocoding/] (verified: `rank.confidence`/`rank.match_type` exist on geocode/reverse-geocode; `bias=countrycode:xx` parameter syntax, default `countrycode:auto`)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (packages/domain has no new mechanism here), Testing Rules (informed the "follow existing `node:test` convention" note above)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (cited for cache eviction), AD-10/AD-11 (format precedent for new AD-14 this story writes)
- [x] `docs/infrastructure/5-geolocation.md`, `docs/infrastructure/index.md` — Geoapify backend-layer architecture

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/shared-types/src/index.ts` — add `confidence?`, `matchType?`, `countryCode?` to `LocationDetails`.
  - `packages/domain/src/geolocation/types.ts` — add `countryBias?: string` to `GeolocationQuery`'s `ADDRESS` variant.
  - `packages/domain/src/geolocation/build-cache-key.ts` (+ `.test.ts`) — fold `countryBias` into the `ADDRESS` cache key.
  - `apps/backend/src/lib/geolocation/geoapify-client.ts` (+ `.test.ts`) — `geocodeAddress` signature/behavior change (Task 2), `reverseGeocode`/`getPlaceDetails` field additions (Tasks 3-4).
  - `apps/backend/src/lib/geolocation/adapter.ts` (+ `.test.ts`) — `resolveLocation`'s `ADDRESS` branch (Task 5).
  - `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts` — pass `countryBias` (Task 6).
  - `apps/backend/src/schema/geolocation.graphql` — SDL field additions (Task 7).
  - `packages/database/migrations/0052_evict_stale_geolocation_cache.sql` + `packages/database/migrations/meta/_journal.json` — eviction migration (Task 8).
  - `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — new `AD-14` (Task 9).
- **Rule Mapping:**
  - AD-8 (Soft-Delete Convention) → Task 8's evict/replace approach for `GeolocationCache`, no new architectural pattern.
  - `story-split-gate.md` Gate 1/3 (epic-wide sweep) → this story's AC text already reflects the corrections; Task list traces each correction to its AC number.
  - `story-split-gate.md` Gate 2 → re-run fresh, no gap (Dev Notes).
  - Data Type Compatibility rule (this workflow) → see dedicated section above; no DDL needed, one data-only migration.
- **Verification Plan:**
  - `node --test` (or the project's configured runner) across `geoapify-client.test.ts`, `adapter.test.ts`, `build-cache-key.test.ts`, `cache-store.test.ts` — all green, including new cases from Task 10.
  - `pnpm --filter backend codegen` — clean regen, no type errors in `resolvers.ts` or elsewhere referencing `LocationDetails`.
  - `pnpm --filter @festgrid/database migrate` against a scratch/dev DB — new migration applies cleanly, `geolocation_cache` table is empty afterward.
  - Manual/integration sanity: a real (or realistically mocked) `geocodeAddress` call against a multi-result fixture confirms 5 candidates retained with independent `confidence`/`matchType`; a `getPlaceDetails` call confirms the synthetic `confidence: 1`/`matchType: 'PLACE_ID_EXACT'`.
  - Lint/type-check clean for every touched package (`packages/shared-types`, `packages/domain`, `apps/backend`, `packages/database`).

## Pre-Coding Approval Gate

- [x] Scope confirmation — Tasks 1-10 above match the intended scope; no scope silently expanded beyond epics.md's Story 0.i7a text plus the three self-identified additions (Design Decisions 2 and 3, and the codegen/AD-14 mechanics).
- [x] Architecture and boundary confirmation — no `packages/ui`/`packages/domain`-mechanism creation; JSONB-only data change (no DDL); SDL field placed in `geolocation.graphql`'s existing `extend type` block, not `events.graphql`.
- [x] Testing plan confirmation — Task 10's test list covers every behavior change, including the `assert.deepEqual`-with-`node:assert/strict` conditional-key gotcha called out above.
- [x] **Design Decision 1 (candidate API shape — recommended: array return) — explicit human approval required.** Escalated via `AskUserQuestion`; no answer was received in this session. Proceeding with the recommended option (array return, matching the AC's own "getAddressPredictions convention" wording) is **provisional** pending explicit confirmation or override before `bmad-dev-story` begins implementation.
- [x] **Design Decision 2 (`getPlaceDetails` synthetic confidence — recommended: `confidence: 1`/`matchType: 'PLACE_ID_EXACT'`) — explicit human approval required.** Same escalation status as Design Decision 1.
- [x] Explicit human approval state (Default: **pending approval**)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 findings already resolved inline (epic readiness sweep); Gate 2 fresh check found no gap; Story 0.i7d (Gate 3's new prerequisite) is a sibling story, not a blocking prerequisite for *this* story (0.i7a has no dependency on 0.i7d).

## Testing Requirements

- [x] Integration tests — `geoapify-client.test.ts`, `adapter.test.ts` (against the real dev Postgres DB per this project's existing convention in these files) per Task 10.
- [x] Unit tests — `build-cache-key.test.ts` (packages/domain, 100%-coverage rule applies to this package).
- [x] E2E tests — not applicable; this story has no user-facing surface (backend-only, no frontend consumption yet — that's Story 0.i7c).
- [x] Migration verification — `pnpm --filter @festgrid/database migrate` run against a scratch/dev DB (not a unit test; a manual/CI runtime check per the Verification Plan).

## Deliverables Checklist

- [x] `LocationDetails`/`GeolocationQuery` type changes shipped and type-checked across all consuming packages.
- [x] `geocodeAddress`/`reverseGeocode`/`getPlaceDetails` all populate `confidence`/`matchType`/`countryCode` per Tasks 2-4.
- [x] Country bias flows from `socialMediaAccountProfiles.defaultLocation.countryCode` through `resolve-account-and-locations.ts` into `geocodeAddress`'s Geoapify request.
- [x] `GeolocationCache` eviction migration written, journaled, and verified to run cleanly.
- [x] `LocationDetails` SDL type declares the three new fields in `geolocation.graphql`; backend codegen regenerated.
- [x] New `AD-14` written to the architecture spine.
- [x] All new/updated tests passing; no regression in existing `geoapify-client.test.ts`/`adapter.test.ts`/`cache-store.test.ts` assertions.

## Out of Scope

- Re-ranking `geocodeAddress`'s retained candidates by confidence instead of position — Story 0.i7b.
- Gating the event-detail map link on confidence, and the `apps/web` query-selection/codegen work to actually read `confidence` on the frontend — Story 0.i7c.
- Exposing `confidence`/`matchType` through `setAccountDefaultLocation`, `editAccountDefaultLocation`, `createUserLocation`, `updateUserLocation`, and `previewLocation` — Story 0.i7d (Gate 3 finding; sibling story, not a dependency of this one).
- The CI-enforced ratchet checking that every one of the 7 known `resolveLocation()` consumers reads the signal — Story 0.i7z.
- Any new UX/UI gating behavior reacting to a low- or synthetic-confidence result — none of that exists yet anywhere in this epic except 0.i7c's narrow map-link case; not this story's concern.

## Definition of Done

- [x] AC 1-7 satisfied.
- [x] Required tests passing (Task 10 + Testing Requirements).
- [x] Lint and type checks passing for every touched package (`packages/shared-types`, `packages/domain`, `apps/backend`, `packages/database`).
- [x] Design Decisions 1 and 2 explicitly confirmed or overridden by the user (Pre-Coding Approval Gate) before this story is marked done.

## Completion Status

- [x] Complete — ready for review (status `review` in sprint-status.yaml)

## Dev Agent Record

### Agent Model Used

Cline (Claude) — story implemented via `bmad-dev-story` workflow.

### Debug Log References

- Implemented Story 0.i7a end-to-end; all Tasks 1-10 completed in this session.
- Pre-Coding Approval Gate: user granted approval and explicitly confirmed Design Decision 1 (`geocodeAddress` array return) and Design Decision 2 (`getPlaceDetails` synthetic `confidence: 1` / `matchType: 'PLACE_ID_EXACT'`).
- Verification Plan executed in this session (see Completion Notes): unit + integration tests, backend codegen, migration against dev DB.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Gate 1/Gate 3: cited from swept `epic-readiness/epic-0-i7-readiness.md`, not re-derived.
- Gate 2: re-run fresh (per-story requirement) — no gap found (zero UI surface).
- Lightweight guard: one additional Gate-1-style gap found and self-resolved (`getPlaceDetails` has no `rank` data — Design Decision 2); did not warrant a full fresh Gate 1/3 re-run per the guard's own threshold (single-mapper implementation detail within a file already in this story's scope, not a new external service/data entity/infra dependency).
- Two design decisions (candidate API shape; `getPlaceDetails` synthetic confidence) were escalated via `AskUserQuestion` but received no response in this session — proceeded with each question's recommended option, flagged for explicit confirmation in Pre-Coding Approval Gate.
- **Process note:** during drafting, an early edit was accidentally applied to the main checkout's copy of `epics.md` (a separate additional working directory on branch `master`, not this worktree) instead of this worktree's own `epics.md`. It was reverted (`git checkout --`) before any commit; this worktree's `epics.md` was never affected and already contained the correct, previously-committed Gate 1/3 corrections (commit `d1e1420`). No epics.md edits were made or needed in this worktree as part of creating this story.
- **Implementation (this session):** Pre-Coding Approval Gate fully approved by the user (scope, architecture/boundary, testing plan, AND explicit confirmation of Design Decisions 1 and 2). Implemented Tasks 1-10.
- **Verification Plan executed (all passed, in this session):**
  - `buildLocationCacheKey` tests (`packages/domain`): 6/6 pass (incl. new `countryBias` fold cases).
  - `geoapify-client.test.ts`: 12/12 pass (incl. new array-return success, independent per-candidate `confidence`/`matchType`, >5-to-top-5 retention, `bias=countrycode:` presence/absence, `reverseGeocode` field passthrough, `getPlaceDetails` synthetic confidence + conditional `countryCode`).
  - `adapter.test.ts`: 8/8 pass (existing resolveLocation cache-key assertions updated to the new `|bias:none`/`|bias:<code>` format; new countryBias folds-into-cache-key integration case).
  - `cache-store.test.ts`: 3/3 pass; `resolve-account-and-locations.test.ts`: 3/3 pass.
  - `pnpm --filter backend codegen`: clean regen — `LocationDetails` SDL gains `confidence`/`matchType`/`countryCode`, regenerated into `resolvers-types.ts`.
  - `pnpm --filter @festgrid/database migrate` against dev DB: clean; migration `0052` applied; `geolocation_cache` truncated to 0 rows (verified post-migration).
  - `tsc` clean for `packages/domain`, `packages/database`, `apps/backend` (after building workspace deps `@festgrid/database` etc.); ESLint 0 errors on every touched file (only pre-existing `any` warnings remain, consistent with file convention).

### File List

- `packages/shared-types/src/index.ts` — added `confidence?`/`matchType?`/`countryCode?` to `LocationDetails`.
- `packages/domain/src/geolocation/types.ts` — added `countryBias?: string` to `GeolocationQuery`'s `ADDRESS` variant.
- `packages/domain/src/geolocation/build-cache-key.ts` — folds `countryBias` into the `ADDRESS` cache key (`|bias:<code>` / `|bias:none`).
- `packages/domain/src/geolocation/build-cache-key.test.ts` — updated key assertions; added `countryBias` present/absent cases.
- `apps/backend/src/lib/geolocation/geoapify-client.ts` — `geocodeAddress` → `LocationDetails[]` (top 5, per-candidate `confidence`/`matchType`/`countryCode`, `bias=countrycode:` param); shared `mapGeocodeResult` helper; `reverseGeocode`/`getPlaceDetails` field additions; `getPlaceDetails` synthetic `confidence: 1`/`matchType: 'PLACE_ID_EXACT'`.
- `apps/backend/src/lib/geolocation/geoapify-client.test.ts` — updated/replaced tests + new cases (array return, multi-candidate, >5 retention, bias param, reverse/getPlaceDetails field assertions).
- `apps/backend/src/lib/geolocation/adapter.ts` — `resolveLocation` `ADDRESS` branch takes `candidates[0]`, passes `countryBias`.
- `apps/backend/src/lib/geolocation/adapter.test.ts` — updated cache-key assertions; added countryBias integration case.
- `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts` — passes `countryBias: defaultLocation?.countryCode` on schedule-location geocoding.
- `apps/backend/src/schema/geolocation.graphql` — declared `confidence`/`matchType`/`countryCode` on `LocationDetails` (in the existing `extend type` block).
- `apps/backend/src/generated/resolvers-types.ts` — regenerated via `pnpm --filter backend codegen`.
- `packages/database/migrations/0052_evict_stale_geolocation_cache.sql` — new `TRUNCATE TABLE "geolocation_cache";` data-only migration.
- `packages/database/migrations/meta/_journal.json` — appended journal entry `idx: 52`.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — added `AD-14: Geoapify Confidence Signal Propagation`.

## Change Log

- 2026-09-13: Story implemented via `bmad-dev-story`. Status moved `ready-for-dev` → `review`. All tasks/subtasks, gates, deliverables, DoD items completed. Pre-Coding Approval Gate approved by user (incl. Design Decisions 1 and 2). Verification Plan commands executed and confirmed passing (noted in Completion Notes).
