# Story 6.1a: Build the account-vote backend GraphQL API layer

## Story Details

- Epic: 6
- Story ID: 6.1a
- Status: ready-for-dev

## Story

As a developer,
I want an `account_votes` table plus GraphQL mutations/queries for casting, withdrawing, ranking, and autocomplete-suggesting voted social media accounts — including the account-creation path for a not-yet-profiled account,
So that Stories 6.1-6.4 read and write vote data through the backend API instead of the frontend querying the database or scraper adapters directly.

## Acceptance Criteria

1. **Given** Story 0.17's auth context, Story 3.1a's `social_media_account_profiles`/`subscriptions` tables, and Story 3.3c's `ScraperAdapter` interface (amended below to add `lookupAccountProfile`) exist, **when** the migration script runs, **then** an `account_votes` table (PRD §4.15) is created: `id` (uuid pk), `user_id` (FK to users), `account_id` (FK to `social_media_account_profiles`), `created_at`, `deleted_at` (nullable, AD-8), unique on (`user_id`, `account_id`) — re-voting after a withdrawal clears `deleted_at` on the existing row rather than inserting a new one, per PRD §4.15.
2. **And** a `castVote(input: CastVoteInput!): AccountVote!` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17). `CastVoteInput` accepts either an existing `accountId` (uuid) or a `{ platform, handleOrUrl }` pair for a not-yet-profiled account. For the latter path, the resolver: (a) confirms `platform` is scrapeable via Story 3.3c's registry — a local membership check, no adapter call; (b) calls Story 3.3c's (amended) `ScraperAdapter.lookupAccountProfile(platform, handleOrUrl)` to fetch the platform-native `accountId`/`displayName`/`username` (existence-check + public metadata only — never a post scrape or AI extraction, PRD §3.13); (c) passes the result through Story 3.1a's existing lookup-or-create logic to get-or-create the `social_media_account_profiles` row (matched by `platform`+`accountId`, never by handle text); (d) inserts/reactivates the caller's `account_votes` row against that profile's internal `id`. An unscrapeable platform or a failed lookup (account doesn't exist on the platform) returns a `GraphQLError` (`BAD_REQUEST`) rather than creating a placeholder profile.
3. **And** re-casting a vote for an account the caller already actively voted for is a no-op returning the existing `AccountVote` (idempotent), not a duplicate-key error.
4. **And** a `withdrawVote(id: ID!, action: SoftDeleteAction!): AccountVote!` mutation (AD-8 rule 4 shape) soft-deletes the caller's own vote — ownership is verified against `context.user`, never a client-supplied user ID — and an attempt to withdraw an already-withdrawn vote throws `INVALID_STATE_TRANSITION`, matching `removeSubscription`/`deleteApiKey` precedent.
5. **And** a `rankedVoteAccounts(nearMe: Boolean, locationPreferenceId: ID): [RankedAccountVote!]!` query returns every voted account ordered by active (non-soft-deleted) vote count descending, each entry carrying the account's `SocialMediaAccountProfile` fields and its vote count; accounts with at least one active `Subscription` (any tier, `activeOnly(subscriptions)`, Story 0.22) are excluded from the ranking (PRD §3.13 "Leaving the Vote List" / FR76) — this is a **read-time filter** joining `subscriptions`, not a write-time side effect on Story 3.1/3.2's `subscribeToAccount`/`removeSubscription` mutations, which remain unchanged.
6. **And** when `nearMe: true` and `locationPreferenceId` references one of the caller's own active `UserLocationPreference` rows (Story 2.3a, ownership-checked), the ranking is re-weighted to favor accounts with more votes from users whose own saved location is geographically close to the caller's, using the same `ST_DWithin`/haversine distance technique already established for AD-1's `withinRadius` operator (Story 2.5a) — reused directly in this hand-written query, not via the Unified Query DSL, since `AccountVote` is not an event-query resource. No voter's location is ever returned or attributable to a specific account in the response — only the resulting weighted order.
7. **And** a `voteRegionBreakdown(accountId: ID!): [RegionVoteBucket!]!` query returns that account's active voters bucketed by city/province (never raw coordinates), each bucket carrying a `label` and `voterCount`; any bucket with fewer than 5 distinct voters is **omitted from the response entirely** (never returned with a suppressed/zeroed count) rather than filtered client-side, so a small bucket's near-identifiable count never leaves the backend, per NFR26. Bucketing a voter's `UserLocationPreference` into a city/province label is resolved via a new `resolveAdminRegion(coordinates): { city, province }` export added to Story 0.16's Geolocation adapter, which extracts the city/state fields already present in Geoapify's cached geocode response (`geolocation_cache.result`, Story 0.16) rather than issuing a new external API call for a location already resolved once — scoped as an AC here rather than its own story since this story is its only consumer and the change is small/additive on an already-`review`-status adapter, mirroring the size/precedent of Story 2.4b's single-AC extension of the same adapter.
8. **And** a `votedAccountSuggestions(query: String): [RankedAccountVote!]!` query returns active, not-yet-subscribed voted accounts (same exclusion rule as `rankedVoteAccounts`) matching a partial `platform`/`username`/`displayName` search, ordered by vote count — this is the query Story 6.4's subscribe-form autocomplete consumes, `requireAuth`-scoped since it's only reachable from within the authenticated subscribe flow.
9. **And** no package outside `apps/backend` writes to `account_votes` or calls `ScraperAdapter.lookupAccountProfile` directly.

