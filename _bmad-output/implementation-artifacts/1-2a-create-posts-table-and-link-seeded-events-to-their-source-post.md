---
baseline_commit: cf0949a8d2ca42b6ab393b4976080e35afd71487
---

# Story 1.2a: Create posts table and link seeded events to their source post

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.2a
- **Story Key:** 1-2a-create-posts-table-and-link-seeded-events-to-their-source-post
- **Status:** ready-for-dev

## Story
**As a** developer,
**I want** a `posts` table (matching the PRD's `Post` interface plus a `subscriptionId` reference and `publishedAt` timestamp — the same shape Story 3.3a specifies for the social-media scraping pipeline) created now, and the `events` table extended with a nullable `postId` foreign key referencing it,
**So that** `EventCard` (Story 1.3b) and the events GraphQL API (Story 1.3a) can resolve an event's real image via its source post — matching the PRD's actual data model, where `EventInfo` (PRD §4.1) has no image field of its own because images travel via `Post.imageUrl` (PRD §4.7) — instead of Epic 3's scraping pipeline being the only story that ever populates this table.

## Acceptance Criteria
- **AC1:** **Given** Story 1.1's tables exist, **when** the migration script runs, **then** a `posts` table is created with `id` (uuid pk), `subscription_id` (FK to `subscriptions`, nullable), `content` (text, not null), `image_url` (text, nullable), `post_url` (text, nullable), `is_extracted` (boolean, default false), `published_at` (timestamp, not null), and standard `created_at`/`updated_at` timestamps — exactly the shape Story 3.3a's original AC specified — indexed on `subscription_id` and `published_at`.
- **AC2:** The `events` table gains a nullable `post_id` column (FK to `posts.id`, `ON DELETE SET NULL` so a future post deletion never cascades into deleting an event — see Dev Notes), via a new Drizzle-kit-generated migration (AD-3). An index on `events.post_id` is added to support Story 1.3a's AC6 join.
- **AC3:** `packages/shared-types`'s `EventInfo` interface gains an optional `postId?: string`; no direct image field is added to `EventInfo` — the image is a runtime-computed field resolved via the post relationship, mirroring how `isFavorited`/`isAddedToCalendar` are already documented as runtime-computed rather than stored on the base type.
- **AC4:** `packages/database/seed.ts` is updated to create one `posts` fixture row per existing fixture event (linked to that event's matching subscription, e.g. `FIXTURE_SUBSCRIPTIONS[0].id`), populated with the `image_url` currently embedded as text inside that event's `description` field, and each fixture event's `post_id` is set to reference its corresponding new post row; the `"Poster image: ..."` substring is removed from `description` once the URL lives in its proper structured column.
- **AC5:** The seed integration test (`packages/database/seed.integration.test.ts`, from Story 1.2) is extended to assert the new `posts` table's row count and that every fixture event's `post_id` resolves to a `posts` row with a non-null `image_url`.
- **AC6:** This story does not implement any of the actual scraping/persistence logic for real scraped posts (writing newly-scraped posts, updating `is_extracted`) — that remains Story 3.3a's scope, narrowed to build on top of the table this story creates rather than creating it from scratch (see the amendment note on Story 3.3a in `epics.md`).

**Note (from epics.md):** This story exists because of a Data Type Compatibility gap surfaced while creating Story 1.3b (`EventCard`) — the PRD's `EventInfo` interface has no image field, because event images are meant to travel via the source `Post.imageUrl`, not a field on the event itself. Story 3.3a already defines the target `posts` table shape but scoped it to Epic 3's scraping pipeline, chronologically after Epic 1. Since Epic 1's `EventCard`/events API need real, non-placeholder images sooner, this story pulls the table-creation portion of Story 3.3a's scope earlier — following the Story 1.1 precedent of scoping originating tables to the epic that first needs them — and narrows Story 3.3a accordingly.

**Depends on:** Story 1.1, Story 1.2.

## Tasks / Subtasks
- [ ] 1. Add the `posts` table to `packages/database/schema.ts` (AC1): `id` (uuid, `defaultRandom().primaryKey()`), `subscriptionId` (uuid, `references(() => subscriptions.id)` — no `onDelete` clause, matching the conservative `apiKeys.userId` precedent already in the file rather than cascading), `content` (`text().notNull()`), `imageUrl` (`text()`, nullable), `postUrl` (`text()`, nullable), `isExtracted` (`boolean().default(false).notNull()`), `publishedAt` (`timestamp({ withTimezone: true }).notNull()`), plus `...timestamps`. Add a `(t) => ({...})` index block with `subscriptionIdIdx` on `subscriptionId` and `publishedAtIdx` on `publishedAt`, following the exact pattern already used for `events`/`schedules` indexes in the same file.
- [ ] 2. Add `postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' })` to the `events` table definition (AC2). Add `postIdIdx: index('event_post_id_idx').on(t.postId)` to `events`'s existing index block (do not touch the four existing indexes).
- [ ] 3. Add Drizzle `relations()` wiring consistent with the file's existing pattern (not itself required by any AC, but needed so `posts`/`events`/`subscriptions` stay internally consistent — every other FK in the file has a matching `relations()` entry): extend `eventsRelations` with `post: one(posts, { fields: [events.postId], references: [posts.id] })`; add `postsRelations = relations(posts, ({ one, many }) => ({ subscription: one(subscriptions, { fields: [posts.subscriptionId], references: [subscriptions.id] }), events: many(events) }))`; extend `subscriptionsRelations` with `posts: many(posts)`.
- [ ] 4. Run `pnpm --filter @festgrid/database run generate` (drizzle-kit) against the updated schema to produce a new `packages/database/migrations/NNNN_<auto-name>.sql` file (AD-3 — do not hand-write migration SQL). Commit the generated file as-is; do not edit it manually.
- [ ] 5. Run `pnpm --filter @festgrid/database run migrate` against the local dev database to apply the new migration and confirm it succeeds with no errors.
- [ ] 6. Add `postId?: string;` to the `EventInfo` interface in `packages/shared-types/src/index.ts` (AC3), placed alongside the other optional runtime-computed fields (`isFavorited?`, `isAddedToCalendar?`). Do **not** add any new field to the `Post` interface in the same file — `subscriptionId`/`publishedAt` are DB-table-only additions for this story; no consumer reads them from the shared `Post` TS type yet (see Data Type Compatibility below).
- [ ] 7. In `packages/database/seed.ts` (AC4): add a `FIXTURE_POSTS` array (one entry per `FIXTURE_EVENTS` row) with deterministic ids in the `60000000-0000-0000-0000-00000000000N` range (continuing the file's existing `10000000`/`20000000`/.../`50000000` numbering convention). For each post: `subscriptionId` = the same subscription the corresponding event's `sourceSocialMediaAccountId` already maps to (`FIXTURE_SUBSCRIPTIONS[0].id` for events 1–2, `FIXTURE_SUBSCRIPTIONS[1].id` for event 3); `postUrl` = the *same* URL already used as that event's `contactInfo` (these are already real Instagram post permalinks — do not invent new ones); `imageUrl` = the literal URL currently embedded in that event's `description` string (e.g. `https://images.example.com/events/past-jazz-night.jpg`); `isExtracted: true` (these fixtures represent posts that already produced a materialized event); `publishedAt` = a fixed, deterministic timestamp plausibly before each event's main schedule (e.g. a few weeks prior); `content` = a short deterministic caption string (no existing source text to reuse — author new fixture copy, e.g. referencing the event name). Do not write a generic "extract URL from description" parsing utility — this is one-time static fixture restructuring, not reusable production logic (that distinction matters: the real extraction/parsing pipeline is Epic 3's Story 3.6, an AI-driven process, not a string-substring parser).
- [ ] 8. In the same file, remove the `"Poster image: https://..."` sentence from each `FIXTURE_EVENTS[n].description` (per AC4, the URL now lives in `FIXTURE_POSTS[n].imageUrl` instead) — omit the `description` field entirely for these three fixtures rather than leaving an empty string, since the column is nullable and there is no other description content to retain. Add `postId: FIXTURE_POSTS[n].id` to each corresponding `FIXTURE_EVENTS` entry.
- [ ] 9. Update `seedDatabase()`'s transaction in `seed.ts`: insert `posts` after `apiKeys` and before `events` (posts must exist before an event's `post_id` FK can reference one); delete in the reverse-safe order — `schedules` (child of `events`) → `events` (child of `posts`) → `posts` (child of `subscriptions`) → `apiKeys` → `subscriptions` → `userLocations` → `users`. This changes the existing deletion order (previously `subscriptions` was deleted before `events`, which was safe only because `events` had no real FK to `subscriptions` — it now indirectly does, via `posts`).
- [ ] 10. Add `posts: FIXTURE_POSTS.length` to the exported `FIXTURE_COUNTS` object, and a sorted `FIXTURE_POST_IDS` export, mirroring every other fixture-id export already in the file (AC4, AC5).
- [ ] 11. Extend `packages/database/seed.integration.test.ts` (AC5): import the `posts` table and the new `FIXTURE_COUNTS.posts`/`FIXTURE_POST_IDS` exports; assert the `posts` row count on both the first and second (idempotency) seed runs, following the exact pattern already used for `users`/`events`/etc. in this file. Add a join-based assertion (`events` left-joined to `posts` on `events.postId = posts.id`) proving every one of the 3 fixture events resolves to a `posts` row with a non-null `imageUrl` (AC5's literal requirement) — assert the joined-row count equals `FIXTURE_COUNTS.events` and that no row has a null `imageUrl`.
- [ ] 12. Run `pnpm --filter @festgrid/database lint`, `pnpm --filter @festgrid/database build`, and `pnpm --filter @festgrid/database test:seed` (the `tsx --test` integration test) to confirm everything passes end-to-end against a local database.

## Dev Notes

### Architecture & UX Gate Findings
- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is marked `swept: true`, but this story (`1.2a`) is **not** listed in its `stories_covered` frontmatter — it was split off and added to `epics.md`/`sprint-status.yaml` *after* that sweep ran (surfaced later, while drafting Story 1.3b). Per the workflow's escape-hatch guard, Gate 1/3 were re-reasoned narrowly for this story's actual scope rather than blindly trusted from the sweep: this story only adds a table + a nullable FK column to `packages/database` and updates the existing seed script — it does not call an external service, does not bypass `apps/backend`'s GraphQL layer (it has no runtime/API surface of its own; Story 1.3a's resolver is the sole consumer of the column/table this story creates), and does not introduce any new cross-cutting/shared tooling gap (it extends an already-established pattern — Drizzle schema + `drizzle-kit` migrations + the existing seed script — the same pattern Stories 1.1/1.2 already used). **No gap found** for Gate 1 or Gate 3.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya (`wds-agent-freya-ux`) against `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/D-Design-System/01-event-list-view.md`, `design-artifacts/D-Design-System/02-post-selection-view.md`, and the relevant `C-UX-Scenarios` files. **No gap found** — this story ships zero React components/hooks/pages. The only image reference in the design system (`event_card_compact.image`) belongs to the calendar mini-card, not the main `EventCard` (correctly scoped to Story 1.3b), and the PRD's `Post`/`EventInfo` interfaces confirm a strict one-post-one-image-per-event model matching this story's `image_url`/`post_id` shape exactly — no aspect ratio, multi-image, or other UI-facing requirement is hiding inside this "just a migration" story.
- **Lightweight escape-hatch guard:** Re-checked this story's specific scope for anything the (inapplicable) sweep or Gate 2 subagent pass might not have anticipated. Nothing new: the deletion/insertion-order change in `seedDatabase()` (Task 9) is a mechanical consequence of adding two real FKs to already-established tables, not a new architectural layer or shared dependency — it does not warrant its own story.

### Data Type Compatibility & Migration Requirements
- **The mismatch:** No image field exists today on the `events` Drizzle table or the `EventInfo` shared TypeScript type. Per the PRD (§4.1, §4.7) this is by design — an event's image is meant to travel via its source `Post.imageUrl`, not a field on the event itself — but no `posts` table exists yet either, so `packages/database/seed.ts` currently stuffs the image URL as unstructured text inside `events.description` (e.g. `"Poster image: https://images.example.com/events/past-jazz-night.jpg"`) as a stopgap.
- **Impacted fields/contracts:** `events` table (DB, needs `post_id` FK), a new `posts` table (DB), `EventInfo` interface (`packages/shared-types`, needs `postId?: string`), `packages/database/seed.ts`'s fixture data and insert/delete ordering, `seed.integration.test.ts`'s assertions. Story 1.3a's not-yet-implemented `Event.imageUrl` GraphQL resolver (its AC6) is the next consumer of the column this story creates, but implementing that resolver is explicitly **not** this story's scope (AC6 above / Out of Scope).
- **Required DB migration changes:** A new `drizzle-kit`-generated migration (AD-3) creating the `posts` table and adding the nullable `post_id` FK column to `events`, per Tasks 1–5 above. Both the table and the FK column ship in this story; nothing is deferred on the schema side.
- **Required TypeScript type changes:** `EventInfo.postId?: string` added to `packages/shared-types` (Task 6). The `Post` interface itself is intentionally **not** modified — `subscriptionId`/`publishedAt` exist as DB columns (needed for Epic 3/5's future scraping-pipeline queries per Story 3.3a's original spec) but have no TypeScript-level consumer yet; adding them to the shared `Post` type now would be speculative and is deferred to whichever story (3.3a or later) first needs to read them through the API.
- **Backward compatibility and rollout notes:** `post_id` is nullable, so existing rows (and any future event created without a linked post) remain valid. `ON DELETE SET NULL` on `events.post_id` (AC2) ensures a future post deletion can never cascade into deleting a real event — protecting the more valuable, publicly-visible `events` row over the supplementary `posts` row. This story's seed-data changes are the only rollout: no production data migration is needed since the app has not shipped real user-facing data yet (Story 1.2's fixtures are dev/test-only).
- **Verification checks:** Task 11's extended `seed.integration.test.ts` proves end-to-end alignment — every fixture event's `post_id` resolves to a real `posts` row with a non-null `image_url`, on both the first seed run and the idempotent second run.

