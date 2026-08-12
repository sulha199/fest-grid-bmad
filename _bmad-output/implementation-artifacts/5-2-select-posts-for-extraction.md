# Story 5.2: Select posts for extraction

## Story Details

- Epic: 5
- Story ID: 5.2
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to be able to select multiple posts from different subscribed accounts to be processed for event extraction,
so that I can efficiently choose which posts to process.

## Acceptance Criteria

1. **Given** I am on the "Manual Post Selection" screen,
2. **When** I click the checkbox on a post card,
3. **Then** the post is marked as selected.
4. **And** I can select multiple posts across different tabs.
5. **And** the selection state is preserved when I switch between tabs.
6. **And** there is a summary bar that shows the total number of selected posts.
7. **And** submitting my selection calls the `selectPostsForExtraction` mutation (Story 5.1a), which enqueues the chosen posts onto the `AIProcessingQueue` (Story 3.5) — not a direct database write or queue call from `apps/web`.

## Tasks / Subtasks

- [ ] **Task 1: State Management — Zustand Selection Store** (AC: 3, 4, 5)
  - [ ] Create a strictly-typed Zustand store `usePostSelectionStore` at `apps/web/src/app/[locale]/posts/select/post-selection-store.ts`.
  - [ ] Define the store state: `selectedPostIds: string[]`.
  - [ ] Define the store actions:
    - `togglePost(postId: string)`: Adds the ID if absent, removes it if present.
    - `clearSelection()`: Resets `selectedPostIds` to an empty array.
    - `isSelected(postId: string): boolean`: Returns whether a post ID is currently selected.
- [ ] **Task 2: UI Integration — Post Card Checkbox Wiring** (AC: 1, 2, 3, 4, 5)
  - [ ] In `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`, read the selection state and actions from `usePostSelectionStore`.
  - [ ] Update the `PostCard` rendering loop to pass the current selection state (e.g., `selected={isSelected(post.id)}`) and an interaction callback (e.g., `onSelectToggle={() => togglePost(post.id)}`).
  - [ ] Verify that checking a checkbox properly updates the Zustand state and reflects visually on the card.
  - [ ] Verify that switching tabs preserves the selected checkboxes, as the store survives component unmounting.
- [ ] **Task 3: Presentation — Sticky Summary Bar** (AC: 6)
  - [ ] Add a sticky/docked `SummaryBar` at the bottom of the Manual Post Selection page (colocated in `posts-select-content.tsx` or as a sub-component).
  - [ ] Display the count: `"Selected Posts: X"` where `X` is `selectedPostIds.length`.
  - [ ] Render the "Extract Events" primary button in the Summary Bar.
  - [ ] Disable the "Extract Events" button if `selectedPostIds.length === 0`.
- [ ] **Task 4: Mutation — selectPostsForExtraction Call** (AC: 7)
  - [ ] In `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`, set up the `selectPostsForExtraction` mutation using TanStack React Query (`useMutation`) and GraphQL Code Generator's typed client helper.
  - [ ] On clicking "Extract Events", call the mutation passing the array of `selectedPostIds`.
  - [ ] Show the full-screen `<BlockingLoader />` (`packages/ui/src/core/blocking-loader.tsx`, from Story 1.7a) while the mutation is pending (complying with the Blocking Loader UX Invariant).
  - [ ] On success:
    - [ ] Clear selection state via `clearSelection()`.
    - [ ] Display a locale-aware success toast (e.g., `"Successfully queued X posts for extraction!"` / `"Berhasil mengantrekan X postingan untuk diekstrak!"`).
    - [ ] Redirect the user to `/` (the main discovery feed) or the dynamic `exitPath` query parameter.
  - [ ] On failure:
    - [ ] Handle any mutation GraphQL errors gracefully, showing an on-brand toast with the error message (e.g., `"Quota exceeded"`, `"Selection failed"`, etc.).
- [ ] **Task 5: Automated Testing — Integration & Interactivity** (AC: All)
  - [ ] Write Vitest integration tests in `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` (extending the Story 5.1 test file).
  - [ ] Mock the `postsByAccount` query and `selectPostsForExtraction` mutation using MSW.
  - [ ] Assert that clicking a post's checkbox updates the selected count in the summary bar.
  - [ ] Assert that selection state is maintained when changing tabs in the mocked Tabs component.
  - [ ] Assert that clicking "Extract Events" triggers the MSW handler for `selectPostsForExtraction` with the expected list of post IDs, and correctly triggers navigation on success.

## Dev Notes

- **Zustand store naming & placement:** Place the store inside `apps/web/src/app/[locale]/posts/select/post-selection-store.ts` for strict local feature scope, as it is only consumed by this selector page and its subcomponents.
- **Unified State Rules compliance:**
  - Client Ephemeral UI state (selections) must use Zustand.
  - Server State (mutations) must use React Query.
  - Do not let backend ORM models leak into the frontend components. All props must conform to the generated GraphQL types.
