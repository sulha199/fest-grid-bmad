---
baseline_commit: b0ac649cb2de7d82e0218538621c3279c7a61967
---

# Story 4.9: Moderator accounts-tab card: default location display, edit, and clear

## Story Details

- Epic: 4
- Story ID: 4.9
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Sourced from backlog.yaml's IDEA-034 (carved 2026-09-15 from IDEA-032 §6). User decision to
promote to a story made 2026-10-06. Two design choices confirmed with the user via
AskUserQuestion during this story's creation (see Dev Notes "Design Decisions Confirmed With
User"): (1) the new clearAccountDefaultLocation mutation writes no defaultLocationChangeRequests
audit row and requires no DB migration (simplicity over full audit-trail parity); (2) the new
clear affordance extends the shared AccountLocationField component (packages/ui) with an
optional onClear prop, rather than bespoke local markup. Gate 1/2/3 all run fresh this session
(no gap found by any) via subagents adopting the Winston/Freya personas; Gate 2 additionally
corrected the clear icon from Trash2/text-destructive to MapPinOff/hover-reveal-destructive to
avoid misreading as "delete this account."
-->

## Story

As a moderator,
I want each account card on the Moderator Tools "Accounts" tab (`/moderator/tools?tab=accounts`) to show the account's current default location (or a "Set Location" prompt when unset), an edit-location action, and a new clear-location action,
so that I can review and correct an account's default location directly from the accounts list I already use for scraper/consent settings, instead of only being able to act on it reactively from `/moderator/items` when a change happens to be pending review, and so I can reset a wrong location to empty when no corrected value is known yet.

## Acceptance Criteria

1. **Given** `moderator-accounts.graphql`'s `QueryModeratorAccountProfiles` query today selects only `id`/`accountId`/`platform`/`displayName`/`username`/`isImageStorageOptedIn`,
   **When** this story ships,
   **Then** the query also selects `defaultLocation { formattedAddress placeName }` and `hasPendingDefaultLocationReview`, and the generated `@/generated/graphql` types/hooks pick up both fields through `pnpm --filter web codegen`.
