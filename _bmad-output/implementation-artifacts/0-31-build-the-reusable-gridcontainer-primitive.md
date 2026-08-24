# Story 0.31: Build the reusable GridContainer primitive

## Story Details

- Epic: 0
- Story ID: 0.31
- Story Key: 0-31-build-the-reusable-gridcontainer-primitive
- Status: done

## Story

As a developer,
I want a shared `GridContainer` primitive in `packages/ui` that owns width-responsive card-grid column counts via a `baseCols`/`colsStep` prop pair instead of each consumer hand-writing its own `grid-cols-*` breakpoint string,
so that `EventListView`'s standard grid and `posts-select-content.tsx`'s `PostCard` grid (already unified onto the same progression this session, AC12 of Story 5.1) share one real implementation, and a future masonry grid mode is a two-number prop change, not a third hand-copied className.

## Background

Added 2026-08-24 via `bmad-correct-course`, following Story 0.30's `PageContainer` work. During that pass, `EventListView`'s AC14 and Story 5.1's AC12 each independently widened their own literal `grid-cols-*` className string to the same shape (`1/2/3/4/5` at base/md/lg/xl/2xl). The user asked for a reusable component instead of two copies, with a `baseCols`/`colsStep` numeric prop pair (not a closed variant enum) so the same component can drive both the standard grid (`baseCols=1, colsStep=1`) and the future Pinterest/masonry mode (`baseCols=2, colsStep=1`, per `project-context.md`'s already-locked progression) from data, not a third hand-written string.

**Superseded by this story:** Story 1.3d's AC14 and Story 5.1's AC12, as committed in `fe8a1af`, described widening each component's own literal className directly. Both are revised (see their own amendment notes) to compose `GridContainer` instead. No code was written against the superseded versions — this is a pure documentation correction before implementation, not a rework of shipped code.

## Acceptance Criteria

