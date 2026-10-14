import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EventFilterInput } from '../events/buildEventsQueryCondition.js';
import { EVENT_FILTER_FIXTURES } from '../events/buildEventsQueryCondition.test.js';
import { expressionFromFlatFilter, flatFilterFromExpression } from './flat-filter-conversion.js';
import { isFilterGroupNode } from './filter-node.js';
import type { FilterNode } from './filter-node.js';

describe('expressionFromFlatFilter / flatFilterFromExpression (AC3)', () => {
  it('round-trips every populated-field fixture from buildEventsQueryCondition.test.ts losslessly', () => {
    for (const filter of EVENT_FILTER_FIXTURES) {
      const expression = expressionFromFlatFilter(filter);
      const roundTripped = flatFilterFromExpression(expression);
      assert.deepEqual(roundTripped, filter, `expected round-trip of ${JSON.stringify(filter)} to be lossless`);
    }
  });

  it('wraps the fixtures in an implicit top-level AND of one leaf per populated field', () => {
    const expression = expressionFromFlatFilter(EVENT_FILTER_FIXTURES[0]);
    assert.ok(isFilterGroupNode(expression) && expression.op === 'AND');
    if (isFilterGroupNode(expression)) {
      assert.equal(expression.children.length, 4); // accountId, type, category, keyword
    }
  });

  it('round-trips an empty filter to an empty/absent-fields object, not a spurious empty AND', () => {
    const emptyFilter: EventFilterInput = {};
    const expression = expressionFromFlatFilter(emptyFilter);
    assert.deepEqual(expression, { op: 'AND', children: [] });
    assert.deepEqual(flatFilterFromExpression(expression), {});
  });

  it('wraps a single populated field in an AND, not a bare collapsed leaf', () => {
    const expression = expressionFromFlatFilter({ keyword: 'jazz' });
    assert.deepEqual(expression, { op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] });
  });

  it('wraps a singular dayOfWeek into the leaf\'s array-valued shape, round-tripping the single element', () => {
    const expression = expressionFromFlatFilter({ dayOfWeek: 'SAT' });
    assert.deepEqual(expression, { op: 'AND', children: [{ field: 'dayOfWeek', value: ['SAT'] }] });
    assert.deepEqual(flatFilterFromExpression(expression), { dayOfWeek: 'SAT' });
  });

  it('prioritizes coordinates over adminArea when a flat location carries both', () => {
    const expression = expressionFromFlatFilter({
      location: { coordinates: { lat: -7.7, lng: 110.3 }, adminArea: 'Sleman' },
    });
    assert.deepEqual(expression, {
      op: 'AND',
      children: [{ field: 'locationProximity', value: { coordinates: { lat: -7.7, lng: 110.3 } } }],
    });
  });

  it('accepts a single leaf (not wrapped in AND) as a valid expression', () => {
    const leaf: FilterNode = { field: 'venueType', value: 'CAFE' };
    assert.deepEqual(flatFilterFromExpression(leaf), { venueType: 'CAFE' });
  });

  it('throws when converting an OR node back to the flat shape (out of scope for this story)', () => {
    const node: FilterNode = {
      op: 'OR',
      children: [
        { field: 'keyword', value: 'jazz' },
        { field: 'keyword', value: 'blues' },
      ],
    };
    assert.throws(() => flatFilterFromExpression(node), /only supports a single leaf or a top-level AND-of-leaves/);
  });

  it('throws when an AND child is not itself a leaf (e.g. a nested OR)', () => {
    const node: FilterNode = {
      op: 'AND',
      children: [
        { field: 'keyword', value: 'jazz' },
        { op: 'OR', children: [{ field: 'venueType', value: 'CAFE' }, { field: 'venueType', value: 'MALL' }] },
      ],
    };
    assert.throws(() => flatFilterFromExpression(node), /only supports a flat AND-of-leaves expression/);
  });
});
