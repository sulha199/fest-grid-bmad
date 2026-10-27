/**
 * How long a synchronous Apify call waits for account memory to free up before giving up (BUG-083).
 *
 * Apify refuses to start a run with 402 `actor-memory-limit-exceeded` when the account's concurrent-memory
 * cap is in use (prod 2026-10-25 03:13 UTC: 31 queue runs, while the async actors and other workers held
 * the memory). Nothing was started and a later attempt succeeds, so the worker waits and retries inside the
 * call's own time budget instead of failing the message and spending one of the queue's receives.
 */

/** The longest the worker waits for memory before it fails the call (and SQS redelivers the message). */
export const APIFY_MEMORY_LIMIT_MAX_WAIT_MS = 60_000;

const FIRST_WAIT_MS = 5_000;
const LONGEST_SINGLE_WAIT_MS = 20_000;

/**
 * The wait budget of one call: `APIFY_MEMORY_LIMIT_MAX_WAIT_MS`, but never more than half of the call's
 * own time budget. The wait is carved out of that budget, not added to it, so the call as a whole (waits
 * plus the run) stays inside the bound the queue worker, the poll-and-drain loop and the queue's
 * visibility timeout are already sized for; the half left over is what a run that does start gets.
 */
export function resolveApifyMemoryLimitMaxWaitMs(callTimeoutMs: number): number {
  if (!(callTimeoutMs > 0)) {
    return 0;
  }
  return Math.min(APIFY_MEMORY_LIMIT_MAX_WAIT_MS, Math.floor(callTimeoutMs / 2));
}

/**
 * How long to sleep before the next attempt after the memory limit refused the one numbered `attempt`
 * (0 for the first): 5s, 10s, then 20s at most, trimmed so that `elapsedMs` (all the time spent since the
 * call began, waits and refused attempts alike) plus the sleep stays within `maxWaitMs`. `null` once the
 * budget is spent: the caller gives up.
 */
export function nextApifyMemoryLimitWaitMs(input: { attempt: number; elapsedMs: number; maxWaitMs: number }): number | null {
  const remainingMs = input.maxWaitMs - input.elapsedMs;
  if (remainingMs <= 0) {
    return null;
  }
  const backoffMs = Math.min(FIRST_WAIT_MS * 2 ** input.attempt, LONGEST_SINGLE_WAIT_MS);
  return Math.min(backoffMs, remainingMs);
}
