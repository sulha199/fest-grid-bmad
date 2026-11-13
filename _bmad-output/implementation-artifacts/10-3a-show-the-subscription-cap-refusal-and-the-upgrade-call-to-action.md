---
baseline_commit: 42d7f27d7aa3b7e0cf0a3255a32b2c35f2e1441d
---
# Story 10.3a: Show the subscription cap refusal and the upgrade call to action

## Story Details

- Epic: 10 (Background vendor jobs: one engine, one Jobs page)
- Story ID: 10.3a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user who tried to follow another account while at my limit,
I want to be told how many accounts I have added, how many are being added and what the limit is, and to see an Upgrade button marked "coming soon",
so that I understand why it did not work and what will change later.

## Acceptance Criteria

1. **Given** a subscribe or a restore that the server refuses with `SUBSCRIPTION_CAP_REACHED` (`extensions { activeCount, reservedCount, cap }`, built in Story 10.3, reuse and admission control to job start), **when** the web app shows the result, **then** it says in plain words how many accounts are added (`activeCount`), how many are being added (`reservedCount`) and the limit (`cap`), in a `SubscriptionCapNotice`, instead of the generic error toast, and the blocked action stays blocked (PRD Section 6, Reserved Slots Count and Upgrade CTA). The notice appears only after the server refuses; there is no pre-check query (UX decision 6).
2. **And** the refusal is handled at every entry point that can raise it today, through one hook and one error reader, never a per-screen copy: (a) the Subscribe dialog in Account Settings (inline: the notice replaces the Subscribe button, the handle field stays editable, Close stays); (b) the onboarding wizard's subscribe step (inline below the form, the add action replaced by the notice, the wizard's Continue and Skip untouched, FR127); (c) the subscribe toggle on the event page, for the source account and for each coauthor (`EventDetailWrapper`, a small dialog, the toggle stays "not subscribed"); (d) the Undo of a removed subscription in the Subscriptions list and in Post Selection (`RESTORE`: a small dialog plus the short `restoreFailedToast`, the row stays removed); (e) the Retry of a Subscribe job, in the Retry notice of both the progress dialog and the job detail page (inline, under the failed box), which are the cap-notice slots Story 10.4 left (its `renderCapNotice` and `notice` slots).
3. **And** the notice carries an `UpgradeCta`: a real, focusable button labelled "Upgrade" with a "Coming soon" badge and the note "Paid plans with a higher limit are not available yet." (no paid tier exists). Tapping it changes the note to "Thanks for your interest. Paid plans are not available yet." (polite live region), purchases nothing and leaves the button focusable. `UpgradeCta` is a small reusable, props-driven primitive in `packages/ui/src/core/` with no `next-intl` import and no knowledge of the cap (Gate 2 answer: yes, UX decision 5, owner-confirmed 2026-11-13).
4. **And** showing the button fires `subscription_cap_upgrade_cta_shown` once per refusal (not per re-render) and each click fires `subscription_cap_upgrade_cta_clicked`, both through `@festgrid/analytics` (`capturePostHogEvent`), snake_case, with the PRD's `currentSubscriptionCount` (= `activeCount`) and `accountId` plus `reservedCount`, `cap` and `surface` (UX decision 7). `accountId` is sent only when known and never a handle, a name or a URL; a network error or any other refusal fires nothing.
5. **And** all copy exists in English and Indonesian under the `SubscriptionCap` next-intl namespace with the keys of `copy-keys.md` section 2 (`title`, `body`, `hint`, `blockedNote`, `upgradeButton`, `comingSoonBadge`, `comingSoonNote`, `afterClickNote`, `manageLink`, `dialogTitle`, `closeButton`, `restoreFailedToast`, `announce`); the numbers come from the error and are formatted by next-intl with the active locale; the reason text comes from the code, never from the server's English message.
6. **And** accessibility holds: the inline notice is a `role="status"` region that moves focus to its title (`tabIndex={-1}`) on mount and is read once; the dialog form is a plain dialog with the same title (not an alert dialog); the Upgrade button is a normal `button` (not `disabled`, not `aria-disabled`) with `aria-describedby` on the "Coming soon" note; the badge is text; touch targets are at least `min-h-11`; nothing relies on colour alone (amber, not red: a limit is information).
7. **And** responsive containment holds at 320 to 1440 px: the notice wraps, the Upgrade button is full width below `sm:`, the dialog is the bounded `DialogContent` (a long Indonesian sentence and the longest handle must not stretch it); a new scenario joins `responsive-popups.spec.ts` and the cap notice is part of the overflow matrix where its page can be reached.
8. **And** a moderator is exempt on the server (Story 10.3), so no moderator path is changed here, and a votes action is never blocked: no vote, vote-suggestion or account-vote code calls the cap handling and a source-scan test pins both facts. Any error that is not `SUBSCRIPTION_CAP_REACHED` keeps today's behaviour (the generic or capacity toast) and fires no cap event.
9. **And** Story 10.4's placeholders are filled and their tests updated: a Retry refused with the cap shows the real notice (inline) in the progress dialog and on the detail page, replacing the "generic message while the slot is empty" fallback.

