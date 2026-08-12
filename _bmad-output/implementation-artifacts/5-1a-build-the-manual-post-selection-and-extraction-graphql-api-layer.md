# Story 5.1a: Build the manual post selection & extraction GraphQL API layer

## Story Details

- Epic: 5
- Story ID: 5.1a
- Status: ready-for-dev

## Story

As a developer,
I want GraphQL queries and mutations exposing a user's subscriptions (with inactive status), their subscribed accounts' posts, their remaining extraction quota, and the ability to submit selected posts for processing,
So that Stories 5.1-5.5 read and write manual-post-selection data through the backend API instead of the frontend querying the database or the AI Gateway adapter directly.

## Acceptance Criteria

*   **Given** Story 0.8's GraphQL scaffold, Story 0.17's auth context, Story 0.13's AI Gateway adapter, Story 3.1a's `social_media_account_profiles`/`subscriptions` tables, Story 3.2's `mySubscriptions` query/`removeSubscription` mutation, and Story 3.3a's `posts` table exist,
*   **When** a client requests `mySubscriptions`,
*   **Then** it returns Story 3.2's already-built active (`deletedAt IS NULL`, AD-8) subscriptions list (each including the `isNewlyAdded` flag, Story 3.2), **extended by this story** with a computed `isInactive` flag (true when no posts have been published within a configurable period, default 30 days, derived from the `posts` table's `published_at` column, Story 3.3a) — this story adds the field to Story 3.2's existing query/resolver, it does not redeclare `mySubscriptions` from scratch.
*   **And** a `postsByAccount(accountId, cursor, limit)` query returns that account's posts ordered by `publishedAt` descending (20 most recent, lazily paginated per FR52/FR53) with each post's `isExtracted` status (Story 3.3a), scoped so a caller can only query accounts they hold an active subscription to (Story 3.1a).
*   **And** a `myExtractionQuota` query returns the authenticated user's remaining extraction quota for the current billing cycle, read from the AI Gateway adapter's per-key usage tracking (Story 0.13) — this story does not reimplement usage tracking.
*   **And** a `selectPostsForExtraction(postIds: [ID!])` mutation validates server-side that the selection does not exceed `myExtractionQuota` (never trusting client-side enforcement alone, FR58), then enqueues the selected posts onto the `AIProcessingQueue` via Story 3.5's queue-producer logic — this mutation is the entry point Story 3.5 expects for manually-selected posts (PRD §3.10).
*   **And** a `markSubscriptionViewed(subscriptionId)` mutation clears that subscription's `isNewlyAdded` flag once its tab has been opened in the Manual Post Selection screen.
*   **And** Story 5.4's "remove this inactive subscription" action calls Story 3.2's already-built `removeSubscription(id, action: SoftDeleteAction!)` mutation directly — this story does not add a second/duplicate removal mutation.
*   **And** no package outside `apps/backend` writes to `subscriptions`, `social_media_account_profiles`, or `posts`, or reads AI Gateway usage-tracking state, directly.

## Tasks / Subtasks

- [ ] **Task 1: Backend — GraphQL Schema Updates** (AC: All)
  - [ ] Extend the `Subscription` type in `apps/backend/src/schema/subscriptions.graphql` with a computed `isInactive: Boolean!` field.
  - [ ] Add `markSubscriptionViewed(subscriptionId: ID!): Subscription!` to mutations in `apps/backend/src/schema/subscriptions.graphql`.
  - [ ] Add type definitions in `apps/backend/src/schema/extraction.graphql`:
    - `type Post` containing: `id: ID!`, `accountId: ID!`, `content: String!`, `imageUrl: String`, `postUrl: String!`, `originalPostUrl: String`, `isExtracted: Boolean!`, `publishedAt: String!`.
    - `type PostConnection` containing: `items: [Post!]!`, `nextCursor: String`, `hasMore: Boolean!`.
    - `type ExtractionQuota` containing: `limit: Int!`, `used: Int!`, `remaining: Int!`.
  - [ ] Add the following queries to `apps/backend/src/schema/extraction.graphql`:
    - `postsByAccount(accountId: ID!, cursor: String, limit: Int): PostConnection!`
    - `myExtractionQuota: ExtractionQuota!`
  - [ ] Add the following mutation to `apps/backend/src/schema/extraction.graphql`:
    - `selectPostsForExtraction(postIds: [ID!]!): [Post!]!` (returns the list of newly enqueued posts).

