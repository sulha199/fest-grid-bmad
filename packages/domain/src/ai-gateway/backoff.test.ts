import { test } from 'node:test';
import assert from 'node:assert';
import { computeBackoffDelayMs } from './backoff.js';

test('backoff - honors retryAfterSeconds', () => {
  const delay = computeBackoffDelayMs(1, 15);
  assert.equal(delay, 15000);
});

test('backoff - exponential backoff with ±20% jitter', () => {
  // attempt 1: base 1000. delay should be between 800 and 1200
  const delay1 = computeBackoffDelayMs(1);
  assert.ok(delay1 >= 800 && delay1 <= 1200, `delay1 was ${delay1}`);

  // attempt 2: base 2000. delay should be between 1600 and 2400
  const delay2 = computeBackoffDelayMs(2);
  assert.ok(delay2 >= 1600 && delay2 <= 2400, `delay2 was ${delay2}`);

  // attempt 6: base 32000 capped at 30000. delay should be between 24000 and 36000
  const delay6 = computeBackoffDelayMs(6);
  assert.ok(delay6 >= 24000 && delay6 <= 36000, `delay6 was ${delay6}`);
});
