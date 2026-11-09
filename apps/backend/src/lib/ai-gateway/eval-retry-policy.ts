import { decideRetry } from '@festgrid/domain/retry';
import { classifyGeminiMessage } from './gemini-situation.js';

/**
 * Retry policy for the opt-in golden-prompt live eval (`scripts/run-golden-prompt-live-eval.ts`): a thin
 * reader of the shared policy (AD-52), so the eval and production retry the same way. Pure so it is
 * unit-testable; the script owns the sleeping.
 *
 * - 429 on a per-minute quota: wait the "Please retry in 42.43s" hint (rounded up) plus the policy's 1s
 *   margin, else 60s -- the free tier allows ~15 requests/minute.
 * - 429 on a per-DAY quota: retrying within this run cannot help, so give up (`undefined`).
 * - 503 / UNAVAILABLE / connection resets: the policy's jittered exponential backoff.
 * - Anything else (bad key, invalid request, an unclassified error): never retried here.
 */
export const EVAL_MAX_ATTEMPTS = 6;
const MAX_DELAY_MS = 120_000;
// No hint on a 429: 59s plus the policy's 1s margin is the 60s a per-minute quota needs.
const DEFAULT_RATE_LIMIT_HINT_SECONDS = 59;

/**
 * True when Gemini rejected the call because the key's per-DAY quota (e.g. 20 RPD on a free-tier
 * flash model) is spent. Nothing can succeed until the quota resets, so the eval stops and leaves
 * the rest of its window pending instead of failing the whole run.
 */
export function isEvalDailyQuotaError(message: string): boolean {
  return classifyGeminiMessage(message).situation === 'quota_exhausted_daily';
}

export function nextEvalRetryDelayMs(message: string, attempt: number): number | undefined {
  if (attempt >= EVAL_MAX_ATTEMPTS) {
    return undefined;
  }
  const classified = classifyGeminiMessage(message);
  const decision = decideRetry(classified.situation, attempt, {
    ...(classified.situation === 'rate_limited'
      ? { retryAfterSeconds: classified.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_HINT_SECONDS }
      : {}),
    maxInCallAttempts: EVAL_MAX_ATTEMPTS,
  });
  // The eval has no durable layer: only an immediate retry is acted on; anything handed to a later
  // run (`retry_later`) or refused (`give_up`) ends this request.
  return decision.action === 'retry_now' ? Math.min(decision.delayMs ?? 0, MAX_DELAY_MS) : undefined;
}
