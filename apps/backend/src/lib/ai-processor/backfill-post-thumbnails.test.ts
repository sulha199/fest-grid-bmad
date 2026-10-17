import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { events, posts, schedules, socialMediaAccountProfiles } from '@festgrid/database';
import { loadBackendEnv } from '../../env.js';
import { runThumbnailBackfill, selectThumbnailBackfillCandidates, type FetchImage } from './backfill-post-thumbnails.js';
import { detectAndBlurFacesSeam, setDetectAndBlurFacesSeam } from './detect-and-blur-faces.js';
import { uploadFaceBlurThumbnailSeam, setUploadFaceBlurThumbnailSeam } from './upload-face-blur-thumbnail.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

test('thumbnail backfill (runThumbnailBackfill / selectThumbnailBackfillCandidates)', async (t) => {
  const now = new Date();
  const env = { ...loadBackendEnv(), postMediaBucketName: 'test-bucket', postMediaCdnDomain: 'cdn.test.com' };
  const stamp = Date.now();

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: `test_acc_thumbfill_${stamp}`, platform: 'instagram', username: 'test.thumbfill', displayName: 'Test Thumbfill' })
    .returning();

  const ownPostIds: string[] = [];
  const originalDetect = detectAndBlurFacesSeam;
  const originalUpload = uploadFaceBlurThumbnailSeam;
  // Registered before any post/event insert so a failed setup can never leak rows.
  t.after(async () => {
    setDetectAndBlurFacesSeam(originalDetect);
    setUploadFaceBlurThumbnailSeam(originalUpload);
    if (ownPostIds.length > 0) {
      // events.postId is ON DELETE SET NULL, so remove the events first; schedules cascade.
      await db.delete(events).where(inArray(events.postId, ownPostIds));
      await db.delete(posts).where(inArray(posts.id, ownPostIds));
    }
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  async function makePost(
    label: string,
    opts: { expiresInDays: number; eventEndsInDays: number; thumbnail?: string; eventDeleted?: boolean }
  ) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        postUrl: `https://instagram.com/p/test_thumbfill_${label}_${stamp}`,
        publishedAt: now,
        imageUrl: `https://img.test/${label}.jpg`,
        imageUrlExpiresAt: new Date(now.getTime() + opts.expiresInDays * DAY_MS),
        durableThumbnailUrl: opts.thumbnail ?? null,
      })
      .returning();
    ownPostIds.push(post.id);
    const [event] = await db
      .insert(events)
      .values({
        eventName: `Thumbfill ${label}`,
        location: 'Jakarta',
        postId: post.id,
        extractionOrdinal: 0,
        deletedAt: opts.eventDeleted ? now : null,
      })
      .returning();
    await db.insert(schedules).values({
      eventId: event.id,
      eventStartDate: isoDate(new Date(now.getTime() + opts.eventEndsInDays * DAY_MS)),
    });
    return post.id;
  }

  const eligible = await makePost('eligible', { expiresInDays: 3, eventEndsInDays: 10 });
  const expired = await makePost('expired', { expiresInDays: -1, eventEndsInDays: 10 });
  await makePost('has_thumb', { expiresInDays: 3, eventEndsInDays: 10, thumbnail: 'https://cdn.test.com/posts/x/thumb-aaaaaaaa.jpg' });
  const gated = await makePost('gated', { expiresInDays: 5, eventEndsInDays: 2 });
  const noLiveEvent = await makePost('no_live_event', { expiresInDays: 3, eventEndsInDays: 10, eventDeleted: true });

  let fetched: string[] = [];
  let uploaded: string[] = [];
  const okFetch: FetchImage = async (url) => {
    fetched.push(url);
    return { bytes: Buffer.from('image-bytes'), contentType: 'image/jpeg' };
  };
  function installSeams(opts: { blurThrows?: boolean; uploadReturnsNull?: boolean } = {}) {
    fetched = [];
    uploaded = [];
    setDetectAndBlurFacesSeam(async (bytes) => {
      if (opts.blurThrows) throw new Error('detection exploded');
      return { buffer: Buffer.concat([bytes, Buffer.from('-blurred')]), faceCount: 2 };
    });
    setUploadFaceBlurThumbnailSeam(async (postId) => {
      uploaded.push(postId);
      if (opts.uploadReturnsNull) return null;
      const url = `https://cdn.test.com/posts/${postId}/thumb-deadbeef.jpg`;
      await db.update(posts).set({ durableThumbnailUrl: url }).where(eq(posts.id, postId));
      return url;
    });
  }

  await t.test('candidate selection: only no-thumbnail, unexpired, live-event posts, with their latest schedule end', async () => {
    const candidates = await selectThumbnailBackfillCandidates(now, ownPostIds);
    assert.deepStrictEqual(candidates.map((c) => c.postId).sort(), [eligible, gated].sort());
    const eligibleCandidate = candidates.find((c) => c.postId === eligible)!;
    assert.ok(eligibleCandidate.latestScheduleEnd, 'expected a computed schedule end');
    assert.strictEqual(eligibleCandidate.imageUrl, 'https://img.test/eligible.jpg');
  });

  await t.test('dry run: reports the plan, fetches/uploads/writes nothing', async () => {
    installSeams();
    const result = await runThumbnailBackfill(env, { apply: false, postIds: ownPostIds, now, fetchImage: okFetch });
    assert.deepStrictEqual(result, { candidates: 2, gated: 1, built: 0, failed: 0, pending: 1 });
    assert.deepStrictEqual(fetched, []);
    assert.deepStrictEqual(uploaded, []);
    const [row] = await db.select().from(posts).where(eq(posts.id, eligible));
    assert.strictEqual(row.durableThumbnailUrl, null);
  });

  await t.test('apply: builds the eligible post only (not expired / already-has-thumbnail / gated / no live event)', async () => {
    installSeams();
    const result = await runThumbnailBackfill(env, { apply: true, postIds: ownPostIds, now, fetchImage: okFetch });
    assert.deepStrictEqual(result, { candidates: 2, gated: 1, built: 1, failed: 0, pending: 0 });
    assert.deepStrictEqual(fetched, ['https://img.test/eligible.jpg']);
    assert.deepStrictEqual(uploaded, [eligible]);
    const [row] = await db.select().from(posts).where(eq(posts.id, eligible));
    assert.ok(row.durableThumbnailUrl);
    for (const untouched of [expired, gated, noLiveEvent]) {
      const [other] = await db.select().from(posts).where(eq(posts.id, untouched));
      assert.strictEqual(other.durableThumbnailUrl, null, 'post must stay without a thumbnail');
    }
  });

  await t.test('idempotent: a second apply run finds nothing left to build', async () => {
    installSeams();
    const result = await runThumbnailBackfill(env, { apply: true, postIds: ownPostIds, now, fetchImage: okFetch });
    assert.deepStrictEqual(result, { candidates: 1, gated: 1, built: 0, failed: 0, pending: 0 });
    assert.deepStrictEqual(uploaded, []);
  });

  await t.test('fail closed: a detection failure uploads nothing and counts as failed', async () => {
    await db.update(posts).set({ durableThumbnailUrl: null }).where(eq(posts.id, eligible));
    installSeams({ blurThrows: true });
    const result = await runThumbnailBackfill(env, { apply: true, postIds: [eligible], now, fetchImage: okFetch });
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.built, 0);
    assert.deepStrictEqual(uploaded, [], 'the unblurred image must never be uploaded');
  });

  await t.test('an image fetch failure counts as failed and does not stop the run', async () => {
    installSeams();
    const failingFetch: FetchImage = async () => {
      throw new Error('Failed to fetch image: Status 403');
    };
    const result = await runThumbnailBackfill(env, { apply: true, postIds: [eligible], now, fetchImage: failingFetch });
    assert.strictEqual(result.failed, 1);
    assert.deepStrictEqual(uploaded, []);
  });

  await t.test('an upload that returns null (S3/CDN failure) counts as failed', async () => {
    installSeams({ uploadReturnsNull: true });
    const result = await runThumbnailBackfill(env, { apply: true, postIds: [eligible], now, fetchImage: okFetch });
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.built, 0);
    const [row] = await db.select().from(posts).where(eq(posts.id, eligible));
    assert.strictEqual(row.durableThumbnailUrl, null);
  });

  await t.test('limit: only the first N relevant posts are processed, the rest are reported as not processed', async () => {
    installSeams();
    const result = await runThumbnailBackfill(env, { apply: true, postIds: ownPostIds, limit: 0, now, fetchImage: okFetch });
    assert.deepStrictEqual(result, { candidates: 2, gated: 1, built: 0, failed: 0, pending: 1 });
    assert.deepStrictEqual(uploaded, []);
  });

  await t.test('apply without bucket/CDN configuration refuses to run', async () => {
    await assert.rejects(
      runThumbnailBackfill({ ...env, postMediaBucketName: undefined }, { apply: true, postIds: ownPostIds, now, fetchImage: okFetch }),
      /not configured/
    );
  });
});
