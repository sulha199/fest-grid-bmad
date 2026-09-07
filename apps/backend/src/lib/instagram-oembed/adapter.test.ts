import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstagramOEmbed } from './adapter.js';
import { db } from '../../db/client.js';
import { instagramOembedCache } from '@festgrid/database';
import { eq } from 'drizzle-orm';

test('instagram-oembed adapter resolveInstagramOEmbed', async (t) => {
  await db.delete(instagramOembedCache);

  const fetchMock = mock.method(globalThis, 'fetch', async (): Promise<{ ok: boolean; json: () => Promise<any> }> => ({
    ok: true,
    json: async () => ({ html: '<blockquote>embed</blockquote>' }),
  }));

  t.afterEach(async () => {
    fetchMock.mock.resetCalls();
    fetchMock.mock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ html: '<blockquote>embed</blockquote>' }),
    }));
    await db.delete(instagramOembedCache);
  });

  t.after(() => {
    mock.restoreAll();
  });

  await t.test('happy path: 2xx with html -> AVAILABLE, calls the tokenless oembed endpoint', async () => {
    const postUrl = 'https://www.instagram.com/p/happy-path/';

    const result = await resolveInstagramOEmbed(postUrl);

    assert.deepEqual(result, { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>' });
    assert.equal(fetchMock.mock.calls.length, 1);
    const calledUrl = fetchMock.mock.calls[0].arguments[0] as string;
    assert.match(calledUrl, /^https:\/\/graph\.facebook\.com\/v25\.0\/instagram_oembed\?url=/);
    assert.ok(calledUrl.includes(encodeURIComponent(postUrl)));
    assert.ok(!calledUrl.includes('access_token'));
  });

  await t.test('non-2xx response -> UNAVAILABLE, not thrown', async () => {
    fetchMock.mock.mockImplementation(async () => ({
      ok: false,
      json: async () => ({}),
    }));

    const result = await resolveInstagramOEmbed('https://www.instagram.com/p/non-2xx/');
    assert.deepEqual(result, { status: 'UNAVAILABLE' });
  });

  await t.test('malformed JSON (missing html) -> UNAVAILABLE', async () => {
    fetchMock.mock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ some_other_field: true }),
    }));

    const result = await resolveInstagramOEmbed('https://www.instagram.com/p/malformed/');
    assert.deepEqual(result, { status: 'UNAVAILABLE' });
  });

  await t.test('empty html string -> UNAVAILABLE', async () => {
    fetchMock.mock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ html: '' }),
    }));

    const result = await resolveInstagramOEmbed('https://www.instagram.com/p/empty-html/');
    assert.deepEqual(result, { status: 'UNAVAILABLE' });
  });

  await t.test('thrown fetch error -> UNAVAILABLE, not thrown', async () => {
    fetchMock.mock.mockImplementation(async () => {
      throw new Error('network error');
    });

    const result = await resolveInstagramOEmbed('https://www.instagram.com/p/thrown-error/');
    assert.deepEqual(result, { status: 'UNAVAILABLE' });
  });

  await t.test('cache hit skips fetch', async () => {
    const postUrl = 'https://www.instagram.com/p/cache-hit/';
    fetchMock.mock.resetCalls();

    const first = await resolveInstagramOEmbed(postUrl);
    assert.deepEqual(first, { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>' });
    assert.equal(fetchMock.mock.calls.length, 1);

    const second = await resolveInstagramOEmbed(postUrl);
    assert.deepEqual(second, { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>' });
    assert.equal(fetchMock.mock.calls.length, 1); // still 1: served from cache
  });

  await t.test('expired cache row triggers a fresh fetch', async () => {
    const postUrl = 'https://www.instagram.com/p/expired-cache/';

    // Manually seed an already-expired row
    await db.insert(instagramOembedCache).values({
      postUrl,
      status: 'AVAILABLE',
      html: '<blockquote>stale</blockquote>',
      expiresAt: new Date(Date.now() - 1000),
    });

    fetchMock.mock.resetCalls();
    const result = await resolveInstagramOEmbed(postUrl);

    assert.deepEqual(result, { status: 'AVAILABLE', html: '<blockquote>embed</blockquote>' });
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  await t.test('both AVAILABLE and UNAVAILABLE results are written to the cache table', async () => {
    const availableUrl = 'https://www.instagram.com/p/write-through-available/';
    const unavailableUrl = 'https://www.instagram.com/p/write-through-unavailable/';

    fetchMock.mock.mockImplementation((async (input: unknown) => {
      const url = input as string;
      if (url.includes(encodeURIComponent(unavailableUrl))) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ html: '<blockquote>embed</blockquote>' }) };
    }) as typeof fetch);

    await resolveInstagramOEmbed(availableUrl);
    await resolveInstagramOEmbed(unavailableUrl);

    const availableRows = await db.select().from(instagramOembedCache).where(eq(instagramOembedCache.postUrl, availableUrl));
    assert.equal(availableRows.length, 1);
    assert.equal(availableRows[0].status, 'AVAILABLE');
    assert.equal(availableRows[0].html, '<blockquote>embed</blockquote>');

    const unavailableRows = await db.select().from(instagramOembedCache).where(eq(instagramOembedCache.postUrl, unavailableUrl));
    assert.equal(unavailableRows.length, 1);
    assert.equal(unavailableRows[0].status, 'UNAVAILABLE');
    assert.equal(unavailableRows[0].html, null);
  });
});
