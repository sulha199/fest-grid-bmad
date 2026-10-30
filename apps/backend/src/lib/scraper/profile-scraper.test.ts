import test from 'node:test';
import assert from 'node:assert';
import { ApifyApiError } from 'apify-client';
import type { ProfileScraperAdapter, ScrapedProfile } from '@festgrid/domain';
import { fetchScrapedProfile, getProfileScraperAdapters, registerProfileScraperAdapter } from './profile-scraper.js';
import { apifyProfileAdapter, instagramScraperAdapter, setCallApifyActor, callApifyActor } from './instagram-adapter.js';
import { brightDataProfileAdapter } from './brightdata-profile-adapter.js';
import { scrapeBrightDataProfile, setScrapeBrightDataProfile } from './brightdata-client.js';
import { clearApifyProviderUsage } from './usage-store-test-helpers.js';

const profile: ScrapedProfile = { accountId: '1', username: 'someone', displayName: 'Some One', biography: 'bio', businessCategoryName: null };

function fake(name: 'apify' | 'brightdata', minBudgetMs: number, result: () => Promise<ScrapedProfile | null>): ProfileScraperAdapter & { calls: string[] } {
  const calls: string[] = [];
  return { name, minBudgetMs, calls, fetchProfile: async (handle) => { calls.push(handle); return result(); } };
}

async function withOrder<T>(order: string | undefined, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.PROFILE_SCRAPER_PROVIDER_ORDER;
  if (order === undefined) delete process.env.PROFILE_SCRAPER_PROVIDER_ORDER;
  else process.env.PROFILE_SCRAPER_PROVIDER_ORDER = order;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.PROFILE_SCRAPER_PROVIDER_ORDER;
    else process.env.PROFILE_SCRAPER_PROVIDER_ORDER = saved;
  }
}

test('profile scraper registry and chain', async (t) => {
  t.afterEach(() => {
    // Put the real adapters back after each test swapped one for a fake.
    registerProfileScraperAdapter(apifyProfileAdapter);
    registerProfileScraperAdapter(brightDataProfileAdapter);
  });

  await t.test('the default order is Apify first, Bright Data second', () =>
    withOrder(undefined, async () => {
      assert.deepStrictEqual(getProfileScraperAdapters().map((a) => a.name), ['apify', 'brightdata']);
    }));

  await t.test('PROFILE_SCRAPER_PROVIDER_ORDER switches the first choice with no code change', () =>
    withOrder('brightdata,apify', async () => {
      const apify = fake('apify', 0, async () => profile);
      const brightdata = fake('brightdata', 0, async () => ({ ...profile, username: 'from-brightdata' }));
      registerProfileScraperAdapter(apify);
      registerProfileScraperAdapter(brightdata);

      const found = await fetchScrapedProfile('someone', 'lookup', 25_000);

      assert.strictEqual(found?.username, 'from-brightdata');
      assert.deepStrictEqual(apify.calls, []);
    }));

  await t.test('a single-name order uses only that provider, so the other can be switched off', () =>
    withOrder('brightdata', async () => {
      const apify = fake('apify', 0, async () => assert.fail('must not be called'));
      const brightdata = fake('brightdata', 0, async () => profile);
      registerProfileScraperAdapter(apify);
      registerProfileScraperAdapter(brightdata);

      assert.strictEqual((await fetchScrapedProfile('someone', 'lookup', 25_000))?.accountId, '1');
    }));

  await t.test('Apify failing hands over to Bright Data when the budget allows it', () =>
    withOrder('apify,brightdata', async () => {
      const apify = fake('apify', 0, async () => { throw new Error('Monthly usage hard limit exceeded'); });
      const brightdata = fake('brightdata', 90_000, async () => profile);
      registerProfileScraperAdapter(apify);
      registerProfileScraperAdapter(brightdata);

      assert.strictEqual((await fetchScrapedProfile('someone', 'classification', 200_000))?.accountId, '1');
      assert.deepStrictEqual(brightdata.calls, ['someone']);
    }));

  await t.test('...and not within the API Lambda\'s budget: Bright Data is skipped and Apify\'s own error surfaces', () =>
    withOrder('apify,brightdata', async () => {
      const apify = fake('apify', 0, async () => { throw new Error('Apify request failed while looking up profile'); });
      const brightdata = fake('brightdata', 90_000, async () => profile);
      registerProfileScraperAdapter(apify);
      registerProfileScraperAdapter(brightdata);

      await assert.rejects(() => fetchScrapedProfile('someone', 'lookup', 25_000), /Apify request failed/);
      assert.deepStrictEqual(brightdata.calls, []);
    }));
});

