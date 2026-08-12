# Story 6.2: View the ranked vote list

## Story Details

- Epic: 6
- Story ID: 6.2
- Status: in-progress
- baseline_commit: b1d0404

## Story

As a user,
I want to see social media accounts ranked by vote count, optionally weighted toward accounts popular near me,
So that I can see what's currently in demand.

## Acceptance Criteria

1. **Given** I navigate to the vote list,
2. **When** the page loads,
3. **Then** I see every voted, not-yet-subscribed account ranked by vote count descending, fetched via `rankedVoteAccounts` (Story 6.1a).
4. **And** I can toggle a "Near Me" view, which re-weights the ranking using one of my saved locations (Story 2.3a), without ever displaying or persisting any voter's individual location (PRD §3.13, NFR26).
5. **And** a per-account region breakdown, when I open it, shows vote counts bucketed by city/province (`voteRegionBreakdown`, Story 6.1a); any region with fewer than 5 distinct voters is simply absent from the results, not shown as a small/zeroed count.
6. **And** an account is not shown in this list once any user has an active subscription to it (Story 3.1/3.2) — it becomes visible again if that subscription is later removed, with its prior vote count intact.

## Tasks / Subtasks

- [ ] Task 1 (AC: 1, 2, 3, 6): Implement Ranked Vote List Page Shell & Main Query
  - [ ] Create route file at `apps/web/src/app/[locale]/votes/page.tsx`
  - [ ] Fetch ranked vote list using `useRankedVoteAccountsQuery` hook
  - [ ] Render accounts in ranked order with display names, platform icons, handles, and active vote counts
- [ ] Task 2 (AC: 4): Implement "Near Me" Proximity Weighting Toggle
  - [ ] Add "Near Me" switch/toggle on the Ranked Vote List page
  - [ ] If toggled, check if user has active saved location preferences (`useGetMyLocationsQuery`)
  - [ ] If locations exist, pass `nearMe: true` and the location preference ID to the `rankedVoteAccounts` query
  - [ ] Render the re-weighted order returned by the query safely without displaying voter coords
- [ ] Task 3 (AC: 5): Implement Per-Account Region Breakdown Dialog
  - [ ] Design a slide-over sheet or modal dialog displaying region counts
  - [ ] Fetch breakdown details on demand using `useVoteRegionBreakdownQuery` on account row expand/click
  - [ ] Display list of regions with vote counts, correctly hiding any regions suppressed by backend (< 5 count)

## Dev Notes

- Reuses existing UI components and icons
- Reuses map-picker/location-preference context if needed
- Leverages `rankedVoteAccounts` and `voteRegionBreakdown` queries designed in Story 6.1a

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `SocialMediaAccountProfile` and `RegionVoteBucket` shapes.
- Required DB migration changes: No changes required (handled in 6.1a).
- Required TypeScript type changes: No changes required (handled in 6.1a).

### Project Structure Notes

- Route page belongs in `apps/web/src/app/[locale]/votes/`
- Custom components belong in `apps/web/src/components/votes/`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/app/[locale]/votes/page.tsx` (new)
  - `apps/web/src/components/votes/RankedVoteList.tsx` (new)
  - `apps/web/src/components/votes/RegionBreakdownSheet.tsx` (new)
- Rule Mapping:
  - Security/Anonymity: Omit <5 buckets (handled by backend but UI must display as is)
  - Loader: Non-blocking initial load skeletons
- Verification Plan:
  - Integration tests verifying Ranked List page query variables mapping and Near Me toggle state changes.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Integration tests verifying toggle active state queries and location selector mapping.
- [ ] E2E tests verifying complete vote list rendering and Near Me re-sorting behavior.

## Deliverables Checklist

- [ ] Votes page route rendering list of accounts ranked by votes
- [ ] Near Me proximity toggle component mapped to location preference
- [ ] Region breakdown sheet displaying bucketed voter counts

## Out of Scope

- Setting or managing saved locations (handled by Story 2.3/2.4)

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [/] In progress

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro

### Debug Log References

### Completion Notes List

### File List
