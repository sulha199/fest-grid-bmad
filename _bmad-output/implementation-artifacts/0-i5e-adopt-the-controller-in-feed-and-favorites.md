---
baseline_commit: 53d4e82
---

# Story 0.i5e: Adopt the controller in Feed/Favorites

## Story Details

- Epic: 0.i5 (Shared list-pagination and filter-state controller)
- Story ID: 0.i5e
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the Feed and Favorites event-list card views to use the shared `useListPaginationController` controller (built in Story 0.i5a, already adopted by Discovery in Story 0.i5b),
so that Feed and Favorites gain the same structurally-guaranteed filter-change-reset behavior Discovery has, epic-0.i5's ratchet (Story 0.i5z) can eventually cover every list surface, and IDEA-038 (extending the Today/Upcoming/All temporal filter to Feed/Favorites) has a controller to attach its committed value to, per AD-18 and EXPERIENCE.md's Temporal Filter section ("Each consuming page — `home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx` — owns the committed value via `useListPaginationController`").

## Acceptance Criteria

1. **Given** `apps/web/src/app/[locale]/feed/feed-content.tsx`'s card-view `useInfiniteQuery` (queryKey `["events", "feed", {...}]`, no local pagination `useState`, implicit reset relies on every filter field being remembered in the key), **when** this story ships, **then** `FeedContent` calls `useListPaginationController` with `filterKey: { q, types, categories, subscriptions: subscriptionsQuery, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter }` (the exact filter snapshot Story 1.3l establishes for this file — see Dev Notes' sequencing note) and `initialCursor: 0`, and `pagination.resetToken` is spliced into the query's `queryKey` as a new trailing element, alongside — not replacing — the existing filter object, exactly as Story 0.i5b did for Discovery's `home-content.tsx`.
2. **Given** `apps/web/src/app/[locale]/favorites/favorites-content.tsx` has TWO queries — a one-shot `idSnapshotData` snapshot (`useQuery`, queryKey `["favoriteIds", {...}]`, not itself paginated) and a paginated `favoriteEvents` query (`useInfiniteQuery`, queryKey `["favoriteEvents", { ids: frozenIds, ... }]`, client-side-sliced against `frozenIds` in batches of `PAGE_SIZE`) — **when** this story ships, **then** the controller is wired to the **`favoriteEvents` query only**: `FavoritesContent` calls `useListPaginationController` with `filterKey: { q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter }` (deliberately excluding `frozenIds` — see Dev Notes for why) and `initialCursor: 0`, and `pagination.resetToken` is spliced into `favoriteEvents`'s `queryKey` as a new trailing element. `idSnapshotData`'s own `queryKey` is left as-is (already correctly keyed on the same filter snapshot post-Story-1.3l) — it is not a pagination query and gets no controller involvement.
3. **Given** Favorites' local `unfavoritedIds` optimistic-toggle state (a card goes greyed-out/`pendingRemoval` with an undo toast on unfavorite, confirmed a moment later against the server response) and its existing `previousSnapshotKeyRef`/`snapshotQueryKey`-based `useEffect` that already clears `unfavoritedIds` on any `q`/`types`/`categories` change today, **when** this story ships, **then** that ad-hoc ref-comparison effect is replaced with one keyed on `pagination.resetToken` instead — `unfavoritedIds` is cleared (and any in-flight undo toast for an item in that set is implicitly superseded, since the list refetches and re-renders from fresh server data) every time `resetToken` changes, making the controller the single source of truth for "a filter change happened" rather than a second, parallel snapshot-key comparison. This is a deliberate, user-confirmed decision (via `AskUserQuestion` during story creation): a filter-driven reset **finalizes** any pending removal immediately rather than blocking/deferring the reset until the undo window closes.
4. **Given** both files' `useInfiniteQuery`'s own pagination-accumulation model (`initialPageParam`/`getNextPageParam`) and their `useInfiniteScroll` sentinel wiring, **when** this story ships, **then** both are left byte-for-byte unmodified — per Story 0.i5a's Dev Notes, the controller is not composed into `useInfiniteScroll`/`useInfiniteQuery` for infinite-scroll consumers, only the `resetToken`-into-`queryKey` integration pattern is used (matching Story 0.i5b, not Story 0.i5c's manual `goToNextPage`/`goToPrevPage`/`pageIndex` prev/next API, which does not apply to either of these infinite-scroll surfaces). `reportPageMeta` is not called by either page, matching 0.i5b's own precedent (only relevant for a prev/next-rendering consumer).
5. **Given** a filter change fires the controller's `onReset` callback on either page, **when** it fires, **then** the page calls `window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })` via `usePrefersReducedMotion` from `@festgrid/ui`, identical to Story 0.i5b's Discovery implementation. This is a deliberate scope decision (via `AskUserQuestion` during story creation): backlog `IDEA-035` (logged during Story 0.i5b as a "candidate" convention pending more `useListPaginationController` adopters) is extended to both Feed and Favorites now, but is **not** promoted to a binding `EXPERIENCE.md` rule by this story — `IDEA-035`'s note in `backlog.yaml` is updated to reflect 3-of-3 adopters now implementing it, still as a documented convention rather than a binding spec rule.
6. **And** Feed's/Favorites' `useToggleFavoriteMutation` cache-update calls (`queryClient.cancelQueries`/`setQueriesData` on Feed's `["events", "feed"]` prefix; Favorites' `setQueriesData` on `["favoriteEvents"]` prefix) continue to prefix-match correctly with `resetToken` appended as a new trailing `queryKey` element on the paginated query — verified, not just assumed, per Story 0.i5b's Task 2 precedent (a prefix match is structurally unaffected by a new trailing element, but Favorites' `unfavoritedIds`-clearing change (AC3) touches adjacent code in the same render path, so this must be re-confirmed here, not silently inherited from 0.i5b's own verification of a different file).
7. **Given** Story 1.3l (BUG-025 — wiring Feed/Favorites to real `useNearbyFilter()`/`useAIFilter()` state) is a hard prerequisite that changes both files' `filterKey`/`queryKey` shape (adding `nearby`/`aiFilter` fields) and is `ready-for-dev` (not yet built) as of this story's creation, **when** `bmad-dev-story` picks up this story, **then** it MUST first confirm Story 1.3l's status is `review` or `done` in `sprint-status.yaml` (per this project's standing "review-status prerequisites are safe to build against" rule) before starting implementation — building against 1.3l's pre-fix code would target `filterKey`/`queryKey` shapes this story's ACs describe as already including `nearby`/`aiFilter`, which do not exist until 1.3l lands. See Pre-Coding Approval Gate.
8. **And** `feed-content.test.tsx` and `favorites-content.test.tsx` (both already exist, already use the `useInfiniteScroll`-mock-with-`window.triggerScroll()` pattern established by `home-content.test.tsx`) are extended with: (a) a filter-change-after-a-page-2-fetch test asserting the next request's offset/batch resets to page 1 (not append) — the direct regression-shape proof mirroring 0.i5b's BUG-019 test for Discovery; (b) a filter-change-triggers-`window.scrollTo({top:0,...})` test, and a not-on-mount guard test, mirroring 0.i5b's AC4/AC5 tests exactly; (c) **Favorites only:** a test asserting that a card in `pendingRemoval` state has its optimistic state cleared (and no orphaned undo action fires) when a filter change triggers `resetToken`, proving AC3.
9. **And** no new PostHog events, no new i18n strings, no new GraphQL fields/resolvers/DB changes, and no `packages/ui`/`packages/domain`/`apps/backend`/`packages/database` files are touched by this story — it is a same-layer, `apps/web`-only hook-composition change, matching Story 0.i5b's own boundary exactly.

