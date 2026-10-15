import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformGeminiResponseToFilterExpression } from './transform-gemini-response-to-filter-expression.js';
import { normalize } from './normalize-filter-node.js';
import { expressionFromFlatFilter } from './flat-filter-conversion.js';
import { transformGeminiResponseToEventFilter } from './transform-gemini-response-to-event-filter.js';
import { validateFilterNode } from './filter-node-schema.js';
import { FILTER_NODE_MAX_DEPTH, type FilterNode } from './filter-node.js';

/** `depth(leaf) = 1`; `depth(NOT x) = 1 + depth(x)`; `depth(group) = 1 + max(depth(c))`. */
function depthOf(node: FilterNode): number {
  if (!('op' in node)) return 1;
  if (node.op === 'NOT') return 1 + depthOf(node.child);
  return 1 + Math.max(...node.children.map(depthOf));
}

describe('transformGeminiResponseToFilterExpression (AC2)', () => {
  it('converts the SPEC worked-example tree ("jazz or blues in Sleman or Bantul this weekend, not workshops")', () => {
    const payload = {
      expression: {
        op: 'AND',
        children: [
          { op: 'OR', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
          {
            op: 'OR',
            children: [{ location: { adminArea: 'Sleman' } }, { location: { adminArea: 'Bantul' } }],
          },
          { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
          { op: 'NOT', child: { types: ['WORKSHOP'] } },
        ],
      },
      caveats: ['model-reported caveat'],
    };

    const result = transformGeminiResponseToFilterExpression(payload);

    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { op: 'OR', children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }] },
        {
          op: 'OR',
          children: [
            { field: 'locationAdminArea', value: 'Sleman' },
            { field: 'locationAdminArea', value: 'Bantul' },
          ],
        },
        { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
        { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
        { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
      ],
    });
    assert.ok(depthOf(result.expression) <= FILTER_NODE_MAX_DEPTH);
    assert.deepEqual(result.caveats, ['model-reported caveat']);
  });

  it('accepts the legacy flat `resolvedFilter` shape, regression-anchored on the existing mocked fixture', () => {
    const payload = {
      resolvedFilter: { keyword: 'live jazz', types: ['PERFORMANCE'], categories: ['MUSIC'] },
      caveats: ['ignoring price filter'],
    };

    const result = transformGeminiResponseToFilterExpression(payload);

    const expected = normalize(expressionFromFlatFilter(transformGeminiResponseToEventFilter(payload.resolvedFilter)));
    assert.deepEqual(result.expression, expected);
    assert.deepEqual(result.caveats, ['ignoring price filter']);
  });

  it('expands a raw leaf with 2+ populated fields nested under an OR parent into spliced siblings, never a nested group (depth-safety)', () => {
    const payload = {
      expression: {
        op: 'OR',
        children: [{ keyword: 'jazz' }, { isFree: true, venueType: 'CAFE' }],
      },
      caveats: [],
    };

    const result = transformGeminiResponseToFilterExpression(payload);

    assert.deepEqual(result.expression, {
      op: 'OR',
      children: [
        { field: 'keyword', value: 'jazz' },
        { field: 'venueType', value: 'CAFE' },
        { field: 'isFree', value: true },
      ],
    });
    assert.ok(depthOf(result.expression) <= FILTER_NODE_MAX_DEPTH);
  });

  it('drops a double-NOT entirely, pushing the double-negation caveat', () => {
    const payload = {
      expression: { op: 'NOT', child: { op: 'NOT', child: { isFree: true } } },
      caveats: [],
    };

    const result = transformGeminiResponseToFilterExpression(payload);

    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, [
      'A double negation in your prompt was simplified; the surrounding condition was dropped.',
    ]);
  });

  it('trims a tree exceeding FILTER_NODE_MAX_NODES to validity with exactly one generic over-limit caveat', () => {
    const manyKeywords = Array.from({ length: 13 }, (_, i) => ({ keyword: `kw-${i}` }));
    const payload = {
      expression: { op: 'OR', children: manyKeywords },
      caveats: [],
    };

    const result = transformGeminiResponseToFilterExpression(payload);

    assert.ok(result.expression.op === 'OR');
    assert.ok((result.expression as { op: 'OR'; children: unknown[] }).children.length < 13);
    assert.deepEqual(result.caveats, [
      'Your prompt described more conditions than the filter supports, so some were dropped.',
    ]);
  });

  it('degrades null/garbage payload (neither expression nor resolvedFilter key) to an empty filter with no caveats and no throw', () => {
    for (const payload of [null, undefined, {}, 'garbage', 42, []]) {
      const result = transformGeminiResponseToFilterExpression(payload);
      assert.deepEqual(result.expression, { op: 'AND', children: [] });
      assert.deepEqual(result.caveats, []);
    }
  });

  it('a non-plain-object raw "expression" value (e.g. a bare string) degrades to an empty filter', () => {
    const result = transformGeminiResponseToFilterExpression({ expression: 'garbage-string', caveats: [] });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, []);
  });

  it('an OR whose only child is entirely out-of-vocabulary (no surviving leaves) degrades to an empty filter', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'OR', children: [{ notARealField: 'xyz' }] },
      caveats: [],
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, []);
  });

  it('a NOT whose child is entirely out-of-vocabulary (not a double-NOT) degrades to an empty filter without the double-negation caveat', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'NOT', child: { notARealField: 'xyz' } },
      caveats: [],
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, []);
  });

  it('trims a widest group nested inside a NOT (exercising the NOT-recursion branch of the trim/widest-search logic)', () => {
    const manyKeywords = Array.from({ length: 13 }, (_, i) => ({ keyword: `kw-${i}` }));
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'NOT', child: { op: 'OR', children: manyKeywords } },
      caveats: [],
    });
    assert.ok(validateFilterNode(result.expression).valid);
    assert.deepEqual(result.caveats, [
      'Your prompt described more conditions than the filter supports, so some were dropped.',
    ]);
  });

  it('trims a widest group nested one level inside an unrelated sibling group (exercising the group-recursion branch of the trim logic)', () => {
    const manyKeywords = Array.from({ length: 13 }, (_, i) => ({ keyword: `kw-${i}` }));
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'AND', children: [{ op: 'OR', children: manyKeywords }, { keyword: 'extra' }] },
      caveats: [],
    });
    assert.ok(validateFilterNode(result.expression).valid);
    assert.deepEqual(result.caveats, [
      'Your prompt described more conditions than the filter supports, so some were dropped.',
    ]);
  });

  it('rethrows on a depth violation after construction (adversarial raw JSON, not reachable from a schema-conformant Gemini response, but this function must never silently swallow one)', () => {
    assert.throws(() => {
      transformGeminiResponseToFilterExpression({
        expression: {
          op: 'AND',
          children: [
            { op: 'NOT', child: { op: 'OR', children: [{ keyword: 'a' }, { keyword: 'b' }] } },
            { keyword: 'c' },
          ],
        },
        caveats: [],
      });
    }, /depth/i);
  });

  it('a bare multi-field leaf at the top level (no wrapping op) wraps its spliced siblings in an explicit top-level AND', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { keyword: 'jazz', isFree: true },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'keyword', value: 'jazz' },
        { field: 'isFree', value: true },
      ],
    });
  });

  it('a NOT whose child is a multi-field leaf (2+ results) bundles them into an explicit AND before wrapping in NOT', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'NOT', child: { keyword: 'jazz', isFree: true } },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'NOT',
      child: { op: 'AND', children: [{ field: 'keyword', value: 'jazz' }, { field: 'isFree', value: true }] },
    });
  });

  it('drops a double-NOT that is only exposed after normalize() collapses an intervening single-child OR', () => {
    // NOT(OR(NOT(leaf))) -- not an immediate double-NOT at conversion time (the NOT's immediate
    // child is an OR), but the OR has exactly one child, so normalize() collapses it away,
    // leaving NOT(NOT(leaf)) -- a real double-NOT that must still be caught and dropped.
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'NOT', child: { op: 'OR', children: [{ op: 'NOT', child: { keyword: 'x' } }] } },
      caveats: [],
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, [
      'A double negation in your prompt was simplified; the surrounding condition was dropped.',
    ]);
  });

  it('silently drops a leaf with an out-of-vocabulary/garbage field inside an otherwise-valid tree (no caveat pushed by this function)', () => {
    const payload = {
      expression: {
        op: 'AND',
        children: [{ keyword: 'jazz' }, { notARealField: 'xyz' }],
      },
      caveats: [],
    };

    const result = transformGeminiResponseToFilterExpression(payload);

    assert.deepEqual(result.expression, { field: 'keyword', value: 'jazz' });
    assert.deepEqual(result.caveats, []);
  });
});
