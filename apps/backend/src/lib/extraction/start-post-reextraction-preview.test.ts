import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, jobs, posts, socialMediaAccountProfiles } from '@festgrid/database';
import { REEXTRACT_POST_JOB_TYPE, reextractUrlInputKey } from '@festgrid/domain/jobs';
import { startPostReextractionPreview } from './start-post-reextraction-preview.js';
import { createFixtures } from '../job-engine/job-engine-test-support.js';

// AD-40 / Story 10.6 -- the API-Lambda half of the moderator re-extract preview: it validates and finds the target, then starts the engine job
// `reextract-post` for EVERY re-extract (a stored post with or without a stored caption, a URL not in the database). The job itself (the
// refresh, the held caption, the preview) is tested in reextract-refresh-handler.test.ts, reextract-preview-handler.test.ts and
// reextract-engine-flow.test.ts; the stuck-job rule in start-reextract-post-job.test.ts. No Lambda is invoked: the engine's invoke is a stub.

const fx = createFixtures('startpreview');

test('startPostReextractionPreview (AD-40, Story 10.6)', async (t) => {
  const suffix = Date.now();
  fx.stubInvoke();
  const moderator = await fx.makeUser('moderator');
  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-start-' + suffix, platform: 'instagram', displayName: 'Start', username: 'start_' + suffix })
    .returning();
  const postIds: string[] = [];
  const keyIds: string[] = [];

  t.after(async () => {
    if (keyIds.length) await db.delete(apiKeys).where(inArray(apiKeys.id, keyIds));
    await fx.cleanup(); // the users, and with them their jobs
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, account.id));
  });

  async function makePost(content: string | null) {
    const [post] = await db
      .insert(posts)
      .values({ accountId: account.id, platform: 'instagram', postUrl: `https://www.instagram.com/p/start-${postIds.length}-${suffix}/`, publishedAt: new Date('2026-10-01T00:00:00Z'), content })
      .returning();
    postIds.push(post.id);
    return post;
  }
  const jobsFor = async (inputKey: string) => db.select().from(jobs).where(eq(jobs.inputKey, inputKey));

  await t.test('AD-51 Rule 4: a post whose stepped extraction is still running -> CHAIN_IN_FLIGHT, no job', async () => {
    const post = await makePost('caption');
    await db.update(posts).set({ extractionCursor: { version: 1, placeholder: 'only its presence matters here' } }).where(eq(posts.id, post.id));
    for (const target of [{ postId: post.id }, { url: post.postUrl }]) {
      const result = await startPostReextractionPreview(moderator, target);
      assert.ok('errorCode' in result && result.errorCode === 'CHAIN_IN_FLIGHT', JSON.stringify(result));
    }
    assert.strictEqual((await jobsFor(post.id)).length, 0);
  });

  await t.test('unknown post id -> NOT_FOUND; a post id that is not a uuid -> NOT_FOUND, not an internal error', async () => {
    assert.deepStrictEqual(await startPostReextractionPreview(moderator, { postId: '00000000-0000-4000-8000-0000000000aa' }), { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' });
    assert.deepStrictEqual(await startPostReextractionPreview(moderator, { postId: 'not-a-uuid' }), { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' });
  });

  await t.test('a stored post WITH a caption and one WITHOUT both start an engine job keyed by the post id (the caption never goes on the job at start)', async () => {
    for (const content of ['A stored caption that must not be copied', null]) {
      const post = await makePost(content);
      const result = await startPostReextractionPreview(moderator, { postId: post.id });
      assert.ok('jobId' in result, JSON.stringify(result));
      const [job] = await jobsFor(post.id);
      assert.strictEqual(job.id, result.jobId);
      assert.strictEqual(job.type, REEXTRACT_POST_JOB_TYPE);
      assert.deepStrictEqual(job.input, { postId: post.id });
      assert.ok(!JSON.stringify(job).includes('must not be copied'));
      // by the post's URL it is the same post, so the same open job
      assert.deepStrictEqual(await startPostReextractionPreview(moderator, { url: post.postUrl }), { jobId: result.jobId });
    }
  });

  await t.test('a URL that is not in the database starts an engine job keyed by the post identity, after the platform and the key checks', async () => {
    const url = `https://www.instagram.com/p/unknown-${suffix}/`;
    const noKey = await startPostReextractionPreview(moderator, { url });
    assert.ok('errorCode' in noKey && noKey.errorCode === 'NO_API_KEY', 'the moderator needs a Gemini key of their own for a post we do not know');
    assert.strictEqual((await jobsFor(reextractUrlInputKey(url))).length, 0);

    const [key] = await db.insert(apiKeys).values({ userId: moderator, provider: 'gemini', keyEncrypted: 'mock-encrypted-key', keyLast4: '1234', isValid: true, invalidAttempts: 0 }).returning();
    keyIds.push(key.id);
    const started = await startPostReextractionPreview(moderator, { url });
    assert.ok('jobId' in started, JSON.stringify(started));
    const [job] = await jobsFor(reextractUrlInputKey(url));
    assert.strictEqual(job.id, started.jobId);
    assert.deepStrictEqual(job.input, { url });
    assert.deepStrictEqual(await startPostReextractionPreview(moderator, { url: `${url}?igsh=abc` }), { jobId: started.jobId }, 'another spelling of the same post joins the open job');
  });

  await t.test('an unsupported platform URL (not stored) -> UNSUPPORTED_PLATFORM, no job', async () => {
    const url = `https://example.com/not-a-post-${suffix}`;
    const result = await startPostReextractionPreview(moderator, { url });
    assert.ok('errorCode' in result);
    assert.strictEqual(result.errorCode, 'UNSUPPORTED_PLATFORM');
    assert.strictEqual((await jobsFor(reextractUrlInputKey(url))).length, 0);
  });

  await t.test('a start the engine cannot make is EXTRACTION_FAILED with a plain message', async () => {
    fx.stubInvoke(new Error('AccessDenied for arn:aws:lambda:secret'));
    const other = await fx.makeUser('moderator'); // a user with a free place (the first has three open jobs by now)
    const post = await makePost('caption');
    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void errors.push(args);
    let result;
    try {
      result = await startPostReextractionPreview(other, { postId: post.id });
    } finally {
      console.error = original;
      fx.stubInvoke();
    }
    assert.deepStrictEqual(result, { errorCode: 'EXTRACTION_FAILED', errorMessage: 'The job could not be started. Please try again.' });
  });
});