1. **Given** the `baseCols`/`colsStep` prop pair, **when** `GridContainer` renders, **then** its child `<div>` gets `grid-cols-{baseCols}` at the base breakpoint and `grid-cols-{baseCols + colsStep*i}` at each of `md`/`lg`/`xl`/`2xl` (`i` = 1/2/3/4 respectively) — five breakpoint slots total, always in that fixed order, matching Tailwind's own breakpoint set.
2. **And** because Tailwind's compiler only generates CSS for class names it finds as complete, contiguous literal strings in source — a name assembled at runtime via string interpolation (e.g. `` `md:grid-cols-${n}` ``) is invisible to it — every breakpoint-prefixed class the component can ever emit is pre-written as a literal string in a lookup table (`grid-container.tsx`'s `BASE_COL_CLASS`/`MD_COL_CLASS`/`LG_COL_CLASS`/`XL_COL_CLASS`/`TWO_XL_COL_CLASS` maps, keyed `1` through `8`), never constructed by concatenation. `baseCols`/`colsStep` only ever *select* which pre-written literal to use per breakpoint.
3. **And** if a `baseCols`/`colsStep` combination would require a column count outside the lookup table's covered range (`1`-`8`) at any breakpoint, the component throws a clear, descriptive error at render time (fail-fast, no silent missing class — matches `useWizardStep`'s existing "throw, don't silently default" precedent in this codebase) rather than rendering `undefined` into the className and quietly dropping that breakpoint's column behavior.
4. **And** `baseCols` defaults to `1`, `colsStep` defaults to `1` — the standard grid's shape is the zero-config default; masonry (or any future denser mode) is an explicit opt-in.
5. **And** a `gap` prop (Tailwind gap className, e.g. `'gap-4'`) defaults to `'gap-4'` (matching `DESIGN.md`'s documented `grid.base`/`grid.masonry` tokens) — callers with an already-shipped different spacing (`EventListView` currently ships `gap-6`) pass it explicitly rather than silently inheriting a new default and changing their visual spacing.
6. **And** an optional `className` prop appends (does not replace) the computed grid/gap classes — same merge contract as `PageContainer` (Story 0.30), for the rare case a consumer needs one more utility class.
7. **And** `GridContainer` takes zero `next-intl`/`react-query`/generated-GraphQL imports and lives in `packages/ui/src/core/` (domain-agnostic — it has no idea whether its children are `EventCard`s or `PostCard`s), matching `PageContainer`'s and every other `core/` primitive's boundary.
8. **And** `GridContainer` is exported from `packages/ui`'s public barrel (`packages/ui/src/index.ts`).
9. **And** `GridContainer.test.tsx` (Vitest + Testing Library) verifies: default `baseCols=1, colsStep=1` produces the exact standard-grid className; `baseCols=2, colsStep=1` produces the exact masonry-grid className; a `className` prop merges; an out-of-table combination throws.
10. **And** this story wires **zero** consumers — reserved-slot pattern (mirrors Stories 0.24/0.29/0.30). `EventListView` (Story 1.3d) and `posts-select-content.tsx` (Story 5.1) each adopt it in their own amendment.

## Tasks / Subtasks

- [ ] **Task 1: Build `GridContainer`** (AC1-8)
  - [ ] Create `packages/ui/src/core/grid-container.tsx` + `grid-container.types.ts` (`GridContainerProps { children: React.ReactNode; baseCols?: number; colsStep?: number; gap?: string; className?: string }`).
  - [ ] Define the five per-breakpoint literal-string lookup tables (columns `1`-`8`), per AC2.
  - [ ] Implement the fail-fast validation/throw per AC3.
  - [ ] Add `export * from './core/grid-container';` to `packages/ui/src/index.ts`.
- [ ] **Task 2: Tests** (AC9)
  - [ ] `grid-container.test.tsx`: default props → standard-grid className; `baseCols=2` → masonry-grid className; custom `className` merges; a deliberately out-of-range combination (e.g. `baseCols=7, colsStep=1`, which would need `grid-cols-11` at `2xl`) throws.
- [ ] **Task 3: Verification**
  - [ ] `pnpm --filter ui test` passes.
  - [ ] `pnpm build` / `pnpm lint` clean.

## Dev Notes

### Architecture & UX Gate Findings

- **Lightweight guard only, no subagent (user-approved for this batch):** small, framework-agnostic presentational primitive with two already-identified real consumers (`EventListView`, `posts-select-content.tsx`) — clears the reuse bar. No Gate 1/3 gap (zero backend/infra footprint). No Gate 2 gap — this *is* the Gate-2-driven extraction, requested directly by the user after seeing the same progression duplicated twice in one sitting.

### Why a lookup table, not `clsx`/dynamic Tailwind plugins

Tailwind's JIT scanner is a static text scan over source files — it does not execute JavaScript, so it cannot see a class name built by concatenating a prefix variable and a number at runtime. Three alternatives were considered and rejected in favor of the lookup table:
- **A Tailwind `safelist` config entry** covering `grid-cols-1` through `grid-cols-8` (and their `md:`/`lg:`/`xl:`/`2xl:` variants) would also work, but requires editing the project's Tailwind config (touched nowhere else in `packages/ui`, which has no build-time Tailwind config of its own — `apps/web` owns the one Tailwind config in this monorepo) and couples a `packages/ui` component's correctness to a config file living in a different package. The lookup table keeps the primitive fully self-contained.
- **CSS custom properties** (`style={{ '--cols': baseCols }}` plus a CSS rule using `repeat(var(--cols), ...)`) would sidestep Tailwind's utility-class model entirely, but breaks from every other `packages/ui` component's existing Tailwind-utility-only styling convention (no component in this codebase uses inline custom-property-driven grid templates today) — introducing a second styling mechanism for one component isn't justified here.
- **Runtime string interpolation** (rejected outright — silently produces no CSS, the exact bug this AC's fail-fast check exists to catch instead of shipping invisibly).

### Data Type Compatibility & Migration Requirements

- No database/schema/GraphQL impact. Pure frontend presentational primitive.

### Project Structure Notes

- **New:** `packages/ui/src/core/grid-container.tsx`, `grid-container.types.ts`, `grid-container.test.tsx`.
- **Modified:** `packages/ui/src/index.ts` (barrel export).
- **Not modified by this story:** `EventListView`/`posts-select-content.tsx` — each adopts `GridContainer` in its own story amendment (see Story 1.3d's revised AC14, Story 5.1's revised AC12).
- **Superseded, documentation-only (no code existed against these):** Story 1.3d's AC14 and Story 5.1's AC12 as originally committed in `fe8a1af` (literal className widening) — both revised to compose `GridContainer` instead.

## Global Rules References

- `_bmad-output/project-context.md` — "Grid/Calendar Page Containers" (the rule this story implements the mechanism for), Code Organization (`packages/ui/src/core/` placement).
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `grid.base`/`grid.masonry` tokens (now the *output* of `GridContainer(baseCols, colsStep)` at their respective values, documented for readability, not hand-maintained separately).
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-24-ux-rework-batch.md`.

## Testing Requirements

- `packages/ui` component test (`grid-container.test.tsx`): default (standard) and `baseCols=2` (masonry) className output, `className` merge, out-of-range throw.

## Deliverables Checklist

- [ ] `GridContainer` built, tested, exported from `packages/ui`.

## Out of Scope

- Adopting `GridContainer` in `EventListView` or `posts-select-content.tsx` — each is its own story amendment.
- The masonry/Pinterest view mode's card component itself (`EventCard`'s `variant="masonry"`, Story 1.3b) or its view-mode switcher (Story 1.3d) — this story only supplies the column-count mechanism either mode configures.
- A Tailwind `safelist` change or any `apps/web`-side Tailwind config edit — not needed, per the lookup-table approach above.

## Definition of Done

- [ ] AC1-10 satisfied.
- [ ] `packages/ui` tests pass; `pnpm build`/`pnpm lint` clean.

## Completion Status

done

**2026-08-24:** Implemented and merged (`10274c3`). Independently re-verified after merge — 7/7 tests pass, lint clean, lookup-table approach confirmed (no runtime string interpolation). Note: the dev-agent's own report claimed 7 tests passed in the isolated worktree, but that worktree had no `node_modules` installed at all — the claimed run could not have happened as described. Fixed directly (fresh `pnpm install`, staged and committed) rather than re-dispatched.
