import test from 'node:test';
import assert from 'node:assert/strict';
import { EventCategory, EventType } from '@festgrid/shared-types';
import { assignExtractionOrdinals } from './assign-extraction-ordinals.js';
import type { ExtractedEventMessage } from './types.js';

function event(eventName: string, startDates: string[]): ExtractedEventMessage {
  return {
    postId: 'post-1',
    sourceSocialMediaAccountId: 'account-1',
    eventName,
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 1,
    schedules: startDates.map((eventStartDate, i) => ({ isMainSchedule: i === 0, eventStartDate })),
  };
}

test('assignExtractionOrdinals: events without any schedule date sort last, by name', () => {
  const result = assignExtractionOrdinals([
    event('Zebra Night', []),
    event('Dated Gig', ['2026-09-01']),
    event('Alpha Night', []),
  ]);

  assert.deepEqual(
    result.map((e) => [e.eventName, e.extractionOrdinal]),
    [
      ['Dated Gig', 0],
      ['Alpha Night', 1],
      ['Zebra Night', 2],
    ]
  );
});

test('assignExtractionOrdinals: a dated event sorts before an undated one regardless of input order', () => {
  const result = assignExtractionOrdinals([event('Undated', []), event('Dated', ['2026-09-01'])]);
  assert.deepEqual(result.map((e) => e.eventName), ['Dated', 'Undated']);

  const reversed = assignExtractionOrdinals([event('Dated', ['2026-09-01']), event('Undated', [])]);
  assert.deepEqual(reversed.map((e) => e.eventName), ['Dated', 'Undated']);
});

test('assignExtractionOrdinals: an event with a missing schedules array is treated as undated', () => {
  const noSchedules = { ...event('Broken', []), schedules: undefined } as unknown as ExtractedEventMessage;
  const result = assignExtractionOrdinals([noSchedules, event('Dated', ['2026-09-01'])]);
  assert.deepEqual(result.map((e) => e.eventName), ['Dated', 'Broken']);
});
