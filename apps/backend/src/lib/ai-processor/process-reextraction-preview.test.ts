import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/client.js';
import {
  events,
  eventPosts,
  manualExtractionJobs,
  postAccountAssociations,
  posts,
  schedules,
  socialMediaAccountProfiles,
  users,
} from '@festgrid/database';
import type { ManualExtractionRequestPayload, ProcessingJobMessage, ReextractionPreviewResult } from '@festgrid/domain/posts';
import { processManualExtractionJob, setCallGeminiForManualExtractionSeam, callGeminiForManualExtractionSeam } from './process-manual-extraction-job.js';
import { insertEventWithPrimaryPost } from '../events/set-event-primary-post.js';
import { setDetectAndBlurFacesSeam, detectAndBlurFacesSeam } from './detect-and-blur-faces.js';

// AD-40 -- real-DB tests for the moderator re-extract preview (AI-Lambda half). Gemini is a seam.
// The invariants under test: the preview writes nothing to events/schedules/event_posts/posts, and
// the post caption never outlives the job in manual_extraction_jobs.request_payload.

test('processManualExtractionJob REEXTRACT_PREVIEW (AD-40)', async (t) => {
  const suffix = Date.now();
  const originalGemini = callGeminiForManualExtractionSeam;
  const originalDetect = detectAndBlurFacesSeam;
  const originalBlur = process.env.BLUR_FACES_BEFORE_AI;
  process.env.BLUR_FACES_BEFORE_AI = 'false';

  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'Must have at least one seeded user');

  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-reex-' + suffix, platform: 'instagram', displayName: 'Reex', username: 'reex_' + suffix })
    .returning();

  const jobIds: string[] = [];
  const postIds: string[] = [];
  const eventIds: string[] = [];
  const name = 'Reex Fun Run ' + suffix;

  t.after(async () => {
    setCallGeminiForManualExtractionSeam(originalGemini);
    setDetectAndBlurFacesSeam(originalDetect);
    if (originalBlur === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
    else process.env.BLUR_FACES_BEFORE_AI = originalBlur;
    if (jobIds.length) await db.delete(manualExtractionJobs).where(inArray(manualExtractionJobs.id, jobIds));
    if (eventIds.length) {
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, account.id));
  });

  async function makePost(content: string | null) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: account.id,
        platform: 'instagram',
        postUrl: `https://www.instagram.com/p/reex-${postIds.length}-${suffix}/`,
        publishedAt: new Date('2026-10-01T00:00:00Z'),
        content,
      })
      .returning();
    postIds.push(post.id);
    await db.insert(postAccountAssociations).values({ postId: post.id, accountId: account.id, role: 'PUBLISHER' });
    return post;
  }

  async function makeEvent(postId: string, links: { url: string }[], startDate: string, eventName = name) {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName,
      location: 'Reex Zoo',
      hasPrivateContact: false,
      postId,
      sourceSocialMediaAccountId: account.accountId,
      links,
    });
    assert.ok(inserted);
    eventIds.push(inserted.id);
    await db.insert(schedules).values({ eventId: inserted.id, eventStartDate: startDate, isMainSchedule: true, location: 'Reex Zoo' });
    return inserted;
  }

  function message(post: { id: string; postUrl: string }, content: string): ProcessingJobMessage {
    return { postId: post.id, accountId: account.id, content, postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00Z' };
  }

  async function insertJob(payload: ManualExtractionRequestPayload) {
    const [row] = await db
      .insert(manualExtractionJobs)
      .values({ requestedByUserId: user.id, sourceUrl: payload.message.postUrl, requestPayload: payload })
      .returning();
    jobIds.push(row.id);
    return row.id;
  }
  const readJob = async (id: string) => (await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, id)))[0];

  const gemini = (eventList: unknown[], groupingReason = 'single-event') =>
    setCallGeminiForManualExtractionSeam(
      async () => ({ text: JSON.stringify({ isEvent: true, groupingReason, events: eventList }) }) as any
    );

  const previewEvent = (startDate: string, eventName = name) => ({
    eventName,
    types: ['COMPETITION'],
    categories: ['SPORTS_AND_FITNESS'],
    location: 'Reex Zoo',
    links: [{ url: 'http://www.reex-run.example/' }],
    schedules: [{ isMainSchedule: true, eventStartDate: startDate, title: 'Race day', location: 'Reex Zoo' }],
    confidenceScore: 0.9,
  });

  async function fixtureCounts() {
    const [{ n: ev }] = await db.select({ n: sql<number>`count(*)::int` }).from(events).where(like(events.eventName, `%${suffix}%`));
    const [{ n: sch }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schedules)
      .innerJoin(events, eq(events.id, schedules.eventId))
      .where(like(events.eventName, `%${suffix}%`));
    const [{ n: ep }] = await db.select({ n: sql<number>`count(*)::int` }).from(eventPosts).where(inArray(eventPosts.postId, postIds));
    return { ev, sch, ep, posts: postIds.length };
  }

  await t.test('stored post: reports the real dedup outcome (shared link far away -> capped at mid) and writes nothing', async () => {
    const candidatePost = await makePost('candidate caption');
    const candidate = await makeEvent(candidatePost.id, [{ url: 'http://www.reex-run.example' }], '2026-10-21');
    const post = await makePost('The caption to extract');
    gemini([previewEvent('2026-11-08')]);
    const before = await fixtureCounts();

    const id = await insertJob({
      message: message(post, 'The caption to extract'),
      existingPostAccountId: account.id,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: false,
    });
    await processManualExtractionJob(id);

    const row = await readJob(id);
    assert.strictEqual(row.status, 'SUCCEEDED');
    const preview = row.resultData as ReextractionPreviewResult;
    assert.strictEqual(preview.groupingReason, 'single-event');
    assert.strictEqual(preview.postStored, true);
    assert.strictEqual(preview.events.length, 1);
    assert.strictEqual(preview.events[0].dedup.tier, 'mid');
    assert.strictEqual(preview.events[0].dedup.candidateSlug, candidate.slug);
    assert.strictEqual(preview.events[0].alreadyRepresentedBySlug, null);
    // What a later Apply needs is kept on the job; the caption is not.
    assert.ok(preview.extracted, 'the extraction is kept for Apply');
    assert.strictEqual(preview.extracted.events.length, 1);
    assert.strictEqual(preview.extracted.groupingReason, 'single-event');
    assert.strictEqual(preview.extracted.childrensDataMatch, false);
    assert.ok(!JSON.stringify(row.resultData).includes('The caption to extract'), 'the caption is never stored in the result');
    assert.deepStrictEqual(await fixtureCounts(), before, 'preview must not write events/schedules/event_posts');
    const [stored] = await db.select({ content: posts.content }).from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.content, 'The caption to extract', 'a non-curator post keeps its stored content');
    assert.strictEqual((row.requestPayload as ManualExtractionRequestPayload).message.content, '', 'caption blanked after the job');
  });

  await t.test('rescraped caption for a post with null content: posts.content stays null, payload blanked', async () => {
    const post = await makePost(null);
    gemini([previewEvent('2026-12-20', 'Reex Unrelated Gala ' + suffix)]);
    const id = await insertJob({
      message: message(post, 'Rescraped caption text'),
      existingPostAccountId: account.id,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: true,
    });
    await processManualExtractionJob(id);

    const row = await readJob(id);
    assert.strictEqual(row.status, 'SUCCEEDED');
    assert.strictEqual((row.resultData as ReextractionPreviewResult).rescraped, true);
    const [stored] = await db.select({ content: posts.content }).from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.content, null);
    assert.strictEqual((row.requestPayload as ManualExtractionRequestPayload).message.content, '');
  });

  await t.test('failure path still blanks the payload', async () => {
    const post = await makePost(null);
    setCallGeminiForManualExtractionSeam(async () => {
      throw new Error('boom');
    });
    const id = await insertJob({
      message: message(post, 'Rescraped caption text'),
      existingPostAccountId: account.id,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: true,
    });
    await processManualExtractionJob(id);

    const row = await readJob(id);
    assert.strictEqual(row.status, 'FAILED');
    assert.strictEqual((row.requestPayload as ManualExtractionRequestPayload).message.content, '');
  });

  await t.test('the existing correction flow also blanks the payload', async () => {
    const post = await makePost('Correction caption');
    gemini([previewEvent('2026-11-08')]);
    const id = await insertJob({ message: message(post, 'Correction caption'), existingPostAccountId: account.id });
    await processManualExtractionJob(id);

    const row = await readJob(id);
    assert.strictEqual(row.status, 'SUCCEEDED');
    assert.strictEqual((row.requestPayload as ManualExtractionRequestPayload).message.content, '');
  });

  await t.test('an item whose (post, ordinal) slot is taken is reported as already represented', async () => {
    const post = await makePost('Already ingested caption');
    const existing = await makeEvent(post.id, [{ url: 'http://www.other-reex.example' }], '2027-02-01', 'Reex Represented ' + suffix);
    gemini([previewEvent('2027-02-01', 'Reex Represented ' + suffix)]);
    const id = await insertJob({
      message: message(post, 'Already ingested caption'),
      existingPostAccountId: account.id,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: false,
    });
    await processManualExtractionJob(id);

    const preview = (await readJob(id)).resultData as ReextractionPreviewResult;
    assert.strictEqual(preview.events[0].alreadyRepresentedBySlug, existing.slug);
  });

  await t.test('a URL that is not stored: previews with no account signal and postStored false', async () => {
    gemini([previewEvent('2027-03-01', 'Reex Unstored ' + suffix)]);
    const unstoredMessage: ProcessingJobMessage = {
      postId: randomUUID(),
      accountId: '',
      content: 'Scraped, never stored',
      postUrl: `https://www.instagram.com/p/reex-unstored-${suffix}/`,
      publishedAt: '2026-10-01T00:00:00Z',
    };
    const id = await insertJob({ message: unstoredMessage, mode: 'REEXTRACT_PREVIEW', postStored: false, rescraped: true });
    await processManualExtractionJob(id);

    const row = await readJob(id);
    assert.strictEqual(row.status, 'SUCCEEDED');
    const preview = row.resultData as ReextractionPreviewResult;
    assert.strictEqual(preview.postStored, false);
    assert.strictEqual(preview.events[0].dedup.tier, 'none');
    assert.strictEqual((row.requestPayload as ManualExtractionRequestPayload).message.content, '');
  });

  await t.test('the caption is already blanked in the database while the job is still running (a crash mid-run leaves nothing)', async () => {
    const post = await makePost(null);
    let storedWhileRunning: string | undefined;
    const id = await insertJob({
      message: message(post, 'Caption held only in memory'),
      existingPostAccountId: account.id,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: true,
    });
    setCallGeminiForManualExtractionSeam(async () => {
      storedWhileRunning = ((await readJob(id)).requestPayload as ManualExtractionRequestPayload).message.content;
      return { text: JSON.stringify({ isEvent: true, groupingReason: 'single-event', events: [previewEvent('2027-04-01', 'Reex Midrun ' + suffix)] }) } as any;
    });
    await processManualExtractionJob(id);
    assert.strictEqual(storedWhileRunning, '', 'stored payload blanked right after the claim, before Gemini runs');
    assert.strictEqual((await readJob(id)).status, 'SUCCEEDED');
  });

  await t.test('a not-stored post is not treated as a stub, and an unknown-authorship note applies (no authorship lookup)', async () => {
    gemini([previewEvent('2027-05-01', 'Reex Unstored Two ' + suffix)]);
    const id = await insertJob({
      message: { postId: randomUUID(), accountId: '', content: 'x', postUrl: `https://www.instagram.com/p/reex-unstored2-${suffix}/`, publishedAt: '2026-10-01T00:00:00Z' },
      mode: 'REEXTRACT_PREVIEW',
      postStored: false,
      rescraped: true,
    });
    await processManualExtractionJob(id);
    const preview = (await readJob(id)).resultData as ReextractionPreviewResult;
    assert.strictEqual(preview.events[0].isStub, false);
  });

  await t.test('the freshly extracted grouping reason decides the roundup stub, not the stored one', async () => {
    const post = await makePost('Roundup caption');
    gemini([previewEvent('2027-06-01', 'Reex Roundup Item ' + suffix)], 'roundup');
    const id = await insertJob({
      message: message(post, 'Roundup caption'),
      existingPostAccountId: account.id,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: false,
    });
    await processManualExtractionJob(id);
    const preview = (await readJob(id)).resultData as ReextractionPreviewResult;
    assert.strictEqual(preview.groupingReason, 'roundup');
    assert.strictEqual(preview.events[0].isStub, true);
  });

  await t.test('a post deleted between start and run is reported as not stored', async () => {
    const post = await makePost('Soon deleted');
    const payloadMessage = message(post, 'Soon deleted');
    await db.delete(postAccountAssociations).where(eq(postAccountAssociations.postId, post.id));
    await db.delete(posts).where(eq(posts.id, post.id));
    postIds.splice(postIds.indexOf(post.id), 1);
    gemini([previewEvent('2027-07-01', 'Reex Deleted Post ' + suffix)]);
    const id = await insertJob({ message: payloadMessage, existingPostAccountId: account.id, mode: 'REEXTRACT_PREVIEW', postStored: true, rescraped: false });
    await processManualExtractionJob(id);
    const row = await readJob(id);
    assert.strictEqual(row.status, 'SUCCEEDED');
    assert.strictEqual((row.resultData as ReextractionPreviewResult).postStored, false);
  });

  await t.test('"not an event" is a valid, empty preview', async () => {
    const post = await makePost('Not an event');
    setCallGeminiForManualExtractionSeam(async () => ({ text: JSON.stringify({ isEvent: false, events: [] }) }) as any);
    const id = await insertJob({
      message: message(post, 'Not an event'),
      existingPostAccountId: account.id,
      mode: 'REEXTRACT_PREVIEW',
      postStored: true,
      rescraped: false,
    });
    await processManualExtractionJob(id);

    const row = await readJob(id);
    assert.strictEqual(row.status, 'SUCCEEDED');
    assert.deepStrictEqual((row.resultData as ReextractionPreviewResult).events, []);
  });

  await t.test('BUG-097: a carousel with an expired cover reads up to the preview cap of slides and reports the shortfall', async () => {
    const post = await makePost('Roundup caption, schedules on later slides');
    const originalFetch = globalThis.fetch;
    let fetched = 0;
    // Cover (first call) is an expired hotlink; every slide fetch succeeds.
    globalThis.fetch = (async () => {
      fetched++;
      if (fetched === 1) return { ok: false, status: 403 } as any;
      return {
        ok: true,
        headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
        arrayBuffer: async () => Buffer.from(`slide-${fetched}`),
      } as any;
    }) as typeof fetch;

    let sentContents: any;
    setCallGeminiForManualExtractionSeam(async (req: any) => {
      sentContents = req.contents;
      return { text: JSON.stringify({ isEvent: true, groupingReason: 'roundup', events: [previewEvent('2026-11-08', name + ' slide')] }) } as any;
    });

    const slides = Array.from({ length: 12 }, (_, i) => `https://cdn.example.com/slide-${i}.jpg`);
    try {
      const id = await insertJob({
        message: { ...message(post, 'Roundup caption, schedules on later slides'), imageUrl: 'https://cdn.example.com/cover.jpg', additionalImageUrls: slides },
        existingPostAccountId: account.id,
        mode: 'REEXTRACT_PREVIEW',
        postStored: true,
        rescraped: true,
      });
      await processManualExtractionJob(id);

      const row = await readJob(id);
      assert.strictEqual(row.status, 'SUCCEEDED');
      const preview = row.resultData as ReextractionPreviewResult;
      assert.strictEqual(preview.imagesAvailable, 13, 'cover + 12 slides listed');
      assert.strictEqual(preview.imagesSent, 10, 'capped at REEXTRACT_MAX_CAROUSEL_IMAGES; the cover was lost but slides were still sent');
      assert.ok(Array.isArray(sentContents));
      assert.strictEqual(sentContents.length, 11, 'text + 10 slides');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('the extraction kept for Apply has the privacy discards already applied: no private contact, no child performers', async () => {
    const caption = 'Ayo daftar Lomba Tari Anak Sanggar Melati untuk siswa SD!';
    const post = await makePost(caption);
    gemini([
      {
        ...previewEvent('2026-11-20', `Kids Dance ${suffix}`),
        hasPrivateContact: true,
        contactInfo: '+62 812 0000 0000',
        schedules: [{ isMainSchedule: true, eventStartDate: '2026-11-20', title: 'Show', location: 'Reex Zoo', performers: ['Aisyah', 'Budi'] }],
      },
    ]);
    const id = await insertJob({ message: message(post, caption), existingPostAccountId: account.id, mode: 'REEXTRACT_PREVIEW', postStored: true, rescraped: false });
    await processManualExtractionJob(id);

    const row = await readJob(id);
    const preview = row.resultData as ReextractionPreviewResult;
    assert.ok(preview.extracted);
    assert.strictEqual(preview.extracted.childrensDataMatch, true);
    const [kept] = preview.extracted.events;
    assert.strictEqual(kept.contactInfo, undefined, 'a private contact is not stored');
    assert.strictEqual(kept.schedules[0].performers, undefined, 'a child performer\'s name is not stored');
    const stored = JSON.stringify(row.resultData);
    assert.ok(!stored.includes('+62 812 0000 0000') && !stored.includes('Aisyah') && !stored.includes('Budi'));
  });
});
