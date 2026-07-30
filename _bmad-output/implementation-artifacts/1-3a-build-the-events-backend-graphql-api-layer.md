# Story 1.3a: Build the events backend GraphQL API layer

## Story Details
- **Epic:** 1
- **Story ID:** 1.3a
- **Story Key:** 1-3a-build-the-events-backend-graphql-api-layer
- **Status:** ready-for-dev

## Story
**As a** developer,
**I want** a backend GraphQL API layer that resolves event queries using the Unified Query DSL (AD-1/AD-2) against the database,
**So that** every event discovery feature (list, search, filter, details, and later favorites/calendar views) retrieves data through one consistent, secure API instead of the frontend accessing the database directly.

## Acceptance Criteria
- **AC1:** **Given** the GraphQL server scaffold, Code Generator pipeline, and `buildOptimizedDrizzleSelect` utility exist (Story 0.8), and the initial database tables and mock data exist (Stories 1.1, 1.2), **When** a client sends a Unified Query DSL request (AD-1) to the backend GraphQL API, **Then** the backend resolves it against the database via Drizzle, using `buildOptimizedDrizzleSelect` (Story 0.8) to fetch only requested fields, and returns matching events with pagination support.
- **AC2:** The API supports filtering by name/performer/location (`contains`), type/category (`in`), and combining conditions with `and`/`or`, per AD-1.
- **AC3:** The API supports fetching a single event by ID for the detail view.
- **AC4:** No package outside `apps/backend` imports the database/domain layer directly — `apps/web` only talks to events data through this API (e.g. via generated `graphql-request` types from Story 0.8).

## Tasks / Subtasks
- [ ] 1. Define the GraphQL schema for Event queries, specifically implementing the Unified Query DSL input types as defined in AD-1 (operator, conditions, field, value) (AC1, AC2).
- [ ] 2. Create the backend resolver for fetching multiple events with pagination (limit/offset or cursor based) (AC1).
- [ ] 3. Create the backend resolver for fetching a single event by ID (AC3).
- [ ] 4. Implement the logic to map the Unified Query DSL JSON representation to Drizzle ORM `where` conditions, correctly handling the recursive nature of `and`/`or` operators (AC1, AC2).
- [ ] 5. Apply the `buildOptimizedDrizzleSelect` utility to restrict fetched columns based on the GraphQL requested fields (AC1).
- [ ] 6. Write unit tests for the DSL-to-Drizzle mapping logic.
- [ ] 7. Write integration tests to verify the resolvers query the database accurately (AC2).
- [ ] 8. Ensure no frontend code is inadvertently added to connect to the database directly (AC4).

## Dev Notes
- **Architecture Gate Findings:** No architectural gaps found for this layer itself as this story is dedicated to creating the backend layer.
- **Cross-Cutting Dependency Gate Findings:** This story strongly relies on Epic 0 Story `0-8` (GraphQL Server Scaffold, Code Generator, and `buildOptimizedDrizzleSelect`) which is currently in the `backlog`. It is recommended to complete `0-8` before or in parallel with `1-3a`.
- **Data Type Compatibility & Migration Requirements:** No changes required to DB schema or existing TypeScript interfaces as this story just adds the API layer on top of what 1.1 and 1.2 created.
- **API Style:** Must use GraphQL.
- **Unified Query DSL (AD-1):** Has a recursive structure `{"operator": "and"|"or", "conditions": [...]}` where conditions can be terminal `{field, operator, value}` or nested objects. Ensure the Drizzle query correctly builds this recursive WHERE clause.
- Ensure the backend resolvers are placed properly inside `apps/backend`, while any pure query builder logic is inside `packages/domain` without React/frontend dependencies.

## Global Rules References
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (Specifically AD-1 and AD-2)
- `_bmad-output/planning-artifacts/epics.md`

## Implementation Plan (Rule-Compliant)
- **File Change Plan:**
  - `apps/backend/src/graphql/schema/...` (add events schema and DSL input types)
  - `apps/backend/src/graphql/resolvers/...` (add events query resolvers)
  - `packages/domain/src/events/...` (business logic for parsing Unified Query DSL to Drizzle ORM syntax, if not fully handled generically)
  - `apps/backend/src/test/...` (integration tests for the resolvers)
- **Rule Mapping:**
  - *API Style (GraphQL)* -> Handled by implementing GraphQL schema/resolvers.
  - *Optimized DB Queries* -> Handled by using `buildOptimizedDrizzleSelect` inside resolvers.
  - *Code Organization (Domain vs UI)* -> Ensure any pure Drizzle querying helper logic for events lives in `packages/domain` without any React or frontend dependencies.
- **Verification Plan:**
  - Write unit tests in `packages/domain` to test the DSL-to-Drizzle query mapping logic.
  - Write integration tests in `apps/backend` using Vitest to execute the GraphQL event queries against a mock/test database and verify the response format.

## Pre-Coding Approval Gate
- [ ] Prerequisite story `0-8-set-up-graphql-server-scaffold-code-generator-pipeline-and-the-optimized-select-query-utility` is confirmed DONE, or user explicitly accepts working on this with a mocked `buildOptimizedDrizzleSelect`.
- [ ] Scope confirmed: Only building the backend API layer. No frontend changes.
- [ ] Architecture confirmed: Follows AD-1 and AD-2 from Architecture Spine.
- [ ] Testing plan confirmed: Unit tests for DSL parser, Integration tests for resolvers.

## Testing Requirements
- **100% unit test coverage** for the logic parsing the Unified Query DSL inside `packages/domain`.
- Integration tests verifying the GraphQL resolvers work correctly with Drizzle against a database.

## Deliverables Checklist
- [ ] GraphQL Schema for Events and Unified Query DSL defined.
- [ ] `events` query resolver implemented with pagination and `buildOptimizedDrizzleSelect`.
- [ ] `event(id)` query resolver implemented.
- [ ] DSL-to-Drizzle mapping logic implemented.
- [ ] Unit and integration tests written and passing.

## Out of Scope
- Any frontend UI development (handled by 1.3, 1.4, 1.5).
- Any write mutations for events (handled in epic 4).
- Base GraphQL server boilerplate and `buildOptimizedDrizzleSelect` utility (handled by 0.8).

## Definition of Done
- [ ] All ACs are met.
- [ ] Required tests passing.
- [ ] Lint and type checks passing for touched packages.

## Completion Status
Incomplete

## Dev Agent Record
- None yet.
