# Story 0.9: Set up state management foundation (React Query, nuqs, Zustand)

## Story Details

- Epic: 0
- Story ID: 0.9
- Status: ready-for-dev

## Story

As a developer,
I want to configure `@tanstack/react-query`, `nuqs`, and `zustand` strictly within the frontend application (`apps/web`),
so that all future features have a clear, type-safe pattern for managing server state, URL state, and client global state without creating unnecessary shared workspace packages.

## Acceptance Criteria

1. **Given** the Next.js app is initialized (Story 0.1), **when** I load a page, **then** a `QueryClientProvider` (from `@tanstack/react-query`) is configured at the root and wraps the app so any component can use React Query hooks. [epics.md AC1 / AD-4 tier 1]
2. `nuqs` is configured for handling URL search parameters type-safely — the Next.js App Router adapter (`NuqsAdapter`) is wired at the root so `useQueryState`/`useQueryStates` work anywhere in the tree without per-page setup. [epics.md AC2 / AD-4 tier 2]
3. A pattern for ephemeral global UI state using `zustand` is established with a working, interface-driven example store (strictly-typed `State`/`Actions`, per AD-4) and documentation explaining when to reach for it vs. the other two tiers, for future stories to follow. [epics.md AC3 / AD-4 tier 3]
4. All three dependencies (`@tanstack/react-query`, `nuqs`, `zustand`) are installed **only** in `apps/web/package.json` — no shared workspace package (`packages/ui`, `packages/domain`, etc.) depends on them. [epics.md AC4]
5. The existing `PostHogProvider` (Story 1.8) and `ThemeProvider` (Story 0.3) composition in `apps/web/src/app/layout.tsx` is preserved unchanged — the new providers wrap `{children}` without removing, duplicating, or reordering the existing ones in a way that breaks them.

## Tasks / Subtasks

- [ ] Task 1: Install and wire `@tanstack/react-query` (AC: 1, 4, 5)
  - [ ] Add `@tanstack/react-query` (`^5.101.x`) to `apps/web/package.json` dependencies only.
  - [ ] Create `apps/web/src/components/providers/query-provider.tsx` — a `"use client"` component that creates the `QueryClient` via `useState(() => new QueryClient())` (per-render singleton, not a module-level singleton) so server-rendered requests never share cache state, and renders `<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>`. Mirror the existing `theme-provider.tsx` file/prop-forwarding pattern.
  - [ ] Compose `QueryProvider` in `apps/web/src/app/layout.tsx`, wrapping `{children}` alongside (not replacing) the existing `PostHogProvider` → `ThemeProvider` → `<main>` chain.
- [ ] Task 2: Install and wire `nuqs` (AC: 2, 4, 5)
  - [ ] Add `nuqs` (`^2.8.x`) to `apps/web/package.json` dependencies only.
  - [ ] Import `NuqsAdapter` from `nuqs/adapters/next/app` and wrap it around `{children}` in `apps/web/src/app/layout.tsx`, inside the other providers.
  - [ ] Add a short code comment or `apps/web/src/lib/state/README.md` entry showing a type-safe `useQueryState`/`parseAsStringEnum` usage example (no live feature UI required — Epic 1 search/filter stories are the first real consumers).
- [ ] Task 3: Install and establish the `zustand` pattern (AC: 3, 4)
  - [ ] Add `zustand` (`^5.0.x`) to `apps/web/package.json` dependencies only.
  - [ ] Create `apps/web/src/lib/state/example-ui-store.ts` (or equivalent) as a minimal, interface-driven reference store: a `State` interface, an `Actions` interface, and `create<State & Actions>()(...)`, matching AD-4's "interface-driven with strictly defined states and actions" rule. Keep it clearly marked as a reference/example, not a real feature store.
  - [ ] Document the `useShallow` selector pattern (`zustand/react/shallow`) for selecting multiple fields without extra re-renders, since this is the most common Zustand foot-gun.
- [ ] Task 4: Document the three-tier state decision framework (AC: 3)
  - [ ] Write `apps/web/src/lib/state/README.md` (or extend the one from Task 2/3) explaining AD-4's three tiers — Server State (`react-query`), URL State (`nuqs`), Client Global State (`zustand`) — with a one-line rule of thumb for each and a pointer to the example files, so future story authors/dev agents know which tier a new piece of state belongs to.
