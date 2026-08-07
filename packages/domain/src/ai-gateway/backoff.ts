export function computeBackoffDelayMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds !== null) {
    return retryAfterSeconds * 1000;
  }
  // Exponential backoff starting at 1000ms, doubling per attempt, with ±20% jitter, capped at 30000ms.
  // attempt 1 => 1000ms
  // attempt 2 => 2000ms
  // attempt 3 => 4000ms
  const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  const jitterPercent = (Math.random() * 0.4) - 0.2; // ±20% jitter
  const delay = baseDelay * (1 + jitterPercent);
  return Math.round(delay);
}
