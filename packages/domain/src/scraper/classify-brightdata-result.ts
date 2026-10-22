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
 * Inputs that cannot support a verdict class as `empty`, which is how every zero-record run was
 * treated before this classifier existed, instead of declaring a vendor failure on no evidence
 * (that would mark healthy runs `FAILED` and send their accounts down the fallback path):
 * - the progress lookup failed (`progress` is null);
 * - the snapshot is not in a terminal state (`ready` or `failed`): `scheduled`, `building`,
 *   `running`, or a status this code has never seen;
 * - progress reports records the delivery did not carry (a truncated or unparseable body). The vendor
 *   did deliver; the loss is ours, and it is not the vendor failing.
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
  if (progress.status !== 'ready') {
    return 'empty';
  }
  if ((progress.records ?? 0) > 0) {
    return 'empty';
  }
  if ((progress.errorCodes?.dead_page ?? 0) > 0) {
    return 'empty';
  }
  return 'vendor_failure';
}
