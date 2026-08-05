---
baseline_commit: ec92a4a8d2a77ee55747ec017b25d5827832a889
---
# Story 0.7a: Build the NavRailItem primitive and its interaction hook

## Story Details

- Epic: 0
- Story ID: 0.7a
- Status: review

## Story

As a developer,
I want a single `NavRailItem` component (icon/label variant swap, active-indicator, focus ring, 44px hit area) and a paired interaction hook covering hover/focus/touch label-reveal timing, active-route detection, and reduced-motion handling,
so that Story 0.7's app shell composes one well-tested nav-item primitive across all three responsive tiers instead of hand-rolling this state machine inline inside the shell.

## Acceptance Criteria

1. **Given** the `nav_active_indicator` color token and `components.nav` tokens in `design-artifacts/UX-festgrid-run-1/DESIGN.md`, **when** `NavRailItem` renders at the icon-only tier (768–1279px), **then** it shows the icon with an `aria-label` matching its full label text, a 44px-minimum hit area (`components.nav.item_hit_area`), and a tooltip that appears on both `:hover` and `:focus-visible`, stays visible while focused, and dismisses on `Escape` or focus-out.
2. **And** on touch input (detected via `PointerEvent.pointerType === 'touch'`, matching the existing pointer-event precedent in `swipe-to-reveal.tsx`), a single tap both navigates (`link` variant) and flashes the item's visible label for at least 2000ms before it fades — never shortened, only extended, under `prefers-reduced-motion` — not a two-step reveal-then-navigate.
3. **And** at the expanded tier (≥1280px) and the mobile bottom-tab tier (<768px), the same single DOM structure renders icon + visible label without needing the tooltip/flash behavior — this is CSS-breakpoint-driven (`components.nav.item_label`/`item_tooltip` tokens), not three separately-instantiated component variants; `NavRailItem` itself has no viewport/breakpoint awareness in JS.
4. **And** the active item (matched via `currentPath === href`, exact string equality — `/` is never prefix-matched against other routes) is indicated by the `active_indicator` token (leading bar, `{colors.nav_active_indicator}`) **and** the `active_icon` token's filled-vs-outline icon-style swap (CSS-applied to the consumer-supplied icon element via `[&_svg]:fill-current`, not two separate icon props), plus `aria-current="page"`, independent of any visual styling. Only the `link` variant participates in active-route matching; the `trigger` variant never receives an active state.
5. **And** every item exposes a visible focus ring (`components.nav.focus_ring`) in a color distinct from the active-indicator, satisfying WCAG 2.4.7.
6. **And** the component and hook stay framework-agnostic per `packages/ui`'s Core Primitives rule — no direct `next-intl`, `next/link`, or `next/navigation` import. The active label text, current-route value, and the link-rendering element are all passed in as props (consuming code in `apps/web`, i.e. Story 0.7, resolves them via `useTranslations`/`usePathname`/next-intl's `Link`) — consistent with the existing `useScopedLocale`/`useScopedTimezone` decoupling pattern (`project-context.md`).
7. **And** the fade/transition timing respects `prefers-reduced-motion` (instant show/hide fallback, detected via `matchMedia('(prefers-reduced-motion: reduce)')` with an SSR-safe guard, since this is the first such consumer in `packages/ui`).
8. **And** `NavRailItem` supports two variants sharing the same rail-tier chrome (icon sizing, 44px hit area, tooltip, focus ring): a **`link` variant** (`href` + active-route matching, per AC4 — used by the 4 primary nav items) and a **`trigger` variant** (`onActivate` callback + `aria-haspopup="true"`/`aria-expanded` instead of `href`, no active-route matching) — used by the Profile nav item (Story 0.7/2.8), which navigates to `/login` or opens Story 2.8's User Menu rather than being a plain link. The `trigger` variant is excluded from the icon-only rail tier's generic tap-navigates-and-flashes-label behavior (AC2) — activating it opens/navigates immediately, no flash step (per `EXPERIENCE.md` § Profile item — authentication states).
9. **And** the following are covered by real, automated Vitest + Testing Library unit/interaction tests (not manual-only verification — see Dev Notes "Testing approach" for why this supersedes the original epics.md deferral): hover-only tooltip show/dismiss; focus-only tooltip show/dismiss (hover/focus parity); touch tap-flash timing (≥2000ms, fake timers); reduced-motion fallback (instant show/hide, `matchMedia` mock); active-state rendering (`aria-current`, active-indicator, icon-style swap); and the `trigger` variant's `onActivate`/`aria-haspopup`/`aria-expanded` behavior, including that it never flashes.

