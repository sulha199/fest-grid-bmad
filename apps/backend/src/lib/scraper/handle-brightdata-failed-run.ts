import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { markPendingJobExpired } from './brightdata-pending-jobs-store.js';
import type { BrightdataPendingJob } from './brightdata-pending-jobs-store.js';
import { enqueueScrapeJob } from './enqueue-scrape-job.js';
import { recordActorRunResult } from './record-actor-run.js';
import type { RecordActorRunResultInput } from './record-actor-run.js';

/**
 * A Bright Data run that did not deliver: the vendor reported it failed, or it finished with zero
 * records and no sign the account was merely empty (BUG-074 `vendor_failure`).
 *
 * - the audit row is recorded with `status` (`FAILED` for a vendor failure), never `SUCCEEDED`, so
 *   provider health sees it and nothing mistakes it for a good run;
 * - the pending job is expired, not completed, and `lastScrapedAt` is deliberately NOT stamped, so
 *   the account is picked up again by the next batch instead of being skipped as freshly scraped;
 * - an Instagram profile is handed to the SQS scrape queue right away, whose job reads from the
 *   profile's own newest stored post (IDEA-095: re-scrape the failed profile on the other provider).
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

  const [profile] = await db
    .select()
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, job.profileId));

  if (profile && profile.platform === 'instagram') {
    try {
      await enqueueScrapeJob({
        profileId: profile.id,
        accountId: profile.accountId,
        username: profile.username,
        platform: profile.platform,
      });
    } catch (error) {
      console.error(`Fallback SQS enqueue failed for ${profile.username}:`, error);
    }
  }
}
