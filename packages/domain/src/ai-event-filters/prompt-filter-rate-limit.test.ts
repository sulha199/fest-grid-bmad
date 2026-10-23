import { test } from 'node:test';
import assert from 'node:assert';
import { isRateLimitWindowElapsed, evaluatePromptFilterRateLimit } from './prompt-filter-rate-limit.js';

test('prompt-filter-rate-limit - isRateLimitWindowElapsed boundary conditions', () => {
  const windowMinutes = 10;
  const windowStart = new Date('2026-08-01T00:00:00Z');
  const windowStartIso = windowStart.toISOString();

  // Exactly at boundary -- inclusive, matching isCycleElapsed's own `>=` convention.
  const exactNow = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
  assert.equal(isRateLimitWindowElapsed(windowStartIso, windowMinutes, exactNow), true);

  // Just before boundary (1ms before)
  const beforeNow = new Date(exactNow.getTime() - 1);
  assert.equal(isRateLimitWindowElapsed(windowStartIso, windowMinutes, beforeNow), false);

  // Just after boundary (1ms after)
  const afterNow = new Date(exactNow.getTime() + 1);
  assert.equal(isRateLimitWindowElapsed(windowStartIso, windowMinutes, afterNow), true);
});

test('prompt-filter-rate-limit - evaluatePromptFilterRateLimit: no prior state -> allowed, count 1', () => {
  const now = new Date('2026-08-01T00:05:00Z');
  const decision = evaluatePromptFilterRateLimit(null, 10, 10, now);
  assert.equal(decision.allowed, true);
  assert.deepStrictEqual(decision.nextState, { requestCount: 1, windowStartAt: now.toISOString() });
});

test('prompt-filter-rate-limit - evaluatePromptFilterRateLimit: under limit -> allowed, incremented, same window', () => {
  const windowStartAt = new Date('2026-08-01T00:00:00Z').toISOString();
  const now = new Date('2026-08-01T00:01:00Z'); // 1 minute into a 10-minute window
  const decision = evaluatePromptFilterRateLimit({ requestCount: 3, windowStartAt }, 10, 10, now);
  assert.equal(decision.allowed, true);
  assert.deepStrictEqual(decision.nextState, { requestCount: 4, windowStartAt });
});

test('prompt-filter-rate-limit - evaluatePromptFilterRateLimit: at limit -> denied, state unchanged', () => {
  const windowStartAt = new Date('2026-08-01T00:00:00Z').toISOString();
  const now = new Date('2026-08-01T00:01:00Z');
  const state = { requestCount: 10, windowStartAt };
  const decision = evaluatePromptFilterRateLimit(state, 10, 10, now);
  assert.equal(decision.allowed, false);
  assert.deepStrictEqual(decision.nextState, state);
});

test('prompt-filter-rate-limit - evaluatePromptFilterRateLimit: over limit -> denied', () => {
  const windowStartAt = new Date('2026-08-01T00:00:00Z').toISOString();
  const now = new Date('2026-08-01T00:01:00Z');
  const state = { requestCount: 15, windowStartAt };
  const decision = evaluatePromptFilterRateLimit(state, 10, 10, now);
  assert.equal(decision.allowed, false);
  assert.deepStrictEqual(decision.nextState, state);
});

test('prompt-filter-rate-limit - evaluatePromptFilterRateLimit: window elapsed with a stale high count -> allowed, reset to count 1 with a fresh windowStartAt', () => {
  const windowStartAt = new Date('2026-08-01T00:00:00Z').toISOString();
  const now = new Date('2026-08-01T00:20:00Z'); // well past a 10-minute window
  const decision = evaluatePromptFilterRateLimit({ requestCount: 50, windowStartAt }, 10, 10, now);
  assert.equal(decision.allowed, true);
  assert.deepStrictEqual(decision.nextState, { requestCount: 1, windowStartAt: now.toISOString() });
});

test('prompt-filter-rate-limit - evaluatePromptFilterRateLimit: boundary where now is exactly windowMinutes after windowStartAt -> counts as elapsed, resets', () => {
  const windowStartAt = new Date('2026-08-01T00:00:00Z').toISOString();
  const now = new Date(new Date(windowStartAt).getTime() + 10 * 60 * 1000); // exactly 10 minutes later
  const decision = evaluatePromptFilterRateLimit({ requestCount: 10, windowStartAt }, 10, 10, now);
  assert.equal(decision.allowed, true);
  assert.deepStrictEqual(decision.nextState, { requestCount: 1, windowStartAt: now.toISOString() });
});

test('Epic 9 review P12: a limit of 0 allows nothing, not even the first request of a window', () => {
  const decision = evaluatePromptFilterRateLimit(null, 0, 10, new Date('2026-10-23T00:00:00Z'));
  assert.strictEqual(decision.allowed, false);
});

test('Epic 9 review P12: a window of 0 minutes does not disable the limit', () => {
  const now = new Date('2026-10-23T00:00:00Z');
  const decision = evaluatePromptFilterRateLimit({ requestCount: 5, windowStartAt: now.toISOString() }, 5, 0, now);
  assert.strictEqual(decision.allowed, false);
});
