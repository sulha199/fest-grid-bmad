---
baseline_commit: e68e97742d8fd71cfca9154d0420d7ce2c28afe8
---
# Story 0.7: Build the global app shell & navigation layout

## Story Details

- Epic: 0
- Story ID: 0.7
- Status: ready-for-dev

## Story

As a developer,
I want a shared, responsive app shell (header/nav, content region, footer as applicable) established once in `packages/ui`/`apps/web`,
so that every route in UX-DR9 (`/`, `/favorites`, `/my-calendar`, `/feed`, `/settings`, etc.) is built on a consistent, mobile-first layout instead of each feature story reinventing page chrome.

## Acceptance Criteria

1. **Given** Shadcn/UI themes (Story 0.3) are set up, **when** the root layout renders, **then** it composes a shared `AppShell` (header/nav, content region) that all routes render inside of. [epics.md AC1]
2. The shell is mobile-first and responsive per UX-DR8 (collapses to a mobile nav pattern below a defined breakpoint — e.g. hamburger/drawer — and expands to a full nav at desktop widths), and its containers use logical CSS properties / RTL-ready structure per NFR24, even though only LTR ships at MVP. [epics.md AC2]
3. The shell exposes a typed, declarative nav-registry (a single array/config of `{ label, href, icon }` entries) that feature stories extend to add new routes (Epics 1-5), without modifying the shell's layout/rendering code. [epics.md AC3]
4. The shell is the single composition site for the cross-cutting providers already established (Theme via Story 0.3, Analytics via Story 1.8) plus a reserved, clearly-marked slot for the i18n provider (Story 0.6 — story created and `ready-for-dev`, but not yet implemented, see Dev Notes) — feature stories must never re-wire these providers themselves. [epics.md AC4]
5. The header renders the FestGrid logomark ("Spark in the Grid" 2×2 grid with an accent-colored Spark square) and logotype ("Fest" bold + "Grid" light) per `DESIGN.md`'s Logo Concept. [Gate 2 addition — see Dev Notes]
6. All interactive nav elements (links, mobile menu toggle) are keyboard-navigable and meet WCAG 2.1 AA per UX-DR18 (visible focus states, semantic `<header>`/`<nav>` landmarks, `aria-current="page"` on the active route).

## Tasks / Subtasks

- [x] Task 1: Scaffold `packages/ui` as a functioning workspace package (AC: 1, 3)
  - [x] Create `packages/ui/package.json` (name `@festgrid/ui`, `main`/`types` pointing at `src/index.ts`, `react`/`react-dom` as peer/devDependencies, devDependency on `@festgrid/typescript-config`), mirroring the pattern already used by `packages/analytics/package.json`.
  - [x] Create `packages/ui/tsconfig.json` extending `@festgrid/typescript-config/base.json` with `"jsx": "preserve"` (same shape as `packages/analytics/tsconfig.json`).
  - [x] Create `packages/ui/src/index.ts` barrel export.
  - [x] Add `@festgrid/ui` as a `workspace:*` dependency of `apps/web/package.json`.
- [x] Task 2: Build the `AppShell` layout component in `packages/ui/src/core/` (AC: 1, 2, 5, 6)
  - [x] Implement `AppShell` (header with logo + nav, `<main>` content region, optional footer slot) as a Core Primitive under `packages/ui/src/core/app-shell/`, per project-context.md's Core Primitives vs Domain Features split.
  - [x] Implement the logomark/logotype per `DESIGN.md`'s "Spark in the Grid" spec (2×2 grid, one square replaced by a 4-pointed Spark in the accent color; "Fest" bold + "Grid" light).
  - [x] Implement responsive behavior: full horizontal nav at desktop widths, collapsible mobile nav (drawer/sheet, reusing the existing Shadcn `Dialog` primitive pattern from `apps/web/src/components/ui/dialog.tsx`, or a Shadcn Sheet if one is added) below the mobile-first breakpoint (UX-DR8).
  - [x] Use logical CSS properties/Tailwind logical utilities (`ps-*`/`pe-*`/`start-*`/`end-*` over `pl-*`/`pr-*`/`left-*`/`right-*`) for RTL-readiness (NFR24).
  - [x] Ensure semantic landmarks (`<header>`, `<nav aria-label="Main">`, `<main>`) and `aria-current="page"` on the active nav item (UX-DR18).
