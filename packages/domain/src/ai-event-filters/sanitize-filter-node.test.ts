import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateAnchor, DateOffsetUnit, DayOfWeek } from '../events/buildEventsQueryCondition.js';
import type { FilterNode } from './filter-node.js';
import {
  dropDoubleNots,
  dropInvalidNodes,
  fitToMaxDepth,
  fitToMaxNodes,
  fitWeekdayWindows,
  repairToValidTree,
  type RepairKind,
} from './sanitize-filter-node.js';

const kw = (value: string): FilterNode => ({ field: 'keyword', value });
const longRange: FilterNode = {
  field: 'dateRange',
  value: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY, spanAmount: 24, spanUnit: DateOffsetUnit.MONTH },
};
const everyDay: FilterNode = { field: 'dayOfWeek', value: Object.values(DayOfWeek) };
const keywords = (count: number): FilterNode[] => Array.from({ length: count }, (_, i) => kw(`kw-${i}`));

describe('fitWeekdayWindows', () => {
  it('drops only the weekday leaf when the oversized pair is not negated (a superset, reported)', () => {
    const result = fitWeekdayWindows({ op: 'AND', children: [longRange, everyDay, kw('jazz')] });
    assert.deepEqual(result.node, { op: 'AND', children: [longRange, kw('jazz')] });
    assert.equal(result.dropped, 1);
    assert.equal(result.voidedNots, 0);
  });

  it('leaves a within-cap pair alone', () => {
    const tree: FilterNode = { op: 'AND', children: [{ field: 'dayOfWeek', value: [DayOfWeek.SAT] }, kw('jazz')] };
    assert.deepEqual(fitWeekdayWindows(tree), { node: tree, dropped: 0, voidedNots: 0 });
  });

  it('voids a NOT whose operand holds an oversized pair instead of widening what it excludes', () => {
    const result = fitWeekdayWindows({
      op: 'AND',
      children: [kw('jazz'), { op: 'NOT', child: { op: 'AND', children: [longRange, everyDay] } }],
    });
    assert.deepEqual(result.node, { op: 'AND', children: [kw('jazz')] });
    assert.equal(result.dropped, 0, 'the drop inside the voided NOT is not reported as a weekday drop');
    assert.equal(result.voidedNots, 1);
  });

  it('returns no tree when the voided NOT was the whole filter', () => {
    const result = fitWeekdayWindows({ op: 'NOT', child: { op: 'AND', children: [longRange, everyDay] } });
    assert.equal(result.node, undefined);
    assert.equal(result.voidedNots, 1);
  });

  it('drops a group whose every child was a voided NOT', () => {
    const voidedNot: FilterNode = { op: 'NOT', child: { op: 'AND', children: [longRange, everyDay] } };
    assert.equal(fitWeekdayWindows({ op: 'OR', children: [voidedNot] }).node, undefined);
    assert.deepEqual(fitWeekdayWindows({ op: 'OR', children: [voidedNot, kw('a')] }).node, { op: 'OR', children: [kw('a')] });
  });

  it('keeps a NOT whose operand needed no repair', () => {
    const tree: FilterNode = { op: 'AND', children: [kw('jazz'), { op: 'NOT', child: kw('rock') }] };
    assert.deepEqual(fitWeekdayWindows(tree).node, tree);
  });
});

describe('fitToMaxNodes', () => {
  it('trims the widest group that is not under a NOT', () => {
    const tree: FilterNode = { op: 'AND', children: [{ op: 'OR', children: keywords(11) }, { op: 'NOT', child: kw('rock') }] };
    const result = fitToMaxNodes(tree);
    assert.ok(result.dropped > 0);
    const kept = result.node as { children: Array<{ op: string; child?: FilterNode; children?: FilterNode[] }> };
    assert.deepEqual(kept.children.find((child) => child.op === 'NOT'), { op: 'NOT', child: kw('rock') });
  });

  it('never trims inside a NOT: a negated group over the limit is dropped as a unit', () => {
    for (const size of [11, 13]) {
      const result = fitToMaxNodes({ op: 'NOT', child: { op: 'OR', children: keywords(size) } });
      assert.equal(result.node, undefined);
      assert.equal(result.dropped, 1);
    }
  });

  it('sheds whole conditions of an AND (a NOT included) rather than reaching into a negated group', () => {
    const tree: FilterNode = {
      op: 'AND',
      children: [kw('jazz'), { op: 'NOT', child: { op: 'OR', children: keywords(12) } }],
    };
    const result = fitToMaxNodes(tree);
    assert.deepEqual(result.node, { op: 'AND', children: [kw('jazz')] });
    assert.equal(result.dropped, 1);
  });

  it('returns a tree already within the limit untouched', () => {
    const tree: FilterNode = { op: 'AND', children: keywords(3) };
    assert.deepEqual(fitToMaxNodes(tree), { node: tree, dropped: 0 });
  });
});

