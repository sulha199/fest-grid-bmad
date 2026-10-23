import test from 'node:test';
import assert from 'node:assert/strict';
import { mapExtractionPayloadToProposedCorrection } from './map-extraction-payload-to-proposed-correction.js';
import type { GeminiEventPayload } from './types.js';

test('mapExtractionPayloadToProposedCorrection tolerates a payload missing its optional collections', () => {
  const sparse = { eventName: 'Bare Gig', confidenceScore: 0.4 } as unknown as GeminiEventPayload;

  const result = mapExtractionPayloadToProposedCorrection(sparse);

  assert.deepEqual(result.schedules, []);
  assert.deepEqual(result.types, []);
  assert.deepEqual(result.categories, []);
  assert.equal(result.location, '');
  assert.equal(result.links, undefined);
});
