import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoredFilter } from './resolve-stored-filter.js';

describe('resolveStoredFilter', () => {
  it('resolves a v1 legacy stored object (no version key, single populated field) losslessly', () => {
    const result = resolveStoredFilter({ keyword: 'jazz' });
    assert.deepEqual(result.expression, { op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] });
    assert.deepEqual(result.flatFilter, { keyword: 'jazz' });
  });

  it('resolves a v2 stored flat AND-of-leaves expression to both fields', () => {
    const expression = {
      op: 'AND',
      children: [
        { field: 'keyword', value: 'jazz' },
        { field: 'isFree', value: true },
      ],
    };
    const result = resolveStoredFilter({ version: 2, expression });
    assert.deepEqual(result.expression, expression);
    assert.deepEqual(result.flatFilter, { keyword: 'jazz', isFree: true });
  });

  it('resolves a v2 stored OR/NOT/nested expression to a populated expression and a null flatFilter', () => {
    const expression = {
      op: 'OR',
      children: [
        { field: 'keyword', value: 'jazz' },
        { op: 'NOT', child: { field: 'isFree', value: true } },
      ],
    };
    const result = resolveStoredFilter({ version: 2, expression });
    assert.deepEqual(result.expression, expression);
    assert.equal(result.flatFilter, null);
  });

  it('resolves an empty/{}/null legacy value to an empty expression and a null-or-empty flat filter without throwing', () => {
    const fromEmptyObject = resolveStoredFilter({});
    assert.deepEqual(fromEmptyObject.expression, { op: 'AND', children: [] });
    assert.deepEqual(fromEmptyObject.flatFilter, {});

    const fromNull = resolveStoredFilter(null);
    assert.deepEqual(fromNull.expression, { op: 'AND', children: [] });
    assert.deepEqual(fromNull.flatFilter, {});

    const fromUndefined = resolveStoredFilter(undefined);
    assert.deepEqual(fromUndefined.expression, { op: 'AND', children: [] });
    assert.deepEqual(fromUndefined.flatFilter, {});
  });

  it('P7: degrades (never throws) when the only leaf of a stored v2 expression is invalid', () => {
    const result = resolveStoredFilter({
      version: 2,
      expression: { op: 'AND', children: [{ field: 'notAField', value: 1 }] },
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.flatFilter, {});
    assert.equal(result.degraded, true);
  });

  it('P7: keeps the valid leaves of a stored row and drops only the invalid one', () => {
    const result = resolveStoredFilter({
      version: 2,
      expression: {
        op: 'AND',
        children: [
          { field: 'keyword', value: 'jazz' },
          { field: 'type', value: ['NO_LONGER_A_TYPE'] },
        ],
      },
    });
    assert.deepEqual(result.expression, { field: 'keyword', value: 'jazz' });
    assert.deepEqual(result.flatFilter, { keyword: 'jazz' });
    assert.equal(result.degraded, true);
  });

  it('P7: a legacy flat row with a null span reads back clean', () => {
    const result = resolveStoredFilter({
      dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: null, spanUnit: null },
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [{ field: 'dateRange', value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' } }],
    });
    assert.equal(result.degraded, undefined);
  });

  it('P7: a legacy flat row with a radius of 0 keeps its other fields', () => {
    const result = resolveStoredFilter({
      keyword: 'jazz',
      location: { coordinates: { lat: -7.8, lng: 110.4 }, radiusMeters: 0 },
    });
    assert.deepEqual(result.expression, { field: 'keyword', value: 'jazz' });
    assert.equal(result.degraded, true);
  });

  it('P7: a stored tree far beyond the size limits degrades to "no filter" without recursing into it', () => {
    let node: unknown = { field: 'isFree', value: true };
    for (let i = 0; i < 30000; i += 1) {
      node = { op: 'NOT', child: node };
    }
    const result = resolveStoredFilter({ version: 2, expression: node });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.equal(result.degraded, true);
  });

  it('tolerates a v2 row saved from a null-padded GraphQL FilterNode and returns the clean tree', () => {
    const result = resolveStoredFilter({
      version: 2,
      expression: {
        op: 'AND',
        field: null,
        value: null,
        child: null,
        children: [
          { op: null, field: 'type', value: ['COMPETITION'], children: null, child: null },
          { op: null, field: 'keyword', value: 'badminton', children: null, child: null },
        ],
      },
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'type', value: ['COMPETITION'] },
        { field: 'keyword', value: 'badminton' },
      ],
    });
    assert.deepEqual(result.flatFilter, { types: ['COMPETITION'], keyword: 'badminton' });
  });

  it('treats a null-padded empty root AND as "no filter active" rather than a malformed tree', () => {
    const result = resolveStoredFilter({
      version: 2,
      expression: { op: 'AND', field: null, value: null, children: [], child: null },
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.flatFilter, {});
  });
});
