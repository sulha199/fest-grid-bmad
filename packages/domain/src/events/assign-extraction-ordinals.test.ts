import { test } from 'node:test';
import assert from 'node:assert';
import { assignExtractionOrdinals } from './assign-extraction-ordinals.js';
import { ExtractedEventMessage } from './types.js';
import { EventType, EventCategory } from '@festgrid/shared-types';

function baseMessage(overrides: Partial<ExtractedEventMessage> & { eventName: string }): ExtractedEventMessage {
  return {
    postId: 'post-1',
    sourceSocialMediaAccountId: 'account-1',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.9,
    schedules: [],
    ...overrides,
  };
}

test('assignExtractionOrdinals - two events with different earliest dates sort ascending, ordinals follow sort order not input order', () => {
  const messages = [
    baseMessage({ eventName: 'Later Event', schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-01' }] }),
    baseMessage({ eventName: 'Earlier Event', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
  ];

  const result = assignExtractionOrdinals(messages);

  assert.strictEqual(result[0].eventName, 'Earlier Event');
  assert.strictEqual(result[0].extractionOrdinal, 0);
  assert.strictEqual(result[1].eventName, 'Later Event');
  assert.strictEqual(result[1].extractionOrdinal, 1);
});

test('assignExtractionOrdinals - same earliest date, different names sort by normalized name', () => {
  const messages = [
    baseMessage({ eventName: 'Zebra Festival', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
    baseMessage({ eventName: 'Apple Festival', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
  ];

  const result = assignExtractionOrdinals(messages);

  assert.strictEqual(result[0].eventName, 'Apple Festival');
  assert.strictEqual(result[0].extractionOrdinal, 0);
  assert.strictEqual(result[1].eventName, 'Zebra Festival');
  assert.strictEqual(result[1].extractionOrdinal, 1);
});

test('assignExtractionOrdinals - same date and same case/whitespace-varied name preserves original index order', () => {
  const messages = [
    baseMessage({ eventName: '  Summer   Jam  ', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
    baseMessage({ eventName: 'summer jam', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
  ];

  const result = assignExtractionOrdinals(messages);

  assert.strictEqual(result[0].eventName, '  Summer   Jam  ');
  assert.strictEqual(result[0].extractionOrdinal, 0);
  assert.strictEqual(result[1].eventName, 'summer jam');
  assert.strictEqual(result[1].extractionOrdinal, 1);
});

test('assignExtractionOrdinals - an event with an empty schedules array sorts after one with a real date', () => {
  const messages = [
    baseMessage({ eventName: 'No Date Event', schedules: [] }),
    baseMessage({ eventName: 'Dated Event', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
  ];

  const result = assignExtractionOrdinals(messages);

  assert.strictEqual(result[0].eventName, 'Dated Event');
  assert.strictEqual(result[0].extractionOrdinal, 0);
  assert.strictEqual(result[1].eventName, 'No Date Event');
  assert.strictEqual(result[1].extractionOrdinal, 1);
});

test('assignExtractionOrdinals - scans all of an event\'s schedules, not just schedules[0]', () => {
  const messages = [
    baseMessage({
      eventName: 'Multi Schedule Event',
      schedules: [
        { isMainSchedule: true, eventStartDate: '2026-09-15' },
        { isMainSchedule: false, eventStartDate: '2026-08-01' },
      ],
    }),
    baseMessage({ eventName: 'Single Schedule Event', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-15' }] }),
  ];

  const result = assignExtractionOrdinals(messages);

  // Multi Schedule Event's earliest date (2026-08-01, from its 2nd schedule) is earlier than
  // Single Schedule Event's 2026-08-15, so it must sort first despite schedules[0] being later.
  assert.strictEqual(result[0].eventName, 'Multi Schedule Event');
  assert.strictEqual(result[0].extractionOrdinal, 0);
  assert.strictEqual(result[1].eventName, 'Single Schedule Event');
  assert.strictEqual(result[1].extractionOrdinal, 1);
});

test('assignExtractionOrdinals - output length equals input length and ordinals are exactly 0..n-1 with no gaps/duplicates', () => {
  const messages = [
    baseMessage({ eventName: 'Event C', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-03' }] }),
    baseMessage({ eventName: 'Event A', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
    baseMessage({ eventName: 'Event B', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-02' }] }),
  ];

  const result = assignExtractionOrdinals(messages);

  assert.strictEqual(result.length, messages.length);
  const ordinals = result.map((r) => r.extractionOrdinal).sort((a, b) => (a ?? 0) - (b ?? 0));
  assert.deepStrictEqual(ordinals, [0, 1, 2]);
});

test('assignExtractionOrdinals - does not mutate the input array or its objects', () => {
  const messages = [
    baseMessage({ eventName: 'Event A', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }] }),
    baseMessage({ eventName: 'Event B', schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-02' }] }),
  ];
  const originalRefs = [...messages];

  const result = assignExtractionOrdinals(messages);

  assert.strictEqual(messages[0], originalRefs[0]);
  assert.strictEqual(messages[1], originalRefs[1]);
  assert.strictEqual('extractionOrdinal' in messages[0], false);
  assert.strictEqual('extractionOrdinal' in messages[1], false);
  assert.notStrictEqual(result[0], messages[0]);
  assert.notStrictEqual(result[1], messages[1]);
});
