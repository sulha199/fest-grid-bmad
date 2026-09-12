# Story 0.i7b: Re-rank sub-venue matches using the confidence signal

## Story Details

- Epic: 0.i7 (Confidence-aware Geoapify location resolution)
- Story ID: 0.i7b
- Baseline commit: 6b788a61c8678df2e8906d5c664f2e12ca08b5ab
- Status: ready-for-dev
- Depends on: Story 0.i7a (status `review` in `sprint-status.yaml` — pending code-review sign-off, but its code is already present and verified in this worktree at the baseline commit above: `geocodeAddress` returns `Promise<LocationDetails[]>` of up to 5 candidates, and `adapter.ts`'s `resolveLocation` `ADDRESS` branch currently takes `candidates[0]`. This story's whole job is replacing that `[0]` index with real selection logic.)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want sub-venue lookups ("Grand Atrium, Pakuwon Mall Jogja") re-ranked against the new confidence signal rather than taking Geoapify's first result,
so that a low-confidence top hit no longer wins over a correct lower-ranked one (BUG-017).

## Acceptance Criteria

1. **Given** `resolveLocation` resolves an `ADDRESS` query whose `geocodeAddress` candidates include a low-confidence result at position 0 and a higher-confidence result at a later position, **when** `resolveLocation` runs, **then** it returns the higher-confidence candidate — not `candidates[0]`.
2. **Given** multiple candidates with distinct `confidence` values, **when** selecting the best one, **then** selection is primarily ordered by descending `confidence`; a candidate whose `confidence` is `undefined` is treated as strictly lower than any candidate with a defined `confidence` value (never preferred over one that has a signal at all).
3. **Given** two or more candidates whose `confidence` values are exactly equal (including the case where all are `undefined`), **when** selecting the best one, **then** the tie is broken by `matchType`, ranked by Geoapify's documented specificity ordering — `full_match` > `match_by_building` > `match_by_street` > `match_by_postcode` > `match_by_city_or_district` > `match_by_country_or_state` > `inner_part` — with any unrecognized or missing `matchType` value ranked below every recognized one; if still tied, the earliest candidate in the input array wins (deterministic, stable).
4. **Given** a single-candidate array (the common case for most `ADDRESS` queries, and unaffected for `PLACE_ID`/`COORDINATES` queries which don't route through this function at all), **when** selecting the best one, **then** that sole candidate is returned unchanged — no regression to today's behavior when there is nothing to re-rank.
5. **Given** this selection logic, **when** a developer needs to reuse or test it, **then** it lives as a pure, dependency-free, independently unit-tested function in `packages/domain/src/geolocation/select-best-candidate.ts` (packages/domain's 100%-unit-test-coverage rule) — not inlined into `adapter.ts` — so re-ranking can be verified and reasoned about without the network/cache layer.

## Tasks / Subtasks

- [ ] **Task 1 — Implement `selectBestCandidate` in `packages/domain/src/geolocation/select-best-candidate.ts` (AC: 2, 3, 4, 5)**
  - [ ] Define an ordered priority list of Geoapify's documented `rank.match_type` values (most-specific first): `['full_match', 'match_by_building', 'match_by_street', 'match_by_postcode', 'match_by_city_or_district', 'match_by_country_or_state', 'inner_part']` — verified against Geoapify's own forward-geocoding docs (see Dev Notes → Latest Technical Specifics). Any `matchType` string not in this list (including `undefined`) ranks below every entry in it — treat its tier as `list.length` (one past the last real tier), **not** as a match/no-match boolean, so an unrecognized value never accidentally ties with `inner_part`.
  - [ ] Export `selectBestCandidate(candidates: LocationDetails[]): LocationDetails`, comparing candidates pairwise by `(confidence ?? -Infinity)` descending, then by the match-type tier index ascending (lower index = higher priority) on an exact confidence tie, then by original array position (earliest wins) if still tied. Implement as a single reduce/loop that tracks the best-so-far candidate and its computed sort key, rather than sorting the whole array — this is simpler to reason about for a "find the max" operation and avoids depending on `Array.prototype.sort`'s stability semantics for the final tie-break (make the position tie-break explicit in the comparison instead).
  - [ ] Throw a descriptive `Error` if `candidates` is empty (defensive — `geocodeAddress` never returns an empty array successfully today, since it throws `GeolocationNotFoundError` first, but `selectBestCandidate` should not silently return `undefined` if that invariant ever changes).
  - [ ] Add `export * from './select-best-candidate.js';` to `packages/domain/src/geolocation/index.ts`, alongside the existing `types`/`build-cache-key`/`validate-autocomplete-input` exports, so it is importable as `@festgrid/domain/geolocation` (matching how `adapter.ts` already imports `buildLocationCacheKey` from that same subpath).

- [ ] **Task 2 — Wire `selectBestCandidate` into `resolveLocation`'s `ADDRESS` branch (AC: 1)**
  - [ ] In `apps/backend/src/lib/geolocation/adapter.ts`, import `selectBestCandidate` from `@festgrid/domain/geolocation` (already imported from that subpath for `buildLocationCacheKey`/`meetsAutocompleteInputThreshold`/`AddressPrediction` — add to the same import statement).
  - [ ] Replace `result = (await geocodeAddress(query.address, { countryBias: query.countryBias }))[0];` with two statements: fetch the candidates into a local `const candidates = await geocodeAddress(...)`, then `result = selectBestCandidate(candidates);`. Update the inline comment above it (currently says "take the top one to preserve today's top-first behavior exactly; re-ranking ... is explicitly Story 0.i7b's job, not this story's") to reflect that re-ranking now happens here.
  - [ ] No other branch (`COORDINATES`, `PLACE_ID`) changes — both remain single-result lookups untouched by this story, per AC 4.

- [ ] **Task 3 — Unit tests for `selectBestCandidate` (AC: 2, 3, 4, 5 — packages/domain 100%-coverage rule)**
  - [ ] `packages/domain/src/geolocation/select-best-candidate.test.ts`: cover (a) a single candidate is returned unchanged; (b) a lower-confidence candidate at index 0 loses to a higher-confidence candidate at a later index (the BUG-017 scenario, phrased in domain terms); (c) a candidate with `confidence: undefined` never beats one with a defined `confidence`, even a low one (e.g. `0.1`); (d) an exact-confidence tie is broken by `matchType` priority (e.g. two candidates both at `confidence: 0.8`, one `full_match` one `match_by_postcode` — `full_match` wins); (e) an unrecognized `matchType` string (e.g. a value outside the documented list) loses a tie to any recognized `matchType`, and two unrecognized values at an exact confidence tie fall through to array-position tie-break; (f) all candidates missing `confidence` and `matchType` entirely — first candidate wins deterministically (position tie-break), not `undefined`/a thrown error; (g) an empty array throws.
  - [ ] Confirm 100% line/branch coverage for the new file per project-context's domain-package testing rule (this is the "only place unit tests should be written" per that rule, and the rule requires 100% coverage there).

- [ ] **Task 4 — Integration tests for `resolveLocation`'s re-ranking behavior (AC: 1)**
  - [ ] `apps/backend/src/lib/geolocation/adapter.test.ts`: add a case mocking `fetch` so `geocodeAddress`'s underlying Geoapify response returns ≥2 results where the first (`data.results[0]`) has a lower `rank.confidence` than a later one, then assert `resolveLocation({ kind: 'ADDRESS', ... })` returns the higher-confidence result's `placeId`/`coordinates` — not the first one. This is the direct regression test for BUG-017 at the integration boundary (mirrors the "Grand Atrium, Pakuwon Mall Jogja" scenario: a generic/low-confidence top hit vs. a correct, more specific, higher-confidence one further down the list).
  - [ ] Confirm the existing single-result fixtures in `adapter.test.ts` (`cache miss calls geocodeAddress and writes through`, `cache hit skips Geoapify call`, `countryBias folds into cache key`) still pass unchanged — with exactly one candidate in the mocked response, `selectBestCandidate` has nothing to re-rank and must return that same candidate, so no existing assertion should need to change.

## Dev Notes

- This is a 100%-backend, no-UI story: `apps/backend/src/lib/geolocation/adapter.ts` and a new file in `packages/domain/src/geolocation/`. No `apps/web`, no React, no `packages/ui`, no GraphQL/SDL/codegen change, no database migration — this story only changes *which* already-fetched, already-typed candidate gets chosen.
- Source of truth for scope: `_bmad-output/planning-artifacts/epics.md` Story 0.i7b (single-AC epic text; expanded above into the 5 testable ACs per this workflow's requirement, without adding scope beyond the epic's stated intent).
- **Current code state (read in full before drafting this story):**
  - `apps/backend/src/lib/geolocation/geoapify-client.ts`'s `geocodeAddress(address, options?)` already returns `Promise<LocationDetails[]>` (top 5 candidates, `limit=5`), each independently carrying `confidence?`/`matchType?`/`countryCode?` via a conditional-spread `mapGeocodeResult` helper. This was Story 0.i7a's scope and is already implemented and tested (`geoapify-client.test.ts` has a passing multi-candidate retention test).
  - `apps/backend/src/lib/geolocation/adapter.ts`'s `resolveLocation`'s `ADDRESS` case currently reads: `result = (await geocodeAddress(query.address, { countryBias: query.countryBias }))[0];` — explicitly commented as preserving "today's top-first behavior exactly" and deferring re-ranking to this story. This is the single line this story must change.
  - `packages/shared-types/src/index.ts`'s `LocationDetails` already has `confidence?: number`, `matchType?: string`, `countryCode?: string` (all optional, added by 0.i7a) — no type changes needed here.
  - `packages/domain/src/geolocation/` already has `types.ts`, `build-cache-key.ts` (+ `.test.ts`), `validate-autocomplete-input.ts` (+ `.test.ts`), and `index.ts` barrel-exporting all three. This story adds a fourth sibling file following the same pattern.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** already run epic-wide by `bmad-epic-readiness-check` (`epic-readiness/epic-0-i7-readiness.md`, `swept: true`). Its only Gate 1 finding touching this story was "0.i7b unbuildable as scoped" (no candidate list existed to re-rank) — resolved by amending **Story 0.i7a**, not this one, to retain 5 candidates. That amendment is confirmed already implemented in this worktree (see Dev Notes above), so the prerequisite this finding created is satisfied. No other Gate 1/3 finding names this story. Not re-derived here.
- **Lightweight guard (per this workflow's escape hatch):** reasoned over this story's actual scope (a pure in-memory selection function over an already-fetched, already-typed array) for anything the epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new infra dependency is introduced. Nothing here warranted re-running Gate 1/3 fresh.
- **Gate 2 (UI Complexity & Reusability), run fresh for this story** (one-shot analysis dispatched to a subagent with Freya's/WDS analytical lens, evidence inlined from this story's actual code scope rather than re-derived cold): **No gap found.** The agent explicitly checked `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` and `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md` for `confidence`/`geocod`/`sub-venue`/`venue match`/`location resolv` — zero matches, confirming these UX artifacts don't specify any visual/interaction behavior this story's scope would be dropping. The story's only two code surfaces (`adapter.ts`'s `ADDRESS` branch, and a new pure `select-best-candidate.ts`) are neither a component nor a React hook/util — a synchronous array-selection function consumed by one backend call site, with the confidence signal itself invisible to users until Story 0.i7c's already-separate frontend/map-link work.

### Design Decisions (escalated to the user via `AskUserQuestion`; no response received in this session — proceeding with the recommended option per the question's framing, flagged below and in Pre-Coding Approval Gate for explicit confirmation before implementation starts)

**Design Decision 1 — ranking algorithm: confidence-only vs. confidence + `matchType` tiebreak.** Two options were weighed: (a) sort primarily by `confidence` descending, break an exact tie using a `matchType` priority table derived from Geoapify's documented specificity ordering (chosen — matches the epics.md AC's literal wording that both "confidence/matchType" are read, not confidence alone; avoids an arbitrary/position-dependent outcome when confidence ties, which is plausible with sparse or simplified test/mock data — 0.i7a's own fixtures already use non-canonical shorthand match-type strings like `city_match`/`postcode_match` rather than Geoapify's exact enum, suggesting ties are a real, not merely theoretical, concern); (b) sort by `confidence` descending only, breaking ties by original array position (simpler; grounded in Geoapify's own documentation, which states `rank.confidence` should be used as "the primary evaluation metric" and doesn't describe `match_type` as a secondary ranking input; avoids maintaining a bespoke priority table that could drift from Geoapify's actual enum if it changes). **Chosen: (a).** This is a genuine, non-mechanical tradeoff (spec-literalism vs. simplicity) and was escalated via `AskUserQuestion`; no answer was received in this session, so the recommended, higher-spec-fidelity option was taken, flagged for explicit confirmation before `bmad-dev-story` begins implementation.
- Verified `match_type` priority ordering used in the tiebreak (Task 1): `full_match > match_by_building > match_by_street > match_by_postcode > match_by_city_or_district > match_by_country_or_state > inner_part`, sourced from Geoapify's own forward-geocoding API documentation (`apidocs.geoapify.com/docs/geocoding/forward-geocoding/`) — see Latest Technical Specifics below.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No changes required. This story introduces no new field, no new DB column, no new GraphQL type, and no new TypeScript interface — it only adds one new pure function (`selectBestCandidate`) that reads existing, already-optional `LocationDetails.confidence`/`matchType` fields (added by Story 0.i7a) and changes which existing array element `adapter.ts` assigns to `result`. `LocationDetails` itself is unchanged by this story.
- **Impacted fields/contracts:** None new. `LocationDetails.confidence?: number` / `matchType?: string` (already defined, `packages/shared-types/src/index.ts`) are read, not modified.
- **Required DB migration changes:** None. No schema/DDL/data migration of any kind.
- **Required TypeScript type changes:** None, beyond the new (additive, non-breaking) exported function signature `selectBestCandidate(candidates: LocationDetails[]): LocationDetails` in `packages/domain`.
- **Backward compatibility and rollout notes:** Purely additive/internal — `resolveLocation`'s external contract (`Promise<LocationDetails>`, one object) is unchanged; only its internal selection logic changes. No caller of `resolveLocation` needs to change. Cache behavior is unaffected: whichever candidate is chosen is still written through `setCached` exactly as today.
- **Verification checks:** `packages/domain`'s new unit tests (Task 3) at 100% coverage; `apps/backend`'s updated `adapter.test.ts` integration case (Task 4); `tsc`/lint clean for both touched packages.

### Project Structure Notes

- **New file:** `packages/domain/src/geolocation/select-best-candidate.ts` (+ `.test.ts`) — this is the "reusable function/mechanism" this story introduces, and per this project's package-boundary convention it belongs in `packages/domain`, not inlined into `apps/backend`. Checked for DB/ORM/Node-runtime coupling per this workflow's domain-placement rule: the function only reads `LocationDetails.confidence`/`matchType` (plain data, from `@festgrid/shared-types`) and does array/number comparisons — no `drizzle-orm`, no DB client, no `fs`/`net`/`dotenv`, so it is safe to place in `packages/domain` with no frontend-safety caveat needed.
- **Not a generic cross-entity mechanism:** this function operates specifically on `LocationDetails` (a geolocation-domain type), not a generic "pick-best-of-ranked-list" utility reusable across unrelated entities (events, reports, subscriptions). It correctly stays nested under `packages/domain/src/geolocation/`, matching the existing sibling files (`build-cache-key.ts`, `validate-autocomplete-input.ts`), rather than being promoted to a generic subfolder like `packages/domain/src/query/`.
- No `packages/ui` scope — no UI surface exists in this story.
- Testing convention: `packages/domain` already uses `node:test` + `node:assert/strict` (`tsx --test "src/**/*.test.ts"` per its `package.json`) — follow this existing convention for `select-best-candidate.test.ts`, matching `build-cache-key.test.ts`'s style exactly. `apps/backend`'s geolocation tests use the same `node:test`/`node:assert/strict` convention (integration tests against real fixtures/mocked `fetch`, not `Vitest`/`msw`) — follow the existing convention already in `adapter.test.ts`, not `project-context.md`'s general "testing trophy" guidance for `apps/*`, per the precedent already established (and explicitly called out) in Story 0.i7a's Dev Notes.

### Latest Technical Specifics (web research)

- Geoapify's forward-geocoding `rank` object (verified against `apidocs.geoapify.com/docs/geocoding/forward-geocoding/`): `confidence` is a 0–1 aggregate score ("indicates if the complete address is correct" — low confidence signals uncertainty, e.g. from abbreviations/misspellings, not necessarily incorrectness); `match_type` takes one of `full_match`, `inner_part`, `match_by_building`, `match_by_street`, `match_by_postcode`, `match_by_city_or_district`, `match_by_country_or_state`. Geoapify's own guidance: "Use `rank.confidence` as your primary evaluation metric" — consistent with this story's Design Decision 1 treating `confidence` as the primary sort key and `matchType` only as a tiebreak, not a co-equal or overriding signal.
- No new library/dependency/version consideration applies — this story adds no new runtime dependency to any package.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i7b] (and sibling Stories 0.i7a/0.i7c/0.i7d/0.i7z for cross-story context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-i7-readiness.md] (Gate 1/3 sweep — the "0.i7b unbuildable as scoped" finding this story's prerequisite closes)
- [Source: _bmad-output/implementation-artifacts/0-i7a-carry-confidence-and-country-bias-through-every-geoapify-response-mapper.md] (previous story — candidate-retention amendment, `LocationDetails` field additions, Design Decisions 1–3, full File List)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-14] (Geoapify Confidence Signal Propagation — the invariant this story helps satisfy; cited, not amended, by this story)
- [Source: apps/backend/src/lib/geolocation/geoapify-client.ts] (current `geocodeAddress` multi-candidate return, `mapGeocodeResult`)
- [Source: apps/backend/src/lib/geolocation/adapter.ts] (`resolveLocation`'s `ADDRESS` branch — the exact line this story changes)
- [Source: apps/backend/src/lib/geolocation/adapter.test.ts] (existing single-candidate integration fixtures this story must not regress)
- [Source: packages/domain/src/geolocation/build-cache-key.ts, index.ts] (sibling-file/export convention this story's new file follows)
- [Source: packages/shared-types/src/index.ts#LocationDetails] (`confidence?`/`matchType?` fields this story reads, unchanged)
- [Source: apidocs.geoapify.com/docs/geocoding/forward-geocoding/] (verified `rank.confidence`/`rank.match_type` semantics and documented `match_type` value list — Design Decision 1)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (packages/domain: pure/dependency-free placement confirmed above), Testing Rules (100%-coverage rule for the new domain file; existing-file test-runner-convention rule)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-14 (Geoapify Confidence Signal Propagation), cited not amended
- [x] `docs/infrastructure/index.md`, `docs/infrastructure/5-geolocation.md` — Geoapify backend-layer architecture (no infra change in this story; read to confirm none was needed)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/domain/src/geolocation/select-best-candidate.ts` (new) — `selectBestCandidate` implementation (Task 1).
  - `packages/domain/src/geolocation/select-best-candidate.test.ts` (new) — unit tests, 100% coverage (Task 3).
  - `packages/domain/src/geolocation/index.ts` — add barrel export for the new file (Task 1).
  - `apps/backend/src/lib/geolocation/adapter.ts` — `resolveLocation`'s `ADDRESS` branch calls `selectBestCandidate` instead of indexing `[0]` (Task 2).
  - `apps/backend/src/lib/geolocation/adapter.test.ts` — new re-ranking integration case; confirm existing single-candidate cases unaffected (Task 4).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/3 (epic-wide sweep) → cited above; no new gap for this story.
  - `story-split-gate.md` Gate 2 → re-run fresh, no gap (Dev Notes).
  - Reusable-function-in-`packages/domain` rule (this workflow) → Task 1, Project Structure Notes.
  - Data Type Compatibility rule (this workflow) → dedicated section above; no changes required.
- **Verification Plan:**
  - `tsx --test "src/**/*.test.ts"` (or the project's configured domain-package test command) — new `select-best-candidate.test.ts` green, 100% coverage.
  - `node --test` (or the project's configured backend runner) across `adapter.test.ts` — all existing cases still pass unchanged, plus the new re-ranking case.
  - `tsc`/lint clean for `packages/domain` and `apps/backend`.
  - Manual/integration sanity: a mocked multi-result Geoapify response with a deliberately low-confidence first entry and a higher-confidence later entry confirms `resolveLocation` returns the higher-confidence one end-to-end (through the cache-write path too).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Tasks 1–4 above match the intended scope (a pure selection function plus its one call site); no scope expansion into 0.i7a's, 0.i7c's, or 0.i7d's territory.
- [ ] Architecture and boundary confirmation — new logic placed in `packages/domain/src/geolocation/` (pure, dependency-free, no DB/ORM/Node-runtime coupling, confirmed in Project Structure Notes); no `packages/ui`, no GraphQL/SDL/codegen/DB change.
- [ ] Testing plan confirmation — Task 3's unit-test list covers every branch of the comparator (confidence ordering, `undefined`-confidence handling, exact-tie `matchType` tiebreak, unrecognized `matchType`, all-missing fallback, empty-array throw); Task 4 covers the integration-level regression.
- [ ] **Design Decision 1 (ranking algorithm — recommended: confidence primary, `matchType`-priority tiebreak) — explicit human approval required.** Escalated via `AskUserQuestion`; no answer was received in this session. Proceeding with the recommended option (matches the epics.md AC's literal "confidence/matchType" wording) is **provisional** pending explicit confirmation or override before `bmad-dev-story` begins implementation.
- [ ] Explicit human approval state (Default: **pending approval**)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 findings already resolved by Story 0.i7a (candidate-retention amendment verified present in this worktree's code, ahead of that story's own `review`→`done` transition); Gate 2 fresh check found no gap; no new prerequisite story was created by this story's gate pass.
- [ ] Backlog cross-reference confirmed — this story's subject plainly matches open backlog row `BUG-017` ("Geoapify rank.confidence returns wrong location for sub-venues (e.g. 'Grand Atrium, Pakuwon Mall Jogja')", `status: backlog`, `stories: []`). Per `backlog-spec.md` §13 check 3, this match should be confirmed with the user before `bmad-create-story`'s `on_complete` step promotes that row — escalated together with the Design Decision above; no response received in this session, so promotion is deferred to `bmad-dev-story`/an explicit follow-up rather than assumed silently.

## Testing Requirements

- [ ] Unit tests — `packages/domain/src/geolocation/select-best-candidate.test.ts`, 100% coverage (project-context's domain-package rule).
- [ ] Integration tests — `apps/backend/src/lib/geolocation/adapter.test.ts` (existing `node:test`/real-dev-Postgres convention), new re-ranking case per Task 4.
- [ ] E2E tests — not applicable; this story has no user-facing surface (backend-only; frontend/map-link consumption is Story 0.i7c's separate scope).
- [ ] Migration verification — not applicable; no migration in this story.

## Deliverables Checklist

- [ ] `selectBestCandidate` implemented, exported from `@festgrid/domain/geolocation`, 100%-unit-test-covered.
- [ ] `resolveLocation`'s `ADDRESS` branch calls `selectBestCandidate` instead of indexing `[0]`.
- [ ] New integration test proves a higher-confidence, later-position candidate wins over a lower-confidence, first-position one (BUG-017 regression coverage).
- [ ] Existing single-candidate `adapter.test.ts` assertions unchanged and still passing.
- [ ] Lint/type-check clean for `packages/domain` and `apps/backend`.

## Out of Scope

- Retaining/fetching the candidate list itself, `countryCode`/country-bias, cache eviction, and the `LocationDetails` SDL field declarations — all Story 0.i7a (already implemented; this story only consumes its output).
- Gating the event-detail map link on confidence, and the `apps/web` query-selection/codegen work — Story 0.i7c.
- Exposing `confidence`/`matchType` through `setAccountDefaultLocation`/`editAccountDefaultLocation`/`createUserLocation`/`updateUserLocation`/`previewLocation` — Story 0.i7d.
- The CI-enforced ratchet checking that every one of the 7 known `resolveLocation()` consumers reads the signal — Story 0.i7z.
- Any threshold-based rejection/fallback behavior (e.g. "if even the best candidate is below X confidence, treat as not-found") — not named in this story's AC; the closest related behavior (gating a map link on a threshold) is Story 0.i7c's separate, narrower concern.

## Definition of Done

- [ ] AC 1–5 satisfied.
- [ ] Required tests passing (Tasks 3–4 + Testing Requirements).
- [ ] Lint and type checks passing for `packages/domain` and `apps/backend`.
- [ ] Design Decision 1 explicitly confirmed or overridden by the user (Pre-Coding Approval Gate) before this story is marked done.
- [ ] Backlog row `BUG-017` promotion (or explicit non-match) confirmed with the user before this story is marked done.

## Completion Status

- [ ] Not started.

## Dev Agent Record

### Agent Model Used

_To be filled by `bmad-dev-story`._

### Debug Log References

_To be filled by `bmad-dev-story`._

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Gate 1/3: cited from swept `epic-readiness/epic-0-i7-readiness.md`; the one finding naming this story (candidate-list availability) was resolved by Story 0.i7a and verified already implemented in this worktree.
- Gate 2: re-run fresh (per-story requirement) via subagent with Freya's analytical lens — no gap found (zero UI surface; UX artifacts checked and confirmed silent on this behavior).
- Lightweight guard: reasoned over this story's actual (narrow, in-memory) scope — no new external service/data entity/infra dependency found; no fresh Gate 1/3 re-run warranted.
- Design Decision 1 (ranking algorithm: confidence-primary with `matchType`-priority tiebreak vs. confidence-only) was escalated via `AskUserQuestion` but received no response in this session — proceeded with the recommended, higher-spec-fidelity option, flagged for explicit confirmation in Pre-Coding Approval Gate.
- Backlog cross-reference: this story's subject matches open row `BUG-017` (`status: backlog`, no `stories` yet) per `backlog-spec.md` §13 check 3, which requires user confirmation before promoting — also unanswered in this session; promotion left pending rather than assumed.

### File List

_To be filled by `bmad-dev-story`._

## Change Log

- 2026-09-13: Story created via `bmad-create-story`. Epic 0.i7 readiness sweep cited (swept, Gate 1/3); Gate 2 re-run fresh (no gap). Ranking-algorithm design decision and BUG-017 backlog-promotion match both escalated via `AskUserQuestion`; no response received in this session — proceeded with recommended defaults, flagged for explicit confirmation before implementation/completion.
