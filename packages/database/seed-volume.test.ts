import { describe, expect, test } from 'vitest';
import { buildVolumeFixtures } from './seed-volume';

const TODAY = new Date('2026-10-01T12:00:00Z');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('buildVolumeFixtures', () => {
  const fx = buildVolumeFixtures({ eventCount: 600, today: TODAY });

  test('is deterministic for the same options', () => {
    expect(buildVolumeFixtures({ eventCount: 600, today: TODAY })).toEqual(fx);
  });

  test('produces the requested event and post counts with unique ids, slugs and urls', () => {
    expect(fx.eventRows).toHaveLength(600);
    expect(fx.postRows).toHaveLength(600);
    for (const rows of [fx.profileRows, fx.postRows, fx.eventRows, fx.scheduleRows]) {
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id).toMatch(UUID));
    }
    expect(new Set(fx.eventRows.map((e) => e.slug)).size).toBe(600);
    expect(new Set(fx.postRows.map((p) => p.postUrl)).size).toBe(600);
    expect(new Set(fx.scheduleRows.map((s) => s.slug)).size).toBe(fx.scheduleRows.length);
  });

  test('carries the cleanup markers on every synthetic row', () => {
    fx.eventRows.forEach((e) => expect(e.slug).toMatch(/^vol-event-/));
    fx.postRows.forEach((p) => expect(p.postUrl).toMatch(/\/p\/VOL\d+$/));
    fx.profileRows.forEach((p) => expect(p.accountId).toMatch(/^vol-acct-/));
  });

  test('keeps each event 1:1 with its post and exactly one main schedule', () => {
    const postIds = new Set(fx.eventRows.map((e) => e.postId));
    expect(postIds.size).toBe(600);
    for (const event of fx.eventRows) {
      const own = fx.scheduleRows.filter((s) => s.eventId === event.id);
      expect(own.length).toBeGreaterThanOrEqual(1);
      expect(own.filter((s) => s.isMainSchedule)).toHaveLength(1);
    }
  });

  test('schedule dates are valid ranges and mix past, ongoing and upcoming relative to today', () => {
    const today = '2026-10-01';
    let past = 0;
    let ongoing = 0;
    let upcoming = 0;
    for (const s of fx.scheduleRows.filter((r) => r.isMainSchedule)) {
      const start = s.eventStartDate as string;
      const end = s.eventEndDate as string;
      expect(end >= start).toBe(true);
      if (end < today) past++;
      else if (start <= today) ongoing++;
      else upcoming++;
    }
    expect(past).toBeGreaterThan(0);
    expect(ongoing).toBeGreaterThan(0);
    expect(upcoming).toBeGreaterThan(past);
  });

  test('dates are relative: shifting "today" shifts every schedule date by the same amount', () => {
    const later = buildVolumeFixtures({ eventCount: 600, today: new Date('2026-10-11T12:00:00Z') });
    expect(later.scheduleRows).toHaveLength(fx.scheduleRows.length);
    fx.scheduleRows.forEach((s, i) => {
      expect(later.scheduleRows[i].eventStartDate).toBe(shiftDate(s.eventStartDate as string, 10));
      expect(later.scheduleRows[i].eventEndDate).toBe(shiftDate(s.eventEndDate as string, 10));
    });
  });

  test('user-scoped rows reference existing synthetic events, schedules and profiles', () => {
    const eventIds = new Set(fx.eventRows.map((e) => e.id));
    const scheduleIds = new Set(fx.scheduleRows.map((s) => s.id));
    const profileIds = new Set(fx.profileRows.map((p) => p.id));
    fx.favoriteRows.forEach((f) => expect(eventIds.has(f.eventId)).toBe(true));
    fx.calendarRows.forEach((c) => {
      expect(eventIds.has(c.eventId)).toBe(true);
      expect(scheduleIds.has(c.scheduleId)).toBe(true);
    });
    fx.subscriptionRows.forEach((s) => expect(profileIds.has(s.accountId)).toBe(true));
    expect(new Set(fx.favoriteRows.map((f) => `${f.userId}:${f.eventId}`)).size).toBe(fx.favoriteRows.length);
    expect(new Set(fx.subscriptionRows.map((s) => s.id)).size).toBe(fx.subscriptionRows.length);
  });
});
