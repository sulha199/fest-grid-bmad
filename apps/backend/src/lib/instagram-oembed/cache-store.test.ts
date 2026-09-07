import test from 'node:test';
import assert from 'node:assert/strict';
import { getCachedEmbed, setCachedEmbed } from './cache-store.js';
import { db } from '../../db/client.js';
import { instagramOembedCache } from '@festgrid/database';
import { eq } from 'drizzle-orm';

test('instagram-oembed cache-store', async (t) => {
  const postUrl = 'https://www.instagram.com/p/test-cache-store-123/';

  // Clean up any existing data first
  await db.delete(instagramOembedCache).where(eq(instagramOembedCache.postUrl, postUrl));

  await t.test('getCachedEmbed returns null on miss', async () => {
    const result = await getCachedEmbed(postUrl);
    assert.equal(result, null);
  });

  await t.test('setCachedEmbed and getCachedEmbed round-trip an AVAILABLE result', async () => {
    await setCachedEmbed(postUrl, { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>' }, 60_000);

    const result = await getCachedEmbed(postUrl);
    assert.deepEqual(result, { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>' });
  });

  await t.test('setCachedEmbed updates on conflict (no duplicate row)', async () => {
    await setCachedEmbed(postUrl, { status: 'UNAVAILABLE' }, 60_000);

    const result = await getCachedEmbed(postUrl);
    assert.deepEqual(result, { status: 'UNAVAILABLE' });

    const rows = await db.select().from(instagramOembedCache).where(eq(instagramOembedCache.postUrl, postUrl));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].html, null);
  });

  await t.test('getCachedEmbed treats an expired row as a miss', async () => {
    await setCachedEmbed(postUrl, { status: 'AVAILABLE', html: '<blockquote>stale</blockquote>' }, -1_000);

    const result = await getCachedEmbed(postUrl);
    assert.equal(result, null);
  });

  // Cleanup after tests
  await db.delete(instagramOembedCache).where(eq(instagramOembedCache.postUrl, postUrl));
});
