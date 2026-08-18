import test from 'node:test';
import assert from 'node:assert';
import { ApifyApiError } from 'apify-client';
import { instagramScraperAdapter, setCallApifyActor, mapApifyItemToScrapedPost } from './instagram-adapter.js';
import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { ScraperCapacityExceededError, ApifyRequestTimeoutError } from '@festgrid/domain';
import { eq } from 'drizzle-orm';

test('instagram-adapter tests', async (t) => {
  const provider = 'apify';

  await t.test('mapApifyItemToScrapedPost maps Apify item correctly', async () => {
    const item = {
      timestamp: '2026-08-08T00:00:00Z',
      url: 'https://www.instagram.com/p/C_abc123/',
      caption: 'Test caption',
      displayUrl: 'https://www.instagram.com/p/C_abc123/img.jpg',
    };

    const result = mapApifyItemToScrapedPost(item);

    assert.strictEqual(result.content, 'Test caption');
    assert.strictEqual(result.postUrl, 'https://www.instagram.com/p/C_abc123/');
    assert.strictEqual(result.imageUrl, 'https://www.instagram.com/p/C_abc123/img.jpg');
    assert.strictEqual(result.publishedAt, '2026-08-08T00:00:00Z');
    assert.strictEqual(result.originalPostUrl, 'https://www.instagram.com/p/C_abc123/');
  });

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

  await t.test('getPostByUrl returns null for not‑found error item', async () => {
    setCallApifyActor(async () => [
      {
        url: 'https://www.instagram.com/p/invalid/',
        username: 'invalid_handle',
        error: 'not_found',
        errorDescription: 'Post does not exist',
      },
    ]);
    const result = await instagramScraperAdapter.getPostByUrl('https://www.instagram.com/p/invalid/');
    assert.strictEqual(result, null);
  });

  await t.test('lookupAccountProfile returns null for not‑found error item', async () => {
    setCallApifyActor(async () => [
      {
        username: 'invalid_handle',
        error: 'not_found',
        errorDescription: 'Profile does not exist',
      },
    ]);
    const result = await instagramScraperAdapter.lookupAccountProfile('invalid_handle');
    assert.strictEqual(result, null);
  });

  await t.test('getPostByUrl returns null for item missing both caption and timestamp', async () => {
    setCallApifyActor(async () => [
      {
        url: 'https://www.instagram.com/p/missing_fields/',
        id: '12345',
        displayUrl: 'https://example.com/img.jpg',
      },
    ]);
    const result = await instagramScraperAdapter.getPostByUrl('https://www.instagram.com/p/missing_fields/');
    assert.strictEqual(result, null);
  });

  await t.test('lookupAccountProfile returns null for item missing both fullName and biography', async () => {
    setCallApifyActor(async () => [
      {
        id: '98765',
        username: 'test_user',
        profilePicUrl: 'https://example.com/pic.jpg',
      },
    ]);
    const result = await instagramScraperAdapter.lookupAccountProfile('test_user');
    assert.strictEqual(result, null);
  });

  await t.test('uses the faster app-funded sync actor and surfaces a timeout explicitly', async () => {
    let calledActor: string | undefined;

    setCallApifyActor(async (input, actorName?: string) => {
      calledActor = actorName;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [{
        id: '98765',
        username: 'test_username',
        fullName: 'Test Display Name',
        profilePicUrl: 'https://img.com/pic.jpg',
      }];
    });

    const post = await instagramScraperAdapter.getPostByUrl('https://www.instagram.com/p/test/');
    assert.ok(post);
    assert.strictEqual(calledActor, 'apify/instagram-post-scraper');

    setCallApifyActor(async () => new Promise(() => {}));
    await assert.rejects(
      () => instagramScraperAdapter.lookupAccountProfile('test_username'),
      (err: any) => {
        assert.strictEqual(err.name, 'ApifyRequestTimeoutError');
        assert.match(err.message, /timed out/i);
        return true;
      }
    );
  });

  await t.test('wraps Apify client errors in a clearer message', async () => {
    setCallApifyActor(async () => {
      throw new ApifyApiError({
        status: 429,
        data: { error: { message: 'Request limit exceeded', type: 'rate-limit-exceeded' } },
        config: { method: 'post', url: 'https://api.apify.com/v2/actors/apify~instagram-scraper/runs' },
      } as any, 1);
    });

    await assert.rejects(
      () => instagramScraperAdapter.getNewestPosts({ accountId: '123', username: 'test_username' }),
      (err: any) => {
        assert.match(err.message, /Apify.*failed/i);
        assert.match(err.message, /Request limit exceeded/i);
        return true;
      }
    );
  });

  await t.test('throws explicit capacity error when capacity is exhausted', async () => {
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

    await assert.rejects(
      () => instagramScraperAdapter.getNewestPosts({ accountId: '123', username: 'test_username' }),
      (err: any) => {
        assert.ok(err instanceof ScraperCapacityExceededError);
        assert.match(err.message, /Apify capacity/i);
        return true;
      }
    );
    assert.strictEqual(wasSeamCalled, false);

    await assert.rejects(
      () => instagramScraperAdapter.lookupAccountProfile('test_username'),
      (err: any) => {
        assert.ok(err instanceof ScraperCapacityExceededError);
        assert.match(err.message, /Apify capacity/i);
        return true;
      }
    );
    assert.strictEqual(wasSeamCalled, false);
  });
});
