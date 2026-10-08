import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { verifyAccountProfileForDiscovery } from './verify-account-profile-for-discovery.js';

test('verifyAccountProfileForDiscovery', async (t) => {
  const suffix = Date.now().toString();
  const seededIds: string[] = [];

  t.after(async () => {
    for (const id of seededIds) {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, id));
    }
  });

  await t.test('(a) a false profile flips to true and the update is returned', async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        platform: 'instagram',
        accountId: 'verify-flip-a-' + suffix,
        username: 'verify_flip_a',
        displayName: 'Verify Flip A',
        isVerifiedForDiscovery: false,
      })
      .returning();
    seededIds.push(profile.id);

    const result = await verifyAccountProfileForDiscovery(profile.id);
    assert.ok(result, 'should return the updated row');
    assert.strictEqual(result!.isVerifiedForDiscovery, true);

    const [row] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, profile.id));
    assert.strictEqual(row.isVerifiedForDiscovery, true);
  });

  await t.test('(b) an already-true profile is untouched and returns undefined', async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        platform: 'instagram',
        accountId: 'verify-flip-b-' + suffix,
        username: 'verify_flip_b',
        displayName: 'Verify Flip B',
        isVerifiedForDiscovery: true,
      })
      .returning();
    seededIds.push(profile.id);

    const result = await verifyAccountProfileForDiscovery(profile.id);
    assert.strictEqual(result, undefined);

    const [row] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, profile.id));
    assert.strictEqual(row.isVerifiedForDiscovery, true);
  });

  await t.test('(c) a non-existent id returns undefined without throwing', async () => {
    const result = await verifyAccountProfileForDiscovery('00000000-0000-0000-0000-000000000000');
    assert.strictEqual(result, undefined);
  });
});