## Tasks / Subtasks

- [ ] **Task 0 — Confirm prerequisite Story 1.3l's status (AC: #7)**
  - [ ] Before starting, run `python3 scripts/sprint-status-tool.py get 1-3l-wire-feed-and-favorites-to-real-auth-location-and-ai-filter-state`. If not `review` or `done`, STOP and surface this to the user rather than implementing against pre-1.3l file shapes (per this story's standing sequencing rule, AC7). Do not silently implement against the current, pre-1.3l `feed-content.tsx`/`favorites-content.tsx` code — the `filterKey`/`queryKey` field lists this story's ACs specify (`nearby`, `aiFilter` on Favorites) assume 1.3l has already landed.

- [ ] **Task 1 — Wire `useListPaginationController` into `feed-content.tsx` (AC: #1, #4, #5, #6)**
  - [ ] Import `useListPaginationController` and `usePrefersReducedMotion` from `@festgrid/ui`.
  - [ ] After the filter/nearby/AI state is resolved (post-1.3l), add:
    ```ts
    const prefersReducedMotion = usePrefersReducedMotion();
    const pagination = useListPaginationController({
      filterKey: { q, types, categories, subscriptions: subscriptionsQuery, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter },
      initialCursor: 0,
      onReset: () => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        }
      },
    });
    ```
  - [ ] Append `pagination.resetToken` as a new trailing element to the `useInfiniteQuery`'s `queryKey` array; do not remove any existing element.
  - [ ] Do not touch `initialPageParam`, `getNextPageParam`, `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, or the `useInfiniteScroll` call.
  - [ ] Verify `useToggleFavoriteMutation`'s `["events", "feed"]`-prefix `cancelQueries`/`setQueriesData` calls are unaffected by the new trailing `resetToken` element (AC6).

- [ ] **Task 2 — Wire `useListPaginationController` into `favorites-content.tsx`'s `favoriteEvents` query only (AC: #2, #4, #5, #6)**
  - [ ] Import `useListPaginationController` and `usePrefersReducedMotion` from `@festgrid/ui`.
  - [ ] Add the same `pagination`/`prefersReducedMotion` block as Task 1, with `filterKey: { q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter }` (no `subscriptions` field — Favorites has none; deliberately no `ids`/`frozenIds` field — see Dev Notes).
  - [ ] Append `pagination.resetToken` as a new trailing element to the `favoriteEvents` `useInfiniteQuery`'s `queryKey` array ONLY. Do NOT add `resetToken` to `idSnapshotData`'s `queryKey` (AC2) — that query is not a pagination consumer.
  - [ ] Do not touch `initialPageParam`, `getNextPageParam`, the client-side `frozenIds` slicing logic, or the `useInfiniteScroll` call.
  - [ ] Verify the `["favoriteEvents"]`-prefix `setQueriesData` call inside `handleToggle`'s success path is unaffected by the new trailing `resetToken` element (AC6).

- [ ] **Task 3 — Rewire Favorites' `unfavoritedIds` reset to `pagination.resetToken` (AC: #3)**
  - [ ] Remove the existing `previousSnapshotKeyRef`/`snapshotQueryKey`-comparison `useEffect` that clears `unfavoritedIds` today.
  - [ ] Replace it with a `useEffect` keyed on `pagination.resetToken` that clears `unfavoritedIds` (`setUnfavoritedIds(new Set())`) whenever it changes — matching the same "controller is the single source of truth for a filter change" principle this whole epic establishes, and directly implementing the user's `AskUserQuestion` decision that a filter-driven reset finalizes any pending removal immediately (no blocking/deferring).
  - [ ] Confirm no other code path depended on the removed ref/`snapshotQueryKey` value (grep the file for both identifiers before deleting).

- [ ] **Task 4 — Update `backlog.yaml`'s `IDEA-035` note (AC: #5)**
  - [ ] Update `IDEA-035`'s `note` field to record that Feed and Favorites (this story) now also implement the scroll-to-top-on-filter-reset behavior, alongside Discovery (Story 0.i5b) — 3-of-3 current `useListPaginationController` adopters. Keep status `triaged` (still not promoted to a binding `EXPERIENCE.md` rule by this story, per AC5).

- [ ] **Task 5 — Extend `feed-content.test.tsx` and `favorites-content.test.tsx` (AC: #8)**
  - [ ] Feed: add a filter-change-after-page-2-fetch test (mirrors 0.i5b's `home-content.test.tsx` BUG-019-shape regression test) asserting the next request restarts at offset 0; add scroll-to-top-on-reset and not-on-mount-guard tests, spying on `window.scrollTo` (`vi.spyOn(window, 'scrollTo').mockImplementation(() => {})`, matching the existing project pattern from `home-content.test.tsx`/`EventDiscoveryPanel.test.tsx`).
  - [ ] Favorites: add the equivalent filter-change-resets-pagination and scroll-to-top tests, PLUS a new test proving AC3 — start a favorite-toggle (enter `pendingRemoval`), then trigger a filter change (via the mocked `nuqs` store), and assert `unfavoritedIds`-driven UI state (the greyed-out/pending card) is cleared/superseded by the fresh refetch rather than persisting inconsistently.
  - [ ] Run `pnpm --filter web test -- feed-content favorites-content` and confirm all green; then `pnpm --filter web test` for the full suite, checking for the same kind of cache-coincidence regression 0.i5b found in `page.test.tsx` (a pre-existing test relying on a stale cached response that a `resetToken`-forced fresh fetch would now correctly bypass) — fix narrowly with `{ once: true }` on any such MSW/mock override, matching 0.i5b's precedent, rather than a broader rewrite.

- [ ] **Task 6 — Verification (AC: all)**
  - [ ] `pnpm --filter web test` — full suite green, no regressions.
  - [ ] `pnpm lint` / `pnpm build` (repo root) — clean.
  - [ ] `git diff`/file list confirms only `feed-content.tsx`, `favorites-content.tsx`, their two test files, `backlog.yaml`, this story file, and `sprint-status.yaml` are touched — no `packages/ui`, `packages/domain`, `apps/backend`, or `packages/database` changes (the controller itself, built in 0.i5a, is untouched).

## Dev Notes

- **This is a narrowly-scoped adoption story**, structurally identical in kind to Story 0.i5b (Discovery), just applied to two files instead of one. `useListPaginationController` (`packages/ui`, Story 0.i5a, shipped commit `460f0df`) is consumed as-is, unmodified.
- **Hard sequencing dependency on Story 1.3l (BUG-025), status `ready-for-dev` at story-creation time — NOT done.** `feed-content.tsx`/`favorites-content.tsx`'s CURRENT code (read in full for this story) hardcodes `isAuthenticated={false}`/`savedLocations={[]}` and, on Favorites, has no `useAIFilter()`/`useNearbyFilter()` wiring and no `nearby` field anywhere in its query condition or queryKeys. Story 1.3l fixes this (BUG-025) and adds the `nearby`/`aiFilter.activeFilter` fields this story's `filterKey`/`queryKey` ACs assume already exist. This story's Task 0 requires confirming 1.3l is `review`/`done` before implementation starts — do not implement against the pre-1.3l file shapes described in "current state" below; they exist only to document what changes and why.
- **Read-files-being-modified summary** (both files read in full before drafting, current/pre-1.3l state):
  - `feed-content.tsx`: no local pagination `useState` at all (same implicit-reset-via-queryKey pattern 0.i5b found in pre-adoption `home-content.tsx`) — `useInfiniteQuery` with `initialPageParam: 0`/`getNextPageParam: (lastPage, allPages) => lastPage.events.hasMore ? allPages.length * 10 : undefined`, filters spread directly into `queryKey`. Two views: `card` (paginated `EventListView`) and `calendar` (`FeedCalendarView`, a separate, unpaginated component using its own query — unaffected by and out of scope for this story, same as `CalendarView.tsx` was for 0.i5b).
  - `favorites-content.tsx`: TWO queries. (1) `idSnapshotData` (`useQuery`, `gcTime: 0`) — a one-shot snapshot of favorited event IDs, queryKey `["favoriteIds", { q, types, categories }]`, refetches whole whenever that key changes; not itself paginated. (2) `favoriteEvents` (`useInfiniteQuery`) — client-side-slices the snapshot's `frozenIds` into `PAGE_SIZE`-sized batches, one `GetEventsDocument` request per batch, `initialPageParam: 0`/`getNextPageParam` comparing `allPages.length * PAGE_SIZE` against `frozenIds.length`. No local pagination `useState` (same implicit pattern). A pre-existing `useEffect` already clears `unfavoritedIds` (the bespoke optimistic-toggle state) whenever `JSON.stringify({q,types,categories})` changes, via a `previousSnapshotKeyRef` comparison — Task 3 replaces this with a `resetToken`-driven equivalent, consolidating two parallel "did the filter change" mechanisms into one canonical signal.
- **Why the controller's `filterKey` deliberately excludes `frozenIds` (Favorites):** `frozenIds` is a *derived* value (the output of `idSnapshotData`'s own query, itself already correctly keyed on the true filter snapshot), not an independent filter input. Using it as the controller's `filterKey` would make the reset fire one render-cycle late (only after `idSnapshotData` has already refetched and produced new `frozenIds`), rather than at the moment the filter actually changes. Keying `filterKey` on the same underlying `{q, types, categories, nearby, aiFilter}` snapshot `idSnapshotData` itself already uses means `favoriteEvents`'s `resetToken` increments in the same render pass as the filter change, matching Story 0.i5a's AC1 same-render-pass guarantee, and matching how `idSnapshotData`'s own (unrelated, controller-free) refetch is triggered.
- **Why `idSnapshotData` gets no controller involvement (AC2):** it is not a pagination query — it has no `hasNextPage`/cursor concept at all, just a single snapshot refetch keyed on the filter. `useListPaginationController`'s entire purpose (cursor/reset-token/history bookkeeping for a paginated list) has nothing to attach to there. This mirrors 0.i5b's own reasoning for why `CalendarView.tsx`/`FeedCalendarView` (unpaginated siblings) were left untouched.
- **Favorites' bespoke optimistic-toggle pattern (`unfavoritedIds`, undo toast) is orthogonal to pagination and remains otherwise unmodified** — Gate 1/3 review (below) confirmed no structural interaction beyond the single reset-timing decision covered by Task 3/AC3. `toggleFavoriteAsync`'s mutation itself already fires immediately (not gated on the toast's dismissal), so "finalizing the removal immediately" on a filter-driven reset (per the user's `AskUserQuestion` decision) does not race a still-in-flight mutation — it only affects the local optimistic-display window.
- **`IDEA-038` (extending the Today/Upcoming/All temporal filter to Feed/Favorites) is NOT implemented by this story.** This story only gives Feed/Favorites a `useListPaginationController` instance to eventually attach a `temporalFilter` value to, per EXPERIENCE.md's Temporal Filter section. `IDEA-038` itself (adding the actual UI toggle + query condition to these two pages) remains its own future story, still blocked on nothing further once this story and 1.3l are both done — see `backlog.yaml#IDEA-038`, updated as part of this story's completion.

### Architecture & UX Gate Findings

No `epic-0-i5-readiness.md` sweep exists yet (only `epic-0-readiness.md`, `epic-0-i7-readiness.md`, `epic-1-readiness.md`, etc. exist under `epic-readiness/`), so Gates 1, 2, and 3 were run fresh for this story, per `story-split-gate.md` — matching Stories 0.i5a's and 0.i5b's own precedent for this same un-swept epic.

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Same-layer, client-side-only hook composition (Winston/architect lens, run fresh via subagent): `useListPaginationController` wired into two already-existing `apps/web` page components. No DB/ORM/domain-package call from the frontend, no external service called directly, no new GraphQL resolver/query/mutation/endpoint, no auth/secrets/business-rule logic, no undeployed infra dependency. Specifically evaluated and ruled out: Favorites' two-query/client-side-ID-slicing shape does **not** force any backend/query-shape invention to accommodate the controller — `favoriteEvents`'s underlying cursor is a plain numeric offset (`allPages.length * PAGE_SIZE` vs. `frozenIds.length`), the same shape Feed/Discovery already use; if anything it maps more cleanly onto the controller's contract than Feed's case, since Favorites already computes an exact `totalCount` (`frozenIds.length`) rather than only a boolean `hasMore`.
- **Gate 2 (UI Complexity & Reusability) — No gap found; two flags resolved via `AskUserQuestion` before this story was drafted.** No new component is built — both pages already compose the shared, previously-Gate-2-reviewed `EventDiscoveryPanel`/`FilterHub`/`EventListView`; `useListPaginationController` itself was already Gate-2-reviewed in Story 0.i5a. Two genuine UX-spec/behavior decisions were surfaced rather than silently picked: (1) whether Feed/Favorites should get the scroll-to-top-on-filter-reset behavior `IDEA-035` logged as a "candidate" convention pending more adopters — user chose to extend it to both, still as a documented (not binding) convention (AC5); (2) what should happen to Favorites' `pendingRemoval`/undo-toast state if a filter-driven reset fires mid-window — user chose "finalize immediately" (AC3). Both decisions are recorded in this story's ACs/Tasks, not left implicit.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Every dependency touched already exists and is already in active use: `@tanstack/react-query` (unchanged), `useInfiniteScroll` (unchanged), `nuqs` (unchanged), `usePrefersReducedMotion` (already exported from `@festgrid/ui`, already consumed by Discovery via 0.i5b). Favorites' bespoke optimistic-toggle pattern and its separate `idSnapshotData` query were specifically evaluated (subagent Gate 3 pass) and found orthogonal to the controller's cursor/reset-token lifecycle, requiring no new shared mechanism beyond the single `resetToken`-keyed effect in Task 3. Sequencing risk against Story 1.3l (which lands first and changes both files' `filterKey`/`queryKey` shape) was evaluated and found to be an ordinary sequencing dependency, not a foundational gap — addressed via Task 0/AC7's explicit prerequisite-status check rather than a story split.
- **Escape hatch:** Not invoked — no gate found a gap requiring a prerequisite story or user override beyond the two UX decisions above, both resolved directly.

### `packages/ui` / `packages/domain` reusability check

No new component, hook, or domain function is created by this story — `useListPaginationController` already exists in `packages/ui/src/hooks/` (Story 0.i5a). Nothing here needs a `packages/domain` home either (no new pure business logic; this is page-level React composition, same as 0.i5b).

### State management categorization

Per `project-context.md`'s three-tier model (AD-4), this story adds no new state category: `pagination` (the controller's return value on both pages) is hook-local implementation-detail state, the same categorization Stories 0.i5a/0.i5b already established (sits beneath AD-4's three tiers). `filterKey`'s constituent values (`q`/`types`/`categories`/`subscriptions`/`nearby`/`aiFilter.activeFilter`) remain exactly what Story 1.3l establishes them as — `nuqs`-backed URL state for `q`/`types`/`categories`/`subscriptions`, `useNearbyFilter()`'s/`useAIFilter()`'s own internal state for `nearby`/`aiFilter` — this story only reads a serialized snapshot of them, unchanged ownership. Favorites' `unfavoritedIds` remains local component `useState`, unrelated to AD-4's tiers (ephemeral, single-component UI state, not shared/cached/URL-shareable) — this story changes only what triggers its reset, not its own categorization.

### Loader categorization

Not applicable — no new asynchronous operation is added. The existing Non-Blocking (Infinite Scroll) bottom-spinner loader (driven by `isFetchingNextPage`, unchanged on both pages) and the existing loading-state skeletons continue to apply exactly as before. `window.scrollTo` is a synchronous browser API call inside an effect, not an async operation requiring its own loader treatment (same reasoning as 0.i5b).

### Analytics (AD-5) check

No new PostHog event is required. Both pages' existing analytics calls (`favorites_page_viewed`, `event_favorited`/`event_unfavorited`) are unchanged by this story — they fire at their existing call sites regardless of the controller's presence. Scroll-to-top-on-filter-reset and the `resetToken`-driven `unfavoritedIds` clear are both UX-mechanics, not new trackable user actions distinct from the filter change itself (which already has its own tracking, unaffected by this story).

### i18n (AD-6) check

Not applicable. This story introduces no new user-facing strings — no new rendered text, label, or copy on either page or in either test file.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found — no changes required.
- **Impacted fields/contracts:** None. This story adds no DB columns, GraphQL SDL fields, resolver changes, or shared TypeScript types crossing the frontend/backend boundary. `pagination.resetToken` is a `number`, used only as an additional client-side `queryKey` array element on each page's already-existing paginated query — react-query hashes `queryKey` via internal serialization regardless of element type, so no new type contract is introduced. `useListPaginationController`'s types (Story 0.i5a) are already generic and require no changes for either consumer.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required.
- **Backward compatibility and rollout notes:** Purely additive to each page's `queryKey` (existing elements preserved, `resetToken` appended). Does not change the shape of data returned by `GetEventsDocument`/`GetFavoritedEventIdsDocument`, does not change the `EventListView`/`EventCard` render contract. `useToggleFavoriteMutation`'s prefix-based cache-update calls on both pages continue to match unaffected (Task 1/2, verified not just assumed — AC6). Zero risk to Discovery (already adopted, unaffected) or to any other consumer.
- **Verification checks:** New/extended unit and integration tests (Task 5) plus `tsc`/ESLint clean for `apps/web`.

### Project Structure Notes

- All touched files already exist at their current paths; no new files except test-file extensions to already-existing test files, no new `packages/ui`/`packages/domain` modules, no new directories.
- `apps/web/src/app/[locale]/feed/feed-content.tsx` (modified), `apps/web/src/app/[locale]/feed/feed-content.test.tsx` (modified), `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (modified), `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` (modified), `_bmad-output/implementation-artifacts/backlog.yaml` (modified — `IDEA-035`/`IDEA-038` notes).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.i5e`] (this story's authoritative As-a/I-want/So-that and AC scope, added alongside this story per `story-split-gate.md`'s numbering rule)
- [Source: `_bmad-output/implementation-artifacts/0-i5a-build-the-shared-pagination-filter-controller.md`] (controller API contract, AC1–AC3 semantics)
- [Source: `_bmad-output/implementation-artifacts/0-i5b-adopt-the-controller-in-discovery-event-list-surfaces.md`] (direct structural precedent this story follows: `resetToken`-into-`queryKey` integration pattern, scroll-to-top-on-reset implementation, `IDEA-035`'s origin, its own Gate 1/2/3 writeup)
- [Source: `apps/web/src/app/[locale]/feed/feed-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx`] (read in full — files this story modifies; current/pre-1.3l state)
- [Source: `_bmad-output/implementation-artifacts/1-3l-wire-feed-and-favorites-to-real-auth-location-and-ai-filter-state.md`] (hard prerequisite — establishes the `nearby`/`aiFilter` fields this story's `filterKey`/`queryKey` ACs assume)
- [Source: `_bmad-output/implementation-artifacts/backlog/IDEA-038-feed-favorites-temporal-filter-adoption.md`, `backlog.yaml#IDEA-038`] (the backlog idea this story was surfaced while attempting to create — IDEA-038 names "Feed/Favorites adopting `useListPaginationController`" as its own blocking prerequisite, which had no story until this one)
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml#IDEA-035`] (scroll-to-top-on-filter-reset candidate convention, extended to both pages here per AC5)
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Temporal Filter: Today / Upcoming / All`] ("Each consuming page... owns the committed value via `useListPaginationController`" — confirms Feed/Favorites are anticipated future adopters)
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-18`] (Filter Apply-Timing Convention — the rule this story fulfills for Feed/Favorites)
- [Source: `_bmad-output/project-context.md#UI Patterns & UX Invariants, #State Management Architecture`] (AD-18 bullet; State Management Architecture AD-4 cross-check)
- [Source: `apps/web/src/app/[locale]/feed/feed-content.test.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx`] (read for existing mocking pattern — both already use the `useInfiniteScroll`-mock-with-`window.triggerScroll()` convention `home-content.test.tsx` established, confirmed by direct inspection)

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Patterns & UX Invariants (AD-18 / `useListPaginationController` adoption, this story's core requirement), State Management Architecture (AD-4 cross-check, see Dev Notes categorization)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-18 (Filter Apply-Timing Convention, the rule this story fulfills for Feed/Favorites)
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (frontend-only story, no SQS queues, EventBridge, API Gateway, or DB provisioning touched)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/web/src/app/[locale]/feed/feed-content.tsx` (modified) — adopt `useListPaginationController`, splice `resetToken` into `queryKey`, add `onReset` scroll-to-top (Task 1).
  - `apps/web/src/app/[locale]/feed/feed-content.test.tsx` (modified) — new test coverage per AC8 (Task 5).
  - `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (modified) — adopt `useListPaginationController` on `favoriteEvents` only, add `onReset` scroll-to-top, rewire `unfavoritedIds` reset to `resetToken` (Tasks 2–3).
  - `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` (modified) — new test coverage per AC8 (Task 5).
  - `_bmad-output/implementation-artifacts/backlog.yaml` — update `IDEA-035`'s note; update `IDEA-038`'s note to reference this story as its former blocking gap, now closed (Task 4).
- **Rule Mapping:**
  - AD-18 rule 4 (`project-context.md`/architecture spine) → Tasks 1–2's `useListPaginationController` wiring.
  - `story-split-gate.md` Gate 1/2/3 → all run fresh, no gap; Gate 2's two UX-decision flags resolved via `AskUserQuestion` before drafting, not silently decided (Dev Notes → Architecture & UX Gate Findings).
  - Data Type Compatibility rule (this workflow) → dedicated Dev Notes section; no changes required.
  - Sequencing/prerequisite rule (this story's own standing rule) → Task 0/AC7's explicit Story 1.3l status check.
- **Verification Plan:**
  - `pnpm --filter web test -- feed-content favorites-content` — new/updated tests green.
  - `pnpm --filter web test` — full suite, no regressions; watch specifically for a 0.i5b-style cache-coincidence test failure (a pre-existing test relying on a stale cached response a `resetToken`-forced fresh fetch now correctly bypasses) and fix narrowly with `{ once: true }` if found, matching 0.i5b's precedent.
  - `pnpm lint` / `pnpm build` (repo root) — clean.
  - `git diff`/file list confirms only the files in the File Change Plan (plus this story file and `sprint-status.yaml`) are touched.

## Pre-Coding Approval Gate

- [x] Scope confirmation — Tasks 1–6 above match the intended scope: wire the already-built controller into `feed-content.tsx`'s and `favorites-content.tsx`'s card views only (`idSnapshotData` and `FeedCalendarView` explicitly excluded, see Out of Scope); do not touch `useInfiniteScroll`, `EventListView`, or the controller itself.
- [x] Architecture and boundary confirmation — no `packages/ui`/`packages/domain`/`apps/backend`/`packages/database` files touched; `useListPaginationController` consumed as-is from Story 0.i5a, not modified.
- [x] Testing plan confirmation — Task 5's test list covers AC1–AC2 (wiring correctness via offset-reset behavior on both pages), AC3 (Favorites' `pendingRemoval`-finalizes-on-reset, new), AC5 (scroll-to-top-on-reset on both pages, including the not-on-mount guard).
- [ ] **Prerequisite confirmed:** Story `1-3l-wire-feed-and-favorites-to-real-auth-location-and-ai-filter-state` is `review` or `done` in `sprint-status.yaml` before implementation starts (Task 0/AC7) — currently `ready-for-dev` (NOT satisfied as of story creation). `bmad-dev-story` MUST re-check this before starting; if still not `review`/`done`, STOP and re-check rather than implementing against pre-1.3l file shapes.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates run fresh for this story (no swept `epic-0-i5-readiness.md` exists yet), all three found no gap (Dev Notes → Architecture & UX Gate Findings). Gate 2's two UX-decision flags (scroll-to-top scope, pending-removal reset behavior) were resolved directly by the user via `AskUserQuestion` before this story was drafted — see AC3/AC5.
- [x] **Scope decisions confirmed:** user was asked via `AskUserQuestion` (a) whether to extend Discovery's scroll-to-top-on-filter-reset convention (`IDEA-035`) to Feed/Favorites — chose "apply to both, keep as convention" (AC5); (b) what should happen to a `pendingRemoval` favorite when a filter-driven reset fires mid-undo-window — chose "finalizes the removal immediately" (AC3).
- [ ] Explicit human approval state (Default: pending approval) — the two live design-tradeoff decisions above were resolved by the user via `AskUserQuestion` during this story's creation (scope/content is settled), but no separate "approve, start coding" confirmation was requested in this session. Defaults to pending per this project's standard — obtain explicit "approve, start coding" before `bmad-dev-story` begins Task 1, in addition to (not instead of) the Story 1.3l prerequisite check above.

## Testing Requirements

- [ ] Unit tests — none required beyond what `useListPaginationController`'s own Story 0.i5a test suite already covers (the hook itself is not modified here).
- [ ] Integration tests — `feed-content.test.tsx` and `favorites-content.test.tsx` (Task 5), extending the existing `@testing-library/react` + Vitest + `graphqlClient.request`-spy mocking pattern already established in both files. Covers filter-change-resets-pagination (both pages), filter-change-triggers-scroll-to-top + not-on-mount guard (both pages), and pendingRemoval-finalized-on-reset (Favorites only).
- [ ] E2E tests — not applicable; no new critical user flow requiring Playwright coverage beyond what already exists for Feed/Favorites.

## Deliverables Checklist

- [ ] `feed-content.tsx` calls `useListPaginationController` with the documented `filterKey`/`initialCursor`/`onReset` shape; `resetToken` spliced into its `queryKey`.
- [ ] `favorites-content.tsx` calls `useListPaginationController` (wired to `favoriteEvents` only, not `idSnapshotData`) with the documented shape; `resetToken` spliced into `favoriteEvents`'s `queryKey`; `unfavoritedIds` reset rewired to `resetToken`.
- [ ] Both `useInfiniteQuery`'s own pagination-accumulation models left unmodified.
- [ ] Filter change scrolls the window to top via `usePrefersReducedMotion`-gated `window.scrollTo` on both pages.
- [ ] `feed-content.test.tsx`/`favorites-content.test.tsx` extended per AC8, all green.
- [ ] `backlog.yaml`'s `IDEA-035` and `IDEA-038` notes updated.
- [ ] `pnpm lint` / `pnpm build` clean at repo root.

## Out of Scope

- **`idSnapshotData`'s own query wiring** — not a pagination consumer, gets no controller involvement (AC2, Dev Notes).
- **`FeedCalendarView`** — a separate, unpaginated component with its own query; untouched by this story, same as `CalendarView.tsx` was for Story 0.i5b.
- **IDEA-038's actual temporal-filter UI/query-condition work** — this story only gives Feed/Favorites a controller instance to eventually attach a `temporalFilter` value to; the UI toggle and query-condition wiring remain IDEA-038's own future story.
- **Promoting `IDEA-035` to a binding `EXPERIENCE.md` rule** — not done by this story; it remains a documented convention now implemented by all 3 current adopters (Discovery, Feed, Favorites), not a spec-mandated one.
- **Story 0.i5c's moderator-tools prev/next UI** — unrelated, already its own story.
- **The CI-enforced ratchet (Story 0.i5z)** — asserting no list surface manages pagination/filter state locally outside the controller; depends on this story plus 0.i5a/b/c/d, not implemented here.
- **Any of Story 1.3l's own scope** (real `nearby`/`aiFilter` wiring, `buildFeedQueryCondition`/`buildFavoritesQueryCondition` extension) — this story only assumes 1.3l has already landed; it does not implement or duplicate any part of it.
- **Favorites' pre-existing `queryKey` field-completeness or any other unrelated cleanup** — not touched unless directly required by Tasks 2–3.

## Definition of Done

- [ ] AC 1–9 satisfied.
- [ ] Required tests passing (Task 5 + Testing Requirements).
- [ ] Lint and type checks passing for `apps/web`.
- [ ] Pre-Coding Approval Gate's prerequisite-status check and both scope decisions explicitly confirmed before this story is marked done.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

_To be filled by `bmad-dev-story`._

### Debug Log References

_To be filled by `bmad-dev-story`._

### Completion Notes List

_To be filled by `bmad-dev-story`._

### File List

_To be filled by `bmad-dev-story`._

### Change Log

- 2026-09-19: Story created via `bmad-create-story`, surfaced as a Gate 3-style prerequisite while attempting to create `IDEA-038` (extend the temporal filter to Feed/Favorites) — `IDEA-038`'s own capture doc named "Feed/Favorites adopting `useListPaginationController`" as a blocking prerequisite, but no story in epic-0-i5 covered it. User chose to create this prerequisite story first rather than draft `IDEA-038` against an unbuilt foundation. Two UX-decision flags from Gate 2 (scroll-to-top scope, pending-removal reset behavior) resolved via `AskUserQuestion` before drafting.
