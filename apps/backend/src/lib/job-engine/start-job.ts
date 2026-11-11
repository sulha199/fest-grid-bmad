import { eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { computeJobDeadline, getJobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { invokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';

// Story 10.1a -- API-Lambda side of the job engine (AC1, AC8; PRD FR116, FR130). Deliberately imports nothing that
// pulls in a handler or the image-processing runtime: it needs only the type's pure definition.

export type StartJobResult =
  | { jobId: string }
  | { errorCode: 'JOB_START_FAILED'; errorMessage: string };

const START_FAILED_MESSAGE = 'The job could not be started. Please try again.';

/**
 * The user entry point (`trigger: 'USER'`, owner required). No entry point for system jobs exists: no system job type
 * does yet (FR130, data only); the first one adds it.
 *
 * Inserts the row, then fires one async invoke at the type's host Lambda. Returns the job id at once whether or not
 * the invoke succeeds; a failed invoke marks the job FAILED and returns the start error, the same fail-to-start shape
 * as `startManualExtractionJob`. Admission is immediate here (`admittedAt = now`): queueing over the user's limit is
 * Story 10.3.
 */
export async function startJob(
  type: string,
  input: { inputKey: string; payload?: unknown },
  ownerUserId: string
): Promise<StartJobResult> {
  const definition = getJobTypeDefinition(type);
  if (!definition) {
    console.error(`[startJob] unknown job type ${type}; nothing was written`);
    return { errorCode: 'JOB_START_FAILED', errorMessage: START_FAILED_MESSAGE };
  }

  const admittedAt = new Date();
  const [job] = await db
    .insert(jobs)
    .values({
      type,
      ownerUserId,
      trigger: 'USER',
      inputKey: input.inputKey,
      input: input.payload ?? null,
      status: 'QUEUED',
      admittedAt,
      deadlineAt: computeJobDeadline(admittedAt, definition),
    })
    .returning({ id: jobs.id });

  const failToStart = async (reason: unknown): Promise<StartJobResult> => {
    console.error(`[startJob] could not start job ${job.id} (${type}):`, reason);
    const now = new Date();
    await db
      .update(jobs)
      .set({
        status: 'FAILED',
        reasonCode: 'NO_PROVIDER_REACHABLE',
        errorMessage: START_FAILED_MESSAGE,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(jobs.id, job.id));
    return { errorCode: 'JOB_START_FAILED', errorMessage: START_FAILED_MESSAGE };
  };

  const env = loadBackendEnv();
  const functionName = definition.host === 'scraper' ? env.scraperFunctionName : env.aiProcessorFunctionName;
  if (!functionName) {
    return failToStart(new Error(`The function name for host ${definition.host} is not configured`));
  }
  try {
    await invokeJobEngineWorker(functionName, { jobId: job.id });
  } catch (err) {
    return failToStart(err);
  }
  return { jobId: job.id };
}
