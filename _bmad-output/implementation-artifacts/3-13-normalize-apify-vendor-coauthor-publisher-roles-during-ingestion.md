---
baseline_commit: 7cef1c9ce944584cd3967c973840e6fa8cc6a715
---

# Story 3.13: Normalize Apify vendor coauthor/publisher roles during ingestion

## Story Details

- Epic: 3
- Story ID: 3.13
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want the ingestion pipeline to classify each Apify-sourced post's payload identities into the scraping-source, canonical-publisher, and coauthor axes using each vendor's explicit role-bearing fields — never producer-array order or position,
so that a repost/native-collab post's actual publisher and coauthors are captured instead of being silently collapsed into the scraping-source account (FIND-022, CAP-1).

## Acceptance Criteria

1. **Given** a real `apify/instagram-post-scraper` payload with `ownerId`/`ownerUsername`/`ownerFullName` and a populated `coauthorProducers[]` array (verified evidence: `vendor-role-mapping.md`, runs `run-04`/`run-06`), **when** `mapApifyItemToScrapedPost` (`apps/backend/src/lib/scraper/instagram-adapter.ts`) processes it, **then** the result carries a role-tagged canonical-publisher identity (from `ownerId`/`ownerUsername`/`ownerFullName`) distinct from each coauthor identity (from `coauthorProducers[]`) and from the triggering subscription/scraping-source account.
2. `taggedUsers[]` is never read as a coauthor source — confirmed a materially different (mentioned/tagged, not co-produced) relationship, per `vendor-role-mapping.md`.
3. A `coauthorProducers[]` entry missing a stable `id` is captured via the existing `persistUnprocessedPayload` mechanism (Story 3.4h) rather than silently dropped or defaulted. **Resolved design (AskUserQuestion, 2026-10-02):** only the malformed entry is excluded from the result's coauthor list and recorded for observability — the rest of the post (content, valid coauthors, publisher identity) is still returned and processed normally. Rejecting the whole post over one bad secondary coauthor sub-record would be a regression versus today's behavior (the same post currently succeeds with zero coauthor awareness at all).
4. Bright Data payloads are explicitly **not** touched by this story — `coauthor_producers`'s exact field shape is unverified (its cited fixture no longer exists on disk, per `vendor-role-mapping.md`); Bright Data-side role normalization is out of scope here and blocked on a fresh real-payload capture (see Dev Notes and `backlog.yaml` FIND-039).

## Tasks / Subtasks

- [x] **Task 1: Extend the `ScrapedPost` domain type with role-tagged identity fields** (AC: 1, 3)
  - [x] In `packages/domain/src/scraper/types.ts`, add two new optional fields to `ScrapedPost`:
    - `ownerId?: string` — the canonical publisher's stable platform account ID (Apify's `ownerId`; today only `ownerFullName`/`ownerUsername` are captured as `ownerDisplayName`/`ownerUsername` — `ownerId` itself has never been captured anywhere in this codebase, confirmed by grep).
    - `coauthors?: { accountId: string; username?: string }[]` — zero or more coauthor identities from the vendor's native coauthor field, each guaranteed to carry a stable `accountId` (malformed entries are filtered out before this array is built — see Task 4). No `displayName` field here: Apify's `coauthorProducers[]` never supplies one (confirmed in `vendor-role-mapping.md`); the fallback-chain `displayName` resolution is Story 3.14's job (CAP-2), not this story's.
  - [x] Add a short JSDoc block on both new fields documenting: (a) which vendor populates them today (Apify only), (b) that `coauthors` entries are pre-filtered (never contains a malformed/accountId-less entry), and (c) that Bright Data does not populate either field yet (FIND-039).
  - [x] Do **not** rename or remove `ownerDisplayName`/`ownerUsername` — keep the existing flat-field convention exactly as-is (resolved via `AskUserQuestion`, see Dev Notes "Design Decisions").
- [x] **Task 2: Update the AJV schema to match the extended type** (AC: 1, 3)
  - [x] In `apps/backend/src/validation/scraped-post.schema.ts`, add `ownerId: { type: 'string', nullable: true }` and a `coauthors` array-of-objects schema (`items: { type: 'object', properties: { accountId: { type: 'string' }, username: { type: 'string', nullable: true } }, required: ['accountId'], additionalProperties: false }`, `nullable: true`) to `scrapedPostSchema`. This is required for the file to type-check at all — `scrapedPostSchema: JSONSchemaType<ScrapedPost>` fails to compile if any `ScrapedPost` property (optional or not) is missing from `properties`.
- [x] **Task 3: Document the raw Apify fields `mapApifyItemToScrapedPost` now reads** (AC: 1, 2)
  - [x] In `apps/backend/src/lib/scraper/instagram-adapter.ts`'s `ApifyPostItem` interface (documentation-only — the mapping function's `item` parameter stays typed `any`, matching existing convention), add `ownerId?: string` and `coauthorProducers?: { id?: string; username?: string; is_verified?: boolean; profile_pic_url?: string }[]`. Do **not** add a `taggedUsers` field — its absence from this interface is itself part of AC2's "never read" guarantee; if a future change adds it, that is a deliberate, reviewable diff, not an incidental one.
