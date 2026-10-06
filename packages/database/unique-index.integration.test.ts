import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, inArray } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from './schema';
import { createSqlClient } from './seed';
import { loadDatabaseEnv } from './env';

// Story 3.6x / AD-30 Rule 11 -- real-DB migration-safety test for the new partial unique index
// `posts_platform_post_identity_idx` (migration 0073) on posts(platform, platformPostType,
// platformPostId) WHERE platformPostId IS NOT NULL AND platformPostType IS NOT NULL. Asserts the
// index actually rejects a duplicate non-null triple and allows multiple NULL rows (NULLs are
// distinct in Postgres, so the overwhelming majority of pre-AD-16 historical rows never collide).

let databaseUrl: string | null = null;
let databaseEnvError: Error | null = null;
try {
  databaseUrl = loadDatabaseEnv(__dirname).databaseUrl;
} catch (error) {
  databaseEnvError = error instanceof Error ? error : new Error('Unknown DATABASE_URL load error');
  databaseUrl = null;
}

test('posts_platform_post_identity_idx rejects a duplicate non-null (platform, platformPostType, platformPostId) triple and allows multiple NULL rows', async () => {
  assert.ok(
    databaseUrl,
    `DATABASE_URL is required for this migration-safety test. ${databaseEnvError?.message ?? ''}`,
  );
  const requiredDatabaseUrl = databaseUrl;

  const sqlClient = createSqlClient(requiredDatabaseUrl);
  const db = drizzle(sqlClient);

  const createdPostIds: string[] = [];
  let profileId: string | null = null;

  try {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'unique_index_test_publisher_1',
      platform: 'instagram',
      displayName: 'Unique Index Test Publisher',
      username: 'unique_index_test_publisher_1',
    }).returning();
    profileId = profile.id;

    // First insert of the triple succeeds.
    const [first] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/unique_index_test_first',
      originalPostUrl: 'https://instagram.com/p/unique_index_test_first',
      content: 'First post with this triple',
      publishedAt: new Date(),
      isExtracted: true,
      platformPostId: 'unique_index_test_triple',
      platformPostType: 'p',
    }).returning();
    createdPostIds.push(first.id);

    // A second insert with the exact same (platform, platformPostType, platformPostId) triple
    // must be rejected by the partial unique index -- a real Postgres unique_violation (23505),
    // not an application-level check.
    await assert.rejects(
      async () => {
        await db.insert(posts).values({
          accountId: profile.id,
          platform: 'instagram',
          postUrl: 'https://instagram.com/p/unique_index_test_duplicate',
          originalPostUrl: 'https://instagram.com/p/unique_index_test_duplicate',
          content: 'Duplicate-triple post, must be rejected',
          publishedAt: new Date(),
          isExtracted: true,
          platformPostId: 'unique_index_test_triple',
          platformPostType: 'p',
        }).returning();
      },
      (error: unknown) => {
        const { code, message } = error as { code?: string; message?: string };
        assert.equal(code, '23505', `expected a unique_violation (23505), got: ${code} / ${message}`);
        assert.match(String(message), /posts_platform_post_identity_idx/);
        return true;
      },
    );

    // A different platform with the same postType/platformPostId is NOT a collision (the index
    // is scoped per-row on all three columns together).
    const [differentPlatform] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'tiktok',
      postUrl: 'https://tiktok.com/@unique_index_test/video/unique_index_test_triple',
      originalPostUrl: 'https://tiktok.com/@unique_index_test/video/unique_index_test_triple',
      content: 'Same postType/platformPostId, different platform -- not a collision',
      publishedAt: new Date(),
      isExtracted: true,
      platformPostId: 'unique_index_test_triple',
      platformPostType: 'p',
    }).returning();
    createdPostIds.push(differentPlatform.id);

    // Multiple rows with NULL platformPostId/platformPostType (the pre-AD-16, never-backfilled
    // historical shape) must be allowed -- NULLs are distinct in Postgres, so the partial unique
    // index's WHERE clause excludes them entirely.
    const [nullRowOne] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/unique_index_test_null_one',
      originalPostUrl: 'https://instagram.com/p/unique_index_test_null_one',
      content: 'Null-triple post one',
      publishedAt: new Date(),
      isExtracted: true,
    }).returning();
    createdPostIds.push(nullRowOne.id);

    const [nullRowTwo] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/unique_index_test_null_two',
      originalPostUrl: 'https://instagram.com/p/unique_index_test_null_two',
      content: 'Null-triple post two -- also allowed, NULLs never collide',
      publishedAt: new Date(),
      isExtracted: true,
    }).returning();
    createdPostIds.push(nullRowTwo.id);

    assert.ok(nullRowOne.id);
    assert.ok(nullRowTwo.id);
  } finally {
    if (createdPostIds.length > 0) {
      await db.delete(posts).where(inArray(posts.id, createdPostIds));
    }
    if (profileId) {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
    }
    await sqlClient.end();
  }
});
