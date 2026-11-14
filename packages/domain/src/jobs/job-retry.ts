import { isTerminalJobStatus, type JobStatus } from "./job-engine.js";
import { mapJobReasonCode, type UserSafeJobReasonCode } from "./job-reasons.js";

// Story 10.4 (Part A; EXPERIENCE.md "Which reasons offer Retry"; PRD FR123) -- whether the Retry button shows, decided on the server.

/** Retrying the same input cannot help for these (for ACCOUNT_NOT_FOUND the text says to try another handle). */
const NOT_RETRYABLE: ReadonlySet<UserSafeJobReasonCode> = new Set([
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_PRIVATE",
  "ACCOUNT_TYPE_NOT_SCRAPED",
  "POST_UNAVAILABLE",
  "POST_NOT_FOUND",
]);

export interface JobRetryDecision {
  canRetry: boolean;
  /** COOLDOWN only: the earliest time a new job may start; the button reads "Retry at {time}" until then. */
  retryNotBefore: Date | null;
}

/**
 * Retry is for the owner, on an ended job that did not simply succeed, with a reason retrying can help and a registered retry starter
 * for its type (a type with none is never retryable: its start path is unknown). Every engine-internal or unknown ending counts as a
 * generic failure and is retryable. A COOLDOWN ending is retryable from `retryAfter`; a time already past is no wait.
 */
export function decideJobRetry(input: {
  isOwner: boolean;
  status: JobStatus;
  reasonCode: string | null;
  hasRetryStarter: boolean;
  /** `result_data.refresh.retryAfter`, when the job's report has one. */
  retryAfter: Date | null;
  now: Date;
}): JobRetryDecision {
  const no: JobRetryDecision = { canRetry: false, retryNotBefore: null };
  if (!input.isOwner || !input.hasRetryStarter || !isTerminalJobStatus(input.status) || input.status === "SUCCEEDED") {
    return no;
  }
  const reason = mapJobReasonCode(input.reasonCode) ?? "GENERIC";
  if (NOT_RETRYABLE.has(reason)) {
    return no;
  }
  if (reason === "COOLDOWN" && input.retryAfter !== null && input.retryAfter.getTime() > input.now.getTime()) {
    return { canRetry: true, retryNotBefore: input.retryAfter };
  }
  return { canRetry: true, retryNotBefore: null };
}
