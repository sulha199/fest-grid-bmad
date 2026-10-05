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
        isImageStorageOptedIn: true,
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
        isImageStorageOptedIn: true,
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
        isImageStorageOptedIn: true,
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
        isImageStorageOptedIn: true,
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
        isImageStorageOptedIn: true,
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
        isImageStorageOptedIn: true,
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
        isImageStorageOptedIn: true,
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
        isImageStorageOptedIn: true,
        now,
      }),
      'durable-url'
    );
  });

  await t.test('(i) expired original + durable present + NOT opted in -> null', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: pastExpiry,
        isImageStorageOptedIn: false,
        now,
      }),
      null
    );
  });

  await t.test('(j) imageUrlExpiresAt is null + durable present + NOT opted in -> null', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: null,
        isImageStorageOptedIn: false,
        now,
      }),
      null
    );
  });

  await t.test('(k) valid original + durable present + NOT opted in -> serves original anyway', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        imageUrlExpiresAt: futureExpiry,
        isImageStorageOptedIn: false,
        now,
      }),
      'original-url'
    );
  });

  await t.test('(l) imageUrl is null + durable null + NOT opted in -> null', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: null,
        durableImageUrl: null,
        imageUrlExpiresAt: futureExpiry,
        isImageStorageOptedIn: false,
        now,
      }),
      null
    );
  });

  await t.test('(m) NOT opted-in + expired original + thumbnail present -> serves thumbnail (was null pre-3.6n2)', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        durableThumbnailUrl: 'thumbnail-url',
        imageUrlExpiresAt: pastExpiry,
        isImageStorageOptedIn: false,
        now,
      }),
      'thumbnail-url'
    );
  });

  await t.test('(n) NOT opted-in + expired original + thumbnail null -> null (unchanged)', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        durableThumbnailUrl: null,
        imageUrlExpiresAt: pastExpiry,
        isImageStorageOptedIn: false,
        now,
      }),
      null
    );
  });

  await t.test('(o) NOT opted-in + no expiry + thumbnail present -> serves thumbnail', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        durableThumbnailUrl: 'thumbnail-url',
        imageUrlExpiresAt: null,
        isImageStorageOptedIn: false,
        now,
      }),
      'thumbnail-url'
    );
  });

  await t.test('(p) NOT opted-in + no expiry + thumbnail null -> null', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        durableThumbnailUrl: null,
        imageUrlExpiresAt: null,
        isImageStorageOptedIn: false,
        now,
      }),
      null
    );
  });

  await t.test('(q) NOT opted-in + original still valid + thumbnail present -> original wins (thumbnail never overrides a valid original)', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        durableThumbnailUrl: 'thumbnail-url',
        imageUrlExpiresAt: futureExpiry,
        isImageStorageOptedIn: false,
        now,
      }),
      'original-url'
    );
  });

  await t.test('(r) opted-in + expired + durableImageUrl present + thumbnail also present -> durableImageUrl wins, thumbnail never consulted', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: 'durable-url',
        durableThumbnailUrl: 'thumbnail-url',
        imageUrlExpiresAt: pastExpiry,
        isImageStorageOptedIn: true,
        now,
      }),
      'durable-url'
    );
  });

  await t.test('(s) opted-in + durableImageUrl null + thumbnail present -> falls through to bare imageUrl, not thumbnail (thumbnail is gated on NOT opted-in, not merely on durableImageUrl absence)', () => {
    assert.strictEqual(
      resolveServedImageUrl({
        imageUrl: 'original-url',
        durableImageUrl: null,
        durableThumbnailUrl: 'thumbnail-url',
        imageUrlExpiresAt: pastExpiry,
        isImageStorageOptedIn: true,
        now,
      }),
      'original-url'
    );
  });
});
