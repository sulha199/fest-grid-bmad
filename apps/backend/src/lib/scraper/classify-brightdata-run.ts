import { classifyBrightDataResult, type ScrapeResultClass } from '@festgrid/domain';
import { getBrightDataProgress, type BrightDataProgressResponse } from './brightdata-client.js';

export interface BrightDataRunClassification {
  resultClass: ScrapeResultClass;
  /** The progress report the class was read from; null when it was not needed or could not be fetched. */
  progress: BrightDataProgressResponse | null;
}

/**
 * Decides what a finished Bright Data snapshot amounted to (BUG-074). A snapshot that delivered
 * records is `ok` and costs no extra call; one that delivered none is looked up on Bright Data's
 * free `progress` endpoint, whose `error_codes` tell an empty account (`dead_page`) from a vendor
 * failure. A failed lookup is inconclusive and classes as `empty` -- how every zero-record run was
 * treated before this existed -- rather than declaring an outage on no evidence.
 */
export async function classifyBrightDataRun(
  snapshotId: string,
  recordCount: number
): Promise<BrightDataRunClassification> {
  if (recordCount > 0) {
    return { resultClass: 'ok', progress: null };
  }

  let progress: BrightDataProgressResponse | null = null;
  try {
    progress = await getBrightDataProgress(snapshotId);
  } catch (error) {
    console.error(`Could not read Bright Data progress for snapshot ${snapshotId}; treating the empty result as inconclusive:`, error);
  }

  return { resultClass: classifyBrightDataResult({ recordCount, progress }), progress };
}

/** A one-line, log- and audit-friendly reason for a `vendor_failure`. */
export function describeBrightDataVendorFailure(progress: BrightDataProgressResponse | null): string {
  const details = [
    progress?.errorCodes ? `error_codes=${JSON.stringify(progress.errorCodes)}` : '',
    progress?.errorMessage ? `"${progress.errorMessage}"` : '',
  ].filter(Boolean);
  const head = `Bright Data returned 0 records with no dead_page error (status ${progress?.status ?? 'unknown'})`;
  return details.length > 0 ? `${head}: ${details.join(' ')}` : head;
}
