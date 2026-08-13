---
title: 'onboarding-api-key-cache-invalidation'
type: 'bugfix'
created: '2026-08-13T00:00:00Z'
status: 'in-progress'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A new user who completes the onboarding API-key step still sees the app as if they have no API key, because the React Query cache used by navigation gating is never updated after a successful key creation. This causes the user to be redirected back into the onboarding wizard until an unrelated refetch or reload occurs.

**Approach:** Update the onboarding mutation flow to patch the shared `GetMyApiKeys` cache immediately after a successful API-key creation and verify the behavior with a targeted frontend test.

## Boundaries & Constraints

**Always:** Preserve the current onboarding UX; keep the existing loading, toast, and step-completion behavior; invalidate only the exact shared `GetMyApiKeys` cache key used by the app; follow the existing `api-key-form-dialog` cache update pattern already used in the project.

**Ask First:** None for this bug fix; the root cause and target change are explicit.

**Never:** Do not broaden this to unrelated wizard logic, do not touch the manual post-selection flow or story 5.5 artifacts, and do not alter the existing API-key dialog behavior that already works correctly.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | User submits a valid API key in onboarding wizard | Mutation succeeds and the `GetMyApiKeys` cache is patched with the new key | N/A |
| ERROR_CASE | Create mutation rejects | User sees the existing error toast and the cache remains unchanged | Existing catch path remains intact |

</frozen-after-approval>

## Code Map

- `apps/web/src/features/onboarding/onboarding-api-key-step.tsx` -- onboarding wizard API-key submit flow and stale cache root cause
- `apps/web/src/features/onboarding/onboarding-api-key-step.test.tsx` -- targeted regression test for the cache update behavior
- `apps/web/src/app/[locale]/settings/api-keys/api-key-form-dialog.tsx` -- reference implementation for the correct `GetMyApiKeys` cache patch pattern

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/features/onboarding/onboarding-api-key-step.tsx` -- add `useQueryClient` and patch the shared `GetMyApiKeys` cache after the successful API-key mutation -- prevents stale onboarding state from persisting across route checks.
- [ ] `apps/web/src/features/onboarding/onboarding-api-key-step.test.tsx` -- mock `@tanstack/react-query` and assert the cache patch is triggered after successful submit -- locks in the regression fix.

**Acceptance Criteria:**
- Given a new user with no current API keys, when they complete the onboarding API-key step successfully, then the `['GetMyApiKeys']` cache entry is updated immediately so route guards read `hasApiKey: true` without a refetch.
- Given the mutation call fails, when the submit handler catches the error, then the existing error toast path still executes and no cache mutation is performed.
- Given the targeted React Query mock is in place, when the onboarding step test runs, then the regression assertion passes and the file remains green.

## Spec Change Log

## Design Notes

Follow the same React Query cache patch pattern already used in the settings API-key form dialog: `queryClient.setQueriesData({ queryKey: ['GetMyApiKeys'] }, updater)` with a reducer that prepends the newly created API key to `myApiKeys`. This is deliberately scoped to the shared cache key to cover both the no-variables onboarding query and the app-level guard query without forcing a network refetch.

## Verification

**Commands:**
- `pnpm --filter web test onboarding-api-key-step` -- expected: targeted onboarding API-key tests pass.
- `pnpm --filter web exec tsc --noEmit` -- expected: TypeScript passes for the web app after the new import and cache patch.
