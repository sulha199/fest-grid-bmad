import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobAttempts, jobs, users } from '@festgrid/database';
import type { PostScraperAdapter, ScrapedPost } from '@festgrid/domain';
import { db } from '../../db/client.js';
import './register-adapters.js';
import { fetchScrapedPost, providerOverQuota, resolvePostScrapeCredential, setProviderOverQuota } from './post-scraper.js';
import { getPostScraperAdapters, registerPostScraperAdapter } from './post-scraper-registry.js';

// Story 10.2 AC1, AC2, AC6, AC7: the entry point over fake adapters registered in place of the real ones. No vendor is called.

const URL_ = 'https://www.instagram.com/p/AAA/';
const post: ScrapedPost = { content: 'c', postUrl: URL_, publishedAt: '2026-11-11T00:00:00.000Z' };
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];
const original = new Map(getPostScraperAdapters().map((a) => [a.name, a]));
const savedOrder = process.env.POST_SCRAPER_PROVIDER_ORDER;
const defaultProviderOverQuota = providerOverQuota; // captured before the seam is replaced below
const overQuota = new Set<string>();
setProviderOverQuota(async (provider) => overQuota.has(provider));

type Behaviour = (url: string, ctx: { budgetMs: number }) => Promise<ScrapedPost | null>;
const calls: string[] = [];
function fake(name: 'apify' | 'brightdata', minBudgetMs: number, behaviour: Behaviour): void {
  const adapter: PostScraperAdapter = {
    name,
    minBudgetMs,
    fetchPost: async (url, ctx) => {
      calls.push(name);
      return behaviour(url, ctx);
    },
  };
  registerPostScraperAdapter(adapter);
}
async function makeJob(): Promise<string> {
  const [user] = await db.insert(users).values({ email: `postchain-${suffix}-${userIds.length}@example.test` }).returning({ id: users.id });
  userIds.push(user.id);
  const [job] = await db.insert(jobs).values({ type: `fixture-post-${suffix}`, ownerUserId: user.id, trigger: 'USER', inputKey: `k-${suffix}-${userIds.length}`, deadlineAt: new Date(Date.now() + 60_000) }).returning({ id: jobs.id });
  return job.id;
}

test.beforeEach(() => {
  calls.length = 0;
  overQuota.clear();
  delete process.env.POST_SCRAPER_PROVIDER_ORDER;
});
test.after(async () => {
  for (const adapter of original.values()) registerPostScraperAdapter(adapter);
  if (savedOrder === undefined) delete process.env.POST_SCRAPER_PROVIDER_ORDER;
  else process.env.POST_SCRAPER_PROVIDER_ORDER = savedOrder;
  if (userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds));
});

