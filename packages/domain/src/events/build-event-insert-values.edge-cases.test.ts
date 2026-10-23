import test from 'node:test';
import assert from 'node:assert/strict';
import { EventCategory, EventType } from '@festgrid/shared-types';
import { buildEventInsertValues } from './build-event-insert-values.js';
import type { ExtractedEventMessage, ExtractedScheduleMessage } from './types.js';

function message(overrides: Partial<ExtractedEventMessage> = {}): ExtractedEventMessage {
  return {
    postId: 'post-1',
    sourceSocialMediaAccountId: 'account-1',
    eventName: 'Gig',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.5,
    schedules: [],
    ...overrides,
  };
}

function schedule(eventStartDate: string, eventStartTime?: string): ExtractedScheduleMessage {
  return { isMainSchedule: false, eventStartDate, eventStartTime };
}

test('buildEventInsertValues defaults the optional message fields a malformed payload may omit', () => {
  const sparse = {
    postId: 'post-1',
    sourceSocialMediaAccountId: 'account-1',
    eventName: 'Gig',
  } as unknown as ExtractedEventMessage;

  const { event, schedules } = buildEventInsertValues(sparse, null);

  assert.deepEqual(event.types, []);
  assert.deepEqual(event.categories, []);
  assert.equal(event.confidenceScore, null);
  assert.equal(event.hasPrivateContact, false);
  assert.deepEqual(schedules, []);
});

test('buildEventInsertValues promotes the earlier of two schedules when none is main, whatever their order', () => {
  const laterFirst = buildEventInsertValues(
    message({ schedules: [schedule('2026-09-02'), schedule('2026-09-01')] }),
    null
  );
  assert.deepEqual(laterFirst.schedules.map((s) => s.isMainSchedule), [false, true]);

  const earlierFirst = buildEventInsertValues(
    message({ schedules: [schedule('2026-09-01'), schedule('2026-09-02')] }),
    null
  );
  assert.deepEqual(earlierFirst.schedules.map((s) => s.isMainSchedule), [true, false]);
});

test('buildEventInsertValues breaks a same-date tie by start time, with a missing time sorting last', () => {
  const timedSecond = buildEventInsertValues(
    message({ schedules: [schedule('2026-09-01'), schedule('2026-09-01', '10:00:00')] }),
    null
  );
  assert.deepEqual(timedSecond.schedules.map((s) => s.isMainSchedule), [false, true]);

  const timedFirst = buildEventInsertValues(
    message({ schedules: [schedule('2026-09-01', '10:00:00'), schedule('2026-09-01')] }),
    null
  );
  assert.deepEqual(timedFirst.schedules.map((s) => s.isMainSchedule), [true, false]);

  const earlierTimeSecond = buildEventInsertValues(
    message({ schedules: [schedule('2026-09-01', '20:00:00'), schedule('2026-09-01', '10:00:00')] }),
    null
  );
  assert.deepEqual(earlierTimeSecond.schedules.map((s) => s.isMainSchedule), [false, true]);

  const identical = buildEventInsertValues(
    message({ schedules: [schedule('2026-09-01', '10:00:00'), schedule('2026-09-01', '10:00:00')] }),
    null
  );
  assert.deepEqual(identical.schedules.map((s) => s.isMainSchedule), [true, false]);
});
