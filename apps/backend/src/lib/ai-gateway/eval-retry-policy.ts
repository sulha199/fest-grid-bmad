/**
 * Retry policy for the opt-in golden-prompt live eval (`scripts/run-golden-prompt-live-eval.ts`).
 * Pure so it is unit-testable; the script owns the sleeping.
 *
 * - 429 / RESOURCE_EXHAUSTED on a per-minute quota: wait the "Please retry in 42.43s" hint Gemini
 *   puts in the message (plus a 1s margin), else 60s -- the free tier allows ~15 requests/minute.
 * - 429 on a per-DAY quota: retrying within this run cannot help, so give up (`undefined`).
 * - 503 / UNAVAILABLE / connection resets: short linear backoff.
 * - Anything else (bad key, invalid request): never retried.
 */
export const EVAL_MAX_ATTEMPTS = 6;
const MAX_DELAY_MS = 120_000;
const DEFAULT_RATE_LIMIT_DELAY_MS = 60_000;

const isRateLimited = (message: string) => /\b429\b|RESOURCE_EXHAUSTED/.test(message);

/**
 * True when Gemini rejected the call because the key's per-DAY quota (e.g. 20 RPD on a free-tier
 * flash model) is spent. Nothing can succeed until the quota resets, so the eval stops and leaves
 * the rest of its window pending instead of failing the whole run.
 */
export function isEvalDailyQuotaError(message: string): boolean {
  return isRateLimited(message) && /PerDay|per day/i.test(message);
}

export function nextEvalRetryDelayMs(message: string, attempt: number): number | undefined {
  if (attempt >= EVAL_MAX_ATTEMPTS) {
    return undefined;
  }
  if (isRateLimited(message)) {
    if (isEvalDailyQuotaError(message)) {
      return undefined;
    }
    const hint = /retry in ([\d.]+)s/i.exec(message);
    const delayMs = hint ? Math.ceil(Number(hint[1])) * 1000 + 1000 : DEFAULT_RATE_LIMIT_DELAY_MS;
    return Math.min(delayMs, MAX_DELAY_MS);
  }
  if (/UNAVAILABLE|fetch failed|ECONNRESET/.test(message)) {
    return 2000 * attempt;
  }
  return undefined;
}
