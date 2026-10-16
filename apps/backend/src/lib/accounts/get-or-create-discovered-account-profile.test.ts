import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { and, eq } from 'drizzle-orm';
import { getOrCreateDiscoveredAccountProfile } from './get-or-create-discovered-account-profile.js';

test('getOrCreateDiscoveredAccountProfile', async (t) => {
  const createdPlatformAccountIds: { platform: string; accountId: string }[] = [];

  t.afterEach(async () => {
    for (const { platform, accountId } of createdPlatformAccountIds) {
      await db
        .delete(socialMediaAccountProfiles)
        .where(
          and(
            eq(socialMediaAccountProfiles.platform, platform),
            eq(socialMediaAccountProfiles.accountId, accountId)
          )
        );
    }
    createdPlatformAccountIds.length = 0;
  });

  await t.test('a brand-new (platform, accountId) creates a row with firstSeen/lastSeen ~now, isVerifiedForDiscovery false, discoverySource set, and displayName/username fallback', async () => {
    const accountId = 'discovered-' + Math.random().toString(36).slice(2, 9);
    createdPlatformAccountIds.push({ platform: 'instagram', accountId });

    const before = Date.now();
    const profile = await getOrCreateDiscoveredAccountProfile({
      platform: 'instagram',
      accountId,
      username: 'the_coauthor',
      vendor: 'apify',
      runId: 'run-abc',
    });
    const after = Date.now();

    assert.ok(profile);
    assert.equal(profile.platform, 'instagram');
    assert.equal(profile.accountId, accountId);
    assert.equal(profile.username, 'the_coauthor');
    assert.equal(profile.displayName, 'the_coauthor');
    assert.equal(profile.isVerifiedForDiscovery, false);
    assert.deepEqual(profile.discoverySource, { vendor: 'apify', runId: 'run-abc' });
    assert.ok(profile.firstSeen);
    assert.ok(profile.lastSeen);
    const firstSeenMs = new Date(profile.firstSeen as unknown as string).getTime();
    const lastSeenMs = new Date(profile.lastSeen as unknown as string).getTime();
    assert.ok(firstSeenMs >= before && firstSeenMs <= after);
    assert.ok(lastSeenMs >= before && lastSeenMs <= after);
  });

  await t.test('calling it again for the same (platform, accountId) advances lastSeen but leaves firstSeen/discoverySource/displayName/username unchanged', async () => {
    const accountId = 'discovered-' + Math.random().toString(36).slice(2, 9);
    createdPlatformAccountIds.push({ platform: 'instagram', accountId });

    const first = await getOrCreateDiscoveredAccountProfile({
      platform: 'instagram',
      accountId,
      username: 'original_user',
      displayName: 'Original Display',
      vendor: 'apify',
      runId: 'run-1',
    });

    // Ensure a detectable time delta between the two calls.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await getOrCreateDiscoveredAccountProfile({
      platform: 'instagram',
      accountId,
      username: 'changed_username_should_be_ignored',
      displayName: 'Changed Display Should Be Ignored',
      vendor: 'apify',
      runId: 'run-2',
    });

    assert.equal(second.id, first.id);
    assert.equal(
      new Date(second.firstSeen as unknown as string).getTime(),
      new Date(first.firstSeen as unknown as string).getTime()
    );
    assert.ok(
      new Date(second.lastSeen as unknown as string).getTime() >
        new Date(first.lastSeen as unknown as string).getTime()
    );
    assert.deepEqual(second.discoverySource, { vendor: 'apify', runId: 'run-1' });
    assert.equal(second.displayName, 'Original Display');
    assert.equal(second.username, 'original_user');
  });

  await t.test('a coauthor-shaped identity (username present, no displayName) resolves displayName to the username', async () => {
    const accountId = 'discovered-' + Math.random().toString(36).slice(2, 9);
    createdPlatformAccountIds.push({ platform: 'instagram', accountId });

    const profile = await getOrCreateDiscoveredAccountProfile({
      platform: 'instagram',
      accountId,
      username: 'coauthor_handle',
      vendor: 'apify',
    });

    assert.equal(profile.displayName, 'coauthor_handle');
    assert.equal(profile.username, 'coauthor_handle');
  });

  await t.test('an identity with neither username nor displayName resolves both to the raw accountId', async () => {
    const accountId = 'discovered-' + Math.random().toString(36).slice(2, 9);
    createdPlatformAccountIds.push({ platform: 'instagram', accountId });

    const profile = await getOrCreateDiscoveredAccountProfile({
      platform: 'instagram',
      accountId,
      vendor: 'apify',
    });

    assert.equal(profile.displayName, accountId);
    assert.equal(profile.username, accountId);
  });

  await t.test('STOPGAP BUG-059: a username matching an existing handle-keyed profile returns that profile and creates no numeric twin', async () => {
    const suffix = Math.random().toString(36).slice(2, 9);
    const handle = 'twin_guard_' + suffix;
    const numericId = '9' + Date.now();
    createdPlatformAccountIds.push({ platform: 'instagram', accountId: handle });
    createdPlatformAccountIds.push({ platform: 'instagram', accountId: numericId });

    const [handleKeyed] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: handle, platform: 'instagram', username: handle, displayName: 'Handle Keyed' })
      .returning();

    const resolved = await getOrCreateDiscoveredAccountProfile({
      platform: 'instagram',
      accountId: numericId,
      username: handle.toUpperCase(),
      vendor: 'apify',
    });

    assert.equal(resolved.id, handleKeyed.id, 'the existing handle-keyed row is returned (case-insensitive username match)');
    assert.ok(resolved.lastSeen, 'lastSeen is advanced on the reused row');
    const twin = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(and(eq(socialMediaAccountProfiles.platform, 'instagram'), eq(socialMediaAccountProfiles.accountId, numericId)));
    assert.equal(twin.length, 0, 'no numeric-keyed row was created');
  });

  await t.test('STOPGAP BUG-059: a username that only matches a numeric-keyed row does not short-circuit the normal upsert', async () => {
    const suffix = Math.random().toString(36).slice(2, 9);
    const username = 'numeric_only_' + suffix;
    const firstId = '8' + Date.now();
    createdPlatformAccountIds.push({ platform: 'instagram', accountId: firstId });

    const first = await getOrCreateDiscoveredAccountProfile({ platform: 'instagram', accountId: firstId, username, vendor: 'apify' });
    const again = await getOrCreateDiscoveredAccountProfile({ platform: 'instagram', accountId: firstId, username, vendor: 'apify' });

    assert.equal(again.id, first.id, 'same (platform, accountId) still resolves to the same row');
    assert.equal(again.accountId, firstId);
  });
});
