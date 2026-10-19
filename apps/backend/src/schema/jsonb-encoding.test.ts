import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../db/client.js';
import { persistUnprocessedPayload } from '../lib/posts/persist-unprocessed-payload.js';
import { sql } from 'drizzle-orm';
import { events, geolocationCache, posts, schedules, socialMediaAccountProfiles, unprocessedScraperPayloads } from '@festgrid/database';
import { resolvers } from './resolvers.js';
import crypto from 'node:crypto';

test('jsonb double-encoding fix', async (t) => {
  await t.test('freshly inserted row is correctly single-encoded', async () => {
    const payload = { source: 'TEST_SOURCE', parserVersion: '1.0', data: { foo: 'bar' } };
    const context = { accountId: 'test-account', source: 'TEST_SOURCE', parserVersion: '1.0' };
    
    const result = await persistUnprocessedPayload({
      rawPayload: payload,
      context: context as any,
      validationError: { message: 'test error' },
      isUnprocessable: true
    } as any);
    
    const rawQuery = sql`SELECT id, context::text as ctx_text, raw_payload::text as raw_text, validation_error::text as val_text FROM unprocessed_scraper_payloads WHERE id = ${result.id}`;
    
    const rows = await db.execute(rawQuery);
    const row = rows[0] as any;
    
    // They should not have extra quotes around them (i.e. starts with '{' instead of '"')
    assert.ok(row.ctx_text.startsWith('{'), `context should not be stringified twice: ${row.ctx_text}`);
    assert.ok(row.raw_text.startsWith('{'), `raw_payload should not be stringified twice: ${row.raw_text}`);
    assert.ok(row.val_text.startsWith('{'), `validation_error should not be stringified twice: ${row.val_text}`);

    // clean up
    await db.delete(unprocessedScraperPayloads).where(sql`id = ${result.id}`);
  });

  await t.test('queryUnprocessedPayloads matches both OLD and NEW encoding shapes', async () => {
    // 1. insert old double-encoded row bypassing Drizzle (via string)
    const oldId = crypto.randomUUID();
    const oldContextStr = JSON.stringify({ accountId: 'old-acc', source: 'test_old', parserVersion: '2.0' });
    await db.execute(sql`INSERT INTO unprocessed_scraper_payloads (id, raw_payload, validation_error, context) VALUES (${oldId}, ${oldContextStr}, ${oldContextStr}, ${oldContextStr})`);

    // 2. insert new single-encoded row
    const newId = crypto.randomUUID();
    const newContext = { accountId: 'new-acc', source: 'test_old', parserVersion: '2.0' };
    // with customJsonb, passing the object single-encodes it. To make sure, we just use standard Drizzle insert
    await db.insert(unprocessedScraperPayloads).values({
      id: newId,
      rawPayload: newContext,
      validationError: newContext,
      context: newContext
    });

    // Query via resolvers
    const res: any = await (resolvers.Query as any).queryUnprocessedPayloads(
      null, 
      { filters: { source: 'test_old', parserVersion: '2.0' }, first: 10 }, 
      { user: { role: 'moderator' } }, 
      null
    );

    const nodes = res.edges.map((e: any) => e.node);
    assert.ok(nodes.find((n: any) => n.id === oldId), 'should match OLD double-encoded row');
    assert.ok(nodes.find((n: any) => n.id === newId), 'should match NEW single-encoded row');

    // clean up
    await db.delete(unprocessedScraperPayloads).where(sql`id IN (${oldId}, ${newId})`);
  });
});

