import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformGeminiResponseToFilterExpression } from '../transform-gemini-response-to-filter-expression.js';
import { validateFilterNode } from '../filter-node-schema.js';
import { isFilterGroupNode, type FilterNode } from '../filter-node.js';
import { GOLDEN_PROMPT_CATEGORIES, GOLDEN_PROMPT_FIXTURES } from './golden-prompt-fixtures.js';

/**
 * Mirrors `transformGeminiResponseToFilterExpression`'s own `isEmptyExpression` sentinel check
 * (same file, Dev Notes decision 1 context) -- the canonical "no filter at all" shape is
 * `validateFilterNode`'s one documented exception (an empty `AND`/`OR` group is otherwise always
 * rejected as malformed), produced on purpose by every `off-topic` fixture here. Re-validating
 * against the generic validator without this same carve-out would reject the exact shape the
 * production function itself treats as trivially valid.
 */
function isEmptySentinel(node: FilterNode): boolean {
  return isFilterGroupNode(node) && node.op === 'AND' && node.children.length === 0;
}

describe('golden-prompt fixtures (Story 9.7 AC1)', () => {
  for (const fixture of GOLDEN_PROMPT_FIXTURES) {
    it(fixture.id, () => {
      const result = transformGeminiResponseToFilterExpression(fixture.geminiResponse);
      assert.deepEqual(result.expression, fixture.expected.expression);
      assert.deepEqual(result.caveats, fixture.expected.caveats);
    });
  }
});

describe('golden-prompt fixture-set integrity (Story 9.7 AC1)', () => {
  it('has at least 40 total fixtures', () => {
    assert.ok(
      GOLDEN_PROMPT_FIXTURES.length >= 40,
      `expected >= 40 fixtures, got ${GOLDEN_PROMPT_FIXTURES.length}`
    );
  });

  it('has at least 15 "en" and at least 15 "id" fixtures', () => {
    const enCount = GOLDEN_PROMPT_FIXTURES.filter((f) => f.lang === 'en').length;
    const idCount = GOLDEN_PROMPT_FIXTURES.filter((f) => f.lang === 'id').length;
    assert.ok(enCount >= 15, `expected >= 15 "en" fixtures, got ${enCount}`);
    assert.ok(idCount >= 15, `expected >= 15 "id" fixtures, got ${idCount}`);
  });

  it('represents every required category with at least 2 "en" and at least 2 "id" fixtures', () => {
    for (const category of GOLDEN_PROMPT_CATEGORIES) {
      const enCount = GOLDEN_PROMPT_FIXTURES.filter((f) => f.category === category && f.lang === 'en').length;
      const idCount = GOLDEN_PROMPT_FIXTURES.filter((f) => f.category === category && f.lang === 'id').length;
      assert.ok(enCount >= 2, `category "${category}" expected >= 2 "en" fixtures, got ${enCount}`);
      assert.ok(idCount >= 2, `category "${category}" expected >= 2 "id" fixtures, got ${idCount}`);
    }
  });

  it('has no duplicate ids', () => {
    const ids = GOLDEN_PROMPT_FIXTURES.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate fixture id found');
  });

  it('has no duplicate prompt text', () => {
    const prompts = GOLDEN_PROMPT_FIXTURES.map((f) => f.prompt);
    assert.equal(new Set(prompts).size, prompts.length, 'duplicate fixture prompt found');
  });

  it("every fixture's expected.expression independently re-validates as valid", () => {
    for (const fixture of GOLDEN_PROMPT_FIXTURES) {
      if (isEmptySentinel(fixture.expected.expression)) {
        // The canonical empty-filter sentinel (every "off-topic" fixture) -- trivially valid,
        // same carve-out `transformGeminiResponseToFilterExpression` itself applies.
        continue;
      }
      const validation = validateFilterNode(fixture.expected.expression);
      assert.ok(
        validation.valid,
        `fixture "${fixture.id}" expected.expression failed validateFilterNode: ${
          validation.valid ? '' : JSON.stringify(validation.issues)
        }`
      );
    }
  });

  it('every "over-limit" fixture carries the exact generic over-limit caveat', () => {
    const overLimitFixtures = GOLDEN_PROMPT_FIXTURES.filter((f) => f.category === 'over-limit');
    assert.ok(overLimitFixtures.length > 0, 'expected at least one "over-limit" fixture');
    for (const fixture of overLimitFixtures) {
      assert.ok(
        fixture.expected.caveats.includes(
          'Your prompt described more conditions than the filter supports, so some were dropped.'
        ),
        `fixture "${fixture.id}" (over-limit) missing the generic over-limit caveat`
      );
    }
  });

  it('every "off-topic" fixture degrades to an empty AND expression with at least one caveat', () => {
    const offTopicFixtures = GOLDEN_PROMPT_FIXTURES.filter((f) => f.category === 'off-topic');
    assert.ok(offTopicFixtures.length > 0, 'expected at least one "off-topic" fixture');
    for (const fixture of offTopicFixtures) {
      assert.deepEqual(fixture.expected.expression, { op: 'AND', children: [] });
      assert.ok(fixture.expected.caveats.length > 0, `fixture "${fixture.id}" (off-topic) expected at least one caveat`);
    }
  });
});
