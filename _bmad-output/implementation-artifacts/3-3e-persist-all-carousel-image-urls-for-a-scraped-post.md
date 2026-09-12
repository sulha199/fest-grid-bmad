---
baseline_commit: 80d3db100d5d61406fc9af9078d537fe2176a65a
---

# Story 3.3e: Persist all carousel image URLs for a scraped post

## Story Details

- Epic: 3
- Story ID: 3.3e
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to capture every image URL from a multi-image (carousel/Sidecar) Instagram post, not just its cover image,
so that Story 3.6l's multi-image AI extraction has access to schedule information that appears on a later slide rather than the cover image or caption.

## Acceptance Criteria

1. **Given** a scraped Instagram post is a Sidecar (carousel) post, **when** `instagram-adapter.ts` maps Apify's raw item to a `ScrapedPost`, **then** every slide's image URL beyond the cover (`item.childPosts[].displayUrl`, in slide order) is captured into a new `additionalImageUrls: string[]` field — the existing `imageUrl` field continues to hold only the cover image (`item.displayUrl`), unchanged. (Confirmed via web research against Apify's own Instagram scraper output schema: `type: "Sidecar"` marks a carousel item, and `childPosts[]` — each with its own `displayUrl` — holds every slide; matches this AC's field names exactly.)
2. **Given** a non-carousel post (`item.type !== 'Sidecar'`, or no `childPosts` present), **when** the same mapping runs, **then** `additionalImageUrls` is omitted/empty — no behavior change for existing single-image posts.
3. The `posts` table (Story 3.3a) gains a nullable `additional_image_urls` (jsonb) column, written by `persistScrapedPost`'s existing write path, with **no cap applied at persistence time** — the full set of scraped slide URLs is stored; Story 3.6l decides how many are actually sent to Gemini.
4. `ProcessingJobMessage` (`packages/domain/src/posts/types.ts`) gains an optional `additionalImageUrls?: string[]` field, populated from the post's persisted column when the message is built for the `AIProcessingQueue` (`enqueuePostForProcessing`, `apps/backend/src/lib/posts/enqueue-post-for-processing.ts`).
5. This field is purely an extraction-time input — never displayed in any UI (the GraphQL `Post` type, `apps/backend/src/schema/extraction.graphql`, is not extended with this field), never durably re-hosted (Architecture Spine AD-12 is unaffected; see AD-13), and Story 4.2a's existing on-demand correction path is unaffected since it does not populate this new optional field.
6. **(Bug fix, same call site this story must already edit)** `process-scrape-job.ts`'s `persistScrapedPosts()` helper — the production write path for Story 3.4's daily-batch and on-demand new-subscribe scrapes — forwards `ScrapedPost.hashtags` to `persistScrapedPost`, alongside the new `additionalImageUrls` forwarding this story adds. This closes a pre-existing gap where `mapApifyItemToScrapedPost` has captured hashtags since the 2026-08-28 hashtag-search work, but this specific call site never passed them through, silently breaking hashtag search (Sections 3.1/3.7) for posts persisted via the main scrape path.

**Note (2026-09-03, added via `bmad-correct-course`):** Triggered by a real-world example (a `laridijogja` Instagram post whose per-event schedule details lived on carousel slides 2-6, not the cover image or caption) surfaced in `ai-extraction-improvement.md`. Confirmed via code trace, not assumption: `apps/backend/src/lib/scraper/instagram-adapter.ts:237` only ever reads `item.displayUrl`, and `packages/database/schema.ts`'s `posts` table has no column for additional images — Apify's own `childPosts` array is fetched and silently discarded today. Positioned as a lettered suffix off Story 3.3a (the posts-table/persistence owner) rather than reopening it (status: review) — see the cross-reference note added to Story 3.4, whose `instagram-adapter.ts` this story edits.

**Note (2026-09-12, added via `bmad-create-story`, AC6):** While tracing every `persistScrapedPost` call site (required to confirm where the new field must be wired through), found that `process-scrape-job.ts`'s helper — the actual live path for Story 3.4's AC1-6 — never forwarded `hashtags`, unlike `process-apify-async-result.ts` and `replay-actor-run.ts`, which do. Presented to the user as a two-option tradeoff via `AskUserQuestion` (fix now vs. defer to a separate backlog item); the question went unanswered, so this story defaults to the recommended option (fix it, same function, near-zero incremental risk since the function is already being edited) per this project's `AskUserQuestion`-default-to-spec-fidelity rule. If the user disagrees during `bmad-dev-story`/review, AC6 and its corresponding task can be dropped without touching the rest of this story — it is entirely independent of AC1-5. A separate pre-existing gap in `process-brightdata-result.ts`/`brightdata-record-mapper.ts` (Bright Data path never captures or forwards `hashtags` either, and has no `childPosts`-equivalent data at all) was also found but is **not** included here — Bright Data is out of AC1's scope (Apify/`instagram-adapter.ts` only) and this story does not otherwise touch that file, so per the "shared code this story touches" framing it stays a separate, unaddressed backlog item, not silently absorbed here.

