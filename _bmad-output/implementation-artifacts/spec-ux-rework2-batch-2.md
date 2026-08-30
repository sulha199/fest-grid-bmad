---
title: 'ux-rework2-batch-p0'
type: 'bugfix'
created: '2026-08-31T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'c69cd02d44d3abaf3ebf72236d43a67c6658a953'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md`'s P0 triage flags two silent/disconnected-state bugs, both now root-caused: "Add to Calendar" fails silently on error (dialog closes regardless of success), and toggling favorite from Event Detail never syncs back to whichever list (feed/home/favorites) the user opened it from.

**Approach:** Fix each at the diagnosed root cause — see Code Map. Three related P0 items (dead settings link, swallowed API-key error message, duplicate calendar favorite icon) were split off to `deferred-work.md` to keep this spec within its token target; they'll get a follow-up spec.

## Boundaries & Constraints

**Always:** Fix at the diagnosed root cause, not by patching symptoms. Keep the two fixes independently reviewable in the diff. Reuse existing patterns: `setLiveMessage`/`toast.error` for user-facing failure feedback (mirror `toggleFavorite`'s existing `onError` pattern for the calendar fix), `queryClient.setQueriesData` for cross-view react-query cache sync.

**Ask First:** None — both root causes and minimal fixes are already identified below.

**Never:** Do not touch the 3 items now in deferred-work.md (dead `/settings/subscriptions` link, API-key error-message swallowing, duplicate calendar Heart icon). Do not touch Story 2.5's nearby-filter logic or any other already-`done` item from the prior `ux-rework2` batch. Do not build a generic cross-mutation cache-sync abstraction beyond what these two fixes need — patch the specific query keys identified, don't over-engineer a shared helper unless it falls out naturally.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add to calendar succeeds | User confirms schedule selection in dialog | Dialog closes only after the mutation resolves; calendar state updates | N/A |
| Add to calendar fails (network/auth/GraphQL error) | `toggleCalendarAddition` throws | Dialog does not close on a false-success basis; `toast.error`/`setLiveMessage` fires with a visible message | Optimistic cache change (if any) rolled back |
| Favorite toggled from Event Detail, opened from feed | Feed list has the event cached under `["events","feed",...]` | That list's cached `isFavorited`/`favoriteCount` for the event updates without a manual refetch | N/A |
| Favorite toggled from Event Detail, opened from home/discovery | Home list cached under `["events",...]` | Same sync behavior as feed | N/A |
| Favorite toggled from Event Detail, opened from Favorites page | Favorites list cached under `["favoriteEvents",...]` | Same sync behavior; if un-favorited, item should reflect removal state consistent with how the Favorites page already handles it elsewhere | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventDetailView.tsx:568-571` -- `AddToCalendarDialog.handleConfirm` calls `onConfirm(selectedIds)` without awaiting, then immediately calls `onClose()`.
- `apps/web/src/features/events/EventDetailWrapper.tsx:357-379` -- `handleAddToCalendar` catch block only `console.error`s, no user-visible feedback.
- `apps/web/src/features/events/EventDetailWrapper.tsx:132-136` -- calendar mutation's `onError` only rolls back the optimistic cache, no announcement.
- `apps/web/src/features/events/EventDetailWrapper.tsx:79-84` -- reference pattern: `toggleFavorite`'s existing `onError` already calls `setLiveMessage(t("favoriteErrorAnnouncement"))` -- mirror this for the calendar mutation's `onError`.
- `apps/web/src/features/events/EventDetailWrapper.tsx:60-106` -- `toggleFavorite` mutation's `onMutate`/`onSuccess` only patch `queryKey: ["getEventBySlug"]`; never touches list caches.
- `apps/web/src/app/[locale]/feed/feed-content.tsx:150,171-176` -- feed's own `useToggleFavoriteMutation` instance, patches only `queryKey: ["events","feed"]`.
- `apps/web/src/app/[locale]/home-content.tsx:74-79,176` -- home's own instance, patches only `queryKey: ["events"]`.
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx:94,182,222,397-417` -- favorites page's own instance, patches only `queryKey: ["favoriteEvents"]` after an awaited `toggleFavoriteAsync`.

## Tasks & Acceptance

**Execution:**
- [x] `EventDetailView.tsx` -- `await onConfirm(selectedIds)` before calling `onClose()` in `AddToCalendarDialog.handleConfirm`; keep the dialog open (optionally with a pending/disabled-confirm state) while the mutation is in flight -- stops the dialog from closing before the app knows whether the change succeeded.
- [x] `EventDetailWrapper.tsx` -- add `setLiveMessage(...)`/`toast.error(...)` feedback in `handleAddToCalendar`'s catch block and in the calendar mutation's `onError`, mirroring the existing `toggleFavorite` `onError` pattern (line 79-84) -- makes calendar failures visible instead of silent.
- [x] `EventDetailWrapper.tsx` -- in `toggleFavorite`'s `onMutate`/`onSuccess`, also patch `queryClient.setQueriesData` for `["events"]`, `["events","feed"]`, and `["favoriteEvents"]` query keys, updating the matching event's `isFavorited`/`favoriteCount` by id wherever it's found in each cached list -- syncs Event Detail's toggle into whichever list the user came from.
- [x] Add/update tests in `EventDetailWrapper.test.tsx`: calendar-mutation failure shows an error message and the dialog doesn't spuriously close; favorite toggle from detail updates a pre-seeded `["events","feed"]`/`["events"]`/`["favoriteEvents"]` cache entry for the same event id.

**Acceptance Criteria:**
- Given a user confirms Add to Calendar and the mutation succeeds, when the response resolves, then the dialog closes and the calendar state reflects the change.
- Given a user confirms Add to Calendar and the mutation fails, when the error is caught, then the user sees a visible error message and the dialog does not silently close on a false-success basis.
- Given a user toggles favorite from Event Detail opened from the feed, home, or favorites list, when the mutation succeeds, then that originating list's cached favorite state/count updates without a manual page refresh.

## Design Notes

**Add to Calendar root cause (verified via investigation, not guessed):** wiring, mutation args, GraphQL schema, ICS route, and the soft-delete legacy-exception carve-out (AD-8 rule 4, confirmed intentional in `festgrid-architecture-spine.md:159`) are all correct — the bug is purely missing await + missing user feedback on failure, not a data/logic defect.

**Favorite-sync root cause (verified, NOT the `{}` vs `undefined` cache-key-fork bug fixed in the prior batch):** the list and detail queries use structurally unrelated query keys (`["getEventBySlug", {slug}]` vs `["events","feed",{...}]` / `["events",{...}]` / `["favoriteEvents",{...}]`) — this is four independently hand-rolled optimistic-cache patches that were never designed to reach each other, not a serialization mismatch.

## Spec Change Log

- 2026-08-31: Dispatched implementation to `cline-cli` (`--worktree`, isolated worktree under `~/.cline/worktrees/`). Independent verification before merge (per standing project practice) found two problems with cline's own result, so its commits were NOT merged directly — instead the underlying diff was reviewed, corrected, and reapplied by hand onto the working tree: (1) the worktree's base commit was stale (missing an unrelated docs-only commit) and the spec file itself was absent from the worktree (only created after the fact by cline, working from the task prompt's inlined detail instead), so its self-report of "implemented the spec" could not be trusted at face value; (2) cline's new `EventDetailWrapper.test.tsx` "patches list caches" test was spliced *inside* the body of a pre-existing test (an invalid nested `it()` call) rather than added as a sibling test -- almost certainly why its own `tsc`/test verification commands exited non-zero even as it reported success. Re-derived both new tests as proper sibling `it()` blocks and reran independently: 25/25 pass in `EventDetailWrapper.test.tsx`, plus 1 pre-existing `EventDetailView.test.tsx` test updated to `await`/`waitFor` the now-legitimately-async dialog close (28/28 pass there).
- 2026-08-31: Extended the favorite-cache-sync fix beyond the original task wording -- the `toggleFavorite` mutation only returns `eventId`/`isFavorited` (no `favoriteCount`), so a literal "patch isFavorited" would leave list-view favorite counts stale after a detail-view toggle. Added a client-side `±1` (floored at 0) adjustment to each patched list item's `favoriteCount` alongside `isFavorited`, keeping the acceptance criterion's "state/count updates" claim actually true rather than only half-true.
- 2026-08-31: `pnpm test` (full suite) surfaced one pre-existing, unrelated failure -- `EventCard.test.tsx`'s masonry "Today WITH a startTime" badge test (from the prior `ux-rework2` batch), which reproduces identically on `master` with this spec's changes fully stashed out. Logged in `deferred-work.md`, not fixed here (out of this spec's scope per its own Boundaries).
- 2026-08-31: Ran Blind Hunter + Edge Case Hunter adversarial review (via `cline-cli`, `gemini-3.1-pro-preview`) against this diff, then independently verified every finding against the actual code before acting (most of Blind Hunter's claims did not match the real diff and were rejected as hallucinated -- e.g. "missing favoriteCount adjustment" when it was present, a claimed variable name that doesn't exist in the code). Two **patch** findings, confirmed real and fixed directly:
  - `queryClient.setQueriesData({ queryKey: ["events"] })` matches by key PREFIX (no `exact: true`), so it already reached `["events","feed",...]` too; the separate, redundant `patchListCache(["events","feed"])` call was double-applying the `favoriteCount` delta to the feed cache. Removed the redundant call; `["events"]` alone now covers both home and feed. Added a regression test seeding `favoriteCount: 5` in all three caches and asserting exactly `6` (not `7`) everywhere, including the feed cache specifically.
  - `AddToCalendarDialog`'s Escape-key and outside-pointerdown handlers called `onClose()` unconditionally, bypassing the `isSubmitting` guard `handleConfirm`'s buttons already respected -- a user could Escape/click-away mid-mutation and the dialog would close before the app knew success/failure, defeating this spec's own "does not close on a false-success basis" acceptance criterion via a second, unguarded path. Both handlers now check `isSubmitting` first. Added a test simulating an in-flight confirm and asserting both Escape and an outside click are no-ops until the promise resolves.
  - Both reviewers also flagged the missing `favoriteCount` assertion in the original "patches list caches" test as a **patch** -- folded into the regression test above.
  Three additional findings were real but pre-existing/out-of-scope (**defer**, logged in `deferred-work.md`): `handleAddToCalendar`'s `Promise.all` has no partial-failure recovery for multi-schedule selections; the new `favoriteCount` delta doesn't guard against a concurrent-refetch race (matches the pre-existing per-page mutation instances' same unconditional-delta shape); and `data.toggleFavorite`/`data.toggleCalendarAddition` are read without a null-check in `onSuccess` (pre-existing, predates this batch's diff).

## Verification

**Commands:**
- `pnpm --filter web exec tsc --noEmit` -- web app type-checks after all frontend changes. PASS (only pre-existing, unrelated errors remain elsewhere, confirmed via stash comparison against master).
- `pnpm --filter web test EventDetailWrapper` -- PASS, 25/25 (2 new cases).
- `pnpm --filter @festgrid/ui test EventDetailView` -- PASS, 29/29 (2 tests added/updated for the now-async, guard-respecting dialog close).
- `pnpm test` -- full project test suite: 346/347 PASS. The 1 failure (`EventCard.test.tsx`, masonry badge suite) is pre-existing and unrelated, confirmed reproducing on `master` with this spec's changes stashed out; logged in `deferred-work.md`.

## Suggested Review Order

**Add to Calendar: silent failure on error**

- Entry point -- dialog now awaits confirm before closing, and both the Escape key and an outside click are ignored while a mutation is in flight (a review finding -- these bypassed the button-level guard).
  [`EventDetailView.tsx:571`](../../packages/ui/src/features/events/EventDetailView.tsx#L571)
  [`EventDetailView.tsx:508`](../../packages/ui/src/features/events/EventDetailView.tsx#L508)
  [`EventDetailView.tsx:543`](../../packages/ui/src/features/events/EventDetailView.tsx#L543)

- Failure now surfaces a live-region/toast message instead of only logging to the console; the caller re-throws so the dialog above knows to stay open.
  [`EventDetailWrapper.tsx:174`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L174)
  [`EventDetailWrapper.tsx:421`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L421)

**Favorite toggle: cross-view cache sync**

- Patches whichever list (home/feed/favorites) the event appears in, syncing `isFavorited` and adjusting `favoriteCount` by the confirmed transition direction.
  [`EventDetailWrapper.tsx:109`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L109)

- A single `["events"]` prefix-match call covers both home and feed -- a review finding caught a redundant second call double-counting the feed cache specifically.
  [`EventDetailWrapper.tsx:141`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L141)

**Peripherals**

- New/updated test coverage for both fixes, including a regression case for the double-count bug and the in-flight Escape/outside-click guard.
  [`EventDetailWrapper.test.tsx:329`](../../apps/web/src/features/events/EventDetailWrapper.test.tsx#L329)
  [`EventDetailView.test.tsx:298`](../../packages/ui/src/features/events/EventDetailView.test.tsx#L298)

- New `calendarErrorAnnouncement` i18n key (en/id) backing the new error announcement.
  [`en.json`](../../apps/web/locales/en.json)
  [`id.json`](../../apps/web/locales/id.json)

