---
title: 'Diagnostic logging for schedules lost between extraction and storage'
type: 'chore'
created: '2026-11-09'
status: 'done'
baseline_commit: '9b0de4af6c516391e93a70f062d9046fa1b15d66'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** For some prod posts the AI reports N schedules but fewer are stored, e.g. post `b0fdae96…` (slug `ig_p_DfWWCCIzNw1`): audit says 16 schedules extracted over 6 events, 8 stored, and the event "Bus Samsat Keliling" kept only the first 2 of its 10. 48 of 2,890 recent posts show it. Reading the code, the DB and the ingestor log finds no cause, and neither the model response nor the queue message is persisted, so the loss cannot be located after the fact.

**Approach:** Add greppable, log-only counters at the three hand-off points (model payload → built message → queue body → rows inserted), plus one warning when rows inserted differ from rows sent, so the next occurrence names the step that drops them. No behavior change.

## Boundaries & Constraints

**Always:** Routine lines use `console.info` in `key=value` form (convention: `logFaceBlurThumbnailOutcome`), because several test files assert exact `console.log`/`console.warn` counts. The single `console.warn` is the mismatch case. Logging must never throw or change control flow.

**Ask First:** Persisting anything new (columns, audit fields, payload copies) instead of logging.

**Never:** New env vars, schema or migration changes, query semantics changes beyond adding `.returning` on the existing schedules insert and one read-only `count(*)` of the event's schedules on the enrich path, touching the face-blur/budget code from PR #180, or fixing the cause (unknown until the logs show it).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal extraction | model returns E events with S schedules | one `extraction-schedules` line per event (model vs message count), one `enqueue` line per event (schedules, bodyBytes), one post totals line | N/A |
| Count differs before the queue | message has fewer schedules than the model payload | the two numbers differ in the lines (no extra warn) | N/A |
| New event insert | message with S schedules | one `ingest-schedules` info line, `sent=S inserted=S` | N/A |
| Insert returns fewer rows | `inserted != sent` | same line plus a `console.warn` with both numbers, post and ordinal | N/A |
| High-match enrich | existing event enriched | `ingest-schedules` line with `path=enrich incoming=S final=F` (F counted after the enrichment) | N/A |
| Zero schedules | message has none | no insert, line shows `sent=0 inserted=0` | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/events/schedule-count-log.ts` -- NEW: three tiny emitters (extraction, enqueue, ingest) so formats live in one place and are unit-testable.
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- per-event loop (~L254-312) and the DataIngestionQueue enqueue (~L524-575).
- `apps/backend/src/lib/ingestor/write-ingestion-decision.ts` -- new-event insert (~L70-77) and the `high` enrich branch (~L35-56).
- `apps/backend/src/lib/events/set-event-primary-post.ts` -- `enrichAndPromoteEvent` (read-only reference; returns `{event, becameOrganizerAuthored}`).
- `apps/backend/src/lib/ingestor/process-ingestion-job.test.ts` -- DB integration tests; add one assertion for the info line (pattern: `captureDedupLogs`).

## Tasks & Acceptance

**Execution:**
- [ ] `schedule-count-log.ts` -- add `logExtractionScheduleCounts`, `logEnqueueScheduleCounts`, `logIngestScheduleCounts` (the last warns when `inserted !== sent`), each wrapped so a logging failure is swallowed -- one place for the line formats.
- [ ] `process-ai-job.ts` -- in the per-event loop log model count vs built-message count; before the enqueue log one line per ordered message (ordinal, name truncated to 60 chars, schedules, `bodyBytes` of the exact string sent, built once and reused) and a totals line -- locates any loss before the queue.
- [ ] `write-ingestion-decision.ts` -- add `.returning({ id: schedules.id })` to the schedules insert and log sent vs inserted; on the enrich branch log incoming vs the event's schedule count afterwards (one extra `count(*)` query) -- locates a DB-side drop.
- [ ] `schedule-count-log.test.ts` -- unit tests: formats, name truncation, the mismatch warn, equal counts emit no warn, a throwing logger is swallowed.
- [ ] `process-ingestion-job.test.ts` -- one integration case: a new-event ingest with several schedules emits `ingest-schedules ... sent=N inserted=N`; existing tests untouched.

**Acceptance Criteria:**
- Given an extraction with E events, when it runs, then log lines let one compare, per event, the model's schedule count, the message's, the queue body's and the inserted rows.
- Given an insert that stores fewer rows than sent, when ingestion runs, then exactly one `console.warn` names the post, ordinal and both counts.
- Given any existing test, when the suite runs, then it passes unchanged (no new `console.log`/`console.warn` on routine paths).

## Design Notes

The next 03:20 UTC burst produces the evidence. To find a loss, query the AI-processor log group for `extraction-schedules` and `enqueue` lines for a post (model vs message vs queue), then the ingestor group for `ingest-schedules` (sent vs inserted). The first pair that differs is the dropping step. `bodyBytes` rules a message-size cause in or out.

Added in review: the ingest line also carries `received` (the message's own schedule count), so the hop between receipt and insert is covered, and a mismatch there warns too. The enrich-path count runs inside a SAVEPOINT so a failed count cannot abort the caller's transaction. A duplicate (post, ordinal) skip is not an `ingest-schedules` line: it already logs "Skipped duplicate ingestion". The extraction line is keyed by the model's event order, the later lines by ordinal (re-sorted by date), so join the AI-processor lines by post + name. This is temporary diagnostic code: remove `schedule-count-log.ts` and its call sites once the cause is found.

## Verification

**Commands:**
- `pnpm --filter backend exec tsx --test src/lib/events/schedule-count-log.test.ts src/lib/ingestor/process-ingestion-job.test.ts` -- expected: all pass (needs a migrated local DB)
- `pnpm --filter backend exec tsc --noEmit` and `pnpm --filter backend lint` -- expected: clean

## Suggested Review Order

**The three hand-off points (entry point: the helper)**

- All line formats and the one warning live here, so the join keys and the mismatch rule are reviewable in one place.
  [`schedule-count-log.ts:86`](../../apps/backend/src/lib/events/schedule-count-log.ts#L86)

**Before the queue (AI Lambda)**

- Model schedule count vs the built message's, per event, right after the message is built.
  [`process-ai-job.ts:294`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L294)

- Post totals, then one line per enqueued event with the exact body size sent (body built once).
  [`process-ai-job.ts:538`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L538)
  [`process-ai-job.ts:558`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L558)

**At insert (ingestor)**

- `.returning` counts the rows actually written; received/sent/inserted logged, warn on any difference.
  [`write-ingestion-decision.ts:118`](../../apps/backend/src/lib/ingestor/write-ingestion-decision.ts#L118)

- Enrich path: the count runs in a savepoint so a failed count cannot abort the transaction.
  [`write-ingestion-decision.ts:27`](../../apps/backend/src/lib/ingestor/write-ingestion-decision.ts#L27)
  [`write-ingestion-decision.ts:79`](../../apps/backend/src/lib/ingestor/write-ingestion-decision.ts#L79)

**Tests**

- Formats, name clipping, mismatch warnings, and a throwing logger being swallowed.
  [`schedule-count-log.test.ts`](../../apps/backend/src/lib/events/schedule-count-log.test.ts)

- Integration: a real ingest emits `received=3 sent=3 inserted=3` and no mismatch warning.
  [`process-ingestion-job.test.ts:444`](../../apps/backend/src/lib/ingestor/process-ingestion-job.test.ts#L444)
