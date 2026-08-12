import test from 'node:test';
import * as assert from 'node:assert';
import { shouldSoftDeleteFromCancelledReports } from './shouldSoftDeleteFromCancelledReports.js';

test('shouldSoftDeleteFromCancelledReports', async (t) => {
  await t.test('returns true when uniqueReporterCount matches threshold', () => {
    assert.strictEqual(
      shouldSoftDeleteFromCancelledReports({ uniqueReporterCount: 3, threshold: 3 }),
      true
    );
  });

  await t.test('returns true when uniqueReporterCount exceeds threshold', () => {
    assert.strictEqual(
      shouldSoftDeleteFromCancelledReports({ uniqueReporterCount: 4, threshold: 3 }),
      true
    );
  });

  await t.test('returns false when uniqueReporterCount is less than threshold', () => {
    assert.strictEqual(
      shouldSoftDeleteFromCancelledReports({ uniqueReporterCount: 2, threshold: 3 }),
      false
    );
  });
});
