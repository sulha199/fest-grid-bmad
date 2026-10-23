import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FilterNode } from '../filter-node.js';
import type { GeminiFilterExtractionResult } from '../transform-gemini-response-to-filter-expression.js';
import type { GoldenPromptFixture } from './golden-prompt-fixtures.js';
import {
  computeFilterNodeFieldSignature,
  computeFilterNodeShapeSignature,
  summarizeGoldenPromptDrift,
} from './compute-golden-prompt-drift.js';

describe('computeFilterNodeFieldSignature', () => {
  it('returns the single field name for a bare leaf', () => {
    const leaf: FilterNode = { field: 'keyword', value: 'jazz' };
    assert.deepEqual(computeFilterNodeFieldSignature(leaf), ['keyword']);
  });

  it('returns the field name for a NOT-wrapped leaf', () => {
    const node: FilterNode = { op: 'NOT', child: { field: 'venueType', value: 'MALL' } };
    assert.deepEqual(computeFilterNodeFieldSignature(node), ['venueType']);
  });

  it('returns sorted, de-duplicated field names for a nested AND/OR tree', () => {
    const node = {
      op: 'AND',
      children: [
        { op: 'OR', children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }] },
        { field: 'locationAdminArea', value: 'Sleman' },
        { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
      ],
    } as FilterNode;
    assert.deepEqual(computeFilterNodeFieldSignature(node), ['keyword', 'locationAdminArea', 'type']);
  });
});

describe('summarizeGoldenPromptDrift', () => {
  const fixture: GoldenPromptFixture = {
    id: 'test-fixture',
    lang: 'en',
    category: 'AND',
    prompt: 'jazz concerts in Sleman this weekend',
    geminiResponse: {},
    expected: {
      expression: {
        op: 'AND',
        children: [
          { field: 'keyword', value: 'jazz' },
          { field: 'locationAdminArea', value: 'Sleman' },
        ],
      },
      caveats: [],
    },
  };

  it('reports no drift when field signature and caveat presence both match', () => {
    const liveResult: GeminiFilterExtractionResult = {
      expression: {
        op: 'AND',
        children: [
          { field: 'keyword', value: 'live jazz' },
          { field: 'locationAdminArea', value: 'Sleman' },
        ],
      },
      caveats: [],
    };
    const result = summarizeGoldenPromptDrift(fixture, liveResult);
    assert.equal(result.drifted, false);
    assert.equal(result.details, 'no drift');
  });

  it('reports drift when the live field set differs from the expected one, naming both signatures', () => {
    const liveResult: GeminiFilterExtractionResult = {
      expression: { field: 'keyword', value: 'jazz' },
      caveats: [],
    };
    const result = summarizeGoldenPromptDrift(fixture, liveResult);
    assert.equal(result.drifted, true);
    assert.deepEqual(result.expectedFieldSignature, ['keyword', 'locationAdminArea']);
    assert.deepEqual(result.actualFieldSignature, ['keyword']);
    assert.ok(result.details.includes('keyword,locationAdminArea'));
    assert.ok(result.details.includes('actual=[keyword]'));
  });

  it('reports drift when fields match but caveat presence flips from none to present', () => {
    const liveResult: GeminiFilterExtractionResult = {
      expression: fixture.expected.expression,
      caveats: ['A specific price threshold is not supported yet, so it was ignored.'],
    };
    const result = summarizeGoldenPromptDrift(fixture, liveResult);
    assert.equal(result.drifted, true);
    assert.equal(result.expectedHadCaveats, false);
    assert.equal(result.actualHadCaveats, true);
  });

  it('reports drift when fields match but caveat presence flips from present to none', () => {
    const fixtureWithCaveat: GoldenPromptFixture = {
      ...fixture,
      expected: { ...fixture.expected, caveats: ['some caveat'] },
    };
    const liveResult: GeminiFilterExtractionResult = {
      expression: fixture.expected.expression,
      caveats: [],
    };
    const result = summarizeGoldenPromptDrift(fixtureWithCaveat, liveResult);
    assert.equal(result.drifted, true);
    assert.equal(result.expectedHadCaveats, true);
    assert.equal(result.actualHadCaveats, false);
  });
});

