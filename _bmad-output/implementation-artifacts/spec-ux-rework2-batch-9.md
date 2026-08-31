---
title: 'Post Selection account avatars: reuse AccountAvatar (Instagram fallback)'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'f393baa11d87d6cfe50e71be2e35799a444b45f0'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Post Selection's account-tab row (`posts-select-content.tsx`) renders each subscribed account's avatar with a raw `<img>` and a plain lucide `User` icon fallback, duplicating logic that `AccountAvatar` (`packages/ui/src/core/account-avatar.tsx`, extracted in `spec-ux-rework2-batch-7.md`) already solves with a proper Instagram-styled placeholder and broken-image recovery — this is the exact bug named in `ux-rework2.md`'s "use instagram-app icon if we don't have the account's profile picture."

**Approach:** Swap the raw `<img>`/`User`-icon block for `AccountAvatar`. The full `SubscribedAccountCard` (batch-7/8) does not fit here: this row is a clickable tab-selector (`<button onClick>` switches the active account), and `SubscribedAccountCard` renders its own internal `<a href>` (and conditionally a `<button>`) — nesting either inside the outer tab `<button>` is invalid HTML and creates conflicting click targets. Only `AccountAvatar` is reused, not the full card. `AccountAvatar` currently only exposes `sm` (`w-10 h-10`) and `lg` sizes, both too large for this compact pill; add an `xs` (`w-5 h-5`) size matching the current pixel size exactly, so the swap is a pure fallback-treatment upgrade with zero visual-size change.

## Boundaries & Constraints

