import test from 'node:test';
import assert from 'node:assert';
import { ScraperCapacityExceededError } from '@festgrid/domain';
import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  BRIGHTDATA_POST_MIN_BUDGET_MS,
  BrightDataPostUnavailableError,
  brightDataPostAdapter,
} from './brightdata-post-adapter.js';
import { scrapeBrightDataPost, setScrapeBrightDataPost, type BrightDataProfileScrape } from './brightdata-client.js';
import { clearBrightDataProviderUsage, BRIGHTDATA_TEST_PROVIDER } from './usage-store-test-helpers.js';

// Story 10.2 AC3: the Bright Data post adapter. The scrape is replaced by a seam: nothing here calls the vendor.

const URL_ = 'https://www.instagram.com/p/AAA/';
const context = { budgetMs: 100_000, credential: { kind: 'app-funded' } as const };
const record = {
  url: URL_,
  description: 'Konser malam ini',
  date_posted: '2026-11-11T00:00:00Z',
  photos: ['https://cdn.example.com/v/1_n.jpg?sig=a', 'https://cdn.example.com/v/2_n.jpg?sig=b'],
};

test('brightDataPostAdapter', async (t) => {
  const original = scrapeBrightDataPost;
  await clearBrightDataProviderUsage();
  t.after(async () => {
    setScrapeBrightDataPost(original);
    await clearBrightDataProviderUsage();
  });
  t.afterEach(async () => {
    await clearBrightDataProviderUsage();
  });
  const replyWith = (result: BrightDataProfileScrape | Error) =>
    setScrapeBrightDataPost(async () => {
      if (result instanceof Error) throw result;
      return result;
    });

  await t.test('declares its name and a minimum budget the API Lambda cannot meet', () => {
    assert.strictEqual(brightDataPostAdapter.name, 'brightdata');
    assert.strictEqual(brightDataPostAdapter.minBudgetMs, BRIGHTDATA_POST_MIN_BUDGET_MS);
    assert.ok(BRIGHTDATA_POST_MIN_BUDGET_MS > 28_000);
  });

  await t.test('maps the record with the cover and the slides and records one unit of usage', async () => {
    replyWith({ kind: 'records', records: [record] });
    const post = await brightDataPostAdapter.fetchPost(URL_, context);
    assert.strictEqual(post?.postUrl, URL_);
    assert.strictEqual(post?.imageUrl, 'https://cdn.example.com/v/1_n.jpg?sig=a');
    assert.deepStrictEqual(post?.additionalImageUrls, ['https://cdn.example.com/v/2_n.jpg?sig=b']);
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, BRIGHTDATA_TEST_PROVIDER));
    assert.strictEqual(row.itemsUsedThisCycle, 1);
  });

  await t.test('passes the url and the budget to the scrape', async () => {
    let seen: { url: string; budgetMs: number } | undefined;
    setScrapeBrightDataPost(async (url, budgetMs) => {
      seen = { url, budgetMs };
      return { kind: 'records', records: [record] };
    });
    await brightDataPostAdapter.fetchPost(URL_, { ...context, budgetMs: 123_000 });
    assert.deepStrictEqual(seen, { url: URL_, budgetMs: 123_000 });
  });

  await t.test('dead_page is an answer: null, so the chain stops', async () => {
    replyWith({ kind: 'no-records', errorCode: 'dead_page' });
    assert.strictEqual(await brightDataPostAdapter.fetchPost(URL_, context), null);
  });

  await t.test('an empty result or any other error code throws, so the next provider is tried', async () => {
    replyWith({ kind: 'no-records' });
    await assert.rejects(() => brightDataPostAdapter.fetchPost(URL_, context), (e: unknown) => e instanceof BrightDataPostUnavailableError && /an empty result/.test(e.message));
    replyWith({ kind: 'no-records', errorCode: 'crawl_failed' });
    await assert.rejects(() => brightDataPostAdapter.fetchPost(URL_, context), (e: unknown) => e instanceof BrightDataPostUnavailableError && /crawl_failed/.test(e.message));
  });

  await t.test('a record that cannot be read as a post throws, and records no usage for nothing', async () => {
    replyWith({ kind: 'records', records: [{ description: 'no url, no date' }] });
    await assert.rejects(() => brightDataPostAdapter.fetchPost(URL_, context), BrightDataPostUnavailableError);
  });

  await t.test('a scrape error (a timeout, a refusal) propagates unchanged', async () => {
    const boom = new Error('snapshot was still running');
    replyWith(boom);
    await assert.rejects(() => brightDataPostAdapter.fetchPost(URL_, context), (e: unknown) => e === boom);
  });

  await t.test('a provider known to be over capacity is refused before any call', async () => {
    await db.insert(scraperProviderUsage).values({ provider: BRIGHTDATA_TEST_PROVIDER, itemsUsedThisCycle: 100_000_000, usageCycleResetAt: new Date() });
    let called = false;
    setScrapeBrightDataPost(async () => {
      called = true;
      return { kind: 'records', records: [record] };
    });
    await assert.rejects(() => brightDataPostAdapter.fetchPost(URL_, context), ScraperCapacityExceededError);
    assert.strictEqual(called, false);
  });
});
