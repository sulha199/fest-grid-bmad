import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FilterNode } from '../filter-node.js';
import type { GeminiFilterExtractionResult } from '../transform-gemini-response-to-filter-expression.js';
import type { GoldenPromptFixture } from './golden-prompt-fixtures.js';
import { computeFilterNodeFieldSignature, summarizeGoldenPromptDrift } from './compute-golden-prompt-drift.js';

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
