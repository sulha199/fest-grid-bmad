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

  it('throws on a structurally invalid candidate that fails validateFilterNode', () => {
    assert.throws(
      () => resolveStoredFilter({ version: 2, expression: { op: 'AND', children: [{ field: 'notAField', value: 1 }] } }),
      /FilterNode validation/
    );
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
