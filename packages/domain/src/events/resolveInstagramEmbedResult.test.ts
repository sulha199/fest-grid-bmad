import test from 'node:test';
import * as assert from 'node:assert';
import { resolveInstagramEmbedResult } from './resolveInstagramEmbedResult.js';

test('resolveInstagramEmbedResult', async (t) => {
  await t.test('(a) adapter AVAILABLE -> AVAILABLE with html, durableImageUrl null', () => {
    assert.deepStrictEqual(
      resolveInstagramEmbedResult({
        adapterResult: { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>' },
        isImageStorageOptedIn: false,
        durableImageUrl: null,
      }),
      { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>', durableImageUrl: null }
    );
  });

  await t.test('(b) adapter UNAVAILABLE + opted-in + durableImageUrl present -> fallback shape', () => {
    assert.deepStrictEqual(
      resolveInstagramEmbedResult({
        adapterResult: { status: 'UNAVAILABLE' },
        isImageStorageOptedIn: true,
        durableImageUrl: 'https://cdn.example.com/durable.jpg',
      }),
      { status: 'UNAVAILABLE', html: null, durableImageUrl: 'https://cdn.example.com/durable.jpg' }
    );
  });

  await t.test('(c) adapter UNAVAILABLE + opted-in + durableImageUrl absent -> unavailable, no fallback', () => {
    assert.deepStrictEqual(
      resolveInstagramEmbedResult({
        adapterResult: { status: 'UNAVAILABLE' },
        isImageStorageOptedIn: true,
        durableImageUrl: null,
      }),
      { status: 'UNAVAILABLE', html: null, durableImageUrl: null }
    );
  });

  await t.test('(d) adapter UNAVAILABLE + not opted-in -> unavailable, no fallback (even if durableImageUrl present)', () => {
    assert.deepStrictEqual(
      resolveInstagramEmbedResult({
        adapterResult: { status: 'UNAVAILABLE' },
        isImageStorageOptedIn: false,
        durableImageUrl: 'https://cdn.example.com/durable.jpg',
      }),
      { status: 'UNAVAILABLE', html: null, durableImageUrl: null }
    );
  });

  await t.test('(e) adapterResult null -> null (no post URL to resolve)', () => {
    assert.strictEqual(
      resolveInstagramEmbedResult({
        adapterResult: null,
        isImageStorageOptedIn: true,
        durableImageUrl: 'https://cdn.example.com/durable.jpg',
      }),
      null
    );
  });
});
