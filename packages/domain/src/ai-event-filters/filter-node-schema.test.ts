import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { DayOfWeek, TemporalFilter } from '../events/buildEventsQueryCondition.js';
import { validateFilterNode, stripNullNodeKeys } from './filter-node-schema.js';
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

// GraphQL serializes every declared `FilterNode` key on every node, absent ones as an explicit
// `null` -- the exact shape the web app received from `resolvePromptToEventFilter` and put in the
// `ai_expression` URL param (the production crash: `Cannot read properties of null (reading 'map')`).
describe('null-padded GraphQL FilterNode shape', () => {
  const paddedLeaf = (field: string, value: unknown) => ({ op: null, field, value, children: null, child: null });
  const paddedGroup = (op: string, children: unknown[]) => ({ op, field: null, value: null, children, child: null });
  const paddedNot = (child: unknown) => ({ op: 'NOT', field: null, value: null, children: null, child });

  it('stripNullNodeKeys removes null node keys from leaves, groups and NOT nodes, recursively', () => {
    const stripped = stripNullNodeKeys(
      paddedGroup('AND', [paddedLeaf('type', ['COMPETITION']), paddedNot(paddedLeaf('keyword', 'jazz'))])
    );
    assert.deepEqual(stripped, {
      op: 'AND',
      children: [
        { field: 'type', value: ['COMPETITION'] },
        { op: 'NOT', child: { field: 'keyword', value: 'jazz' } },
      ],
    });
  });

  it('stripNullNodeKeys leaves non-node keys and other nulls inside a leaf value untouched', () => {
    const stripped = stripNullNodeKeys({ field: 'dateRange', value: { anchor: 'TODAY', offsetUnit: null }, extra: null });
    assert.deepEqual(stripped, { field: 'dateRange', value: { anchor: 'TODAY', offsetUnit: null }, extra: null });
  });

  it('stripNullNodeKeys drops the null optional span / radius keys of a leaf value (GraphQL round trip)', () => {
    assert.deepEqual(
      stripNullNodeKeys({
        field: 'dateRange',
        value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: null, spanUnit: null },
      }),
      { field: 'dateRange', value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' } }
    );
    assert.deepEqual(
      stripNullNodeKeys({ field: 'locationProximity', value: { coordinates: { lat: 1, lng: 2 }, radiusMeters: null } }),
      { field: 'locationProximity', value: { coordinates: { lat: 1, lng: 2 } } }
    );
  });

  it('stripNullNodeKeys passes non-objects through unchanged', () => {
    assert.equal(stripNullNodeKeys(null), null);
    assert.equal(stripNullNodeKeys('x'), 'x');
    assert.deepEqual(stripNullNodeKeys([1]), [1]);
  });

  it('validateFilterNode accepts the exact payload from the failing production URL and returns a clean node', () => {
    const result = validateFilterNode(
      paddedGroup('AND', [paddedLeaf('type', ['COMPETITION']), paddedLeaf('keyword', 'badminton')])
    );
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.deepEqual(result.node, {
        op: 'AND',
        children: [
          { field: 'type', value: ['COMPETITION'] },
          { field: 'keyword', value: 'badminton' },
        ],
      });
      assert.equal(JSON.stringify(result.node).includes('null'), false);
    }
  });

  it('still rejects an invalid null-padded tree (a padded NOT of a NOT is a double NOT)', () => {
    const result = validateFilterNode(paddedNot(paddedNot(paddedLeaf('keyword', 'jazz'))));
    assert.equal(result.valid, false);
  });
});