- [ ] **Task 2: Backend — Resolvers Implementation** (AC: All)
  - [ ] **`Subscription.isInactive` computed field resolver**:
    - Query the `posts` table for the most recent post belonging to the subscription's `accountId` (order by `posts.publishedAt` descending, limit 1).
    - If no posts are found, or the most recent post's `publishedAt` timestamp is older than 30 days ago (relative to `Date.now()`), return `true`. Otherwise, return `false`.
  - [ ] **`Mutation.markSubscriptionViewed` resolver**:
    - Require authentication (`requireAuth(context)`).
    - Update `subscriptions` set `isNewlyAdded = false`, where `id = subscriptionId` and `userId = authUser.userId`.
    - Retrieve and return the updated subscription row via `formatSubscription`.
  - [ ] **`Query.myExtractionQuota` resolver**:
    - Require authentication (`requireAuth(context)`).
    - Query active (`deletedAt IS NULL`) keys in the `apiKeys` table for `userId = authUser.userId`.
    - Compute quota usage across the user's valid keys:
      - `limit` = `(number of active keys) * 50`.
      - `used` = sum of `usageCount` across these keys (using `isCycleElapsed` to reset usage counts to 0 if the cycle has reset, matching `usage-store.ts` logic).
      - `remaining` = max of `0` and `limit - used`.
    - Return `ExtractionQuota` object.
  - [ ] **`Query.postsByAccount` resolver**:
    - Require authentication (`requireAuth(context)`).
    - Security Scope Check: Query `subscriptions` to confirm the authenticated user holds an active subscription (`deletedAt IS NULL`) for `accountId`. If none exists, throw a GraphQLError with code `NOT_FOUND` (or `FORBIDDEN` / "No active subscription to this account").
    - Fetch posts for `accountId` from the `posts` table ordered by `publishedAt` descending.
    - Implement Cursor-based Pagination:
      - If `cursor` (an ISO-8601 date string representing the threshold `publishedAt`) is provided, add condition `posts.publishedAt < cursor`.
      - Query `limit + 1` rows (default `limit = 20`).
      - If returned rows count exceeds `limit`, slice to `limit`, set `hasMore = true`, and set `nextCursor` to the `publishedAt.toISOString()` of the last returned post. Otherwise, `hasMore = false` and `nextCursor = null`.
      - Return `PostConnection`.
  - [ ] **`Mutation.selectPostsForExtraction` resolver**:
    - Require authentication (`requireAuth(context)`).
    - Retrieve user's remaining quota using `myExtractionQuota` logic. If `postIds.length > remainingQuota`, throw a GraphQLError with code `QUOTA_EXHAUSTED` and message "Selection exceeds remaining API quota".
    - Security Scope Check: Query the database to ensure all `postIds` submitted belong to accounts the user is actively subscribed to.
    - Loop through each `postId` and call the existing `enqueuePostForProcessing(postId)` function (from `apps/backend/src/lib/posts/enqueue-post-for-processing.ts`).
      - Note: `enqueuePostForProcessing` independently validates that each post exists and that `isExtracted` is `false` (throwing `PostAlreadyExtractedError` if `isExtracted` is true), matching `enqueuePostForProcessing`'s robust design.
    - Query and return the processed `Post` objects.

- [ ] **Task 3: GraphQL Code Generator** (AC: All)
  - [ ] Run the GraphQL code generator to update types in `apps/backend` and `apps/web`: `pnpm --filter backend run codegen` and `pnpm --filter web run codegen`.

- [ ] **Task 4: Automated Testing** (AC: All)
  - [ ] Extend/add integration tests in `apps/backend/src/schema/extraction.test.ts` covering:
    - `Subscription.isInactive`: test true/false cases based on published post timestamps.
    - `markSubscriptionViewed`: verify it sets `isNewlyAdded` to `false` and requires ownership.
    - `myExtractionQuota`: test cases with 0, 1, or 2 keys, including elapsed billing cycles.
    - `postsByAccount`: verify active subscription check, cursor-based descending sorting, and pagination.
    - `selectPostsForExtraction`: verify security checks, quota exhaustion checks, and successful enqueuing.

