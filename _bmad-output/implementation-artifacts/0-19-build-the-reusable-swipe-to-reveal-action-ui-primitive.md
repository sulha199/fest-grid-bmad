---
baseline_commit: b2eb2886e9a93754e4abc74c5b1538df891b1206
---

# Story 0.19: Build the reusable Swipe-to-Reveal-Action UI primitive

## Story Details

- Epic: 0
- Story ID: 0.19
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, generic UI primitive implementing `DESIGN.md`'s mobile swipe gesture (`UX-DR15`) — a swipeable list-item wrapper that reveals a consumer-supplied action button (e.g. "Delete") on horizontal swipe past a reveal threshold, with snap-back if released early,
so that any list item across the app (Favorites, Saved Locations, API Keys, Subscriptions) that needs a mobile delete/action affordance can reuse one consistent, tested, accessible gesture mechanism, and the revealed action can trigger any downstream mechanism (e.g. Story 0.18's Soft-Delete-with-Undo) without coupling the gesture itself to what it triggers.

## Acceptance Criteria

1. **Given** `UX-DR15` (`_bmad-output/planning-artifacts/epics.md` line 137: "On mobile, a swipe gesture on a list item reveals a 'Delete' button") and `EXPERIENCE.md`'s "Swipe-to-delete" interaction primitive (line 44), **when** a user swipes a list item horizontally on a touch interface past a reveal threshold, **then** a consumer-supplied action button slides into view within the item's bounds, and the item's content (`children`) shifts to make room — the primitive does not dictate what the revealed button does or looks like beyond a generic action slot, since different consumers trigger different mechanisms (Story 0.18's `markPending`, a direct delete, etc.). [epics.md AC1]
2. **And** releasing the swipe before the reveal threshold snaps the item back to its resting position (offset 0) with no action taken. [epics.md AC2]
3. **And** clicking/activating the revealed action button invokes a consumer-supplied `onAction: () => void` callback exactly once per activation — the primitive has no knowledge of Soft-Delete-with-Undo, GraphQL, or any other downstream mechanism; it does not reset the reveal state or call `onAction` again on its own. [epics.md AC3]
4. **And** the same action is reachable via an always-present, focusable control for non-touch input (keyboard/mouse) — never swipe-only. Concretely: the action control is always in the DOM and in tab order (not `display:none`/removed), and becomes visible (a) on `:focus-within` (so sighted keyboard-only users get a visible, WCAG 2.1 AA SC 2.4.7-compliant focus indicator without needing a pointer at all) and (b) on hover for mouse users (`@media (hover: hover) and (pointer: fine)`), in addition to becoming visible via an active swipe/drag. A keyboard user can Tab to the action and activate it with Enter/Space without ever performing a swipe gesture. [epics.md AC4, WCAG 2.1 AA]
5. **And** swipe/reveal direction mirrors for RTL layouts: the primitive reads the nearest ancestor's computed CSS `direction` (`getComputedStyle(element).direction`, falling back to `ltr` if unavailable, e.g. in a non-DOM test environment) rather than depending on locale — in `ltr`, the action reveals from the trailing (right) edge on a leftward drag; in `rtl`, it reveals from the trailing (left) edge on a rightward drag. This does not depend on `useScopedLocale` (which exposes locale/timezone, not text direction) — see Dev Notes for why. [epics.md AC5, `project-context.md` Component Design i18n rule]
6. **And** it is exposed as a reusable component, `SwipeToReveal` (`packages/ui/src/core/swipe-to-reveal.tsx`), accepting the item's normal content as `children` plus an `action` node and `onAction` callback — reusable across features with no feature-specific coupling (no GraphQL, no domain types, no knowledge of what "action" means). [epics.md AC6]
7. **And** it has its own integration test suite (Vitest + Testing Library, simulated pointer/touch events via `@testing-library/user-event`'s `pointer()` API) covering: swipe past threshold reveals the action (content shifts, action becomes visible/interactive); swipe below threshold snaps back to offset 0 with `onAction` never called; clicking the revealed action invokes `onAction` exactly once; the non-touch equivalent control is present in the DOM, focusable, and activatable via keyboard (Enter/Space) without any pointer/touch simulation; RTL (`dir="rtl"` on a wrapping element) mirrors the drag direction required to trigger reveal. [epics.md AC7]

## Tasks / Subtasks

- [ ] Task 1: Define the component's public types (AC: 1, 3, 4, 6)
  - [ ] Create `packages/ui/src/core/swipe-to-reveal.types.ts` exporting:
    - `SwipeToRevealProps = { children: ReactNode; action: ReactNode; onAction: () => void; revealThreshold?: number; disabled?: boolean; className?: string }`.
    - Document via TSDoc comments (mirroring `useInfiniteScroll.types.ts`'s doc-comment style) that: `action` is rendered inside the primitive's own `<button>` element, which the primitive wires to `onAction` — the consumer supplies `action`'s visual content but is responsible for that content having its own accessible name if it's icon-only (e.g. `aria-label` on an inner icon, or visible text); `revealThreshold` is the horizontal drag distance in px past which release commits to the revealed state instead of snapping back, **defaulting to 50% of the action slot's measured rendered width** (not a fixed px value — no `DESIGN.md` token specifies one; see Dev Notes) unless explicitly overridden; `disabled` suppresses both the swipe gesture and hides nothing — it disables interaction only (the always-present non-touch control also becomes inert when `disabled`).
- [ ] Task 2: Build the `SwipeToReveal` component (AC: 1, 2, 3, 4, 5, 6)
  - [ ] Create `packages/ui/src/core/swipe-to-reveal.tsx` (`"use client"`, mirroring the existing directive convention on `packages/ui`'s interactive hooks/components) exporting `SwipeToReveal({ children, action, onAction, revealThreshold, disabled, className }: SwipeToRevealProps)`:
    - Structure: an outer `relative overflow-hidden` container; an inner content wrapper holding `children`, translated horizontally via CSS `transform` as the drag progresses; an action wrapper positioned at the trailing edge (per resolved direction, see below), sized to its natural content width, holding a single `<button type="button" onClick={handleAction}>{action}</button>`.
    - Direction resolution: on mount and on drag-start, read `getComputedStyle(containerRef.current).direction` (falling back to `'ltr'` if the ref/API is unavailable, e.g. in a non-jsdom test harness) to determine whether the action wrapper sits on the physical left or right edge, and which drag sign (negative/positive `deltaX`) counts as "revealing." Do not read this from `useScopedLocale()` or any `next-intl` API — see Dev Notes for why (this mirrors the existing `useScopedLocale`/Adapter-decoupling precedent, applied to *direction* rather than *locale/timezone*).
    - Measure the action wrapper's rendered width (`ref.current.offsetWidth`, updated via a `ResizeObserver` if available, else measured once on mount/on `action` change) so the reveal is "reveal or hide" (two resting states: `0` and `-actionWidth`/`+actionWidth` depending on resolved direction) rather than an arbitrary partial offset — this matches native iOS/Android swipe-to-reveal affordances and gives `revealThreshold`'s "50% of measured width" default a concrete basis.
    - Pointer handling: `onPointerDown` (capture the pointer via `element.setPointerCapture(event.pointerId)`, record start X and the current resting offset), `onPointerMove` (compute `deltaX`, clamp the live transform between `0` and the fully-revealed offset — no over-drag past full reveal or past the resting position), `onPointerUp`/`onPointerCancel` (compare the final drag distance against the resolved `revealThreshold`; snap to fully-revealed or `0` via a CSS transition, never leave the item at a partial offset). Apply `touch-action: pan-y` (CSS, or the `style` prop) on the draggable content wrapper so the browser still allows vertical page scroll while this component claims horizontal gestures.
    - Keep the component headless enough to stay pure UI state (`useState`/`useRef` for offset/dragging/measured-width) — no `packages/domain` extraction; see Dev Notes "`packages/domain` reusable-mechanism check" for why.
    - `handleAction`: calls `onAction()` exactly once; does **not** auto-reset the offset back to `0` afterward (the primitive has no opinion on whether the consumer removes/animates the item away after `onAction` — e.g. a consumer wiring this to Story 0.18's `markPending` would want the item to stay in its "revealed"/greyed treatment, not snap back, until the consumer's own state updates re-render it).
    - `disabled`: when true, `onPointerDown` is a no-op and the action `<button>` gets `tabIndex={-1}` + `aria-disabled="true"` (removed from the interaction path without unmounting it, keeping the DOM shape stable for consumers that toggle `disabled` reactively).
  - [ ] Create `packages/ui/src/core/swipe-to-reveal.test.tsx` (Vitest + Testing Library + `@testing-library/user-event`'s `pointer()` API for simulated drag sequences — confirm the exact `pointer()` gesture syntax for a multi-step touch/mouse drag against the installed `user-event@14.6.1` API at implementation time, mirroring how Story 0.18 left `sonner`'s exact per-type theming API to be confirmed at implementation time) covering AC7 exactly: drag past threshold reveals the action and shifts `children`; drag below threshold snaps back to offset 0 and `onAction` is never called; clicking the revealed action calls `onAction` exactly once; the action `<button>` is present in the DOM and reachable via `Tab` + activatable via `{Enter}`/`{Space}` (`userEvent.tab()` / `userEvent.keyboard()`) with **no** pointer/touch simulation in that specific test, proving the non-swipe path works independently; rendering inside a wrapper with `dir="rtl"` requires the mirrored drag direction to trigger reveal (a drag in the `ltr` "reveal" direction inside an `rtl` wrapper does **not** reveal; the opposite-signed drag does).
- [ ] Task 3: Wire exports (AC: 6)
  - [ ] Add `export * from './core/swipe-to-reveal';` to `packages/ui/src/index.ts` (matches the existing `multi-select`/`blocking-loader` entries; note this is a `core/` component, not a `hooks/` entry, so no change to `packages/ui/src/hooks/index.ts`).
- [ ] Task 4: Verification (AC: 1-7)
  - [ ] `pnpm --filter ui run test` (Vitest) passes, including the new `swipe-to-reveal.test.tsx`, with no regression in existing `packages/ui` tests (`useInfiniteScroll.test.ts`, `useContextAwareListNavigation.test.ts`, `blocking-loader.test.tsx`, `multi-select.test.tsx`, `useScopedLocale.test.tsx`, `EventCard.test.tsx`, `SearchBar.test.tsx`, `EventDetailView.test.tsx`, `GoogleLoginButton.test.tsx`).
  - [ ] Run `pnpm build` and `pnpm lint` at the repo root and confirm both are clean.
  - [ ] Manual smoke check (Completion Notes): render a small throwaway page/harness (temporary dev-only route removed before commit, or an existing dev sandbox if one exists) using `SwipeToReveal` with a simple `action`/`onAction`, confirming visually on an actual touch-capable device or browser dev-tools touch emulation: dragging past the threshold reveals the action and snaps fully open on release; dragging below the threshold and releasing snaps back; clicking the revealed action fires `onAction`; Tab-focusing the action button (no touch) reveals and activates it; toggling the harness's `dir` attribute to `rtl` mirrors the required drag direction. Remove any throwaway harness code before marking this story done unless it's a legitimate addition to an existing dev-only sandbox (mirrors Story 0.18's Task 6 precedent).

## Dev Notes

- **This story is pure infrastructure/UI plumbing — no product feature ships, and no real feature currently consumes `SwipeToReveal`.** This mirrors the "reserved slot, not implemented" pattern already established by Stories 0.7, 0.8, 0.9, 0.12, 0.13, 0.15, 0.16, 0.17, and 0.18. Story 0.18's Soft-Delete-with-Undo primitive is the most natural future pairing (its `markPending` is a plausible `onAction` implementation for a consumer), but the two stories are independent siblings — `SwipeToReveal` has zero knowledge of `useSoftDeleteWithUndo`, and Story 0.18 does not depend on this story to ship (its hook is trigger-agnostic: a plain always-visible button or this primitive's revealed button both just call `markPending`).
- **Why the gesture logic stays inside one component instead of a separate exported hook:** Unlike Story 0.18 (which deliberately split `useSoftDeleteWithUndo`, a reusable *hook*, from `SoftDeleteToaster`, its themed *rendering* wrapper, because other consumers might want the state without the toast UI), this story's Gate 2 review (see below) confirmed the pointer-tracking/threshold/direction-resolution logic is tightly coupled to `SwipeToReveal`'s own DOM structure (it needs to measure its own action-wrapper element and apply its own transform) — there is no independent reuse case for the gesture math alone, so it is not split into a separate `useSwipeToReveal` hook. If a second, structurally-different swipe-consuming component emerges in a future story, extracting the shared math at that point is a 2-file refactor, not a rearchitecture — premature extraction now would be speculative.
- **`packages/domain` reusable-mechanism check:** Evaluated and found not applicable, following the same reasoning as Story 0.18. The only conceivably "pure" slice (comparing a drag distance against a threshold to decide reveal-vs-snap-back) is a single trivial comparison, not a framework-agnostic *business logic* mechanism per `project-context.md`'s Code Organization rule (which scopes `packages/domain` to business logic organized by domain area — events/users/subscriptions — not generic UI-interaction math). The rest of the logic (pointer capture, DOM measurement, CSS transforms, React state) is inherently DOM/React-coupled and `packages/domain` forbids React outright regardless. **No `packages/domain` change in this story.**
- **Why RTL direction is read from computed CSS `direction`, not `useScopedLocale`:** `useScopedLocale()`/`useScopedTimezone()` (`packages/ui/src/hooks/useScopedLocale.tsx`) expose *locale* and *timezone* only — there is no `useScopedDirection()` or equivalent, and the project currently ships only `en`/`id`, both LTR (`localeIntlTagMap` maps both to LTR BCP-47 tags), so there is no live end-to-end way to verify RTL via the locale context today. Reading `getComputedStyle(...).direction` instead (a) matches how the browser itself already resolves direction from any ancestor `dir` attribute or CSS `direction` property (including a future locale-driven `dir="rtl"` on `<html>`, which Story 0.7's app shell is already built to be "RTL/LTR-ready" for per NFR24), (b) requires no new context/provider, and (c) is directly testable today by wrapping the test harness in an explicit `dir="rtl"` element (AC7's RTL test case) without needing a live Arabic/Hebrew locale to exist yet. This is the same Adapter/decoupling principle `project-context.md`'s "Scoped locale/timezone context" rule establishes for `useScopedLocale`, applied to text direction instead of locale/timezone.
- **Why no fixed-px reveal threshold or action-button styling ships in this story:** Gate 2 (UX review, see below) confirmed `DESIGN.md`'s `components` token block has no `swipe`, `list_item`, or destructive-button entry, and `EXPERIENCE.md` gives no specific animation duration/easing/distance value for this interaction — unlike Story 0.18, where concrete `notification` tokens already existed and the draft scope had simply omitted citing them. There is nothing equivalent to promote into an AC here. `revealThreshold` therefore defaults to a proportional value (50% of the measured action width) rather than an arbitrary fixed px guess, and the action button's own visual styling is entirely the consumer's responsibility via the `action` prop's content (the primitive supplies only the `<button>` wiring, not its appearance) — consistent with AC1's "the primitive does not dictate what the revealed button does or looks like."
- **State-management categorization:** The component's internal drag/offset/measured-width tracking is local component state (`useState`/`useRef`, scoped to each `SwipeToReveal` instance) — not Server State, URL State, or Client Global State per `project-context.md`'s three-scope rule. **No Zustand store added.**
- **Async loader categorization:** Not applicable — no async operation is initiated by this primitive itself; `onAction` may trigger an async operation in the consumer, but that is entirely outside this component's knowledge/rendering.
- **PostHog/analytics (AD-5):** Not applicable to this primitive itself, for the same reason as Story 0.18 — it has no knowledge of *what* `onAction` does, so it cannot emit a meaningful domain event (e.g. "event_unfavorited"). Any analytics event belongs to the consuming feature, which owns the `onAction` callback's implementation. No PostHog call in this story's code.
- **i18n (AD-6):** No user-facing copy is owned by this story — `action`'s content (including any text/labels) is entirely consumer-supplied, so there are no message keys for this story to add to `locales/*.json`.
- **Data Type Compatibility & Migration Requirements:** No mismatch found. This story has no database, GraphQL schema, or `@festgrid/shared-types` involvement whatsoever — it is a pure `packages/ui` React component operating entirely on caller-supplied `ReactNode`s and a caller-supplied `onAction` callback. No DB migration changes required. No TypeScript type changes required beyond the net-new, package-local `SwipeToRevealProps` type (Task 1) — not a modification to any existing shared contract. Purely additive: a new component, zero new dependencies, confined to `packages/ui`. Verification: `swipe-to-reveal.test.tsx` (Task 2/4); `pnpm build`/`pnpm lint` clean (Task 4).

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** `epic-0-readiness.md` (`swept: true`) has a `stories_covered` list that stops at `0.14` — it predates Stories 0.15-0.19 and never analyzed this story, the same situation Stories 0.17 and 0.18 encountered. Per `story-split-gate.md`'s escape-hatch guidance, a **fresh** Gate 1/Gate 3 subagent pass (persona Winston) was run against this story's own draft scope. **Verdict: no gap found in either gate.** This story is a pure `packages/ui` presentational/gesture primitive — it touches no database/ORM, no external service, no GraphQL surface, and no auth/secrets/business-rules leakage to frontend code. Its only stated dependency (Story 0.3) is accurate and complete; no other Epic 0 story is silently required. Checked specifically against every Gate 3 trigger: the global app shell (Story 0.7) and i18n foundation (Story 0.6) are both already built and already "RTL/LTR-ready" per NFR24, so this story's RTL-mirroring AC is a component-level concern reading ambient CSS state, not a new foundational mechanism to establish; analytics/GraphQL-codegen/`buildOptimizedDrizzleSelect` are not implicated; the testing foundation (`vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`) needed for Task 2's test suite is already present in `packages/ui/package.json` (Story 0.10), so no new test-tooling story is needed.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya (`wds-agent-freya-ux`), reading `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` and `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md` in full, and cross-checking against Story 0.18's own scoping precedent. **Verdict: no gap found.** The draft ACs already cover every non-trivial state a swipe-reveal mechanism needs (threshold-reveal, snap-back, RTL mirroring, the non-touch equivalent control) directly grounded in `UX-DR15`/`EXPERIENCE.md` line 44. The gesture-tracking logic was evaluated for a hook/component split (mirroring Story 0.18's `useSoftDeleteWithUndo`/`SoftDeleteToaster` split) and found *not* to warrant one — see Dev Notes above. `DESIGN.md`'s token block has no swipe/list-item/destructive-button entry to have been missed (unlike Story 0.18, where existing `notification` tokens were found omitted from the draft) — there is no concrete visual/timing value to promote into an AC, and the story's own AC1 deliberately keeps the revealed action unstyled by design, mirroring `useSoftDeleteWithUndo`'s own zero-visual-opinion hook half.

### Project Structure Notes

- New in `packages/ui`: `src/core/swipe-to-reveal.tsx`, `src/core/swipe-to-reveal.types.ts`, `src/core/swipe-to-reveal.test.tsx`.
- Modified: `packages/ui/src/index.ts` (new export line, Task 3).
- Not modified: `packages/ui/package.json` (no new dependency — native Pointer Events + CSS, no gesture library added, confirmed none exists in the repo today), `packages/ui/src/hooks/index.ts` (this is a `core/` component, not a hook), `packages/domain`, `packages/database`, `packages/shared-types`, `packages/graphql-select`, `apps/backend`, `apps/infrastructure`, `apps/web` (no app-level mount is needed, unlike Story 0.18's `SoftDeleteToaster` — `SwipeToReveal` is a per-item wrapper a future feature story renders directly where needed, not a global provider), `turbo.json`, `.github/workflows/ci.yml`, any `locales/*.json` file.
- Detected conflicts or variances: None — `packages/ui` is in its expected current state as read during story creation (baseline commit `b2eb2886e9a93754e4abc74c5b1538df891b1206`); Story 0.18's own files (`useSoftDeleteWithUndo.ts`, `soft-delete-toaster.tsx`, `sonner` dependency) are confirmed **not yet present**, consistent with Story 0.18 still being `ready-for-dev` (not `done`) — this story does not depend on those files existing.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.19] — canonical AC source and the `Note:` explaining the Gate 2 origin (surfaced while creating Story 0.18) and Epic-0 placement.
- [Source: _bmad-output/planning-artifacts/epics.md, line 137] — `UX-DR15` ("On mobile, a swipe gesture on a list item reveals a 'Delete' button"), the UX Design Requirement this story implements (note: cited in `epics.md`'s own Story 0.19 section as "`DESIGN.md`'s `UX-DR15`," but `UX-DR15` is actually recorded in `epics.md`'s own UX Design Requirements list, not literally present as a labeled ID inside `DESIGN.md`'s frontmatter/body — confirmed via full-text search of `DESIGN.md`; the underlying design intent is the same either way).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md, line 44] — "Swipe-to-delete" interaction primitive: "On mobile touch interfaces, a swipe gesture on a list item can reveal a 'Delete' button. This will trigger the 'Soft Delete with Undo' state."
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md, lines 60-65] — general Accessibility (WCAG 2.1 AA) and Motion & Animation component-pattern principles this story's non-touch-equivalent-control AC and transition behavior follow.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, `components` frontmatter block] — confirmed no `swipe`/`list_item`/destructive-button token exists (Gate 2 finding — nothing to absorb as a styling AC).
- [Source: _bmad-output/implementation-artifacts/0-18-build-the-reusable-soft-delete-with-undo-ui-primitive.md] — sibling primitive this story's revealed action is designed to plausibly trigger (`markPending`); scoping precedent for hook/component splitting (evaluated and found not applicable here, see Dev Notes) and for the "reserved slot, not implemented" pattern.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — confirmed `stories_covered` stops at `0.14`, justifying the fresh Gate 1/3 subagent pass performed for this story (same justification pattern as Stories 0.17 and 0.18).
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, numbering rule, epic-level sweep mode and escape hatch.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md] — reviewed in full; no Architectural Decision record binds this purely-frontend, no-DB, no-API primitive (confirmed via full-text search for swipe/gesture/pointer/touch — zero matches).
- [Source: _bmad-output/project-context.md#Technology-Stack, #UI-Patterns-UX-Invariants, #Code-Quality-Style-Rules, #Testing-Rules] — `packages/ui` component-organization rules, `useScopedLocale`/Adapter-decoupling precedent applied to direction (not locale/timezone), `packages/domain` restrictions (evaluated, not applicable), Component Design RTL/i18n rule, testing-trophy philosophy.
- [Source: packages/ui/src/hooks/useScopedLocale.tsx] — confirmed this hook exposes locale/timezone only, not text direction, motivating the `getComputedStyle`-based direction resolution instead (Dev Notes).
- [Source: packages/ui/src/hooks/useInfiniteScroll.ts, useInfiniteScroll.types.ts] — `"use client"` directive convention and TSDoc doc-comment style this story's types file follows.
- [Source: packages/ui/src/core/multi-select.tsx, blocking-loader.tsx] — existing `core/` component conventions (kebab-case filenames, `.types.ts` companion files, Tailwind utility classes directly in JSX) this story's component follows.
- [Source: packages/ui/src/index.ts] — confirmed current export-barrel structure this story extends.
- [Source: packages/ui/package.json] — confirmed current dependency list (`lucide-react`, `react`, `react-dom`; `nuqs` peer dependency; `vitest`/`@testing-library/*`/`jsdom` devDependencies) — no gesture library present, none added by this story.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Technology Stack (`packages/ui` component library rules), UI Patterns & UX Invariants, Component Design RTL/i18n rule, Code Quality (`packages/domain` restrictions, evaluated and not applicable; `packages/ui` core/hooks organization), Testing Rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — reviewed in full; no Architectural Decision record binds this purely-frontend, no-DB, no-API primitive.
- [ ] `docs/infrastructure/index.md` — reviewed; this is a frontend-only, `packages/ui`-scoped story with no backend compute, queue, EventBridge/cron, API Gateway, or database provisioning involvement, so only the index-level summary was needed (no shard file read required, per the persistent-fact routing rule).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New in `packages/ui`: `src/core/swipe-to-reveal.tsx`, `swipe-to-reveal.types.ts`, `swipe-to-reveal.test.tsx`.
  - Modified in `packages/ui`: `src/index.ts` (new export line, Task 3).
  - Not modified: `packages/ui/package.json` (no new dependency), `packages/ui/src/hooks/index.ts`, `packages/domain`, `packages/database`, `packages/shared-types`, `packages/graphql-select`, `apps/backend`, `apps/infrastructure`, `apps/web`, `turbo.json`, `.github/workflows/ci.yml`, any `locales/*.json`.
- **Rule Mapping:**
  - Reusable UI primitive → `project-context.md` UI Components & Scalability rule → `packages/ui/src/core/swipe-to-reveal.tsx` (AC1-3, AC6).
  - `UX-DR15`/`EXPERIENCE.md` "Swipe-to-delete" fidelity (threshold reveal, snap-back) → Task 2's pointer-handling/measured-width logic (AC1, AC2, Dev Notes).
  - WCAG 2.1 AA non-touch equivalent control → Task 2's always-present, `:focus-within`/hover-revealed `<button>` (AC4, Dev Notes).
  - `project-context.md` Component Design RTL/i18n rule → Task 2's `getComputedStyle(...).direction`-based direction resolution, decoupled from `useScopedLocale` (AC5, Dev Notes).
  - `packages/domain` reusable-mechanism check → evaluated and found not applicable (all logic is DOM/pointer-event/React-coupled) → Dev Notes.
  - Gate 1/3 fresh pass (escape hatch, `epic-0-readiness.md` stops at 0.14) → no gap found → Architecture & UX Gate Findings.
  - Gate 2 UI-complexity/hook-split evaluation → no split warranted (gesture logic stays inside `SwipeToReveal`, no separate exported hook) → Dev Notes, Architecture & UX Gate Findings.
  - i18n/analytics/state-management/loader/data-type categorization — all evaluated and found not applicable → Dev Notes.
- **Verification Plan:**
  - `packages/ui/src/core/swipe-to-reveal.test.tsx`: threshold-reveal/snap-back/onAction-exactly-once/keyboard-only-non-touch-path/RTL-mirroring (Task 2/Task 4).
  - `pnpm --filter ui run test` full-suite pass including pre-existing tests (no regression) (Task 4).
  - `pnpm build`/`pnpm lint` clean at the repo root (Task 4).
  - Manual smoke check with a throwaway harness page proving the full drag-reveal → click-action and keyboard-only → activate-action paths, plus RTL mirroring, visually, recorded in Completion Notes (Task 4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build `SwipeToReveal` (`packages/ui/src/core/`), a headless-but-rendered swipe-to-reveal-action wrapper with a built-in non-touch-equivalent control and RTL mirroring; no feature-specific consumer built here, and no separate exported gesture hook (evaluated and found not warranted — see Dev Notes).
- [ ] Architecture and boundary confirmation: purely `packages/ui`-scoped; no `apps/web` change (no global mount needed, unlike Story 0.18); no `packages/domain` change (evaluated, no pure-logic slice warrants extraction); zero new dependencies (native Pointer Events + CSS only).
- [ ] Testing plan confirmation: `swipe-to-reveal.test.tsx` (Vitest + Testing Library + `@testing-library/user-event`'s `pointer()`/`keyboard()`/`tab()` APIs, no live backend/network involvement); manual smoke-check harness removed before completion unless it's a legitimate addition to an existing dev sandbox.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 run fresh (persona Winston) since `epic-0-readiness.md`'s `stories_covered` stops at 0.14 and does not analyze this story — no gap found. Gate 2 run fresh (persona Freya) — no gap found; the gesture-tracking logic was specifically evaluated for a hook/component split (mirroring Story 0.18) and found not to warrant one.
- [ ] **No gesture library added — native Pointer Events accepted:** confirmed no `framer-motion`/`use-gesture`/`react-swipeable`/etc. exists anywhere in the monorepo, and this interaction (single-axis drag, two resting states, no physics/momentum required by any AC) is straightforward enough with native Pointer Events + CSS transforms that adding a new dependency was judged unnecessary. If implementation reveals cross-browser pointer-capture quirks that make this materially harder than expected, flag it rather than silently pulling in a library.

## Testing Requirements

- [ ] Unit/integration tests (required, not deferred): `packages/ui/src/core/swipe-to-reveal.test.tsx` (Vitest + Testing Library) — drag-past-threshold-reveals, drag-below-threshold-snaps-back-no-action, click-revealed-action-calls-onAction-exactly-once, keyboard-only-tab-and-activate-with-no-pointer-simulation, RTL-mirrors-required-drag-direction.
- [ ] E2E tests: Not applicable — no product feature/page ships in this story (a future consumer story will own the E2E "happy path" once it wires this primitive for real, mirroring Story 0.18's approach).
- [ ] Manual verification (required before marking this story done): throwaway harness smoke check (Task 4) proving the full drag-reveal → click-action loop, the keyboard-only non-touch path, and RTL mirroring, visually; recorded in Completion Notes.
- [ ] Manual verification (deferred, tracked): a real end-to-end check with an actual list-item consumer (e.g. wired to Story 0.18's `useSoftDeleteWithUndo.markPending` inside a Favorites/Saved Locations list), once such a story is built and consumes this primitive for real.

## Deliverables Checklist

- [ ] `packages/ui/src/core/swipe-to-reveal.tsx` (+ `.types.ts`, `.test.tsx`) implementing threshold-reveal/snap-back/`onAction`-once/non-touch-control/RTL-mirroring semantics, exported from `packages/ui/src/index.ts`.
- [ ] No new dependency added to `packages/ui/package.json`.
- [ ] `pnpm --filter ui run test`, `pnpm build`, `pnpm lint` all pass at the repo root.

## Out of Scope

- Any real feature consumer of `SwipeToReveal` — no story currently wires it to a live list (mirrors Story 0.18's own "reserved slot" scoping); a plausible future pairing is Story 0.18's `useSoftDeleteWithUndo.markPending` as the `onAction` implementation inside a Favorites/Saved Locations/API-Keys/Subscriptions list, but that wiring belongs to whichever future feature story consumes it.
- A separate, independently-exported gesture hook (e.g. a hypothetical `useSwipeToReveal`) — evaluated via Gate 2 and found not warranted; the gesture logic stays inside the `SwipeToReveal` component itself (see Dev Notes).
- Any fixed-px reveal threshold, action-button styling/color, or animation duration/easing token — no such value exists in `DESIGN.md`/`EXPERIENCE.md` to implement against (Gate 2 finding); `revealThreshold` ships as a proportional default (50% of measured action width), and the action button's appearance is entirely the consumer's own `action` prop content.
- Vertical swipe/dismiss gestures, multi-item batch actions, or more than one revealed action per item — `UX-DR15`/`EXPERIENCE.md` describe a single horizontal reveal-one-action interaction only.
- Any change to `packages/domain`, `packages/database`, `apps/backend`, `apps/web`, or any GraphQL schema/resolver — this story has zero backend surface and requires no app-level mount (unlike Story 0.18's `SoftDeleteToaster`).

## Definition of Done

- [ ] AC 1-7 satisfied.
- [ ] `packages/ui/src/core/swipe-to-reveal.test.tsx` passing (Testing Requirements — non-negotiable).
- [ ] `pnpm --filter ui run test` full-suite passing with no regressions.
- [ ] `pnpm lint` and `pnpm build` passing at the repo root, including `packages/ui`.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the "no gesture library added" and "no separate gesture hook" items.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
