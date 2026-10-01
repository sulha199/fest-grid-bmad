import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlatformPostIdentity } from './parse-platform-post-identity.js';

test('parsePlatformPostIdentity - /p/{id}', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'https://instagram.com/p/abc123' });
  assert.deepEqual(result, { platformPostId: 'abc123', platformPostType: 'p' });
});

test('parsePlatformPostIdentity - /reel/{id}', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'https://instagram.com/reel/abc123' });
  assert.deepEqual(result, { platformPostId: 'abc123', platformPostType: 'reel' });
});

test('parsePlatformPostIdentity - /reels/{id} (not normalized to "reel")', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'https://instagram.com/reels/abc123' });
  assert.deepEqual(result, { platformPostId: 'abc123', platformPostType: 'reels' });
});

test('parsePlatformPostIdentity - trailing slash', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'https://instagram.com/p/abc123/' });
  assert.deepEqual(result, { platformPostId: 'abc123', platformPostType: 'p' });
});

test('parsePlatformPostIdentity - query string', () => {
  const result = parsePlatformPostIdentity({
    postUrl: 'https://instagram.com/p/abc123?utm_source=ig_web_copy_link',
  });
  assert.deepEqual(result, { platformPostId: 'abc123', platformPostType: 'p' });
});

test('parsePlatformPostIdentity - originalPostUrl present and parseable is used, postUrl ignored', () => {
  const result = parsePlatformPostIdentity({
    postUrl: 'https://proxy1.com/reel/should_be_ignored',
    originalPostUrl: 'https://instagram.com/p/canonical_id',
  });
  assert.deepEqual(result, { platformPostId: 'canonical_id', platformPostType: 'p' });
});

test('parsePlatformPostIdentity - originalPostUrl present but unparseable falls back to postUrl', () => {
  const result = parsePlatformPostIdentity({
    postUrl: 'https://instagram.com/p/fallback_id',
    originalPostUrl: 'not-a-valid-url',
  });
  assert.deepEqual(result, { platformPostId: 'fallback_id', platformPostType: 'p' });
});

test('parsePlatformPostIdentity - originalPostUrl present but shape-non-matching falls back to postUrl', () => {
  const result = parsePlatformPostIdentity({
    postUrl: 'https://instagram.com/p/fallback_id2',
    originalPostUrl: 'https://instagram.com/some_profile',
  });
  assert.deepEqual(result, { platformPostId: 'fallback_id2', platformPostType: 'p' });
});

test('parsePlatformPostIdentity - both absent returns null/null', () => {
  const result = parsePlatformPostIdentity({});
  assert.deepEqual(result, { platformPostId: null, platformPostType: null });
});

test('parsePlatformPostIdentity - both null/undefined returns null/null', () => {
  const result = parsePlatformPostIdentity({ postUrl: null, originalPostUrl: undefined });
  assert.deepEqual(result, { platformPostId: null, platformPostType: null });
});

test('parsePlatformPostIdentity - non-Instagram-shaped URL (bare profile, no /p//reel//reels/ segment)', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'https://instagram.com/someaccount' });
  assert.deepEqual(result, { platformPostId: null, platformPostType: null });
});

test('parsePlatformPostIdentity - non-Instagram domain (twitter.com)', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'https://twitter.com/someaccount/status/12345' });
  assert.deepEqual(result, { platformPostId: null, platformPostType: null });
});

test('parsePlatformPostIdentity - malformed URL string', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'not-a-valid-url' });
  assert.deepEqual(result, { platformPostId: null, platformPostType: null });
});

test('parsePlatformPostIdentity - proxy domain mirroring Instagram path shape is still matched (shape-based, not hostname-based)', () => {
  const result = parsePlatformPostIdentity({ postUrl: 'https://proxy1.com/p/first_scraper_123' });
  assert.deepEqual(result, { platformPostId: 'first_scraper_123', platformPostType: 'p' });
});