2. **And** when an account's `defaultLocation` is set, the card renders it via the existing shared `AccountLocationField` (`packages/ui/src/features/locations/AccountLocationField.tsx` — already used by `/settings/subscriptions` and `/moderator/items`, not a new bespoke rendering), showing the location text, a `pendingReview` badge when `hasPendingDefaultLocationReview` is true, and the existing Pencil edit-icon button.
3. **And** when `defaultLocation` is unset, the card shows a plain-text "Set Location" trigger instead — matching `subscriptions-content.tsx`'s existing empty-state pattern (`apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx` lines ~266-276) byte-for-byte in structure (conditional render, not a change to `AccountLocationField` itself, which keeps returning `null` for a null location exactly as it does today).
4. **And** clicking the "Set Location" trigger (no existing location) opens `SetDefaultLocationDialog` (`apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx`) in `mode="set"`; clicking the Pencil icon (existing location) opens the same dialog in `mode="edit"` with `initialLocation` populated from the card's current `defaultLocation`. Both paths pass `asModeratorCorrection={true}` — this page is moderator-only, route-guarded via `useRequireModerator` (already used by `moderator-accounts-content.tsx`), matching `/moderator/items`'s existing wiring (`moderator-items-content.tsx` line ~444) and Architecture Spine AD-11's "additive auth, the calling page decides, not the viewer's role" precedent. The write self-resolves immediately via the existing `editAccountDefaultLocation`/`setAccountDefaultLocation` mutations' `changeSource: 'MODERATOR'` path — no pending-review state is created for the moderator's own edit, and no backend change is needed for this part (both mutations already exist and already support `asModeratorCorrection`).
5. **And** `AccountLocationField.types.ts` gains a new optional `onClear?: () => void` prop and an optional `clearLabel` field in `AccountLocationFieldLabels`. `AccountLocationField.tsx` renders a second icon-button only when `onClear` is provided, using lucide-react's `MapPinOff` icon (not `Trash2`), styled `text-muted-foreground hover:text-destructive transition-colors` at rest (matching the existing Pencil button's own hover-reveal convention, not a baseline destructive color — Gate 2 found a resting `Trash2`/`text-destructive` would misread as "delete this account," since that exact icon+color pairing already means "delete the whole subscription" one file over in `subscriptions-content.tsx` line ~296), `aria-label={labels.clearLabel}`. This is purely additive: both existing consumers (`/settings/subscriptions`, `/moderator/items`) omit `onClear`/`clearLabel` and render byte-for-byte unchanged — verified by the existing `AccountLocationField.test.tsx` suite passing unmodified plus new test cases added for the new prop (Task 4).
6. **And** only the Accounts-tab card passes `onClear` to `AccountLocationField` — `/settings/subscriptions` and `/moderator/items` are not touched by this story and do not gain a clear affordance.
7. **And** clicking the clear icon opens the reusable `ConfirmActionDialog` primitive (`packages/ui/src/core/confirm-action-dialog.tsx`, Story 0.47 — the same primitive already used by `duplicate-events-content.tsx` in this exact `moderator/tools` directory for an unrelated destructive merge-confirm) with `confirmVariant="destructive"` and copy that says "Clear location" (not "Delete"/"Remove" — per Gate 2's icon/copy finding, the destructive-red styling is reserved for the confirm dialog itself, not the resting icon).
8. **And** confirming calls a new `clearAccountDefaultLocation(accountId: ID!): SocialMediaAccountProfile!` mutation (`apps/backend/src/schema/social-media-accounts.graphql` + `resolvers.ts`) that:
   - Requires `requireModerator(context)` (`apps/backend/src/lib/auth/context.ts`) — no subscriber path at all, matching `setImageStorageOptIn`'s existing moderator-only shape; this action has no subscriber-facing equivalent anywhere in the product (clearing is exclusively a Moderator Tools correction, per the backlog row's own scope).
   - Throws `NOT_FOUND` (`extensions.code`) if no `socialMediaAccountProfiles` row matches `accountId`.
   - Throws `INVALID_STATE_TRANSITION` if `defaultLocation` is already `null` — mirroring `setAccountDefaultLocation`'s existing symmetric check (its mirror-image: that mutation throws `INVALID_STATE_TRANSITION` when `defaultLocation` is already non-null).
   - Otherwise, inside one `db.transaction` (Gate 1 finding — matching `applyDefaultLocationChange`'s own transactional pattern for the identical atomicity reason): sets `defaultLocation = null` on the profile row, and marks every still-open (`status IN ('PENDING_REVIEW', 'AWAITING_APPROVAL')`) `defaultLocationChangeRequests` row for that `accountId` as `SUPERSEDED` — mirroring `applyDefaultLocationChange`'s existing superseding `UPDATE` (`apps/backend/src/lib/accounts/apply-default-location-change.ts` lines ~100-112) and generalizing Architecture Spine AD-11 rule 3 ("any successful write supersedes stale pending requests") to the clear action.
   - Returns the updated profile, formatted via the existing `formatLocationDetails`/`buildOptimizedDrizzleSelect` pattern every sibling mutation in this file already uses (will simply return `defaultLocation: null`).
9. **And** the clear mutation deliberately does **not** call `applyDefaultLocationChange()` and does **not** insert a new `defaultLocationChangeRequests` row for the clear itself — that table's `newLocation` column is `jsonb(...).notNull()` (`packages/database/schema.ts` line ~836) and a clear has no new location value to log. This is a user-confirmed tradeoff (see Dev Notes), not an oversight — Gate 1 found no architectural issue with it (closed/superseded rows are inert history; nothing reads `defaultLocationChangeRequests` expecting it to reflect every past state, only the currently-open row if any).
10. **And** `SetDefaultLocationDialog` gains a new optional `onSaved?: () => void` callback, invoked only after a successful `setAccountDefaultLocation`/`editAccountDefaultLocation` call, immediately before the dialog's existing `queryClient.invalidateQueries`/`onClose()` calls. Its existing `onClose` prop is unsuitable for this because it already fires on cancel/backdrop-dismiss as well as on a successful save (`onOpenChange={(open) => !open && onClose()}` plus the explicit `onClose()` at the end of `handleSubmit`'s success path) — `onSaved` is additive and optional, so both existing callers (`subscriptions-content.tsx`, `moderator-items-content.tsx`) are unaffected (they simply don't pass it).
11. **And** the new accounts-tab call site uses `onSaved` to fire its own accurately-scoped PostHog events — `moderator_accounts_tab_default_location_set` (`{ accountId }`) and `moderator_accounts_tab_default_location_edited` (`{ accountId }`) — instead of relying on `SetDefaultLocationDialog`'s internal, subscription-scoped `subscription_default_location_set`/`subscription_default_location_edited` events (which keep firing unchanged on every call site, including this new one — this story adds a second, correctly-named event on top, it does not remove, rename, or gate the existing ones). `/moderator/items`'s pre-existing identical mislabeling — it already fires `subscription_default_location_edited` for a moderator-initiated edit — is a known, out-of-scope gap left untouched by this story.
12. **And** the clear action fires `moderator_accounts_tab_default_location_cleared` (`{ accountId }`) on successful confirm, and shows a success toast; a failed clear shows an error toast and leaves the `ConfirmActionDialog` open per that primitive's own documented contract (consumer flips `open` to `false` only once it knows the confirm succeeded).
13. **And** both `apps/web/locales/en.json` and `apps/web/locales/id.json` gain matching new keys under `ModeratorAccountsPage` (added to both files in the same change, per Story 0.50's locale-parity ratchet) for: `setDefaultLocationLabel`, `editDefaultLocationLabel`, `clearDefaultLocationLabel`, `pendingReviewBadgeLabel`, `clearLocationConfirmTitle`, `clearLocationConfirmDescription`, `clearLocationConfirmLabel`, `clearLocationCancelLabel`, `defaultLocationSetToast`, `defaultLocationEditedToast`, `defaultLocationClearedToast`, `defaultLocationClearErrorToast`.
14. **And** `pnpm --filter backend codegen` and `pnpm --filter web codegen` are both re-run after the schema/query changes, and their diffs are limited to the new mutation/fields (no unrelated regeneration noise beyond what codegen always touches in `resolvers-types.ts`/`apps/web/src/generated/graphql.ts`/`apps/web/src/gql/graphql.ts`).

## Tasks / Subtasks

- [ ] Task 1: Backend — add the `clearAccountDefaultLocation` mutation (AC8, AC9)
  - [ ] 1.1 Add `clearAccountDefaultLocation(accountId: ID!): SocialMediaAccountProfile!` to the `extend type Mutation` block in `apps/backend/src/schema/social-media-accounts.graphql`, alongside `setAccountDefaultLocation`/`editAccountDefaultLocation`.
  - [ ] 1.2 Implement the resolver in `apps/backend/src/schema/resolvers.ts` (near `setAccountDefaultLocation`/`editAccountDefaultLocation`): `requireModerator(context)` → look up the profile row (`NOT_FOUND` if missing) → `INVALID_STATE_TRANSITION` if `defaultLocation` already `null` → `db.transaction` wrapping (a) `update(socialMediaAccountProfiles).set({ defaultLocation: null })` and (b) `update(defaultLocationChangeRequests).set({ status: 'SUPERSEDED' }).where(accountId match AND status IN ('PENDING_REVIEW','AWAITING_APPROVAL'))` → re-select and return via the existing `buildOptimizedDrizzleSelect`/`formatLocationDetails` pattern.
  - [ ] 1.3 Run `pnpm --filter backend codegen` and confirm the diff to `apps/backend/src/generated/resolvers-types.ts` is limited to the new mutation's types (AC14).
- [ ] Task 2: packages/ui — extend `AccountLocationField` with the optional clear affordance (AC5, AC6)
  - [ ] 2.1 Add `onClear?: () => void` and `clearLabel?: string` (on `AccountLocationFieldLabels`) to `AccountLocationField.types.ts`.
  - [ ] 2.2 In `AccountLocationField.tsx`, import `MapPinOff` from `lucide-react` alongside the existing `Pencil` import; render the new icon-button conditionally (`{onClear && (...)}`) next to the existing Pencil button, `text-muted-foreground hover:text-destructive transition-colors` at rest (not the Pencil button's own `hover:text-foreground` — this one specifically hover-reveals destructive-red, per Gate 2), `aria-label={labels.clearLabel}`.
  - [ ] 2.3 Add new test cases to `AccountLocationField.test.tsx`: renders no second icon when `onClear` omitted (regression-proves the two existing consumers are unaffected); renders the `MapPinOff` button and calls `onClear` on click when provided.
- [ ] Task 3: apps/web — extend `SetDefaultLocationDialog` with `onSaved` (AC10, AC11)
  - [ ] 3.1 Add optional `onSaved?: () => void` to `SetDefaultLocationDialogProps` in `set-default-location-dialog.tsx`.
  - [ ] 3.2 Call `onSaved?.()` in `handleSubmit`'s success path, after the existing `posthog.capture(...)`/`toast.success(...)` calls for both the `mode === "edit"` and `mode === "set"` branches, before `queryClient.invalidateQueries`/`onClose()`.
- [ ] Task 4: apps/web — extend the Accounts-tab GraphQL operations (AC1, AC8)
  - [ ] 4.1 In `moderator-accounts.graphql`, add `defaultLocation { formattedAddress placeName }` and `hasPendingDefaultLocationReview` to `QueryModeratorAccountProfiles`'s `node` selection.
  - [ ] 4.2 Add a new `mutation ClearAccountDefaultLocation($accountId: ID!) { clearAccountDefaultLocation(accountId: $accountId) { id accountId defaultLocation { formattedAddress placeName } } }` operation to the same file.
  - [ ] 4.3 Run `pnpm --filter web codegen` and confirm the diff to `apps/web/src/generated/graphql.ts`/`apps/web/src/gql/graphql.ts` is limited to these additions (AC14).
- [ ] Task 5: apps/web — wire the new hook (AC8)
  - [ ] 5.1 Add `useClearAccountDefaultLocationMutation()` to `moderator-accounts-hooks.ts`, mirroring `useSetImageStorageOptInMutation`'s existing wrapper shape (`mutateAsync({ accountId }) => result.clearAccountDefaultLocation`, `isPending`).
- [ ] Task 6: apps/web — render the card's location UI (AC2, AC3, AC4, AC7, AC12)
  - [ ] 6.1 In `moderator-accounts-content.tsx`, add local state for the active `SetDefaultLocationDialog` (`accountId`/`mode`/`initialLocation`) and the active clear-confirm target (`clearingAccountId`).
  - [ ] 6.2 Below each account's existing displayName/platform/username block, render: `account.defaultLocation ? <AccountLocationField location={...} isPendingReview={...} onEdit={...} onClear={() => setClearingAccountId(account.id)} labels={{...}} /> : <button>{t("setDefaultLocationLabel")}</button>` — mirroring `subscriptions-content.tsx`'s exact conditional structure.
  - [ ] 6.3 Render one `SetDefaultLocationDialog` (mode/accountId/initialLocation driven by state), `asModeratorCorrection`, and `onSaved` firing the AC11 analytics events.
  - [ ] 6.4 Render one `ConfirmActionDialog` (title/description/labels from the new i18n keys, `confirmVariant="destructive"`), calling the Task 5 hook's `mutateAsync` on confirm, firing the AC12 analytics event and toast, then `refetchAccounts()` and closing.
- [ ] Task 7: i18n (AC13)
  - [ ] 7.1 Add the 12 new keys listed in AC13 to `apps/web/locales/en.json`'s `ModeratorAccountsPage` block.
  - [ ] 7.2 Add the matching Indonesian translations to `apps/web/locales/id.json`'s `ModeratorAccountsPage` block, in the same change.
- [ ] Task 8: Tests (AC1-AC13)
  - [ ] 8.1 Backend: add a `clearAccountDefaultLocation` integration test in `apps/backend/src/schema/social-media-accounts.test.ts`, mirroring the existing `setAccountDefaultLocation`/`editAccountDefaultLocation` test structure — covers: success (clears a set location, returns `defaultLocation: null`), `INVALID_STATE_TRANSITION` when already null, `NOT_FOUND` for a bad `accountId`, `FORBIDDEN`/non-moderator rejection, and that an open `defaultLocationChangeRequests` row for that account is superseded by the clear.
  - [ ] 8.2 packages/ui: Task 2.3's new `AccountLocationField.test.tsx` cases.
  - [ ] 8.3 apps/web: extend `moderator-accounts-content.test.tsx` with cases for: rendering the location text when `defaultLocation` is set, rendering the "Set Location" trigger when unset, opening the clear confirm dialog and calling the clear mutation on confirm, success/error toasts for the clear path.
- [ ] Task 9: Verification pass (all ACs)
  - [ ] 9.1 `pnpm --filter backend test` (scoped, foreground).
  - [ ] 9.2 `pnpm --filter backend lint` (scoped, foreground).
  - [ ] 9.3 `pnpm --filter @festgrid/ui test` and `pnpm --filter @festgrid/ui lint` (scoped, foreground).
  - [ ] 9.4 `pnpm --filter web test` and `pnpm --filter web lint` (scoped, foreground).
  - [ ] 9.5 Confirm `pnpm-lock.yaml` is unchanged (no new dependency added by this story).

## Dev Notes

- **Design Decisions Confirmed With User (2026-10-06, during story creation via `AskUserQuestion`):**
  1. **Clear-mutation audit scope:** chose "no audit row, no migration" over "full audit parity" — `clearAccountDefaultLocation` nulls `defaultLocation` and supersedes open `defaultLocationChangeRequests` rows, but writes no new audit row for the clear itself (that table's `newLocation` column is `NOT NULL`; making it nullable plus adding a `CLEARED` case would require a Drizzle migration and widening the GraphQL/TS types that assume `newLocation` is always a real `LocationDetails` object — out of proportion to this backlog row's `effort: s` sizing). Gate 1 independently confirmed this is a sound tradeoff, not a gap (closed/superseded rows are inert history; nothing reads them expecting full consistency with current state).
  2. **Clear-icon placement:** chose "extend `AccountLocationField`" over "bespoke local markup in `moderator-accounts-content.tsx`" — the shared component gains an optional, purely-additive `onClear`/`clearLabel` pair. Gate 2 confirmed this is small and mechanical enough to build inline (not a prerequisite foundational story), and separately caught that the originally-proposed `Trash2`/`text-destructive` icon pairing would misread as "delete this account" (it's the exact pairing `subscriptions-content.tsx` already uses for deleting a whole subscription) — corrected to `MapPinOff` with hover-reveal-only destructive color.
- **Why `asModeratorCorrection` is always `true` from this page, not a user-facing choice:** `moderator-accounts-content.tsx` is already route-guarded via `useRequireModerator()` (every viewer who can reach this card is a moderator) — matching the one other moderator-only call site, `/moderator/items`'s `moderator-items-content.tsx`, which passes the same flag unconditionally for the same reason (Architecture Spine AD-11: "the page decides, not an ambient role check"). `/settings/subscriptions` is the opposite case (always omits the flag, even for a viewer who happens to also be a moderator) — the two pages' existing behavior is the precedent this story's new call site follows, not a new decision.
- **Why the new mutation is moderator-only with no additive-subscriber path (unlike `editAccountDefaultLocation`'s AD-11 shape):** AD-11 governs mutations that are *subscriber-scoped first*, with a moderator override bolted on as a second auth path. `clearAccountDefaultLocation` has no subscriber-facing equivalent anywhere in the product — a subscriber can set/edit a default location but there is no "clear my own account's location" feature request anywhere in the PRD or backlog. It is a new, standalone moderator-only mutation (same shape as the already-existing `setImageStorageOptIn`), not a fork of an existing subscriber mutation — so it correctly does not need AD-11's additive-auth pattern.
- **`SetDefaultLocationDialog`'s existing internal PostHog events are left unchanged on purpose:** `subscription_default_location_set`/`subscription_default_location_edited` keep firing exactly as today from every call site (including the new one). This story adds a second, accurately-named event via the new `onSaved` callback rather than touching the internal ones — fixing `/moderator/items`'s pre-existing identical mislabeling is a separate, out-of-scope cleanup (flagged, not silently absorbed into this story's scope).
- **`AccountLocationField`'s empty-state null-return behavior is unchanged:** the component still renders `null` when `location` is falsy; the Accounts-tab card handles the "no location yet" case itself with its own local conditional, exactly mirroring `subscriptions-content.tsx`'s existing pattern (same text-button styling, same `t("setDefaultLocationLabel")` key name — reused verbatim, not reinvented, even though it lives in a different translation namespace, `ModeratorAccountsPage` vs. `SubscriptionsPage`).
- **`lucide-react@0.473.0` (the version `packages/ui` depends on, confirmed in `packages/ui/package.json`) ships `MapPinOff` — verified present in the installed package's `dist/esm/icons/map-pin-off.js` this session, not assumed from name alone.

### Architecture & UX Gate Findings

- Epic 4's readiness report (`_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`, `swept: true`, dated 2026-08-11) covers only Stories 4.1a-4.8 and predates this backlog row (IDEA-034 carved 2026-09-15) — it does not cover this story's scope. Per the lightweight escape-hatch guard, this story introduces a brand-new backend mutation, which an epic-wide sweep predating the row couldn't have anticipated — so Gate 1 and Gate 3 were both run fresh this session (not skipped/cited from the sweep), alongside Gate 2 (always run fresh per the workflow).
- **Gate 1 (Architecture/Infrastructure Completeness, Winston lens, run fresh): No gap found.** A dedicated `clearAccountDefaultLocation` mutation is the right shape — not a shoehorn into `editAccountDefaultLocation` (which throws `BAD_REQUEST` on empty input by design) nor a generic PATCH-style mutation (no precedent in this schema; every account mutation here is a narrow, named verb, closest sibling `setImageStorageOptIn`). The design's explicit supersede-open-rows step closes the one real risk (a stale `PENDING_REVIEW`/`AWAITING_APPROVAL` row on `/moderator/items` referencing a `previousLocation` that no longer matches reality after a clear with no logged event) — `/moderator/items` only ever surfaces open-status rows, and those are explicitly superseded. The moderator-only gate (no subscriber path) is correctly scoped — mirrors `setImageStorageOptIn` exactly, and there is no subscriber-facing analog needing `editAccountDefaultLocation`'s dual-path shape. One correction folded into AC8/Task 1.2: wrap the update + supersede in `db.transaction`, matching `applyDefaultLocationChange`'s own pattern, so a clear can't succeed while the supersede silently fails under a mid-request error. No IaC/infra gap.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston lens, run fresh): No gap found.** i18n: routine, both locale files, no foundation gap (AC13). Analytics: the additive `onSaved?: () => void` callback is the right mechanism — `SetDefaultLocationDialog`'s existing `onClose` fires on cancel/dismiss *and* success alike, so it can't be reused to gate a fired-only-on-success event; a dedicated `onSaved` is additive, zero-risk to the one other caller, and avoids touching `/moderator/items`. No cross-epic foundational dependency is missing — this is a narrow, one-off clear action on an existing field, not a generalizable "corrections" pattern that should be routed through some other unbuilt mechanism instead.
- **Gate 2 (UI Complexity & Reusability, Freya lens, run fresh): No gap found, two refinements folded into the ACs above.** The `AccountLocationField` split-out question: no gap — the component already returns `null` for no-location (unchanged), and adding `onClear?`/`clearLabel` is a 3-4 line, purely additive change (one more button beside the existing Pencil, same styling family, no new state machine, no role logic inside the component — EXPERIENCE.md's "no role-branching inside it" principle holds) — too small and mechanical to warrant a prerequisite foundational story. `ConfirmActionDialog`/`SetDefaultLocationDialog` reuse is appropriate, no strain — `duplicate-events-content.tsx`'s existing usage is structurally identical to what's proposed here. The "Set Location" text-link duplication (now 2 occurrences: `subscriptions-content.tsx` and this story's new card — `/moderator/items` never has a no-location state) doesn't clear the rule-of-three extraction bar; left inline. **Correction applied:** the originally-proposed `Trash2`/`text-destructive` resting-state icon would read as "delete this account" (the exact pairing already used one file over, `subscriptions-content.tsx` line ~296, for deleting a whole subscription) — changed to `MapPinOff` with `text-muted-foreground hover:text-destructive` (matching the Pencil button's own hover-reveal convention), and copy "Clear location," not "Delete"/"Remove" — destructive-red stays reserved for the confirm dialog itself.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** No Drizzle schema change, no new/altered DB column, and no migration — the new mutation reads/writes the already-existing nullable `socialMediaAccountProfiles.defaultLocation` jsonb column and the already-existing `defaultLocationChangeRequests.status` enum column (setting it to the already-existing `SUPERSEDED` value); nothing new is added to either table.
- Impacted fields/contracts: `SocialMediaAccountProfile.defaultLocation` (GraphQL) — already nullable (`LocationDetails` with no `!`), so returning `null` after a clear requires no schema change on the output side either. The new `clearAccountDefaultLocation(accountId: ID!): SocialMediaAccountProfile!` mutation is a new contract, but reuses existing input/output types verbatim (`ID!` argument, existing `SocialMediaAccountProfile` return type) — no new GraphQL input type.
- Required DB migration changes: None.
- Required TypeScript type changes: None to any shared/domain/database type. `AccountLocationFieldProps`/`AccountLocationFieldLabels` (packages/ui) and `SetDefaultLocationDialogProps` (apps/web) each gain one new *optional* field — additive, non-breaking for every existing call site and consumer.
- Backward compatibility and rollout notes: Fully additive end to end — new optional component props, a new mutation, new query fields requested only by the one query that adds them. No existing consumer of `AccountLocationField`, `SetDefaultLocationDialog`, `moderator-accounts.graphql`'s existing operations, or `social-media-accounts.graphql`'s existing mutations changes behavior.
- Verification checks: Task 8's new/extended tests (backend integration test for the new mutation's four behaviors; packages/ui test for the new prop's presence/absence; apps/web test for the card's set/edit/clear UI) plus Task 9's scoped lint/type/test passes across `backend`, `@festgrid/ui`, and `web` prove end-to-end alignment.

### Project Structure Notes

- Backend changes confined to `apps/backend/src/schema/social-media-accounts.graphql` and `apps/backend/src/schema/resolvers.ts` (new mutation, placed alongside its siblings `setAccountDefaultLocation`/`editAccountDefaultLocation`) — matches this file's existing one-resource-per-`.graphql`-file, flat-resolvers-map convention.
- `packages/ui` change confined to `src/features/locations/AccountLocationField.tsx`/`.types.ts`/`.test.tsx` — no new file, same `features/<domain>/` placement the component already uses (not promoted to `core/`, since it remains domain-specific to account-location display, unchanged by this story).
- `apps/web` changes confined to `moderator-accounts-content.tsx`/`-hooks.ts`/`.graphql` (new UI, hook, operations) and `set-default-location-dialog.tsx` (one new optional prop) — no new files, no new directories.
- No conflict with established structure conventions anywhere in this story's scope.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.9] — originating AC/Note text.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-034] — backlog row this story promotes (carved 2026-09-15 from IDEA-032 §6).
- [Source: apps/backend/src/schema/social-media-accounts.graphql, apps/backend/src/schema/resolvers.ts#setAccountDefaultLocation,editAccountDefaultLocation] — existing sibling mutations and their validation/auth shape this story's new mutation follows.
- [Source: apps/backend/src/lib/accounts/apply-default-location-change.ts] — existing superseding-transaction pattern this story's new mutation's transaction mirrors.
- [Source: packages/database/schema.ts#defaultLocationChangeRequests] — confirms `newLocation` is `NOT NULL`, the reason the clear mutation writes no audit row.
- [Source: packages/ui/src/features/locations/AccountLocationField.tsx,.types.ts,.test.tsx] — existing reusable component this story extends additively.
- [Source: packages/ui/src/core/confirm-action-dialog.tsx,.types.ts] — Story 0.47's reusable confirm/cancel primitive, reused here.
- [Source: apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx, subscriptions-content.tsx] — existing dialog and empty-state pattern this story reuses/extends.
- [Source: apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx#L436-446, pending-location-change-row.tsx] — existing `asModeratorCorrection` call-site precedent.
- [Source: apps/web/src/app/[locale]/moderator/tools/moderator-accounts-content.tsx,-hooks.ts,.graphql,.test.tsx] — files this story extends.
- [Source: apps/web/src/app/[locale]/moderator/tools/duplicate-events-content.tsx] — existing `ConfirmActionDialog` usage precedent in this exact directory.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8, AD-11] — Soft-Delete Convention (confirmed not applicable — this is an ordinary nullable-field update, not a table-row soft-delete) and Moderator Override on Subscriber-Scoped Mutations (precedent for `asModeratorCorrection`/"page decides" and the superseding-pending-requests rule, generalized here to the clear action).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Account Location Field, #Account Settings & Moderator Tools Shells] — "one component, two call sites, no role-branching inside it" principle (now three call sites, still no role-branching inside the component) and the `/moderator/tools` shell's existing Accounts tab.
- [Source: apps/web/locales/en.json, id.json#ModeratorAccountsPage] — existing namespace this story's new keys are added to.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and execution protocol applied fresh above.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical section order and status vocabulary this file follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` — API Style (GraphQL for all client-server data), Database Access (Drizzle ORM only), UI Patterns (Blocking loader for the set/edit/clear mutations via existing `BlockingLoader` usage in `SetDefaultLocationDialog` and a new one in the accounts-tab content for the clear action), State Management (Server State via React Query/`graphql-request`, unchanged pattern), i18n (next-intl, both locale files).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — §3.9.3 (Moderator Tools interfaces), §3.7 (Default Location set/edit/moderator-override semantics, already-implemented mutations this story reuses).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (Soft-Delete Convention, confirmed not applicable) and AD-11 (Moderator Override, precedent for this story's `asModeratorCorrection`/superseding-requests design).
- [x] `docs/infrastructure/index.md` — not applicable; no backend compute/queue/EventBridge/API Gateway/DB-provisioning change, confirmed via the index summary (frontend + one ordinary GraphQL mutation only).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- `apps/backend/src/schema/social-media-accounts.graphql` — add `clearAccountDefaultLocation` mutation signature (Task 1.1).
- `apps/backend/src/schema/resolvers.ts` — add the `clearAccountDefaultLocation` resolver (Task 1.2).
- `apps/backend/src/generated/resolvers-types.ts` — regenerated (Task 1.3).
- `packages/ui/src/features/locations/AccountLocationField.types.ts` — add `onClear`/`clearLabel` (Task 2.1).
- `packages/ui/src/features/locations/AccountLocationField.tsx` — add the conditional `MapPinOff` button (Task 2.2).
- `packages/ui/src/features/locations/AccountLocationField.test.tsx` — new test cases (Task 2.3).
- `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx` — add `onSaved` prop and its two call sites (Task 3).
- `apps/web/src/app/[locale]/moderator/tools/moderator-accounts.graphql` — extend the query, add the mutation (Task 4.1-4.2).
- `apps/web/src/generated/graphql.ts`, `apps/web/src/gql/graphql.ts` — regenerated (Task 4.3).
- `apps/web/src/app/[locale]/moderator/tools/moderator-accounts-hooks.ts` — add `useClearAccountDefaultLocationMutation` (Task 5.1).
- `apps/web/src/app/[locale]/moderator/tools/moderator-accounts-content.tsx` — render location/edit/clear UI, wire dialogs and analytics (Task 6).
- `apps/web/src/app/[locale]/moderator/tools/moderator-accounts-content.test.tsx` — new test cases (Task 8.3).
- `apps/backend/src/schema/social-media-accounts.test.ts` — new integration test (Task 8.1).
- `apps/web/locales/en.json`, `apps/web/locales/id.json` — new `ModeratorAccountsPage` keys (Task 7).

### Rule Mapping

- AC1, AC14 → Task 4.1, 4.3 (query extension + codegen).
- AC2, AC3, AC4, AC6 → Task 6 (card rendering + dialog wiring).
- AC5 → Task 2 (`AccountLocationField` extension).
- AC7, AC12 → Task 6.4 (`ConfirmActionDialog` wiring + analytics/toast).
- AC8, AC9 → Task 1 (backend mutation).
- AC10, AC11 → Task 3 (`onSaved` + analytics).
- AC13 → Task 7 (i18n).
- AC14 → Task 1.3, 4.3 (codegen diffs).

### Verification Plan

- `pnpm --filter backend test` → new `clearAccountDefaultLocation` integration test green, all existing tests unaffected (AC8, AC9, Task 8.1).
- `pnpm --filter backend lint` → clean (Task 9.2).
- `pnpm --filter @festgrid/ui test` → `AccountLocationField.test.tsx` new + existing cases green (AC5, Task 8.2).
- `pnpm --filter @festgrid/ui lint` → clean (Task 9.3).
- `pnpm --filter web test` → `moderator-accounts-content.test.tsx` new + existing cases green (AC2-AC4, AC6, AC7, AC12, Task 8.3).
- `pnpm --filter web lint` → clean (Task 9.4).
- `git diff pnpm-lock.yaml` → empty (no new dependency; Task 9.5).
- All run in the foreground, package-scoped (`--filter backend`/`--filter @festgrid/ui`/`--filter web`), never a bare repo-wide `pnpm install`/`pnpm test`/`pnpm lint`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — location display + edit (existing mutations, new UI) + new clear mutation/UI on the Moderator Tools Accounts tab only; no change to `/settings/subscriptions` or `/moderator/items` behavior.
- [ ] Architecture and boundary confirmation — Gate 1/2/3 all run fresh this session, no gap found by any (two refinements folded into ACs: `db.transaction` wrap, `MapPinOff` icon correction).
- [ ] Testing plan confirmation — backend integration test for the new mutation (4 behaviors), packages/ui test for the new optional prop, apps/web test for the card's rendering/interaction — per Task 8.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A, no gap found by any gate; no prerequisite story/backlog entry required.

## Testing Requirements

- [ ] Integration tests: `apps/backend/src/schema/social-media-accounts.test.ts` — `clearAccountDefaultLocation` success, `INVALID_STATE_TRANSITION`, `NOT_FOUND`, non-moderator rejection, and open-request superseding (Task 8.1).
- [ ] Component/unit tests: `AccountLocationField.test.tsx` new cases (Task 8.2); `moderator-accounts-content.test.tsx` new cases (Task 8.3).
- [ ] E2E: not required — this story's interactions are fully covered by the component-level tests above (existing `moderator-accounts-content.test.tsx` suite has no E2E layer today; not introducing one here is consistent with that file's existing scope).

## Deliverables Checklist

- [ ] `clearAccountDefaultLocation` mutation implemented, moderator-only, transactional, superseding open requests, no new audit row.
- [ ] `AccountLocationField` carries the new optional `onClear`/`clearLabel`, both existing consumers unaffected.
- [ ] `SetDefaultLocationDialog` carries the new optional `onSaved`, both existing consumers unaffected.
- [ ] Moderator Accounts-tab card shows location/empty-state, edit icon (set/edit dialog, `asModeratorCorrection`), and clear icon (confirm dialog → new mutation).
- [ ] New accurately-scoped PostHog events (`moderator_accounts_tab_default_location_set`/`_edited`/`_cleared`) fire from the new call site.
- [ ] `en.json`/`id.json` both carry the 12 new `ModeratorAccountsPage` keys.
- [ ] Backend/frontend codegen re-run, diffs limited to the new additions.
- [ ] All new/extended tests green; scoped lint/test clean across `backend`, `@festgrid/ui`, `web`.

## Out of Scope

- Any change to `/settings/subscriptions` or `/moderator/items` behavior, copy, or analytics — including `/moderator/items`'s pre-existing `subscription_default_location_edited` mislabeling for its own moderator-initiated edits (flagged in Dev Notes, deliberately not fixed here).
- Full audit-trail parity for the clear action (a `defaultLocationChangeRequests` row logging the clear itself) — user-confirmed out of scope; would require a DB migration (see Dev Notes "Design Decisions Confirmed With User").
- Any new backend mutation or UI change to `/moderator/items`'s own pending-request rows.
- No Gate 1/2/3 gap was found, so no prerequisite story/backlog entry/additional `epics.md` story was required beyond this one.

## Definition of Done

- [ ] All Acceptance Criteria (1-14) satisfied.
- [ ] `pnpm --filter backend test` and `pnpm --filter backend lint` pass.
- [ ] `pnpm --filter @festgrid/ui test` and `pnpm --filter @festgrid/ui lint` pass.
- [ ] `pnpm --filter web test` and `pnpm --filter web lint` pass.
- [ ] `pnpm-lock.yaml` unchanged.
- [ ] Both `en.json`/`id.json` carry matching new keys (locale-parity ratchet, Story 0.50, stays green).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
