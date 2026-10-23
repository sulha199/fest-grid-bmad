import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWithinRadiusConditions } from './resolveWithinRadiusConditions.js';
import { InvalidUserLocationInputError } from '../user-locations/validateLocationInput.js';

test('resolveWithinRadiusConditions rejects a withinRadius condition that has no value at all', () => {
  assert.throws(
    () =>
      resolveWithinRadiusConditions(
        { field: 'scheduleCoordinates', operator: 'withinRadius', value: undefined },
        new Map()
      ),
    InvalidUserLocationInputError
  );
});