describe('validateFilterNode: Epic 9 review hardening (P7, P8, P14)', () => {
  it('P7: accepts a dateRange whose optional span fields are null and returns them stripped', () => {
    const result = validateFilterNode({
      field: 'dateRange',
      value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: null, spanUnit: null },
    });
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.deepEqual(result.node, {
        field: 'dateRange',
        value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' },
      });
    }
  });

  it('P7: accepts a locationProximity whose radiusMeters is null', () => {
    const result = validateFilterNode({
      field: 'locationProximity',
      value: { coordinates: { lat: -7.7, lng: 110.3 }, radiusMeters: null },
    });
    assert.equal(result.valid, true);
  });

  it('P8: rejects a leaf with an unknown op instead of passing it on to the compiler', () => {
    const result = validateFilterNode({ op: 'XOR', field: 'isFree', value: true });
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.issues[0].reason, /Unknown "op"/);
    }
  });

  it('P8: rejects a keyword that compiles to nothing (whitespace or a bare #)', () => {
    for (const keyword of ['   ', '#', '# ']) {
      assert.equal(validateFilterNode({ field: 'keyword', value: keyword }).valid, false, JSON.stringify(keyword));
    }
    assert.equal(validateFilterNode({ field: 'keyword', value: '#jazz' }).valid, true);
  });

  it('P8: returns the parsed node, dropping keys outside the domain shape', () => {
    const result = validateFilterNode({
      op: 'AND',
      junk: 'x'.repeat(100),
      children: [{ field: 'isFree', value: true, __typename: 'FilterNode' }, leafType],
    });
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.deepEqual(result.node, { op: 'AND', children: [{ field: 'isFree', value: true }, leafType] });
    }
  });

  it('P8: rejects out-of-range coordinates and oversized text', () => {
    assert.equal(
      validateFilterNode({ field: 'locationProximity', value: { coordinates: { lat: 1000, lng: 0 } } }).valid,
      false
    );
    assert.equal(validateFilterNode({ field: 'keyword', value: 'a'.repeat(5000) }).valid, false);
  });

  it('P14: returns an invalid result (never throws) for a 30000-level NOT chain, with a short message', () => {
    let node: unknown = { field: 'isFree', value: true };
    for (let i = 0; i < 30000; i += 1) {
      node = { op: 'NOT', child: node };
    }
    const result = validateFilterNode(node);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.issues.length, 1);
      assert.ok(result.issues[0].reason.length < 400);
    }
  });

  it('P14: returns a single issue for a group with 20000 children and caps the issue list otherwise', () => {
    const wide = validateFilterNode({ op: 'AND', children: Array.from({ length: 20000 }, () => ({ op: 'AND', children: [] })) });
    assert.equal(wide.valid, false);
    if (!wide.valid) {
      assert.equal(wide.issues.length, 1);
    }

    const moderate = validateFilterNode({ op: 'AND', children: Array.from({ length: 150 }, () => ({ op: 'AND', children: [] })) });
    assert.equal(moderate.valid, false);
    if (!moderate.valid) {
      assert.ok(moderate.issues.length <= 25);
    }
  });
});

describe('validateFilterNode: weekday expansion cap (Epic 9 review P17)', () => {
  const allWeekdays = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI, DayOfWeek.SAT, DayOfWeek.SUN];
  const longWindow: FilterNode = {
    field: 'dateRange',
    value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 24, spanUnit: 'MONTH' },
  };

  it('rejects a date range x weekdays AND that would expand past the limit, naming the problem', () => {
    const result = validateFilterNode({ op: 'AND', children: [longWindow, { field: 'dayOfWeek', value: allWeekdays }] });
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.issues[0].reason, /would match about \d+ dates \(limit 150\)/);
    }
  });

  it('accepts the realistic large requests: every weekend for 6 months, every weekday for 6 months', () => {
    const sixMonths: FilterNode = {
      field: 'dateRange',
      value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 6, spanUnit: 'MONTH' },
    };
    for (const days of [[DayOfWeek.SAT, DayOfWeek.SUN], [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI]]) {
      assert.equal(validateFilterNode({ op: 'AND', children: [sixMonths, { field: 'dayOfWeek', value: days }] }).valid, true);
    }
  });

  it('does not penalise a long date range or a weekday leaf on its own', () => {
    assert.equal(validateFilterNode(longWindow).valid, true);
    assert.equal(validateFilterNode({ field: 'dayOfWeek', value: allWeekdays }).valid, true);
  });
});
