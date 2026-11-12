import { REEXTRACT_POST_JOB_TYPE, reextractPostInputKey } from '@festgrid/domain/jobs';
import { startJob } from '../job-engine/start-job.js';

// Story 10.6 (AC1; AD-53 Rule 3) -- starts the engine job `reextract-post` for a stored post that keeps its caption. API-Lambda side:
// it imports only `startJob` (no handler, no image-processing runtime). The caller (`startPostReextractionPreview`) has already
// enforced `requireModerator`, found the post and refused a post whose stepped extraction is running.
//
// The input key is the post id, so a second click by the same moderator on a job still open joins it (REUSED, FR120) and the same
// job id is returned: the moderator screen keeps polling that one. Admission applies as for every job: three places per user,
// then the queue (a QUEUED job reads as PENDING to the screen); a refused start is the generic `EXTRACTION_FAILED` with the engine's
// plain message, because the existing error codes of the screen have no "too many jobs" member (Story 10.3a/10.4 own that screen).

export type StartReextractPostJobResult = { jobId: string } | { errorCode: 'EXTRACTION_FAILED'; errorMessage: string };

export async function startReextractPostJob(userId: string, postId: string): Promise<StartReextractPostJobResult> {
  const result = await startJob(
    REEXTRACT_POST_JOB_TYPE,
    { inputKey: reextractPostInputKey(postId), payload: { postId } },
    userId
  );
  if ('jobId' in result) {
    return { jobId: result.jobId };
  }
  return { errorCode: 'EXTRACTION_FAILED', errorMessage: result.errorMessage };
}
