import { and, eq, isNull } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { getJobTypeDefinition, type JobHost } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { invokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';

// Story 10.1a/10.3 -- the two things every path that admits a job does AFTER its transaction commits: fire the async
// invoke at the type's host Lambda, and, if that cannot be done, end the job FAILED / START_FAILED. Shared by `startJob`
// and `promoteQueuedJobs` so a start and a promotion can never diverge.

export const START_FAILED_MESSAGE = 'The job could not be started. Please try again.';

/**
 * This Lambda cannot invoke the host's Lambda (no function name configured for it here). Not a failure of the JOB: the
 * promotion paths put the job back in the queue instead of ending it, and a Lambda that can reach the host (the 5-minute
 * sweep on the Scraper) starts it later. The API Lambda reaches both hosts, so `startJob` never sees this in production.
 */
export class JobHostUnreachableError extends Error {
  constructor(host: JobHost) {
    super(`This Lambda has no function name configured for host ${host}`);
    this.name = 'JobHostUnreachableError';
  }
}

function functionNameFor(host: JobHost): string | undefined {
  const env = loadBackendEnv();
  const configured = host === 'scraper' ? env.scraperFunctionName : env.aiProcessorFunctionName;
  if (configured) {
    return configured;
  }
  // A worker can always invoke itself: CDK sets JOB_HOST_SELF on each host Lambda (a Ref to its own name would be a cycle).
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.JOB_HOST_SELF === host) {
    return process.env.AWS_LAMBDA_FUNCTION_NAME;
  }
  return undefined;
}

/** Invokes the job's host Lambda with only `{ jobId }`. Throws if the type or the function name is unknown, or the invoke fails. */
export async function invokeJobHost(type: string, jobId: string): Promise<void> {
  const definition = getJobTypeDefinition(type);
  if (!definition) {
    throw new Error(`Job type ${type} has no registered definition in this Lambda`);
  }
  const functionName = functionNameFor(definition.host);
  if (!functionName) {
    throw new JobHostUnreachableError(definition.host);
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

/**
 * Undoes an admission whose host could not be reached from this Lambda: back to a waiting QUEUED job (not admitted), in
 * its old queue place. Guarded on still QUEUED and unclaimed, so a job a worker already took is left alone.
 */
export async function putBackInQueue(jobId: string, queuedSince: Date | null): Promise<void> {
  const now = new Date();
  await db
    .update(jobs)
    .set({ admittedAt: null, queuedSince: queuedSince ?? now, updatedAt: now })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'QUEUED'), isNull(jobs.workerClaimedAt)));
}
