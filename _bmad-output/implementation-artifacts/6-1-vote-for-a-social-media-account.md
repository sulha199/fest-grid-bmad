# Story 6.1: Vote for a social media account

## Story Details

- Epic: 6
- Story ID: 6.1
- Status: review
- baseline_commit: 3e1e091

## Story

As a user,
I want to cast a vote for a social media account I'd like to see subscribed — either an existing entry or one I add myself,
So that I can register demand for it even without a BYOK Gemini API key.

## Acceptance Criteria

1. **Given** I am authenticated and viewing the ranked vote list (Story 6.2),
2. **When** I vote for an existing account,
3. **Then** my vote is recorded via the `castVote` mutation (Story 6.1a) and the account's rank updates to reflect the new count.
4. **And** when I instead enter a new account not yet in the system (selecting its platform and providing its handle/URL),
5. **Then** `castVote` (Story 6.1a) validates the platform against the scraper adapter registry (Story 3.3c), resolves the account's `accountId`/`displayName`/`username` via the registry's `lookupAccountProfile` method (Story 3.3c amendment, Story 3.4's concrete implementation) — never from placeholder handle text — and creates the `SocialMediaAccountProfile` record my vote is recorded against.
6. **And** if the platform is unsupported or the account can't be found on the platform, I see an error and no vote/profile is created.
7. **And** re-voting for an account I've already actively voted for does not create a duplicate vote or error — it's a no-op.
8. **And** casting a vote does not require or consume any BYOK API key quota.

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3): Implement frontend Cast Vote action for existing accounts
  - [x] Add Cast Vote button to the Ranked Vote List items (Story 6.2 page)
  - [x] Wire the button to call `castVote(input: { accountId: $accountId })` mutation
  - [x] Update local list state or refetch to show updated rank and vote count
- [x] Task 2 (AC: 4, 5, 6): Implement "Add New Account to Vote" Form
  - [x] Design form/dialog allowing user to select a platform (enum platform) and enter handle/URL
  - [x] On submit, trigger `castVote(input: { platform: $platform, handleOrUrl: $handleOrUrl })`
  - [x] Display loading overlay (blocking loader pattern) during resolution
  - [x] Handle errors: display clear platform-unsupported or profile-not-found errors to user
- [x] Task 3 (AC: 7, 8): Implement Idempotency and Quota-free display
  - [x] Ensure double clicking or re-voting is handled gracefully via mutation idempotency
  - [x] Verify that no API Key setup is required to cast a vote, and no BYOK quota is subtracted

## Dev Notes

- Reuses existing UI components from `@festgrid/ui`
- Leverages `castVote` mutation designed in Story 6.1a

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `SocialMediaAccountProfile` and `AccountVote` shapes.
- Required DB migration changes: No changes required (handled in 6.1a).
- Required TypeScript type changes: No changes required (handled in 6.1a).

### Project Structure Notes

- Frontend Form component goes in `apps/web/src/components/votes/`
- Ranked vote page is modified in `apps/web/src/app/[locale]/votes/` (Story 6.2 scope)

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/components/votes/CastVoteForm.tsx` (new)
  - `apps/web/src/app/[locale]/votes/page.tsx`
- Rule Mapping:
  - Form validation: Zod
  - Loader: Blocking loader for critical mutation
- Verification Plan:
  - Mocked GraphQL resolver tests for form submit and error handling.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [x] Integration test verifying vote submission and error state display in form.
- [x] E2E test verifying complete new account vote casting flow.

## Deliverables Checklist

- [x] `CastVoteForm` component implementing platform selection and handle entry
- [x] Integration of vote casting button on vote list page

## Out of Scope

- Scheduled scrape batch logic (this is bulk scrape, Story 3.4/6.1a scope)

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
