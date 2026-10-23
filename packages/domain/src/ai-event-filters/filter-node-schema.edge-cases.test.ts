import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType } from '@festgrid/shared-types';
import { FilterLeafSchema, FilterNodeSchema, validateFilterNode } from './filter-node-schema.js';
import { DateAnchor, DateOffsetUnit } from '../events/buildEventsQueryCondition.js';

describe('FilterNodeSchema', () => {
  it('accepts a nested AND / OR / NOT tree of valid leaves', () => {
    const tree = {
      op: 'AND',
      children: [
        { op: 'OR', children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }] },
        { op: 'NOT', child: { field: 'type', value: [EventType.WORKSHOP] } },
      ],
    };

    assert.equal(FilterNodeSchema.safeParse(tree).success, true);
  });

  it('rejects a tree containing an invalid leaf', () => {
    assert.equal(FilterNodeSchema.safeParse({ op: 'AND', children: [{ field: 'keyword', value: '' }] }).success, false);
  });
});

describe('FilterLeafSchema dateRange span rules', () => {
  const base = { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY };

  it('requires spanUnit when spanAmount is given', () => {
    const result = FilterLeafSchema.safeParse({ field: 'dateRange', value: { ...base, spanAmount: 2 } });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0].path, ['value', 'spanUnit']);
  });

  it('requires spanAmount when spanUnit is given', () => {
    const result = FilterLeafSchema.safeParse({ field: 'dateRange', value: { ...base, spanUnit: DateOffsetUnit.WEEK } });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0].path, ['value', 'spanAmount']);
  });
});

describe('validateFilterNode leaf diagnostics', () => {
  it('names the offending field and the first schema issue for a leaf with a bad value', () => {
    const result = validateFilterNode({ field: 'keyword', value: '' });

    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.issues[0].reason, /^Leaf "keyword" has an invalid value: /);
    }
  });

  it('reports a leaf field outside the locked vocabulary', () => {
    const result = validateFilterNode({ field: 'nonsense', value: 1 });

    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.issues[0].reason, /outside the locked vocabulary/);
    }
  });
});
