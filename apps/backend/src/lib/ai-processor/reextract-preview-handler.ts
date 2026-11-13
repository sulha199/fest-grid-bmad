import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { jobs, posts } from '@festgrid/database';
import {
  REEXTRACT_PHASE_PREVIEW,
  decideReextractEnding,
  parseReextractPostInput,
  readHeldPost,
  type JobHandler,
  type JobHandlerContext,
  type JobHandlerResult,
} from '@festgrid/domain/jobs';
import type { ProcessingJobMessage, ReextractRefreshReport } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import type { callGemini as defaultCallGemini } from '../ai-gateway/adapter.js';
import { blankHeldPost } from '../extraction/held-post.js';
import { ExtractionFailure } from './extract-events-with-gemini.js';
import { generateReextractionPreview } from './generate-reextraction-preview.js';
import { callGeminiForManualExtractionSeam } from './process-manual-extraction-job.js';

// Story 10.6 (AC6; AD-53 Rules 8 and 17; AD-40) -- phase 2 of the moderator re-extract job, run in the AI-PROCESSOR Lambda (the only one
// with the image-processing runtime) after the Scraper Lambda handed the job off. It resumes from the stored phase and runs the same
// preview code the manual job runs, on a post that is stored (its caption read from `posts.content` in memory, or, for a post whose
// caption is not stored, the post held on the job by phase 1) or on a URL that is not in the database (the held post alone). It ends
// the job with the preview on `result_data` (plus the refresh report phase 1 left there). A held post is blanked in `finally`
// whatever happens here (success, an expected failure, an unexpected throw): see `held-post.ts`. The caption is never written to the
// result, the job's messages or a log.

const NO_CAPTION_MESSAGE = 'This post has no stored caption to extract from.';

/** What phase 1 left on the job row; a job with none (never expected) is treated as "no refresh was needed". */
function readRefreshReport(resultData: unknown): ReextractRefreshReport {
  const refresh = (resultData as { refresh?: ReextractRefreshReport } | null)?.refresh;
  return refresh ?? { outcome: 'NOT_NEEDED', reasons: [], saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 0 };
}

export const reextractPreviewHandler: JobHandler = {
  async run(ctx: JobHandlerContext): Promise<JobHandlerResult> {
    try {
      return await runPreview(ctx);
    } finally {
      await blankHeldPost(ctx.jobId);
    }
  },
};

async function runPreview(ctx: JobHandlerContext): Promise<JobHandlerResult> {
    if (ctx.phase !== REEXTRACT_PHASE_PREVIEW) {
      // This Lambda only knows phase 2; a job that reaches it earlier was misrouted. Plain failure, the moderator can retry.
      console.error(`[reextract-preview] job ${ctx.jobId} reached the AI-processor in phase ${ctx.phase ?? 'none'}, not ${REEXTRACT_PHASE_PREVIEW}`);
      return { outcome: 'FAILED', reasonCode: 'HANDLER_ERROR', errorMessage: 'The job reached the preview step out of order.' };
    }
    const input = parseReextractPostInput(ctx.input);
    const [job] = await db.select({ ownerUserId: jobs.ownerUserId, resultData: jobs.resultData, input: jobs.input }).from(jobs).where(eq(jobs.id, ctx.jobId));
    if (!input || !job?.ownerUserId) {
      console.error(`[reextract-preview] job ${ctx.jobId}: its input or its owner is missing`);
      return { outcome: 'FAILED', reasonCode: 'HANDLER_ERROR', errorMessage: 'The job could not read its input.' };
    }
    // Story 10.6a: every ending of this phase keeps what phase 1 reported, so the banner of a failed preview can still say what the refresh did
    // (the engine writes a handler's `resultData`, or null, over the row's).
    const report = readRefreshReport(job.resultData);
    const keepReport = { refresh: report };
    // Read from the row, not from `ctx.input`: phase 1 held the post AFTER this job was claimed the first time.
    const held = readHeldPost(job.input);
    let post: typeof posts.$inferSelect | undefined;
    if ('postId' in input) {
      [post] = await db.select().from(posts).where(eq(posts.id, input.postId)).limit(1);
      if (!post) {
        return { outcome: 'FAILED', reasonCode: 'POST_NOT_FOUND', errorMessage: 'Post not found.', resultData: keepReport };
      }
    }
    // The caption: the stored one, else the held one (an image-only post's is an empty string, which is a caption).
    const caption = post?.content ? post.content : held?.content;
    if (caption === undefined || (!post && !held)) {
      // A caption that was cleared since the start, or one phase 1 could not hold: nothing to extract from.
      return { outcome: 'FAILED', reasonCode: 'EXTRACTION_FAILED', errorMessage: NO_CAPTION_MESSAGE, resultData: keepReport };
    }

    // `satisfies`, not an annotated literal: these are preview messages read in memory, never an enqueue path (the sites of
    // enqueue-post-for-processing.test.ts, Story 3.6z, guard the enqueue path; this one is listed there by name).
    const message = post
      ? ({
          postId: post.id,
          accountId: post.accountId,
          content: caption,
          imageUrl: post.imageUrl ?? undefined,
          postUrl: post.postUrl,
          publishedAt: post.publishedAt.toISOString(),
          ownerDisplayName: post.ownerDisplayName ?? undefined,
          ownerUsername: post.ownerUsername ?? undefined,
          additionalImageUrls: post.additionalImageUrls ?? undefined,
        } satisfies ProcessingJobMessage)
      : ({
          postId: randomUUID(),
          accountId: '',
          content: caption,
          imageUrl: held!.imageUrl,
          postUrl: held!.postUrl,
          publishedAt: held!.publishedAt,
          ownerDisplayName: held!.ownerDisplayName,
          ownerUsername: held!.ownerUsername,
          additionalImageUrls: held!.additionalImageUrls,
        } satisfies ProcessingJobMessage);
    // The seam is read at call time (a thunk), so a test can swap it between runs.
    const callGemini: typeof defaultCallGemini = (request) => callGeminiForManualExtractionSeam(request);

    let preview;
    try {
      preview = await generateReextractionPreview({
        message,
        existingPostAccountId: post?.accountId,
        requestedByUserId: job.ownerUserId,
        postStored: post !== undefined,
        rescraped: report.outcome === 'REFRESHED',
        getRemainingTimeInMillis: ctx.getRemainingTimeInMillis,
        callGemini,
      });
    } catch (error) {
      if (error instanceof ExtractionFailure) {
        return { outcome: 'FAILED', reasonCode: error.errorCode, errorMessage: error.message, resultData: keepReport };
      }
      // Unexpected: the engine logs what is thrown and ends the job FAILED / HANDLER_ERROR with a fixed message. The raw error could carry
      // the request (and so the caption), so only its name travels (nothing of a held caption may reach a log).
      throw new Error(`The re-extract preview failed unexpectedly (${error instanceof Error ? error.name : 'error'})`);
    }

    const ending = decideReextractEnding(report);
    return {
      outcome: ending.outcome,
      reasonCode: ending.reasonCode,
      errorMessage: ending.message,
      resultData: { ...preview, refresh: report },
    };
}
