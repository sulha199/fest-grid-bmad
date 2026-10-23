import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType } from '@festgrid/shared-types';
import { compileFilterNodeToQueryCondition } from './compile-filter-node.js';
import { DateAnchor, DateOffsetUnit, DayOfWeek } from '../events/buildEventsQueryCondition.js';
import type { FilterNode } from './filter-node.js';

const NOW = new Date('2026-06-10T00:00:00Z');
const emptyAccount: FilterNode = { field: 'accountId', value: '' };

describe('compileFilterNodeToQueryCondition leaves that compile to nothing', () => {
  it('drops such a leaf from an AND group that also holds a merged dateRange + dayOfWeek pair', () => {
    const result = compileFilterNodeToQueryCondition(
      {
        op: 'AND',
        children: [
          { field: 'dateRange', value: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY } },
          emptyAccount,
          { field: 'dayOfWeek', value: [DayOfWeek.WED] },
        ],
      },
      { currentDate: NOW }
    );

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-06-10', to: '2026-06-10' } }],
    });
  });

  it('keeps every other child of an AND group that holds a merged dateRange + dayOfWeek pair', () => {
    const result = compileFilterNodeToQueryCondition(
      {
        op: 'AND',
        children: [
          { field: 'dateRange', value: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY } },
          { field: 'type', value: [EventType.FESTIVAL] },
          { field: 'dayOfWeek', value: [DayOfWeek.WED] },
        ],
      },
      { currentDate: NOW }
    );

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-06-10', to: '2026-06-10' } },
        { field: 'types', operator: 'in', value: [EventType.FESTIVAL] },
      ],
    });
  });

  it('drops such a leaf from a plain AND group', () => {
    const result = compileFilterNodeToQueryCondition(
      { op: 'AND', children: [emptyAccount, { field: 'type', value: [EventType.FESTIVAL] }] },
      { currentDate: NOW }
    );

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [{ field: 'types', operator: 'in', value: [EventType.FESTIVAL] }],
    });
  });

  it('compiles a NOT over such a leaf to nothing', () => {
    assert.equal(compileFilterNodeToQueryCondition({ op: 'NOT', child: emptyAccount }, { currentDate: NOW }), undefined);
  });

  it('compiles an AND group of only such leaves to nothing', () => {
    assert.equal(compileFilterNodeToQueryCondition({ op: 'AND', children: [emptyAccount] }, { currentDate: NOW }), undefined);
  });
});

describe('compileFilterNodeToQueryCondition re-wrapping', () => {
  it('re-wraps an OR group that normalizes down to a single leaf', () => {
    const result = compileFilterNodeToQueryCondition(
      { op: 'OR', children: [{ field: 'type', value: [EventType.FESTIVAL] }] },
      { currentDate: NOW }
    );

    assert.deepEqual(result, {
      operator: 'or',
      conditions: [{ field: 'types', operator: 'in', value: [EventType.FESTIVAL] }],
    });
  });

  it('uses the real clock when no currentDate is supplied', () => {
    const result = compileFilterNodeToQueryCondition({ field: 'isFree', value: true });
    assert.deepEqual(result, { field: 'isFree', operator: 'eq', value: true });
  });
});
