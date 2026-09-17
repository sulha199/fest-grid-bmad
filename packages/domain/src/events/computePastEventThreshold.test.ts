import test from 'node:test';
import * as assert from 'node:assert';
import { computePastEventThreshold } from './computePastEventThreshold.js';

test('computePastEventThreshold', async (t) => {
  await t.test('N=0 (default): threshold is UTC-today, no grace window', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 12, 34, 56)); // Aug is 7 in JS Date (0-indexed)
    const threshold = computePastEventThreshold({ now, hidePastEventsAfterDays: 0 });
    assert.strictEqual(threshold, '2026-08-15');
  });

  await t.test('custom N (e.g. N=14): threshold is N days before UTC-today', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 0, 0, 0));
    const threshold = computePastEventThreshold({ now, hidePastEventsAfterDays: 14 });
    assert.strictEqual(threshold, '2026-08-01');
  });

  await t.test('UTC end-of-day boundary (23:59:59) still floors to UTC-midnight', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 23, 59, 59));
    const threshold = computePastEventThreshold({ now, hidePastEventsAfterDays: 0 });
    assert.strictEqual(threshold, '2026-08-15');
  });

  await t.test('crossing a month/year boundary computes correctly', () => {
    const now = new Date(Date.UTC(2026, 0, 5, 0, 0, 0)); // 2026-01-05
    const threshold = computePastEventThreshold({ now, hidePastEventsAfterDays: 10 });
    assert.strictEqual(threshold, '2025-12-26');
  });
});