test('the Instagram adapter reaches the profile chain through both profile methods', async (t) => {
  const originalApify = callApifyActor;
  const originalBrightData = scrapeBrightDataProfile;

  t.beforeEach(async () => {
    await clearApifyProviderUsage();
  });
  t.afterEach(() => {
    setCallApifyActor(originalApify);
    setScrapeBrightDataProfile(originalBrightData);
  });

  const apifyMonthlyCap = () => new ApifyApiError(
    {
      status: 403,
      data: { error: { type: 'platform-feature-disabled', message: 'Monthly usage hard limit exceeded' } },
      config: { method: 'post', url: 'https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs' },
      headers: {},
    } as never,
    1
  );

  const brightDataRecord = {
    account: 'infoeventjogja',
    id: '2986602957',
    full_name: 'Info Event Jogja',
    biography: 'Konser, Event, Pameran',
    profile_image_link: 'https://example.invalid/p.jpg',
  };

  await t.test('with the Apify cap reached, a long-budget classification is answered by Bright Data', () =>
    withOrder('apify,brightdata', async () => {
      setCallApifyActor((async () => { throw apifyMonthlyCap(); }) as never);
      const asked: string[] = [];
      setScrapeBrightDataProfile(async (url) => { asked.push(url); return { kind: 'records', records: [brightDataRecord] }; });
      const quiet = console.error;
      console.error = () => {};
      try {
        const profileForClassification = await instagramScraperAdapter.getAccountClassificationProfile('infoeventjogja', { budgetMs: 200_000 });

        assert.deepStrictEqual(profileForClassification, {
          biography: 'Konser, Event, Pameran',
          username: 'infoeventjogja',
          displayName: 'Info Event Jogja',
          businessCategoryName: null,
        });
        assert.deepStrictEqual(asked, ['https://www.instagram.com/infoeventjogja/']);
      } finally {
        console.error = quiet;
      }
    }));

  await t.test('the same failure with the default (interactive) budget never calls Bright Data', () =>
    withOrder('apify,brightdata', async () => {
      setCallApifyActor((async () => { throw apifyMonthlyCap(); }) as never);
      let brightDataCalls = 0;
      setScrapeBrightDataProfile(async () => { brightDataCalls += 1; return { kind: 'records', records: [brightDataRecord] }; });
      const quiet = console.error;
      console.error = () => {};
      try {
        await assert.rejects(() => instagramScraperAdapter.lookupAccountProfile('infoeventjogja'), /Monthly usage hard limit exceeded/);
        assert.strictEqual(brightDataCalls, 0);
      } finally {
        console.error = quiet;
      }
    }));

  await t.test('brightdata first: a lookup with a long budget is answered by Bright Data and Apify is never called', () =>
    withOrder('brightdata,apify', async () => {
      let apifyCalls = 0;
      setCallApifyActor((async () => { apifyCalls += 1; return []; }) as never);
      setScrapeBrightDataProfile(async () => ({ kind: 'records', records: [brightDataRecord] }));

      const result = await instagramScraperAdapter.lookupAccountProfile('infoeventjogja', { budgetMs: 200_000 });

      assert.deepStrictEqual(result, {
        accountId: '2986602957',
        displayName: 'Info Event Jogja',
        username: 'infoeventjogja',
        profileImageUrl: 'https://example.invalid/p.jpg',
      });
      assert.strictEqual(apifyCalls, 0);
    }));
});
