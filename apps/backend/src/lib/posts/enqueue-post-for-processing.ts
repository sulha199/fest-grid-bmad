import { db } from "../../db/client.js";
import { posts } from "@festgrid/database";
import { eq } from "drizzle-orm";
import { loadBackendEnv } from "../../env.js";
import { sendSqsMessage } from "../aws/send-sqs-message.js";
import { processAiJob } from "../ai-processor/process-ai-job.js";
import { PostNotFoundError, PostAlreadyExtractedError, type ProcessingJobMessage } from "@festgrid/domain/posts";

export async function enqueuePostForProcessing(postId: string): Promise<void> {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) {
    throw new PostNotFoundError();
  }

  if (post.isExtracted) {
    throw new PostAlreadyExtractedError();
  }

  const env = loadBackendEnv();

  const message: ProcessingJobMessage = {
    postId: post.id,
    accountId: post.accountId,
    content: post.content,
    imageUrl: post.imageUrl ?? undefined,
    postUrl: post.postUrl,
    publishedAt: post.publishedAt.toISOString(),
  };

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
    processAiJob(message).catch((err) => {
      console.error(`Failed to process AI job inline for post ${post.id}:`, err);
    });
    return;
  }

  throw new Error("AI_PROCESSING_QUEUE_URL is not configured");
}
