# Story 3.7f: Capture each post's platform post id and permalink type at scrape time

## Story Details

- Epic: 3
- Story ID: 3.7f
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want every scraped post to store its platform post id and its real permalink type (`p`, `reel`, ...),
so that event slugs (Story 3.7g) and the DB-free oEmbed lookup (Architecture Spine AD-16 Rule 6, Story 3.7h) can be built from data captured once, at scrape time, never re-parsed or assumed later.

## Acceptance Criteria

1. **Given** Architecture Spine AD-16 Rule 2, **when** `persistScrapedPost()` (`apps/backend/src/lib/posts/persist-scraped-post.ts`) persists a **new** post, **then** `posts.platformPostId` and `posts.platformPostType` (new nullable columns) are populated by a new sibling parser next to `parseImageUrlExpiry()` in `@festgrid/domain/scraper`, derived from `postUrl`/`originalPostUrl`, capturing the real `/p/` vs `/reel/` (vs `/reels/`) type rather than assuming one.
2. **And** a post whose URL(s) cannot be parsed keeps both columns `null` (never a guessed value); existing rows are **not** backfilled — fix-going-forward only, mirroring AD-12 Rule 5's precedent. This also means the already-existing "dedupe found a matching row" path in `persistScrapedPost()` must **never** write `platformPostId`/`platformPostType` into an existing row, even if they are newly derivable — only the brand-new-insert path populates them.
3. **And** the parser is pure, lives in `packages/domain`, and has 100% unit-test coverage including `/p/`, `/reel/`, `/reels/`, trailing slashes, query strings, and non-Instagram/unparseable URLs; platform codes come only from `platform-registry.ts` (`getPlatformSlug()`/`getPlatformByCode()`), never a new mapping.
4. **And** the Drizzle migration is generated (`drizzle-kit`) and reversible.

## Tasks / Subtasks

