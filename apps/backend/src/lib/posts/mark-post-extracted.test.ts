import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { markPostExtracted } from './mark-post-extracted.js';

test('markPostExtracted integration tests', async (t) => {
  // Setup a test profile
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'test_acc_mark_' + Date.now(),
      platform: 'instagram',
      username: 'test.mark',
      displayName: 'Test Mark',
    })
    .returning();

  // Create a starting post with isExtracted: false
  const [post] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Extract test post',
      postUrl: 'https://instagram.com/p/test_mark_post_' + Date.now(),
      isExtracted: false,
      publishedAt: new Date(),
    })
    .returning();

  await t.test('(a) calling it on a post with isExtracted: false sets it to true', async () => {
    const updated = await markPostExtracted(post.id);
    assert.ok(updated);
    assert.strictEqual(updated.id, post.id);
    assert.strictEqual(updated.isExtracted, true);

    // Verify DB directly
    const dbPost = await db
      .select()
      .from(posts)
      .where(eq(posts.id, post.id))
      .limit(1)
      .then((rows) => rows[0]);
    assert.ok(dbPost);
    assert.strictEqual(dbPost.isExtracted, true);
  });

  await t.test('(b) calling it again on the now-isExtracted: true post is idempotent', async () => {
    // Calling markPostExtracted again
    const updated = await markPostExtracted(post.id);
    assert.ok(updated);
    assert.strictEqual(updated.id, post.id);
    assert.strictEqual(updated.isExtracted, true);

    const dbPost = await db
      .select()
      .from(posts)
      .where(eq(posts.id, post.id))
      .limit(1)
      .then((rows) => rows[0]);
    assert.ok(dbPost);
    assert.strictEqual(dbPost.isExtracted, true);
  });

  await t.test('(c) calling it with a non-existent postId returns undefined rather than throwing', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const result = await markPostExtracted(fakeId);
    assert.strictEqual(result, undefined);
  });
});
