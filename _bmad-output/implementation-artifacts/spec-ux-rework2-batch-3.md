---
title: 'ux-rework2-batch-p0-remainder'
type: 'bugfix'
created: '2026-08-31T00:00:00Z'
status: 'in-progress'
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
- [ ] `feed-content.tsx`, `posts-select-content.tsx`, `subscriptions-content.tsx` (+ their 3 test fixtures) -- change every `/settings/subscriptions` reference to `/settings/account`.
- [ ] `onboarding-api-key-step.tsx` -- import `ClientError` from `graphql-request`; in the `catch` block, extract `err.response.errors?.[0]?.message` when `err instanceof ClientError` and show it via `toast.error`, falling back to `t('apiKeyErrorToast')` when no message is present.
- [ ] `api-key-form-dialog.tsx` -- same fix pattern for its `catch` block, falling back to `t("addErrorToast")`.
- [ ] `WeeklyCalendarView.tsx` -- in the count-line block (line 843-847), only render the `Heart` icon when `!schedule.isFavorited`; keep the count number always visible when `favoriteCount > 0`.
- [ ] Add/update tests: `is-safe-redirect-path.test.ts`, `feed-content.test.tsx`, `subscriptions-content.test.tsx` (new target path); `onboarding-api-key-step.test.tsx`/`api-key-form-dialog.test.tsx` (real backend message surfaced on invalid-key rejection, generic fallback still shown for a non-GraphQL error); `WeeklyCalendarView.test.tsx` (new case: `isFavorited: true` AND `favoriteCount > 0` together, asserting exactly one `Heart` icon; existing not-favorited case continues to assert the count-line icon still renders).

**Acceptance Criteria:**
- Given a user clicks any link/redirect previously pointing at `/settings/subscriptions`, when navigation resolves, then they land on `/settings/account` (no 404).
- Given a user submits an invalid Gemini API key at either call site, when `createApiKey` rejects with `INVALID_API_KEY`, then the toast shows that specific backend message, not the generic fallback.
- Given a user submits a key and a non-GraphQL error occurs (e.g. network failure), when the mutation rejects, then the existing generic fallback toast still shows (no regression).
- Given a calendar-view event card where the current user has favorited the event and `favoriteCount > 0`, when rendered, then exactly one `Heart` icon appears (count still visible); given the event is not favorited, the count-line icon renders as before.

## Verification

**Commands:**
- `pnpm --filter web exec tsc --noEmit` -- web app type-checks after all frontend changes.
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- ui package type-checks (excluding the pre-existing, unrelated `baseUrl` deprecation warning already present on `master`).
- `pnpm --filter web test feed-content posts-select-content subscriptions-content is-safe-redirect-path onboarding-api-key-step api-key-form-dialog` -- targeted frontend tests pass.
- `pnpm --filter @festgrid/ui test WeeklyCalendarView` -- targeted test passes, including the new case.
- `pnpm test` -- full project test suite passes (the pre-existing, unrelated `EventCard.test.tsx` masonry-badge failure logged in `deferred-work.md` is out of scope and expected to still be the only failure, if still present).