test('fetchScrapedPost', async (t) => {
  await t.test('the default order is Bright Data first, then Apify (owner decision 2026-11-11)', async () => {
    assert.deepEqual(getPostScraperAdapters().map((a) => a.name), ['brightdata', 'apify']);
    fake('brightdata', 0, async () => post);
    fake('apify', 0, async () => post);
    assert.equal(await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000 }), post);
    assert.deepEqual(calls, ['brightdata']);
  });

  await t.test('POST_SCRAPER_PROVIDER_ORDER flips the order without a code change', async () => {
    process.env.POST_SCRAPER_PROVIDER_ORDER = 'apify,brightdata';
    fake('brightdata', 0, async () => post);
    fake('apify', 0, async () => post);
    await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000 });
    assert.deepEqual(calls, ['apify']);
  });

  await t.test('a failing first provider falls over to the second, and a job gets one attempt row per provider', async () => {
    fake('brightdata', 0, async () => {
      throw new Error('vendor down https://secret.example/x');
    });
    fake('apify', 0, async () => post);
    const jobId = await makeJob();
    assert.equal(await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000, jobId }), post);
    assert.deepEqual(calls, ['brightdata', 'apify']);
    const rows = await db.select().from(jobAttempts).where(eq(jobAttempts.jobId, jobId));
    assert.deepEqual(rows.map((r) => [r.provider, r.outcome]).sort(), [['APIFY', 'SUCCEEDED'], ['BRIGHTDATA', 'FAILED']]);
    assert.equal(rows.every((r) => r.budgetMs > 0 && r.elapsedMs >= 0), true);
    assert.equal(JSON.stringify(rows).includes('secret.example'), false, 'the raw vendor error is never stored');
  });

  await t.test('an exhausted cap is skipped with no call and recorded OVER_QUOTA (AC6)', async () => {
    overQuota.add('apify');
    process.env.POST_SCRAPER_PROVIDER_ORDER = 'apify,brightdata';
    fake('brightdata', 0, async () => post);
    fake('apify', 0, async () => post);
    const jobId = await makeJob();
    assert.equal(await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000, jobId }), post);
    assert.deepEqual(calls, ['brightdata']);
    const rows = await db.select().from(jobAttempts).where(eq(jobAttempts.jobId, jobId));
    assert.deepEqual(rows.map((r) => [r.provider, r.outcome, r.reasonCode]).sort(), [['APIFY', 'OVER_QUOTA', 'CAP_KNOWN_USED_UP'], ['BRIGHTDATA', 'SUCCEEDED', null]]);
  });

  await t.test('a provider needing more time than the budget is skipped for budget, recorded SKIPPED', async () => {
    fake('brightdata', 90_000, async () => post);
    fake('apify', 0, async () => post);
    const jobId = await makeJob();
    await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 20_000, jobId });
    assert.deepEqual(calls, ['apify']);
    const rows = await db.select().from(jobAttempts).where(eq(jobAttempts.jobId, jobId));
    assert.deepEqual(rows.map((r) => [r.provider, r.outcome]).sort(), [['APIFY', 'SUCCEEDED'], ['BRIGHTDATA', 'SKIPPED']]);
  });

  await t.test('null from a provider is an answer: the post does not exist, the next provider is not asked', async () => {
    fake('brightdata', 0, async () => null);
    fake('apify', 0, async () => post);
    assert.equal(await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000 }), null);
    assert.deepEqual(calls, ['brightdata']);
  });

  await t.test('when every provider fails the first error surfaces', async () => {
    const first = new Error('first');
    fake('brightdata', 0, async () => {
      throw first;
    });
    fake('apify', 0, async () => {
      throw new Error('second');
    });
    await assert.rejects(fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000 }), (e) => e === first);
  });

  await t.test('without a jobId no attempt row is written', async () => {
    fake('brightdata', 0, async () => post);
    const before = (await db.select().from(jobAttempts)).length;
    await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000 });
    assert.equal((await db.select().from(jobAttempts)).length, before);
  });

  await t.test('the credential defaults to the app-funded key and is passed to the adapter', async () => {
    let seen: unknown;
    registerPostScraperAdapter({ name: 'brightdata', minBudgetMs: 0, fetchPost: async (_u, ctx) => { seen = ctx.credential; return post; } });
    await fetchScrapedPost({ platform: 'instagram', url: URL_, budgetMs: 1000 });
    assert.deepEqual(seen, { kind: 'app-funded' });
    assert.deepEqual(resolvePostScrapeCredential('any-type', 'any-user'), { kind: 'app-funded' });
  });

  await t.test('another platform has no chain: it uses its own adapter (Twitter is not implemented yet)', async () => {
    await assert.rejects(fetchScrapedPost({ platform: 'twitter', url: 'https://x.com/a/status/1', budgetMs: 1000 }), /not yet implemented/);
    assert.deepEqual(calls, []);
  });

  await t.test('a configured name with no registered adapter is skipped, an unknown name is ignored', async () => {
    process.env.POST_SCRAPER_PROVIDER_ORDER = 'nope,brightdata';
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };
    try {
      assert.deepEqual(getPostScraperAdapters().map((a) => a.name), ['brightdata']);
    } finally {
      console.warn = originalWarn;
    }
    assert.ok(warnings.some((w) => /unknown provider/.test(w)));
  });
});

test('the default quota check is the usage store inverted: a provider with no usage row is not over quota', async () => {
  assert.equal(await defaultProviderOverQuota('a-provider-with-no-usage-row-' + suffix), false);
});
