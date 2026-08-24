---
baseline_commit: 92ab892459c9f2e595cc8a8e5215d16b78e1f9cc
---
# Story 3.2: Subscribe to, view, and remove social media account subscriptions

## Story Details

- Epic: 3
- Story ID: 3.2
- Story Key: 3-2-subscribe-to-a-social-media-account
- Status: ready-for-dev (AC14 amendment; AC1-AC13 already delivered)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to view my list of subscribed accounts on the "My Subscriptions" page, subscribe to a new account, and remove ones I no longer want to monitor,
so that I can fully manage which accounts I'm monitoring for events, not just add to them.

## Acceptance Criteria

1. **Given** I am logged in and navigate to `/settings/subscriptions` (the "My Subscriptions" page, UX-DR9), **when** the page loads, **then** I see a list of my active (non-removed) subscribed accounts, fetched via a `mySubscriptions` query (Story 0.8 scaffold, Story 0.17 authenticated context, filtered via `activeOnly(subscriptions)` per Story 0.22) — **built and owned by this story** (moved here from Story 5.1a's original scope via the Ownership Note added to `epics.md` during this story's own creation). [epics.md AC, Ownership Note]
2. **And** each row shows the subscribed account's `platform`, `displayName`/`username`, and `profileImageUrl` (if present) — sourced via a new `account: SocialMediaAccountProfile!` field this story adds onto the existing `Subscription` GraphQL type (Story 3.1), resolved from `subscriptions.accountId`; the list would be unusable showing only raw UUIDs otherwise. [Derived — PRD §4.5's `SocialMediaAccountProfile` shape, required for AC1 to be meaningful]
3. **Given** I have at least one active API key (checked via Story 3.1's already-built, reusable `useHasApiKey()` hook), **when** I enter a social media account URL/handle into the "Subscribe" form and submit, **then** the subscription is saved by calling the **same** `subscribeToAccount(input: SubscribeToAccountInput!): SubscribeToAccountResult!` mutation Story 3.1's onboarding wizard already builds and owns (wrapping Story 3.1a's `subscribeToAccount()` lib function) — this story does not add a duplicate mutation, and reuses the same `packages/domain` `SUPPORTED_PLATFORMS`/`parseSocialMediaAccountHandle` helpers Story 3.1's subscribe step uses. [epics.md AC]
4. **And** if I do **not** have an active API key, the "Subscribe" form is replaced with a prompt linking to `/settings/api-keys` (Story 3.1b) instead of being silently hidden — I can still view and remove my existing subscriptions regardless of API key possession (list/remove are not key-gated; only adding a new subscription is, per the epics.md AC's literal "Given I have at least one API key" condition). [epics.md AC, Derived]
5. **And** I see the new subscription appear in my list of subscriptions without a full page reload (optimistic cache update or refetch, matching `locations-content.tsx`'s `GetMyLocationsDocument` refetch-on-mutation precedent). [epics.md AC]
6. **And** the subscription is created with `isNewlyAdded: true` (PRD §3.10) — the `subscriptions.is_newly_added` column and its `true` default already exist in the database (Story 3.1a's actual migration `0013_bizarre_midnight.sql`), so no new migration is required; consumed later by Story 5.1a's extended `mySubscriptions` query/`markSubscriptionViewed` mutation to auto-activate and then clear the corresponding tab in Epic 5's Manual Post Selection screen. [epics.md AC]
7. **And** the "already subscribed to this account" check performed inside Story 3.1a's `subscribeToAccount()` lib function already filters via `activeOnly(table)` (Story 0.22, per Story 3.1a's own AC #7) — this story inherits that behavior transitively by reusing the mutation; it does not reimplement the check. [epics.md AC — inherited, not new]
8. **And** I can remove a subscription I no longer want, which calls a `removeSubscription(id: ID!, action: SoftDeleteAction!): Subscription!` mutation — **built and owned by this story** — that soft-deletes the subscription (sets `deletedAt`, AD-8, never a hard delete, preserving history for quota/fairness accounting per PRD §4.9), using the exact `deleteApiKey`/`deleteUserLocation` argument shape (AD-8 rule 4) so the existing Soft-Delete-with-Undo primitive (`useSoftDeleteWithUndo`/`SwipeToReveal`, Story 0.18/0.19) can drive it the same way `locations-content.tsx` does: `DELETE` commits immediately with an "Undo" toast, `RESTORE` on Undo click, and letting the toast expire leaves it removed and splices it from the local list. [epics.md AC, Ownership Note]
9. **And** attempting to remove an already-removed subscription (an invalid state transition) throws a `GraphQLError` with `extensions.code = 'INVALID_STATE_TRANSITION'` rather than silently no-op'ing, matching Story 3.1b's `deleteApiKey`/the existing `deleteUserLocation` resolver's precedent. [epics.md AC, Derived]
10. **And** all user-facing strings (page title, empty state, form labels/placeholders, remove confirmation copy, toasts) are sourced through next-intl from a new `SubscriptionsPage` i18n namespace (mirroring `SavedLocationsPage`'s shape), with entries added to both `apps/web/locales/en.json` and `apps/web/locales/id.json` — no hardcoded English strings in JSX. [project-context.md i18n rule, persistent fact]
11. **And** the page sets its browser tab title/meta description via `generateMetadata` (Server Component `page.tsx`, `getTranslations()` server-side, `apps/web/src/lib/metadata.ts`'s `buildPageMetadata` helper) — never a static `metadata` export or client-side `document.title` — matching `settings/locations/page.tsx`'s exact pattern, with new `Metadata.subscriptionsTitle`/`subscriptionsDescription` keys. [project-context.md Dynamic Page Title rule, persistent fact]
12. **And** the "Subscribe" submit is wrapped in `BlockingLoader` (a critical, persisted mutation creating a subscription, matching `createUserLocation`/`createApiKey`'s convention); the remove/soft-delete action is **not** wrapped in `BlockingLoader` — it follows the Soft-Delete-with-Undo pattern's own instant-optimistic-feedback convention instead (matching `locations-content.tsx`, which does not use `BlockingLoader` for its delete action either). [project-context.md Loaders rule, persistent fact]
13. **And** `subscription_added` (`{ platform }`) and `subscription_removed` (`{ subscriptionId }`) PostHog analytics events fire on successful subscribe and successful remove-commit respectively, via `usePostHog()` from `@festgrid/analytics` (the majority convention across `home-content.tsx`/`favorites-content.tsx`/`my-calendar-content.tsx`, not `locations-content.tsx`'s older `(window as any).posthog` pattern). [persistent fact — AD-5]
14. **AC14 — Adopt `PageContainer(fullWidth=false)`/`PageHeader` (added 2026-08-24 via `bmad-correct-course`):** And `subscriptions-content.tsx`'s root `<div className="p-4 sm:p-8 space-y-8 max-w-3xl mx-auto">` (all 3 occurrences in this file — loading skeleton, error state, and success return) is replaced with `<PageContainer fullWidth={false}>` (`@festgrid/ui`, Story 0.30), and its `<div className="flex justify-between items-center"><h1 className="text-3xl font-bold">{t("title")}</h1>{hasApiKey && subscriptions.length > 0 && (<button>...</button>)}</div>` row is replaced with `<PageHeader title={t("title")} action={hasApiKey && subscriptions.length > 0 ? { label: t("addButtonLabel"), icon: <Plus className="h-4 w-4" />, onClick: handleOpenAddDialog } : undefined} />` (Story 0.32) — preserves the existing conditional-on-`hasApiKey && subscriptions.length > 0` visibility exactly (this is the exact header the user reviewed to request this pattern in the first place). **Depends on Story 0.30 (AC7) and Story 0.32.**

## Tasks / Subtasks

- [ ] **Task 1: Backend — fix the shared GraphQL root-Subscription-type-name landmine** (AC: 1, 8)
  - [ ] In `apps/backend/src/schema/typeDefs.graphql` (Story 0.8's scaffold), add an explicit `schema { query: Query mutation: Mutation }` block at the top of the file, **if not already present** (Story 3.1 may land first and add it via its own cross-amended Task 2 note — check before adding a duplicate). Without this, `graphql-js`/`graphql-yoga` fall back to treating any type literally named `Subscription` as the schema's root real-time-subscription operation type whenever no explicit `schema` definition exists — and both Story 3.1's and this story's `Subscription` object type would otherwise silently collide with that reserved root-type name.
- [ ] **Task 2: Backend — extend `subscriptions.graphql` with `mySubscriptions`/`removeSubscription`** (AC: 1, 2, 8, 9)
  - [ ] **Sequencing check (Pre-Coding Approval Gate item):** confirm Story 3.1 has landed `apps/backend/src/schema/subscriptions.graphql` (with its `type Subscription`, `SubscribeToAccountInput`, `SubscribeToAccountResult`) before starting this task — this story extends that file, it does not create it.
  - [ ] Extend `apps/backend/src/schema/subscriptions.graphql`:
    ```graphql
    extend type Subscription {
      account: SocialMediaAccountProfile!
    }

    extend type Query {
      mySubscriptions: [Subscription!]!
    }

    extend type Mutation {
      removeSubscription(id: ID!, action: SoftDeleteAction!): Subscription!
    }
    ```
    Reuses the existing `SocialMediaAccountProfile` type (`social-media-accounts.graphql`, Story 3.1a) and the existing `SoftDeleteAction` enum (`typeDefs.graphql`, AD-8 rule 4) — does not redeclare either.
  - [ ] Create `apps/backend/src/schema/subscriptions.test.ts` extensions (or new file if Story 3.1's `subscriptions.test.ts` doesn't exist yet at implementation time) covering: `mySubscriptions` returns only the caller's active subscriptions (soft-deleted ones excluded); `Subscription.account` resolves the linked profile's `platform`/`displayName`/`username`/`profileImageUrl`; `removeSubscription` soft-deletes and is idempotency-guarded (`INVALID_STATE_TRANSITION` on an already-removed row); `removeSubscription` on another user's subscription is rejected (`NOT_FOUND` or equivalent, matching `deleteUserLocation`'s ownership-scoping precedent); both operations require authentication (`requireAuth` throws for an unauthenticated context).
- [ ] **Task 3: Backend — resolvers** (AC: 1, 2, 8, 9)
  - [ ] In `apps/backend/src/schema/resolvers.ts`: add `mySubscriptions` to the `Query` map, mirroring `myLocations`'s exact shape (`requireAuth(context)`, `db.select().from(subscriptions).where(and(eq(subscriptions.userId, authUser.userId), activeOnly(subscriptions))).orderBy(desc(subscriptions.createdAt))`, formatting `createdAt`/`isNewlyAdded` for the `Subscription` GraphQL type).
  - [ ] Add a new `Subscription: { account: async (parent, _, context) => {...} }` field-resolver map entry (mirrors the existing `Coordinates: {...}` field-resolver pattern at the top of `resolvers.ts`), fetching the linked `social_media_account_profiles` row via `buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info)` scoped `where(eq(socialMediaAccountProfiles.id, parent.accountId))` — matching `socialMediaAccountProfileByAccountId`'s own `buildOptimizedDrizzleSelect` convention (project-context.md's Optimized DB Queries rule), not `myLocations`'s plain-select style, since this resolver returns a `SocialMediaAccountProfile`.
  - [ ] Add `removeSubscription` to the `Mutation` map, mirroring `deleteUserLocation`'s exact structure: `requireAuth(context)`; look up the existing row scoped to `eq(subscriptions.id, id)` and `eq(subscriptions.userId, authUser.userId)` (throw `NOT_FOUND` if absent — one user must never be able to soft-delete another's subscription); on `action === 'DELETE'`, throw `INVALID_STATE_TRANSITION` if `deletedAt !== null`, else set `deletedAt: new Date()`; on `'RESTORE'`, throw `INVALID_STATE_TRANSITION` if `deletedAt === null`, else set `deletedAt: null`; throw `BAD_REQUEST` for any other `action` value.
  - [ ] Run the backend's GraphQL Code Generator (`pnpm --filter backend run codegen`) to regenerate `apps/backend/src/generated/resolvers-types.ts`.
- [ ] **Task 4: Frontend — GraphQL operations and codegen** (AC: 1, 2, 5, 8)
  - [ ] Create `apps/web/src/features/subscriptions/queries.graphql`:
    ```graphql
    query getMySubscriptions {
      mySubscriptions {
        id
        accountId
        isNewlyAdded
        createdAt
        account {
          platform
          displayName
          username
          profileImageUrl
        }
      }
    }
    ```
  - [ ] Create `apps/web/src/features/subscriptions/mutations.graphql`:
    ```graphql
    mutation removeSubscription($id: ID!, $action: SoftDeleteAction!) {
      removeSubscription(id: $id, action: $action) {
        id
      }
    }
    ```
    Reuse Story 3.1's already-generated `subscribeToAccount`/`useSubscribeToAccountMutation` operation/hook directly (`apps/web/src/features/onboarding/mutations.graphql`) — do not redeclare it here.
  - [ ] Run the GraphQL Code Generator (`pnpm --filter web run codegen`) to regenerate `apps/web/src/generated/graphql.ts` (new `useGetMySubscriptionsQuery`/`useRemoveSubscriptionMutation` hooks).
- [ ] **Task 5: Frontend — `SubscriptionsContent` page component** (AC: 1, 2, 4, 5, 8, 9, 10, 12, 13)
  - [ ] Create `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` (`"use client"`), following `locations-content.tsx`'s exact structure: auth redirect via `useAuthSession()`, `useGetMySubscriptionsQuery` for the list, loading skeleton / error+retry states, empty state with the "Subscribe" form's own empty-state variant.
  - [ ] Render each subscription inline (no extracted row component — Gate 2 confirmed no reuse gap; keep this consistent with `locations-content.tsx`'s inline-row precedent) inside a `SwipeToReveal` wrapper with a desktop trash-icon fallback button, showing `account.profileImageUrl` (fallback to a platform icon/initial if absent), `account.displayName`, `account.username`, and `account.platform`.
  - [ ] Wire `useSoftDeleteWithUndo<string>` for the remove flow: on swipe/trash-click, call `removeSubscription(DELETE)`, fire `subscription_removed` (`{ subscriptionId }`) via `usePostHog()`, then `markPending(id, () => removeSubscription(RESTORE), { message, undoLabel })`; on `onExpire`, splice the id from the `getMySubscriptions` React Query cache directly (matching `locations-content.tsx`'s `queryClient.setQueryData` pattern); on a failed `DELETE` call, revert the optimistic grey-out and show an error toast (matching AC11a's precedent from `locations-content.tsx`).
  - [ ] Call `useHasApiKey()` (Story 3.1, `apps/web/src/features/onboarding/use-has-api-key.ts`) — if `false`, render a prompt (with a link to `/settings/api-keys`) in place of the Subscribe form; if `true`, render the `SubscribeAccountDialog`/inline form trigger.
- [ ] **Task 6: Frontend — Subscribe form** (AC: 3, 5, 10, 12, 13)
  - [ ] Create `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx` (`"use client"`), following `LocationFormDialog`'s modal-dialog structure (established, intentional deviation from EXPERIENCE.md's literal "In-Table Add Form" pattern — already precedented by `locations-content.tsx` and Story 3.1b's plan): a `Select` (Story 3.1b's `select.tsx` shadcn primitive) populated from `SUPPORTED_PLATFORMS` (`@festgrid/domain/subscriptions`) and a text input for the account URL/handle, parsed via `parseSocialMediaAccountHandle` on submit (same `@festgrid/domain/subscriptions` helpers Story 3.1's onboarding step uses — do not reimplement).
  - [ ] On submit: call `useSubscribeToAccountMutation` with `{ platform, accountId: handle, username: handle, displayName: handle }` (mirrors Story 3.1's own onboarding-subscribe-step convention), wrapped in `BlockingLoader`; on success, invalidate/refetch `getMySubscriptions` (or optimistically prepend the returned `subscription`), fire `subscription_added` (`{ platform }`), show a success toast (a distinct, softer message when `alreadySubscribed: true`, matching Story 3.1's own onboarding-subscribe-step precedent), and close the dialog; on error, show an error toast and keep the dialog open.
  - [ ] Create `subscriptions-content.test.tsx` and `subscribe-account-dialog.test.tsx` (Vitest + Testing Library + `msw`): list renders rows from `mySubscriptions` (including the nested `account` fields); empty state renders when the list is empty; no-API-key state renders the `/settings/api-keys` prompt instead of the form; subscribe happy path (new + already-subscribed) closes the dialog and shows the new/updated row; subscribe failure path shows an error toast and keeps the dialog open; remove happy path shows the Undo toast and splices on expiry; remove-then-Undo restores the row; a failed `DELETE` call reverts the optimistic grey-out.
- [ ] **Task 7: Frontend — route and metadata** (AC: 11)
  - [ ] Create `apps/web/src/app/[locale]/settings/subscriptions/page.tsx`, matching `settings/locations/page.tsx` exactly: `generateMetadata` via `getTranslations({ namespace: 'Metadata' })` + `buildPageMetadata`, a `<Suspense fallback={<RouteLoader />}>` wrapping `<SubscriptionsContent />`, `export const dynamic = 'force-dynamic'`.
- [ ] **Task 8: i18n — `SubscriptionsPage` namespace and `Metadata` keys** (AC: 10, 11)
  - [ ] Add `Metadata.subscriptionsTitle`/`Metadata.subscriptionsDescription` to `apps/web/locales/en.json`, mirroring `locationsTitle`/`locationsDescription`.
  - [ ] Add a `SubscriptionsPage` object to `apps/web/locales/en.json`, mirroring `SavedLocationsPage`'s shape: `title`, `emptyState`, `errorState`, `addButtonLabel`, `addModalTitle`, `platformLabel`, `accountLabel`, `accountPlaceholder`, `subscribeSubmitLabel`, `subscribeSuccessToast`, `alreadySubscribedToast`, `subscribeErrorToast`, `noApiKeyPrompt`, `noApiKeyLinkLabel`, `removeButtonLabel`, `removedAnnouncement`, `undoLabel`, `removeErrorAnnouncement`, `cancelButtonLabel`.
  - [ ] Mirror every new key into `apps/web/locales/id.json` with real Indonesian translations — required by `project-context.md`'s i18n rule.
- [ ] **Task 9: Verification** (AC: all)
  - [ ] `pnpm --filter backend run test`, `pnpm --filter web run test` pass, including all new test files, with no regression in existing suites.
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root, including new generated GraphQL types.
  - [ ] Manual smoke check (Completion Notes): as a user with an API key and zero subscriptions, land on `/settings/subscriptions`, see the empty state, subscribe to an account, see it appear in the list; swipe/click to remove it, see the Undo toast, click Undo, confirm it's restored; let a second removal's toast expire, confirm it's gone after reload; as a user with zero API keys, confirm the Subscribe form is replaced by the `/settings/api-keys` prompt while any existing subscriptions still list/remove normally.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07, explicitly lists `3.2` in `stories_covered`) — no Gate 1 gap for this story's originally-scoped add-only flow (writes exclusively through backend GraphQL, never a direct DB/domain call from `apps/web`); no Gate 3 gap specific to it either. The sweep's own AC-correction pass already added this story's `activeOnly(table)` AC line and its `Depends on: Story 0.22`.
  - **Lightweight guard (fresh, story-specific) — triggered one real gap the sweep could not have anticipated, since it only became relevant after this story's own scope was expanded during creation (the sweep evaluated the original add-only AC):** Expanding this story to own `mySubscriptions`/`removeSubscription` (see Ownership Note below) is itself a data-ownership move between Epic 3 and Epic 5, not a brand-new architectural layer or a new cross-cutting foundation — the mutation/query still go through the same backend GraphQL layer Story 3.1's `subscribeToAccount` already established, so this doesn't reopen Gate 1, and it isn't reused outside Epic 3/5's already-declared consumers, so it doesn't trigger Gate 3's cross-epic-foundation bar either. Treated as within-scope for this story rather than a new prerequisite.
  - **A second finding, unrelated to Gate 1/2/3 but surfaced by the same close reading:** `apps/backend/src/schema/typeDefs.graphql` has no explicit `schema { }` definition, so `graphql-js`/`graphql-yoga`'s default root-type-name convention would treat the `Subscription` object type (already named exactly that by Story 3.1's plan, and reused by this story) as the schema's root real-time-subscription type. Fixed via Task 1 (add `schema { query: Query mutation: Mutation }`); Story 3.1's story file cross-amended with the same note in case it lands first.
- **Ownership Note (2026-08-07, resolved via `bmad-create-story`, `AskUserQuestion`):** This story's original Forward note (added while drafting Story 3.1) flagged that no story built `/settings/subscriptions`'s list/remove view, and that Story 5.1a (Epic 5) was slated to own `mySubscriptions`/`removeSubscription` — which would make this epic's own subscriptions page depend on Epic 5 existing first, a backward dependency. Presented to the user as a two-option tradeoff (fully own list+add+remove here vs. add-only + a new `3.2a` split story); user chose the former. This story now owns the base `mySubscriptions` query and `removeSubscription` mutation (the `Subscription`/`SocialMediaAccountProfile` tables both originate in Story 3.1a, this epic), matching the established `/settings/*` list+add+remove-in-one-story pattern (`locations-content.tsx`, Story 3.1b's plan). Story 5.1a's `epics.md` entry was amended to **extend** this story's `mySubscriptions` with the `isInactive` field (needs Story 3.3a's `posts` table, unavailable when this story ships) instead of rebuilding the query, and to reuse this story's `removeSubscription` mutation as-is for Story 5.4's inactive-account removal flow. Downstream references in Stories 3.1a, 5.1, 5.4, and 5.5 were updated in `epics.md` to point at this story instead of Story 5.1a for `mySubscriptions`/`removeSubscription` specifically.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya. **Verdict: no gap found.** The account-row markup (platform, displayName/username, profileImageUrl) was checked against the two other places that touch subscribed-account data: Story 3.11's public account page renders *events*, not this row shape (only reads `displayName` for page metadata); Story 5.1's Manual Post Selection screen renders subscribed accounts as tabs, a different container/interaction with no remove action. Neither warrants extracting a shared row component — kept inline in `SubscriptionsContent`, matching `locations-content.tsx`'s own inline-row precedent (and Story 3.1b's planned api-keys page, which follows the same convention). The remove interaction reuses `SwipeToReveal`/`useSoftDeleteWithUndo` (Stories 0.18/0.19) exactly as `locations-content.tsx` does — no new hook/wrapper needed. EXPERIENCE.md's literal "In-Table Add Form" pattern is a known, already-precedented deviation (modal dialog instead), not a gap to re-flag here.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no new schema/migration required by this story.** `subscriptions.is_newly_added` (boolean, default `true`, not null) and `subscriptions.deleted_at` (nullable timestamp) both already exist in the database — added by Story 3.1a's actual migration `packages/database/migrations/0013_bizarre_midnight.sql` — even though Story 3.1a's own `epics.md` AC text never explicitly enumerated `is_newly_added` in its migration bullet list. This is a documentation gap in `epics.md` only, not a code gap; verified directly against `packages/database/schema.ts` (line 83: `isNewlyAdded: boolean('is_newly_added').default(true).notNull()`) and the migration SQL itself. The existing partial index `idx_subscriptions_active` (on `subscriptions.user_id` `WHERE deleted_at IS NULL`) already supports both this story's `mySubscriptions` query and the inherited already-subscribed lookup efficiently — no new index needed.
- **Impacted contracts:** `apps/backend/src/schema/subscriptions.graphql` (Story 3.1's file) is **extended**, not redeclared, with `extend type Subscription { account: SocialMediaAccountProfile! }`, `extend type Query { mySubscriptions: [Subscription!]! }`, `extend type Mutation { removeSubscription(...): Subscription! }`. Generated TypeScript counterparts: `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (new `useGetMySubscriptionsQuery`/`useRemoveSubscriptionMutation` hooks). No `packages/shared-types` change — this story reuses Story 3.1a's `Subscription`/`SocialMediaAccountProfile` interfaces, doesn't add new ones.
- **Required DB migration changes:** none.
- **Required TypeScript type changes:** none beyond the new codegen output above.
- **Backward compatibility and rollout notes:** purely additive to Story 3.1's schema file — a new query, a new mutation, and one new field on an existing type; no existing contract changes. The `schema { }` root-type fix (Task 1) is additive/structural only (pins default behavior explicitly), not a breaking change.
- **Verification checks:** Task 2's extended `subscriptions.test.ts` asserts `mySubscriptions`'s active-only filtering, `Subscription.account`'s field resolution, and `removeSubscription`'s soft-delete/idempotency/ownership-scoping behavior.

### Project Structure Notes

- **This story has real code dependencies on Story 3.1 (and transitively Story 3.1a/Story 0.22) that are not yet implemented as of this story's creation** (`3-1-...` and `3-1b-...` are both `ready-for-dev`, not `done`) — it extends files (`subscriptions.graphql`, the resolver map's `subscribeToAccount`-adjacent code) that Story 3.1 creates. Do not start Tasks 2-4 until Story 3.1 has landed; mirrors Story 3.1's own documented sequencing caution about Story 0.24.
- New backend: none (this story only extends existing files).
- Modified backend: `apps/backend/src/schema/typeDefs.graphql` (explicit `schema { }` block, if not already added by Story 3.1); `apps/backend/src/schema/subscriptions.graphql` (Story 3.1's file — new `extend` blocks); `apps/backend/src/schema/subscriptions.test.ts` (Story 3.1's file — new test cases); `apps/backend/src/schema/resolvers.ts` (new `mySubscriptions`/`removeSubscription` resolvers, new `Subscription.account` field resolver).
- New frontend: `apps/web/src/features/subscriptions/{queries.graphql, mutations.graphql}`; `apps/web/src/app/[locale]/settings/subscriptions/{page.tsx, subscriptions-content.tsx, subscriptions-content.test.tsx, subscribe-account-dialog.tsx, subscribe-account-dialog.test.tsx}`.
- Modified: `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **No conflicts detected** with Story 3.1's onboarding wizard files or Story 3.1b's `/settings/api-keys` page — this story only consumes `subscribeToAccount`/`useHasApiKey()`/the `select.tsx` primitive from those, doesn't modify their files.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.2] — this story's authoritative AC, Ownership Note, and Depends-on list (all amended during this story's own creation).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1, #Story-3.1a, #Story-5.1a, #Story-5.4, #Story-5.5] — cross-referenced/amended entries for the `mySubscriptions`/`removeSubscription` ownership move.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep this story cites (`stories_covered` includes `3.2`).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — `/settings/subscriptions` route naming, User Menu entry, "In-Table Add Form" pattern (deliberately not followed, per precedent).
- [Source: _bmad-output/implementation-artifacts/3-1-onboarding-wizard-for-api-key-and-subscriptions.md] — the `subscribeToAccount` mutation, `useHasApiKey()` hook, and `SUPPORTED_PLATFORMS`/`parseSocialMediaAccountHandle` domain helpers this story reuses; cross-amended with this story's `schema {}` finding.
- [Source: _bmad-output/implementation-artifacts/3-1a-create-social-media-account-profiles-table.md] — the `social_media_account_profiles`/`subscriptions` schema and `subscribeToAccount()` lib function this story's resolvers build on.
- [Source: _bmad-output/implementation-artifacts/3-1b-manage-and-revoke-api-keys.md] — the `/settings/api-keys` page (linked from this story's no-API-key prompt) and the `select.tsx` shadcn primitive.
- [Source: apps/web/src/app/[locale]/settings/locations/{page.tsx, locations-content.tsx, location-form-dialog.tsx}] — the reference `/settings/*` list+add-modal+swipe-delete page this story's structure directly mirrors.
- [Source: apps/backend/src/schema/resolvers.ts] — `myLocations`/`deleteUserLocation`/`socialMediaAccountProfileByAccountId` resolver patterns this story's `mySubscriptions`/`removeSubscription`/`Subscription.account` resolvers mirror; `activeOnly`/`requireAuth`/`buildOptimizedDrizzleSelect` import conventions.
- [Source: packages/database/schema.ts, packages/database/migrations/0013_bizarre_midnight.sql] — verified `subscriptions.is_newly_added`/`deleted_at` and the `idx_subscriptions_active` partial index already exist.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Loaders (`BlockingLoader` on subscribe, not on soft-delete), State Management (Server State via React Query/codegen), i18n rules, Optimized DB Queries (`buildOptimizedDrizzleSelect` on the `Subscription.account` field resolver), Soft-Delete Convention (AD-8, `activeOnly`/`SoftDeleteAction`).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (soft-delete convention, `SoftDeleteAction` argument shape) directly implicated by `removeSubscription`.
- [x] `docs/infrastructure/index.md` — no infra/deployment change in this story (pure application-layer GraphQL + frontend).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/web/src/features/subscriptions/{queries.graphql, mutations.graphql}`; `apps/web/src/app/[locale]/settings/subscriptions/{page.tsx, subscriptions-content.tsx, subscriptions-content.test.tsx, subscribe-account-dialog.tsx, subscribe-account-dialog.test.tsx}`.
- **Modified:** `apps/backend/src/schema/typeDefs.graphql` (explicit `schema {}` block); `apps/backend/src/schema/subscriptions.graphql` and `subscriptions.test.ts` (Story 3.1's files — `extend` blocks + new test cases); `apps/backend/src/schema/resolvers.ts` (new `mySubscriptions`/`removeSubscription` resolvers, new `Subscription.account` field resolver); `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **Not modified:** `packages/database/schema.ts` (no schema change — `is_newly_added`/`deleted_at` already exist); `packages/shared-types` (reuses Story 3.1a's interfaces); `packages/domain` (reuses Story 3.1's `SUPPORTED_PLATFORMS`/`parseSocialMediaAccountHandle`, adds nothing new).

### Rule Mapping

- Backend-only mutation/query layer, never a direct DB/domain write from `apps/web` → `story-split-gate.md` Gate 1 → `mySubscriptions`/`removeSubscription` resolvers (Task 3), consumed only via generated hooks (Task 4).
- Reuse over reinvention (`subscribeToAccount`, `useHasApiKey()`, `SUPPORTED_PLATFORMS`/`parseSocialMediaAccountHandle`, `select.tsx`, `SwipeToReveal`/`useSoftDeleteWithUndo`) → this story's Ownership Note + epics.md Amendment notes → Tasks 4-6.
- AD-8 soft-delete convention (`activeOnly`, explicit `SoftDeleteAction` argument, `INVALID_STATE_TRANSITION` on invalid transitions) → project-context.md/architecture spine → `mySubscriptions`/`removeSubscription` (Task 3), AC6/AC7/AC8/AC9.
- Optimized DB queries (`buildOptimizedDrizzleSelect`) → project-context.md → `Subscription.account` field resolver (Task 3).
- Non-blocking-vs-blocking loaders → project-context.md Loaders rule → `BlockingLoader` on subscribe only, not on soft-delete (Tasks 5/6).
- i18n, no hardcoded strings, `generateMetadata` → project-context.md rules → Tasks 7/8.
- PostHog analytics events named/payload-shaped explicitly → persistent fact (AD-5) → AC13/Tasks 5/6.
- GraphQL root-type-name correctness → discovered during this story's creation → Task 1, cross-amended into Story 3.1.

### Verification Plan

- `apps/backend/src/schema/subscriptions.test.ts` (extended): active-only filtering, `Subscription.account` resolution, soft-delete/idempotency/ownership-scoping, auth requirement.
- `apps/web/.../subscriptions-content.test.tsx`, `subscribe-account-dialog.test.tsx`: list/empty/no-API-key states, subscribe happy/unhappy paths, remove/undo/expire paths, per Tasks 5/6.
- `pnpm build`, `pnpm lint`, full test suite at repo root — no regressions, including Story 3.1's own test suite (this story extends files it owns).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the full `/settings/subscriptions` page — list (`mySubscriptions`), add (reusing Story 3.1's `subscribeToAccount`), and remove (`removeSubscription`) — plus the `Subscription.account` field resolver and the shared GraphQL `schema {}` root-type fix. It does not build the onboarding wizard (Story 3.1), API key management (Story 3.1b), default-location editing (Story 3.3/3.3b), or Epic 5's `isInactive`/`postsByAccount`/quota/extraction machinery (Story 5.1a, which now extends this story's query instead of owning it).
- [ ] Architecture and boundary confirmation: `mySubscriptions`/`removeSubscription`/`Subscription.account` confined to `apps/backend`'s GraphQL layer; no direct DB access from `apps/web`; no new `packages/domain` logic added (reuses Story 3.1's).
- [ ] **Sequencing confirmation (specific to this story):** confirm Story 3.1 (`subscribeToAccount` mutation, `subscriptions.graphql`, `useHasApiKey()`) and Story 3.1b (`select.tsx` primitive, `/settings/api-keys` route this story links to) are implemented before starting Tasks 2-6 — none of Story 3.1/3.1a/3.1b/0.22 are `done` yet as of this story's creation (3.1a is `done`; 3.1/3.1b are `ready-for-dev`; 0.22 is `review`), so this is a real, not just documented, blocker.
- [ ] Testing plan confirmation: backend integration tests extending Story 3.1's `subscriptions.test.ts` (Task 2/3), frontend integration tests (Tasks 5/6) as scoped above.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` (no gap); lightweight guard found the ownership-move doesn't reopen Gate 1/3 and confirmed the separate `schema {}` finding is fixed by Task 1; Gate 2 run fresh (no reuse/complexity gap — row markup stays inline, per `locations-content.tsx` precedent, approved). The list/add/remove scope-ownership decision itself was confirmed with the user via `AskUserQuestion` during this story's creation (see Ownership Note) — confirm this is still the desired scope before implementation begins.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] Backend integration tests (extended `subscriptions.test.ts`): `mySubscriptions` active-only filtering, `Subscription.account` field resolution, `removeSubscription` soft-delete/idempotency/ownership-scoping, auth requirement on both new operations.
- [ ] Frontend integration tests: `subscriptions-content.test.tsx` (list/empty/no-API-key states, remove/undo/expire/failure paths), `subscribe-account-dialog.test.tsx` (subscribe happy/already-subscribed/failure paths).
- [ ] E2E: not required as a dedicated flow per `project-context.md`'s testing-trophy philosophy — integration coverage above satisfies the Definition of Done; the manual smoke check in Task 9 substitutes for a scripted E2E given the wizard/api-keys cross-story dependencies.

## Deliverables Checklist

- [ ] `mySubscriptions` query and `removeSubscription` mutation, fully tested, extending Story 3.1's `subscriptions.graphql`.
- [ ] `Subscription.account` field resolver, using `buildOptimizedDrizzleSelect`.
- [ ] Explicit `schema { query: Query mutation: Mutation }` block in `typeDefs.graphql` (or verified already present).
- [ ] `/settings/subscriptions` page: `SubscriptionsContent` (list + remove, inline row markup) and `SubscribeAccountDialog` (add), both integration tested.
- [ ] No-API-key prompt state, reusing Story 3.1's `useHasApiKey()`.
- [ ] `SubscriptionsPage`/new `Metadata` i18n keys in both `en.json` and `id.json`.
- [ ] `subscription_added`/`subscription_removed` PostHog events wired via `usePostHog()`.

## Out of Scope

- The onboarding wizard itself and the `subscribeToAccount` mutation's implementation — Story 3.1, reused as-is here.
- `/settings/api-keys` (view/add/revoke API keys) — Story 3.1b, only linked to from this story's no-API-key prompt.
- Default location editing/setting for a subscribed account — Story 3.3 (first-time set) / Story 3.3b (editing an existing value); this story's list rows do not show or edit `defaultLocation`.
- `isInactive` status, `postsByAccount`, `myExtractionQuota`, `selectPostsForExtraction`, `markSubscriptionViewed` — Story 5.1a, which extends this story's `mySubscriptions` query rather than this story building them.
- Live scrape-based account validation on subscribe (account-exists check) — inherited gap from Story 3.1's own Out of Scope (Story 3.4's scraper is still placeholder).
- The richer subscribe UX (autocomplete for existing shared accounts, live keyword-scan/quota-check confirmation dialog) described in `design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.3-adding-a-subscription.md` — already deferred by Story 3.1's own Out of Scope; this story's Subscribe form is the same plain manual-entry shape.
- Public per-account event page — Story 3.11.

## Definition of Done

- [ ] AC1-13 satisfied and demonstrated via the tests in Testing Requirements.
- [ ] Backend and frontend test suites pass; no regression in existing suites (including Story 3.1's own `subscriptions.test.ts`/onboarding tests once implemented).
- [ ] `pnpm build` and `pnpm lint` clean for all touched packages.
- [ ] `en.json`/`id.json` both updated — no hardcoded user-facing strings.

## Completion Status

- [ ] Not started (AC1-AC13, original)

**2026-08-24 (`bmad-correct-course`):** Reopened for AC14 only (adopt `PageContainer`/`PageHeader` — this is the exact header the user reviewed to request the pattern in the first place. Blocked on Stories 0.30/0.32). AC1-AC13 unaffected.

**Amended 2026-08-13:** when the user has zero active API keys **and** zero existing subscriptions, `/settings/subscriptions` now redirects to `/wizard/onboarding/api-key?redirect=%2Fsettings%2Fsubscriptions` on load (mirroring Story 5.1a's `/posts/select` pattern), instead of rendering the inline no-API-key prompt against an empty list. The inline prompt (linking to `/settings/api-keys`) is unchanged and still renders for users with zero keys but ≥1 existing subscription — AC4's "view/remove regardless of key possession" guarantee is preserved for that case. Implemented via a new `useApiKeyStatus()` export alongside the existing `useHasApiKey()` hook (`apps/web/src/features/onboarding/use-has-api-key.ts`), adding a loading flag `useHasApiKey()` never exposed.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