- **Loader Invariant compliance:** Full-screen `<BlockingLoader />` is mandatory when `selectPostsForExtraction` is executing to protect the write boundary and prevent double-clicks.

### Architecture & UX Gate Findings

- **Gate 1 — Architecture/Infrastructure Completeness:** Sourced from the swept `epic-5-readiness.md` report. The backend API layer is completely missing for Epic 5. Prerequisite Story `5.1a` ("Build the manual post selection & extraction GraphQL API layer") has been added to provide the `selectPostsForExtraction` mutation. This story is fully unblocked as it builds on top of `5.1a`'s backend contracts.
- **Gate 2 — UI Complexity & Reusability:** Run fresh. The checkbox interactivity and multi-tab selection state are decoupled from card layout rendering (which already belongs to Story `5.1b`'s `PostCard` primitive). The selection store (`usePostSelectionStore`) manages the state at the page level. No further UI/hook split is required.
- **Gate 3 — Foundational/Cross-Cutting Dependency Completeness:** Sourced from the swept `epic-5-readiness.md` report. Reuses Epic 0's existing structures. No new cross-cutting foundation gaps were found.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No changes required for this story.
- **Rationale:** This story only coordinates the selection of existing posts and triggers the mutation `selectPostsForExtraction` defined in Story 5.1a. All data contracts and database schemas remain fully aligned. All TypeScript types are generated automatically via `pnpm run codegen`.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** Autogenerated by Running `pnpm run codegen`.
- **Backward compatibility and rollout notes:** Fully backward-compatible.

### Project Structure Notes

- **Alignment with unified project structure:**
  - Selector Page Store: `apps/web/src/app/[locale]/posts/select/post-selection-store.ts`
  - Client component view & wiring: `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`
  - Reusable `PostCard` (imported): `packages/ui/src/features/posts/PostCard.tsx`

### References

- [Source: design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.5-manual-post-selection.md] — Selection preserving behavior across tabs, Summary Bar, and Extraction trigger action.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-5-readiness.md] — Epic-level sweep, backend layer requirements, and AC corrections.
- [Source: _bmad-output/project-context.md] — State Management Architecture, Loader Invariant, and i18n conventions.

## Global Rules References

- [x] project-context.md
- [x] story-content-structure.md
- [x] architecture spine
- [x] infrastructure docs

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Create `apps/web/src/app/[locale]/posts/select/post-selection-store.ts` (Zustand selection store)
  - Update `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (Wire selection checkboxes, render SummaryBar, trigger mutation)
  - Update `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` (Add integration tests for checkboxes, tab switching, and mutation submit)
- **Rule Mapping:**
  - State Management -> Selections stored in ephemeral Zustand store; mutation handled by React Query.
  - Loader Invariant -> Full-screen `<BlockingLoader />` prevents user interactions during extraction submission.
- **Verification Plan:**
  - Run type checks: `pnpm tsc --noEmit` in `apps/web`.
  - Execute integration tests: `pnpm --filter web test posts-select-content.test.tsx`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Story 5.2 only covers post selection state, summary bar count display, and extraction mutation call. Quota limit checks (comparing selection size to remaining quota) and disabled processed post states are deferred to Story 5.3. Inactive account actions (undo/remove) are deferred to Story 5.4.
- [ ] Architecture and boundary confirmation: Selection is client-only. The write mutation `selectPostsForExtraction` is handled backend-side via GraphQL. No direct SQS or queue interaction from the client page.
- [ ] Testing plan confirmation: MSW mocks for `selectPostsForExtraction`. Tests verify check-toggles, tab transition stability, and correct enqueued ID payloads.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Story 5.1a (backend API) and Story 5.1 (layout/routing) must reach an implemented/satisfactory state before coding Story 5.2.

## Testing Requirements

- [ ] Integration tests
- [ ] E2E tests

## Deliverables Checklist

- [ ] Strictly typed Zustand store `usePostSelectionStore` mapping selected post IDs and actions.
- [ ] Checkboxes wired on `PostCard` components in the tab pages.
- [ ] Sticky Summary Bar component rendering selection total count.
- [ ] "Extract Events" action button invoking `selectPostsForExtraction` mutation.
- [ ] `<BlockingLoader />` visible during mutation processing.
- [ ] Locale-aware toast notifications on successful/failed extraction request.
- [ ] Navigation redirection to feed page on successful queue submission.
- [ ] Complete Vitest integration test suite passing.

## Out of Scope

- **Quota Display & Enforcement:** Comparing selected count against remaining quota, coloring text red on quota breach, and disabling/disallowing selecting already-processed posts (`isExtracted === true`) are deferred to Story `5.3`.
- **Inactive Warning Actions:** The actual subscription removal mutations and Undo overlays are deferred to Story `5.4`.

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
