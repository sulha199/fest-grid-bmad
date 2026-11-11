import { promoteQueuedJobs } from './promote-queued-jobs.js';
import { settleFollowers } from './settle-followers.js';

// Story 10.3 -- what must follow a write that ends a job's run (a terminal status, or WAITING): the next queued job takes
// the freed place, and followers settle with a terminal leader. Both are BEST-EFFORT: a failure here is logged and never
// changes the job's own outcome, because the 5-minute sweep repairs both.

export async function afterJobEnded(job: { id: string; ownerUserId: string | null }, terminal: boolean): Promise<void> {
  if (job.ownerUserId) {
    try {
      await promoteQueuedJobs(job.ownerUserId);
    } catch (error) {
      console.error(`[job-engine] promoting queued jobs after job ${job.id} failed; the sweep will retry:`, error);
    }
  }
  if (terminal) {
    try {
      await settleFollowers(job.id);
    } catch (error) {
      console.error(`[job-engine] settling followers of job ${job.id} failed; the sweep will retry:`, error);
    }
  }
}
