import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { getScraperAdapter } from '@festgrid/domain';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { loadBackendEnv } from '../../env.js';
import { eq, desc } from 'drizzle-orm';
import { ScrapeTarget } from './get-scrape-targets.js';

export async function processScrapeJob(job: ScrapeTarget): Promise<void> {
  const env = loadBackendEnv();

  try {
    const [newestPost] = await db
      .select({
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.accountId, job.profileId))
      .orderBy(desc(posts.publishedAt))
      .limit(1);

    let newerThan: string;
    if (newestPost) {
      newerThan = newestPost.publishedAt.toISOString();
    } else {
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - env.scrapeInitialLookbackDays);
      newerThan = lookbackDate.toISOString();
    }

    const adapter = getScraperAdapter(job.platform);
    const scrapedPosts = await adapter.getNewestPosts(
      { accountId: job.accountId, username: job.username },
      { newerThan }
    );

    for (const post of scrapedPosts) {
      await persistScrapedPost({
        accountId: job.profileId,
        content: post.content,
        imageUrl: post.imageUrl || null,
        postUrl: post.postUrl,
        originalPostUrl: post.originalPostUrl || null,
        publishedAt: post.publishedAt,
      });
    }
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
