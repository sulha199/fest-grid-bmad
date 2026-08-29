import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles, posts, unprocessedScraperPayloads } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { replayActorRun } from './replay-actor-run.js';
import { randomUUID } from 'node:crypto';

test('replay-actor-run tests (Bright Data)', async (t) => {
  let testProfileId: string;
  let testRunId: string;

  t.before(async () => {
    // Create test profile
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'acct-' + Date.now(),
        platform: 'instagram',
        username: 'test_user_replay',
        displayName: 'Test User Replay',
      })
      .returning({ id: socialMediaAccountProfiles.id });
    testProfileId = profile.id;
  });

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId));
  });

  t.afterEach(async () => {
    if (testRunId) {
      await db.delete(posts).where(eq(posts.accountId, testProfileId));
      await db.delete(unprocessedScraperPayloads).where(eq(unprocessedScraperPayloads.scraperActorRunId, testRunId));
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.id, testRunId));
    }
  });

  await t.test('Bright Data replay persists valid record and records malformed one in unprocessed payloads', async () => {
    const rawOutput = [
      {
        url: 'https://www.instagram.com/p/valid-replay/',
        caption: 'Valid replayed post',
        date_posted: '2026-08-08T00:00:00Z',
        image_url: 'https://example.com/img.jpg',
      },
      {
        url: 'https://www.instagram.com/p/bad-date-replay/',
        caption: 'Bad date post',
        date_posted: 12345, // malformed date
        image_url: 'https://example.com/img2.jpg',
      },
    ];

    const [run] = await db
      .insert(scraperActorRuns)
      .values({
        vendor: 'BRIGHTDATA',
        triggerMode: 'SYNC',
        profileId: testProfileId,
        runId: randomUUID(),
        status: 'SUCCEEDED',
        rawInput: {}, // Provide empty object for jsonb rawInput
        rawOutput: rawOutput,
        itemCount: 2,
        startedAt: new Date(),
        completedAt: new Date(),
      })
      .returning({ id: scraperActorRuns.id });
    
    testRunId = run.id;

    const result = await replayActorRun(testRunId);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.postsPersisted, 1);

    // Verify valid post persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId));
    
    assert.strictEqual(persistedPosts.length, 1);
    assert.strictEqual(persistedPosts[0].postUrl, 'https://www.instagram.com/p/valid-replay/');

    // Verify malformed post recorded in unprocessed payloads
    const unprocessed = await db
      .select()
      .from(unprocessedScraperPayloads)
      .where(eq(unprocessedScraperPayloads.scraperActorRunId, testRunId));
    
    assert.strictEqual(unprocessed.length, 1);
    const context = unprocessed[0].context as any;
    assert.strictEqual(context.postUrl, 'https://www.instagram.com/p/bad-date-replay/');
  });
});