---
title: 'ux-rework2-p1-subscribed-account-card'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'ready-for-dev'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md`'s biggest P1 item asks for a shared subscribed-account inline-card (image, name/id, subscribe button/subscribed state, instagram-icon fallback, click-through to the account's public page), eventually reused across Post Selection, Subscribed Accounts, and Event Detail. Today each context that shows account info does it differently (or, for Post Selection and Event Detail, doesn't show a subscribe control at all).

**Approach:** Build ONLY the new shared component in this batch — a presentational composite over the existing `AccountAvatar` — with no GraphQL/router coupling and no wiring into any consumer page. Wiring is real per-page work (existing markup to replace, each page's own subscribe/unsubscribe mutation) and is separate follow-up batches once this component's design is settled.

## Boundaries & Constraints

**Always:** Compose the existing `AccountAvatar` (`packages/ui/src/core/account-avatar.tsx`) for the image/fallback — do not duplicate its fallback-icon logic. Keep the component free of GraphQL and Next.js router imports (matching `packages/ui`'s existing decoupling: `EventDetailView.tsx`'s `accountHref` prop is the established pattern for "caller computes the URL, component just renders the link"). Subscription state is a plain `isSubscribed` boolean prop — no GraphQL schema field for this exists, so it can never be derived internally. Place it in `packages/ui/src/features/subscriptions/` (already exists, holds `SubscriptionPicker` + related types) per project-context.md's core-vs-features convention.

**Ask First:** None — the prop shape is fully determined by what the three eventual real callers will need (per investigation), even though wiring them up is out of scope here.

**Never:** Do not touch `posts-select-content.tsx`, `subscriptions-content.tsx`, `EventDetailView.tsx`/`EventDetailWrapper.tsx`, or any GraphQL mutation hook — wiring is explicitly deferred. Do not invent an `isSubscribed` GraphQL field or otherwise touch the backend schema.

</frozen-after-approval>

## Code Map

- `packages/ui/src/core/account-avatar.tsx:6-11,30-76` -- `AccountAvatar` props (`profileImageUrl?, displayName?, username?, size?: 'sm'|'lg'`), already handles the fallback-icon case (an inline person-silhouette SVG, `data-testid="avatar-fallback-placeholder"`) on missing/broken image. Compose this directly for the new card's image.
- `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx:5-16` -- existing `SubscriptionAccountProfile`/`SubscriptionItem` types in the same folder; the new component's account-shape prop should read similarly (`platform`, `displayName`, `username`, `profileImageUrl`) plus the external `accountId` those types don't currently carry (needed for the account-page link — the internal `id` on `SubscriptionAccountProfile` is a different, internal UUID per this session's earlier investigation of the same distinction).
- `packages/ui/src/features/events/EventDetailView.tsx:416-424` -- existing `accountHref` prop pattern (a plain caller-computed URL string rendered as a link) to mirror, rather than importing `next/navigation`'s router into `packages/ui`.
- `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx:97-104` -- reference for how the account-page URL is actually built by a real caller (`getPlatformSlug(platform)` + `/${slug}/${accountId}`, from `@festgrid/domain/scraper`) -- informs the shape callers will pass as `accountHref`, not code this batch writes.
- `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx:54-61`, `subscriptions-content.tsx:124-127` -- the two real (asymmetric) mutations a future wiring batch will call: `useSubscribeToAccountMutation({ input: { platform, accountId, username, displayName } })` and `useRemoveSubscriptionMutation({ id: subscriptionId, action })`. Neither is called by this batch -- informs why the new component takes plain `onSubscribe`/`isSubscribing` callback props instead of any mutation logic of its own.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` (new) -- composes `AccountAvatar` (image) + name/username text + a subscribe control, in a single row-style card. Whole avatar+name region is wrapped in an `<a href={accountHref}>` (click-through to the account page). Subscribe control: `isSubscribed ? <span>{labels?.subscribedLabel || 'Subscribed'}</span> : <button type="button" onClick={onSubscribe} disabled={isSubscribing}>{labels?.subscribeLabel || 'Subscribe'}</button>`.
- [ ] `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts` (new) -- `SubscribedAccountCardProps`: `{ account: { accountId: string; platform: string; displayName: string; username: string; profileImageUrl?: string | null }; accountHref: string; isSubscribed: boolean; onSubscribe?: () => void; isSubscribing?: boolean; labels?: { subscribeLabel?: string; subscribedLabel?: string }; size?: 'sm' | 'lg'; className?: string }`.
- [ ] `packages/ui/src/features/subscriptions/index.ts` -- export the new component and its types.
- [ ] `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` (new) -- covers: renders `AccountAvatar` with the account's image props (and its existing fallback still applies when `profileImageUrl` is missing); avatar+name link to `accountHref`; shows "Subscribe" button and calls `onSubscribe` on click when `isSubscribed` is false; shows "Subscribed" (no button) when true; `disabled` + no `onSubscribe` call while `isSubscribing`; custom `labels` override the defaults.

**Acceptance Criteria:**
- Given `profileImageUrl` is set, when rendered, then the image displays; given it's missing or fails to load, then `AccountAvatar`'s existing fallback icon shows instead (no new fallback logic duplicated).
- Given a user clicks the avatar or name/username text, when the click resolves, then it's a real link to `accountHref` (works without JS, matching `EventDetailView`'s existing `accountHref` pattern).
- Given `isSubscribed` is false, when rendered, then a "Subscribe" button shows; clicking it calls `onSubscribe` (if provided) and nothing else -- the component makes no GraphQL calls itself.
- Given `isSubscribed` is true, when rendered, then a "Subscribed" indicator shows in place of the button.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- ui package type-checks (excluding the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter @festgrid/ui test SubscribedAccountCard` -- new tests pass.
- `pnpm test` -- full project test suite passes (this batch touches no other file, so no regression risk expected elsewhere).

