import { sweepStaleManualExtractionRetention } from '../extraction/sweep-stale-manual-extraction-jobs.js';
import { sweepExpiredEngineJobs } from './sweep-expired-jobs.js';
import {
  expireQueuedJobsWaitedTooLong,
  promoteOwnersWithQueuedJobs,
  readmitDueWaitingJobs,
  settleOrphanedAndFinishedFollowers,
} from './sweep-job-queue.js';

// Story 10.1a (AC4) -- the database-only job sweep, run every 5 minutes by its own EventBridge rule on the Scraper
// Lambda (`jobType: 'job-engine-sweep'`; owner decision 2026-11-08). The hourly vendor sweep also makes Bright Data and
// Apify progress calls and must not run more often; this one makes none, so a crashed or hung job ends within about
// five minutes instead of up to an hour. `runStaleJobSweep()` is not modified.

// Story 10.3 added the admission steps (queue-wait expiry, follower settling, re-admission, promotion). Order matters:
// expiries first (they free places and end leaders), then followers settle, then due WAITING jobs rejoin the queue, then
// promotion hands out the free places.
export interface JobEngineSweepSteps {
  expireJobs: () => Promise<number>;
  expireQueuedJobs: () => Promise<number>;
  settleFollowers: () => Promise<number>;
  readmitWaitingJobs: () => Promise<number>;
  promoteQueuedJobs: () => Promise<number>;
  retention: () => Promise<void>;
}

const defaultSteps: JobEngineSweepSteps = {
  expireJobs: () => sweepExpiredEngineJobs(),
  expireQueuedJobs: () => expireQueuedJobsWaitedTooLong(),
  settleFollowers: () => settleOrphanedAndFinishedFollowers(),
  readmitWaitingJobs: () => readmitDueWaitingJobs(),
  promoteQueuedJobs: () => promoteOwnersWithQueuedJobs(),
  retention: () => sweepStaleManualExtractionRetention(),
};

/** Each step has its own try/catch, so one failing never skips the others, and the sweep itself never throws. */
export async function runJobEngineSweep(steps: JobEngineSweepSteps = defaultSteps): Promise<void> {
  const counted: Array<[string, () => Promise<number>, string]> = [
    ['expiring overdue jobs', steps.expireJobs, 'expired {n} job(s) past their deadline'],
    ['expiring queued jobs', steps.expireQueuedJobs, 'expired {n} queued job(s) that waited too long'],
    ['settling followers', steps.settleFollowers, 'settled {n} follower job(s)'],
    ['re-admitting waiting jobs', steps.readmitWaitingJobs, 're-admitted {n} waiting job(s)'],
    ['promoting queued jobs', steps.promoteQueuedJobs, 'promoted {n} queued job(s)'],
  ];
  for (const [label, step, message] of counted) {
    try {
      const n = await step();
      if (n > 0) console.log(`[job-engine-sweep] ${message.replace('{n}', String(n))}`);
    } catch (error) {
      console.error(`[job-engine-sweep] ${label} failed; continuing:`, error);
    }
  }
  try {
    await steps.retention();
  } catch (error) {
    console.error('[job-engine-sweep] manual-extraction retention failed:', error);
  }
}
