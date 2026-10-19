import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, or, sql } from 'drizzle-orm';
import { manualExtractionJobs, posts } from '@festgrid/database';
import { selectApiKey } from '@festgrid/domain/ai-gateway';
import { detectPlatformFromUrl, getScraperAdapter } from '@festgrid/domain/scraper';
import {
  REEXTRACT_RESCRAPE_COOLDOWN_MS,
  type ManualExtractionRequestPayload,
} from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { fetchCandidateKeys } from '../ai-gateway/usage-store.js';
import { startManualExtractionJob } from './manual-extraction-job.js';

// AD-36 -- starts a moderator re-extract preview. The caller (the resolver) has already enforced
// `requireModerator`. Nothing here writes to `posts` or `events`: a rescraped caption lives only in
// the job's `request_payload`, which the AI Lambda blanks when the job ends.

export type PreviewStartErrorCode =
  | 'NOT_FOUND'
  | 'UNSUPPORTED_PLATFORM'
  | 'NO_API_KEY'
  | 'SCRAPE_FAILED'
  | 'RATE_LIMITED'
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

/** Minutes left on the rescrape cooldown for `url`, or 0 when a rescrape is allowed. */
async function rescrapeCooldownMinutesLeft(url: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - REEXTRACT_RESCRAPE_COOLDOWN_MS);
  const [recent] = await db
    .select({ createdAt: manualExtractionJobs.createdAt })
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
  if (!recent) return 0;
  const msLeft = REEXTRACT_RESCRAPE_COOLDOWN_MS - (now.getTime() - recent.createdAt.getTime());
  return Math.max(1, Math.ceil(msLeft / 60_000));
}

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
async function recordFailedRescrape(userId: string, url: string, postId: string | null, accountId: string | null): Promise<void> {
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
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: 'The post could not be rescraped.',
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

  const url = post ? post.postUrl : input.url!;
  const platform = detectPlatformFromUrl(url);

  // Stored post with its caption: no scrape, no cooldown.
  if (post?.content) {
    return startManualExtractionJob(userId, url, {
      message: {
        postId: post.id,
        accountId: post.accountId,
        content: post.content,
        imageUrl: post.imageUrl ?? undefined,
        postUrl: post.postUrl,
        publishedAt: post.publishedAt.toISOString(),
        ownerDisplayName: post.ownerDisplayName ?? undefined,
        ownerUsername: post.ownerUsername ?? undefined,
        additionalImageUrls: post.additionalImageUrls ?? undefined,
      },
      existingPostAccountId: post.accountId,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: false,
    });
  }

  // From here on a scrape is needed: the post is unknown, or its caption is not stored.
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

  const minutesLeft = await rescrapeCooldownMinutesLeft(url, now);
  if (minutesLeft > 0) {
    return {
      errorCode: 'RATE_LIMITED',
      errorMessage: `This post was rescraped recently. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
    };
  }

  let scraped;
  try {
    scraped = await getScraperAdapter(platform).getPostByUrl(url);
  } catch (err) {
    console.error(`[startPostReextractionPreview] Failed to scrape ${url}:`, err);
    await recordFailedRescrape(userId, url, post?.id ?? null, post?.accountId ?? null);
    return SCRAPE_FAILED;
  }
  // An image-only post has an empty caption but is still extractable from its image, so only a
  // missing result is a failure (the correction flow makes the same call).
  if (!scraped) {
    await recordFailedRescrape(userId, url, post?.id ?? null, post?.accountId ?? null);
    return SCRAPE_FAILED;
  }

  // The rescraped caption goes into the job payload only -- never into `posts.content`.
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
      additionalImageUrls: post?.additionalImageUrls ?? undefined,
    },
    existingPostAccountId: post?.accountId,
    mode: 'REEXTRACT_PREVIEW',
    postStored: Boolean(post),
    rescraped: true,
  };
  return startManualExtractionJob(userId, url, requestPayload);
}
