import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import {
  REEXTRACT_RESCRAPE_COOLDOWN_MS,
  dedupeImageUrlsByFileName,
  getImageUrlFileName,
  isImageUrlExpired,
  parseExtractionCursor,
  type ExtractionCursor,
} from '@festgrid/domain/posts';
import { detectPlatformFromUrl, getScraperAdapter, isAdapterRegistered } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { advanceExtractionCursor, finishExtractionChain, takeExtractionLease } from '../posts/extraction-cursor-store.js';
import { isStoredPostAccountScrapable } from '../scraper/post-scrape-gate.js';
import { claimPostUrlScrape } from '../scraper/post-url-scrape-lease.js';
import { buildStepMessage, enqueueStepMessage } from './extraction-chain.js';

// AD-47 Rules 5-6 and AD-51 Rule 4 -- the resume pass for stepped extractions. A chain whose step message was lost, whose
// step failed after taking the lease, or whose Lambda timed out, leaves a cursor with an old claim time (every cursor write
// refreshes it). This pass finds such chains on the AI Lambda's 5-minute tick and finishes them without a human: it
// re-enqueues the next step from the persisted cursor, after one re-scrape when the stored image links have expired, and
// ends the chain partial only when it truly cannot be finished.
//
// Order before giving up: the queue's own retries of the step, then resume attempts while the images are valid, then one
// re-scrape for fresh links (the cursor's progress is kept: only its image links change), and only then the chain ends.

/** Resume attempts per chain, never reset; each one waits longer than the last (the claim TTL times attempts + 1). */
export const CHAIN_MAX_RESUME_ATTEMPTS = 6;
/** Re-scrapes per chain, at least `REEXTRACT_RESCRAPE_COOLDOWN_MS` apart (AD-51 Rule 4). */
export const CHAIN_MAX_RESCRAPES = 2;
/** Chains resumed per tick; the rest wait for the next one. */
export const CHAIN_RESUME_LIMIT = 10;

export type RescrapeOutcome =
  | { ok: true; imageUrl?: string; additionalImageUrls: string[] }
  | { ok: false; reason: 'account_not_scrapable' | 'scrape_failed' | 'no_adapter' }
  | { ok: false; reason: 'in_progress' };

export interface StalledPost {
  id: string;
  accountId: string;
  platform: string;
  postUrl: string;
}

export interface ResumeStalledChainsDeps {
  /** Fetches fresh image links for a post; production goes through the guarded vendor wrapper, the scrape gate and the lease. */
  rescrape?: (post: StalledPost) => Promise<RescrapeOutcome>;
}

export interface ResumeStalledChainsResult {
  resumed: number;
  rescraped: number;
  ended: number;
  skipped: number;
}

/** The production re-scrape: scrape gate (AD-34), one scrape per URL (FIND-110), the adapter's own guarded call (AD-32). */
export async function rescrapePostImages(post: StalledPost): Promise<RescrapeOutcome> {
  if (!(await isStoredPostAccountScrapable(post.accountId))) {
    return { ok: false, reason: 'account_not_scrapable' };
  }
  const platform = detectPlatformFromUrl(post.postUrl);
  if (!platform || !isAdapterRegistered(platform)) {
    return { ok: false, reason: 'no_adapter' };
  }
  const lease = await claimPostUrlScrape(post.postUrl);
  if (!lease) {
    return { ok: false, reason: 'in_progress' };
  }
  try {
    const scraped = await getScraperAdapter(platform).getPostByUrl(post.postUrl);
    if (!scraped) {
      return { ok: false, reason: 'scrape_failed' };
    }
    return { ok: true, imageUrl: scraped.imageUrl, additionalImageUrls: scraped.additionalImageUrls ?? [] };
  } catch (error) {
    console.error(`[resume-stalled-chains] re-scrape of ${post.postUrl} failed:`, error instanceof Error ? error.message : error);
    return { ok: false, reason: 'scrape_failed' };
  } finally {
    await lease.release();
  }
}

