import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq, desc, count } from 'drizzle-orm';

const INITIAL_SCRAPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared initial-vs-incremental scrape decision: an account with no posts yet gets the
 * subscribe-time cascade's 7-day initial window; an account with posts gets an incremental
 * scrape from its newest post onward. Extracted from `Mutation.triggerAccountScrape`
 * (`apps/backend/src/schema/resolvers.ts`) so the moderator-resolution scrape trigger (Part 3,
 * AD-34) shares the same decision instead of re-deriving it.
 */
export async function decideInitialOrIncrementalNewerThan(
  accountId: string
): Promise<{ isInitialScrape: boolean; newerThan: string }> {
  const postCountRows = await db.select({ count: count() })
    .from(posts)
    .where(eq(posts.accountId, accountId));

  const postCount = postCountRows[0]?.count ?? 0;

  if (postCount === 0) {
    return { isInitialScrape: true, newerThan: new Date(Date.now() - INITIAL_SCRAPE_WINDOW_MS).toISOString() };
  }

  const mostRecentRows = await db.select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(eq(posts.accountId, accountId))
    .orderBy(desc(posts.publishedAt))
    .limit(1);

  if (mostRecentRows.length > 0) {
    return { isInitialScrape: false, newerThan: mostRecentRows[0].publishedAt.toISOString() };
  }

  // Fallback (shouldn't happen -- count said >0 but the row vanished between queries). Matches
  // the pre-extraction behavior in triggerAccountScrape exactly: the 7-day window is reused as a
  // best-effort newerThan, but isInitialScrape stays false since this branch only runs when the
  // account is known to have (or very recently had) posts.
  return { isInitialScrape: false, newerThan: new Date(Date.now() - INITIAL_SCRAPE_WINDOW_MS).toISOString() };
}
