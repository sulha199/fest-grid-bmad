import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGeminiError,
  classifyGeminiMessage,
  classifyGeminiUnusableResponse,
  isDailyQuotaMessage,
  parseRetryHintSeconds,
} from './gemini-situation.js';
import { GeminiInvalidKeyError, GeminiRateLimitedError, GeminiUnknownError } from './gemini-client.js';
import { VendorCallTimeoutError } from '../vendor-gateway/guarded-call.js';

const FREE_TIER_429 =
  '{"error":{"code":429,"message":"You exceeded your current quota. Please retry in 42.430894734s.","status":"RESOURCE_EXHAUSTED"}}';

test('classifyGeminiMessage', async (t) => {
  await t.test('a per-minute 429 carries the server hint', () => {
    assert.deepEqual(classifyGeminiMessage(FREE_TIER_429), { situation: 'rate_limited', retryAfterSeconds: 42.430894734 });
  });
  await t.test('a 429 with no hint has none', () => {
    assert.deepEqual(classifyGeminiMessage('RESOURCE_EXHAUSTED'), { situation: 'rate_limited' });
  });
  await t.test('a per-day 429 is the daily quota situation', () => {
    assert.deepEqual(classifyGeminiMessage('429 Quota exceeded ..._requests_PerDay ... retry in 10s'), { situation: 'quota_exhausted_daily' });
    assert.equal(isDailyQuotaMessage('requests per day'), false, 'needs a rate-limit marker too');
  });
  await t.test('bad key, unavailable, bad request, unknown', () => {
    assert.equal(classifyGeminiMessage('API key not valid').situation, 'invalid_credential');
    assert.equal(classifyGeminiMessage('{"status":"UNAVAILABLE"}').situation, 'unavailable');
    assert.equal(classifyGeminiMessage('fetch failed').situation, 'unavailable');
    assert.equal(classifyGeminiMessage('got 503 from upstream').situation, 'unavailable');
    assert.equal(classifyGeminiMessage('INVALID_ARGUMENT: bad schema').situation, 'bad_request');
    assert.equal(classifyGeminiMessage('something odd').situation, 'unknown');
  });
  await t.test('a status number inside a longer number is not a status', () => {
    assert.equal(classifyGeminiMessage('job 4030 failed').situation, 'unknown');
    assert.equal(classifyGeminiMessage('took 403.5s').situation, 'unknown');
    assert.equal(classifyGeminiMessage('HTTP 403 Forbidden').situation, 'invalid_credential');
    assert.equal(classifyGeminiMessage('Service unavailable, try later').situation, 'unavailable');
  });
  await t.test('a malformed hint is no hint', () => {
    assert.deepEqual(classifyGeminiMessage('429 Please retry in 1.2.3s'), { situation: 'rate_limited' });
  });
  await t.test('parseRetryHintSeconds', () => {
    assert.equal(parseRetryHintSeconds('Please retry in 7s.'), 7);
    assert.equal(parseRetryHintSeconds('no hint'), undefined);
  });
});

test('classifyGeminiError', async (t) => {
  await t.test('typed errors map directly', () => {
    assert.deepEqual(classifyGeminiError(new GeminiRateLimitedError('429', 30)), { situation: 'rate_limited', retryAfterSeconds: 30 });
    assert.deepEqual(classifyGeminiError(new GeminiRateLimitedError(FREE_TIER_429)), { situation: 'rate_limited', retryAfterSeconds: 42.430894734 });
    assert.deepEqual(classifyGeminiError(new GeminiRateLimitedError('429')), { situation: 'rate_limited' });
    assert.equal(classifyGeminiError(new GeminiRateLimitedError('429 requests_PerDay')).situation, 'quota_exhausted_daily');
    assert.equal(classifyGeminiError(new GeminiInvalidKeyError('API key not valid')).situation, 'invalid_credential');
    assert.equal(classifyGeminiError(new VendorCallTimeoutError('timed out')).situation, 'timeout');
  });
  await t.test('a 5xx or connection reset wrapped in GeminiUnknownError is unavailable', () => {
    assert.equal(classifyGeminiError(new GeminiUnknownError('server error', { status: 503 })).situation, 'unavailable');
    assert.equal(classifyGeminiError(new GeminiUnknownError('reset', { code: 'ECONNRESET' })).situation, 'unavailable');
  });
  await t.test('anything else falls back to the message, then unknown', () => {
    assert.equal(classifyGeminiError(new GeminiUnknownError('INVALID_ARGUMENT', {})).situation, 'bad_request');
    assert.equal(classifyGeminiError(new Error('boom')).situation, 'unknown');
    assert.equal(classifyGeminiError('plain string').situation, 'unknown');
  });
});

test('classifyGeminiUnusableResponse', async (t) => {
  await t.test('a prompt block or a refusing finish reason is blocked', () => {
    assert.equal(classifyGeminiUnusableResponse({ blockReason: 'PROHIBITED_CONTENT' }), 'blocked');
    for (const finishReason of ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']) {
      assert.equal(classifyGeminiUnusableResponse({ finishReason }), 'blocked', finishReason);
    }
  });
  await t.test('MAX_TOKENS is truncated, anything else is unparseable', () => {
    assert.equal(classifyGeminiUnusableResponse({ finishReason: 'MAX_TOKENS' }), 'truncated');
    assert.equal(classifyGeminiUnusableResponse({ finishReason: 'STOP', outputNearLimit: true }), 'truncated');
    assert.equal(classifyGeminiUnusableResponse({ finishReason: 'STOP' }), 'unparseable');
    assert.equal(classifyGeminiUnusableResponse({}), 'unparseable');
  });
});
