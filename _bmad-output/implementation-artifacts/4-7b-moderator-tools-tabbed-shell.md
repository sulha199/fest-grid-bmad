---
baseline_commit: 1a14948
---
# Story 4.7b: Moderator Tools tabbed shell

## Story Details

- Epic: 4
- Story ID: 4.7b
- Story Key: 4-7b-moderator-tools-tabbed-shell
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a moderator,
I want Actor Runs and Unprocessed Payloads consolidated into one tabbed "Moderator Tools" page (`/moderator/tools`),
so that I manage scraper operations in one place instead of navigating between two separate pages, matching the two-shell IA `EXPERIENCE.md` now documents (Component Patterns § Account Settings & Moderator Tools Shells).

## Acceptance Criteria

1. **Given** the existing, already-implemented `TabbedShell` primitive (`packages/ui/src/core/tabbed-shell/`, Story 0.29, recently extended with an optional per-tab `keepMounted?: boolean` prop by sibling Story 3.12 — free navigation, no step-gating), **when** this story builds `apps/web/src/app/[locale]/moderator/tools/page.tsx` + `moderator-tools-content.tsx`, **then** it renders `<TabbedShell tabs={[...]} activeKey={tab} onTabChange={setTab} />` with two tabs in this order: **Actor Runs** (`ActorRunsContent`) and **Unprocessed Payloads** (`UnprocessedPayloadsContent`) — the two existing, already-implemented components, imported and rendered exactly as they exist today, no internal changes.
2. **And** the active tab is tracked via `nuqs`'s `useQueryState('tab', parseAsStringEnum(['actor-runs','unprocessed-payloads']).withDefault('actor-runs'))`, owned by `moderator-tools-content.tsx` — matching the exact pattern Story 3.12's `account-settings-content.tsx` established (`NuqsAdapter` already wired at the app root, no new dependency).
3. **And** `page.tsx` follows the exact Server-Component pattern already used identically by `moderator/actor-runs/page.tsx` and `moderator/unprocessed-payloads/page.tsx`: `export const dynamic = 'force-dynamic'`, `generateMetadata({ params })` via `getTranslations({ locale, namespace: 'Metadata' })` + `buildPageMetadata({ title, description })` resolving new `Metadata.moderatorToolsTitle`/`moderatorToolsDescription` keys, default export wraps `<ModeratorToolsContent />` in `<Suspense fallback={<RouteLoader />}>` (`@festgrid/ui`).
4. **And** both `ActorRunsContent` and `UnprocessedPayloadsContent` keep calling `useRequireModerator()` (`apps/web/src/features/auth/use-require-moderator.ts`, Story 4.7a) internally, exactly as they do today — **no new guard logic, no new shared `moderator/layout.tsx` is introduced.** This mirrors the codebase's existing convention (all three moderator pages, including `/moderator/items` which stays separate, already gate individually via this same hook, not a centralized layout) — see Dev Notes for why introducing a shared layout now would be scope creep, not gap-filling.
5. **And** the two former standalone routes — `/moderator/actor-runs` and `/moderator/unprocessed-payloads` — are removed (their `page.tsx`/`*-content.tsx`/test files **moved**, not duplicated, into `apps/web/src/app/[locale]/moderator/tools/`). `/moderator/items` is **not** touched, removed, or absorbed — it stays a fully separate, standalone page (explicit user decision carried from the correct-course proposal, already reflected in `EXPERIENCE.md`).
6. **And** `TabbedShell`'s tabs for this shell do **not** set `keepMounted: true` on either tab — both stay on the default lazy unmount-on-switch behavior. Switching tabs resets each component's local filter/pagination-cursor/expanded-row state and any in-flight mutation's local `isPending` UI reflection (the underlying network call itself is not aborted, only its local UI reflection is lost) — this is an accepted, documented, low-severity tradeoff (see Dev Notes for why this doesn't rise to Story 3.12's `keepMounted`-worthy bar), not a defect to fix in this story.
7. **And** every new user-facing string (the two tab labels, the new page's title/description) is added to both `apps/web/locales/en.json` and `apps/web/locales/id.json` with real Indonesian translations, verified by the existing `locales.test.ts` key-parity check.

## Tasks / Subtasks

- [ ] **Task 1: `apps/web` — build the Moderator Tools shell route** (AC: 1, 2, 3)
  - [ ] Create `apps/web/src/app/[locale]/moderator/tools/page.tsx` mirroring `moderator/actor-runs/page.tsx` exactly (Server Component, `generateMetadata`, `Suspense<RouteLoader>` wrapping `<ModeratorToolsContent />`).
  - [ ] Create `apps/web/src/app/[locale]/moderator/tools/moderator-tools-content.tsx` (`'use client'`): `useQueryState('tab', parseAsStringEnum(['actor-runs','unprocessed-payloads']).withDefault('actor-runs'))`; renders `<TabbedShell tabs={[...]} activeKey={tab} onTabChange={setTab} />` with the two tabs per AC1 — no `keepMounted` on either (AC6); tab `label`s resolved via `useTranslations()` from the new i18n namespace (Task 4).
  - [ ] Create `moderator-tools-content.test.tsx`: renders the shell, asserts both tab triggers are present with correct labels, asserts the default active tab is Actor Runs, asserts clicking the other tab updates the `?tab=` URL param (mock `next/navigation`/`nuqs`, mirroring `account-settings-content.test.tsx`'s convention from Story 3.12).
- [ ] **Task 2: Move and wire `ActorRunsContent`** (AC: 1, 4, 5)
  - [ ] Move `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.tsx` (+ its test file) to `apps/web/src/app/[locale]/moderator/tools/actor-runs-content.tsx`, updating its own internal import paths as needed. Its internal `useRequireModerator()` call and all existing filter/pagination/replay logic stay unchanged.
  - [ ] Delete `apps/web/src/app/[locale]/moderator/actor-runs/` (the old route directory) once the move is confirmed working.
- [ ] **Task 3: Move and wire `UnprocessedPayloadsContent`** (AC: 1, 4, 5)
  - [ ] Move `apps/web/src/app/[locale]/moderator/unprocessed-payloads/unprocessed-payloads-content.tsx` (+ test) to `apps/web/src/app/[locale]/moderator/tools/unprocessed-payloads-content.tsx`, unchanged otherwise.
  - [ ] Delete `apps/web/src/app/[locale]/moderator/unprocessed-payloads/` once confirmed.
- [ ] **Task 4: Stale-link cleanup and User Menu** (AC: none directly — required for the feature to be reachable, per this workflow's "leave the system working end-to-end" rule)
  - [ ] Grep the codebase for any remaining `/moderator/actor-runs` or `/moderator/unprocessed-payloads` link references (nav entries, `Link` components, tests, i18n strings) and update them to `/moderator/tools` (with the appropriate `?tab=` where a specific tab was being linked to).
  - [ ] Update Story 2.8's User Menu registry to point its "Moderator Tools" entry (per `EXPERIENCE.md`'s current registry, item 7) at `/moderator/tools` — this entry did not exist before Story 3.12 added it to the registry doc; confirm whether Story 3.12 already added the registry code entry too (check its Task 8 / File List before duplicating work) and only add here if it's genuinely still missing.
- [ ] **Task 5: i18n** (AC: 7)
  - [ ] Add tab labels (`actorRunsTabLabel`, `unprocessedPayloadsTabLabel`) to an appropriate namespace (or reuse existing `Metadata.actorRunsTitle`/`unprocessedPayloadsTitle`-adjacent strings if a tab-label-specific string doesn't already exist) in `apps/web/locales/en.json`, plus new `Metadata.moderatorToolsTitle`/`moderatorToolsDescription`.
  - [ ] Mirror into `apps/web/locales/id.json` with real Indonesian translations.
  - [ ] Remove now-orphaned `Metadata.actorRunsTitle`/`...Description`, `...unprocessedPayloadsTitle...`/`...Description` keys from both locale files if nothing else references them (grep first — do not remove blindly).
- [ ] **Task 6: Verification** (AC: all)
  - [ ] `pnpm --filter ui test`, `pnpm --filter web test` pass, including all new/moved test files, no regressions.
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root.
  - [ ] Manual smoke check (Completion Notes): navigate `/moderator/tools` as a moderator, confirm both tabs render and switch correctly, confirm `/moderator/actor-runs`/`/moderator/unprocessed-payloads` both 404, confirm `/moderator/items` is untouched and still works, confirm a non-moderator is redirected to `/` and an unauthenticated user to `/login` when visiting `/moderator/tools`.

## Dev Notes

- **Why no shared `moderator/layout.tsx` is introduced (AC4).** There is no such layout today — `useRequireModerator()` is a client-side hook, called individually inside each of the three moderator content components (`ActorRunsContent`, `UnprocessedPayloadsContent`, and `ModeratorItemsContent`, which stays separate). Introducing a centralized layout now, just because two of the three are becoming tab panels, would be inventing a *new* cross-cutting pattern the architecture never asked for — confirmed via a fresh Gate 3 pass (below) as scope creep, not gap-filling. Both absorbed components keep calling the hook exactly as they do today; the guard "reuses Story 4.7a's route guard as-is," per the correct-course proposal's own wording.
- **Why `keepMounted` is deliberately NOT used here (AC6), unlike sibling Story 3.12.** 3.12's `TabbedShell.keepMounted` prop exists to fix two *correctness*-adjacent hazards: `NotificationsContent`'s FCM-registration effect could re-fire an external side-effecting call (`registerFcmToken`) on every remount. Nothing analogous exists here — `ActorRunsContent`/`UnprocessedPayloadsContent` have no polling interval, no "already-registered/already-fetched-once" guard, no external side-effect-on-mount beyond a normal react-query fetch (confirmed via direct inspection during this story's creation). The only state lost on remount is local UI state (filter selections, pagination cursor, expanded rows, a mutation's local `isPending` reflection — the network call itself isn't aborted, only its UI reflection resets). This is a UX annoyance, not a hazard class, and doesn't warrant the same `AskUserQuestion` treatment 3.12's decision needed (confirmed via a fresh Gate 3 pass, below) — documented here as an accepted, deliberate tradeoff instead.
- **`/moderator/items` is untouched.** Not moved, not modified, not linked from this shell — it remains reachable exactly as today, per the correct-course proposal's explicit "stays a separate, standalone page" decision (already reflected in `EXPERIENCE.md`'s Information Architecture).
- **Package boundary:** this story is `apps/web`-only. No `packages/ui` change (unlike sibling Story 3.12, which extended `TabbedShell` itself) — this story only *consumes* `TabbedShell`'s existing `tabs`/`activeKey`/`onTabChange` contract, it does not need the `keepMounted` field. No `packages/domain` involvement — zero new business logic.
- **State-management categorization** (per `project-context.md`'s State Management Architecture rule): the shell's active-tab state is **URL State** (`nuqs`, AC2), identical categorization and pattern to Story 3.12's `?tab=` param.
- **Task ordering note for the dev agent:** Story 3.12 (Account Settings shell) may land before or after this story — check its actual `File List`/Completion Status before assuming its User Menu registry change (Task 4 above) is or isn't already done, rather than guessing from this story's own creation-time snapshot.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh via a Winston-persona pass**, since `epic-4-readiness.md`'s swept coverage (if any) predates this story. **Verdict: No gap.** No direct DB/ORM/domain-package call from `apps/web`, no external service called directly from frontend, no new resolver/query/mutation, no new auth/authorization logic invented (reuses Story 4.7a's already-shipped, already-reused `useRequireModerator()` unchanged), no new infra dependency. Pure `apps/web` + `packages/ui` recomposition of two fully-built components under an already-built primitive.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a Freya-persona pass.** **Verdict: No further split.** Directly confirmed against `EXPERIENCE.md`'s Component Patterns § Account Settings & Moderator Tools Shells (Shell B subsection) — this story's scope matches that authoritative UX doc line for line: two flat tabs, no nesting (unlike sibling Story 3.12's Posts-tab nesting), no new component tokens beyond what `TabbedShell` already ships with, guard reused as-is, `/moderator/items` explicitly excluded as a third tab.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh, same reason as Gate 1.** **Verdict: No gap.** Preserving the existing per-component `useRequireModerator()` pattern (rather than introducing a new shared layout) is the correct minimal-scope choice — the hook was already deliberately built and positioned as reusable by Story 4.7a for exactly this kind of future moderator-gated page, and the project's own precedent across all three moderator pages is per-component gating, not a centralized layout. On the state-loss tradeoff: confirmed genuinely lower-stakes than Story 3.12's Notifications hazard — local, idempotent UI state only, no duplicate-external-call or data-integrity risk on remount — so documenting it as an accepted tradeoff (this Dev Notes section) is sufficient; it does not need the same explicit `AskUserQuestion` ceremony.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story introduces no database schema change, no migration, and no new GraphQL contract — both absorbed components reuse their existing react-query hooks unchanged.
- **Impacted fields/contracts:** None. No new or modified TypeScript type — this story consumes `TabbedShell`'s existing `TabbedShellTab`/`TabbedShellProps` contract (including the `keepMounted` field Story 3.12 added) without needing to set `keepMounted`.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None.
- **Backward compatibility and rollout notes:** The two moved content components keep their exact existing internal logic (data fetching, mutations, local state, the `useRequireModerator()` guard) — only their file location and render call site change. The two old routes 404 after this story lands (no redirect layer is requested or built, matching Story 3.12's identical decision for its own four deleted routes).
- **Verification checks:** `moderator-tools-content.test.tsx` (tab rendering, URL param wiring); each moved component's existing test suite, relocated and still passing unchanged; a manual auth-guard smoke check (Task 6) since the guard's redirect behavior has no existing automated test to extend.

### Project Structure Notes

- **New:** `apps/web/src/app/[locale]/moderator/tools/{page.tsx, moderator-tools-content.tsx, moderator-tools-content.test.tsx, actor-runs-content.tsx, actor-runs-content.test.tsx, unprocessed-payloads-content.tsx, unprocessed-payloads-content.test.tsx}` (the two `*-content.tsx` files are **moved**, not newly written).
- **Modified:** User Menu registry file (Task 4, conditional on Story 3.12 not already having done it); `apps/web/locales/{en,id}.json` (Task 5).
- **Deleted:** `apps/web/src/app/[locale]/moderator/{actor-runs,unprocessed-payloads}/` (both directories, entirely).
- **Not modified:** `apps/web/src/app/[locale]/moderator/items/` (stays fully separate); `packages/ui` (no `TabbedShell` change needed — this story only consumes the existing contract); `packages/database`, `apps/backend` (no schema/resolver change); `packages/domain` (no portable business logic introduced).

### References

- [Source: `sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.2] — the authoritative decision record: Shell B's two tabs, reusing Story 4.7a's guard as-is, `/moderator/items` staying separate.
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` Component Patterns § Account Settings & Moderator Tools Shells (Shell B), Information Architecture § `/moderator/tools`] — this story's authoritative UX source, confirmed to match this draft's scope line for line during Gate 2.
- [Source: `_bmad-output/implementation-artifacts/0-29-build-the-reusable-tabbedshell-primitive.md`, `3-12-consolidate-account-settings-into-a-tabbed-shell.md`] — `TabbedShell`'s contract including the `keepMounted` extension (not used by this story, but its absence here is a deliberate, documented choice, not an oversight); the `nuqs`/`?tab=` pattern this story mirrors exactly.
- [Source: `apps/web/src/app/[locale]/moderator/{actor-runs,unprocessed-payloads,items}/*.tsx`, `apps/web/src/features/auth/use-require-moderator.ts`] — read in full (via a research subagent, cross-checked with real tool calls citing `epics.md` lines 2011/2048/2054 for Story 4.7a's original reusability intent) for exact current props/state/guard mechanism before drafting this story's ACs.
- [Source: `_bmad-output/project-context.md#State-Management-Architecture`] — URL State categorization for the `?tab=` param.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions; the Escape Hatch clause this story's documented (not `AskUserQuestion`-decided) state-loss tradeoff relies on.

## Global Rules References

- `_bmad-output/project-context.md` — State Management Architecture (URL State/`nuqs`), Code Organization (this story is `apps/web`-only, no `packages/ui`/`packages/domain` change).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no architecture-spine `AD-*` rule applies directly to this pure-frontend routing-consolidation story; confirmed via Gate 1/3 pass above.
- `docs/infrastructure/index.md` — confirmed no shard update needed; no backend compute, queue, or database resource touched.
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions and the Escape Hatch clause invoked in this story's own creation.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/web/src/app/[locale]/moderator/tools/` (7 files per Project Structure Notes above).
- **Modified:** User Menu registry file (conditional, Task 4); `apps/web/locales/{en,id}.json`.
- **Deleted:** `apps/web/src/app/[locale]/moderator/{actor-runs,unprocessed-payloads}/` (both directories).
- **Not touched:** `apps/web/src/app/[locale]/moderator/items/`, `packages/ui/src/core/tabbed-shell/` (consumed as-is).

### Rule Mapping

- State Management Architecture rule (URL State) → `useQueryState('tab', ...)` (Task 1, AC2).
- i18n rule (no hardcoded strings, locale parity) → new namespace entries in both `en.json`/`id.json` (Task 5), verified by `locales.test.ts`.
- "Leave the system working end-to-end" rule → Task 4 (stale-link grep, User Menu wiring) — without this, the feature would be built but unreachable/leave dead links.
- Testing Rules (testing-trophy for `apps/web`) → integration tests per moved/new component (Tasks 1-3, 6).

### Verification Plan

- `pnpm --filter web test` — new/moved component tests pass, `locales.test.ts` still passes.
- `pnpm build && pnpm lint` clean at the repo root.
- Manual smoke check per Task 6, including the auth-guard redirect paths (no automated test covers this — a real gap in existing coverage this story inherits, not introduces; not fixed here since it's pre-existing to the moved components).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the `/moderator/tools` tabbed shell, moves two existing components into it unchanged, removes their two old routes. `/moderator/items` stays untouched.
- [ ] Architecture and boundary confirmation: `apps/web`-only, no `packages/ui`/`packages/domain` change, guard stays per-component (`useRequireModerator()`) with no new shared layout — confirmed, not left to implementer discretion.
- [ ] Testing plan confirmation: new/moved component tests per Tasks 1-3, 6.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 — no gap. Gate 2 — no further split, confirmed against `EXPERIENCE.md`'s authoritative Shell B description. Gate 3 — no gap; per-component guard pattern confirmed correct to preserve; state-loss tradeoff confirmed lower-stakes than 3.12's, documented rather than `AskUserQuestion`-decided.

## Testing Requirements

- [ ] Integration: `moderator-tools-content.test.tsx` (tab rendering/labels, default active tab, `?tab=` URL wiring on click).
- [ ] Integration: each moved component's existing test suite (`actor-runs-content.test.tsx`, `unprocessed-payloads-content.test.tsx`) relocated and passing unchanged.
- [ ] E2E: not required as a new dedicated flow — this is a consolidation of already-tested existing pages, not new business logic; the manual smoke check (Task 6) covers the one genuinely new user flow (navigating between tabs) plus the auth-guard redirect paths.

## Deliverables Checklist

- [ ] `/moderator/tools` route rendering both tabs correctly.
- [ ] `/moderator/actor-runs`, `/moderator/unprocessed-payloads` both removed (404).
- [ ] `/moderator/items` untouched, still works standalone.
- [ ] Auth guard (`useRequireModerator()`) still functions correctly for both tabs (unauthenticated → `/login`, unauthorized → `/`).
- [ ] User Menu's Moderator Tools entry points at `/moderator/tools` (confirmed not duplicating Story 3.12's work if already done there).
- [ ] i18n complete, locale-parity test passing.
- [ ] All new/modified/moved files pass `pnpm build`/`pnpm lint`/`pnpm test` at the repo root.

## Out of Scope

- Any change to `/moderator/items` — stays fully separate.
- A shared `moderator/layout.tsx` guard — deliberately not introduced (Dev Notes).
- Fixing the local filter/pagination/expanded-row state loss on tab switch — accepted, documented tradeoff, not fixed (AC6, Dev Notes).
- Adding redirects from the two deleted routes to `/moderator/tools` — not requested, matches Story 3.12's identical decision.
- Any redesign of the two absorbed components' own internal UI/logic — this is a pure consolidation.

## Definition of Done

- [ ] AC1-AC7 satisfied.
- [ ] All tests listed under Testing Requirements passing, no regression in existing `apps/web` suites (including `locales.test.ts`).
- [ ] Lint and type checks passing for `apps/web`.
- [ ] `pnpm build` succeeds at the repo root.

## Completion Status

ready-for-dev

**2026-08-25 (`bmad-create-story`):** Ultimate context engine analysis completed. Unlike sibling Story 3.12, no `AskUserQuestion` was needed — the one candidate tradeoff (tab-switch state loss) was confirmed via a fresh Gate 3 pass to be genuinely lower-stakes than 3.12's Notifications hazard (local UI state only, no external-call-duplication risk), so it's documented as an accepted tradeoff rather than escalated. `EXPERIENCE.md`'s Shell B description (already rewritten alongside Shell A in the same prior session pass) was confirmed to match this story's scope exactly during Gate 2.

## Dev Agent Record

### Agent Model Used
-

### Debug Log References
-

### Completion Notes List
-

### File List
-