- [ ] **Task 1 — Schema: add `platformPostId`/`platformPostType` columns to `posts`** (AC: 1, 2, 4)
  - [ ] In `packages/database/schema.ts`'s `posts` table, add two new nullable columns immediately after `originalPostUrl` (they are both URL-derived identity fields, same conceptual group): `platformPostId: text('platform_post_id')` and `platformPostType: text('platform_post_type')`. No index — nothing in this story or its two immediate dependents (3.7g, 3.7h — AD-16 Rule 6 reconstructs the permalink from the *slug*, not by querying `posts` on these columns) filters `WHERE` on them yet.
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the migration SQL file (next sequential number after `0061_brief_killraven.sql`, i.e. `0062_<drizzle-kit-generated-name>.sql`) and confirm `packages/database/migrations/meta/_journal.json` gained the matching entry. Confirm the generated SQL is two plain `ALTER TABLE "posts" ADD COLUMN ...` statements with no `NOT NULL`/`DEFAULT` (both columns must stay nullable) — reversible by a straightforward `DROP COLUMN` (Drizzle-kit's down-migration is implicit/manual per this repo's existing migrations; no custom down-migration file is needed, matching every prior nullable-column-add in this migrations folder, e.g. `0058_nice_liz_osborn.sql`/`0059_dapper_doctor_strange.sql` — inspect one for the exact shape before writing/reviewing the generated file).
  - [ ] Run `pnpm --filter @festgrid/database migrate` against the local native Windows Postgres (`.env`'s `DATABASE_URL`) to apply it.

- [ ] **Task 2 — Domain: `parsePlatformPostIdentity()` pure parser** (AC: 1, 2, 3)
  - [ ] Add `packages/domain/src/scraper/parse-platform-post-identity.ts`, sibling to and matching the style of `parse-image-url-expiry.ts` (same `try { new URL(...) } catch { return ... }` shape, same doc-comment convention).
  - [ ] Signature: `parsePlatformPostIdentity(urls: { postUrl?: string | null; originalPostUrl?: string | null }): { platformPostId: string | null; platformPostType: string | null }`. Internally: try `originalPostUrl` first (per `epics.md`'s own description of the field, line ~1625: "`Post.originalPostUrl` (when derivable) ... the real source link" vs "`Post.postUrl` (the post as actually scraped, which may be a proxy/mirror site)" — `originalPostUrl`, when present, is the more authoritative candidate); if that yields no match, fall back to `postUrl`. Fixture evidence this ordering must satisfy: `persist-scraped-post.test.ts` test (d) already exercises a post whose `postUrl` is a non-Instagram-shaped proxy domain (`https://proxy1.com/p/first_scraper_...`) alongside a real `originalPostUrl` (`https://instagram.com/p/canonical_shared_...`) — both happen to be `/p/`-shaped in that fixture, but the ordering rule (prefer `originalPostUrl`) is what makes the *general* case correct, not this specific fixture's coincidental shape match.
  - [ ] Matching logic is **shape-based on the URL path, not hostname-based** — do not call `detectPlatformFromUrl()` or check `hostname` at all. Reasoning (record in Dev Notes, not just here): `postUrl` is explicitly documented as "may be a proxy/mirror site" (a non-`instagram.com` domain that still mirrors Instagram's own path convention, per the `proxy1.com/p/...` fixture above) — gating on hostname would wrongly null out exactly the proxy case this column exists to still capture correctly. A single regex against `new URL(url).pathname` — `/\/(p|reel|reels)\/([^/?#]+)/` — extracts `platformPostType` (group 1, verbatim — `reel` and `reels` are **not** normalized to one value, per AD-16 Rule 2's "the real scraped path type is captured and replayed verbatim, never assumed") and `platformPostId` (group 2, trailing slash and query string already excluded by the regex/`URL` parsing, never further split). No match (including any genuinely non-Instagram URL, e.g. a `twitter.com`/`x.com` link, or a malformed string) → both fields `null`.
  - [ ] AC3's "platform codes come only from `platform-registry.ts`, never a new mapping" is satisfied by **not introducing any platform/hostname mapping at all** in this parser (see previous bullet) — there is nothing here that could drift from `getPlatformSlug()`/`getPlatformByCode()`. Document this explicitly in the story's Dev Notes so `bmad-dev-story`/review don't go looking for an unnecessary `platform-registry.ts` import inside this file.
  - [ ] Export from `packages/domain/src/scraper/index.ts` (`export * from "./parse-platform-post-identity.js";`, matching the existing `parse-image-url-expiry.js` line).
  - [ ] `packages/domain/src/scraper/parse-platform-post-identity.test.ts`: 100% branch/line coverage (project-context.md Testing Rules), covering at minimum — `/p/{id}`, `/reel/{id}`, `/reels/{id}`; trailing slash (`/p/{id}/`); query string (`/p/{id}?utm_source=ig_web_copy_link`); `originalPostUrl` present and parseable (used, `postUrl` ignored); `originalPostUrl` present but unparseable, `postUrl` parseable (falls back correctly); both absent/null/undefined; a non-Instagram-shaped URL (e.g. a bare profile URL with no `/p//reel//reels/` segment, and a `twitter.com` URL); a malformed URL string.

- [ ] **Task 3 — Wire into `persistScrapedPost()`, insert-only** (AC: 1, 2)
  - [ ] In `apps/backend/src/lib/posts/persist-scraped-post.ts`'s **insert path only** (the `insertValues` block, not the existing-row `backfillPatch` block above it), call `parsePlatformPostIdentity({ postUrl, originalPostUrl })` and spread `platformPostId`/`platformPostType` into `insertValues`, alongside the existing `imageUrlExpiresAt` computation (same call-site pattern AD-16 Rule 2 describes — "alongside the existing expiry parse").
  - [ ] Do **not** touch the `backfillPatch` object (the dedupe/existing-row branch) — it must keep backfilling only `videoUrl`/`imageUrl`(+`imageUrlExpiresAt`) exactly as today; adding these two new fields there would violate AC2's no-backfill rule.
  - [ ] Both the primary insert and the FK-violation retry insert (`insertValues` is reused for both, per the existing `{...insertValues, scraperActorRunId: null}` retry) automatically carry the new fields through unchanged — no separate wiring needed for the retry branch.

- [ ] **Task 4 — Extend `persist-scraped-post.test.ts`** (AC: 1, 2)
  - [ ] New case: a brand-new post with an Instagram-shaped `postUrl` (no `originalPostUrl`) persists `platformPostId`/`platformPostType` correctly (read back from the DB, not just the returned object).
  - [ ] New case: a brand-new post whose `postUrl` cannot be parsed persists both columns as `null`.
  - [ ] New case: re-persisting an **existing** `postUrl` (dedupe/backfill path) whose original insert happened to leave these columns `null` must **still** leave them `null` after the second call — even though the second call's input URL would now parse successfully — proving the no-backfill rule (AC2) is enforced, not merely untested.
  - [ ] New case extending the existing dual-lookup test (d): confirm `originalPostUrl` wins over a differently-shaped `postUrl` when both are present and parseable (the priority rule from Task 2).

- [ ] **Task 5 — Verification** (AC: 1, 2, 3, 4)
  - [ ] `pnpm --filter @festgrid/domain test` — 100% coverage on the new parser (no coverage tool is wired into this `tsx --test` script today beyond the project's qualitative-but-complete-branch-mapping convention already used by `parse-image-url-expiry.test.ts`; make sure every branch enumerated in Task 2's test list has a named case).
  - [ ] `pnpm --filter @festgrid/backend test` — the extended `persist-scraped-post.test.ts` integration suite (requires the local native Windows Postgres `postgresql-x64-18` service running, migration from Task 1 applied).
  - [ ] `pnpm --filter @festgrid/database build && pnpm --filter @festgrid/backend build` (or the repo's equivalent `turbo`-driven build/typecheck) — confirm the new Drizzle columns typecheck cleanly through to `persist-scraped-post.ts`'s inferred `posts` row type with no manual type authoring needed.

## Dev Notes

- This story is a pure backend/database change: a Drizzle migration (two new nullable `posts` columns) plus a new pure parser in `packages/domain`, wired into one existing backend function. There is no React code, no new UI, no new hook, no new route, and nothing from this story is exposed through GraphQL yet — the columns are internal data captured once for Stories 3.7g (slug construction) and 3.7h (DB-free oEmbed resolution) to read later, not rendered or queried by anything in this story's own scope.
- Source tree components touched: `packages/database/schema.ts` + a new migration file (Task 1); `packages/domain/src/scraper/parse-platform-post-identity.ts` (+ `.test.ts`) and `packages/domain/src/scraper/index.ts` (Task 2); `apps/backend/src/lib/posts/persist-scraped-post.ts` + its existing `.test.ts` (Tasks 3-4). No other caller of `persistScrapedPost()` (`process-apify-async-result.ts`, `process-brightdata-result.ts`, `process-scrape-job.ts`, `replay-actor-run.ts`) needs any change — the new fields are derived internally from the already-passed `postUrl`/`originalPostUrl` parameters, not new function parameters.
- Testing standards: `packages/domain`'s 100%-unit-coverage rule applies in full to the new parser (`tsx --test`, matching `parse-image-url-expiry.test.ts`'s style exactly — no Vitest, no mocks needed, it's a pure function). `apps/backend`'s testing-trophy convention applies to the `persist-scraped-post.ts` integration-test additions (real local Postgres, no mocking of the DB layer, matching the existing suite's own style).

### Architecture & UX Gate Findings

**Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness): cited from the batch-scoped sweep, not re-run.** `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` explicitly includes `3.7f`, dated 2026-10-01) already evaluated this exact story and verdicted it **READY**: *"Pure parser addition, well-scoped, 100%-coverage AC already present"* (per-story verdicts table). None of that report's three corrections (0.i2c/callGemini timeout, 3.6t queue-ordinal default, 3.6v redirect handling) touch this story's scope at all — all three are about the extraction/ingestion/matching pipeline and the event-detail route, none about post-persistence-time parsing.

**Lightweight guard (per this workflow's own instruction to not silently trust an epic-wide sweep when a story's specific scope might contain something the sweep didn't anticipate):** checked whether 3.7f introduces anything the batch sweep's evidence-gathering wouldn't have covered — a new external service, a new data entity/table, or a new infra dependency. It does not: both new columns live on the **existing** `posts` table (no new table), the parser calls **no** external/network service (pure string/URL parsing, same shape as the already-covered `parseImageUrlExpiry`), and no new AWS resource, queue, or IaC is introduced — `persistScrapedPost()` already runs inside the existing `ScrapingQueue` consumer Lambda path (`process-apify-async-result.ts` et al.), unchanged by this story. No fresh Gate 1/3 run is warranted; the cited sweep's verdict stands.

**Gate 2 (UI Complexity & Reusability) — run fresh via `runSubagent` (Freya's lens), per this workflow's requirement that Gate 2 always stays per-story.** Evidence supplied directly in the subagent prompt (not re-fetched by the subagent itself): the full `design-artifacts/UX-festgrid-run-1/DESIGN.md` (228 lines) was checked and contains zero tokens for any post-scrape-time concept; `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s dedicated "Multi-Event Posts and Cross-Post Event Matching (CC-024)" section was checked in full and documents UI/UX only for the downstream-consuming stories (3.6u/3.6v/3.6w/3.6x) — it treats the AD-16 slug scheme as already-available data by the time any UI touches it, with no visual/interaction detail attached to the scrape-time capture step itself. **Verdict: NO GAP** against all three Gate 2 trigger heuristics — no reusable component (nothing is rendered), no complex hook/React util (the new parser is a pure, stateless, non-React function correctly placed in `packages/domain` per the package-boundary rule, not a UI-reusability question), and no UX-artifact-specified visual/interaction detail is missing from the draft scope. Full reasoning preserved in the subagent's response (run 2026-10-01, agent id `adcfbc7ba35329e4c`).

**No prerequisite story, `epics.md` addition, or new `sprint-status.yaml` entry results from this story's gates.**

### Reusable domain logic (packages/domain)

Per project-context.md's Code Organization rule, `parsePlatformPostIdentity()` is reusable, framework-agnostic parsing logic and belongs in `packages/domain`. It is **not** DB/ORM/Node-coupled (no `drizzle-orm` import, no `fs`/`net`/`dotenv`, just `URL`/`string`/`RegExp`), so it stays safely importable by a future frontend consumer in principle, matching `parseImageUrlExpiry()`'s own posture exactly. It is **not** a generic cross-entity mechanism (it is Instagram-permalink-shape-specific, same category as `parseImageUrlExpiry`'s own CDN-expiry-param-specific logic) — it belongs directly in the existing `packages/domain/src/scraper/` folder alongside its sibling, not a new generic subfolder.

### Cloud/external service setup (SETUP_WALKTHROUGH.md)

Not applicable. No new cloud/external service, credential, or environment variable is introduced — this story only adds two nullable DB columns and a pure in-process parser.

### Reusable UI component (packages/ui)

Not applicable. This story has zero UI/React surface (confirmed by Gate 2 above).

### Analytics (AD-5) / i18n (AD-6)

Not applicable. No new PostHog event (no user interaction exists in this story's scope to track) and no user-facing string anywhere in this story (backend/domain only, no locale keys needed).

### AD-1/AD-2 Unified Query DSL

Not applicable. This story adds no event-collection retrieval and no new query endpoint — it is a write-path enrichment on an existing `persistScrapedPost()` insert, not a read path.

### State management / loader categorization

Not applicable — no React code, so none of Server State (React Query) / URL State (nuqs) / Client Global State (zustand), and none of the Blocking/Non-Blocking loader categories, apply.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No pre-existing mismatch to fix. This story *introduces* new nullable columns that must stay aligned across exactly two layers this story touches (DB + the `packages/domain` parser's own return type) — it deliberately does **not** touch a third layer (GraphQL) at all yet, since nothing in this story's scope is read back through a resolver.
- **Impacted fields/contracts:**
  - New DB: `posts.platform_post_id` (`text`, nullable), `posts.platform_post_type` (`text`, nullable).
  - New TypeScript: `parsePlatformPostIdentity()`'s own input/output shape in `packages/domain`; Drizzle's inferred `posts` select-row type picks up the two new nullable `string | null` fields automatically (no manual interface edit anywhere else needed — confirmed by how the existing `imageUrlExpiresAt`/`additionalImageUrls` columns already flow through `persist-scraped-post.ts`'s return value with zero manual typing).
  - **Deliberately unchanged:** `packages/domain/src/scraper/types.ts`'s `ScrapedPost` interface (the scraper-adapter's own output shape) is **not** modified — `platformPostId`/`platformPostType` are *derived at persist time* from fields (`postUrl`/`originalPostUrl`) that already exist on `ScrapedPost`, not new scraped input data. Adding them to `ScrapedPost` would incorrectly imply the scraper adapter itself produces them.
  - **Deliberately unchanged:** no GraphQL schema/resolver change — `Post`/`Event` GraphQL types do not expose these columns in this story. (Whether/how Story 3.7g or 3.7h expose anything derived from them is each of those stories' own concern.)
- **Required DB migration changes:** `pnpm --filter @festgrid/database generate` (Drizzle-kit) after the `schema.ts` edit (Task 1) produces the migration SQL; checked into `packages/database/migrations/`, following Architecture Spine AD-3.
- **Required TypeScript type changes:** none beyond the new parser file itself (Task 2) — no manual interface/type authoring anywhere else, per the bullet above.
- **Backward compatibility and rollout notes:** Purely additive and non-breaking. Both new columns are nullable with no `NOT NULL`/`DEFAULT`, so every existing row and every existing query/insert that doesn't reference them is entirely unaffected. No coordinated deploy ordering is required for this story in isolation; Stories 3.7g/3.7h (which *read* these columns) are already recorded as depending on this story shipping first (epics.md's "Depends on: Story 3.7f").
- **Verification checks:** Task 2's 100% domain-parser unit coverage; Task 4's integration tests (including the explicit no-backfill-on-dedupe regression case); Task 5's cross-package build/typecheck.

### Project Structure Notes

- Aligns with the unified project structure: `packages/domain/src/scraper/` for the pure parser (joining `parse-image-url-expiry.ts`, `platform-registry.ts`, etc. already there), `apps/backend/src/lib/posts/` for the backend-only persistence glue that calls it, `packages/database/schema.ts` + `migrations/` for the DDL. No `packages/ui` involvement (no UI in this story).
- No detected conflicts or variances from existing convention.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7f: Capture each post's platform post id and permalink type at scrape time] — authoritative ACs and the 2026-10-01 CC-024 carve-out Note this story elaborates.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7g, line ~3577; Story 3.7h] — the two immediate downstream consumers this story's columns exist for.
- [Source: _bmad-output/planning-artifacts/epics.md line ~1625] — `Post.originalPostUrl` ("the real source link, when derivable") vs `Post.postUrl` ("the post as actually scraped, which may be a proxy/mirror site") semantics, the basis for Task 2's priority ordering.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-16, Rule 2 (lines 525-539)] — the binding rule this story implements: capture the real permalink type at post-scrape time, never assume one; new sibling parser alongside `parseImageUrlExpiry()`.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-16, Rules 8-12 (CC-024 amendment, lines 578-609)] — confirms Rules 2-7 (including this story's Rule 2) are "not yet built... IDEA-028 owns them," and that Rules 8-12 (ordinal suffix, alias redirects — Stories 3.6t/3.6v) build on top of this story's work; not otherwise in scope here.
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 batch sweep citation (per-story verdicts table: 3.7f = READY).
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts] — the exact function and its two branches (existing-row backfill vs new-row insert) this story's AC2 no-backfill rule constrains.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.test.ts, test (d)] — the dual-lookup fixture (`proxy1.com`/`instagram.com` URLs) informing Task 2's priority-ordering test.
- [Source: packages/domain/src/scraper/parse-image-url-expiry.ts, .test.ts] — the exact sibling-file style/convention this story's new parser and its tests follow.
- [Source: packages/domain/src/scraper/platform-registry.ts] — `getPlatformSlug()`/`getPlatformByCode()`/`detectPlatformFromUrl()`, confirmed **not** called by this story's parser (shape-based, not hostname-based matching) — see Task 2's reasoning.
- [Source: packages/database/schema.ts#L275-311 (posts table)] — exact column list/conventions this story's two new columns join.
- [Source: packages/database/migrations/0058_nice_liz_osborn.sql, 0059_dapper_doctor_strange.sql, meta/_journal.json] — recent nullable-column-add migration shape/naming precedent (latest migration is `0061_brief_killraven.sql`; this story's migration is `0062_...`).
- [Source: _bmad-output/project-context.md#Critical Implementation Rules > API & Data, #Code Quality & Style Rules > Code Organization, #Testing Rules] — the slug-mechanism naming/registry rule, `packages/domain` purity rule, and the 100%-domain-coverage rule.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions, the epic-level sweep-mode citation rule, and the lightweight-guard instruction applied above.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/domain` purity, no DB/Node coupling), Testing Rules (100% domain coverage), AD-3-aligned migration rule, and the "never a new platform mapping" slug-mechanism rule all directly govern this story; consulted and cited above.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows its canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-16 Rule 2, read together with the CC-024 Rules 8-12 amendment; AD-3 for the migration mechanism) — the binding rule this story implements.
- [x] `docs/infrastructure/index.md` (§3 Database) — this story touches backend compute only via an existing Lambda's existing DB connection (no new infra topology: no new queue, no new Lambda, no new provisioning); the index-level summary is sufficient per this workflow's own infra-read rule, since no shard-level detail beyond what's already cited from project-context.md's Connection Pooling rule applies here.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/database/schema.ts` — add `platformPostId`/`platformPostType` nullable `text` columns to the `posts` table (after `originalPostUrl`).
  - `packages/database/migrations/0062_<generated-name>.sql` (+ `meta/_journal.json` entry) — generated via `drizzle-kit generate`, not hand-written.
  - `packages/domain/src/scraper/parse-platform-post-identity.ts` (NEW) — pure parser, `{ postUrl?, originalPostUrl? } → { platformPostId: string | null, platformPostType: string | null }`.
  - `packages/domain/src/scraper/parse-platform-post-identity.test.ts` (NEW) — 100% branch coverage, cases enumerated in Task 2.
  - `packages/domain/src/scraper/index.ts` — add the new export line.
  - `apps/backend/src/lib/posts/persist-scraped-post.ts` — call the new parser on the insert path only; spread its result into `insertValues`.
  - `apps/backend/src/lib/posts/persist-scraped-post.test.ts` — add the four new cases from Task 4.
- **Rule Mapping:**
  - AD-16 Rule 2 → Tasks 1-3 (columns + parser + insert-time-only population).
  - AD-16 Rule 2's "never re-parsed or deferred to event-creation time" → the parser runs inside `persistScrapedPost()` itself, not inside `buildEventInsertValues()` (that's Story 3.7g's own concern, which only *reads* these already-populated columns).
  - AD-3 (Database Schema Management) → Task 1's Drizzle-kit-generated migration, checked into the repo.
  - project-context.md Code Organization (packages/domain purity, no DB/Node coupling) → Task 2's parser location and dependency-free implementation.
  - project-context.md Testing Rules (100% domain coverage) → Task 2's test list; Task 5's verification.
  - AD-12 Rule 5 precedent ("fix-going-forward only") → AC2 / Task 3's explicit no-backfill constraint on the existing-row branch.
  - "Platform codes come only from platform-registry.ts, never a new mapping" (AC3) → satisfied by introducing *no* platform/hostname mapping at all in the new parser (shape-based matching only) — see Task 2 and the dedicated Dev Notes subsection.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — new parser's 100% coverage.
  - `pnpm --filter @festgrid/backend test` — extended `persist-scraped-post.test.ts` (requires local Postgres `postgresql-x64-18` service running, migration applied).
  - `pnpm --filter @festgrid/database build && pnpm --filter @festgrid/backend build` — typecheck confirms the new columns flow through with no manual type edits needed.
  - Manual: `psql`/`drizzle-kit studio` spot-check that the generated migration is exactly two nullable `ADD COLUMN` statements with no `NOT NULL`/`DEFAULT`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation (two new nullable `posts` columns + one new pure domain parser + its wiring into `persistScrapedPost()`'s insert-only path; no other caller, no GraphQL exposure, no UI)
- [ ] Architecture and boundary confirmation (AD-16 Rule 2 compliance; `packages/domain` purity; no new platform mapping)
- [ ] Testing plan confirmation (100% domain-parser coverage; integration tests including the no-backfill regression case)
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from `batch-cc-024-multi-event-readiness.md` (verdict READY, no corrections applicable to this story); Gate 2 run fresh (NO GAP, 2026-10-01). No gap exists to accept.

## Testing Requirements

- [ ] Unit tests (100% coverage, `packages/domain`'s `parsePlatformPostIdentity()` — Task 2's enumerated cases)
- [ ] Integration tests (`apps/backend`'s `persist-scraped-post.test.ts` — Task 4's four new cases, against the real local Postgres DB)
- [ ] E2E tests — not applicable; this story has no user-facing surface to exercise end-to-end.

## Deliverables Checklist

- [ ] `posts.platform_post_id` / `posts.platform_post_type` columns added (nullable, no default) via a generated, reversible Drizzle migration
- [ ] `parsePlatformPostIdentity()` added to `packages/domain/src/scraper/`, exported from its `index.ts`, with 100% unit-test coverage
- [ ] `persistScrapedPost()`'s insert path populates both new columns; its existing-row/backfill path is unchanged and verified to never write them
- [ ] All new/extended tests passing locally against the local native Windows Postgres DB

## Out of Scope

- Building the event slug from these columns (`events.slug` construction) — Story 3.7g.
- Resolving the Instagram oEmbed from the event slug without a DB lookup — Story 3.7h.
- Any GraphQL schema/resolver exposure of `platformPostId`/`platformPostType` — not required by any AC in this story; left to whichever later story first needs to read them through the API, if any.
- Backfilling existing `posts` rows — explicitly excluded by AC2 (fix-going-forward only).
- No gap was found by any of Gate 1, 2, or 3 for this story, so no new prerequisite story/backlog entry is introduced here (see Architecture & UX Gate Findings above).

## Definition of Done

- [ ] AC1-AC4 satisfied
- [ ] Required unit and integration tests passing (Testing Requirements above)
- [ ] Lint and type checks passing for `packages/database`, `packages/domain`, and `apps/backend`

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-10-01 — Story created via `bmad-create-story` (Gate 1/3 cited from `batch-cc-024-multi-event-readiness.md`; Gate 2 run fresh, NO GAP). Part of CC-024 (Multi-event posts and cross-post event matching) Wave 2A, carved out of IDEA-028 (platform-prefixed event slugs).
