import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { rehostPostImage, setS3ClientInstance } from './rehost-post-image.js';
import { type BackendEnv } from '../../env.js';

test('rehostPostImage integration/unit tests', async (t) => {
  // Setup a test profile and a test post
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'test_acc_rehost_' + Date.now(),
      platform: 'instagram',
      username: 'test.rehost',
      displayName: 'Test Rehost',
    })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Rehost test caption',
      postUrl: 'https://instagram.com/p/test_rehost_' + Date.now(),
      publishedAt: new Date(),
    })
    .returning();

  t.after(async () => {
    // Cleanup database rows
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  const mockEnv: BackendEnv = {
    port: 4000,
    postMediaBucketName: 'test-bucket',
    postMediaCdnDomain: 'cdn.test.com',
    geminiModel: 'gemini-3.5-flash-lite',
    apiKeyInvalidAttemptsThreshold: 5,
    apiKeyUsageCycleDays: 30,
    webAppBaseUrl: 'http://localhost:3000',
    locationInferenceConfidenceThreshold: 0.5,
    scrapeResultsLimit: 10,
    scrapeInitialLookbackDays: 7,
    scrapeSkipRecentHours: 20,
    scraperMonthlyBudgetUsd: 5.0,
    scraperPricePerThousandItemsUsd: 2.7,
    scraperCapacityThresholdRatio: 0.9,
    scraperUsageCycleDays: 30,
    queueNotificationThresholdDays: 3,
    queueNotificationThresholdCount: 3,
    queueNotificationCooldownDays: 7,
    scrapeInlineFallbackEnabled: false,
    aiProcessingInlineFallbackEnabled: false,
    dataIngestionInlineFallbackEnabled: false,
  };

  await t.test('Case A: happy path (successful upload and database update)', async () => {
    let sentCommand: any = null;

    setS3ClientInstance({
      send: async (command: any) => {
        sentCommand = command;
        return { ETag: '"test-etag"' };
      },
    } as any);

    const imageBytes = Buffer.from('my-image-data');
    const imageContentType = 'image/png';

    const result = await rehostPostImage(post.id, imageBytes, imageContentType, mockEnv);

    assert.strictEqual(result, `https://${mockEnv.postMediaCdnDomain}/posts/${post.id}`);
    assert.ok(sentCommand);
    assert.strictEqual(sentCommand.input.Bucket, mockEnv.postMediaBucketName);
    assert.strictEqual(sentCommand.input.Key, `posts/${post.id}`);
    assert.deepEqual(sentCommand.input.Body, imageBytes);
    assert.strictEqual(sentCommand.input.ContentType, imageContentType);

    // Verify it was updated in the database
    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableImageUrl, result);
  });

  await t.test('Case B: S3 upload rejection (non-throwing, logs error, returns null)', async () => {
    // Reset database column first
    await db.update(posts).set({ durableImageUrl: null }).where(eq(posts.id, post.id));

    setS3ClientInstance({
      send: async () => {
        throw new Error('S3 error');
      },
    } as any);

    const result = await rehostPostImage(post.id, Buffer.from(''), 'image/jpeg', mockEnv);

    assert.strictEqual(result, null);

    // Verify durableImageUrl remains null in the database
    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableImageUrl, null);
  });

  await t.test('Case C: missing configuration (skipped, returns null)', async () => {
    const incompleteEnv = { ...mockEnv, postMediaBucketName: undefined };

    const result = await rehostPostImage(post.id, Buffer.from(''), 'image/jpeg', incompleteEnv);

    assert.strictEqual(result, null);
  });
});
