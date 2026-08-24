# Story 0.30: Build the reusable PageContainer primitive

## Story Details

- Epic: 0
- Story ID: 0.30
- Story Key: 0-30-build-the-reusable-pagecontainer-primitive
- Status: ready-for-dev (AC7 amendment; AC1-AC6 already delivered)

## Story

As a developer,
I want a shared `PageContainer` primitive in `packages/ui` that owns the full-width, responsive-min-width root wrapper every grid/calendar page needs,
so that the `"p-4 sm:p-8 space-y-8 max-w-7xl mx-auto"` className — found copy-pasted verbatim across 7 files (`home-content.tsx`, `favorites-content.tsx`, `feed-content.tsx`, `my-calendar-content.tsx`, `archive-content.tsx`, `account-content.tsx`, `posts-select-content.tsx`) — has exactly one implementation, and future pages get the correct behavior by construction instead of by copying a string.

## Background

Added 2026-08-24 via `bmad-correct-course`, expanding item #1 of `ux-rework-2026-08-24.md` ("root main page container should be wide consuming the space") after a wider sweep found the same container pattern duplicated across 7 pages, all capped at `max-w-7xl` (1280px), with no minimum-width floor and no width-driven column-count scaling on the card grids they wrap. See `sprint-change-proposal-2026-08-24-ux-rework-batch.md` and `project-context.md`'s new "Grid/Calendar Page Containers" rule (the authoritative spec this story implements).

A prior narrow implementation of item #1 (Story 1.3's original AC9: drop `max-w-7xl` on `home-content.tsx` only, via a one-line `w-full` class change) was completed in an isolated worktree (`story/1-3-ac9-full-width`) before this broader scope was identified. **That branch is superseded, not merged** — its single-file fix is subsumed by this story's shared primitive. Story 1.3's AC9 is revised (see that story's own amendment) to consume `PageContainer` instead.

## Acceptance Criteria

