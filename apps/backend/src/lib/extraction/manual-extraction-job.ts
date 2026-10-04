import { and, eq, inArray, lt } from 'drizzle-orm';
import { manualExtractionJobs } from '@festgrid/database';
import {
  MANUAL_EXTRACTION_JOB_STALE_AFTER_MS,
  type ManualExtractionRequestPayload,
} from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { invokeAiProcessor } from '../aws/invoke-ai-processor.js';

// Story 4.2b -- API-Lambda side of manual "AI-Assisted Correction" extraction. Deliberately has
// no import of anything that pulls in the image-processing runtime (sharp / face-api / tfjs): the
// blur itself runs in the AI Lambda (process-manual-extraction-job.ts).

export type StartManualExtractionJobResult =
  | { jobId: string }
  | { errorCode: 'EXTRACTION_FAILED'; errorMessage: string };

export async function startManualExtractionJob(
  userId: string,
  sourceUrl: string,
  requestPayload: ManualExtractionRequestPayload
): Promise<StartManualExtractionJobResult> {
  const [job] = await db
    .insert(manualExtractionJobs)
    .values({ requestedByUserId: userId, sourceUrl, requestPayload })
    .returning({ id: manualExtractionJobs.id });

  const failToStart = async (reason: unknown): Promise<StartManualExtractionJobResult> => {
    console.error(`[startManualExtractionJob] could not start job ${job.id}:`, reason);
    const errorMessage = 'The extraction could not be started. Please try again.';
    await db
      .update(manualExtractionJobs)
      .set({ status: 'FAILED', errorCode: 'EXTRACTION_FAILED', errorMessage, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(manualExtractionJobs.id, job.id));
    return { errorCode: 'EXTRACTION_FAILED', errorMessage };
  };

  const functionName = loadBackendEnv().aiProcessorFunctionName;
  if (!functionName) {
    return failToStart(new Error('AI_PROCESSOR_FUNCTION_NAME is not configured'));
  }
  try {
    await invokeAiProcessor(functionName, { jobType: 'manual-extraction', jobId: job.id });
  } catch (err) {
    return failToStart(err);
  }
  return { jobId: job.id };
}

export interface ManualExtractionJobStatusResult {
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  data: unknown | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Owner-scoped read. Returns null for an unknown id OR another user's job (the resolver maps
 * both to NOT_FOUND). A non-terminal job older than MANUAL_EXTRACTION_JOB_STALE_AFTER_MS is
 * marked FAILED/EXTRACTION_FAILED here, lazily -- no sweep cron -- so a lost invoke or a crashed
 * AI Lambda can never leave the requester polling forever.
 */
export async function getManualExtractionJobStatus(
  jobId: string,
  userId: string,
  now: Date = new Date()
): Promise<ManualExtractionJobStatusResult | null> {
  const [job] = await db
    .select()
    .from(manualExtractionJobs)
    .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.requestedByUserId, userId)))
    .limit(1);
  if (!job) return null;

  if (
    (job.status === 'PENDING' || job.status === 'PROCESSING') &&
    now.getTime() - job.createdAt.getTime() > MANUAL_EXTRACTION_JOB_STALE_AFTER_MS
  ) {
    const errorMessage = 'The extraction timed out. Please try again.';
    // Guarded on the non-terminal statuses so a job that finished between the read above and
    // this write is never overwritten.
    const updated = await db
      .update(manualExtractionJobs)
      .set({ status: 'FAILED', errorCode: 'EXTRACTION_FAILED', errorMessage, completedAt: now, updatedAt: now })
      .where(
        and(
          eq(manualExtractionJobs.id, jobId),
          inArray(manualExtractionJobs.status, ['PENDING', 'PROCESSING']),
          lt(manualExtractionJobs.createdAt, new Date(now.getTime() - MANUAL_EXTRACTION_JOB_STALE_AFTER_MS))
        )
      )
      .returning({ id: manualExtractionJobs.id });
    if (updated.length > 0) {
      return { status: 'FAILED', data: null, errorCode: 'EXTRACTION_FAILED', errorMessage };
    }
    return getManualExtractionJobStatus(jobId, userId, now);
  }

  return {
    status: job.status,
    data: job.status === 'SUCCEEDED' ? (job.resultData ?? null) : null,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
  };
}
