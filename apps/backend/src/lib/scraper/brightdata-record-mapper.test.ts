import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { unprocessedScraperPayloads } from '@festgrid/database';
import { or, sql } from 'drizzle-orm';
import { mapBrightDataRecordToScrapedPost } from './brightdata-record-mapper.js';

// This file's own test postUrls only -- do NOT wipe the whole table, other test files
// running in the same suite (once the pnpm test glob bug is fixed) rely on their own
// unprocessedScraperPayloads rows surviving. `context` is jsonb but the driver
// double-encodes it on write (see deferred-work.md) -- match both shapes defensively,
// matching the pattern already used in scraper-actor-run-linking.test.ts.
const TEST_POST_URLS = [
  'https://www.instagram.com/p/bad-date/',
  'https://www.instagram.com/p/invalid/',
];

function cleanupCondition() {
  return or(
    ...TEST_POST_URLS.flatMap((url) => [
      sql`context->>'postUrl' = ${url}`,
      sql`(("context"#>>'{}')::jsonb)->>'postUrl' = ${url}`,
    ])
  );
}

test('brightdata-record-mapper tests', async (t) => {
  t.beforeEach(async () => {
    await db.delete(unprocessedScraperPayloads).where(cleanupCondition());
  });

  t.afterEach(async () => {
    await db.delete(unprocessedScraperPayloads).where(cleanupCondition());
  });

  await t.test('returns mapped candidate for valid record', async () => {
    const record = {
      url: 'https://www.instagram.com/p/valid/',
      caption: 'Valid post',
      date_posted: '2026-08-08T00:00:00Z',
      image_url: 'https://example.com/img.jpg',
    };

    const countStart = (await db.select().from(unprocessedScraperPayloads)).length;

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.postUrl, 'https://www.instagram.com/p/valid/');
    assert.strictEqual(candidate.content, 'Valid post');
    assert.strictEqual(candidate.imageUrl, 'https://example.com/img.jpg');
    assert.strictEqual(candidate.publishedAt, '2026-08-08T00:00:00.000Z');

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    assert.strictEqual(unprocessed.length - countStart, 0);
  });

  await t.test('returns null and persists unprocessed payload for bad date_posted type', async () => {
    const record = {
      url: 'https://www.instagram.com/p/bad-date/',
      caption: 'Bad date post',
      date_posted: 1234567890,
      image_url: 'https://example.com/img.jpg',
    };

    const countStart = (await db.select().from(unprocessedScraperPayloads)).length;

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.strictEqual(candidate, null);

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    
    assert.strictEqual(unprocessed.length - countStart, 1);
    const newPayload = unprocessed.find(p => (p.context as any)?.postUrl === 'https://www.instagram.com/p/bad-date/');
    assert.ok(newPayload);
    const payloadContext = newPayload.context as any;
    assert.strictEqual(payloadContext.postUrl, 'https://www.instagram.com/p/bad-date/');
    assert.strictEqual(payloadContext.parserVersion, '3.4g');
  });

  await t.test('returns null and skips unprocessed payload for missing URL', async () => {
    const record = {
      caption: 'No URL post',
      date_posted: '2026-08-08T00:00:00Z',
    };

    const countStart = (await db.select().from(unprocessedScraperPayloads)).length;

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.strictEqual(candidate, null);

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    assert.strictEqual(unprocessed.length - countStart, 0);
  });

  await t.test('returns null and persists unprocessed payload for failed AJV validation', async () => {
    const record = {
      url: 'https://www.instagram.com/p/invalid/',
      caption: '', // Fails minLength: 1 for content
      date_posted: '2026-08-08T00:00:00Z',
    };

    const countStart = (await db.select().from(unprocessedScraperPayloads)).length;

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.strictEqual(candidate, null);

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    
    assert.strictEqual(unprocessed.length - countStart, 1);
    const newPayload = unprocessed.find(p => (p.context as any)?.postUrl === 'https://www.instagram.com/p/invalid/');
    assert.ok(newPayload);
    const payloadContext = newPayload.context as any;
    assert.strictEqual(payloadContext.postUrl, 'https://www.instagram.com/p/invalid/');
  });
});