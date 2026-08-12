# Story 6.6a: Build the embed-domain backend GraphQL API layer

## Story Details

- Epic: 6
- Story ID: 6.6a
- Status: review
- baseline_commit: 6aa4195

## Story

As a developer,
I want an `embed_domains` table, scoped per-widget rather than per-owner, plus GraphQL mutations to register/deregister a domain pattern (validated against a Public Suffix List) and a public query to check whether a given widget may be embedded from a given origin,
So that Story 6.6's domain-management screen and Story 6.7a's widget CSP middleware both read/write embed-domain data through the backend API instead of the frontend (or Next.js Middleware) touching the database directly, and each widget carries independent embedding restrictions rather than sharing one whitelist across everything an owner creates.

## Acceptance Criteria

1. **Given** Story 6.5a's `widgets` table exists, **when** the migration script runs, **then** an `embed_domains` table (PRD §4.17) is created: `id` (uuid pk), `widget_id` (FK to `widgets`), `pattern` (text, not null), `created_at`, `deleted_at` (nullable, AD-8) — no `owner_user_id` column; ownership for management purposes flows through `widgets.owner_user_id` via the `widget_id` FK, matching PRD §4.17.
2. **And** a `registerEmbedDomain(widgetId: ID!, pattern: String!): EmbedDomain!` mutation is exposed, scoped to `context.user` via `requireAuth` — ownership of `widgetId` is verified against `context.user` before any write. `pattern` must be either an exact hostname or a wildcard of the exact shape `*.<hostname>` (rejected otherwise); both forms are normalized (lowercased, scheme/path/trailing-slash stripped) server-side before storage. When `pattern` is a wildcard, its suffix (everything after `*.`) is checked against a Public Suffix List (the `tldts` package — actively maintained, ships PSL data, no external API call per check) and the mutation throws a `GraphQLError` (`BAD_REQUEST`, with a message naming the offending suffix) if the suffix is itself a public suffix or one level above it (e.g. rejects `*.vercel.app`, `*.github.io`, `*.co.uk`) — this is the check that prevents whitelisting every unrelated tenant on a shared-hosting platform. Exact-hostname patterns (including `localhost:<port>` style dev entries) are never subject to the PSL check, since they don't expand to cover anything beyond themselves.
3. **And** a `deregisterEmbedDomain(id: ID!, action: SoftDeleteAction!): EmbedDomain!` mutation (AD-8 rule 4 shape) soft-deletes a pattern belonging to a widget the caller owns — ownership verified against `context.user` via the pattern's `widget_id`, never a client-supplied user ID — with the same `INVALID_STATE_TRANSITION` handling as `removeSubscription`/`deleteApiKey` for an already-deregistered pattern.
4. **And** an `embedDomainsForWidget(widgetId: ID!)` query returns a caller-owned widget's active (`activeOnly(table)`, Story 0.22) registered patterns for Story 6.6's management screen — ownership-scoped, not a global list.
5. **And** a **public, unauthenticated** `isOriginAllowedForWidget(widgetId: ID!, origin: String!): Boolean!` query normalizes `origin` to a bare hostname the same way `registerEmbedDomain` does, then returns whether that hostname matches any of the given widget's active patterns — an exact match against an exact-hostname pattern, or a suffix match (`origin` ends with the pattern's hostname, on a label boundary — i.e. `sub.acmecorp.com` matches `*.acmecorp.com` but `evilacmecorp.com` does not) against a wildcard pattern. This is the sole read Story 6.7a's widget CSP middleware calls; it never returns which patterns are registered or who registered them, only a boolean, since it is reachable by any unauthenticated request.
6. **And** `isOriginAllowedForWidget` carries negligible additional query-cost risk under the project-wide GraphQL depth/complexity limits (Story 0.8) despite being public, since it takes no nested selection.
7. **And** no package outside `apps/backend` writes to `embed_domains`, imports the PSL library, or reads this data to make a framing/security decision — Story 6.7a's middleware reaches it exclusively through `isOriginAllowedForWidget`, never a direct database query from `apps/web`.

## Tasks / Subtasks

- [x] Task 1 (AC: 1): Database Migration for `embed_domains` table
  - [x] Define `embed_domains` table in `packages/database/schema.ts` referencing `widgets.id` and with a unique pattern constraint, timestamps, and deleted_at soft delete column
  - [x] Generate migrations with `pnpm --filter @festgrid/database db:generate` and edit index file where `deleted_at IS NULL`
  - [x] Run migration on local database
- [x] Task 2 (AC: 2, 3, 4, 5): GraphQL SDL Schema & Resolvers
  - [x] Create `embed-domains.graphql` in `apps/backend/src/schema/` declaring EmbedDomain types, mutations, and queries
  - [x] Run GraphQL codegen to sync backend types
  - [x] Implement query `embedDomainsForWidget`, query `isOriginAllowedForWidget`, mutations `registerEmbedDomain`, `deregisterEmbedDomain` in `resolvers.ts`
- [x] Task 3 (AC: 2): Integrate Public Suffix List (PSL) Validation
  - [x] Use `tldts` package inside `registerEmbedDomain` mutation resolver for wildcard suffix checks
  - [x] Implement wildcard extraction, normalization, and shared hosting validation, returning BAD_REQUEST for public suffixes like `*.vercel.app`

## Dev Notes

- Matches standard backend CRUD and AD-8 soft delete patterns
- Integrates the `tldts` package on the backend for Public Suffix List validation

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `Widget` and `EmbedDomain` schema relations safely.
- Required DB migration changes: Create `embed_domains` table and active index constraints.
- Required TypeScript type changes: Auto-generated by `graphql-codegen`.

### Project Structure Notes

- Drizzle schema: `packages/database/schema.ts`
- Resolvers: `apps/backend/src/schema/resolvers.ts`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6a]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `packages/database/schema.ts`
  - `apps/backend/src/schema/embed-domains.graphql` (new)
  - `apps/backend/src/schema/resolvers.ts`
- Rule Mapping:
  - Soft delete: AD-8
  - Validation: `tldts` (PSL)
- Verification Plan:
  - Integration tests verifying exact-hostname and wildcard matching, PSL rejection, and soft delete.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [x] Integration tests verifying `registerEmbedDomain` normalization and PSL constraints.
- [x] Integration tests verifying `isOriginAllowedForWidget` exact and suffix matching.

## Deliverables Checklist

- [x] `embed_domains` migration script and schema updates
- [x] GraphQL query/mutation resolvers for widget origin access control

## Out of Scope

- Next.js dynamic CSP middleware integrations (this belongs to Story 6.7a)

## Definition of Done

- [x] AC satisfaction
- [x] Required tests passing
- [x] Lint and type checks passing for touched packages

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro

### Debug Log References

### Completion Notes List

### File List
