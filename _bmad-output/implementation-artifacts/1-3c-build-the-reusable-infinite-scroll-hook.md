# Story 1.3c: Build the reusable infinite-scroll hook

---
baseline_commit: d33a128c94a9946df9c8595769e9f28468a4e0cf
---

## Story Details

- Epic: 1
- Story ID: 1.3c
- Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a generic, reusable `useInfiniteScroll` hook in `packages/ui/src/hooks/`,
so that every long list in the application (Main Discovery Feed, Favorites, My Calendar, Manual Post Selection tabs) fetches and appends subsequent pages the same way, instead of each feature story reimplementing its own IntersectionObserver/fetch/append logic.

## Acceptance Criteria

1. **AC1 — Fetch-next-page contract:** Given a `fetchNextPage`/`hasNextPage`/`isFetchingNextPage` contract (matching the shape React Query's `useInfiniteQuery` exposes) passed as hook arguments, when the hook's returned sentinel ref enters the viewport (via `IntersectionObserver`), then it invokes the caller-supplied `fetchNextPage` callback — the hook never mutates or replaces any list data itself; the caller owns appending the new page's results to existing state (e.g. via React Query's `data.pages` accumulation).
2. **AC2 — No duplicate fetches / stop condition:** The hook does not invoke `fetchNextPage` again while `isFetchingNextPage` is `true` (fetch already in flight), and stops observing (disconnects the `IntersectionObserver`) once `hasNextPage` is `false`.
3. **AC3 — Observer lifecycle cleanup:** The hook creates its `IntersectionObserver` in a `useEffect`, re-creates/re-attaches it when the sentinel ref's underlying DOM node changes, and disconnects/cleans up the previous observer on unmount and on every sentinel-ref change — leaving no dangling observers.
4. **AC4 — Error surfacing (no silent retry loop):** If the `fetchNextPage` callback rejects/errors, the hook surfaces that error via its return value (e.g. an `error: unknown | null` field) rather than silently retrying in a loop or swallowing it; the caller decides how to render the error state. The hook does not itself implement retry/backoff logic.
5. **AC5 — Configurable observer thresholds:** The hook accepts optional `rootMargin` and `threshold` config parameters (passed through to the underlying `IntersectionObserver`), with sensible defaults (e.g. `rootMargin: '200px'`, `threshold: 0`) so consumers can pre-fetch before the sentinel is fully visible, avoiding a visible gap before the next page's non-blocking spinner (project-context.md's "Non-Blocking (Infinite Scroll)" UI invariant) appears.
6. **AC6 — Documented & exported for reuse:** The hook (`useInfiniteScroll`) and its input/return TypeScript types are exported from `packages/ui`'s public entry point with TSDoc documentation (purpose, parameters, return shape, a usage example against `useInfiniteQuery`), and has hook tests proving: sentinel-visible triggers fetch, in-flight fetch is not re-triggered, `hasNextPage: false` stops observing, unmount/ref-change cleans up the observer, and a rejected `fetchNextPage` surfaces via the returned error.

## Tasks / Subtasks

