import { eq } from 'drizzle-orm';
import { manualExtractionJobs } from '@festgrid/database';
import { db } from '../../db/client.js';

/**
 * AD-40 privacy invariant -- the post caption (possibly just rescraped, possibly a curator caption
 * that is deliberately null in `posts`) must not outlive a manual extraction job in
 * `request_payload`. Called wherever a job reaches a terminal state: the AI Lambda's `finally`, a
 * failed start, and the lazy stale-job failure. Best-effort: a failure here is logged, never
 * thrown, so it cannot turn a finished job into a failed one.
 *
 * Read-modify-write through Drizzle rather than SQL `jsonb_set`: drizzle/postgres.js stores this
 * column as a jsonb *string* holding the object (the same double-encoding as `events.links`), and
 * `jsonb_set` cannot set a path inside a scalar. Drizzle's read path unwraps it and its write path
 * re-encodes it the same way, so the stored shape is unchanged.
 */
export async function blankManualJobPayloadContent(jobId: string): Promise<void> {
  try {
    const [job] = await db
      .select({ requestPayload: manualExtractionJobs.requestPayload })
      .from(manualExtractionJobs)
      .where(eq(manualExtractionJobs.id, jobId))
      .limit(1);
    if (!job || job.requestPayload.message.content === '') return;
    await db
      .update(manualExtractionJobs)
      .set({ requestPayload: { ...job.requestPayload, message: { ...job.requestPayload.message, content: '' } } })
      .where(eq(manualExtractionJobs.id, jobId));
  } catch (err) {
    console.error(`[blankManualJobPayloadContent] Could not blank request_payload content for job ${jobId}:`, err);
  }
}
