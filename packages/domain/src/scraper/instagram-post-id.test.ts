import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIGHT_DATA_MAX_EXCLUDED_POSTS,
  buildBrightDataPostsToNotInclude,
  instagramShortcodeToMediaId,
} from './instagram-post-id.js';

test('instagramShortcodeToMediaId decodes base 64 with the A-Za-z0-9-_ alphabet', () => {
  assert.equal(instagramShortcodeToMediaId('A'), 0n);
  assert.equal(instagramShortcodeToMediaId('B'), 1n);
  assert.equal(instagramShortcodeToMediaId('_'), 63n);
  assert.equal(instagramShortcodeToMediaId('-'), 62n);
  assert.equal(instagramShortcodeToMediaId('BA'), 64n);
});

test('instagramShortcodeToMediaId keeps precision above 2^53 and rejects values over 64 bits', () => {
  assert.equal(instagramShortcodeToMediaId('DAAAAAAAAAA'), 3n * 64n ** 10n);
  assert.ok(3n * 64n ** 10n > BigInt(Number.MAX_SAFE_INTEGER));
  // The low digits survive: 15 * 2^60 + 1 is not representable as a double.
  assert.equal(instagramShortcodeToMediaId('PAAAAAAAAAB'), 15n * 64n ** 10n + 1n);
  assert.equal(instagramShortcodeToMediaId('___________'), null); // 2^66 - 1 does not fit in 64 bits
});

test('instagramShortcodeToMediaId returns null for anything that is not a shortcode', () => {
  assert.equal(instagramShortcodeToMediaId(''), null);
  assert.equal(instagramShortcodeToMediaId(null), null);
  assert.equal(instagramShortcodeToMediaId(undefined), null);
  assert.equal(instagramShortcodeToMediaId('ab cd'), null);
  assert.equal(instagramShortcodeToMediaId('abc/'), null);
});

test('buildBrightDataPostsToNotInclude sends decimal strings, newest first, without repeats or bad codes', () => {
  const list = buildBrightDataPostsToNotInclude(['DAAAAAAAAAA', null, 'bad code', 'B', 'B', undefined, 'A']);
  assert.deepEqual(list, [(3n * 64n ** 10n).toString(), '1', '0']);
});

test('buildBrightDataPostsToNotInclude caps the list and keeps the newest', () => {
  const codes = Array.from({ length: BRIGHT_DATA_MAX_EXCLUDED_POSTS + 5 }, (_, i) => 'B' + 'A'.repeat(2) + String.fromCharCode(65 + (i % 26)) + String(Math.floor(i / 26)));
  const list = buildBrightDataPostsToNotInclude(codes);
  assert.equal(list.length, BRIGHT_DATA_MAX_EXCLUDED_POSTS);
  assert.equal(list[0], instagramShortcodeToMediaId(codes[0])!.toString());
  assert.equal(buildBrightDataPostsToNotInclude(['B', 'C', 'D'], 2).length, 2);
});
