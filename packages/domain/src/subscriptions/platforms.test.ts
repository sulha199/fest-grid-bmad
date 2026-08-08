import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_PLATFORMS } from './platforms.js';

test('SUPPORTED_PLATFORMS', () => {
  assert.ok(SUPPORTED_PLATFORMS.length > 0, 'platform list is non-empty');
  for (const platform of SUPPORTED_PLATFORMS) {
    assert.equal(platform, platform.toLowerCase(), 'platforms are lowercase');
  }
});
