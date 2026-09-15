---
baseline_commit: 46c46b9cda54a363029a1aecf0e5b41d63b81a2f
---

# Story 0.i6a: Finish the SubscribedAccountCard/AccountAvatar contract

## Story Details

- Epic: 0.i6 (One SubscribedAccountCard for every subscribed-account display)
- Story ID: 0.i6a
- Baseline commit: 46c46b9
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `AccountAvatar`/`SubscribedAccountCard` to render a defined fallback — never a blank line, a bare `@`, or a misleading empty link — for every degenerate input in their own contract (empty `displayName`, empty `username`, missing avatar, missing/empty `accountHref`), and the one real caller that already renders this card today (`EventDetailView.tsx`, the event-detail page) to stop skipping the entire account-attribution block whenever any single field besides `accountId` is missing,
so that the card's contract is actually complete — not just on paper — before Stories 0.i6b/0.i6c/0.i6d/0.i6e adopt it at more call sites (FIND-011, BUG-005).

## Acceptance Criteria

1. **Given** `SubscribedAccountCard` rendered with an empty-string `displayName` and a non-empty `username`, **when** it renders, **then** the primary identity text shows `@{username}` instead of a blank line, and no duplicate `@{username}` line is also shown beneath it.
2. **Given** `SubscribedAccountCard` rendered with both `displayName` and `username` empty or missing, **when** it renders, **then** the primary identity text shows a defined fallback label (`"Unknown account"` by default, overridable via a new optional `labels.unknownAccountLabel`) instead of a blank line or a bare `@`.
3. **Given** `SubscribedAccountCard` rendered with both `displayName` and `username` present (today's normal case), **when** it renders, **then** behavior is pixel-identical to today: primary text is `displayName`, secondary text is `@{username}`.
4. **Given** `SubscribedAccountCard` rendered with an empty or missing `accountHref`, **when** it renders, **then** the avatar+identity block renders inside a non-interactive wrapper (no `<a>` element, no link semantics, no `href=""` self-link) while still showing the avatar and identity text exactly as it would with a valid `accountHref`.
5. **Given** `AccountAvatar` rendered with a missing/empty `profileImageUrl` (already-shipped, already-working behavior), **when** it renders, **then** it continues to show its existing defined fallback (platform icon when `platform` is known, generic silhouette otherwise) completely unchanged — this story adds explicit empty-string regression tests locking this in, since none exist today, but does not change the rendering logic itself.
6. **Given** `EventDetailView` (`packages/ui`) receives event data where `accountId` is present but one or more of `accountPlatform`/`accountUsername`/`accountHref`/`accountName` is missing, **when** it renders, **then** `SubscribedAccountCard` still renders — using its new graceful-fallback behavior from AC 1-4 — instead of the entire account-attribution block being silently omitted, which is what happens today.
7. **Given** `EventDetailView` renders `SubscribedAccountCard` with `accountPlatform` or `accountUsername` missing, **when** the user looks at the subscribe/unsubscribe toggle, **then** it is disabled (via the card's existing `onSubscribe`/`onUnsubscribe`-absent disable logic, already shipped in Story 0.i6f) rather than hidden or silently broken — there isn't enough data for `EventDetailWrapper.tsx`'s subscribe/unsubscribe mutations to act on.
8. **Given** `accountId` itself is missing, **when** `EventDetailView` renders, **then** no account-attribution block renders at all — this one case is unchanged from today, since there is genuinely nothing to attribute, link to, or subscribe to without an account identity.
9. **Given** `SubscribedAccountCardProps`/`AccountAvatarProps`, **when** inspected after this story, **then** `platform`, `displayName`, `username` (on `SubscribedAccountCardProps.account`) and the top-level `accountHref` prop are all optional/nullable — only `account.accountId` remains a required, non-null `string` — matching the shape the components' one real caller (`EventDetailViewProps`) has always actually supplied (`string | null`, never guaranteed non-null).

## Tasks / Subtasks

- [ ] **Task 1 — New shared `packages/ui/src/core/account-identity.ts` fallback helper (AC: 1, 2, 3, 9)**
  - [ ] Add `export function getAccountIdentityLabel(displayName: string | null | undefined, username: string | null | undefined, fallback: string): string` implementing the same 3-way chain `AccountAvatar` already computes inline today (`displayName || (username ? '@'+username : fallback)`), parameterized by `fallback` so each caller supplies its own terminal default rather than hardcoding one shared string.
  - [ ] This is a plain, dependency-free TS function — lives in `packages/ui/src/core/` (not `packages/domain`) because it is UI-presentation text formatting for two `packages/ui` components, not portable business logic; not added to `packages/ui/src/index.ts`'s public barrel since both current consumers (Task 2, Task 3) live inside `packages/ui` itself and import it by relative path — no cross-package consumer exists yet to justify a public export (see Dev Notes' Code Organization note).

- [ ] **Task 2 — `packages/ui/src/core/account-avatar.tsx`: use the shared helper, widen `platform` nullability, lock in regression tests (AC: 5, 9)**
  - [ ] Replace the inline `const altText = displayName || (username ? '@'+username : 'User avatar');` (current line 47) with `const altText = getAccountIdentityLabel(displayName, username, 'User avatar');` — same exact output for every existing input, verified by the existing 11-test suite passing unmodified.
  - [ ] Widen `AccountAvatarProps.platform` from `platform?: string;` to `platform?: string | null;`, matching the existing nullability of `displayName`/`username` on the same interface (`string | null | undefined` throughout) — purely a type-signature widening, the `if (platform)` truthy check already handles `null` correctly with zero runtime change.
  - [ ] `packages/ui/src/core/account-avatar.test.tsx`: add explicit regression cases (none exist today) — `displayName=""` + `username="jane"` → `alt` is `"@jane"`; `displayName=""` + `username=""` (or omitted) → `alt` is `"User avatar"`; `displayName="Jane Doe"` + `username=""` → `alt` is `"Jane Doe"` (unaffected). All against the existing `avatar-fallback-container`'s `aria-label` (fallback path) and `avatar-image`'s `alt` attribute (image path), per the two existing assertion patterns in this file.

- [ ] **Task 3 — `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` + `.types.ts`: graceful-fallback rendering (AC: 1, 2, 3, 4, 9)**
  - [ ] `SubscribedAccountCardProps`: widen `account.platform: string` → `platform?: string | null`, `account.displayName: string` → `displayName?: string | null`, `account.username: string` → `username?: string | null`, and the top-level `accountHref: string` → `accountHref?: string | null`. Leave `account.accountId: string` required and non-null — the one field this component cannot degrade without (needed to key the subscribe toggle and, per AC 8, gates whether the caller renders the card at all). Add `labels.unknownAccountLabel?: string` to the existing `labels` object type, alongside `subscribeLabel`/`unsubscribeLabel`/`checkingSubscriptionLabel`.
  - [ ] Compute `const primaryLabel = getAccountIdentityLabel(account.displayName, account.username, labels?.unknownAccountLabel || 'Unknown account');` and render it in place of today's raw `{account.displayName}` (current line 48).
  - [ ] Render the secondary `@{username}` line (current line 49) only when **both** `account.displayName` and `account.username` are truthy — i.e. `{account.displayName && account.username && (<span ...>@{account.username}</span>)}` — so when `displayName` is empty and `username` got promoted into `primaryLabel` as `@{username}` (AC 1), it is not also duplicated on the line below; and so an empty `username` alone never renders a bare `@`.
  - [ ] Wrap the avatar+identity block in `<a href={accountHref} ...>` only when `accountHref` is truthy; when it is empty/missing, render the identical inner content (avatar, primary label, conditional secondary line) inside a plain `<div>` with the same layout classes minus the link-specific `href`/focus-visible-ring classes (there is nothing to navigate to or focus as a link). Keep the existing outer flex/gap layout classes on both branches so visual position is unchanged either way.
  - [ ] Thread `platform={account.platform}` into `AccountAvatar` unchanged (already done since Story 0.i6f) — no change needed there beyond the type widening already covered by Task 2.

- [ ] **Task 4 — `packages/ui/src/features/events/EventDetailView.tsx` + `.types.ts`: loosen the caller guard (AC: 6, 7, 8)**
  - [ ] Change the render guard at current line 259 from `{accountId && accountPlatform && accountUsername && accountHref && (` to `{accountId && (` — the sole remaining precondition is `accountId` (AC 8); everything else degrades gracefully inside `SubscribedAccountCard` per Task 3.
  - [ ] Drop the now-redundant `displayName: accountName || accountUsername` fallback computed at the call site (current line 265) — pass `displayName: accountName` raw and let `SubscribedAccountCard`'s own `getAccountIdentityLabel` chain (Task 3) do the one fallback computation, so the same fallback logic isn't duplicated in two places with two slightly different terminal behaviors.
  - [ ] Add `const canActOnSubscription = !!(accountPlatform && accountUsername);` and change the two prop lines `onSubscribe={onSubscribeToAccount}` / `onUnsubscribe={onUnsubscribeFromAccount}` (current lines 270-271) to `onSubscribe={canActOnSubscription ? onSubscribeToAccount : undefined}` / `onUnsubscribe={canActOnSubscription ? onUnsubscribeFromAccount : undefined}` — this reuses `SubscribedAccountCard`'s existing "disable the toggle when the handler prop is absent" logic (already shipped, `SubscribedAccountCard.tsx` current lines 28-32) with zero new disabling logic needed, satisfying AC 7.
  - [ ] Thread `unknownAccountLabel: labels.unknownAccountLabel` into the `labels={{ ... }}` object literal passed to `SubscribedAccountCard` (current lines 274-278).
  - [ ] `EventDetailViewLabels` (`.types.ts`): add `unknownAccountLabel?: string;` alongside the other optional label fields (`scheduleCheckboxLabel?`, `checkingSubscriptionLabel?`, etc.) — optional, so `apps/web/src/features/events/mapper.test.ts`'s hand-written `LABELS` fixture keeps compiling unmodified, matching the exact precedent Story 0.i6f's Task 5 already established for this same interface.

- [ ] **Task 5 — `apps/web/src/features/events/mapper.ts` + `apps/web/locales/{en,id}.json`: wire the new label (AC: 2)**
  - [ ] Add `unknownAccountLabel: t('unknownAccountLabel')` to `useEventDetailViewLabels()`'s returned object, alongside the existing `subscribeButtonLabel`/`unsubscribeButtonLabel`/`checkingSubscriptionLabel` entries.
  - [ ] `en.json`: add `"unknownAccountLabel": "Unknown account"` to the `EventDetailsPage` namespace, alongside the existing subscribe/unsubscribe strings.
  - [ ] `id.json`: add the parallel Indonesian key (e.g. `"Akun tidak dikenal"`) in the same position — confirm final wording against this file's existing register rather than a literal machine translation.

- [ ] **Task 6 — Tests (AC: all)**
  - [ ] `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx`: add cases — empty `displayName` + present `username` → primary text is `@{username}`, no duplicate secondary line; empty `displayName` + empty `username` → primary text is `"Unknown account"` (default) and via a custom `labels.unknownAccountLabel` override; present `displayName` + empty `username` → secondary line is absent (no bare `@`); empty/missing `accountHref` → `screen.queryByRole('link')` is not present, but the avatar and identity text are still visible; existing "renders AccountAvatar...and link to accountHref" test (current line 23) continues to assert the `<a>` path since it still passes a valid `accountHref`.
  - [ ] `packages/ui/src/core/account-avatar.test.tsx`: the 3 new empty-string cases from Task 2.
  - [ ] `packages/ui/src/features/events/EventDetailView.test.tsx`: **rewrite** the existing `'omits SubscribedAccountCard when essential account props are missing'` test (current lines 485-497) — its three sub-cases (missing `accountId`/`accountPlatform`/`accountUsername`) currently all assert `subscribe-toggle` is absent; under the new guard only the missing-`accountId` case still asserts absence (AC 8), while the missing-`accountPlatform`/missing-`accountUsername` cases must instead assert the toggle **is present but disabled** (AC 6, 7) — `expect(screen.getByTestId('subscribe-toggle')).toBeDisabled()`. The existing `'renders SubscribedAccountCard when accountId, platform, and username are present'` test (current line 473) is unaffected and needs no change.
  - [ ] `apps/web/src/features/events/mapper.test.ts`: confirm it still compiles unchanged (Task 4's optional-field choice for `unknownAccountLabel`) — no edit expected, re-run as part of verification.

## Dev Notes

- **Scope: `packages/ui` (core + subscriptions + events) and two files in `apps/web/src/features/events`/`locales`.** No `packages/domain` change, no `apps/backend` change, no database migration, no new GraphQL SDL type or field, no new npm dependency.
- **Root cause, tying BUG-005/DW-006/DW-010/DW-015 together:** `SubscribedAccountCardProps` declared `account.platform`/`displayName`/`username` and the top-level `accountHref` as required, non-null `string`s — a stronger guarantee than the component's one real caller (`EventDetailViewProps`, where all four have always been `string | null`) can actually promise. Rather than the component degrading gracefully, its only reachable caller (`EventDetailView.tsx`) had to compensate with a caller-side all-or-nothing guard (`accountId && accountPlatform && accountUsername && accountHref &&`) purely to satisfy TypeScript — not because the underlying data is actually guaranteed all-or-nothing. That guard is DW-010's finding; the component's own blank/bare-`@`/self-link rendering once given degenerate props is DW-006/DW-015's finding. This story fixes the root cause (widen the component's own type contract and rendering to match what its caller can actually promise, AC 9) rather than patching each symptom separately, which is why the caller guard (Task 4) and the component fallback rendering (Task 3) ship together in one story.
- **Current code state (read in full before drafting this story):**
  - `packages/ui/src/core/account-avatar.tsx` (87 lines) — already has a fully defined image fallback (platform icon or generic silhouette, Story 0.i6f) and a 3-way alt-text fallback chain (line 47). No behavior gap for the avatar itself; only extracted into a shared helper (Task 1/2) so `SubscribedAccountCard`'s new text fallback (Task 3) doesn't duplicate the same chain with a second, potentially-drifting copy.
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` (75 lines) — current `account` type requires non-null `platform`/`displayName`/`username`; `accountHref` is a required non-null top-level prop. Renders `{account.displayName}` and `@{account.username}` as unconditional plain text spans (lines 48-49) — an empty `displayName` renders a blank line, an empty `username` renders a bare `@`. Already has the fully-functional subscribe/unsubscribe icon toggle (Story 0.i6f) — untouched by this story except for the `labels.unknownAccountLabel` addition.
  - `packages/ui/src/features/events/EventDetailView.tsx` (read in full) — line 259's guard is the live, production-reachable code DW-010 refers to (confirmed by tracing `apps/web/src/features/events/EventDetailWrapper.tsx` line 623 `<EventDetailView {...mappedProps} />`, whose `mappedProps` come from `apps/web/src/features/events/mapper.ts`'s `mapGraphQLEventToDetailViewProps`, lines 117-124, which already passes `accountName`/`accountUsername`/`accountPlatform`/`accountHref` as `string | null` straight from `event.sourceSocialMediaAccountProfile` with no additional guarding upstream). This is the real event-detail page, not a stale/dead code path — an initial pass mistakenly assumed `SubscribedAccountCard` wasn't wired into `apps/web` yet (it only appeared in test files by simple grep); reading `EventDetailView.tsx`/`mapper.ts` in full corrected that. This correction doesn't change any Gate 1/2/3 conclusion below (see Architecture & UX Gate Findings) — the touched surface is still entirely `packages/ui` + `apps/web`'s existing label-wiring pattern, the same class of surface Story 0.i6f's identical Gate 1 already passed touching the same two files.
  - `apps/web/src/features/events/mapper.ts` — `useEventDetailViewLabels()` (lines 7-44) already threads ~30 optional/required label fields the same way this story's one new `unknownAccountLabel` key will.
- **Scope decisions confirmed with the user via `AskUserQuestion` during story creation** (see Change Log):
  1. **Fallback breadth:** cover the full original DW-015 evidence set (empty `displayName`, empty `username`, missing avatar, empty/missing `accountHref`) rather than stopping at the epics.md AC's literal wording (`displayName`/avatar only) — same file, same class of defect, same evidence bundle BUG-005 itself cites.
  2. **Caller guard:** fix `EventDetailView.tsx`'s all-or-nothing guard (DW-010) in this same story rather than carving it into a follow-up — chosen once the guard was found to be live/production-reachable (not stale), and because leaving `SubscribedAccountCard`'s new fallback rendering unreachable behind an unfixed guard would make Task 3's work dead code in the app's only real caller.
- **`labels.unknownAccountLabel`, not a hardcoded string.** Confirmed via the Gate 3 check below: this project's established pattern for `packages/ui` components needing occasional English microcopy (since `packages/ui` deliberately never imports `next-intl` directly — see `useScopedLocale()`'s doc comment and `project-context.md`) is an optional `labels.*` prop with a hardcoded English default, already shipped twice in this exact file (`subscribeLabel`/`unsubscribeLabel`/`checkingSubscriptionLabel`, Story 0.i6f). `unknownAccountLabel` follows that precedent exactly. `AccountAvatar`'s own `'User avatar'` alt-text default is deliberately **left as its existing unlocalized hardcoded string, not migrated to a `labels` prop** — it has no `labels` prop today, adding one would be a larger, unrelated interface change to an already-tested component, and alt text (accessibility-only, never visually displayed) is lower-priority for localization than the visible primary-label text this story actually adds. Recorded here so a future pass doesn't need to re-litigate the inconsistency.

### Architecture & UX Gate Findings

- **No epic readiness report exists for Epic 0.i6** (`_bmad-output/planning-artifacts/epic-readiness/` has reports for Epics 0, 0.i7, 1, 1.i1, 2-7, but none for `epic-0-i6`) — Gate 1, 2, and 3 were run **fresh** for this story, not cited from a swept report (same situation Story 0.i6f documented for the same epic).
- **Gate 1 (Architecture/Infrastructure Completeness), run fresh:** **No gap.** Dispatched to a subagent with the architect's analytical lens, full component source inlined. Verdict: purely presentational fallback rendering inside two already-shipped `packages/ui` components plus one existing caller (`EventDetailView.tsx`) and its `apps/web` label-wiring pattern (`mapper.ts`) — no DB/domain/backend call, no external-service call, no new API surface, no auth/business logic, no new infra dependency. (Note: the subagent's run assumed `SubscribedAccountCard` had no `apps/web` production caller yet; that assumption was later corrected in Dev Notes above once `EventDetailView.tsx`/`mapper.ts` were traced in full. The correction does not change the verdict — the touched surface is still the same class of `packages/ui` + `apps/web`-label-wiring change Story 0.i6f's own Gate 1 already passed on these same two files, just with an additionally-corrected understanding that the guard being loosened is live code, not dead code.)
- **Gate 2 (UI Complexity & Reusability), run fresh:** **No gap.** Dispatched to a subagent with the UX lens; first confirmed `design-artifacts/UX-festgrid-run-1/DESIGN.md`/`EXPERIENCE.md` contain no mention of `AccountAvatar`, `SubscribedAccountCard`, or any empty/degenerate-state visual spec for either (only an unrelated nav-trigger avatar token, and a Posts-tab-pill avatar mention with no empty-state copy) — no UX-spec detail is being dropped by this scope. This is a small, contract-preserving addition to two already-shipped, already-reusable components (mirroring logic `AccountAvatar` already computes for alt text), not a new state machine or a hook/util multiple *other* components will independently depend on — stays inside this one story.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness), run fresh:** **No gap.** The `labels`-prop-with-English-default pattern this story's `unknownAccountLabel` uses is an already-shipped, twice-precedented mechanism in this exact file (`subscribeLabel`/`unsubscribeLabel`/`checkingSubscriptionLabel`), not a dependency on a not-yet-built i18n foundation for `packages/ui` — `packages/ui` deliberately never imports `next-intl` directly, by design (see `useScopedLocale()`). No global shell, analytics, or codegen dependency is touched.
- **Lightweight guard (per this workflow's escape hatch):** reasoned over the corrected, expanded scope above (component fallback + caller-guard loosening + one new label) for anything a hypothetical epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new infra dependency introduced by expanding scope to include the caller guard. Nothing here warrants a second Gate 1/3 pass.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: a real mismatch found and fixed by this story (this is the story's core defect, not an incidental note).** `SubscribedAccountCardProps.account.platform`/`displayName`/`username` and the top-level `accountHref` were declared as required, non-null `string`s, while their one real source — `EventDetailViewProps.accountPlatform`/`accountName`/`accountUsername`/`accountHref` — has always been typed `string | null` (optional). The caller compensated with an all-or-nothing render guard (DW-010) instead of the component honoring its actual data's nullability.
- **Impacted fields/contracts:** `SubscribedAccountCardProps.account.platform/displayName/username: string → string | null | undefined`; `SubscribedAccountCardProps.accountHref: string → string | null | undefined`; `AccountAvatarProps.platform: string | undefined → string | null | undefined`; `SubscribedAccountCardProps.labels`/`EventDetailViewLabels` gain one new optional field, `unknownAccountLabel?: string`. All are hand-written TS interface changes in `packages/ui`; no GraphQL SDL, resolver, or DB schema field changes anywhere — `EventDetailViewProps`' fields were already correctly nullable and are unchanged by this story.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** Listed above — all hand-written, no codegen run needed (no `.graphql` document changes anywhere in this story).
- **Backward compatibility and rollout notes:** Every prop widening here is required → optional, which is non-breaking for any caller currently passing concrete values (a `string` still satisfies `string | null | undefined`). `SubscribedAccountCard` has exactly one real consumer app-wide today (`EventDetailView.tsx`, confirmed by a repo-wide search — Post Selection/Settings adoption, Stories 0.i6b/0.i6c, are not yet built), so the caller-side guard change (Task 4) has no second call site to break. The two new optional label fields (`unknownAccountLabel` on both `SubscribedAccountCardProps.labels` and `EventDetailViewLabels`) keep `apps/web/src/features/events/mapper.test.ts`'s hand-written `LABELS` fixture compiling unmodified, matching the exact precedent Story 0.i6f's Task 5 already established.
- **Verification checks:** `packages/ui`/`apps/web` type-check clean; the new/updated tests in Task 6, including the rewritten `EventDetailView.test.tsx` guard test; manual confirmation that `mapper.test.ts` compiles unmodified.

### Project Structure Notes

- **New files:** `packages/ui/src/core/account-identity.ts`.
- **No `packages/domain` change:** `getAccountIdentityLabel` is UI display-text formatting for two `packages/ui` components, not portable cross-runtime business logic — correctly placed in `packages/ui/src/core/`, matching this project's stated domain-agnostic-UI vs. pure-business-logic package split.
- **No `apps/backend` change, no new GraphQL surface, no new npm dependency.**
- **No new state management, no new URL param, no new Zustand store.**
- **i18n:** one new optional label (`unknownAccountLabel`), both locales, existing `EventDetailsPage` namespace, existing `mapper.ts` wiring pattern — no new i18n mechanism, matches Story 0.i6f's Task 6/7 precedent exactly.
- **No cloud/external service setup:** `SETUP_WALKTHROUGH.md` unaffected.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0.i6, Story 0.i6a] (this story's home; original AC text and the 2026-09-15 Update note narrowing remaining scope to BUG-005's degenerate-input fallback)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#BUG-005] (`DW-006, DW-010, DW-015` — the evidence bundle this story resolves)
- [Source: _bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml#DW-006, #DW-010, #DW-015] (original edge-case evidence: AccountAvatar alt-text fallback, `EventDetailView.tsx`'s all-or-nothing guard, `SubscribedAccountCard`'s degenerate-input rendering)
- [Source: packages/ui/src/core/account-avatar.tsx, account-avatar.test.tsx] (current fallback implementation and full existing 11-test suite, read in full)
- [Source: packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx, .types.ts, SubscribedAccountCard.test.tsx] (current card implementation and tests, read in full)
- [Source: packages/ui/src/features/events/EventDetailView.tsx, .types.ts, EventDetailView.test.tsx] (the live caller and its all-or-nothing guard, read in full; existing test at lines 485-497 being rewritten)
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx] (confirms `EventDetailView` is rendered on the real event-detail page, line 623)
- [Source: apps/web/src/features/events/mapper.ts, mapper.test.ts] (confirms `accountName`/`accountUsername`/`accountPlatform`/`accountHref` are already `string | null` at the true data source, lines 117-124; label-wiring target)
- [Source: apps/web/locales/en.json, id.json#EventDetailsPage] (existing label keys and both locales' current parity, new key added alongside)
- [Source: _bmad-output/implementation-artifacts/0-i6f-platform-icon-fallback-and-functional-subscribe-unsubscribe-toggle.md] (sibling story in the same epic; structural and Gate-documentation precedent followed here)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/ui/core` vs. `packages/domain` placement, confirmed above); i18n convention (`labels`-prop-with-English-default pattern, not direct `next-intl` in `packages/ui`)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 run fresh, all no-gap (Architecture & UX Gate Findings above)
- [x] `docs/infrastructure/index.md` — no infra change in this story; read to confirm none was needed

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/ui/src/core/account-identity.ts` (new) — shared fallback-label helper (Task 1).
  - `packages/ui/src/core/account-avatar.tsx`, `.test.tsx` — use shared helper, widen `platform` nullability, new regression tests (Task 2).
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx`, `.types.ts`, `.test.tsx` — graceful-fallback rendering, widened types, `unknownAccountLabel` (Task 3, Task 6).
  - `packages/ui/src/features/events/EventDetailView.tsx`, `.types.ts`, `.test.tsx` — loosened guard, `canActOnSubscription` gating, `unknownAccountLabel` threading, rewritten guard test (Task 4, Task 6).
  - `apps/web/src/features/events/mapper.ts` — new label wiring (Task 5).
  - `apps/web/locales/en.json`, `id.json` — new translation key (Task 5).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/2/3 → run fresh (no epic readiness report for Epic 0.i6), all three no-gap (Architecture & UX Gate Findings).
  - Data Type Compatibility rule (this workflow) → dedicated section above; a real mismatch found and fixed (the story's core defect), not just a "no changes required" formality.
  - Reusable-function rule (this workflow) → `account-identity.ts` extraction explicitly evaluated for `packages/domain` vs. `packages/ui/core` placement and justified (Project Structure Notes).
- **Verification Plan:**
  - `pnpm --filter ui test` (`vitest run`) — `account-avatar.test.tsx`, `SubscribedAccountCard.test.tsx`, `EventDetailView.test.tsx` (existing + new cases) all green.
  - `pnpm --filter web test` — `mapper.test.ts` unmodified, still compiles/passes.
  - `tsc`/lint clean for `packages/ui` and `apps/web`.
  - Manual/integration sanity: on a seeded event whose `sourceSocialMediaAccountProfile` has only a partial profile (e.g. `accountId`+`platform` but no `username`), confirm the account card still renders with a graceful fallback and a disabled toggle, instead of the block vanishing entirely as it does today.

## Pre-Coding Approval Gate

- [x] Scope confirmation — Tasks 1-6 match the scope confirmed with the user via `AskUserQuestion` during story creation: full DW-015 fallback set (not just the epics.md AC's literal displayName/avatar wording) + the `EventDetailView.tsx` caller-guard fix, in this same story.
- [x] Architecture and boundary confirmation — no `packages/domain`/`apps/backend` change (Project Structure Notes); Gate 1/2/3 all no-gap (Architecture & UX Gate Findings).
- [x] Testing plan confirmation — Task 6 covers every widened prop, the rewritten guard test's three sub-cases, and the new `labels.unknownAccountLabel` override.
- [ ] **Explicit human approval state (Default: pending approval)** — scope questions were resolved during story creation; final go-ahead to begin implementation is still pending and should be confirmed at `bmad-dev-story` time, per this workflow's default.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three run fresh this session, all three no-gap.

## Testing Requirements

- [ ] Unit tests — `packages/ui/src/core/account-avatar.test.tsx` (updated + new empty-string cases).
- [ ] Unit tests — `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` (updated + new fallback/accountHref cases).
- [ ] Unit tests — `packages/ui/src/features/events/EventDetailView.test.tsx` (rewritten guard test + unaffected existing tests still green).
- [ ] Integration/regression check — `apps/web/src/features/events/mapper.test.ts` confirmed to compile/pass unmodified.
- [ ] E2E tests — not required; this is a presentational fallback-rendering fix with no new user flow, matching this component family's existing E2E-not-required precedent (Story 0.i6f).
- [ ] Migration verification — not applicable; no migration in this story.

## Deliverables Checklist

- [ ] `SubscribedAccountCard` renders a defined primary-text fallback for empty `displayName` (falls back to `@username`, then `"Unknown account"`/`labels.unknownAccountLabel`).
- [ ] `SubscribedAccountCard`'s secondary `@username` line never renders when `username` is empty, and never duplicates a `displayName`-less primary label.
- [ ] `SubscribedAccountCard` renders a non-interactive wrapper (no `<a>`) instead of a link when `accountHref` is empty/missing.
- [ ] `AccountAvatar`'s existing fallback behavior is unchanged, now backed by explicit empty-string regression tests.
- [ ] `EventDetailView.tsx`'s guard requires only `accountId`; the subscribe/unsubscribe toggle disables itself (not the whole card) when `accountPlatform`/`accountUsername` is missing.
- [ ] `SubscribedAccountCardProps`/`AccountAvatarProps` widened per AC 9; `packages/ui`/`apps/web` type-check clean.
- [ ] `unknownAccountLabel` wired through `SubscribedAccountCard` → `EventDetailView` → `mapper.ts` → `en.json`/`id.json`.
- [ ] All Task 6 test updates/additions passing; `mapper.test.ts` unmodified and still passing.

## Out of Scope

- **Story 0.i6b/0.i6c/0.i6d/0.i6e's own adoption/token work** (Post Selection, Subscribed Accounts settings, `AccountAvatar` border tokens, location-link variant) — untouched; this story only finishes the card's own contract.
- **FIND-011's `EventDetailView` unused-prop cruft** — explicitly flagged as a fractional, out-of-scope member of FIND-011 in epics.md's existing Story 0.i6a note; not addressed here.
- **`AccountAvatar`'s alt-text default localization** — deliberately left as its existing unlocalized `'User avatar'` string (no `labels` prop added to `AccountAvatar`); see Dev Notes for the reasoning. Only the new, visible `SubscribedAccountCard` primary-label fallback gets the `labels`-prop treatment.
- **`accountPlatformIconUrl`/`profileImageUrl` naming clarity** — pre-existing minor misnomer noted in Story 0.i6f's own Dev Notes/Out of Scope; not touched here either.
- **Any broader "shared-account-info" context/variant prop work** (0.i6c's future scope for a list-vs-detail surface distinction) — untouched.

## Definition of Done

- [ ] AC 1-9 satisfied.
- [ ] Required tests passing (Task 6 + Testing Requirements).
- [ ] Lint and type checks passing for `packages/ui` and `apps/web`.
- [ ] Pre-Coding Approval Gate's explicit human approval state confirmed before this story is marked done.

## Completion Status

- [ ] Not started — story created and ready for `bmad-dev-story`.

## Dev Agent Record

### Agent Model Used

_To be filled in by `bmad-dev-story`._

### Debug Log References

_To be filled in by `bmad-dev-story`._

### Completion Notes List

_To be filled in by `bmad-dev-story`._

### File List

_To be filled in by `bmad-dev-story`._

## Change Log

- 2026-09-16: Story created via `bmad-create-story`. Gate 1/2/3 run fresh (no epic readiness report exists for Epic 0.i6) — all three no-gap. User confirmed via `AskUserQuestion`: (1) cover the full DW-015 fallback evidence set (empty displayName/username, missing avatar, empty/missing accountHref), not just the epics.md AC's literal displayName/avatar wording; (2) fix `EventDetailView.tsx`'s DW-010 all-or-nothing caller guard in this same story, once it was confirmed live/production-reachable rather than stale. Explicit human approval to begin implementation left pending per this workflow's default, to be confirmed at `bmad-dev-story` time.