// BUG-068 -- the 27 columns that used to be declared with drizzle's own jsonb() are now customJsonb. Written through Drizzle they must be stored as a
// jsonb OBJECT or ARRAY, not as a jsonb string holding JSON text: only then do SQL-side ->>, @> and jsonb_array_elements see them. One column of each
// shape that matters (object, array of objects, array of strings), plus a legacy double-encoded row, which Drizzle must keep reading parsed.
test('BUG-068: plain jsonb columns are single-encoded and a legacy string row still reads parsed', async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const locationDetails = { coordinates: { latitude: -7.78, longitude: 110.4 }, city: 'Yogyakarta', adminArea: 'Special Region of Yogyakarta' };
  const links = [{ url: 'https://example.com/tickets', label: 'Tickets' }];
  const images = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
  const ids: { profile?: string; post?: string; event?: string; schedule?: string; cache?: string } = {};
  try {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `bug068-${suffix}`, platform: 'instagram', username: `bug068_${suffix}`, displayName: 'BUG-068', defaultLocation: locationDetails,
    }).returning({ id: socialMediaAccountProfiles.id });
    ids.profile = profile.id;
    const [post] = await db.insert(posts).values({
      accountId: profile.id, platform: 'instagram', postUrl: `https://example.com/p/bug068-${suffix}`, publishedAt: new Date(), additionalImageUrls: images,
    }).returning({ id: posts.id });
    ids.post = post.id;
    const [event] = await db.insert(events).values({ slug: `bug068-${suffix}`, eventName: 'BUG-068', location: 'Hall', links }).returning({ id: events.id });
    ids.event = event.id;
    const [schedule] = await db.insert(schedules).values({ slug: `bug068-s-${suffix}`, eventId: event.id, eventStartDate: '2026-12-01', locationDetails }).returning({ id: schedules.id });
    ids.schedule = schedule.id;
    const [cache] = await db.insert(geolocationCache).values({ cacheKey: `bug068-${suffix}`, queryType: 'GEOCODE', result: { formattedAddress: 'Sleman City Hall', coordinates: locationDetails.coordinates } }).returning({ id: geolocationCache.id });
    ids.cache = cache.id;

    const [row] = (await db.execute(sql`SELECT
        (SELECT jsonb_typeof(location_details) FROM schedules WHERE id = ${schedule.id}) AS schedule_location,
        (SELECT location_details->>'adminArea' FROM schedules WHERE id = ${schedule.id}) AS schedule_admin_area,
        (SELECT jsonb_typeof(links) FROM events WHERE id = ${event.id}) AS event_links,
        (SELECT links->0->>'url' FROM events WHERE id = ${event.id}) AS event_first_link,
        (SELECT jsonb_typeof(default_location) FROM social_media_account_profiles WHERE id = ${profile.id}) AS profile_default_location,
        (SELECT jsonb_typeof(result) FROM geolocation_cache WHERE id = ${cache.id}) AS cache_result,
        (SELECT jsonb_typeof(additional_image_urls) FROM posts WHERE id = ${post.id}) AS post_images,
        (SELECT jsonb_array_length(additional_image_urls) FROM posts WHERE id = ${post.id}) AS post_images_length`)) as unknown as Array<Record<string, unknown>>;
    assert.strictEqual(row.schedule_location, 'object', 'schedules.location_details must be a jsonb object');
    assert.strictEqual(row.schedule_admin_area, 'Special Region of Yogyakarta', 'SQL-side ->> must see inside schedules.location_details');
    assert.strictEqual(row.event_links, 'array', 'events.links must be a jsonb array');
    assert.strictEqual(row.event_first_link, 'https://example.com/tickets', 'SQL-side ->0->>url must see inside events.links');
    assert.strictEqual(row.profile_default_location, 'object', 'social_media_account_profiles.default_location must be a jsonb object');
    assert.strictEqual(row.cache_result, 'object', 'geolocation_cache.result must be a jsonb object');
    assert.strictEqual(row.post_images, 'array', 'posts.additional_image_urls must be a jsonb array');
    assert.strictEqual(Number(row.post_images_length), 2, 'jsonb_array_elements must work on posts.additional_image_urls');

    // a row written the old way (a jsonb string holding JSON text) is still read parsed through Drizzle
    await db.execute(sql`UPDATE schedules SET location_details = to_jsonb(${JSON.stringify(locationDetails)}::text) WHERE id = ${schedule.id}`);
    const [legacy] = await db.select({ locationDetails: schedules.locationDetails }).from(schedules).where(sql`${schedules.id} = ${schedule.id}`);
    assert.deepStrictEqual(legacy.locationDetails, locationDetails, 'a legacy double-encoded row must still read as the object');
  } finally {
    if (ids.cache) await db.delete(geolocationCache).where(sql`id = ${ids.cache}`);
    if (ids.schedule) await db.delete(schedules).where(sql`id = ${ids.schedule}`);
    if (ids.event) await db.delete(events).where(sql`id = ${ids.event}`);
    if (ids.post) await db.delete(posts).where(sql`id = ${ids.post}`);
    if (ids.profile) await db.delete(socialMediaAccountProfiles).where(sql`id = ${ids.profile}`);
  }
});