**Depends on:** Story 3.3a, Story 3.3c.

## Tasks / Subtasks

- [x] **Task 1 (AC1, AC2, AC5): Extend the `ScrapedPost` domain type and its AJV contract**
  - [x] Add `additionalImageUrls?: string[]` to the `ScrapedPost` interface in `packages/domain/src/scraper/types.ts` (exported via `packages/domain/src/scraper/index.ts` → `packages/domain/src/index.ts`, already wildcard re-exported — no barrel change needed).
  - [x] Add a matching `additionalImageUrls: { type: 'array', items: { type: 'string' }, nullable: true }` property to `scrapedPostSchema` in `apps/backend/src/validation/scraped-post.schema.ts`, following the exact existing `hashtags` pattern (optional in TS, `nullable: true` in the JSONSchemaType, not in `required`). **This is load-bearing, not cosmetic:** the schema has `additionalProperties: false`, so without this addition, any real Sidecar post scraped after this ships would start *failing* AJV validation (rejected as carrying an undeclared property) and get diverted to `persistUnprocessedPayload` instead of stored — the exact opposite of this story's intent.

- [x] **Task 2 (AC1, AC2): Capture carousel slide URLs in `instagram-adapter.ts`'s Apify item mapping**
  - [x] Extend the raw `ApifyPostItem` interface (`apps/backend/src/lib/scraper/instagram-adapter.ts`) with `type?: string;` and `childPosts?: { displayUrl?: string }[];`.
  - [x] In `mapApifyItemToScrapedPost`, when `item.type === 'Sidecar'` and `Array.isArray(item.childPosts)`, derive `additionalImageUrls` as `item.childPosts.map(cp => cp.displayUrl).filter((url): url is string => Boolean(url))` (slide order preserved, matching Apify's own array order; falsy/missing `displayUrl` entries dropped defensively) and include it in the `candidate` object only when non-empty (`...(additionalImageUrls.length > 0 && { additionalImageUrls })`), matching this function's existing conditional-spread style for every other optional field. For a non-Sidecar item or one with no `childPosts`, omit the field entirely (AC2) — no behavior change.
  - [x] Bump `APIFY_PARSER_VERSION` from `'3.4m'` to `'3.3e'`, per this file's established convention of stamping the constant with whichever story last changed the Apify→`ScrapedPost` mapping (confirmed via `git log -p` on this file: `3.4g` → `3.4m` was the prior bump, itself for a mapping change).
  - [x] Note (edge case, documented not asked): a Sidecar `childPost` can itself be a video slide, whose `displayUrl` is that video's thumbnail frame, not a "real" photo. AC1's wording ("every slide's image URL beyond the cover... `item.childPosts[].displayUrl`") does not gate on child-post type, so this task includes every child's `displayUrl` unconditionally, matching Story 3.6l's downstream intent (any slide, including a video thumbnail, may carry schedule text Gemini's vision call can read).

- [x] **Task 3 (AC3): Add the `additional_image_urls` column and generate its migration**
  - [x] In `packages/database/schema.ts`'s `posts` pgTable (line ~250), add `additionalImageUrls: jsonb('additional_image_urls').$type<string[]>(),` — nullable (no `.notNull()`), no default, no index (nothing queries by this column), matching the existing `defaultLocation`/`locationDetails` `.$type<T>()` jsonb convention rather than `hashtags`' `text().array()` approach (this field's shape is closer to those `$type` jsonb columns than to the flat hashtag array).
  - [x] Run `pnpm --filter @festgrid/database run generate` to produce the next `drizzle-kit`-generated migration (`packages/database/migrations/00XX_*.sql`, following `0049_lyrical_ultimatum.sql`) — plain `ALTER TABLE posts ADD COLUMN additional_image_urls jsonb;`, no hand-edit expected (unlike the partial-index/`WHERE`-clause or `.using('gin')` gaps seen in prior stories — this is neither).
  - [x] Run `pnpm --filter @festgrid/database run migrate` to apply it locally; confirm the column exists via a live-DB query (matching Story 3.3c's own precedent of a "live-DB column-existence check" before merge).

- [x] **Task 4 (AC3): Thread `additionalImageUrls` through `persistScrapedPost`**
  - [x] Add `additionalImageUrls?: string[] | null` to `PersistScrapedPostParams` in `apps/backend/src/lib/posts/persist-scraped-post.ts`, destructure it, and include it in `insertValues` for the new-row insert path.
  - [x] Do **not** add it to the existing-row `backfillPatch` branch. Matches this file's actual existing precedent: only `imageUrl`/`videoUrl` get backfilled-if-missing on a duplicate-post match; every other optional field (`content`, `hashtags`, `locationName`, `ownerDisplayName`, `ownerUsername`) is populated once, at first insert, and left alone on every subsequent re-scrape match. `additionalImageUrls` follows that majority pattern, not the `imageUrl`/`videoUrl` special case.

- [x] **Task 5 (AC1's wiring, AC6): Forward `additionalImageUrls` (and fix `hashtags`) from the scrape-job call site**
  - [x] In `apps/backend/src/lib/scraper/process-scrape-job.ts`'s `persistScrapedPosts()` helper, add `additionalImageUrls: post.additionalImageUrls || null,` to the `persistScrapedPost` call — without this, `instagram-adapter.ts`/`persist-scraped-post.ts`'s changes above are dead code on the actual production path (Story 3.4's daily batch and on-demand new-subscribe scrapes both funnel through this one helper).
  - [x] AC6: in the same call, add `hashtags: post.hashtags || null,` (the sibling gap found while tracing this call site — see the Note above).
  - [x] Explicitly out of scope for this task: `process-brightdata-result.ts` / `brightdata-record-mapper.ts` (Bright Data path) — not touched, since AC1 scopes `additionalImageUrls` to Apify/`instagram-adapter.ts` only, Bright Data's own mapper has no `childPosts`-equivalent data, and this story does not otherwise open that file (see the Note above on why its own separate `hashtags` gap is left alone here).

- [x] **Task 6 (AC4): Populate `ProcessingJobMessage.additionalImageUrls` from the persisted column**
  - [x] Add `additionalImageUrls?: string[];` to `ProcessingJobMessage` in `packages/domain/src/posts/types.ts`.
  - [x] In `enqueuePostForProcessing` (`apps/backend/src/lib/posts/enqueue-post-for-processing.ts`), add `additionalImageUrls: post.additionalImageUrls ?? undefined,` to the built `message`, matching this function's existing `?? undefined` normalization pattern for every other optional field.

- [x] **Task 7 (Testing, AC1/AC2): Extend `instagram-adapter.test.ts`**
  - [x] New case: a Sidecar item with a 3-entry `childPosts` array (each with a `displayUrl`) maps to a `ScrapedPost` whose `additionalImageUrls` matches those URLs in the same order, and whose `imageUrl` still equals only `item.displayUrl` (the cover).
  - [x] New case: a Sidecar item with one `childPosts` entry missing `displayUrl` — that entry is dropped, the rest are kept.
  - [x] New case: a non-Sidecar item (`type: 'Image'` or `type` absent) — `additionalImageUrls` is `undefined`/absent on the result, matching today's behavior exactly (regression guard for AC2).
  - [x] New case: a Sidecar item with `childPosts` absent/not an array — treated the same as AC2 (no field), not a crash.

- [x] **Task 8 (Testing, AC1): Extend the AJV schema test coverage for `scrapedPostSchema`**
  - [x] Confirm (new or existing test) that a `ScrapedPost` candidate carrying `additionalImageUrls` passes validation, and that omitting it still passes (matches `hashtags`' existing test treatment, if any exists — else add alongside it).

- [x] **Task 9 (Testing, AC3): Extend `persist-scraped-post.test.ts`**
  - [x] New case: passing `additionalImageUrls` on a new-row insert round-trips it into the `additional_image_urls` jsonb column (read back via a direct `db.select()`, matching this file's existing `imageUrlExpiresAt`-style direct-DB-read assertions).
  - [x] New case: omitting it persists `null` (matching the existing `videoUrl`-defaults-to-null case's assertion style).
  - [x] New case (AC3's "no cap" wording): a large `additionalImageUrls` array (e.g. 8 entries) persists in full, uncapped, confirming no truncation happens at this layer.
  - [x] Confirm (per Task 4) that re-persisting an already-existing `postUrl` with a *different* `additionalImageUrls` value does **not** overwrite the original row's value — matching the established `content`/no-backfill-except-imageUrl-videoUrl precedent this task deliberately follows.

- [x] **Task 10 (Testing, AC6): Update/extend `process-scrape-job.ts`'s existing test suite**
  - [x] Confirm the `persistScrapedPost` call built from a mapped `ScrapedPost` now includes both `additionalImageUrls` and `hashtags` when present on the source post (a spy/mock assertion on the `persistScrapedPost` call args, matching however this file's current tests already assert call shape — read the existing test file first to match its mocking convention exactly).

- [x] **Task 11 (Testing, AC4): Update `enqueue-post-for-processing.test.ts`**
  - [x] New case: a persisted post with a populated `additionalImageUrls` column produces a `ProcessingJobMessage` carrying the same array.
  - [x] Confirm a post with `additionalImageUrls: null` produces a message where the field is `undefined` (not `null`), matching this function's `?? undefined` convention for every other optional field.

## Dev Notes

### Architecture & UX Gate Findings

- **Epic 3 readiness sweep already covers this story.** `_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md` is `swept: true` (2026-09-11) and explicitly lists `3-3e` in `stories_covered`. Per `story-split-gate.md`'s Epic-Level Sweep Mode, Gate 1 and Gate 3 are cited from that report rather than re-run.
  - **Gate 1 (Architecture/Infrastructure Completeness):** report's own Gate 1 section found exactly one gap epic-wide (`3-4r`, Apify vs. Bright Data outage-alerting parity) — unrelated to this story's scope. **No gap found for 3.3e.**
  - **Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** report states **"No gap found"** epic-wide — all foundational tooling (i18n, GraphQL/codegen scaffold, `activeOnly(table)`, `buildOptimizedDrizzleSelect`, auth context, AI Gateway adapter, KMS/BYOK) already has an owning Epic 0 story. Nothing in this story introduces a new instance of any of those categories.
  - **Lightweight guard (per `bmad-create-story`'s own rule for swept epics):** reasoned whether this story's specific scope contains anything the sweep plausibly didn't anticipate — a new external service, new data entity, or new infra dependency. It does not: this is an additive jsonb column on an existing table plus a mapping-logic change inside an existing, already-swept adapter file (`instagram-adapter.ts`). No fresh Gate 1/3 subagent run was warranted.
- **Gate 2 (UI Complexity & Reusability) — run fresh via subagent persona Freya**, since Gate 2 always stays per-story even for a swept epic. **Verdict: No gap found.** This is a pure backend data-pipeline change (Apify item mapping, a DB column, a domain message-type field) with no React component, hook, or util shared across UI surfaces, and no UX artifact governs it — AC5 explicitly forecloses any rendering/display path.
- **AC6 tradeoff (pre-existing bug found in shared code this story touches):** see the Story section's 2026-09-12 Note above — `AskUserQuestion` was asked (fix `process-scrape-job.ts`'s missing `hashtags` forwarding alongside the new `additionalImageUrls` forwarding, vs. defer it) and went unanswered; defaulted to fixing it now, documented so `bmad-dev-story`/review can revisit if the user disagrees. This is a self-contained AC/task pair (AC6, Task 5's second bullet, Task 10) that can be dropped independently of AC1-5 if overridden.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: mismatch found, now closed by this story.** Before this story, `ScrapedPost` (TS), `scrapedPostSchema` (AJV), `posts` (DB), and `ProcessingJobMessage` (TS) all lack any field to carry a post's non-cover carousel images — Apify's own `childPosts[]` array is fetched from the vendor and silently discarded (confirmed via code trace at `instagram-adapter.ts:237`, per the correct-course session that spawned this story).
- **Impacted fields/contracts:**
  - `packages/domain/src/scraper/types.ts` → `ScrapedPost.additionalImageUrls?: string[]` (new).
  - `apps/backend/src/validation/scraped-post.schema.ts` → `scrapedPostSchema` gains the matching AJV property (load-bearing due to `additionalProperties: false` — see Task 1).
  - `packages/database/schema.ts` → `posts.additionalImageUrls` (`additional_image_urls jsonb`, nullable, new).
  - `apps/backend/src/lib/posts/persist-scraped-post.ts` → `PersistScrapedPostParams.additionalImageUrls` (new, insert-only, no backfill — see Task 4).
  - `packages/domain/src/posts/types.ts` → `ProcessingJobMessage.additionalImageUrls?: string[]` (new).
  - **Deliberately NOT touched:** `apps/backend/src/schema/extraction.graphql`'s `Post` type — confirmed it has no `additionalImageUrls`/equivalent field today, and AC5 requires it stay that way (never displayed in any UI). No `apps/web/src/generated/graphql.ts` or `apps/backend/src/generated/resolvers-types.ts` regeneration needed — no GraphQL schema change.
- **Required DB migration changes:** one `drizzle-kit`-generated migration (Task 3): `ALTER TABLE posts ADD COLUMN additional_image_urls jsonb;`. No backfill for existing rows (they stay `null`, semantically identical to "no carousel data captured," which was already true for every row before this story). No index — nothing queries by this column.
- **Required TypeScript type changes:** listed under "Impacted fields/contracts" above; all four are additive/optional, so no existing call site (including this story's own new ones) is a breaking change.
- **Backward compatibility and rollout notes:** every touched contract adds an *optional* field — no existing caller of `ScrapedPost`, `persistScrapedPost`, or `ProcessingJobMessage` needs to change to keep compiling or behaving identically. The one non-optional-feeling change is the AJV schema addition (Task 1) — without it, real Sidecar posts scraped after deploy would start failing validation under `additionalProperties: false` and silently divert to `persistUnprocessedPayload`, which would be a regression relative to today (today they at least persist, just without the carousel data). Deploy ordering: the DB migration (Task 3) must land before or atomically with the adapter/mapping change (Task 2) and the `persistScrapedPost`/call-site wiring (Tasks 4-5) — inserting a value for a column that doesn't exist yet would error. Since this is a single story shipped as one unit, standard sequential task execution already satisfies this.
- **Verification checks:** Task 7's `instagram-adapter.test.ts` cases (mapping correctness, non-carousel no-op, defensive filtering); Task 8's AJV schema pass/omit cases; Task 9's `persist-scraped-post.test.ts` round-trip/null-default/no-cap/no-backfill cases; Task 3's live-DB column-existence check after `pnpm --filter @festgrid/database run migrate`; Task 10/11's call-site and message-building assertions.

### Project Structure Notes

- **Modified:** `packages/domain/src/scraper/types.ts`, `apps/backend/src/validation/scraped-post.schema.ts`, `apps/backend/src/lib/scraper/instagram-adapter.ts`, `packages/database/schema.ts` (+ new generated migration file under `packages/database/migrations/`), `apps/backend/src/lib/posts/persist-scraped-post.ts`, `apps/backend/src/lib/scraper/process-scrape-job.ts`, `packages/domain/src/posts/types.ts`, `apps/backend/src/lib/posts/enqueue-post-for-processing.ts`, plus each file's corresponding `.test.ts`.
- **Not modified:** `apps/backend/src/schema/extraction.graphql` (deliberately — AC5); `apps/web/*` (zero frontend/UI touch — confirmed by Gate 2 above); `apps/backend/src/lib/scraper/process-brightdata-result.ts` / `brightdata-record-mapper.ts` (Bright Data path, out of AC1's scope — see Task 5's explicit exclusion note); `apps/backend/src/lib/ai-processor/build-gemini-request.ts` / `process-ai-job.ts` (Story 3.6l's scope — this story only makes the data available on `ProcessingJobMessage`, it does not consume it); `SETUP_WALKTHROUGH.md`, `docs/infrastructure/*`, `.env`/`.env.example`, `apps/infrastructure/*` (no new external service, no new queue, no new env var — purely additive data-shape change flowing through already-provisioned infra).
- **Known forward consumer:** Story 3.6l (`backlog`, depends on this story) will read `ProcessingJobMessage.additionalImageUrls` to build a multi-image Gemini request — do not rename the field without checking that story's own Dev Notes once it exists.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3e] — this story's authoritative AC.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6l] — the forward consumer of `additionalImageUrls`/`ProcessingJobMessage`'s new field; confirms the "extraction-time-only, never durable, capped only at extraction" scope boundary this story must respect.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12, #AD-13] — AD-12 (Durable Media Re-hosting) confirms this field must never be re-hosted; AD-13 (Multi-Image Extraction Is Batched, Not Sequential) is this story's own binding architectural rule, explicitly naming `Post.additionalImageUrls` as extraction-time-only/never-durable (Rule 2).
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-03-carousel-multi-image-extraction.md] — the correct-course session that created this story; records the Gemini RPM/RPD/TPM research behind AD-13 and confirms Story 4.2a is unaffected.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept `true`, lists `3-3e` in `stories_covered`; Gate 1's single finding (`3-4r`) and Gate 3's "no gap found" verdict, both cited above instead of re-derived.
- [Source: apps/backend/src/lib/scraper/instagram-adapter.ts] — read in full; `mapApifyItemToScrapedPost` (the function this story edits), `ApifyPostItem` (the raw-item interface to extend), `APIFY_PARSER_VERSION` (the version-stamp convention, confirmed via `git log -p` history of `3.4g` → `3.4m`).
- [Source: apps/backend/src/lib/scraper/instagram-adapter.test.ts] — existing test conventions (`node:test`/`assert`, `setCallApifyActor` mocking) this story's new cases must match.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts, persist-scraped-post.test.ts] — read in full; confirms the existing-row `backfillPatch` special-case is `imageUrl`/`videoUrl`-only, which Task 4 deliberately does not extend to `additionalImageUrls`.
- [Source: apps/backend/src/lib/scraper/process-scrape-job.ts] — read in full; the actual production call site for Story 3.4's daily-batch/on-demand scrape, and the discovery site for the AC6 `hashtags`-forwarding gap. Confirmed (via targeted grep of every `persistScrapedPost(` call site) that `process-apify-async-result.ts` and `replay-actor-run.ts` already forward `hashtags` correctly, while `process-scrape-job.ts` and `process-brightdata-result.ts` do not — only the former is in this story's scope (AC6).
- [Source: apps/backend/src/lib/scraper/process-brightdata-result.ts, brightdata-record-mapper.ts] — read in full to confirm Bright Data's mapper has no `childPosts`-equivalent and does not itself capture `hashtags` from Bright Data's raw record shape; confirmed this is a separate, unaddressed gap, correctly left out of this story's scope per AC1's Apify-only wording.
- [Source: packages/domain/src/scraper/types.ts, packages/domain/src/posts/types.ts, packages/domain/src/posts/index.ts, packages/domain/src/scraper/index.ts, packages/domain/src/index.ts] — confirmed both types are already wildcard-re-exported through `@festgrid/domain`/`@festgrid/domain/posts`, so no barrel-file change is needed beyond the interface edits themselves.
- [Source: apps/backend/src/validation/scraped-post.schema.ts] — read in full; confirms `additionalProperties: false`, making the AJV schema update load-bearing (Task 1).
- [Source: packages/database/schema.ts] — read in full around the `posts` pgTable (and `scraperActorRuns`, `defaultLocation`, `locationDetails`, `previousLocation`/`newLocation`, `proposedData`) to confirm the `.$type<T>()` jsonb convention this story's new column follows.
- [Source: apps/backend/src/lib/posts/enqueue-post-for-processing.ts, enqueue-post-for-processing.test.ts] — read in full; confirms the `?? undefined` normalization pattern Task 6 follows.
- [Source: apps/backend/src/schema/extraction.graphql] — read in full; confirms `Post`'s current field list has no image-URL-array field, matching AC5's "never displayed in any UI" requirement.
- [Source: _bmad-output/implementation-artifacts/3-3a-create-posts-table-and-persist-scraped-posts.md] — precedent for this project's `drizzle-kit generate`/`migrate` task-writing convention and its "live-DB column-existence check" verification step.
- [Source: _bmad-output/implementation-artifacts/3-3d-build-the-reusable-locationpickerfield-component.md] — precedent for this story's own Dev Notes section structure (Architecture & UX Gate Findings / Data Type Compatibility / Project Structure Notes / References).
- [Web research, 2026-09-12: Apify Instagram scraper actor dataset-item schema] — confirmed `type: "Sidecar"` and `childPosts[]` (each with its own `displayUrl`) are real, documented fields of Apify's Instagram post-scraper output, matching epics.md's AC1 exactly; no field-name surprises to correct.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Database & Performance (Drizzle ORM types, `packages/database/.env` vs. Supabase pooler), Data Type Compatibility auto-check rule, Adapter Pattern (external AI/scraper services).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed by this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-12, AD-13 (see References above).
- [x] `docs/infrastructure/2-backend.md` — confirms `AIProcessingQueue`'s existence/role; this story adds no new infra, so no shard update is needed.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modify:** `packages/domain/src/scraper/types.ts` (Task 1) — `ScrapedPost.additionalImageUrls?: string[]`.
- **Modify:** `apps/backend/src/validation/scraped-post.schema.ts` (Task 1) — AJV property addition.
- **Modify:** `apps/backend/src/lib/scraper/instagram-adapter.ts` + `instagram-adapter.test.ts` (Tasks 2, 7) — `ApifyPostItem` extension, `mapApifyItemToScrapedPost` logic, `APIFY_PARSER_VERSION` bump.
- **Modify:** `packages/database/schema.ts` (Task 3) — new `additionalImageUrls` jsonb column on `posts`.
- **Add:** `packages/database/migrations/<next-drizzle-kit-generated-file>.sql` (Task 3) — generated, no hand-edit expected.
- **Modify:** `apps/backend/src/lib/posts/persist-scraped-post.ts` + `persist-scraped-post.test.ts` (Tasks 4, 9) — param threading, insert-only (no backfill).
- **Modify:** `apps/backend/src/lib/scraper/process-scrape-job.ts` + its test suite (Tasks 5, 10) — forward `additionalImageUrls` and `hashtags` (AC6).
- **Modify:** `packages/domain/src/posts/types.ts` (Task 6) — `ProcessingJobMessage.additionalImageUrls?: string[]`.
- **Modify:** `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` + `enqueue-post-for-processing.test.ts` (Tasks 6, 11) — message-building wiring.
- **Not modified:** `apps/backend/src/schema/extraction.graphql`, anything under `apps/web/`, `process-brightdata-result.ts`/`brightdata-record-mapper.ts`, `build-gemini-request.ts`/`process-ai-job.ts`, any IaC/env file.

### Rule Mapping

- Drizzle-kit-generated migration, checked into the repo (project-context.md's DB-schema-change rule) → Task 3.
- `packages/domain` "no DB/ORM/Node-only dependency" restriction → `ProcessingJobMessage`/`ScrapedPost` remain plain interfaces with zero imports beyond TS primitives; the DB-coupled `posts.additionalImageUrls` column type lives in `packages/database`, not `packages/domain` — no leakage.
- Data Type Compatibility auto-check rule → the dedicated Dev Notes subsection above, covering `ScrapedPost`/AJV/DB/`ProcessingJobMessage` end-to-end.
- Story-split-gate.md → Architecture & UX Gate Findings subsection above (epic-readiness citation + fresh Gate 2 run).
- AJV runtime validation at the point of entry (project-context.md's Runtime Schema Validation rule) → Task 1's `scrapedPostSchema` update is precisely what keeps this rule satisfied for the new field.

### Verification Plan

- `pnpm --filter @festgrid/database run generate && pnpm --filter @festgrid/database run migrate` locally, then a live-DB query confirming `additional_image_urls` exists on `posts`.
- `pnpm --filter @festgrid/backend test` (or the equivalent project test command) covering: `instagram-adapter.test.ts` (Task 7), the AJV schema test (Task 8), `persist-scraped-post.test.ts` (Task 9), `process-scrape-job.ts`'s test suite (Task 10), `enqueue-post-for-processing.test.ts` (Task 11).
- Lint/type-check for every touched package (`packages/domain`, `packages/database`, `apps/backend`) — no `any`-typed new surface beyond the pre-existing `mapApifyItemToScrapedPost(item: any)` signature this story does not change.
- Manual/log-based spot-check (optional, not blocking): trigger a real scrape against a known carousel account in a dev environment and confirm `additional_image_urls` populates as expected — genuinely optional since Task 7-9's automated tests already cover the mapping/persistence contract in isolation.

## Pre-Coding Approval Gate

- [x] Scope confirmation — AC1-5 (carousel capture/persist/message-threading) plus AC6 (hashtags-forwarding bug fix, independently droppable if the user overrides the defaulted `AskUserQuestion`).
- [x] Architecture and boundary confirmation — no `packages/domain` DB/Node coupling introduced; no GraphQL/UI surface added (AC5); AD-12/AD-13 boundaries respected.
- [x] Testing plan confirmation — Tasks 7-11 cover mapping, AJV, persistence, call-site wiring, and message-building.
- [x] Explicit human approval state (Default: pending approval).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the swept `epic-3-readiness.md` (no gap for this story); Gate 2 run fresh (no gap); no prerequisite story required.

## Testing Requirements

- [x] Integration tests — Tasks 7, 8, 9, 10, 11 (all `node:test`/`assert`-based, matching this codebase's actual backend testing convention for these files).
- [x] E2E tests — not applicable; this is a backend-only data-pipeline story with no user-facing flow (per project-context.md's testing-trophy philosophy, E2E is reserved for critical user flows, and this story has none).

## Deliverables Checklist

- [x] `ScrapedPost`/`scrapedPostSchema` extended with `additionalImageUrls` (Task 1).
- [x] `instagram-adapter.ts` captures carousel slide URLs from Apify Sidecar items; `APIFY_PARSER_VERSION` bumped (Task 2).
- [x] `posts.additional_image_urls` jsonb column added via generated migration, applied locally (Task 3).
- [x] `persistScrapedPost` persists the new field on insert only, no backfill (Task 4).
- [x] `process-scrape-job.ts` forwards both `additionalImageUrls` and `hashtags` (Task 5, AC6).
- [x] `ProcessingJobMessage`/`enqueuePostForProcessing` carry the field onto the `AIProcessingQueue` (Task 6).
- [x] All new/updated tests (Tasks 7-11) passing.

## Out of Scope

- Story 3.6l's actual consumption of `additionalImageUrls` in `build-gemini-request.ts`/`process-ai-job.ts` (multi-image Gemini request, `minScheduleCount`/`expectedScheduleNames` completeness signal) — separate `backlog` story, already fully specified in `epics.md`, depends on this story.
- `process-brightdata-result.ts`/`brightdata-record-mapper.ts`'s own pre-existing gaps (no `hashtags` capture, no `childPosts`-equivalent data at all) — out of AC1's Apify-only scope, not touched by this story, left as an unaddressed gap for a future story to pick up.
- Any backfill of `additional_image_urls` for posts persisted before this story ships — explicitly not required (AC3 only requires it to work "at persistence time" going forward); those rows simply stay `null`, matching their true historical state (no carousel data was ever captured for them).
- Any UI/GraphQL exposure of this field — explicitly excluded by AC5.

## Definition of Done

- [x] AC1-6 satisfied.
- [x] Required tests (Tasks 7-11) passing; no decrease in overall backend test coverage.
- [x] Lint and type checks passing for `packages/domain`, `packages/database`, `apps/backend`.
- [x] Migration generated, applied locally, and column existence verified live.

## Completion Status

- [x] Complete — implementation finished, moved to review (all AC1-6 and Tasks 1-11 done; migration applied locally; tests/lint/type all pass)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

- `apps/backend/test-full.log` — full backend test suite run (deleted after verification; see Completion Notes for summary)

### Completion Notes List

- **Prior interrupted run:** The working tree already contained a partial implementation of this story (Tasks 1-7 source + `instagram-adapter.test.ts`, migration `0050_complete_xorn.sql`, `ScrapedPost`/`ProcessingJobMessage` type fields, AJV schema, `persistScrapedPost` threading, `process-scrape-job.ts` forwarding, status set to in-progress). The remaining testing tasks (8-11) were not done.
- **Approval:** Pre-Coding Approval Gate was unchecked (pending approval). Via `AskUserQuestion`, the user granted approval to proceed & finish, chose to **keep AC6** (hashtags-forwarding fix), accepted the 3.3a/3.3c review-status dependency gap, and asked to try the local DB for the live migration/column check. All gate checkboxes now marked done.
- **Completed Tasks 8-11:** Added AJV `scrapedPostSchema` tests in `validate.test.ts` (pass with `additionalImageUrls`, omit still passes, rejects undeclared property); added `persist-scraped-post.test.ts` cases (j-k-l-m: jsonb round-trip, null default, 8-entry no-cap, no-overwrite-on-dedupe); added a `process-scrape-job.test.ts` subtest proving `hashtags` (AC6) + `additionalImageUrls` are forwarded through the main scrape path; added `enqueue-post-for-processing.test.ts` cases (d-e: message carries array, null→undefined).
- **Verified (executed, not just asserted):** `pnpm --filter @festgrid/database run generate` → "No schema changes, nothing to migrate" (0050 already generated); `pnpm --filter @festgrid/database run migrate` → "Migrations completed successfully" against local DB (localhost:5432); live `information_schema` query confirmed `posts.additional_image_urls` jsonb and `hashtags` ARRAY both exist. `npx tsc --noEmit` clean in packages/domain, packages/database, apps/backend. Lint clean: backend 0 errors (pre-existing warnings only), domain & database clean (--max-warnings 0). Story test files all pass (55/55 targeted across the 4 DB-backed test files + 5/5 validate.test.ts), and the full `pnpm --filter @festgrid/backend test` run passed with 0 failures.
- **Dependencies accepted per user:** Story 3.3a and Story 3.3c are in `review` (not `done`) in sprint-status.yaml; user chose to proceed (gap accepted) since their contracts are functionally complete and the code builds against them.
- **Out of scope honored:** no GraphQL/UI surface (AC5), no Bright Data path changes, no `build-gemini-request.ts`/`process-ai-job.ts` consumption (Story 3.6l's scope), no backfill.

### File List

- `packages/domain/src/scraper/types.ts` — added `ScrapedPost.additionalImageUrls?: string[]` (Task 1)
- `packages/domain/src/posts/types.ts` — added `ProcessingJobMessage.additionalImageUrls?: string[]` (Task 6)
- `apps/backend/src/validation/scraped-post.schema.ts` — added `additionalImageUrls` AJV property (Task 1)
- `apps/backend/src/validation/validate.test.ts` — added `scrapedPostSchema` AJV test (Task 8)
- `apps/backend/src/lib/scraper/instagram-adapter.ts` — `ApifyPostItem.type`/`childPosts` extension, `mapApifyItemToScrapedPost` carousel logic, `APIFY_PARSER_VERSION` bump to `3.3e` (Task 2)
- `apps/backend/src/lib/scraper/instagram-adapter.test.ts` — 4 new Sidecar mapping cases (Task 7)
- `packages/database/schema.ts` — added `additional_image_urls` jsonb column on `posts` (Task 3)
- `packages/database/migrations/0050_complete_xorn.sql` + `migrations/meta/_journal.json` + `migrations/meta/0050_snapshot.json` — generated migration (Task 3)
- `apps/backend/src/lib/posts/persist-scraped-post.ts` — threaded `additionalImageUrls` into insert-only path (Task 4)
- `apps/backend/src/lib/posts/persist-scraped-post.test.ts` — new cases (j-m) (Task 9)
- `apps/backend/src/lib/scraper/process-scrape-job.ts` — forwarded `additionalImageUrls` and `hashtags` (AC6) (Task 5)
- `apps/backend/src/lib/scraper/process-scrape-job.test.ts` — new carousel/hashtags persistence subtest (Task 10)
- `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` — populated `additionalImageUrls` on `ProcessingJobMessage` (Task 6)
- `apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts` — new cases (d-e) (Task 11)
- `_bmad-output/implementation-artifacts/3-3e-persist-all-carousel-image-urls-for-a-scraped-post.md` — this story file (status → review, tasks/gates checked, completion record)
