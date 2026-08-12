import test from 'node:test';
import * as assert from 'node:assert';
import { getCancelledReportWindowCutoff } from './getCancelledReportWindowCutoff.js';

test('getCancelledReportWindowCutoff', async (t) => {
  await t.test('returns now minus windowDays', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 12, 34, 56, 789)); // Aug is 7 in JS Date (0-indexed)
    const cutoff = getCancelledReportWindowCutoff({
      windowDays: 7,
      now,
    });

    const expected = new Date(Date.UTC(2026, 7, 8, 12, 34, 56, 789));
    assert.strictEqual(cutoff.getTime(), expected.getTime());
  });

  await t.test('handles transition across month/year boundary', () => {
    const now = new Date(Date.UTC(2026, 0, 3, 12, 0, 0)); // Jan 3, 2026
    const cutoff = getCancelledReportWindowCutoff({
      windowDays: 5,
      now,
    });

    const expected = new Date(Date.UTC(2025, 11, 29, 12, 0, 0)); // Dec 29, 2025 (Dec is 11)
    assert.strictEqual(cutoff.getTime(), expected.getTime());
  });

  await t.test('uses system current date if now is omitted', () => {
    const cutoff = getCancelledReportWindowCutoff({
      windowDays: 7,
    });
    assert.ok(cutoff instanceof Date);
    assert.ok(!isNaN(cutoff.getTime()));
  });
});
