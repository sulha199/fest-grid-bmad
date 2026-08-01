# Story 1.3: Display a list of events on the main page

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.3
- Status: ready-for-dev

## Story

As a user,
I want to see a list of curated local events on the main page,
so that I can discover what is happening around me.

## Acceptance Criteria

1. **AC1 — Grid render:** Given I am on the main page (`/`), when the page loads, then I see a grid of `EventCard`s (Story 1.3b) populated with real event data.
2. **AC2 — Default filter:** And the events displayed are limited to ongoing or upcoming events only (PRD §3.5.1/§3.1, FR4/FR14) — this filter is expressed as query conditions sent to the backend, never a client-side filter of already-fetched data.
3. **AC3 — GraphQL-only data access:** And the event data is fetched via the backend GraphQL API's `events` query using the Unified Query DSL (Story 1.3a, AD-1/AD-2) — `apps/web` never imports the database/domain layer directly.
4. **AC4 — Infinite scroll append:** And the list implements infinite scrolling using the shared `useInfiniteScroll` hook (Story 1.3c), fetching and appending the next page of results as I scroll near the bottom, without replacing already-loaded items.
5. **AC5 — Non-blocking pagination spinner:** And while fetching subsequent pages, a localized, non-blocking spinner is shown at the bottom of the list (never the full-screen blocking overlay pattern, which is reserved for critical mutations).
6. **AC6 — Non-blocking initial skeleton:** And on initial load, a skeleton grid matching the card layout is shown (reducing layout shift) instead of a blank page or a full-screen spinner.
7. **AC7 — i18n:** And all user-facing labels and loading/empty/error states on this page are localized using `next-intl`, with message keys present in both `en` and `id` locale files (AD-6, NFR23).
8. **AC8 — Test coverage:** And integration tests verify the ongoing/upcoming default filter and the paginated append (not-replace) behavior, and one E2E happy-path test verifies initial render plus at least one infinite-scroll page append.

## Tasks / Subtasks

- [ ] Task 1: Wire the events GraphQL query into the discovery page (AC1, AC2, AC3)
	- [ ] Add/confirm an `events` GraphQL operation document for `apps/web`, feeding `graphql-codegen`'s `typescript-react-query` plugin off Story 1.3a's schema.
	- [ ] Consume the generated hook with `@tanstack/react-query`'s `useInfiniteQuery` (server state, Tier 1 per AD-4) — set `initialPageParam` and `getNextPageParam` to match Story 1.3a's offset/limit pagination shape.
	- [ ] Send no extra DSL conditions beyond what the resolver's default (ongoing/upcoming) already encodes (AC2) — do not add a redundant client-side date filter.
- [ ] Task 2: Build the discovery page grid UI (AC1)
	- [ ] Replace the Story 0.3 theme/dialog verification content in `apps/web/src/app/[locale]/page.tsx` with a responsive grid of `EventCard`s (imported from `@festgrid/ui`).
	- [ ] Map each `Event` GraphQL result's fields (`eventName`, main schedule date, `imageUrl`, `location`, `types`/`categories`, price) onto `EventCard`'s props.
- [ ] Task 3: Integrate the shared infinite-scroll hook (AC4, AC5)
	- [ ] Consume `useInfiniteScroll` from `@festgrid/ui` (Story 1.3c) with a sentinel element at the bottom of the grid, calling `fetchNextPage` and respecting `hasNextPage`/in-flight state.
	- [ ] Render new pages by appending `data.pages` to the grid — never replace/reset already-rendered cards.
	- [ ] Render the localized non-blocking spinner only while a next-page fetch is in flight.
