import { jobAttempts } from '@festgrid/database';
import { PostUnavailableError, ScraperCapacityExceededError, type PostAdapterAttempt } from '@festgrid/domain';
import { db } from '../../db/client.js';
import { isProfileLookupTimeout } from '../scraper/profile-lookup-attempts-store.js';
import { ApifyMemoryLimitExhaustedError, ApifyMonthlyUsageLimitError } from '../scraper/instagram-adapter.js';
import { VendorDpaNotConfirmedError } from '../vendor-gateway/guarded-call.js';

// Story 10.2 (AC2; PRD FR118, 4.21 JobAttempt) -- one `job_attempts` row per provider the post chain considered. Plain words only:
// the row carries a reason CODE, never the raw vendor error, a URL or a caption (this repo and its logs are public, and the Jobs
// page of Story 10.4 reads these rows).

type AttemptRow = Omit<typeof jobAttempts.$inferInsert, 'id' | 'jobId' | 'createdAt' | 'updatedAt'>;

const PROVIDER = { apify: 'APIFY', brightdata: 'BRIGHTDATA' } as const;

/** Pure mapping, exported for its tests. */
export function toJobAttemptRow(attempt: PostAdapterAttempt): AttemptRow {
  const provider = PROVIDER[attempt.adapter];
  switch (attempt.outcome) {
    case 'found':
      return { provider, outcome: 'SUCCEEDED', budgetMs: Math.round(attempt.budgetMs), elapsedMs: Math.round(attempt.elapsedMs) };
    case 'not-found':
      // The vendor answered that the post does not exist: a result, not a failure.
      return { provider, outcome: 'SUCCEEDED', budgetMs: Math.round(attempt.budgetMs), elapsedMs: Math.round(attempt.elapsedMs), reasonCode: 'POST_NOT_FOUND' };
    case 'skipped':
      if (attempt.reason === 'quota') {
        return { provider, outcome: 'OVER_QUOTA', budgetMs: Math.round(attempt.budgetMs), elapsedMs: 0, reasonCode: 'CAP_KNOWN_USED_UP' };
      }
      return {
        provider,
        outcome: 'SKIPPED',
        budgetMs: Math.round(attempt.budgetMs),
        elapsedMs: 0,
        reasonCode: attempt.reason === 'degraded' ? 'PROVIDER_DEGRADED' : 'BUDGET_TOO_SMALL',
      };
    case 'failed': {
      const base = { provider, budgetMs: Math.round(attempt.budgetMs), elapsedMs: Math.round(attempt.elapsedMs) };
      // Story 10.6: a refusal raised BEFORE any vendor call is a capacity (or configuration) condition, not a call that ran, so the
      // re-extract cooldown (which counts only attempts whose vendor call ran) can read these rows (FIND-261102-4qm).
      if (
        attempt.error instanceof ScraperCapacityExceededError ||
        attempt.error instanceof ApifyMemoryLimitExhaustedError ||
        attempt.error instanceof ApifyMonthlyUsageLimitError
      ) {
        return { ...base, outcome: 'OVER_QUOTA', reasonCode: 'CAP_REACHED' };
      }
      if (attempt.error instanceof VendorDpaNotConfirmedError) {
        return { ...base, outcome: 'SKIPPED', reasonCode: 'DPA_NOT_CONFIRMED' };
      }
      if (attempt.error instanceof PostUnavailableError) {
        return { ...base, outcome: 'EMPTY', reasonCode: 'EMPTY_RESULT' };
      }
      if (isProfileLookupTimeout(attempt.error)) {
        return { ...base, outcome: 'TIMED_OUT', reasonCode: 'TIMED_OUT' };
      }
      return { ...base, outcome: 'FAILED', reasonCode: 'PROVIDER_ERROR' };
    }
  }
}

/** Writes the attempt row. Never throws: an audit write must not change what a fetch returns (the chain also guards this). */
export async function recordJobAttempt(input: { jobId: string; attempt: PostAdapterAttempt }): Promise<void> {
  try {
    await db.insert(jobAttempts).values({ jobId: input.jobId, ...toJobAttemptRow(input.attempt) });
  } catch (error) {
    console.error(`[job-attempts] could not record an attempt for job ${input.jobId}:`, error);
  }
}
