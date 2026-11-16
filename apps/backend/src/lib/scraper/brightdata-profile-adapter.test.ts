import test from 'node:test';
import assert from 'node:assert';
import {
  BRIGHTDATA_PROFILE_MIN_BUDGET_MS,
  BrightDataProfileUnavailableError,
  brightDataProfileAdapter,
  mapBrightDataProfileRecord,
} from './brightdata-profile-adapter.js';
import { scrapeBrightDataProfile, setScrapeBrightDataProfile, type BrightDataProfileScrape } from './brightdata-client.js';
import { clearBrightDataProviderUsage } from './usage-store-test-helpers.js';

// Record fields as returned by Bright Data's Instagram Profiles dataset on 2026-10-31. A non-business account has
// no `category_name` / `business_category_name` at all.
const record = {
  account: 'infoeventjogja',
  id: '2986602957',
  fbid: '17841402968723325',
  full_name: 'Info Event Jogja',
  profile_name: 'Info Event Jogja',
  biography: 'Konser, Event, Pameran, Lomba, Festival',
  followers: 69409,
  posts_count: 7835,
  is_private: false,
  profile_image_link: 'https://example.invalid/profile.jpg',
  url: 'https://www.instagram.com/infoeventjogja/',
};

test('mapBrightDataProfileRecord', async (t) => {
  await t.test('a lookup keeps the numeric id, handle, name and picture', () => {
    assert.deepStrictEqual(mapBrightDataProfileRecord(record, 'lookup'), {
      accountId: '2986602957',
      username: 'infoeventjogja',
      displayName: 'Info Event Jogja',
      profileImageUrl: 'https://example.invalid/profile.jpg',
      biography: 'Konser, Event, Pameran, Lomba, Festival',
      businessCategoryName: null,
    });
  });

  await t.test('a classification carries the biography and the business category when there is one', () => {
    const profile = mapBrightDataProfileRecord({ ...record, business_category_name: 'Event Planner' }, 'classification');
    assert.strictEqual(profile?.biography, 'Konser, Event, Pameran, Lomba, Festival');
    assert.strictEqual(profile?.businessCategoryName, 'Event Planner');
  });

  await t.test('category_name is the fallback when business_category_name is absent', () => {
    assert.strictEqual(mapBrightDataProfileRecord({ ...record, category_name: 'Concert Tour' }, 'classification')?.businessCategoryName, 'Concert Tour');
  });

  await t.test('a numeric id is read as text', () => {
    assert.strictEqual(mapBrightDataProfileRecord({ ...record, id: 2986602957 }, 'lookup')?.accountId, '2986602957');
  });

  await t.test('a classification of a profile with no biography or no name is null, as on the Apify path', () => {
    assert.strictEqual(mapBrightDataProfileRecord({ ...record, biography: '' }, 'classification'), null);
    assert.strictEqual(mapBrightDataProfileRecord({ ...record, biography: null }, 'classification'), null);
    assert.strictEqual(mapBrightDataProfileRecord({ ...record, full_name: null }, 'classification'), null);
    // ...but the same profile is still fine for a lookup, which needs identity only.
    assert.ok(mapBrightDataProfileRecord({ ...record, biography: '' }, 'lookup'));
  });

  await t.test('profile_name stands in for a missing full_name in a lookup, the handle for both', () => {
    assert.strictEqual(mapBrightDataProfileRecord({ ...record, full_name: null }, 'lookup')?.displayName, 'Info Event Jogja');
    assert.strictEqual(mapBrightDataProfileRecord({ ...record, full_name: null, profile_name: null }, 'lookup')?.displayName, 'infoeventjogja');
  });

  await t.test('a record with no handle or id is not a profile: it throws instead of being stored', () => {
    assert.throws(() => mapBrightDataProfileRecord({ ...record, id: undefined }, 'lookup'), BrightDataProfileUnavailableError);
    assert.throws(() => mapBrightDataProfileRecord({ account: undefined, id: '1' }, 'lookup'), BrightDataProfileUnavailableError);
    assert.throws(() => mapBrightDataProfileRecord(null, 'lookup'), BrightDataProfileUnavailableError);
  });
});

test('brightDataProfileAdapter', async (t) => {
  const original = scrapeBrightDataProfile;
  let requested: { url: string; budgetMs: number }[];
  let reply: BrightDataProfileScrape | Error;

  t.beforeEach(async () => {
    await clearBrightDataProviderUsage();
    requested = [];
    reply = { kind: 'records', records: [record] };
    setScrapeBrightDataProfile(async (url, budgetMs) => {
      requested.push({ url, budgetMs });
      if (reply instanceof Error) throw reply;
      return reply;
    });
  });
  t.after(async () => {
    setScrapeBrightDataProfile(original);
    await clearBrightDataProviderUsage();
  });

  await t.test('is the slow adapter: it needs more time than the API Lambda has', () => {
    assert.strictEqual(brightDataProfileAdapter.name, 'brightdata');
    assert.ok(BRIGHTDATA_PROFILE_MIN_BUDGET_MS > 28_000);
    assert.strictEqual(brightDataProfileAdapter.minBudgetMs, BRIGHTDATA_PROFILE_MIN_BUDGET_MS);
  });

  await t.test('a bare handle becomes the profile url, with the adapter\'s budget passed on', async () => {
    const profile = await brightDataProfileAdapter.fetchProfile('@infoeventjogja', { purpose: 'lookup', budgetMs: 120_000 });

    assert.strictEqual(profile?.accountId, '2986602957');
    assert.deepStrictEqual(requested, [{ url: 'https://www.instagram.com/infoeventjogja/', budgetMs: 120_000 }]);
  });

  await t.test('a full url is used as given', async () => {
    await brightDataProfileAdapter.fetchProfile('https://www.instagram.com/someone/', { purpose: 'lookup', budgetMs: 120_000 });
    assert.strictEqual(requested[0].url, 'https://www.instagram.com/someone/');
  });

  await t.test('dead_page is "no such profile": null, an answer that ends the chain', async () => {
    reply = { kind: 'no-records', errorCode: 'dead_page', errorMessage: 'dead page (404)' };
    assert.strictEqual(await brightDataProfileAdapter.fetchProfile('ghost', { purpose: 'lookup', budgetMs: 120_000 }), null);
  });

  await t.test('an empty result is NOT an answer: it throws so another provider can try (the 2026-10-21 outage)', async () => {
    reply = { kind: 'no-records' };
    await assert.rejects(
      () => brightDataProfileAdapter.fetchProfile('someone', { purpose: 'lookup', budgetMs: 120_000 }),
      BrightDataProfileUnavailableError
    );
    reply = { kind: 'no-records', errorCode: 'bucket_rate_limit' };
    await assert.rejects(
      () => brightDataProfileAdapter.fetchProfile('someone', { purpose: 'lookup', budgetMs: 120_000 }),
      /bucket_rate_limit/
    );
  });

  await t.test('a vendor failure propagates unchanged', async () => {
    reply = new Error('Bright Data profile snapshot sd_x was still running');
    await assert.rejects(
      () => brightDataProfileAdapter.fetchProfile('someone', { purpose: 'lookup', budgetMs: 120_000 }),
      /still running/
    );
  });
});
