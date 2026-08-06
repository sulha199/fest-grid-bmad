/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateHidePastEventsAfterDays,
  InvalidUserSettingsInputError,
} from './validateUserSettingsInput.js';

test('validateUserSettingsInput domain logic', async (t) => {
  await t.test('validateHidePastEventsAfterDays validation', () => {
    // Valid boundaries
    assert.doesNotThrow(() => validateHidePastEventsAfterDays(0));
    assert.doesNotThrow(() => validateHidePastEventsAfterDays(365));
    assert.doesNotThrow(() => validateHidePastEventsAfterDays(7));

    // Invalid below 0
    assert.throws(
      () => validateHidePastEventsAfterDays(-1),
      (err: any) => err instanceof InvalidUserSettingsInputError && err.message.includes('must be an integer between 0 and 365')
    );

    // Invalid above 365
    assert.throws(
      () => validateHidePastEventsAfterDays(366),
      (err: any) => err instanceof InvalidUserSettingsInputError && err.message.includes('must be an integer between 0 and 365')
    );

    // Invalid non-integer
    assert.throws(
      () => validateHidePastEventsAfterDays(7.5),
      (err: any) => err instanceof InvalidUserSettingsInputError && err.message.includes('must be an integer')
    );

    // NaN or non-number values
    assert.throws(
      () => validateHidePastEventsAfterDays(NaN),
      (err: any) => err instanceof InvalidUserSettingsInputError
    );
    assert.throws(
      () => validateHidePastEventsAfterDays('7' as any),
      (err: any) => err instanceof InvalidUserSettingsInputError
    );
  });
});