### Previous Story Intelligence (Story 1.2)
- Story 1.2 established the deterministic, transactional seeding pattern this story extends: fixed fixture UUIDs/slugs (not random), an explicit FK-safe deletion order wrapped in one `db.transaction`, and an integration test asserting both row counts and relational integrity (orphan checks) on a first *and* second (idempotency) run. This story's Tasks 7–11 follow that exact same pattern rather than introducing a new one.
- Story 1.2's code review (see its Review Findings) hardened destructive-seed-target detection (`isLocalConnectionString`/`assertSafeSeedTarget`, already present in `seed.ts` and reused unchanged here) and added explicit AC-mapped assertions rather than vague "it works" tests — apply the same rigor to the new `posts`-related assertions in Task 11 (explicit, AC-traceable checks, not a generic smoke test).
- Story 1.2 is `done`; there are no open corrections or in-flight patterns from it that block this story.

### Architecture / technical constraints
- **AD-3 (Database Schema Management):** Schema changes are code-first via Drizzle TypeScript definitions; migrations **must** be `drizzle-kit`-generated SQL files committed to the repo (Task 4) — never hand-written or applied ad hoc.
- **Drizzle ORM Types (`project-context.md`):** Use PostgreSQL-specific types from `drizzle-orm/pg-core` (`uuid`, `text`, `boolean`, `timestamp`, `index`), matching the imports already at the top of `schema.ts` — no new import needed for this story's column types.
- **Unique Identifiers:** `posts.id` is a DB-generated UUID (`defaultRandom()`), consistent with every other primary entity in the schema. `posts` is not an `EventInfo`/`Schedule`-style entity, so it does **not** need a `slug` column (the project-context.md slug rule is scoped specifically to `EventInfo` and `Schedule`).
- **Database Indexing for Performance:** `project-context.md`'s indexing rule names specific `events`/`schedules` columns (`eventName`, `performers`, `location`, `types`, `categories`) but is silent on FK join columns generally; this story adds indexes on `posts.subscription_id`, `posts.published_at` (explicitly required by AC1, matching Story 3.3a's original spec for Epic 5's "20 most recent posts" query) and `events.post_id` (added proactively — not explicitly required by any AC, but directly needed for Story 1.3a's AC6 join to perform well, and cheap to add now while the column is created).
- **Package boundaries:** All work in this story stays inside `packages/database` (schema, migration, seed script, seed test) and `packages/shared-types` (one optional interface field). No `apps/web` or `apps/backend` code is touched — this is intentional (see Out of Scope); `apps/backend` only starts consuming `post_id`/`imageUrl` once Story 1.3a's AC6 is implemented.
- **Testing:** Following Story 1.2's precedent (and Story 1.3a's Dev Notes on the same interim strategy), the integration test extension uses `node:test`/`tsx --test` via the existing `test:seed` script — Story 0.10's Vitest foundation now exists (`packages/database/vitest.config.ts`/`seed.test.ts` are present for pure-function unit tests like `isLocalConnectionString`), but the seed *integration* test (which needs a real running Postgres instance and the full transactional seed flow) stays on the `node:test` pattern already established by `seed.integration.test.ts` — do not migrate it to Vitest as part of this story, that is out of scope.

