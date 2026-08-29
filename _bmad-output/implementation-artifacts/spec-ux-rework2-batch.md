---
title: 'ux-rework2-batch'
type: 'feature'
created: '2026-08-29T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'c9ed20813d3d8c4d134ec1e3b184f160fa513ad9'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md` bundles 8 small, independent UX fixes/tweaks across masonry view, onboarding, user menu, discovery, account images, subscribed-accounts navigation, event-extraction automation, and API-key validation. User chose to keep all 8 in one quick-dev batch (accepting the bundling risk) rather than splitting into separate sessions; the ai-filter-creation item was dropped (it requires a full unbuilt feature, tracked separately in deferred-work.md) and the last-scrape-run check was explicitly deferred by the user.

**Approach:** Apply each fix at its already-identified root cause (found via investigation, not guessed): a hardcoded gap/font/date-badge in `EventCard`/`EventListView`; a React Query cache-key fragmentation bug (`{}` vs `undefined` variables) that starves the onboarding-completion guard of the wizard's cache updates; a prop simply not forwarded to the desktop `UserMenu`; an unconditional auto-apply effect on Discovery's nearby filter; a new shared `AccountAvatar` component; a missing GraphQL field + link on the subscriptions row; wiring the existing `backfillAccountProfileAndInferDefaultLocationSeam` into the extraction pipeline (today only wired into the scrape pipeline); and a new Gemini key-verification call (reusing the already-configured lite model) in `createApiKey`.

## Boundaries & Constraints

