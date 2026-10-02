---
baseline_commit: d5264245e1fa33c663dc834f9bc0083720bf3de8
---

# Story 3.6t: Ingest multiple events per post, with per-event slugs and notifications

## Story Details

- Epic: 3
- Story ID: 3.6t
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want each extracted event from a post stored exactly once with a stable URL,
So that multi-event posts show up correctly and re-running extraction never duplicates events.

## Acceptance Criteria

1. **Given** Story 3.6s's `events[]` extraction payload, **when** `processAiJob` finishes its per-event loop, **then** it sends one `DataIngestionQueue` message per event, each carrying its own `extractionOrdinal` (0-based, assigned by deterministic ordering — AC7 — never raw model-response order); `processIngestionJob` inserts each event through Story 3.6r's `insertEventWithPrimaryPost` helper, whose conflict target is `events(post_id, extraction_ordinal)`, and writes the matching `event_posts` row with the same ordinal. A unique violation on `events(post_id, extraction_ordinal)`, `event_posts(post_id, extraction_ordinal)`, or the `event_posts` PK is an idempotent skip (`{ inserted: false }`), never a thrown failure (AD-30 Rule 3).
2. **And** `ExtractedEventMessage.extractionOrdinal` is optional on read: a `DataIngestionQueue` message already enqueued before this story's deploy (no `extractionOrdinal` field at all — it does not exist on the producer side yet) is treated as ordinal `0` by `processIngestionJob`, never a validation failure or a dead-letter. This is the readiness sweep's Correction 2 (`batch-cc-024-multi-event-readiness.md`, cited below) — and, as detailed in Dev Notes, Story 3.6r's `insertEventWithPrimaryPost` already implements exactly this default, so this AC requires no new defaulting code, only that the field stay optional end-to-end.
3. **And** the slug is `{platformSlug}_{postType}_{platformPostId}` (ordinal 0, unchanged from Story 3.7g) plus `~{ordinal}` for ordinal > 0 — **the separator is `~`, not `-`** (AD-16 Rule 9, amended 2026-10-01: Instagram shortcodes are base64url and can themselves contain `-`, so a `-`-suffixed slug would be ambiguous between "post X, ordinal N" and "post X-N, ordinal 0"; e.g. `ig_p_Ddi9wU6RCRQ` and `ig_p_Ddi9wU6RCRQ~2`). `detail_level` is `stub` for an event whose primary post's `grouping_reason = roundup`, or whose primary post is curator-sourced (AD-31 Rule 3, negated), and `full` otherwise (the column's existing `DEFAULT 'full'`).
4. **And** schedules, including `applicableDaysOfWeek`, are persisted per event (mapped from `ExtractedScheduleMessage` into `ScheduleInsertValues` — Story 3.6s shipped the field on the message but explicitly deferred this mapping to this story). Timezone resolution, private-contact classification (3.6i), and performer-leakage guards (3.6j) already run per event as of Story 3.6s's per-event loop in `process-ai-job.ts` — confirmed by reading that file, not rebuilt here.
5. **And** notifications are sent per newly inserted event, except for roundup-sourced events (primary post's `grouping_reason = roundup`) and curator-sourced ones (AD-31 Rule 3, negated) — reusing Story 3.6r's `isOrganizerAuthoredPost` predicate, never a second, independently-derived curator test. The send sets `events.notified_at` through **one shared notify helper, built by this story** (AD-30 Rule 10 — "this story defines no marker of its own" means no *second* marker, not that the marker-setting code pre-exists; it does not, confirmed by source search), which atomically claims `notified_at IS NULL` before sending so it can never re-fire for the same event.
6. **And** re-running ingestion for the same post inserts nothing new: a re-delivered or manually re-run `DataIngestionQueue` message for an ordinal that already has a row is an idempotent skip (AC1); a full re-run of the post (a fresh `processAiJob` invocation re-calling Gemini) re-sends per-event messages that idempotently skip at the `(post_id, extraction_ordinal)` level for whichever ordinals already exist.
7. **(Resolved by this story, partial-enqueue-failure and ordinal-stability design — decided with the user via `AskUserQuestion`, this session)** `processAiJob` enqueues **best-effort**: it attempts to send every event's message even after one fails, retrying each failed send up to 2 more times with a short backoff before giving up on it, so a transient SQS error does not cost a second Gemini call. Only if a send still fails after its retries does `processAiJob` throw — the post is **not** marked extracted, and the whole post re-extracts on `AIProcessingQueue` redelivery (already-enqueued ordinals from the failed attempt are harmless idempotent no-ops next time, per AC1/AC6). Ordinals are assigned **deterministically** — by each event's earliest schedule start date, then its normalized event name, then its original model-response index as a final tiebreak — never by raw model-response order, so a re-extraction that yields the **same set** of events produces the **same ordinals**. This does not make truncation (the existing per-post event cap, Story 3.6s, unchanged) itself stable: which events *survive* the cap is still model-response-order-dependent, and full event-identity stability across re-extractions (matching a re-extracted event back to one already ingested under a different ordinal) is Story 3.6v's job, not this one's — see Dev Notes.

**Depends on:** Story 3.6r (event–post link table, `review`), Story 3.6s (events[] extraction, `review`), Stories 3.7f and 3.7g (platform post id capture; base platform-prefixed slug, both `review`).

## Tasks / Subtasks

- [ ] **Task 1 — Domain types: thread `extractionOrdinal`/`detailLevel`/`applicableDaysOfWeek` through (AC: 2, 3, 4)**
  - [ ] 1.1 `packages/domain/src/events/types.ts`: add `extractionOrdinal?: number;` to `ExtractedEventMessage` (comment: optional for backward compatibility — a pre-deploy message has no such field; `processIngestionJob`/`insertEventWithPrimaryPost` treat its absence as ordinal 0).
  - [ ] 1.2 Add `extractionOrdinal?: number;` and `detailLevel?: EventDetailLevel;` to `EventInsertValues` (import `EventDetailLevel` — already defined in this same file by Story 3.6r, no new import path needed). Comment on `detailLevel`: present only when the caller has already resolved the stub/full decision (Task 7); omitted otherwise so the DB's own `DEFAULT 'full'` fires — mirrors the existing `slug?:` field's "omit the key, let the DB default fire" pattern from Story 3.7g, do not special-case it differently.
  - [ ] 1.3 Add `applicableDaysOfWeek?: string[] | null;` to `ScheduleInsertValues`.

- [ ] **Task 2 — Deterministic extraction-ordinal assignment, pure domain function (AC: 7)**
  - [ ] 2.1 New file `packages/domain/src/events/assign-extraction-ordinals.ts`, exporting `assignExtractionOrdinals(eventMessages: ExtractedEventMessage[]): ExtractedEventMessage[]`. Pairs each message with its original (pre-sort) array index, sorts by: (1) earliest `eventStartDate` across the event's own `schedules` (lexicographic string compare — fixtures confirm `YYYY-MM-DD`, safe to compare as strings; an event with an empty `schedules` array sorts **last**, treated as "no date"); (2) `eventName.trim().toLowerCase().replace(/\s+/g, ' ')` (normalized name, `localeCompare`); (3) the original index. Returns **new** objects (`{ ...message, extractionOrdinal: ordinal }`, ordinal = position in the sorted output, 0-based) — does not mutate the input array, matching `buildEventInsertValues`'s own return-new-objects convention.
  - [ ] 2.2 New test file `assign-extraction-ordinals.test.ts` (`tsx --test`, 100%-coverage rule): two events with different earliest dates → sorted ascending, ordinals follow sort order not input order; two events with the same earliest date, different names → sorted by normalized name; two events with same date and same (case/whitespace-varied) name → original index order preserved; an event with an empty `schedules` array sorts after one with a real date; an event whose earliest date is not its first schedule in array order (confirms the function scans **all** of an event's schedules, not just `schedules[0]`); output length equals input length and ordinals are exactly `0..n-1` with no gaps/duplicates; the input array/objects are not mutated (reference inequality check).
  - [ ] 2.3 Export from `packages/domain/src/events/index.ts` (`export * from "./assign-extraction-ordinals.js";`).

- [ ] **Task 3 — `buildEventInsertValues()`: ordinal passthrough, slug suffix, `detailLevel`, `applicableDaysOfWeek` (AC: 2, 3, 4)**
  - [ ] 3.1 `packages/domain/src/events/build-event-insert-values.ts`: change `buildEventInsertValues`'s signature to accept a third, optional parameter: `buildEventInsertValues(message: ExtractedEventMessage, sourcePost: EventSourcePostIdentity | null, detailLevel?: EventDetailLevel)`. Set `event.extractionOrdinal = message.extractionOrdinal;` unconditionally (unlike `slug`, the undefined-vs-absent-key distinction does not matter here — `insertEventWithPrimaryPost` always recomputes and overwrites `extractionOrdinal` in its own insert object before calling `.insert(events).values(...)`, confirmed by reading that function; see Dev Notes). Conditionally assign `event.detailLevel = detailLevel;` only `if (detailLevel !== undefined)` — mirrors the `slug` pattern exactly, so an omitted `detailLevel` lets the DB's `DEFAULT 'full'` fire rather than this function ever writing an explicit `'full'`.
  - [ ] 3.2 Extend `buildPlatformPrefixedSlug` to accept the ordinal and append the suffix:
    ```ts
    function buildPlatformPrefixedSlug(
      sourcePost: EventSourcePostIdentity | null,
      extractionOrdinal?: number
    ): string | undefined {
      if (sourcePost === null || sourcePost.platformPostId === null || sourcePost.platformPostType === null) {
        return undefined;
      }
      const platformSlug = getPlatformSlug(sourcePost.platform as ScrapablePlatform);
      if (!platformSlug) {
        return undefined;
      }
      const base = `${platformSlug}_${sourcePost.platformPostType}_${sourcePost.platformPostId}`;
      return extractionOrdinal !== undefined && extractionOrdinal > 0 ? `${base}~${extractionOrdinal}` : base;
    }
    ```
    Update the call site: `const slug = buildPlatformPrefixedSlug(sourcePost, message.extractionOrdinal);`. Document in a code comment, citing AD-16 Rule 9 verbatim, why `~` and not `-` (base64url shortcodes can contain `-`; `.` is unusable because `apps/web/src/middleware.ts`'s matcher skips any path containing a dot).
  - [ ] 3.3 In the schedules-mapping block, add `applicableDaysOfWeek: s.applicableDaysOfWeek ?? null,` to the returned object for each schedule.
  - [ ] 3.4 `build-event-insert-values.test.ts`: add cases — `extractionOrdinal` passed through unchanged onto `event.extractionOrdinal` (including `undefined`, which must remain `undefined`, not coerced); ordinal `0` with a resolvable `sourcePost` → no `~` suffix (`result.event.slug === 'ig_p_Cx9uWttkSN'`, unchanged from the Story 3.7g case); ordinal `2` with the same `sourcePost` → `result.event.slug === 'ig_p_Cx9uWttkSN~2'`; ordinal `undefined`/`0` with **no** resolvable `sourcePost` → still no `slug` key at all (the ordinal suffix never fires on top of the legacy-hex fallback path — confirm `buildPlatformPrefixedSlug` returns `undefined` before the suffix logic ever runs); `detailLevel: 'stub'` passed → `result.event.detailLevel === 'stub'`; `detailLevel` omitted → `'detailLevel' in result.event` is `false` (DB default must fire, not an explicit `'full'`); a schedule with `applicableDaysOfWeek` set → passed through onto `result.schedules[i].applicableDaysOfWeek`; a schedule with it absent → `null`.

- [ ] **Task 4 — Generic SQS send-with-retry helper (AC: 7)**
  - [ ] 4.1 New file `apps/backend/src/lib/aws/send-sqs-message-with-retry.ts`:
    ```ts
    import { sendSqsMessage } from './send-sqs-message.js';

    export interface SendSqsMessageWithRetryOptions {
      maxAttempts?: number; // total attempts including the first; default 3 (1 initial + 2 retries)
      backoffMs?: number; // base backoff between attempts, multiplied by the attempt number; default 250
      onAttemptFailed?: (attempt: number, maxAttempts: number, err: unknown) => void;
    }

    export async function sendSqsMessageWithRetry(
      queueUrl: string,
      body: string,
      options: SendSqsMessageWithRetryOptions = {}
    ): Promise<void> {
      const maxAttempts = options.maxAttempts ?? 3;
      const backoffMs = options.backoffMs ?? 250;
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await sendSqsMessage(queueUrl, body);
          return;
        } catch (err) {
          lastError = err;
          options.onAttemptFailed?.(attempt, maxAttempts, err);
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
          }
        }
      }
      throw lastError;
    }
    ```
    Calls the **mutable, seam-overridable** `sendSqsMessage` export from `send-sqs-message.ts` (an ESM live binding — `setSendSqsMessage(fn)` already in use by `process-ai-job.test.ts` continues to control every call made through this wrapper with no new seam needed).
  - [ ] 4.2 New test file `send-sqs-message-with-retry.test.ts`: succeeds on the first attempt → `sendSqsMessage` called once, no `onAttemptFailed` call, resolves; fails twice then succeeds on the 3rd attempt (default `maxAttempts`) → resolves, `onAttemptFailed` called exactly twice with `attempt` 1 and 2; fails all `maxAttempts` times → rejects with the last thrown error, `onAttemptFailed` called `maxAttempts` times. Use a small `backoffMs` override (e.g. `1`) in every case to keep the suite fast — do not assert on wall-clock timing, only on call counts and the final resolved/rejected outcome.

- [ ] **Task 5 — `process-ai-job.ts`: persist post-level grouping facts; replace the AC8 deferral with a unified per-event enqueue loop (AC: 1, 2, 5, 6, 7)**
  - [ ] 5.1 Immediately after the existing per-event loop (after the `payload.minEventCount` completeness-logging block, before anything else), add: `await db.update(posts).set({ groupingReason: payload.groupingReason ?? null, extractedEventCount: events.length }).where(eq(posts.id, message.postId));`. `posts.grouping_reason`/`posts.extracted_event_count` have existed since Story 3.6r but nothing has written them yet (confirmed by source search — see Dev Notes "The hidden prerequisite this story must also do"); Story 3.6u's `Event.sourcePosts` field (not built yet) and this story's own stub/notify decision in `processIngestionJob` both need `grouping_reason` to already be on the row. `events.length` here is the **post-truncation** count (the number of events actually kept and about to be ingested), not the model's raw count — the more meaningful number for product UI to read later.
  - [ ] 5.2 **Delete** the entire "7.5. Branch on final event count (AC8, resolved interim-deferral design)" block from Story 3.6s — the `if (eventMessages.length > 1) { ...return; }` early-return and its "Story 3.6t removes this branch" comment, and the subsequent `const eventMessage = eventMessages[0]; const defaultLocation = defaultLocationForBackfill;` single-event extraction. A single-event post is now simply the length-1 case of the loop built below; no special-casing by count remains.
  - [ ] 5.3 Keep the existing image re-hosting block (`rehostPostImageSeam`) exactly as-is, just relocated to run unconditionally (regardless of event count) in place of where it ran only in the former single-event branch — it is already post-level (one cover image per post, Story 3.6e/3.6h/3.6l), not per-event, so no further change is needed here.
  - [ ] 5.4 Immediately before enqueueing, call `const orderedEventMessages = assignExtractionOrdinals(eventMessages);` (Task 2). Import `assignExtractionOrdinals` from `@festgrid/domain`.
  - [ ] 5.5 Replace the single `sendSqsMessage`/inline-fallback block with:
    ```ts
    if (env.dataIngestionQueueUrl) {
      const enqueueErrors: unknown[] = [];
      for (const eventMessage of orderedEventMessages) {
        try {
          await sendSqsMessageWithRetry(env.dataIngestionQueueUrl, JSON.stringify(eventMessage), {
            onAttemptFailed: (attempt, maxAttempts, err) =>
              console.warn(
                `[processAiJob] Enqueue attempt ${attempt}/${maxAttempts} failed for post ${message.postId}, ` +
                  `ordinal ${eventMessage.extractionOrdinal}:`,
                err
              ),
          });
        } catch (err) {
          enqueueErrors.push(err);
        }
      }
      if (enqueueErrors.length > 0) {
        throw new Error(
          `[processAiJob] ${enqueueErrors.length}/${orderedEventMessages.length} event(s) failed to enqueue ` +
            `(after retries) for post ${message.postId}`
        );
      }
    } else if (env.dataIngestionInlineFallbackEnabled) {
      for (const eventMessage of orderedEventMessages) {
        processIngestionJob(eventMessage).catch((err) => {
          console.error(
            `Failed to process ingestion job inline for post ${message.postId}, ordinal ${eventMessage.extractionOrdinal}:`,
            err
          );
        });
      }
    } else {
      throw new Error('DATA_INGESTION_QUEUE_URL is not configured');
    }
    ```
    Replace the `sendSqsMessage` import with `sendSqsMessageWithRetry` (Task 4). The inline-fallback branch stays fire-and-forget per event (unchanged async-decoupling semantics from the single-event path — this is a local-dev-only convenience with no real queue to drain, not the production failure surface AC7 is about; do not add retry/best-effort bookkeeping here).
  - [ ] 5.6 Leave the `defaultLocation`-backfill block (step 8.5) exactly as-is — it already reads `defaultLocationForBackfill`, set inside the per-event loop (last event's resolved value), unaffected by ordinal assignment or the enqueue-loop restructuring.
  - [ ] 5.7 Leave the final `markPostExtractedSeam`/`CURATOR_GUIDE`-caption-null block exactly as-is, now reached only after the enqueue loop completes with zero residual failures (AC7) — i.e. only after ALL events were successfully enqueued, satisfying the "mark extracted only after all events were enqueued" requirement by construction (an uncaught throw from the block above skips this entirely).

- [ ] **Task 6 — Shared "notify helper" (AD-30 Rule 10), built here (AC: 5)**
  - [ ] 6.1 New file `apps/backend/src/lib/events/notify-new-event.ts`, parallel to `set-event-primary-post.ts` (AD-30 Rule-N shared helpers for `events`-table write-boundary concerns live in `apps/backend/src/lib/events/`):
    ```ts
    import { and, eq, isNull } from 'drizzle-orm';
    import { events } from '@festgrid/database';
    import { sendEventNotificationsSeam } from '../notifications/send-event-notifications.js';
    import type { DbExecutor } from './set-event-primary-post.js';

    /**
     * AD-30 Rule 10's "one notify helper" -- events.notified_at is set here and nowhere else.
     * Atomically claims notified_at (UPDATE ... WHERE notified_at IS NULL) BEFORE sending, so a
     * concurrent or duplicate call for the same event can never double-send: only the caller whose
     * UPDATE actually returns a row proceeds to call sendEventNotificationsSeam. Eligibility (is
     * this event a roundup/curator-sourced stub that should never notify at all?) is the caller's
     * decision, not this function's -- it only ever claims+sends when asked to.
     */
    export async function notifyNewEvent(
      executor: DbExecutor,
      event: { id: string; slug: string; name: string; description: string },
      sourceAccountId: string
    ): Promise<void> {
      const claimed = await executor
        .update(events)
        .set({ notifiedAt: new Date() })
        .where(and(eq(events.id, event.id), isNull(events.notifiedAt)))
        .returning({ id: events.id });

      if (claimed.length === 0) {
        return; // already notified -- never re-fire (AD-30 Rule 10)
      }

      await sendEventNotificationsSeam(event, sourceAccountId);
    }
    ```
    No new seam is added for `notifyNewEvent` itself -- tests control its behavior through the existing `setSendEventNotificationsSeam` (Task 9), matching this codebase's integration-test philosophy (real DB, minimal mocking) rather than adding a redundant seam layer.
  - [ ] 6.2 New test file `notify-new-event.test.ts` (`node:test` against the real local Postgres, matching `set-event-primary-post.test.ts`'s convention): a fresh event with `notifiedAt: null` → claims successfully, `sendEventNotificationsSeam` is called once with the right arguments, `events.notifiedAt` is non-null afterward; a second call on the same (now-claimed) event → `sendEventNotificationsSeam` is **not** called again, `notifiedAt` is unchanged (proves "never re-fire"); an event seeded with a pre-existing `notifiedAt` → the claim fails immediately, no send.

- [ ] **Task 7 — `process-ingestion-job.ts`: stub/notify decision per event, call the new helper (AC: 3, 5, 6)**
  - [ ] 7.1 Extend the existing `tx.select(...)` from `posts` to also select `groupingReason: posts.groupingReason`.
  - [ ] 7.2 After that select and before calling `buildEventInsertValues`, compute:
    ```ts
    const isRoundupSourced = sourcePost?.groupingReason === 'roundup';
    const isCuratorSourced = !(await isOrganizerAuthoredPost(message.postId, tx));
    const isStub = isRoundupSourced || isCuratorSourced;
    ```
    Import `isOrganizerAuthoredPost` from `../posts/is-organizer-authored-post.js` (Story 3.6r). Pass `isStub ? 'stub' : undefined` as `buildEventInsertValues`'s new third argument: `const { event, schedules: scheduleValues } = buildEventInsertValues(message, sourcePost ?? null, isStub ? 'stub' : undefined);`.
  - [ ] 7.3 Track `shouldNotify = !isStub;` alongside the existing `insertedEvent`/`result.inserted` tracking (declared outside the `tx` callback, assigned inside it only when `insertedRow` is non-null, mirroring the existing pattern).
  - [ ] 7.4 Replace the post-commit notification block's direct `sendEventNotificationsSeam(...)` call with the new helper: `await notifyNewEvent(db, { id: insertedEvent.id, slug: insertedEvent.slug, name: insertedEvent.eventName, description: insertedEvent.description || '' }, message.sourceSocialMediaAccountId);`, gated additionally on `shouldNotify` (`if (result.inserted && insertedEvent && shouldNotify && message.sourceSocialMediaAccountId) { ... }`). Keep the existing outer `try`/`catch` defensive backstop and its comment unchanged — import `notifyNewEvent` from `../events/notify-new-event.js` instead of importing `sendEventNotificationsSeam` directly (no other use of that import remains in this file).
  - [ ] 7.5 Update the duplicate-skip log line to include the ordinal for easier debugging: `` `Skipped duplicate ingestion for postId: ${message.postId}, extractionOrdinal: ${message.extractionOrdinal ?? 0}` ``.

- [ ] **Task 8 — `process-ai-job.test.ts`: replace the 3.6s deferral tests, add new coverage (AC: 1, 2, 5, 6, 7)**
  - [ ] 8.1 **Replace** "Case N: multi-event payload (AC8 interim deferral) results in no SQS send and no markPostExtracted call" with a test proving the opposite (3.6t supersedes 3.6s's AC8): a 2-event payload results in **two** `sendSqsMessage` calls (track call count/bodies via `setSendSqsMessage`, not just a boolean) and `markPostExtractedCalled === true`; assert each sent message's `JSON.parse(body).extractionOrdinal` is `0` and `1` respectively, matching the deterministic order for the given fixture's schedule dates.
  - [ ] 8.2 **Replace** "Case O: a 15-event payload is truncated to the configured cap (10) before the per-event loop, and still defers" with: the same 15-event roundup payload now truncates to 10 (unchanged, Story 3.6s's logic) and results in **ten** `sendSqsMessage` calls with ordinals `0..9`, and `markPostExtractedCalled === true`.
  - [ ] 8.3 New case: deterministic ordinal assignment — a 3-event payload where the model returns events out of chronological order (e.g. dates `2026-09-01`, `2026-08-01`, `2026-08-15`) results in messages sent with ordinals reflecting the sorted order (the `2026-08-01` event gets ordinal 0, `2026-08-15` gets 1, `2026-09-01` gets 2), not the model's `0,1,2` response order.
  - [ ] 8.4 New case: `posts.groupingReason`/`extractedEventCount` are persisted after a successful multi-event extraction — read the `posts` row back from the DB and assert both columns match the payload's `groupingReason` and the post-truncation event count.
  - [ ] 8.5 New case: partial-enqueue-failure retry — `setSendSqsMessage` fails on its first two invocations for a given message then succeeds (simulate via a per-call counter keyed by message body/ordinal), `processAiJob` still completes successfully (all events eventually enqueued, post marked extracted) — proving Task 4's retry wrapper is actually wired in, not just unit-tested in isolation.
  - [ ] 8.6 New case: enqueue failure exhausts all retries for one event out of three — `processAiJob` throws, `markPostExtractedCalled` stays `false`, and the other two events' `sendSqsMessage` calls still happened (proves "best-effort: attempt every event even after one fails," not fail-fast-and-abort).
  - [ ] 8.7 New case: a single-event payload (today's common case) still results in exactly one `sendSqsMessage` call with `extractionOrdinal: 0` and `markPostExtractedCalled === true` — a regression guard proving the AC8-branch removal did not change single-event behavior.

- [ ] **Task 9 — `process-ingestion-job.test.ts`: multi-ordinal, stub/notify, slug-suffix, no-duplicate coverage (AC: 1, 2, 3, 4, 5, 6)**
  - [ ] 9.1 New seeded post (reusing the existing `platformPostId: 'Cx9uWttkSN', platformPostType: 'p'` fixture shape from Story 3.7g's case) ingested with two messages, `extractionOrdinal: 0` and `extractionOrdinal: 1`, for the same `postId`: both insert successfully (`res.inserted === true` for both); the ordinal-0 event's slug is `ig_p_Cx9uWttkSN` (unsuffixed, unchanged from 3.7g); the ordinal-1 event's slug is `ig_p_Cx9uWttkSN~1`; both have their own `event_posts` row with the matching ordinal; both have their own `schedules` rows if provided.
  - [ ] 9.2 New case: a message with `extractionOrdinal` entirely **absent** (simulating a pre-3.6t-deploy message, AC2) is treated as ordinal `0` — inserts successfully with `extraction_ordinal = 0` in the DB and an unsuffixed slug (if a platform-derivable slug resolves) — a direct regression test for the readiness-sweep correction.
  - [ ] 9.3 New case: re-sending the **same** `(postId, extractionOrdinal)` pair a second time → `res.inserted === false` (idempotent skip, AC6), no second event row, no second `event_posts` row, and `sendEventNotificationsSeam`/`notifyNewEvent`'s claim is never invoked a second time for it.
  - [ ] 9.4 New case: a post whose `groupingReason` is `'roundup'` → the ingested event's `detailLevel === 'stub'` and `notifiedAt` stays `null` (no notification, assert the notification seam was never called for this message).
  - [ ] 9.5 New case: a post whose account is `CURATOR_GUIDE`-typed (seed a profile with `accountType: 'CURATOR_GUIDE'`, no `post_account_associations` rows — exercises `isOrganizerAuthoredPost`'s legacy fallback path) with `groupingReason` left `null`/non-roundup → the ingested event's `detailLevel === 'stub'` and no notification fires, proving the curator path is independently sufficient to suppress notify even when grouping is not a roundup.
  - [ ] 9.6 New case: a normal (non-roundup, non-curator) post → `detailLevel === 'full'` (the `'detailLevel' in insertedEvent` check is not meaningful here since a DB row always has the column; assert the literal value) and the notification seam **is** called, `notifiedAt` is non-null afterward — confirms Task 7 doesn't regress the already-passing single-event happy-path test's notification assertion.
  - [ ] 9.7 Update the existing "Happy path" test's event-row assertions minimally if needed to keep passing with the new `detailLevel`/`notifiedAt` columns present on the returned row (the existing assertions are field-specific, `assert.strictEqual`, not a `deepStrictEqual` snapshot, so they should need no change — verify this during implementation rather than assuming).

- [ ] **Task 10 — Full-suite verification**
  - [ ] 10.1 `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage on the two new pure functions (`assignExtractionOrdinals`, the extended `buildPlatformPrefixedSlug`).
  - [ ] 10.2 `pnpm --filter backend build` (tsc) and `pnpm --filter backend lint`.
  - [ ] 10.3 Run every touched file's test suite individually with `TZ=UTC` (foreground, per this wave's established hard rule — never background a long test run and end the turn): `process-ai-job.test.ts`, `process-ai-job.carousel-completeness.test.ts`, `process-ai-job.cc024-grouping.test.ts`, `process-ingestion-job.test.ts`, `set-event-primary-post.test.ts`, `notify-new-event.test.ts` (new), `send-sqs-message-with-retry.test.ts` (new), `build-event-insert-values.test.ts`, `assign-extraction-ordinals.test.ts` (new), `events-postid-write-ratchet.test.ts` (unaffected — confirm it still passes, since this story adds no new `events.postId` write site).
  - [ ] 10.4 `pnpm --filter @festgrid/database seed:volume:clean` before any DB-backed run (per `cc-024-multi-event-wave-plan.md`'s "Test-gate facts learned" section). The repo-wide `pnpm test`/`pnpm lint`/`pnpm build` (unfiltered, all 8 packages) is deferred to the batch-end gate (Wave 6), not run per-story, matching Stories 3.7f/3.7g/3.6r/3.6s's own precedent.

## Dev Notes

- **Read in full before finalizing this design (all read in full during this story's creation):** `apps/backend/src/lib/ai-processor/process-ai-job.ts` (current state, post-3.6s); `apps/backend/src/lib/ingestor/process-ingestion-job.ts` (current state, post-3.6r/3.7g/FIND-061); `apps/backend/src/lib/events/set-event-primary-post.ts`; `apps/backend/src/lib/posts/is-organizer-authored-post.ts`; `apps/backend/src/lib/notifications/send-event-notifications.ts`; `apps/backend/src/lib/aws/send-sqs-message.ts`; `packages/domain/src/events/build-event-insert-values.ts`, `types.ts`, `parse-platform-prefixed-event-slug.ts` (Story 3.7h's reverse-parser, confirms it already handles a `~{ordinal}` suffix — see below); `packages/database/schema.ts` lines 260-520 (`posts`, `events`, `eventPosts`, `eventSlugAliases`, `schedules`); `apps/backend/src/lib/ingestor/process-ingestion-job.test.ts`; `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (Cases N/O, the tests this story replaces); Story 3.6r's and Story 3.6s's full story files; `batch-cc-024-multi-event-readiness.md`; Architecture Spine AD-30, AD-31, AD-16 (including the 2026-10-01 amendment, Rules 8-12).

- **Story 3.7h's reverse-parser already anticipates the `~{ordinal}` suffix — no change needed there.** `packages/domain/src/events/parse-platform-prefixed-event-slug.ts` (built by Story 3.7h, already `review`) splits the slug's remainder "at the **last** `~`" and discards everything after it, with its own doc comment stating "Generating the `~{ordinal}` slug suffix itself — Story 3.6t" as explicitly out of its scope. Confirmed by reading the file: `parsePlatformPrefixedEventSlug` already strips a trailing `~N` correctly today, before this story ever produces one. This story only needs to **generate** the suffix (Task 3); the DB-free oEmbed resolution path (3.7h/3.7i) requires zero changes.

- **Story 3.6r's `insertEventWithPrimaryPost` already implements AC2's default-to-0 behavior — confirmed, not newly built.** Its existing code: `const extractionOrdinal = values.postId != null ? (values.extractionOrdinal ?? 0) : (values.extractionOrdinal ?? null);` then `.values({ ...values, extractionOrdinal })` — this **always** recomputes and overwrites whatever `extractionOrdinal` the caller passed (including `undefined`) before the real DB insert. So the readiness sweep's Correction 2 is satisfied automatically the moment `ExtractedEventMessage.extractionOrdinal` is optional and threaded through as `undefined` when absent (Task 1/3) — no new conditional/validation code is needed in `processIngestionJob` itself. This is the reason Task 3.1 says "unlike `slug`, the undefined-vs-absent-key distinction does not matter here."

- **The hidden prerequisite this story must also do: `posts.groupingReason`/`extractedEventCount` have never been written.** These columns were added by Story 3.6r's migration and Story 3.6r's own schema comment says they are "populated by Story 3.6s's multi-event extraction payload" — but a direct read of `process-ai-job.ts` (and a repo-wide grep for `groupingReason`/`extractedEventCount` outside test/schema/validation files) confirms **no code writes them today**. Story 3.6s's own "Project Structure Notes" explicitly lists `process-ingestion-job.ts` and any `schema.ts` change as untouched, and nowhere else claims this write. Since `processIngestionJob`'s own stub/notify decision (AC3/AC5) needs `posts.groupingReason` to already be on the row by the time it runs, and `process-ai-job.ts` is the only place in the system that ever holds the full `GeminiExtractionPayload` (with its `groupingReason`), this story is the only place this write can correctly happen — a data-ownership fact, not an open design choice, so it was implemented directly (Task 5.1) rather than raised via `AskUserQuestion`. This is exactly the "a story implementation must leave the system working end-to-end... whether or not written in the story" standing rule in effect.

- **Why `detailLevel` is resolved in `apps/backend` (process-ingestion-job.ts), not inside the pure `buildEventInsertValues()`.** The curator half of the stub test (`isOrganizerAuthoredPost`) requires DB queries (`post_account_associations`, `social_media_account_profiles`) that a `packages/domain` pure function cannot perform per project-context.md's Code Organization rule. `buildEventInsertValues()` stays pure: it only *writes* a pre-resolved `detailLevel` value into the returned object (Task 3.1), it never *decides* one. This mirrors exactly how `buildEventInsertValues()` already accepts a pre-resolved `sourcePost` (Story 3.7g) rather than looking the post up itself.

- **Why notify-eligibility and detail-level stub-ness are the exact complement of each other, and why that is not a coincidence.** AD-30 Rule 10's notify condition ("not roundup AND not curator-sourced") and AD-30 Rule 7's stub condition ("roundup OR curator-sourced, ranks last") are logically complementary by construction — `isStub = isRoundupSourced || isCuratorSourced` and `shouldNotify = !isStub` is the simplest, correct encoding of both rules at once, computed from the exact same two boolean inputs. Do not compute them independently with separate boolean expressions; a future edit to one rule that forgets the other would silently desync them.

- **Why the atomic-claim design in `notifyNewEvent` (claim-before-send, not send-before-claim).** `sendEventNotifications` already catches and reports its own errors internally (confirmed by reading the function — it never lets an exception propagate), so claiming *after* a call that essentially never throws would make the claim almost unconditional and offer no real protection against a double-send from two concurrent/duplicate invocations (e.g. an at-least-once SQS redelivery racing a slow first attempt). Claiming first via a single atomic `UPDATE ... WHERE notified_at IS NULL RETURNING`, and only sending when that UPDATE actually returns a row, is the only point in this flow (called post-commit via plain `db`, not inside the insert's own transaction) that gets real atomicity from Postgres itself.

- **Why the notify call stays post-commit (`db`, not `tx`), unchanged from FIND-061's established fix.** Notifying inside the same transaction as the event insert would hold the DB transaction open for the duration of an FCM round trip (and risk a notification failure rolling back an already-correct DB write, if mishandled) — FIND-061 already established "notify after commit, always awaited, defensive try/catch backstop" as this codebase's pattern; this story's only change is routing that same post-commit call through `notifyNewEvent` instead of `sendEventNotificationsSeam` directly, and adding the `shouldNotify` gate.

- **Ordinal-stability assumption and its explicit limit (per the user's `AskUserQuestion` decision, AC7).** Deterministic ordinal assignment (Task 2) guarantees that **given the same set of extracted events**, re-running extraction assigns them the same ordinals, regardless of the model's own response order varying between calls (a known, previously-documented instability — see Story 3.6s's own two-tier fixture-testing rationale, and the wave plan's "Vifation collapsed to one event in one of two runs" note). It does **not** guarantee ordinal stability when the **set itself** changes between re-extractions — e.g. a re-run that returns 2 events where a prior run returned 3 (one item no longer meets the roundup date/location bar, or truncation's cap keeps a different model-order prefix) can still re-pair an old ordinal with a semantically different event. Fully solving this would require persisting and reusing the original extraction payload (or a content-addressed cache) across retries — an infrastructure investment adjacent to the still-unbuilt Epic 0 guarded-vendor-call wrapper (0.i2a-z), not something this story builds. This is an accepted, explicitly-documented limitation, consistent with AD-30 Rule 7's own "matching is best-effort... no distributed lock is designed" posture elsewhere in the same architecture decision.

- **Why best-effort-with-retry lives in `process-ai-job.ts`'s enqueue loop and not in `processIngestionJob`/a queue-level DLQ policy.** The partial-failure surface this AC addresses is specifically **sending** N messages from one Lambda invocation, before any of them reach a consumer — a DLQ/redrive policy governs a *consumed* message's own processing failures (already handled: a thrown exception inside `processIngestionJob` already fails that one SQS record independently), which is a different, already-solved problem. Retrying the *send* call itself (not the queue's redelivery of an already-sent message) is the gap this story's `sendSqsMessageWithRetry` closes.

- **Package boundary / reusable mechanism check (packages/domain):** `assignExtractionOrdinals` is entity-specific (operates on `ExtractedEventMessage`, an events-domain shape), not a generic cross-entity mechanism — it belongs directly in `packages/domain/src/events/`, not a `packages/domain/src/query/`-style generic subfolder, matching Story 3.7g's precedent reasoning for `buildPlatformPrefixedSlug`.

- **No reusable `packages/ui` component, no cloud/external service setup (`SETUP_WALKTHROUGH.md`), no analytics (AD-5) event, no new i18n (AD-6) locale key, no AD-1/AD-2 Unified Query DSL change, no state-management/loader categorization.** Confirmed by Gate 2 (below): this story has zero `apps/web`/`packages/ui` surface, introduces no PostHog event (no new user interaction to track — the per-event notification send is a backend-triggered push, not a tracked UI interaction), and adds no event-collection retrieval endpoint.

### Architecture & UX Gate Findings

- **Gates 1 and 3 — cited from the batch readiness sweep, not re-run.** `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` includes `3.6t`) already evaluated this exact story. Its per-story verdict: "**3.6t (ingest multiple events per post, with per-event slugs and notifications) | READY-WITH-CORRECTION** | Correction 2 (queue message default ordinal)." Correction 2 — "added an AC requiring a `DataIngestionQueue` message enqueued before this story's deploy (no `extractionOrdinal` field at all) to be treated as ordinal `0` on consumption, never a validation failure" — is folded directly into this story's AC2 above, cited rather than re-derived, per the command context's explicit instruction. The sweep's "Verified facts" additionally confirm (independently against source, not assumed): today's `onConflictDoNothing({ target: [events.postId] })` was already the exact mechanism AD-30 Rule 3/Story 3.6r replaced (now `(postId, extractionOrdinal)`, already shipped); `ExtractedEventMessage`/`ExtractedScheduleMessage` carry no runtime schema validation at the consumer boundary (plain TS interfaces) — relevant to why AC2's defaulting must happen in code, not a schema layer.
  - **Lightweight guard — does this story's actual scope contain anything the sweep plausibly didn't anticipate?** The sweep's Gate 1/3 analysis covered the queue-message-compatibility gap (Finding 2, corrected) and confirmed no new external service, no new data entity, and no new infra dependency anywhere in the 3.6r-3.6z/3.7f-i/3.13-3.18 batch. This story's actual implementation surface (a deterministic in-process sort function, a generic SQS-retry wrapper, a DB-write-then-send notify helper) is entity-internal plumbing within the already-covered `events`/`posts`/`event_posts` write path and the already-covered `DataIngestionQueue` — not a new external service, new data entity, or new infra dependency. The partial-enqueue-failure/retry design (AC7) was resolved via `AskUserQuestion` during this story's own creation (per this workflow's standing instruction for a real, non-mechanical tradeoff), not a Gate 1/3 finding — no fresh Gate 1/3 run is warranted.
- **Gate 2 — run fresh (per-story, as required even when Gates 1/3 are cited).** Dispatched to a one-shot UX-persona analytical pass (Freya lens) against this story's exact scope (ordinal computation, slug suffixing, SQS retry logic, a DB-write-then-send notification helper, and queue/column plumbing — zero `apps/web`/`packages/ui`/React/GraphQL-resolver-output-shape surface). **Verdict: No gap found.** The pass confirmed this story stops entirely at the backend/data-layer boundary: the data it writes (slugs, `detail_level`, `grouping_reason`) is only ever read by UI in later, separate stories (3.6u's event-detail "other events" section, 3.6x's post collection page), consistent with how the two directly preceding sibling stories (3.6r's link table, 3.6s's multi-event extraction) were already evaluated with zero UI surface.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No new DB migration. Every column this story writes to (`events.extraction_ordinal`, `events.detail_level`, `events.notified_at`, `event_posts.extraction_ordinal`, `posts.grouping_reason`, `posts.extracted_event_count`) already exists, added by Story 3.6r's migration `0065_*.sql` and never backfilled or written to since. This story is purely an in-process/queue-message/domain-type wiring story that finally exercises columns that have existed, unused, since 3.6r.
- **Impacted fields/contracts:**
  - `packages/domain/src/events/types.ts` — `ExtractedEventMessage` gains `extractionOrdinal?: number` (optional, backward-compatible with pre-deploy messages per AC2); `EventInsertValues` gains `extractionOrdinal?: number` and `detailLevel?: EventDetailLevel`; `ScheduleInsertValues` gains `applicableDaysOfWeek?: string[] | null`. All purely additive, no existing field's shape changes.
  - `packages/domain/src/events/build-event-insert-values.ts` — `buildEventInsertValues()` gains a third optional parameter (`detailLevel?: EventDetailLevel`); every existing 2-argument call site (`process-ingestion-job.ts`'s old call before Task 7, `build-event-insert-values.test.ts`'s existing cases, `apps/backend/scripts/poc-ingestion-preview.ts`) remains valid unchanged, since the new parameter is optional and trailing.
  - `apps/backend/src/lib/ai-gateway`/`ai-processor` — no changes beyond `process-ai-job.ts` itself; `GeminiExtractionPayload`/`GeminiEventPayload` (Story 3.6s) are read-only inputs here, untouched.
  - GraphQL schema/resolvers — **unchanged**. No new field exposed on `Event`/`Post`; `detail_level`/`grouping_reason`/`extracted_event_count`/`extraction_ordinal` remain internal-only until Story 3.6u's `Event.sourcePosts` (not built yet) reads them.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** All listed above, confined to `packages/domain` and `apps/backend`. No `apps/web`/`packages/ui` type is affected (zero frontend surface, confirmed by Gate 2).
- **Backward compatibility and rollout notes:** `ExtractedEventMessage.extractionOrdinal`'s optionality is the one genuinely deploy-boundary-crossing concern (AC2) — handled entirely by Story 3.6r's pre-existing `insertEventWithPrimaryPost` default, confirmed above, so no new defaulting logic is needed, only that the type stay optional end-to-end and that nothing in this story's own code assumes it is always present. `EventInsertValues.detailLevel`'s conditional-omission pattern (mirroring `slug`) means an untouched call site (anything not updated by Task 7) continues to produce `'full'` via the DB default exactly as it does today, with zero behavior change.
- **Verification checks:** Task 2.2's new pure-function unit tests (100% coverage); Task 3.4's extended `build-event-insert-values.test.ts` cases; Task 4.2's retry-wrapper unit tests; Task 6.2's `notifyNewEvent` integration tests; Task 8's replaced/new `process-ai-job.test.ts` cases (including the explicit single-event regression guard, 8.7); Task 9's new `process-ingestion-job.test.ts` cases (multi-ordinal slug suffix, stub/notify, idempotent re-run); `pnpm --filter domain build/test`, `pnpm --filter backend build/lint`, all touched-file test suites green under `TZ=UTC` with the volume seed cleaned.

### Project Structure Notes

- New files: `packages/domain/src/events/assign-extraction-ordinals.ts` + test; `apps/backend/src/lib/aws/send-sqs-message-with-retry.ts` + test; `apps/backend/src/lib/events/notify-new-event.ts` + test.
- Modified files: `packages/domain/src/events/types.ts`, `build-event-insert-values.ts`, `build-event-insert-values.test.ts`, `index.ts` (new export); `apps/backend/src/lib/ai-processor/process-ai-job.ts`, `process-ai-job.test.ts`; `apps/backend/src/lib/ingestor/process-ingestion-job.ts`, `process-ingestion-job.test.ts`.
- Explicitly **not** touched: `packages/database/schema.ts` (no migration — every column already exists); any GraphQL schema/resolver file; `packages/domain/src/events/parse-platform-prefixed-event-slug.ts` (Story 3.7h's reverse-parser already handles the `~{ordinal}` suffix, confirmed above — zero change needed); `apps/backend/src/schema/events-postid-write-ratchet.test.ts` (no new `events.postId` write site — this story's only `events` writes go through the already-sanctioned `insertEventWithPrimaryPost`); any `apps/web`/`packages/ui` file; Story 3.6v's scope (matching, re-slug-on-promotion, the event-level account-match helper).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6t: Ingest multiple events per post, with per-event slugs and notifications] — verbatim basis for AC1-AC6; AC7 added this session via `AskUserQuestion`.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-30: Event↔Post Is Many-to-Many] — Rule 3 (ingestion idempotency), Rule 7 (stub marker for curator/roundup), Rule 10 (notification marker, "one notify helper"), binding.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-31: Post–Account Association Semantics] — Rule 3 (organizer-authored predicate, reused not re-derived).
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-16: Platform-Prefixed Event Slugs] — Rules 8-9 (the CC-024 amendment: `~{ordinal}` suffix, why `~` not `-`), binding.
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 sweep, per-story verdict for 3.6t ("READY-WITH-CORRECTION"), Correction 2 (queue-message-ordinal-default) cited verbatim into AC2.
- [Source: _bmad-output/implementation-artifacts/3-6r-add-the-event-post-link-table-and-multi-event-schema.md] — `insertEventWithPrimaryPost`'s existing ordinal-default-0 behavior (confirms AC2 needs no new code); `isOrganizerAuthoredPost`'s contract; the `event_posts`/`events` schema this story writes to.
- [Source: _bmad-output/implementation-artifacts/3-6s-extract-multiple-events-per-post-with-grouping-rules.md] — the AC8 interim-deferral branch this story removes; `applicableDaysOfWeek`/`organizerHandle` shipped on the message but explicitly left unmapped for this story.
- [Source: _bmad-output/implementation-artifacts/3-7g-build-platform-prefixed-event-slugs-at-ingestion.md] — the base (ordinal-0) slug-construction logic this story extends with the ordinal suffix; the conditional-key-omission pattern this story's `detailLevel` field mirrors.
- [Source: _bmad-output/implementation-artifacts/3-7h-resolve-instagram-oembed-from-the-event-slug-without-a-database-lookup.md] — confirms its reverse-parser already handles the `~{ordinal}` suffix this story generates, needing no change here.
- [Source: backlog/FIND-061-no-new-event-push-notification-diagnosis.md, apps/backend/src/lib/ingestor/process-ingestion-job.ts] — the awaited-notification fix this story's `notifyNewEvent` helper preserves (post-commit, always awaited, defensive backstop).
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts, process-ai-job.test.ts, apps/backend/src/lib/ingestor/process-ingestion-job.ts, process-ingestion-job.test.ts, apps/backend/src/lib/events/set-event-primary-post.ts, apps/backend/src/lib/posts/is-organizer-authored-post.ts, apps/backend/src/lib/notifications/send-event-notifications.ts, apps/backend/src/lib/aws/send-sqs-message.ts, packages/domain/src/events/build-event-insert-values.ts, types.ts, parse-platform-prefixed-event-slug.ts, packages/database/schema.ts] — all read in full for this story.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Adapter Pattern / Resilient Processing Pipeline (SQS decoupling, unchanged topology); Code Organization (`packages/domain` gets only pure type/function additions — `assignExtractionOrdinals`, the slug-suffix logic — zero DB/ORM coupling; the curator-check/notify-helper stay backend-only in `apps/backend`); Testing Rules (100% coverage for the two new `packages/domain` pure functions; testing-trophy integration tests for `apps/backend`, matching this codebase's existing `node:test`-against-real-DB convention, no new mocking layer introduced).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-30 (binding, this story's primary source), AD-31 (Rule 3, reused), AD-16 (Rules 8-9, binding).
- [x] `docs/infrastructure/index.md` — reviewed (`2-backend.md` line 17's `DataIngestionQueue` description is purely descriptive and unaffected — same queue, no new resource, just more messages per post); this story adds no new infrastructure resource (no new queue, Lambda, compute, or external service) — the deeper shard was not independently re-read in full, matching Stories 3.6r/3.6s/3.7f/3.7g's identical reasoning.
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/3 cited from the batch sweep; Gate 2 run fresh (No gap found); lightweight escape-hatch guard reasoned through explicitly above.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `packages/domain/src/events/types.ts` — add `extractionOrdinal?` to `ExtractedEventMessage`/`EventInsertValues`; add `detailLevel?` to `EventInsertValues`; add `applicableDaysOfWeek?` to `ScheduleInsertValues`.
  2. `packages/domain/src/events/assign-extraction-ordinals.ts` (new) + test — deterministic ordinal assignment.
  3. `packages/domain/src/events/index.ts` — export the new module.
  4. `packages/domain/src/events/build-event-insert-values.ts` + test — thread `extractionOrdinal`, extend `buildPlatformPrefixedSlug` with the `~{ordinal}` suffix, conditional `detailLevel`, map `applicableDaysOfWeek`.
  5. `apps/backend/src/lib/aws/send-sqs-message-with-retry.ts` (new) + test — generic retry wrapper.
  6. `apps/backend/src/lib/ai-processor/process-ai-job.ts` + test — persist `posts.groupingReason`/`extractedEventCount`; delete the AC8 deferral branch; unified per-event, deterministically-ordered, best-effort-with-retry enqueue loop.
  7. `apps/backend/src/lib/events/notify-new-event.ts` (new) + test — the shared AD-30 Rule 10 notify helper.
  8. `apps/backend/src/lib/ingestor/process-ingestion-job.ts` + test — select `groupingReason`; compute `isStub`/`shouldNotify` via `isOrganizerAuthoredPost`; pass `detailLevel` into `buildEventInsertValues`; call `notifyNewEvent` instead of `sendEventNotificationsSeam` directly.
  9. No other file is touched — no DB migration, no GraphQL schema/resolver file, no `apps/web`/`packages/ui` file, no Story 3.6v scope (matching, re-slug-on-promotion).
- **Rule Mapping:**
  - AC1 (one message per event, conflict target, idempotent skip) → Task 5 (producer), Task 7 (consumer, unchanged mechanism confirmed).
  - AC2 (optional `extractionOrdinal`, default-to-0) → Task 1, Task 3.1; satisfied by Story 3.6r's existing `insertEventWithPrimaryPost` default (confirmed, not rebuilt).
  - AC3 (slug suffix, `detail_level`) → Task 3.2 (slug), Task 7.2 (detail_level decision).
  - AC4 (`applicableDaysOfWeek` persisted; per-event guards already run) → Task 3.3 (mapping); confirmed already true for the guards (Dev Notes).
  - AC5 (per-event notify except roundup/curator; one notify helper) → Task 6 (helper), Task 7.2-7.4 (eligibility + call site).
  - AC6 (re-run inserts nothing new) → unchanged mechanism (Task 7), verified by Task 9.3.
  - AC7 (best-effort retry; deterministic ordinals) → Task 2 (ordinals), Task 4 (retry wrapper), Task 5.4-5.5 (wiring).
  - "A story implementation must leave the system working end-to-end" (standing rule) → Task 5.1 (`posts.groupingReason`/`extractedEventCount`, the hidden prerequisite — see Dev Notes).
- **Verification Plan:** Task 2.2/3.4/4.2/6.2's new/extended unit and integration tests; Task 8's replaced and new `process-ai-job.test.ts` cases (including the single-event regression guard); Task 9's new `process-ingestion-job.test.ts` cases; `pnpm --filter domain build/test`, `pnpm --filter backend build/lint`, all touched-file suites green (`TZ=UTC`, volume seed cleaned); `events-postid-write-ratchet.test.ts` confirmed still passing (no new write site introduced).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — thread real per-event `extractionOrdinal` end-to-end (producer and consumer), add the `~{ordinal}` slug suffix and `detail_level` stub decision, map `applicableDaysOfWeek`, replace Story 3.6s's multi-event deferral with a unified best-effort-with-retry per-event enqueue loop using deterministic ordinal assignment, and build the shared AD-30 Rule 10 notify helper; persist `posts.groupingReason`/`extractedEventCount` as a required prerequisite write (not previously built by any story); explicitly not building Story 3.6v's matching/re-slug/alias scope, no DB migration, no GraphQL/UI surface.
- [ ] Architecture and boundary confirmation — AD-30 Rules 3/7/10 and AD-31 Rule 3 followed exactly (reusing, never re-deriving, `isOrganizerAuthoredPost`/`insertEventWithPrimaryPost`); AD-16 Rules 8-9 followed exactly (`~` separator, not `-`); `packages/domain` stays pure (no DB/Node coupling in the two new functions); the notify helper's atomic-claim design confirmed correct for AD-30 Rule 10's "never re-fire" guarantee.
- [ ] Testing plan confirmation — new pure-function unit tests (100% coverage: ordinal assignment, slug-suffix logic); new integration tests (notify-claim idempotency, SQS retry wrapper, multi-ordinal ingestion, stub/notify gating for roundup and curator paths, no-duplicate re-run); replaced `process-ai-job.test.ts` deferral tests plus a single-event regression guard proving the branch removal didn't change existing behavior.
- [ ] Explicit human approval state (Default: pending approval) — **pending**; this story has not yet been implemented.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md` (READY-WITH-CORRECTION, Correction 2 folded into AC2); Gate 2 run fresh this session (No gap found, backend/domain-only scope).
- [ ] Design decisions confirmed — the partial-enqueue-failure handling and deterministic-ordinal-assignment design (AC7) was presented to the user via `AskUserQuestion` with a recommendation and trade-offs during this story's creation; the user's answer (best-effort with per-message retry, deterministic ordinal assignment by date/name/index, and documenting the residual ordinal-identity limitation) is reflected verbatim in AC7 and Dev Notes, not re-asked here.

## Testing Requirements

- [ ] Unit tests — `packages/domain`, 100% coverage: `assign-extraction-ordinals.test.ts` (new, Task 2.2); extended `build-event-insert-values.test.ts` (Task 3.4, ordinal/slug-suffix/detailLevel/applicableDaysOfWeek cases).
- [ ] Unit tests — `apps/backend`, generic utility: `send-sqs-message-with-retry.test.ts` (new, Task 4.2, call-count/outcome assertions, no wall-clock timing assertions).
- [ ] Integration tests — `apps/backend`, `node:test` against the real local Postgres (no DB mocking, matching this codebase's established convention): `notify-new-event.test.ts` (new, Task 6.2); extended `process-ingestion-job.test.ts` (Task 9: multi-ordinal slug suffix, pre-deploy-message default-ordinal, idempotent re-run, roundup-stub, curator-stub, normal-full-and-notified); extended `process-ai-job.test.ts` (Task 8: replaced deferral cases, deterministic-order case, groupingReason/extractedEventCount persistence, partial-failure-then-retry-success, retries-exhausted-then-throw, single-event regression guard).
- [ ] E2E tests — not applicable; this is a backend-only queue/data-layer change with no user-facing flow to exercise end-to-end, per `project-context.md`'s testing-trophy guidance (matching Stories 3.6r/3.6s/3.7f/3.7g's identical posture).

## Deliverables Checklist

- [ ] `ExtractedEventMessage`/`EventInsertValues`/`ScheduleInsertValues` extended with `extractionOrdinal`/`detailLevel`/`applicableDaysOfWeek` (all optional, additive).
- [ ] `assignExtractionOrdinals()` built, exported, 100%-covered, and wired into `process-ai-job.ts`'s enqueue loop.
- [ ] `buildEventInsertValues()` threads `extractionOrdinal` through, appends the `~{ordinal}` slug suffix for ordinal > 0, accepts and conditionally applies `detailLevel`, maps `applicableDaysOfWeek`.
- [ ] `sendSqsMessageWithRetry()` built, exported, unit-tested, and used for every real-queue enqueue in `process-ai-job.ts`.
- [ ] `process-ai-job.ts` persists `posts.groupingReason`/`extractedEventCount`; the Story 3.6s AC8 deferral branch is fully removed; one `DataIngestionQueue` message is sent per event (best-effort with retry); the post is marked extracted only after every event's message was successfully sent.
- [ ] `notifyNewEvent()` built as the single AD-30 Rule 10 notify helper, atomically claiming `notified_at` before sending; wired into `process-ingestion-job.ts` in place of the direct `sendEventNotificationsSeam` call.
- [ ] `process-ingestion-job.ts` computes `isStub`/`shouldNotify` per event via `groupingReason`/`isOrganizerAuthoredPost` and passes `detailLevel` into `buildEventInsertValues()`.
- [ ] All new and extended tests passing locally against the real local Postgres DB, `TZ=UTC`, volume seed cleaned.
- [ ] `pnpm --filter domain build/test`, `pnpm --filter backend build/lint` all clean.

## Out of Scope

- Matching a newly extracted event against an existing one, enrichment-in-place, re-slug-on-primary-change, and the `event_slug_aliases` redirect mechanism (AD-16 Rules 10-12, AD-30 Rule 9) — Story 3.6v.
- The shared event-level account-match helper (AD-31 Rule 4) — Story 3.6v (3.6r already built the organizer-authored predicate this story reuses; the event-level union-match helper is a separate, not-yet-needed piece).
- `Event.sourcePosts`, `Query.relatedEventIds`, and any GraphQL exposure of `grouping_reason`/`extracted_event_count`/`detail_level` — Story 3.6u.
- The post collection page and `Query.relatedEventIds` (post variant) — Story 3.6x.
- Fully solving ordinal/event-identity stability across a re-extraction that returns a *different* set of events (see Dev Notes' explicit limitation) — not scheduled to any specific story today; would require a content-addressed extraction cache, adjacent to the still-unbuilt Epic 0 guarded-vendor-call wrapper (0.i2a-z).
- The guarded Gemini vendor-call wrapper / timeout hardening beyond Story 3.6s's existing inline `AbortController` guard — Stories 0.i2a-0.i2c (blocked on AD-32, not yet written).
- No gap was found by any of Gate 1, 2, or 3 for this story (Gates 1/3 cited from the batch sweep with Correction 2 already folded into AC2; Gate 2 run fresh, no gap), so no new prerequisite story/backlog entry is introduced here.

## Definition of Done

- [ ] AC1-AC7 satisfied.
- [ ] Required unit and integration tests passing (Testing Requirements above).
- [ ] Lint and type checks passing for `packages/domain` and `apps/backend`.

## Completion Status

- [ ] Not started — Status: ready-for-dev. Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

(To be filled by the dev agent.)

### Debug Log References

(To be filled by the dev agent.)

### Completion Notes List

(To be filled by the dev agent.)

### File List

(To be filled by the dev agent.)

## Change Log

- 2026-10-02 — Story created via `bmad-create-story`. CC-024 (Multi-event posts and cross-post event matching) Wave 3, final story. Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md` (READY-WITH-CORRECTION, Correction 2 folded into AC2); Gate 2 run fresh (No gap found). Two design decisions resolved with the user via `AskUserQuestion`: partial-enqueue-failure handling (best-effort with per-message retry, refined by the user beyond the two offered options) and deterministic extraction-ordinal assignment (by earliest schedule date, then normalized event name, then original index) to keep ordinals stable across a re-extraction that finds the same events, with the residual limitation (a re-extraction that finds a *different* set of events) documented explicitly in Dev Notes.