- [ ] Task 4: Add skeleton and empty/error states (AC6, AC7)
	- [ ] Render a skeleton grid (using `EventCard`'s `loading` prop, Story 1.3b AC4) during the initial fetch.
	- [ ] Render a localized empty state if the query returns zero events, and a localized error state if the query fails.
- [ ] Task 5: Localize page copy and states (AC7)
	- [ ] Add new message keys to `apps/web/locales/en.json` and `apps/web/locales/id.json` (e.g. `DiscoveryPage.title`, `.loadingMore`, `.emptyState`, `.errorState`) and consume them via `useTranslations` — do not hardcode strings.
- [ ] Task 6: Tests (AC8)
	- [ ] Integration tests (Vitest + MSW, `@festgrid/testing-config`) covering: default ongoing/upcoming filter is sent/respected, second-page fetch appends without clearing the first page, skeleton/spinner/empty/error states render at the right times.
	- [ ] One E2E happy-path test (`apps/web/e2e/discovery.spec.ts`, Playwright) covering initial render of cards plus a scroll-triggered second-page append.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true`, `1.3` explicitly listed in `stories_covered`). The sweep's one finding — no GraphQL authenticated-context layer — was already split into Story 0.17 and does not apply here: this page is an unauthenticated/public discovery view (no per-user data, no `context.user` dependency). No new Gate 1/3 gap for this story.
- **Gate 2 (UI Complexity & Reusability) — re-run fresh via subagent persona Freya on this regeneration pass (2026-08-01):** **No gap found.** Confirmed that everything remaining in this story's scope (grid rendering via `EventCard`, GraphQL fetch via generated `useInfiniteQuery`, sentinel wiring to `useInfiniteScroll`, non-blocking spinner, skeleton via `EventCard`'s `loading` prop, localized empty/error copy, i18n keys) is either owned by another story (1.3a/1.3b/1.3c) or is trivial page-local JSX/copy — not complex or reused enough to warrant its own story. The prior gap this same gate previously found (the infinite-scroll mechanism) has already been resolved by splitting off Story 1.3c, which is now itself `ready-for-dev`; this story only consumes it.
  - Cross-checked `design-artifacts/D-Design-System/01-event-list-view.md`'s full Event List View spec (view toggles, Filter Hub, "Nearby" default, Quick Favorite) against `epics.md`: search (1.4), type/category filters (1.5), and saved-location/"nearby" filtering (2.5) are all homed; this story's ongoing/upcoming default is explicitly sanctioned by that doc's own "Implementation Note" allowing context-specific page defaults to override "Nearby". Card/Calendar view toggling is owned by Story 3.7 (Feed page), not this page — `EXPERIENCE.md`'s more generic phrasing of a toggle is a documentation-consistency note for a future pass, not a Gate 2 gap in this story's actual approved scope (a plain `EventCard` grid, no toggle). Quick Favorite is owned by Story 2.1, whose current AC wording is detail-view-scoped rather than explicitly card-scoped — also a note for Epic 2's own gate review, not this story's gap, since this story doesn't own `EventCard`'s internals.
  - Other Gate 2 findings evaluated and resolved as **no gap**: the skeleton/loading grid is page-layout-specific and not reused elsewhere (build inline); the fuller "Event List View" component is correctly and already split across Stories 1.4 (search), 1.5 (filter), 2.1/2.1a (favorite), 2.5/2.5a (nearby/geo) — nothing here lacks a home.
- **Lightweight escape-hatch guard (no subagent):** Re-checked this story's specific scope against the swept report and the fresh Gate 2 pass above for anything neither anticipated. Nothing new found.

### Data Type Compatibility & Migration Requirements

- No database schema changes are required by this story itself.
- This story's `EventCard` rendering depends on the `Event.imageUrl` field, which is a hard dependency of Story 1.3a's AC6 (`posts` join), which is itself a hard dependency of Story 1.2a (`posts` table + `events.postId`, currently `backlog` — confirmed unchanged as of this regeneration). Until 1.2a and 1.3a AC6 both land, `imageUrl` will simply be absent/undefined for every card — `EventCard`'s existing fallback/placeholder (Story 1.3b AC3) already handles this gracefully; it is not a broken or degraded state, just the expected interim behavior. No workaround or stub is needed in this story.
- No changes required to `packages/shared-types` by this story.

### Architecture and technical constraints

- **API access:** Exclusively via the backend GraphQL `events` query (AD-1, AD-2, `project-context.md`'s "Database Access" rule) — never a direct DB/domain import from `apps/web` (AC3).
- **State management categorization (AD-4):**
  - **Server State:** The event list and its pages → `@tanstack/react-query`'s `useInfiniteQuery` + `graphql-request`/generated codegen hooks (Tier 1).
  - **URL State:** None introduced by this story — no search/filter querystring params (that is Story 1.4/1.5's scope); the default query has no user-adjustable parameters yet.
  - **Client Global State:** None introduced by this story — nothing here is ephemeral cross-component UI state requiring `zustand`.
- **Loader categorization (project-context.md UI Patterns / PRD §3.12):**
  - Initial page load → **Non-Blocking**, skeleton screens matching the grid/card layout (AC6).
  - Infinite-scroll next-page fetch → **Non-Blocking**, localized spinner at the bottom of the list (AC5) — this is not a critical mutation, so the full-screen blocking overlay pattern must **not** be used here.
- **File/path expectations (re-verified against actual repo state as of this regeneration — unchanged since the prior draft):**
  - Page route: `apps/web/src/app/[locale]/page.tsx` (**not** `apps/web/app/page.tsx`) — confirmed still the Story 0.3 theme/dialog verification content (`useTheme`, `HomePage.title`, Card/Button/Dialog demos), which this story replaces. The app uses `next-intl`'s `[locale]` segment routing, wired by Stories 0.6/0.7.
  - `EventCard`: imported from `@festgrid/ui` (exported via `packages/ui/src/index.ts` once Story 1.3b lands — confirmed that barrel still only exports `./core/app-shell`; no `hooks/` or `features/` directory exists yet under `packages/ui/src`).
  - Shared infinite-scroll hook: imported from `@festgrid/ui`, sourced at `packages/ui/src/hooks/useInfiniteScroll.ts` (new, Story 1.3c — directory confirmed not yet created).
  - Locale message files: `apps/web/locales/en.json`, `apps/web/locales/id.json` (confirmed still contain only `HomePage.title`).
  - Generated GraphQL client code: `apps/web/src/generated/graphql.ts` (confirmed `apps/backend/src/schema/typeDefs.graphql` still only exposes `type Query { health: Boolean! }` — will gain `events`-related types/hooks once Story 1.3a's schema and this story's operation document land).
  - No new i18n/app-shell/analytics-provider setup belongs in this story — `NextIntlClientProvider`, `PostHogProvider`, `ThemeProvider`, `QueryProvider`, `NuqsAdapter`, and `AppShell` are already composed once in `apps/web/src/app/[locale]/layout.tsx` (Stories 0.6/0.7/0.9/1.8); this story only consumes `useTranslations` inside that shell and adds message keys.
- **Reusable component/mechanism callouts:**
  - UI component reuse: `EventCard` (`packages/ui`) — scoped to Story 1.3b; this story only consumes it.
  - Reusable mechanism: infinite-scroll hook — scoped to Story 1.3c per the (already-resolved) Gate 2 finding above; this story only consumes it.
  - No new logic belongs in `packages/domain` for this story — the "ongoing/upcoming" default filter is Story 1.3a's resolver-side default-sort/filter concern (per 1.3a AC1), not something this story constructs client-side.
- **Analytics (AD-5):** PostHog automatically captures page views (per AD-5's "Automatic capture" rule); this story introduces no new user-triggered business interaction requiring a custom tracked event — browsing/scrolling this list is not itself a distinct trackable business event under the current taxonomy. **No new PostHog event name or payload shape is added by this story.**
- **i18n (AD-6):** New message keys required in both `en.json` and `id.json` — e.g. `DiscoveryPage.title`, `DiscoveryPage.loadingMore`, `DiscoveryPage.emptyState`, `DiscoveryPage.errorState` (exact key names/copy finalized by the dev agent; both locale files must be updated together as part of Definition of Done, per AD-6/NFR23).

### Previous Story Intelligence

- Stories 1.3a (events GraphQL API) and 1.3b (`EventCard`) are both `ready-for-dev` but **re-confirmed not yet implemented as of this regeneration (2026-08-01)**: `apps/backend/src/schema/typeDefs.graphql` still only exposes `type Query { health: Boolean! }`, and no `packages/ui/src/features/events/` directory exists on disk. This story is a hard functional consumer of both — see Pre-Coding Approval Gate.
- Story 1.3a's Dev Notes establish an interim `node:test`/`tsx --test` pattern for packages without Vitest (since Story 0.10 was in flight when 1.3a was drafted). That workaround does **not** apply here: Story 0.10 (testing frameworks foundation) is `review` status, and `apps/web` already has Vitest fully wired (`apps/web/vitest.config.ts`, `src/lib/utils.test.ts`, `src/components/msw.test.tsx` already exist) — this story's integration tests use Vitest + MSW directly.
- Story 1.3b's Dev Notes establish that `EventCard` accepts a generic, decoupled `imageUrl?: string` prop with a built-in graceful fallback when absent — this story's data-wiring maps the GraphQL `Event.imageUrl` field onto that prop once available, but is not blocked if it is temporarily always-undefined (see Data Type Compatibility above).
- Story 1.2's seed script produced only 3 fixture events — too few to meaningfully exercise multi-page infinite-scroll behavior via manual/local testing alone. Prefer MSW-mocked multi-page fixtures for the integration tests (Task 6) rather than relying on seeded data volume.

### Git Intelligence Summary

- Re-checked at regeneration time (2026-08-01): the most recent commits (`85c2a9d` "set up runtime schema validation with AJV and Zod" — Story 0.11; `996e708`, `272da91`, `f5ca205`, `b5c6a12`, `cf52ce5` — bmad planning-artifact updates) touch validation tooling and planning docs, not the discovery page or any of this story's direct dependencies (1.3a/1.3b/1.3c/1.2a all still undocumented in git history beyond their own story-artifact commits). No in-flight application-code pattern exists yet for this specific page. The actual frontend pattern to follow remains the already-landed scaffolding in `apps/web/src/app/[locale]/layout.tsx`/`page.tsx` (Stories 0.3/0.6/0.7/0.9): providers are already composed in the root layout; this story only adds page content inside that shell.

### Latest Tech Information

- `@tanstack/react-query` v5 (`^5.101.4`, confirmed still pinned in `apps/web/package.json`): `useInfiniteQuery` requires an explicit `initialPageParam` and a `getNextPageParam(lastPage, allPages)` callback (mandatory as of v5, unlike v4's implicit default) — map `getNextPageParam` to the next `offset` from Story 1.3a's offset/limit pagination shape (returning `undefined` once there are no more results), with pages accumulating in `data.pages` for the append-not-replace requirement (AC4).
- `graphql-codegen`'s `typescript-react-query` plugin (confirmed still a devDependency, `^7.0.5`) can generate a typed infinite-query hook directly from an `events` operation document once Story 1.3a's schema lands — prefer the generated hook over hand-writing `graphql-request` calls, consistent with `apps/web/src/generated/graphql.ts`'s existing pattern.
- `IntersectionObserver` (used inside the Story 1.3c hook this story consumes) needs no polyfill for the project's supported (evergreen) browser matrix.

## Global Rules References

- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-4, AD-5, AD-6)
- `_bmad-output/planning-artifacts/epics.md` (Stories 1.3, 1.3a, 1.3b, 1.3c)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/1-frontend.md`, `docs/infrastructure/2-backend.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- UPDATE `apps/web/src/app/[locale]/page.tsx`: replace Story 0.3's theme/dialog verification content with the real discovery grid (event list, skeleton, spinner, infinite-scroll wiring).
- NEW `apps/web/src/**/events*.graphql` (or co-located operation document): the `events` query operation feeding `graphql-codegen`'s `typescript-react-query` plugin off Story 1.3a's schema.
- UPDATE `apps/web/locales/en.json`, `apps/web/locales/id.json`: add `DiscoveryPage.*` message keys.
- NEW integration test(s) (Vitest + MSW): covering default filter, pagination append, and loading/empty/error states for the discovery page.
- NEW `apps/web/e2e/discovery.spec.ts` (Playwright): happy-path initial render + infinite-scroll append, alongside the existing `apps/web/e2e/home.spec.ts`.
- **Consumed, not modified by this story:** `packages/ui` (`EventCard` from 1.3b, `useInfiniteScroll` from 1.3c), `apps/backend` (events resolver from 1.3a).

### Rule Mapping

- GraphQL-only data access (AC3) → generated react-query hook off Story 1.3a's schema; no direct DB/domain import in `apps/web`.
- Loader semantics (AC5, AC6; `project-context.md` UI Patterns) → skeleton for initial load, localized non-blocking spinner for pagination — never the blocking overlay pattern.
- i18n-first (AC7, AD-6) → all new copy sourced via `useTranslations`; keys added to both `en.json`/`id.json`.
- State management (AD-4) → server state via React Query only; no new URL/Zustand state introduced by this story.
- Reuse boundaries → `EventCard` (`packages/ui`, Story 1.3b) and `useInfiniteScroll` (`packages/ui`, Story 1.3c) are consumed, not reimplemented inline.

### Verification Plan

- Integration test: default query excludes past events and includes ongoing/upcoming events (mocked via MSW against the Story 1.3a-shaped `events` response).
- Integration test: a second-page fetch appends to already-rendered cards without clearing/replacing the first page.
- Integration test: skeleton renders on initial load; localized spinner renders during next-page fetch; localized empty/error states render appropriately.
- E2E happy-path (`apps/web/e2e/discovery.spec.ts`): page loads with cards visible; scrolling near the bottom triggers and renders a second page of cards.
- `pnpm --filter web lint`, `pnpm --filter web build` (type-check), `pnpm --filter web test`, and `pnpm --filter web test:e2e` all clean.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: page composition and list wiring only (`apps/web`); no changes to `apps/backend`/`packages/domain` (Story 1.3a's scope), no changes to `EventCard`'s internals (Story 1.3b's scope), and no changes to the infinite-scroll hook's internals (Story 1.3c's scope) — this story only consumes all three.
- [ ] **Hard dependency sequencing accepted:** Stories `1-3a-build-the-events-backend-graphql-api-layer` and `1-3b-build-the-reusable-eventcard-component` are both `ready-for-dev` but re-confirmed **not yet implemented** as of this regeneration (backend GraphQL schema currently exposes only `health: Boolean!`; no `EventCard` component exists on disk). This story cannot functionally complete until both land. Confirm they will be implemented first (recommended), or explicitly accept starting this story's page-composition/test-scaffolding work against mocked data now, with real wiring following once 1.3a/1.3b ship.
- [ ] **Prerequisite hook accepted:** Story `1-3c-build-the-reusable-infinite-scroll-hook` exists (`ready-for-dev`, not yet implemented) as the Gate 2 finding's resolution (see Dev Notes). Confirm it will be implemented first, or explicitly accept this story temporarily hand-rolling the scroll-trigger logic inline pending Story 1.3c (not recommended — Story 2.2/Epic 5 would then re-diverge from a shared implementation).
- [ ] **Image data gap accepted:** Story `1-2a-create-posts-table-and-link-seeded-events-to-their-source-post` is `backlog`. Confirm cards may render without real images (via `EventCard`'s existing fallback/placeholder, Story 1.3b AC3) until 1.2a and Story 1.3a's AC6 land — not a blocking gap for this story.
- [ ] Architecture and API/data boundaries confirmed (GraphQL-only; AD-1/AD-2/AD-4).
- [ ] Testing plan reviewed (Vitest/MSW integration tests + one Playwright E2E happy path).
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from swept `epic-1-readiness.md` (no new gap for this story); Gate 2 re-run fresh on this regeneration pass, confirmed no gap (prior 1.3c split already resolved it).
- [ ] Human approval to start coding granted (pending)

## Testing Requirements

- Integration coverage (Vitest + MSW) for the ongoing/upcoming default filter semantics.
- Integration coverage for paginated append behavior (second page appends, does not replace).
- Integration coverage for skeleton/spinner/empty/error state rendering.
- One E2E happy-path flow (Playwright) for discovery page initial load plus infinite-scroll append.

## Deliverables Checklist

- [ ] Discovery page (`apps/web/src/app/[locale]/page.tsx`) renders a live `EventCard` grid from the events GraphQL query.
- [ ] Infinite-scroll append wired via the shared `useInfiniteScroll` hook (Story 1.3c).
- [ ] Skeleton state for initial load; localized spinner for next-page fetch.
- [ ] Localized empty and error states.
- [ ] `en`/`id` message keys added for all new page copy.
- [ ] Integration and E2E tests written and passing.

## Out of Scope

- Search (Story 1.4) and type/category filtering (Story 1.5) — no search bar or Filter Hub in this story.
- Favoriting / Quick Favorite affordance (Story 2.1/2.1a) — `EventCard`'s favorite slot stays unwired (per Story 1.3b AC7).
- "Nearby"/geo-distance default view and location-based fallback (Story 2.5/2.5a) — this story's default is ongoing/upcoming only, not location-based.
- Event detail modal/navigation on card click (Story 1.6/1.6a).
- The events GraphQL resolver itself (Story 1.3a), the `EventCard` component itself (Story 1.3b), and the infinite-scroll hook itself (Story 1.3c) — this story only consumes all three.
- Calendar/weekly view toggle (per `design-artifacts/D-Design-System/01-event-list-view.md`'s "View Toggles") — no Epic 1 story maps to it for the main discovery page; owned by Story 3.7 (Feed page) per PRD FR26. `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` describes this toggle in more generic terms that could be misread as applying to the main discovery page too — flagged during this regeneration's Gate 2 pass as a documentation-consistency item to resolve outside this story, not a scope change here.

## Definition of Done

- Acceptance criteria (AC1-AC8) satisfied.
- Required integration and E2E tests pass.
- Lint and type checks pass for `apps/web` and any touched shared packages.
- `en`/`id` locale files updated with all new message keys (AD-6).

## Completion Status

Not started.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