## Tasks / Subtasks

- [ ] **Task 1: `UpgradeCta` primitive in `packages/ui/src/core/`** (AC: 3, 4, 6, 7)
  - [ ] Add `upgrade-cta.tsx` and `upgrade-cta.types.ts` (+ test). Props: `label`, `comingSoonLabel`, `note`, `afterClickNote`, `onShown?`, `onClick?`, `className?` (plain strings, no `labels` object, no `next-intl`, no analytics import). Renders a `Button` (existing `core/ui/button`) with `min-h-11`, full width below `sm:`, the badge as text, the note in a `<p id={useId()}>` that is also the button's `aria-describedby` and a polite live region; one internal `clicked` flag swaps `note` for `afterClickNote`; the button never becomes disabled.
  - [ ] `onShown` fires once on first mount (a ref guard, so React StrictMode's double effect fires it once); `onClick` fires on every click. Use the amber/violet tokens of `DESIGN.md` (`upgrade_cta`); no raw `z-*` class (AD-33), no new tier.
  - [ ] Export from `packages/ui/src/index.ts`. Tests: shows label, badge and note; click swaps the note and keeps the button focusable and enabled; `aria-describedby` points at the note; `onShown` once across re-renders and under StrictMode; `onClick` on every click; no `disabled` and no `aria-disabled` attribute ever.
- [ ] **Task 2: `SubscriptionCapNotice` in `packages/ui/src/features/subscriptions/`** (AC: 1, 3, 5, 6, 7)
  - [ ] Add `SubscriptionCapNotice.tsx` + `.types.ts` + test, exported from the folder barrel. Props: `refusal { activeCount, reservedCount, cap }`, a `labels` object of plain strings (`title`, `body`, `hint`, `blockedNote`, `upgradeButton`, `comingSoonBadge`, `comingSoonNote`, `afterClickNote`, `manageLink`), `variant: 'inline' | 'dialog'`, optional `blockedNote` visibility flag, optional `manageHref` (the link renders only when given, the app builds it), `onUpgradeShown`, `onUpgradeClick`. The app resolves the `body` sentence (plural, numbers) with next-intl and passes it as a string; the component never imports `next-intl`.
  - [ ] Inline variant: `role="status"`, focuses its title on mount (`tabIndex={-1}`), the visually hidden `announce` text is the one thing read; dialog variant: no `role="status"` (the dialog announces its title), no auto-focus of its own. Amber `job_notice.limits`-style box (`DESIGN.md` `subscription_cap_notice`), `min-w-0`, long text wraps.
  - [ ] Tests: counts and plural variants (`reservedCount` 0, 1, 2; above the cap 7 of 5; Indonesian), focus and role per variant, the Upgrade child wired, no `next-intl` import (a scan, like the Story 10.4 ui components).
- [ ] **Task 3: One error reader and one hook in `apps/web/src/features/subscriptions/`** (AC: 1, 2, 4, 8)
  - [ ] `subscription-cap-error.ts`: `readSubscriptionCapRefusal(err): { activeCount, reservedCount, cap } | null`, built on the existing `mapJobStartError` (Story 10.4; accepts a thrown `ClientError` or a start result), so there is one reader and `JOB_QUEUE_FULL`, cooldown and generic answers stay with that helper. A refusal needs a numeric `cap`; missing counts read as 0. No new parser. Test: thrown `ClientError`, start result, missing numbers, other codes, a network error, `SCRAPER_CAPACITY_EXCEEDED` (must return null).
  - [ ] `use-subscription-cap-refusal.ts`: `{ refusal, surface, accountId, show(err, ctx) -> boolean, clear() }` plus an id that increments per refusal (so "shown once per refusal" re-mounts the notice). `show` returns `true` when the error was a cap refusal (the caller then skips its generic toast) and `false` otherwise. Test with a fake mutation error.
  - [ ] `subscription-cap-analytics.ts` (pattern of `features/jobs/job-analytics.ts`): `trackSubscriptionCapUpgradeShown` and `trackSubscriptionCapUpgradeClicked` over `capturePostHogEvent`; properties `currentSubscriptionCount`, `reservedCount`, `cap`, `surface` and `accountId` only when defined. `surface` is one of `subscribe_dialog`, `onboarding_wizard`, `event_detail_source`, `event_detail_coauthor`, `restore`, `job_retry` (a string union exported for the callers). Test: exact payloads, `accountId` omitted when unknown, no handle or name ever.
  - [ ] `SubscriptionCapNoticeConnected.tsx` (apps/web): resolves the `SubscriptionCap` namespace with `useTranslations` and `next-intl` plural, builds `labels`, wires the two analytics callbacks and `manageHref` (`/settings/account`, through the app `Link`, only where the screen is not already that page). `SubscriptionCapDialog.tsx`: the apps/web `Dialog` (`@/components/ui/dialog`, `OVERLAY_MODAL_Z` through it, bounded) with `dialogTitle`, the notice (`variant="dialog"`) and a `closeButton`; opens when `refusal` is set, `onOpenAutoFocus` puts focus on the title, closing calls `clear()`.
- [ ] **Task 4: Wire the entry points** (AC: 1, 2, 8)
  - [ ] Read each file in full first (see What exists today). `subscribe-account-dialog.tsx`: in the `catch`, `show(err, ...)` first; when it returns true skip the toast, keep the handle field, and render the inline notice (with `blockedNote`) in place of the Subscribe submit button while `refusal` stands; `onClose` clears it; the `SCRAPER_CAPACITY_EXCEEDED` and generic toasts stay for every other error. `accountId` is omitted here when the user typed a handle, and sent when they picked a voted-account suggestion (its profile's platform account id).
  - [ ] `onboarding-subscribe-step.tsx`: same, inline below the form with the add button replaced by the notice; never calls `setStepCompleted` on a refusal; no `manageLink` (the wizard must not push the user away); `surface: onboarding_wizard`.
  - [ ] `EventDetailWrapper.tsx`: in `onError` of the source-account and the coauthor subscribe mutations, `show(err, { surface, accountId })` (the profile's or coauthor's `accountId`) and open `SubscriptionCapDialog`; keep the existing live message and the sanitized `subscription_toggle_failed` event (its `errorCode` will read `SUBSCRIPTION_CAP_REACHED`, unchanged), but swap the generic `subscribeErrorAnnouncement` for the notice's own announcement when it is a cap refusal. The unsubscribe mutations are untouched. Nothing optimistic exists to roll back (confirm-then-refetch, Story 0.i6g).
  - [ ] Restore: in `subscriptions-content.tsx` and `posts-select-content.tsx`, the Undo callback catches a cap refusal, calls `show(err, { surface: 'restore', accountId })`, shows the short `restoreFailedToast` (with `cap`) and opens `SubscriptionCapDialog`, then rethrows so `useSoftDeleteWithUndo` keeps the row removed; any other error behaves as today. Verify in the test that the row stays removed and the list is not refetched as restored.
  - [ ] Fill the Story 10.4 slots: `JobRetryFailureNotice` renders `SubscriptionCapNoticeConnected` (`variant="inline"`, `surface: job_retry`, `accountId` from the job's subject when it has one) for `kind: 'cap'` by default; keep the `renderCapNotice` prop only as an override seam. `JobProgressHost` and the job detail page need no other change (the detail page's `notice` slot already renders `JobRetryFailureNotice`). Update the two Story 10.4 tests that pinned the generic fallback (`job-progress-host.test.tsx` around the cap case and `job-detail-content.test.tsx` around the `SUBSCRIPTION_CAP_REACHED` result) to assert the real notice.
- [ ] **Task 5: Copy** (AC: 5)
  - [ ] Add the `SubscriptionCap` namespace to `apps/web/locales/en.json` and `id.json` exactly as `copy-keys.md` section 2 gives it (plural forms included). `locales.test.ts` already checks parity; extend it with: the namespace exists in both, every key of the list, `body` renders for 0, 1 and 2 reserved in both languages, and no `[OPEN` text. Keep `body` and `announce` as the only keys with placeholders.
- [ ] **Task 6: Tests** (AC: 1 to 9; project Definition of Done)
  - [ ] Component and hook tests (Vitest, msw or a faked mutation as the neighbours do): per entry point a test that a refusal shows the notice with the right numbers and no generic toast, that the blocked action stays blocked, that a non-cap error behaves as before, and that analytics fire once on show and on each click with the exact properties. Unhappy path: network error (no notice, no event); a refusal whose extensions lack `cap` (generic); a refusal while the dialog is already open (updates in place, still one shown event per refusal).
  - [ ] `subscription-cap-entry-points.ratchet.test.ts` (source scan, `apps/web/src`): every non-test file that uses `useSubscribeToAccountMutation` or the `RESTORE` action imports `readSubscriptionCapRefusal` or `useSubscriptionCapRefusal` (a reasoned allowlist that can only shrink); the votes route and every account-vote hook/file never import them (votes are never blocked). Say in the test header that the moderator exemption is server-side and proven by Story 10.3's real-Postgres tests.
- [ ] **Task 7: Playwright** (AC: 7, 8)
  - [ ] `apps/web/e2e/subscription-cap.spec.ts`, signed in with `E2E_FAKE_AUTH=1` on the local stack. A real refusal needs a fifth real subscribe, which would start the classify-then-scrape cascade (a vendor call), and that is forbidden here; so the spec answers the `SubscribeToAccount` GraphQL operation with the typed refusal through `page.route` and never lets the request reach the server (the server side of the refusal, including the moderator exemption, is Story 10.3's real-Postgres suite). Scenarios: (1) Account Settings, open the Subscribe dialog, submit, the inline notice shows "You have 4 accounts added and 1 more being added. The limit is 5." (exact text) with the Upgrade button, "Coming soon" and the note, the Subscribe button is gone and the handle field and Close remain; (2) tap Upgrade, the note changes and the button stays enabled and focusable; (3) the same in Indonesian (`/id/...`); (4) Close and reopen: the notice is gone; (5) a routed non-cap error still shows the generic toast and no notice; (6) the votes page loads and its vote action sends no cap handling (no cap notice can appear: nothing to route, the check is that the page has no Upgrade button after a routed refusal of a subscribe on another page).
  - [ ] `responsive-popups.spec.ts`: a scenario that opens the Subscribe dialog, routes the refusal, and asserts the opened dialog fits the viewport, scrolls inside itself and has no `scrollWidth > clientWidth`, at 320 px with an Indonesian locale; and a second for the event page's small cap dialog (both the modal route and the direct page, per the project rule). `responsive-overflow.spec.ts`: the Settings account page with the dialog open and refused, at every width; add the wizard subscribe step if its route is reachable under fake auth, otherwise cover its 320 px layout with a component test using the longest Indonesian body.
- [ ] **Task 8: Documentation pointers** (AC: 1, 4)
  - [ ] PRD Section 6 "Upgrade CTA & Analytics": add one sentence that the two events also carry `reservedCount`, `cap` and `surface`, and that `accountId` is sent only when known (owner-confirmed UX decision 7). One pointer sentence in `project-context.md` (UI Patterns): a subscribe or restore refused with `SUBSCRIPTION_CAP_REACHED` is shown by `SubscriptionCapNotice` through `useSubscriptionCapRefusal`, never a generic toast, and the Upgrade button is the core `UpgradeCta`. `copy-keys.md` already holds the copy (fold in any wording change made while building). `docs/infrastructure/*` is untouched: no service, queue, Lambda, table, scraper, database, host or library is added.
  - [ ] Dev Agent Record: list the entry points actually found, the `surface` values used, and the sprint status move.

## Dev Notes

### Owner-flagged decisions (conservative option chosen; please confirm or overrule)

1. **`UpgradeCta` is its own `packages/ui/src/core` primitive** (the story's Gate 2 answer is yes; UX decision 5, already confirmed on 2026-11-13). Its strings are plain props; the UX spec's separate `labels` prop is dropped because the strings are the labels.
2. **`onShown` fires on mount, not on scroll-into-view.** The notice is rendered only for a refusal and sits where the user is looking, so "first appears" is "first mounts"; an intersection observer would add code for no real difference. A refusal while the notice is already open updates it and fires one more `shown` (a new refusal is a new showing).
3. **Account page has no subscribe toggle today.** The UX spec names the "account page (`SubscribedAccountCard` toggle)", but `[platformSlug]/[username]` does not subscribe: the card toggles live on the event page (source account and coauthors, `EventDetailWrapper`). The small dialog is wired there; the account page is untouched. If the owner wants a toggle on the account page, that is a new feature, not this story.
4. **Both Undo (restore) places are covered**, the Subscriptions list and Post Selection (`posts-select-content.tsx`); the UX spec names only "the Undo toast".
5. **One reader: `mapJobStartError` is reused** (kept in `features/jobs`), wrapped by `readSubscriptionCapRefusal`, instead of moving or duplicating it. The start-error helper stays the single place that knows the shapes of a refusal.
6. **`JobRetryFailureNotice` renders the real notice by default** and `renderCapNotice` stays only as an override seam, so the progress dialog and the detail page are both filled by one change and a host cannot forget to pass it. The Story 10.4 "slot empty shows the generic message" behaviour is retired.
7. **`accountId` in the two events is the platform account id** (the `accountId` the subscribe mutation takes; PRD Section 6 says `accountId`), sent only when the screen has it: voted-suggestion pick, event page source account and coauthor, the Undo's subscription, a Subscribe job's subject. It is never sent for a typed handle. It is a public account's id, never a handle, name or URL. If the owner prefers the internal profile id, it is a one-line change per caller.
8. **No client-side role check.** The server exempts a moderator, so a cap refusal never reaches one; the UX spec says "if it ever arrived, fall back to the generic error", but a client branch on role would be dead code that can only hide a server bug. The notice shows whoever receives the typed code.
9. **The inline refusal stands until the dialog closes (or the screen is left).** The notice is not live-updated and no count is fetched (UX decision 6); a user who removes an account elsewhere taps Subscribe again after reopening. In the wizard it stands until the user changes screen. `manageLink` shows only in the small dialogs and the Retry notice (not in the Settings dialog, which already sits on that page, and not in the wizard, which must not push the user away, FR127).
10. **A routed GraphQL answer stands in for a real fifth subscribe in e2e**, because a real one starts the classify-then-scrape cascade (a vendor call). The server side stays covered by Story 10.3's real-Postgres suite. This means e2e does not prove the server-to-screen shape end to end; the component tests with the exact `extensions` shape and a ratchet on the backend error's field names carry that.
11. **The extra event properties `reservedCount`, `cap`, `surface`** are additive (UX decision 7); if the owner wants only the PRD's two, drop three keys in `subscription-cap-analytics.ts`.
12. **Indonesian "Upgrade" is "Tingkatkan"** (as `copy-keys.md` has it); the English word is not kept inside the Indonesian sentence.

### Architecture & UX Gate Findings

- Epic 10's readiness report is swept (`epic-10-readiness.md`, 2026-11-01, and its 2026-11-11 update for this story), so Gate 1 and Gate 3 were not re-run; the update records for 10.3a: no new prerequisite. Lightweight guard: this story adds no service, queue, Lambda, table, scraper, library or GraphQL operation (the refusal already travels in `extensions` and in `RetryJobResult`); the shared foundations it needs (next-intl, `@festgrid/analytics`, `apps/web` Dialog, `PageContainer`, the Story 10.4 start-error helper and Retry notice) all exist. No gap found.
- Gate 2 (UI complexity and reusability): answered yes in the UX spec (`EXPERIENCE.md`, "Upgrade call to action: Gate 2") and owner-confirmed in `decisions.md` choice 5: `UpgradeCta` is a core primitive composed by `SubscriptionCapNotice`; the notice, the hook and the dialog are small and share one error reader, so no further split. No gap found.
- **Split recommendation: none.** The story is ten small files of UI and wiring over a backend that is done.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: the GraphQL error `extensions { code: 'SUBSCRIPTION_CAP_REACHED', activeCount, reservedCount, cap }` (numbers; Story 10.3) and `RetryJobResult { errorCode, activeCount, reservedCount, cap }` (nullable `Int`, Story 10.4); the `JobStartErrorCode` enum already has `SUBSCRIPTION_CAP_REACHED`.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: new local types only (`SubscriptionCapRefusal`, the `surface` union, the analytics payloads); no generated-type or schema change, no codegen run.
- Backward compatibility and rollout notes: a refusal missing `cap` reads as a generic error (nullable `Int` in `RetryJobResult`); no flag needed; the cap is already enforced on the server, so this story only changes what the user sees. Open decision for the owner (UX open decision 5): how many production users already hold more than 5 (check before deploying); the notice then shows real numbers ("7 accounts added, limit 5") and removes nothing.
- Verification checks: tests feed the exact `extensions` shape built from the backend error's field names; the Story 10.3 resolver test already pins them on the server.

### What exists today (read these first, files marked UPDATE)

- **UPDATE `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx`**: a controlled dialog; `handleSubmit` awaits `subscribeToAccount`; the `catch` reads `ClientError` and special-cases only `SCRAPER_CAPACITY_EXCEEDED` (a hard-coded English toast), else the generic `subscribeErrorToast`. Preserve: the voted-suggestion picker, the `BlockingLoader`, `subscription_added`, query invalidation, the `alreadySubscribed` info toast. Change: the cap branch, the inline notice in place of the submit button.
- **UPDATE `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`**: same shape inside the wizard (`useWizardStep().setStepCompleted`). Preserve: the existing-subscriptions list, `wizard_subscribe_step_completed`, never trapping the user.
- **UPDATE `apps/web/src/features/events/EventDetailWrapper.tsx`**: four mutations (source subscribe/unsubscribe, coauthor subscribe/unsubscribe), confirm-then-refetch (project-context scoped exception, FIND-022), `getSanitizedSubscriptionErrorCode` for `subscription_toggle_failed`, a live region (`setLiveMessage`). Preserve all of it; add only the cap branch to the two subscribe `onError`s. `SubscribedAccountCard` (`packages/ui`) stays untouched: it only calls `onSubscribe` and is disabled while pending.
- **UPDATE `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx`** and **`posts/select/posts-select-content.tsx`**: `useSoftDeleteWithUndo.markPending(id, undoFn)`; the undo callback calls `removeSubscription({ action: RESTORE })`, logs and rethrows on error; the hook swallows the rethrow after logging and leaves the toast to expire. The cap branch goes inside the callback (the hook is in `packages/ui` and stays generic).
- **UPDATE `apps/web/src/features/jobs/job-retry-failure-notice.tsx`** (its `renderCapNotice` slot) and its two consumers (`job-progress-host.tsx`, `jobs/[jobId]/job-detail-content.tsx`); **`apps/web/src/features/jobs/job-start-error.ts`** is reused unchanged.
- Backend, read-only here: `SubscriptionCapReachedError { activeCount, reservedCount, cap }` raised in `subscribeToAccount` and the RESTORE path, mapped to `GraphQLError` code `SUBSCRIPTION_CAP_REACHED` (Story 10.3, AC 7 and 8). The web client sees it as a `ClientError` whose `response.errors[0].extensions` carries the code (HTTP 200); `graphql-client.ts` only reacts to `UNAUTHENTICATED`.

### Guardrails (project rules this story must obey)

- **No `next-intl` in `packages/ui`**; strings in as props (Story 10.4 pattern). Copy in en and id; numbers formatted by the active locale; plural by ICU in the message.
- **One start-refusal reader** (`mapJobStartError`); do not write a second `extensions` parser. Reason text from the code, never the server's `message`.
- **Analytics only through `@festgrid/analytics`**, snake_case names, camelCase properties; no handle, name, URL, caption or vendor.
- **Overlays:** `DialogContent` already caps height and keeps `grid-cols-[minmax(0,1fr)]`; no raw `z-40/50` (AD-33), no new overlay primitive; floating elements are not used (design).
- **No pre-check query and no new endpoint.** No backend, schema, migration or infrastructure change. No `docs/infrastructure` change.
- **Votes are never blocked and a moderator is exempt** (PRD Section 6): the story adds no cap code to vote paths.
- **Skeletons** and layout: the notice has no loading state; nothing here is async.
- Read before coding: `_bmad-output/project-context.md`, the PRD (Sections 3.7, 3.18, 6), `ux-designs/ux-festgrid-2026-11-13/{EXPERIENCE,DESIGN,copy-keys,decisions}.md` (the Story 10.3a section of EXPERIENCE.md, `subscription_cap_notice` and `upgrade_cta` in DESIGN.md).

### Previous story intelligence

- **Story 10.3 (admission, subscription cap)**: the refusal is raised before any scrape (no vendor credit spent); counts are active subscriptions plus reserved slots (non-terminal jobs of a type that reserves one); a user above the cap keeps all subscriptions; re-subscribing to a held account uses no slot (so it never reaches this UI); the moderator is exempt.
- **Story 10.4 (Jobs page, inline progress)**: `mapJobStartError` and `JobRetryFailureNotice` exist; both left cap slots; the progress host and the detail page do not need new props; its tests pin the generic fallback and must change here; `locales.test.ts` asserts namespace parity; ui job components take a `labels` object and never import next-intl; analytics live in a small `job-analytics.ts`; e2e rule: no vendor call, never click anything that starts a real job; the Playwright run used `E2E_FAKE_AUTH=1` with the seeded users (the ordinary user holds four subscriptions, so a real fifth would not be refused and would start a scrape).
- The Subscribe job itself (Story 10.7, move subscribe and profile lookup onto the engine) is later: when it lands, its start result carries the same typed refusal and goes through `readSubscriptionCapRefusal` already; this story does not build the job.

### Project Structure Notes

- New: `packages/ui/src/core/upgrade-cta.tsx(+types,+test)`; `packages/ui/src/features/subscriptions/SubscriptionCapNotice.tsx(+types,+test)`; `apps/web/src/features/subscriptions/{subscription-cap-error,use-subscription-cap-refusal,subscription-cap-analytics}.ts`, `{SubscriptionCapNoticeConnected,SubscriptionCapDialog}.tsx` and their tests, `subscription-cap-entry-points.ratchet.test.ts`; `apps/web/e2e/subscription-cap.spec.ts`.
- Modified: the entry-point files above, `job-retry-failure-notice.tsx` and its two tests, `packages/ui/src/index.ts` and the subscriptions barrel, `apps/web/locales/{en,id}.json` and `locales.test.ts`, `responsive-popups.spec.ts`, `responsive-overflow.spec.ts`, the PRD (one sentence), `project-context.md` (one sentence), `sprint-status.yaml`.
- Not modified: any backend file, schema, migration, `packages/domain` (no business logic: the rule is already `evaluateSubscriptionCap` on the server), `packages/database`, `apps/infrastructure`, `docs/infrastructure/*`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 10.3a`]
- [Source: PRD Section 6 "Reserved Slots Count", "Moderator Exemption", "Upgrade CTA & Analytics"; Section 3.7 (Subscribe Runs as a Job); Section 3.18 FR122, FR123]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-festgrid-2026-11-13/EXPERIENCE.md#Story 10.3a`, `DESIGN.md` (`subscription_cap_notice`, `upgrade_cta`), `copy-keys.md` section 2, `decisions.md` choices 5, 6, 7 and open decision 4, 5]
- [Source: `_bmad-output/implementation-artifacts/10-3-add-reuse-and-admission-control-to-job-start.md` AC 7 and 8; `10-4-build-the-jobs-page-and-the-inline-job-progress-component.md` AC 13, decision 15 and the Dev Agent Record slots]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-10-readiness.md`, update 2026-11-11]
- [Source: `_bmad-output/project-context.md` (Responsive Containment, Layering, Locale rules, UI package rules)]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs (read only to confirm nothing changes; `docs/infrastructure/*` is not touched)

## Implementation Plan (Rule-Compliant)

- File Change Plan: see Project Structure Notes. Order: Task 1 and 2 (ui, no app dependency), Task 3 (reader, hook, analytics, connected notice and dialog), Task 5 (copy), Task 4 (wire each entry point, Retry slot last), Task 6, Task 7, Task 8.
- Rule Mapping: reusable UI in `packages/ui` core/features with no `next-intl` (UI Components rule, Story 10.4 pattern) -> Tasks 1, 2; i18n en and id, locale-formatted numbers -> Task 5; one error reader and `@festgrid/analytics` -> Task 3; `Dialog` and responsive containment -> Tasks 3, 7; Definition of Done for testing (happy path e2e, unhappy-path integration test) -> Tasks 6, 7; no domain logic added, so no `packages/domain` coverage change.
- Verification Plan: `pnpm --filter @festgrid/ui test` and lint (`--max-warnings 0`), `pnpm --filter web test` (includes `locales.test.ts` and the new ratchet), `tsc --noEmit` on touched files, `pnpm --filter web build`, and Playwright with `E2E_FAKE_AUTH=1` on a local stack for the new spec and the two responsive specs (no vendor call, no Lambda).

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Integration tests: component and hook tests for `UpgradeCta`, `SubscriptionCapNotice`, the reader, the hook, analytics payloads, each entry point (refusal shown with numbers, action stays blocked, non-cap error unchanged, network error shows no notice and no event), the Retry notice in the dialog and on the detail page, locale parity; the entry-point source-scan ratchet (votes never import the cap handling)
- [ ] E2E tests: `subscription-cap.spec.ts` (routed typed refusal, English and Indonesian, Upgrade click, reopen clears, non-cap error unchanged), a scenario in `responsive-popups.spec.ts` (dialog fits at 320 px, no inner overflow) and the overflow matrix entry; no vendor call, no Lambda

## Deliverables Checklist

- [ ] `UpgradeCta` core primitive and `SubscriptionCapNotice` in `packages/ui`
- [ ] Error reader, hook, analytics and connected notice and dialog in `apps/web/src/features/subscriptions/`
- [ ] All entry points wired (Subscribe dialog, wizard step, event page source and coauthor, two restores, Retry notice in dialog and detail page)
- [ ] `SubscriptionCap` copy in English and Indonesian with parity tests
- [ ] The two events with the agreed properties
- [ ] e2e, responsive scenarios, ratchet, PRD sentence and project-context pointer

## Out of Scope

- A live count query or any pre-check (`mySubscriptionCapStatus`, UX decision 6, optional later enhancement); a notice that updates when the user makes room.
- What the Upgrade button leads to once a paid plan exists and a purchase flow (UX open decision 4); a tier model; changing the cap, who it applies to, or any server behaviour.
- The Subscribe job and its progress view (Story 10.7, move subscribe and profile lookup onto the engine); a subscribe toggle on the account page.
- Moderator-specific UI (a moderator is exempt) and any vote path change (votes never blocked).
- `docs/infrastructure/*` (no service, queue, Lambda, table or library is added).

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Not yet implemented.

### Debug Log References

### Completion Notes List

### File List
