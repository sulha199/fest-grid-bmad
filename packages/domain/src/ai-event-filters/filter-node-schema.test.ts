import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { DayOfWeek, TemporalFilter } from '../events/buildEventsQueryCondition.js';
import { validateFilterNode } from './filter-node-schema.js';
import type { FilterNode } from './filter-node.js';

const leafAccountId: FilterNode = { field: 'accountId', value: 'acc-1' };
const leafType: FilterNode = { field: 'type', value: [EventType.FESTIVAL] };
const leafCategory: FilterNode = { field: 'category', value: [EventCategory.MUSIC] };
const leafKeyword: FilterNode = { field: 'keyword', value: 'jazz' };
const leafDateRange: FilterNode = {
  field: 'dateRange',
  value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' },
};
const leafDayOfWeek: FilterNode = { field: 'dayOfWeek', value: [DayOfWeek.FRI, DayOfWeek.SAT] };
const leafLocationAdminArea: FilterNode = { field: 'locationAdminArea', value: 'Sleman' };
const leafLocationProximity: FilterNode = {
  field: 'locationProximity',
  value: { coordinates: { lat: -7.7, lng: 110.3 }, radiusMeters: 5000 },
};
const leafVenueType: FilterNode = { field: 'venueType', value: 'CAFE' };
const leafIsFree: FilterNode = { field: 'isFree', value: true };
const leafTemporalFilter: FilterNode = { field: 'temporalFilter', value: TemporalFilter.UPCOMING };

