---
baseline_commit: c55b5e4
---

# Story 0.i5b: Adopt the controller in Discovery/event-list surfaces

## Story Details

- Epic: 0.i5 (Shared list-pagination and filter-state controller)
- Story ID: 0.i5b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the Discovery event-list infinite-scroll view to use the shared `useListPaginationController` controller (built in Story 0.i5a),
so that BUG-018 (scroll position) and BUG-019 (filter-change reset) are both closed by construction rather than by two separate point fixes.

## Acceptance Criteria

1. **Given** `apps/web/src/app/[locale]/home-content.tsx`'s card/list view (the Discovery event-list infinite-scroll surface), **when** the story ships, **then** it calls `useListPaginationController` with `filterKey` set to the exact snapshot of active filter/query state already assembled today (`{ q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter }`) and `initialCursor: 0`.
2. **Given** the controller's `resetToken`, **when** it is returned, **then** it is spliced into the existing `useInfiniteQuery`'s `queryKey` array (`['events', { q, types, categories, nearby, aiFilter }, resetToken]`) alongside — not replacing — the existing filter-object entry, so a filter change is guaranteed to be treated as a fresh query by the canonical shared mechanism even if a future edit to this file ever drops a field from the manual filter object (closes BUG-019's failure mode structurally, per Story 0.i5a's AC1).
3. **Given** `useInfiniteQuery`'s own `initialPageParam`/`getNextPageParam` pagination-accumulation model, **when** this story is implemented, **then** it is left unmodified — per Story 0.i5a's Dev Notes, the controller is not composed into `useInfiniteScroll`/`useInfiniteQuery` for infinite-scroll consumers; only the `resetToken`-into-`queryKey` integration pattern is used. No `goToNextPage`/`goToPrevPage`/`pageIndex` calls are added here (those are the prev/next-consumer API surface, used by the moderator-tools pages in Story 0.i5c, not this one).
4. **Given** a filter change (any change to `q`, `types`, `categories`, `nearby`, or `aiFilter.activeFilter`), **when** the controller's internal `filterKey` comparison detects the change and fires its `onReset` callback, **then** `home-content.tsx` calls `window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })` (via the existing `usePrefersReducedMotion` hook from `@festgrid/ui`), reusing the exact scroll-to-top convention already established by `useCollapseHeaderOnScroll.ts`'s `expand()`. This is a deliberate scope addition beyond epics.md's literal AC text — resolved via `AskUserQuestion` during story creation (Gate 2 flagged the scroll-position-on-filter-change question as an unaddressed UX-spec gap; user chose to add the behavior now rather than leave it unspecified). Documented as a candidate future cross-surface convention (backlog `IDEA-035`), not written into `EXPERIENCE.md` as a binding rule by this story.
5. **Given** the Discovery event list currently has **zero** test coverage (unlike every sibling content page — `feed-content.test.tsx`, `favorites-content.test.tsx`, `archive-content.test.tsx` all exist; `home-content.test.tsx` does not), **when** this story ships, **then** a new `apps/web/src/app/[locale]/home-content.test.tsx` is added, mirroring `feed-content.test.tsx`'s mocking pattern (`nuqs`, `graphqlClient`, `@festgrid/ui`'s `useInfiniteScroll`), covering: (a) initial render with populated events, (b) a page-2 fetch via the simulated scroll trigger reaching `offset: 10`, (c) a filter change after a page-2 fetch causing the next request's `offset` to reset to `0` (not append), and (d) a filter change triggering `window.scrollTo({ top: 0, behavior: expect.any(String) })`.
6. **Given** this is a client-side-only hook-wiring change to an already-existing, already-authenticated-agnostic public page, **when** implemented, **then** no new i18n strings, no new PostHog analytics event, no new GraphQL fields/resolvers, and no new DB/migration changes are introduced (see Dev Notes' Data Type Compatibility, Analytics, and i18n subsections for the explicit "not applicable" rationale each).

## Tasks / Subtasks

- [x] **Task 1 — Wire `useListPaginationController` into `home-content.tsx` (AC: 1, 2, 3)**
  - [x] Import `useListPaginationController` and `usePrefersReducedMotion` from `@festgrid/ui` in `apps/web/src/app/[locale]/home-content.tsx`.
  - [x] After `resolvedNearby` is computed (existing line ~154) and before the `useInfiniteQuery` call, add:
    ```ts
    const prefersReducedMotion = usePrefersReducedMotion();
    const pagination = useListPaginationController({
      filterKey: { q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter },
      initialCursor: 0,
      onReset: () => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        }
      },
    });
    ```
  - [x] Update `useInfiniteQuery`'s `queryKey` to `['events', { q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter }, pagination.resetToken]` — append `resetToken` as a new final element; do not remove the existing filter object.
  - [x] Do **not** touch `initialPageParam`, `getNextPageParam`, `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, or the `useInfiniteScroll` call — these stay exactly as they are today (Story 0.i5a's Dev Notes: the controller is a `resetToken`-into-`queryKey` integration for infinite-scroll consumers, not a replacement pagination engine).
  - [x] Do not call `goToNextPage`/`goToPrevPage`/read `pageIndex` anywhere in this file — out of scope for the infinite-scroll consumer pattern (see AC3).

- [x] **Task 2 — Verify the favorite-toggle mutation's cache-key handling still matches (AC: 2)**
  - [x] `useToggleFavoriteMutation`'s `onMutate`/`onError` handlers reference `queryClient.cancelQueries({ queryKey: ['events'] })` (prefix match) and `queryClient.setQueriesData({ queryKey: ['events'] }, ...)` (prefix match) — both already match on the `['events']` prefix only, so appending `resetToken` as a new trailing queryKey element does not break these; `getQueryData`/`setQueryData` calls that reference the *exact* old key (`['events', { q, types, categories }]`, missing `nearby`/`aiFilter`/`resetToken` even before this story — a pre-existing minor inconsistency, not introduced by this story) should be left as-is unless verification in Task 4 shows they now misbehave. Do not silently "fix" this pre-existing key mismatch as a byproduct of this story; if verification surfaces it as newly broken, note it in Dev Agent Record and treat any speculative unrelated fix as out of scope.

- [x] **Task 3 — Add `home-content.test.tsx` (AC: 5)**
  - [x] New file `apps/web/src/app/[locale]/home-content.test.tsx`, mirroring `feed-content.test.tsx`'s structure: mock `nuqs` (shared in-memory store keyed by query param, matching the existing pattern exactly so `q`/`types`/`categories` changes propagate like real URL state), mock `@/lib/graphql-client`'s `graphqlClient.request` with a spy returning `{ events: { items, hasMore, totalCount } }`, mock `@festgrid/ui`'s `useInfiniteScroll` to expose a `window.triggerScroll()` test helper (re-export all other `@festgrid/ui` members via `importOriginal`), mock `@festgrid/analytics`'s `usePostHog`.
  - [x] Test: renders populated event list on initial mount; asserts the first `graphqlClient.request` call's `variables.offset === 0`.
  - [x] Test: calling `window.triggerScroll()` after the first page loads (with `hasMore: true` on the first mocked response) fetches page 2; asserts the second call's `variables.offset === 10`.
  - [x] Test: after the page-2 fetch, changing `q` (via the mocked `nuqs` store, simulating `handleSearchSubmit`) causes the next `graphqlClient.request` call's `variables.offset === 0` (not `20`) — the direct regression proof for BUG-019 on this surface.
  - [x] Test: the same filter change triggers `window.scrollTo` with `{ top: 0, behavior: expect.stringMatching(/auto|smooth/) }` — spy on `window.scrollTo` via `vi.spyOn(window, 'scrollTo').mockImplementation(() => {})`, matching the existing spy pattern already used in `EventDiscoveryPanel.test.tsx`/`useCollapseHeaderOnScroll.test.ts`.
  - [x] Test: on initial mount (no filter change yet), `window.scrollTo` is **not** called — the reset-triggered scroll must not fire on first render, only on an actual `filterKey` change (matches `useListPaginationController`'s own `onReset` contract from Story 0.i5a: fires once per actual change, not on mount).

- [x] **Task 4 — Verification (AC: all)**
  - [x] `pnpm --filter web test -- home-content` — all new tests green.
  - [x] `pnpm --filter web test` — no regressions in sibling `apps/web` tests (especially `EventDiscoveryPanel.test.tsx`, any test importing `home-content`).
  - [x] `pnpm lint` / `pnpm build` (repo root) — clean.
  - [x] Manual confirmation: `git diff`/file list shows only `apps/web/src/app/[locale]/home-content.tsx` (modified), `apps/web/src/app/[locale]/home-content.test.tsx` (new), and this story's own files touched in `apps/web` — no `packages/ui`, `packages/domain`, `apps/backend`, or `packages/database` changes (the controller itself is untouched, already shipped by 0.i5a).

- [x] **Task 5 — Backlog note (AC: 4)**
  - [x] Add `IDEA-035` to `_bmad-output/implementation-artifacts/backlog.yaml`: proposes the scroll-to-top-on-filter-reset behavior this story adds to Discovery as a candidate cross-surface `EXPERIENCE.md`/AD-18-adjacent convention for other `useListPaginationController` adopters (Feed/Favorites, if/when they adopt the controller; Stories 0.i5c/0.i5d's moderator-tools/temporal-filter surfaces use prev/next navigation, not infinite scroll, so may or may not need the same treatment). Status `triaged`, not `promoted` — no story committed to writing this into `EXPERIENCE.md` yet.

## Dev Notes

- **This is a narrowly-scoped adoption story**: exactly one existing file gets its pagination/filter-reset wiring changed (`apps/web/src/app/[locale]/home-content.tsx`), plus one new test file and one backlog entry. `packages/ui`'s `useListPaginationController` (built, tested, exported in Story 0.i5a, already merged — commit `460f0df`) is consumed as-is, unmodified.
- **Read-files-being-modified summary** (`home-content.tsx`, read in full before drafting): Currently has **no local pagination `useState`** at all — pagination is entirely delegated to `useInfiniteQuery`'s own `initialPageParam: 0` / `getNextPageParam: (lastPage, allPages) => lastPage.events.hasMore ? allPages.length * 10 : undefined`, with filters (`q`, `types`, `categories`, `nearby: resolvedNearby`, `aiFilter: aiFilter.activeFilter`) already spread directly into `queryKey` — this is exactly the pattern Story 0.i5a's own Dev Notes/References cite as "the correct integration pattern AC2 documents" (see 0.i5a's References: "Discovery's `useInfiniteQuery` with filters embedded directly in `queryKey`... confirmed this file is NOT touched by this story, only by 0.i5b"). Because there is no literal local `useState` cursor to delete, epics.md's AC wording ("its local pagination/filter state is removed in favor of the controller's") is satisfied in spirit, not letter: today's implicit, hand-assembled reset mechanism (relying on every filter field always being correctly spread into `queryKey`) is replaced by the canonical, structurally-guaranteed `resetToken` mechanism from the shared controller — closing the gap where a future edit could silently drop a filter field from the key and reintroduce BUG-019 on this surface specifically.
  - `useInfiniteScroll` (`packages/ui/src/hooks/useInfiniteScroll.ts`, read in full): its IntersectionObserver-setup `useEffect` depends on `[node, hasNextPage, rootMargin, threshold]` — **not** `queryKey`/`fetchNextPage` — so it already does not remount/resubscribe on a filter change today (that dependency array was already correct before this story). `fetchNextPage`/`isFetchingNextPage` are read via refs updated in a separate effect, avoiding stale-closure fetches. This confirms Story 0.i5a's AC2 concern (a filter-driven `key` change forcing sentinel remount) was not literally present as a bug in this file — no `key={...}` prop keyed by filter state exists anywhere in the render tree between the sentinel and `HomeContent`. This story does not change `useInfiniteScroll` or its call site.
  - `EventListView.tsx` (`packages/ui`, read in full): purely presentational, no local state, `sentinelRef` passed straight through unchanged. Not touched by this story.
  - `CalendarView.tsx` (Discovery's `calendar` tab sibling, read in full): uses `useGetEventsForCalendarQuery` with `limit: 1000` (no pagination at all — the whole week's events fetched in one call) and its own `useWeeklyCalendarController`. Entirely unaffected by and unrelated to this story's pagination-controller adoption; explicitly out of scope (see Out of Scope).

### Architecture & UX Gate Findings

No `epic-0-i5-readiness.md` sweep exists yet (only `epic-0-readiness.md`, `epic-0-i7-readiness.md`, `epic-1-readiness.md`, etc. exist under `epic-readiness/`), so Gates 1, 2, and 3 were run fresh for this story (not cited from a swept report), per `story-split-gate.md` — matching Story 0.i5a's own precedent for this same un-swept epic.

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** This is a same-layer, client-side-only hook composition change: `useListPaginationController` (a `packages/ui` hook, already built/merged) is wired into `home-content.tsx` (an `apps/web` page component). No DB/ORM/domain-package call from the frontend, no external service called directly, no new GraphQL resolver/query/mutation/endpoint, no auth/secrets/business-rule logic added, no undeployed infra dependency. The only network call remains the pre-existing `useInfiniteQuery` against the already-existing `GetEventsDocument`.
- **Gate 2 (UI Complexity & Reusability) — No gap found; one non-blocking flag resolved via `AskUserQuestion`.** No new component is built (the reusable hook itself was already built and Gate-2-reviewed in Story 0.i5a); no new rendered UI element is added. Confirmed via search of `design-artifacts/UX-festgrid-run-1/DESIGN.md`/`EXPERIENCE.md`: neither doc addresses infinite-scroll reload/scroll-position behavior on filter change — a genuine UX-spec gap. Surfaced to the user via `AskUserQuestion` rather than silently deciding either way; user chose to add scroll-to-top-on-filter-reset now (AC4), with the decision itself — not a new `EXPERIENCE.md` rule — recorded here, and a non-blocking future-convention candidate logged as backlog `IDEA-035` for when other `useListPaginationController` adopters (Feed/Favorites) might want the same treatment.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Every dependency touched already exists and is already in active use in this exact file or its close siblings: `@tanstack/react-query`'s `useInfiniteQuery` (unchanged), `useInfiniteScroll` (unchanged), `nuqs` (unchanged), the existing `GetEventsDocument`/codegen types (unchanged), `usePrefersReducedMotion` (already exported from `@festgrid/ui`, already consumed by `useCollapseHeaderOnScroll.ts`). No new foundational/shared tooling is introduced.
  - **BUG-018 closure caveat (added when promoting BUG-018 in `backlog.yaml`, post-Gate-3 write-up):** epics.md's own Story 0.i5a/0.i5b text attributes BUG-018's closure to the structural no-forced-remount guarantee (0.i5a's AC2). This story's "read-files-being-modified" pass (above) found that anti-pattern was never actually present in `home-content.tsx`'s current code — its `useInfiniteScroll` sentinel already didn't remount on a filter change before this story. This story's test coverage (Task 3) proves the filter-change/reset/scroll-to-top behaviors, **not** the literal anchor-loss-during-an-ordinary-page-append symptom BUG-018 originally reported (which is a different code path — normal page-2/3/4 loads, not filter changes). Treat BUG-018 as closed in the epic's own narrow, structural sense, not as empirically re-verified against the original report. If the real symptom still occurs, `BUG-031` (broader — same `useInfiniteScroll` hook, 5 surfaces, logged 2026-09-15, root cause unconfirmed) is the correct live tracking item, not a reopened BUG-018.
  - **BUG-031 cross-check (explicitly out of scope):** a separate, unconfirmed backlog bug ("infinite scroll jumps to the very bottom after loading a page, mobile always/desktop intermittently," logged 2026-09-15, `triaged`, no `epic` assigned) affects the *same* shared `useInfiniteScroll` hook but across five surfaces (Discovery/Feed/Favorites/Archive/Account), with an unconfirmed root cause and no `stories` field. It is a distinct symptom from BUG-018/BUG-019 (jump-to-bottom vs. sentinel-no-longer-in-view/mixed-list), was raised independently of Epic 0.i5's formation, and per Gate 3's own framing (missing foundational dependency vs. a latent defect in an existing, already-established shared hook) does not belong to this story or as a prerequisite to it. `useInfiniteScroll` itself is left byte-for-byte unchanged by this story. Confirmed via subagent Gate 3 analysis: correctly left as its own independent, unblocked future bug-fix item.

### `packages/ui` / `packages/domain` reusability check

No new component, hook, or domain function is created by this story — `useListPaginationController` already exists in `packages/ui/src/hooks/` (Story 0.i5a). Nothing here needs a `packages/domain` home either (no new pure business logic; this is page-level React composition).

### State management categorization

Per `project-context.md`'s three-tier model (AD-4), this story adds no new state category: `pagination` (the controller's return value) is hook-local implementation-detail state, same categorization Story 0.i5a already established for `useListPaginationController` itself (sits beneath AD-4's three tiers, same as `useInfiniteScroll`'s internal `node`/`error` state). `filterKey`'s constituent values (`q`/`types`/`categories`/`nearby`/`aiFilter.activeFilter`) remain exactly what they already are today — `nuqs`-backed URL state for `q`/`types`/`categories`, `useNearbyFilter`'s own internal state for `nearby`, `useAIFilter`'s own internal state for `aiFilter` — none of that ownership changes; the controller only reads a serialized snapshot of it.

### Loader categorization

Not applicable — no new asynchronous operation is added. The existing Non-Blocking (Infinite Scroll) loader (`EventListView`'s bottom spinner, driven by `isFetchingNextPage`, unchanged) and the existing `status === 'loading'` skeleton screen continue to apply exactly as before. The new `window.scrollTo` call is a synchronous browser API call inside an effect, not an async operation requiring its own loader treatment.

### Analytics (AD-5) check

No new PostHog event is required. `handleFilterChange`'s existing `filter_applied` event (unchanged by this story) already fires at the filter-control call site regardless of this hook's presence. Scroll-to-top-on-filter-reset is a UX affordance, not a trackable user action distinct from the filter change itself that already gets its own event — matching Story 0.i5a's own reasoning for why the headless controller itself emits no analytics.

### i18n (AD-6) check

Not applicable. This story introduces no new user-facing strings — no new rendered text, label, or copy anywhere in `home-content.tsx` or the new test file.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found — no changes required.
- **Impacted fields/contracts:** None. This story adds no DB columns, GraphQL SDL fields, resolver changes, or shared TypeScript types crossing the frontend/backend boundary. `pagination.resetToken` is a `number`, used only as an additional client-side `queryKey` array element — react-query hashes `queryKey` via internal serialization regardless of element type, so no new type contract is introduced.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required — `useListPaginationController`'s types (Story 0.i5a) are already generic and require no changes for this consumer.
- **Backward compatibility and rollout notes:** Purely additive to `queryKey` (existing elements preserved, `resetToken` appended) — does not change the shape of data returned by `GetEventsDocument`, does not change the `EventListView`/`EventCard` render contract. `useToggleFavoriteMutation`'s prefix-based `queryKey` matching (`['events']`) continues to match unaffected (see Task 2). Zero risk to Feed/Favorites/other consumers, which are untouched by this story.
- **Verification checks:** New unit/integration tests (Task 3) plus `tsc`/ESLint clean for `apps/web`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i5b] (this story's authoritative As-a/I-want/So-that and AC scope)
- [Source: _bmad-output/implementation-artifacts/0-i5a-build-the-shared-pagination-filter-controller.md] (full prior story — hook API contract, AC1/AC2/AC3 semantics, explicit integration-pattern guidance for infinite-scroll consumers, and its own confirmation that `home-content.tsx` was deliberately left untouched for this story to handle)
- [Source: apps/web/src/app/[locale]/home-content.tsx] (read in full — file this story modifies)
- [Source: packages/ui/src/hooks/useInfiniteScroll.ts, .types.ts] (read in full — confirms no remount-on-filter-change anti-pattern present; unchanged by this story)
- [Source: packages/ui/src/features/events/EventListView.tsx] (read in full — purely presentational, unchanged by this story)
- [Source: apps/web/src/features/events/CalendarView.tsx] (read in full — confirms the calendar tab is unpaginated and unrelated; unchanged by this story)
- [Source: packages/ui/src/hooks/useCollapseHeaderOnScroll.ts, packages/ui/src/hooks/usePrefersReducedMotion.ts] (scroll-to-top + reduced-motion convention this story reuses verbatim)
- [Source: packages/ui/src/features/events/EventDiscoveryPanel.test.tsx (scroll collapse behavior describe block), packages/ui/src/hooks/useCollapseHeaderOnScroll.test.ts] (existing `window.scrollTo` spy-assertion pattern this story's new tests follow)
- [Source: apps/web/src/app/[locale]/feed/feed-content.tsx, feed-content.test.tsx] (closest sibling using the identical `useInfiniteQuery`+`useInfiniteScroll`+`GetEventsDocument` pattern and its test-mocking conventions — `nuqs` mock, `graphqlClient` spy mock, `useInfiniteScroll` `window.triggerScroll()` test helper — all reused by this story's new `home-content.test.tsx`)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#BUG-018, #BUG-019, #BUG-031] (BUG-018/019 are this story's originating bugs; BUG-031 is the explicitly-out-of-scope related-but-distinct item)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-18] (Filter Apply-Timing Convention, rule 4: list/pagination consumers must own cursor state via `useListPaginationController` — the rule this story fulfills for Discovery)
- [Source: _bmad-output/project-context.md#UI Patterns & UX Invariants] (AD-18 bullet; State Management Architecture AD-4 cross-check)

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Patterns & UX Invariants (AD-18 / `useListPaginationController` adoption, this story's core requirement), State Management Architecture (AD-4 cross-check, see Dev Notes categorization)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-18 (Filter Apply-Timing Convention, the rule this story fulfills for Discovery)
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (frontend-only story, no backend compute/queue/DB touched)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/web/src/app/[locale]/home-content.tsx` (modified) — adopt `useListPaginationController`, splice `resetToken` into `queryKey`, add `onReset` scroll-to-top (Task 1).
  - `apps/web/src/app/[locale]/home-content.test.tsx` (new) — integration tests per AC5/Task 3.
  - `_bmad-output/implementation-artifacts/backlog.yaml` — add `IDEA-035` (Task 5).
- **Rule Mapping:**
  - AD-18 rule 4 (`project-context.md`/architecture spine) → Task 1's `useListPaginationController` wiring.
  - `story-split-gate.md` Gate 1/2/3 → all run fresh, no gap (Dev Notes → Architecture & UX Gate Findings); Gate 2's UX-spec gap resolved via `AskUserQuestion`, not silently decided.
  - Data Type Compatibility rule (this workflow) → dedicated Dev Notes section; no changes required.
  - Testing Rules (`project-context.md`) → Task 3/AC5 backfills Discovery's previously-nonexistent test coverage, matching the "testing trophy" integration-test-first approach used by sibling content pages.
- **Verification Plan:**
  - `pnpm --filter web test -- home-content` — new tests green.
  - `pnpm --filter web test` — no regressions, especially `EventDiscoveryPanel.test.tsx` and any test importing `home-content`.
  - `pnpm lint` / `pnpm build` (repo root) — clean.
  - `git diff`/file list confirms only the three files above (plus this story file and `sprint-status.yaml`) are touched — no `packages/ui`, `packages/domain`, `apps/backend`, or `packages/database` changes.

## Pre-Coding Approval Gate

- [x] Scope confirmation — Task 1–5 above match the intended scope: wire the already-built controller into `home-content.tsx` only; do not touch `useInfiniteScroll`, `EventListView`, `CalendarView`, or any other consumer (Feed/Favorites/Archive/Account are explicitly out of scope, see Out of Scope). Confirmed via `AskUserQuestion` (2026-09-15, "Approve, write the story").
- [x] Architecture and boundary confirmation — no `packages/ui`/`packages/domain`/`apps/backend`/`packages/database` files touched; `useListPaginationController` consumed as-is from Story 0.i5a, not modified.
- [x] Testing plan confirmation — Task 3's test list covers AC1–AC3 (wiring correctness via offset-reset behavior), AC4 (scroll-to-top-on-reset, including the not-on-mount guard), and AC5 (net-new `home-content.test.tsx` coverage, mirroring `feed-content.test.tsx`'s established pattern).
- [x] Explicit human approval state — **approved** (via `AskUserQuestion`, 2026-09-15, "Approve, write the story").
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates run fresh for this story (no swept `epic-0-i5-readiness.md` exists yet), all three found no gap (Dev Notes → Architecture & UX Gate Findings). Gate 2's non-blocking UX-spec gap (scroll-to-top on filter change) was resolved directly by the user via `AskUserQuestion`, not deferred — see AC4.
- [x] **Scroll-to-top scope decision confirmed:** user was asked via `AskUserQuestion` whether to add scroll-to-top-on-filter-reset behavior beyond epics.md's literal AC text; user chose to add it now (AC4), logged as a candidate future cross-surface convention via backlog `IDEA-035` rather than a binding `EXPERIENCE.md` rule.

