# Story 5.5: Integrate manual post selection into the getting started wizard

## Story Details

- Epic: 5
- Story ID: 5.5
- Status: ready-for-dev

## Story

As a new user,
I want to be prompted to select posts for extraction immediately after subscribing to new accounts in the getting started wizard,
so that I can get events into my feed right away.

## Acceptance Criteria

1. **Given** I am in the getting started wizard (`/wizard/onboarding/subscribe`),
2. **And** I have just added a new subscription,
3. **When** I click "Complete" or "Next Step" to complete the subscription step,
4. **Then** I am taken to the "Manual Post Selection" screen (`/posts/select` with the new subscription pre-selected).
5. **And** the tab for the newly added subscription is automatically activated, using the `isNewlyAdded` flag surfaced by the `mySubscriptions` query (Story 3.2, extended by Story 5.1a); the flag is cleared via `markSubscriptionViewed` (Story 5.1a) once the tab is opened.

## Tasks / Subtasks

- [ ] **Task 1: Wizard Completion Navigation Wiring** (AC: 1, 2, 3, 4)
  - [ ] Update `/wizard/onboarding/subscribe` completion or navigation logic to set the exit/redirect path to `/posts/select` when completing the subscription onboarding step.
  - [ ] Alternatively, register `/posts/select` as the final completion target or a custom step in the wizard configuration or the `exitPath` parameters.
- [ ] **Task 2: Tab Selection Continuity Verification** (AC: 5)
  - [ ] Ensure the manual post selection screen `/posts/select` correctly reads and acts upon the `isNewlyAdded === true` flag on first visit from the wizard, selects that tab automatically, and calls the `markSubscriptionViewed` mutation.
- [ ] **Task 3: Integration and E2E Verification Tests** (AC: All)
  - [ ] Write integration and E2E tests in `apps/web/e2e/wizard-onboarding.spec.ts` or similar files verifying the end-to-end wizard flow: subscribing to an account, completing the onboarding wizard, and verifying automatic redirection to the `/posts/select` screen with the correct account tab activated.

## Dev Notes

- **Wizard Registry integration**: The onboarding wizard is configured in `apps/web/src/features/wizard/wizard-registry.ts`.
- **Automatic navigation**: Ensure the `exitPath` or completion route resolves locale-aware and properly routes to the `/posts/select` URL.
- **Auto-activation**: Handled page-side in Story 5.1's `/posts/select` screen using the `isNewlyAdded` flag. This story ensures the onboarding completion path points precisely to that page to close the loop.

### Architecture & UX Gate Findings

- **Gate 1/3 (Sourced from epic readiness):** Fully unblocked. Redirection and tab selection state contracts are established on top of existing Epic 0 `/wizard` primitives and Epic 5's manual selection page.
- **Gate 2 (UI Complexity & Reusability):** FRESH. This is an integration task wiring existing pages and wizard setups, requiring no new complex UI splits.

### Data Type Compatibility & Migration Requirements

- No changes required. reuses existing flags.

### Project Structure Notes

- Configuration of onboarding wizard: `apps/web/src/features/wizard/wizard-registry.ts`
- Form/Step completion logic: `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`

## Global Rules References

- [x] project-context.md
- [x] story-content-structure.md
- [x] architecture spine
- [x] infrastructure docs

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Update `apps/web/src/features/wizard/wizard-registry.ts` or onboarding components to configure redirection on onboarding completion.
  - Update e2e tests or integration tests to assert correct transition.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- [ ] Integration tests
- [ ] E2E tests

## Deliverables Checklist

- [ ] Redirection configured from `/wizard/onboarding/subscribe` completion to `/posts/select`
- [ ] Automatic tab pre-activation on landing from wizard
- [ ] E2E / integration test asserting the redirect transition

## Out of Scope

- Creating the `/posts/select` page (Story 5.1)
- Subscribing mechanics (Story 3.2)

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

claude-3-5-sonnet

### Debug Log References

### Completion Notes List

### File List
