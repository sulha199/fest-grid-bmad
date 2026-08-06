---
baseline_commit: 8a1633510f3837c52563b52234aff754a11c6238
---

# Story 0.18: Build the reusable Soft-Delete-with-Undo UI primitive

## Story Details

- Epic: 0
- Story ID: 0.18
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, generic UI primitive implementing `EXPERIENCE.md`'s "Soft Delete with Undo" state pattern (greyed-out/pending item, a toast with a timed "Undo" action, immediate commit-at-trigger with undo-reverses-the-commit semantics — **revised 2026-08-06, was deferred commit-on-navigate-away; see AC4's revision note**),
so that any feature that lets a user reversibly remove/unfavorite/delete an item from a list (Favorites, Saved Locations, API Keys, Subscriptions) can reuse one consistent, tested mechanism instead of each feature story re-implementing the same commit/undo plumbing and introducing its own toast handling ad hoc.

## Acceptance Criteria

1. **Given** `EXPERIENCE.md`'s "Soft Delete with Undo" State Pattern (Initial State → Trigger → Intermediate State → Undo Action → Final State/Commit), **when** a consuming feature marks an item as "pending removal" via this primitive (`useSoftDeleteWithUndo`, `packages/ui/src/hooks/`), **then** the hook exposes a pending-state accessor (`isPending(id)`) and the full set of pending ids (`pendingIds`) per item so the consumer applies its own visual treatment (greyed-out card, strikethrough table row, etc.) — the primitive does not dictate item markup, since consumers render different shapes (event cards, table rows, list rows). [epics.md AC1-3]
2. **And** marking an item pending (`markPending(id, undo, labels?)`) surfaces a toast notification via a newly-introduced toast library, `sonner` (v2.0.7 — none exists in the codebase today; confirmed absent from every `package.json`), with an "Undo" action, auto-dismissing after `{components.notification.undo_duration_ms}` (6000ms). [epics.md AC4] **[REVISED 2026-08-06]**
3. **And** clicking "Undo" — in the toast's action button, or an equivalent in-row control the consumer renders and wires to the hook's `undo(id)` — invokes the consumer-supplied async `undo: () => Promise<void>` callback and, on success, reverts the item to its normal state. [epics.md AC5] **[REVISED]**
4. **And** if the toast's open window elapses without "Undo" being clicked, the primitive invokes a consumer-supplied `onExpire: (id: TId) => void` callback exactly once and clears the pending state — the primitive itself still has no knowledge of GraphQL/mutations; the consumer decides what "expired" means for its own list (e.g. splicing the item out of a locally-held cache). [epics.md AC6] **[REVISED]**

    **[REVISED 2026-08-06 — Sprint Change Proposal, `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md`]** ACs 2-4 above supersede the primitive's original commit-on-unmount design. **Why:** the original design deferred the backend delete call until component unmount (page navigation), specifically so "Undo" could simply cancel a not-yet-fired call. This broke silently if the user closed the browser tab instead of navigating within the app — unmount never fired, so a delete the user believed had happened was never actually committed. The revised `EXPERIENCE.md` "Soft Delete with Undo" pattern (also revised 2026-08-06) now requires the consumer to commit the delete **immediately**, before or alongside calling `markPending` (per AD-8 rule 4's `action: SoftDeleteAction!` mutation contract) — the hook's job changed from "hold a pending commit and fire it on unmount" to "hold a pending *reversal* (`undo`) and fire it on click, or notify the consumer (`onExpire`) if the window lapses unused." The unmount-triggered commit is **removed entirely** — there is nothing left to commit at unmount time, since the commit already happened at `markPending` time.
