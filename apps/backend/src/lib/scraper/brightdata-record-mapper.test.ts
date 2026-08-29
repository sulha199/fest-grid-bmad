import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { unprocessedScraperPayloads } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { mapBrightDataRecordToScrapedPost } from './brightdata-record-mapper.js';

test('brightdata-record-mapper tests', async (t) => {
  t.beforeEach(async () => {
    await db.delete(unprocessedScraperPayloads);
  });

  t.afterEach(async () => {
    await db.delete(unprocessedScraperPayloads);
  });

  await t.test('returns mapped candidate for valid record', async () => {
    const record = {
      url: 'https://www.instagram.com/p/valid/',
      caption: 'Valid post',
      date_posted: '2026-08-08T00:00:00Z',
      image_url: 'https://example.com/img.jpg',
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.postUrl, 'https://www.instagram.com/p/valid/');
    assert.strictEqual(candidate.content, 'Valid post');
    assert.strictEqual(candidate.imageUrl, 'https://example.com/img.jpg');
    assert.strictEqual(candidate.publishedAt, '2026-08-08T00:00:00.000Z');

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    assert.strictEqual(unprocessed.length, 0);
  });

  await t.test('returns null and persists unprocessed payload for bad date_posted type', async () => {
    const record = {
      url: 'https://www.instagram.com/p/bad-date/',
      caption: 'Bad date post',
      date_posted: 1234567890,
      image_url: 'https://example.com/img.jpg',
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.strictEqual(candidate, null);

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    
    assert.strictEqual(unprocessed.length, 1);
    const payloadContext = unprocessed[0].context as any;
    assert.strictEqual(payloadContext.postUrl, 'https://www.instagram.com/p/bad-date/');
    assert.strictEqual(payloadContext.parserVersion, '3.4g');
  });

  await t.test('returns null and skips unprocessed payload for missing URL', async () => {
    const record = {
      caption: 'No URL post',
      date_posted: '2026-08-08T00:00:00Z',
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.strictEqual(candidate, null);

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    assert.strictEqual(unprocessed.length, 0);
  });

  await t.test('returns null and persists unprocessed payload for failed AJV validation', async () => {
    const record = {
      url: 'https://www.instagram.com/p/invalid/',
      caption: '', // Fails minLength: 1 for content
      date_posted: '2026-08-08T00:00:00Z',
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.strictEqual(candidate, null);

    const unprocessed = await db.select().from(unprocessedScraperPayloads);
    
    assert.strictEqual(unprocessed.length, 1);
    const payloadContext = unprocessed[0].context as any;
    assert.strictEqual(payloadContext.postUrl, 'https://www.instagram.com/p/invalid/');
  });
});