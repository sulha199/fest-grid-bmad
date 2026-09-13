# Story 0.i7d: Expose confidence/matchType through the remaining Geoapify-consuming mutations and the location-preview query

## Story Details

- Epic: 0.i7 (Confidence-aware Geoapify location resolution)
- Story ID: 0.i7d
- Baseline commit: 49941fe
- Status: ready-for-dev
- Depends on: Story 0.i7a (status `review` in `sprint-status.yaml` — pending code-review sign-off, but its code is already present and verified in this worktree at the baseline commit above: `LocationDetails`'s SDL type already declares `confidence: Float`/`matchType: String`/`countryCode: String` in `apps/backend/src/schema/geolocation.graphql`'s `extend type LocationDetails` block, and every backend resolver this story's five consumers use already spreads the full `LocationDetails` object through via `formatLocationDetails()` with no field whitelist. This story's whole job is the one remaining gap: `apps/web`'s three GraphQL operation documents don't yet select the fields.)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `setAccountDefaultLocation`, `editAccountDefaultLocation`, `createUserLocation`, `updateUserLocation`, and the `previewLocation` query (all in `apps/backend/src/schema/resolvers.ts`) to expose `confidence`/`matchType` on the `LocationDetails` they return instead of silently discarding it,
so that the epic's invariant ("no consumer uses a Geoapify-resolved location without reading its confidence signal") actually holds for every call site into `resolveLocation`, not just the two originally scoped, and Story 0.i7z's ratchet has real behavior to enforce rather than policing consumers that were never built to read the signal.

## Acceptance Criteria

1. **Given** `setAccountDefaultLocation`'s and `editAccountDefaultLocation`'s GraphQL response (`apps/web/src/features/subscriptions/mutations.graphql`), **when** either mutation resolves a location, **then** its `defaultLocation` selection set requests `confidence` and `matchType` (the SDL fields Story 0.i7a already added to the shared `LocationDetails` type), and `pnpm --filter web codegen` has been run so the generated operation types actually expose them.
2. **Given** `createUserLocation`'s and `updateUserLocation`'s GraphQL response (`apps/web/src/features/locations/mutations.graphql`), **when** either mutation resolves a location, **then** its `locationDetails` selection set requests `confidence` and `matchType`, and codegen has been regenerated accordingly.
3. **Given** the `previewLocation` query's GraphQL response (`apps/web/src/features/locations/queries.graphql`), **when** it resolves a location, **then** its selection set requests `confidence` and `matchType` alongside the existing `provider` field, and codegen has been regenerated accordingly.
4. **Given** all three `.graphql` files above, **when** a developer or CI inspects them, **then** an automated test parses each file's AST and asserts the five named operations (`setAccountDefaultLocation`, `editAccountDefaultLocation`, `createUserLocation`, `updateUserLocation`, `previewLocation`) select both `confidence` and `matchType` — giving this story's own AC a concrete, regression-proof check rather than relying on manual review.
5. **Given** this story's scope, **when** it ships, **then** no new UX gating/warning behavior is introduced on any of the five flows — they remain user-supervised (search/autocomplete/map-pin selection, or a moderator's explicit correction), a different trust model from Stories 0.i7b/0.i7c's AI-best-effort matching. Exposing the signal (not discarding it) is what closes the Gate 3 gap; no resolver logic, no React component, and no visual state changes.

**Depends on:** Story 0.i7a.

**Note (from epics.md):** Added 2026-09-13 via `bmad-epic-readiness-check` (Gate 3): the epic's invariant is unqualified ("no consumer..."), but only 2 of 7 known `resolveLocation()` call sites had any story touching their confidence handling. User confirmed via AskUserQuestion to widen coverage to all 7 rather than carve out a subset. This story is the minimal, honest way to make that widened ratchet enforce something real instead of failing CI against consumers no story ever built to read the signal.

## Tasks / Subtasks

