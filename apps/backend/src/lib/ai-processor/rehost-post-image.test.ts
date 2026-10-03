import test from 'node:test';
import * as assert from 'node:assert';
import { createHash } from 'node:crypto';
import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  rehostPostImage,
  setS3ClientInstance,
  s3ClientInstance,
  setCloudFrontClientInstance,
  cloudFrontClientInstance,
} from './rehost-post-image.js';
import { type BackendEnv } from '../../env.js';

function hash8Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 8);
}

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

  const originalS3ClientInstance = s3ClientInstance;
  const originalCloudFrontClientInstance = cloudFrontClientInstance;
  t.after(async () => {
    // Cleanup database rows
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    setS3ClientInstance(originalS3ClientInstance);
    setCloudFrontClientInstance(originalCloudFrontClientInstance);
  });

  const mockEnv: BackendEnv = {
    port: 4000,
    postMediaBucketName: 'test-bucket',
    postMediaCdnDomain: 'cdn.test.com',
    postMediaDistributionId: 'TESTDISTID',
    geminiModel: 'gemini-3.5-flash-lite',
    apiKeyInvalidAttemptsThreshold: 5,
    geminiPostsPerKeyPerCycle: 300,
    apiKeyUsageCycleDays: 30,
    webAppBaseUrl: 'http://localhost:3000',
    locationInferenceConfidenceThreshold: 0.5,
    scrapeResultsLimit: 10,
    maxCarouselImages: 5,
    maxExtractedEventsPerPost: 10,
    geminiMaxOutputTokens: 8192,
    geminiExtractionTimeoutMs: 120000,
    scrapeInitialLookbackDays: 7,
    scrapeSkipRecentHours: 20,
    scraperMonthlyBudgetUsd: 5.0,
    scraperPricePerThousandItemsUsd: 2.7,
    scraperCapacityThresholdRatio: 0.9,
    scraperUsageCycleDays: 30,
    queueNotificationThresholdDays: 3,
    queueNotificationThresholdCount: 3,
    queueNotificationCooldownDays: 7,
    scraperProviderAlertThresholdDays: 2,
    scraperProviderAlertCooldownDays: 3,
    scrapeInlineFallbackEnabled: false,
    aiProcessingInlineFallbackEnabled: false,
    dataIngestionInlineFallbackEnabled: false,
    postExtractionClaimTtlMinutes: 30,
    accountClassificationClaimTtlMinutes: 30,
    faceBlurMinRemainingTimeMs: 60000,
  };

  await t.test('Case A: happy path - first upload with no prior durableImageUrl', async () => {
    let sentCommand: any = null;
    let deleteCalled = false;
    let invalidateCalled = false;

    setS3ClientInstance({
      send: async (command: any) => {
        if (command.constructor.name === 'DeleteObjectCommand') {
          deleteCalled = true;
        } else {
          sentCommand = command;
        }
        return { ETag: '"test-etag"' };
      },
    } as any);
    setCloudFrontClientInstance({
      send: async () => {
        invalidateCalled = true;
        return {};
      },
    } as any);

    const imageBytes = Buffer.from('my-image-data');
    const imageContentType = 'image/png';
    const expectedHash8 = hash8Of(imageBytes);
    const expectedKey = `posts/${post.id}/full-${expectedHash8}.png`;

    const result = await rehostPostImage(post.id, imageBytes, imageContentType, mockEnv);

    assert.strictEqual(result, `https://${mockEnv.postMediaCdnDomain}/${expectedKey}`);
    assert.ok(sentCommand);
    assert.strictEqual(sentCommand.input.Bucket, mockEnv.postMediaBucketName);
    assert.strictEqual(sentCommand.input.Key, expectedKey);
    assert.deepEqual(sentCommand.input.Body, imageBytes);
    assert.strictEqual(sentCommand.input.ContentType, imageContentType);
    assert.strictEqual(deleteCalled, false);
    assert.strictEqual(invalidateCalled, false);

    // Verify it was updated in the database
    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableImageUrl, result);
  });

  await t.test('Case B: replace with different content deletes/invalidates the old key, tolerating failure', async () => {
    let deletedKey: string | null = null;
    let invalidatedPaths: string[] | null = null;

    setS3ClientInstance({
      send: async (command: any) => {
        if (command.constructor.name === 'DeleteObjectCommand') {
          deletedKey = command.input.Key;
          throw new Error('simulated delete failure'); // must not affect return value
        }
        return { ETag: '"test-etag"' };
      },
    } as any);
    setCloudFrontClientInstance({
      send: async (command: any) => {
        invalidatedPaths = command.input.InvalidationBatch.Paths.Items;
        return {};
      },
    } as any);

    const newBytes = Buffer.from('different-image-data');
    const result = await rehostPostImage(post.id, newBytes, 'image/jpeg', mockEnv);

    const newHash8 = hash8Of(newBytes);
    const newKey = `posts/${post.id}/full-${newHash8}.jpg`;
    assert.strictEqual(result, `https://${mockEnv.postMediaCdnDomain}/${newKey}`);

    const oldHash8 = hash8Of(Buffer.from('my-image-data'));
    const oldKey = `posts/${post.id}/full-${oldHash8}.png`;
    assert.strictEqual(deletedKey, oldKey);
    assert.ok(invalidatedPaths);
    assert.deepEqual(invalidatedPaths, [`/${oldKey}`]);

    // Return value unaffected by the mocked delete rejection
    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableImageUrl, result);
  });

  await t.test('Case C: replace with identical content is a true no-op (no delete/invalidate calls)', async () => {
    let deleteOrInvalidateCalled = false;

    setS3ClientInstance({
      send: async (command: any) => {
        if (command.constructor.name === 'DeleteObjectCommand') {
          deleteOrInvalidateCalled = true;
        }
        return { ETag: '"test-etag"' };
      },
    } as any);
    setCloudFrontClientInstance({
      send: async () => {
        deleteOrInvalidateCalled = true;
        return {};
      },
    } as any);

    const sameBytes = Buffer.from('different-image-data'); // same bytes as Case B's new upload
    const result = await rehostPostImage(post.id, sameBytes, 'image/jpeg', mockEnv);

    const hash8 = hash8Of(sameBytes);
    const key = `posts/${post.id}/full-${hash8}.jpg`;
    assert.strictEqual(result, `https://${mockEnv.postMediaCdnDomain}/${key}`);
    assert.strictEqual(deleteOrInvalidateCalled, false);
  });

  await t.test('Case D: S3 upload rejection (non-throwing, logs error, returns null)', async () => {
    // Reset database column first
    await db.update(posts).set({ durableImageUrl: null }).where(eq(posts.id, post.id));

    setS3ClientInstance({
      send: async (command: any) => {
        if (command.constructor.name === 'DeleteObjectCommand') return {};
        throw new Error('S3 error');
      },
    } as any);
    setCloudFrontClientInstance({
      send: async () => ({}),
    } as any);

    const result = await rehostPostImage(post.id, Buffer.from(''), 'image/jpeg', mockEnv);

    assert.strictEqual(result, null);

    // Verify durableImageUrl remains null in the database
    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableImageUrl, null);
  });

  await t.test('Case E: missing configuration (skipped, returns null)', async () => {
    const incompleteEnv = { ...mockEnv, postMediaBucketName: undefined };

    const result = await rehostPostImage(post.id, Buffer.from(''), 'image/jpeg', incompleteEnv);

    assert.strictEqual(result, null);
  });
});
