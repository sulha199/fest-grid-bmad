import { and, eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { getJobTypeDefinition, type JobHost } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { invokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';

// Story 10.1a/10.3 -- the two things every path that admits a job does AFTER its transaction commits: fire the async
// invoke at the type's host Lambda, and, if that cannot be done, end the job FAILED / START_FAILED. Shared by `startJob`
// and `promoteQueuedJobs` so a start and a promotion can never diverge.

export const START_FAILED_MESSAGE = 'The job could not be started. Please try again.';

function functionNameFor(host: JobHost): string | undefined {
  const env = loadBackendEnv();
  return host === 'scraper' ? env.scraperFunctionName : env.aiProcessorFunctionName;
}

/** Invokes the job's host Lambda with only `{ jobId }`. Throws if the type or the function name is unknown, or the invoke fails. */
export async function invokeJobHost(type: string, jobId: string): Promise<void> {
  const definition = getJobTypeDefinition(type);
  if (!definition) {
    throw new Error(`Job type ${type} has no registered definition in this Lambda`);
  }
  const functionName = functionNameFor(definition.host);
  if (!functionName) {
    throw new Error(`The function name for host ${definition.host} is not configured`);
  }
  await invokeJobEngineWorker(functionName, { jobId });
}

/**
 * Ends a job whose start invoke could not be made: FAILED / START_FAILED, plain-words message. Guarded on still QUEUED, so
 * a job a worker already claimed (an invoke that threw after the Lambda started) is left alone. Database only: the
 * caller promotes the next queued job and settles followers (`afterJobEnded`).
 */
export async function markJobStartFailed(jobId: string): Promise<boolean> {
  const now = new Date();
  const ended = await db
    .update(jobs)
    .set({
      status: 'FAILED',
      reasonCode: 'START_FAILED',
      errorMessage: START_FAILED_MESSAGE,
      workerClaimedAt: null,
      finishedAt: now,
      updatedAt: now,
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'QUEUED')))
    .returning({ id: jobs.id });
  return ended.length > 0;
}
