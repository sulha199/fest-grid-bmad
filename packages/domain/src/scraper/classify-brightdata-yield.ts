/**
 * How much of what a Bright Data snapshot was asked for it delivered, read from its free progress report
 * (`records`, `errors`, `error_codes`). A separate question from `classifyBrightDataResult`, which asks
 * whether the vendor is up from a snapshot that delivered nothing and decides provider health: a snapshot
 * that delivered posts and also reported errors must never demote a healthy provider.
 *
 * - `complete`: posts delivered, no error;
 * - `partial-expected`: posts delivered, and every error code is one we know and do not retry;
 * - `partial-retryable`: posts delivered, and at least one error code is one a retry can fix;
 * - `partial-unknown`: posts delivered, and an error code (or an error without a code) we have not seen;
 * - `no-records`: nothing delivered; the zero-record classifier owns that case.
 */
export type BrightDataYieldLevel =
  | 'complete'
  | 'partial-expected'
  | 'partial-retryable'
  | 'partial-unknown'
  | 'no-records';

export interface BrightDataYieldInput {
  records?: number | null;
  errors?: number | null;
  errorCodes?: Record<string, number> | null;
}

export interface BrightDataYield {
  level: BrightDataYieldLevel;
  /** records / (records + errors); null when the snapshot reported neither. */
  rate: number | null;
  /** Error codes that are neither expected nor retryable, to log and count. */
  unknownCodes: string[];
}

/**
 * Error codes a Bright Data snapshot reports for an input that is not worth retrying. `dead_page` is the only
 * code seen in 371 prod snapshots (2026-10-15..31, 44 of 44): it means nothing was collected for the input,
 * most often because the date window held no post, and it appeared on public profiles with thousands of posts.
 */
export const BRIGHT_DATA_EXPECTED_ERROR_CODES: readonly string[] = ['dead_page'];

/**
 * Error codes a retry can fix. Empty on purpose: no transient code has ever been observed, and listing codes
 * we have not seen would be guessing. Add one here when a snapshot first reports it.
 */
export const BRIGHT_DATA_RETRYABLE_ERROR_CODES: readonly string[] = [];

export function classifyBrightDataYield(
  input: BrightDataYieldInput,
  options: { expectedCodes?: readonly string[]; retryableCodes?: readonly string[] } = {}
): BrightDataYield {
  const expected = options.expectedCodes ?? BRIGHT_DATA_EXPECTED_ERROR_CODES;
  const retryable = options.retryableCodes ?? BRIGHT_DATA_RETRYABLE_ERROR_CODES;
  const records = input.records ?? 0;
  const errors = input.errors ?? 0;
  const total = records + errors;
  const rate = total > 0 ? records / total : null;

  if (records === 0) {
    return { level: 'no-records', rate, unknownCodes: [] };
  }
  if (errors === 0) {
    return { level: 'complete', rate, unknownCodes: [] };
  }

  const codes = Object.keys(input.errorCodes ?? {});
  if (codes.some((code) => retryable.includes(code))) {
    return { level: 'partial-retryable', rate, unknownCodes: [] };
  }
  const unknownCodes = codes.filter((code) => !expected.includes(code));
  // Errors reported with no code at all are as unknown as an unseen code.
  if (codes.length === 0 || unknownCodes.length > 0) {
    return { level: 'partial-unknown', rate, unknownCodes };
  }
  return { level: 'partial-expected', rate, unknownCodes: [] };
}