export async function resumeStalledChains(
  now: Date = new Date(),
  deps: ResumeStalledChainsDeps = {}
): Promise<ResumeStalledChainsResult> {
  const env = loadBackendEnv();
  const claimTtlMs = env.postExtractionClaimTtlMinutes * 60 * 1000;
  const rescrape = deps.rescrape ?? rescrapePostImages;
  const result: ResumeStalledChainsResult = { resumed: 0, rescraped: 0, ended: 0, skipped: 0 };

  const stalled = await db
    .select({
      id: posts.id,
      accountId: posts.accountId,
      platform: posts.platform,
      postUrl: posts.postUrl,
      content: posts.content,
      ownerDisplayName: posts.ownerDisplayName,
      ownerUsername: posts.ownerUsername,
      publishedAt: posts.publishedAt,
      cursor: posts.extractionCursor,
      claimedAt: posts.queuedForExtractionAt,
    })
    .from(posts)
    .where(
      and(
        eq(posts.isExtracted, false),
        isNotNull(posts.extractionCursor),
        // Stalled: no claim at all, or none newer than the claim TTL times (resume attempts so far + 1). The growing wait
        // is applied here, not only below, so chains still waiting cannot fill the page and starve the eligible ones.
        or(
          isNull(posts.queuedForExtractionAt),
          sql`${posts.queuedForExtractionAt} < ${now.toISOString()}::timestamptz - make_interval(secs => ${claimTtlMs / 1000} * (1 + coalesce((${posts.extractionCursor}->>'resumeAttempts')::int, 0)))`
        )
      )
    )
    .orderBy(asc(posts.queuedForExtractionAt))
    .limit(CHAIN_RESUME_LIMIT * 2);

  let handled = 0;
  for (const post of stalled) {
    if (handled >= CHAIN_RESUME_LIMIT) break;
    try {
      const cursor = parseExtractionCursor(post.cursor);
      if (cursor === null) {
        // A cursor that does not parse can never be continued; dropping it returns the post to the ordinary statuses.
        console.error(`[resume-stalled-chains] post=${post.id} holds an unreadable cursor; cleared`);
        await db
          .update(posts)
          .set({ extractionCursor: null, extractionPartial: true })
          .where(
            and(
              eq(posts.id, post.id),
              eq(posts.isExtracted, false),
              post.claimedAt ? eq(posts.queuedForExtractionAt, post.claimedAt) : isNull(posts.queuedForExtractionAt)
            )
          );
        result.ended++;
        handled++;
        continue;
      }
      // Each attempt waits longer than the last: the claim TTL times (attempts so far + 1).
      if (post.claimedAt && now.getTime() - post.claimedAt.getTime() < claimTtlMs * (1 + cursor.resumeAttempts)) {
        result.skipped++;
        continue;
      }
      handled++;

      const end = async (lease: Pick<ExtractionCursor, 'stepCount' | 'leaseNonce'>, why: string): Promise<void> => {
        const ended = await finishExtractionChain(post.id, lease, { partial: true });
        if (ended) {
          const [account] = await db
            .select({ accountType: socialMediaAccountProfiles.accountType })
            .from(socialMediaAccountProfiles)
            .where(eq(socialMediaAccountProfiles.id, post.accountId))
            .limit(1);
          if (account?.accountType === 'CURATOR_GUIDE') {
            await db.update(posts).set({ content: null }).where(eq(posts.id, post.id));
          }
        }
        console.info(`[resume-stalled-chains] post=${post.id} step=${cursor.stepCount} chain-ended partial=true why=${why} ended=${ended}`);
        result.ended++;
      };

      // The lease: swap in a new nonce so a copy of the step that is still in the queue becomes stale (AD-47 Rule 4).
      const taken = await takeExtractionLease(post.id, { stepCount: cursor.stepCount, leaseNonce: cursor.leaseNonce }, randomUUID());
      if (taken === null) {
        result.skipped++;
        continue;
      }
      let current = taken;
      const lease = () => ({ stepCount: current.stepCount, leaseNonce: current.leaseNonce });

      if (!env.cursorExtractionEnabled) {
        await end(lease(), 'kill_switch_off');
        continue;
      }
      if (current.resumeAttempts >= CHAIN_MAX_RESUME_ATTEMPTS) {
        await end(lease(), 'resume_attempts_spent');
        continue;
      }

      // Expired image links: one re-scrape for fresh ones, keeping every bit of the cursor's progress (AD-51 Rule 4).
      if (current.unreadImageUrls.some((url) => isImageUrlExpired(url, now))) {
        const sinceLast = current.lastRescrapeAt ? now.getTime() - Date.parse(current.lastRescrapeAt) : Infinity;
        if (current.rescrapeCount >= CHAIN_MAX_RESCRAPES || sinceLast < REEXTRACT_RESCRAPE_COOLDOWN_MS) {
          await end(lease(), 'images_expired');
          continue;
        }
        const outcome = await rescrape({ id: post.id, accountId: post.accountId, platform: post.platform, postUrl: post.postUrl });
        if (!outcome.ok && outcome.reason === 'in_progress') {
          // Another scrape of this post is running: not a failure, so no re-scrape is counted, but the visit is counted as a
          // resume attempt (and waits longer next time). Behind a lease that is never released, the attempts run out and the
          // chain ends instead of being refreshed forever.
          await advanceExtractionCursor(post.id, lease(), { ...current, resumeAttempts: current.resumeAttempts + 1 });
          result.skipped++;
          continue;
        }
        if (!outcome.ok) {
          await end(lease(), `rescrape_${outcome.reason}`);
          continue;
        }
        // The cursor's slide index is only valid if the fresh list has the same count and order as the stored one.
        const fresh = dedupeImageUrlsByFileName([outcome.imageUrl, ...outcome.additionalImageUrls]);
        if (fresh.length !== current.totalImages) {
          await end(lease(), 'slide_count_changed');
          continue;
        }
        // The same count is not the same slides: the unread ones must be the same files, in the same order (an edited
        // carousel or a different image variant would put the cursor's index on the wrong image).
        const stillTheSame = current.unreadImageUrls.every(
          (url, i) => getImageUrlFileName(url) !== null && getImageUrlFileName(url) === getImageUrlFileName(fresh[current.nextSlide + i])
        );
        if (!stillTheSame) {
          await end(lease(), 'slides_changed');
          continue;
        }
        // A cached or stale vendor answer can hand back links that are dead already: resuming with them would only burn
        // an attempt, so the chain ends here.
        if (fresh.slice(current.nextSlide).some((url) => isImageUrlExpired(url, now))) {
          await end(lease(), 'rescrape_still_expired');
          continue;
        }
        const refreshed: ExtractionCursor = {
          ...current,
          unreadImageUrls: fresh.slice(current.nextSlide),
          rescrapeCount: current.rescrapeCount + 1,
          lastRescrapeAt: now.toISOString(),
        };
        if (!(await advanceExtractionCursor(post.id, lease(), refreshed))) {
          result.skipped++;
          continue;
        }
        current = refreshed;
        result.rescraped++;
      }

      // Count the attempt, then re-enqueue the next step from the persisted cursor. The nonce moves, the step count does not.
      const counted: ExtractionCursor = { ...current, resumeAttempts: current.resumeAttempts + 1 };
      if (!(await advanceExtractionCursor(post.id, lease(), counted))) {
        result.skipped++;
        continue;
      }
      const beforeCounting = current;
      current = counted;
      try {
        await enqueueStepMessage(
          buildStepMessage(
            {
              postId: post.id,
              accountId: post.accountId,
              postUrl: post.postUrl,
              publishedAt: post.publishedAt.toISOString(),
              ...(post.ownerDisplayName ? { ownerDisplayName: post.ownerDisplayName } : {}),
              ...(post.ownerUsername ? { ownerUsername: post.ownerUsername } : {}),
            },
            counted
          )
        );
      } catch (enqueueError) {
        // The step never left: give the attempt back (best effort), so a short queue outage cannot end a healthy chain.
        await advanceExtractionCursor(post.id, lease(), { ...counted, resumeAttempts: beforeCounting.resumeAttempts });
        throw enqueueError;
      }
      result.resumed++;
    } catch (error) {
      // One chain failing must not stop the others (or the drain that follows).
      result.skipped++;
      console.warn(`[resume-stalled-chains] post=${post.id} skipped:`, error instanceof Error ? error.message : error);
    }
  }

  console.info(
    `[resume-stalled-chains] stalled=${stalled.length} resumed=${result.resumed} rescraped=${result.rescraped} ` +
      `ended=${result.ended} skipped=${result.skipped}`
  );
  return result;
}
