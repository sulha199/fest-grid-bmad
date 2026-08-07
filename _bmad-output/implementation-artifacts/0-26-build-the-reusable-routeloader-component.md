# Story 0.26: Build the reusable RouteLoader component and wire it into every route Suspense boundary

## Story Details

- Epic: 0
- Story ID: 0.26
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a shared, generic loading component used as the fallback for every route-page's top-level Suspense boundary,
so that navigating to any route (or opening the event-detail modal) shows a consistent, on-brand loading state instead of a blank flash, without each route building its own fallback (project-context.md's "Route-Level Suspense Fallback" rule, PRD §3.12 "Global UI & Navigation Patterns").

## Acceptance Criteria

1. **Given** the existing `Logo` component (`packages/ui/src/core/app-shell/Logo.tsx`), **when** this story is implemented, **then** its icon-only 2x2 grid logomark is extracted into a new `LogoMark` component (`packages/ui/src/core/app-shell/LogoMark.tsx`) with no behavior change to `Logo`, which now composes `LogoMark` instead of duplicating its markup. `LogoMark` accepts an optional `className` prop (merged via the same plain-template-literal pattern `Logo.tsx`/`swipe-to-reveal.tsx` already use — `packages/ui` has no `cn()`/`clsx`/`tailwind-merge` dependency; do not add one) so its size can be overridden by consumers (`Logo` keeps its current `w-6 h-6`; `RouteLoader` renders it larger).
2. **And** a new `RouteLoader` component is added at `packages/ui/src/core/route-loader.tsx` that centers a `LogoMark` and fills its containing element (`w-full h-full flex items-center justify-center` sizing, driven by the parent — never `fixed`/viewport-locked), **plus** a baked-in `min-h-32` (8rem/128px) fallback on the same root element so the loader never visually collapses when its parent has no definite height (see AC3/Dev Notes — decided via explicit user tradeoff call, not left as a `h-full`-only implementation). The mark has a "beating" (pulse/scale) CSS animation, implemented as a new Tailwind keyframe named `heartbeat` in `apps/web/tailwind.config.ts` (there is currently no custom pulse/heartbeat keyframe there, only Tailwind's default opacity `animate-pulse`; `theme.extend.keyframes`/`theme.extend.animation` already exist for `accordion-down`/`accordion-up` — extend the same objects, don't replace them).
3. **And** container-relative sizing is verified in both real usage contexts: (a) full-page routes, where it fills the content area beneath the persistent `AppShellWrapper` nav rail (the shell wraps `{children}` in the root `layout.tsx`, outside each page's own Suspense, so it never unmounts during route loads; `<main>` is `flex-1 flex flex-col` inside a `min-h-screen flex flex-col` root, giving it a definite computed height, so `h-full` alone resolves correctly there); and (b) the intercepted modal route (`@modal/(.)events/[slug]/page.tsx`), where the `Dialog`/`DialogContent` (`max-w-3xl max-h-[85vh] overflow-y-auto`) opens immediately and independent of data, has **no explicit height of its own** (only `max-h`, shrink-wraps to content) — `RouteLoader`'s `min-h-32` fallback from AC2 is what keeps it visible and centered there instead of collapsing toward zero height; it must render within the bounded box, not break out to the full viewport.
4. **And** `RouteLoader` respects `prefers-reduced-motion` (renders the static `LogoMark` with no animation when the user's OS/browser signals reduced motion) by reusing the existing `usePrefersReducedMotion()` hook (`packages/ui/src/hooks/usePrefersReducedMotion.ts`, already exported from `packages/ui/src/hooks/index.ts`) with the same simple boolean-branch pattern `useNavRailItemInteraction.ts` already uses — do not write a new reduced-motion detection mechanism. (Note: `BlockingLoader`, Story 1.7a, is cited in the epics.md AC as the "accessibility bar" for general rigor — focus handling, `aria-live` — but it does **not** itself implement `prefers-reduced-motion`; that specific behavior must come from `usePrefersReducedMotion`, not by copying `BlockingLoader`.)
5. **And** both `LogoMark` and `RouteLoader` are exported from `packages/ui`'s public entry point (`packages/ui/src/index.ts`, via the `app-shell` barrel for `LogoMark` and a new `export * from './core/route-loader';` line) for reuse across features.
6. **And** every existing route-page's top-level `<Suspense>` (currently fallback-less) is updated to pass `fallback={<RouteLoader />}`: `apps/web/src/app/[locale]/page.tsx`, `favorites/page.tsx`, `login/page.tsx`, `my-calendar/page.tsx`, `settings/locations/page.tsx`, `settings/notifications/page.tsx`, `events/[slug]/page.tsx`, and the modal-intercepted `@modal/(.)events/[slug]/page.tsx`. (`test-swipe/page.tsx` is a dev-only test harness, not a real route, and is out of scope.)
7. **And** any route-page created by a future story (Epics 3-5) follows the same rule per `project-context.md` — no further tracking needed here, enforced going forward by the rule itself.

## Tasks / Subtasks

- [ ] Task 1: Extract `LogoMark` from `Logo.tsx` (AC: #1)
  - [ ] Create `packages/ui/src/core/app-shell/LogoMark.tsx` containing the existing 2x2 grid markup (3 `bg-foreground` squares + 1 `bg-accent rotate-45 scale-75` "spark" square) from `Logo.tsx` lines 7-13, parameterized with an optional `className` prop (default `w-6 h-6`, merged via template literal like `Logo.tsx` does today — no new `cn()` dependency).
  - [ ] Update `Logo.tsx` to import and render `<LogoMark />` in place of the inline grid `div`, passing no override className (preserves current `w-6 h-6` visual output) — confirm no visual/behavior change.
  - [ ] Add `export * from './LogoMark';` to `packages/ui/src/core/app-shell/index.ts`.
- [ ] Task 2: Add the `heartbeat` Tailwind keyframe (AC: #2)
  - [ ] In `apps/web/tailwind.config.ts`, add a `heartbeat` entry to the existing `theme.extend.keyframes` object (alongside `accordion-down`/`accordion-up`) — e.g. `0%, 100%: { transform: 'scale(1)' }`, `50%: { transform: 'scale(1.15)' }`.
  - [ ] Add a matching `heartbeat` entry to `theme.extend.animation` (e.g. `'heartbeat 1.2s ease-in-out infinite'`).
- [ ] Task 3: Build the `RouteLoader` component (AC: #2, #3, #4)
  - [ ] Create `packages/ui/src/core/route-loader.tsx`: root `div` with `w-full h-full min-h-32 flex items-center justify-center`, rendering `<LogoMark className="h-10 w-10 ..." />` (or similar) with the `animate-heartbeat` class applied conditionally.
  - [ ] Call `usePrefersReducedMotion()` and only apply the `animate-heartbeat` class when it returns `false`; when `true`, render `LogoMark` with no animation class (static).
  - [ ] No props required for MVP — keep the component parameterless per its ACs (generic route-shell fallback, not a configurable widget).
- [ ] Task 4: Export from `packages/ui` public entry (AC: #5)
  - [ ] Add `export * from './core/route-loader';` to `packages/ui/src/index.ts`.
- [ ] Task 5: Retrofit the 8 Suspense call sites (AC: #6)
  - [ ] `apps/web/src/app/[locale]/page.tsx` — add `fallback={<RouteLoader />}` to the existing `<Suspense>`; import `RouteLoader` from `@festgrid/ui`.
  - [ ] `apps/web/src/app/[locale]/favorites/page.tsx` — same.
  - [ ] `apps/web/src/app/[locale]/login/page.tsx` — same.
  - [ ] `apps/web/src/app/[locale]/my-calendar/page.tsx` — same.
  - [ ] `apps/web/src/app/[locale]/settings/locations/page.tsx` — same.
  - [ ] `apps/web/src/app/[locale]/settings/notifications/page.tsx` — same.
  - [ ] `apps/web/src/app/[locale]/events/[slug]/page.tsx` — same.
  - [ ] `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` — same (this is the bounded-modal case; verify visually per AC3).
- [ ] Task 6: Testing (AC: #1, #2, #3, #4)
  - [ ] Unit test `LogoMark.tsx` (render, className override applied) and `route-loader.test.tsx` (renders `LogoMark`, applies `animate-heartbeat` when `usePrefersReducedMotion` mocked `false`, omits it when mocked `true` — mirror the `vi.mock('./usePrefersReducedMotion', ...)` pattern in `packages/ui/src/hooks/useNavRailItemInteraction.test.ts`) in `packages/ui` (100% coverage requirement does not apply here — that's `packages/domain`-only — but these are simple, cheap components worth covering under the project's normal integration-test expectations).
  - [ ] Integration/E2E: at least one check that a route's Suspense fallback actually renders `RouteLoader` during a simulated slow fetch (e.g. an MSW-delayed response in an existing route integration test, or a Playwright check on `events/[slug]` and the modal route per the "happy path E2E" Definition of Done). Manually verify in a browser (per project rule: UI changes must be checked in a running app) that: (a) a full-page route shows a full-content-area centered beating logo on slow load, (b) the modal route shows a centered, bounded loader that does not overflow `DialogContent`, (c) toggling OS/browser "reduce motion" removes the animation in both contexts.

## Dev Notes

- This story is **pure presentation-layer**: one extracted component (`LogoMark`), one new component (`RouteLoader`), one new Tailwind keyframe, and 8 mechanical one-line prop additions to existing `page.tsx` files. No database, API, GraphQL, or backend change of any kind.
- `packages/ui` has **no** `cn()`/`clsx`/`tailwind-merge` dependency (confirmed via `package.json` and `grep`). All existing components (`Logo.tsx`, `swipe-to-reveal.tsx`) merge conditional/optional classNames via plain template literals (e.g. `` `flex items-center gap-2 ${className || ''}` ``). Follow this exact convention for `LogoMark`/`RouteLoader` — do not introduce a new dependency for this.
- `usePrefersReducedMotion()` already exists (`packages/ui/src/hooks/usePrefersReducedMotion.ts`), is SSR-safe, and is already exported from `packages/ui/src/hooks/index.ts`. `useNavRailItemInteraction.ts` is the existing consumer precedent — a plain `const prefersReducedMotion = usePrefersReducedMotion();` boolean branch. Reuse it as-is; do not build a new detection mechanism.
- `BlockingLoader` (Story 1.7a, `packages/ui/src/core/blocking-loader.tsx`) is cited in the epics.md AC as the accessibility bar to match, but on inspection it implements focus-trapping and `aria-live`/`role="status"`, **not** `prefers-reduced-motion` — it always renders `animate-spin` unconditionally. `RouteLoader`'s reduced-motion behavior must come from `usePrefersReducedMotion`, not from copying `BlockingLoader`'s (nonexistent, for this concern) pattern.
- `RouteLoader` is a decorative/route-shell loading indicator, not an interactive or focus-managed overlay like `BlockingLoader` (which blocks the whole screen and traps focus for a critical mutation). Do not add focus-trap logic here — it isn't a blocking overlay, it's a Suspense fallback that gets unmounted the instant its sibling content resolves.
- **Modal sizing risk (resolved via explicit user decision, not left implicit):** `DialogContent` (`apps/web/src/components/ui/dialog.tsx`) has no `h-*`/definite height of its own — only `max-h-[85vh]` + `overflow-y-auto` — so it shrink-wraps to its content. A `RouteLoader` built with `h-full` alone would resolve `height: 100%` against an indeterminate ancestor and could collapse to near-zero visual height inside the modal, while working fine on full-page routes (where `<main>` does have a definite flex-computed height). Presented to the user as a real tradeoff via `AskUserQuestion`: (a) bake a `min-h-32` fallback into `RouteLoader` itself so it's self-contained regardless of parent context, vs. (b) push the fix to the one modal consumer by wrapping its Suspense fallback slot in an explicitly-sized wrapper `div`. **User chose (a)** — `RouteLoader` must ship with its own `min-h-32` fallback baked in; do not rely on `h-full` alone, and do not add a wrapper `div` around the modal's `<Suspense>` as a substitute.
- Root layout confirmation (`apps/web/src/app/[locale]/layout.tsx` + `AppShell.tsx`): the shell root is `min-h-screen flex flex-col`, `<main>` is `flex-1 flex flex-col md:ps-16 xl:ps-56 pb-14 md:pb-0`, and `{children}` (each route's `page.tsx`, which is just a bare `<Suspense>`) renders directly inside it — this is why `h-full` resolves correctly for the full-page case without any wrapper needed there.
- The authoritative UX spec (`design-artifacts/UX-festgrid-run-1/DESIGN.md`, "Logo Concept: The Spark in the Grid") describes the 4th grid square as a "Spark (4-Pointed Star)" shape, but the current `Logo.tsx` renders a rotated/scaled square (`rotate-45 scale-75`), not an actual star. This is a **pre-existing** mismatch predating this story; AC1 explicitly freezes `Logo`'s current visual output ("no behavior change to `Logo`") when extracting `LogoMark`, so reconciling the star-shape spec gap is out of scope here — do not "fix" it as a drive-by.
- PRD §3.12 "Global UI & Navigation Patterns" only documents the pre-existing Blocking/Non-Blocking loader dichotomy (full-screen overlay vs. skeleton/localized-spinner) — it does not yet describe this third "route-shell" loading layer. `project-context.md`'s new "Route-Level Suspense Fallback" rule (added 2026-08-07 alongside this story) is the authoritative spec for `RouteLoader` itself; no PRD conflict, this is additive.
- Full context and the original scoping decision trail live in `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` (the `bmad-correct-course` proposal that created this story) — it already resolved the "should the 8-site retrofit be its own story per consuming feature, or centralized here" question (user chose centralized, this story owns all 8 sites directly) so that is not reopened here.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Epic 0's readiness sweep (`_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md`, `swept: true`) only covers Stories 0.1–0.19 — Story 0.26 was added afterward (2026-08-07, via `bmad-correct-course`) and is not in its `stories_covered` list, so the swept report cannot be cited for it. Applying the lightweight escape-hatch guard instead of re-running full subagent gates: this story touches no database, no GraphQL/API surface, no external service, no auth/secrets, and depends only on already-built foundational tooling (the app shell/`AppShellWrapper`, the existing `usePrefersReducedMotion` hook, the existing `packages/ui` export/Tailwind-config mechanisms) — it does not call a DB/backend dependency from the frontend, introduce a new unbacked API surface, or depend on any cross-cutting tooling that doesn't already exist and isn't already tracked elsewhere in `epics.md`. Confirmed via direct grep of the architecture spine for `Suspense`/`RouteLoader`/route-shell terms (no matches) and via reading `AppShell.tsx`, `AppShellWrapper.tsx`, and the root `layout.tsx`. **No gap found** — Gate 1/3 do not need a fresh subagent run for this story.
- **Gate 2 (UI Complexity & Reusability):** Run via subagent (Freya/WDS UX lens) against the full draft scope, existing `Logo.tsx`/`BlockingLoader.tsx`/`usePrefersReducedMotion.ts` code, the Tailwind config, and the authoritative `DESIGN.md` Logo Concept section. Verdict: **no further split needed** — this story already *is* the dedicated, isolated reusable-component story Gate 2 would otherwise demand (its own ACs for composition, sizing/variants, a11y, and export contract), it introduces no new complex hook (reuses the existing `usePrefersReducedMotion` with the same simple pattern already established), and there is no UX-spec detail present in the authoritative docs that this draft omits (the one spec/implementation discrepancy found — the "Spark" star shape vs. the actual rendered square — predates this story and is explicitly out of scope per AC1's "no behavior change to `Logo`"). The subagent separately flagged the modal `h-full`-collapse risk described above as a plain implementation detail (not a Gate 2 split) — resolved via the `AskUserQuestion` decision recorded above (bake in `min-h-32`).
- **Escape hatch note:** None invoked for gate findings — no gap was found by any gate for this story's scope. (The `min-h-32` sizing question was a design-tradeoff decision, not a gate-triggered scope split, and was resolved via `AskUserQuestion` per the workflow's design-decision rule rather than silently picked.)

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story adds no database columns, API payloads, or TypeScript data models. `LogoMark`/`RouteLoader` are stateless presentational components with no props carrying persisted or API-sourced data.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required (only new component prop types, e.g. `{ className?: string }` for `LogoMark`, which are UI-local and not part of any shared data contract).
- Backward compatibility and rollout notes: Purely additive; existing `Logo` consumers are unaffected (AC1 requires zero visual/behavioral change). The 8 retrofitted `page.tsx` files gain a `fallback` prop only — no change to their existing content/data-fetching behavior.
- Verification checks: TypeScript compilation of `packages/ui` and `apps/web` after the change; the new unit tests (Task 6) prove `LogoMark`'s className override and `RouteLoader`'s reduced-motion branching behave as typed.

### Project Structure Notes

- `LogoMark.tsx` lives alongside `Logo.tsx` in `packages/ui/src/core/app-shell/` (same folder, per AC1) — both are app-shell-scoped visual identity primitives, consistent with existing `packages/ui` role-based organization (`core/app-shell/` for shell-scoped primitives vs. bare `core/` for generic, non-shell-specific primitives).
- `RouteLoader` lives directly under `packages/ui/src/core/` (not `core/app-shell/`), matching `project-context.md`'s explicit reference path (`packages/ui/src/core/route-loader.tsx`) and `blocking-loader.tsx`'s precedent — it's a generic, domain-agnostic primitive usable by any route, not shell-specific.
- No new subfolder needed; no new workspace package needed. This is squarely a `packages/ui` "Core Primitives" addition per `project-context.md`'s UI Components & Scalability rule.
- The `heartbeat` keyframe/animation lives in `apps/web/tailwind.config.ts` (the only Tailwind config in the monorepo that `packages/ui/src/**/*.{ts,tsx}` content-globs into, per its existing `content` array) — there is no separate Tailwind config inside `packages/ui` itself.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.26] — canonical AC text.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md] — full scoping rationale, evidence, and the closed "centralize the 8-site retrofit here" decision.
- [Source: _bmad-output/project-context.md#UI Patterns & UX Invariants] — "Route-Level Suspense Fallback" rule (authoritative spec for `RouteLoader`'s contract), added 2026-08-07 alongside this story.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.12 Global UI & Navigation Patterns] — pre-existing Blocking/Non-Blocking loader dichotomy this story adds a third layer alongside.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#Logo Concept: "The Spark in the Grid"] — logomark visual spec (2x2 grid, spark square), and the pre-existing star-shape discrepancy noted above.
- [Source: packages/ui/src/core/app-shell/Logo.tsx] — component being refactored.
- [Source: packages/ui/src/core/blocking-loader.tsx] — accessibility/precedent component (Story 1.7a).
- [Source: packages/ui/src/hooks/usePrefersReducedMotion.ts, packages/ui/src/hooks/useNavRailItemInteraction.ts] — reduced-motion hook and its existing consumer pattern.
- [Source: apps/web/tailwind.config.ts] — existing keyframe/animation structure to extend.
- [Source: apps/web/src/app/[locale]/layout.tsx, packages/ui/src/core/app-shell/AppShell.tsx, apps/web/src/components/layout/AppShellWrapper.tsx] — full-page route layout/height chain.
- [Source: apps/web/src/app/[locale]/@modal/layout.tsx, apps/web/src/components/ui/dialog.tsx] — modal `Dialog`/`DialogContent` bounding box and height behavior.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Epic 0 sweep frontmatter (`swept: true`, `stories_covered` ending at 0.19, not covering this story).

## Global Rules References

- [x] project-context.md (Route-Level Suspense Fallback rule; Code Organization/UI Components & Scalability rules; Testing Rules)
- [x] story-content-structure.md (canonical section order followed)
- [x] architecture spine (`festgrid-architecture-spine.md` — grepped for Suspense/route-shell terms, no relevant AD found; confirms no architecture conflict)
- [x] infrastructure docs (`docs/infrastructure/index.md` — frontend-only, no infra-layer change; index summary sufficient per its own routing rule)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/ui/src/core/app-shell/LogoMark.tsx`
  - New: `packages/ui/src/core/route-loader.tsx`
  - New: `packages/ui/src/core/app-shell/LogoMark.test.tsx`
  - New: `packages/ui/src/core/route-loader.test.tsx`
  - Modify: `packages/ui/src/core/app-shell/Logo.tsx` (compose `LogoMark` instead of inline markup)
  - Modify: `packages/ui/src/core/app-shell/index.ts` (export `LogoMark`)
  - Modify: `packages/ui/src/index.ts` (export `route-loader`)
  - Modify: `apps/web/tailwind.config.ts` (add `heartbeat` keyframe + animation)
  - Modify (8 files, one-line `fallback` prop + import each): `apps/web/src/app/[locale]/page.tsx`, `favorites/page.tsx`, `login/page.tsx`, `my-calendar/page.tsx`, `settings/locations/page.tsx`, `settings/notifications/page.tsx`, `events/[slug]/page.tsx`, `@modal/(.)events/[slug]/page.tsx`
- **Rule Mapping:**
  - `LogoMark`/`RouteLoader` placement in `packages/ui/src/core/` → project-context.md "UI Components & Scalability" (Core Primitives rule).
  - No `cn()`/`clsx` introduced into `packages/ui` → matches existing `packages/ui` convention (no rule violation; consistency over introducing an unnecessary new dependency).
  - `prefers-reduced-motion` via existing `usePrefersReducedMotion` hook → reuse-over-reinvention; avoids the "reinventing wheels" LLM failure mode this workflow exists to prevent.
  - `min-h-32` baked into `RouteLoader` → resolved user decision recorded in Dev Notes; must not be silently substituted with the wrapper-div alternative during implementation.
  - No DB/API/domain-package changes → project-context.md Code Organization rules not implicated; nothing to place in `packages/domain`.
  - Route retrofits stay one-line, mechanical → matches the closed "centralize in Story 0.26" decision from the `bmad-correct-course` proposal.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — new `LogoMark`/`RouteLoader` unit tests pass, existing `Logo`/`blocking-loader`/`useNavRailItemInteraction` tests still pass unmodified (proves no regression from the extraction).
  - `pnpm --filter apps/web build` (or `tsc --noEmit` across touched packages) — confirms the 8 retrofitted files and the Tailwind config change type-check and build cleanly.
  - Manual browser verification (per project rule: UI changes must be checked in a running app): full-page route slow-load shows a content-area-filling beating logo; modal route slow-load shows a bounded, centered, non-overflowing loader; OS/browser "reduce motion" toggled on removes the animation in both.
  - Lint (`pnpm --filter @festgrid/ui lint`, `pnpm --filter apps/web lint`) passes for all touched packages.

## Pre-Coding Approval Gate

- [ ] Scope confirmation (RouteLoader + LogoMark extraction + Tailwind keyframe + 8-site retrofit, exactly as scoped in epics.md Story 0.26 and this file — no additional scope)
- [ ] Architecture and boundary confirmation (packages/ui placement, no `cn()` dependency added, no DB/API/domain-package involvement)
- [ ] Testing plan confirmation (unit tests for both new/extracted components + manual browser verification in both full-page and modal contexts)
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — No gap found for this story (see Architecture & UX Gate Findings above); no prerequisite story required before implementation.

## Testing Requirements

- [ ] Integration tests (MSW-delayed fetch or equivalent proving a `Suspense` fallback actually renders `RouteLoader` on at least one full-page route and the modal route)
- [ ] E2E tests (Playwright happy-path check per Definition of Done "c" — event-detail route and/or modal loading state, if a suitable existing E2E spec can be extended cheaply; otherwise manual verification satisfies this story's low-risk, presentation-only scope per the project's testing-trophy philosophy)
- [ ] Unit tests for `LogoMark` and `RouteLoader` (packages/ui, Vitest + RTL, following `blocking-loader.test.tsx`/`useNavRailItemInteraction.test.ts` conventions)

## Deliverables Checklist

- [ ] `LogoMark` component extracted and exported, `Logo` refactored to compose it with zero visual change
- [ ] `RouteLoader` component built (fills parent, `min-h-32` fallback, beating animation, reduced-motion aware) and exported from `packages/ui`
- [ ] `heartbeat` Tailwind keyframe/animation added to `apps/web/tailwind.config.ts`
- [ ] All 8 route Suspense boundaries wired with `fallback={<RouteLoader />}`
- [ ] Unit tests for `LogoMark` and `RouteLoader` passing
- [ ] Manual visual verification in both full-page and modal contexts, with and without reduced motion

## Out of Scope

- Reconciling `Logo`'s rendered "spark square" against the UX spec's literal "4-Pointed Star" shape — pre-existing discrepancy, explicitly frozen by AC1, not touched by this story.
- Any change to `BlockingLoader` (Story 1.7a) to retroactively add `prefers-reduced-motion` support — noted as a gap in Dev Notes but not this story's responsibility; out of scope unless the user separately requests it.
- Any route-page in Epics 3-5 (not yet built) — covered automatically going forward by the project-context.md rule itself, per AC7.
- `test-swipe/page.tsx` — dev-only test harness, not a real route.

## Definition of Done

- [ ] AC satisfaction (all 7 ACs above)
- [ ] Required tests passing (unit tests for `LogoMark`/`RouteLoader`; at least one integration/E2E check per Testing Requirements)
- [ ] Lint and type checks passing for `packages/ui` and `apps/web`
- [ ] No regression in existing `Logo`, `BlockingLoader`, or `useNavRailItemInteraction` tests/behavior
- [ ] Manually verified in a running app per the project's UI-change verification rule (full-page + modal, with + without reduced motion)

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
