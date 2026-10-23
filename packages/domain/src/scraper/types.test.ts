import test from 'node:test';
import assert from 'node:assert/strict';
import { ApifyRequestTimeoutError, ScraperCapacityExceededError } from './types.js';

for (const [ErrorClass, name] of [
  [ScraperCapacityExceededError, 'ScraperCapacityExceededError'],
  [ApifyRequestTimeoutError, 'ApifyRequestTimeoutError'],
] as const) {
  test(`${name} is an Error subclass that carries its name and message`, () => {
    const error = new ErrorClass('boom');
    assert.ok(error instanceof Error);
    assert.equal(error.name, name);
    assert.equal(error.message, 'boom');
  });

  test(`${name} can be constructed without a message`, () => {
    assert.equal(new ErrorClass().message, '');
  });
}
