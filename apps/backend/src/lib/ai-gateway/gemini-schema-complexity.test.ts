import test from 'node:test';
import assert from 'node:assert/strict';
import { measureGeminiSchemaComplexity } from './gemini-schema-complexity.js';

test('counts enum members wherever the schema repeats them', () => {
  const leaf = { type: 'OBJECT', properties: { kind: { type: 'STRING', enum: ['A', 'B', 'C'] } } };
  const schema = { type: 'OBJECT', properties: { first: leaf, second: leaf, list: { type: 'ARRAY', items: leaf } } };

  const { enumValues, nodes } = measureGeminiSchemaComplexity(schema);

  assert.equal(enumValues, 9);
  // root + 3 leaf objects + 3 `kind` strings + the list array
  assert.equal(nodes, 8);
});

test('a property that happens to be named "enum" or "type" is not mistaken for schema keywords', () => {
  const schema = { type: 'OBJECT', properties: { type: { type: 'STRING' }, enum: { type: 'STRING' } } };

  assert.deepEqual(
    { enumValues: measureGeminiSchemaComplexity(schema).enumValues, nodes: measureGeminiSchemaComplexity(schema).nodes },
    { enumValues: 0, nodes: 3 }
  );
});

test('reports the serialized size', () => {
  const schema = { type: 'STRING' };

  assert.equal(measureGeminiSchemaComplexity(schema).serializedChars, JSON.stringify(schema).length);
});
