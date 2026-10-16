import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { computeAccountActivityState, type AccountActivityState } from '@festgrid/domain/scraper';
import { loadBackendEnv } from '../../env.js';
import { postsAssociatedWithAccount } from '../posts/posts-associated-with-account.js';

export interface AccountActivity {
  state: AccountActivityState;
  lastScrapedAt: Date | null;
  /** `published_at` of the newest post the account owns or is associated with; null when none. */
  newestPostAt: Date | null;
}

/**
 * Gathers the facts behind the manual extract screen's per-account state (PRD 3.10, Story 5.4a) and
 * lets the domain function decide. The newest post is looked up over every post the account is
 * associated with, in any role, so an account whose posts are stored under another profile (a
 * co-authored post, or BUG-059) is not reported as having none.
 */
export async function loadAccountActivity(accountId: string, now: Date = new Date()): Promise<AccountActivity> {
  const [profile] = await db
    .select({
      lastScrapedAt: socialMediaAccountProfiles.lastScrapedAt,
      scrapeTriggeredAt: socialMediaAccountProfiles.scrapeTriggeredAt,
    })
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, accountId))
    .limit(1);

  const [newest] = await db
    .select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(postsAssociatedWithAccount(accountId))
    .orderBy(desc(posts.publishedAt))
    .limit(1);

  const lastScrapedAt = profile?.lastScrapedAt ?? null;
  const newestPostAt = newest?.publishedAt ?? null;
  const env = loadBackendEnv();

  const state = computeAccountActivityState(
    { lastScrapedAt, scrapeTriggeredAt: profile?.scrapeTriggeredAt ?? null, newestPostAt },
    {
      scrapeInProgressTimeoutHours: parseInt(env.scrapeInProgressTimeoutHours || '3', 10),
      scrapeStaleDays: parseInt(env.accountScrapeStaleDays || '3', 10),
      inactiveAfterDays: parseInt(env.accountInactiveAfterDays || '30', 10),
    },
    now
  );

  return { state, lastScrapedAt, newestPostAt };
}