### Git Intelligence Summary
- Recent commit history is dominated by `bmad-*` planning-process commits (epic readiness sweeps, story artifacts, AC updates to Stories 1.3a/0.17/0.16); no application-code commit yet touches `packages/database/schema.ts`/`seed.ts` beyond Story 1.1/1.2's original work, so there is no newer in-flight pattern to reconcile against beyond what Story 1.2's own Dev Agent Record documents (see Previous Story Intelligence above).
- `packages/database/migrations/` currently contains a single squashed migration (`0000_cultured_ultragirl.sql`) covering Story 1.1's tables — the next migration this story generates will be `drizzle-kit`'s next auto-numbered file (do not assume or hardcode a specific filename; let `pnpm run generate` name it).

## Global Rules References
- `_bmad-output/project-context.md` — Drizzle ORM Types, Unique Identifiers, Database Indexing.
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical structure this file follows.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-3 — Database Schema Management).
- `_bmad-output/planning-artifacts/epics.md` (Story 1.2a, and its consumers Story 1.3a/AC6, Story 1.3b, and the amended Story 3.3a).
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions and the epic-level sweep's scope limits.
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` — swept report (does not cover this story; see Gate Findings above).
- `docs/infrastructure/3-database.md` — confirms Supabase Postgres is already the provisioned production database; this story adds application-level schema only, no new infra provisioning.

## Implementation Plan (Rule-Compliant)
- **File Change Plan:**
  - Modify: `packages/database/schema.ts` — add `posts` table, `postId` column on `events`, and the three `relations()` extensions (Tasks 1–3).
  - Add: `packages/database/migrations/<new-drizzle-kit-generated-file>.sql` — generated, not hand-written (Task 4).
  - Modify: `packages/shared-types/src/index.ts` — add `EventInfo.postId?: string` (Task 6).
  - Modify: `packages/database/seed.ts` — add `FIXTURE_POSTS`, update `FIXTURE_EVENTS`, update `FIXTURE_COUNTS`/id exports, update transaction insert/delete ordering (Tasks 7–10).
  - Modify: `packages/database/seed.integration.test.ts` — add posts count + event→post join assertions on both seed runs (Task 11).
  - **Not modified:** `apps/web`, `apps/backend` (no consumer wired yet — that's Story 1.3a/1.3b), `packages/database/migrate.ts` (unchanged migration-runner logic), `packages/shared-types`'s `Post` interface (deliberately left alone, see Data Type Compatibility).
- **Rule Mapping:**
  - *AD-3 (Database Schema Management)* → schema-first Drizzle definitions + generated migration file, never hand-written SQL (Task 4).
  - *Drizzle ORM Types / Unique Identifiers* → `uuid`/`defaultRandom()` for `posts.id`, PG-specific column types throughout (Task 1).
  - *Database Indexing* → `posts.subscription_id`/`posts.published_at` (AC1) and `events.post_id` (proactive) indexes (Tasks 1–2).
  - *Data Type Compatibility (workflow-mandated section)* → dedicated section above documenting the `EventInfo`/`Post`/DB alignment and why `Post` itself is left unchanged.
  - *End-to-End Type Safety* → `EventInfo.postId?` keeps the shared type in sync with the new DB column ahead of Story 1.3a's GraphQL codegen consuming it.
  - *Testing Rules (deterministic/idempotent seeding)* → Task 9's insert/delete reordering preserves Story 1.2's transactional, idempotent seed guarantee even with two new real FKs in play.
- **Verification Plan:**
  - `pnpm --filter @festgrid/database lint` and `pnpm --filter @festgrid/database build` — clean.
  - `pnpm --filter @festgrid/database run generate` — produces exactly one new migration file with no unexpected diff against `schema.ts` (drizzle-kit should not flag any other unintended schema drift).
  - `pnpm --filter @festgrid/database run migrate` — applies cleanly against local Postgres.
  - `pnpm --filter @festgrid/database test:seed` — the extended `seed.integration.test.ts` passes: posts row count correct on run 1 and run 2 (idempotency), every fixture event's `post_id` resolves to a `posts` row with non-null `image_url`, no orphaned rows introduced by the new deletion ordering.

## Pre-Coding Approval Gate
- [ ] Scope confirmed: `packages/database` (schema, migration, seed, seed test) and one optional field on `packages/shared-types`'s `EventInfo` only. No `apps/web`/`apps/backend` changes, no `Post` interface changes, no real scraping/persistence logic (that remains Story 3.3a's narrowed scope).
- [ ] Architecture confirmed: AD-3-compliant `drizzle-kit`-generated migration; `events.post_id` uses `ON DELETE SET NULL` (protects event rows from post deletions) while `posts.subscription_id` uses no cascade (matches the existing `apiKeys.userId` conservative precedent).
- [ ] Testing plan confirmed: extend the existing `node:test`/`tsx --test` `seed.integration.test.ts` (Story 1.2's established pattern) — not a new Vitest integration suite — with posts-count and event→post join assertions, verified on both a first and idempotent second seed run.
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 re-reasoned narrowly since this story postdates the swept `epic-1-readiness.md` report (no gap found); Gate 2 run fresh via subagent (no gap found — pure schema/data story, zero UI surface).
- [ ] Fixture data decision accepted: `FIXTURE_POSTS.content` is authored as new deterministic caption text (no existing source string to reuse); `imageUrl` values are moved verbatim from each event's current `description` text rather than derived via a parsing utility (deliberately avoiding a speculative "extract from description" abstraction for what is one-time static fixture data — see Task 7).
- [ ] Explicit human approval state (Default: **pending approval**)

## Testing Requirements
- Extend `packages/database/seed.integration.test.ts` (`node:test` via `tsx --test`, matching Story 1.2's established interim testing strategy) to assert: the `posts` table's row count matches `FIXTURE_COUNTS.posts` on both the first and second (idempotent) seed run; every fixture event's `post_id` resolves to a `posts` row via a join, with that joined row's `image_url` non-null, on both runs; no new orphaned rows are introduced by the reordered delete/insert sequence (Task 9).
- No unit-test coverage is separately mandated for this story's fixture-data changes — `packages/domain`'s 100%-coverage rule (`project-context.md`) does not apply here since no business logic is added to `packages/domain`; this story only adds schema + static fixture data.
- No E2E test required — nothing renders or queries this data through a live page yet (that begins with Story 1.3, once Story 1.3a's resolver exists).

## Deliverables Checklist
- [ ] `posts` table added to `packages/database/schema.ts` with the exact column set and indexes from AC1.
- [ ] `events.post_id` nullable FK column added, with an index, per AC2.
- [ ] New `drizzle-kit`-generated migration file committed (not hand-written).
- [ ] `EventInfo.postId?: string` added to `packages/shared-types`.
- [ ] `packages/database/seed.ts` updated: `FIXTURE_POSTS` added, `FIXTURE_EVENTS` linked via `postId` with the `"Poster image: ..."` text removed from `description`, insert/delete ordering updated, `FIXTURE_COUNTS`/id exports updated.
- [ ] `seed.integration.test.ts` extended with posts-count and event→post join assertions, verified on first and second seed runs.
- [ ] `pnpm --filter @festgrid/database lint`, `build`, `run generate`, `run migrate`, and `test:seed` all pass locally.

## Out of Scope
- Any GraphQL resolver work exposing `imageUrl`/`postId` (handled by Story `1-3a-build-the-events-backend-graphql-api-layer`'s AC6, `ready-for-dev`).
- Any frontend rendering of the event image (handled by Story `1-3b-build-the-reusable-eventcard-component`, `ready-for-dev`).
- Real scraping/persistence logic for actual scraped posts, or updating `is_extracted` for real pipeline runs (remains Story `3-3a-create-posts-table-and-persist-scraped-posts`'s narrowed scope, per its Amendment note in `epics.md`).
- Adding `subscriptionId`/`publishedAt` to the shared `Post` TypeScript interface (deferred until a real API consumer needs them — see Data Type Compatibility).
- Any change to `packages/database/migrate.ts` or the CI/CD migration-application step (Story 0.5's pipeline already applies committed migration files automatically; no change needed here).

## Definition of Done
- [ ] AC1–AC6 satisfied.
- [ ] Required tests passing: extended `seed.integration.test.ts` (`pnpm --filter @festgrid/database test:seed`).
- [ ] Lint and type checks passing for `packages/database` and `packages/shared-types`.

## Completion Status
Incomplete

## Dev Agent Record
- None yet.
