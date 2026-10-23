import test from 'node:test';
import assert from 'node:assert/strict';
import { flatFilterFromExpression } from './flat-filter-conversion.js';

test('flatFilterFromExpression keeps radiusMeters from a locationProximity leaf', () => {
  const result = flatFilterFromExpression({
    field: 'locationProximity',
    value: { coordinates: { lat: 1, lng: 2 }, radiusMeters: 5000 },
  });

  assert.deepEqual(result, { location: { coordinates: { lat: 1, lng: 2 }, radiusMeters: 5000 } });
});

test('flatFilterFromExpression omits radiusMeters when the locationProximity leaf has none', () => {
  const result = flatFilterFromExpression({
    field: 'locationProximity',
    value: { coordinates: { lat: 1, lng: 2 } },
  });

  assert.deepEqual(result, { location: { coordinates: { lat: 1, lng: 2 } } });
});
