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
});
