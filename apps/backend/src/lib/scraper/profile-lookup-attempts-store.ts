import { ApifyRequestTimeoutError, type ProfileAdapterAttempt, type ProfileScrapePurpose } from '@festgrid/domain';
import { profileLookupAttempts } from '@festgrid/database';
import { db } from '../../db/client.js';
import { VendorCallTimeoutError } from '../vendor-gateway/guarded-call.js';

type Outcome = 'FOUND' | 'NOT_FOUND' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED';

const MAX_ERROR_MESSAGE_LENGTH = 500;

/**
 * Whether a failed attempt ran out of time rather than being refused or erroring: the two timeout types, and the
 * wording the vendor clients use when a call or a snapshot outlives its budget ("timed out", "was still running").
 * Timeouts are the case worth telling apart: they are the ones a longer budget or a slower adapter can fix.
 */
export function isProfileLookupTimeout(error: unknown): boolean {
  if (error instanceof ApifyRequestTimeoutError || error instanceof VendorCallTimeoutError) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /timed out|was still (running|building|scheduled|starting)/i.test(message);
}

export function profileLookupOutcome(attempt: ProfileAdapterAttempt): Outcome {
  switch (attempt.outcome) {
    case 'found':
      return 'FOUND';
    case 'not-found':
      return 'NOT_FOUND';
    case 'skipped':
      return 'SKIPPED';
    case 'failed':
      return isProfileLookupTimeout(attempt.error) ? 'TIMED_OUT' : 'FAILED';
  }
}

/**
 * Writes one `profile_lookup_attempts` row for an adapter the profile scraper chain considered. Best effort: a
 * failed write is logged and swallowed, because the audit trail must never change what a lookup returns. This is
 * what makes "how often does the Apify profile lookup time out?" a SQL question.
 */
export async function recordProfileLookupAttempt(input: {
  purpose: ProfileScrapePurpose;
  handle: string;
  attempt: ProfileAdapterAttempt;
}): Promise<void> {
  const { purpose, handle, attempt } = input;
  try {
    const failure = attempt.outcome === 'failed' ? attempt.error : undefined;
    await db.insert(profileLookupAttempts).values({
      purpose: purpose === 'lookup' ? 'LOOKUP' : 'CLASSIFICATION',
      handle,
      vendor: attempt.adapter === 'apify' ? 'APIFY' : 'BRIGHTDATA',
      outcome: profileLookupOutcome(attempt),
      budgetMs: Math.round(attempt.budgetMs),
      durationMs: attempt.outcome === 'skipped' ? null : Math.round(attempt.elapsedMs),
      errorMessage:
        failure === undefined
          ? attempt.outcome === 'skipped'
            ? attempt.reason
            : null
          : (failure instanceof Error ? failure.message : String(failure)).slice(0, MAX_ERROR_MESSAGE_LENGTH),
    });
  } catch (error) {
    console.error(`[profile-scraper] could not record the ${attempt.adapter} attempt for ${handle}:`, error);
  }
}
