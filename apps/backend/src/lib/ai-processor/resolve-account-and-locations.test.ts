import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { resolveAccountAndLocations, setResolveLocationSeam, resolveLocationSeam } from './resolve-account-and-locations.js';
import { LocationDetails } from '@festgrid/shared-types';
import { GeminiSchedulePayload } from '@festgrid/domain';

test('resolveAccountAndLocations integration tests', async (t) => {
  const originalResolveLocationSeam = resolveLocationSeam;
  const testProfileAccountId = 'platform-acc-' + Date.now();
  const testProfileId = 'profile-resolve-' + Date.now();

  const mockDefaultLocation: LocationDetails = {
    coordinates: { latitude: 41.8781, longitude: -87.6298 },
    formattedAddress: 'Chicago, IL, USA',
    placeName: 'Chicago'
  };

  let profile: any;

  // Insert test profile
  const [insertedProfile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: testProfileAccountId,
      platform: 'instagram',
      displayName: 'Chicago Fest Account',
      username: 'chicago_fest_' + Date.now(),
      defaultLocation: mockDefaultLocation
    })
    .returning();

  profile = insertedProfile;

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  t.afterEach(() => {
    // Reset seam
    setResolveLocationSeam(originalResolveLocationSeam);
  });

  await t.test('Case A: should resolve explicit schedule locations', async () => {
    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-15', location: 'Soldier Field' },
      { isMainSchedule: false, eventStartDate: '2026-08-16' } // will fallback to top-level/default
    ];

    // Mock geolocation resolver
    let lastQueryAddress = '';
    setResolveLocationSeam(async (query) => {
      if (query.kind === 'ADDRESS') {
        lastQueryAddress = query.address;
        return {
          coordinates: { latitude: 41.8623, longitude: -87.6167 },
          formattedAddress: query.address + ', Resolved'
        };
      }
      throw new Error('Unexpected query');
    });

    const result = await resolveAccountAndLocations(profile.id, schedules, 'Navy Pier');

    assert.strictEqual(result.sourceSocialMediaAccountId, testProfileAccountId);
    assert.deepStrictEqual(result.defaultLocation, mockDefaultLocation);

    // schedules[0] has explicit location 'Soldier Field'
    const loc0 = result.resolvedScheduleLocations.get(0);
    assert.ok(loc0);
    assert.strictEqual(loc0.formattedAddress, 'Soldier Field, Resolved');

    // schedules[1] fallback to top-level location 'Navy Pier'
    const loc1 = result.resolvedScheduleLocations.get(1);
    assert.ok(loc1);
    assert.strictEqual(loc1.formattedAddress, 'Navy Pier, Resolved');
  });

  await t.test('Case B: should fallback to defaultLocation address string if top-level and schedule locations are absent', async () => {
    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-15' }
    ];

    setResolveLocationSeam(async (query) => {
      if (query.kind === 'ADDRESS') {
        return {
          coordinates: { latitude: 41.8781, longitude: -87.6298 },
          formattedAddress: query.address + ', Resolved'
        };
      }
      throw new Error('Unexpected query');
    });

    const result = await resolveAccountAndLocations(profile.id, schedules, undefined);

    const loc0 = result.resolvedScheduleLocations.get(0);
    assert.ok(loc0);
    assert.strictEqual(loc0.formattedAddress, 'Chicago, IL, USA, Resolved');
  });

  await t.test('Case C: resolveLocation failure for one schedule does not block others', async () => {
    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-15', location: 'Broken Location' },
      { isMainSchedule: false, eventStartDate: '2026-08-16', location: 'Working Location' }
    ];

    setResolveLocationSeam(async (query) => {
      if (query.kind === 'ADDRESS') {
        if (query.address === 'Broken Location') {
          throw new Error('Geoapify rate limit or network error');
        }
        return {
          coordinates: { latitude: 12, longitude: 34 },
          formattedAddress: 'Working, Resolved'
        };
      }
      throw new Error('Unexpected query');
    });

    const result = await resolveAccountAndLocations(profile.id, schedules, undefined);

    assert.strictEqual(result.resolvedScheduleLocations.get(0), undefined); // Broken, omitted
    const loc1 = result.resolvedScheduleLocations.get(1);
    assert.ok(loc1); // Working, resolved!
    assert.strictEqual(loc1.formattedAddress, 'Working, Resolved');
  });
});
