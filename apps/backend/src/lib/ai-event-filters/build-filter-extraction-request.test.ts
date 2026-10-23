import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilterExtractionResponseSchema, buildFilterExtractionSystemInstruction } from './build-filter-extraction-request.js';

// SPEC CAP-6 / filter-vocabulary.md: NOT keeps events with no value for the negated field, and the
// SQL (`ne` / `notIn` / `NOT COALESCE(..., false)`) implements exactly that. The model prompt must
// not teach the opposite, or the model phrases exclusions around a semantic the backend does not apply.
test('the system instruction says NOT keeps events with no value for the negated field', () => {
  const instruction = buildFilterExtractionSystemInstruction();

  assert.match(instruction, /NOT KEEPS it/);
  assert.doesNotMatch(instruction, /ALSO excludes events that have NO VALUE/);
  assert.doesNotMatch(instruction, /NULL is never treated as a match/);
});

test('the response schema forbids a non-positive radiusMeters at every unrolled level', () => {
  const radiusSchemas: unknown[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'radiusMeters') radiusSchemas.push(value);
      else visit(value);
    }
  };
  visit(buildFilterExtractionResponseSchema());

  // Each level appears under both `children` and `child`: 1 + 2 + 4 occurrences across 3 levels.
  assert.equal(radiusSchemas.length, 7);
  for (const schema of radiusSchemas) {
    assert.deepEqual(schema, { type: 'INTEGER', minimum: 1 });
  }
});
