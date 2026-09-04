---
backlog_id: CC-007
project: festgrid
date: 2026-08-07
trigger: "Every route-page should be wrapped in Suspense with a generic/global 'beating app logo' loader as fallback"
mode: incremental
scope_classification: moderate
---

# Sprint Change Proposal — Route-Level Suspense Loader

## Section 1: Issue Summary

**Problem statement**: Every route-page in `apps/web` already has a top-level `<Suspense>` boundary — this isn't new; it's a structural requirement introduced by Story 1.9's Server/Client `page.tsx` split (client content components using `useSearchParams`/`nuqs` need a Suspense boundary in the Next.js App Router). What's missing is a `fallback`: all ~8 existing `<Suspense>` usages render **nothing** while suspended, producing a blank flash on every route navigation instead of a deliberate, on-brand loading state.

**How discovered**: Raised directly by the user (shulha) as a proactive UX-consistency request, not a bug found during a specific story's implementation. Codebase investigation (this session) confirmed the underlying mechanism and scope.

**Evidence**:
- Zero `fallback` props across all existing `<Suspense>` sites: `apps/web/src/app/[locale]/page.tsx:18`, `favorites/page.tsx:20`, `login/page.tsx:18`, `my-calendar/page.tsx`, `settings/locations/page.tsx`, `settings/notifications/page.tsx`, `events/[slug]/page.tsx:42`, and the modal-intercepted `@modal/(.)events/[slug]/page.tsx:42`.
- No `loading.tsx` file exists anywhere under `apps/web/src/app`.
- No generic route-level loader exists in `packages/ui/src/core/`. Closest precedent, `blocking-loader.tsx` (Story 1.7a), is a `Loader2` spin-icon overlay built for blocking mutations — not a route-shell/logo pattern.
- No image-based logo asset exists; the logo is inline JSX/CSS (`packages/ui/src/core/app-shell/Logo.tsx`), and there is no existing "beating"/pulse keyframe (only Tailwind's default opacity `animate-pulse` utility, used for skeletons).
- The modal-intercepted route (`@modal/layout.tsx`) opens its `Dialog`/`DialogContent` (`max-w-3xl max-h-[85vh]`) immediately and independent of data — only the inner `children` (gated by the same fallback-less Suspense) waits on the fetch. A viewport-fixed loader would break out of the dialog's bounds; the loader must be container-relative instead.

## Section 2: Impact Analysis

**Epic impact**: No epic becomes non-viable and none require resequencing.
- Epic 0 already contains this project's reusable-UI-primitive stories built the same way (0.7 app shell, 0.7a NavRailItem, 0.18 Soft-Delete-Undo, 0.19 Swipe-to-Reveal, 1.7a BlockingLoader). New **Story 0.26** slots in after 0.25.
- Unlike most Epic-0 primitives, this story's consumers are not purely future work — 8 `page.tsx` files already exist across Epics 1 and 2 (several already `done`/`review`: 1.3, 1.6 done; 1.7, 1.9, 2.2, 2.3, 2.6, 2.9 review), and each needs a one-line `fallback={<RouteLoader />}` added at its existing Suspense boundary.
- Epics 3-5 are still backlog; any future route they add will follow the new project-context.md rule automatically — no separate tracking needed.

**Story impact**: New Story 0.26 (Epic 0, backlog). No existing story's own file is reopened — user confirmed (via AskUserQuestion) that Story 0.26 owns the full 8-site retrofit directly rather than reopening each consuming story individually, since each site-edit is a trivial one-liner and centralizing it avoids fragmenting a single mechanical change across 8 story files.

**Artifact conflicts**:
- **PRD**: No conflict. PRD §3.12 "Global UI & Navigation Patterns" already anticipates shared UI primitives of this kind (it's what justified Story 1.7a). No PRD edit needed.
- **Architecture spine**: No existing mention of Suspense/loading-state conventions — nothing to amend.
- **UX Design docs**: No existing loading-state spec in `design-artifacts/UX-festgrid-run-1/` — no conflict; the new pattern is additive.
- **project-context.md**: One new rule needed under "UI Patterns & UX Invariants", sibling to the existing "Loaders" rule, following the same "add a dated rule + reference implementation" convention used for the 2026-08-01 metadata rule (Story 1.9).

**Technical impact**: Additive, presentation-layer only. No data model, API, or infrastructure changes. Touches: 1 new component (`RouteLoader`) + 1 extracted component (`LogoMark`) in `packages/ui/src/core/`, 1 new Tailwind keyframe, 8 existing `page.tsx` files (one-line prop addition each).

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment.** Add Story 0.26 to Epic 0; the story's own tasks retrofit the 8 existing Suspense sites and add the project-context.md rule reference.

- **Rollback (Option 2)**: Not applicable — nothing needs reverting; this is additive.
- **MVP Review (Option 3)**: Not applicable — no MVP scope or core-goal change; this is a UX-polish addition already implied by PRD §3.12.

**Effort**: Low (one new component + 8 one-line edits). **Risk**: Low (presentation-only, no data/API surface touched, degrades gracefully via `prefers-reduced-motion`). **Timeline impact**: Negligible — does not block any in-progress story; can be picked up whenever Epic 0's backlog is next worked.

## Section 4: Detailed Change Proposals

### 4.1 `project-context.md` — new UX Invariant rule

Insert as a new bullet under "UI Patterns & UX Invariants", after the existing "Loaders" bullet:

```diff
  - **Loaders:** The application must strictly differentiate between blocking and non-blocking asynchronous operations.
    - **Blocking:** ...
    - **Non-Blocking (Initial Load):** ...
    - **Non-Blocking (Infinite Scroll):** ...
+ - **Route-Level Suspense Fallback:** (added 2026-08-07, `bmad-correct-course`) Every route-page's Server
+   Component `page.tsx` **must** supply a `fallback` to its top-level `<Suspense>` boundary (the boundary
+   already exists project-wide per Story 1.9's Server/Client split for `useSearchParams`-consuming content)
+   — never leave it fallback-less. The fallback **must** be the shared `<RouteLoader />` component
+   (`packages/ui/src/core/route-loader.tsx`, Story 0.26): a container-relative (fills its parent, never
+   viewport-fixed — required both for full-page routes under the persistent `AppShellWrapper` nav rail, and
+   for the intercepted modal route's bounded `DialogContent`), animated ("beating") rendering of the app's
+   `LogoMark` (the icon-only 2x2 grid extracted from `Logo.tsx`, no "FestGrid" text). This is a distinct
+   loading layer from the "Non-Blocking (Initial Load)" skeleton rule above — `RouteLoader` covers the route
+   shell boundary itself, before any content component mounts; skeletons remain for in-page data fetching
+   once mounted. Reference implementation: Story 0.26.
```

**Rationale**: Mirrors the existing convention (2026-08-01 metadata rule) of documenting a cross-cutting, every-route AI-agent rule in project-context.md with a reference-implementation pointer, rather than leaving it implicit in one story.

### 4.2 `epics.md` — new Story 0.26 (Epic 0, after Story 0.25)

```markdown
### Story 0.26: Build the reusable RouteLoader component and wire it into every route Suspense boundary

**As a** developer,
**I want** a shared, generic loading component used as the fallback for every route-page's top-level Suspense boundary,
**So that** navigating to any route (or opening the event-detail modal) shows a consistent, on-brand loading state instead of a blank flash, without each route building its own fallback (project-context.md's "Route-Level Suspense Fallback" rule, PRD §3.12 "Global UI & Navigation Patterns").

**Acceptance Criteria:**

*   **Given** the existing `Logo` component (`packages/ui/src/core/app-shell/Logo.tsx`), **when** this story is implemented, **then** its icon-only 2x2 grid logomark is extracted into a new `LogoMark` component (same package/folder) with no behavior change to `Logo`, which now composes `LogoMark` instead of duplicating its markup.
*   **And** a new `RouteLoader` component is added to `packages/ui/src/core/` that centers a `LogoMark` and fills its containing element (`w-full h-full flex items-center justify-center` sizing, driven by the parent — never `fixed`/viewport-locked), with a "beating" (pulse/scale) CSS animation applied to the mark — implemented as a new Tailwind keyframe (there is currently no custom pulse/heartbeat keyframe in `apps/web/tailwind.config.ts`, only Tailwind's default opacity `animate-pulse`).
*   **And** container-relative sizing is verified in both real usage contexts: (a) full-page routes, where it fills the content area beneath the persistent `AppShellWrapper` nav rail (the shell wraps `{children}` in the root `layout.tsx`, outside each page's own Suspense, so it never unmounts during route loads); and (b) the intercepted modal route (`@modal/(.)events/[slug]/page.tsx`), where the `Dialog`/`DialogContent` (`max-w-3xl max-h-[85vh]`) opens immediately and independent of data — `RouteLoader` must render within that bounded box, not break out to the full viewport.
*   **And** `RouteLoader` respects `prefers-reduced-motion` (renders the static `LogoMark` with no animation when the user's OS/browser signals reduced motion), consistent with the accessibility bar set by `BlockingLoader` (Story 1.7a).
*   **And** it is documented and exported from `packages/ui`'s public entry point for reuse across features.
*   **And** every existing route-page's top-level `<Suspense>` (currently fallback-less) is updated to pass `fallback={<RouteLoader />}`: `apps/web/src/app/[locale]/page.tsx`, `favorites/page.tsx`, `login/page.tsx`, `my-calendar/page.tsx`, `settings/locations/page.tsx`, `settings/notifications/page.tsx`, `events/[slug]/page.tsx`, and the modal-intercepted `@modal/(.)events/[slug]/page.tsx`. (`test-swipe/page.tsx` is a dev-only test harness, not a real route, and is out of scope.)
*   **And** any route-page created by a future story (Epics 3-5) follows the same rule per project-context.md — no further tracking needed here, enforced going forward by the rule itself.

**Note:** Added 2026-08-07 via `bmad-correct-course` (see `sprint-change-proposal-2026-08-07.md`). Positioned in Epic 0 alongside the project's other reusable-UI-primitive stories (0.7, 0.7a, 0.18, 0.19, 1.7a), but — unlike those — this story's own tasks also retrofit 8 already-built/in-review route files across Epics 1 and 2, since the Suspense boundaries it fills already exist in shipped code (Story 1.9). User confirmed via AskUserQuestion: Story 0.26 owns the full retrofit directly rather than reopening each of the 8 consuming stories individually. The container-relative (not viewport-fixed) sizing requirement was surfaced by the user specifically for the modal case and confirmed before finalizing this proposal.

**Depends on:** None (pure presentation component + mechanical wiring; no backend dependency).
```

### 4.3 `sprint-status.yaml` — new entry (epic-0, after `0-25`)

```diff
  0-25-wire-backend-environment-variables-into-the-deployed-api-lambda-s-iac-configuration: backlog
+ # added 2026-08-07 via bmad-correct-course: every route-page's Suspense boundary
+ # (fallback-less since Story 1.9) needs a shared, on-brand loading fallback instead
+ # of a blank flash, including the event-detail modal's bounded dialog content.
+ # See sprint-change-proposal-2026-08-07.md.
+ 0-26-build-the-reusable-routeloader-component: backlog
  epic-0-retrospective: optional
```

## Section 5: Implementation Handoff

**Scope classification: Moderate** — adds a new backlog story requiring backlog reorganization (new Story 0.26 in Epic 0), but no existing story is reopened, no PRD/architecture rewrite, no MVP redefinition.

**Routed to**: Product Owner / Developer agents.
- **PO responsibility**: Confirm Story 0.26's placement/priority in the Epic 0 backlog alongside the other in-review foundation stories.
- **Developer (`bmad-create-story` → `bmad-dev-story`) responsibility**: When picked up, run `bmad-create-story` against Story 0.26 to produce its full story-context file, then implement per its AC — including the `LogoMark` extraction, `RouteLoader` component, Tailwind keyframe, and the 8-site retrofit.

**Success criteria**: All 8 route Suspense boundaries render `<RouteLoader />` on suspend; `RouteLoader`/`LogoMark` exported from `packages/ui`; reduced-motion respected; verified visually in both a full-page route and the event-detail modal.