5. **And** the primitive is exposed as `useSoftDeleteWithUndo` (`packages/ui/src/hooks/`) plus its toast-wiring component, `SoftDeleteToaster` (`packages/ui/src/core/`), reusable across features with no feature-specific coupling. [epics.md AC7]
6. **And** it has its own integration test suite (Vitest) covering: mark-pending → visual/toast state, Undo calls `undo` and reverts pending state, an elapsed window with no Undo calls `onExpire` exactly once and clears pending state (fake timers), multiple concurrent pending items are tracked independently (including independent per-item expiry). [epics.md AC8] **[REVISED 2026-08-06 — was "unmount commits all still-pending items exactly once"; see AC4's revision note]**
7. **Given** `DESIGN.md`'s existing `notification` style tokens (`fixed bottom-5 right-5 w-full max-w-sm rounded-lg shadow-lg`, `info`/`success`/`error` color mapping — lines 61-71), **when** `SoftDeleteToaster` renders sonner's `<Toaster/>`, **then** it is themed/configured (position, corner radius, shadow, and info/success/error color mapping) to match those existing design-system tokens rather than shipping with sonner's unstyled defaults — this is the first toast infrastructure in the codebase, and other future features are expected to reuse the same visual convention rather than each improvising its own toast look. [Derived — Gate 2 finding, absorbed into this story, see Dev Notes → Architecture & UX Gate Findings]
8. **Given** no feature story yet consumes this primitive for real (Story 2.2, "View favorited events," is `ready-for-dev` and explicitly depends on this story), **when** this story ships, **then** the hook/component are proven end-to-end via their own integration test suite (AC6) plus a manual smoke check in a throwaway harness page — this story does not depend on a live feature integration to be verifiable, mirroring the "reserved slot, not implemented" pattern of Stories 0.7/0.8/0.9/0.12/0.13/0.15/0.16/0.17. [Derived]

## Tasks / Subtasks

- [x] Task 1: Add `sonner` as a `packages/ui` dependency (AC: 2, 5, 7)
  - [x] Add `sonner` (`^2.0.7`, checked 2026-08-03 — confirmed React 19 peer-dependency support via its published `peerDependencies: { react: '^18.0.0 || ^19.0.0 || ^19.0.0-rc', 'react-dom': '^18.0.0 || ^19.0.0 || ^19.0.0-rc' }` — see Dev Notes "Latest Tech Information") to `packages/ui/package.json` `dependencies` (mirrors the existing `lucide-react`/`react`/`react-dom` direct-dependency pattern already in that file — do not add it as a peerDependency; `sonner` is an implementation detail of this primitive, not something every `packages/ui` consumer must separately install, unlike `nuqs` which genuinely is a peer dependency for a different reason).
  - [x] Confirm no existing `sonner`/`Toaster`/toast reference exists anywhere in the repo before adding (already confirmed clean during story creation via `Grep` across every `package.json` — re-verify at implementation time in case of drift).
- [x] Task 2: Build the `useSoftDeleteWithUndo` hook (AC: 1, 2, 3, 4)
  - [x] Create `packages/ui/src/hooks/useSoftDeleteWithUndo.types.ts` exporting:
    - `SoftDeleteToastLabels = { message?: string; undoLabel?: string }` — per-call override; hook-internal defaults are `message: 'Item removed'`, `undoLabel: 'Undo'` (English fallback strings, same pattern as `BlockingLoaderProps.labels` in `packages/ui/src/core/blocking-loader.tsx` — see Dev Notes for why `packages/ui` ships English defaults rather than next-intl keys).
    - `UseSoftDeleteWithUndoOptions = { defaultLabels?: SoftDeleteToastLabels }` (optional, hook-instance-level fallback layered under the built-in English defaults and above any per-call `labels` passed to `markPending`).
    - `UseSoftDeleteWithUndoResult<TId extends string = string> = { isPending: (id: TId) => boolean; pendingIds: ReadonlySet<TId>; markPending: (id: TId, commit: () => Promise<void>, labels?: SoftDeleteToastLabels) => void; undo: (id: TId) => void }`.
  - [x] Create `packages/ui/src/hooks/useSoftDeleteWithUndo.ts` (`"use client"`, mirroring `useInfiniteScroll.ts`/`useContextAwareListNavigation.ts`'s directive convention) exporting `useSoftDeleteWithUndo<TId extends string = string>(options?: UseSoftDeleteWithUndoOptions): UseSoftDeleteWithUndoResult<TId>`:
    - Internal state: a single `Map<TId, () => Promise<void>>` of pending id → commit callback, held in `useState` so `isPending`/`pendingIds` re-render consumers correctly; also a `Map<TId, string | number>` ref tracking the active sonner toast id per pending item (sonner's `toast()` call returns an id usable with `toast.dismiss(id)`), so `undo()` can dismiss the in-flight toast, not just cancel the commit.
    - A `useRef` mirror of the pending map, kept in sync via a `useEffect` on the state map, so the **unmount cleanup** (a `useEffect(() => () => { ... }, [])` with no dependencies, registered once) reads the *latest* pending contents via the ref rather than a stale closure over the initial empty state — same stale-closure-avoidance pattern already used by `useInfiniteScroll.ts`'s `fetchNextPageRef`/`isFetchingNextPageRef` and `useContextAwareListNavigation.ts`'s `itemsRef`.
    - `markPending(id, commit, labels)`: adds `(id → commit)` to the map; calls sonner's `toast(labels?.message ?? defaultLabels?.message ?? 'Item removed', { action: { label: labels?.undoLabel ?? defaultLabels?.undoLabel ?? 'Undo', onClick: () => undo(id) } })`, storing the returned toast id in the toast-id ref keyed by `id`. Calling `markPending` again for an `id` already pending replaces its commit callback and labels and re-shows a toast (does not throw or silently ignore — last call wins, matching how a consumer would re-trigger a delete after an edit).
    - `undo(id)`: if `id` is not in the pending map, no-op. Otherwise removes it from the pending map (triggering a re-render so `isPending(id)` flips false), calls `toast.dismiss(activeToastId)` if one is tracked for that id, and clears the toast-id ref entry. Never calls the stored `commit` callback.
    - Unmount cleanup: iterates the ref's current entries (not the React-state map, to avoid a stale closure) and calls each stored `commit()` exactly once, allowing rejections to propagate as unhandled — the hook does not swallow or retry commit errors; a consumer whose commit can fail is responsible for its own retry/error-surfacing strategy at the mutation layer (this primitive's own contract is "invoke exactly once," not "guarantee success").
    - `isPending`/`pendingIds` are derived directly from the current state map on every render (no extra effect needed).
  - [x] Create `packages/ui/src/hooks/useSoftDeleteWithUndo.test.ts` (Vitest + `@testing-library/react`'s `renderHook`/`act`, `vi.mock('sonner', ...)` to stub `toast`/`toast.dismiss` — mirrors `useInfiniteScroll.test.ts`'s `vi.stubGlobal` pattern for mocking an external API surface) covering AC6 exactly: mark-pending flips `isPending`/`pendingIds` and calls the mocked `toast` with the expected message/action; `undo` flips `isPending` back to false, calls `toast.dismiss`, and the commit function is **never** called; unmounting the hook (`renderHook`'s returned `unmount()`) with one or more still-pending items calls each pending item's commit function exactly once (assert call count, not just "was called"); multiple concurrent pending items (≥3 different ids) are tracked independently — undoing one does not affect the others' pending state, and unmount commits only the ones never undone.
- [x] Task 3: Build the `SoftDeleteToaster` component, themed to `DESIGN.md`'s notification tokens (AC: 2, 5, 7)
  - [x] Create `packages/ui/src/core/soft-delete-toaster.tsx` (no `"use client"` needed at the file level beyond what `sonner`'s own `<Toaster/>` requires internally — mirror whatever directive `sonner`'s own docs/types require; confirm at implementation time) exporting `SoftDeleteToaster(props: SoftDeleteToasterProps)` — a thin wrapper around sonner's `<Toaster/>` with fixed, non-overridable-by-default configuration matching `DESIGN.md` lines 61-71: `position="bottom-right"` (matches `fixed bottom-5 right-5`), and `toastOptions.classNames`/`style` set to apply `rounded-lg shadow-lg` on the toast surface plus the `info`/`success`/`error` background/text color pairs (`bg-violet-100 text-violet-800` / `bg-green-100 text-green-800` / `bg-red-100 text-red-800`) via sonner's documented `toastOptions.classNames` per-type keys (confirm exact sonner v2 API for per-type class overrides at implementation time — sonner's theming API has changed across major versions; do not assume v1-era prop names). This component takes no required props; an optional passthrough `className`/`style` prop may be added only if needed to satisfy a real consumer later — do not over-engineer a generic theming API now.
  - [x] Create `packages/ui/src/core/soft-delete-toaster.types.ts` if the component ends up with any props beyond zero-config (keep minimal — likely just `{ className?: string }` or empty).
  - [x] Create `packages/ui/src/core/soft-delete-toaster.test.tsx` (Vitest + Testing Library) proving: the component renders sonner's `Toaster` (assert via a mocked `sonner` module that the expected `position`/theming props are passed through), and that triggering `useSoftDeleteWithUndo`'s `markPending` in a small test harness component wrapped by `<SoftDeleteToaster/>` results in the toast content appearing in the DOM (a light integration check, not a full sonner internals test).
- [x] Task 4: Wire exports (AC: 5)
  - [x] Add `export * from './useSoftDeleteWithUndo';` and `export * from './useSoftDeleteWithUndo.types';` to `packages/ui/src/hooks/index.ts` (matches the existing `useInfiniteScroll`/`useContextAwareListNavigation` export-pair pattern).
  - [x] Add `export * from './core/soft-delete-toaster';` to `packages/ui/src/index.ts` (matches the existing `blocking-loader`/`multi-select` entries — note `packages/ui/src/index.ts` already re-exports `./hooks` as a whole barrel, so no separate top-level hook export line is needed there).
- [x] Task 5: Mount `SoftDeleteToaster` once in `apps/web` (AC: 8 — completes the "reserved slot" rather than leaving it for the first consumer)
  - [x] In `apps/web/src/app/[locale]/layout.tsx`, import `SoftDeleteToaster` from `@festgrid/ui` and render it as a sibling to `<AppShell>` inside `<ScopedLocaleProvider>` (i.e. `<ScopedLocaleProvider ...><AppShell>{children}{modal}</AppShell><SoftDeleteToaster /></ScopedLocaleProvider>`) — mirrors how `ScopedLocaleProvider`/`PostHogProvider`/etc. are already composed at this single root layout rather than duplicated per-page. This is a one-line addition to an existing file; no new provider component, no new file.
- [x] Task 6: Verification (AC: 1-8)
  - [x] `pnpm --filter ui run test` (Vitest) passes, including the two new test files from Tasks 2 and 3, with no regression in existing `packages/ui` tests (`useInfiniteScroll.test.ts`, `useContextAwareListNavigation.test.ts`, `blocking-loader.test.tsx`, `multi-select.test.tsx`, `useScopedLocale.test.tsx`).
  - [x] Run `pnpm build` and `pnpm lint` at the repo root and confirm both are clean, including `apps/web`'s one-line `layout.tsx` change.
  - [x] Manual smoke check (Completion Notes): render a small throwaway page/harness using `useSoftDeleteWithUndo` + `SoftDeleteToaster` (either a temporary dev-only route removed before commit, or Storybook/dev-server manual check if available — record whichever approach was used) confirming visually: mark-pending shows a themed toast in the bottom-right with an "Undo" button, clicking Undo removes the toast and does not call commit, and navigating away/unmounting the harness fires the commit for anything left pending. Remove any throwaway harness code before marking this story done unless it's a legitimate addition to an existing dev-only sandbox.

## Dev Notes

- **This story is pure infrastructure/UI plumbing — no product feature ships, and no real feature currently calls `useSoftDeleteWithUndo` for real.** Story 2.2 ("View favorited events," `ready-for-dev`) is the first real consumer, already written and explicitly blocked on this story (`_bmad-output/implementation-artifacts/2-2-view-favorited-events.md` Task 6 and its Pre-Coding Approval Gate: "Story 0.18 (Soft-Delete-with-Undo primitive) must exist before Task 6 ... can complete"). This mirrors the "reserved slot, not implemented" pattern already established by Stories 0.7, 0.8, 0.9, 0.12, 0.13, 0.15, 0.16, and 0.17.
- **Why the hook is fully generic/headless, with no GraphQL/mutation knowledge:** Per epics.md's own AC framing, the primitive must be reusable across Favorites, Saved Locations, API Keys, and Subscriptions — four features with entirely different mutations and item shapes. Baking any domain concept into the hook would immediately make it single-feature-coupled, defeating the point of splitting it into Epic 0. The `commit: () => Promise<void>` callback is the entire contract; the consumer owns what "commit" means (a GraphQL mutation via a generated hook, per Story 2.2's Task 6 example).
- **Why toast copy is prop-driven with English fallback defaults, not next-intl keys inside `packages/ui`:** `project-context.md`'s "Scoped locale/timezone context" rule establishes the precedent that `packages/ui` components needing locale-aware behavior use a decoupled hook (`useScopedLocale`), never a direct `next-intl` dependency — the same Adapter/decoupling principle applies here to *copy*, not just formatting. `BlockingLoader` (`packages/ui/src/core/blocking-loader.tsx`) already establishes the exact pattern this story follows: a `labels` prop with an English `fallbackLabel` default, letting the consuming `apps/web` page supply real `useTranslations()`-sourced strings. `useSoftDeleteWithUndo`'s `markPending(id, commit, labels?)` third parameter follows this identically. Story 0.17 reached the same "no i18n strings" conclusion for backend-only code; this story reaches the analogous "no *direct* i18n dependency" conclusion for a framework-agnostic UI primitive, per AD-6 scoping — see also i18n callout below.
- **Why `sonner` and not another toast library:** No toast library exists anywhere in the codebase (confirmed via `Grep` across every `package.json` during story creation). `sonner` (`^2.0.7`, checked 2026-08-03) is a widely-used, actively maintained, dependency-light React toast library with first-class React 19 support (published `peerDependencies` accept `^19.0.0`) and a simple imperative `toast()` API that doesn't require React Context — meaning `markPending`/`undo` can call it directly from the hook without needing consumers to wrap their tree in an extra Provider beyond mounting `<SoftDeleteToaster/>` once (Task 5). This was epics.md's own suggested choice ("introducing a toast library, e.g. `sonner`").
- **Why the toast auto-dismiss timeout never triggers a commit:** `EXPERIENCE.md` lines 69-81 are explicit that the "Final State (Commit)" happens "when the user navigates away from the current page" — not when the toast itself disappears (sonner toasts auto-dismiss after a default duration regardless of user action). If the hook committed on toast-dismiss, a user who ignores the toast but stays on the page would have their item silently committed while still looking at the (by-then-toast-less but still greyed-out) item — contradicting the "commit only on navigate-away" contract. The hook's only commit trigger is its own unmount effect (Task 2).
- **`packages/domain` reusable-mechanism check:** Evaluated and found not applicable. All of this story's logic is either React-state-coupled (the pending `Map`, the unmount effect) or `sonner`-API-coupled (`toast()`/`toast.dismiss()`) — neither is "framework-agnostic business logic" per `project-context.md`'s Code Organization rule (which additionally forbids any React code in `packages/domain` outright — this story's hook is 100% React). **No `packages/domain` change in this story.**
- **Package dependency isolation (`project-context.md`):** `sonner` is added to `packages/ui` only. No change to `apps/web`'s own `package.json` (it consumes `SoftDeleteToaster`/`useSoftDeleteWithUndo` transitively through the existing `@festgrid/ui` workspace dependency it already has) — only `apps/web/src/app/[locale]/layout.tsx` (a one-line render addition, Task 5) is touched outside `packages/ui`. No `zod`/`ajv`/`firebase`/state-management package touched.
- **State-management categorization:** The hook's internal pending-item tracking is local component/hook state (`useState`, scoped to wherever `useSoftDeleteWithUndo` is called) — not Server State, URL State, or Client Global State per `project-context.md`'s three-scope rule, since it holds no server data, no shareable URL parameters, and is not a cross-component-boundary global (each call site gets its own independent instance, matching `useInfiniteScroll`/`useContextAwareListNavigation`'s existing precedent of being local, not Zustand-backed, hooks). **No Zustand store added.**
- **Async loader categorization:** Not applicable — this story introduces no page-level async loading state; the toast itself is sonner's own transient UI, not a blocking/non-blocking loader per `project-context.md`'s Loaders rule.
- **PostHog/analytics (AD-5):** Not applicable to this primitive itself — it has no knowledge of *what* is being soft-deleted, so it cannot emit a meaningful domain event (e.g. "event_unfavorited"). Any analytics event belongs to the consuming feature (e.g. Story 2.2 would emit its own event when wiring `markPending`'s commit callback), not this generic hook. No PostHog call in this story's code.
- **Latest Tech Information:** `sonner` latest stable is `2.0.7` (npm, checked 2026-08-03), with published `peerDependencies` of `react: '^18.0.0 || ^19.0.0 || ^19.0.0-rc'` and `react-dom` matching — confirmed compatible with this monorepo's React 19. Sonner v2's theming/per-type class override API should be re-confirmed against its current docs at implementation time (Task 3) since its theming surface has changed across major versions and this story's Dev Notes should not be treated as a substitute for reading the installed version's actual type definitions.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** `epic-0-readiness.md` (`swept: true`) has a `stories_covered` list that stops at `0.14` — it predates Stories 0.15-0.18 and never analyzed this story, the same situation Story 0.17 encountered. Per `story-split-gate.md`'s escape-hatch guidance, a **fresh** Gate 1/Gate 3 subagent pass (persona Winston) was run against this story's own draft scope. **Verdict: no gap found in either gate.** This story touches no DB/ORM/domain package, no external/third-party service call (`sonner` is a client-side-only rendering library with zero network calls), introduces no new API surface, and adds no auth/secrets/business-rule logic to the frontend. Mounting `SoftDeleteToaster` into `apps/web/src/app/[locale]/layout.tsx` (Task 5) requires no new provider or plumbing beyond what that file already composes. `DESIGN.md`'s `notification` design tokens (needed for Task 3's theming) already exist. No other `project-context.md`-mandated reusable utility is touched by this story's scope.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya (`wds-agent-freya-ux`), reading `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` and `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md` in full. **Two findings:**
  1. **Absorbed into this story:** `DESIGN.md` (lines 61-71) already defines concrete `notification` style tokens (position, `rounded-lg shadow-lg`, `info`/`success`/`error` color mapping) that predate the `sonner` choice; the original draft scope said nothing about conforming `SoftDeleteToaster` to them, risking every future consumer diverging from the design system by relying on sonner's unstyled defaults. **Action taken:** promoted to AC7 and Task 3 above — `SoftDeleteToaster` must match these existing tokens, not ship unstyled.
  2. **Split into a new story:** `DESIGN.md`'s `UX-DR15` ("On mobile, a swipe gesture on a list item reveals a 'Delete' button") and `EXPERIENCE.md`'s "Swipe-to-delete" interaction primitive are both explicitly named as generic across every list in the app, but no story anywhere in `epics.md` builds this reusable gesture mechanism — it is a distinct concern from this story's pending/undo/commit mechanics (which are deliberately trigger-agnostic: a button click or a swipe reveal both just call `markPending`). **Action taken:** split into new **Story 0.19** ("Build the reusable Swipe-to-Reveal-Action UI primitive"), written as a full section into `epics.md` (after Story 0.18) and added as a `backlog` entry to `sprint-status.yaml`. Story 0.18 does **not** depend on Story 0.19 to ship (the hook works identically whether triggered by a swipe-revealed button or an always-visible one) — this is a forward-referencing split, not a blocking prerequisite, mirroring how Story 0.18 itself was split off Story 2.2 without blocking 2.2's non-Task-6 prep work.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No mismatch found.** This story has no database, GraphQL schema, or `@festgrid/shared-types` involvement whatsoever — it is a pure `packages/ui` React hook/component pair operating entirely on caller-supplied generic ids (`TId extends string`) and caller-supplied callbacks.
- Impacted fields/contracts: None.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required — the new `SoftDeleteToastLabels`/`UseSoftDeleteWithUndoOptions`/`UseSoftDeleteWithUndoResult<TId>` types (Task 2) are net-new, package-local types in `packages/ui`, not modifications to any existing shared contract.
- Backward compatibility and rollout notes: Purely additive — a new hook, a new component, one new dependency (`sonner`) confined to `packages/ui`, and a one-line render addition in `apps/web/src/app/[locale]/layout.tsx`. No existing behavior changes for any current page, since nothing currently renders a toast or uses soft-delete-with-undo semantics.
- Verification checks: `useSoftDeleteWithUndo.test.ts` and `soft-delete-toaster.test.tsx` (Task 2/3); `pnpm build`/`pnpm lint` clean including the `layout.tsx` change (Task 6).

### Project Structure Notes

- New in `packages/ui`: `src/hooks/useSoftDeleteWithUndo.ts`, `src/hooks/useSoftDeleteWithUndo.types.ts`, `src/hooks/useSoftDeleteWithUndo.test.ts`, `src/core/soft-delete-toaster.tsx`, `src/core/soft-delete-toaster.types.ts` (if needed), `src/core/soft-delete-toaster.test.tsx` — follows the app's existing `hooks/`-for-headless-logic and `core/`-for-domain-agnostic-components split already established by `useInfiniteScroll`/`blocking-loader`.
- Modified: `packages/ui/package.json` (new `sonner` dependency), `packages/ui/src/hooks/index.ts`, `packages/ui/src/index.ts` (new export lines); `apps/web/src/app/[locale]/layout.tsx` (one-line `SoftDeleteToaster` mount); `_bmad-output/planning-artifacts/epics.md` (new Story 0.19 section, Gate 2 split); `_bmad-output/implementation-artifacts/sprint-status.yaml` (new `0-19-...` backlog entry).
- Not modified: `packages/domain`, `packages/database`, `packages/shared-types`, `packages/graphql-select`, `apps/backend`, `apps/infrastructure`, `turbo.json`, `.github/workflows/ci.yml`, any `locales/*.json` file (no i18n keys owned by this story — see Dev Notes).
- Detected conflicts or variances: None — `packages/ui`, `apps/web/src/app/[locale]/layout.tsx`, and `epics.md`/`sprint-status.yaml` are all in their expected current states as read during story creation (baseline commit `8a1633510f3837c52563b52234aff754a11c6238`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.18] — canonical AC source and the `Note:` explaining the Gate 3 origin (surfaced while creating Story 2.2) and Epic-0 placement.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.19] — new prerequisite story this story's own Gate 2 pass produced (swipe-to-reveal-action primitive), added during this story's creation.
- [Source: _bmad-output/implementation-artifacts/2-2-view-favorited-events.md] — the first concrete future consumer; its Task 6, Dev Notes ("Architecture & UX Gate Findings"), Out of Scope, and Pre-Coding Approval Gate sections all document its hard dependency on this story and its planned usage of `useSoftDeleteWithUndo`, which this story's API design (Task 2) was shaped to satisfy.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — confirmed `stories_covered` stops at `0.14`, i.e. does not itself analyze Story 0.18, justifying the fresh Gate 1/3 subagent pass performed for this story per `story-split-gate.md`'s escape-hatch guidance (same justification pattern as Story 0.17).
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, numbering rule, epic-level sweep mode and escape hatch.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md, lines 44, 69-81] — "Swipe-to-delete" interaction primitive and the full "Soft Delete with Undo" State Pattern (Initial/Trigger/Intermediate/Undo/Final-Commit-on-navigate-away) this story implements.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, lines 61-71, 137] — `notification` style tokens (AC7/Task 3) and `UX-DR15` (the swipe gesture split into Story 0.19).
- [Source: _bmad-output/project-context.md#Technology-Stack, #UI-Patterns-UX-Invariants, #Code-Quality-Style-Rules, #Testing-Rules] — `packages/ui` component-organization rules, `useScopedLocale`/Adapter decoupling precedent applied to toast copy, `packages/domain` restrictions (evaluated, not applicable), package-dependency-isolation rules, testing-trophy philosophy.
- [Source: packages/ui/src/hooks/useInfiniteScroll.ts, useInfiniteScroll.types.ts, useInfiniteScroll.test.ts] — stale-closure-avoidance (`useRef` mirror) pattern, `"use client"` directive convention, `vi.stubGlobal`-style external-API-mocking test pattern this story's hook/test follow.
- [Source: packages/ui/src/hooks/useContextAwareListNavigation.ts] — second precedent for the ref-mirror-of-state pattern used for unmount-safe cleanup logic.
- [Source: packages/ui/src/core/blocking-loader.tsx, blocking-loader.types.ts] — the `labels`-prop-with-English-fallback-default pattern this story's `markPending(id, commit, labels?)` parameter directly follows.
- [Source: packages/ui/src/index.ts, packages/ui/src/hooks/index.ts, packages/ui/package.json] — confirmed current export-barrel structure and dependency list this story extends.
- [Source: apps/web/src/app/[locale]/layout.tsx] — confirmed current provider-composition structure (`NextIntlClientProvider` → `PostHogProvider` → `ThemeProvider` → `QueryProvider` → `NuqsAdapter` → `AuthSessionProvider` → `ScopedLocaleProvider` → `AppShell`) this story adds `SoftDeleteToaster` alongside.
- [Web research, 2026-08-03] `sonner` latest stable `2.0.7` on npm; `peerDependencies` confirm React 19 support (`^18.0.0 || ^19.0.0 || ^19.0.0-rc`). Source: `npm view sonner version` / `npm view sonner peerDependencies`.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Technology Stack (`packages/ui` component library rules), UI Patterns & UX Invariants, Code Quality (`packages/domain` restrictions, evaluated and not applicable; `packages/ui` core/hooks organization), Testing Rules, package-dependency-isolation rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — reviewed; no architecture-decision (AD) record binds this purely-frontend, no-DB, no-API primitive.
- [ ] `docs/infrastructure/index.md` — reviewed; this is a frontend-only, `packages/ui`-scoped story with no backend compute, queue, EventBridge/cron, API Gateway, or database provisioning involvement, so only the index-level summary was needed (no shard file read required, per the persistent-fact routing rule).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New in `packages/ui`: `src/hooks/useSoftDeleteWithUndo.ts`, `useSoftDeleteWithUndo.types.ts`, `useSoftDeleteWithUndo.test.ts`; `src/core/soft-delete-toaster.tsx`, `soft-delete-toaster.types.ts` (if needed), `soft-delete-toaster.test.tsx`.
  - Modified in `packages/ui`: `package.json` (new `sonner` dependency), `src/hooks/index.ts`, `src/index.ts` (new export lines).
  - Modified: `apps/web/src/app/[locale]/layout.tsx` (one-line `<SoftDeleteToaster/>` mount, Task 5); `_bmad-output/planning-artifacts/epics.md` (new Story 0.19 section); `_bmad-output/implementation-artifacts/sprint-status.yaml` (new `0-19-...` backlog entry).
  - Not modified: `packages/domain`, `packages/database`, `packages/shared-types`, `packages/graphql-select`, `apps/backend`, `apps/infrastructure`, `turbo.json`, `.github/workflows/ci.yml`, any `locales/*.json`.
- **Rule Mapping:**
  - Reusable UI primitive → `project-context.md` UI Components & Scalability rule → `packages/ui/src/core/soft-delete-toaster.tsx` + `src/hooks/useSoftDeleteWithUndo.ts` (AC1-6).
  - `EXPERIENCE.md` "Soft Delete with Undo" state pattern fidelity (commit-on-navigate-away only, never on toast timeout) → Task 2's unmount-only commit trigger (AC4, Dev Notes).
  - `DESIGN.md` `notification` design tokens → `SoftDeleteToaster`'s theming (AC7, Task 3, Gate 2 finding #1).
  - `useScopedLocale`/Adapter decoupling precedent, applied to copy → `labels`-prop-with-English-fallback pattern, no direct `next-intl` dependency in `packages/ui` (AC2, Dev Notes).
  - `packages/domain` reusable-mechanism check → evaluated and found not applicable (all logic is React/`sonner`-coupled) → Dev Notes.
  - Package dependency isolation → `sonner` confined to `packages/ui` only (Dev Notes).
  - Gate 2 UI-complexity split → new Story 0.19 written into `epics.md`/`sprint-status.yaml` for the swipe-to-reveal-action gesture, not absorbed here (Architecture & UX Gate Findings).
  - i18n/analytics/state-management/loader categorization — all evaluated and found not applicable → Dev Notes.
- **Verification Plan:**
  - `packages/ui/src/hooks/useSoftDeleteWithUndo.test.ts`: mark-pending/undo/unmount-commits-once/concurrent-independent-tracking (Task 2/Task 6).
  - `packages/ui/src/core/soft-delete-toaster.test.tsx`: renders themed `Toaster`, toast content appears via a small harness (Task 3/Task 6).
  - `pnpm --filter ui run test` full-suite pass including pre-existing tests (no regression) (Task 6).
  - `pnpm build`/`pnpm lint` clean at the repo root, including the `apps/web/layout.tsx` change (Task 6).
  - Manual smoke check with a throwaway harness page proving the full mark-pending → toast → Undo/unmount-commit loop visually, recorded in Completion Notes (Task 6).

## Pre-Coding Approval Gate

- [x] Scope confirmation: build `useSoftDeleteWithUndo` (`packages/ui/src/hooks/`) and `SoftDeleteToaster` (`packages/ui/src/core/`), themed to `DESIGN.md`'s notification tokens, plus mounting `SoftDeleteToaster` once in `apps/web/src/app/[locale]/layout.tsx`; no feature-specific consumer built here (Story 2.2 is the future first consumer).
- [x] Architecture and boundary confirmation: purely `packages/ui`-scoped (plus a one-line `apps/web` layout mount); no `packages/domain` change (evaluated, no pure-logic slice warrants extraction — all logic is React/`sonner`-coupled); `sonner` confined to `packages/ui` as a direct dependency, not a peer dependency.
- [x] Testing plan confirmation: `useSoftDeleteWithUndo.test.ts` and `soft-delete-toaster.test.tsx` (Vitest, no live backend/network involvement — `sonner` is mocked in the hook test); manual smoke-check harness removed before completion unless it's a legitimate addition to an existing dev sandbox.
- [x] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 run fresh (persona Winston) since `epic-0-readiness.md`'s `stories_covered` stops at 0.14 and does not analyze this story — no gap found. Gate 2 run fresh (persona Freya) — two findings: (a) toast styling absorbed into this story as AC7/Task 3; (b) swipe-to-reveal-action gesture split into new **Story 0.19**, added to `epics.md`/`sprint-status.yaml` as `backlog` — **not a blocker for this story** (the hook is trigger-agnostic), but flagged here for explicit visibility. Confirm proceeding with Story 0.18 now while Story 0.19 remains a separate, independently-schedulable backlog item, or direct otherwise.
- [x] **`sonner` as the chosen toast library accepted:** confirmed via version/peer-dependency check (2026-08-03) that `sonner@^2.0.7` supports React 19; no alternative library evaluation was performed beyond confirming this one satisfies the requirement (no toast library existed previously, so there is no migration/compatibility concern with prior code).

## Testing Requirements

- [x] Unit/integration tests (required, not deferred): `packages/ui/src/hooks/useSoftDeleteWithUndo.test.ts` (Vitest + Testing Library, mocked `sonner`) — mark-pending, Undo-cancels-no-commit, unmount-commits-once-per-pending-item, concurrent-independent-tracking.
- [x] Integration tests (required, not deferred): `packages/ui/src/core/soft-delete-toaster.test.tsx` (Vitest + Testing Library) — themed `Toaster` renders, toast content appears via a small harness component.
- [x] E2E tests: Not applicable — no product feature/page ships in this story (Story 2.2 will own the E2E "happy path" once it consumes this primitive).
- [x] Manual verification (required before marking this story done): throwaway harness smoke check (Task 6) proving the full mark-pending → themed toast → Undo/unmount-commit loop visually; recorded in Completion Notes.
- [x] Manual verification (deferred, tracked): a real end-to-end check with an actual `EventCard`/favorites consumer, once Story 2.2 is built and wires this primitive for real.

## Deliverables Checklist

- [x] `packages/ui/src/hooks/useSoftDeleteWithUndo.ts` (+ `.types.ts`, `.test.ts`) implementing mark-pending/undo/unmount-commit-once semantics, exported from `packages/ui/src/hooks/index.ts`.
- [x] `packages/ui/src/core/soft-delete-toaster.tsx` (+ types/test as needed) wrapping a `DESIGN.md`-token-themed `sonner` `<Toaster/>`, exported from `packages/ui/src/index.ts`.
- [x] `sonner` added to `packages/ui/package.json` dependencies only.
- [x] `<SoftDeleteToaster/>` mounted once in `apps/web/src/app/[locale]/layout.tsx`.
- [x] New Story 0.19 ("Build the reusable Swipe-to-Reveal-Action UI primitive") written into `epics.md` and added as a `backlog` entry in `sprint-status.yaml` (Gate 2 split — already completed during story creation).
- [x] `pnpm --filter ui run test`, `pnpm build`, `pnpm lint` all pass at the repo root.

## Out of Scope

- Any real feature consumer of `useSoftDeleteWithUndo`/`SoftDeleteToaster` — Story 2.2 ("View favorited events," `ready-for-dev`) is the first, and Stories 2.3/2.4 (saved locations) and future API-key/subscription-management stories (Epic 3/4) are anticipated future consumers, per this story's own `Note:` in `epics.md`.
- **Story 0.19** ("Build the reusable Swipe-to-Reveal-Action UI primitive") — the mobile swipe-gesture mechanism (`UX-DR15`) that would trigger this primitive on touch devices. Split out via this story's own Gate 2 finding; not a blocking dependency of this story (the hook is trigger-agnostic), tracked as its own new Epic 0 backlog item.
- Any next-intl-sourced/translated toast copy — this story ships English-fallback `labels` props only; real translated strings are each consuming feature's own responsibility (mirrors `BlockingLoader`'s existing precedent).
- Any PostHog/analytics event tied to a soft-delete/undo action — this generic primitive has no domain knowledge to emit a meaningful event; each consuming feature owns its own analytics instrumentation.
- A persistent/queryable "recently undone" or "recently committed" history — the primitive's state is entirely ephemeral, scoped to the lifetime of the hook instance (i.e. the mounted component/page).
- Any change to `packages/domain`, `packages/database`, `apps/backend`, or any GraphQL schema/resolver — this story has zero backend surface.

## Definition of Done

- [x] AC 1-8 satisfied.
- [x] `packages/ui/src/hooks/useSoftDeleteWithUndo.test.ts` and `packages/ui/src/core/soft-delete-toaster.test.tsx` passing (Testing Requirements — non-negotiable).
- [x] `pnpm --filter ui run test` full-suite passing with no regressions.
- [x] `pnpm lint` and `pnpm build` passing at the repo root, including `packages/ui` and `apps/web`.
- [x] `epics.md` and `sprint-status.yaml` updated with the new Story 0.19 entry (Gate 2 split — already done during story creation, confirm still present).
- [x] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the `sonner`-as-toast-library and Gate 2 Story-0.19-split items.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented `useSoftDeleteWithUndo` hook exactly per ACs with internal `Map` state for tracking pending items and their commit callbacks.
- Hook properly triggers unmount-commits using a `useRef` mirror approach to avoid stale closures.
- Created `SoftDeleteToaster` wrapping `sonner`'s `<Toaster>` with explicit design-system tokens (`rounded-lg shadow-lg` etc.).
- Wired up export barrels in `packages/ui/src/hooks/index.ts` and `packages/ui/src/index.ts`.
- Integrated `<SoftDeleteToaster/>` once into `apps/web/src/app/[locale]/layout.tsx`.
- Wrote full unit test for the hook and a wrapper component test. Both `soft-delete-toaster.test.tsx` and `useSoftDeleteWithUndo.test.ts` run clean.
- `pnpm --filter ui run test`, `pnpm build` and `pnpm lint` executed directly and passed without errors caused by these changes.
- Conducted manual smoke check via throw-away harness `apps/web/src/app/[locale]/test-soft-delete/page.tsx` that visually verified the toast, the 'undo' functionality, and the delayed commit execution on routing away (component unmount). Harness was removed after successful test.

### File List

- `packages/ui/package.json`
- `packages/ui/src/hooks/useSoftDeleteWithUndo.types.ts`
- `packages/ui/src/hooks/useSoftDeleteWithUndo.ts`
- `packages/ui/src/hooks/useSoftDeleteWithUndo.test.ts`
- `packages/ui/src/core/soft-delete-toaster.types.ts`
- `packages/ui/src/core/soft-delete-toaster.tsx`
- `packages/ui/src/core/soft-delete-toaster.test.tsx`
- `packages/ui/src/hooks/index.ts`
- `packages/ui/src/index.ts`
- `apps/web/src/app/[locale]/layout.tsx`
