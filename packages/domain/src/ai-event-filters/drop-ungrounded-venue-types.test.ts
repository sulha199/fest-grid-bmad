import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dropUngroundedVenueTypes } from './drop-ungrounded-venue-types.js';
import { EventType } from '@festgrid/shared-types';
import type { FilterNode } from './filter-node.js';

const EMPTY: FilterNode = { op: 'AND', children: [] };

describe('dropUngroundedVenueTypes', () => {
  it('drops a lone placeholder venueType and returns the empty expression with a caveat', () => {
    const result = dropUngroundedVenueTypes({ field: 'venueType', value: 'kids' }, 'exiting events for kid in the weekend');
    assert.deepEqual(result.expression, EMPTY);
    assert.deepEqual(result.caveats, ['Ignored the venue type "kids" because your prompt did not mention a place.']);
  });

  it('drops the hallucinated venueType but keeps the grounded sibling leaves', () => {
    const result = dropUngroundedVenueTypes(
      {
        op: 'AND',
        children: [
          { field: 'type', value: [EventType.PERFORMANCE] },
          { field: 'venueType', value: 'CONCERT_HALL' },
        ],
      },
      'best jazz concerts in Sleman'
    );
    assert.deepEqual(result.expression, { field: 'type', value: [EventType.PERFORMANCE] });
    assert.equal(result.caveats.length, 1);
  });

  it('keeps a venueType the prompt names, case-insensitively and as a plural', () => {
    const lone: FilterNode = { field: 'venueType', value: 'CAFE' };
    assert.deepEqual(dropUngroundedVenueTypes(lone, 'Events at a Cafe').expression, lone);
    assert.deepEqual(dropUngroundedVenueTypes(lone, 'live music in cafes').expression, lone);
    assert.deepEqual(dropUngroundedVenueTypes(lone, 'live music in cafes').caveats, []);
  });

  it('keeps a venueType named through an Indonesian alias', () => {
    const lone: FilterNode = { field: 'venueType', value: 'CAFE' };
    assert.deepEqual(dropUngroundedVenueTypes(lone, 'acara di kafe').expression, lone);
    const mall: FilterNode = { field: 'venueType', value: 'MALL' };
    assert.deepEqual(dropUngroundedVenueTypes(mall, 'acara di mal').expression, mall);
  });

  it('does not ground a venueType on a substring of another word', () => {
    const result = dropUngroundedVenueTypes({ field: 'venueType', value: 'MALL' }, 'normal events');
    assert.deepEqual(result.expression, EMPTY);
  });

  it('matches multi-word values (underscore form) against the prompt text', () => {
    const lone: FilterNode = { field: 'venueType', value: 'CONCERT_HALL' };
    assert.deepEqual(dropUngroundedVenueTypes(lone, 'jazz at the concert hall').expression, lone);
  });

  it('matches a multi-word alias', () => {
    const lone: FilterNode = { field: 'venueType', value: 'cafe' };
    assert.deepEqual(dropUngroundedVenueTypes(lone, 'acara di kedai kopi').expression, lone);
  });

  it('drops one ungrounded alternative inside an OR and collapses the group', () => {
    const result = dropUngroundedVenueTypes(
      { op: 'OR', children: [{ field: 'venueType', value: 'CAFE' }, { field: 'venueType', value: 'STADIUM' }] },
      'events at a cafe'
    );
    assert.deepEqual(result.expression, { field: 'venueType', value: 'CAFE' });
    assert.equal(result.caveats.length, 1);
  });

  it('drops a whole NOT whose only child was ungrounded', () => {
    const result = dropUngroundedVenueTypes(
      { op: 'AND', children: [{ field: 'isFree', value: true }, { op: 'NOT', child: { field: 'venueType', value: 'MALL' } }] },
      'free events'
    );
    assert.deepEqual(result.expression, { field: 'isFree', value: true });
  });

  it('reports the same dropped value only once', () => {
    const result = dropUngroundedVenueTypes(
      {
        op: 'AND',
        children: [
          { op: 'OR', children: [{ field: 'venueType', value: 'kids' }, { field: 'isFree', value: true }] },
          { op: 'NOT', child: { field: 'venueType', value: 'kids' } },
        ],
      },
      'free stuff'
    );
    assert.equal(result.caveats.length, 1);
  });

  it('leaves an expression with no venueType leaf untouched', () => {
    const expr: FilterNode = { op: 'AND', children: [{ field: 'isFree', value: true }, { field: 'keyword', value: 'jazz' }] };
    const result = dropUngroundedVenueTypes(expr, 'free jazz');
    assert.deepEqual(result.expression, expr);
    assert.deepEqual(result.caveats, []);
  });

  it('passes the empty expression through unchanged', () => {
    assert.deepEqual(dropUngroundedVenueTypes(EMPTY, 'anything').expression, EMPTY);
  });
});
