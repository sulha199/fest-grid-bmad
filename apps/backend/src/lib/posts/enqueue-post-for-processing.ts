import { db } from "../../db/client.js";
import { posts } from "@festgrid/database";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { loadBackendEnv } from "../../env.js";
import { sendSqsMessage } from "../aws/send-sqs-message.js";
import {
  PostNotFoundError,
  PostAlreadyExtractedError,
  PostAlreadyQueuedError,
  computeClaimCutoff,
  type ProcessingJobMessage,
} from "@festgrid/domain/posts";

/**
 * Story 3.6z (AC3) — rewritten as an atomic, TTL-bounded claim so the same post is never
 * enqueued twice while a prior attempt is still in flight (closing the Story 3.5 accepted gap
 * now that two independent callers exist: manual `selectPostsForExtraction` and this story's
 * auto-enqueue). See the story's Dev Notes "Design note: why the claim needs a TTL, not just a
 * boolean" for why a non-expiring claim would be strictly worse than the gap it replaces.
 */
export async function enqueuePostForProcessing(postId: string): Promise<void> {
  const env = loadBackendEnv();
  const now = new Date();
  const cutoff = computeClaimCutoff(env.postExtractionClaimTtlMinutes, now);

  // One atomic claim: only succeeds if the post is not yet extracted and has no non-stale
  // claim already in flight. Mirrors the existing conditional-update-and-.returning() idiom
  // already used by mark-post-extracted.ts/set-event-primary-post.ts in this codebase.
  const [claimedPost] = await db
    .update(posts)
    .set({ queuedForExtractionAt: now })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.isExtracted, false),
        // Unclaimed, or claimed but past its TTL (reclaimable).
        or(isNull(posts.queuedForExtractionAt), lt(posts.queuedForExtractionAt, cutoff))
      )
    )
    .returning();

  let post = claimedPost;

  if (!post) {
    // The claim didn't land -- run a follow-up SELECT to distinguish why.
    const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

    if (!existing) {
      throw new PostNotFoundError();
    }
    if (existing.isExtracted) {
      throw new PostAlreadyExtractedError();
    }
    // Otherwise: a non-stale existing claim is already in flight.
    throw new PostAlreadyQueuedError();
  }

  const message: ProcessingJobMessage = {
    postId: post.id,
    accountId: post.accountId,
    content: post.content ?? '',
    imageUrl: post.imageUrl ?? undefined,
    postUrl: post.postUrl,
    publishedAt: post.publishedAt.toISOString(),
    ownerDisplayName: post.ownerDisplayName ?? undefined,
    ownerUsername: post.ownerUsername ?? undefined,
    additionalImageUrls: post.additionalImageUrls ?? undefined,
  };

  try {
    if (env.aiProcessingQueueUrl) {
      await sendSqsMessage(env.aiProcessingQueueUrl, JSON.stringify(message));
      return;
    }

    if (env.aiProcessingInlineFallbackEnabled) {
      // No queue configured and inline fallback explicitly opted into (local dev only,
      // via AI_PROCESSING_INLINE_FALLBACK_ENABLED in a personal .env): process the AI job
      // inline instead of enqueuing, since there's no Lambda locally to drain the queue.
      // Fire-and-forget, mirroring the async nature of the queue path and the equivalent
      // scrape inline fallback in trigger-scrape-for-account.ts.
      //
      // `processAiJob` is imported dynamically, ONLY here, deliberately -- 2026-10-04 prod
      // incident: a static top-level import of process-ai-job.js pulls in its own static
      // imports of detect-and-blur-faces.ts/upload-face-blur-thumbnail.ts, which `require`
      // sharp/@tensorflow/tfjs/@vladmandic/face-api at module load. apiLambda/scraperLambda
      // bundle that JS but never get sharp's native binary (only aiProcessorLambda does), so a
      // static import here crashed BOTH Lambdas at cold start the instant this branch's module
      // was reachable -- regardless of whether this branch ever ran, since `env.aiProcessingQueueUrl`
      // is always set in prod. Deferring to a dynamic import means the `require` only happens if
      // this branch actually executes, which it never does in prod (see Architecture Spine /
      // festgrid-backend-stack.ts's `externalModules` for the matching bundling-side half of
      // this fix).
      import("../ai-processor/process-ai-job.js")
        .then(({ processAiJob }) => processAiJob(message))
        .catch((err) => {
          console.error(`Failed to process AI job inline for post ${post.id}:`, err);
        });
      return;
    }

    throw new Error("AI_PROCESSING_QUEUE_URL is not configured");
  } catch (err) {
    // A send-time failure (SQS error, or "queue not configured") is not a legitimate
    // in-flight Gemini attempt -- release the claim before rethrowing so it doesn't hold
    // the full TTL window for nothing. A failure *after* a successful send (inside
    // processAiJob's own later Gemini-call/validation logic) deliberately does NOT go
    // through this catch -- that class of failure legitimately holds the claim until the
    // TTL expires or markPostExtracted flips isExtracted (see Dev Notes).
    await db.update(posts).set({ queuedForExtractionAt: null }).where(eq(posts.id, postId));
    throw err;
  }
}
