import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { and, eq, isNull } from 'drizzle-orm';

/** True once a scrape of the profile's own timeline has delivered a post (see `history_seeded_at`). */
export async function isHistorySeeded(profileId: string): Promise<boolean> {
  const [row] = await db
    .select({ historySeededAt: socialMediaAccountProfiles.historySeededAt })
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, profileId))
    .limit(1);
  return Boolean(row?.historySeededAt);
}

/**
 * Marks the profile's history as seeded: a scrape of its own timeline delivered at least one post. Only
 * the first call writes (a later one finds the column set), so a profile keeps the time it was seeded.
 * Best effort: a failure here only means the next run seeds again, which the persist step de-duplicates,
 * so it must never fail the scrape that just stored the posts.
 */
export async function markHistorySeeded(profileId: string): Promise<void> {
  try {
    await db
      .update(socialMediaAccountProfiles)
      .set({ historySeededAt: new Date() })
      .where(and(eq(socialMediaAccountProfiles.id, profileId), isNull(socialMediaAccountProfiles.historySeededAt)));
  } catch (error) {
    console.error(`Failed to mark the history of profile ${profileId} as seeded:`, error);
  }
}
