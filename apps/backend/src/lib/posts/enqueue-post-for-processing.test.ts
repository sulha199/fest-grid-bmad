import test from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "../../db/client.js";
import { posts, socialMediaAccountProfiles } from "@festgrid/database";
import { eq } from "drizzle-orm";
import { setSendSqsMessage, sendSqsMessage } from "../aws/send-sqs-message.js";
import { enqueuePostForProcessing } from "./enqueue-post-for-processing.js";
import { PostNotFoundError, PostAlreadyExtractedError, PostAlreadyQueuedError } from "@festgrid/domain/posts";

test("enqueuePostForProcessing integration tests", async (t) => {
  const originalSendSqsMessage = sendSqsMessage;
  t.after(() => {
    setSendSqsMessage(originalSendSqsMessage);
  });
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
        platform: 'instagram',
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
        platform: 'instagram',
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

  await t.test("(d) a post with additionalImageUrls populated produces a message carrying the same array (AC4)", async () => {
    let sentBody = "";
    setSendSqsMessage(async (_queueUrl, body) => {
      sentBody = body;
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const carouselImageUrls = ["https://test.com/slide2.jpg", "https://test.com/slide3.jpg"];

    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: "Carousel event post content",
        imageUrl: "https://test.com/cover.jpg",
        postUrl: "https://instagram.com/p/test_enqueue_carousel_" + Date.now(),
        publishedAt: new Date(),
        isExtracted: false,
        additionalImageUrls: carouselImageUrls,
      })
      .returning();

    await enqueuePostForProcessing(post.id);

    const parsed = JSON.parse(sentBody);
    assert.deepStrictEqual(parsed.additionalImageUrls, carouselImageUrls);
  });

  await t.test("(e) a post with additionalImageUrls null produces a message where the field is undefined (not null)", async () => {
    let sentBody = "";
    setSendSqsMessage(async (_queueUrl, body) => {
      sentBody = body;
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: "Single image post content",
        postUrl: "https://instagram.com/p/test_enqueue_plain_" + Date.now(),
        publishedAt: new Date(),
        isExtracted: false,
      })
      .returning();

    await enqueuePostForProcessing(post.id);

    const parsed = JSON.parse(sentBody);
    assert.strictEqual(parsed.additionalImageUrls, undefined);
  });

  await t.test("(f) already-queued non-stale claim: rejects with PostAlreadyQueuedError, zero SQS sends", async () => {
    let callCount = 0;
    setSendSqsMessage(async () => {
      callCount++;
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: "Already-queued post content",
        postUrl: "https://instagram.com/p/test_already_queued_" + Date.now(),
        publishedAt: new Date(),
        isExtracted: false,
        queuedForExtractionAt: new Date(), // claimed just now -- well within the default 30-minute TTL
      })
      .returning();

    await assert.rejects(
      enqueuePostForProcessing(post.id),
      (err: Error) => {
        assert.ok(err instanceof PostAlreadyQueuedError);
        return true;
      }
    );

    assert.strictEqual(callCount, 0);
  });

  await t.test("(g) a stale claim (older than the TTL) succeeds, re-claims with a new timestamp, one SQS send", async () => {
    let sentBody = "";
    let callCount = 0;
    setSendSqsMessage(async (_queueUrl, body) => {
      callCount++;
      sentBody = body;
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const staleClaimedAt = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago, past the default 30-minute TTL

    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: "Stale-claim post content",
        postUrl: "https://instagram.com/p/test_stale_claim_" + Date.now(),
        publishedAt: new Date(),
        isExtracted: false,
        queuedForExtractionAt: staleClaimedAt,
      })
      .returning();

    await enqueuePostForProcessing(post.id);

    assert.strictEqual(callCount, 1);
    const parsed = JSON.parse(sentBody);
    assert.strictEqual(parsed.postId, post.id);

    const [reloaded] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.ok(reloaded.queuedForExtractionAt);
    assert.ok(reloaded.queuedForExtractionAt!.getTime() > staleClaimedAt.getTime(), "claim timestamp should be refreshed to now");
  });

  await t.test("(h) an SQS send failure releases the claim (queuedForExtractionAt back to null) and the original error propagates", async () => {
    setSendSqsMessage(async () => {
      throw new Error("Simulated SQS send failure");
    });

    process.env.AI_PROCESSING_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue";

    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: "Send-failure post content",
        postUrl: "https://instagram.com/p/test_send_failure_" + Date.now(),
        publishedAt: new Date(),
        isExtracted: false,
      })
      .returning();

    await assert.rejects(
      enqueuePostForProcessing(post.id),
      (err: Error) => {
        assert.strictEqual(err.message, "Simulated SQS send failure");
        return true;
      }
    );

    const [reloaded] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(reloaded.queuedForExtractionAt, null, "claim should be released on send failure");
  });

  await t.test("(i) Story 3.6z (AC2/Task 10): the manual path (resolvers.ts) and the auto-enqueue path (process-scrape-job.ts) both call this exact enqueuePostForProcessing -- no second, parallel message-building/enqueue function exists", async () => {
    // Static-source checks rather than a runtime double-call: both call sites are proven to
    // import from this exact module, and this module is the only place in apps/backend that
    // constructs a ProcessingJobMessage -- which is what makes AC2's "multi-event/roundup
    // rules and CURATOR_GUIDE minimization apply unchanged to auto-extracted posts" true by
    // construction rather than by assertion alone.
    const resolversSource = fs.readFileSync(path.resolve(__dirname, "../../schema/resolvers.ts"), "utf8");
    assert.match(
      resolversSource,
      /import\s*\{\s*enqueuePostForProcessing\s*\}\s*from\s*['"]\.\.\/lib\/posts\/enqueue-post-for-processing\.js['"]/,
      "resolvers.ts (manual selectPostsForExtraction path) must import enqueuePostForProcessing from this module"
    );

    const scrapeJobSource = fs.readFileSync(path.resolve(__dirname, "../scraper/process-scrape-job.ts"), "utf8");
    assert.match(
      scrapeJobSource,
      /import\s*\{\s*enqueuePostForProcessing\s*\}\s*from\s*['"]\.\.\/posts\/enqueue-post-for-processing\.js['"]/,
      "process-scrape-job.ts (auto-enqueue path) must import enqueuePostForProcessing from this module"
    );

    // Confirm no second site anywhere in apps/backend builds its own ProcessingJobMessage
    // object (which would mean a second, parallel enqueue/message-building path exists).
    const backendSrcRoot = path.resolve(__dirname, "../..");
    function findTsFiles(dir: string): string[] {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return findTsFiles(fullPath);
        if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) return [fullPath];
        return [];
      });
    }
    const messageBuilderSites = findTsFiles(backendSrcRoot).filter((file) =>
      fs.readFileSync(file, "utf8").includes("ProcessingJobMessage = {")
    );
    assert.deepStrictEqual(
      messageBuilderSites,
      [path.resolve(__dirname, "enqueue-post-for-processing.ts")],
      "exactly one ProcessingJobMessage-building site should exist (this file) -- a second site would mean a parallel enqueue path"
    );
  });
});
