import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEventQueryDsl } from './dsl';
import { EventCategory, EventType, type EventInfo } from '@festgrid/shared-types';

const events: EventInfo[] = [
  {
    id: '1',
    slug: 'summer-festival',
    isEvent: true,
    eventName: 'Summer Festival',
    types: [EventType.FESTIVAL],
    categories: [EventCategory.MUSIC],
    location: 'Chicago',
    schedules: [],
  },
  {
    id: '2',
    slug: 'food-market',
    isEvent: true,
    eventName: 'Food Market',
    types: [EventType.MARKET],
    categories: [EventCategory.FOOD_AND_DRINK],
    location: 'Detroit',
    schedules: [],
  },
  {
    id: '3',
    slug: 'indie-show',
    isEvent: true,
    eventName: 'Indie Show',
    types: [EventType.PERFORMANCE],
    categories: [EventCategory.ARTS_AND_CULTURE],
    location: 'Chicago',
    schedules: [],
  },
];

test('applyEventQueryDsl supports nested and/or conditions', () => {
  const result = applyEventQueryDsl(events, {
    operator: 'and',
    conditions: [
      { field: 'location', operator: 'equals', value: 'Chicago' },
      {
        operator: 'or',
        conditions: [
          { field: 'eventName', operator: 'contains', value: 'Festival' },
          { field: 'types', operator: 'in', value: ['PERFORMANCE'] },
        ],
      },
    ],
  });

  assert.deepEqual(result.map((event) => event.id), ['1', '3']);
});

test('applyEventQueryDsl supports notIn against array fields', () => {
  const result = applyEventQueryDsl(events, {
    operator: 'and',
    conditions: [{ field: 'categories', operator: 'notIn', value: ['MUSIC'] }],
  });

  assert.deepEqual(result.map((event) => event.id), ['2', '3']);
});

test('applyEventQueryDsl returns all events when no query is provided', () => {
  const result = applyEventQueryDsl(events);
  assert.equal(result.length, events.length);
});
