---
baseline_commit: d996176
---
# Story 3.12: Consolidate Account Settings into a tabbed shell

## Story Details

- Epic: 3
- Story ID: 3.12
- Story Key: 3-12-consolidate-account-settings-into-a-tabbed-shell
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want API Keys, Subscribed Accounts, Posts, and Notifications consolidated into one tabbed "Account Settings" page (`/settings/account`), with the queue-status page's API-key-health banner and pending-extraction counts absorbed into the relevant tabs,
so that I manage my account in one place instead of navigating between five separate settings pages, matching the two-shell IA `EXPERIENCE.md` now documents (Component Patterns § Account Settings & Moderator Tools Shells).

## Acceptance Criteria

1. **Given** the existing, already-implemented `TabbedShell` primitive (`packages/ui/src/core/tabbed-shell/`, Story 0.29 — free navigation, no step-gating), **when** this story builds `apps/web/src/app/[locale]/settings/account/page.tsx` + `account-settings-content.tsx`, **then** it renders `<TabbedShell tabs={[...]} activeKey={tab} onTabChange={setTab} />` with four tabs in this order: **API Keys** (`ApiKeysContent`), **Subscribed Accounts** (`SubscriptionsContent`), **Posts** (`PostsSelectContent`), **Notifications** (`NotificationsContent`) — the four existing, already-implemented components, imported and rendered as-is (each is already prop-less, confirmed by direct inspection), with only the two absorption changes in AC5/AC6 below.
2. **And** the active tab is tracked via `nuqs`'s `useQueryState('tab', parseAsStringEnum([...]).withDefault('api-keys'))` (mirroring `favorites-content.tsx`'s existing `useQueryState` pattern — `NuqsAdapter` is already wired at the app root, no new dependency), owned by `account-settings-content.tsx` — `TabbedShell` itself receives only `activeKey`/`onTabChange` as plain props and has no `nuqs`/`next/navigation` dependency of its own (Story 0.29's established boundary).
3. **And** `page.tsx` follows the exact Server-Component pattern already used identically by `settings/api-keys/page.tsx` (and 4 other settings pages): `export const dynamic = 'force-dynamic'`, `generateMetadata({ params })` via `getTranslations({ locale, namespace: 'Metadata' })` + `buildPageMetadata({ title, description })` resolving `Metadata.accountSettingsTitle`/`accountSettingsDescription`, default export wraps `<AccountSettingsContent />` in `<Suspense fallback={<RouteLoader />}>` (`@festgrid/ui`).
4. **And** the four former standalone routes — `/settings/api-keys`, `/settings/subscriptions`, `/settings/notifications`, `/settings/queue-status` — are removed (their `page.tsx`/`*-content.tsx`/test files deleted; the content components themselves are **moved**, not duplicated, into `apps/web/src/app/[locale]/settings/account/` as the shell's tab content, since nothing else references them by their old import path). `/posts/select` is **not** removed — it stays reachable as its own standalone route in parallel with the new Posts tab (the proposal never calls for its removal, only the four settings routes above; `PostsSelectContent` is prop-less and self-contained, so the same component instance renders correctly at both `/posts/select` and inside the new shell with no duplication of logic, only of the render call site).
5. **And** the API-key-health banner from the dissolved `queue-status-content.tsx` (`hasInvalidKey = apiKeysList.some(k => !k.isValid)`, the yellow warning box, and the per-key `StatusBadge` list under "API Key Health") moves into the **API Keys** tab content, reusing `apiKeysList` data the API Keys tab already fetches — no new query.
6. **And** the pending-extraction-count per subscription (`sub.pendingExtractionCount`, already returned by `SubscriptionsContent`'s existing `useGetMySubscriptionsQuery`) is rendered inline on each subscription row in the **Subscribed Accounts** tab — no new query, just consuming a field of data already fetched.
7. **And** `TabbedShell` (`packages/ui/src/core/tabbed-shell/`) gains one new optional field on `TabbedShellTab`: `keepMounted?: boolean` (default `undefined` — preserves today's lazy unmount-on-switch behavior for every existing/other consumer). When `true`, the corresponding `TabsContent` renders with `forceMount` and stays present-but-hidden (`data-[state=inactive]:hidden`) rather than unmounting when its tab is inactive. **This story's shell sets `keepMounted: true` on the Posts and Notifications tabs only** (API Keys/Subscribed Accounts stay lazy/default) — see Dev Notes for why, this is a user-approved decision (`AskUserQuestion`, 2026-08-25), not a default the dev agent should second-guess.
8. **And** `NotificationsContent`'s existing `hasInitializedRef`-guarded "sync settings on load" effect (which calls `registerFcmToken`/`requestPushPermissionAndRegister` when notifications are enabled) is verified, via a new test, to run its FCM-registration path **at most once** across a simulated tab-away-and-back cycle inside the shell (proving `keepMounted: true` actually prevents the remount-triggered re-registration this story exists partly to fix) — not just asserted by inspection.
9. **And** `PostsSelectContent`'s internal `activeAccountId` (its own per-account inner-tab state) is confirmed, via a new test, to survive a switch away from the Posts outer tab and back (proving `keepMounted: true` prevents the reset that would otherwise occur on unmount/remount).
10. **And** every new user-facing string (the four tab labels, the new `/settings/account` page title/description) is added to both `apps/web/locales/en.json` and `apps/web/locales/id.json` with real (non-placeholder) Indonesian translations, verified by the existing `locales.test.ts` key-parity check.

## Tasks / Subtasks

- [x] **Task 1: `packages/ui` — extend `TabbedShell` with `keepMounted`** (AC: 7)
  - [x] Add `keepMounted?: boolean` to `TabbedShellTab` in `packages/ui/src/core/tabbed-shell/TabbedShell.types.ts`.
  - [x] Update `packages/ui/src/core/tabbed-shell/TabbedShell.tsx`: for each tab, pass `forceMount={tab.keepMounted || undefined}` to `TabsContent`, and append `tab.keepMounted && 'data-[state=inactive]:hidden'` to its `className` (via the existing `cn()` helper) so a force-mounted-but-inactive panel is visually hidden without being removed from the DOM.
  - [x] Extend `TabbedShell.test.tsx`: a new test asserts that a tab with `keepMounted: true` stays in the DOM (queryable, but not visible — check for the `hidden`-equivalent class/attribute) after switching to a different tab, while a tab without `keepMounted` (or `keepMounted: false`) still unmounts exactly as today's existing test already proves. Do not weaken or remove the existing "only the active tab's Component is mounted" test — it must still pass for the default (no-`keepMounted`) case.
- [x] **Task 2: `apps/web` — build the Account Settings shell route** (AC: 1, 2, 3)
  - [x] Create `apps/web/src/app/[locale]/settings/account/page.tsx` mirroring `settings/api-keys/page.tsx` exactly (Server Component, `generateMetadata`, `Suspense<RouteLoader>` wrapping `<AccountSettingsContent />`).
  - [x] Create `apps/web/src/app/[locale]/settings/account/account-settings-content.tsx` (`'use client'`): `useQueryState('tab', parseAsStringEnum(['api-keys','subscriptions','posts','notifications']).withDefault('api-keys'))`; renders `<TabbedShell tabs={[...]} activeKey={tab} onTabChange={setTab} />` with the four tabs per AC1, `keepMounted: true` on Posts and Notifications per AC7; tab `label`s resolved via `useTranslations()` from the new i18n namespace (Task 5).
  - [x] Create `account-settings-content.test.tsx`: renders the shell, asserts all four tab triggers are present with correct labels, asserts the default active tab is API Keys, asserts clicking a tab updates the `?tab=` URL param (mock `next/navigation`/`nuqs` per the existing `favorites-content.test.tsx` convention).
- [x] **Task 3: Move and adapt `ApiKeysContent`** (AC: 4, 5)
  - [x] Move `apps/web/src/app/[locale]/settings/api-keys/api-keys-content.tsx` (+ its test file) to `apps/web/src/app/[locale]/settings/account/api-keys-content.tsx`, updating its own internal import paths as needed. Its `PageHeader`/`PageContainer` usage stays (still the correct chrome for its tab panel — the shell's `page.tsx` itself renders no header/container of its own around `TabbedShell`).
  - [x] Add the API-key-health banner (AC5) — the `hasInvalidKey` check and the "API Key Health" `StatusBadge` list, moved verbatim from `queue-status-content.tsx`, reading the same already-fetched `apiKeysList`.
  - [x] Delete `apps/web/src/app/[locale]/settings/api-keys/` (the old route directory) once the move is confirmed working.
- [x] **Task 4: Move and adapt `SubscriptionsContent`** (AC: 4, 6)
  - [x] Move `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` (+ test) to `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx`.
  - [x] Add the pending-extraction-count display (AC6) to each subscription row, reading `sub.pendingExtractionCount` (already returned by the existing query, per Story 3.9a's original resolver work — verify the field is still present on the query response type; if the GraphQL selection set doesn't currently request it in this component specifically, add it to the existing query's field selection — no schema/resolver change needed either way).
  - [x] Delete `apps/web/src/app/[locale]/settings/subscriptions/` once confirmed.
- [x] **Task 5: Move `NotificationsContent`, verify the `keepMounted` fix** (AC: 4, 8)
  - [x] Move `apps/web/src/app/[locale]/settings/notifications/notifications-content.tsx` (+ test) to `apps/web/src/app/[locale]/settings/account/notifications-content.tsx`, unchanged otherwise (the `keepMounted: true` fix lives in the shell's tab config, Task 2, not in this component itself).
  - [x] Add the AC8 test (in `account-settings-content.test.tsx` or a dedicated integration test): render the shell on the Notifications tab, let the sync effect fire once (mock `registerFcmToken` to a spy), switch to another tab and back, assert the spy was still only called once.
  - [x] Delete `apps/web/src/app/[locale]/settings/notifications/` once confirmed.
- [x] **Task 6: Wire `PostsSelectContent` as the Posts tab, verify the `keepMounted` fix** (AC: 1, 9)
  - [x] Import `PostsSelectContent` from its existing location (`apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`) directly — **do not move or duplicate this file**, since `/posts/select` stays a live route (AC4). Render it as the Posts tab's `Component`.
  - [x] Add the AC9 test: render the shell on the Posts tab, select a non-default inner account tab (`activeAccountId`), switch the outer shell to another tab and back, assert the previously-selected inner account tab is still selected (not reset to the auto-selected default).
- [x] **Task 7: Dissolve `queue-status-content.tsx` and its route** (AC: 4, 5, 6)
  - [x] Confirm both pieces (API-key-health banner, pending-extraction-count) have been fully absorbed per Tasks 3/4 before deleting anything.
  - [x] Delete `apps/web/src/app/[locale]/settings/queue-status/` (page, content component, test file) entirely — Story 3.9a is fully dissolved by this story.
  - [x] Grep the codebase for any remaining `/settings/queue-status`, `/settings/api-keys`, `/settings/subscriptions`, `/settings/notifications` link references (nav entries, redirects, tests, i18n strings referencing the old paths) and update them to `/settings/account` (with the appropriate `?tab=` where a specific tab was being linked to, e.g. the queue-status banner's own "go fix your API key" link).
- [x] **Task 8: User Menu registration** (AC: none directly — required for the feature to be reachable, per this workflow's "leave the system working end-to-end" rule)
  - [x] Update Story 2.8's User Menu registry (wherever the menu-item list is defined in `apps/web`, e.g. `profile-menu-entries.ts` or equivalent) to point its "Account Settings" entry at `/settings/account`, replacing the four former separate entries (API Keys, Subscribed Accounts, Notifications) and removing the Queue Status entry — per `EXPERIENCE.md`'s now-current User Menu registry (Information Architecture § Profile item, items 5 and the removed old items).
- [x] **Task 9: i18n** (AC: 10)
  - [x] Add an `AccountSettings` namespace (or equivalent) to `apps/web/locales/en.json`: tab labels (`apiKeysTabLabel`, `subscribedAccountsTabLabel`, `postsTabLabel`, `notificationsTabLabel`) and `Metadata.accountSettingsTitle`/`accountSettingsDescription`.
  - [x] Mirror into `apps/web/locales/id.json` with real Indonesian translations.
  - [x] Remove now-orphaned `Metadata.apiKeysTitle`/`...Description`, `...subscriptionsTitle...`, `...notificationsTitle...`, `...queueStatusTitle...` keys from both locale files if nothing else references them (grep first — do not remove blindly).
- [x] **Task 10: Verification** (AC: all)
  - [x] `pnpm --filter ui test`, `pnpm --filter web test` pass, including all new/moved test files, no regressions.
  - [x] `pnpm build` and `pnpm lint` clean at the repo root.
  - [x] Manual smoke check (Completion Notes): navigate `/settings/account`, confirm all four tabs render, switch between them (including a full round-trip through Posts/Notifications to confirm the `keepMounted` fix), confirm the API-key-health banner and pending-extraction counts show correctly, confirm `/settings/api-keys`/`/settings/subscriptions`/`/settings/notifications`/`/settings/queue-status` all 404, confirm `/posts/select` still works standalone, confirm the User Menu's Account Settings entry navigates correctly.

## Dev Notes

- **The `keepMounted` decision was made via `AskUserQuestion` during this story's creation (2026-08-25), not by the dev agent's own judgment — do not revisit it.** `TabbedShell`'s AC4 (Story 0.29) deliberately unmounts inactive tabs so switching tabs doesn't fire all four tabs' data queries at once. That default has a real cost for two of the four absorbed components: `NotificationsContent`'s FCM-token-registration effect (guarded by a `useRef` that resets on remount) would re-run — including a potential permission-prompt/registration call — every time a user tabs back to Notifications; `PostsSelectContent`'s internal `activeAccountId` (which inner account's posts are showing) would reset to its auto-selected default every time a user tabs away and back. The user's explicit direction: fix both via a new, reusable, backward-compatible `TabbedShell` prop (`keepMounted` per tab) rather than a component-internal workaround — this is a real primitive capability other future `TabbedShell` consumers (e.g. the Moderator Tools shell, Story 4.7b) may also need, not a one-off hack scoped to this story alone. API Keys/Subscribed Accounts were confirmed lower-stakes (an active undo-toast for a revoked key/removed subscription closes a few seconds early if the user switches tabs mid-undo-window — an accepted, documented tradeoff, not fixed here) and stay on the default lazy behavior.
- **`/posts/select` is not removed.** Unlike the four `/settings/*` routes this story explicitly replaces, the correct-course proposal never calls for removing `/posts/select` — only for adding Posts as a fourth tab. `PostsSelectContent` is prop-less and self-contained, so it renders correctly at both the standalone route and inside the shell with zero duplicated logic (one component, two call sites) — this mirrors the existing `AccountLocationField` precedent (Component Patterns § Account Location Field) of one component composing into two different page contexts.
- **This story fully dissolves Story 3.9a**, not just moves two of its pieces — the `queue-status-content.tsx` file itself, its route, and its tests are deleted, not kept as a third orphaned consumer of the same data.
- **Package boundary:** `TabbedShell`'s `keepMounted` extension is a `packages/ui` change (Task 1); everything else is `apps/web`-only (the shell route, the four content components, i18n). No `packages/domain` involvement — this is a pure UI/routing consolidation with zero new business logic.
- **State-management categorization** (per `project-context.md`'s State Management Architecture rule): the shell's active-tab state is **URL State** (`nuqs`, AC2) — shareable/SSR-friendly, consistent with how every other filter/tab-like UI state in this app is already categorized (`favorites-content.tsx`'s `q`/`types` params). It is explicitly not Client Global State (`zustand`) or Server State (`@tanstack/react-query`) — it doesn't need to cross unrelated component boundaries and isn't async/cached data.
- **Loader categorization** (per `project-context.md`'s UI Patterns rule): this story introduces no new async mutation/action requiring a Blocking full-screen overlay — all four tab contents already have their own established Non-Blocking loading patterns (skeletons/spinners) from their original implementations, unchanged by this move.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh via a Winston-persona pass**, since `epic-3-readiness.md`'s swept coverage predates this story (added 2026-08-24, well after Epic 3's original readiness sweep). **Verdict: No gap.** All four tab contents reuse their existing GraphQL hooks unchanged; the two absorbed `queue-status-content.tsx` fragments read fields already returned by queries these components already call — no new query, mutation, external service call, or AWS/IaC resource. The `TabbedShell` `keepMounted` change is a pure client-side rendering-lifecycle prop with no backend footprint. Auth handling is unchanged (each content component keeps its own existing redirect-on-unauthenticated effect). Non-blocking note carried into Task 7: confirm no external links/bookmarks/nav references still point at the four deleted routes — a content/redirect concern, not an architecture gap.
- **Gate 2 (UI Complexity & Reusability) — resolved directly via `AskUserQuestion`, not deferred.** The real, non-mechanical tradeoff this story surfaced (tab-switch state loss across the four absorbed components, see Dev Notes above) was presented to the user before drafting, per this project's standing "surface real tradeoffs via questions" rule. Resolved: targeted fix via a new reusable `TabbedShell` prop (`keepMounted`), applied to the two components with real hazards (Notifications, Posts); the other two (API Keys, Subscribed Accounts) keep an accepted, documented low-severity tradeoff (early undo-toast closure). No further story split needed — extending an existing Epic-0 primitive with one small, backward-compatible, directly-motivated prop is appropriate to fold into this consuming story rather than forking into a separate prerequisite (confirmed via a fresh Gate 3 pass, see below).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh, same reason as Gate 1.** **Verdict: No gap.** The Server-Component + `generateMetadata`/`Suspense<RouteLoader>` pattern is already replicated 5+ times in this codebase; `TabbedShell` already exists as a merged Epic-0 primitive; the `nuqs`/`NuqsAdapter` usage mirrors an existing identical pattern (`favorites-content.tsx`). Nothing here is a quiet dependency on infrastructure other future stories would discover missing. On the `TabbedShell` extension specifically: confirmed appropriate to do inline in this story (not a separate prerequisite) — the change is backward-compatible by explicit design, motivated by and directly testable against two concrete hazards this story itself surfaces, and doesn't redesign the shell's existing contract.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story introduces no database schema change, no migration, and no new GraphQL contract — `pendingExtractionCount` and `apiKeysList[].isValid` already exist on their respective query response types (confirmed: both are already consumed by the now-deleted `queue-status-content.tsx`, just not yet by the components absorbing them).
- **Impacted fields/contracts:** One new, purely additive TypeScript field: `TabbedShellTab.keepMounted?: boolean` (`packages/ui/src/core/tabbed-shell/TabbedShell.types.ts`). No existing type's shape changes; the field is optional, so every existing `TabbedShell` consumer (none yet in production use besides this story) is unaffected.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the additive `keepMounted` field above.
- **Backward compatibility and rollout notes:** The four moved content components keep their exact existing internal logic (data fetching, mutations, local state) — only their file location and render call site change. The four old routes 404 after this story lands (no redirect is specified by the proposal; Task 7 grep-checks for stale internal links but does not add a redirect layer, since none was requested — flag to the user if external/bookmarked traffic to these routes turns out to matter).
- **Verification checks:** `TabbedShell.test.tsx`'s new `keepMounted` cases (Task 1); `account-settings-content.test.tsx` (tab rendering, URL param wiring, the AC8/AC9 remount-hazard regression tests); each moved component's existing test suite, relocated and still passing unchanged.

### Project Structure Notes

- **New:** `apps/web/src/app/[locale]/settings/account/{page.tsx, account-settings-content.tsx, account-settings-content.test.tsx, api-keys-content.tsx, api-keys-content.test.tsx, subscriptions-content.tsx, subscriptions-content.test.tsx, notifications-content.tsx, notifications-content.test.tsx}` (the three `*-content.tsx` files are **moved**, not newly written, from their old locations, plus their absorbed queue-status pieces).
- **Modified:** `packages/ui/src/core/tabbed-shell/TabbedShell.tsx` + `.types.ts` + `.test.tsx` (Task 1); User Menu registry file (Task 8); `apps/web/locales/{en,id}.json` (Task 9).
- **Deleted:** `apps/web/src/app/[locale]/settings/{api-keys,subscriptions,notifications,queue-status}/` (all four directories, entirely).
- **Not modified:** `apps/web/src/app/[locale]/posts/select/` (Posts stays in place, imported not moved — Task 6); `packages/database`, `apps/backend` (no schema/resolver change); `packages/domain` (no portable business logic introduced).

### References

- [Source: `sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.2] — the authoritative decision record: Shell A's four tabs, the queue-status absorption split, `/moderator/items` staying separate (informs the Shell B precedent this story's sibling, 4.7b, follows).
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` Component Patterns § Account Settings & Moderator Tools Shells, Information Architecture, Profile item — authentication states] — rewritten 2026-08-25 specifically to be this story's authoritative UX source (previously stale/undone despite being claimed complete — corrected before this story was drafted).
- [Source: `_bmad-output/implementation-artifacts/0-29-build-the-reusable-tabbedshell-primitive.md`] — `TabbedShell`'s existing contract, the `packages/ui`-vs-`apps/web` boundary rationale this story's `nuqs` placement follows, and the free-navigation/no-registry precedent.
- [Source: `apps/web/src/app/[locale]/settings/api-keys/{api-keys-content.tsx, page.tsx}`, `subscriptions/subscriptions-content.tsx`, `notifications/notifications-content.tsx`, `queue-status/queue-status-content.tsx`, `posts/select/posts-select-content.tsx`] — read in full (via a research subagent, cross-checked) for exact current props/state/effects before drafting this story's ACs and remount-hazard analysis.
- [Source: `apps/web/src/app/[locale]/favorites/favorites-content.tsx`, `apps/web/src/lib/state/README.md`] — the `nuqs`/`useQueryState` pattern this story's `?tab=` param follows.
- [Source: `_bmad-output/project-context.md#State-Management-Architecture, #UI-Patterns-UX-Invariants`] — URL State categorization, loader categorization.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions; the `AskUserQuestion` real-tradeoff rule this story's `keepMounted` decision followed.

## Global Rules References

- `_bmad-output/project-context.md` — State Management Architecture (URL State/`nuqs`), UI Patterns (loader categorization, unchanged here), Code Organization (`packages/ui` core primitive extension vs. `apps/web`-only feature work).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no architecture-spine `AD-*` rule applies directly to this pure-frontend routing-consolidation story; confirmed via Gate 1/3 pass above.
- `docs/infrastructure/index.md` — confirmed no shard update needed; no backend compute, queue, or database resource touched.
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions and the `AskUserQuestion` real-tradeoff rule invoked in this story's own creation.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/web/src/app/[locale]/settings/account/` (9 files per Project Structure Notes above).
- **Modified:** `packages/ui/src/core/tabbed-shell/{TabbedShell.tsx, TabbedShell.types.ts, TabbedShell.test.tsx}`; User Menu registry file; `apps/web/locales/{en,id}.json`.
- **Deleted:** `apps/web/src/app/[locale]/settings/{api-keys,subscriptions,notifications,queue-status}/` (entire directories).
- **Unchanged, new call site only:** `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (imported into the new shell, file itself untouched, route untouched).

### Rule Mapping

- `packages/ui`-vs-`apps/web` boundary rule → `keepMounted` prop logic in `packages/ui` (Task 1), `nuqs`/routing/i18n in `apps/web` (Tasks 2-9).
- State Management Architecture rule (URL State) → `useQueryState('tab', ...)` (Task 2, AC2).
- i18n rule (no hardcoded strings, locale parity) → `AccountSettings` namespace in both `en.json`/`id.json` (Task 9), verified by `locales.test.ts`.
- "Leave the system working end-to-end" (this workflow's own mandatory rule, not a separate epics.md AC) → Task 8 (User Menu re-registration) and Task 7's stale-link grep — without these, the feature would be built but unreachable/leave dead links, which is a real requirement even though the correct-course proposal's Section 4.2 text didn't spell out the User Menu wiring step explicitly.
- Testing Rules (testing-trophy for `apps/web`/`packages/ui`) → integration tests per new/moved component, plus the two specific regression tests (AC8/AC9) proving the `keepMounted` fix actually works, not just asserting it by code inspection.

### Verification Plan

- `pnpm --filter ui test` — new `TabbedShell` `keepMounted` cases pass, existing lazy-unmount test still passes unchanged.
- `pnpm --filter web test` — new/moved component tests pass, `locales.test.ts` still passes.
- `pnpm build && pnpm lint` clean at the repo root.
- Manual smoke check per Task 10.

## Pre-Coding Approval Gate

- [x] Scope confirmation: this story builds the `/settings/account` tabbed shell, moves four existing components into it (absorbing two pieces of the dissolved `queue-status-content.tsx`), extends `TabbedShell` with a `keepMounted` prop, re-registers the User Menu entry, and deletes four old routes. `/posts/select` stays a separate, un-removed route.
- [x] Architecture and boundary confirmation: `TabbedShell` extension in `packages/ui`, everything else in `apps/web` — confirmed, not left to implementer discretion.
- [x] Testing plan confirmation: new/moved component tests, plus AC8/AC9's specific remount-hazard regression tests, per Tasks 1-6, 10.
- [x] Explicit human approval state: approved implicitly via the user's standing "continue automatically" instruction for this session's autonomous dev-story dispatches — the plan/scope was not altered from what's documented above.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 — no gap. Gate 2 — resolved directly via `AskUserQuestion` (`keepMounted` decision), not deferred. Gate 3 — no gap; `TabbedShell` extension confirmed appropriate to fold into this story rather than a separate prerequisite.

## Testing Requirements

- [x] Unit: `TabbedShell.test.tsx`'s new `keepMounted: true` case (stays mounted, hidden when inactive) and confirmation the existing default-lazy case is unaffected.
- [x] Integration: `account-settings-content.test.tsx` (tab rendering/labels, default active tab, `?tab=` URL wiring on click).
- [x] Integration (regression, AC8): Notifications' FCM-registration spy called at most once across a tab-away-and-back cycle.
- [x] Integration (regression, AC9): Posts' `activeAccountId` survives a tab-away-and-back cycle.
- [x] Integration: each moved component's existing test suite (`api-keys-content.test.tsx`, `subscriptions-content.test.tsx`, `notifications-content.test.tsx`) relocated and passing unchanged.
- [x] E2E: not required as a new dedicated flow — this is a consolidation of already-e2e-adjacent-tested existing pages, not new business logic; the manual smoke check (Task 10) covers the one genuinely new user flow (navigating between tabs).

## Deliverables Checklist

- [x] `TabbedShell`'s `keepMounted` prop, backward-compatible, tested.
- [x] `/settings/account` route rendering all four tabs correctly.
- [x] API-key-health banner and pending-extraction counts correctly absorbed into their target tabs.
- [x] `/settings/api-keys`, `/settings/subscriptions`, `/settings/notifications`, `/settings/queue-status` all removed (404).
- [x] `/posts/select` still works standalone, unchanged.
- [x] User Menu's Account Settings entry points at `/settings/account`; Queue Status entry removed.
- [x] i18n complete, locale-parity test passing.
- [x] All new/modified/moved files pass `pnpm build`/`pnpm lint`/`pnpm test` at the repo root.

## Out of Scope

- The Moderator Tools shell (Story 4.7b) — a separate story, sibling to this one.
- Fixing the API Keys/Subscribed Accounts undo-toast early-closure tradeoff — accepted, documented, not fixed (Dev Notes).
- Adding redirects from the four deleted routes to `/settings/account` — not requested by the proposal; flagged as a possible follow-up if external/bookmarked traffic turns out to matter, not built speculatively here.
- Any redesign of the four absorbed components' own internal UI/logic beyond the two named absorptions (API-key-health banner, pending-extraction count) — this is a consolidation, not a feature rewrite.

## Definition of Done

- [x] AC1-AC10 satisfied.
- [x] All tests listed under Testing Requirements passing, no regression in existing `packages/ui`/`apps/web` suites (including `locales.test.ts`).
- [x] Lint and type checks passing for `packages/ui` and `apps/web`.
- [x] `pnpm build` succeeds at the repo root.

## Completion Status

review

**2026-08-26 (Claude 3.5 Sonnet Dev Agent):** Completed implementation of every task successfully. Extended `TabbedShell` with backward-compatible `keepMounted` prop, keeping the Posts and Notifications tabs in the DOM but hidden when inactive. Created the tabbed Account Settings route `/settings/account` managing state via URL State (`nuqs`). Relocated all target component contents, absorbing the API Key Health Warning Banner and per-key `StatusBadge` into the API Keys tab, and displaying the inline `pendingExtractionCount` inside the Subscribed Accounts rows. Dissolved `queue-status` route and components. Updated User Menu to point to `/settings/account`. Parity locales test, Vitest unit tests, and integration/regression tests for AC8 and AC9 all passing 100% green.

**2026-08-25 (`bmad-create-story`):** Ultimate context engine analysis completed. A real, non-mechanical tab-switch state-loss tradeoff was found during creation (not anticipated by the original correct-course proposal) and resolved directly with the user via `AskUserQuestion` before drafting — targeted fix via a new, reusable `TabbedShell.keepMounted` prop rather than a component-internal workaround or a blanket "keep everything mounted" reversal of Story 0.29's own design intent. `EXPERIENCE.md`'s two-shell IA rewrite (a prerequisite this story's own Gate 2 needed) was applied immediately before this story's creation, in the same session, after being found stale despite being claimed complete.

## Dev Agent Record

### Agent Model Used
- Cline (Claude 3.5 Sonnet)

### Debug Log References
- Local Vitest runs (All 5 TabbedShell, 12 AccountSettings/AC8/AC9, and 48 Locales tests passed 100% green)

### Completion Notes List
- Extended `TabbedShell` primitive in `packages/ui` with `keepMounted` prop, allowing force-mounting of inactive tabs with visual hide class `data-[state=inactive]:hidden`.
- Added a unit test suite to `TabbedShell.test.tsx` verifying `keepMounted: true` keeps the DOM node present but hidden, while `keepMounted: false` unmounts.
- Created Server Component `/settings/account/page.tsx` and Client Component `account-settings-content.tsx` tracking URL state tab with `nuqs`.
- Moved `ApiKeysContent` and incorporated the invalid key warning banner and `StatusBadge` column.
- Moved `SubscriptionsContent` and displayed the inline `pendingExtractionCount` badge on active subscriptions.
- Moved `NotificationsContent` and kept it mounted under the Notifications tab to preserve service-worker initialization state.
- Wrote `account-settings-content.test.tsx` integrating actual components and mocking GraphQL to prove AC8 and AC9 regression fixes.
- Updated User Menu registry in `profile-menu-entries.ts` and its test `UserMenu.test.tsx`.
- Completed English/Indonesian i18n entries and verified with locales check.

### File List
- `packages/ui/src/core/tabbed-shell/TabbedShell.types.ts` (Modified)
- `packages/ui/src/core/tabbed-shell/TabbedShell.tsx` (Modified)
- `packages/ui/src/core/tabbed-shell/TabbedShell.test.tsx` (Modified)
- `packages/ui/src/core/app-shell/profile-menu-entries.ts` (Modified)
- `packages/ui/src/core/app-shell/UserMenu.test.tsx` (Modified)
- `apps/web/src/components/layout/AppShellWrapper.tsx` (Modified)
- `apps/web/locales/en.json` (Modified)
- `apps/web/locales/id.json` (Modified)
- `apps/web/src/app/[locale]/settings/account/page.tsx` (New)
- `apps/web/src/app/[locale]/settings/account/account-settings-content.tsx` (New)
- `apps/web/src/app/[locale]/settings/account/account-settings-content.test.tsx` (New)
- `apps/web/src/app/[locale]/settings/account/api-keys-content.tsx` (Moved from settings/api-keys)
- `apps/web/src/app/[locale]/settings/account/api-keys-content.test.tsx` (Moved from settings/api-keys)
- `apps/web/src/app/[locale]/settings/account/api-key-form-dialog.tsx` (Moved from settings/api-keys)
- `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx` (Moved from settings/subscriptions)
- `apps/web/src/app/[locale]/settings/account/subscriptions-content.test.tsx` (Moved from settings/subscriptions)
- `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx` (Moved from settings/subscriptions)
- `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.test.tsx` (Moved from settings/subscriptions)
- `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx` (Moved from settings/subscriptions)
- `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.test.tsx` (Moved from settings/subscriptions)
- `apps/web/src/app/[locale]/settings/account/notifications-content.tsx` (Moved from settings/notifications)
- `apps/web/src/app/[locale]/settings/account/notifications-content.test.tsx` (Moved from settings/notifications)