## Tasks / Subtasks

- [ ] Task 1 (AC: 1): Database Migration for `account_votes`
  - [ ] Add Drizzle schema table for `account_votes` in `packages/database/src/schema.ts`
  - [ ] Generate migrations with `pnpm --filter @festgrid/database db:generate`
  - [ ] Ensure partial indexes scoped to `WHERE deleted_at IS NULL` on hot columns are properly crafted (manually edit migration if needed per AD-8 rule 3)
  - [ ] Run migrations on local database with `pnpm --filter @festgrid/database db:migrate`
- [ ] Task 2 (AC: 2, 4, 5, 7, 8): GraphQL Schema & Code Gen
  - [ ] Add GraphQL SDL types, inputs, mutations, and queries in `apps/backend/src/schema/typeDefs.ts`
  - [ ] Run codegen to generate TypeScript resolvers and types: `pnpm --filter apps/backend codegen`
- [ ] Task 3 (AC: 2, 3): Implement `castVote` Mutation Resolver
  - [ ] Add `castVote` resolver in `apps/backend/src/schema/resolvers.ts`
  - [ ] Enforce `requireAuth` on resolver
  - [ ] Implement idempotency (check if user already voted for account; reactivate soft-deleted row if previously withdrawn)
  - [ ] Support `{ platform, handleOrUrl }` lookup-or-create profile flow via amended `ScraperAdapter.lookupAccountProfile`
- [ ] Task 4 (AC: 4): Implement `withdrawVote` Mutation Resolver
  - [ ] Add `withdrawVote` resolver in `apps/backend/src/schema/resolvers.ts`
  - [ ] Enforce `requireAuth` and verify the caller's ownership of the vote row
  - [ ] Soft delete via AD-8 rule 4 shape; raise `INVALID_STATE_TRANSITION` on duplicate withdrawal
- [ ] Task 5 (AC: 5, 6, 8): Implement Queries `rankedVoteAccounts` and `votedAccountSuggestions`
  - [ ] Implement query logic in `apps/backend/src/schema/resolvers.ts`
  - [ ] Exclude accounts with active subscriptions using `activeOnly`
  - [ ] Implement `nearMe` haversine distance re-weighting when location preference is supplied and validated
  - [ ] Expose `votedAccountSuggestions` with `requireAuth` and partial keyword search on name fields
- [ ] Task 6 (AC: 7): Implement `voteRegionBreakdown` and Extend Geolocation Adapter
  - [ ] Extend Geolocation adapter in `packages/domain/src/geolocation/` with `resolveAdminRegion(coordinates)`
  - [ ] Implement `voteRegionBreakdown` resolver to group active voters by city/province and suppress groups with < 5 distinct voters (NFR26)

## Dev Notes

- Matches standard backend CRUD and AD-8 patterns
- Relies on Geoapify cached metadata for `resolveAdminRegion` without issuing fresh external API requests
- Must preserve database query performance by utilizing partial indexes

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Introduces the new `account_votes` table and corresponding GraphQL input/output shapes.
- Impacted fields/contracts: GraphQL queries `rankedVoteAccounts`, `voteRegionBreakdown`, `votedAccountSuggestions`, mutations `castVote`, `withdrawVote`.
- Required DB migration changes: Create `account_votes` table and its partial indexes.
- Required TypeScript type changes: Auto-generated by `graphql-codegen`.
- Backward compatibility and rollout notes: New table with zero impact on existing features.
- Verification checks: Compilation checks, test suite.

### Project Structure Notes

- New schemas belong in `packages/database/src/schema.ts`
- Resolver logic goes strictly inside `apps/backend/src/schema/resolvers.ts`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1a]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `packages/database/src/schema.ts`
  - `apps/backend/src/schema/typeDefs.ts`
  - `apps/backend/src/schema/resolvers.ts`
  - `packages/domain/src/geolocation/adapter.ts`
- Rule Mapping:
  - Soft-delete: AD-8
  - Autocomplete: NUQS / Zustand
  - GraphQL Security: Depth and complexity limits
- Verification Plan:
  - Integration tests verifying casting, withdrawing, and ranked listing with region privacy thresholds.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Integration tests verifying vote ranking, geographic weighting, and NFR26 region anonymity.
- [ ] Integration tests for casting/withdrawing votes (idempotency, ownership check, active subscription exclusion).

## Deliverables Checklist

- [ ] `account_votes` migration script and schema updates
- [ ] GraphQL query/mutation resolvers for votes
- [ ] Geolocation adapter extension for admin regions

## Out of Scope

- Frontend UI screens (these belong to Stories 6.1 - 6.4)
- Live scrapes or AI extraction in `lookupAccountProfile`

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro

### Debug Log References

### Completion Notes List

### File List
