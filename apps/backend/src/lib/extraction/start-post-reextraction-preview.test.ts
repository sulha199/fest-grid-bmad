import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, manualExtractionJobs, posts, socialMediaAccountProfiles, users } from '@festgrid/database';
import type { ManualExtractionRequestPayload } from '@festgrid/domain/posts';
import { clearRegisteredAdapters, registerScraperAdapter } from '@festgrid/domain/scraper';
import type { ScrapedPost } from '@festgrid/domain/scraper';
import { startPostReextractionPreview } from './start-post-reextraction-preview.js';
import { getManualExtractionJobStatus } from './manual-extraction-job.js';
import { claimPostUrlScrape } from '../scraper/post-url-scrape-lease.js';

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

  // ── BUG-099: expired image links, rescrape for fresh slides ─────────────────────────────────
  const hexOf = (d: Date) => Math.floor(d.getTime() / 1000).toString(16);
  // Memoized: the URL built for an assertion must equal the one stored earlier, whatever second it is.
  const urlCache = new Map<string, string>();
  const memo = (key: string, build: () => string) => urlCache.get(key) ?? (urlCache.set(key, build()), urlCache.get(key)!);
  const expiredUrl = (n: number) => memo(`e${n}`, () => `https://cdn.example.com/s${n}.jpg?oe=${hexOf(new Date(Date.now() - 3 * 86_400_000))}`);
  const freshUrl = (n: number) => memo(`f${n}`, () => `https://cdn.example.com/fresh${n}.jpg?oe=${hexOf(new Date(Date.now() + 3 * 86_400_000))}`);

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

  await t.test('the scraper finds a cover but an empty slide list: the stored slides stay in the payload, so the preview counts them and reports a shortfall', async () => {
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

  await t.test('a cover found next to dead stored slides is reused inside the cooldown (judged per link, not per row)', async () => {
    const post = await makeCarouselPost('Stored caption H', { cover: expiredUrl(0), slides: [expiredUrl(1)] });
    fakeAdapter(async () => ({ content: 'x', postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00Z', imageUrl: freshUrl(5), additionalImageUrls: [] }));
    try {
      await startPostReextractionPreview(user.id, { postId: post.id });
      await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    const payloads = await payloadsFor(post.postUrl);
    const second = payloads.find((p) => p.rescraped === false);
    assert.ok(second);
    assert.strictEqual(second.message.imageUrl, freshUrl(5), 'the fresh cover survives the dead slide beside it');
    assert.deepStrictEqual(second.message.additionalImageUrls, [expiredUrl(1)], 'the dead slide stays, so it shows as a shortfall');
  });

  await t.test('a malformed recent job row is ignored by the image reuse and still counts as a cooldown (no scrape, no throw)', async () => {
    const post = await makeCarouselPost('Stored caption G', { cover: expiredUrl(0), slides: [] });
    await db.insert(manualExtractionJobs).values({
      requestedByUserId: user.id,
      sourceUrl: post.postUrl,
      requestPayload: { mode: 'REEXTRACT_PREVIEW', rescraped: true } as unknown as ManualExtractionRequestPayload,
    });
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
    assert.strictEqual(scrapes, 0, 'the malformed row still blocked the scrape');
    assert.ok('errorCode' in startResult && startResult.errorCode === 'EXTRACTION_FAILED', 'a stored-caption job was created and failed to start under test');
    const started = (await payloadsFor(post.postUrl)).find((p) => p.mode === 'REEXTRACT_PREVIEW' && p.rescraped === false);
    assert.ok(started);
    assert.strictEqual(started.message.imageUrl, expiredUrl(0), 'nothing usable in the malformed row, so the stored link is used');
  });

  // ── AD-34 gate and FIND-110 single-flight ───────────────────────────────────────────────────
  const extraProfileIds: string[] = [];
  const extraKeyIds: string[] = [];
  t.after(async () => {
    if (extraKeyIds.length) await db.delete(apiKeys).where(inArray(apiKeys.id, extraKeyIds));
    if (extraProfileIds.length) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, extraProfileIds));
  });

  async function makePersonalPost(content: string | null) {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'acc-personal-' + suffix + extraProfileIds.length, platform: 'instagram', displayName: 'Personal', username: 'personal_' + suffix + extraProfileIds.length, accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .returning();
    extraProfileIds.push(profile.id);
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        postUrl: `https://www.instagram.com/p/personal-${postIds.length}-${suffix}/`,
        publishedAt: new Date('2026-10-01T00:00:00Z'),
        content,
        imageUrl: expiredUrl(0),
        additionalImageUrls: [expiredUrl(1)],
      })
      .returning();
    postIds.push(post.id);
    return { post, profile };
  }

  const countingAdapter = (onScrape: () => void, result: Partial<ScrapedPost> | null = null, delayMs = 0) =>
    fakeAdapter(async (url) => {
      onScrape();
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return result ? ({ content: 'c', postUrl: url, publishedAt: '2026-10-01T00:00:00Z', ...result } as ScrapedPost) : null;
    });

  await t.test('gate: a personal account\'s stored post with a caption still previews, with no scrape', async () => {
    const { post } = await makePersonalPost('Personal caption');
    let scrapes = 0;
    countingAdapter(() => scrapes++, { imageUrl: freshUrl(0) });
    let result;
    try {
      result = await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    assert.strictEqual(scrapes, 0, 'no scrape for a personal account');
    assert.ok('errorCode' in result && result.errorCode === 'EXTRACTION_FAILED', 'a stored-caption job started (and failed to invoke under test)');
    const [payload] = await payloadsFor(post.postUrl);
    assert.strictEqual(payload.rescraped, false);
    assert.strictEqual(payload.message.imageUrl, expiredUrl(0));
  });

  await t.test('gate: a personal account\'s stored post with no caption is refused with ACCOUNT_NOT_SCRAPABLE, no scrape, no job', async () => {
    const { post } = await makePersonalPost(null);
    let scrapes = 0;
    countingAdapter(() => scrapes++, { imageUrl: freshUrl(0) });
    let result;
    try {
      result = await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    assert.ok('errorCode' in result && result.errorCode === 'ACCOUNT_NOT_SCRAPABLE');
    assert.strictEqual(scrapes, 0);
    assert.strictEqual((await payloadsFor(post.postUrl)).length, 0, 'no job and no failed-scrape row');
  });

  await t.test('gate: an unknown URL whose scraped owner is a known personal account is refused after the scrape, no job, and it counts toward the cooldown', async () => {
    const [key] = await db.insert(apiKeys).values({ userId: user.id, provider: 'gemini', keyEncrypted: 'mock-encrypted-key', keyLast4: '1234', isValid: true, invalidAttempts: 0 }).returning();
    extraKeyIds.push(key.id);
    const ownerHandle = 'owner_personal_' + suffix;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'acc-' + ownerHandle, platform: 'instagram', displayName: 'Owner', username: ownerHandle, accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .returning();
    extraProfileIds.push(profile.id);
    const url = `https://www.instagram.com/p/unknown-personal-${suffix}/`;
    let scrapes = 0;
    countingAdapter(() => scrapes++, { imageUrl: freshUrl(0), ownerUsername: ownerHandle });
    let first, second;
    try {
      first = await startPostReextractionPreview(user.id, { url });
      second = await startPostReextractionPreview(user.id, { url });
    } finally {
      clearRegisteredAdapters();
    }
    assert.ok('errorCode' in first && first.errorCode === 'ACCOUNT_NOT_SCRAPABLE');
    assert.strictEqual(scrapes, 1, 'scraped once; the refusal was recorded against the cooldown');
    assert.ok('errorCode' in second && second.errorCode === 'ACCOUNT_NOT_SCRAPABLE', 'the cooldown repeats the real reason, not "rescraped recently"');
    const rows = await payloadsFor(url);
    assert.strictEqual(rows.length, 1, 'only the recorded failed-scrape row, no preview job');
    assert.strictEqual(rows[0].message.content, '');
  });

  await t.test('single-flight: while another request holds the scrape lease, a stored-caption post previews without scraping', async () => {
    const post = await makeCarouselPost('Stored caption H2', { cover: expiredUrl(0), slides: [expiredUrl(1)] });
    const lease = await claimPostUrlScrape(post.postUrl);
    assert.ok(lease);
    let scrapes = 0;
    countingAdapter(() => scrapes++, { imageUrl: freshUrl(0) });
    let result;
    try {
      result = await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
      await lease.release();
    }
    assert.strictEqual(scrapes, 0);
    assert.ok('errorCode' in result && result.errorCode === 'EXTRACTION_FAILED');
    const [payload] = await payloadsFor(post.postUrl);
    assert.strictEqual(payload.rescraped, false);
    assert.strictEqual(payload.message.imageUrl, expiredUrl(0), 'no fresh links exist while the first scrape is still running: stored data, and the preview reports the shortfall');
  });

  await t.test('single-flight: while another request holds the lease, a post with no caption gets SCRAPE_IN_PROGRESS and nothing is scraped', async () => {
    const post = await makeCarouselPost(null, { cover: expiredUrl(0), slides: [] });
    const lease = await claimPostUrlScrape(post.postUrl);
    assert.ok(lease);
    let scrapes = 0;
    countingAdapter(() => scrapes++, { imageUrl: freshUrl(0) });
    let result;
    try {
      result = await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
      await lease.release();
    }
    assert.ok('errorCode' in result && result.errorCode === 'SCRAPE_IN_PROGRESS');
    assert.strictEqual(scrapes, 0);
    assert.strictEqual((await payloadsFor(post.postUrl)).length, 0);
  });

  await t.test('single-flight: two simultaneous previews of one stale post scrape exactly once', async () => {
    const post = await makeCarouselPost('Stored caption I', { cover: expiredUrl(0), slides: [expiredUrl(1)] });
    let scrapes = 0;
    countingAdapter(() => scrapes++, { imageUrl: freshUrl(0), additionalImageUrls: [freshUrl(1)] }, 300);
    try {
      await Promise.all([
        startPostReextractionPreview(user.id, { postId: post.id }),
        startPostReextractionPreview(user.id, { postId: post.id }),
      ]);
    } finally {
      clearRegisteredAdapters();
    }
    assert.strictEqual(scrapes, 1, 'the second request reused the first instead of scraping');
    const payloads = await payloadsFor(post.postUrl);
    assert.strictEqual(payloads.length, 2, 'both requests still produced a preview job');
    const rescraped = payloads.filter((p) => p.rescraped === true);
    const stored = payloads.filter((p) => p.rescraped === false);
    assert.strictEqual(rescraped.length, 1, 'exactly one request did the scrape');
    assert.strictEqual(rescraped[0].message.imageUrl, freshUrl(0));
    assert.strictEqual(stored.length, 1, 'the other previewed on stored data (the first run had not finished, so its links did not exist yet)');
    assert.strictEqual(stored[0].message.imageUrl, expiredUrl(0));
  });

  await t.test('single-flight: the lease is released after a scrape that throws, so the URL is not stuck', async () => {
    const post = await makeCarouselPost(null, { cover: expiredUrl(0), slides: [] });
    fakeAdapter(async () => {
      throw new Error('boom');
    });
    try {
      await startPostReextractionPreview(user.id, { postId: post.id });
    } finally {
      clearRegisteredAdapters();
    }
    const lease = await claimPostUrlScrape(post.postUrl);
    assert.ok(lease, 'claimable again right after the failure');
    await lease.release();
  });
});
