# Story 1.4: Search for events

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.4
- Status: ready-for-dev

## Story

As a user,
I want to be able to search for events by name, performer, and location,
so that I can find specific events I am interested in.

## Acceptance Criteria

1. **AC1 — Search submits on Enter:** Given I am on the main page (`/`), when I type a search query in the search bar and press Enter, then the list of events is filtered to show only events matching the query.
2. **AC2 — Server-side DSL filtering, not client-side:** And the filtering is expressed as a `contains` condition sent through the Unified Query DSL (AD-1) to the backend `events` query (Story 1.3a) — never a client-side filter applied to already-fetched results.
3. **AC3 — Multi-field, partial, case-insensitive match:** And the search matches on event name, performers, and location name, using partial (substring), case-insensitive matching — expressed as an `or` group of three `contains` conditions (`eventName`, `performers`, `location`), combined via `and` with whatever base condition Story 1.3's page sends for the default list (see Dev Notes — Combining with Story 1.3's base query).
4. **AC4 — URL state, shareable:** And the active search query is reflected in the URL as shareable/bookmarkable state via `nuqs` (AD-4 URL State) — reloading or sharing the URL reproduces the same filtered list, and the list re-syncs correctly if the query param is removed/edited directly in the URL.
5. **AC5 — Clearing the search:** And submitting an empty/whitespace-only query (or clearing the input and pressing Enter) removes the search condition entirely and returns to the default list — this is not an error/validation state.
6. **AC6 — i18n:** And all user-facing search UI text (input placeholder, clear-button accessible label, and empty-results messaging when a search yields zero matches) is localized using `next-intl`, with message keys present in both `en` and `id` locale files (AD-6, NFR23).
7. **AC7 — Test coverage:** And integration tests cover the DSL partial-match/multi-field/combinator semantics (mocked at the GraphQL layer) and URL-state sync, and one E2E test covers typing a query, pressing Enter, and seeing the filtered results with the query reflected in the URL.

## Tasks / Subtasks

