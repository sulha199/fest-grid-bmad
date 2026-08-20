# Apply Every Patch: Story 3-4k

You are the implementation agent applying all actionable findings from the code review of Story 3-4k.

## Scope

Repository: `c:\projects\portfolio\festgrid\bmad`
Story: `_bmad-output/implementation-artifacts/3-4k-moderator-actor-run-browser-and-replay-ui.md`
Reviewed implementation range: `9dda28df..4e79ee9`

Before editing, read:

- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`
- `_bmad-output/implementation-artifacts/3-4k-moderator-actor-run-browser-and-replay-ui.md`

Do not revert unrelated user changes. Keep the implementation focused on Story 3-4k.

## Apply All Seven Patches

### 1. Add the account/profile filter

In `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.tsx`:

- Add an accessible account/profile filter control.
- Bind it to the existing `filters.profileId` state.
- Pass the selected profile ID through the existing GraphQL `ActorRunFilters` object.
- Use the existing account/profile data source or established project pattern if one exists. Do not invent a second profile model.
- Add all new user-facing text through the `ActorRunsPage` i18n namespace.
- Preserve the existing filter reset and pagination-reset behavior.

### 2. Add menu translations and label wiring

Add translations for both menu entries in `apps/web/locales/en.json` and `apps/web/locales/id.json` under `UserMenu`:

- `unprocessedPayloads`
- `actorRuns`

Add both keys to the `userMenuLabels` object in `apps/web/src/components/layout/AppShellWrapper.tsx` using `tUserMenu(...)`.

### 3. Fix status badge colors

In `actor-runs-content.tsx`, map statuses independently:

- `SUCCEEDED`: success/green
- `PENDING`: pending/warning color
- `FAILED`, `TIMED_OUT`, `ABORTED`: destructive/red color

Keep the existing translated status labels and provide a neutral fallback for an unknown status.

### 4. Track replay state per run

Replace the component-wide replay boolean behavior with per-run replay state.

Requirements:

- Only the clicked run's Replay button is disabled while that run is replaying.
- Only that run's button shows the replaying label.
- The blocking loader must remain active while any replay is in flight.
- Avoid allowing duplicate replay requests for the same run.
- Preserve the existing success/error toast behavior and refresh behavior.

Use the smallest clear state shape consistent with the existing codebase.

### 5. Format timestamps with the active locale

Replace `toLocaleString()` in `actor-runs-content.tsx` with the project's active locale-aware formatting pattern.

Requirements:

- Use the active `en`/`id` application locale, not the browser's unrelated locale.
- Follow the existing `next-intl` or scoped-locale conventions from the repository.
- Preserve graceful behavior for an invalid or missing timestamp if the surrounding data contract permits one.
- Do not render raw ISO timestamps.

### 6. Add replay unhappy-path integration coverage

Extend `apps/web/src/app/[locale]/moderator/actor-runs/actor-runs-content.test.tsx` with focused tests for:

- The mutation resolving with `success: false`, asserting the error toast and no false-positive success handling.
- The mutation rejecting/throwing, asserting the error toast.

Keep the existing test setup and mocking style. Do not skip the tests. Ensure the tests cover the actual user interaction path by expanding a run and clicking Replay.

### 7. Give RawJsonViewer distinct accessible labels

In `packages/ui/src/core/RawJsonViewer.tsx`:

- Add an optional accessible label prop with a sensible default for existing consumers.
- Pass distinct labels from the actor-runs page for raw input and raw output.
- Preserve the scrollable, monospace, read-only behavior and existing invalid-JSON fallback.
- Update or add focused component tests for the labels without weakening existing assertions.

## Explicitly Do Not Change

- Do not fix the offset-based pagination cursor in `apps/backend/src/schema/resolvers.ts`; that is a pre-existing Story 3-4j issue and was deferred from this review.
- Do not implement speculative circular-reference serialization changes unless a reachable project contract requires them.
- Do not make unrelated refactors.
- Do not modify the currently open Story 5-6 file or other stories.

## Validation

After editing, run focused checks before broad checks:

1. The relevant `packages/ui` test for `RawJsonViewer`.
2. The relevant `apps/web` actor-runs test file.
3. `apps/web` typecheck.
4. `apps/web` lint, if available through the package scripts.

Use the repository's package-manager convention. If the root aggregate command is affected by the known pnpm/turbo mismatch, use the per-package `corepack pnpm --filter ...` command instead.

Inspect the final diff and verify:

- All seven patches are implemented.
- No deferred backend pagination change slipped in.
- Both locales have matching required keys.
- No new TypeScript, lint, or test errors were introduced.

## Completion Report

Report:

- Files changed.
- Tests/checks run and their results.
- Any unresolved blocker.
- Whether all seven patches were applied.

Do not commit changes unless explicitly asked.
