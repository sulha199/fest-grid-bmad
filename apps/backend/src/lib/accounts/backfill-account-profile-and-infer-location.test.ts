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
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        platform: 'instagram',
        accountId: 'test-account-id-' + Math.random().toString(36).slice(2, 9),
        username: 'old_username',
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

    assert.equal(profile.username, 'old_username');
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
        ownerUsername: 'new_username',
      },
    ]);

    // Assert profile fields are backfilled
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.username, 'new_username');
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
        ownerUsername: 'old_username', // no change
      },
    ]);

    // Assert profile defaultLocation updated and backfill is untouched
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.username, 'old_username');
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
        ownerUsername: 'backfilled_username',
      },
    ]);

    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id));

    assert.equal(profile.username, 'backfilled_username');
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
});
