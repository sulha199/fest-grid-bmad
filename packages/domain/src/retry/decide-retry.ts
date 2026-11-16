import { computeBackoffDelayMs } from "../ai-gateway/backoff.js";

/**
 * AD-52 Rules 1-2: one retry policy. A client adapter classifies its raw error or response into one
 * `RetrySituation`; `decideRetry` is the only place that says what to do about it. Pure: no clock,
 * no I/O, randomness injectable for tests.
 */
export const RETRY_SITUATIONS = [
  "rate_limited",
  "quota_exhausted_daily",
  "unavailable",
  "timeout",
  "truncated",
  "unparseable",
  "blocked",
  "invalid_credential",
  "bad_request",
  "image_expired",
  "unknown",
] as const;
export type RetrySituation = (typeof RETRY_SITUATIONS)[number];

export const RETRY_ACTIONS = [
  "retry_now",
  "retry_later",
  "switch_credential",
  "split_window",
  "rescrape",
  "give_up",
] as const;
export type RetryAction = (typeof RETRY_ACTIONS)[number];

/** What a client adapter's classifier returns: the situation plus any server-provided hint. */
export interface ClassifiedFailure {
  situation: RetrySituation;
  retryAfterSeconds?: number;
}

export interface RetryHint {
  /** The server's own "retry after" (a 429's header or its "retry in 42s" text), in seconds. */
  retryAfterSeconds?: number;
  /** Time left for an in-call retry, in ms; omit when the caller has no deadline. */
  budgetMs?: number;
  /** The least time a retried attempt needs to be worth starting, in ms (default `MIN_RETRY_ATTEMPT_MS`). */
  minAttemptMs?: number;
  /** Another credential can serve the call (the key loop owns the switch). */
  hasAlternateCredential?: boolean;
  /** Time until a per-day quota resets, in ms, when known. */
  msUntilQuotaReset?: number;
  /** For `truncated`: the window is already the smallest unit and cannot be split further. */
  windowIsSmallestUnit?: boolean;
  /** In-call attempts allowed, including the first (default 3). */
  maxInCallAttempts?: number;
  /** Jitter source, `Math.random` by default. */
  random?: () => number;
}

export interface RetryDecision {
  action: RetryAction;
  /** Wait before the next attempt: sleep for `retry_now`, schedule for `retry_later`. */
  delayMs?: number;
  reason: string;
}

/** A hint is honored with this margin on top (AD-52 Rule 2). */
export const RETRY_HINT_MARGIN_MS = 1_000;
/** A retry is only worth starting when at least this much budget is left after the wait. */
export const MIN_RETRY_ATTEMPT_MS = 1_000;
/** The longest a per-day quota is waited out (AD-52 Rule 2). */
export const MAX_QUOTA_DEFERRAL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_IN_CALL_ATTEMPTS = 3;

function backoffMs(attempt: number, random: () => number): number {
  // The shape of computeBackoffDelayMs (exponential, jitter, cap); a deterministic random keeps tests exact.
  return computeBackoffDelayMs(attempt, undefined, random);
}

function fitsBudget(delayMs: number, hint: RetryHint): boolean {
  return hint.budgetMs === undefined || delayMs + (hint.minAttemptMs ?? MIN_RETRY_ATTEMPT_MS) <= hint.budgetMs;
}

/** In-call retry when attempts and budget allow, else hand the retry to the durable layer. */
function retryNowOrLater(delayMs: number, attempt: number, hint: RetryHint, reason: string): RetryDecision {
  const maxAttempts = hint.maxInCallAttempts ?? DEFAULT_MAX_IN_CALL_ATTEMPTS;
  if (attempt < maxAttempts && fitsBudget(delayMs, hint)) {
    return { action: "retry_now", delayMs, reason };
  }
  return { action: "retry_later", delayMs, reason: `${reason}; no in-call attempt or budget left` };
}

/**
 * @param situation what went wrong
 * @param attempt the 1-based number of the attempt that just failed
 */
export function decideRetry(situation: RetrySituation, attemptNumber: number, rawHint: RetryHint = {}): RetryDecision {
  const random = rawHint.random ?? Math.random;
  // A non-numeric or negative hint is no hint; an attempt number below 1 counts as the first.
  const attempt = Number.isFinite(attemptNumber) && attemptNumber >= 1 ? Math.floor(attemptNumber) : 1;
  const hint: RetryHint = { ...rawHint };
  if (hint.retryAfterSeconds !== undefined && !(Number.isFinite(hint.retryAfterSeconds) && hint.retryAfterSeconds >= 0)) {
    delete hint.retryAfterSeconds;
  }

  switch (situation) {
    case "rate_limited": {
      if (hint.hasAlternateCredential) {
        return { action: "switch_credential", delayMs: 0, reason: "rate limited; another credential is available" };
      }
      const delayMs =
        hint.retryAfterSeconds !== undefined
          ? Math.ceil(hint.retryAfterSeconds) * 1000 + RETRY_HINT_MARGIN_MS
          : backoffMs(attempt, random);
      return retryNowOrLater(delayMs, attempt, hint, "rate limited");
    }
    case "quota_exhausted_daily": {
      const delayMs = hint.msUntilQuotaReset ?? MAX_QUOTA_DEFERRAL_MS;
      if (delayMs > MAX_QUOTA_DEFERRAL_MS) {
        return { action: "give_up", reason: "per-day quota resets more than a day from now" };
      }
      return { action: "retry_later", delayMs, reason: "per-day quota spent; wait for the reset" };
    }
    case "unavailable":
    case "timeout":
      return retryNowOrLater(backoffMs(attempt, random), attempt, hint, situation);
    case "truncated":
      return hint.windowIsSmallestUnit
        ? { action: "give_up", reason: "truncated at the smallest window; keep the result" }
        : { action: "split_window", reason: "cut off at the token limit; never repeat the same request" };
    case "unparseable":
      return attempt <= 1
        ? { action: "retry_now", delayMs: 0, reason: "unparseable once; the model may answer differently" }
        : { action: "retry_later", delayMs: backoffMs(attempt, random), reason: "unparseable again" };
    case "blocked":
      return { action: "give_up", reason: "blocked by the provider; a retry cannot succeed" };
    case "bad_request":
      return { action: "give_up", reason: "the request is invalid; a retry cannot succeed" };
    case "invalid_credential":
      return hint.hasAlternateCredential
        ? { action: "switch_credential", delayMs: 0, reason: "credential rejected; another is available" }
        : { action: "give_up", reason: "credential rejected and none is left" };
    case "image_expired":
      return { action: "rescrape", reason: "image links expired; re-scrape for fresh ones" };
    case "unknown":
      return attempt <= 1
        ? { action: "retry_later", delayMs: backoffMs(attempt, random), reason: "unclassified failure; one retry later" }
        : { action: "give_up", reason: "unclassified failure repeated" };
  }
}

/** The one greppable line per decision (AD-52 Rule 8). */
export function formatRetryDecisionLog(subject: string, situation: RetrySituation, attempt: number, decision: RetryDecision): string {
  return (
    `[retry-decision] subject=${subject} situation=${situation} action=${decision.action} ` +
    `attempt=${attempt} delayMs=${decision.delayMs ?? 0}`
  );
}
