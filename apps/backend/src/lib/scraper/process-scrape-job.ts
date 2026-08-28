import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { getScraperAdapter, ScrapedPost } from '@festgrid/domain';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { loadBackendEnv } from '../../env.js';
import { eq, desc } from 'drizzle-orm';
import { ScrapeTarget } from './get-scrape-targets.js';
import { setApifyAuditContext, clearApifyAuditContext, apifyAuditContext } from './instagram-adapter.js';
import { backfillAccountProfileAndInferDefaultLocation } from '../accounts/backfill-account-profile-and-infer-location.js';

export let backfillAccountProfileAndInferDefaultLocationSeam = backfillAccountProfileAndInferDefaultLocation;
export function setBackfillAccountProfileAndInferDefaultLocationSeam(fn: typeof backfillAccountProfileAndInferDefaultLocation) {
  backfillAccountProfileAndInferDefaultLocationSeam = fn;
}

const NEW_SUBSCRIBE_RETRY_WINDOWS_DAYS = [3, 7, 10, 14, 17, 21, 24, 27, 30];
const MAX_TOTAL_RETURNED = 15;
const MAX_UNIQUE_NEW_POSTS = 10;

async function persistScrapedPosts(job: ScrapeTarget, scrapedPosts: ScrapedPost[], scraperActorRunId?: string): Promise<number> {
  let persisted = 0;
  for (const post of scrapedPosts) {
    await persistScrapedPost({
      accountId: job.profileId,
      platform: job.platform,
      content: post.content,
      imageUrl: post.imageUrl || null,
      videoUrl: post.videoUrl || null,
      postUrl: post.postUrl,
      originalPostUrl: post.originalPostUrl || null,
      publishedAt: post.publishedAt,
      scraperActorRunId,
      locationName: post.locationName || null,
      ownerDisplayName: post.ownerDisplayName || null,
      ownerUsername: post.ownerUsername || null,
    });
    persisted += 1;
  }
  return persisted;
}

export async function processScrapeJob(job: ScrapeTarget): Promise<void> {
  const env = loadBackendEnv();
  const allScrapedPostsThisJob: ScrapedPost[] = [];

  async function runBackfill() {
    try {
      await backfillAccountProfileAndInferDefaultLocationSeam(job.profileId, allScrapedPostsThisJob);
    } catch (backfillErr) {
      console.error(`[processScrapeJob] backfillAccountProfileAndInferDefaultLocation failed for ${job.profileId}:`, backfillErr);
    }
  }

  try {
    const [newestPost] = await db
      .select({
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.accountId, job.profileId))
      .orderBy(desc(posts.publishedAt))
      .limit(1);

    const adapter = getScraperAdapter(job.platform);

    if (job.isInitialNewSubscription) {
      if (adapter.supportsNewerThanAndLimitFiltering) {
        // Actor filters by newerThan and result count server-side, so one call with the
        // widest lookback window returns everything the retry loop would otherwise need
        // multiple actor runs to accumulate.
        const widestWindowDays = Math.max(...NEW_SUBSCRIBE_RETRY_WINDOWS_DAYS);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - widestWindowDays);
        const newerThan = cutoffDate.toISOString();

        setApifyAuditContext(job.profileId, 'SYNC');
        try {
          const scrapedPosts = await adapter.getNewestPosts(
            { accountId: job.accountId, username: job.username },
            { newerThan }
          );
          allScrapedPostsThisJob.push(...scrapedPosts);
          await persistScrapedPosts(job, scrapedPosts, apifyAuditContext?.runId);
        } finally {
          clearApifyAuditContext();
        }

        await runBackfill();
        return;
      }

      const uniquePostUrls = new Set<string>();
      let totalReturned = 0;

      for (const days of NEW_SUBSCRIBE_RETRY_WINDOWS_DAYS) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const newerThan = cutoffDate.toISOString();

        setApifyAuditContext(job.profileId, 'SYNC');
        try {
          const scrapedPosts = await adapter.getNewestPosts(
            { accountId: job.accountId, username: job.username },
            { newerThan }
          );
          allScrapedPostsThisJob.push(...scrapedPosts);

          const uniqueNewPosts = scrapedPosts.filter((post) => {
            if (uniquePostUrls.has(post.postUrl)) return false;
            uniquePostUrls.add(post.postUrl);
            return true;
          });

          const persisted = await persistScrapedPosts(job, uniqueNewPosts, apifyAuditContext?.runId);
          totalReturned += scrapedPosts.length;

          if (persisted === 0 && scrapedPosts.length === 0) continue;
          if (totalReturned >= MAX_TOTAL_RETURNED || uniquePostUrls.size >= MAX_UNIQUE_NEW_POSTS) {
            break;
          }
        } finally {
          clearApifyAuditContext();
        }
      }

      await runBackfill();
      return;
    }

    let newerThan: string;
    if (newestPost) {
      newerThan = newestPost.publishedAt.toISOString();
    } else {
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - env.scrapeInitialLookbackDays);
      newerThan = lookbackDate.toISOString();
    }

    setApifyAuditContext(job.profileId, 'SYNC');
    try {
      const scrapedPosts = await adapter.getNewestPosts(
        { accountId: job.accountId, username: job.username },
        { newerThan }
      );
      allScrapedPostsThisJob.push(...scrapedPosts);

      await persistScrapedPosts(job, scrapedPosts, apifyAuditContext?.runId);
    } finally {
      clearApifyAuditContext();
    }

    await runBackfill();
  } catch (err) {
    console.error(`Error processing scrape job for account ${job.username} (${job.profileId}):`, err);
    // AC7: catch and log, but do not rethrow to prevent failing other jobs in SQS batch
  } finally {
    try {
      await db
        .update(socialMediaAccountProfiles)
        .set({
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialMediaAccountProfiles.id, job.profileId));
    } catch (updateErr) {
      console.error(`Failed to stamp lastScrapedAt for profile ${job.profileId}:`, updateErr);
    }
  }
}