**Always:** Preserve the tab `<button>`'s existing `onClick`/active-state/accessibility behavior untouched — only the avatar markup inside it changes. `AccountAvatar`'s new `xs` size must render at exactly `w-5 h-5` (the current raw markup's size) so no layout shift occurs. `username` is already selected by the `getMySubscriptions` query (`apps/web/src/features/subscriptions/queries.graphql:14`) — no query/codegen changes needed.

**Ask First:** None anticipated — this is a display-only, same-data swap with no new data dependency or interaction change.

**Never:** Do not touch `SubscribedAccountCard.tsx`/`.types.ts` (frozen batch-7/8 contract) — this batch only extends `AccountAvatar`. Do not wire the full `SubscribedAccountCard` into this tab row (ruled out during investigation, confirmed with the human). Do not touch the `publisher` avatar shown inside each `PostCard` (a different, already-existing attribution pattern, out of scope here).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Account has a profile image | `sub.account.profileImageUrl` is a valid URL | `AccountAvatar` renders the `<img>` at `xs` size (`w-5 h-5`), same as today | If the image fails to load, `AccountAvatar`'s own `onError` swaps to the Instagram placeholder (existing behavior, not new to this batch) |
| Account has no profile image | `sub.account.profileImageUrl` is `null`/`undefined` | `AccountAvatar` renders the Instagram-styled SVG placeholder at `xs` size, replacing today's plain lucide `User` icon | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/core/account-avatar.tsx` -- add `'xs'` to the `size` prop union and its `sizeClasses` ternary (`w-5 h-5`, single breakpoint like `sm`, matching current markup exactly)
- `packages/ui/src/core/account-avatar.test.tsx` -- add a test asserting `size="xs"` renders the `w-5 h-5` classes (both image and fallback-placeholder branches)
- `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx:429-440` -- replace the raw `<img>`/`<User>`-icon-fallback block with `<AccountAvatar profileImageUrl={sub.account.profileImageUrl} displayName={sub.account.displayName} username={sub.account.username} size="xs" />`; remove the now-unused `User` import from `lucide-react` if nothing else in the file uses it
- `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` -- verify existing tab-rendering tests still pass unchanged (asserting avatar presence via `alt`/testid, not the removed raw markup); add a case for the no-profile-image fallback rendering `AccountAvatar`'s placeholder testid instead of the old `User`-icon fallback

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/core/account-avatar.tsx` -- added `'xs'` size variant (`w-5 h-5`, no responsive step) to `AccountAvatarProps['size']` and the `sizeClasses` ternary
- [x] `packages/ui/src/core/account-avatar.test.tsx` -- added 2 tests for `size="xs"` (image + placeholder-fallback branches)
- [x] `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` -- imported `AccountAvatar` from `@festgrid/ui`, replaced the raw avatar block with it at `size="xs"`, dropped the now-unused `User` import
- [x] `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` -- strengthened the existing avatar test to assert `AccountAvatar`'s testids (`avatar-image`, `avatar-fallback-container`, `avatar-fallback-placeholder`) instead of the removed raw markup's generic `<svg>` check

**Acceptance Criteria:**
- Given a subscribed account with a `profileImageUrl`, when Post Selection renders its tab, then the tab shows that image at the same `w-5 h-5` size as before.
- Given a subscribed account with no `profileImageUrl`, when Post Selection renders its tab, then the tab shows `AccountAvatar`'s Instagram-styled placeholder (not the previous lucide `User` icon) at `w-5 h-5`.
- Given the tab row after this change, when a user clicks a tab, then the existing `setActiveAccountId` behavior fires exactly as before (no regression to tab-switching).

## Suggested Review Order

- Entry point -- the shared component change: [`account-avatar.tsx:7-11,47-56`](../../packages/ui/src/core/account-avatar.tsx#L7-L56)
- The call site: [`posts-select-content.tsx:429-441`](../../apps/web/src/app/%5Blocale%5D/posts/select/posts-select-content.tsx#L429-L441)
- Tests: [`account-avatar.test.tsx:118-140`](../../packages/ui/src/core/account-avatar.test.tsx#L118-L140), [`posts-select-content.test.tsx:283-296`](../../apps/web/src/app/%5Blocale%5D/posts/select/posts-select-content.test.tsx#L283-L296)

## Spec Change Log

- `cline-cli`'s hub daemon was found broken partway through this batch: 3 consecutive `--worktree` implementation launches hung identically (each registered with the local hub then went silent forever, confirmed via `~/.cline/data/logs/hub-daemon.log`, no CPU activity, no worktree file changes). Diagnosed and cleaned up stray processes/worktrees/a stale lock file between attempts; the hang persisted even from a fully clean state. Asked the human how to proceed -- chosen: implement directly rather than keep retrying. Implemented this spec by hand instead of via cline delegation.
- A 4th cline-cli launch (the Blind Hunter review step, non-worktree) hung the same way. Performed the Blind Hunter and Edge Case Hunter review passes directly instead of via `cline -m gemini-3.1-pro-preview`, applying the same prompts/rigor used every other batch this session.

## Design Notes

`AccountAvatar`'s `sizeClasses` ternary currently has two branches (`sm`/`lg`); this adds a third (`xs`) rather than converting to a lookup table, since only three concrete sizes exist. `xs` and `sm` differ only in dimension (`w-5 h-5` vs `w-10 h-10`) — both single-breakpoint (no `sm:` step needed for `xs`, matching `sm`'s own lack of one).

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test account-avatar` -- 12/12 passed (10 existing + 2 new `xs`-size tests)
- `pnpm --filter web test posts-select-content` -- 20/20 passed
- `pnpm --filter web build` (type-checks `@festgrid/ui`'s source too, since it has no separate build step) -- succeeded, no new TS errors
- `pnpm test` (full monorepo) -- 9/11 tasks passed on first run; `@festgrid/ui#test` showed 2 failures (`EventCard.test.tsx`, `WeeklyCalendarView.test.tsx`). Reproduced both against a `git stash`-clean baseline with no batch-9 changes present -- confirmed pre-existing wall-clock-date-rollover flakiness (missing `vi.useFakeTimers()` in both), unrelated to this batch. Logged to `deferred-work.md`. All other packages (`web` full suite included) passed cleanly on both runs.

**Adversarial review:** Performed directly (Blind Hunter + Edge Case Hunter prompts/rigor, `cline-cli`'s hub daemon was down -- see Spec Change Log). Two minor, non-blocking findings, both logged to `deferred-work.md`: (1) `AccountAvatar`'s hardcoded `border-slate-200/800` vs the app's semantic `border-border` token -- pre-existing since batch-7, inherited not introduced; (2) empty-string `displayName` `alt`-text edge case -- unreachable through real data. No blocking issues found.
