import test from 'node:test';
import * as assert from 'node:assert';
import { computeLatestScheduleEnd } from './computeLatestScheduleEnd.js';
import type { GeminiEventPayload } from './types.js';

function makeEvent(schedules: Array<Omit<GeminiEventPayload['schedules'][number], 'isMainSchedule'>>): GeminiEventPayload {
  return {
    eventName: 'Test Event',
    types: ['PERFORMANCE'],
    categories: ['MUSIC'],
    schedules: schedules.map((schedule) => ({ isMainSchedule: false, ...schedule })),
    confidenceScore: 0.9
  };
}

test('computeLatestScheduleEnd', async (t) => {
  await t.test('empty events array returns null', () => {
    assert.strictEqual(computeLatestScheduleEnd([]), null);
  });

  await t.test('single event, schedule with only eventStartDate returns that date at 23:59:59Z', () => {
    const events = [makeEvent([{ eventStartDate: '2026-11-01' }])];
    const result = computeLatestScheduleEnd(events);
    assert.deepStrictEqual(result, new Date('2026-11-01T23:59:59Z'));
  });

  await t.test('schedule with eventEndDate but no eventEndTime returns that end date at 23:59:59Z', () => {
    const events = [makeEvent([{ eventStartDate: '2026-11-01', eventEndDate: '2026-11-03' }])];
    const result = computeLatestScheduleEnd(events);
    assert.deepStrictEqual(result, new Date('2026-11-03T23:59:59Z'));
  });

  await t.test('schedule with both eventEndDate and eventEndTime returns the exact combined instant', () => {
    const events = [
      makeEvent([{ eventStartDate: '2026-11-01', eventEndDate: '2026-11-03', eventEndTime: '14:30:00' }])
    ];
    const result = computeLatestScheduleEnd(events);
    assert.deepStrictEqual(result, new Date('2026-11-03T14:30:00Z'));
  });

  await t.test('multiple schedules on one event: the later one wins', () => {
    const events = [
      makeEvent([
        { eventStartDate: '2026-11-01', eventEndDate: '2026-11-01', eventEndTime: '10:00:00' },
        { eventStartDate: '2026-11-05', eventEndDate: '2026-11-05', eventEndTime: '18:00:00' }
      ])
    ];
    const result = computeLatestScheduleEnd(events);
    assert.deepStrictEqual(result, new Date('2026-11-05T18:00:00Z'));
  });

  await t.test('multiple events, each with schedules: the true max across all of them wins', () => {
    const events = [
      makeEvent([{ eventStartDate: '2026-11-01', eventEndDate: '2026-11-01', eventEndTime: '10:00:00' }]),
      makeEvent([{ eventStartDate: '2026-11-10', eventEndDate: '2026-11-10', eventEndTime: '23:00:00' }])
    ];
    const result = computeLatestScheduleEnd(events);
    assert.deepStrictEqual(result, new Date('2026-11-10T23:00:00Z'));
  });

  await t.test('an event with an empty schedules array contributes nothing (does not throw or become epoch)', () => {
    const events = [makeEvent([]), makeEvent([{ eventStartDate: '2026-11-02', eventEndTime: '09:00:00' }])];
    const result = computeLatestScheduleEnd(events);
    assert.deepStrictEqual(result, new Date('2026-11-02T09:00:00Z'));
  });

  await t.test('a malformed date/time string is skipped, not counted toward the max, does not throw', () => {
    const events = [
      makeEvent([
        { eventStartDate: 'not-a-date' },
        { eventStartDate: '2026-11-01', eventEndDate: '2026-11-01', eventEndTime: '12:00:00' }
      ])
    ];
    const result = computeLatestScheduleEnd(events);
    assert.deepStrictEqual(result, new Date('2026-11-01T12:00:00Z'));
  });
});
