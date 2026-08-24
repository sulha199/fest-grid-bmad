import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, defaultLocationChangeRequests, users } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { applyDefaultLocationChange } from './apply-default-location-change.js';

test('applyDefaultLocationChange - helper integration', async (t) => {
  let testUser: any;
  let testProfile: any;

  t.beforeEach(async () => {
    // Seed a mock user for the test
    const [user] = await db
      .insert(users)
      .values({
        email: 'user-' + Math.random().toString(36).slice(2, 9) + '@test.com',
        role: 'user',
        name: 'Test User',
      })
      .returning();
    testUser = user;

    // Seed a mock profile
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        platform: 'instagram',
        accountId: 'test-account-id-' + Math.random().toString(36).slice(2, 9),
        username: 'test_user',
        displayName: 'Test Profile',
        defaultLocation: null,
      })
      .returning();
    testProfile = profile;
  });

  t.afterEach(async () => {
    if (testProfile) {
      await db.delete(defaultLocationChangeRequests).where(eq(defaultLocationChangeRequests.accountId, testProfile.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    }
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });

  await t.test('1. USER path: successfully applies location change and creates pending change request', async () => {
    const newLocation = {
      formattedAddress: 'Times Square, New York, NY 10036, USA',
      placeName: 'Times Square',
      coordinates: { latitude: 40.758, longitude: -73.985 },
    };

    const result = await applyDefaultLocationChange({
      accountId: testProfile.id,
      newLocation,
      previousLocation: null,
      changedByUserId: testUser.id,
      changeSource: 'USER',
      accountDisplayName: testProfile.displayName,
    });

    assert.equal(result.applied, true);

    // Verify DB update
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.ok(profile.defaultLocation);
    assert.equal((profile.defaultLocation as any).placeName, 'Times Square');

    // Verify change request created
    const reqs = await db
      .select()
      .from(defaultLocationChangeRequests)
      .where(eq(defaultLocationChangeRequests.accountId, testProfile.id));

    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].status, 'PENDING_REVIEW');
    assert.equal(reqs[0].changeSource, 'USER');
    assert.equal(reqs[0].changedByUserId, testUser.id);
  });

  await t.test('2. AI_INFERENCE path with onlyIfCurrentlyNull: true succeeds when defaultLocation is currently null', async () => {
    const newLocation = {
      formattedAddress: 'Central Park, New York, NY, USA',
      placeName: 'Central Park',
      coordinates: { latitude: 40.78, longitude: -73.96 },
    };

    const result = await applyDefaultLocationChange({
      accountId: testProfile.id,
      newLocation,
      previousLocation: null,
      changedByUserId: null,
      changeSource: 'AI_INFERENCE',
      accountDisplayName: testProfile.displayName,
      onlyIfCurrentlyNull: true,
    });

    assert.equal(result.applied, true);

    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.ok(profile.defaultLocation);
    assert.equal((profile.defaultLocation as any).placeName, 'Central Park');

    const reqs = await db
      .select()
      .from(defaultLocationChangeRequests)
      .where(eq(defaultLocationChangeRequests.accountId, testProfile.id));

    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].status, 'PENDING_REVIEW');
    assert.equal(reqs[0].changeSource, 'AI_INFERENCE');
    assert.equal(reqs[0].changedByUserId, null);
  });

  await t.test('3. AI_INFERENCE path with onlyIfCurrentlyNull: true fails and racing guard prevents concurrent write when defaultLocation is already set', async () => {
    // Pre-set defaultLocation non-null to simulate a race condition where another scraping job already updated it
    await db
      .update(socialMediaAccountProfiles)
      .set({
        defaultLocation: {
          placeName: 'Already Won Race',
          formattedAddress: 'Already Won Race Address',
          coordinates: { latitude: 0, longitude: 0 }
        }
      })
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    const newLocation = {
      formattedAddress: 'Losing Race Location Address',
      placeName: 'Losing Race Location',
      coordinates: { latitude: 0, longitude: 0 },
    };

    const result = await applyDefaultLocationChange({
      accountId: testProfile.id,
      newLocation,
      previousLocation: null,
      changedByUserId: null,
      changeSource: 'AI_INFERENCE',
      accountDisplayName: testProfile.displayName,
      onlyIfCurrentlyNull: true,
    });

    // Assert it fails to apply (applied is false)
    assert.equal(result.applied, false);

    // Verify DB defaultLocation is UNCHANGED (retains 'Already Won Race')
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal((profile.defaultLocation as any).placeName, 'Already Won Race');

    // Verify NO change request is inserted
    const reqs = await db
      .select()
      .from(defaultLocationChangeRequests)
      .where(eq(defaultLocationChangeRequests.accountId, testProfile.id));

    assert.equal(reqs.length, 0);
  });
});
