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

  await t.test('extracts additionalImageUrls from photos[1:] for a multi-photo carousel record (FIND-024)', async () => {
    const record = {
      url: 'https://www.instagram.com/p/carousel/',
      description: 'A carousel post',
      date_posted: '2026-09-18T00:00:00Z',
      content_type: 'Carousel',
      photos: [
        'https://example.com/cover.jpg',
        'https://example.com/slide2.jpg',
        'https://example.com/slide3.jpg',
      ],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.imageUrl, 'https://example.com/cover.jpg');
    assert.deepStrictEqual(candidate.additionalImageUrls, [
      'https://example.com/slide2.jpg',
      'https://example.com/slide3.jpg',
    ]);
  });

  await t.test('omits additionalImageUrls for a single-photo (non-carousel) record', async () => {
    const record = {
      url: 'https://www.instagram.com/p/single-photo/',
      description: 'A single-photo post',
      date_posted: '2026-09-18T00:00:00Z',
      photos: ['https://example.com/only.jpg'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.additionalImageUrls, undefined);
  });

  await t.test('omits additionalImageUrls when photos is absent (e.g. a Reel)', async () => {
    const record = {
      url: 'https://www.instagram.com/reel/no-photos/',
      description: 'A reel with no photos array',
      date_posted: '2026-09-18T00:00:00Z',
      videos: ['https://example.com/video.mp4'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.additionalImageUrls, undefined);
  });

  await t.test('drops non-string entries from photos[1:] defensively when extracting additionalImageUrls', async () => {
    const record = {
      url: 'https://www.instagram.com/p/malformed-carousel/',
      description: 'A carousel post with a malformed slide entry',
      date_posted: '2026-09-18T00:00:00Z',
      photos: ['https://example.com/cover.jpg', 12345, 'https://example.com/slide3.jpg'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.deepStrictEqual(candidate.additionalImageUrls, ['https://example.com/slide3.jpg']);
  });

  await t.test('extracts additionalImageUrls purely from photos.length, independent of content_type (no content_type field on this record)', async () => {
    // Proves the extraction is not secretly gated on `content_type` -- deliberately omits that
    // field so a future reader can't "fix" the mapper to require it without this test failing.
    const record = {
      url: 'https://www.instagram.com/p/carousel-no-content-type/',
      description: 'A carousel post with no content_type field at all',
      date_posted: '2026-09-18T00:00:00Z',
      photos: ['https://example.com/cover.jpg', 'https://example.com/slide2.jpg'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.deepStrictEqual(candidate.additionalImageUrls, ['https://example.com/slide2.jpg']);
  });

  await t.test('extracts all 18 slides for a large carousel (matches the largest real photos_number observed in fixtures)', async () => {
    const slideUrls = Array.from({ length: 18 }, (_, i) => `https://example.com/slide${i}.jpg`);
    const record = {
      url: 'https://www.instagram.com/p/large-carousel/',
      description: 'An 18-photo carousel post',
      date_posted: '2026-09-18T00:00:00Z',
      content_type: 'Carousel',
      photos: slideUrls,
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.imageUrl, slideUrls[0]);
    assert.deepStrictEqual(candidate.additionalImageUrls, slideUrls.slice(1));
    assert.strictEqual(candidate.additionalImageUrls!.length, 17);
  });

  await t.test('does not dedupe a repeated URL across photos -- imageUrl and additionalImageUrls[0] may be identical (documented, not a bug)', async () => {
    const record = {
      url: 'https://www.instagram.com/p/duplicate-photo/',
      description: 'A carousel post where Bright Data repeats a slide URL',
      date_posted: '2026-09-18T00:00:00Z',
      photos: ['https://example.com/a.jpg', 'https://example.com/a.jpg', 'https://example.com/b.jpg'],
    };

    const candidate = await mapBrightDataRecordToScrapedPost(record);

    assert.ok(candidate);
    assert.strictEqual(candidate.imageUrl, 'https://example.com/a.jpg');
    assert.deepStrictEqual(candidate.additionalImageUrls, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  await t.test('includes hashtags, locationName, ownerUsername, and additionalImageUrls together on one record (all four conditional-spread fields at once)', async () => {
    const record = {
      url: 'https://www.instagram.com/p/all-fields-carousel/',
      description: 'Celebrating with everything at once',
      date_posted: '2026-09-16T09:43:47.000Z',
      content_type: 'Carousel',
      photos: ['https://example.com/cover.jpg', 'https://example.com/slide2.jpg'],
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
    assert.deepStrictEqual(candidate.additionalImageUrls, ['https://example.com/slide2.jpg']);
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