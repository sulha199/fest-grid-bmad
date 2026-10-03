---
baseline_commit: 81957a5411261abafef0f0f6944be1dc65aac4a9
---

# Story 0.i6c: Adopt the card into Subscribed Accounts settings, and settle the detail-surface variant

## Story Details

- Epic: 0.i6 (SubscribedAccountCard improvement epic)
- Story ID: 0.i6c
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the Subscribed Accounts settings list to render through `SubscribedAccountCard` while keeping its shipped `SwipeToReveal`+`Trash2` delete affordance, plus a `variant` prop so list context gets the swipe-to-reveal delete (no in-card toggle) and detail context keeps the subscribe/unsubscribe toggle, plus an optional `showPlatformBadge` prop so adopting the card drops none of the settings list's existing information,
so that the settings list's shipped convention is not disturbed, the detail-surface convention (a separate, narrower question, settled for Story 0.i6g's future benefit) is settled by a props decision rather than by picking one convention to win across both surfaces, and FIND-012's Subscribed-Accounts-settings half closes with zero information regression (FIND-012).

## Acceptance Criteria

1. **AC1 — Settings list adopts the card; shipped delete affordance unchanged.** Given the Subscribed Accounts settings list (`apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx`), when it adopts `SubscribedAccountCard` for its per-subscription row identity block, then it keeps its shipped `SwipeToReveal` + `Trash2` delete affordance, its explicit visible delete button, its `removeSubscription` mutation call, and its `useSoftDeleteWithUndo` undo-toast flow exactly as today — none of this is replaced or routed through the card (the card has no delete affordance of its own and this story does not add one).
2. **AC2 — New `variant` prop selects the toggle, consumed by Story 0.i6g.** Given `SubscribedAccountCard` receives a new optional `variant?: 'detail' | 'list'` prop (default `'detail'`), when `variant="list"`, then the card renders **without** its internal subscribe/unsubscribe icon-toggle button at all (no button in the DOM — not merely disabled; `isSubscribed`/`onSubscribe`/`onUnsubscribe`/`isStatusLoading`/`isTogglePending` have no effect in this variant) and renders only its identity block (avatar + primary label + secondary line); when `variant` is omitted or `'detail'`, rendering is pixel-identical to today — the toggle renders exactly as it does now. This is the context/variant prop Story 0.i6g's event/post-detail coauthor-attribution surface will consume (passing `variant="detail"`) once it is built.
3. **AC3 — New `showPlatformBadge` prop, no information regression (user-decided).** Given `SubscribedAccountCard` receives a new optional `showPlatformBadge?: boolean` prop (default `false`/undefined), when `true` and `account.platform` is present, then a platform-name pill renders immediately next to the primary label — `getPlatformDisplayName(account.platform)` (`@festgrid/domain/scraper`), styled with the exact classes already shipped today in `subscriptions-content.tsx` (`text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full shrink-0`); when `false`/omitted, or `account.platform` is absent, no pill renders. The Subscribed Accounts settings list turns this prop **on**; every detail-context caller (`EventDetailView.tsx`, and Story 0.i6g once built) leaves it **off**, so today's pixel-identical detail-context rendering (no platform pill there today) is unaffected.
4. **AC4 — Settings list: zero information regression end to end.** Given the Settings list renders each row through `SubscribedAccountCard` with `variant="list"` and `showPlatformBadge`, when it renders, then every piece of information the row shows today is still shown: the avatar (now additionally platform-icon-aware per Story 0.i6f's already-shipped `AccountAvatar` fallback — a positive side effect of routing through the shared contract, not a new/different piece of information), the primary `displayName`/`username` label (now using Story 0.i6a's own dedup'd fallback chain — this fixes a latent inconsistency rather than introducing one: today's inline markup can show a bare `{displayName || username}` heading *and* a separate unconditional `@{username}` line even when `displayName` is empty, which the card's single-source-of-truth label logic already does not do), the platform pill (AC3), the `@{username}` secondary line (card's existing fallback — the new optional `location` prop from Story 0.i6e is **not** passed here, so this path is exactly Story 0.i6e's own AC5/AC2 "other adoption sites unaffected" guarantee), and the existing `defaultLocation`/"Set Default Location"/edit-with-pending-review affordance (`AccountLocationField`/`SetDefaultLocationDialog`) and the `pendingExtractionCount` badge, both continuing to render as independent, page-owned elements positioned around the adopted card rather than absorbed into it.
5. **AC5 — No layout/truncation regression.** Given a long `displayName`/`username`, when the card renders with `showPlatformBadge` inside the Settings list's row width, then the primary label still truncates correctly alongside the now-adjacent platform pill — matching the identical `truncate` + `shrink-0`-pill layout pattern already proven working in this exact file today (this story relocates, not redesigns, that pattern).
6. **AC6 — No `accountHref`; outer row keeps owning navigation.** Given the Settings list does not pass an `accountHref` to the card (its row-level `onClick`/`onKeyDown`/`tabIndex`/`aria-label` already own click-to-navigate and keyboard access, unchanged by this story), when the card renders, then it renders its existing non-interactive wrapper (no nested `<a>`) exactly as already covered by `SubscribedAccountCard.test.tsx`'s existing accountHref-absent case, and the outer row's navigation continues to work unchanged (including its existing swipe-vs-click pointer-disambiguation logic).
7. **AC7 — Detail-context call site stays pixel-identical.** Given `EventDetailView.tsx`'s existing (sole production) detail-context call site, when this story ships, then its rendering is pixel-identical to before: default `variant` (`'detail'`) keeps the subscribe/unsubscribe toggle exactly as today, and `showPlatformBadge` stays omitted (no new pill). This story explicitly passes `variant="detail"` at that call site for self-documentation (matching how Story 0.i6g will reference "the detail-context variant"), which is a no-op against the default and must not change any existing `EventDetailView.test.tsx`/`EventDetailWrapper.test.tsx` assertion.

## Tasks / Subtasks

- [x] **Task 1 — Add `variant` prop to `SubscribedAccountCard`** (AC: #2, #7)
  - [x] Add `variant?: 'detail' | 'list'` to `SubscribedAccountCard.types.ts` (default `'detail'` applied in the component, not via a TS default type).
  - [x] In `SubscribedAccountCard.tsx`, wrap the existing right-hand toggle `<button>` block in a `variant !== 'list'` (i.e. default/`'detail'`) condition — when `'list'`, render nothing in that slot (not a disabled button, not an empty wrapper `div` that would still take up layout space; confirm no stray empty node remains that would affect the `flex items-center justify-between` row's spacing).
  - [x] Leave every other prop/behavior (`isSubscribed`, `onSubscribe`, `onUnsubscribe`, `isStatusLoading`, `isTogglePending`, `labels.*`) exactly as-is for `variant: 'detail'`/default — this is a pure additive conditional, not a refactor of the toggle's own logic.
- [x] **Task 2 — Add `showPlatformBadge` prop to `SubscribedAccountCard`** (AC: #3, #5)
  - [x] Add `showPlatformBadge?: boolean` to `SubscribedAccountCard.types.ts`.
  - [x] Import `getPlatformDisplayName` from `@festgrid/domain/scraper` (same import path `subscriptions-content.tsx` already uses) and a type for the cast (match the existing `as any`/`ScrapablePlatform` cast pattern already used at that call site — do not introduce a stricter type than `account.platform`'s own `string | null | undefined` actually supports without also fixing the type elsewhere, which is out of scope here).
  - [x] Restructure the primary-label `<span>` so it sits inside a `flex items-center gap-2 min-w-0` row alongside the new conditional pill `<span>` (`showPlatformBadge && account.platform`), using the exact classes `text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full shrink-0` already shipped in `subscriptions-content.tsx` today. Preserve `truncate`/`title={primaryLabel}` on the label span itself, and confirm (visually or via a DOM/class assertion in the new test) that truncation still works correctly with the pill as a sibling (AC5) — the existing `min-w-0`/`truncate`/`shrink-0` combination is already proven in production in this exact file, so this is a relocation, not new layout work.
- [ ] **Task 3 — Adopt the card into `subscriptions-content.tsx`** (AC: #1, #4, #5, #6)
  - [ ] Replace the row's inline `<AccountAvatar>` + `<h3>`/platform-pill/`@username` block with `<SubscribedAccountCard account={{ accountId: sub.account.accountId, platform: sub.account.platform, displayName: sub.account.displayName, username: sub.account.username, profileImageUrl: sub.account.profileImageUrl }} isSubscribed={false} variant="list" showPlatformBadge size="sm" />` (no `accountHref`, no `location` — see AC4/AC6; `isSubscribed={false}` is inert in `variant="list"` since the toggle never renders, but the prop is still required by `SubscribedAccountCardProps` — pass a literal `false` rather than deriving real subscription state, since this page's subscriptions list is itself the set of subscribed accounts and has no separate "is this one subscribed" signal to compute).
  - [ ] Restructure the row so the existing `defaultLocation`/"Set Default Location" block (today nested inside the same `<div className="min-w-0 flex-1">` as the avatar/name markup it replaces) and the `pendingExtractionCount` badge continue to render in their current visual position relative to the identity block — wrap the card and the location block together in the row's existing `min-w-0 flex-1` column (card on top, location/edit affordance below, matching today's vertical order) so the row's overall layout is unchanged; the `pendingExtractionCount` badge and the explicit `Trash2` delete button stay in their existing right-hand `shrink-0` group, untouched.
  - [ ] Confirm `sub.account.accountId` (not `sub.account.id`, a separate DB primary key used elsewhere for dialog state) is the field mapped into `SubscribedAccountCardProps.account.accountId` — verified against `GetMySubscriptionsQuery`'s generated type (`apps/web/src/generated/graphql.ts`), which has both `id` and `accountId` on `account` as distinct fields.
- [x] **Task 4 — Explicit `variant="detail"` at the existing detail-context call site** (AC: #7)
  - [x] In `packages/ui/src/features/events/EventDetailView.tsx`'s existing `SubscribedAccountCard` render call, add `variant="detail"` explicitly (a no-op against the new default, added only so the call site self-documents as "the detail-context variant" the way Story 0.i6g's epics.md note already refers to it). Do not change any other prop at this call site.
- [x] **Task 5 — Tests: `SubscribedAccountCard.test.tsx`** (AC: #2, #3, #5, #6, #7)
  - [x] New `describe('variant prop (Story 0.i6c)')` block: `variant="list"` renders no `subscribe-toggle` element (`queryByTestId('subscribe-toggle')` is null) regardless of `isSubscribed`/`onSubscribe`/`onUnsubscribe`; default (omitted) and explicit `variant="detail"` both keep every existing toggle test passing unmodified (run the existing suite, do not rewrite its assertions).
  - [x] New `describe('showPlatformBadge prop (Story 0.i6c)')` block: `showPlatformBadge: true` + `account.platform: 'instagram'` renders the `getPlatformDisplayName('instagram')` text (`"Instagram"`); `showPlatformBadge: false`/omitted renders no such pill even with `platform` present; `showPlatformBadge: true` with `account.platform` absent/null renders no pill (no crash); the primary-label `<span>` keeps its `truncate` class with the pill present (AC5 regression guard).
  - [x] Confirm no existing test in this file needs modification — both new props are purely additive and default-off/default-to-today's-behavior.
- [ ] **Task 6 — Tests: `subscriptions-content.test.tsx`** (AC: #1, #4, #6)
  - [ ] Confirm every existing assertion in this file still passes unmodified after adoption (`getByText('Jakarta Festivals')`, `getByText('@jkt_festivals')`, `getByText('Set Default Location')`, `getByText('Jakarta, Indonesia')`, `getByText('Pending Review')`, the row-click-navigates-but-not-on-button-click test, the swipe/delete/undo flow) — these already exercise AC1/AC4/AC6 end to end; no new mocking of `@festgrid/ui` is introduced (the real `SubscribedAccountCard` renders, matching how this suite already renders the real `AccountLocationField`/`SwipeToReveal` today).
  - [ ] Add one assertion confirming the platform pill's existing visible text (`"Instagram"`/`"Twitter/X"`, from the two seeded mock subscriptions) is still present after adoption — this suite's current assertions don't explicitly check for it, so add the check now rather than leave AC3/AC4's "no information regression" guarantee untested at the integration level.
- [x] **Task 7 — Tests: `EventDetailView.test.tsx`/`EventDetailWrapper.test.tsx` regression check** (AC: #7)
  - [x] Run both suites unmodified and confirm all existing assertions (including the `subscribe-toggle` aria-pressed/aria-label cases) still pass after Task 1/Task 4's changes — no test file edits expected here; if any assertion needs to change, that is a signal Task 1/Task 4 introduced an unintended behavior change and must be fixed, not the test.
- [ ] **Task 8 — Verification** (AC: all)
  - [ ] `pnpm --filter ui test` and `pnpm --filter web test` green.
  - [ ] `pnpm --filter ui lint` / `pnpm --filter web lint` and `tsc` clean for both packages.
  - [ ] `pnpm build` clean (no new type errors introduced by the widened `SubscribedAccountCardProps`).

## Dev Notes

- **Scope: `packages/ui/src/features/subscriptions` + `packages/ui/src/features/events/EventDetailView.tsx` (one-line, no-op prop addition) + `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx`.** No `packages/domain` change, no `apps/backend` change, no database migration, no new GraphQL SDL/query/mutation, no new npm dependency, no codegen run needed (no `.graphql` document changes anywhere in this story).
- **Current code state (read in full before drafting this story):**
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` (109 lines, post-Story-0.i6a/0.i6e/0.i6f) — always renders its subscribe/unsubscribe icon-toggle button (lines 87-106); the primary-label `<span>` (line 54) has no sibling pill today; no `variant`/`showPlatformBadge` prop exists yet.
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts` (29 lines) — `account.platform?: string | null`, `accountHref?: string | null`, `location?: {...} | null` (Story 0.i6e). No `variant`/`showPlatformBadge` field yet.
  - `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx` (331 lines) — the row (lines 228-301) hand-rolls its own `AccountAvatar` + `<h3>{displayName || username}</h3>` + platform pill (`text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full shrink-0`, line 248) + `@{username}` line (unconditional, line 252-254) + `AccountLocationField`/"Set Default Location" block (lines 255-279, nested inside the same `min-w-0 flex-1` column as the identity markup) — all inside a `SwipeToReveal` wrapper with its own `Trash2` action and an explicit visible delete button in the row's right-hand `shrink-0` group (lines 283-300), alongside a `pendingExtractionCount` badge. `AccountAvatar` is called here **without** a `platform` prop, so today's Settings-page fallback avatar is the generic `InstagramPlaceholder`, not Story 0.i6f's platform-icon fallback — adopting the card (which internally threads `account.platform` into `AccountAvatar`) wires up Story 0.i6f's fix here for the first time, a positive side effect of the ratchet this epic exists to enforce (Story 0.i6z), not a regression to guard against.
  - `packages/ui/src/features/events/EventDetailView.tsx` (lines 269-299) — the one real production caller of `SubscribedAccountCard` today (confirmed via repo-wide grep: no other `apps/web`/`packages/ui` production file imports it). Calls it with `size="sm"`, no `variant`, no `showPlatformBadge`, no `accountHref` omission (passes a real `accountHref`) — this is the "detail context" the new `variant` default must keep pixel-identical.
  - `packages/ui/src/core/account-avatar.tsx` — already threads `platform` into `PlatformIcon` for its fallback (Story 0.i6f); unaffected by this story beyond receiving `platform` from one more call site (via the card, in Settings) than it does today.
  - `@festgrid/domain/scraper`'s `getPlatformDisplayName(platform: ScrapablePlatform): string` (`packages/domain/src/scraper/platform-registry.ts`) is pure (no DB/Node/ORM dependency) and already imported this exact way by `subscriptions-content.tsx` today; `packages/ui` already imports other pure functions from `@festgrid/domain`/`@festgrid/domain/geolocation` elsewhere (`LocationLink.tsx`'s `isLocationTrustworthy`, `EventDetailView.tsx`'s own `detectPlatformFromUrl` import from `@festgrid/domain`), so importing `getPlatformDisplayName` from `@festgrid/domain/scraper` directly into `SubscribedAccountCard.tsx` introduces no new cross-package dependency pattern.
- **Why the toggle is suppressed entirely in `variant="list"`, not just hidden behind missing handlers.** The card already renders a *disabled* toggle when `onSubscribe`/`onUnsubscribe` are both omitted (existing test: "disables the button when onSubscribe is not provided"). That is a different situation from `variant="list"` — a disabled-but-present button still occupies layout space and is still announced to assistive tech as an interactive (if disabled) control, which would misrepresent the Settings row (it has no subscribe/unsubscribe concept at all; its only destructive action is the swipe/delete affordance). `variant="list"` must therefore omit the button from the DOM entirely, not merely leave its handlers unset.
- **Why `isSubscribed={false}` is passed as a literal in Settings rather than computed.** `SubscribedAccountCardProps.isSubscribed` is a required `boolean`. In `variant="list"` it has no rendering effect (the toggle never renders), but the prop must still be supplied to satisfy the type. The Settings list's own data (`mySubscriptions`) has no independent "is this one subscribed" signal to compute — every row shown *is* a subscription — so a literal `false` is the correct, honest value (not a stand-in for "not subscribed," just an inert placeholder for a prop this variant ignores).
- **`showPlatformBadge` and `variant` are independent, orthogonal props** — Settings uses `variant="list"` + `showPlatformBadge`; a hypothetical future caller could use `variant="detail"` + `showPlatformBadge` (showing both the toggle and the pill) without this story needing to anticipate that combination specially, since each prop's conditional is independent JSX.
- **Scope decision confirmed with the user before story creation (not re-asked here):** the platform-badge mechanism is an optional `showPlatformBadge` presentational prop on `SubscribedAccountCard` itself (rendering the existing pill via `getPlatformDisplayName`), turned on by the Settings list and left off by detail-context callers — explicitly chosen over alternatives (e.g. a page-local wrapper component duplicating the pill outside the card) to keep the single-component contract this epic exists to enforce, and to guarantee "no information regression" as a property of the card's own tested contract rather than of each caller separately remembering to add the pill back.

### Architecture & UX Gate Findings

- **No epic readiness report exists for Epic 0.i6** (`_bmad-output/planning-artifacts/epic-readiness/` has reports for Epics 0, 0.i7, 1, 1.i1, 2-7, but none for `epic-0-i6` — the same situation already documented by sibling Stories 0.i6a, 0.i6e, and 0.i6f for this same epic). Gate 1, 2, and 3 were run **fresh** via one-shot subagent dispatch this session (full relevant source/UX-spec excerpts inlined directly into each subagent's prompt, not re-read cold), per the user's explicit instruction that this UI story run Gate 2 fresh.
- **Gate 1 (Architecture/Infrastructure Completeness), run fresh — No gap.** Verdict: purely presentational — no DB/ORM/backend-only dependency called from `apps/web`/`packages/ui` (both `getPlatformDisplayName` and the pre-existing `isLocationTrustworthy` are pure, dependency-free functions already imported this exact way elsewhere); no external/third-party service called from the frontend; no new API surface (the existing `removeSubscription`/`useGetMySubscriptionsQuery` are reused unmodified, nothing added to the GraphQL schema/resolvers); no auth/authorization/secrets/business-rule logic introduced; no new infra/IaC dependency. The `variant="list"` change is a strict *reduction* of rendered behavior (the card renders less than it does today, conditionally), not new data flow.
- **Gate 2 (UI Complexity & Reusability), run fresh — No gap.** `SubscribedAccountCard` is an existing, already-shipped, already-adopted reusable component (not a new one being built here) — this epic's established pattern (0.i6a/0.i6d/0.i6e/0.i6f) is exactly "one focused capability added per story," which this story continues. Checked against both authoritative UX docs: `DESIGN.md` has no `subscribed_account_card_*`/card-family token for this component (confirmed: it has never been token-specified, consistent with Stories 0.i6a's/0.i6e's identical findings); the platform pill being relocated into the card is an exact, pixel-for-pixel copy of markup/classes already live in production today, not new design; `EXPERIENCE.md`'s only on-point precedent (`AccountLocationField`'s extraction, "this pass only extracts the existing inline markup into the shared component, no visual change") explicitly sanctions this exact move one layer up the tree. No new hook/util, no new image/media, no new loading/empty/error state beyond what the card already has.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness), run fresh — No gap.** No global app-shell/layout change (Settings page stays inside the existing `AppShell`/`TabbedShell`, Story 0.29, unchanged); no i18n foundation work (the platform-pill text comes from the existing, already-used-elsewhere `getPlatformDisplayName`, not new translatable copy — no new locale key in either `en.json`/`id.json`); no analytics/observability foundation touched (the existing `subscription_removed` PostHog capture in `subscriptions-content.tsx` is untouched; no new tracked event); no GraphQL Code Generator pipeline change (no `.graphql` document edits, no schema/resolver change); no named "mandated utility" being introduced. The `variant` prop is this story's own scoped purpose (already anticipated in `epics.md`'s Story 0.i6c text as a direct prerequisite for the same-epic sibling Story 0.i6g), not a project-wide dependency other unrelated epics would need to stand up.
- **Lightweight guard:** reasoned over the full scope above for anything a hypothetical epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new cross-cutting tooling gap. Nothing here warrants a second Gate 1/3 pass.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found.** This story adds two new optional, hand-written TypeScript fields to `SubscribedAccountCardProps` (`variant?: 'detail' | 'list'`, `showPlatformBadge?: boolean`) — both purely presentational, UI-local flags with no backing database column, GraphQL field, or API contract of any kind. No existing field's type changes.
- **Impacted fields/contracts:** `SubscribedAccountCardProps` gains `variant?: 'detail' | 'list'` and `showPlatformBadge?: boolean` (both optional, both additive — no existing field narrowed or widened). No GraphQL SDL, resolver, or DB schema field changes anywhere.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** The two new optional fields above, in `SubscribedAccountCard.types.ts` only. No codegen run needed (no `.graphql` document changes anywhere in this story).
- **Backward compatibility and rollout notes:** Both new props are optional with behavior-preserving defaults (`variant` defaults to `'detail'`, matching every existing caller's current behavior with zero code change required at those call sites; `showPlatformBadge` defaults to off, matching every existing caller's current zero-pill rendering). `SubscribedAccountCard` has exactly one real production consumer today (`EventDetailView.tsx`) and this story adds the second (`subscriptions-content.tsx`); the first consumer requires no prop changes to keep working (this story adds `variant="detail"` there only for self-documentation, a no-op).
- **Verification checks:** `packages/ui`/`apps/web` type-check clean; Task 5-7's test suites (existing + new) all green, specifically proving the default-behavior-unchanged claim for the existing `EventDetailView`/`EventDetailWrapper` call site.

### Project Structure Notes

- **No new files.** All changes are to existing files: `SubscribedAccountCard.tsx`/`.types.ts`/`.test.tsx`, `EventDetailView.tsx` (one line), `subscriptions-content.tsx`, `subscriptions-content.test.tsx`.
- **No `packages/domain` change, no `apps/backend` change, no new GraphQL surface, no new npm dependency.**
- **No new state management** (no new React Query/nuqs/zustand usage) — both new props are plain render-time conditionals, not state.
- **No new async process / loader categorization needed** — this story introduces no new asynchronous operation; the existing subscriptions query/mutations and their existing skeleton/blocking-loader treatment in `subscriptions-content.tsx` are untouched.
- **No i18n keys needed** — `getPlatformDisplayName`'s returned strings ("Instagram"/"Twitter/X") are pre-existing, already-unlocalized hardcoded English strings reused verbatim from production code already shipping them this way; this story introduces no new user-facing copy of its own.
- **No PostHog/analytics event needed** — no new user-triggerable interaction is added; `variant="list"` removes a control (the toggle) from one surface rather than adding one, and the existing `subscription_removed` capture is untouched.
- **No cloud/external service setup** — `SETUP_WALKTHROUGH.md` unaffected.
- **Reusable-component placement:** `SubscribedAccountCard` already lives in `packages/ui/src/features/subscriptions/` — both new props extend its existing contract in place; no extraction to a new component or to `packages/domain` applies here (both additions are UI-only conditional rendering, not portable business logic).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0.i6, Story 0.i6c] (this story's home; original AC text and the 2026-09-18 Update note confirming the variant prop is a direct 0.i6g prerequisite)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0.i6, Story 0.i6g] (consumer of the `variant="detail"` contract this story settles)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#FIND-012] (`DW-012, DW-013` — "SubscribedAccountCard still not wired into Post Selection or Subscribed Accounts settings"; this story closes the Settings half)
- [Source: _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md] (Wave 4A sequencing context: 0.i6c -> 3.16 -> 0.i6g before Story 3.6u)
- [Source: packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx, .types.ts, .test.tsx] (current card implementation and full existing test suite, read in full)
- [Source: packages/ui/src/features/events/EventDetailView.tsx] (the one existing production detail-context caller, read in full, lines 269-299)
- [Source: apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx, .test.tsx] (current Settings list implementation and its existing test suite, read in full)
- [Source: packages/ui/src/core/account-avatar.tsx] (confirms `platform` threading into the already-shipped Story 0.i6f fallback)
- [Source: packages/domain/src/scraper/platform-registry.ts] (`getPlatformDisplayName`, pure function, no DB/Node dependency)
- [Source: apps/web/src/generated/graphql.ts#GetMySubscriptionsQuery] (confirms `account.accountId` vs `account.id` field distinction used in Task 3)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] (full file read; no `subscribed_account_card_*`/card-family token exists for this component)
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Account Location Field] (precedent for "extract existing inline markup into a shared component, no visual change")
- [Source: _bmad-output/implementation-artifacts/0-i6a-finish-the-subscribedaccountcard-accountavatar-contract.md] (the card's base contract this story extends; structural/Gate-documentation precedent followed here)
- [Source: _bmad-output/implementation-artifacts/0-i6e-replace-the-cards-raw-account-identifier-line-with-a-location-link-when-confirmed.md] (AC5's "other adoption sites unaffected" guarantee, directly relied on by this story's AC4)
- [Source: _bmad-output/implementation-artifacts/0-i6f-platform-icon-fallback-and-functional-subscribe-unsubscribe-toggle.md] (the already-shipped `AccountAvatar` platform-icon fallback this story's adoption newly wires up in Settings as a side effect)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/ui/features/subscriptions` placement, confirmed above); UI Components & Scalability (reusable component stays in `packages/ui`); no i18n/analytics/state-management rule triggered (Project Structure Notes)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 run fresh, all three no-gap (Architecture & UX Gate Findings above)
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD touched (purely presentational, no data/API/infra change)
- [x] `docs/infrastructure/index.md` — no infra change in this story; read to confirm none was needed

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts` — add `variant?: 'detail' | 'list'`, `showPlatformBadge?: boolean` (Task 1, 2).
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` — conditional toggle suppression for `variant="list"`; conditional platform pill next to the primary label (Task 1, 2).
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` — new `variant`/`showPlatformBadge` test blocks (Task 5).
  - `packages/ui/src/features/events/EventDetailView.tsx` — add `variant="detail"` to the existing call site (Task 4).
  - `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx` — adopt the card with `variant="list" showPlatformBadge`, restructure the identity/location column (Task 3).
  - `apps/web/src/app/[locale]/settings/account/subscriptions-content.test.tsx` — add platform-pill-still-visible assertion; confirm all else passes unmodified (Task 6).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/2/3 → run fresh (no epic readiness report for Epic 0.i6), all three no-gap (Architecture & UX Gate Findings).
  - Data Type Compatibility rule (this workflow) → dedicated section above; no mismatch found, two new optional presentational fields only.
  - Reusable-component rule (this workflow) → both additions stay inside `SubscribedAccountCard`'s existing `packages/ui/features/subscriptions` home; no new `packages/ui`/`packages/domain` extraction warranted (Project Structure Notes).
- **Verification Plan:**
  - `pnpm --filter ui test` (`vitest run`) — `SubscribedAccountCard.test.tsx` (existing 25+ cases unmodified and green, plus new `variant`/`showPlatformBadge` cases), `EventDetailView.test.tsx` unmodified and green.
  - `pnpm --filter web test` — `subscriptions-content.test.tsx` (existing cases unmodified and green, plus new platform-pill assertion), `EventDetailWrapper.test.tsx` unmodified and green.
  - `tsc`/lint clean for `packages/ui` and `apps/web`.
  - Manual/integration sanity: open `/settings/account?tab=subscriptions`, confirm each row still shows avatar, name, platform pill, `@username`/location line, default-location affordance, pending-extraction badge, and that swipe-to-reveal + explicit delete button + undo toast all still work; confirm the event-detail page's subscribe/unsubscribe toggle is unchanged.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Tasks 1-8 match the two user-decided mechanisms (optional `showPlatformBadge` presentational prop; FIND-012 promotion/carve handled at completion, see `on_complete`) plus the epics.md-specified `variant` prop.
- [ ] Architecture and boundary confirmation — no `packages/domain`/`apps/backend` change (Project Structure Notes); Gate 1/2/3 all no-gap (Architecture & UX Gate Findings).
- [ ] Testing plan confirmation — Tasks 5-7 cover the new `variant`/`showPlatformBadge` props, the Settings-list integration (including the new platform-pill assertion), and explicit regression coverage of the one existing detail-context call site.
- [x] **Explicit human approval state (Default: pending approval)** — scope questions were resolved during story creation (platform badge mechanism, FIND-012 promotion handling); approved by user at `bmad-dev-story` time on 2026-10-03.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three run fresh this session, all three no-gap.

## Testing Requirements

- [ ] Unit tests — `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` (new `variant`/`showPlatformBadge` cases; existing suite unmodified and green).
- [ ] Unit tests — `packages/ui/src/features/events/EventDetailView.test.tsx` (unmodified, confirmed still green after Task 4).
- [ ] Integration tests — `apps/web/src/app/[locale]/settings/account/subscriptions-content.test.tsx` (new platform-pill assertion; existing suite unmodified and green after adoption).
- [ ] Integration/regression check — `apps/web/src/features/events/EventDetailWrapper.test.tsx` confirmed to pass unmodified.
- [ ] E2E tests — not required; this is a presentational prop-addition + markup-consolidation story with no new user flow, matching this component family's existing E2E-not-required precedent (Story 0.i6a/0.i6f).
- [ ] Migration verification — not applicable; no migration in this story.

## Deliverables Checklist

- [ ] `SubscribedAccountCard` exposes `variant?: 'detail' | 'list'` (default `'detail'`); `'list'` omits the subscribe/unsubscribe toggle from the DOM entirely.
- [ ] `SubscribedAccountCard` exposes `showPlatformBadge?: boolean` (default off); when true + `account.platform` present, renders the existing platform pill next to the primary label with no truncation regression.
- [ ] `subscriptions-content.tsx`'s per-row identity block renders through `SubscribedAccountCard` (`variant="list"`, `showPlatformBadge`) with zero information regression (AC4) and its shipped `SwipeToReveal`+`Trash2` delete affordance, `pendingExtractionCount` badge, and `AccountLocationField`/"Set Default Location" affordance all unchanged (AC1).
- [ ] `EventDetailView.tsx`'s existing call site passes `variant="detail"` explicitly; its rendering remains pixel-identical to before (AC7).
- [ ] All Task 5-7 test updates/additions passing; `EventDetailView.test.tsx`/`EventDetailWrapper.test.tsx` unmodified and still passing.

## Out of Scope

- **Story 0.i6b (Post Selection adoption)** — untouched by this story; carved out as its own open backlog child row against FIND-012 at story completion (see `on_complete`/Change Log), since FIND-012 originally covered both Post Selection and Subscribed Accounts settings and only the latter is addressed here.
- **Story 0.i6d (`AccountAvatar` border tokens), Story 0.i6e (`location` prop — already shipped, review)** — untouched; this story only adds `variant`/`showPlatformBadge`.
- **Story 0.i6g (event/post-detail coauthor attribution UI)** — not built here; this story only settles the `variant` contract 0.i6g will consume once its own prerequisites (Story 3.15, Story 3.16) are also ready.
- **Any backend/data change to `account.platform`'s type** — the existing `as any`/loose-cast pattern for `ScrapablePlatform` is reused as-is, not hardened, matching today's production code at the same call site; hardening that type is a separate, unscoped concern.
- **Moderator-side `AccountLocationField` adoption (`/moderator/items`, Story 4.7, not yet built)** — unaffected; this story only touches the subscriber-settings call site.

## Definition of Done

- [ ] AC 1-7 satisfied.
- [ ] Required tests passing (Task 5-7 + Testing Requirements).
- [ ] Lint and type checks passing for `packages/ui` and `apps/web`.
- [ ] Pre-Coding Approval Gate's explicit human approval state confirmed before this story is marked done.

## Completion Status

- [ ] Not started — story created and ready for `bmad-dev-story`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-create-story, direct in-session story authoring).

### Debug Log References

### Completion Notes List

- Tasks 1, 2, 4, 5, 7 implemented and verified: `SubscribedAccountCard` gained `variant?: 'detail' | 'list'` (default `'detail'`, suppresses the subscribe/unsubscribe toggle entirely in DOM when `'list'`) and `showPlatformBadge?: boolean` (renders `getPlatformDisplayName(account.platform)` pill next to the primary label when true + platform present). `EventDetailView.tsx`'s existing call site now passes `variant="detail"` explicitly (no-op). New `variant prop (Story 0.i6c)` and `showPlatformBadge prop (Story 0.i6c)` describe blocks added to `SubscribedAccountCard.test.tsx` (8 new cases); full existing 21-case suite unmodified and green (29/29 total). `EventDetailView.test.tsx` (68/68) and `EventDetailWrapper.test.tsx` (44/44, 2 files) run unmodified and green — no regression. `pnpm --filter ui lint` clean.

### File List

- `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts` — added `variant?: 'detail' | 'list'`, `showPlatformBadge?: boolean`.
- `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` — conditional toggle suppression for `variant="list"`; conditional platform pill next to primary label.
- `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` — new `variant`/`showPlatformBadge` test blocks (8 new cases).
- `packages/ui/src/features/events/EventDetailView.tsx` — added explicit `variant="detail"` (no-op) at existing call site.

## Change Log

- 2026-10-03: Tasks 1, 2, 4, 5, 7 complete — `variant`/`showPlatformBadge` props added to `SubscribedAccountCard`, detail-context call site self-documented with explicit `variant="detail"`, new unit tests added, existing `EventDetailView`/`EventDetailWrapper` suites confirmed unmodified/green.
- 2026-10-03: Story created via `bmad-create-story`. Gate 1/2/3 run fresh (no epic readiness report exists for Epic 0.i6) — all three no-gap. Two mechanisms were decided by the user ahead of this session (not re-asked): (1) the platform-badge mechanism is an optional `showPlatformBadge` presentational prop on `SubscribedAccountCard` rendering the existing `getPlatformDisplayName` pill, turned on by the Settings list and left off by detail-context callers, with no information regression; (2) backlog FIND-012 is promoted against this story and a new child row is carved for the still-open Post Selection adoption (Story 0.i6b) — handled at story completion per `backlog-spec.md` §13. Explicit human approval to begin implementation left pending per this workflow's default, to be confirmed at `bmad-dev-story` time.
