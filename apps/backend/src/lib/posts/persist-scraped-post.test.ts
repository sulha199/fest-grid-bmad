import test from 'node:test';
import * as assert from 'node:assert';
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
      content: 'Test content B1',
      imageUrl: 'https://test.com/image1.png',
      postUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);

    const result2 = await persistScrapedPost({
      accountId: profile.id,
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
      content: 'Test content C1',
      postUrl: postUrl1,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);

    const result2 = await persistScrapedPost({
      accountId: profile.id,
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
      content: 'Test content D1',
      postUrl: postUrl1,
      originalPostUrl,
      publishedAt: new Date().toISOString(),
    });
    assert.strictEqual(result1.alreadyExisted, false);

    const result2 = await persistScrapedPost({
      accountId: profile.id,
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
});
