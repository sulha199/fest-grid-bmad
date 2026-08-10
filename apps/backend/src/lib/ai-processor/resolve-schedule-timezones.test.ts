import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { LocationDetails } from '@festgrid/shared-types';
import { GeminiSchedulePayload } from '@festgrid/domain';
import { resolveScheduleTimezones } from './resolve-schedule-timezones.js';

test('resolveScheduleTimezones integration tests', async (t) => {
  // Retrieve seeded users to use across the tests
  const seededUsers = await db.select().from(users).limit(2);
  assert.ok(seededUsers.length >= 2, 'Must have at least two seeded users');
  const user1 = seededUsers[0];
  const user2 = seededUsers[1];

  // Capture original timezones to restore at the end
  const originalUser1Timezone = user1.timezone;
  const originalUser2Timezone = user2.timezone;

  t.after(async () => {
    // Restore original user timezone states
    await db.update(users).set({ timezone: originalUser1Timezone ?? null }).where(eq(users.id, user1.id));
    await db.update(users).set({ timezone: originalUser2Timezone ?? null }).where(eq(users.id, user2.id));
  });

  await t.test('Tier-1 present short-circuit', async () => {
    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-10' }
    ];
    const resolvedLocations = new Map<number, LocationDetails>([
      [0, { coordinates: { latitude: 41.8781, longitude: -87.6298 }, timezone: 'America/Chicago' }]
    ]);
    
    // No DB row required to exist for subscriber, using empty subscriber list
    const result = await resolveScheduleTimezones(schedules, resolvedLocations, []);
    
    const res = result.get(0);
    assert.ok(res);
    assert.strictEqual(res.timezone, 'America/Chicago');
    assert.strictEqual(res.timezoneStatus, 'RESOLVED');
  });

  await t.test('Tier-2 resolved (single subscriber with timezone set)', async () => {
    // Seed user1 with a specific timezone
    await db.update(users).set({ timezone: 'America/New_York' }).where(eq(users.id, user1.id));

    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-10' }
    ];
    const resolvedLocations = new Map<number, LocationDetails>(); // empty = no Tier 1

    const result = await resolveScheduleTimezones(schedules, resolvedLocations, [user1.id]);
    
    const res = result.get(0);
    assert.ok(res);
    assert.strictEqual(res.timezone, 'America/New_York');
    assert.strictEqual(res.timezoneStatus, 'RESOLVED');
  });

  await t.test('Tier-3 via zero subscribers', async () => {
    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-10' }
    ];
    const resolvedLocations = new Map<number, LocationDetails>();

    const result = await resolveScheduleTimezones(schedules, resolvedLocations, []);
    
    const res = result.get(0);
    assert.ok(res);
    assert.strictEqual(res.timezone, undefined);
    assert.strictEqual(res.timezoneStatus, 'NEEDS_CLARIFICATION');
  });

  await t.test('Tier-3 via two-or-more subscribers', async () => {
    await db.update(users).set({ timezone: 'America/New_York' }).where(eq(users.id, user1.id));
    await db.update(users).set({ timezone: 'America/Chicago' }).where(eq(users.id, user2.id));

    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-10' }
    ];
    const resolvedLocations = new Map<number, LocationDetails>();

    const result = await resolveScheduleTimezones(schedules, resolvedLocations, [user1.id, user2.id]);
    
    const res = result.get(0);
    assert.ok(res);
    assert.strictEqual(res.timezone, undefined);
    assert.strictEqual(res.timezoneStatus, 'NEEDS_CLARIFICATION');
  });

  await t.test('Tier-3 via single subscriber with NULL timezone', async () => {
    await db.update(users).set({ timezone: null }).where(eq(users.id, user1.id));

    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-10' }
    ];
    const resolvedLocations = new Map<number, LocationDetails>();

    const result = await resolveScheduleTimezones(schedules, resolvedLocations, [user1.id]);
    
    const res = result.get(0);
    assert.ok(res);
    assert.strictEqual(res.timezone, undefined);
    assert.strictEqual(res.timezoneStatus, 'NEEDS_CLARIFICATION');
  });

  await t.test('Multiple schedules resolve consistently with memoization', async () => {
    await db.update(users).set({ timezone: 'Europe/London' }).where(eq(users.id, user1.id));

    const schedules: GeminiSchedulePayload[] = [
      { isMainSchedule: true, eventStartDate: '2026-08-10' },
      { isMainSchedule: false, eventStartDate: '2026-08-11' }
    ];
    const resolvedLocations = new Map<number, LocationDetails>();

    const result = await resolveScheduleTimezones(schedules, resolvedLocations, [user1.id]);
    
    const res0 = result.get(0);
    assert.ok(res0);
    assert.strictEqual(res0.timezone, 'Europe/London');
    assert.strictEqual(res0.timezoneStatus, 'RESOLVED');

    const res1 = result.get(1);
    assert.ok(res1);
    assert.strictEqual(res1.timezone, 'Europe/London');
    assert.strictEqual(res1.timezoneStatus, 'RESOLVED');
  });
});