- [x] 1. Create `packages/ui/src/hooks/useInfiniteScroll.ts` implementing the hook's core logic: a `sentinelRef` (via `useRef`/callback ref) and an `IntersectionObserver` created in a `useEffect` (AC1, AC3).
- [x] 2. Define a strictly-typed `UseInfiniteScrollOptions` (`fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, optional `rootMargin`, `threshold`) and `UseInfiniteScrollResult` (`sentinelRef`, `error`) interface, co-located as `packages/ui/src/hooks/useInfiniteScroll.types.ts` (AC1, AC4, AC5).
- [x] 3. Wire the `IntersectionObserver` callback to invoke `fetchNextPage` only when intersecting AND not `isFetchingNextPage` AND `hasNextPage` is `true` (AC1, AC2).
- [x] 4. Disconnect and stop observing once `hasNextPage` becomes `false`; re-run the effect (disconnect old observer, attach new one) whenever the sentinel DOM node or `rootMargin`/`threshold` config changes (AC2, AC3, AC5).
- [x] 5. Wrap the `fetchNextPage` invocation so a rejected promise is caught and stored in local `error` state (via `useState`) rather than thrown or retried, and reset `error` to `null` on the next successful trigger (AC4).
- [x] 6. Create `packages/ui/src/hooks/index.ts` barrel export for the `hooks` folder, and re-export it from `packages/ui/src/index.ts` (AC6).
- [x] 7. Add TSDoc comments to the hook and its types documenting purpose, parameters, return shape, and a `useInfiniteQuery`-based usage example (AC6).
- [x] 8. Write hook tests (Vitest + `@testing-library/react`'s `renderHook`, mocking `IntersectionObserver` since jsdom does not implement it) covering: fetch triggered when sentinel intersects, no re-trigger while `isFetchingNextPage` is `true`, observer disconnected once `hasNextPage` is `false`, observer cleaned up on unmount and on sentinel-ref change, and `error` populated (not thrown) when `fetchNextPage` rejects (AC1–AC6; use `@festgrid/testing-config/vitest-react` per Testing Requirements).

## Dev Notes

- This is a net-new, headless (no JSX/rendering) hook story — no existing files needed to be read as "files being modified" beyond the `packages/ui` barrel export (`packages/ui/src/index.ts`, currently only re-exporting `./core/app-shell`).
- Previous story in sequence is 1.3b ("Build the reusable EventCard component") — it is a presentation-only component in `packages/ui/src/features/events/`, not yet implemented (Completion Status: Not started per its story file), and has no code overlap with this hook (different subfolder, no shared logic). No previous-story dev-notes/learnings carry over beyond the shared package-level conventions noted below.
- `packages/ui`'s only existing code is `packages/ui/src/core/app-shell/` (Story 0.7, `AppShell.tsx`, `Logo.tsx`, `nav-entries.ts`) and `packages/ui/src/index.ts` (a single `export * from './core/app-shell';` line). No `packages/ui/src/hooks/` directory exists yet — this story creates it, per project-context.md's Code Organization rule, which names `useInfiniteScroll` **by name** as the canonical example hook belonging there.
- `packages/ui/package.json` currently has no test script, `vitest`, or testing devDependencies — Story 1.3b (in-flight/ready-for-dev, not yet implemented) is expected to add `packages/ui/vitest.config.ts` and the Vitest/`@testing-library/react` devDependencies first. If Story 1.3b has not landed when this story is implemented, this story must add that same testing setup itself (mirroring Story 1.3b's Implementation Plan: `vitest.config.ts` via `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`, plus `@festgrid/testing-config`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` devDependencies in `packages/ui/package.json`) rather than skipping tests — do not let a race between 1.3b/1.3c leave the package untested.
- `@testing-library/react` is pinned at `16.3.0` in `packages/testing-config/package.json`, which ships `renderHook` directly (no separate `@testing-library/react-hooks` package needed — that package is deprecated/merged upstream since RTL v13).
- **jsdom does not implement `IntersectionObserver`.** The hook tests must provide a manual mock/stub (e.g. a small test-local class assigned to `global.IntersectionObserver` in the test file, exposing `observe`/`unobserve`/`disconnect` spies and a way to manually invoke the stored callback with a fabricated `IntersectionObserverEntry`-shaped object) — there is no existing precedent for this in the codebase yet since no hook test exists; do not add a new shared dependency (e.g. `intersection-observer` polyfill) for this — a local mock is sufficient and keeps the hook test hermetic.
- Git history check: the 5 most recent commits (`272da91`, `f5ca205`, `b5c6a12`, `cf52ce5`, `1d0b349`) are all BMad planning/docs changes (Epic 3 readiness, default-location flow docs, Story 1.2a implementation artifact) — not application code, and none touch `packages/ui` or hooks. No relevant frontend code patterns to extract from recent commits beyond what's already read directly from `packages/ui/src/core/app-shell/AppShell.tsx` and Story 1.3b's story file.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `epic-readiness/epic-1-readiness.md` is marked `swept: true` and explicitly lists story `1.3c` in `stories_covered`. Its Gate 1 finding states no violations were found across 1.1–1.6/1.3b/1.6a/1.8 (reusable components correctly scoped to `packages/ui`, no frontend→DB bypass, no external services called directly from the frontend). This story has zero backend/data dependency (pure client-side hook, `Depends on: None` per epics.md), so neither the report's one gap (missing GraphQL auth-context layer, resolved by Story 0.17) nor any other Gate 1/3 finding applies here.
  - **Lightweight guard:** Re-checked this story's specific scope against the sweep — this story introduces no external service, no new data entity, and no new infra dependency (it is a pure `IntersectionObserver`/React-hooks wrapper with no fetch logic of its own; the caller supplies `fetchNextPage`). No fresh Gate 1/3 subagent run needed.