- [x] **Task 4: Implement role normalization in `mapApifyItemToScrapedPost`** (AC: 1, 2, 3)
  - [x] Capture `item.ownerId` into the candidate's `ownerId` field using the same conditional-spread pattern already used for `ownerFullName`/`ownerUsername` (`...(item.ownerId && { ownerId: item.ownerId })`) — omit the field entirely when absent, consistent with every other optional field in this function (never emit `undefined`, which fails the AJV nullable check the same way the file's existing comment already warns about).
  - [x] When `item.coauthorProducers` is a non-empty array, iterate it and, for each entry:
    - If `entry.id` is a non-empty string: push `{ accountId: entry.id, ...(entry.username && { username: entry.username }) }` onto a local `coauthors` accumulator.
    - Otherwise (missing/empty/non-string `id`): call `persistUnprocessedPayload` with `rawPayload` set to the single malformed entry (not the whole item), a descriptive `validationError` (e.g. `{ message: 'coauthorProducers entry missing a stable id', entry }`), and the same `context`/`scraperActorRunId` shape already used by this file's existing malformed-payload call (`source: 'apify'`, `scraperVendor: 'instagram'`, `accountId: null`, `postUrl`, `timestamp: new Date().toISOString()`, `parserVersion: APIFY_PARSER_VERSION`, `scraperActorRunId: apifyAuditContext?.runId`), wrapped in the same best-effort `try { } catch { console.error(...) }` pattern as the file's existing call — a failure to persist the audit row must never block mapping the rest of the post.
    - Do not throw, do not return `null`, and do not stop processing the remaining `coauthorProducers` entries or the rest of the candidate — this is the per-entry, non-blocking behavior resolved via `AskUserQuestion` (AC3).
  - [x] Only set `coauthors` on the candidate object if the accumulator ended up non-empty (mirrors the existing `hashtags`/`additionalImageUrls` "omit if empty" convention) — compute this before constructing the `candidate` object literal, since it now requires an `await` (persisting a malformed entry) that the current synchronous-looking object-literal construction does not have room for.
  - [x] Never read `item.taggedUsers` anywhere in this function (AC2 — a regression guard test enforces this, see Task 6).
  - [x] Bump `APIFY_PARSER_VERSION` from `'3.3e'` to `'3.13'`, per this file's own comment ("increment when output types change") and the established convention of using the story key that changed the output shape.
- [x] **Task 5: Confirm the scraping-source/publisher distinction needs no extra code** (AC: 1)
  - [x] Verify (no code change expected) that `mapApifyItemToScrapedPost(item: any)` never receives the triggering `ScraperAccountRef`/scraping-source account as an argument at all (confirmed: its only caller context is the raw Apify `item`) — so the "distinct from the triggering subscription/scraping-source account" half of AC1 is already structurally satisfied by this function's existing signature and does not need an explicit equality check inside it. Record this reasoning in the story's Dev Notes (done, see below) so a future reviewer doesn't look for a comparison that was never meant to live here.
- [x] **Task 6: Add/extend tests in `apps/backend/src/lib/scraper/instagram-adapter.test.ts`** (AC: 1, 2, 3, 4)
  - [x] `mapApifyItemToScrapedPost` captures `ownerId` when `item.ownerId` is present, alongside the existing `ownerFullName`/`ownerUsername` capture (extend or add to the existing "maps Apify item correctly" test).
  - [x] `mapApifyItemToScrapedPost` omits `ownerId` (not `undefined`-valued, but structurally absent — `'ownerId' in result === false`) when `item.ownerId` is absent — regression guard matching this file's existing omit-when-absent convention.
  - [x] `mapApifyItemToScrapedPost` with a `coauthorProducers[]` of 2+ well-formed entries (`id` + `username`) returns `result.coauthors` populated in the same order, each as `{ accountId, username }`.
  - [x] `mapApifyItemToScrapedPost` with one well-formed and one malformed (`id` missing) `coauthorProducers[]` entry: `result.coauthors` contains only the well-formed entry; the post is still returned (`result !== null`, `result.content`/`result.postUrl` intact); the malformed entry is persisted into `unprocessedScraperPayloads` (assert via a real `db.select().from(unprocessedScraperPayloads)` query, matching the existing real-DB-assertion pattern already used in this file and in `persist-unprocessed-payload.test.ts` — this project's local dev DB is the native Windows Postgres service, not Docker; use the existing `.env`'s `DATABASE_URL`).
  - [x] `mapApifyItemToScrapedPost` with `coauthorProducers` entirely absent returns `result.coauthors` structurally absent (not an empty array) — matches the "omit if empty" convention.
  - [x] `mapApifyItemToScrapedPost` with `item.taggedUsers` populated (shape per `vendor-role-mapping.md`: `{ full_name, ... }[]`) and no `coauthorProducers` at all: `result.coauthors` stays structurally absent — explicit regression guard for AC2, proving `taggedUsers` is never read as a coauthor source even when it's the only producer-like array present on the item.
  - [x] Existing tests in this file (Sidecar/carousel, not-found handling, `getNewestPosts`/`lookupAccountProfile`/`getAccountClassificationProfile`) must continue passing unmodified — this story only adds fields and logic, it does not change any existing behavior.
