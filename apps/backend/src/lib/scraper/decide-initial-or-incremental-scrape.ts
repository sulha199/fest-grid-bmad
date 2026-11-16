import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { HISTORY_SEED_LOOKBACK_DAYS } from '@festgrid/domain';
import { eq, desc } from 'drizzle-orm';
import { isHistorySeeded } from './history-seeded-store.js';

const SEED_WINDOW_MS = HISTORY_SEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

/**
 * Shared initial-vs-incremental scrape decision: an account whose history is not seeded yet (no scrape of its
 * own has delivered a post) gets the seeding window -- the newest posts, none older than
 * HISTORY_SEED_LOOKBACK_DAYS; a seeded account gets an incremental scrape from its newest post onward. Stored
 * posts do not make an account seeded: one known only as a co-author holds a few posts that say nothing about
 * its own timeline. Extracted from `Mutation.triggerAccountScrape` (`apps/backend/src/schema/resolvers.ts`) so
 * the moderator-resolution scrape trigger (Part 3, AD-34) shares the same decision instead of re-deriving it.
 */
export async function decideInitialOrIncrementalNewerThan(
  accountId: string
): Promise<{ isInitialScrape: boolean; newerThan: string }> {
  if (!(await isHistorySeeded(accountId))) {
    return { isInitialScrape: true, newerThan: new Date(Date.now() - SEED_WINDOW_MS).toISOString() };
  }

  const mostRecentRows = await db.select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(eq(posts.accountId, accountId))
    .orderBy(desc(posts.publishedAt))
    .limit(1);

  if (mostRecentRows.length > 0) {
    return { isInitialScrape: false, newerThan: mostRecentRows[0].publishedAt.toISOString() };
  }

  // A seeded account that holds no post of its own (its delivered posts were all stored under another owner):
  // the seeding window is the best-effort newerThan, and the scrape is still incremental.
  return { isInitialScrape: false, newerThan: new Date(Date.now() - SEED_WINDOW_MS).toISOString() };
}
