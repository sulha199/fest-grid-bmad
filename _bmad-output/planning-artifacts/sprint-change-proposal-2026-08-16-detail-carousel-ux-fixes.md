# Sprint Change Proposal — 2026-08-16: Event Detail Carousel UX Fixes

**Trigger story:** [1.6 — View event details](../../_bmad-output/implementation-artifacts/1-6-view-event-details.md), Task 15 / AC13 (Carousel-chrome Next/Previous navigation).
**Mode:** Incremental.
**Scope classification:** Minor — direct implementation within the existing in-progress story, no epic/PRD/architecture change.

## 1. Issue Summary

Earlier in this session, Story 1.6's Task 15 (shadcn `Carousel` chrome around Next/Previous) was extended, at the user's request, from a single-slide chrome-only carousel into a 3-slide window with card-level "peek" previews of the adjacent previous/next events and real swipe-gesture support. After using the shipped feature, the user identified two concrete UX regressions:

1. **Size/shape mismatch:** The active slide (`EventDetailView`, full multi-section layout: header controls, image, title, tags, description, schedule cards) and the peek slides (`EventPreviewCard`, a generic image + 3 skeleton bars) have visibly different sizes and structure, causing a jarring jump as the carousel is swiped.
2. **Loading-flash regression:** Committing a Next/Previous navigation (button or swipe) briefly replaces the already-mounted, already-peeking carousel with Next.js's route-level `RouteLoader` ("beating logo," `project-context.md`'s Route-Level Suspense Fallback rule / Story 0.26) before the new slide's content appears — even though the carousel already had a live peek of that exact content a moment earlier. The user's explicit requirement: this loader should only ever appear on a genuine cold/direct-URL open of an event, never when navigating Next/Previous from an already-open list/modal context.

**Root cause, confirmed by direct code inspection:**

- Issue 1: `EventPreviewCard` (`apps/web/src/features/events/event-preview-card.tsx`) was built as a minimal, generic skeleton shape, not shaped to match `EventDetailView`'s actual structure — a direct conflict with `project-context.md`'s own "Non-Blocking (Initial Load): Use Skeleton screens matching the layout of the incoming data to reduce Cumulative Layout Shift" rule.
- Issue 2: Both event-detail routes (`apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` + its sibling `loading.tsx`, and `apps/web/src/app/[locale]/events/[slug]/page.tsx`) perform a real server-side GraphQL fetch inside `generateMetadata` (Story 1.6 AC12) on every navigation to a new `[slug]`. Next.js's route-segment Suspense model can't distinguish "first load" from "in-place navigation from an already-mounted client component" — it shows the segment's loading fallback for the duration of that fetch on *every* `[slug]` transition, including swipe/click-driven `router.replace` calls where the client already has fresher peek data.

## 2. Impact Analysis

- **Epic impact:** None. Epic 1 remains completable as planned; this is a within-story quality fix.
- **Story impact:** Story 1.6 only. Its AC13, Out-of-Scope, and Task 15 text currently describe the *original* single-slide-only carousel and had already drifted out of sync with the as-built peek-preview carousel (a pre-existing documentation gap this proposal also closes, independent of the two bugs).
- **Artifact conflicts:**
  - PRD: none.
  - Architecture spine (AD-x): none — presentation-layer only.
  - `project-context.md`: Issue 1's fix directly satisfies the existing CLS-prevention skeleton rule (no rule change needed). Issue 2's fix (prefetch adjacent slugs) is a new pattern not currently documented anywhere; see Section 4 for the proposed addendum.
  - UX design docs: none — no `DESIGN.md`/`EXPERIENCE.md` change; this refines an already-approved interaction, it doesn't add a new one.
- **Technical impact:** Two files change (`event-preview-card.tsx`, `EventDetailWrapper.tsx`); existing tests (`EventDetailWrapper.test.tsx`, `EventDetailWrapper.swipe-navigation.test.tsx`, `event-preview-card.test.tsx`) need updates to match the new peek shape and the new `router.prefetch` calls.

## 3. Recommended Approach

**Option 1 — Direct Adjustment.** Both fixes are small, well-understood, and fully containable within Story 1.6's existing Task 15 (already `in-progress`/reopened). No rollback is warranted — the underlying multi-slide peek design is sound, only its skeleton shape and its interaction with Next.js's route-loader model need correcting. No MVP/PRD scope question is involved.

