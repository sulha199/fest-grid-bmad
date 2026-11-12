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
  decideReextractEnding,
  parseReextractPostInput,
  readHeldPost,
  reextractPostInputKey,
  reextractUrlInputKey,
  type JobHandler,
  type JobHandlerContext,
  type JobHandlerResult,
  type ReextractHeldPost,
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
import {
  ACCOUNT_NOT_SCRAPABLE_MESSAGE,
  SCRAPE_IN_PROGRESS_MESSAGE,
  isOwnerAccountScrapable,
  isStoredPostAccountScrapable,
} from '../scraper/post-scrape-gate.js';
import { fetchScrapedPost } from '../scraper/post-scraper.js';
import { claimPostUrlScrape } from '../scraper/post-url-scrape-lease.js';
import { isProfileLookupTimeout } from '../scraper/profile-lookup-attempts-store.js';
import { findRecentRefreshVendorCall, jobHasVendorAttempt, refreshRetryAfter } from './reextract-cooldown.js';
import { holdPostOnJob } from './held-post.js';
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
/** Added to the refresh budget for the per-URL lease, so it outlives the fetch and the attempt rows that start the cooldown. */
export const REFRESH_LEASE_MARGIN_MS = 30_000;

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

/** What phase 1 decided: a report to carry to phase 2 (with the post to hold when the caption had to be fetched), or an ending. */
type RefreshResult = { kind: 'report'; report: ReextractRefreshReport; held?: ReextractHeldPost } | { kind: 'refused'; result: JobHandlerResult };

const SCRAPE_FAILED_MESSAGE = 'Could not retrieve content from the post URL.';
const NOT_KEPT_MESSAGE = 'The post could not be kept for the preview. Please start the re-extract again.';

type StopOutcome = Exclude<ReextractRefreshOutcome, 'NOT_NEEDED' | 'REFRESHED'>;

/** The ending of a re-extract that could not fetch the caption it needs: the refusal itself, in the words the screen already shows. */
function failedForCaption(outcome: StopOutcome, retryAfter: string | null): JobHandlerResult {
  const { reasonCode } = decideReextractEnding({ outcome, saved: false, expiredLinks: 0 });
  switch (outcome) {
    case 'NOT_SCRAPED':
      return { outcome: 'FAILED', reasonCode, errorMessage: ACCOUNT_NOT_SCRAPABLE_MESSAGE };
    case 'IN_FLIGHT':
      return { outcome: 'FAILED', reasonCode, errorMessage: SCRAPE_IN_PROGRESS_MESSAGE };
    case 'COOLDOWN': {
      const minutes = Math.max(1, Math.ceil((new Date(retryAfter ?? Date.now()).getTime() - Date.now()) / 60_000));
      return { outcome: 'FAILED', reasonCode, errorMessage: `This post was rescraped recently. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` };
    }
    default:
      return { outcome: 'FAILED', reasonCode, errorMessage: SCRAPE_FAILED_MESSAGE };
  }
}

/**
 * The refresh decision and the fetch, for a stored post (images, and its caption when it has none stored) or a URL that is not in
 * the database (always the caption; there is no post to save links to). Throws only for a database fault (the engine ends the job
 * HANDLER_ERROR).
 */
