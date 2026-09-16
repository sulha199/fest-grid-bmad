import { test } from 'node:test';
import assert from 'node:assert';
import { buildEventInsertValues } from './build-event-insert-values.js';
import { ExtractedEventMessage } from './types.js';
import { EventType, EventCategory } from '@festgrid/shared-types';

test('buildEventInsertValues - maps fields correctly', () => {
  const message: ExtractedEventMessage = {
    postId: 'post-1',
    sourceSocialMediaAccountId: 'account-1',
    eventName: 'Summer Jam',
    types: [EventType.FESTIVAL],
    categories: [EventCategory.MUSIC],
    confidenceScore: 0.95,
    location: 'Central Park',
    organizerName: 'Organizer A',
    contactInfo: 'organizer@example.com',
    description: 'A great music festival',
    schedules: [
      {
        isMainSchedule: true,
        eventStartDate: '2026-08-15',
        eventEndDate: '2026-08-16',
        eventStartTime: '12:00:00',
        eventEndTime: '22:00:00',
        title: 'Day 1',
        performers: ['Band A', 'Artist B'],
        location: 'Main Stage',
        ticketPrice: '$50',
        locationDetails: {
          coordinates: {
            latitude: 40.785091,
            longitude: -73.968285,
          },
          placeName: 'Central Park Main Stage',
        },
        timezone: 'America/New_York',
        timezoneStatus: 'RESOLVED',
      },
    ],
  };

  const result = buildEventInsertValues(message);

  assert.deepStrictEqual(result.event, {
    postId: 'post-1',
    sourceSocialMediaAccountId: 'account-1',
    eventName: 'Summer Jam',
    types: ['FESTIVAL'],
    categories: ['MUSIC'],
    location: 'Central Park',
    organizerName: 'Organizer A',
    contactInfo: 'organizer@example.com',
    hasPrivateContact: false,
    description: 'A great music festival',
    confidenceScore: 0.95,
    links: null,
  });

  assert.strictEqual(result.schedules.length, 1);
  assert.deepStrictEqual(result.schedules[0], {
    isMainSchedule: true,
    eventStartDate: '2026-08-15',
    eventEndDate: '2026-08-16',
    eventStartTime: '12:00:00',
    eventEndTime: '22:00:00',
    title: 'Day 1',
    performers: ['Band A', 'Artist B'],
    location: 'Main Stage',
    ticketPrice: '$50',
    locationDetails: {
      coordinates: {
        latitude: 40.785091,
        longitude: -73.968285,
      },
      placeName: 'Central Park Main Stage',
    },
    latitude: 40.785091,
    longitude: -73.968285,
    timezone: 'America/New_York',
    timezoneStatus: 'RESOLVED',
  });
});

test('buildEventInsertValues - applies placeholder when location is absent', () => {
  const message: ExtractedEventMessage = {
    postId: 'post-2',
    sourceSocialMediaAccountId: 'account-2',
    eventName: 'Virtual Meetup',
    types: [EventType.GATHERING],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.8,
    schedules: [],
  };

  const result = buildEventInsertValues(message);
  assert.strictEqual(result.event.location, 'Location not specified');
  assert.strictEqual(result.event.hasPrivateContact, false);
  assert.deepStrictEqual(result.schedules, []);
});

test('buildEventInsertValues - maps hasPrivateContact: true through explicitly', () => {
  const message: ExtractedEventMessage = {
    postId: 'post-4',
    sourceSocialMediaAccountId: 'account-4',
    eventName: 'Private Contact Event',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.7,
    hasPrivateContact: true,
    schedules: [],
  };

  const result = buildEventInsertValues(message);
  assert.strictEqual(result.event.hasPrivateContact, true);
  assert.strictEqual(result.event.contactInfo, null);
});

test('buildEventInsertValues - passes links through when present on the message', () => {
  const message: ExtractedEventMessage = {
    postId: 'post-5',
    sourceSocialMediaAccountId: 'account-5',
    eventName: 'Event With Links',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.6,
    schedules: [],
    links: [{ url: 'https://example.com/tickets', label: 'Tickets' }],
  };

  const result = buildEventInsertValues(message);
  assert.deepStrictEqual(result.event.links, [{ url: 'https://example.com/tickets', label: 'Tickets' }]);
});

test('buildEventInsertValues - defaults links to null when absent on the message', () => {
  const message: ExtractedEventMessage = {
    postId: 'post-6',
    sourceSocialMediaAccountId: 'account-6',
    eventName: 'Event Without Links',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.6,
    schedules: [],
  };

  const result = buildEventInsertValues(message);
  assert.strictEqual(result.event.links, null);
});

