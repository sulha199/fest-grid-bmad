---
baseline_commit: df9de138c4dfe581adbe34c16ade6eea491541e7
---

# Story 3.7g: Build platform-prefixed event slugs at ingestion

## Story Details

- Epic: 3
- Story ID: 3.7g
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want an event's URL to name the platform post it came from (e.g. `ig_p_Cx9uWttkSN`),
so that links are readable and the embed can be resolved from the URL alone.

## Acceptance Criteria

1. **Given** Architecture Spine AD-16 Rules 1, 3 and 4, **when** `buildEventInsertValues()` (`packages/domain/src/events/build-event-insert-values.ts`) builds an event whose source post has `platformPostId`/`platformPostType`, **then** `events.slug` is `{platformSlug}_{postType}_{platformPostId}` (e.g. `ig_p_Cx9uWttkSN`); slug generation for this case moves out of `schema.ts`'s `$defaultFn`; the function only reads the already-populated columns passed to it and performs no URL parsing of its own.
2. **And** an event with no resolvable platform post (post row not found, or its `platformPostId`/`platformPostType` are null, or its `platform` doesn't resolve via `getPlatformSlug()`) keeps the legacy `randomBytes(6).toString('hex')` slug unchanged and unambiguous by shape — produced by the existing `events.slug` `$defaultFn`, not duplicated/reimplemented anywhere else.
3. **And** existing events keep their hex slugs (no backfill). Parsing the new form back apart (splitting on the first two `_` only) is Story 3.7h's concern, not this story's — this story only ever *constructs* the slug, never parses one back.
4. **And** this story builds only the **base** slug (ordinal 0, no suffix). The `-{ordinal}`/`~{ordinal}` suffix for further events extracted from one post is added by Story 3.6t; re-slugging with an alias on a primary-post change is added by Story 3.6v (AD-16 amendment, AD-30). Neither is built or anticipated by this story.
5. **And** `prd.md`'s slug description (§4.1, §4.4, §8.2) is re-verified to already correctly describe this scheme and the legacy-hex fallback (not "Nano ID") — confirmed already corrected by the 2026-10-01 CC-024 PRD update (commit `793e1f34`); this story does not need to edit `prd.md` again, only to verify it stayed correct.

## Tasks / Subtasks

- [x] Task 1 — Domain types (AC: 1, 2, 4)
  - [x] In `packages/domain/src/events/types.ts`, add an `EventSourcePostIdentity` interface: `{ platform: string; platformPostId: string | null; platformPostType: string | null }` — a plain, DB/ORM-decoupled shape (deliberately **not** `typeof posts.$inferSelect`), with a comment explaining why (packages/domain must stay decoupled from `@festgrid/database`'s Drizzle types per project-context.md's Code Organization rule).
  - [x] Add `slug?: string` to `EventInsertValues` (optional — present only when a platform-derivable slug was built; omitted otherwise so Drizzle's existing `$defaultFn` fires, see Task 2).
- [x] Task 2 — Slug construction in `buildEventInsertValues()` (AC: 1, 2, 4)
  - [x] Add a private helper (e.g. `buildPlatformPrefixedSlug(sourcePost: EventSourcePostIdentity | null): string | undefined`) in `build-event-insert-values.ts` that: returns `undefined` when `sourcePost` is `null` or either `platformPostId`/`platformPostType` is `null`; otherwise resolves `getPlatformSlug(sourcePost.platform as ScrapablePlatform)` (`packages/domain/src/scraper/platform-registry.ts` — **never** a new platform-code mapping) and returns `undefined` if that lookup itself is falsy (unsupported/unrecognized platform value — never guess); otherwise returns `` `${platformSlug}_${sourcePost.platformPostType}_${sourcePost.platformPostId}` ``. No ordinal suffix (AC4) — this function only ever produces the ordinal-0 form.
  - [x] Change `buildEventInsertValues`'s signature to `buildEventInsertValues(message: ExtractedEventMessage, sourcePost: EventSourcePostIdentity | null)`. Compute `const slug = buildPlatformPrefixedSlug(sourcePost);` and **conditionally** add the `slug` key to the returned `event` object only `if (slug !== undefined)` — do **not** unconditionally write `slug: slug` into the object literal, since that would add an enumerable `slug: undefined` key even on the fallback path, which (a) breaks every existing test's `deepStrictEqual` comparison and (b) — more importantly — Drizzle's insert builder only triggers a column's `$defaultFn` when `value[fieldName] === undefined`, which is true whether the key is physically absent or present-with-`undefined`, so omitting the key is the correct, minimal way to delegate to the existing fallback (verified directly against the installed `drizzle-orm@0.30.10` dialect source, `pg-core/dialect.js` ~line 336: `if (colValue === void 0) { if (col.defaultFn !== void 0) { … } }`).
- [x] Task 3 — Thread the source post into the ingestion pipeline (AC: 1, 2)
  - [x] In `apps/backend/src/lib/ingestor/process-ingestion-job.ts`, inside the existing `db.transaction(async (tx) => { … })` callback, before building insert values: `const [sourcePost] = await tx.select({ platform: posts.platform, platformPostId: posts.platformPostId, platformPostType: posts.platformPostType }).from(posts).where(eq(posts.id, message.postId)).limit(1);` then call `buildEventInsertValues(message, sourcePost ?? null)` (moved inside the transaction callback, since it now depends on a DB read that must see a consistent view alongside the insert). Add the needed `posts` import from `@festgrid/database` (alongside the existing `events, schedules` import) and `eq` from `drizzle-orm`.
  - [x] Do **not** change `ProcessingJobMessage`, `ExtractedEventMessage`, `transformGeminiResponseToEventInfo`, or `processAiJob` — this story's data path is confined to `process-ingestion-job.ts` reading the `posts` row directly, per the user's explicit decision below (see Dev Notes "Design decision").
- [x] Task 4 — Schema comment only, no migration (AC: 1)
  - [x] In `packages/database/schema.ts`, update the comment above `events.slug` (currently referencing Story 3.7g in the `platformPostId`/`platformPostType` comment on `posts`) to also note, next to `events.slug`'s own definition, that `$defaultFn(generateSlug)` is now exercised only as the no-resolvable-platform-post fallback (Rule 4) — the primary, platform-derivable path is built by `buildEventInsertValues()` (Story 3.7g). Do **not** remove or modify `$defaultFn(generateSlug)` itself — Task 2 only ever omits the `slug` key for Drizzle to fall back to it unchanged, exactly as AC2/AD-16 Rule 4 ("unchanged, not new code") requires.
  - [x] Run `pnpm --filter @festgrid/database generate` and confirm it produces **no** new migration file (a comment-only TS change has zero DDL effect) — this is the verification that Task 4 stayed comment-only.
- [x] Task 5 — Unit tests, `packages/domain` (AC: 1, 2, 4) — 100%-coverage rule
  - [x] Update all existing `buildEventInsertValues(message)` calls in `build-event-insert-values.test.ts` to pass the new required second argument, `null`, for every case that isn't specifically testing slug behavior (these cases don't set `sourcePost`, so they must keep asserting no `slug` key appears in `result.event` — i.e. `assert.strictEqual('slug' in result.event, false)` or equivalent, not a `deepStrictEqual` that would need an explicit `slug: undefined`).
  - [x] Add new cases: (a) `sourcePost` with `platform: 'instagram', platformPostId: 'Cx9uWttkSN', platformPostType: 'p'` → `result.event.slug === 'ig_p_Cx9uWttkSN'`; (b) same with `platformPostType: 'reel'` → `'ig_reel_Cx9uWttkSN'` (verifies `reel`/`reels` are carried verbatim, never normalized, per AD-16 Rule 2); (c) `sourcePost` with `platformPostId: null` (URL unparseable at scrape time) → no `slug` key; (d) `sourcePost: null` (post row not found) → no `slug` key; (e) `sourcePost` with an unrecognized `platform` string (e.g. `'tiktok'`, not yet in `getPlatformSlug()`'s map) → no `slug` key, never a guessed value.
- [x] Task 6 — Integration tests, `apps/backend` (AC: 1, 2)
  - [x] In `process-ingestion-job.test.ts`, add a new seeded post that sets `platformPostId`/`platformPostType` (e.g. `platformPostId: 'Cx9uWttkSN', platformPostType: 'p'`) and assert the resulting `insertedEvent.slug === 'ig_p_Cx9uWttkSN'`.
  - [x] Strengthen the two existing happy-path cases (which seed posts without `platformPostId`/`platformPostType`, i.e. null) to explicitly assert the resulting `insertedEvent.slug` matches the legacy hex shape `/^[0-9a-f]{12}$/` — locks in AC2's "unambiguous by shape, unchanged" behavior, not just that *some* slug exists.
  - [x] Run this suite with `TZ=UTC` and a clean `seed:volume:clean` state first (per `cc-024-multi-event-wave-plan.md`'s "Test-gate facts learned while orchestrating Wave 2A" — unrelated pre-existing failures: a timezone-dependent fixture and a `.env`-dependent `system-key-adapter` suite — are expected and not caused by this story; do not chase them).
- [x] Task 7 — PRD verification (AC: 5)
  - [x] Re-read `prd.md` §4.1 (`EventInfo.slug`, lines ~420-433), §4.4 (`Schedule.slug`, lines ~635-641), and §8.2 (custom-slug premium feature, line ~1600). Confirm each already describes the platform-prefixed scheme / legacy-hex fallback correctly (already corrected 2026-10-01, commit `793e1f34` — verified during story creation, see Dev Notes). No edit expected; if drift is found, fix it and note it in Completion Notes.

## Dev Notes

### Design decision (resolved with the user before this story was drafted)

`ExtractedEventMessage` (the `DataIngestionQueue` payload `buildEventInsertValues()` already receives) carries neither `platform` nor `platformPostId`/`platformPostType` today, and `processIngestionJob` never queries the `posts` table. Two designs were possible: (A) have `process-ingestion-job.ts` look up the `posts` row itself and pass the three plain fields into `buildEventInsertValues()` as a new second argument, or (B) thread the fields through both queue messages end-to-end (`ProcessingJobMessage` → `processAiJob` → `transformGeminiResponseToEventInfo`'s context → `ExtractedEventMessage`).

**The user chose (A).** Rationale: it confines this story's change to the `3.7f → 3.7g` dependency chain (`posts` table → `process-ingestion-job.ts` → `buildEventInsertValues()`) with zero risk to the already-complex `AIProcessingQueue` leg (`processAiJob`, `transformGeminiResponseToEventInfo`) that this story has no other reason to touch, at the cost of one extra `SELECT` inside the ingestion transaction (write path, not the hot GraphQL read path AD-17 is protective of). This also matches AD-16 Rule 3's own framing — `buildEventInsertValues()` "already runs after the source post is known and simply reads that post's already-populated columns" — i.e. the caller looks the post up; the pure function just reads what it's given. Do not revisit this without re-reading this note; Task 3 implements (A) only.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency):** Not re-run per-story. Cited from `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (batch-scoped sweep over this epic's CC-024 stories, `swept: true`, 2026-10-01), whose per-story verdict table lists **3.7g: READY — "Depends on 3.7f; AD-16 Rules 1/3/4 fully specify it."** No prerequisite story was raised against 3.7g. Lightweight escape-hatch check performed during this story's drafting: this story's actual implementation needs (a DB lookup inside an existing transaction, a new plain decoupled type, a conditional-key insert pattern) are implementation-level choices within the scope the sweep already covered (the `posts`/`events` ingestion path) — not a new external service, new data entity, or new infra dependency the sweep didn't anticipate. No fresh Gate 1/3 run was triggered.
- **Gate 2 (UI Complexity & Reusability):** Run fresh for this story (one-shot analytical pass, Freya/Sally lens) since Gate 2 stays per-story even when Gate 1/3 are sourced from the batch report. Verdict: **No gap found** — this story touches zero files under `apps/web` or `packages/ui`, introduces no new component, hook, or client-visible state, and changes only a backend-generated identifier string embedded into an existing, unmodified route pattern (`/events/{slug}`). There is no UI surface for Gate 2 to evaluate.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** `EventInsertValues` (packages/domain) gains an optional `slug?: string` field with no corresponding change to the `events` table's DB-level definition — `events.slug` is already `text('slug').$defaultFn(generateSlug).unique().notNull()` and stays exactly that; nothing about its SQL type, nullability, or constraints changes.
- **Impacted fields/contracts:** `EventInsertValues.slug` (new, optional, TS-only). No GraphQL contract changes — `Event.slug: String!` is unaffected since the DB column is always populated (either explicitly by `buildEventInsertValues()` or by the unchanged `$defaultFn` fallback) by the time any query can read it.
- **Required DB migration changes:** None. `schema.ts`'s `events.slug` column definition itself is not edited (only a clarifying comment is added, Task 4) — `$defaultFn` is a client-side Drizzle behavior, not a DB-level `DEFAULT` constraint, so even a real change there would produce zero DDL diff; Task 4 verifies this explicitly by running `drizzle-kit generate` and confirming no new migration file.
- **Required TypeScript type changes:** `packages/domain/src/events/types.ts` — add `EventSourcePostIdentity` (new) and `EventInsertValues.slug?: string` (new optional field), as detailed in Task 1.
- **Backward compatibility and rollout notes:** Existing events' hex slugs are never touched (AC3, no backfill). Any post whose `platformPostId`/`platformPostType` predate Story 3.7f (i.e. are still `null` on an old, already-scraped-but-not-yet-extracted `posts` row, since 3.7f does not backfill either) naturally falls into the "no resolvable platform post" path and gets the legacy hex slug — exactly the same outcome as today, so there is no deploy-ordering hazard between 3.7f and 3.7g beyond the already-stated dependency.
- **Verification checks:** Task 5's new unit tests (exact slug string match for the platform-derivable case; absence of the `slug` key for every non-derivable case) and Task 6's new/strengthened integration tests (real DB round trip asserting the inserted row's actual `slug` column value) prove end-to-end alignment. Task 4's `drizzle-kit generate` run proves the schema.ts comment edit produced no DDL drift.

### Project Structure Notes

- `packages/domain/src/events/build-event-insert-values.ts` and `types.ts` — both already exist and already export via `packages/domain/src/events/index.ts`'s `export *`; no new file, no new export statement needed beyond what changing the existing interfaces/functions already covers.
- New cross-folder import inside `packages/domain`: `events/build-event-insert-values.ts` will import `getPlatformSlug` from `../scraper/platform-registry.js` and `ScrapablePlatform` from `../subscriptions/platforms.js`. This is an established pattern already used in the reverse direction elsewhere in the package (e.g. `ai-event-filters/*.ts` importing from `../events/buildEventsQueryCondition.js`) — not a new convention.
- No new files are created by this story; every touched file already exists.
- **Reusable mechanism check (packages/domain):** The slug-building logic is domain business logic with no DB/ORM/Node-only dependency (it takes plain strings and returns a plain string or `undefined` — confirmed it must NOT import `@festgrid/database`'s Drizzle schema types or Node's `crypto` module; see the "no Node `crypto` in packages/domain" reasoning below). It correctly belongs in `packages/domain/src/events/` (entity-specific, not a generic cross-entity mechanism, so no `packages/domain/src/query/`-style generic subfolder is warranted).
- **Why the legacy-hex fallback does *not* move into `packages/domain`:** `packages/domain` is imported directly by `apps/web` (verified: `grep -rl "@festgrid/domain" apps/web/src` returns 20+ files) as well as `apps/backend`, so per project-context.md's Code Organization rule it must stay free of Node-runtime-only dependencies (e.g. Node's `crypto` module, which `randomBytes` requires and which is not available unpolyfilled in a browser bundle) even though the rule only guarantees backend-safety in principle — in this codebase it is also actually imported by the frontend today. This is exactly why Task 2's design keeps the legacy-hex generator inside `schema.ts`'s existing `$defaultFn` (Node-only, but `schema.ts`/`packages/database` is backend-only and already uses `crypto` today) rather than duplicating or relocating it into the pure domain function.
- **Reusable UI component (packages/ui) / cloud or external service setup (SETUP_WALKTHROUGH.md) / analytics (AD-5) / i18n (AD-6) / AD-1/AD-2 Unified Query DSL / state management or loader categorization:** None apply — this story has no UI surface, no new cloud/external service, no tracked user interaction, no user-facing string, and does not retrieve an event collection by a new condition.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7g: Build platform-prefixed event slugs at ingestion] (lines 3563-3577)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7f: Capture each post's platform post id and permalink type at scrape time] (lines 3546-3561) — prerequisite, done (commit `90dae6d9`)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-16: Platform-Prefixed Event Slugs & Parallel oEmbed Resolution] (lines 496-627), specifically Rules 1-5 and 7 (Rules 8-12 are the AD-30/CC-024 ordinal/alias amendment, owned by Stories 3.6t/3.6v — explicitly out of scope here per AC4)
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 batch sweep, 3.7g verdict: READY
- [Source: _bmad-output/project-context.md#Unique Identifiers (Database UUIDs & Slugs)] and [#Code Organization (Domain vs UI)]
- [Source: packages/database/schema.ts] lines 275-316 (`posts`, incl. `platformPostId`/`platformPostType` added by 3.7f), lines 340-372 (`events`, incl. `slug` `$defaultFn`)
- [Source: packages/domain/src/events/build-event-insert-values.ts], [Source: packages/domain/src/events/types.ts], [Source: packages/domain/src/scraper/platform-registry.ts], [Source: packages/domain/src/scraper/parse-platform-post-identity.ts] (3.7f's parser — confirms `posts.platformPostId`/`platformPostType` really are populated at scrape time today)
- [Source: apps/backend/src/lib/ingestor/process-ingestion-job.ts] (current single-argument call site to be updated)
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md] lines 420-433, 635-641, 1600 (already-corrected slug description, verification only)
- [Source: docs/infrastructure/2-backend.md] line 17 (`DataIngestionQueue` description — unchanged by this story, no infra/topology change)

## Global Rules References

- [x] project-context.md — Unique Identifiers (Database UUIDs & Slugs); Code Organization (Domain vs UI, incl. the DB/ORM/Node-dependency restriction)
- [x] story-content-structure.md — canonical section order followed
- [x] architecture spine — AD-16 (Rules 1, 3, 4; Rules 8-12 explicitly out of scope, AC4)
- [x] infrastructure docs — docs/infrastructure/2-backend.md (DataIngestionQueue, confirmed unchanged)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/domain/src/events/types.ts` — add `EventSourcePostIdentity`; add `EventInsertValues.slug?: string`.
  - `packages/domain/src/events/build-event-insert-values.ts` — add `buildPlatformPrefixedSlug()` helper; change `buildEventInsertValues()` to a 2-argument function; conditionally set `event.slug`.
  - `packages/domain/src/events/build-event-insert-values.test.ts` — update all existing calls to pass the new second argument; add 5 new cases (Task 5).
  - `apps/backend/src/lib/ingestor/process-ingestion-job.ts` — add `posts` row lookup inside the existing transaction; pass result into `buildEventInsertValues()`; add `posts` (from `@festgrid/database`) and `eq` (from `drizzle-orm`) imports.
  - `apps/backend/src/lib/ingestor/process-ingestion-job.test.ts` — add a platform-derivable-slug case; strengthen 2 existing cases to assert the legacy hex shape.
  - `packages/database/schema.ts` — comment-only update near `events.slug`; **no column/DDL change**.
  - `prd.md` — verification only (§4.1, §4.4, §8.2); edit only if drift is actually found.
- **Rule Mapping:**
  - AD-16 Rules 1/3/4 → Task 2 (`buildPlatformPrefixedSlug`) and Task 3 (data plumbing).
  - AD-16 Rule 4 "unchanged, not new code" → Task 2's conditional-key-omission design (never duplicates `randomBytes(6).toString('hex')`).
  - project-context.md Code Organization (no DB/ORM/Node deps in `packages/domain`) → `EventSourcePostIdentity` is a plain decoupled type (Task 1); the hex fallback stays in `schema.ts`, never moves into `packages/domain` (Dev Notes "Why the legacy-hex fallback does not move").
  - project-context.md's platform-registry single-source-of-truth rule → `buildPlatformPrefixedSlug()` calls `getPlatformSlug()`, never a new mapping (Task 2).
  - Testing Rules (100% domain coverage; testing-trophy for `apps/*`) → Tasks 5/6.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` (domain unit tests, `tsx --test`) — all existing + 5 new cases in `build-event-insert-values.test.ts` pass.
  - `pnpm --filter @festgrid/database generate` — confirm no new migration file is produced (proves Task 4 stayed comment-only).
  - `pnpm --filter backend test` (or the repo's run-check equivalent) with `TZ=UTC` and the volume seed cleaned (`pnpm --filter @festgrid/database seed:volume:clean`) first — `process-ingestion-job.test.ts`'s new and strengthened cases pass; the pre-existing, unrelated `TZ`/`.env` failures noted in `cc-024-multi-event-wave-plan.md` are expected and not this story's regression.
  - `pnpm --filter backend lint` / `pnpm --filter @festgrid/domain lint` / relevant `tsc` build — touched packages type-check and lint clean.
  - Manual sanity read of `prd.md` §4.1/§4.4/§8.2 confirming no drift (Task 7).

## Pre-Coding Approval Gate

- [x] Scope confirmation — builds only the base (ordinal-0) platform-prefixed slug in `buildEventInsertValues()`; no ordinal suffix, no re-slug/alias logic (those are 3.6t/3.6v).
- [x] Architecture and boundary confirmation — `packages/domain` stays DB/ORM/Node-dependency-free (no `@festgrid/database` import, no `crypto`); the legacy hex fallback stays in `schema.ts`'s `$defaultFn`, unduplicated.
- [x] Testing plan confirmation — Tasks 5/6 cover unit (100% domain) and integration (real-DB) coverage of both the platform-derivable and fallback paths.
- [x] Explicit human approval state — granted via the dev-story dispatch instruction (CC-024 Wave 2A), which restated and confirmed this exact scope/design (base-slug-only, no 3.6t/3.6v suffix/alias logic, the DB-lookup-in-transaction design) before coding began.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the CC-024 batch readiness report (no gap); Gate 2 run fresh this story (no gap); no prerequisite story needed.

## Testing Requirements

- [x] Unit tests (`packages/domain`, `tsx --test`, 100% coverage) — Task 5.
- [x] Integration tests (`apps/backend`, `tsx --test` against the real local Postgres) — Task 6.
- [x] E2E tests — N/A. No UI/user-facing flow changes; the only externally visible effect is the slug string embedded in a new event's existing, unmodified `/events/{slug}` route, which the existing event-detail E2E coverage does not assert a specific slug format against.

## Deliverables Checklist

- [x] `EventSourcePostIdentity` type and `EventInsertValues.slug?` field added in `packages/domain/src/events/types.ts`.
- [x] `buildEventInsertValues()` builds the base platform-prefixed slug when resolvable, omits `slug` otherwise, and takes the new `sourcePost` second argument.
- [x] `process-ingestion-job.ts` looks up the source post's `platform`/`platformPostId`/`platformPostType` inside its existing transaction and passes them through.
- [x] All existing and 5 new domain unit tests pass with 100% coverage of the new logic.
- [x] New and strengthened `apps/backend` integration tests pass against the real local Postgres.
- [x] `schema.ts` comment updated; `drizzle-kit generate` confirmed to produce no new migration.
- [x] `prd.md` §4.1/§4.4/§8.2 re-verified correct (or fixed if drift found).

## Out of Scope

- The `-{ordinal}`/`~{ordinal}` suffix for a post's 2nd+ extracted event (AD-16 Rule 8/9) — Story 3.6t.
- Re-slugging on a primary-post change and the `event_slug_aliases` redirect table (AD-16 Rules 10/11/12, AD-30) — Story 3.6v.
- Parsing a platform-prefixed slug back apart (for the DB-free oEmbed lookup) — Story 3.7h.
- Any multi-event/multi-post schema (`event_posts`, `extraction_ordinal`) — Story 3.6r.

## Definition of Done

- [x] AC1-AC5 satisfied.
- [x] Required tests passing (Tasks 5/6; Testing Requirements above).
- [x] Lint and type checks passing for `packages/domain`, `packages/database`, and `apps/backend`.

## Completion Status

- [x] Complete — Status: review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm --filter @festgrid/domain test` → 362/362 pass (20 suites), including the new `build-event-insert-values.test.ts` cases.
- `pnpm --filter @festgrid/domain build` (tsc) → clean.
- `pnpm --filter @festgrid/domain lint` (eslint, `--max-warnings 0`) → clean.
- `pnpm --filter @festgrid/database generate` → "No schema changes, nothing to migrate" — confirms Task 4's `schema.ts` edit was comment-only, zero DDL effect.
- `pnpm --filter @festgrid/database test` (vitest) → 10/10 pass (unaffected by this story; run to confirm no regression).
- `pnpm --filter @festgrid/database seed:volume:clean` run before the backend test, per the dispatch instruction's known environment fact.
- `TZ=UTC npx tsx --test src/lib/ingestor/process-ingestion-job.test.ts` (cwd `apps/backend`) → 5/5 pass (4 subtests under the parent test), including the new platform-prefixed-slug case and the two strengthened legacy-hex-shape assertions.
- `pnpm lint` (repo root, unfiltered, all 8 packages) → 8/8 tasks pass (pre-existing `apps/web` `no-explicit-any`/unused-var warnings only, unrelated to this story, zero errors).
- `pnpm build` (repo root, unfiltered, all 8 packages) → 8/8 tasks pass, exit 0.
- Per the dispatch instruction, the repo-wide `pnpm test` (~10 min) was deliberately NOT run; verification was scoped to this story's own tests (`packages/domain`, `apps/backend` ingestion test, `packages/database`) plus the mandatory unfiltered repo-root `lint`/`build`.

### Completion Notes List

- Implemented AD-16 Rules 1/3/4 platform-prefixed event slug construction exactly per the story's pre-decided design (Dev Notes "Design decision," option A): `process-ingestion-job.ts` looks up the `posts` row inside its existing `db.transaction` callback and passes a plain `EventSourcePostIdentity` into `buildEventInsertValues()`'s new second argument — `ExtractedEventMessage`/`transformGeminiResponseToEventInfo`/`processAiJob` were not touched.
- `buildEventInsertValues()` is now a 2-argument function; the private `buildPlatformPrefixedSlug()` helper resolves `getPlatformSlug()` from the existing platform registry (never a new mapping) and returns `undefined` — never a guess — for every non-derivable case (no post row, null `platformPostId`/`platformPostType`, or an unrecognized platform). The `event.slug` key is only ever conditionally assigned (`if (slug !== undefined) event.slug = slug;`), never written as an explicit `slug: undefined`, so Drizzle's `$defaultFn` legacy-hex fallback fires unchanged on the omitted-key path (verified against the installed `drizzle-orm@0.30.10` dialect behavior cited in Task 2).
- `EventSourcePostIdentity` is a new plain interface in `packages/domain/src/events/types.ts`, deliberately decoupled from any `@festgrid/database`/Drizzle type, per project-context.md's Code Organization rule (packages/domain is also imported by `apps/web`).
- This story builds only the base (ordinal-0) slug — no `-{ordinal}`/`~{ordinal}` suffix and no re-slug/alias logic; those remain Stories 3.6t/3.6v's scope, confirmed untouched.
- `schema.ts`'s `events.slug` column definition itself is unchanged; only a clarifying comment was added. `drizzle-kit generate` confirmed zero new migration file.
- Found and fixed one incidental call site not listed in the story's File Change Plan: `apps/backend/scripts/poc-ingestion-preview.ts` calls `buildEventInsertValues()` directly and would have failed `tsc`/`pnpm build` against the new required second argument. Passed `null` (this dry-run preview script has no real `posts` row to look up — nothing is written to the DB), with a comment explaining why. This was necessary to keep `apps/backend`'s build green per the story's own Verification Plan and Definition of Done (lint/build passing for `apps/backend`), not a scope expansion of the story's actual feature.
- Task 7 (PRD verification): re-read `prd.md` §4.1 (`EventInfo.slug`), §4.4 (`Schedule.slug`), and §8.2 (custom-slug premium feature). All three already correctly describe the platform-prefixed scheme and the legacy-hex fallback (no "Nano ID" language) — confirmed already corrected by the 2026-10-01 CC-024 update. No edit was needed or made.
- Pre-Coding Approval Gate: explicit human approval was granted via the dev-story dispatch instruction itself, which restated and reconfirmed this story's exact scope and design decisions (base-slug-only; the DB-lookup-inside-the-transaction design) before any code was written.

### File List

- `packages/domain/src/events/types.ts` — modified (added `EventSourcePostIdentity`; added `EventInsertValues.slug?: string`).
- `packages/domain/src/events/build-event-insert-values.ts` — modified (added `buildPlatformPrefixedSlug()`; `buildEventInsertValues()` is now 2-argument; conditional `event.slug` assignment).
- `packages/domain/src/events/build-event-insert-values.test.ts` — modified (all existing calls updated to pass `null`; added `'slug' in result.event` absence assertions; added 5 new slug-construction test cases).
- `apps/backend/src/lib/ingestor/process-ingestion-job.ts` — modified (moved `buildEventInsertValues()` call inside the transaction; added `posts` row lookup; added `posts`/`eq` imports).
- `apps/backend/src/lib/ingestor/process-ingestion-job.test.ts` — modified (added a third seeded post with `platformPostId`/`platformPostType`; added a platform-prefixed-slug integration test case; strengthened the two existing happy-path cases to assert the legacy hex slug shape).
- `packages/database/schema.ts` — modified (comment-only update above `events.slug`; no column/DDL change, confirmed via `drizzle-kit generate`).
- `apps/backend/scripts/poc-ingestion-preview.ts` — modified (updated its `buildEventInsertValues()` call site to pass `null` for the new required second argument, with an explanatory comment; required to keep `apps/backend`'s build green, not a story-feature change).
