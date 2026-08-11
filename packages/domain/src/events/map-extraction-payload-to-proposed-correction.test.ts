import test from 'node:test';
import assert from 'node:assert/strict';
import { mapExtractionPayloadToProposedCorrection } from './map-extraction-payload-to-proposed-correction.js';
import { GeminiExtractionPayload } from './types.js';

test('mapExtractionPayloadToProposedCorrection - maps a full payload with multiple schedules correctly', () => {
  const payload: GeminiExtractionPayload = {
    isEvent: true,
    eventName: 'Sample Festival',
    types: ['CONCERT', 'FESTIVAL'],
    categories: ['MUSIC', 'COMMUNITY'],
    location: '123 Main St, City',
    organizerName: 'Fest Organizer',
    contactInfo: 'contact@fest.com',
    description: 'An awesome music festival.',
    confidenceScore: 0.95,
    schedules: [
      {
        isMainSchedule: true,
        eventStartDate: '2026-08-15',
        eventEndDate: '2026-08-16',
        eventStartTime: '12:00:00',
        eventEndTime: '22:00:00',
        title: 'Day 1 Main Stage',
        performers: ['Band A', 'Band B'],
        location: 'Main Stage',
        ticketPrice: 'IDR 100000',
      },
      {
        isMainSchedule: false,
        eventStartDate: '2026-08-16',
        title: 'Day 2 Side Stage',
      },
    ],
  };

  const result = mapExtractionPayloadToProposedCorrection(payload);

  assert.equal(result.eventName, 'Sample Festival');
  assert.deepEqual(result.types, ['CONCERT', 'FESTIVAL']);
  assert.deepEqual(result.categories, ['MUSIC', 'COMMUNITY']);
  assert.equal(result.location, '123 Main St, City');
  assert.equal(result.organizerName, 'Fest Organizer');
  assert.equal(result.contactInfo, 'contact@fest.com');
  assert.equal(result.description, 'An awesome music festival.');

  assert.equal(result.schedules.length, 2);

  const sched1 = result.schedules[0];
  assert.equal(sched1.id, undefined);
  assert.equal(sched1.isMainSchedule, true);
  assert.equal(sched1.eventStartDate, '2026-08-15');
  assert.equal(sched1.eventEndDate, '2026-08-16');
  assert.equal(sched1.eventStartTime, '12:00:00');
  assert.equal(sched1.eventEndTime, '22:00:00');
  assert.equal(sched1.title, 'Day 1 Main Stage');
  assert.deepEqual(sched1.performers, ['Band A', 'Band B']);
  assert.equal(sched1.location, 'Main Stage');
  assert.equal(sched1.ticketPrice, 'IDR 100000');

  const sched2 = result.schedules[1];
  assert.equal(sched2.id, undefined);
  assert.equal(sched2.isMainSchedule, false);
  assert.equal(sched2.eventStartDate, '2026-08-16');
  assert.equal(sched2.eventEndDate, undefined);
  assert.equal(sched2.eventStartTime, undefined);
  assert.equal(sched2.eventEndTime, undefined);
  assert.equal(sched2.title, 'Day 2 Side Stage');
  assert.equal(sched2.performers, undefined);
  assert.equal(sched2.location, undefined);
  assert.equal(sched2.ticketPrice, undefined);
});
