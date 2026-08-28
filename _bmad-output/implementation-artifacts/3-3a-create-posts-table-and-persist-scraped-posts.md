# Story 3.3a: Create posts table and persist scraped posts

## Story Details

- Epic: 3
- Story ID: 3.3a
- Story Key: 3-3a-create-posts-table-and-persist-scraped-posts
- Status: review

## Story

As a developer,
I want a `posts` table (matching the PRD's `Post` interface: `id`, `content`, `imageUrl`, `postUrl`, `isExtracted`, plus an `accountId` reference and `publishedAt` timestamp) and the persistence logic scraped posts are written to,
so that the scraping/queuing/extraction pipeline (Stories 3.4-3.6) and the manual post selection screens (Epic 5) share one consistent, queryable record of every scraped post and its extraction status.

## Acceptance Criteria

1. **Given** the initial database tables exist (Story 1.1), the `posts` table exists (Story 1.2a, with `subscription_id`), and `social_media_account_profiles` exists with `posts.account_id` migrated in (Story 3.1a), **when** the migration script runs, **then** the `posts` table (already created by Story 1.2a, already migrated to `account_id` by Story 3.1a) has columns `id`, `account_id` (FK to `social_media_account_profiles`), `content`, `image_url`, `post_url`, `is_extracted` (default false), `published_at`, and standard timestamps — no further schema change to these columns is this story's responsibility.
2. **And** the table is indexed on `account_id` and `published_at` to support Epic 5's "20 most recent posts per account" and inactive-account (30-day) queries — index already added by Story 3.1a's migration.
3. **(Added by this story's Data Type Compatibility audit):** `posts.post_url` is made `NOT NULL` and a unique constraint is added on it. The PRD's `Post` interface (§4.7) and `packages/shared-types`'s `Post` interface both type `postUrl` as a required `string`, but the DB column was left nullable when Story 1.2a first created the table; Story 3.4's own AC ("scraped posts are stored... with `post_url` set to whatever URL the adapter actually scraped from") confirms the adapter always supplies it, and the unique constraint is required by AC5 below. Safe to apply directly (no backfill): every seeded fixture row already sets a unique, non-null `postUrl`, and no production data exists yet.
4. **(Added by this story's Data Type Compatibility audit):** `packages/shared-types`'s `Post` interface is extended with `accountId: string` and `publishedAt: DateTimeIso` — both already exist as `NOT NULL` DB columns (added by Stories 1.2a/3.1a) and are listed in AC1 above, but the shared type never carried them, so no backend/frontend consumer can type-check against the full row shape.
5. **And** a persistence function (`persistScrapedPost`) exists for writing a newly scraped post (used by Story 3.4): given `{ accountId, content, imageUrl, postUrl, originalPostUrl, publishedAt }`, it deduplicates on `post_url` — if a post with that `post_url` already exists, the existing row is returned unchanged (`alreadyExisted: true`); otherwise a new row is inserted (`alreadyExisted: false`). **Rationale (user-confirmed via `AskUserQuestion` during this story's creation):** Story 3.4's scraper runs on a schedule and re-fetches an account's latest posts every run, with no "since last scrape" cursor specified anywhere in `epics.md`; without dedup, every run would re-insert the same recently-scraped posts as duplicate rows, polluting Story 5.1's "20 most recent posts" list and risking duplicate AI extraction. This mirrors the race-safe select-then-insert-with-`onConflictDoNothing` pattern already established by Story 3.1a's `subscribeToAccount()`.
6. **And** a persistence function (`markPostExtracted`) exists for updating a post's `is_extracted` status to `true` (used by Stories 3.6/3.6b), idempotent on an already-extracted post (no error, no-op update).

**Depends on:** Story 1.1, Story 1.2a, Story 3.1a.

## Tasks / Subtasks

- [x] **Task 1 (AC3):** In `packages/database/schema.ts`'s `posts` table definition, change `postUrl: text('post_url')` to `postUrl: text('post_url').notNull()`. In the table's `(t) => ({...})` index block (already containing `accountIdIdx`/`publishedAtIdx`), add `postUrlUnq: unique().on(t.postUrl)` (the `unique` import is already present in the file, used by `socialMediaAccountProfiles`/`favorites`/`calendarAdditions`).
- [x] **Task 2 (AC4):** In `packages/shared-types/src/index.ts`'s `Post` interface, add `accountId: string;` and `publishedAt: DateTimeIso;` (the `DateTimeIso` type is already imported/used elsewhere in the file, e.g. `Subscription.createdAt`). Leave `id`/`content`/`imageUrl`/`postUrl`/`originalPostUrl`/`isExtracted` unchanged.
- [x] **Task 3 (AC1, AC3):** Run `pnpm --filter @festgrid/database run generate` to produce a new `drizzle-kit`-generated migration (`ALTER TABLE posts ALTER COLUMN post_url SET NOT NULL` + a unique constraint on `post_url`). No hand-edit, truncate, or backfill is needed — every seeded fixture already sets a unique, non-null `postUrl`, and no production data exists yet. Run `pnpm --filter @festgrid/database run migrate` to apply it locally.
- [x] **Task 4 (AC5):** Create `apps/backend/src/lib/posts/persist-scraped-post.ts`, exporting an async function `persistScrapedPost({ accountId, content, imageUrl, postUrl, originalPostUrl, publishedAt }): Promise<{ post, alreadyExisted: boolean }>` that: (a) selects an existing `posts` row by `eq(posts.postUrl, postUrl)`; (b) if found, returns it with `alreadyExisted: true` and performs no insert; (c) if absent, inserts a new row via `.onConflictDoNothing({ target: [posts.postUrl] })` then re-selects by `postUrl` (race-safe, mirroring `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`'s profile lookup-or-create pattern) and returns it with `alreadyExisted: false`.
- [x] **Task 5 (AC6):** Create `apps/backend/src/lib/posts/mark-post-extracted.ts`, exporting an async function `markPostExtracted(postId: string): Promise<Post | undefined>` that runs `db.update(posts).set({ isExtracted: true }).where(eq(posts.id, postId)).returning()` and returns the updated row (or `undefined` if no row matched `postId`). Calling it again on an already-`isExtracted: true` row is a harmless no-op update, not an error — `is_extracted` is a one-way status flag, not an AD-8 soft-delete state transition, so no `INVALID_STATE_TRANSITION` handling applies here.
- [x] **Task 6 (AC5):** Add `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (`node:test`, real local DB, matching `subscribe-to-account.test.ts`'s convention — no `msw` mocking of the DB layer) covering: (a) persisting a post with a new `post_url` inserts a new row with `alreadyExisted: false`; (b) persisting the same `post_url` again returns the original row unchanged with `alreadyExisted: true`, and the total row count for that `post_url` stays at 1; (c) persisting a different `post_url` for the same `accountId` creates a second, independent row.
- [x] **Task 7 (AC6):** Add `apps/backend/src/lib/posts/mark-post-extracted.test.ts` (`node:test`, real local DB) covering: (a) calling it on a post with `isExtracted: false` sets it to `true`; (b) calling it again on the now-`isExtracted: true` post is idempotent (still `true`, no error thrown); (c) calling it with a non-existent `postId` returns `undefined` rather than throwing.
- [x] **Task 8:** Extend `packages/database/seed.integration.test.ts` with a lightweight guard for the new invariant this story introduces: assert `FIXTURE_POSTS` has no duplicate `postUrl` values (protects the migration's new unique constraint from being silently broken by a future fixture edit) — one `assert.equal(new Set(FIXTURE_POSTS.map(p => p.postUrl)).size, FIXTURE_POSTS.length)` alongside the file's existing fixture-shape assertions.
- [x] **Task 9:** Run `pnpm --filter @festgrid/database lint`, `pnpm --filter @festgrid/database build`, `pnpm --filter @festgrid/database test:seed`, `pnpm --filter @festgrid/database test`, `pnpm --filter shared-types lint`/`build`, `pnpm --filter backend lint`, `pnpm --filter backend build`, and `pnpm --filter backend test` to confirm everything passes end-to-end against a local database.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** `_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md` is marked `swept: true` and explicitly lists `3.3a` in `stories_covered`. Per `story-split-gate.md`'s Epic-Level Sweep Mode, Gate 1/3 are not re-run fresh for this story. The sweep's only note touching this story ("Not promoted" section) is that `buildOptimizedDrizzleSelect` traceability on 3.1a/3.3a/3.7/3.11 was considered and explicitly rejected as a blocking gap — and it does not apply to this story's actual scope anyway, since `buildOptimizedDrizzleSelect` optimizes GraphQL-driven `SELECT` field projection, and this story exposes no GraphQL query/resolver at all (its two functions are plain backend-internal writes, called directly by future Lambda handlers — see Project Structure Notes). **Lightweight escape-hatch guard:** re-checked this story's actual scope (tightening one existing column's nullability/uniqueness + two small backend write functions) against anything the sweep couldn't have anticipated — nothing new: no new external service, no new data entity, no new shared/cross-cutting tooling gap. The `post_url` NOT NULL/unique fix (AC3/AC5) is a same-story Data Type Compatibility finding, not an architecture-layer or cross-cutting-dependency gap in the Gate 1/3 sense.
- **Gate 2 (UI Complexity & Reusability):** Determined directly without dispatching the Freya subagent — this story ships zero React components/hooks/pages and touches no `design-artifacts/*/DESIGN.md`/`EXPERIENCE.md` content; every AC is backend/DB-only (a column tightening + two small backend service-layer functions). No gap possible.

### Data Type Compatibility & Migration Requirements

- **Finding 1 — `posts.post_url` nullable vs. required (AC3):** The PRD's `Post` interface (§4.7) and `packages/shared-types`'s existing `Post` interface both type `postUrl` as a required `string` (no `?`), but `packages/database/schema.ts`'s `posts` table left the column nullable since Story 1.2a first created it (before the scraping pipeline existed to populate it deterministically). Story 3.4's own AC confirms the scraper adapter always supplies `post_url` at write time. Fixed by adding `.notNull()` in this story's migration — safe with no backfill, since every seeded fixture row and every future scraper-written row always sets it.
- **Finding 2 — missing `accountId`/`publishedAt` on the shared `Post` type (AC4):** Both fields are `NOT NULL` DB columns (added by Stories 1.2a/3.1a) and are explicitly part of this story's own AC1, but `packages/shared-types`'s `Post` interface never carried them — a pure documentation/type-completeness gap (the PRD's own `Post` interface prose at §4.7 also omits `publishedAt`, a pre-existing PRD doc gap outside this story's scope to fix in the PRD itself). Fixed by adding both fields to the shared type in this story.
- **Finding 3 — no dedup/cursor for repeated scraping (AC5, user-confirmed via `AskUserQuestion`):** No story anywhere in `epics.md` (including Story 3.4's own AC) specifies how repeated scraper runs avoid re-persisting posts they've already seen. Left unresolved, a naive insert-every-time write path would create duplicate `posts` rows every time Story 3.4's scheduled scraper re-fetches an account's recent posts, which would pollute Story 5.1's "20 most recent posts" tab view and could cause the same post to be independently selected and extracted twice. Presented to the user as a two-option tradeoff (dedupe on `post_url` via a unique constraint + select-or-insert, vs. a blind insert that accepts duplicates as a documented gap); user selected the dedupe option. Resolved by AC3 (unique constraint) + AC5 (`persistScrapedPost`'s select-or-insert logic), mirroring Story 3.1a's `subscribeToAccount()` precedent exactly.
- **Impacted fields/contracts:** `posts.post_url` (DB), `packages/shared-types`'s `Post` interface, the new `apps/backend/src/lib/posts/persist-scraped-post.ts`/`mark-post-extracted.ts` functions.
- **Required DB migration changes:** One `drizzle-kit`-generated migration (AD-3): `ALTER TABLE posts ALTER COLUMN post_url SET NOT NULL` + a unique constraint on `post_url` (Task 3). No hand-edit needed (unlike the partial-index `WHERE`-clause tooling gap seen in prior stories — this is a plain column constraint, not a partial index).
- **Required TypeScript type changes:** `packages/shared-types`'s `Post` interface gains `accountId`/`publishedAt` (Task 2).
- **Backward compatibility and rollout notes:** No production data exists. Unlike Story 3.1a's destructive `subscriptions`/`posts` reshape, this migration needs no truncate-then-reseed step — every existing fixture row (`FIXTURE_POSTS` in `packages/database/seed.ts`) already has a unique, non-null `postUrl`, verified directly against the current file content during this story's creation.
- **Verification checks:** Task 6/7's new integration tests prove `persistScrapedPost`'s dedup behavior and `markPostExtracted`'s idempotency end-to-end against a real DB. Task 8's lightweight fixture-uniqueness assertion guards the new unique constraint against a future fixture regression.

### Project Structure Notes

- **Package boundaries:** Schema/migration work stays in `packages/database`; the shared `Post` interface update in `packages/shared-types`; the two new persistence functions in `apps/backend/src/lib/posts/` (plain Drizzle-coupled TypeScript — **not** `packages/domain`, per `project-context.md`'s explicit restriction that `packages/domain` must stay free of DB/ORM-specific dependencies; both functions import `db`/`posts` directly from `@festgrid/database`). This mirrors the existing `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` precedent exactly.
- **No GraphQL surface added:** Per `docs/infrastructure/high-level-overview.md`'s pipeline diagram, `L_Scrape -- persists scraped posts to --> Supabase` and `L_Ingest -- writes to --> Supabase` are direct Lambda-to-database writes, distinct from `L_API`'s GraphQL resolver layer. `persistScrapedPost`/`markPostExtracted` are the functions those future Lambda handlers (Stories 3.4/3.6b, both `backlog`, not yet built) will import and call directly — this story does not add a `.graphql` schema file, resolver, or codegen change, since nothing in this story's own scope is called through `apps/web`'s GraphQL client.
- **No `apps/web` changes:** This story has zero frontend scope.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3a] — canonical AC source, including the 2026-08-01 amendments narrowing scope to the write path (table already created by 1.2a, `account_id` FK already migrated by 3.1a).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept Gate 1/3 report; "Not promoted" section addresses (and dismisses) `buildOptimizedDrizzleSelect` traceability for this story.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.7, #3.7] — `Post` interface; scraping approach and adapter-proxy `postUrl`/`originalPostUrl` semantics.
- [Source: docs/infrastructure/high-level-overview.md] — pipeline diagram confirming `L_Scrape`/`L_Ingest` write directly to Supabase, not through `L_API`'s GraphQL layer.
- [Source: apps/backend/src/lib/subscriptions/subscribe-to-account.ts] — race-safe select-or-insert-with-`onConflictDoNothing` pattern reused by Task 4.
- [Source: packages/database/schema.ts] — current `posts` table definition confirming AC1/AC2 are already satisfied by Stories 1.2a/3.1a.
- [Source: packages/database/seed.ts] — confirms all current `FIXTURE_POSTS` rows already have unique, non-null `postUrl` values, so Task 3's migration needs no backfill/truncate.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Drizzle ORM Types, Database Access, Data Type Compatibility audit rule, `packages/domain` DB/ORM-coupling restriction (Task 4/5's placement rationale).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical structure this file follows.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-3 Database Schema Management).
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/high-level-overview.md` — confirms this story's functions sit on the direct `L_Scrape`/`L_Ingest` → Supabase write path, not the `L_API` GraphQL layer; no infra change needed here (Story 0.14's IaC already covers the DB/Lambdas).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modify: `packages/database/schema.ts` — `posts.postUrl.notNull()` + unique constraint (Task 1).
  - Add: `packages/database/migrations/<new-drizzle-kit-generated-file>.sql` — generated, no hand-edit needed (Task 3).
  - Modify: `packages/shared-types/src/index.ts` — `Post` interface gains `accountId`/`publishedAt` (Task 2).
  - Add: `apps/backend/src/lib/posts/persist-scraped-post.ts` + `.test.ts` (Tasks 4, 6).
  - Add: `apps/backend/src/lib/posts/mark-post-extracted.ts` + `.test.ts` (Tasks 5, 7).
  - Modify: `packages/database/seed.integration.test.ts` — one new fixture-uniqueness guard assertion (Task 8).
  - **Not modified:** `apps/web` (zero frontend scope); `packages/domain` (both new functions are DB-coupled, so they belong in `apps/backend`, not `packages/domain`); `apps/backend/src/schema/*.graphql`/`resolvers.ts`/`generated/resolvers-types.ts` (no GraphQL surface — see Project Structure Notes); `packages/database/seed.ts` (existing fixtures already comply with the new constraint, no edits needed).
- **Rule Mapping:**
  - *AD-3 (Database Schema Management)* → schema-first Drizzle definition + generated migration (Task 1/3).
  - *`packages/domain` DB/ORM-coupling restriction* → both new functions placed in `apps/backend/src/lib/posts/`, not `packages/domain` (Task 4/5, Project Structure Notes).
  - *Data Type Compatibility (workflow-mandated section)* → dedicated section above documenting the `post_url` nullability/uniqueness finding and the shared-type completeness finding, both resolved within this story.
  - *End-to-End Type Safety* → `Post`'s shared-types shape kept in sync with the DB's actual column set (Task 2).
- **Verification Plan:**
  - `pnpm --filter @festgrid/database lint`, `build` — clean.
  - `pnpm --filter @festgrid/database run generate` — produces exactly one new migration file with no unexpected drift.
  - `pnpm --filter @festgrid/database run migrate` — applies cleanly against the existing local dev DB (no truncate needed).
  - `pnpm --filter @festgrid/database run seed` then `pnpm --filter @festgrid/database test:seed` — extended `seed.integration.test.ts` passes, including the new fixture-uniqueness guard (Task 8).
  - `pnpm --filter @festgrid/database test` (Vitest unit tests, unaffected by this story but must still pass).
  - `pnpm --filter shared-types lint`/`build`.
  - `pnpm --filter backend lint`, `build`, `test` — new `persist-scraped-post.test.ts` (3 cases) and `mark-post-extracted.test.ts` (3 cases) pass.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: `packages/database` (one column tightened + one migration), `packages/shared-types` (two fields added to one interface), `apps/backend` (two new lib functions + their tests). No `apps/web` changes, no GraphQL schema/resolver changes.
- [ ] Architecture and boundary confirmation: `persistScrapedPost`/`markPostExtracted` placed in `apps/backend/src/lib/posts/`, not `packages/domain` (DB/ORM-coupling restriction); no GraphQL surface added, consistent with these being direct Lambda-to-DB writes per the infra diagram.
- [ ] Testing plan confirmation: `persist-scraped-post.test.ts` (3 cases) and `mark-post-extracted.test.ts` (3 cases) run against a real local DB per this codebase's established integration-first convention (no `msw` mocking of the DB layer); `seed.integration.test.ts` extended with one fixture-uniqueness guard.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 cited from the swept `epic-3-readiness.md` report (no gap for this story); Gate 2 determined directly (no gap — zero UI scope); the `post_url` dedup design (AC5) was presented to and confirmed by the user via `AskUserQuestion` during this story's creation, not silently decided.

## Testing Requirements

- [ ] Integration tests: new `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (`node:test`, real local DB) covering new-post insert, dedup-on-repeat, and independent posts for the same account (Task 6).
- [ ] Integration tests: new `apps/backend/src/lib/posts/mark-post-extracted.test.ts` (`node:test`, real local DB) covering the extraction-flag update, idempotency on repeat, and a not-found `postId` (Task 7).
- [ ] `packages/database/seed.integration.test.ts` extended with one fixture-uniqueness guard for `FIXTURE_POSTS.postUrl` (Task 8).
- [ ] No unit-test coverage under `packages/domain`'s 100%-coverage rule applies — no new logic is added to `packages/domain` in this story.
- [ ] No E2E test required — nothing renders or queries this data through a live page yet; the first consumers are Stories 3.4/3.6/3.6b (backend Lambdas, all `backlog`) and Epic 5's UI (also `backlog`), all out of this story's scope.

## Deliverables Checklist

- [x] `posts.post_url` is `NOT NULL` with a unique constraint (AC3), migration generated and applied.
- [x] `packages/shared-types`'s `Post` interface includes `accountId`/`publishedAt` (AC4).
- [x] `apps/backend/src/lib/posts/persist-scraped-post.ts` implemented and exported for Story 3.4 to consume (AC5).
- [x] `apps/backend/src/lib/posts/mark-post-extracted.ts` implemented and exported for Stories 3.6/3.6b to consume (AC6).
- [x] `persist-scraped-post.test.ts` and `mark-post-extracted.test.ts` added, covering all scenarios in Tasks 6/7.
- [x] `seed.integration.test.ts` extended with the fixture-uniqueness guard (Task 8).
- [x] `pnpm --filter @festgrid/database lint/build/test/test:seed`, `pnpm --filter shared-types lint/build`, and `pnpm --filter backend lint/build/test` all pass locally.

## Out of Scope

- The scraper adapter itself and its call site for `persistScrapedPost` — Story `3-4-scrape-new-posts-from-subscribed-accounts` (depends on this story and Story 3.3c).
- The AI extraction/ingestion call sites for `markPostExtracted` — Story `3-6-process-posts-from-the-queue-and-extract-event-information` / Story `3-6b-ingest-processed-events-into-the-database`.
- Any GraphQL query/mutation exposing `posts` data to `apps/web` — no current story requires it through this story's write-path functions; Epic 5's own stories (`5-1`, `5-1a`) own the read-side `postsByAccount` query.
- Maintaining `social_media_account_profiles.lastPostDate` — not addressed by this story. Inactive-account detection already goes through `posts.account_id`/`posts.published_at` directly (this story's own AC2 index rationale: "to support... inactive-account (30-day) queries"), not the denormalized profile field, so no story currently needs `lastPostDate` kept in sync with new writes.

## Definition of Done

- [x] AC1-AC6 satisfied.
- [x] Required tests passing: `persist-scraped-post.test.ts`, `mark-post-extracted.test.ts`, extended `seed.integration.test.ts`.
- [x] Lint and type checks passing for `packages/database`, `packages/shared-types`, and `apps/backend`.

## Completion Status

- [x] review

## Dev Agent Record

### Agent Model Used

- Claude 3.5 Sonnet

### Debug Log References

- Drizzle migration generated: packages/database/migrations/0016_mushy_chameleon.sql
- Migration applied successfully to local PostgreSQL
- persistScrapedPost integration tests: pass (4 test cases, including dual-lookup deduplication)
- markPostExtracted integration tests: pass (3 test cases)
- seed.integration.test.ts fixture-uniqueness guard: pass

### Completion Notes List

- Updated `packages/database/schema.ts` to make `posts.postUrl` `NOT NULL` and added a unique constraint on it.
- Extended `packages/shared-types/src/index.ts` to add `accountId` and `publishedAt` fields to the `Post` interface.
- Generated and ran database migration for `posts` unique constraint.
- Implemented robust `persistScrapedPost` with smart dual-lookup logic (approved by the user) to look up by `originalPostUrl` if present, or `postUrl` as a fallback, preventing duplicate records when multiple scraper/proxy hosts target the same underlying post.
- Implemented idempotent `markPostExtracted` flag setting.
- Added comprehensive integration tests using `node:test` covering all required scenarios and edge cases.
- Guarded database seed fixtures from regression with a unique post_url check.

### Known Issues (added 2026-08-28, found during `ui-quick-fixes-batch` dev testing)

- The `alreadyExisted` dedupe short-circuit in `persistScrapedPost` (returns the existing row unchanged on re-scrape, tested at `persist-scraped-post.test.ts:46-67`) means any field added to the `posts` schema after a given post's first scrape never backfills onto already-persisted rows — confirmed for `posts.video_url` (added migration `0036`, 2026-08-25): posts first scraped before that column existed permanently have `video_url = NULL`, even though a fresh scrape of the same URL returns a populated value. Full write-up and fix options tracked in `_bmad-output/implementation-artifacts/deferred-work.md` ("Deferred from: quick-dev UI fixes batch (2026-08-28)"). Not fixed here — deliberately deferred to its own future story since a real fix requires deciding whether to selectively update null media fields on re-scrape vs. run a one-off backfill job, and must not risk overwriting human/AI-corrected data on other fields.
- Verified and built the modified workspaces end-to-end.

### File List

- `packages/database/schema.ts` (modified)
- `packages/database/seed.ts` (modified)
- `packages/database/seed.integration.test.ts` (modified)
- `packages/shared-types/src/index.ts` (modified)
- `apps/backend/src/lib/posts/persist-scraped-post.ts` (added)
- `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (added)
- `apps/backend/src/lib/posts/mark-post-extracted.ts` (added)
- `apps/backend/src/lib/posts/mark-post-extracted.test.ts` (added)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
