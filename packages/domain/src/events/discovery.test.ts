import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDiscoveryEvents, paginateDiscoveryEvents } from './discovery';
import { EventCategory, EventType, type EventInfo, type Schedule } from '@festgrid/shared-types';

function createSchedule(date: string): Schedule {
  return {
    id: `schedule-${date}`,
    slug: `schedule-${date}`,
    isMainSchedule: true,
    eventStartDate: date as any,
    eventEndDate: date as any,
    title: 'Main Schedule',
  };
}

function createEvent(id: string, startDate: string, endDate?: string): EventInfo {
  return {
    id,
    slug: id,
    isEvent: true,
    eventName: `Event ${id}`,
    types: [EventType.PERFORMANCE],
    categories: [EventCategory.MUSIC],
    location: 'Test City',
    schedules: [
      {
        ...createSchedule(startDate),
        eventEndDate: endDate as any,
      },
    ],
  };
}

test('filters out past events by default', () => {
  const now = new Date('2026-05-01T00:00:00.000Z');
  const events = [
    createEvent('1', '2025-01-01'),
    createEvent('2', '2026-05-15'),
    createEvent('3', '2026-04-30', '2026-05-10'),
  ];

  const visible = filterDiscoveryEvents(events, { now });

  assert.deepEqual(visible.map((event) => event.id), ['2', '3']);
});

test('appends the next page without dropping already loaded items', () => {
  const items = [createEvent('1', '2026-05-10'), createEvent('2', '2026-05-11')];

  const pageOne = paginateDiscoveryEvents(items, 1, 1);
  const pageTwo = paginateDiscoveryEvents(items, 2, 1);

  assert.deepEqual(pageOne.map((event) => event.id), ['1']);
  assert.deepEqual(pageTwo.map((event) => event.id), ['2']);
});
