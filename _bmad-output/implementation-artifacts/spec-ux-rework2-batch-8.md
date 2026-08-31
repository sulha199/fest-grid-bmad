---
title: 'ux-rework2-p1-wire-subscribed-account-card-event-detail'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'ready-for-dev'
review_loop_iteration: 0
context: []
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
- [ ] `queries.graphql` -- add `username` to the `sourceSocialMediaAccountProfile` selection; regenerate types (project's codegen command).
- [ ] `mapper.ts` -- pass through `accountId`, `username` (as `accountUsername`), `platform` (as `accountPlatform`) alongside the existing account fields.
- [ ] `EventDetailWrapper.tsx` -- add the subscription-check query, the subscribe mutation (+ cache invalidation + `setLiveMessage` announcement), and pass `isSubscribedToAccount`/`onSubscribeToAccount`/`isSubscribingToAccount` down to `EventDetailView`.
- [ ] `EventDetailView.types.ts` -- add the new props listed in the Code Map.
- [ ] `EventDetailView.tsx` -- render `SubscribedAccountCard` (size="sm") as a left-side sibling in the top button row when account data exists; remove the now-redundant bottom "Attributions" section.
- [ ] Update/add tests in `EventDetailWrapper.test.tsx` and `EventDetailView.test.tsx`: card renders with correct account data; shows "Subscribe" when not subscribed and calls the mutation on click; shows "Subscribed" when already subscribed; the old Attributions section is gone.

**Acceptance Criteria:**
- Given an event's source account, when Event Detail renders, then `SubscribedAccountCard` shows to the left of the favorite/add-to-calendar buttons with the account's avatar, name, and username.
- Given the viewer is not subscribed to that account, when rendered, then the card shows a "Subscribe" button; clicking it calls `useSubscribeToAccountMutation` with the account's platform/accountId/username/displayName, and on success the card updates to "Subscribed" without a full page reload.
- Given the viewer is already subscribed, when rendered, then the card shows "Subscribed" (no button).
- Given Event Detail renders, when inspected, then the old bottom "Attributions" line is no longer present (superseded by the new card).

## Verification

**Commands:**
- `pnpm --filter web exec tsc --noEmit` -- web app type-checks.
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- ui package type-checks (excluding the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter web test EventDetailWrapper` -- targeted tests pass.
- `pnpm --filter @festgrid/ui test EventDetailView` -- targeted tests pass.
- `pnpm test` -- full project test suite passes.

