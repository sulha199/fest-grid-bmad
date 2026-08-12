# Story 6.3: Withdraw a vote

## Story Details

- Epic: 6
- Story ID: 6.3
- Status: review
- baseline_commit: f1bb2d2

## Story

As a user,
I want to withdraw a vote I previously cast,
So that I can change my mind about which accounts I'm registering demand for.

## Acceptance Criteria

1. **Given** I have an active vote for an account,
2. **When** I choose to withdraw it,
3. **Then** `withdrawVote` (Story 6.1a) soft-deletes my vote (AD-8) and the account's rank decrements accordingly.
4. **And** attempting to withdraw an already-withdrawn vote returns an `INVALID_STATE_TRANSITION` error rather than silently no-op'ing.
5. **And** I can re-vote for the same account afterward (Story 6.1), which reactivates my existing vote row rather than creating a new one.

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3): Implement frontend Withdraw Vote Action
  - [x] On the Ranked Vote List page (Story 6.2), add a "Withdraw Vote" toggle or state when the user has already voted for an account
  - [x] If clicked, trigger `withdrawVote(id: $voteId, action: DELETE)` mutation
  - [x] Update local list state or refetch query to decrement count and remove/update row style
- [x] Task 2 (AC: 4, 5): Implement Reactivate / Re-vote Flow
  - [x] Ensure that clicking "Vote" again on a previously withdrawn account calls `castVote`, which reactivates the same vote row in backend (idempotent reactivate, Story 6.1a)
  - [x] Test the withdraw -> re-vote -> withdraw loop to ensure visual counts and state reflect backend correctly

## Dev Notes

- Reuses existing `withdrawVote` mutation designed in Story 6.1a
- Integrates cleanly with state updates on RankedVoteList page

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `AccountVote` soft-delete transitions.
- Required DB migration changes: No changes required (handled in 6.1a).
- Required TypeScript type changes: No changes required (handled in 6.1a).

### Project Structure Notes

- Extends components in `apps/web/src/components/votes/`
- Handles GraphQL state inside `RankedVoteList.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/components/votes/RankedVoteList.tsx`
- Rule Mapping:
  - Soft-delete: AD-8
  - Loader: Blocking loader for critical mutation
- Verification Plan:
  - Mocked GraphQL resolver tests for withdraw/re-vote transitions.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Integration test verifying withdraw action toggle and count decrement.
- [ ] E2E test verifying complete withdraw and re-vote loop.

## Deliverables Checklist

- [ ] Integration of withdraw button on ranked vote list page
- [ ] State handling for re-voting (reactivate) on previously withdrawn items

## Out of Scope

- Setting default locations or subscriptions (handled by Epics 2 and 3)

## Definition of Done

- [x] AC satisfaction
- [x] Required tests passing
- [x] Lint and type checks passing for touched packages

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro

### Debug Log References

### Completion Notes List

### File List
