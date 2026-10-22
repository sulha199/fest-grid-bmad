/**
 * What a finished vendor scrape amounted to (BUG-074):
 * - `ok`: it returned posts;
 * - `empty`: it returned none because the account had nothing new, which is normal;
 * - `vendor_failure`: it returned none and the vendor gave no reason an account would be empty, so
 *   the vendor (or Instagram's side of it) failed. Such a run must not be recorded as a success.
 */
export type ScrapeResultClass = 'ok' | 'empty' | 'vendor_failure';

/** The fields of Bright Data's `GET /datasets/v3/progress/{snapshot_id}` that classification reads. */
export interface BrightDataProgressSnapshot {
  status: string;
  records?: number | null;
  errors?: number | null;
  errorCodes?: Record<string, number> | null;
  errorMessage?: string | null;
}

const IN_FLIGHT_STATUSES = new Set(['scheduled', 'building', 'running']);

/**
 * Classifies a finished Bright Data snapshot from the number of records it delivered and, when it
 * delivered none, from its progress report.
 *
 * Measured signatures (BUG-074 section 4; Bright Data does not document them, so treat the rule as
 * provisional until it confirms them):
 *
 * | records | progress                                   | class            |
 * |---------|--------------------------------------------|------------------|
 * | > 0     | any                                        | `ok`             |
 * | 0       | `error_codes.dead_page` present            | `empty`          |
 * | 0       | `status: failed`, or no `dead_page` error  | `vendor_failure` |
 *
 * Two inputs are deliberately inconclusive and class as `empty`, which is how every zero-record run
 * was treated before this classifier existed: the progress lookup failed (`progress` is null), or the
 * snapshot is still in flight. Declaring a vendor failure on no evidence would mark healthy runs
 * `FAILED` and send their accounts down the fallback path.
 */
export function classifyBrightDataResult(input: {
  recordCount: number;
  progress: BrightDataProgressSnapshot | null | undefined;
}): ScrapeResultClass {
  const { recordCount, progress } = input;

  if (recordCount > 0) {
    return 'ok';
  }
  if (!progress) {
    return 'empty';
  }
  if (progress.status === 'failed') {
    return 'vendor_failure';
  }
  if (IN_FLIGHT_STATUSES.has(progress.status)) {
    return 'empty';
  }
  if ((progress.errorCodes?.dead_page ?? 0) > 0) {
    return 'empty';
  }
  return 'vendor_failure';
}
