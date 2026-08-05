---
baseline_commit: e68e97742d8fd71cfca9154d0420d7ce2c28afe8
---
# Story 0.7: Build the global app shell & navigation layout

## Story Details

- Epic: 0
- Story ID: 0.7
- Status: ready-for-dev

**Revision note (2026-08-05):** This story was previously implemented (see Dev Agent Record below) and reached `review`, but the delivered nav pattern (top header + hamburger drawer, empty `navEntries`, no active-route logic) has been superseded by a formal UX spec pass (`design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`/`DESIGN.md`, accessibility-reviewed). The AC/Tasks below reflect the new pattern and require a new dev pass — the prior implementation's files are reworked in place, not rebuilt from scratch. Story status has been reset to `ready-for-dev` accordingly.

## Story

As a developer,
I want a shared, responsive app shell (header/nav, content region, footer as applicable) established once in `packages/ui`/`apps/web`,
so that every route in UX-DR9 (`/`, `/favorites`, `/my-calendar`, `/feed`, `/settings`, etc.) is built on a consistent, mobile-first layout instead of each feature story reinventing page chrome.

## Acceptance Criteria

1. **Given** Shadcn/UI themes (Story 0.3) and the i18n provider (Story 0.6, now implemented — status `review`) are set up, **when** the root layout renders, **then** it composes a shared `AppShell` around a **single, persistent `<nav aria-label="Main">` landmark** — never two separate nav DOM trees toggled by visibility/CSS, per the accessibility review at `design-artifacts/UX-festgrid-run-1/review-accessibility.md` finding #3. [epics.md AC1; supersedes original dual-`<nav>` (header nav + drawer nav) implementation]
2. The shell renders the 3-tier responsive nav pattern from `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` § Responsive & Platform, using Tailwind default breakpoints: **< 768px** a fixed bottom tab bar (all 5 slots — 4 links + the Profile trigger, icon + label always visible); **768–1279px** a left icon-only sidenav rail; **≥ 1280px** the same rail permanently expanded with icon + label. No manual collapse/expand control — purely breakpoint-driven. At the rail tiers, the FestGrid logo is pinned to the top and the Profile trigger is pinned to the bottom (`mt-auto`); Discover/Feed/Favorites/Calendar sit between them. Containers use logical CSS properties / RTL-ready structure per NFR24, even though only LTR ships at MVP. [epics.md AC2; supersedes the original loose "hamburger/drawer" example]
3. The shell exposes a typed, declarative nav-registry seeded with the **4 real link routes** from EXPERIENCE.md § Global Navigation — Discover (`/`, `Compass`), Feed (`/feed`, `Rss`), Favorites (`/favorites`, `Heart`), Calendar (`/my-calendar`, `CalendarDays`) — that feature stories extend as new routes are added (Epics 1-5), without modifying the shell's layout/rendering code. Each entry stores a translation key, not a raw label string (see AC7). Each renders via the `NavRailItem` primitive's `link` variant from **Story 0.7a** (new prerequisite — see Dev Notes/Out of Scope), not inline icon/label/active-indicator logic in `AppShell`. **Profile is deliberately not part of this registry** — it's a fixed, non-extensible 5th slot (see AC8) rendered via `NavRailItem`'s `trigger` variant, pinned separately per AC2, since it's an auth-state trigger (Story 2.8's User Menu / Story 1.7's `/login`) rather than a plain link. [epics.md AC3; supersedes the empty-placeholder `navEntries[]` and the original "5 items in one registry" framing]
4. The shell is the single composition site for the cross-cutting providers already established (Theme via Story 0.3, Analytics via Story 1.8, i18n via Story 0.6's `NextIntlClientProvider`, now live in `apps/web/src/app/[locale]/layout.tsx`) — feature stories must never re-wire these providers themselves. [epics.md AC4; the i18n slot is no longer just reserved — 0.6 shipped, so this AC is now fully satisfiable]
5. The header/rail renders the FestGrid logomark ("Spark in the Grid" 2×2 grid with an accent-colored Spark square) and logotype ("Fest" bold + "Grid" light) per `DESIGN.md`'s Logo Concept. [Gate 2 addition — see Dev Notes; unchanged from original]
6. All interactive nav elements are keyboard-navigable and meet WCAG 2.1 AA per UX-DR18 and the accessibility review: `aria-current="page"` on the active route, independent of visual styling; a leading-bar active-indicator (`{colors.nav_active_indicator}`) **plus** a filled-vs-outline icon-style swap (so the active cue survives poor color contrast/perception); a visible focus ring (`{components.nav.focus_ring}`) in a color distinct from the active-indicator; `aria-label` on every nav item matching its visible label text, present at every breakpoint regardless of whether the label is visually shown; the icon-only rail's tooltip triggers on `:focus-visible` as well as `:hover`, persists while focused, and dismisses on `Escape`/focus-out; minimum 44px hit area per item; touch tap-to-flash label timing and any rail/tab-bar transition respect `prefers-reduced-motion`.
7. Nav labels are sourced through `next-intl` message keys — a new `Nav` namespace (`discover`, `feed`, `favorites`, `calendar`, `login`) added to both `locales/en.json` and `locales/id.json` — resolved via `useTranslations("Nav")` in `apps/web`, never hardcoded strings. `login` (not `profile`) is the only Profile-slot key this story owns, since the authenticated state shows the user's actual display name (session data, not a translatable string), not a static "Profile" label. This supersedes the original story's explicit interim decision to hardcode English nav labels, which was only justified while Story 0.6 was not yet implemented (AD-6, project-context.md's Locale-Sensitive Data Rendering rules). [new AC — Story 0.6 dependency now satisfied]
8. The Profile slot is a fixed, auth-aware **trigger** (`NavRailItem`'s `trigger` variant from Story 0.7a), not a plain link: **unauthenticated** it shows `LogIn` + the `login` label and navigates to `/login` (Story 1.7) on activation; **authenticated** it shows the user's avatar (`user.user_metadata.avatar_url` from `useAuthSession()`, Story 1.7 — falling back to `UserCircle` if absent) and, at the expanded rail tier (≥1280px), the user's display name as its visible "label" instead of a translated string. Activating it while authenticated invokes an `onProfileTriggerActivate` (or equivalently-named) callback/render-prop that `apps/web` wires to Story 2.8's User Menu once that story exists — `AppShell`/`NavRailItem` must expose this extension point but must **not** build the menu itself (mirrors how this story already reserves a slot for the i18n provider ahead of Story 0.6, per the original Dev Notes precedent). Auth state itself (`isAuthenticated`, `avatarUrl`, `displayName`) is derived in `apps/web` from `useAuthSession()` (Story 1.7's `apps/web/src/components/providers/auth-session-provider.tsx`) and passed into `AppShell` as props — `packages/ui` must not import Supabase or the auth provider directly. [new AC — corrects the original AC3's "5 uniform link items" framing after discovering Story 2.8 already owns the User Menu; see Dev Notes]

## Tasks / Subtasks

- [x] Task 1: Scaffold `packages/ui` as a functioning workspace package (AC: 1, 3)
  - [x] Create `packages/ui/package.json` (name `@festgrid/ui`, `main`/`types` pointing at `src/index.ts`, `react`/`react-dom` as peer/devDependencies, devDependency on `@festgrid/typescript-config`), mirroring the pattern already used by `packages/analytics/package.json`.
  - [x] Create `packages/ui/tsconfig.json` extending `@festgrid/typescript-config/base.json` with `"jsx": "preserve"` (same shape as `packages/analytics/tsconfig.json`).
  - [x] Create `packages/ui/src/index.ts` barrel export.
  - [x] Add `@festgrid/ui` as a `workspace:*` dependency of `apps/web/package.json`.
- [x] Task 2 (superseded — see Task 2 revised below): Original single-DOM-tree header+drawer `AppShell` build. Kept for history; the sub-items below are no longer accurate to the target implementation.
  - [x] ~~Implement `AppShell` (header with logo + nav, `<main>` content region, optional footer slot) as a Core Primitive under `packages/ui/src/core/app-shell/`~~ — Core Primitive placement is still correct and unchanged.
  - [x] ~~Implement the logomark/logotype per `DESIGN.md`'s "Spark in the Grid" spec~~ — unchanged, still correct, do not rebuild.
  - [x] ~~Implement responsive behavior: full horizontal nav at desktop widths, collapsible mobile nav (drawer/sheet)~~ — **superseded**, this dual-`<nav>` pattern is exactly what the accessibility review flagged (duplicate landmark risk). Replaced by Task 2 revised.
  - [x] Logical CSS properties/Tailwind logical utilities (`ps-*`/`pe-*`/`start-*`/`end-*`) — keep this convention in the rework.
  - [x] ~~Ensure semantic landmarks (`<header>`, `<nav aria-label="Main">`, `<main>`) and `aria-current="page"`~~ — landmarks structure superseded (single persistent `<nav>`, see below); `aria-current` was never actually wired (no `currentPath` plumbing existed) — this is net-new work in Task 2 revised, not a completed item.

- [ ] **Task 2 revised: Rework `AppShell` into the single-persistent-nav, 3-tier responsive shell** (AC: 1, 2, 5, 6, 8)
  - [ ] Replace the current two separate `<nav>` DOM structures (desktop header nav + mobile drawer nav) with **one** persistent `<nav aria-label="Main">` whose internal layout is driven purely by CSS breakpoints — fixes the duplicate/conflicting-landmark risk identified in `design-artifacts/UX-festgrid-run-1/review-accessibility.md` (finding: DOM structure, high severity).
  - [ ] Compose the bottom tab bar (`< 768px`), icon-only sidenav rail (`768–1279px`), and expanded rail (`>= 1280px`) using the `components.nav` tokens in `DESIGN.md` (`bottom_tab_bar`, `sidenav_rail`, `sidenav_top_group`, `sidenav_bottom_slot`).
  - [ ] Pin the FestGrid logo to the top of the rail (rail tiers only — the bottom tab bar has no logo slot per the UX spec) and the Profile trigger slot to the bottom via `sidenav_bottom_slot`/`mt-auto`; Discover/Feed/Favorites/Calendar sit between them, top-anchored.
  - [ ] Render the 4 link entries via the `NavRailItem` primitive's **`link` variant** delivered by **Story 0.7a**, and the Profile slot via the same primitive's **`trigger` variant** (also from 0.7a) — `AppShell` composes/lays out `NavRailItem` instances in both variants, it does not reimplement icon/label-swap, active-indicator, tooltip, focus-ring, or trigger logic inline. (If 0.7a is not yet done when this task starts, see Pre-Coding Approval Gate — do not build a throwaway inline version instead of waiting/coordinating.)
  - [ ] Wire the Profile trigger's `onActivate`: if `isAuthenticated` is `false`, navigate to `/login` via the `renderLink`/`LinkComponent` prop (below); if `true`, invoke an `onProfileTriggerActivate` callback/render-prop passed in from `apps/web` (Story 2.8 wires its actual User Menu into this once built — `AppShell` only needs to expose and call the hook point, per AC8).
  - [ ] Accept `isAuthenticated: boolean`, `avatarUrl?: string`, and `displayName?: string` props on `AppShell` (populated by `apps/web` via `useAuthSession()`, Story 1.7) and thread them to the Profile `NavRailItem` instance — `packages/ui` must not import the Supabase client or `AuthSessionProvider` directly.
  - [ ] Accept a `currentPath: string` prop on `AppShell` (populated by `apps/web` via Next.js `usePathname()`) and thread it down to the 4 link items' `NavRailItem` instances for `aria-current`/active-indicator matching (the Profile `trigger` variant does not use this) — do not import `next/navigation` into `packages/ui` directly (keeps the package framework-agnostic per project-context.md's Core Primitives rule).
  - [ ] Accept a `renderLink`/`LinkComponent` prop on `AppShell` so nav `href`s (including the Profile trigger's unauthenticated `/login` navigation) render through `apps/web`'s locale-aware `next-intl` `Link`, not a plain `<a>` — otherwise nav links won't carry the active locale prefix (`/en/...`, `/id/...`). `packages/ui` must not import `next-intl` directly, matching the existing `useScopedLocale`/`useScopedTimezone` decoupling pattern (project-context.md).
  - [ ] Accept a `labels: Record<NavKey, string>` prop (or equivalent) — `apps/web` resolves each entry's translation key via `useTranslations("Nav")` (including `login`) and passes the resolved strings in; `AppShell`/`NavRailItem` never call `next-intl` hooks themselves.
  - [ ] Keep logical CSS properties/Tailwind logical utilities for RTL-readiness (NFR24) throughout the rework.

- [ ] **Task 3 revised: Populate and localize the nav-registry** (AC: 3, 7, 8)
  - [ ] Replace the empty `navEntries` placeholder in `nav-entries.ts` with the **4** real link entries (Discover `/` `Compass`, Feed `/feed` `Rss`, Favorites `/favorites` `Heart`, Calendar `/my-calendar` `CalendarDays`) — Profile is **not** added here (AC8; it's a fixed prop-driven slot on `AppShell`, not a registry entry). Change `NavEntry.label` to `NavEntry.labelKey: string` (a `Nav` namespace key), since `packages/ui` cannot resolve `next-intl` translations itself.
  - [ ] Update the extension-point documentation (code comment / short README) to show a feature story adding a `labelKey`-based entry plus its corresponding `locales/en.json`/`locales/id.json` message key, not a raw `label` string, and to explicitly note that the registry is for link entries only — Profile-slot changes go through `AppShell`'s props, not `navEntries`.
  - [ ] Add the `Nav` namespace (`discover`, `feed`, `favorites`, `calendar`, `login`) to `locales/en.json` and `locales/id.json` (AD-6 — new user-facing text must add keys for every supported locale, not just English).

- [ ] **Task 4 revised: Wire the reworked shell into the locale-aware layout** (AC: 1, 4, 7, 8)
  - [ ] In `apps/web/src/app/[locale]/layout.tsx`, compute `currentPath` via `usePathname()`, resolve `labels` via `useTranslations("Nav")`, read `{ user, isLoading }` via `useAuthSession()` (Story 1.7) to derive `isAuthenticated`/`avatarUrl`/`displayName`, and pass all of the above plus next-intl's `Link` component into `<AppShell>`. Pass a no-op (or `undefined`) `onProfileTriggerActivate` for now — Story 2.8 supplies the real implementation later; clicking the avatar before 2.8 exists should be inert, not throw.
  - [ ] Preserve the existing `NextIntlClientProvider` (Story 0.6, now live), `PostHogProvider` (Story 1.8), `ThemeProvider` (Story 0.3), and `AuthSessionProvider` (Story 1.7) composition — `AppShell` continues to wrap `{children}`; this task does not touch provider setup itself.

- [ ] **Task 5 revised: Manual + accessibility verification** (no automated test runner exists yet — Story 0.10 is still backlog) (AC: 1, 2, 3, 5, 6, 7, 8)
  - [ ] Run `pnpm dev` and verify all three tiers by resizing the viewport: `< 768px` bottom tab bar, `768–1279px` icon-only rail (mouse hover shows tooltip; keyboard focus shows the same tooltip; devtools touch emulation triggers tap-navigate-and-flash for the 4 link items, and immediate activation with no flash for the Profile trigger), `>= 1280px` expanded rail with permanent labels.
  - [ ] Using the browser's accessibility tree inspector (not just visual inspection), confirm exactly **one** `navigation` landmark exists at any given viewport width — no duplicate/hidden-but-present `<nav>`.
  - [ ] Verify `aria-current="page"`, the active-indicator bar, and the filled/outline icon swap all track the current route correctly across `/`, `/feed`, `/favorites`, `/my-calendar`.
  - [ ] Verify the Profile slot: logged out → shows `LogIn` icon + "Log In" label, navigates to `/login` on activation; logged in → shows avatar (or `UserCircle` fallback) and, at the expanded tier, the display name; activation invokes the (currently no-op) callback without error.
  - [ ] Tab through every nav item with the keyboard; verify the focus ring is visually distinct from the active-indicator color, and that the icon-only rail's label tooltip appears on focus exactly as it does on hover (Profile included).
  - [ ] Verify nav labels render correctly in both `en` and `id` locales (switch locale, confirm all 4 link labels plus "Log In" translate).
  - [ ] Verify `pnpm build` succeeds and `pnpm lint` is clean for `packages/ui` and `apps/web` with the reworked shell in place.
  - [ ] Verify the theme toggle (Story 0.3) and PostHog script (Story 1.8, if env vars set) still function unchanged after the rework.

## Dev Notes

- This story is frontend-only; no backend/database/queue changes and no new external service. Confirmed via `docs/infrastructure/high-level-overview.md` and `docs/infrastructure/1-frontend.md` (Vercel-hosted Next.js app; no infra changes required for this story).
- **`packages/ui` does not exist yet as a real package.** Today it is an empty workspace folder (`node_modules` only — no `package.json`/`src`). Project-context.md mandates all reusable UI components live in `packages/ui`, organized as Core Primitives (`packages/ui/src/core/`) vs Domain Features (`packages/ui/src/features/<domain>/`). This story is the first to touch `packages/ui` and must scaffold it for real (Task 1), following the exact pattern already proven in `packages/analytics` (package.json/tsconfig shape) — do not invent a different structure.
- **Current root layout state** (`apps/web/src/app/layout.tsx`): already wraps children with `PostHogProvider` (`@festgrid/analytics`, Story 1.8, status: review) and `ThemeProvider` (`next-themes`, Story 0.3, status: done), around a bare `<main>{children}</main>`. This story's job is to replace that bare `<main>` with the new `AppShell` from `@festgrid/ui` — it must NOT remove, duplicate, or re-initialize the existing providers (AD-5 explicitly forbids re-wiring PostHog per feature/story).
- **Sequencing update (2026-08-05) — Story 0.6 (i18n) is now implemented.** The original note below is preserved for history but is **superseded**: Story 0.6 progressed to status `review` (implemented, `NextIntlClientProvider` is live in `apps/web/src/app/[locale]/layout.tsx`, confirmed by reading that file's current content) since this story's first pass. The hardcoded-English-strings interim decision no longer applies — AC7 now requires real `next-intl` message keys. `packages/ui` still must not import `next-intl` directly (Core Primitives stay framework-agnostic); `AppShell`/`NavRailItem` receive resolved labels, the current path, and a locale-aware `Link` component as props from `apps/web`, per the `useScopedLocale`/`useScopedTimezone` decoupling precedent already established in project-context.md.
- **Original note (superseded, kept for history):** Story 0.6 (i18n) is not yet implemented. The epics.md AC for this story explicitly lists the next-intl provider (Story 0.6) as a precondition ("Given ... the i18n provider (Story 0.6) are set up"). As of this story's creation, `0-6-set-up-i18n-foundation-next-intl` has a story file and is `ready-for-dev`, but its status is not `done` — `next-intl` is not yet wired into the app. This story (0.7) was explicitly requested out of the normal backlog order, ahead of 0.6's implementation. Do not attempt to configure `next-intl` here. Build the shell's nav labels as plain hardcoded English strings for now, structure the shell to be i18n-ready (no baked-in LTR-only assumptions; logical CSS properties per NFR24), and leave an explicit, commented composition slot in `layout.tsx` for the future `NextIntlClientProvider`. This is called out in the Pre-Coding Approval Gate below for explicit human sign-off before implementation starts.
- **New prerequisite — Story 0.7a.** A fresh Gate 2 (UI Complexity & Reusability) run against this revision's UX spec (see Architecture & UX Gate Findings below) found that the nav-item's icon/label-variant + active-indicator + focus-ring + hit-area rendering, combined with the hover/focus/touch-flash timing hook, crosses the reuse/complexity threshold. It has been split into **Story 0.7a: Build the NavRailItem primitive and its interaction hook** (`epics.md`, `sprint-status.yaml` — added 2026-08-05, status `backlog`). This story (0.7) now consumes `NavRailItem` from 0.7a rather than implementing that logic inline — see Task 2 revised and Pre-Coding Approval Gate.
- **Correction (2026-08-05, same day) — Profile is not a 5th uniform nav-registry link.** A UX pass on the Profile item's auth states (login/avatar-menu) was initially drafted as if Epic 0/this story owned the full menu — checking `epics.md` afterward found **Story 2.8 "User Menu" (Epic 2, status `backlog`) already owns that feature**, and **Story 1.7 "User Signup and Login with Google" (Epic 1, status `review`) already built a `/login` route** (not a modal). This story's scope is corrected to: render the Profile slot as an auth-aware *trigger* only (`NavRailItem`'s new `trigger` variant, Story 0.7a) — navigate to `/login` when logged out, invoke an extension-point callback when logged in — and expose that callback for Story 2.8 to wire up later, the same "reserve the slot, don't build the consumer" pattern this story already used for the i18n provider ahead of Story 0.6. Auth state (`isAuthenticated`/`avatarUrl`/`displayName`) is sourced from Story 1.7's already-built `useAuthSession()` hook (`apps/web/src/components/providers/auth-session-provider.tsx`, returns `{ session, user, isLoading, signOut }`) — confirmed by reading that file directly, not assumed. See AC8, Task 2/3/4 revised, and `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` § Profile item — authentication states (also corrected same day) and `epics.md` Story 2.8 (rewritten same day).
- **No automated test framework exists yet** (Story 0.10 "Set up testing frameworks foundation" is backlog — the same gap Story 0.3 hit). Testing for this story is manual/browser verification (Task 5), matching the precedent set by Story 0.3. Automated integration tests for `AppShell` should be backfilled once Story 0.10 lands.
- Nav-registry contract: keep `NavEntry`/`navEntries` generic and typed, with no hardcoded route list beyond what exists today — Epics 1-5 stories will append their own routes (`/favorites`, `/my-calendar`, `/feed`, `/settings/*`, etc. per UX-DR9) without editing shell rendering logic.

### Architecture & UX Gate Findings

**2026-08-05 revision — fresh gate pass against the new UX spec:**

- **Gate 1 & Gate 3 (lightweight escape-hatch guard, no fresh subagent run):** Re-checked this revision's scope against the still-swept `epic-0-readiness.md` — the nav pattern change consumes the already-established i18n foundation (Story 0.6) but doesn't introduce a new external service, data entity, or infra dependency beyond what the epic-wide sweep already covered. No gap.
- **Gate 2 (UI Complexity & Reusability) — run fresh via the Freya/UX-designer analytical lens, evaluated against the new `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`/`DESIGN.md` nav spec: TRIGGERED.** The `NavRailItem` (icon/label-variant swap, active-indicator, focus ring, 44px hit area) combined with its hover/focus/touch-flash interaction hook (multiple trigger sources, timing state, `Escape`/focus-out handling, `prefers-reduced-motion` branching) crosses Gate 2's "complex hook... multiple components will depend on" and "spec vs. draft gap" heuristics — this is greenfield component+hook work, not a subtask of the shell/container rework. **Action taken:** split into **Story 0.7a** (see epics.md, sprint-status.yaml, and the sequencing note above), confirmed with the user via AskUserQuestion before drafting (user selected the split over absorbing it into 0.7). The single persistent-nav container, breakpoint-driven layout switching, logo/Profile pinning, and wiring the 5 IA entries through `NavRailItem` remain in 0.7's scope.
- **Accessibility review (ad-hoc, not a Gate 1/2/3 lens but run at the UX-spec Finalize step):** `design-artifacts/UX-festgrid-run-1/review-accessibility.md`, 10 findings (0 critical/3 high/4 medium/3 low), all resolved into the spec before it was written into EXPERIENCE.md/DESIGN.md — see AC1, AC2, AC6 above, which encode the resolutions directly (single-nav-landmark requirement, focus-visible tooltip parity, distinct focus ring, 44px hit area, `prefers-reduced-motion` handling).

**Original pass (2026-08-01, kept for history):**

- **Gate 1 & Gate 3:** Sourced from `epic-0-readiness.md` (`swept: true`, covers stories 0.1-0.14 incl. 0.7). No gap applicable to Story 0.7 itself. The report's two findings (missing outbound-email adapter, missing Geolocation adapter+cache) are unrelated and already tracked as Stories 0.15/0.16.
- **Gate 2 (original pass, before the UX spec existed):** Verdict was **No gap found** — evaluated against the *loose* epics.md AC (no formal UX spec yet existed for the nav pattern), the app shell read as a single-composition-site layout wrapper without complex sub-parts. The subagent did surface that `DESIGN.md`'s "Spark in the Grid" logomark/logotype spec was missing from epics.md — added as AC 5. **This verdict is superseded by the fresh Gate 2 run above**, now that a formal UX spec with a 3-tier responsive pattern, tooltip system, and active-indicator system exists to evaluate against.
- Story 0.6 (i18n foundation) was flagged as a not-yet-implemented AC precondition — now resolved, see Dev Notes sequencing update above.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found (revision-scope re-check, 2026-08-05).
- Impacted fields/contracts: None — this story introduces no database schema, GraphQL contract, or TypeScript data-model changes. The revised `NavEntry` type (`labelKey` replacing `label`) and the new `locales/en.json`/`locales/id.json` `Nav` message keys are UI-config/i18n-message additions, not data-model/API types.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required beyond `NavEntry.labelKey` (still a UI-config type, not a data-model/API type).
- Backward compatibility and rollout notes: N/A — no persisted data or API contract is touched.
- Verification checks: `pnpm build`/`tsc` across `packages/ui` and `apps/web` passes with the new package in the workspace graph.

### Project Structure Notes

- Alignment with unified project structure: `AppShell` and its sub-components live in `packages/ui/src/core/app-shell/` (Core Primitive, per project-context.md's `packages/ui/src/core/` vs `packages/ui/src/features/<domain>/` split — this is domain-agnostic app chrome, not a feature-domain component). `apps/web/src/app/[locale]/layout.tsx` remains the Next.js App Router composition root (framework requirement — layouts cannot live outside `apps/*`; the `[locale]` segment reflects Story 0.6's now-live i18n routing, superseding the original story's `apps/web/src/app/layout.tsx` path).
- Detected conflicts or variances: Existing Shadcn primitives (`Button`, `Card`, `Dialog`) currently live in `apps/web/src/components/ui/`, not `packages/ui/`, which is a pre-existing variance from project-context.md's rule (introduced by Story 0.3, before `packages/ui` was scaffolded). This story does not migrate those existing components — that is out of scope. The original mobile-drawer implementation's reuse of the Shadcn `Dialog` pattern is **no longer applicable** — the reworked shell uses a single persistent rail/tab-bar, not a drawer/dialog overlay.
- **2026-08-05 addition:** `NavRailItem` (Story 0.7a) is expected to land in `packages/ui/src/core/app-shell/` alongside `AppShell`, since it is app-shell-specific, not a general-purpose Core Primitive — confirm exact placement when 0.7a's story is created, but do not place it under `packages/ui/src/features/` (it is domain-agnostic chrome, matching `AppShell`'s own classification).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.7] — story AC source.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.7a] — new prerequisite story (NavRailItem primitive + hook), added 2026-08-05 via Gate 2 finding.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, swept:true, covers 0.7.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 2 policy and numbering rule applied for the 0.7a split.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-5, #AD-6] — provider composition location (Story 0.7/1.8, Story 0.6/0.7); i18n message-key rule (AD-6.3).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#Logo Concept, #components.nav tokens, #colors.nav_active_indicator] — logomark/logotype spec; nav visual tokens (2026-08-05 addition).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Information Architecture > Global Navigation, #Component Patterns > Global Navigation, #Responsive & Platform, #Accessibility Floor] — full nav IA, behavior, breakpoints, and a11y requirements (2026-08-05 addition).
- [Source: design-artifacts/UX-festgrid-run-1/review-accessibility.md] — WCAG 2.1 AA review of the nav spec, 10 findings resolved into AC1/AC2/AC6 above (2026-08-05).
- [Source: design-artifacts/UX-festgrid-run-1/.memlog.md] — decision log for the nav-pattern UX session (2026-08-05 entries).
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR8, UX-DR9, UX-DR18] — mobile-first/responsive, route list, WCAG AA.
- [Source: _bmad-output/project-context.md#Code Quality & Style Rules, #Locale-Sensitive Data Rendering] — packages/ui Core Primitives vs Domain Features; i18n/next-intl scoped-hook decoupling pattern.
- [Source: apps/web/src/app/[locale]/layout.tsx] — confirms `NextIntlClientProvider` is live (Story 0.6 status `review`), correcting the original story's "not yet implemented" assumption.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8] — User Menu, owns the Profile trigger's authenticated menu content; this story only exposes the extension point (2026-08-05 correction).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7] — User Signup and Login with Google, owns `/login` and `useAuthSession()`; this story consumes both directly.
- [Source: _bmad-output/implementation-artifacts/1-7-user-signup-and-login-with-google.md] — confirms `/login` is a route (not a modal) and documents `useAuthSession()`'s shape.
- [Source: apps/web/src/components/providers/auth-session-provider.tsx] — `useAuthSession()` implementation, read directly to confirm its `{ session, user, isLoading, signOut }` return shape before referencing it in AC8/Task 2 revised.
- [Source: docs/infrastructure/1-frontend.md, high-level-overview.md] — confirms frontend-only, no infra changes.
- [Source: apps/web/src/app/layout.tsx] — current provider composition (PostHog, Theme) to preserve.
- [Source: packages/analytics/package.json, tsconfig.json] — scaffolding pattern reused for packages/ui.
- [Source: _bmad-output/implementation-artifacts/0-3-set-up-shadcn-ui-and-configure-themes.md, 1-8-setup-posthog-analytics.md] — precedent for manual-testing fallback and provider-composition story format.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — packages/ui placement rules, i18n/RTL rules, locale-sensitive rendering (AD-6 message keys), useScopedLocale/useScopedTimezone decoupling pattern.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-5, AD-6) — provider composition location, i18n message-key rule.
- [ ] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 2 policy applied for the 0.7a split.
- [ ] `docs/infrastructure/index.md`, `docs/infrastructure/1-frontend.md` — confirms frontend-only scope, Vercel hosting.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified (not new — package already scaffolded by the original pass): `packages/ui/src/core/app-shell/AppShell.tsx` (rework to single persistent nav, 3-tier layout, `currentPath`/`renderLink`/`labels` props), `packages/ui/src/core/app-shell/nav-entries.ts` (populate 5 entries, `label` → `labelKey`).
  - Consumed, not built by this story: `NavRailItem` component + interaction hook, delivered by **Story 0.7a**, expected under `packages/ui/src/core/app-shell/`.
  - Modified: `apps/web/src/app/[locale]/layout.tsx` (pass `currentPath`, `labels`, `Link` into `AppShell`; provider composition unchanged), `locales/en.json` and `locales/id.json` (new `Nav` namespace: `discover`, `feed`, `favorites`, `calendar`, `profile`).
- **Rule Mapping:**
  - `packages/ui` Core Primitive placement, no direct `next-intl`/`next/navigation` imports in `packages/ui` → project-context.md Code Quality & Style Rules + Locale-Sensitive Data Rendering (scoped-hook decoupling pattern).
  - No re-wiring of PostHog/Theme/i18n providers → AD-5 / AD-6 (Architecture Spine).
  - `Nav` message keys added to `en` and `id` → AD-6.3 (new locale strings must add keys for all supported locales).
  - Single persistent `<nav>` landmark, 3-tier responsive breakpoints, RTL-ready containers → UX-DR8, NFR24, `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` § Responsive & Platform.
  - WCAG 2.1 AA nav semantics (aria-current, focus ring, aria-label, hit area, reduced motion) → UX-DR18, `review-accessibility.md` resolutions.
  - Manual verification given no test framework yet → Testing Rules (project-context.md), interim precedent from Story 0.3.
- **Verification Plan:**
  - `pnpm build` (root, via turbo) succeeds with the reworked `@festgrid/ui` shell in the graph.
  - `pnpm lint` passes for `packages/ui` and `apps/web` (via `@festgrid/eslint-config`).
  - Manual + accessibility browser verification per Task 5 revised (3-tier breakpoints, single nav landmark, active-state/focus-ring distinctness, en/id label rendering, existing providers still functioning).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Rework of the existing `AppShell`/`nav-entries` (not a rebuild) into the 3-tier responsive nav pattern from `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`/`DESIGN.md`, consuming `NavRailItem` from Story 0.7a, plus `next-intl` label/link wiring — no test-framework setup, no migration of existing Shadcn components out of `apps/web`.
- [ ] Architecture and boundary confirmation: `AppShell` stays in `packages/ui/src/core/`, remains framework-agnostic (`currentPath`/`renderLink`/`labels` passed as props, no direct `next-intl`/`next/navigation` imports); composed from `apps/web/src/app/[locale]/layout.tsx`; existing PostHog/Theme/i18n providers preserved, not re-wired.
- [ ] Testing plan confirmation: Manual/browser + accessibility-tree verification only (Task 5 revised), given no test framework exists yet (Story 0.10 backlog); `NavRailItem`'s own automated interaction tests are Story 0.7a's responsibility, not this story's.
- [ ] Explicit human approval state (reset to **pending approval** — this is a material scope revision, not a continuation of the already-approved original pass).
- [x] **Gate 1/3 prerequisites:** sourced from swept `epic-0-readiness.md`, lightweight guard re-run 2026-08-05 — no gap.
- [x] **Gate 2 (fresh 2026-08-05 run) — gap found and split, not silently absorbed:** `NavRailItem` + interaction hook extracted to **Story 0.7a**. This checklist item is satisfied by the split itself; the remaining approval gate is whether the user wants 0.7a implemented before or in parallel with 0.7's rework (0.7's Task 2 revised literally imports `NavRailItem`, so 0.7a should land first in practice).
- [ ] **New dependency confirmation:** Story 0.7a (`0-7a-nav-item-primitive`, status `backlog`) must be `ready-for-dev`/implemented before Task 2 revised can consume `NavRailItem` — confirm sequencing (0.7a first, or explicitly accept a temporary stub/inline placeholder if the user wants 0.7 started in parallel).
- [x] **i18n dependency resolved:** Story 0.6 is now `review` (implemented) — the original sequencing item asking whether to proceed with hardcoded strings no longer applies; AC7 supersedes it with real `next-intl` message keys.
- [x] **Auth dependency resolved:** Story 1.7 (`/login` route, `useAuthSession()`) is `review` (implemented) — AC8's Profile trigger can consume it directly.
- [ ] **Story 2.8 extension-point confirmation:** Story 2.8 ("User Menu", Epic 2, `backlog`) is not required to be done before this story — 0.7 only needs to expose the `onProfileTriggerActivate` callback/render-prop (AC8), passing a no-op until 2.8 lands. Confirm this deferred-wiring approach is acceptable, or that 2.8 should be sequenced first if a fully-functional avatar menu is wanted at the same time as this story ships.

## Testing Requirements

- [ ] Integration tests: Deferred — no test framework exists yet (Story 0.10 backlog). Backfill `AppShell` integration tests (Vitest + Testing Library/msw per project-context.md's testing-trophy approach) once 0.10 lands. `NavRailItem`'s interaction tests (hover/focus/touch-flash/reduced-motion) belong to Story 0.7a, not here.
- [ ] E2E tests: Deferred for the same reason; once Playwright is set up (Story 0.10), add a smoke E2E covering all 3 breakpoint tiers, active-route indication across the 4 link routes, and the Profile trigger's logged-out `/login` navigation.
- [ ] Manual verification (interim, required before marking this story done): see Task 5 revised — 3-tier breakpoint render, single-nav-landmark check via accessibility tree, active-state/focus-ring distinctness, en/id label rendering, existing Theme/PostHog/i18n providers unaffected, `pnpm build`/`pnpm lint` clean.

## Deliverables Checklist

- [x] `@festgrid/ui` workspace package scaffolded and building (unchanged from original pass — package.json, tsconfig.json, src/index.ts).
- [ ] `AppShell` reworked to a single persistent `<nav aria-label="Main">` with 3-tier breakpoint-driven layout (bottom tab bar / icon-only rail / expanded rail), logo pinned top + Profile trigger pinned bottom at rail tiers.
- [ ] `AppShell` composes 4 `link`-variant `NavRailItem` instances (from Story 0.7a) via the populated `navEntries` registry, plus 1 `trigger`-variant `NavRailItem` for Profile, with `currentPath`/`renderLink`/`labels`/`isAuthenticated`/`avatarUrl`/`displayName`/`onProfileTriggerActivate` threaded in as props.
- [ ] `navEntries` populated with the 4 real link IA routes (Profile excluded — it's a prop-driven slot, not a registry entry), `labelKey`-based (not raw strings); `Nav` message namespace (`discover`/`feed`/`favorites`/`calendar`/`login`) added to `locales/en.json` and `locales/id.json`.
- [ ] Profile trigger wired: unauthenticated → `/login` navigation; authenticated → invokes `onProfileTriggerActivate` (no-op stub until Story 2.8 lands).
- [ ] `apps/web/src/app/[locale]/layout.tsx` updated to resolve and pass `currentPath`, `labels`, auth state (via `useAuthSession()`), and the locale-aware `Link` into `AppShell`; existing Theme/PostHog/i18n/Auth provider composition preserved unchanged.
- [ ] Manual + accessibility verification pass completed (Task 5 revised).

## Out of Scope

- Building the `NavRailItem` component and its hover/focus/touch-flash interaction hook (both `link` and `trigger` variants) — delivered by **Story 0.7a** (Gate 2 finding, 2026-08-05); this story only consumes it.
- Building the User Menu itself (dropdown/bottom-sheet contents, ARIA pattern, item registry, Log Out action) — delivered by **Story 2.8 "User Menu"** (Epic 2, `epics.md`, `backlog`) — this story only exposes the `onProfileTriggerActivate` extension point Story 2.8 wires into. (Correction, 2026-08-05: initially drafted as if this story owned it — see Dev Notes.)
- Building the `/login` page itself — already delivered by **Story 1.7** (`review`); this story only navigates to it.
- Setting up the automated test framework (Story 0.10) — manual verification only, per Testing Requirements.
- Migrating existing `apps/web/src/components/ui/*` Shadcn primitives into `packages/ui` (pre-existing variance from Story 0.3; not this story's responsibility).
- Populating `navEntries` with routes owned by future feature stories (Epics 1-5) beyond the 4 IA-defined link entries — those stories append their own entries.
- Any backend/GraphQL/database change (none required — confirmed via infrastructure docs).

## Definition of Done

- [ ] AC 1-8 satisfied (revised AC set, including the new i18n AC7 and the Profile-trigger AC8).
- [ ] Manual + accessibility verification (Task 5 revised / Testing Requirements) passing; no automated tests exist yet to run, so this substitutes pending the Story 0.10 dependency.
- [ ] Lint and type checks passing for `packages/ui` and `apps/web` (`pnpm lint`, `pnpm build`).
- [ ] Pre-Coding Approval Gate explicitly (re-)approved by the user before this revision's implementation begins, including the Story 0.7a sequencing item.

## Completion Status

- [x] Not started (reset — scope materially changed; the `review` status below reflects the now-superseded original pass, see Dev Agent Record)
- [ ] In progress
- [ ] review

## Dev Agent Record

*The record below documents the original (2026-08-01 to ~08-04) implementation pass, which reached `review` against the original, looser AC. It is preserved for history. A new Dev Agent Record entry should be added by the next `dev-story` run against the revised AC/Tasks above.*

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
