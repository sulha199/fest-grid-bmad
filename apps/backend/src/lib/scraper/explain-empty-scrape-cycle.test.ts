import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions, brightdataPendingJobs } from '@festgrid/database';
import { inArray } from 'drizzle-orm';
import { explainEmptyScrapeCycle, formatEmptyScrapeCycleReason } from './explain-empty-scrape-cycle.js';

test('formatEmptyScrapeCycleReason', async (t) => {
  const cutoff = new Date('2026-10-24T02:13:00.000Z');

  await t.test('says nobody is eligible when there is nothing subscribed', () => {
    const reason = formatEmptyScrapeCycleReason({
      subscribedScrapable: 0, skippedRecentlyScraped: 0, newestLastScrapedAt: null,
      skippedPendingBrightData: 0, skippedOther: 0, cutoff, mode: 'scheduled',
    });
    assert.match(reason, /No subscribed profile is eligible/);
  });

  await t.test('names how many were skipped as recent, the newest stamp and the cutoff (the 2026-10-24 starvation)', () => {
    const reason = formatEmptyScrapeCycleReason({
      subscribedScrapable: 38, skippedRecentlyScraped: 38, newestLastScrapedAt: new Date('2026-10-23T16:25:00.000Z'),
      skippedPendingBrightData: 0, skippedOther: 0, cutoff, mode: 'recent-window',
    });
    assert.match(reason, /38 subscribed profile\(s\) eligible: 38 skipped as scraped since 2026-10-24T02:13:00.000Z/);
    assert.match(reason, /newest lastScrapedAt 2026-10-23T16:25:00.000Z/);
    assert.match(reason, /Cutoff mode: recent-window/);
  });

  await t.test('omits the newest stamp when nothing was skipped as recent', () => {
    const reason = formatEmptyScrapeCycleReason({
      subscribedScrapable: 2, skippedRecentlyScraped: 0, newestLastScrapedAt: null,
      skippedPendingBrightData: 2, skippedOther: 0, cutoff, mode: 'scheduled',
    });
    assert.doesNotMatch(reason, /newest lastScrapedAt/);
    assert.match(reason, /2 with a Bright Data job in flight/);
  });
});

test('explainEmptyScrapeCycle classifies why subscribed profiles are not due', async (t) => {
  const createdProfiles: string[] = [];
  const createdSubs: string[] = [];
  const createdJobs: string[] = [];

  t.after(async () => {
    if (createdJobs.length > 0) await db.delete(brightdataPendingJobs).where(inArray(brightdataPendingJobs.id, createdJobs));
    if (createdSubs.length > 0) await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubs));
    if (createdProfiles.length > 0) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles));
  });

  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'Must have at least 1 seeded user for test');
  const scheduledTime = new Date();
  // The DB may hold other subscriptions, so compare against a baseline instead of absolute counts.
  const before = await explainEmptyScrapeCycle({ scheduledTime });

  const addProfile = async (key: string, extra: Partial<typeof socialMediaAccountProfiles.$inferInsert> = {}) => {
    const [p] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `test-explain-${key}-` + Date.now(),
      platform: 'instagram',
      displayName: key,
      username: `explain_${key}_` + Date.now(),
      ...extra,
    }).returning();
    createdProfiles.push(p.id);
    const [s] = await db.insert(subscriptions).values({ userId: user.id, accountId: p.id }).returning();
    createdSubs.push(s.id);
    return p;
  };

  const newestStamp = new Date(scheduledTime.getTime() + 5_000);
  await addProfile('recent_a', { lastScrapedAt: new Date(scheduledTime.getTime() + 1_000) });
  await addProfile('recent_b', { lastScrapedAt: newestStamp });
  const pending = await addProfile('pending');
  const [job] = await db.insert(brightdataPendingJobs).values({
    profileId: pending.id,
    snapshotId: 'test-explain-snapshot-' + Date.now(),
    webhookToken: 'test-explain-token-' + Date.now(),
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }).returning();
  createdJobs.push(job.id);
  await addProfile('unregistered', { platform: 'unsupported-platform' });
  // Not eligible at all (AD-34 gate): must not be counted.
  await addProfile('personal', { accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' });

  const after = await explainEmptyScrapeCycle({ scheduledTime });

  assert.strictEqual(after.mode, 'scheduled');
  assert.strictEqual(after.subscribedScrapable - before.subscribedScrapable, 4, 'personal account is outside the scrape gate');
  assert.strictEqual(after.skippedRecentlyScraped - before.skippedRecentlyScraped, 2);
  assert.strictEqual(after.skippedPendingBrightData - before.skippedPendingBrightData, 1);
  assert.strictEqual(after.skippedOther - before.skippedOther, 1);
  assert.ok(after.newestLastScrapedAt && after.newestLastScrapedAt >= newestStamp, 'reports the newest lastScrapedAt among the skipped');
  assert.ok(after.reason.includes('skipped as scraped since'));
});
