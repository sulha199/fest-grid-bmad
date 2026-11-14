import { and, eq, notInArray } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import {
  JOB_TERMINAL_STATUSES,
  REEXTRACT_POST_JOB_TYPE,
  isReextractJobStale,
  type ReextractPostJobInput,
} from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { cancelJob } from '../job-engine/cancel-job.js';
import { startJob } from '../job-engine/start-job.js';
import { blankHeldPost } from './held-post.js';

// Story 10.6 (AC1; AD-53 Rule 3) -- starts the engine job `reextract-post` for a stored post (with or without a stored caption) or a
// URL that is not in the database. API-Lambda side: it imports only `startJob` and `cancelJob` (no handler, no image-processing
// runtime). The caller (`startPostReextractionPreview`) has already enforced `requireModerator`, found the post, refused a post whose
// stepped extraction is running and checked a URL's platform and the moderator's Gemini key.
//
// The input key is the post id (or the URL's key), so a second click by the same moderator on a job still open joins it (REUSED,
// FR120) and the same job id is returned: the moderator screen keeps polling that one. EXCEPT a job that is stuck: admitted, not
// ended and with no write to it for 5 minutes (owner decision 2026-11-12): that one is cancelled, with a plain reason, and a fresh
// job takes its place. The rule lives here, not in `admitJob`: every other type keeps plain reuse. A job still waiting in the queue
// for a place is not stuck and is never replaced. Admission applies as for every job: three places per user, then the queue (a QUEUED
// job reads as PENDING to the screen); a refused start is the generic `EXTRACTION_FAILED` with the engine's plain message, because
// the existing error codes of the screen have no "too many jobs" member (Story 10.3a/10.4 own that screen).

export type StartReextractPostJobResult = { jobId: string } | { errorCode: 'EXTRACTION_FAILED'; errorMessage: string };

export const STUCK_JOB_CANCEL_MESSAGE = 'The job made no progress for 5 minutes and was replaced by a new Re-extract.';

export async function startReextractPostJob(
  userId: string,
  target: { inputKey: string; payload: ReextractPostJobInput },
  now: Date = new Date()
): Promise<StartReextractPostJobResult> {
  const [open] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.ownerUserId, userId),
        eq(jobs.type, REEXTRACT_POST_JOB_TYPE),
        eq(jobs.inputKey, target.inputKey),
        notInArray(jobs.status, [...JOB_TERMINAL_STATUSES])
      )
    )
    .limit(1);
  if (open && isReextractJobStale(open, now)) {
    console.warn(`[startReextractPostJob] job ${open.id} made no progress for 5 minutes; replacing it`);
    if ((await cancelJob(open.id, userId, { message: STUCK_JOB_CANCEL_MESSAGE })) === 'CANCELLED') {
      await blankHeldPost(open.id); // a stuck job may still hold a fetched caption
    }
  }

  const result = await startJob(REEXTRACT_POST_JOB_TYPE, { inputKey: target.inputKey, payload: target.payload }, userId);
  if ('jobId' in result) {
    return { jobId: result.jobId };
  }
  return { errorCode: 'EXTRACTION_FAILED', errorMessage: result.errorMessage };
}
