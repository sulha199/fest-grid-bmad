import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_STATUSES,
  REEXTRACT_PHASE_PREVIEW,
  REEXTRACT_PHASE_REFRESH,
  REEXTRACT_POST_JOB_TYPE,
  REEXTRACT_POST_ATTEMPT_CAP_MS,
  REEXTRACT_POST_MAX_DURATION_MS,
  REEXTRACT_POST_PROVIDER_ORDER,
  decideReextractEnding,
  getJobTypeDefinition,
  isReextractJobStale,
  parseReextractPostInput,
  readHeldPost,
  REEXTRACT_STALE_AFTER_MS,
  reextractUrlInputKey,
  withHeldPost,
  withoutHeldPost,
  reextractPostInputKey,
  reextractPostJobType,
  toExtractionError,
  toExtractionJobState,
  type JobStatus,
} from './index.js';
import { REEXTRACT_REFRESH_OUTCOMES } from '../posts/reextract-image-refresh.js';

// Story 10.6 -- the pure half of the `reextract-post` job type (AD-53 Rules 2, 12 and 17).

test('the definition is registered when the barrel is imported, hosted on the scraper, bounded at 10 minutes', () => {
  assert.equal(getJobTypeDefinition(REEXTRACT_POST_JOB_TYPE), reextractPostJobType);
  assert.deepEqual(reextractPostJobType, { type: 'reextract-post', host: 'scraper', maxDurationMs: 600_000, attemptCapMs: 270_000 });
  assert.equal(REEXTRACT_POST_MAX_DURATION_MS, 600_000);
  assert.equal(reextractPostJobType.sharedAcrossUsers, undefined, 'a re-extract is private to its moderator');
  assert.equal(reextractPostJobType.reservesSubscriptionSlot, undefined);
});

test('evaluating the module a second time keeps the one registration and does not throw (a bundle with two entry paths)', async () => {
  const specifier = './reextract-post.js?evaluated-twice'; // a variable, so the compiler does not try to resolve the query
  const again = (await import(specifier)) as { reextractPostJobType: unknown };
  assert.equal(getJobTypeDefinition(REEXTRACT_POST_JOB_TYPE), reextractPostJobType, 'the first registration stands');
  assert.deepEqual(again.reextractPostJobType, reextractPostJobType);
});

test('the type has its own provider order, Apify then Bright Data, and two named phases', () => {
  assert.deepEqual([...REEXTRACT_POST_PROVIDER_ORDER], ['apify', 'brightdata']);
  assert.equal(REEXTRACT_PHASE_REFRESH, 'refresh');
  assert.equal(REEXTRACT_PHASE_PREVIEW, 'preview');
});

test('the input key is the post id, lower-cased, so a second click joins the open job', () => {
  assert.equal(reextractPostInputKey('0A1B2C3D-0000-4000-8000-000000000001'), '0a1b2c3d-0000-4000-8000-000000000001');
});

test('parseReextractPostInput accepts an object holding a post uuid, or a URL for a post that is not stored, and nothing else', () => {
  const postId = '0a1b2c3d-0000-4000-8000-000000000001';
  assert.deepEqual(parseReextractPostInput({ postId }), { postId });
  assert.deepEqual(parseReextractPostInput({ postId, extra: 1 }), { postId });
  assert.deepEqual(parseReextractPostInput({ url: 'https://www.instagram.com/p/AAA/' }), { url: 'https://www.instagram.com/p/AAA/' });
  assert.deepEqual(parseReextractPostInput({ postId: 'not-a-uuid', url: 'https://x.example/p/1' }), { url: 'https://x.example/p/1' }, 'a bad post id falls to the url');
  for (const bad of [null, undefined, 'x', 7, {}, { postId: 5 }, { postId: 'not-a-uuid' }, { postId: '' }, { url: '' }, { url: '   ' }, { url: 5 }]) {
    assert.equal(parseReextractPostInput(bad), null);
  }
});

test('a URL re-extract is keyed by the post\'s own identity (every spelling shares it), else by the trimmed URL', () => {
  const keys = new Set(
    ['https://www.instagram.com/p/Cx9uWttkSN/', 'https://instagram.com/p/Cx9uWttkSN', 'https://www.instagram.com/p/Cx9uWttkSN/?igsh=abc', '  https://www.instagram.com/p/Cx9uWttkSN/  '].map(reextractUrlInputKey)
  );
  assert.deepEqual([...keys], ['url:instagram:Cx9uWttkSN']);
  assert.notEqual(reextractUrlInputKey('https://www.instagram.com/p/AAA/'), reextractUrlInputKey('https://www.instagram.com/p/aaa/'), 'post ids are case sensitive');
  assert.equal(reextractUrlInputKey('https://example.com/post-1 '), 'url:https://example.com/post-1');
  assert.equal(reextractUrlInputKey('https://mirror.example/p/XyZ/'), 'url:unknown:XyZ');
  assert.notEqual(reextractUrlInputKey('https://www.instagram.com/p/AAA/'), reextractPostInputKey('0a1b2c3d-0000-4000-8000-000000000001'));
});

