import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { manualExtractionJobs } from '@festgrid/database';
import { MANUAL_EXTRACTION_JOB_STALE_AFTER_MS, REEXTRACT_APPLY_WINDOW_MS } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { blankManualJobPayloadContent } from './blank-manual-job-payload.js';

// Story 10.1a (AC4) -- retention for `manual_extraction_jobs`, run by the job-engine sweep. The table itself is
// untouched (moving it onto the job table is Story 10.9's decision, OI-4); only new sweep BEHAVIOUR reads and writes it.

const STALE_MESSAGE = 'The extraction timed out. Please try again.';
const BATCH = 200;

// The jsonb columns written through drizzle are stored as a jsonb STRING holding the object (the `events.links`
// double-encoding), so raw SQL unwraps with `#>> '{}'` first (project-context). The unwrap also works on a real object.
const resultJson = sql`(${manualExtractionJobs.resultData} #>> '{}')::jsonb`;
const payloadJson = sql`(${manualExtractionJobs.requestPayload} #>> '{}')::jsonb`;

/**
 * FIND-086 finding 1: a job inserted but never claimed (a lost invoke, a crashed Lambda) keeps the post caption in
 * `request_payload` past the stale limit, because the only staleness check is lazy and runs only when its owner polls
 * again. Ends every PENDING or PROCESSING job older than the same limit FAILED and blanks the caption with the existing
 * helper (never a second blanking implementation). PROCESSING is included because the lazy check treats it as stale
 * after the same time.
 *
 * FIND-111 finding 1: an unapplied re-extract preview keeps `result_data.extracted` past the 30-minute Apply window.
 * Nulls just that field in place; every other field of the result is kept.
 */
export async function sweepStaleManualExtractionRetention(now: Date = new Date()): Promise<void> {
  const staleBefore = new Date(now.getTime() - MANUAL_EXTRACTION_JOB_STALE_AFTER_MS);
  const failed = await db
    .update(manualExtractionJobs)
    .set({ status: 'FAILED', errorCode: 'EXTRACTION_FAILED', errorMessage: STALE_MESSAGE, completedAt: now, updatedAt: now })
    .where(and(inArray(manualExtractionJobs.status, ['PENDING', 'PROCESSING']), lt(manualExtractionJobs.createdAt, staleBefore)))
    .returning({ id: manualExtractionJobs.id });
  for (const { id } of failed) {
    await blankManualJobPayloadContent(id);
  }

  const applyWindowEnd = new Date(now.getTime() - REEXTRACT_APPLY_WINDOW_MS);
  const candidates = await db
    .select({ id: manualExtractionJobs.id })
    .from(manualExtractionJobs)
    .where(
      and(
        eq(manualExtractionJobs.status, 'SUCCEEDED'),
        lt(manualExtractionJobs.completedAt, applyWindowEnd),
        sql`${payloadJson} ->> 'mode' = 'REEXTRACT_PREVIEW'`,
        sql`jsonb_typeof(${resultJson} -> 'extracted') in ('object', 'array')`,
        sql`${resultJson} ->> 'appliedAt' is null`
      )
    )
    .limit(BATCH);

  for (const { id } of candidates) {
    // Read-modify-write through drizzle (same reason as blankManualJobPayloadContent), under a row lock so an Apply that
    // lands at the window's edge is never overwritten.
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ resultData: manualExtractionJobs.resultData })
        .from(manualExtractionJobs)
        .where(eq(manualExtractionJobs.id, id))
        .for('update');
      const current = row?.resultData as Record<string, unknown> | null | undefined;
      if (!current || current.extracted == null || current.appliedAt != null) return;
      await tx
        .update(manualExtractionJobs)
        .set({ resultData: { ...current, extracted: null }, updatedAt: now })
        .where(eq(manualExtractionJobs.id, id));
    });
  }
}
