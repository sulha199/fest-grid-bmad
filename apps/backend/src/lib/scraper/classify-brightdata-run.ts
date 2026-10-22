import { classifyBrightDataResult, type ScrapeResultClass } from '@festgrid/domain';
import { getBrightDataProgress, type BrightDataProgressResponse } from './brightdata-client.js';

export interface BrightDataRunClassification {
  resultClass: ScrapeResultClass;
  /** The progress report the class was read from; null when it was not needed or could not be fetched. */
  progress: BrightDataProgressResponse | null;
}

/**
 * The webhook answers inside API Gateway's 29 second limit and Bright Data redelivers a delivery that
 * does not get an answer, so this lookup must not eat that budget (the vendor gateway alone allows
 * 15 seconds an attempt, three attempts). Past this the lookup is treated as failed.
 */
export const PROGRESS_LOOKUP_TIMEOUT_MS = 8_000;

async function lookUpProgress(snapshotId: string, timeoutMs: number): Promise<BrightDataProgressResponse | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    // Promise.race subscribes to both promises, so a lookup that loses the race and fails later is
    // still handled.
    return await Promise.race([
      getBrightDataProgress(snapshotId),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`progress lookup timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error(`Could not read Bright Data progress for snapshot ${snapshotId}; treating the empty result as inconclusive:`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Decides what a finished Bright Data snapshot amounted to (BUG-074). A snapshot that delivered
 * records is `ok` and costs no extra call; one that delivered none is checked against Bright Data's
 * free `progress` endpoint, whose `error_codes` tell an empty account (`dead_page`) from a vendor
 * failure. A lookup that fails or times out is inconclusive and classes as `empty` -- how every
 * zero-record run was treated before this existed -- rather than declaring an outage on no evidence.
 *
 * A caller that has already read the progress report (the stale-job sweep) passes it in, so the
 * verdict is made on the same report that decided the snapshot was finished and costs no second call.
 */
export async function classifyBrightDataRun(
  snapshotId: string,
  recordCount: number,
  options: { progress?: BrightDataProgressResponse | null; lookupTimeoutMs?: number } = {}
): Promise<BrightDataRunClassification> {
  if (recordCount > 0) {
    return { resultClass: 'ok', progress: null };
  }

  const progress =
    options.progress !== undefined
      ? options.progress
      : await lookUpProgress(snapshotId, options.lookupTimeoutMs ?? PROGRESS_LOOKUP_TIMEOUT_MS);

  if ((progress?.records ?? 0) > 0) {
    console.error(
      `Bright Data reports ${progress?.records} records for snapshot ${snapshotId} but none reached us (a truncated or unreadable delivery); not treating it as a vendor failure.`
    );
  }

  return { resultClass: classifyBrightDataResult({ recordCount, progress }), progress };
}

/** A one-line, log- and audit-friendly reason for a `vendor_failure`. */
export function describeBrightDataVendorFailure(progress: BrightDataProgressResponse | null): string {
  const details = [
    progress?.errorCodes ? `error_codes=${JSON.stringify(progress.errorCodes)}` : '',
    progress?.errorMessage ? `"${progress.errorMessage}"` : '',
  ].filter(Boolean);
  const head =
    progress?.status === 'failed'
      ? 'Bright Data reported the snapshot as failed'
      : `Bright Data returned 0 records with no dead_page error (status ${progress?.status ?? 'unknown'})`;
  return details.length > 0 ? `${head}: ${details.join(' ')}` : head;
}
