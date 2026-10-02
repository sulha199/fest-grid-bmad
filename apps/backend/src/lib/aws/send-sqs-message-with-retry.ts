import { sendSqsMessage } from './send-sqs-message.js';

export interface SendSqsMessageWithRetryOptions {
  maxAttempts?: number; // total attempts including the first; default 3 (1 initial + 2 retries)
  backoffMs?: number; // base backoff between attempts, multiplied by the attempt number; default 250
  onAttemptFailed?: (attempt: number, maxAttempts: number, err: unknown) => void;
}

/**
 * Story 3.6t (AC7) — a generic send-with-retry wrapper used by `processAiJob`'s best-effort
 * per-event enqueue loop: a transient SQS error on one event's send should not cost a second
 * Gemini call, so each failed send gets up to `maxAttempts - 1` retries with a short backoff
 * before the caller gives up on it.
 *
 * Calls the mutable, seam-overridable `sendSqsMessage` export from `send-sqs-message.ts` (an
 * ESM live binding) -- `setSendSqsMessage(fn)`, already in use by `process-ai-job.test.ts`,
 * continues to control every call made through this wrapper with no new seam needed.
 */
export async function sendSqsMessageWithRetry(
  queueUrl: string,
  body: string,
  options: SendSqsMessageWithRetryOptions = {}
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffMs = options.backoffMs ?? 250;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendSqsMessage(queueUrl, body);
      return;
    } catch (err) {
      lastError = err;
      options.onAttemptFailed?.(attempt, maxAttempts, err);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
      }
    }
  }
  throw lastError;
}
