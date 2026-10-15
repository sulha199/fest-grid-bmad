import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapFilterLeaves } from './map-filter-leaves.js';
import type { FilterLeaf, FilterNode } from './filter-node.js';

const leafA: FilterLeaf = { field: 'keyword', value: 'jazz' };
const leafB: FilterLeaf = { field: 'venueType', value: 'CAFE' };
const leafC: FilterLeaf = { field: 'isFree', value: true };

describe('mapFilterLeaves (AC3)', () => {
  it('returns mapLeaf(node) directly for a bare leaf', () => {
    const result = mapFilterLeaves(leafA, (leaf) => leaf);
    assert.deepEqual(result, leafA);
  });

  it('drops a leaf, collapsing a single-child group to undefined', () => {
    const node: FilterNode = { op: 'AND', children: [leafA] };
    const result = mapFilterLeaves(node, (leaf) => (leaf.field === 'keyword' ? undefined : leaf));
    assert.equal(result, undefined);
  });

  it('drops a leaf, keeping the rest of a multi-child group', () => {
    const node: FilterNode = { op: 'AND', children: [leafA, leafB, leafC] };
    const result = mapFilterLeaves(node, (leaf) => (leaf.field === 'venueType' ? undefined : leaf));
    assert.deepEqual(result, { op: 'AND', children: [leafA, leafC] });
  });

  it('replaces a leaf value in place', () => {
    const node: FilterNode = { op: 'OR', children: [leafA, leafB] };
    const result = mapFilterLeaves(node, (leaf) =>
      leaf.field === 'keyword' ? { field: 'keyword', value: 'blues' } : leaf
    );
    assert.deepEqual(result, { op: 'OR', children: [{ field: 'keyword', value: 'blues' }, leafB] });
  });

  it('drops a NOT whose child drops entirely', () => {
    const node: FilterNode = { op: 'NOT', child: leafA };
    const result = mapFilterLeaves(node, () => undefined);
    assert.equal(result, undefined);
  });

  it('keeps a NOT whose child survives', () => {
    const node: FilterNode = { op: 'NOT', child: leafA };
    const result = mapFilterLeaves(node, (leaf) => leaf);
    assert.deepEqual(result, { op: 'NOT', child: leafA });
  });

  it('a nested AND-inside-OR where only the inner leaf survives', () => {
    const node: FilterNode = {
      op: 'OR',
      children: [{ op: 'AND', children: [leafA, leafB] }, leafC],
    };
    const result = mapFilterLeaves(node, (leaf) => (leaf.field === 'isFree' || leaf.field === 'keyword' ? leaf : undefined));
    assert.deepEqual(result, { op: 'OR', children: [leafA, leafC] });
  });

  it('drops every leaf inside a nested group, collapsing it entirely out of the parent', () => {
    const node: FilterNode = {
      op: 'OR',
      children: [{ op: 'AND', children: [leafB] }, leafC],
    };
    const result = mapFilterLeaves(node, (leaf) => (leaf.field === 'venueType' ? undefined : leaf));
    assert.deepEqual(result, { op: 'OR', children: [leafC] });
  });

  it('a no-op pass (predicate always returns the same leaf) round-trips a group unchanged', () => {
    const node: FilterNode = { op: 'AND', children: [leafA, { op: 'OR', children: [leafB, leafC] }] };
    const result = mapFilterLeaves(node, (leaf) => leaf);
    assert.deepEqual(result, node);
  });

  it('does not collapse a single remaining child into that child directly (normalize()\'s job, not this function\'s)', () => {
    const node: FilterNode = { op: 'AND', children: [leafA, leafB] };
    const result = mapFilterLeaves(node, (leaf) => (leaf.field === 'venueType' ? undefined : leaf));
    assert.deepEqual(result, { op: 'AND', children: [leafA] });
  });

  it('idempotence: mapFilterLeaves applied twice with the same always-keep predicate is a no-op', () => {
    const node: FilterNode = {
      op: 'AND',
      children: [leafA, { op: 'NOT', child: { op: 'OR', children: [leafB, leafC] } }],
    };
    const once = mapFilterLeaves(node, (leaf) => leaf);
    const twice = once === undefined ? once : mapFilterLeaves(once, (leaf) => leaf);
    assert.deepEqual(twice, once);
    assert.deepEqual(once, node);
  });
});
