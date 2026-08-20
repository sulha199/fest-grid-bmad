---
title: Apply all 7 code review patches to Story 3-4k
type: 'bugfix'
created: '2026-08-20'
status: 'in-review'
review_loop_iteration: 0
context: []
baseline_commit: 'c3b39b08bd83a24c711df97ae8f50ed14b0f9e9e'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 3-4k implementation passed initial development and code review, which identified 7 specific patches covering profile filtering, translations, badge colors, replay state management, timestamp formatting, test coverage, and component labeling. These patches must be applied to make the implementation complete and production-ready.

**Approach:** Apply all 7 patches in sequence from the code review report (`3-4k-apply-review-patches.prompt.md`), verifying each against the specified constraints. Run focused validation tests after all patches are complete, then proceed to a second review cycle.

## Boundaries & Constraints

**Always:**
- Follow the exact patch specifications from the code review report without interpretation or simplification
- Maintain TypeScript strict mode compliance
- Use project-established patterns for i18n (next-intl), state management (React Query), and styling (Tailwind/shadcn)
- Preserve existing test setup and mocking style when extending tests
- Only modify Story 3-4k scope — do not touch pre-existing Story 3-4j backend or other unrelated code
- Run the specified validation checks before marking patches complete

**Ask First:**
- If any patch specification contains ambiguity or conflicts with existing code patterns
- If validation tests fail and the root cause extends beyond the 7 patches

**Never:**
- Fix deferred issues (Story 3-4j pagination cursor fix, circular reference serialization)
- Make unrelated refactoring or code cleanup beyond patch scope
- Modify Story 5-6 or other concurrent story files

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Patch 1: Profile filter | User selects profile ID from filter dropdown | Filter applied to queryActorRuns; run list updates | Handle empty profile list gracefully |
| Patch 2: Menu translations | `UserMenu` i18n keys for `unprocessedPayloads` and `actorRuns` in en.json/id.json | Menu entries appear with correct labels in both locales | Fallback to key name if translation missing |
| Patch 3: Status badges | Run status is SUCCEEDED / PENDING / FAILED / TIMED_OUT / ABORTED | Correct badge color (green/warning/red) rendered with translated label | Neutral fallback for unknown status |
| Patch 4: Per-run replay state | User clicks Replay on run #1, then run #2 | Only run #1's button disables; only run #1 shows "replaying" label; blocking loader active while either in flight | Prevent duplicate requests for same run via optimistic locking |
| Patch 5: Locale-aware timestamps | Actor run with ISO timestamp created in different timezone | Timestamp formatted using active en/id locale, never raw ISO | Graceful fallback if timestamp invalid/missing |
| Patch 6: Replay test coverage | Mutation returns `success: false` OR throws exception | Error toast shown; no false-positive success handling | Both unhappy paths (false + exception) covered |
| Patch 7: RawJsonViewer labels | Component used for rawInput vs. rawOutput panels | Each panel has distinct accessible label; keyboard-scrollable | Invalid JSON falls back to raw string display |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.tsx` -- main list/filter implementation, patch sites 1-6
- `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.test.tsx` -- mutation test coverage, patch site 6
- `packages/ui/src/core/RawJsonViewer.tsx` -- JSON viewer component, patch site 7
- `apps/web/src/components/layout/AppShellWrapper.tsx` -- menu label wiring, patch site 2
- `apps/web/locales/en.json`, `apps/web/locales/id.json` -- translation keys, patch site 2

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.tsx` -- Add account/profile filter control bound to `filters.profileId` state, wired through existing `ActorRunFilters` GraphQL object, with reset and pagination behaviors preserved
- [x] `apps/web/locales/en.json` and `apps/web/locales/id.json` -- Add `ActorRunsPage.profileFilterLabel` and `UserMenu.unprocessedPayloads` + `UserMenu.actorRuns` keys for both locales
- [x] `apps/web/src/components/layout/AppShellWrapper.tsx` -- Wire both new UserMenu keys via `tUserMenu()` into `userMenuLabels` object
- [x] `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.tsx` -- Map run statuses to badge colors independently: SUCCEEDED → success/green, PENDING → pending/warning, FAILED/TIMED_OUT/ABORTED → destructive/red, with neutral fallback for unknown
- [x] `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.tsx` -- Replace component-wide replay boolean with per-run replay state; only clicked run's button disables while replaying; blocking loader remains active during any replay; prevent duplicate requests via state check
- [x] `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.tsx` -- Replace `toLocaleString()` with project's active locale-aware formatting pattern (next-intl or scoped-locale), using active en/id application locale, not browser locale
- [x] `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.test.tsx` -- Add focused integration tests for replay unhappy paths: mutation returning `success: false` (assert error toast, no false-positive success), and mutation throwing/rejecting (assert error toast)
- [x] `packages/ui/src/core/RawJsonViewer.tsx` -- Add optional accessible label prop with sensible default; pass distinct labels from actor-runs page for raw input vs. raw output; preserve scrollable/monospace/read-only behavior and invalid-JSON fallback

**Acceptance Criteria:**
- Given the actor-runs page is loaded, when I select a profile filter, then the run list filters to only runs for that profile and pagination resets
- Given both locales have translation files, when AppShellWrapper references UserMenu keys, then no missing-key console errors appear and both en/id show correct text
- Given a run with SUCCEEDED status exists, when the page renders, then a green success badge appears with the translated "Succeeded" label
- Given the replay mutation is in flight for run A, when I click replay on run B, then only run B's button disables and run B shows the replaying label, while run A's button remains disabled (if its request is still pending)
- Given the replay mutation completes, when an ISO timestamp is rendered, then it displays in the active en/id format (e.g., "8/20/2026, 2:30:45 PM" for en, localized for id)
- Given the replay mutation returns `success: false`, when the UI is updated, then an error toast appears (no success toast shown)
- Given a RawJsonViewer for rawInput is rendered with a unique label, when a screen reader announces it, then "Raw Input" (or equivalent) is distinguished from an output panel labeled "Raw Output"
- Given all 7 patches are implemented, when validation checks run, then TypeScript, lint, and test suites pass with no new errors

## Spec Change Log

(Empty until first review loop)

## Verification

**Commands:**
- `pnpm run --filter @festgrid/ui test -- RawJsonViewer.test.tsx` -- expected: 100% pass rate for RawJsonViewer label tests
- `pnpm run --filter apps-web test -- actor-runs-content.test.tsx` -- expected: all replay happy and unhappy path tests pass
- `pnpm run --filter apps-web typecheck` -- expected: no TypeScript errors
- `pnpm run --filter apps-web lint` -- expected: no lint errors in actor-runs and AppShellWrapper files
