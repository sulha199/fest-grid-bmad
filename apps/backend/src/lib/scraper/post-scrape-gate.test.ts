import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { db } from '../../db/client.js';
import { isScrapableAccountType } from '@festgrid/domain/scraper';
import { isOwnerAccountScrapable, isStoredPostAccountScrapable } from './post-scrape-gate.js';

// AD-34: every accountType x accountTypeStatus combination, through the stored-post lookup AND the
// by-owner lookup. The expectation is the rule's own answer (`isScrapableAccountType`), so this file
// proves the lookups find the right row and ask the rule; the rule's table is tested in packages/domain.

const TYPES = [null, 'ORGANIZER_VENUE_EVENT', 'PERSONAL', 'CURATOR_GUIDE'] as const;
const STATUSES = [null, 'CONFIRMED', 'AWAITING_APPROVAL'] as const;
const expectedScrapable = (type: (typeof TYPES)[number], status: (typeof STATUSES)[number]) => isScrapableAccountType(type, status);

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
        assert.strictEqual(await isOwnerAccountScrapable('instagram', { username: handle.toUpperCase() }), want, 'by-owner lookup, case-insensitive');
      });
    }
  }

  await t.test('an unknown or missing owner username is allowed (nothing marks it as off limits)', async () => {
    assert.strictEqual(await isOwnerAccountScrapable('instagram', { username: `nobody_${suffix}` }), true);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', {}), true);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', { username: '  ', ownerId: ' ' }), true);
  });

  await t.test('a profile keyed by the handle (account_id = handle) is found by the owner lookup', async () => {
    const handle = `keyed_${suffix}`;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: handle, platform: 'instagram', displayName: 'Keyed', username: 'different_display_username_' + suffix, accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .returning();
    created.push(profile.id);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', { username: handle }), false);
  });

  await t.test('the same handle on another platform is not confused', async () => {
    const handle = `xplat_${suffix}`;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: `acc-${handle}`, platform: 'instagram', displayName: 'X', username: handle, accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .returning();
    created.push(profile.id);
    assert.strictEqual(await isOwnerAccountScrapable('twitter', { username: handle }), true);
  });

  await t.test('an id that matches no profile is treated as never classified', async () => {
    assert.strictEqual(await isStoredPostAccountScrapable('00000000-0000-4000-8000-0000000000bb'), true);
  });

  await t.test('a profile keyed by the platform numeric id is found by the owner id, even when the scraped username is stale', async () => {
    const numericId = `${suffix}77`;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: numericId, platform: 'instagram', displayName: 'Numeric', username: 'old_name_' + suffix, accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .returning();
    created.push(profile.id);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', { username: 'renamed_' + suffix, ownerId: numericId }), false);
    assert.strictEqual(await isOwnerAccountScrapable('instagram', { ownerId: `${suffix}78` }), true, 'a different id matches nothing');
  });
});
