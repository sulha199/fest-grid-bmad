---
title: 'ux-rework2-batch-p0-remainder'
type: 'bugfix'
created: '2026-08-31T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '320a9eeacd91452511bfadcfdd58c8bddad95fe5'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The 3 remaining P0 items from `apps/ux-rework2.md`'s triage, split off from `spec-ux-rework2-batch-2.md` for token budget and now root-caused: a dead `/settings/subscriptions` link across 3 call sites, backend error messages swallowed on invalid API key entry, and a duplicate favorite `Heart` icon on calendar-view event cards.

**Approach:** Fix each at its diagnosed root cause — see Code Map. All three are small, independently reviewable, and lower blast-radius than the previous batch (no cache-key or async-timing changes).

## Boundaries & Constraints

**Always:** Fix at the diagnosed root cause. Keep the three fixes independently reviewable in the diff. For the error-message fix, extract the real GraphQL error message via `graphql-request`'s `ClientError` (`err instanceof ClientError ? err.response.errors?.[0]?.message : undefined`), falling back to the existing generic translated string only when no message is present.

**Ask First:** None — all three root causes and minimal fixes are already identified below.

**Never:** Do not do a full app-wide audit/refactor of every mutation's error handling — scope the error-message fix to the two `createApiKey` call sites listed (the wider gap is already logged separately in `deferred-work.md`). Do not touch any other already-`done` item from either prior `ux-rework2` batch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| User clicks any link previously pointing at `/settings/subscriptions` | Onboarding-guard redirect, feed empty-state CTA, or post-select empty-state CTA | Navigates to `/settings/account` (real route) | N/A |
| User submits an invalid Gemini API key | `createApiKey` rejects with `INVALID_API_KEY` GraphQLError | Toast shows that specific backend message | Non-GraphQL/network error still shows the existing generic fallback string |
| Calendar-view event card, user has favorited the item, `favoriteCount > 0` | `isFavorited: true`, `favoriteCount > 0` | Exactly one `Heart` icon renders (count number still visible) | N/A |
| Calendar-view event card, item not favorited, `favoriteCount > 0` | `isFavorited: false`, `favoriteCount > 0` | Count-line `Heart` icon still renders (unchanged behavior) | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/[locale]/feed/feed-content.tsx:301` -- hardcoded `href="/settings/subscriptions"`.
- `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx:374` -- same dead `href="/settings/subscriptions"`.
- `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx:65` -- `router.push('/wizard/onboarding/api-key?redirect=' + encodeURIComponent('/settings/subscriptions'))`, same dead target.
- `apps/web/src/features/wizard/is-safe-redirect-path.test.ts:6`, `apps/web/src/app/[locale]/feed/feed-content.test.tsx:242`, `apps/web/src/app/[locale]/settings/account/subscriptions-content.test.tsx:216` -- test fixtures asserting the dead path.
- `apps/web/src/features/onboarding/onboarding-api-key-step.tsx:55-57` -- `catch (err: any) { toast.error(t('apiKeyErrorToast')) }`, discards `err`.
- `apps/web/src/app/[locale]/settings/account/api-key-form-dialog.tsx:72-75` -- `catch (err) { console.error(err); toast.error(t("addErrorToast")) }`, same discard.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx:830-832` -- badge `Heart` icon, renders when `schedule.isFavorited`.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx:843-847` -- count-line `Heart` icon, renders whenever `schedule.favoriteCount > 0`, independent of `isFavorited` -- both fire together, producing two icons.

## Tasks & Acceptance

**Execution:**
- [x] `feed-content.tsx`, `posts-select-content.tsx`, `subscriptions-content.tsx` (+ their 3 test fixtures) -- change every `/settings/subscriptions` reference to `/settings/account`.
- [x] `onboarding-api-key-step.tsx` -- import `ClientError` from `graphql-request`; in the `catch` block, extract `err.response.errors?.[0]?.message` when `err instanceof ClientError` and show it via `toast.error`, falling back to `t('apiKeyErrorToast')` when no message is present.
- [x] `api-key-form-dialog.tsx` -- same fix pattern for its `catch` block, falling back to `t("addErrorToast")`.
- [x] `WeeklyCalendarView.tsx` -- in the count-line block (line 843-847), only render the `Heart` icon when `!schedule.isFavorited`; keep the count number always visible when `favoriteCount > 0`. (Extended during review: the icon carried the count-line's only `aria-label`, so suppressing it also silently dropped accessible context for screen readers -- moved `aria-label="Favorites"` onto the wrapper span so it's always present, and made the icon `aria-hidden` when shown.)
- [x] Add/update tests: `is-safe-redirect-path.test.ts`, `feed-content.test.tsx`, `subscriptions-content.test.tsx` (new target path); `onboarding-api-key-step.test.tsx` and `api-keys-content.test.tsx` (real backend message surfaced on invalid-key rejection, generic fallback still shown for a non-GraphQL error -- landed in `api-keys-content.test.tsx`, the parent component's test file, rather than a separate `api-key-form-dialog.test.tsx` which doesn't exist); `WeeklyCalendarView.test.tsx` (new case: `isFavorited: true` AND `favoriteCount > 0` together, asserting exactly one `Heart` icon and that the count line still carries `aria-label="Favorites"`; existing not-favorited case continues to assert the count-line icon still renders).

**Acceptance Criteria:**
- Given a user clicks any link/redirect previously pointing at `/settings/subscriptions`, when navigation resolves, then they land on `/settings/account` (no 404).
- Given a user submits an invalid Gemini API key at either call site, when `createApiKey` rejects with `INVALID_API_KEY`, then the toast shows that specific backend message, not the generic fallback.
- Given a user submits a key and a non-GraphQL error occurs (e.g. network failure), when the mutation rejects, then the existing generic fallback toast still shows (no regression).
- Given a calendar-view event card where the current user has favorited the event and `favoriteCount > 0`, when rendered, then exactly one `Heart` icon appears (count still visible); given the event is not favorited, the count-line icon renders as before.

## Spec Change Log

- 2026-08-31: Dispatched implementation to `cline-cli` (`--worktree`). This time the spec file was committed to `master` *before* launching cline (commit `40d01b8`), fixing the prior batch's root cause (a stale worktree base that predated the spec's own creation). The worktree correctly saw the spec this time, but independent verification still found real defects cline's own reported "success" missed:
  - `onboarding-api-key-step.test.tsx`'s two new tests were spliced with a missing closing brace for the *preceding* pre-existing test -- the same invalid-nesting defect class as the prior batch, in a new file. Re-derived by hand as proper sibling tests.
  - The same file's `vi.mock('sonner', ...)` factory referenced a top-level `const mockToastError` directly by value, which throws `ReferenceError: Cannot access 'mockToastError' before initialization` under Vitest's mock-hoisting semantics (vi.mock calls hoist above const declarations). Fixed by wrapping the reference in a closure (`error: (msg) => mockToastError(msg)`), matching the working pattern already used in `report-dialog.test.tsx`.
  - The same file's `vi.mock('graphql-request', ...)` factory only returned a hand-rolled `ClientError`, breaking `graphql-client.ts`'s `import { GraphQLClient } from 'graphql-request'`. Removed the mock entirely and used the real `ClientError` class instead (the pattern `api-keys-content.test.tsx` already used successfully) -- no mock was actually needed.
  - `api-keys-content.test.tsx`'s two new tests set `vi.mocked(graphqlClient.request).mockRejectedValueOnce(...)` *before* rendering the component, which intercepted the component's own initial `GetMyApiKeys` query (the first call to the shared `.request` mock) instead of the intended later `createApiKey` mutation call, breaking the initial list render. Reordered so the rejection is set only after the initial list has loaded, immediately before the submit click that should trigger it.
  All fixes independently verified: `pnpm --filter web test feed-content posts-select-content subscriptions-content is-safe-redirect-path onboarding-api-key-step api-key-form-dialog api-keys-content` -- 6 files, 45 tests, all pass.
- 2026-08-31: Ran Blind Hunter + Edge Case Hunter adversarial review (`cline-cli`, `gemini-3.1-pro-preview`), independently verified every finding. Blind Hunter's two most serious-sounding claims ("corrupted patch file with truncation markers", "missing the third `/settings/subscriptions` call site") were both confirmed false by direct inspection of the diff file (no truncation markers present; all 3 call sites, including `subscriptions-content.tsx`, are in the diff). Its remaining findings (bare `any` catch type, inconsistent console logging, dynamic `import("sonner")` inside a catch block, hardcoded Tailwind classes, i18n bypass on the surfaced error message) were all confirmed pre-existing/spec-approved, not introduced by this diff -- logged to `deferred-work.md` rather than fixed here. One **patch** finding from Edge Case Hunter, confirmed real and fixed: suppressing the count-line `Heart` icon also silently dropped its `aria-label="Favorites"` for screen-reader users, since no other element carried that label. Moved the label onto the always-present wrapper span. Edge Case Hunter's other two findings (multi-error-array `errors[0]`-only access, whitespace-only message strings) were confirmed to match an existing codebase-wide pattern already spec-approved for this exact fix -- logged as low-probability defers rather than fixed, since the backend that produces this specific error only ever sends one non-whitespace message today.

## Verification

**Commands:**
- `pnpm --filter web exec tsc --noEmit` -- PASS (only pre-existing, unrelated errors remain elsewhere).
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- PASS (only the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter web test feed-content posts-select-content subscriptions-content is-safe-redirect-path onboarding-api-key-step api-key-form-dialog api-keys-content` -- PASS, 6 files / 45 tests.
- `pnpm --filter @festgrid/ui test WeeklyCalendarView` -- PASS, 22/22.
- `pnpm --filter web test` (full) -- PASS, 50 files / 295 tests.
- `pnpm --filter @festgrid/ui test` (full) -- 347/348 PASS; the 1 failure (`EventCard.test.tsx`, masonry badge suite) is pre-existing and unrelated, already logged in `deferred-work.md` from the prior batch.

