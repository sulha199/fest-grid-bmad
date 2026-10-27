import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, defaultLocationChangeRequests } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  backfillAccountProfileAndInferDefaultLocation,
  setResolveLocationSeam,
  resolveLocationSeam,
} from './backfill-account-profile-and-infer-location.js';
import { setCallGemini, callGeminiRef } from '../ai-gateway/system-key-adapter.js';

test('backfillAccountProfileAndInferDefaultLocation orchestration', async (t) => {
  let testProfile: any;

  t.beforeEach(async () => {
    // Insert a fresh test profile for each subtest
    const handle = 'test_handle_' + Math.random().toString(36).slice(2, 9);
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        platform: 'instagram',
        // A handle-keyed subscribed row: account_id is the handle the user typed and username starts equal
        // to it. The prefix keeps the random suffix from ever being all digits (a numeric-keyed row).
        accountId: handle,
        username: handle,
        displayName: 'Old Display Name',
        defaultLocation: null,
      })
      .returning();
    testProfile = profile;
  });

  t.afterEach(async () => {
    // Clean up
    if (testProfile) {
      await db.delete(defaultLocationChangeRequests).where(eq(defaultLocationChangeRequests.accountId, testProfile.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    }
    setCallGemini(callGeminiRef);
    setResolveLocationSeam(resolveLocationSeam);
  });

  await t.test('1. Returns early when scrapedPosts is empty', async () => {
    await backfillAccountProfileAndInferDefaultLocation(testProfile.id, []);
    
    // Assert profile remains unmodified
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.username, testProfile.accountId);
    assert.equal(profile.displayName, 'Old Display Name');
    assert.equal(profile.defaultLocation, null);
  });

  await t.test('2. Profile backfill only: skips Gemini when defaultLocation is already set', async () => {
    // Pre-populate defaultLocation so Gemini is skipped
    await db
      .update(socialMediaAccountProfiles)
      .set({
        defaultLocation: {
          placeName: 'Preset',
          formattedAddress: 'Preset Address',
          coordinates: { latitude: 0, longitude: 0 }
        }
      })
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    let geminiCalled = false;
    setCallGemini(async () => {
      geminiCalled = true;
      return { text: '{}' };
    });

    await backfillAccountProfileAndInferDefaultLocation(testProfile.id, [
      {
        content: 'No location signal here',
        postUrl: 'https://post-url',
        publishedAt: new Date().toISOString(),
        ownerDisplayName: 'New Display Name',
        ownerUsername: testProfile.accountId,
      },
    ]);

    // Assert the display name is backfilled from the profile's own post; the username is untouched
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.username, testProfile.accountId);
    assert.equal(profile.displayName, 'New Display Name');
    assert.equal(geminiCalled, false);
  });

  await t.test('3. Location inference only: backfills nothing but infers location via Gemini & Geoapify', async () => {
    setCallGemini(async () => {
      return {
        text: JSON.stringify({
          locationFound: true,
          placeDescription: 'Central Park, NY',
          confidence: 0.8,
        }),
      };
    });

    let geocodeQuery: any = null;
    setResolveLocationSeam(async (query) => {
      geocodeQuery = query;
      return {
        formattedAddress: 'Central Park, New York, NY, USA',
        placeName: 'Central Park',
        coordinates: { latitude: 40.78, longitude: -73.96 },
      };
    });

    await backfillAccountProfileAndInferDefaultLocation(testProfile.id, [
      {
        content: 'Check out Central Park!',
        postUrl: 'https://post-url',
        publishedAt: new Date().toISOString(),
        ownerDisplayName: 'Old Display Name', // no change
        ownerUsername: testProfile.accountId, // no change
      },
    ]);

    // Assert profile defaultLocation updated and backfill is untouched
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.username, testProfile.accountId);
    assert.equal(profile.displayName, 'Old Display Name');
    assert.ok(profile.defaultLocation);
    assert.equal((profile.defaultLocation as any).placeName, 'Central Park');
    assert.deepEqual(geocodeQuery, { kind: 'ADDRESS', address: 'Central Park, NY' });

    // Assert DefaultLocationChangeRequest row is inserted for AI_INFERENCE
    const reqs = await db
      .select()
      .from(defaultLocationChangeRequests)
      .where(eq(defaultLocationChangeRequests.accountId, testProfile.id));

    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].changeSource, 'AI_INFERENCE');
    assert.equal(reqs[0].status, 'PENDING_REVIEW');
    assert.equal(reqs[0].changedByUserId, null);
    assert.equal(reqs[0].previousLocation, null);
  });

  await t.test('4. Both profile backfill and location inference simultaneously', async () => {
    setCallGemini(async () => {
      return {
        text: JSON.stringify({
          locationFound: true,
          placeDescription: 'Sydney Opera House',
          confidence: 0.8,
        }),
      };
    });

    setResolveLocationSeam(async () => {
      return {
        formattedAddress: 'Bennelong Point, Sydney NSW 2000, Australia',
        placeName: 'Sydney Opera House',
        coordinates: { latitude: -33.85, longitude: 151.21 },
      };
    });

    await backfillAccountProfileAndInferDefaultLocation(testProfile.id, [
      {
        content: 'Sydney Opera House performance tonight!',
        postUrl: 'https://post-url',
        publishedAt: new Date().toISOString(),
        ownerDisplayName: 'Backfilled Display Name',
        ownerUsername: testProfile.accountId,
      },
    ]);

    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.username, testProfile.accountId);
    assert.equal(profile.displayName, 'Backfilled Display Name');
    assert.ok(profile.defaultLocation);
    assert.equal((profile.defaultLocation as any).placeName, 'Sydney Opera House');
  });

  await t.test('5. Skips Gemini when there is no locationName or content signal in the entire batch', async () => {
    let geminiCalled = false;
    setCallGemini(async () => {
      geminiCalled = true;
      return { text: '{}' };
    });

    await backfillAccountProfileAndInferDefaultLocation(testProfile.id, [
      {
        content: '  ',
        postUrl: 'https://post-url',
        publishedAt: new Date().toISOString(),
        locationName: '',
      },
    ]);

    assert.equal(geminiCalled, false);
  });

  await t.test('6. Swallows errors gracefully when Gemini or Geolocation throws', async () => {
    setCallGemini(async () => {
      throw new Error('Gemini API Error');
    });

    // Calling the function should not throw
    await assert.doesNotReject(async () => {
      await backfillAccountProfileAndInferDefaultLocation(testProfile.id, [
        {
          content: 'Some content',
          postUrl: 'https://post-url',
          publishedAt: new Date().toISOString(),
        },
      ]);
    });

    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.defaultLocation, null);
  });

  const post = (owner: { ownerUsername?: string; ownerDisplayName?: string; ownerId?: string }, n = 1) => ({
    content: 'No location signal here',
    postUrl: `https://post-url/${n}`,
    publishedAt: new Date().toISOString(),
    ...owner,
  });

  const readProfile = async () => {
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));
    return profile;
  };

  await t.test('7. BUG-081: a collab/repost first post never rewrites username or displayName', async () => {
    await db
      .update(socialMediaAccountProfiles)
      .set({ defaultLocation: { placeName: 'Preset', formattedAddress: 'Preset', coordinates: { latitude: 0, longitude: 0 } } })
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    await backfillAccountProfileAndInferDefaultLocation(testProfile.id, [
      post({ ownerUsername: 'kulonprogohalfmarathon', ownerDisplayName: 'Kulonprogo Half Marathon' }),
    ]);

    const profile = await readProfile();
    assert.equal(profile.username, testProfile.accountId);
    assert.equal(profile.displayName, 'Old Display Name');
  });

  await t.test('8. BUG-081: takes the first MATCHING post, not the first post with an owner', async () => {
    await db
      .update(socialMediaAccountProfiles)
      .set({ defaultLocation: { placeName: 'Preset', formattedAddress: 'Preset', coordinates: { latitude: 0, longitude: 0 } } })
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    await backfillAccountProfileAndInferDefaultLocation(testProfile.id, [
      post({ ownerUsername: 'someone.else', ownerDisplayName: 'Someone Else' }, 1),
      post({ ownerUsername: testProfile.accountId.toUpperCase(), ownerDisplayName: 'Own Name' }, 2),
      post({ ownerUsername: testProfile.accountId, ownerDisplayName: 'Later Own Name' }, 3),
    ]);

    const profile = await readProfile();
    // display name from the first own post; username corrected to the owner's spelling (case-only difference)
    assert.equal(profile.displayName, 'Own Name');
    assert.equal(profile.username.toLowerCase(), testProfile.accountId.toLowerCase());
    assert.notEqual(profile.username.toLowerCase(), 'someone.else');
  });

  await t.test('9. BUG-081: a numeric-keyed row is backfilled only from a post with its own ownerId', async () => {
    const numericId = String(9_000_000_000 + Math.floor(Math.random() * 1_000_000));
    const [numeric] = await db
      .insert(socialMediaAccountProfiles)
      .values({ platform: 'instagram', accountId: numericId, username: numericId, displayName: numericId })
      .returning();
    try {
      await db
        .update(socialMediaAccountProfiles)
        .set({ defaultLocation: { placeName: 'Preset', formattedAddress: 'Preset', coordinates: { latitude: 0, longitude: 0 } } })
        .where(eq(socialMediaAccountProfiles.id, numeric.id));

      await backfillAccountProfileAndInferDefaultLocation(numeric.id, [
        post({ ownerId: '111', ownerUsername: 'foreign', ownerDisplayName: 'Foreign' }, 1),
        post({ ownerId: numericId, ownerUsername: 'real.owner', ownerDisplayName: 'Real Owner' }, 2),
      ]);

      const [after] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, numeric.id));
      assert.equal(after.username, 'real.owner');
      assert.equal(after.displayName, 'Real Owner');
    } finally {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, numeric.id));
    }
  });

  await t.test('10. BUG-081: a numeric-keyed row whose handle disagrees with its ownerId is left for a human', async () => {
    const numericId = String(9_100_000_000 + Math.floor(Math.random() * 1_000_000));
    const [relabelled] = await db
      .insert(socialMediaAccountProfiles)
      .values({ platform: 'instagram', accountId: numericId, username: 'masjidmuhajirinnitikan', displayName: 'Masjid Muhajirin Nitikan' })
      .returning();
    try {
      await db
        .update(socialMediaAccountProfiles)
        .set({ defaultLocation: { placeName: 'Preset', formattedAddress: 'Preset', coordinates: { latitude: 0, longitude: 0 } } })
        .where(eq(socialMediaAccountProfiles.id, relabelled.id));

      await backfillAccountProfileAndInferDefaultLocation(relabelled.id, [
        post({ ownerId: numericId, ownerUsername: 'jogjakajian', ownerDisplayName: 'Info Kajian Jogja' }),
      ]);

      const [after] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, relabelled.id));
      assert.equal(after.username, 'masjidmuhajirinnitikan');
      assert.equal(after.displayName, 'Masjid Muhajirin Nitikan');
    } finally {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, relabelled.id));
    }
  });
});