describe('validateFilterNode (AC1)', () => {
  describe('valid candidates', () => {
    it('accepts a single leaf of every vocabulary field', () => {
      for (const leaf of [
        leafAccountId,
        leafType,
        leafCategory,
        leafKeyword,
        leafDateRange,
        leafDayOfWeek,
        leafLocationAdminArea,
        leafLocationProximity,
        leafVenueType,
        leafIsFree,
        leafTemporalFilter,
      ]) {
        const result = validateFilterNode(leaf);
        assert.equal(result.valid, true, `expected ${JSON.stringify(leaf)} to be valid`);
      }
    });

    it('accepts a well-formed AND/OR/NOT composition within limits', () => {
      const node: FilterNode = {
        op: 'AND',
        children: [
          { op: 'OR', children: [leafCategory, leafKeyword] as FilterNode[] },
          { op: 'NOT', child: leafVenueType },
        ],
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, true);
      if (result.valid) {
        assert.deepEqual(result.node, node);
      }
    });
  });

  describe('rejection: depth exceeds FILTER_NODE_MAX_DEPTH', () => {
    it('reports a depth-exceeded issue at the root for a 4-level-deep tree', () => {
      // depth: leaf=1, AND(leaf)=2, AND(AND(leaf))=3, AND(AND(AND(leaf)))=4 -- exceeds the limit of 3.
      // Built from single-child ANDs (no NOT involved) so this test isolates the depth violation
      // from the double-NOT rule.
      const deep: FilterNode = {
        op: 'AND',
        children: [{ op: 'AND', children: [{ op: 'AND', children: [leafKeyword] }] }],
      };
      const result = validateFilterNode(deep);
      assert.equal(result.valid, false);
      if (!result.valid) {
        const depthIssue = result.issues.find((issue) => issue.reason.includes('FILTER_NODE_MAX_DEPTH'));
        assert.ok(depthIssue, 'expected a FILTER_NODE_MAX_DEPTH issue');
        assert.deepEqual(depthIssue!.path, []);
      }
    });
  });

  describe('rejection: node count exceeds FILTER_NODE_MAX_NODES', () => {
    it('reports a node-count-exceeded issue at the root for 13 leaves', () => {
      const children: FilterNode[] = Array.from({ length: 13 }, (_, i) => ({
        field: 'keyword',
        value: `kw-${i}`,
      }));
      const node: FilterNode = { op: 'OR', children };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        const countIssue = result.issues.find((issue) => issue.reason.includes('FILTER_NODE_MAX_NODES'));
        assert.ok(countIssue, 'expected a FILTER_NODE_MAX_NODES issue');
        assert.deepEqual(countIssue!.path, []);
      }
    });
  });

  describe('rejection: double NOT', () => {
    it('reports a double-NOT issue pointing at the outer NOT node', () => {
      const node: FilterNode = {
        op: 'AND',
        children: [{ op: 'NOT', child: { op: 'NOT', child: leafKeyword } }],
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        const doubleNotIssue = result.issues.find((issue) => issue.reason.includes('double NOT'));
        assert.ok(doubleNotIssue, 'expected a double-NOT issue');
        assert.deepEqual(doubleNotIssue!.path, ['children', 0]);
      }
    });

    it('does not flag a NOT whose grandchild (not immediate child) is a NOT', () => {
      // Note: wrapping the inner NOT in an intermediate group to separate it from the outer NOT's
      // immediate-child position pushes this particular tree's depth to 4 (exceeding
      // FILTER_NODE_MAX_DEPTH), so the candidate is still reported invalid overall -- but for the
      // depth reason only, never for double-NOT, which is exactly what this test asserts.
      const node: FilterNode = {
        op: 'NOT',
        child: { op: 'AND', children: [{ op: 'NOT', child: leafKeyword }] },
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.ok(result.issues.every((issue) => !issue.reason.includes('double NOT')));
        assert.ok(result.issues.some((issue) => issue.reason.includes('FILTER_NODE_MAX_DEPTH')));
      }
    });
  });

  describe('rejection: empty group', () => {
    it('reports an empty-group issue for an AND with zero children', () => {
      const node: FilterNode = { op: 'AND', children: [] };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.issues.length, 1);
        assert.match(result.issues[0].reason, /empty group/);
        assert.deepEqual(result.issues[0].path, []);
      }
    });

    it('reports an empty-group issue for a nested OR with zero children', () => {
      const node: FilterNode = { op: 'AND', children: [leafKeyword, { op: 'OR', children: [] }] };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        const emptyGroupIssue = result.issues.find((issue) => issue.reason.includes('empty group'));
        assert.ok(emptyGroupIssue);
        assert.deepEqual(emptyGroupIssue!.path, ['children', 1]);
      }
    });
  });

  describe('rejection: out-of-vocabulary leaf field', () => {
    it('reports an issue naming the offending field and pointing at the node', () => {
      const node: FilterNode = {
        op: 'AND',
        children: [leafKeyword, { field: 'priceThreshold', value: 100 } as unknown as FilterNode],
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        const vocabIssue = result.issues.find((issue) => issue.reason.includes('priceThreshold'));
        assert.ok(vocabIssue, 'expected a vocabulary issue naming "priceThreshold"');
        assert.match(vocabIssue!.reason, /outside the locked vocabulary/);
        assert.deepEqual(vocabIssue!.path, ['children', 1]);
      }
    });

    it('reports an issue for a leaf with a valid field name but an invalid value shape', () => {
      const node: FilterNode = { field: 'isFree', value: 'yes' } as unknown as FilterNode;
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.issues.length, 1);
        assert.match(result.issues[0].reason, /invalid value/);
        assert.deepEqual(result.issues[0].path, []);
      }
    });
  });

  describe('multiple independent issues', () => {
    it('reports every violation in a single candidate, not just the first', () => {
      const node: FilterNode = {
        op: 'AND',
        children: [
          { op: 'OR', children: [] },
          { field: 'notAField', value: 1 } as unknown as FilterNode,
          { op: 'NOT', child: { op: 'NOT', child: leafKeyword } },
        ],
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.ok(result.issues.some((issue) => issue.reason.includes('empty group')));
        assert.ok(result.issues.some((issue) => issue.reason.includes('notAField')));
        assert.ok(result.issues.some((issue) => issue.reason.includes('double NOT')));
        assert.ok(result.issues.length >= 3);
      }
    });
  });

  describe('dateRange span validation (AC1, Story 9.1b, Task 13)', () => {
    it('accepts a dateRange leaf with valid spanAmount/spanUnit', () => {
      const node: FilterNode = {
        field: 'dateRange',
        value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 7, spanUnit: 'DAY' },
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, true);
    });

    it('rejects a dateRange leaf whose spanAmount exceeds its DATE_OFFSET_AMOUNT_BOUNDS bound', () => {
      const node: FilterNode = {
        field: 'dateRange',
        value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 91, spanUnit: 'DAY' },
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.match(result.issues[0].reason, /invalid value/);
      }
    });

    it('rejects a dateRange leaf whose offsetAmount exceeds its DATE_OFFSET_AMOUNT_BOUNDS bound', () => {
      const node: FilterNode = {
        field: 'dateRange',
        value: { anchor: 'TODAY', offsetAmount: 91, offsetUnit: 'DAY' },
      };
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
    });

    it('rejects a dateRange leaf where spanAmount is provided without spanUnit', () => {
      const node: FilterNode = {
        field: 'dateRange',
        value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 7 },
      } as unknown as FilterNode;
      const result = validateFilterNode(node);
      assert.equal(result.valid, false);
    });
  });

  describe('malformed candidates', () => {
    it('rejects a non-object candidate', () => {
      const result = validateFilterNode('not a node');
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.deepEqual(result.issues[0].path, []);
        assert.match(result.issues[0].reason, /Expected a FilterNode object/);
      }
    });

    it('rejects a node missing both "op" and "field"', () => {
      const result = validateFilterNode({ foo: 'bar' });
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.match(result.issues[0].reason, /neither a recognized AND\/OR\/NOT group nor a filter leaf/);
      }
    });

    it('rejects an AND/OR node whose "children" is not an array', () => {
      const result = validateFilterNode({ op: 'AND', children: 'nope' });
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.match(result.issues[0].reason, /must have a "children" array/);
      }
    });

    it('rejects a NOT node missing "child"', () => {
      const result = validateFilterNode({ op: 'NOT' });
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.match(result.issues[0].reason, /must have a "child"/);
      }
    });
  });
});
