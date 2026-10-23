import test from 'node:test';
import assert from 'node:assert/strict';
import { clearRegisteredAdapters, isAdapterRegistered, registerScraperAdapter } from './adapter-registry.js';
import type { ScraperAdapter } from './types.js';

test('isAdapterRegistered reports whether an adapter was registered for a platform', () => {
  clearRegisteredAdapters();
  assert.equal(isAdapterRegistered('instagram'), false);

  registerScraperAdapter('instagram', {} as ScraperAdapter);
  assert.equal(isAdapterRegistered('instagram'), true);
  assert.equal(isAdapterRegistered('not-a-platform'), false);

  clearRegisteredAdapters();
  assert.equal(isAdapterRegistered('instagram'), false);
});
