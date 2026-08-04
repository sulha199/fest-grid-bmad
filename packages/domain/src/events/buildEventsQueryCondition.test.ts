import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

describe('buildEventsQueryCondition', () => {
  it('returns undefined when no filters are provided', () => {
    const result = buildEventsQueryCondition({
      search: '   ',
      types: [],
      categories: [],
    });

    assert.equal(result, undefined);
  });

  it('builds an OR group for search across name/performers/location', () => {
    const result = buildEventsQueryCondition({
      search: 'jazz',
      types: [],
      categories: [],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
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

  it('builds in-conditions for types and categories', () => {
    const result = buildEventsQueryCondition({
      search: '',
      types: ['FESTIVAL', 'WORKSHOP'],
      categories: ['MUSIC'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'types', operator: 'in', value: ['FESTIVAL', 'WORKSHOP'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });
});