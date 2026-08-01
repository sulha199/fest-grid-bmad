---
baseline_commit: 162af179d0baa285d8680991f04ed9bcff4b14ee
---
# Story 1.6b: Build the context-aware list navigation hook

## Story Details

- Epic: 1
- Story ID: 1.6b
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, headless hook that resolves "Next"/"Previous" targets from a list's currently-loaded items and triggers background pagination when the boundary of the currently loaded page is reached,
so that any detail view opened from any list (event discovery, favorites, calendar) can offer consistent context-aware navigation without re-deriving list-position and pagination logic per feature.

## Acceptance Criteria

1. **AC1 — Precise input contract:** The hook accepts `items: TItem[]` (the caller's currently-loaded items, in list order — e.g. `data.pages.flatMap(page => page.items)` from React Query, matching `home-content.tsx`'s existing flattening pattern), `currentId: string | null | undefined` (the id of the item the detail view is currently showing), and a `hasNextPage`/`isFetchingNextPage`/`fetchNextPage` triple matching the shape `useInfiniteQuery` exposes (the same contract Story 1.3c's `useInfiniteScroll` already consumes). `TItem` is constrained to `{ id: string }` — this resolves the ambiguity in the epics.md draft AC between "currently-loaded items" and "an ID-ordered sequence" by picking the former as the single, precise contract (Gate 2 refinement).
2. **AC2 — Deriving Previous/Next targets:** Given `items` and `currentId`, when the hook computes navigation state, then it locates `currentId`'s index within `items` and returns, for each of `previous`/`next`, an object with `target: { id, item } | null`, `disabled: boolean`, and `loading: boolean`.
3. **AC3 — Previous never fetches:** `previous.target` is the item immediately before `currentId` in `items` when one exists (`disabled: false`); when `currentId` is the first loaded item, `previous.disabled` is `true` and `previous.target` is `null`. Pagination is forward-only (matches `useInfiniteQuery`'s `fetchNextPage`-only contract) — `previous` **never** triggers a fetch and `previous.loading` is always `false` (Gate 2 refinement, prevents scope drift toward a `fetchPreviousPage` contract that doesn't exist in this codebase).
4. **AC4 — Next when already loaded:** When an item after `currentId` already exists in `items`, `next.target` resolves to it immediately with `disabled: false`, `loading: false` — no fetch is triggered.
5. **AC5 — Next at the loaded boundary, more available:** When `currentId` is the last item in `items` and `hasNextPage` is `true`, `next.target` is `null` and `next.loading` reflects whether a fetch triggered via `requestNext()` (AC6) is in flight; `next.disabled` is `true` while `next.loading` is `true` (prevents duplicate in-flight requests, mirroring `useInfiniteScroll`'s `isFetchingNextPage` dedupe guard — Gate 2 refinement) and otherwise `false` (a target is reachable on request).
6. **AC6 — Requesting Next triggers background pagination:** The hook exposes `requestNext(): Promise<ListNavigationTarget<TItem> | null>`. Calling it when a next item is already loaded (AC4) resolves immediately with that target and does not call `fetchNextPage`. Calling it at the loaded boundary with `hasNextPage: true` (AC5) invokes the caller's `fetchNextPage` exactly once per boundary (does not re-invoke while a request is already pending), sets `next.loading: true`, and resolves once `items` grows to include the next entry — resolving with that new target and clearing `loading`, **without blocking the UI** (the calling component keeps rendering; only the "Next" affordance shows a pending state via `next.loading`).
7. **AC7 — Boundary with nothing more to fetch:** When `currentId` is the last item in `items` and `hasNextPage` is `false`, `next.target` is `null`, `next.disabled` is `true`, `next.loading` is `false`; calling `requestNext()` in this state resolves immediately with `null` and does not call `fetchNextPage`.
8. **AC8 — Failed background fetch surfaces, doesn't retry:** If the `fetchNextPage` call triggered by `requestNext()` rejects, the hook surfaces the failure via a returned `error: unknown | null` field (cleared on the next successful `requestNext()` call), resolves the pending `requestNext()` promise with `null`, and clears `next.loading` — it does not silently retry in a loop (Gate 2 refinement, mirrors `useInfiniteScroll`'s AC4 error-surfacing precedent, since the underlying trigger mechanism is the same `fetchNextPage` contract).
9. **AC9 — No list context (direct deep-link):** When `currentId` is `null`/`undefined`, or is not found within `items` (e.g. a detail view opened directly, with no preceding list fetch), both `previous` and `next` report `target: null`, `disabled: true`, `loading: false`, and `requestNext()` resolves immediately with `null` without calling `fetchNextPage` — no error is thrown.
10. **AC10 — Strictly-typed, headless contract:** The hook renders nothing and has no dependency on routing, GraphQL, or any specific list feature — `packages/ui/src/hooks/useContextAwareListNavigation.types.ts` exports `UseContextAwareListNavigationOptions<TItem>`, `ListNavigationTarget<TItem>`, `ListNavigationDirectionState<TItem>`, and `UseContextAwareListNavigationResult<TItem>` so it can be consumed identically by Story 1.6 (event discovery detail) and future Epic 2 detail views (Favorites, Calendar) that supply their own `items`/pagination state.
11. **AC11 — Documented & exported for reuse:** The hook and its types are exported from `packages/ui`'s public entry point with TSDoc (purpose, parameters, return shape, a usage example pairing it with `useInfiniteQuery`), and has hook tests proving: previous/next resolution mid-list, previous disabled at the start, next resolved-without-fetch when already loaded, `requestNext()` triggering `fetchNextPage` only at the boundary, no duplicate `fetchNextPage` calls while already pending, resolution once `items` grows, boundary-with-`hasNextPage:false` behavior, a rejected `fetchNextPage` surfacing via `error` without retrying, and the no-list-context (deep-link) case.

## Tasks / Subtasks

- [ ] 1. Create `packages/ui/src/hooks/useContextAwareListNavigation.ts` implementing the hook's core logic (AC1, AC2).
- [ ] 2. Define `UseContextAwareListNavigationOptions<TItem>`, `ListNavigationTarget<TItem>`, `ListNavigationDirectionState<TItem>`, and `UseContextAwareListNavigationResult<TItem>` in a co-located `packages/ui/src/hooks/useContextAwareListNavigation.types.ts`, with `TItem extends { id: string }` (AC1, AC10).
- [ ] 3. Implement `currentIndex` resolution (`items.findIndex(item => item.id === currentId)`) and the no-context fallback when `currentId` is nullish or not found in `items` (AC9).
- [ ] 4. Implement `previous` derivation: item at `currentIndex - 1` when `currentIndex > 0`, else disabled with no target; always `loading: false`, never calls `fetchNextPage` (AC3).
- [ ] 5. Implement `next` derivation for the already-loaded case (`currentIndex < items.length - 1`) (AC4).
- [ ] 6. Implement `requestNext()`: resolve immediately if already loaded (AC4/AC6); when at the boundary with `hasNextPage: true`, guard against a second concurrent call while one is pending, invoke `fetchNextPage()`, and track a "pending" ref/state that a `useEffect` watching `items` resolves once `items.length > currentIndex + 1` (AC5, AC6).
- [ ] 7. Implement the boundary-with-`hasNextPage: false` short-circuit, resolving `requestNext()` with `null` without calling `fetchNextPage` (AC7).
- [ ] 8. Wrap the `fetchNextPage()` invocation from `requestNext()` in error handling: catch a rejection, store it in `error` state, resolve the pending promise with `null`, clear `next.loading`, and reset `error` to `null` at the start of the next successful `requestNext()` call (AC8).
- [ ] 9. Ensure `next.disabled` is `true` whenever `next.loading` is `true`, preventing a second `requestNext()` call from re-invoking `fetchNextPage` while one is in flight (AC5, AC8 dedupe guard).
- [ ] 10. Create/extend `packages/ui/src/hooks/index.ts`'s barrel export with the new hook and its types (`packages/ui/src/index.ts` already re-exports `./hooks` — confirm no change needed there) (AC11).
- [ ] 11. Add TSDoc comments to the hook and its types documenting purpose, parameters, return shape, and a `useInfiniteQuery`-paired usage example, matching `useInfiniteScroll.ts`'s existing TSDoc style (AC11).
- [ ] 12. Write hook tests (Vitest + `@testing-library/react`'s `renderHook`) covering: mid-list previous/next resolution without any fetch, previous disabled at index 0, next resolved immediately when already loaded, `requestNext()` invoking `fetchNextPage` exactly once at the boundary, no duplicate `fetchNextPage` call from a second `requestNext()` while pending, the pending promise resolving once a re-render supplies a grown `items` array, boundary + `hasNextPage: false` short-circuit (no fetch, immediate `null`), a rejected `fetchNextPage` populating `error` and resolving `null` without retry, and the no-context case (`currentId` nullish or absent from `items`) (AC1–AC11; use `@festgrid/testing-config/vitest-react` per Testing Requirements).

## Dev Notes

- This is a net-new, headless (no JSX/rendering) hook story — no existing files needed to be read as "files being modified" beyond the `packages/ui` barrel exports. `packages/ui/src/hooks/index.ts` currently exports `useInfiniteScroll`, `useInfiniteScroll.types`, `useScopedLocale`, and `useDebounce` (confirmed by reading the file directly) — add this hook alongside them, don't restructure the existing barrel. `packages/ui/src/index.ts` already contains `export * from './hooks';` (confirmed by reading the file) — no change needed there, unlike Story 1.3c's precedent where that line still needed to be added.
- **Reuse `useInfiniteScroll`'s established conventions** (`packages/ui/src/hooks/useInfiniteScroll.ts`, Story 1.3c) rather than inventing new ones: `"use client"` directive at the top of the `.ts` file, a `useRef`-backed "latest callback" pattern to avoid stale closures over `fetchNextPage`/`isFetchingNextPage` inside effects, TSDoc with an `@example` block, and error state that surfaces via the return value (never thrown, never silently retried).
- **The exact contract this hook must interoperate with already exists in the codebase**: `apps/web/src/app/[locale]/home-content.tsx` (Story 1.3/1.4/1.5's implementation) calls `useInfiniteQuery<GetEventsQuery, ...>` with `queryKey: ['events', { q, types, categories }]`, flattens `data.pages` via `(data?.pages || []).flatMap(page => page.events.items)` into an `events: EventItem[]` array, and already passes `{ hasNextPage, isFetchingNextPage, fetchNextPage }` to `useInfiniteScroll`. Story 1.6 (this hook's first consumer) will pass that same flattened `events` array as `items` and the same three React Query fields to this hook — confirm this shape stays compatible when Story 1.6 wires it in, since this story cannot itself exercise it against live GraphQL data (see Data Type Compatibility below).
- **Identifier caveat for Story 1.6 (not this story's problem to solve):** The current `apps/backend/src/schema/events.graphql` only exposes `event(id: ID!): Event` — no slug-based lookup exists yet, even though epics.md's Story 1.6 AC references a `/events/[slug]` route and a `slug` field per `project-context.md`'s "Unique Identifiers" rule. This hook is agnostic to what string `TItem.id`/`currentId` actually contains (slug vs UUID) — it only compares them for equality and indexes into `items` — so this mismatch is Story 1.6's concern when it wires real data in, not a blocker for this story's own scope or tests (which use fabricated `{ id: string }` fixtures).
- Recent commit history (`162af17`, `0fdc743`, `4f9da63`, `1d75051`, `9d15339`) is mostly BMad planning/docs artifacts plus Story 1.5a's `MultiSelect` component landing — no application code changes touch `packages/ui/src/hooks/` or React Query/pagination logic, so there is no additional recent-commit pattern to extract beyond `useInfiniteScroll.ts` itself.
- This hook intentionally has **no** i18n (AD-6) or analytics (AD-5) surface: it renders nothing and introduces no user-facing microcopy or new tracked PostHog events itself — any "Next"/"Previous" button copy, click analytics, or navigation/URL-building on click belongs to the consuming route (Story 1.6), matching how `useInfiniteScroll` (Story 1.3c) also carried no i18n/analytics section.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `epic-readiness/epic-1-readiness.md` is marked `swept: true`. Its Gate 1 finding states no violations were found "across 1.1–1.6/1.3b/1.6a/1.8" (reusable components correctly scoped to `packages/ui`, no frontend→DB bypass, no external service called directly from the frontend). This story has zero backend/data dependency of its own — per epics.md, "Depends on: None (headless hook; consumes whatever list context/pagination state its caller passes in — no direct GraphQL/DSL dependency of its own)" — identical in shape to Story 1.3c, which the same report's range-citation already covers. The report's one Gate 1/3 gap (missing GraphQL auth-context layer, resolved by Story 0.17) does not apply — this hook never touches auth, the network, or the database.
  - **Lightweight guard (per this story's own scope, not a fresh subagent run):** Re-checked against the sweep — this story introduces no external service, no new data entity, and no new infra/tooling dependency beyond what `useInfiniteScroll` (Story 1.3c) already established as precedent for pure client-side `packages/ui` hooks. No fresh Gate 1/3 subagent run warranted.
- **Gate 2 (run fresh, per-story as required):** Ran via subagent adopting the Freya (`wds-agent-freya-ux`) persona against the draft AC list (verbatim from `epics.md`'s "### Story 1.6b" entry) and the authoritative UX sources. Verdict: **No gap found** — this story is itself the Gate 2 remedy already applied during Story 1.6's creation (extracting the fetch+derived-state+side-effect combination that also triggered the Story 1.3c split), not a symptom still needing a further split; no sub-piece of it (e.g. pure prev/next index derivation) clears the reuse bar independently of the fetch-triggering mechanism itself. The subagent checked `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.1-event-discovery.md`, `01.2-event-detail.md`, `UX-festgrid-run-1/DESIGN.md`, and `UX-festgrid-run-1/EXPERIENCE.md` and found **no** Next/Previous, swipe, or position-indicator ("3 of 24") pattern anywhere in the scenario corpus — the mechanism traces entirely to `project-context.md`'s "Context-Aware Detail Views" invariant, not a visual scenario walkthrough, and since this hook is explicitly headless (AC10), the absence of visual nav-pattern detail (button placement, swipe gesture, position indicator) is correctly out of this story's scope — that burden falls on Story 1.6/1.6a, the rendering layer. Four AC refinements were recommended and are folded into AC1/AC3/AC5/AC8 above rather than split out: (1) an explicit error/retry-state field for the triggered background fetch, (2) a duplicate-fetch-trigger guard on rapid repeat "Next" requests while one is in-flight, (3) an explicit statement that "Previous" never triggers a fetch (forward-only pagination), and (4) pinning the input contract down to "currently-loaded items array + currentId" rather than leaving "items or an ID-ordered sequence" ambiguous.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. This hook defines its own local, generic `TItem extends { id: string }` constraint — it does not import or depend on `EventInfo`/`Schedule` or any `@festgrid/shared-types`/GraphQL-generated type. No DB schema or shared-type changes are required for this story.
- **Impacted fields/contracts:** None new. The hook consumes only a caller-supplied `items`/`currentId`/`hasNextPage`/`isFetchingNextPage`/`fetchNextPage` shape (matching `useInfiniteQuery`'s existing return contract, already used by `home-content.tsx`) — it introduces no database, GraphQL, or persisted TypeScript data-model changes.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required to `packages/shared-types` or the GraphQL schema. This story's `UseContextAwareListNavigationOptions<TItem>`/`ListNavigationTarget<TItem>` types are new, purely local, generic UI types.
- **Backward compatibility and rollout notes:** Not applicable — net-new hook, no existing consumers to break. Story 1.6 is the first real caller and is responsible for supplying the flattened `EventItem[]` array (already computed today in `home-content.tsx`) as `items` and mapping the resolved `next`/`previous` target `id`s onto whatever routing scheme it uses (`/events/[slug]` or `event(id)`, per the identifier caveat above) — that mapping is out of scope here.
- **Verification checks:** This story's own hook tests use fabricated `{ id: string }` fixtures to prove the derivation/fetch-triggering/error-surfacing logic in isolation. End-to-end verification against real, live-paginated event data is not possible until Story 1.6 wires this hook into the actual detail view; track that separately when Story 1.6 is picked up.

### Project Structure Notes

- New files live under `packages/ui/src/hooks/`, per `project-context.md`'s Code Organization rule and directly alongside the existing `useInfiniteScroll`/`useScopedLocale`/`useDebounce` hooks — this hook is generic (not events-specific), consistent with its cross-epic reuse requirement (Story 1.6, future Favorites/Calendar detail views).
- Only existing file touched: `packages/ui/src/hooks/index.ts` (add barrel exports for the new hook/types). `packages/ui/src/index.ts` already re-exports `./hooks` in full — no change needed there. No conflicts with `apps/backend` or `apps/web` work, or with the in-flight `packages/ui/src/features/events/EventDetailView` work (Story 1.6a, different subfolder).
- No new workspace package is created; this stays inside the existing `packages/ui` package boundary. `packages/ui/vitest.config.ts` and its `@festgrid/testing-config/vitest-react` setup already exist (confirmed by directory listing) — reuse as-is, do not recreate.

### References

- [Source: _bmad-output/project-context.md] — Code Organization (`packages/ui/src/hooks/`), UI Patterns & UX Invariants ("Context-Aware Detail Views" invariant this hook implements).
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-4] — Multi-Tiered Strict State Management (Server State tier via `@tanstack/react-query`'s `useInfiniteQuery`, the contract this hook is designed to pair with).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6b] and neighboring Stories 1.3c, 1.6a, 1.6.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — swept Gate 1/3 report; Gate 1 finding text range-covers 1.1–1.6/1.3b/1.6a/1.8.
- [Source: _bmad-output/implementation-artifacts/1-3c-build-the-reusable-infinite-scroll-hook.md] — closest sibling precedent: headless hook story structure, `useInfiniteScroll`'s error-surfacing/dedupe/cleanup conventions, and its own "no further split" Gate 2 verdict reused as the template for this story's Gate 2 reasoning.
- [Source: packages/ui/src/hooks/useInfiniteScroll.ts, useInfiniteScroll.types.ts, index.ts] — confirmed current hook conventions and barrel-export state to extend.
- [Source: packages/ui/src/index.ts] — confirmed `export * from './hooks';` already present; no update needed.
- [Source: apps/web/src/app/[locale]/home-content.tsx] — confirmed the exact `useInfiniteQuery`/flattened-`items` shape this hook's first consumer (Story 1.6) will supply.
- [Source: apps/backend/src/schema/events.graphql] — confirmed current `event(id: ID!): Event` query shape (no slug lookup yet) — noted as Story 1.6's concern, not this story's.
- [Source: packages/testing-config/] — shared Vitest/RTL config (Story 0.10), consumed via `@festgrid/testing-config/vitest-react`.
- [Gate 2 subagent finding, run during this story's creation] — no design-artifacts spec exists for Next/Previous navigation; recommended AC refinements (error/retry surfacing, duplicate-fetch guard, forward-only pagination statement, precise input-contract pinning) folded into AC1/AC3/AC5/AC8.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/ui/src/hooks/`), UI Patterns & UX Invariants (Context-Aware Detail Views).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-4 (Multi-Tiered Strict State Management; `useInfiniteQuery` contract pairing).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/hooks/useContextAwareListNavigation.ts` — hook implementation.
  - NEW `packages/ui/src/hooks/useContextAwareListNavigation.types.ts` — `UseContextAwareListNavigationOptions<TItem>`, `ListNavigationTarget<TItem>`, `ListNavigationDirectionState<TItem>`, `UseContextAwareListNavigationResult<TItem>`.
  - NEW `packages/ui/src/hooks/useContextAwareListNavigation.test.ts` — hook tests.
  - UPDATE `packages/ui/src/hooks/index.ts` — add barrel exports for the new hook and its types.
  - NO CHANGE to `packages/ui/src/index.ts` (already re-exports `./hooks` in full — confirmed by reading the file).
  - NO CHANGE to `packages/ui/vitest.config.ts`/`package.json` test setup (already established by Story 1.3b/1.3c/1.5a/1.6a — confirmed present on disk).
- **Rule Mapping:**
  - *Code Organization (reusable hooks)* → hook placed in `packages/ui/src/hooks/`, generic and not events-specific, matching the cross-epic reuse requirement in epics.md.
  - *No React in `packages/domain`* → confirms this hook correctly belongs in `packages/ui`, not `packages/domain`, since it uses `useRef`/`useEffect`/`useState`.
  - *UI Patterns & UX Invariants (Context-Aware Detail Views)* → the hook's `previous`/`next`/`requestNext` contract is exactly the mechanism that invariant requires, decoupled from any specific route/rendering layer.
  - *Testing Philosophy (testing trophy)* → integration-style hook tests via Vitest + Testing Library's `renderHook`, not exhaustive unit fragmentation.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: mid-list previous/next resolution, previous disabled at start, next resolved without fetch when already loaded, `requestNext()` triggering `fetchNextPage` only at the boundary, no duplicate trigger while pending, resolution once `items` grows, boundary + `hasNextPage: false` short-circuit, rejected-fetch error surfacing without retry, and the no-list-context case.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing consumes this hook on a real page yet — that lands with Story 1.6).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `useContextAwareListNavigation` as a standalone, headless (no rendering) reusable hook in `packages/ui/src/hooks/`; no backend work, no live-data wiring into any page/modal route, no routing/URL-building logic, no Next/Previous button rendering (all handled by Story 1.6 and future Epic 2 stories).
- [ ] Architecture confirmed: hook built with plain React hooks only (no dependency on `@tanstack/react-query` or GraphQL types themselves — it accepts a compatible `items`/`currentId`/`hasNextPage`/`isFetchingNextPage`/`fetchNextPage` contract as arguments, staying decoupled), placed under `packages/ui/src/hooks/`.
- [ ] Testing plan confirmed: Vitest + `@testing-library/react`'s `renderHook` via the already-established `packages/ui/vitest.config.ts` (`@festgrid/testing-config/vitest-react`).
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-1-readiness.md` (no gap for this story — zero backend/data dependency, same shape as covered Story 1.3c); Gate 2 run fresh (no gap found; the four AC refinements — error surfacing, duplicate-fetch guard, forward-only pagination statement, precise input-contract pinning — are folded into AC1/AC3/AC5/AC8, not split out).
- [ ] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [ ] Hook tests (Vitest + `@testing-library/react`'s `renderHook`) for: mid-list previous/next resolution (no fetch), previous disabled at index 0 with `loading: false`, next resolved immediately when already loaded, `requestNext()` invoking `fetchNextPage` exactly once at the boundary, a second `requestNext()` call not re-invoking `fetchNextPage` while one is pending, the pending promise resolving once a re-render supplies a grown `items` array, boundary + `hasNextPage: false` resolving `null` without calling `fetchNextPage`, a rejected `fetchNextPage` populating `error` and resolving `null` without retrying, and the no-list-context case (`currentId` nullish or not present in `items`).
- [ ] No E2E test required for this story (no live page consumes this hook yet; E2E coverage arrives with Story 1.6's "happy path" and Next/Previous flows).
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per `project-context.md`; `packages/ui` follows the "testing trophy" integration-style approach.
- [ ] Note: Use `@festgrid/testing-config/vitest-react` (Story 0.10, already available and already configured in `packages/ui`) — do not create a parallel/ad hoc testing-config setup.

## Deliverables Checklist

- [ ] `useContextAwareListNavigation` hook implemented in `packages/ui/src/hooks/useContextAwareListNavigation.ts`.
- [ ] Strictly-typed `UseContextAwareListNavigationOptions<TItem>`/`ListNavigationTarget<TItem>`/`ListNavigationDirectionState<TItem>`/`UseContextAwareListNavigationResult<TItem>` (`useContextAwareListNavigation.types.ts`).
- [ ] Previous/next derivation from `items`/`currentId` with correct boundary behavior (start-of-list, already-loaded next, loaded-boundary).
- [ ] `requestNext()` imperative action: immediate resolution when already loaded; triggers `fetchNextPage` exactly once at the boundary; dedupes concurrent calls; resolves once `items` grows.
- [ ] Boundary + `hasNextPage: false` short-circuit (no fetch, immediate `null`, `disabled: true`).
- [ ] Error surfacing via `error` field on a rejected `fetchNextPage`, cleared on next successful call, no silent retry.
- [ ] No-list-context (deep-link) fallback: both directions disabled, no error thrown.
- [ ] Exported from `packages/ui`'s public entry point with TSDoc documentation and a usage example.
- [ ] Hook tests written and passing.

## Out of Scope

- Wiring `useContextAwareListNavigation` into the actual event detail modal/full-page routes, or rendering "Next"/"Previous" buttons — handled by Story 1.6.
- Building the navigation URL/route for the resolved `next`/`previous` target `id` (including reconciling the `slug` vs `id` identifier caveat noted in Dev Notes) — handled by Story 1.6.
- Any `@tanstack/react-query`/`useInfiniteQuery` setup or GraphQL data fetching — already handled by Story 1.3a (API) and Story 1.3/1.4/1.5 (consumption); this story only accepts their output shape as input.
- Reusing this hook for Favorites/Calendar detail views (Epic 2) — those stories consume this hook when built; not implemented here.
- Any visual "position indicator" (e.g. "3 of 24"), swipe gesture, or button placement — no such pattern exists in any authoritative UX artifact (confirmed by the Gate 2 subagent); would be a Story 1.6/1.6a rendering concern if ever added.

## Definition of Done

- [ ] All Acceptance Criteria (AC1–AC11) are met.
- [ ] Required hook tests (see Testing Requirements) are written and passing.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [ ] `useContextAwareListNavigation` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