- Effort: Low (two files, both already well understood from this session's own implementation work).
- Risk: Low (presentation-layer changes with existing test coverage to extend, no data/schema/API surface touched).
- Rejected alternatives: Option 2 (rollback) would discard a working, user-approved feature to fix two isolated bugs — disproportionate. Option 3 (MVP review) doesn't apply; nothing here touches PRD scope.

## 4. Detailed Change Proposals

### 4.1 Story file — `1-6-view-event-details.md`

**AC13** — OLD:
> **AC13 — Carousel-chrome Next/Previous navigation (added 2026-08-13 via `bmad-correct-course`):** And the Next/Previous controls specified in AC5 are presented using shadcn `Carousel` visual/gesture chrome (arrow controls, optional swipe) wrapping the single currently-loaded `EventDetailView`, rather than plain buttons. This is a presentation change only: the underlying async, single-item, list-context-aware navigation (AC5, AC6) and existing disabled/loading states are preserved unchanged. This is explicitly **not** a multi-slide carousel — no more than one event's data is ever mounted at a time.

NEW:
> **AC13 — Carousel-chrome Next/Previous navigation with peek previews (amended 2026-08-16 via `bmad-correct-course`):** And the Next/Previous controls specified in AC5 are presented using shadcn `Carousel` visual/gesture chrome (arrow controls, swipe), wrapping a 3-slide window: the single currently-loaded `EventDetailView` as the active/current slide, flanked by lightweight card-level peek previews of the adjacent previous/next list items (real image, skeleton text shaped to mirror `EventDetailView`'s own layout — no full detail fetch) when available. This is a presentation change only: the underlying async, single-item, list-context-aware navigation (AC5, AC6) is preserved unchanged, and at most one `EventDetailView` is ever mounted — peeks are a distinct, lightweight `EventPreviewCard`, never a second `EventDetailView`. Committing a Next/Previous navigation must not trigger the route-level `RouteLoader` fallback (`project-context.md`'s Route-Level Suspense Fallback rule) — that fallback is reserved for a genuine cold/direct-URL open.

**Out-of-Scope bullet** — OLD:
> **A true multi-slide carousel** — AC13 explicitly keeps this single-slide (one `EventDetailView` mounted at a time); only Embla's chrome/gesture styling is reused, not its slide-index model.

NEW:
> **A second full `EventDetailView` mounted at once** — AC13 keeps exactly one `EventDetailView` mounted; adjacent slides are lightweight `EventPreviewCard` peeks (image + skeleton), never a second full detail fetch. *(Supersedes the prior "no true multi-slide carousel" bullet now that peek previews are in scope.)*

**Task 15** — rewritten to document the as-built work and add two new sub-tasks:
- Documents the shipped Carousel chrome + 3-slide peek window + swipe-commit wiring (this session).
- **New:** `EventPreviewCard` restructured to mirror `EventDetailView`'s own `loading`-skeleton proportions (title bar, tag pills, content block) instead of a generic 3-bar shape, keeping only the real image swapped in for the top block.
- **New:** `nav.previous.target`/`nav.next.target`'s routes are prefetched via `router.prefetch()` as soon as known, so committed navigation resolves before `loading.tsx`/`RouteLoader` can show.

**Rationale:** The story file must reflect the as-built system (a "story must leave the system working end-to-end" per this story's own established precedent for prior amendments) — its AC13/Out-of-Scope text currently contradicts the shipped code independent of these two bugs, and the two fixes are new, real scope this session added.

### 4.2 `apps/web/src/features/events/event-preview-card.tsx`

Restructure the skeleton markup to mirror `EventDetailView`'s own `loading` branch (`packages/ui/src/features/events/EventDetailView.tsx:121-135`): a title bar, a subtitle bar, two tag-pill bars, and one large content block — replacing the current generic image + 3-bar shape. The image slot keeps its already-correct `aspect-video` real-image behavior (fixed in this session's prior turn); only the surrounding skeleton bars change shape/count to match.

**Rationale:** Directly satisfies `project-context.md`'s existing skeleton-matches-incoming-layout rule; reuses a shape already proven appropriate for this exact component (it's literally what the active slide itself shows while `isPending`).

### 4.3 `apps/web/src/features/events/EventDetailWrapper.tsx`

Add a `useEffect` that calls `router.prefetch()` for `nav.previous.target.item.slug` and `nav.next.target.item.slug` (with the same search-params suffix `handleNext`/`handlePrevious` already construct) whenever those targets are available/change. This runs unconditionally alongside the existing peek rendering — no new state, no interaction with the swipe-commit or recenter effects.

**Rationale:** Directly implements the user's confirmed fix direction — matches Next.js's idiomatic prefetch-ahead-of-known-navigation pattern, requires no changes to `loading.tsx`, `generateMetadata`, or the routing structure itself, and correctly leaves the `RouteLoader` fallback intact for genuine cold/direct-URL opens (which have nothing prefetched).

### 4.4 `project-context.md` — optional addendum (not yet approved, flagged for user decision)

A short addendum to the existing "Route-Level Suspense Fallback" rule noting the prefetch-adjacent-known-targets pattern, so a future context-aware detail view (Story 2.2 Favorites, Story 2.6 Calendar — both confirmed future consumers of the same `useContextAwareListNavigation` hook per Story 1.6b's Gate 2 finding) reuses this pattern rather than rediscovering it. Deferred to the user's call in Section 5 below — not required to close out this proposal.

## 5. Implementation Handoff

- **Scope:** Minor.
- **Route to:** Developer agent — direct implementation of Sections 4.1–4.3 in the current session.
- **Deliverables:** Story 1.6 file amendment; `event-preview-card.tsx` skeleton restructure; `EventDetailWrapper.tsx` prefetch effect; updated tests in `EventDetailWrapper.test.tsx`, `EventDetailWrapper.swipe-navigation.test.tsx`, `event-preview-card.test.tsx` (router mocks need `prefetch`; peek-shape assertions need updating for the new skeleton markup).
- **Success criteria:** All updated/existing tests pass; `tsc`/`eslint` clean on touched files; manual verification that (a) peek and active slides no longer visibly jump in size/shape, and (b) Next/Previous navigation from an already-open modal/list no longer shows the beating-logo `RouteLoader` (only a genuine cold `/events/[slug]` open does).
- **`project-context.md` addendum (4.4):** deferred — user to confirm separately if wanted; not blocking this proposal's implementation.
