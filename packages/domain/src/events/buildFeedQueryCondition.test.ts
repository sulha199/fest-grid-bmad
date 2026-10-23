import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGroupCondition, QueryCondition } from '../query/queryDsl.js';
import { buildFeedQueryCondition } from './buildFeedQueryCondition.js';
import { compileFilterNodeToQueryCondition } from '../ai-event-filters/compile-filter-node.js';
import type { FilterNode } from '../ai-event-filters/filter-node.js';

function groupConditions(condition: QueryCondition): QueryCondition[] {
  assert.ok(isGroupCondition(condition), 'expected a group condition');
  return condition.conditions;
}

describe('buildFeedQueryCondition', () => {
  it('returns base condition only when no filters are provided', () => {
    const result = buildFeedQueryCondition({
      search: '   ',
      types: [],
      categories: [],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
      ],
    });
  });

  it('combines base condition with search (single condition filter)', () => {
    const result = buildFeedQueryCondition({
      search: 'jazz',
      types: [],
      categories: [],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
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
    const result = buildFeedQueryCondition({
      search: '',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });

  it('combines base condition with subscriptions when no other filters are provided', () => {
    const result = buildFeedQueryCondition({
      search: ' ',
      types: [],
      categories: [],
      subscriptions: ['sub-uuid-1', 'sub-uuid-2'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-uuid-1', 'sub-uuid-2'] },
      ],
    });
  });

  it('combines base condition with subscriptions and search', () => {
    const result = buildFeedQueryCondition({
      search: 'jazz',
      types: [],
      categories: [],
      subscriptions: ['sub-uuid-1'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-uuid-1'] },
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

  it('combines base condition with subscriptions, types and categories', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      subscriptions: ['sub-uuid-1'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-uuid-1'] },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });

  it('forwards nearby into the manual-filter branch (no AI filter)', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: [],
      categories: [],
      nearby: { locationPreferenceId: 'loc-1', radiusKm: 5 },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'scheduleCoordinates', operator: 'withinRadius', value: { locationPreferenceId: 'loc-1', radiusKm: 5 } },
      ],
    });
  });

  it('forwards nearby alongside search/types/categories in the manual branch', () => {
    const result = buildFeedQueryCondition({
      search: 'jazz',
      types: ['FESTIVAL'],
      categories: [],
      nearby: { latitude: -6.2, longitude: 106.8, radiusKm: 8 },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'jazz' },
            { field: 'performers', operator: 'contains', value: 'jazz' },
            { field: 'location', operator: 'contains', value: 'jazz' },
          ],
        },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'scheduleCoordinates', operator: 'withinRadius', value: { latitude: -6.2, longitude: 106.8, radiusKm: 8 } },
      ],
    });
  });

  it('ignores nearby when an AI filter is set (mutual exclusivity preserved)', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: [],
      categories: [],
      nearby: { locationPreferenceId: 'loc-1', radiusKm: 5 },
      filter: { types: ['FESTIVAL'] },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
      ],
    });
  });

  it('ANDs the UPCOMING temporal condition with the base condition', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: [],
      categories: [],
      
      temporalFilter: 'UPCOMING',
    });

    assert.deepEqual(groupConditions(result)[0], { field: 'isFromSubscribedAccount', operator: 'eq', value: true });
    assert.ok(
      JSON.stringify(groupConditions(result)).includes('"field":"scheduleDateRange"'),
      'expected a scheduleDateRange condition'
    );
  });

  it('adds no temporal condition when temporalFilter is null (All)', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: [],
      categories: [],
      
      temporalFilter: null,
    });

    assert.deepEqual(groupConditions(result), [{ field: 'isFromSubscribedAccount', operator: 'eq', value: true }]);
  });

  it('Story 9.3 AC3: an expression-only call compiles and merges exactly like calling compileFilterNodeToQueryCondition directly then AND-wrapping with the base conditions', () => {
    const expression: FilterNode = { field: 'isFree', value: true };
    const result = buildFeedQueryCondition({
      search: '',
      types: [],
      categories: [],
      expression,
    });

    const expectedExpressionCondition = compileFilterNodeToQueryCondition(expression);
    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        expectedExpressionCondition,
      ],
    });
  });

  it('applies the temporal filter on top of an AI filter, falling back to the AI filter own value', () => {
    const withToggle = buildFeedQueryCondition({ filter: { types: ['FESTIVAL'] }, temporalFilter: 'TODAY' });
    assert.ok(JSON.stringify(withToggle).includes('scheduleEndedBoundary'));

    const aiOnly = buildFeedQueryCondition({ filter: { types: ['FESTIVAL'], temporalFilter: 'TODAY' } });
    assert.ok(JSON.stringify(aiOnly).includes('scheduleEndedBoundary'));
  });

  it('Epic 9 review P13: the Today toggle still narrows results while an AI expression is active', () => {
    const result = buildFeedQueryCondition({ expression: { field: 'isFree', value: true }, temporalFilter: 'TODAY' });
    assert.ok(JSON.stringify(result).includes('scheduleEndedBoundary'));
    assert.ok(JSON.stringify(result).includes('isFromSubscribedAccount'));
  });

  describe('Epic 9 review P1: a non-AND compiled expression is scoped, never merged into', () => {
    const base = { field: 'isFromSubscribedAccount', operator: 'eq', value: true };
    const sleman: FilterNode = { field: 'locationAdminArea', value: 'Sleman' };
    const bantul: FilterNode = { field: 'locationAdminArea', value: 'Bantul' };

    it('keeps the subscription constraint ANDed with a root OR instead of OR-ing it in', () => {
      const expression: FilterNode = { op: 'OR', children: [sleman, bantul] };
      const result = buildFeedQueryCondition({ expression, subscriptions: ['acc1'] });
      assert.deepEqual(result, {
        operator: 'and',
        conditions: [
          base,
          { field: 'socialMediaAccountProfileId', operator: 'in', value: ['acc1'] },
          compileFilterNodeToQueryCondition(expression),
        ],
      });
    });

    it('keeps the subscription constraint outside a lone keyword leaf (which compiles to an or group)', () => {
      const expression: FilterNode = { field: 'keyword', value: 'jazz' };
      const result = buildFeedQueryCondition({ expression });
      assert.equal(result.operator, 'and');
      assert.deepEqual(groupConditions(result)[0], base);
      assert.equal(groupConditions(result).length, 2);
    });

    it('keeps the subscription constraint outside a root NOT group', () => {
      const expression: FilterNode = {
        op: 'NOT',
        child: { field: 'dateRange', value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' } },
      };
      const result = buildFeedQueryCondition({ expression });
      assert.equal(result.operator, 'and');
      const [first, second] = groupConditions(result);
      assert.deepEqual(first, base);
      assert.ok(isGroupCondition(second) && second.operator === 'not');
    });
  });
});
