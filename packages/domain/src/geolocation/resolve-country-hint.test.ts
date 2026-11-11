import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCountryHint } from './resolve-country-hint.js';

test('a string code wins and is trusted', () => {
  assert.deepEqual(resolveCountryHint({ stringCountryCode: 'us', platformDefault: 'ID' }), { code: 'US', source: 'string' });
});

test('without a usable string code the platform default is used as a guess', () => {
  assert.deepEqual(resolveCountryHint({ platformDefault: 'id' }), { code: 'ID', source: 'platform' });
  assert.deepEqual(resolveCountryHint({ stringCountryCode: 'not a code', platformDefault: 'PH' }), { code: 'PH', source: 'platform' });
  assert.deepEqual(resolveCountryHint({ stringCountryCode: null, platformDefault: 'PH' }), { code: 'PH', source: 'platform' });
});

test('placeholder codes do not count; UK is read as GB', () => {
  assert.deepEqual(resolveCountryHint({ stringCountryCode: 'XX', platformDefault: 'ID' }), { code: 'ID', source: 'platform' });
  assert.deepEqual(resolveCountryHint({ stringCountryCode: 'UK' }), { code: 'GB', source: 'string' });
});

test('no code and no platform default means no hint', () => {
  assert.deepEqual(resolveCountryHint({}), { source: 'none' });
  assert.deepEqual(resolveCountryHint({ platformDefault: null }), { source: 'none' });
  assert.deepEqual(resolveCountryHint({ platformDefault: '' }), { source: 'none' });
});
