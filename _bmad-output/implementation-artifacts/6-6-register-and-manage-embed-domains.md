# Story 6.6: Register and manage embed domains

## Story Details

- Epic: 6
- Story ID: 6.6
- Status: review
- baseline_commit: 153b22f

## Story

As a registered user,
I want to manage the whitelist of allowed domains for each of my widgets,
So that I can control exactly where my widget is allowed to be rendered (PRD §3.13) and protect my API keys/extraction quotas.

## Acceptance Criteria

1. **Given** I am on the widget management screen (Story 6.5),
2. **When** I click "Manage Domains" on a widget,
3. **Then** I see the list of active registered domains for that widget (`embedDomainsForWidget`, Story 6.6a).
4. **And** I can type and add a new domain pattern (`registerEmbedDomain`, Story 6.6a) which validates and registers, updating the list immediately with non-blocking feedback.
5. **And** I can deregister a domain pattern (`deregisterEmbedDomain`, Story 6.6a), which soft-deletes the pattern immediately with an Undo toast option (Story 0.18).
6. **And** the UI enforces the exact-match or `*.` wildcard format constraints client-side before submission, preventing invalid input styles without requiring a round-trip error.

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3, 6): Implement Domain Management Dialog
  - [x] On the widgets list page (Story 6.5), add a "Domains" action button next to each widget
  - [x] Clicking "Domains" opens an `EmbedDomainsDialog` fetching registered domains for that widget (`useEmbedDomainsForWidgetQuery`)
  - [x] Add client-side validation for pattern inputs, enforcing exact-hostname or wildcard format `*.<hostname>`
  - [x] Integrate `useRegisterEmbedDomainMutation` to register new patterns, with non-blocking optimistic UI or loading indicator updates
- [x] Task 2 (AC: 4, 5): Implement Deregistration and Undo Flow
  - [x] Wire domain item remove buttons to trigger `useDeregisterEmbedDomainMutation(id, action: DELETE)`
  - [x] Integrate a Toast message with an "Undo" option (Story 0.18) calling `deregisterEmbedDomain(id, action: RESTORE)` if clicked on timeout

## Dev Notes

- Reuses existing UI inputs and Dialog primitives
- Integrates soft-delete undo toast flow established in Story 0.18

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `EmbedDomain` schema types safely.
- Required DB migration changes: No changes required (handled in 6.6a).
- Required TypeScript type changes: No changes required (handled in 6.6a).

### Project Structure Notes

- New custom component: `apps/web/src/components/widgets/EmbedDomainsDialog.tsx`
- Modified main page: `apps/web/src/app/[locale]/settings/widgets/page.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/components/widgets/EmbedDomainsDialog.tsx` (new)
  - `apps/web/src/app/[locale]/settings/widgets/page.tsx`
- Rule Mapping:
  - Undo trigger: Story 0.18 undo-state primitive
  - Input: Client-side validation pattern regex
- Verification Plan:
  - Integration tests verifying `EmbedDomainsDialog` validation rules and list rendering triggers.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Integration tests verifying invalid domain patterns get rejected client-side before query.
- [ ] E2E tests verifying complete domain registration, deregistration, and Undo toast flow.

## Deliverables Checklist

- [ ] Reusable `EmbedDomainsDialog` component linked to widgets list
- [ ] Integration with soft delete Undo mechanism on domain deregistration

## Out of Scope

- Setting widget rendering constraints inside Next.js dynamic middlewares (handled in Story 6.7a)

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
