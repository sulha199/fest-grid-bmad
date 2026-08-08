import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSocialMediaAccountHandle } from './parse-account-handle.js';

test('parseSocialMediaAccountHandle tests', async (t) => {
  await t.test('handles bare handle', () => {
    assert.equal(parseSocialMediaAccountHandle('my_handle'), 'my_handle');
  });

  await t.test('handles handle with @ prefix', () => {
    assert.equal(parseSocialMediaAccountHandle('@my_handle'), 'my_handle');
  });

  await t.test('handles https URL without trailing slash', () => {
    assert.equal(parseSocialMediaAccountHandle('https://instagram.com/my_handle'), 'my_handle');
  });

  await t.test('handles https URL with trailing slash', () => {
    assert.equal(parseSocialMediaAccountHandle('https://twitter.com/my_handle/'), 'my_handle');
  });

  await t.test('handles leading and trailing whitespace', () => {
    assert.equal(parseSocialMediaAccountHandle('   @my_handle   '), 'my_handle');
  });

  await t.test('handles invalid URL path', () => {
    assert.equal(parseSocialMediaAccountHandle('https://instagram.com'), '');
  });
});
