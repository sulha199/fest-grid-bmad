import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, or, sql } from 'drizzle-orm';
import { manualExtractionJobs, posts } from '@festgrid/database';
import { selectApiKey } from '@festgrid/domain/ai-gateway';
import { detectPlatformFromUrl, getScraperAdapter, isAdapterRegistered } from '@festgrid/domain/scraper';
import { REEXTRACT_RESCRAPE_COOLDOWN_MS, type ManualExtractionRequestPayload } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { fetchCandidateKeys } from '../ai-gateway/usage-store.js';
import { startManualExtractionJob } from './manual-extraction-job.js';
import { startReextractPostJob } from './start-reextract-post-job.js';
import {
  ACCOUNT_NOT_SCRAPABLE_MESSAGE,
  SCRAPE_IN_PROGRESS_MESSAGE,
  isOwnerAccountScrapable,
  isStoredPostAccountScrapable,
} from '../scraper/post-scrape-gate.js';
import { claimPostUrlScrape } from '../scraper/post-url-scrape-lease.js';
import { isPreVendorCallFailure } from '../scraper/pre-vendor-call-failure.js';

// AD-40 -- starts a moderator re-extract preview. The caller (the resolver) has already enforced
// `requireModerator`. Nothing here writes to `posts` or `events`.
//
// Story 10.6: a STORED post that keeps its caption is re-extracted by the engine job `reextract-post` (image refresh in the Scraper
// Lambda, then the preview in the AI-processor Lambda; `start-reextract-post-job.ts`). That job reads the caption from `posts.content`
// and keeps none, so it cannot serve the two cases that need the caption from a scrape: a stored post whose caption is not stored (a
// curator post's is cleared on purpose) and a URL that is not in the database. Those keep the path below, unchanged: a rescrape
// through the platform adapter, the rescraped caption held only in the manual job's `request_payload` (blanked by the AI Lambda).

export type PreviewStartErrorCode =
  | 'NOT_FOUND'
  | 'UNSUPPORTED_PLATFORM'
  | 'NO_API_KEY'
  | 'SCRAPE_FAILED'
  | 'RATE_LIMITED'
  | 'ACCOUNT_NOT_SCRAPABLE'
  | 'SCRAPE_IN_PROGRESS'
  | 'CHAIN_IN_FLIGHT'
  | 'EXTRACTION_FAILED';

export type StartPostReextractionPreviewResult =
  | { jobId: string }
  | { errorCode: PreviewStartErrorCode; errorMessage: string };

export interface StartPostReextractionPreviewInput {
  postId?: string | null;
  url?: string | null;
  now?: Date;
}

// `request_payload` is stored as a jsonb *string* holding the object (drizzle/postgres.js
// double-encoding), so `->>` on the raw column yields NULL; unwrap it first (as for `events.links`).
const payloadObject = sql`(CASE WHEN jsonb_typeof(${manualExtractionJobs.requestPayload}) = 'string' THEN (${manualExtractionJobs.requestPayload} #>> '{}')::jsonb ELSE ${manualExtractionJobs.requestPayload} END)`;

interface RescrapeCooldown {
  /** Minutes left on the cooldown, or 0 when a rescrape is allowed. */
  minutesLeft: number;
  /** The newest in-window attempt was refused by the account gate: say that, not "rescraped recently". */
  refusedByGate: boolean;
}

async function rescrapeCooldown(url: string, now: Date): Promise<RescrapeCooldown> {
  const since = new Date(now.getTime() - REEXTRACT_RESCRAPE_COOLDOWN_MS);
  const [recent] = await db
    .select({ createdAt: manualExtractionJobs.createdAt, errorCode: manualExtractionJobs.errorCode })
    .from(manualExtractionJobs)
    .where(
      and(
        eq(manualExtractionJobs.sourceUrl, url),
        gt(manualExtractionJobs.createdAt, since),
        sql`${payloadObject} ->> 'mode' = 'REEXTRACT_PREVIEW'`,
        sql`${payloadObject} ->> 'rescraped' = 'true'`
      )
    )
    .orderBy(desc(manualExtractionJobs.createdAt))
    .limit(1);
  if (!recent) return { minutesLeft: 0, refusedByGate: false };
  const msLeft = REEXTRACT_RESCRAPE_COOLDOWN_MS - (now.getTime() - recent.createdAt.getTime());
  return { minutesLeft: Math.max(1, Math.ceil(msLeft / 60_000)), refusedByGate: recent.errorCode === 'ACCOUNT_NOT_SCRAPABLE' };
}

