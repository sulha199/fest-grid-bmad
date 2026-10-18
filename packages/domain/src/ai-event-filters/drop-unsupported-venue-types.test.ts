import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType } from '@festgrid/shared-types';
import { dropUnsupportedVenueTypes } from './drop-unsupported-venue-types.js';
import type { FilterNode } from './filter-node.js';

const EMPTY: FilterNode = { op: 'AND', children: [] };

describe('dropUnsupportedVenueTypes', () => {
  it('drops a lone venueType, returns the empty expression and reports it', () => {
    const result = dropUnsupportedVenueTypes({ field: 'venueType', value: 'OUTDOOR' });
    assert.deepEqual(result.expression, EMPTY);
    assert.deepEqual(result.caveats, ['Ignored the venue type "OUTDOOR": filtering by venue type isn\'t supported yet.']);
  });

  it('keeps every other condition (the "kids + weekend + outdoor" case)', () => {
    const result = dropUnsupportedVenueTypes({
      op: 'AND',
      children: [
        { field: 'category', value: ['FAMILY_AND_KIDS'] as never },
        { field: 'dayOfWeek', value: ['SAT', 'SUN'] as never },
        { field: 'venueType', value: 'OUTDOOR' },
      ],
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'category', value: ['FAMILY_AND_KIDS'] },
        { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
      ],
    });
    assert.equal(result.caveats.length, 1);
  });

  it('drops a venueType inside a NOT (the "indoor = not outdoor" shape) together with the NOT', () => {
    const result = dropUnsupportedVenueTypes({
      op: 'AND',
      children: [
        { field: 'type', value: [EventType.PERFORMANCE] },
        { op: 'NOT', child: { field: 'venueType', value: 'OUTDOOR' } },
      ],
    });
    assert.deepEqual(result.expression, { field: 'type', value: [EventType.PERFORMANCE] });
    assert.equal(result.caveats.length, 1);
  });

  it('drops one venueType alternative inside an OR and collapses the group', () => {
    const result = dropUnsupportedVenueTypes({
      op: 'OR',
      children: [{ field: 'venueType', value: 'CAFE' }, { field: 'isFree', value: true }],
    });
    assert.deepEqual(result.expression, { field: 'isFree', value: true });
  });

  it('reports the same value only once and each distinct value separately', () => {
    const result = dropUnsupportedVenueTypes({
      op: 'AND',
      children: [
        { field: 'venueType', value: 'CAFE' },
        { op: 'NOT', child: { field: 'venueType', value: 'CAFE' } },
        { field: 'venueType', value: 'MALL' },
      ],
    });
    assert.deepEqual(result.expression, EMPTY);
    assert.deepEqual(result.caveats, [
      'Ignored the venue type "CAFE": filtering by venue type isn\'t supported yet.',
      'Ignored the venue type "MALL": filtering by venue type isn\'t supported yet.',
    ]);
  });

  it('leaves an expression with no venueType leaf untouched, with no caveats', () => {
    const expr: FilterNode = { op: 'AND', children: [{ field: 'isFree', value: true }, { field: 'keyword', value: 'jazz' }] };
    const result = dropUnsupportedVenueTypes(expr);
    assert.deepEqual(result.expression, expr);
    assert.deepEqual(result.caveats, []);
  });

  it('passes the empty expression through unchanged', () => {
    const result = dropUnsupportedVenueTypes(EMPTY);
    assert.deepEqual(result.expression, EMPTY);
    assert.deepEqual(result.caveats, []);
  });
});
