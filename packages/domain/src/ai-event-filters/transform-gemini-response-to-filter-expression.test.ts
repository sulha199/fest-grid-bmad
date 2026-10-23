import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  transformGeminiResponseToFilterExpression,
  EMPTY_EXPRESSION_CAVEAT,
} from './transform-gemini-response-to-filter-expression.js';
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

  it('keeps a raw leaf with 2+ populated fields together as an AND under an OR parent (Epic 9 review P4)', () => {
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
        {
          op: 'AND',
          children: [
            { field: 'venueType', value: 'CAFE' },
            { field: 'isFree', value: true },
          ],
        },
      ],
    });
    assert.ok(depthOf(result.expression) <= FILTER_NODE_MAX_DEPTH);
  });

  it('P4: "workshops in Sleman OR concerts in Bantul" stays two ANDed pairs, not four alternatives', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: {
        op: 'OR',
        children: [
          { types: ['WORKSHOP'], location: { adminArea: 'Sleman' } },
          { types: ['PERFORMANCE'], location: { adminArea: 'Bantul' } },
        ],
      },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'OR',
      children: [
        {
          op: 'AND',
          children: [
            { field: 'type', value: ['WORKSHOP'] },
            { field: 'locationAdminArea', value: 'Sleman' },
          ],
        },
        {
          op: 'AND',
          children: [
            { field: 'type', value: ['PERFORMANCE'] },
            { field: 'locationAdminArea', value: 'Bantul' },
          ],
        },
      ],
    });
    assert.deepEqual(result.caveats, []);
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
    const expression = result.expression as { op: 'OR'; children: unknown[] };

    assert.ok(expression.op === 'OR');
    assert.ok(expression.children.length < 13);
    assert.deepEqual(result.caveats, [
      'Your prompt described more conditions than the filter supports, so some were dropped.',
    ]);
  });

  it('degrades null/garbage payload (neither expression nor resolvedFilter key) to an empty filter with only the could-not-build-a-filter caveat and no throw', () => {
    for (const payload of [null, undefined, {}, 'garbage', 42, []]) {
      const result = transformGeminiResponseToFilterExpression(payload);
      assert.deepEqual(result.expression, { op: 'AND', children: [] });
      assert.deepEqual(result.caveats, [EMPTY_EXPRESSION_CAVEAT]);
    }
  });

  it('a non-plain-object raw "expression" value (e.g. a bare string) degrades to an empty filter', () => {
    const result = transformGeminiResponseToFilterExpression({ expression: 'garbage-string', caveats: [] });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, [EMPTY_EXPRESSION_CAVEAT]);
  });

  it('an AND/OR node with a missing (non-array) "children" property degrades to an empty filter, defaulting to zero children', () => {
    const result = transformGeminiResponseToFilterExpression({ expression: { op: 'AND' }, caveats: [] });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, [EMPTY_EXPRESSION_CAVEAT]);
  });

  it('an OR whose only child is entirely out-of-vocabulary (no surviving leaves) degrades to an empty filter', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'OR', children: [{ notARealField: 'xyz' }] },
      caveats: [],
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, [EMPTY_EXPRESSION_CAVEAT]);
  });

  it('a NOT whose child is entirely out-of-vocabulary (not a double-NOT) degrades to an empty filter without the double-negation caveat', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'NOT', child: { notARealField: 'xyz' } },
      caveats: [],
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, [EMPTY_EXPRESSION_CAVEAT]);
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

  it('P3: a NOT over a multi-operand group nested in a group degrades to a caveat instead of throwing', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: {
        op: 'AND',
        children: [
          { op: 'NOT', child: { op: 'OR', children: [{ keyword: 'a' }, { keyword: 'b' }] } },
          { keyword: 'c' },
        ],
      },
      caveats: [],
    });
    // AND -> NOT -> OR -> leaf is depth 4: the too-deep negation is dropped, the rest still applies.
    assert.deepEqual(result.expression, { field: 'keyword', value: 'c' });
    assert.deepEqual(result.caveats, [
      'Your prompt described more conditions than the filter supports, so some were dropped.',
    ]);
  });

  it('P3: "free events, not music festivals" (NOT over a two-field leaf inside an AND) does not throw', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: {
        op: 'AND',
        children: [{ isFree: true }, { op: 'NOT', child: { categories: ['MUSIC'], types: ['FESTIVAL'] } }],
      },
      caveats: [],
    });
    assert.deepEqual(result.expression, { field: 'isFree', value: true });
    assert.equal(result.caveats.length, 1);
  });

  it('P2: a leaf the schema rejects (radiusMeters 0) is dropped with a caveat and the call returns', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: {
        op: 'AND',
        children: [
          { location: { coordinates: { lat: -7.8, lng: 110.4 }, radiusMeters: 0 } },
          { categories: ['MUSIC'] },
          { isFree: true },
        ],
      },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'locationProximity', value: { coordinates: { lat: -7.8, lng: 110.4 } } },
        { field: 'category', value: ['MUSIC'] },
        { field: 'isFree', value: true },
      ],
    });
    assert.deepEqual(result.caveats, ['The search radius in your prompt was invalid and was ignored.']);
  });

  it('P2: a lone invalid leaf (out-of-range latitude) returns an empty expression with a caveat, never hangs', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { location: { coordinates: { lat: 1000, lng: 0 }, radiusMeters: -5 } },
      caveats: [],
    });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.ok(result.caveats.length > 0);
  });

  it('P9: surfaces every fragment it has to discard instead of returning a wider filter silently', () => {
    const dateOutOfRange = transformGeminiResponseToFilterExpression({
      expression: { dateRange: { anchor: 'TODAY', offsetAmount: 120, offsetUnit: 'DAY' }, isFree: true },
      caveats: [],
    });
    assert.deepEqual(dateOutOfRange.expression, { field: 'isFree', value: true });
    assert.deepEqual(dateOutOfRange.caveats, [
      'The date range in your prompt could not be understood or is out of range, so it was ignored.',
    ]);

    const badType = transformGeminiResponseToFilterExpression({
      expression: { types: ['BOGUS'], isFree: true },
      caveats: [],
    });
    assert.deepEqual(badType.caveats, ['Some event types in your prompt are not supported and were ignored.']);

    const lowerCaseOp = transformGeminiResponseToFilterExpression({
      expression: { op: 'or', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
      caveats: [],
    });
    assert.deepEqual(lowerCaseOp.expression, {
      op: 'OR',
      children: [
        { field: 'keyword', value: 'jazz' },
        { field: 'keyword', value: 'blues' },
      ],
    });

    const unknownOp = transformGeminiResponseToFilterExpression({
      expression: { op: 'XOR', children: [{ keyword: 'a' }], isFree: true },
      caveats: [],
    });
    assert.deepEqual(unknownOp.expression, { field: 'isFree', value: true });
    assert.deepEqual(unknownOp.caveats, ['An unrecognised operator in your prompt was ignored.']);
  });

  it('P17: weekdays over a window too long to expand are ignored with a caveat; the date range is kept', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: {
        dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 24, spanUnit: 'MONTH' },
        dayOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      field: 'dateRange',
      value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: 24, spanUnit: 'MONTH' },
    });
    assert.deepEqual(result.caveats, [
      'The weekdays in your prompt cover too long a period to apply, so they were ignored and the whole date range is shown.',
    ]);
  });

  it('P9: a bare anchor without offsets means the anchor window itself, not a dropped date', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { dateRange: { anchor: 'THIS_WEEK' } },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      field: 'dateRange',
      value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'DAY' },
    });
  });

  it('P9: a NOT whose operand arrived in "children", or that carries sibling fields, keeps both', () => {
    const viaChildren = transformGeminiResponseToFilterExpression({
      expression: { op: 'AND', children: [{ keyword: 'jazz' }, { op: 'NOT', children: [{ types: ['WORKSHOP'] }] }] },
      caveats: [],
    });
    assert.deepEqual(viaChildren.expression, {
      op: 'AND',
      children: [
        { field: 'keyword', value: 'jazz' },
        { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
      ],
    });

    const withSibling = transformGeminiResponseToFilterExpression({
      expression: { op: 'NOT', child: { types: ['WORKSHOP'] }, isFree: true },
      caveats: [],
    });
    assert.deepEqual(withSibling.expression, {
      op: 'AND',
      children: [
        { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
        { field: 'isFree', value: true },
      ],
    });
  });

  it('P9: a blank model caveat does not suppress the empty-extraction caveat', () => {
    const result = transformGeminiResponseToFilterExpression({ expression: {}, caveats: ['', '   '] });
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.deepEqual(result.caveats, [EMPTY_EXPRESSION_CAVEAT]);
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
  it('keeps leaf fields carried directly on an AND/OR node (no "children") instead of silently dropping them', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'AND', categories: ['FAMILY_AND_KIDS'], location: { adminArea: 'Yogyakarta' } },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'category', value: ['FAMILY_AND_KIDS'] },
        { field: 'locationAdminArea', value: 'Yogyakarta' },
      ],
    });
    assert.deepEqual(result.caveats, []);
  });

  it('combines an AND/OR node\'s own leaf fields with its "children"', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'AND', keyword: 'exciting', children: [{ types: ['COMPETITION'] }] },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'type', value: ['COMPETITION'] },
        { field: 'keyword', value: 'exciting' },
      ],
    });
  });

  it('joins leaf fields carried on an OR node to that OR (its own operator), alongside its children', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'OR', keyword: 'jazz', children: [{ keyword: 'blues' }] },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'OR',
      children: [
        { field: 'keyword', value: 'blues' },
        { field: 'keyword', value: 'jazz' },
      ],
    });
  });

  it('accepts a flat v1-style answer at the top level (leaf fields beside "caveats", no "expression" key)', () => {
    const result = transformGeminiResponseToFilterExpression({
      types: ['COMPETITION'],
      categories: ['FAMILY_AND_KIDS'],
      location: { adminArea: 'Yogyakarta' },
      caveats: ['model note'],
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'type', value: ['COMPETITION'] },
        { field: 'category', value: ['FAMILY_AND_KIDS'] },
        { field: 'locationAdminArea', value: 'Yogyakarta' },
      ],
    });
    assert.deepEqual(result.caveats, ['model note']);
  });

  it('a top-level flat answer with a single leaf collapses to that one condition', () => {
    const result = transformGeminiResponseToFilterExpression({ keyword: 'badminton', caveats: [] });
    assert.deepEqual(result.expression, { field: 'keyword', value: 'badminton' });
  });

  it('treats null-valued group keys the model may emit for absent fields as absent', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: {
        op: 'AND',
        children: [
          { op: null, children: null, child: null, categories: ['FAMILY_AND_KIDS'], location: null },
          { op: null, location: { adminArea: 'Yogyakarta' }, categories: null },
        ],
      },
      caveats: [],
    });
    assert.deepEqual(result.expression, {
      op: 'AND',
      children: [
        { field: 'category', value: ['FAMILY_AND_KIDS'] },
        { field: 'locationAdminArea', value: 'Yogyakarta' },
      ],
    });
  });

  it('does not add the "could not build a filter" caveat when the model already explained an empty result', () => {
    const result = transformGeminiResponseToFilterExpression({
      expression: { op: 'AND', children: [] },
      caveats: ['price filters are not supported'],
    });
    assert.deepEqual(result.caveats, ['price filters are not supported']);
  });

  it('does not add the "could not build a filter" caveat to a non-empty result', () => {
    const result = transformGeminiResponseToFilterExpression({ expression: { keyword: 'jazz' }, caveats: [] });
    assert.deepEqual(result.caveats, []);
  });
});