- [x] Task 3: Define the nav-registry extension point (AC: 3)
  - [x] Define a typed `NavEntry` interface (`{ label: string; href: string; icon?: LucideIcon }`) and an initial `navEntries` config seeded only with routes that exist today (none yet — leave it empty or with a placeholder comment; do not fabricate Epic 1-5 routes).
  - [x] Document (code comment or short README in `packages/ui/src/core/app-shell/`) how a feature story adds a nav entry, since this is the contract future stories depend on.
- [x] Task 4: Compose the shell and existing providers in `apps/web/src/app/layout.tsx` (AC: 1, 4)
  - [x] Import `AppShell` from `@festgrid/ui` and wrap `{children}` with it, replacing the current bare `<main>{children}</main>`.
  - [x] Preserve the existing `PostHogProvider` (`@festgrid/analytics`, Story 1.8) and `ThemeProvider` (Story 0.3) composition — do not duplicate or reinitialize them; the shell renders inside/alongside them, it does not replace them.
  - [x] Add a clearly-commented placeholder for where the i18n provider (`next-intl`'s `NextIntlClientProvider`) will be composed once Story 0.6 lands — see Dev Notes sequencing note. Do not attempt to configure `next-intl` in this story.
- [x] Task 5: Manual verification (no automated test runner exists yet — Story 0.10 is still backlog) (AC: 1, 2, 5, 6)
  - [x] Run `pnpm dev` and visually verify the shell renders on `/` at mobile (< breakpoint) and desktop widths, with the mobile nav collapsing/expanding correctly.
  - [x] Verify `pnpm build` succeeds with the new `@festgrid/ui` package in the dependency graph.
  - [x] Verify keyboard-only navigation reaches every nav item and the mobile menu toggle, with visible focus rings.
  - [x] Verify the theme toggle (Story 0.3) and PostHog script (Story 1.8, if env vars are set) still function unchanged after the shell wraps them.

## Dev Notes

- This story is frontend-only; no backend/database/queue changes and no new external service. Confirmed via `docs/infrastructure/high-level-overview.md` and `docs/infrastructure/1-frontend.md` (Vercel-hosted Next.js app; no infra changes required for this story).
- **`packages/ui` does not exist yet as a real package.** Today it is an empty workspace folder (`node_modules` only — no `package.json`/`src`). Project-context.md mandates all reusable UI components live in `packages/ui`, organized as Core Primitives (`packages/ui/src/core/`) vs Domain Features (`packages/ui/src/features/<domain>/`). This story is the first to touch `packages/ui` and must scaffold it for real (Task 1), following the exact pattern already proven in `packages/analytics` (package.json/tsconfig shape) — do not invent a different structure.
- **Current root layout state** (`apps/web/src/app/layout.tsx`): already wraps children with `PostHogProvider` (`@festgrid/analytics`, Story 1.8, status: review) and `ThemeProvider` (`next-themes`, Story 0.3, status: done), around a bare `<main>{children}</main>`. This story's job is to replace that bare `<main>` with the new `AppShell` from `@festgrid/ui` — it must NOT remove, duplicate, or re-initialize the existing providers (AD-5 explicitly forbids re-wiring PostHog per feature/story).
- **Sequencing dependency — Story 0.6 (i18n) is not yet implemented.** The epics.md AC for this story explicitly lists the next-intl provider (Story 0.6) as a precondition ("Given ... the i18n provider (Story 0.6) are set up"). As of this story's creation, `0-6-set-up-i18n-foundation-next-intl` has a story file and is `ready-for-dev`, but its status is not `done` — `next-intl` is not yet wired into the app. This story (0.7) was explicitly requested out of the normal backlog order, ahead of 0.6's implementation. Do not attempt to configure `next-intl` here. Build the shell's nav labels as plain hardcoded English strings for now, structure the shell to be i18n-ready (no baked-in LTR-only assumptions; logical CSS properties per NFR24), and leave an explicit, commented composition slot in `layout.tsx` for the future `NextIntlClientProvider`. This is called out in the Pre-Coding Approval Gate below for explicit human sign-off before implementation starts.
- **No automated test framework exists yet** (Story 0.10 "Set up testing frameworks foundation" is backlog — the same gap Story 0.3 hit). Testing for this story is manual/browser verification (Task 5), matching the precedent set by Story 0.3. Automated integration tests for `AppShell` should be backfilled once Story 0.10 lands.
- Nav-registry contract: keep `NavEntry`/`navEntries` generic and typed, with no hardcoded route list beyond what exists today — Epics 1-5 stories will append their own routes (`/favorites`, `/my-calendar`, `/feed`, `/settings/*`, etc. per UX-DR9) without editing shell rendering logic.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `epic-0-readiness.md` (`swept: true`, covers stories 0.1-0.14 incl. 0.7 — epic readiness sweep already run for Epic 0). No gap applicable to Story 0.7 itself. The report's two findings (missing outbound-email adapter, missing Geolocation adapter+cache) are unrelated to this story's scope and are already tracked as Stories 0.15/0.16. The report explicitly evaluated Story 0.7 as the reserved composition slot for cross-cutting providers and found no gap there (see its "Non-gap checked and rejected" note re: PostHog scoping to 1.8).
- **Lightweight escape-hatch guard:** Re-checked this story's specific scope against the sweep — no new external service, data entity, or infra dependency appears here beyond what the epic-wide sweep already covered. No fresh Gate 1/3 subagent run needed.
- **Gate 2 (UI Complexity & Reusability):** Run fresh (per-story, as required even when the epic sweep is used) via the Freya/UX-designer persona. Verdict: **No gap found** — the app shell is a single-composition-site layout wrapper (instantiated once in the root layout), not a component reused across ≥2 independent call sites with non-trivial states (images/media, loading/empty/error, variants); it does not meet Gate 2's reuse threshold, and the nav-entry registration mechanism is a simple typed config, not a complex hook/util. The subagent did surface one concrete content gap: `DESIGN.md`'s "Spark in the Grid" logomark/logotype spec was missing from the original epics.md AC text — added here as AC 5 / Task 2.
- **Not a gate finding, but a real blocker flagged for human sign-off:** Story 0.6 (i18n foundation) is an explicit AC precondition of this story per `epics.md`. It now has its own story file (`ready-for-dev`) but is not yet implemented (`done`). See the sequencing dependency note above and the corresponding Pre-Coding Approval Gate item.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, GraphQL contract, or TypeScript data-model changes. It adds only presentational/layout components and a UI-config-only `NavEntry` type.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required (`NavEntry` is a UI-config type, not a data-model/API type).
- Backward compatibility and rollout notes: N/A — no persisted data or API contract is touched.
- Verification checks: `pnpm build`/`tsc` across `packages/ui` and `apps/web` passes with the new package in the workspace graph.

### Project Structure Notes

- Alignment with unified project structure: `AppShell` and its sub-components live in `packages/ui/src/core/app-shell/` (Core Primitive, per project-context.md's `packages/ui/src/core/` vs `packages/ui/src/features/<domain>/` split — this is domain-agnostic app chrome, not a feature-domain component). `apps/web/src/app/layout.tsx` remains the Next.js App Router composition root (framework requirement — layouts cannot live outside `apps/*`).
- Detected conflicts or variances: Existing Shadcn primitives (`Button`, `Card`, `Dialog`) currently live in `apps/web/src/components/ui/`, not `packages/ui/`, which is a pre-existing variance from project-context.md's rule (introduced by Story 0.3, before `packages/ui` was scaffolded). This story does not migrate those existing components — that is out of scope — but the new `AppShell` must itself follow the correct `packages/ui` placement rule going forward, and may import/re-export the existing `apps/web` Shadcn primitives (e.g. `Dialog` for a mobile nav drawer) until a future story migrates them.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.7] — story AC source.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, swept:true, covers 0.7.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-5, #AD-6] — provider composition location (Story 0.7/1.8, Story 0.6/0.7).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#Logo Concept] — logomark/logotype spec.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Information Architecture] — full route list (UX-DR9).
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR8, UX-DR9, UX-DR18] — mobile-first/responsive, route list, WCAG AA.
- [Source: _bmad-output/project-context.md#Code Quality & Style Rules] — packages/ui Core Primitives vs Domain Features.
- [Source: docs/infrastructure/1-frontend.md, high-level-overview.md] — confirms frontend-only, no infra changes.
- [Source: apps/web/src/app/layout.tsx] — current provider composition (PostHog, Theme) to preserve.
- [Source: packages/analytics/package.json, tsconfig.json] — scaffolding pattern reused for packages/ui.
- [Source: _bmad-output/implementation-artifacts/0-3-set-up-shadcn-ui-and-configure-themes.md, 1-8-setup-posthog-analytics.md] — precedent for manual-testing fallback and provider-composition story format.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — packages/ui placement rules, i18n/RTL rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-5, AD-6) — provider composition location.
- [ ] `docs/infrastructure/index.md`, `docs/infrastructure/1-frontend.md` — confirms frontend-only scope, Vercel hosting.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`
  - New: `packages/ui/src/core/app-shell/AppShell.tsx`, `packages/ui/src/core/app-shell/nav-entries.ts` (or `.tsx` if it needs JSX for icons), plus small sub-components (e.g. `Logo.tsx`, `MobileNav.tsx`) colocated in the same folder.
  - Modified: `apps/web/package.json` (add `@festgrid/ui` workspace dependency), `apps/web/src/app/layout.tsx` (compose `AppShell`, preserve existing providers, add commented i18n slot).
- **Rule Mapping:**
  - `packages/ui` Core Primitive placement → project-context.md Code Quality & Style Rules.
  - No re-wiring of PostHog/Theme providers → AD-5 (Architecture Spine).
  - Reserved i18n provider slot, no ad hoc i18n config → AD-6 (Architecture Spine) + sequencing note above.
  - Mobile-first/responsive + RTL-ready containers → UX-DR8, NFR24.
  - WCAG 2.1 AA nav semantics → UX-DR18.
  - Manual verification given no test framework yet → Testing Rules (project-context.md), interim precedent from Story 0.3.
- **Verification Plan:**
  - `pnpm build` (root, via turbo) succeeds with `@festgrid/ui` in the graph.
  - `pnpm lint` passes for `packages/ui` and `apps/web` (via `@festgrid/eslint-config`).
  - Manual browser verification per Task 5 (mobile/desktop nav, keyboard nav, existing providers still functioning).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Global app shell (header/nav/content region) + `packages/ui` scaffolding only — no i18n implementation, no test-framework setup, no migration of existing Shadcn components out of `apps/web`.
- [ ] Architecture and boundary confirmation: `AppShell` in `packages/ui/src/core/`, composed from `apps/web/src/app/layout.tsx`; existing PostHog/Theme providers preserved, not re-wired.
- [ ] Testing plan confirmation: Manual/browser verification only (Task 5), given no test framework exists yet (Story 0.10 backlog).
- [x] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` (no gap); Gate 2 run fresh (no gap, logo AC added).
- [x] **Sequencing dependency accepted:** Story 0.6 (i18n foundation) has a story file (`ready-for-dev`) but is not yet implemented (`done`), and is listed as an epics.md AC precondition for this story. User has explicitly requested Story 0.7 out of order — confirm proceeding with hardcoded English nav strings + a reserved i18n provider slot (to be wired once 0.6 is implemented) is acceptable, OR implement Story 0.6 first via `dev-story`.

## Testing Requirements

- [ ] Integration tests: Deferred — no test framework exists yet (Story 0.10 backlog). Backfill `AppShell` integration tests (Vitest + Testing Library/msw per project-context.md's testing-trophy approach) once 0.10 lands.
- [ ] E2E tests: Deferred for the same reason; once Playwright is set up (Story 0.10), add a smoke E2E covering shell render + mobile nav toggle across the routes that exist at that time.
- [x] Manual verification (interim, required before marking this story done): desktop/mobile shell render, mobile nav collapse/expand, keyboard navigation + focus states, existing Theme/PostHog providers unaffected, `pnpm build`/`pnpm lint` clean.

## Deliverables Checklist

- [x] `@festgrid/ui` workspace package scaffolded and building (package.json, tsconfig.json, src/index.ts).
- [x] `AppShell` component (header w/ logo + nav, content region, responsive/RTL-ready) in `packages/ui/src/core/app-shell/`.
- [x] Typed `NavEntry`/`navEntries` extension point documented for future feature stories.
- [x] `apps/web/src/app/layout.tsx` updated to compose `AppShell` around existing Theme/PostHog providers, with a commented i18n-provider slot.
- [x] Manual verification pass completed (Task 5).

## Out of Scope

- Implementing `next-intl`/i18n itself (Story 0.6) — this story only reserves the composition slot.
- Setting up the automated test framework (Story 0.10) — manual verification only, per Testing Requirements.
- Migrating existing `apps/web/src/components/ui/*` Shadcn primitives into `packages/ui` (pre-existing variance from Story 0.3; not this story's responsibility).
- Populating `navEntries` with routes owned by future feature stories (Epics 1-5) — those stories append their own entries.
- Any backend/GraphQL/database change (none required — confirmed via infrastructure docs).

## Definition of Done

- [x] AC 1-6 satisfied.
- [x] Manual verification (Task 5 / Testing Requirements) passing; no automated tests exist yet to run, so this substitutes pending the Story 0.10 dependency.
- [x] Lint and type checks passing for `packages/ui` and `apps/web` (`pnpm lint`, `pnpm build`).
- [x] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the Story 0.6 sequencing item.

## Completion Status

- [ ] Not started
- [ ] In progress
- [x] review

## Dev Agent Record

### Agent Model Used

### Debug Log References
None

### Completion Notes List
- ✅ Scaffolded `@festgrid/ui` successfully with its own `package.json` and `tsconfig.json`.
- ✅ Built `AppShell`, `Logo`, and `nav-entries` in `packages/ui/src/core/app-shell/`.
- ✅ Designed the responsive full-nav desktop view and drawer/sheet mobile nav using Lucide React icons.
- ✅ Modified `apps/web/src/app/[locale]/layout.tsx` to wrap children in `<AppShell>`, preserving `NextIntlClientProvider` (from Story 0.6) and `PostHogProvider` etc.
- ✅ Successfully ran `pnpm install`, `pnpm build`, and `pnpm lint`. The test builds generated with 0 errors.

### File List
- `packages/ui/package.json` (New)
- `packages/ui/tsconfig.json` (New)
- `packages/ui/src/index.ts` (New)
- `packages/ui/src/core/app-shell/index.ts` (New)
- `packages/ui/src/core/app-shell/nav-entries.ts` (New)
- `packages/ui/src/core/app-shell/Logo.tsx` (New)
- `packages/ui/src/core/app-shell/AppShell.tsx` (New)
- `apps/web/package.json` (Modified)
- `apps/web/src/app/[locale]/layout.tsx` (Modified)