## Testing Requirements

- [x] Unit tests — none required beyond what `useListPaginationController`'s own Story 0.i5a test suite already covers (the hook itself is not modified here).
- [x] Integration tests — `apps/web/src/app/[locale]/home-content.test.tsx` (Task 3), `@testing-library/react` + Vitest + `msw`-adjacent manual `graphqlClient.request` spy mocking, matching `feed-content.test.tsx`'s existing style. Covers initial render, page-2 fetch, filter-change-resets-offset (BUG-019 regression proof), and filter-change-triggers-scroll-to-top (AC4).
- [x] E2E tests — not applicable; no new critical user flow requiring Playwright coverage beyond what already exists for Discovery.

## Deliverables Checklist

- [x] `home-content.tsx` calls `useListPaginationController` with the documented `filterKey`/`initialCursor`/`onReset` shape; `resetToken` spliced into `queryKey`.
- [x] `useInfiniteQuery`'s own pagination-accumulation model (`initialPageParam`/`getNextPageParam`) left unmodified.
- [x] Filter change scrolls the window to top via `usePrefersReducedMotion`-gated `window.scrollTo`.
- [x] New `home-content.test.tsx` covers AC1–AC5's behaviors, all green.
- [x] `IDEA-035` added to `backlog.yaml`.
- [x] `pnpm lint` / `pnpm build` clean at repo root.

