import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq, or } from 'drizzle-orm';

interface PersistScrapedPostParams {
  accountId: string;
  content: string;
  imageUrl?: string | null;
  postUrl: string;
  originalPostUrl?: string | null;
  publishedAt: string;
}

export async function persistScrapedPost({
  accountId,
  content,
  imageUrl,
  postUrl,
  originalPostUrl,
  publishedAt,
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
  await db
    .insert(posts)
    .values({
      accountId,
      content,
      imageUrl,
      postUrl,
      originalPostUrl,
      publishedAt: new Date(publishedAt),
    })
    .onConflictDoNothing({
      target: [posts.postUrl],
    });

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