test('a held post is read, added and removed on a job input without touching its identity', () => {
  const held = { content: 'a caption', postUrl: 'https://www.instagram.com/p/A/', publishedAt: '2026-10-01T00:00:00.000Z', imageUrl: 'https://cdn.example/a.jpg' };
  const input = { postId: '0a1b2c3d-0000-4000-8000-000000000001' };
  const withHeld = withHeldPost(input, held);
  assert.deepEqual(withHeld, { ...input, held });
  assert.deepEqual(readHeldPost(withHeld), held);
  assert.deepEqual(withHeldPost(withHeld, { ...held, content: 'again' }), { ...input, held: { ...held, content: 'again' } }, 'a second hold replaces the first');
  assert.deepEqual(withoutHeldPost(withHeld), input);
  assert.deepEqual(withoutHeldPost(input), input);
  assert.equal(withoutHeldPost(null), null);
  assert.equal(withoutHeldPost('x'), 'x');
  assert.equal(readHeldPost(input), null);
  for (const bad of [null, 'x', { held: null }, { held: 'x' }, { held: { content: 1, postUrl: 'u', publishedAt: 'p' } }, { held: { content: 'c', publishedAt: 'p' } }, { held: { content: 'c', postUrl: 'u' } }]) {
    assert.equal(readHeldPost(bad), null);
  }
  assert.deepEqual(readHeldPost({ held: { content: '', postUrl: 'u', publishedAt: 'p' } }), { content: '', postUrl: 'u', publishedAt: 'p' }, 'an image-only post has an empty caption');
});

