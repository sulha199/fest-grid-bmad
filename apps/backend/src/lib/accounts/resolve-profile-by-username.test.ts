import test from 'node:test';
import assert from 'node:assert/strict';
import { inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { resolveProfileByUsername } from './resolve-profile-by-username.js';

const COLUMNS = {
  id: socialMediaAccountProfiles.id,
  accountId: socialMediaAccountProfiles.accountId,
  username: socialMediaAccountProfiles.username,
};

test('resolveProfileByUsername (AD-35)', async (t) => {
  const createdIds: string[] = [];
  const tag = Math.random().toString(36).slice(2, 8);

  async function makeProfile(accountId: string, username: string, createdAt?: Date) {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId,
        platform: 'instagram',
        username,
        displayName: 'Resolver Test',
        ...(createdAt ? { createdAt } : {}),
      })
      .returning();
    createdIds.push(profile.id);
    return profile;
  }

  t.afterEach(async () => {
    if (createdIds.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdIds));
      createdIds.length = 0;
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
