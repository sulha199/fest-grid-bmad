import { markPendingJobExpired } from './brightdata-pending-jobs-store.js';
import type { BrightdataPendingJob } from './brightdata-pending-jobs-store.js';
import { enqueueFallbackScrape } from './enqueue-fallback-scrape.js';
import { recordActorRunResult } from './record-actor-run.js';
import type { RecordActorRunResultInput } from './record-actor-run.js';

/**
 * A Bright Data run that did not deliver: the vendor reported it failed, or it finished with zero
 * records and no sign the account was merely empty (BUG-074 `vendor_failure`).
 *
 * - the audit row is recorded with `status` (`FAILED` for a vendor failure), never `SUCCEEDED`, so
 *   provider health sees it and nothing mistakes it for a good run;
 * - the pending job is expired, not completed, and this function does not stamp `lastScrapedAt`: a
 *   failed run is not a scrape of the account. (The SQS job below stamps it itself when it finishes,
 *   which is accurate: by then the account has been scraped, on Apify.);
 * - an Instagram profile is handed to the SQS scrape queue right away (`enqueueFallbackScrape`, which
 *   applies the AD-34 scrape gate and needs an active subscription), whose job reads from the profile's
 *   own newest stored post (IDEA-095: re-scrape the failed profile on the other provider), behind the
 *   same Apify budget guard as every other sync scrape (`assertProviderCapacityAvailable`).
 */
export async function handleBrightDataFailedRun(
  job: BrightdataPendingJob,
  result: Pick<RecordActorRunResultInput, 'status' | 'errorMessage' | 'rawOutput' | 'itemCount'>
): Promise<void> {
  await recordActorRunResult({
    vendor: 'BRIGHTDATA',
    runId: job.snapshotId,
    ...result,
  });
  await markPendingJobExpired(job.id);

  // A scrape start like any other: behind the AD-34 gate and an active subscription (AD-43 Rule 6).
  await enqueueFallbackScrape(job.profileId);
}
