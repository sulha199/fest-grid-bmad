import { db } from '../../db/client.js';
import { postAccountAssociations, posts, scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import {
  isScrapeDeferredByBackoff,
  resolveScrapeBackoffDays,
  summarizePostingCadence,
} from '@festgrid/domain';
import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { loadBackendEnv } from '../../env.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back posts are read to find a profile's last active month (it can have been quiet for weeks). */
const CADENCE_POST_LOOKBACK_DAYS = 120;

/** A run older than this says nothing about whether the profile is posting now. */
const LAST_RUN_LOOKBACK_DAYS = 14;

export interface BackoffCandidate {
  profileId: string;
  lastScrapedAt: Date | null;
}

/**
 * Which of the profiles the daily cutoff calls due should wait another day or more (IDEA-105), and for how many
 * days. A profile waits only when its last finished run found no new post and its posting rhythm is known
 * (`summarizePostingCadence`): the wait is its typical gap between posting days, capped by
 * SCRAPE_BACKOFF_MAX_DAYS (1 turns this off). Any run that finds a new post puts the profile back to daily, and
 * a profile is never switched off. The decision reads only rows we already hold, never the vendor.
 *
 * Never throws: on any failure nothing is deferred, so a broken backoff costs a scrape, not a missed one.
 */
export async function findProfilesDeferredByBackoff(
  candidates: BackoffCandidate[],
  { cutoff, now }: { cutoff: Date; now: Date }
): Promise<Map<string, number>> {
  const deferred = new Map<string, number>();
  const env = loadBackendEnv();
  if (env.scrapeBackoffMaxDays <= 1) return deferred;

  const scraped = candidates.filter((candidate) => candidate.lastScrapedAt !== null);
  if (scraped.length === 0) return deferred;

  try {
    const lastScrapedAt = new Map(scraped.map((candidate) => [candidate.profileId, candidate.lastScrapedAt as Date]));

    // The newest finished run per profile that recorded how many new posts it found.
    const runRows = await db
      .select({ profileId: scraperActorRuns.profileId, newPosts: scraperActorRuns.newPosts })
      .from(scraperActorRuns)
      .where(
        and(
          inArray(scraperActorRuns.profileId, [...lastScrapedAt.keys()]),
          eq(scraperActorRuns.status, 'SUCCEEDED'),
          isNotNull(scraperActorRuns.newPosts),
          gte(scraperActorRuns.completedAt, new Date(now.getTime() - LAST_RUN_LOOKBACK_DAYS * DAY_MS))
        )
      )
      .orderBy(desc(scraperActorRuns.completedAt));
    const lastRunWasEmpty = new Map<string, boolean>();
    for (const row of runRows) {
      if (!lastRunWasEmpty.has(row.profileId)) lastRunWasEmpty.set(row.profileId, row.newPosts === 0);
    }
    const emptyIds = [...lastRunWasEmpty].filter(([, empty]) => empty).map(([profileId]) => profileId);
    if (emptyIds.length === 0) return deferred;

    const since = new Date(now.getTime() - CADENCE_POST_LOOKBACK_DAYS * DAY_MS);
    const [seededRows, ownedRows, associatedRows] = await Promise.all([
      db
        .select({ id: socialMediaAccountProfiles.id, historySeededAt: socialMediaAccountProfiles.historySeededAt })
        .from(socialMediaAccountProfiles)
        .where(inArray(socialMediaAccountProfiles.id, emptyIds)),
      db
        .select({ profileId: posts.accountId, postId: posts.id, publishedAt: posts.publishedAt })
        .from(posts)
        .where(and(inArray(posts.accountId, emptyIds), gte(posts.publishedAt, since))),
      db
        .select({ profileId: postAccountAssociations.accountId, postId: posts.id, publishedAt: posts.publishedAt })
        .from(postAccountAssociations)
        .innerJoin(posts, eq(posts.id, postAccountAssociations.postId))
        .where(and(inArray(postAccountAssociations.accountId, emptyIds), gte(posts.publishedAt, since))),
    ]);

    const seeded = new Set(seededRows.filter((row) => row.historySeededAt !== null).map((row) => row.id));
    // A post a profile owns and is also associated with must count once.
    const postsByProfile = new Map<string, Map<string, Date>>();
    for (const row of [...ownedRows, ...associatedRows]) {
      const byPost = postsByProfile.get(row.profileId) ?? new Map<string, Date>();
      byPost.set(row.postId, row.publishedAt);
      postsByProfile.set(row.profileId, byPost);
    }

    for (const profileId of emptyIds) {
      const cadence = summarizePostingCadence({
        publishedAts: [...(postsByProfile.get(profileId)?.values() ?? [])],
        historySeeded: seeded.has(profileId),
        now,
      });
      const intervalDays = resolveScrapeBackoffDays({
        cadence,
        lastRunWasEmpty: true,
        gapMultiplier: env.scrapeBackoffGapMultiplier,
        maxDays: env.scrapeBackoffMaxDays,
      });
      if (isScrapeDeferredByBackoff({ lastScrapedAt: lastScrapedAt.get(profileId) ?? null, cutoff, intervalDays })) {
        deferred.set(profileId, intervalDays);
      }
    }
  } catch (error) {
    console.error('Could not work out which profiles the scrape backoff defers; scraping all of them:', error);
    return new Map();
  }
  return deferred;
}
