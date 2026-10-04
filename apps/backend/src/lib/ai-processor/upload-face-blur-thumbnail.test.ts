import test from 'node:test';
import * as assert from 'node:assert';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { uploadFaceBlurThumbnail } from './upload-face-blur-thumbnail.js';
import { setS3ClientInstance, s3ClientInstance, setCloudFrontClientInstance, cloudFrontClientInstance } from './rehost-post-image.js';
import { type BackendEnv } from '../../env.js';

async function hash8OfResizedJpeg(bytes: Buffer): Promise<string> {
  const resized = await sharp(bytes).resize(480, 480, { fit: 'cover', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return createHash('sha256').update(resized).digest('hex').slice(0, 8);
}

test('uploadFaceBlurThumbnail integration/unit tests', async (t) => {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'test_acc_thumb_' + Date.now(),
      platform: 'instagram',
      username: 'test.thumb',
      displayName: 'Test Thumb',
    })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/test_thumb_' + Date.now(),
      publishedAt: new Date(),
    })
    .returning();

  const originalS3ClientInstance = s3ClientInstance;
  const originalCloudFrontClientInstance = cloudFrontClientInstance;
  t.after(async () => {
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
    blurFacesBeforeAi: false,
  };

  await t.test('Case A: happy path -- resizes/re-encodes, uploads to the thumb key, writes durableThumbnailUrl', async () => {
    let sentCommand: any = null;
    setS3ClientInstance({
      send: async (command: any) => {
        sentCommand = command;
        return { ETag: '"test-etag"' };
      },
    } as any);
    setCloudFrontClientInstance({ send: async () => ({}) } as any);

    const sourceBytes = await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .jpeg()
      .toBuffer();
    const expectedHash8 = await hash8OfResizedJpeg(sourceBytes);
    const expectedKey = `posts/${post.id}/thumb-${expectedHash8}.jpg`;

    const result = await uploadFaceBlurThumbnail(post.id, sourceBytes, mockEnv);

    assert.strictEqual(result, `https://${mockEnv.postMediaCdnDomain}/${expectedKey}`);
    assert.ok(sentCommand);
    assert.strictEqual(sentCommand.input.Bucket, mockEnv.postMediaBucketName);
    assert.strictEqual(sentCommand.input.Key, expectedKey);
    assert.strictEqual(sentCommand.input.ContentType, 'image/jpeg');

    const resizedMeta = await sharp(sentCommand.input.Body).metadata();
    assert.strictEqual(resizedMeta.width, 480);
    assert.strictEqual(resizedMeta.height, 480);
    assert.strictEqual(resizedMeta.format, 'jpeg');

    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableThumbnailUrl, result);
  });

  await t.test('Case B: replacing with different content deletes/invalidates the old thumb key', async () => {
    let deletedKey: string | null = null;
    setS3ClientInstance({
      send: async (command: any) => {
        if (command.constructor.name === 'DeleteObjectCommand') {
          deletedKey = command.input.Key;
        }
        return { ETag: '"test-etag"' };
      },
    } as any);
    let invalidateCalled = false;
    setCloudFrontClientInstance({
      send: async () => {
        invalidateCalled = true;
        return {};
      },
    } as any);

    const newBytes = await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 200, g: 50, b: 80 } } })
      .jpeg()
      .toBuffer();

    const result = await uploadFaceBlurThumbnail(post.id, newBytes, mockEnv);

    assert.ok(result);
    assert.ok(deletedKey, 'expected the previous thumb key to be deleted');
    assert.ok(invalidateCalled, 'expected a CloudFront invalidation for the previous thumb key');

    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableThumbnailUrl, result);
  });

  await t.test('Case C: S3 upload rejection (non-throwing, logs error, returns null)', async () => {
    await db.update(posts).set({ durableThumbnailUrl: null }).where(eq(posts.id, post.id));
    setS3ClientInstance({
      send: async () => {
        throw new Error('S3 error');
      },
    } as any);

    const result = await uploadFaceBlurThumbnail(post.id, Buffer.from('not-even-an-image'), mockEnv);

    assert.strictEqual(result, null);
    const [dbPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(dbPost.durableThumbnailUrl, null);
  });

  await t.test('Case D: missing configuration (skipped, returns null)', async () => {
    const incompleteEnv = { ...mockEnv, postMediaBucketName: undefined };
    const result = await uploadFaceBlurThumbnail(post.id, Buffer.from(''), incompleteEnv);
    assert.strictEqual(result, null);
  });
});