- [ ] Task 1: Build the reusable `SearchBar` component (AC1, AC5, AC6)
  - [ ] Create `packages/ui/src/features/events/SearchBar.tsx` (Gate 2 finding — see Dev Notes: build in this story's scope, but placed in `packages/ui` for reuse by future Event List View consumers such as Story 2.2/2.5/3.7, not co-located in `apps/web`).
  - [ ] Controlled text input with a clear/reset affordance; calls an `onSubmit(query: string)` (or equivalent) callback on Enter — no debounce, no live-as-you-type filtering (matches epics.md's explicit "press Enter" AC, not `01-event-list-view.md`'s more generic "real-time" phrasing — see Dev Notes documentation-consistency note).
  - [ ] Trim whitespace before submit; submitting an empty/whitespace string is treated as "clear" (AC5), not a validation error.
  - [ ] Export `SearchBar` from `packages/ui/src/index.ts` (create/extend a `packages/ui/src/features/events/index.ts` barrel if Story 1.3b hasn't already created one — check for conflicts if 1.3b has landed first).
- [ ] Task 2: Wire the search query into URL state (AC4, AC5)
  - [ ] Use `nuqs`'s `useQueryState('q', parseAsString.withDefault(''))` (already available — `NuqsAdapter` is already composed in `apps/web/src/app/[locale]/layout.tsx`, no new provider setup needed) to read/write the `q` search param.
  - [ ] On submit, setting `q` to `''` must remove the param from the URL (not leave `?q=`), matching AC5's "clear" behavior.
- [ ] Task 3: Extend the discovery page's DSL query construction (AC2, AC3)
  - [ ] In `apps/web/src/app/[locale]/page.tsx` (or Story 1.3's page-level query-building logic, whichever lands first — see Dev Notes), when `q` is non-empty, build the `or` group of three `contains` conditions (`eventName`, `performers`, `location`) and combine it into the existing DSL payload per the "Combining with Story 1.3's base query" note below.
  - [ ] Structure this as a small, extensible query-builder (e.g. a local `buildEventsQuery({ search })` function) rather than an inline one-off object — Story 1.5 (filter by type/category) is expected to extend the same builder with additional `in` conditions inside the same `and` group (epics.md Story 1.5 AC: "combinable with the search query from Story 1.4").
  - [ ] Pass the resulting DSL object as the `query` variable to the existing generated `events` query hook (Story 1.3's react-query wiring) — no new GraphQL operation document is needed; only the variables change.
- [ ] Task 4: Empty-results state (AC6)
  - [ ] When a search returns zero results, render a localized empty-state message distinct from the page's generic "no events" empty state (Story 1.3 AC7/Task 4) if the copy needs to differ (e.g. "No events match 'x'") — reuse Story 1.3's empty-state component/slot if it accepts a message override, otherwise add a minimal conditional message.
- [ ] Task 5: Analytics (AD-5)
  - [ ] Call `usePostHog()` (from `@festgrid/analytics` — the current actual exported surface; no dedicated typed tracking helper exists yet, see Dev Notes) to `.capture('search_submitted', { query: string })` when the user submits a non-empty search (do not fire on clear/empty submit).
- [ ] Task 6: Localize copy (AC6)
  - [ ] Add new message keys to `apps/web/locales/en.json` and `apps/web/locales/id.json` (e.g. `SearchBar.placeholder`, `SearchBar.clearLabel`, `DiscoveryPage.searchEmptyState`) and consume them via `useTranslations` — do not hardcode strings.
- [ ] Task 7: Tests (AC7)
  - [ ] Integration tests (Vitest + MSW, `@festgrid/testing-config`) covering: submitting a query sends the correct `or`-of-`contains` DSL shape combined with the base query via `and`; the DSL is case-insensitive/partial-match by construction (assert the request shape — actual `ilike` matching is Story 1.3a's resolver-side responsibility, not testable from `apps/web`); the `q` URL param updates on submit and clears on empty submit; the search-specific empty state renders when results are empty.
  - [ ] One E2E happy-path test (`apps/web/e2e/search.spec.ts`, Playwright, alongside the existing `apps/web/e2e/home.spec.ts`) covering: typing a query, pressing Enter, seeing the filtered list, and the URL reflecting `?q=...`.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true`, `1.4` explicitly listed in `stories_covered`). The sweep's one finding — no GraphQL authenticated-context layer (Story 0.17) — does not apply here: search is an unauthenticated/public discovery-page feature with no per-user data and no `context.user` dependency. No new Gate 1/3 gap for this story.
- **Gate 2 (UI Complexity & Reusability) — run fresh via subagent persona Freya (2026-08-01):** **No gap found; no dedicated split-off story warranted.** `SearchBar` is a small, single-purpose controlled input (text + submit-on-Enter + URL sync) — categorically simpler than `EventCard` (Story 1.3b, which has images/favorite-state/multiple visual states) or `useInfiniteScroll` (Story 1.3c, which has intersection-observer + cursor-pagination + cleanup complexity). Reuse across future pages (Favorites 2.2, Nearby 2.5, Feed 3.7) alone does not trigger Gate 2 — the trigger is reuse *combined with* non-trivial states, which is absent here. Resolution: build `SearchBar` within this story's scope, but place it at `packages/ui/src/features/events/SearchBar.tsx` (not co-located in `apps/web`) so later pages can import it without a refactor (Task 1) — a scope-location note, not a new story.
  - No hook/util complexity comparable to `useInfiniteScroll` is present: the interaction is type → press Enter → set `q` via `nuqs` → existing query mechanism refetches. No debouncing (explicitly ruled out by "press Enter," not live-as-you-type), no derived-state computation, no multi-consumer coordination logic. `nuqs`'s `useQueryState` handles the URL-state mechanics directly.
  - **Documentation-consistency note only (no scope change):** `design-artifacts/D-Design-System/01-event-list-view.md` states the Event List View "updates in real-time as filters are applied," but `epics.md`'s Story 1.4 AC is explicit about submit-on-Enter. Per this project's precedent (same handling as Story 1.3's view-toggle documentation discrepancy), `epics.md` governs authoritative AC — this is flagged for the design-system doc to be reconciled separately, not a change to this story's scope.
- **Lightweight escape-hatch guard (no subagent):** Checked this story's specific scope for anything neither the epic-1 sweep nor the fresh Gate 2 pass anticipated — search introduces no new external service, no new data entity, and no new infra dependency (all matching/filtering logic already lives in Story 1.3a's DSL-to-Drizzle mapper, which was explicitly designed to support this story's exact `or`-of-`contains` shape — see AC2/AC3's dependency on 1.3a). Nothing new found.

### Data Type Compatibility & Migration Requirements

- **No database migration required by this story.** `packages/database/schema.ts` already carries btree indexes on every column this story searches — `event_name_idx` (`events.eventName`), `event_location_idx` (`events.location`), `schedule_performers_idx` (`schedules.performers`), `schedule_location_idx` (`schedules.location`) — all added by Story 1.1, satisfying `project-context.md`'s "columns frequently used in WHERE clauses must be indexed" rule. This story adds no new column, no new table, and no new type.
  - Known caveat (not this story's action item): plain btree indexes do not accelerate `ILIKE '%term%'` substring scans the way a `pg_trgm` GIN/trigram index would. This is a query-performance concern belonging to Story 1.3a's resolver/index-strategy scope (which owns the actual `ilike` execution), not something Story 1.4 (a pure frontend/DSL-construction story) can or should address.
- **No backend/domain code changes required by this story.** Story 1.3a's Dev Notes explicitly designed its DSL-to-Drizzle mapper to support "a single free-text search term as an `or` group of `contains` conditions across `eventName`/`performers`/`location`" (1.3a AC2 sub-note) — that mapper logic already exists in 1.3a's scope. This story is a pure consumer: it only constructs the DSL JSON fragment client-side and passes it as a GraphQL variable to the existing `events` query.
- **No changes required to `packages/shared-types`.** This story introduces no new field, no new type, and reuses `EventQueryConditionInput`'s existing shape (Story 1.3a).

### Combining with Story 1.3's base query

As of this story's creation (2026-08-01), Story 1.3's page is **not yet implemented** (`apps/web/src/app/[locale]/page.tsx` is still Story 0.3's theme-verification demo content), so the exact mechanism by which Story 1.3 scopes the list to "ongoing or upcoming" is not yet concretely settled in code — Story 1.3's AC2 states this filter "is expressed as query conditions sent to the backend," but Story 1.3a's own ACs only document a default **sort** order (soonest-upcoming-first), not an automatic default **filter**, for requests with no explicit query. Because of this ambiguity, the dev agent implementing this story must, at build time:

1. Inspect how Story 1.3's page actually constructs its DSL `query` variable for the default (no-search) case.
2. If Story 1.3 sends an explicit top-level condition (e.g. an upcoming-date-range condition), wrap it and this story's search `or` group together as `{ operator: "and", conditions: [<1.3's base condition>, <search or-group>] }` — search narrows within the already-scoped default list, it does not replace it.
3. If Story 1.3 sends no explicit condition (relying on a resolver-side default), this story's search `or` group is simply the sole top-level `query` value when a search is active.

Either way, the query-builder in Task 3 must be structured so Story 1.5's type/category filters can extend the same `and` group later (epics.md Story 1.5 AC explicitly calls out combinability with this story's search).

### Architecture and technical constraints

- **API access:** Exclusively via the backend GraphQL `events` query (AD-1, AD-2) — this story adds no new GraphQL operation document, it only changes the `query` variable passed to Story 1.3's existing generated hook (AC2).
- **State management categorization (AD-4):**
  - **URL State:** The search query (`q` param) → `nuqs`'s `useQueryState`, typed/parsed, shareable, SSR-compatible (AC4).
  - **Server State:** No change from Story 1.3 — the events list itself remains `@tanstack/react-query`'s `useInfiniteQuery`; changing `q` changes the query key/variables, which react-query will naturally refetch from page 1.
  - **Client Global State:** None introduced by this story.
- **Reusable component callout:** `SearchBar` → `packages/ui/src/features/events/SearchBar.tsx` (Gate 2 finding above) — a new reusable UI component per `project-context.md`'s Code Organization rule.
- **Analytics (AD-5):** New tracked event — **`search_submitted`**, payload `{ query: string }`, fired on non-empty search submission only (not on clear). No dedicated typed analytics helper exists yet in `@festgrid/analytics` beyond `usePostHog`/`PostHogProvider` (Story 1.8 explicitly scoped "full analytics taxonomy governance for all future epics" as out of scope) — call `usePostHog().capture('search_submitted', { query })` directly, following the `noun_verb` naming convention (AD-5.1).
- **i18n (AD-6):** New message keys required in both `en.json` and `id.json` — e.g. `SearchBar.placeholder`, `SearchBar.clearLabel`, `DiscoveryPage.searchEmptyState` (exact key names/copy finalized by the dev agent; both locale files must be updated together as part of Definition of Done).
- **File/path expectations:**
  - Page route: `apps/web/src/app/[locale]/page.tsx` (confirmed still Story 0.3's demo content as of this story's creation — same file Story 1.3 replaces).
  - `SearchBar`: new, `packages/ui/src/features/events/SearchBar.tsx`, exported via `packages/ui/src/index.ts` (currently only re-exports `./core/app-shell` — confirmed no `features/` directory exists yet; if Story 1.3b lands first and creates `packages/ui/src/features/events/index.ts` for `EventCard`, extend that barrel rather than creating a duplicate).
  - `nuqs` (`^2.9.4`) is already an installed dependency in `apps/web`; `NuqsAdapter` is already composed once in `apps/web/src/app/[locale]/layout.tsx` — this story only consumes `useQueryState`, it does not configure the adapter.
  - Locale message files: `apps/web/locales/en.json`, `apps/web/locales/id.json` (confirmed currently contain only `HomePage.title`).

### Previous Story Intelligence

- **Story 1.3 (regenerated 2026-08-01, same session):** confirms Stories 1.3a (events GraphQL API) and 1.3b (`EventCard`) are `ready-for-dev` but **not yet implemented** — this story inherits the identical hard-dependency situation (see Pre-Coding Approval Gate). Story 1.3's Dev Notes also establish that `apps/web` already has Vitest + MSW fully wired (`apps/web/vitest.config.ts` exists) — this story's integration tests use Vitest + MSW directly, not the interim `node:test` pattern some Epic 0/1.3a packages use.
- **Story 1.3a:** its DSL-to-Drizzle mapper was explicitly designed with this story's exact shape in mind ("Story 1.4 is expected to express a single free-text search term as an `or` group of `contains` conditions... this story's DSL-to-Drizzle mapper must support that shape") — confirms AC2/AC3 are backed by already-planned (though not yet implemented) backend capability, not a new backend requirement this story must itself build.
- **Story 1.1's seed data (Story 1.2, 3 fixture events):** too few events to meaningfully exercise multi-result search scenarios via manual/local testing alone — prefer MSW-mocked fixtures with distinct, searchable names/performers/locations for the integration tests (Task 7), consistent with Story 1.3's same recommendation for pagination testing.

### Git Intelligence Summary

- Recent commits (`85c2a9d` "set up runtime schema validation with AJV and Zod" — Story 0.11; `996e708`, `272da91`, `f5ca205`, `b5c6a12` — bmad planning-artifact updates) touch validation tooling and planning docs, not the discovery page or any of this story's direct dependencies. No in-flight application-code pattern exists yet for the discovery page or `packages/ui/src/features/events/` to mirror — follow Story 1.3's Dev Notes and this story's own guidance above.

### Latest Tech Information

- `nuqs` v2 (`^2.9.4`, confirmed pinned in `apps/web/package.json`): `useQueryState(key, parser)` — use `parseAsString.withDefault('')` so an absent param reads as `''` rather than `null`, and calling `setValue('')` removes the key from the URL entirely by default (matches AC5's "clear" behavior with no extra logic needed); no debounce/throttle option is needed here since submission is Enter-triggered, not per-keystroke.
- `graphql-codegen`'s `typescript-react-query` plugin (already a devDependency per Story 1.3a's Dev Notes) generates a typed hook whose `query` variable already accepts `EventQueryConditionInput` — no codegen changes are needed for this story since it only supplies new variable values to an existing generated hook.

## Global Rules References

- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-4, AD-5, AD-6)
- `_bmad-output/planning-artifacts/epics.md` (Stories 1.3, 1.3a, 1.4, 1.5)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/1-frontend.md`, `docs/infrastructure/2-backend.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- NEW `packages/ui/src/features/events/SearchBar.tsx`: controlled search input, submit-on-Enter, clear affordance.
- UPDATE `packages/ui/src/index.ts` (or a new `packages/ui/src/features/events/index.ts` barrel): export `SearchBar`.
- UPDATE `apps/web/src/app/[locale]/page.tsx`: read the `q` URL param via `nuqs`, render `SearchBar`, extend the DSL query-builder to include the search `or` group combined with Story 1.3's base query.
- UPDATE `apps/web/locales/en.json`, `apps/web/locales/id.json`: add `SearchBar.*` and `DiscoveryPage.searchEmptyState` message keys.
- NEW integration test(s) (Vitest + MSW): DSL shape assertion for a submitted search, URL-state sync (set/clear), search-specific empty state.
- NEW `apps/web/e2e/search.spec.ts` (Playwright): happy-path search-and-see-filtered-results, alongside the existing `apps/web/e2e/home.spec.ts`.
- **Consumed, not modified by this story:** `apps/backend` (events resolver and DSL mapper from Story 1.3a — already designed to support this story's shape), Story 1.3's `EventCard`/infinite-scroll wiring.

### Rule Mapping

- Server-side DSL filtering, never client-side (AC2, AD-1/AD-2) → search term compiled to an `or`-of-`contains` DSL fragment, combined via `and` with Story 1.3's base condition, sent as the existing `events` query's `query` variable.
- URL State (AC4, AC5, AD-4) → `nuqs`'s `useQueryState('q', ...)`; no new Zustand/React state duplicating this value.
- Reuse boundary (Gate 2 finding) → `SearchBar` built in `packages/ui/src/features/events/`, not co-located in `apps/web`, so Stories 2.2/2.5/3.7 can reuse it without refactor.
- i18n-first (AC6, AD-6) → all new copy sourced via `useTranslations`; keys added to both `en.json`/`id.json`.
- Analytics (AD-5) → `search_submitted` event via `usePostHog().capture(...)`, `noun_verb` naming, fired only on non-empty submit.
- Extensibility for Story 1.5 → query-builder structured so type/category `in` conditions can be added to the same `and` group without rewriting this story's search logic.

### Verification Plan

- Integration test: submitting a query produces the correct `or`-of-`contains` DSL fragment across `eventName`/`performers`/`location`, combined via `and` with the base query (assert request shape via MSW, not resolver behavior — resolver-side `ilike` correctness is Story 1.3a's own test responsibility).
- Integration test: `q` URL param is set on submit and removed on empty/whitespace submit (AC5).
- Integration test: search-specific empty state renders when the mocked response is zero results.
- E2E happy-path (`apps/web/e2e/search.spec.ts`): type a query, press Enter, see the filtered list, URL reflects `?q=...`.
- `pnpm --filter web lint`, `pnpm --filter web build` (type-check), `pnpm --filter web test`, and `pnpm --filter web test:e2e` all clean.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: frontend-only (`apps/web`, `packages/ui`) — no changes to `apps/backend`/`packages/domain`/`packages/database` (Story 1.3a's DSL mapper already supports this story's exact shape per its own Dev Notes).
- [ ] **Hard dependency sequencing accepted:** Stories `1-3-display-a-list-of-events-on-the-main-page`, `1-3a-build-the-events-backend-graphql-api-layer`, and `1-3b-build-the-reusable-eventcard-component` are all `ready-for-dev` but **not yet implemented** as of this story's creation (page still Story 0.3 demo content; backend GraphQL schema not yet extended; no `EventCard` on disk). This story extends Story 1.3's page and query-building logic and cannot functionally complete until 1.3 (and its own dependencies 1.3a/1.3b/1.3c) land. Confirm Story 1.3 will be implemented first (recommended), or explicitly accept building `SearchBar` and its tests against mocked data now, with real page wiring following once 1.3 ships.
- [ ] **Base-query combination ambiguity accepted:** As documented in Dev Notes ("Combining with Story 1.3's base query"), the exact mechanism Story 1.3 uses to scope the default list is not yet settled in code. Confirm the dev agent will inspect Story 1.3's actual implementation at build time and combine accordingly, rather than guessing the shape now.
- [ ] Architecture and API/data boundaries confirmed (GraphQL-only via the existing `events` query; AD-1/AD-2/AD-4).
- [ ] Testing plan reviewed (Vitest/MSW integration tests + one Playwright E2E happy path).
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from swept `epic-1-readiness.md` (no new gap for this story); Gate 2 run fresh via subagent persona Freya, confirmed no gap (SearchBar built in-story, placed in `packages/ui` for future reuse).
- [ ] Human approval to start coding granted (pending)

## Testing Requirements

- Integration coverage (Vitest + MSW) for the DSL partial-match/multi-field (`or`-of-`contains`)/combinator (`and` with base query) request shape.
- Integration coverage for URL-state sync: `q` set on submit, removed on empty/whitespace submit.
- Integration coverage for the search-specific empty state.
- One E2E happy-path flow (Playwright) for typing a query, pressing Enter, seeing filtered results, and URL reflecting the query.

## Deliverables Checklist

- [ ] `SearchBar` component (`packages/ui/src/features/events/SearchBar.tsx`) built and exported.
- [ ] Search query wired to URL state via `nuqs` (`q` param), shareable and clearable.
- [ ] Discovery page's DSL query-builder extended with the search `or` group, combined correctly with Story 1.3's base query.
- [ ] Localized empty-state for zero search results.
- [ ] `en`/`id` message keys added for all new search UI copy.
- [ ] `search_submitted` PostHog event instrumented.
- [ ] Integration and E2E tests written and passing.

## Out of Scope

- Filter controls by type/category (Story 1.5) — no Filter Hub UI in this story, though the query-builder is structured for Story 1.5 to extend.
- Event details page/modal (Story 1.6/1.6a).
- Any backend/resolver/DSL-mapper changes (Story 1.3a's own scope — already designed to support this story's shape).
- Debounced/live-as-you-type search or autosuggest — not specified by `epics.md`'s AC (explicit submit-on-Enter only); the `01-event-list-view.md` design-system doc's more generic "real-time" phrasing is a documentation-consistency item flagged in Dev Notes, not a scope change here.
- Proximity/"nearby" search or geo-distance combination (Epic 2, Story 2.5/2.5a).

## Definition of Done

- Acceptance criteria (AC1-AC7) satisfied.
- Required integration and E2E tests pass.
- Lint and type checks pass for `apps/web` and `packages/ui`.
- `en`/`id` locale files updated with all new message keys (AD-6).

## Completion Status

Not started.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
