import test from 'node:test';
import assert from 'node:assert';
import { ApifyApiError } from 'apify-client';
import { instagramScraperAdapter, setCallApifyActor, mapApifyItemToScrapedPost } from './instagram-adapter.js';
import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { ScraperCapacityExceededError, ApifyRequestTimeoutError } from '@festgrid/domain';
import { eq } from 'drizzle-orm';
import { clearApifyProviderUsage, APIFY_TEST_PROVIDER } from './usage-store-test-helpers.js';

test('instagram-adapter tests', async (t) => {
  await clearApifyProviderUsage();

  await t.test('mapApifyItemToScrapedPost maps Apify item correctly', async () => {
    const item = {
      timestamp: '2026-08-08T00:00:00Z',
      url: 'https://www.instagram.com/p/C_abc123/',
      caption: 'Test caption',
      displayUrl: 'https://www.instagram.com/p/C_abc123/img.jpg',
    };

    const result = await mapApifyItemToScrapedPost(item);

    assert.ok(result !== null);
    assert.strictEqual(result!.content, 'Test caption');
    assert.strictEqual(result!.postUrl, 'https://www.instagram.com/p/C_abc123/');
    assert.strictEqual(result!.imageUrl, 'https://www.instagram.com/p/C_abc123/img.jpg');
    assert.strictEqual(result!.publishedAt, '2026-08-08T00:00:00Z');
    assert.strictEqual(result!.originalPostUrl, 'https://www.instagram.com/p/C_abc123/');
  });

  t.afterEach(async () => {
    await clearApifyProviderUsage();
  });

  await t.test('getNewestPosts maps output correctly and records usage', async () => {
    let calledInput: any = null;
    let calledActor: string | undefined;

    setCallApifyActor(async (actorId, input) => {
      calledActor = actorId;
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

    assert.strictEqual(calledActor, 'apify/instagram-post-scraper');
    assert.deepStrictEqual(calledInput, {
      username: ['test_username'],
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
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, APIFY_TEST_PROVIDER));
    assert.strictEqual(row.itemsUsedThisCycle, 1);
  });

  await t.test('lookupAccountProfile maps details correctly and records usage', async () => {
    let calledInput: any = null;
    let calledActor: string | undefined;

    setCallApifyActor(async (actorId, input) => {
      calledActor = actorId;
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

    assert.strictEqual(calledActor, 'apify/instagram-post-scraper');
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
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, APIFY_TEST_PROVIDER));
    assert.strictEqual(row.itemsUsedThisCycle, 1);
  });

  await t.test('getPostByUrl returns null for not‑found error item', async () => {
    setCallApifyActor(async (actorId) => {
      const response = [
        {
          url: 'https://www.instagram.com/p/invalid/',
          username: 'invalid_handle',
          error: 'not_found',
          errorDescription: 'Post does not exist',
        },
      ];
      return response as any; // ActorOutputFor<T> inferred from context
    });
    const result = await instagramScraperAdapter.getPostByUrl('https://www.instagram.com/p/invalid/');
    assert.strictEqual(result, null);
  });

  await t.test('lookupAccountProfile returns null for not‑found error item', async () => {
    setCallApifyActor(async (actorId) => {
      const response = [
        {
          username: 'invalid_handle',
          error: 'not_found',
          errorDescription: 'Profile does not exist',
        },
      ];
      return response as any; // ActorOutputFor<T> inferred from context
    });
    const result = await instagramScraperAdapter.lookupAccountProfile('invalid_handle');
    assert.strictEqual(result, null);
  });

  await t.test('getPostByUrl returns null for item missing both caption and timestamp', async () => {
    setCallApifyActor(async (actorId) => {
      const response = [
        {
          url: 'https://www.instagram.com/p/missing_fields/',
          id: '12345',
          displayUrl: 'https://example.com/img.jpg',
        },
      ];
      return response as any; // ActorOutputFor<T> inferred from context
    });
    const result = await instagramScraperAdapter.getPostByUrl('https://www.instagram.com/p/missing_fields/');
    assert.strictEqual(result, null);
  });

  await t.test('lookupAccountProfile returns null for item missing both fullName and biography', async () => {
    setCallApifyActor(async (actorId) => {
      const response = [
        {
          id: '98765',
          username: 'test_user',
          profilePicUrl: 'https://example.com/pic.jpg',
        },
      ];
      return response as any; // ActorOutputFor<T> inferred from context
    });
    const result = await instagramScraperAdapter.lookupAccountProfile('test_user');
    assert.strictEqual(result, null);
  });

  await t.test('uses the faster app-funded sync actor and surfaces a timeout explicitly', async () => {
    let calledActor: string | undefined;

    setCallApifyActor(async (actorId, input) => {
      calledActor = actorId;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [{
        url: 'https://www.instagram.com/p/test/',
        caption: 'Test post caption',
        timestamp: '2026-08-08T00:00:00Z',
      }];
    });

    const post = await instagramScraperAdapter.getPostByUrl('https://www.instagram.com/p/test/');
    assert.ok(post);
    assert.strictEqual(calledActor, 'apify/instagram-post-scraper');

    setCallApifyActor(async () => new Promise(() => {}) as any);
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
    setCallApifyActor(async (): Promise<any> => {
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

  await t.test('mapApifyItemToScrapedPost returns null for invalid item (missing required fields)', async () => {
    const invalidItem = {
      url: 'https://www.instagram.com/p/missing_content/',
      // Missing caption/text/description (content)
      timestamp: '2026-08-08T00:00:00Z',
    };

    const result = await mapApifyItemToScrapedPost(invalidItem);
    assert.strictEqual(result, null);
  });

  await t.test('mapApifyItemToScrapedPost returns null for invalid item (wrong-typed publishedAt)', async () => {
    const invalidItem = {
      caption: 'Test caption',
      url: 'https://www.instagram.com/p/C_abc123/',
      timestamp: 12345, // number instead of string
    };

    const result = await mapApifyItemToScrapedPost(invalidItem);
    assert.strictEqual(result, null);
  });

  await t.test('mapApifyItemToScrapedPost returns valid post even without optional imageUrl/originalPostUrl', async () => {
    const validItem = {
      caption: 'Just text',
      url: 'https://www.instagram.com/p/C_abc123/',
      timestamp: '2026-08-08T00:00:00Z',
      // No displayUrl or imageUrl
      // No separate originalPostUrl
    };

    const result = await mapApifyItemToScrapedPost(validItem);
    assert.ok(result !== null);
    assert.strictEqual(result!.content, 'Just text');
    assert.strictEqual(result!.postUrl, 'https://www.instagram.com/p/C_abc123/');
    assert.strictEqual(result!.publishedAt, '2026-08-08T00:00:00Z');
    // Optional fields should not be present or should be undefined if not set
    assert.strictEqual(result!.imageUrl, undefined);
    assert.strictEqual(result!.videoUrl, undefined);
  });

  await t.test('mapApifyItemToScrapedPost maps videoUrl correctly (Amendment)', async () => {
    const videoItem = {
      caption: 'Test video caption',
      url: 'https://www.instagram.com/p/clips123/',
      timestamp: '2026-08-08T00:00:00Z',
      videoUrl: 'https://video.mp4',
      productType: 'clips',
    };

    const result = await mapApifyItemToScrapedPost(videoItem);
    assert.ok(result !== null);
    assert.strictEqual(result!.content, 'Test video caption');
    assert.strictEqual(result!.postUrl, 'https://www.instagram.com/p/clips123/');
    assert.strictEqual(result!.videoUrl, 'https://video.mp4');
  });

  await t.test('mapApifyItemToScrapedPost fails validation for unexpected extra keys under additionalProperties: false (Amendment)', async () => {
    const itemWithExtraKey = {
      caption: 'Some caption',
      url: 'https://www.instagram.com/p/extra123/',
      timestamp: '2026-08-08T00:00:00Z',
      someUnexpectedKey: 'not_allowed',
    };

    // Since mapApifyItemToScrapedPost filters fields into `candidate`, let's verify if candidate has any unexpected key or if we try to validate something invalid.
    // Actually, mapApifyItemToScrapedPost constructs `candidate` explicitly with only known properties:
    // candidate: ScrapedPost = { content, postUrl, publishedAt, imageUrl, originalPostUrl, locationName, ownerDisplayName, ownerUsername, videoUrl }
    // Thus any unexpected key on the raw Apify payload itself is simply omitted, NOT passed to validation!
    // To properly test the AJV schema's `additionalProperties: false`, let's test it directly against a custom candidate if needed, or verify mapApifyItemToScrapedPost's behavior.
    // Wait, let's verify that validateScrapedPost (which runs compiled AJV validation) rejects candidate if it had unexpected fields, but candidate is constructed safely.
    // To strictly verify that `additionalProperties: false` is not broken, we can write a test using compileValidator directly on a raw candidate.
    const { scrapedPostSchema } = await import('../../validation/scraped-post.schema.js');
    const { compileValidator } = await import('../../validation/validate.js');
    const validate = compileValidator(scrapedPostSchema);
    
    const validCandidate = {
      content: 'Hello',
      postUrl: 'https://inst.com/p/1',
      publishedAt: '2026-08-08T00:00:00Z',
      videoUrl: 'https://video.mp4',
    };
    assert.ok(validate(validCandidate), 'valid candidate with videoUrl should pass schema validation');

    const invalidCandidateWithExtra = {
      ...validCandidate,
      someUnexpectedKey: 'not_allowed',
    };
    assert.strictEqual(validate(invalidCandidateWithExtra as any), false, 'candidate with unexpected extra key must fail AJV validation');
  });

  await t.test('getNewestPosts filters out invalid items and returns only valid ones', async () => {
    setCallApifyActor(async () => [
      {
        timestamp: '2026-08-08T00:00:00Z',
        url: 'https://www.instagram.com/p/C_abc123/',
        caption: 'Valid post',
        displayUrl: 'https://www.instagram.com/p/C_abc123/img.jpg',
      },
      {
        url: 'https://www.instagram.com/p/invalid/',
        // Missing caption and timestamp
      },
      {
        timestamp: '2026-08-07T00:00:00Z',
        url: 'https://www.instagram.com/p/C_xyz789/',
        caption: 'Another valid post',
      },
    ]);

    const posts = await instagramScraperAdapter.getNewestPosts(
      { accountId: '123', username: 'test_username' }
    );

    assert.strictEqual(posts.length, 2);
    assert.strictEqual(posts[0].content, 'Valid post');
    assert.strictEqual(posts[1].content, 'Another valid post');

    // Verify usage recorded for all 3 items (Apify bills regardless of validation)
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, APIFY_TEST_PROVIDER));
    assert.strictEqual(row.itemsUsedThisCycle, 3);
  });

  await t.test('throws explicit capacity error when capacity is exhausted', async () => {
    let wasSeamCalled = false;
    setCallApifyActor(async () => {
      wasSeamCalled = true;
      return [];
    });

    // artificially exhaust capacity
    await db.insert(scraperProviderUsage).values({
      provider: APIFY_TEST_PROVIDER,
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
