import { eq } from 'drizzle-orm';
import { jobs, posts } from '@festgrid/database';
import { REEXTRACT_PHASE_PREVIEW, decideReextractEnding, parseReextractPostInput, type JobHandler, type JobHandlerContext, type JobHandlerResult } from '@festgrid/domain/jobs';
import type { ProcessingJobMessage, ReextractRefreshReport } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import type { callGemini as defaultCallGemini } from '../ai-gateway/adapter.js';
import { ExtractionFailure } from './extract-events-with-gemini.js';
import { generateReextractionPreview } from './generate-reextraction-preview.js';
import { callGeminiForManualExtractionSeam } from './process-manual-extraction-job.js';

// Story 10.6 (AC6; AD-53 Rules 8 and 17; AD-40) -- phase 2 of the moderator re-extract job, run in the AI-PROCESSOR Lambda (the only one
// with the image-processing runtime) after the Scraper Lambda handed the job off. It resumes from the stored phase, reads the post's
// stored caption and its (now refreshed) image links, runs the same preview code the manual job runs, and ends the job with the preview
// on `result_data` (plus the refresh report phase 1 left there). The caption is read from `posts.content` in memory only: it is never
// written to the job, to the result or to a log.

const NO_CAPTION_MESSAGE = 'This post has no stored caption to extract from.';

/** What phase 1 left on the job row; a job with none (never expected) is treated as "no refresh was needed". */
function readRefreshReport(resultData: unknown): ReextractRefreshReport {
  const refresh = (resultData as { refresh?: ReextractRefreshReport } | null)?.refresh;
  return refresh ?? { outcome: 'NOT_NEEDED', reasons: [], saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 0 };
}

export const reextractPreviewHandler: JobHandler = {
  async run(ctx: JobHandlerContext): Promise<JobHandlerResult> {
    if (ctx.phase !== REEXTRACT_PHASE_PREVIEW) {
      // This Lambda only knows phase 2; a job that reaches it earlier was misrouted. Plain failure, the moderator can retry.
      console.error(`[reextract-preview] job ${ctx.jobId} reached the AI-processor in phase ${ctx.phase ?? 'none'}, not ${REEXTRACT_PHASE_PREVIEW}`);
      return { outcome: 'FAILED', reasonCode: 'HANDLER_ERROR', errorMessage: 'The job reached the preview step out of order.' };
    }
    const input = parseReextractPostInput(ctx.input);
    const [job] = await db.select({ ownerUserId: jobs.ownerUserId, resultData: jobs.resultData }).from(jobs).where(eq(jobs.id, ctx.jobId));
    if (!input || !job?.ownerUserId) {
      console.error(`[reextract-preview] job ${ctx.jobId}: its input or its owner is missing`);
      return { outcome: 'FAILED', reasonCode: 'HANDLER_ERROR', errorMessage: 'The job could not read its input.' };
    }
    const [post] = await db.select().from(posts).where(eq(posts.id, input.postId)).limit(1);
    if (!post) {
      return { outcome: 'FAILED', reasonCode: 'POST_NOT_FOUND', errorMessage: 'Post not found.' };
    }
    if (!post.content) {
      // A curator post's caption is cleared once extracted (Story 3.4o); the start refuses such a post, but it may have been cleared since.
      return { outcome: 'FAILED', reasonCode: 'EXTRACTION_FAILED', errorMessage: NO_CAPTION_MESSAGE };
    }

    const report = readRefreshReport(job.resultData);
    // `satisfies`, not an annotated literal: this is a preview message read in memory, never an enqueue path (the one
    // ProcessingJobMessage-building site of enqueue-post-for-processing.test.ts guards the enqueue path, Story 3.6z).
    const message = {
      postId: post.id,
      accountId: post.accountId,
      content: post.content,
      imageUrl: post.imageUrl ?? undefined,
      postUrl: post.postUrl,
      publishedAt: post.publishedAt.toISOString(),
      ownerDisplayName: post.ownerDisplayName ?? undefined,
      ownerUsername: post.ownerUsername ?? undefined,
      additionalImageUrls: post.additionalImageUrls ?? undefined,
    } satisfies ProcessingJobMessage;
    // The seam is read at call time (a thunk), so a test can swap it between runs.
    const callGemini: typeof defaultCallGemini = (request) => callGeminiForManualExtractionSeam(request);

    let preview;
    try {
      preview = await generateReextractionPreview({
        message,
        existingPostAccountId: post.accountId,
        requestedByUserId: job.ownerUserId,
        postStored: true,
        rescraped: report.outcome === 'REFRESHED',
        getRemainingTimeInMillis: ctx.getRemainingTimeInMillis,
        callGemini,
      });
    } catch (error) {
      if (error instanceof ExtractionFailure) {
        return { outcome: 'FAILED', reasonCode: error.errorCode, errorMessage: error.message };
      }
      throw error; // logged by the engine; the job ends FAILED / HANDLER_ERROR with a fixed message
    }

    const ending = decideReextractEnding(report);
    return {
      outcome: ending.outcome,
      reasonCode: ending.reasonCode,
      errorMessage: ending.message,
      resultData: { ...preview, refresh: report },
    };
  },
};
