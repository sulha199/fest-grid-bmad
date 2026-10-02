# Story 3.15: Post-account association table + lossless migration

## Story Details

- Epic: 3
- Story ID: 3.15
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want a new `post_account_associations` table recording one row per (post, account) pair with an explicit role (`PUBLISHER`, `COAUTHOR`, `SCRAPING_SOURCE`, `PUBLISHER_UNKNOWN`) and provenance (PRD §4.7a), while `posts.accountId` stays unchanged for backward compatibility,
so that a post's full set of verified identities is queryable for filtering (Story 3.18), moderation, and analytics — not collapsed into one column — without rewriting or reinterpreting any existing post's historical ownership (FIND-022, CAP-3).

## Acceptance Criteria

1. **Given** the `posts` table (Story 3.3a) and Story 3.14's deduplicated profiles, **when** the migration runs over existing production posts, **then** it adds exactly one `PUBLISHER_UNKNOWN`-role association per existing row, derived only from `posts.accountId` (and `posts.scraperActorRunId` for provenance) — zero data loss, no ownership rewritten or guessed from unavailable vendor evidence. (Role choice resolved below — see Dev Notes "Design Decisions".)
2. **And** a newly ingested post (post-migration) always gets exactly one `SCRAPING_SOURCE` association (the account the scrape ran under — always knowable, every vendor), **plus**, only when the vendor owner identity is present (Story 3.13/3.14's normalized `ownerId`/`coauthors`), exactly one `PUBLISHER` association and N `COAUTHOR` associations — all independently queryable by role. A `SCRAPING_SOURCE` row and a `PUBLISHER` row may name the same account (two rows, two roles) or different accounts (the repost/collab case FIND-022 exists to capture).
3. **And** `posts.accountId` continues to be populated for new posts, but only from the verified canonical publisher after role normalization — never from producer-array order (unchanged behavior, now explicit). **Resolved spec-literally (decided by the user, not re-asked):** for a NEW post, `posts.accountId` is set to the resolved canonical **publisher** profile id (via `getOrCreateDiscoveredAccountProfile`, Story 3.14) when the vendor owner identity (`ownerId`) is present; it falls back to today's scraping-account value (the caller-supplied `accountId`) when `ownerId` is absent, or when publisher resolution itself fails. See "Accepted interim regression" below.
4. **And** writing associations for a re-ingested post (matching `persistScrapedPost`'s existing dedupe-by-`postUrl` behavior) is idempotent — re-processing never appends duplicate role rows for the same (post, account, role), and never errors when a cross-account conflict on a per-post role slot (e.g. a second, different `SCRAPING_SOURCE` account on the same post) is silently rejected rather than replacing the first row.
5. **And** association rows remain queryable independent of Story 3.18's filtering path, supporting moderation/analytics use (no coupling to any filter/query building this story does not itself build).

## Tasks / Subtasks

- [ ] **Task 1 — Schema: `post_account_associations` table + role enum + migration (AC: 1, 4, 5)**
  - [ ] 1.1 Add the closed role vocabulary to `packages/domain/src/posts/types.ts` (declared once, per AD-31 Rule 2): `export const POST_ACCOUNT_ROLES = ['PUBLISHER', 'COAUTHOR', 'SCRAPING_SOURCE', 'PUBLISHER_UNKNOWN'] as const;` and `export type PostAccountRole = typeof POST_ACCOUNT_ROLES[number];`. Already re-exported via `packages/domain/src/posts/index.ts`'s existing `export * from "./types.js"` — no change needed there.
  - [ ] 1.2 In `packages/database/schema.ts`: import `POST_ACCOUNT_ROLES` from `@festgrid/domain/posts` (a runtime import — `@festgrid/database` already depends on `@festgrid/domain`, same cross-package direction as the existing `@festgrid/domain/events` type import at the top of the file). Add `export const postAccountRoleEnum = pgEnum('post_account_role', POST_ACCOUNT_ROLES);` near the other scraper-related enums (~line 81-90). Add the `postAccountAssociations` table **after** `scraperActorRuns` and **before** `events` (it FK-references both `posts` and `scraperActorRuns`, both already defined above that point) — exact shape per AD-25's full resolved DDL (already settled, not a decision for this story):
    ```ts
    export const postAccountAssociations = pgTable('post_account_associations', {
      id: uuid('id').defaultRandom().primaryKey(),
      postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
      accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
      role: postAccountRoleEnum('role').notNull(),
      scraperActorRunId: uuid('scraper_actor_run_id').references(() => scraperActorRuns.id),
      ...timestamps,
    }, (t) => ({
      postAccountRoleUnq: unique().on(t.postId, t.accountId, t.role),
      // Partial unique indexes -- drizzle-kit 0.21.4 drops the WHERE predicate from generated
      // migration SQL (same gap as schedules.oneMainPerEventIdx / AD-8 rule 3). These builder
      // calls document intent only; Task 1.3 hand-adds the real DDL.
      onePublisherPerPostIdx: uniqueIndex('idx_post_account_associations_one_publisher_per_post')
        .on(t.postId)
        .where(sql`role IN ('PUBLISHER', 'PUBLISHER_UNKNOWN')`),
      oneScrapingSourcePerPostIdx: uniqueIndex('idx_post_account_associations_one_scraping_source_per_post')
        .on(t.postId)
        .where(sql`role = 'SCRAPING_SOURCE'`),
      accountIdPostIdIdx: index('idx_post_account_associations_account_id_post_id').on(t.accountId, t.postId),
    }));
    ```
    `accountId` FK carries no `onDelete` override (matches `posts.accountId`/`subscriptions.accountId` — profiles are never deleted). No `relations()` helper is required by any AC in this story (see Out of Scope).
  - [ ] 1.3 Run `pnpm --filter @festgrid/domain build` (so `@festgrid/database` resolves the new export), then `pnpm --filter @festgrid/database generate`. The next sequential migration file is expected to be `0064_<generated-name>.sql` (confirm via `ls packages/database/migrations | tail -1` before running, in case ordering with Story 3.6r's migration shifted — AD-31 Rule 5 says either order is fine since there's no FK between the two new tables). **Hand-edit the generated file** (do not trust `drizzle-kit generate`'s output as-is — same class of gap as migrations `0057`/`0063`'s precedent):
    - Add `WHERE` predicates to the two partial unique indexes (dropped by drizzle-kit), matching migration `0057`'s exact style:
      ```sql
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_post_account_associations_one_publisher_per_post" ON "post_account_associations" ("post_id") WHERE "role" IN ('PUBLISHER', 'PUBLISHER_UNKNOWN');
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_post_account_associations_one_scraping_source_per_post" ON "post_account_associations" ("post_id") WHERE "role" = 'SCRAPING_SOURCE';
      ```
    - Append the AC1 backfill (one `PUBLISHER_UNKNOWN` row per existing post, carrying over `scraper_actor_run_id` for provenance — matching migration `0046`'s documented-backfill style, with a comment explaining the role choice, citing PRD §4.7a):
      ```sql
      -- Story 3.15 AC1 (FIND-022 CAP-3): one PUBLISHER_UNKNOWN association per pre-existing post,
      -- derived only from posts.account_id -- zero data loss, no ownership guessed. PUBLISHER_UNKNOWN
      -- (not SCRAPING_SOURCE) per PRD Section 4.7a's PostAccountAssociation doc comment, which
      -- explicitly names PUBLISHER_UNKNOWN as "for pre-migration/legacy rows, Story 3.15" -- this
      -- preserves continuity with the pre-FIND-022 mental model (accountId == the post's author)
      -- while being honest the identity was never verified via role normalization (3.13/3.14 ran
      -- only on posts ingested after this migration). AD-31 Rule 3's organizer-authored predicate
      -- does not even read this role for legacy posts -- it falls back to posts.accountId directly
      -- -- so this choice affects only the association table's own queryability (AC5), not AC1's
      -- "zero data loss" guarantee either way. No SCRAPING_SOURCE row is written for legacy posts;
      -- AC1 deliberately fills exactly one of the two per-post slots, leaving the other empty
      -- (expected, not a constraint violation -- see this story's architecture note in epics.md).
      INSERT INTO "post_account_associations" ("post_id", "account_id", "role", "scraper_actor_run_id")
      SELECT "id", "account_id", 'PUBLISHER_UNKNOWN', "scraper_actor_run_id" FROM "posts"
      ON CONFLICT DO NOTHING;
      ```
  - [ ] 1.4 Run `pnpm --filter @festgrid/database migrate` against the local dev DB. Verify via `psql`: the enum and table exist with the two partial indexes (`\d post_account_associations`), and `SELECT count(*) FROM post_account_associations WHERE role = 'PUBLISHER_UNKNOWN'` equals `SELECT count(*) FROM posts` (every existing post backfilled exactly once).

- [ ] **Task 2 — New backend association writer (AC: 2, 4)**
  - [ ] 2.1 Create `apps/backend/src/lib/posts/persist-post-account-associations.ts` exporting `persistPostAccountAssociations({ postId, scrapingAccountId, publisherAccountId?, coauthorAccountIds?, scraperActorRunId? })`. For each of up to `2 + coauthorAccountIds.length` candidate rows (one `SCRAPING_SOURCE` for `scrapingAccountId` always; one `PUBLISHER` for `publisherAccountId` only if given; one `COAUTHOR` per `coauthorAccountIds` entry), insert independently via `db.insert(postAccountAssociations).values({ postId, accountId, role, scraperActorRunId }).onConflictDoNothing()` — **bare, with no `target`**. This is a required, non-obvious detail: a `target`-scoped `onConflictDoNothing({ target: [...] })` only suppresses a conflict on that one named constraint; a bare call suppresses a conflict on *any* unique/exclusion constraint on the table, which is what's needed here since a cross-account `SCRAPING_SOURCE`/`PUBLISHER` write (AC4's "silently rejected" case) violates one of the two **partial** unique indexes (Task 1.2), not the 3-column `(post_id, account_id, role)` unique. Wrap each individual insert in its own `try`/`catch` (log, don't rethrow) as a second layer of safety and to match Story 3.14's established per-identity resilience pattern (`processDiscoveredIdentities`) — so one row's unexpected failure never blocks the others or the caller.
  - [ ] 2.2 No transaction wrapping — matches this file's and `persist-scraped-post.ts`'s existing non-transactional, idempotent-by-constraint style (no other write in this pipeline uses an explicit DB transaction).

- [ ] **Task 3 — Restructure `persist-scraped-post.ts`: resolve the publisher profile before the accountId decision, write associations on both branches (AC: 2, 3, 4)**
  - [ ] 3.1 Move identity resolution (today's `processDiscoveredIdentities`, added by Story 3.14) so it runs **once, before** the existing-post-vs-new-post branch decision, not after (today it runs after, inside each branch). It must now **return** its resolved ids instead of just firing side-effect writes: `{ publisherProfileId?: string; coauthorProfileIds: string[] }`. Internals are unchanged otherwise — still a no-op when neither `ownerId` nor `coauthors` is present, still guards missing `discoverySourceVendor`, still calls `getOrCreateDiscoveredAccountProfile` once for the publisher (if `ownerId` present) and once per coauthor, still wraps each call in its own `try`/`catch` (on failure, that identity's id is simply omitted from the returned result — this is what makes AC3's "or when publisher resolution itself fails" fallback work with zero extra branching).
  - [ ] 3.2 **New-post branch only:** when building `insertValues`, set `accountId: publisherProfileId ?? accountId` (the destructured parameter, i.e. today's scraping-account value) — this is AC3. Keep the original parameter's value in a distinctly-named local (e.g. the existing `accountId` destructure already serves this; do not mutate it) since it is still needed afterward as the `SCRAPING_SOURCE` association target regardless of what wins for the column.
  - [ ] 3.3 **Already-existed branch:** do **not** touch `post.accountId` (unchanged — matches AC3's "for new posts" framing and the existing `backfillPatch` mechanism's scope, which already never touches `accountId`). The resolved `publisherProfileId`/`coauthorProfileIds` from 3.1 are still used in 3.4 below, for the association table only.
  - [ ] 3.4 **Both branches**, once `post.id` is known (after the existing-post lookup or after the new-row re-select): call `persistPostAccountAssociations({ postId: post.id, scrapingAccountId: accountId, publisherAccountId: publisherProfileId, coauthorAccountIds: coauthorProfileIds, scraperActorRunId })`. This replaces the two existing (per-branch) calls to the old `processDiscoveredIdentities` — the identity *resolution* step moved earlier per 3.1, but the *write* step (association rows) still happens per-branch, in the same two call sites the old `processDiscoveredIdentities` calls occupied today.
  - [ ] 3.5 No change to `PersistScrapedPostParams`'s shape and no change to any of its three Apify call sites or the Bright Data call site — Story 3.14 already threads everything this story needs (`ownerId`, `coauthors`, `discoverySourceVendor`, `accountId`, `scraperActorRunId`) through every existing call. Confirm this by inspection before marking Task 3 done: no file outside `persist-scraped-post.ts` (plus the Task 1/2 files) should need editing.

- [ ] **Task 4 — Tests (AC: 1, 2, 3, 4, 5)**
  - [ ] 4.1 New `apps/backend/src/lib/posts/persist-post-account-associations.test.ts` (`node:test`, real local Postgres, matching this directory's existing convention — no DB mocking). Cases:
    - (a) writes exactly one `SCRAPING_SOURCE` row when only `scrapingAccountId` is given.
    - (b) writes `SCRAPING_SOURCE` + `PUBLISHER` as two separate rows for the **same** account (the "may equal the publisher" case — confirms the base 3-column unique constraint, not the per-post partial indexes, is what's keyed on role).
    - (c) writes `SCRAPING_SOURCE` + `PUBLISHER` (different accounts) + N `COAUTHOR` rows, all independently `SELECT`-able by role.
    - (d) calling twice with identical inputs is idempotent — second call inserts zero additional rows and does not throw (AC4).
    - (e) a second call with a **different** `scrapingAccountId` for the same `postId` does not throw, does not replace the first `SCRAPING_SOURCE` row, and the table still has exactly one `SCRAPING_SOURCE` row for that post (AC4's cross-account-conflict case — the partial-unique-index scenario Task 2.1's bare `onConflictDoNothing()` exists for).
    - (f) same as (e) but for a conflicting `publisherAccountId`.
  - [ ] 4.2 Extend `apps/backend/src/lib/posts/persist-scraped-post.test.ts` with new lettered cases (continuing from `(t)`, Story 3.14's last):
    - (u) a new post with `ownerId` present (differing from the caller's `accountId`) resolves `post.accountId` to the publisher's profile id, not the scraping `accountId` (AC3).
    - (v) a new post **without** `ownerId` falls back to the caller's `accountId` for `post.accountId` — explicit regression guard for today's unmodified behavior (AC3 fallback, the Bright Data case).
    - (w) a new post with `ownerId` + `coauthors` results in `SCRAPING_SOURCE` + `PUBLISHER` + N `COAUTHOR` rows in `post_account_associations`, independently queryable (AC2/AC5).
    - (x) if the publisher's `getOrCreateDiscoveredAccountProfile` call throws (simulate via the same seam/mocking style already used elsewhere in this test file, or a deliberately invalid input), `persistScrapedPost` still succeeds and falls back to the caller's `accountId` for `post.accountId` — does not reject the whole call (AC3's "or when publisher resolution itself fails" clause).
    - (y) re-persisting an existing `postUrl` (dedupe branch) with `ownerId` now present does **not** change the already-set `post.accountId`, but still writes/updates association rows idempotently (AC3 "already-existed" scope + AC4).
  - [ ] 4.3 Run `pnpm --filter @festgrid/domain build`, `pnpm --filter @festgrid/database generate`/`migrate`, then the new/extended test files (`TZ=UTC NODE_ENV=test npx tsx --test --test-concurrency=1 "src/lib/posts/persist-post-account-associations.test.ts" "src/lib/posts/persist-scraped-post.test.ts"`), then `pnpm --filter domain build`, `pnpm --filter backend build` (tsc), and lint on all touched files. Full `apps/backend` suite and repo-wide `pnpm test` deferred to the CC-024 batch-end gate, per this wave's established precedent (3.13/3.14).

## Dev Notes

- **This story's entire write surface is `persist-scraped-post.ts` and one new sibling file.** No call site (`process-scrape-job.ts`, `process-apify-async-result.ts`, `replay-actor-run.ts`, `process-brightdata-result.ts`) needs editing — Story 3.14 already threads `ownerId`/`coauthors`/`discoverySourceVendor` through every Apify call, and Bright Data's call simply omits them (unchanged). Resist the temptation to touch those files; nothing in this story's ACs requires it, and touching them risks reopening already-reviewed Story 3.13/3.14 surface.
- **Why identity resolution must move earlier (before the branch split), unlike Story 3.14's placement.** Story 3.14's `processDiscoveredIdentities` ran *after* the post was already resolved (existing or newly inserted), because it only needed to fire side-effect writes (`lastSeen` advancement, etc.) — nothing about its result fed back into that same call's own logic. Story 3.15 changes that: AC3 requires the *new-post* branch to decide `insertValues.accountId` using the **resolved publisher profile id**, which must exist before the `INSERT` runs (it is the FK target). So resolution must happen first; only the *write* of association rows can still happen after, per-branch, as before.
- **Why every post always gets a `SCRAPING_SOURCE` row, even though AC2's epics.md text only names `PUBLISHER`/`COAUTHOR` for new posts.** PRD §4.7a's `PostAccountAssociation` doc comment is explicit: "exactly one `PUBLISHER` (or `PUBLISHER_UNKNOWN`...) association, **and exactly one `SCRAPING_SOURCE` association** (may equal the publisher)." AD-25's own rationale for allowing the same account to hold two rows ("may equal the publisher") only makes sense if a `SCRAPING_SOURCE` row is in fact always written going forward — it is always a knowable, verified fact (the account whose subscription triggered the scrape), unlike `PUBLISHER`/`COAUTHOR`, which require vendor-supplied identity data that Bright Data (3.13's explicit exclusion) never provides. This is why Bright Data posts still get exactly one association row (`SCRAPING_SOURCE`) post-migration, keeping them queryable by Story 3.18's union filter even though no coauthor normalization ever runs for them.
- **`PUBLISHER_UNKNOWN` was a pre-decided open question, resolved by citation, not by asking the user.** `epics.md`'s own architecture note explicitly deferred "which single role value the migration backfill should use" to this story ("a data-migration implementation choice... not a DDL question"). This is a genuine, non-mechanical choice (`SCRAPING_SOURCE` would also have satisfied every AC and DDL constraint). It is resolved here by a specific, unambiguous textual source rather than a judgment call: PRD §4.7a's `PostAccountAssociation` interface doc comment names `PUBLISHER_UNKNOWN` explicitly as "for pre-migration/legacy rows, Story 3.15" — i.e. the PRD, written with this story in mind, already picked the answer. See the migration's own inline comment (Task 1.3) for the full reasoning trail.
- **Read in full before finalizing this design:** `apps/backend/src/lib/posts/persist-scraped-post.ts` (current state, post-3.14), `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts` (confirmed: atomic `onConflictDoUpdate`, always returns a fully-committed row with `.id` — no race window before this story's code reads that id as an FK target), `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (current cases (a)-(t)), `apps/backend/src/lib/scraper/process-scrape-job.ts` / `process-apify-async-result.ts` / `replay-actor-run.ts` / `process-brightdata-result.ts` (confirmed: none need edits — all already pass everything this story needs, or correctly pass nothing for Bright Data), `packages/database/schema.ts`'s full `posts`/`scraperActorRuns`/`socialMediaAccountProfiles` definitions and the `schedules.oneMainPerEventIdx` partial-index precedent, migrations `0046` (data-backfill precedent), `0057` (partial-unique-index hand-edit precedent), `0032` (enum+FK table-creation precedent), `0063` (most recent migration, confirms next number).

### Design Decisions

Two decisions were already made before this story was drafted and are recorded here per this project's standing rule, rather than re-litigated:

1. **AC3's `posts.accountId` resolution — decided by the user (prior session), not re-asked.** Implemented spec-literally: for NEW posts, `posts.accountId` is set to the resolved canonical **publisher** profile id (via `getOrCreateDiscoveredAccountProfile`) when the vendor owner identity is present, falling back to today's scraping-account value when it is not.
   - **Accepted interim regression (recorded per the user's explicit instruction):** once this story ships, a post where the publisher differs from the scraping/subscribed account (a repost or native collab) will have `posts.accountId` pointing at the *publisher*, not the *scraping-source* account. Until Story 3.18 switches the subscribed-feed account filter from reading `posts.accountId` directly to reading the `post_account_associations` union (any of the four roles), that post will **drop out of the scraping-source account's own subscribed-feed filter** — a user subscribed only to the scraping-source account (and not to the publisher) will stop seeing that repost/collab in their filtered feed, even though it still appears unfiltered. This regression is bounded (affects only account-filtered views of posts with `publisher != scraping-source account`, which is exactly the FIND-022 minority case) and user-accepted; Story 3.18 is the designed fix and already depends on this story.
2. **Legacy migration backfill role — resolved by citation (PRD §4.7a), not a fresh question.** See Dev Notes above.

No other real, non-mechanical tradeoff was found during this story's drafting — the restructuring in Task 3 (moving identity resolution earlier) is a mechanical consequence of AC3's ordering requirement, not a design choice with competing valid answers.

### Architecture & UX Gate Findings

- **Gates 1 and 3 — cited from the batch readiness sweep, not re-run.** `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` includes `3.15`) already evaluated this exact story. Its per-story verdict table: "**3.15 (post-account association table + lossless migration) | READY** | AD-25/AD-31 fully resolve DDL and role semantics; 'blocked' status note is confirmed stale (now `backlog`, matches)." It also independently re-verified "Migration ordering 3.6r vs 3.15" as already resolved (AD-31 Rule 5, independent tables, either order fine) — no gap, no action needed.
  - **Lightweight guard — does this story's actual scope contain anything the sweep plausibly didn't anticipate?** No. The new table, its DDL, and the role vocabulary were all explicitly named and evaluated in the sweep (which quotes AD-25/AD-31 directly for this story). No new external service, no data entity beyond the one the sweep already reviewed, no new infra dependency (no new queue, Lambda, or compute resource — a DB migration and a backend library function only).
- **Gate 2 — run fresh (per-story, as required even when Gates 1/3 are cited).** Dispatched to a one-shot UX-persona analytical pass against this story's exact scope (new DB table/migration, one new `apps/backend/src/lib/posts/` function, a `packages/domain` type addition, and a restructure inside an existing backend pipeline file). **Verdict: No gap found.** Zero React/JSX/TSX, zero `apps/web` or `packages/ui` file anywhere in scope — a pure backend data-pipeline/database-migration story, same category as Stories 3.13/3.14 which Gate 2 already found "no gap" for. The UX spec's only touchpoint for this data (`EXPERIENCE.md`'s coauthor-attribution UI) is explicitly owned by Story 0.i6g, not this story, and its own design-sync log records no `DESIGN.md` changes needed for any of the 3.13-3.19 slice.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A genuine new DB migration is required — the second in this coauthor-attribution slice (3.14 added four columns; 3.13 needed none). This is the first migration in the slice that creates a **new table** (`post_account_associations`) and a **new enum** (`post_account_role`), not just additive columns.
- **Impacted fields/contracts:** `packages/domain/src/posts/types.ts` (new `PostAccountRole` type + `POST_ACCOUNT_ROLES` const array — a plain literal array, not executable logic with branches, so the `packages/domain` 100%-branch-coverage rule does not apply to it); `packages/database/schema.ts` (new `postAccountRoleEnum`, new `postAccountAssociations` table); a new `PersistPostAccountAssociationsParams`-shaped interface local to the new `persist-post-account-associations.ts` file. `PersistScrapedPostParams` itself is **unchanged** — no new fields needed (see Dev Notes).
- **Required DB migration changes:** `CREATE TYPE post_account_role AS ENUM('PUBLISHER','COAUTHOR','SCRAPING_SOURCE','PUBLISHER_UNKNOWN')`; `CREATE TABLE post_account_associations` with the five columns + two timestamps per AD-25's full resolved shape (Task 1.2); hand-added `UNIQUE(post_id, account_id, role)`, two hand-added partial unique indexes (`WHERE` predicates dropped by drizzle-kit, Task 1.3), and `INDEX(account_id, post_id)`; a one-time data backfill `INSERT ... SELECT` writing one `PUBLISHER_UNKNOWN` row per existing `posts` row (Task 1.3). No backfill is needed or possible for new-post-only columns since there are none — this migration only adds a table.
- **Required TypeScript type changes:** `PostAccountRole`/`POST_ACCOUNT_ROLES` (new, `packages/domain`); `postAccountRoleEnum`/`postAccountAssociations` (new, `packages/database/schema.ts`, auto-exported via the package's existing wildcard `index.ts`/barrel — confirm during implementation that `packages/database`'s own export surface already re-exports everything from `schema.ts` by wildcard, matching how `socialMediaAccountProfiles` etc. are already consumed from `@festgrid/database` elsewhere). No breaking change to any existing type — `PersistScrapedPostParams` is untouched.
- **Backward compatibility and rollout notes:** Purely additive at the DB level (new type, new table) — no existing table or column is altered. At the application level, `posts.accountId`'s *value-resolution logic* changes for brand-new inserts only (AC3, a deliberate, spec-mandated, user-accepted behavior change with a documented bounded interim regression — see Design Decisions above); its column type and FK target are unchanged, and every historical row is untouched (the migration only adds rows to the new table, never updates `posts`). No feature flag needed — this ships atomically with the migration.
- **Verification checks:** Task 1.4's `psql` row-count and index-shape checks; Task 4's new/extended test files; `pnpm --filter database generate`/`migrate`, `pnpm --filter domain build`/`pnpm --filter backend build` (tsc), and lint, all clean.

### Project Structure Notes

- New files: `apps/backend/src/lib/posts/persist-post-account-associations.ts` + its test.
- Modified files: `packages/domain/src/posts/types.ts`, `packages/database/schema.ts` (+ generated migration SQL file under `packages/database/migrations/`, hand-edited per Task 1.3), `apps/backend/src/lib/posts/persist-scraped-post.ts` (+ its test, extended).
- Explicitly **not** touched: `apps/backend/src/lib/scraper/process-scrape-job.ts`, `process-apify-async-result.ts`, `replay-actor-run.ts`, `process-brightdata-result.ts`, `instagram-adapter.ts`, `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts`, `packages/domain/src/scraper/*`, any GraphQL schema/resolver file (no AC in this story requires exposing `post_account_associations` via GraphQL — that is implicitly Story 3.18's or a later story's concern when the filter/query actually reads this table), and the AD-31 Rule 3/4 "organizer-authored predicate" / "event-level union filtering" shared domain functions — those are explicitly created by whichever of Stories 3.6s/3.6t/3.6v needs them first (per AD-31's own text: "created by the first story that needs it"), which land *after* 3.15 in this wave's order; this story only lays the DB groundwork (the table) those later functions will read.
- No new workspace package, no new cross-boundary dependency (no `zod`/`ajv` change — nothing here is an externally-validated boundary), no Firebase/queue/state-management code touched, no `relations()` helper added (no AC requires Drizzle relational-query support for this table yet; several existing provenance/junction tables in this schema, e.g. `scraperActorRuns`, also have no `relations()` entry).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.15: Post-account association table + lossless migration] — full AC text, Architecture note, Dev Notes (DDL shape), and the 2026-10-01 Amendment
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-25: Post-Account Association Table Shape] — owns the table's DDL (binding, not re-decided here)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-31: Post–Account Association Semantics] — role vocabulary, organizer-authored predicate (not built here), event-level union filtering (not built here), migration independence (Rule 5)
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.7a. PostAccountAssociation Interface] — resolves the legacy-backfill role-choice decision explicitly
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 sweep, per-story verdict table entry for 3.15 ("READY"), migration-ordering re-verification
- [Source: _bmad-output/implementation-artifacts/3-14-deduplicated-provenance-tracked-subscribable-profiles.md] — previous story; its exact plumbing (`ownerId`/`coauthors`/`discoverySourceVendor` through `persistScrapedPost` and its three Apify call sites) is reused unchanged by this story
- [Source: _bmad-output/implementation-artifacts/3-13-normalize-apify-vendor-coauthor-publisher-roles-during-ingestion.md] — role-normalization source data this story's associations are built from
- [Source: _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md] — Wave 2B context, dependency summary (3.18/3.6v depend on this story)
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts, apps/backend/src/lib/posts/persist-scraped-post.test.ts, apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts, apps/backend/src/lib/scraper/process-scrape-job.ts, process-apify-async-result.ts, replay-actor-run.ts, process-brightdata-result.ts, packages/database/schema.ts, packages/database/migrations/0032_clammy_komodo.sql, 0046_add_parser_version_source.sql, 0057_same_kang.sql, 0063_curvy_captain_cross.sql, packages/domain/src/posts/types.ts] — all read in full for this story

## Global Rules References

- [x] `_bmad-output/project-context.md` — Database/Runtime Schema Validation (no AJV/Zod boundary touched — nothing here is externally-validated input); Drizzle ORM Types (pg-core types used throughout); Database Indexing (the new `INDEX(account_id, post_id)` matches AD-17's per-row-cost discipline, in anticipation of Story 3.18's join); Code Organization (`packages/domain` gets only the pure `PostAccountRole` type/array — no DB/ORM import there; all DB-coupled logic stays in `apps/backend`/`packages/database`); Testing Rules (no new `packages/domain` *logic* needing 100%-branch coverage — see Data Type Compatibility note)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-25 (table DDL, binding), AD-31 (role semantics, binding; this story is named directly in both)
- [x] `docs/infrastructure/index.md` — reviewed; this story adds a DB migration but no new infrastructure resource (no new queue, Lambda, or compute) — the existing `2-backend.md`/`3-database.md` shards were not independently re-read in full, matching Story 3.14's same reasoning (additive schema change, no new access pattern needing their deeper guidance beyond AD-25, already read in full)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `packages/domain/src/posts/types.ts` — add `PostAccountRole`/`POST_ACCOUNT_ROLES`.
  2. `packages/database/schema.ts` — add `postAccountRoleEnum` + `postAccountAssociations` table.
  3. `packages/database/migrations/00XX_<generated>.sql` (+ `meta/` snapshot/journal) — generated, then hand-edited for the two partial-unique `WHERE` clauses and the AC1 backfill `INSERT`.
  4. `apps/backend/src/lib/posts/persist-post-account-associations.ts` (new) — association writer, bare `onConflictDoNothing()`, per-row try/catch.
  5. `apps/backend/src/lib/posts/persist-scraped-post.ts` — restructure identity resolution to run before the branch split; new-post branch resolves `posts.accountId` to the publisher id (AC3); both branches call the new association writer.
  6. Two test files (one new, one extended) per Task 4.
  7. No other file is modified — all three Apify call sites, the Bright Data call site, `instagram-adapter.ts`, `get-or-create-discovered-account-profile.ts`, and any GraphQL file are explicitly out of scope (see Dev Notes/Out of Scope).
- **Rule Mapping:**
  - AC1 (legacy backfill, exactly one row, zero data loss) → Task 1.3's hand-added `INSERT ... SELECT`.
  - AC2 (new post gets `SCRAPING_SOURCE` always, `PUBLISHER`+N`COAUTHOR` when identity known) → Task 3.4's `persistPostAccountAssociations` call, Task 2.1's writer logic.
  - AC3 (`posts.accountId` resolution + fallback) → Task 3.1 (resolve-before-branch) + Task 3.2 (new-post branch only).
  - AC4 (idempotent re-ingestion, no cross-account duplication error) → Task 2.1's bare `onConflictDoNothing()` + per-row try/catch; Task 4.1's (d)/(e)/(f) tests.
  - AC5 (independently queryable, no 3.18 coupling) → Task 1.2's indexes; no filter/query code is written by this story at all.
  - AD-25/AD-31 DDL and role semantics (binding, not re-decided) → Task 1.2 exactly mirrors the "Full resolved shape" in `epics.md`'s own Story 3.15 Dev Notes.
  - `packages/domain` DB/ORM-decoupling rule (project-context.md) → Task 1.1 keeps `PostAccountRole` a plain type/array with zero Drizzle/Node-only import.
- **Verification Plan:** Task 4.3 in full — migration generate/apply + `psql` checks, new/extended targeted test files, both packages' `build`, lint on all touched files.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — new `post_account_associations` table + migration (DDL per AD-25, exactly one legacy backfill role per AC1) + new `apps/backend/src/lib/posts/` association-writer function + restructured `persist-scraped-post.ts` (identity resolution moved earlier, `posts.accountId` resolution per AC3) + one `packages/domain` type addition; explicitly not touching any of the four scraper call sites, not building Story 3.18's filter or the AD-31 organizer-authored predicate function, not exposing anything via GraphQL.
- [ ] Architecture and boundary confirmation — AD-25/AD-31 DDL and role semantics followed exactly as resolved (not re-decided); `PostAccountRole` stays a pure, DB/ORM-free type in `packages/domain`; all DB-coupled logic stays in `apps/backend`/`packages/database`, per `project-context.md`'s Code Organization rule.
- [ ] Testing plan confirmation — Task 4's 10 new test cases (6 in the new writer's own test file, 5 in `persist-scraped-post.test.ts`) cover AC1-AC5, including the idempotency and cross-account-conflict edge cases the partial unique indexes exist for.
- [ ] Explicit human approval state (Default: pending approval) — **pending**; this story has not yet been implemented.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md` (READY, no correction needed for 3.15); Gate 2 run fresh this session (No gap found, backend-only scope).
- [ ] Design decisions confirmed — AC3's `posts.accountId` resolution + its accepted interim regression (decided by the user in a prior session, recorded above, not re-asked); the legacy migration backfill role (`PUBLISHER_UNKNOWN`, resolved by PRD §4.7a citation) — both recorded in Dev Notes "Design Decisions."

## Testing Requirements

- [ ] Unit tests — none required; `PostAccountRole`/`POST_ACCOUNT_ROLES` is a plain literal type/array with no branches to cover, and no new `packages/domain` function is added by this story.
- [ ] Integration tests — `apps/backend/src/lib/posts/persist-post-account-associations.test.ts` (new, 6 cases) and `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (extended, 5 new cases `(u)`-`(y)`), both `node:test` against the real local Postgres DB, matching this directory's existing convention (no DB mocking).
- [ ] E2E tests — not applicable; this is a backend-only data-pipeline/migration change with no user-facing flow to exercise end-to-end, per `project-context.md`'s testing-trophy guidance.

## Deliverables Checklist

- [ ] `post_account_role` enum + `post_account_associations` table added to `packages/database/schema.ts`, migration generated and hand-edited (two partial unique indexes + AC1 backfill `INSERT`), applied to the local dev DB.
- [ ] `PostAccountRole`/`POST_ACCOUNT_ROLES` added to `packages/domain/src/posts/types.ts`.
- [ ] `persistPostAccountAssociations` implemented in `apps/backend/src/lib/posts/` with bare `onConflictDoNothing()` and per-row resilience.
- [ ] `persist-scraped-post.ts` restructured: identity resolution runs before the branch split and returns resolved ids; new-post branch resolves `posts.accountId` per AC3; both branches write associations.
- [ ] 11 new/extended test cases (6 new, 5 extended) across the two test files, all green.
- [ ] `pnpm --filter database generate`/`migrate`, `pnpm --filter domain/backend build`, and lint on all touched files all clean.

## Out of Scope

- The AD-31 Rule 3 "organizer-authored predicate" shared domain function, and the AD-31 Rule 4 "event-level union filtering" shared helper — both explicitly created by "the first story that needs it" among Stories 3.6s/3.6t/3.6v, which land after this story in the wave order. This story only builds the table those functions will eventually read.
- Story 3.18's actual switch of the subscribed-feed account filter from `posts.accountId` to the association table — depends on this story, not built here. The interim regression this creates is explicitly accepted (see Dev Notes Design Decisions).
- Any GraphQL schema/resolver exposure of `post_account_associations` — no AC in this story requires it.
- Any change to the four scraper call sites (`process-scrape-job.ts`, `process-apify-async-result.ts`, `replay-actor-run.ts`, `process-brightdata-result.ts`) or `instagram-adapter.ts` — Story 3.14 already threads everything this story needs.
- Backfilling or re-deriving `PUBLISHER`/`COAUTHOR` associations for historical posts beyond the single `PUBLISHER_UNKNOWN` row AC1 requires — no vendor evidence exists for legacy posts to do this correctly, and AC1 explicitly forbids "guessing" ownership.
- A `relations()` Drizzle helper for the new table — no AC requires relational-query support yet.
- Story 3.6r's `event_posts` table or any AD-30 schema change — independent migration, coordinated only on ordering (AD-31 Rule 5), not combined with this story's migration.

## Definition of Done

- [ ] AC1-AC5 satisfied exactly as specified above, including the resolved role-choice and `posts.accountId`-fallback design decisions.
- [ ] All Task 4 tests passing, plus every pre-existing test in `persist-scraped-post.test.ts` (no regression from the Task 3 restructuring).
- [ ] `pnpm --filter database generate`/`migrate` clean; `pnpm --filter domain build`/`pnpm --filter backend build` (tsc) clean; `pnpm lint` clean on all touched files.
- [ ] No file outside the File Change Plan touched.

## Completion Status

- [ ] Not yet implemented — story is `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`), via `bmad-dev-story`.

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-10-02: Story drafted via `bmad-create-story`, CC-024 Wave 2B, building against Story 3.14 (status `review`, standing rule allows). Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md`; Gate 2 run fresh (no gap, backend-only). AC3's `posts.accountId` resolution and its accepted interim regression were pre-decided by the user (not re-asked, per explicit instruction) and recorded in Dev Notes. The legacy migration backfill role (`PUBLISHER_UNKNOWN` vs `SCRAPING_SOURCE`) — explicitly left open by `epics.md`'s own architecture note for this story to resolve — was settled by citing PRD §4.7a's explicit text rather than treated as an open question for the user. Status set to `ready-for-dev`.
