import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './normalize-filter-node.js';
import type { FilterNode } from './filter-node.js';

const leafA: FilterNode = { field: 'keyword', value: 'jazz' };
const leafB: FilterNode = { field: 'venueType', value: 'CAFE' };
const leafC: FilterNode = { field: 'isFree', value: true };

describe('normalize (AC2)', () => {
  it('leaves a leaf unchanged', () => {
    assert.deepEqual(normalize(leafA), leafA);
  });

  it('normalizes a NOT node\'s child', () => {
    const node: FilterNode = { op: 'NOT', child: { op: 'AND', children: [leafA, leafA] } };
    assert.deepEqual(normalize(node), { op: 'NOT', child: leafA });
  });

  describe('flattening nested same-operator groups', () => {
    it('flattens AND(AND(a,b),c) to AND(a,b,c)', () => {
      const node: FilterNode = {
        op: 'AND',
        children: [{ op: 'AND', children: [leafA, leafB] }, leafC],
      };
      assert.deepEqual(normalize(node), { op: 'AND', children: [leafA, leafB, leafC] });
    });

    it('flattens OR(OR(a,b),c) to OR(a,b,c)', () => {
      const node: FilterNode = {
        op: 'OR',
        children: [{ op: 'OR', children: [leafA, leafB] }, leafC],
      };
      assert.deepEqual(normalize(node), { op: 'OR', children: [leafA, leafB, leafC] });
    });

    it('never flattens an AND nested inside an OR', () => {
      const node: FilterNode = { op: 'OR', children: [{ op: 'AND', children: [leafA, leafB] }, leafC] };
      assert.deepEqual(normalize(node), {
        op: 'OR',
        children: [{ op: 'AND', children: [leafA, leafB] }, leafC],
      });
    });

    it('never flattens an OR nested inside an AND', () => {
      const node: FilterNode = { op: 'AND', children: [{ op: 'OR', children: [leafA, leafB] }, leafC] };
      assert.deepEqual(normalize(node), {
        op: 'AND',
        children: [{ op: 'OR', children: [leafA, leafB] }, leafC],
      });
    });
  });

  describe('single-child collapse', () => {
    it('collapses AND(a) to a', () => {
      const node: FilterNode = { op: 'AND', children: [leafA] };
      assert.deepEqual(normalize(node), leafA);
    });

    it('collapses OR(a) to a', () => {
      const node: FilterNode = { op: 'OR', children: [leafA] };
      assert.deepEqual(normalize(node), leafA);
    });

    it('collapses to a single child that is itself a group, after flattening leaves exactly one', () => {
      // AND(OR(a,b)) -- the single child is a different-op group, never flattened away, so the
      // outer AND still collapses directly onto it.
      const node: FilterNode = { op: 'AND', children: [{ op: 'OR', children: [leafA, leafB] }] };
      assert.deepEqual(normalize(node), { op: 'OR', children: [leafA, leafB] });
    });
  });

  describe('leaf deduplication', () => {
    it('dedupes duplicate leaves within the same group, keeping one', () => {
      const node: FilterNode = { op: 'AND', children: [leafA, leafB, { field: 'keyword', value: 'jazz' }] };
      assert.deepEqual(normalize(node), { op: 'AND', children: [leafA, leafB] });
    });

    it('does not dedupe leaves of the same field with a different value', () => {
      const node: FilterNode = {
        op: 'AND',
        children: [leafA, { field: 'keyword', value: 'blues' }],
      };
      assert.deepEqual(normalize(node), {
        op: 'AND',
        children: [leafA, { field: 'keyword', value: 'blues' }],
      });
    });

    it('dedupes across array-valued leaves only when the array is deep-equal (order-sensitive)', () => {
      const node: FilterNode = {
        op: 'OR',
        children: [
          { field: 'dayOfWeek', value: ['FRI', 'SAT'] as never },
          { field: 'dayOfWeek', value: ['FRI', 'SAT'] as never },
          { field: 'dayOfWeek', value: ['SAT', 'FRI'] as never },
        ],
      };
      assert.deepEqual(normalize(node), {
        op: 'OR',
        children: [
          { field: 'dayOfWeek', value: ['FRI', 'SAT'] },
          { field: 'dayOfWeek', value: ['SAT', 'FRI'] },
        ],
      });
    });
  });

  describe('idempotence', () => {
    const cases: Array<{ name: string; node: FilterNode }> = [
      { name: 'already-normalized leaf', node: leafA },
      { name: 'already-normalized AND', node: { op: 'AND', children: [leafA, leafB] } },
      {
        name: 'nested same-op groups requiring flatten+dedup+collapse',
        node: {
          op: 'AND',
          children: [
            { op: 'AND', children: [leafA, { field: 'keyword', value: 'jazz' }] },
            { op: 'OR', children: [leafB] },
          ],
        },
      },
      { name: 'NOT wrapping a group needing normalization', node: { op: 'NOT', child: { op: 'AND', children: [leafA, leafA, leafB] } } },
    ];

    for (const { name, node } of cases) {
      it(`normalize(normalize(x)) deep-equals normalize(x) for: ${name}`, () => {
        const once = normalize(node);
        const twice = normalize(once);
        assert.deepEqual(twice, once);
      });
    }
  });
});
