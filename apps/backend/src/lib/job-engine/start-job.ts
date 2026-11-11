import { getJobTypeDefinition } from '@festgrid/domain/jobs';
import { admitJob } from './admit-job.js';
import { afterJobEnded } from './after-job-ended.js';
import { START_FAILED_MESSAGE, invokeJobHost, markJobStartFailed } from './job-host.js';

// Story 10.1a/10.3 -- API-Lambda side of the job engine (PRD FR116, FR120 to FR122, FR130). Deliberately imports nothing
// that pulls in a handler or the image-processing runtime: it needs only the type's pure definition.

export type StartJobResult =
  | { jobId: string; outcome: 'ADMITTED' | 'REUSED' | 'SHARED' }
  | { jobId: string; outcome: 'QUEUED'; position: number }
  | {
      errorCode: 'JOB_START_FAILED' | 'JOB_QUEUE_FULL' | 'SUBSCRIPTION_CAP_REACHED';
      errorMessage: string;
      /** SUBSCRIPTION_CAP_REACHED only: the numbers the refusal screen shows (Story 10.3a). */
      details?: { activeCount: number; reservedCount: number; cap: number };
    };

const QUEUE_FULL_MESSAGE = 'Too many jobs are already waiting. Please try again once some have finished.';
const CAP_REACHED_MESSAGE = 'The subscription cap is reached.';

export interface StartJobInput {
  inputKey: string;
  payload?: unknown;
  /** For a type that reserves a subscription slot: the user already holds this account, so it needs no extra slot. */
  alreadyHeldSubscription?: boolean;
}

/**
 * The user entry point (`trigger: 'USER'`, owner required). No entry point for system jobs exists: no system job type
 * does yet (FR130, data only); the first one adds it.
 *
 * `admitJob` decides in one locked transaction: the same work already open for this user is REUSED (nothing written,
 * nothing invoked); another user's open job of a sharing type is joined as a follower (SHARED); otherwise the job is
 * ADMITTED, or QUEUED behind the user's limit, or refused (queue full, subscription cap). Only an ADMITTED job is
 * invoked, after the transaction commits, with one async invoke carrying only `{ jobId }`. A failed invoke ends the job
 * FAILED / START_FAILED, frees its place for the next queued job and returns the start error, the same fail-to-start
 * shape as `startManualExtractionJob`.
 */
export async function startJob(type: string, input: StartJobInput, ownerUserId: string): Promise<StartJobResult> {
  const startError = { errorCode: 'JOB_START_FAILED', errorMessage: START_FAILED_MESSAGE } as const;
  if (!getJobTypeDefinition(type)) {
    console.error(`[startJob] unknown job type ${type}; nothing was written`);
    return startError;
  }

  const admission = await admitJob({
    type,
    inputKey: input.inputKey,
    payload: input.payload,
    ownerUserId,
    alreadyHeldSubscription: input.alreadyHeldSubscription,
  });

  if ('refused' in admission) {
    switch (admission.refused) {
      case 'JOB_QUEUE_FULL':
        return { errorCode: 'JOB_QUEUE_FULL', errorMessage: QUEUE_FULL_MESSAGE };
      case 'SUBSCRIPTION_CAP_REACHED':
        return {
          errorCode: 'SUBSCRIPTION_CAP_REACHED',
          errorMessage: CAP_REACHED_MESSAGE,
          details: { activeCount: admission.activeCount, reservedCount: admission.reservedCount, cap: admission.cap },
        };
      default:
        console.error(`[startJob] ${admission.refused} for job type ${type}; nothing was written`);
        return startError;
    }
  }

  if (admission.outcome === 'QUEUED') {
    // A place may have freed between the lock and now (or a wake-up was lost): give it to the oldest waiting job.
    await afterJobEnded({ id: admission.jobId, ownerUserId }, false);
    return { jobId: admission.jobId, outcome: 'QUEUED', position: admission.position };
  }
  if (admission.outcome !== 'ADMITTED') {
    return { jobId: admission.jobId, outcome: admission.outcome };
  }

  try {
    await invokeJobHost(type, admission.jobId);
  } catch (error) {
    console.error(`[startJob] could not start job ${admission.jobId} (${type}):`, error);
    if (await markJobStartFailed(admission.jobId)) {
      await afterJobEnded({ id: admission.jobId, ownerUserId }, true);
    }
    return startError;
  }
  return { jobId: admission.jobId, outcome: 'ADMITTED' };
}
