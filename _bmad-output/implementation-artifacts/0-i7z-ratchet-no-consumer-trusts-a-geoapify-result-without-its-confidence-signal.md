# Story 0.i7z: Ratchet — no consumer trusts a Geoapify result without its confidence signal

## Story Details

- Epic: 0
- Story ID: 0.i7z
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an enforced, CI-wired guarantee that the invariant holds,
so that a future consumer cannot reintroduce blind trust in Geoapify's top result.

## Acceptance Criteria

1. **Given** the full codebase, **when** the check runs in CI, **then** it fails if any of `geocodeAddress`, `reverseGeocode` or `getPlaceDetails` in `geoapify-client.ts` returns a `LocationDetails` that drops `confidence`/`matchType`.
2. **And** it fails if `geocodeAddress`'s address-search path stops choosing among its retained candidates by `confidence`/`matchType` rather than position (Story 0.i7b's re-ranking).
3. **And** it fails if the event-detail map-link builder (`mapper.ts`) renders a coordinate link without first checking `confidence >= 0.5` and `matchType === 'full_match'` (Story 0.i7c's gate).
4. **And** it fails if any of the five GraphQL operations Story 0.i7d instrumented (`setAccountDefaultLocation`, `editAccountDefaultLocation`, `createUserLocation`, `updateUserLocation`, `previewLocation`) stops selecting `confidence`/`matchType` in its `.graphql` operation document — enforced by that story's three AST guard tests remaining present and passing in the normal test suite.
5. **And** Architecture Spine AD-14 — which already states "the CI-enforced consumer ratchet is Story 0.i7z" — names, per rule, the exact test file(s)/test name(s) that enforce it, so the ratchet is a traceable, discoverable fact rather than a claim with nothing pointing back to it.
6. **And** each of the 8 existing test files/blocks that fulfill AC 1–4 above carries a short comment identifying it as part of the Story 0.i7z CI ratchet, so a future edit that weakens or deletes one of them is a deliberate, visible act rather than silent drift.

## Tasks / Subtasks

- [ ] Task 1: Re-confirm AC 1 coverage by direct read (AC: #1)
  - [ ] Subtask 1.1: Re-read `apps/backend/src/lib/geolocation/geoapify-client.test.ts` and confirm its `deepEqual`/`deepStrictEqual` assertions on the full mapped `LocationDetails` object (not a partial/subset match) would fail if `confidence`, `matchType`, or `countryCode` were dropped from any of `geocodeAddress`/`reverseGeocode`/`getPlaceDetails`'s output. No code change expected — this is a verification-only subtask; if a gap is found, add the missing assertion(s) here rather than deferring.
- [ ] Task 2: Re-confirm AC 2 coverage by direct read (AC: #2)
  - [ ] Subtask 2.1: Re-read `packages/domain/src/geolocation/select-best-candidate.test.ts` (pure-function unit coverage of `selectBestCandidate`'s confidence-primary/matchType-tiebreak/position-fallback logic) and `apps/backend/src/lib/geolocation/adapter.test.ts`'s `'adapter resolveLocation re-ranks ADDRESS by confidence (BUG-017)'` integration test (proves `resolveLocation`'s `ADDRESS` branch actually calls `selectBestCandidate` end-to-end, not just that the pure function exists). Confirm together they would fail if `adapter.ts` reverted to `candidates[0]`. No code change expected.
- [ ] Task 3: Re-confirm AC 3 coverage by direct read (AC: #3)
  - [ ] Subtask 3.1: Re-read `packages/domain/src/geolocation/is-location-trustworthy.test.ts` (pure-function coverage of the `confidence >= 0.5 AND matchType === 'full_match'` predicate, including the boundary/null/undefined cases) and `apps/web/src/features/events/mapper.test.ts` (proves `mapper.ts` actually calls `isLocationTrustworthy` to gate `mapUrl` between a coordinate link and a text-query fallback). Confirm together they would fail if the threshold check were removed or the AND became an OR. No code change expected.
- [ ] Task 4: Re-confirm AC 4 coverage by direct read (AC: #4)
  - [ ] Subtask 4.1: Re-read `apps/web/src/features/subscriptions/mutations.graphql.test.ts`, `apps/web/src/features/locations/mutations.graphql.test.ts`, and `apps/web/src/features/locations/queries.graphql.test.ts` (Story 0.i7d's three AST guard tests). Confirm each parses the real `.graphql` source and asserts `confidence`/`matchType` are present in the named operation's selection set, so removing either field from any of the five operations breaks the corresponding test. No code change expected.
- [ ] Task 5: Add "Enforced by" traceability to Architecture Spine AD-14 (AC: #5)
  - [ ] Subtask 5.1: In `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, under AD-14's Rule 1 ("Every mapper populates the signal"), add an "Enforced by" line citing `apps/backend/src/lib/geolocation/geoapify-client.test.ts`.
  - [ ] Subtask 5.2: Under AD-14's Rule 2 ("Every new consumer must read the signal before trusting a result"), add an "Enforced by" line citing `packages/domain/src/geolocation/select-best-candidate.test.ts` + `adapter.test.ts`'s BUG-017 test (re-ranking), `packages/domain/src/geolocation/is-location-trustworthy.test.ts` + `apps/web/src/features/events/mapper.test.ts` (map-link gate), and the three `apps/web` `.graphql.test.ts` guard tests from Story 0.i7d (GraphQL exposure).
  - [ ] Subtask 5.3: Under AD-14's Rule 3 ("Country bias is part of the resolution identity"), add an "Enforced by" line citing `packages/domain/src/geolocation/build-cache-key.test.ts` (countryBias cache-key folding) and `apps/backend/src/lib/geolocation/adapter.test.ts`'s countryBias integration case.
  - [ ] Subtask 5.4: Update AD-14's existing "the CI-enforced consumer ratchet is Story 0.i7z" sentence to note the ratchet is fulfilled by citation to prior stories' tests plus this story's header-comment marking (Task 6), not by new test code — so a future reader doesn't go looking for a `0.i7z`-specific test suite that doesn't exist.
- [ ] Task 6: Mark the 8 enforcing test files/blocks as part of the Story 0.i7z ratchet (AC: #6)
  - [ ] Subtask 6.1: Add a one-line file-header comment to `apps/backend/src/lib/geolocation/geoapify-client.test.ts` (currently has no header comment) identifying it as enforcing AD-14 Rule 1 / Story 0.i7z AC 1.
  - [ ] Subtask 6.2: Add a one-line file-header comment to `packages/domain/src/geolocation/select-best-candidate.test.ts` (currently has no header comment) identifying it as enforcing AD-14 Rule 2 / Story 0.i7z AC 2.
  - [ ] Subtask 6.3: Add an inline comment directly above `apps/backend/src/lib/geolocation/adapter.test.ts`'s `'adapter resolveLocation re-ranks ADDRESS by confidence (BUG-017)'` test identifying it as enforcing AD-14 Rule 2 / Story 0.i7z AC 2 (do not add a file-header comment here — this file also covers unrelated adapter behavior, so a per-test comment is more precise).
  - [ ] Subtask 6.4: Add a one-line file-header comment to `packages/domain/src/geolocation/is-location-trustworthy.test.ts` (currently has no header comment) identifying it as enforcing AD-14 Rule 2 / Story 0.i7z AC 3.
  - [ ] Subtask 6.5: Extend `apps/web/src/features/events/mapper.test.ts`'s existing `describe('mapGraphQLEventToDetailViewProps mapUrl gating (Story 0.i7c)', ...)` block comment (or the block label itself) to also cite Story 0.i7z as the ratchet consumer of this coverage.
  - [ ] Subtask 6.6: Extend the existing "Story 0.i7d" header comments in `apps/web/src/features/subscriptions/mutations.graphql.test.ts`, `apps/web/src/features/locations/mutations.graphql.test.ts`, and `apps/web/src/features/locations/queries.graphql.test.ts` to also note they are the Story 0.i7z AC 4 ratchet.
- [ ] Task 7: Verification (AC: all)
  - [ ] Subtask 7.1: Run `pnpm --filter backend test`, `pnpm --filter web test`, and `pnpm --filter domain test` (or the repo's equivalent per-package commands) and confirm all pre-existing tests in the 8 touched files still pass unchanged — this story's only production-adjacent edits are comments, so zero behavioral difference is expected.
  - [ ] Subtask 7.2: Run `pnpm run lint` and confirm no new lint errors from the added comments.
  - [ ] Subtask 7.3: Confirm `.github/workflows/ci.yml`'s `ci` job's `Run tests` step (`pnpm run test`, i.e. `turbo run test --filter=!@festgrid/ai-dev-orchestrator`) already includes `apps/backend`, `apps/web`, and `packages/domain` in its scope (it does — none are excluded by the `ai-dev-orchestrator` filter), so no CI workflow file change is needed for this story.

## Dev Notes

- **This story adds no new test logic and no new production code.** Its entire scope is documentation/traceability: an "Enforced by" cross-reference addition to Architecture Spine AD-14, plus short comments on 8 already-existing test files/blocks. This is a deliberate, escalated design decision — see "Design Decisions" below — not a shortcut taken silently.
- **Why:** direct code+test reads (performed during this story's creation, cited file-by-file in Tasks 1–4 above) confirmed that every one of epics.md's 4 literal AC clauses is *already* enforced by a real, regression-catching test shipped by Stories 0.i7a–0.i7d, all of which already run under `pnpm run test` (`turbo run test --filter=!@festgrid/ai-dev-orchestrator`) in `.github/workflows/ci.yml`'s `ci` job on every PR to `master`:
  - AC 1 (mappers populate the signal): `apps/backend/src/lib/geolocation/geoapify-client.test.ts` — e.g. `'geoapify-client geocodeAddress success returns array of candidates'` asserts `assert.deepEqual(result[0], {..., confidence: 0.95, matchType: 'full_match', countryCode: 'us'})` against the *full* mapped object (not a subset match), so a dropped field breaks the assertion. Same pattern for `reverseGeocode`/`getPlaceDetails`.
  - AC 2 (re-ranking beats position): `packages/domain/src/geolocation/select-best-candidate.test.ts` (9 unit tests, 100% coverage of `selectBestCandidate`'s confidence-primary/matchType-tiebreak/position-fallback logic) plus `apps/backend/src/lib/geolocation/adapter.test.ts`'s `'adapter resolveLocation re-ranks ADDRESS by confidence (BUG-017)'` — a true end-to-end integration test that mocks a low-confidence-first/high-confidence-second Geoapify response and asserts `resolveLocation` returns the *second*, higher-confidence candidate (`result.placeId === 'correct_subvenue'`), proving `adapter.ts` actually calls `selectBestCandidate` and doesn't just have the pure function sitting unused.
  - AC 3 (map-link gate): `packages/domain/src/geolocation/is-location-trustworthy.test.ts` (9 unit tests covering the `>=`/AND-not-OR/null/undefined boundary semantics of `isLocationTrustworthy`) plus `apps/web/src/features/events/mapper.test.ts`'s `describe('mapGraphQLEventToDetailViewProps mapUrl gating (Story 0.i7c)', ...)` block, which proves `mapper.ts` calls `isLocationTrustworthy` and branches `mapUrl` on its result (coordinate link when trustworthy, text-query fallback otherwise, including the "confidence high but wrong matchType" and "legacy null data" cases).
  - AC 4 (GraphQL exposure): the three AST-parsing guard tests Story 0.i7d added — `apps/web/src/features/subscriptions/mutations.graphql.test.ts`, `apps/web/src/features/locations/mutations.graphql.test.ts`, `apps/web/src/features/locations/queries.graphql.test.ts` — each `parse()`s the real `.graphql` source with the `graphql` package and asserts `confidence`/`matchType` are present in the named operation's selection set.
  - There is no 9th/10th test needed for `resolve-account-and-locations.ts` or the country-bias mechanism specifically for *this* ratchet's ACs — country-bias correctness is a separate concern already covered by `packages/domain/src/geolocation/build-cache-key.test.ts` and `adapter.test.ts`'s countryBias case (cited in AD-14 Rule 3, Task 5.3), and is not one of epics.md's 4 named AC clauses for 0.i7z.
- **What this story is not:** it does not add a new aggregating "ratchet test file" that duplicates assertions already made elsewhere (rejected option — see Design Decisions), and it does not touch `resolvers.ts` (Story 0.i7d's own forward-looking note flagged a wording mismatch between epics.md's *original* AC 4 text, which named `resolvers.ts`, and the actual enforcement surface, which is the `apps/web` `.graphql` files; epics.md's Story 0.i7z section was already corrected 2026-09-13 — see its "Note" — to say ".graphql operation document," so no further correction is needed here).
- **CI wiring is already complete, no workflow file change needed.** `.github/workflows/ci.yml`'s single `ci` job runs `pnpm install` → `pnpm run lint` → `pnpm run build` → migrate/seed → `pnpm run test` on every `pull_request` targeting `master` (and every push to `master`); `pnpm run test` is `turbo run test --filter=!@festgrid/ai-dev-orchestrator`, which includes `apps/backend` (Node test runner), `apps/web` (Vitest), and `packages/domain` (Vitest) — the three test runners hosting all 8 files this story cites. Whether GitHub's branch-protection settings mark this `ci` job as a "required status check" that blocks the PR merge button is a GitHub repository-settings concern outside this codebase (no `.github/settings.yml` or ruleset file exists in this repo to manage it as code) — out of scope for this story, consistent with there being no repo-tracked branch-protection-as-code anywhere else in the project.

### Architecture & UX Gate Findings

- **Epic readiness report:** `_bmad-output/planning-artifacts/epic-readiness/epic-0-i7-readiness.md` (`swept: true`, `stories_covered` includes `0.i7z`). Gate 1 and Gate 3 were already run epic-wide against this story's scope; its "New prerequisite stories created" table and "AC corrections applied directly to existing stories" table are cited directly here, not re-derived:
  - Gate 1 found 0.i7z needed no correction of its own (the 4 findings applied to 0.i7a/0.i7b/0.i7c).
  - Gate 3 found the epic's invariant was broader (7 call sites) than 0.i7z's original 2-call-site AC — resolved by widening 0.i7z's AC to all 7 and adding Story 0.i7d as the new prerequisite giving the widened AC something real to enforce (now AC 4 above).
- **Gate 2 (UI Complexity & Reusability), run fresh for this story** (one-shot analysis dispatched to a subagent with Freya's/WDS analytical lens, evidence inlined from this story's actual verified scope): **No gap found.** Verbatim verdict: "I grepped both the worktree's `design-artifacts/` and the root `design-artifacts/` for `confidence`, `matchType`, `match_type`, `geoapify`, and `ratchet` (case-insensitive) across all DESIGN.md/EXPERIENCE.md and scenario docs — zero matches in either location. Nothing in the design system anticipates a visual treatment for confidence/matchType or for a 'ratchet' concept; the only place confidence-gated UI behavior already exists is the map-link fallback in `mapper.ts`, which was built and tested in Story 0.i7c, not in scope here. Given the story's verified remaining scope is purely CI-enforcement documentation (AD-14 cross-references and header comments on existing `.test.ts`/`.graphql.test.ts` files marking them as ratchet guards), there is no new or reusable UI component, hook, or visual element implied. Nothing warrants splitting out of 0.i7z on UI complexity/reusability grounds."
- **Lightweight guard (per this workflow's escape hatch):** reasoned over this story's actual scope (a doc addition to one architecture-spine file plus comments in 8 already-existing test files) for anything the epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new infra dependency is introduced. Nothing here warranted re-running Gate 1/3 fresh.

### Design Decisions (escalated to the user via `AskUserQuestion`; no response received in this session — proceeding with the recommended option per the question's framing, flagged below and in Pre-Coding Approval Gate for explicit confirmation before implementation starts)

**Design Decision 1 — what 0.i7z's actual deliverable should be, given all 4 literal AC clauses are already enforced by existing tests.** Three options were weighed:

(a) **Audit + traceability only (chosen/recommended).** No new or duplicate test code. Add explicit "Enforced by: `<test file>`::`<test name>`" cross-references to Architecture Spine AD-14 for each of its 3 rules (which already claims "the CI-enforced consumer ratchet is Story 0.i7z" but never cited which tests fulfill that promise), plus a short comment in each of the 8 existing test files/blocks marking them as part of the 0.i7z ratchet — so deleting or weakening one becomes a deliberate, visible act instead of silent drift. Chosen because: it closes the real gap (AD-14's claim was previously untraceable), it does not fabricate redundant test coverage nobody asked for and that would only add maintenance surface, and it matches this epic's established precedent (0.i7c/0.i7d also chose "pure exposure, cite what already exists" over "build new code for a check that already passes").

(b) **Add a new aggregating test file** that independently re-asserts all four properties (dropped confidence, position-over-confidence re-ranking, threshold gating, GraphQL field discarding) as its own standalone artifact. Rejected: this duplicates logic and fixtures already exhaustively covered by 8 existing, well-targeted tests across 3 test runners (Node test + 2×Vitest); a duplicate suite is pure additional maintenance burden with no additional regression-catching power over option (a), and the epic's own established pattern (0.i7a–0.i7d) never introduces a parallel test surface when an existing one already fits.

(c) **No-op / close as already-satisfied**, without touching AD-14 or adding any cross-references. Rejected: AD-14 explicitly names Story 0.i7z as "the CI-enforced consumer ratchet" — leaving that claim with nothing pointing back to which tests fulfill it means a future reader of AD-14 has no way to verify the claim, and the epic's own invariant statement ("no consumer... without reading its confidence signal") deserves a discoverable enforcement map, not just an assertion that it's true somewhere.

**Chosen: (a).** This was escalated via `AskUserQuestion` during this story's creation; no answer was received in this session — proceeding with the recommended option, flagged for explicit confirmation before `bmad-dev-story` begins implementation (see Pre-Coding Approval Gate).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found — not applicable.** This story makes no code change to any data-carrying type, schema, or API contract. Its only edits are prose additions to `festgrid-architecture-spine.md` (a planning doc, not a runtime artifact) and comments inside existing test files (no assertions, fixtures, or types are altered). `confidence`/`matchType`/`countryCode` were already reconciled across DB/API/TypeScript by Story 0.i7a; this story reads and cites that state without changing it.
- **Impacted fields/contracts:** None.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None.
- **Backward compatibility and rollout notes:** Not applicable — no runtime behavior changes; every edit is a comment or planning-doc prose addition. No sequencing constraint beyond this story's own `Depends on` (0.i7a–0.i7d must already be shipped, since this story cites their test files by exact name and would need to adjust citations if any of those files were renamed/restructured before this story lands — all four are already `review` status in this worktree as of this story's creation).
- **Verification checks:** Task 7's full test-suite run (`apps/backend`, `apps/web`, `packages/domain`) proving the 8 cited files still pass unchanged after their comment-only edits; `pnpm run lint` clean.

### Project Structure Notes

- **No `packages/domain` change:** this story adds no reusable function/mechanism — `select-best-candidate.ts`/`is-location-trustworthy.ts` already exist (Stories 0.i7b/0.i7c) and are not modified, only their test files gain a header comment.
- **No `packages/ui` change:** per Gate 2 above, no new or reusable UI component/hook is introduced.
- **No new state management:** no React Query hook, URL param, or Zustand store is touched.
- **No new async/loader UI:** no user-triggered async flow is introduced or modified.
- **No analytics/PostHog change:** no user interaction is introduced or changed.
- **No i18n change:** no new user-facing string is introduced (all edits are code comments and internal architecture-doc prose).
- **No cloud/external service setup:** no new external service; `SETUP_WALKTHROUGH.md` is unaffected.
- **No CI/CD workflow file change:** `.github/workflows/ci.yml` already runs `pnpm run test` (covering all three affected test runners) on every PR to `master`; per Dev Notes above, no workflow YAML edit is needed.
- **AD-1/AD-2 Unified Query DSL:** not applicable — no event-collection retrieval is touched.
- **Three-queue architecture / AI Gateway adapter (Gate 1's project-wide check):** not applicable — no scraping, AI-processing, or data-ingestion queue code is touched.
- **File Change Plan is unusually narrow for a "ratchet" story name** — flagged explicitly so a reviewer doesn't assume missing scope: the smallness is the audited, escalated conclusion of Design Decision 1, not an oversight.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i7z] (this story's 4 literal AC clauses, and its "Note" correcting the original `resolvers.ts`-wording to `.graphql operation document`)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-i7-readiness.md] (Gate 1/3 epic-wide sweep; `stories_covered` includes `0.i7z`; "Next step" instructs Gate 1/3 be cited, not re-derived, for each of this epic's stories)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-14] (Geoapify Confidence Signal Propagation — cited and amended by this story, adding "Enforced by" cross-references)
- [Source: _bmad-output/implementation-artifacts/0-i7a-carry-confidence-and-country-bias-through-every-geoapify-response-mapper.md] (mappers' field-population behavior; File List confirms `geoapify-client.test.ts`, `build-cache-key.test.ts` as its test additions)
- [Source: _bmad-output/implementation-artifacts/0-i7b-re-rank-sub-venue-matches-using-the-confidence-signal.md] (re-ranking behavior; File List confirms `select-best-candidate.ts`/`.test.ts` and the `adapter.test.ts` BUG-017 integration test)
- [Source: _bmad-output/implementation-artifacts/0-i7c-gate-the-event-detail-map-link-on-location-confidence.md] (map-link gate behavior; File List confirms `is-location-trustworthy.ts`/`.test.ts` and `mapper.test.ts`)
- [Source: _bmad-output/implementation-artifacts/0-i7d-expose-confidence-matchtype-through-the-remaining-geoapify-consumers.md] (GraphQL exposure behavior; File List confirms the 3 `.graphql.test.ts` guard tests; its own "Forward-looking note for Story 0.i7z" flagged the `resolvers.ts`-vs-`.graphql`-files wording mismatch, already resolved in epics.md per the Note above)
- [Source: apps/backend/src/lib/geolocation/geoapify-client.test.ts] (read in full — confirmed `deepEqual` assertions on full mapped objects, AC 1)
- [Source: packages/domain/src/geolocation/select-best-candidate.ts, select-best-candidate.test.ts] (read in full — confirmed confidence-primary/matchType-tiebreak logic and its 9 unit tests, AC 2)
- [Source: apps/backend/src/lib/geolocation/adapter.test.ts] (read `'adapter resolveLocation re-ranks ADDRESS by confidence (BUG-017)'` in full — confirmed end-to-end integration proof, AC 2)
- [Source: packages/domain/src/geolocation/is-location-trustworthy.ts, is-location-trustworthy.test.ts] (read in full — confirmed the `>=`/AND-not-OR predicate and its 9 unit tests, AC 3)
- [Source: apps/web/src/features/events/mapper.test.ts] (read in full — confirmed `mapUrl` gating tests exercise `isLocationTrustworthy` through `mapper.ts`, AC 3)
- [Source: apps/web/src/features/subscriptions/mutations.graphql.test.ts, apps/web/src/features/locations/mutations.graphql.test.ts, apps/web/src/features/locations/queries.graphql.test.ts] (read in full — confirmed AST-based selection-set guards for all 5 named GraphQL operations, AC 4)
- [Source: .github/workflows/ci.yml] (confirmed `pnpm run test` step runs on every PR to `master` within the `ci` job, covering `apps/backend`/`apps/web`/`packages/domain`)
- [Source: package.json#scripts.test] (`turbo run test --filter=!@festgrid/ai-dev-orchestrator` — confirms no exclusion of the three affected packages)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (no `packages/domain`/`packages/ui` addition, confirmed above); no stack/package-boundary rule is implicated by a doc/comment-only story
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-14 (Geoapify Confidence Signal Propagation), amended by this story with "Enforced by" citations
- [x] `docs/infrastructure/index.md` — no infra/CI-workflow change in this story (confirmed `pnpm run test` already covers the affected packages); read to confirm none was needed

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — add "Enforced by" lines to AD-14's Rules 1–3 and update its "CI-enforced consumer ratchet" sentence (Task 5).
  - `apps/backend/src/lib/geolocation/geoapify-client.test.ts` — add file-header comment (Task 6.1).
  - `packages/domain/src/geolocation/select-best-candidate.test.ts` — add file-header comment (Task 6.2).
  - `apps/backend/src/lib/geolocation/adapter.test.ts` — add inline comment above the BUG-017 test (Task 6.3).
  - `packages/domain/src/geolocation/is-location-trustworthy.test.ts` — add file-header comment (Task 6.4).
  - `apps/web/src/features/events/mapper.test.ts` — extend existing describe-block comment/label (Task 6.5).
  - `apps/web/src/features/subscriptions/mutations.graphql.test.ts`, `apps/web/src/features/locations/mutations.graphql.test.ts`, `apps/web/src/features/locations/queries.graphql.test.ts` — extend existing "Story 0.i7d" header comments (Task 6.6).
  - No other files. No new files.
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/3 (epic-wide sweep) → cited above, no story-specific correction needed.
  - `story-split-gate.md` Gate 2 → re-run fresh, no gap (Architecture & UX Gate Findings).
  - Data Type Compatibility rule (this workflow) → dedicated section above; not applicable, no data-carrying change.
  - Reusable-function/reusable-UI rules (this workflow) → explicitly evaluated and found not applicable (Project Structure Notes).
  - Design-decision escalation rule (this workflow's persistent facts) → Design Decision 1 above, escalated via `AskUserQuestion`, no response, proceeding with recommended default per established session precedent (0.i7b/0.i7c/0.i7d all did the same), flagged for explicit confirmation at Pre-Coding Approval Gate.
- **Verification Plan:**
  - `pnpm --filter backend test`, `pnpm --filter web test`, `pnpm --filter domain test` (or repo-equivalent commands) — all pre-existing tests in the 8 touched files pass unchanged (comment-only edits).
  - `pnpm run lint` — clean, no new errors from added comments.
  - Manual read-through: confirm AD-14's new "Enforced by" lines cite real, existing file paths and test names (no invented paths) and that the 8 test files' new/extended comments accurately name Story 0.i7z and the AD-14 rule they enforce.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — this story's scope is deliberately documentation/traceability-only (AD-14 cross-references + 8 test-file comments), not new test or production code, per the audited finding that all 4 literal epics.md AC clauses are already enforced by existing tests (Dev Notes, Tasks 1–4).
- [ ] Architecture and boundary confirmation — no `packages/domain`/`packages/ui`/backend/frontend production code change (Project Structure Notes); the only planning-artifact edit is AD-14's addition of citation lines, not a change to its Rules themselves.
- [ ] Testing plan confirmation — Task 7 re-runs the existing suites covering all 8 touched test files to prove the comment-only edits introduce zero regressions; no new tests are added because none are needed (see Design Decision 1).
- [ ] **Design Decision 1 (audit + traceability only, vs. a new aggregating test file, vs. a silent no-op — recommended: audit + traceability only) — explicit human approval required.** Escalated via `AskUserQuestion` during this story's creation; no answer was received in that session. Confirm before implementation begins.
- [ ] Explicit human approval state — **Default: pending approval.** Not yet approved by the user.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 findings already resolved via the epic readiness sweep (no story-specific correction needed for 0.i7z itself); Gate 2 fresh check found no gap. Depends-on Stories 0.i7a/0.i7b/0.i7c/0.i7d are all at `review` status in this worktree as of this story's creation — confirm they remain unmodified (or re-verify citations) before this story is marked done.

## Testing Requirements

- [ ] Unit tests — none new (Design Decision 1); re-run existing: `apps/backend/src/lib/geolocation/geoapify-client.test.ts`, `packages/domain/src/geolocation/select-best-candidate.test.ts`, `packages/domain/src/geolocation/is-location-trustworthy.test.ts`.
- [ ] Integration tests — none new; re-run existing: `apps/backend/src/lib/geolocation/adapter.test.ts` (including the BUG-017 case).
- [ ] Component/mapper tests — none new; re-run existing: `apps/web/src/features/events/mapper.test.ts`.
- [ ] GraphQL AST guard tests — none new; re-run existing: `apps/web/src/features/subscriptions/mutations.graphql.test.ts`, `apps/web/src/features/locations/mutations.graphql.test.ts`, `apps/web/src/features/locations/queries.graphql.test.ts`.
- [ ] E2E tests — not applicable; no user-facing behavior change.
- [ ] Migration verification — not applicable; no migration in this story.
- [ ] Regression check — confirm all 8 cited test files pass unchanged after their comment-only edits; confirm `pnpm run lint` is clean.

## Deliverables Checklist

- [ ] Architecture Spine AD-14 gains "Enforced by" citations for Rules 1–3, and its "CI-enforced consumer ratchet is Story 0.i7z" sentence is updated to clarify how that's fulfilled.
- [ ] `geoapify-client.test.ts` carries a comment identifying it as the AC 1 / AD-14 Rule 1 ratchet enforcement.
- [ ] `select-best-candidate.test.ts` and `adapter.test.ts`'s BUG-017 test carry comments identifying them as the AC 2 / AD-14 Rule 2 ratchet enforcement.
- [ ] `is-location-trustworthy.test.ts` and `mapper.test.ts` carry comments identifying them as the AC 3 / AD-14 Rule 2 ratchet enforcement.
- [ ] The three `apps/web` `.graphql.test.ts` guard tests carry comments identifying them as the AC 4 ratchet enforcement, alongside their existing Story 0.i7d citation.
- [ ] Full test suite (`apps/backend`, `apps/web`, `packages/domain`) passes unchanged; lint clean.

## Out of Scope

- **A new aggregating/duplicate test file re-asserting all four properties independently** — considered and rejected as Design Decision 1's option (b); the existing 8 tests already provide complete, well-targeted regression coverage.
- **Any change to `resolvers.ts`** — epics.md's Story 0.i7z AC text was already corrected (2026-09-13, per its "Note") from the original `resolvers.ts`-wording to point at the `.graphql operation document` guard tests; this story does not reopen that decision.
- **Managing GitHub branch-protection "required status check" settings** — outside this codebase (no `.github/settings.yml`/ruleset file exists in this repo to manage it as code); the `ci` job already runs the full test suite on every PR, but whether it's configured as a blocking/required check in GitHub's repository settings is a manual, out-of-band administrative action, not something this story's file changes can express.
- **Country-bias-specific enforcement beyond Task 5.3's citation** — country-bias correctness (AD-14 Rule 3) is already covered by `build-cache-key.test.ts`/`adapter.test.ts`'s existing countryBias case; this story only adds a citation, it does not re-audit or extend that coverage, since country bias is not one of epics.md's 4 named AC clauses for 0.i7z.

## Definition of Done

- [ ] AC 1–6 satisfied (AC 1–4 confirmed already-enforced by existing tests via Tasks 1–4; AC 5–6 delivered by Tasks 5–6).
- [ ] Required tests passing — all 8 cited pre-existing test files pass unchanged (Task 7).
- [ ] Lint and type checks passing for touched packages (`apps/backend`, `apps/web`, `packages/domain`, plus the planning-artifacts doc edit, which has no lint/type surface).
- [ ] Design Decision 1 explicitly confirmed or overridden by the user (Pre-Coding Approval Gate) before this story is marked done.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-09-13: Story created via `bmad-create-story`. Epic 0.i7 readiness sweep cited (Gate 1/3, `swept: true`, `stories_covered` includes `0.i7z`); Gate 2 re-run fresh (no gap — verbatim subagent verdict recorded in Dev Notes). Design Decision 1 (audit-and-document 0.i7z's already-fully-enforced invariant via AD-14 citations + 8 test-file comments, rather than adding duplicate test code or closing as a silent no-op) escalated via `AskUserQuestion`; no response received in this session — proceeded with the recommended default per this session's established precedent (0.i7b/0.i7c/0.i7d), flagged for explicit confirmation before implementation.
