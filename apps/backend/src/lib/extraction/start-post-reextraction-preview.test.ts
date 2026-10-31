import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { manualExtractionJobs, posts, socialMediaAccountProfiles, users } from '@festgrid/database';
import type { ManualExtractionRequestPayload } from '@festgrid/domain/posts';
import { clearRegisteredAdapters, registerScraperAdapter } from '@festgrid/domain/scraper';
import type { ScrapedPost } from '@festgrid/domain/scraper';
import { startPostReextractionPreview } from './start-post-reextraction-preview.js';
import { getManualExtractionJobStatus } from './manual-extraction-job.js';

// AD-40 -- the API-Lambda half of the moderator re-extract preview. The AI Lambda invoke is not
// configured under test, so a job that gets as far as starting fails to start and is marked FAILED:
// that is exactly the path that must still blank the stored caption.

test('startPostReextractionPreview (AD-40)', async (t) => {
  const suffix = Date.now();
  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'Must have at least one seeded user');

  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-start-' + suffix, platform: 'instagram', displayName: 'Start', username: 'start_' + suffix })
    .returning();
  const postIds: string[] = [];
  const jobIds: string[] = [];

  t.after(async () => {
    if (jobIds.length) await db.delete(manualExtractionJobs).where(inArray(manualExtractionJobs.id, jobIds));
    await db.delete(manualExtractionJobs).where(eq(manualExtractionJobs.requestedByUserId, user.id));
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, account.id));
  });

  async function makePost(content: string | null) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: account.id,
        platform: 'instagram',
        postUrl: `https://www.instagram.com/p/start-${postIds.length}-${suffix}/`,
        publishedAt: new Date('2026-10-01T00:00:00Z'),
        content,
      })
      .returning();
    postIds.push(post.id);
    return post;
  }

  await t.test('unknown post id -> NOT_FOUND', async () => {
    const result = await startPostReextractionPreview(user.id, { postId: '00000000-0000-4000-8000-0000000000aa' });
    assert.deepStrictEqual(result, { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' });
  });

  await t.test('a post id that is not a uuid -> NOT_FOUND, not an internal error', async () => {
    const result = await startPostReextractionPreview(user.id, { postId: 'not-a-uuid' });
    assert.deepStrictEqual(result, { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' });
  });

  await t.test('a failed rescrape still counts against the cooldown (no unlimited retries on a post that never scrapes)', async () => {
    const post = await makePost(null);
    const first = await startPostReextractionPreview(user.id, { postId: post.id });
    assert.ok('errorCode' in first);
    assert.strictEqual(first.errorCode, 'SCRAPE_FAILED'); // no scraper adapter under test

    const second = await startPostReextractionPreview(user.id, { postId: post.id });
    assert.ok('errorCode' in second);
    assert.strictEqual(second.errorCode, 'RATE_LIMITED');

    const rows = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.sourceUrl, post.postUrl));
    for (const r of rows) jobIds.push(r.id);
    assert.strictEqual(rows.length, 1, 'one FAILED attempt row, no job started');
    assert.strictEqual((rows[0].requestPayload as ManualExtractionRequestPayload).message.content, '');
  });

  await t.test('the job status reports its mode so each query can reject the other kind of job', async () => {
    const post = await makePost('Mode caption');
    await startPostReextractionPreview(user.id, { postId: post.id }); // fails to start under test, row still created
    const [job] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.sourceUrl, post.postUrl));
    jobIds.push(job.id);
    const status = await getManualExtractionJobStatus(job.id, user.id);
    assert.strictEqual(status?.mode, 'REEXTRACT_PREVIEW');
  });

  await t.test('unsupported platform URL (not stored) -> UNSUPPORTED_PLATFORM, no job', async () => {
    const result = await startPostReextractionPreview(user.id, { url: `https://example.com/not-a-post-${suffix}` });
    assert.ok('errorCode' in result);
    assert.strictEqual(result.errorCode, 'UNSUPPORTED_PLATFORM');
  });

  await t.test('stored post with a caption: no scrape; the job is created in REEXTRACT_PREVIEW mode with the caption blanked once it ends', async () => {
    const post = await makePost('Stored caption');
    const result = await startPostReextractionPreview(user.id, { postId: post.id });
    // No AI Lambda is configured under test, so the start itself fails -- and must still blank.
    assert.ok('errorCode' in result);
    assert.strictEqual(result.errorCode, 'EXTRACTION_FAILED');

    const [job] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.sourceUrl, post.postUrl));
    assert.ok(job);
    jobIds.push(job.id);
    const payload = job.requestPayload as ManualExtractionRequestPayload;
    assert.strictEqual(payload.mode, 'REEXTRACT_PREVIEW');
    assert.strictEqual(payload.postStored, true);
    assert.strictEqual(payload.rescraped, false);
    assert.strictEqual(payload.message.content, '', 'caption blanked when the job ended');
    const [stored] = await db.select({ content: posts.content }).from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.content, 'Stored caption');
  });

  await t.test('rescrape cooldown: a recent rescrape of the same URL blocks another before any scrape', async () => {
    const post = await makePost(null);
    const [recent] = await db
      .insert(manualExtractionJobs)
      .values({
        requestedByUserId: user.id,
        sourceUrl: post.postUrl,
        requestPayload: {
          message: { postId: post.id, accountId: account.id, content: '', postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00Z' },
          mode: 'REEXTRACT_PREVIEW',
          postStored: true,
          rescraped: true,
        },
      })
      .returning();
    jobIds.push(recent.id);

    const result = await startPostReextractionPreview(user.id, { postId: post.id });
    assert.ok('errorCode' in result);
    assert.strictEqual(result.errorCode, 'RATE_LIMITED');
    assert.match(result.errorMessage, /Try again in \d+ minutes?/);
  });

  await t.test('the cooldown does not apply once it has elapsed (the scrape is attempted)', async () => {
    const post = await makePost(null);
    const [old] = await db
      .insert(manualExtractionJobs)
      .values({
        requestedByUserId: user.id,
        sourceUrl: post.postUrl,
        requestPayload: {
          message: { postId: post.id, accountId: account.id, content: '', postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00Z' },
          mode: 'REEXTRACT_PREVIEW',
          postStored: true,
          rescraped: true,
        },
      })
      .returning();
    jobIds.push(old.id);

    // "now" is 11 minutes after the earlier rescrape; the scrape then fails (no scraper credentials
    // under test), which is a SCRAPE_FAILED -- the point is that it is not RATE_LIMITED.
    const result = await startPostReextractionPreview(user.id, { postId: post.id, now: new Date(Date.now() + 11 * 60_000) });
    assert.ok('errorCode' in result);
    assert.notStrictEqual(result.errorCode, 'RATE_LIMITED');
  });

  // ── BUG-097: expired image links, rescrape for fresh slides ─────────────────────────────────
  const hexOf = (d: Date) => Math.floor(d.getTime() / 1000).toString(16);
  const expiredUrl = (n: number) => `https://cdn.example.com/s${n}.jpg?oe=${hexOf(new Date(Date.now() - 3 * 86_400_000))}`;
  const freshUrl = (n: number) => `https://cdn.example.com/fresh${n}.jpg?oe=${hexOf(new Date(Date.now() + 3 * 86_400_000))}`;

  async function makeCarouselPost(content: string | null, urls: { cover: string; slides: string[] }) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: account.id,
        platform: 'instagram',
        postUrl: `https://www.instagram.com/p/carousel-${postIds.length}-${suffix}/`,
        publishedAt: new Date('2026-10-01T00:00:00Z'),
        content,
        imageUrl: urls.cover,
        additionalImageUrls: urls.slides,
      })
      .returning();
    postIds.push(post.id);
    return post;
  }

  const fakeAdapter = (getPostByUrl: (url: string) => Promise<ScrapedPost | null>) =>
    registerScraperAdapter('instagram', { getPostByUrl } as any);

  async function payloadsFor(url: string) {
    const rows = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.sourceUrl, url));
    for (const r of rows) jobIds.push(r.id);
    return rows.map((r) => r.requestPayload as ManualExtractionRequestPayload);
  }

  await t.test('stored caption but expired image links: rescrape for fresh slides, keep the stored caption, posts untouched', async () => {
    const post = await makeCarouselPost('Stored roundup caption', { cover: expiredUrl(0), slides: [expiredUrl(1), expiredUrl(2)] });
    fakeAdapter(async () => ({
      content: 'Rescraped caption that must not replace the stored one',
      postUrl: post.postUrl,
      publishedAt: '2026-10-01T00:00:00Z',
      imageUrl: freshUrl(0),
      additionalImageUrls: [freshUrl(1), freshUrl(2), freshUrl(3)],
    }));
    let startResult;
    try {
      startResult = await startPostReextractionPreview(user.id, { postId: post.id }); // fails to start under test, row still created
    } finally {
      clearRegisteredAdapters();
    }
    assert.ok('errorCode' in startResult && startResult.errorCode === 'EXTRACTION_FAILED', 'the job was created and then failed to start (no AI Lambda under test)');
    const [payload] = await payloadsFor(post.postUrl);
    assert.strictEqual(payload.rescraped, true);
    assert.strictEqual(payload.postStored, true);
    assert.strictEqual(payload.message.imageUrl, freshUrl(0));
    assert.deepStrictEqual(payload.message.additionalImageUrls, [freshUrl(1), freshUrl(2), freshUrl(3)]);
    const [stored] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.content, 'Stored roundup caption');
    assert.strictEqual(stored.imageUrl, expiredUrl(0), 'fresh links are never written to posts');
    assert.deepStrictEqual(stored.additionalImageUrls, [expiredUrl(1), expiredUrl(2)]);
  });

  await t.test('stored caption, expired links, scrape fails: previews with the stored data, and the failed scrape counts toward the cooldown', async () => {
    const post = await makeCarouselPost('Stored caption B', { cover: expiredUrl(0), slides: [expiredUrl(1)] });
    fakeAdapter(async () => {
      throw new Error('scraper down');
    });
    try {
      await startPostReextractionPreview(user.id, { postId: post.id });
      // The recorded failure is inside the cooldown, so the second call does not scrape at all.
      let scrapes = 0;
      fakeAdapter(async () => {
        scrapes++;
        return null;
      });
      await startPostReextractionPreview(user.id, { postId: post.id });
      assert.strictEqual(scrapes, 0);
    } finally {
      clearRegisteredAdapters();
    }
    const payloads = await payloadsFor(post.postUrl);
    const started = payloads.filter((p) => p.rescraped === false);
    assert.strictEqual(started.length, 2, 'both calls fell back to a stored preview job');
    for (const p of started) assert.strictEqual(p.message.imageUrl, expiredUrl(0));
    assert.strictEqual(payloads.filter((p) => p.rescraped === true).length, 1, 'one FAILED rescrape row');
  });

  await t.test('a post with no caption is still an error when its scrape fails (images cannot stand in for a caption)', async () => {
    const post = await makeCarouselPost(null, { cover: expiredUrl(0), slides: [expiredUrl(1)] });
    fakeAdapter(async () => null);
    try {
      const result = await startPostReextractionPreview(user.id, { postId: post.id });
      assert.ok('errorCode' in result);
      assert.strictEqual(result.errorCode, 'SCRAPE_FAILED');
    } finally {
      clearRegisteredAdapters();
    }
    await payloadsFor(post.postUrl);
  });

  await t.test('no caption: the scraped cover and slides win over the stored (expired) ones', async () => {
    const post = await makeCarouselPost(null, { cover: expiredUrl(0), slides: [expiredUrl(1)] });
    fakeAdapter(async () => ({
      content: 'Scraped caption',
      postUrl: post.postUrl,
      publishedAt: '2026-10-01T00:00:00Z',
      imageUrl: freshUrl(0),
      additionalImageUrls: [freshUrl(1), freshUrl(2)],
    }));
    let startResult;
    try {
      startResult = await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    assert.ok('errorCode' in startResult && startResult.errorCode === 'EXTRACTION_FAILED', 'the job was created and then failed to start (no AI Lambda under test)');
    const [payload] = await payloadsFor(post.postUrl);
    assert.strictEqual(payload.message.imageUrl, freshUrl(0));
    assert.deepStrictEqual(payload.message.additionalImageUrls, [freshUrl(1), freshUrl(2)]);
  });

  await t.test('stored caption and still-valid image links: no rescrape (no scraper credit spent)', async () => {
    const post = await makeCarouselPost('Stored caption C', { cover: freshUrl(0), slides: [freshUrl(1)] });
    let scrapes = 0;
    fakeAdapter(async () => {
      scrapes++;
      return null;
    });
    let startResult;
    try {
      startResult = await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    assert.ok('errorCode' in startResult && startResult.errorCode === 'EXTRACTION_FAILED', 'the job was created and then failed to start (no AI Lambda under test)');
    assert.strictEqual(scrapes, 0);
    const [payload] = await payloadsFor(post.postUrl);
    assert.strictEqual(payload.rescraped, false);
  });

  await t.test('re-previewing inside the cooldown reuses the fresh links the first run found, not the dead stored ones', async () => {
    const post = await makeCarouselPost('Stored caption D', { cover: expiredUrl(0), slides: [expiredUrl(1)] });
    fakeAdapter(async () => ({
      content: 'x',
      postUrl: post.postUrl,
      publishedAt: '2026-10-01T00:00:00Z',
      imageUrl: freshUrl(0),
      additionalImageUrls: [freshUrl(1), freshUrl(2)],
    }));
    try {
      await startPostReextractionPreview(user.id, { postId: post.id });
      let scrapes = 0;
      fakeAdapter(async () => {
        scrapes++;
        return null;
      });
      await startPostReextractionPreview(user.id, { postId: post.id });
      assert.strictEqual(scrapes, 0, 'the cooldown blocked a second scrape');
    } finally {
      clearRegisteredAdapters();
    }
    const payloads = await payloadsFor(post.postUrl);
    const second = payloads.find((p) => p.rescraped === false);
    assert.ok(second, 'the second run is a stored-caption job');
    assert.strictEqual(second.message.imageUrl, freshUrl(0));
    assert.deepStrictEqual(second.message.additionalImageUrls, [freshUrl(1), freshUrl(2)]);
    const [stored] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.imageUrl, expiredUrl(0), 'still never written to posts');
  });

  await t.test('the scraper finds a cover but an empty slide list: stored slides stay, so a dead one shows as a shortfall', async () => {
    const post = await makeCarouselPost('Stored caption E', { cover: expiredUrl(0), slides: [expiredUrl(1), expiredUrl(2)] });
    fakeAdapter(async () => ({ content: 'x', postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00Z', imageUrl: freshUrl(0), additionalImageUrls: [] }));
    try {
      await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    const [payload] = await payloadsFor(post.postUrl);
    assert.strictEqual(payload.message.imageUrl, freshUrl(0));
    assert.deepStrictEqual(payload.message.additionalImageUrls, [expiredUrl(1), expiredUrl(2)]);
  });

  await t.test('inside the cooldown, a rescrape that only returned a dead link is not reused as "fresh"', async () => {
    const post = await makeCarouselPost('Stored caption F', { cover: expiredUrl(0), slides: [] });
    fakeAdapter(async () => ({ content: 'x', postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00Z', imageUrl: expiredUrl(9) }));
    try {
      await startPostReextractionPreview(user.id, { postId: post.id });
      await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    const payloads = await payloadsFor(post.postUrl);
    const second = payloads.find((p) => p.rescraped === false);
    assert.ok(second);
    assert.strictEqual(second.message.imageUrl, expiredUrl(0), 'the stored link, not the first run\'s equally dead one');
  });

  await t.test('a malformed recent job row never makes the cooldown throw', async () => {
    const post = await makeCarouselPost('Stored caption G', { cover: expiredUrl(0), slides: [] });
    await db.insert(manualExtractionJobs).values({
      requestedByUserId: user.id,
      sourceUrl: post.postUrl,
      requestPayload: { mode: 'REEXTRACT_PREVIEW', rescraped: true } as unknown as ManualExtractionRequestPayload,
    });
    let startResult;
    try {
      startResult = await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    assert.ok(startResult, 'returned instead of throwing');
    await payloadsFor(post.postUrl);
  });
});
