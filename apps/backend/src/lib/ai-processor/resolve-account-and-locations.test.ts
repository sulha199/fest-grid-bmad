import test, { mock } from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { resolveAccountAndLocations, setResolveLocationSeam, resolveLocationSeam } from './resolve-account-and-locations.js';
import { LocationDetails } from '@festgrid/shared-types';
import { GeminiSchedulePayload } from '@festgrid/domain';
import { GeolocationNotFoundError } from '../geolocation/geoapify-client.js';
import { createGeocodeSession } from '../geolocation/geocode-session.js';

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

  const ID_CONFIG = { keywordGeocoding: true, defaultCountryCode: 'ID' };
  const NO_HINT_CONFIG = { keywordGeocoding: true, defaultCountryCode: null };
  const found = (label = 'Resolved'): LocationDetails => ({ coordinates: { latitude: -7.7, longitude: 110.4 }, formattedAddress: label });
  const placeSchedule = (location: string, extra: Partial<GeminiSchedulePayload> = {}): GeminiSchedulePayload => ({
    isMainSchedule: true,
    eventStartDate: '2026-11-15',
    location,
    ...extra,
  });

  async function withProfile(defaultLocation: LocationDetails | null, run: (profileId: string) => Promise<void>) {
    const [row] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'platform-acc-x-' + Math.random().toString(36).slice(2),
        platform: 'instagram',
        displayName: 'X',
        username: 'x_' + Math.random().toString(36).slice(2),
        ...(defaultLocation ? { defaultLocation } : {}),
      })
      .returning();
    try {
      await run(row.id);
    } finally {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, row.id));
    }
  }

  await t.test("the account's own location is the proximity point only when its country is the text's hint country (or there is no hint)", async () => {
    const queries: any[] = [];
    setResolveLocationSeam(async (query) => {
      queries.push(query);
      return found();
    });
    const chicago: LocationDetails = { ...mockDefaultLocation, countryCode: 'us' };
    await withProfile(chicago, async (id) => {
      // Same country as the hint: used.
      await resolveAccountAndLocations(id, [placeSchedule('Pasar Porosjayan')], undefined, { config: { keywordGeocoding: true, defaultCountryCode: 'US' } });
      assert.deepStrictEqual(queries[0].proximity, chicago.coordinates);

      // Another country than the hint (a wrong default): ignored, so it cannot discard correct matches.
      queries.length = 0;
      await resolveAccountAndLocations(id, [placeSchedule('Pasar Porosjayan')], undefined, { config: ID_CONFIG });
      assert.ok(!('proximity' in queries[0]));

      // The text's own code is the hint, not the platform default.
      queries.length = 0;
      await resolveAccountAndLocations(id, [placeSchedule('Doylestown', { locationCountryCode: 'US' })], undefined, { config: ID_CONFIG });
      assert.deepStrictEqual(queries[0].proximity, chicago.coordinates);

      // No hint at all: used as before.
      queries.length = 0;
      await resolveAccountAndLocations(id, [placeSchedule('Pasar Porosjayan')], undefined, { config: NO_HINT_CONFIG });
      assert.deepStrictEqual(queries[0].proximity, chicago.coordinates);
    });
    // A default of unknown country is not trusted against a hint.
    await withProfile(mockDefaultLocation, async (id) => {
      queries.length = 0;
      await resolveAccountAndLocations(id, [placeSchedule('Pasar Porosjayan')], undefined, { config: ID_CONFIG });
      assert.ok(!('proximity' in queries[0]));
    });
    // No default location: nothing to be near.
    await withProfile(null, async (id) => {
      queries.length = 0;
      await resolveAccountAndLocations(id, [placeSchedule('Pasar Porosjayan')], undefined, { config: NO_HINT_CONFIG });
      assert.ok(!('proximity' in queries[0]));
    });
  });

  await t.test('keywords ladder under a string code: step 2 after "not found", a hard filter and no unfiltered pass', async () => {
    const asked: any[] = [];
    setResolveLocationSeam(async (query) => {
      asked.push(query);
      if (query.kind === 'ADDRESS' && query.address === 'Pasar Porosjayan, Gamping, Sleman') throw new GeolocationNotFoundError();
      return found('Gamping area');
    });
    await withProfile(null, async (id) => {
      const result = await resolveAccountAndLocations(
        id,
        [placeSchedule('Pasar Porosjayan, Gamping', { locationKeywords: ['Pasar Porosjayan', 'Gamping', 'Sleman'], locationCountryCode: 'ID' })],
        undefined,
        { config: NO_HINT_CONFIG }
      );
      assert.deepStrictEqual(
        asked.map((q) => [q.address, q.countryFilter]),
        [
          ['Pasar Porosjayan, Gamping, Sleman', 'ID'],
          ['Gamping, Sleman', 'ID'],
        ]
      );
      assert.equal(result.resolvedScheduleResolutions.get(0), 'kw2');
      assert.equal(result.resolvedScheduleLocations.get(0)?.formattedAddress, 'Gamping area');

      // Both steps miss: nothing plausible, and still no unfiltered pass after a trusted code.
      asked.length = 0;
      setResolveLocationSeam(async (query) => {
        asked.push(query);
        throw new GeolocationNotFoundError();
      });
      const missed = await resolveAccountAndLocations(
        id,
        [placeSchedule('Nowhere Hall', { locationKeywords: ['Nowhere Hall', 'Sleman'], locationCountryCode: 'ID' })],
        undefined,
        { config: NO_HINT_CONFIG }
      );
      assert.equal(asked.length, 2);
      assert.equal(missed.resolvedScheduleResolutions.get(0), 'none');
      assert.equal(missed.resolvedScheduleLocations.size, 0);
    });
  });

  await t.test('no keywords and no code: the cleaned text under the platform default, filtered first then everywhere', async () => {
    const asked: any[] = [];
    setResolveLocationSeam(async (query) => {
      asked.push(query);
      if (query.kind === 'ADDRESS' && query.countryFilter) throw new GeolocationNotFoundError();
      return found('Abroad');
    });
    await withProfile(null, async (id) => {
      const result = await resolveAccountAndLocations(id, [placeSchedule('Grand Mercure Yogyakarta (Lt. 3)')], undefined, { config: ID_CONFIG });
      assert.deepStrictEqual(
        asked.map((q) => [q.address, q.countryFilter]),
        [
          ['Grand Mercure Yogyakarta', 'ID'],
          ['Grand Mercure Yogyakarta', undefined],
        ]
      );
      assert.equal(result.resolvedScheduleResolutions.get(0), 'fb1');
    });
  });

  await t.test('an outage ends the ladder: the schedule is skipped, not "none", and the failure is logged once', async () => {
    const asked: string[] = [];
    setResolveLocationSeam(async (query) => {
      asked.push(query.kind === 'ADDRESS' ? query.address : '?');
      throw new Error('Geoapify 503');
    });
    const errorMock = mock.method(console, 'error', () => {});
    try {
      await withProfile(null, async (id) => {
        const result = await resolveAccountAndLocations(
          id,
          [placeSchedule('Hall A', { locationKeywords: ['Hall A', 'Sleman'], locationCountryCode: 'ID' }), placeSchedule('Hall A', { locationKeywords: ['Hall A', 'Sleman'], locationCountryCode: 'ID' })],
          undefined,
          { config: NO_HINT_CONFIG }
        );
        assert.deepStrictEqual(asked, ['Hall A, Sleman']);
        assert.equal(result.resolvedScheduleResolutions.get(0), 'skipped');
        assert.equal(result.resolvedScheduleResolutions.get(1), 'skipped');
        assert.equal(errorMock.mock.calls.length, 1);
      });
    } finally {
      errorMock.mock.restore();
    }
  });

  await t.test('an event with no schedule location uses the event-level keywords and code', async () => {
    const asked: any[] = [];
    setResolveLocationSeam(async (query) => {
      asked.push(query);
      return found();
    });
    await withProfile(null, async (id) => {
      const result = await resolveAccountAndLocations(id, [{ isMainSchedule: true, eventStartDate: '2026-11-15' }], 'Kabupaten Sleman', {
        event: { locationKeywords: ['Sleman', 'Yogyakarta'], locationCountryCode: 'ID' },
        config: NO_HINT_CONFIG,
      });
      assert.deepStrictEqual(asked.map((q) => [q.address, q.countryFilter]), [['Sleman, Yogyakarta', 'ID']]);
      assert.equal(result.resolvedScheduleResolutions.get(0), 'kw1');
    });
  });

  await t.test('the account default address is looked up as before and records no resolution', async () => {
    const asked: any[] = [];
    setResolveLocationSeam(async (query) => {
      asked.push(query);
      return found('Chicago');
    });
    const result = await resolveAccountAndLocations(profile.id, [{ isMainSchedule: true, eventStartDate: '2026-11-15' }], undefined, { config: ID_CONFIG });
    assert.deepStrictEqual(asked.map((q) => [q.address, q.countryFilter]), [['Chicago, IL, USA', undefined]]);
    assert.equal(result.resolvedScheduleLocations.size, 1);
    assert.equal(result.resolvedScheduleResolutions.size, 0);
  });

  await t.test('kill switch off: the plain single-address lookup, no filter, no ladder, nothing recorded', async () => {
    const asked: any[] = [];
    setResolveLocationSeam(async (query) => {
      asked.push(query);
      return found();
    });
    await withProfile(null, async (id) => {
      const result = await resolveAccountAndLocations(
        id,
        [placeSchedule('Hall A (Lt. 3)', { locationKeywords: ['Hall A', 'Sleman'], locationCountryCode: 'ID' })],
        undefined,
        { config: { keywordGeocoding: false, defaultCountryCode: 'ID' } }
      );
      assert.deepStrictEqual(asked.map((q) => [q.address, q.countryFilter]), [['Hall A (Lt. 3)', undefined]]);
      assert.equal(result.resolvedScheduleLocations.size, 1);
      assert.equal(result.resolvedScheduleResolutions.size, 0);
    });
  });

  await t.test('a shared session: a place used by several calls (events) is looked up once, and a spent budget skips the rest once-logged', async () => {
    let calls = 0;
    setResolveLocationSeam(async (query, options) => {
      options?.beforeGeocode?.();
      calls++;
      return found(query.kind === 'ADDRESS' ? query.address : '?');
    });
    const warnMock = mock.method(console, 'warn', () => {});
    try {
      await withProfile(null, async (id) => {
        const session = createGeocodeSession({ budget: 2 });
        const hall = placeSchedule('Hall A', { locationKeywords: ['Hall A'], locationCountryCode: 'ID' });
        const first = await resolveAccountAndLocations(id, [hall], undefined, { session, config: NO_HINT_CONFIG });
        const again = await resolveAccountAndLocations(id, [hall], undefined, { session, config: NO_HINT_CONFIG });
        assert.equal(calls, 1, 'the same place in a second event does not reach the geocoder again');
        assert.equal(first.resolvedScheduleResolutions.get(0), 'kw1');
        assert.equal(again.resolvedScheduleResolutions.get(0), 'kw1');

        const hallB = placeSchedule('Hall B', { locationKeywords: ['Hall B'], locationCountryCode: 'ID' });
        const hallC = placeSchedule('Hall C', { locationKeywords: ['Hall C'], locationCountryCode: 'ID' });
        const hallD = placeSchedule('Hall D', { locationKeywords: ['Hall D'], locationCountryCode: 'ID' });
        const rest = await resolveAccountAndLocations(id, [hallB, hallC, hallD], undefined, { session, config: NO_HINT_CONFIG });
        assert.equal(session.spent, 2);
        assert.equal(rest.resolvedScheduleResolutions.get(0), 'kw1');
        assert.equal(rest.resolvedScheduleResolutions.get(1), 'skipped');
        assert.equal(rest.resolvedScheduleResolutions.get(2), 'skipped');
        assert.equal(rest.resolvedScheduleLocations.size, 1);
        assert.equal(warnMock.mock.calls.filter((c) => String(c.arguments[0]).includes('geocode-budget-exhausted')).length, 1);
      });
    } finally {
      warnMock.mock.restore();
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
