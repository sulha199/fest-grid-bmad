import test from 'node:test';
import assert from 'node:assert';
import { instagramScraperAdapter, setCallApifyActor } from './instagram-adapter.js';
import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { eq } from 'drizzle-orm';

test('instagram-adapter tests', async (t) => {
  const provider = 'apify';

  t.afterEach(async () => {
    await db.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
  });

  await t.test('getNewestPosts maps output correctly and records usage', async () => {
    let calledInput: any = null;

    setCallApifyActor(async (input) => {
      calledInput = input;
      return [
        {
          timestamp: '2026-08-08T00:00:00Z',
          url: 'https://www.instagram.com/p/C_abc123/',
          caption: 'My first post!',
          displayUrl: 'https://www.instagram.com/p/C_abc123/img.jpg',
        },
      ];
    });

    const posts = await instagramScraperAdapter.getNewestPosts(
      { accountId: '123', username: 'test_username' },
      { newerThan: '2026-08-01T00:00:00Z' }
    );

    assert.deepStrictEqual(calledInput, {
      directUrls: ['https://www.instagram.com/test_username/'],
      resultsType: 'posts',
      resultsLimit: 10,
      onlyPostsNewerThan: '2026-08-01T00:00:00Z',
    });

    assert.strictEqual(posts.length, 1);
    assert.strictEqual(posts[0].content, 'My first post!');
    assert.strictEqual(posts[0].postUrl, 'https://www.instagram.com/p/C_abc123/');
    assert.strictEqual(posts[0].imageUrl, 'https://www.instagram.com/p/C_abc123/img.jpg');
    assert.strictEqual(posts[0].publishedAt, '2026-08-08T00:00:00Z');

    // Verify usage recorded
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.strictEqual(row.itemsUsedThisCycle, 1);
  });

  await t.test('lookupAccountProfile maps details correctly and records usage', async () => {
    let calledInput: any = null;

    setCallApifyActor(async (input) => {
      calledInput = input;
      return [
        {
          id: '98765',
          fullName: 'Test Display Name',
          username: 'test_username',
          profilePicUrl: 'https://img.com/pic.jpg',
        },
      ];
    });

    const profile = await instagramScraperAdapter.lookupAccountProfile('test_username');

    assert.deepStrictEqual(calledInput, {
      directUrls: ['https://www.instagram.com/test_username/'],
      resultsType: 'details',
      resultsLimit: 1,
    });

    assert.ok(profile);
    assert.strictEqual(profile.accountId, '98765');
    assert.strictEqual(profile.displayName, 'Test Display Name');
    assert.strictEqual(profile.username, 'test_username');
    assert.strictEqual(profile.profileImageUrl, 'https://img.com/pic.jpg');

    // Verify usage recorded
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.strictEqual(row.itemsUsedThisCycle, 1);
  });

  await t.test('skips calls when capacity is exhausted', async () => {
    let wasSeamCalled = false;
    setCallApifyActor(async () => {
      wasSeamCalled = true;
      return [];
    });

    // artificially exhaust capacity
    await db.insert(scraperProviderUsage).values({
      provider,
      itemsUsedThisCycle: 10000, // very high count to exceed $5/month budget
      usageCycleResetAt: new Date(Date.now() + 86400000),
    });

    const posts = await instagramScraperAdapter.getNewestPosts({ accountId: '123', username: 'test_username' });
    assert.strictEqual(posts.length, 0);
    assert.strictEqual(wasSeamCalled, false);

    const profile = await instagramScraperAdapter.lookupAccountProfile('test_username');
    assert.strictEqual(profile, null);
    assert.strictEqual(wasSeamCalled, false);
  });
});
