// Small, idempotent backfill of `posts.durableThumbnailUrl` (AD-28 face-blurred thumbnail) for
// posts that never got one although their ORIGINAL image URL is still valid. It is also the
// recovery path for `text_only_fail_closed` posts (the pre-AI cover blur failed, so the extraction
// pipeline deliberately did not build a thumbnail and does not retry).
//
// Scope, deliberately narrow:
//   * only posts whose `imageUrlExpiresAt` is still in the future -- once the hotlinked original
//     has expired its bytes are unrecoverable, so nothing can be built (the backfill never tries);
//   * only posts that still back at least one live (not deleted, not merged-away) event;
//   * only posts that pass the SAME relevance gate as the extraction pipeline
//     (`isThumbnailStillRelevant`, AD-28 Rule 2) -- an event that ends before the original image
//     expires never needs a thumbnail, so the backfill does not create one either.
//
// Privacy: the thumbnail is always built from `detectAndBlurFaces` output. If detection throws,
// the post is counted as failed and NOTHING is uploaded -- the original bytes are never the
// fallback (same fail-closed rule as the pipeline).
//
// DB-coupled (imports the Drizzle tables), so this lives in apps/backend, never packages/domain.
import { and, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';
import { events, posts, schedules } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { computeLatestScheduleEnd, isThumbnailStillRelevant, type GeminiEventPayload } from '@festgrid/domain';
import { db } from '../../db/client.js';
import { type BackendEnv } from '../../env.js';
import { detectAndBlurFacesSeam } from './detect-and-blur-faces.js';
import { uploadFaceBlurThumbnailSeam } from './upload-face-blur-thumbnail.js';

export interface ThumbnailBackfillCandidate {
  postId: string;
  imageUrl: string;
  imageUrlExpiresAt: Date;
  latestScheduleEnd: Date | null;
}

export interface FetchedImage {
  bytes: Buffer;
  contentType: string;
}

export type FetchImage = (url: string) => Promise<FetchedImage>;

export interface ThumbnailBackfillOptions {
  /** false (default) = dry run: lists what it would do and writes/uploads nothing. */
  apply?: boolean;
  /** Cap on how many posts are processed (after the relevance gate), soonest-expiring first. */
  limit?: number;
  /** Restrict to these post ids (ops spot-fix and tests). */
  postIds?: string[];
  now?: Date;
  fetchImage?: FetchImage;
}

export interface ThumbnailBackfillResult {
  /** Posts with no thumbnail, a still-valid original image and at least one live event. */
  candidates: number;
  /** Candidates skipped by the relevance gate (event ends before the image expires). */
  gated: number;
  built: number;
  failed: number;
  /** Candidates left untouched in a dry run, or beyond `limit`. */
  pending: number;
}

const IMAGE_FETCH_TIMEOUT_MS = 30_000;

export const defaultFetchImage: FetchImage = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: Status ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Fetch response content-type is not an image: ${contentType}`);
  }
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType };
};

/**
 * Posts that have no durable thumbnail, whose original image URL has not expired yet, and that
 * still back at least one live event -- each with the latest end across its live events'
 * schedules (the relevance gate's input). Soonest-expiring first, so the posts about to lose
 * their only source image are rebuilt before the ones with time to spare.
 */
export async function selectThumbnailBackfillCandidates(
  now: Date,
  postIds?: string[]
): Promise<ThumbnailBackfillCandidate[]> {
  const liveEventForPost = and(activeOnly(events), isNull(events.mergedIntoEventId));

  const postRows = await db
    .selectDistinct({
      id: posts.id,
      imageUrl: posts.imageUrl,
      imageUrlExpiresAt: posts.imageUrlExpiresAt,
    })
    .from(posts)
    .innerJoin(events, eq(events.postId, posts.id))
    .where(
      and(
        isNull(posts.durableThumbnailUrl),
        isNotNull(posts.imageUrl),
        gt(posts.imageUrlExpiresAt, now),
        liveEventForPost,
        postIds ? inArray(posts.id, postIds) : undefined
      )
    )
    .orderBy(posts.imageUrlExpiresAt, posts.id);

  if (postRows.length === 0) return [];

  const scheduleRows = await db
    .select({
      postId: events.postId,
      eventStartDate: schedules.eventStartDate,
      eventEndDate: schedules.eventEndDate,
      eventEndTime: schedules.eventEndTime,
    })
    .from(schedules)
    .innerJoin(events, eq(schedules.eventId, events.id))
    .where(
      and(
        inArray(
          events.postId,
          postRows.map((row) => row.id)
        ),
        liveEventForPost
      )
    );

  const schedulesByPost = new Map<string, GeminiEventPayload['schedules']>();
  for (const row of scheduleRows) {
    if (!row.postId) continue;
    const list = schedulesByPost.get(row.postId) ?? [];
    list.push({
      isMainSchedule: false,
      eventStartDate: row.eventStartDate,
      eventEndDate: row.eventEndDate ?? undefined,
      eventEndTime: row.eventEndTime ?? undefined,
    });
    schedulesByPost.set(row.postId, list);
  }

  return postRows.map((row) => ({
    postId: row.id,
    // Both are non-null by the WHERE clause above; narrowed here for the type system.
    imageUrl: row.imageUrl as string,
    imageUrlExpiresAt: row.imageUrlExpiresAt as Date,
    latestScheduleEnd: computeLatestScheduleEnd([
      {
        eventName: '',
        types: [],
        categories: [],
        confidenceScore: 1,
        schedules: schedulesByPost.get(row.id) ?? [],
      },
    ]),
  }));
}

export async function runThumbnailBackfill(
  env: BackendEnv,
  options: ThumbnailBackfillOptions = {}
): Promise<ThumbnailBackfillResult> {
  const { apply = false, limit, postIds, now = new Date(), fetchImage = defaultFetchImage } = options;

  if (apply && (!env.postMediaBucketName || !env.postMediaCdnDomain)) {
    throw new Error('runThumbnailBackfill: postMediaBucketName/postMediaCdnDomain are not configured.');
  }

  const candidates = await selectThumbnailBackfillCandidates(now, postIds);
  const relevant = candidates.filter((candidate) =>
    isThumbnailStillRelevant(candidate.imageUrlExpiresAt, candidate.latestScheduleEnd)
  );
  const gated = candidates.length - relevant.length;
  const targets = limit !== undefined ? relevant.slice(0, limit) : relevant;

  const result: ThumbnailBackfillResult = {
    candidates: candidates.length,
    gated,
    built: 0,
    failed: 0,
    pending: relevant.length - targets.length,
  };

  for (const target of targets) {
    if (!apply) {
      result.pending++;
      console.log(
        `[DRY RUN] would build a thumbnail for post ${target.postId} (original image valid until ${target.imageUrlExpiresAt.toISOString()})`
      );
      continue;
    }

    try {
      const image = await fetchImage(target.imageUrl);
      // Fail closed: if detection throws we never reach the upload, so an unblurred image can
      // never become a thumbnail.
      const blurred = await detectAndBlurFacesSeam(image.bytes, image.contentType);
      const url = await uploadFaceBlurThumbnailSeam(target.postId, blurred.buffer, env);
      if (!url) {
        throw new Error('uploadFaceBlurThumbnail returned null (see the preceding error/warning)');
      }
      result.built++;
      console.log(`Built thumbnail for post ${target.postId} (${blurred.faceCount} face(s) blurred): ${url}`);
    } catch (error) {
      result.failed++;
      console.error(`Failed to build a thumbnail for post ${target.postId}:`, error);
    }
  }

  console.log('');
  console.log(
    `candidates: ${result.candidates}, relevance-gated (skipped by design): ${result.gated}, ` +
      `built: ${result.built}, failed: ${result.failed}, not processed: ${result.pending}`
  );

  return result;
}
