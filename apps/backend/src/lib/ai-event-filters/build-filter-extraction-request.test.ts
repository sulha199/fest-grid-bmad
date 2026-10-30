import test from 'node:test';
import assert from 'node:assert/strict';
import { EventCategory } from '@festgrid/shared-types';
import { buildFilterExtractionResponseSchema, buildFilterExtractionSystemInstruction } from './build-filter-extraction-request.js';
import { measureGeminiSchemaComplexity } from '../ai-gateway/gemini-schema-complexity.js';

// The largest filter schema Gemini is known to have accepted: nightly eval run 11 (2026-10-24, 18
// EventCategory values, 7 unrolled node copies) = 345 enum values. From run 12 on, 380 values (23
// categories) made every call fail with a bare 400 INVALID_ARGUMENT, and no offline test noticed
// because nothing here ever sends the schema to Gemini. Do NOT raise this number to make a failing
// test pass: that is exactly the change that is rejected live. Shrink the schema instead, or confirm a
// bigger one is accepted (run the nightly eval via workflow_dispatch) before moving the ceiling.
const KNOWN_ACCEPTED_ENUM_VALUES = 345;

test('the response schema stays within the size Gemini is known to accept', () => {
  const { enumValues } = measureGeminiSchemaComplexity(buildFilterExtractionResponseSchema());

  assert.ok(
    enumValues <= KNOWN_ACCEPTED_ENUM_VALUES,
    `the filter response schema has ${enumValues} enum values across its unrolled copies (ceiling ${KNOWN_ACCEPTED_ENUM_VALUES}); ` +
      'Gemini rejects an over-complex schema with a bare 400 INVALID_ARGUMENT. Drop an enum from the leaf schema.'
  );
});

test('the response schema leaves categories open, because the glossary in the prompt names the values', () => {
  const categorySchemas: unknown[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'categories') categorySchemas.push(value);
      else visit(value);
    }
  };
  visit(buildFilterExtractionResponseSchema());

  assert.equal(categorySchemas.length, 7);
  for (const schema of categorySchemas) {
    assert.deepEqual(schema, { type: 'ARRAY', items: { type: 'STRING' } });
  }
  // With no enum to constrain the model, the prompt is the only place it learns the vocabulary.
  const instruction = buildFilterExtractionSystemInstruction();
  for (const category of Object.values(EventCategory)) {
    assert.ok(instruction.includes(`${category} --`), `the system instruction must define ${category}`);
  }
});

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