describe('computeFilterNodeShapeSignature', () => {
  const kw = (value: string): FilterNode => ({ field: 'keyword', value });
  const type: FilterNode = { field: 'type', value: ['WORKSHOP'] } as FilterNode;

  it('is just the field name for a bare leaf, whatever its value', () => {
    assert.equal(computeFilterNodeShapeSignature(kw('jazz')), 'keyword');
    assert.equal(computeFilterNodeShapeSignature(kw('something else')), 'keyword');
  });

  it('keeps group operators and NOT wrappers, which the field set cannot see', () => {
    assert.equal(computeFilterNodeShapeSignature({ op: 'NOT', child: type }), 'NOT(type)');
    assert.equal(computeFilterNodeShapeSignature({ op: 'AND', children: [kw('a'), { op: 'NOT', child: type }] }), 'AND(NOT(type),keyword)');
    assert.equal(computeFilterNodeShapeSignature({ op: 'OR', children: [kw('a'), type] }), 'OR(keyword,type)');
  });

  it('ignores child order inside a group', () => {
    assert.equal(
      computeFilterNodeShapeSignature({ op: 'AND', children: [kw('a'), type] }),
      computeFilterNodeShapeSignature({ op: 'AND', children: [type, kw('a')] })
    );
  });

  it('is insensitive to restructuring normalize() undoes', () => {
    assert.equal(computeFilterNodeShapeSignature({ op: 'AND', children: [kw('a')] }), 'keyword');
    assert.equal(
      computeFilterNodeShapeSignature({ op: 'AND', children: [{ op: 'AND', children: [kw('a'), type] }, kw('b')] }),
      'AND(keyword,keyword,type)'
    );
  });

  it('renders an empty group', () => {
    assert.equal(computeFilterNodeShapeSignature({ op: 'AND', children: [] }), 'AND()');
  });
});

describe('summarizeGoldenPromptDrift sees operator and polarity changes', () => {
  const kw = (value: string): FilterNode => ({ field: 'keyword', value });
  const type: FilterNode = { field: 'type', value: ['WORKSHOP'] } as FilterNode;
  const expected: FilterNode = { op: 'AND', children: [kw('jazz'), { op: 'NOT', child: type }] };
  const fixture: GoldenPromptFixture = {
    id: 'not-fixture',
    lang: 'en',
    category: 'NOT',
    prompt: 'jazz, not workshops',
    geminiResponse: {},
    expected: { expression: expected, caveats: [] },
  };
  const live = (expression: FilterNode): GeminiFilterExtractionResult => ({ expression, caveats: [] });

  it('reports no drift for the same shape with different free-text values', () => {
    const result = summarizeGoldenPromptDrift(fixture, live({ op: 'AND', children: [kw('live jazz'), { op: 'NOT', child: type }] }));
    assert.equal(result.drifted, false);
  });

  it('reports drift when the model drops the NOT but keeps the same fields', () => {
    const result = summarizeGoldenPromptDrift(fixture, live({ op: 'AND', children: [kw('jazz'), type] }));
    assert.equal(result.drifted, true);
    assert.deepEqual(result.expectedFieldSignature, result.actualFieldSignature);
    assert.equal(result.expectedShape, 'AND(NOT(type),keyword)');
    assert.equal(result.actualShape, 'AND(keyword,type)');
    assert.match(result.details, /shape expected=AND\(NOT\(type\),keyword\) actual=AND\(keyword,type\)/);
  });

  it('reports drift when an OR is flipped to an AND', () => {
    const orFixture: GoldenPromptFixture = {
      ...fixture,
      expected: { expression: { op: 'OR', children: [kw('jazz'), kw('blues')] }, caveats: [] },
    };
    const result = summarizeGoldenPromptDrift(orFixture, live({ op: 'AND', children: [kw('jazz'), kw('blues')] }));
    assert.equal(result.drifted, true);
  });

  it('reports drift when a NOT is turned positive', () => {
    const result = summarizeGoldenPromptDrift(
      { ...fixture, expected: { expression: { op: 'NOT', child: type }, caveats: [] } },
      live(type)
    );
    assert.equal(result.drifted, true);
  });
});
