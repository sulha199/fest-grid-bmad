# Story 6.4: Autocomplete voted accounts when subscribing

## Story Details

- Epic: 6
- Story ID: 6.4
- Status: ready-for-dev

## Story

As a user,
I want voted accounts to appear as suggestions when I'm adding a BYOK subscription,
So that I can easily subscribe to an account that's already in demand.

## Acceptance Criteria

1. **Given** I have at least one Gemini API key and am on the subscribe form (Story 3.1/3.2),
2. **When** I start typing a platform/handle/display name,
3. **Then** I see matching, not-yet-subscribed voted accounts as ranked suggestions, fetched via `votedAccountSuggestions` (Story 6.1a).
4. **And** selecting a suggestion pre-fills the subscribe form with that account's known details rather than requiring me to re-enter them.
5. **And** subscribing to a suggested account still goes through the existing `subscribeToAccount` mutation (Story 3.1/3.2) unchanged — this story only adds a suggestion source to an existing form, it does not alter how a subscription is created.

## Tasks / Subtasks

- [ ] Task 1 (AC: 1, 2, 3): Wire Autocomplete Suggestion Query in subscribe dialog
  - [ ] Reopen `SubscribeAccountDialog` (Story 3.2)
  - [ ] Add active lookup on input change fetching matching voted accounts via `votedAccountSuggestions` query (debounced)
  - [ ] Render suggestions in a dropdown list matching standard autocomplete design patterns
- [ ] Task 2 (AC: 4, 5): Implement Selection and Pre-fill Flow
  - [ ] On suggestion click/select, populate platform and handle input fields with suggestion details
  - [ ] Ensure subscription on submit still triggers standard `subscribeToAccount` mutation unchanged
  - [ ] Test form submission on suggested items to ensure standard onboarding/subscriptions logic applies

## Dev Notes

- Reuses `votedAccountSuggestions` query designed in Story 6.1a
- Integrates directly onto `SubscribeAccountDialog.tsx` (apps/web/src/app/[locale]/settings/subscriptions/)

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `RankedAccountVote` and `SocialMediaAccountProfile` query types.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required.

### Project Structure Notes

- Dialog modified in `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`
- Rule Mapping:
  - Autocomplete: Debounce with React state
  - Skeletons: Local skeletons for autocomplete items while query is fetching
- Verification Plan:
  - Integration tests verifying `votedAccountSuggestions` fetching triggers on inputs.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Integration test verifying typing in the input displays correct suggestions.
- [ ] E2E test verifying complete autocomplete click to pre-fill subscription flow.

## Deliverables Checklist

- [ ] Integration of voted suggestions dropdown on standard subscribe form
- [ ] Selection pre-fill binding on SubscribeAccountDialog

## Out of Scope

- Modifying the backend subscription mutations (must remain unchanged)

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro

### Debug Log References

### Completion Notes List

### File List
