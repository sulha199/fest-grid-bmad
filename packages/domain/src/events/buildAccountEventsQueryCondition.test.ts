import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGroupCondition, QueryCondition } from '../query/queryDsl.js';
import { buildAccountEventsQueryCondition } from './buildAccountEventsQueryCondition.js';

function groupConditions(condition: QueryCondition): QueryCondition[] {
  assert.ok(isGroupCondition(condition), 'expected a group condition');
  return condition.conditions;
}

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

  it('ANDs the UPCOMING temporal condition with the base condition', () => {
    const result = buildAccountEventsQueryCondition({
      search: '',
      types: [],
      categories: [],
      profileId: 'acc-uuid-1',
      temporalFilter: 'UPCOMING',
    });

    assert.deepEqual(groupConditions(result)[0], { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] });
    assert.ok(
      JSON.stringify(groupConditions(result)).includes('"field":"scheduleDateRange"'),
      'expected a scheduleDateRange condition'
    );
  });

  it('adds no temporal condition when temporalFilter is null (All)', () => {
    const result = buildAccountEventsQueryCondition({
      search: '',
      types: [],
      categories: [],
      profileId: 'acc-uuid-1',
      temporalFilter: null,
    });

    assert.deepEqual(groupConditions(result), [{ field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] }]);
  });
});