describe('dropInvalidNodes', () => {
  it('counts a non-object candidate as one dropped node', () => {
    assert.deepEqual(dropInvalidNodes('nonsense'), { node: undefined, dropped: 1 });
    assert.deepEqual(dropInvalidNodes(null), { node: undefined, dropped: 1 });
  });

  it('counts a group without a children array as dropped, and keeps nothing of it', () => {
    assert.deepEqual(dropInvalidNodes({ op: 'AND', children: 'not an array' }), { node: undefined, dropped: 1 });
    assert.deepEqual(dropInvalidNodes({ op: 'OR' }), { node: undefined, dropped: 1 });
  });

  it('voids a NOT whose operand is unusable instead of keeping part of it', () => {
    const result = dropInvalidNodes({
      op: 'AND',
      children: [{ field: 'keyword', value: 'jazz' }, { op: 'NOT', child: { field: 'keyword', value: '' } }],
    });
    assert.deepEqual(result, { node: { op: 'AND', children: [kw('jazz')] }, dropped: 1 });
  });

  it('drops an unknown operator and an object that is neither a group nor a leaf', () => {
    assert.deepEqual(dropInvalidNodes({ op: 'XOR', children: [] }), { node: undefined, dropped: 1 });
    assert.deepEqual(dropInvalidNodes({ something: 'else' }), { node: undefined, dropped: 1 });
  });

  it('refuses a tree far past the size bounds without salvaging anything', () => {
    let deep: unknown = { field: 'keyword', value: 'x' };
    for (let i = 0; i < 40; i += 1) deep = { op: 'NOT', child: deep };
    assert.deepEqual(dropInvalidNodes(deep), { node: undefined, dropped: 1 });
  });

  it('keeps a valid tree untouched', () => {
    const tree: FilterNode = { op: 'AND', children: [kw('a'), { op: 'NOT', child: kw('b') }] };
    assert.deepEqual(dropInvalidNodes(tree), { node: tree, dropped: 0 });
  });
});

describe('dropDoubleNots', () => {
  it('drops a NOT directly over a NOT', () => {
    assert.deepEqual(dropDoubleNots({ op: 'NOT', child: { op: 'NOT', child: kw('a') } }), { node: undefined, dropped: 1 });
  });

  it('voids a NOT whose operand contained a double negation, and a group left empty', () => {
    const inner: FilterNode = { op: 'NOT', child: { op: 'NOT', child: kw('x') } };
    const voided = dropDoubleNots({ op: 'AND', children: [kw('a'), { op: 'NOT', child: { op: 'OR', children: [kw('b'), inner] } }] });
    assert.deepEqual(voided, { node: { op: 'AND', children: [kw('a')] }, dropped: 1 });

    assert.deepEqual(dropDoubleNots({ op: 'AND', children: [inner] }), { node: undefined, dropped: 1 });
  });

  it('keeps a well-formed negation', () => {
    const tree: FilterNode = { op: 'AND', children: [kw('a'), { op: 'NOT', child: kw('b') }] };
    assert.deepEqual(dropDoubleNots(tree), { node: tree, dropped: 0 });
  });
});

