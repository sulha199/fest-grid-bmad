# Story 2.1: Favorite an event

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.1
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to be able to favorite an event,
so that I can easily find it later.

## Acceptance Criteria

1. Given I am viewing the details of an event, when I click the Favorite button, then the event is marked as a favorite.
2. And the Favorite button changes to an Unfavorite button.
3. And when I click the Unfavorite button, the event is no longer marked as a favorite.
4. And only authenticated users can favorite or unfavorite events.
5. And all user-facing labels and state messages for favorite actions are localized using next-intl.
6. And integration tests verify favorite and unfavorite mutation behavior and one E2E test covers the happy path.

## Tasks / Subtasks

- [ ] Task 1: Add favorite data path and API mutation (AC: 1, 3, 4)
  - [ ] Add GraphQL mutation and resolver contract for favorite and unfavorite actions.
  - [ ] Ensure persistence uses Drizzle-backed data access and authenticated user context.
- [ ] Task 2: Update event detail UI action state (AC: 1, 2, 3, 5)
  - [ ] Add Favorite and Unfavorite action states in event detail UI.
  - [ ] Add localized labels, success feedback, and error handling.
- [ ] Task 3: Testing and analytics hooks (AC: 6)
  - [ ] Add integration tests for favorite and unfavorite behavior.
  - [ ] Add one E2E happy-path test for favoriting and unfavoriting from event details.
  - [ ] Track analytics events for favorited and unfavorited actions.

## Dev Notes

- Architecture and technical constraints:
  - Use GraphQL for client-server data operations.
  - Keep app data access through GraphQL and Drizzle boundaries.
- File/path expectations:
  - UI updates in apps/web and reusable UI in packages/ui when generic.
  - *Pure* business logic remains framework-agnostic and DB-free in packages/domain; anything touching persistence or the auth session lives in apps/backend.
- Data/API boundaries:
  - Auth identity context is required for favorite ownership; ownership enforcement and persistence happen in apps/backend's resolver via Drizzle, never in packages/domain.
- Source references:
  - Story source: _bmad-output/planning-artifacts/epics.md (Story 2.1)

## Global Rules References

- Shared implementation rules: _bmad-output/project-context.md
- Story structure contract: _bmad-output/planning-artifacts/story-content-structure.md
- System architecture spine: _bmad-output/planning-artifacts/festgrid-architecture-spine.md
- Infrastructure constraints: docs/infrastructure.md

## Implementation Plan (Rule-Compliant)

### File Change Plan

- apps/web: add or update event detail favorite action UI behavior.
- packages/domain/src/favorites/: pure validation only (e.g. shape/type guards for the favorite mutation input). No Drizzle imports, no DB lookups, no ownership checks — those run in the resolver against the authenticated user context.
- GraphQL schema/resolver layer: add favorite/unfavorite mutation contract.
- Persistence layer with Drizzle: add favorite mapping and ownership enforcement.

### Rule Mapping

- GraphQL-only app data path: mutations and reads remain in GraphQL + Drizzle flow.
- Domain/UI boundary: reusable domain logic stays framework-agnostic; React UI remains in app/ui layers.
- i18n rule: favorite and unfavorite labels/messages are localized.
- Testing policy: integration coverage for behavior plus one E2E happy-path flow.

### Verification Plan

- Run integration tests for favorite and unfavorite mutation behavior and ownership checks.
- Run one E2E flow: favorite from event details, state toggle, then unfavorite.
- Confirm lint and type checks pass for touched packages.

## Pre-Coding Approval Gate

- [x] Scope and acceptance criteria reviewed
- [x] Architecture and data/API boundaries confirmed
- [x] Testing plan reviewed and accepted
- [x] Approval to start coding granted

## Testing Requirements

- Integration coverage for mutation behavior and persistence boundaries.
- One E2E happy-path flow from event details favorite to unfavorite.

## Deliverables Checklist

- GraphQL favorite and unfavorite mutation path.
- UI toggle behavior between Favorite and Unfavorite states.
- Localized user-facing messages for action feedback.
- Integration and E2E tests as listed.

## Out of Scope

- Favorites listing page implementation (Story 2.2).
- Calendar visual treatment updates (Story 2.6).

## Definition of Done

- Acceptance criteria satisfied.
- Required tests pass.
- Lint and type checks pass for touched packages.

## Completion Status

- Story context prepared for implementation.
- Approval to start coding granted.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Story generated from epics Story 2.1 using standardized template with concrete implementation plan and approval gate.

### Completion Notes List

- Story promoted from preview and synchronized with sprint tracking.

### File List

- _bmad-output/implementation-artifacts/2-1-favorite-an-event.md
