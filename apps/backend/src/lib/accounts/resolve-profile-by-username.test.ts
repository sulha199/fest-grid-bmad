import test from 'node:test';
import assert from 'node:assert/strict';
import { inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { resolveProfileByUsername } from './resolve-profile-by-username.js';

const COLUMNS = {
  id: socialMediaAccountProfiles.id,
  accountId: socialMediaAccountProfiles.accountId,
  username: socialMediaAccountProfiles.username,
};

test('resolveProfileByUsername (AD-35)', async (t) => {
  const createdIds: string[] = [];
  const tag = Math.random().toString(36).slice(2, 8);

  const createdUserIds: string[] = [];

  async function makeUser() {
    const [user] = await db
      .insert(users)
      .values({ email: `resolver-${tag}-${createdUserIds.length}@example.test` })
      .returning();
    createdUserIds.push(user.id);
    return user;
  }

  async function subscribe(profileId: string, deletedAt?: Date) {
    const user = await makeUser();
    await db.insert(subscriptions).values({ userId: user.id, accountId: profileId, ...(deletedAt ? { deletedAt } : {}) });
  }

  async function makeProfile(
    accountId: string,
    username: string,
    createdAt?: Date,
    lastScrapedAt?: Date
  ) {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId,
        platform: 'instagram',
        username,
        displayName: 'Resolver Test',
        ...(createdAt ? { createdAt } : {}),
        ...(lastScrapedAt ? { lastScrapedAt } : {}),
      })
      .returning();
    createdIds.push(profile.id);
    return profile;
  }

  t.afterEach(async () => {
    if (createdIds.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.accountId, createdIds));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdIds));
      createdIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
      createdUserIds.length = 0;
    }
  });

  await t.test('matches the username case-insensitively and ignores a leading @', async () => {
    const profile = await makeProfile(`${tag}-handle-1`, `mixed.${tag}`);

    const byLower = await resolveProfileByUsername('instagram', `MIXED.${tag.toUpperCase()}`, COLUMNS);
    const byAt = await resolveProfileByUsername('instagram', `@mixed.${tag}`, COLUMNS);

    assert.equal(byLower?.id, profile.id);
    assert.equal(byAt?.id, profile.id);
  });

  await t.test('falls back to account_id for an all-digit segment when no username matches', async () => {
    const digits = `9${Date.now()}`.slice(0, 12);
    const profile = await makeProfile(digits, `digits.${tag}`);

    const found = await resolveProfileByUsername('instagram', digits, COLUMNS);

    assert.equal(found?.id, profile.id);
  });

  await t.test('username wins over another account\'s numeric account_id', async () => {
    const digits = `8${Date.now()}`.slice(0, 12);
    const owner = await makeProfile(`${tag}-owner`, digits);
    await makeProfile(digits, `other.${tag}`);

    const found = await resolveProfileByUsername('instagram', digits, COLUMNS);

    assert.equal(found?.id, owner.id);
  });

  await t.test('a non-numeric segment never falls back to account_id', async () => {
    await makeProfile(`ig_${tag}_key`, `someone.${tag}`);

    const found = await resolveProfileByUsername('instagram', `ig_${tag}_key`, COLUMNS);

    assert.equal(found, undefined);
  });

  await t.test('twin rows sharing a username resolve to the numeric account_id row, then the oldest', async () => {
    const numeric = `7${Date.now()}`.slice(0, 12);
    const older = new Date('2026-01-01T00:00:00Z');
    const newer = new Date('2026-02-01T00:00:00Z');
    await makeProfile(`${tag}-handle-twin`, `twin.${tag}`, older);
    const numericRow = await makeProfile(numeric, `twin.${tag}`, newer);

    const found = await resolveProfileByUsername('instagram', `twin.${tag}`, COLUMNS);

    assert.equal(found?.id, numericRow.id);
  });

  await t.test('among rows of the same kind the oldest wins', async () => {
    const first = await makeProfile(`${tag}-a`, `same.${tag}`, new Date('2026-01-01T00:00:00Z'));
    await makeProfile(`${tag}-b`, `same.${tag}`, new Date('2026-02-01T00:00:00Z'));

    const found = await resolveProfileByUsername('instagram', `same.${tag}`, COLUMNS);

    assert.equal(found?.id, first.id);
  });

  await t.test('a subscribed handle row beats an older and a newer empty numeric twin', async () => {
    const handle = await makeProfile(`${tag}-sub`, `sub.${tag}`, new Date('2026-03-01T00:00:00Z'));
    await makeProfile(`6${Date.now()}`.slice(0, 12), `sub.${tag}`, new Date('2026-01-01T00:00:00Z'));
    await makeProfile(`5${Date.now()}`.slice(0, 12), `sub.${tag}`, new Date('2026-05-01T00:00:00Z'));
    await subscribe(handle.id);

    const found = await resolveProfileByUsername('instagram', `sub.${tag}`, COLUMNS);

    assert.equal(found?.id, handle.id);
  });

  await t.test('a soft-deleted subscription gives no preference', async () => {
    const handle = await makeProfile(`${tag}-gone`, `gone.${tag}`, new Date('2026-03-01T00:00:00Z'));
    const numericRow = await makeProfile(`4${Date.now()}`.slice(0, 12), `gone.${tag}`, new Date('2026-04-01T00:00:00Z'));
    await subscribe(handle.id, new Date('2026-05-01T00:00:00Z'));

    const found = await resolveProfileByUsername('instagram', `gone.${tag}`, COLUMNS);

    assert.equal(found?.id, numericRow.id);
  });

  await t.test('an active subscription counts even when another subscription of the row is soft-deleted', async () => {
    const handle = await makeProfile(`${tag}-mixed`, `mix.${tag}`, new Date('2026-03-01T00:00:00Z'));
    await makeProfile(`3${Date.now()}`.slice(0, 12), `mix.${tag}`, new Date('2026-01-01T00:00:00Z'));
    await subscribe(handle.id, new Date('2026-05-01T00:00:00Z'));
    await subscribe(handle.id);

    const found = await resolveProfileByUsername('instagram', `mix.${tag}`, COLUMNS);

    assert.equal(found?.id, handle.id);
  });

  await t.test('among unsubscribed rows the scraped one wins over a numeric or older row', async () => {
    await makeProfile(`2${Date.now()}`.slice(0, 12), `scr.${tag}`, new Date('2026-01-01T00:00:00Z'));
    const scraped = await makeProfile(
      `${tag}-scr`,
      `scr.${tag}`,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-11-01T00:00:00Z')
    );

    const found = await resolveProfileByUsername('instagram', `scr.${tag}`, COLUMNS);

    assert.equal(found?.id, scraped.id);
  });

  await t.test('a subscription outranks a scrape', async () => {
    const subscribed = await makeProfile(`${tag}-s2`, `rank.${tag}`, new Date('2026-04-01T00:00:00Z'));
    await makeProfile(`${tag}-r2`, `rank.${tag}`, new Date('2026-01-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'));
    await subscribe(subscribed.id);

    const found = await resolveProfileByUsername('instagram', `rank.${tag}`, COLUMNS);

    assert.equal(found?.id, subscribed.id);
  });

  await t.test('a subscribed numeric row beats an unsubscribed handle row', async () => {
    await makeProfile(`${tag}-h3`, `num.${tag}`, new Date('2026-01-01T00:00:00Z'));
    const numericRow = await makeProfile(`1${Date.now()}`.slice(0, 12), `num.${tag}`, new Date('2026-02-01T00:00:00Z'));
    await subscribe(numericRow.id);

    const found = await resolveProfileByUsername('instagram', `num.${tag}`, COLUMNS);

    assert.equal(found?.id, numericRow.id);
  });

  await t.test('the subscription check follows each row, not just any subscription on the platform', async () => {
    // Guards the correlated subquery: it must compare against the outer profile row.
    const other = await makeProfile(`${tag}-other`, `other.${tag}`);
    await subscribe(other.id);
    const first = await makeProfile(`${tag}-c1`, `corr.${tag}`, new Date('2026-01-01T00:00:00Z'));
    await makeProfile(`${tag}-c2`, `corr.${tag}`, new Date('2026-02-01T00:00:00Z'));

    const found = await resolveProfileByUsername('instagram', `corr.${tag}`, COLUMNS);

    assert.equal(found?.id, first.id);
  });

  await t.test('returns undefined for an unknown segment, an unknown numeric id, and a blank segment', async () => {
    assert.equal(await resolveProfileByUsername('instagram', `nobody.${tag}`, COLUMNS), undefined);
    assert.equal(await resolveProfileByUsername('instagram', '1234567890123456789', COLUMNS), undefined);
    assert.equal(await resolveProfileByUsername('instagram', '  @ ', COLUMNS), undefined);
  });

  await t.test('does not match another platform', async () => {
    await makeProfile(`${tag}-plat`, `plat.${tag}`);

    const found = await resolveProfileByUsername('twitter', `plat.${tag}`, COLUMNS);

    assert.equal(found, undefined);
  });
});
