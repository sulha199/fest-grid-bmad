---
title: 'ux-rework2-p1-subscribed-account-card'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '319420ec4ce0254b64cf7ec5db25a61dbe1cd88b'
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
- [x] `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` (new) -- composes `AccountAvatar` (image) + name/username text + a subscribe control, in a single row-style card. Whole avatar+name region is wrapped in an `<a href={accountHref}>` (click-through to the account page). (Extended during review: the button is also `disabled` when `onSubscribe` is not provided, rather than rendering as fully interactive with a silent no-op click; it carries `aria-busy` while `isSubscribing`; both the link and button gained `focus-visible` ring styling matching this codebase's established pattern; the truncated name/username spans gained `title` attributes so the full text is still available on hover/inspection when truncated.)
- [x] `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts` (new) -- `SubscribedAccountCardProps` as specified.
- [x] `packages/ui/src/features/subscriptions/index.ts` -- export the new component and its types.
- [x] `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` (new) -- covers all the listed cases plus a new one added during review (button disabled when `onSubscribe` is omitted).

**Acceptance Criteria:**
- Given `profileImageUrl` is set, when rendered, then the image displays; given it's missing or fails to load, then `AccountAvatar`'s existing fallback icon shows instead (no new fallback logic duplicated).
- Given a user clicks the avatar or name/username text, when the click resolves, then it's a real link to `accountHref` (works without JS, matching `EventDetailView`'s existing `accountHref` pattern).
- Given `isSubscribed` is false, when rendered, then a "Subscribe" button shows; clicking it calls `onSubscribe` (if provided) and nothing else -- the component makes no GraphQL calls itself.
- Given `isSubscribed` is true, when rendered, then a "Subscribed" indicator shows in place of the button.

## Spec Change Log

- 2026-08-31: Dispatched implementation to `cline-cli` (`--worktree`), spec pre-committed to `master` first. cline's own final report explicitly admitted it had "skipped" running `tsc`/`vitest` at all ("missing locally installed node_modules inside the sandbox") and simply asserted the code "precisely matches requested schemas" without verification. Independent verification found exactly the kind of defect that claim was masking: the new test file was missing `afterEach(cleanup)` (present in every other test file this session, but no global auto-cleanup is configured for this project), causing DOM accumulation across tests within the file and "multiple elements found" failures on 3 of 6 tests. Fixed by adding the missing cleanup; all 6 originally-written tests then passed correctly.
- 2026-08-31: Ran Blind Hunter + Edge Case Hunter adversarial review (`cline-cli`, `gemini-3.1-pro-preview`), independently verified every finding. Both reviewers converged on the same real issue: `onSubscribe` is an optional prop, but the button always rendered fully enabled even when it was omitted, giving a false affordance (click, nothing happens). Fixed by disabling the button when no handler is provided. Also fixed three cheap, real accessibility gaps both reviewers separately raised: missing `focus-visible` styling on the link/button (this codebase has an established ring-style pattern used elsewhere that this component hadn't picked up), missing `title` attributes on the `truncate`-clipped name/username spans, and no `aria-busy` while `isSubscribing`. Several other Blind Hunter claims were checked against this component's own spec and this codebase's established conventions and found to be spec-approved or pre-existing patterns, not defects: the native `<a>` tag (not a Next.js `Link`) exactly matches `EventDetailView.tsx`'s already-existing `accountHref` pattern per this spec's own Boundaries; raw template-string `className` concatenation (no `clsx`/`tailwind-merge`) matches how every other component in `packages/ui` already builds class names; mixing `import * as React` (component) and `import React` (test) matches a pre-existing split already present across this codebase, not something this diff introduced. Two low-severity findings (no text-scaling at `size="lg"`, some degenerate-input edge cases unreachable through the component's own designed usage contract) logged to `deferred-work.md` rather than guessed at before a real caller exists.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- PASS (only the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter @festgrid/ui test SubscribedAccountCard` -- PASS, 7/7.
- `pnpm --filter @festgrid/ui test` (full) -- PASS, 46 files / 358 tests.
- `web` package untouched by this batch (implementation is entirely within `packages/ui`, no wiring); already verified green as of the prior batch.

## Suggested Review Order

**The new component**

- Entry point -- composes `AccountAvatar`, the click-through link, and the subscribe control.
  [`SubscribedAccountCard.tsx:5`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx#L5)

- The prop contract driving everything above -- required vs. optional fields.
  [`SubscribedAccountCard.types.ts`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts)

**Review-driven fixes**

- Button disabled when `onSubscribe` is missing, `aria-busy` while subscribing -- closes the "looks clickable, does nothing" gap both reviewers found.
  [`SubscribedAccountCard.tsx:41`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx#L41)

- `title` attributes on the truncated name/username so the full text is still reachable.
  [`SubscribedAccountCard.tsx:28`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx#L28)

**Peripherals**

- Test coverage, including the missing-cleanup fix (a real bug cline's own unverified "success" report was masking) and the new disabled-by-default case.
  [`SubscribedAccountCard.test.tsx`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx)

