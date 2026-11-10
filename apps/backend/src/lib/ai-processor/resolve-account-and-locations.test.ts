import test, { mock } from 'node:test';
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

  await t.test('the account\'s own location is sent as the proximity point, with its country as the bias', async () => {
    const queries: any[] = [];
    setResolveLocationSeam(async (query) => {
      queries.push(query);
      return { coordinates: { latitude: 41.86, longitude: -87.61 }, formattedAddress: 'Resolved' };
    });
    await resolveAccountAndLocations(profile.id, [{ isMainSchedule: true, eventStartDate: '2026-08-15', location: 'Pasar Porosjayan' }], undefined);
    assert.deepStrictEqual(queries[0].proximity, mockDefaultLocation.coordinates);

    // An account with no default location sends none (nothing to be near).
    const [bare] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'platform-acc-bare-' + Date.now(), platform: 'instagram', displayName: 'Bare', username: 'bare_' + Date.now() })
      .returning();
    try {
      queries.length = 0;
      await resolveAccountAndLocations(bare.id, [{ isMainSchedule: true, eventStartDate: '2026-08-15', location: 'Pasar Porosjayan' }], undefined);
      assert.ok(!('proximity' in queries[0]) || queries[0].proximity === undefined);
    } finally {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, bare.id));
    }
  });

  await t.test('looks each distinct address up once: 20 schedules on 2 addresses (and the event-level fallback) make 2 lookups', async () => {
    const asked: string[] = [];
    setResolveLocationSeam(async (query) => {
      asked.push(query.kind === 'ADDRESS' ? query.address : '?');
      if (query.kind === 'ADDRESS' && query.address === 'Various places') throw new Error('No geolocation match found');
      return { coordinates: { latitude: 41.86, longitude: -87.61 }, formattedAddress: 'Resolved ' + (query.kind === 'ADDRESS' ? query.address : '') };
    });
    const errors: unknown[][] = [];
    const errorMock = mock.method(console, 'error', (...args: unknown[]) => {
      errors.push(args);
    });
    try {
      const schedules = Array.from({ length: 20 }, (_, i) => ({
        isMainSchedule: i === 0,
        eventStartDate: '2026-11-' + String(i + 1).padStart(2, '0'),
        // 10 dates name a hall, 10 name nothing and take the event-level fallback (which does not resolve).
        ...(i % 2 === 0 ? { location: 'Hall A' } : {}),
      }));
      const result = await resolveAccountAndLocations(profile.id, schedules, 'Various places');
      assert.deepStrictEqual(asked, ['Hall A', 'Various places']);
      // The resolved hall is shared by its 10 schedules; the unresolved address by none.
      assert.deepStrictEqual([...result.resolvedScheduleLocations.keys()], [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
      assert.equal(result.resolvedScheduleLocations.get(18)?.formattedAddress, 'Resolved Hall A');
      // One log line for the address that did not resolve, naming every schedule it affected.
      assert.equal(errors.length, 1);
      assert.match(String(errors[0][0]), /schedule index 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 with address "Various places"/);
    } finally {
      errorMock.mock.restore();
    }
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
