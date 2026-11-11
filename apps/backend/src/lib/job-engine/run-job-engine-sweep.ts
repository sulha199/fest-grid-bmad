import { sweepStaleManualExtractionRetention } from '../extraction/sweep-stale-manual-extraction-jobs.js';
import { sweepExpiredEngineJobs } from './sweep-expired-jobs.js';

// Story 10.1a (AC4) -- the database-only job sweep, run every 5 minutes by its own EventBridge rule on the Scraper
// Lambda (`jobType: 'job-engine-sweep'`; owner decision 2026-11-08). The hourly vendor sweep also makes Bright Data and
// Apify progress calls and must not run more often; this one makes none, so a crashed or hung job ends within about
// five minutes instead of up to an hour. `runStaleJobSweep()` is not modified.

export interface JobEngineSweepSteps {
  expireJobs: () => Promise<number>;
  retention: () => Promise<void>;
}

const defaultSteps: JobEngineSweepSteps = {
  expireJobs: () => sweepExpiredEngineJobs(),
  retention: () => sweepStaleManualExtractionRetention(),
};

/** Each half has its own try/catch, so one failing never skips the other, and the sweep itself never throws. */
export async function runJobEngineSweep(steps: JobEngineSweepSteps = defaultSteps): Promise<void> {
  try {
    const expired = await steps.expireJobs();
    if (expired > 0) console.log(`[job-engine-sweep] expired ${expired} job(s) past their deadline`);
  } catch (error) {
    console.error('[job-engine-sweep] expiring overdue jobs failed; continuing:', error);
  }
  try {
    await steps.retention();
  } catch (error) {
    console.error('[job-engine-sweep] manual-extraction retention failed:', error);
  }
}
