import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { transformGeminiResponseToEventFilter } from './transform-gemini-response-to-event-filter.js';
import { DateAnchor, DateOffsetUnit, DayOfWeek } from '../events/buildEventsQueryCondition.js';

describe('transformGeminiResponseToEventFilter', () => {
  it('should map valid full payload correctly', () => {
    const payload = {
      accountId: 'account-123',
      types: ['PERFORMANCE', 'INVALID_TYPE'],
      categories: ['MUSIC', 'INVALID_CATEGORY'],
      keyword: 'acoustic live',
      dateRange: {
        anchor: 'THIS_WEEK',
        offsetAmount: 1,
        offsetUnit: 'WEEK',
      },
      dayOfWeek: 'SAT',
      location: {
        coordinates: { lat: -7.7956, lng: 110.3695 },
        radiusMeters: 5000,
        adminArea: 'Yogyakarta',
      },
      venueType: 'CAFE',
      isFree: true,
    };

    const result = transformGeminiResponseToEventFilter(payload);

    assert.strictEqual(result.accountId, 'account-123');
    assert.deepStrictEqual(result.types, [EventType.PERFORMANCE]);
    assert.deepStrictEqual(result.categories, [EventCategory.MUSIC]);
    assert.strictEqual(result.keyword, 'acoustic live');
    assert.deepStrictEqual(result.dateRange, {
      anchor: DateAnchor.THIS_WEEK,
      offsetAmount: 1,
      offsetUnit: DateOffsetUnit.WEEK,
    });
    assert.strictEqual(result.dayOfWeek, DayOfWeek.SAT);
    // Coordinates exist, so adminArea must be ignored / deleted to ensure mutual exclusivity
    assert.deepStrictEqual(result.location, {
      coordinates: { lat: -7.7956, lng: 110.3695 },
      radiusMeters: 5000,
    });
    assert.strictEqual(result.venueType, 'CAFE');
    assert.strictEqual(result.isFree, true);
  });

  it('should handle adminArea when coordinates are absent', () => {
    const payload = {
      location: {
        adminArea: 'Sleman',
      },
    };

    const result = transformGeminiResponseToEventFilter(payload);

    assert.deepStrictEqual(result.location, {
      adminArea: 'Sleman',
    });
  });

  it('should return empty object on empty or invalid inputs', () => {
    assert.deepStrictEqual(transformGeminiResponseToEventFilter(null), {});
    assert.deepStrictEqual(transformGeminiResponseToEventFilter(undefined), {});
    assert.deepStrictEqual(transformGeminiResponseToEventFilter({}), {});
  });

  it('should parse string isFree and ignore invalid dateRange anchors', () => {
    const payload = {
      isFree: 'true',
      dateRange: {
        anchor: 'INVALID_ANCHOR',
        offsetAmount: 2,
        offsetUnit: 'DAY',
      },
    };

    const result = transformGeminiResponseToEventFilter(payload);

    assert.strictEqual(result.isFree, true);
    assert.strictEqual(result.dateRange, undefined); // Invalid anchor means dateRange gets omitted
  });

  it('should extract temporalFilter (AC2)', () => {
    assert.strictEqual(transformGeminiResponseToEventFilter({ temporalFilter: 'today' }).temporalFilter, 'TODAY');
    assert.strictEqual(transformGeminiResponseToEventFilter({ temporalFilter: 'UPCOMING' }).temporalFilter, 'UPCOMING');
    assert.strictEqual(transformGeminiResponseToEventFilter({ temporalFilter: 'NOT_A_VALUE' }).temporalFilter, undefined);
  });

  it('should accept an array-valued dayOfWeek alongside the existing singular case (AC2)', () => {
    const multi = transformGeminiResponseToEventFilter({ dayOfWeek: ['sat', 'sun'] });
    assert.deepStrictEqual(multi.dayOfWeek, [DayOfWeek.SAT, DayOfWeek.SUN]);

    const single = transformGeminiResponseToEventFilter({ dayOfWeek: 'sat' });
    assert.strictEqual(single.dayOfWeek, DayOfWeek.SAT);

    // An array that filters down to exactly one valid member still outputs a bare string.
    const collapsedToOne = transformGeminiResponseToEventFilter({ dayOfWeek: ['sat', 'invalid'] });
    assert.strictEqual(collapsedToOne.dayOfWeek, DayOfWeek.SAT);

    // An array with zero valid members omits the field entirely.
    const allInvalid = transformGeminiResponseToEventFilter({ dayOfWeek: ['invalid', 'also-invalid'] });
    assert.strictEqual(allInvalid.dayOfWeek, undefined);
  });

  it('should parse spanAmount/spanUnit on dateRange (AC1, AC3)', () => {
    const payload = {
      dateRange: {
        anchor: 'TODAY',
        offsetAmount: 0,
        offsetUnit: 'DAY',
        spanAmount: 7,
        spanUnit: 'DAY',
      },
    };
    const result = transformGeminiResponseToEventFilter(payload);
    assert.deepStrictEqual(result.dateRange, {
      anchor: DateAnchor.TODAY,
      offsetAmount: 0,
      offsetUnit: DateOffsetUnit.DAY,
      spanAmount: 7,
      spanUnit: DateOffsetUnit.DAY,
    });
  });

  it('should omit the whole dateRange when offsetAmount exceeds its bound (DW-077, untrusted-input degradation)', () => {
    const payload = {
      dateRange: { anchor: 'TODAY', offsetAmount: 91, offsetUnit: 'DAY' },
    };
    assert.strictEqual(transformGeminiResponseToEventFilter(payload).dateRange, undefined);
  });

  it('should omit only the span fields (keeping the valid base dateRange) when spanAmount exceeds its bound', () => {
    const payload = {
      dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 91, spanUnit: 'DAY' },
    };
    const result = transformGeminiResponseToEventFilter(payload);
    assert.deepStrictEqual(result.dateRange, {
      anchor: DateAnchor.TODAY,
      offsetAmount: 0,
      offsetUnit: DateOffsetUnit.DAY,
    });
  });

  it('should omit the span fields when spanAmount is not a positive integer >= 1', () => {
    const payload = {
      dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 0, spanUnit: 'DAY' },
    };
    const result = transformGeminiResponseToEventFilter(payload);
    assert.deepStrictEqual(result.dateRange, {
      anchor: DateAnchor.TODAY,
      offsetAmount: 0,
      offsetUnit: DateOffsetUnit.DAY,
    });
  });
});
