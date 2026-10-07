# Story 3.19: Sanitized subscription-toggle analytics

## Story Details

- Epic: 3
- Story ID: 3.19
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want Story 0.i6g's subscribe/unsubscribe toggle to emit PostHog `subscription_toggle_succeeded`/`subscription_toggle_failed` events carrying only `action`, `platform`, `source`, and (on failure) a sanitized backend `errorCode`,
so that toggle usage is measurable without ever capturing raw handles, account IDs, captions, or post content (FIND-022, CAP-8).

## Acceptance Criteria

1. **AC1 — Exactly one sanitized event per toggle activation, both toggle instances covered.** `apps/web/src/features/events/EventDetailWrapper.tsx` has two subscribe/unsubscribe toggle code paths today: (a) the single-source-account toggle (`subscribeToAccount`/`unsubscribeFromAccount` mutation pair, lines ~333-359), which currently emits raw-accountId-leaking `account_subscribed`/`account_unsubscribed` events, and (b) the N-coauthor toggle pair (`subscribeToCoauthor`/`unsubscribeFromCoauthor`, Story 0.i6g, lines ~366-390), which currently emits **zero** analytics (0.i6g's own AC9, deliberately deferred to this story). Given a user activates either toggle instance, when the mutation resolves, then exactly one `subscription_toggle_succeeded` (on success) or `subscription_toggle_failed` (on failure) PostHog event is emitted for that activation — and this story's completion means **both** code paths emit it, not just one.
2. **AC2 — Strict 4-field allowlist, no raw identifiers.** The captured payload for either event name contains **only** these fields, never more: `action` (`"subscribe"` | `"unsubscribe"`), `platform` (the account's platform string, e.g. `"instagram"` — matches the existing raw-value convention already used for `platform` elsewhere in this codebase, e.g. `CastVoteForm`'s `vote_cast`/`subscribe-account-dialog.tsx`'s `subscription_added`, not the short slug from `getPlatformSlug`), `source` (see AC3), and — **only on the failure event** — `errorCode`. No `eventId`, `accountId`, handle, username, display name, caption, or any other post/account-content field is present on either event, **even accidentally via a spread** of a larger object (e.g. `{ ...coauthor, action, platform }` would leak `accountId`/`username`/`displayName` — the payload must be built from explicitly named fields only, never a spread of an account/coauthor/subscription object). A dedicated test (Task 5) enforces this as an allowlist check, not just example-based assertions.
3. **AC3 — `source` distinguishes which toggle instance fired (user-decided, see Dev Notes).** `source` is `"event_detail_source_account"` for the existing single-source-account toggle, or `"event_detail_coauthor"` for a Story 0.i6g coauthor toggle — resolved with the user via `AskUserQuestion` during story creation, matching this codebase's existing `source`-field convention (e.g. `AppShellWrapper.tsx`'s `pwa_install_prompt_accepted`/`...declined` events use `source: 'banner'` vs `source: 'settings'` to distinguish call sites the same way).
4. **AC4 — Sanitized `errorCode` extraction (user-decided fallback, see Dev Notes).** On failure, `errorCode` is extracted via this codebase's already-established pattern (`subscribe-account-dialog.tsx`, `report-dialog.tsx`, `onboarding-subscribe-step.tsx`): if the thrown error is a `graphql-request` `ClientError`, `errorCode` is `err.response.errors?.[0]?.extensions?.code` (e.g. `SCRAPER_CAPACITY_EXCEEDED`, `NOT_FOUND`, `INVALID_STATE_TRANSITION`, `BAD_REQUEST`, `UNAUTHENTICATED`) stringified; for any other error shape (e.g. a network-level failure with no GraphQL response), `errorCode` is the literal string `"unknown"` — matching `AppShellWrapper.tsx`'s existing identical fallback convention for an unresolvable error code. `errorCode` is **never** the raw `err.message` (which could vary / isn't guaranteed sanitized) — only the `extensions.code` value or the `"unknown"` fallback.
5. **AC5 — The pre-existing raw-accountId events are fully removed, not kept alongside.** `account_subscribed`/`account_unsubscribed` (the raw-accountId-carrying events CAP-8 exists to fix) are no longer emitted anywhere after this story — replaced by the sanitized taxonomy, not supplemented by it. A regression test asserts `posthog.capture` is never called with either of those two event names.
6. **AC6 — Independent, correctly-attributed `platform`/`source` per activation; no cross-contamination.** For the coauthor toggle pair, where N coauthors can each be toggled (one at a time, per Story 0.i6g's `pendingCoauthorAccountId` tracking), the emitted event's `platform` always matches the specific coauthor that was actually toggled — never a different coauthor's or a stale value. Two coauthors with different platforms toggled in sequence each produce their own correctly-attributed event.
7. **AC7 — No new user-facing string.** This story is pure instrumentation; it adds no new UI, so no new `next-intl` key is required in either `en.json` or `id.json`.

## Tasks / Subtasks

- [ ] **Task 1 — Local sanitized-payload type + error-code helper** (AC: #2, #3, #4)
  - [ ] In `apps/web/src/features/events/EventDetailWrapper.tsx`, add a local (un-exported — see Dev Notes' Gate 2/3 findings) type for the allowlisted payload, e.g.:
    ```ts
    type SubscriptionToggleAction = "subscribe" | "unsubscribe"
    type SubscriptionToggleSource = "event_detail_source_account" | "event_detail_coauthor"
    interface SubscriptionToggleSucceededPayload {
      action: SubscriptionToggleAction
      platform: string
      source: SubscriptionToggleSource
    }
    interface SubscriptionToggleFailedPayload extends SubscriptionToggleSucceededPayload {
      errorCode: string
    }
    ```
    Building every `posthog.capture(...)` call for these two event names from named fields assigned to one of these two interfaces (never a spread) is what makes AC2's "even accidentally via a spread" guarantee hold at the type level, not just by convention.
  - [ ] Add a local helper, e.g. `function getSanitizedSubscriptionErrorCode(err: unknown): string { if (err instanceof ClientError) { return String(err.response?.errors?.[0]?.extensions?.code ?? "unknown") } return "unknown" }`, reusing the `ClientError` import pattern already established in `subscribe-account-dialog.tsx`/`report-dialog.tsx`/`onboarding-subscribe-step.tsx` (import `ClientError` from `graphql-request`, not yet imported in this file — add it to the existing import list).
- [ ] **Task 2 — Single-source-account toggle: replace the two raw-accountId events** (AC: #1, #2, #3, #4, #5)
  - [ ] `subscribeToAccount`'s `onSuccess(data, variables)` (line ~334): replace `posthog.capture("account_subscribed", { eventId, accountId: data?.eventBySlug?.sourceSocialMediaAccountProfile?.accountId })` with `posthog.capture("subscription_toggle_succeeded", { action: "subscribe", platform: variables.input.platform, source: "event_detail_source_account" })` — `variables.input.platform` is already passed to `.mutate()` (`handleSubscribeToAccount`, line ~417), so no extra lookup is needed.
  - [ ] `subscribeToAccount`'s `onError(err)` (line ~342, currently takes no `err` param — widen its signature): add `posthog.capture("subscription_toggle_failed", { action: "subscribe", platform: data?.eventBySlug?.sourceSocialMediaAccountProfile?.platform ?? "", source: "event_detail_source_account", errorCode: getSanitizedSubscriptionErrorCode(err) })`. (The mutation's own variables aren't available in `onError` the same way unless destructured there too — either read `variables.input.platform` if `onError`'s signature exposes it, matching TanStack Query's `onError(err, variables, context)` shape, which it does; prefer `variables.input.platform` over the `data?.eventBySlug...` fallback for consistency with the success branch.)
  - [ ] `unsubscribeFromAccount`'s `onSuccess()` (line ~348): replace `posthog.capture("account_unsubscribed", { eventId, accountId: ... })` with `posthog.capture("subscription_toggle_succeeded", { action: "unsubscribe", platform: data?.eventBySlug?.sourceSocialMediaAccountProfile?.platform ?? "", source: "event_detail_source_account" })` — `removeSubscription`'s mutation variables are `{ id, action }` only (no `platform`), so this one **must** read from the closure-scoped `data.eventBySlug.sourceSocialMediaAccountProfile.platform`, matching the exact same closure-read pattern the current (pre-this-story) code already uses for `accountId` on this very call site — not a new risk.
  - [ ] `unsubscribeFromAccount`'s `onError(err)` (line ~356, widen signature): add `posthog.capture("subscription_toggle_failed", { action: "unsubscribe", platform: data?.eventBySlug?.sourceSocialMediaAccountProfile?.platform ?? "", source: "event_detail_source_account", errorCode: getSanitizedSubscriptionErrorCode(err) })`.
- [ ] **Task 3 — Coauthor toggle pair: add the sanitized events (currently silent)** (AC: #1, #2, #3, #4, #6)
  - [ ] `subscribeToCoauthor`'s `onSuccess(data, variables)` (line ~367): add `posthog.capture("subscription_toggle_succeeded", { action: "subscribe", platform: variables.input.platform, source: "event_detail_coauthor" })` — `variables.input.platform` is already passed (`handleSubscribeToCoauthor`, line ~396), giving AC6's correct-attribution guarantee for free (no lookup against possibly-stale state).
  - [ ] `subscribeToCoauthor`'s `onError(err)` (line ~371, widen signature): add `posthog.capture("subscription_toggle_failed", { action: "subscribe", platform: data?.eventBySlug?.coauthors?.find(c => c.accountId === pendingCoauthorAccountId)?.platform ?? "", source: "event_detail_coauthor", errorCode: getSanitizedSubscriptionErrorCode(err) })`. `onError` doesn't receive the mutate-time `variables` the same convenient way for a `platform`-less failure path reconstruction — reuse `pendingCoauthorAccountId` (still set at this point; it's cleared in `onSettled`, which fires *after* `onError`) to look up the coauthor's `platform` from `data.eventBySlug.coauthors`. (If TanStack Query's `onError(err, variables, context)` signature makes `variables.input.platform` directly available here too, prefer that over the `pendingCoauthorAccountId` lookup for consistency with Task 2/3's success branches — verify at implementation time; both are correct, but one fewer moving part is preferable.)
  - [ ] `unsubscribeFromCoauthor`'s `onSuccess()` (line ~380): add `posthog.capture("subscription_toggle_succeeded", { action: "unsubscribe", platform: data?.eventBySlug?.coauthors?.find(c => c.accountId === pendingCoauthorAccountId)?.platform ?? "", source: "event_detail_coauthor" })` — `removeSubscription`'s variables are `{ id, action }` only, so this one must use the `pendingCoauthorAccountId` lookup (not yet cleared — `onSettled` fires after).
  - [ ] `unsubscribeFromCoauthor`'s `onError(err)` (line ~384, widen signature): mirror the above with `action: "unsubscribe"` and `errorCode: getSanitizedSubscriptionErrorCode(err)`.
- [ ] **Task 4 — Remove dead references** (AC: #5)
  - [ ] Confirm no other file references the literal strings `"account_subscribed"`/`"account_unsubscribed"` after this change (`grep -rn "account_subscribed\|account_unsubscribed" apps packages`) — only this story's own updated test assertions (Task 5) should remain, and those must assert the events are *never* called with those names, not that they succeed.
- [ ] **Task 5 — `EventDetailWrapper.test.tsx` updates** (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Update the existing two assertions (currently `expect(mockPosthogCapture).toHaveBeenCalledWith("account_subscribed", { eventId: "evt_1", accountId: "123" })` at line ~1198, and the `account_unsubscribed` equivalent at line ~1246) to assert the new sanitized call instead: `expect(mockPosthogCapture).toHaveBeenCalledWith("subscription_toggle_succeeded", { action: "subscribe", platform: "instagram", source: "event_detail_source_account" })` (and `action: "unsubscribe"` for the other).
  - [ ] Add a regression assertion alongside each (and to the existing Story 0.i6g coauthor "no analytics" test block, which must now be *rewritten* — it previously asserted zero capture calls for coauthor toggles; that assertion is no longer valid and must become positive-case coverage instead, per AC1): `expect(mockPosthogCapture).not.toHaveBeenCalledWith("account_subscribed", expect.anything())` / `"account_unsubscribed"` (AC5), in both the source-account and coauthor describe blocks.
  - [ ] New failure-path tests (none exist today — `onError` currently only sets the live-region announcement): mock `subscribeToAccount`/`removeSubscription` via MSW returning a GraphQL error with `extensions: { code: "SCRAPER_CAPACITY_EXCEEDED" }` (subscribe) / `extensions: { code: "NOT_FOUND" }` (unsubscribe), matching the existing MSW error-mock pattern already used in this file (`HttpResponse.json({ errors: [{ message: "...", extensions: { code: "..." } }] })`, see `report-dialog.test.tsx` line ~55 for the exact shape) and assert `subscription_toggle_failed` is captured with the matching sanitized `errorCode`, correct `action`/`platform`/`source`, and no other fields.
  - [ ] New fallback test: mock a non-GraphQL-shaped failure (e.g. `HttpResponse.error()` / a network-level rejection, not a `{ errors: [...] }` body) and assert `errorCode: "unknown"` is captured (AC4's fallback branch).
  - [ ] New coauthor-pair tests mirroring the above for `subscribeToCoauthor`/`unsubscribeFromCoauthor`, with `source: "event_detail_coauthor"` and the specific coauthor's own `platform` — include a two-coauthors-with-different-platforms case asserting each activation's event carries *that* coauthor's own platform, not the other's (AC6), reusing this file's existing multi-coauthor MSW fixture pattern from the Story 0.i6g test block.
  - [ ] **New dedicated allowlist test (AC2)** — not just example-based equality assertions on individual calls (which only prove the fields present *are* correct, not that no extra field *could* slip in via a future spread-based regression): after exercising every success/failure/coauthor case above in one combined assertion pass, filter `mockPosthogCapture.mock.calls` to only `subscription_toggle_succeeded`/`subscription_toggle_failed` entries and assert, for every one of them, that `Object.keys(call[1])` is a non-empty subset of `["action", "platform", "source", "errorCode"]` — this is the mechanical "even accidentally via a spread" guard AC2 requires; a future change that accidentally adds `{ ...coauthor }` to one call site fails this test even if that call site's own narrow test forgot to catch it.
- [ ] **Task 6 — Verification** (AC: all)
  - [ ] `pnpm --filter web test` (targeted: `EventDetailWrapper.test.tsx`), full suite green.
  - [ ] `pnpm --filter web lint`, `pnpm --filter web build` — no new TypeScript errors from the widened `onError` signatures or the new local types.
  - [ ] Root `pnpm build`/`pnpm lint` for no cross-package regressions (no other package is touched by this story).
  - [ ] `grep -rn "account_subscribed\|account_unsubscribed" apps packages` confirms no production code reference remains (Task 4).

## Dev Notes

### Design Decisions

Two genuine, non-mechanical design questions were surfaced to the user via `AskUserQuestion` before finalizing this story, per this project's standing `bmad-create-story` rule — neither `epics.md` nor the `spec-post-coauthor-attribution/SPEC.md` CAP-8 entry specifies either value:

1. **What `source` distinguishes.** The toggle this story instruments has two call sites in `EventDetailWrapper.tsx`: the pre-existing single-source-account toggle, and the N-coauthor toggle pair added by Story 0.i6g. Three options were presented: (a) a toggle-instance label (`"event_detail_source_account"` / `"event_detail_coauthor"`), matching this codebase's existing `source`-field convention for "which call site/surface fired this" (e.g. `AppShellWrapper.tsx`'s `source: 'banner'` vs `'settings'`); (b) a static `"event_detail"` page constant, which would not distinguish the two call sites at all; (c) reusing AD-31's `post_account_associations.role` vocabulary directly (`"PUBLISHER"`/`"COAUTHOR"`). **Resolved: option (a)**, the recommended choice — it's the only option that actually lets a PostHog query separate the two toggle instances' usage (the story's own stated purpose, "toggle usage is measurable"), and it follows an established in-codebase naming pattern rather than inventing a new one or repurposing a backend role enum for a frontend UI-surface label.
2. **The sanitized `errorCode` fallback for a non-`ClientError` failure.** The established `err instanceof ClientError → err.response.errors?.[0]?.extensions?.code` pattern only resolves a code for a GraphQL-error response; a network-level failure has no such shape. Two options were presented: (a) the literal string `"unknown"`, matching `AppShellWrapper.tsx`'s already-shipped identical fallback for its own unresolvable-error-code case (`isGeolocationCaptureFailure(error) ? error.code : 'unknown'`); (b) a new, more specific `"NETWORK_ERROR"` constant. **Resolved: option (a)**, the recommended choice — reuses an exact existing convention instead of introducing a second, competing fallback-naming scheme for the same kind of situation.

A third, mechanical (not escalated) implementation decision, resolved directly against Gate 2/3's fresh findings rather than via `AskUserQuestion`: the shared 4-field payload shape is a **local, un-exported** TypeScript type inside `EventDetailWrapper.tsx` (Task 1) — not a new export from `@festgrid/analytics`. Both Gate 2 and Gate 3 (run fresh this session, see below) independently confirmed no second consumer exists anywhere in `epics.md`/`sprint-status.yaml`/`backlog.yaml` today, so a package-level export would be speculative generality with zero current second caller; the two call sites needing the shape both live in this one file already.

### Architecture & UX Gate Findings

No epic readiness report covers Epic 3 as a whole for this specific slice (the FIND-022/CAP-8 analytics cleanup is its own narrow concern, not swept by any existing `epic-readiness/epic-3-readiness.md` pass). All three gates were run **fresh** this session via one-shot persona subagent dispatch, with the actual current code (`EventDetailWrapper.tsx` lines 333-429, read directly) and the relevant Architecture Spine AD-5 excerpt inlined into each prompt.

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** This story only edits the `onSuccess`/`onError` callback bodies of two already-shipped TanStack Query mutation hooks wrapping two already-shipped, unmodified GraphQL mutations (`subscribeToAccount`/`removeSubscription`). No new GraphQL field/resolver, no DB schema/migration, no new external-service call, no new SQS queue/Lambda/infra resource. Direct-from-frontend `posthog.capture()` via `usePostHog()` is this project's own sanctioned, already-established analytics architecture (AD-5), not a bypass of a business-logic backend boundary — confirmed as the pattern at 20+ existing call sites in this exact codebase. The `err instanceof ClientError → extensions.code` error-extraction idiom is copied from three already-merged call sites, not new business logic.
- **Gate 2 (UI Complexity & Reusability) — No gap found.** Zero new UI surface: no component, no visual state, no markup change — `EventDetailView.tsx` (the presentation layer) is not touched at all. The only "shape" question (shared vs. local payload type) is a code-organization matter, not a UI-complexity one, and doesn't meet Gate 2's bar even on that reading (not a hook, not consumed across ≥2 components — both call sites are in this one file).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** PostHog provider wiring (AD-5) and the `ClientError`/`extensions.code` extraction pattern are both already fully established elsewhere in this codebase; this story adds two new *tracked events* to an already-set-up system (explicitly the kind of change Gate 3's own analytics heuristic excludes from being a foundational gap), not a foundational buildout. A grep across `epics.md`/`sprint-status.yaml`/`backlog.yaml` confirms no sibling story references this exact sanitized-payload shape — there is no other consumer this story would be silently building a foundation piece *for*, which is what would have made the shared-vs-local-type question a real Gate 3 finding instead of a mechanical Dev Notes call.
- **Lightweight guard — anything the gates plausibly didn't anticipate?** No. No new external service, no new data entity, no new infra dependency; the only two code paths in scope (the source-account and coauthor toggle pairs) were both already fully read and accounted for before the gates ran.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No DB migration required.** This story makes no database schema, enum, or constraint change — it is a pure frontend instrumentation change inside existing mutation callbacks. **No user approval for a migration is needed because none exists.**
- **Impacted fields/contracts:** None at the GraphQL schema, database, or generated-codegen level — `subscribeToAccount`/`removeSubscription`'s mutation signatures are unmodified. The only new "contract" is the two local TypeScript interfaces introduced in `EventDetailWrapper.tsx` (Task 1), scoped to this file.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** New local (un-exported) `SubscriptionToggleSucceededPayload`/`SubscriptionToggleFailedPayload` interfaces and `SubscriptionToggleAction`/`SubscriptionToggleSource` literal-union types, all inside `EventDetailWrapper.tsx`. No `codegen` run needed — no `.graphql` document changes.
- **Backward compatibility and rollout notes:** `account_subscribed`/`account_unsubscribed` stop being emitted entirely (AC5) — any existing PostHog insight/dashboard/funnel built on those two event names will need to be rebuilt against `subscription_toggle_succeeded`/`subscription_toggle_failed` with the new `action`/`source` fields. This is the intended outcome of CAP-8 (the raw-`accountId`-carrying events are the privacy problem being fixed, not a side effect to work around), not an unintended breaking change — flagged here only so the rollout is a known, deliberate fact rather than a silent analytics-continuity surprise.
- **Verification checks:** Task 5's updated/new `EventDetailWrapper.test.tsx` cases (success, failure with real `extensions.code` values, the `"unknown"` fallback, coauthor independence) plus the dedicated Task 5 allowlist test; `pnpm --filter web lint`/`build` clean.

### Project Structure Notes

- **Reusable-component placement:** N/A — no component added or touched.
- **Reusable-mechanism placement (`packages/domain`/`packages/analytics`):** Deliberately **not** extracted to a shared package (see Design Decisions' third item and the Gate 2/3 findings above) — the sanitized-payload type and the error-code helper both stay local to `EventDetailWrapper.tsx`. Note for whoever later needs this exact sanitized-analytics shape a second time (e.g. a future toggle elsewhere in the app): that would be the point to promote this to `@festgrid/analytics`, not before.
- **Existing-but-unused parallel helper, not to be reached for:** `packages/analytics/src/capture-event.ts` exports a `capturePostHogEvent(event, properties)` helper that wraps `posthog-js`'s default singleton directly — but it is not actually used by `EventDetailWrapper.tsx` or by any of this codebase's 20+ other `posthog.capture(...)` call sites, all of which call `.capture()` directly via the `usePostHog()` hook instead. This story follows the dominant, already-established pattern (`usePostHog()` + direct `.capture()`, exactly matching this same file's six other existing calls) rather than introducing a third analytics-calling convention by reaching for the unused helper.
- **State management categorization:** N/A — no new state. The existing `pendingCoauthorAccountId` local state (Story 0.i6g) is read (not written) by this story's coauthor `onError`/`onSuccess` handlers to attribute the correct coauthor's `platform` to a failure event where mutation variables don't carry it (`removeSubscription`'s `{ id, action }` shape).
- **Async/loader categorization:** N/A — no new async UI state; this story doesn't touch any loading/pending visual treatment.
- **No cloud/external service setup** — `SETUP_WALKTHROUGH.md` unaffected.
- **No new npm dependency, no new workspace package.** `ClientError` is newly imported into `EventDetailWrapper.tsx` from the already-installed `graphql-request` package (already a direct dependency of `apps/web`, already imported by `graphql-client.ts` and three other feature files).
- **Current code state (read in full before drafting this story):**
  - `apps/web/src/features/events/EventDetailWrapper.tsx` (lines 1-480 read directly) — the four mutation hooks in scope: `subscribeToAccount`/`unsubscribeFromAccount` (lines 333-359, today's `account_subscribed`/`account_unsubscribed` leak) and `subscribeToCoauthor`/`unsubscribeFromCoauthor` (lines 366-390, Story 0.i6g, today emits nothing). `handleSubscribeToAccount`/`handleUnsubscribeFromAccount` (lines 413-425) and `handleSubscribeToCoauthor`/`handleUnsubscribeFromCoauthor` (lines 392-411) show exactly what each mutation's `.mutate()` call variables carry (`input.platform` for both subscribe calls; only `{ id, action }` for both unsubscribe calls — the reason the two unsubscribe `onSuccess`/`onError` handlers must read `platform` from closure-scoped `data`/`pendingCoauthorAccountId` state instead).
  - `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx`, `apps/web/src/features/events/report-dialog.tsx`, `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx` — the three existing `ClientError`/`extensions.code` extraction call sites this story's `getSanitizedSubscriptionErrorCode` helper mirrors.
  - `apps/web/src/components/layout/AppShellWrapper.tsx` (lines ~100-165) — the existing `source: 'banner'`/`source: 'settings'` convention (AC3) and the existing `'unknown'` fallback-error-code convention (AC4), both confirmed read directly.
  - `apps/web/src/features/events/EventDetailWrapper.test.tsx` (lines 1160-1521 read directly) — the two existing `account_subscribed`/`account_unsubscribed` assertions (lines 1198, 1246) this story replaces, the MSW mock/fixture setup (`mockPosthogCapture`, `currentMockEvent`, `currentMockSubscriptions`), and the Story 0.i6g coauthor "no analytics" negative assertions (lines ~1511-1521) this story's new coauthor-analytics tests supersede.
  - `apps/web/src/features/events/report-dialog.test.tsx` (line ~51-58) — the exact MSW GraphQL-error mock shape (`HttpResponse.json({ errors: [{ message, extensions: { code } }] })`) this story's new failure-path tests reuse.
  - `packages/analytics/src/index.ts`, `posthog-provider.tsx`, `capture-event.ts` — confirmed `usePostHog()` is a thin re-export of `posthog-js/react`'s own hook (no project-specific wrapping), and `capturePostHogEvent` exists but is unused by the dominant call pattern (see Project Structure Notes above).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.19] — this story's AC text and "Depends on: Story 0.i6g"
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i6g, AC9] — confirms the coauthor toggle pair emits zero analytics today, explicitly deferring 100% of this toggle's analytics taxonomy to this story
- [Source: _bmad-output/specs/spec-post-coauthor-attribution/SPEC.md#CAP-8] — "Sanitized subscription-toggle analytics" intent/success text
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#CC-031] — backlog row this story attaches to on completion (carved from CC-029's partial promotion, tracks "the still-not-created 3.19 (sanitized subscription-toggle analytics)")
- [Source: _bmad-output/implementation-artifacts/backlog/FIND-022-coauthor-content-issues.md] — original cross-layer finding; "analytics" named explicitly as one of the affected layers
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-5] — Analytics Instrumentation binding rule (noun_verb taxonomy, single provider, new-event documentation requirement)
- [Source: _bmad-output/project-context.md#Technology Stack, Code Organization] — PostHog as the analytics provider; `packages/domain`/`packages/ui` placement rules (neither applies here — see Project Structure Notes)
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx, EventDetailWrapper.test.tsx] — read in full/targeted ranges, current state of both toggle pairs and their existing tests
- [Source: apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx, apps/web/src/features/events/report-dialog.tsx, apps/web/src/features/onboarding/onboarding-subscribe-step.tsx] — existing `ClientError`/`extensions.code` pattern
- [Source: apps/web/src/components/layout/AppShellWrapper.tsx] — existing `source` field convention and `'unknown'` fallback-error-code convention, both reused by this story's resolved design decisions
- [Source: packages/analytics/src/index.ts, posthog-provider.tsx, capture-event.ts] — confirms the dominant `usePostHog()` + direct `.capture()` pattern over the unused `capturePostHogEvent` helper

## Global Rules References

- [x] `_bmad-output/project-context.md` — Analytics & User Interactions tech stack entry (PostHog); Code Organization (confirmed neither `packages/domain` nor `packages/ui` placement applies — Project Structure Notes)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-5 (Analytics Instrumentation), the binding rule this story's new tracked events are documented against
- [x] `docs/infrastructure/index.md` — reviewed; this story adds no infrastructure resource (no new queue, Lambda, compute, or deploy step) — purely a frontend instrumentation change inside `apps/web`
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — all three gates run fresh this session (no epic readiness report covers this specific analytics slice); see Architecture & UX Gate Findings

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `apps/web/src/features/events/EventDetailWrapper.tsx` — add `ClientError` import; add local `SubscriptionToggleAction`/`SubscriptionToggleSource`/`SubscriptionToggleSucceededPayload`/`SubscriptionToggleFailedPayload` types and `getSanitizedSubscriptionErrorCode` helper (Task 1); replace `account_subscribed`/`account_unsubscribed` capture calls and widen `onError` signatures on the source-account pair (Task 2); add capture calls and widen `onError` signatures on the coauthor pair (Task 3).
  2. `apps/web/src/features/events/EventDetailWrapper.test.tsx` — update the two existing assertions; add regression assertions for the removed event names; add failure-path, fallback-`"unknown"`, coauthor-independence, and dedicated allowlist tests (Task 5).
- **Rule Mapping:**
  - AD-5 (Analytics Instrumentation) → new tracked events (`subscription_toggle_succeeded`/`subscription_toggle_failed`) explicitly documented here with their payload shape, per AD-5 rule 3.
  - `story-split-gate.md` Gate 1/2/3 → run fresh, all three no-gap (Architecture & UX Gate Findings).
  - Data Type Compatibility rule (this workflow) → dedicated section above; no DB migration, no GraphQL/codegen change, local TS types only.
  - Reusable-mechanism placement rule (this workflow) → Gate 2/3's "no gap" + Design Decisions' third item: local, un-exported type/helper, not a `packages/analytics` export, given zero current second consumer.
- **Verification Plan:**
  - `pnpm --filter web test` (`EventDetailWrapper.test.tsx` full suite, existing + new cases), `pnpm --filter web lint`, `pnpm --filter web build`.
  - Root `pnpm build`/`pnpm lint` for cross-package regressions (none expected — no other package touched).
  - `grep -rn "account_subscribed\|account_unsubscribed" apps packages` confirms zero remaining production references (Task 4).
  - Manual sanity: not performed as a live browser walkthrough in this story-creation session; flagged as the one item for the implementing `bmad-dev-story` run to confirm (open an event-detail page with a source account and 1+ coauthors, toggle each, confirm via browser devtools/PostHog debug mode that only the sanitized 4-field payload is sent).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Tasks 1-6 match the two user-decided design questions (`source` as a toggle-instance label; `errorCode` fallback `"unknown"`) plus the epics.md-specified AC text.
- [ ] Architecture and boundary confirmation — no backend/schema/infra change; Gate 1/2/3 all no-gap (Architecture & UX Gate Findings); sanitized-payload type/helper kept local per Gate 2/3's findings.
- [ ] Testing plan confirmation — Task 5 covers success, failure (real `extensions.code` values), the `"unknown"` fallback, coauthor independence (AC6), the `account_subscribed`/`account_unsubscribed` regression guard (AC5), and the dedicated allowlist check (AC2).
- [ ] **Explicit human approval state (Default: pending approval)** — not yet granted; this story was created via `bmad-create-story` only. A `bmad-dev-story` dispatch (or equivalent explicit go-ahead) is required before implementation begins.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three run fresh this session, all three no-gap, no prerequisite story needed.
- [ ] Prerequisite Story 0.i6g confirmed at `review` status (built) — re-verified directly against `sprint-status.yaml` at story-creation time; re-verify again at `dev-story` start per this project's standing convention.

## Testing Requirements

- [ ] Unit/integration tests — `apps/web/src/features/events/EventDetailWrapper.test.tsx`: updated success-case assertions (source-account subscribe/unsubscribe), new failure-case assertions with real sanitized `errorCode` values, new `"unknown"`-fallback case, new coauthor success/failure/independence cases, new `account_subscribed`/`account_unsubscribed` regression guard, new dedicated 4-field allowlist check across every captured call.
- [ ] E2E tests — not required; this is pure instrumentation on an already-e2e-exempt toggle interaction (no new critical user flow, no new UI).
- [ ] Migration verification — not applicable; no migration in this story (Data Type Compatibility & Migration Requirements).
- [ ] Codegen verification — not applicable; no `.graphql` document changes.

## Deliverables Checklist

- [ ] `subscription_toggle_succeeded`/`subscription_toggle_failed` emitted for the single-source-account toggle (subscribe and unsubscribe, success and failure) with the 4-field allowlisted payload (AC1, AC2).
- [ ] `subscription_toggle_succeeded`/`subscription_toggle_failed` emitted for the coauthor toggle pair (subscribe and unsubscribe, success and failure), previously silent (AC1, AC2, AC6).
- [ ] `source` correctly distinguishes `"event_detail_source_account"` from `"event_detail_coauthor"` (AC3).
- [ ] `errorCode` sourced from `extensions.code` on a `ClientError`, `"unknown"` otherwise, never the raw error message (AC4).
- [ ] `account_subscribed`/`account_unsubscribed` no longer emitted anywhere — regression-tested (AC5).
- [ ] No cross-coauthor attribution mistakes under sequential toggling (AC6).
- [ ] No new i18n keys needed or added (AC7).
- [ ] Dedicated allowlist test passing against every captured call across all new/updated test cases (AC2).

## Out of Scope

- **A shared `@festgrid/analytics` export for this sanitized-payload shape** — Gate 2/3 found no current second consumer; deferred until one actually exists (Dev Notes, Project Structure Notes).
- **Reconciling `packages/analytics/src/capture-event.ts`'s unused `capturePostHogEvent` helper** with the dominant direct-`.capture()`-via-hook pattern used everywhere else in this codebase — a pre-existing, unrelated drift noticed during this story's research, not something this story's narrow analytics-sanitization scope should absorb.
- **Any other `posthog.capture` call site in `EventDetailWrapper.tsx`** (`event_favorited`/`event_unfavorited`, `event_added_to_calendar`/`event_removed_from_calendar`, `event_details_viewed`, `calendar_ics_downloaded`) or elsewhere in the app (`subscription_added` in `subscribe-account-dialog.tsx`, `subscription_removed` in `subscriptions-content.tsx`) — none of these are "Story 0.i6g's subscribe/unsubscribe toggle" (the epics.md AC's literal scope); they are different mutations/different UI surfaces and are not touched by this story.
- **Story 0.i6g's own UI/toggle behavior** — unaffected; this story only changes what fires inside already-shipped `onSuccess`/`onError` callbacks, never the toggle's rendering, accessibility treatment, or mutation call shape.

## Definition of Done

- [ ] AC1-7 satisfied.
- [ ] Required tests passing (Task 5 + Testing Requirements), including the dedicated allowlist check.
- [ ] Lint and type checks passing for `apps/web`.
- [ ] No remaining production reference to `account_subscribed`/`account_unsubscribed` (Task 4).
- [ ] Pre-Coding Approval Gate's explicit human approval state confirmed before this story is marked done.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (bmad-create-story, direct in-session story authoring).

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-10-07: Story created via `bmad-create-story`, pinned directly to key `3-19-sanitized-subscription-toggle-analytics` (no next-story lookup — the user explicitly pinned this story, carved from backlog row CC-031). Gate 1/2/3 run fresh via one-shot persona subagent dispatch (Winston for Gate 1/3, Freya lens for Gate 2) — all three no-gap. Two design decisions resolved with the user via `AskUserQuestion`: (1) `source` is a toggle-instance label (`"event_detail_source_account"` / `"event_detail_coauthor"`), not a static page constant or a reused backend role enum value; (2) the non-`ClientError` `errorCode` fallback is the literal string `"unknown"`, matching `AppShellWrapper.tsx`'s existing identical convention, not a new `"NETWORK_ERROR"` constant. No DB migration in this story — no user migration approval was required.
