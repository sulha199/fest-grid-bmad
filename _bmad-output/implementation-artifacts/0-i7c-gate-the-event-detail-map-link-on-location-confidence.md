# Story 0.i7c: Gate the event-detail map link on location confidence

## Story Details

- Epic: 0.i7 (Confidence-aware Geoapify location resolution)
- Story ID: 0.i7c
- Baseline commit: ef50785bb07a96f5f3f393cc54463bfbddbb3dfe
- Status: ready-for-dev
- Depends on: Story 0.i7a (status `review` in `sprint-status.yaml` — pending code-review sign-off, but its code is already present and verified in this worktree at the baseline commit above: `LocationDetails`'s SDL type already declares `confidence: Float`/`matchType: String` in `apps/backend/src/schema/geolocation.graphql`'s `extend type LocationDetails` block, and `packages/shared-types/src/index.ts`'s `LocationDetails` TS interface already has `confidence?: number`/`matchType?: string`. This story's whole job is the one remaining gap: `apps/web`'s query selection set + codegen, plus the actual gating logic in `mapper.ts`.)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the event-detail Google Maps link to use the coordinate only when the resolved location is trustworthy, and fall back to a text query otherwise,
so that a user is never sent to a confidently-wrong pin (IDEA-023).

## Acceptance Criteria

1. **Given** an event schedule whose `locationDetails.confidence` is `>= 0.5` **and** `locationDetails.matchType === 'full_match'`, **when** the event-detail map link is built, **then** it links the raw coordinate (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`) — exactly as today.
2. **Given** a schedule whose `locationDetails` exists (with `coordinates`) but whose confidence/matchType fall below that bar — including the case where `confidence`/`matchType` are `null`/missing entirely (pre-epic-0.i7 data, or any cached row not yet re-resolved with the signal) — **when** the map link is built, **then** it falls back to a text query (`https://www.google.com/maps/search/?api=1&query=<url-encoded s.location>`) rather than linking the coordinate. Absence of the signal is treated as untrusted, per the graceful-degradation posture already documented on `LocationDetails.confidence` (`packages/shared-types/src/index.ts`) and Architecture Spine AD-14 Rule 2.
3. **Given** a schedule with no `locationDetails` at all, **when** the map link is built, **then** behavior is unchanged from today: falls back to the text query if `s.location` is present, otherwise `mapUrl` is `null`.
4. **Given** `apps/web`'s `getEventBySlug` query (`apps/web/src/features/events/queries.graphql`), **when** this story ships, **then** its `schedules.locationDetails` selection set requests `confidence` and `matchType` (the SDL fields Story 0.i7a already added), and `pnpm --filter web codegen` has been run so `GetEventBySlugQuery`'s generated type actually exposes them — closing the exact gap the epic readiness sweep found (Gate 1 finding #4: `mapper.ts` had no real value to read because the SDL/query/codegen chain didn't carry it to the frontend).
5. **Given** this gating logic, **when** a developer needs to reuse or test it, **then** it lives as a pure, dependency-free, independently unit-tested function in `packages/domain/src/geolocation/is-location-trustworthy.ts` (matching Story 0.i7b's `select-best-candidate.ts` precedent) — not inlined into `mapper.ts`.

**Depends on:** Story 0.i7a.

## Tasks / Subtasks

- [ ] **Task 1 — Implement `isLocationTrustworthy` in `packages/domain/src/geolocation/is-location-trustworthy.ts` (AC: 1, 2, 5)**
  - [ ] Export `MIN_TRUSTWORTHY_CONFIDENCE = 0.5` and `TRUSTWORTHY_MATCH_TYPE = 'full_match'` as named constants (not inlined magic numbers) — sourced from the user's own recorded design note against IDEA-023/BUG-027 in `_bmad-output/implementation-artifacts/backlog.yaml` ("Suggested starting bar: confidence >= 0.5 AND match_type === 'full_match' to treat a resolution as trustworthy, tuned from real data once shipped rather than fixed in advance"). This was escalated to the user via `AskUserQuestion` during this story's creation (recommended predicate vs. a confidence-only reading of epics.md's plainer AC text); no response was received — proceed with this recommended predicate, flagged below and in Pre-Coding Approval Gate for explicit confirmation before implementation starts.
  - [ ] Define a local structural type for the function's input — **do not** import/reuse `@festgrid/shared-types`'s `LocationDetails` (or a `Pick` of it) as the parameter type. See Dev Notes → Data Type Compatibility for exactly why: the GraphQL-codegen-generated type this function will actually be called with (`GetEventBySlugQuery`'s nested `locationDetails`) types nullable fields as `T | null` (key always present), not `T | undefined` (key optional) the way `@festgrid/shared-types`'s `LocationDetails` does. Define e.g.:
    ```ts
    export interface LocationConfidenceSignal {
      confidence?: number | null;
      matchType?: string | null;
    }
    ```
  - [ ] Implement `export function isLocationTrustworthy(details: LocationConfidenceSignal): boolean` returning `details.confidence != null && details.confidence >= MIN_TRUSTWORTHY_CONFIDENCE && details.matchType === TRUSTWORTHY_MATCH_TYPE`. Use `!= null` (loose) deliberately to reject both `null` and `undefined` in one check.
  - [ ] Add `export * from './is-location-trustworthy.js';` to `packages/domain/src/geolocation/index.ts`, alongside the existing `types`/`build-cache-key`/`validate-autocomplete-input`/`select-best-candidate` exports, so it is importable as `@festgrid/domain/geolocation` — the same subpath `apps/web`'s `mapper.ts` will import from (see Task 3; this subpath is already `dist`-built and already consumed from `apps/web` today via `@festgrid/domain/scraper` in this same file, so no new package-boundary precedent is being set).

- [ ] **Task 2 — `apps/web` query selection + codegen regen (AC: 4)**
  - [ ] In `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` operation, add `confidence` and `matchType` to the `schedules.locationDetails` selection set (currently: `coordinates { lat lng }`, `placeName`, `placeId`, `formattedAddress`, `timezone` — add the two new fields as siblings, after `timezone`).
  - [ ] Run `pnpm --filter web codegen` (runs `graphql-codegen --config codegen.ts && node fix-codegen.js` per `apps/web/package.json`). This regenerates `apps/web/src/generated/graphql.ts`'s `GetEventBySlugQuery` type to include `confidence: number | null` and `matchType: string | null` on its nested `locationDetails` object type. No backend change is needed for this — see Dev Notes → Data Type Compatibility for why (`buildOptimizedDrizzleSelect` already selects the whole `location_details` JSONB column whenever any of its sub-fields is requested, and the SDL declaration already exists from Story 0.i7a).
  - [ ] Confirm `apps/web/src/features/events/queries.graphql.test.ts`'s existing guards (Story 3.7c AC1 — no list-view query may select `sourceSocialMediaAccountProfile`/`profileImageUrl`) still pass unchanged: that test explicitly excludes `getEventBySlug` from its scope (see its trailing comment), so adding fields to `getEventBySlug` cannot affect it. No edit needed to that test file.

- [ ] **Task 3 — Wire `isLocationTrustworthy` into `mapper.ts`'s `mapUrl` construction (AC: 1, 2, 3)**
  - [ ] In `apps/web/src/features/events/mapper.ts`, import `isLocationTrustworthy` from `@festgrid/domain/geolocation` (new import; this file does not currently import from that subpath, only from `@festgrid/domain/scraper` for `getPlatformSlug` — add a separate import statement for the different subpath, following the existing style).
  - [ ] Change the `mapUrl` branch (currently lines 49–55) from:
    ```ts
    if (s.locationDetails?.coordinates) {
      const { lat, lng } = s.locationDetails.coordinates;
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else if (s.location) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`;
    }
    ```
    to gate the coordinate branch on `isLocationTrustworthy(s.locationDetails)` as well:
    ```ts
    if (s.locationDetails?.coordinates && isLocationTrustworthy(s.locationDetails)) {
      const { lat, lng } = s.locationDetails.coordinates;
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else if (s.location) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`;
    }
    ```
  - [ ] No other field in `mapGraphQLEventToDetailViewProps` changes. `s.location`'s own trim/empty handling (used both here and for the `ScheduleDetail.location` field a few lines below) is unchanged.

- [ ] **Task 4 — Tests (AC: 1, 2, 3, 5)**
  - [ ] `packages/domain/src/geolocation/is-location-trustworthy.test.ts` (packages/domain 100%-coverage rule): cover (a) `confidence: 0.9, matchType: 'full_match'` → `true`; (b) `confidence: 0.3, matchType: 'full_match'` → `false` (below the confidence bar); (c) `confidence: 0.9, matchType: 'match_by_building'` → `false` (meets confidence bar but wrong matchType — proves the predicate is AND, not OR); (d) `confidence: undefined, matchType: 'full_match'` → `false`; (e) `confidence: null, matchType: 'full_match'` → `false` (the actual shape the GraphQL-generated type will pass — must not be missed just because `undefined` is also covered); (f) `confidence: 0.5, matchType: 'full_match'` → `true` (boundary — `>=`, not `>`); (g) `confidence: 0.9, matchType: undefined` / `matchType: null` → `false`.
  - [ ] `apps/web/src/features/events/mapper.test.ts` (new file — no dedicated test file exists for `mapper.ts` today; follows the same "direct Vitest unit test of pure logic in `apps/web`, overriding the general testing-trophy/msw guidance" precedent already established by this same directory's `queries.graphql.test.ts` and by Stories 0.i7a/0.i7b's precedent of following a file's *existing* local convention over `project-context.md`'s general one — here there is no existing convention for this specific file, so the closest sibling precedent in this same folder applies). Build a minimal fixture matching `GetEventBySlugQuery['eventBySlug']`'s shape (only the fields `mapGraphQLEventToDetailViewProps` reads are required) and cover:
    - A schedule with `locationDetails: { coordinates: { lat, lng }, confidence: 0.9, matchType: 'full_match', ... }` → `mapUrl` is the coordinate-based URL.
    - The same coordinates with `confidence: 0.3, matchType: 'full_match'` → `mapUrl` falls back to the text query built from `s.location`.
    - The same coordinates with `confidence: null, matchType: null` (simulating pre-epic/legacy data — the actual shape a real un-re-resolved row will produce once Task 2's codegen regen is in place) → `mapUrl` falls back to the text query. This is the regression case called out in Dev Notes — assert it explicitly, don't just rely on the domain-level unit test.
    - `locationDetails: null`, `location: 'Stage 1'` → `mapUrl` falls back to the text query (today's existing no-`locationDetails` behavior, unchanged).
    - `locationDetails: null`, `location: null` → `mapUrl` is `null` (today's existing behavior, unchanged).

## Dev Notes

- **Scope:** frontend-only (`apps/web/src/features/events/{mapper.ts,queries.graphql}`) plus one new pure function in `packages/domain/src/geolocation/`. No backend/resolver code change, no GraphQL SDL change (0.i7a already declared the fields), no database migration.
- Source of truth for scope: `_bmad-output/planning-artifacts/epics.md` Story 0.i7c (already amended 2026-09-13 via `bmad-epic-readiness-check`'s Gate 1 sweep to add AC4's query-selection/codegen requirement — see `epic-readiness/epic-0-i7-readiness.md`). Do not re-derive Gate 1/Gate 3 findings; they're cited below.
- **Current code state (read in full before drafting this story):**
  - `apps/web/src/features/events/mapper.ts` (lines 41–123): `mapGraphQLEventToDetailViewProps` builds each schedule's `mapUrl` from `s.locationDetails?.coordinates` (coordinate link) or `s.location` (text-query fallback) or `null`. This is the exact branch this story changes (lines 49–55).
  - `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` operation (lines 45–106): its `schedules.locationDetails` selection currently requests only `coordinates { lat lng }`, `placeName`, `placeId`, `formattedAddress`, `timezone` — **not** `confidence`/`matchType`. Confirmed via the generated type: `apps/web/src/generated/graphql.ts`'s `GetEventBySlugQuery` (line ~1513) has `locationDetails: { placeName, placeId, formattedAddress, timezone, coordinates } | null` with no `confidence`/`matchType` — even though the *base* `LocationDetails` GraphQL type (line ~422/426 in the same generated file) already has both, because a prior commit (`0acfd63`, "regenerate apps/web GraphQL types for 0.i7a's SDL change") only regenerated the base schema types, not any operation's query-scoped result type, since no `.graphql` document had been updated to request the new fields yet. This is precisely the gap AC4 closes.
  - `packages/shared-types/src/index.ts`'s `LocationDetails.confidence` (line 77) already carries the comment: "Absent means 'no confidence signal captured', which downstream consumers (Story 0.i7c) treat as untrusted" — written by Story 0.i7a's author anticipating this exact story. AC2's "absence = untrusted" behavior is not a new design call this story is inventing; it was already decided and documented one story ago.
  - `apps/backend/src/schema/geolocation.graphql`'s `extend type LocationDetails { provider, confidence: Float, matchType: String, countryCode: String }` (Story 0.i7a) already declares both fields on the SDL type consumed by `events.graphql`'s `Schedule.locationDetails: LocationDetails`. No SDL change needed.
  - No explicit `Schedule.locationDetails` field resolver exists in `apps/backend/src/schema/resolvers.ts` — it resolves via GraphQL's default resolver straight off the Drizzle row's `location_details` JSONB column (`packages/database/schema.ts` line 356: `jsonb('location_details').$type<LocationDetails>()`), so once the SDL declares `confidence`/`matchType` (already true) and a query requests them (this story's Task 2), they flow through with zero backend code change.
  - **Verified `buildOptimizedDrizzleSelect` (`packages/graphql-select/optimized-select.ts`) operates on top-level GraphQL field names only** — it matches a requested field name against the target table's Drizzle column names and includes the whole column if there's a match; it does not (and cannot, for a single JSONB column) drill into a nested sub-selection like `locationDetails.confidence`. Since `locationDetails` (the top-level field) is already requested and already resolves to the full JSONB column being selected, adding `confidence`/`matchType` to its *nested* selection set changes nothing about what the backend fetches from Postgres — this was a real question worth checking (the project-context rule requires this optimizer to be respected), and the answer is: no backend change needed at all.
  - No dedicated test file exists for `mapper.ts` today (confirmed: `find apps/web/src/features/events -iname "*.test.*"` lists `EventDetailWrapper.test.tsx`, `queries.graphql.test.ts`, and five others, but no `mapper.test.ts`). `mapper.ts`'s logic is currently only exercised indirectly through `EventDetailWrapper.test.tsx`, whose two schedule fixtures both set `locationDetails: null` — meaning the `coordinates` branch of `mapUrl` construction has **zero** existing test coverage today, gated or not. This story adds the first direct coverage of it (Task 4).
  - `EventDetailWrapper.test.tsx`'s existing `locationDetails: null` fixtures remain valid and require no change — `null` is still a legitimate `GetEventBySlugQuery` shape after Task 2's query change (the field is optional/nullable), and that test's purpose (calendar/timezone/favorite behavior) is orthogonal to this story's map-link gating.
  - `packages/ui/src/features/events/EventDetailView.tsx`/`.test.tsx` and `EventDetailView.types.ts`'s `ScheduleDetail.mapUrl?: string | null` are **not touched** by this story — that component only renders whatever `mapUrl` string it's handed; the gating decision happens entirely upstream in `mapper.ts`. Confirmed no other `apps/web`/`packages/ui` code builds a Google Maps URL from a schedule's location (searched for `mapUrl\s*=` project-wide) — `mapper.ts` is the sole call site this story needs to touch.
- **Known, accepted regression for pre-epic data (not a gap to fix in this story):** any event/schedule whose `locationDetails` was resolved *before* Story 0.i7a shipped (or whose cached value predates it) will have `confidence`/`matchType` absent (`null` once Task 2's fields are queried), even if that resolution was actually a good match. Under AC2, such a schedule's map link will fall back to a text query instead of continuing to link its already-correct coordinate, until the location is next re-resolved. This is the same graceful-degradation posture the epic already accepted for `countryCode` (Story 0.i7a AC4) and is explicitly the intended behavior of Architecture Spine AD-14 Rule 2 ("Absence of the signal means 'untrusted'") — not a defect introduced by this story, and not something to special-case around (e.g. by treating "absent" as trusted) since doing so would defeat the entire epic's invariant for exactly the population of stale data it exists to guard against.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** already run epic-wide by `bmad-epic-readiness-check` (`epic-readiness/epic-0-i7-readiness.md`, `swept: true`). The one Gate 1 finding naming this story (#4: "0.i7c's AC omits the GraphQL SDL/codegen wiring `mapper.ts` needs to read `confidence` at all") was resolved by splitting the correction across two stories — Story 0.i7a now declares the SDL fields (confirmed already implemented in this worktree), and this story's AC4/Task 2 add the remaining half (the `apps/web` query-selection + codegen regen). No other Gate 1/3 finding names this story. Not re-derived here.
- **Lightweight guard (per this workflow's escape hatch):** reasoned over this story's actual scope (one query-selection addition, one codegen regen, one new pure comparator function, one call-site wire-up) for anything the epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new infra dependency is introduced. The `buildOptimizedDrizzleSelect`/JSONB-column verification above was a targeted correctness check within this story's own existing scope, not a new architectural gap requiring a fresh Gate 1/3 pass. Nothing here warranted re-running Gate 1/3 fresh.
- **Gate 2 (UI Complexity & Reusability), run fresh for this story** (one-shot analysis dispatched to a subagent with Freya's/WDS analytical lens, evidence inlined from this story's actual code scope rather than re-derived cold): **No gap found.** `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` and `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md` were checked for `confidence`/`geocod`/`map link`/`map url`/`google maps`/`trust` — no specified visual/interaction behavior for map-link gating exists in either UX artifact, confirming there is nothing this story's scope would be dropping or contradicting. The story's only UI-adjacent surface is a URL string decision inside an existing pure mapper function (`mapper.ts`) — it introduces no new component, no new React hook, and no new visual state; `EventDetailView.tsx` (`packages/ui`) already renders whatever `mapUrl` it's given today and needs zero changes. Not a candidate for a reusable component/hook split.

### Design Decisions (escalated to the user via `AskUserQuestion`; no response received in this session — proceeding with the recommended option per the question's framing, flagged below and in Pre-Coding Approval Gate for explicit confirmation before implementation starts)

**Design Decision 1 — the gating predicate itself.** epics.md's AC text says only "confidence threshold" (a single signal); the backlog's own design note (IDEA-023, parented to BUG-027, `_bmad-output/implementation-artifacts/backlog.yaml`) proposes a stricter two-signal bar: "confidence >= 0.5 AND match_type === 'full_match'". Two options were weighed: (a) implement the two-signal AND predicate from the backlog note (chosen — it's the most direct, specific evidence of the user's actual considered intent, recorded in their own words during the session that spawned this whole epic; a single-signal 0.5 cutoff would let a high-confidence but structurally-vague match, e.g. `match_by_city_or_district` at `confidence: 0.9`, still link a coordinate that's only "probably somewhere in the right city," which is exactly the class of overconfident-but-imprecise match this epic exists to catch); (b) implement only `confidence >= 0.5` per epics.md's literal, single-signal AC wording (simpler; a strictly more permissive reading of "confidence threshold"). **Chosen: (a).** This was escalated via `AskUserQuestion`; no answer was received in this session, so the recommended, higher-fidelity-to-recorded-intent option was taken, flagged for explicit confirmation before `bmad-dev-story` begins implementation.
- **Scoping note on why the AND predicate is safe here despite `getPlaceDetails`'s synthetic `confidence: 1`/`matchType: 'PLACE_ID_EXACT'` (Story 0.i7a Design Decision 2):** that synthetic value would fail this story's `matchType === 'full_match'` check even though it's documented as "maximally confident." This is **not** a live bug for this story's actual scope: `Schedule.locationDetails` (what `mapper.ts` reads) is populated exclusively via `resolve-account-and-locations.ts`'s `{ kind: 'ADDRESS' }` query into `geocodeAddress` (confirmed in Story 0.i7a's Dev Notes and `resolve-account-and-locations.ts`), never via `{ kind: 'PLACE_ID' }`/`getPlaceDetails` — that path is only reachable from `apps/backend/src/schema/resolvers.ts`'s user-supervised mutations/queries (Story 0.i7d's scope: `setAccountDefaultLocation`, `createUserLocation`, `previewLocation`, etc.), which do not feed the event-detail map link. `isLocationTrustworthy` is written as a small, generic, reusable predicate (per AC5) and *could* be reused later against a `PLACE_ID_EXACT`-sourced value by a future story, but that is explicitly out of this story's scope (0.i7d's own AC states "no new UX gating/warning behavior is required" for its five call sites) — not a gap this story needs to close.
- **IDEA-023's richer fallback-string composition is deliberately not implemented here.** The backlog note also floats building the untrusted-fallback query from "the fullest available context (place text + whatever city/province/country IS known...)" rather than the bare `s.location` string, explicitly because a bare ambiguous string may be *why* confidence was low in the first place. However, that same note ends with: "Threshold value and exact fallback-string composition still need to be finalized against real low-confidence examples once BUG-027 ships the field — **not yet scoped into a story**." epics.md's actual AC for this story only asks for "a text query," matching today's existing fallback shape exactly (AC2/AC3 above). Building the richer composition is out of scope here (see Out of Scope) — implementing it would silently expand this story beyond its own epics.md text into work the backlog itself says isn't finalized/scoped yet.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one real mismatch found and resolved directly in this story's design (Task 1), not left to surface mid-implementation.** `@festgrid/shared-types`'s `LocationDetails.confidence?: number`/`matchType?: string` are optional properties (`T | undefined`, key may be entirely absent) — the shape used by backend/domain code (e.g. Story 0.i7b's `selectBestCandidate(candidates: LocationDetails[])`). But the value `isLocationTrustworthy` will actually be called with in this story is `apps/web`'s GraphQL-codegen-generated `GetEventBySlugQuery` type, where a nullable SDL field (`confidence: Float`, no `!`) is generated as `confidence: number | null` — the key is always present, typed to include `null`, not made optional. `number | null` is not assignable to an optional `number | undefined` parameter under TypeScript strict mode. **Resolution:** `isLocationTrustworthy` takes its own small local structural type (`LocationConfidenceSignal { confidence?: number | null; matchType?: string | null }`, Task 1) rather than importing/`Pick`-ing `@festgrid/shared-types`'s `LocationDetails` — this makes it correctly accept values from either shape (GraphQL-generated `| null`, or backend/domain `| undefined`) without a cast, and is itself a documented, deliberate divergence from Story 0.i7b's `selectBestCandidate`, which correctly *does* import `LocationDetails` directly since it only ever receives backend-constructed values, never a GraphQL-codegen type.
- **Impacted fields/contracts:** `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` operation (additive selection-set fields); `apps/web/src/generated/graphql.ts`'s `GetEventBySlugQuery` type (additive, regenerated by codegen, not hand-edited); new `packages/domain/src/geolocation/is-location-trustworthy.ts` exports (additive). No existing field/contract is modified or removed.
- **Required DB migration changes:** None. No schema/DDL/data migration of any kind — `confidence`/`matchType` already live inside the existing `location_details` JSONB column (Story 0.i7a), and this story only changes which already-fetched value gets read into which URL branch on the frontend.
- **Required TypeScript type changes:** None beyond the codegen regen (Task 2, mechanical/generated, not hand-written) and the new, additive `isLocationTrustworthy`/`LocationConfidenceSignal`/`MIN_TRUSTWORTHY_CONFIDENCE`/`TRUSTWORTHY_MATCH_TYPE` exports from `packages/domain` (Task 1).
- **Backward compatibility and rollout notes:** Purely additive on the GraphQL/query side — no existing query, resolver, or consumer of `GetEventBySlugQuery` needs to change; the new fields are simply unused by anything except `mapper.ts`'s new branch. The one behavior change (not a compatibility break, but worth stating plainly for rollout) is the accepted regression for pre-epic-0.i7 data described in Dev Notes above: any already-resolved schedule without a confidence signal will show a text-query map link instead of a coordinate link until next re-resolved. No sequencing constraint versus Story 0.i7a/0.i7b — both are already implemented in this worktree (`review` status) and this story only reads what they already produce.
- **Verification checks:** `packages/domain`'s new unit tests (Task 4) at 100% coverage; the new `apps/web/src/features/events/mapper.test.ts` (Task 4), specifically its `confidence: null, matchType: null` case, which is the actual shape a real un-re-resolved GraphQL response will have — not just `undefined`, which a hand-written fixture might default to without ever exercising the `null` path; `pnpm --filter web codegen` run cleanly with no type errors; `tsc`/lint clean for `packages/domain` and `apps/web`.

### Project Structure Notes

- **New file:** `packages/domain/src/geolocation/is-location-trustworthy.ts` (+ `.test.ts`) — pure, dependency-free (only reads two primitive-typed fields, no DB/ORM/Node-runtime coupling, no React), so it is safe to place in `packages/domain` with no frontend-safety caveat needed, following the same reasoning already applied to Story 0.i7b's `select-best-candidate.ts`. It is nested under `packages/domain/src/geolocation/` (not a generic subfolder) because it operates specifically on a Geoapify-confidence-shaped signal, not a generic cross-entity mechanism — matching the existing sibling files (`build-cache-key.ts`, `validate-autocomplete-input.ts`, `select-best-candidate.ts`).
- **Cross-package import precedent already exists:** `apps/web/src/features/events/mapper.ts` already imports `getPlatformSlug` from `@festgrid/domain/scraper` — this story's new `@festgrid/domain/geolocation` import (a *different* subpath, added alongside the existing one) is not a new cross-package pattern, just a new subpath consumed from the frontend for the first time. `@festgrid/domain/geolocation` is already `dist`-built (consumed by `apps/backend` since Story 0.i7a/0.i7b); no new build-output wiring is needed.
- No `packages/ui` changes — `EventDetailView.tsx`/`ScheduleDetail` are unaffected (see Dev Notes).
- Testing convention: `packages/domain` follows its established `node:test` + `node:assert/strict` convention (`tsx --test "src/**/*.test.ts"`) for `is-location-trustworthy.test.ts`, matching `select-best-candidate.test.ts`'s style exactly. `apps/web`'s new `mapper.test.ts` uses `vitest` (this repo's `apps/*` test runner per `apps/web/package.json`'s `"test": "vitest run"`), as a direct unit test of a pure function — no `msw`/network mocking needed since `mapGraphQLEventToDetailViewProps` takes a plain object, not a live query result — following the precedent already set in this same directory by `queries.graphql.test.ts` and `use-ai-filter.test.ts` (plain `.test.ts`, not `.test.tsx`, since no JSX/rendering is involved).

### Latest Technical Specifics (web research)

- No new library/dependency/version consideration applies — this story adds no new runtime dependency to any package, and does not call Geoapify's API directly (it only reads a field Story 0.i7a already populated). Geoapify's `rank.confidence`/`rank.match_type` semantics were already verified in Story 0.i7b's Dev Notes (0-1 aggregate score; `full_match` is the most specific documented `match_type` value) — cited here, not re-verified.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i7c] (and sibling Stories 0.i7a/0.i7b/0.i7d/0.i7z for cross-story context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-i7-readiness.md] (Gate 1 finding #4 — the SDL/query/codegen gap this story's AC4 closes)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-023, #BUG-027] (the user's own recorded design note — "confidence >= 0.5 AND match_type === 'full_match'" — Design Decision 1's source)
- [Source: _bmad-output/implementation-artifacts/0-i7a-carry-confidence-and-country-bias-through-every-geoapify-response-mapper.md] (SDL field declarations, `LocationDetails.confidence` graceful-degradation comment, `resolve-account-and-locations.ts`'s ADDRESS-only resolution path)
- [Source: _bmad-output/implementation-artifacts/0-i7b-re-rank-sub-venue-matches-using-the-confidence-signal.md] (`select-best-candidate.ts` — sibling-file/export/placement convention this story's new file follows)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-14] (Geoapify Confidence Signal Propagation, Rule 2 — "absence of the signal means untrusted")
- [Source: apps/web/src/features/events/mapper.ts] (current `mapUrl` construction — the exact branch this story changes)
- [Source: apps/web/src/features/events/queries.graphql] (`getEventBySlug`'s current `schedules.locationDetails` selection set — the exact fields this story adds to)
- [Source: apps/web/src/generated/graphql.ts] (confirmed: base `LocationDetails` type already has `confidence`/`matchType`; `GetEventBySlugQuery`'s narrower operation type does not, until this story's codegen regen)
- [Source: apps/web/codegen.ts, apps/web/package.json#scripts.codegen] (codegen invocation this story's Task 2 runs)
- [Source: apps/backend/src/schema/geolocation.graphql, events.graphql] (`LocationDetails` SDL — already declares the fields this story's query now requests)
- [Source: packages/graphql-select/optimized-select.ts] (`buildOptimizedDrizzleSelect` — verified top-level-field-name-only behavior; confirms no backend change needed)
- [Source: packages/database/schema.ts#schedules] (`location_details` JSONB column — no DDL change needed)
- [Source: packages/shared-types/src/index.ts#LocationDetails] (the `confidence`/`matchType`-absence-means-untrusted comment written in anticipation of this story; the `T | undefined` shape that motivates this story's own local input type)
- [Source: apps/web/src/features/events/EventDetailWrapper.test.tsx] (existing `locationDetails: null` fixtures this story does not need to change)
- [Source: apps/web/src/features/events/queries.graphql.test.ts] (Story 3.7c AC1 guard — confirmed out of scope for `getEventBySlug`; precedent for direct Vitest unit-testing of pure/parsed logic in this same directory)
- [Source: packages/ui/src/features/events/EventDetailView.types.ts, EventDetailView.tsx] (`ScheduleDetail.mapUrl` — confirmed unaffected, renders whatever string it's given)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (packages/domain: pure/dependency-free placement confirmed above; cross-package import precedent already exists), Testing Rules (100%-coverage rule for the new domain file; apps/web testing-trophy guidance and its documented local-precedent override for this specific, previously-untested file)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-14 (Geoapify Confidence Signal Propagation), cited not amended
- [x] `docs/infrastructure/index.md`, `docs/infrastructure/5-geolocation.md` — Geoapify backend-layer architecture (no infra change in this story; read to confirm none was needed)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/domain/src/geolocation/is-location-trustworthy.ts` (new) — `isLocationTrustworthy`, `LocationConfidenceSignal`, `MIN_TRUSTWORTHY_CONFIDENCE`, `TRUSTWORTHY_MATCH_TYPE` (Task 1).
  - `packages/domain/src/geolocation/is-location-trustworthy.test.ts` (new) — unit tests, 100% coverage (Task 4).
  - `packages/domain/src/geolocation/index.ts` — add barrel export for the new file (Task 1).
  - `apps/web/src/features/events/queries.graphql` — add `confidence`/`matchType` to `getEventBySlug`'s `schedules.locationDetails` selection (Task 2).
  - `apps/web/src/generated/graphql.ts` — regenerated via `pnpm --filter web codegen` (Task 2; not hand-edited).
  - `apps/web/src/features/events/mapper.ts` — `mapUrl` branch gated on `isLocationTrustworthy` (Task 3).
  - `apps/web/src/features/events/mapper.test.ts` (new) — unit tests for the gated `mapUrl` branch (Task 4).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/3 (epic-wide sweep) → cited above; the one finding naming this story (AC4/Task 2) is this story's own scope, not a new gap.
  - `story-split-gate.md` Gate 2 → re-run fresh, no gap (Dev Notes).
  - Reusable-function-in-`packages/domain` rule (this workflow) → Task 1, Project Structure Notes.
  - Data Type Compatibility rule (this workflow) → dedicated section above; one real mismatch found and resolved via a local structural type, not left to surface mid-implementation.
- **Verification Plan:**
  - `tsx --test "src/**/*.test.ts"` (or the project's configured domain-package test command) — new `is-location-trustworthy.test.ts` green, 100% coverage.
  - `pnpm --filter web codegen` — clean regen, `GetEventBySlugQuery` gains `confidence`/`matchType` on its `locationDetails` type with no type errors elsewhere in `apps/web`.
  - `pnpm --filter web test` (`vitest run`) — new `mapper.test.ts` green; existing `EventDetailWrapper.test.tsx`/`queries.graphql.test.ts` unaffected and still passing.
  - `tsc`/lint clean for `packages/domain` and `apps/web`.
  - Manual/integration sanity: confirm a real `getEventBySlug` GraphQL response for a schedule with a resolved, high-confidence `full_match` location includes non-null `confidence`/`matchType` in its `locationDetails`, and that the rendered event-detail page's map link points at the coordinate query for that schedule (and at a text query for a schedule whose resolved location predates Story 0.i7a).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Tasks 1–4 above match the intended scope (one new domain predicate function, one query-selection + codegen change, one call-site wire-up, tests); no scope expansion into 0.i7a's/0.i7b's/0.i7d's territory, and no implementation of IDEA-023's richer disambiguated-fallback-string composition (explicitly deferred — see Out of Scope).
- [ ] Architecture and boundary confirmation — new logic placed in `packages/domain/src/geolocation/` (pure, dependency-free, no DB/ORM/Node-runtime coupling, confirmed in Project Structure Notes); no `packages/ui` change; no backend/resolver/SDL change (0.i7a already declared the fields; `buildOptimizedDrizzleSelect` verified to need no change).
- [ ] Testing plan confirmation — Task 4's test list covers every branch of the predicate (confidence bar, matchType equality, `undefined`-vs-`null` absence, boundary `>=`) and the frontend's actual gated behavior (trustworthy/untrustworthy/legacy-`null`/no-`locationDetails`/no-`location` cases).
- [ ] **Design Decision 1 (gating predicate — recommended: `confidence >= 0.5 AND matchType === 'full_match'`, per the user's own recorded backlog note) — explicit human approval required.** Escalated via `AskUserQuestion` during this story's creation; no answer was received in that session. Proceeding with the recommended, higher-fidelity-to-recorded-intent option is **provisional** pending explicit confirmation or override before `bmad-dev-story` begins implementation.
- [ ] Explicit human approval state (Default: **pending approval**)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 findings already resolved inline (epic readiness sweep; this story's own AC4 closes the one finding naming it); Gate 2 fresh check found no gap.

## Testing Requirements

- [ ] Unit tests — `packages/domain/src/geolocation/is-location-trustworthy.test.ts`, 100% coverage (project-context's domain-package rule).
- [ ] Unit tests — `apps/web/src/features/events/mapper.test.ts` (new; direct Vitest unit test of the pure mapping function, per the local-precedent override documented in Dev Notes/Project Structure Notes).
- [ ] Integration tests — none required beyond the above; no resolver/backend code changes in this story to integration-test.
- [ ] E2E tests — not applicable; this is a narrow URL-construction gating change on an existing page, not a new user-facing flow. (A future manual/E2E smoke check of the rendered map link against a real high- and low-confidence event is worth doing post-deploy, per the Verification Plan's manual sanity step, but is not a blocking E2E test for this story.)
- [ ] Migration verification — not applicable; no migration in this story.

## Deliverables Checklist

- [ ] `isLocationTrustworthy` implemented, exported from `@festgrid/domain/geolocation`, 100%-unit-test-covered.
- [ ] `apps/web`'s `getEventBySlug` query requests `confidence`/`matchType` on `schedules.locationDetails`; codegen regenerated cleanly.
- [ ] `mapper.ts`'s `mapUrl` branch gated on `isLocationTrustworthy`; text-query fallback unchanged in shape.
- [ ] New `mapper.test.ts` proves the coordinate link only appears for a trustworthy `locationDetails`, and that legacy/absent-signal data falls back to text (BUG-027/IDEA-023 regression coverage).
- [ ] Existing `EventDetailWrapper.test.tsx`/`queries.graphql.test.ts` assertions unchanged and still passing.
- [ ] Lint/type-check clean for `packages/domain` and `apps/web`.

## Out of Scope

- Country-bias threading, cache eviction, and the `LocationDetails` SDL field declarations themselves — all Story 0.i7a (already implemented).
- Re-ranking `geocodeAddress`'s candidates by confidence — Story 0.i7b (already implemented).
- Exposing `confidence`/`matchType` through `setAccountDefaultLocation`/`editAccountDefaultLocation`/`createUserLocation`/`updateUserLocation`/`previewLocation` — Story 0.i7d.
- The CI-enforced ratchet checking that every one of the 7 known `resolveLocation()` consumers reads the signal — Story 0.i7z.
- **IDEA-023's richer disambiguated-fallback-string composition** (building the untrusted-fallback query from place text + known city/province/country rather than the bare `s.location` string) — explicitly not finalized/scoped per the backlog note itself; this story implements only the simpler text-query fallback epics.md's AC actually asks for. A future story could pick this up once real low-confidence examples are available to tune it against.
- Any change to how confidence/matchType are computed or ranked (that's Stories 0.i7a/0.i7b) — this story only reads the already-computed value and decides a URL shape from it.
- Any UI/visual change to how the map link is presented (icon, label, styling) — only which URL it points at changes.

## Definition of Done

- [ ] AC 1–5 satisfied.
- [ ] Required tests passing (Task 4 + Testing Requirements).
- [ ] Lint and type checks passing for `packages/domain` and `apps/web`.
- [ ] Design Decision 1 explicitly confirmed or overridden by the user (Pre-Coding Approval Gate) before this story is marked done.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
