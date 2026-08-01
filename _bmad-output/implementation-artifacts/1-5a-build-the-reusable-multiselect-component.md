# Story 1.5a: Build the reusable MultiSelect component

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.5a
- Status: ready-for-dev

## Story

As a developer,
I want a generic, reusable `MultiSelect` faceted-filter component in `packages/ui/src/core/`,
so that Story 1.5's Filter Hub (and future filter surfaces, e.g. Epic 3's FR31 filtering of subscribed-account events by type/category) can offer consistent multi-value selection without each feature rebuilding its own toggle/selection-state logic.

## Acceptance Criteria

1. **AC1 — Tap-to-toggle rendering, not a combobox:** Given a facet label (e.g. "Type", "Category") and a list of selectable options (`{ value: string; label: string }[]`), when `MultiSelect` renders, then it displays the facet label and every option as a tap-to-toggle button/tag, clearly indicating which options are currently selected — matching the authoritative UX interaction (`EXPERIENCE.md`: "Users can tap on `EventType`/`EventCategory` buttons/tags... Selected filters are clearly indicated"; the Sarah discovery scenario: "Taps on 'Family & Kids' category from the Filter Hub"). It is **not** a searchable popover/combobox — that pattern was explicitly rejected as an unsourced embellishment by the Gate 2 finding that split this story off Story 1.5 (see `epics.md` Story 1.5a Note).
2. **AC2 — Controlled multi-toggle selection:** `MultiSelect` is a controlled component (`selectedValues: string[]`, `onChange: (values: string[]) => void` props — no internal selection state) where tapping an unselected option adds its `value` to the array passed to `onChange`, and tapping a selected option removes it, supporting zero, one, or many simultaneous selections.
3. **AC3 — Clear action:** `MultiSelect` renders a "Clear" action that, when activated, calls `onChange([])`, resetting the facet's selection to empty. It only renders (or is only enabled) when `selectedValues` is non-empty — no-op clears are avoided.
4. **AC4 — Domain-agnostic:** `MultiSelect` accepts only generic props (`facetLabel`, `options`, `selectedValues`, `onChange`, optional `labels` — see AC9) — no FestGrid-specific business logic, enum imports, or knowledge of `EventType`/`EventCategory`, so it can be reused for any facet.
5. **AC5 — Accessibility:** Each option is a real `<button>` (keyboard-focusable and activatable via Enter/Space, not a `<div onClick>`), the toggle group is exposed to assistive tech as a multi-selectable group (e.g. `role="group"` with an accessible name from `facetLabel`, and each option button carries `aria-pressed` reflecting its selected state), and focus order follows the visual/DOM order of the options.
6. **AC6 — Empty options state:** When `options` is an empty array, `MultiSelect` renders the facet label with no option buttons and no "Clear" action, without throwing or rendering broken layout.
7. **AC7 — Layout for many options:** The option buttons wrap onto multiple lines (flex-wrap, not horizontal scroll or overflow clipping) when the combined width of all options exceeds the container width, so no option is ever visually cut off or unreachable.
8. **AC8 — RTL/logical-properties layout:** All spacing/alignment classes use logical CSS properties (e.g. Tailwind's `ms-*`/`me-*`/`start-*`/`end-*`, not `ml-*`/`mr-*`/`left-*`/`right-*`), per `project-context.md`'s Component Design rule (LTR/RTL scalability), matching the precedent already set by `packages/ui/src/core/app-shell/AppShell.tsx`.
9. **AC9 — i18n-ready microcopy via labels override:** The "Clear" action's label is not hardcoded — `MultiSelect` accepts an optional `labels` override prop (e.g. `{ clearLabel?: string }`) with an English default (`"Clear"`), following the same pattern Story 1.3b's `EventCard` established, so `packages/ui` stays free of a direct `next-intl` dependency while the consuming app (Story 1.5's `FilterHub`) can localize it via `next-intl` at the call site (AD-6).
10. **AC10 — Documented & exported for reuse:** `MultiSelect` (and its prop types) is exported from `packages/ui`'s public entry point (`packages/ui/src/index.ts`) from the exact path `packages/ui/src/core/multi-select.tsx` (the path Story 1.5 hard-depends on), with prop-level TSDoc, and has component tests proving the toggle/clear/empty/keyboard-a11y behaviors, so it is discoverable and reusable across features.

## Tasks / Subtasks

- [ ] Task 1: Scaffold the component and its types (AC1, AC4, AC10)
  - [ ] Create `packages/ui/src/core/multi-select.tsx` (exact path Story 1.5 imports from — see Dev Notes) implementing the base structure and facet-label rendering.
  - [ ] Define a strictly-typed `MultiSelectProps` interface (`facetLabel: string`, `options: MultiSelectOption[]`, `selectedValues: string[]`, `onChange: (values: string[]) => void`, `labels?: { clearLabel?: string }`), co-located as `packages/ui/src/core/multi-select.types.ts`.
- [ ] Task 2: Implement tap-to-toggle option rendering and selection logic (AC1, AC2, AC6, AC7)
  - [ ] Render each option as a `<button>` styled to visually distinguish selected vs. unselected state.
  - [ ] Toggling an option adds/removes its `value` from the `selectedValues` array via `onChange` — no internal state duplicating `selectedValues`.
  - [ ] Render nothing but the facet label when `options` is empty (AC6).
  - [ ] Use flex-wrap layout so options wrap rather than overflow/clip (AC7).
- [ ] Task 3: Implement the "Clear" action (AC3, AC9)
  - [ ] Render a "Clear" control that calls `onChange([])`, shown/enabled only when `selectedValues.length > 0`.
  - [ ] Source its label from `labels?.clearLabel ?? 'Clear'` (AC9).
- [ ] Task 4: Accessibility (AC5)
  - [ ] Wrap the option buttons in a `role="group"` container with an accessible name derived from `facetLabel` (e.g. `aria-label={facetLabel}`).
  - [ ] Set `aria-pressed={isSelected}` on each option `<button>`.
  - [ ] Verify keyboard operability: Tab moves through options/Clear in DOM order, Enter/Space activates the focused button (native `<button>` behavior — no custom key handling needed if native elements are used correctly).
- [ ] Task 5: RTL/logical properties (AC8)
  - [ ] Use only logical Tailwind spacing/alignment utilities (`ms-*`/`me-*`/`start-*`/`end-*`), matching `AppShell.tsx`'s existing convention — no `ml-*`/`mr-*`/`left-*`/`right-*`.
- [ ] Task 6: Export and document (AC10)
  - [ ] Export `MultiSelect`, `MultiSelectProps`, `MultiSelectOption` from `packages/ui/src/core/multi-select.tsx` (re-exporting the types file).
  - [ ] Add `export * from './core/multi-select';` to `packages/ui/src/index.ts` (extend the existing barrel — currently only `export * from './core/app-shell';` — do not remove that line).
  - [ ] Add TSDoc comments to the component and `MultiSelectProps` documenting purpose, defaults, and reuse guidance.
- [ ] Task 7: Tests (AC1-AC9)
  - [ ] Component tests (Vitest + `@testing-library/react`, `packages/ui/vitest.config.ts` — create only if it does not already exist, see Dev Notes) covering: rendering a facet label + options; toggling a single option calls `onChange` with it added; toggling a selected option calls `onChange` with it removed; multiple simultaneous selections; Clear calls `onChange([])` and is absent/disabled when selection is empty; empty `options` array renders no option buttons and no Clear action without throwing; each option button has correct `aria-pressed`; keyboard Tab+Enter/Space activates an option (via `@testing-library/user-event`); custom `labels.clearLabel` overrides the default "Clear" text.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is marked `swept: true`. Its `stories_covered` list predates this story (added 2026-08-01, after the 2026-07-31 sweep), so it is not literally named — but its one finding (missing GraphQL authenticated-context layer, resolved by Story 0.17) does not apply: `MultiSelect` is a pure, backend-independent presentation component (no data fetching, no auth dependency, no new API surface). No new Gate 1/3 gap for this story.
- **Gate 2 (run fresh via subagent persona Freya, 2026-08-01) — verdict: no further split.** The trigger that forced the original Story 1.5 → 1.5a split was a *stack* of independent complex-state dimensions in the rejected combobox pattern (open/close, internal search-filter, multi-toggle, keyboard nav, a11y). Reduced to a tap-to-toggle button group per `EXPERIENCE.md`/the Sarah scenario, `MultiSelect` has only one real interaction dimension (toggle membership) plus baseline a11y wiring — comparable in scope to Story 1.3b's `EventCard`, which bundles several sub-elements into one story without decomposing further. Splitting the toggle-button primitive from facet-grouping logic would be over-decomposition relative to that precedent (no async, no popover, no variants to justify it).
  - Gate 2 did surface AC gaps in the original bare-bones draft, folded into this story's ACs above rather than split out: empty-options state (AC6), option-wrapping layout (AC7), RTL/logical-properties layout (AC8), and an i18n-readiness `labels`/`clearLabel` prop (AC9) mirroring `EventCard`'s pattern.
  - **Disabled state — explicitly not built:** No current or near-term consumer (`FilterHub` in Story 1.5, or Epic 3's FR31) requires a disabled `MultiSelect`/option state. Documented here as a deliberate scope decision, not a missed gap — add it later if a consumer needs it.
  - **Documentation gap (informational only):** `design-artifacts/UX-festgrid-run-1/DESIGN.md` has zero design tokens for a tag/chip/toggle-button visual treatment (confirmed via search — no matches for "tag", "badge", "chip", "toggle", "filter"). This story follows the plain-Tailwind, no-Shadcn-coupling convention already established by `AppShell.tsx` (the only existing `packages/ui/src/core/` component) rather than blocking on token codification that doesn't exist yet.
- **Lightweight escape-hatch guard (no subagent):** Checked this story's specific scope for anything neither the epic-1 sweep nor the fresh Gate 2 pass anticipated — no new external service, no new data entity, no new infra dependency, no interaction with `apps/backend`/`packages/domain`/`packages/database`. Nothing new found.

### Data Type Compatibility & Migration Requirements

- **No database migration required by this story.** `MultiSelect` is a pure presentation component with no data-layer dependency — it accepts `options`/`selectedValues` as props from whichever consumer wires it up.
- **No backend/domain code changes required by this story.**
- **No changes required to `packages/shared-types`.** The component's `MultiSelectOption`/`MultiSelectProps` types are new, local to `packages/ui`, and intentionally domain-agnostic (no `EventType`/`EventCategory` coupling) — Story 1.5's `FilterHub` is responsible for mapping the actual enum values into `{ value, label }` option objects at the call site.

### State Management Categorization (AD-4)

- **Client Global State: None introduced.** `MultiSelect` is a fully controlled component — it owns no internal selection state; the consumer supplies `selectedValues` and receives changes via `onChange`. Where that state ultimately lives (e.g. Story 1.5's `FilterHub` storing it as URL State via `nuqs`) is entirely the consuming story's concern, not this one's.
- **Server State / URL State:** Not applicable to this story — no data fetching, no URL parameters read or written here.

### Loader Categorization (UI Patterns & UX Invariants)

- **Not applicable.** This story introduces no asynchronous operation — `MultiSelect` renders synchronously from props with no loading/blocking/non-blocking state to categorize.

### Architecture and technical constraints

- **Reusable component callout:** `MultiSelect` → `packages/ui/src/core/multi-select.tsx` — a **Core Primitive** per `project-context.md`'s "UI Components & Scalability" rule ("Place generic, domain-agnostic components... generic `MultiSelect`... in `packages/ui/src/core/`"), distinct from `packages/ui/src/features/<domain>/` where domain-specific components like `EventCard`/`FilterHub` live.
- **No `next-intl`, no Shadcn/ui import inside `packages/ui`:** Following the precedent set by `AppShell.tsx` (the only existing `packages/ui/src/core/` component) and Story 1.3b's `EventCard` — plain Tailwind classes, native HTML elements (`<button>`), `lucide-react` for icons if needed, no framework coupling. i18n is handled via the `labels` override prop (AC9), not a direct `next-intl` dependency.
- **File/path expectations:**
  - `packages/ui/src/core/multi-select.tsx` — the exact path Story 1.5 already hard-depends on (`import MultiSelect from 'packages/ui/src/core/multi-select.tsx' (Story 1.5a...)`, per its Dev Notes/Tasks).
  - `packages/ui/src/core/multi-select.types.ts` — `MultiSelectProps`/`MultiSelectOption`, re-exported from `multi-select.tsx`.
  - `packages/ui/src/core/multi-select.test.tsx` — component tests.
  - `packages/ui/src/index.ts` — extend with `export * from './core/multi-select';`, preserving the existing `export * from './core/app-shell';` line.

### Project Structure Notes

- **Testing scaffolding may already exist by the time this story is implemented.** Story 1.3b's plan also adds `packages/ui/vitest.config.ts` (via `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`, matching `packages/analytics/vitest.config.ts`'s pattern) and the corresponding `packages/ui/package.json` devDependencies/`test` script. As of this story's creation (2026-08-01), neither file exists yet (`packages/ui/vitest.config.ts` confirmed absent; `packages/ui/package.json` has no `test` script or testing devDependencies). Whichever of Story 1.3b/1.5a is implemented first creates these; the other must check for their existence first and extend/reuse rather than duplicate or conflict.
- New files live under `packages/ui/src/core/`, per `project-context.md`'s "Core Primitives" convention.
- Only existing file touched: `packages/ui/src/index.ts` (extend the barrel) — everything else is additive/new.

### Previous Story Intelligence

- **Story 1.3b (`EventCard`, same epic):** Established the `packages/ui` component conventions this story follows — plain Tailwind + native elements (no Shadcn, no `next/image`, no `next-intl`), a `labels` override prop for i18n-readiness (mirrored here as AC9), TSDoc + barrel export for reuse, and the `pnpm --filter @festgrid/ui test`/`lint` verification pattern. Also confirmed `packages/ui` has no testing scaffolding yet — this story inherits that same gap and must resolve it (see Project Structure Notes above).
- **Story 1.5 (same session, 2026-08-01):** The direct consumer — its `FilterHub` renders two `MultiSelect` instances (Type, Category) and is currently blocked pending this story ("hard dependency, not yet built"). Confirmed the exact import path (`packages/ui/src/core/multi-select.tsx`) this story must produce, and that the tap-to-toggle (not combobox) interaction was already settled by the same Gate 2 pass that split this story out.
- **Story 1.4:** Confirmed `apps/web` (not `packages/ui`) has Vitest + MSW fully wired — not directly relevant to this `packages/ui`-only story, but reinforces that `packages/ui`'s own testing setup is still an open gap shared with 1.3b.

### Git Intelligence Summary

- Recent commits (`dd2b535` "update task 0-17 status to review", `3c862ac` "add SUPABASE_URL to env template", `fc49f63`/`ac70779` "break down/refine implementation artifacts", `81f76dd` "mark story 1.2a as complete") touch planning artifacts, env config, and story docs — none touch `packages/ui` or any frontend component code. No in-flight application-code pattern exists yet for `packages/ui/src/core/` beyond `app-shell/`.

## Global Rules References

- `_bmad-output/project-context.md` (Technology Stack; Code Organization — Core Primitives vs Domain Features; UI Patterns & UX Invariants — RTL/LTR component design; Testing Rules)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-4, AD-6)
- `_bmad-output/planning-artifacts/epics.md` (Story 1.5a, Story 1.5)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`, `design-artifacts/D-Design-System/01-event-list-view.md`, `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.1-event-discovery/01.1-event-discovery.md`
- `docs/infrastructure/index.md` — reviewed; not applicable (frontend-only presentation component, no infra/backend changes)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- NEW `packages/ui/src/core/multi-select.tsx`: the `MultiSelect` component — tap-to-toggle option buttons, Clear action, a11y wiring.
- NEW `packages/ui/src/core/multi-select.types.ts`: `MultiSelectProps`, `MultiSelectOption` types.
- NEW `packages/ui/src/core/multi-select.test.tsx`: component tests (Vitest + Testing Library).
- UPDATE `packages/ui/src/index.ts`: add `export * from './core/multi-select';`.
- NEW (if not already added by Story 1.3b) `packages/ui/vitest.config.ts`: `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`.
- UPDATE (if not already updated by Story 1.3b) `packages/ui/package.json`: add `"test": "vitest run"` script and devDependencies `@festgrid/testing-config` (workspace), `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- **Consumed, not modified by this story:** none — this is a net-new, standalone component with no dependencies on other in-flight stories.

### Rule Mapping

- Core Primitive placement (`project-context.md` Code Organization) → `MultiSelect` built in `packages/ui/src/core/multi-select.tsx`, domain-agnostic (AC4).
- Authoritative UX interaction (Gate 2, `EXPERIENCE.md`) → tap-to-toggle buttons/tags, not a searchable combobox (AC1).
- i18n-first (AD-6) → `labels.clearLabel` override prop with English default, no direct `next-intl` dependency inside `packages/ui` (AC9).
- Accessibility (WCAG 2.1 AA precedent from Story 1.3b) → semantic `<button>` elements, `role="group"`, `aria-pressed` (AC5).
- Component Design RTL/LTR scalability (`project-context.md`) → logical Tailwind spacing utilities only (AC8).
- Reuse boundary (Gate 2 finding origin) → built once in `packages/ui/src/core/`, consumed by Story 1.5's `FilterHub` and, per epics.md's stated rationale, Epic 3's FR31.
- Testing Philosophy (testing trophy) → integration-style component tests via Vitest + Testing Library, matching Story 1.3b's approach.

### Verification Plan

- Component test: renders facet label + all options as toggle buttons.
- Component test: toggling an unselected option calls `onChange` with it added to the array.
- Component test: toggling a selected option calls `onChange` with it removed.
- Component test: multiple simultaneous selections are all reflected.
- Component test: Clear calls `onChange([])`; Clear is absent/disabled when `selectedValues` is empty.
- Component test: empty `options` array renders no option buttons/no Clear, without throwing.
- Component test: each option button's `aria-pressed` matches its selected state.
- Component test: keyboard Tab+Enter/Space (via `@testing-library/user-event`) toggles an option.
- Component test: custom `labels.clearLabel` overrides the default "Clear" text.
- `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, and TypeScript strict-mode type-check for `packages/ui` all clean.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `MultiSelect` as a standalone, presentation-only, domain-agnostic `packages/ui/src/core/` component; no backend work, no live-data wiring, no `FilterHub` composition (that is Story 1.5).
- [ ] Architecture confirmed: component built with plain Tailwind + native HTML elements only (no Shadcn import, no `next-intl`, no cross-boundary import of `apps/web` code), placed under `packages/ui/src/core/`, exact filename `multi-select.tsx` (matches Story 1.5's hard-dependency import path).
- [ ] Testing plan confirmed: Vitest + `@testing-library/react`/`@testing-library/user-event` component tests via `packages/ui/vitest.config.ts` (create only if Story 1.3b hasn't already added it — check at build time per Dev Notes/Project Structure Notes).
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from swept `epic-readiness/epic-1-readiness.md` (no gap applies — pure presentation component); Gate 2 run fresh, verdict "no further split," findings (empty-options state, option-wrap layout, RTL logical properties, `labels.clearLabel` i18n-readiness prop) folded into this story's ACs; disabled-state omission and missing DESIGN.md tag/chip tokens explicitly documented as accepted, non-blocking gaps.
- [ ] Human approval to start coding granted (pending)

## Testing Requirements

- Component tests (Vitest + `@testing-library/react`) for: base render, single/multi-select toggling, Clear behavior (present/absent), empty-options render, `aria-pressed` correctness, keyboard operability, `labels.clearLabel` override.
- No E2E test required for this story — no live page consumes `MultiSelect` yet (E2E coverage for the filter flow arrives with Story 1.5's `filter.spec.ts`).
- 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per `project-context.md`; `packages/ui` follows the "testing trophy" integration-style approach.

## Deliverables Checklist

- [ ] `MultiSelect` component implemented at `packages/ui/src/core/multi-select.tsx`.
- [ ] Strictly-typed `MultiSelectProps`/`MultiSelectOption` (`multi-select.types.ts`).
- [ ] Tap-to-toggle selection (0/1/many), Clear action, empty-options state.
- [ ] Accessibility: semantic buttons, `role="group"`, `aria-pressed`, keyboard operability.
- [ ] RTL-ready logical CSS properties.
- [ ] `labels.clearLabel` i18n-override prop with English default.
- [ ] Exported from `packages/ui`'s public entry point with TSDoc.
- [ ] Component tests written and passing.

## Out of Scope

- Composing `MultiSelect` into `FilterHub`, wiring it to `EventType`/`EventCategory` enums, `nuqs` URL state, or the DSL query-builder — all Story 1.5.
- Any searchable/popover/combobox interaction — explicitly rejected by the Gate 2 finding that created this story; not authoritative FestGrid UX.
- A disabled option/facet state — no current consumer requires it (see Dev Notes).
- Design-token codification for tag/chip/toggle-button visuals — none exist in `DESIGN.md` yet; this story follows the existing plain-Tailwind precedent rather than introducing new tokens.
- Storybook, visual-regression, or design-system tooling — not set up anywhere in this project yet.

## Definition of Done

- Acceptance criteria (AC1-AC10) satisfied.
- Required component tests pass.
- Lint and TypeScript strict-mode checks pass for `packages/ui`.
- `MultiSelect` exported from `packages/ui`'s public entry point and documented with TSDoc.

## Completion Status

Not started.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