## Out of Scope

- **Feed/Favorites/Archive/Account's own pagination/filter-reset wiring** — none of these consume `useListPaginationController` yet; they are separate, unscoped future adoptions (not part of Epic 0.i5's currently-formed story list).
- **BUG-031 (infinite-scroll jump-to-bottom)** — a distinct, unconfirmed defect in the shared `useInfiniteScroll` hook affecting five surfaces including Discovery; explicitly not this story's mechanism (pagination/filter-reset, not scroll-anchor-during-append) and not in `epic-0-i5`. Left as its own independent, unblocked future bug-fix item (see Dev Notes' Gate 3 cross-check).
- **BUG-020's moderator-tools prev/next UI** — Story 0.i5c.
- **IDEA-019's temporal filter (Happening now/Upcoming/All)** — Story 0.i5d.
- **The CI-enforced ratchet** asserting no list surface manages pagination/filter state locally outside the controller — Story 0.i5z (depends on 0.i5a–0.i5d).
- **Writing the scroll-to-top-on-filter-reset behavior into `EXPERIENCE.md` as a binding cross-surface rule** — not done by this story; logged as a non-blocking candidate convention (backlog `IDEA-035`) for a future story to formalize once/if other surfaces adopt it.
- **CalendarView.tsx / the calendar tab** — unpaginated, uses a different query and controller (`useWeeklyCalendarController`) entirely; untouched by this story.
- **The pre-existing `queryKey` mismatch in `useToggleFavoriteMutation`'s `onError`/`getQueryData` calls** (missing `nearby`/`aiFilter` fields, predates this story) — not fixed here unless Task 4's verification shows it is newly broken by this story's change; flagged in Task 2 as a known pre-existing inconsistency, not silently absorbed as a speculative fix.

