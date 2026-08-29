# Story 7.1a: Build the shared EventFilterInput query layer

## 1. Epic Context
**Epic 7:** AI Prompt-Based Custom Event Filter
A user with a saved Gemini API key can describe what they're looking for in a free-text prompt and immediately see matching Discovery results, as a faster alternative to FilterHub's manual controls.

## 2. User Story
**As a** developer,
**I want** a single typed `EventFilterInput` GraphQL input (Section 4.18) that FilterHub's manual controls, the Embeddable Widget, and AI Event Filters all resolve to, with the events query condition builder extended to translate every field on it,
**So that** Story 7.2a's AI-resolved filters and the Widget's persisted filter combination both apply through the exact same, single query path Discovery already uses — not a second, divergent filter mechanism.

## 3. Acceptance Criteria
- [x] **Given** `events.graphql`'s existing `EventsQueryCondition`/Unified Query DSL and `resolvers.ts`'s `buildEventsQueryCondition`/`fieldMap` already implement most of `EventFilterInput`'s fields.
- [x] **When** the new `EventFilterInput` GraphQL input type (with `DateRangeFilter`, `LocationFilter`, and the `DateAnchor`/`DateOffsetUnit`/`DayOfWeek` enums, Section 4.18) is added,
- [x] **Then** the query resolver accepts it as a single structured argument (in addition to, not replacing, the existing flat DSL args other callers already depend on).
- [x] **And** `buildEventsQueryCondition` gains three genuinely new translations: 
    - `dateRange` (an anchor+offset expression, e.g. `{THIS_WEEK, +1, WEEK}`, resolved against the current server date into a concrete start/end range at query time — never stored or matched as a frozen date) composed with `dayOfWeek` via AND when both are present.
    - `location.adminArea` (an exact/normalized match against `LocationDetails.adminArea`, Section 4.3, mutually exclusive with `location.coordinates`/`radiusMeters` — the resolver rejects a request setting both).
    - `venueType`/`isFree` (exact-match conditions against `LocationDetails.venueType` and `Schedule.ticketPrice` respectively, following the existing exact-match pattern).
- [x] **And** `widgets.graphql`'s `Widget.filters` field (currently untyped `JSON!`, Story 6.5a) is migrated to `EventFilterInput!` — the underlying storage stays JSONB (no new column), but the GraphQL layer now validates and types it, and Story 6.7's public widget page resolves it through this same translation instead of ad hoc JSON access.

## 4. Developer Context & Guardrails

## 5. Tasks
- [x] 1. Add `DateAnchor`, `DateOffsetUnit`, `DayOfWeek`, `DateRangeFilterInput`, `LocationFilterInput`, and `EventFilterInput` to `events.graphql`.
- [x] 2. Update `Widget.filters` type in `widgets.graphql` from `JSON` to `EventFilterInput`.
- [x] 3. Update the type definitions in `packages/domain/src/events/buildEventsQueryCondition.ts` to receive `EventFilterInput` fields.
- [x] 4. Implement dynamic date logic in `buildEventsQueryCondition.ts` for translating `dateRange` and `dayOfWeek` to concrete start/end `QueryCondition`s.
- [x] 5. Implement logic for `adminArea`, `venueType`, and `isFree` matching in `buildEventsQueryCondition.ts`.
- [x] 6. Ensure `location.adminArea` and `location.coordinates` throw an error or reject gracefully when mutually specified.
- [x] 7. Update `apps/backend/src/schema/resolvers.ts` to map incoming GraphQL arguments to `buildEventsQueryCondition`.
- [x] 8. Write comprehensive unit tests in `buildEventsQueryCondition.test.ts`.

## 6. Project Context Reference
- Consult `_bmad-output/project-context.md` for typescript strict rules and linting.
- Follow GraphQL Code Generator pipelines (running `pnpm codegen` is required).

## 7. Status Update
- Set story status to "done".
- Ultimate context engine analysis completed - comprehensive developer guide created.


### Review Findings
- [x] [Review][Patch] Missing mutual exclusivity validation for radiusMeters against adminArea [packages/domain/src/events/buildEventsQueryCondition.ts]
- [x] [Review][Defer] Timezone handling is entirely absent in the date range calculation [packages/domain/src/events/buildEventsQueryCondition.ts] — deferred, pre-existing
- [x] [Review][Defer] Missing date ranges hardcodes a 90-day window [packages/domain/src/events/buildEventsQueryCondition.ts] — deferred, pre-existing
- [x] [Review][Defer] Fallback to the epoch to guarantee zero results [packages/domain/src/events/buildEventsQueryCondition.ts] — deferred, pre-existing
- [x] [Review][Defer] No constraints or validations on offsetAmount [packages/domain/src/events/buildEventsQueryCondition.ts] — deferred, pre-existing