- **Gate 2 (run fresh, per-story as required):** Ran via subagent adopting the Freya (`wds-agent-freya-ux`) persona against the draft AC list and the story-split-gate.md heuristics. Verdict: **No gap found** — this story is itself the Gate 2 remedy already applied during Story 1.3's creation (extracting a complex hook that multiple components depend on into its own story), not a symptom still needing a further split. Splitting it further would fragment a single cohesive `IntersectionObserver` lifecycle (attach → fire → dedupe-in-flight → cleanup) across artificial boundaries. The subagent grepped all of `design-artifacts/` (`UX-festgrid-run-1/DESIGN.md`, `EXPERIENCE.md`, `D-Design-System/*.md`) for infinite-scroll/pagination/spinner/threshold specs and found none — there is no UX visual spec for this feature area beyond project-context.md's "Non-Blocking (Infinite Scroll): localized spinner at bottom of list" rule, which is correctly a *consumer* concern (Story 1.3/2.2/5.1's job to render), not this headless hook's. One AC refinement was recommended and has been folded in: an optional `rootMargin`/`threshold` config param (AC5), so consumers can pre-fetch before the sentinel is fully visible and avoid a visible gap before the spinner appears.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, GraphQL contract, or persisted TypeScript data-model changes. The hook's own `UseInfiniteScrollOptions`/`UseInfiniteScrollResult` types are new, purely local UI-config types (not shared/DB-backed types), and are structurally compatible with (a subset of) the shape React Query's `useInfiniteQuery` return value already exposes (`fetchNextPage`, `hasNextPage`, `isFetchingNextPage`).
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required (new local types only, not additions to `packages/shared-types`).
- Backward compatibility and rollout notes: N/A — no persisted data or API contract is touched. The hook is a pure addition; no existing consumer exists yet (Story 1.3, its first consumer, has not landed).
- Verification checks: This story's own hook tests (Vitest + `renderHook`) prove the fetch-trigger/dedupe/cleanup/error-surfacing behavior in isolation. End-to-end verification against a real `useInfiniteQuery`-backed list is not possible until Story 1.3 (or Story 2.2/5.1) actually consumes this hook against live data — track that separately when those stories are picked up.

### Project Structure Notes

- New files live under `packages/ui/src/hooks/`, per project-context.md's Code Organization rule, which explicitly names `useInfiniteScroll` as a canonical example of a reusable React hook belonging in `packages/ui/src/hooks/` (distinct from `packages/domain`, which is React-free and must never contain hooks).
- Only existing file touched: `packages/ui/src/index.ts` (add a barrel re-export) — everything else is additive/new. No conflicts with the in-flight `packages/ui/src/features/events/` work from Story 1.3b (different subfolder entirely).
- No new workspace package is created; this stays inside the existing `packages/ui` package boundary.

### References

- [Source: _bmad-output/project-context.md] — Code Organization (Domain vs UI: `useInfiniteScroll` named as canonical `packages/ui/src/hooks/` example), UI Patterns & UX Invariants (List Navigation, Non-Blocking Infinite Scroll spinner rule).
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-4] — Multi-Tiered Strict State Management (Server State tier via `@tanstack/react-query`'s `useInfiniteQuery`, the contract this hook is designed to pair with).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3c] and neighboring Stories 1.3, 1.3a, 1.3b, 2.2, 5.1.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — swept Gate 1/3 report covering this story (`1.3c` listed in `stories_covered`).
- [Source: packages/testing-config/package.json, packages/testing-config/vitest-react.ts] — shared Vitest/RTL config (Story 0.10), `@testing-library/react` 16.3.0 (has `renderHook` built in).
- [Source: packages/ui/package.json, packages/ui/src/index.ts, packages/ui/src/core/app-shell/AppShell.tsx] — confirmed current `packages/ui` package state and conventions.
- [Source: _bmad-output/implementation-artifacts/1-3b-build-the-reusable-eventcard-component.md] — previous-story intelligence and expected `packages/ui` testing-setup precedent.
- [Gate 2 subagent finding, run during this story's creation] — no design-artifacts spec exists for infinite scroll; recommended optional `rootMargin`/`threshold` config, folded into AC5.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/ui/src/hooks/`, `useInfiniteScroll` named canonically), UI Patterns & UX Invariants (List Navigation, non-blocking spinner).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-4 (Multi-Tiered Strict State Management; `useInfiniteQuery` contract pairing).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/hooks/useInfiniteScroll.ts` — hook implementation.
  - NEW `packages/ui/src/hooks/useInfiniteScroll.types.ts` — `UseInfiniteScrollOptions`/`UseInfiniteScrollResult` types.
  - NEW `packages/ui/src/hooks/index.ts` — barrel export for the `hooks` folder.
  - NEW `packages/ui/src/hooks/useInfiniteScroll.test.ts` — hook tests (with a local `IntersectionObserver` mock).
  - UPDATE `packages/ui/src/index.ts` — add `export * from './hooks';`.
  - CONDITIONAL (only if Story 1.3b has not already landed this) NEW `packages/ui/vitest.config.ts` — `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`.
  - CONDITIONAL (only if Story 1.3b has not already landed this) UPDATE `packages/ui/package.json` — add a `"test": "vitest run"` script and devDependencies `@festgrid/testing-config` (workspace), `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
- **Rule Mapping:**
  - *Code Organization (reusable hooks)* → hook placed in `packages/ui/src/hooks/`, exactly matching the named example in project-context.md.
  - *No React in `packages/domain`* → confirms this hook correctly belongs in `packages/ui`, not `packages/domain`, since it uses `useRef`/`useEffect`/`useState`.
  - *UI Patterns & UX Invariants (Non-Blocking Infinite Scroll)* → AC5's configurable `rootMargin` supports pre-fetching ahead of the visible spinner threshold, without this story rendering the spinner itself (consumer's job).
  - *Testing Philosophy (testing trophy)* → integration-style hook tests via Vitest + Testing Library's `renderHook`, not exhaustive unit fragmentation.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: fetch triggered on sentinel intersection, no re-trigger while `isFetchingNextPage`, observer stops once `hasNextPage` is `false`, observer cleanup on unmount/ref-change, error surfaced (not thrown) on `fetchNextPage` rejection.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing consumes `useInfiniteScroll` on a real page yet — that lands with Story 1.3).

## Pre-Coding Approval Gate

- [x] Scope confirmed: build `useInfiniteScroll` as a standalone, headless (no rendering) reusable hook in `packages/ui/src/hooks/`; no backend work, no live-data wiring into any page (that is Story 1.3 and later Stories 2.2/5.1).
- [x] Architecture confirmed: hook built with plain `IntersectionObserver`/React hooks only (no dependency on `@tanstack/react-query` itself — it accepts a compatible `fetchNextPage`/`hasNextPage`/`isFetchingNextPage` contract as arguments, staying decoupled), placed under `packages/ui/src/hooks/`.
- [x] Testing plan confirmed: Vitest + `@testing-library/react`'s `renderHook` via `packages/ui/vitest.config.ts` importing `@festgrid/testing-config/vitest-react`, with a local `IntersectionObserver` mock (jsdom has no native implementation).
- [x] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-1-readiness.md` (no gap for this story, `1.3c` explicitly covered); Gate 2 run fresh (no gap found; the optional `rootMargin`/`threshold` refinement is folded into AC5, not split out).
- [x] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [x] Hook tests (Vitest + `@testing-library/react`'s `renderHook`) for: fetch triggered when sentinel intersects, no re-trigger while a fetch is in flight, observer disconnected once `hasNextPage` is `false`, observer cleanup on unmount and sentinel-ref change, `error` populated (not thrown/retried) when `fetchNextPage` rejects.
- [x] No E2E test required for this story (no live page consumes `useInfiniteScroll` yet; E2E coverage arrives with Story 1.3's "happy path").
- [x] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per project-context.md; `packages/ui` follows the "testing trophy" integration-style approach.
- [x] Note: Use `@festgrid/testing-config/vitest-react` (Story 0.10, already available) for `packages/ui/vitest.config.ts` — do not create a parallel/ad hoc testing-config setup; if Story 1.3b has already added this config file, reuse it rather than duplicating.

## Deliverables Checklist

- [x] `useInfiniteScroll` hook implemented in `packages/ui/src/hooks/useInfiniteScroll.ts`.
- [x] Strictly-typed `UseInfiniteScrollOptions`/`UseInfiniteScrollResult` (`useInfiniteScroll.types.ts`).
- [x] Fetch-trigger-on-intersection behavior with in-flight dedupe (AC1, AC2).
- [x] `hasNextPage: false` stop-observing behavior (AC2).
- [x] `IntersectionObserver` lifecycle cleanup on unmount/ref-change (AC3).
- [x] Error surfacing via return value on `fetchNextPage` rejection, no silent retry loop (AC4).
- [x] Configurable `rootMargin`/`threshold` with sensible defaults (AC5).
- [x] Exported from `packages/ui`'s public entry point with TSDoc documentation and a usage example.
- [x] Hook tests written and passing.

## Out of Scope

- Wiring `useInfiniteScroll` into the actual event list/grid page — handled by Story 1.3.
- Any `@tanstack/react-query`/`useInfiniteQuery` setup or GraphQL data fetching — handled by Story 1.3a (API) and Story 1.3 (consumption).
- Rendering the localized non-blocking spinner shown while fetching subsequent pages — a consumer-side concern (Story 1.3, later Story 2.2/5.1), not this headless hook's.
- Reusing this hook for Favorites (Story 2.2), My Calendar, or Manual Post Selection (Story 5.1/5.1a) — those stories consume this hook when built; not implemented here.

## Definition of Done

- [x] All Acceptance Criteria (AC1–AC6) are met.
- [x] Required hook tests (see Testing Requirements) are written and passing.
- [x] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [x] `useInfiniteScroll` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [x] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [x] review

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

- Mocked `IntersectionObserver` manually for hook tests since jsdom lacks it.

### Completion Notes List

- Implemented `useInfiniteScroll` hook with headless IntersectionObserver logic.
- Managed React ref stability via `useRef` to avoid unnecessary observer reconnects.
- Hook tested thoroughly with Vitest and `@testing-library/react`. 
- Hook and types exported through a barrel file `packages/ui/src/hooks/index.ts` and `packages/ui/src/index.ts`.

### File List

- `packages/ui/src/hooks/useInfiniteScroll.ts`
- `packages/ui/src/hooks/useInfiniteScroll.types.ts`
- `packages/ui/src/hooks/index.ts`
- `packages/ui/src/hooks/useInfiniteScroll.test.ts`
- `packages/ui/src/index.ts` (Modified)