describe('fitToMaxDepth', () => {
  it('drops what sits below the depth limit and the groups that empties', () => {
    // root(1) > AND(2) > OR(3) > leaves(4): the leaves go, so the OR, the AND and the root go with them.
    const tooDeep: FilterNode = { op: 'OR', children: [{ op: 'AND', children: [{ op: 'OR', children: [kw('a'), kw('b')] }] }] };
    assert.deepEqual(fitToMaxDepth(tooDeep).node, undefined);
    assert.equal(fitToMaxDepth(tooDeep).dropped, 2);
  });

  it('keeps the shallow siblings of a branch that is too deep', () => {
    const tree: FilterNode = {
      op: 'AND',
      children: [kw('keep'), { op: 'OR', children: [{ op: 'AND', children: [kw('a'), kw('b')] }, kw('c')] }],
    };
    const result = fitToMaxDepth(tree);
    assert.deepEqual(result.node, { op: 'AND', children: [kw('keep'), { op: 'OR', children: [kw('c')] }] });
    assert.ok(result.dropped > 0);
  });

  it('voids a NOT that loses any part of its operand to the depth limit', () => {
    const tree: FilterNode = { op: 'NOT', child: { op: 'AND', children: [{ op: 'OR', children: [kw('a'), kw('b')] }, kw('c')] } };
    assert.equal(fitToMaxDepth(tree).node, undefined);
  });
});

describe('repairToValidTree', () => {
  const run = (tree: FilterNode) => {
    const repairs: RepairKind[] = [];
    const node = repairToValidTree(tree, (kind) => repairs.push(kind));
    return { node, repairs };
  };
  const empty: FilterNode = { op: 'AND', children: [] };

  it('returns an already-empty tree untouched and reports nothing', () => {
    assert.deepEqual(run(empty), { node: empty, repairs: [] });
  });

  it('reports an invalid leaf and keeps the rest', () => {
    const { node, repairs } = run({ op: 'AND', children: [kw('jazz'), { field: 'keyword', value: '' }] });
    assert.deepEqual(node, kw('jazz'));
    assert.deepEqual(repairs, ['invalid']);
  });

  it('degrades to the empty tree when nothing valid is left', () => {
    assert.deepEqual(run({ field: 'keyword', value: '' }), { node: empty, repairs: ['invalid'] });
  });

  it('reports a double negation that normalizing created', () => {
    const { node, repairs } = run({ op: 'NOT', child: { op: 'AND', children: [{ op: 'NOT', child: kw('a') }] } });
    assert.deepEqual(node, empty);
    assert.ok(repairs.includes('double-not'));
  });

  it('degrades to the empty tree when the depth limit removes everything', () => {
    const { node, repairs } = run({
      op: 'NOT',
      child: { op: 'AND', children: [{ op: 'OR', children: [kw('a'), kw('b')] }, kw('c')] },
    });
    assert.deepEqual(node, empty);
    assert.deepEqual(repairs, ['too-complex']);
  });

  it('reports a weekday window that was shortened, and a NOT that was voided because of one', () => {
    const shortened = run({ op: 'AND', children: [kw('jazz'), longRange, everyDay] });
    assert.deepEqual(shortened.node, { op: 'AND', children: [kw('jazz'), longRange] });
    assert.deepEqual(shortened.repairs, ['weekday-window']);

    const voided = run({ op: 'AND', children: [kw('jazz'), { op: 'NOT', child: { op: 'AND', children: [longRange, everyDay] } }] });
    assert.deepEqual(voided.node, kw('jazz'));
    assert.deepEqual(voided.repairs, ['too-complex']);

    assert.deepEqual(run({ op: 'NOT', child: { op: 'AND', children: [longRange, everyDay] } }), { node: empty, repairs: ['too-complex'] });
  });

  it('degrades a tree that is still too large after trimming to the trimmed tree, and one it cannot trim to empty', () => {
    const trimmed = run({ op: 'OR', children: keywords(15) });
    assert.ok(trimmed.repairs.includes('too-complex'));
    assert.equal(fitToMaxNodes(trimmed.node).dropped, 0);

    const bareNot = run({ op: 'NOT', child: { op: 'OR', children: keywords(13) } });
    assert.deepEqual(bareNot, { node: empty, repairs: ['too-complex'] });
  });
});
