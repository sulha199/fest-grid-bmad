import test from 'node:test';
import assert from 'node:assert';
import { like } from 'drizzle-orm';
import { ApifyRequestTimeoutError, type ProfileScraperAdapter, type ScrapedProfile } from '@festgrid/domain';
import { profileLookupAttempts } from '@festgrid/database';
import { db } from '../../db/client.js';
import { VendorCallTimeoutError } from '../vendor-gateway/guarded-call.js';
import { isProfileLookupTimeout, profileLookupOutcome, recordProfileLookupAttempt } from './profile-lookup-attempts-store.js';
import { fetchScrapedProfile, registerProfileScraperAdapter } from './profile-scraper.js';
import { apifyProfileAdapter } from './instagram-adapter.js';
import { brightDataProfileAdapter } from './brightdata-profile-adapter.js';

// 2026-10-31: a profile lookup that failed or timed out left no trace at all, so "how often does the Apify profile
// lookup time out" could only be guessed from classification review rows. Every adapter the chain considers now
// leaves one profile_lookup_attempts row.

const PREFIX = 'audit-test-';
const profile: ScrapedProfile = { accountId: '1', username: 'someone', displayName: 'Some One', biography: 'bio', businessCategoryName: null };

async function rowsFor(handle: string) {
  const rows = await db.select().from(profileLookupAttempts).where(like(profileLookupAttempts.handle, handle));
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function fake(name: 'apify' | 'brightdata', minBudgetMs: number, run: () => Promise<ScrapedProfile | null>): ProfileScraperAdapter {
  return { name, minBudgetMs, fetchProfile: run };
}

test('profile lookup attempt audit', async (t) => {
  const saved = process.env.PROFILE_SCRAPER_PROVIDER_ORDER;

  async function cleanUp() {
    await db.delete(profileLookupAttempts).where(like(profileLookupAttempts.handle, `${PREFIX}%`));
  }
  t.before(cleanUp);
  t.beforeEach(() => { process.env.PROFILE_SCRAPER_PROVIDER_ORDER = 'apify,brightdata'; });
  t.afterEach(async () => {
    registerProfileScraperAdapter(apifyProfileAdapter);
    registerProfileScraperAdapter(brightDataProfileAdapter);
    await cleanUp();
  });
  t.after(async () => {
    if (saved === undefined) delete process.env.PROFILE_SCRAPER_PROVIDER_ORDER;
    else process.env.PROFILE_SCRAPER_PROVIDER_ORDER = saved;
    await cleanUp();
  });

  await t.test('isProfileLookupTimeout recognises both timeout types and the vendor clients\' timeout wording only', () => {
    assert.ok(isProfileLookupTimeout(new ApifyRequestTimeoutError('Account profile lookup for classification timed out')));
    assert.ok(isProfileLookupTimeout(new VendorCallTimeoutError("Vendor call timed out after 26000ms")));
    assert.ok(isProfileLookupTimeout(new Error('Account profile lookup timed out')));
    assert.ok(isProfileLookupTimeout(new Error('Bright Data profile snapshot sd_x was still running after 85000ms (budget 90000ms)')));
    assert.ok(isProfileLookupTimeout('timed out'));
    assert.ok(!isProfileLookupTimeout(new Error('Monthly usage hard limit exceeded')));
    assert.ok(!isProfileLookupTimeout(new Error('Apify request failed while looking up profile: Request blocked')));
    assert.ok(!isProfileLookupTimeout('boom'));
  });

  await t.test('profileLookupOutcome maps every chain outcome', () => {
    const base = { adapter: 'apify' as const, budgetMs: 1 };
    assert.strictEqual(profileLookupOutcome({ ...base, outcome: 'found', elapsedMs: 1 }), 'FOUND');
    assert.strictEqual(profileLookupOutcome({ ...base, outcome: 'not-found', elapsedMs: 1 }), 'NOT_FOUND');
    assert.strictEqual(profileLookupOutcome({ ...base, outcome: 'skipped', reason: 'r' }), 'SKIPPED');
    assert.strictEqual(profileLookupOutcome({ ...base, outcome: 'failed', elapsedMs: 1, error: new Error('blocked') }), 'FAILED');
    assert.strictEqual(profileLookupOutcome({ ...base, outcome: 'failed', elapsedMs: 1, error: new Error('x timed out') }), 'TIMED_OUT');
  });

  await t.test('a found lookup writes one FOUND row with the adapter, purpose, duration and budget', async () => {
    registerProfileScraperAdapter(fake('apify', 0, async () => profile));
    const handle = `${PREFIX}found`;

    await fetchScrapedProfile(handle, 'classification', 25_000);

    const [row, ...rest] = await rowsFor(handle);
    assert.strictEqual(rest.length, 0);
    assert.strictEqual(row.vendor, 'APIFY');
    assert.strictEqual(row.purpose, 'CLASSIFICATION');
    assert.strictEqual(row.outcome, 'FOUND');
    assert.strictEqual(row.budgetMs, 25_000);
    assert.ok(row.durationMs !== null && row.durationMs >= 0);
    assert.strictEqual(row.errorMessage, null);
  });

  await t.test('Apify timing out then Bright Data answering writes TIMED_OUT then FOUND', async () => {
    registerProfileScraperAdapter(fake('apify', 0, async () => { throw new ApifyRequestTimeoutError('Account profile lookup timed out'); }));
    registerProfileScraperAdapter(fake('brightdata', 90_000, async () => profile));
    const handle = `${PREFIX}timeout-then-found`;

    await fetchScrapedProfile(handle, 'lookup', 200_000);

    const rows = await rowsFor(handle);
    assert.deepStrictEqual(rows.map((r) => [r.vendor, r.outcome]), [['APIFY', 'TIMED_OUT'], ['BRIGHTDATA', 'FOUND']]);
    assert.match(rows[0].errorMessage ?? '', /timed out/);
    assert.ok(rows[1].budgetMs < 200_000, 'Bright Data got what was left after Apify');
  });

  await t.test('a failure that ends the chain is still recorded, and the original error still surfaces', async () => {
    registerProfileScraperAdapter(fake('apify', 0, async () => { throw new Error('Monthly usage hard limit exceeded'); }));
    const handle = `${PREFIX}failed`;

    await assert.rejects(() => fetchScrapedProfile(handle, 'lookup', 25_000), /Monthly usage hard limit exceeded/);

    const [row] = await rowsFor(handle);
    assert.strictEqual(row.outcome, 'FAILED');
    assert.strictEqual(row.errorMessage, 'Monthly usage hard limit exceeded');
  });

  await t.test('an adapter skipped for lack of budget is recorded as SKIPPED with no duration', async () => {
    registerProfileScraperAdapter(fake('apify', 0, async () => { throw new Error('blocked'); }));
    registerProfileScraperAdapter(fake('brightdata', 90_000, async () => profile));
    const handle = `${PREFIX}skipped`;

    await assert.rejects(() => fetchScrapedProfile(handle, 'lookup', 25_000), /blocked/);

    const rows = await rowsFor(handle);
    assert.deepStrictEqual(rows.map((r) => [r.vendor, r.outcome]), [['APIFY', 'FAILED'], ['BRIGHTDATA', 'SKIPPED']]);
    assert.strictEqual(rows[1].durationMs, null);
    assert.match(rows[1].errorMessage ?? '', /needs 90000ms/);
  });

  await t.test('"not found" is recorded as NOT_FOUND (an answer, not an error)', async () => {
    registerProfileScraperAdapter(fake('apify', 0, async () => null));
    const handle = `${PREFIX}not-found`;

    assert.strictEqual(await fetchScrapedProfile(handle, 'lookup', 25_000), null);

    assert.deepStrictEqual((await rowsFor(handle)).map((r) => r.outcome), ['NOT_FOUND']);
  });

  await t.test('a long error message is cut to 500 characters', async () => {
    const handle = `${PREFIX}long`;
    await recordProfileLookupAttempt({
      purpose: 'lookup',
      handle,
      attempt: { adapter: 'apify', outcome: 'failed', error: new Error('x'.repeat(2_000)), elapsedMs: 5, budgetMs: 25_000 },
    });

    const [row] = await rowsFor(handle);
    assert.strictEqual(row.errorMessage?.length, 500);
  });
});
