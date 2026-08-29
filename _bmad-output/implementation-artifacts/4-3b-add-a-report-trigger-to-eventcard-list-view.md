# Story 4.3b: Add a Report trigger to EventCard (list-view)

## Cancellation

**Cancelled (2026-08-29, via `bmad-correct-course`):** User decision reverses this story's own premise — reporting now requires viewing an event's detail view first, so a card-level report trigger is deliberately not wanted. PRD 3.9.2's "list-view or detailed view" clause (the requirement this story was split off Story 4.3 to satisfy) has been narrowed to detail-view only. No code was written for this story (was `ready-for-dev`, unstarted) — nothing to roll back. Story 4.3's existing detail-view report flow, Story 4.3a's backend, and Story 4.3c's server-side list-visibility exclusion are all unaffected. **Do not implement the tasks below.** See `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-29.md`.

## Story Details

- **Epic:** 4
- **Story ID:** 4.3b
- **Status:** wont-do

## Story

**As a** user,
**I want** to report an event directly from a list/grid card (Discovery, Favorites, Feed, and a subscribed account's page),
**So that** I don't have to open an event's full detail view just to report it, matching PRD 3.9.2's literal "list-view or detailed view" requirement.

## Acceptance Criteria

1. **Given** `EventCard.tsx` (`packages/ui`) currently exposes only a Favorite toggle and no "more actions" affordance, **when** this story is implemented, **then** `EventCard` gains a "more actions" trigger (`MoreVertical` icon button) containing a single "Report" menu item, rendered only when an `onReport` prop is passed — reusing `EventDetailView.tsx`'s exact hand-rolled menu shell (focus trap, `Escape`-to-close, outside-click-to-close, `role="menu"`/`role="menuitem"`), no new Radix dependency. Placement: top-**left** of the card image (`absolute top-3 left-3 z-10`), always visible (not hover/focus-reveal — mobile has no hover), dropdown anchored `left-0` at `z-50`. This is the opposite corner from the existing Favorite button (`top-3 right-3`) and the `statusBadge` slot (`top-2 right-2`) — see Dev Notes "Gate 2 — Overflow Menu Placement Decision" for the full rationale.
2. **Given** I am authenticated and browsing Discovery (`home-content.tsx`), Favorites, Feed, or a subscribed social-media account's page, **when** I click "Report" on a card, **then** the same `ReportDialog` Story 4.3 already built (reason selection + optional details, `submitReport` mutation via Story 4.3a) opens for that specific event — reused exactly as-is (`apps/web/src/features/events/report-dialog.tsx`), no new dialog/form component built and no extraction needed (see Dev Notes "Reuse, Not Extraction").
3. **Given** I am unauthenticated and viewing Discovery or the account page (Favorites and Feed already redirect unauthenticated visitors to `/login` before any card renders — Report is unreachable there while logged out), **when** I click "Report", **then** the existing in-page login modal (the same `Dialog`/`LoginContent` the Favorite toggle already opens on these two pages) opens instead of the report dialog — **not** a redirect to `/login` (see Dev Notes "Unauthenticated-Click Scope Decision" for why this diverges from `epics.md`'s literal AC3 text).
4. **And**, given I successfully submit a report, or the server responds `REPORT_IGNORED` (meaning I'd already hidden this event via an earlier report — Story 4.3a AC2), **when** `ReportDialog`'s `onReported` callback fires, **then** that event is immediately removed from the currently rendered list on whichever page I reported it from — no page reload, manual refresh, or wait for the next fetch needed — via a new shared `useLocallyHiddenIds` hook (`packages/ui/src/hooks`), not per-page duplicated state (see Dev Notes "Post-Report List Behavior Decision").
5. **And** every new label (more-actions button, report menu item) is resolved via `next-intl` in both `en` and `id`, added to each of the four pages' own existing translation namespace (`DiscoveryPage`, `FeedPage`, `FavoritesPage`, `AccountPage`) — no hardcoded strings.
6. **And** the existing Favorite toggle continues to render and function unchanged, independently of the new trigger (both may render simultaneously on the same card); both controls meet a minimum 44×44px touch target (bumped from the current ~36px), and DOM/tab order is more-actions trigger → Favorite → card content, matching left-to-right visual scan order.

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC6) — Add the "more actions" trigger to `EventCard`:** In `packages/ui/src/features/events/EventCard.tsx`/`.types.ts`:
  - Add `onReport?: () => void` to `EventCardProps`, and `moreActionsButtonLabel`/`reportMenuItemLabel` to `EventCardLabels` (default `'More actions'`/`'Report'` in the component's `defaultLabels` merge, matching the existing `favoriteToggle`/`priceFrom` default pattern).
  - Build a `menuActions` array (currently one entry, "Report" — structured for future extensibility, mirroring `EventDetailView.tsx`'s own `menuActions` `useMemo`) and port that component's exact hand-rolled menu implementation: `isMenuOpen` state, `menuContainerRef`/`menuTriggerRef`, the `keydown`(Escape/Tab-focus-trap)/`pointerdown`(outside-click) `useEffect`, `aria-haspopup`/`aria-expanded`/`role="menu"`/`role="menuitem"`.
  - Render the trigger as a sibling of the existing Favorite button (both outside `<RootTag>`, matching the current DOM structure) at `absolute top-3 left-3 z-10`; dropdown panel `absolute left-0 mt-1 w-48 ... z-50` (mirrored from `EventDetailView`'s `right-0`, flipped to `left-0` since this trigger sits on the card's left edge).
  - Bump both the Favorite button's and the new trigger's tap target to ≥44×44px (e.g. `p-3` in place of the current `p-2`, or explicit `min-h-11 min-w-11` — verify against the `w-5 h-5`/`w-6 h-6` icon size actually used).
  - JSX order: render the "more actions" trigger **before** the Favorite button so DOM/tab order matches the left-to-right visual scan (AC6).
  - Extend `EventCard.test.tsx`: menu renders only when `onReport` is passed; clicking the trigger opens the menu; clicking "Report" calls `onReport` and closes the menu; `Escape`/outside-click closes the menu; both controls render and function independently when both `onFavoriteToggle` and `onReport` are passed; tab order assertion (more-actions before Favorite).
- [ ] **Task 2 (AC4) — New `useLocallyHiddenIds` hook:** Create `packages/ui/src/hooks/useLocallyHiddenIds.ts` + `.types.ts` + `.test.ts`: a small, generic, `TId`-parameterized hook — `{ isHidden: (id: TId) => boolean; hiddenIds: ReadonlySet<TId>; markHidden: (id: TId) => void }`. **Deliberately does not reuse `useSoftDeleteWithUndo`** (Story 0.18) — see Dev Notes "Why Not `useSoftDeleteWithUndo`" for why a toast-with-Undo affordance is wrong for a non-reversible action. Export from `packages/ui/src/hooks/index.ts` (already re-exported at the package root via `export * from './hooks'` in `packages/ui/src/index.ts` — no root `index.ts` change needed).
- [ ] **Task 3 (AC2, AC3, AC4, AC5) — Wire into Discovery (`apps/web/src/app/[locale]/home-content.tsx`):** Import `useLocallyHiddenIds` and `ReportDialog` (`@/features/events/report-dialog`). Filter the rendered list: `events={events.filter((e) => !isHidden(e.id))}` before passing to `EventListView`. Add local `reportingEventId: string | null` state. `getCardProps`: add `onReport: () => { if (!session) { setIsLoginModalOpen(true); return; } setReportingEventId(event.id); }` (reusing the page's existing `isLoginModalOpen` state already wired for the Favorite toggle — AC3). Render `<ReportDialog isOpen={reportingEventId !== null} eventId={reportingEventId ?? ''} onClose={() => setReportingEventId(null)} onReported={() => { if (reportingEventId) markHidden(reportingEventId); setReportingEventId(null); }} />` alongside the page's existing login `Dialog`. Add `moreActionsButtonLabel`/`reportMenuItemLabel` to `cardLabels` (AC5). Extend `apps/web/src/app/[locale]/page.test.tsx` accordingly.
- [ ] **Task 4 (AC2, AC4, AC5) — Wire into Favorites (`apps/web/src/app/[locale]/favorites/favorites-content.tsx`):** Same pattern as Task 3, minus the unauthenticated branch — this page already redirects unauthenticated visitors to `/login` before any card renders, so `getCardProps`'s `onReport` opens `ReportDialog` directly, no session check. Note the existing `unfavoritedIds`/`pendingRemoval` optimistic-unfavorite pattern already on this page is a **separate, Undo-capable** mechanism (favoriting is reversible) — do not conflate it with `useLocallyHiddenIds` (report is not reversible); a card can in principle be both `pendingRemoval` (pending unfavorite) and filtered out by `isHidden` (reported) independently. Extend `favorites-content.test.tsx`.
- [ ] **Task 5 (AC2, AC4, AC5) — Wire into Feed (`apps/web/src/app/[locale]/feed/feed-content.tsx`):** Same pattern as Task 4 (no unauthenticated branch — page-level redirect already guarantees a session). Extend `feed-content.test.tsx`.
- [ ] **Task 6 (AC2, AC3, AC4, AC5) — Wire into the Account page (`apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx`):** Same pattern as Task 3, including the unauthenticated login-modal branch (this page is publicly viewable, matching Discovery). Extend `account-content.test.tsx`.
- [ ] **Task 7 (AC5) — i18n:** Add `moreActionsButtonLabel` ("More actions" / "Aksi lainnya") and `reportMenuItemLabel` ("Report" / "Laporkan") to the `DiscoveryPage`, `FeedPage`, `FavoritesPage`, and `AccountPage` namespaces in `apps/web/locales/en.json` and `id.json` (8 new keys total, 2 per namespace × 4 namespaces) — reuse the exact English copy already shipped under `EventDetailsPage.moreActionsButtonLabel`/`reportMenuItemLabel` by Story 4.3 for consistency.
- [ ] **Task 8 — Tests:**
  - [ ] `packages/ui/src/features/events/EventCard.test.tsx` (extend, Task 1).
  - [ ] `packages/ui/src/hooks/useLocallyHiddenIds.test.ts` (new, Task 2): `markHidden` marks an id hidden; `isHidden` reflects current state; `hiddenIds` updates and is independent per hook instance (no shared/global state).
  - [ ] `apps/web/src/app/[locale]/page.test.tsx`, `favorites-content.test.tsx`, `feed-content.test.tsx`, `account-content.test.tsx` (extend, Tasks 3–6, Vitest + Testing Library + `msw`): "Report" trigger renders on each card; clicking it opens `ReportDialog` for the correct `eventId` (authenticated) or opens the login modal instead (Discovery/Account only, unauthenticated); a mocked successful `submitReport` (or `REPORT_IGNORED`) response via `ReportDialog`'s `onReported` removes that event from the rendered list without a refetch.
  - [ ] E2E: extend or add to `apps/web/e2e/event-report.spec.ts` — one representative list-view happy path on Discovery: open the "more actions" menu on a card, click "Report", submit, assert the card is no longer rendered in the grid. (Testing-trophy scope — one E2E path here, not one per page; the other three pages are covered by integration tests per Task 8's Vitest additions.)
- [ ] **Task 9 — Verification:** `pnpm --filter @festgrid/ui test`, `pnpm --filter web test`, `pnpm build`, `pnpm lint`, `pnpm test` (root) all pass with no regressions. No codegen run needed (no new GraphQL operations — `ReportDialog`/`useSubmitReportMutation` are reused unchanged from Story 4.3).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — run fresh (this story postdates the `swept: true` `epic-4-readiness.md`, dated 2026-08-11; `4.3b` is not in its `stories_covered` list, so its "no gap" conclusions cannot be assumed to cover this story's own scope).** Evaluated directly against this story's real shape (verified via direct code read, not assumption): no new backend/API surface (`submitReport`/`Event.isHiddenForCurrentUser` — Story 4.3a — already implemented and confirmed present in `apps/backend/src/schema/resolvers.ts`/`reports.graphql`/`packages/database/schema.ts`'s `reports` table); no new external-service call from the frontend; no new secrets/auth logic (the unauthenticated branch reuses the page's existing session check, it doesn't add a new enforcement surface); no dependency on infra without an IaC/deploy story. **No Gate 1 gap.** No new project-wide/cross-cutting foundational dependency is introduced (no new i18n/analytics/GraphQL-codegen/app-shell setup — all reused as-is). **No Gate 3 gap.**
- **Gate 2 (UI Complexity & Reusability) — this story's own reason for existing** (split off from Story 4.3, see that story's Dev Notes "Architecture & UX Gate Findings" and `epics.md` Story 4.3 Gate 2 finding). Run fresh via a one-shot Freya-persona subagent review for the specific placement/sizing question `epics.md`'s own AC4 flagged as this story's design decision to make — see "Gate 2 — Overflow Menu Placement Decision" below.
- **Lightweight guard:** confirmed no `design-artifacts/UX-festgrid-run-1/DESIGN.md`/`EXPERIENCE.md` content specifies an `EventCard`-level report/overflow-menu pattern (grepped both files — no hits), consistent with `epics.md`'s own note that "no UX artifact specifies the card-level design." No new prerequisite stories split off.

### Gate 2 — Overflow Menu Placement Decision

Freya-persona review (one-shot, this story's own creation) recommendation, adopted directly: place the new "more actions" trigger at the **opposite corner** from the existing Favorite button — top-**left** (`absolute top-3 left-3 z-10`), styled identically to Favorite (`p-* rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background`), **always visible** (not hover/focus-reveal). Rationale: the top-right corner already holds two elements (the `statusBadge` slot at `top-2 right-2` and Favorite at `top-3 right-3`) on a ~24rem-wide card — a third control there would crowd the corner and put "Report" within a thumb's-width of "Favorite," risking accidental taps between two very different-consequence actions. Opposite corners give both controls independent hit zones across the card's full width. Always-visible (not hover-reveal) is required because mobile has no hover state, and Discovery/Feed grids are primary browsing surfaces where a hidden trigger fails discoverability. Dropdown anchors `left-0` (not `right-0` like `EventDetailView`) so it opens rightward and stays within the card's own bounds; `z-50` layers it above the image, `statusBadge` (`z-10`), and Favorite. Accessibility: ≥44×44px touch target on both controls (up from the current ~36px `p-2` + `w-5` icon); DOM/tab order left-to-right (more-actions, then Favorite, then card content) — reflected in AC6/Task 1.

### Unauthenticated-Click Scope Decision

`epics.md`'s own AC3 text says unauthenticated users clicking "Report" should be "redirected to `/login`, mirroring Story 4.3/4.1's existing unauthenticated-redirect pattern" — but that pattern is the **detail-view** pattern (`EventDetailWrapper.tsx` does a hard `router.push('/login')`). The actual list-view pages reachable while logged out (Discovery via `home-content.tsx`, and the social-media Account page via `account-content.tsx` — Favorites and Feed both already force a page-level `/login` redirect for any unauthenticated visitor before a single card ever renders, so an unauthenticated card-click is structurally unreachable there) use a **different, already-established pattern**: clicking the Favorite toggle while logged out opens an in-page login `Dialog`/`LoginContent` modal, not a redirect. Presented to the user via `AskUserQuestion` with both options: (a) follow `epics.md`'s literal text and hard-redirect; (b) reuse the existing modal pattern already live at these exact two call sites for the exact same "you must be logged in to act on this card" moment. **The user chose (b) — reuse the existing login modal**, for consistency with Favorite's established UX at these call sites and to avoid yanking a browsing user out of their scroll context for a lower-stakes list-view action. This is a deliberate, confirmed divergence from `epics.md`'s literal AC3 text, not a missed requirement.

### Post-Report List Behavior Decision

Story 4.3 (detail view) satisfies PRD 3.9.2's "immediately hidden from my view" by navigating the user away from the event page entirely — there is no equivalent "navigate away" in a list/grid view. Three options were presented to the user via `AskUserQuestion`: (a) a new shared hook doing immediate, non-reversible removal from the rendered list once `ReportDialog`'s `onReported` confirms the mutation succeeded (or hit `REPORT_IGNORED`); (b) the same immediate-removal behavior but hand-rolled independently in each of the four wired pages (matching how Favorites' own optimistic-unfavorite `pendingRemoval` state is hand-rolled today); (c) no local removal at all — a success toast only, relying on the page's next natural refetch/navigation plus Story 4.3c's server-side default-visibility exclusion to eventually stop showing the event. **The user chose (a) — a new shared hook**, to avoid re-deriving the same `Set`-based tracking/filter logic four times (a real duplication risk Gate 2 exists to catch) while still satisfying "immediately" literally rather than deferring to a future refetch. Note this is **not** classic pre-mutation optimism: `ReportDialog` already blocks on the mutation via `BlockingLoader` and only calls `onReported` after a confirmed success/`REPORT_IGNORED` response, so there is no rollback path to build — `markHidden` only ever fires once the outcome is already known.

### Why Not `useSoftDeleteWithUndo`

`packages/ui/src/hooks/useSoftDeleteWithUndo.ts` (Story 0.18) already exists and looks superficially similar (`isPending`/`pendingIds`/`markPending`), and is exactly what Favorites' own optimistic-unfavorite flow could in principle be refactored onto — but it is unconditionally coupled to a toast **with an "Undo" action** (`markPending`'s toast always renders an undo button that calls back into a caller-supplied `undo` function). Favoriting is a genuine two-way toggle, so "Undo" is meaningful there. Reporting has no corresponding "un-report" mutation — once `submitReport` succeeds, the report exists server-side permanently (Story 4.3a has no delete/retract path). Reusing `useSoftDeleteWithUndo` for this would present a functional-looking "Undo" button that either does nothing meaningful or, worse, implies the report itself was retracted when it was not. `useLocallyHiddenIds` (Task 2) is deliberately a smaller, toast-free sibling: pure `Set`-based state tracking, no UI/undo semantics baked in, reusable by any future non-reversible "stop showing this locally" case.

### Reuse, Not Extraction

`epics.md`'s own Story 4.3b note speculated this story "likely requires extracting Story 4.3's report-dialog content into a shared component... since it will now have two real consumers," leaving "actual extraction shape" as this story's own decision. Verified by direct code read: `apps/web/src/features/events/report-dialog.tsx`'s `ReportDialog` component is **already** a standalone, self-contained component with a clean, minimal prop surface (`isOpen`, `onClose`, `eventId`, `onReported`) — it has no dependency on `EventDetailWrapper.tsx`'s internals and was never nested inside that file. It is already reusable by any `apps/web` caller as-is. **No extraction is needed or performed by this story** — Tasks 3–6 import and render it directly from its existing location.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story is entirely frontend (`packages/ui` + `apps/web`); it consumes Story 4.3a's already-implemented `submitReport` mutation and Story 4.3's already-implemented `ReportDialog` unchanged. No `packages/database` change, no `packages/shared-types` change, no `packages/domain` change, no `apps/backend` change, no new GraphQL operation (no codegen run needed).
- **Impacted fields/contracts:** None beyond new UI-local props (`EventCardProps.onReport`, `EventCardLabels.moreActionsButtonLabel`/`reportMenuItemLabel`) and a new pure-frontend hook (`useLocallyHiddenIds`) — no wire-format/API contract changes.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None generated (no codegen); only hand-written interface additions in `EventCard.types.ts` and the new `useLocallyHiddenIds.types.ts`.
- **Backward compatibility and rollout notes:** Purely additive — `onReport`/`onFavoriteToggle` are both optional props, existing callers of `EventCard`/`EventListView` that don't pass `onReport` are unaffected. The Favorite button's tap-target/padding bump (Task 1) is a minor visual change to already-shipped UI, not a behavioral one.
- **Verification checks:** Task 8's integration tests cover the trigger-render/click/dialog-open/unauth-branch/immediate-removal path on all four wired pages; Task 9's full build/lint/test.

### Project Structure Notes

- **New:** `packages/ui/src/hooks/useLocallyHiddenIds.ts` + `.types.ts` + `.test.ts`.
- **Modified:** `packages/ui/src/features/events/EventCard.tsx`/`.types.ts`/`.test.tsx`; `packages/ui/src/hooks/index.ts` (new export); `apps/web/src/app/[locale]/home-content.tsx` + `page.test.tsx`; `apps/web/src/app/[locale]/favorites/favorites-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/feed/feed-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` + `.test.tsx`; `apps/web/locales/en.json`/`id.json`; `apps/web/e2e/event-report.spec.ts` (extended).
- **Not modified:** `apps/backend/*`; `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/web/src/features/events/report-dialog.tsx` (reused unchanged); `apps/web/src/generated/graphql.ts`; `packages/ui/src/features/events/EventListView.tsx` (already generically passes through `getCardProps`, needs no change); `apps/web/src/app/[locale]/my-calendar/*` (does not render `EventCard`/`EventListView` — it's `WeeklyCalendarView`-based, confirmed via grep — out of scope by construction, not by choice); `apps/web/src/app/[locale]/archive/*` (confirmed real `EventListView` consumer but explicitly deferred — see Out of Scope).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.3b`] — this story's authoritative AC/Note text.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.3`, `_bmad-output/implementation-artifacts/4-3-report-an-event.md`] — the detail-view sibling story this one extends from; `ReportDialog`'s contract, the `EventDetailView` menu pattern this story ports, and its own "List-View Report Trigger Scope Decision"/"'Hidden From View' Scope Decision" Dev Notes.
- [Source: `_bmad-output/implementation-artifacts/4-3a-build-the-reports-backend-graphql-api-layer-and-personal-visibility-filtering.md`] — the `submitReport`/`REPORT_IGNORED`/`isHiddenForCurrentUser` contract this story's reused `ReportDialog` depends on; verified implemented (`packages/database/schema.ts`'s `reports` table, `apps/backend/src/schema/resolvers.ts`'s `submitReport` resolver both exist on disk).
- [Source: `_bmad-output/implementation-artifacts/4-3c-extend-default-event-visibility-rules-to-exclude-self-reported-events-from-list-views.md`] — the separate, already-`review`-status server-side mechanism that will exclude self-reported events from list queries by default on future page loads; this story's `useLocallyHiddenIds` only handles the *current, already-rendered* list without a refetch, it does not duplicate 4.3c's server-side filter.
- [Source: `packages/ui/src/features/events/EventCard.tsx`, `.types.ts`, `.test.tsx`] — existing Favorite-toggle/`statusBadge`/`pendingRemoval` slots and styling this story extends.
- [Source: `packages/ui/src/features/events/EventDetailView.tsx`] — the exact hand-rolled "more actions" menu shell (focus trap, keyboard, outside-click) this story ports into `EventCard`.
- [Source: `packages/ui/src/features/events/EventListView.tsx`, `.types.ts`] — confirmed generic `getCardProps: (event) => Partial<EventCardProps>` pass-through already supports any new `EventCardProps` field with no changes needed.
- [Source: `packages/ui/src/hooks/useSoftDeleteWithUndo.ts`, `.types.ts`] — the existing, superficially-similar-but-wrong-fit hook (Story 0.18) this story deliberately does not reuse; source of "Why Not `useSoftDeleteWithUndo`."
- [Source: `apps/web/src/app/[locale]/home-content.tsx`, `favorites/favorites-content.tsx`, `feed/feed-content.tsx`, `[platformSlug]/[accountId]/account-content.tsx`] — the four real `EventCard`/`EventListView` consumers verified via grep; existing `getCardProps`/session/login-modal/`toggleFavorite` patterns this story's wiring mirrors.
- [Source: `apps/web/src/app/[locale]/my-calendar/*`, `archive/archive-content.tsx`] — verified via grep: My Calendar does not render `EventCard`/`EventListView` at all (out of scope by construction); Archive does but is explicitly deferred (see Out of Scope).
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions and epic-level-sweep-mode guidance (source of this story running Gate 1/3 fresh rather than citing `epic-4-readiness.md`, since `4.3b` predates/postdates that sweep's `stories_covered` list).
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — confirmed `4.3b` is not in `stories_covered`, hence Gate 1/3 run fresh rather than cited.
- [Source: `_bmad-output/project-context.md#Code-Organization`] — reusable-hook placement rule (`packages/ui/src/hooks/`, source of Task 2's location); Code Organization (`packages/ui` domain-feature component placement).
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.9.2`] — "whether from Social Media Account Subscription or the main event discovery page, in list-view or detailed view" — the literal PRD text motivating this story and its page-scope decision.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Code Organization (`packages/ui/src/hooks/` for reusable hooks; `packages/ui/src/features/<domain>/` for domain components); UI Patterns & UX Invariants (no new loader category needed — reuses `ReportDialog`'s existing `BlockingLoader`); i18n (`next-intl`, `en`/`id` locale keys per page namespace); State Management Architecture (no `zustand` — page-local state only, matching the existing Favorites precedent).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-7 (`requireAuth`, already covered server-side by Story 4.3a; this story's login-modal branch is a UX-layer mirror only, not a second enforcement point); AD-5 (analytics — no new event needed, `event_reported` already fires inside the reused `ReportDialog` regardless of caller).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is a pure frontend change (no Lambda/SQS/EventBridge/API Gateway involvement), consistent with the Gate 1 finding above.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/ui/src/hooks/useLocallyHiddenIds.ts`; `packages/ui/src/hooks/useLocallyHiddenIds.types.ts`; `packages/ui/src/hooks/useLocallyHiddenIds.test.ts`.
- **Modified:** `packages/ui/src/features/events/EventCard.tsx`/`.types.ts`/`.test.tsx`; `packages/ui/src/hooks/index.ts`; `apps/web/src/app/[locale]/home-content.tsx` + `page.test.tsx`; `apps/web/src/app/[locale]/favorites/favorites-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/feed/feed-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` + `.test.tsx`; `apps/web/locales/en.json`/`id.json`; `apps/web/e2e/event-report.spec.ts`.
- **Not modified:** `apps/backend/*`; `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/web/src/features/events/report-dialog.tsx`; `apps/web/src/generated/graphql.ts`; `packages/ui/src/features/events/EventListView.tsx`; `apps/infrastructure`.

### Rule Mapping

- Story-split-gate discipline (Gate 1/3 run fresh since `4.3b` isn't in `epic-4-readiness.md`'s `stories_covered`; no gap found; Gate 2 run fresh via subagent — the placement decision itself is this story's core reason for existing) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings", "Gate 2 — Overflow Menu Placement Decision".
- "Leave the system working end-to-end, not just satisfy stated ACs" (unauthenticated-click and post-report list-behavior tradeoffs both surfaced and explicitly resolved via `AskUserQuestion`, not silently absorbed or dropped; verified `ReportDialog`/Story 4.3a are real implemented code, not just spec, before committing to a reuse-only plan) → Dev Notes "Unauthenticated-Click Scope Decision", "Post-Report List Behavior Decision", "Reuse, Not Extraction".
- Code Organization (`packages/ui/src/hooks/` for reusable hooks; `packages/ui` reusable components stay framework-agnostic) → Task 1 (`EventCard` change stays in `packages/ui`, no Radix/next-intl/GraphQL coupling); Task 2 (`useLocallyHiddenIds` placed in `packages/ui/src/hooks/`, not `packages/domain` — it's a React hook, not framework-agnostic pure logic).
- Reuse over reinvention (`EventDetailView`'s hand-rolled menu shell; `ReportDialog` reused unchanged rather than extracted or rebuilt; existing per-page login-modal/session patterns) → Task 1, Task 2 ("Why Not `useSoftDeleteWithUndo`"), Tasks 3–6.
- i18n (`next-intl`, `en`/`id`, no hardcoded strings) → Task 7.
- Testing Rules (integration-first "testing trophy," one E2E happy path, not four) → Task 8.

### Verification Plan

- `packages/ui`: `pnpm --filter @festgrid/ui test` — `EventCard.test.tsx` (extended) and `useLocallyHiddenIds.test.ts` (new) pass.
- `apps/web`: `pnpm --filter web test` — `page.test.tsx`, `favorites-content.test.tsx`, `feed-content.test.tsx`, `account-content.test.tsx` (all extended) pass; Playwright `event-report.spec.ts`'s list-view addition passes.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story adds the "more actions"/"Report" trigger to `EventCard` and wires it into exactly four pages (Discovery, Favorites, Feed, Account). It does **not** touch Archive or My Calendar (see Out of Scope), does not modify `ReportDialog`/Story 4.3a's backend, and does not build any new dialog/form UI.
- [ ] Architecture and boundary confirmation: `apps/backend` is not touched at all; the new `useLocallyHiddenIds` hook lives in `packages/ui/src/hooks/` (React-hook-appropriate location, not `packages/domain`); `packages/ui` gains no new external dependency (no Radix, no `next-intl`).
- [ ] Testing plan confirmation: integration tests (Vitest + Testing Library + `msw`) cover trigger render/click/dialog-open/unauth-branch/immediate-removal on all four wired pages; unit tests cover `useLocallyHiddenIds` and the extended `EventCard`; one Playwright E2E list-view happy path.
- [ ] **Unauthenticated-click behavior accepted:** confirm reusing the existing login modal (Discovery/Account) instead of a hard `/login` redirect, diverging from `epics.md`'s literal AC3 text — per the user's `AskUserQuestion` decision (Dev Notes "Unauthenticated-Click Scope Decision").
- [ ] **Post-report list behavior accepted:** confirm immediate, non-reversible removal via the new shared `useLocallyHiddenIds` hook (not per-page hand-rolled state, not a toast-only/wait-for-refetch approach) — per the user's `AskUserQuestion` decision (Dev Notes "Post-Report List Behavior Decision").
- [ ] **Page-wiring scope accepted:** confirm exactly Discovery, Favorites, Feed, and the Account page are wired (not Archive, not just Discovery+Account) — per the user's `AskUserQuestion` decision (Dev Notes "Project Structure Notes").
- [ ] **Overflow-menu placement accepted:** confirm the top-left/always-visible/opposite-corner-from-Favorite placement (Dev Notes "Gate 2 — Overflow Menu Placement Decision").
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 run fresh, no gap (Story 4.3/4.3a verified already implemented in the codebase, not just spec'd). Gate 2 run fresh via subagent — this story's own placement decision, resolved above, no further split needed.
- [ ] Dependency status confirmed: Story 4.3 (`ReportDialog`) and Story 4.3a (`submitReport`/`reports` table) are both verified **implemented in the codebase today** (not just `ready-for-dev` specs) — no sequencing blocker, unlike Story 4.3's own Pre-Coding Gate had to flag against 4.3a at the time it was written.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `packages/ui/src/features/events/EventCard.test.tsx` (extend): "more actions" trigger renders only when `onReport` passed; open/close/click/keyboard/outside-click behavior; coexists correctly with Favorite button; tab order.
- [ ] `packages/ui/src/hooks/useLocallyHiddenIds.test.ts` (new): `markHidden`/`isHidden`/`hiddenIds` behavior, hook-instance isolation.
- [ ] `apps/web/src/app/[locale]/page.test.tsx`, `favorites/favorites-content.test.tsx`, `feed/feed-content.test.tsx`, `[platformSlug]/[accountId]/account-content.test.tsx` (extend): trigger renders on cards; click opens `ReportDialog` (authenticated) or the login modal (unauthenticated, Discovery/Account only); successful/`REPORT_IGNORED` `onReported` removes the event from the rendered list without a refetch.
- [ ] E2E: `apps/web/e2e/event-report.spec.ts` (extend) — Discovery list-view happy path: open a card's "more actions" menu, click "Report", submit, assert the card no longer renders.

## Deliverables Checklist

- [ ] `packages/ui/src/features/events/EventCard.tsx`/`.types.ts`: "more actions"/"Report" trigger implemented, tested.
- [ ] `packages/ui/src/hooks/useLocallyHiddenIds.ts`/`.types.ts`: implemented, unit-tested, exported.
- [ ] `apps/web/src/app/[locale]/home-content.tsx`: wired, tested.
- [ ] `apps/web/src/app/[locale]/favorites/favorites-content.tsx`: wired, tested.
- [ ] `apps/web/src/app/[locale]/feed/feed-content.tsx`: wired, tested.
- [ ] `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx`: wired, tested.
- [ ] `apps/web/locales/en.json`/`id.json`: all 8 new keys added for both locales.
- [ ] `apps/web/e2e/event-report.spec.ts`: list-view happy path passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

## Out of Scope

- Archive page (`apps/web/src/app/[locale]/archive/archive-content.tsx`) — a confirmed real `EventCard`/`EventListView` consumer, but deliberately not wired in this pass per the user's `AskUserQuestion` decision (chose the 4-page "Discovery, Favorites, Feed, Account" scope over the 5-page "include Archive" option). Can be wired later with the same pattern this story establishes if requested.
- My Calendar (`apps/web/src/app/[locale]/my-calendar/`) — does not render `EventCard`/`EventListView` at all (it's `WeeklyCalendarView`-based); out of scope by construction, not by choice. `epics.md`'s own "As a" framing names it, but that framing doesn't match the actual current implementation.
- Story 4.3's `ReportDialog`, `submitReport` mutation, and detail-view "hidden from you" state — already implemented by Story 4.3/4.3a; this story only reuses them unchanged.
- Story 4.3c's server-side default-visibility exclusion of self-reported events from list *queries* — a separate mechanism (already `review` status) that governs future page loads/refetches; this story's `useLocallyHiddenIds` only governs the currently-rendered list without a refetch.
- A hard `/login` redirect for unauthenticated list-view Report clicks — deliberately not built; the existing login modal is reused instead (Dev Notes "Unauthenticated-Click Scope Decision").
- Refactoring Favorites' existing `unfavoritedIds`/`pendingRemoval` optimistic-unfavorite logic onto `useLocallyHiddenIds` or `useSoftDeleteWithUndo` — that mechanism is reversible (Undo-capable) and functions correctly today; not touched by this story.

## Definition of Done

- [ ] All 6 Acceptance Criteria satisfied.
- [ ] `EventCard.test.tsx`, `useLocallyHiddenIds.test.ts`, and all four extended page test files passing.
- [ ] `event-report.spec.ts`'s list-view E2E addition passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] `en.json`/`id.json` updated with all 8 new keys across the four page namespaces.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
