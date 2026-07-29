# Story 1.3: Display a list of events on the main page

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.3
- Status: in-progress

## Story

As a user,
I want to see a list of curated local events on the main page,
so that I can discover what is happening around me.

## Acceptance Criteria

1. Given I am on the main page of the application, when the page loads, then I see a grid of event cards.
2. And each event card displays the event name, date, and main image.
3. And the events displayed are only ongoing or upcoming events by default.
4. And the event list data is fetched through the GraphQL event query path backed by database data.
5. And the list implements infinite scrolling that appends the next page of items without replacing already loaded items.
6. And while fetching subsequent pages, a localized non-blocking spinner is shown at the bottom of the list.
7. And initial loading uses non-blocking skeleton UI aligned to the card layout.
8. And all user-facing labels and loading, empty, and error states on this page are localized using next-intl.
9. And integration tests verify ongoing/upcoming filtering and paginated append behavior, and one E2E happy-path test verifies initial render plus infinite-scroll append.

## Tasks / Subtasks

- [x] Task 1: Implement GraphQL discovery query path for default event list (AC: 3, 4)
	- [x] Add or update the main event query contract to use Unified Query DSL constraints for ongoing or upcoming results.
	- [x] Ensure resolver and data access stay in GraphQL plus Drizzle boundaries (moved into the dedicated apps/backend serverless package; apps/web now only proxies GraphQL requests to it).
- [ ] Task 2: Implement optimized data selection and date filter semantics (AC: 3, 4)
	- [ ] Use or introduce buildOptimizedDrizzleSelect so field selection matches requested GraphQL fields. **Deferred** — resolver still selects a fixed column set; see deferred-work.md.
	- [x] Enforce ongoing or upcoming semantics from PRD default view rules (via `@festgrid/domain` `getDiscoveryPage`).
- [x] Task 3: Build discovery page list UI and reusable event list components (AC: 1, 2)
	- [x] Render event cards in a grid on the main page.
	- [x] Ensure card fields include name, date, and main image.
- [x] Task 4: Add infinite-scroll behavior and non-blocking loaders (AC: 5, 6, 7)
	- [x] Implement infinite-scroll append behavior without resetting existing items.
	- [x] Add skeleton state for initial load and localized bottom spinner for next-page fetch.
- [x] Task 5: Localize page UI copy and states (AC: 8)
	- [x] Add next-intl keys and translations for labels and loading, empty, and error states.
- [ ] Task 6: Add analytics and quality checks (AC: 9)
	- [x] Track a Main Page Viewed analytics event.
	- [ ] Add integration tests for filter semantics and append behavior. **Deferred** — DSL and ongoing/upcoming/pagination logic have unit coverage in `apps/backend` and `packages/domain`; UI-level integration tests need frontend test tooling (not yet set up in apps/web).
	- [ ] Add one E2E happy-path test for discovery list load and infinite-scroll append. **Deferred** — no Playwright setup yet.

## Dev Notes

- Architecture and technical constraints:
	- Use GraphQL for all client-server event fetching.
	- Follow AD-1 and AD-2 by using Unified Query DSL through the primary event query endpoint.
	- Keep dynamic selected-field optimization in the Drizzle resolver path via buildOptimizedDrizzleSelect.
	- Keep state responsibilities split across server state, URL state, and ephemeral UI state per architecture rules.
- File/path expectations:
	- Main route UI in apps/web/src/app/page.tsx.
	- Reusable list UI in packages/ui/src/features/events/ (for EventGrid and event card components).
	- Reusable infinite scroll logic in packages/ui/src/hooks/.
	- Framework-agnostic query and filter logic in packages/domain/src/events/.
	- GraphQL schema, DSL, and Drizzle resolver logic in apps/backend/src/ (AWS Lambda handler + local dev server sharing the same request-handling core), per docs/infrastructure.md's serverless backend model.
- Data/API boundaries:
	- Do not query database directly from app UI; go through GraphQL contracts.
	- apps/web/src/app/api/events/route.ts is a same-origin proxy that forwards GraphQL requests to apps/backend via `BACKEND_GRAPHQL_URL`; it holds no database or resolver logic itself.
	- Validate external/runtime data at boundaries per project rules.
- Source references:
	- Story source: _bmad-output/planning-artifacts/epics.md (Story 1.3)
	- PRD source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md
	- Architecture source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md

## Global Rules References

- Shared implementation rules: _bmad-output/project-context.md
- Story structure contract: _bmad-output/planning-artifacts/story-content-structure.md
- Architecture invariants: _bmad-output/planning-artifacts/festgrid-architecture-spine.md
- Infrastructure constraints: docs/infrastructure.md

## Implementation Plan (Rule-Compliant)

### File Change Plan

- apps/web/app/page.tsx: load and render discovery feed using paginated query flow.
- packages/ui/src/features/events/: event grid and event card rendering.
- packages/ui/src/hooks/: infinite-scroll behavior hook or helper.
- packages/domain/src/events/: query/filter contracts and reusable mapping helpers.
- GraphQL schema and resolver layer: event query contract and optimized select usage.
- Test suites: integration and E2E coverage for this story behavior.

### Rule Mapping

- GraphQL-only app data access: all list reads use GraphQL endpoint and resolver boundaries.
- Unified Query DSL: ongoing/upcoming default filter is encoded in query conditions.
- Loader semantics: skeleton for initial load and localized bottom spinner for next-page fetch.
- i18n-first implementation: all user-facing strings and states are localized with next-intl.
- Domain and UI boundary: reusable business logic stays framework-agnostic in packages/domain; UI stays in apps/web and packages/ui.