**Always:** Reuse existing mechanisms/components already in the codebase (e.g. `backfillAccountProfileAndInferDefaultLocationSeam`, `callGeminiGenerateContent`, `env.geminiModel`) rather than building new ones. Keep each of the 8 fixes independently reviewable in the diff (no cross-goal coupling beyond what's listed). Masonry cards stay clickable regardless of date; the badge always renders but its content switches (relative date label when not today, clock/time when today).

**Ask First:** None — all ambiguities were resolved during planning (masonry clock-badge gating confirmed with user; Gemini key-check fail-open behavior on non-invalid errors is a stated default below, not a runtime HALT).

**Never:** Do not touch the ai-filter-creation feature (deferred). Do not implement the post-selection "check last scrape run" item (explicitly deferred by user). Do not add a live Instagram network fetch for the avatar fallback — use a static platform-branded placeholder asset. Do not change `env.geminiModel`/add a new model constant for key verification — the existing configured model is already the lite tier.

## Code Map

- `packages/ui/src/features/events/EventListView.tsx:22,56` -- masonry gap hardcoded to `gap-6`; make masonry-specific and smaller.
- `packages/ui/src/features/events/EventCard.tsx:240-244,261` -- masonry date badge + title font size.
- `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx:44-64`, `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx:39-45`, `apps/web/src/app/[locale]/settings/account/api-keys-content.tsx:40-46` -- pass `{}` instead of `undefined` as query variables, fragmenting the React Query cache key vs. the wizard steps/`use-has-api-key.ts` (which pass `undefined`), so the wizard's `invalidateQueries`/`setQueriesData` never reaches these guard reads.
- `packages/ui/src/core/app-shell/AppShell.tsx:186-197` -- desktop `<UserMenu>` call omits `moderatorPendingItemCount` (mobile instance at 144-156 passes it).
- `apps/web/src/app/[locale]/use-nearby-filter.ts:60-103` -- auto-apply effect (saved location or geolocation) on first Discovery visit; consumed only by `home-content.tsx`.
- `packages/ui/src/features/posts/PostCard.tsx:119-129`, `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx:199-209`, `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx:229-235` -- three independent inline avatar-fallback implementations to consolidate.
- `apps/web/src/features/subscriptions/queries.graphql:9-26` -- `account { }` selection lacks `accountId` (the external platform ID; `id` there is the internal UUID).
- `apps/backend/src/lib/ai-processor/process-ai-job.ts:72-76,122` -- `resolveAccountAndLocations` already resolves `defaultLocation`; hook point for the auto-infer call.
- `apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts` -- existing `backfillAccountProfileAndInferDefaultLocationSeam(accountId, scrapedPosts)`, already idempotent (guards on `defaultLocation !== null`).
- `apps/backend/src/lib/scraper/process-scrape-job.ts:9-13,48` -- reference call site/pattern (awaited synchronously) to mirror.
- `apps/backend/src/lib/ai-gateway/gemini-client.ts` -- `callGeminiGenerateContent(apiKey, request)`, `GeminiInvalidKeyError`; `apps/backend/src/schema/resolvers.ts:191-221` -- `createApiKey` resolver, currently inserts with `isValid: true` unconditionally.

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/features/events/EventListView.tsx` -- apply a smaller gap (e.g. `gap-2`) only when `viewMode === 'masonry'`, keep standard grid at `gap-6` -- user-requested tighter masonry spacing. **(done — commit c7a3864, this session)**
- [x] `packages/ui/src/features/events/EventCard.tsx` -- masonry branch: reduce title `<h3>` font size one step (e.g. `text-xl` → `text-sm`), leave standard branch untouched; the badge always renders, but its content switches based on the existing day-diff logic (from `formatRelativeDayOrDate`): show the relative date label (e.g. "Tomorrow", weekday, or date) when the event is NOT today, and the time/clock when it IS today -- card stays clickable regardless of date, per user confirmation. **(done — commit c7a3864, this session)**
- [x] `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`, `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx`, `apps/web/src/app/[locale]/settings/account/api-keys-content.tsx` -- change the `{}` variables argument to `undefined` on `useGetMySubscriptionsQuery`/`useGetMyApiKeysQuery` so their cache key matches the wizard steps' -- fixes the onboarding-completion redirect race by letting the guard read the same cache entry the wizard already updated. **(done — commit 8ec214e, parallel session)**
- [x] `packages/ui/src/core/app-shell/AppShell.tsx` -- add `moderatorPendingItemCount={moderatorPendingItemCount}` to the desktop `<UserMenu>` call -- restores the missing badge. **(done — commit 15c31a8, parallel session)**
- [x] `apps/web/src/app/[locale]/use-nearby-filter.ts` -- remove the first-visit auto-apply effect (saved-location and geolocation auto-attempt); nearby filter activates only via explicit user action or an existing `nearby` URL param -- update `apps/web/src/app/[locale]/nearby.test.tsx` accordingly. **(done — commit 125444b, parallel session)**
- [x] `packages/ui/src/core/account-avatar.tsx` (new) -- `AccountAvatar({ profileImageUrl, displayName, username, size? })`: renders the image with an `onError` handler; falls back (on null/empty/error) to a bundled Instagram-style default silhouette placeholder -- one shared fallback instead of three drifted inline ones. **(component done — commit dbb6054, parallel session; consumer wiring below still open)**
- [x] `packages/ui/src/features/posts/PostCard.tsx`, `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx`, `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` -- replace each inline avatar block with `<AccountAvatar>`. **(done — commit 8ec214e, parallel session)**
- [x] `apps/web/src/features/subscriptions/queries.graphql` -- add `accountId` to the `account { }` selection; regenerate types (`pnpm --filter web codegen` or project's codegen command). **(done — commit 8ec214e, parallel session)**
- [x] `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx` -- make each subscription row navigate to `/${getPlatformSlug(sub.account.platform)}/${sub.account.accountId}` on click, keeping the existing "Set Default Location" and delete buttons functional (`stopPropagation` on those). **(done — commit 8ec214e, parallel session)**
- [x] `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- after a successful event extraction, if the resolved `defaultLocation` is falsy, `await` a try/caught call to `backfillAccountProfileAndInferDefaultLocationSeam(message.accountId, [post])` (mirroring `process-scrape-job.ts`'s pattern), logging and continuing on failure rather than failing the extraction. **(done — commit 728ebf9, parallel session)**
- [x] `apps/backend/src/lib/ai-gateway/gemini-client.ts` -- add `verifyGeminiApiKey(apiKey): Promise<boolean>` calling `callGeminiGenerateContent(apiKey, { contents: 'ping' })`; returns `false` on `GeminiInvalidKeyError`, `true` on success, re-throws other errors. **(done — commit 6e3f832, parallel session)**
- [x] `apps/backend/src/schema/resolvers.ts` -- in `createApiKey`, call `verifyGeminiApiKey(normalizedKey)` before insert; reject with `GraphQLError('Invalid Gemini API key', { extensions: { code: 'INVALID_API_KEY' } })` only if it resolves `false`; on any other (thrown) error, log a warning and proceed with insertion (fail-open on transient Gemini/network issues). **(done — commit 6e3f832, parallel session)**

**Acceptance Criteria:**
- Given the masonry view, when an event is not scheduled today, then its badge shows the relative date label (not a time); when it is scheduled today, the badge shows the time/clock instead — the card remains clickable in both cases.
- Given a user completes the onboarding wizard's subscribe step and lands on a guarded page (Manual Post Selection, Subscribed Accounts), when the guard re-checks subscriptions, then it reads the same already-updated cache entry and does not redirect back to the wizard.
- Given a moderator on desktop opens the user menu, when pending items exist, then the moderator items entry shows the count badge.
- Given a first-time Discovery visit, when the page loads, then no filter is auto-applied unless the URL already has a `nearby` param.
- Given an account with no `profileImageUrl` on Post Selection, Subscribed Accounts, or the account detail page, when rendered, then the same Instagram-style placeholder shows via `AccountAvatar`.
- Given the Subscribed Accounts list, when a user clicks a row (not the location/delete buttons), then they navigate to that account's `/${platformSlug}/${accountId}` page.
- Given an extracted event whose account has no default location, when extraction completes, then location inference runs automatically without blocking the event's own visibility on failure.
- Given a user submits an invalid Gemini API key, when `createApiKey` runs, then it is rejected with `INVALID_API_KEY` and not persisted; given a valid key or a transient verification error, then it is persisted as today.

## Spec Change Log

- 2026-08-29: User corrected the masonry badge behavior during implementation — it's "time/clock" not "time/click" (typo), and the badge is never hidden: it shows the relative date label when not today, and switches to the time/clock only when the event is today. Amended Boundaries, the EventCard task, and the first Acceptance Criterion accordingly. KEEP: card stays clickable regardless of date in all cases.
- 2026-08-29: Discovered a second Claude Code session ("bmad-c6") independently working this exact spec in parallel, in the same shared working tree, via cline in isolated worktrees (`C:\wt\ux2-*`), merging straight to `master`. Reconciled: their 4 completed+merged tasks (moderator badge 15c31a8, AccountAvatar component dbb6054, Gemini key verification 6e3f832, auto location-inference 728ebf9) marked `[x]` above. Ownership split going forward: this session keeps the masonry task (in progress, uncommitted edits already in the working tree); the other session takes the remaining "Wave 2" tasks (cache-key fix, queries.graphql accountId, subscribed-accounts click-through nav, AccountAvatar consumer wiring) plus confirming/finishing the Discovery nearby-filter task. Both sessions independently verify before merging, per this spec's existing Design Notes.
- 2026-08-29: Adversarial review (Blind Hunter + Edge Case Hunter) surfaced one **intent_gap**: removing Discovery's nearby-filter auto-apply (commit 125444b) deleted behavior Story 2.5 (`_bmad-output/implementation-artifacts/2-5-find-nearby-events.md`, still status `review`) formally specs as AC4/AC5 and marked done in its own Definition of Done — the user's one-line intent didn't account for this pre-existing formal contract. User decision: keep the removal, amend Story 2.5 (done — AC4/AC5 marked superseded, Definition of Done updated, change log entry added to that story file). Remaining findings triaged as **patch** (fixed directly: `AccountAvatar` broken-image recovery, subscribed-accounts row keyboard access + undefined-platform-slug guard + swipe-drag-vs-click guard, `EventCard`'s duplicate day-diff computation, `process-ai-job.test.ts` Case K's AJV-invalid mock giving a false-passing assertion, asymmetric test cleanup in Cases J/L, a brittle `keyLast4` suffix-match assertion in `api-keys.test.ts`) or **defer** (5 pre-existing architectural gaps unrelated to this batch's own defects, logged in `deferred-work.md` under "adversarial review of ux-rework2 batch"). Two findings **rejected** as noise (the Gemini key-check's real API call and the masonry title-size change are both explicit, approved parts of this spec, not oversights).
- 2026-08-29: A separate correction (peer session, commit `2d79137`) found this spec's own Intent section claimed the dropped ai-filter-creation item was "tracked separately in deferred-work.md" when it actually wasn't yet — now fixed (and superseded by a proper Epic 7 build-out, Stories 7.1a-7.5, rather than staying a deferred-work stub). Noted here for traceability; no action needed in this spec.

## Design Notes

**Execution:** Delegate coding/test-writing for these tasks to the `cline` CLI where practical (per-task or grouped, in an isolated worktree), verifying each result independently before merging rather than trusting its own report.

**Onboarding race root cause (verified, not guessed):** the generated hook's cache key is `variables === undefined ? [opName] : [opName, variables]`. Three call sites pass `{}` (a second, disconnected cache entry) while the wizard steps and other consumers pass `undefined` — the wizard's cache writes/invalidations never reach the `{}`-keyed entry, forcing a redundant fresh fetch exactly when the guard decides whether to redirect. Aligning all call sites to `undefined` fixes this without touching the guards' own logic.

**Avatar fallback:** interpreted "use instagram image if we don't have the profile picture" as an Instagram-style default placeholder (not a live fetch from Instagram, which would add scraping/rate-limit/ToS risk for a quick-dev batch) — flag for confirmation at checkpoint if a literal live fetch was intended.

## Verification

**Commands:**
- `pnpm --filter web exec tsc --noEmit` -- web app type-checks after all frontend changes.
- `pnpm --filter backend exec tsc --noEmit` -- backend type-checks after the extraction/key-verification changes.
- `pnpm --filter web test nearby subscriptions-content posts-select-content` -- targeted frontend tests pass (update fixtures for the removed auto-apply and new navigation/avatar behavior).
- `pnpm --filter backend test` (targeted files touched: `process-ai-job`, `resolvers`/`api-keys`, `gemini-client`) -- backend tests pass, including a new case for `verifyGeminiApiKey` rejecting an invalid key.

## Suggested Review Order

**Onboarding redirect race (cache-key fix)**

- Root cause: `undefined` vs `{}` as the no-op query-variables argument silently forks the React Query cache key.
  [`posts-select-content.tsx:46`](../../apps/web/src/app/[locale]/posts/select/posts-select-content.tsx#L46)

- Same fix applied so the settings page reads the wizard's already-updated cache entry.
  [`subscriptions-content.tsx:41`](../../apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx#L41)

- Same fix for the API-key guard's own query.
  [`api-keys-content.tsx:42`](../../apps/web/src/app/[locale]/settings/account/api-keys-content.tsx#L42)

**Discovery nearby-filter opt-in (Story 2.5 amendment)**

- First-visit auto-apply/geolocation-prompt effect removed; filter now only activates explicitly.
  [`use-nearby-filter.ts:104`](../../apps/web/src/app/[locale]/use-nearby-filter.ts#L104)

- Story 2.5's AC4/AC5 marked superseded with a dated amendment note, since this removal deleted formally-specced behavior.
  [`2-5-find-nearby-events.md:4`](./2-5-find-nearby-events.md#L4)

**Gemini API-key validation on add**

- New verification call reusing the existing lite-model adapter, no new model config.
  [`gemini-client.ts:99`](../../apps/backend/src/lib/ai-gateway/gemini-client.ts#L99)

- `createApiKey` rejects only on a definitive invalid-key result; fails open on transient errors.
  [`resolvers.ts:214`](../../apps/backend/src/schema/resolvers.ts#L214)

**Auto location-inference after event extraction**

- Reuses the existing, already-idempotent backfill seam right after a successful extraction.
  [`process-ai-job.ts:127`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L127)

**Shared AccountAvatar component**

- New component: Instagram-style placeholder fallback, resets on a new `profileImageUrl` (review fix).
  [`account-avatar.tsx:30`](../../packages/ui/src/core/account-avatar.tsx#L30)

- `queries.graphql` gains the external `accountId` field needed by the new consumers/navigation.
  [`queries.graphql:11`](../../apps/web/src/features/subscriptions/queries.graphql#L11)

**Subscribed Accounts row navigation**

- Click-through to the account page, plus keyboard access and swipe-drag/unknown-platform guards (review fixes).
  [`subscriptions-content.tsx:97`](../../apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx#L97)

**Masonry view polish**

- Badge always renders now; switches between relative date and time/clock based on a single `dayDiff` computation.
  [`EventCard.tsx:268`](../../packages/ui/src/features/events/EventCard.tsx#L268)

- Masonry-specific grid gap, independent of the standard grid's.
  [`EventListView.tsx:22`](../../packages/ui/src/features/events/EventListView.tsx#L22)

**User menu moderator badge**

- Desktop `<UserMenu>` instance now forwards the count prop the mobile instance already had.
  [`AppShell.tsx:193`](../../packages/ui/src/core/app-shell/AppShell.tsx#L193)

**Peripherals**

- New test coverage for the badge-recovery fix.
  [`account-avatar.test.tsx`](../../packages/ui/src/core/account-avatar.test.tsx)

- New/updated masonry badge tests (today vs. not-today content).
  [`EventCard.test.tsx`](../../packages/ui/src/features/events/EventCard.test.tsx)

- Fixed an AJV-invalid mock that made a backfill-skip assertion pass for the wrong reason.
  [`process-ai-job.test.ts:734`](../../apps/backend/src/lib/ai-processor/process-ai-job.test.ts#L734)

- Replaced a coincidental string-suffix assertion with a row-count check.
  [`api-keys.test.ts:352`](../../apps/backend/src/schema/api-keys.test.ts#L352)

</frozen-after-approval>
