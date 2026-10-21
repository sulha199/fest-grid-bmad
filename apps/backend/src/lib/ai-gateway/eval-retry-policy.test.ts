import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EVAL_MAX_ATTEMPTS, isEvalDailyQuotaError, nextEvalRetryDelayMs } from './eval-retry-policy.js';

const FREE_TIER_429 =
  '{"error":{"code":429,"message":"You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15, model: gemini-3.5-flash-lite\\nPlease retry in 42.430894734s.","status":"RESOURCE_EXHAUSTED"}}';

describe('isEvalDailyQuotaError', () => {
  it('is true only for a rate-limit rejection that names the per-day quota', () => {
    assert.equal(isEvalDailyQuotaError('429 Quota exceeded for metric ..._requests_PerDay ... retry in 10s'), true);
    assert.equal(isEvalDailyQuotaError('RESOURCE_EXHAUSTED: requests per day'), true);
    assert.equal(isEvalDailyQuotaError(FREE_TIER_429), false);
    assert.equal(isEvalDailyQuotaError('API key not valid'), false);
    assert.equal(isEvalDailyQuotaError('requests per day'), false);
  });
});

describe('nextEvalRetryDelayMs', () => {
  it('waits the server-provided retry hint (rounded up) plus a 1s margin on a per-minute 429', () => {
    assert.equal(nextEvalRetryDelayMs(FREE_TIER_429, 1), 44_000);
  });

  it('falls back to 60s when a 429 carries no retry hint', () => {
    assert.equal(nextEvalRetryDelayMs('RESOURCE_EXHAUSTED', 1), 60_000);
  });

  it('caps an unreasonably long hint', () => {
    assert.equal(nextEvalRetryDelayMs('429 Please retry in 900s.', 1), 120_000);
  });

  it('gives up immediately on a per-day quota', () => {
    assert.equal(nextEvalRetryDelayMs('429 Quota exceeded for metric ..._requests_PerDay ... retry in 10s', 1), undefined);
    assert.equal(nextEvalRetryDelayMs('RESOURCE_EXHAUSTED: requests per day', 1), undefined);
  });

  it('backs off linearly on 503 and connection errors', () => {
    assert.equal(nextEvalRetryDelayMs('{"status":"UNAVAILABLE"}', 1), 2000);
    assert.equal(nextEvalRetryDelayMs('fetch failed', 3), 6000);
    assert.equal(nextEvalRetryDelayMs('read ECONNRESET', 2), 4000);
  });

  it('never retries other errors', () => {
    assert.equal(nextEvalRetryDelayMs('API key not valid', 1), undefined);
    assert.equal(nextEvalRetryDelayMs('Failed to parse', 1), undefined);
  });

  it('stops retrying once the attempt budget is spent', () => {
    assert.equal(nextEvalRetryDelayMs(FREE_TIER_429, EVAL_MAX_ATTEMPTS), undefined);
    assert.notEqual(nextEvalRetryDelayMs(FREE_TIER_429, EVAL_MAX_ATTEMPTS - 1), undefined);
  });
});