1. **Given** the duplicated container pattern above, **when** this story ships, **then** `packages/ui/src/core/page-container.tsx` exports a `PageContainer` component: a presentational wrapper accepting `children` and an optional `className` (merged, not replacing, the base classes — new page-specific spacing needs don't require forking the primitive).
2. **And** its base className is exactly `project-context.md`'s "Grid/Calendar Page Containers" rule: `"w-full min-w-[320px] sm:min-w-[640px] md:min-w-[768px] lg:min-w-[1024px] xl:min-w-[1280px] p-4 sm:p-8 space-y-8"` (matching `DESIGN.md`'s new `page_container.base` token) — no `max-w-*` cap.
3. **And** `PageContainer` takes zero `next-intl`/`react-query`/generated-GraphQL imports (matches every other `packages/ui/src/core/` primitive's framework-agnostic boundary, `project-context.md`'s Code Organization rule).
4. **And** `PageContainer` is exported from `packages/ui`'s public barrel (`packages/ui/src/index.ts`).
5. **And** a `PageContainer.test.tsx` (Vitest + Testing Library) verifies: renders children, base className present, a passed `className` prop is merged (both base and custom classes present, neither silently dropped).
6. **And** this story wires **zero** consuming pages — it ships the primitive only, reserved-slot pattern (mirrors Stories 0.7/0.8/0.13/0.23/0.24/0.29). Each consumer (Story 1.3, 2.2, 2.6, 3.7, 3.11, 4.8, 5.1 — see `sprint-status.yaml`) adopts it in its own amendment.
7. **AC7 — `fullWidth` prop for contained (settings/table/form) pages (added 2026-08-24, same day, after the settings pages' `max-w-3xl`/`max-w-4xl` split was found):** And `PageContainer` accepts an optional `fullWidth?: boolean` prop, default `true` (existing behavior, AC2's className, unchanged for all 8 already-adopting consumers — zero prop needed for them). When `fullWidth={false}`, the className is instead `"w-full max-w-5xl mx-auto lg:min-w-[768px] p-4 sm:p-8 space-y-8"` (matching `DESIGN.md`'s new `page_container.contained` token) — a single floor at `lg` rather than the 5-step schedule (settings pages are never embedded in the widget, so they don't need `fullWidth={true}`'s narrow-host defense), capped at a common `max-w-5xl` replacing the inconsistent per-page `max-w-3xl`/`max-w-4xl` values found across 6 settings pages. `className` still merges on top of whichever variant is selected.

## Tasks / Subtasks

- [ ] **Task 1: Build `PageContainer`** (AC1-4)
  - [ ] Create `packages/ui/src/core/page-container.tsx` + `page-container.types.ts` (`PageContainerProps { children: React.ReactNode; className?: string }`).
  - [ ] Use a `cn`/`clsx`-style merge for `className` if one is already established elsewhere in `packages/ui` (check existing primitives for the project's own merge-utility convention before adding a new dependency); otherwise a plain template-string concatenation is acceptable for this simple case.
  - [ ] Add `export * from './core/page-container';` to `packages/ui/src/index.ts`.
- [ ] **Task 2: Tests** (AC5)
  - [ ] `page-container.test.tsx`: children render; base className string present; custom `className` prop appends rather than replaces.
- [ ] **Task 3: Verification**
  - [ ] `pnpm --filter ui test` passes.
  - [ ] `pnpm build` / `pnpm lint` clean.
- [ ] **Task 4: Add `fullWidth` prop (AC7, added 2026-08-24)**
  - [ ] Add `fullWidth?: boolean` to `PageContainerProps` (`page-container.types.ts`), default `true`.
  - [ ] Branch the base className string on `fullWidth`: the existing string (AC2) when `true`; `"w-full max-w-5xl mx-auto lg:min-w-[768px] p-4 sm:p-8 space-y-8"` when `false`.
  - [ ] Update `page-container.test.tsx` with new cases: default (`fullWidth` omitted) still matches AC2's className exactly (no regression for the 8 existing consumers); `fullWidth={false}` matches AC7's className exactly; `className` merges correctly on top of either variant.

## Dev Notes

### Architecture & UX Gate Findings

- **Lightweight guard only, no subagent (user-approved for this batch — same session as the AC9-expansion sweep):** a small, framework-agnostic presentational primitive with an obvious, already-specified className contract (`project-context.md`) and 7+ already-identified real consumers — clears the reuse bar trivially (AD-9's "reuse before regeneralization," normally requiring ≥2 consumers before extraction; this has 7 from day one). No Gate 1/3 gap (zero backend/infra footprint). No Gate 2 gap (this *is* the Gate-2-driven extraction — the correct-course pass that found the duplication).

### Data Type Compatibility & Migration Requirements

- No database/schema/GraphQL impact. Pure frontend presentational primitive.

### Project Structure Notes

- **New:** `packages/ui/src/core/page-container.tsx`, `page-container.types.ts`, `page-container.test.tsx`.
- **Modified:** `packages/ui/src/index.ts` (barrel export).
- **Not modified by this story:** every consuming page (`apps/web`) — each adopts `PageContainer` in its own story amendment, not here.
- **Superseded:** `story/1-3-ac9-full-width` worktree branch (see Background) — do not merge; its one-file change is redone via this primitive in Story 1.3's revised AC9.

## Global Rules References

- `_bmad-output/project-context.md` — "Grid/Calendar Page Containers" (the rule this story implements), Code Organization (`packages/ui/src/core/` placement).
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `page_container.base`/`grid.base`/`grid.masonry` tokens.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-24-ux-rework-batch.md`.

## Testing Requirements

- `packages/ui` component test (`page-container.test.tsx`): children render, base classes present, custom `className` merges.

## Deliverables Checklist

- [ ] `PageContainer` built, tested, exported from `packages/ui`.

## Out of Scope

- Adopting `PageContainer` in any consuming page — each is its own story amendment (1.3, 2.2, 2.6, 3.7, 3.11, 4.8, 5.1).
- The masonry/Pinterest card-grid view mode itself (Story 1.3b/1.3d) — this story only supplies the page-level width wrapper; the card-grid column-count rule lives in `EventListView` (Story 1.3d).

## Definition of Done

- [ ] AC1-6 satisfied.
- [ ] `packages/ui` tests pass; `pnpm build`/`pnpm lint` clean.

## Completion Status

ready-for-dev

**2026-08-24:** AC1-AC6 implemented and merged (`c44ba15`). Independently re-verified after merge — 3/3 tests pass, lint clean. Note: the dev-agent's own report of the isolated-worktree verification (tests/lint/build/code-review) did not hold up on inspection — the worktree's `node_modules` was a broken symlink and the component files were never actually committed to the branch. Fixed directly (fresh `pnpm install`, staged and committed) rather than re-dispatched.

**2026-08-24, later same day:** Reopened for AC7 (`fullWidth` prop) — settings pages need a `max-w-5xl`-capped variant, not the grid pages' uncapped one. AC1-AC6 unaffected.
