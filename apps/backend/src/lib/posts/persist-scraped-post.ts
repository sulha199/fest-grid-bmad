import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq, or } from 'drizzle-orm';
import { parseImageUrlExpiry } from '@festgrid/domain/scraper';

interface PersistScrapedPostParams {
  accountId: string;
  platform: string;
  content: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  postUrl: string;
  originalPostUrl?: string | null;
  publishedAt: string;
  scraperActorRunId?: string;
  locationName?: string | null;
  ownerDisplayName?: string | null;
  ownerUsername?: string | null;
}

export async function persistScrapedPost({
  accountId,
  platform,
  content,
  imageUrl,
  videoUrl,
  postUrl,
  originalPostUrl,
  publishedAt,
  scraperActorRunId,
  locationName,
  ownerDisplayName,
  ownerUsername,
}: PersistScrapedPostParams) {
  // 1. Try to find the existing post using the dual-lookup logic
  const conditions = originalPostUrl
    ? or(eq(posts.postUrl, postUrl), eq(posts.originalPostUrl, originalPostUrl))
    : eq(posts.postUrl, postUrl);

  let post = await db
    .select()
    .from(posts)
    .where(conditions)
    .limit(1)
    .then((rows) => rows[0]);

  if (post) {
    return {
      post,
      alreadyExisted: true,
    };
  }

  // 2. If absent, insert a new row with onConflictDoNothing
  const imageUrlExpiresAt = parseImageUrlExpiry(imageUrl);

  const insertValues = {
    accountId,
    platform,
    content,
    imageUrl,
    videoUrl,
    postUrl,
    originalPostUrl,
    publishedAt: new Date(publishedAt),
    scraperActorRunId,
    locationName,
    ownerDisplayName,
    ownerUsername,
    imageUrlExpiresAt,
  };

  try {
    await db
      .insert(posts)
      .values(insertValues)
      .onConflictDoNothing({
        target: [posts.postUrl],
      });
  } catch (err) {
    // Graceful FK error handling (AC7 per Story 3-4j): catch FK violations and log without rethrowing
    const dbErr = err as any;
    if (dbErr?.code === '23503') {
      console.warn(
        `FK constraint violation inserting post ${postUrl} with runId ${scraperActorRunId}; retrying without run link`,
        err
      );
      try {
        await db
          .insert(posts)
          .values({
            ...insertValues,
            scraperActorRunId: null,
          })
          .onConflictDoNothing({
            target: [posts.postUrl],
          });
      } catch (retryErr) {
        console.error(`Failed to persist post ${postUrl} on fallback without run link`, retryErr);
        throw retryErr;
      }
    } else {
      throw err;
    }
  }

  // Re-select to get the inserted row (race-safe)
  post = await db
    .select()
    .from(posts)
    .where(eq(posts.postUrl, postUrl))
    .limit(1)
    .then((rows) => rows[0]);

  return {
    post,
    alreadyExisted: false,
  };
}
