---
baseline_commit: d2afee54b15b519cb78db05f7ac93fdf31d3829f
---
# Story 3.3b: Edit an account's default location

## Story Details

- Epic: 3
- Story ID: 3.3b
- Story Key: 3-3b-edit-an-accounts-default-location
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to be able to view and edit the default location already set for a social media account I'm subscribed to,
so that I can correct or update it if it's wrong or outdated.

## Acceptance Criteria

1. **Given** I am on `/settings/subscriptions` (Story 3.2/3.3) and one of my active subscriptions' account already has a `SocialMediaAccountProfile.defaultLocation` set (Story 3.3), **when** the row renders, **then** the formatted location is shown along with an edit action (pencil/"Edit" affordance) — not the read-only-only display Story 3.3 shipped. [epics.md AC, EXPERIENCE.md "Default Location for a Subscribed Account"]
2. **And** clicking the edit action opens Story 3.3's `SetDefaultLocationDialog` in a new "edit mode" — the same `LocationPickerField`/`MapPickerSheet` experience Story 3.3 already built, reused rather than reinvented — prefilled with the account's current formatted address and coordinates. [epics.md AC, user-confirmed 2026-08-08: extend the existing dialog rather than build a literal in-table inline form]
3. **And** confirming a new location persists it onto `SocialMediaAccountProfile.defaultLocation` (never onto the `Subscription` row) via a new `editAccountDefaultLocation(accountId: ID!, input: SetAccountDefaultLocationInput!): SocialMediaAccountProfile!` mutation — **built and owned by this story**, backend-GraphQL-only (never a direct DB write from `apps/web`), reusing Story 3.3's `SetAccountDefaultLocationInput` (no new input type — same `placeId`/`latitude`/`longitude` shape), `resolveLocationInputMode`/Story 0.16's Geolocation adapter, and `formatLocationDetails`, exactly as `setAccountDefaultLocation` already does. [epics.md AC]
4. **And** the change is persisted to `SocialMediaAccountProfile.defaultLocation` immediately — there is no pre-approval gate blocking the save (FR66). [epics.md AC]
5. **And** the edit is performed via a backend GraphQL mutation, guarded by `requireAuth` (Story 0.17) — not a direct database write from `apps/web`. [epics.md AC]
6. **And** confirming the caller is an active subscriber of this account (to authorize the edit) uses `activeOnly(table)` (Story 0.22), not a hand-written `isNull(...)` clause — mirroring `setAccountDefaultLocation`'s existing check. [epics.md AC]
7. **And** the mutation rejects with a `GraphQLError` (`extensions.code = 'INVALID_STATE_TRANSITION'`) if the account has no `defaultLocation` set yet — editing requires an existing value; the first-time-set path is Story 3.3's `setAccountDefaultLocation`, not this mutation. [Derived — symmetric guard to `setAccountDefaultLocation`'s existing "already set" rejection]
8. **And** every edit inserts a new `DefaultLocationChangeRequest` row (PRD §4.14) capturing `accountId`, `changedByUserId` (the editing user), `previousLocation` (the account's `defaultLocation` immediately before this edit), `newLocation`, and `status: PENDING_REVIEW` — **regardless of whether an earlier edit on the same account is still `PENDING_REVIEW`** (stacking is allowed; no server-side guard blocks a second edit while a review is pending). [epics.md AC; user-confirmed 2026-08-08: allow stacking rather than blocking concurrent edits — see Dev Notes → Forward Note for Story 4.7 for the moderator-queue dedup contract this creates]
9. **And** saving the change triggers a best-effort email notification to every user with `role = 'moderator'` (`users` table, Story 0.17's role model), per FR67 — reusing Story 0.15's existing `sendTemplatedEmail` outbound email adapter (already `done`, already anticipates "moderator alerts" as a consumer per its own Note) via a new `DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT` template key, rather than introducing a new email pathway. A failed send (e.g. one moderator's address bounces) must never fail the mutation or block the save (FR66's "no pre-approval gate" extends to notification delivery too). [epics.md AC]
10. **And** every subscriber of this account will see the new `defaultLocation` applied to subsequent extractions, since the field is account-level, not per-subscriber (Story 3.3's amendment) — no change needed beyond what this story's mutation already does. [epics.md AC]
11. **And** `SocialMediaAccountProfile.hasPendingDefaultLocationReview: Boolean!` is exposed (a new computed field, resolved via an existence check against `DefaultLocationChangeRequest` rows with `status = PENDING_REVIEW` for that account) and selected by `getMySubscriptions` (Story 3.2/3.3's query) so `/settings/subscriptions` can render a "Pending Review" badge on the row, matching `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s "Default Location Pending Review" state pattern. [user-confirmed 2026-08-08 — absorbed into this story rather than left as a gap; see Dev Notes → Architecture & UX Gate Findings]
12. **And** all user-facing strings (edit action label, edit dialog title, "Pending Review" badge text, success/error toasts) are sourced through next-intl from Story 3.2/3.3's existing `SubscriptionsPage` namespace, with new entries added to both `apps/web/locales/en.json` and `apps/web/locales/id.json`. [project-context.md i18n rule, persistent fact]
13. **And** the save action is wrapped in `BlockingLoader` (a critical, persisted mutation), per `project-context.md`'s Loaders rule — matching Story 3.3's existing dialog behavior. [persistent fact]
14. **And** a `subscription_default_location_edited` (`{ accountId }`) PostHog analytics event fires on successful save. [persistent fact — AD-5]

## Tasks / Subtasks

- [ ] **Task 1: Database — `default_location_change_requests` table** (AC: 8)
  - [ ] **Sequencing check (Pre-Coding Approval Gate item):** confirm Story 3.3 (`setAccountDefaultLocation`, `social_media_account_profiles.default_location`) has landed before starting — this story's edit mutation depends on it.
  - [ ] Add to `packages/database/schema.ts`: a `defaultLocationChangeStatusEnum = pgEnum('default_location_change_status', ['PENDING_REVIEW', 'ACCEPTED', 'REVERTED'])` (matching PRD §4.14's `DefaultLocationChangeStatus` enum exactly) and a `defaultLocationChangeRequests` table: `id` (uuid pk), `accountId` (uuid, FK to `social_media_account_profiles.id`, not null), `changedByUserId` (uuid, FK to `users.id`, not null), `previousLocation` (jsonb, `LocationDetails`, nullable — always populated in practice by this story's flow since AC7 requires an existing value, but left nullable to match the PRD interface's `previousLocation?`), `newLocation` (jsonb, `LocationDetails`, not null), `status` (the new enum, default `PENDING_REVIEW`, not null), `reviewedByModeratorId` (uuid, FK to `users.id`, nullable), `reviewedAt` (timestamptz, nullable), `createdAt` (timestamptz, `defaultNow()`, not null). No `deletedAt`/soft-delete column — this table is explicitly excluded from AD-8's soft-delete binding (an audit/moderation-queue record, not user-owned data) and no `updatedAt` — the PRD interface only defines `createdAt`/`reviewedAt`.
  - [ ] Add a composite index `index('idx_default_location_change_requests_account_status').on(t.accountId, t.status)` — supports both this story's `hasPendingDefaultLocationReview` existence check and Story 4.7's future moderator-queue listing. A plain composite index, **not** a partial index scoped to `WHERE status = 'PENDING_REVIEW'` — AD-8 rule 3's documented `drizzle-kit` partial-index bug only needs to be worked around for AD-8-*bound* soft-delete tables; this table isn't one, so the simpler non-partial index avoids that workaround entirely.
  - [ ] Add `defaultLocationChangeRequestsRelations` (`accountProfile: one(socialMediaAccountProfiles, ...)`, `changedByUser: one(users, { fields: [changedByUserId] })`) following the existing relations pattern in `schema.ts`.
  - [ ] Run `pnpm --filter database run generate` (drizzle-kit) to produce the migration SQL file; commit it per AD-3.
- [ ] **Task 2: Backend — `editAccountDefaultLocation` schema and resolver** (AC: 3, 4, 5, 6, 7, 8)
  - [ ] Extend `apps/backend/src/schema/social-media-accounts.graphql` (Story 3.1a/3.3's file): add `hasPendingDefaultLocationReview: Boolean!` directly into the existing `type SocialMediaAccountProfile { ... }` block (AC11), and `extend type Mutation { editAccountDefaultLocation(accountId: ID!, input: SetAccountDefaultLocationInput!): SocialMediaAccountProfile! }` — reuses Story 3.3's `SetAccountDefaultLocationInput` as-is, no new input type.
  - [ ] Run `pnpm --filter backend run codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts`.
  - [ ] In `apps/backend/src/schema/resolvers.ts`, add `editAccountDefaultLocation` to the `Mutation` map, mirroring `setAccountDefaultLocation`'s structure (Story 3.3, same file): `requireAuth(context)`; look up the caller's active subscription via `activeOnly(subscriptions)` scoped to `eq(subscriptions.userId, authUser.userId)` and `eq(subscriptions.accountId, accountId)` — throw `NOT_FOUND` if none; look up the `social_media_account_profiles` row — throw `NOT_FOUND` if absent; if `defaultLocation` is `null`, throw `GraphQLError('No default location set yet', { extensions: { code: 'INVALID_STATE_TRANSITION' } })` (AC7); capture `previousLocation = profile.defaultLocation` before overwriting; call `resolveLocationInputMode(input)`/`resolveLocation(...)` exactly as `setAccountDefaultLocation` does to produce `newLocation`; `UPDATE social_media_account_profiles SET default_location = newLocation` (AC4); `INSERT INTO default_location_change_requests` with `{ accountId, changedByUserId: authUser.userId, previousLocation, newLocation, status: 'PENDING_REVIEW' }` — no pre-insert check for an existing pending row (AC8, stacking allowed); return the updated profile via `buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info)` + `formatLocationDetails`, matching `setAccountDefaultLocation`'s return shape.
  - [ ] After the insert (Task 2's resolver, same function): query `db.select().from(users).where(eq(users.role, 'moderator'))`; for each moderator, call `sendTemplatedEmail('DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT', moderator.email, { accountDisplayName, previousLocationText, newLocationText, moderatorReviewUrl })` (Task 3) wrapped so a rejected promise is caught and logged (`console.error`), never re-thrown — use `Promise.allSettled` across all moderators so one failure doesn't stop the others, and the overall notification step never blocks or fails the mutation's own return (AC9).
  - [ ] Add a `SocialMediaAccountProfile: { hasPendingDefaultLocationReview: async (parent) => {...} }` resolver map entry (a new top-level key in the `resolvers` export, alongside the existing `Subscription: {...}` entry): `SELECT id FROM default_location_change_requests WHERE account_id = parent.id AND status = 'PENDING_REVIEW' LIMIT 1`, return `rows.length > 0` (AC11). `buildOptimizedDrizzleSelect` already safely ignores this field when building `social_media_account_profiles` selects (it only maps GraphQL field names that match real Drizzle columns), so no change needed there.
  - [ ] Create/extend `apps/backend/src/schema/social-media-accounts.test.ts` (Story 3.3's file) covering: happy path via `placeId`; happy path via `latitude`/`longitude`; rejects with `INVALID_STATE_TRANSITION` when `defaultLocation` is not yet set; rejects with `NOT_FOUND` when the caller has no active subscription to the account; rejects with `NOT_FOUND` for a non-existent `accountId`; requires authentication; a `default_location_change_requests` row is inserted with the correct `previousLocation`/`newLocation`/`status: PENDING_REVIEW`; a second edit while an earlier request is still `PENDING_REVIEW` succeeds and inserts a *second* row rather than being rejected (AC8); moderator emails are attempted for every `role = 'moderator'` user and a rejected `sendTemplatedEmail` call does not fail the mutation (mock `sendTemplatedEmail` to reject once and assert the mutation still resolves).
  - [ ] Add a unit/integration test for the new `SocialMediaAccountProfile.hasPendingDefaultLocationReview` resolver: `true` when a `PENDING_REVIEW` row exists for the account, `false` when none exists.
- [ ] **Task 3: Backend — email template** (AC: 9)
  - [ ] Add `DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT` to `packages/domain/src/email/types.ts`'s `EmailTemplateKey` union and `EmailTemplateVariables` (`{ accountDisplayName: string; previousLocationText: string; newLocationText: string; moderatorReviewUrl: string }`).
  - [ ] Add the matching entry to `packages/domain/src/email/templates.ts`'s `EMAIL_TEMPLATES`, mirroring `DANGEROUS_EVENT_MODERATOR_ALERT`'s structure/tone exactly (subject referencing the account, html/text bodies showing the previous → new location change and a link to `{{moderatorReviewUrl}}`).
  - [ ] Extend `packages/domain/src/email/render-template.test.ts` with a case for the new template key (interpolation only — matches the existing per-key test pattern).
- [ ] **Task 4: Backend — `WEB_APP_BASE_URL` env var for `moderatorReviewUrl`** (AC: 9)
  - [ ] Add `webAppBaseUrl: string` to `apps/backend/src/env.ts`'s `BackendEnv` interface and `loadBackendEnv()`, sourced from `process.env.WEB_APP_BASE_URL`, defaulting to `'http://localhost:3000'` when unset (mirrors `geminiModel`'s default-value pattern in the same file — this is the first consumer of `sendTemplatedEmail` in real resolver code, so no base-URL env var exists yet anywhere in the backend).
  - [ ] Add `WEB_APP_BASE_URL` to `.env.example` with a comment noting it's used to build the moderator-review link in outbound emails (e.g. `WEB_APP_BASE_URL=https://festdaily.app` for production).
  - [ ] In the resolver (Task 2), build `moderatorReviewUrl` as `` `${loadBackendEnv().webAppBaseUrl}/moderator/items` `` — the same route named in `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (`/moderator/items`, Story 4.7, not yet built) that `DANGEROUS_EVENT_MODERATOR_ALERT` already points to by convention.
- [ ] **Task 5: Frontend — GraphQL query/mutation and codegen** (AC: 3, 11)
  - [ ] Extend `apps/web/src/features/subscriptions/queries.graphql`'s `getMySubscriptions` operation (Story 3.2/3.3's file): add `hasPendingDefaultLocationReview` inside the existing `account { ... }` selection, alongside `defaultLocation`.
  - [ ] Add to `apps/web/src/features/subscriptions/mutations.graphql` (Story 3.2/3.3's file):
    ```graphql
    mutation editAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
      editAccountDefaultLocation(accountId: $accountId, input: $input) {
        id
        defaultLocation {
          coordinates {
            lat
            lng
          }
          formattedAddress
          placeName
        }
        hasPendingDefaultLocationReview
      }
    }
    ```
  - [ ] Run `pnpm --filter web run codegen` to regenerate `apps/web/src/generated/graphql.ts` with the updated `GetMySubscriptionsQuery` shape and the new `useEditAccountDefaultLocationMutation` hook.
- [ ] **Task 6: Frontend — extend `SetDefaultLocationDialog` with an edit mode** (AC: 1, 2, 3, 4, 11, 13, 14)
  - [ ] Extend `apps/web/src/app/[locale]/settings/subscriptions/set-default-location-dialog.tsx` (Story 3.3's file) with a `mode: 'set' | 'edit'` prop (default `'set'`, preserving Story 3.3's existing behavior/call site unchanged) and an optional `initialLocation?: LocationDetails` prop (required when `mode === 'edit'`).
  - [ ] When `mode === 'edit'` and the dialog opens: initialize `addressSearch` from `initialLocation.formattedAddress` (or `placeName` as fallback) and `pendingCoords`/`mapViewState` from `initialLocation.coordinates` — reusing the exact same `resolvedPreview`/`LocationPickerField` rendering path Story 3.3 already built for the coordinate-capture flow (AC2), rather than a separate prefill code path. The user can re-search/re-pick to change the value, or submit unchanged.
  - [ ] Branch the submit handler on `mode`: `'set'` calls `useSetAccountDefaultLocationMutation` (unchanged, Story 3.3); `'edit'` calls the new `useEditAccountDefaultLocationMutation` (Task 5) with the same `accountId`/`input` shape (AC3).
  - [ ] Branch dialog title/success-toast copy on `mode` (Task 8's new i18n keys) — title becomes `t("defaultLocationEditDialogTitle")`, success toast becomes `t("defaultLocationEditedToast")`, which also acknowledges the change was sent for moderator review (matching `EXPERIENCE.md`'s "informative, not alarming" confirmation-copy requirement for the "Default Location Pending Review" pattern).
  - [ ] On successful edit-mode save: invalidate/refetch `getMySubscriptions` (so the row's `hasPendingDefaultLocationReview` updates to `true`), fire `subscription_default_location_edited` (`{ accountId }`) via `usePostHog()` (AC14), keep the existing `BlockingLoader` wrapping (AC13, unchanged from Story 3.3).
  - [ ] Extend `set-default-location-dialog.test.tsx` (Story 3.3's file): edit-mode prefill renders the existing address/coordinates; edit-mode submit calls `useEditAccountDefaultLocationMutation` (not `useSetAccountDefaultLocationMutation`); edit-mode success shows the edit-specific toast copy and fires `subscription_default_location_edited`.
- [ ] **Task 7: Frontend — row edit action and "Pending Review" badge** (AC: 1, 11)
  - [ ] Extend `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` (Story 3.2/3.3's file): when `sub.account.defaultLocation` is present, render the formatted value alongside an inline edit action (a small pencil-icon button, matching this app's established inline-row convention — no extracted component, single consumer, trivial state — confirmed no Gate 2 gap) that opens `SetDefaultLocationDialog` with `mode="edit"` and `initialLocation={sub.account.defaultLocation}`. If `sub.account.hasPendingDefaultLocationReview` is `true`, render a "Pending Review" badge next to the location (a plain styled `<span>`, matching the existing inline platform-tag badge already in this file — no new `packages/ui` component, per `EXPERIENCE.md`'s "Default Location Pending Review" state pattern).
  - [ ] Track which account's edit dialog is open via a new `editingAccountId` state (parallel to the existing `selectedAccountId` used for the Story 3.3 "set" dialog — the two dialogs stay distinct instances since they're rendered by the same underlying `SetDefaultLocationDialog` component with different `mode`/`accountId`/`initialLocation` props, not merged into one shared piece of state, to keep the "set" and "edit" trigger call sites independent and avoid a stale-`initialLocation` bug if a user closes a "set" flow and immediately opens an "edit" flow for a different row).
  - [ ] Extend `subscriptions-content.test.tsx` (Story 3.2/3.3's file): row shows the edit action (not just read-only text) when `account.defaultLocation` is present; row shows a "Pending Review" badge when `account.hasPendingDefaultLocationReview` is `true`, and no badge when `false`; clicking the edit action opens `SetDefaultLocationDialog` with `mode="edit"` and the correct `accountId`/`initialLocation`.
- [ ] **Task 8: i18n — `SubscriptionsPage` namespace additions** (AC: 12)
  - [ ] Add to the existing `SubscriptionsPage` object in `apps/web/locales/en.json` (Story 3.2/3.3's namespace): `editDefaultLocationLabel` (edit action's accessible label), `defaultLocationEditDialogTitle`, `defaultLocationEditedToast` (acknowledges the save and that it's pending moderator review, per `EXPERIENCE.md`), `pendingReviewBadgeLabel`.
  - [ ] Mirror every new key into `apps/web/locales/id.json` with real Indonesian translations.
- [ ] **Task 9: Verification** (AC: all)
  - [ ] `pnpm --filter backend run test`, `pnpm --filter web run test` pass, including all new/extended test files, with no regression in existing suites (including Story 3.3's own `social-media-accounts.test.ts`, `set-default-location-dialog.test.tsx`, `subscriptions-content.test.tsx`).
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root, including new generated GraphQL types and the new Drizzle migration.
  - [ ] Manual smoke check (Completion Notes): as a user subscribed to an account with a default location already set, see the edit action on its row; open it, see the current value prefilled; change it and save — see the row update immediately to the new value and show a "Pending Review" badge; edit it again before any moderator action — confirm the save still succeeds (no error) and a second `default_location_change_requests` row exists for the account; confirm a moderator-role test user's inbox (or local-dev console log per Story 0.15a) shows a `DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT` email for each edit.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07, explicitly lists `3.3b` in `stories_covered`) — no Gate 1 gap (this story writes exclusively through backend GraphQL mutations, never a direct DB/domain write from `apps/web`, consistent with the sweep's explicit confirmation "3.1a/3.2/3.3/3.3b write via backend GraphQL mutations... never a direct DB/domain write from `apps/web`"); no Gate 3 gap (the sweep's `activeOnly(table)` AC correction was already applied directly to Story 3.3b's epics.md entry, and its cross-epic table-dependency check explicitly confirms "Epic 4's Stories 4.7/4.8... correctly declare `Depends on:` back to the specific Epic 3 stories that originate the tables/flags they read (3.1a, 3.2, 3.3a, **3.3b**, 3.5)" — i.e. this story originating the `default_location_change_requests` table for Story 4.7 to later read is already the sweep's expected, correctly-sequenced shape, not a missed gap).
  - **Lightweight guard (fresh, story-specific) — found three things the epic-wide sweep and epics.md's own AC text did not fully anticipate, all resolved with the user via `AskUserQuestion` before this story was drafted:**
    1. **UI trigger pattern.** `EXPERIENCE.md`'s literal user-flow text names an "In-Table Add Form" pattern for the default-location field, but Story 3.3's actual shipped implementation is a modal `Dialog` (`SetDefaultLocationDialog`), not an inline in-table form. Building this story's edit flow to the letter of the UX doc would have produced a visually/interactionally inconsistent pair of "set" vs. "edit" experiences on the same row. **User confirmed:** extend the existing dialog with an edit mode (Tasks 6-7) rather than build a new inline form — consistent with what's actually shipped, no new component.
    2. **"Pending Review" badge.** `EXPERIENCE.md`'s "Default Location Pending Review" state pattern explicitly requires the subscriptions row to show a "Pending Review" badge until a moderator resolves the change — but epics.md's own AC list for Story 3.3b never mentions exposing this via GraphQL or rendering it; only Story 4.7 (moderator-side page) was in scope for the *review* half of the flow. Left unaddressed, the subscriber-facing half of `EXPERIENCE.md`'s own state pattern would have shipped unimplemented. **User confirmed:** absorb it into this story (AC11, Tasks 2/5/7) — it's a small, single-consumer extension of the exact row/query this story is already modifying, not a Gate 2-worthy split (see Gate 2 below) and not Story 4.7's concern (that story owns the moderator's own accept/revert view, not the subscriber's badge).
    3. **Concurrent-edit handling.** Neither epics.md nor `EXPERIENCE.md` specifies what happens if a user edits an account's default location again while an earlier edit's `DefaultLocationChangeRequest` is still `PENDING_REVIEW`. **User confirmed:** allow stacking (AC8) — every edit always inserts a new row, no server-side block — **but** the moderator-facing queue (Story 4.7, out of scope here) must only ever surface one actionable item per account. See "Forward Note for Story 4.7" below for the exact contract this creates, since that story doesn't exist yet and must honor it when built.
  - **A fourth, smaller item resolved without a question (mechanical, no real tradeoff):** Story 0.15's `sendTemplatedEmail` adapter is `done` but has never actually been called from any resolver yet (only from its own adapter tests) — this story is its first real consumer. Confirmed **not** a gap: Story 0.15's own Note already lists "moderator alerts" as an anticipated consumer type, and this story only needs to add one template key (Task 3) plus one small `WEB_APP_BASE_URL` env var (Task 4) to use it — normal feature-scoped work, not a missing foundational layer.
- **Gate 2 (UI Complexity & Reusability):** Run fresh (this story postdates the swept sweep). **Verdict: No gap.** Every UI piece this story adds is either (a) reuse of an already-extracted `packages/ui` component (`LocationPickerField`/`MapPickerSheet`, Story 3.3d) via an existing `apps/web` dialog's new mode, or (b) trivial, single-consumer inline markup matching an already-established inline convention in the same file (`subscriptions-content.tsx`'s existing platform-tag `<span>` badge, the row's existing inline "Set Default Location" trigger). Nothing here is reused across ≥2 places, none of it has non-trivial standalone state — the bar Gate 2 exists to catch (per `story-split-gate.md`'s own definition) isn't met by an edit-mode prop and a conditional badge span.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one new table required.** `default_location_change_requests` (PRD §4.14's `DefaultLocationChangeRequest`) does not exist in `packages/database/schema.ts` today — this story creates it (Task 1), matching the project's established precedent of scoping a table to the story/epic that first needs to write it (e.g. Story 3.1a's `social_media_account_profiles`, Story 2.6a's `user_settings`) rather than to Epic 0.
- **Impacted contracts:** new `packages/database/schema.ts` table + enum (Task 1); new GraphQL `hasPendingDefaultLocationReview: Boolean!` field on `SocialMediaAccountProfile` and `editAccountDefaultLocation` mutation, added to Story 3.1a/3.3's `social-media-accounts.graphql` file (not redeclared elsewhere, reuses Story 3.3's `SetAccountDefaultLocationInput`); Story 3.2/3.3's `getMySubscriptions` query extended to select `hasPendingDefaultLocationReview` on `account`; new `apps/web/src/features/subscriptions/mutations.graphql` operation. Generated counterparts: `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (new `useEditAccountDefaultLocationMutation` hook, updated `GetMySubscriptionsQuery` shape). New `EmailTemplateKey`/`EmailTemplateVariables` entry in `packages/domain/src/email/types.ts` (Task 3). No `packages/shared-types` change — `LocationDetails` is reused as-is for both `previousLocation`/`newLocation`.
- **Required DB migration changes:** one new `drizzle-kit`-generated migration adding the `default_location_change_status` enum and `default_location_change_requests` table (Task 1), committed per AD-3. No changes to any existing table.
- **Required TypeScript type changes:** new `packages/database/schema.ts` exports (`defaultLocationChangeRequests`, `defaultLocationChangeStatusEnum`, relations) and the new codegen output above. No `packages/shared-types` change needed.
- **Backward compatibility and rollout notes:** purely additive — a new table, a new mutation, and a widened query selection on an already-additive field (Story 3.3's `defaultLocation`). `setAccountDefaultLocation` (Story 3.3) is completely untouched by this story; the two mutations coexist, gated by opposite `defaultLocation`-null-vs-set preconditions (AC7 vs. Story 3.3's AC6), so there is no shared-write race between them for the same account state.
- **Verification checks:** Task 2's extended `social-media-accounts.test.ts` asserts the edit mutation's guard conditions, the audit-row insert (including the stacking case), and the best-effort moderator-email behavior; Task 2's new resolver test asserts `hasPendingDefaultLocationReview`'s true/false cases; Task 6/7's frontend tests assert the edit-mode dialog and row badge/action rendering.

### Project Structure Notes

- **This story has a real code dependency on Story 3.3, which is `review` (implemented, not yet `done`) as of this story's creation** — it extends files Story 3.3 created (`social-media-accounts.graphql`, `resolvers.ts`'s `setAccountDefaultLocation`/`Subscription.account`, `subscriptions-content.tsx`, `set-default-location-dialog.tsx`, `queries.graphql`/`mutations.graphql`) and reuses Story 3.3d's `LocationPickerField`/`MapPickerSheet` (also `review`). Do not start Tasks 2/5-7 until Story 3.3 has landed (already coded per its own File List; confirm its tests are green before extending its files).
- New backend: none (Task 1 modifies `schema.ts` directly; Task 2 extends Story 3.3's existing `social-media-accounts.test.ts`).
- Modified backend: `packages/database/schema.ts` (new table/enum/relations, Task 1); `apps/backend/src/schema/social-media-accounts.graphql` (Story 3.1a/3.3's file — new field + `extend type Mutation`); `apps/backend/src/schema/resolvers.ts` (new `editAccountDefaultLocation` resolver, new `SocialMediaAccountProfile.hasPendingDefaultLocationReview` resolver); `packages/domain/src/email/{types.ts, templates.ts}` (new template key, Task 3); `apps/backend/src/env.ts` (new `webAppBaseUrl`, Task 4); `.env.example` (new `WEB_APP_BASE_URL`, Task 4).
- Modified frontend: `apps/web/src/features/subscriptions/{queries.graphql, mutations.graphql}` (Story 3.2/3.3's files); `apps/web/src/app/[locale]/settings/subscriptions/{set-default-location-dialog.tsx, set-default-location-dialog.test.tsx, subscriptions-content.tsx, subscriptions-content.test.tsx}` (Story 3.2/3.3's files); `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **No conflicts detected** with Story 3.3's already-shipped "first-time set" path — `setAccountDefaultLocation` and `editAccountDefaultLocation` are two distinct mutations gated by opposite preconditions on the same column; this story only ever reads/extends Story 3.3's files, it does not modify `setAccountDefaultLocation`'s own resolver body.
- **Forward Note for Story 4.7 (Moderator Items page, not yet created)** — a binding contract this story's stacking decision (AC8) creates: when Story 4.7 queries `default_location_change_requests` for its moderator queue, it must dedupe by `accountId` to surface only the **most-recently-created** `PENDING_REVIEW` row per account (`ORDER BY created_at DESC`, first row per `account_id`) — this story allows multiple stacked edits to accumulate `PENDING_REVIEW` rows for the same account before a moderator acts, but only the latest reflects the account's actual current `defaultLocation` (which always reflects the *latest* edit regardless of review status, per AC4/FR66) and is the one a moderator's accept/revert action should be evaluated against. When Story 4.7 resolves the latest row (accept or revert), it must also mark every older still-`PENDING_REVIEW` row for that same `accountId` as resolved (e.g. `ACCEPTED`, mirroring whatever the latest row's outcome was) rather than leaving them permanently stuck in `PENDING_REVIEW` with no further UI ever surfacing them — otherwise they'd silently accumulate as orphaned rows. This story does not implement any of Story 4.7's read/accept/revert logic — it only guarantees the write-side data (`previousLocation` on each row is always the value immediately before *that specific* edit, so the chain is reconstructable) is correct for Story 4.7 to build against.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3b] — this story's authoritative AC.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] — the prerequisite "first-time set" story this one extends without modifying; its Amendment 2 is what originally deferred editing to this story.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep this story cites (`stories_covered` includes `3.3b`; explicitly validates the Epic 3 → Epic 4 table-dependency direction this story's new table creates).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — "Default Location for a Subscribed Account" user flow (steps 2/4, the edit trigger and immediate-apply-with-review behavior) and "Default Location Pending Review" (the full state-pattern this story implements the subscriber-facing half of).
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.14] — `DefaultLocationChangeRequest` interface (fields, `DefaultLocationChangeStatus` enum) this story's new table matches exactly; PRD §3.9.3/FR66/FR67 for the immediate-apply/moderator-notify behavior.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-7] — rule 5, explicitly anticipating `DefaultLocationChangeRequest` moderation as extending (not bypassing) `requireModerator`'s single enforcement surface — relevant to Story 4.7, not this story (this story never calls `requireModerator`), cited here for continuity.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8] — confirms `DefaultLocationChangeRequest` is excluded from the soft-delete binding list (audit/log-like), consistent with this story's schema choice (no `deletedAt`).
- [Source: _bmad-output/implementation-artifacts/3-3-set-a-default-location-for-a-subscription.md] — `setAccountDefaultLocation`'s exact resolver pattern this story's `editAccountDefaultLocation` mirrors; `SetDefaultLocationDialog`'s existing state machine this story extends with a `mode` prop; `subscriptions-content.tsx`'s existing inline-row conventions (platform-tag badge, "Set Default Location" trigger) this story's edit action/badge follow.
- [Source: apps/backend/src/lib/email/adapter.ts, packages/domain/src/email/{types.ts, templates.ts}] — `sendTemplatedEmail`'s exact signature and the `DANGEROUS_EVENT_MODERATOR_ALERT` template this story's new template mirrors.
- [Source: apps/backend/src/lib/auth/context.ts] — `AuthenticatedUser.role`/`requireModerator` already exist (Story 0.17), confirming the role model this story's moderator-lookup query relies on (`users.role = 'moderator'`) is already in place.
- [Source: packages/graphql-select/optimized-select.ts] — confirms `buildOptimizedDrizzleSelect` safely ignores GraphQL fields with no matching Drizzle column (like the new `hasPendingDefaultLocationReview`), so no change is needed there for the new computed field to coexist with the dynamic select.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Loaders (`BlockingLoader` on save), State Management (Server State via React Query/codegen, `packages/ui` components stay presentational), i18n rules, Optimized DB Queries (`buildOptimizedDrizzleSelect`/`formatLocationDetails`), Database Access (Drizzle ORM only), Soft-Delete Convention (confirms this new table is correctly *not* soft-deleted).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (Drizzle-kit-generated migrations, committed), AD-5 (analytics event naming), AD-6 (i18n), AD-7 (single `requireAuth`/`requireModerator` enforcement surface — rule 5 anticipates this exact PRD entity), AD-8 (soft-delete exclusion for audit/log-like tables).
- [x] `docs/infrastructure/index.md` — no infra/deployment change in this story (pure application-layer GraphQL + frontend + a new env var read at runtime; reuses Story 0.14's already-provisioned SES adapter, no new AWS resource).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** none (this story extends existing files rather than creating new ones — even the DB migration is drizzle-kit-generated into the existing `packages/database/migrations/` directory, not a hand-authored new source file).
- **Modified:** `packages/database/schema.ts` (+ generated migration); `apps/backend/src/schema/social-media-accounts.graphql`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/schema/social-media-accounts.test.ts`; `packages/domain/src/email/{types.ts, templates.ts, render-template.test.ts}`; `apps/backend/src/env.ts`; `.env.example`; `apps/web/src/features/subscriptions/{queries.graphql, mutations.graphql}`; `apps/web/src/app/[locale]/settings/subscriptions/{set-default-location-dialog.tsx, set-default-location-dialog.test.tsx, subscriptions-content.tsx, subscriptions-content.test.tsx}`; `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **Not modified:** `packages/shared-types` (reuses `LocationDetails` as-is); `packages/domain/src/user-locations` (`resolveLocationInputMode` reused as-is, no changes); `packages/ui` (no new/changed component — `LocationPickerField`/`MapPickerSheet` consumed exactly as Story 3.3 already integrates them); Story 3.3's `setAccountDefaultLocation` resolver body (untouched, only extended-alongside in the same file).

### Rule Mapping

- Backend-only mutation layer, never a direct DB/domain write from `apps/web` → `story-split-gate.md` Gate 1 → `editAccountDefaultLocation` resolver (Task 2), consumed only via the generated hook (Task 5).
- Reuse over reinvention (`SetAccountDefaultLocationInput`, `resolveLocationInputMode`, `resolveLocation`, `formatLocationDetails`, `activeOnly`, `sendTemplatedEmail`, `LocationPickerField`/`MapPickerSheet`, `SetDefaultLocationDialog`) → this story's Gate Findings + `AskUserQuestion` decisions → Tasks 2, 3, 6.
- Database schema code-first, migrations committed → AD-3 → Task 1.
- Single `requireAuth` enforcement surface, `activeOnly(table)` instead of hand-written `isNull` → AD-7 rule 3, AD-8 rule 2 → AC5/AC6, Task 2.
- Audit table correctly excluded from soft-delete binding → AD-8 → Task 1's schema design (no `deletedAt`).
- Non-blocking-vs-blocking loaders → `project-context.md` Loaders rule → `BlockingLoader` on save (Task 6, unchanged from Story 3.3).
- i18n, no hardcoded strings → `project-context.md`/AD-6 → Task 8.
- PostHog analytics events named/payload-shaped explicitly → AD-5 → AC14/Task 6.
- Best-effort, non-blocking side effect (moderator email) → FR66's "no pre-approval gate" extended to notification delivery, user-confirmed stacking decision → AC9/Task 2's `Promise.allSettled` handling.
- Idempotency/state-transition guard (`INVALID_STATE_TRANSITION`) → AD-8-adjacent app convention (`deleteApiKey`/`removeSubscription`/`setAccountDefaultLocation` precedent) → AC7/Task 2.

### Verification Plan

- `apps/backend/src/schema/social-media-accounts.test.ts` (extended): both input modes, `INVALID_STATE_TRANSITION` guard (no existing value), active-subscriber authorization, auth requirement, audit-row insert correctness, stacking behavior, best-effort email failure isolation (Task 2).
- New resolver test: `SocialMediaAccountProfile.hasPendingDefaultLocationReview` true/false cases (Task 2).
- `packages/domain/src/email/render-template.test.ts` (extended): new template key interpolation (Task 3).
- `apps/web/.../set-default-location-dialog.test.tsx` (extended), `subscriptions-content.test.tsx` (extended): edit-mode prefill/submit/toast, edit action + "Pending Review" badge rendering (Tasks 6-7).
- `pnpm build`, `pnpm lint`, full test suite at repo root — no regressions, including Story 3.3's and Story 3.3d's own test suites (this story extends files they own).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the `editAccountDefaultLocation` mutation, the new `default_location_change_requests` audit table, the moderator email notification, the `hasPendingDefaultLocationReview` field, and the row's edit action + "Pending Review" badge on Story 3.2/3.3's `/settings/subscriptions` page. It does not build Story 4.7's moderator accept/revert view or query, and does not modify Story 3.3's `setAccountDefaultLocation` mutation.
- [ ] Architecture and boundary confirmation: `editAccountDefaultLocation` confined to `apps/backend`'s GraphQL layer, reusing Story 0.16's Geolocation adapter and Story 0.15's email adapter; no direct DB/external-API access from `apps/web`; no new `packages/domain` logic added (reuses `resolveLocationInputMode` as-is); new DB table has no soft-delete column, matching AD-8's exclusion of audit/log-like tables.
- [ ] **Sequencing confirmation (specific to this story):** confirm Story 3.3 (`setAccountDefaultLocation`, `subscriptions-content.tsx`, `set-default-location-dialog.tsx`, `queries.graphql`/`mutations.graphql`) and Story 3.3d (`LocationPickerField`/`MapPickerSheet`) are implemented before starting Tasks 2/5-7 — both are `review` (coded but not yet `done`) as of this story's creation; confirm their test suites are green before extending their files.
- [ ] Testing plan confirmation: backend integration tests (Task 2), email template test (Task 3), frontend integration tests (Tasks 6-7) as scoped above.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` (no gap; explicitly validates this story's new table against Story 4.7's forward dependency); Gate 2 run fresh, no gap (all UI reuses existing components/conventions); lightweight guard surfaced three items (UI trigger pattern, "Pending Review" badge scope, concurrent-edit/stacking behavior), all resolved with the user via `AskUserQuestion` before drafting — see Dev Notes → Architecture & UX Gate Findings and → Forward Note for Story 4.7.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] Backend integration tests (`social-media-accounts.test.ts`, extended): `editAccountDefaultLocation`'s `placeId`/coordinate input modes, `INVALID_STATE_TRANSITION` when no prior value exists, `NOT_FOUND` for a non-subscriber/non-existent account, auth requirement, `default_location_change_requests` row correctness (including the stacking case — a second edit while an earlier row is still `PENDING_REVIEW` succeeds and creates a second row), best-effort moderator-email isolation (a rejected `sendTemplatedEmail` call does not fail the mutation); a new test for `SocialMediaAccountProfile.hasPendingDefaultLocationReview`'s true/false resolution.
- [ ] `packages/domain/src/email/render-template.test.ts` (extended): `DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT` template interpolation.
- [ ] Frontend integration tests: `set-default-location-dialog.test.tsx` (extended — edit-mode prefill, edit-mode mutation call, edit-specific toast copy, analytics event), `subscriptions-content.test.tsx` (extended — conditional edit action, "Pending Review" badge visibility).
- [ ] E2E: not required as a dedicated flow per `project-context.md`'s testing-trophy philosophy — integration coverage above satisfies the Definition of Done; the manual smoke check in Task 9 substitutes for a scripted E2E given the cross-story (3.3/3.3d) dependencies.

## Deliverables Checklist

- [ ] `default_location_change_requests` table + migration, committed.
- [ ] `editAccountDefaultLocation` mutation, fully tested, extending Story 3.1a/3.3's `social-media-accounts.graphql`.
- [ ] `SocialMediaAccountProfile.hasPendingDefaultLocationReview` field, resolved and tested.
- [ ] `DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT` email template, wired to fire (best-effort) to every `role = 'moderator'` user on save.
- [ ] `SetDefaultLocationDialog` edit mode + row edit action + "Pending Review" badge, both integration tested.
- [ ] `SubscriptionsPage` i18n additions in both `en.json` and `id.json`.
- [ ] `subscription_default_location_edited` PostHog event wired via `usePostHog()`.
- [ ] Forward Note for Story 4.7 recorded in Dev Notes (moderator-queue dedup contract).

## Out of Scope

- Story 4.7 (Moderator Items page): the actual moderator-facing list/accept/revert UI and its query over `default_location_change_requests` — this story only writes the audit rows and sends the notification email; see Dev Notes → Forward Note for Story 4.7 for the dedup contract that story must implement given this story's stacking decision.
- Any change to Story 3.3's `setAccountDefaultLocation` mutation or its "first-time set" UI path — untouched, coexists with this story's mutation via opposite preconditions.
- A literal "In-Table Add Form" inline-editing UI matching `EXPERIENCE.md`'s pattern name verbatim — user-confirmed deviation in favor of extending Story 3.3's already-shipped modal dialog (see Dev Notes → Architecture & UX Gate Findings, item 1).
- Rate-limiting or de-duplicating moderator email sends across rapid repeated edits to the same account — every edit sends a fresh notification; not flagged as a problem by the user during this story's creation, but noted here as a possible future refinement if moderators report alert fatigue.
- Any change to Story 3.6's AI-extraction fallback logic — unaffected; that logic already reads whatever `SocialMediaAccountProfile.defaultLocation` currently holds, regardless of which mutation (set or edit) last wrote it.

## Definition of Done

- [ ] AC1-14 satisfied and demonstrated via the tests in Testing Requirements.
- [ ] Backend and frontend test suites pass; no regression in existing suites (including Story 3.3's and Story 3.3d's own test suites).
- [ ] `pnpm build` and `pnpm lint` clean for all touched packages.
- [ ] `en.json`/`id.json` both updated — no hardcoded user-facing strings.
- [ ] New migration committed per AD-3.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent._

### Debug Log References

_To be filled by dev agent._

### Completion Notes List

_To be filled by dev agent._

### File List

_To be filled by dev agent._