- [ ] **Task 1 — `apps/web/src/features/subscriptions/mutations.graphql`: add `confidence`/`matchType` (AC: 1)**
  - [ ] In `setAccountDefaultLocation`'s selection set, add `confidence` and `matchType` as siblings of the existing `coordinates { lat lng }`, `formattedAddress`, `placeName` fields under `defaultLocation`.
  - [ ] In `editAccountDefaultLocation`'s selection set, add the same two fields under its own `defaultLocation` block (leave `hasPendingDefaultLocationReview` untouched — it is a sibling field on the mutation payload, not nested under `defaultLocation`).

- [ ] **Task 2 — `apps/web/src/features/locations/mutations.graphql`: add `confidence`/`matchType` (AC: 2)**
  - [ ] In `createUserLocation`'s selection set, add `confidence` and `matchType` under `locationDetails`, alongside the existing `formattedAddress`, `placeName`, `coordinates { lat lng }`.
  - [ ] In `updateUserLocation`'s selection set, add the same two fields under its own `locationDetails` block.
  - [ ] Leave `deleteUserLocation` untouched — it does not resolve or return a `LocationDetails` (returns only `id`), so it is not one of this epic's 7 `resolveLocation()` call sites.

- [ ] **Task 3 — `apps/web/src/features/locations/queries.graphql`: add `confidence`/`matchType` (AC: 3)**
  - [ ] In `previewLocation`'s selection set, add `confidence` and `matchType` as siblings of the existing `formattedAddress`, `placeName`, `coordinates { lat lng }`, `provider` fields.
  - [ ] Leave `getMyLocations` and `addressAutocomplete` untouched — `getMyLocations` reads already-resolved, already-stored `LocationDetails` (covered by the same `locationDetails` shape as Task 2's mutations, but is itself a read-only listing query, not one of the epic's named 7 write/preview call sites; extending it is optional polish, see Out of Scope), and `addressAutocomplete` calls `getAddressPredictions`, a distinct autocomplete-suggestion function that does not go through `resolveLocation` at all.

- [ ] **Task 4 — Regenerate codegen (AC: 1, 2, 3)**
  - [ ] Run `pnpm --filter web codegen` (runs `graphql-codegen --config codegen.ts && node fix-codegen.js` per `apps/web/package.json`). This regenerates `apps/web/src/generated/graphql.ts` so `SetAccountDefaultLocationMutation`, `EditAccountDefaultLocationMutation`, `CreateUserLocationMutation`, `UpdateUserLocationMutation`, and `PreviewLocationQuery` each gain `confidence: number | null` and `matchType: string | null` on their respective nested `LocationDetails` object type. No backend change is required for this — see Dev Notes → Data Type Compatibility for why (the SDL declaration already exists from Story 0.i7a, and every resolver already spreads the full object through unconditionally).