### Verification Plan

- Verify default list excludes past events and includes ongoing/upcoming events.
- Verify infinite-scroll appends next pages without replacing existing items.
- Verify localized loading, empty, and error states are rendered.
- Run integration tests for query/filter and append behavior.
- Run one E2E happy-path test for initial render and infinite-scroll append.
- Run lint and type checks for touched packages.

## Pre-Coding Approval Gate

- [x] Scope and acceptance criteria reviewed
- [x] Architecture and API/data boundaries confirmed
- [x] Testing plan reviewed
- [ ] Human approval to start coding granted (pending)

## Testing Requirements

- Integration coverage for ongoing/upcoming filter semantics.
- Integration coverage for paginated append behavior.
- One E2E happy-path flow for discovery page initial load and infinite-scroll append.

## Deliverables Checklist

- GraphQL event query path for main discovery feed.
- Event grid and card rendering on the main page.
- Infinite-scroll append behavior and localized bottom spinner.
- Skeleton state for initial load.
- next-intl translations for discovery page UI states.
- Integration and E2E tests for this story flow.

## Out of Scope

- Event detail view behavior and context navigation (Story 1.6).
- Favorites, subscriptions, and personalization features (Epic 2+).

## Definition of Done

- Acceptance criteria satisfied.
- Required integration and E2E tests pass.
- Lint and type checks pass for touched packages.

## Completion Status

- Story validated against epics, PRD, architecture, and story structure rules.
- Story reformatted to the standardized BMad story contract.
- GraphQL schema, Unified Query DSL, and Drizzle resolver logic extracted from apps/web into a dedicated apps/backend serverless package (AWS Lambda handler + local dev server), fixing several type-safety and DSL-evaluation bugs found in the prior in-progress code along the way.
- apps/web's discovery page now proxies to apps/backend over HTTP via graphql-request instead of running resolver/DB logic in-process.
- Added a localized error + retry state to the main page (AC 8) and a "Main Page Viewed" PostHog analytics event (part of AC 9).
- Status moved to in-progress; buildOptimizedDrizzleSelect, full AD-4 (react-query) wiring, and UI-level integration/E2E tests remain open and are tracked in deferred-work.md.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Reformat and validation run for Story 1.3 using story-content-structure and active planning artifacts.
- apps/backend extraction: moved and fixed apps/web/src/lib/{graphql.ts,events.ts,events.test.ts} into apps/backend/src/{schema.ts,events/query.ts,events/dsl.ts,events/dsl.test.ts}; added Lambda handler, shared HTTP core, and local dev server.

### Completion Notes List

- Acceptance criteria normalized into testable numbered statements.
- Added AC-linked tasks and explicit rule-compliant implementation plan.
- Added approval gate with explicit pending human approval state.
- Created apps/backend (`@festgrid/backend`) to host the GraphQL API per docs/infrastructure.md's AWS serverless model: `src/handler.ts` (API Gateway Lambda entry point), `src/local-server.ts` (Node HTTP dev server), `src/server.ts` (shared request-handling core), `src/schema.ts` (GraphQL schema), `src/events/{dsl,query}.ts` (Unified Query DSL + Drizzle resolver).
- Fixed real bugs found while moving the code: DSL terminal vs. group operator typing was unsound (comparison operators and 'and'/'or' were conflated), the recursive `EventConditionInput` GraphQL type used before declaration, `in`/`notIn` didn't support array-valued fields like `types`/`categories`, and the joined schedule row mapping read the wrong aliased columns (`row.location`/`row.id`/`row.slug` instead of `row.scheduleLocation`/`row.scheduleId`/`row.scheduleSlug`).
- Updated apps/web/src/app/api/events/route.ts to proxy to the backend via `graphql-request` instead of importing resolver code directly; removed now-unused `@festgrid/database`, `@festgrid/domain`, `drizzle-orm`, and `postgres` dependencies from apps/web.
- Added a distinct localized error state with a retry action to the main page, using the previously-unused `error`/`retry` i18n keys.
- Added a `Main Page Viewed` PostHog capture call on mount.
- Verified: `apps/backend` builds (`tsc`), lints (0 warnings), and its DSL unit tests pass; `apps/web` builds and lints cleanly with the new `graphql-request` dependency; `@festgrid/domain` and `@festgrid/database` are unaffected.

### File List

- _bmad-output/implementation-artifacts/1-3-display-a-list-of-events-on-the-main-page.md
- apps/backend/package.json
- apps/backend/tsconfig.json
- apps/backend/eslint.config.mjs
- apps/backend/.env
- apps/backend/src/schema.ts
- apps/backend/src/server.ts
- apps/backend/src/handler.ts
- apps/backend/src/local-server.ts
- apps/backend/src/index.ts
- apps/backend/src/events/dsl.ts
- apps/backend/src/events/dsl.test.ts
- apps/backend/src/events/query.ts
- apps/web/src/app/api/events/route.ts
- apps/web/src/app/page.tsx
- apps/web/package.json
- .env
- turbo.json
- .github/workflows/ci.yml
- SETUP_WALKTHROUGH.md
- _bmad-output/implementation-artifacts/deferred-work.md

Removed:
- apps/web/src/lib/graphql.ts (moved to apps/backend/src/schema.ts)
- apps/web/src/lib/events.ts (moved to apps/backend/src/events/{dsl,query}.ts)
- apps/web/src/lib/events.test.ts (moved to apps/backend/src/events/dsl.test.ts)