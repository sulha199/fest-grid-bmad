import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_STATUSES,
  REEXTRACT_PHASE_PREVIEW,
  REEXTRACT_PHASE_REFRESH,
  REEXTRACT_POST_JOB_TYPE,
  REEXTRACT_POST_MAX_DURATION_MS,
  REEXTRACT_POST_PROVIDER_ORDER,
  decideReextractEnding,
  getJobTypeDefinition,
  parseReextractPostInput,
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
  assert.deepEqual(reextractPostJobType, { type: 'reextract-post', host: 'scraper', maxDurationMs: 600_000 });
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

test('parseReextractPostInput accepts only an object holding a post uuid', () => {
  const postId = '0a1b2c3d-0000-4000-8000-000000000001';
  assert.deepEqual(parseReextractPostInput({ postId }), { postId });
  assert.deepEqual(parseReextractPostInput({ postId, extra: 1 }), { postId });
  for (const bad of [null, undefined, 'x', 7, {}, { postId: 5 }, { postId: 'not-a-uuid' }, { postId: '' }]) {
    assert.equal(parseReextractPostInput(bad), null);
  }
});

test('a refresh that was not needed or delivered ends SUCCEEDED, with no reason', () => {
  assert.deepEqual(decideReextractEnding({ outcome: 'NOT_NEEDED' }), { outcome: 'SUCCEEDED' });
  assert.deepEqual(decideReextractEnding({ outcome: 'REFRESHED' }), { outcome: 'SUCCEEDED' });
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
    const ending = decideReextractEnding({ outcome });
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
