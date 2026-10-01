import test from 'node:test';
import assert from 'node:assert/strict';
import { needsMigration } from './lib/ai-processor/post-media-migration.js';

// Pure-logic tests for the row-classification helper that both `runSizing` and
// `runBackfill` depend on to decide "does this row need migration" -- the one piece that
// is fully unit-testable without a live database/S3 connection (this sandbox has neither;
// see this story's Dev Notes "Sandbox constraint acknowledged"). The full `runSizing`/
// `runBackfill` integration paths (DB row fetch, S3 GetObjectCommand, the
// migrate/skip/dry-run branches end-to-end) must be exercised against a real dev-stage
// database + S3 bucket by the dev-story implementation pass per the story's own Task 6
// acknowledgment -- not re-derived here with a mocked `db` import, since `./db/client.ts`
// is a module-level singleton (same constraint `rehost-post-image.test.ts` already lives
// with) that throws at import time without a real `DATABASE_URL`.

const CDN_DOMAIN = 'cdn.test.com';

test('needsMigration - row with no durableImageUrl does not need migration', () => {
  assert.equal(needsMigration({ id: 'p1', durableImageUrl: null }, CDN_DOMAIN), false);
});

test('needsMigration - row already on a versioned key does not need migration', () => {
  assert.equal(
    needsMigration({ id: 'p1', durableImageUrl: `https://${CDN_DOMAIN}/posts/p1/full-abcdef12.jpg` }, CDN_DOMAIN),
    false
  );
});

test('needsMigration - row on the legacy flat key needs migration', () => {
  assert.equal(needsMigration({ id: 'p1', durableImageUrl: `https://${CDN_DOMAIN}/posts/p1` }, CDN_DOMAIN), true);
});

test('needsMigration - row whose URL does not match our CDN domain is left alone', () => {
  assert.equal(needsMigration({ id: 'p1', durableImageUrl: 'https://other-cdn.example.com/posts/p1' }, CDN_DOMAIN), false);
});