## Definition of Done

- [x] AC 1–6 satisfied.
- [x] Required tests passing (Task 3 + Testing Requirements).
- [x] Lint and type checks passing for `apps/web`.
- [x] Pre-Coding Approval Gate's scroll-to-top scope decision explicitly confirmed before this story is marked done.

## Completion Status

- [x] Complete — all tasks/subtasks done, tests passing, lint/build clean

## Dev Agent Record

### Agent Model Used

Claude (Sonnet 5), via `bmad-dev-story`.

### Debug Log References

- Prerequisite-status check: Story 0.i5a is `review` (not `done`) in sprint-status.yaml — code committed at `460f0df` (485/485 `packages/ui` tests passing, lint/build clean at that commit). Surfaced to the user via `AskUserQuestion` before starting; user approved proceeding, and set a standing rule to always accept a `review`-status prerequisite (committed + green, just awaiting `bmad-code-review`) as safe to build against going forward.
- `pnpm --filter web test -- home-content` — 4/4 new tests green.
- `pnpm --filter web test` (full suite) — first run: 1 failure in `page.test.tsx`'s `search integration: submits DSL payload and renders search empty state` test. Root cause: that pre-existing test (which itself renders `HomeContent` via MSW, not this story's own new test file) asserted that clearing the search box instantly reverted to the cached `q=''` result without a new network round trip. That assumption is exactly the fragile-cache-coincidence behavior AD-18/this story's `resetToken` mechanism is designed to eliminate — after this story, a `q` change to a value already seen before still increments `resetToken` and forces a fresh fetch (by design, matching AC2's "even a consumer that forgets to spread filterKey" guarantee). The test's `mswServer.use(...)` override for the empty-search response had no `{ once: true }`, so it kept intercepting the new, correctly-triggered fetch. Fixed by adding `{ once: true }` to that one handler (see File List) so the subsequent real request falls through to the suite's default handler, which correctly returns `Test Event 1`. Re-ran full suite after the fix: 368/368 passing, 60/60 files.
- `pnpm lint` (repo root) — clean (pre-existing `no-explicit-any`/`no-unused-vars` warnings only, no errors, none in touched files).
- `pnpm build` (repo root) — clean, all routes compiled.
- `python3 scripts/backlog-check.py` — checks 1–14 clean; `IDEA-035` (added during story creation) confirmed present and well-formed.

