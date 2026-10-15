import { test } from 'node:test';
import assert from 'node:assert';
import { isCycleElapsed, nextCycleReset, CYCLE_START_FUTURE_TOLERANCE_MS } from './usage-cycle.js';

test('usage-cycle - isCycleElapsed boundary conditions', () => {
  const cycleDays = 30;
  const resetDate = new Date('2026-08-01T00:00:00Z');
  const resetIso = resetDate.toISOString();

  // Exactly at boundary
  const exactNow = new Date(resetDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);
  assert.equal(isCycleElapsed(resetIso, cycleDays, exactNow), true);

  // Just before boundary (1ms before)
  const beforeNow = new Date(exactNow.getTime() - 1);
  assert.equal(isCycleElapsed(resetIso, cycleDays, beforeNow), false);

  // Just after boundary (1ms after)
  const afterNow = new Date(exactNow.getTime() + 1);
  assert.equal(isCycleElapsed(resetIso, cycleDays, afterNow), true);
});

test('usage-cycle - nextCycleReset', () => {
  const cycleDays = 30;
  const now = new Date('2026-08-01T00:00:00Z');
  const expectedNextReset = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(nextCycleReset(now, cycleDays), expectedNextReset);
});

test('usage-cycle - isCycleElapsed self-heals a cycle start corrupted into the future', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  // The prod bug: start stored as now + 30d under a 1-day cycle.
  const corruptStart = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isCycleElapsed(corruptStart, 1, now), true);

  // Just past the skew tolerance counts as corrupt...
  const pastTolerance = new Date(now.getTime() + CYCLE_START_FUTURE_TOLERANCE_MS + 1).toISOString();
  assert.equal(isCycleElapsed(pastTolerance, 1, now), true);
});

test('usage-cycle - isCycleElapsed tolerates small clock skew between Lambdas', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  const skewedStart = new Date(now.getTime() + 2_000).toISOString();
  assert.equal(isCycleElapsed(skewedStart, 1, now), false);

  const atTolerance = new Date(now.getTime() + CYCLE_START_FUTURE_TOLERANCE_MS).toISOString();
  assert.equal(isCycleElapsed(atTolerance, 1, now), false);
});