- [ ] Task 5: Verify package isolation (AC: 4)
  - [ ] Confirm `@tanstack/react-query`, `nuqs`, and `zustand` appear only in `apps/web/package.json` and nowhere in `packages/*/package.json`.
  - [ ] Run `pnpm install` at the repo root and confirm the lockfile only adds these packages under the `web` workspace entry.
- [ ] Task 6: Manual verification (no automated test runner exists yet — Story 0.10 is still backlog) (AC: 1, 2, 3, 5)
  - [ ] Run `pnpm dev` and confirm the app boots with no console/runtime errors from the new providers.
  - [ ] Run `pnpm build` and confirm it succeeds with the three new dependencies in the graph.
  - [ ] Verify the existing theme toggle (Story 0.3) and PostHog script (Story 1.8, if env vars set) still function unchanged after the new providers wrap them.
  - [ ] Verify (via React DevTools or a temporary console log, removed before commit) that `QueryClientProvider`, `NuqsAdapter`, and the example Zustand store are all reachable/functional from a page component.

## Dev Notes

- **This story is pure frontend plumbing — no backend, database, or queue changes.** Confirmed via `docs/infrastructure/index.md`/`high-level-overview.md` (frontend is Vercel-hosted Next.js; state-management libraries are client-side npm packages, not infrastructure). No shard beyond the index summary was needed.
- **Current root layout state** (`apps/web/src/app/layout.tsx`, read in full before writing this story): already composes `PostHogProvider` (`@festgrid/analytics`, Story 1.8, status: review) around `ThemeProvider` (`next-themes`, Story 0.3, status: done) around a bare `<main>{children}</main>`. **`AppShell` (Story 0.7) is not yet implemented** — Story 0.7 exists as a `ready-for-dev` story file but has not landed, so today's layout still has the bare `<main>`. This story's new `QueryProvider`/`NuqsAdapter` must wrap `{children}` in this existing tree without removing or reordering `PostHogProvider`/`ThemeProvider` (AD-5 forbids re-wiring PostHog per story). When Story 0.7 lands later, `AppShell` will render inside/around this same provider stack — no changes anticipated here, but the dev agent for 0.7 should be aware `QueryProvider`/`NuqsAdapter` will already exist by then if 0.9 ships first, and vice versa.
- **No GraphQL server exists yet** (Story 0.8 "GraphQL server scaffold, Code Generator pipeline, `buildOptimizedDrizzleSelect`" is `backlog`). This story only wires the generic `QueryClientProvider` — it does **not** define any actual query/mutation, since there is no GraphQL schema or `graphql-request` client to call yet. Epic 1 feature stories (once Story 0.8 lands) will be the first to use `useQuery`/`useMutation` with Code-Generator-produced, strictly-typed hooks against this provider, per AD-4 tier 1. Do not fabricate a demo query against a nonexistent backend to "prove" this works — provider mount + no runtime error is sufficient proof at this layer (matches the manual-verification precedent set by Stories 0.3 and 0.7, since Story 0.10's test framework is also still backlog).
- **State categorization (project-context.md rule):** this story *is* the categorization mechanism — Server State → `@tanstack/react-query` + `graphql-request` (future, once 0.8 lands) with Code-Generator types; URL State → `nuqs` with strict TS-typed parsers (e.g. `parseAsStringEnum`); Client Global State → `zustand`, interface-driven, reserved for ephemeral cross-component UI state only (e.g. the future Epic 3/5 manual-post-selection multi-tab state referenced in project-context.md — not built here, just the pattern). Future stories should categorize new state against this same framework rather than defaulting to Zustand for everything.
- **No async-loader design applies to this story.** The Blocking/Non-Blocking loader rule (project-context.md UI Patterns) governs actual data-fetching UI; this story introduces no queries or loading states of its own — that categorization decision belongs to the first feature story that uses `useQuery` against a real endpoint.
- **No reusable `packages/ui` component or `packages/domain` logic is introduced.** The example Zustand store is client-side ephemeral UI state (AD-4 tier 3), not business logic — it does not belong in `packages/domain` (which is React-free, framework-agnostic business logic only, per project-context.md's Code Organization rule). Provider components are single-composition-site wiring, not reusable UI, per the Gate 2 finding below.
- **No cloud/external service is introduced** — no `SETUP_WALKTHROUGH.md` update required.
- **No PostHog events or i18n strings are introduced** — no AD-5 event taxonomy additions, no AD-6 locale keys required.
- Git history check: the 5 most recent commits (`e301498`, `1688b46`, `ff14fa0`, `87edeee`, `4375dd8`) are all BMad skill/planning changes, not application code — no relevant frontend code patterns to extract from recent commits beyond what's already read directly from `layout.tsx`, `theme-provider.tsx`, and `packages/analytics/src/posthog-provider.tsx`.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `epic-0-readiness.md` (`swept: true`, `stories_covered` explicitly includes `0.9`). No gap applicable to this story. The report's two findings (missing outbound-email adapter → Story 0.15, missing Geolocation adapter+cache → Story 0.16) are unrelated to state-management setup.
- **Lightweight escape-hatch guard:** Re-checked this story's specific scope against the sweep — installing three client-side npm libraries (`@tanstack/react-query`, `nuqs`, `zustand`) introduces no new external service, no new data entity, and no new infra dependency the epic-wide sweep wouldn't have anticipated. No fresh Gate 1/3 subagent run needed.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya/UX-designer-persona subagent (required per-story even when the epic sweep is used). Verdict: **No gap found.** The story's AC contains zero UI surface — it is provider/config wiring plus a documented pattern (example store + README), not a component, page, or visual element. The subagent cross-checked `design-artifacts/UX-festgrid-run-1` and `UX-wizard-page-run-1` for any state-management-setup-specific UI detail and found none; it noted the wizard's `useWizardStep()` hook and Wizard Navigation/Summary components are real future Gate-2 candidates, but they belong to Story 3.1 (Onboarding wizard) when that story is created, not to this foundational story.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, GraphQL contract, or TypeScript data-model changes. `QueryClientProvider` is generic (no query/mutation defined yet, since Story 0.8's GraphQL scaffold + Code Generator is still backlog); the example Zustand store and any `nuqs` parser examples are local UI-config types, not data-model types.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required.
- Backward compatibility and rollout notes: N/A — no persisted data or API contract is touched.
- Verification checks: `pnpm build`/`tsc` across `apps/web` passes with the three new dependencies in the workspace graph; manual `pnpm dev` smoke check per Task 6.

### Project Structure Notes

- Alignment with unified project structure: New provider component lives in `apps/web/src/components/providers/` (co-located with the existing `theme-provider.tsx`, following the established pattern). The example store and README live in a new `apps/web/src/lib/state/` directory, since this is app-local ephemeral state, not a shared/reusable package (per AC4's isolation requirement — no `packages/*` involvement).
- Detected conflicts or variances: None. This story does not touch `packages/ui` or `packages/domain`, so the pre-existing Shadcn-in-`apps/web/src/components/ui` variance (flagged in Story 0.7's notes) is out of scope and unaffected here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.9] — story AC source.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, swept:true, covers 0.9.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-4] — Multi-Tiered Strict State Management (binding rule this story implements).
- [Source: _bmad-output/project-context.md#State Management Architecture] — three-tier isolation rule (react-query/nuqs/zustand strictly in `apps/web`).
- [Source: apps/web/src/app/layout.tsx] — current provider composition (PostHog, Theme) to preserve.
- [Source: apps/web/src/components/providers/theme-provider.tsx] — existing provider-wrapper pattern to mirror for `query-provider.tsx`.
- [Source: packages/analytics/src/posthog-provider.tsx] — second precedent for a `"use client"` provider wrapper in this codebase.
- [Source: apps/web/package.json] — confirms current dependency baseline (React 19, Next 15.1.3) that the new libraries must be compatible with.
- [Source: _bmad-output/implementation-artifacts/0-7-build-the-global-app-shell-and-navigation-layout.md] — precedent for manual-testing fallback (Story 0.10 still backlog) and story-file format; confirms Story 0.7/AppShell has not landed yet.
- [Web research, 2026-07-31: npm/GitHub] `@tanstack/react-query` 5.101.x, `nuqs` 2.8.x (Next.js App Router via `nuqs/adapters/next/app`), `zustand` 5.0.x — all confirmed compatible with React 19 / Next.js 15.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — State Management Architecture (three-tier rule), package isolation rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-4) — Multi-Tiered Strict State Management.
- [ ] `docs/infrastructure/index.md` — confirms frontend-only scope, no infra changes.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/src/components/providers/query-provider.tsx`
  - New: `apps/web/src/lib/state/example-ui-store.ts`, `apps/web/src/lib/state/README.md`
  - Modified: `apps/web/package.json` (add `@tanstack/react-query`, `nuqs`, `zustand` as direct dependencies), `apps/web/src/app/layout.tsx` (compose `QueryProvider` and `NuqsAdapter` around existing `{children}`, preserving `PostHogProvider`/`ThemeProvider`).
- **Rule Mapping:**
  - Three-tier state separation (Server/URL/Client-Global) → AD-4 (Architecture Spine) + project-context.md State Management Architecture.
  - Strict `apps/web`-only isolation, no shared workspace package → epics.md AC4 + project-context.md's "state management ... must be isolated strictly within apps/web" rule.
  - Preserve existing provider composition, no re-wiring → AD-5 precedent (same rule pattern applied to provider composition in Story 0.7).
  - Manual verification given no test framework yet → Testing Rules (project-context.md), interim precedent from Stories 0.3/0.7.
- **Verification Plan:**
  - `pnpm build` (root, via turbo) succeeds with the three new dependencies in the graph.
  - `pnpm lint` passes for `apps/web` (via `@festgrid/eslint-config`).
  - `pnpm-lock.yaml` diff confirms the three packages are added only under the `web` workspace entry, not any `packages/*` entry.
  - Manual browser verification per Task 6 (dev server boots clean, existing Theme/PostHog behavior unchanged, providers reachable).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: `QueryClientProvider` wiring, `nuqs` App Router adapter wiring, and a documented/example Zustand store — all isolated to `apps/web` — with no live feature UI, no GraphQL queries (Story 0.8 backlog), and no automated tests (Story 0.10 backlog).
- [ ] Architecture and boundary confirmation: all three new dependencies added only to `apps/web/package.json`; new providers composed in `apps/web/src/app/layout.tsx` alongside existing `PostHogProvider`/`ThemeProvider` without re-wiring them.
- [ ] Testing plan confirmation: manual/browser verification only (Task 6), given no test framework exists yet (Story 0.10 backlog).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` (no gap, `0.9` explicitly covered); Gate 2 run fresh (no gap found).

## Testing Requirements

- [ ] Integration tests: Deferred — no test framework exists yet (Story 0.10 backlog). Backfill an integration test proving `QueryClientProvider`/`NuqsAdapter` mount correctly and the example Zustand store's actions update state as expected, once Vitest + Testing Library (Story 0.10) land.
- [ ] E2E tests: Not applicable at this layer (no user-facing flow exists yet to exercise); the first feature story to actually consume `nuqs`/`react-query` (e.g. Epic 1 search/filter) should cover it end-to-end once Playwright (Story 0.10) is set up.
- [ ] Manual verification (interim, required before marking this story done): `pnpm dev` boots without console/runtime errors, `pnpm build` succeeds, existing Theme/PostHog behavior unaffected, providers/store reachable per Task 6.

## Deliverables Checklist

- [ ] `@tanstack/react-query`, `nuqs`, `zustand` installed only in `apps/web/package.json`.
- [ ] `QueryProvider` (`apps/web/src/components/providers/query-provider.tsx`) composed in `layout.tsx` with per-render `QueryClient` singleton.
- [ ] `NuqsAdapter` (`nuqs/adapters/next/app`) composed in `layout.tsx`.
- [ ] Example, interface-driven Zustand store (`apps/web/src/lib/state/example-ui-store.ts`) with `useShallow` usage documented.
- [ ] Three-tier state decision framework documented in `apps/web/src/lib/state/README.md`.
- [ ] Existing `PostHogProvider`/`ThemeProvider` composition verified unaffected.
- [ ] Manual verification pass completed (Task 6).

## Out of Scope

- Any actual GraphQL query/mutation or `graphql-request` client wiring — depends on Story 0.8 (GraphQL server scaffold + Code Generator), still `backlog`.
- Any real feature use of `nuqs` (e.g. Epic 1 search/filter URL state) or `zustand` (e.g. Epic 3/5 manual-post-selection multi-tab state) — those are built by their respective feature stories using the pattern this story establishes.
- Setting up the automated test framework (Story 0.10) — manual verification only, per Testing Requirements.
- Composing the new providers inside `AppShell` (Story 0.7) — that story has not landed yet; this story wraps the current bare `<main>{children}</main>` tree.

## Definition of Done

- [ ] AC 1-5 satisfied.
- [ ] Manual verification (Task 6 / Testing Requirements) passing; no automated tests exist yet to run, so this substitutes pending the Story 0.10 dependency.
- [ ] Lint and type checks passing for `apps/web` (`pnpm lint`, `pnpm build`).
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
