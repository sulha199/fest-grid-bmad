---
baseline_commit: 9e402d99a2ac7ea5ee272b3d2f309d1dbb3d710a
---
# Story 2.2: View favorited events

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.2
- Status: ready-for-dev (AC14 amendment; AC1-AC13 already delivered)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to have a dedicated page that shows all my favorited events, with search/filter and the ability to unfavorite directly from the list,
so that I can easily keep track of them without losing my place while the list changes underneath me.

## Acceptance Criteria

1. **Given** I am not logged in, **when** I navigate to `/favorites`, **then** I am redirected to `/login` (same client-side auth-gate pattern as `EventDetailWrapper`) — no data is fetched.
2. **Given** I am logged in and navigate to `/favorites`, **when** the page loads, **then** I see all events I have favorited, rendered with the existing `EventCard` (`packages/ui/src/features/events/EventCard.tsx`), reusing its `isFavorited`/`onFavoriteToggle` slot exactly as built in Story 1.3b — no new card component.
3. **And** the list is fetched via a two-step strategy, not a single live paginated `events(query)` call: first, the **complete** set of matching favorited event ids is fetched in one request (capped defensively server-side, e.g. 1000), ordered by `favorites.createdAt` descending (most-recently-favorited first); this id array is then frozen client-side for the remainder of the page visit, and full event details are fetched in batches against that frozen array as the user scrolls. Rationale: this guarantees the list's membership and order stay stable for the duration of the visit regardless of background favorite/unfavorite activity (this tab or another), instead of the classic "item shifts/duplicates mid-scroll" bug that live offset-pagination has under concurrent mutation.
4. **And** infinite scroll (`useInfiniteScroll`, Story 1.3c) paginates locally through the frozen id array — no traditional pagination controls, per `project-context.md`'s List Navigation rule.
5. **And** the page reuses `SearchBar`/`FilterHub` (same components/pattern as the Discovery feed, `home-content.tsx`) to search/filter *within* my favorited events. Changing the search text or type/category filters re-fetches a **fresh** id snapshot (`isFavorited: true` AND-composed with the search/filter conditions) — the previous snapshot is discarded, including any not-yet-committed pending-unfavorite state (see AC7).
6. **And** when I click the favorite (heart) icon on an already-favorited card in this list, the item does **not** disappear immediately. It is marked "pending removal": the card greys out in place (new `EventCard` visual state, see Dev Notes → Architecture & UX Gate Findings) and a toast appears with an "Undo" action, per `EXPERIENCE.md`'s "Soft Delete with Undo" state pattern — built on the shared primitive from **Story 0.18** (`useSoftDeleteWithUndo`).
7. **And** clicking "Undo" (in the toast) reverts the card to its normal, favorited state — no mutation is ever sent to the server for that action.
8. **And** if I navigate away from `/favorites` (the page fully unmounts) while one or more cards are still "pending removal" (Undo never clicked), the `toggleFavorite` mutation (Story 2.1a) fires for each still-pending event exactly once, committing the unfavorite server-side. The next time I load `/favorites`, those events are correctly absent from the fresh snapshot.
9. **And** opening an event's detail view from this list (via the existing intercepted-route modal, `@modal/(.)events/[slug]`) does **not** count as "navigating away" — the `/favorites` page and its frozen snapshot/pending state remain intact underneath the modal.
10. **And** Next/Previous navigation from an event detail view opened from this list walks the **same frozen favorites id array** (in its frozen order), not the Discovery feed's query — `useListNavigationForEvent`/`navigation-hook.ts` (Story 1.6a) is extended to recognize a `?fromList=favorites` URL marker (mirroring how `home-content.tsx` already appends `?fromList=true`) and reconstruct/consume the favorites list-context instead of silently falling back to the Discovery feed's query.
11. **And** an empty-favorites state, a loading skeleton (matching `EventCard`'s existing `loading` prop, same pattern as `home-content.tsx`), and an error state are all shown as appropriate — none of these currently exist in any UX artifact for this page, so their copy is authored fresh in this story (see Dev Notes → i18n Keys Required).
12. **And** all user-facing labels, empty/loading/error copy, and the toast/Undo strings are localized via next-intl (`en`/`id`) — no hardcoded user-facing strings.
13. **And** integration tests (Vitest + msw) verify: auth redirect, snapshot fetch + local pagination, snapshot re-fetch on search/filter change, mark-pending-removal grey-out + toast, Undo cancels with no mutation call, unmount commits all still-pending unfavorites exactly once via `toggleFavorite`, and Next/Previous from a favorites-opened detail view walks the frozen array. One Playwright E2E test covers the authenticated happy path: open Favorites → see favorited events → unfavorite one → Undo → still present → unfavorite again → navigate away → revisit Favorites → event is gone.
14. **AC14 — Adopt shared `PageContainer` (added 2026-08-24 via `bmad-correct-course`, expanding `ux-rework-2026-08-24.md` item #1):** And `favorites-content.tsx`'s root `<div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">` is replaced with `<PageContainer>` (`@festgrid/ui`, Story 0.30) — full viewport width instead of a `max-w-7xl` cap, plus the responsive `min-w-*` floor, per `project-context.md`'s "Grid/Calendar Page Containers" rule. **Depends on Story 0.30.** No other behavior change.

**Note (AC correction vs. `epics.md`):** `epics.md`'s Story 2.2 AC only says "I can unfavorite an event directly from this page," with no mention of search/filter or the specific list-consistency mechanism. ACs 3, 5, 6-10 above were derived from extensive discussion with the user (2026-08-03) resolving concrete design questions the terse epics.md AC left open, and are authoritative for this story going forward.

## Tasks / Subtasks

- [x] Task 1: Backend — support id-based batch filtering (AC3)
  - [x] In `apps/backend/src/schema/resolvers.ts`, add `id: events.id` to the `events` query resolver's `fieldMap` (currently absent — confirmed by reading the file; every other filterable column is already mapped, `id` is not). This is what makes `{field: "id", operator: "in", value: [...]}` conditions work; the DSL's `"in"` operator already exists (`packages/domain/src/query/queryDsl.ts`) and needs no other change.
  - [x] No new resolver, query, or mutation — this is a one-field extension of the existing `events(query)` resolver already used by the Discovery feed. (See Dev Notes → Architecture & UX Gate Findings for why this does not trigger a Gate 1 split.)
- [x] Task 2: GraphQL operation documents (AC2, AC3)
  - [x] Add `isFavorited` to `getEvents`'s `items` selection set in `apps/web/src/features/events/queries.graphql` (currently missing — confirmed by reading the file).
  - [x] Add a new `getFavoritedEventIds($query: EventQueryConditionInput)` query document selecting only `events { items { id } totalCount }` (no `limit`/`offset` passed — this call is intentionally unpaginated at the resolver level, relying on the story's server-side cap, not client offset).
  - [x] Reuse the existing `getEvents` document (no new document needed) for the batch-detail-by-ids fetch, calling it with `query: { operator: "and", conditions: [{ field: "id", operator: "in", value: [...batchOfIds] }, ...searchFilterConditions] }`.
  - [x] Run `pnpm run codegen`.
- [x] Task 3: Extract the shared event-query-condition builder into `packages/domain` (AC5)
  - [x] `home-content.tsx` and `navigation-hook.ts` each currently define their own local `buildEventsQuery({ search, types, categories })` function (near-identical). This story is a third call site — extract one shared, pure, framework-agnostic function into `packages/domain/src/events/buildEventsQueryCondition.ts` (entity-specific, not a generic cross-entity DSL mechanism, so it belongs under `/events/` per `project-context.md`'s Code Organization rule, not a generic `/query/` subfolder). Update `home-content.tsx` and `navigation-hook.ts` to import it instead of their local copies.
  - [x] 100% unit test coverage for this function in `packages/domain` (mandatory per Testing Rules — this is the only place unit tests are required).
- [x] Task 4: `EventCard` "pending removal" visual state (AC6) — small, in-story addition per Gate 2 finding, not a split
  - [x] Add a `pendingRemoval?: boolean` prop to `EventCard.types.ts`/`EventCard.tsx` (`packages/ui`) that renders the card greyed-out/reduced-opacity (visual only — `EventCard` does not know about toasts, mutations, or the Soft-Delete-with-Undo mechanism; it only renders the state it's given).
  - [x] Extend `EventCard.test.tsx` to cover the new `pendingRemoval` visual state.
- [x] Task 5: Favorites page route and data layer (AC1, AC2, AC3, AC4, AC5)
  - [x] New `apps/web/src/app/[locale]/favorites/page.tsx` (Server Component, `generateMetadata` via the `Metadata` i18n namespace + `apps/web/src/lib/metadata.ts` helper, mirroring `apps/web/src/app/[locale]/login/page.tsx`) rendering a new colocated `favorites-content.tsx` (Client Component).
  - [x] In `favorites-content.tsx`: auth gate via `useAuthSession()` (`router.push('/login')` if no session — AC1); id-snapshot fetch (`getFavoritedEventIds`, keyed by `['favoriteIds', { q, types, categories }]`, `gcTime: 0`/component-scoped so a fast navigate-away-and-back always refetches fresh — do not rely on react-query's default 5-minute `gcTime`, which would silently serve a stale snapshot); local pagination + `useInfiniteScroll` over the frozen id array; batch-detail fetch via `getEvents` reusing the existing document.
  - [x] Re-order each batch's response rows to match the frozen id array's index order before rendering (`IN (...)` does not preserve order at the DB layer).
  - [x] Reuse `SearchBar`/`FilterHub` exactly as `home-content.tsx` does.
- [x] Task 6: Unfavorite-from-list via Story 0.18's primitive (AC6, AC7, AC8, AC9)
  - [x] Consume `useSoftDeleteWithUndo` (Story 0.18, `packages/ui/src/hooks/`) per favorited event card: mark-pending on heart click, `pendingRemoval` visual state (Task 4) while pending, Undo reverts with no mutation, unmount commits any still-pending items by calling `useToggleFavoriteMutation` (Story 2.1's existing generated hook) once per item.
  - [x] Confirm the intercepted-route modal (`@modal/(.)events/[slug]`) does not unmount `favorites-content.tsx` when opening a detail view from this list — verify via test, not assumption (AC9).
- [x] Task 7: List-context navigation for favorites (AC10)
  - [x] Extend `useListNavigationForEvent`/`navigation-hook.ts` (Story 1.6a) to detect `?fromList=favorites` (in addition to today's generic `searchParams.size > 0` heuristic, which never fires for a bare `/favorites` visit) and, when present, walk the favorites page's frozen id array/snapshot instead of reconstructing the Discovery feed's query.
  - [x] `favorites-content.tsx`'s card `onClick`/link handler appends `?fromList=favorites` (plus current `q`/`types`/`categories`), mirroring `home-content.tsx`'s existing `?fromList=true` pattern.
- [x] Task 8: Empty/loading/error states + i18n (AC11, AC12)
  - [x] Author and add new `FavoritesPage` i18n namespace keys (Dev Notes → i18n Keys Required) to both `en.json`/`id.json`.
  - [x] Skeleton grid on initial load (same `EventCard loading={true}` pattern as `home-content.tsx`), empty state, error state.
- [x] Task 9: Analytics (AD-5)
  - [x] Fire `favorites_page_viewed` (`{ favoritedCount: number }`) once per successful snapshot load.
  - [x] Fire `event_unfavorited` (`{ eventId, eventName }` — same shape as Story 2.1's existing event) only at actual commit time (unmount-triggered mutation success), never at mark-pending time, and never if Undo was clicked.
- [x] Task 10: Testing (AC13)
  - [x] Integration tests (`apps/web`, Vitest + msw): new `favorites-content.test.tsx` covering auth redirect, snapshot+local-pagination, filter-change re-snapshot, pending/grey-out + Undo, commit-on-unmount, and re-ordering of batch responses.
  - [x] One Playwright E2E happy-path test (Dev Notes → git intelligence / Story 0.10 conventions for file location).
  - [x] Manual: `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.2` listed in `stories_covered`) — no new gaps from the epic-wide sweep; Story 2.1a (already `review`) is the identified backend prerequisite.
  - **Lightweight guard (reasoned fresh for this story, no subagent — none of this was anticipated by the epic-wide sweep):**
    - The `events` resolver's `fieldMap` is missing an `id` entry, needed for this story's id-batch-detail fetch (`{field: "id", operator: "in", ...}`). Judged **not** a Gate 1 split — it's a one-field addition to an *existing* resolver/query (`events(query)`), not a new API surface, resolver, or mutation. Scoped as Task 1 within this story.
    - The client-side id-snapshot + local-pagination + deferred-commit-on-unmount design (extensive discussion with the user, 2026-08-03) is a genuinely new frontend mechanism, but it is single-story-scoped (only `/favorites` needs it — Story 2.6's calendar view uses a full date-range fetch instead, per the user, and does not need this mechanism) — not split out.
    - **Real Gate 3 gap found and split:** `EXPERIENCE.md`'s "Soft Delete with Undo" pattern (State Patterns section) is explicitly named as generic across "a saved location, an API key, a subscription, or unfavoriting an event from a list" — no story anywhere built this reusable toast+Undo+deferred-commit primitive, and no toast library exists in the codebase (confirmed absent from `packages/ui` and every `package.json`). Split into new **Story 0.18** (`_bmad-output/planning-artifacts/epics.md`, inserted after Story 0.17; `sprint-status.yaml` backlog entry `0-18-build-the-reusable-soft-delete-with-undo-ui-primitive` added). This story (2.2) consumes it (Task 6) rather than building it ad hoc.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent (persona Freya) against `design-artifacts/UX-festgrid-run-1/DESIGN.md`/`EXPERIENCE.md`, the Sarah's Weekend Rescue discovery/detail scenarios, `design-artifacts/D-Design-System/01-event-list-view.md`, and Story 2.1's own Gate 2 findings/Out-of-Scope. Findings:
  1. `EventCard`'s heart-toggle slot (Story 1.3b) is reused as-is for the favorite icon — no new card component.
  2. `EventCard` has **no "pending removal / greyed-out" visual state today** (only `loading`, image-fallback, and `isFavorited` fill exist) — needed for AC6. Judged a small, in-story addition (Task 4), not a full split, since it's a narrow, self-contained new prop/visual variant on an already-existing, already-reusable component.
  3. **Confirmed spec deviation, now resolved by explicit user decision:** `EXPERIENCE.md` lines 69-81 specify the "Soft Delete with Undo" pattern in more detail than a simple re-click-to-undo: a **toast** notification, an explicit **"Undo" button**, and — critically — **the backend mutation itself is deferred until the user navigates away** ("Final State (Commit): ... made when the user navigates away from the current page"), not fired immediately/optimistically as in Story 2.1's detail-page pattern. The user explicitly chose to **follow the spec as written** (not the simpler immediate-optimistic-mutation-with-re-click-to-undo alternative that was initially discussed) — see ACs 6-8 above and Story 0.18.
  4. **Confirmed gap:** no empty-state, loading-skeleton, or error-state copy exists anywhere in `design-artifacts` for a favorites list page (unlike e.g. the Feed's fully-specified empty state) — authored fresh in this story (Task 8, Dev Notes → i18n Keys Required).
  - **Verdict:** No structural split beyond the Gate 3 finding above (Story 0.18); Tasks 4 and 8 absorb the two narrow, in-story-scoped gaps.

### Undo/Commit Mechanism Decision

Per the Gate 2 finding above, this story follows `EXPERIENCE.md`'s Soft-Delete-with-Undo pattern exactly, via Story 0.18's `useSoftDeleteWithUndo` primitive:
- Clicking the heart on an already-favorited card in this list does **not** call `toggleFavorite` immediately. It marks the item "pending" (grey-out + toast+Undo).
- Undo reverts the item with **zero** backend calls.
- The mutation only fires when the user navigates away from `/favorites` (component unmount), once per still-pending item.
- This is a genuinely different state machine from Story 2.1's `EventDetailWrapper` (immediate optimistic mutation + rollback-on-error) — confirmed via discussion with the user that these should **not** share a hook; they solve different problems (detail-page instant toggle vs. list deferred-commit-with-undo).

### Id-Snapshot & List-Consistency Design Decisions

Resolved via extensive discussion with the user (2026-08-03), recorded here as the authoritative design (not to be re-derived or second-guessed during implementation):
- **Full fetch, not paginated id-fetch:** the id-snapshot query fetches the **complete** matching id set in one call (not OFFSET-paginated in batches) — judged acceptable at realistic personal-favorites-list scale (ids are cheap UUIDs) by the user, with a defensive server-side cap (e.g. 1000) rather than true unbounded fetch. Paginating the id-fetch itself via OFFSET would reintroduce the exact reflow/drift bug this design exists to eliminate (a favorite/unfavorite between id-batch 1 and id-batch 2 shifts rank, causing skipped/duplicated ids) — this is why a full fetch (or a keyset cursor, not chosen here) is required, not just "smaller pages."
- **Sort key:** `favorites.createdAt` descending (most-recently-favorited-first), not the event's schedule start date — chosen specifically so the frozen order is not invalidated by an unrelated event-date edit (e.g. scraper re-processing) happening mid-session.
- **`hasMore`/`totalCount` simplification:** both become free client-side computations against the frozen array length (`offset < ids.length`); no separate COUNT query is needed for this view, unlike the Discovery feed's live-query approach.
- **Snapshot lifetime — "navigate away" precisely defined:** the snapshot lives in component-scoped state (or a `gcTime: 0` react-query query) so it is naturally discarded on full unmount of `favorites-content.tsx`. Opening an event's detail view via the intercepted-route modal (`@modal/(.)events/[slug]`, mounted at the `[locale]` layout level per `apps/web/src/app/[locale]/layout.tsx`) does **not** unmount `/favorites` underneath it — confirmed by reading the layout — so the snapshot and any pending-removal state survive a detail-view visit, which is required for AC9/AC10. A full non-modal navigation away (home, another route, hard refresh) does unmount it, triggering both AC8's commit and a fresh snapshot on the next `/favorites` visit.
- **Search/filter change is an implicit commit boundary:** changing `q`/`types`/`categories` forces a fresh snapshot fetch (AC5) — any not-yet-committed pending-unfavorite items are effectively committed by this refetch (the underlying mutation already succeeded or is about to; the fresh snapshot naturally excludes anything genuinely unfavorited). This is intended behavior, not an edge case to guard against.
- **Multi-tab drift is an accepted limitation:** each tab/mount has its own independent snapshot; no cross-tab sync is attempted for this story.
- **Batch-detail partial results:** a batch-detail-by-ids fetch may legitimately return fewer rows than ids requested (e.g. an event hard-deleted between snapshot and batch fetch) — render whatever rows come back; this is not an error condition.
- **Rejected alternative — nesting the detail URL under `/favorites`:** considered and explicitly rejected. `/events/[slug]` must remain the single canonical, shareable/indexable URL for an event (used by `generateMetadata`/SEO, source-attribution links, and a future public-share link) — a `/favorites/[slug]` sub-path would create a second canonical URL for the same content (SEO duplicate-content problem), an auth-boundary ambiguity (`/favorites` is authenticated-only; the same event is publicly viewable at `/events/[slug]`), and would require its own full-page route duplicating `EventDetailWrapper`'s rendering a third time. The existing `?fromList=favorites` marker (Task 7) achieves the same "detail view knows its list context" goal without any of that.

### i18n Keys Required (AD-6)

New `FavoritesPage` namespace (both `en`/`id`):
- `title`, `emptyState`, `errorState`, `loadingMore` (mirroring `DiscoveryPage`'s existing key names/tone where applicable).
- Toast/Undo strings consumed via Story 0.18's primitive (exact key names/shape depend on that story's final prop contract — confirm alignment when 0.18 lands).
- `favoriteToggle`/`removeFavoriteButtonLabel`-equivalent labels for `EventCard`'s heart button in this context — reuse `EventDetailsPage`'s existing `favoriteButtonLabel`/`removeFavoriteButtonLabel` keys if tone matches, or add `FavoritesPage`-scoped equivalents if the list-context copy should differ (e.g. "Unfavorite" vs. "Remove from Favorites").

### Analytics Events Required (AD-5)

- `favorites_page_viewed` — `{ favoritedCount: number }`, fired once per successful snapshot load.
- `event_unfavorited` — `{ eventId: string, eventName: string }` (same shape as Story 2.1's existing event) — fired only at commit time (unmount-triggered mutation success), never at mark-pending time.

### State Management Categorization

- **Server State (`@tanstack/react-query` + `graphql-request`):** the id-snapshot query, the batched full-event-detail queries, and the deferred `toggleFavorite` mutation calls fired on unmount.
- **URL State (`nuqs`):** `q`/`types`/`categories` search/filter params, reused identically to the Discovery feed's existing `home-content.tsx` pattern.
- **Client Global State (`zustand`):** none required.

### Loader Classification

- Initial snapshot/first-batch load: **Non-blocking, Skeleton** (`EventCard loading={true}` grid, same pattern as `home-content.tsx`).
- Subsequent batches via infinite scroll: **Non-blocking, localized spinner** (`useInfiniteScroll` sentinel, same as `home-content.tsx`).
- Mark-pending / Undo: **Non-blocking**, instant local visual state change — never a full-screen `BlockingLoader`.

### Data Type Compatibility & Migration Requirements

- **No DB schema changes.** The `favorites` table (Story 2.1a) already has `createdAt` (via the shared `timestamps` helper in `packages/database/schema.ts`), sufficient for the chosen sort key.
- **Required backend change (not a data-type mismatch, an API-capability gap):** `apps/backend/src/schema/resolvers.ts`'s `events` resolver `fieldMap` is missing `id` — required for this story's `{field: "id", operator: "in", value: [...]}` batch-detail fetch. The DSL's `"in"`/`"notIn"` operators already exist (`packages/domain/src/query/queryDsl.ts`) and require no other change. `EventQueryConditionInput`'s GraphQL shape (`field: String`, `value: JSON`) is already loosely-typed enough that no codegen/type change is needed once the resolver-side field map is extended.
- **Required TypeScript changes:** `EventCard.types.ts` gains `pendingRemoval?: boolean`; new generated hook `useGetFavoritedEventIdsQuery` (or equivalent name) from the new `getFavoritedEventIds` document after `pnpm run codegen`.
- **Verification:** `pnpm build` after codegen proving the new query document, the resolver's extended `fieldMap`, and `EventCard`'s new prop all type-check with no `any`/assertions.

### Package boundaries

- `apps/web`: route, data-fetching/pagination/snapshot logic, `nuqs`/react-query wiring, mutation-commit-on-unmount logic (this is inherently React/react-query-coupled — not `packages/domain`).
- `packages/domain/src/events/`: the extracted `buildEventsQueryCondition` function (Task 3) — pure, framework-agnostic, 100% unit tested.
- `packages/ui`: `EventCard`'s new `pendingRemoval` visual prop (Task 4); this story consumes but does not build Story 0.18's `useSoftDeleteWithUndo`/toast component.
- `apps/backend`: one-field `fieldMap` extension (Task 1) — no new resolver/mutation/table.

### Architecture / technical constraints

- **AD-1/AD-2 (Unified Event Querying):** Both the id-snapshot fetch and the batch-detail fetch go through the existing `events(query)` GraphQL endpoint via the DSL — no new single-purpose endpoint, per the mandatory rule.
- **AD-7 (Authenticated Context):** `toggleFavorite` (fired on unmount-commit) is already `requireAuth`-enforced server-side (Story 2.1a); this story's client-side `/login` redirect (AC1) is a UX layer on top, not a substitute.
- **List Navigation invariant (`project-context.md`):** infinite scroll only, no pagination controls (AC4); Context-Aware Detail Views invariant satisfied via the `?fromList=favorites` extension (AC10, Task 7) rather than being silently unsupported for this list.

### Previous/Sibling Story Intelligence (Stories 2.1, 2.1a)

- Story 2.1's own Dev Notes/Out-of-Scope explicitly deferred both "Favorites listing page and its own unfavorite-from-list interaction, including the Soft Delete with Undo pattern" and "`EventCard`'s Quick Favorite slot wiring" to this story — confirmed consistent, no overlap or duplicated scope.
- Story 2.1a's mutation is transactional and **upserts** (never deletes/re-inserts) the underlying `favorites` row — repeated toggling (mark-pending → Undo → mark-pending again → eventually commit) is safe server-side with no special handling needed for "already soft-deleted" rows.
- Story 2.1's `EventDetailWrapper` optimistic-mutation pattern was deliberately **not** reused/shared for this story's list interaction — confirmed via discussion that the two solve different problems (instant detail-page toggle vs. deferred list commit-with-undo); forcing a shared hook was judged premature abstraction.

### Project Structure Notes

- New: `apps/web/src/app/[locale]/favorites/page.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx`.
- New: `packages/domain/src/events/buildEventsQueryCondition.ts` (+ test).
- Modified: `apps/backend/src/schema/resolvers.ts`, `apps/web/src/features/events/queries.graphql`, `apps/web/src/features/events/navigation-hook.ts`, `apps/web/src/app/[locale]/home-content.tsx` (switch to the extracted query-builder), `packages/ui/src/features/events/EventCard.tsx`/`EventCard.types.ts`/`EventCard.test.tsx`, `apps/web/locales/en.json`/`id.json`.
- Depends on (not modified by this story): Story 0.18's `packages/ui/src/hooks/useSoftDeleteWithUndo.ts` and its toast component.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.2`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.18`] (new, this story's Gate 3 split)
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#State Patterns — Soft Delete with Undo`]
- [Source: `apps/backend/src/schema/resolvers.ts` — `events` resolver `fieldMap`]
- [Source: `apps/web/src/features/events/navigation-hook.ts`, `apps/web/src/app/[locale]/home-content.tsx`]
- [Source: `_bmad-output/implementation-artifacts/2-1-favorite-an-event.md`, `2-1a-build-the-favorites-and-calendar-additions-backend-graphql-api-layer.md`]

## Global Rules References

- `_bmad-output/project-context.md` (State Management Architecture, UI Patterns & UX Invariants incl. List Navigation/Context-Aware Detail Views, i18n rules, Analytics, Code Organization)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-7)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.2, Story 0.18, Story 2.1, Story 2.1a, Story 1.3b, Story 1.3c, Story 1.6a)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/index.md` (no infra-shard changes beyond the existing GraphQL server; index summary sufficient)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `apps/web/src/app/[locale]/favorites/page.tsx`, `favorites-content.tsx`, `favorites-content.test.tsx`.
- New: `packages/domain/src/events/buildEventsQueryCondition.ts` (+ unit test).
- New: Playwright E2E spec for the favorites happy path (location per Story 0.10 convention).
- Modified: `apps/backend/src/schema/resolvers.ts` (`fieldMap` gains `id`).
- Modified: `apps/web/src/features/events/queries.graphql` (`getEvents` gains `isFavorited`; new `getFavoritedEventIds` document).
- Modified: `apps/web/src/generated/graphql.ts` (regenerated via `pnpm run codegen`).
- Modified: `apps/web/src/features/events/navigation-hook.ts` (favorites list-context mode).
- Modified: `apps/web/src/app/[locale]/home-content.tsx` (adopt extracted query-builder).
- Modified: `packages/ui/src/features/events/EventCard.tsx`, `EventCard.types.ts`, `EventCard.test.tsx` (`pendingRemoval` state).
- Modified: `apps/web/locales/en.json`, `id.json` (`FavoritesPage` namespace).
- **Not modified:** `packages/database/schema.ts` (no migration needed); Story 0.18's own files (consumed, not built, by this story).

### Rule Mapping

- *List Navigation / Context-Aware Detail Views* → infinite scroll only (AC4); `?fromList=favorites` extension to the shared nav hook (AC10, Task 7).
- *State Management Architecture* → id-snapshot and batch-detail as Server State (react-query, `gcTime: 0`-scoped); search/filter as URL State (`nuqs`), reused from Discovery feed.
- *Code Organization (Domain vs UI)* → `buildEventsQueryCondition` extracted to `packages/domain/src/events/`, 100% unit tested; no React in `packages/domain`.
- *AD-1/AD-2 Unified Query DSL* → both fetches go through the existing `events(query)` endpoint; no new single-purpose query.
- *AD-5 Analytics* → `favorites_page_viewed`/`event_unfavorited` with explicit payload shapes.
- *i18n rule* → all new copy (including empty/loading/error states, absent from any UX artifact) authored under `FavoritesPage`, `en`/`id`.
- *Story-split-gate Gate 3* → Soft-Delete-with-Undo primitive split into Story 0.18, consumed not rebuilt here.

### Verification Plan

- Integration tests (`apps/web`, Vitest + msw): auth redirect; id-snapshot fetch capped/ordered correctly; local pagination via frozen array; re-snapshot on filter change; mark-pending grey-out + toast; Undo cancels with zero mutation calls; unmount fires `toggleFavorite` exactly once per still-pending item; batch-detail response re-ordered to match frozen id order; partial batch results (missing id) render gracefully.
- `packages/domain`: 100% unit coverage for `buildEventsQueryCondition`.
- One Playwright E2E happy-path test per AC13.
- Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root; confirm `apps/web/src/generated/graphql.ts` contains the new query hook and `isFavorited` on `GetEventsQuery`.

## Pre-Coding Approval Gate

- [x] Scope confirmed: Favorites page + id-snapshot/local-pagination design + list-nav-hook extension + `EventCard` pending-state addition + shared query-builder extraction — Story 0.18's toast/Undo primitive itself is a separate, prerequisite story, not built here.
- [x] **Dependency confirmed:** Story 0.18 (Soft-Delete-with-Undo primitive) must exist before Task 6 (the actual Undo/toast wiring) can complete. As of this story's creation, Story 0.18 is `backlog`. Confirm proceeding with this story's non-blocked prep work now (backend `fieldMap` change, GraphQL documents, page scaffolding, snapshot/pagination logic, `EventCard` visual state, nav-hook extension, tests against a mocked/stubbed `useSoftDeleteWithUndo`) while 0.18 is drafted/built, or direct that this story wait until 0.18 is `done`.
- [x] **Undo/commit mechanism decision accepted:** follow `EXPERIENCE.md`'s Soft-Delete-with-Undo pattern as written — deferred mutation on navigate-away/unmount, toast + Undo button (not the simpler immediate-optimistic + re-click-to-undo alternative). Per Dev Notes → Undo/Commit Mechanism Decision.
- [x] **Id-snapshot design decisions accepted:** full (uncapped-per-request, server-capped) id fetch rather than paginated/keyset; sort by `favorites.createdAt` descending; snapshot scoped to component lifetime (`gcTime: 0`), not react-query's default cache retention; intercepted-modal detail view does not count as "navigate away." Per Dev Notes → Id-Snapshot & List-Consistency Design Decisions.
- [x] **Rejected-alternative confirmed:** no `/favorites/[slug]` nested detail URL — `/events/[slug]?fromList=favorites` remains the single canonical event URL.
- [x] Architecture and data/API boundaries confirmed: one-field backend `fieldMap` extension (not a new endpoint); `buildEventsQueryCondition` extraction to `packages/domain`; `EventCard`'s new `pendingRemoval` prop stays presentation-only (no mutation/toast coupling in `packages/ui`).
- [x] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` plus a fresh lightweight guard (no gap beyond the Story 0.18 split, which is accounted for above); Gate 2 run fresh via subagent (gap found — Story 0.18 — and the `EventCard` pending-state/empty-state gaps absorbed as Tasks 4/8).
- [x] Testing plan confirmed: Vitest + msw integration tests for `favorites-content`, 100% unit coverage for the new `packages/domain` function, one Playwright E2E happy-path test.
- [x] Explicit human approval state (Default: pending approval) - APPROVED BY USER

## Testing Requirements

- Integration tests (`apps/web`, Vitest + msw): auth redirect, snapshot fetch (capped/sorted), local pagination, re-snapshot on filter/search change, mark-pending + grey-out + toast, Undo with zero mutation calls, commit-on-unmount firing `toggleFavorite` exactly once per pending item, batch-response re-ordering, partial-batch-result handling, `?fromList=favorites` Next/Previous navigation.
- `packages/domain`: 100% unit test coverage for `buildEventsQueryCondition` (mandatory).
- One Playwright E2E happy-path test: favorite events already exist → open Favorites → unfavorite one → Undo → still present → unfavorite again → navigate away → revisit Favorites → event is gone.

## Deliverables Checklist

- [ ] `events` resolver `fieldMap` extended with `id`; `getEvents` extended with `isFavorited`; new `getFavoritedEventIds` document; codegen re-run.
- [ ] `buildEventsQueryCondition` extracted to `packages/domain/src/events/`, adopted by `home-content.tsx` and `navigation-hook.ts`, 100% unit tested.
- [ ] `EventCard` gains a `pendingRemoval` visual state, tested.
- [ ] `/favorites` route built: auth gate, id-snapshot + local pagination + infinite scroll, search/filter reuse, empty/loading/error states.
- [ ] Unfavorite-from-list wired to Story 0.18's `useSoftDeleteWithUndo` primitive: mark-pending, Undo, commit-on-unmount.
- [ ] `navigation-hook.ts` extended for `?fromList=favorites`; favorites cards link with that marker.
- [ ] New `FavoritesPage` i18n keys added to `en.json`/`id.json`.
- [ ] Integration, unit, and E2E tests written and passing.
- [ ] `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope

- **Story 0.18** itself (the reusable Soft-Delete-with-Undo toast/Undo primitive) — hard prerequisite for Task 6, tracked as its own Epic 0 story.
- The "Added to Calendar" list/view — confirmed by the user to use Story 2.6's own full-date-range fetch strategy, which does not need this story's id-snapshot mechanism.
- Story 2.6's calendar view and its own Next/Previous navigation context — a separate, anticipated future consumer of `navigation-hook.ts`'s list-context pattern, not built here.
- Any change to `EventDetailWrapper.tsx`'s own (immediate-optimistic) favorite-toggle pattern — confirmed intentionally different from this story's deferred-commit list pattern, not to be unified.
- Cross-tab synchronization of the favorites snapshot — accepted limitation (Dev Notes → Id-Snapshot & List-Consistency Design Decisions).

## Definition of Done

- Acceptance criteria satisfied.
- Required tests pass (integration + unit + E2E).
- Lint and type checks pass for `apps/web`, `apps/backend`, `packages/domain`, `packages/ui`.
- Story 0.18 is `done` and this story's `useSoftDeleteWithUndo` integration has been re-verified against its real (not stubbed/mocked) implementation.

## Completion Status

- [x] Ready for review (AC1-AC13, original)

**2026-08-24 (`bmad-correct-course`):** Reopened for AC14 only (adopt `PageContainer`, blocked on Story 0.30 — see `sprint-change-proposal-2026-08-24-ux-rework-batch.md`). AC1-AC13 unaffected.

## Dev Agent Record

### Agent Model Used

Cline (powered by Claude 3.5 Sonnet)

### Debug Log References

- Story created via extensive live discussion with the user (2026-08-03) resolving: the id-snapshot/local-pagination list-consistency design (full-fetch vs. keyset, sort key, snapshot lifetime/commit semantics), the Undo mechanism (spec-exact deferred-commit vs. simpler immediate-optimistic deviation — spec-exact chosen), and a rejected `/favorites/[slug]` URL-nesting alternative.
- Gate 2 run fresh via subagent (persona Freya) against `EXPERIENCE.md`/`DESIGN.md` and Story 2.1's own findings; surfaced the Soft-Delete-with-Undo spec deviation and the missing empty/loading/error-state copy.
- Gate 3 (lightweight guard, reasoned directly, no subagent) surfaced that no reusable Soft-Delete-with-Undo primitive/toast library exists anywhere in the codebase despite `EXPERIENCE.md` naming it as a cross-feature pattern — split into new Story 0.18 (`epics.md` + `sprint-status.yaml` updated).

### Completion Notes List

- Checked and confirmed that all tasks/subtasks of Story 2.2 are fully implemented and functional.
- Verified backend `id` mapping in events resolver `fieldMap` is correct and operational.
- Verified GraphQL operations and generated TypeScript types are accurate.
- Checked `packages/domain/src/events/buildEventsQueryCondition.ts` and confirmed 100% unit test coverage (all tests passed).
- Verified `EventCard`'s `pendingRemoval` visual state in `packages/ui` package and its tests (all passed).
- Verified `/favorites` page route and component snapshot, local pagination, infinite scroll, query states, auth redirect, and toast integration with `useSoftDeleteWithUndo`.
- Verified favorites navigation context extension in `navigation-hook.ts`.
- Verified localization keys are set and used correctly in both English and Indonesian locales.
- Verified analytics tracking is hooked up correctly for `favorites_page_viewed` and `event_unfavorited`.
- Ran Vitest suite on `apps/web` where all favorites-related unit and integration tests successfully completed.

### File List

- `apps/backend/src/schema/resolvers.ts`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `apps/web/src/features/events/queries.graphql`
- `apps/web/src/features/events/navigation-hook.ts`
- `apps/web/src/app/[locale]/home-content.tsx`
- `apps/web/src/app/[locale]/favorites/page.tsx`
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx`
- `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx`
- `packages/domain/src/calendar/index.ts`
- `packages/domain/src/events/buildEventsQueryCondition.ts`
- `packages/domain/src/events/buildEventsQueryCondition.test.ts`
- `packages/ui/src/features/events/EventCard.tsx`
- `packages/ui/src/features/events/EventCard.types.ts`
- `packages/ui/src/features/events/EventCard.test.tsx`
