import { PostScraperBudgetError, ScraperCapacityExceededError } from '@festgrid/domain';
import { VendorDpaNotConfirmedError } from '../vendor-gateway/guarded-call.js';
import { ApifyMemoryLimitExhaustedError, ApifyMonthlyUsageLimitError } from './instagram-adapter.js';

/**
 * FIND-261102-4qm -- true for an error that is known to have been thrown before any vendor run could have started (so no credit
 * could have been spent): our own per-provider capacity gate, the DPA-confirmation gate `callVendor` checks before it ever makes the
 * call, Apify refusing to START a run because the account's memory cap or monthly usage cap is reached (the free plan's $5 cap is
 * the live case), and (Story 10.2, AD-53 Rule 15) the post chain having skipped every provider (`PostScraperBudgetError`). All are
 * typed errors raised at the call site, never guessed from a message. Anything else (including a timeout or a real vendor-side
 * failure) is assumed to have started the call. Shared by the legacy re-extract rescrape and the engine re-extract job, so the 10
 * minute cooldown starts only when a vendor call ran.
 */
export function isPreVendorCallFailure(err: unknown): boolean {
  return (
    err instanceof ScraperCapacityExceededError ||
    err instanceof VendorDpaNotConfirmedError ||
    err instanceof ApifyMemoryLimitExhaustedError ||
    err instanceof ApifyMonthlyUsageLimitError ||
    err instanceof PostScraperBudgetError
  );
}
