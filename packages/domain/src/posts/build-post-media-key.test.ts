import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPostMediaKey,
  resolvePostMediaExtension,
  isVersionedPostMediaKey,
  extractPostMediaKeyFromUrl,
} from './build-post-media-key.js';

test('buildPostMediaKey - full variant produces the expected key', () => {
  assert.equal(buildPostMediaKey('post-1', 'full', 'abcdef12', 'jpg'), 'posts/post-1/full-abcdef12.jpg');
  assert.equal(buildPostMediaKey('post-1', 'full', 'abcdef12', 'png'), 'posts/post-1/full-abcdef12.png');
});

test('buildPostMediaKey - thumb variant produces the expected key', () => {
  assert.equal(buildPostMediaKey('post-1', 'thumb', 'abcdef12', 'png'), 'posts/post-1/thumb-abcdef12.jpg');
});

test('buildPostMediaKey - thumb variant ignores its ext argument and always yields .jpg', () => {
  assert.equal(buildPostMediaKey('post-1', 'thumb', '00000000', 'webp'), 'posts/post-1/thumb-00000000.jpg');
});

test('buildPostMediaKey - invalid hash8 (wrong length) throws', () => {
  assert.throws(() => buildPostMediaKey('post-1', 'full', 'abc', 'jpg'), /hash8 must be exactly 8 lowercase hex characters/);
});

test('buildPostMediaKey - invalid hash8 (uppercase/non-hex) throws', () => {
  assert.throws(() => buildPostMediaKey('post-1', 'full', 'ABCDEF12', 'jpg'), /hash8 must be exactly 8 lowercase hex characters/);
  assert.throws(() => buildPostMediaKey('post-1', 'full', 'zzzzzzzz', 'jpg'), /hash8 must be exactly 8 lowercase hex characters/);
});

test('resolvePostMediaExtension - mapped content types', () => {
  assert.equal(resolvePostMediaExtension('image/jpeg'), 'jpg');
  assert.equal(resolvePostMediaExtension('image/png'), 'png');
  assert.equal(resolvePostMediaExtension('image/webp'), 'webp');
});

test('resolvePostMediaExtension - unmapped content type defaults to jpg', () => {
  assert.equal(resolvePostMediaExtension('image/gif'), 'jpg');
});

test('resolvePostMediaExtension - undefined or null defaults to jpg', () => {
  assert.equal(resolvePostMediaExtension(undefined), 'jpg');
  assert.equal(resolvePostMediaExtension(null), 'jpg');
});

test('isVersionedPostMediaKey - versioned keys (both variants) return true', () => {
  assert.equal(isVersionedPostMediaKey('posts/post-1/full-abcdef12.jpg'), true);
  assert.equal(isVersionedPostMediaKey('posts/post-1/thumb-abcdef12.jpg'), true);
});

test('isVersionedPostMediaKey - old flat key and unrelated string return false', () => {
  assert.equal(isVersionedPostMediaKey('posts/post-1'), false);
  assert.equal(isVersionedPostMediaKey('not-a-key-at-all'), false);
});

test('extractPostMediaKeyFromUrl - matching CDN domain prefix returns the stripped key', () => {
  assert.equal(
    extractPostMediaKeyFromUrl('cdn.example.com', 'https://cdn.example.com/posts/post-1/full-abcdef12.jpg'),
    'posts/post-1/full-abcdef12.jpg'
  );
});

test('extractPostMediaKeyFromUrl - non-matching URL returns null', () => {
  assert.equal(extractPostMediaKeyFromUrl('cdn.example.com', 'https://other.example.com/posts/post-1'), null);
});

test('extractPostMediaKeyFromUrl - null or undefined input returns null', () => {
  assert.equal(extractPostMediaKeyFromUrl('cdn.example.com', null), null);
  assert.equal(extractPostMediaKeyFromUrl('cdn.example.com', undefined), null);
});
