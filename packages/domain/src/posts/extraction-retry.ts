import { decideRetry, type RetryHint, type RetrySituation } from "../retry/decide-retry.js";

/**
 * AD-52 Rule 4: the durable, post-level side of the retry policy. `decideRetry` says what to do about one
 * failure; this turns it into the ledger values a failed extraction job writes on the post. Pure: the clock
 * and the stored counters come in, the values to store come out.
 */

/** Starting values (AD-52 Rule 4), code constants rather than environment values. */
export const EXTRACTION_MAX_ATTEMPTS = 5;
export const EXTRACTION_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** The wait before retry n+1, in minutes, indexed by the failed attempt n (the AI Lambda ticks every 5 minutes). */
export const EXTRACTION_RETRY_BACKOFF_MINUTES = [5, 15, 60, 240] as const;

export interface ExtractionFailureInput {
  situation: RetrySituation;
  hint?: RetryHint;
  /** `posts.extraction_attempts` before this failure. */
  attemptsBefore: number;
  /** `posts.extraction_first_failure_at`, null when this is the first failure. */
  firstFailureAt: Date | null;
  now: Date;
}

export interface ExtractionFailurePlan {
  /** The new `extraction_attempts`. */
  attempts: number;
  /** The new `extraction_failure_reason`: the situation. */
  failureReason: RetrySituation;
  /** The new `extraction_first_failure_at`. */
  firstFailureAt: Date;
  /** The new `extraction_next_attempt_at`; null means given up. */
  nextAttemptAt: Date | null;
  /** Why the plan ended the retries, when it did (logging). */
  givenUpBecause: string | null;
}

function durableBackoffMs(failedAttempt: number): number {
  const index = Math.min(Math.max(failedAttempt, 1), EXTRACTION_RETRY_BACKOFF_MINUTES.length) - 1;
  return EXTRACTION_RETRY_BACKOFF_MINUTES[index] * 60 * 1000;
}

export function planExtractionFailure(input: ExtractionFailureInput): ExtractionFailurePlan {
  const attempts = Math.max(0, input.attemptsBefore) + 1;
  const firstFailureAt = input.firstFailureAt ?? input.now;
  const base = { attempts, failureReason: input.situation, firstFailureAt };

  const decision = decideRetry(input.situation, attempts, input.hint);
  // Only a later attempt of the same kind can recover a post here. Splitting a window, switching a key and
  // re-scraping belong to the stepped path and the key loop (AD-46, AD-51), which are not part of a job retry.
  if (decision.action !== "retry_now" && decision.action !== "retry_later") {
    return { ...base, nextAttemptAt: null, givenUpBecause: decision.reason };
  }
  if (attempts >= EXTRACTION_MAX_ATTEMPTS) {
    return { ...base, nextAttemptAt: null, givenUpBecause: `attempts spent (${EXTRACTION_MAX_ATTEMPTS})` };
  }

  // A per-day quota is waited out for as long as the policy says; everything else grows with the attempt, and
  // never waits less than the policy's own delay. (Every retry decision carries a delay; non-finite values are
  // filtered rather than defaulted.)
  const isQuota = input.situation === "quota_exhausted_daily";
  // The leading 0 keeps the list non-empty, so a missing delay can never produce an invalid date.
  const delayMs = Math.max(
    ...([0, decision.delayMs, isQuota ? undefined : durableBackoffMs(attempts)].filter(Number.isFinite) as number[])
  );
  const nextAttemptAt = new Date(input.now.getTime() + delayMs);

  // The 24 hour window holds from the first failure on (a huge server hint cannot push the first retry past it);
  // a per-day quota is the exception, since waiting out its reset is the whole point.
  if (!isQuota && nextAttemptAt.getTime() > firstFailureAt.getTime() + EXTRACTION_RETRY_WINDOW_MS) {
    return { ...base, nextAttemptAt: null, givenUpBecause: "retry window spent" };
  }
  return { ...base, nextAttemptAt, givenUpBecause: null };
}
