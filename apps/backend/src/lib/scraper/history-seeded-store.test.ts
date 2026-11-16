import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { isHistorySeeded, markHistorySeeded } from './history-seeded-store.js';

test('history seeded store', async (t) => {
  let profileId: string;

  t.before(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'seeded-store-' + Date.now(), platform: 'instagram', username: 'seeded_store_user', displayName: 'Seeded Store' })
      .returning({ id: socialMediaAccountProfiles.id });
    profileId = profile.id;
  });

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
  });

  await t.test('a new profile is not seeded, and an unknown profile reads as not seeded', async () => {
    assert.strictEqual(await isHistorySeeded(profileId), false);
    assert.strictEqual(await isHistorySeeded('00000000-0000-0000-0000-000000000000'), false);
  });

  await t.test('marking seeds the profile and keeps the first time on later calls', async () => {
    await markHistorySeeded(profileId);
    assert.strictEqual(await isHistorySeeded(profileId), true);
    const [first] = await db.select({ at: socialMediaAccountProfiles.historySeededAt }).from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));

    await markHistorySeeded(profileId);
    const [second] = await db.select({ at: socialMediaAccountProfiles.historySeededAt }).from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
    assert.strictEqual(second.at?.getTime(), first.at?.getTime());
  });

  await t.test('a failed write is swallowed, so it cannot fail the scrape that stored the posts', async () => {
    await assert.doesNotReject(markHistorySeeded('not-a-uuid'));
  });
});
