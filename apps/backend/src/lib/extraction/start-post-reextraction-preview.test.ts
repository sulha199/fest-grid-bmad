import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { manualExtractionJobs, posts, socialMediaAccountProfiles, users } from '@festgrid/database';
import type { ManualExtractionRequestPayload } from '@festgrid/domain/posts';
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
});