test('an open job is stuck only when it was admitted, has no ending and nothing wrote to it for five minutes', () => {
  const now = new Date('2026-11-12T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);
  assert.equal(REEXTRACT_STALE_AFTER_MS, 300_000);
  assert.equal(isReextractJobStale({ status: 'RUNNING', admittedAt: ago(900_000), updatedAt: ago(299_000) }, now), false, 'progress 299 s ago');
  assert.equal(isReextractJobStale({ status: 'RUNNING', admittedAt: ago(900_000), updatedAt: ago(300_000) }, now), false, 'exactly five minutes is not yet over');
  assert.equal(isReextractJobStale({ status: 'RUNNING', admittedAt: ago(900_000), updatedAt: ago(301_000) }, now), true);
  assert.equal(isReextractJobStale({ status: 'QUEUED', admittedAt: ago(900_000), updatedAt: ago(600_000) }, now), true, 'admitted, never claimed: stuck');
  assert.equal(isReextractJobStale({ status: 'QUEUED', admittedAt: null, updatedAt: ago(1_200_000) }, now), false, 'waiting in the queue for a place is not stuck');
  assert.equal(isReextractJobStale({ status: 'SUCCEEDED', admittedAt: ago(900_000), updatedAt: ago(900_000) }, now), false);
  assert.equal(isReextractJobStale({ status: 'FAILED', admittedAt: ago(900_000), updatedAt: ago(900_000) }, now), false);
});

test('a refresh that was not needed or that healed the images ends SUCCEEDED, with no reason', () => {
  assert.deepEqual(decideReextractEnding({ outcome: 'NOT_NEEDED', saved: false, expiredLinks: 0 }), { outcome: 'SUCCEEDED' });
  assert.deepEqual(decideReextractEnding({ outcome: 'REFRESHED', saved: true, expiredLinks: 0 }), { outcome: 'SUCCEEDED' });
  assert.deepEqual(decideReextractEnding({ outcome: 'REFRESHED', saved: true, expiredLinks: 1 }), { outcome: 'SUCCEEDED' }, 'saved something: the screen shows the counts');
  assert.deepEqual(decideReextractEnding({ outcome: 'REFRESHED', saved: false, expiredLinks: 0 }), { outcome: 'SUCCEEDED' }, 'nothing to save and nothing dead: the stored links were fine');
});

test('FR117: a provider that answered but healed nothing while links stay expired ends SUCCEEDED_WITH_LIMITS with a reason, never a bare success', () => {
  const ending = decideReextractEnding({ outcome: 'REFRESHED', saved: false, expiredLinks: 2 });
  assert.equal(ending.outcome, 'SUCCEEDED_WITH_LIMITS');
  assert.equal(ending.reasonCode, 'REFRESH_DID_NOT_HEAL_IMAGES');
  assert.match(ending.message ?? '', /no usable fresh images/);
});

test('the type declares a per-run cap of 270 s, under both host Lambdas\' 300 s timeout (Story 10.6 review)', () => {
  assert.equal(REEXTRACT_POST_ATTEMPT_CAP_MS, 270_000);
  assert.equal(reextractPostJobType.attemptCapMs, REEXTRACT_POST_ATTEMPT_CAP_MS);
  assert.ok(REEXTRACT_POST_ATTEMPT_CAP_MS < 300_000);
});

test('every other refresh outcome ends SUCCEEDED_WITH_LIMITS with a reason code and a plain message (FR117)', () => {
  const expected: Record<string, string> = {
    COOLDOWN: 'COOLDOWN',
    NOT_SCRAPED: 'ACCOUNT_TYPE_NOT_SCRAPED',
    IN_FLIGHT: 'REFRESH_IN_PROGRESS',
    POST_UNAVAILABLE: 'POST_UNAVAILABLE',
    NO_PROVIDER_REACHABLE: 'NO_PROVIDER_REACHABLE',
    PROVIDER_OVER_QUOTA: 'PROVIDER_OVER_QUOTA',
    TIMED_OUT: 'TIMED_OUT',
  };
  for (const outcome of REEXTRACT_REFRESH_OUTCOMES) {
    if (outcome === 'NOT_NEEDED' || outcome === 'REFRESHED') continue;
    const ending = decideReextractEnding({ outcome, saved: false, expiredLinks: 1 });
    assert.equal(ending.outcome, 'SUCCEEDED_WITH_LIMITS');
    assert.equal(ending.reasonCode, expected[outcome], outcome);
    assert.ok(ending.message && ending.message.length > 20, outcome);
    assert.doesNotMatch(ending.message, /apify|bright ?data|http/i, 'a moderator-facing message never names a vendor or a URL');
  }
});

test('the job status maps onto the extraction states the moderator screen already polls', () => {
  const expected: Record<JobStatus, string> = {
    QUEUED: 'PENDING',
    RUNNING: 'PROCESSING',
    WAITING: 'PROCESSING',
    SUCCEEDED: 'SUCCEEDED',
    SUCCEEDED_WITH_LIMITS: 'SUCCEEDED',
    FAILED: 'FAILED',
    EXPIRED: 'FAILED',
  };
  for (const status of JOB_STATUSES) {
    assert.equal(toExtractionJobState(status), expected[status], status);
  }
});

test('toExtractionError maps a fetch refusal of a caption-needed re-extract to the codes the screen already reads', () => {
  const expected: Record<string, string> = {
    ACCOUNT_TYPE_NOT_SCRAPED: 'ACCOUNT_NOT_SCRAPABLE',
    COOLDOWN: 'RATE_LIMITED',
    REFRESH_IN_PROGRESS: 'SCRAPE_IN_PROGRESS',
    POST_UNAVAILABLE: 'SCRAPE_FAILED',
    NO_PROVIDER_REACHABLE: 'SCRAPE_FAILED',
    PROVIDER_OVER_QUOTA: 'SCRAPE_FAILED',
  };
  for (const [reason, code] of Object.entries(expected)) {
    assert.deepEqual(toExtractionError(reason, 'plain words'), { errorCode: code, errorMessage: 'plain words' }, reason);
  }
});

test('toExtractionError keeps the existing codes and falls back to a plain message', () => {
  assert.deepEqual(toExtractionError('QUOTA_EXHAUSTED', 'No available Gemini API key to perform this extraction.'), {
    errorCode: 'QUOTA_EXHAUSTED',
    errorMessage: 'No available Gemini API key to perform this extraction.',
  });
  assert.deepEqual(toExtractionError('POST_NOT_FOUND', 'Post not found.'), { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' });
  assert.equal(toExtractionError('CHAIN_IN_FLIGHT', 'busy').errorCode, 'CHAIN_IN_FLIGHT');
  assert.deepEqual(toExtractionError('EXTRACTION_FAILED', 'The extracted content could not be validated.'), {
    errorCode: 'EXTRACTION_FAILED',
    errorMessage: 'The extracted content could not be validated.',
  });
  assert.deepEqual(toExtractionError('TIMED_OUT', null), { errorCode: 'EXTRACTION_FAILED', errorMessage: 'The extraction timed out. Please try again.' });
  assert.equal(toExtractionError('WAITED_TOO_LONG', undefined).errorMessage, 'The extraction timed out. Please try again.');
  assert.deepEqual(toExtractionError('HANDLER_ERROR', ''), { errorCode: 'EXTRACTION_FAILED', errorMessage: 'The extraction could not be completed.' });
  assert.equal(toExtractionError(null, null).errorMessage, 'The extraction could not be completed.');
});
