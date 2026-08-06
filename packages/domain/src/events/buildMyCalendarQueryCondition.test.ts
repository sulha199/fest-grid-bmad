import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMyCalendarQueryCondition } from './buildMyCalendarQueryCondition.js';

describe('buildMyCalendarQueryCondition', () => {
  it('composes personalization filters with overlaps date range correctly', () => {
    const result = buildMyCalendarQueryCondition({
      weekStart: '2026-08-01',
      weekEnd: '2026-08-07',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          operator: 'or',
          conditions: [
            { field: 'isFavorited', operator: 'eq', value: true },
            { field: 'isAddedToCalendar', operator: 'eq', value: true },
          ],
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