- [ ] **Task 5 — Tests: AST-based selection-set guards (AC: 4)**
  - [ ] New `apps/web/src/features/subscriptions/mutations.graphql.test.ts`: parse `mutations.graphql`, assert `setAccountDefaultLocation` and `editAccountDefaultLocation` both select `confidence` and `matchType` (reuse the `collectSelectedFieldNames`/`findOperation` AST-walking pattern already established in `apps/web/src/features/events/queries.graphql.test.ts`, Story 3.7c's guard).
  - [ ] New `apps/web/src/features/locations/mutations.graphql.test.ts`: same pattern, asserting `createUserLocation` and `updateUserLocation` both select `confidence` and `matchType`.
  - [ ] New `apps/web/src/features/locations/queries.graphql.test.ts`: same pattern, asserting `previewLocation` selects `confidence` and `matchType`.
  - [ ] Confirm `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.test.tsx` and `apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx` still pass unchanged — their MSW handlers build hand-written `HttpResponse.json({...})` payloads that are not validated against the generated operation type, so adding optional fields to the real query/mutation documents cannot break them (see Dev Notes → Data Type Compatibility). No edits needed to either file.

## Dev Notes

- **Scope: `apps/web` GraphQL-document-only.** Three `.graphql` files gain two field selections each (six total), plus a mechanical codegen regen and three new guard tests. No `apps/backend` change, no GraphQL SDL change (Story 0.i7a already declared the fields on the shared `LocationDetails` type), no database migration, no `packages/domain` or `packages/ui` change, no React component change.
- Source of truth for scope: `_bmad-output/planning-artifacts/epics.md` Story 0.i7d (added 2026-09-13 via `bmad-epic-readiness-check`'s Gate 3 sweep — see `epic-readiness/epic-0-i7-readiness.md`). Do not re-derive Gate 1/Gate 3 findings; they're cited below.
- **Current code state (read in full before drafting this story):**
  - All five operations' GraphQL response types resolve, directly or via a nested type, to the single shared `LocationDetails` SDL type: `apps/backend/src/schema/user-locations.graphql` declares `UserLocation.locationDetails: LocationDetails!` (used by `createUserLocation`/`updateUserLocation`); `apps/backend/src/schema/social-media-accounts.graphql` declares `SocialMediaAccountProfile.defaultLocation: LocationDetails` (used by `setAccountDefaultLocation`/`editAccountDefaultLocation`); `apps/backend/src/schema/geolocation.graphql` declares `previewLocation(...): LocationDetails!` directly. Story 0.i7a's `extend type LocationDetails { provider, confidence: Float, matchType: String, countryCode: String }` (same file) already applies to every one of these — it is one shared type, not per-consumer, so no SDL change is needed here.
  - Every one of the five resolvers in `apps/backend/src/schema/resolvers.ts` was read in full. Each already calls `formatLocationDetails()` on the resolved value (or, for `createUserLocation`/`updateUserLocation`, spreads `created.locationDetails`/`updated.locationDetails` through `formatLocationDetails()`) with **no field whitelist** — confirmed line-by-line: `setAccountDefaultLocation` (line ~726), `editAccountDefaultLocation` (line ~827), `createUserLocation` (line ~903), `updateUserLocation` (line ~962), `previewLocation` (line ~2591, `return formatLocationDetails(resolved) as any`). This is exactly the same "full-object-spread, no whitelist" property Story 0.i7c's Gate 1 finding #4 already confirmed for the event/schedule path — it holds identically here. **Zero resolver code changes are needed.**
  - `apps/web`'s three relevant `.graphql` files were read in full and confirmed to be missing `confidence`/`matchType`:
    - `apps/web/src/features/subscriptions/mutations.graphql`: `setAccountDefaultLocation` selects `id`, `defaultLocation { coordinates { lat lng }, formattedAddress, placeName }`; `editAccountDefaultLocation` selects the same plus `hasPendingDefaultLocationReview`.
    - `apps/web/src/features/locations/mutations.graphql`: `createUserLocation`/`updateUserLocation` each select `id`, `name`, `locationDetails { formattedAddress, placeName, coordinates { lat lng } }`, `radius`, `createdAt`, `updatedAt`.
    - `apps/web/src/features/locations/queries.graphql`: `previewLocation` selects `formattedAddress`, `placeName`, `coordinates { lat lng }`, `provider` — the presence of `provider` (a field also added via Story 0.i7a's `extend type` block) confirms this file has already been touched once before for an identical additive-field reason, so this story's edit is a mechanical continuation of an established pattern, not a new one.
  - **`buildOptimizedDrizzleSelect` re-confirmed for the two operations that use it** (`setAccountDefaultLocation`/`editAccountDefaultLocation`, both call `buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info)`): per Story 0.i7c's already-verified behavior, this optimizer matches top-level GraphQL field names against Drizzle columns and includes the whole column on a match — it does not drill into a nested selection like `defaultLocation.confidence`. Since `defaultLocation` (the top-level field, mapping to the whole `default_location` JSONB column) is already requested today, adding `confidence`/`matchType` to its *nested* selection changes nothing about what is fetched from Postgres. `createUserLocation`/`updateUserLocation` don't use this optimizer at all (they read/write the full row via plain `db.insert(...).returning()`/`db.update(...).returning()`); `previewLocation` never touches the database (its `LocationDetails` comes straight from `resolveLocation()`, an in-memory value). No backend fetch-shape change anywhere in this story.
  - Consumers of these five operations were located: `apps/web/src/app/[locale]/settings/locations/{map-picker-sheet,location-form-dialog}.tsx`, `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx`, and `apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx` (the last only checks a mutation key string, `event.mutation.options.mutationKey?.[0] === "editAccountDefaultLocation"`, not any response field). None of these four files read `confidence`/`matchType` today, and per AC 5 none is required to — they need zero code changes.
  - Existing tests for these consumers (`set-default-location-dialog.test.tsx`, `location-form-dialog.test.tsx`) build their mocked GraphQL responses via `msw`'s `HttpResponse.json({...})`/`graphql.mutation(...)` returning hand-written plain objects — these are not type-checked against the generated `...Mutation`/`...Query` result types, so they will continue to compile and pass unchanged after this story's additive selection-set changes (confirmed by reading both files' mock-response bodies).
- **Architecture Spine cross-reference:** `AD-14: Geoapify Confidence Signal Propagation` (Story 0.i7a) Rule 2 says "every new consumer must read the signal before trusting a result... absence of the signal means untrusted." This story deliberately does **not** implement Rule 2's "read before trusting" behavior for these five flows — AC 5 and the epics.md Note both make that an explicit, scoped exception: these are user-supervised flows (the human already chose/confirmed the specific place via autocomplete, map-pin, or a moderator's manual correction), not an AI-best-effort match a user never reviewed. Exposure (this story) closes the Gate 3 coverage gap; any future "warn the user editing a low-confidence saved location" UI is a distinct, not-yet-scoped story.

### Architecture & UX Gate Findings

- **Epic readiness report:** `_bmad-output/planning-artifacts/epic-readiness/epic-0-i7-readiness.md` (`swept: true`, covers 0.i7a–0.i7z). Gate 1 and Gate 3 were already run epic-wide; this story (0.i7d) is itself Gate 3's own output (the finding that only 2 of 7 `resolveLocation()` call sites had a story touching confidence handling). No further Gate 1/Gate 3 re-derivation performed here, per this report's own "Next step" instruction to skip Gate 1/3 per-story and cite the report directly.
- **Gate 2 (UI Complexity & Reusability), run fresh for this story** (one-shot analysis dispatched to a subagent with Freya's/WDS analytical lens, evidence inlined from this story's actual verified code scope rather than re-derived cold): **No gap found.** Verbatim verdict: "The story's entire scope is additive GraphQL field selection (2 fields × 3 files) plus a codegen run against an already-extended shared SDL type — no new component, hook, or client-side utility is implicated. The 4 consuming components... need zero changes and the AC explicitly forbids new UX gating/warning behavior, so there's no hidden visual state or interaction logic being smuggled in... This is structurally identical to 0.i7c, which cleared the same gate for the same reason. No UX artifact (DESIGN.md/EXPERIENCE.md) anticipates a treatment for confidence/matchType on these five flows... Split not warranted." `design-artifacts/{UX-festgrid-run-1,UX-wizard-page-run-1}/{DESIGN,EXPERIENCE}.md` were checked directly for "confidence"/"matchType"/"match_type" — zero matches, confirming no UX spec anticipates any visual treatment being deferred out of this story.
- **Lightweight guard (per this workflow's escape hatch):** reasoned over this story's actual scope (three `.graphql` selection-set edits, one codegen regen, three new AST-parsing guard tests) for anything the epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new infra dependency is introduced. Nothing here warranted re-running Gate 1/3 fresh.
- **Forward-looking note for Story 0.i7z (not a gap in this story's own scope, flagged so its future author isn't blindsided):** epics.md's current 0.i7z AC text says its CI ratchet will check that these same five operations, "all in `apps/backend/src/schema/resolvers.ts`," don't "read a resolved location without checking confidence/matchType first." Because this story (by design — AC 5, and the recommended option below) makes zero changes to `resolvers.ts` — the exposure gap is entirely in the three `apps/web` `.graphql` files — there will be nothing in `resolvers.ts` itself for a future static check to inspect for these five consumers; the actual, verifiable invariant this story establishes lives in the `.graphql` selection sets (and is already proven by this story's own Task 5 guard tests). When Story 0.i7z is drafted, its author should point its check for these five consumers at the `apps/web` `.graphql` files (or reuse/extend this story's own guard tests) rather than at `resolvers.ts` source, or otherwise reconcile the wording. See Design Decisions below for the escalation this was raised through.

### Design Decisions (escalated to the user via `AskUserQuestion`; no response received in this session — proceeding with the recommended option per the question's framing, flagged below and in Pre-Coding Approval Gate for explicit confirmation before implementation starts)

**Design Decision 1 — how to resolve the 0.i7z ratchet-wording mismatch described above.** Two options were weighed: (a) keep this story scoped exactly to epics.md's literal AC text — pure `apps/web` GraphQL-selection exposure, zero `resolvers.ts` changes — and leave the resolvers.ts-vs-.graphql-files wording mismatch as a note for Story 0.i7z's own future author to resolve when that story is drafted (chosen — matches this story's explicit AC 5 "no new UX gating/warning behavior," matches the established 0.i7c precedent of pure-exposure-via-query-selection with zero resolver changes, and doesn't speculatively build logic for a CI check whose exact shape hasn't been designed yet); (b) proactively add a minimal explicit read of `confidence`/`matchType` inside each of the five `resolvers.ts` functions now (e.g., a structured log line), purely so a future static check against `resolvers.ts` source would have something concrete to detect (rejected as this story's default: it is backend logic beyond pure GraphQL exposure, not required by any AC, speculative about a check design that doesn't exist yet, and risks diverging from whatever Story 0.i7z's author actually decides to check). **Chosen: (a).** This was escalated via `AskUserQuestion` during this story's creation; no answer was received in this session — proceeding with the recommended option, flagged for explicit confirmation before `bmad-dev-story` begins implementation.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found.** `confidence`/`matchType` already exist on the GraphQL SDL `LocationDetails` type (Story 0.i7a) and on `packages/shared-types`'s `LocationDetails` TS interface (also Story 0.i7a) as optional, nullable fields. This story only changes which already-declared fields five specific frontend query/mutation *documents* select — it introduces no new field anywhere, so there is nothing to reconcile between DB schema, API contract, and TypeScript types beyond what Story 0.i7a already resolved.
- **Impacted fields/contracts:** `apps/web/src/features/subscriptions/mutations.graphql` (`setAccountDefaultLocation`, `editAccountDefaultLocation` selection sets — additive); `apps/web/src/features/locations/mutations.graphql` (`createUserLocation`, `updateUserLocation` selection sets — additive); `apps/web/src/features/locations/queries.graphql` (`previewLocation` selection set — additive); `apps/web/src/generated/graphql.ts`'s five corresponding generated Operation Result types (regenerated, not hand-edited — each gains `confidence: number | null` and `matchType: string | null` on a nested object, matching the exact shape codegen already produced for `GetEventBySlugQuery` in Story 0.i7c).
- **Required DB migration changes:** None. No schema/DDL/data migration of any kind.
- **Required TypeScript type changes:** None beyond the codegen regen (Task 4, mechanical/generated, not hand-written).
- **Backward compatibility and rollout notes:** Purely additive on the GraphQL query/mutation-document side — every field added is nullable and no existing selection is removed or renamed, so no existing consumer of any of these five operations' generated types needs to change. The four React components consuming these operations (Dev Notes above) compile unchanged since they destructure only the fields they already used; TypeScript's structural typing does not require a consumer to read every field a generated type exposes. No sequencing constraint versus Story 0.i7a (already implemented in this worktree, `review` status) — this story only reads what it already produced.
- **Verification checks:** the three new AST-based guard tests (Task 5) proving each operation's selection set literally contains `confidence` and `matchType`; `pnpm --filter web codegen` run cleanly with no type errors; `pnpm --filter web test` (existing `set-default-location-dialog.test.tsx`/`location-form-dialog.test.tsx` unaffected and still passing); `tsc`/lint clean for `apps/web`.

### Project Structure Notes

- **New files:** `apps/web/src/features/subscriptions/mutations.graphql.test.ts`, `apps/web/src/features/locations/mutations.graphql.test.ts`, `apps/web/src/features/locations/queries.graphql.test.ts` — all follow the exact AST-parsing pattern already established by `apps/web/src/features/events/queries.graphql.test.ts` (Story 3.7c's guard: `parse()` the `.graphql` source with the `graphql` package, walk the selection set via a shared `collectSelectedFieldNames`/`findOperation` helper shape, assert on field-name presence). No new test framework or pattern introduced.
- **No `packages/domain` change:** this story adds no reusable function/mechanism — it only changes which fields three existing GraphQL documents request. Per the project's reusable-mechanism rule, a plain field-selection edit is not a "function/mechanism" candidate for `packages/domain`.
- **No `packages/ui` change:** per Gate 2 above, no new or reusable UI component/hook is introduced.
- **No new state management:** this story introduces no new React Query hook, URL param, or Zustand store. The existing generated `useSetAccountDefaultLocationMutation`/`useEditAccountDefaultLocationMutation`/`useCreateUserLocationMutation`/`useUpdateUserLocationMutation`/`usePreviewLocationQuery` hooks (from `@graphql-codegen/typescript-react-query`, already Server State per project convention) are unchanged in identity and usage — only their generated result *type* gains two nullable fields.
- **No new async/loader UI:** no new user-triggered async flow is introduced; the four consuming components' existing loading-state handling for these mutations/query is untouched.
- **No analytics/PostHog change:** no new user interaction is introduced; nothing here changes what a user does, only what data already flows back after actions they already take.
- **No i18n change:** no new user-facing string is introduced.
- **No cloud/external service setup:** no new external service; `SETUP_WALKTHROUGH.md` is unaffected.
- **AD-1/AD-2 Unified Query DSL:** not applicable — this story touches single-entity mutations/a single-entity preview query, not an event-collection retrieval.
- **Three-queue architecture / AI Gateway adapter (Gate 1's project-wide check):** not applicable — no scraping, AI-processing, or data-ingestion queue code is touched.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i7d] (and sibling Stories 0.i7a/0.i7b/0.i7c/0.i7z for cross-story context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-i7-readiness.md] (Gate 3 finding — the widened-invariant gap this story exists to close)
- [Source: _bmad-output/implementation-artifacts/0-i7a-carry-confidence-and-country-bias-through-every-geoapify-response-mapper.md] (SDL field declarations on the shared `LocationDetails` type; `formatLocationDetails` full-spread confirmation precedent)
- [Source: _bmad-output/implementation-artifacts/0-i7c-gate-the-event-detail-map-link-on-location-confidence.md] (the established "query-selection + codegen, zero backend change" pattern this story mirrors; its Task 2/Dev Notes `buildOptimizedDrizzleSelect` verification reused here)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-14] (Geoapify Confidence Signal Propagation — cited, not amended; Rule 2's "read before trusting" is explicitly and deliberately not implemented for these 5 flows in this story, per AC 5)
- [Source: apps/backend/src/schema/resolvers.ts] (`setAccountDefaultLocation`, `editAccountDefaultLocation`, `createUserLocation`, `updateUserLocation`, `previewLocation` — read in full; each already calls `formatLocationDetails()`/spreads the resolved value with no field whitelist)
- [Source: apps/backend/src/schema/geolocation.graphql] (`extend type LocationDetails { provider, confidence, matchType, countryCode }` — the shared SDL declaration this story's queries newly select against)
- [Source: apps/backend/src/schema/user-locations.graphql, social-media-accounts.graphql] (`UserLocation.locationDetails: LocationDetails!`, `SocialMediaAccountProfile.defaultLocation: LocationDetails` — confirm all 5 operations resolve to the one shared type)
- [Source: apps/web/src/features/subscriptions/mutations.graphql] (current `setAccountDefaultLocation`/`editAccountDefaultLocation` selection sets — the exact fields this story adds to)
- [Source: apps/web/src/features/locations/mutations.graphql, queries.graphql] (current `createUserLocation`/`updateUserLocation`/`previewLocation` selection sets — the exact fields this story adds to)
- [Source: apps/web/codegen.ts, apps/web/package.json#scripts.codegen] (codegen invocation this story's Task 4 runs)
- [Source: apps/web/src/features/events/queries.graphql.test.ts] (AST-parsing guard-test pattern this story's Task 5 tests copy)
- [Source: apps/web/src/app/[locale]/settings/account/set-default-location-dialog.test.tsx, apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx] (confirmed hand-written, untyped MSW mock responses — unaffected by this story's additive selection changes)
- [Source: packages/graphql-select/optimized-select.ts] (`buildOptimizedDrizzleSelect` top-level-field-name-only behavior — re-confirmed applicable to `setAccountDefaultLocation`/`editAccountDefaultLocation`)

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Code Organization (no `packages/domain`/`packages/ui` addition, confirmed above); Testing Rules (`apps/web` testing-trophy/msw guidance and its documented local-precedent override for AST-based `.graphql` parsing tests, per `queries.graphql.test.ts`'s existing convention)
- [ ] `story-content-structure.md` — this story's section order/status vocabulary
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-14 (Geoapify Confidence Signal Propagation), cited not amended
- [ ] `docs/infrastructure/index.md` — no infra change in this story; read to confirm none was needed

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/web/src/features/subscriptions/mutations.graphql` — add `confidence`/`matchType` to `setAccountDefaultLocation`'s and `editAccountDefaultLocation`'s `defaultLocation` selection (Task 1).
  - `apps/web/src/features/locations/mutations.graphql` — add `confidence`/`matchType` to `createUserLocation`'s and `updateUserLocation`'s `locationDetails` selection (Task 2).
  - `apps/web/src/features/locations/queries.graphql` — add `confidence`/`matchType` to `previewLocation`'s selection (Task 3).
  - `apps/web/src/generated/graphql.ts` — regenerated via `pnpm --filter web codegen` (Task 4; not hand-edited).
  - `apps/web/src/features/subscriptions/mutations.graphql.test.ts` (new) — AST guard test (Task 5).
  - `apps/web/src/features/locations/mutations.graphql.test.ts` (new) — AST guard test (Task 5).
  - `apps/web/src/features/locations/queries.graphql.test.ts` (new) — AST guard test (Task 5).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/3 (epic-wide sweep) → cited above; this story is itself the Gate 3 output for the widened-invariant gap.
  - `story-split-gate.md` Gate 2 → re-run fresh, no gap (Dev Notes).
  - Data Type Compatibility rule (this workflow) → dedicated section above; no mismatch found, fully additive.
  - Reusable-function/reusable-UI rules (this workflow) → explicitly evaluated and found not applicable (Project Structure Notes).
- **Verification Plan:**
  - `pnpm --filter web codegen` — clean regen, all five generated Operation Result types gain `confidence`/`matchType` with no type errors elsewhere in `apps/web`.
  - `pnpm --filter web test` (`vitest run`) — new `mutations.graphql.test.ts` (×2) and `queries.graphql.test.ts` green; existing `set-default-location-dialog.test.tsx`/`location-form-dialog.test.tsx` unaffected and still passing.
  - `tsc`/lint clean for `apps/web`.
  - Manual/integration sanity: confirm a real `setAccountDefaultLocation`/`createUserLocation`/`previewLocation` GraphQL response for a resolved location includes non-null `confidence`/`matchType` when the underlying resolution actually carries the signal (i.e., was resolved after Story 0.i7a shipped).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Tasks 1–5 above match the intended scope (three `.graphql` selection-set edits, one codegen regen, three new AST guard tests); no scope expansion into 0.i7a's/0.i7b's/0.i7c's territory, and no new resolver/UI logic (see Design Decision 1 and Out of Scope).
- [ ] Architecture and boundary confirmation — no `packages/domain`/`packages/ui` change (Project Structure Notes); no backend/resolver/SDL change (0.i7a already declared the fields and every resolver already spreads them through unconditionally, verified by direct code read).
- [ ] Testing plan confirmation — Task 5's three new guard tests cover all five named operations selecting both `confidence` and `matchType`; existing consumer tests confirmed unaffected by direct read of their mock-response bodies.
- [ ] **Design Decision 1 (0.i7z ratchet-wording mismatch — recommended: pure exposure-only, zero `resolvers.ts` changes, flag the mismatch forward for 0.i7z's author) — explicit human approval required.** Escalated via `AskUserQuestion` during this story's creation; no answer was received in that session. Proceed with the recommended option, but require explicit user confirmation (or override) before `bmad-dev-story` begins implementation.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 findings already resolved via the epic readiness sweep (this story is itself that sweep's Gate 3 output); Gate 2 fresh check found no gap.

## Testing Requirements

- [ ] Unit tests — `apps/web/src/features/subscriptions/mutations.graphql.test.ts` (new; AST guard).
- [ ] Unit tests — `apps/web/src/features/locations/mutations.graphql.test.ts` (new; AST guard).
- [ ] Unit tests — `apps/web/src/features/locations/queries.graphql.test.ts` (new; AST guard).
- [ ] Integration tests — none required beyond the above; no resolver/backend code changes in this story to integration-test.
- [ ] E2E tests — not applicable; this is a narrow, non-behavioral GraphQL-selection change with no new user-facing flow or visible difference.
- [ ] Migration verification — not applicable; no migration in this story.
- [ ] Regression check — confirm `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.test.tsx` and `apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx` still pass unchanged (Dev Notes: their mocks are untyped and unaffected).

## Deliverables Checklist

- [ ] `setAccountDefaultLocation`/`editAccountDefaultLocation` (`apps/web/src/features/subscriptions/mutations.graphql`) select `confidence`/`matchType` on `defaultLocation`.
- [ ] `createUserLocation`/`updateUserLocation` (`apps/web/src/features/locations/mutations.graphql`) select `confidence`/`matchType` on `locationDetails`.
- [ ] `previewLocation` (`apps/web/src/features/locations/queries.graphql`) selects `confidence`/`matchType`.
- [ ] `apps/web/src/generated/graphql.ts` regenerated cleanly via `pnpm --filter web codegen`.
- [ ] Three new AST guard tests (Task 5) prove all five operations select both fields; existing consumer tests unchanged and passing.
- [ ] Lint/type-check clean for `apps/web`.

## Out of Scope

- **`getMyLocations` query's `confidence`/`matchType` exposure** (`apps/web/src/features/locations/queries.graphql`) — reads already-stored `LocationDetails` via the same shape as `createUserLocation`/`updateUserLocation`, but is not one of the epic's named 7 `resolveLocation()` call sites (it's a read-only listing of previously-created rows, not a resolution point). Extending it would be simple, mechanical polish following this exact story's pattern, but is not required by any AC and was left out to keep this story's scope matched exactly to epics.md's text. A future story (or a small follow-up) can add it if a consumer needs it.
- **Any UI that reacts to a low-confidence result on these five flows** (e.g., a "double-check this location" warning on the settings/moderator pages) — explicitly out of scope per AC 5 and the epics.md Note; these flows are user-supervised and a different trust model from 0.i7b/0.i7c's AI-best-effort matching. A future story may add this.
- **Resolving the 0.i7z ratchet-wording mismatch inside `resolvers.ts`** — per Design Decision 1's recommended (unconfirmed) option, this is deferred to Story 0.i7z's own drafting, not absorbed into this story.

## Definition of Done

- [ ] AC 1–5 satisfied.
- [ ] Required tests passing (Task 5 + Testing Requirements).
- [ ] Lint and type checks passing for `apps/web`.
- [ ] Design Decision 1 explicitly confirmed or overridden by the user (Pre-Coding Approval Gate) before this story is marked done.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Gate 1/3: cited from swept `epic-readiness/epic-0-i7-readiness.md` (this story is itself that sweep's Gate 3 output), not re-derived.
- Gate 2: re-run fresh (per-story requirement) — no gap found (zero UI surface; verbatim subagent verdict recorded in Dev Notes).
- Design Decision 1 (0.i7z ratchet-wording mismatch — recommended pure-exposure-only scoping) was escalated via `AskUserQuestion` but received no response in this session — proceeded with the recommended option, flagged for explicit confirmation in Pre-Coding Approval Gate.

### File List
