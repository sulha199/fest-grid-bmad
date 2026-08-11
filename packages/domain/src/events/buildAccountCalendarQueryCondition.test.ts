import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountCalendarQueryCondition } from './buildAccountCalendarQueryCondition.js';

describe('buildAccountCalendarQueryCondition', () => {
  it('returns base condition only when no other filters or dates are provided', () => {
    const result = buildAccountCalendarQueryCondition({
      search: '   ',
      types: [],
      categories: [],
      weekStart: '',
      weekEnd: '',
      profileId: 'acc-uuid-1',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] },
      ],
    });
  });

  it('combines base condition with overlap condition when weekStart and weekEnd are provided', () => {
    const result = buildAccountCalendarQueryCondition({
      search: '   ',
      types: [],
      categories: [],
      weekStart: '2026-08-01',
      weekEnd: '2026-08-08',
      profileId: 'acc-uuid-1',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-01', to: '2026-08-08' },
        },
      ],
    });
  });

  it('combines base condition, filters and overlap condition', () => {
    const result = buildAccountCalendarQueryCondition({
      search: 'jazz',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      weekStart: '2026-08-01',
      weekEnd: '2026-08-08',
      profileId: 'acc-uuid-1',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] },
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'jazz' },
            { field: 'performers', operator: 'contains', value: 'jazz' },
            { field: 'location', operator: 'contains', value: 'jazz' },
          ],
        },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-01', to: '2026-08-08' },
        },
      ],
    });
  });
});
