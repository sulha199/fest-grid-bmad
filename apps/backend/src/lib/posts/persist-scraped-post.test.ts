import test from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { persistScrapedPost } from './persist-scraped-post.js';

test('persistScrapedPost integration tests', async (t) => {
  // Setup a test profile
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'test_acc_persist_' + Date.now(),
      platform: 'instagram',
      username: 'test.persist',
      displayName: 'Test Persist',
    })
    .returning();

  await t.test('(a) persisting a post with a new post_url inserts a new row with alreadyExisted: false', async () => {
    const postUrl = 'https://instagram.com/p/test_post_a_' + Date.now();
    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content A',
      imageUrl: 'https://test.com/image.png',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result.alreadyExisted, false);
    assert.ok(result.post);
    assert.strictEqual(result.post.postUrl, postUrl);
    assert.strictEqual(result.post.content, 'Test content A');

    // Verify it is in the database
    const dbPost = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.post.id))
      .limit(1)
      .then((rows) => rows[0]);
    assert.ok(dbPost);
  });

  await t.test('(b) persisting the same post_url again returns the original row unchanged with alreadyExisted: true', async () => {
    const postUrl = 'https://instagram.com/p/test_post_b_' + Date.now();
    const result1 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content B1',
      imageUrl: 'https://test.com/image1.png',
      postUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);

    const result2 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content B2', // updated content should be ignored as row is returned unchanged
      imageUrl: 'https://test.com/image2.png',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result2.alreadyExisted, true);
    assert.strictEqual(result2.post.id, result1.post.id);
    assert.strictEqual(result2.post.content, 'Test content B1', 'Should keep original content');

    // Verify row count remains 1 for this post_url
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.postUrl, postUrl));
    assert.strictEqual(rows.length, 1);
  });

  await t.test('(c) persisting a different post_url for the same accountId creates a second, independent row', async () => {
    const postUrl1 = 'https://instagram.com/p/test_post_c1_' + Date.now();
    const postUrl2 = 'https://instagram.com/p/test_post_c2_' + Date.now();

    const result1 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content C1',
      postUrl: postUrl1,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);

    const result2 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content C2',
      postUrl: postUrl2,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result2.alreadyExisted, false);

    assert.notStrictEqual(result1.post.id, result2.post.id);

    // Verify both are in the database under same accountId
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, profile.id));
    
    const urls = rows.map((r) => r.postUrl);
    assert.ok(urls.includes(postUrl1));
    assert.ok(urls.includes(postUrl2));
  });

  await t.test('(d) dual-lookup: deduplicates on originalPostUrl even if postUrl is different', async () => {
    const originalPostUrl = 'https://instagram.com/p/canonical_shared_' + Date.now();
    const postUrl1 = 'https://proxy1.com/p/first_scraper_' + Date.now();
    const postUrl2 = 'https://proxy2.com/p/second_scraper_' + Date.now();

    const result1 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content D1',
      postUrl: postUrl1,
      originalPostUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);

    const result2 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content D2',
      postUrl: postUrl2,
      originalPostUrl,
      publishedAt: new Date().toISOString(),
    });

    // Should match the existing post because they share originalPostUrl
    assert.strictEqual(result2.alreadyExisted, true);
    assert.strictEqual(result2.post.id, result1.post.id);
    assert.strictEqual(result2.post.content, 'Test content D1');
  });

  await t.test('(e) videoUrl round-trips correctly and defaults to null (Amendment)', async () => {
    const postUrlWithVideo = 'https://instagram.com/p/video_post_' + Date.now();
    const resultWithVideo = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content with video',
      videoUrl: 'https://test.com/my-video.mp4',
      postUrl: postUrlWithVideo,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(resultWithVideo.alreadyExisted, false);
    assert.strictEqual(resultWithVideo.post.videoUrl, 'https://test.com/my-video.mp4');

    // Fetch directly from DB to verify raw storage
    const [dbPostWithVideo] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, resultWithVideo.post.id));
    assert.strictEqual(dbPostWithVideo.videoUrl, 'https://test.com/my-video.mp4');

    const postUrlNoVideo = 'https://instagram.com/p/no_video_post_' + Date.now();
    const resultNoVideo = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content without video',
      postUrl: postUrlNoVideo,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(resultNoVideo.alreadyExisted, false);
    assert.strictEqual(resultNoVideo.post.videoUrl, null, 'omitted videoUrl should persist as null in the DB');

    const [dbPostNoVideo] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, resultNoVideo.post.id));
    assert.strictEqual(dbPostNoVideo.videoUrl, null);
  });

  await t.test('(f) imageUrlExpiresAt is set on insert according to imageUrl format', async () => {
    // 1. With valid expiry parameter (oe)
    const postUrlWithExpiry = 'https://instagram.com/p/expiry_post_' + Date.now();
    const resultWithExpiry = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content with image expiry',
      imageUrl: 'https://test.com/image.png?oe=64F373FF',
      postUrl: postUrlWithExpiry,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(resultWithExpiry.alreadyExisted, false);
    assert.ok(resultWithExpiry.post.imageUrlExpiresAt instanceof Date);
    assert.strictEqual(resultWithExpiry.post.imageUrlExpiresAt.getTime(), 1693676543000);

    // 2. With no expiry parameter
    const postUrlNoExpiry = 'https://instagram.com/p/no_expiry_post_' + Date.now();
    const resultNoExpiry = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content without image expiry',
      imageUrl: 'https://test.com/image.png',
      postUrl: postUrlNoExpiry,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(resultNoExpiry.alreadyExisted, false);
    assert.strictEqual(resultNoExpiry.post.imageUrlExpiresAt, null);

    // 3. With null imageUrl
    const postUrlNullImage = 'https://instagram.com/p/null_image_post_' + Date.now();
    const resultNullImage = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content with null image',
      imageUrl: null,
      postUrl: postUrlNullImage,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(resultNullImage.alreadyExisted, false);
    assert.strictEqual(resultNullImage.post.imageUrlExpiresAt, null);
  });

  await t.test('(g) FK retry correctly rethrows when the retry insert also fails (unrelated FK constraint violation on accountId)', async () => {
    // Generate non-existent UUIDs for scraperActorRunId and accountId to force FK failures
    const nonExistentRunId = randomUUID();
    const nonExistentAccountId = randomUUID();
    const postUrl = 'https://instagram.com/p/fk_retry_fail_' + Date.now();

    // Call persistScrapedPost expecting it to throw because accountId is invalid, 
    // even though we triggered the scraperActorRunId retry path first
    await assert.rejects(
      async () => {
        await persistScrapedPost({
          accountId: nonExistentAccountId, // Invalid accountId causes retry insert to fail with FK violation
          platform: 'instagram',
          content: 'Test content triggering dual FK fail',
          postUrl,
          publishedAt: new Date().toISOString(),
          scraperActorRunId: nonExistentRunId, // Invalid runId triggers the first FK violation
        });
      },
      (err: any) => {
        // Confirm it threw an FK violation error (code 23503)
        return err?.code === '23503';
      }
    );
  });
  await t.test('(h) backfills missing videoUrl and imageUrl on dedupe but leaves content untouched', async () => {
    const postUrl = 'https://instagram.com/p/test_post_h_' + Date.now();
    // 1st insert: null videoUrl/imageUrl
    const result1 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Original content',
      postUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);
    assert.strictEqual(result1.post.videoUrl, null);
    assert.strictEqual(result1.post.imageUrl, null);

    // 2nd insert: populated videoUrl/imageUrl
    const result2 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Updated content ignored',
      videoUrl: 'https://test.com/video_h.mp4',
      imageUrl: 'https://test.com/image_h.png?oe=64F373FF',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result2.alreadyExisted, true);
    assert.strictEqual(result2.post.id, result1.post.id);
    assert.strictEqual(result2.post.content, 'Original content');
    assert.strictEqual(result2.post.videoUrl, 'https://test.com/video_h.mp4');
    assert.strictEqual(result2.post.imageUrl, 'https://test.com/image_h.png?oe=64F373FF');
    assert.ok(result2.post.imageUrlExpiresAt instanceof Date);
  });

  await t.test('(i) preserves existing videoUrl on dedupe and does not overwrite', async () => {
    const postUrl = 'https://instagram.com/p/test_post_i_' + Date.now();
    // 1st insert: with videoUrl
    const result1 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Original content',
      videoUrl: 'https://test.com/video_i_first.mp4',
      postUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);
    assert.strictEqual(result1.post.videoUrl, 'https://test.com/video_i_first.mp4');

    // 2nd insert: different videoUrl
    const result2 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Updated content ignored',
      videoUrl: 'https://test.com/video_i_second.mp4',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result2.alreadyExisted, true);
    assert.strictEqual(result2.post.id, result1.post.id);
    assert.strictEqual(result2.post.videoUrl, 'https://test.com/video_i_first.mp4');
  });

});
