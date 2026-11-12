import { and, eq } from 'drizzle-orm';
import { jobs, posts } from '@festgrid/database';
import {
  PostScraperBudgetError,
  ScraperCapacityExceededError,
  type PostAdapterAttempt,
  type PostScraperAdapterName,
} from '@festgrid/domain';
import {
  REEXTRACT_PHASE_PREVIEW,
  REEXTRACT_PHASE_REFRESH,
  REEXTRACT_POST_PROVIDER_ORDER,
  parseReextractPostInput,
  type JobHandler,
  type JobHandlerContext,
  type JobHandlerResult,
} from '@festgrid/domain/jobs';
import {
  countExpiredImageLinks,
  reextractRefreshReasons,
  type ReextractRefreshOutcome,
  type ReextractRefreshReason,
  type ReextractRefreshReport,
} from '@festgrid/domain/posts';
import { detectPlatformFromUrl, type ScrapedPost } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { BrightDataSnapshotPendingError } from '../scraper/brightdata-client.js';
import { ApifyMemoryLimitExhaustedError, ApifyMonthlyUsageLimitError } from '../scraper/instagram-adapter.js';
import { isStoredPostAccountScrapable } from '../scraper/post-scrape-gate.js';
import { fetchScrapedPost } from '../scraper/post-scraper.js';
import { claimPostUrlScrape } from '../scraper/post-url-scrape-lease.js';
import { isProfileLookupTimeout } from '../scraper/profile-lookup-attempts-store.js';
import { findRecentRefreshVendorCall, refreshRetryAfter } from './reextract-cooldown.js';
import { saveRefreshedPostImages } from './save-refreshed-post-images.js';

// Story 10.6 (AC2, AC3, AC5, AC6, AC7; PRD 3.9.3 FR125; AD-53 Rule 17) -- phase 1 of the moderator re-extract job, run in the SCRAPER
// Lambda (the only one with both vendor tokens). It decides whether the stored images need a refresh, refuses or skips it with a
// reason where it must (account type, cooldown, a fetch of the post already in flight), fetches the post through the post chain with
// THIS TYPE's order (Apify, then Bright Data), saves what comes back to `posts` through the one rule, records what happened as the job's
// `refresh` report and hands the job to the AI-processor Lambda for phase 2 (the preview). It never fails the job for a refresh that
// did not happen: the preview continues on the stored images. It never WAITS for a Bright Data snapshot (the moderator is waiting);
// a snapshot that outlives the budget is linked to the job and its late result heals `posts` (`reextract-late-result-handler.ts`).
// No caption is read, kept or logged here: a vendor's `content` is never looked at.

/** Time kept back from the run for the database writes and the hand-off after the chain returns. */
export const REFRESH_HEADROOM_MS = 15_000;

const PREVIEW_START_FAILED_MESSAGE = 'The preview could not be started. Please try again.';

export function reextractReport(
  outcome: ReextractRefreshOutcome,
  reasons: ReextractRefreshReason[],
  extra: Partial<Pick<ReextractRefreshReport, 'saved' | 'lateResultPending' | 'retryAfter' | 'expiredLinks'>> = {}
): ReextractRefreshReport {
  return { outcome, reasons, saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 0, ...extra };
}

const isCapacityRefusal = (error: unknown): boolean =>
  error instanceof ScraperCapacityExceededError || error instanceof ApifyMemoryLimitExhaustedError || error instanceof ApifyMonthlyUsageLimitError;

/**
 * Why a chain that returned no post failed, from what each provider did (never from a message): a Bright Data snapshot still running,
 * every provider over its cap, a timeout or a provider skipped for lack of time, or simply nobody answering.
 */
export function classifyChainFailure(attempts: readonly PostAdapterAttempt[], error: unknown): { outcome: ReextractRefreshOutcome; lateResultPending: boolean } {
  if (attempts.some((a) => a.outcome === 'failed' && a.error instanceof BrightDataSnapshotPendingError)) {
    return { outcome: 'TIMED_OUT', lateResultPending: true };
  }
  const overQuota = (a: PostAdapterAttempt) => (a.outcome === 'skipped' && a.reason === 'quota') || (a.outcome === 'failed' && isCapacityRefusal(a.error));
  if (attempts.length > 0 && attempts.every(overQuota)) {
    return { outcome: 'PROVIDER_OVER_QUOTA', lateResultPending: false };
  }
  const ranOutOfTime = attempts.some(
    (a) => (a.outcome === 'skipped' && a.reason === 'budget') || (a.outcome === 'failed' && isProfileLookupTimeout(a.error))
  );
  if (ranOutOfTime || (error instanceof PostScraperBudgetError && error.attempts.some((a) => a.reason === 'budget'))) {
    return { outcome: 'TIMED_OUT', lateResultPending: false };
  }
  return { outcome: 'NO_PROVIDER_REACHABLE', lateResultPending: false };
}

type PostRow = typeof posts.$inferSelect;

async function loadPost(postId: string): Promise<PostRow | undefined> {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return post;
}

