import { db } from "../../db/client.js";
import { posts } from "@festgrid/database";
import { eq } from "drizzle-orm";
import { loadBackendEnv } from "../../env.js";
import { sendSqsMessage } from "../aws/send-sqs-message.js";
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
  if (!env.aiProcessingQueueUrl) {
    throw new Error("AI_PROCESSING_QUEUE_URL is not configured");
  }

  const message: ProcessingJobMessage = {
    postId: post.id,
    accountId: post.accountId,
    content: post.content,
    imageUrl: post.imageUrl ?? undefined,
    postUrl: post.postUrl,
    publishedAt: post.publishedAt.toISOString(),
  };

  await sendSqsMessage(env.aiProcessingQueueUrl, JSON.stringify(message));
}