## Suggested Review Order

**Dead `/settings/subscriptions` link**

- Entry point -- the onboarding-guard redirect that sends a subscription-less user through the wizard and back.
  [`subscriptions-content.tsx:65`](../../apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx#L65)

- Feed's empty-state CTA, same dead target.
  [`feed-content.tsx:301`](../../apps/web/src/app/[locale]/feed/feed-content.tsx#L301)

- Post-selection's empty-state CTA, same dead target.
  [`posts-select-content.tsx:374`](../../apps/web/src/app/[locale]/posts/select/posts-select-content.tsx#L374)

**Surfacing the real backend error message**

- Onboarding wizard's API-key step -- extracts `ClientError`'s real message before falling back to the generic toast.
  [`onboarding-api-key-step.tsx:57`](../../apps/web/src/features/onboarding/onboarding-api-key-step.tsx#L57)

- Same fix applied to the settings-page API-key dialog.
  [`api-key-form-dialog.tsx:76`](../../apps/web/src/app/[locale]/settings/account/api-key-form-dialog.tsx#L76)

**Duplicate favorite icon on calendar cards**

- Count-line `Heart` now suppressed when the badge above already shows it; the wrapper carries the accessible label so screen readers aren't left with a bare number (a review-driven addition beyond the original ask).
  [`WeeklyCalendarView.tsx:844`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L844)

**Peripherals**

- New/updated test coverage for all three fixes, including the accessibility regression test.
  [`onboarding-api-key-step.test.tsx`](../../apps/web/src/features/onboarding/onboarding-api-key-step.test.tsx)
  [`api-keys-content.test.tsx`](../../apps/web/src/app/[locale]/settings/account/api-keys-content.test.tsx)
  [`WeeklyCalendarView.test.tsx`](../../packages/ui/src/features/events/WeeklyCalendarView.test.tsx)

