# Story 5.3: Display and enforce API quota

## Story Details

- Epic: 5
- Story ID: 5.3
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see how many posts I can select for extraction based on my API quota, and see which posts have already been processed,
so that I can manage my API usage effectively and avoid redundant extractions.

## Acceptance Criteria

1. **Real-time Selection Tracking (AC1):** A summary bar displays the number of selected posts against my remaining API quota, read from the `myExtractionQuota` query (Story 5.1a).
2. **Quota Enforcement (AC2):** I am prevented from selecting more posts than my quota allows, enforced both client-side (UX) and authoritatively server-side by the `selectPostsForExtraction` mutation (Story 5.1a) — the client-side check is a convenience only.
3. **Disable Already Processed (AC3):** Posts that have already been processed are visually disabled and cannot be selected, using each post's `isExtracted` field from the `postsByAccount` query (Story 5.1a).
4. **Quota Tooltip Warning (AC4):** If the user tries to select more posts than their remaining quota allows, the checkbox for the additional post is disabled, and a tooltip appears on hover, saying "You have reached your quota limit."
5. **Red Text Over Quota (AC5):** The text in the summary bar is colored red if the selected count exceeds the quota.

## Tasks / Subtasks

- [ ] Task 1 (AC: 1, 5) — Create `SummaryBar` component:
  - [ ] Implement `SummaryBar` in `apps/web/src/features/post-selection/components/summary-bar.tsx` (or a suitable directory under features).
  - [ ] Accept `selectedCount: number` and `quota: number` as props.
  - [ ] Display "Selected Posts: {selectedCount} / {quota}".
  - [ ] Apply red text styling if `selectedCount > quota`.
- [ ] Task 2 (AC: 2, 4) — Implement client-side quota limit checks and tooltips:
  - [ ] Within the manual post selection page or wrapper, prevent selection of further items if `selectedCount === quota` is reached.
  - [ ] Ensure checkbox for additional posts is disabled once the quota limit is reached.
  - [ ] Wrap unselected `PostCard` checkboxes or cards with a Tooltip component (e.g. using Radix Tooltip) to show "You have reached your quota limit" on hover when quota is reached.
- [ ] Task 3 (AC: 3) — Disable and grey out processed posts:
  - [ ] Pass `disabled={true}` to `PostCard` (Story 5.1b) if the post's `isExtracted` field is `true` from the `postsByAccount` query.
  - [ ] Verify that processed cards are visually greyed out, checkboxes are disabled, and clicking them is a no-op.
- [ ] Task 4 (AC: 1-5) — Unit & Integration tests:
  - [ ] Write tests in `apps/web/src/features/post-selection/components/summary-bar.test.tsx` to verify standard rendering, red text styling when over-quota, and standard states.
  - [ ] Write integration tests for the post selection container (or wizard step) to verify that selecting more items than allowed by `myExtractionQuota` is blocked, and tooltips are displayed correctly.

## Dev Notes

- Reuses `myExtractionQuota` query from Story 5.1a.
- Reuses `isExtracted` field from the `postsByAccount` query (Story 5.1a).
- Uses `PostCard` component built in Story 5.1b.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture) / Gate 3 (Foundational Dependencies):** Sourced from the approved Epic 5 readiness sweep (`epic-5-readiness.md`, `swept: true`). The sweep identified that no backend layer existed for Epic 5's data needs, which led to the creation of prerequisite Story 5.1a (providing `myExtractionQuota`, `postsByAccount`, and `selectPostsForExtraction`). No other architecture or infrastructure gaps exist for Story 5.3.
- **Gate 2 (UI Complexity & Reusability):** Conducted Gate 2 fresh. Reusable post rendering is already split into its own prerequisite `PostCard` story (Story 5.1b). The `SummaryBar` is a simple presentation element showing counts and state-driven styling, which does not meet the reuse threshold for an independent split. No additional splits are required.

### Data Type Compatibility & Migration Requirements

- No changes required. Data model support is fully established by prerequisite Story 5.1a (for `myExtractionQuota`, `Post.isExtracted`, and the `selectPostsForExtraction` mutation).

### Project Structure Notes

- Follows the established directory structures in `apps/web`. Feature-specific UI components are placed in `apps/web/src/features/post-selection/components/` and unit tested next to their files.

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-5-readiness.md#Epic 5 Readiness Sweep]
- [Source: design-artifacts/D-Design-System/02-post-selection-view.md#Components]
- [Source: design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.6-quota-management-display.md#On-Page Interactions]
- [Source: design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.5-manual-post-selection.md#Summary Bar]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/web/src/features/post-selection/components/summary-bar.tsx` (New component)
  - `apps/web/src/features/post-selection/components/summary-bar.test.tsx` (New unit tests)
  - Integration within the manual post selection screen page file (e.g. `apps/web/src/app/[locale]/wizard/getting-started/post-selection/page.tsx` or similar as created by Story 5.1)
- **Rule Mapping:**
  - *Unified Project Structure:* Kept under `apps/web/src/features/post-selection/`.
  - *Testing standard:* Vitest + React Testing Library for frontend component unit/integration coverage.
- **Verification Plan:**
  - Run Vitest tests: `pnpm --filter web test` or similar.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Integration tests
- [ ] E2E tests

## Deliverables Checklist

- [ ] `apps/web/src/features/post-selection/components/summary-bar.tsx`
- [ ] `apps/web/src/features/post-selection/components/summary-bar.test.tsx`

## Out of Scope

- Full multi-step wizard logic (owned by Story 0.24 and Story 5.5).
- Underlying query/mutation implementation (owned by Story 5.1a).
- `PostCard` core rendering (owned by Story 5.1b).

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro

### Debug Log References

### Completion Notes List

### File List