- [x] **Task 7: Verification**
  - [x] `cd apps/backend && npx tsx --test --test-concurrency=1 "src/lib/scraper/instagram-adapter.test.ts"` — new and existing tests green.
  - [x] `pnpm --filter backend build` (or the package's equivalent `tsc` check) — confirms `scrapedPostSchema: JSONSchemaType<ScrapedPost>` still compiles after the type extension, and that no other file destructuring a `ScrapedPost` broke.
  - [x] `pnpm --filter backend test` (full backend suite) — **deliberately scoped down for this session** (see Dev Agent Record / Completion Notes): per explicit session instruction, only targeted tests were run in the foreground (`instagram-adapter.test.ts`, `persist-unprocessed-payload.test.ts`, `persist-scraped-post.test.ts`, plus `packages/domain`'s scraper tests and both packages' `build`), not the full ~10-minute `apps/backend` suite or the repo-wide `pnpm test`. The additional files this bullet names (`process-scrape-job.test.ts`, `process-apify-async-result.test.ts`, `replay-actor-run.test.ts`, `backfill-account-profile-and-infer-location.test.ts`, `build-gemini-request.test.ts`) were not independently re-run this session; none of them are in this story's File Change Plan and the `apps/backend` `tsc` build (which type-checks every consumer of `ScrapedPost`) passed clean, which is the structural guarantee Task 2's AJV-lockstep concern was protecting against.
  - [x] `pnpm lint` for the touched files (`instagram-adapter.ts`, `scraped-post.schema.ts`, `types.ts`, `instagram-adapter.test.ts`) — 0 new errors/warnings (pre-existing warning count on these files confirmed unchanged before/after via `git stash` diff: 35 warnings, 0 errors, both before and after).

## Dev Notes

- **Scope is the Apify adapter mapping function only.** This story's four ACs (epics.md) are scoped entirely to `mapApifyItemToScrapedPost`'s return value. It does **not** touch `persistScrapedPost`, `enqueuePostForProcessing`, the `posts` table, or any SQS message type (`ProcessingJobMessage`) — none of those currently read or forward `ownerId`/`coauthors`, and threading the new fields that far downstream (so Story 3.14 has something to actually consume for profile creation) is explicitly **Story 3.14's** job, not this one's. This matches `epics.md`'s own `Depends on:` line for 3.13 (`Story 3.3c, Story 3.4d, Story 3.4h` — no `persist-scraped-post`-adjacent dependency) and Story 3.14's AC phrasing ("Given Story 3.13's normalized... identities for a post, when an identity... is processed" — 3.14 is where the identities get *processed*, i.e. where the plumbing to carry them that far is decided and built). Do not pre-emptively wire `persistScrapedPost`/the SQS message shape in this story; that risks duplicating or conflicting with whatever shape Story 3.14 picks for persisting/threading the data (e.g. inline at scrape time vs. a separate async step).
- **`ownerId` is a real, previously-uncaptured gap, not new scope creep.** Confirmed by grep: `apps/backend/src/lib/scraper/instagram-adapter.ts`'s `mapApifyItemToScrapedPost` already reads `item.ownerFullName`/`item.ownerUsername` into `ownerDisplayName`/`ownerUsername`, but `item.ownerId` — present on every real Apify payload alongside those two fields (`vendor-role-mapping.md`) — has never been read anywhere in the codebase. AC1 names `ownerId` explicitly as one of the three fields the canonical-publisher identity must come from, so capturing it is required by this story's own AC text, not an inferred extra.
- **The scraping-source/publisher distinction needs no new comparison code.** `mapApifyItemToScrapedPost(item: any)` has never taken the triggering `ScraperAccountRef` (the scraping/subscription account) as a parameter — only the raw vendor `item`. The function therefore cannot conflate the two even in principle; "distinct from the triggering subscription/scraping-source account" (AC1) is a structural property of the existing call graph, not something this story needs to assert at runtime. No code change beyond Tasks 1–4 is needed to satisfy that clause.
- **Why the coauthor-filtering logic stays inline in `instagram-adapter.ts` rather than moving to `packages/domain`:** project-context.md's Code Organization rule routes "pure, framework-agnostic business logic" to `packages/domain`. This file already has two comparable per-field normalization steps that stayed inline rather than being extracted — hashtag lowercasing and Sidecar/carousel slide extraction (`additionalImageUrls`) — both single-vendor, single-call-site transforms matching this story's `coauthors` filter in shape and complexity. Extracting only the new logic to `packages/domain` while leaving its two closest precedents inline inside the same function would be an inconsistent, arbitrary split with no reuse benefit (nothing else in the codebase needs to filter/map `coauthorProducers[]`-shaped data). Keeping it inline, consistent with local precedent, was not treated as a live design question for this reason.
- **AJV `JSONSchemaType<ScrapedPost>` must stay in lockstep with the interface — see "Data Type Compatibility & Migration Requirements" below.** This is the one place a missed update produces an immediate, loud TypeScript compile failure rather than a silent runtime gap.
- **This story introduces the second usage pattern for `persistUnprocessedPayload`.** Every existing call site (`instagram-adapter.ts`'s own AJV-failure path, `brightdata-record-mapper.ts`'s two call sites) persists the payload and then unconditionally returns `null` — "capture and reject the whole item." This story's AC3 (per the resolved design decision below) is the first call site that persists a malformed *sub-entry* while **continuing** to process and return the rest of the item. This is a legitimate, narrower use of an existing mechanism (not a new mechanism), but is worth flagging explicitly for `bmad-code-review` since it's a new control-flow shape for a function reviewers may have pattern-matched as "always paired with `return null`."

### Design Decisions (resolved via `AskUserQuestion`, 2026-10-02)

Two real, non-mechanical design choices were surfaced to the user before drafting this story (per this project's `bmad-create-story` persistent workflow rule requiring such decisions go through `AskUserQuestion` rather than being silently picked):

1. **Identity shape on `ScrapedPost`: flat additive fields vs. nested `publisher`/`coauthors` objects.** Resolved: **flat additive fields** (`ownerId?: string` alongside existing `ownerDisplayName`/`ownerUsername`, plus a sibling `coauthors?: { accountId; username? }[]` array) — not a nested `publisher: { accountId, username, displayName }` object replacing the existing flat fields. Rationale: the nested-object alternative would require migrating all 7 existing consumers of `ownerDisplayName`/`ownerUsername` (`persist-scraped-post.ts`, `enqueue-post-for-processing.ts`, `process-ai-job.ts`, `build-gemini-request.ts`, `backfill-account-profile-and-infer-location.ts`, `process-apify-async-result.ts`, `brightdata-record-mapper.ts`) in this same story, well beyond this story's stated AC (which only asks about `mapApifyItemToScrapedPost`'s own output). The flat-field approach is a strictly additive change to `ScrapedPost` with zero modification required in any of those 7 files.
2. **Malformed `coauthorProducers[]` entry: reject the whole post vs. skip just the entry.** Resolved: **skip just the malformed entry**, persist it via `persistUnprocessedPayload` for observability, and still return the rest of the `ScrapedPost` (content, publisher, valid coauthors) normally — see AC3's resolution note and Task 4. Rationale: every existing `persistUnprocessedPayload` call site today means "reject the whole item," but applying that literally here would mean a single platform's malformed secondary coauthor sub-field could silently delete an otherwise-valid, real event from ingestion — a strictly worse outcome than today's baseline (where the same post, with zero coauthor awareness at all, succeeds). CAP-1's purpose is to capture *more* information about a post, not to make ingestion stricter on the post's primary content because of a secondary field's data quality.

### Architecture & UX Gate Findings

- **Gates 1 and 3 — cited from the batch readiness sweep, not re-run.** `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` includes `3.13`) already ran Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) across this entire batch, including this story. Its per-story verdict table: "**3.13 (normalize Apify vendor coauthor/publisher roles) | READY** | Scoped explicitly to Apify only; Bright Data correctly excluded pending fresh payload capture." No corrections were applied to Story 3.13's AC (unlike 3.6t/3.6v/0.i2c, which did receive corrections in the same sweep). The sweep's own cross-epic reuse scan explicitly named "the coauthor-attribution stories (3.13-3.19)" as accounted for.
  - **Lightweight guard (per this workflow's own instruction) — does this story's actual scope contain anything the sweep plausibly didn't anticipate?** No. The sweep already evaluated this exact story (named in `stories_covered`) against its exact epics.md AC text; nothing in Tasks 1-6 above introduces a new external service, new data entity, or new infra dependency beyond what the sweep reviewed (it is a pure in-process data-shape addition to an existing adapter function plus the matching AJV schema entries — no new table, no new queue, no new third-party call).
- **Gate 2 — run fresh (per-story, as required even when Gates 1/3 are cited).** Dispatched to a one-shot UX-persona analytical pass against this story's exact scope (the `mapApifyItemToScrapedPost` function and its `ScrapedPost`/AJV-schema changes). **Verdict: No gap found.** The entire change surface is backend TypeScript (an AWS Lambda data-mapping function, a domain-package interface, and an AJV JSON Schema) with no React, JSX/TSX, hooks, UI framework import, or rendering surface anywhere in scope — there is no UI component or hook to split out under Gate 2. (Story 0.i6g, not this story, owns the actual coauthor-attribution UI per CAP-7 — see its own note in `sprint-status.yaml`.)

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A genuine type/schema lockstep requirement, not a mismatch to fix — but one that must be executed correctly or the backend fails to compile. `apps/backend/src/validation/scraped-post.schema.ts` declares `scrapedPostSchema: JSONSchemaType<ScrapedPost>` (from `ajv`'s typed-schema helper), which requires every property on the `ScrapedPost` TypeScript interface — including every optional one — to have a matching entry in the schema's `properties` object, or the file fails to type-check.
- **Impacted fields/contracts:** `packages/domain/src/scraper/types.ts`'s `ScrapedPost` interface (adding `ownerId?: string`, `coauthors?: { accountId: string; username?: string }[]`) and `apps/backend/src/validation/scraped-post.schema.ts`'s `scrapedPostSchema` (must add matching `ownerId`/`coauthors` schema entries, both `nullable: true` since they're optional on the TS side — matching the existing convention for every other optional `ScrapedPost` field in this schema).
- **Required DB migration changes:** None. No database table or column is added, changed, or read by this story — `posts`, `social_media_account_profiles`, and `post_account_associations` (the latter two not even created yet, pending Stories 3.14/3.15) are untouched. This story's only persistence interaction is calling the existing `persistUnprocessedPayload` function (Story 3.4h, unchanged) for the malformed-entry case.
- **Required TypeScript type changes:** `ScrapedPost` (packages/domain) — add `ownerId?`/`coauthors?` per Task 1. No other interface changes: `ProcessingJobMessage`, `PersistScrapedPostParams`, and every other type that currently destructures a fixed, named subset of `ScrapedPost` fields is unaffected by adding new optional fields to the source type (TypeScript structural typing — passing an object with extra properties into a narrower, explicitly-field-by-field-constructed call is not a type error in this codebase's existing call patterns, confirmed by reading `process-scrape-job.ts`/`process-apify-async-result.ts`/`replay-actor-run.ts`, all of which build their downstream objects by naming each field explicitly rather than spreading the whole `ScrapedPost`).
- **Backward compatibility and rollout notes:** Purely additive — both new fields are optional, and every existing caller/consumer of `ScrapedPost` continues to compile and run unmodified whether or not the new fields are populated. No feature flag, versioning, or phased rollout is needed; this is the same "optional field, omit when absent" pattern the AJV schema and this function already use throughout (e.g. `locationName`, `hashtags`, `additionalImageUrls`).
- **Verification checks:** Task 7's `pnpm --filter backend build` (confirms the AJV `JSONSchemaType<ScrapedPost>` still compiles) plus the full `pnpm --filter backend test` run (confirms no existing `ScrapedPost` consumer regressed). Task 6's tests directly assert the new fields' presence/absence/shape at the `mapApifyItemToScrapedPost` boundary.

### Project Structure Notes

- All touched files already exist and keep their current locations — no new files, no new package, no new directory:
  - `packages/domain/src/scraper/types.ts` (interface extension)
  - `apps/backend/src/validation/scraped-post.schema.ts` (schema extension)
  - `apps/backend/src/lib/scraper/instagram-adapter.ts` (mapping logic + `ApifyPostItem` doc fields + `APIFY_PARSER_VERSION` bump)
  - `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (new/extended tests, `node:test` pattern already established in this file — not Vitest; this backend package's test script is `tsx --test --test-concurrency=1 "src/**/*.test.ts"`, confirmed in `apps/backend/package.json`)
- No new workspace package dependency rules apply (no `zod`/`ajv` cross-boundary change, no new Firebase/queue/state-management code) — this story introduces zero new dependencies.
- No `packages/ui` or `apps/web` file is touched (confirmed by Gate 2's verdict above) — purely `apps/backend` + `packages/domain`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.13: Normalize Apify vendor coauthor/publisher roles during ingestion]
- [Source: _bmad-output/specs/spec-post-coauthor-attribution/SPEC.md#CAP-1 — Vendor role normalization]
- [Source: _bmad-output/specs/spec-post-coauthor-attribution/vendor-role-mapping.md] — the real captured-payload evidence (`ownerId`/`ownerUsername`/`ownerFullName`, `coauthorProducers[]` shape, `taggedUsers[]` distinction, Bright Data's unrecoverable-fixture gap)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-25: Post-Account Association Table Shape] — owns the DB-side role vocabulary this story's output eventually feeds (Story 3.15), referenced here for context only; this story writes no DDL
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-31: Post–Account Association Semantics] — Rule 2's closed role vocabulary (`PUBLISHER`/`COAUTHOR`/`SCRAPING_SOURCE`/`PUBLISHER_UNKNOWN`) is the DB-level encoding of the same three axes this story distinguishes structurally via field shape (`ownerId`/`ownerUsername`/`ownerFullName` vs. `coauthors[]` vs. the caller-supplied scraping account) — AD-31 itself binds Story 3.13 by name
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 sweep, per-story verdict table entry for 3.13 ("READY")
- [Source: apps/backend/src/lib/scraper/instagram-adapter.ts] — current implementation read in full for this story
- [Source: apps/backend/src/lib/scraper/brightdata-record-mapper.ts] — precedent for the existing `persistUnprocessedPayload` all-or-nothing usage pattern this story's AC3 narrowly extends (not replaces)
- [Source: apps/backend/src/validation/scraped-post.schema.ts, packages/domain/src/scraper/types.ts] — current `ScrapedPost`/AJV schema definitions read in full

## Global Rules References

- [x] `_bmad-output/project-context.md` — Database/Runtime Schema Validation rules (Zod/AJV at entry points), Code Organization (packages/domain routing — see Dev Notes for why this story's logic stays inline), Testing Rules (packages/domain 100%-coverage rule does not apply here — no new packages/domain logic, only a type addition)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-25 (table shape, context only), AD-31 (role semantics; binds Story 3.13 by name, Rule 2's role vocabulary)
- [x] `docs/infrastructure/index.md` — reviewed; this story adds no new infrastructure (no new queue, Lambda, or DB resource) and only modifies logic inside an existing Apify-scraping code path, so no infrastructure shard file needed deeper reading

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `packages/domain/src/scraper/types.ts` — add `ownerId?: string` and `coauthors?: { accountId: string; username?: string }[]` to `ScrapedPost`, with JSDoc.
  2. `apps/backend/src/validation/scraped-post.schema.ts` — add matching `ownerId`/`coauthors` AJV schema entries.
  3. `apps/backend/src/lib/scraper/instagram-adapter.ts` — extend `ApifyPostItem` (doc fields), implement `ownerId` capture + `coauthorProducers[]` normalization/filtering with the per-entry `persistUnprocessedPayload` call inside `mapApifyItemToScrapedPost`, bump `APIFY_PARSER_VERSION` to `'3.13'`.
  4. `apps/backend/src/lib/scraper/instagram-adapter.test.ts` — add the 6 new/extended test cases in Task 6.
  5. No other file is modified — `persist-scraped-post.ts`, `enqueue-post-for-processing.ts`, `process-ai-job.ts`, `build-gemini-request.ts`, `backfill-account-profile-and-infer-location.ts`, `process-apify-async-result.ts`, `process-scrape-job.ts`, `replay-actor-run.ts`, `brightdata-record-mapper.ts` are all explicitly out of scope (see Dev Notes/Out of Scope).
- **Rule Mapping:**
  - AC1/AC3 (role-tagged identity capture + per-entry observability) → Tasks 1, 2, 4.
  - AC2 (`taggedUsers[]` never read) → Task 4 (no code reads it) + Task 6 (explicit regression-guard test).
  - AC4 (Bright Data out of scope) → no file under `brightdata-record-mapper.ts` is touched; verified via Task 7's full backend test run showing no regression there.
  - `JSONSchemaType<ScrapedPost>` lockstep rule (project-context.md Runtime Schema Validation) → Task 2.
  - `persistUnprocessedPayload` reuse (Story 3.4h mechanism, not a new one) → Task 4, Dev Notes "second usage pattern" note.
- **Verification Plan:** Task 7 in full — targeted `instagram-adapter.test.ts` run, full `apps/backend` build (`tsc`) and test suite, lint on the 4 touched files.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Apify-only `mapApifyItemToScrapedPost` + `ScrapedPost` type + AJV schema; explicitly not `persistScrapedPost`/enqueue/posts-table plumbing (that's Story 3.14) and not Bright Data (FIND-039)
- [ ] Architecture and boundary confirmation — AD-25/AD-31 reviewed (context only, no DDL written here); coauthor-filtering logic stays inline in `instagram-adapter.ts` per local precedent, not extracted to `packages/domain`
- [ ] Testing plan confirmation — Task 6's 6 test cases cover AC1-AC4 plus the two resolved design decisions
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md` (READY, no correction needed for 3.13); Gate 2 run fresh this session (No gap found)

## Testing Requirements

- [ ] Integration tests — `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (Task 6), `node:test` pattern, run via `npx tsx --test --test-concurrency=1`; the malformed-coauthor-entry test asserts against the real local Postgres `unprocessedScraperPayloads` table (no mocking of the DB layer, matching this file's existing convention)
- [ ] E2E tests — not applicable; this is a backend-only data-mapping change with no user-facing flow to exercise end-to-end (per project-context.md's testing-trophy guidance, E2E is reserved for critical user flows)

## Deliverables Checklist

- [ ] `ScrapedPost` type extended with `ownerId`/`coauthors` (packages/domain)
- [ ] `scrapedPostSchema` AJV schema updated to match (apps/backend)
- [ ] `mapApifyItemToScrapedPost` captures `ownerId`, normalizes `coauthorProducers[]` into `coauthors[]`, filters and observably persists malformed entries without rejecting the whole post, never reads `taggedUsers[]`
- [ ] `APIFY_PARSER_VERSION` bumped to `'3.13'`
- [ ] 6 new/extended test cases in `instagram-adapter.test.ts`, all green alongside every pre-existing test in that file
- [ ] Full `apps/backend` build + test suite green; lint clean on all 4 touched files

## Out of Scope

- Threading `ownerId`/`coauthors` through `persistScrapedPost`, `enqueuePostForProcessing`, the `posts` table, or the `ProcessingJobMessage` SQS shape — Story 3.14 (deduplicated, provenance-tracked subscribable profiles), which depends on this story.
- Creating or reusing `social_media_account_profiles` rows for publisher/coauthor identities, `displayName` fallback-chain resolution, `discoverySource`/`firstSeen`/`lastSeen` — Story 3.14 (CAP-2).
- The `post_account_associations` table, its DDL, or any migration — already resolved by Architecture Spine AD-25/AD-31; built by Story 3.15 (CAP-3).
- Any Bright Data (`brightdata-record-mapper.ts`) change — explicitly excluded by AC4; tracked separately as `backlog.yaml` **FIND-039** ("Bright Data's `coauthor_producers` field shape is unverified"), blocked on a fresh real-payload capture.
- Coauthor/publisher subscribability, demand-gated discovery, union-of-associations filtering, the event/post-detail attribution UI, or subscription-toggle analytics — Stories 3.16/3.17/3.18/0.i6g/3.19 respectively (all depend transitively on this story, none of their scope is touched here).

## Definition of Done

- [ ] AC1-AC4 satisfied exactly as resolved above (including the two `AskUserQuestion`-resolved design decisions)
- [ ] All Task 6 tests passing, plus every pre-existing test in `instagram-adapter.test.ts` and the rest of the `apps/backend` suite (no regression)
- [ ] `pnpm --filter backend build` (tsc) clean; `pnpm lint` clean on all 4 touched files
- [ ] No file outside the File Change Plan touched

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `cd packages/domain && npx tsx --test "src/scraper/*.test.ts"` → 57/57 passing (adapter-registry + platform-registry suites, no regression from the `ScrapedPost` type extension), run twice (before/after the backend fix below) for confirmation.
- `cd apps/backend && npx cross-env NODE_ENV=test npx tsx --test --test-concurrency=1 "src/lib/scraper/instagram-adapter.test.ts"` → first pass: 32/32 green (6 new/extended Task 6 cases + all 26 pre-existing cases). Re-run immediately after (to sanity-check repeatability against the real local Postgres DB) surfaced a flake: the malformed-coauthor test asserted an exact row count (`rows.length === 1`) against a **fixed** `postUrl`, so a second run against the same un-truncated table found 3 accumulated rows instead of 1 and failed. Fixed by making that test's `postUrl` unique per run (`Date.now()` + random suffix) — re-ran twice more, 32/32 both times, confirming the fix (not the original implementation) was the flaky part.
- `cd apps/backend && npx cross-env NODE_ENV=test npx tsx --test --test-concurrency=1 "src/lib/posts/persist-unprocessed-payload.test.ts" "src/lib/posts/persist-scraped-post.test.ts"` → 23/23 green (pre-existing `persistUnprocessedPayload`/`persistScrapedPost` consumers unaffected), run twice.
- `pnpm --filter domain build` → clean. `pnpm --filter backend build` → clean (confirms `scrapedPostSchema: JSONSchemaType<ScrapedPost>` still compiles with the two new fields, and no other `ScrapedPost` consumer broke). Note: the first backend build attempt failed with `TS2339: Property 'ownerId'/'coauthors' does not exist` because it ran against a stale compiled `packages/domain` `dist/` (from running both builds in the same parallel batch); rebuilding domain first, then backend, resolved it — not a real type error.
- `cd apps/backend && npx eslint src/lib/scraper/instagram-adapter.ts src/lib/scraper/instagram-adapter.test.ts src/validation/scraped-post.schema.ts --report-unused-disable-directives` and `cd packages/domain && npx eslint src/scraper/types.ts --max-warnings 0` → 0 errors both before and after my changes. Confirmed via `git stash`/`git stash pop` that the pre-existing baseline on these 3 backend files was already 35 warnings/0 errors (all pre-existing `any`/unused-var warnings, none introduced by this story); one new warning I had introduced (`(rows[0] as any)` in a new test) was fixed by removing the unnecessary cast, restoring parity with baseline (35/0, unchanged).
- Per explicit session instruction: did **not** run the full `apps/backend` suite (~10 min) or the repo-wide `pnpm test` — only the targeted files above, plus both packages' `build`, were run in the foreground.

### Completion Notes List

- AC1/AC3: `ScrapedPost` (packages/domain) extended with `ownerId?: string` and `coauthors?: { accountId: string; username?: string }[]`, flat and additive — no existing field renamed/removed, no existing consumer file touched (confirmed: only `packages/domain/src/scraper/types.ts`, `apps/backend/src/validation/scraped-post.schema.ts`, `apps/backend/src/lib/scraper/instagram-adapter.ts`, and its test file were modified).
- AC1: `mapApifyItemToScrapedPost` now captures `item.ownerId` into `candidate.ownerId` using the same conditional-spread "omit if absent" pattern as every other optional field in that function.
- AC1/AC3: `item.coauthorProducers[]` is normalized into `candidate.coauthors[]` — each well-formed entry (`id` present, non-empty, string) becomes `{ accountId, username? }`; a malformed entry (missing/empty/non-string `id`) is excluded from the array and persisted via `persistUnprocessedPayload` (the single malformed entry as `rawPayload`, not the whole item) for observability, matching Story 3.4h's mechanism but as the first per-entry (not whole-item) use of it in this codebase. The rest of the post — content, publisher identity, other valid coauthors — is still returned and ingests normally; this is the resolved design decision from the story's `AskUserQuestion` record (AC3).
- AC2: `item.taggedUsers` is never read anywhere in `mapApifyItemToScrapedPost` or the `ApifyPostItem` interface — verified by a dedicated regression-guard test (coauthors stays structurally absent even when `taggedUsers` is the only producer-like array present on the item).
- AC4: No Bright Data file (`brightdata-record-mapper.ts`) touched — confirmed via File Change Plan compliance and by running `persist-scraped-post.test.ts`/`persist-unprocessed-payload.test.ts` (both pass unchanged).
- `APIFY_PARSER_VERSION` bumped `'3.3e'` → `'3.13'` per the file's own "increment when output types change" convention.
- Task 5: confirmed by inspection (no code change) that `mapApifyItemToScrapedPost(item: any)` never takes the triggering `ScraperAccountRef` as a parameter, so AC1's "distinct from the triggering subscription/scraping-source account" clause is structurally satisfied by the existing call graph.
- Pre-Coding Approval Gate: the two live design questions this story depended on (flat-additive vs. nested identity shape; reject-whole-post vs. skip-just-the-entry on a malformed coauthor) were already resolved via `AskUserQuestion` during `bmad-create-story` and are recorded verbatim in the story's own "Design Decisions" Dev Note. The user's `bmad-dev-story` invocation for this session explicitly reiterated both resolutions and instructed implementation to proceed on that basis — treated as the explicit human approval this gate requires; the gate's own checkboxes were left untouched per this workflow's "only modify story file in these listed areas" rule (Pre-Coding Approval Gate is not one of them).
- Verification scope note (session instruction, not a shortcut taken unilaterally): only targeted tests were run in the foreground for this story — `packages/domain`'s scraper tests, `apps/backend`'s `instagram-adapter.test.ts`, `persist-unprocessed-payload.test.ts`, and `persist-scraped-post.test.ts` — plus a full, unfiltered `pnpm --filter backend build`/`pnpm --filter domain build` and `eslint` on all 4 touched files. The full `apps/backend` test suite (~10 min) and the repo-wide `pnpm test` were explicitly not run this session. Known-unrelated, pre-existing failures elsewhere in the backend suite (not touched by or related to this story) were called out by the session but not independently re-verified: `packages/ui`'s `format-event-date` test outside UTC (FIND-062) and 4 `apps/backend` `system-key-adapter` tests failing because `.env` defines `SYSTEM_GEMINI_API_KEY` (FIND-063).
- A pre-existing flake was found and fixed in my own new test (not a pre-existing bug): the malformed-coauthor test originally asserted an exact DB row count against a fixed `postUrl`, which fails on a second run against the same real, non-truncated local Postgres table. Fixed by making the `postUrl` unique per test invocation.

### File List

- `packages/domain/src/scraper/types.ts` (modified) — `ScrapedPost` extended with `ownerId?: string` and `coauthors?: { accountId: string; username?: string }[]`, each with JSDoc
- `apps/backend/src/validation/scraped-post.schema.ts` (modified) — added matching `ownerId`/`coauthors` AJV schema entries (both `nullable: true`)
- `apps/backend/src/lib/scraper/instagram-adapter.ts` (modified) — `ApifyPostItem` interface documents `ownerId`/`coauthorProducers` (doc-only, `item` stays `any`); `mapApifyItemToScrapedPost` captures `ownerId` and normalizes/filters `coauthorProducers[]` into `coauthors[]` with per-entry `persistUnprocessedPayload` on malformed entries; `APIFY_PARSER_VERSION` bumped to `'3.13'`
- `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (modified) — 6 new/extended test cases per Task 6 (ownerId capture/omission, well-formed coauthors mapping, malformed-entry skip+persist+still-ingest, omit-if-empty, taggedUsers-never-read regression guard)
- `_bmad-output/implementation-artifacts/3-13-normalize-apify-vendor-coauthor-publisher-roles-during-ingestion.md` (modified) — this story file: `baseline_commit` frontmatter, Tasks/Subtasks checkboxes, Dev Agent Record, File List, Change Log, Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — `3-13-normalize-apify-vendor-coauthor-publisher-roles-during-ingestion` status `ready-for-dev` → `in-progress` → `review`

## Change Log

- 2026-10-02: Pre-Coding Approval Gate decisions (flat-additive `ScrapedPost` fields; skip-just-the-malformed-entry) reiterated and approved for implementation per the session's `bmad-dev-story` invocation (resolutions originally recorded via `AskUserQuestion` during `bmad-create-story`). Implemented AC1-AC4: `ownerId`/`coauthors` added to `ScrapedPost` and its AJV schema; `mapApifyItemToScrapedPost` captures `ownerId`, normalizes `coauthorProducers[]` into `coauthors[]`, skips and persists (via `persistUnprocessedPayload`) a malformed entry without rejecting the rest of the post, never reads `taggedUsers`; `APIFY_PARSER_VERSION` bumped to `'3.13'`. Added 6 new/extended tests in `instagram-adapter.test.ts` (32/32 green). Verified `packages/domain`/`apps/backend` `build` (both clean) and targeted tests (`instagram-adapter.test.ts` 32/32, `persist-unprocessed-payload.test.ts` + `persist-scraped-post.test.ts` 23/23, `packages/domain` scraper tests 57/57) — all run in the foreground per session instruction; the full `apps/backend` suite and repo-wide `pnpm test` were explicitly out of scope for this session. `pnpm lint` on all 4 touched files: 0 errors, pre-existing warning count unchanged (35, confirmed via `git stash` baseline diff). Status moved `ready-for-dev` → `in-progress` → `review`.
