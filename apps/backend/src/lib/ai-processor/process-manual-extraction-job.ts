import { and, eq } from 'drizzle-orm';
import { manualExtractionJobs } from '@festgrid/database';
import { mapExtractionPayloadToProposedCorrection } from '@festgrid/domain/events';
import { db } from '../../db/client.js';
import { callGemini as defaultCallGemini } from '../ai-gateway/adapter.js';
import { ExtractionFailure, extractEventsWithGemini, type ExtractionErrorCode } from './extract-events-with-gemini.js';
import { generateReextractionPreview } from './generate-reextraction-preview.js';
import { blankManualJobPayloadContent } from '../extraction/blank-manual-job-payload.js';

// Story 4.2b -- runs inside the AI Lambda (the only Lambda with the image-processing runtime for
// Story 3.20's pre-AI face blur). Takes over the Gemini call + parse/validate/map half of Story
// 4.2a's `extractEventDataFromUrl`, which previously ran inline in the API Lambda. The
// synchronous pre-checks (dedup lookup, platform detection, key pre-check, scrape) stay in the
// resolver; this file never touches `posts`/`events` and writes no extraction_audit_logs row.
// Story 10.6: the Gemini call and the preview build moved to `extract-events-with-gemini.ts` and `generate-reextraction-preview.ts`
// so the engine job's preview handler runs the same code; the seam below is still the one tests (and that handler) swap.

export let callGeminiForManualExtractionSeam = defaultCallGemini;
export function setCallGeminiForManualExtractionSeam(fn: typeof defaultCallGemini) {
  callGeminiForManualExtractionSeam = fn;
}

export interface ProcessManualExtractionJobDeps {
  // The Lambda Context's getRemainingTimeInMillis, same plumbing as ProcessAiJobDeps.
  getRemainingTimeInMillis?: () => number;
}

async function markFailed(jobId: string, errorCode: ExtractionErrorCode, errorMessage: string): Promise<void> {
  // Guarded on PROCESSING (like the two SUCCEEDED writes below): the 5-minute stale sweep may already have ended this job, and a
  // late worker must never overwrite that (or a result that already landed).
  await db
    .update(manualExtractionJobs)
    .set({ status: 'FAILED', errorCode, errorMessage, completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.status, 'PROCESSING')));
}

export async function processManualExtractionJob(jobId: string, deps?: ProcessManualExtractionJobDeps): Promise<void> {
  // Atomic claim: only the invocation that flips PENDING -> PROCESSING proceeds, so a duplicate
  // delivery of the async invoke can never run Gemini (and spend a key) twice.
  const [job] = await db
    .update(manualExtractionJobs)
    .set({ status: 'PROCESSING', updatedAt: new Date() })
    .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.status, 'PENDING')))
    .returning();

  if (!job) {
    console.warn(`[processManualExtractionJob] Job ${jobId} not found or not PENDING; skipping.`);
    return;
  }

  // AD-40 -- `job.requestPayload` above is the in-memory copy this run works from. Blank the stored
  // one now, not only at the end, so a Lambda timeout or crash mid-run cannot leave the caption in
  // the database. The `finally` below remains as the backstop.
  await blankManualJobPayloadContent(jobId);

  try {
    const { message, existingPostAccountId } = job.requestPayload;
    const isPreview = job.requestPayload.mode === 'REEXTRACT_PREVIEW';
    // The seam is read at call time (a thunk), so a test can swap it between runs.
    const callGemini: typeof defaultCallGemini = (request) => callGeminiForManualExtractionSeam(request);

    if (isPreview) {
      // AD-40 -- preview: report grouping, every event and its dry-run dedup outcome (the shared preview build).
      const preview = await generateReextractionPreview({
        message,
        existingPostAccountId,
        requestedByUserId: job.requestedByUserId,
        postStored: job.requestPayload.postStored ?? Boolean(existingPostAccountId),
        rescraped: job.requestPayload.rescraped ?? false,
        getRemainingTimeInMillis: deps?.getRemainingTimeInMillis,
        callGemini,
      });
      await db
        .update(manualExtractionJobs)
        .set({ status: 'SUCCEEDED', resultData: preview, completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.status, 'PROCESSING')));
      return;
    }

    const { payload } = await extractEventsWithGemini({
      message,
      existingPostAccountId,
      requestedByUserId: job.requestedByUserId,
      isPreview: false,
      getRemainingTimeInMillis: deps?.getRemainingTimeInMillis,
      callGemini,
    });
    if (payload.isEvent === false || !Array.isArray(payload.events) || payload.events.length === 0) {
      throw new ExtractionFailure('EXTRACTION_FAILED', 'The linked post does not appear to describe an event.');
    }
    if (payload.events.length > 1) {
      console.warn(
        `[processManualExtractionJob] Gemini extraction returned ${payload.events.length} events ` +
          `for a single-event correction preview (job ${jobId}); using the first event only.`
      );
    }

    await db
      .update(manualExtractionJobs)
      .set({
        status: 'SUCCEEDED',
        resultData: mapExtractionPayloadToProposedCorrection(payload.events[0]),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.status, 'PROCESSING')));
  } catch (err) {
    if (err instanceof ExtractionFailure) {
      await markFailed(jobId, err.errorCode, err.message);
      return;
    }
    console.error(`[processManualExtractionJob] Job ${jobId} failed unexpectedly:`, err);
    await markFailed(jobId, 'EXTRACTION_FAILED', 'The extraction could not be completed.');
  } finally {
    await blankManualJobPayloadContent(jobId);
  }
}
