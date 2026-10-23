import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyCalendarQueryCondition } from './buildWeeklyCalendarQueryCondition.js';

describe('buildWeeklyCalendarQueryCondition without a week range', () => {
  it('returns an empty AND group when there are no filters either', () => {
    const result = buildWeeklyCalendarQueryCondition({
      search: '',
      types: [],
      categories: [],
      weekStart: '',
      weekEnd: '',
    });

    assert.deepEqual(result, { operator: 'and', conditions: [] });
  });

  it('returns just the filter condition when filters are set', () => {
    const result = buildWeeklyCalendarQueryCondition({
      search: '',
      types: ['MUSIC'],
      categories: [],
      weekStart: '',
      weekEnd: '',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [{ field: 'types', operator: 'in', value: ['MUSIC'] }],
    });
  });
});
