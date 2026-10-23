import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSocialMediaAccountHandle } from './parse-account-handle.js';

test('parseSocialMediaAccountHandle falls back to splitting on "/" when the input is not a parseable URL', () => {
  assert.equal(parseSocialMediaAccountHandle('http://'), 'http:');
  assert.equal(parseSocialMediaAccountHandle('http'), 'http');
});

test('parseSocialMediaAccountHandle returns an empty handle for a URL with no path', () => {
  assert.equal(parseSocialMediaAccountHandle('https://www.instagram.com'), '');
});
