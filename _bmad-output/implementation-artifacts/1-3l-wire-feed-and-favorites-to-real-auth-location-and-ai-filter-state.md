# Story 1.3l: Wire Feed and Favorites to real auth/location state and an AI filter instance (BUG-025)

## Story Details

- Epic: 1
- Story ID: 1.3l
- Status: ready-for-dev

## Story

As a signed-in user browsing the Feed or Favorites pages,
I want the same Type/Category/Location/AI-filter controls that Discovery gives me, actually wired to my real saved locations and AI filter state,
so that I get one consistent filtering experience across Discovery, Feed, and Favorites instead of two of the three surfaces silently hiding controls or rendering ones that do nothing.

## Acceptance Criteria

1.  **Given** `feed-content.tsx` today hardcodes `isAuthenticated={false}`, `savedLocations={[]}`, `onSelectLocation={() => {}}` on its `EventDiscoveryPanel` (while already correctly wiring `aiFilter.filterHubProps`), **when** this story ships, **then** `FeedContent` calls the existing `useNearbyFilter()` hook (`apps/web/src/app/[locale]/use-nearby-filter.ts`, already consumed by `home-content.tsx`) and passes `nearbyFilter.isAuthenticated` / `isLoadingLocations` / `locationsError` / `savedLocations` / `selectedValue` / `radiusKm` / `isCapturingCurrentLocation` / `currentLocationError` / `onSelectLocation` / `onRadiusChange` straight through to `EventDiscoveryPanel`, matching `home-content.tsx`'s wiring exactly. Since Feed already redirects unauthenticated visitors to `/login` before rendering, `isAuthenticated` is effectively always `true` once the panel renders — the location popover now renders identically to Discovery's.
2.  **Given** Feed's `buildFeedQueryCondition` (`packages/domain/src/events/buildFeedQueryCondition.ts`) does not accept or forward a `nearby` parameter at all today, **when** a location filter is selected on Feed, **then** `BuildFeedQueryConditionInput` gains an optional `nearby?: NearbyFilterInput` field, forwarded into the underlying `buildEventsQueryCondition({ search, types, categories, nearby })` call **only in the manual-filter branch** (i.e. when `filter` — the AI-resolved filter — is not set), mirroring `buildEventsQueryCondition`'s own existing mutual-exclusivity between `nearby` and `filter` that `home-content.tsx` already relies on. When `filter` is set, `nearby` is ignored, exactly like Discovery's existing behavior — this story does not introduce combined AI+nearby filtering anywhere in the app.
3.  **And** `FeedContent`'s `useInfiniteQuery` queryKey and queryFn include the resolved nearby filter (`resolvedNearby = nearbyFilter.resolvedFilter`) alongside the existing `aiFilter.activeFilter`, so selecting/clearing a location filter actually triggers a refetch with the new condition (not just a cosmetically-wired but functionally inert control).
4.  **Given** `favorites-content.tsx` today has neither `useNearbyFilter()` nor `useAIFilter()` wired at all — no AI trigger, no location popover, no `AIFilterOverlay`/`BlockingLoader` rendered — **when** this story ships, **then** `FavoritesContent` calls both `useNearbyFilter()` and the existing `useAIFilter()` hook (`apps/web/src/features/events/use-ai-filter.ts`, already consumed by Discovery and Feed) and wires `EventDiscoveryPanel`'s location props (as in AC1) plus `showAITrigger` / `onAITriggerClick` / `aiFilterSummary` / `aiCaveatsText` / `onAIClear` / `onAIExpand` from `aiFilter.filterHubProps`, and renders `<AIFilterOverlay {...aiFilter.overlayProps} />` and `<BlockingLoader active={aiFilter.isLoading} />` at the bottom of the page, matching Feed's/Discovery's existing pattern exactly.
5.  **And** Favorites' `filterLabels` (currently missing the three AI-related keys) gains `aiTriggerTooltip` / `aiClearLabel` / `aiExpandLabel`, sourced from the same already-existing `tFilterHub(...)` translation keys Feed and Discovery already use — no new locale strings are added in any locale file.
6.  **Given** Favorites' local `buildFavoritesQueryCondition` helper (defined in `favorites-content.tsx`, not in `packages/domain` — it is not itself a shared/exported function) always wraps its result in `{ operator: 'and', conditions: [{field:'isFavorited',...}, dynamicQuery] }`, **when** this story ships, **then** the helper gains a `nearby?: NearbyFilterInput` parameter and branches the same way `buildFeedQueryCondition` does — `filter ? buildEventsQueryCondition({ filter }) : buildEventsQueryCondition({ search: q, types, categories, nearby })` — for `dynamicQuery`, while the mandatory `isFavorited: true` condition is always AND-ed in regardless of which branch produced `dynamicQuery`. Both the `idSnapshotData` query (`GetFavoritedEventIdsDocument`) and the paginated `favoriteEvents` query already call this helper (or its `buildEventsQueryCondition` equivalent inline) and must both receive the resolved `nearby`/`aiFilter.activeFilter` values consistently, so the favorited-ID snapshot and the paginated result set never disagree about which events match the active filter.
7.  **And** Favorites' `idSnapshotData` queryKey (`["favoriteIds", { q, types, categories }]`) and the paginated queryKey (`["favoriteEvents", { ids: frozenIds, q, types, categories }]`) both include the resolved nearby filter and `aiFilter.activeFilter`, so changing either actually triggers a fresh snapshot/refetch (same cache-correctness requirement as AC3).
8.  **And** no new PostHog events are introduced by this story — `useNearbyFilter()`'s own existing `nearby_filter_applied` / `nearby_geolocation_denied` capture calls simply start firing on Feed/Favorites the same way they already do on Discovery once the hook is wired; `useAIFilter()` itself does not call PostHog directly.
9.  **And** existing Feed/Favorites behavior for search (`q`), `types`, `categories`, infinite scroll, and favoriting/unfavoriting (including Favorites' own optimistic-then-confirm toggle flow) is unchanged — zero visible regression — verified by updating `feed-content.test.tsx` and `favorites-content.test.tsx` to reflect the new hook wiring rather than asserting on the old hardcoded `false`/`[]`/no-op values.
10. **And** `buildFeedQueryCondition.test.ts` is extended to 100% cover the new `nearby` parameter (both branches: `filter` set — `nearby` ignored; `filter` unset — `nearby` forwarded), per `packages/domain`'s mandatory 100% unit-test-coverage rule. Favorites' `buildFavoritesQueryCondition` is not itself in `packages/domain` (single-consumer, pre-existing local placement — this story does not relocate it), so its new branches are covered via `favorites-content.test.tsx`'s existing integration-test style instead.

## Tasks / Subtasks

- [ ] Task 1: Wire Feed to real nearby-filter state (AC: #1, #3)
  - [ ] Import and call `useNearbyFilter()` in `FeedContent` (`apps/web/src/app/[locale]/feed/feed-content.tsx`), relative import `../use-nearby-filter`.
  - [ ] Replace the hardcoded `isAuthenticated={false}` / `isLoadingLocations={false}` / `locationsError={false}` / `savedLocations={[]}` / `selectedValue="off"` / `radiusKm={10}` / `isCapturingCurrentLocation={false}` / `currentLocationError={null}` / `onSelectLocation={() => {}}` / `onRadiusChange={() => {}}` props on `EventDiscoveryPanel` with the corresponding `nearbyFilter.*` values.
  - [ ] Add `resolvedNearby = nearbyFilter.resolvedFilter` to the `useInfiniteQuery` queryKey and to `queryCondition`'s memo dependency array; pass it into `buildFeedQueryCondition`.
- [ ] Task 2: Extend `buildFeedQueryCondition` to accept and forward `nearby` (AC: #2, #10)
  - [ ] Add `nearby?: NearbyFilterInput` to `BuildFeedQueryConditionInput` (`packages/domain/src/events/buildFeedQueryCondition.ts`), importing the type from `./buildEventsQueryCondition.js` (already exported there).
  - [ ] Forward `nearby` into the `buildEventsQueryCondition({ search, types, categories, nearby })` call in the `else` (non-AI-filter) branch only; leave the `filter`-set branch untouched.
  - [ ] Extend `buildFeedQueryCondition.test.ts` with cases covering both branches (`nearby` forwarded when no AI filter is active; `nearby` ignored when an AI filter is active), keeping the file at 100% coverage.
- [ ] Task 3: Wire Favorites to real nearby-filter and AI-filter state (AC: #4, #5)
  - [ ] Import and call `useNearbyFilter()` (relative import `../use-nearby-filter`) and `useAIFilter()` (`@/features/events/use-ai-filter`) in `FavoritesContent` (`apps/web/src/app/[locale]/favorites/favorites-content.tsx`).
  - [ ] Add `AIFilterOverlay`, `BlockingLoader` to the existing `@festgrid/ui` import list.
  - [ ] Replace the hardcoded location props on `EventDiscoveryPanel` (same set as Task 1) with `nearbyFilter.*` values; add `showAITrigger` / `onAITriggerClick` / `aiFilterSummary` / `aiCaveatsText` / `onAIClear` / `onAIExpand` from `aiFilter.filterHubProps`.
  - [ ] Render `<AIFilterOverlay {...aiFilter.overlayProps} />` and `<BlockingLoader active={aiFilter.isLoading} />` before the closing `</PageContainer>`.
  - [ ] Add `aiTriggerTooltip: tFilterHub('aiTriggerTooltip')`, `aiClearLabel: tFilterHub('aiClearLabel')`, `aiExpandLabel: tFilterHub('aiExpandLabel')` to Favorites' `filterLabels` memo.
- [ ] Task 4: Extend `buildFavoritesQueryCondition` and Favorites' query keys (AC: #6, #7)
  - [ ] Add a `nearby?: NearbyFilterInput` parameter to the local `buildFavoritesQueryCondition` helper; branch `dynamicQuery` the same way `buildFeedQueryCondition` does (`filter ? buildEventsQueryCondition({filter}) : buildEventsQueryCondition({search, types, categories, nearby})`), always AND-ing `isFavorited: true`.
  - [ ] Pass `aiFilter.activeFilter` and `nearbyFilter.resolvedFilter` into every call site of `buildFavoritesQueryCondition`/inline `buildEventsQueryCondition` in this file (the `idSnapshotData` query's `favoritesQuery` memo, and the paginated `favoriteEvents` queryFn's `filterCondition` construction).
  - [ ] Add both resolved values to the `["favoriteIds", ...]` and `["favoriteEvents", ...]` queryKeys.
- [ ] Task 5: Update existing tests for the new wiring (AC: #9, #10)
  - [ ] Update `feed-content.test.tsx` and `favorites-content.test.tsx` assertions/mocks that currently exercise or assert on the hardcoded `isAuthenticated=false`/`savedLocations=[]` props, following `home-content.test.tsx`'s existing pattern for exercising `useNearbyFilter()`/`useAIFilter()` under the shared in-memory `nuqs` mock (no bespoke mocking of `useNearbyFilter`/`useAIFilter` needed beyond what the existing `@/lib/graphql-client` and `nuqs` mocks already provide — confirm this holds for Favorites' newly-added hook calls, since `favorites-content.test.tsx` did not previously exercise either hook).
  - [ ] Add coverage confirming Feed's and Favorites' location popover and AI trigger now render under the same conditions Discovery's does (i.e. no longer permanently absent).
  - [ ] Run `pnpm --filter @festgrid/domain test`, `pnpm --filter web test` (or this repo's equivalent test commands) and confirm green.
- [ ] Task 6: Lint and type-check touched packages (AC: all)
  - [ ] `pnpm --filter @festgrid/domain lint && pnpm --filter @festgrid/domain typecheck` (or repo-equivalent).
  - [ ] `pnpm --filter web lint && pnpm --filter web typecheck` (or repo-equivalent).

## Dev Notes

- **Root cause (BUG-025):** `feed-content.tsx` and `favorites-content.tsx` both hardcode `EventDiscoveryPanel`'s location props to `isAuthenticated={false}`/`savedLocations={[]}`/`onSelectLocation={() => {}}`, and Favorites never calls `useAIFilter()` at all — carried forward unchanged through Story 1.3e's `EventDiscoveryPanel` extraction ("Zero visible behavior change" was an explicit goal of that refactor, not a fix). `FilterHub.tsx` gates its nearby-location popover on `isAuthenticated` (line 211) and its AI sparkle trigger on `showAITrigger` (line 259) — with both hardcoded false/absent, the buttons Discovery shows never appear on Feed/Favorites.
- **This is not purely cosmetic.** Even wiring the UI props alone would not be a real fix: `buildFeedQueryCondition` (Feed's query-condition builder) has no `nearby` parameter today, so a rendered-but-inert location control would let a user "select" a location filter that has zero effect on results. This story treats the query-condition-builder extension as in-scope and required — not a separate story — per this workflow's standing rule that a story must leave the system working end-to-end, not just satisfy a literal reading of the captured bug report.
- **Both pages are auth-gated already** (`if (!isLoading && !session) router.push('/login')`), so `nearbyFilter.isAuthenticated` will be `true` for essentially every real render of either page's content — this story does not need to handle a meaningful "logged out but viewing Feed/Favorites" case beyond what already exists.
- **Mutual exclusivity between AI filter and manual/nearby filters is a pre-existing, deliberate pattern** (`home-content.tsx`'s queryFn: `aiFilter.activeFilter ? buildEventsQueryCondition({filter}) : buildEventsQueryCondition({search,types,categories,nearby})`) — this story reproduces that exact pattern on Feed (already partially present via `buildFeedQueryCondition`'s existing `filter ? ... : ...` branch, just missing `nearby` in the second arm) and introduces it fresh on Favorites. Do not attempt to combine AI-resolved and manual nearby filtering in the same request; that is out of scope for this app today, not something this story should invent.
- **`useNearbyFilter()` and `useAIFilter()` stay page-level `apps/web` hooks**, not moved to `packages/ui`/`packages/domain`. They already have (after this story) 3 consumers each, all colocated under `apps/web/src/app/[locale]/`/`apps/web/src/features/events/` respectively — this is the same placement Discovery already uses, not a new pattern, and neither hook is complex/reusable-across-*packages* in the Gate 2/3 sense (see Gate findings below).
- **`buildFavoritesQueryCondition` stays local to `favorites-content.tsx`.** It has exactly one consumer (this file) both before and after this story; relocating it to `packages/domain` would be an unrelated refactor, not part of fixing BUG-025.
- **Incidental observation (not fixed by this story):** `FeedContent`'s `toggleFavorite` mutation's `onMutate`/`onError` snapshot key (`["events", "feed", { q, types, categories, subscriptions: subscriptionsQuery }]`, lines ~160-190) already omits `aiFilter`/`nearby` from its *exact-match* snapshot/rollback key today (the broader `setQueriesData({queryKey: ["events","feed"]})` optimistic-update call is a prefix match and unaffected). Adding `nearby` to the *queryKey* used for fetching (Task 1) does not fix or worsen this pre-existing exact-key mismatch in the rollback path — it was already inconsistent with `aiFilter` before this story. Flagging for `bmad-dev-story`'s awareness; not required by any AC above, since it is not part of BUG-025's reported defect and expanding scope to fix an unrelated optimistic-update edge case risks its own regression without a dedicated look. If it is cheap and obviously safe to include `nearby`/`aiFilter` in that same key while already touching this file, doing so is welcome but not required for Definition of Done.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infrastructure Completeness, Foundational/Cross-Cutting Dependency Completeness):** Sourced from `epic-1-readiness.md` (`swept: true`, covers Stories 1.1-1.8). Lightweight guard applied per `story-split-gate.md`'s Epic-Level Sweep Mode: this story introduces no new external service, no new data entity, and no new infra dependency — it reuses `useNearbyFilter()`, `useAIFilter()`, `AIFilterOverlay`, `BlockingLoader`, and the `withinRadius`/`scheduleCoordinates` GraphQL condition, all already shipped and already exercised by Discovery/Feed today. Nothing here falls outside what the epic-1 sweep already anticipated for this feature area (`EventDiscoveryPanel`/`FilterHub` consumers) — no fresh Gate 1/3 subagent run was needed.
- **Gate 2 (UI Complexity & Reusability):** Run fresh (per-story, as required even when Gate 1/3 are sourced from the epic sweep). Freya's (`wds-agent-freya-ux`) evaluation, given the full `DESIGN.md` and `EXPERIENCE.md`'s heading outline (neither of which specifies the `FilterHub`/nearby-popover/AI-trigger visual design — that was specified in earlier Stories 1.5/7.4, not touched by this pass's UX docs): **"No gap found."** Every visual element in scope (nearby popover, AI sparkle trigger, `AIFilterOverlay`, `BlockingLoader`, `FilterHub`'s gating logic) is pre-existing and already shipped; `useNearbyFilter`/`useAIFilter` are existing hooks gaining their 3rd/2nd call sites, not new complex hooks; the query-condition-builder changes are pure parameter-forwarding extensions mirroring an existing pattern (`buildEventsQueryCondition`), not a new reusable util warranting its own story. Correctly scoped as a single small story.
- **Escape hatch:** Not invoked — no gate found a gap requiring a prerequisite story or user override.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. `NearbyFilterInput` is declared twice — once as a discriminated union in `packages/domain/src/events/buildEventsQueryCondition.ts` (`{locationPreferenceId,radiusKm} | {latitude,longitude,radiusKm}`) and once as a looser shape in `apps/web/src/app/[locale]/use-nearby-filter.ts` (`{locationPreferenceId?, latitude?, longitude?, radiusKm}`) — but `useNearbyFilter()`'s `resolvedFilter` is only ever *constructed* as one of the two literal shapes (never both fields set at once), which already satisfies the domain package's union type structurally wherever it flows into `buildEventsQueryCondition` today (Discovery). This story does not change either type declaration — it only plumbs the same already-flowing value into two additional call sites (`buildFeedQueryCondition`, the local `buildFavoritesQueryCondition`), so no new type incompatibility is introduced.
- **Impacted fields/contracts:** None (no DB columns, no GraphQL schema fields, no new TypeScript interfaces — `BuildFeedQueryConditionInput` gains one existing, already-typed optional field).
- **Required DB migration changes:** No changes required — `withinRadius`/`scheduleCoordinates` querying already exists server-side and is unaffected.
- **Required TypeScript type changes:** `BuildFeedQueryConditionInput` (packages/domain) gains `nearby?: NearbyFilterInput` (imported from the sibling module, not redeclared). No other type changes.
- **Backward compatibility and rollout notes:** Purely additive/optional parameter — omitting `nearby` on any existing caller of `buildFeedQueryCondition` behaves exactly as today. No versioning or feature-flagging needed.
- **Verification checks:** `buildFeedQueryCondition.test.ts`'s new cases (Task 2) exercise both the `nearby`-forwarded and `nearby`-ignored-under-AI-filter branches; `favorites-content.test.tsx`'s updated tests (Task 5) exercise the equivalent branches for `buildFavoritesQueryCondition`.

### Project Structure Notes

- All touched files already exist at their current paths; no new files, no new `packages/ui`/`packages/domain` modules, no new directories. Matches the existing `apps/web/src/app/[locale]/{feed,favorites}/` and `packages/domain/src/events/` structure exactly — no variance from the unified project structure.

### References

- [Source: `_bmad-output/implementation-artifacts/backlog/BUG-025-feed-favorites-missing-filter-buttons.md`] — original bug capture and root-cause trace.
- [Source: `apps/web/src/app/[locale]/home-content.tsx#L38-L244`] — the reference ("correct") wiring pattern this story reproduces on Feed/Favorites.
- [Source: `packages/ui/src/features/events/FilterHub.tsx#L211,#L259`] — the `isAuthenticated`/`showAITrigger` gates that hide the buttons today.
- [Source: `packages/domain/src/events/buildEventsQueryCondition.ts#L84-L165`] — `nearby`/`filter` mutual-exclusivity pattern being mirrored.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.3e`] — the retroactive `EventDiscoveryPanel` extraction that carried this gap forward as an explicit "Zero visible behavior change."
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`] — Gate 1/3 sweep report (`swept: true`) cited above.
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml` — `IDEA-038`] — notes this story (BUG-025) as a blocking prerequisite for Feed/Favorites' future temporal-filter/`useListPaginationController` adoption; this story does not itself adopt the controller (see Out of Scope).

## Global Rules References

- [x] `_bmad-output/project-context.md` — State Management (URL state via `nuqs`, reused not reinvented), Locale-Sensitive Data Rendering (i18n keys reused, none new), Code Organization (`packages/domain` purity/100%-unit-test rule for `buildFeedQueryCondition`), UI Components (`packages/ui`'s `FilterHub`/`EventDiscoveryPanel`/`AIFilterOverlay`/`BlockingLoader` reused as-is, no new component).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-18 (Filter Apply-Timing Convention) consulted; this story does **not** adopt `useListPaginationController` (see Out of Scope) since that remains scoped to epic-0-i5's own adoption stories, not this bug fix.
- [x] `docs/infrastructure/index.md` — not applicable; this story touches only `apps/web` and `packages/domain` frontend/domain code, no SQS queues, EventBridge, API Gateway, or DB provisioning.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - UPDATE `apps/web/src/app/[locale]/feed/feed-content.tsx` — wire `useNearbyFilter()`, extend queryKey/queryCondition.
  - UPDATE `apps/web/src/app/[locale]/favorites/favorites-content.tsx` — wire `useNearbyFilter()` + `useAIFilter()`, add `AIFilterOverlay`/`BlockingLoader`, extend `buildFavoritesQueryCondition` and both queryKeys, add 3 i18n label keys to `filterLabels`.
  - UPDATE `packages/domain/src/events/buildFeedQueryCondition.ts` — add optional `nearby` param, forward in the non-AI-filter branch.
  - UPDATE `packages/domain/src/events/buildFeedQueryCondition.test.ts` — add coverage for both branches.
  - UPDATE `apps/web/src/app/[locale]/feed/feed-content.test.tsx` — update mocks/assertions for real hook wiring.
  - UPDATE `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` — update mocks/assertions for real hook wiring, add coverage for the new `buildFavoritesQueryCondition` branches.
- **Rule Mapping:**
  - `nuqs`-based URL state (AD-4) — reused via `useNearbyFilter`/`useAIFilter`'s existing `useQueryState` calls; no new URL params introduced beyond what those hooks already own.
  - AD-18 (Filter Apply-Timing) — respected as-is; this story does not touch pagination/reset semantics and explicitly does not adopt `useListPaginationController` here (that remains epic-0-i5's scope).
  - `packages/domain` purity + 100% unit-test-coverage rule — `buildFeedQueryCondition`'s extension stays pure TS, no React/DB/Node dependency, covered 100% by its `.test.ts`.
  - i18n rule — reuses existing `FilterHub`/`NearbyFilter` next-intl namespaces verbatim; zero new locale keys.
  - PostHog rule — no new event names/payloads (see AC8); nothing new to declare per the analytics persistent-fact rule.
- **Verification Plan:**
  - `buildFeedQueryCondition.test.ts` at 100% coverage including new branches.
  - `feed-content.test.tsx`/`favorites-content.test.tsx` updated and green, confirming the location popover and AI trigger now render under the same conditions as Discovery's, and existing search/type/category/favorite/infinite-scroll behavior is unchanged.
  - Lint + typecheck clean for `packages/domain` and `apps/web` (Task 6).

## Pre-Coding Approval Gate

- [ ] Scope confirmation (wiring `useNearbyFilter`/`useAIFilter` + extending both query-condition builders on Feed/Favorites — no `useListPaginationController` adoption, no relocation of `buildFavoritesQueryCondition`, no combined AI+nearby filtering)
- [ ] Architecture and boundary confirmation (no `packages/domain` DB/Node coupling introduced; hooks stay in `apps/web`, matching Discovery's placement)
- [ ] Testing plan confirmation (Task 5/6 above)
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — **no gap found by any gate; nothing to confirm as accepted**

## Testing Requirements

- [ ] Integration tests (`feed-content.test.tsx`, `favorites-content.test.tsx`) updated for real hook wiring
- [ ] Unit tests (`buildFeedQueryCondition.test.ts`) at 100% coverage including new `nearby` branches
- [ ] E2E tests: not required — this is an existing-page prop-wiring + query-condition fix, no new user flow; covered by the "testing trophy" integration-test tier per `project-context.md`'s Testing Rules

## Deliverables Checklist

- [ ] `FeedContent` renders the location popover and AI trigger identically to Discovery
- [ ] `FavoritesContent` renders the location popover and AI trigger identically to Discovery (both previously entirely absent)
- [ ] Selecting a location filter on Feed or Favorites actually narrows results (query-condition builders extended)
- [ ] Selecting an AI filter on Favorites actually replaces results (previously impossible — no `useAIFilter()` call existed)
- [ ] All updated/added tests green; lint and typecheck clean for `apps/web` and `packages/domain`

## Out of Scope

- Adopting `useListPaginationController` on Feed/Favorites — tracked separately under epic-0-i5 (Stories 0-i5a/b) and `IDEA-038` (which itself lists this story, BUG-025, as one of its own two blocking prerequisites — it can proceed once this story lands).
- Relocating `useNearbyFilter`/`useAIFilter` into `packages/ui`/`packages/domain`, or relocating Favorites' local `buildFavoritesQueryCondition` into `packages/domain` — no gate found a need for either.
- Combining an active AI filter with a manual nearby-location filter in the same request — mutual exclusivity is preserved everywhere, matching Discovery's existing, unchanged behavior.
- The pre-existing `toggleFavorite` optimistic-update rollback key inconsistency on Feed noted under Dev Notes' "Incidental observation" — not part of BUG-025, left as an awareness note only.

## Definition of Done

- [ ] All Acceptance Criteria satisfied
- [ ] Required tests passing (`packages/domain` unit tests at 100% coverage for touched code; `apps/web` integration tests for both pages)
- [ ] Lint and type checks passing for `apps/web` and `packages/domain`

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