const ACCOUNT_NOT_SCRAPABLE = { errorCode: 'ACCOUNT_NOT_SCRAPABLE', errorMessage: ACCOUNT_NOT_SCRAPABLE_MESSAGE } as const;

const SCRAPE_IN_PROGRESS = { errorCode: 'SCRAPE_IN_PROGRESS', errorMessage: SCRAPE_IN_PROGRESS_MESSAGE } as const;

const SCRAPE_FAILED = {
  errorCode: 'SCRAPE_FAILED',
  errorMessage: 'Could not retrieve content from the post URL.',
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A scrape that throws or returns nothing still cost a scraper call, so it must count against the
 * per-URL cooldown (which reads recent preview jobs): record it as an already-FAILED job. The
 * caption is empty by construction -- nothing was obtained.
 */
async function recordFailedRescrape(
  userId: string,
  url: string,
  postId: string | null,
  accountId: string | null,
  errorCode: 'EXTRACTION_FAILED' | 'ACCOUNT_NOT_SCRAPABLE' = 'EXTRACTION_FAILED'
): Promise<void> {
  try {
    await db.insert(manualExtractionJobs).values({
      requestedByUserId: userId,
      sourceUrl: url,
      requestPayload: {
        message: { postId: postId ?? randomUUID(), accountId: accountId ?? '', content: '', postUrl: url, publishedAt: new Date().toISOString() },
        mode: 'REEXTRACT_PREVIEW',
        postStored: postId !== null,
        rescraped: true,
      },
      status: 'FAILED',
      errorCode,
      errorMessage: errorCode === 'ACCOUNT_NOT_SCRAPABLE' ? ACCOUNT_NOT_SCRAPABLE_MESSAGE : 'The post could not be rescraped.',
      completedAt: new Date(),
    });
  } catch (err) {
    console.error(`[startPostReextractionPreview] Could not record the failed rescrape of ${url}:`, err);
  }
}

export async function startPostReextractionPreview(
  userId: string,
  input: StartPostReextractionPreviewInput
): Promise<StartPostReextractionPreviewResult> {
  const now = input.now ?? new Date();

  if (input.postId && !UUID_PATTERN.test(input.postId)) {
    return { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' };
  }

  const [post] = input.postId
    ? await db.select().from(posts).where(eq(posts.id, input.postId)).limit(1)
    : await db
        .select()
        .from(posts)
        .where(or(eq(posts.postUrl, input.url!), eq(posts.originalPostUrl, input.url!)))
        .limit(1);

  if (input.postId && !post) {
    return { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' };
  }

  // AD-51 Rule 4: a post whose stepped extraction is still running (it holds a cursor) is refused, so a preview cannot race
  // the chain for the post's images, ordinals and scrape budget.
  if (post && post.extractionCursor !== null) {
    return { errorCode: 'CHAIN_IN_FLIGHT', errorMessage: 'This post is still being extracted in steps. Try again when that has finished.' };
  }

  // Story 10.6: a stored post that keeps its caption is the engine job's (refresh, then preview).
  if (post?.content) {
    return startReextractPostJob(userId, post.id);
  }

  const url = post ? post.postUrl : input.url!;
  const platform = detectPlatformFromUrl(url);

  // From here on the caption must come from a scrape: the post is unknown, or its caption is not stored.
  if (!platform) {
    return { errorCode: 'UNSUPPORTED_PLATFORM', errorMessage: 'This URL is not from a supported platform.' };
  }

  if (!post) {
    // Unknown post: same NO_API_KEY pre-check as the correction flow (no subscriber fallback here).
    const candidates = await fetchCandidateKeys('gemini', [userId]);
    if (!selectApiKey(candidates, 'TIER_1_USER_SPECIFIC')) {
      return { errorCode: 'NO_API_KEY', errorMessage: 'Contribute your own Gemini API key to use this feature.' };
    }
  }

  // AD-34 -- a stored post is gated on its owning account before any scrape starts; with no caption to preview from, the moderator
  // is told why.
  if (post && !(await isStoredPostAccountScrapable(post.accountId))) {
    return ACCOUNT_NOT_SCRAPABLE;
  }

  // FIND-110 -- one scrape of this URL at a time. A busy lease means another request is fetching it right now; a caption is never
  // stored, so this request cannot share the other run's result.
  const lease = await claimPostUrlScrape(url);
  if (!lease) {
    return SCRAPE_IN_PROGRESS;
  }

  try {
    // Checked inside the lease, so a run that just finished (row written, lease released) blocks
    // this one instead of being scraped again.
    const { minutesLeft, refusedByGate } = await rescrapeCooldown(url, now);
    if (minutesLeft > 0) {
      if (refusedByGate) return ACCOUNT_NOT_SCRAPABLE;
      return {
        errorCode: 'RATE_LIMITED',
        errorMessage: `This post was rescraped recently. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      };
    }

    // FIND-261102-4qm -- no adapter means no vendor call is even possible, so nothing was spent: no
    // FAILED row, no cooldown. (BUG-100, a separate branch, is about which platforms have one.)
    if (!isAdapterRegistered(platform)) {
      // Keep the log line the thrown error used to leave: this is how BUG-100 (the API Lambda
      // registered no adapters) was found in CloudWatch, and a silent fallback would hide a repeat.
      console.error(`[startPostReextractionPreview] No scraper adapter registered for platform "${platform}"; no rescrape attempted for ${url}`);
      return SCRAPE_FAILED;
    }

    let scraped;
    try {
      scraped = await getScraperAdapter(platform).getPostByUrl(url);
    } catch (err) {
      console.error(`[startPostReextractionPreview] Failed to scrape ${url}:`, err);
      // FIND-261102-4qm -- only a failure once the vendor call actually started (so credit may have
      // been spent) counts against the cooldown; a gate that refused before the call started
      // leaves no row, so an immediate retry is not refused for no reason.
      if (!isPreVendorCallFailure(err)) {
        await recordFailedRescrape(userId, url, post?.id ?? null, post?.accountId ?? null);
      }
      return SCRAPE_FAILED;
    }
    // An image-only post has an empty caption but is still extractable from its image, so only a
    // missing result is a failure (the correction flow makes the same call).
    if (!scraped) {
      await recordFailedRescrape(userId, url, post?.id ?? null, post?.accountId ?? null);
      return SCRAPE_FAILED;
    }

    // AD-34 -- an unknown URL could not be gated before the scrape; the account it returned is
    // looked up now. A refusal still costs a scrape, so it is recorded against the cooldown and no
    // job (and no caption copy) is created.
    if (!post && !(await isOwnerAccountScrapable(platform, { username: scraped.ownerUsername, ownerId: scraped.ownerId }))) {
      await recordFailedRescrape(userId, url, null, null, 'ACCOUNT_NOT_SCRAPABLE');
      return ACCOUNT_NOT_SCRAPABLE;
    }

    // The rescraped caption goes into the job payload only -- never into `posts.content`. The scraper's cover and every slide of the
    // same fetch are used, falling back to what is stored for either (no fresh link is written to `posts` on this path).
    const requestPayload: ManualExtractionRequestPayload = {
      message: {
        postId: post?.id ?? randomUUID(),
        accountId: post?.accountId ?? '',
        content: scraped.content,
        imageUrl: scraped.imageUrl ?? post?.imageUrl ?? undefined,
        postUrl: post?.postUrl ?? scraped.postUrl,
        publishedAt: post?.publishedAt.toISOString() ?? scraped.publishedAt,
        ownerDisplayName: post?.ownerDisplayName ?? scraped.ownerDisplayName,
        ownerUsername: post?.ownerUsername ?? scraped.ownerUsername,
        // An empty list from the scraper is "no slides found", not "no slides": fall back to the stored
        // ones, so a dead stored slide still shows up as a shortfall instead of vanishing silently.
        additionalImageUrls: scraped.additionalImageUrls?.length ? scraped.additionalImageUrls : (post?.additionalImageUrls ?? undefined),
      },
      existingPostAccountId: post?.accountId,
      mode: 'REEXTRACT_PREVIEW',
      postStored: Boolean(post),
      rescraped: true,
    };
    return await startManualExtractionJob(userId, url, requestPayload);
  } finally {
    await lease.release();
  }
}
