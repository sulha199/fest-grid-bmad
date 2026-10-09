import test from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles, postAccountAssociations } from '@festgrid/database';
import { and, eq } from 'drizzle-orm';
import { persistScrapedPost } from './persist-scraped-post.js';

/**
 * Deletes the post (by postUrl) and any `post_account_associations` rows referencing it,
 * if the post exists. Story 3.15 added two new FK references onto discovered profiles
 * (`posts.accountId` for the resolved publisher, `post_account_associations.accountId` for
 * every role) -- a test that deletes a discovered profile it created must first delete
 * anything that now points at it, or the delete violates one of those FKs.
 */
async function cleanupPostAndAssociationsByUrl(postUrl: string) {
  const existingPost = await db
    .select()
    .from(posts)
    .where(eq(posts.postUrl, postUrl))
    .then((rows) => rows[0]);
  if (existingPost) {
    await db.delete(postAccountAssociations).where(eq(postAccountAssociations.postId, existingPost.id));
    await db.delete(posts).where(eq(posts.id, existingPost.id));
  }
}

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

  // Tracks post ids created by sub-tests that do NOT already clean up their own rows via a
  // try/finally + cleanupPostAndAssociationsByUrl (those are: r, t, u, w, y). Every other
  // sub-test below pushes the id(s) of the post row(s) it created here, and the file-level
  // t.after at the bottom deletes exactly those rows (and their associations), in FK-safe
  // order, plus the `profile` row created above.
  const createdPostIds: string[] = [];

  t.after(async () => {
    for (const postId of createdPostIds) {
      await db.delete(postAccountAssociations).where(eq(postAccountAssociations.postId, postId));
      await db.delete(posts).where(eq(posts.id, postId));
    }
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

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
    createdPostIds.push(result.post.id);

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
    createdPostIds.push(result1.post.id);

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
    createdPostIds.push(result1.post.id, result2.post.id);

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
    createdPostIds.push(result1.post.id);
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
    createdPostIds.push(resultWithVideo.post.id, resultNoVideo.post.id);
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
    createdPostIds.push(resultWithExpiry.post.id, resultNoExpiry.post.id, resultNullImage.post.id);
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
    createdPostIds.push(result1.post.id);
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
    createdPostIds.push(result1.post.id);
  });

  await t.test('(j) additionalImageUrls round-trips into the additional_image_urls jsonb column on insert', async () => {
    const postUrl = 'https://instagram.com/p/carousel_roundtrip_' + Date.now();
    const urls = [
      'https://test.com/carousel_roundtrip_slide2.jpg',
      'https://test.com/carousel_roundtrip_slide3.jpg',
      'https://test.com/carousel_roundtrip_slide4.jpg',
    ];
    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Carousel post',
      imageUrl: 'https://test.com/carousel_roundtrip_cover.jpg',
      postUrl,
      publishedAt: new Date().toISOString(),
      additionalImageUrls: urls,
    });

    assert.strictEqual(result.alreadyExisted, false);
    assert.deepStrictEqual(result.post.additionalImageUrls, urls);

    // Read back directly from the DB to confirm raw jsonb storage
    const [dbPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.post.id));
    assert.deepStrictEqual(dbPost.additionalImageUrls, urls);
    createdPostIds.push(result.post.id);
  });

  await t.test('(k) omitting additionalImageUrls persists null in the jsonb column', async () => {
    const postUrl = 'https://instagram.com/p/no_carousel_' + Date.now();
    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Single image post',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result.alreadyExisted, false);
    const [dbPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.post.id));
    assert.strictEqual(dbPost.additionalImageUrls, null);
    createdPostIds.push(result.post.id);
  });

  await t.test('(l) a large additionalImageUrls array persists in full, uncapped (AC3 no-cap)', async () => {
    const postUrl = 'https://instagram.com/p/large_carousel_' + Date.now();
    const urls = Array.from({ length: 8 }, (_, i) => `https://test.com/slide_${i + 2}.jpg`);
    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Large carousel post',
      postUrl,
      publishedAt: new Date().toISOString(),
      additionalImageUrls: urls,
    });

    assert.strictEqual(result.alreadyExisted, false);
    assert.strictEqual(result.post.additionalImageUrls!.length, 8);
    const [dbPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.post.id));
    assert.deepStrictEqual(dbPost.additionalImageUrls, urls);
    createdPostIds.push(result.post.id);
  });

  await t.test('(m) re-persisting an existing postUrl with a different additionalImageUrls does not overwrite the stored value', async () => {
    const postUrl = 'https://instagram.com/p/no_overwrite_carousel_' + Date.now();
    const result1 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Original carousel',
      postUrl,
      publishedAt: new Date().toISOString(),
      additionalImageUrls: ['https://test.com/orig_slide2.jpg'],
    });
    assert.strictEqual(result1.alreadyExisted, false);

    const result2 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Updated content ignored',
      postUrl,
      publishedAt: new Date().toISOString(),
      additionalImageUrls: ['https://test.com/new_slide2.jpg'],
    });

    assert.strictEqual(result2.alreadyExisted, true);
    assert.deepStrictEqual(result2.post.additionalImageUrls, ['https://test.com/orig_slide2.jpg']);
    createdPostIds.push(result1.post.id);
  });

  await t.test('(n) a brand-new Instagram-shaped postUrl (no originalPostUrl) persists platformPostId/platformPostType', async () => {
    const postId = 'platform_identity_n_' + Date.now();
    const postUrl = `https://instagram.com/p/${postId}`;
    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content N',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result.alreadyExisted, false);
    assert.strictEqual(result.post.platformPostId, postId);
    assert.strictEqual(result.post.platformPostType, 'p');

    // Read back from the DB, not just the returned object
    const [dbPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.post.id));
    assert.strictEqual(dbPost.platformPostId, postId);
    assert.strictEqual(dbPost.platformPostType, 'p');
    createdPostIds.push(result.post.id);
  });

  await t.test('(o) a brand-new post whose postUrl cannot be parsed persists both columns as null', async () => {
    const postUrl = 'https://instagram.com/unparseable_profile_o_' + Date.now();
    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content O',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result.alreadyExisted, false);
    assert.strictEqual(result.post.platformPostId, null);
    assert.strictEqual(result.post.platformPostType, null);

    const [dbPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.post.id));
    assert.strictEqual(dbPost.platformPostId, null);
    assert.strictEqual(dbPost.platformPostType, null);
    createdPostIds.push(result.post.id);
  });

  await t.test('(p) re-persisting an existing postUrl (dedupe) never backfills platformPostId/platformPostType even though the second call would now parse', async () => {
    // 1st insert: unparseable postUrl, so columns start out null
    const postUrl = 'https://instagram.com/unparseable_profile_p_' + Date.now();
    const result1 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Original content P',
      postUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);
    assert.strictEqual(result1.post.platformPostId, null);
    assert.strictEqual(result1.post.platformPostType, null);

    // 2nd call: same postUrl (dedupe/backfill path) -- even though a differently-shaped originalPostUrl
    // would now parse successfully, the existing-row branch must never write these columns.
    const result2 = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Updated content ignored',
      postUrl,
      originalPostUrl: 'https://instagram.com/p/should_never_be_written_' + Date.now(),
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result2.alreadyExisted, true);
    assert.strictEqual(result2.post.id, result1.post.id);
    assert.strictEqual(result2.post.platformPostId, null, 'dedupe path must never backfill platformPostId');
    assert.strictEqual(result2.post.platformPostType, null, 'dedupe path must never backfill platformPostType');

    const [dbPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result1.post.id));
    assert.strictEqual(dbPost.platformPostId, null);
    assert.strictEqual(dbPost.platformPostType, null);
    createdPostIds.push(result1.post.id);
  });

  await t.test('(q) originalPostUrl wins over a differently-shaped postUrl when both are present and parseable', async () => {
    const originalPostUrl = 'https://instagram.com/p/canonical_identity_q_' + Date.now();
    const postUrl = 'https://proxy1.com/reel/proxy_identity_q_' + Date.now();

    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content Q',
      postUrl,
      originalPostUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result.alreadyExisted, false);
    const expectedId = originalPostUrl.split('/p/')[1];
    assert.strictEqual(result.post.platformPostId, expectedId);
    assert.strictEqual(result.post.platformPostType, 'p');
    createdPostIds.push(result.post.id);
  });

  await t.test('(r) ownerId/coauthors/discoverySourceVendor: creates a discovered profile for the publisher and one per coauthor (Story 3.14)', async () => {
    const ownerId = 'discovered_owner_r_' + Date.now();
    const coauthorId1 = 'discovered_coauthor_r1_' + Date.now();
    const coauthorId2 = 'discovered_coauthor_r2_' + Date.now();
    const postUrl = 'https://instagram.com/p/attribution_r_' + Date.now();

    try {
      const result = await persistScrapedPost({
        accountId: profile.id,
        platform: 'instagram',
        content: 'Test content R',
        postUrl,
        publishedAt: new Date().toISOString(),
        ownerId,
        ownerUsername: 'owner_r_user',
        ownerDisplayName: 'Owner R',
        coauthors: [
          { accountId: coauthorId1, username: 'coauthor_r1' },
          { accountId: coauthorId2 },
        ],
        discoverySourceVendor: 'apify',
        scraperActorRunId: undefined,
      });
      assert.strictEqual(result.alreadyExisted, false);

      const ownerRow = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, ownerId)))
        .then((rows) => rows[0]);
      assert.ok(ownerRow, 'publisher profile row should exist');
      assert.strictEqual(ownerRow.displayName, 'Owner R');
      assert.strictEqual(ownerRow.username, 'owner_r_user');
      assert.strictEqual(ownerRow.isVerifiedForDiscovery, false);

      const coauthorRow1 = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, coauthorId1)))
        .then((rows) => rows[0]);
      assert.ok(coauthorRow1, 'coauthor 1 profile row should exist');
      assert.strictEqual(coauthorRow1.username, 'coauthor_r1');
      assert.strictEqual(coauthorRow1.displayName, 'coauthor_r1');

      const coauthorRow2 = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, coauthorId2)))
        .then((rows) => rows[0]);
      assert.ok(coauthorRow2, 'coauthor 2 profile row should exist');
      assert.strictEqual(coauthorRow2.displayName, coauthorId2);
      assert.strictEqual(coauthorRow2.username, coauthorId2);
    } finally {
      // Story 3.15 now also resolves post.accountId to the publisher profile and writes
      // post_account_associations rows referencing all three profiles -- clean those up
      // first so the profile deletes below don't violate the new FKs.
      await cleanupPostAndAssociationsByUrl(postUrl);
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, ownerId)));
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, coauthorId1)));
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, coauthorId2)));
    }
  });

  await t.test('(s) omitting ownerId/coauthors/discoverySourceVendor (today\'s existing call shape) creates no extra profile rows', async () => {
    const postUrl = 'https://instagram.com/p/no_attribution_s_' + Date.now();
    const beforeCount = await db.select().from(socialMediaAccountProfiles).then((rows) => rows.length);

    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content S',
      postUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result.alreadyExisted, false);

    const afterCount = await db.select().from(socialMediaAccountProfiles).then((rows) => rows.length);
    assert.strictEqual(afterCount, beforeCount, 'no new social_media_account_profiles row should be created');
    createdPostIds.push(result.post.id);
  });

  await t.test('(t) a coauthor accountId colliding with an existing profile on a different platform does not corrupt that row (composite key sanity check)', async () => {
    const sharedAccountIdString = 'collision_t_' + Date.now();
    const postUrl = 'https://instagram.com/p/collision_t_' + Date.now();

    // Pre-existing profile on a different platform, sharing the raw accountId string.
    const [otherPlatformProfile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: sharedAccountIdString,
        platform: 'twitter',
        username: 'other_platform_user',
        displayName: 'Other Platform User',
      })
      .returning();

    try {
      const result = await persistScrapedPost({
        accountId: profile.id,
        platform: 'instagram',
        content: 'Test content T',
        postUrl,
        publishedAt: new Date().toISOString(),
        coauthors: [{ accountId: sharedAccountIdString, username: 'instagram_side_user' }],
        discoverySourceVendor: 'apify',
      });
      assert.strictEqual(result.alreadyExisted, false);

      // The pre-existing twitter-platform row must be untouched.
      const unchangedOtherPlatformProfile = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, otherPlatformProfile.id))
        .then((rows) => rows[0]);
      assert.strictEqual(unchangedOtherPlatformProfile.username, 'other_platform_user');
      assert.strictEqual(unchangedOtherPlatformProfile.displayName, 'Other Platform User');

      // A distinct new row must exist for the instagram-platform coauthor.
      const instagramSideProfile = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, sharedAccountIdString)))
        .then((rows) => rows[0]);
      assert.ok(instagramSideProfile);
      assert.notStrictEqual(instagramSideProfile.id, otherPlatformProfile.id);
      assert.strictEqual(instagramSideProfile.username, 'instagram_side_user');
    } finally {
      // Story 3.15 now writes a COAUTHOR post_account_associations row referencing the
      // instagram-side profile -- clean it up first so the profile delete below doesn't
      // violate the new FK.
      await cleanupPostAndAssociationsByUrl(postUrl);
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, sharedAccountIdString)));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, otherPlatformProfile.id));
    }
  });

  await t.test('(u) a new post with ownerId present (differing from the caller\'s accountId) resolves post.accountId to the publisher\'s profile id (Story 3.15 AC3)', async () => {
    const ownerId = 'discovered_owner_u_' + Date.now();
    const postUrl = 'https://instagram.com/p/accountid_resolution_u_' + Date.now();

    try {
      const result = await persistScrapedPost({
        accountId: profile.id,
        platform: 'instagram',
        content: 'Test content U',
        postUrl,
        publishedAt: new Date().toISOString(),
        ownerId,
        ownerUsername: 'owner_u_user',
        discoverySourceVendor: 'apify',
      });

      const publisherProfile = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, ownerId)))
        .then((rows) => rows[0]);
      assert.ok(publisherProfile, 'publisher profile row should exist');
      assert.notStrictEqual(publisherProfile.id, profile.id, 'publisher profile differs from the scraping-account profile');
      assert.strictEqual(result.post.accountId, publisherProfile.id, 'posts.accountId resolves to the publisher profile id, not the scraping accountId');
    } finally {
      await cleanupPostAndAssociationsByUrl(postUrl);
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, ownerId)));
    }
  });

  await t.test('(v) a new post without ownerId falls back to the caller\'s accountId for post.accountId (AC3 fallback, the Bright Data case)', async () => {
    const postUrl = 'https://instagram.com/p/accountid_fallback_v_' + Date.now();

    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content V',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    assert.strictEqual(result.post.accountId, profile.id, 'posts.accountId falls back to the caller-supplied accountId when no ownerId is present');
    createdPostIds.push(result.post.id);
  });

  await t.test('(w) a new post with ownerId + coauthors results in SCRAPING_SOURCE + PUBLISHER + N COAUTHOR rows in post_account_associations (AC2/AC5)', async () => {
    const ownerId = 'discovered_owner_w_' + Date.now();
    const coauthorId1 = 'discovered_coauthor_w1_' + Date.now();
    const coauthorId2 = 'discovered_coauthor_w2_' + Date.now();
    const postUrl = 'https://instagram.com/p/associations_w_' + Date.now();

    try {
      const result = await persistScrapedPost({
        accountId: profile.id,
        platform: 'instagram',
        content: 'Test content W',
        postUrl,
        publishedAt: new Date().toISOString(),
        ownerId,
        ownerUsername: 'owner_w_user',
        coauthors: [
          { accountId: coauthorId1, username: 'coauthor_w1' },
          { accountId: coauthorId2, username: 'coauthor_w2' },
        ],
        discoverySourceVendor: 'apify',
      });

      const rows = await db
        .select()
        .from(postAccountAssociations)
        .where(eq(postAccountAssociations.postId, result.post.id));
      assert.strictEqual(rows.length, 4);

      const byRole = (role: string) => rows.filter((r) => r.role === role);
      assert.strictEqual(byRole('SCRAPING_SOURCE').length, 1);
      assert.strictEqual(byRole('SCRAPING_SOURCE')[0].accountId, profile.id);
      assert.strictEqual(byRole('PUBLISHER').length, 1);
      assert.strictEqual(byRole('COAUTHOR').length, 2);
    } finally {
      await cleanupPostAndAssociationsByUrl(postUrl);
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, ownerId)));
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, coauthorId1)));
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, coauthorId2)));
    }
  });

  await t.test('(x) if the publisher\'s getOrCreateDiscoveredAccountProfile call throws, persistScrapedPost still succeeds and falls back to the caller\'s accountId (AC3 fallback)', async (t) => {
    const ownerId = 'discovered_owner_x_' + Date.now();
    const postUrl = 'https://instagram.com/p/publisher_fail_x_' + Date.now();

    const originalInsert = db.insert.bind(db);
    t.mock.method(db, 'insert', (table: any) => {
      if (table === socialMediaAccountProfiles) {
        throw new Error('Simulated getOrCreateDiscoveredAccountProfile failure');
      }
      return originalInsert(table);
    });

    const result = await persistScrapedPost({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Test content X',
      postUrl,
      publishedAt: new Date().toISOString(),
      ownerId,
      ownerUsername: 'owner_x_user',
      discoverySourceVendor: 'apify',
    });

    assert.strictEqual(result.alreadyExisted, false);
    assert.strictEqual(result.post.accountId, profile.id, 'falls back to the caller accountId when publisher resolution fails');
    createdPostIds.push(result.post.id);
  });

  await t.test('(y) re-persisting an existing postUrl (dedupe branch) with ownerId now present does not change the already-set post.accountId, but still writes association rows idempotently (AC3 + AC4)', async () => {
    const ownerId = 'discovered_owner_y_' + Date.now();
    const postUrl = 'https://instagram.com/p/dedupe_accountid_y_' + Date.now();

    try {
      const firstResult = await persistScrapedPost({
        accountId: profile.id,
        platform: 'instagram',
        content: 'Test content Y1',
        postUrl,
        publishedAt: new Date().toISOString(),
      });
      assert.strictEqual(firstResult.alreadyExisted, false);
      assert.strictEqual(firstResult.post.accountId, profile.id);

      const secondResult = await persistScrapedPost({
        accountId: profile.id,
        platform: 'instagram',
        content: 'Test content Y2',
        postUrl,
        publishedAt: new Date().toISOString(),
        ownerId,
        ownerUsername: 'owner_y_user',
        discoverySourceVendor: 'apify',
      });
      assert.strictEqual(secondResult.alreadyExisted, true);
      assert.strictEqual(secondResult.post.accountId, profile.id, 'already-existed branch never touches post.accountId');

      // Idempotent association writes: re-processing the same (post, account, role) does not
      // throw and does not duplicate rows; the publisher identity discovered on the dedupe
      // pass is still recorded in the association table.
      const thirdResult = await persistScrapedPost({
        accountId: profile.id,
        platform: 'instagram',
        content: 'Test content Y3',
        postUrl,
        publishedAt: new Date().toISOString(),
        ownerId,
        ownerUsername: 'owner_y_user',
        discoverySourceVendor: 'apify',
      });
      assert.strictEqual(thirdResult.alreadyExisted, true);

      const rows = await db
        .select()
        .from(postAccountAssociations)
        .where(eq(postAccountAssociations.postId, secondResult.post.id));
      const byRole = (role: string) => rows.filter((r) => r.role === role);
      assert.strictEqual(byRole('SCRAPING_SOURCE').length, 1);
      assert.strictEqual(byRole('PUBLISHER').length, 1);
    } finally {
      await cleanupPostAndAssociationsByUrl(postUrl);
      await db
        .delete(socialMediaAccountProfiles)
        .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, ownerId)));
    }
  });

});
