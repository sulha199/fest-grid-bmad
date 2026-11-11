import { and, asc, eq, isNull } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { freePlaces, getJobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { lockUserRow } from '../subscriptions/subscription-cap.js';
import { admittedColumns, countPlacesHeld } from './admit-job.js';
import { JobHostUnreachableError, invokeJobHost, markJobStartFailed, putBackInQueue } from './job-host.js';
import { settleFollowers } from './settle-followers.js';

// Story 10.3 (AC4; PRD FR121) -- gives free places to a user's waiting jobs, oldest first (`queued_since`, then id).
// Runs at the end of a worker's run (any ending, and WAITING), after a failed start, from `cancelJob`, and from the
// 5-minute sweep, so a lost wake-up cannot strand a queued job. Counting and the admitted columns are `admitJob`'s own.

const MAX_ROUNDS = 10;

/** Admits as many of the user's queued jobs as there are free places and invokes each host. Returns how many were invoked. */
export async function promoteQueuedJobs(ownerUserId: string): Promise<number> {
  const env = loadBackendEnv();
  let invokedTotal = 0;
  // Jobs this call could not reach the host of: put back in the queue and left alone for the rest of this call.
  const skipped = new Set<string>();

  // A round promotes, then invokes. An invoke that fails ends that job and frees its place, so another round runs.
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const promoted = await db.transaction(async (tx) => {
      const user = await lockUserRow(tx, ownerUserId);
      if (!user) {
        return [];
      }
      const free = freePlaces({ placesHeld: await countPlacesHeld(tx, ownerUserId), maxPlaces: env.maxConcurrentJobsPerUser });
      if (free === 0) {
        return [];
      }
      const waiting = await tx
        .select({ id: jobs.id, type: jobs.type, queuedSince: jobs.queuedSince })
        .from(jobs)
        .where(and(eq(jobs.ownerUserId, ownerUserId), eq(jobs.status, 'QUEUED'), isNull(jobs.admittedAt)))
        .orderBy(asc(jobs.queuedSince), asc(jobs.id))
        .for('update');

      const admitted: Array<{ id: string; type: string; queuedSince: Date | null }> = [];
      const now = new Date();
      for (const job of waiting) {
        if (admitted.length >= free) {
          break;
        }
        if (skipped.has(job.id)) {
          continue;
        }
        // A type this Lambda does not know cannot be started from here; it stays queued for a Lambda that does (and the
        // queue-wait rule ends it if none does).
        const definition = getJobTypeDefinition(job.type);
        if (!definition) {
          console.warn(`[promoteQueuedJobs] job ${job.id} has type ${job.type}, which has no definition in this Lambda; left queued`);
          continue;
        }
        await tx.update(jobs).set({ ...admittedColumns(definition, now), updatedAt: now }).where(eq(jobs.id, job.id));
        admitted.push(job);
      }
      return admitted;
    });

    if (promoted.length === 0) {
      return invokedTotal;
    }
    let anyFailed = false;
    for (const job of promoted) {
      try {
        await invokeJobHost(job.type, job.id);
        invokedTotal += 1;
      } catch (error) {
        if (error instanceof JobHostUnreachableError) {
          // A configuration gap of THIS Lambda, not a problem with the job: back to the queue, in its old place, for a
          // Lambda that can reach the host (the sweep on the Scraper). Never fail a valid job over it.
          console.warn(`[promoteQueuedJobs] job ${job.id} (${job.type}): ${error.message}; put back in the queue`);
          await putBackInQueue(job.id, job.queuedSince);
          skipped.add(job.id);
          anyFailed = true;
          continue;
        }
        console.error(`[promoteQueuedJobs] could not start job ${job.id} (${job.type}):`, error);
        anyFailed = true;
        if (await markJobStartFailed(job.id)) {
          await settleFollowers(job.id).catch((settleError) =>
            console.error(`[promoteQueuedJobs] settling followers of ${job.id} failed:`, settleError)
          );
        }
      }
    }
    if (!anyFailed) {
      return invokedTotal;
    }
  }
  return invokedTotal;
}
