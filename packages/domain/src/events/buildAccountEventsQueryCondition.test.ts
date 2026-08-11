import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountEventsQueryCondition } from './buildAccountEventsQueryCondition.js';

describe('buildAccountEventsQueryCondition', () => {
  it('returns base condition only when no filters are provided', () => {
    const result = buildAccountEventsQueryCondition({
      search: '   ',
      types: [],
      categories: [],
      profileId: 'acc-uuid-1',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] },
      ],
    });
  });

  it('combines base condition with search (single condition filter)', () => {
    const result = buildAccountEventsQueryCondition({
      search: 'jazz',
      types: [],
      categories: [],
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
      ],
    });
  });

  it('combines base condition with types and categories (group condition filter)', () => {
    const result = buildAccountEventsQueryCondition({
      search: '',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      profileId: 'acc-uuid-1',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });
});
