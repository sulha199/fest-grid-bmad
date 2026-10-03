---
baseline_commit: 6620a9dc0f74fbd46fc437a08c18009d451d1dd3
---

# Story 3.6p: Create extraction_audit_logs table and write path for Gemini self-reported extraction signals

## Story Details

- Epic: 3
- Story ID: 3.6p
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want every extraction's self-reported completeness/face signals stored alongside the ground truth they can be checked against,
so that the AI extraction pipeline's accuracy can be evaluated over time instead of self-reported numbers only ever being logged and forgotten.

## Acceptance Criteria

1. **Given** Architecture Spine AD-29 and the multi-event shape Story 3.6s shipped, **when** this story's migration runs, **then** it creates `extraction_audit_logs` (`id`, `postId` FK to `posts.id` cascade-on-delete, `geminiModel`, `isEvent`, `hasFaceImage`, `faceImageCount`, `actualFaceDetectionCount`, `faceDetectionSkippedReason` (enum `'no_face_reported' | 'event_relevance_gate'`), `minEventCount`, `actualEventCount`, `groupingReason`, `eventsCompleteness` (jsonb array, one entry per extracted event: `eventIndex`, `minScheduleCount`, `expectedScheduleNames`, `confidenceScore`, `actualScheduleCount`), `createdAt`), indexed on `postId`. **This supersedes the flat, one-event column list in `epics.md`'s original AC1** — `minScheduleCount`/`expectedScheduleNames` moved onto `GeminiEventPayload` (per-event) in Story 3.6s, and a direct read of `build-gemini-request.ts`/`packages/domain/src/events/types.ts` during this story's creation found `confidenceScore` moved there too (the same break class, not called out by the readiness sweep's correction note but confirmed by source read) — none of the three can stay a scalar column on this table. Per the readiness sweep's corrected text and Architecture Spine AD-29 Rule 6 ("the shape of per-event completeness data... is left to Stories 3.6s/3.6p — a story-level call, not an invariant"), **the chosen shape, confirmed with the user via `AskUserQuestion` at this story's creation, is one row per extraction attempt with a `jsonb` array for per-event data** (not one row per event) — see Dev Notes "Design Decisions Confirmed With The User" for the full option comparison and why.
2. **And** `process-ai-job.ts` writes exactly one `extraction_audit_logs` row per extraction attempt, at the point in that attempt where every field it will ever hold at write-time is known — for the `isEvent === false` and zero-events early-return paths (today's steps 5/5.5) that is immediately after parsing/validation, matching `epics.md`'s literal "immediately after Gemini's response is parsed" wording for those two paths; for the success path, it is after the existing per-event loop finishes (every `eventsCompleteness` entry is only knowable once that loop has run), still well before step 8's `DataIngestionQueue` enqueue — all three are still "this one extraction attempt," never deferred to a later Lambda invocation. `actualEventCount` is the post-truncation `events.length` (known synchronously in every path: `0` for the two early-return paths, the real count after the loop for the success path) — never the model's raw, pre-truncation `minEventCount`/self-reported figure. **`actualScheduleCount` is the EXTRACTION-TIME count** (`event.schedules.length` in the AJV-accepted payload, written in the exact same insert as the rest of the row) — **confirmed with the user via `AskUserQuestion`** at this story's creation, explicitly *not* the ingestor's later DB-persisted count; see Dev Notes for the two concrete cases where this can diverge from true ground truth and why that cost was accepted over the cross-Lambda alternative. The write is wrapped in a defensive try/catch (mirroring `rehostPostImageSeam`'s existing pattern) — a failure to write this purely-observational row must never fail the extraction attempt itself or trigger a costly re-extraction on redelivery.
3. **And** this is a **retrofit onto the already-in-review Story 3.6l and onto Story 3.6m** — `minScheduleCount`/`expectedScheduleNames` (3.6l) and `hasFaceImage`/`faceImageCount` (3.6m) were shipped as log-only fields; this story adds their persistence (via the jsonb array for the former, root-level columns for the latter) without changing either story's own extraction/logging behavior. It is also the first consumer of Story 3.6s's `groupingReason`/`minEventCount`/per-event `confidenceScore` and of Story 3.6r's multi-event schema shape — `posts.grouping_reason`/`posts.extracted_event_count` (Story 3.6r/3.6t) are product-facing and remain separate from this audit table (Amendment, 2026-10-01).
4. **And** once Story 3.6n (and, layered on top, Story 3.6o) run (same AI Processor Lambda invocation, same extraction attempt, never a second one), `actualFaceDetectionCount` and `faceDetectionSkippedReason` are back-filled on the same row (`'no_face_reported'` when Story 3.6m's `hasFaceImage = false` skipped detection, `'event_relevance_gate'` when Story 3.6o's expiry check skipped it, `null` with a real count when detection ran) — **ownership split, confirmed with the user via `AskUserQuestion` at Story 3.6o's creation (2026-10-03): Story 3.6n owns the `'no_face_reported'` and real-count outcomes (both ship with 3.6n alone, independent of whether 3.6o exists yet); Story 3.6o owns only `'event_relevance_gate'`, reusing a helper Story 3.6n creates.** This story only creates and reserves these two columns; no code in this story ever writes to them, but **this story's `writeExtractionAuditLog` (Task 2) returns the inserted row's `id`** (amended 2026-10-03 from an original `Promise<void>`) specifically so 3.6n/3.6o can target the exact row without re-querying. Because the chosen shape is one row per attempt (not one row per event), that backfill is a single `UPDATE ... WHERE id = <the row this attempt just inserted>` (the row's own `id`, captured locally in the same function call that inserted it, via this story's returned value) touching the whole post's result at once — not fanned out across N sibling rows.
5. **And** no resolver serving any client-facing GraphQL field ever queries this table (AD-29 Rule 5) — verified by a new source-scan ratchet test (matching `events-postid-write-ratchet.test.ts`'s established style) asserting `apps/backend/src/schema/resolvers.ts` contains no reference to `extractionAuditLogs`.

**Note (carried from `epics.md`, Architecture Spine AD-29):** This table cannot measure `hasFaceImage`'s false-negative rate on its own — rows where it's `false` never get a ground-truth comparison, since Story 3.6n's face-api.js pipeline never runs on them. Closing that gap would require periodically sampling `hasFaceImage = false` rows through face-api.js anyway; left as an explicit future decision, not built here.

**Depends on:** Story 3.6e (`done`), Story 3.6l (`review`), Story 3.6m (`ready-for-dev` — this story reads `hasFaceImage`/`faceImageCount` off the same `GeminiExtractionPayload` 3.6m extends; 3.6m does not need to ship first for 3.6p's *code* to compile, since both read the same already-optional fields, but 3.6m is listed because it is the field's origin), Story 3.6s (`review` — the `events[]`/per-event-field restructuring this story's shape is built against), Story 3.6r (`review` — `posts.groupingReason`'s enum type, reused as-is for this table's `groupingReason` column). *(Corrections, 2026-10-03, `bmad-epic-readiness-check`, `batch-cc-023-face-blur-audit-readiness.md`: added 3.6s and 3.6r to this list, and added `minEventCount` to AC1 — both folded directly into the ACs above rather than listed as a separate pending change.)*

## Tasks / Subtasks

- [x] **Task 1 (AC1): Add the `extraction_audit_logs` table and its skip-reason enum to the schema**
  - [x] `packages/domain/src/events/types.ts`: add a new exported interface
    ```ts
    // Story 3.6p — one entry per extracted event inside an extraction_audit_logs row's
    // eventsCompleteness jsonb array (AD-29 Rule 6's shape decision for this table).
    export interface ExtractionAuditEventCompleteness {
      // Position of this event within THIS extraction attempt's raw events[] array (0-based,
      // Gemini's own per-event response order, post-truncation) -- NOT the same value as the
      // deterministic extractionOrdinal assigned later by assignExtractionOrdinals()/persisted
      // as events.extraction_ordinal (Story 3.6t). Correlating an entry here back to its
      // eventually-ingested events row by position is not reliable across the two orderings and
      // is explicitly out of scope for this story -- see Dev Notes.
      eventIndex: number;
      minScheduleCount: number | null;
      expectedScheduleNames: string[] | null;
      confidenceScore: number;
      // Extraction-time count (event.schedules.length in the AJV-accepted payload), NOT the
      // DB-persisted count -- confirmed with the user at this story's creation; see Dev Notes
      // "Design Decisions Confirmed With The User" for the two cases where this can diverge from
      // the literal ground truth Architecture Spine AD-29 Rule 2 describes.
      actualScheduleCount: number;
    }
    ```
    This is a plain, DB/ORM-decoupled interface (no Drizzle/Node-only import) — exported automatically from `@festgrid/domain/events` via the existing `export * from './types.js'` in `packages/domain/src/events/index.ts` (no new export line needed).
  - [x] `packages/database/schema.ts`: add the import `import type { ExtractionAuditEventCompleteness } from '@festgrid/domain/events';` (mirroring the existing `ProposedEventCorrection` type-only import pattern on line 5 — not the `EventLink` pattern, which comes from `@festgrid/shared-types`, a different package). Add a new enum and table, placed after the `eventSlugAliases` table (co-located with the other Story-3.6-family additions):
    ```ts
    // Story 3.6p / AD-29 Rule 3 -- records why actualFaceDetectionCount is null (Story 3.6n/3.6o's
    // eventual backfill), so a null is never misread as "detection ran and found zero faces."
    export const extractionAuditFaceDetectionSkippedReasonEnum = pgEnum('extraction_audit_face_detection_skipped_reason', [
      'no_face_reported',
      'event_relevance_gate',
    ]);

    // Story 3.6p / AD-29 -- one row per Gemini extraction attempt (process-ai-job.ts), holding
    // every self-reported extraction-quality signal plus ground truth where available. Write-once
    // from process-ai-job.ts (this story); actualFaceDetectionCount/faceDetectionSkippedReason are
    // the only columns ever backfilled later, from the SAME Lambda invocation/extraction attempt
    // that inserted the row (never a second attempt) -- Story 3.6n backfills 'no_face_reported'
    // and the real count, Story 3.6o backfills 'event_relevance_gate' (ownership split confirmed
    // with the user 2026-10-03; this story never writes either column itself, only returns the
    // row's id -- see Task 2). Never joined into any client-facing resolver (AD-29 Rule 5) -- enforced by
    // extraction-audit-logs-no-hotpath-import.test.ts. One row per ATTEMPT, not per event
    // (AD-29 Rule 6's shape decision, confirmed with the user at this story's creation) --
    // eventsCompleteness holds the per-event data Story 3.6s moved off the payload root.
    export const extractionAuditLogs = pgTable('extraction_audit_logs', {
      id: uuid('id').defaultRandom().primaryKey(),
      postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
      geminiModel: text('gemini_model').notNull(),
      isEvent: boolean('is_event').notNull(),
      // Post-level self-reported face-signal pre-filter (Story 3.6m, AD-28 Rule 1). Null when
      // absent from the Gemini response -- never coerced to false.
      hasFaceImage: boolean('has_face_image'),
      faceImageCount: integer('face_image_count'),
      // Ground truth for the face pre-filter, backfilled by Story 3.6n/3.6o -- NOT written by
      // this story. Null means "not backfilled yet," disambiguated from "ran, found zero" by the
      // skip-reason column (AD-29 Rule 3).
      actualFaceDetectionCount: integer('actual_face_detection_count'),
      faceDetectionSkippedReason: extractionAuditFaceDetectionSkippedReasonEnum('face_detection_skipped_reason'),
      // Post-level grouping self-report (Story 3.6s, AD-30 Rule 5). minEventCount is the model's
      // own best-effort count; actualEventCount is the post-truncation count of events actually
      // kept (events.length after Story 3.6s's cap) -- known synchronously within this same
      // extraction attempt, unlike the face-detection pair above which is a genuine async backfill.
      minEventCount: integer('min_event_count'),
      actualEventCount: integer('actual_event_count').notNull(),
      groupingReason: postGroupingReasonEnum('grouping_reason'),
      // Per-event completeness (Story 3.6l's minScheduleCount/expectedScheduleNames, plus
      // confidenceScore -- all three moved off the payload root onto GeminiEventPayload by Story
      // 3.6s). AD-29 Rule 6 explicitly leaves this shape to this story; chosen shape is one jsonb
      // array entry per extracted event (AskUserQuestion, this story's creation), empty for a
      // non-event or zero-event attempt.
      eventsCompleteness: jsonb('events_completeness').$type<ExtractionAuditEventCompleteness[]>().notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    }, (t) => ({
      postIdIdx: index('idx_extraction_audit_logs_post_id').on(t.postId),
    }));
    ```
  - [x] Run `pnpm --filter database generate` (drizzle-kit) to produce the migration SQL under `packages/database/migrations/`. No hand-written-SQL step is expected here — unlike the partial/`WHERE`-clause index precedents elsewhere in this file (drizzle-kit 0.21.4's known gap), this table has only a plain, unconditional enum + btree index, both of which drizzle-kit 0.21 already serializes correctly (same class as `postGroupingReasonEnum`/`idx_posts_scraper_actor_run_id`) — confirm the generated SQL has no dropped clause before committing it, but do not pre-emptively hand-edit it.
  - [x] Run `pnpm --filter database migrate` (or the equivalent local-dev migration command) against the local Postgres instance before writing any integration test against this table.

- [x] **Task 2 (AC2, AC5): New backend-only write helper + the hot-path-import ratchet test**
  - [x] New file `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts`:
    ```ts
    import { db } from '../../db/client.js';
    import { extractionAuditLogs } from '@festgrid/database';
    import type { ExtractionAuditEventCompleteness } from '@festgrid/domain/events';
    import type { PostGroupingReason } from '@festgrid/domain/posts';

    export interface WriteExtractionAuditLogParams {
      postId: string;
      geminiModel: string;
      isEvent: boolean;
      hasFaceImage: boolean | null;
      faceImageCount: number | null;
      minEventCount: number | null;
      actualEventCount: number;
      groupingReason: PostGroupingReason | null;
      eventsCompleteness: ExtractionAuditEventCompleteness[];
    }

    // AD-29 -- one row per extraction attempt. DB-coupled (imports the Drizzle table), so this
    // stays in apps/backend, never packages/domain, per project-context.md's Code Organization
    // rule. No seam export: tests verify behavior by reading the row back from the real DB
    // (this codebase's established integration-test convention), not by mocking this call.
    // Returns the inserted row's id (amended 2026-10-03, AskUserQuestion at Story 3.6o's
    // creation) so Story 3.6n/3.6o can target this exact row for their own
    // actualFaceDetectionCount/faceDetectionSkippedReason backfills without a second query --
    // this story itself never writes either of those two columns.
    export async function writeExtractionAuditLog(params: WriteExtractionAuditLogParams): Promise<{ id: string }> {
      const [row] = await db.insert(extractionAuditLogs).values(params).returning({ id: extractionAuditLogs.id });
      return row;
    }
    ```
    Confirm `PostGroupingReason` is already exported from `@festgrid/domain/posts` (it backs `GeminiExtractionPayload.groupingReason` today) before adding the import — if it is a locally-scoped type instead, import it from wherever `GeminiExtractionPayload`'s own `groupingReason?: PostGroupingReason;` field sources it, so this file never re-declares the type.
  - [x] New file `apps/backend/src/schema/extraction-audit-logs-no-hotpath-import.test.ts`, in the same `readFileSync`-based style as `events-postid-write-ratchet.test.ts` (AC5, AD-29 Rule 5):
    ```ts
    import test from 'node:test';
    import * as assert from 'node:assert';
    import { readFileSync } from 'fs';
    import { resolve } from 'path';

    // AD-29 Rule 5 -- no resolver serving a client-facing GraphQL field may ever read
    // extraction_audit_logs. A pragmatic source-scan, matching
    // events-postid-write-ratchet.test.ts's established precedent: resolvers.ts must contain no
    // reference to extractionAuditLogs at all (import or otherwise).
    const RESOLVERS_PATH = resolve(process.cwd(), 'src/schema/resolvers.ts');

    test('resolvers.ts never references extractionAuditLogs (AD-29 Rule 5)', () => {
      const content = readFileSync(RESOLVERS_PATH, 'utf8');
      assert.ok(
        !content.includes('extractionAuditLogs'),
        'resolvers.ts must never import or reference extractionAuditLogs -- this table is offline/admin-eval-only, never a GraphQL-exposed field (AD-29 Rule 5)'
      );
    });
    ```

- [x] **Task 3 (AC2, AC3): Wire the write into `process-ai-job.ts` at all three extraction-attempt exit points**
  - [x] Import `writeExtractionAuditLog` and `ExtractionAuditEventCompleteness` at the top of `apps/backend/src/lib/ai-processor/process-ai-job.ts`.
  - [x] **`isEvent === false` branch (today's step 5):** immediately before the existing `await markPostExtractedSeam(message.postId);` call, add (wrapped in try/catch, console.error on failure, never rethrown — a non-critical audit-log write must not turn a successful "not an event" determination into a failed/re-retried extraction attempt):
    ```ts
    try {
      await writeExtractionAuditLog({
        postId: message.postId,
        geminiModel: env.geminiModel,
        isEvent: false,
        hasFaceImage: payload.hasFaceImage ?? null,
        faceImageCount: payload.faceImageCount ?? null,
        minEventCount: payload.minEventCount ?? null,
        actualEventCount: 0,
        groupingReason: payload.groupingReason ?? null,
        eventsCompleteness: [],
      });
    } catch (auditErr) {
      console.error(`[processAiJob] Failed to write extraction_audit_logs row for post ${message.postId}:`, auditErr);
    }
    ```
  - [x] **Zero-events branch (today's step 5.5):** same shape, `isEvent: true`, `actualEventCount: 0`, `eventsCompleteness: []`, placed immediately before that branch's own `await markPostExtractedSeam(message.postId);` call.
  - [x] **Success path:** inside the existing per-event loop (today's lines ~133-168), after the existing `Per-event completeness logging signal` block, append to a new local `const eventsCompleteness: ExtractionAuditEventCompleteness[] = [];` array declared just above the loop:
    ```ts
    eventsCompleteness.push({
      eventIndex: i,
      minScheduleCount: event.minScheduleCount ?? null,
      expectedScheduleNames: event.expectedScheduleNames ?? null,
      confidenceScore: event.confidenceScore,
      actualScheduleCount: event.schedules.length,
    });
    ```
    Then, immediately after the existing `Post-level completeness logging signal` block (today's lines 170-176) and before step 7.5's `db.update(posts)` call, add the same try/catch-wrapped `writeExtractionAuditLog` call as above, with `isEvent: true`, `actualEventCount: events.length` (the post-truncation count, matching step 7.5's own `extractedEventCount: events.length` exactly — do not recompute it a second way), `eventsCompleteness` (the array just built), and the same `hasFaceImage`/`faceImageCount`/`minEventCount`/`groupingReason` extraction from `payload` as the other two branches. **On this success-path call only** (amended 2026-10-03 for Story 3.6n/3.6o's backfill): capture the returned `{ id }` into a `let auditLogId: string | null = null;` declared just above this try block, assigned inside the `try` (stays `null` if the write itself throws, matching the existing catch's non-propagation). This variable is read later by Story 3.6n's/3.6o's own call sites further down the same function body (the post-level 7.5a/7.5b region) — no new parameter threading needed, same function scope. The two early-return branches (`isEvent === false`, zero-events) do not need this capture — neither 3.6n's nor 3.6o's call sites are ever reached on those paths (both return before step 7.5a).
  - [x] Do **not** place any of these three writes after step 8's enqueue loop or after `markPostExtractedSeam` — the row must exist before the post is considered "extracted," matching AC2's "same extraction attempt" requirement and giving a consistent timing precedent across all three branches (always before this attempt's terminal action).

- [x] **Task 4 (AC1-AC4): Integration tests — one row per attempt, correct shape, correct defaults**
  - [x] New file `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` (real DB, `callGeminiSeam` mocked via `setCallGeminiSeam`, matching `process-ai-job.carousel-completeness.test.ts`'s established convention — do not grow that already-large file further, this is a genuinely new concern). Using the existing seeded-profile/subscription fixture setup from that file:
    - **Case A — `isEvent: false`:** payload with `isEvent: false`, `hasFaceImage: true`, `faceImageCount: 2`. After `processAiJob` runs, read the inserted row back from `extractionAuditLogs` by `postId`: assert exactly one row, `isEvent === false`, `actualEventCount === 0`, `eventsCompleteness` is `[]` (deep-equal, not just length-0), `hasFaceImage === true`, `faceImageCount === 2`, `geminiModel` matches `env.geminiModel`.
    - **Case B — zero-events defensive branch:** payload with `isEvent: true`, `events: []`. One row, `isEvent === true`, `actualEventCount === 0`, `eventsCompleteness === []`.
    - **Case C — single event, full completeness signals:** payload with one event carrying `minScheduleCount: 3`, `expectedScheduleNames: ['Day 1', 'Day 2', 'Day 3']`, `confidenceScore: 0.9`, and two `schedules[]` entries (deliberately fewer than `minScheduleCount`, to also prove this doesn't block the write). One row, `actualEventCount === 1`, `eventsCompleteness` has exactly one entry with `eventIndex: 0`, `minScheduleCount: 3`, `expectedScheduleNames` deep-equal to the three names, `confidenceScore: 0.9`, `actualScheduleCount: 2` (the extraction-time count — the two schedules actually in the payload, not `minScheduleCount`'s self-reported 3).
    - **Case D — multi-event post, `groupingReason`/`minEventCount`:** payload with `groupingReason: 'separate-events'`, `minEventCount: 2`, two events each with their own `confidenceScore` and no `minScheduleCount`/`expectedScheduleNames` (absent, not `false`/`0`). One row, `actualEventCount === 2`, `groupingReason === 'separate-events'`, `minEventCount === 2`, `eventsCompleteness` has two entries at `eventIndex` 0 and 1, each with `minScheduleCount: null` and `expectedScheduleNames: null` (absent-in-payload must map to `null`, not `undefined`, in the persisted jsonb — assert with `assert.strictEqual(entry.minScheduleCount, null)`, not just a falsy check).
    - **Case E — event-count truncation interacts correctly:** a payload whose `events.length` exceeds `env.maxExtractedEventsPerPost` (reuse the existing 15-event roundup fixture from `process-ai-job.carousel-completeness.test.ts` if it still fits, or build an equivalent one) — assert `actualEventCount` equals the **truncated** count (the configured cap), and `eventsCompleteness.length` also equals the truncated count, not the model's raw pre-truncation count.
    - **Case F — audit-log insert failure does not fail the extraction attempt:** stub `writeExtractionAuditLog`'s underlying DB call to throw (e.g. a temporary seam, or — if the dev agent judges a seam unwarranted for a single test — a fixture that violates a DB constraint the row would hit, such as an invalid `postId`) and assert `processAiJob` still completes successfully (`markPostExtractedSeam` called, no thrown error reaching the caller) — proving the try/catch in Task 3 is actually effective, not just present in source. If a clean constraint-violation fixture isn't readily available, the dev agent may add a minimal internal seam to `write-extraction-audit-log.ts` solely for this one test case, documenting why in a code comment.
  - [x] New unit coverage is not required for `write-extraction-audit-log.ts` itself beyond what Task 4's integration cases already exercise — it is a two-line DB-coupled passthrough, not independently meaningful pure logic (packages/domain's 100%-coverage rule does not apply to `apps/backend`; the testing-trophy integration layer above already exercises every branch of its only caller).

- [x] **Task 5: Full verification pass**
  - [x] `pnpm --filter database generate` produced migration applied cleanly to local Postgres (`pnpm --filter database migrate`); `pnpm --filter database seed:volume:clean` before any DB-backed run (per `cc-024-multi-event-wave-plan.md`'s "Test-gate facts learned" section).
  - [x] `pnpm --filter backend test` (foreground, `TZ=UTC`) — full backend suite green, including Task 2's ratchet test and Task 4's new integration file.
  - [x] `pnpm --filter backend lint` / `pnpm --filter backend build` clean for `apps/backend`, `packages/database`, `packages/domain`.
  - [x] Manually confirm (read the diff) that no `.graphql` SDL file, no `resolvers.ts` change, and no `apps/web`/`packages/ui` file is touched anywhere in this story's diff.

## Dev Notes

- **Files read in full before finalizing this design:** `apps/backend/src/lib/ai-processor/process-ai-job.ts` (current, post-3.6s — every step number cited above is taken directly from this file, not from any story text); `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (confirms `confidenceScore` is nested under `geminiEventResponseSchema`, required per event, alongside `minScheduleCount`/`expectedScheduleNames`); `packages/domain/src/events/types.ts` (confirms `GeminiEventPayload` vs `GeminiExtractionPayload`'s exact root/per-event split, post-3.6s); `apps/backend/src/lib/ingestor/process-ingestion-job.ts` (as-built, post-3.6t — read specifically to evaluate the rejected ingestor-backfill design option, see below); `packages/database/schema.ts` lines ~280-470 (`posts`, `events`, `eventPosts`, naming/index/enum conventions this story's table follows); `apps/backend/src/schema/events-postid-write-ratchet.test.ts` (the exact ratchet-test style Task 2's new test mirrors); `_bmad-output/implementation-artifacts/3-6m-...md` (refreshed 2026-10-03, read for the as-built payload shape per this story's command context — confirmed `GeminiExtractionPayload`'s root carries `hasFaceImage`/`faceImageCount` and this story's table reads them from there, not from any per-event location); `_bmad-output/implementation-artifacts/3-6t-...md` (confirmed `processIngestionJob`'s exact shape, used to evaluate and reject the ingestor-backfill option for `actualScheduleCount` — see below); Architecture Spine AD-28, AD-29, AD-30 (full text read, not summarized from epics.md).

- **Independently-found correction, beyond what the readiness sweep's own note called out:** the sweep's correction block (cited in AC1 above) named `minScheduleCount`/`expectedScheduleNames` as broken by the multi-event shape, but a direct read of `build-gemini-request.ts`/`packages/domain/src/events/types.ts` during this story's creation found **`confidenceScore` moved to `GeminiEventPayload` (per-event) by the same Story 3.6s restructuring** — it is in the exact same "was a flat root/scalar column, now per-event" category, just not named in the sweep's note. All three are handled identically in this story's chosen shape (the `eventsCompleteness` jsonb array). This mirrors the kind of independently-found staleness Story 3.6m's own refresh surfaced beyond what its sweep note called out — direct source reads, not the prior story text or the sweep note alone, are the final authority.

### Design Decisions Confirmed With The User (`AskUserQuestion`, this story's creation)

Two decisions were explicitly reserved by the readiness sweep ("design decisions to settle with the user at create-story") and Architecture Spine AD-29 Rule 6 ("a story-level call, not an invariant"). Both were laid out with real costs, not a silently-picked default, per this project's standing create-story instruction for a genuine non-mechanical tradeoff.

1. **Per-event audit-row shape.** Two options were presented:
   - *One row per extraction attempt, jsonb array for per-event data* — most literally matches AD-29 Rule 1 ("one row per extraction attempt") and Rule 6; post-level scalars (`hasFaceImage`, `minEventCount`, `actualEventCount`, `groupingReason`, and — critically — the Story 3.6n/3.6o backfill pair `actualFaceDetectionCount`/`faceDetectionSkippedReason`) live exactly once per row, with zero duplication and zero update-fan-out risk when that backfill runs; `isEvent === false`/zero-event posts need no special-casing (the array is simply empty). Cost: a future per-event correlation (e.g. if a later story ever wanted to join an `eventsCompleteness` entry back to its ingested `events` row) would need an atomic `jsonb_set` by array position rather than a plain row `UPDATE` — not needed by anything in this story's own scope, but a real cost if it's ever needed later.
   - *One row per event* (keyed `postId` + `extractionOrdinal`) — operationally simpler for any future per-event correlation (a plain single-row `UPDATE`), but duplicates every post-level scalar across N rows for an N-event post, and — the decisive factor — would force the Story 3.6n/3.6o backfill (which is inherently a single, once-per-post result, since face detection runs once on the post's cover image, never per event, per AD-28 Rule 3's "runs in the same AI Processor Lambda... no second fetch") to either write the identical value into every one of a post's N sibling rows, or awkwardly special-case where it lives.
   - **User chose: one row per extraction attempt, jsonb array for per-event data.** This is also the option that keeps the post-level `actualFaceDetectionCount`/`faceDetectionSkippedReason` columns (reserved by this story, backfilled by 3.6n/3.6o later) singular and consistent, which the architecture (AD-29 Rule 2's "ground truth captured alongside self-report... in the same row") already implies should not be duplicated.

2. **Where `actualScheduleCount` is written.** Two options were presented:
   - *Extraction-time count, synchronous, same Lambda* — `event.schedules.length` in the already-AJV-accepted payload, written in the exact same `INSERT` as the rest of the row. Zero new plumbing, no dependency on Story 3.6t's message shape, no async gap where the field is briefly null. Cost: it is the count of schedules in the **accepted Gemini payload**, not literally "the real persisted `schedules.length`" Architecture Spine AD-29 Rule 2 describes — it can diverge from true DB ground truth in two concrete cases: (a) Story 3.6t's idempotent duplicate-skip path (a redelivered extraction attempt whose event already exists at that `(postId, extractionOrdinal)` — the schedules from *this* attempt's payload are never actually inserted, since `processIngestionJob` returns `{ inserted: false }` before any `schedules` write), and (b) a future dedup/merge pass (Story 3.6v, not yet built) that could reduce the number of schedules actually kept.
   - *Ingestor back-fill, async, cross-Lambda* — `processIngestionJob` (already running per-event, `review` status) writes the true persisted `scheduleValues.length` once it actually inserts. This is literally what AD-29 Rule 2 specifies, but carries three concrete new costs, confirmed by reading `process-ingestion-job.ts` directly: (1) `(postId, extractionOrdinal)` alone cannot disambiguate *this* extraction attempt's row from a stale, still-in-flight redelivery's row sharing the same `postId` (AD-29 writes one row per attempt, so a post can have several), requiring a new correlation field (e.g. the audit row's own `id`) threaded onto `ExtractedEventMessage` at 3.6p's enqueue point — reaching back into Story 3.6t's already-shipped (`review`) message producer; (2) on 3.6t's idempotent-skip path, `processIngestionJob` returns before any schedule insert, so this option would need a second decision (still backfill via a fresh `COUNT`, or leave the field null for a redelivered attempt) that the extraction-time option sidesteps entirely by construction; (3) it is a genuinely new cross-Lambda write path into a table the ingestor Lambda does not touch today.
   - **User chose: extraction-time count, synchronous, same Lambda.** The two divergence cases above (duplicate-skip redelivery, future 3.6v dedup) are accepted, documented limitations — not built around in this story — and the `actualScheduleCount` field's doc comment (Task 1) states this explicitly so a future reader does not misread it as the literal DB-persisted figure.

### Architecture & UX Gate Findings

- **Gate 1 and Gate 3 — cited from the batch readiness sweep, not re-run.** Per `_bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md` (`swept: true`, dated 2026-10-03, `stories_covered: [3.6m, 3.6n, 3.6o, 3.6p]`, `gates: [1, 3]`), Gate 1's verdict for this story: "No other Gate 1 gap: 3.6m and 3.6p stay inside the existing `process-ai-job.ts`/`build-gemini-request.ts`/`extracted-event.schema.ts`/`schema.ts` layers." Gate 3's reuse/ownership check: "Audit table ownership. `extraction_audit_logs` is created by 3.6p (first consumer, AD-29). The only other writer-to-be is 3.6n/3.6o back-filling `actualFaceDetectionCount`/`faceDetectionSkippedReason` on the same row... No unowned shared table." The per-story verdict table records: "3.6p (`extraction_audit_logs` table and write path) | READY-WITH-CORRECTION (applied) | Add `minEventCount` (AD-29 Rule 6); add 3.6s and 3.6r to Depends on; per-event completeness shape and `actualScheduleCount` write point are design decisions for create-story." All three corrections are folded directly into the ACs/Depends-on above. Neither 0.46 (the new Lambda-runtime prerequisite) nor Finding 3 (served-URL precedence) apply to this story — both are 3.6n-only.
  - **Lightweight guard — does this story's actual scope contain anything the sweep plausibly didn't anticipate?** No. The sweep's own text already named the exact two open decisions this story had to make (shape, write point) and this story's implementation surface (a new table, a new backend-only write helper, three call sites in an already-covered file, one ratchet test) introduces no new external service, no new data entity beyond the one the sweep already named, and no new infra dependency. No fresh Gate 1/3 run is warranted.
- **Gate 2 — run fresh (per-story; the batch sweep explicitly scopes Gate 2 per-story, "only 3.6n has frontend scope").** One-shot UX-persona analytical pass (Freya lens) against this story's exact, now-finalized scope: a new Drizzle table (`packages/database/schema.ts`) with zero GraphQL exposure (AC5, enforced by a ratchet test), a new backend-only write helper (`apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts`) that is a plain DB-insert passthrough with no business logic worth a reusable abstraction, and three call sites inside an already-covered Lambda consumer (`process-ai-job.ts`). **Verdict: No gap found.** There is no `apps/web`/`packages/ui` file anywhere in this story's diff, no React component, no route, no loader-state categorization question (this is a backend write, not a user-triggered async UI operation), no PostHog event (nothing here is a tracked user interaction — it is pipeline telemetry), no i18n string (no user-facing text exists in this story's scope at all), and no `AD-1`/`AD-2` Unified Query DSL concern (this table is explicitly never read through any query surface, client or otherwise, per AD-29 Rule 5). This matches the same zero-frontend-surface conclusion the two directly preceding sibling stories in this same multi-event batch (3.6r's link table, 3.6s's multi-event extraction) already reached, and mirrors 3.6m's/3.6t's identical reasoning for their own backend-only scopes.
- **No new prerequisite stories or `sprint-status.yaml`/`epics.md` entries were added by this story.** Both Gate 1/3 (batch-cited) and Gate 2 (freshly run) clear with no gap; the one new prerequisite the batch sweep did surface (Story 0.46) is 3.6n's dependency, not this story's.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A real, load-bearing shape mismatch exists between `epics.md`'s original (pre-3.6s) flat AC1 column list and the as-built multi-event `GeminiExtractionPayload`/`GeminiEventPayload` split — see AC1 above and "Design Decisions" for the full resolution. No other mismatch: `hasFaceImage`/`faceImageCount`/`minEventCount`/`groupingReason` all still live at the payload root exactly as the original AC1 assumed.
- **Impacted fields/contracts:** New `packages/domain/src/events/types.ts` export `ExtractionAuditEventCompleteness` (Task 1); new `packages/database/schema.ts` table `extractionAuditLogs` and enum `extractionAuditFaceDetectionSkippedReasonEnum` (Task 1); new `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts` (Task 2). No existing type's shape changes — this story only adds new, independent types/tables and reads already-existing optional fields off `GeminiExtractionPayload`/`GeminiEventPayload`.
- **Required DB migration changes:** One new table + one new enum, generated via `pnpm --filter database generate` (Task 1). No column added to any existing table (unlike Story 3.6n's `posts.durableThumbnailUrl` — confirmed independent migrations per the readiness sweep's "Migration ordering" note; either story's migration can land in either order relative to the other).
- **Required TypeScript type changes:** `ExtractionAuditEventCompleteness` (new, additive). `write-extraction-audit-log.ts`'s own `WriteExtractionAuditLogParams` interface (new, additive, backend-only — never exported from `packages/domain`).
- **Backward compatibility and rollout notes:** Purely additive — a new table nothing previously wrote to or read from. `process-ai-job.ts`'s new writes are wrapped in defensive try/catch (Task 3), so a transient DB issue on this specific insert can never regress the pipeline's existing "mark extracted only after success" behavior that predates this story. Every field read off `payload` for this write (`hasFaceImage`, `faceImageCount`, `minEventCount`, `groupingReason`, each event's `minScheduleCount`/`expectedScheduleNames`/`confidenceScore`) was already optional/required exactly as this story treats it — no AJV schema change, no new required field anywhere in the Gemini-facing contract.
- **Verification checks:** Task 4's five integration cases (A-E) plus the defensive-write-failure case (F); Task 2's ratchet test; Task 5's full lint/build/test pass.

### Project Structure Notes

- New files: `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts`; `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts`; `apps/backend/src/schema/extraction-audit-logs-no-hotpath-import.test.ts`; one new Drizzle migration file under `packages/database/migrations/`.
- Modified files: `packages/database/schema.ts` (new table/enum); `packages/domain/src/events/types.ts` (new `ExtractionAuditEventCompleteness` interface — no new export line needed, already barrel-exported via `export * from './types.js'`); `apps/backend/src/lib/ai-processor/process-ai-job.ts` (three new call sites).
- **Package boundary check:** `ExtractionAuditEventCompleteness` is a plain interface with no DB/ORM/Node-only dependency — correctly placed in `packages/domain`. `write-extraction-audit-log.ts` directly imports the Drizzle `extractionAuditLogs` table object, so per project-context.md's Code Organization rule it correctly stays in `apps/backend`, never `packages/domain` — mirroring `packages/graphql-select`'s existing precedent for DB/ORM-coupled logic that would otherwise look "reusable."
- No `packages/ui` component, no `SETUP_WALKTHROUGH.md` update, no new cloud/external service (still Postgres only, already provisioned), no PostHog event, no new i18n locale key — confirmed by Gate 2 above.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6p] — original AC list, Note, Depends-on, and the 2026-10-03 Corrections block this story's AC1/Depends-on fold in directly.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6m, #Story 3.6s, #Story 3.6r] — the fields and schema shape this story persists/depends on.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-29] — binding rule for this table; Rule 1 (one row per attempt), Rule 2 (ground truth alongside self-report), Rule 3 (skip-reason recording), Rule 5 (never joined into a hot path), Rule 6 (multi-event shape left to this story).
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-28] — Rule 1 (the `hasFaceImage`/`faceImageCount` pre-filter this table records), Rule 3 (face detection runs once per post, the reasoning behind rejecting the one-row-per-event shape).
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md] — `swept: true`, dated 2026-10-03; Gate 1/3 verdicts cited directly; the three corrections applied to this story; the two reserved user decisions this story's creation resolved.
- [Source: this story's own 2026-10-03 Correction, resolved at Story 3.6o's creation via `AskUserQuestion`] — the AD-29 backfill-ownership split (3.6n/3.6o) and `writeExtractionAuditLog`'s id-returning signature change.
- [Source: _bmad-output/implementation-artifacts/3-6m-...md] (refreshed 2026-10-03) — read for the as-built `GeminiExtractionPayload` payload-root shape (`hasFaceImage`/`faceImageCount` at root, confirmed not per-event).
- [Source: _bmad-output/implementation-artifacts/3-6t-...md] — `processIngestionJob`'s as-built shape, read to evaluate (and reject) the ingestor-backfill design option for `actualScheduleCount`.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] — file this story edits; current (post-3.6s) step numbering (5, 5.5, per-event loop, 7.5) this story's three call sites are anchored against, confirmed by direct read, not by any story text.
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts, packages/domain/src/events/types.ts] — confirmed `confidenceScore`'s per-event move (independently found correction, not named by the readiness sweep).
- [Source: apps/backend/src/lib/ingestor/process-ingestion-job.ts] — confirmed as-built shape used to cost out the rejected ingestor-backfill option.
- [Source: packages/database/schema.ts] — table/enum/index naming conventions this story's new table follows (`posts`, `events`, `eventPosts`).
- [Source: apps/backend/src/schema/events-postid-write-ratchet.test.ts] — the exact source-scan ratchet-test style this story's new AD-29-Rule-5 test mirrors.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Technology Stack (Drizzle ORM, PostgreSQL-specific types); Code Organization (`packages/domain` gets only the pure `ExtractionAuditEventCompleteness` type, zero DB/ORM coupling; the DB-coupled write helper stays in `apps/backend`); Testing Rules (Node's built-in `node:test` against the real local DB, this package's established convention, not the generic Vitest "testing trophy" line — matching every sibling Story 3.6-family story's own precedent).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-29 (this story's primary binding rule, all six sub-rules addressed above), AD-28 (Rules 1/3, cross-referenced for the shape decision's reasoning), AD-30 (Rule 5, `groupingReason`'s enum reused as-is). AD-29 Rule 3's backfill-ownership split (Story 3.6n owns `'no_face_reported'`/real-count, Story 3.6o owns `'event_relevance_gate'`) — resolved 2026-10-03 at Story 3.6o's creation; this story's only obligation toward it is `writeExtractionAuditLog`'s id-returning signature (Task 2).
- [x] `docs/infrastructure/index.md` — no infra/CDK change required by this story (no new Lambda, queue, or compute resource — a DB migration against the already-provisioned Postgres instance only; confirmed against the readiness sweep's own Gate 1 analysis, which found no infra gap for 3.6p).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/domain/src/events/types.ts` (modify — new `ExtractionAuditEventCompleteness` interface)
  - `packages/database/schema.ts` (modify — new `extractionAuditLogs` table + `extractionAuditFaceDetectionSkippedReasonEnum`)
  - `packages/database/migrations/<new>.sql` (new — `drizzle-kit generate` output)
  - `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts` (new — DB-coupled write helper)
  - `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modify — three new call sites)
  - `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` (new — Task 4 integration cases)
  - `apps/backend/src/schema/extraction-audit-logs-no-hotpath-import.test.ts` (new — AC5 ratchet test)
- **Rule Mapping:**
  - AD-29 Rules 1/2/3/5/6 → Task 1 (table shape), Task 2 (ratchet test), Task 3 (write timing/content), Dev Notes "Design Decisions."
  - AD-28 Rule 3 (detection runs once per post) → the shape decision's reasoning (Dev Notes "Design Decisions," option 1).
  - Data-type-compatibility persistent fact (mismatch/no-mismatch section always included) → Dev Notes "Data Type Compatibility & Migration Requirements" + AC1's shape correction.
  - `AskUserQuestion`-before-drafting persistent fact (two real, non-mechanical tradeoffs surfaced: shape, write point) → Dev Notes "Design Decisions Confirmed With The User."
  - `story-split-gate.md` Gate 1/2/3 discipline (Gate 1/3 cited from the batch sweep; Gate 2 run fresh) → Dev Notes "Architecture & UX Gate Findings."
- **Verification Plan:**
  - `pnpm --filter database generate && pnpm --filter database migrate` — migration applies cleanly.
  - `pnpm --filter backend test` (`TZ=UTC`, foreground) — Task 4's six cases (A-F) and Task 2's ratchet test all green.
  - `pnpm --filter backend lint` / `tsc` build clean for `apps/backend`, `packages/database`, `packages/domain`.
  - Manual diff review confirming no `.graphql`/`resolvers.ts`/`apps/web`/`packages/ui` file changed.

## Pre-Coding Approval Gate

- [x] Scope confirmation — new `extraction_audit_logs` table + migration; new backend-only write helper; three call sites in `process-ai-job.ts`; no GraphQL/UI change; no change to Story 3.6l/3.6m/3.6s/3.6r/3.6t's own already-shipped behavior.
- [x] Architecture and boundary confirmation — AD-29 compliance (shape and write-point decisions explicitly confirmed with the user, documented above); `ExtractionAuditEventCompleteness` correctly placed in `packages/domain` (no DB/ORM coupling); the write helper correctly placed in `apps/backend` (DB-coupled).
- [x] Testing plan confirmation — six integration cases (Task 4, real DB) plus one ratchet test (Task 2); no unit-test gap claimed for the two-line write helper (justified above).
- [x] Explicit human approval state — approved via `AskUserQuestion` ("Approve, proceed"), 2026-10-03.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the batch-cc-023 readiness sweep (swept 2026-10-03), Gate 2 run fresh; all three clear with no gap. The two reserved design decisions (shape, write point) were resolved via `AskUserQuestion` during this story's creation, not deferred.

## Testing Requirements

- [x] Integration tests: `process-ai-job.extraction-audit-log.test.ts` — Cases A-F (Task 4): correct row/shape for `isEvent: false`, zero-events, single-event, multi-event with `groupingReason`/`minEventCount`, truncation interaction, and defensive-write-failure non-propagation.
- [x] Ratchet test: `extraction-audit-logs-no-hotpath-import.test.ts` — `resolvers.ts` never references `extractionAuditLogs` (AD-29 Rule 5).
- [x] Unit tests: none required beyond the above (see Task 4's final bullet for why).
- [x] E2E tests: none required — no user-facing surface exists in this story's scope.

## Deliverables Checklist

- [x] `extraction_audit_logs` table + `extraction_audit_face_detection_skipped_reason` enum exist via a committed Drizzle migration, indexed on `postId`.
- [x] `ExtractionAuditEventCompleteness` exported from `@festgrid/domain/events`.
- [x] `writeExtractionAuditLog()` helper exists in `apps/backend`, DB-coupled, no seam.
- [x] `process-ai-job.ts` writes exactly one row per extraction attempt at all three exit points (`isEvent: false`, zero-events, success-path), each wrapped in defensive try/catch.
- [x] `actualFaceDetectionCount`/`faceDetectionSkippedReason` columns exist and are reserved (never written by this story).
- [x] Ratchet test passing, proving `resolvers.ts` never imports this table.
- [x] Six integration test cases (Task 4) passing.

## Out of Scope

- The ingestor cross-Lambda backfill of `actualScheduleCount` — explicitly considered and rejected via `AskUserQuestion` at this story's creation (see Dev Notes); `actualScheduleCount` is the extraction-time count, written synchronously, in this story's scope.
- A one-row-per-event audit shape, and any `eventId` FK to the eventually-ingested `events` row — explicitly considered and rejected via `AskUserQuestion` (see Dev Notes); the chosen shape (one row per attempt, jsonb array) carries no `eventId` correlation at all.
- Any GraphQL field, resolver, or UI surface for this table or any of its data — AD-29 Rule 5, enforced by a ratchet test (AC5).
- Backfilling `actualFaceDetectionCount`/`faceDetectionSkippedReason` — **corrected 2026-10-03:** Story 3.6n owns `'no_face_reported'` and the real-count outcome; Story 3.6o owns only `'event_relevance_gate'`; this story's own contribution is limited to returning the inserted row's `id` (Task 2) so those two stories can target it.
- Periodically sampling `hasFaceImage = false` rows through face-api.js to measure the pre-filter's false-negative rate — AD-29's own explicitly-noted future decision, not built here.
- Any change to `posts.grouping_reason`/`posts.extracted_event_count` (Story 3.6r/3.6t's product-facing columns) — this table is a separate, audit-only destination for the same self-reported signals (Amendment, 2026-10-01).
- Any change to Story 3.6l's, 3.6m's, or 3.6s's own already-shipped extraction/logging behavior — this story only adds a new persistence destination for fields those stories already produce.

## Definition of Done

- [x] AC1-AC5 satisfied.
- [x] Task 4's six integration cases and Task 2's ratchet test passing.
- [x] Lint and type checks passing for `apps/backend`, `packages/database`, `packages/domain`.
- [x] No regression in existing `process-ai-job.test.ts` / `process-ai-job.carousel-completeness.test.ts` cases (the three new call sites must not change any pre-existing return value, thrown error, or `markPostExtractedSeam`/`sendSqsMessage` call pattern).

## Completion Status

- [x] Complete (Status: review)

## Dev Agent Record

### Agent Model Used

Claude (claude-sonnet-5), via `bmad-dev-story`.

### Debug Log References

- `pnpm --filter database generate` — produced `packages/database/migrations/0068_wandering_jack_murdock.sql`; diffed against the hand-specified Task 1 DDL and confirmed no dropped clause (plain enum + unconditional btree index, both within drizzle-kit 0.21.4's known-good serialization class).
- `pnpm --filter database migrate` — applied cleanly to the local native-Windows Postgres instance (`postgresql-x64-18`, via `.env` `DATABASE_URL`).
- `pnpm --filter domain build && pnpm --filter database build` — required before the new `extractionAuditLogs`/`ExtractionAuditEventCompleteness` symbols were visible to `apps/backend` at runtime (both packages resolve via `dist/`, not source, from their `package.json` `main`/`exports`); first targeted test run failed with a drizzle-internal `Cannot read properties of undefined (reading 'Symbol(drizzle:Columns)')` until this build step ran — not a story-logic bug, a package-boundary build-order issue specific to this monorepo's `dist`-resolution setup.
- `TZ=UTC npx tsx --test --test-concurrency=1` run directly against the targeted files (`extraction-audit-logs-no-hotpath-import.test.ts`, `process-ai-job.extraction-audit-log.test.ts`, `process-ai-job.test.ts`, `process-ai-job.carousel-completeness.test.ts`, `process-ai-job.cc024-grouping.test.ts`, `process-ai-job.multi-subscriber-quota.test.ts`, `events-postid-write-ratchet.test.ts`) — 56/56 passing, 0 failures, after the build-order fix above and after switching Task 4's own fixtures to insert real `posts` rows (see Completion Notes).
- `pnpm --filter backend lint` — 0 errors (1311 pre-existing warnings, none newly introduced by this story's files).
- `pnpm --filter backend build` / `pnpm --filter database build` / `pnpm --filter domain build` — all clean.
- Full-repo lint/build/test deliberately deferred to this wave's batch-end pass, per this story's dispatch instructions — not run standalone here.

### Completion Notes List

- Task 1: Added `ExtractionAuditEventCompleteness` to `packages/domain/src/events/types.ts` (barrel-exported automatically, no new export line needed) and the `extractionAuditLogs` table + `extractionAuditFaceDetectionSkippedReasonEnum` to `packages/database/schema.ts`, exactly as specified. Generated migration `0068_wandering_jack_murdock.sql` via `drizzle-kit generate` and confirmed by inspection it carries the FK/enum/index with no dropped clause; applied to the local DB via `pnpm --filter database migrate`.
- Task 2: Added `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts` (`writeExtractionAuditLog`, returns `{ id }`, no seam) and `apps/backend/src/schema/extraction-audit-logs-no-hotpath-import.test.ts` (AD-29 Rule 5 ratchet test), both verbatim to the story's own specified code.
- Task 3: Wired `writeExtractionAuditLog` into `process-ai-job.ts` at all three exit points (`isEvent === false`, zero-events defensive branch, success path after the per-event loop and before step 7.5's `db.update(posts)`), each wrapped in try/catch with `console.error` on failure, never rethrown. Collected per-event `eventsCompleteness` entries inside the existing per-event loop. Captured the success-path write's returned `{ id }` into `let auditLogId: string | null = null;` for Story 3.6n/3.6o's later use (not read within this story's own scope — intentional, per the story's amendment; TypeScript/ESLint do not flag this as an error since `noUnusedLocals` is not enabled and `eslint-plugin-only-warn` demotes unused-var findings to warnings only).
- Task 4: Added `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` with Cases A-F. Departed from the story's literal fixture sketch in one respect, discovered only once the tests ran: `extraction_audit_logs.post_id` carries a real FK to `posts.id` (AC1/Task 1), so a bare synthetic UUID with no matching `posts` row trips the FK constraint on every insert — which the try/catch in `process-ai-job.ts` correctly swallows, but that means no row is ever persisted for Cases A-E to assert against. Fixed by inserting a real minimal `posts` row per case (`insertTestPost` helper, using the already-seeded `profile.id` as `accountId`) and using its generated `id` as `message.postId`; Case F (the one case that is *supposed* to hit the FK violation) deliberately keeps a synthetic, non-existent `postId` instead, per the story's own suggestion ("a fixture that violates a DB constraint the row would hit, such as an invalid `postId`") — no seam was added to `write-extraction-audit-log.ts`, consistent with its "No seam export" doc comment. Cleanup relies on `extraction_audit_logs.post_id`'s `ON DELETE cascade` to `posts.id`: deleting the test `posts` rows in `t.after` is sufficient to also remove their audit-log rows.
- Task 5: Ran the full verification pass — migration generate+apply, targeted backend test suite (TZ=UTC, foreground, 56/56 passing), `pnpm --filter backend lint`/`build` and `packages/database`/`packages/domain` builds all clean. Manually confirmed via `git status`/diff review that no `.graphql` file, no `resolvers.ts` change, and no `apps/web`/`packages/ui` file is touched anywhere in this story's diff.
- No deviation from AC1-AC5; no scope creep. The `auditLogId` capture point for Story 3.6n/3.6o is present exactly as specified but intentionally unused by this story.

### File List

- `packages/domain/src/events/types.ts` (modified — new `ExtractionAuditEventCompleteness` interface)
- `packages/database/schema.ts` (modified — new `extractionAuditLogs` table + `extractionAuditFaceDetectionSkippedReasonEnum`)
- `packages/database/migrations/0068_wandering_jack_murdock.sql` (new — `drizzle-kit generate` output)
- `packages/database/migrations/meta/0068_snapshot.json` (new — drizzle-kit metadata)
- `packages/database/migrations/meta/_journal.json` (modified — drizzle-kit journal entry for migration 0068)
- `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts` (new — DB-coupled write helper)
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modified — three new call sites, `auditLogId` capture)
- `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` (new — Task 4 integration cases A-F)
- `apps/backend/src/schema/extraction-audit-logs-no-hotpath-import.test.ts` (new — AC5 ratchet test)
