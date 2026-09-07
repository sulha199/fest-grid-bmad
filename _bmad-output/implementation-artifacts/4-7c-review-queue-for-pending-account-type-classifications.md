# Story 4.7c: Review queue for pending account-type classifications

## Story Details

- Epic: 4
- Story ID: 4.7c
- Status: ready-for-dev

## Story

As a moderator,
I want to review and resolve `SocialMediaAccountProfile` rows whose AI classification is `accountTypeStatus = 'AWAITING_APPROVAL'` (low-confidence or a failed classification attempt, Story 3.4n),
so that an account that couldn't be automatically classified as `ORGANIZER_VENUE_EVENT`/`PERSONAL`/`CURATOR_GUIDE` doesn't stay permanently excluded from scraping (or, worse, get scraped without ever having been confirmed safe to scrape) with no path to resolution.

## Acceptance Criteria

1. **Given** `/moderator/items` (Story 4.7, extended by Story 4.7b), **when** a moderator opens it, **then** a new "Pending Account-Type Classifications" section (a third, additive page section — not a tab, not a generalized plug-in list mechanism, per Gate 2's confirmation below) surfaces every `accountTypeClassificationReviews` row with no `reviewedAt` set, ordered oldest-first — showing the account's avatar/username/`displayName`/platform, a bio snippet (`SocialMediaAccountProfile.description`), the `proposedAccountType` (resolved through the new `AccountType` i18n namespace, never a raw enum string) and `confidenceScore` (if the classification attempt produced one — formatted as a locale-aware percentage via `Intl.NumberFormat({ style: 'percent' })`, per project-context.md's Locale-Sensitive Data Rendering rule for numeric values, never a raw decimal), and the `failureReason` (if the row exists because of a hard classification failure rather than low confidence — in which case `proposedAccountType`/`confidenceScore` are `null` and the row instead shows a distinct "Classification Failed" indicator).
2. **And** the moderator can resolve a pending row by choosing one of the three real `accountType` values (`ORGANIZER_VENUE_EVENT`/`PERSONAL`/`CURATOR_GUIDE`) via a new `resolveAccountTypeClassificationReview(id: ID!, accountType: AccountType!): AccountTypeClassificationReview!` mutation, guarded by `requireModerator` (AD-7 rule 5), which in one transaction sets `socialMediaAccountProfiles.accountType`/`accountTypeStatus = 'CONFIRMED'` directly on the linked account and stamps the `accountTypeClassificationReviews` row's `resolvedAccountType`/`reviewedByModeratorId`/`reviewedAt`. The moderator's choice is not constrained to match `proposedAccountType` — they have full discretion over all three values, since a low-confidence or failed proposal is exactly the case this review exists to correct.
3. **And** resolving to `ORGANIZER_VENUE_EVENT` makes the account immediately eligible for the *next* scrape trigger (batch, on-demand, etc. — Story 3.4n's gate) — this story does not itself trigger an immediate scrape, it only clears the gate for the next natural trigger. Resolving to `CURATOR_GUIDE` confirms the type but does **not** make the account scrapeable yet — Story 3.4n's scrape gate only ever allows `ORGANIZER_VENUE_EVENT`+`CONFIRMED` through; `CURATOR_GUIDE` stays excluded until Story 3.4o's minimization pipeline ships, unaffected by this story.
4. **And** this is a genuinely new list/resolve shape, not a reuse of `pendingDefaultLocationChanges`'s query/mutation (different data: a proposed classification/confidence, not a location diff) — Gate 2 (UX) confirmed during Story 3.4n's own creation that `/moderator/items` today hard-codes exactly two list types with no generic plug-in mechanism, so this adds a third, following the same page-level pattern rather than generalizing the page itself (out of scope here, reconfirmed by this story's own fresh Gate 2 pass below).
5. **And** the existing `moderatorPendingItemCount` query (FR96's combined moderator-attention badge, consumed by the shared `UserMenu.tsx`/`AppShell.tsx` nav components) is extended to also count pending (`reviewedAt IS NULL`) `accountTypeClassificationReviews` rows in its summed total — Gate 3 confirmed this is an in-scope incremental extension of an already-built, already-cross-cutting mechanism, not new shared infrastructure (added 2026-09-07 via `bmad-create-story`, not in the original `epics.md` draft — see Dev Notes).

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC2, AC4) — New backend GraphQL schema file**
  - [ ] Create `apps/backend/src/schema/account-type-classification-reviews.graphql`:
    ```graphql
    enum AccountType {
      ORGANIZER_VENUE_EVENT
      PERSONAL
      CURATOR_GUIDE
    }

    type AccountTypeClassificationReview {
      id: ID!
      accountId: ID!
      account: SocialMediaAccountProfile!
      proposedAccountType: AccountType
      confidenceScore: Float
      failureReason: String
      resolvedAccountType: AccountType
      reviewedByModeratorId: ID
      reviewedAt: String
      createdAt: String!
    }

    extend type Query {
      pendingAccountTypeClassificationReviews: [AccountTypeClassificationReview!]!
    }

    extend type Mutation {
      resolveAccountTypeClassificationReview(id: ID!, accountType: AccountType!): AccountTypeClassificationReview!
    }
    ```
  - [ ] Update `apps/backend/src/schema/moderator.graphql`'s `moderatorPendingItemCount` doc comment to mention the third source (pending account-type classification reviews), per AC5.

- [ ] **Task 2 (AC1) — `pendingAccountTypeClassificationReviews` resolver**
  - [ ] In `apps/backend/src/schema/resolvers.ts`, add to `Query`: `requireModerator(context)`; `db.select().from(accountTypeClassificationReviews).where(isNull(accountTypeClassificationReviews.reviewedAt)).orderBy(asc(accountTypeClassificationReviews.createdAt))`; map `createdAt`/`reviewedAt` to ISO strings (mirror `pendingDefaultLocationChanges`'s exact date-mapping pattern, `resolvers.ts:2371-2385`).

- [ ] **Task 3 (AC1) — `AccountTypeClassificationReview.account` field resolver**
  - [ ] Mirror `DefaultLocationChangeRequest.account` exactly (`resolvers.ts:3434-3449`): `buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info)` then `db.select({...requestedFields, id: socialMediaAccountProfiles.id}).from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, parent.accountId))`, returning `null` if not found.

- [ ] **Task 4 (AC2) — `resolveAccountTypeClassificationReview` mutation resolver**
  - [ ] `requireModerator(context)` → get `moderator`.
  - [ ] Fetch the `accountTypeClassificationReviews` row by `id`; `NOT_FOUND` if missing.
  - [ ] `INVALID_STATE_TRANSITION` if `reviewedAt !== null` (already resolved) — mirrors `resolveDefaultLocationChange`'s already-resolved guard (`resolvers.ts:1737-1741`).
  - [ ] In one `db.transaction`: update `accountTypeClassificationReviews` row (`resolvedAccountType: accountType, reviewedByModeratorId: moderator.userId, reviewedAt: new Date()`); update `socialMediaAccountProfiles` where `id = reqRow.accountId` (`accountType, accountTypeStatus: 'CONFIRMED'`). Return the updated review row with ISO-formatted dates.

- [ ] **Task 5 (AC5) — Extend `moderatorPendingItemCount`**
  - [ ] In `resolvers.ts`, add a third `Promise.all` term to the existing two (`resolvers.ts:2359-2370`): `db.select({ pendingClassificationCount: count() }).from(accountTypeClassificationReviews).where(isNull(accountTypeClassificationReviews.reviewedAt))`. Sum all three into the returned `Int!`.

- [ ] **Task 6 (AC1, AC2, AC5) — Backend integration tests**
  - [ ] New `apps/backend/src/schema/account-type-classification-reviews.test.ts`, mirroring `default-location-change-requests.test.ts`'s harness (schema-from-`src/schema/*.graphql` + `createYoga`, seeded `users`/`socialMediaAccountProfiles`/`accountTypeClassificationReviews` rows via `db.insert`):
    - `pendingAccountTypeClassificationReviews` — non-moderator rejected `FORBIDDEN`; returns only `reviewedAt IS NULL` rows, oldest-first; a row with `proposedAccountType: null`/`failureReason` set (hard-failure case) round-trips correctly.
    - `AccountTypeClassificationReview.account` field resolver returns the correct linked profile.
    - `resolveAccountTypeClassificationReview` — non-moderator rejected `FORBIDDEN`; happy path for each of the 3 `AccountType` values (assert both `socialMediaAccountProfiles.accountType/accountTypeStatus` and the review row's `resolvedAccountType/reviewedByModeratorId/reviewedAt` are updated); `NOT_FOUND` for a bad id; `INVALID_STATE_TRANSITION` when resolving an already-`reviewedAt`-set row.
    - `moderatorPendingItemCount` — reflects the new third term (seed one pending report, one pending location change, one pending classification review; assert the sum is 3; resolve the classification review; assert the sum drops to 2).

- [ ] **Task 7 (AC1, AC2) — Frontend GraphQL operations**
  - [ ] Add to `apps/web/src/features/moderation/moderation.graphql`:
    ```graphql
    query getPendingAccountTypeClassificationReviews {
      pendingAccountTypeClassificationReviews {
        id
        accountId
        proposedAccountType
        confidenceScore
        failureReason
        createdAt
        account {
          id
          displayName
          platform
          username
          profileImageUrl
          description
        }
      }
    }

    mutation resolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
      resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
        id
        resolvedAccountType
        reviewedAt
      }
    }
    ```
  - [ ] `pnpm run codegen` (both `apps/backend` and `apps/web` sides) — regenerates `useGetPendingAccountTypeClassificationReviewsQuery`/`useResolveAccountTypeClassificationReviewMutation` hooks and the new `AccountType` TypeScript enum.

- [ ] **Task 8 (Gate 2 finding) — Extend shared `StatusBadge`**
  - [ ] In `packages/ui/src/core/status-badge.tsx`, add two variants to the union (grouping into the existing color families): `"lowConfidence"` (amber, joins the `"pending"|"pendingReview"|"hiddenByMe"` group) and `"classificationFailed"` (red, joins the `"invalid"|"upheld"|"reverted"|"removedByModeration"` group).
  - [ ] Extend `status-badge.test.tsx` for both new variants.

- [ ] **Task 9 (AC1, AC2) — New `account-type-classification-row.tsx` component**
  - [ ] `apps/web/src/app/[locale]/moderator/items/account-type-classification-row.tsx`, mirroring `pending-location-change-row.tsx`'s structure (avatar with `onError` fallback to initials, header with `displayName`/`username`/platform, bounded content block, action buttons row):
    - Bio snippet: `account.description` (line-clamped; render a fallback dash/empty-state string if `null`).
    - If `proposedAccountType` is non-null: render it through the new `AccountType` i18n namespace + a `StatusBadge variant="lowConfidence"` showing the percent-formatted `confidenceScore` (via `Intl.NumberFormat` — use the existing `useScopedLocale()` pattern if `packages/ui` needs the active locale, per project-context.md's Scoped locale/timezone rule, since this is a `packages/ui`-adjacent but page-local `apps/web` component that already has `next-intl`'s `useLocale()` available directly).
    - Else (hard failure): render `failureReason` with `StatusBadge variant="classificationFailed"`.
    - Three resolve buttons, one per `AccountType` value, each calling `onResolve(review.id, accountType)`.
  - [ ] Export the `AccountTypeClassificationReview` prop-shape interface (matching `PendingLocationChange`'s export pattern).

- [ ] **Task 10 (AC1, AC2, AC3, AC5) — Wire the new section into `moderator-items-content.tsx`**
  - [ ] Add `useGetPendingAccountTypeClassificationReviewsQuery`/`useResolveAccountTypeClassificationReviewMutation` hooks (same `enabled: authStatus === "authorized"` gating as the other two).
  - [ ] Add a third page section (`<div className="space-y-6">`) after the existing two, titled via a new `pendingClassificationsSection` key, with the same empty-state/list-of-rows shape as the other two sections.
  - [ ] Fold the new query into `isLoading`/`error`/`refetchAll`; fold the new mutation's `isPending` into the existing `isMutating` aggregate (`BlockingLoader active={isMutating}`).
  - [ ] `handleResolveClassification(id, accountType)`: call the mutation, fire `moderator_account_type_classification_resolved` (payload: `{ reviewId, accountId, resolvedAccountType }`), show a success toast, refetch the classification-reviews list. Do **not** add any explicit `moderatorPendingItemCount` cache invalidation here — mirrors the existing precedent that neither `handleResolveReports` nor `handleResolveLocationChange` invalidates that query either; the badge relies on `AppShellWrapper.tsx`'s existing 60s poll for all three sources uniformly (documented parity, not a gap introduced by this story).
  - [ ] Extend the existing `moderator_items_page_viewed` PostHog payload with `pendingClassificationReviewCount: classificationsData?.pendingAccountTypeClassificationReviews?.length || 0`.

- [ ] **Task 11 (AD-6) — i18n keys**
  - [ ] `apps/web/locales/en.json`/`id.json`, `ModeratorItemsPage` namespace, add: `pendingClassificationsSection`, `emptyClassifications`, `bioLabel`, `proposedTypeLabel`, `confidenceLabel`, `classificationFailedLabel`, `failureReasonLabel`, `buttonResolveOrganizerVenueEvent`, `buttonResolvePersonal`, `buttonResolveCuratorGuide`, `classificationResolvedToast`.
  - [ ] New `AccountType` namespace (mirrors `ReportReason`'s shape): `ORGANIZER_VENUE_EVENT`, `PERSONAL`, `CURATOR_GUIDE` (en + id).

- [ ] **Task 12 (AD-5) — Analytics**
  - [ ] New event `moderator_account_type_classification_resolved` — payload `{ reviewId: string, accountId: string, resolvedAccountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' }`.
  - [ ] Extend existing `moderator_items_page_viewed` payload with `pendingClassificationReviewCount`.

- [ ] **Task 13 (Testing) — Frontend tests**
  - [ ] Extend `moderator-items-content.test.tsx`: third section renders/empty state; resolve flow (each of 3 buttons) calls the mutation with correct args, shows toast, refetches; loading/error aggregation unaffected; extended analytics payload asserted.
  - [ ] New `account-type-classification-row.test.tsx`: proposed-type+confidence branch vs. failure-reason branch render correctly; percent-formatted confidence; all three resolve buttons fire `onResolve` with correct `(id, accountType)`; avatar `onError` fallback.

- [ ] **Task 14 (Testing) — E2E**
  - [ ] One new Playwright spec: moderator resolves a pending account-type classification review (any of the 3 outcomes) and it disappears from the list — matching Story 4.7's own two-happy-path E2E precedent.

- [ ] **Task 15 (Verification) — Full sweep**
  - [ ] `pnpm --filter backend test`; `pnpm --filter web test`; `pnpm run codegen` (clean, both sides); `pnpm build`; `pnpm lint` (root).

## Dev Notes

### Architecture & UX Gate Findings

`epic-4-readiness.md` (`swept: true`, dated 2026-08-11) does **not** cover this story — its `stories_covered` list is `4.1a, 4.1, 4.2, 4.3a, 4.3, 4.4a, 4.4, 4.5, 4.6, 4.7, 4.8`, and Stories 4.7a/4.7b/4.7c were all added to `epics.md` *after* that sweep date (4.7a: 2026-08-12, 4.7b: 2026-08-24, 4.7c: 2026-09-03). Per the epic-sweep-mode lightweight staleness guard, Gate 1 and Gate 3 were **re-run fresh** via persona subagents for this story rather than citing the stale report; Gate 2 is always run fresh per-story regardless.

- **Gate 1 (Winston/Architect) — PASS.** None of the five trigger heuristics fire: no frontend-direct DB/ORM/external-service call; the new query/mutation/field-resolver are added *to* `apps/backend` (exactly where Gate 1 wants new API surface, not bypassed around it); auth (`requireModerator`) and business logic live entirely in the resolver; no new infra/compute/queue (synchronous request/response GraphQL only, consistent with Story 4.7's own prior conclusion). One documented-not-fixed observation: the new `AccountType` GraphQL enum this story introduces is stricter-typed than `SocialMediaAccountProfile.accountType`/`accountTypeStatus` (which remain plain `String`, Story 3.4n's own shipped choice) — a real inconsistency but not a blocking architecture gap; see "GraphQL Typing Note" below.
- **Gate 2 (Freya/UX) — PASS.** No `DESIGN.md`/`EXPERIENCE.md` run covers this feature (it postdates `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` entirely) — confirmed by direct search. A fresh pass against the actual current code (not just Story 3.4n's own prior one-line Gate 2 note) confirms: the two existing `/moderator/items` sections are structurally identical, single-purpose, page-local (own hook, own empty state, own row list, no shared container/tabs abstraction) — there is no latent shared machinery a third section needs to slot into, and no ≥2-consumer reuse case for the new row component (exactly 1 consumer, same as its two siblings). Recommendation adopted: extend the shared `StatusBadge` variant union in place (Task 8) rather than inventing a new badge component, matching Story 4.7's own established precedent.
- **Gate 3 (Winston/Architect) — PASS.** i18n, analytics, GraphQL/codegen, app-shell/nav, and `buildOptimizedDrizzleSelect` are all already-established foundations already exercised twice on this exact page — this story only adds incremental usage (new namespace entries, one new event, one new query/mutation via the existing pipeline), not new foundational infrastructure. The one substantive question assessed: whether extending `moderatorPendingItemCount` (FR96, consumed by the shared `UserMenu.tsx`/`AppShell.tsx`) is itself a cross-cutting gap. Conclusion: **no** — the mechanism is already built, already proven to aggregate heterogeneous sources (it already sums two today), and adding a third summed term is incremental extension of existing shared infrastructure, not construction of new infrastructure (the same logic Gate 3's own heuristic already applies to "adding a new event to an already-set-up analytics system"). Flagged as a task-completeness note, not a gap: the extension must not silently regress the existing two counts (Task 6's test asserts all three sources together).

**A pre-existing bug was found and raised to the user, not resolved either way by default — the user did not answer.** While reading `moderator-items-content.tsx`/`pending-location-change-row.tsx` in full (mandatory, since this story adds a third section to the exact same page/file), it was confirmed by direct code search that Story 4.7's own 2026-08-29 `epics.md` amendment (FR94-96: "this page's pending-change list shows both post-hoc `PENDING_REVIEW` items... and pre-hoc `AWAITING_APPROVAL` items (new approve/reject...), visually distinguished") was **not actually shipped** in the frontend: `PendingLocationChangeRow` only ever renders Accept/Revert buttons (no Approve/Reject, no `AWAITING_APPROVAL` visual distinction), and the `DefaultLocationChangeStatus` i18n namespace is missing `AWAITING_APPROVAL`/`REJECTED`/`SUPERSEDED` keys entirely — meaning a moderator who clicks Accept/Revert on an `AWAITING_APPROVAL` row today gets an unhandled backend `INVALID_STATE_TRANSITION` error. Presented to the user via `AskUserQuestion` (fix now vs. document-only, recommended); the user did not respond. Per this workflow's default-to-recommended-option-on-no-answer guidance, this is **documented as a known, out-of-scope gap in Story 4.7's own code** — not fixed by this story, which stays strictly scoped to account-type classification review (unrelated feature, unrelated table). Whoever picks up Story 4.7's own follow-up should add the missing Approve/Reject UI + the three missing i18n keys.

### GraphQL Typing Note (Gate 1 finding, accepted)

The new `AccountType` enum (`ORGANIZER_VENUE_EVENT`/`PERSONAL`/`CURATOR_GUIDE`) follows the stricter, better-typed `default-location-change-requests.graphql` precedent (real GraphQL enums: `DefaultLocationChangeRequestStatus`, `DefaultLocationChangeAction`, `DefaultLocationChangeSource`) rather than `social-media-accounts.graphql`'s looser choice of exposing `accountType`/`accountTypeStatus` as bare `String` (Story 3.4n's own Task 7 shipped shape, confirmed by direct read of `apps/backend/src/schema/social-media-accounts.graphql:14-15`). This creates a real, confirmed inconsistency across the schema — the same underlying Postgres enum values are typed two different ways in two different GraphQL surfaces — but Gate 1 confirmed it is not a blocking architecture gap (no missing infra/API layer, purely a schema-style convention). A follow-up could retrofit `SocialMediaAccountProfile.accountType`/`accountTypeStatus` to the new `AccountType` enum for consistency, but that touches Story 3.4n's own subscriber-facing field and is out of this story's scope — documented here so it isn't silently forgotten as drift, not fixed.

### Data Type Compatibility & Migration Requirements

- **No mismatch requiring a new migration.** `accountTypeEnum`/`accountTypeStatusEnum`, `socialMediaAccountProfiles.accountType/accountTypeStatus/accountTypeConfidenceScore`, and the full `accountTypeClassificationReviews` table (with `accountId`/`proposedAccountType`/`confidenceScore`/`failureReason`/`resolvedAccountType`/`reviewedByModeratorId`/`reviewedAt`/`createdAt` + relations) already exist — confirmed by direct read of `packages/database/schema.ts:80-81, 149-169, 497-520` — migrated and applied by Story 3.4n (status: `review`).
- **Impacted contracts:** new GraphQL SDL file/type/enum/query/mutation (Task 1); regenerated `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` (Task 7) — additive only, no breaking change to any existing type.
- **`moderatorPendingItemCount`'s return type (`Int!`) is unchanged** — only the summed *value* gains a third source; no client-side type change beyond regenerating the same scalar-returning hook.
- **Backward compatibility:** purely additive across the board; no existing query/mutation/resolver shape changes except the internal implementation of `moderatorPendingItemCount` (Task 5).
- **Verification:** Task 6's backend integration tests prove the read/resolve/badge-count paths end-to-end, including the specific before/after assertion on `moderatorPendingItemCount`'s summed value.

### Package boundaries (project-context.md Code Organization rule)

All new logic is either GraphQL schema/resolver orchestration in `apps/backend` (DB-coupled, correctly not `packages/domain` — there is no portable, pure, cross-entity logic here, just a straightforward CRUD read/resolve pair mirroring `pendingDefaultLocationChanges`/`resolveDefaultLocationChange`) or page-local `apps/web` components (single consumer each, matching Story 4.7's own Code Organization decision) — plus one in-place `packages/ui/src/core/status-badge.tsx` variant addition (a Core Primitive, the sanctioned extension point Story 4.7 itself already used). No new `packages/domain` or `packages/ui/src/features/` additions.

### State Management Categorization

**Server State** (`@tanstack/react-query` via the generated `useGetPendingAccountTypeClassificationReviewsQuery`/`useResolveAccountTypeClassificationReviewMutation` hooks) — identical categorization to this page's other two sections. No URL state, no new Client Global (zustand) state.

### Loader Categorization

- **Initial load of the new section:** Non-Blocking, folded into the page's existing shared `isLoading` → `<RouteLoader />` gate (matches both existing sections — this page's precedent is one page-level route loader, not per-section skeletons; no new skeleton component needed).
- **Resolve mutation:** Blocking (`BlockingLoader`), folded into the existing `isMutating` aggregate alongside the page's other three mutations.

### i18n Keys Required (AD-6)

- `ModeratorItemsPage` (en/id, new keys): `pendingClassificationsSection`, `emptyClassifications`, `bioLabel`, `proposedTypeLabel`, `confidenceLabel`, `classificationFailedLabel`, `failureReasonLabel`, `buttonResolveOrganizerVenueEvent`, `buttonResolvePersonal`, `buttonResolveCuratorGuide`, `classificationResolvedToast`.
- New `AccountType` namespace (en/id): `ORGANIZER_VENUE_EVENT`, `PERSONAL`, `CURATOR_GUIDE` — mirrors `ReportReason`'s exact shape (exact-enum-member-name keys, resolved via `useTranslations("AccountType")`).

### Analytics Events Required (AD-5)

- `moderator_account_type_classification_resolved` — `{ reviewId: string, accountId: string, resolvedAccountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' }`.
- `moderator_items_page_viewed` (existing event, extended payload) — add `pendingClassificationReviewCount: number`.

### List Rendering Decision

A third page-local vertical section (`<div className="space-y-6">`), appended after the existing two, matching their exact structural shape (heading, empty state, list of row components) — not a tab, not a generalized plug-in list mechanism. Gate 2 (both the fresh pass above and Story 3.4n's own prior note) confirms `/moderator/items` intentionally hard-codes its list types rather than generalizing; building a generic mechanism is explicitly out of scope.

### Existing code read in full (mandatory — files this story modifies or reads as its structural template)

- **`moderator-items-content.tsx`** (full file, modified) — current state: two hard-coded sections, per-section hook pattern, shared `isMutating`/`isLoading`/`error`/`refetchAll` aggregation, a PostHog view-tracking `useEffect`, and a separate mutation-cache-subscribe `useEffect` for the location-edit-dialog toast (unrelated to this story — must not be disturbed). This story adds a third section following the identical shape and folds its query/mutation into the existing aggregation variables only.
- **`pending-location-change-row.tsx`** (full file, read-only) — confirmed, while reading, the pre-existing Approve/Reject/`AWAITING_APPROVAL` gap documented above. Not touched by this story.
- **`reported-event-group.tsx`** (full file, read-only) — read for the `StatusBadge`/avatar/row-layout pattern the new row component (Task 9) follows.
- **`page.tsx`** (read-only, no change needed) — route shell is already `Suspense`/`RouteLoader`-wrapped, generic to any content component.
- **`social-media-accounts.graphql`** (read-only) — confirmed the current `accountType`/`accountTypeStatus: String` shape (source of the "GraphQL Typing Note" above). Not modified by this story.
- **`default-location-change-requests.graphql` / `resolvers.ts`'s `pendingDefaultLocationChanges`/`resolveDefaultLocationChange`/`DefaultLocationChangeRequest.account`/`moderatorPendingItemCount`** — read directly as this story's structural template (Tasks 1-4 mirror these exactly); `moderatorPendingItemCount` is the one modified (Task 5), the rest are read-only precedent.
- **`packages/database/schema.ts`** (`accountTypeEnum`, `accountTypeStatusEnum`, `socialMediaAccountProfiles`, `accountTypeClassificationReviews` + relations, lines 80-81/149-169/497-520) — confirmed already migrated by Story 3.4n; no new migration in this story.
- **`packages/ui/src/core/status-badge.tsx`** (full file, modified) — confirmed current variant union and color-family grouping before adding the two new variants (Task 8).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.7c`] — this story's authoritative AC/Note text.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.7`, `_bmad-output/implementation-artifacts/4-7-moderator-items-page.md`] — the owning page's full spec, structural precedent (two-section pattern), and its own `moderatorPendingItemCount`/FR94-96 amendment text (the source of the pre-existing-bug finding above).
- [Source: `_bmad-output/implementation-artifacts/3-4n-filter-scraped-accounts-by-type-organizer-venue-event-only.md`] — the schema/table this story reads and resolves against; confirms `accountTypeClassificationReviews`'s exact shape and rationale, and this story's own origin (split off during 3.4n's creation).
- [Source: `packages/database/schema.ts:80-81, 149-169, 497-520`] — confirmed directly, not assumed: `accountTypeEnum`, `accountTypeStatusEnum`, `socialMediaAccountProfiles` columns, `accountTypeClassificationReviews` table + relations.
- [Source: `apps/backend/src/schema/default-location-change-requests.graphql`, `resolvers.ts:2371-2385, 1724-1770ish, 3434-3449`] — structural template for the new query/mutation/field-resolver (Tasks 1-4).
- [Source: `apps/backend/src/schema/moderator.graphql`, `resolvers.ts:2359-2370`] — `moderatorPendingItemCount`'s existing two-source sum, extended by Task 5.
- [Source: `apps/backend/src/schema/social-media-accounts.graphql:14-15`] — confirmed `accountType`/`accountTypeStatus: String` (GraphQL Typing Note).
- [Source: `apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx`, `pending-location-change-row.tsx`, `reported-event-group.tsx`] — read in full this session; source of the pre-existing-bug finding and this story's UI structural template.
- [Source: `packages/ui/src/core/status-badge.tsx`] — read in full this session; current variant union confirmed before extension.
- [Source: `apps/web/locales/en.json`/`id.json`] — confirmed current `ModeratorItemsPage`/`ReportReason`/`DefaultLocationChangeStatus` namespace shapes (the latter confirmed missing `AWAITING_APPROVAL`/`REJECTED`/`SUPERSEDED`, part of the pre-existing-bug finding) before drafting new keys.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions and epic-sweep-mode staleness guidance (source of "run fresh, don't cite the stale sweep" above).
- [Source: `_bmad-output/project-context.md#API-Data, #State-Management-Architecture, #Locale-Sensitive-Data-Rendering, #Code-Organization`] — source of the `buildOptimizedDrizzleSelect` reuse, State Management categorization, percent-formatted-confidence requirement, and package-boundary reasoning above.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-2, #AD-5, #AD-6, #AD-7`] — AD-7 rule 5 (new moderator-gated resources extend `requireModerator`); AD-2 confirmed not implicated (moderator-domain query, not a competing events-collection endpoint); AD-5/AD-6 (analytics/i18n taxonomy).

## Global Rules References

- [x] `_bmad-output/project-context.md` — API & Data (GraphQL Code Generator, `buildOptimizedDrizzleSelect` reuse for the new field resolver); State Management Architecture (Server State via React Query only); Locale-Sensitive Data Rendering (`AccountType` enum through next-intl, percent-formatted `confidenceScore` via `Intl.NumberFormat`, never raw); Code Organization (`apps/backend` orchestration + page-local `apps/web` components, `packages/ui` Core Primitive extension for `StatusBadge`, no `packages/domain` addition).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-2 (not implicated — confirmed above); AD-5 (analytics taxonomy, Task 12); AD-6 (i18n strategy, Task 11); AD-7 rule 5 (new mutation/query `requireModerator`-guarded).
- [x] `docs/infrastructure/index.md` — confirmed no infra shard read needed: synchronous request/response GraphQL only, no Lambda/SQS/EventBridge/queue change (Gate 1 finding above).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/schema/account-type-classification-reviews.graphql`; `apps/backend/src/schema/account-type-classification-reviews.test.ts`; `apps/web/src/app/[locale]/moderator/items/account-type-classification-row.tsx` + `.test.tsx`; one new Playwright E2E spec.
- **Modified:** `apps/backend/src/schema/resolvers.ts` (new query/mutation/field resolver + `moderatorPendingItemCount` extension); `apps/backend/src/schema/moderator.graphql` (doc comment); `apps/web/src/features/moderation/moderation.graphql` (new query/mutation ops); `apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx` + `.test.tsx`; `packages/ui/src/core/status-badge.tsx` + test; `apps/web/locales/en.json`/`id.json`; `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (codegen, regenerated).
- **Not modified:** `packages/database/schema.ts` (no migration — already shipped by Story 3.4n); `packages/domain`; `packages/shared-types`; `apps/web/src/app/[locale]/moderator/items/pending-location-change-row.tsx`, `reported-event-group.tsx`, `page.tsx`, `apps/backend/src/schema/default-location-change-requests.graphql` (read-only precedent); `apps/backend/src/schema/social-media-accounts.graphql` (read-only, Story 3.4n's field, GraphQL Typing Note documented not fixed); `apps/infrastructure` (no IaC change).

### Rule Mapping

- **AD-7 rule 5:** `pendingAccountTypeClassificationReviews`/`resolveAccountTypeClassificationReview` both `requireModerator`-guarded, extending the existing single enforcement surface.
- **AD-2:** confirmed not implicated — a moderator-domain query over `accountTypeClassificationReviews`, not a second events-collection endpoint.
- **AD-5:** one new analytics event + one extended payload, both `noun_verb`-shaped (Task 12).
- **Locale-Sensitive Data Rendering rule:** `AccountType` resolved through the new i18n namespace (Task 11); `confidenceScore` formatted via `Intl.NumberFormat({ style: 'percent' })`, never raw decimal (AC1, Task 9); `createdAt` via the existing scoped-locale date pattern.
- **Core Primitives rule:** `StatusBadge` extended in place (Task 8), not duplicated.
- **Code Organization rule:** all new frontend components stay `apps/web`-local (single consumer, per Gate 2); backend orchestration stays `apps/backend` (no portable pure logic, so no `packages/domain` addition).

### Verification Plan

- `pnpm --filter backend test` — new `account-type-classification-reviews.test.ts` passes (Task 6); no regression in `default-location-change-requests.test.ts`/`resolvers.test.ts`.
- `pnpm --filter web test` — extended `moderator-items-content.test.tsx` and new `account-type-classification-row.test.tsx` pass; extended `status-badge.test.tsx` passes including pre-existing variants.
- `pnpm run codegen` — clean regeneration on both `apps/backend` and `apps/web` sides.
- `pnpm build` / `pnpm lint` (root) — full monorepo build/lint clean.
- Playwright E2E: moderator resolves a pending classification review and it disappears from the list.
- Manual runtime check: visit `/moderator/items` as a moderator with zero/one/many pending classification reviews, including at least one hard-failure row (`failureReason` set, no `proposedAccountType`); resolve to each of the 3 `AccountType` values; confirm `id` locale renders `AccountType` labels and percent-formatted confidence correctly; confirm the combined moderator badge count reflects the new source after its next 60s poll (documented parity with the existing two sources — not an immediate invalidation, matching current behavior).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: adds a third page-local section to `/moderator/items` surfacing `accountTypeClassificationReviews` rows with no `reviewedAt` set, resolved via a 3-way `accountType` choice; one new backend query, one new mutation, one new field resolver; extends `moderatorPendingItemCount`'s sum; no DB migration (Story 3.4n already shipped the schema).
- [ ] Architecture and boundary confirmation: Gate 1/2/3 all **PASS** (freshly re-run — `epic-4-readiness.md` predates and does not cover Stories 4.7a/4.7b/4.7c); new GraphQL surface `requireModerator`-guarded throughout; `StatusBadge` extended in place; no `packages/domain`/`packages/ui` feature-package additions.
- [ ] Testing plan confirmation: backend integration tests for every new resolver branch plus `moderatorPendingItemCount`'s extended sum + frontend integration tests for every render/action branch + one E2E happy path, per Tasks 6/13/14.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Story 3.4n is `review` (schema/table live, confirmed by direct code read); Story 4.7 and Story 4.7b are both `review` (page/route-guard/shell live). No new prerequisite story was created by this pass — all three gates returned **PASS**. Separately, a pre-existing bug in Story 4.7's own shipped code (missing Approve/Reject UI + i18n for `AWAITING_APPROVAL` default-location-change rows) was found while reading files this story touches and raised to the user via `AskUserQuestion`; the user did not respond, so per this workflow's default-to-recommended-option rule it is accepted as a known, out-of-scope gap for Story 4.7's own follow-up — not a blocker for this story, whose scope is unrelated (a different table, a different review flow).

## Testing Requirements

- [ ] Backend integration tests (Vitest/`node:test`, `apps/backend`): `pendingAccountTypeClassificationReviews` (non-moderator `FORBIDDEN`; returns only `reviewedAt IS NULL` rows, oldest-first; hard-failure row shape round-trips); `AccountTypeClassificationReview.account` field resolver; `resolveAccountTypeClassificationReview` (non-moderator `FORBIDDEN`; happy path × 3 `AccountType` values, both tables asserted updated; `NOT_FOUND`; `INVALID_STATE_TRANSITION` on already-resolved); `moderatorPendingItemCount` reflects the new third term before/after resolution.
- [ ] Frontend integration tests (Vitest + msw, `apps/web`): third section renders/empty state; proposed-type+confidence branch vs. failure-reason branch; percent-formatted confidence; all three resolve buttons fire correct mutation args + toast + refetch; loading/error aggregation unaffected by the new section; extended `moderator_items_page_viewed` analytics payload.
- [ ] E2E (Playwright): moderator resolves a pending classification review and it disappears from the list.

## Deliverables Checklist

- [ ] New GraphQL schema file (`account-type-classification-reviews.graphql`) + `moderator.graphql` doc-comment update (Task 1)
- [ ] `pendingAccountTypeClassificationReviews` query resolver (Task 2)
- [ ] `AccountTypeClassificationReview.account` field resolver (Task 3)
- [ ] `resolveAccountTypeClassificationReview` mutation resolver (Task 4)
- [ ] `moderatorPendingItemCount` extended to a three-source sum (Task 5)
- [ ] Backend integration tests (Task 6)
- [ ] Frontend GraphQL operations + regenerated codegen (Task 7)
- [ ] `StatusBadge` extended with `lowConfidence`/`classificationFailed` variants (Task 8)
- [ ] New `account-type-classification-row.tsx` component (Task 9)
- [ ] Third section wired into `moderator-items-content.tsx` (Task 10)
- [ ] i18n keys — `ModeratorItemsPage` additions + new `AccountType` namespace, en/id (Task 11)
- [ ] Analytics — new event + extended existing payload (Task 12)
- [ ] Frontend tests (Task 13)
- [ ] E2E test (Task 14)
- [ ] Full verification sweep green (Task 15)

## Out of Scope

- **Retrofitting `SocialMediaAccountProfile.accountType`/`accountTypeStatus` from `String` to the new `AccountType` enum** — Gate 1 finding, documented not fixed; Story 3.4n's own field, no accepted prerequisite needed since Gate 1 returned PASS (not a blocking gap).
- **Fixing Story 4.7's pre-existing `AWAITING_APPROVAL` default-location-change Approve/Reject UI/i18n gap** — found while reading files this story touches; raised via `AskUserQuestion`, left unanswered, defaulted to document-only per this workflow's rule. A follow-up to Story 4.7 should pick this up.
- **Triggering an immediate re-scrape when a review resolves to `ORGANIZER_VENUE_EVENT`** — AC3 only clears the gate for the next natural trigger (batch/on-demand/recovery-sweep), per Story 3.4n's own design.
- **`CURATOR_GUIDE` accounts becoming scrapeable** — remains gated behind Story 3.4o (minimization pipeline), unaffected by this story's resolution action.
- **Legacy `SocialMediaAccountProfile` rows with `accountTypeStatus IS NULL`** — entirely out of this story's scope (Story 3.4n's own accepted gap, its AC5); this story only ever surfaces rows that already have a corresponding `accountTypeClassificationReviews` entry.
- **Immediate `moderatorPendingItemCount` cache invalidation on resolve** — relies on the existing 60s poll, matching current parity with the page's other two sections (neither invalidates it either); not a regression introduced by this story.

## Definition of Done

- [ ] AC1-AC5 satisfied
- [ ] All tests in Tasks 6/13/14 passing
- [ ] Lint and type checks passing for touched packages
- [ ] No `epics.md`/`sprint-status.yaml` prerequisite additions needed (all three gates returned PASS)

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