### Completion Notes List

- Wired `useListPaginationController` into `home-content.tsx` per AC1–AC3: `filterKey` matches the exact existing filter snapshot, `initialCursor: 0`, `onReset` fires `window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })` via `usePrefersReducedMotion`. `resetToken` appended as the new trailing `queryKey` element, existing filter object left in place. `useInfiniteQuery`'s own `initialPageParam`/`getNextPageParam`/`fetchNextPage`/`hasNextPage`/`isFetchingNextPage`/`useInfiniteScroll` call are all byte-for-byte unchanged, and no `goToNextPage`/`goToPrevPage`/`pageIndex` calls were added — matches AC3.
- Task 2: confirmed `useToggleFavoriteMutation`'s `onMutate`/`onError` prefix-matched `queryClient.cancelQueries`/`setQueriesData` calls (keyed on `['events']` only) are unaffected by the new trailing `resetToken` element. The pre-existing exact-key mismatch in `getQueryData`/`setQueryData` (missing `nearby`/`aiFilter`, predating this story) was verified via the full test run to NOT be newly broken by this change — left as-is per Task 2's explicit instruction, not silently fixed.
- Task 3: added `apps/web/src/app/[locale]/home-content.test.tsx` (new), mirroring `feed-content.test.tsx`'s mocking pattern (`nuqs` shared in-memory store, `graphqlClient.request` spy, `@festgrid/ui`'s `useInfiniteScroll` overridden via `importOriginal` to expose `window.triggerScroll()`, `usePostHog` mocked). Since Discovery is usable unauthenticated, `useAuthSession` is mocked with `session: null` throughout, which keeps `useNearbyFilter`'s/`useAIFilter`'s own session-gated queries (`useGetMyLocationsQuery`, `useGetMyApiKeysQuery`) disabled and out of the way — the real, unmocked `useListPaginationController`/`usePrefersReducedMotion` are exercised for real (only `useInfiniteScroll` is overridden). 4 tests added covering AC5(a)–(d): initial render at offset 0, no `scrollTo` on mount, page-2 fetch at offset 10, and the combined filter-change-resets-to-offset-0 + scroll-to-top proof (BUG-019's direct regression proof for this surface).
- **Deviation from the stated File Change Plan, required to keep the full suite green (not speculative):** discovered during Task 4 verification that `apps/web/src/app/[locale]/page.test.tsx` (a pre-existing, undocumented-by-this-story test file that already renders `HomeContent` via MSW) contradicts this story's Dev Notes claim that Discovery "currently has zero test coverage" — it does have coverage, just via a different (MSW-based) strategy than the `graphqlClient.request`-spy strategy used by every sibling `*-content.test.tsx`. One of its tests broke as a direct, intended consequence of AC2's fresh-query guarantee (see Debug Log). Fixed with a single-line, narrowly-scoped `{ once: true }` addition to that one MSW handler override — not a broader rewrite, not a speculative fix, and does not touch this story's own `packages/ui`/`packages/domain`/`apps/backend`/`packages/database` exclusion. Flagging in File List/Change Log rather than silently absorbing it.
- `IDEA-035` was already present in `backlog.yaml` (added during `bmad-create-story` for this story) — Task 5 confirmed satisfied, no new edit needed this session.

### File List

- `apps/web/src/app/[locale]/home-content.tsx` (modified) — Task 1: `useListPaginationController`/`usePrefersReducedMotion` wiring, `resetToken` spliced into `queryKey`.
- `apps/web/src/app/[locale]/home-content.test.tsx` (new) — Task 3: AC5 test coverage.
- `apps/web/src/app/[locale]/page.test.tsx` (modified) — one `{ once: true }` addition to the search-integration test's empty-result MSW override; required to keep this pre-existing, previously-passing test correct under AC2's new fresh-query-on-filter-change guarantee (see Completion Notes' deviation note). No other change to this file.
- `_bmad-output/implementation-artifacts/backlog.yaml` — unchanged this session; `IDEA-035` already present from story creation (Task 5 pre-satisfied).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — `0-i5b-...` status `ready-for-dev` → `in-progress` → `review`.
- `_bmad-output/implementation-artifacts/0-i5b-adopt-the-controller-in-discovery-event-list-surfaces.md` (this story file, modified) — Tasks/Subtasks, Dev Agent Record, File List, Change Log, Status.

### Change Log

- 2026-09-16: Implemented Story 0.i5b. Adopted `useListPaginationController` (Story 0.i5a) in `home-content.tsx`, closing BUG-019 structurally for Discovery and adding scroll-to-top-on-filter-reset (AC4, backlog `IDEA-035`). Added `home-content.test.tsx` (previously nonexistent, AC5). Fixed one pre-existing `page.test.tsx` test whose cache-coincidence assumption was invalidated by AC2's fresh-query-on-filter-change guarantee (`{ once: true }` on its MSW override). `pnpm --filter web test` (368/368), `pnpm lint`, `pnpm build` all clean. Status: `ready-for-dev` → `review`.
