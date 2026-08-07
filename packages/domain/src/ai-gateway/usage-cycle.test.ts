import { test } from 'node:test';
import assert from 'node:assert';
import { isCycleElapsed, nextCycleReset } from './usage-cycle.js';

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
