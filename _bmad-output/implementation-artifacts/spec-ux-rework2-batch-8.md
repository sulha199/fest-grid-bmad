---
title: 'ux-rework2-p1-wire-subscribed-account-card-event-detail'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'fa5466e4d90ae1b9cba00e5f0cfec8326fe987f6'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md`: "in event detail, on the left of favorite & add-to-calendar, add subscribed-account inline-card component." The already-built `SubscribedAccountCard` (component-only, `spec-ux-rework2-batch-7.md`) isn't wired anywhere yet. Event Detail today only shows a plain `accountName`/icon/link "Attributions" line near the bottom, with no subscribe control at all.

**Approach:** Wire `SubscribedAccountCard` into `EventDetailView`'s top action row (left of the favorite/add-to-calendar buttons), fed by real event/subscription data from `EventDetailWrapper`. Remove the now-redundant bottom "Attributions" line — the new card already shows the same avatar/name/link plus the subscribe state.

## Boundaries & Constraints

**Always:** Reuse `useGetMySubscriptionsQuery` (already used elsewhere: `feed-content.tsx`, `subscriptions-content.tsx`, etc.) client-side to derive `isSubscribed` — no new backend field. Mirror `subscribe-account-dialog.tsx`'s exact `useSubscribeToAccountMutation` call shape and its `["getMySubscriptions"]` cache-invalidation pattern for the new `onSubscribe` handler. Follow this file's existing accessibility convention (`setLiveMessage` announcements, already used for favorite/calendar actions in `EventDetailWrapper.tsx`) for the subscribe action's success/error feedback.

**Ask First:** None — layout placement (top row, left-aligned via the button row's `justify-end` → `justify-between`) and data wiring are both fully determined by investigation.

**Never:** Do not touch Post Selection or the Subscribed Accounts settings page — those are separate, already-deferred follow-up batches (the latter has an unresolved design question: the card has no unsubscribe affordance at all). Do not modify `SubscribedAccountCard.tsx` itself unless a genuine defect surfaces — this batch is about wiring, not changing the component's contract.

</frozen-after-approval>

## Code Map

- `apps/web/src/features/events/queries.graphql:53-58` -- `getEventBySlug`'s `sourceSocialMediaAccountProfile` selection has `accountId, platform, displayName, profileImageUrl` but is missing `username` (required by `SubscribedAccountCard`'s `account` prop); backend type already has it (`apps/backend/src/schema/social-media-accounts.graphql:1-14`), so this is a query-only addition.
- `apps/web/src/features/events/mapper.ts:102-105` -- `mapGraphQLEventToDetailViewProps` currently only derives `accountName`/`accountPlatformIconUrl`/`accountHref`; extend to also pass through `accountId`, `username`, `platform` from `sourceSocialMediaAccountProfile`.
- `apps/web/src/features/events/EventDetailWrapper.tsx` -- no subscription-status or subscribe-mutation logic exists here at all today (confirmed no `useGetMySubscriptionsQuery` import). Add: (1) `useGetMySubscriptionsQuery` import, derive `isSubscribedToAccount = mySubscriptions?.some(s => s.account.accountId === <event's account accountId>)`; (2) `useSubscribeToAccountMutation`, called as `{ input: { platform, accountId, username, displayName } }` (mirroring `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx:54-61`), invalidating `["getMySubscriptions"]` on success (mirroring dialog.tsx:64) and calling `setLiveMessage(...)` for success/error, matching the existing `toggleFavorite`/calendar-mutation announcement pattern already in this file.
- `packages/ui/src/features/events/EventDetailView.tsx:226` -- the favorite/add-to-calendar button row: `<div className="flex justify-end gap-3 mb-2">`; change to `justify-between` and add `SubscribedAccountCard` as a new left-side sibling (only rendered when account data exists, mirroring the existing `hasAccountAttribution` guard at line 199).
- `packages/ui/src/features/events/EventDetailView.tsx:414-424` -- the bottom "Attributions" section; remove (superseded by the new top-row card, which already shows the same avatar/name/link).
- `packages/ui/src/features/events/EventDetailView.types.ts:79-81` -- `accountName?/accountPlatformIconUrl?/accountHref?` props; add `accountId?: string | null`, `accountUsername?: string | null`, `accountPlatform?: string | null`, `isSubscribedToAccount?: boolean`, `onSubscribeToAccount?: () => void`, `isSubscribingToAccount?: boolean`.

## Tasks & Acceptance

**Execution:**
- [x] `queries.graphql` -- add `username` to the `sourceSocialMediaAccountProfile` selection; regenerate types. (cline never actually ran codegen despite claiming success -- ran it independently as part of verification.)
- [x] `mapper.ts` -- pass through `accountId`, `username` (as `accountUsername`), `platform` (as `accountPlatform`) alongside the existing account fields.
- [x] `EventDetailWrapper.tsx` -- add the subscription-check query, the subscribe mutation (+ cache invalidation + `setLiveMessage` announcement), and pass `isSubscribedToAccount`/`onSubscribeToAccount`/`isSubscribingToAccount` down to `EventDetailView`. (Extended during review: the referenced `subscribeSuccessAnnouncement`/`subscribeErrorAnnouncement` translation keys didn't exist in either locale file -- added.)
- [x] `EventDetailView.types.ts` -- add the new props listed in the Code Map.
- [x] `EventDetailView.tsx` -- render `SubscribedAccountCard` (size="sm") as a left-side sibling in the top button row when account data exists; remove the now-redundant bottom "Attributions" section. (Extended during review: the render guard didn't include `accountHref`, causing a real TypeScript error at the `web` app's build boundary -- `SubscribedAccountCardProps`'s required, non-nullable fields didn't match this view's optional/nullable ones. Extended the guard to also require `accountHref`, narrowing all four fields to non-null strings.)
- [x] Update/add tests in `EventDetailWrapper.test.tsx` and `EventDetailView.test.tsx`: card renders with correct account data; shows "Subscribe" when not subscribed and calls the mutation on click; shows "Subscribed" when already subscribed; the old Attributions section is gone. (cline's own pass added only MSW handler mocks, no actual test exercising the subscribe flow at all -- wrote 3 real tests from scratch, including one that traced a genuine wrong-casing bug: the MSW mutation mock used lowercase `subscribeToAccount` but the real document's operation name is `SubscribeToAccount`, so the mutation was silently falling through to the error path on every test run.)

**Acceptance Criteria:**
- Given an event's source account, when Event Detail renders, then `SubscribedAccountCard` shows to the left of the favorite/add-to-calendar buttons with the account's avatar, name, and username.
- Given the viewer is not subscribed to that account, when rendered, then the card shows a "Subscribe" button; clicking it calls `useSubscribeToAccountMutation` with the account's platform/accountId/username/displayName, and on success the card updates to "Subscribed" without a full page reload.
- Given the viewer is already subscribed, when rendered, then the card shows "Subscribed" (no button).
- Given Event Detail renders, when inspected, then the old bottom "Attributions" line is no longer present (superseded by the new card).

## Spec Change Log

- 2026-08-31: Dispatched implementation to `cline-cli` (`--worktree`), spec pre-committed to `master` first. cline's own final report used the same evasive non-verification language as the previous batch ("everything compiles structurally sound... in restricted environments") -- again turned out to be masking real defects rather than an environment limitation. Found and fixed independently: (1) codegen was never run despite the query needing a new field, leaving a genuine `web` app TypeScript compile error (`mapper.ts` referencing `.username` on a type that didn't have it yet); (2) a second, separate TS error at `EventDetailView.tsx`'s call site once codegen did run -- the render guard didn't cover `accountHref`, so `SubscribedAccountCardProps`'s required fields didn't type-narrow correctly (only caught by `web`'s stricter build, not `packages/ui`'s own `tsc` run -- a reminder to always check both); (3) two new translation keys referenced but never added to either locale file; (4) the test file added MSW mocks but zero actual tests of the subscribe flow -- wrote 3 from scratch.
- 2026-08-31: One of my own new tests initially only asserted the screen-reader announcement, not that the card visually updated -- while writing it I used a hardcoded MSW mutation response that never actually updated the mock subscriptions list, so even the stronger assertion would have failed for a reason unrelated to the real code. Traced the actual root cause: the MSW mock's mutation matcher used lowercase `subscribeToAccount`, but this specific mutation's document (in `onboarding/mutations.graphql`, unlike every other mutation in this codebase) uses `SubscribeToAccount` (PascalCase) as its operation name -- so the mock silently never matched, and the mutation was hitting the real `onError` path on every run. Fixed the casing and made the mock reflect the new subscription; strengthened the test to assert the card itself flips to "Subscribed."
- 2026-08-31: Ran Blind Hunter + Edge Case Hunter adversarial review (`cline-cli`, `gemini-3.1-pro-preview`) on the finished diff, independently verified every finding. Blind Hunter's most consequential-sounding claim -- that `queryClient.invalidateQueries(["getMySubscriptions"])` uses the wrong (lowercase) cache key, given the mutation's own PascalCase-operation-name surprise found moments earlier -- was checked directly against the generated hook and found false: `useGetMySubscriptionsQuery`'s react-query cache key is genuinely lowercase (`['getMySubscriptions']`, derived from the hook name, not the `.graphql` document's operation name), so the invalidation was already correct. 8 more Blind Hunter findings were also confirmed false by direct inspection (a claimed missing import, a claimed `as any` cast, a claimed missing session guard, a claimed dropped `profileImageUrl` -- all present and correct). Two real findings survived verification, both already covered by the fixes above (the test-coverage gap, and the accountHref guard). Three low-severity findings (a brief loading-state flash for already-subscribed users, an unreachable-today partial-account-fields edge case, one now-unused label prop) logged to `deferred-work.md`.

## Verification

**Commands:**
- `pnpm --filter web exec tsc --noEmit` -- PASS (only pre-existing, unrelated errors elsewhere).
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- PASS (only the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter web test EventDetailWrapper` -- PASS, 2 files / 28 tests.
- `pnpm --filter @festgrid/ui test EventDetailView` -- PASS, 30/30.
- `pnpm --filter @festgrid/ui test` (full) -- PASS, 46 files / 359 tests.
- `pnpm --filter web test` (full) -- 45/50 files pass; the 5 failing files (21 tests) are an unrelated, pre-existing regression from `spec-ux-rework2-batch-6.md` (`window.matchMedia` not guarded in `usePrefersReducedMotion`, breaking every page that renders the now-shared `EventDiscoveryPanel` in a test environment without a `matchMedia` mock) -- confirmed via direct investigation to be entirely unrelated to this batch's own files, logged in `deferred-work.md`, and is the next batch to fix.

## Suggested Review Order

**Data layer: subscription status + mutation**

- Entry point -- the subscription-check query and the derived `isSubscribedToAccount`.
  [`EventDetailWrapper.tsx:58`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L58)
  [`EventDetailWrapper.tsx:263`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L263)

- The subscribe mutation and its handler, mirroring the existing dialog's call shape.
  [`EventDetailWrapper.tsx:244`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L244)
  [`EventDetailWrapper.tsx:254`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L254)

**View layer: the card's new home**

- The render guard and the card itself, replacing the old bottom attribution line.
  [`EventDetailView.tsx:233`](../../packages/ui/src/features/events/EventDetailView.tsx#L233)

**Review-driven fixes**

- The `accountHref` addition to the render guard, closing a real TypeScript error at the `web` build boundary.
  [`EventDetailView.tsx:233`](../../packages/ui/src/features/events/EventDetailView.tsx#L233)

**Peripherals**

- New tests, including the one that traced a real mutation-mock casing bug (`subscribeToAccount` vs. `SubscribeToAccount`) before it could hide a broken subscribe flow.
  [`EventDetailWrapper.test.tsx`](../../apps/web/src/features/events/EventDetailWrapper.test.tsx)
  [`EventDetailView.test.tsx`](../../packages/ui/src/features/events/EventDetailView.test.tsx)