## Tasks / Subtasks

- [x] Task 1: Register the `nav-active-indicator` design token in the Tailwind theme (AC: 4, 5)
  - [x] Add `--nav-active-indicator: 358 72% 57%; /* #E04347 — darker than base --accent, ~3.98:1 vs neutral per DESIGN.md's WCAG 1.4.11 note; verify exact HSL in devtools before committing */` to `apps/web/src/app/globals.css`'s `:root` block, alongside the existing `--accent`/`--success` custom properties.
  - [x] Add `"nav-active-indicator": "hsl(var(--nav-active-indicator))"` to the `colors` object in `apps/web/tailwind.config.ts`'s `theme.extend`, matching the existing `accent`/`success`/`wizard-primary` pattern — this is what makes `bg-nav-active-indicator`/`text-nav-active-indicator` (the literal token values in `DESIGN.md`'s `active_indicator`/`active_icon`) resolve to real Tailwind utilities. `packages/ui`'s content is already scanned by this same config (`../../packages/ui/src/**/*.{ts,tsx}` is already in `content`), so no `packages/ui`-side Tailwind config change is needed.
  - [x] This token has no dark-mode override specified in `DESIGN.md` — reuse the same `:root` value in `.dark` unless/until a future UX pass specifies otherwise (note this as a follow-up, don't block on it).

- [x] Task 2: Build `useNavRailItemInteraction` and `usePrefersReducedMotion` hooks (AC: 1, 2, 4, 7, 8)
  - [x] Create `packages/ui/src/hooks/usePrefersReducedMotion.ts` — a small, generic hook wrapping `window.matchMedia('(prefers-reduced-motion: reduce)')` with a change-event listener and an SSR-safe `typeof window === 'undefined'` guard (defaults to `false` when unavailable). Exported from the hooks barrel since it is generic and trivially reusable by future animated primitives, not events/nav-specific — but built as part of this story's scope per Gate 2's fresh-run verdict (see Dev Notes), not split into its own story.
  - [x] Create `packages/ui/src/hooks/useNavRailItemInteraction.ts` + `.types.ts`, following the `useSoftDeleteWithUndo`/`useContextAwareListNavigation` file-pair convention (hook + types file, colocated `.test.ts`). Input: `{ variant: 'link' | 'trigger'; href?: string; currentPath?: string }`. Output: `{ isActive: boolean; tooltipVisible: boolean; isFlashing: boolean; handlers: { onPointerEnter, onPointerLeave, onFocus, onBlur, onKeyDown, onClick/onPointerUp } }` (exact handler set is an implementation detail; the state machine and its exposed booleans are the contract other code depends on).
  - [x] `isActive` computation: `variant === 'link' && href !== undefined && currentPath === href` (exact match only — see AC4).
  - [x] Tooltip visibility: shows on `pointerenter`(non-touch)/`focus`, hides on `pointerleave`/`blur`/`Escape` — dedupe so mouse-hover-then-focus (or vice versa) doesn't cause a visible flicker.
  - [x] Touch tap-flash timing: on a `touch`-type pointer activation, set `isFlashing = true` for a duration read from `usePrefersReducedMotion()` — ≥2000ms normally, extended (never shortened) when reduced-motion is preferred (e.g. a longer fixed duration, not zero — instant-hide only applies to the *tooltip* fade per AC7, not to the touch flash's minimum-visible-duration guarantee in AC2). Use a single `useRef`-held `setTimeout`, cleared on unmount and on re-trigger.
  - [x] `trigger` variant never sets `isFlashing` (AC8) — activation calls `onActivate` immediately regardless of pointer type.

- [x] Task 3: Build the `NavRailItem` component (AC: 1, 3, 4, 5, 6, 8)
  - [x] Create `packages/ui/src/core/app-shell/NavRailItem.tsx` + `NavRailItem.types.ts`. Props (discriminated union on `variant`):
    - Common: `icon: ReactNode` (a fully-rendered element, e.g. `<Compass />` or an `<img>` avatar — mirrors the `action: ReactNode` pattern already used by `swipe-to-reveal.types.ts`; NavRailItem does **not** accept a bare `LucideIcon` component reference, since the Profile trigger needs to pass an avatar `<img>` too, which doesn't share `LucideIcon`'s prop signature), `label: string` (used as both visible text and `aria-label`), `className?: string`.
    - `link` variant: `href: string`, `currentPath?: string`, `renderLink: React.ComponentType<{ href: string; className?: string; children: React.ReactNode; 'aria-label'?: string; 'aria-current'?: 'page' }>` (threaded through from `AppShell`'s own `renderLink` prop per Story 0.7's Task 2 revised — `NavRailItem` renders through this instead of a bare `<a>`, so it never needs to know about `next-intl`'s `Link`).
    - `trigger` variant: `onActivate: () => void`, `ariaExpanded?: boolean` (defaults `false` — Story 2.8 controls this once it exists, per Story 0.7's AC8 "reserve the slot" pattern).
  - [x] Apply `components.nav.item_hit_area`, `item_label`, `item_tooltip`, `active_indicator`, `active_icon`, `focus_ring` token classes (exact strings from `DESIGN.md` lines 78–83) — conditionally applying `active_indicator`/`active_icon` only when `isActive` (link variant) is true, per AC4.
  - [x] Set `aria-current="page"` when `isActive`; `aria-haspopup="true"` + `aria-expanded={ariaExpanded}` on the `trigger` variant's root element (a real `<button>`, not an anchor).
  - [x] Wire `useNavRailItemInteraction`'s exposed handlers onto the rendered root element; render the tooltip (visible label text) conditionally on `tooltipVisible || isFlashing`.

- [x] Task 4: Wire barrel exports (AC: 6)
  - [x] Add `export * from './NavRailItem';` to `packages/ui/src/core/app-shell/index.ts`.
  - [x] Add exports for `useNavRailItemInteraction` (+ `.types`) and `usePrefersReducedMotion` to `packages/ui/src/hooks/index.ts`, matching the existing `useInfiniteScroll`/`useSoftDeleteWithUndo` export pairs.

- [x] Task 5: Automated tests (AC: 9)
  - [x] `packages/ui/src/hooks/useNavRailItemInteraction.test.ts` — cover `isActive` exact-match logic (including the `/` special case), tooltip show/dismiss on hover-only and focus-only (`vi.useFakeTimers()` where timing matters), touch tap-flash duration (`fireEvent` with `pointerType: 'touch'`, fake timers, assert ≥2000ms), reduced-motion branch (mock `usePrefersReducedMotion`/`matchMedia`), and that the `trigger` variant path never sets `isFlashing`.
  - [x] `packages/ui/src/core/app-shell/NavRailItem.test.tsx` — render-level assertions: `aria-label`/`aria-current`/`aria-haspopup`/`aria-expanded` presence per variant; active-indicator/icon-swap classes present only when active; focus ring class always present; tooltip text appears on `fireEvent.focus`/`fireEvent.pointerEnter` and is removed on `Escape`/blur; clicking a `link` item invokes the `renderLink`-rendered element (not a bare `<a>`); activating a `trigger` item calls `onActivate` and never renders the flash label.
  - [x] Run `pnpm --filter @festgrid/ui test` and `pnpm --filter @festgrid/ui lint`/`tsc` to confirm the new files pass, following the same verification style as Stories 0.18/0.19.

## Dev Notes

- **This story is a pure frontend UI primitive.** No backend, database, queue, or external-service involvement — confirmed via `docs/infrastructure/high-level-overview.md` and `docs/infrastructure/1-frontend.md` (Vercel-hosted Next.js/packages/ui monorepo; no infra changes required). No `packages/domain` logic either — this is presentational React, not portable business logic, so project-context.md's `packages/domain` reusability rule does not apply here.
- **Testing approach (superseding the original epics.md deferral):** the epics.md AC text for this story originally deferred automated tests to "once Story 0.10 lands." Story 0.10 ("Set up testing frameworks foundation") has since progressed to status `review` — Vitest, jsdom, `@testing-library/react`, and `@testing-library/user-event` are already wired into `packages/ui` (`vitest.config.ts` extends `@festgrid/testing-config/vitest-react`), and every sibling primitive already ships real `.test.tsx`/`.test.ts` coverage, including pointer/timing interaction tests (`swipe-to-reveal.test.tsx` mocks `setPointerCapture`/`offsetWidth`/`getComputedStyle` for exactly this class of interaction). **Confirmed with the user via AskUserQuestion before drafting this story:** write real automated tests now (Task 5/AC9), not manual-only verification. This does not reopen Gate 2 or the story-split question — it only affects the Testing Requirements/Definition-of-Done bar.
- **Prop contract for `icon` — read `DESIGN.md` literally before implementing.** The epics.md As-a/I-want phrase "icon/label variant swap" refers to responsive label visibility (CSS, `item_label` token), and "filled-vs-outline icon-style swap" (AC4) refers to the `active_icon` token — `"text-nav-active-indicator [&_svg]:fill-current"` — which is a **CSS class applied to whatever icon element the consumer passes**, not a request for two separate icon props/assets. Do not design a `icon`/`activeIcon` two-prop API; a single `icon: ReactNode` prop is correct and matches both the token definition and the existing `SwipeToRevealProps.action: ReactNode` precedent in this codebase. This also keeps the door open for Story 0.7's Profile trigger, which needs to pass an avatar `<img>` (not a `LucideIcon` component) for the same slot.
- **New Tailwind token discovered missing during Dev Notes analysis (not a Gate 1/2/3 architecture gap — a concrete implementation prerequisite):** `DESIGN.md`'s `active_indicator`/`active_icon` tokens reference `bg-nav-active-indicator`/`text-nav-active-indicator` Tailwind utility classes, but no `--nav-active-indicator` CSS custom property or `nav-active-indicator` Tailwind color exists anywhere in the codebase yet (confirmed via search — only planning/design docs reference the name). Since `NavRailItem` is the first and only consumer, Task 1 adds it to `apps/web/src/app/globals.css` + `apps/web/tailwind.config.ts`, following the exact existing `accent`/`success` pattern. This touches two `apps/web` files even though the story is otherwise scoped to `packages/ui` — necessary because Tailwind's utility generation is driven by the single app-level config that already scans `packages/ui/src/**` (see `apps/web/tailwind.config.ts`'s `content` array), not a per-package config.
- **Touch detection uses Pointer Events**, matching the existing precedent in `swipe-to-reveal.tsx` (`e.isPrimary`, `setPointerCapture`) rather than the legacy `TouchEvent` API — check `e.pointerType === 'touch'` to distinguish touch activation from mouse/pen.
- **`usePathname()` compatibility assumption:** `currentPath` arrives as a prop from Story 0.7's `apps/web` layout — this story assumes it is already locale-prefix-stripped (e.g. `/feed`, not `/en/feed`) so it compares directly against the static `href` values (`/`, `/feed`, `/favorites`, `/my-calendar`). This is Story 0.7's responsibility to guarantee when it calls whichever `usePathname()` it ends up using (plain `next/navigation` vs. next-intl's locale-aware wrapper); 0.7a only documents the assumption its exact-match logic depends on.
- No new locale/message keys are introduced by this story — `NavRailItem`/its hook never call `next-intl` (AC6); Story 0.7 owns the `Nav` namespace keys (`discover`/`feed`/`favorites`/`calendar`/`login`) and passes already-resolved strings in as the `label` prop.
- No PostHog/analytics event is added by this story — nav-item hover/focus/tap-flash chrome is not a tracked interaction per `AD-5`'s scope; if a future story wants click-tracking on nav items, that is a `apps/web`-level concern layered on top of the `onActivate`/`renderLink` extension points this story already exposes, not something `NavRailItem` itself should emit.
- **State management categorization:** the hook's tooltip-visible/is-flashing/timer state is local, ephemeral, per-instance UI state (`useState`/`useRef` inside the hook) — it is explicitly **not** Zustand Client Global State, since it never crosses component boundaries or needs to be shared/read by unrelated components (project-context.md's State Management Architecture rule reserves Zustand for exactly that cross-boundary case). No Server State (React Query) or URL State (nuqs) is involved either — this story has no async data and no shareable URL parameter.
- No asynchronous data-fetching operation exists in this story, so the Blocking/Non-Blocking loader categorization rule does not apply.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (lightweight escape-hatch guard — epic-0-readiness.md is `swept: true` and covers Epic 0's planned stories including the 0.7 lineage this story split from):** re-checked this story's actual scope against what the epic-wide sweep anticipated. This story introduces no external/third-party service call, no new database entity, and no infra/deploy dependency beyond what the sweep already covered — it is a pure `packages/ui` presentation component + hook, consistent with Story 0.7's own "Depends on: None" framing. No gap found; full Gate 1/3 subagent re-run not warranted.
- **Gate 2 (UI Complexity & Reusability) — run fresh via the Freya/UX-designer analytical lens against this story's own draft scope (evaluating whether 0.7a itself should be split further, e.g. hook vs. component, or `link` vs. `trigger` variant):** **Verdict: NO FURTHER SPLIT.** The interaction hook has exactly one consumer (`NavRailItem` itself, both variants share it) — unlike the 1.6a/1.6b split, where `useContextAwareListNavigation` encoded a genuinely portable list-navigation pattern independent of the one detail-view component that first consumed it, plus 1.6a's component carried substantial independent loading/error/empty-state surface area. Neither condition holds here: the hover/focus/touch-flash/reduced-motion state machine *is* `NavRailItem`'s interaction model, not a separately-reusable pattern, and there is no second component competing for AC space. The `link`/`trigger` variant split is a discriminated-union prop on one primitive sharing all chrome (icon sizing, hit area, tooltip, focus ring) — closer to `Button as="a"` than to two separate primitives — splitting it would duplicate shared chrome and undercut the story's own "one well-tested nav-item primitive" goal. This matches the codebase's established single-story component+hook granularity (`useInfiniteScroll`, `useSoftDeleteWithUndo`), not the 1.6a/1.6b exception. (Full verdict retained; this story is itself the deliverable of the Gate 2 finding that split it out of Story 0.7 on 2026-08-05 — see `epics.md` Story 0.7a Note and Story 0.7's own Architecture & UX Gate Findings section for that originating finding.)

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, GraphQL contract, or persisted TypeScript data-model changes. `NavRailItemProps`/`UseNavRailItemInteraction*` are UI-config/component-contract types, not data-model/API types.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required beyond the new `NavRailItem.types.ts`/`useNavRailItemInteraction.types.ts` component-prop types themselves.
- Backward compatibility and rollout notes: N/A — no persisted data or API contract is touched. `NavRailItem` is net-new; there is no existing consumer to break.
- Verification checks: `pnpm --filter @festgrid/ui build`/`tsc` passes with the new files in place; new Vitest suites (Task 5) pass.

### Project Structure Notes

- `NavRailItem` and its types/tests land in `packages/ui/src/core/app-shell/`, alongside `AppShell`/`Logo`/`nav-entries` — per Story 0.7's own Project Structure Notes addition ("expected to land in `packages/ui/src/core/app-shell/`... since it is app-shell-specific, not a general-purpose Core Primitive"), confirmed here as this story's actual placement.
- `useNavRailItemInteraction` and `usePrefersReducedMotion` land in `packages/ui/src/hooks/`, matching the flat-hooks-directory convention already used for `useInfiniteScroll`, `useContextAwareListNavigation`, and `useSoftDeleteWithUndo` — all of which are, like this one, tightly coupled to a single primary consumer today but still live in `hooks/` rather than co-located, establishing that as this project's norm.
- Detected conflicts or variances: none. `apps/web/src/app/globals.css` and `apps/web/tailwind.config.ts` are touched (Task 1) despite this being a `packages/ui`-scoped story — see the Dev Notes bullet above explaining why (single app-level Tailwind config drives utility generation for both `apps/web` and `packages/ui` content).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.7a] — story AC source (As a/I want/So that, all 9 ACs, Note, Depends on).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.7] — parent story that split this one out via Gate 2; consumer-side prop expectations (`renderLink`, `currentPath`, `labels`, `isAuthenticated`/`avatarUrl`/`displayName`, `onProfileTriggerActivate`).
- [Source: _bmad-output/implementation-artifacts/0-7-build-the-global-app-shell-and-navigation-layout.md#Architecture & UX Gate Findings, #Project Structure Notes] — originating Gate 2 finding; expected `packages/ui/src/core/app-shell/` placement.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, `swept: true`.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 policy, numbering rule, epic-level sweep mode.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#colors.nav_active_indicator, #components.nav] — token values (`item_hit_area`, `item_label`, `item_tooltip`, `active_indicator`, `active_icon`, `focus_ring`), lines 16, 73–83.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Component Patterns > Global Navigation, #Responsive & Platform, #Accessibility Floor] — interaction/behavior spec, lines 115–121, 151–173.
- [Source: design-artifacts/UX-festgrid-run-1/review-accessibility.md] — WCAG 2.1 AA findings resolved into the current spec (tooltip focus-visible parity, distinct focus ring, 44px hit area, reduced-motion, single-landmark DOM).
- [Source: apps/web/src/app/globals.css, apps/web/tailwind.config.ts] — confirmed `nav-active-indicator` token does not yet exist; existing `accent`/`success` token pattern to follow.
- [Source: packages/ui/src/core/swipe-to-reveal.tsx, .types.ts] — `ReactNode`-prop and Pointer Event precedent followed for `icon`/touch detection.
- [Source: packages/ui/src/hooks/useSoftDeleteWithUndo.ts, .types.ts; packages/ui/src/hooks/useContextAwareListNavigation.ts] — hook+types file-pair convention, flat `hooks/` placement precedent.
- [Source: packages/ui/vitest.config.ts, package.json] — confirms Vitest/jsdom/Testing Library already wired (Story 0.10, status `review`).
- [Source: _bmad-output/project-context.md#Code Quality & Style Rules, #State Management Architecture, #Locale-Sensitive Data Rendering] — Core Primitives placement; Zustand/React Query/nuqs scoping; i18n/next-intl scoped-hook decoupling pattern.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Core Primitives placement (`packages/ui/src/core/`), framework-agnostic decoupling pattern, State Management Architecture scoping.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this story.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-6 i18n/locale strategy) — no direct `next-intl` import; labels passed as props.
- [ ] `docs/infrastructure/index.md`, `docs/infrastructure/1-frontend.md` — confirmed frontend-only, no infra change required.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/ui/src/core/app-shell/NavRailItem.tsx`, `NavRailItem.types.ts`, `NavRailItem.test.tsx`
  - New: `packages/ui/src/hooks/useNavRailItemInteraction.ts`, `useNavRailItemInteraction.types.ts`, `useNavRailItemInteraction.test.ts`
  - New: `packages/ui/src/hooks/usePrefersReducedMotion.ts`
  - Modify: `packages/ui/src/core/app-shell/index.ts` (export `NavRailItem`)
  - Modify: `packages/ui/src/hooks/index.ts` (export the two new hooks + types)
  - Modify: `apps/web/src/app/globals.css` (add `--nav-active-indicator` custom property)
  - Modify: `apps/web/tailwind.config.ts` (register `nav-active-indicator` color)
- **Rule Mapping:**
  - `packages/ui/src/core/app-shell/` placement → project-context.md Core Primitives rule + Story 0.7's Project Structure Notes precedent.
  - No `next-intl`/`next/navigation` import, props-in labels/path/link-renderer → project-context.md's `useScopedLocale`/`useScopedTimezone` decoupling pattern (AD-6).
  - Automated Vitest + Testing Library coverage (Task 5) → user decision confirmed via AskUserQuestion, superseding the stale epics.md manual-only note, now that Story 0.10 is `review`.
  - `nav-active-indicator` Tailwind token addition → follows existing `accent`/`success` token pattern in `apps/web/tailwind.config.ts`/`globals.css`, no new architecture introduced.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — new Vitest suites for the hook and component pass (Task 5).
  - `pnpm --filter @festgrid/ui lint` and `tsc` — clean for all new/modified files.
  - `pnpm --filter web build` (or `tsc`) — confirms the new Tailwind color token compiles and `apps/web` still builds with the config change.
  - Manual sanity check in a scratch/story-book-less render (e.g. a temporary page or Vitest snapshot) that `bg-nav-active-indicator`/`text-nav-active-indicator` actually resolve to the intended `#E04347`-range color, not an unstyled fallback — since this is the first real usage of the new token.

## Pre-Coding Approval Gate

- [x] Scope confirmation: build `NavRailItem` (`link` + `trigger` variants) and its interaction hook only, in `packages/ui`, plus the supporting `nav-active-indicator` Tailwind token — no changes to `AppShell.tsx`/`nav-entries.ts` (Story 0.7's own scope) and no User Menu content (Story 2.8's scope).
- [x] Architecture and boundary confirmation: no `next-intl`/`next/navigation`/Supabase import in `packages/ui`; all locale/routing/auth data enters via props (AC6).
- [x] Testing plan confirmation: automated Vitest + Testing Library tests (Task 5/AC9) — confirmed with the user, superseding the original epics.md manual-only deferral.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: no prerequisite story required (`Depends on: None` in epics.md); Gate 1/3 lightweight guard and fresh Gate 2 run both returned no gap — see Architecture & UX Gate Findings above.
- [x] Explicit human approval state: **approved** by user on 2026-08-05.

## Testing Requirements

- [x] Integration/interaction tests (Vitest + Testing Library, `packages/ui`'s testing-trophy tier): `useNavRailItemInteraction.test.ts` and `NavRailItem.test.tsx`, per Task 5.
- [x] E2E tests: none for this story — `NavRailItem` has no standalone routed page to drive end-to-end; E2E coverage of the full nav (route changes, `aria-current` across pages) belongs to Story 0.7 once it composes `NavRailItem` into `AppShell`.

## Deliverables Checklist

- [x] `NavRailItem` component supporting `link` and `trigger` variants, rendering via a consumer-supplied `renderLink` (never a bare `<a>`) for the `link` variant.
- [x] `useNavRailItemInteraction` hook: active-route matching, tooltip hover/focus parity, touch tap-flash timing (≥2000ms, reduced-motion-extended), trigger-variant no-flash behavior.
- [x] `usePrefersReducedMotion` hook, SSR-safe, exported from the `packages/ui` hooks barrel.
- [x] `nav-active-indicator` Tailwind color token registered in `apps/web`'s theme (CSS variable + Tailwind config).
- [x] All new files exported from their respective barrels (`core/app-shell/index.ts`, `hooks/index.ts`) and reachable via `@festgrid/ui`'s root `src/index.ts`.
- [x] Automated Vitest test suites for both the hook and the component, passing.

## Out of Scope

- Reworking `AppShell`/`nav-entries.ts` to actually compose `NavRailItem` instances — Story 0.7's own Task 2/3 revised, which consumes this story's output.
- The Profile item's auth-state icon selection (avatar vs. `LogIn` vs. `UserCircle`) and `isAuthenticated`/`avatarUrl`/`displayName` wiring — Story 0.7's AC8; 0.7a only guarantees `icon` accepts any `ReactNode` so Story 0.7 can pass whatever it needs.
- The authenticated User Menu itself (contents, ARIA disclosure pattern, dropdown/bottom-sheet, focus-return branching) — Story 2.8, entirely separate story and component.
- Locale message keys (`Nav` namespace) — Story 0.7's Task 3 revised.
- Dark-mode-specific value for `--nav-active-indicator` — not specified in the current `DESIGN.md`; Task 1 reuses the light-mode value as a documented placeholder, flagged as a follow-up rather than blocking this story.

## Definition of Done

- [x] All 9 Acceptance Criteria satisfied.
- [x] Task 5's automated Vitest test suites passing for both the hook and the component.
- [x] `pnpm --filter @festgrid/ui lint`/`tsc` (runs `tsc --noEmit` cleanly) and `pnpm --filter web build`/`tsc` clean.
- [x] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [x] Completed and ready for review on 2026-08-05.

## Dev Agent Record

### Agent Model Used

- Cline (Claude 3.5 Sonnet)

### Debug Log References

- `pnpm --filter @festgrid/ui test` -> All 112 tests passed successfully.
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -> Exited with exit code 0.
- `pnpm --filter web build` -> Next.js build completed successfully in 12.8s.

### Completion Notes List

- ✅ Created the `usePrefersReducedMotion` hook with SSR-safe checks and window media query listener.
- ✅ Created the `useNavRailItemInteraction` hook to handle active state exact matching, hover/focus tooltip visibility with escape key dismissal, and touch tap-flash timing (≥2000ms, extended under prefers-reduced-motion to 4000ms).
- ✅ Created `NavRailItem` supporting both `link` and `trigger` variants, rendering via custom `renderLink` callback for link variant and a `<button>` element for trigger variant.
- ✅ Applied precise character-for-character Tailwind CSS class tokens from `DESIGN.md` for hit area, labels, active indicator, active icon, and focus ring.
- ✅ Exported all primitives and hooks from packages/ui barrels.
- ✅ Registered `--nav-active-indicator` HSL property in `globals.css` (both light/dark modes) and Tailwind theme color mapping in `apps/web`.
- ✅ Created comprehensive Vitest + React Testing Library suites for both hooks and component, testing all AC specifications.

### File List

- `apps/web/src/app/globals.css` (modified)
- `apps/web/tailwind.config.ts` (modified)
- `packages/ui/src/hooks/usePrefersReducedMotion.ts` (new)
- `packages/ui/src/hooks/useNavRailItemInteraction.types.ts` (new)
- `packages/ui/src/hooks/useNavRailItemInteraction.ts` (new)
- `packages/ui/src/hooks/useNavRailItemInteraction.test.ts` (new)
- `packages/ui/src/core/app-shell/NavRailItem.types.ts` (new)
- `packages/ui/src/core/app-shell/NavRailItem.tsx` (new)
- `packages/ui/src/core/app-shell/NavRailItem.test.tsx` (new)
- `packages/ui/src/hooks/index.ts` (modified)
- `packages/ui/src/core/app-shell/index.ts` (modified)
