import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImageUrlExpiry } from './parse-image-url-expiry.js';

test('parseImageUrlExpiry - valid hex-Unix-timestamp', () => {
  const url = 'https://instagram.fsgn2-6.fna.fbcdn.net/v/t51.2885-15/abc.jpg?oe=64F373FF';
  const result = parseImageUrlExpiry(url);
  assert.ok(result instanceof Date);
  // 0x64F373FF is 1693676543
  assert.equal(result.getTime(), 1693676543000);
});

test('parseImageUrlExpiry - valid hex-Unix-timestamp with custom parameter name', () => {
  const url = 'https://example.com/img.jpg?expires=64F373FF';
  const result = parseImageUrlExpiry(url, 'expires');
  assert.ok(result instanceof Date);
  assert.equal(result.getTime(), 1693676543000);
});

test('parseImageUrlExpiry - missing parameter name', () => {
  const url = 'https://example.com/img.jpg?foo=bar';
  const result = parseImageUrlExpiry(url);
  assert.equal(result, null);
});

test('parseImageUrlExpiry - non-hex parameter value', () => {
  const url = 'https://example.com/img.jpg?oe=64F373FG'; // G is not hex
  const result = parseImageUrlExpiry(url);
  assert.equal(result, null);
});

test('parseImageUrlExpiry - malformed URL', () => {
  const url = 'not-a-valid-url';
  const result = parseImageUrlExpiry(url);
  assert.equal(result, null);
});

test('parseImageUrlExpiry - null or undefined input', () => {
  assert.equal(parseImageUrlExpiry(null), null);
  assert.equal(parseImageUrlExpiry(undefined), null);
});
