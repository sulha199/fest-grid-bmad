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
      description: 'Valid post',
      date_posted: '2026-08-08T00:00:00Z',
      photos: ['https://example.com/img.jpg'],
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

  await t.test('extracts hashtags, stripping leading # and lowercasing (BUG-032/FIND-024)', async () => {
    const record = {
      url: 'https://www.instagram.com/reel/DdS4MJ50EBV/',
      description: 'A big thank you to Santari, our Official Sponsor of FRCC Week 2026!',
      date_posted: '2026-09-15T04:44:18.000Z',
      photos: ['https://example.com/cover.jpg'],
      hashtags: ['#FRCC2026', '#SANTARI'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.deepStrictEqual(candidate.hashtags, ['frcc2026', 'santari']);
  });

  await t.test('omits hashtags field entirely when the raw record has none', async () => {
    const record = {
      url: 'https://www.instagram.com/p/no-hashtags/',
      description: 'No hashtags here',
      date_posted: '2026-08-08T00:00:00Z',
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.hashtags, undefined);
  });

  await t.test('returns null and persists unprocessed payload for bad date_posted type', async () => {
    const record = {
      url: 'https://www.instagram.com/p/bad-date/',
      description: 'Bad date post',
      date_posted: 1234567890,
      photos: ['https://example.com/img.jpg'],
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
      description: 'No URL post',
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
      description: '', // Fails minLength: 1 for content
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

  await t.test('extracts locationName from location_details.name when present (FIND-024)', async () => {
    const record = {
      url: 'https://www.instagram.com/p/DdV_eGuk6_Z/',
      description: 'A celebration event',
      date_posted: '2026-09-16T09:43:47.000Z',
      photos: ['https://example.com/cover.jpg'],
      location_details: {
        pk: '133922430614626',
        name: 'Sleman City Hall',
        lat: -7.7210177,
        lng: 110.3613807,
        profile_pic_url: null,
        __typename: 'XDTLocationDict',
      },
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.locationName, 'Sleman City Hall');
  });

  await t.test('omits locationName when location_details is missing entirely', async () => {
    const record = {
      url: 'https://www.instagram.com/p/no-location/',
      description: 'Post with no location',
      date_posted: '2026-08-08T00:00:00Z',
      photos: ['https://example.com/img.jpg'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.locationName, undefined);
  });

  await t.test('omits locationName when location_details has no name field (only profile_pic_url)', async () => {
    const record = {
      url: 'https://www.instagram.com/p/minimal-location/',
      description: 'Post with minimal location_details',
      date_posted: '2026-09-17T10:00:00.000Z',
      photos: ['https://example.com/img.jpg'],
      location_details: {
        profile_pic_url: null,
      },
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.locationName, undefined);
  });

  await t.test('extracts ownerUsername from user_posted field (FIND-024)', async () => {
    const record = {
      url: 'https://www.instagram.com/p/DdV_eGuk6_Z/',
      description: 'A post by someone',
      date_posted: '2026-09-16T09:43:47.000Z',
      photos: ['https://example.com/cover.jpg'],
      user_posted: 'slemancityhall',
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.ownerUsername, 'slemancityhall');
  });

  await t.test('omits ownerUsername when user_posted is missing', async () => {
    const record = {
      url: 'https://www.instagram.com/p/no-username/',
      description: 'Post with no owner',
      date_posted: '2026-08-08T00:00:00Z',
      photos: ['https://example.com/img.jpg'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.ownerUsername, undefined);
  });

  await t.test('omits ownerUsername when user_posted is not a string', async () => {
    const record = {
      url: 'https://www.instagram.com/p/bad-username-type/',
      description: 'Post with malformed username',
      date_posted: '2026-08-08T00:00:00Z',
      photos: ['https://example.com/img.jpg'],
      user_posted: 12345, // numeric instead of string
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.ownerUsername, undefined);
  });

  await t.test('includes both locationName and ownerUsername when both present (full record)', async () => {
    const record = {
      url: 'https://www.instagram.com/p/DdV_eGuk6_Z/',
      description: 'Celebrating 8th Anniversary Sleman City Hall',
      date_posted: '2026-09-16T09:43:47.000Z',
      photos: ['https://example.com/cover.jpg'],
      hashtags: ['#SlemanCityHall', '#PavilionOfJogja'],
      location_details: {
        pk: '133922430614626',
        name: 'Sleman City Hall',
        lat: -7.7210177,
        lng: 110.3613807,
        profile_pic_url: null,
        __typename: 'XDTLocationDict',
      },
      user_posted: 'slemancityhall',
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.locationName, 'Sleman City Hall');
    assert.strictEqual(candidate.ownerUsername, 'slemancityhall');
    assert.deepStrictEqual(candidate.hashtags, ['slemancityhall', 'pavilionofjogja']);
  });
});