import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAiJobError } from './classify-ai-job-error.js';
import { AiGatewayBusyError, AiGatewayExhaustedError } from '../ai-gateway/adapter.js';
import { GeminiInvalidKeyError, GeminiRateLimitedError, GeminiUnknownError } from '../ai-gateway/gemini-client.js';
import { VendorCallTimeoutError, VendorKeyBusyError } from '../vendor-gateway/guarded-call.js';

test('classifyAiJobError', async (t) => {
  await t.test('gateway contention is unavailable, exhaustion is a rate limit', () => {
    assert.equal(classifyAiJobError(new AiGatewayBusyError('busy')).situation, 'unavailable');
    assert.equal(classifyAiJobError(new VendorKeyBusyError('busy')).situation, 'unavailable');
    assert.equal(classifyAiJobError(new AiGatewayExhaustedError('exhausted')).situation, 'rate_limited');
  });

  await t.test('everything else is the Gemini classifier', () => {
    assert.deepEqual(classifyAiJobError(new GeminiRateLimitedError('429', 30)), { situation: 'rate_limited', retryAfterSeconds: 30 });
    assert.equal(classifyAiJobError(new GeminiInvalidKeyError('API key not valid')).situation, 'invalid_credential');
    assert.equal(classifyAiJobError(new VendorCallTimeoutError('t')).situation, 'timeout');
    assert.equal(classifyAiJobError(new GeminiUnknownError('x', { status: 503 })).situation, 'unavailable');
    assert.equal(classifyAiJobError(new Error('surprise')).situation, 'unknown');
  });
});
