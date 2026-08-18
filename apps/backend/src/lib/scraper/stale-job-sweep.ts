import { findExpiredPendingJobs, markPendingJobExpired } from './brightdata-pending-jobs-store.js';
import { getBrightDataProgress, getBrightDataSnapshot } from './brightdata-client.js';
import { processBrightDataResult } from './process-brightdata-result.js';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { getScraperAdapter } from './register-adapters.js';
import { persistScrapedPost } from './persist-scraped-post.js';

export async function runStaleJobSweep(): Promise<void> {
  const expiredJobs = await findExpiredPendingJobs();
  
  const results = await Promise.allSettled(
    expiredJobs.map((job) => processSingleExpiredJob(job))
  );

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to process expired job ${index}:`, result.reason);
    }
  });
}

async function processSingleExpiredJob(job: any): Promise<void> {
  try {
    const progress = await getBrightDataProgress(job.snapshotId);

    if (progress.status === 'ready') {
      // Job is ready, fetch and process results
      const snapshot = await getBrightDataSnapshot(job.snapshotId);
      await processBrightDataResult(job, snapshot);
    } else {
      // Job failed or still not ready - mark as expired and fall back to Apify
      await markPendingJobExpired(job.id);

      // Fetch profile info for fallback scrape
      const [profile] = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, job.profileId));

      if (profile && profile.platform === 'instagram') {
        try {
          const adapter = getScraperAdapter('instagram');
          const posts = await adapter.getNewestPosts(profile.username);

          for (const post of posts) {
            await persistScrapedPost({
              accountId: profile.id,
              postUrl: post.postUrl,
              imageUrl: post.imageUrl,
              content: post.content,
              publishedAt: post.publishedAt,
            });
          }

          // Stamp lastScrapedAt
          await db
            .update(socialMediaAccountProfiles)
            .set({ lastScrapedAt: new Date() })
            .where(eq(socialMediaAccountProfiles.id, profile.id));
        } catch (error) {
          console.error(`Fallback Apify scrape failed for ${profile.username}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing expired Bright Data job ${job.id}:`, error);
    throw error;
  }
}
