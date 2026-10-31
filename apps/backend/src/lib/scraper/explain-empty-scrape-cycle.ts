import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, brightdataPendingJobs } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { and, eq, inArray } from 'drizzle-orm';
import { getScrapeDueCutoff, scrapableAccountTypeCondition, type BatchScrapeTargetOptions } from './get-scrape-targets.js';
import { findProfilesDeferredByBackoff } from './scrape-backoff.js';

export interface EmptyScrapeCycleExplanation {
  /** Subscribed profiles the account-type gate lets through, before any recency check. */
  subscribedScrapable: number;
  /** Of those, scraped on or after the cutoff and therefore not due. */
  skippedRecentlyScraped: number;
  newestLastScrapedAt: Date | null;
  /** Of the rest, held back by a Bright Data job still in flight. */
  skippedPendingBrightData: number;
  /** Of the rest, deferred by the cadence backoff (a scheduled cycle only): its last run found no new post. */
  skippedByBackoff: number;
  /** Whatever is left: due, not pending, not deferred, but dropped for a platform with no registered adapter. */
  skippedOther: number;
  cutoff: Date;
  mode: 'scheduled' | 'recent-window';
  /** One line for the log and for scraper_batch_runs.no_targets_reason. */
  reason: string;
}

export type EmptyScrapeCycleCounts = Omit<EmptyScrapeCycleExplanation, 'reason'>;

export function formatEmptyScrapeCycleReason(c: EmptyScrapeCycleCounts): string {
  if (c.subscribedScrapable === 0) {
    return 'No subscribed profile is eligible for scraping (no active subscriptions, or none pass the account-type gate).';
  }
  const newest = c.newestLastScrapedAt ? ` (newest lastScrapedAt ${c.newestLastScrapedAt.toISOString()})` : '';
  return `${c.subscribedScrapable} subscribed profile(s) eligible: ${c.skippedRecentlyScraped} skipped as scraped since ${c.cutoff.toISOString()}${newest}, `
    + `${c.skippedPendingBrightData} with a Bright Data job in flight, ${c.skippedByBackoff} deferred by the cadence backoff, `
    + `${c.skippedOther} dropped for another reason (platform with no registered adapter). Cutoff mode: ${c.mode}.`;
}

/**
 * Says why getBatchScrapeTargets returned nothing (2026-10-24: a recovery rerun the previous afternoon
 * had stamped every profile inside the 12h window and the cron logged only "Found 0 distinct targets").
 * Called only when a batch found 0 targets, so the extra query costs nothing on a normal day. It re-reads
 * the same inputs as the batch (same cutoff rule, same account-type gate), so it explains that decision
 * rather than re-deciding it.
 */
export async function explainEmptyScrapeCycle(options: BatchScrapeTargetOptions = {}): Promise<EmptyScrapeCycleExplanation> {
  const { cutoff, mode } = getScrapeDueCutoff(options);

  const rows = await db.selectDistinct({
    profileId: socialMediaAccountProfiles.id,
    lastScrapedAt: socialMediaAccountProfiles.lastScrapedAt,
  })
    .from(socialMediaAccountProfiles)
    .innerJoin(subscriptions, eq(subscriptions.accountId, socialMediaAccountProfiles.id))
    .where(and(activeOnly(subscriptions), scrapableAccountTypeCondition()));

  const recent = rows.filter((r) => r.lastScrapedAt !== null && r.lastScrapedAt >= cutoff);
  const due = rows.filter((r) => r.lastScrapedAt === null || r.lastScrapedAt < cutoff);

  const pendingRows = due.length > 0
    ? await db.select({ profileId: brightdataPendingJobs.profileId })
        .from(brightdataPendingJobs)
        .where(and(eq(brightdataPendingJobs.status, 'PENDING'), inArray(brightdataPendingJobs.profileId, due.map((r) => r.profileId))))
    : [];
  const skippedPendingBrightData = new Set(pendingRows.map((p) => p.profileId)).size;

  const newestLastScrapedAt = recent.reduce<Date | null>(
    (newest, r) => (newest === null || r.lastScrapedAt! > newest ? r.lastScrapedAt : newest),
    null
  );
  const pendingIds = new Set(pendingRows.map((p) => p.profileId));
  const deferredByBackoff = mode === 'scheduled'
    ? await findProfilesDeferredByBackoff(
        due.filter((r) => !pendingIds.has(r.profileId)),
        { cutoff, now: new Date() }
      )
    : new Map<string, number>();
  const skippedByBackoff = deferredByBackoff.size;
  const skippedOther = due.length - skippedPendingBrightData - skippedByBackoff;

  const reason = formatEmptyScrapeCycleReason({
    subscribedScrapable: rows.length,
    skippedRecentlyScraped: recent.length,
    newestLastScrapedAt,
    skippedPendingBrightData,
    skippedByBackoff,
    skippedOther,
    cutoff,
    mode,
  });

  return {
    subscribedScrapable: rows.length,
    skippedRecentlyScraped: recent.length,
    newestLastScrapedAt,
    skippedPendingBrightData,
    skippedByBackoff,
    skippedOther,
    cutoff,
    mode,
    reason,
  };
}