async function refreshImages(target: { post: PostRow | undefined; url: string; inputKey: string }, ctx: JobHandlerContext, now: Date): Promise<RefreshResult> {
  const { post, url, inputKey } = target;
  const captionNeeded = !post || !post.content;
  // A URL that is not stored has no images of ours to judge: the caption is the only reason.
  const reasons: ReextractRefreshReason[] = post ? reextractRefreshReasons(post, now, { captionMissing: captionNeeded }) : ['CAPTION_MISSING'];
  if (reasons.length === 0) {
    return { kind: 'report', report: reextractReport('NOT_NEEDED', [], { expiredLinks: post ? countExpiredImageLinks(post, now) : 0 }) };
  }
  const stillExpired = () => (post ? countExpiredImageLinks(post, now) : 0);
  // With the caption stored, a refresh that cannot happen is a report (the preview continues on the stored images); with no caption
  // stored there is nothing to preview from, so the same refusal ends the job FAILED with its reason (the moderator may retry).
  const stop = (outcome: StopOutcome, extra: { lateResultPending?: boolean; retryAfter?: string | null } = {}): RefreshResult =>
    captionNeeded
      ? { kind: 'refused', result: failedForCaption(outcome, extra.retryAfter ?? null) }
      : { kind: 'report', report: reextractReport(outcome, reasons, { ...extra, expiredLinks: stillExpired() }) };

  // AD-34 Rule 7: a stored post is gated on its owning account before any scrape. A URL that is not stored is gated on the owner
  // the scrape returns, below.
  if (post && !(await isStoredPostAccountScrapable(post.accountId))) {
    return stop('NOT_SCRAPED');
  }

  const platform = detectPlatformFromUrl(url);
  if (!platform) {
    return stop('NO_PROVIDER_REACHABLE');
  }

  // FIND-261102-4qm: the 10 minutes start only when a vendor call ran (read from job_attempts).
  const lastCall = await findRecentRefreshVendorCall(inputKey, ctx.jobId, now);
  if (lastCall) {
    return stop('COOLDOWN', { retryAfter: refreshRetryAfter(lastCall).toISOString() });
  }

  // FIND-110: one fetch of a post at a time. A busy lease means another request is fetching it right now. The lease is held for the
  // whole budget plus a margin (the default 60 s would lapse mid-refresh while Bright Data runs ~90 s, and a second moderator's job
  // could then scrape the post again before this attempt's row exists).
  const budgetMs = Math.max(0, Math.min(loadBackendEnv().reextractRefreshBudgetMs, ctx.getRemainingTimeInMillis() - REFRESH_HEADROOM_MS));
  const lease = await claimPostUrlScrape(url, budgetMs + REFRESH_LEASE_MARGIN_MS);
  if (!lease) {
    return stop('IN_FLIGHT');
  }

  const attempts: PostAdapterAttempt[] = [];
  try {
    let scraped: ScrapedPost | null;
    try {
      scraped = await fetchScrapedPost({
        platform,
        url,
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
      console.warn(`[reextract-refresh] job ${ctx.jobId}: no provider delivered (${error instanceof Error ? error.name : 'error'})`);
      return stop(outcome as StopOutcome, { lateResultPending });
    }
    if (!scraped) {
      return stop('POST_UNAVAILABLE');
    }
    // AD-34 Rule 7: a URL that is not stored could not be gated before the fetch; the account it returned is looked up now. The
    // fetch still counts toward the cooldown (its attempt row exists). Nothing of the scraped post is kept.
    if (!post && !(await isOwnerAccountScrapable(platform, { username: scraped.ownerUsername, ownerId: scraped.ownerId }))) {
      return { kind: 'refused', result: failedForCaption('NOT_SCRAPED', null) };
    }

    let saved = false;
    let expiredLinks = 0;
    if (post) {
      ({ saved } = await saveRefreshedPostImages({ postId: post.id, scraped, now: new Date() }));
      const refreshed = await loadPost(post.id);
      expiredLinks = refreshed ? countExpiredImageLinks(refreshed, new Date()) : stillExpired();
    }
    const held: ReextractHeldPost | undefined = captionNeeded
      ? {
          content: scraped.content,
          imageUrl: scraped.imageUrl,
          additionalImageUrls: scraped.additionalImageUrls,
          postUrl: post?.postUrl ?? scraped.postUrl,
          publishedAt: post?.publishedAt.toISOString() ?? scraped.publishedAt,
          ownerDisplayName: scraped.ownerDisplayName,
          ownerUsername: scraped.ownerUsername,
        }
      : undefined;
    return { kind: 'report', report: reextractReport('REFRESHED', reasons, { saved, expiredLinks }), held };
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
      console.error(`[reextract-refresh] job ${ctx.jobId}: its input is neither a post id nor a URL`);
      return { outcome: 'FAILED', reasonCode: 'HANDLER_ERROR', errorMessage: 'The job could not read its input.' };
    }
    let post: PostRow | undefined;
    if ('postId' in input) {
      post = await loadPost(input.postId);
      if (!post) {
        return { outcome: 'FAILED', reasonCode: 'POST_NOT_FOUND', errorMessage: 'Post not found.' };
      }
      // AD-51 Rule 4: the start already refused a post whose stepped extraction was running; one may have begun while the job queued.
      if (post.extractionCursor !== null) {
        return { outcome: 'FAILED', reasonCode: 'CHAIN_IN_FLIGHT', errorMessage: 'This post is still being extracted in steps. Try again when that has finished.' };
      }
    }
    const target = post
      ? { post, url: post.postUrl, inputKey: reextractPostInputKey(post.id) }
      : { post: undefined, url: (input as { url: string }).url, inputKey: reextractUrlInputKey((input as { url: string }).url) };
    const captionNeeded = !post || !post.content;

    await ctx.setPhase(REEXTRACT_PHASE_REFRESH);

    // A re-run of phase 1 for a job that already made its vendor call (the Lambda died before the hand-off) must not spend the
    // call again: it keeps the report the first run left, or, when it died before writing one, says the refresh did not finish.
    if (await jobHasVendorAttempt(ctx.jobId)) {
      const [row] = await db.select({ input: jobs.input, resultData: jobs.resultData }).from(jobs).where(eq(jobs.id, ctx.jobId));
      if (captionNeeded && !readHeldPost(row?.input)) {
        // The call ran but its caption was never held (the Lambda died in between) and it cannot be had again within the cooldown.
        return { outcome: 'FAILED', reasonCode: 'EXTRACTION_FAILED', errorMessage: NOT_KEPT_MESSAGE };
      }
      if (!(row?.resultData as { refresh?: ReextractRefreshReport } | null)?.refresh) {
        const reasons: ReextractRefreshReason[] = post ? reextractRefreshReasons(post, new Date(), { captionMissing: captionNeeded }) : ['CAPTION_MISSING'];
        const unfinished = reextractReport(reasons.length > 0 && !captionNeeded ? 'TIMED_OUT' : 'REFRESHED', reasons, {
          expiredLinks: post ? countExpiredImageLinks(post, new Date()) : 0,
        });
        await db.update(jobs).set({ resultData: { refresh: unfinished }, updatedAt: new Date() }).where(and(eq(jobs.id, ctx.jobId), eq(jobs.status, 'RUNNING')));
      }
      console.warn(`[reextract-refresh] job ${ctx.jobId}: its vendor call already ran; not repeated, going on to the preview`);
      return handOff();
    }

    const refresh = await refreshImages(target, ctx, new Date());
    if (refresh.kind === 'refused') {
      return refresh.result;
    }

    // The report waits on the job row for phase 2, which ends the job with it. Guarded: a job that already ended is not written.
    await db
      .update(jobs)
      .set({ resultData: { refresh: refresh.report }, updatedAt: new Date() })
      .where(and(eq(jobs.id, ctx.jobId), eq(jobs.status, 'RUNNING')));
    // A fetched caption is held on the job for phase 2 and nothing else (blanked when phase 2 ends; see held-post.ts).
    if (refresh.held && !(await holdPostOnJob(ctx.jobId, refresh.held))) {
      return { outcome: 'FAILED', reasonCode: 'EXTRACTION_FAILED', errorMessage: NOT_KEPT_MESSAGE };
    }

    return handOff();
  },
};