/** The refresh decision and the fetch. Returns the report; throws only for a database fault (the engine ends the job HANDLER_ERROR). */
async function refreshImages(post: PostRow, ctx: JobHandlerContext, now: Date): Promise<ReextractRefreshReport> {
  const reasons = reextractRefreshReasons(post, now);
  if (reasons.length === 0) {
    return reextractReport('NOT_NEEDED', [], { expiredLinks: countExpiredImageLinks(post, now) });
  }
  const stillExpired = () => countExpiredImageLinks(post, now);

  // AD-34 Rule 7: a post is gated on its owning account before any scrape. A refusal skips the REFRESH; the preview continues.
  if (!(await isStoredPostAccountScrapable(post.accountId))) {
    return reextractReport('NOT_SCRAPED', reasons, { expiredLinks: stillExpired() });
  }

  const platform = detectPlatformFromUrl(post.postUrl);
  if (!platform) {
    return reextractReport('NO_PROVIDER_REACHABLE', reasons, { expiredLinks: stillExpired() });
  }

  // FIND-261102-4qm: the 10 minutes start only when a vendor call ran (read from job_attempts).
  const lastCall = await findRecentRefreshVendorCall(post.id, ctx.jobId, now);
  if (lastCall) {
    return reextractReport('COOLDOWN', reasons, { retryAfter: refreshRetryAfter(lastCall).toISOString(), expiredLinks: stillExpired() });
  }

  // FIND-110: one fetch of a post at a time. A busy lease means another request is fetching it right now.
  const lease = await claimPostUrlScrape(post.postUrl);
  if (!lease) {
    return reextractReport('IN_FLIGHT', reasons, { expiredLinks: stillExpired() });
  }

  const attempts: PostAdapterAttempt[] = [];
  try {
    const budgetMs = Math.max(0, Math.min(loadBackendEnv().reextractRefreshBudgetMs, ctx.getRemainingTimeInMillis() - REFRESH_HEADROOM_MS));
    let scraped: ScrapedPost | null;
    try {
      scraped = await fetchScrapedPost({
        platform,
        url: post.postUrl,
        budgetMs,
        jobId: ctx.jobId,
        order: REEXTRACT_POST_PROVIDER_ORDER as readonly PostScraperAdapterName[],
        onAttempt: (attempt) => {
          attempts.push(attempt);
        },
      });
    } catch (error) {
      const { outcome, lateResultPending } = classifyChainFailure(attempts, error);
      // Never the raw error: its name only (a vendor error can carry a URL or a response body).
      console.warn(`[reextract-refresh] job ${ctx.jobId}: no provider delivered (${error instanceof Error ? error.name : 'error'}); the preview continues on the stored images`);
      return reextractReport(outcome, reasons, { lateResultPending, expiredLinks: stillExpired() });
    }
    if (!scraped) {
      return reextractReport('POST_UNAVAILABLE', reasons, { expiredLinks: stillExpired() });
    }
    const { saved } = await saveRefreshedPostImages({ postId: post.id, scraped, now: new Date() });
    const refreshed = await loadPost(post.id);
    return reextractReport('REFRESHED', reasons, { saved, expiredLinks: refreshed ? countExpiredImageLinks(refreshed, new Date()) : stillExpired() });
  } finally {
    await lease.release();
  }
}

export const reextractRefreshHandler: JobHandler = {
  async run(ctx: JobHandlerContext): Promise<JobHandlerResult> {
    const aiProcessorFunctionName = loadBackendEnv().aiProcessorFunctionName;
    const handOff = async (): Promise<JobHandlerResult> => {
      if (!aiProcessorFunctionName) {
        console.error(`[reextract-refresh] job ${ctx.jobId}: AI_PROCESSOR_FUNCTION_NAME is not configured; the preview cannot start`);
        return { outcome: 'FAILED', reasonCode: 'START_FAILED', errorMessage: PREVIEW_START_FAILED_MESSAGE };
      }
      await ctx.setPhase(REEXTRACT_PHASE_PREVIEW);
      await ctx.handOffToLambda(aiProcessorFunctionName);
      return { outcome: 'HANDED_OFF' };
    };

    // A resumed job (a re-run after the refresh already happened) goes straight to the preview.
    if (ctx.phase === REEXTRACT_PHASE_PREVIEW) {
      return handOff();
    }

    const input = parseReextractPostInput(ctx.input);
    if (!input) {
      console.error(`[reextract-refresh] job ${ctx.jobId}: its input is not a post id`);
      return { outcome: 'FAILED', reasonCode: 'HANDLER_ERROR', errorMessage: 'The job could not read its input.' };
    }
    const post = await loadPost(input.postId);
    if (!post) {
      return { outcome: 'FAILED', reasonCode: 'POST_NOT_FOUND', errorMessage: 'Post not found.' };
    }
    // AD-51 Rule 4: the start already refused a post whose stepped extraction was running; one may have begun while the job queued.
    if (post.extractionCursor !== null) {
      return { outcome: 'FAILED', reasonCode: 'CHAIN_IN_FLIGHT', errorMessage: 'This post is still being extracted in steps. Try again when that has finished.' };
    }

    await ctx.setPhase(REEXTRACT_PHASE_REFRESH);
    const report = await refreshImages(post, ctx, new Date());

    // The report waits on the job row for phase 2, which ends the job with it. Guarded: a job that already ended is not written.
    await db
      .update(jobs)
      .set({ resultData: { refresh: report }, updatedAt: new Date() })
      .where(and(eq(jobs.id, ctx.jobId), eq(jobs.status, 'RUNNING')));

    return handOff();
  },
};
