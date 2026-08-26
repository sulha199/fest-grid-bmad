import test from 'node:test';
import * as assert from 'node:assert';
import { resolveServedImageUrl } from './resolveServedImageUrl.js';

test('resolveServedImageUrl', async (t) => {
  const now = new Date('2026-08-27T12:00:00Z');
  const futureExpiry = new Date('2026-08-27T13:00:00Z');
  const pastExpiry = new Date('2026-08-27T11:00:00Z');

  await t.test('(a) valid original + durable present -> serves original', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: futureExpiry,
        now,
      }),
      'original-url'
    );
  });

  await t.test('(b) expired original + durable present -> serves durable', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: pastExpiry,
        now,
      }),
      'durable-url'
    );
  });

  await t.test('(c) expired original + durable null -> serves original anyway', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        imageUrlExpiresAt: pastExpiry,
        now,
      }),
      'original-url'
    );
  });

  await t.test('(d) imageUrlExpiresAt is null + durable present -> serves durable', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: null,
        now,
      }),
      'durable-url'
    );
  });

  await t.test('(e) imageUrlExpiresAt is null + durable null -> serves original anyway', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        imageUrlExpiresAt: null,
        now,
      }),
      'original-url'
    );
  });

  await t.test('(f) imageUrl is null + durable null -> returns null', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: null,
        durableImageUrl: null,
        imageUrlExpiresAt: futureExpiry,
        now,
      }),
      null
    );
  });

  await t.test('(g) imageUrl is null + durable present -> returns durable, does not throw', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: null,
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: futureExpiry,
        now,
      }),
      'durable-url'
    );
  });

  await t.test('(h) now exactly equal to imageUrlExpiresAt -> treated as expired', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: now,
        now,
      }),
      'durable-url'
    );
  });
});
