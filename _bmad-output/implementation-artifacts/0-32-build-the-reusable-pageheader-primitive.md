# Story 0.32: Build the reusable PageHeader primitive

## Story Details

- Epic: 0
- Story ID: 0.32
- Story Key: 0-32-build-the-reusable-pageheader-primitive
- Status: ready-for-dev

## Story

As a developer,
I want a shared `PageHeader` primitive in `packages/ui` that owns the page-title-plus-optional-action row every page needs,
so that the `<h1 className="text-3xl font-bold">`-plus-button pattern — found duplicated, with drifting heading styles (`widgets` uses `font-extrabold tracking-tight` instead) and inconsistent mobile-label handling (some pages hide the action label below `sm:`, others don't, some have no `flex-wrap` safety at all), across 18 files — has exactly one implementation.

## Background

Added 2026-08-24 via `bmad-correct-course`, alongside Story 0.30's `fullWidth` amendment, after the user pointed out a real rendered header (`/settings/subscriptions`) and asked for the pattern to be codified: an action button's label should hide on mobile (icon-only), and the header row should wrap rather than overflow when the title and a wide button don't both fit on one line.

## Acceptance Criteria

1. **Given** the duplicated header pattern above, **when** this story ships, **then** `packages/ui/src/core/page-header.tsx` exports a `PageHeader` component: `{ title: string; description?: string; action?: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean } }`.
2. **And** the root row renders `flex justify-between items-center flex-wrap` — a title and an action button that don't both fit on one line wrap to their own lines instead of overflowing or squishing.
3. **And** the title renders as `<h1 className="text-3xl font-bold">{title}</h1>` — the standardized style (fixes `widgets`' divergent `font-extrabold tracking-tight text-foreground`, and any other page's drift, once each adopts this primitive).
4. **And** when `description` is passed, a `<p className="text-muted-foreground mt-1">{description}</p>` renders beneath the title (matches `widgets`' existing subtitle, the only current page with one) — omitted entirely when not passed, not rendered empty.
5. **And** when `action` is passed, a button renders: `{action.icon}` always visible, `<span className="hidden sm:inline">{action.label}</span>` — the label hidden below `sm:` (icon-only on mobile), matching `subscriptions`/`locations`' already-correct existing behavior. `disabled` passes through to the native `<button disabled>` attribute. When `action` is omitted, no button renders (matches `api-keys`/`notifications`/`queue-status`, none of which have a header action today).
6. **And** `PageHeader` takes zero `next-intl`/`react-query`/generated-GraphQL imports — `title`/`description`/`action.label` are plain strings, already resolved by the caller via `useTranslations()`, matching every other `packages/ui/src/core/` primitive's framework-agnostic boundary.
7. **And** `PageHeader` is exported from `packages/ui`'s public barrel (`packages/ui/src/index.ts`).
8. **And** a `PageHeader.test.tsx` (Vitest + Testing Library) verifies: title renders; `description` renders when passed, absent when not; `action` renders an icon + a label wrapped in `hidden sm:inline`, absent entirely when `action` is not passed; `action.disabled` disables the button; clicking the action button calls `onClick`.
9. **And** this story wires **zero** consuming pages — reserved-slot pattern (mirrors Stories 0.24/0.29/0.30/0.31). Each consumer adopts it in its own amendment.

## Tasks / Subtasks

- [ ] **Task 1: Build `PageHeader`** (AC1-7)
  - [ ] Create `packages/ui/src/core/page-header.tsx` + `page-header.types.ts` (`PageHeaderAction { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }`, `PageHeaderProps { title: string; description?: string; action?: PageHeaderAction }`).
  - [ ] Reuse the button's existing visual style verbatim from `subscriptions-content.tsx`'s current add-button (`inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2`) plus `disabled:opacity-50 disabled:pointer-events-none` for the `disabled` case (not currently present on any existing header button — new, matches the project's established disabled-button convention elsewhere, e.g. `SummaryBar`).
  - [ ] Add `export * from './core/page-header';` to `packages/ui/src/index.ts`.
- [ ] **Task 2: Tests** (AC8)
  - [ ] `page-header.test.tsx`: title-only render; `description` present/absent; `action` present (icon + `hidden sm:inline` label, click fires `onClick`, `disabled` prop) / absent (no button in the DOM at all).
- [ ] **Task 3: Verification**
  - [ ] `pnpm --filter ui test` passes.
  - [ ] `pnpm build` / `pnpm lint` clean.

## Dev Notes

### Architecture & UX Gate Findings

- **Lightweight guard only, no subagent (user-approved for this batch):** small, framework-agnostic presentational primitive with 18 already-identified real consumers — clears the reuse bar trivially. No Gate 1/3 gap. No Gate 2 gap — this *is* the Gate-2-driven extraction, requested directly by the user after reviewing a real rendered header.

### Data Type Compatibility & Migration Requirements

- No database/schema/GraphQL impact. Pure frontend presentational primitive.

### Project Structure Notes

- **New:** `packages/ui/src/core/page-header.tsx`, `page-header.types.ts`, `page-header.test.tsx`.
- **Modified:** `packages/ui/src/index.ts` (barrel export).
- **Not modified by this story:** any consuming page — each adopts `PageHeader` in its own amendment. This pass scopes adoption to the 6 settings pages (`api-keys`, `subscriptions`, `notifications`, `locations`, `queue-status`, `widgets`) alongside their `PageContainer(fullWidth=false)` adoption — see those stories' own amendments. The remaining ~12 pages using the old `<h1 className="text-3xl...">` pattern (Discovery, Favorites, Feed, Archive, My Calendar, Manual Post Selection, the public account page, Reports, Votes, the two Moderator pages, Login) are a known, cataloged follow-up, not silently dropped — adopt on a future pass or opportunistically alongside other work on those files.

## Global Rules References

- `_bmad-output/project-context.md` — "Page Headers" (the rule this story implements), Code Organization (`packages/ui/src/core/` placement).
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `page_header.*` tokens.

## Testing Requirements

- `packages/ui` component test (`page-header.test.tsx`): title, description present/absent, action present/absent, label hidden-below-sm, click handler, disabled state.

## Deliverables Checklist

- [ ] `PageHeader` built, tested, exported from `packages/ui`.

## Out of Scope

- Adopting `PageHeader` in any consuming page beyond the 6 settings pages scoped in this batch (see Project Structure Notes above for the full remaining list).

## Definition of Done

- [ ] AC1-9 satisfied.
- [ ] `packages/ui` tests pass; `pnpm build`/`pnpm lint` clean.

## Completion Status

ready-for-dev
