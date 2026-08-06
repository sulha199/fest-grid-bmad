import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyCalendarQueryCondition } from './buildWeeklyCalendarQueryCondition.js';

describe('buildWeeklyCalendarQueryCondition', () => {
  it('no filters + date range only', () => {
    const result = buildWeeklyCalendarQueryCondition({
      search: '',
      types: [],
      categories: [],
      weekStart: '2026-08-01',
      weekEnd: '2026-08-07',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-01', to: '2026-08-07' },
        },
      ],
    });
  });

  it('filters + date range combined', () => {
    const result = buildWeeklyCalendarQueryCondition({
      search: 'concert',
      types: ['MUSIC'],
      categories: [],
      weekStart: '2026-08-01',
      weekEnd: '2026-08-07',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'concert' },
            { field: 'performers', operator: 'contains', value: 'concert' },
            { field: 'location', operator: 'contains', value: 'concert' },
          ],
        },
        { field: 'types', operator: 'in', value: ['MUSIC'] },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-01', to: '2026-08-07' },
        },
      ],
    });
  });

  it('empty date range inputs', () => {
    const result = buildWeeklyCalendarQueryCondition({
      search: 'concert',
      types: [],
      categories: [],
      weekStart: '',
      weekEnd: '',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'concert' },
            { field: 'performers', operator: 'contains', value: 'concert' },
            { field: 'location', operator: 'contains', value: 'concert' },
          ],
        },
      ],
    });
  });

  it('passes through nearby filter to the base condition alongside week range', () => {
    const result = buildWeeklyCalendarQueryCondition({
      search: '',
      types: [],
      categories: [],
      weekStart: '2026-08-01',
      weekEnd: '2026-08-07',
      nearby: { locationPreferenceId: 'loc-123', radiusKm: 25 },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          field: 'scheduleCoordinates',
          operator: 'withinRadius',
          value: { locationPreferenceId: 'loc-123', radiusKm: 25 },
        },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-01', to: '2026-08-07' },
        },
      ],
    });
  });
});