test('buildEventInsertValues - handles absent coordinates and timezone fields', () => {
  const message: ExtractedEventMessage = {
    postId: 'post-3',
    sourceSocialMediaAccountId: 'account-3',
    eventName: 'Mysterious Event',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.5,
    schedules: [
      {
        isMainSchedule: true,
        eventStartDate: '2026-09-01',
      },
    ],
  };

  const result = buildEventInsertValues(message);
  assert.strictEqual(result.schedules[0].latitude, null);
  assert.strictEqual(result.schedules[0].longitude, null);
  assert.strictEqual(result.schedules[0].timezone, null);
  assert.strictEqual(result.schedules[0].timezoneStatus, null);
});

// Story 0.36 AC5 — isMainSchedule normalization, so `schedules` never has more than one
// isMainSchedule: true entry before it reaches the DB insert (which now enforces exactly
// that via the idx_schedules_one_main_per_event partial unique index).
function messageWithSchedules(schedules: ExtractedEventMessage['schedules']): ExtractedEventMessage {
  return {
    postId: 'post-main-schedule',
    sourceSocialMediaAccountId: 'account-main-schedule',
    eventName: 'Multi-Day Event',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.9,
    schedules,
  };
}

test('buildEventInsertValues - isMainSchedule normalization: exactly one true stays unchanged', () => {
  const result = buildEventInsertValues(messageWithSchedules([
    { isMainSchedule: false, eventStartDate: '2026-09-01' },
    { isMainSchedule: true, eventStartDate: '2026-09-02' },
    { isMainSchedule: false, eventStartDate: '2026-09-03' },
  ]));

  assert.deepStrictEqual(result.schedules.map((s) => s.isMainSchedule), [false, true, false]);
});

test('buildEventInsertValues - isMainSchedule normalization: multiple true keeps only the first', () => {
  const result = buildEventInsertValues(messageWithSchedules([
    { isMainSchedule: true, eventStartDate: '2026-09-01' },
    { isMainSchedule: true, eventStartDate: '2026-09-02' },
    { isMainSchedule: true, eventStartDate: '2026-09-03' },
  ]));

  assert.deepStrictEqual(result.schedules.map((s) => s.isMainSchedule), [true, false, false]);
});

test('buildEventInsertValues - isMainSchedule normalization: zero true promotes the chronologically-earliest by date', () => {
  const result = buildEventInsertValues(messageWithSchedules([
    { isMainSchedule: false, eventStartDate: '2026-09-03' },
    { isMainSchedule: false, eventStartDate: '2026-09-01' },
    { isMainSchedule: false, eventStartDate: '2026-09-02' },
  ]));

  assert.deepStrictEqual(result.schedules.map((s) => s.isMainSchedule), [false, true, false]);
});

test('buildEventInsertValues - isMainSchedule normalization: zero true with a same-date tiebreak by start time', () => {
  const result = buildEventInsertValues(messageWithSchedules([
    { isMainSchedule: false, eventStartDate: '2026-09-01', eventStartTime: '20:00:00' },
    { isMainSchedule: false, eventStartDate: '2026-09-01', eventStartTime: '10:00:00' },
    { isMainSchedule: false, eventStartDate: '2026-09-01', eventStartTime: '15:00:00' },
  ]));

  assert.deepStrictEqual(result.schedules.map((s) => s.isMainSchedule), [false, true, false]);
});

test('buildEventInsertValues - isMainSchedule normalization: zero true, all dates/times equal, first array entry wins (stable)', () => {
  const result = buildEventInsertValues(messageWithSchedules([
    { isMainSchedule: false, eventStartDate: '2026-09-01', eventStartTime: '10:00:00' },
    { isMainSchedule: false, eventStartDate: '2026-09-01', eventStartTime: '10:00:00' },
    { isMainSchedule: false, eventStartDate: '2026-09-01', eventStartTime: '10:00:00' },
  ]));

  assert.deepStrictEqual(result.schedules.map((s) => s.isMainSchedule), [true, false, false]);
});

test('buildEventInsertValues - isMainSchedule normalization: zero true, missing start times sort last (nulls last)', () => {
  const result = buildEventInsertValues(messageWithSchedules([
    { isMainSchedule: false, eventStartDate: '2026-09-01' },
    { isMainSchedule: false, eventStartDate: '2026-09-01', eventStartTime: '09:00:00' },
  ]));

  assert.deepStrictEqual(result.schedules.map((s) => s.isMainSchedule), [false, true]);
});
