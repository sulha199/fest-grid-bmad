# Story 5.3: Display and enforce API quota

## Story Details

- Epic: 5
- Story ID: 5.3
- Status: ready-for-dev (AC6 amendment; AC1-AC5 already delivered)

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
6. **AC6 — SummaryBar no longer traps mobile users behind it (added 2026-08-24 via `bmad-correct-course`, from a fresh `ux-rework.md` note: "any element with `fixed` & `bottom-0` class always overlap the navbar/sidebar... when user in posts/select page, they cannot escape the page"):** And `SummaryBar`'s `fixed bottom-0 ... z-50` no longer occupies the exact same screen position as the app's mobile bottom tab bar (`AppShell`'s `nav.bottom_tab_bar`, `fixed inset-x-0 bottom-0`, visible `<768px`). Confirmed root cause by direct code read: `SummaryBar` (`summary-bar.tsx`) is the **only** offender of this pattern anywhere in the app (`packages/ui`'s two other `fixed .. bottom-0` uses — `AppShell`'s own nav bar and `UserMenu`'s mobile bottom sheet — are the legitimate owners of that position, not bugs) — and it renders **unconditionally** on `/posts/select` (not gated on `selectedCount > 0`), so on any mobile viewport the bottom tab bar is permanently covered by `SummaryBar`'s higher `z-50`, with no way to tap Discover/Feed/Favorites/Calendar/Log In to leave the page. Fix: `SummaryBar`'s className changes from `fixed bottom-0 left-0 right-0 ...` to `fixed bottom-14 md:bottom-0 inset-x-0 ...` — `bottom-14` (matching `AppShell`'s own `<main>` `pb-14` reservation for the mobile tab bar's height) lifts it clear of the tab bar below `md:`; at `md:` and above the mobile tab bar doesn't exist, so `bottom-0` is correct there.

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 5) — Create `SummaryBar` component:
  - [x] Implement `SummaryBar` in `apps/web/src/features/post-selection/components/summary-bar.tsx` (or a suitable directory under features).
  - [x] Accept `selectedCount: number` and `quota: number` as props.
  - [x] Display "Selected Posts: {selectedCount} / {quota}".
  - [x] Apply red text styling if `selectedCount > quota`.
- [x] Task 2 (AC: 2, 4) — Implement client-side quota limit checks and tooltips:
  - [x] Within the manual post selection page or wrapper, prevent selection of further items if `selectedCount === quota` is reached.
  - [x] Ensure checkbox for additional posts is disabled once the quota limit is reached.
  - [x] Wrap unselected `PostCard` checkboxes or cards with a Tooltip component (e.g. using Radix Tooltip) to show "You have reached your quota limit" on hover when quota is reached.
- [x] Task 3 (AC: 3) — Disable and grey out processed posts:
  - [x] Pass `disabled={true}` to `PostCard` (Story 5.1b) if the post's `isExtracted` field is `true` from the `postsByAccount` query.
  - [x] Verify that processed cards are visually greyed out, checkboxes are disabled, and clicking them is a no-op.
- [x] Task 4 (AC: 1-5) — Unit & Integration tests:
  - [x] Write tests in `apps/web/src/features/post-selection/components/summary-bar.test.tsx` to verify standard rendering, red text styling when over-quota, and standard states.
  - [x] Write integration tests for the post selection container (or wizard step) to verify that selecting more items than allowed by `myExtractionQuota` is blocked, and tooltips are displayed correctly.
- [ ] **Task 5 (AC: 6, added 2026-08-24) — Fix mobile bottom-tab-bar overlap:**
  - [ ] In `summary-bar.tsx`, change the root `<div>`'s className from `"fixed bottom-0 left-0 right-0 ..."` to `"fixed bottom-14 md:bottom-0 inset-x-0 ..."`.
  - [ ] Manually verify on a mobile viewport (`<768px`) on `/posts/select`: the mobile bottom tab bar (Discover/Feed/Favorites/Calendar/Log In) is fully visible and tappable below `SummaryBar`, with no visual gap or overlap between the two bars.
  - [ ] Manually verify at `md:` and above: `SummaryBar` sits flush at the viewport bottom exactly as before (no regression for desktop/tablet, where the mobile tab bar doesn't render).
  - [ ] Add/update a `summary-bar.test.tsx` case asserting the className contains `bottom-14` and `md:bottom-0` (a plain class-string assertion — real cross-element overlap can't be meaningfully asserted in jsdom, this is a regression guard against the className being reverted, not a layout test).

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

- [x] Completed (AC1-AC5, original — all tasks implemented and 100% verified via unit and integration tests)

**2026-08-24 (`bmad-correct-course`):** Reopened for AC6 only (mobile bottom-tab-bar overlap fix, sole real repro found for a fresh `ux-rework.md` note — see Section below in the batch proposal). AC1-AC5 unaffected. This item was small/self-contained enough to root-cause and spec directly rather than route through a separate `bmad-help` triage pass.

### Change Log

- Created `SummaryBar` component tracking selected count and quota remaining.
- Wired real-time `myExtractionQuota` query to display the user's actual extraction quota.
- Configured client-side checks and tooltip warnings when the quota limit is reached.
- Disabled and greyed out already-processed posts in the grid.
- Wrote unit tests for `SummaryBar` and integration tests for posts-select-content verifying quota limits and displays.

### File List

- `apps/web/src/features/post-selection/components/summary-bar.tsx`
- `apps/web/src/features/post-selection/components/summary-bar.test.tsx`
- `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`
- `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx`
- `apps/web/src/features/posts/queries.graphql`
- `apps/web/src/generated/graphql.ts`

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro

### Debug Log References

### Completion Notes List

### File List
