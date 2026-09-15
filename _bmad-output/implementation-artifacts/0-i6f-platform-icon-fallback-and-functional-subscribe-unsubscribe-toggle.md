---
baseline_commit: 3ee7ada26c81011f231cef4de199eeb4d1f0ba73
---

# Story 0.i6f: Platform-icon avatar fallback and a functional subscribe/unsubscribe icon toggle (fixes DW-009's loading flash)

## Story Details

- Epic: 0.i6 (One SubscribedAccountCard for every subscribed-account display)
- Story ID: 0.i6f
- Baseline commit: 63e5e54
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `SubscribedAccountCard`'s `AccountAvatar` fallback to show the account's platform icon instead of a generic silhouette, and its subscribe control to become a fully functional two-state icon toggle (subscribe when not subscribed, unsubscribe when subscribed) that never flashes the wrong state while the subscription-status query is still loading,
so that IDEA-031's two requested UI changes ship together with FIND-010's DW-009 flash bug fixed as part of the same subscribe-state rendering work, and Story 0.i6c's already-stubbed "detail context gets the subscribe/unsubscribe toggle" behavior is delivered now rather than left for that future story to build from scratch.

## Acceptance Criteria

1. **Given** `SubscribedAccountCard` renders an account with no `profileImageUrl` (or one that fails to load) and a `platform` is available, **when** `AccountAvatar` renders its fallback, **then** it shows the platform's icon (the `Instagram` lucide icon for `platform: "instagram"`, a generic `Link` icon for any other/unknown platform) colored `text-pink-600 dark:text-pink-400`, in place of today's generic grey person-silhouette SVG.
2. **Given** `AccountAvatar` is rendered without a `platform` prop (as every one of today's 11 `account-avatar.test.tsx` cases does, and as any future caller that has no platform data would), **when** it needs to render its fallback, **then** it renders today's generic silhouette (`InstagramPlaceholder`, `data-testid="avatar-fallback-placeholder"`) completely unchanged — zero regression for callers that don't pass `platform`.
3. **Given** the platform-icon-selection logic already exists, today privately, inside `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx`'s local `PlatformIcon` function, **when** this story ships, **then** that logic is extracted verbatim into one shared, exported `packages/ui/src/core/platform-icon.tsx` component, consumed by both `SubscriptionPicker.tsx` (refactored to import it, zero behavior change) and `AccountAvatar.tsx` (new usage) — no duplicated icon-selection logic anywhere in the package.
4. **Given** `SubscribedAccountCard` renders with `isSubscribed={false}`, **when** the user activates the toggle, **then** it fires the existing `onSubscribe` callback exactly as today's "Subscribe" text button did — now rendered as a `UserPlus` icon instead of text.
5. **Given** `SubscribedAccountCard` renders with `isSubscribed={true}`, **when** the user activates the toggle, **then** it fires a new `onUnsubscribe` callback — a capability that does not exist anywhere today (today's "Subscribed" label is inert, non-interactive text) — rendered as a `UserCheck` icon in a Tailwind color distinct from the not-subscribed state's icon color.
6. **Given** the event-detail page and a user who clicks the toggle while already subscribed, **when** the click fires, **then** `EventDetailWrapper.tsx` calls the already-existing, already-backed `removeSubscription(id: ID!, action: SoftDeleteAction!): Subscription!` mutation (`useRemoveSubscriptionMutation`) with `action: SoftDeleteAction.Delete` and the real `Subscription.id` — captured by switching `isSubscribedToAccount`'s derivation from `.some(...)` to `.find(...)` against `subscriptionsData.mySubscriptions` (the `id` field is already selected by `apps/web/src/features/subscriptions/queries.graphql`'s `getMySubscriptions` query; no GraphQL document change is needed) — and on success invalidates `["getMySubscriptions"]`, mirroring the existing `subscribeToAccount` mutation's own `onSuccess` in the same file.
7. **Given** a logged-in, already-subscribed user opens event-detail while `useGetMySubscriptionsQuery` is still in flight, **when** `SubscribedAccountCard` renders during that window, **then** it shows a distinct, neutral pending state — not the not-subscribed icon — so it never flashes "not subscribed" for an already-subscribed user (this is DW-009's exact defect); once the query resolves, it shows the correct committed state. **And** this gate does not apply to anonymous users: `useGetMySubscriptionsQuery` is deliberately `enabled: !!session`, so a disabled query sits in `isPending: true` forever with no session — the loading gate must be `!!session && isSubscriptionsPending`, not `isSubscriptionsPending` alone, or an anonymous visitor would see the neutral pending state forever instead of the not-subscribed icon they see today.
8. **Given** either the subscribe or the unsubscribe mutation is in flight, **when** `SubscribedAccountCard` renders, **then** the toggle is disabled and marked `aria-busy="true"`, continuing to show the pre-toggle committed icon (no optimistic flip) until the mutation resolves — matching today's existing disable-while-pending behavior, just extended to cover both directions.
9. **Given** the toggle's new aria-labels (subscribe, unsubscribe, checking-status) and the two new toast announcements (unsubscribe success/error, mirroring the existing subscribe success/error announcements), **when** `apps/web/locales/en.json` and `id.json` are inspected, **then** both carry the new keys under the existing `EventDetailsPage` namespace with full parity, sourced through `mapper.ts`'s `useEventDetailViewLabels()` exactly like the existing ~25 label fields already are.
10. **Given** `EventDetailWrapper.tsx`'s `toggleFavorite`/`toggleCalendarAddition` mutations already call `posthog.capture` with a distinct event name per direction (`event_favorited`/`event_unfavorited`, `event_added_to_calendar`/`event_removed_from_calendar`) — but today's `subscribeToAccount` success path fires no analytics event at all, **when** a user subscribes or unsubscribes to an account from event-detail, **then** an analogous `account_subscribed`/`account_unsubscribed` event fires with `eventId` and the account's `accountId`, closing that gap using the exact same call-site pattern already established in this file.

**Depends on:** none (0.i6a's remaining scope — `size="lg"` text scaling, already shipped ahead of schedule per its own Update note, and `BUG-005`'s degenerate-input fallback — is unrelated to this story's platform-icon/toggle work; no code-level dependency exists).

**Note (from epics.md):** Formed by `bmad-create-story` from IDEA-031 + FIND-010's DW-009 slice, per `event-pages-remaining-backlog-plan.md`'s "one story" call. Homed under Epic 0.i6 rather than Epic 1/3, deviating from that plan's original "no epic" framing the same way `CC-021`/Story 0.i6e already deviated from `event-pages-followthrough-plan.md`'s framing — both are internal-contract changes to `SubscribedAccountCard`/`AccountAvatar` themselves (the class of change Story 0.i6d's own note established precedent for joining this epic directly). Toggle scope (functional subscribe **and** unsubscribe, not a visual-only re-skin) confirmed with the user via `AskUserQuestion` during story creation — this is also Story 0.i6c's own stubbed "detail context gets the subscribe/unsubscribe toggle" AC, delivered here ahead of that story.

## Tasks / Subtasks

- [x] **Task 1 — New shared `packages/ui/src/core/platform-icon.tsx` (AC: 3)**
  - [x] Extract the existing local, unexported `PlatformIcon` function from `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx` (lines 28-34 today) verbatim into a new exported `packages/ui/src/core/platform-icon.tsx`: `export function PlatformIcon({ platform, className }: { platform: string; className?: string })`, using `Instagram`/`Link` from `lucide-react`.
  - [x] Update `SubscriptionPicker.tsx` to `import { PlatformIcon } from '../../core/platform-icon'` instead of defining it locally; delete the local definition. Its one call site (`optionLabel`, passing `className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400"`) is otherwise unchanged.
  - [x] Add `export * from './core/platform-icon';` to `packages/ui/src/index.ts`'s existing barrel list (alongside the other `core/*` exports).

- [x] **Task 2 — `packages/ui/src/core/account-avatar.tsx`: platform-icon fallback (AC: 1, 2)**
  - [x] Add `platform?: string;` to `AccountAvatarProps`, threaded into the component's destructured props.
  - [x] In the existing fallback branch (`if (!profileImageUrl || hasError)`), when `platform` is truthy render `<PlatformIcon platform={platform} className="w-full h-full text-pink-600 dark:text-pink-400" />` in place of `<InstagramPlaceholder className="w-full h-full" />`, inside a container carrying a new `data-testid="avatar-fallback-platform-icon"` (distinct from the existing `avatar-fallback-container`/`avatar-fallback-placeholder` testids so both fallback kinds remain independently assertable).
  - [x] When `platform` is falsy (undefined/empty string), render exactly today's `InstagramPlaceholder` path unchanged, `data-testid`s included — this is the AC 2 backward-compat branch.
  - [x] `role="img"`/`aria-label={altText}` on the outer container stay exactly as today in both branches.

- [x] **Task 3 — `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` + `.types.ts`: functional icon toggle (AC: 1 thread, 4, 5, 7, 8)**
  - [x] `SubscribedAccountCardProps`: add `onUnsubscribe?: () => void;`, `isStatusLoading?: boolean;` (DW-009's "we don't know the real state yet" signal), rename `isSubscribing?: boolean` to `isTogglePending?: boolean` (now covers both directions — this component has exactly one consumer today, `EventDetailView.tsx`, so the rename is a safe, non-breaking internal refactor). Rename `labels.subscribedLabel` to `labels.unsubscribeLabel`; keep `labels.subscribeLabel`; add `labels.checkingSubscriptionLabel?: string`.
  - [x] Thread `platform={account.platform}` into the existing `<AccountAvatar ... />` call.
  - [x] Replace the existing `isSubscribed ? <span>...</span> : <button>...</button>` block with a single `<button type="button" data-testid="subscribe-toggle">`:
    - `onClick`: `isStatusLoading ? undefined : (isSubscribed ? onUnsubscribe : onSubscribe)`.
    - `disabled={isStatusLoading || isTogglePending || (!isSubscribed && !onSubscribe) || (isSubscribed && !onUnsubscribe)}`.
    - `aria-busy={isStatusLoading || isTogglePending}`.
    - `aria-pressed`: omit/leave unset while `isStatusLoading` (the state is genuinely unknown — asserting a pressed value would misinform assistive tech), otherwise `isSubscribed`.
    - `aria-label`: `isStatusLoading ? (labels?.checkingSubscriptionLabel || 'Checking subscription status') : isSubscribed ? (labels?.unsubscribeLabel || 'Unsubscribe') : (labels?.subscribeLabel || 'Subscribe')`.
    - Icon: `isStatusLoading` renders a dimmed/reduced-opacity `UserPlus` (the neutral default look — never implies "already subscribed" during the unknown window) via an `opacity-40` class; otherwise `isSubscribed ? <UserCheck .../> : <UserPlus .../>`, each a distinct Tailwind color (e.g. `text-primary` subscribed vs `text-gray-400 hover:text-gray-600` not-subscribed) so the two committed states are visually distinguishable without relying on the icon shape alone.
    - Keep the existing `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` focus-ring classes from today's button.

- [x] **Task 4 — `apps/web/src/features/events/EventDetailWrapper.tsx`: real unsubscribe wiring, the DW-009 loading gate, and analytics symmetry (AC: 6, 7, 8, 10)**
  - [x] `useGetMySubscriptionsQuery`: destructure `isPending: isSubscriptionsPending` alongside the existing `data: subscriptionsData`.
  - [x] Replace `isSubscribedToAccount = subscriptionsData?.mySubscriptions?.some(...)` with a `.find(...)` that captures the matched row (`matchedSubscription`), then derive `isSubscribedToAccount = !!matchedSubscription` from it — same truthiness, but now the row (and its `id`) is retained.
  - [x] Add `const isSubscriptionStatusLoading = !!session && isSubscriptionsPending` (the `!!session` guard is required — see AC 7's anonymous-user note).
  - [x] Add `useRemoveSubscriptionMutation(graphqlClient, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["getMySubscriptions"] }); setLiveMessage(t("unsubscribeSuccessAnnouncement")); posthog.capture("account_unsubscribed", { eventId, accountId: data?.eventBySlug?.sourceSocialMediaAccountProfile?.accountId }) }, onError: () => setLiveMessage(t("unsubscribeErrorAnnouncement")) })`, destructuring `{ mutate: unsubscribeFromAccount, isPending: isUnsubscribingFromAccount }`.
  - [x] Add `handleUnsubscribeFromAccount`, mirroring `handleSubscribeToAccount`'s early-return guard style: return early if `!matchedSubscription?.id`, else `unsubscribeFromAccount({ id: matchedSubscription.id, action: SoftDeleteAction.Delete })` (import `SoftDeleteAction` from `@/generated/graphql`, already imported project-wide the same way in `subscriptions-content.tsx`/`api-keys-content.tsx`/etc.).
  - [x] Add `posthog.capture("account_subscribed", { eventId, accountId: data?.eventBySlug?.sourceSocialMediaAccountProfile?.accountId })` inside `subscribeToAccount`'s existing `onSuccess` (AC 10's other half).
  - [x] In the `mappedProps`/`detailProps` object literal (today's `isSubscribedToAccount`/`isSubscribingToAccount`/`onSubscribeToAccount` block), add `isSubscriptionStatusLoading`, `isUnsubscribingFromAccount`, and `onUnsubscribeFromAccount: () => { if (!session) { router.push("/login"); return } handleUnsubscribeFromAccount() }` — mirroring `onSubscribeToAccount`'s existing session-redirect guard exactly.
  - [x] **Deliberately not using** `useSoftDeleteWithUndo`/the undo-toast pattern (`packages/ui`'s Story-0.18 primitive, used by `subscriptions-content.tsx`'s settings-list delete affordance) for this call site — see Dev Notes for the reasoning; this is a documented design decision, not an oversight.

- [x] **Task 5 — `packages/ui/src/features/events/EventDetailView.tsx` + `.types.ts`: prop threading (AC: 6, 7, 8 thread-through)**
  - [x] `EventDetailViewProps`: add `isSubscriptionStatusLoading?: boolean;`, `onUnsubscribeFromAccount?: () => void;`, `isUnsubscribingFromAccount?: boolean;`.
  - [x] `EventDetailViewLabels`: add `subscribeButtonLabel?: string;`, `unsubscribeButtonLabel?: string;`, `checkingSubscriptionLabel?: string;`, `unsubscribeSuccessAnnouncement?: string;`, `unsubscribeErrorAnnouncement?: string;` — **all optional**, matching this interface's existing convention for newer, non-critical fields (`scheduleCheckboxLabel?`, `reportMenuItemLabel?`, `embedLoadingLabel?`, etc.) so `apps/web/src/features/events/mapper.test.ts`'s hand-written `LABELS` fixture (which does not enumerate every field today) keeps compiling unchanged.
  - [x] In the component body, derive `const isTogglePending = isSubscribingToAccount || isUnsubscribingFromAccount;` and pass to `SubscribedAccountCard`: `onUnsubscribe={onUnsubscribeFromAccount}`, `isStatusLoading={isSubscriptionStatusLoading}`, `isTogglePending={isTogglePending}` (replacing today's `isSubscribing={isSubscribingToAccount}`), and `labels={{ subscribeLabel: labels.subscribeButtonLabel, unsubscribeLabel: labels.unsubscribeButtonLabel, checkingSubscriptionLabel: labels.checkingSubscriptionLabel }}` (today's call site passes no `labels` prop at all — this closes that pre-existing i18n gap for the toggle's own aria-labels; note that visible display text elsewhere on the card, e.g. `account.displayName`/`account.username`, is already data-driven, not translated microcopy, so is unaffected).

- [x] **Task 6 — `apps/web/src/features/events/mapper.ts`: wire the 5 new label keys (AC: 9)**
  - [x] Add `subscribeButtonLabel: t('subscribeButtonLabel')`, `unsubscribeButtonLabel: t('unsubscribeButtonLabel')`, `checkingSubscriptionLabel: t('checkingSubscriptionLabel')`, `unsubscribeSuccessAnnouncement: t('unsubscribeSuccessAnnouncement')`, `unsubscribeErrorAnnouncement: t('unsubscribeErrorAnnouncement')` to `useEventDetailViewLabels()`'s returned object.

- [x] **Task 7 — `apps/web/locales/en.json` + `id.json`: new `EventDetailsPage` keys (AC: 9)**
  - [x] `en.json`: add `"subscribeButtonLabel": "Subscribe to this account"`, `"unsubscribeButtonLabel": "Unsubscribe from this account"`, `"checkingSubscriptionLabel": "Checking subscription status"`, `"unsubscribeSuccessAnnouncement": "Unsubscribed from account"`, `"unsubscribeErrorAnnouncement": "Something went wrong. Please try again."` alongside the existing `subscribeSuccessAnnouncement`/`subscribeErrorAnnouncement` keys.
  - [x] `id.json`: add the parallel Indonesian keys in the same position (e.g. `"Berlangganan akun ini"`, `"Berhenti berlangganan akun ini"`, `"Memeriksa status langganan"`, `"Berhenti berlangganan dari akun"`, `"Terjadi kesalahan. Silakan coba lagi."`) — confirm final wording against this file's existing tone/register for the surrounding subscribe strings rather than a literal machine translation.

- [x] **Task 8 — Tests (AC: all)**
  - [x] `packages/ui/src/core/account-avatar.test.tsx`: keep all 11 existing tests passing unmodified (none pass `platform`). Add new cases: `platform="instagram"` + no `profileImageUrl` renders `avatar-fallback-platform-icon` (not `avatar-fallback-placeholder`); `platform="instagram"` + an image that errors (`fireEvent.error`) falls back to the platform icon too; an unrecognized `platform` (e.g. `"tiktok"`) still renders `avatar-fallback-platform-icon` (generic `Link` icon path) rather than crashing or silently falling through to the old silhouette.
  - [x] `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx`: fix the existing "AccountAvatar fallback applies when profileImageUrl is missing" test — `defaultProps.account.platform` is already `'instagram'`, so once `platform` is threaded through it now renders `avatar-fallback-platform-icon`, not the old silhouette; update its assertion accordingly. Replace the "Subscribe"/"Subscribed" text-based assertions across the file with `data-testid="subscribe-toggle"` + `aria-label`/`aria-pressed` assertions. Add new tests: clicking the toggle while `isSubscribed=true` fires `onUnsubscribe` (not `onSubscribe`); `isStatusLoading=true` renders the dimmed neutral icon, no `aria-pressed`, and does not fire either callback on click; `isTogglePending=true` disables the button and sets `aria-busy="true"` while preserving the pre-toggle icon.
  - [x] `apps/web/src/features/events/EventDetailWrapper.test.tsx`: add a top-level `id` field to every row of the `currentMockSubscriptions` mock (the real query already selects it; the fixture was narrower than production). Add a `RemoveSubscription` MSW mutation handler (mirroring the existing `SubscribeToAccount` handler) that removes the matching row from `currentMockSubscriptions`. Rewrite the three existing subscribe-related tests (`renders SubscribedAccountCard with a Subscribe button...`, `clicking Subscribe calls the mutation...`, `shows Subscribed (no button) when already subscribed...`) for the icon-toggle UI (`getByTestId("subscribe-toggle")` + `aria-label`/`aria-pressed` instead of `getByRole("button", { name: "Subscribe" })`/`getByText("Subscribed")`). Add: a test that clicking the toggle while subscribed calls `removeSubscription` and the card flips back to the not-subscribed icon on success; a DW-009 regression test asserting the toggle shows the neutral/checking state (not the not-subscribed icon) while `getMySubscriptions`'s response is deliberately delayed for an already-subscribed fixture, then resolves to the subscribed icon once the response lands.
  - [x] `packages/ui/src/features/events/EventDetailView.test.tsx`: rewrite the existing text-based assertions (`renders SubscribedAccountCard when accountId, platform, and username are present`, `shows a Subscribed indicator...`) for the icon-toggle UI. Add tests covering the new `isSubscriptionStatusLoading`/`onUnsubscribeFromAccount`/`isUnsubscribingFromAccount` props are threaded to `SubscribedAccountCard` correctly (including the `isTogglePending = isSubscribingToAccount || isUnsubscribingFromAccount` OR-combination).
  - [x] `apps/web/src/features/events/mapper.test.ts`: confirm it still compiles unchanged (Task 5's optional-field choice) — no edit expected, but re-run it as part of verification since it directly type-checks against `EventDetailViewLabels`.

## Dev Notes

- **Scope: `packages/ui` (core + subscriptions + events) and `apps/web/src/features/events` + two locale files.** No `packages/domain` change, no `apps/backend` change, no database migration, no new GraphQL SDL type or field, no new npm dependency (`lucide-react` is already used project-wide, including `UserPlus`/`UserCheck`/`Instagram`/`Link`, all standard icons in the installed version).
- Source of truth for scope: `_bmad-output/planning-artifacts/epics.md` Story 0.i6f (this workflow run; no `bmad-epic-readiness-check` report exists yet for Epic 0.i6, so Gate 1/2/3 were run fresh for this story — see Architecture & UX Gate Findings below, not cited from a swept report).
- **Current code state (read in full before drafting this story):**
  - `packages/ui/src/core/account-avatar.tsx` (78 lines) — `AccountAvatarProps` has no `platform` field today; its fallback branch (`!profileImageUrl || hasError`) always renders a local `InstagramPlaceholder` sub-component (a hand-drawn grey silhouette SVG), regardless of which platform the account is on. `profileImageUrl` is actually the *account's own* profile picture (not a platform logo) — the naming (`accountPlatformIconUrl` in `EventDetailView.types.ts`, mapped from `event.sourceSocialMediaAccountProfile?.profileImageUrl` in `mapper.ts`) is a pre-existing minor misnomer, not something this story renames (out of scope, see Out of Scope).
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` (54 lines) — renders `AccountAvatar` without a `platform` prop today (even though `account.platform` is available on `SubscribedAccountCardProps.account`); its subscribe control is `isSubscribed ? <span>Subscribed</span> : <button onClick={onSubscribe}>Subscribe</button>` — the subscribed branch is genuinely inert, no `onClick`, no way to reverse it from this surface today.
  - `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx` (72 lines) — already has the exact icon-selection logic IDEA-031's capture note asked for ("reuse platform-registry.ts mapping"), but **the note is wrong about where it lives**: `packages/domain/src/scraper/platform-registry.ts` only has slug/display-name string mappings (`getPlatformSlug`, `getPlatformDisplayName`, `detectPlatformFromUrl`) — no icon, no color, and it is a `packages/domain` module, the wrong layer for UI/icon concerns per this project's `core/` (domain-agnostic, reused UI) vs. `packages/domain` (pure business logic, no React) separation. The real reusable icon logic is `SubscriptionPicker.tsx`'s private `PlatformIcon` (`Instagram`/`Link` from `lucide-react`) — confirmed by direct read and grepping the whole repo for any other icon/color mapping (none found). **A dev agent following the backlog note literally would go looking in the wrong package; Task 1 points at the correct, already-existing source.**
  - `apps/web/src/features/events/EventDetailWrapper.tsx` — read in full. `useGetMySubscriptionsQuery(graphqlClient, undefined, { enabled: !!session })` (line ~58) destructures only `{ data: subscriptionsData }`, no loading flag. `isSubscribedToAccount` (line ~288) is `.some(...)`-derived — a boolean only, discarding the matched row's `id`. `useSubscribeToAccountMutation` (line ~269) already has the exact `onSuccess`/`onError` shape (`invalidateQueries` + `setLiveMessage`) this story's new `useRemoveSubscriptionMutation` call mirrors. `handleSubscribeToAccount` (line ~279) already guards on required fields before mutating — `handleUnsubscribeFromAccount` follows the same shape, guarding on `matchedSubscription?.id`. The `detailProps`/`mappedProps` object (line ~481) is where `isSubscribedToAccount`/`isSubscribingToAccount`/`onSubscribeToAccount` are added today (line ~516) — the natural, minimal-diff spot for the three new fields.
  - `apps/web/src/features/subscriptions/queries.graphql` — `getMySubscriptions`'s `mySubscriptions` selection already includes a top-level `id` (line 3, the `Subscription` row's own id, distinct from the nested `account { id ... }`). **No GraphQL document change needed anywhere in this story** — confirmed by direct read, avoiding a codegen regen this story doesn't need.
  - `apps/backend/src/schema/subscriptions.graphql` — `removeSubscription(id: ID!, action: SoftDeleteAction!): Subscription!` (line 34) already exists, already resolved, already exercised end-to-end today by `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx`'s delete affordance (`handleDelete`, line ~122) and `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`. This story adds a **third** call site to an existing mutation — it does not invent backend surface.
  - `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8` (Soft-Delete Convention) — binds the `Subscription`/`subscriptions` table explicitly (line 135) and defines the `removeSubscription`-shaped mutation contract this story reuses (rule 4). Cited, not amended.
- **Design decision — no undo-toast on this surface (escalated informally via the Gate 1/2/3 review, not a blocking gap; recorded here for explicit visibility).** The settings page's delete affordance wraps `removeSubscription` in `useSoftDeleteWithUndo` (`packages/ui`, Story 0.18's reusable primitive) because the row visually vanishes from a list — a surprising, easy-to-regret action that needs a safety net. On event-detail, the account card never disappears; the icon just flips state in place, and re-tapping it instantly re-subscribes by calling `subscribeToAccount` again. The "item vanished, might regret it" problem the undo-toast exists to solve does not apply here, so this story deliberately does **not** wire `useSoftDeleteWithUndo`/`SoftDeleteToaster` for this call site. This was reviewed as a Gate 2 (UX) question during story creation and found to be a reasonable, self-contained call, not a split-worthy gap — see Architecture & UX Gate Findings.
- **Design decision — `UserPlus`/`UserCheck` over `BellPlus`/`BellRing`.** Confirmed with the user via `AskUserQuestion` during story creation: a generic follow/subscribe icon pair was chosen over a notification-bell metaphor. No existing DESIGN.md/EXPERIENCE.md token or prior icon usage anywhere in the repo constrained this choice (confirmed by the Gate 2 review — `_bmad-output/design-artifacts/` does not exist in this repo). Recorded so a future subscribe-toggle elsewhere in the app doesn't re-litigate this.
- **Design decision — the pending/"checking status" visual has no prior precedent** (the `Heart` favorite toggle this design otherwise mirrors has no loading state at all, since favorite status ships with the initial event query). This story defines it explicitly (Task 3: dimmed `UserPlus` at `opacity-40`, no `aria-pressed`, distinct `aria-label`) rather than leaving it to be improvised during implementation — per the Gate 2 review's specific flag on this point.
- **`isSubscribing` → `isTogglePending` rename is safe.** `SubscribedAccountCard` has exactly one real consumer app-wide today (`EventDetailView.tsx`) — confirmed by a repo-wide search for the component's usage. Story 0.i6b/0.i6c (Post Selection / Settings adoption) are not yet built, so there is no second call site anywhere to break.
- **Analytics gap found and closed (AC 10).** `EventDetailWrapper.tsx`'s `toggleFavorite`/`toggleCalendarAddition` mutations both fire a direction-specific `posthog.capture` on success; `subscribeToAccount`'s success path fires none today, and there was of course never an unsubscribe path to instrument. This story adds `account_subscribed`/`account_unsubscribed` captures using the exact same call shape already established twice in this file, closing the one inconsistency the Gate 1 review flagged.

### Architecture & UX Gate Findings

- **No epic readiness report exists for Epic 0.i6** (`_bmad-output/planning-artifacts/epic-readiness/` has reports for Epics 0.i7, 0, 1, 1.i1, 2-7, but none for `epic-0-i6`) — Gate 1 and Gate 3 were therefore run **fresh** for this story, not cited from a swept report.
- **Gate 1 (Architecture/Infrastructure Completeness), run fresh** (dispatched to a subagent with Winston's/the architect's analytical lens, full scope evidence inlined rather than re-derived): **No gap.** Every write path routes through the already-existing, already-backed `removeSubscription` mutation — this story adds a second frontend call site to it, it does not invent an API surface. The companion read (`Subscription.id`) needs no query change since the field is already selected. No external service is called directly from the frontend, no new DB schema, no new IaC, no new GraphQL SDL. The AD-8 binding (Subscription table → Soft-Delete Convention rule 4's mutation shape) checks out against `removeSubscription`'s actual signature. `platform-icon.tsx`/avatar/toggle changes are pure `packages/ui`/`apps/web` presentational work.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness), run fresh:** **No gap.** i18n: `next-intl`, the `EventDetailsPage` namespace, `mapper.ts`'s label-building pattern, and strict en/id parity are all established infra already serving ~25 fields the same way this story's 5 new keys use them — incremental use, not a new dependency. Analytics: PostHog capture infra clearly exists (`event_favorited` etc. already fire in this exact file) — the *absence* of a subscribe/unsubscribe capture was a scope/consistency gap, not an infrastructure gap, and is closed by AC 10/Task 4 rather than deferred.
- **Gate 2 (UI Complexity & Reusability), run fresh** (dispatched to a subagent with Freya's/Sally's UX lens; first confirmed `_bmad-output/design-artifacts/` does not exist in this repo, so no DESIGN.md/EXPERIENCE.md precedent was available to check against): **No gap — build inline, one story.** The 3-state toggle (not-subscribed/subscribed/pending) is small and directly modeled on the existing `Heart` favorite-toggle precedent in the same parent component. The `platform-icon.tsx` extraction is a mechanical, low-risk promotion of already-built, already-used logic — no new icon/color decisions are introduced (Instagram pink + generic link icon, unchanged from `SubscriptionPicker.tsx`'s existing choices). The no-undo-toast decision is a reasonable, concretely-justified inline UX call (see Dev Notes above), not a dedicated-spec-worthy gap, and doesn't complicate Story 0.i6c's future settings-variant work since that story keeps its own swipe-to-delete affordance separate via a context/variant prop. Two non-blocking findings folded into this story rather than left as open questions: the `UserPlus`/`UserCheck` vs. `BellPlus`/`BellRing` choice (confirmed with the user), and the pending-state visual treatment (defined explicitly in Task 3).
- **Lightweight guard (per this workflow's escape hatch):** reasoned over the actual verified scope above for anything a hypothetical epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new infra dependency. Nothing here warrants a second Gate 1/3 pass.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found.** `Subscription.id` already exists on the GraphQL SDL, is already selected by `getMySubscriptions`, and is already typed as `string` on the generated `GetMySubscriptionsQuery['mySubscriptions'][number]['id']` — this story only changes which local variable captures an already-fetched, already-typed field (`.find()` vs. `.some()`), and adds no new field anywhere in the GraphQL layer.
- **Impacted fields/contracts:** `AccountAvatarProps` (new optional `platform?: string`, TS-only, no runtime schema); `SubscribedAccountCardProps` (new optional `onUnsubscribe?`, `isStatusLoading?`; `isSubscribing?` renamed to `isTogglePending?`; `labels.subscribedLabel?` renamed to `labels.unsubscribeLabel?`, `labels.checkingSubscriptionLabel?` added — all TS interface changes, no persisted data shape involved); `EventDetailViewProps`/`EventDetailViewLabels` (5 new optional fields, additive); `apps/web/locales/{en,id}.json` (5 new string keys, additive).
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** The interface changes listed above are hand-written (not generated) — no codegen run is needed anywhere in this story (confirmed: no `.graphql` document changes).
- **Backward compatibility and rollout notes:** `AccountAvatar`'s `platform` prop is optional and additive (AC 2 makes the no-`platform` path an explicit regression guard). `SubscribedAccountCard`'s `isSubscribing`→`isTogglePending` rename is a breaking prop-name change in isolation, but is safe because the component has exactly one real consumer app-wide today (verified by search) and that consumer is updated in the same story (Task 5). `EventDetailViewLabels`'s 5 new fields are all optional specifically so `apps/web/src/features/events/mapper.test.ts`'s hand-written `LABELS` fixture (which does not enumerate every existing optional field today either) keeps compiling with no edit required.
- **Verification checks:** `packages/ui`/`apps/web` type-checks clean; the new/updated tests listed in Task 8; manual sanity check that `mapper.test.ts` compiles unmodified (proving the optional-field choice actually holds).

### Project Structure Notes

- **New files:** `packages/ui/src/core/platform-icon.tsx`.
- **No `packages/domain` change:** `platform-registry.ts` (the file IDEA-031's original capture note pointed at) is correctly left untouched — see Dev Notes' explicit correction of that note. This story's icon/color logic belongs in `packages/ui` per this project's domain-agnostic-UI vs. pure-business-logic package split, not `packages/domain`.
- **No `apps/backend` change:** confirmed above — `removeSubscription` already exists and is reused as-is.
- **Reusable-component rule:** `platform-icon.tsx` graduates from a single-file-local helper to a `packages/ui/src/core/` primitive because a second real consumer (`AccountAvatar.tsx`) now exists in the same story that introduces it — matching this project's own stated placement convention ("a pattern graduates into a new `core/` primitive only once a second real consumer exists," `festgrid-architecture-spine.md#AD-9` rule 3, cited here as the general pattern even though AD-9 itself is about date-pickers).
- **No new state management:** no new React Query hook beyond the already-generated `useRemoveSubscriptionMutation` (existing, generated, already used elsewhere); no new Zustand store, no new URL param.
- **Analytics:** two new PostHog captures (`account_subscribed`, `account_unsubscribed`), both following this file's existing call-site pattern exactly (AC 10).
- **i18n:** 5 new keys, both locales, existing namespace and existing `mapper.ts` wiring pattern — no new i18n mechanism.
- **No cloud/external service setup:** none; `SETUP_WALKTHROUGH.md` unaffected.
- **AD-8 Soft-Delete Convention:** consumed exactly as designed (existing compliant mutation, new call site) — no new soft-delete-bound table, no new mutation shape.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0.i6, Story 0.i6f] (this story's home; sibling Stories 0.i6a/0.i6b/0.i6c/0.i6d/0.i6e/0.i6z for cross-story context)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-031, #FIND-010] (the two backlog rows this story promotes)
- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-031-event-detail-platform-account-element.md] (IDEA-031's original capture — note its "reuse platform-registry.ts mapping" claim is corrected in Dev Notes)
- [Source: _bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml#DW-009] (FIND-010's DW-009 slice — the loading-flash defect this story fixes)
- [Source: _bmad-output/planning-artifacts/event-pages-remaining-backlog-plan.md] ("one story" bundling call for FIND-010(DW-009)+IDEA-031, "no epic" framing deviated from per the Note above)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8] (Soft-Delete Convention — `Subscription` table binding, `removeSubscription`'s mutation-contract compliance, cited not amended)
- [Source: packages/ui/src/core/account-avatar.tsx, account-avatar.test.tsx] (current fallback implementation and full existing test suite, read in full)
- [Source: packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx, .types.ts, SubscribedAccountCard.test.tsx] (current card implementation and tests, read in full)
- [Source: packages/ui/src/features/subscriptions/SubscriptionPicker.tsx] (source of the `PlatformIcon` logic being extracted)
- [Source: packages/domain/src/scraper/platform-registry.ts] (confirmed to have no icon/color mapping — the backlog note's pointer is wrong; read in full)
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx] (subscribe/unsubscribe wiring target, read in full)
- [Source: apps/web/src/features/events/EventDetailWrapper.test.tsx] (existing subscribe-related tests being rewritten, lines ~910-971)
- [Source: packages/ui/src/features/events/EventDetailView.tsx, .types.ts, EventDetailView.test.tsx] (prop-threading target and existing tests being rewritten, lines ~473-509)
- [Source: apps/web/src/features/events/mapper.ts, mapper.test.ts] (label-wiring target and its fixture, confirming the optional-field compatibility choice)
- [Source: apps/web/src/features/subscriptions/queries.graphql] (confirms `Subscription.id` already selected — no query change needed)
- [Source: apps/backend/src/schema/subscriptions.graphql] (`removeSubscription` mutation contract, already exists)
- [Source: apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx] (the existing `removeSubscription`/`useSoftDeleteWithUndo` reference implementation this story's Dev Notes explicitly diverges from, with reasoning)
- [Source: apps/web/locales/en.json, id.json#EventDetailsPage] (existing label keys and both locales' current parity, new keys added alongside)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/ui/core` vs. `packages/domain` placement, confirmed above); i18n convention (`next-intl`, en/id parity); Analytics convention (PostHog capture per user action)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (Soft-Delete Convention), cited not amended
- [x] `docs/infrastructure/index.md` — no infra change in this story; read to confirm none was needed

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/ui/src/core/platform-icon.tsx` (new) — extracted shared icon-selection component (Task 1).
  - `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx` — import the shared component instead of a local definition (Task 1).
  - `packages/ui/src/index.ts` — export the new `platform-icon` module (Task 1).
  - `packages/ui/src/core/account-avatar.tsx` — new `platform` prop, platform-icon fallback branch (Task 2).
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx`, `.types.ts` — functional icon toggle, prop renames/additions (Task 3).
  - `apps/web/src/features/events/EventDetailWrapper.tsx` — unsubscribe mutation wiring, DW-009 loading gate, analytics (Task 4).
  - `packages/ui/src/features/events/EventDetailView.tsx`, `.types.ts` — prop threading (Task 5).
  - `apps/web/src/features/events/mapper.ts` — new label wiring (Task 6).
  - `apps/web/locales/en.json`, `id.json` — new translation keys (Task 7).
  - `packages/ui/src/core/account-avatar.test.tsx`, `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx`, `apps/web/src/features/events/EventDetailWrapper.test.tsx`, `packages/ui/src/features/events/EventDetailView.test.tsx` — updated/new tests (Task 8).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/2/3 → run fresh (no epic readiness report for Epic 0.i6), all three no-gap (Architecture & UX Gate Findings).
  - Data Type Compatibility rule (this workflow) → dedicated section above; no mismatch, fully additive/optional.
  - Reusable-function/reusable-UI rules (this workflow) → `platform-icon.tsx` extraction explicitly evaluated and justified (Project Structure Notes); `packages/domain` placement explicitly evaluated and rejected (Dev Notes' correction of the backlog note).
- **Verification Plan:**
  - `pnpm --filter ui test` (`vitest run`) — `account-avatar.test.tsx` (11 existing + new platform cases), `SubscribedAccountCard.test.tsx` (updated + new toggle/loading cases), `EventDetailView.test.tsx` (updated + new prop-threading cases) all green.
  - `pnpm --filter web test` — `EventDetailWrapper.test.tsx` (updated + new unsubscribe/DW-009-regression cases), `mapper.test.ts` (unmodified, still compiles/passes) all green.
  - `tsc`/lint clean for `packages/ui` and `apps/web`.
  - Manual/integration sanity: on a real already-subscribed account's event-detail page, confirm the toggle shows the checking-state briefly (or not at all on a fast connection) then the subscribed icon, never a flash of the not-subscribed icon; click to unsubscribe, confirm the icon flips and the account reappears as not-subscribed on the Settings page's list (same underlying `removeSubscription` mutation, so this is a real cross-surface consistency check, not just a unit-test assertion).

- [x] Scope confirmation — Tasks 1-8 above match the intended scope (platform-icon extraction + fallback, functional two-way toggle, DW-009 loading-gate fix, i18n, analytics symmetry); no scope expansion into 0.i6a's/0.i6b's/0.i6c's own territory beyond what's explicitly noted as overlapping-by-design (0.i6c's stubbed detail-toggle AC).
- [x] Architecture and boundary confirmation — no `packages/domain`/`apps/backend` change (Project Structure Notes); `removeSubscription` reused as-is, AD-8-compliant.
- [x] Testing plan confirmation — Task 8's test updates cover every renamed/new prop and both AC 7's loading-gate directions (logged-in vs. anonymous) and AC 6's real unsubscribe wiring.
- [x] **Design Decision — no undo-toast on the event-detail unsubscribe action (recommended and reasoned in Dev Notes) — explicit human confirmation requested before implementation begins**, since it is a deliberate divergence from this codebase's dominant soft-delete UI convention (even though the underlying AD-8 mutation contract is followed exactly). **Approved as written by user (shulha) via AskUserQuestion, 2026-09-16.**
- [x] Explicit human approval state — **Approved by user (shulha), 2026-09-16.**
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three run fresh this session, all three no-gap (Architecture & UX Gate Findings above).

## Testing Requirements

- [x] Unit tests — `packages/ui/src/core/account-avatar.test.tsx` (updated + new).
- [x] Unit tests — `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` (updated + new).
- [x] Unit tests — `packages/ui/src/features/events/EventDetailView.test.tsx` (updated + new).
- [x] Integration tests — `apps/web/src/features/events/EventDetailWrapper.test.tsx` (updated + new, MSW-backed, including the DW-009 regression case).
- [x] E2E tests — not required; existing MSW-backed integration coverage at the `EventDetailWrapper` level already exercises the real component tree end-to-end for this feature's precedent (`toggleFavorite`/`toggleCalendarAddition` have no separate E2E either).
- [x] Migration verification — not applicable; no migration in this story.
- [x] Regression check — confirmed `apps/web/src/features/events/mapper.test.ts` (unmodified, part of the 370/370 green `pnpm --filter web test` run) and `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx` (visually unchanged call site: same `Instagram`/`Link` icon selection, now sourced from the shared `platform-icon.tsx`, verified via the full 493/493 green `pnpm --filter ui test` run) are unaffected.

## Deliverables Checklist

- [x] `AccountAvatar` renders a platform icon fallback when `platform` is provided and no image is available; unchanged generic fallback when `platform` is absent.
- [x] `PlatformIcon` extracted to `packages/ui/src/core/platform-icon.tsx`, exported, consumed by both `SubscriptionPicker.tsx` and `AccountAvatar.tsx`.
- [x] `SubscribedAccountCard` renders a single two-state (+ pending) icon toggle; both subscribe and unsubscribe directions are functional.
- [x] `EventDetailWrapper.tsx` wires `removeSubscription` for the unsubscribe direction using the real `Subscription.id`; DW-009's loading flash is fixed via the `!!session`-gated loading signal.
- [x] `account_subscribed`/`account_unsubscribed` PostHog events fire symmetrically with this file's existing favorite/calendar events.
- [x] 5 new `EventDetailsPage` keys present with full en/id parity, wired through `mapper.ts`.
- [x] All Task 8 test updates/additions passing; `mapper.test.ts` unmodified and still passing.
- [x] Lint/type-check clean for `packages/ui` and `apps/web`.

## Out of Scope

- **`accountPlatformIconUrl`/`profileImageUrl` naming clarity** — the pre-existing minor misnomer noted in Dev Notes (it's the account's own photo, not a platform logo) is not renamed by this story; renaming it would touch `EventDetailView.types.ts`, `mapper.ts`, and every test asserting on that prop name for a purely cosmetic naming improvement unrelated to this story's ACs.
- **Story 0.i6b/0.i6c's own adoption work** (Post Selection page, Settings list `variant` prop) — this story only builds the detail-context toggle those future stories will eventually route to; it does not adopt the card into either surface.
- **The `useSoftDeleteWithUndo`/undo-toast pattern for event-detail unsubscribe** — explicitly not used, per the reasoned Design Decision in Dev Notes; flagged in the Pre-Coding Approval Gate for explicit sign-off, not silently absorbed.
- **Error-state handling for `useGetMySubscriptionsQuery`/`useGetMyApiKeysQuery`-style failures** — `EventDetailWrapper.tsx` does not destructure or handle `error` from `useGetMySubscriptionsQuery` today, and this story does not add it; matches this file's existing style for several other read queries in the same component.
- **A dedicated `SubscriptionPicker.test.tsx`** — none exists today; this story's Task 1 refactor is verified via its one existing rendering call site rather than by retroactively building full unit coverage for an untested file, per minimal-diff scope.

## Definition of Done

- [x] AC 1-10 satisfied.
- [x] Required tests passing (Task 8 + Testing Requirements).
- [x] Lint and type checks passing for `packages/ui` and `apps/web`.
- [x] Pre-Coding Approval Gate's no-undo-toast Design Decision explicitly confirmed by the user (`AskUserQuestion`, "Approve as written") before this story is marked done.

## Completion Status

- [x] Complete — all tasks/subtasks done, all ACs satisfied, tests/lint/build green.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm --filter ui test -- --run`: 51 test files, 493/493 tests passing.
- `pnpm --filter web test -- --run`: 60 test files, 370/370 tests passing.
- `pnpm lint` (repo root): clean — 6/6 tasks successful, only pre-existing warnings (no errors) across the touched packages.
- `pnpm build` (repo root): clean — 7/7 tasks successful, all 38 static pages generated.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Gate 1/2/3: no epic readiness report exists for Epic 0.i6, so all three gates were run fresh (dispatched to subagents with the architect/UX analytical lenses respectively) rather than cited from a swept report — all three returned no gap.
- Two design decisions requiring explicit human sign-off before implementation: (1) no undo-toast for event-detail unsubscribe (recommended, reasoned in Dev Notes); (2) toggle icon choice `UserPlus`/`UserCheck` (already confirmed with the user during story creation, not pending).
- Story bundles two backlog items (IDEA-031, FIND-010's DW-009 slice) into one story per `event-pages-remaining-backlog-plan.md`'s "one story" call, homed under Epic 0.i6 (deviating from that plan's "no epic" framing) per the user's explicit choice during story creation.
- Pre-Coding Approval Gate: presented via `AskUserQuestion` at the start of this dev-story run (including the no-undo-toast design decision); user chose "Approve as written" — all gate items checked off and implementation proceeded immediately.
- Implemented Tasks 1-8 exactly as specified: extracted shared `PlatformIcon` to `packages/ui/src/core/platform-icon.tsx` (Task 1); added a `platform`-driven fallback branch to `AccountAvatar` (Task 2); rebuilt `SubscribedAccountCard`'s subscribe control as a single functional `data-testid="subscribe-toggle"` icon button covering subscribe/unsubscribe/pending/checking-status states (Task 3); wired real `removeSubscription` unsubscribe in `EventDetailWrapper.tsx` via `.find()`-captured `matchedSubscription.id`, the `!!session && isSubscriptionsPending` DW-009 loading gate, and `account_subscribed`/`account_unsubscribed` PostHog symmetry (Task 4); threaded the new props/labels through `EventDetailView.tsx`/`.types.ts` (Task 5); wired the 5 new label keys through `mapper.ts` (Task 6); added en/id locale strings (Task 7); updated/added tests across all 4 affected test files (Task 8).
- All verification-plan commands were actually executed (not inferred from the plan) and confirmed green: `packages/ui`/`apps/web` vitest suites, repo-root `pnpm lint`, repo-root `pnpm build`.

### File List

- `packages/ui/src/core/platform-icon.tsx` (new)
- `packages/ui/src/core/account-avatar.tsx` (modified)
- `packages/ui/src/core/account-avatar.test.tsx` (modified)
- `packages/ui/src/index.ts` (modified)
- `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx` (modified)
- `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` (modified)
- `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts` (modified)
- `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx` (modified)
- `packages/ui/src/features/events/EventDetailView.tsx` (modified)
- `packages/ui/src/features/events/EventDetailView.types.ts` (modified)
- `packages/ui/src/features/events/EventDetailView.test.tsx` (modified)
- `apps/web/src/features/events/EventDetailWrapper.tsx` (modified)
- `apps/web/src/features/events/EventDetailWrapper.test.tsx` (modified)
- `apps/web/src/features/events/mapper.ts` (modified)
- `apps/web/locales/en.json` (modified)
- `apps/web/locales/id.json` (modified)

## Change Log

- 2026-09-16: Story created via `bmad-create-story`. User confirmed via `AskUserQuestion`: (1) home under Epic 0.i6 as Story 0.i6f, bundled with FIND-010's DW-009 slice; (2) toggle icons `UserPlus`/`UserCheck`; (3) toggle must be fully functional (real unsubscribe), not visual-only. Gate 1/2/3 run fresh (no epic readiness report exists for Epic 0.i6) — all three no-gap. No-undo-toast design decision flagged for explicit confirmation before implementation.
- 2026-09-16: Implemented via `bmad-dev-story`. Pre-Coding Approval Gate approved as written by user (shulha) via `AskUserQuestion`. Tasks 1-8 completed: `PlatformIcon` extracted to `packages/ui/src/core/platform-icon.tsx`; `AccountAvatar` platform-icon fallback added; `SubscribedAccountCard` rebuilt as a functional two-state (+ pending/checking) icon toggle; `EventDetailWrapper.tsx` wired to the real `removeSubscription` mutation with the DW-009 `!!session`-gated loading fix and `account_subscribed`/`account_unsubscribed` PostHog symmetry; props threaded through `EventDetailView`; 5 new i18n keys added (en/id) and wired through `mapper.ts`; all Task 8 tests updated/added. Verification: `pnpm --filter ui test` (493/493), `pnpm --filter web test` (370/370), repo-root `pnpm lint` (clean, pre-existing warnings only), repo-root `pnpm build` (clean). Status moved to `review`.
