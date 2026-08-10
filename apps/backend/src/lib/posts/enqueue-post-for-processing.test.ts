import test from "node:test";
import * as assert from "node:assert";
import { db } from "../../db/client.js";
import { posts, socialMediaAccountProfiles } from "@festgrid/database";
import { setSendSqsMessage } from "../aws/send-sqs-message.js";
import { enqueuePostForProcessing } from "./enqueue-post-for-processing.js";
import { PostNotFoundError, PostAlreadyExtractedError } from "@festgrid/domain/posts";

test("enqueuePostForProcessing integration tests", async (t) => {
  // Setup a test profile
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: "test_acc_enqueue_" + Date.now(),
      platform: "instagram",
      username: "test.enqueue",
      displayName: "Test Enqueue",
    })
    .returning();

  await t.test("(a) Happy path: enqueues an unextracted post and sends SQS message", async () => {
    let sentQueueUrl = "";
    let sentBody = "";

    setSendSqsMessage(async (queueUrl, body) => {
      sentQueueUrl = queueUrl;
      sentBody = body;
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        content: "Test event post content",
        imageUrl: "https://test.com/image.png",
        postUrl: "https://instagram.com/p/test_enqueue_" + Date.now(),
        publishedAt: new Date(),
        isExtracted: false,
      })
      .returning();

    await enqueuePostForProcessing(post.id);

    assert.strictEqual(sentQueueUrl, "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue");
    
    const parsed = JSON.parse(sentBody);
    assert.strictEqual(parsed.postId, post.id);
    assert.strictEqual(parsed.accountId, post.accountId);
    assert.strictEqual(parsed.content, "Test event post content");
    assert.strictEqual(parsed.imageUrl, "https://test.com/image.png");
    assert.strictEqual(parsed.postUrl, post.postUrl);
    assert.strictEqual(parsed.publishedAt, post.publishedAt.toISOString());
  });

  await t.test("(b) Not-found: throws PostNotFoundError when postId does not exist", async () => {
    let callCount = 0;
    setSendSqsMessage(async () => {
      callCount++;
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    await assert.rejects(
      enqueuePostForProcessing(nonExistentId),
      (err: Error) => {
        assert.ok(err instanceof PostNotFoundError);
        return true;
      }
    );

    assert.strictEqual(callCount, 0);
  });

  await t.test("(c) Already-extracted: throws PostAlreadyExtractedError when isExtracted is true", async () => {
    let callCount = 0;
    setSendSqsMessage(async () => {
      callCount++;
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        content: "Already extracted event post content",
        imageUrl: "https://test.com/image.png",
        postUrl: "https://instagram.com/p/test_already_extracted_" + Date.now(),
        publishedAt: new Date(),
        isExtracted: true,
      })
      .returning();

    await assert.rejects(
      enqueuePostForProcessing(post.id),
      (err: Error) => {
        assert.ok(err instanceof PostAlreadyExtractedError);
        return true;
      }
    );

    assert.strictEqual(callCount, 0);
  });
});
