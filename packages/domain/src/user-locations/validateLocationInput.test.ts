import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLocationInputMode,
  validateRadiusMeters,
  InvalidUserLocationInputError,
} from './validateLocationInput.js';

test('validateLocationInput domain logic', async (t) => {
  await t.test('resolveLocationInputMode validation', () => {
    // Both address and coordinates - throws error
    assert.throws(
      () => resolveLocationInputMode({ address: 'Jakarta', latitude: -6, longitude: 106 }),
      (err: any) => err instanceof InvalidUserLocationInputError && err.message.includes('Cannot provide both address and coordinates')
    );

    // Only latitude (missing longitude) - throws error
    assert.throws(
      () => resolveLocationInputMode({ latitude: -6 }),
      (err: any) => err instanceof InvalidUserLocationInputError && err.message.includes('Must provide both latitude and longitude')
    );

    // Only longitude (missing latitude) - throws error
    assert.throws(
      () => resolveLocationInputMode({ longitude: 106 }),
      (err: any) => err instanceof InvalidUserLocationInputError && err.message.includes('Must provide both latitude and longitude')
    );

    // Address only - valid
    const resAddress = resolveLocationInputMode({ address: 'Jakarta' });
    assert.deepEqual(resAddress, { kind: 'ADDRESS', address: 'Jakarta' });

    // Coordinates only - valid
    const resCoords = resolveLocationInputMode({ latitude: -6.12, longitude: 106.34 });
    assert.deepEqual(resCoords, { kind: 'COORDINATES', latitude: -6.12, longitude: 106.34 });

    // Neither provided - returns null (valid for update)
    const resNone = resolveLocationInputMode({});
    assert.equal(resNone, null);
  });

  await t.test('validateRadiusMeters validation', () => {
    // Valid boundaries
    assert.doesNotThrow(() => validateRadiusMeters(1000));
    assert.doesNotThrow(() => validateRadiusMeters(50000));
    assert.doesNotThrow(() => validateRadiusMeters(10000));

    // Invalid below 1000
    assert.throws(
      () => validateRadiusMeters(999),
      (err: any) => err instanceof InvalidUserLocationInputError && err.message.includes('Radius must be between 1000 and 50000')
    );

    // Invalid above 50000
    assert.throws(
      () => validateRadiusMeters(50001),
      (err: any) => err instanceof InvalidUserLocationInputError && err.message.includes('Radius must be between 1000 and 50000')
    );

    // NaN or non-number values
    assert.throws(
      () => validateRadiusMeters(NaN),
      (err: any) => err instanceof InvalidUserLocationInputError
    );
  });
});
