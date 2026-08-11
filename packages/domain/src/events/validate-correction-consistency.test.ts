import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { validateCorrectionConsistency, isScheduleLocationConsistent } from './validate-correction-consistency.js';
import { ProposedEventCorrection } from './types.js';

describe('isScheduleLocationConsistent', () => {
  it('returns true if event location or schedule location is missing', () => {
    assert.equal(isScheduleLocationConsistent('', 'Some location'), true);
    assert.equal(isScheduleLocationConsistent('Some location', ''), true);
  });

  it('returns true for case-insensitive substring containment', () => {
    assert.equal(isScheduleLocationConsistent('Chicago, IL', 'United Center, Chicago, IL'), true);
    assert.equal(isScheduleLocationConsistent('chicago, il', 'United Center, CHICAGO, IL'), true);
  });

  it('returns false if schedule location does not contain event location', () => {
    assert.equal(isScheduleLocationConsistent('Chicago, IL', 'Madison Square Garden, New York, NY'), false);
  });
});

describe('validateCorrectionConsistency', () => {
  const baseValidCorrection: ProposedEventCorrection = {
    eventName: 'Valid Event',
    types: [EventType.FESTIVAL],
    categories: [EventCategory.MUSIC],
    location: 'Chicago, IL',
    schedules: [
      {
        isMainSchedule: true,
        eventStartDate: '2026-08-11',
        eventEndDate: '2026-08-11',
        eventStartTime: '12:00:00',
        eventEndTime: '14:00:00',
        location: 'United Center, Chicago, IL',
      },
    ],
  };

  it('passes a fully valid correction', () => {
    const errors = validateCorrectionConsistency(baseValidCorrection);
    assert.equal(errors.length, 0);
  });

  it('flags when eventEndDate is earlier than eventStartDate', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-11',
          eventEndDate: '2026-08-10',
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'schedules[0].eventEndDate');
    assert.equal(errors[0].message, 'Event end date must not be earlier than start date');
  });

  it('flags when eventEndTime is not later than eventStartTime on same date', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-11',
          eventEndDate: '2026-08-11',
          eventStartTime: '14:00:00',
          eventEndTime: '14:00:00',
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'schedules[0].eventEndTime');
  });

  it('flags when eventEndTime is not later than eventStartTime when eventEndDate is absent', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-11',
          eventStartTime: '14:00:00',
          eventEndTime: '12:00:00',
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'schedules[0].eventEndTime');
  });

  it('does not flag eventEndTime/StartTime order when eventEndDate is different from eventStartDate', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-11',
          eventEndDate: '2026-08-12',
          eventStartTime: '14:00:00',
          eventEndTime: '12:00:00', // end time is earlier, but on a later day, which is valid
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 0);
  });

  it('flags when there are zero main schedules', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      schedules: [
        {
          isMainSchedule: false,
          eventStartDate: '2026-08-11',
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'schedules');
    assert.equal(errors[0].message, 'Exactly one schedule must be marked as the main schedule');
  });

  it('flags when there are two or more main schedules', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-11',
        },
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-12',
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'schedules');
  });

  it('flags when schedule location is inconsistent with event location', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      location: 'Chicago, IL',
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-11',
          location: 'Madison Square Garden, New York, NY',
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'schedules[0].location');
  });

  it('skips location check when schedule location is absent', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      location: 'Chicago, IL',
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-11',
          location: undefined,
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 0);
  });

  it('collects multiple simultaneous errors across multiple schedules', () => {
    const data: ProposedEventCorrection = {
      ...baseValidCorrection,
      location: 'Chicago, IL',
      schedules: [
        {
          isMainSchedule: false,
          eventStartDate: '2026-08-11',
          eventEndDate: '2026-08-10', // error 1
          location: 'New York, NY', // error 2
        },
        {
          isMainSchedule: false, // total main is 0 -> error 3
          eventStartDate: '2026-08-11',
          eventStartTime: '12:00:00',
          eventEndTime: '10:00:00', // error 4
        },
      ],
    };
    const errors = validateCorrectionConsistency(data);
    assert.equal(errors.length, 4); // schedules count (main schedule error) + 3 schedule-specific errors
  });
});
