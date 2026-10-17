import test from 'node:test';
import * as assert from 'node:assert';
import { isThumbnailStillRelevant } from './isThumbnailStillRelevant.js';

test('isThumbnailStillRelevant', async (t) => {
  const expiry = new Date('2026-11-01T00:00:00Z');

  await t.test('null expiry fails open (relevant)', () => {
    assert.strictEqual(isThumbnailStillRelevant(null, new Date('2026-10-01T00:00:00Z')), true);
  });

  await t.test('null schedule end fails open (relevant)', () => {
    assert.strictEqual(isThumbnailStillRelevant(expiry, null), true);
  });

  await t.test('both null fails open (relevant)', () => {
    assert.strictEqual(isThumbnailStillRelevant(null, null), true);
  });

  await t.test('event ends after the image expires -> relevant', () => {
    assert.strictEqual(isThumbnailStillRelevant(expiry, new Date('2026-11-02T00:00:00Z')), true);
  });

  await t.test('event ends before the image expires -> not relevant', () => {
    assert.strictEqual(isThumbnailStillRelevant(expiry, new Date('2026-10-31T00:00:00Z')), false);
  });

  await t.test('event ends exactly at expiry -> not relevant (strictly-after rule)', () => {
    assert.strictEqual(isThumbnailStillRelevant(expiry, new Date('2026-11-01T00:00:00Z')), false);
  });
});
