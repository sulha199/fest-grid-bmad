import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGroupCondition, QueryCondition } from '../query/queryDsl.js';
import { buildAccountEventsQueryCondition } from './buildAccountEventsQueryCondition.js';
import { compileFilterNodeToQueryCondition } from '../ai-event-filters/compile-filter-node.js';
import type { FilterNode } from '../ai-event-filters/filter-node.js';

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

  it('Story 9.3 AC3: an expression-only call compiles and merges exactly like calling compileFilterNodeToQueryCondition directly then AND-wrapping with the base conditions', () => {
    const expression: FilterNode = { field: 'isFree', value: true };
    const result = buildAccountEventsQueryCondition({
      search: '',
      types: [],
      categories: [],
      profileId: 'acc-uuid-1',
      expression,
    });

    const expectedExpressionCondition = compileFilterNodeToQueryCondition(expression);
    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] },
        expectedExpressionCondition,
      ],
    });
  });

  it('Epic 9 review P1: a root OR expression stays ANDed with the profile scope', () => {
    const expression: FilterNode = {
      op: 'OR',
      children: [
        { field: 'locationAdminArea', value: 'Sleman' },
        { field: 'locationAdminArea', value: 'Bantul' },
      ],
    };
    const result = buildAccountEventsQueryCondition({
      search: '',
      types: [],
      categories: [],
      profileId: 'acc-uuid-1',
      expression,
    });
    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc-uuid-1'] },
        compileFilterNodeToQueryCondition(expression),
      ],
    });
  });
});
