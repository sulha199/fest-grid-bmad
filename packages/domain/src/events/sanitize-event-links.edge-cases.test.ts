import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedHttpUrl } from './sanitize-event-links.js';

test('isAllowedHttpUrl accepts only well-formed http(s) URLs', () => {
  assert.equal(isAllowedHttpUrl('https://example.com/tickets'), true);
  assert.equal(isAllowedHttpUrl('http://example.com'), true);
  assert.equal(isAllowedHttpUrl('ftp://example.com/file'), false);
  assert.equal(isAllowedHttpUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedHttpUrl('not a url'), false);
});

test('isAllowedHttpUrl rejects empty, null and undefined input', () => {
  assert.equal(isAllowedHttpUrl(''), false);
  assert.equal(isAllowedHttpUrl(null), false);
  assert.equal(isAllowedHttpUrl(undefined), false);
});
