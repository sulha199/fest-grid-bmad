import { test } from 'node:test';
import assert from 'node:assert';
import { computeClaimCutoff, isClaimExpired } from './claim-ttl.js';

test('computeClaimCutoff - subtracts ttlMinutes from now', () => {
  const now = new Date('2026-01-01T00:30:00.000Z');
  const cutoff = computeClaimCutoff(30, now);
  assert.strictEqual(cutoff.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('isClaimExpired - a claim just inside the TTL is not expired', () => {
  const now = new Date('2026-01-01T00:30:00.000Z');
  // Claimed 29 minutes ago -- 1 minute inside a 30-minute TTL.
  const queuedForExtractionAt = '2026-01-01T00:01:00.000Z';
  assert.strictEqual(isClaimExpired(queuedForExtractionAt, 30, now), false);
});

test('isClaimExpired - a claim past the TTL is expired', () => {
  const now = new Date('2026-01-01T00:30:00.000Z');
  // Claimed 31 minutes ago -- 1 minute past a 30-minute TTL.
  const queuedForExtractionAt = '2025-12-31T23:59:00.000Z';
  assert.strictEqual(isClaimExpired(queuedForExtractionAt, 30, now), true);
});

test('isClaimExpired - exact boundary (claimed exactly ttlMinutes ago) is NOT expired, mirroring the `< cutoff` SQL predicate in enqueue-post-for-processing.ts', () => {
  const now = new Date('2026-01-01T00:30:00.000Z');
  // Claimed exactly 30 minutes ago -- exactly at the cutoff, which does not count as "older than".
  const queuedForExtractionAt = '2026-01-01T00:00:00.000Z';
  assert.strictEqual(isClaimExpired(queuedForExtractionAt, 30, now), false);
});