## Dev Notes

- **Package boundaries:** Strictly separate responsibilities. State management remains in `apps/web` while data-fetching and resolver logic is restricted to `apps/backend`.
- **Database schemas:** Reuses existing schemas. No migrations or structural schema edits needed.
- **Drizzle performance:** Uses `buildOptimizedDrizzleSelect` to avoid fetching unneeded columns when fetching profiles.

### Architecture & UX Gate Findings

- **Finding 1 — Shared Backend API layer missing for Epic 5**: Corrected in `epics.md` during the Epic 5 readiness sweep. This story acts as the prerequisite data/API layer for Stories 5.1-5.5.
- **Finding 2 — UI Complexity & Reusability**: No UI components in scope of this backend story; therefore, no Gate 2 UI split is required.
- **Finding 3 — `isNewlyAdded` flag and lifecycle**: Sourced from `epic-5-readiness.md`. The `isNewlyAdded` flag on subscriptions is set to `true` on creation and is cleared via this story's `markSubscriptionViewed` mutation.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** Checked database columns against GraphQL schemas. Database columns on `subscriptions`, `social_media_account_profiles`, and `posts` are fully compatible with required GraphQL schemas.
- **Impacted fields/contracts:**
  - `Subscription.isInactive: Boolean!` computed field.
  - `Query.postsByAccount(accountId: ID!, cursor: String, limit: Int): PostConnection!` query.
  - `Query.myExtractionQuota: ExtractionQuota!` query.
  - `Mutation.selectPostsForExtraction(postIds: [ID!]!): [Post!]!` mutation.
  - `Mutation.markSubscriptionViewed(subscriptionId: ID!): Subscription!` mutation.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** Autogenerated by Running `pnpm run codegen`.
- **Backward compatibility and rollout notes:** Fully backward-compatible. Additive schema queries/mutations do not break any existing clients.
- **Verification checks:** Tests in `extraction.test.ts` verify the schema is correctly mapped to DB columns and resolvers.

### Project Structure Notes

- Extends `apps/backend/src/schema/subscriptions.graphql`, `apps/backend/src/schema/extraction.graphql`, and `apps/backend/src/schema/resolvers.ts`.
- Tests added to `apps/backend/src/schema/extraction.test.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-5-readiness.md#Finding-3]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.1a]
- [Source: apps/backend/src/schema/subscriptions.graphql]
- [Source: apps/backend/src/schema/extraction.graphql]
- [Source: apps/backend/src/schema/resolvers.ts]

## Global Rules References

- [x] project-context.md
- [x] story-content-structure.md
- [x] architecture spine
- [x] infrastructure docs

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modify `apps/backend/src/schema/subscriptions.graphql`
  - Modify `apps/backend/src/schema/extraction.graphql`
  - Modify `apps/backend/src/schema/resolvers.ts`
  - Modify `apps/backend/src/schema/extraction.test.ts`
- **Rule Mapping:**
  - AD-8 (Soft delete): `mySubscriptions` uses `activeOnly(subscriptions)` (reused as-is from Story 3.2).
  - Security scoping: Queries and mutations authorize the caller via `requireAuth(context)` and verify record ownership before writing.
- **Verification Plan:**
  - Run `pnpm --filter backend run test` to verify integration tests pass successfully.
  - Run `pnpm --filter backend run lint` and `pnpm --filter backend run typecheck` to confirm code health.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Resolver integration tests in `apps/backend/src/schema/extraction.test.ts` asserting all happy and failure paths for the queries and mutations defined in this story.

## Deliverables Checklist

- [ ] Extended `Subscription` schema and resolvers (`isInactive`, `markSubscriptionViewed`).
- [ ] Added `PostConnection` schema and resolvers (`postsByAccount`, `myExtractionQuota`).
- [ ] Added manual post selection mutation (`selectPostsForExtraction`).
- [ ] Passing integration tests.

## Out of Scope

- Any UI implementation (Manual Post Selection screen is owned by Story 5.1).
- Dynamic SQS queue consumer / AI processor (owned by Story 3.5).

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Gemini CLI (Built-in Default Mode)

### Debug Log References

### Completion Notes List

### File List
