import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { db } from '../../db/client.js';
import { isOwnerAccountScrapable, isStoredPostAccountScrapable } from './post-scrape-gate.js';

// AD-34: every accountType x accountTypeStatus combination, through the stored-post lookup AND the
// by-owner lookup, against the rule's own answer (never a second copy of it).

const TYPES = [null, 'ORGANIZER_VENUE_EVENT', 'PERSONAL', 'CURATOR_GUIDE'] as const;
const STATUSES = [null, 'CONFIRMED', 'AWAITING_APPROVAL'] as const;
const expectedScrapable = (type: (typeof TYPES)[number], status: (typeof STATUSES)[number]) =>
  status === null || (status === 'CONFIRMED' && (type === 'ORGANIZER_VENUE_EVENT' || type === 'CURATOR_GUIDE'));

test('post scrape gate (AD-34)', async (t) => {
  const suffix = Date.now();
  const created: string[] = [];
  t.after(async () => {
    if (created.length) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, created));
  });

  let i = 0;
  for (const type of TYPES) {
    for (const status of STATUSES) {
      const n = i++;
      const handle = `gate_${suffix}_${n}`;
      await t.test(`type=${type} status=${status}`, async () => {
        const [profile] = await db
          .insert(socialMediaAccountProfiles)
          .values({ accountId: `acc-${handle}`, platform: 'instagram', displayName: 'Gate', username: handle, accountType: type, accountTypeStatus: status })
          .returning();
        created.push(profile.id);
        const want = expectedScrapable(type, status);
        assert.strictEqual(await isStoredPostAccountScrapable(profile.id), want, 'stored-post lookup');
        assert.strictEqual(await isOwnerAccountScrapable('instagram', handle.toUpperCase()), want, 'by-owner lookup, case-insensitive');
      });
    }
  }

  await t.test('an unknown or missing owner username is allowed (nothing marks it as off limits)', async () => {
    assert.strictEqual(await isOwnerAccountScrapable('instagram', `nobody_${suffix}`), true);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', undefined), true);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', '  '), true);
  });

  await t.test('a profile keyed by the handle (account_id = handle) is found by the owner lookup', async () => {
    const handle = `keyed_${suffix}`;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: handle, platform: 'instagram', displayName: 'Keyed', username: 'different_display_username_' + suffix, accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .returning();
    created.push(profile.id);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', handle), false);
  });

  await t.test('the same handle on another platform is not confused', async () => {
    const handle = `xplat_${suffix}`;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: `acc-${handle}`, platform: 'instagram', displayName: 'X', username: handle, accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .returning();
    created.push(profile.id);
    assert.strictEqual(await isOwnerAccountScrapable('twitter', handle), true);
  });

  await t.test('an id that matches no profile is treated as never classified', async () => {
    assert.strictEqual(await isStoredPostAccountScrapable('00000000-0000-4000-8000-0000000000bb'), true);
  });
});
