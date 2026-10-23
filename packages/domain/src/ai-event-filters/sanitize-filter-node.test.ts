import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateAnchor, DateOffsetUnit, DayOfWeek } from '../events/buildEventsQueryCondition.js';
import type { FilterNode } from './filter-node.js';
import { fitToMaxNodes, fitWeekdayWindows } from './sanitize-filter-node.js';

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
